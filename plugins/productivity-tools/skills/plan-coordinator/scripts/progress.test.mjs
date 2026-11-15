import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATE_SCHEMA,
  STEP_STATUSES,
  RUN_STATUSES,
  EVENT_TYPES,
  initState,
  nextAction,
  applyEvent,
  applyEvents,
} from '../../../lib/progress-state.mjs';
import { emitPlan, checkPlan, buildMap } from '../../../scripts/plan-tool.mjs';
import { checkPureSource } from '../../../scripts/embed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const libPath = path.join(here, '..', '..', '..', 'lib', 'progress-state.mjs');
const planPath = path.join(here, '..', '..', '..', 'scripts', 'fixtures', 'plan-tool', 'plan.md');
const planText = fs.readFileSync(planPath, 'utf8');
const NOW = '2026-11-12T10:00:00.000Z';

function stateFor(maxWidth = 4) {
  const r = emitPlan(planText, { planPath, maxWidth });
  assert.deepEqual(r.errors, []);
  return initState(r.out, { planPath: 'plan.md', now: NOW });
}

const step = (s, n) => s.steps.find((x) => x.n === n);
const withSteps = (s, patch) => {
  const c = structuredClone(s);
  for (const [n, p] of Object.entries(patch)) Object.assign(step(c, Number(n)), p);
  return c;
};
const approved = (s) => {
  const c = structuredClone(s);
  c.run.status = 'in-progress';
  return c;
};

test('progress-state is pure', () => {
  assert.equal(checkPureSource(fs.readFileSync(libPath, 'utf8'), 'progress-state.mjs'), null);
});

test('exported constants', () => {
  assert.equal(STATE_SCHEMA, 'progress/1');
  assert.deepEqual(STEP_STATUSES, ['pending', 'launched', 'review-owed', 'pass', 'skip', 'skip-manual', 'waiting-manual', 'stopped']);
  assert.deepEqual(RUN_STATUSES, ['map-ready', 'in-progress', 'blocked', 'completed']);
  assert.equal(EVENT_TYPES.length, 22);
  assert.ok(EVENT_TYPES.includes('approve-map') && EVENT_TYPES.includes('final-gate'));
});

function checkAgainstMap(maxWidth) {
  const r = checkPlan(planText, { planPath });
  const m = buildMap(r.data, r.levels, { maxWidth });
  const state = stateFor(maxWidth);
  assert.deepEqual(state.waves, m.waves.map((w) => ({ n: w.n, tasks: w.tasks.map((t) => t.n) })));
  for (const w of m.waves) {
    for (const t of w.tasks) {
      const s = step(state, t.n);
      assert.equal(s.tier, t.tier);
      assert.equal(s.effort, t.effort);
      assert.equal(s.reviewTier, t.reviewTier);
      assert.equal(s.gate, t.gate);
      assert.equal(s.external, t.external);
      assert.equal(s.wave, w.n);
    }
  }
  return state;
}

test('AC3: initState copies waves, tiers and gates from plan-tool (default width)', () => {
  const state = checkAgainstMap(4);
  assert.deepEqual(state.waves.map((w) => w.tasks), [[1], [2, 3, 5], [4], [6]]);
  const t5 = step(state, 5);
  assert.equal(t5.tier, 'sonnet');
  assert.equal(t5.reviewTier, 'opus');
  assert.equal(t5.gate, true);
  assert.equal(t5.external, true);
  assert.equal(step(state, 2).tier, 'haiku');
  assert.equal(state.plan.maxWidth, 4);
});

test('AC3: same with maxWidth 2', () => {
  const state = checkAgainstMap(2);
  assert.equal(state.plan.maxWidth, 2);
  assert.notEqual(state.plan.digest, stateFor(4).plan.digest);
});

test('initState shape', () => {
  const s = stateFor();
  assert.equal(s.schema, STATE_SCHEMA);
  assert.equal(s.run.status, 'map-ready');
  assert.equal(s.run.wave, 1);
  assert.equal(s.run.waveGateOwed, null);
  assert.equal(s.run.updated, NOW);
  assert.equal(s.plan.path, 'plan.md');
  assert.equal(s.plan.spec, null);
  assert.equal(s.plan.id, 'E1');
  assert.deepEqual(s.finalGate, { status: 'pending', rounds: 0, lastVerdict: null });
  assert.deepEqual(s.manual, []);
  assert.deepEqual(s.history, [{ event: 'init', at: NOW }]);
  for (const x of s.steps) {
    assert.equal(x.status, 'pending');
    assert.equal(x.attempts, 0);
    assert.equal(x.rounds, 0);
    assert.equal(x.mode, 'delegated');
    assert.equal(x.agent, 'general-purpose');
    assert.equal(x.outputs, null);
    assert.equal(x.brief, 'briefs/T' + x.n + '.md');
  }
});

test('initState options are copied and the input is not mutated', () => {
  const r = emitPlan(planText, { planPath });
  const before = structuredClone(r.out);
  const s = initState(r.out, { planPath: 'p.md', spec: 's.md', piece: 'P1', worktree: 'w', branch: 'b', base: 'abc', commits: 'per-step', test: 'npm t', baseline: 'ok', now: NOW });
  assert.deepEqual(r.out, before);
  assert.equal(s.plan.spec, 's.md');
  assert.equal(s.piece, 'P1');
  assert.deepEqual(
    [s.run.worktree, s.run.branch, s.run.base, s.run.commits, s.run.test, s.run.baseline],
    ['w', 'b', 'abc', 'per-step', 'npm t', 'ok'],
  );
});

test('nextAction order', () => {
  const s0 = stateFor();
  const run = (c, status) => ((c.run.status = status), c);

  assert.deepEqual(nextAction(s0), { action: 'approve-map' });

  assert.deepEqual(nextAction(run(structuredClone(s0), 'completed')), { action: 'done' });

  const blocked = run(structuredClone(s0), 'blocked');
  blocked.run.question = 'q';
  assert.deepEqual(nextAction(blocked), { action: 'ask', question: 'q' });

  const launched = withSteps(approved(s0), { 1: { status: 'launched', agentId: 'a1' } });
  assert.deepEqual(nextAction(launched), { action: 'await', steps: [1], agentIds: ['a1'] });

  const review = withSteps(approved(s0), { 1: { status: 'review-owed' } });
  assert.deepEqual(nextAction(review), { action: 'review', step: 1, reviewTier: 'opus' });

  const gate = withSteps(approved(s0), { 1: { status: 'pass' } });
  gate.run.waveGateOwed = 1;
  assert.deepEqual(nextAction(gate), { action: 'wave-gate', wave: 1 });

  const wave2 = (patch = {}) => {
    const c = withSteps(approved(s0), { 1: { status: 'pass' }, ...patch });
    c.run.wave = 2;
    return c;
  };
  assert.deepEqual(nextAction(wave2()), { action: 'prelaunch-review', steps: [5] });
  assert.deepEqual(nextAction(wave2({ 5: { preLaunchReview: 'pass' } })), { action: 'authorize', steps: [5] });

  const held = withSteps(approved(s0), { 1: { status: 'skip', outputs: false } });
  held.run.wave = 2;
  const dependents = [2, 3, 5].filter((n) => step(held, n).deps.includes(1));
  assert.ok(dependents.includes(2));
  assert.deepEqual(nextAction(held), { action: 'hold', steps: dependents });

  const t1 = step(s0, 1);
  assert.equal(t1.tier, 'sonnet');
  assert.deepEqual(nextAction(approved(s0)), {
    action: 'launch',
    wave: 1,
    steps: [{ n: 1, tier: t1.tier, effort: t1.effort, agent: 'general-purpose', brief: 'briefs/T1.md', mode: 'delegated' }],
  });

  const l2 = nextAction(wave2({ 5: { preLaunchReview: 'pass', authorized: 'ok' } }));
  assert.equal(l2.action, 'launch');
  assert.equal(l2.wave, 2);
  assert.deepEqual(l2.steps.map((x) => [x.n, x.mode]), [[2, 'inline'], [3, 'inline'], [5, 'delegated']]);

  const allDone = approved(s0);
  allDone.steps.forEach((x) => (x.status = 'pass'));
  allDone.run.wave = 4;
  assert.deepEqual(nextAction(allDone), { action: 'final-gate' });

  const passed = structuredClone(allDone);
  passed.finalGate.status = 'pass';
  passed.manual = [
    { kind: 'refused', step: 5, text: 'x', open: true },
    { kind: 'refused', step: 5, text: 'y', open: false },
  ];
  assert.deepEqual(nextAction(passed), { action: 'ask', manual: [passed.manual[0]] });
  passed.manual[0].open = false;
  assert.deepEqual(nextAction(passed), { action: 'done' });
});

