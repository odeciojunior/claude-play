import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPure } from './load-pure.mjs';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8').replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC);

const B1 = '3f2a9c1d8e7b6a5f4c3d2e1f0a9b8c7d6e5f4a3b';
const B2 = '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d';
const GATES = [{ name: 'lint', cmd: 'npm run lint', kind: 'exit' }, { name: 'unit', cmd: 'npm test', kind: 'tests', needsLock: 'db' }];
const gm = (head, over = {}) => ({ headSha: head, clean: true, changedFiles: ['src/a.js'], log: '', gates: [{ name: 'lint', ran: true, exit: 0 }, { name: 'unit', ran: true, exit: 0, total: 10, skipped: 0, failedNames: [], ...over }] });
const card = (id, extra = {}) => ({ id, deps: [], reqs: ['R1'], status: 'pronta', onTarget: false, mergeFound: false, critical: false, acceptance: [{ id: 'AC1', text: 'works' }], ...extra });

// The Workflow runtime's resume cache: an agent() call is keyed on (prompt, opts, previous key); while every call so far
// matched, a completed call returns its journaled result without running; the first miss and every call after it run live.
// start(killAt) begins one invocation; killAt names the label at which the process dies (that call and later ones never finish).
function makeJournal() {
  const results = new Map();
  return {
    start(killAt) {
      let prev = '', live = false, dead = false;
      const cached = [];
      return {
        cached,
        call: async (prompt, o, run) => {
          if (dead) throw new Error('process killed');
          const key = createHash('sha256').update(JSON.stringify([prev, prompt, o])).digest('hex');
          prev = key;
          if (!live && results.has(key)) { cached.push(o.label); return results.get(key); }
          live = true;
          if (o.label === killAt) { dead = true; throw new Error('process killed'); }
          const v = await run();
          if (!dead) results.set(key, v);
          return v;
        },
      };
    },
  };
}

// over(label, prompt, opts) may return a value (including null) to override the default answer.
async function exec({ cards, over, deliverables, config = {}, args = {}, discOver = {}, budget = { total: null }, journal = null }) {
  const calls = [];
  const lastAc = {};
  const agent = (prompt, o) => (journal ? journal.call(prompt, o, () => liveAgent(prompt, o)) : liveAgent(prompt, o));
  // By default the plan reviewer is faithful: it returns the rows of the plan, unless a test gives its own.
  const liveAgent = async (prompt, o) => {
    const v = await answerOf(prompt, o);
    const id = (/^(E\d+):/.exec(o.label) || [])[1];
    if (/:plan(-fix\d+)?$/.test(o.label) && v && v.ac) lastAc[id] = v.ac;
    return /plan-review/.test(o.label) && v && !('evidenceRows' in v) ? { ...v, evidenceRows: lastAc[id] || [] } : v;
  };
  const answerOf = async (prompt, o) => {
    const l = o.label;
    calls.push({ label: l, prompt, opts: o });
    if (over) { const v = over(l, prompt, o); if (v !== undefined) return v; }
    const E = (/^(E\d+):/.exec(l) || [])[1];
    if (l === 'discovery') return { repo: '/r', today: '2026-11-09', wtRoot: '/wt/', roadmapDir: 'docs/plans/roadmap-x/', strategy: 'docs/plans/roadmap-x/s.md', checker: 'docs/plans/roadmap-x/check.mjs', integrationBranch: 'main', target: 'integracao/x', trackerAvailable: true, checkerExists: true, roadmapSlug: 'x', deliverableStatuses: ['a', 'b', 'c', 'd', 'e'], integratedStatuses: ['integrada', 'publicada', 'medida'], cards, ...discOver };
    if (l === 'preflight') return { ok: true, integrationWorktree: '/wt/_integracao', targetHead: 'abc1234', clean: true, envFacts: 'x', baseline: gm('abc1234') };
    if (/:setup$/.test(l)) return { ok: true, worktree: `/wt/${E}`, baseCommit: 'b1', head: 'h1', clean: true };
    if (/:spec$/.test(l)) return { specPath: 'docs/s.md', slug: 'x', decisions: ['d'], humanInputs: [] };
    if (/:plan$/.test(l)) return { planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] };
    if (/plan-review/.test(l)) return { issues: [], headSha: 'h1', clean: true, commitsInRange: 2, measuredPlanBlob: B1 };
    if (/spec-review|:t\d+:(spec|quality)|:final-/.test(l)) return { issues: [], headSha: 'h1', clean: true, commitsInRange: 2 };
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
    if (/:merge-risks$/.test(l)) return { head: 'm1', commit: 'm1' };
    if (/:cleanup$/.test(l)) return { ok: true };
    if (/:rollback/.test(l)) return { ok: true, head: 'abc1234', clean: true };
    if (l === 'git-truth') return { targetHead: 'm2', clean: true, lastGoodReachable: true, mergedIds: ['E1'], claims: [{ id: 'E1', commit: 'm1', reachable: true }] };
    if (l === 'report') return 'REPORT';
    if (/:resume-review-log$/.test(l)) return { found: true, acceptedRisks: [], humanInputs: [] };
    if (/:awaiting-person$/.test(l)) return { ok: true };
    if (/:launching$/.test(l)) return { ok: true, head: 'L1' };
    if (/:effect-completed$/.test(l)) return { ok: true };
    if (/:merge-effects$/.test(l)) return { head: 'm1', commit: 'm1' };
    if (/review-log/.test(l)) return 'ok';
    throw new Error('unmocked ' + l);
  };
  const parallel = (ts) => Promise.all(ts.map((t) => t().catch(() => null)));
  const r = await run({ config: { gates: GATES, locks: ['db'], projectContext: '', install: 'npm ci', generated: true, ...config }, deliverables, targetBranch: 'integracao/x', today: '2026-11-09', runToken: 'pf-test', ...args },
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

const planAc = (ac, command = 'npm test -- a') => (l) => (/:plan$/.test(l) ? { planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac, kind: 'test', command, external: false }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] } : undefined);

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

const noHeader = (l) => (/:plan$/.test(l) ? { planPath: 'docs/p.md', planBlob: B1, roadmapHeader: false, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] } : undefined);

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
  const good = { planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] };
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
const planWith = (tasks) => ({ planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }], tasks });
const fpOf = (tasks) => PU.planFingerprint(tasks, B1);
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
  const fix = calls.find((c) => c.label === 'E1:t2:spec-fix1').prompt;
  assert.match(fix, /The external effect of this task already ran \((the implementer reported it done)\): do not run it again, not even through its duplicate check; checks only read\. If this fix needs the effect run again, return NEEDS_HUMAN/);
  assert.doesNotMatch(fix, /perform the effect at most once/);
  assert.doesNotMatch(fix, /\$\{/);
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

test('same blob with retranscribed externalDedupe keeps the authorization; another blob holds', async () => {
  const first = [tk(1, false), tk(2, true, { externalDedupe: 'x' })];
  const auth = ['E1:T2@' + PU.planFingerprint(first, B1)];
  const resumed = [tk(1, false), tk(2, true, { externalDedupe: "'x'" })];
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: auth }, over: withPlan(resumed) });
  assert.ok(a.labels.includes('E1:t2:impl'));
  assert.equal(ext(a.r).length, 0);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: auth },
    over: (l) => (l === 'E1:plan' ? { ...planWith(resumed), planBlob: B2 } : /plan-review/.test(l) ? { issues: [], headSha: 'h1', clean: true, commitsInRange: 2, measuredPlanBlob: B2 } : undefined) });
  assert.ok(!b.labels.includes('E1:t2:impl'));
  assert.equal(ext(b.r)[0].item, 'E1:T2@' + PU.planFingerprint(resumed, B2));
});

test('a plan review that measures another blob opens a gap and a missing measurement too', async () => {
  for (const m of [B2, undefined]) {
    const { labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
      over: (l) => (l === 'E1:plan-review1' ? { issues: [], headSha: 'h1', clean: true, commitsInRange: 2, ...(m ? { measuredPlanBlob: m } : {}) } : undefined) });
    assert.ok(labels.includes('E1:plan-fix1'));
    assert.match(calls.find((c) => c.label === 'E1:plan-fix1').prompt, new RegExp(m ? B2 : 'did not measure'));
  }
  const c = (await exec({ cards: [card('E1')], deliverables: ['E1'] })).calls.find((x) => x.label === 'E1:plan-review1');
  assert.match(c.prompt, /measuredPlanBlob/);
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
  assert.deepEqual(r.resumeArgs.authorizeExternal, []);
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
  assert.equal(a.deliverable, null);
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
  assert.match(p, /NEVER touch the branch main or the worktree \/r, except the integration worktree of the target when the operator authorized checkout:integracao\/x\./);
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

test('item 11: the record and docs prompts forbid a strategy revision', async () => {
  const planOnly = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' } });
  const full = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const prompts = [
    planOnly.calls.find((c) => c.label === 'E1:status-c').prompt,
    full.calls.find((c) => c.label === 'E1:status-d').prompt,
    full.calls.find((c) => c.label === 'E1:docs1').prompt,
  ];
  for (const p of prompts) {
    assert.match(p, /Do NOT propose, write or approve a strategy revision/);
    assert.match(p, /pre-approval never covers them/);
  }
  assert.match(full.calls.find((c) => c.label === 'E1:spec').prompt, /except a strategy revision or migration/);
});

// ---- final-review fixes (I1-I5, minors)
const foreignNoBase = (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/r', targetHead: 'abc1234', clean: true, envFacts: 'x' } : undefined);

test('I1: an unauthorized foreign checkout returns no baseline and only the hold follows', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignNoBase });
  assert.ok(!r.operatorActions.some((o) => /^preflight:/.test(o.kind)));
  assert.equal(r.operatorActions.find((o) => o.kind === 'authorize-external').item, 'checkout:integracao/x');
  assert.ok(!labels.some((l) => /gates|setup/.test(l)));
  assert.equal(r.status, 'needs-operator');
});

