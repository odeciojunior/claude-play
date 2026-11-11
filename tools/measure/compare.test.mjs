import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare, median, medianVerdict, separationVerdict, staticVerdict } from './compare.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const AGG = join(here, 'fixtures', 'aggregates');
const load = (name) => JSON.parse(readFileSync(join(AGG, `${name}.json`), 'utf8'));
const run = (b, a, opts) => compare(load(b), load(a), opts);

function cli(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [join(here, 'compare.mjs'), ...args], { encoding: 'utf8', env });
}

test('pure helpers', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(medianVerdict([1], [], 0), 'inconclusivo');
  assert.equal(separationVerdict([1, 2], [2, 3]), 'inconclusivo');
  assert.equal(staticVerdict(null, 5), 'inconclusivo');
  assert.equal(staticVerdict(5, 6), 'piorou');
  assert.equal(staticVerdict(5, 5), 'nao-piorou');
});

test('structural: worse, not worse and inconclusive by median', () => {
  const worse = run('base', 'worse');
  assert.equal(worse.counters.haiku.verdict, 'piorou');
  assert.equal(worse.counters.sonnet.verdict, 'piorou');
  assert.equal(worse.counters.opus.verdict, 'piorou');
  assert.equal(worse.counters.weighted.before, 4 + 5 * 20 + 2 * 40);
  assert.equal(worse.counters.weighted.after, 5 + 6 * 20 + 3 * 40);
  assert.equal(worse.counters.weighted.verdict, 'piorou');
  assert.equal(worse.bloqueia, true);
  const better = run('base', 'better');
  assert.equal(better.counters.haiku.verdict, 'nao-piorou');
  assert.equal(better.counters.weighted.verdict, 'nao-piorou');
  assert.equal(better.bloqueia, false);
  const empty = run('base', 'empty');
  assert.equal(empty.counters.haiku.verdict, 'inconclusivo');
  assert.equal(empty.counters.weighted.verdict, 'inconclusivo');
  assert.equal(empty.bloqueia, false);
});

test('bytes: tolerance of 3 percent', () => {
  assert.equal(run('bytes-before', 'bytes-103').counters.bytes.verdict, 'nao-piorou');
  const over = run('bytes-before', 'bytes-1031');
  assert.equal(over.counters.bytes.verdict, 'piorou');
  assert.equal(over.bloqueia, true);
  assert.equal(run('bytes-before', 'bytes-1031', { bytesTolerance: 0.05 }).counters.bytes.verdict, 'nao-piorou');
});

test('per task, conditional and main context: full separation', () => {
  const names = ['perTask', 'extraRounds', 'fixCalls', 'mainAgentCalls', 'mainBytes', 'mainTurns'];
  const worse = run('base', 'worse');
  const better = run('base', 'better');
  const overlap = run('base', 'overlap');
  for (const n of names) {
    assert.equal(worse.counters[n].verdict, 'piorou', n);
    assert.equal(better.counters[n].verdict, 'nao-piorou', n);
    assert.equal(overlap.counters[n].verdict, 'inconclusivo', n);
  }
  assert.equal(overlap.bloqueia, false);
});

test('cost never blocks', () => {
  const r = run('base', 'cost-worse');
  assert.equal(r.counters.cost.verdict, 'piorou');
  assert.equal(r.bloqueia, false);
});

test('detection drop at or above the margin blocks', () => {
  const caiu = run('detect-before-nopx', 'detect-after-7');
  assert.equal(caiu.detection.plan.verdict, 'caiu');
  assert.equal(caiu.detection.plan.drop, 7);
  assert.equal(caiu.bloqueia, true);
  const ok = run('detect-before-nopx', 'detect-after-5');
  assert.equal(ok.detection.plan.verdict, 'nao-caiu');
  assert.equal(ok.detection.plan.drop, 5);
  assert.equal(ok.bloqueia, false);
  assert.equal(run('detect-before-nopx', 'detect-after-5', { margin: 5 }).detection.plan.verdict, 'caiu');
});

