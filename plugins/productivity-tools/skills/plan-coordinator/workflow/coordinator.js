export const meta = {
  name: 'coordinator-workflow',
  description: 'Runs the waves of an approved plan/1: dispatches each wave in parallel, reviews each step, commits in series after the wave, runs the wave gate against the baseline and records every transition in the signed progress state',
  whenToUse: 'Launched only by the plan-coordinator skill after its select, init and token steps; never call it directly: to execute a plan, use the plan-coordinator skill. Args it passes: {"plan":"<abs path to plan.md>","state":"<abs path to progress.json>","runToken":"<token from progress.mjs token>","progress":"<abs path to scripts/progress.mjs>","test":"<test command>"}',
  phases: [
    { title: 'Read', detail: 'signed read of the progress state and plan check' },
    { title: 'Wave', detail: 'parallel implementers of the open steps whose dependencies passed' },
    { title: 'Review', detail: 'per-step review with rounds of fixes' },
    { title: 'Commit', detail: 'serial per-step commits after the wave, each with the files of its step' },
    { title: 'Gate', detail: 'wave gate against the baseline, advance, final gate' },
  ],
}

// plan-coordinator workflow script. Self-contained: no imports, no filesystem or Node API.
// Runtime API: agent(prompt, {label, phase, model, schema}), phase(), log(), args, budget, parallel().
//
// ARGS
//   plan (required): absolute path of the plan.md
//   state (required): absolute path of the progress.json written by progress.mjs init
//   runToken (required): fresh token from `progress.mjs token`, new for each call
//   progress (required): absolute path of scripts/progress.mjs of the plan-coordinator skill; every read and write of the state goes through it
//   authorizeExternal: ["plan:T3@<8 hex>"]: external steps the owner authorizes; the digest is part of the item
//   answers: [{ event|type: answer|unblock|release|hold|refuse, step, value, text }]: events the person answered, applied before the run (`event` is the documented key, `type` is accepted)
//   test: the test command of the wave gate ("none" or absent: no baseline and no wave gate run)
//
// RETURN: { status: 'done', run, wave, map, steps, finalGate, open }
//       | { status: 'stopped', stop: { kind: ask|plan-changed|state-divergence, ... }, resumeArgs }
//       | { status: 'error', error }
// Every transition is written to the progress state before the call returns.

// <pure>
// <embed src="../../../lib/progress-state.mjs" exports="strip">
// Gerado de ../../../lib/progress-state.mjs por plugins/productivity-tools/scripts/embed.mjs; não editar aqui.
// Esquema progress/1 e leitura do estado do plan-coordinator. Fonte pura (DEC-058): sem
// efeitos, sem relógio (o instante chega como argumento) e sem dependências; as funções
// internas levam o prefixo ps porque outras cópias juntam fontes num só escopo.

const STATE_SCHEMA = 'progress/1';

const STEP_STATUSES = ['pending', 'launched', 'review-owed', 'pass', 'skip', 'skip-manual', 'waiting-manual', 'stopped'];

const RUN_STATUSES = ['map-ready', 'in-progress', 'blocked', 'completed'];

const EVENT_TYPES = [
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
  'baseline',
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

function initState(emitted, opts = {}) {
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
    files: [...new Set([...t.files.create, ...t.files.modify, ...t.files.test])],
    noCommit: t.noCommit === true,
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
function nextAction(state) {
  const { run, steps } = state;
  if (run.status === 'completed') return { action: 'done' };
  if (run.status === 'map-ready') return { action: 'approve-map' };
  if (run.status === 'blocked') return { action: 'ask', question: run.question };

  const inFlight = steps.filter((s) => s.status === 'launched').sort(psByN);
  if (inFlight.length) {
    return { action: 'await', steps: inFlight.map((s) => s.n), agentIds: inFlight.map((s) => s.agentId) };
  }

  const owed = steps.filter((s) => s.status === 'review-owed').sort(psByN);
  if (owed.length) // DEC-206: passo com portão tem revisor opus, qualquer que seja o reviewTier do roteamento.
  return { action: 'review', step: owed[0].n, reviewTier: 'opus' };

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
    const open = state.manual.filter((m) => m.open);
    if (open.length) return { action: 'ask', manual: open };
    if (state.finalGate.status === 'pending') return { action: 'final-gate' };
    return { action: 'done' };
  }

  return { action: 'ask', question: 'nenhum passo pendente pode começar; confira o estado com show' };
}

// ---------------------------------------------------------------------------
// applyEvent: transições do ciclo de vida (delegation-protocol, Step lifecycle).
// Cada psOn<Evento> recebe um clone profundo e devolve uma recusa antes de qualquer
// escrita, ou null depois de mutar o clone. Comentários "// linha <n>" citam a tabela.
// ---------------------------------------------------------------------------

const PS_TIER_RANK = { haiku: 0, sonnet: 1, opus: 2 };

const psRefuse = (code, message) => ({ ok: false, code, message });

const psOpenSteps = (state, wave) => state.steps.filter((s) => s.wave === wave && ['pending', 'launched', 'review-owed'].includes(s.status));

const psAnyOf = (state, statuses) => state.steps.some((s) => statuses.includes(s.status));

const psGateOwed = (state) => state.run.waveGateOwed !== null && state.run.waveGateOwed !== undefined;

// Resolve a lista de passos do evento; devolve { list } ou uma recusa.
function psResolve(state, ev, plural) {
  const ns = plural ? ev.steps : [ev.step];
  if (!Array.isArray(ns) || ns.length === 0 || ns.some((n) => !Number.isInteger(n))) {
    return psRefuse('unknown-step', 'passo não informado');
  }
  const list = [];
  for (const n of ns) {
    const s = psStep(state, n);
    if (!s) return psRefuse('unknown-step', 'passo inexistente: ' + n);
    list.push(s);
  }
  return { list };
}

// Passos dependentes, direta ou transitivamente, de n.
function psDependents(state, n) {
  const seen = new Set([n]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of state.steps) {
      if (!seen.has(s.n) && s.deps.some((d) => seen.has(d))) {
        seen.add(s.n);
        grew = true;
      }
    }
  }
  seen.delete(n);
  return state.steps.filter((s) => seen.has(s.n)).sort(psByN);
}

function psMarkDependentsWaiting(state, n) {
  for (const d of psDependents(state, n)) {
    if (d.status === 'pending') d.status = 'waiting-manual';
  }
}

// Retém o passo com uma entrada manual aberta e marca os dependentes. // linha 3, 4
function psHoldStep(state, step, kind, text) {
  step.status = 'skip-manual';
  state.manual.push({ kind, step: step.n, text, open: true });
  psMarkDependentsWaiting(state, step.n);
}

// Passo que volta a pending numa onda anterior à corrente: a onda recua para ele, senão
// launch recusa wave-order e nada mais move run.wave.
function psReopen(state, step) {
  if (step.wave < state.run.wave) state.run.wave = step.wave;
}

// Falha de um passo não externo: repete até 3 tentativas, depois retém. // linha 10
function psFailStep(state, step, text) {
  if (step.attempts < 3) {
    step.status = 'pending';
  } else {
    psHoldStep(state, step, 'open-question', text);
  }
}

// Passo externo cujo resultado não foi conferido: para na pessoa, nunca volta a pending. // linha 12, 14, 25
function psStopStep(state, step, text) {
  step.status = 'stopped';
  state.manual.push({ kind: 'open-question', step: step.n, text, open: true });
}

// Fecha as entradas manuais abertas do passo; com kind, também as reclassifica.
function psCloseManual(state, n, kind) {
  for (const m of state.manual) {
    if (m.step === n && m.open) {
      m.open = false;
      if (kind) m.kind = kind;
    }
  }
}

// Pré-condições comuns de launch e inline-start.
function psLaunchChecks(state, list, tier) {
  if (state.run.status === 'blocked') return psRefuse('blocked', 'execução bloqueada; responda a pergunta primeiro');
  if (state.run.status !== 'in-progress') return psRefuse('wrong-status', 'execução não está em andamento');
  for (const s of list) {
    if (s.status !== 'pending') return psRefuse('wrong-status', 'passo ' + s.n + ' não está pending (' + s.status + ')');
    if (s.wave !== state.run.wave || psGateOwed(state)) {
      return psRefuse('wave-order', 'passo ' + s.n + ' não é da onda corrente ou há portão de onda devido');
    }
    if (!psDepsOk(state, s)) return psRefuse('dependency-not-passed', 'passo ' + s.n + ' tem dependência que não passou');
    if (tier !== undefined && tier !== null) {
      if (!(tier in PS_TIER_RANK)) return psRefuse('tier-down', 'nível desconhecido: ' + tier);
      if (PS_TIER_RANK[tier] < PS_TIER_RANK[s.tier]) return psRefuse('tier-down', 'nível ' + tier + ' abaixo do registrado (' + s.tier + ')');
    }
  }
  return null;
}