test('I1: without authorization the preflight prompt stops after locating a foreign worktree', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignNoBase });
  const p = calls.find((c) => c.label === 'preflight').prompt;
  assert.match(p, /If that path is not \/wt\/_integracao[\s\S]*STOP here/);
  assert.match(p, /no setup, no install, no beforeEvidence and no gates/);
  assert.match(p, /Only if step 2 did not stop/);
});

test('I1: with the checkout authorized the preflight may run in it and a missing baseline is still invalid', async () => {
  const args = { authorizeExternal: ['checkout:integracao/x'] };
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre, args });
  const p = a.calls.find((c) => c.label === 'preflight').prompt;
  assert.doesNotMatch(p, /STOP here/);
  assert.match(p, /AUTHORIZED checkout:integracao\/x/);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignNoBase, args });
  assert.ok(b.r.operatorActions.some((o) => /^preflight:/.test(o.kind)));
});

const deploy = 'curl -X POST https://prod.example/deploy';
const extRow = { ac: 'AC1', kind: 'smoke', command: deploy, external: true, externalDedupe: 'GET /deploys first' };
const safeTasks = [tk(1, false)];
const planRows = (ac, tasks = safeTasks, blob = B1) => (l) => (l === 'E1:plan' ? { ...planWith(tasks), planBlob: blob, ac } : undefined);
const blobReview = (blob, fn) => (l, p, o) => (/plan-review/.test(l) ? { issues: [], headSha: 'h1', clean: true, commitsInRange: 2, measuredPlanBlob: blob } : fn(l, p, o));
const evOk = (l) => (/:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'h2' : 'h3', clean: true, results: [{ ac: 'AC1', command: deploy, exit: 0 }] } : undefined);

test('I2: an unauthorized external evidence row is held before any final review, gate or evidence run', async () => {
  const fp = fpOf(safeTasks);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([extRow]) });
  for (const bad of ['E1:sync', 'E1:gates1-1', 'E1:evidence1', 'E1:merge']) assert.ok(!labels.includes(bad), bad);
  assert.ok(!labels.some((l) => /fix/.test(l)));
  assert.ok(labels.includes('E1:t1:impl'));
  const res = r.results.find((x) => x.id === 'E1');
  assert.equal(res.merged, false);
  assert.equal(res.failKind, 'externo');
  assert.ok(!r.operatorActions.some((o) => o.kind === 'defect'));
  const a = ext(r);
  assert.equal(a.length, 1);
  assert.equal(a[0].item, 'E1:AC1@' + fp);
  assert.equal(a[0].deliverable, 'E1');
  assert.ok(a[0].what.includes(deploy));
  assert.match(a[0].doNow, /GET \/deploys first/);
  assert.deepEqual(a[0].resumeWith.authorizeExternal, ['E1:AC1@' + fp]);
  assert.deepEqual(a[0].resumeWith.deliverables, ['E1']);
});

test('I2: an authorized evidence row runs, is told it is authorized, and the authorization ends with the merge', async () => {
  for (const item of ['E1:AC1', 'E1:AC1@' + fpOf(safeTasks)]) {
    const rows = planRows([extRow]);
    const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: [item] }, over: (l) => rows(l) ?? evOk(l) });
    assert.equal(r.results[0].merged, true);
    const p = calls.find((c) => c.label === 'E1:evidence1').prompt;
    assert.ok(p.includes('AC1: ' + deploy));
    assert.match(p, /AUTHORIZED[\s\S]*GET \/deploys first/);
    assert.deepEqual(r.resumeArgs.authorizeExternal, []);
  }
});

test('I2: an authorization bound to another plan does not release the row', async () => {
  const B3 = 'a'.repeat(40);
  const item = 'E1:AC1@' + PU.planFingerprint(safeTasks, B1);
  const rows = planRows([extRow], safeTasks, B3);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: [item] }, over: blobReview(B3, rows) });
  assert.ok(!labels.includes('E1:evidence1'));
  assert.equal(ext(r)[0].item, 'E1:AC1@' + PU.planFingerprint(safeTasks, B3));
});

test('I2: the first external stop lists held tasks and held evidence together', async () => {
  const tasks = [tk(1, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([extRow], tasks) });
  assert.deepEqual(ext(r).map((a) => a.item).sort(), ['E1:AC1@' + fpOf(tasks), 'E1:T1@' + fpOf(tasks)].sort());
});

test('I2: a row without the flag rejects the plan, and two rows of one criterion make one item', async () => {
  const noFlag = { ac: 'AC1', kind: 'test', command: 'npm test -- a' };
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([noFlag]) });
  assert.ok(a.labels.includes('E1:plan-fix1'));
  assert.ok(!a.labels.includes('E1:evidence1'));
  assert.equal(a.r.results[0].merged, false);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([extRow, { ...extRow, command: 'curl b' }]) });
  assert.equal(ext(b.r).length, 1);
  assert.ok(ext(b.r)[0].what.includes('curl b'));
});

test('I2: human and blocked rows need no flag and are never held', async () => {
  const c = card('E1', { acceptance: [{ id: 'AC1', text: 'works' }, { id: 'AC2', text: 'ok' }] });
  const { r } = await exec({ cards: [c], deliverables: ['E1'], over: planRows([{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }, { ac: 'AC2', kind: 'human' }]) });
  assert.equal(r.results[0].merged, true);
  assert.equal(ext(r).length, 0);
});

test('I2: the plan prompts ask each evidence row for external', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'E1:plan').prompt, /each evidence row[^\n]*external/i);
  assert.equal(calls.find((c) => c.label === 'E1:plan').opts.schema.properties.ac.items.properties.external.type, 'boolean');
});

test('I2/I3: the plan review checks the flags against the JSON the code acts on', async () => {
  const rows = planRows([extRow], [tk(1, false, { title: 'deploy to prod' })]);
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: rows });
  const p = calls.find((c) => c.label === 'E1:plan-review1').prompt;
  assert.match(p, /steps touch anything outside the branch but which declares external false/);
  assert.match(p, /evidence row[^;]*command[^;]*outside the branch[^;]*external false/);
  assert.ok(p.includes('deploy to prod') && p.includes('"external":false'));
  assert.ok(!p.includes(deploy), 'the rows the code compares must not be shown to the reviewer that measures them');
});

test('I4: the gate action says it only covers later merges and that the gate repeats', async () => {
  const e2e = { name: 'e2e', cmd: 'npm run e2e', kind: 'exit', restricted: true };
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { gates: [...GATES, e2e] } });
  const a = ext(r).find((x) => x.item === 'gate:e2e');
  assert.match(a.doNow, /only to deliverables merged after/);
  assert.match(a.doNow, /measures nothing for deliverables already merged/);
  assert.match(a.doNow, /several times per deliverable: baseline, branch, post-merge and retries/);
  assert.doesNotMatch(a.doNow, /Until then/);
});

test('I4/I2: SKILL.md and operator.md describe the gate question and the evidence item', async () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const f of ['SKILL.md', join('references', 'operator.md')]) {
    const t = readFileSync(join(dir, f), 'utf8');
    assert.match(t, /only to deliverables merged after/, f);
    assert.match(t, /measures nothing for deliverables already merged/, f);
    assert.match(t, /several times per deliverable/, f);
    assert.match(t, /E<n>:AC<k>|E18:AC1/, f);
    assert.match(t, /missing the flag counts as external/, f);
  }
});

test('I5: the review log data carries the human inputs of the implementers', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (l === 'E1:t1:impl' ? { status: 'NEEDS_HUMAN', summary: 's', checks: [], humanInputs: [{ what: 'real API key', blocking: false }] } : undefined) });
  const log = calls.find((c) => c.label === 'E1:review-log').prompt;
  assert.ok(log.includes('real API key'));
  assert.match(log, /"humanInputs":\[/);
});

test('I5: finish-merge reads the logged human inputs and the plan evidence rows', async () => {
  const { r, calls } = await exec({ cards: [unfinished()], deliverables: ['E1'],
    over: (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'real API key' }, { what: 'real API key' }], ac: [{ ac: 'AC1', kind: 'human' }] } : undefined) });
  const p = calls.find((c) => c.label === 'E1:resume-review-log').prompt;
  assert.match(p, /docs\/superpowers\/plans\/\*-E1-\*\.md/);
  assert.match(p, /Acceptance criteria evidence/);
  assert.match(p, /humanInputs[^.]*review log/);
  assert.ok(calls.find((c) => c.label === 'E1:resume-review-log').opts.schema.required.includes('ac'));
  const act = r.operatorActions.find((o) => o.kind === 'human-act' && o.deliverable === 'E1');
  assert.ok(act);
  assert.match(act.what, /AC1/);
  assert.equal(r.results[0].human.filter((h) => /real API key/.test(h)).length, 1);
});

test('I5: a human plan row gives the same action on resume as in the normal path', async () => {
  const normal = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([{ ac: 'AC1', kind: 'human' }]) });
  const resumed = await exec({ cards: [unfinished()], deliverables: ['E1'],
    over: (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [], ac: [{ ac: 'AC1', kind: 'human' }] } : undefined) });
  const pick = (x) => x.r.operatorActions.filter((o) => o.kind === 'human-act').map((o) => [o.what, o.doNow]);
  assert.equal(pick(normal).length, 1);
  assert.deepEqual(pick(resumed), pick(normal));
});

const needsHuman = { status: 'NEEDS_HUMAN', summary: 'needs a key', checks: [], humanInputs: [{ what: 'prod key' }] };
const zeroCommits = (l) => (/:t\d+:(spec|quality)/.test(l) ? { issues: [], headSha: 'h1', clean: true, commitsInRange: 0 } : undefined);

test('minor 1: an authorized external task that needs a human with zero commits holds the merge and keeps the authorization', async () => {
  const tasks = [tk(1, true)];
  const fp = fpOf(tasks);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] },
    over: withPlan(tasks, (l) => (l === 'E1:t1:impl' ? needsHuman : zeroCommits(l))) });
  assert.ok(!labels.includes('E1:merge'));
  assert.equal(r.results[0].merged, false);
  assert.equal(r.results[0].failKind, 'humano');
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E1:T1@' + fp]);
  const h = r.operatorActions.find((o) => o.kind === 'human-input');
  assert.ok(h && /prod key/.test(h.what));
  assert.deepEqual(h.resumeWith.authorizeExternal, ['E1:T1@' + fp]);
});