test('detection is inconclusive below the attempts threshold and blocks', () => {
  const r = run('detect-before-nopx', 'detect-after-39');
  for (const c of Object.values(r.counters)) assert.notEqual(c.verdict, 'piorou');
  assert.equal(r.detection.plan.verdict, 'inconclusivo');
  assert.equal(r.detection.plan.missing, 1);
  assert.equal(r.bloqueia, true);
  const res = cli(['--before', join(AGG, 'detect-before-nopx.json'), '--after', join(AGG, 'detect-after-39.json')]);
  assert.equal(res.status, 1);
});

test('weighted total is inconclusive with an unweighted family', () => {
  const f = run('base', 'fable-after');
  assert.equal(f.counters.weighted.verdict, 'inconclusivo');
  assert.deepEqual(f.counters.weighted.unweighted.after, { fable: 1, other: 0 });
  assert.deepEqual(f.counters.weighted.unweighted.before, { fable: 0, other: 0 });
  assert.equal(f.counters.fable.verdict, 'nao-piorou');
  assert.equal(f.bloqueia, false);
  const o = run('other-before', 'base');
  assert.equal(o.counters.weighted.verdict, 'inconclusivo');
  assert.deepEqual(o.counters.weighted.unweighted.before, { fable: 0, other: 1 });
  assert.equal(o.counters.other.verdict, 'nao-piorou');
  assert.equal(o.bloqueia, false);
});

test('detection applies only to classes with reviewer outcomes', () => {
  const plan = run('detect-before-nopx', 'detect-after-5');
  assert.equal(plan.detection.code.verdict, 'nao-aplicavel');
  assert.equal(plan.detection.spec.verdict, 'nao-aplicavel');
  assert.equal('rateBefore' in plan.detection.code, false);
  assert.equal(plan.bloqueia, false);
  const completo = run('base', 'better');
  for (const c of ['plan', 'code', 'spec']) assert.equal(completo.detection[c].verdict, 'nao-aplicavel');
  assert.equal(completo.bloqueia, false);
});

test('code-detected outcomes stay out of the plan rate', () => {
  const withPx = run('detect-before', 'detect-after-5-px');
  const without = run('detect-before-nopx', 'detect-after-5');
  assert.deepEqual(withPx.detection.plan, without.detection.plan);
  assert.equal(withPx.deteccaoPorCodigo.PX1.regrediu, true);
  assert.equal(without.deteccaoPorCodigo.PX1, undefined);
  assert.equal(withPx.bloqueia, false);
});

test('planner and tracker dynamic counters are recorded only', () => {
  const r = run('planner-before', 'planner-after');
  for (const [name, c] of Object.entries(r.counters)) {
    if (name === 'static') assert.equal(c.verdict, 'piorou');
    else assert.equal(c.verdict, 'registrado', name);
  }
  const t = compare({ ...load('base'), variant: 'tracker' }, { ...load('worse'), variant: 'tracker' });
  assert.equal(t.counters.haiku.verdict, 'registrado');
  assert.equal(t.bloqueia, false);
});

test('CLI exit codes', () => {
  const b = join(AGG, 'base.json');
  assert.equal(cli(['--before', b, '--after', join(AGG, 'better.json')]).status, 0);
  const blocked = cli(['--before', b, '--after', join(AGG, 'worse.json')]);
  assert.equal(blocked.status, 1);
  assert.equal(JSON.parse(blocked.stdout).bloqueia, true);
  const usage = cli(['--after', b]);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /usage:/);
  assert.equal(cli(['--before', b, '--after', join(AGG, 'missing.json')]).status, 2);
});

test('seeded variant with every attempt invalid blocks instead of reporting nao-aplicavel', () => {
  const invalid = (variant) => ({
    variant,
    attempts: Array.from({ length: 40 }, (_, i) => ({ n: i + 1, status: 'invalid', reason: 'formato-do-diario' })),
  });
  const r = compare(invalid('plano-semeado-A'), invalid('plano-semeado-A'));
  assert.equal(r.detection.plan.verdict, 'inconclusivo');
  assert.equal(r.detection.plan.missing, 40);
  assert.equal(r.detection.code.verdict, 'nao-aplicavel');
  assert.equal(r.detection.spec.verdict, 'nao-aplicavel');
  assert.equal(r.bloqueia, true);
  // an unseeded variant has no detection class to wait for
  const plain = compare({ variant: 'completo', attempts: [] }, { variant: 'completo', attempts: [] });
  assert.equal(plain.detection.plan.verdict, 'nao-aplicavel');
});
