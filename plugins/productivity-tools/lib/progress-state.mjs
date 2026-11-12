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
          brief: 'briefs/T' + n2 + '.md',
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

export function applyEvent(state, event, now) {
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