test('minor 1: NEEDS_HUMAN on a non-external task follows the normal path, with or without commits', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], (l) => (l === 'E1:t1:impl' ? needsHuman : zeroCommits(l))) });
  assert.equal(a.r.results[0].merged, true);
  assert.ok(!a.labels.includes('E1:t1:awaiting-person'));
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.equal(b.r.results[0].merged, true);
  assert.ok(b.labels.includes('E1:t1:spec1'));
});

// ---- authorized external task with NEEDS_HUMAN: never merges
const ext1 = [tk(1, true)];
const extArgs = { authorizeExternal: ['E1:T1'] };
const noInputs = { status: 'NEEDS_HUMAN', summary: 'placeholder only', checks: [] };
const assertStopped = (x, input) => {
  const { r, labels } = x;
  assert.ok(!labels.includes('E1:merge'));
  assert.equal(r.results[0].merged, false);
  assert.equal(r.results[0].failKind, 'humano');
  const h = r.operatorActions.find((o) => o.kind === 'human-input');
  assert.ok(h, 'human-input action');
  assert.match(h.what, /not known whether the external effect started/);
  assert.match(h.what, /task 1/);
  assert.match(h.what, input);
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E1:T1@' + fpOf(ext1)]);
  assert.deepEqual(h.resumeWith.authorizeExternal, ['E1:T1@' + fpOf(ext1)]);
  assert.ok(!labels.some((l) => /:t1:(spec|quality)-fix/.test(l)), 'no fix round');
  assert.ok(!x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'), 'not recorded as run');
};

test('authorized external NEEDS_HUMAN with a commit and no humanInputs stops, naming the task', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? noInputs : undefined)) });
  assertStopped(x, /placeholder only/);
});

test('authorized external NEEDS_HUMAN with a commit and humanInputs stops', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assertStopped(x, /prod key/);
});

test('authorized external NEEDS_HUMAN with zero commits stops the same way', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : zeroCommits(l))) });
  assertStopped(x, /prod key/);
});

test('the stop leaves a durable mark on the branch, and the progress read reports it', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.match(calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt, /--allow-empty.*E1 T1 awaiting person \(effect unknown\):/);
  const prog = calls.find((c) => c.label === 'E1:progress');
  assert.match(prog.prompt, /awaitingPerson/);
  assert.ok(prog.opts.schema.required.includes('awaitingPerson'));
});

test('a mark that cannot be written is said in the action', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : /awaiting-person/.test(l) ? null : undefined)) });
  assert.equal(x.r.results[0].merged, false);
  assert.match(x.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /launch stays open/);
});

const pendingProgress = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1] } : undefined);

test('resume: a task that stopped with commits runs again and a repeated NEEDS_HUMAN stops once more', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (l === 'E1:t1:impl' ? noInputs : undefined)) });
  assertStopped(x, /placeholder only/);
  assert.equal(x.labels.filter((l) => l === 'E1:t1:impl').length, 1);
});

test('resume: a task that stopped with commits does not count as done, and is recorded only when it completes', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, pendingProgress) });
  assert.equal(x.labels.filter((l) => l === 'E1:t1:impl').length, 1);
  assert.equal(x.r.results[0].merged, true);
  assert.ok(x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
});

test('resume: without the mark a committed task keeps the resume path', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
});

test('resume: without the authorization the pending task is held, not relaunched', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan(ext1, pendingProgress) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.equal(x.r.results[0].failKind, 'externo');
});

// Reviews count commits as git would: only a range from the task's own first parent holds the earlier commits.
const rerunRange = (l, prompt) => (/:t1:(spec|quality)\d/.test(l) ? { issues: [], headSha: 'h1', clean: true, commitsInRange: prompt.includes('log -p p..HEAD') ? 3 : 0 } : undefined);

test('resume: a re-run that completes with no new commit passes, spends no fix and records the effect', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: both((l) => (l === 'E1:plan' ? planWith(ext1) : undefined), pendingProgress, rerunRange) });
  assert.equal(x.r.results[0].merged, true);
  assert.ok(!x.labels.some((l) => /:t1:(spec|quality)-fix/.test(l)), 'no fix round');
  assert.ok(x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
  const review = x.calls.find((c) => c.label === 'E1:t1:spec1').prompt;
  assert.match(review, /awaiting person:[^\n]*not extra scope/);
});

test('resume: a completed re-run clears the mark right after the implementer, before any review', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, pendingProgress) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:clear-awaiting').prompt, /--allow-empty.*"E1 T1: /);
  assert.ok(x.labels.indexOf('E1:t1:impl') < x.labels.indexOf('E1:t1:clear-awaiting'));
  assert.ok(x.labels.indexOf('E1:t1:clear-awaiting') < x.labels.indexOf('E1:t1:spec1'));
});

test('resume: a repeated NEEDS_HUMAN does not clear the mark', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (l === 'E1:t1:impl' ? noInputs : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:clear-awaiting'));
});

test('resume: a first run with no commits still gets its completion cleared', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [], awaitingPerson: [1] } : undefined)) });
  assert.ok(x.labels.includes('E1:t1:clear-awaiting'));
  assert.equal(x.r.results[0].merged, true);
});

test('a mark that cannot be cleared is a concern', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (/clear-awaiting/.test(l) ? null : undefined)) });
  assert.ok(x.r.results[0].concerns.some((c) => /mark was not cleared/.test(c)));
});

test('a task with commits before a stopped task is not reviewed again over the stopped commits', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] },
    over: withPlan(tasks, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p1', last: 'c1' }, { n: 2, firstParent: 'p', last: 'c' }], awaitingPerson: [2] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:spec1'));
  assert.ok(x.labels.includes('E1:t2:impl'));
});

test('a mark agent that rejects still ends in the human stop, with the warning', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => { if (/awaiting-person/.test(l)) throw new Error('boom'); return l === 'E1:t1:impl' ? needsHuman : undefined; }) });
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.match(x.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /launch stays open/);
});

const reviewIssue = (l) => (l === 'E1:t1:spec1' ? { issues: [{ severity: 'important', category: 'defeito', description: 'd' }], headSha: 'h1', clean: true, commitsInRange: 2 } : undefined);

test('a fix round that ends in NEEDS_HUMAN stops an authorized external task at once', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:t1:spec-fix1' ? { status: 'NEEDS_HUMAN', summary: 'needs a key', checks: [], humanInputs: [{ what: 'fix key' }] } : reviewIssue(l))) });
  assert.equal(x.r.results[0].merged, false);
  assert.equal(x.r.results[0].failKind, 'humano');
  const act = x.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(act.what, /task 1.*fix round needs a person.*reported the external effect done.*fix key/);
  assert.match(act.doNow, /before repeating it.*checks outbox\.log first/);
  assert.match(x.r.results[0].error, /reported the external effect done/);
  for (const t of [act.what, act.doNow, x.r.results[0].error, x.calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt]) assert.doesNotMatch(t, /did not complete/);
  assert.ok(!x.labels.includes('E1:t1:spec2'));
  assert.ok(!x.labels.includes('E1:t1:quality1'));
  assert.ok(x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'), 'the implementer reported the effect done: it is recorded (N8)');
});

test('a fix round with NEEDS_HUMAN on a non-external task keeps the normal path', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: withPlan([tk(1, false)], (l) => (l === 'E1:t1:spec-fix1' ? { status: 'NEEDS_HUMAN', summary: 's', checks: [] } : l === 'E1:t1:spec2' ? { issues: [], headSha: 'h1', clean: true, commitsInRange: 2 } : reviewIssue(l))) });
  assert.equal(x.r.results[0].merged, true);
  assert.ok(x.labels.includes('E1:t1:spec2'));
});

test('minor 2: the merge agent is told when the checkout is authorized', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre, args: { authorizeExternal: ['checkout:integracao/x'] } });
  assert.match(a.calls.find((c) => c.label === 'E1:merge').prompt, /The operator authorized checkout:integracao\/x/);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.doesNotMatch(b.calls.find((c) => c.label === 'E1:merge').prompt, /The operator authorized checkout:/);
});

test('minor 4: gate and checkout items leave resumeArgs when no deliverable remains, and stay otherwise', async () => {
  const items = ['gate:x', 'checkout:integracao/x'];
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: items } });
  assert.deepEqual(a.r.resumeArgs.authorizeExternal, []);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: items }, over: withPlan([tk(1, true)]) });
  assert.deepEqual(b.r.resumeArgs.authorizeExternal, items);
});

// ---- leva 2, bloco A
const cmdRow = (command, over = {}) => ({ ac: 'AC1', kind: 'smoke', command, external: true, externalDedupe: 'd', ...over });
const reviewRows = (rows) => (l) => (/plan-review/.test(l) ? { issues: [], headSha: 'h1', clean: true, commitsInRange: 2, measuredPlanBlob: B1, evidenceRows: rows } : undefined);
const authAc = () => ({ authorizeExternal: ['E1:AC1@' + fpOf(safeTasks)], maxFixRounds: 0 });
const mism = (plan, measured) => exec({ cards: [card('E1')], deliverables: ['E1'], args: authAc(), over: both(planRows(plan), reviewRows(measured)) });

test('decision 1: a row in the plan JSON that the file does not have is a defect and never runs', async () => {
  const { r, labels } = await mism([cmdRow('cmd-A'), cmdRow('cmd-B-not-shown')], [cmdRow('cmd-A')]);
  assert.ok(!labels.some((l) => /:evidence/.test(l)));
  assert.equal(r.results[0].merged, false);
  assert.equal(r.results[0].failKind, 'conteudo');
  assert.match(r.results[0].error, /cmd-B-not-shown/);
});

test('decision 1: a command changed in the transcription is a defect and never runs', async () => {
  const { r, labels } = await mism([cmdRow('cmd-C-changed')], [cmdRow('cmd-A')]);
  assert.ok(!labels.some((l) => /:evidence/.test(l)));
  assert.match(r.results[0].error, /cmd-C-changed/);
  assert.match(r.results[0].error, /cmd-A/);
});

