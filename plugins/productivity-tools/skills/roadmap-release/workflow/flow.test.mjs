import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPure } from './load-pure.mjs';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8').replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC);

const GATES = [{ name: 'lint', cmd: 'npm run lint', kind: 'exit' }, { name: 'unit', cmd: 'npm test', kind: 'tests', needsLock: 'db' }];
const gm = (head, over = {}) => ({ headSha: head, clean: true, changedFiles: ['src/a.js'], log: '', gates: [{ name: 'lint', ran: true, exit: 0 }, { name: 'unit', ran: true, exit: 0, total: 10, skipped: 0, failedNames: [], ...over }] });
const card = (id, extra = {}) => ({ id, deps: [], reqs: ['R1'], status: 'pronta', onTarget: false, mergeFound: false, critical: false, acceptance: [{ id: 'AC1', text: 'works' }], ...extra });

// over(label, prompt, opts) may return a value (including null) to override the default answer.
async function exec({ cards, over, deliverables, config = {}, args = {}, discOver = {}, budget = { total: null } }) {
  const calls = [];
  const agent = async (prompt, o) => {
    const l = o.label;
    calls.push({ label: l, prompt, opts: o });
    if (over) { const v = over(l, prompt, o); if (v !== undefined) return v; }
    const E = (/^(E\d+):/.exec(l) || [])[1];
    if (l === 'discovery') return { repo: '/r', today: '2026-11-09', wtRoot: '/wt/', roadmapDir: 'docs/plans/roadmap-x/', strategy: 'docs/plans/roadmap-x/s.md', checker: 'docs/plans/roadmap-x/check.mjs', integrationBranch: 'main', target: 'integracao/x', trackerAvailable: true, checkerExists: true, roadmapSlug: 'x', deliverableStatuses: ['a', 'b', 'c', 'd', 'e'], integratedStatuses: ['integrada', 'publicada', 'medida'], cards, ...discOver };
    if (l === 'preflight') return { ok: true, integrationWorktree: '/wt/_integracao', targetHead: 'abc1234', clean: true, envFacts: 'x', baseline: gm('abc1234') };
    if (/:setup$/.test(l)) return { ok: true, worktree: `/wt/${E}`, baseCommit: 'b1', head: 'h1', clean: true };
    if (/:spec$/.test(l)) return { specPath: 'docs/s.md', slug: 'x', decisions: ['d'], humanInputs: [] };
    if (/:plan$/.test(l)) return { planPath: 'docs/p.md', planBlob: 'b1', roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a' }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] };
    if (/spec-review|plan-review|:t\d+:(spec|quality)|:final-/.test(l)) return { issues: [], headSha: 'h1', clean: true, commitsInRange: 2 };
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
    if (/:resume-review-log$/.test(l)) return { found: true, acceptedRisks: [], humanInputs: [] };
    if (/review-log/.test(l)) return 'ok';
    throw new Error('unmocked ' + l);
  };
  const parallel = (ts) => Promise.all(ts.map((t) => t().catch(() => null)));
  const r = await run({ config: { gates: GATES, locks: ['db'], projectContext: '', install: 'npm ci', generated: true, ...config }, deliverables, targetBranch: 'integracao/x', today: '2026-11-09', ...args },
    agent, parallel, () => {}, () => {}, budget);
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
test('item 9: a resumed merge keeps the human act of the card tag', async () => {
  const c = card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'm0', acceptance: [{ id: 'AC1', text: 'ok {verify: human; evidence: owner approves}' }] });
  const { r } = await exec({ cards: [c], deliverables: ['E1'] });
  const act = r.operatorActions.find((o) => o.kind === 'human-act' && o.deliverable === 'E1');
  assert.ok(act);
  assert.match(act.what, /AC1/);
  assert.equal(r.ownerReview.criteriaOpen[0].ac, 'AC1');
  assert.equal(r.ownerReview.criteriaOpen[0].kind, 'human');
});

test('item 9: accepted risks of the review log come back on resume', async () => {
  const { r } = await exec({ cards: [unfinished()], deliverables: ['E1'],
    over: (l) => (/:resume-review-log$/.test(l) ? { found: true, acceptedRisks: [{ stage: 'final', severity: 'critical', category: 'defeito', description: 'd' }], humanInputs: [] } : undefined) });
  assert.equal(r.ownerReview.acceptedRisks.length, 1);
  assert.equal(r.ownerReview.acceptedRisks[0].id, 'E1');
});

