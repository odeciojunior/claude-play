import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPure } from './load-pure.mjs';

const { isHard, nextTier, sameFinding, parseVerifyTag, evidenceGaps, lastContiguousDone, resumeAction, parseAuthorizeExternal, externalHold, planFingerprint, bindAuthorizations, externalGaps } = loadPure();
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

// ---- plan evidence rows are matched to card criteria by id (tolerant) ----
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8');
const P2 = loadPure();
const TEXT = 'Given a number, when doubled, then it is even';
const card1 = { id: 'AC1', text: `${TEXT} {verify: test; evidence: npm test}` };

test('matchesCriterion accepts the id, id plus separator and the criterion text with or without the tag', () => {
  const m = P2.matchesCriterion;
  assert.equal(m('AC1', card1), true);
  assert.equal(m(' AC1 ', card1), true);
  assert.equal(m(`AC1: ${TEXT}`, card1), true);
  assert.equal(m(`AC1 - ${TEXT}`, card1), true);
  assert.equal(m(card1.text, card1), true);
  assert.equal(m(TEXT, card1), true);
  assert.equal(m(`  ${TEXT.replace(/ /g, '   ')} `, card1), true);
  assert.equal(m('AC10', card1), false);
  assert.equal(m('AC1x', card1), false);
  assert.equal(m('something unrelated', card1), false);
  assert.equal(m('', card1), false);
  assert.equal(m(undefined, card1), false);
  assert.equal(m('anything', { id: 'AC2', text: '{verify: test; evidence: x}' }), false);
});

test('evidenceGaps and criteriaOpen agree on tolerant ac values', () => {
  for (const ac of ['AC1', `AC1: ${TEXT}`, card1.text]) {
    assert.deepEqual(P2.evidenceGaps([card1], [{ ac, kind: 'test', command: 'x' }], new Set()), [], ac);
  }
  const h = { id: 'AC1', text: `${TEXT} {verify: human; evidence: Ana}`, tag: { kind: 'human', evidence: 'Ana' } };
  assert.deepEqual(P2.criteriaOpen([h], [{ ac: `AC1: ${TEXT}`, kind: 'human' }]), [{ ac: 'AC1', kind: 'human', blq: undefined }]);
  // a tolerant row for a card criterion is not an unmatched row: no duplicate entry
  assert.equal(P2.criteriaOpen([{ id: 'AC1', text: TEXT, tag: null }], [{ ac: `AC1: ${TEXT}`, kind: 'human' }]).length, 1);
  assert.equal(P2.criteriaOpen([{ id: 'AC1', text: TEXT, tag: null }], [{ ac: 'AC1', kind: 'human' }, { ac: `AC1: ${TEXT}`, kind: 'human' }]).length, 1);
});

test('no-evidence gap names the expected id and the ac values the plan returned', () => {
  const g = P2.evidenceGaps([card1], [{ ac: 'AC9', kind: 'test', command: 'x' }, { ac: 'oops', kind: 'test', command: 'y' }], new Set());
  assert.equal(g.length, 1);
  assert.match(g[0].description, /expected ac "AC1"/);
  assert.match(g[0].description, /"AC9"/);
  assert.match(g[0].description, /"oops"/);
  assert.match(P2.evidenceGaps([card1], [], new Set())[0].description, /none/);
});

test('the same no-evidence gap repeats as the same finding while id and received values are unchanged', () => {
  const a = P2.evidenceGaps([card1], [{ ac: 'AC1x', kind: 'test', command: 'x' }], new Set());
  const b = P2.evidenceGaps([card1], [{ ac: 'AC1x', kind: 'test', command: 'other cmd' }], new Set());
  assert.equal(P2.sameFinding(a, b, new Set()), true);
  const c = P2.evidenceGaps([card1], [{ ac: 'AC1y', kind: 'test', command: 'x' }], new Set());
  assert.equal(P2.sameFinding(a, c, new Set()), false);
});

