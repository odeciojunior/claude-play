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
const card = (id, extra = {}) => ({ id, deps: [], reqs: ['R1'], status: 'pronta', onTarget: false, mergeFound: false, critical: false, acceptance: [{ id: 'AC1', text: 'works' }], ...extra });

// over(label, prompt, opts) may return a value (including null) to override the default answer.
async function exec({ cards, over, deliverables, config = {}, args = {}, discOver = {} }) {
  const calls = [];
  const agent = async (prompt, o) => {
    const l = o.label;
    calls.push({ label: l, prompt, opts: o });
    if (over) { const v = over(l, prompt, o); if (v !== undefined) return v; }
    const E = (/^(E\d+):/.exec(l) || [])[1];
    if (l === 'discovery') return { repo: '/r', today: '2026-11-09', wtRoot: '/wt/', roadmapDir: 'docs/plans/roadmap-x/', strategy: 'docs/plans/roadmap-x/s.md', checker: 'docs/plans/roadmap-x/check.mjs', integrationBranch: 'main', target: 'integracao/x', trackerAvailable: true, checkerExists: true, roadmapSlug: 'x', deliverableStatuses: ['a', 'b', 'c', 'd', 'e'], cards, ...discOver };
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
    if (/test-integrity$/.test(l)) return { deletedTests: [], removedAsserts: 0, skipsAdded: 0, prodChanged: 1, assertsAdded: 1 };
    if (/merge-gates/.test(l)) return gm('m1');
    if (/gates\d/.test(l) && !/fix/.test(l)) return gm(/:regates/.test(l) ? 'h3' : 'h2');
    if (/:evidence/.test(l)) return { headSha: /:evidence1/.test(l) ? 'h2' : 'h3', clean: true, results: [{ ac: 'AC1', command: 'npm test -- a', exit: 0 }] };
    if (/:pre-merge$/.test(l)) return { head: 'abc1234', clean: true, branchHasTarget: false, branchMerged: false };
    if (/:delta-review/.test(l)) return { issues: [], headSha: 'h3', clean: true, commitsInRange: 0 };
    if (/:merge$/.test(l)) return { mergeCommit: 'm1', firstParent: 'abc1234', secondParent: 'h3', conflicts: 0, clean: true };
    if (/:docs\d$/.test(l)) return { statusWritten: 'x' };
    if (/:docs-measure/.test(l)) return { checkerErrors: 0, clean: true, head: 'm2', panelStatus: 'e' };
    if (/:merge-fix-probe$/.test(l)) return { commits: [], rangeOk: true };
    if (/:merge-locate$/.test(l)) return { mergeSha: 'm0', rangeOk: true, secondParent: 'b9', branchTip: 'b9' };
    if (/:resume-fix-review$/.test(l)) return { issues: [], headSha: 'm9', clean: true, commitsInRange: 1 };
    if (/:cleanup$/.test(l)) return { ok: true };
    if (/:rollback/.test(l)) return { ok: true, head: 'abc1234', clean: true };
    if (l === 'git-truth') return { targetHead: 'm2', clean: true, lastGoodReachable: true, mergedIds: ['E1'], claims: [{ id: 'E1', commit: 'm1', reachable: true }] };
    if (l === 'report') return 'REPORT';
    if (/review-log/.test(l)) return 'ok';
    throw new Error('unmocked ' + l);
  };
  const parallel = (ts) => Promise.all(ts.map((t) => t().catch(() => null)));
  const r = await run({ config: { gates: GATES, locks: ['db'], projectContext: '', install: 'npm ci', generated: true, ...config }, deliverables, targetBranch: 'integracao/x', today: '2026-11-09', ...args },
    agent, parallel, () => {}, () => {}, { total: null });
  return { r, calls, labels: calls.map((c) => c.label) };
}

test('happy path merges, persists the log before the re-sync gates, and cleanup is scoped', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(r.results[0].merged, true);
  assert.ok(labels.indexOf('E1:review-log-resync') > labels.indexOf('E1:delta-review1'));
  assert.ok(labels.indexOf('E1:review-log-resync') < labels.indexOf('E1:regates1-1'));
  const clean = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.match(clean, /_tmp\/E1-"?\*/);
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

const unfinished = () => card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'm0' });
const fixCommits = { commits: [{ sha: 'f1', subject: 'E1 merge-fix: x' }], rangeOk: true };
const resume = (over) => exec({ cards: [unfinished(), card('E2')], deliverables: ['E1', 'E2'], over });