test('item 9: a null review-log agent is a concern', async () => {
  const { r } = await exec({ cards: [unfinished()], deliverables: ['E1'], over: (l) => (/:resume-review-log$/.test(l) ? null : undefined) });
  assert.ok(r.results[0].concerns.some((c) => /review log not read/.test(c)));
});

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

const planAc = (ac, command = 'npm test -- a') => (l) => (/:plan$/.test(l) ? { planPath: 'docs/p.md', planBlob: 'b1', roadmapHeader: true, ac: [{ ac, kind: 'test', command }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] } : undefined);

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

test('item 5: discovery without integrationBranch stops the run, with targetBranch develop and no merge', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { targetBranch: 'develop' }, discOver: { integrationBranch: undefined } });
  assert.equal(r.status, 'error');
  assert.match(r.error, /integrationBranch/);
  assert.deepEqual(labels, ['discovery']);
});

test('item 5: each missing discovery field stops the run', async () => {
  const cases = [
    ['integratedStatuses', {}, { integratedStatuses: undefined }],
    ['deliverableStatuses', {}, { deliverableStatuses: undefined }],
    ['deliverableStatuses', {}, { deliverableStatuses: ['a', 'b'] }],
    ['roadmapDir', {}, { roadmapDir: undefined }],
    ['strategy', {}, { strategy: undefined }],
    ['checker', {}, { checker: undefined }],
    ['today', { today: undefined }, { today: undefined }],
  ];
  for (const [field, args, discOver] of cases) {
    const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args, discOver });
    assert.equal(r.status, 'error', field);
    assert.match(r.error, new RegExp(field), field);
    assert.deepEqual(labels, ['discovery'], field);
  }
});

test('item 5: the schema requires the fields', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const req = calls[0].opts.schema.required;
  for (const f of ['cards', 'repo', 'wtRoot', 'integrationBranch', 'integratedStatuses', 'deliverableStatuses', 'today', 'roadmapDir', 'strategy', 'checker']) assert.ok(req.includes(f), f);
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
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { wtRoot: '/w t' }, over: (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/w t/_integracao', targetHead: 'abc1234', clean: true, envFacts: 'x', baseline: gm('abc1234') } : undefined), config: { docsStage: { instructions: 'x', measure: 'm' } } });
  assert.ok(calls.find((c) => c.label === 'E1:docs-measure1').prompt.includes('node "/w t/_tmp/E1-docs-measure.cjs"'));
  assert.ok(calls.find((c) => c.label === 'E1:test-integrity').prompt.includes('node "/w t/_tmp/E1-integrity.cjs" "integracao/x"'));
  const clean = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.ok(clean.includes('mkdir -p "/w t/_tmp/E1-dirty"'));
  assert.ok(clean.includes('> "/w t/_tmp/E1-dirty/cleanup.patch"'));
});

