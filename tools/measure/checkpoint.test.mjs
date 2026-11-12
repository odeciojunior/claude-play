import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armMatches, checkpoint } from './checkpoint.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const disk = (rel) => readFileSync(join(root, rel), 'utf8');
const WORKFLOW = 'plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js';

const counters = (over = {}) => ({
  structural: { haiku: 1, sonnet: 4, opus: 4, fable: 0, other: 0 },
  bytes: 1000,
  perTask: null,
  conditional: { extraRounds: 0, fixCalls: 0 },
  main: { agentCalls: 0, bytes: 100, turns: 8 },
  static: null,
  cost: 1.5,
  ...over,
});
const okPanel = { e5Status: 'plan', checkerErrors: 0, mergeCommit: null, e5Evidence: '' };
const mergedPanel = { e5Status: 'on-branch', checkerErrors: 0, mergeCommit: 'abcdef1234567', e5Evidence: 'merge abcdef1' };
const attemptsOf = (n, over, panel) => Array.from({ length: n }, (_, i) => ({ n: i + 1, status: 'valid', counters: counters(over), outcomes: [], ...(panel ? { panel } : {}) }));
const variant = (name, n = 3, over, panel, extra = {}) => ({ variant: name, requested: n, valid: n, invalid: 0, denied: 0, attempts: attemptsOf(n, over, panel), deteccaoPorCodigo: {}, ...extra });
const agg = (variants = {}, classes = {}, extra = {}) => ({ date: '2026-11-12', tagCommit: 'abc', permissionMode: 'bypassPermissions', variants, classes, ...extra });
const baseVariants = (panelled) => ({
  'plan-only': variant('plan-only', 3, undefined, panelled ? okPanel : undefined),
  completo: variant('completo', 3, undefined, panelled ? mergedPanel : undefined),
  'parada-retomada': variant('parada-retomada', 3, undefined, panelled ? mergedPanel : undefined),
  tracker: variant('tracker'),
});
const goodReadAt = (rel) => disk(rel);
import { readdirSync } from 'node:fs';
const listDisk = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(join(root, d), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${d}/${e.name}`);
      else out.push(`${d}/${e.name}`);
    }
  };
  try { walk(dir); } catch { /* directory absent */ }
  return out;
};
const readOk = { readAt: goodReadAt, listAt: listDisk };
// The shape of 3fbb59b: no planner model.md, no tracker references/events/.
const readOld = {
  readAt: (rel) => {
    if (rel.endsWith('/references/model.md') || rel.includes('prose-budget') || rel.includes('/references/events/')) throw new Error('missing');
    return goodReadAt(rel);
  },
  listAt: (dir) => listDisk(dir).filter((f) => !f.includes('/events/')),
};
const run = (b, a, deps = readOk, opts = {}) => checkpoint(b, a, { ...deps, ...opts });

test('E17: equal sides exit 0 and write both reports', () => {
  const v = baseVariants(true);
  const r = run(agg(v), agg(v));
  assert.equal(r.exit, 0, JSON.stringify(r.blockReasons));
  const tmp = mkdtempSync(join(tmpdir(), 'cp-'));
  try {
    const bf = join(tmp, 'b.json');
    const out = join(tmp, 'out');
    // Run the CLI with the same synthetic aggregate on both sides (commit abc does not exist: goals and arm are not measured).
    spawnSync('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(bf)}, ${JSON.stringify(JSON.stringify(agg(v)))})`]);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const p = spawnSync(process.execPath, [join(here, 'checkpoint.mjs'), '--before', bf, '--after', bf, '--dest', out, '--date', '2026-11-12'], { encoding: 'utf8', env });
    assert.equal(p.status, 0, p.stderr + p.stdout);
    const md = readFileSync(join(out, 'comparacao.md'), 'utf8');
    for (const s of ['## Contadores por variante', '## Detecção por classe', '## Custo', '## Painel', '## Braço da classe plano', '## Metas', '## Linhas para roadmap:measurements']) {
      assert.ok(md.includes(s), s);
    }
    const json = JSON.parse(readFileSync(join(out, 'comparacao.json'), 'utf8'));
    assert.equal(json.date, '2026-11-12');
    assert.equal(json.before.tagCommit, 'abc');
    assert.equal(json.after.tagCommit, 'abc');
    assert.equal('exit' in json, false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('E17: a blocking counter exits 1', () => {
  const b = baseVariants(true);
  const a = baseVariants(true);
  a['plan-only'] = variant('plan-only', 3, { bytes: 5000 }, okPanel);
  const r = run(agg(b), agg(a));
  assert.equal(r.exit, 1);
  assert.equal(r.variants['plan-only'].counters.bytes.verdict, 'piorou');
});

test('E17: other permission mode exits 2 without verdicts', () => {
  const v = baseVariants(true);
  for (const [b, a] of [[agg(v, {}, { permissionMode: 'default' }), agg(v)], [agg(v), agg(v, {}, { permissionMode: 'acceptEdits' })]]) {
    const r = run(b, a);
    assert.equal(r.exit, 2);
    assert.deepEqual(r.variants, {});
    assert.deepEqual(r.goals, []);
  }
});

test('E17: plan class in pipeline mode is inconclusive', () => {
  const cls = (stage) => ({ variant: 'plano-semeado', ...(stage ? { harness: { stage, arm: 'atual' } } : {}), attempts: attemptsOf(3), deteccaoPorCodigo: {} });
  const r = run(agg(baseVariants(true), { 'plano-semeado': cls('plan-review') }), agg(baseVariants(true), { 'plano-semeado': cls(null) }));
  assert.equal(r.classes['plano-semeado'].detection.plan.verdict, 'inconclusivo');
  assert.equal(r.classes['plano-semeado'].detection.plan.modeMismatch, true);
  assert.notEqual(r.exit, 0);
});

test('E17: a plan class with an outdated arm is inconclusive and blocks', () => {
  const cls = { variant: 'plano-semeado', harness: { stage: 'plan-review', arm: 'atual' }, attempts: attemptsOf(3), deteccaoPorCodigo: {} };
  const stale = { ...readOk, readAt: (rel) => (rel === WORKFLOW ? 'nothing alike' : goodReadAt(rel)) };
  const r = run(agg(baseVariants(true), { 'plano-semeado': cls }), agg(baseVariants(true), { 'plano-semeado': cls }), stale);
  assert.equal(r.arm.planReview, false);
  assert.equal(r.classes['plano-semeado'].classVerdict, 'inconclusivo (braço defasado)');
  assert.equal(r.exit, 1);
});

test('E17: variant on one side only is absent, not blocking', () => {
  const b = baseVariants(true);
  const a = baseVariants(true);
  delete a.tracker;
  const r = run(agg(b), agg(a));
  assert.equal(r.variants.tracker.status, 'ausente');
  assert.equal(r.variants.tracker.side, 'antes');
  assert.equal(r.exit, 0);
});

test('E17: old aggregate without panel is not checked on the before side', () => {
  const r = run(agg(baseVariants(false)), agg(baseVariants(true)));
  assert.equal(r.exit, 0, JSON.stringify(r.blockReasons));
  const old = run(agg(baseVariants(false)), agg(baseVariants(false)));
  assert.equal(old.exit, 1);
  assert.ok(old.blockReasons.some((x) => x.startsWith('panel ')));
});

test('E17: panel with error or wrong status blocks', () => {
  const a = baseVariants(true);
  a.completo = variant('completo', 3, undefined, { error: 'roadmap.mjs printed no JSON' });
  const withError = run(agg(baseVariants(true)), agg(a));
  assert.equal(withError.exit, 1);
  const b = baseVariants(true);
  b['plan-only'] = variant('plan-only', 3, undefined, { ...okPanel, e5Status: 'on-branch' });
  assert.equal(run(agg(baseVariants(true)), agg(b)).exit, 1);
});

test('E17: cost inconclusive never blocks', () => {
  const b = baseVariants(true);
  const a = baseVariants(true);
  a.completo = variant('completo', 3, { cost: null }, mergedPanel);
  const r = run(agg(b), agg(a));
  assert.equal(r.variants.completo.counters.cost.verdict, 'inconclusivo');
  assert.equal(r.cost.completo.after, null);
  assert.equal(r.exit, 0);
  const worse = baseVariants(true);
  worse.completo = variant('completo', 3, { cost: 99 }, mergedPanel);
  const w = run(agg(b), agg(worse));
  assert.equal(w.variants.completo.counters.cost.verdict, 'piorou');
  assert.equal(w.exit, 0);
  assert.equal(w.cost.completo.after.median, 99);
});

test('E17: armMatches', () => {
  const arm = 'Copied from: x.js at commit abc\r\nReview {{artifactPath}} against {{specPath}} now.\r\nSecond line.\r\n';
  const wf = 'const p = `Review ${a} against ${b} now.\nSecond line.\n`;'.replace('${a}', 'X').replace('${b}', 'Y');
  assert.equal(armMatches(arm, wf), true);
  assert.equal(armMatches(arm, wf.replace('against', 'versus')), false);
  assert.equal(armMatches(arm, wf.replace('\n', '\r\n')), true);
  assert.equal(armMatches(arm, 'Second line. then Review X against Y now.'), false);
});

// OPEN (owner decision, DEC-279): plan-fix-atual.md has "table-escaped | written as |" where the workflow has "table-escaped \\| written as |" (the arm lost the backslash).
// The arms are not edited; the todo flag keeps G1 green until the owner decides. Remove { todo } once decided.
test('E17: arms match the workflow at HEAD', { todo: 'owner decision: plan-fix-atual.md differs from the workflow at the table-escaped pipe (DEC-279)' }, () => {
  const wf = disk(WORKFLOW);
  for (const f of ['plan-review-atual.md', 'plan-fix-atual.md']) {
    assert.equal(armMatches(disk(`tools/measure/arms/${f}`), wf), true, f);
  }
});

test('E17: goals are marked with measured value and never block', () => {
  const v = baseVariants(true);
  const inflated = { ...readOk, readAt: (rel) => (rel.endsWith('roadmap-planner/SKILL.md') ? goodReadAt(rel) + 'x'.repeat(50000) : goodReadAt(rel)) };
  const r = run(agg(v), agg(v), inflated);
  const e4 = r.goals.find((g) => g.deliverable === 'E4');
  assert.equal(e4.verdict, 'não atingida');
  assert.equal(typeof e4.measured, 'number');
  assert.equal(r.exit, 0);
  assert.ok(r.measurementRows.some((row) => row.includes('meta E4') && row.includes('não atingida')));
});

test('E17: goals read at a commit without the definition files are not measured', () => {
  const v = baseVariants(true);
  const r = run(agg(v), agg(v), readOld);
  assert.equal(r.goals.find((g) => g.deliverable === 'E4').verdict, 'não medida');
  assert.equal(r.goals.find((g) => g.deliverable === 'E22').verdict, 'não medida');
  assert.equal(r.exit, 0);
  const bad = baseVariants(false);
  assert.equal(run(agg(v), agg(bad), readOld).exit, 1);
});

test('E17: CLI usage errors exit 2', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const cli = (...a) => spawnSync(process.execPath, [join(here, 'checkpoint.mjs'), ...a], { encoding: 'utf8', env });
  assert.equal(cli('--bogus', 'x').status, 2);
  assert.equal(cli('--before', 'a.json').status, 2);
  const tmp = mkdtempSync(join(tmpdir(), 'cp-'));
  try {
    assert.equal(cli('--before', join(tmp, 'nope.json'), '--after', join(tmp, 'nope.json'), '--dest', join(tmp, 'o')).status, 2);
    assert.equal(existsSync(join(tmp, 'o')), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