test('finish-merge with merge-fix commits: approved review closes ok', async () => {
  const { r, labels, calls } = await resume((l) => (/:merge-fix-probe$/.test(l) ? fixCommits : undefined));
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.merged, true);
  assert.ok(!e1.broken);
  assert.ok(labels.includes('E1:resume-fix-review'));
  assert.equal(calls.find((c) => c.label === 'E1:resume-fix-review').opts.model, 'opus');
  assert.ok(labels.indexOf('E1:resume-fix-review') < labels.indexOf('E1:merge-gates1-1') || labels.indexOf('E1:resume-fix-review') < labels.indexOf('E1:merge-gates1'));
});

test('finish-merge with merge-fix commits: rejected review stays broken, names the commits, stops E2', async () => {
  const { r } = await resume((l) => {
    if (/:merge-fix-probe$/.test(l)) return fixCommits;
    if (/:resume-fix-review$/.test(l)) return { issues: [{ severity: 'critical', category: 'defeito', description: 'masks a test' }], headSha: 'm9', clean: true, commitsInRange: 1 };
    return undefined;
  });
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.merged, true);
  assert.equal(e1.broken, true);
  assert.ok(r.results.find((x) => x.id === 'E2').skipped);
  assert.ok(r.operatorActions.some((o) => o.deliverable === 'E1' && /f1/.test(o.what + o.doNow)));
});

test('finish-merge with merge-fix commits: null review stays broken', async () => {
  const { r } = await resume((l) => {
    if (/:merge-fix-probe$/.test(l)) return fixCommits;
    if (/:resume-fix-review$/.test(l)) return null;
    return undefined;
  });
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.broken, true);
  assert.ok(r.results.find((x) => x.id === 'E2').skipped);
});

test('finish-merge without merge-fix commits proceeds and runs no review', async () => {
  const { r, labels } = await resume();
  assert.equal(r.results.find((x) => x.id === 'E1').merged, true);
  assert.ok(!labels.includes('E1:resume-fix-review'));
});

test('finish-merge with a null probe stays broken', async () => {
  const { r } = await resume((l) => (/:merge-fix-probe$/.test(l) ? null : undefined));
  assert.equal(r.results.find((x) => x.id === 'E1').broken, true);
});

test('mergeFound without mergeSha sets integBroken', async () => {
  const c = card('E1', { status: 'executando', onTarget: true, mergeFound: true });
  const { r } = await exec({ cards: [c, card('E2')], deliverables: ['E1', 'E2'] });
  assert.equal(r.results.find((x) => x.id === 'E1').broken, true);
  assert.ok(r.results.find((x) => x.id === 'E2').skipped);
});

test('cleanup creates the dirty folder and removes the worktree only after the patch', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.match(p, /mkdir -p [^ ]*E1-dirty/);
  assert.ok(p.indexOf('mkdir -p') < p.indexOf('worktree remove'));
  assert.match(p, /only after the patch/i);
});

test('git truth schema requires lastGoodReachable', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.ok(calls.find((c) => c.label === 'git-truth').opts.schema.required.includes('lastGoodReachable'));
});

const probeWith = (commits, extra = {}) => (l) => (/:merge-fix-probe$/.test(l) ? { commits, rangeOk: true, ...extra } : undefined);
const e1Of = (r) => r.results.find((x) => x.id === 'E1');
const reviewOf = (over) => (l) => (/:resume-fix-review$/.test(l) ? { issues: [], headSha: 'm9', clean: true, commitsInRange: 2, ...over } : undefined);
const both = (...fs) => (l, p, o) => { for (const f of fs) { const v = f(l, p, o); if (v !== undefined) return v; } return undefined; };

