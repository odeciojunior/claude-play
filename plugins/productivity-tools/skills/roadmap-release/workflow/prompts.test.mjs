import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPure } from './load-pure.mjs';

const P = loadPure();
const ctx = {
  base: 'BASE RULES', envFacts: 'bash 5.2; node 22', baseline: 'unit: exit 0', E: 'E7', wt: '/wt/E7',
  planPath: 'docs/plan.md', specPath: 'docs/spec.md', start: 'abc123', locks: ['db'], round: 2, prev: '1. [critical/defeito] a.js bug',
};
const task = { n: 3, title: 'Add parser', files: ['src/p.js', 'src/p.test.js'], tier: 'haiku' };
const impl = { status: 'DONE', summary: 'done', checks: [{ command: 'npm test', output: '12 passing', exit: 0 }, { command: 'npm run lint', output: 'boom', exit: 1 }] };

test('implementation prompt stops after the task and carries the measured environment', () => {
  const p = P.buildImplPrompt(ctx, task);
  assert.match(p, /STOP after this task/);
  assert.match(p, /bash 5\.2; node 22/);
  assert.match(p, /Task 3/);
  assert.match(p, /src\/p\.js, src\/p\.test\.js/);
  assert.match(p, /E7 T3:/);
  assert.match(p, /checks/);
  assert.match(p, /HOLD.*db/);
  assert.match(P.buildImplPrompt({ ...ctx, locks: [] }, task), /hold no lock/i);
});

test('review prompt hands the implementer checks (command, exit, output) to the reviewer', () => {
  for (const kind of ['spec', 'quality']) {
    const p = P.buildTaskReviewPrompt(ctx, task, kind, impl);
    assert.match(p, /npm test/);
    assert.match(p, /12 passing/);
    assert.match(p, /npm run lint/);
    assert.match(p, /exit 1/);
    assert.match(p, /abc123\.\.HEAD/);
    assert.match(p, /1\. \[critical\/defeito\] a\.js bug/);
  }
  assert.match(P.buildTaskReviewPrompt(ctx, task, 'spec', impl), /SPEC/i);
  assert.match(P.buildTaskReviewPrompt(ctx, task, 'quality', impl), /QUALITY/i);
  assert.match(P.buildTaskReviewPrompt(ctx, task, 'spec', { status: 'DONE', summary: 'x', checks: [] }), /no checks/i);
});

test('reviewer model: opus only for reviewTier opus; implementer model comes from the plan tier', () => {
  assert.equal(P.reviewModelFor({ reviewTier: 'opus' }), 'opus');
  assert.equal(P.reviewModelFor({ reviewTier: 'sonnet' }), 'sonnet');
  assert.equal(P.reviewModelFor({}), 'sonnet');
  assert.equal(P.implModel({ tier: 'haiku' }), 'haiku');
  assert.equal(P.implModel({ tier: 'opus' }), 'opus');
  assert.equal(P.implModel({ tier: 'fable' }), 'sonnet');
  assert.equal(P.implModel({}), 'sonnet');
});

test('issue helpers: blocking, fmt, compact, reviewTruth', () => {
  const r = { issues: [{ severity: 'critical', category: 'defeito', description: 'd', file: 'f.js' }, { severity: 'minor', description: 'm' }], clean: true, commitsInRange: 1 };
  assert.equal(P.blocking(r).length, 1);
  assert.equal(P.blocking(null).length, 0);
  assert.equal(P.fmt(P.blocking(r)), '1. [critical/defeito] f.js d');
  assert.deepEqual(P.compact(r.issues).minor, 1);
  assert.equal(P.reviewTruth(r, 1, 'x').length, 1);
  const bad = P.reviewTruth({ issues: [], clean: false, commitsInRange: 0 }, 1, 'range');
  assert.equal(bad.length, 2);
  assert.ok(bad.every(i => i.severity === 'critical' && i.category === 'defeito'));
  assert.equal(P.reviewTruth({ issues: [], clean: true, commitsInRange: 0 }, 0, 'x').length, 0);
});

