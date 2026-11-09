import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPure } from './load-pure.mjs';

const { cleanSlug, selectDeliverables, isUnfinished, onTargetEffective } = loadPure();
const statuses = { onBranch: 'na-branch', integrated: ['integrada', 'publicada'], blocked: 'bloqueada', discarded: 'descartada' };
const card = (id, o = {}) => ({ id, phase: 'p1', track: 't', priority: 'P1', deps: [], status: 'planejada', onTarget: false, mergeFound: false, mergeSha: '', ...o });
const run = (cards, o = {}) => selectDeliverables({ cards, statuses, selector: 'next', ...o });

test('next includes the selected chain', () => {
  const r = run([card('E1', { onTarget: true, status: 'na-branch' }), card('E2', { deps: ['E1'] }), card('E3', { deps: ['E2'] })]);
  assert.deepEqual(r.order, ['E2', 'E3']);
  assert.equal(r.error, undefined);
});

test('ready only takes cards whose dependencies are already on the target', () => {
  const r = run([card('E1', { onTarget: true, status: 'na-branch' }), card('E2', { deps: ['E1'] }), card('E3', { deps: ['E2'] })], { selector: 'ready' });
  assert.deepEqual(r.order, ['E2']);
  assert.ok(r.notes.some((n) => n.startsWith('E3:')));
});

test('cycle returns error under every selector', () => {
  const cyc = [card('E1', { deps: ['E2'] }), card('E2', { deps: ['E1'] }), card('E3')];
  for (const selector of ['next', 'ready', 'all', ['E1', 'E2'], ['E3', 'E1']]) {
    const r = run(cyc, { selector });
    assert.match(r.error, /E1/, String(selector));
    assert.match(r.error, /E2/, String(selector));
    assert.deepEqual(r.order, []);
  }
});

test('a cycle among done cards only is not an error', () => {
  const done = { onTarget: true, status: 'na-branch' };
  const r = run([card('E1', { ...done, deps: ['E2'] }), card('E2', { ...done, deps: ['E1'] }), card('E3', { deps: ['E1'] })]);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.order, ['E3']);
});

test('blocked card stays out of next with a note', () => {
  const r = run([card('E1', { status: 'bloqueada' }), card('E2')]);
  assert.deepEqual(r.order, ['E2']);
  assert.ok(r.notes.some((n) => n.startsWith('E1:') && n.includes('bloqueada')));
});

test('heldBy removes the card unless overrideDonot', () => {
  const cards = [card('E1'), card('E2')];
  const held = new Map([['E1', 'não migrar X']]);
  const r = run(cards, { heldBy: held });
  assert.deepEqual(r.order, ['E2']);
  assert.equal(r.skipped[0].id, 'E1');
  assert.match(r.skipped[0].reason, /não migrar X/);
  assert.deepEqual(run(cards, { heldBy: { E1: 'v' }, overrideDonot: ['E1'] }).order, ['E1', 'E2']);
  assert.deepEqual(run(cards, { heldBy: { E1: 'v' } }).order, ['E2']);
});

test('maxDeliverables cuts to a topological prefix', () => {
  const cards = [card('E1'), card('E2', { deps: ['E1'] }), card('E3', { deps: ['E2'] })];
  const r = run(cards, { maxDeliverables: 2 });
  assert.deepEqual(r.order, ['E1', 'E2']);
  assert.deepEqual(r.skipped.map((s) => s.id), ['E3']);
  assert.match(r.skipped[0].reason, /maxDeliverables/);
});

test('explicit list: unknown ids error; done is skipped unless force; autoDeps pulls deps', () => {
  const cards = [card('E1', { onTarget: true, status: 'na-branch' }), card('E2'), card('E3', { deps: ['E2'] })];
  assert.match(run(cards, { selector: ['E9'] }).error, /E9/);
  assert.deepEqual(run(cards, { selector: ['E1'] }).order, []);
  assert.deepEqual(run(cards, { selector: ['E1'], force: true }).order, ['E1']);
  assert.deepEqual(run(cards, { selector: ['E3'], autoDeps: true }).order, ['E2', 'E3']);
  const r = run(cards, { selector: ['E3'] });
  assert.deepEqual(r.order, []);
  assert.match(r.skipped[0].reason, /E2/);
});

test('filters restrict the pool', () => {
  const r = run([card('E1', { phase: 'p1' }), card('E2', { phase: 'p2' })], { filters: { phase: 'p2' } });
  assert.deepEqual(r.order, ['E2']);
});