test('finish-merge: a fix commit with a non-prefixed subject is reviewed; the probe does not filter by subject', async () => {
  const { r, labels, calls } = await resume(probeWith([{ sha: 'f7', subject: 'hotfix the parser' }]));
  assert.ok(labels.includes('E1:resume-fix-review'));
  assert.match(calls.find((c) => c.label === 'E1:resume-fix-review').prompt, /f7/);
  const probe = calls.find((c) => c.label === 'E1:merge-fix-probe').prompt;
  assert.match(probe, /--first-parent/);
  assert.match(probe, /--no-merges/);
  assert.doesNotMatch(probe, /--grep/);
  assert.match(probe, /:!docs\/plans\/roadmap-x\//);
  assert.match(probe, /:!docs\//);
  assert.equal(e1Of(r).merged, true);
});

test('finish-merge: commits of another deliverable are dropped, the same deliverable counts', async () => {
  const other = await resume(probeWith([{ sha: 'o1', subject: 'E2 merge-fix: y' }]));
  assert.ok(!other.labels.includes('E1:resume-fix-review'));
  const same = await resume(probeWith([{ sha: 's1', subject: 'E1 T3: late fix' }]));
  assert.ok(same.labels.includes('E1:resume-fix-review'));
});

test('finish-merge: a reverted fix judged net-clean closes ok, and the review judges the net state at HEAD', async () => {
  const { r, calls } = await resume(both(probeWith([{ sha: 'f1', subject: 'bad fix' }, { sha: 'f2', subject: 'Revert "bad fix"' }]), reviewOf({})));
  assert.equal(e1Of(r).merged, true);
  assert.ok(!e1Of(r).broken && !e1Of(r).error);
  const p = calls.find((c) => c.label === 'E1:resume-fix-review').prompt;
  assert.match(p, /net state at HEAD/i);
  assert.match(p, /reverted or corrected/i);
});

test('finish-merge: rangeOk false or absent stays broken and runs no review', async () => {
  for (const extra of [{ rangeOk: false }, { rangeOk: undefined }]) {
    const { r, labels } = await resume(probeWith([], extra));
    assert.equal(e1Of(r).broken, true);
    assert.ok(!labels.includes('E1:resume-fix-review'));
  }
});

test('the probe schema requires rangeOk', async () => {
  const { calls } = await resume();
  assert.ok(calls.find((c) => c.label === 'E1:merge-fix-probe').opts.schema.required.includes('rangeOk'));
});

test('finish-merge: a review that read fewer commits than listed, or saw a dirty tree, does not approve', async () => {
  const two = [{ sha: 'f1', subject: 'a' }, { sha: 'f2', subject: 'b' }];
  for (const over of [{ commitsInRange: 0 }, { commitsInRange: 1 }, { clean: false }]) {
    const { r } = await resume(both(probeWith(two), reviewOf(over)));
    assert.equal(e1Of(r).broken, true, JSON.stringify(over));
  }
});

const mergedProbe = (l) => {
  if (/:pre-merge$/.test(l)) return { head: 'abc1234', clean: true, branchHasTarget: true, branchMerged: true };
  if (/merge-gates/.test(l)) return gm('abc1234');
  return undefined;
};

test('branchMerged: fixes after the located merge are reviewed and the located merge is used', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(mergedProbe, probeWith([{ sha: 'f1', subject: 'x' }]), reviewOf({ commitsInRange: 1 })) });
  assert.ok(labels.includes('E1:resume-fix-review'));
  assert.match(calls.find((c) => c.label === 'E1:merge-fix-probe').prompt, /m0\.\.HEAD/);
  assert.match(calls.find((c) => /:docs1$/.test(c.label)).prompt, /merge m0/);
  assert.equal(r.results[0].merged, true);
  assert.ok(!r.results[0].broken && !r.results[0].error);
});

test('branchMerged: a rejected fix stays broken; an unlocated merge stays broken', async () => {
  const rej = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(mergedProbe, probeWith([{ sha: 'f1', subject: 'x' }]), (l) => (/:resume-fix-review$/.test(l) ? { issues: [{ severity: 'critical', category: 'defeito', description: 'd' }], headSha: 'm', clean: true, commitsInRange: 1 } : undefined)) });
  assert.equal(rej.r.results[0].broken, true);
  const lost = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(mergedProbe, (l) => (/:merge-locate$/.test(l) ? { mergeSha: '', rangeOk: true } : undefined)) });
  assert.equal(lost.r.results[0].broken, true);
});

test('finish-merge: the integrity of the merge is measured on its own range and an alert breaks it', async () => {
  const { r, calls } = await resume((l) => (/:resume-test-integrity$/.test(l) ? { deletedTests: ['t/a.test.js'], removedAsserts: 0, skipsAdded: 0, prodChanged: 0, assertsAdded: 1 } : undefined));
  assert.equal(e1Of(r).broken, true);
  assert.ok(r.operatorActions.some((o) => o.deliverable === 'E1' && /t\/a\.test\.js/.test(o.what)));
  const p = calls.find((c) => c.label === 'E1:resume-test-integrity').prompt;
  assert.match(p, /m0\^1/);
  assert.match(p, /--detach/);
});