const noHeader = (l) => (/:plan$/.test(l) ? { planPath: 'docs/p.md', planBlob: 'b1', roadmapHeader: false, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a' }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] } : undefined);

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

test('authorizeExternal with a bad item stops the run before discovery', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E18:T04'] } });
  assert.equal(r.status, 'error');
  assert.match(r.error, /E18:T04/);
  assert.deepEqual(labels, []);
});

test('the plan prompt asks for external and externalDedupe and the plan review blocks a gap', async () => {
  const good = { planPath: 'docs/p.md', planBlob: 'b1', roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a' }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] };
  const { calls, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => {
      if (l === 'E1:plan') return { ...good, tasks: [{ n: 1, title: 't', tier: 'sonnet' }] };
      if (l === 'E1:plan-fix1') return good;
      return undefined;
    } });
  const p = calls.find((c) => c.label === 'E1:plan').prompt;
  assert.match(p, /externalDedupe/);
  assert.match(p, /when in doubt/i);
  assert.ok(labels.includes('E1:plan-fix1'));
});

// ---- external-effect authorization (Task 4)
const PU = loadPure();
const tk = (n, external, extra = {}) => ({ n, title: 't' + n, tier: 'sonnet', external, ...(external ? { externalDedupe: 'checks outbox.log first' } : {}), ...extra });
const planWith = (tasks) => ({ planPath: 'docs/p.md', planBlob: 'b1', roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a' }], tasks });
const fpOf = (tasks) => PU.planFingerprint(tasks, 'b1');
const ext = (r) => r.operatorActions.filter((a) => a.kind === 'authorize-external');
const withPlan = (tasks, more) => (l) => (l === 'E1:plan' ? planWith(tasks) : more ? more(l) : undefined);

test('external task without authorization stops the deliverable before the task and the others go on', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const fp = fpOf(tasks);
  const { r, labels } = await exec({ cards: [card('E1'), card('E2')], deliverables: ['E1', 'E2'], over: withPlan(tasks) });
  assert.ok(labels.includes('E1:t1:impl'));
  assert.ok(!labels.includes('E1:t2:impl'));
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.merged, false);
  assert.equal(e1.failKind, 'externo');
  assert.equal(r.results.find((x) => x.id === 'E2').merged, true);
  const a = ext(r);
  assert.equal(a.length, 1);
  assert.equal(a[0].deliverable, 'E1');
  assert.equal(a[0].item, 'E1:T2@' + fp);
  assert.deepEqual(a[0].resumeWith.authorizeExternal, ['E1:T2@' + fp]);
  assert.deepEqual(a[0].resumeWith.deliverables, ['E1']);
  assert.ok(!r.operatorActions.some((x) => x.kind === 'defect'));
  assert.ok(!labels.includes('E1:status-blocked'));
  assert.equal(r.status, 'needs-operator');
});

test('authorized external task runs and the authorization survives fix rounds', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  let n = 0;
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] },
    over: withPlan(tasks, (l) => (l === 'E1:t2:spec1' && n++ === 0 ? { issues: [{ severity: 'critical', category: 'defeito', description: 'x' }], headSha: 'h1', clean: true, commitsInRange: 2 } : l === 'E1:t2:spec-fix1' ? { status: 'DONE', summary: 'f', checks: [] } : undefined)) });
  assert.ok(labels.includes('E1:t2:impl'));
  assert.ok(labels.includes('E1:t2:spec-fix1'));
  assert.equal(ext(r).length, 0);
  assert.match(calls.find((c) => c.label === 'E1:t2:spec-fix1').prompt, /AUTHORIZED/);
  assert.match(calls.find((c) => c.label === 'E1:t2:impl').prompt, /checks outbox\.log first/);
  assert.match(calls.find((c) => c.label === 'E1:t1:impl').prompt, /Do NOT perform any external effect/);
});

test('a replanned task with another number does not inherit the authorization', async () => {
  const tasks = [tk(1, false), tk(2, false), tk(3, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] }, over: withPlan(tasks) });
  assert.equal(ext(r)[0].item, 'E1:T3@' + fpOf(tasks));
});

test('any replanned plan invalidates a bound authorization, even with the same task number', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2@00000000'] }, over: withPlan(tasks) });
  assert.ok(!labels.includes('E1:t2:impl'));
  assert.equal(ext(r)[0].item, 'E1:T2@' + fpOf(tasks));
});

test('every held external task of the plan is listed at the first stop', async () => {
  const tasks = [tk(1, false), tk(2, true), tk(3, true)];
  const fp = fpOf(tasks);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan(tasks) });
  assert.ok(!labels.includes('E1:t2:impl'));
  const a = ext(r);
  assert.deepEqual(a.map((x) => x.item), ['E1:T2@' + fp, 'E1:T3@' + fp]);
  assert.ok(a.every((x) => x.deliverable === 'E1'));
  assert.match(a[1].what, /t3/);
  assert.equal(r.results[0].held, 'E1:T2@' + fp);
});

test('a bare authorization comes back bound in resumeArgs', async () => {
  const tasks = [tk(1, false), tk(2, true), tk(3, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] }, over: withPlan(tasks, (l) => (l === 'E1:t2:impl' ? { status: 'BLOCKED', summary: 'stop' } : undefined)) });
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E1:T2@' + fpOf(tasks)]);
});

