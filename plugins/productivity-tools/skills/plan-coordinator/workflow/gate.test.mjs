import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPure } from '../../roadmap-release/workflow/load-pure.mjs';

const COORDINATOR = fileURLToPath(new URL('./coordinator.js', import.meta.url));
const P = loadPure(COORDINATOR);

test('failedTestNames reads TAP not ok lines', () => {
  const out = ['TAP version 13', 'ok 1 - good', 'not ok 2 - first bad', 'not ok 3 - second bad', '1..3'].join('\n');
  assert.deepEqual(P.failedTestNames(out), ['first bad', 'second bad']);
});

test('failedTestNames reads spec cross lines', () => {
  const out = ['✔ good (1.2ms)', '✖ spec bad (3.4ms)', '✖ other bad', 'ℹ fail 2'].join('\n');
  assert.deepEqual(P.failedTestNames(out), ['spec bad', 'other bad']);
});

test('failedTestNames gives an empty list when no names are recognizable', () => {
  assert.deepEqual(P.failedTestNames('all fine\nnothing here'), []);
  assert.deepEqual(P.failedTestNames(''), []);
  assert.deepEqual(P.failedTestNames(undefined), []);
});

test('waveGatePasses: exit 0 passes', () => {
  assert.equal(P.waveGatePasses({ exit: 0, failedNames: [] }, null), true);
  assert.equal(P.waveGatePasses({ exit: 0, failedNames: [] }, { exit: 1, failedNames: ['a'] }), true);
});

test('waveGatePasses: same failures as a red baseline pass', () => {
  const baseline = { exit: 1, failedNames: ['a', 'b'] };
  assert.equal(P.waveGatePasses({ exit: 1, failedNames: ['b', 'a'] }, baseline), true);
  assert.equal(P.waveGatePasses({ exit: 1, failedNames: ['a'] }, baseline), true);
});

test('waveGatePasses: a new failure fails', () => {
  const baseline = { exit: 1, failedNames: ['a'] };
  assert.equal(P.waveGatePasses({ exit: 1, failedNames: ['a', 'c'] }, baseline), false);
});

test('waveGatePasses: a failure against a green baseline fails', () => {
  assert.equal(P.waveGatePasses({ exit: 1, failedNames: ['a'] }, { exit: 0, failedNames: [] }), false);
  assert.equal(P.waveGatePasses({ exit: 1, failedNames: ['a'] }, null), false);
});

test('waveGatePasses: exit 1 with no recognizable names fails (C4)', () => {
  assert.equal(P.waveGatePasses({ exit: 1, failedNames: [] }, { exit: 1, failedNames: ['a'] }), false);
  assert.equal(P.waveGatePasses({ exit: 2, failedNames: [] }, { exit: 0, failedNames: [] }), false);
});

test('checkSigned verifies tool, command, nonce and digest', () => {
  const body = { tool: 'progress', command: 'read', nonce: 'N1', now: 'x', state: { a: 1 } };
  const out = { ...body, digest: P.fnv1a(JSON.stringify(P.canon(body))) };
  assert.equal(P.checkSigned(out, 'N1', 'read').ok, true);
  assert.equal(P.checkSigned(out, 'N2', 'read').ok, false);
  assert.equal(P.checkSigned(out, 'N1', 'apply').ok, false);
  assert.equal(P.checkSigned({ ...out, now: 'y' }, 'N1', 'read').ok, false);
  assert.equal(P.checkSigned({ ...out, tool: 'other' }, 'N1', 'read').ok, false);
  assert.equal(P.checkSigned(null, 'N1', 'read').ok, false);
});

test('validateArgs accepts a complete launch', () => {
  const r = P.validateArgs({ plan: '/p/plan.md', state: '/p/progress.json', runToken: 'abc', authorizeExternal: ['plan:T3@0123abcd'], answers: [{ type: 'answer', n: 1 }], test: 'npm test' });
  assert.equal(r.error, null);
  assert.deepEqual(r.authorizeExternal, ['plan:T3@0123abcd']);
});