test('finish-merge: integrity off, null or unmeasured pushes a concern and does not fail', async () => {
  const off = await exec({ cards: [unfinished()], deliverables: ['E1'], config: { testIntegrity: false } });
  assert.equal(e1Of(off.r).merged, true);
  assert.ok(!e1Of(off.r).broken && !e1Of(off.r).error);
  assert.ok(e1Of(off.r).concerns.some((c) => /test-count floor/.test(c)));
  assert.ok(!off.labels.includes('E1:resume-test-integrity'));
  for (const v of [null, { deletedTests: [], removedAsserts: -1, skipsAdded: 0, prodChanged: 0, assertsAdded: 0 }]) {
    const { r } = await resume((l) => (/:resume-test-integrity$/.test(l) ? v : undefined));
    assert.equal(e1Of(r).merged, true);
    assert.ok(!e1Of(r).broken && !e1Of(r).error);
    assert.ok(e1Of(r).concerns.some((c) => /test-count floor/.test(c)));
  }
});

test('cleanup creates the dirty folder only when there is a patch and removes when none was needed', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.ok(p.indexOf('status --porcelain') < p.indexOf('mkdir -p'));
  assert.match(p, /no patch was needed/i);
});

const hardInteg = (l) => (/:resume-test-integrity$/.test(l) ? { deletedTests: ['t/a.test.js'], removedAsserts: 0, skipsAdded: 0, prodChanged: 0, assertsAdded: 1 } : undefined);
const resumeArgs = (args, over = hardInteg, config = {}) => exec({ cards: [unfinished()], deliverables: ['E1'], over, args, config });

test('finish-merge: heuristic-only integrity alerts close ok with a concern', async () => {
  const { r } = await resume((l) => (/:resume-test-integrity$/.test(l) ? { deletedTests: [], removedAsserts: 0, skipsAdded: 0, prodChanged: 2, assertsAdded: 0 } : undefined));
  assert.equal(e1Of(r).merged, true);
  assert.ok(!e1Of(r).broken && !e1Of(r).error);
  assert.ok(e1Of(r).concerns.some((c) => /no new assertion/.test(c)));
  assert.ok(r.results.find((x) => x.id === 'E2').merged);
});

test('finish-merge: removed assertions and added skips stay broken', async () => {
  for (const f of [{ removedAsserts: 1, skipsAdded: 0 }, { removedAsserts: 0, skipsAdded: 1 }]) {
    const { r } = await resume((l) => (/:resume-test-integrity$/.test(l) ? { deletedTests: [], prodChanged: 0, assertsAdded: 1, ...f } : undefined));
    assert.equal(e1Of(r).broken, true);
  }
});

test('acceptIntegrityAlerts with the matching deliverable and SHA closes ok with a concern naming the acceptance', async () => {
  const { r } = await resumeArgs({ acceptIntegrityAlerts: { E1: 'm0' } });
  assert.equal(e1Of(r).merged, true);
  assert.ok(!e1Of(r).broken && !e1Of(r).error);
  assert.ok(e1Of(r).concerns.some((c) => /operator/i.test(c) && /acceptIntegrityAlerts/.test(c) && /t\/a\.test\.js/.test(c)));
});

test('acceptIntegrityAlerts is ignored for another SHA, another deliverable, a SHA prefix or when it comes from config', async () => {
  const cases = [
    [{ acceptIntegrityAlerts: { E1: 'other' } }, {}],
    [{ acceptIntegrityAlerts: { E2: 'm0' } }, {}],
    [{ acceptIntegrityAlerts: { E1: 'm' } }, {}],
    [{}, { acceptIntegrityAlerts: { E1: 'm0' } }],
  ];
  for (const [args, config] of cases) {
    const { r } = await resumeArgs(args, hardInteg, config);
    assert.equal(e1Of(r).broken, true, JSON.stringify([args, config]));
  }
});

