import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadPure } from '../../roadmap-release/workflow/load-pure.mjs';

const COORDINATOR = fileURLToPath(new URL('./coordinator.js', import.meta.url));
const P = loadPure(COORDINATOR);
const CAPTURE = fileURLToPath(new URL('../../../scripts/capture.mjs', import.meta.url));

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

// A real capture line of a generated suite: 63 tests, the three given ones fail (stdout in TAP, as node --test prints it).
function realCapture(failNames, { extra = '', tests = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-cap-'));
  try {
    const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8' }); assert.ok(r.status === 0 || r.status === 1, r.stderr); return r; };
    run('git', ['init', '-q']);
    const lines = ['TAP version 13'];
    for (let i = 1; i <= 63; i++) lines.push(i <= failNames.length ? 'not ok ' + i + ' - ' + failNames[i - 1] : 'ok ' + i + ' - good ' + i);
    lines.push('1..63', '# tests 63', '# pass ' + (63 - failNames.length), '# fail ' + failNames.length, '# skipped 0');
    const body = tests ? lines.join('\n') :'plain output without a summary';
    writeFileSync(join(dir, 's.mjs'), 'console.log(' + JSON.stringify(body + extra) + '); process.exit(' + (failNames.length ? 1 : 0) + ');\n');
    const r = spawnSync(process.execPath, [CAPTURE, 'run', '--nonce', 'N1', '--task', 'gt', '--tests', '--cwd', dir, '--', process.execPath, 's.mjs'], { encoding: 'utf8' });
    return JSON.parse(r.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('E41 AC4: waveGateOf takes failedNames and exit from the extractor of a real capture, not from copied text', () => {
  const cap = realCapture(['FAIL_A', 'FAIL_B', 'FAIL_C']);
  assert.equal(cap.extract.total, 63);
  assert.deepEqual(P.waveGateOf(cap), { exit: 1, failedNames: ['FAIL_A', 'FAIL_B', 'FAIL_C'] });
  assert.equal(P.waveGatePasses(P.waveGateOf(cap), P.waveGateOf(cap)), true);
});

test('E41 C3: an output that is not node:test and exits 1 has no names and the gate does not pass', () => {
  const cap = realCapture(['x'], { tests: false });
  assert.equal(cap.extract.format, 'unknown');
  const gate = P.waveGateOf(cap);
  assert.deepEqual(gate, { exit: 1, failedNames: [] });
  assert.equal(P.waveGatePasses(gate, { exit: 1, failedNames: ['x'] }), false);
  assert.deepEqual(P.waveGateOf(null), { exit: -1, failedNames: [] });
});

test('E41 C4: a cut list of names (failedNamesCut > 0) gives no names and fails against a baseline with the same names', () => {
  const cap = { exit: 1, extract: { failedNames: ['a', 'b'], failedNamesCut: 3 } };
  const gate = P.waveGateOf(cap);
  assert.deepEqual(gate, { exit: 1, failedNames: [] });
  assert.equal(P.waveGatePasses(gate, { exit: 1, failedNames: ['a', 'b'] }), false);
});

test('E41: baselineEvent and baselineProblem read exit, tail and extract of the capture JSON', () => {
  const cap = realCapture(['FAIL_A', 'FAIL_B', 'FAIL_C']);
  const ev = P.baselineEvent('node --test', cap);
  assert.deepEqual(ev, { type: 'baseline', test: 'node --test', exit: 1, tail: cap.tail, failedNames: ['FAIL_A', 'FAIL_B', 'FAIL_C'] });
  assert.match(P.baselineProblem(cap), /exited 1/);
  const green = realCapture([]);
  assert.equal(P.baselineProblem(green), null);
  assert.equal(P.baselineEvent('t', green).exit, 0);
});

test('E41: baselineEvent caps the names at 50 and adds failedNamesCut of the extractor', () => {
  const failedNames = Array.from({ length: 60 }, (_, i) => 'bad ' + i);
  const ev = P.baselineEvent('t', { exit: 1, tail: 'x', extract: { failedNames, failedNamesCut: 4 } });
  assert.equal(ev.failedNames.length, 50);
  assert.equal(ev.failedNamesCut, 14);
  assert.equal(P.baselineEvent('t', { exit: 1, tail: 'x', extract: { failedNames: ['a'], failedNamesCut: 0 } }).failedNamesCut, undefined);
});

test('2.0.1 AC1: baselineProblem names a failing or empty baseline and lets a plain green run through', () => {
  const ex = (total, pass) => ({ exit: 0, extract: { format: 'node-tap', total, pass, failedNames: [] } });
  assert.match(P.baselineProblem({ exit: 1, extract: { format: 'unknown', total: null, pass: null, failedNames: [] } }), /exited 1/);
  assert.match(P.baselineProblem({ exit: 2 }), /exited 2/);
  assert.match(P.baselineProblem(ex(0, 0)), /executed 0 tests/);
  assert.match(P.baselineProblem(ex(3, 0)), /passed 0 tests/);
  assert.equal(P.baselineProblem({ exit: 0, extract: { format: 'unknown', total: null, pass: null, failedNames: [] } }), null);
  assert.equal(P.baselineProblem(ex(2, 2)), null);
  assert.equal(P.baselineProblem({ exit: 0 }), null);
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