test('nextAction advances to the next wave and never mutates', () => {
  const s0 = approved(stateFor());
  const adv = withSteps(s0, { 1: { status: 'pass' } });
  const frozen = structuredClone(adv);
  // wave 1 complete but run.wave still 1 -> advance
  assert.deepEqual(nextAction(adv), { action: 'advance', wave: 2 });
  assert.deepEqual(adv, frozen);
});

// ---------------------------------------------------------------------------
// Task 2: applyEvent
// ---------------------------------------------------------------------------
const T0 = NOW;
const T1 = '2026-11-12T10:01:00.000Z';

function ok(s, ev, now = T1) {
  const before = structuredClone(s);
  const r = applyEvent(s, ev, now);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(s, before, 'input mutated by ' + ev.type);
  assert.notEqual(r.state, s);
  return r.state;
}

function refused(s, ev, code) {
  const before = structuredClone(s);
  const r = applyEvent(s, ev, T1);
  assert.equal(r.ok, false);
  assert.equal(r.code, code, r.message);
  assert.equal(typeof r.message, 'string');
  assert.deepEqual(s, before, 'state changed by a refusal');
}

const run = (s, ...evs) => evs.reduce((acc, ev) => ok(acc, ev), s);
const mapReady = () => stateFor();
const started = () => ok(mapReady(), { type: 'approve-map' }, T0);
const wave2 = () => run(
  started(),
  { type: 'launch', steps: [1] },
  { type: 'report', step: 1, value: 'pass' },
  { type: 'wave-gate', value: 'pass' },
  { type: 'advance' },
);

test('AC1: launch with a dependency not passed is refused and the state does not change', () => {
  const launched = ok(started(), { type: 'launch', steps: [1] });
  const forced = structuredClone(launched);
  forced.run.wave = 2;
  refused(forced, { type: 'launch', steps: [2] }, 'dependency-not-passed');
  const skipped = withSteps(forced, { 1: { status: 'skip', outputs: false } });
  refused(skipped, { type: 'launch', steps: [2] }, 'dependency-not-passed');
  const withOutputs = withSteps(forced, { 1: { status: 'skip', outputs: true } });
  assert.equal(applyEvent(withOutputs, { type: 'launch', steps: [2] }, T1).ok, true);
});

test('applyEvent never mutates its input', () => {
  let s = mapReady();
  const path = [
    { type: 'approve-map' },
    { type: 'launch', steps: [1], agentId: 'a1' },
    { type: 'report', step: 1, value: 'pass', text: 'ok' },
    { type: 'commit', step: 1, sha: 'abc' },
    { type: 'wave-gate', value: 'pass' },
    { type: 'advance' },
    { type: 'inline-start', step: 2 },
    { type: 'inline-result', step: 2, value: 'pass' },
    { type: 'block', text: 'q' },
    { type: 'unblock' },
  ];
  for (const ev of path) s = ok(s, ev);
  assert.equal(step(s, 1).sha, 'abc');
  assert.equal(s.run.updated, T1);
  assert.deepEqual(s.history.at(-1), { event: 'unblock', at: T1 });
  assert.deepEqual(s.history.find((h) => h.event === 'launch'), { event: 'launch', steps: [1], at: T1 });
  assert.deepEqual(s.history.find((h) => h.event === 'report'), { event: 'report', step: 1, value: 'pass', at: T1 });
});

test('refusal codes', () => {
  refused(mapReady(), { type: 'launch', steps: [1] }, 'wrong-status');
  const s = started();
  refused(withSteps(s, { 1: { status: 'pass' } }), { type: 'launch', steps: [1] }, 'wrong-status');
  refused(ok(s, { type: 'block', text: 'q' }), { type: 'launch', steps: [1] }, 'blocked');
  refused(s, { type: 'launch', steps: [4] }, 'wave-order');
  refused(s, { type: 'launch', steps: [99] }, 'unknown-step');
  refused(s, { type: 'jump' }, 'unknown-event');
  refused(s, { type: 'approve-map' }, 'wrong-status');
  const w2 = wave2();
  refused(w2, { type: 'inline-start', step: 5 }, 'inline-not-allowed');
  refused(w2, { type: 'inline-start', step: 1 }, 'wrong-status');
  refused(withSteps(w2, { 3: { status: 'launched', mode: 'inline' } }), { type: 'inline-start', step: 2 }, 'inline-not-allowed');
  refused(s, { type: 'launch', steps: [1], tier: 'haiku' }, 'tier-down');
  refused(withSteps(w2, { 1: { status: 'stopped' }, 2: { status: 'waiting-manual' } }), { type: 'release', step: 2 }, 'dependency-held');
  refused(w2, { type: 'advance' }, 'steps-open');
  const owed = structuredClone(s);
  owed.run.waveGateOwed = 1;
  refused(owed, { type: 'advance' }, 'gate-owed');
  const bad = structuredClone(s);
  bad.schema = 'progress/2';
  refused(bad, { type: 'launch', steps: [1] }, 'state-schema');
});

test('launch records agent, attempts and a higher tier', () => {
  const s = ok(started(), { type: 'launch', steps: [1], agentId: 'a1', tier: 'opus' });
  assert.equal(step(s, 1).status, 'launched');
  assert.equal(step(s, 1).attempts, 1);
  assert.equal(step(s, 1).agentId, 'a1');
  assert.equal(step(s, 1).tier, 'opus');
});

test('report pass on a gated step owes a review; review pass closes it', () => {
  const g = withSteps(wave2(), { 2: { status: 'launched', gate: true } });
  const owed = ok(g, { type: 'report', step: 2, value: 'pass', text: 'EVIDENCE' });
  assert.equal(step(owed, 2).status, 'review-owed');
  assert.equal(step(owed, 2).note, 'EVIDENCE');
  assert.equal(step(ok(owed, { type: 'review-result', step: 2, value: 'pass' }), 2).status, 'pass');
  const lost = ok(owed, { type: 'review-result', step: 2, value: 'lost' });
  assert.equal(step(lost, 2).status, 'review-owed');
  assert.equal(step(lost, 2).note, 'reviewer lost');
});

test('report fail three times holds the step', () => {
  let s = started();
  for (let i = 1; i <= 3; i++) {
    s = ok(s, { type: 'launch', steps: [1] });
    s = ok(s, { type: 'report', step: 1, value: i === 2 ? 'blocked' : 'fail', text: 'x' });
    assert.equal(step(s, 1).status, i < 3 ? 'pending' : 'skip-manual');
  }
  assert.equal(step(s, 1).attempts, 3);
  assert.deepEqual(s.manual, [{ kind: 'open-question', step: 1, text: 'x', open: true }]);
  assert.equal(step(s, 2).status, 'waiting-manual');
  assert.equal(step(s, 6).status, 'waiting-manual');
  const released = ok(s, { type: 'release', step: 1 });
  assert.equal(step(released, 1).status, 'pending');
  assert.equal(released.manual[0].open, false);
});

test('defects after two rounds behave as report fail', () => {
  let s = withSteps(wave2(), { 2: { status: 'review-owed', gate: true, attempts: 1 } });
  s = ok(s, { type: 'review-result', step: 2, value: 'defects' });
  assert.equal(step(s, 2).status, 'launched');
  assert.equal(step(s, 2).rounds, 1);
  s = ok(s, { type: 'report', step: 2, value: 'pass' });
  s = ok(s, { type: 'review-result', step: 2, value: 'defects' });
  assert.equal(step(s, 2).rounds, 2);
  s = ok(s, { type: 'report', step: 2, value: 'pass' });
  s = ok(s, { type: 'review-result', step: 2, value: 'defects' });
  assert.equal(step(s, 2).status, 'pending');
  assert.equal(step(s, 2).rounds, 2);
  const exhausted = withSteps(s, { 2: { status: 'review-owed', attempts: 3 } });
  const held = ok(exhausted, { type: 'review-result', step: 2, value: 'defects' });
  assert.equal(step(held, 2).status, 'skip-manual');
  assert.equal(held.manual.length, 1);
});

test('inline fail re-routes to sonnet', () => {
  const s = ok(wave2(), { type: 'inline-start', step: 2 });
  assert.equal(step(s, 2).mode, 'inline');
  assert.equal(step(s, 2).attempts, 1);
  const failed = ok(s, { type: 'inline-result', step: 2, value: 'fail' });
  assert.equal(step(failed, 2).status, 'pending');
  assert.equal(step(failed, 2).mode, 'delegated');
  assert.equal(step(failed, 2).tier, 'sonnet');
  assert.equal(step(ok(s, { type: 'inline-result', step: 2, value: 'pass' }), 2).status, 'pass');
  refused(started(), { type: 'inline-result', step: 1, value: 'pass' }, 'wrong-status');
});

test('no-report returns a launched step to pending', () => {
  const s = ok(ok(started(), { type: 'launch', steps: [1] }), { type: 'no-report', step: 1 });
  assert.equal(step(s, 1).status, 'pending');
});