test('hard integrity alerts: the operator action offers the acknowledgement with the SHA, alongside revert; the run never sets it', async () => {
  const full = 'a'.repeat(40);
  const { r, calls } = await exec({ cards: [card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: full })], deliverables: ['E1'], over: hardInteg });
  const o = r.operatorActions.find((x) => x.deliverable === 'E1' && x.kind === 'merge-rejected');
  assert.match(o.doNow, /acceptIntegrityAlerts/);
  assert.ok(o.doNow.includes(full));
  assert.ok(o.doNow.includes('revert -m 1 ' + full));
  assert.equal(o.resumeWith.acceptIntegrityAlerts, undefined);
  assert.deepEqual(o.resumeWith.deliverables, ['E1']);
  assert.equal(r.resumeArgs.acceptIntegrityAlerts, undefined);
  const disc = calls.find((c) => c.label === 'discovery');
  assert.match(disc.prompt, /mergeSha = the full 40-character output of git rev-parse/);
  assert.match(disc.opts.schema.properties.cards.items.properties.mergeSha.description, /40-character/);
});

test('resume integrity: the temporary worktree is removed before the add and always after', async () => {
  const { calls } = await resume();
  const p = calls.find((c) => c.label === 'E1:resume-test-integrity').prompt;
  const add = p.indexOf('worktree add');
  assert.ok(p.indexOf('worktree remove --force') < add);
  assert.ok(p.lastIndexOf('worktree remove --force') > add);
  assert.match(p, /ignor\w+ errors/i);
  assert.match(p, /even if the program fails/i);
});

test('branchMerged: a located commit whose second parent is not the branch counts as not located', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(mergedProbe, (l) => (/:merge-locate$/.test(l) ? { mergeSha: 'm0', rangeOk: true, secondParent: 'zz', branchTip: 'b9' } : undefined)) });
  assert.equal(r.results[0].broken, true);
  assert.ok(!labels.includes('E1:merge-fix-probe'));
  const loc = calls.find((c) => c.label === 'E1:merge-locate');
  assert.ok(['secondParent', 'branchTip'].every((k) => loc.opts.schema.required.includes(k)));
});

test('result returns lastGood (the validated tip)', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(typeof r.lastGood, 'string');
  assert.ok(r.lastGood.length > 0);
});

const three = () => [unfinished(), card('E2'), card('E3')];
const breakE1 = (l) => { if (/^E1:merge-gates1/.test(l)) return gm('m0', { exit: 1, failedNames: ['new'] }); if (l === 'E1:merge-fix') return null; return undefined; };

test('C1: resumeArgs keeps a broken merge, so the next run validates it first', async () => {
  const { r } = await exec({ cards: three(), deliverables: ['E1', 'E2', 'E3'], over: breakE1 });
  assert.equal(e1Of(r).broken, true);
  assert.deepEqual(r.resumeArgs.deliverables, ['E1', 'E2', 'E3']);
});

test('C1: a run stops at selection when an interrupted merge is outside it, before any other agent', async () => {
  const { r, labels } = await exec({ cards: three(), deliverables: ['E2', 'E3'] });
  assert.equal(r.status, 'needs-operator');
  assert.deepEqual(labels, ['discovery']);
  const o = r.operatorActions.find((x) => x.kind === 'unfinished-merge');
  assert.equal(o.deliverable, 'E1');
  assert.deepEqual(o.resumeWith.deliverables, ['E1', 'E2', 'E3']);
});

test('C1: dry-run and plan-only do not merge, so they only note the interrupted merge', async () => {
  const dry = await exec({ cards: three(), deliverables: ['E2'], args: { mode: 'dry-run' } });
  assert.equal(dry.r.status, 'done');
  assert.ok(dry.r.selection.notes.some((n) => /E1/.test(n) && /interrupted/.test(n)));
  const plan = await exec({ cards: three(), deliverables: ['E2'], args: { mode: 'plan-only' } });
  assert.ok(!plan.r.operatorActions.some((x) => x.kind === 'unfinished-merge'));
  assert.ok(plan.labels.includes('E2:spec'));
});

const planAc = (ac, command = 'npm test -- a') => (l) => (/:plan$/.test(l) ? { planPath: 'docs/p.md', roadmapHeader: true, ac: [{ ac, kind: 'test', command }], tasks: [{ n: 1, title: 't', tier: 'sonnet' }] } : undefined);

test('I1: a plan row "AC1: text" is run as AC1 and an agent echo with spaces still counts', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(planAc('AC1: works'), (l) => (/:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'h2' : 'h3', clean: true, results: [{ ac: 'AC1', command: '  npm test -- a ', exit: 0 }] } : undefined)) });
  assert.equal(r.results[0].merged, true);
  const p = calls.find((c) => c.label === 'E1:evidence1').prompt;
  assert.match(p, /^AC1: npm test -- a$/m);
  assert.match(p, /verbatim/i);
});

