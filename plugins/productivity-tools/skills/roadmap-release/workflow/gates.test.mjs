import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPure } from './load-pure.mjs';
import { canon, fnv1a } from '../../../lib/plan-digest.mjs';

const { validMeasure, measureProblems, validEvidence, gatePasses, allPass, isRedBaseline, mergeFloor, totalOnlyGates, gateFromCapture, capturedMeasure, gateSubset, gateSummary, commandDigest } = loadPure();
const T = { name: 'unit', kind: 'tests' };
const X = { name: 'lint', kind: 'exit' };
const INV = { name: 'drift', kind: 'exit', invariant: true };
const res = (name, o = {}) => ({ name, ran: true, exit: 0, total: 10, skipped: 0, failedNames: [], ...o });
const meas = (gates, o = {}) => ({ headSha: 'abc1234'.padEnd(40, '0'), clean: true, gates, ...o });

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

test('validMeasure: without expectedSha only a full 40-hex headSha counts', () => {
  const g = [res('unit')];
  const sha40 = 'a'.repeat(40);
  const sha36 = 'a'.repeat(36);
  assert.equal(validMeasure(meas(g, { headSha: sha36 }), null, [T]), false);
  assert.equal(validMeasure(meas(g, { headSha: sha40 }), null, [T]), true);
  assert.equal(validMeasure(meas(g, { headSha: sha40 }), '', [T]), true);
});

test('fullSha accepts SHA-1 and SHA-256 ids only; agent SHAs are trimmed and lowercased', () => {
  const g = [res('unit')];
  const hex = (n) => 'a1b2c3d4'.repeat(8).slice(0, n);
  assert.equal(validMeasure(meas(g, { headSha: hex(64) }), null, [T]), true);
  assert.equal(validMeasure(meas(g, { headSha: hex(40) }), null, [T]), true);
  assert.equal(validMeasure(meas(g, { headSha: hex(41) }), null, [T]), false);
  assert.equal(validMeasure(meas(g, { headSha: hex(63) }), null, [T]), false);
  assert.equal(validMeasure(meas(g, { headSha: hex(40) + '\n' }), null, [T]), true);
  assert.equal(validMeasure(meas(g, { headSha: hex(40).toUpperCase() }), hex(40), [T]), true);
  assert.equal(validEvidence({ clean: true, headSha: ' ' + hex(40).toUpperCase() + '\n', beforeOk: true }, hex(40), false), true);
  assert.equal(validEvidence({ clean: true, headSha: hex(63), beforeOk: true }, null, false), false);
});

