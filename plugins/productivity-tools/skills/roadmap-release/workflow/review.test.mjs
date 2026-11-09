import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPure } from './load-pure.mjs';

const { isHard, nextTier, sameFinding, parseVerifyTag, evidenceGaps, lastContiguousDone, resumeAction } = loadPure();
const statuses = { onBranch: 'na-branch', integrated: ['integrada', 'publicada'], blocked: 'bloqueada', discarded: 'descartada' };

test('isHard: no category, defeito and decisao are hard; critical is hard unless a registered environment blocker', () => {
  const blq = new Set(['BLQ-1']);
  assert.equal(isHard({ severity: 'important' }, blq), true);
  assert.equal(isHard({ severity: 'important', category: 'defeito' }, blq), true);
  assert.equal(isHard({ severity: 'important', category: 'decisao' }, blq), true);
  assert.equal(isHard({ severity: 'important', category: 'ambiente' }, blq), false);
  assert.equal(isHard({ severity: 'critical', category: 'ambiente', blq: 'BLQ-1' }, blq), false);
  assert.equal(isHard({ severity: 'critical', category: 'ambiente', blq: 'BLQ-9' }, blq), true);
  assert.equal(isHard({ severity: 'critical', category: 'ambiente' }, blq), true);
});

test('nextTier escalates only on a repeated finding', () => {
  assert.equal(nextTier('sonnet', false), 'sonnet');
  assert.equal(nextTier('haiku', true), 'sonnet');
  assert.equal(nextTier('sonnet', true), 'opus');
  assert.equal(nextTier('opus', true), null);
  assert.equal(nextTier('opus', false), 'opus');
});

test('sameFinding compares file and normalized description of hard issues', () => {
  const prev = [{ severity: 'critical', file: 'a.js', description: 'Null  deref in\n foo' }];
  assert.equal(sameFinding(prev, [{ severity: 'important', file: 'a.js', description: ' null deref IN foo ' }]), true);
  assert.equal(sameFinding(prev, [{ severity: 'important', file: 'b.js', description: 'null deref in foo' }]), false);
  assert.equal(sameFinding(prev, [{ severity: 'important', category: 'ambiente', file: 'a.js', description: 'null deref in foo' }]), false);
  assert.equal(sameFinding([], prev), false);
});

test('parseVerifyTag', () => {
  assert.equal(parseVerifyTag('Given x, then y.'), null);
  assert.deepEqual(parseVerifyTag('Do it. {verify: test; evidence: npm test}'), { kind: 'test', evidence: 'npm test' });
  const t = parseVerifyTag('Do it. {verify: smoke; evidence: node -e "a; b}" && echo {x}}');
  assert.equal(t.kind, 'smoke');
  assert.equal(t.invalid, undefined);
  assert.equal(t.evidence, 'node -e "a; b}" && echo {x}');
  assert.deepEqual(parseVerifyTag('Wait. {verify: blocked BLQ-2; evidence: vendor key}'), { kind: 'blocked', blq: 'BLQ-2', evidence: 'vendor key' });
  assert.equal(parseVerifyTag('x {verify: human; evidence: Ana confirms}').kind, 'human');
  for (const bad of [
    'x {verify: magic; evidence: y}',
    'x {verify: blocked; evidence: y}',
    'x {verify: test BLQ-1; evidence: y}',
    'x {verify: test; evidence: }',
    'x {verify: test; evidence: npm test',
  ]) assert.equal(parseVerifyTag(bad).invalid, true, bad);
});

const tag = (kind, evidence, blq) => ({ kind, evidence, ...(blq ? { blq } : {}) });
test('evidenceGaps: plan must keep the tagged command; extra rows allowed', () => {
  const card = [{ id: 'A1', text: 't', tag: tag('test', 'npm test') }];
  assert.deepEqual(evidenceGaps(card, [{ ac: 'A1', kind: 'test', command: 'npm test' }], new Set()), []);
  assert.deepEqual(evidenceGaps(card, [{ ac: 'A1', kind: 'test', command: 'npm test' }, { ac: 'A1', kind: 'smoke', command: 'curl x' }], new Set()), []);
  const swapped = evidenceGaps(card, [{ ac: 'A1', kind: 'test', command: 'npm run other' }], new Set());
  assert.equal(swapped.length, 1);
  assert.equal(swapped[0].severity, 'critical');
  assert.match(swapped[0].description, /A1/);
});

test('evidenceGaps: untagged card accepts plan row; missing rows, commands and blq are gaps', () => {
  const card = [{ id: 'A1', text: 't', tag: null }, { id: 'A2', text: 'u', tag: null }];
  assert.deepEqual(evidenceGaps(card, [{ ac: 'A1', kind: 'test', command: 'x' }, { ac: 'A2', kind: 'human' }], new Set()), []);
  assert.equal(evidenceGaps(card, [{ ac: 'A1', kind: 'test', command: 'x' }], new Set()).length, 1);
  assert.equal(evidenceGaps(card.slice(0, 1), [{ ac: 'A1', kind: 'smoke' }], new Set()).length, 1);
  assert.equal(evidenceGaps(card.slice(0, 1), [{ ac: 'A1', kind: 'blocked', blq: 'BLQ-3' }], new Set(['BLQ-1'])).length, 1);
  assert.deepEqual(evidenceGaps(card.slice(0, 1), [{ ac: 'A1', kind: 'blocked', blq: 'BLQ-1' }], new Set(['BLQ-1'])), []);
});

test('evidenceGaps: invalid tag and unregistered tagged blq are gaps', () => {
  const rows = [{ ac: 'A1', kind: 'human' }];
  assert.equal(evidenceGaps([{ id: 'A1', text: 't', tag: { invalid: true } }], rows, new Set()).length, 1);
  const g = evidenceGaps([{ id: 'A1', text: 't', tag: tag('blocked', 'k', 'BLQ-7') }], [{ ac: 'A1', kind: 'blocked', blq: 'BLQ-7' }], new Set());
  assert.ok(g.length >= 1);
});

test('lastContiguousDone stops at the first gap', () => {
  const tasks = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }];
  assert.equal(lastContiguousDone(tasks, {}), 0);
  assert.equal(lastContiguousDone(tasks, { 1: {}, 2: {} }), 2);
  assert.equal(lastContiguousDone(tasks, { 1: {}, 3: {}, 4: {} }), 1);
  assert.equal(lastContiguousDone(tasks, { 1: {}, 2: {}, 3: {}, 4: {} }), 4);
});

test('resumeAction finishes an interrupted merge unless forced', () => {
  const c = { status: 'em-execucao', mergeFound: true };
  assert.equal(resumeAction(c, statuses, false), 'finish-merge');
  assert.equal(resumeAction(c, statuses, true), 'run');
  assert.equal(resumeAction({ status: 'integrada', mergeFound: true }, statuses, false), 'run');
  assert.equal(resumeAction({ status: 'planejada', mergeFound: false }, statuses, false), 'run');
});