test('decision 1: a row in the file that the JSON dropped is a defect', async () => {
  const { r } = await mism([cmdRow('cmd-A')], [cmdRow('cmd-A'), cmdRow('cmd-in-file')]);
  assert.equal(r.results[0].merged, false);
  assert.match(r.results[0].error, /cmd-in-file/);
});

test('decision 1: an external flag that differs from the file is a defect', async () => {
  const { r, labels } = await mism([cmdRow('cmd-A', { external: false, externalDedupe: undefined })], [cmdRow('cmd-A')]);
  assert.ok(!labels.some((l) => /:evidence/.test(l)));
  assert.match(r.results[0].error, /external/);
});

test('decision 1: a harmless retranscription (backticks) still runs under the authorization', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1@' + fpOf(safeTasks)] },
    over: both(planRows([cmdRow(deploy)]), reviewRows([cmdRow('`' + deploy + '`')]), evOk) });
  assert.ok(labels.includes('E1:evidence1'));
  assert.equal(r.results[0].merged, true);
});

test('decision 1: the reviewer reads the rows from git at the measured blob, and its schema requires them', async () => {
  const rows = planRows([extRow]);
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: rows });
  const c = calls.find((x) => x.label === 'E1:plan-review1');
  assert.match(c.prompt, /evidenceRows/);
  assert.ok(c.prompt.includes('git -C "/wt/E1" show <measuredPlanBlob>'));
  assert.ok(['measuredPlanBlob', 'evidenceRows'].every((k) => c.opts.schema.required.includes(k)));
  assert.ok(calls.find((x) => x.label === 'E1:spec-review1').opts.schema.required.every((k) => k !== 'measuredPlanBlob'));
});

const doneT1 = [{ n: 1, firstParent: 'h0', last: 'c1' }];
const resumedRun = (over, args = {}) => exec({ cards: [card('E1')], deliverables: ['E1'], args,
  over: both((l) => (l === 'E1:progress' ? { head: 'c1', clean: true, done: doneT1 } : undefined), over || (() => undefined)) });
const loggedRun = (l) => (l === 'E1:resume-review-log' ? { found: true, humanInputs: [{ what: 'SECRET-PLACEHOLDER' }], acceptedRisks: [{ stage: 'final', severity: 'minor', category: 'fora-do-escopo', description: 'RISK-X' }], ac: [] } : undefined);

test('important 2: a resume restores human inputs and accepted risks from the persisted log', async () => {
  const { r, calls } = await resumedRun(loggedRun);
  const docs = calls.find((c) => c.label === 'E1:docs1').prompt;
  assert.ok(docs.includes('SECRET-PLACEHOLDER') && docs.includes('RISK-X'));
  assert.ok(r.ownerReview.acceptedRisks.some((x) => x.description === 'RISK-X'));
  assert.ok(r.results[0].human.some((h) => /SECRET-PLACEHOLDER/.test(h)));
  const log = calls.find((c) => c.label === 'E1:review-log').prompt;
  assert.ok(log.includes('SECRET-PLACEHOLDER') && log.includes('RISK-X'));
  assert.ok(calls.find((c) => c.label === 'E1:resume-review-log').prompt.includes('In "/wt/E1" read'));
});

test('important 2: the review log keeps what the file already holds', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'E1:review-log').prompt, /already exists[^.]*keep/i);
});

test('important 2: a run with no committed task does not read the log', async () => {
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.ok(!labels.includes('E1:resume-review-log'));
});

test('important 2: restored items are not duplicated against this run, and a null read is a concern', async () => {
  const { r, calls } = await resumedRun((l) => {
    if (l === 'E1:spec') return { specPath: 'docs/s.md', slug: 'x', decisions: [], humanInputs: [{ what: 'SECRET-PLACEHOLDER' }] };
    return loggedRun(l);
  });
  assert.equal(r.results[0].human.filter((h) => /SECRET-PLACEHOLDER/.test(h)).length, 1);
  assert.equal(calls.find((c) => c.label === 'E1:docs1').prompt.split('SECRET-PLACEHOLDER').length, 2);
  const nul = await resumedRun((l) => (l === 'E1:resume-review-log' ? null : undefined));
  assert.ok(nul.r.results[0].concerns.some((c) => /review log not read/.test(c)));
});

test('rereview minor 1: the evidence doNow lists every re-run of the command', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([extRow]) });
  const d = ext(r)[0].doNow;
  assert.match(d, /after each gates fix/);
  assert.match(d, /late sync/);
  assert.match(d, /invalid measure/);
});

const evidenceFailsOnce = (l) => {
  if (l === 'E1:evidence1') return { headSha: 'h2', clean: true, results: [{ ac: 'AC1', command: deploy, exit: 1, log: 'x' }] };
  if (l === 'E1:gates-fix1') return { status: 'DONE', summary: 'f', checks: [] };
  if (l === 'E1:gates-fix1-review') return { issues: [], headSha: 'h2', clean: true, commitsInRange: 1 };
  if (/:evidence/.test(l)) return { headSha: l === 'E1:evidence2' ? 'h2' : 'h3', clean: true, results: [{ ac: 'AC1', command: deploy, exit: 0 }] };
  return undefined;
};

test('rereview minor 2: the gates fix prompt carries the duplicate check of an external evidence command', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), evidenceFailsOnce) });
  const p = calls.find((c) => c.label === 'E1:gates-fix1').prompt;
  assert.match(p, /duplicate check[^\n]*GET \/deploys first/);
  assert.ok(p.includes(deploy));
});

test('rereview minor 2: a local evidence command adds no such clause', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => {
    if (l === 'E1:evidence1') return { headSha: 'h2', clean: true, results: [{ ac: 'AC1', command: 'npm test -- a', exit: 1, log: 'x' }] };
    if (l === 'E1:gates-fix1') return { status: 'DONE', summary: 'f', checks: [] };
    if (l === 'E1:gates-fix1-review') return { issues: [], headSha: 'h2', clean: true, commitsInRange: 1 };
    return undefined;
  } });
  assert.doesNotMatch(calls.find((c) => c.label === 'E1:gates-fix1').prompt, /duplicate check/);
});

test('rereview minor 3: the authorization sentence is conditional on the plan not changing', async () => {
  const tasks = [tk(1, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] }, over: withPlan(tasks, (l) => (l === 'E1:t1:impl' ? needsHuman : zeroCommits(l))) });
  assert.match(r.operatorActions.find((o) => o.kind === 'human-input').doNow, /stays valid unless the answer changes the plan/);
});

test('minor 6: force does not take an interrupted merge out of FINISH', async () => {
  const { r, labels } = await exec({ cards: [card('E1'), interrupted()], deliverables: ['E1', 'E2'], args: { force: true } });
  assert.ok(!labels.includes('E2:spec'));
  assert.ok(labels.indexOf('E2:merge-gates1-1') < labels.indexOf('E1:merge'));
  assert.ok(r.selection.notes.some((n) => /E2/.test(n) && /force/.test(n)));
});

const hasNotes = (o) => o.resumeWith && o.resumeWith.notes;

test('minor 7: consumed notes leave resumeWith; notes of other deliverables stay', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer', E9: 'later' } }, over: withPlan(tasks) });
  assert.deepEqual(ext(r)[0].resumeWith.notes, { E9: 'later' });
  assert.deepEqual(r.resumeArgs.notes, { E9: 'later' });
  const only = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer' } }, over: withPlan(tasks) });
  assert.equal(ext(only.r)[0].resumeWith.notes, undefined);
  assert.equal(only.r.resumeArgs.notes, undefined);
});

test('minor 7: a template answer is kept, and notes the plan never read stay', async () => {
  const d = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer' } }, over: noHeader });
  assert.equal(d.r.operatorActions.find((o) => o.kind === 'defect').resumeWith.notes.E1, '<owner instruction>');
  const s = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer' } }, over: (l) => (l === 'E1:setup' ? null : undefined) });
  assert.ok(s.r.operatorActions.some((o) => hasNotes(o) && o.resumeWith.notes.E1 === 'answer'));
});

const riskIssue = { severity: 'important', category: 'fora-do-escopo', description: 'RISK-M' };

test('minor 13: a risk accepted on the conflict review is committed before the post-merge gates', async () => {
  const { labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => {
    if (/:merge$/.test(l)) return { mergeCommit: 'm1', firstParent: 'abc1234', secondParent: 'h3', conflicts: 1, clean: true };
    if (l === 'E1:merge-review') return { issues: [riskIssue], headSha: 'm1', clean: true, commitsInRange: 1 };
    return undefined;
  } });
  const at = labels.indexOf('E1:merge-risks');
  assert.ok(at > labels.indexOf('E1:merge-review') && at < labels.indexOf('E1:merge-gates1-1'));
  const p = calls[at].prompt;
  assert.ok(p.includes('RISK-M') && p.includes('/wt/_integracao'));
});

test('minor 13: a risk accepted on the merge fix is committed, and the next measure expects that head', async () => {
  let n = 0;
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => {
    if (/^E1:merge-gates1/.test(l)) return gm('m1', { exit: 1, failedNames: ['t'] });
    if (l === 'E1:merge-fix') return { status: 'DONE', summary: 's', checks: [] };
    if (l === 'E1:merge-fix-review') return { issues: [riskIssue], headSha: 'm8', clean: true, commitsInRange: 1 };
    if (l === 'E1:merge-risks') { n++; return { head: 'm9', commit: 'm9' }; }
    if (/^E1:merge-gates2/.test(l)) return gm('m9');
    return undefined;
  } });
  assert.equal(n, 1);
  assert.ok(labels.indexOf('E1:merge-risks') < labels.indexOf('E1:merge-gates2-1'));
  assert.equal(r.results[0].merge.docsOk, true);
});

test('minor 13: no accepted risk means no extra commit on the target', async () => {
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.ok(!labels.includes('E1:merge-risks'));
});

test('ledger: a stale bound item leaves resumeWith', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2@00000000', 'E2:T1@11111111'] }, over: withPlan(tasks) });
  const fp = fpOf(tasks);
  assert.deepEqual(ext(r)[0].resumeWith.authorizeExternal, ['E2:T1@11111111', 'E1:T2@' + fp]);
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E2:T1@11111111']);
});

