import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { BASELINE_PLAN, MAX_EXTRA, existingValid, dryRunCommands, runBaseline } from './run-baseline.mjs';
import { readText } from './make-scenario.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'run-baseline.mjs');
const COMMIT = 'fab0000000000000000000000000000000000016';

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'run-baseline-'));
  const dirs = { base, work: join(base, 'work'), out: join(base, 'out'), configDir: join(base, 'cfg') };
  mkdirSync(dirs.out, { recursive: true });
  return { ...dirs, done: () => rmSync(base, { recursive: true, force: true }) };
}

const baseOpts = (s, extra = {}) => ({ work: s.work, out: s.out, configDir: s.configDir, permissionMode: 'acceptEdits', ...extra });

function writeAggregate(out, name, agg) {
  const d = join(out, name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'aggregate.json'), JSON.stringify({ note: '[fab] aggregate', ...agg }));
}

// Simulated runBatch: writes an aggregate into out and records the calls. `validOf(variant, runs, call)` decides the outcome.
function makeDeps(s, { validOf = (v, runs) => runs, denyOn, throwOn, commit = COMMIT } = {}) {
  const calls = [];
  const logs = [];
  const deps = {
    calls,
    logs,
    runBatch: async (o) => {
      calls.push(o);
      if (throwOn === o.variant) throw new Error('boom');
      const valid = validOf(o.variant, o.runs, calls.length);
      const aggregate = { variant: o.variant, requested: o.runs, valid, invalid: o.runs - valid, denied: denyOn === o.variant ? 1 : 0 };
      writeAggregate(o.out, `${o.variant}-sim${calls.length}`, aggregate);
      return { dir: join(o.out, `${o.variant}-sim${calls.length}`), aggregate, exitCode: 0 };
    },
    readPlugin: () => ({ version: '1.6.0', commit }),
    resolveTag: () => COMMIT,
    log: (m) => logs.push(m),
  };
  return deps;
}

function approvedFolder(base, { planExtra = '[fab] extra line\n', planText } = {}) {
  const specDir = join(base, 'docs', 'superpowers', 'specs');
  const planDir = join(base, 'docs', 'superpowers', 'plans');
  mkdirSync(specDir, { recursive: true });
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(specDir, '2026-01-01-E5-x-design.md'), readText(join(here, 'scenario', 'e5', 'spec.md')) + '[fab] extra line\n');
  writeFileSync(join(planDir, '2026-01-01-E5-x.md'), planText ?? readText(join(here, 'scenario', 'e5', 'plan.md')) + planExtra);
}

test('plan order and counts', () => {
  assert.deepEqual(BASELINE_PLAN, [
    { variant: 'planner', runs: 1 },
    { variant: 'tracker', runs: 1 },
    { variant: 'plan-only', runs: 5 },
    { variant: 'coordinator', runs: 3 },
    { variant: 'completo', runs: 3 },
    { variant: 'parada-retomada', runs: 3 },
    { variant: 'plano-semeado-A', runs: 5, stage: 'plan-review', arm: 'atual' },
    { variant: 'plano-semeado-B', runs: 5, stage: 'plan-review', arm: 'atual' },
    { variant: 'codigo-semeado-A', runs: 5 },
    { variant: 'codigo-semeado-B', runs: 5 },
  ]);
  assert.equal(MAX_EXTRA, 5);
});

test('runs unseeded variants and skips seeded ones without --from-run', async () => {
  const s = setup();
  try {
    const deps = makeDeps(s);
    const r = await runBaseline(baseOpts(s), deps);
    assert.deepEqual(deps.calls.map((c) => c.variant), ['planner', 'tracker', 'plan-only', 'coordinator', 'completo', 'parada-retomada']);
    assert.deepEqual(deps.calls.map((c) => c.runs), [1, 1, 5, 3, 3, 3]);
    assert.equal(r.exitCode, 1);
    assert.ok(deps.logs.some((m) => m.includes('variantes semeadas exigem --from-run')));
    assert.equal(r.results.filter((x) => x.status === 'pulada').length, 4);
  } finally {
    s.done();
  }
});

test('fromRun reaches only seeded variants', async () => {
  const s = setup();
  try {
    approvedFolder(s.base);
    const folder = s.base;
    const deps = makeDeps(s);
    const r = await runBaseline(baseOpts(s, { fromRun: folder, only: ['completo', 'plano-semeado-A'] }), deps);
    assert.deepEqual(deps.calls.map((c) => c.variant), ['completo', 'plano-semeado-A']);
    assert.equal(deps.calls[0].fromRun, undefined);
    assert.equal(deps.calls[1].fromRun, folder);
    assert.equal(r.exitCode, 0);
    assert.equal(existsSync(join(s.work, '_conferencia-semeadura')), false);
  } finally {
    s.done();
  }
});