const psHandlers = {
  'approve-map'(state) { // linha 28
    if (state.run.status !== 'map-ready') return psRefuse('wrong-status', 'o mapa já foi aprovado');
    state.run.status = 'in-progress';
    return null;
  },

  block(state, ev) { // linha 29, 30
    if (state.run.status !== 'map-ready' && state.run.status !== 'in-progress') {
      return psRefuse('wrong-status', 'só se bloqueia com map-ready ou in-progress');
    }
    state.run.status = 'blocked';
    state.run.question = ev.text ?? null;
    return null;
  },

  unblock(state) { // linha 30
    if (state.run.status !== 'blocked') return psRefuse('wrong-status', 'execução não está bloqueada');
    state.run.status = 'in-progress';
    state.run.question = null;
    return null;
  },

  launch(state, ev) { // linha 1, 8
    const r = psResolve(state, ev, true);
    if (r.ok === false) return r;
    const bad = psLaunchChecks(state, r.list, ev.tier);
    if (bad) return bad;
    for (const s of r.list) { // linha 1, 6
      if (!s.external) continue;
      if (s.attempts >= 1) return psRefuse('external-relaunch', 'passo externo ' + s.n + ' já foi lançado e não se repete');
      if (s.preLaunchReview !== 'pass' || !s.authorized) {
        return psRefuse('external-unauthorized', 'passo externo ' + s.n + ' exige revisão prévia e autorização');
      }
    }
    for (const s of r.list) {
      s.status = 'launched';
      s.attempts += 1;
      if (ev.agentId !== undefined) s.agentId = ev.agentId;
      if (ev.tier) s.tier = ev.tier;
    }
    return null;
  },

  'inline-start'(state, ev) { // linha 2
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const bad = psLaunchChecks(state, r.list, null);
    if (bad) return bad;
    const s = r.list[0];
    if (!psInline(s) || psAnyOf(state, ['launched'])) {
      return psRefuse('inline-not-allowed', 'passo ' + s.n + ' não pode rodar inline agora');
    }
    s.status = 'launched';
    s.mode = 'inline';
    s.attempts += 1;
    return null;
  },

  'inline-result'(state, ev) { // linha 2
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status !== 'launched' || s.mode !== 'inline') return psRefuse('wrong-status', 'passo ' + s.n + ' não está inline em execução');
    if (ev.value === 'pass') {
      s.status = 'pass';
    } else if (ev.value === 'fail') {
      s.status = 'pending';
      s.mode = 'delegated';
      s.tier = 'sonnet';
    } else {
      return psRefuse('wrong-status', 'valor inválido: ' + ev.value);
    }
    return null;
  },

  report(state, ev) { // linha 9, 10
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status !== 'launched') return psRefuse('wrong-status', 'passo ' + s.n + ' não está launched');
    if (!['pass', 'fail', 'blocked'].includes(ev.value)) return psRefuse('wrong-status', 'valor inválido: ' + ev.value);
    if (ev.text !== undefined) s.note = ev.text;
    if (ev.value === 'pass' && ev.handoff !== undefined) s.handoff = ev.handoff;
    if (ev.value === 'pass') {
      s.status = s.gate ? 'review-owed' : 'pass';
    } else if (s.external) { // linha 12
      psStopStep(state, s, ev.text ?? 'passo externo ' + s.n + ' sem resultado conferido');
    } else {
      psFailStep(state, s, ev.text ?? 'passo ' + s.n + ' falhou ' + s.attempts + ' vezes');
    }
    return null;
  },

  'no-report'(state, ev) { // linha 11
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status !== 'launched') return psRefuse('wrong-status', 'passo ' + s.n + ' não está launched');
    if (s.external) { // linha 12
      psStopStep(state, s, ev.text ?? 'passo externo ' + s.n + ' sem relatório; resultado não conferido');
      return null;
    }
    s.status = 'pending';
    return null;
  },

  'review-result'(state, ev) { // linha 13, 14
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status !== 'review-owed') return psRefuse('wrong-status', 'passo ' + s.n + ' não está review-owed');
    if (ev.value === 'pass') {
      s.status = 'pass';
    } else if (ev.value === 'lost') {
      s.note = 'reviewer lost';
    } else if (ev.value === 'defects') {
      if (s.external) { // linha 14
        psStopStep(state, s, ev.text ?? 'passo externo ' + s.n + ' com defeitos na revisão; resultado não conferido');
      } else if (s.rounds < 2) {
        s.status = 'launched';
        s.rounds += 1;
      } else {
        psFailStep(state, s, ev.text ?? 'passo ' + s.n + ' com defeitos após duas rodadas de correção');
      }
    } else {
      return psRefuse('wrong-status', 'valor inválido: ' + ev.value);
    }
    return null;
  },

  hold(state, ev) { // linha 3, 4
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status !== 'pending') return psRefuse('wrong-status', 'passo ' + s.n + ' não está pending');
    const upstream = s.deps.some((d) => {
      const dep = psStep(state, d);
      return dep && ['skip-manual', 'waiting-manual', 'stopped'].includes(dep.status);
    });
    if (upstream) {
      s.status = 'waiting-manual';
      psMarkDependentsWaiting(state, s.n);
    } else {
      psHoldStep(state, s, 'open-question', ev.text ?? 'passo ' + s.n + ' retido');
    }
    return null;
  },

  release(state, ev) { // linha 18, 24
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status === 'skip-manual') {
      for (const m of state.manual) if (m.step === s.n && m.open) m.open = false;
    } else if (s.status === 'waiting-manual') {
      if (psDepHeld(state, s)) return psRefuse('dependency-held', 'passo ' + s.n + ' ainda depende de passo retido');
    } else {
      return psRefuse('wrong-status', 'passo ' + s.n + ' não está retido nem esperando');
    }
    s.status = 'pending';
    psReopen(state, s);
    return null;
  },

  skip(state, ev) { // linha 26
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status !== 'pending' || state.run.status !== 'map-ready') return psRefuse('wrong-status', 'skip só vale para passo pending com o mapa por aprovar');
    if (ev.value !== 'outputs' && ev.value !== 'no-outputs') return psRefuse('wrong-status', 'valor inválido: ' + ev.value);
    s.status = 'skip';
    s.outputs = ev.value === 'outputs';
    return null;
  },

  commit(state, ev) { // linha 25
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status !== 'pass' || typeof ev.sha !== 'string' || ev.sha === '') return psRefuse('wrong-status', 'commit exige passo pass e sha');
    s.sha = ev.sha;
    return null;
  },

  'wave-gate'(state, ev) { // linha 25
    if (!psGateOwed(state) || psAnyOf(state, ['launched', 'review-owed'])) {
      return psRefuse('wrong-status', 'não há portão de onda devido ou há passo em voo');
    }
    const owed = state.run.waveGateOwed;
    if (ev.value === 'pass' || ev.value === 'fail') {
      for (const x of state.steps) if (x.wave === owed && x.status === 'pass') x.gated = true;
    }
    if (ev.value === 'pass') {
      state.run.waveGateOwed = null;
      return null;
    }
    if (ev.value !== 'fail') return psRefuse('wrong-status', 'valor inválido: ' + ev.value);
    if (ev.step === undefined) return null;
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (s.status !== 'pass' || s.wave !== owed) return psRefuse('wrong-status', 'passo ' + s.n + ' não é pass da onda ' + owed);
    state.run.waveGateOwed = null;
    if (s.external) { // linha 25
      psStopStep(state, s, ev.text ?? 'portão da onda ' + owed + ' reprovou o passo externo ' + s.n);
    } else {
      psFailStep(state, s, ev.text ?? 'portão da onda ' + owed + ' reprovou o passo ' + s.n);
    }
    return null;
  },

  advance(state) { // laço de ondas
    if (psGateOwed(state)) return psRefuse('gate-owed', 'portão da onda ' + state.run.waveGateOwed + ' devido');
    if (psOpenSteps(state, state.run.wave).length) return psRefuse('steps-open', 'há passo da onda corrente pending, launched ou review-owed');
    const next = state.waves.map((w) => w.n).filter((n) => n > state.run.wave).sort((a, b) => a - b)[0];
    if (next === undefined) return psRefuse('steps-open', 'não há próxima onda');
    state.run.wave = next;
    return null;
  },

  'final-gate'(state, ev) { // linha 27, 31
    if (psAnyOf(state, ['pending', 'launched', 'review-owed']) || psGateOwed(state)) {
      return psRefuse('steps-open', 'há passo aberto ou portão de onda devido');
    }
    if (!['pass', 'defects', 'skip'].includes(ev.value)) return psRefuse('wrong-status', 'valor inválido: ' + ev.value);
    let s = null;
    if (ev.value === 'defects' && ev.step !== undefined) {
      const r = psResolve(state, ev, false);
      if (r.ok === false) return r;
      s = r.list[0];
      if (s.status !== 'pass') return psRefuse('wrong-status', 'passo ' + s.n + ' não está pass');
    }
    state.finalGate.rounds += 1;
    state.finalGate.lastVerdict = ev.value;
    if (ev.value === 'pass' || ev.value === 'skip') {
      state.finalGate.status = ev.value;
      state.run.status = 'completed';
    } else if (s && s.external) { // linha 25
      psStopStep(state, s, ev.text ?? 'portão final reprovou o passo externo ' + s.n);
    } else if (s) {
      psFailStep(state, s, ev.text ?? 'portão final reprovou o passo ' + s.n);
      if (s.status === 'pending') state.run.wave = s.wave;
    }
    return null;
  },

  'prelaunch-review'(state, ev) { // linha 5
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (!s.external || s.status !== 'pending') return psRefuse('wrong-status', 'passo ' + s.n + ' não é externo pending');
    if (ev.value === 'pass') {
      s.preLaunchReview = 'pass';
    } else if (ev.value === 'defects') {
      s.rounds += 1;
      s.preLaunchReview = null;
      if (s.rounds >= 2) psHoldStep(state, s, 'prelaunch-failed', ev.text ?? 'revisão prévia do passo ' + s.n + ' com defeitos após duas rodadas');
    } else {
      return psRefuse('wrong-status', 'valor inválido: ' + ev.value);
    }
    return null;
  },

  authorize(state, ev, now) { // linha 6, 20, 23
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (!s.external) return psRefuse('wrong-status', 'passo ' + s.n + ' não é externo');
    if (s.status === 'pending' && s.preLaunchReview === 'pass') {
      s.authorized = now;
    } else if (s.status === 'skip-manual' && state.manual.some((m) => m.step === s.n && (m.kind === 'refused' || m.kind === 'not-named'))) {
      s.authorized = now;
      s.status = 'pending';
      psCloseManual(state, s.n);
      psReopen(state, s);
    } else {
      return psRefuse('wrong-status', 'passo ' + s.n + ' não está pronto para autorização');
    }
    return null;
  },

  refuse(state, ev) { // linha 6
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (!s.external || s.status !== 'pending' || s.preLaunchReview !== 'pass') {
      return psRefuse('wrong-status', 'passo ' + s.n + ' não é externo pending revisado');
    }
    if (ev.value !== 'refused' && ev.value !== 'not-named') return psRefuse('wrong-status', 'valor inválido: ' + ev.value);
    psHoldStep(state, s, ev.value, ev.text ?? 'autorização do passo externo ' + s.n + ' não concedida');
    return null;
  },

  baseline(state, ev) { // linha de base dos testes
    if (!Number.isInteger(ev.exit)) return psRefuse('wrong-status', 'exit deve ser inteiro');
    if (!Array.isArray(ev.failedNames) || ev.failedNames.some((x) => typeof x !== 'string')) {
      return psRefuse('wrong-status', 'failedNames deve ser lista de textos');
    }
    if (ev.failedNamesCut !== undefined && (!Number.isInteger(ev.failedNamesCut) || ev.failedNamesCut < 0)) {
      return psRefuse('wrong-status', 'failedNamesCut deve ser inteiro >= 0');
    }
    state.run.baseline = { test: ev.test ?? null, exit: ev.exit, tail: ev.tail ?? null, failedNames: psClone(ev.failedNames) };
    if (ev.failedNamesCut !== undefined) state.run.baseline.failedNamesCut = ev.failedNamesCut;
    if (state.run.test === null || state.run.test === undefined) state.run.test = ev.test ?? null;
    return null;
  },

  'card-changed'(state, ev) { // linha 7, 19
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    if (!s.external || (s.status !== 'pending' && s.status !== 'skip-manual')) {
      return psRefuse('wrong-status', 'passo ' + s.n + ' não é externo pending ou skip-manual');
    }
    s.preLaunchReview = null;
    s.authorized = null;
    return null;
  },

  answer(state, ev) { // linha 15-17, 19, 21, 22
    const r = psResolve(state, ev, false);
    if (r.ok === false) return r;
    const s = r.list[0];
    const v = ev.value;
    if (s.status === 'stopped') {
      if (v === 'done') {
        s.status = 'pass';
        psCloseManual(state, s.n);
      } else if (v === 'no') {
        psCloseManual(state, s.n, 'refused');
      } else if (v === 'rerun') {
        if (!s.external) return psRefuse('wrong-status', 'passo ' + s.n + ' não é externo');
        const n2 = Math.max(...state.steps.map((x) => x.n)) + 1;
        psCloseManual(state, s.n, 'refused');
        s.replacedBy = n2;
        state.steps.push({
          ...psClone(s),
          n: n2,
          mode: 'delegated',
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
        });
        for (const x of state.steps) {
          if (x.n !== n2) x.deps = x.deps.map((d) => (d === s.n ? n2 : d));
        }
        for (const w of state.waves) w.tasks = w.tasks.map((t) => (t === s.n ? n2 : t)).sort((a, b) => a - b);
        if (s.wave < state.run.wave) state.run.wave = s.wave; // portão final: o passo novo nasce numa onda anterior
      } else {
        return psRefuse('wrong-status', 'valor inválido para passo stopped: ' + v);
      }
    } else if (s.status === 'skip-manual') {
      if (v === 'done') {
        s.status = 'pass';
        psCloseManual(state, s.n);
      } else if (v === 'no') {
        psCloseManual(state, s.n, 'refused');
      } else if (v === 'value') {
        s.note = ev.text ?? null;
        s.status = 'pending';
        psCloseManual(state, s.n);
        psReopen(state, s);
        if (s.external) {
          s.preLaunchReview = null;
          s.authorized = null;
        }
      } else {
        return psRefuse('wrong-status', 'valor inválido para passo skip-manual: ' + v);
      }
    } else {
      return psRefuse('wrong-status', 'passo ' + s.n + ' não está stopped nem skip-manual');
    }
    return null;
  },
};