test('hold marks transitive dependents waiting', () => {
  const s = ok(wave2(), { type: 'hold', step: 2, text: 'falta parametro' });
  assert.equal(step(s, 2).status, 'skip-manual');
  assert.deepEqual(s.manual, [{ kind: 'open-question', step: 2, text: 'falta parametro', open: true }]);
  assert.equal(step(s, 6).status, 'waiting-manual');
  assert.equal(step(s, 3).status, 'pending');
  refused(s, { type: 'hold', step: 6 }, 'wrong-status');
});

test('skip with outputs lets dependents proceed', () => {
  const s = ok(mapReady(), { type: 'skip', step: 1, value: 'outputs' });
  assert.equal(step(s, 1).status, 'skip');
  assert.equal(step(s, 1).outputs, true);
  assert.equal(nextAction(ok(s, { type: 'approve-map' })).action, 'advance');
  refused(started(), { type: 'skip', step: 1, value: 'outputs' }, 'wrong-status');
});

test('wave gate becomes owed when the wave settles', () => {
  let s = ok(started(), { type: 'launch', steps: [1] });
  assert.equal(s.run.waveGateOwed, null);
  s = ok(s, { type: 'report', step: 1, value: 'pass' });
  assert.equal(s.run.waveGateOwed, 1);
  assert.equal(nextAction(s).action, 'wave-gate');
  refused(s, { type: 'launch', steps: [1] }, 'wrong-status');
  const failed = ok(s, { type: 'wave-gate', value: 'fail', step: 1 });
  assert.equal(step(failed, 1).status, 'pending');
  assert.equal(failed.run.waveGateOwed, null);
  const passed = ok(s, { type: 'wave-gate', value: 'pass' });
  assert.equal(passed.run.waveGateOwed, null);
  refused(passed, { type: 'wave-gate', value: 'pass' }, 'wrong-status');
  // a wave with siblings still pending does not owe the gate yet
  const one = run(wave2(), { type: 'inline-start', step: 2 }, { type: 'inline-result', step: 2, value: 'pass' });
  assert.equal(one.run.waveGateOwed, null);
});

test('advance moves to the next wave', () => {
  assert.equal(wave2().run.wave, 2);
});

test('final-gate pass completes the run', () => {
  const all = approved(stateFor());
  all.steps.forEach((x) => (x.status = 'pass'));
  all.run.wave = 4;
  refused(withSteps(all, { 6: { status: 'pending' } }), { type: 'final-gate', value: 'pass' }, 'steps-open');
  const done = ok(all, { type: 'final-gate', value: 'pass' });
  assert.equal(done.run.status, 'completed');
  assert.deepEqual(done.finalGate, { status: 'pass', rounds: 1, lastVerdict: 'pass' });
  assert.equal(ok(all, { type: 'final-gate', value: 'skip' }).finalGate.status, 'skip');
  const defects = ok(all, { type: 'final-gate', value: 'defects', step: 2 });
  assert.equal(defects.run.status, 'in-progress');
  assert.equal(defects.finalGate.status, 'pending');
  assert.equal(defects.finalGate.rounds, 1);
  assert.equal(step(defects, 2).status, 'pending');
  assert.equal(defects.run.wave, 2);
});

test('commit needs a passed step and a sha', () => {
  refused(started(), { type: 'commit', step: 1, sha: 'a' }, 'wrong-status');
  refused(withSteps(started(), { 1: { status: 'pass' } }), { type: 'commit', step: 1 }, 'wrong-status');
});

// ---- Task 3: passos externos e respostas manuais ----

const reviewed5 = () => ok(wave2(), { type: 'prelaunch-review', step: 5, value: 'pass' });
const authorized5 = () => ok(reviewed5(), { type: 'authorize', step: 5 }, T1);
const launched5 = () => ok(authorized5(), { type: 'launch', steps: [5], agentId: 'a5' });
const stopped5 = () => ok(launched5(), { type: 'report', step: 5, value: 'fail' });

test('external launch needs review and authorization', () => {
  refused(wave2(), { type: 'launch', steps: [5] }, 'external-unauthorized');
  refused(reviewed5(), { type: 'launch', steps: [5] }, 'external-unauthorized');
  const a = authorized5();
  assert.equal(step(a, 5).authorized, T1);
  const l = ok(a, { type: 'launch', steps: [5] });
  assert.equal(step(l, 5).status, 'launched');
  assert.equal(step(l, 5).attempts, 1);
  refused(a, { type: 'inline-start', step: 5 }, 'inline-not-allowed');
});

test('authorize needs a reviewed external step', () => {
  refused(wave2(), { type: 'authorize', step: 5 }, 'wrong-status');
  refused(wave2(), { type: 'authorize', step: 2 }, 'wrong-status');
});

test('external step launches at most once', () => {
  const r = ok(stopped5(), { type: 'answer', step: 5, value: 'rerun' });
  assert.equal(step(r, 5).status, 'stopped');
  assert.equal(step(r, 5).replacedBy, 7);
  const n7 = step(r, 7);
  assert.equal(n7.status, 'pending');
  assert.equal(n7.external, true);
  assert.deepEqual(n7.deps, [1]);
  assert.equal(n7.attempts, 0);
  assert.equal(n7.preLaunchReview, null);
  assert.equal(n7.authorized, null);
  assert.equal(n7.wave, step(r, 5).wave);
  const t6 = step(r, 6);
  assert.ok(t6.deps.includes(7) && !t6.deps.includes(5));
  assert.ok(r.waves.some((w) => w.tasks.includes(7)) && !r.waves.some((w) => w.tasks.includes(5)));
  assert.deepEqual(r.manual.filter((m) => m.step === 5).map((m) => [m.kind, m.open]), [['refused', false]]);
  refused(r, { type: 'launch', steps: [5] }, 'wrong-status');
  refused(withSteps(wave2(), { 5: { attempts: 1 } }), { type: 'launch', steps: [5] }, 'external-relaunch');
});

test('no event takes a launched external step back to pending', () => {
  const values = {
    report: ['pass', 'fail', 'blocked'],
    'inline-result': ['pass', 'fail'],
    'review-result': ['pass', 'defects', 'lost'],
    'wave-gate': ['pass', 'fail'],
    'final-gate': ['pass', 'defects', 'skip'],
    'prelaunch-review': ['pass', 'defects'],
    refuse: ['refused', 'not-named'],
    answer: ['done', 'no', 'rerun', 'value'],
    skip: ['outputs', 'no-outputs'],
  };
  const events = [];
  for (const type of EVENT_TYPES) {
    for (const value of values[type] ?? [undefined]) {
      const e = { type, step: 5, steps: [5], tier: 'opus', agentId: 'x', sha: 's', text: 't' };
      if (value !== undefined) e.value = value;
      events.push(e);
    }
  }
  const keyOf = (s) => JSON.stringify(s.steps) + JSON.stringify(s.run) + JSON.stringify(s.manual);
  let frontier = [launched5()];
  const seen = new Set(frontier.map(keyOf));
  let applied = 0;
  for (let depth = 0; depth < 3; depth += 1) {
    const next = [];
    for (const s of frontier) {
      for (const e of events) {
        const r = applyEvent(s, e, T1);
        if (!r.ok) continue;
        applied += 1;
        assert.notEqual(step(r.state, 5).status, 'pending', 'pending after ' + JSON.stringify(e));
        if (!seen.has(keyOf(r.state))) {
          seen.add(keyOf(r.state));
          next.push(r.state);
        }
      }
    }
    frontier = next;
  }
  assert.ok(applied > 50);
});

test('external launched outcomes stop the step with an open question', () => {
  const evs = [{ type: 'report', step: 5, value: 'fail' }, { type: 'report', step: 5, value: 'blocked' }, { type: 'no-report', step: 5 }];
  for (const ev of evs) {
    const s = ok(launched5(), ev);
    assert.equal(step(s, 5).status, 'stopped');
    assert.deepEqual(s.manual.map((m) => [m.kind, m.step, m.open]), [['open-question', 5, true]]);
  }
  const owed = ok(launched5(), { type: 'report', step: 5, value: 'pass' });
  assert.equal(step(owed, 5).status, 'review-owed');
  const bad = ok(owed, { type: 'review-result', step: 5, value: 'defects' });
  assert.equal(step(bad, 5).status, 'stopped');
  assert.equal(bad.manual[0].kind, 'open-question');
  assert.equal(step(ok(owed, { type: 'review-result', step: 5, value: 'pass' }), 5).status, 'pass');
});

test('wave-gate fail and final-gate defects stop a passed external step', () => {
  const owed = withSteps(wave2(), { 2: { status: 'pass' }, 3: { status: 'pass' }, 5: { status: 'pass', attempts: 1 } });
  owed.run.waveGateOwed = 2;
  const w = ok(owed, { type: 'wave-gate', value: 'fail', step: 5 });
  assert.equal(step(w, 5).status, 'stopped');
  assert.equal(w.run.waveGateOwed, null);
  assert.equal(w.manual[0].kind, 'open-question');
  const all = approved(stateFor());
  all.steps.forEach((x) => (x.status = 'pass'));
  all.run.wave = 4;
  const f = ok(all, { type: 'final-gate', value: 'defects', step: 5 });
  assert.equal(step(f, 5).status, 'stopped');
  assert.equal(f.finalGate.rounds, 1);
  assert.equal(f.manual[0].step, 5);
});