test('partial release: only the named item runs', async () => {
  const tasks = [tk(1, false), tk(2, true), tk(3, true)];
  const fp = fpOf(tasks);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] }, over: withPlan(tasks) });
  assert.ok(labels.includes('E1:t2:impl'));
  assert.ok(!labels.includes('E1:t3:impl'));
  const a = ext(r);
  assert.equal(a.length, 1);
  assert.equal(a[0].item, 'E1:T3@' + fp);
  assert.deepEqual(a[0].resumeWith.authorizeExternal, ['E1:T2@' + fp, 'E1:T3@' + fp]);
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E1:T2@' + fp]);
});

test('resume after the authorization runs only the released task and the next ones', async () => {
  const tasks = [tk(1, false), tk(2, true), tk(3, false)];
  const first = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan(tasks) });
  const rw = ext(first.r)[0].resumeWith;
  const done = [{ n: 1, firstParent: 'h0', last: 'c1' }, { n: 2, firstParent: 'c1', last: 'c2' }];
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: rw,
    over: withPlan(tasks, (l) => (l === 'E1:progress' ? { head: 'c2', clean: true, done } : undefined)) });
  assert.ok(labels.includes('E1:t3:impl'));
  assert.ok(!labels.includes('E1:t1:impl'));
  assert.ok(!labels.includes('E1:t2:impl'));
});

test('restricted gate is not measured without authorization and is offered as an action', async () => {
  const e2e = { name: 'e2e', cmd: 'npm run e2e', kind: 'exit', restricted: true };
  const cfg = { gates: [...GATES, e2e] };
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], config: cfg });
  assert.doesNotMatch(a.calls.find((c) => c.label === 'preflight').prompt, /npm run e2e/);
  const act = ext(a.r).find((x) => x.item === 'gate:e2e');
  assert.ok(act);
  assert.equal(act.deliverable, null);
  assert.deepEqual(act.resumeWith.authorizeExternal, ['gate:e2e']);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], config: cfg, args: { authorizeExternal: ['gate:e2e'] },
    over: (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: 'abc1234', clean: true, envFacts: 'x', baseline: { ...gm('abc1234'), gates: [...gm('abc1234').gates, { name: 'e2e', ran: true, exit: 0 }] } } : undefined) });
  assert.match(b.calls.find((c) => c.label === 'preflight').prompt, /npm run e2e/);
  assert.equal(ext(b.r).length, 0);
});

test('the authorization ends with the deliverable', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2', 'gate:x'] } });
  assert.equal(r.results[0].merged, true);
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['gate:x']);
});

test('the base rules forbid external effects for every agent', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'E1:spec').prompt, /NEVER perform an external effect/);
});

test('a conteudo failure after plan approval resumes with the authorization bound to that plan', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] },
    over: withPlan(tasks, (l) => (l === 'E1:t2:impl' ? { status: 'BLOCKED', summary: 'stop' } : undefined)) });
  const d = r.operatorActions.find((a) => a.kind === 'defect');
  assert.deepEqual(d.resumeWith.authorizeExternal, ['E1:T2@' + fpOf(tasks)]);
});

test('the restricted-gate action keeps bound items of unfinished deliverables and drops merged ones', async () => {
  const e2e = { name: 'e2e', cmd: 'npm run e2e', kind: 'exit', restricted: true };
  const t2 = [tk(1, false), tk(2, true), tk(3, true)];
  const { r } = await exec({ cards: [card('E1'), card('E2')], deliverables: ['E1', 'E2'], config: { gates: [...GATES, e2e] },
    args: { authorizeExternal: ['E1:T2', 'E2:T2'] },
    over: (l) => (l === 'E2:plan' ? planWith(t2) : undefined) });
  assert.equal(r.results.find((x) => x.id === 'E1').merged, true);
  const g = ext(r).find((x) => x.item === 'gate:e2e');
  assert.deepEqual(g.resumeWith.authorizeExternal, ['E2:T2@' + fpOf(t2), 'gate:e2e']);
  assert.equal(r.results.find((x) => x.id === 'E2').held, 'E2:T3@' + fpOf(t2));
});

