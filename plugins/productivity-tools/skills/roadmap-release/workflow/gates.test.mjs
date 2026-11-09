import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPure } from './load-pure.mjs';

const { validMeasure, gatePasses, allPass, isRedBaseline, mergeFloor } = loadPure();
const T = { name: 'unit', kind: 'tests' };
const X = { name: 'lint', kind: 'exit' };
const INV = { name: 'drift', kind: 'exit', invariant: true };
const res = (name, o = {}) => ({ name, ran: true, exit: 0, total: 10, skipped: 0, failedNames: [], ...o });
const meas = (gates, o = {}) => ({ headSha: 'abc1234', clean: true, gates, ...o });

test('validMeasure: tests with exit 1 and no failed names is invalid and does not pass', () => {
  const bad = res('unit', { exit: 1 });
  assert.equal(validMeasure(meas([bad]), 'abc1234', [T]), false);
  assert.equal(gatePasses(T, bad, res('unit')), false);
});

test('validMeasure: dirty tree, other sha or missing result is invalid; prefix sha is fine', () => {
  const g = [res('unit')];
  assert.equal(validMeasure(meas(g), 'abc1234', [T]), true);
  assert.equal(validMeasure(meas(g), 'abc', [T]), true);
  assert.equal(validMeasure(meas(g, { clean: false }), 'abc1234', [T]), false);
  assert.equal(validMeasure(meas(g), 'fff9999', [T]), false);
  assert.equal(validMeasure(meas(g), 'abc1234', [T, X]), false);
  assert.equal(validMeasure(null, 'abc1234', [T]), false);
});

test('tests: failures subset of baseline pass; new failure fails', () => {
  const base = res('unit', { exit: 1, failedNames: ['a', 'b'] });
  assert.equal(gatePasses(T, res('unit', { exit: 1, failedNames: ['a'] }), base), true);
  assert.equal(gatePasses(T, res('unit', { exit: 1, failedNames: ['a', 'c'] }), base), false);
});

test('tests: lower total or higher skipped than baseline fails', () => {
  const base = res('unit', { total: 10, skipped: 1 });
  assert.equal(gatePasses(T, res('unit', { total: 9, skipped: 1 }), base), false);
  assert.equal(gatePasses(T, res('unit', { total: 10, skipped: 2 }), base), false);
  assert.equal(gatePasses(T, res('unit', { total: 11, skipped: 0 }), base), true);
});

test('exit: only the code matters, unless baseline is already red', () => {
  assert.equal(gatePasses(X, res('lint', { exit: 1 }), res('lint')), false);
  assert.equal(gatePasses(X, res('lint', { exit: 1 }), res('lint', { exit: 2 })), true);
  assert.equal(gatePasses(X, res('lint'), res('lint', { exit: 2 })), true);
});

test('invariant ignores baseline; ran false fails', () => {
  assert.equal(gatePasses(INV, res('drift'), res('drift', { exit: 1 })), true);
  assert.equal(gatePasses(INV, res('drift', { exit: 1 }), res('drift', { exit: 1 })), false);
  assert.equal(gatePasses(INV, res('drift', { ran: false }), res('drift')), false);
  assert.equal(gatePasses(INV, undefined, undefined), false);
});

test('allPass: reports failures, missing result is a failure', () => {
  const base = { unit: res('unit'), lint: res('lint') };
  const ok = allPass([T, X], meas([res('unit'), res('lint')]), base, []);
  assert.deepEqual(ok, { ok: true, failures: [] });
  const bad = allPass([T, X], meas([res('unit')]), base, []);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.failures, ['lint']);
});

test('isRedBaseline lists failing exit, empty tests and violated invariant', () => {
  const base = { lint: res('lint', { exit: 1 }), unit: res('unit', { total: 0 }), drift: res('drift', { exit: 1 }) };
  assert.deepEqual(isRedBaseline([X, T, INV], base).sort(), ['drift', 'lint', 'unit']);
  const green = { lint: res('lint'), unit: res('unit'), drift: res('drift') };
  assert.deepEqual(isRedBaseline([X, T, INV], green), []);
});

test('ignoreFailuresWhenChanged only ignores prefixed failures when paths are touched', () => {
  const smoke = { name: 'smoke', kind: 'tests', ignoreFailuresWhenChanged: { paths: ['functions/'], failurePrefix: 'smoke:' } };
  const base = { smoke: res('smoke') };
  const m = meas([res('smoke', { exit: 1, failedNames: ['smoke:a'] })]);
  assert.equal(allPass([smoke], m, base, ['functions/x.ts']).ok, true);
  assert.equal(allPass([smoke], m, base, ['src/x.ts']).ok, false);
  const mixed = meas([res('smoke', { exit: 1, failedNames: ['smoke:a', 'other'] })]);
  assert.equal(allPass([smoke], mixed, base, ['functions/x.ts']).ok, false);
});

test('mergeFloor raises totals to the branch measure discounting baseline flaky failures', () => {
  const base = { unit: res('unit', { total: 10, exit: 1, failedNames: ['f1', 'f2'] }), lint: res('lint', { total: 0 }) };
  const floor = mergeFloor(base, meas([res('unit', { total: 20 }), res('lint')]));
  assert.equal(floor.unit.total, 18);
  assert.deepEqual(floor.unit.failedNames, ['f1', 'f2']);
  assert.equal(base.unit.total, 10);
  const lower = mergeFloor(base, meas([res('unit', { total: 5 })]));
  assert.equal(lower.unit.total, 10);
  assert.deepEqual(mergeFloor(base, null).unit, base.unit);
});
