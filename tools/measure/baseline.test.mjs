import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compare } from './compare.mjs';
import { BASELINE_PLAN } from './run-baseline.mjs';
import { loadAggregates, mergeVariant, coherenceErrors, classAggregate, privacyFindings, buildBaseline, measurementRows, main } from './baseline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name) => join(here, 'fixtures', 'baseline', name);
const TAG_COMMIT = 'fab0000000000000000000000000000000000016';
const DATE = '2026-11-20';
const build = (name, tagCommit = TAG_COMMIT) => buildBaseline({ outDir: fx(name), tagCommit, date: DATE });
const byVariant = (name) => {
  const m = {};
  for (const a of loadAggregates(fx(name))) (m[a.variant] ??= []).push(a);
  return m;
};
const quiet = { resolveTag: () => TAG_COMMIT, log: () => {}, err: () => {} };

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'baseline-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('merges partial aggregates of one variant', () => {
  const parts = byVariant('completa').coordinator;
  assert.equal(parts.length, 2);
  const m = mergeVariant(parts);
  assert.equal(m.valid, 3);
  assert.equal(m.requested, 3);
  assert.deepEqual(m.attempts.map((a) => a.n), [1, 2, 3]);
  const sorted = m.attempts.map((a) => a.counters.cost).sort((x, y) => x - y);
  assert.deepEqual(m.cost, { median: sorted[1], min: sorted[0], max: sorted[2] });
  assert.equal(m.roles.impl.agents, parts[0].roles.impl.agents + parts[1].roles.impl.agents);
  assert.equal(m.roles.impl.calls.sonnet, parts[0].roles.impl.calls.sonnet + parts[1].roles.impl.calls.sonnet);
});

test('merge sums invalid reasons and recomputes outcomes from valid attempts', () => {
  const [a] = byVariant('completa')['plano-semeado-A'];
  const one = { ...structuredClone(a), valid: 4, invalid: 1, invalidReasons: { x: 1 }, attempts: [...structuredClone(a.attempts.slice(0, 4)), { n: 5, status: 'invalid', reason: 'x' }] };
  const two = { ...structuredClone(a), valid: 1, attempts: structuredClone(a.attempts.slice(0, 1)), invalidReasons: {} };
  const m = mergeVariant([one, two]);
  assert.equal(m.valid, 5);
  assert.equal(m.invalid, 1);
  assert.deepEqual(m.invalidReasons, { x: 1 });
  assert.equal(m.outcomes.P1.capturado, 5);
  assert.deepEqual(m.attempts.map((x) => x.n), [1, 2, 3, 4, 5, 6]);
});

test('class aggregate is read by the comparator without missing', () => {
  const merged = Object.fromEntries(Object.entries(byVariant('completa')).map(([v, l]) => [v, mergeVariant(l)]));
  for (const [name, cls] of [['plano-semeado', 'plan'], ['codigo-semeado', 'code']]) {
    const c = classAggregate(name, merged[`${name}-A`], merged[`${name}-B`]);
    assert.equal(c.variant, name);
    assert.equal(c.valid, 10);
    assert.deepEqual(c.seedSource, merged[`${name}-A`].seedSource);
    const r = compare(c, c);
    assert.ok(!r.detection[cls].missing, `missing for ${name}`);
  }
});

test('diverging plugin commit is an error', () => {
  const r = build('commit-divergente');
  assert.ok(r.errors.some((e) => e.includes('fab0000000000000000000000000000000000099')));
  assert.equal(r.exitCode, 1);
});

test('plugin commit different from the tag is an error', () => {
  const r = build('completa', 'f'.repeat(40));
  assert.ok(r.errors.some((e) => e.includes('f'.repeat(40))));
  assert.equal(r.exitCode, 1);
});

test('diverging seed source is an error', () => {
  const r = build('semeadura-divergente');
  assert.ok(r.errors.some((e) => e.includes('seedSource')));
  assert.equal(r.exitCode, 1);
});

test('coherenceErrors is empty for a coherent set', () => {
  const merged = Object.values(byVariant('completa')).map(mergeVariant);
  assert.deepEqual(coherenceErrors(merged, { tagCommit: TAG_COMMIT }), []);
});

test('synthetic seeding marks the class incomplete', () => {
  const r = build('semeadura-sintetica');
  assert.ok(r.markdown.includes('incompleta (semeadura sintética)'));
  assert.equal(r.exitCode, 1);
});

test('a seeded variant without seedSource marks the class incomplete even if the other side has it', () => {
  withTmp((dir) => {
    cpSync(fx('completa'), dir, { recursive: true });
    const file = join(dir, 'plano-semeado-A-8', 'aggregate.json');
    const agg = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(agg.seedSource);
    delete agg.seedSource;
    writeFileSync(file, JSON.stringify(agg));
    const r = buildBaseline({ outDir: dir, tagCommit: TAG_COMMIT, date: DATE });
    assert.ok(r.incomplete.includes('plano-semeado (semeadura sintética)'));
    assert.ok(r.markdown.includes('incompleta (semeadura sintética)'));
    assert.equal(r.exitCode, 1);
  });
});

test('planner and tracker carry the cost note', () => {
  const r = build('completa');
  assert.ok(r.markdown.includes('custo não é comparado nesta skill (DEC-016)'));
});

test('missing variant is marked incomplete but still written', () => {
  const r = build('incompleta');
  assert.deepEqual(r.incomplete, ['parada-retomada']);
  assert.match(r.markdown, /parada-retomada[^\n]*incompleta/);
  assert.equal(r.exitCode, 1);
  withTmp((dest) => {
    const code = main(['--out', fx('incompleta'), '--dest', dest, '--date', DATE], quiet);
    assert.equal(code, 1);
    assert.ok(existsSync(join(dest, 'baseline.json')));
    assert.ok(existsSync(join(dest, 'linha-de-base.md')));
  });
});

