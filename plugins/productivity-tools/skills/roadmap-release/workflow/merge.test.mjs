import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPure } from './load-pure.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { needsDeltaReview, measureProblems, gateGroups, refreshBaseline, integrityAlerts, gateSummary, postMergeFixArgs, postMergeFixes, integrityHardAlerts, integrityHeuristicAlerts, integrityAckMatches } = loadPure();
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

const { mergeParentsOk, truthDivergences } = loadPure();

test('needsDeltaReview: a missing file list needs review (fail closed); an empty list does not', () => {
  assert.equal(needsDeltaReview(undefined, RM, ['docs/']), true);
  assert.equal(needsDeltaReview(null, RM, ['docs/']), true);
  assert.equal(needsDeltaReview([], RM, ['docs/']), false);
});

test('mergeParentsOk requires first parent = pre-merge sha and second parent = validated sha', () => {
  const mg = { mergeCommit: 'm1', firstParent: 'abc1234', secondParent: 'h3' };
  assert.equal(mergeParentsOk(mg, 'abc1234', 'h3'), true);
  assert.equal(mergeParentsOk(mg, 'abc', 'h3'), true);
  assert.equal(mergeParentsOk(mg, 'abc1234', 'h4'), false);
  assert.equal(mergeParentsOk(mg, 'fff', 'h3'), false);
  assert.equal(mergeParentsOk({ mergeCommit: 'm1' }, 'abc1234', 'h3'), false);
  assert.equal(mergeParentsOk(null, 'abc1234', 'h3'), false);
});

test('truthDivergences: requires lastGoodReachable, flags not-merged ids present on the target', () => {
  const slim = [{ id: 'E1', merged: true }, { id: 'E2', merged: false }];
  const ok = { clean: true, lastGoodReachable: true, mergedIds: ['E1'], claims: [{ id: 'E1', commit: 'm1', reachable: true }] };
  const claims = [{ id: 'E1', commit: 'm1' }];
  const d = (t, broken = false) => truthDivergences(t, slim, claims, 'T', 'lg', broken).length;
  assert.equal(d(ok), 0);
  assert.equal(d(null), 1);
  assert.equal(d({ ...ok, lastGoodReachable: undefined }), 1);
  assert.equal(d({ ...ok, lastGoodReachable: false }), 1);
  assert.equal(d({ ...ok, mergedIds: ['E1', 'E2'] }), 1);
  assert.equal(d({ ...ok, mergedIds: [] }), 1);
  assert.equal(d({ ...ok, claims: [] }), 1);
  assert.equal(d({ ...ok, clean: false }), 1);
  assert.equal(d({ ...ok, clean: false }, true), 0);
});

test('postMergeFixes drops only subjects with another deliverable prefix', () => {
  const c = (subject) => ({ sha: 'x', subject });
  assert.deepEqual(postMergeFixes([c('E2 merge-fix: y'), c('E1 T1: z'), c('hotfix'), c('E10 x'), c('E1x y')], 'E1').map((x) => x.subject), ['E1 T1: z', 'hotfix', 'E1x y']);
});

test('postMergeFixArgs finds an unprefixed fix on a real repo and ignores merges and docs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pmf-'));
  const git = (...x) => execFileSync('git', x, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const put = (f) => { mkdirSync(join(dir, f, '..'), { recursive: true }); writeFileSync(join(dir, f), 'x'); git('add', '-A'); };
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 'a@b.c'); git('config', 'user.name', 'a');
  put('a.js'); git('commit', '-qm', 'base');
  git('checkout', '-qb', 'e1'); put('b.js'); git('commit', '-qm', 'E1 T1: b');
  git('checkout', '-q', 'main'); git('merge', '-q', '--no-ff', 'e1', '-m', 'merge: E1');
  const merge = git('rev-parse', 'HEAD').trim();
  put('c.js'); git('commit', '-qm', 'hotfix the parser');
  put('docs/plans/roadmap-x/s.md'); git('commit', '-qm', 'docs only');
  git('checkout', '-qb', 'e2'); put('d.js'); git('commit', '-qm', 'E2 T1: d');
  git('checkout', '-q', 'main'); git('merge', '-q', '--no-ff', 'e2', '-m', 'merge: E2');
  const subjects = git(...postMergeFixArgs(merge, RM, ['docs/'])).split('\n').filter(Boolean).map((l) => l.split('\t')[1]);
  assert.deepEqual(subjects, ['hotfix the parser']);
});

test('integrity alerts split into hard and heuristic', () => {
  const i = { deletedTests: ['a'], removedAsserts: 1, skipsAdded: 1, prodChanged: 1, assertsAdded: 0 };
  assert.equal(integrityHardAlerts(i).length, 3);
  assert.equal(integrityHeuristicAlerts(i).length, 1);
  assert.equal(integrityAlerts(i).length, 4);
  assert.deepEqual(integrityHardAlerts({ ...i, removedAsserts: -1 }), []);
  assert.deepEqual(integrityHeuristicAlerts(null), []);
});

test('integrityAckMatches needs the exact deliverable and SHA', () => {
  assert.equal(integrityAckMatches({ E1: 'abc' }, 'E1', 'abc'), true);
  for (const [a, e, s] of [[{ E1: 'abc' }, 'E1', 'abd'], [{ E1: 'abc' }, 'E2', 'abc'], [{ E1: 'ab' }, 'E1', 'abc'], [null, 'E1', 'abc'], [{ E1: true }, 'E1', 'abc'], [{ E1: '' }, 'E1', '']]) {
    assert.equal(integrityAckMatches(a, e, s), false);
  }
});
