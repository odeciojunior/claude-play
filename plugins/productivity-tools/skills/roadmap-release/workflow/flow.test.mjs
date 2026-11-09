import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8').replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC);

const GATES = [{ name: 'lint', cmd: 'npm run lint', kind: 'exit' }, { name: 'unit', cmd: 'npm test', kind: 'tests', needsLock: 'db' }];
const gm = (head, over = {}) => ({ headSha: head, clean: true, changedFiles: ['src/a.js'], log: '', gates: [{ name: 'lint', ran: true, exit: 0 }, { name: 'unit', ran: true, exit: 0, total: 10, skipped: 0, failedNames: [], ...over }] });
const card = (id, extra = {}) => ({ id, deps: [], reqs: ['R1'], status: 'pronta', onTarget: false, critical: false, acceptance: [{ id: 'AC1', text: 'works' }], ...extra });

// over(label, prompt, opts) may return a value (including null) to override the default answer.
async function exec({ cards, over, deliverables, config = {} }) {
  const calls = [];
  const agent = async (prompt, o) => {
    const l = o.label;
    calls.push({ label: l, prompt, opts: o });
    if (over) { const v = over(l, prompt, o); if (v !== undefined) return v; }
    const E = (/^(E\d+):/.exec(l) || [])[1];
    if (l === 'discovery') return { repo: '/r', today: '2026-11-09', wtRoot: '/wt/', roadmapDir: 'docs/plans/roadmap-x/', strategy: 'docs/plans/roadmap-x/s.md', checker: 'docs/plans/roadmap-x/check.mjs', integrationBranch: 'main', target: 'integracao/x', trackerAvailable: true, checkerExists: true, roadmapSlug: 'x', deliverableStatuses: ['a', 'b', 'c', 'd', 'e'], cards };
    if (l === 'preflight') return { ok: true, integrationWorktree: '/wt/_integracao', targetHead: 'abc1234', clean: true, envFacts: 'x', baseline: gm('abc1234') };
    if (/:setup$/.test(l)) return { ok: true, worktree: `/wt/${E}`, baseCommit: 'b1', head: 'h1', clean: true };
    if (/:spec$/.test(l)) return { specPath: 'docs/s.md', slug: 'x', decisions: ['d'], humanInputs: [] };
    if (/:plan$/.test(l)) return { planPath: 'docs/p.md', roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a' }], tasks: [{ n: 1, title: 't', tier: 'sonnet' }] };
    if (/spec-review|plan-review|:t1:spec|:t1:quality|:final-/.test(l)) return { issues: [], headSha: 'h1', clean: true, commitsInRange: 2 };
    if (/:impl$/.test(l)) return { status: 'DONE', summary: 's', checks: [{ command: 'x', output: 'y', exit: 0 }] };
    if (/:status-/.test(l)) return { checkerErrors: 0, statusWritten: 'x', head: 'abc1234' };
    if (/:progress$/.test(l)) return { head: 'h0', clean: true, done: [] };
    if (/:sync$/.test(l)) return { ok: true, head: 'h2', conflictsResolved: 0, targetTip: 'abc1234', deltaFiles: [] };
    if (/:resync$/.test(l)) return { ok: true, head: 'h2', conflictsResolved: 0, targetTip: 'def5678', deltaFiles: ['src/x.js'] };
    if (/:test-integrity$/.test(l)) return { deletedTests: [], removedAsserts: 0, skipsAdded: 0, prodChanged: 1, assertsAdded: 1 };
    if (/merge-gates/.test(l)) return gm('m1');
    if (/gates\d/.test(l) && !/fix/.test(l)) return gm(/:regates/.test(l) ? 'h3' : 'h2');
    if (/:evidence/.test(l)) return { headSha: /:evidence1/.test(l) ? 'h2' : 'h3', clean: true, results: [{ ac: 'AC1', command: 'npm test -- a', exit: 0 }] };
    if (/:pre-merge$/.test(l)) return { head: 'abc1234', clean: true, branchHasTarget: false, branchMerged: false };
    if (/:delta-review/.test(l)) return { issues: [], headSha: 'h3', clean: true, commitsInRange: 0 };
    if (/:merge$/.test(l)) return { mergeCommit: 'm1', firstParent: 'abc1234', secondParent: 'h3', conflicts: 0, clean: true };
    if (/:docs\d$/.test(l)) return { statusWritten: 'x' };
    if (/:docs-measure/.test(l)) return { checkerErrors: 0, clean: true, head: 'm2' };
    if (/:cleanup$/.test(l)) return { ok: true };
    if (/:rollback/.test(l)) return { ok: true, head: 'abc1234', clean: true };
    if (l === 'git-truth') return { targetHead: 'm2', clean: true, lastGoodReachable: true, mergedIds: ['E1'], claims: [{ id: 'E1', commit: 'm1', reachable: true }] };
    if (l === 'report') return 'REPORT';
    if (/review-log/.test(l)) return 'ok';
    throw new Error('unmocked ' + l);
  };
  const parallel = (ts) => Promise.all(ts.map((t) => t().catch(() => null)));
  const r = await run({ config: { gates: GATES, locks: ['db'], projectContext: '', install: 'npm ci', generated: true, ...config }, deliverables, targetBranch: 'integracao/x', today: '2026-11-09' },
    agent, parallel, () => {}, () => {}, { total: null });
  return { r, calls, labels: calls.map((c) => c.label) };
}

test('happy path merges, persists the log before the re-sync gates, and cleanup is scoped', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(r.results[0].merged, true);
  assert.ok(labels.indexOf('E1:review-log-resync') > labels.indexOf('E1:delta-review1'));
  assert.ok(labels.indexOf('E1:review-log-resync') < labels.indexOf('E1:regates1-1'));
  const clean = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.match(clean, /_tmp\/E1-\*/);
  assert.doesNotMatch(clean, /_tmp\/E1\*/);
  assert.match(clean, /-dirty/);
  assert.match(clean, /diff --binary HEAD/);
});