function applyEvent(state, event, now) {
  if (!state || state.schema !== STATE_SCHEMA) return psRefuse('state-schema', 'schema diferente de ' + STATE_SCHEMA);
  if (!event || !EVENT_TYPES.includes(event.type)) return psRefuse('unknown-event', 'evento desconhecido: ' + (event && event.type));
  const handler = psHandlers[event.type];
  if (!handler) return psRefuse('unknown-event', 'evento ainda não suportado: ' + event.type);

  const next = psClone(state);
  const before = new Map(next.steps.map((s) => [s.n, s.status]));
  const refused = handler(next, event, now);
  if (refused) return refused;

  // Passo que chegou a pass perde a marca de portão: o passo precisa de portão de novo.
  for (const s of next.steps) if (s.status === 'pass' && before.get(s.n) !== 'pass') delete s.gated;

  // Dependente esperando cujo upstream não está mais retido volta a pending (linha 24),
  // senão o passo nunca roda e a execução fecha sem ele. Repete até estabilizar.
  for (let moved = true; moved;) {
    moved = false;
    for (const s of next.steps) {
      if (s.status === 'waiting-manual' && !psDepHeld(next, s)) {
        s.status = 'pending';
        psReopen(next, s);
        moved = true;
      }
    }
  }

  // Portão de onda devido: a onda corrente se assentou (nada pending, launched ou
  // review-owed) com algum pass ainda sem portão, qualquer que seja o evento que a assentou.
  if (!psGateOwed(next) && next.run.status !== 'completed') {
    const w = next.run.wave;
    if (psOpenSteps(next, w).length === 0 && next.steps.some((s) => s.wave === w && s.status === 'pass' && s.gated !== true)) {
      next.run.waveGateOwed = w;
    }
  }

  const entry = { event: event.type };
  if (event.steps !== undefined) entry.steps = event.steps;
  else if (event.step !== undefined) entry.step = event.step;
  if (event.value !== undefined) entry.value = event.value;
  entry.at = now;
  next.history.push(entry);
  next.run.updated = now;
  return { ok: true, state: next };
}

// Aplica o lote sobre uma cópia, com o `at` de cada evento (ou now); atômico: uma recusa
// devolve o código e o índice do evento e nenhum estado.
function applyEvents(state, events, now) {
  if (!Array.isArray(events)) return { ...psRefuse('unknown-event', 'lote de eventos não é lista'), index: 0 };
  let cur = psClone(state);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const at = ev && ev.at !== undefined ? ev.at : now;
    const r = applyEvent(cur, ev, at);
    if (!r.ok) return { ok: false, code: r.code, message: r.message, index: i };
    cur = r.state;
  }
  return { ok: true, state: cur, code: null, index: null };
}
// </embed>
// <embed src="../../../lib/plan-digest.mjs" exports="strip">
// Gerado de ../../../lib/plan-digest.mjs por plugins/productivity-tools/scripts/embed.mjs; não editar aqui.
// Resumo de integridade do plano: fonte pura (DEC-058), sem imports nem acesso a ambiente.
// O algoritmo é o de planFingerprint (FNV-1a de 32 bits) de roadmap-release.js.

// Cópia com chaves de objeto ordenadas (por `<` de string), recursiva em objetos e listas.
function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))) out[k] = canon(value[k]);
    return out;
  }
  return value;
}

// FNV-1a de 32 bits: 8 dígitos hexadecimais minúsculos.
function fnv1a(str) {
  let pdH = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    pdH ^= str.charCodeAt(i);
    pdH = Math.imul(pdH, 0x01000193) >>> 0;
  }
  return pdH.toString(16).padStart(8, '0');
}

function planDigest({ plan, source }) {
  return fnv1a(JSON.stringify(canon({ plan, source })));
}

// Maior saída que um agente copia literal e maior envelope serializado de uma fatia, em bytes UTF-8.
const MAX_COPY_BYTES = 3500;
const SLICE_BYTES = 3072;

// Bytes UTF-8 de um ponto de código (substituto solto vale U+FFFD, 3 bytes).
function cpBytes(cp) {
  if (cp >= 0xd800 && cp <= 0xdfff) return 3;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

// Tamanho em bytes da codificação UTF-8 de str.
function utf8Length(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp > 0xffff) i++;
    n += cpBytes(cp);
  }
  return n;
}

// Bytes UTF-8 de str, feitos à mão.
function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.codePointAt(i);
    if (cp > 0xffff) i++;
    else if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

// SHA-256 em JS puro sobre uma lista de bytes: devolve os 32 bytes do digest (núcleo único do algoritmo).
function sha256Bytes(input) {
  const b = Array.from(input);
  const bits = b.length * 8;
  b.push(0x80);
  while (b.length % 64 !== 56) b.push(0);
  const hi = Math.floor(bits / 4294967296);
  const lo = bits >>> 0;
  for (const x of [hi, lo]) b.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array(64);
  const rot = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < b.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = ((b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3]) >>> 0;
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) >>> 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    const v = [a, bb, c, d, e, f, g, k];
    for (let i = 0; i < 8; i++) h[i] = (h[i] + v[i]) >>> 0;
  }
  const out = [];
  for (const x of h) out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
  return out;
}

