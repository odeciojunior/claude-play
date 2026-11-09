import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPure } from './load-pure.mjs';

const { needsDeltaReview, measureProblems, gateGroups, refreshBaseline, integrityAlerts, gateSummary } = loadPure();
const RM = 'docs/plans/roadmap-x/';
const res = (name, o = {}) => ({ name, ran: true, exit: 0, total: 10, skipped: 0, failedNames: [], ...o });

test('needsDeltaReview: false for an empty or docs/roadmap-only delta', () => {
  assert.equal(needsDeltaReview([], RM, ['docs/']), false);
  assert.equal(needsDeltaReview(['docs/a.md', RM + 'state.md'], RM, ['docs/']), false);
  assert.equal(needsDeltaReview([RM + 'state.md'], RM, []), false);
});

test('needsDeltaReview: true with any other file', () => {
  assert.equal(needsDeltaReview(['docs/a.md', 'src/x.js'], RM, ['docs/']), true);
  assert.equal(needsDeltaReview(['src/x.js'], RM, ['docs/']), true);
  assert.equal(needsDeltaReview(['docsx/a.md'], RM, ['docs/']), true);
  assert.equal(needsDeltaReview(['docs/a.md'], RM, []), true);
  assert.equal(needsDeltaReview(null, RM, ['docs/']), false);
});

test('measureProblems names the offending gate and the tree/sha problems', () => {
  const defs = [{ name: 'unit', kind: 'tests' }, { name: 'lint', kind: 'exit' }];
  const m = { headSha: 'abc1234', clean: true, gates: [res('unit', { exit: 1 })] };
  const p = measureProblems(m, 'abc1234', defs);
  assert.equal(p.length, 2);
  assert.match(p.join('|'), /unit/);
  assert.match(p.join('|'), /lint/);
  assert.deepEqual(measureProblems({ headSha: 'abc1234', clean: true, gates: [res('unit'), res('lint')] }, 'abc', defs), []);
  assert.match(measureProblems({ headSha: 'abc', clean: false, gates: [] }, 'fff', []).join('|'), /dirty/);
  assert.match(measureProblems({ headSha: 'abc', clean: true, gates: [] }, 'fff', []).join('|'), /commit/);
  assert.equal(measureProblems(null, 'a', defs).length, 1);
});

test('gateGroups: one group without lock, one per distinct lock set (order-insensitive)', () => {
  const defs = [{ name: 'a' }, { name: 'b', needsLock: 'db' }, { name: 'c', needsLock: ['db'] }, { name: 'd', needsLock: ['x', 'db'] }, { name: 'e', needsLock: ['db', 'x'] }];
  const g = gateGroups(defs);
  assert.equal(g.length, 3);
  assert.deepEqual(g[0].defs.map(d => d.name), ['a']);
  assert.deepEqual(g[0].locks, []);
  assert.deepEqual(g[1].defs.map(d => d.name), ['b', 'c']);
  assert.deepEqual(g[2].defs.map(d => d.name), ['d', 'e']);
  assert.deepEqual(gateGroups([]), []);
});

test('refreshBaseline replaces measured gates, keeps others, never mutates, applies ignore rules', () => {
  const smoke = { name: 'smoke', kind: 'tests', ignoreFailuresWhenChanged: { paths: ['fn/'], failurePrefix: 's:' } };
  const unit = { name: 'unit', kind: 'tests' };
  const base = { unit: res('unit', { total: 5 }), smoke: res('smoke'), keep: res('keep') };
  const m = { gates: [res('unit', { total: 9 }), res('smoke', { exit: 1, failedNames: ['s:a'] })] };
  const nb = refreshBaseline(base, [unit, smoke], m, ['fn/x']);
  assert.equal(nb.unit.total, 9);
  assert.equal(nb.smoke.exit, 0);
  assert.deepEqual(nb.smoke.failedNames, []);
  assert.ok(nb.keep);
  assert.equal(base.unit.total, 5);
  assert.equal(refreshBaseline(base, [unit], { gates: [] }, []).unit.total, 5);
});

test('integrityAlerts: empty when unmeasured, lists each weakening signal', () => {
  assert.deepEqual(integrityAlerts(null), []);
  assert.deepEqual(integrityAlerts({ removedAsserts: -1 }), []);
  const a = integrityAlerts({ deletedTests: ['t.test.js'], removedAsserts: 2, skipsAdded: 1, prodChanged: 3, assertsAdded: 0 });
  assert.equal(a.length, 4);
  assert.deepEqual(integrityAlerts({ deletedTests: [], removedAsserts: 0, skipsAdded: 0, prodChanged: 1, assertsAdded: 2 }), []);
});

test('gateSummary shows each gate against its baseline and handles a null measure', () => {
  const defs = [{ name: 'unit', kind: 'tests' }];
  const s = gateSummary(defs, { gates: [res('unit', { total: 7 })] }, { unit: res('unit', { total: 5 }) });
  assert.match(s, /unit/);
  assert.match(s, /total 7/);
  assert.match(s, /total 5/);
  assert.match(gateSummary(defs, null, {}), /not measured/);
});