test('I1: a command that was not run still fails the evidence', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { maxFixRounds: 0 }, over: (l) => (/:evidence/.test(l) ? { headSha: 'h2', clean: true, results: [{ ac: 'AC1', command: 'something else', exit: 0 }] } : undefined) });
  assert.equal(r.results[0].merged, false);
  assert.match(r.results[0].error, /command not run/);
});

test('I2: discovery returns the raw cell; blocked, discarded and segmented rows are read by the script', async () => {
  const cards = [card('E1', { status: 'blocked (BLQ-3)' }), card('E2', { status: 'discarded (DEC-007)' }), card('E3', { status: 'code: e; acceptance: blocked (BLQ-2)', onTarget: true, mergeFound: true, mergeSha: 'm' }), card('E4', { status: 'a' })];
  const { r, calls } = await exec({ cards, args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.deepEqual(r.selection.order, ['E4']);
  assert.match(calls[0].prompt, /Status cell verbatim/i);
});

test('I3: discovery requires the fields whose absence fails open', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' } });
  const s = calls[0].opts.schema;
  assert.ok(['repo', 'wtRoot'].every((k) => s.required.includes(k)));
  assert.ok(['mergeFound', 'acceptance'].every((k) => s.properties.cards.items.required.includes(k)));
});

test('I3: a card without mergeFound, a selected card without criteria or no repo stop the run', async () => {
  const noFlag = card('E1'); delete noFlag.mergeFound;
  const a = await exec({ cards: [noFlag], deliverables: ['E1'] });
  assert.equal(a.r.status, 'error');
  assert.match(a.r.error, /mergeFound/);
  const b = await exec({ cards: [card('E1', { acceptance: [] }), card('E2')], deliverables: ['E1'] });
  assert.equal(b.r.status, 'error');
  assert.match(b.r.error, /E1/);
  assert.ok(!b.labels.includes('preflight'));
  const open = await exec({ cards: [card('E1'), card('E2', { acceptance: [] })], deliverables: ['E1'], args: { mode: 'dry-run' } });
  assert.notEqual(open.r.status, 'error');
  for (const discOver of [{ repo: undefined }, { wtRoot: undefined }]) assert.equal((await exec({ cards: [card('E1')], deliverables: ['E1'], discOver })).r.status, 'error');
});

test('I3: args.repo wins over the discovered repo and stands in for it', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { repo: '/given' }, discOver: { repo: undefined } });
  assert.match(calls.find((c) => c.label === 'preflight').prompt, /git -C "\/given"/);
});

const redBase = (over) => (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: 'abc1234', clean: true, envFacts: 'x', baseline: over } : undefined);

test('I5: a tests gate with total 0 is not offered acceptRedBaseline', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: redBase(gm('abc1234', { total: 0 })) });
  const o = r.operatorActions.find((x) => x.kind === 'preflight:red-baseline');
  assert.doesNotMatch(o.doNow, /acceptRedBaseline/);
  assert.match(o.doNow, /kind: exit/);
  assert.match(o.doNow, /unit/);
});

test('I5: another red gate keeps the offer', async () => {
  const b = gm('abc1234'); b.gates[0].exit = 1;
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: redBase(b) });
  assert.match(r.operatorActions.find((x) => x.kind === 'preflight:red-baseline').doNow, /acceptRedBaseline/);
});

test('m2: the docs are not ok when the panel does not show the status after the merge', async () => {
  const good = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(good.r.results[0].merge.docsOk, true);
  assert.match(good.calls.find((c) => c.label === 'E1:docs-measure1').prompt, /state\.md/);
  assert.ok(good.calls.find((c) => c.label === 'E1:docs-measure1').opts.schema.required.includes('panelStatus'));
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/:docs-measure/.test(l) ? { checkerErrors: 0, clean: true, head: 'm2', panelStatus: 'c' } : undefined) });
  assert.equal(r.results[0].merge.docsOk, false);
  assert.ok(r.operatorActions.some((o) => o.kind === 'docs'));
});