test('final-gate defects on an external step then rerun repositions the wave', () => {
  const all = approved(stateFor());
  all.steps.forEach((x) => (x.status = 'pass'));
  all.run.wave = 4;
  const f = ok(all, { type: 'final-gate', value: 'defects', step: 5 });
  const r = ok(f, { type: 'answer', step: 5, value: 'rerun' });
  const n = step(r, 5).replacedBy;
  assert.equal(r.run.wave, step(r, n).wave);
  assert.notEqual(nextAction(r).action, 'ask');
});

test('card-changed clears review and authorization', () => {
  const c = ok(authorized5(), { type: 'card-changed', step: 5 });
  assert.equal(step(c, 5).preLaunchReview, null);
  assert.equal(step(c, 5).authorized, null);
  refused(c, { type: 'launch', steps: [5] }, 'external-unauthorized');
  const held = ok(reviewed5(), { type: 'refuse', step: 5, value: 'refused' });
  const c2 = ok(held, { type: 'card-changed', step: 5 });
  assert.equal(step(c2, 5).status, 'skip-manual');
  refused(wave2(), { type: 'card-changed', step: 2 }, 'wrong-status');
});

test('prelaunch defects twice holds the step as prelaunch-failed', () => {
  const one = ok(wave2(), { type: 'prelaunch-review', step: 5, value: 'defects' });
  assert.equal(step(one, 5).status, 'pending');
  assert.equal(step(one, 5).rounds, 1);
  assert.equal(step(one, 5).preLaunchReview, null);
  const two = ok(one, { type: 'prelaunch-review', step: 5, value: 'defects' });
  assert.equal(step(two, 5).status, 'skip-manual');
  assert.deepEqual(two.manual.map((m) => [m.kind, m.step, m.open]), [['prelaunch-failed', 5, true]]);
  assert.equal(step(two, 6).status, 'waiting-manual');
  refused(two, { type: 'prelaunch-review', step: 5, value: 'pass' }, 'wrong-status');
});

test('refuse not-named then authorize returns to pending', () => {
  refused(wave2(), { type: 'refuse', step: 5, value: 'refused' }, 'wrong-status');
  const r = ok(reviewed5(), { type: 'refuse', step: 5, value: 'not-named' });
  assert.equal(step(r, 5).status, 'skip-manual');
  assert.equal(r.manual[0].kind, 'not-named');
  const a = ok(r, { type: 'authorize', step: 5 }, T1);
  assert.equal(step(a, 5).status, 'pending');
  assert.equal(step(a, 5).authorized, T1);
  assert.equal(a.manual[0].open, false);
  assert.equal(step(ok(a, { type: 'launch', steps: [5] }), 5).status, 'launched');
});

test('answer done on stopped is pass', () => {
  const s = ok(stopped5(), { type: 'answer', step: 5, value: 'done' });
  assert.equal(step(s, 5).status, 'pass');
  assert.equal(s.manual[0].open, false);
  const no = ok(stopped5(), { type: 'answer', step: 5, value: 'no' });
  assert.equal(step(no, 5).status, 'stopped');
  assert.deepEqual(no.manual.map((m) => [m.kind, m.open]), [['refused', false]]);
  refused(stopped5(), { type: 'answer', step: 5, value: 'value' }, 'wrong-status');
  refused(wave2(), { type: 'answer', step: 5, value: 'done' }, 'wrong-status');
});

test('answer value writes the note and returns to pending', () => {
  const held = ok(reviewed5(), { type: 'refuse', step: 5, value: 'refused' });
  const v = ok(held, { type: 'answer', step: 5, value: 'value', text: 'use o id 42' });
  assert.equal(step(v, 5).status, 'pending');
  assert.equal(step(v, 5).note, 'use o id 42');
  assert.equal(step(v, 5).preLaunchReview, null);
  assert.equal(step(v, 5).authorized, null);
  assert.equal(v.manual[0].open, false);
  assert.equal(step(ok(held, { type: 'answer', step: 5, value: 'done' }), 5).status, 'pass');
  const no = ok(held, { type: 'answer', step: 5, value: 'no' });
  assert.equal(step(no, 5).status, 'skip-manual');
  assert.equal(no.manual[0].kind, 'refused');
});

// Final-fix E7: DEC-206, run presa em onda anterior, entradas manuais antes do portão final.
test('review action names opus for a gated step whatever the routing reviewTier', () => {
  const c = withSteps(approved(stateFor()), { 1: { status: 'review-owed', gate: true, reviewTier: 'sonnet' } });
  assert.deepEqual(nextAction(c), { action: 'review', step: 1, reviewTier: 'opus' });
});

// Percorre as ondas deixando T3 e T5 retidos e avança até a última onda.
function pastHeld() {
  let s = run(
    started(),
    { type: 'launch', steps: [1] },
    { type: 'report', step: 1, value: 'pass' },
    { type: 'wave-gate', value: 'pass' },
    { type: 'advance' },
    { type: 'hold', step: 3 },
    { type: 'launch', steps: [2] },
    { type: 'report', step: 2, value: 'pass' },
    { type: 'prelaunch-review', step: 5, value: 'pass' },
    { type: 'refuse', step: 5, value: 'not-named' },
  );
  while (nextAction(s).action === 'wave-gate' || nextAction(s).action === 'advance') {
    s = ok(s, nextAction(s).action === 'advance' ? { type: 'advance' } : { type: 'wave-gate', value: 'pass' });
  }
  return s;
}

test('a held step released after the wave advanced can run again', () => {
  const s0 = pastHeld();
  assert.ok(s0.run.wave > step(s0, 3).wave, 'the wave advanced past T3');
  const v = ok(s0, { type: 'answer', step: 3, value: 'value', text: 'x' });
  assert.equal(v.run.wave, step(v, 3).wave);
  assert.equal(nextAction(v).action, 'launch');
  assert.equal(step(ok(v, { type: 'launch', steps: [3] }), 3).status, 'launched');
  const r = ok(s0, { type: 'release', step: 3 });
  assert.equal(r.run.wave, step(r, 3).wave);
  assert.equal(step(ok(r, { type: 'launch', steps: [3] }), 3).status, 'launched');
  const a = ok(ok(s0, { type: 'authorize', step: 5 }), { type: 'prelaunch-review', step: 5, value: 'pass' }, T1);
  assert.equal(a.run.wave, step(a, 5).wave);
});

test('open manual entries are asked before the final gate', () => {
  let s = pastHeld();
  for (let i = 0; i < 20 && nextAction(s).action !== 'ask'; i++) {
    const n = nextAction(s);
    if (n.action === 'launch') {
      for (const l of n.steps) {
        s = ok(s, { type: 'launch', steps: [l.n] });
        s = ok(s, { type: 'report', step: l.n, value: 'pass' });
        if (step(s, l.n).status === 'review-owed') s = ok(s, { type: 'review-result', step: l.n, value: 'pass' });
      }
    } else if (n.action === 'wave-gate') s = ok(s, { type: 'wave-gate', value: 'pass' });
    else if (n.action === 'advance') s = ok(s, { type: 'advance' });
    else break;
  }
  assert.equal(s.steps.some((x) => x.status === 'pending'), false);
  const open = s.manual.filter((m) => m.open);
  assert.deepEqual(open.map((m) => m.step), [3, 5]);
  assert.deepEqual(nextAction(s), { action: 'ask', manual: open });
  s = ok(s, { type: 'answer', step: 3, value: 'no' });
  s = ok(s, { type: 'answer', step: 5, value: 'no' });
  assert.deepEqual(nextAction(s), { action: 'final-gate' });
});

// ---------------------------------------------------------------------------
// Task 4: CLI progress.mjs
// ---------------------------------------------------------------------------
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { main as progressMain, readState, writeState } from './progress.mjs';

const PROGRESS = path.join(here, 'progress.mjs');
const FIXTURES = path.join(here, '..', '..', '..', 'scripts', 'fixtures');
const GIT = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'];