const foreignPre = (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/r', targetHead: 'abc1234', clean: true, envFacts: 'x', baseline: gm('abc1234') } : undefined);

test("item 6: a target checked out in the person's checkout holds every merge", async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre });
  for (const bad of ['E1:merge', 'E1:rollback', 'E1:pre-merge', 'E1:setup']) assert.ok(!labels.includes(bad), bad);
  assert.ok(!labels.some((l) => /^E1:status-/.test(l)));
  assert.equal(r.results.find((x) => x.id === 'E1').merged, false);
  const a = r.operatorActions.find((o) => o.kind === 'authorize-external');
  assert.equal(a.item, 'checkout:integracao/x');
  assert.equal(a.deliverable, 'E1');
  assert.match(calls.find((c) => c.label === 'report').prompt, /do NOT write a file/);
  assert.equal(r.reportPath, null);
});

test('item 6: with the checkout authorized the merge runs', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre, args: { authorizeExternal: ['checkout:integracao/x'] } });
  assert.equal(r.results.find((x) => x.id === 'E1').merged, true);
});

test("item 6: an interrupted merge is not finished in the person's checkout without authorization", async () => {
  const unf = card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'm0' });
  const { r, labels } = await exec({ cards: [unf], deliverables: ['E1'], over: foreignPre });
  assert.ok(!labels.some((l) => /^E1:merge-gates/.test(l)));
  assert.ok(r.operatorActions.some((o) => o.item === 'checkout:integracao/x'));
});

test('item 6: the base rules no longer say NEVER touch the worktree unconditionally', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre });
  const p = calls.find((c) => c.label === 'preflight').prompt;
  assert.doesNotMatch(p, /NEVER touch[^.]*the worktree \/r(?!.*authorized)/);
  assert.match(p, /checkout:integracao\/x/);
});

test("item 6: the report never commits in the person's checkout when the budget skipped every deliverable", async () => {
  let n = 0;
  const budget = { total: 1e9, remaining: () => (n++ === 0 ? 1e9 : 0) };
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre, budget });
  assert.equal(r.results.find((x) => x.id === 'E1').skipped, true);
  assert.match(calls.find((c) => c.label === 'report').prompt, /do NOT write a file/);
  assert.equal(r.reportPath, null);
  assert.match(calls.find((c) => c.label === 'report').prompt, /"item":"checkout:integracao\/x"/);
  const a = r.operatorActions.filter((o) => o.kind === 'authorize-external' && o.item === 'checkout:integracao/x');
  assert.equal(a.length, 1);
  assert.equal(a[0].deliverable, null);
});

const interrupted = (extra = {}) => card('E2', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'm0', ...extra });

test('item 1: the gates of an interrupted merge run before a new deliverable merges', async () => {
  const { labels } = await exec({ cards: [card('E1'), interrupted()], deliverables: ['E1', 'E2'] });
  assert.notEqual(labels.indexOf('E2:merge-gates1-1'), -1);
  assert.ok(labels.indexOf('E2:merge-gates1-1') < labels.indexOf('E1:merge'));
});

test('item 1: a new deliverable does not merge when the interrupted one ends broken', async () => {
  const { r, labels } = await exec({ cards: [card('E1'), interrupted()], deliverables: ['E1', 'E2'],
    over: (l) => {
      if (/^E2:merge-gates1/.test(l)) return gm('m0', { exit: 1, failedNames: ['new'] });
      if (l === 'E2:merge-fix') return null;
      return undefined;
    } });
  assert.ok(!labels.includes('E1:pre-merge'));
  assert.ok(!labels.includes('E1:merge'));
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.ok(e1.skipped);
  assert.match(e1.error, /compromised/);
  assert.equal(r.results.find((x) => x.id === 'E2').broken, true);
});

test('item 1: an interrupted merge that depends on a new deliverable does not deadlock', async () => {
  const { r, labels } = await exec({ cards: [card('E1'), interrupted({ deps: ['E1'] })], deliverables: ['E1', 'E2'] });
  assert.ok(labels.includes('E2:merge-gates1-1'));
  assert.ok(labels.includes('E1:merge'));
  assert.ok(labels.indexOf('E2:merge-gates1-1') < labels.indexOf('E1:merge'));
  assert.equal(r.results.find((x) => x.id === 'E1').merged, true);
});

test('item 1: a resume that throws also stops new merges', async () => {
  const { r, labels } = await exec({ cards: [card('E1'), interrupted()], deliverables: ['E1', 'E2'],
    over: (l) => { if (l === 'E2:merge-fix-probe') throw new Error('boom'); return undefined; } });
  assert.ok(!labels.includes('E1:merge'));
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.ok(e1.skipped);
  assert.match(e1.error, /compromised/);
});