test('measurement rows', () => {
  const r = build('completa');
  const rows = measurementRows(r.baseline, { date: DATE });
  assert.equal(rows.length, 12);
  for (const row of rows) {
    assert.ok(row.startsWith(`| ${DATE} | E15 | linha-de-base | `), row);
    assert.ok(row.includes('| E15 | linha-de-base |'));
    assert.ok(row.endsWith('| - | concluído |'), row);
  }
  assert.ok(r.markdown.includes(rows[0]));
});

test('complete baseline exits 0', () => {
  const r = build('completa');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.incomplete, []);
  assert.equal(r.exitCode, 0);
  assert.equal(Object.keys(r.baseline.variants).length, BASELINE_PLAN.length);
  assert.deepEqual(Object.keys(r.baseline.classes).sort(), ['codigo-semeado', 'plano-semeado']);
  assert.ok(r.markdown.includes('2026-01-01-E5-x-design.md'));
  assert.equal(privacyFindings(JSON.stringify(r.baseline)).length, 0);
});

test('harness aggregates are left out', () => {
  withTmp((out) => {
    cpSync(fx('completa'), out, { recursive: true });
    const dir = join(out, 'harness-1');
    cpSync(join(out, readdirSync(out).find((n) => n.startsWith('completo'))), dir, { recursive: true });
    const file = join(dir, 'aggregate.json');
    const a = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...a, harness: { stage: 'plan' } }));
    const r = buildBaseline({ outDir: out, tagCommit: TAG_COMMIT, date: DATE });
    assert.equal(r.baseline.variants.completo.valid, 3);
    assert.equal(r.exitCode, 0);
  });
});

test('privacyFindings applies the E1 rules', () => {
  const win = ['C:', 'Users', 'someone', 'x'].join('\\');
  const posix = ['', 'home', 'someone', 'x'].join('/');
  const agent = ['agent', 'a1b2'].join('-');
  const uuid = ['11111111', '2222', '4333', '8444', '555555555555'].join('-');
  const kinds = privacyFindings(`${win} ${posix} ${uuid} ${agent} agent-afab01 00000000-0000-4000-8000-000000000001`).map((f) => f.kind).sort();
  assert.deepEqual(kinds, ['agent-id', 'posix-path', 'uuid', 'windows-path']);
});

test('refuses to write a baseline with private data', () => {
  withTmp((root) => {
    const out = join(root, 'out');
    const dest = join(root, 'dest');
    cpSync(fx('completa'), out, { recursive: true });
    const dir = join(out, readdirSync(out).find((n) => n.startsWith('tracker')));
    const file = join(dir, 'aggregate.json');
    const a = JSON.parse(readFileSync(file, 'utf8'));
    a.invalidReasons = { [['C:', 'Users', 'someone', 'proj'].join('\\')]: 1 };
    writeFileSync(file, JSON.stringify(a));
    const errs = [];
    const code = main(['--out', out, '--dest', dest, '--date', DATE], { ...quiet, err: (m) => errs.push(m) });
    assert.equal(code, 1);
    assert.ok(!existsSync(join(dest, 'baseline.json')));
    assert.ok(errs.join('\n').includes('windows-path'));
  });
});

test('main writes both files for a complete baseline', () => {
  withTmp((dest) => {
    const code = main(['--out', fx('completa'), '--dest', dest, '--date', DATE], quiet);
    assert.equal(code, 0);
    assert.equal(JSON.parse(readFileSync(join(dest, 'baseline.json'), 'utf8')).date, DATE);
    assert.ok(readFileSync(join(dest, 'linha-de-base.md'), 'utf8').includes('# Linha de base'));
  });
});

test('CLI usage errors exit 2', () => {
  const run = (...args) => spawnSync(process.execPath, [join(here, 'baseline.mjs'), ...args], { encoding: 'utf8' });
  assert.equal(run().status, 2);
  assert.equal(run('--out', fx('completa')).status, 2);
  assert.equal(run('--out', fx('completa'), '--dest', tmpdir(), '--date', 'ontem').status, 2);
});

test('baseline.json carries errors and incomplete lists (DEC-196)', () => {
  const ok = build('completa');
  assert.deepEqual(ok.baseline.errors, []);
  assert.deepEqual(ok.baseline.incomplete, []);
  const inc = build('incompleta');
  assert.deepEqual(inc.baseline.incomplete, ['parada-retomada']);
  assert.deepEqual(inc.baseline.errors, []);
  const bad = build('commit-divergente');
  assert.ok(bad.baseline.errors.length > 0);
  assert.deepEqual(bad.baseline.errors, bad.errors);
});

test('diverging states are written with the lists and exit 1 (DEC-197)', () => {
  withTmp((dest) => {
    const code = main(['--out', fx('commit-divergente'), '--dest', dest, '--date', DATE], quiet);
    assert.equal(code, 1);
    const json = JSON.parse(readFileSync(join(dest, 'baseline.json'), 'utf8'));
    assert.ok(json.errors.length > 0);
    assert.match(readFileSync(join(dest, 'linha-de-base.md'), 'utf8'), /## Pendências/);
  });
});

test('measurement row of an incomplete variant is not "concluído"', () => {
  const r = build('completa');
  const v = structuredClone(r.baseline);
  v.variants.coordinator.valid = v.variants.coordinator.requested - 1;
  const rows = measurementRows(v, { date: DATE });
  const row = rows.find((x) => x.includes('coordinator:'));
  assert.ok(row.endsWith('| - | em andamento |'), row);
  assert.ok(rows.filter((x) => x.endsWith('| concluído |')).length === rows.length - 1);
});
