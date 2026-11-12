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
  for (const a of loadAggregates(fx(name), { includeHarness: true })) (m[a.variant] ??= []).push(a);
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

test('detection class row is "concluído" only at the target with a real seed', () => {
  const r = build('completa');
  const b = structuredClone(r.baseline);
  const name = Object.keys(b.classes)[0];
  const cls = Object.values(b.classes[name].outcomes)[0].class;
  const first = Object.values(b.classes[name].outcomes).find((o) => o.class === cls);
  first.capturado += 40;
  b.incomplete = (b.incomplete ?? []).filter((x) => !x.startsWith(name));
  b.classes[name].seedSource = { kind: 'aprovada' };
  const line = (x) => measurementRows(x, { date: DATE }).find((y) => y.includes(`detecção ${name}:`));
  assert.ok(line(b).endsWith('| - | concluído |'), line(b));
  b.incomplete.push(`${name} (semeadura sintética)`);
  assert.ok(line(b).endsWith('| - | em andamento |'));
});

test('measurement row compares valid with the plan runs, not the summed requested', () => {
  const r = build('completa');
  const v = structuredClone(r.baseline);
  const runs = BASELINE_PLAN.find((p) => p.variant === 'coordinator').runs;
  v.variants.coordinator.requested = runs + 2;
  v.variants.coordinator.valid = runs;
  const row = measurementRows(v, { date: DATE }).find((x) => x.includes('coordinator:'));
  assert.ok(row.endsWith('| - | concluído |'), row);
  assert.ok(row.includes(`${runs}/${runs} `), row);
  v.variants.coordinator.valid = runs - 1;
  const row2 = measurementRows(v, { date: DATE }).find((x) => x.includes('coordinator:'));
  assert.ok(row2.endsWith('| - | em andamento |'), row2);
  assert.ok(row2.includes(`${runs - 1}/${runs} `), row2);
});

test('detection class rows are "em andamento" below the attempt target', () => {
  const r = build('completa');
  const b = structuredClone(r.baseline);
  const name = Object.keys(b.classes)[0];
  const o = Object.values(b.classes[name].outcomes).find((x) => x.capturado > 0);
  o.capturado -= 1;
  const row = measurementRows(b, { date: DATE }).find((x) => x.includes(`detecção ${name}:`));
  assert.ok(row.endsWith('| - | em andamento |'), row);
});

const planHarness = { stage: 'plan-review', arm: 'atual', armSource: 'copia-do-prompt', workflowCommit: TAG_COMMIT };

test('plan class counts only stage-harness aggregates; pipeline plan aggregates feed the DEC-051 line', () => {
  withTmp((out) => {
    cpSync(fx('completa'), out, { recursive: true });
    const dir = join(out, 'plano-semeado-A-pipeline');
    cpSync(join(out, 'plano-semeado-A-8'), dir, { recursive: true });
    const file = join(dir, 'aggregate.json');
    const { harness, ...pipe } = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...pipe, valid: 2, invalid: 1, requested: 3, invalidReasons: { 'plano-reescrito': 1 } }));
    const r = buildBaseline({ outDir: out, tagCommit: TAG_COMMIT, date: DATE });
    assert.equal(r.baseline.variants['plano-semeado-A'].valid, 5);
    assert.equal(r.baseline.classes['plano-semeado'].valid, 10);
    assert.deepEqual(r.baseline.classes['plano-semeado'].harness, planHarness);
    assert.equal(r.baseline.dec051.attempts, 3);
    assert.equal(r.baseline.dec051.rewritten, 1);
    assert.ok(r.markdown.includes('Plano em modo pipeline (fora da classe; dado de DEC-051): 3 tentativas, 1 com plano reescrito'));
    assert.ok(r.markdown.includes('Medido pelo harness de etapa: plan-review, braço atual'));
    assert.equal(r.exitCode, 0);
  });
});

test('a plan variant with only pipeline aggregates is incomplete and the class is missing', () => {
  withTmp((out) => {
    cpSync(fx('completa'), out, { recursive: true });
    for (const n of ['plano-semeado-A-8', 'plano-semeado-B-9']) {
      const file = join(out, n, 'aggregate.json');
      const { harness, ...pipe } = JSON.parse(readFileSync(file, 'utf8'));
      writeFileSync(file, JSON.stringify(pipe));
    }
    const r = buildBaseline({ outDir: out, tagCommit: TAG_COMMIT, date: DATE });
    assert.equal(r.baseline.classes['plano-semeado'], undefined);
    assert.ok(r.incomplete.includes('plano-semeado-A') && r.incomplete.includes('plano-semeado-B'));
    assert.equal(r.baseline.dec051.attempts, 10);
    assert.equal(r.exitCode, 1);
  });
});

test('mergeVariant: o modo de permissão vem só dos agregados com execuções válidas', () => {
  const base = { variant: 'planner', requested: 1, invalid: 0, plugin: {}, superpowers: {}, cli: 'x', models: [], pricesDate: 'd', attempts: [] };
  const merged = mergeVariant([
    { ...base, valid: 0, denied: 1, permissionMode: 'default' },
    { ...base, valid: 0, denied: 1, permissionMode: 'acceptEdits' },
    { ...base, valid: 1, denied: 0, permissionMode: 'bypassPermissions' },
  ]);
  assert.equal(merged.permissionMode, 'bypassPermissions');
  assert.equal(mergeVariant([{ ...base, valid: 0, denied: 1, permissionMode: 'default' }]).permissionMode, 'default');
});

test('E17: panel survives the merge of partial aggregates', () => {
  const panel = (n) => ({ e5Status: 'on-branch', e5Evidence: `merge ${n}`, mergeCommit: `abc123${n}`, checkerErrors: 0 });
  const att = (n) => ({ n, status: 'valid', counters: { cost: n, structural: { weighted: 1 } }, outcomes: [], panel: panel(n) });
  const agg = (attempts) => ({ variant: 'completo', requested: attempts.length, valid: attempts.length, invalid: 0, denied: 0, attempts, roles: {}, invalidReasons: {} });
  const m = mergeVariant([agg([att(1)]), agg([att(1)])]);
  assert.deepEqual(m.attempts.map((a) => a.n), [1, 2]);
  assert.deepEqual(m.attempts[0].panel, panel(1));
  assert.deepEqual(m.attempts[1].panel, panel(1));
});