test('contract: schema describes ac as the id alone; plan and plan-fix prompts require it', () => {
  assert.match(SRC, /const S_PLAN[\s\S]*?ac: \{ \.\.\.STR, description: 'the exact criterion id, e\.g\. AC1, nothing else'/);
  assert.match(SRC, /ac of each evidence row is ONLY the criterion id/);
  assert.match(SRC, /Fix the plan[\s\S]*?ONLY the criterion id/);
  assert.match(SRC, /const acTxt = [^\n]*`\[\$\{a\.id\}\]/);
});

test('m3: parseVerifyTag accepts the grammar of the checker and strips backticks around the evidence', () => {
  assert.deepEqual(parseVerifyTag('x {verify: human}'), { kind: 'human', evidence: '' });
  assert.deepEqual(parseVerifyTag('x {verify: blocked BLQ-2}'), { kind: 'blocked', blq: 'BLQ-2', evidence: '' });
  assert.equal(parseVerifyTag('x {verify: test; evidence: `npm test`}').evidence, 'npm test');
  assert.equal(parseVerifyTag('x {verify: test; evidence: echo `a` b}').evidence, 'echo `a` b');
  for (const bad of ['x {verify: test}', 'x {verify: blocked}', 'x {verify: human BLQ-1}', 'x {verify: magic}']) assert.equal(parseVerifyTag(bad).invalid, true, bad);
});

const P3 = loadPure();
test('I1: normalizePlanAc resolves a plan row to the card id, preferring the id over a text match', () => {
  const cards = [{ id: 'AC1', text: 'works' }, { id: 'AC2', text: 'also fast' }];
  const out = P3.normalizePlanAc(cards, [{ ac: 'AC2: works too', kind: 'test' }, { ac: 'AC1: works', kind: 'test' }, { ac: 'also fast', kind: 'test' }, { ac: 'AC9', kind: 'test' }]);
  assert.deepEqual(out.map((p) => p.ac), ['AC2', 'AC1', 'AC2', 'AC9']);
});

test('I1: matchEvidence finds a result by id or position and compares the trimmed command', () => {
  const row = { ac: 'AC1', command: 'npm test' };
  assert.equal(P3.matchEvidence([{ ac: 'AC1', command: ' npm test ', exit: 0 }], row, 0).exit, 0);
  assert.equal(P3.matchEvidence([{ ac: 'AC1: text', command: 'npm test', exit: 3 }], row, 0).exit, 3);
  assert.equal(P3.matchEvidence([{ ac: 'AC1', command: 'other', exit: 0 }], row, 0), undefined);
  assert.equal(P3.matchEvidence([{ ac: 'AC7', command: 'npm test', exit: 0 }, { ac: 'AC8', command: 'x', exit: 0 }], row, 1), undefined);
  assert.equal(P3.matchEvidence([], row, 0), undefined);
});

test('parseAuthorizeExternal accepts the three item shapes and drops duplicates', () => {
  const r = parseAuthorizeExternal(['gate:G3', 'E18:T4', 'checkout:release/x', 'gate:G3']);
  assert.equal(r.items.length, 3);
  assert.equal(r.error, null);
  assert.deepEqual(parseAuthorizeExternal(undefined), { items: [], error: null });
});

test('parseAuthorizeExternal rejects a typo, a leading zero and a non-list', () => {
  for (const bad of [['E18:T04'], ['G3'], 'gate:G3']) {
    const r = parseAuthorizeExternal(bad);
    assert.notEqual(r.error, null);
    assert.deepEqual(r.items, []);
  }
});

test('externalHold: a bare or a matching bound item passes, anything else holds', () => {
  const fp = 'aaaaaaaa';
  assert.equal(externalHold({ n: 4, external: true }, 'E18', ['E18:T4'], fp), null);
  assert.equal(externalHold({ n: 4, external: true }, 'E18', ['E18:T4@aaaaaaaa'], fp), null);
  assert.equal(externalHold({ n: 4, external: true }, 'E18', ['E18:T4@bbbbbbbb'], fp), 'E18:T4@aaaaaaaa');
  assert.equal(externalHold({ n: 5, external: true }, 'E18', ['E18:T4'], fp), 'E18:T5@aaaaaaaa');
  assert.equal(externalHold({ n: 4, external: false }, 'E18', [], fp), null);
  assert.equal(externalHold({ n: 1 }, 'E1', [], fp), 'E1:T1@aaaaaaaa');
});

test('planFingerprint changes when a task changes and ignores key order and spacing', () => {
  const a = [{ n: 1, title: 'a', files: ['x', 'y'] }, { n: 2, title: 'b', files: [] }];
  const same = [{ files: ['y', 'x'], title: ' a ', n: 1 }, { title: 'b', n: 2, files: [] }];
  const fp = planFingerprint(a);
  assert.match(fp, /^[0-9a-f]{8}$/);
  assert.equal(planFingerprint(same), fp);
  assert.notEqual(planFingerprint([{ ...a[0], title: 'c' }, a[1]]), fp);
  assert.notEqual(planFingerprint([{ ...a[0], files: ['x'] }, a[1]]), fp);
  assert.notEqual(planFingerprint([...a, { n: 3, title: 'z', files: [] }]), fp);
});

test('bindAuthorizations binds only the bare items of that deliverable', () => {
  assert.deepEqual(bindAuthorizations(['E1:T2', 'E2:T1', 'gate:x', 'E1:T3@bbbbbbbb'], 'E1', 'aaaaaaaa'),
    ['E1:T2@aaaaaaaa', 'E2:T1', 'gate:x', 'E1:T3@bbbbbbbb']);
});

test('externalGaps flags a missing boolean and a missing dedupe note', () => {
  const g1 = externalGaps([{ n: 2 }]);
  assert.equal(g1.length, 1);
  assert.match(g1[0].description, /boolean/);
  const g2 = externalGaps([{ n: 1, external: true, externalDedupe: '  ' }]);
  assert.equal(g2.length, 1);
  assert.match(g2[0].description, /externalDedupe/);
  assert.equal(externalGaps([{ n: 1, external: true, externalDedupe: 'checks outbox.log first' }, { n: 2, external: false }]).length, 0);
});

test('planFingerprint covers the plan blob, external and externalDedupe', () => {
  const t = [{ n: 1, title: 'a', files: ['x'], external: true, externalDedupe: 'check outbox' }];
  const fp = planFingerprint(t, 'blob1');
  assert.equal(planFingerprint(JSON.parse(JSON.stringify(t)), 'blob1'), fp);
  assert.notEqual(planFingerprint(t, 'blob2'), fp);
  assert.notEqual(planFingerprint([{ ...t[0], externalDedupe: 'other check' }], 'blob1'), fp);
  assert.notEqual(planFingerprint([{ ...t[0], external: false }], 'blob1'), fp);
});