test('skips a complete variant', async () => {
  const s = setup();
  try {
    writeAggregate(s.out, 'plan-only-1', { variant: 'plan-only', valid: 5 });
    const deps = makeDeps(s);
    const r = await runBaseline(baseOpts(s, { only: ['plan-only', 'tracker'] }), deps);
    assert.deepEqual(deps.calls.map((c) => c.variant), ['tracker']);
    assert.equal(r.results.find((x) => x.variant === 'plan-only').status, 'pulada');
    assert.equal(r.exitCode, 0);
  } finally {
    s.done();
  }
});

test('resume counts valid attempts across partial aggregates', async () => {
  const s = setup();
  try {
    writeAggregate(s.out, 'coordinator-1', { variant: 'coordinator', valid: 1 });
    writeAggregate(s.out, 'coordinator-2', { variant: 'coordinator', valid: 1 });
    writeAggregate(s.out, 'coordinator-3', { variant: 'coordinator', valid: 1, harness: { stage: 'plan-review' } });
    writeAggregate(s.out, 'tracker-1', { variant: 'tracker', valid: 1 });
    assert.equal(existingValid(s.out, 'coordinator'), 2);
    assert.equal(existingValid(s.out, 'nada'), 0);
    assert.equal(existingValid(join(s.base, 'inexistente'), 'coordinator'), 0);
    const deps = makeDeps(s);
    await runBaseline(baseOpts(s, { only: ['coordinator'] }), deps);
    assert.equal(deps.calls.length, 1);
    assert.equal(deps.calls[0].runs, 1);
  } finally {
    s.done();
  }
});

test('each runBatch call gets its own work folder', async () => {
  const s = setup();
  try {
    approvedFolder(s.base);
    const deps = makeDeps(s, { validOf: (v, runs) => (v === 'plano-semeado-A' ? 0 : runs) });
    await runBaseline(baseOpts(s, { fromRun: s.base, only: ['plano-semeado-A', 'plan-only'] }), deps);
    const works = deps.calls.map((c) => c.work);
    assert.ok(works.length >= 3);
    assert.equal(new Set(works).size, works.length);
  } finally {
    s.done();
  }
});

test('a second invocation with the same --work does not reuse a work folder on disk', async () => {
  const s = setup();
  try {
    const used = [];
    const mk = () => {
      const deps = makeDeps(s, { validOf: () => 0 });
      const inner = deps.runBatch;
      deps.runBatch = async (o) => {
        // Like makeSandbox: refuses a folder that already exists.
        if (existsSync(o.work)) throw new Error('target directory is not empty');
        mkdirSync(join(o.work, 'sandbox'), { recursive: true });
        used.push(o.work);
        return inner(o);
      };
      return deps;
    };
    const opts = baseOpts(s, { only: ['plan-only'] });
    const first = await runBaseline(opts, mk());
    const second = await runBaseline(opts, mk());
    assert.equal(first.results[0].status, 'incompleta');
    assert.equal(second.results[0].status, 'incompleta');
    assert.equal(used.length, 2);
    assert.equal(new Set(used).size, 2);
  } finally {
    s.done();
  }
});

test('retries invalid seeded attempts up to the cap', async () => {
  const s = setup();
  try {
    approvedFolder(s.base);
    const deps = makeDeps(s, { validOf: (v, runs) => (v === 'plano-semeado-A' ? 0 : v === 'plan-only' ? 3 : runs) });
    const r = await runBaseline(baseOpts(s, { fromRun: s.base, only: ['plano-semeado-A', 'plan-only'] }), deps);
    const seeded = deps.calls.filter((c) => c.variant === 'plano-semeado-A');
    assert.deepEqual(seeded.map((c) => c.runs), [5, 5]);
    const res = r.results.find((x) => x.variant === 'plano-semeado-A');
    assert.equal(res.status, 'incompleta');
    assert.equal(res.missing, 5);
    assert.equal(r.exitCode, 1);
    assert.equal(deps.calls.filter((c) => c.variant === 'plan-only').length, 1);
    assert.equal(r.results.find((x) => x.variant === 'plan-only').status, 'incompleta');
  } finally {
    s.done();
  }
});