test('ledger: a replan that makes a committed task external stops and says the task will not run again', async () => {
  const tasks = [tk(1, true), tk(2, false)];
  const { r, labels } = await resumedRun(withPlan(tasks));
  for (const bad of ['E1:t1:spec1', 'E1:t2:impl', 'E1:sync']) assert.ok(!labels.includes(bad), bad);
  assert.equal(r.results[0].failKind, 'externo');
  const a = ext(r);
  assert.equal(a[0].item, 'E1:T1@' + fpOf(tasks));
  assert.match(a[0].doNow, /already committed[^.]*not run again/i);
});

test('ledger: a committed external task that is authorized goes on', async () => {
  const tasks = [tk(1, true), tk(2, false)];
  const { labels } = await resumedRun(withPlan(tasks), { authorizeExternal: ['E1:T1'] });
  assert.ok(labels.includes('E1:t2:impl'));
});

test('ledger: the checkout item is one action per run, keeping the selection', async () => {
  const { r } = await exec({ cards: [card('E1'), card('E2')], deliverables: ['E1', 'E2'], over: foreignNoBase });
  const a = r.operatorActions.filter((o) => o.item === 'checkout:integracao/x');
  assert.equal(a.length, 1);
  assert.equal(a[0].deliverable, null);
  assert.deepEqual(a[0].resumeWith.deliverables, ['E1', 'E2']);
});

test('ledger: plan-only with every deliverable skipped still explains the hold', async () => {
  let n = 0;
  const budget = { total: 1e9, remaining: () => (n++ === 0 ? 1e9 : 0) };
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: foreignNoBase, budget });
  assert.equal(r.results[0].skipped, true);
  assert.equal(r.operatorActions.filter((o) => o.item === 'checkout:integracao/x').length, 1);
});

test('ledger: the plan path is quoted in the blob measurement', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.ok(calls.find((c) => c.label === 'E1:plan-review1').prompt.includes('rev-parse "HEAD:docs/p.md"'));
});

test('ledger: resume-review-log says what counts as accepted', async () => {
  const { calls } = await exec({ cards: [unfinished()], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:resume-review-log').prompt;
  assert.match(p, /accepted risk[^.]*never a finding that was fixed/i);
});

test('ledger: the closed-blocker doNow names every closed blocker in both remedies', async () => {
  const c = card('E1', { acceptance: [{ id: 'AC1', text: 'a {verify: blocked BLQ-8; evidence: x}' }, { id: 'AC2', text: 'b {verify: blocked BLQ-9; evidence: y}' }] });
  const { r } = await exec({ cards: [c], deliverables: ['E1'], discOver: { blockers: [] } });
  const d = r.operatorActions.find((o) => o.kind === 'decision').doNow;
  assert.match(d, /\{verify: blocked BLQ-8\}[^.]*\{verify: blocked BLQ-9\}/);
  assert.match(d, /reopen BLQ-8, BLQ-9/);
});

test('ledger: the report does not attribute the origin of an effect without evidence', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'report').prompt, /origin of an external effect[^.]*unknown/i);
});

test('ledger: a reused plan without the external declarations is not reusable as is', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'E1:plan').prompt, /A reused plan whose tasks or command evidence rows do not declare external is not reusable/);
});

test('ledger: a finished code segment counts with mergeFound false', async () => {
  const { r } = await exec({ cards: [card('E3', { status: 'code: integrada; acceptance: blocked (BLQ-2)', onTarget: true, mergeFound: false })], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.ok(!r.selection.order.includes('E3'));
});

// ---- bloco A, fix round 1
test('fix 1: a command with a line break does not match the same words on one line', async () => {
  const { r, labels } = await mism([cmdRow('curl ok\nrm prod')], [cmdRow('curl ok rm prod')]);
  assert.ok(!labels.some((l) => /:evidence/.test(l)));
  assert.equal(r.results[0].merged, false);
  assert.match(r.results[0].error, /rm prod/);
});

test('fix 2: a fix on a committed external task is told not to perform the effect', async () => {
  const tasks = [tk(1, true), tk(2, false)];
  let n = 0;
  const { calls, labels } = await resumedRun(withPlan(tasks, (l) => {
    if (l === 'E1:t1:spec1' && n++ === 0) return { issues: [{ severity: 'critical', category: 'defeito', description: 'x' }], headSha: 'h1', clean: true, commitsInRange: 2 };
    if (l === 'E1:t1:spec-fix1') return { status: 'DONE', summary: 'f', checks: [] };
    return undefined;
  }), { authorizeExternal: ['E1:T1'] });
  assert.ok(!labels.includes('E1:t1:impl'));
  const p = calls.find((c) => c.label === 'E1:t1:spec-fix1').prompt;
  assert.match(p, /Do NOT perform any external effect/);
  assert.doesNotMatch(p, /perform the effect at most once/);
});

test('minor 2: both agents return a table-escaped pipe as the pipe that must run', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  for (const l of ['E1:plan', 'E1:plan-review1']) assert.ok(calls.find((c) => c.label === l).prompt.includes(String.raw`table-escaped \| written as |`), l);
});

test('minor 3: a reused worktree with no committed task also restores the log', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'h1', clean: true, reused: true } : loggedRun(l)) });
  assert.ok(calls.find((c) => c.label === 'E1:docs1').prompt.includes('RISK-X'));
  assert.ok(r.ownerReview.acceptedRisks.some((x) => x.description === 'RISK-X'));
});

test('minor 4: a note stays for the resume when the plan review rejects the plan', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...authAc(), notes: { E1: 'answer' } }, over: both(planRows([cmdRow('cmd-A')]), reviewRows([cmdRow('cmd-B')])) });
  assert.equal(r.results[0].merged, false);
  assert.equal(r.resumeArgs.notes.E1, 'answer');
});

test('minor 5: the next plan review does not receive the transcribed command', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1@' + fpOf(safeTasks)], maxFixRounds: 1 },
    over: both((l) => (l === 'E1:plan-fix1' ? { ...planWith(safeTasks), ac: [cmdRow('cmd-A')] } : undefined), planRows([cmdRow('cmd-A'), cmdRow('cmd-B-not-shown')]), reviewRows([cmdRow('cmd-A')])) });
  assert.ok(calls.find((c) => c.label === 'E1:plan-fix1').prompt.includes('cmd-B-not-shown'));
  assert.ok(!calls.find((c) => c.label === 'E1:plan-review2').prompt.includes('cmd-B-not-shown'));
});

test('minor 7: restored human inputs differing only in spacing are one item', async () => {
  const { calls } = await resumedRun((l) => (l === 'E1:resume-review-log' ? { found: true, humanInputs: [{ what: 'H-ONE' }, { what: '  H-ONE ' }], acceptedRisks: [], ac: [] } : undefined));
  assert.equal(calls.find((c) => c.label === 'E1:docs1').prompt.split('H-ONE').length, 2);
});

// ---- bloco A, fix round 2
const wrapped = '`echo echo PWNED`';

test('fix round 2: a wrapped command is dispatched and shown unwrapped', async () => {
  const held = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(planRows([cmdRow(wrapped)]), reviewRows([cmdRow('echo echo PWNED')])) });
  assert.ok(!ext(held.r)[0].what.includes('`echo'));
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] },
    over: both(planRows([cmdRow(wrapped)]), reviewRows([cmdRow('echo echo PWNED')]), (l) => (/:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'h2' : 'h3', clean: true, results: [{ ac: 'AC1', command: 'echo echo PWNED', exit: 0 }] } : undefined)) });
  const p = calls.find((c) => c.label === 'E1:evidence1').prompt;
  assert.match(p, /^AC1: echo echo PWNED$/m);
});

test('fix round 2: extra interior spaces are a defect and never run', async () => {
  const { r, labels } = await mism([cmdRow('curl  ok')], [cmdRow('curl ok')]);
  assert.ok(!labels.some((l) => /:evidence/.test(l)));
  assert.equal(r.results[0].failKind, 'conteudo');
});

test('fix round 2: the defect action keeps an answer no approved plan consumed', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...authAc(), notes: { E1: 'answer' } }, over: both(planRows([cmdRow('cmd-A')]), reviewRows([cmdRow('cmd-B')])) });
  assert.equal(r.operatorActions.find((o) => o.kind === 'defect').resumeWith.notes.E1, 'answer');
});

// ---- bloco A, real-run follow-up
const asksAuth = (l) => (l === 'E1:t1:impl' ? { status: 'DONE', summary: 's', checks: [{ command: 'x', output: 'y', exit: 0 }], humanInputs: [{ what: 'Operator authorization to run ' + deploy + ' (external)' }, { what: 'real API key' }] } : undefined);

const ranMark = (x) => `[already authorized and run in this run: ${x}]`;

test('I1: a request for an authorization already used is annotated and is not offered as an action', async () => {
  const rows = planRows([extRow]);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(rows, asksAuth, evOk) });
  const annotated = 'Operator authorization to run ' + deploy + ' (external) ' + ranMark(deploy);
  assert.deepEqual(r.results[0].human, [annotated, 'real API key']);
  assert.ok(!r.operatorActions.some((o) => JSON.stringify(o).includes('Operator authorization')));
  const report = calls.find((c) => c.label === 'report').prompt;
  assert.ok(report.includes(ranMark(deploy)));
  assert.match(report, /report it as already done and never offer that authorization as an action/);
  assert.match(report, /any other need the item states stays open/);
});

test('I1: a genuine input that mentions approval and the command survives and is visible', async () => {
  const what = 'Real SMTP credentials and approval to send with ' + deploy + ' (placeholder used)';
  const impl = (l) => (l === 'E1:t1:impl' ? { status: 'DONE', summary: 's', checks: [{ command: 'x', output: 'y', exit: 0 }], humanInputs: [{ what }] } : undefined);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), impl, evOk) });
  assert.deepEqual(r.results[0].human, [what + ' ' + ranMark(deploy)]);
  assert.ok(calls.find((c) => c.label === 'E1:docs1').prompt.includes('Real SMTP credentials'));
  assert.ok(calls.find((c) => c.label === 'report').prompt.includes('Real SMTP credentials'));
});