test('validEvidence: needs clean, full headSha, matching exp and beforeOk when required', () => {
  const sha40 = 'b'.repeat(40);
  const ev = (o = {}) => ({ clean: true, headSha: sha40, beforeOk: true, ...o });
  assert.equal(validEvidence(ev({ headSha: 'b'.repeat(36) }), null, false), false);
  assert.equal(validEvidence(ev(), null, false), true);
  assert.equal(validEvidence(ev(), sha40, false), true);
  assert.equal(validEvidence(ev(), 'c'.repeat(40), false), false);
  assert.equal(validEvidence(ev({ clean: false }), null, false), false);
  assert.equal(validEvidence(ev({ beforeOk: false }), null, true), false);
  assert.equal(validEvidence(ev({ beforeOk: false }), null, false), true);
  assert.equal(validEvidence(null, null, false), false);
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

test('ignoreFailuresWhenChanged does not turn an incoherent tests failure green', () => {
  const smoke = { name: 'smoke', kind: 'tests', ignoreFailuresWhenChanged: { paths: ['functions/'], failurePrefix: 'smoke:' } };
  const m = meas([res('smoke', { exit: 1, failedNames: [] })]);
  assert.equal(allPass([smoke], m, { smoke: res('smoke') }, ['functions/x.ts']).ok, false);
});

test('ignoreFailuresWhenChanged on an exit gate never erases a failure', () => {
  const lint = { name: 'lint', kind: 'exit', ignoreFailuresWhenChanged: { paths: ['functions/'], failurePrefix: 'x:' } };
  const m = meas([res('lint', { exit: 1 })]);
  assert.equal(allPass([lint], m, { lint: res('lint') }, ['functions/x.ts']).ok, false);
});

// ---- E41 B2 T2: the gates are measured from the JSON of capture.mjs, not from copied text
const CAPTURE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'capture.mjs');
const NONCE_RE = /^[A-Za-z0-9:._@-]{1,160}$/;
const signedLine = (o) => JSON.stringify({ ...o, digest: fnv1a(JSON.stringify(canon(o))) });
const expectOf = (def, nonce) => ({ nonce, cmdDigest: commandDigest({ bash: def.cmd }) });
// A real run of capture.mjs in a throwaway git repository (the suite of 63 tests: 60 pass, FAIL_A, FAIL_B and FAIL_C fail).
function realCapture(def, nonce, files = {}, { brief = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rr-gate-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q', dir]).status, 0);
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    const args = [CAPTURE, 'run', '--nonce', nonce, '--task', 'E1-gates', ...(def.kind === 'tests' ? ['--tests'] : []), '--cwd', dir, ...(brief ? ['--brief'] : []), '--bash', def.cmd];
    const { NODE_TEST_CONTEXT, ...env } = process.env; // a child node --test must not think it runs inside this runner
    const r = spawnSync('node', args, { encoding: 'utf8', env });
    return r.stdout.trim();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const SUITE = "import { test } from 'node:test';\nfor (let i = 0; i < 60; i++) test('ok ' + i, () => {});\nfor (const n of ['FAIL_A', 'FAIL_B', 'FAIL_C']) test(n, () => { throw new Error('x'); });\n";
const UNIT = { name: 'unit', kind: 'tests', cmd: 'node --test suite.test.mjs' };

test('AC4: failedNames and total come from the JSON of capture, not from the text the agent copied', () => {
  const nonce = 'abc12345:E1:gates1-1:g0';
  const line = realCapture(UNIT, nonce, { 'suite.test.mjs': SUITE });
  const g = { name: 'unit', ran: true, exit: 0, total: 99, skipped: 7, failedNames: ['x'], capture: line };
  const r = gateFromCapture(UNIT, g, expectOf(UNIT, nonce));
  assert.equal(r.exit, 1);
  assert.equal(r.total, 63);
  assert.deepEqual(r.failedNames, ['FAIL_A', 'FAIL_B', 'FAIL_C']);
  assert.equal(r.skipped, 0);
  assert.equal(r.name, 'unit');
  assert.ok(!r.fallback);
  assert.ok(!r.failedNamesCut);
  assert.equal(gateFromCapture(UNIT, { ...g, capture: line + '\n' }, expectOf(UNIT, nonce)).total, 63);
});

test('C3: format unknown with exit 1 takes the exit from capture and total and names from the agent, marked as fallback', () => {
  const def = { name: 'unit', kind: 'tests', cmd: "node -e 'console.log(1);process.exit(1)'" };
  const nonce = 'abc12345:E1:gates1-1:g0';
  const line = realCapture(def, nonce);
  assert.equal(JSON.parse(line).extract.format, 'unknown');
  const g = { name: 'unit', ran: true, exit: 0, total: 5, skipped: 1, failedNames: ['t/a.test.mjs::boom'], capture: line };
  const r = gateFromCapture(def, g, expectOf(def, nonce));
  assert.equal(r.exit, 1);
  assert.equal(r.total, 5);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.failedNames, ['t/a.test.mjs::boom']);
  assert.equal(r.fallback, true);
  assert.match(gateSummary([def], { gates: [r] }, {}), /fallback/);
  // a failure without a recognizable name never passes
  const bare = gateFromCapture(def, { ...g, failedNames: [] }, expectOf(def, nonce));
  assert.equal(gatePasses(def, bare, null), false);
});

test('an exit gate takes only the exit from capture', () => {
  const def = { name: 'lint', kind: 'exit', cmd: 'node -e "process.exit(3)"' };
  const nonce = 'abc12345:E1:gates1-1:g0';
  const line = realCapture(def, nonce);
  const r = gateFromCapture(def, { name: 'lint', ran: true, exit: 0, capture: line }, expectOf(def, nonce));
  assert.equal(r.exit, 3);
  assert.equal(r.ran, true);
});

const capJson = (def, nonce, extract, exit = 1) => signedLine({ tool: 'capture', nonce, task: 'E1-gates', cmdDigest: commandDigest({ bash: def.cmd }), exit, bytes: 1, sha256: 'x', lines: 1, path: 'p', stderrBytes: 0, stderrSha256: 'y', stderrPath: 'q', tail: '', tailCut: 0, extract });
const ex = (o) => ({ format: 'node-tap', exit: 1, total: 63, pass: 60, fail: 3, skipped: 0, failedNames: ['a', 'b'], failedNamesCut: 0, ...o });

test('C4: a cut list of names carries failedNamesCut and never passes a failure against a red baseline with the same names', () => {
  const nonce = 'n:E1:g0';
  const base = res('unit', { exit: 1, total: 63, failedNames: ['a', 'b'] });
  const whole = gateFromCapture(UNIT, { name: 'unit', capture: capJson(UNIT, nonce, ex()) }, expectOf(UNIT, nonce));
  assert.equal(gatePasses(UNIT, whole, base), true);
  const cut = gateFromCapture(UNIT, { name: 'unit', capture: capJson(UNIT, nonce, ex({ failedNamesCut: 2 })) }, expectOf(UNIT, nonce));
  assert.equal(cut.failedNamesCut, 2);
  assert.deepEqual(cut.failedNames, ['a', 'b']);
  assert.equal(gatePasses(UNIT, cut, base), false);
  assert.equal(allPass([UNIT], meas([cut]), { unit: base }, []).ok, false);
});

test('a wrong nonce, a tampered digest, a foreign command or a missing JSON give no result and the measure is invalid', () => {
  const nonce = 'n:E1:g0';
  const good = capJson(UNIT, nonce, ex());
  const ok = (g, e = expectOf(UNIT, nonce)) => gateFromCapture(UNIT, g, e);
  assert.notEqual(ok({ name: 'unit', capture: good }), null);
  assert.equal(ok({ name: 'unit', capture: good }, expectOf(UNIT, 'n:E1:g1')), null);
  assert.equal(ok({ name: 'unit', capture: good.replace('"exit":1', '"exit":0') }), null);
  assert.equal(ok({ name: 'unit', capture: good }, { nonce, cmdDigest: commandDigest({ bash: 'npm test' }) }), null);
  assert.equal(ok({ name: 'unit' }), null);
  assert.equal(ok(undefined), null);
  assert.equal(ok({ name: 'unit', capture: 'not json' }), null);
  assert.equal(ok({ name: 'unit', capture: capJson(UNIT, nonce, ex({ failedNames: ['n'.repeat(4000)] })) }), null);
  const m = { headSha: 'a'.repeat(40), clean: true, gates: [{ name: 'unit', ran: true, exit: 1, total: 63, failedNames: ['a'], capture: good.replace('"exit":1', '"exit":0') }] };
  const checked = capturedMeasure([UNIT], m, () => nonce);
  assert.equal(checked.gates.length, 0);
  assert.equal(validMeasure(checked, null, [UNIT]), false);
  assert.equal(capturedMeasure([UNIT], null, () => nonce), null);
  assert.equal(validMeasure(capturedMeasure([UNIT], { ...m, gates: [{ ...m.gates[0], capture: good }] }, () => nonce), null, [UNIT]), true);
});

test('a gate with a space in the name and a single quote in the command: the real capture gives a digest that matches', () => {
  const def = { name: 'unit tests', kind: 'exit', cmd: "node -e 'process.exit(0)'" };
  const nonce = 'abc12345:E1:gates1-1:g0';
  assert.match(nonce, NONCE_RE);
  const line = realCapture(def, nonce);
  assert.equal(JSON.parse(line).cmdDigest, commandDigest({ bash: def.cmd }));
  const r = gateFromCapture(def, { name: 'unit tests', ran: true, exit: 5, capture: line }, expectOf(def, nonce));
  assert.equal(r.exit, 0);
});

test('E42 AC1: an exit gate with a real --brief capture enters the measure and is not reported missing', () => {
  const def = { name: 'lint', kind: 'exit', cmd: 'node -e "process.exit(0)"' };
  const nonce = 'abc12345:preflight:g0';
  const line = realCapture(def, nonce, {}, { brief: true });
  assert.equal('tail' in JSON.parse(line), false);
  const m = capturedMeasure([def], meas([{ name: 'lint', ran: true, exit: 5, capture: line }]), () => nonce);
  assert.deepEqual(m.gates, [{ name: 'lint', ran: true, exit: 0 }]);
  assert.equal(validMeasure(m, null, [def]), true);
  assert.deepEqual(measureProblems(m, null, [def]), []);
});

test('R4: gateSubset compares the names without the file prefix', () => {
  assert.equal(gateSubset(['path/of/file.test.mjs::nome'], ['nome']), true);
  assert.equal(gateSubset(['nome'], ['path/of/file.test.mjs::nome']), true);
  assert.equal(gateSubset(['a/x.test.mjs::nome'], ['b/y.test.mjs::nome']), true);
  assert.equal(gateSubset(['a/x.test.mjs::outro'], ['nome']), false);
  assert.equal(gateSubset([], undefined), true);
  assert.equal(gateSubset(['nome'], undefined), false);
});

test('R4: ignoreFailuresWhenChanged takes the names (with the file prefix) from the agent and the exit from capture', () => {
  const smoke = { name: 'smoke', kind: 'tests', cmd: 'npm run smoke', ignoreFailuresWhenChanged: { paths: ['functions/'], failurePrefix: 'smoke/e2e.test.mjs::' } };
  const nonce = 'n:E1:g0';
  const line = capJson(smoke, nonce, ex({ failedNames: ['boom'] }));
  const r = gateFromCapture(smoke, { name: 'smoke', ran: true, exit: 0, total: 9, skipped: 0, failedNames: ['smoke/e2e.test.mjs::boom'], capture: line }, expectOf(smoke, nonce));
  assert.equal(r.exit, 1);
  assert.deepEqual(r.failedNames, ['smoke/e2e.test.mjs::boom']);
  assert.equal(r.total, 9);
  assert.equal(r.fallback, true);
  const base = { smoke: res('smoke', { total: 9 }) };
  assert.equal(allPass([smoke], meas([r]), base, ['functions/x.ts']).ok, true);
  assert.equal(allPass([smoke], meas([r]), base, ['src/x.ts']).ok, false);
});

test('E41 T3: ran=false without a capture line is kept (exit -1 when none given), not dropped', () => {
  const r = gateFromCapture(X, { name: 'lint', ran: false }, { nonce: 'n', cmdDigest: 'x' });
  assert.deepEqual(r, { name: 'lint', ran: false, exit: -1 });
  assert.deepEqual(gateFromCapture(T, { name: 'unit', ran: false, exit: 127 }, { nonce: 'n', cmdDigest: 'x' }), { name: 'unit', ran: false, exit: 127 });
  const m = capturedMeasure([X], meas([{ name: 'lint', ran: false }]), () => 'n');
  assert.equal(m.gates.length, 1);
  assert.equal(m.gates[0].ran, false);
});

// ---- E36 T4: discount of declared removed tests
test('E36 gatePasses: a drop equal to n passes, a larger drop or a drop without n fails', () => {
  const base = res('unit', { total: 10 });
  assert.equal(gatePasses(T, res('unit', { total: 7 }), base, 3), true);
  assert.equal(gatePasses(T, res('unit', { total: 6 }), base, 3), false);
  assert.equal(gatePasses(T, res('unit', { total: 7 }), base), false);
  assert.equal(gatePasses(T, res('unit', { total: 7 }), base, 0), false);
  assert.equal(gatePasses(T, res('unit', { total: 0 }), res('unit', { total: 3 }), 3), false);
});

test('E36 gatePasses: n that is not an integer or is below 1 counts 0; failures and skips are not discounted', () => {
  const base = res('unit', { total: 10 });
  for (const n of [1.5, -2, '3', NaN, null, undefined]) assert.equal(gatePasses(T, res('unit', { total: 7 }), base, n), false);
  assert.equal(gatePasses(T, res('unit', { total: 7, exit: 1, failedNames: ['x'] }), base, 3), false);
  assert.equal(gatePasses(T, res('unit', { total: 7, skipped: 1 }), base, 3), false);
});

test('E36 allPass: n applies per tests gate and is ignored for fallback, invariant and ignoreFailuresWhenChanged', () => {
  const base = { unit: res('unit', { total: 10 }), drift: res('drift') };
  const m = meas([res('unit', { total: 7 }), res('drift')]);
  assert.equal(allPass([T, INV], m, base, [], {}).ok, false);
  assert.equal(allPass([T, INV], m, base, [], { unit: 3 }).ok, true);
  assert.equal(allPass([T, INV], m, base, [], { unit: 2 }).ok, false);
  const fb = meas([res('unit', { total: 7, fallback: true })]);
  assert.equal(allPass([T], fb, base, [], { unit: 3 }).ok, false);
  const ign = { name: 'unit', kind: 'tests', ignoreFailuresWhenChanged: { paths: ['functions/'], failurePrefix: 'smoke:' } };
  assert.equal(allPass([ign], m, base, ['src/x.ts'], { unit: 3 }).ok, false);
  const inv = { name: 'unit', kind: 'tests', invariant: true };
  assert.equal(allPass([inv], meas([res('unit', { total: 7 })]), base, [], { unit: 3 }).ok, true);
});

test('E36 mergeFloor: n lowers the floor total, never below the branch measure minus baseline failures', () => {
  const base = { unit: res('unit', { total: 10 }), lint: res('lint', { total: 0 }) };
  assert.equal(mergeFloor(base, meas([res('unit', { total: 7 })])).unit.total, 10);
  assert.equal(mergeFloor(base, meas([res('unit', { total: 7 })]), { unit: 3 }).unit.total, 7);
  assert.equal(mergeFloor(base, meas([res('unit', { total: 12 })]), { unit: 3 }).unit.total, 12);
  assert.equal(mergeFloor(base, meas([res('unit', { total: 7 })]), { unit: 1.5 }).unit.total, 10);
  assert.equal(mergeFloor(base, null, { unit: 3 }).unit.total, 10);
  assert.equal(base.unit.total, 10);
});

test('E36 totalOnlyGates: only tests gates that fail the total alone', () => {
  const base = { unit: res('unit', { total: 10, skipped: 1 }), e2e: res('e2e', { total: 5, exit: 1, failedNames: ['a'] }), drift: res('drift', { total: 5 }), smk: res('smk', { total: 5 }) };
  const E2E = { name: 'e2e', kind: 'tests' };
  const DR = { name: 'drift', kind: 'tests', invariant: true };
  const SMK = { name: 'smk', kind: 'tests', ignoreFailuresWhenChanged: { paths: ['functions/'], failurePrefix: 's:' } };
  const run = (o) => totalOnlyGates([T, E2E, DR, SMK, X], meas(o), base, []);
  assert.deepEqual(run([res('unit', { total: 7 }), res('e2e', { total: 3, exit: 1, failedNames: ['a'] }), res('drift', { total: 3 }), res('smk', { total: 3 }), res('lint')]), ['unit', 'e2e']);
  assert.deepEqual(run([res('unit', { total: 7, skipped: 2 })]), []);
  assert.deepEqual(run([res('unit', { total: 7, exit: 1, failedNames: ['new'] })]), []);
  assert.deepEqual(run([res('unit', { total: 7, exit: 1, failedNames: ['a'], failedNamesCut: 1 })]), []);
  assert.deepEqual(run([res('unit', { total: 7, fallback: true })]), []);
  assert.deepEqual(run([res('unit', { total: 10 })]), []);
  assert.deepEqual(run([res('unit', { total: 12 })]), []);
  assert.deepEqual(run([res('unit', { total: 7, ran: false })]), []);
  assert.deepEqual(run([]), []);
});

test('E36 gateFromCapture keeps outPath and outSha only for a tests gate that is not a fallback', () => {
  const nonce = 'n:E36:g0';
  const t = gateFromCapture(UNIT, { name: 'unit', capture: capJson(UNIT, nonce, ex()) }, expectOf(UNIT, nonce));
  assert.equal(t.outPath, 'p');
  assert.equal(t.outSha, 'x');
  const lint = { name: 'lint', kind: 'exit', cmd: 'node -e 0' };
  const e = gateFromCapture(lint, { name: 'lint', capture: capJson(lint, nonce, null, 0) }, expectOf(lint, nonce));
  assert.equal('outPath' in e, false);
  assert.equal('outSha' in e, false);
  const unk = gateFromCapture(UNIT, { name: 'unit', total: 5, failedNames: ['a'], capture: capJson(UNIT, nonce, ex({ format: 'unknown' })) }, expectOf(UNIT, nonce));
  assert.equal(unk.fallback, true);
  assert.equal('outPath' in unk, false);
  assert.equal('outSha' in unk, false);
});

test('E36 validMeasure accepts a measure whose gates carry outPath and outSha', () => {
  const g = [res('unit', { outPath: 'p', outSha: 'x' })];
  assert.equal(validMeasure(meas(g), 'abc1234', [T]), true);
});