test('stops at the first denial', async () => {
  const s = setup();
  try {
    const deps = makeDeps(s, { denyOn: 'tracker' });
    const r = await runBaseline(baseOpts(s), deps);
    assert.deepEqual(deps.calls.map((c) => c.variant), ['planner', 'tracker']);
    assert.equal(r.exitCode, 1);
    assert.equal(r.results.find((x) => x.variant === 'tracker').status, 'negada');
    assert.ok(deps.logs.length > 0);
  } finally {
    s.done();
  }
});

test('a runBatch exception marks the variant failed and goes on', async () => {
  const s = setup();
  try {
    const deps = makeDeps(s, { throwOn: 'planner' });
    const r = await runBaseline(baseOpts(s, { only: ['planner', 'tracker'] }), deps);
    assert.equal(r.results[0].status, 'falhou');
    assert.equal(r.results[1].status, 'completa');
    assert.equal(r.exitCode, 1);
  } finally {
    s.done();
  }
});

test('refuses a plugin outside the start tag', async () => {
  const s = setup();
  try {
    const deps = makeDeps(s, { commit: 'fab0000000000000000000000000000000000099' });
    const r = await runBaseline(baseOpts(s), deps);
    assert.equal(r.exitCode, 2);
    assert.equal(deps.calls.length, 0);
    assert.ok(deps.logs.some((m) => m.includes('fab0000000000000000000000000000000000099')));
  } finally {
    s.done();
  }
});

test('dry run prints one command per variant', async () => {
  const s = setup();
  try {
    for (const withFrom of [false, true]) {
      const deps = makeDeps(s);
      const opts = baseOpts(s, { dryRun: true, allow: ['Bash(git:*)'], addDir: ['/x'], model: 'opus', maxBudgetUsd: 5, ...(withFrom ? { fromRun: '/pasta' } : {}) });
      const r = await runBaseline(opts, deps);
      assert.equal(r.exitCode, 0);
      assert.equal(deps.calls.length, 0);
      assert.equal(deps.logs.length, 10);
      const seeded = deps.logs.filter((m) => m.includes('--variant plano-semeado') || m.includes('--variant codigo-semeado'));
      assert.equal(seeded.length, 4);
      for (const m of seeded) assert.ok(withFrom ? m.includes('--from-run /pasta') : m.includes('--from-run <pasta-da-execucao-aprovada>'), m);
      const unseeded = deps.logs.filter((m) => !seeded.includes(m));
      for (const m of unseeded) assert.ok(!m.includes('--from-run'), m);
      assert.ok(deps.logs[0].startsWith('node tools/measure/run-batch.mjs --variant planner --runs 1 --work '));
      assert.ok(deps.logs[0].includes('--allow Bash(git:*)') && deps.logs[0].includes('--add-dir /x') && deps.logs[0].includes('--model opus') && deps.logs[0].includes('--max-budget-usd 5'));
    }
    assert.equal(dryRunCommands(baseOpts(s, { only: ['tracker'] })).length, 1);
  } finally {
    s.done();
  }
});

test('pre-check refuses a folder without a plan', async () => {
  const s = setup();
  try {
    const specDir = join(s.base, 'docs', 'superpowers', 'specs');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, '2026-01-01-E5-x-design.md'), '[fab] spec\n');
    const deps = makeDeps(s);
    const r = await runBaseline(baseOpts(s, { fromRun: s.base }), deps);
    assert.equal(r.exitCode, 2);
    assert.equal(deps.calls.length, 0);
    assert.ok(deps.logs.some((m) => m.includes('not found')));
  } finally {
    s.done();
  }
});

test('pre-check refuses a plan without a sentinel anchor', async () => {
  const s = setup();
  try {
    approvedFolder(s.base, { planText: '[fab] plan without the anchors\n' });
    const deps = makeDeps(s);
    const r = await runBaseline(baseOpts(s, { fromRun: s.base, only: ['plano-semeado-A'] }), deps);
    assert.equal(r.exitCode, 2);
    assert.equal(deps.calls.length, 0);
    assert.ok(deps.logs.some((m) => m.includes('anchor not found')));
    assert.equal(existsSync(join(s.work, '_conferencia-semeadura')), false);
  } finally {
    s.done();
  }
});

