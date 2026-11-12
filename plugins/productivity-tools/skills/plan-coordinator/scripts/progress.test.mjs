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
