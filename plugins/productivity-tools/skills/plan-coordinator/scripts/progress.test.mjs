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
  assert.equal(EVENT_TYPES.length, 21);
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
  assert.deepEqual(nextAction(review), { action: 'review', step: 1, reviewTier: step(review, 1).reviewTier });

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