test('CLI: missing option or unknown variant exits 2; dry run exits 0', () => {
  const s = setup();
  try {
    const run = (...a) => spawnSync(process.execPath, [script, ...a], { encoding: 'utf8' });
    assert.equal(run().status, 2);
    const common = ['--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'];
    assert.equal(run(...common, '--only', 'nada').status, 2);
    assert.equal(run('--work', join(here, 'out', 'w'), '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'x', '--dry-run').status, 2);
    const ok = run(...common, '--only', 'tracker,planner', '--dry-run');
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout.trim().split('\n').length, 2);
  } finally {
    s.done();
  }
});

test('every runBatch call gets stopOnDenial (DEC-194)', async () => {
  const s = setup();
  try {
    const deps = makeDeps(s);
    await runBaseline(baseOpts(s, { only: ['planner', 'plan-only'] }), deps);
    assert.ok(deps.calls.length >= 2);
    for (const c of deps.calls) assert.equal(c.stopOnDenial, true);
  } finally {
    s.done();
  }
});

test('the extra-attempt cap is per invocation (DEC-195)', async () => {
  const s = setup();
  try {
    approvedFolder(s.base);
    const opts = baseOpts(s, { fromRun: s.base, only: ['plano-semeado-A'] });
    const first = makeDeps(s, { validOf: () => 0 });
    const r1 = await runBaseline(opts, first);
    assert.deepEqual(first.calls.map((c) => c.runs), [5, 5]);
    assert.equal(r1.exitCode, 1);
    const second = makeDeps(s, { validOf: () => 0 });
    const r2 = await runBaseline(opts, second);
    assert.deepEqual(second.calls.map((c) => c.runs), [5, 5]);
    assert.equal(r2.exitCode, 1);
  } finally {
    s.done();
  }
});

test('dry run emits the stage harness options only for the plan class', () => {
  const s = setup();
  try {
    const cmds = dryRunCommands(baseOpts(s, { fromRun: '/pasta' }));
    for (const c of cmds) {
      const plan = c.includes('--variant plano-semeado');
      assert.equal(c.includes('--stage plan-review --arm atual'), plan, c);
      if (plan) assert.ok(c.includes('--from-run /pasta'), c);
    }
  } finally {
    s.done();
  }
});

test('existingValid counts by mode: stage entries only harness aggregates, others only pipeline', () => {
  const s = setup();
  try {
    writeAggregate(s.out, 'a-1', { variant: 'plano-semeado-A', valid: 2 });
    writeAggregate(s.out, 'a-2', { variant: 'plano-semeado-A', valid: 3, harness: { stage: 'plan-review', arm: 'atual' } });
    writeAggregate(s.out, 'a-3', { variant: 'plano-semeado-A', valid: 4, harness: { stage: 'plan-review', arm: 'outro' } });
    writeAggregate(s.out, 'a-4', { variant: 'plano-semeado-A', valid: 5, harness: { stage: 'spec-review', arm: 'atual' } });
    const stage = BASELINE_PLAN.find((p) => p.variant === 'plano-semeado-A');
    assert.equal(existingValid(s.out, 'plano-semeado-A', stage), 3);
    assert.equal(existingValid(s.out, 'plano-semeado-A', { variant: 'plano-semeado-A' }), 2);
    assert.equal(existingValid(s.out, 'plano-semeado-A'), 2);
  } finally {
    s.done();
  }
});

test('the conductor passes stage and arm to runBatch for the plan class and resumes from harness aggregates only', async () => {
  const s = setup();
  try {
    writeAggregate(s.out, 'pipe', { variant: 'plano-semeado-A', valid: 5 });
    writeAggregate(s.out, 'h', { variant: 'plano-semeado-B', valid: 2, harness: { stage: 'plan-review', arm: 'atual' } });
    const deps = makeDeps(s);
    await runBaseline(baseOpts(s, { only: ['plano-semeado-A', 'plano-semeado-B', 'tracker'], fromRun: '/pasta-inexistente' }), { ...deps, seedSourceOf: () => {}, makeScenario: async () => {} });
    const byVariant = Object.fromEntries(deps.calls.map((c) => [c.variant, c]));
    assert.equal(byVariant['plano-semeado-A'].runs, 5);
    assert.equal(byVariant['plano-semeado-A'].stage, 'plan-review');
    assert.equal(byVariant['plano-semeado-A'].arm, 'atual');
    assert.equal(byVariant['plano-semeado-B'].runs, 3);
    assert.equal(byVariant['plano-semeado-B'].fromRun, '/pasta-inexistente');
    assert.equal(byVariant.tracker.stage, undefined);
  } finally {
    s.done();
  }
});