test('item 2: piece 1 integrated and piece 2 spec is not done', async () => {
  const { r } = await exec({ cards: [card('E1', { status: 'piece 1: integrada; piece 2: spec', onTarget: true })], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.ok(r.selection.order.includes('E1'));
});

test('item 2: a spec row citing a commit of the main is not done', async () => {
  const { r } = await exec({ cards: [card('E2', { status: 'spec', onTarget: true })], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.ok(r.selection.order.includes('E2'));
});

test('item 2: a finished code segment still counts', async () => {
  const { r } = await exec({ cards: [card('E3', { status: 'code: integrada; acceptance: blocked (BLQ-2)', onTarget: true, mergeFound: true, mergeSha: 'm' })], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.ok(!r.selection.order.includes('E3'));
});

test('item 2: the discovery prompt restricts the ancestor rule', async () => {
  const { calls } = await exec({ cards: [card('E1')], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.match(calls[0].prompt, /several pieces/);
  assert.match(calls[0].prompt, /ONLY when the code segment is finished/);
});

test('item 14: a closed BLQ yields a decision action and no correction round', async () => {
  const { r, labels } = await exec({ cards: [card('E1', { acceptance: [{ id: 'AC1', text: 'waits {verify: blocked BLQ-9; evidence: vendor key}' }] })], deliverables: ['E1'], discOver: { blockers: [] } });
  assert.equal(r.results.find((x) => x.id === 'E1').failKind, 'decisao');
  const d = r.operatorActions.filter((o) => o.kind === 'decision' && o.deliverable === 'E1');
  assert.equal(d.length, 1);
  assert.match(d[0].doNow, /BLQ-9/);
  assert.match(d[0].doNow, /revision/);
  assert.ok(!r.operatorActions.some((o) => o.kind === 'defect'));
  for (const l of ['E1:setup', 'E1:spec', 'E1:plan-fix1']) assert.ok(!labels.includes(l), l);
});

test('item 7: the owner notes never reach the record or the docs prompts', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'API_KEY=sk-live-123' } } });
  for (const c of calls.filter((x) => /:status-|:docs\d$|^report$/.test(x.label))) assert.ok(!c.prompt.includes('sk-live-123'), c.label);
  const spec = calls.find((c) => c.label === 'E1:spec').prompt;
  assert.ok(spec.includes('sk-live-123'));
  assert.match(spec, /Never write or quote a credential/);
  assert.match(calls.find((c) => c.label === 'E1:plan').prompt, /Never write or quote a credential/);
  assert.match(calls.find((c) => /^E1:status-/.test(c.label)).prompt, /answered for E1 in the run notes/);
});

test('item 7: the merge-fix prompts carry no owner notes', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'API_KEY=sk-live-123' } },
    over: (l) => {
      if (/^E1:merge-gates1/.test(l)) return gm('m1', { exit: 1, failedNames: ['t'] });
      if (/:merge-fix$/.test(l)) return { status: 'DONE', summary: 's', checks: [] };
      if (/:merge-fix-review$/.test(l)) return { issues: [], headSha: 'm1', clean: true, commitsInRange: 1 };
      return undefined;
    } });
  const fixes = calls.filter((c) => /:merge-fix(-review)?$/.test(c.label));
  assert.ok(fixes.length > 0);
  for (const c of fixes) assert.ok(!c.prompt.includes('sk-live-123'), c.label);
});

test('item 7: the human-input action forbids secrets in notes', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/:spec$/.test(l) ? { specPath: 'docs/s.md', slug: 'x', decisions: [], humanInputs: [{ what: 'key', blocking: true }] } : undefined) });
  const o = r.operatorActions.find((x) => x.kind === 'human-input');
  assert.match(o.doNow, /Never put a secret in notes/);
});

test('item 7: every prompt that receives the notes carries the secrets warning', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'API_KEY=sk-live-123' } } });
  for (const l of ['E1:t1:impl', 'E1:t1:spec1']) {
    const p = calls.find((c) => c.label === l).prompt;
    assert.ok(p.includes('sk-live-123'), l);
    assert.match(p, /Never write or quote a credential/, l);
  }
});