test('validateArgs refuses missing plan, state or runToken', () => {
  const ok = { plan: '/p/plan.md', state: '/p/progress.json', runToken: 'abc' };
  for (const k of ['plan', 'state', 'runToken']) {
    assert.ok(P.validateArgs({ ...ok, [k]: '' }).error, k);
    assert.ok(P.validateArgs({ ...ok, [k]: undefined }).error, k);
  }
  assert.ok(P.validateArgs(undefined).error);
});

test('validateArgs refuses plan:T3 without digest with the exact form', () => {
  const r = P.validateArgs({ plan: 'a', state: 'b', runToken: 'c', authorizeExternal: ['plan:T3'] });
  assert.ok(r.error.includes('plan:T3@<8 hex>'), r.error);
  assert.ok(P.validateArgs({ plan: 'a', state: 'b', runToken: 'c', authorizeExternal: ['gate:G3'] }).error);
});

test('validateArgs restricts answers and test', () => {
  const ok = { plan: 'a', state: 'b', runToken: 'c' };
  for (const type of ['answer', 'unblock', 'release', 'hold', 'refuse']) {
    assert.equal(P.validateArgs({ ...ok, answers: [{ type }] }).error, null, type);
  }
  assert.ok(P.validateArgs({ ...ok, answers: [{ type: 'launch' }] }).error);
  assert.equal(P.validateArgs({ ...ok, answers: [{ event: 'answer', step: 3, value: 'done', text: 'x' }] }).error, null, 'the documented key is event');
  assert.ok(P.validateArgs({ ...ok, answers: [{ event: 'launch' }] }).error);
  assert.ok(P.validateArgs({ ...ok, answers: [{ step: 3 }] }).error);
  assert.ok(P.validateArgs({ ...ok, test: 5 }).error);
});

test('capNames keeps 50 names and counts the rest', () => {
  const many = Array.from({ length: 80 }, (_, i) => `name ${i}`);
  const r = P.capNames(many);
  assert.equal(r.names.length, 50);
  assert.equal(r.cut, 30);
  assert.ok(r.names.every((n) => !n.includes('+')));
  assert.deepEqual(P.capNames(['a', 'b', 'c']), { names: ['a', 'b', 'c'], cut: 0 });
});

test('gateQuestion stays within 600 characters', () => {
  const many = Array.from({ length: 80 }, (_, i) => `a long failing test name number ${i} with padding`);
  const q = P.gateQuestion(2, 1, many);
  assert.ok(q.length <= 600, `length ${q.length}`);
  assert.ok(q.includes('+30'));
  assert.ok(q.includes('...'));
  assert.equal(P.gateQuestion(2, 1, ['x']), 'the gate of wave 2 failed (exit 1, failing: x); the person decides');
});

test('baselineEvent caps names and tail', () => {
  const stdout = Array.from({ length: 60 }, (_, i) => `not ok ${i + 1} - bad ${i}`).join('\n') + '\n' + 'z'.repeat(3000);
  const ev = P.baselineEvent('node --test', { exit: 1, stdout });
  assert.equal(ev.type, 'baseline');
  assert.ok(ev.tail.length <= 1500);
  assert.equal(ev.failedNames.length, 50);
  assert.equal(ev.failedNamesCut, 10);
});

test('waveGatePasses with a cut baseline', () => {
  const names = Array.from({ length: 50 }, (_, i) => `n${i}`);
  const baseline = { exit: 1, failedNames: names, failedNamesCut: 3 };
  assert.equal(P.waveGatePasses({ exit: 1, failedNames: names.slice(0, 5) }, baseline), true);
  assert.equal(P.waveGatePasses({ exit: 1, failedNames: ['n1', 'only-in-cut-part'] }, baseline), false);
});

test('cmdOverCap refuses a command above CMD_CAP', () => {
  assert.deepEqual(P.cmdOverCap('x'.repeat(6001)), { refuse: true, size: 6001 });
  assert.deepEqual(P.cmdOverCap('x'.repeat(6000)), { refuse: false });
});