test('cleanSlug', () => {
  assert.equal(cleanSlug('E11-relatorios', 'E11'), 'relatorios');
  assert.equal(cleanSlug('', 'E1'), 'entrega');
  assert.equal(cleanSlug('Ação Rápida!', 'E1'), 'a-o-r-pida');
});

test('isUnfinished: merge found without a post-merge status', () => {
  assert.equal(isUnfinished(card('E1', { mergeFound: true, status: 'na-branch' }), statuses), false);
  assert.equal(isUnfinished(card('E1', { mergeFound: true, status: 'integrada' }), statuses), false);
  assert.equal(isUnfinished(card('E1', { mergeFound: true, status: 'em-andamento' }), statuses), true);
  assert.equal(isUnfinished(card('E1', { mergeFound: false, status: 'em-andamento' }), statuses), false);
  const pt = { ...statuses, onBranch: 'na-ramificacao' };
  assert.equal(isUnfinished(card('E1', { mergeFound: true, status: 'na-ramificacao' }), pt), false);
  assert.equal(isUnfinished(card('E1', { mergeFound: true, status: 'na-branch' }), pt), true);
});

const { cardStatus, unfinishedOutside, zeroTestGates } = loadPure();
const vocab = { integrated: ['integrated', 'released'], onBranch: 'on-branch', blocked: 'blocked', discarded: 'discarded' };

test('I2: cardStatus reads the panel cell with the rules of the checker', () => {
  const cases = [
    ['on-branch', 'on-branch'],
    ['blocked (BLQ-3)', 'blocked'],
    ['discarded (DEC-007)', 'discarded'],
    ['spec (waiting on (a) DEC-1)', 'spec'],
    ['code: on-branch; acceptance: blocked (BLQ-2)', 'on-branch'],
    ['Code: integrated; acceptance: blocked (BLQ-2)', 'integrated'],
    ['código: on-branch; aceite: blocked (BLQ-2)', 'on-branch'],
    ['code: executing; acceptance: blocked (BLQ-2)', 'blocked'],
    ['piece 1: integrated; piece 2: spec (waiting on DEC-004)', 'spec'],
    ['piece 1: integrated; piece 2: on-branch', 'integrated'],
    ['piece 1: discarded; piece 2: spec', 'spec'],
    ['', ''],
  ];
  for (const [cell, want] of cases) assert.equal(cardStatus(cell, vocab), want, cell);
});

test('I2: a segmented finished row is not unfinished; a blocked one is left out of next', () => {
  const finished = card('E1', { onTarget: true, mergeFound: true, status: cardStatus('code: on-branch; acceptance: blocked (BLQ-2)', vocab) });
  assert.equal(isUnfinished(finished, vocab), false);
  const r = selectDeliverables({ cards: [finished, card('E2', { status: cardStatus('blocked (BLQ-3)', vocab) })], statuses: vocab, selector: 'next' });
  assert.deepEqual(r.order, []);
});

test('C1: unfinishedOutside lists an interrupted merge left out of the order', () => {
  const cards = [card('E1', { mergeFound: true, onTarget: true, status: 'executing' }), card('E2'), card('E3', { mergeFound: true, onTarget: true, status: 'on-branch' })];
  assert.deepEqual(unfinishedOutside(cards, vocab, ['E2']), ['E1']);
  assert.deepEqual(unfinishedOutside(cards, vocab, ['E1', 'E2']), []);
});

test('I5: zeroTestGates names the tests gates that measured no tests', () => {
  const defs = [{ name: 'a', kind: 'tests' }, { name: 'b', kind: 'exit' }, { name: 'c', kind: 'tests' }, { name: 'd', kind: 'tests', invariant: true }];
  const base = { a: { ran: true, exit: 0, total: 0 }, b: { ran: true, exit: 1 }, c: { ran: true, exit: 0, total: 4 }, d: { ran: true, exit: 0 } };
  assert.deepEqual(zeroTestGates(defs, base), ['a']);
});

test('item 2: onTargetEffective trusts onTarget only for finished or on-branch statuses', () => {
  assert.equal(onTargetEffective({ onTarget: true, mergeFound: false, status: 'planejada' }, statuses), false);
  assert.equal(onTargetEffective({ onTarget: true, mergeFound: false, status: 'integrada' }, statuses), true);
  assert.equal(onTargetEffective({ onTarget: true, mergeFound: false, status: 'na-branch' }, statuses), true);
  assert.equal(onTargetEffective({ onTarget: true, mergeFound: true, status: 'executando' }, statuses), true);
  assert.equal(onTargetEffective({ onTarget: false, mergeFound: false, status: 'integrada' }, statuses), false);
});