test('I2: an authorized task that returned NEEDS_HUMAN with a placeholder commit is not an effect that ran', async () => {
  const what = 'Approval of the text for E1:T1';
  const impl = (l) => (l === 'E1:t1:impl' ? { status: 'NEEDS_HUMAN', summary: 'placeholder', checks: [{ command: 'x', output: 'y', exit: 0 }], humanInputs: [{ what }] } : undefined);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] }, over: withPlan([tk(1, true)], impl) });
  assert.ok(!calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
  assert.deepEqual(r.results[0].human, [what], 'not annotated: the effect did not happen');
});

test('I2: an authorized task with DONE_WITH_CONCERNS and a commit is recorded', async () => {
  const impl = (l) => (l === 'E1:t1:impl' ? { status: 'DONE_WITH_CONCERNS', summary: 's', concerns: 'c', checks: [{ command: 'x', output: 'y', exit: 0 }] } : undefined);
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] }, over: withPlan([tk(1, true)], impl) });
  assert.ok(calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
});

test('I2: evidence that exited non-zero is not an effect that ran, and its request stays bare', async () => {
  const what = 'Write permission on the shared outbox for ' + deploy;
  const impl = (l) => (l === 'E1:t1:impl' ? { status: 'DONE', summary: 's', checks: [{ command: 'x', output: 'y', exit: 0 }], humanInputs: [{ what }] } : undefined);
  const evFail = (l) => (/gates-fix/.test(l) ? { status: 'BLOCKED', summary: 'no access' } : /:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'h2' : 'h3', clean: true, results: [{ ac: 'AC1', command: deploy, exit: 1, log: 'EACCES' }] } : undefined);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), impl, evFail) });
  assert.ok(calls.some((c) => /:evidence/.test(c.label)));
  assert.ok(!calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:AC1"'));
  assert.deepEqual(r.results[0].human, [what]);
});

test('real run: the same request stays while the command has not run', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(planRows([extRow]), asksAuth) });
  assert.ok(r.results[0].human.some((h) => /Operator authorization/.test(h)));
});

test('real run: spec, plan and implementer are told an authorization is never a human input', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  for (const l of ['E1:spec', 'E1:plan', 'E1:t1:impl']) assert.match(calls.find((c) => c.label === l).prompt, /Authorization of an external effect is never a humanInput/, l);
});

test('real run: the report gets the effects that ran and may not invent an action', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), evOk) });
  const p = calls.find((c) => c.label === 'report').prompt;
  assert.ok(p.includes('External effects authorized and run'));
  assert.ok(p.includes('"item":"E1:AC1"') && p.includes(deploy) && p.includes('"exit":0'));
  assert.ok(p.includes('Authorizations given for this run: ["E1:AC1"]'));
  assert.match(p, /only from Operator actions and the open human items/);
  assert.match(p, /never invent an action or resume args/);
  assert.match(p, /never ask for it again/);
});

test('real run: an authorized task that ran is reported too', async () => {
  const tasks = [tk(1, true)];
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] }, over: withPlan(tasks) });
  assert.ok(calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
});

test('real run: programs that need a directory are run with cd, since a Bash call may start elsewhere', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { docsStage: { instructions: 'x', measure: 'm' } } });
  assert.ok(calls.find((c) => c.label === 'E1:test-integrity').prompt.includes('cd "/wt/E1" && node "/wt/_tmp/E1-integrity.cjs" "integracao/x"'));
  const m = calls.find((c) => c.label === 'E1:docs-measure1').prompt;
  assert.ok(m.includes('cd "/wt/_integracao" && node "/wt/_tmp/E1-docs-measure.cjs"'));
  assert.ok(m.includes('cd "/wt/_integracao" && node "docs/plans/roadmap-x/check.mjs"'));
  const res = await exec({ cards: [unfinished()], deliverables: ['E1'] });
  assert.ok(res.calls.find((c) => c.label === 'E1:resume-test-integrity').prompt.includes('cd "/wt/_tmp/E1-integrity-wt" && node "/wt/_tmp/E1-integrity.cjs" "m0^1"'));
});

// ---- leva 3, bloco A
test('decision 2: only the completion subject clears the mark in the progress read', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  const p = calls.find((c) => c.label === 'E1:progress').prompt;
  assert.match(p, /awaitingPerson = [^\n]*"E1 T<n> awaiting person:"[^\n]*"E1 T<n>: external effect completed"/);
  assert.match(p, /any other "E1 T<n>:" commit does not count/i);
});

test('decision 2: the action of a stop names the subject that clears the mark', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.match(x.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /"E1 T1: external effect completed"/);
});

test('decision 2: a mark that cannot be cleared names the completion subject', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (/clear-awaiting/.test(l) ? null : undefined)) });
  assert.ok(x.r.results[0].concerns.some((c) => /mark was not cleared/.test(c) && c.includes('"E1 T1: external effect completed"')));
});

test('a mark cleared with success raises no concern', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (/clear-awaiting/.test(l) ? { ok: true } : undefined)) });
  assert.ok(x.labels.includes('E1:t1:clear-awaiting'));
  assert.equal(x.r.results[0].merged, true);
  assert.ok(!x.r.results[0].concerns.some((c) => /mark was not cleared/.test(c)));
});

test('resume: the range note names the spec and the plan of the resume', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: both((l) => (l === 'E1:plan' ? planWith(ext1) : undefined), pendingProgress, rerunRange) });
  const review = x.calls.find((c) => c.label === 'E1:t1:spec1').prompt;
  assert.match(review, /not extra scope[^\n]*docs\/s\.md[^\n]*docs\/p\.md[^\n]*not extra scope/);
});

test('decision 3: a quoted command is dispatched with its quotes', async () => {
  const q = '"./my tool"';
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] },
    over: both(planRows([cmdRow(q)]), reviewRows([cmdRow(q)]), (l) => (/:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'h2' : 'h3', clean: true, results: [{ ac: 'AC1', command: q, exit: 0 }] } : undefined)) });
  assert.equal(r.results[0].merged, true);
  assert.match(calls.find((c) => c.label === 'E1:evidence1').prompt, /^AC1: "\.\/my tool"$/m);
});

test('the progress read names the task numbers that awaitingPerson covers, so a mark-only task is not missed', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan([tk(1, true), tk(2, true)]) });
  assert.match(calls.find((c) => c.label === 'E1:progress').prompt, /awaitingPerson = every n of \[1, 2\] with a commit/);
});

const clearedProgress = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [] } : undefined);

test('resume after the mark was cleared: the review of an external task still gets the bookkeeping note', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, clearedProgress) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.match(x.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /awaiting person:[^\n]*not extra scope/);
});

test('resume of a task that is not external gets no bookkeeping note', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], clearedProgress) });
  assert.ok(!x.calls.find((c) => c.label === 'E1:t1:spec1').prompt.includes('awaiting person:'));
});

test('decision 3: a quoted command against its bare form is a defect and never runs', async () => {
  const { r, labels } = await mism([cmdRow('"./my tool"')], [cmdRow('./my tool')]);
  assert.ok(!labels.some((l) => /:evidence/.test(l)));
  assert.equal(r.results[0].merged, false);
});

test('the docs stage explains the mark: a fulfilled request leaves pending, any other need stays', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), asksAuth, evOk) });
  const docs = calls.find((c) => c.label === 'E1:docs1').prompt;
  assert.ok(docs.includes(ranMark(deploy)));
  assert.match(docs, /marked "\[already authorized and run in this run: \.\.\.\]"[^\n]*only[^\n]*leave it out of pending[^\n]*any other need the item states stays open in pending/);
});

// ---- A2/A4: review model by task, plan-fix tier
const issueRev = (iss) => ({ issues: iss, headSha: 'h1', clean: true, commitsInRange: 2 });
const defect = { severity: 'critical', category: 'defeito', description: 'same defect', file: 'a.js' };
const modelOf = (calls, label) => calls.find((c) => c.label === label).opts;

test('task review model: opus task and external task are reviewed by opus, a plain sonnet task by sonnet', async () => {
  const tasks = [tk(1, false), tk(2, false, { tier: 'opus' }), tk(3, true)];
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T3'] }, over: withPlan(tasks) });
  assert.equal(modelOf(calls, 'E1:t1:spec1').model, 'sonnet');
  assert.equal(modelOf(calls, 'E1:t2:spec1').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t3:spec1').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t3:spec1').effort, 'medium');
});

test('re-review after a fix escalated to opus runs at opus', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: withPlan([tk(1, false)], (l) => (/^E1:t1:spec[12]$/.test(l) ? issueRev([defect]) : /^E1:t1:spec-fix/.test(l) ? { status: 'DONE', summary: 'f', checks: [] } : undefined)) });
  assert.equal(modelOf(calls, 'E1:t1:spec-fix1').model, 'sonnet');
  assert.equal(modelOf(calls, 'E1:t1:spec2').model, 'sonnet');
  assert.equal(modelOf(calls, 'E1:t1:spec-fix2').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t1:spec3').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t1:spec3').effort, 'medium');
});

test('plan fix starts at sonnet, the reviewer stays opus, and a repeated finding escalates the fix to opus', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (/^E1:plan-review[12]$/.test(l) ? { ...issueRev([defect]), measuredPlanBlob: B1 } : /^E1:plan-fix/.test(l) ? planWith([tk(1, false)]) : undefined) });
  assert.equal(modelOf(calls, 'E1:plan-fix1').model, 'sonnet');
  assert.equal(modelOf(calls, 'E1:plan-fix1').effort, 'medium');
  assert.equal(modelOf(calls, 'E1:plan-fix2').model, 'opus');
  assert.equal(modelOf(calls, 'E1:plan-review1').model, 'opus');
  assert.equal(modelOf(calls, 'E1:plan-review2').model, 'opus');
});

