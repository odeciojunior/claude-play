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