test('criteriaOpen lists criteria with no executable evidence', () => {
  const cardAc = [
    { id: 'A1', text: 'a', tag: { kind: 'test', evidence: 'npm test' } },
    { id: 'A2', text: 'b', tag: { kind: 'human', evidence: 'Ana' } },
    { id: 'A3', text: 'c', tag: null },
    { id: 'A4', text: 'd', tag: null },
  ];
  const planAc = [
    { ac: 'A1', kind: 'test', command: 'npm test' },
    { ac: 'A2', kind: 'human' },
    { ac: 'A3', kind: 'blocked', blq: 'BLQ-1' },
    { ac: 'A4', kind: 'smoke', command: 'x' },
  ];
  assert.deepEqual(P.criteriaOpen(cardAc, planAc), [{ ac: 'A2', kind: 'human', blq: undefined }, { ac: 'A3', kind: 'blocked', blq: 'BLQ-1' }]);
});

test('workflow script has no project-specific terms and no nondeterministic calls', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8');
  assert.doesNotMatch(src, /supabase|\bdeno\b|\bRLS\b|docker|\budv\b|estado-atual/i);
  assert.doesNotMatch(src, /Date\.now\(|Math\.random\(|new Date\(\)|^import /m);
});

test('criteriaOpen: a human/blocked tag or row always opens the criterion', () => {
  const t = (kind, evidence = 'x', blq) => ({ kind, evidence, ...(blq ? { blq } : {}) });
  assert.deepEqual(P.criteriaOpen([{ id: 'A1', tag: t('human') }], [{ ac: 'A1', kind: 'test', command: 'x' }]), [{ ac: 'A1', kind: 'human', blq: undefined }]);
  assert.deepEqual(P.criteriaOpen([{ id: 'A1', tag: t('blocked', 'k', 'BLQ-2') }], [{ ac: 'A1', kind: 'test', command: 'x' }]), [{ ac: 'A1', kind: 'blocked', blq: 'BLQ-2' }]);
  assert.deepEqual(P.criteriaOpen([{ id: 'A1', tag: null }], [{ ac: 'A1', kind: 'test', command: 'x' }, { ac: 'A1', kind: 'human' }]), [{ ac: 'A1', kind: 'human', blq: undefined }]);
  assert.deepEqual(P.criteriaOpen([], [{ ac: 'A9', kind: 'human' }, { ac: 'A8', kind: 'blocked', blq: 'BLQ-1' }, { ac: 'A7', kind: 'test', command: 'x' }]),
    [{ ac: 'A9', kind: 'human', blq: undefined }, { ac: 'A8', kind: 'blocked', blq: 'BLQ-1' }]);
  assert.equal(P.criteriaOpen([{ id: 'A1', tag: null }], [{ ac: 'A1', kind: 'human' }, { ac: 'A1', kind: 'human' }]).length, 1);
});

test('evidenceGaps: a plan row cannot replace a human/blocked tag with another kind', () => {
  const tg = (kind, evidence, blq) => ({ kind, evidence, ...(blq ? { blq } : {}) });
  const g = P.evidenceGaps([{ id: 'A1', text: 't', tag: tg('human', 'Ana') }], [{ ac: 'A1', kind: 'test', command: 'x' }], new Set());
  assert.equal(g.length, 1);
  assert.deepEqual(P.evidenceGaps([{ id: 'A1', text: 't', tag: tg('human', 'Ana') }], [{ ac: 'A1', kind: 'human' }], new Set()), []);
  assert.equal(P.evidenceGaps([{ id: 'A1', text: 't', tag: tg('blocked', 'k', 'BLQ-1') }], [{ ac: 'A1', kind: 'test', command: 'x' }], new Set(['BLQ-1'])).length, 1);
});

test('fmtChecks keeps the tail of long output; review prompt tells reviewers about locks and exact repeats', () => {
  const out = 'HEAD'.padEnd(5000, '.') + 'FAILURE-AT-THE-END';
  const p = P.buildTaskReviewPrompt(ctx, task, 'quality', { status: 'DONE', summary: 's', checks: [{ command: 'c', output: out, exit: 1 }] });
  assert.match(p, /FAILURE-AT-THE-END/);
  assert.doesNotMatch(p, /HEAD\.\.\./);
  assert.match(p, /shared lock/i);
  assert.match(p, /exact same `?file`? and `?description`?/i);
  assert.match(P.repeatRule(), /exact same/);
});

const mkEnv = (over = {}) => ({ maxFix: 2, blqIds: new Set(), reviews: [], concerns: [], acceptRisks() {}, ...over });
const bug = { severity: 'critical', category: 'defeito', description: 'same bug', file: 'a.js' };
const rev = (issues = [bug]) => ({ issues, headSha: 'h', clean: true, commitsInRange: 1 });

test('reviewLoop escalates haiku -> sonnet -> opus on a repeated finding and gets one extra round', async () => {
  const tiers = [];
  const res = await P.runReviewLoop(mkEnv(), 'T1:spec', async () => rev(), async (iss, k, tier) => { tiers.push(tier); return { status: 'DONE' }; }, r => r.issues, { tier: 'haiku', reviewModel: 'sonnet' });
  assert.deepEqual(tiers, ['haiku', 'sonnet', 'opus']);
  assert.equal(res.ok, false);
  assert.match(res.msg, /reappeared after a fix at opus/);
  assert.equal(res.kind, 'conteudo');
});

test('reviewLoop with a fixer already at opus stops on the first repeat; decisao kind is kept', async () => {
  const env = mkEnv();
  const d = { severity: 'critical', category: 'decisao', description: 'breaks DEC-1', file: 'p.md' };
  const res = await P.runReviewLoop(env, 'spec', async () => rev([d]), async () => ({ status: 'DONE' }), r => r.issues, { tier: 'opus', reviewModel: 'opus' });
  assert.equal(res.ok, false);
  assert.equal(res.kind, 'decisao');
  assert.equal(env.reviews.length, 1);
  assert.deepEqual(env.reviews[0].rounds.map(x => x.fixTier), [null, 'opus']);
});

test('reviewLoop passes when the fix resolves it, logs rounds with models, and logs early exits', async () => {
  const env = mkEnv();
  let n = 0;
  const ok = await P.runReviewLoop(env, 's', async () => rev(n++ ? [] : [bug]), async () => ({ status: 'DONE' }), r => r.issues, { tier: 'sonnet', reviewModel: 'opus' });
  assert.equal(ok.ok, true);
  assert.deepEqual(env.reviews[0].rounds, [{ round: 1, reviewModel: 'opus', fixTier: null }, { round: 2, reviewModel: 'opus', fixTier: 'sonnet' }]);
  for (const [fix, kind] of [[async () => null, 'infra'], [async () => ({ status: 'BLOCKED', summary: 'x' }), 'conteudo']]) {
    const e = mkEnv();
    const r = await P.runReviewLoop(e, 's', async () => rev(), fix, r => r.issues, { tier: 'sonnet' });
    assert.equal(r.kind, kind);
    assert.equal(e.reviews.length, 1, 'early exit is logged');
  }
  const e2 = mkEnv();
  const nr = await P.runReviewLoop(e2, 's', async () => null, async () => ({}), r => r.issues, {});
  assert.equal(nr.kind, 'infra');
  assert.equal(e2.reviews.length, 1);
});

test('reviewLoop with maxFix 0 never fixes', async () => {
  let fixed = 0;
  const res = await P.runReviewLoop(mkEnv({ maxFix: 0 }), 's', async () => rev(), async () => { fixed++; return {}; }, r => r.issues, { tier: 'haiku' });
  assert.equal(fixed, 0);
  assert.equal(res.ok, false);
});