// ---- N5: the progress read of a plan with an external task
test('N5: progress runs at sonnet/medium and requires the mark lists when the plan has an external task', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  const p = modelOf(calls, 'E1:progress');
  assert.equal(p.model, 'sonnet');
  assert.equal(p.effort, 'medium');
  assert.ok(p.schema.required.includes('launchOpen') && p.schema.required.includes('effectMayHaveRun'));
});

test('N5: a plan without external tasks keeps the progress read as it was', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)]) });
  const p = calls.find((c) => c.label === 'E1:progress');
  assert.equal(p.opts.model, 'haiku');
  assert.equal(p.opts.effort, 'low');
  assert.ok(!p.opts.schema.required.includes('launchOpen'));
  assert.doesNotMatch(p.prompt, /launchOpen|launching/);
});

// ---- N6: a stop in a fix round
const fixStop = (l) => (l === 'E1:t1:spec-fix1' ? { status: 'NEEDS_HUMAN', summary: 'needs a key', checks: [], humanInputs: [{ what: 'fix key' }] } : reviewIssue(l));
const mayHaveRun = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [1] } : undefined);

test('N6: a stop in a fix round writes its own subject', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, fixStop) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt, /--allow-empty -m "E1 T1 awaiting person \(effect may have run\): /);
});

test('N6: the resume does not launch the implementer again, and its fixes carry no authorization', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(mayHaveRun, (l) => (l === 'E1:t1:spec-fix1' ? { status: 'DONE', summary: 'f', checks: [] } : reviewIssue(l)))) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.ok(!x.labels.includes('E1:t1:launching'));
  assert.ok(x.labels.includes('E1:t1:spec1'));
  const fix = x.calls.find((c) => c.label === 'E1:t1:spec-fix1').prompt;
  assert.doesNotMatch(fix, /AUTHORIZED/);
  assert.match(fix, /Do NOT perform any external effect/);
  assert.equal(x.r.results[0].merged, true);
});

test('N6: the mark wins over the awaiting list and over a legacy reading', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1], launchOpen: [], effectMayHaveRun: [1] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
});

test('N6: the progress read also takes the old subject of a fix-round stop as may-have-run', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(calls.find((c) => c.label === 'E1:progress').prompt, /effectMayHaveRun = [^\n]*"E1 T<n> awaiting person: a fix round needs a person"/);
});

test('N6: may have run with no commit of the task stops and asks, never relaunches', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [1] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.equal(x.r.results[0].failKind, 'humano');
});

// ---- N7: the launch mark
const launchOpen = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [], launchOpen: [1], effectMayHaveRun: [] } : undefined);

test('N7: the launch mark is an empty commit in the worktree, before the implementer', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  const m = x.calls.find((c) => c.label === 'E1:t1:launching').prompt;
  assert.match(m, /git -C "\/wt\/E1" commit --allow-empty -m "E1 T1 launching"/);
  assert.ok(x.labels.indexOf('E1:t1:launching') < x.labels.indexOf('E1:t1:impl'));
  assert.ok(x.labels.indexOf('E1:t1:impl') < x.labels.indexOf('E1:t1:effect-completed'));
  assert.ok(x.labels.indexOf('E1:t1:effect-completed') < x.labels.indexOf('E1:t1:spec1'));
  assert.match(x.calls.find((c) => c.label === 'E1:t1:effect-completed').prompt, /--allow-empty -m "E1 T1: external effect completed"/);
  assert.equal(x.r.results[0].merged, true);
});

test('N7: the launch mark subject does not look like a task commit to the progress read', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(calls.find((c) => c.label === 'E1:progress').prompt, /--grep "\^E1 T<n>:"/);
  assert.ok(!/^E1 T1:/.test('E1 T1 launching'));
});

test('N7: without a written launch mark the implementer does not start', async () => {
  for (const bad of [null, { ok: false }, { ok: true }]) {
    const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:launching' ? bad : undefined)) });
    assert.ok(!x.labels.includes('E1:t1:impl'));
    assert.equal(x.r.results[0].failKind, 'infra');
  }
});

test('N7: the review range starts after the launch mark, so the marks do not stand for a commit', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /rev-list --count L1\.\.HEAD/);
});

test('N7: an implementer that reports DONE with only the completion mark in the range is a defect', async () => {
  const onlyMark = (l) => (l === 'E1:t1:spec1' ? { issues: [], headSha: 'h1', clean: true, commitsInRange: 1 } : l === 'E1:t1:spec-fix1' ? { status: 'BLOCKED', summary: 'nothing to commit', checks: [] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, onlyMark) });
  assert.ok(x.labels.includes('E1:t1:spec-fix1'));
  assert.equal(x.r.results[0].merged, false);
});

test('N7: a crash between the effect and the commit stops and asks on resume, with the two ways out', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, launchOpen) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.ok(!x.labels.includes('E1:t1:launching'));
  assert.ok(!x.labels.includes('E1:merge'));
  assert.equal(x.r.results[0].failKind, 'humano');
  const act = x.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(act.what, /task 1/);
  assert.match(act.doNow, /checks outbox\.log first/);
  assert.match(act.doNow, /"E1 T1: external effect completed"/);
  assert.match(act.doNow, /"E1 T1 awaiting person: confirmed not run"/);
  assert.deepEqual(act.resumeWith.authorizeExternal, ['E1:T1@' + fpOf(ext1)]);
});

// ---- B4: the process dies after the launch mark and the resume replays the cache of the dead run
test('B4: kill after the launch mark, resume with the same cache: a fresh read stops for a person, nothing runs or commits again', async () => {
  const git = { launched: false, completed: false };
  const repo = (l) => {
    if (l === 'E1:t1:launching') { git.launched = true; return { ok: true, head: 'L1' }; }
    if (l === 'E1:progress') {
      return { head: git.launched ? 'L1' : 'h9', clean: true, done: git.completed ? [{ n: 1, firstParent: 'L1', last: 'C1' }] : [], awaitingPerson: [],
        launchOpen: git.launched && !git.completed ? [1] : [], effectMayHaveRun: [], effectCompleted: git.completed ? [1] : [] };
    }
    return undefined;
  };
  const j = makeJournal();
  // Run 1: authorized, writes the launch mark, dies while the implementer runs.
  await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-1' }, over: withPlan(ext1, repo), journal: j.start('E1:t1:impl') }).catch(() => null);
  assert.ok(git.launched, 'the launch mark was written before the kill');
  // Run 2: same script, same args, same cache; only the preflight of this call is new.
  const s2 = j.start();
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-2' }, over: withPlan(ext1, repo), journal: s2 });
  assert.ok(x.labels.includes('E1:progress'), 'the progress read runs live, not from the cache');
  assert.ok(!x.labels.includes('E1:t1:launching') && !s2.cached.includes('E1:t1:launching'), 'the launch step is not reached');
  assert.ok(!x.labels.includes('E1:t1:impl'), 'no new implementer');
  assert.ok(!x.labels.some((l) => /^E1:(review-log|awaiting-person|t1:effect-completed)/.test(l)), 'no commit on the branch');
  assert.equal(x.r.results[0].failKind, 'humano');
  const act = x.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(act.what, /task 1/);
  assert.match(act.doNow, /"E1 T1: external effect completed"/);
  // Run 3: the person confirmed the effect with the completion mark.
  git.completed = true;
  const y = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-3' }, over: withPlan(ext1, repo), journal: j.start() });
  assert.ok(!y.labels.includes('E1:t1:impl') && !y.labels.includes('E1:t1:launching'));
  assert.match(y.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"status":"confirmed by mark"/);
  assert.match(y.calls.find((c) => c.label === 'E1:review-log').prompt, /External effects run[\s\S]*"status":"confirmed by mark"/, 'the branch review log records it (B.L5 greps docs/)');
  assert.equal(y.r.results[0].merged, true);
});

test('B4: without a runToken the progress read may be a cached result, so an authorized external task is not launched', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: undefined }, over: withPlan(ext1) });
  assert.ok(!x.labels.includes('E1:t1:launching'));
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.equal(x.r.results[0].failKind, 'infra');
  assert.match(x.r.results[0].error, /runToken/);
});

test('B4: the runToken never comes back in resume args, so a resume must take a fresh one from its preflight', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, launchOpen) });
  assert.equal(!!x.r.resumeArgs && 'runToken' in x.r.resumeArgs, false);
  for (const o of x.r.operatorActions) assert.equal(!!o.resumeWith && 'runToken' in o.resumeWith, false, o.kind);
  assert.match(x.calls.find((c) => c.label === 'E1:progress').prompt, /pf-test/);
  assert.ok(x.calls.filter((c) => c.label !== 'E1:progress').every((c) => !c.prompt.includes('pf-test')), 'the token is only in the progress read');
});

test('N7: an open launch mark stops even when the awaiting list or the done list also name the task', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1], launchOpen: [1], effectMayHaveRun: [] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.equal(x.r.results[0].failKind, 'humano');
});

test('N7: an implementer that returns BLOCKED or null leaves the launch open: no completion mark', async () => {
  for (const v of [{ status: 'BLOCKED', summary: 'b', checks: [] }, null]) {
    const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? v : undefined)) });
    assert.ok(x.labels.includes('E1:t1:launching'));
    assert.ok(!x.labels.includes('E1:t1:effect-completed'));
    assert.ok(!x.labels.includes('E1:merge'));
  }
});

test('N7: the implementer stop of NEEDS_HUMAN closes the launch with the awaiting mark, not with a completion', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.ok(x.labels.includes('E1:t1:awaiting-person'));
  assert.ok(!x.labels.includes('E1:t1:effect-completed'));
});

test('N7: a completion mark that cannot be written is a concern naming the subject', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:effect-completed' ? null : undefined)) });
  assert.ok(x.r.results[0].concerns.some((c) => c.includes('"E1 T1: external effect completed"')));
});

test('N7: a task without external writes no mark at all', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)]) });
  assert.ok(!x.labels.some((l) => /launching|effect-completed/.test(l)));
});

// ---- N8: the external runs survive in the review log
const ranLog = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve E1:T1 please' }], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', status: 'DONE', reviewed: false }] } : undefined);

