import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPure } from './load-pure.mjs';

const { cleanSlug, selectDeliverables, isUnfinished } = loadPure();
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

test('cycle returns error', () => {
  const r = run([card('E1', { deps: ['E2'] }), card('E2', { deps: ['E1'] })], { selector: 'all' });
  assert.match(r.error, /E1/);
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