test('m4: paths are quoted in the docs measure, the integrity run and the cleanup', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { wtRoot: '/w t' }, config: { docsStage: { instructions: 'x', measure: 'm' } } });
  assert.ok(calls.find((c) => c.label === 'E1:docs-measure1').prompt.includes('node "/w t/_tmp/E1-docs-measure.cjs"'));
  assert.ok(calls.find((c) => c.label === 'E1:test-integrity').prompt.includes('node "/w t/_tmp/E1-integrity.cjs" "integracao/x"'));
  const clean = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.ok(clean.includes('mkdir -p "/w t/_tmp/E1-dirty"'));
  assert.ok(clean.includes('> "/w t/_tmp/E1-dirty/cleanup.patch"'));
});

const noHeader = (l) => (/:plan$/.test(l) ? { planPath: 'docs/p.md', roadmapHeader: false, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a' }], tasks: [{ n: 1, title: 't', tier: 'sonnet' }] } : undefined);

test('m5: the blocked status falls back to the default word of the roadmap formats', async () => {
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: noHeader });
  assert.ok(labels.includes('E1:status-blocked'));
});

test('m6: the report prompt carries the resume args without the config; the result keeps it', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { marker: 'ZZ-MARK' }, over: noHeader });
  const p = calls.find((c) => c.label === 'report').prompt;
  assert.doesNotMatch(p, /ZZ-MARK/);
  assert.match(p, /"deliverables":\["E1"\]/);
  assert.equal(r.operatorActions.find((o) => o.kind === 'defect').resumeWith.config.marker, 'ZZ-MARK');
  assert.equal(r.resumeArgs.config.marker, 'ZZ-MARK');
});

test('m7: reportPath is null when no report file was written', async () => {
  const ok = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(ok.r.reportPath, /E1-run\.md$/);
  const none = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'report' ? null : undefined) });
  assert.equal(none.r.reportPath, null);
  const broken = await exec({ cards: three(), deliverables: ['E1', 'E2', 'E3'], over: breakE1 });
  assert.equal(broken.r.reportPath, null);
});

test('m8: the inflight row uses the columns of the roadmap format', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:status-d').prompt;
  assert.match(p, /Kind/);
  assert.match(p, /branchLive/);
  assert.doesNotMatch(p, /type: deliverable/);
});

test('m9: meta and selection messages are in English, and every phase used is declared', async () => {
  const titles = [...SRC.slice(0, SRC.indexOf('// roadmap-release workflow')).matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(titles, ['Discovery', 'Preflight', 'Setup', 'Spec', 'Plan', 'Implementation', 'Final review', 'Gates', 'Merge', 'Docs', 'Report']);
  const used = [...SRC.matchAll(/\bphase(?:\(|: )'([^']+)'/g)].map((m) => m[1]);
  assert.ok(used.length > 10);
  for (const t of used) assert.ok(titles.includes(t), t);
  assert.doesNotMatch(SRC.slice(0, SRC.indexOf('// roadmap-release workflow')), /[^\x00-\x7f]/);
  const un = await exec({ cards: [card('E1')], deliverables: ['E9'] });
  assert.match(un.r.error, /unknown deliverables: E9/);
});

const EXIT_LOSS = /replaces the panel row with the post-merge status/;

test('the selection stop states what the exit does to the panel row and the exact alternative', async () => {
  const { r } = await exec({ cards: three(), deliverables: ['E2', 'E3'] });
  const doNow = r.operatorActions.find((x) => x.kind === 'unfinished-merge').doNow;
  assert.match(doNow, EXIT_LOSS);
  assert.match(doNow, /blocker note or per-piece status/);
  assert.ok(doNow.includes('code: e; <the existing segments>'));
  const guide = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'operator.md'), 'utf8');
  assert.match(guide, EXIT_LOSS);
  assert.ok(guide.includes('code: <post-merge status>; <the existing segments>'));
});

test('the zero-test wording says an accepted red baseline is honoured but such a gate fails deliverables that add no tests', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: redBase(gm('abc1234', { total: 0 })) });
  const doNow = r.operatorActions.find((x) => x.kind === 'preflight:red-baseline').doNow;
  assert.match(doNow, /fails any deliverable that adds no tests/);
  assert.doesNotMatch(doNow, /cannot be accepted/);
  const cfg = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'config.md'), 'utf8');
  assert.match(cfg, /explicit .acceptRedBaseline. is honoured, but a .tests. gate with total zero fails any deliverable that adds no tests/);
  assert.doesNotMatch(cfg, /fails on every deliverable/);
});