// SHA-256 em JS puro sobre a codificação UTF-8 de str: 64 dígitos hexadecimais minúsculos.
function sha256Hex(str) {
  return sha256Bytes(utf8Bytes(str)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// XOR dos bytes com o keystream da fatia: concatenação de sha256(`${nonce}:${slice}:${c}`), c = 0, 1, 2...
// (bytes brutos do digest). O índice da fatia entra no keystream para não repetir entre fatias.
// Ofuscação, não sigilo: o nonce vai no próprio envelope; serve só para o texto não ser legível a quem copia.
function xorStream(bytes, nonce, slice) {
  const out = new Array(bytes.length);
  let ks = [];
  for (let i = 0, c = 0; i < bytes.length; i++) {
    if (i % 32 === 0) ks = sha256Bytes(utf8Bytes(`${nonce}:${slice}:${c++}`));
    out[i] = bytes[i] ^ ks[i % 32];
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Base64 padrão (com "=") de uma lista de bytes.
function b64Encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

// Bytes de um base64 padrão estrito; null se inválido (alfabeto, tamanho, padding).
function b64Decode(str) {
  if (typeof str !== 'string' || str.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(str)) return null;
  const out = [];
  for (let i = 0; i < str.length; i += 4) {
    const q = str.slice(i, i + 4);
    const pad = q.endsWith('==') ? 2 : q.endsWith('=') ? 1 : 0;
    if (pad && i + 4 !== str.length) return null;
    const n = (B64.indexOf(q[0]) << 18) | (B64.indexOf(q[1]) << 12) | ((pad === 2 ? 0 : B64.indexOf(q[2])) << 6) | (pad ? 0 : B64.indexOf(q[3]));
    out.push((n >> 16) & 255);
    if (pad < 2) out.push((n >> 8) & 255);
    if (pad < 1) out.push(n & 255);
  }
  return out;
}

// Texto de uma lista de bytes UTF-8; sequência inválida vira U+FFFD.
function utf8Decode(b) {
  let out = '';
  for (let i = 0; i < b.length;) {
    const c = b[i];
    const len = c < 0x80 ? 1 : c >= 0xc2 && c < 0xe0 ? 2 : c >= 0xe0 && c < 0xf0 ? 3 : c >= 0xf0 && c < 0xf5 ? 4 : 0;
    let cp = len === 1 ? c : len === 2 ? c & 31 : len === 3 ? c & 15 : c & 7;
    let ok = len > 0 && i + len <= b.length;
    for (let k = 1; ok && k < len; k++) {
      if ((b[i + k] & 0xc0) !== 0x80) ok = false;
      else cp = (cp << 6) | (b[i + k] & 63);
    }
    if (ok && ((len === 3 && (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff))) || (len === 4 && (cp < 0x10000 || cp > 0x10ffff)))) ok = false;
    if (!ok) { out += String.fromCharCode(0xfffd); i++; continue; }
    out += String.fromCodePoint(cp);
    i += len;
  }
  return out;
}

// Envelope assinado: o cabeçalho, enc, slice, slices, total, text (xor-base64) e o digest FNV do resto.
function signEnv(head, slice, slices, total, text) {
  const rest = { ...head, enc: 'xor-base64', slice, slices, total, text };
  return { ...rest, digest: fnv1a(JSON.stringify(canon(rest))) };
}

// Corta os bytes UTF-8 de text em envelopes de até SLICE_BYTES serializados; text vai em xor-base64
// (bytes XOR keystream de head.nonce e do índice da fatia, depois base64; ofuscação, não sigilo).
// Partes de múltiplos de 3 bytes (sem "=" no meio); uma parte pode cortar um caractere multibyte.
function sliceEnvelopes(head, text) {
  const total = { sha256: sha256Hex(text), bytes: utf8Length(text) };
  const bytes = utf8Bytes(text);
  for (let d = 1; ; d++) {
    const big = 10 ** d - 1;
    const room = SLICE_BYTES - utf8Length(JSON.stringify(signEnv(head, big, big, total, '')));
    const step = Math.floor(room / 4) * 3;
    if (step < 3) throw new Error('slice header larger than the slice limit');
    const parts = [];
    let from = 0;
    do {
      parts.push(b64Encode(xorStream(bytes.slice(from, from + step), head.nonce, parts.length)));
      from += step;
    } while (from < bytes.length);
    if (String(parts.length).length <= d) return parts.map((p, i) => signEnv(head, i, parts.length, total, p));
  }
}

// Confere um envelope: tool, comando (command ou mode), nonce, índice, codificação e digest.
function checkSlice(env, { tool, command, nonce, slice } = {}) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return { ok: false, why: 'the slice is not an object' };
  if (env.tool !== tool) return { ok: false, why: 'the slice is from another tool' };
  if ((env.command ?? env.mode) !== command) return { ok: false, why: 'the slice is from another command' };
  if (env.nonce !== nonce) return { ok: false, why: 'the slice has another nonce' };
  if (env.slice !== slice) return { ok: false, why: 'the slice has another index' };
  if (env.enc !== 'xor-base64') return { ok: false, why: 'the slice is not xor-base64' };
  if (typeof env.text !== 'string') return { ok: false, why: 'the slice has no text' };
  const { digest, ...rest } = env;
  if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, why: 'the digest of the slice does not match: the copy is not literal' };
  return { ok: true, why: null };
}

// Remonta o texto de uma leitura completa; recusa mistura, falta, ordem trocada, enc diferente de xor-base64, base64 inválido e SHA divergente.
// Junta os bytes de todas as fatias antes de converter para texto (uma fatia pode cortar um caractere).
function joinSlices(envs) {
  if (!Array.isArray(envs) || envs.length === 0) return { ok: false, why: 'there are no slices' };
  const first = envs[0];
  if (!first || !first.total) return { ok: false, why: 'the slice has no total' };
  const all = [];
  for (let i = 0; i < envs.length; i++) {
    const env = envs[i];
    if (!env || typeof env !== 'object' || typeof env.text !== 'string' || !env.total) return { ok: false, why: `slice ${i} is malformed` };
    if (env.enc !== 'xor-base64') return { ok: false, why: `slice ${i} is not xor-base64` };
    if (env.slice !== i) return { ok: false, why: `slice ${i} is missing or out of order` };
    if (env.slices !== envs.length) return { ok: false, why: 'the slice count does not match the slices received' };
    if (env.total.sha256 !== first.total.sha256 || env.total.bytes !== first.total.bytes) return { ok: false, why: 'the slices come from different reads' };
    const { digest, ...rest } = env;
    if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, why: `the digest of slice ${i} does not match` };
    const part = b64Decode(env.text);
    if (part === null) return { ok: false, why: `slice ${i} is not valid base64` };
    const plain = xorStream(part, env.nonce, env.slice);
    for (let k = 0; k < plain.length; k++) all.push(plain[k]);
  }
  if (all.length !== first.total.bytes) return { ok: false, why: 'the joined bytes do not match the total byte count' };
  const text = utf8Decode(all);
  if (utf8Length(text) !== first.total.bytes || sha256Hex(text) !== first.total.sha256) return { ok: false, why: 'the joined text does not match the total sha256' };
  return { ok: true, text };
}

// Digest FNV do comando ({argv} ou {bash}) que o capture executa.
function commandDigest(cmd) {
  return fnv1a(JSON.stringify(canon(cmd)));
}

// Confere a linha única do capture copiada por um agente; devolve data.
function checkCapture(stdout, { nonce, noncePrefix, cmdDigest } = {}) {
  const raw = String(stdout == null ? '' : stdout).replace(/\s+$/, '');
  if (utf8Length(raw) > MAX_COPY_BYTES) return { ok: false, why: 'the output is larger than the copy limit' };
  let o;
  try { o = JSON.parse(raw); } catch { return { ok: false, why: 'the output is not JSON' }; }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.tool !== 'capture') return { ok: false, why: 'the output is not from capture' };
  if (o.error !== undefined) return { ok: false, why: `capture refused: ${o.error}` };
  if (nonce !== undefined && o.nonce !== nonce) return { ok: false, why: 'the nonce of the output is not the one of this run' };
  if (noncePrefix !== undefined && !(typeof o.nonce === 'string' && o.nonce.startsWith(noncePrefix))) return { ok: false, why: 'the nonce of the output is outside the expected prefix' };
  if (cmdDigest !== undefined && o.cmdDigest !== cmdDigest) return { ok: false, why: 'the output is not from the expected command' };
  const { digest, ...rest } = o;
  if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, why: 'the digest of the output does not match: the copy is not literal' };
  return { ok: true, data: o.data };
}

// Checks the output of a signed progress.mjs call: tool, command, nonce and digest of the rest.
function checkSigned(out, nonce, command) {
  if (!out || typeof out !== 'object' || Array.isArray(out)) return { ok: false, error: 'signed output is not an object' }
  if (out.tool !== 'progress') return { ok: false, error: 'signed output has the wrong tool' }
  if (out.command !== command) return { ok: false, error: `signed output is not from the ${command} command` }
  if (out.nonce !== nonce) return { ok: false, error: 'signed output has the wrong nonce' }
  const { digest, ...rest } = out
  if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, error: 'signed output digest does not match' }
  return { ok: true, error: null }
}

// Output of a plugin script copied by an agent: tool, nonce and digest must match. release-discovery signs { nonce, data }; verify-run signs the whole output without its digest.
function checkRun(stdout, tool, nonce) {
  let o
  try { o = JSON.parse(String(stdout == null ? '' : stdout)) } catch { return { ok: false, why: 'the output is not JSON' } }
  if (!o || typeof o !== 'object' || o.tool !== tool) return { ok: false, why: `the output is not from ${tool}` }
  if (o.error !== undefined) return { ok: false, why: `${tool} refused: ${o.error}` }
  if (o.nonce !== nonce) return { ok: false, why: 'the nonce of the output is not the one of this run' }
  const { digest, ...rest } = o
  const disco = tool === 'release-discovery'
  if (digest !== fnv1a(JSON.stringify(canon(disco ? { nonce: o.nonce, data: o.data } : rest)))) return { ok: false, why: 'the digest of the output does not match: the copy is not literal' }
  return { ok: true, data: disco ? o.data : o }
}
// </embed>
// <embed src="../../../lib/external-auth.mjs" exports="strip">
// Gerado de ../../../lib/external-auth.mjs por plugins/productivity-tools/scripts/embed.mjs; não editar aqui.
// External-effect authorization. Items: "gate:<name>", "<E>:T<n>" and "<E>:AC<k>" (bare, bind on first use), "<E>:T<n>@<fp>", "<E>:AC<k>@<fp>", "checkout:<target>".
function parseAuthorizeExternal(v) {
  if (v == null || v === '') return { items: [], error: null }
  if (!Array.isArray(v)) return { items: [], error: 'authorizeExternal must be a list of items such as "gate:G3", "E18:T4", "E18:AC1" or "checkout:<target>"' }
  const re = /^(gate:\S+|[A-Za-z][A-Za-z0-9-]*:(T|AC)[1-9]\d*(@[0-9a-f]{8})?|checkout:\S+)$/
  const bad = v.findIndex(i => typeof i !== 'string' || !re.test(i))
  if (bad !== -1) return { items: [], error: `authorizeExternal item not recognized: ${JSON.stringify(v[bad])}` }
  return { items: [...new Set(v)], error: null }
}
function isAuthorized(items, item) { return (items || []).includes(item) }
// The item to ask for when an external task is not authorized yet (null when it may run). A missing flag counts as external.
function externalHold(task, E, items, fp) {
  if (task.external === false) return null
  const bare = `${E}:T${task.n}`
  const bound = `${bare}@${fp}`
  return isAuthorized(items, bare) || isAuthorized(items, bound) ? null : bound
}
function bindAuthorizations(items, E, fp) {
  const re = /^[^:]+:(T|AC)[1-9]\d*$/
  return (items || []).map(i => (i.startsWith(E + ':') && re.test(i) && i.indexOf('@') < 0 ? `${i}@${fp}` : i))
}
// </embed>

// gate and baseline: { exit, failedNames }. Passes on exit 0; on a failure only when every failed name
// is already red in a red baseline. A failure without recognizable names never passes.
function waveGatePasses(gate, baseline) {
  if (!gate || !Number.isInteger(gate.exit)) return false
  if (gate.exit === 0) return true
  const names = Array.isArray(gate.failedNames) ? gate.failedNames : []
  if (names.length === 0) return false
  if (!baseline || baseline.exit === 0 || !Array.isArray(baseline.failedNames)) return false
  return names.every((n) => baseline.failedNames.includes(n))
}