function sh(cwd, cmd, args) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, cmd + ' ' + args.join(' ') + ': ' + r.stderr);
  return r.stdout.trim();
}

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-'));
  fs.mkdirSync(path.join(dir, 'plan-tool'));
  fs.mkdirSync(path.join(dir, 'spec-tool'));
  fs.copyFileSync(path.join(FIXTURES, 'plan-tool', 'plan.md'), path.join(dir, 'plan-tool', 'plan.md'));
  fs.copyFileSync(path.join(FIXTURES, 'spec-tool', 'spec.md'), path.join(dir, 'spec-tool', 'spec.md'));
  sh(dir, 'git', ['init', '-q', '-b', 'main']);
  sh(dir, 'git', [...GIT, 'add', '-A']);
  sh(dir, 'git', [...GIT, 'commit', '-q', '-m', 'init']);
  return {
    dir,
    plan: path.join(dir, 'plan-tool', 'plan.md'),
    state: path.join(dir, 'plan-tool', 'progress.json'),
    done: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function cli(args) {
  const r = spawnSync(process.execPath, [PROGRESS, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');

function withSandbox(fn) {
  const sb = sandbox();
  try {
    return fn(sb);
  } finally {
    sb.done();
  }
}

test('AC7: plan without data block is refused pointing to adoption', () => withSandbox((sb) => {
  fs.writeFileSync(sb.plan, '# Plano\n\nSó prosa, sem bloco de dados.\n');
  const r = cli(['init', sb.plan, '--json']);
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.equal(j.code, 'plan-no-data-block');
  assert.equal(j.ok, false);
  assert.ok(j.errors[0].message.includes('plan-writer') && j.errors[0].message.includes('adoção'));
  assert.equal(fs.existsSync(sb.state), false);
  assert.equal(fs.existsSync(path.join(path.dirname(sb.plan), 'briefs')), false);
}));

for (const width of [null, 2]) {
  test('AC3: init through the CLI matches plan-tool map' + (width ? ' (max-width 2)' : ''), () => withSandbox((sb) => {
    const args = ['init', sb.plan];
    if (width) args.push('--max-width', String(width));
    const r = cli(args);
    assert.equal(r.code, 0, r.err);
    const state = readJson(sb.state);
    const text = fs.readFileSync(sb.plan, 'utf8');
    const c = checkPlan(text, { planPath: sb.plan });
    const m = buildMap(c.data, c.levels, { maxWidth: width ?? 4 });
    assert.deepEqual(state.waves, m.waves.map((w) => ({ n: w.n, tasks: w.tasks.map((t) => t.n) })));
    for (const w of m.waves) {
      for (const t of w.tasks) {
        const s = state.steps.find((x) => x.n === t.n);
        assert.equal(s.tier, t.tier);
        assert.equal(s.effort, t.effort);
        assert.equal(s.reviewTier, t.reviewTier);
        assert.equal(s.gate, t.gate);
        assert.equal(s.external, t.external);
        assert.equal(s.wave, w.n);
      }
    }
    assert.equal(state.plan.maxWidth, width ?? 4);
    for (let n = 1; n <= 6; n++) assert.ok(fs.existsSync(path.join(path.dirname(sb.plan), 'briefs', 'T' + n + '.md')));
    assert.ok(!fs.readFileSync(path.join(path.dirname(sb.plan), 'briefs', 'T1.md'), 'utf8').includes('\r'));
  }));
}

test('init refuses plan-invalid and state-exists; --restart recreates', () => withSandbox((sb) => {
  const good = fs.readFileSync(sb.plan, 'utf8');
  fs.writeFileSync(sb.plan, good.replace('"deps": []', '"deps": [99]'));
  const bad = cli(['init', sb.plan, '--json']);
  assert.equal(bad.code, 1);
  assert.equal(JSON.parse(bad.out).code, 'plan-invalid');
  assert.equal(fs.existsSync(sb.state), false);
  fs.writeFileSync(sb.plan, good);
  assert.equal(cli(['init', sb.plan]).code, 0);
  const again = cli(['init', sb.plan, '--json']);
  assert.equal(again.code, 1);
  assert.equal(JSON.parse(again.out).code, 'state-exists');
  assert.equal(cli(['apply', sb.state, 'approve-map']).code, 0);
  assert.equal(readJson(sb.state).run.status, 'in-progress');
  assert.equal(cli(['init', sb.plan, '--restart']).code, 0);
  assert.equal(readJson(sb.state).run.status, 'map-ready');
}));

test('init records the default base', () => withSandbox((sb) => {
  const head = sh(sb.dir, 'git', ['rev-parse', 'HEAD']);
  assert.equal(cli(['init', sb.plan]).code, 0);
  let state = readJson(sb.state);
  assert.equal(state.run.base, head);
  assert.ok(state.history.some((h) => h.event === 'default' && h.what === 'base' && h.value === head));

  sh(sb.dir, 'git', ['checkout', '-q', '-b', 'feat']);
  fs.writeFileSync(path.join(sb.dir, 'extra.txt'), 'x\n');
  sh(sb.dir, 'git', [...GIT, 'add', 'extra.txt']);
  sh(sb.dir, 'git', [...GIT, 'commit', '-q', '-m', 'more']);
  assert.equal(cli(['init', sb.plan, '--restart']).code, 0);
  state = readJson(sb.state);
  assert.equal(state.run.base, head);
  assert.notEqual(sh(sb.dir, 'git', ['rev-parse', 'HEAD']), head);
}));

test('AC2: next in a fresh process returns the next action from the file alone', () => withSandbox((sb) => {
  assert.equal(cli(['init', sb.plan]).code, 0);
  const state = readJson(sb.state);
  state.run.status = 'in-progress';
  state.run.wave = 2;
  const st = (n) => state.steps.find((s) => s.n === n);
  st(1).status = 'pass';
  st(2).status = 'launched';
  st(2).agentId = 'a2';
  st(5).status = 'review-owed';
  writeJson(sb.state, state);
  let r = cli(['next', sb.state, '--json']);
  assert.equal(r.code, 0, r.err);
  let j = JSON.parse(r.out);
  assert.equal(j.tool, 'progress');
  assert.equal(j.command, 'next');
  assert.deepEqual(j.action, { action: 'await', steps: [2], agentIds: ['a2'] });
  st(2).status = 'pass';
  writeJson(sb.state, state);
  r = cli(['next', sb.state, '--json']);
  j = JSON.parse(r.out);
  assert.deepEqual(j.action, { action: 'review', step: 5, reviewTier: 'opus' });
}));

test('AC1: apply refused leaves the file byte-identical', () => withSandbox((sb) => {
  assert.equal(cli(['init', sb.plan]).code, 0);
  const state = readJson(sb.state);
  state.run.status = 'in-progress';
  state.run.wave = 2;
  writeJson(sb.state, state);
  const before = fs.readFileSync(sb.state);
  const r = cli(['apply', sb.state, 'launch', '--steps', '2']);
  assert.equal(r.code, 1);
  assert.match(r.err, /dependency-not-passed/);
  assert.ok(fs.readFileSync(sb.state).equals(before));
}));

test('apply accepted writes LF and appends history', () => withSandbox((sb) => {
  assert.equal(cli(['init', sb.plan]).code, 0);
  const r = cli(['apply', sb.state, 'approve-map', '--json']);
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(r.out).ok, true);
  const bytes = fs.readFileSync(sb.state, 'utf8');
  assert.ok(!bytes.includes('\r') && bytes.endsWith('}\n') && bytes.charCodeAt(0) !== 0xfeff);
  const state = JSON.parse(bytes);
  assert.equal(state.run.status, 'in-progress');
  assert.equal(state.history.at(-1).event, 'approve-map');
}));

test('state file in CRLF with BOM is read and rewritten in LF', () => withSandbox((sb) => {
  assert.equal(cli(['init', sb.plan]).code, 0);
  const text = fs.readFileSync(sb.state, 'utf8').replace(/\n/g, '\r\n');
  fs.writeFileSync(sb.state, '﻿' + text);
  assert.equal(cli(['next', sb.state]).code, 0);
  assert.equal(cli(['apply', sb.state, 'approve-map']).code, 0);
  const raw = fs.readFileSync(sb.state);
  assert.notEqual(raw[0], 0xef);
  assert.ok(!raw.toString('utf8').includes('\r'));
  assert.equal(JSON.parse(raw.toString('utf8')).run.status, 'in-progress');
}));

test('next returns plan-changed after the plan text changes', () => withSandbox((sb) => {
  assert.equal(cli(['init', sb.plan]).code, 0);
  assert.equal(cli(['apply', sb.state, 'approve-map']).code, 0);
  fs.appendFileSync(sb.plan, '\nNota nova no fim.\n');
  const before = fs.readFileSync(sb.state);
  const r = cli(['next', sb.state, '--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out).action, { action: 'plan-changed' });
  assert.ok(fs.readFileSync(sb.state).equals(before));
}));

test('next and apply refuse state-schema', () => withSandbox((sb) => {
  assert.equal(cli(['init', sb.plan]).code, 0);
  const state = readJson(sb.state);
  state.schema = 'progress/2';
  writeJson(sb.state, state);
  const before = fs.readFileSync(sb.state);
  for (const args of [['next', sb.state, '--json'], ['apply', sb.state, 'approve-map', '--json']]) {
    const r = cli(args);
    assert.equal(r.code, 1);
    assert.equal(JSON.parse(r.out).code, 'state-schema');
  }
  assert.ok(fs.readFileSync(sb.state).equals(before));
}));

test('writeState refuses concurrent-change', () => withSandbox((sb) => {
  assert.equal(cli(['init', sb.plan]).code, 0);
  const { state, bytes } = readState(sb.state);
  fs.writeFileSync(sb.state, 'alheio\n');
  assert.throws(() => writeState(sb.state, bytes, state), (e) => e.code === 'concurrent-change');
  assert.equal(fs.readFileSync(sb.state, 'utf8'), 'alheio\n');
  assert.deepEqual(fs.readdirSync(path.dirname(sb.state)).filter((f) => f.endsWith('.tmp')), []);
}));

test('usage errors exit 2', () => withSandbox((sb) => {
  assert.equal(cli([]).code, 2);
  assert.equal(cli(['nope']).code, 2);
  assert.equal(cli(['init', sb.plan, '--max-width', 'x']).code, 2);
  assert.equal(cli(['init', sb.plan, '--max-width', '0']).code, 2);
  assert.equal(cli(['init', sb.plan, '--bogus']).code, 2);
  assert.equal(cli(['init', path.join(sb.dir, 'missing.md')]).code, 2);
  assert.equal(cli(['next', path.join(sb.dir, 'missing.json')]).code, 2);
  assert.equal(cli(['init', sb.plan]).code, 0);
  assert.equal(cli(['apply', sb.state, 'launch', '--steps', '1,x']).code, 2);
  assert.equal(cli(['apply', sb.state, 'no-such-event']).code, 2);
  assert.equal(cli(['apply', sb.state]).code, 2);
  fs.writeFileSync(sb.state, '{ não é json');
  assert.equal(cli(['show', sb.state]).code, 2);
}));

test('show prints one row per step', () => withSandbox((sb) => {
  assert.equal(cli(['init', sb.plan]).code, 0);
  const r = cli(['show', sb.state]);
  assert.equal(r.code, 0);
  const rows = r.out.split('\n').filter((l) => /^\d+ \| /.test(l));
  assert.equal(rows.length, 6);
  assert.match(r.out, /map-ready/);
}));

test('main is exported and returns the exit code', () => {
  const io = { stdout: { write() {} }, stderr: { write() {} } };
  assert.equal(progressMain([], io), 2);
});

// ---------------------------------------------------------------------------
// Task 5: select
// ---------------------------------------------------------------------------
import { selectPlan } from './progress.mjs';

function plansRoot(plans) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-sel-'));
  for (const [dir, spec] of Object.entries(plans)) {
    const d = path.join(root, 'docs', 'plans', dir);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'plan.md'), '# Plano\n\n```json data\n' + JSON.stringify({ schema: 'plan/1', id: spec.id }) + '\n```\n');
    if (spec.status) fs.writeFileSync(path.join(d, 'progress.json'), JSON.stringify({ schema: 'progress/1', run: { status: spec.status } }));
  }
  return { root, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function withPlans(plans, fn) {
  const p = plansRoot(plans);
  try {
    return fn(p.root);
  } finally {
    p.done();
  }
}

const selectCli = (root, ...args) => {
  const r = cli(['select', '--root', root, '--json', ...args]);
  assert.equal(r.code, 0, r.err);
  return JSON.parse(r.out);
};

test('AC4: one strong match is chosen', () => withPlans({ 'roadmap-x-E7': { id: 'E7' }, 'outra-E8': { id: 'E8' } }, (root) => {
  const j = selectCli(root, '--query', 'e7');
  assert.equal(j.choice, 'docs/plans/roadmap-x-E7/plan.md');
  assert.equal(j.question, undefined);
  assert.deepEqual(selectPlan({ root, query: 'e7' }), { choice: 'docs/plans/roadmap-x-E7/plan.md' });
}));

test('AC4: two tied candidates return a question', () => withPlans({ 'a-E7': { id: 'E7' }, 'b-E7': { id: 'E7' } }, (root) => {
  const j = selectCli(root, '--query', 'E7');
  assert.equal(j.choice, undefined);
  assert.equal(typeof j.question, 'string');
  assert.deepEqual([...j.candidates].sort(), ['docs/plans/a-E7/plan.md', 'docs/plans/b-E7/plan.md']);
}));

test('select without query resumes the only run in progress', () => withPlans({ a: { id: 'A', status: 'in-progress' }, b: { id: 'B', status: 'completed' }, c: { id: 'C' } }, (root) => {
  assert.deepEqual(selectPlan({ root }), { choice: 'docs/plans/a/plan.md' });
}));

test('select without query and two runs in progress asks', () => withPlans({ a: { id: 'A', status: 'in-progress' }, b: { id: 'B', status: 'map-ready' } }, (root) => {
  const r = selectPlan({ root });
  assert.equal(r.choice, undefined);
  assert.equal(r.candidates.length, 2);
  assert.ok(r.question);
}));

test('select without query and a single plan without state chooses it', () => withPlans({ only: { id: 'O' } }, (root) => {
  assert.deepEqual(selectPlan({ root }), { choice: 'docs/plans/only/plan.md' });
}));

test('select with no candidates offers to write the plan', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-sel-'));
  try {
    const r = selectPlan({ root });
    assert.deepEqual(r.candidates, []);
    assert.match(r.question, /plan-writer/);
    assert.equal(r.choice, undefined);
    const q = selectPlan({ root, query: 'E7' });
    assert.deepEqual(q.candidates, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('weak matches are offered, never chosen', () => withPlans({ 'coordinator-mapa': { id: 'X1' }, 'outro': { id: 'X2' } }, (root) => {
  const r = selectPlan({ root, query: 'mapa' });
  assert.equal(r.choice, undefined);
  assert.deepEqual(r.candidates, ['docs/plans/coordinator-mapa/plan.md']);
  assert.ok(r.question);
}));

test('select skips node_modules and .git and exits 0 even for a question', () => withPlans({ 'node_modules/x': { id: 'N' }, '.git/y': { id: 'G' }, z: { id: 'Z' }, w: { id: 'W' } }, (root) => {
  const r = selectCli(root);
  assert.deepEqual([...r.candidates].sort(), ['docs/plans/w/plan.md', 'docs/plans/z/plan.md']);
}));

// --- Task 7: prosa do coordinator (critério 6) ---------------------------------------------

const skillDir = path.join(here, '..');
const walkFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (
  e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]
));
const skillFiles = () => walkFiles(skillDir);
const skillProse = () => skillFiles().filter((f) => f.endsWith('.md'));

test('AC6: no published file of the coordinator skill mentions the word', () => {
  const files = skillFiles();
  assert.ok(files.length > 0);
  for (const f of files) {
    const texto = fs.readFileSync(f, 'utf8');
    assert.ok(!texto.toLowerCase().includes('super' + 'powers'), f);
  }
});

test('AC6: executor prompt forbids asking the person', () => {
  const js = fs.readFileSync(path.join(skillDir, 'workflow', 'coordinator.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(
    js.includes("'- Never ask the person anything: if a decision is missing, stop and report BLOCKED with the question.'"),
    'literal Global Constraints line missing from the implementer prompt',
  );
});

test('skill files link only to existing references', () => {
  for (const f of skillProse()) {
    const texto = fs.readFileSync(f, 'utf8');
    assert.ok(!texto.includes('progress-template'), f + ' cites progress-template.md');
    for (const m of texto.matchAll(/references\/([A-Za-z0-9_.-]+\.md)/g)) {
      assert.ok(fs.existsSync(path.join(skillDir, 'references', m[1])), f + ' links to missing ' + m[1]);
    }
  }
  const skill = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
  assert.ok(skill.includes('references/state.md'));
  assert.ok(!skill.includes('Step lifecycle'));
  assert.ok(!fs.readFileSync(path.join(skillDir, 'references', 'delegation-protocol.md'), 'utf8').includes('Step lifecycle'));
});

test('no shipped coordinator file recommends bypassPermissions as default', () => {
  for (const f of skillProse()) {
    for (const linha of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (/bypassPermissions/i.test(linha)) {
        assert.ok(!/default|recommend/i.test(linha), f + ': ' + linha);
      }
    }
  }
});

// ---- final-fix: dependentes retidos voltam, portão de onda não é pulado ----

test('a waiting-manual dependent runs after its held upstream is resolved', () => {
  let s = run(
    wave2(),
    { type: 'hold', step: 2, text: 'pergunta' },
    { type: 'launch', steps: [3] }, { type: 'report', step: 3, value: 'pass' },
    { type: 'prelaunch-review', step: 5, value: 'pass' }, { type: 'authorize', step: 5 },
    { type: 'launch', steps: [5] }, { type: 'report', step: 5, value: 'pass' },
  );
  while (['review', 'wave-gate', 'advance'].includes(nextAction(s).action)) {
    const a = nextAction(s);
    if (a.action === 'review') s = ok(s, { type: 'review-result', step: a.step, value: 'pass' });
    else if (a.action === 'wave-gate') s = ok(s, { type: 'wave-gate', value: 'pass' });
    else s = ok(s, { type: 'advance' });
  }
  assert.equal(step(s, 6).status, 'waiting-manual');
  s = ok(s, { type: 'launch', steps: [4] });
  s = ok(s, { type: 'answer', step: 2, value: 'value' });
  assert.notEqual(step(s, 6).status, 'waiting-manual', 'T6 released once T2 is no longer held');
  s = ok(s, { type: 'report', step: 4, value: 'pass' });
  s = ok(s, { type: 'launch', steps: [2] });
  s = ok(s, { type: 'report', step: 2, value: 'pass' });
  for (let i = 0; i < 12 && nextAction(s).action !== 'launch'; i++) {
    const a = nextAction(s);
    if (a.action === 'review') s = ok(s, { type: 'review-result', step: a.step, value: 'pass' });
    else if (a.action === 'wave-gate') s = ok(s, { type: 'wave-gate', value: 'pass' });
    else if (a.action === 'advance') s = ok(s, { type: 'advance' });
    else assert.fail('unexpected ' + JSON.stringify(a));
  }
  const a = nextAction(s);
  assert.equal(a.action, 'launch');
  assert.deepEqual(a.steps.map((x) => x.n), [6]);
});

test('a wave settled only by hold or refusal still owes its gate', () => {
  let s = run(
    wave2(),
    { type: 'launch', steps: [2] }, { type: 'report', step: 2, value: 'pass' },
    { type: 'hold', step: 3, text: 'x' },
  );
  assert.equal(s.run.waveGateOwed, null, 'T5 still pending');
  s = ok(s, { type: 'hold', step: 5, text: 'y' });
  assert.equal(s.run.waveGateOwed, 2);
  assert.equal(nextAction(s).action, 'wave-gate');
  refused(s, { type: 'advance' }, 'gate-owed');
  s = ok(s, { type: 'wave-gate', value: 'pass' });
  assert.equal(s.run.waveGateOwed, null);
});

test('a later wave keeps its gate when an earlier wave is reopened', () => {
  let s = run(
    wave2(),
    { type: 'hold', step: 2, text: 'pergunta' },
    { type: 'launch', steps: [3] }, { type: 'report', step: 3, value: 'pass' },
    { type: 'prelaunch-review', step: 5, value: 'pass' }, { type: 'authorize', step: 5 },
    { type: 'launch', steps: [5] }, { type: 'report', step: 5, value: 'pass' },
  );
  while (['review', 'wave-gate', 'advance'].includes(nextAction(s).action)) {
    const a = nextAction(s);
    if (a.action === 'review') s = ok(s, { type: 'review-result', step: a.step, value: 'pass' });
    else if (a.action === 'wave-gate') s = ok(s, { type: 'wave-gate', value: 'pass' });
    else s = ok(s, { type: 'advance' });
  }
  s = ok(s, { type: 'launch', steps: [4] });
  s = ok(s, { type: 'answer', step: 2, value: 'value' });
  s = ok(s, { type: 'report', step: 4, value: 'pass' });
  s = ok(s, { type: 'launch', steps: [2] });
  s = ok(s, { type: 'report', step: 2, value: 'pass' });
  const seen = [];
  for (let i = 0; i < 12; i++) {
    const a = nextAction(s);
    if (a.action === 'launch') break;
    if (a.action === 'review') s = ok(s, { type: 'review-result', step: a.step, value: 'pass' });
    else if (a.action === 'wave-gate') { seen.push(a.wave); s = ok(s, { type: 'wave-gate', value: 'pass' }); }
    else s = ok(s, { type: 'advance' });
  }
  assert.ok(seen.includes(2) && seen.includes(3), 'gates for wave 2 and wave 3: ' + seen);
});

test('initState records files and noCommit of each task', () => {
  const r = emitPlan(planText, { planPath });
  const s = initState(r.out, { planPath: 'plan.md', now: NOW });
  for (const t of r.out.plan.tasks) {
    const expected = [...new Set([...t.files.create, ...t.files.modify, ...t.files.test])];
    assert.deepEqual(step(s, t.n).files, expected);
    assert.equal(step(s, t.n).noCommit, t.noCommit === true);
  }
  const synthetic = structuredClone(r.out);
  synthetic.plan.tasks[0].files = { create: ['a.txt', 'b.txt'], modify: ['b.txt', 'c.txt'], test: ['a.txt', 'd.txt'] };
  delete synthetic.plan.tasks[0].noCommit;
  synthetic.plan.tasks[1].noCommit = true;
  const s2 = initState(synthetic, { now: NOW });
  assert.deepEqual(s2.steps[0].files, ['a.txt', 'b.txt', 'c.txt', 'd.txt']);
  assert.equal(s2.steps[0].noCommit, false);
  assert.equal(s2.steps[1].noCommit, true);
});

test('rerun keeps files and noCommit on the new step', () => {
  const s = stateFor();
  const c = structuredClone(s);
  step(c, 5).files = ['x.txt', 'y.txt'];
  step(c, 5).noCommit = true;
  step(c, 5).status = 'stopped';
  c.run.status = 'in-progress';
  c.manual.push({ kind: 'open-question', step: 5, text: 't', open: true });
  const r = ok(c, { type: 'answer', step: 5, value: 'rerun' });
  const n7 = step(r, 7);
  assert.deepEqual(n7.files, ['x.txt', 'y.txt']);
  assert.equal(n7.noCommit, true);
});

test('rerun reuses the brief of the step it replaces, since no brief exists for the new number', () => {
  const c = structuredClone(stateFor());
  step(c, 5).status = 'stopped';
  c.run.status = 'in-progress';
  c.manual.push({ kind: 'open-question', step: 5, text: 't', open: true });
  const r = ok(c, { type: 'answer', step: 5, value: 'rerun' });
  assert.equal(step(r, 7).brief, step(r, 5).brief);
  assert.equal(step(r, 7).brief, 'briefs/T5.md');
});

test('baseline event records run.baseline', () => {
  assert.ok(EVENT_TYPES.includes('baseline'));
  const s = started();
  const b = { type: 'baseline', test: 'npm t', exit: 1, tail: 'x', failedNames: ['a', 'b'] };
  const r = ok(s, b);
  assert.deepEqual(r.run.baseline, { test: 'npm t', exit: 1, tail: 'x', failedNames: ['a', 'b'] });
  assert.equal(r.run.test, 'npm t');
  const withTest = ok({ ...structuredClone(s), run: { ...s.run, test: 'keep' } }, b);
  assert.equal(withTest.run.test, 'keep');
  refused(s, { ...b, exit: 'x' }, 'wrong-status');
  refused(s, { ...b, exit: 1.5 }, 'wrong-status');
  refused(s, { ...b, failedNames: 'a' }, 'wrong-status');
  refused(s, { ...b, failedNames: ['a', 2] }, 'wrong-status');
});

test('report pass keeps the handoff field', () => {
  const l = ok(wave2(), { type: 'launch', steps: [2] });
  const withHandoff = ok(l, { type: 'report', step: 2, value: 'pass', handoff: 'next: do Y' });
  assert.equal(step(withHandoff, 2).handoff, 'next: do Y');
  const without = ok(l, { type: 'report', step: 2, value: 'pass' });
  assert.equal(step(without, 2).handoff, null);
});

test('applyEvents applies a batch atomically', () => {
  const s = mapReady();
  const before = structuredClone(s);
  const good = applyEvents(s, [{ type: 'approve-map' }, { type: 'block', text: 'q' }, { type: 'unblock', at: T1 }], T0);
  assert.equal(good.ok, true);
  assert.equal(good.state.run.status, 'in-progress');
  assert.equal(good.state.history.at(-1).at, T1);
  assert.equal(good.state.history.at(-2).at, T0);
  assert.deepEqual(s, before);
  const bad = applyEvents(s, [{ type: 'approve-map' }, { type: 'approve-map' }, { type: 'block' }], T0);
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'wrong-status');
  assert.equal(bad.index, 1);
  assert.equal(bad.state, undefined);
  assert.deepEqual(s, before);
});

// ---------------------------------------------------------------------------
// E12 T3: token, read e apply --events assinados
// ---------------------------------------------------------------------------
import { fnv1a, canon } from '../../../lib/plan-digest.mjs';
import { stateDigest } from './progress.mjs';

const signDigest = (o) => fnv1a(JSON.stringify(canon(o)));
const payloadOf = (expect, events, digestOverride) => {
  const body = { expect, events };
  return encodeURIComponent(JSON.stringify({ ...body, digest: digestOverride ?? signDigest(body) }));
};
function initSandbox(sb) {
  const r = cli(['init', sb.plan]);
  assert.equal(r.code, 0, r.err);
}

test('token prints a fresh random token', () => {
  const a = cli(['token']);
  const b = cli(['token']);
  assert.equal(a.code, 0, a.err);
  assert.match(a.out.trim(), /^[0-9a-f]{32}$/);
  assert.match(b.out.trim(), /^[0-9a-f]{32}$/);
  assert.notEqual(a.out.trim(), b.out.trim());
});

test('read prints the signed state', () => withSandbox((sb) => {
  initSandbox(sb);
  const r = cli(['read', sb.state, '--nonce', 'N', '--json']);
  assert.equal(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  assert.equal(j.tool, 'progress');
  assert.equal(j.command, 'read');
  assert.equal(j.nonce, 'N');
  assert.equal(typeof j.now, 'string');
  assert.equal(path.resolve(j.root), path.resolve(sh(sb.dir, 'git', ['rev-parse', '--show-toplevel'])));
  assert.equal(j.planChanged, false);
  assert.deepEqual(j.state.history, []);
  const { digest, ...rest } = j;
  assert.equal(digest, signDigest(rest));
  fs.appendFileSync(sb.plan, '\nmudou\n');
  const j2 = JSON.parse(cli(['read', sb.state, '--nonce', 'N', '--json']).out);
  assert.equal(j2.planChanged, true);
}));

// A state of 60 passed steps with long notes: the pretty-printed read was 100 KB, the Bash tool spills anything above 30 KB.
function bigState(sb) {
  const st = readJson(sb.state);
  const base = st.steps[0];
  st.steps = Array.from({ length: 60 }, (_, i) => ({ ...base, n: i + 1, title: 't' + (i + 1), files: ['src/a' + i + '.mjs', 'tests/a' + i + '.test.mjs'], status: 'pass', note: 'n'.repeat(400), handoff: 'h'.repeat(500), sha: 'a'.repeat(40) }));
  writeJson(sb.state, st);
  return st;
}

test('read of a big state stays under 30000 bytes per page, pages are signed and add up to the signed state digest', () => withSandbox((sb) => {
  initSandbox(sb);
  const st = bigState(sb);
  const first = cli(['read', sb.state, '--nonce', 'N', '--json']);
  assert.equal(first.code, 0, first.err);
  const j = JSON.parse(first.out);
  assert.ok(j.pages > 1, 'a big state comes in pages: ' + j.pages);
  const steps = [];
  for (let k = 0; k < j.pages; k++) {
    const r = k === 0 ? first : cli(['read', sb.state, '--nonce', 'N' + k, '--page', String(k), '--json']);
    assert.equal(r.code, 0, r.err);
    assert.ok(Buffer.byteLength(r.out) < 30000, 'page ' + k + ' has ' + Buffer.byteLength(r.out) + ' bytes');
    const p = JSON.parse(r.out);
    const { digest, ...rest } = p;
    assert.equal(digest, signDigest(rest), 'page ' + k + ' is signed');
    assert.equal(p.page, k);
    assert.equal(p.stateDigest, j.stateDigest);
    steps.push(...(k === 0 ? p.state.steps : p.steps));
  }
  assert.deepEqual(steps.map((x) => x.n), st.steps.map((x) => x.n), 'every step, in order');
  assert.equal(stateDigest({ ...j.state, steps }), j.stateDigest);
  assert.equal(j.stateDigest, stateDigest(st));
  assert.equal(cli(['read', sb.state, '--nonce', 'N', '--page', String(j.pages), '--json']).code, 2);
}));

test('read of a small state is one page with the whole state', () => withSandbox((sb) => {
  initSandbox(sb);
  const j = JSON.parse(cli(['read', sb.state, '--nonce', 'N', '--json']).out);
  assert.equal(j.pages, 1);
  assert.equal(j.page, 0);
  assert.deepEqual(j.state.steps, readJson(sb.state).steps);
  assert.equal(j.stateDigest, stateDigest(readJson(sb.state)));
}));

test('apply --events writes a batch and signs the result', () => withSandbox((sb) => {
  initSandbox(sb);
  const before = readJson(sb.state);
  const expect = stateDigest(before);
  const events = [{ type: 'approve-map' }];
  const r = cli(['apply', sb.state, '--events', payloadOf(expect, events), '--nonce', 'N9']);
  assert.equal(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  const after = readJson(sb.state);
  assert.equal(after.history.length, before.history.length + 1);
  assert.equal(j.tool, 'progress');
  assert.equal(j.command, 'apply');
  assert.equal(j.nonce, 'N9');
  assert.equal(j.ok, true);
  assert.equal(j.code, null);
  assert.ok(j.action && typeof j.action === 'object');
  assert.equal(j.stateDigest, signDigest({ ...after, history: [] }));
  const { digest, ...rest } = j;
  assert.equal(digest, signDigest(rest));
}));

test('apply --events refuses without writing', () => withSandbox((sb) => {
  initSandbox(sb);
  const bytes = fs.readFileSync(sb.state);
  const expect = stateDigest(readJson(sb.state));
  const good = [{ type: 'approve-map' }];
  const bad = cli(['apply', sb.state, '--events', payloadOf(expect, good, 'deadbeef'), '--nonce', 'N']);
  assert.equal(bad.code, 2);
  assert.ok(fs.readFileSync(sb.state).equals(bytes));
  const conc = cli(['apply', sb.state, '--events', payloadOf('outro', good), '--nonce', 'N']);
  assert.equal(JSON.parse(conc.out).code, 'concurrent-change');
  assert.equal(JSON.parse(conc.out).ok, false);
  assert.ok(fs.readFileSync(sb.state).equals(bytes));
  const ref = cli(['apply', sb.state, '--events', payloadOf(expect, [{ type: 'approve-map' }, { type: 'report', step: 1, value: 'pass' }]), '--nonce', 'N']);
  const jr = JSON.parse(ref.out);
  assert.equal(jr.ok, false);
  assert.ok(typeof jr.code === 'string' && jr.code !== 'concurrent-change');
  assert.ok(fs.readFileSync(sb.state).equals(bytes));
}));

test('baseline event accepts failedNamesCut', () => {
  const s = started();
  const b = { type: 'baseline', test: 'npm t', exit: 1, tail: 'x', failedNames: ['a'] };
  assert.equal(ok(s, { ...b, failedNamesCut: 3 }).run.baseline.failedNamesCut, 3);
  assert.equal('failedNamesCut' in ok(s, b).run.baseline, false);
  refused(s, { ...b, failedNamesCut: 1.5 }, 'wrong-status');
  refused(s, { ...b, failedNamesCut: -1 }, 'wrong-status');
  refused(s, { ...b, failedNamesCut: 'x' }, 'wrong-status');
});

// ---------------------------------------------------------------------------
// Preparo de E11 T-A2: a página 0 conta o estado-base
// ---------------------------------------------------------------------------
import { readPages, READ_PAGE_CHARS } from './progress.mjs';

test('page 0 may leave empty when the state alone fills it', () => {
  const big = { n: 1, note: 'x'.repeat(19000) };
  const pages = readPages([big], 8000);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0], []);
  assert.deepEqual(pages[1], [big]);
});

test('page 0 output stays under READ_PAGE_CHARS', () => withSandbox((sb) => {
  initSandbox(sb);
  const st = bigState(sb);
  st.manual = [{ kind: 'note', step: 1, text: 'm'.repeat(12000), open: false }];
  writeJson(sb.state, st);
  const r = cli(['read', sb.state, '--nonce', 'N', '--json']);
  assert.equal(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  assert.ok(j.pages > 1);
  assert.ok(r.out.length < READ_PAGE_CHARS + 1500, 'page 0 has ' + r.out.length + ' characters');
}));

test('readPages without baseSize is unchanged', () => {
  const steps = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, note: 'y'.repeat(1000) }));
  const a = readPages(steps);
  assert.deepEqual(a, readPages(steps, 0));
  assert.ok(a.length > 1);
  assert.ok(a[0].length > 0);
  for (const p of a) assert.ok(JSON.stringify(p).length <= READ_PAGE_CHARS + 100);
});

test('read pagination does not depend on the nonce length', () => withSandbox((sb) => {
  initSandbox(sb);
  for (let pad = 0; pad <= 40; pad++) {
    const st = bigState(sb);
    st.manual = [{ kind: 'note', step: 1, text: 'm'.repeat(9000 + pad), open: false }];
    writeJson(sb.state, st);
    const first = JSON.parse(cli(['read', sb.state, '--nonce', 'a'.repeat(32), '--json']).out);
    const steps = first.state.steps.slice();
    for (let k = 1; k < first.pages; k++) {
      steps.push(...JSON.parse(cli(['read', sb.state, '--nonce', 'abcd1234-2', '--page', String(k), '--json']).out).steps);
    }
    assert.deepEqual(steps.map((x) => x.n), st.steps.map((x) => x.n), 'pad ' + pad);
  }
}));
