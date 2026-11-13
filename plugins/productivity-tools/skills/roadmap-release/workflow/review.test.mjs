import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPure } from './load-pure.mjs';

const { isHard, nextTier, sameFinding, parseVerifyTag, evidenceGaps, closedBlockers, lastContiguousDone, resumeAction, parseAuthorizeExternal, externalHold, planFingerprint, bindAuthorizations, externalGaps, testFirstGap, tasksFromPlan } = loadPure();
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

test('resumeAction finishes an interrupted merge, even when forced', () => {
  const c = { status: 'em-execucao', mergeFound: true };
  assert.equal(resumeAction(c, statuses, false), 'finish-merge');
  assert.equal(resumeAction(c, statuses, true), 'finish-merge');
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

test('contract: the plan comes from the emit, so S_PLAN is gone and the evidence ac is the criterion id; plan author and plan-fix prompts require it', () => {
  assert.doesNotMatch(SRC, /const S_PLAN\b/);
  assert.doesNotMatch(SRC, /evidenceRowGaps|hideRowGaps|roadmapHeader === false/);
  const rows = P4.evidenceFromPlan({ evidence: [{ ac: 'AC1', kind: 'test', command: 'npm test', external: false }, { ac: 'AC2', kind: 'human' }] });
  assert.deepEqual(rows.map((r) => r.ac), ['AC1', 'AC2']);
  assert.match(SRC, /ac of each evidence row is ONLY the criterion id/);
  assert.match(SRC, /Fix the plan[\s\S]*?ONLY the criterion id/);
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

const H1 = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const H2 = '0123456789abcdef0123456789abcdef01234567';
test('planFingerprint depends only on the plan blob when it is present', () => {
  const t = [{ n: 1, title: 'a', files: ['x'], external: true, externalDedupe: 'exactly E4 published' }];
  const fp = planFingerprint(t, H1);
  assert.equal(planFingerprint([{ ...t[0], externalDedupe: "exactly 'E4 published'" }], H1), fp);
  assert.equal(planFingerprint([{ ...t[0], external: false }], H1), fp);
  assert.equal(planFingerprint([{ ...t[0], title: 'other' }], H1), fp);
  assert.equal(planFingerprint([{ ...t[0], files: ['y', 'z'] }], H1), fp);
  assert.notEqual(planFingerprint(t, H2), fp);
});

test('planFingerprint treats a non-hex blob as missing', () => {
  const t = [{ n: 1, title: 'a', files: ['x'], external: true, externalDedupe: 'check outbox' }];
  for (const bad of ['b1', 'HEAD:x.md', 'abc123', 'G'.repeat(40)]) {
    assert.equal(planFingerprint(t, bad), planFingerprint(t, ''));
    assert.notEqual(planFingerprint([{ ...t[0], externalDedupe: 'other' }], bad), planFingerprint(t, bad));
  }
});

test('planFingerprint falls back to the task fields when the blob is empty', () => {
  const t = [{ n: 1, title: 'a', files: ['x'], external: true, externalDedupe: 'check outbox' }];
  for (const empty of [undefined, '', '   ']) {
    const fp = planFingerprint(t, empty);
    assert.notEqual(planFingerprint([{ ...t[0], externalDedupe: 'other check' }], empty), fp);
    assert.notEqual(planFingerprint([{ ...t[0], external: false }], empty), fp);
  }
  assert.notEqual(planFingerprint(t, ''), planFingerprint(t, H1));
});

test('item 8: a test tag is not satisfied by a human plan row that repeats its command', () => {
  const ac = [{ id: 'AC1', text: 'x {verify: test; evidence: npm test -- a}', tag: { kind: 'test', evidence: 'npm test -- a' } }];
  const g = evidenceGaps(ac, [{ ac: 'AC1', kind: 'human', command: 'npm test -- a' }], new Set());
  assert.ok(g.some((x) => /AC1/.test(x.description) && /changed the command bound by the card tag/.test(x.description)));
  assert.deepEqual(evidenceGaps(ac, [{ ac: 'AC1', kind: 'test', command: 'npm test -- a' }], new Set()), []);
});

test('item 14: evidenceGaps no longer reports a closed blocker, closedBlockers does', () => {
  const tg = (blq) => ({ id: 'AC1', text: 't', tag: { kind: 'blocked', evidence: '', blq } });
  const g = evidenceGaps([tg('BLQ-9')], [{ ac: 'AC1', kind: 'blocked', blq: 'BLQ-9' }], new Set(['BLQ-1']));
  assert.ok(!g.some((x) => /tagged blocked without a registered blocker/.test(x.description)));
  assert.deepEqual(closedBlockers([tg('BLQ-9'), { id: 'AC2', text: 't', tag: { kind: 'blocked', evidence: '', blq: 'BLQ-1' } }, tg('BLQ-9')], new Set(['BLQ-1'])), ['BLQ-9']);
});

test('I2: parseAuthorizeExternal accepts criterion items only in the numbered form', () => {
  const P2 = loadPure();
  assert.equal(P2.parseAuthorizeExternal(['E18:AC1', 'E18:AC12@abcd1234']).error, null);
  for (const bad of ['E18:AC0', 'E18:AC1@xyz', 'E18:AC']) assert.ok(P2.parseAuthorizeExternal([bad]).error, bad);
});

test('I2: evidenceHolds holds external and flagless command rows, one item per criterion, and respects bare and bound items', () => {
  const { evidenceHolds } = loadPure();
  const rows = [{ ac: 'AC1', kind: 'smoke', command: 'a', external: true, externalDedupe: 'd' }, { ac: 'AC1', kind: 'smoke', command: 'b', external: true }, { ac: 'AC2', kind: 'test', command: 'c' }, { ac: 'AC3', kind: 'test', command: 'x', external: false }, { ac: 'AC4', kind: 'human' }];
  assert.deepEqual(evidenceHolds(rows, 'E1', [], 'ff').map((h) => [h.item, h.commands]), [['E1:AC1@ff', ['a', 'b']], ['E1:AC2@ff', ['c']]]);
  assert.deepEqual(evidenceHolds(rows, 'E1', ['E1:AC1', 'E1:AC2@ff'], 'ff'), []);
  assert.equal(evidenceHolds(rows, 'E1', ['E1:AC1@00', 'E1:AC2@00'], 'ff').length, 2);
});

test('I2: evidenceExternalGaps rejects a missing flag, an external row with no dedupe and one that names no criterion', () => {
  const { evidenceExternalGaps } = loadPure();
  const cards = [{ id: 'AC1', text: 'w' }];
  const gaps = (r) => evidenceExternalGaps(cards, r).map((g) => g.description).join('|');
  assert.match(gaps([{ ac: 'AC1', kind: 'test', command: 'a' }]), /must declare external/);
  assert.match(gaps([{ ac: 'AC1', kind: 'test', command: 'a', external: true }]), /externalDedupe/);
  assert.match(gaps([{ ac: 'other', kind: 'test', command: 'a', external: true, externalDedupe: 'd' }]), /criterion id/);
  assert.equal(gaps([{ ac: 'AC1', kind: 'test', command: 'a', external: false }, { ac: 'AC1', kind: 'human' }]), '');
});

test('I2: bindAuthorizations binds bare criterion items of that deliverable only', () => {
  const { bindAuthorizations } = loadPure();
  assert.deepEqual(bindAuthorizations(['E1:AC1', 'E10:AC1', 'E1:AC2@aa', 'gate:E1:AC1'], 'E1', 'ff'), ['E1:AC1@ff', 'E10:AC1', 'E1:AC2@aa', 'gate:E1:AC1']);
});

// ---- leva 2, bloco A
const P4 = loadPure();
const acCard = [{ id: 'AC1', text: 'works', tag: null }];
const row = (command, external = true, ac = 'AC1') => ({ ac, kind: 'smoke', command, external, externalDedupe: 'd' });

test('commandKey ignores only one whole wrapper of backticks and the spaces outside it', () => {
  const { commandKey: k } = P4;
  for (const v of ['npm test', '  npm test ', '`npm test`', ' `npm test` ']) assert.equal(k(v), 'npm test', v);
  assert.notEqual(k('grep "a  b" f'), k('grep "a b" f'));
  assert.notEqual(k('npm test -- a'), k('npm test -- b'));
  assert.equal(k('echo "a"'), 'echo "a"');
  assert.notEqual(k('"a" "b"'), k('a b'));
});

test('parseAuthorizeExternal rejects an undefined item', () => {
  const r = P4.parseAuthorizeExternal([undefined]);
  assert.notEqual(r.error, null);
  assert.deepEqual(r.items, []);
});

test('evidenceGaps: a plan row of kind blocked needs a registered blocker', () => {
  const card = [{ id: 'AC1', text: 't', tag: null }];
  assert.deepEqual(evidenceGaps(card, [{ ac: 'AC1', kind: 'blocked', blq: 'BLQ-1' }], new Set(['BLQ-1'])), []);
  for (const blq of ['BLQ-9', undefined]) assert.match(evidenceGaps(card, [{ ac: 'AC1', kind: 'blocked', blq }], new Set(['BLQ-1']))[0].description, /without a registered blocker/);
});

test('fix 1: commandKey keeps apart commands the shell runs differently', () => {
  const { commandKey: k } = P4;
  assert.notEqual(k('curl ok\nrm prod'), k('curl ok rm prod'));
  assert.notEqual(k('curl ok\r\nrm prod'), k('curl ok rm prod'));
  assert.notEqual(k('touch a\\  b'), k('touch a\\ b'));
  assert.notEqual(k('echo \\" "a  b"'), k('echo \\" "a b"'));
});

test('fix round 2: commandKey is exact inside the command', () => {
  const { commandKey: k, evidenceGaps: g } = P4;
  const differ = [['npm   test', 'npm test'], ['npm\ttest', 'npm test'], ['echo "$(echo "a  b")"', 'echo "$(echo "a b")"'], ["echo $'a\\'  b'", "echo $'a\\' b"], ['printf %s a\\ ', 'printf %s a\\'], ['a\u00a0', 'a'], ['a\t', 'a'], ['a\n', 'a']];
  for (const [x, y] of differ) assert.notEqual(k(x), k(y), JSON.stringify([x, y]));
  assert.equal(k('``npm test``'), '``npm test``', 'only one wrapper, and it must wrap the whole value');
  assert.equal(k('"`npm test`"'), '"`npm test`"', 'quotes are part of the command');
  assert.equal(k('`a\\`'), '`a\\`', 'an escaped closing backtick is not a wrapper');
  assert.equal(k('` npm test `'), ' npm test ', 'exact inside the wrapper');
  assert.equal(g([{ id: 'AC1', text: 't', tag: null }], [{ ac: 'AC1', kind: 'smoke', command: '""' }], new Set()).length, 1, 'a wrapper around nothing is no command');
});

const RAN = (x) => ` [already authorized and run in this run: ${x}]`;

test('I1: an item that matches stays, annotated; nothing is ever removed', () => {
  const { annotateAuthorizedHuman: a } = P4;
  const cmd = 'node scripts/notify.mjs';
  const run = [{ item: 'E1:AC3', command: cmd }, { item: 'E1:T2' }];
  const whats = (xs) => a(xs.map((what) => ({ what })), run).map((h) => h.what);
  const raw = 'Operator authorization to run node  scripts/notify.mjs (external)';
  assert.deepEqual(whats([raw]), [raw + RAN(cmd)]);
  assert.deepEqual(whats(['The person must authorize E1:AC3']), ['The person must authorize E1:AC3' + RAN(cmd)]);
  assert.deepEqual(whats(['Approval for E1:T2 is needed']), ['Approval for E1:T2 is needed' + RAN('E1:T2')]);
  const genuine = `Real SMTP credentials and approval to send with ${cmd} (placeholder used)`;
  assert.deepEqual(whats([genuine]), [genuine + RAN(cmd)], 'a genuine need that mentions approval and the command survives whole');
  for (const keep of ['Real API key for node scripts/notify.mjs', 'Authorize E1:AC30', 'Authorization to run node other.mjs', 'real key']) assert.deepEqual(whats([keep]), [keep]);
  assert.deepEqual(a([{ what: 'Authorize E1:AC3' }], []), [{ what: 'Authorize E1:AC3' }]);
  assert.deepEqual(a([{ what: 'Approval for E1:T2', blq: 'BLQ-1', blocking: true }], run), [{ what: 'Approval for E1:T2' + RAN('E1:T2'), blq: 'BLQ-1', blocking: true }], 'the other fields stay');
});

test('I1: annotating twice changes nothing, and the annotated item keeps its dedupe key', () => {
  const { annotateAuthorizedHuman: a, humanKey } = P4;
  const run = [{ item: 'E1:T2' }];
  const once = a([{ what: 'Approval for E1:T2' }], run);
  assert.deepEqual(a(once, run), once);
  assert.equal(humanKey(once[0]), 'Approval for E1:T2');
  assert.equal(humanKey({ what: '  Approval  for E1:T2 ' }), 'Approval for E1:T2');
});

test('minor 1: a request in Portuguese is annotated too', () => {
  const { annotateAuthorizedHuman: a } = P4;
  const cmd = 'node scripts/notify.mjs';
  for (const what of [`Autorização do dono para rodar ${cmd}`, `Aprovação para ${cmd}`, `Permissão de escrita para ${cmd}`]) assert.deepEqual(a([{ what }], [{ item: 'E1:AC3', command: cmd }]), [{ what: what + RAN(cmd) }]);
});

// ---- leva 3, bloco A
test('decision 3: quotes are part of the command', () => {
  const { commandKey: k } = P4;
  for (const v of ['"./my tool"', "'npm test'", '"echo hi"']) assert.equal(k(v), v);
  assert.notEqual(k('"./my tool"'), k('./my tool'));
  assert.notEqual(k('"echo hi"'), k('echo hi'));
});

test('commandKey changes nothing in a multi-line command', () => {
  const { commandKey: k } = P4;
  for (const v of ['cat <<E\nx\nE ', 'cat <<E\nx  ', '  cat <<E\nx\nE', 'a\r\nb ', 'a\n ']) assert.equal(k(v), v, JSON.stringify(v));
  assert.notEqual(k('cat <<E\nx\nE '), k('cat <<E\nx\nE'));
  assert.notEqual(k('cat <<E\nx  '), k('cat <<E\nx'));
  assert.equal(k('`cat <<E\nx\nE `'), 'cat <<E\nx\nE ', 'a whole pair of backticks goes, and nothing else');
});

test('evidenceGaps: a blank command is no command, with or without a wrapper', () => {
  const card = [{ id: 'AC1', text: 't', tag: null }];
  const gaps = (command) => evidenceGaps(card, [{ ac: 'AC1', kind: 'smoke', command }], new Set());
  for (const v of [' ', '   ', '\t', '\n', '` `', '``', '" "', '""', "' '", "''", ' "  " ']) assert.match(gaps(v)[0]?.description || '', /no evidence command/, JSON.stringify(v));
  for (const v of ['npm test', '"./my tool"', '`echo x`']) assert.deepEqual(gaps(v), [], v);
});

test('evidenceGaps: the card tag is compared with the value that is dispatched', () => {
  const card = [{ id: 'AC1', text: 't', tag: { kind: 'smoke', evidence: 'npm x' } }];
  const changed = (command, tag = card) => evidenceGaps(tag, [{ ac: 'AC1', kind: 'smoke', command }], new Set()).some((x) => /changed the command bound by the card tag/.test(x.description));
  for (const v of ['npm x', ' npm x ', '`npm x`']) assert.equal(changed(v), false, JSON.stringify(v));
  for (const v of ['npm x' + String.fromCharCode(160), 'npm x' + String.fromCharCode(9), '"npm x"']) assert.equal(changed(v), true, JSON.stringify(v));
  const tagged = (evidence) => [{ id: 'AC1', text: 't', tag: { kind: 'smoke', evidence } }];
  assert.equal(changed('a\\ ', tagged('a\\')), true);
  assert.equal(changed('cat <<E\nx\nE ', tagged('cat <<E\nx\nE')), true);
});

const ck = (command, exit) => ({ command, output: 'o', exit });
const tfTask = { n: 2, testFirst: true, noCommit: false, files: ['a.js'] };
const stub = { status: 'DONE', summary: 'resumed: task already committed by a previous run; no checks reported, run the task verifications yourself', checks: [] };

test('AC1: testFirstGap fails a test-first task without red before green', () => {
  const bad = [
    [ck('t', 0)],
    [ck('t', 0), ck('t', 1)],
    [ck('t1', 1), ck('t2', 0)],
    [],
  ];
  for (const status of ['DONE', 'DONE_WITH_CONCERNS']) {
    for (const checks of bad) {
      const gap = testFirstGap(tfTask, { status, checks }, false);
      assert.ok(gap && gap.includes('2') && gap.includes(`(${checks.length} checks)`), JSON.stringify(checks));
    }
  }
});

test('AC2: testFirstGap passes resumed, unmarked, no-file and blocked tasks', () => {
  const good = { status: 'DONE', checks: [ck('t', 1), ck('t', 0)] };
  assert.equal(testFirstGap(tfTask, stub, true), '');
  assert.equal(testFirstGap({ ...tfTask, testFirst: { exempt: 'docs' } }, { status: 'DONE', checks: [] }, false), '');
  assert.equal(testFirstGap({ n: 2, noCommit: false, files: ['a.js'] }, { status: 'DONE', checks: [] }, false), '');
  assert.equal(testFirstGap({ ...tfTask, noCommit: true, files: [] }, { status: 'DONE', checks: [] }, false), '');
  for (const status of ['BLOCKED', 'NEEDS_HUMAN']) assert.equal(testFirstGap(tfTask, { status, checks: [] }, false), '');
  assert.equal(testFirstGap(tfTask, good, false), '');
  assert.equal(testFirstGap(tfTask, { status: 'DONE_WITH_CONCERNS', checks: [ck(' node --test x ', 1), ck('node --test x', 0)] }, false), '');
  assert.equal(testFirstGap(tfTask, { status: 'DONE', checks: [ck('a', 0), ck('t', 1), ck('b', 0), ck('`t`', 0)] }, false), '');
});

test('tasksFromPlan copies testFirst (true and exempt)', () => {
  const ts = tasksFromPlan({ tasks: [{ n: 1, title: 'a', testFirst: true }, { n: 2, title: 'b', testFirst: { exempt: 'docs' } }, { n: 3, title: 'c' }] });
  assert.equal(ts[0].testFirst, true);
  assert.deepEqual(ts[1].testFirst, { exempt: 'docs' });
  assert.equal(ts[2].testFirst, undefined);
});

test('AC1: the test-first check runs before the first task reviewer and fails without a reviewer', () => {
  const body = SRC.slice(SRC.indexOf('async function runDeliverable('));
  const close = body.indexOf('closeEffect(t, awaitingPerson.includes(t.n))');
  const call = body.indexOf('testFirstGap(t, impl, resumed)');
  const loop = body.indexOf('reviewLoop(`T${t.n}:${kind}`');
  assert.ok(close > 0 && call > close && loop > call, 'order: closeEffect, testFirstGap, reviewLoop');
  const between = body.slice(call, loop);
  assert.match(between, /if \(gap\) return fail\('conteudo'/);
  const ret = between.indexOf("return fail('conteudo'");
  assert.ok(ret > 0 && !/agent\(/.test(between.slice(0, ret)), 'no agent call before the failing return');
});

test('AC1: the test-first failure names the start commit to reset to before a rerun', () => {
  const body = SRC.slice(SRC.indexOf('async function runDeliverable('));
  const line = body.split('\n').find(l => l.includes("return fail('conteudo', `${gap}"));
  assert.ok(line, 'fail message built from the gap');
  // HEAD as the <branch> argument rebases a detached HEAD and leaves the branch with the task commit.
  assert.match(line, /rebase --onto \$\{start\} <last task commit> \$\{br\}/);
  assert.doesNotMatch(line, /<last task commit> HEAD/);
  assert.match(line, /keeping the review log/);
  assert.doesNotMatch(line, /reset --hard \$\{start\}/);
  assert.match(line, /\$\{wt\}/);
  assert.ok(body.indexOf('let start =') > 0 && body.indexOf('let start =') < body.indexOf(line), 'start is defined before the failure');
});

test('AC1: with effect or wait marks the test-first failure asks the owner instead of a rebase', () => {
  // "T<n>: external effect completed" and "T<n>: resumed after awaiting person" match the done grep, and an earlier
  // run's wait marks sit inside start..task, so no rebase of the task commits makes a rerun run the check.
  const body = SRC.slice(SRC.indexOf('async function runDeliverable('));
  const line = body.split('\n').find(l => l.includes("return fail('conteudo', `${gap}"));
  const m = line.match(/\$\{(authorizedExt \|\| awaitingPerson\.includes\(t\.n\)) \? `([^`]*)` : `([^`]*)`\}/);
  assert.ok(m, 'the marker cases (closeEffect runs for them) branch away from the rebase');
  assert.match(m[2], /ask the owner/);
  assert.doesNotMatch(m[2], /rebase/);
  assert.match(m[3], /rebase --onto/);
  assert.match(body, /if \(authorizedExt \|\| awaitingPerson\.includes\(t\.n\)\) \{\s*const closed = await closeEffect/);
});

test('testFirstGap: plain identical command string, red then green, is no gap (contract the implementer follows)', () => {
  const checks = [ck('node --test', 1), ck('node --test', 0)];
  for (const status of ['DONE', 'DONE_WITH_CONCERNS']) {
    assert.equal(testFirstGap(tfTask, { status, checks }, false), '');
  }
  const annotated = [ck('node --test (before implementation)', 1), ck('node --test (after implementation)', 0)];
  assert.ok(testFirstGap(tfTask, { status: 'DONE', checks: annotated }, false), 'annotated commands do not match');
});

// ---- E21 T3: findings carry an id; the per-task loop repeats by id ----
test('AC1: sameFinding with byId treats the same id with other wording as a repeat', () => {
  const prev = [{ severity: 'critical', id: 'F1', file: 'a.js', description: 'null deref' }];
  const again = [{ severity: 'critical', id: 'F1', file: 'a.js', description: 'foo may dereference null' }];
  assert.equal(P2.sameFinding(prev, again, new Set(), true), true);
  assert.equal(P2.sameFinding(prev, again, new Set()), false);
  const noId = [{ severity: 'critical', file: 'a.js', description: 'null deref' }];
  assert.equal(P2.sameFinding(noId, [{ severity: 'critical', file: 'a.js', description: ' Null  deref' }], new Set(), true), true);
  assert.equal(P2.sameFinding(noId, [{ severity: 'critical', file: 'a.js', description: 'other' }], new Set(), true), false);
  const other = [{ severity: 'critical', id: 'F2', file: 'a.js', description: 'foo may dereference null' }];
  assert.equal(P2.sameFinding(prev, other, new Set(), true), false);
});

test('AC1: fmt writes the id before the description', () => {
  assert.match(P2.fmt([{ severity: 'critical', category: 'defeito', id: 'F2', file: 'a.js', description: 'x' }]), /\[F2\] x/);
  assert.equal(P2.fmt([{ severity: 'critical', category: 'defeito', file: 'a.js', description: 'x' }]), '1. [critical/defeito] a.js x');
});

test('AC1: runReviewLoop escalates the fixer when a finding returns with the same id and other wording', async () => {
  const run = async byId => {
    const tiers = [];
    let n = 0;
    const mk = d => ({ issues: [{ severity: 'critical', category: 'defeito', id: 'F1', file: 'a.js', description: d }], headSha: 'h', clean: true, commitsInRange: 1 });
    const env = { maxFix: 2, blqIds: new Set(), reviews: [], concerns: [], acceptRisks() {} };
    await P2.runReviewLoop(env, 'T1:spec', async () => mk(n++ === 0 ? 'null deref' : n === 2 ? 'foo may dereference null' : 'third wording'),
      async (iss, k, tier) => { tiers.push(tier); return { status: 'DONE' }; }, r => r.issues, { tier: 'sonnet', reviewModel: 'sonnet', byId });
    return tiers;
  };
  assert.equal((await run(true))[1], 'opus');
  assert.equal((await run(false))[1], 'sonnet');
});

test('AC1: only the per-task reviewLoop of runDeliverable passes byId', () => {
  const body = SRC.slice(SRC.indexOf('async function runDeliverable'));
  const task = body.slice(body.indexOf('reviewLoop(`T${t.n}:${kind}`'));
  assert.match(task.slice(0, task.indexOf('if (loop.halted)')), /byId: true/);
  for (const st of ['spec', 'plan', 'final', 'delta']) {
    const at = body.indexOf(`reviewLoop('${st}'`);
    assert.ok(at > -1, st);
    assert.doesNotMatch(body.slice(at, at + 3500).split('reviewLoop(')[1] || '', /byId/);
  }
});

// ---- E21 T4: restricted re-review, off by default ----
const rTask = { n: 2, title: 'Parse', tier: 'sonnet' };
const rImpl = { status: 'DONE', summary: 's', checks: [{ command: 'npm test', output: 'ok', exit: 0 }] };
const F = (id, description = 'd') => ({ severity: 'critical', category: 'defeito', id, file: 'a.js', description });
const rCtx = (over = {}) => ({
  base: 'BASE', envFacts: 'x', baseline: 'y', E: 'E9', wt: '/wt/E9', planPath: 'p.md', specPath: 's.md', start: 'abc123', locks: [], round: 2,
  prev: P2.fmt([F('F1', 'null deref')]), was: { iss: [F('F1', 'null deref')], head: 'h1' }, pluginRoot: '/plug', diffPath: '/wt/_tmp/E9-t2-spec2.diff', ...over,
});

test('AC2: by default a re-review rereads the whole task range', () => {
  for (const taskReview of [undefined, { restricted: false }, { restricted: 'yes' }]) {
    const p = P2.buildTaskReviewPrompt(rCtx({ taskReview }), rTask, 'spec', rImpl);
    assert.match(p, /log -p abc123\.\.HEAD/);
    assert.match(p, /\[F1\] null deref/);
    assert.doesNotMatch(p, /review-package\.mjs/);
    assert.doesNotMatch(p, /Mode: restricted/);
  }
});

test('AC2: the restricted re-review gets only the open findings and the fix diff', () => {
  const p = P2.buildTaskReviewPrompt(rCtx({ taskReview: { restricted: true } }), rTask, 'spec', rImpl);
  assert.match(p, /Mode: restricted/);
  assert.match(p, /\[F1\] null deref/);
  assert.ok(p.includes('node "/plug/scripts/review-package.mjs" "/wt/E9" h1 HEAD "/wt/_tmp/E9-t2-spec2.diff"'));
  assert.doesNotMatch(p, /log -p abc123\.\.HEAD/);
  const noId = P2.buildTaskReviewPrompt(rCtx({ taskReview: { restricted: true }, was: { iss: [F('F1'), { severity: 'critical', category: 'defeito', description: 'no id' }], head: 'h1' } }), rTask, 'spec', rImpl);
  assert.match(noId, /log -p abc123\.\.HEAD/);
  assert.doesNotMatch(noId, /review-package\.mjs/);
  const first = P2.buildTaskReviewPrompt(rCtx({ taskReview: { restricted: true }, prev: null, was: undefined }), rTask, 'spec', rImpl);
  assert.match(first, /log -p abc123\.\.HEAD/);
  assert.ok(!P2.restrictedRound(rCtx({ taskReview: { restricted: true }, was: { iss: [], head: 'h1' } })));
});

test('AC2: taskIssues keeps open and missing verdicts and drops closed ones', () => {
  const on = (...prev) => rCtx({ taskReview: { restricted: true }, was: { iss: prev, head: 'h1' } });
  const prev = [F('F1'), F('F2'), F('F3')];
  const r = { issues: [F('F4', 'new')], verdicts: [{ id: 'F1', open: true }, { id: 'F2', open: false }] };
  assert.deepEqual(P2.taskIssues(r, on(...prev)).map(i => i.id), ['F4', 'F1', 'F3']);
  const again = { issues: [F('F1', 'reworded')], verdicts: [{ id: 'F1', open: true }] };
  assert.deepEqual(P2.taskIssues(again, on(F('F1'))).map(i => i.description), ['reworded']);
  assert.deepEqual(P2.taskIssues({ issues: [] }, on(F('F1'))).map(i => i.id), ['F1']);
  assert.equal(P2.taskIssues(r, rCtx({ taskReview: { restricted: false } })), r.issues);
  assert.equal(P2.taskIssues(r, rCtx({ taskReview: { restricted: true }, was: { iss: [F('F1'), { severity: 'critical', description: 'no id' }], head: 'h1' } })), r.issues);
});

test('AC2: the per-task loop turns the restricted mode on only when taskReview.restricted is true', () => {
  const body = SRC.slice(SRC.indexOf('async function runDeliverable'));
  const loop = body.slice(body.indexOf('reviewLoop(`T${t.n}:${kind}`'));
  const at = loop.slice(0, loop.indexOf('if (loop.halted)'));
  assert.match(at, /taskReview: CFG\.taskReview/);
  assert.match(at, /taskIssues\(r, /);
  assert.match(SRC, /taskReview\.restricted === true/);
  assert.doesNotMatch(SRC, /taskReview\.restricted\)/);
});

test('AC2: runReviewLoop hands the next review the previous findings and the measured head', async () => {
  const seen = [];
  let n = 0;
  const env = { maxFix: 2, blqIds: new Set(), reviews: [], concerns: [], acceptRisks() {} };
  await P2.runReviewLoop(env, 'T1:spec', async (round, prev, rm, was) => { seen.push(was); return { issues: n++ === 0 ? [F('F1')] : [], headSha: 'h' + n, clean: true, commitsInRange: 1 }; },
    async () => ({ status: 'DONE' }), r => r.issues, { tier: 'sonnet', byId: true });
  assert.equal(seen[0], undefined);
  assert.deepEqual(seen[1], { iss: [F('F1')], head: 'h1' });
});