test('sync schema requires deltaFiles and targetTip', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const sync = calls.find((c) => c.label === 'E1:sync').opts.schema;
  assert.ok(sync.required.includes('deltaFiles') && sync.required.includes('targetTip'));
});

test('a merge whose second parent is not the validated head is rolled back', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (/:merge$/.test(l) ? { mergeCommit: 'm1', firstParent: 'abc1234', secondParent: 'zzz9999', conflicts: 0, clean: true } : undefined) });
  assert.equal(r.results[0].merged, false);
  assert.match(r.results[0].error, /second parent/);
  assert.ok(labels.includes('E1:rollback'));
});

test('gates-fix review is logged and the log is committed before re-measuring', async () => {
  let n = 0;
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => {
      if (l === 'E1:gates1-1' && n++ === 0) return gm('h2', { exit: 1, failedNames: ['new'] });
      if (l === 'E1:gates-fix1') return { status: 'DONE', summary: 'f', checks: [] };
      if (l === 'E1:gates-fix1-review') return { issues: [{ severity: 'minor', description: 'm' }], headSha: 'h2b', clean: true, commitsInRange: 1 };
      if (l === 'E1:gates2-1') return gm('h2c');
      if (l === 'E1:evidence2') return { headSha: 'h2c', clean: true, results: [{ ac: 'AC1', command: 'npm test -- a', exit: 0 }] };
      return undefined;
    } });
  assert.equal(r.results[0].merged, true);
  const fixAt = labels.indexOf('E1:gates-fix1-review');
  assert.ok(labels.indexOf('E1:review-log-gates') > fixAt);
  assert.ok(labels.indexOf('E1:review-log-gates') < labels.indexOf('E1:gates2-1'));
});

test('a null review-log agent is recorded as a concern', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/review-log/.test(l) ? null : undefined) });
  assert.ok(r.results[0].concerns.some((c) => /review log/.test(c)));
});

test('finish-merge: unvalidated merge on the target sets integBroken, is reported merged, and stops later merges', async () => {
  const unfinished = card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'm0' });
  const { r } = await exec({ cards: [unfinished, card('E2')], deliverables: ['E1', 'E2'],
    over: (l) => {
      if (/^E1:merge-gates1/.test(l)) return gm('m0', { exit: 1, failedNames: ['new'] });
      if (l === 'E1:merge-fix') return null;
      return undefined;
    } });
  const e1 = r.results.find((x) => x.id === 'E1');
  const e2 = r.results.find((x) => x.id === 'E2');
  assert.equal(e1.merged, true);
  assert.equal(e1.broken, true);
  assert.equal(e2.merged, false);
  assert.ok(e2.skipped);
  assert.ok(r.operatorActions.some((o) => o.deliverable === 'E1'));
});

test('git truth requires lastGoodReachable', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (l === 'git-truth' ? { targetHead: 'm2', clean: true, mergedIds: ['E1'], claims: [{ id: 'E1', commit: 'm1', reachable: true }] } : undefined) });
  assert.ok(r.operatorActions.some((o) => o.kind === 'divergence' && /validated tip/.test(o.what)));
});