// Validates the launch args. Returns { error, authorizeExternal }.
function validateArgs(args) {
  const fail = (error) => ({ error, authorizeExternal: [] })
  if (!args || typeof args !== 'object' || Array.isArray(args)) return fail('args must be an object with plan, state and runToken')
  for (const k of ['plan', 'state', 'runToken']) {
    if (typeof args[k] !== 'string' || args[k].trim() === '') return fail(`args.${k} must be a non-empty string`)
  }
  const auth = parseAuthorizeExternal(args.authorizeExternal)
  if (auth.error) return fail(auth.error)
  for (const item of auth.items) {
    if (/^plan:T[1-9]\d*@[0-9a-f]{8}$/.test(item)) continue
    const bare = /^plan:T([1-9]\d*)$/.exec(item)
    if (bare) return fail(`authorizeExternal item "${item}" needs the plan digest: use "plan:T${bare[1]}@<8 hex>"`)
    return fail(`authorizeExternal item "${item}" is not allowed: only "plan:T<n>@<8 hex>"`)
  }
  if (args.answers !== undefined && args.answers !== null) {
    if (!Array.isArray(args.answers)) return fail('args.answers must be a list')
    const allowed = ['answer', 'unblock', 'release', 'hold', 'refuse']
    for (const a of args.answers) {
      if (!a || typeof a !== 'object' || !allowed.includes(answerKind(a))) return fail(`args.answers accepts only ${allowed.join(', ')}`)
    }
  }
  if (args.test !== undefined && args.test !== null && typeof args.test !== 'string') return fail('args.test must be a string')
  return { error: null, authorizeExternal: auth.items }
}

// An answer names its event with `event` (the documented key) or `type`.
function answerKind(a) { return a.event !== undefined ? a.event : a.type }
function normalizeAnswer(a) { const { event, ...rest } = a; return event !== undefined ? { ...rest, type: event } : rest }

function slash(p) { return String(p).replace(/\\/g, '/') }

// One word for a POSIX shell.
function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'" }

// The JSON of a signed or script output; tolerates text around the object. null when there is none.
function parseJson(text) {
  const t = String(text == null ? '' : text).trim()
  try { return JSON.parse(t) } catch (e) { /* look for the object inside the text */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a === -1 || b <= a) return null
  try { return JSON.parse(t.slice(a, b + 1)) } catch (e) { return null }
}

function tailOf(text, n = 1500) {
  const t = String(text == null ? '' : text)
  return t.length > n ? t.slice(t.length - n) : t
}

const GATE_Q_CAP = 600
const NAMES_CAP = 50
const CMD_CAP = 6000

// At most NAMES_CAP names; cut counts the rest. The "+N" marker is never part of a name.
function capNames(list) {
  const all = Array.isArray(list) ? list : []
  return { names: all.slice(0, NAMES_CAP), cut: Math.max(0, all.length - NAMES_CAP) }
}

function gateQuestion(wave, exit, failedNames) {
  const { names, cut } = capNames(failedNames)
  const more = cut > 0 ? ` +${cut}` : ''
  const head = `the gate of wave ${wave} failed (exit ${exit}`
  const tail = '); the person decides'
  const list = names.length ? `, failing: ${names.join('; ')}` : ', no failing test name recognized'
  const full = head + list + more + tail
  if (full.length <= GATE_Q_CAP) return full
  const keep = GATE_Q_CAP - (head.length + more.length + tail.length + 3)
  return head + list.slice(0, Math.max(0, keep)) + '...' + more + tail
}

function waveGateOf(cap) {
  if (!cap || !Number.isInteger(cap.exit)) return { exit: -1, failedNames: [] }
  const ex = cap.extract
  const ok = ex && Array.isArray(ex.failedNames) && !(ex.failedNamesCut > 0)
  return { exit: cap.exit, failedNames: ok ? ex.failedNames : [] }
}

// The baseline event of a test run: tail of the capture, failed names capped, the excess of names counted.
function baselineEvent(test, cap) {
  const ex = cap.extract || {}
  const { names, cut } = capNames(ex.failedNames)
  const all = cut + (Number.isInteger(ex.failedNamesCut) ? ex.failedNamesCut : 0)
  const ev = { type: 'baseline', test, exit: cap.exit, tail: cap.tail, failedNames: names }
  if (all > 0) ev.failedNamesCut = all
  return ev
}

// Why a baseline run cannot be trusted (exit not 0, 0 tests run, 0 passed), or null.
function baselineProblem(cap) {
  if (cap.exit !== 0) return `the baseline test run exited ${cap.exit}`
  const ex = cap.extract || {}
  if (ex.total === 0) return 'the baseline test run executed 0 tests'
  if (ex.pass === 0) return 'the baseline test run passed 0 tests'
  return null
}

// A command above CMD_CAP is not dispatched.
function cmdOverCap(cmd) {
  const size = String(cmd).length
  return size > CMD_CAP ? { refuse: true, size } : { refuse: false }
}

// What progress.mjs read, apply --events and the local copy compare: the state without its history.
function stateDigest(state) { return fnv1a(JSON.stringify(canon({ ...state, history: [] }))) }