test('N8: the effect is recorded even when the review rejects, and goes to the failed log', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, fixStop) });
  const log = x.calls.find((c) => c.label === 'E1:review-log-failed').prompt;
  assert.match(log, /External effects run/);
  assert.match(log, /"externalRun":\[\{"item":"E1:T1"[^\]]*"reviewed":false/);
  assert.match(x.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"reviewed":false/);
});

test('N8: an effect that passed its reviews is recorded as reviewed', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(x.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"reviewed":true/);
});

test('N8: the log is written for a recorded effect even with no review to persist', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (/^E1:(spec|plan)-review/.test(l) ? undefined : /^E1:t1:spec1b?$/.test(l) ? null : undefined)) });
  assert.ok(x.labels.includes('E1:review-log-failed'));
});

test('N8: the resume reads the log and the report does not ask again for what ran', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(ranLog, clearedProgress)) });
  const read = x.calls.find((c) => c.label === 'E1:resume-review-log');
  assert.match(read.prompt, /externalRun = /);
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /External effects authorized and run: \[\{"item":"E1:T1"/);
  assert.equal((rep.match(/External effects authorized and run: (.*)/)[1].match(/"item":"E1:T1"/g) || []).length, 1);
  assert.match(x.r.results[0].human[0], /already authorized and run/);
});

// ---- final-gate corrections
const evMock = (l) => (l === 'E1:merge-effects' ? { head: 'm1', commit: 'm1' } : undefined);
test('I1: an external evidence effect reaches the log on the target right after the merge', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), evOk, evMock) });
  assert.ok(x.labels.indexOf('E1:merge') < x.labels.indexOf('E1:merge-effects'));
  assert.ok(x.labels.indexOf('E1:merge-effects') < x.labels.indexOf('E1:docs1'));
  const p = x.calls.find((c) => c.label === 'E1:merge-effects').prompt;
  assert.match(p, /External effects run/);
  assert.ok(p.includes('"item":"E1:AC1"') && p.includes(deploy));
  assert.equal(x.r.results[0].merged, true);
});

test('I1: no evidence effect means no extra agent; a failed write is a concern', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.ok(!a.labels.includes('E1:merge-effects'));
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), evOk, (l) => (l === 'E1:merge-effects' ? null : undefined)) });
  assert.ok(b.r.results[0].concerns.some((c) => /External effects run|external effects/i.test(c) && c.includes('E1:AC1')));
});

test('I1: a finish-merge reads the effect back and marks the human item', async () => {
  const log = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve ' + deploy }], ac: [], externalRun: [{ item: 'E1:AC1', command: deploy, exit: 0 }] } : undefined);
  const x = await exec({ cards: [unfinished()], deliverables: ['E1'], over: log });
  assert.ok(x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:AC1"'));
  assert.match(x.r.results[0].human[0], /already authorized and run/);
});

const completedMark = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [], effectCompleted: [1] } : undefined);
const askLog = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve E1:T1 please' }], ac: [] } : undefined);

test('I2: a completed mark with nothing in the log is recorded, reviewed, and marks the human item', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(completedMark, askLog)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /"item":"E1:T1"[^\n]*"status":"confirmed by mark"[^\n]*"reviewed":true/);
  assert.match(x.r.results[0].human[0], /already authorized and run/);
  assert.ok(x.calls.find((c) => c.label === 'E1:progress').opts.schema.required.includes('effectCompleted'));
});

test('I2: an entry already restored from the log is not replaced by the mark', async () => {
  const log = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', status: 'DONE', reviewed: false }] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(completedMark, log)) });
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.doesNotMatch(rep, /confirmed by mark"/);
  assert.equal((rep.match(/External effects authorized and run: (.*)/)[1].match(/"item":"E1:T1"/g) || []).length, 1);
});

test('I2: a confirmed task skipped as already reviewed is reported as reviewed', async () => {
  const tasks = [tk(1, true), tk(2, false)];
  const prog = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p1', last: 'c1' }, { n: 2, firstParent: 'p2', last: 'c2' }], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [], effectCompleted: [1] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(tasks, prog) });
  assert.ok(!x.labels.includes('E1:t1:spec1'));
  assert.match(x.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"reviewed":true/);
});

test('I3: NEEDS_HUMAN after an authorized launch writes the unknown mark, which the resume reads as doubt', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt, /-m "E1 T1 awaiting person \(effect unknown\): /);
  const p = x.calls.find((c) => c.label === 'E1:progress').prompt;
  assert.match(p, /launchOpen = [^\n]*"E1 T<n> awaiting person \(effect unknown\):"[^\n]*"E1 T<n> awaiting person: external effect did not complete"/);
  const act = x.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(act.doNow, /"E1 T1 awaiting person: confirmed not run"/);
  assert.doesNotMatch(act.what + act.doNow + x.r.results[0].error, /did not complete|the task runs again and/);
  assert.ok(!x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
});

test('I3: the authorized implementer is told when NEEDS_HUMAN is allowed', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:impl').prompt, /If you need a person, return NEEDS_HUMAN and say in the summary whether the effect started; report DONE or DONE_WITH_CONCERNS only when the effect finished/);
});

// An agent that follows the note: a partial effect is reported as the note orders.
const followsNote = (p, needs) => (/report DONE or DONE_WITH_CONCERNS only when the effect finished|If this fix needs the effect run again, return NEEDS_HUMAN/.test(p)
  ? { status: 'NEEDS_HUMAN', summary: 'effect started, needs a key', checks: [], humanInputs: [{ what: needs }] }
  : { status: 'DONE_WITH_CONCERNS', summary: 'partial', checks: [], humanInputs: [{ what: needs }] });

test('R1: a partial effect that needs a person does not merge', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: (l, p) => (l === 'E1:plan' ? planWith(ext1) : l === 'E1:t1:impl' ? followsNote(p, 'deploy key') : undefined) });
  assert.equal(x.r.results[0].merged, false);
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.ok(x.labels.includes('E1:t1:awaiting-person'));
  assert.ok(!x.labels.includes('E1:t1:effect-completed'));
  assert.ok(!x.labels.includes('E1:merge'));
});

test('R1: NEEDS_HUMAN in a fix round stops again', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: (l, p) => (l === 'E1:plan' ? planWith(ext1) : l === 'E1:t1:spec-fix1' ? followsNote(p, 'fix key') : reviewIssue(l)) });
  assert.equal(x.r.results[0].merged, false);
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.match(x.calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt, /awaiting person \(effect may have run\):/);
  assert.ok(!x.labels.includes('E1:merge'));
});

test('R2: with an open launch an old log line does not reach the report as an effect that ran', async () => {
  const stale = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve E1:T1 please [already authorized and run in this run: E1:T1]' }], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', status: 'DONE', reviewed: false }] } : undefined);
  const prog = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [], launchOpen: [1], effectMayHaveRun: [], effectCompleted: [] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(prog, stale)) });
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.ok(!x.labels.includes('E1:t1:impl'));
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /External effects authorized and run: \[\]/);
  assert.doesNotMatch(x.r.results[0].human[0], /already authorized and run/);
});

const notRun = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1], launchOpen: [], effectMayHaveRun: [], effectCompleted: [] } : undefined);
const staleLog = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve E1:T1 please [already authorized and run in this run: E1:T1]' }], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', status: 'DONE', reviewed: false }] } : undefined);

test('I4: after confirmed not run the restored entry and its human mark are gone', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan(ext1, both(notRun, staleLog, (l) => (/:setup$/.test(l) ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'h1', clean: true, reused: true } : undefined))) });
  assert.equal(x.r.results[0].failKind, 'externo');
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /External effects authorized and run: \[\]/);
  assert.doesNotMatch(x.r.results[0].human[0], /already authorized and run/);
  assert.ok(x.r.operatorActions.some((o) => o.kind === 'authorize-external'));
});

test('I4: a relaunch after confirmed not run records the effect again', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(notRun, staleLog)) });
  assert.match(x.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"reviewed":true/);
});

test('M5/M6: the texts of a stop match what a resume does', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, fixStop) });
  assert.doesNotMatch(a.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /stays awaiting/);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : /awaiting-person/.test(l) ? null : undefined)) });
  assert.match(b.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /stop and ask/);
});

test('N8: a task without external writes no externalRun data to its log', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)]) });
  for (const c of x.calls.filter((k) => /review-log/.test(k.label) && !/resume/.test(k.label))) assert.doesNotMatch(c.prompt, /externalRun|External effects run/);
});

test('assembled prompts: every task runs in the deliverable worktree before the merge (spec, plan, both reviews)', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const rule = /runs in the deliverable worktree \S+ on \S+ before the merge; no task of the plan runs in the integration worktree \(the workflow's own merge, post-merge gates and docs stages run there\)/;
  for (const l of ['E1:spec', 'E1:plan']) {
    const p = calls.find((c) => c.label === l).prompt;
    assert.match(p, rule, l);
    assert.doesNotMatch(p, /\$\{wt\}|\$\{br\}|undefined/, l);
  }
  assert.match(calls.find((c) => c.label === 'E1:plan').prompt, /`external: true`; "not a task of this plan" does not apply to it/);
  assert.match(calls.find((c) => c.label === 'E1:spec-review1').prompt, /a task of the plan, or an external effect of the design, run after the merge, in the integration worktree or in the target \(defeito\)/);
  assert.match(calls.find((c) => c.label === 'E1:plan-review1').prompt, /a task of the plan, or an external effect, marked to run after the merge, in the integration worktree or in the target \(defeito, critical\)/);
  const planP = calls.find((c) => c.label === 'E1:plan').prompt;
  assert.match(planP, /only reads a local file outside the branch[^\n]*is not external; when in doubt, true/);
  assert.equal((planP.match(/only reads a local file outside the branch/g) || []).length, 2, 'task rule and evidence-row rule');
  assert.match(calls.find((c) => c.label === 'E1:plan-review1').prompt, /an external effect that the card or the spec requires \(a delivery, a send, a deploy\) and that no task declared external performs/);
  assert.ok(calls.some((c) => /No task of the plan runs there: every task runs in the deliverable worktree before the merge \(the workflow's own merge, post-merge gates and docs stages run in the integration worktree\)/.test(c.prompt)), 'briefing');
});
