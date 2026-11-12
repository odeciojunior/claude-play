// Esquema progress/1 e leitura do estado do plan-coordinator. Fonte pura (DEC-058): sem
// efeitos, sem relógio (o instante chega como argumento) e sem dependências; as funções
// internas levam o prefixo ps porque outras cópias juntam fontes num só escopo.

export const STATE_SCHEMA = 'progress/1';

export const STEP_STATUSES = ['pending', 'launched', 'review-owed', 'pass', 'skip', 'skip-manual', 'waiting-manual', 'stopped'];

export const RUN_STATUSES = ['map-ready', 'in-progress', 'blocked', 'completed'];

export const EVENT_TYPES = [
  'approve-map',
  'block',
  'unblock',
  'launch',
  'inline-start',
  'inline-result',
  'report',
  'no-report',
  'review-result',
  'hold',
  'release',
  'skip',
  'commit',
  'wave-gate',
  'advance',
  'final-gate',
  'prelaunch-review',
  'authorize',
  'refuse',
  'card-changed',
  'answer',
];

const psClone = (v) => JSON.parse(JSON.stringify(v));

const psStep = (state, n) => state.steps.find((s) => s.n === n);

// Passo concluído de modo que dependentes podem seguir: pass, ou skip com saídas.
const psDepOk = (dep) => dep.status === 'pass' || (dep.status === 'skip' && dep.outputs === true);

const psDepsOk = (state, step) => step.deps.every((d) => {
  const dep = psStep(state, d);
  return dep !== undefined && psDepOk(dep);
});

// Dependência que nunca vai liberar sozinha: skip sem saídas ou passo parado para a pessoa.
const psDepHeld = (state, step) => step.deps.some((d) => {
  const dep = psStep(state, d);
  return dep !== undefined && (
    (dep.status === 'skip' && dep.outputs !== true) ||
    dep.status === 'skip-manual' ||
    dep.status === 'waiting-manual' ||
    dep.status === 'stopped'
  );
});

// Candidato a execução inline: barato, não externo, sem portão.
const psInline = (step) => step.tier === 'haiku' && !step.external && !step.gate;

const psByN = (a, b) => a.n - b.n;

export function initState(emitted, opts = {}) {
  const o = {
    planPath: null,
    spec: null,
    piece: null,
    worktree: null,
    branch: null,
    base: null,
    commits: 'none',
    test: null,
    baseline: null,
    now: null,
    ...opts,
  };
  const plan = emitted.plan;
  const steps = plan.tasks.map((t) => ({
    n: t.n,
    title: t.title,
    wave: t.wave,
    deps: psClone(t.deps),
    tier: t.route.tier,
    effort: t.route.effort,
    reviewTier: t.route.reviewTier,
    gate: t.route.gate,
    external: t.external,
    mode: 'delegated',
    agent: 'general-purpose',
    status: 'pending',
    attempts: 0,
    rounds: 0,
    agentId: null,
    preLaunchReview: null,
    authorized: null,
    handoff: null,
    sha: null,
    replacedBy: null,
    note: null,
    outputs: null,
    brief: 'briefs/T' + t.n + '.md',
  }));
  const waveNs = [...new Set(steps.map((s) => s.wave))].sort((a, b) => a - b);
  return {
    schema: STATE_SCHEMA,
    plan: {
      path: o.planPath,
      id: plan.id,
      digest: emitted.digest,
      maxWidth: plan.maxWidth,
      roadmap: plan.roadmap ?? null,
      spec: o.spec,
    },
    piece: o.piece,
    run: {
      status: 'map-ready',
      wave: 1,
      worktree: o.worktree,
      branch: o.branch,
      base: o.base,
      test: o.test,
      baseline: o.baseline,
      commits: o.commits,
      waveGateOwed: null,
      question: null,
      updated: o.now,
    },
    waves: waveNs.map((w) => ({ n: w, tasks: steps.filter((s) => s.wave === w).map((s) => s.n).sort((a, b) => a - b) })),
    steps,
    finalGate: { status: 'pending', rounds: 0, lastVerdict: null },
    manual: [],
    history: [{ event: 'init', at: o.now }],
  };
}

// Próxima ação, lida só do estado. Não muta nada.
export function nextAction(state) {
  const { run, steps } = state;
  if (run.status === 'completed') return { action: 'done' };
  if (run.status === 'map-ready') return { action: 'approve-map' };
  if (run.status === 'blocked') return { action: 'ask', question: run.question };

  const inFlight = steps.filter((s) => s.status === 'launched').sort(psByN);
  if (inFlight.length) {
    return { action: 'await', steps: inFlight.map((s) => s.n), agentIds: inFlight.map((s) => s.agentId) };
  }

  const owed = steps.filter((s) => s.status === 'review-owed').sort(psByN);
  if (owed.length) return { action: 'review', step: owed[0].n, reviewTier: owed[0].reviewTier };

  if (run.waveGateOwed !== null && run.waveGateOwed !== undefined) {
    return { action: 'wave-gate', wave: run.waveGateOwed };
  }

  const pendingAll = steps.filter((s) => s.status === 'pending');
  const pending = pendingAll.filter((s) => s.wave === run.wave).sort(psByN);

  const held = pending.filter((s) => psDepHeld(state, s));
  if (held.length) return { action: 'hold', steps: held.map((s) => s.n) };

  const ready = pending.filter((s) => psDepsOk(state, s));
  const externals = ready.filter((s) => s.external);
  const unreviewed = externals.filter((s) => s.preLaunchReview !== 'pass');
  if (unreviewed.length) return { action: 'prelaunch-review', steps: unreviewed.map((s) => s.n) };
  const unauthorized = externals.filter((s) => !s.authorized);
  if (unauthorized.length) return { action: 'authorize', steps: unauthorized.map((s) => s.n) };

  if (ready.length) {
    const inline = ready.filter(psInline);
    const rest = ready.filter((s) => !psInline(s));
    const pick = (s, mode) => ({ n: s.n, tier: s.tier, effort: s.effort, agent: s.agent, brief: s.brief, mode });
    return {
      action: 'launch',
      wave: run.wave,
      steps: [...inline.map((s) => pick(s, 'inline')), ...rest.map((s) => pick(s, 'delegated'))],
    };
  }

  if (pending.length === 0 && state.waves.some((w) => w.n === run.wave + 1)) {
    return { action: 'advance', wave: run.wave + 1 };
  }

  if (pendingAll.length === 0) {
    if (state.finalGate.status === 'pending') return { action: 'final-gate' };
    const open = state.manual.filter((m) => m.open);
    if (open.length) return { action: 'ask', manual: open };
    return { action: 'done' };
  }

  return { action: 'ask', question: 'nenhum passo pendente pode começar; confira o estado com show' };
}