function samePlan(statePath, planArg) {
  const a = slash(statePath).replace(/^\.\//, '')
  const b = slash(planArg)
  return a !== '' && (b === a || b.endsWith('/' + a))
}

// The --events argument of progress.mjs apply: encodeURIComponent of { expect, events, digest }.
function eventsPayload(expect, events) {
  const rest = { expect, events }
  return encodeURIComponent(JSON.stringify({ ...rest, digest: fnv1a(JSON.stringify(canon(rest))) })).replace(/'/g, '%27')
}

// The briefs sit in the folder of the plan; the state keeps the plan path relative to the git root.
function briefPath(root, planPath, brief) {
  return slash(root).replace(/\/+$/, '') + '/' + slash(planPath).replace(/[^/]*$/, '') + brief
}

function commitSubject(planId, step) { return `${planId} T${step.n}: ${step.title}` }

// git log --grep reads a basic regular expression: the characters that mean something in it are escaped.
function commitGrep(planId, n) { return '^' + `${planId} T${n}:`.replace(/[.*[\\^$]/g, '\\$&') }

// The SHA in the first line "<sha> <subject>" of git log, only when the subject is the one of the step.
function parseLogLine(stdout, planId, n) {
  const line = String(stdout == null ? '' : stdout).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || ''
  const m = /^([0-9a-f]{40,64}) (.*)$/.exec(line)
  return m && m[2].startsWith(`${planId} T${n}:`) ? m[1] : null
}

function stepsToCommit(state, again) {
  return state.steps.filter((s) => s.status === 'pass' && s.noCommit !== true && (!s.sha || again.has(s.n))).sort((a, b) => a.n - b.n)
}

function reportEvent(n, out, at) {
  if (!out || typeof out !== 'object' || typeof out.status !== 'string') return { type: 'no-report', step: n, at }
  const summary = String(out.summary || '').trim()
  if (out.status === 'DONE' || out.status === 'DONE_WITH_CONCERNS') {
    return { type: 'report', step: n, value: 'pass', text: summary.slice(0, 400), handoff: summary.split(/\r?\n/).filter(Boolean).slice(0, 5).join(' ').slice(0, 500), at }
  }
  const asks = (Array.isArray(out.humanInputs) ? out.humanInputs : []).map((h) => h && h.what).filter(Boolean)
  return { type: 'report', step: n, value: 'blocked', text: [`${out.status}: ${summary}`, String(out.concerns || ''), ...asks].filter(Boolean).join(' | ').slice(0, 600), at }
}

function issuesText(issues) {
  return issues.map((i) => `${i.id ? i.id + ' ' : ''}[${i.severity}${i.category ? '/' + i.category : ''}]${i.file ? ' ' + i.file : ''} ${i.description}`).join('\n')
}

function blockingIssues(review) {
  const out = []
  for (const i of (review && Array.isArray(review.issues)) ? review.issues : []) {
    if (!i || i.severity === 'minor' || ['fora-do-escopo', 'pelo-plano', 'ambiente'].includes(i.category)) continue
    out.push(i)
  }
  return out
}

// pass, defects with the text for the fix round, or lost when the reviewer returned nothing.
function reviewVerdict(out) {
  if (!out || typeof out !== 'object') return { verdict: 'lost', text: '' }
  const blocking = blockingIssues(out)
  if (blocking.length === 0 && out.spec !== 'fail' && out.quality !== 'fail') return { verdict: 'pass', text: '' }
  return { verdict: 'defects', text: blocking.length ? issuesText(blocking) : 'the review marked spec or quality as fail without a finding' }
}

function owningStep(state, issues) {
  const hits = []
  for (const i of issues) {
    if (!i.file) continue
    const f = slash(i.file)
    for (const s of state.steps) if ((s.files || []).some((x) => f === x || f.endsWith('/' + x))) hits.push(s.n)
  }
  return hits.length ? Math.min(...hits) : null
}
// </pure>

const checkedArgs = validateArgs(args)
if (checkedArgs.error) return { status: 'error', error: checkedArgs.error }
if (typeof args.progress !== 'string' || args.progress.trim() === '') {
  return { status: 'error', error: 'args.progress must be the absolute path of scripts/progress.mjs of the plan-coordinator skill (the skill passes <dir>/scripts/progress.mjs)' }
}

const A = args
const PROGRESS = slash(A.progress)
const STATE_FILE = slash(A.state)
const CAPTURE = PROGRESS.replace(/\/skills\/plan-coordinator\/scripts\/progress\.mjs$/, '/scripts/capture.mjs')
const RUN_TAG = fnv1a(A.runToken)
const REVIEW_PKG = PROGRESS.replace(/\/skills\/plan-coordinator\/scripts\/progress\.mjs$/, '/scripts/review-package.mjs')

// ---------------------------------------------------------------- schemas (the same as the release workflow)
const STR = { type: 'string' }, INT = { type: 'integer' }, BOOL = { type: 'boolean' }
const HUMAN = { type: 'array', items: { type: 'object', properties: { blq: STR, what: STR, workaround: STR, blocking: BOOL }, required: ['what'] } }
const ISSUES = { type: 'array', items: { type: 'object', properties: {
  severity: { type: 'string', enum: ['critical', 'important', 'minor'] },
  category: { type: 'string', enum: ['defeito', 'decisao', 'ambiente', 'fora-do-escopo', 'pelo-plano'] },
  description: STR, file: STR, blq: STR, id: STR }, required: ['severity', 'description'] } }
const S_REVIEW = { type: 'object', properties: { issues: ISSUES, summary: STR, headSha: STR, clean: BOOL, commitsInRange: INT }, required: ['issues', 'headSha', 'clean', 'commitsInRange'] }
const PF = { type: 'string', enum: ['pass', 'fail'] }
const S_TASKREVIEW = { ...S_REVIEW, properties: { ...S_REVIEW.properties, verdicts: { type: 'array', items: { type: 'object', properties: { id: STR, open: BOOL }, required: ['id', 'open'] } }, spec: PF, quality: PF } }
const S_CHECKS = { type: 'array', items: { type: 'object', properties: { command: STR, output: STR, exit: INT }, required: ['command', 'output', 'exit'] } }
const S_IMPL = { type: 'object', properties: { status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_HUMAN'] }, summary: STR, concerns: STR, humanInputs: HUMAN, needsLock: STR, checks: S_CHECKS }, required: ['status', 'summary', 'checks'] }
const S_RUN = { type: 'object', properties: { exit: INT, stdout: STR }, required: ['exit', 'stdout'] }

// ---------------------------------------------------------------- script-runner calls
const BASH_ONLY = 'SHELL: run each command exactly as written, one per call, in the Bash tool (Git Bash on Windows), never in the PowerShell tool or in cmd, without rewriting quotes or escapes. Without the Bash tool, run nothing and return exit=-1 with an empty stdout.'
// The prompt of a script-runner call: one command, run once, its exit and stdout back literal.
const runPrompt = (cmd, writes, json) => `Run this command once and return its exit code and ${json ? `the one JSON line it prints, literal (a line above ${MAX_COPY_BYTES} bytes is an error of the command: return it as it is)` : 'its full stdout, literal'}${writes ? '' : ' (change no file)'}:\n${cmd}\n${BASH_ONLY}`
// An output an agent copied must fit the copy limit, or it was cut.
const copyFits = (stdout) => utf8Length(String(stdout == null ? '' : stdout).replace(/\s+$/, '')) <= MAX_COPY_BYTES
let seq = 0
const nonceOf = () => `${RUN_TAG}-${++seq}`
const sliceNonce = () => `${RUN_TAG}-${String(++seq).padStart(Math.max(1, A.runToken.length - 9), '0')}`
const runCmd = (cmd, label, o = {}) => {
  const over = cmdOverCap(cmd)
  if (over.refuse) return Promise.resolve({ exit: -1, stdout: `command of ${over.size} characters, above the limit of ${CMD_CAP}: not dispatched` })
  return agent(runPrompt(cmd, o.writes, o.json),
    { agentType: 'productivity-tools:script-runner', label, phase: o.phase, schema: S_RUN, model: o.model || 'haiku', effort: o.effort || 'low' })
}

// ---------------------------------------------------------------- returns
const resumeArgs = () => {
  // What only the person gives (authorizations, answers) and the run token never come back.
  const { runToken, authorizeExternal, answers, ...rest } = A
  return rest
}
const stopWith = (kind, extra) => ({ status: 'stopped', stop: { kind, ...extra }, resumeArgs: resumeArgs() })
const failWith = (error, extra) => ({ status: 'error', error, ...extra })

// ---------------------------------------------------------------- the signed state
let S = null // the state with every queued event applied
let DISK = null // the state as the last signed read or write left it on disk
let NOW = null // the instant of the last signed output: the `at` of every event
let ROOT = null
const queued = []
let swept = false
const again = new Set() // steps that passed again after a fix and were committed before
const carry = new Map() // findings of the final review to hand to the next run of a step
const reports = new Map() // last return of each step's implementer
const lost = new Map() // reviews that returned nothing, by step
let MAP = null

const stepOf = (n) => S.steps.find((x) => x.n === n)
const stateRefused = (ev, r) => Object.assign(new Error(`the progress state refused ${ev.type}: ${r.code}${r.message ? ` (${r.message})` : ''}`), { refused: true })
// Applies one event to the local state and keeps it for the next write.
const queue = (ev) => {
  const e = { ...ev, at: NOW }
  const r = applyEvents(S, [e], NOW)
  if (!r.ok) throw stateRefused(e, r)
  S = r.state
  queued.push(e)
}

const readSigned = async (label, first) => {
  let why = ''
  for (let round = 0; round < 2; round++) {
    const envs = []
    for (let k = 0; k === 0 || k < envs[0].slices; k++) {
      let env = null
      for (let t = 1; t <= 3 && !env; t++) {
        const nonce = first && k === 0 ? A.runToken : sliceNonce()
        const out = await runCmd(`node ${shq(PROGRESS)} read ${shq(STATE_FILE)} --nonce ${shq(nonce)} --slice ${k} --json`,
          `${label}-slice${k}${t > 1 ? `-retry${t}` : ''}`, { phase: 'Read', json: true, model: t < 3 ? 'haiku' : 'sonnet', effort: t < 3 ? 'low' : 'medium' })
        if (!copyFits(out && out.stdout)) { why = 'the output of the read is larger than the copy limit'; continue }
        const data = parseJson(out.stdout)
        const v = checkSlice(data, { tool: 'progress', command: 'read', nonce, slice: k })
        if (!v.ok) { why = v.why; continue }
        if (k === 0 && !(Number.isInteger(data.slices) && data.slices >= 1 && data.slices <= 200)) { why = 'the first slice has no valid slice count'; continue }
        env = data
      }
      if (!env) return { why }
      envs.push(env)
    }
    const j = joinSlices(envs)
    if (!j.ok) { why = j.why; continue }
    const p = parseJson(j.text)
    if (!p || !p.state || p.state.schema !== 'progress/1' || !Array.isArray(p.state.steps) || typeof p.root !== 'string') { why = 'the signed read has no valid progress/1 state'; continue }
    if (stateDigest(p.state) !== p.stateDigest) { why = 'the state of the signed read does not match the digest it signs'; continue }
    return { data: { root: p.root, planChanged: p.planChanged, stateDigest: p.stateDigest, state: p.state, now: envs[envs.length - 1].now } }
  }
  return { why }
}

const divergence = (message) => stopWith('state-divergence', { message })

const applyCmd = (expect, events, nonce) => `node ${shq(PROGRESS)} apply ${shq(STATE_FILE)} --events ${shq(eventsPayload(expect, events))} --nonce ${shq(nonce)} --json`

// One signed apply of consecutive events; a chunk is resent only if the state still has its starting digest.
const flushChunk = async (why, events) => {
  const expect = stateDigest(DISK)
  const after = applyEvents(DISK, events, NOW)
  if (!after.ok) return failWith(`the local state refused the queued events: ${after.code} at event ${after.index}`)
  const want = stateDigest(after.state)
  const written = (now) => { DISK = after.state; queued.splice(0, events.length); if (now) NOW = now; return null }
  for (let attempt = 1; attempt <= 2; attempt++) {
    const nonce = nonceOf()
    const out = await runCmd(applyCmd(expect, events, nonce),
      `apply:${why}${attempt > 1 ? '-retry' : ''}`, { phase: 'Read', writes: true, json: true })
    const data = copyFits(out && out.stdout) ? parseJson(out.stdout) : null
    if (checkSigned(data, nonce, 'apply').ok) {
      if (data.ok !== true) {
        if (data.code === 'concurrent-change') return divergence('progress.json changed while the run was writing (concurrent-change); this chunk was not written')
        return failWith(`progress.mjs refused the events: ${data.code}${Number.isInteger(data.index) ? ` at event ${data.index} (${events[data.index] && events[data.index].type})` : ''}`)
      }
      if (data.stateDigest !== want) return divergence('the state written by progress.mjs differs from the state this run computed')
      return written(data.now)
    }
    const rd = await readSigned(`reread:${why}`, false)
    if (!rd.data) return failWith(`the output of apply did not check and the state could not be read again: ${rd.why}`)
    const got = stateDigest(rd.data.state)
    if (got === want) return written(rd.data.now)
    if (got !== expect || attempt === 2) return divergence('the state on disk is neither the one before nor the one after this write')
    NOW = rd.data.now
  }
  return failWith('the events could not be written')
}

const flush = async (why) => {
  if (queued.length === 0) return null
  const events = queued.slice()
  const sizing = 'x'.repeat(24)
  const chunks = []
  for (const ev of events) {
    const k = chunks.length - 1
    if (k >= 0 && applyCmd(stateDigest(DISK), [...chunks[k], ev], sizing).length <= CMD_CAP) chunks[k].push(ev)
    else chunks.push([ev])
  }
  const big = chunks.map((c) => applyCmd(stateDigest(DISK), c, sizing).length).find((n) => n > CMD_CAP)
  if (big) return failWith(`a single event makes an apply command of ${big} characters, above the limit of ${CMD_CAP}: not dispatched`)
  for (let k = 0; k < chunks.length; k++) {
    const r = await flushChunk(chunks.length > 1 ? `${why}-${k + 1}of${chunks.length}` : why, chunks[k])
    if (r) return r
  }
  return null
}
// Writes what is queued, then returns the result, unless the write itself fails.
const finish = async (result) => (await flush('return')) || result

// ---------------------------------------------------------------- prompts
const RULES = [
  '- Only modify the files of this step. Other agents are editing other files in parallel right now.',
  '- Do not add or remove dependencies, run code generators, update snapshots or run full builds unless the brief says so: report BLOCKED instead.',
  '- Run targeted checks only; the orchestrator runs the full suite.',
  '- Do not spawn subagents.',
  '- Never commit. The orchestrator commits.',
  "- Never push, deploy or cause any other external effect (production, e-mail or messages, shared data, someone's checkout) unless the brief marks the step external and this prompt says it is authorized; then do it exactly as written, once.",
  '- Never ask the person anything: if a decision is missing, stop and report BLOCKED with the question.',
].join('\n')
const filesOf = (s) => (Array.isArray(s.files) ? s.files : [])
const briefOf = (s) => briefPath(ROOT, S.plan.path, s.brief)
const implPrompt = (s, defects) => {
  const handoffs = s.deps.map(stepOf).filter((d) => d && d.handoff).map((d) => `HANDOFF T${d.n}: ${d.handoff}`)
  const prev = !defects && s.attempts > 1 && s.note ? `The previous attempt of this step reported: ${s.note}` : ''
  return [
    defects
      ? `Fix mode. Step T${s.n} of plan ${S.plan.id}: ${s.title}. A review found these problems; fix each one and change nothing else:\n${defects}`
      : `Implement step T${s.n} of plan ${S.plan.id}: ${s.title}.`,
    `Repository: ${ROOT}. Read the brief of the step first: ${briefOf(s)} (plan constraints, files, checks and the interfaces this step consumes). Never read the plan file.`,
    `Files of this step: ${filesOf(s).length ? filesOf(s).join(', ') : 'none (this step writes no file)'}.`,
    handoffs.length ? handoffs.join('\n') : 'HANDOFF: none (no dependency of this step left a handoff).',
    `CAPTURE: node "${CAPTURE}" run --nonce ${RUN_TAG}:${S.plan.id}:T${s.n}:<k> --task ${S.plan.id}-T${s.n} -- <command>`,
    s.external ? `This step is external and the owner authorized it (plan:T${s.n}@${S.plan.digest}): perform the external effect exactly as the brief says, once, and report what happened.` : '',
    prev,
    'Rules:',
    RULES,
    'Return status (DONE, DONE_WITH_CONCERNS, BLOCKED or NEEDS_HUMAN), summary (up to 5 lines: what now exists and how downstream steps use it), concerns, humanInputs and checks (the exact command, the real output and the exit code of every verification you ran).',
  ].filter(Boolean).join('\n')
}
const reviewPrompt = (s, rep) => {
  const paths = filesOf(s).map(shq).join(' ')
  const checks = rep && Array.isArray(rep.checks) && rep.checks.length
    ? rep.checks.map((c) => `$ ${c.command}\nexit ${c.exit}\n${tailOf(c.output, 600)}`).join('\n')
    : '(no checks reported)'
  return [
    'Mode: review',
    `Review step T${s.n} of plan ${S.plan.id}: ${s.title}, in ${ROOT}. Read-only: never edit, stage or commit.`,
    `Brief of the step (what it must do): ${briefOf(s)}.`,
    `Range: the step is not committed yet. Run git -C ${shq(ROOT)} status --porcelain -- ${paths} and git -C ${shq(ROOT)} diff HEAD -- ${paths}, then read each file of the step.`,
    `Summary: ${!rep ? 'resumed from a previous run: the implementer report of this step was lost with that run; run the step verification commands from the plan yourself' : rep.summary ? rep.summary : '(no summary)'}`,
    checks,
    'Measure: headSha = git rev-parse HEAD; clean = git status --porcelain empty (false is expected while the step is uncommitted); commitsInRange = 0.',
  ].join('\n')
}
const preLaunchPrompt = (s) => [
  'Mode: review',
  `Pre-launch review of external step T${s.n} of plan ${S.plan.id}: ${s.title}, in ${ROOT}. Read-only: never edit, stage, commit or run the step.`,
  `Brief of the step: ${briefOf(s)}. Read it and check that it names the exact external effect and its target, says how a repeat is avoided (externalDedupe), lists the checks that prove the result and needs nothing that is not written there. Never read the plan file.`,
  `Files of the step: ${filesOf(s).length ? filesOf(s).join(', ') : 'none'}.`,
  `Measure: headSha = git -C ${shq(ROOT)} rev-parse HEAD; clean = git status --porcelain empty; commitsInRange = 0. Set spec to fail when the brief cannot be executed once, as written, without asking anyone.`,
].join('\n')
const finalPrompt = () => {
  const base = S.run.base || 'HEAD'
  const steps = S.steps.map((s) => `- T${s.n} ${s.title} [${s.status}]${s.noCommit ? ' (no commit)' : ''}: ${filesOf(s).join(', ') || 'no files'}`).join('\n')
  const bl = S.run.baseline
  const evDir = `$(git -C ${shq(ROOT)} rev-parse --absolute-git-dir)/pt-evidence/review`
  return [
    'Mode: review, lens: all',
    `Final review of the whole change of plan ${S.plan.id} (${ROOT}/${S.plan.path}), read-only, in ${ROOT}.`,
    `Diff: node "${REVIEW_PKG}" ${shq(ROOT)} ${base} HEAD "${evDir}/${S.plan.id}-final.txt" (read that file instead of git diff)${S.run.commits === 'none' ? `, then git -C ${shq(ROOT)} diff HEAD > "${evDir}/${S.plan.id}-worktree.diff" and read it` : ''}, and git -C ${shq(ROOT)} ls-files --others --exclude-standard (the steps are committed one by one: git -C ${shq(ROOT)} log -p ${base}..HEAD shows them).`,
    `Steps:\n${steps}`,
    bl ? `Baseline of the tests: exit ${bl.exit}${bl.failedNames && bl.failedNames.length ? `, already failing: ${bl.failedNames.join('; ')}` : ''}.` : 'Baseline of the tests: none recorded.',
    'Look for broken contracts between steps, regressions outside the changed files and acceptance criteria with no test. Give each finding its file.',
    `Measure: headSha = git rev-parse HEAD; clean = git status --porcelain empty; commitsInRange = git -C ${shq(ROOT)} rev-list --count ${base}..HEAD.`,
  ].join('\n')
}

// ---------------------------------------------------------------- the pieces of the loop
const implStep = async (s, defects) => {
  const out = await agent(implPrompt(s, defects),
    { agentType: 'productivity-tools:implementer', label: `T${s.n}:${defects ? `fix${s.rounds}` : `impl${s.attempts}`}`, phase: 'Wave', schema: S_IMPL, model: s.tier, effort: s.effort })
  reports.set(s.n, out)
  return { n: s.n, out }
}
const takeCarry = (n) => { const t = carry.get(n); carry.delete(n); return t || null }
// Every return becomes a report event; a step with no return in 3 attempts is held for the person.
const recordReports = (results) => {
  for (const r of results.slice().sort((a, b) => a.n - b.n)) {
    const ev = reportEvent(r.n, r.out, NOW)
    queue(ev)
    const s = stepOf(r.n)
    if (ev.type === 'report' && ev.value === 'pass' && s.sha) again.add(r.n)
    if (ev.type === 'no-report' && s.status === 'pending' && s.attempts >= 3) queue({ type: 'hold', step: r.n, text: `step T${r.n} returned no report in ${s.attempts} attempts` })
  }
}
const testCmd = () => S.run.test || A.test || 'none'
const runCapture = async ({ argv, bash, task, label, phase, tests, cwd }) => {
  const digest = commandDigest(bash !== undefined ? { bash } : { argv })
  for (let t = 1; t <= 2; t++) {
    const nonce = nonceOf()
    const cmd = `node ${shq(CAPTURE)} run --nonce ${shq(nonce)} --task ${shq(task)}${tests ? ' --tests' : ''} --cwd ${shq(cwd)} ${bash !== undefined ? `--bash ${shq(bash)}` : `-- ${argv.map(shq).join(' ')}`}`
    const out = await runCmd(cmd, `${label}${t > 1 ? '-retry' : ''}`, { phase, json: true, writes: true, model: t > 1 ? 'sonnet' : 'haiku', effort: t > 1 ? 'medium' : 'low' })
    if (copyFits(out && out.stdout) && checkCapture(out.stdout, { nonce, cmdDigest: digest }).ok) return parseJson(out.stdout)
  }
  return null
}
const runTest = (label) => runCapture({ bash: testCmd(), task: `${S.plan.id}-gate`, label, phase: 'Gate', tests: true, cwd: ROOT })

const ensureBaseline = async () => {
  if (S.run.baseline !== null && S.run.baseline !== undefined) return null
  const test = testCmd()
  if (test === 'none') {
    queue({ type: 'baseline', test: 'none', exit: 0, tail: null, failedNames: [] })
    return null
  }
  const out = await runTest('baseline')
  if (!out) return failWith('the baseline test run returned nothing')
  queue(baselineEvent(test, out))
  const why = baselineProblem(out)
  if (why === null) return null
  const tail = '); fix the command and recreate the state with progress.mjs init <plan> --restart (nothing has launched yet), or answer unblock to accept this baseline'
  const room = GATE_Q_CAP - (why.length + ' (command: '.length + tail.length)
  const cmd = String(test)
  const question = `${why} (command: ${cmd.length > room ? cmd.slice(0, Math.max(0, room - 3)) + '...' : cmd}${tail}`
  queue({ type: 'block', text: question })
  return stopWith('ask', { question, excerpt: out.tail })
}

// Once per run, before any launch: a committed step whose files changed after a fix goes back to the list.
const sweepCommitted = async () => {
  if (S.run.commits !== 'per-step' || swept) return
  swept = true
  const open = new Set(S.steps.filter((x) => x.status !== 'pass').flatMap(filesOf))
  for (const s of S.steps) {
    if (s.status !== 'pass' || s.noCommit === true || !s.sha || filesOf(s).length === 0) continue
    if (filesOf(s).some((f) => open.has(f))) continue
    const d = await runCmd(`git -C ${shq(ROOT)} status --porcelain -- ${filesOf(s).map(shq).join(' ')}`, `T${s.n}:git-status`, { phase: 'Commit' })
    if (d && d.exit === 0 && String(d.stdout || '').trim() !== '') again.add(s.n)
  }
}

const commitSteps = async () => {
  if (S.run.commits !== 'per-step') return { did: false }
  const todo = stepsToCommit(S, again)
  if (todo.length === 0) return { did: false }
  phase('Commit')
  const bare = todo.find((s) => filesOf(s).length === 0)
  if (bare) return { result: failWith(`step T${bare.n} passed but the state has no files to commit for it (a state made before E12?): run progress.mjs init --restart to rebuild the state; nothing was committed`, { step: bare.n }) }
  for (const s of todo) {
    const paths = filesOf(s).map(shq).join(' ')
    const g = `git -C ${shq(ROOT)}`
    const dirty = await runCmd(`${g} status --porcelain -- ${paths}`, `T${s.n}:git-status`, { phase: 'Commit' })
    if (!dirty || dirty.exit !== 0) return { result: failWith(`git status failed for step T${s.n}: ${tailOf(dirty && dirty.stdout, 400)}`, { step: s.n }) }
    const clean = String(dirty.stdout || '').trim() === ''
    if (!clean) {
      const add = await runCmd(`${g} add -- ${paths}`, `T${s.n}:git-add`, { phase: 'Commit', writes: true })
      if (!add || add.exit !== 0) return { result: failWith(`git add failed for step T${s.n}: ${tailOf(add && add.stdout, 400)}`, { step: s.n }) }
      const com = await runCmd(`${g} commit -m ${shq(commitSubject(S.plan.id, s))} -- ${paths}`, `T${s.n}:git-commit`, { phase: 'Commit', writes: true })
      if (!com || com.exit !== 0) return { result: failWith(`git commit failed for step T${s.n}: ${tailOf(com && com.stdout, 400)}`, { step: s.n }) }
    }
    const log = await runCmd(`${g} log -1 --format=${shq('%H %s')} --grep ${shq(commitGrep(S.plan.id, s.n))}`, `T${s.n}:git-log`, { phase: 'Commit' })
    let sha = parseLogLine(log && log.stdout, S.plan.id, s.n)
    if (!sha && clean) { // the files matched an earlier commit: the step records the current head
      const head = await runCmd(`${g} rev-parse HEAD`, `T${s.n}:git-head`, { phase: 'Commit' })
      const h = String(head && head.stdout || '').trim()
      if (head && head.exit === 0 && /^[0-9a-f]{40,64}$/.test(h)) sha = h
    }
    if (!sha) return { result: failWith(`the commit of step T${s.n} was not found by its subject "${S.plan.id} T${s.n}:"`, { step: s.n }) }
    queue({ type: 'commit', step: s.n, sha })
    again.delete(s.n)
    const w = await flush(`commit-T${s.n}`)
    if (w) return { result: w }
  }
  return { did: true }
}

const summaryOf = () => ({
  run: S.run.status,
  wave: S.run.wave,
  map: MAP,
  steps: S.steps.map((s) => ({ n: s.n, title: s.title, status: s.status, attempts: s.attempts, sha: s.sha })),
  finalGate: S.finalGate,
  open: S.manual.filter((m) => m.open),
})

// ---------------------------------------------------------------- run
phase('Read')
const first = await readSigned('read', true)
if (!first.data) return failWith(`the progress state could not be read: ${first.why}`)
S = DISK = first.data.state
NOW = first.data.now
ROOT = slash(first.data.root)
if (!samePlan(S.plan.path, A.plan)) return failWith(`the state belongs to another plan: it records ${S.plan.path} and the launch names ${A.plan}`)
if (first.data.planChanged === true) return stopWith('plan-changed', { message: 'the plan changed after progress.mjs init; the state is kept as it is. Recreate it with init --restart only if the person asks' })

try {
  for (const s of S.steps.filter((x) => x.status === 'launched').sort((a, b) => a.n - b.n)) {
    queue({ type: 'no-report', step: s.n, text: 'the run that launched this step ended without its report' })
  }
  for (const a of Array.isArray(A.answers) ? A.answers : []) queue(normalizeAnswer(a))
  const resumed = await flush('resume')
  if (resumed) return resumed
  await sweepCommitted()

  for (let turn = 0; turn < 500; turn++) {
    const act = nextAction(S)
    // Every other action means the wave is settled: its passed steps are committed first.
    if (!['launch', 'review', 'await', 'approve-map'].includes(act.action)) {
      const c = await commitSteps()
      if (c.result) return await finish(c.result)
      if (c.did) continue
    }
    switch (act.action) {
      case 'approve-map':
        queue({ type: 'approve-map' })
        MAP = S.waves.map((w) => ({ wave: w.n, steps: w.tasks }))
        break
      case 'launch': {
        const bad = await ensureBaseline()
        if (bad) return await finish(bad)
        queue({ type: 'launch', steps: act.steps.map((x) => x.n) })
        const w = await flush('launch')
        if (w) return w
        phase('Wave')
        const results = await parallel(act.steps.map((x) => () => implStep(stepOf(x.n), takeCarry(x.n))))
        recordReports(results)
        const w2 = await flush('reports')
        if (w2) return w2
        break
      }
      case 'await': // steps launched by a run that died: no report came, the state decides what happens to each
        for (const n of act.steps) queue({ type: 'no-report', step: n, text: 'the run that launched this step ended without its report' })
        break
      case 'review': {
        phase('Review')
        const s = stepOf(act.step)
        const out = await agent(reviewPrompt(s, reports.get(s.n)),
          { agentType: 'productivity-tools:task-reviewer', label: `T${s.n}:review${s.rounds + 1}`, phase: 'Review', schema: S_TASKREVIEW, model: 'opus', effort: 'medium' })
        const v = reviewVerdict(out)
        if (v.verdict === 'lost') {
          lost.set(s.n, (lost.get(s.n) || 0) + 1)
          queue({ type: 'review-result', step: s.n, value: 'lost' })
          if (lost.get(s.n) >= 3) {
            const question = `the reviewer of step T${s.n} returned nothing 3 times`
            queue({ type: 'block', text: question })
            return await finish(stopWith('ask', { question }))
          }
          break
        }
        if (v.verdict === 'pass') {
          queue({ type: 'review-result', step: s.n, value: 'pass' })
          break
        }
        queue({ type: 'review-result', step: s.n, value: 'defects', text: v.text.slice(0, 600) })
        if (stepOf(s.n).status === 'launched') { // a fix round of the same step
          const w = await flush('review')
          if (w) return w
          phase('Wave')
          recordReports([await implStep(stepOf(s.n), v.text)])
          const w2 = await flush('fix')
          if (w2) return w2
        }
        break
      }
      case 'wave-gate': {
        phase('Gate')
        let gate = { exit: 0, failedNames: [] }
        let excerpt = ''
        if (testCmd() !== 'none') {
          const out = await runTest(`wave-gate-${act.wave}`)
          gate = waveGateOf(out)
          excerpt = out ? out.tail : ''
        }
        if (waveGatePasses(gate, S.run.baseline)) {
          queue({ type: 'wave-gate', value: 'pass' })
          break
        }
        const question = gateQuestion(act.wave, gate.exit, gate.failedNames)
        queue({ type: 'wave-gate', value: 'fail', text: question })
        queue({ type: 'block', text: question })
        return await finish(stopWith('ask', { question, excerpt }))
      }
      case 'advance':
        queue({ type: 'advance' })
        break
      case 'final-gate': {
        phase('Gate')
        let out = null
        for (let k = 1; k <= 2 && !out; k++) {
          out = await agent(finalPrompt(), { agentType: 'productivity-tools:final-reviewer', label: `final-review${k > 1 ? '-retry' : ''}`, phase: 'Gate', schema: S_REVIEW, model: 'opus', effort: 'high' })
        }
        if (!out) {
          const question = 'the final reviewer returned nothing twice'
          queue({ type: 'block', text: question })
          return await finish(stopWith('ask', { question }))
        }
        const blocking = blockingIssues(out)
        if (blocking.length === 0) {
          queue({ type: 'final-gate', value: 'pass' })
          break
        }
        const owner = owningStep(S, blocking)
        if (owner !== null && S.finalGate.rounds < 3) { // the step that owns the finding goes back to be fixed, then the gate runs again
          carry.set(owner, issuesText(blocking))
          queue({ type: 'final-gate', value: 'defects', step: owner, text: issuesText(blocking).slice(0, 600) })
          break
        }
        const question = 'the final review found problems that no step owns or that survived 3 rounds; the person decides'
        queue({ type: 'block', text: question })
        return await finish(stopWith('ask', { question, findings: issuesText(blocking) }))
      }
      case 'hold': // pending steps that wait on a held dependency
        for (const n of act.steps) queue({ type: 'hold', step: n, text: `step T${n} waits on a step held for the person` })
        break
      case 'ask':
        return await finish(stopWith('ask', { question: act.question || S.run.question || (act.manual || []).map((m) => `T${m.step}: ${m.text}`).join(' | '), manual: act.manual || [] }))
      case 'done':
        await runCmd(`node "${CAPTURE}" prune --task-prefix ${shq(S.plan.id + '-')} --cwd ${shq(ROOT)}`, 'capture-prune', { phase: 'Gate', writes: true, json: true }).catch(() => null) // R12: a failed cleanup never changes done
        return await finish({ status: 'done', ...summaryOf() })
      case 'prelaunch-review': { // external steps are reviewed before the person is asked, read-only on the brief
        phase('Review')
        const outs = await parallel(act.steps.map((n) => async () => {
          const s = stepOf(n)
          return { n, out: await agent(preLaunchPrompt(s),
            { agentType: 'productivity-tools:task-reviewer', label: `T${n}:prelaunch${s.rounds + 1}`, phase: 'Review', schema: S_TASKREVIEW, model: 'opus', effort: 'medium' }) }
        }))
        for (const { n, out } of outs.slice().sort((a, b) => a.n - b.n)) {
          const v = reviewVerdict(out)
          if (v.verdict === 'lost') {
            const k = `pre${n}`
            lost.set(k, (lost.get(k) || 0) + 1)
            if (lost.get(k) >= 3) {
              const question = `the pre-launch reviewer of external step T${n} returned nothing 3 times`
              queue({ type: 'block', text: question })
              return await finish(stopWith('ask', { question }))
            }
            continue
          }
          if (v.verdict === 'pass') queue({ type: 'prelaunch-review', step: n, value: 'pass' })
          else queue({ type: 'prelaunch-review', step: n, value: 'defects', text: v.text.slice(0, 600) })
        }
        break
      }
      case 'authorize': { // the item is bound to the digest of the plan: another digest never authorizes
        const asks = []
        for (const n of act.steps) {
          const s = stepOf(n)
          const item = externalHold({ n, external: s.external }, 'plan', checkedArgs.authorizeExternal, S.plan.digest)
          if (item === null) queue({ type: 'authorize', step: n })
          else asks.push({ item, step: n, title: s.title })
        }
        if (asks.length) return await finish(stopWith('authorize', { items: asks }))
        break
      }
      default:
        return await finish(failWith(`action ${act.action} is not handled by coordinator-workflow`, { action: act }))
    }
  }
  return await finish(failWith('coordinator-workflow: the loop did not settle in 500 turns'))
} catch (e) {
  if (!e || e.refused !== true) throw e
  return await finish(failWith(e.message))
}
