import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { makeScenario, prepareE5Branch, VARIANTS, E5_PATHS } from './make-scenario.mjs';
import { STOP_RESUME } from '../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'make-scenario.mjs');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

function tmp(name) {
  const base = mkdtempSync(join(tmpdir(), 'mk-scn-'));
  return { base, dir: join(base, name), done: () => rmSync(base, { recursive: true, force: true }) };
}

test('lists every variant of the spec table', () => {
  assert.deepEqual([...VARIANTS].sort(), [
    'plan-only', 'completo', 'parada-retomada', 'coordinator', 'planner', 'tracker',
    'plano-semeado-A', 'plano-semeado-B', 'codigo-semeado-A', 'codigo-semeado-B',
    'spec-semeado-A', 'spec-semeado-B', 'plano-semeado-codigo',
  ].sort());
  assert.equal(VARIANTS.length, 13);
});

test('unseeded variants build a sandbox and the expected prompts', async () => {
  const theme = readFileSync(join(here, 'scenario', 'planner-theme.md'), 'utf8');
  const event = readFileSync(join(here, 'scenario', 'tracker-event.md'), 'utf8');
  const expected = {
    'plan-only': ['/productivity-tools:roadmap-release plan-only E1'],
    completo: ['/productivity-tools:roadmap-release run E5'],
    'parada-retomada': ['/productivity-tools:roadmap-release run E5', '/productivity-tools:roadmap-release resume E5'],
    coordinator: ['/productivity-tools:plan-coordinator docs/plans/2026-11-10-fixed-plan.md'],
    planner: ['/productivity-tools:roadmap-planner ' + theme],
    tracker: ['/productivity-tools:roadmap-tracker ' + event],
  };
  for (const [variant, prompts] of Object.entries(expected)) {
    const t = tmp('sb');
    try {
      const s = await makeScenario(t.dir, variant);
      assert.equal(s.variant, variant);
      assert.deepEqual(s.prompts, prompts);
      assert.deepEqual(s.stopResume, variant === 'parada-retomada' ? STOP_RESUME : null);
      assert.deepEqual(s.seeded, []);
      assert.equal(s.seededCommit, null);
      assert.deepEqual(s.seededBlobs, {});
      assert.equal(git(t.dir, 'status', '--porcelain'), '');
      if (variant === 'coordinator') {
        assert.ok(existsSync(join(t.dir, 'docs/plans/2026-11-10-fixed-plan.md')));
        assert.equal(git(t.dir, 'log', '-1', '--format=%s'), 'docs(plan): fixed plan');
      }
    } finally {
      t.done();
    }
  }
});

test('E5 code of the scenario passes the card tests in the sandbox', async () => {
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'completo');
    prepareE5Branch(t.dir, { withPlan: true, tasks: 3 });
    assert.equal(git(t.dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feat/E5');
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ['--test', 'tests/e5-slugify.test.mjs', 'tests/e5-truncate.test.mjs', 'tests/e5-word-count.test.mjs'], { cwd: t.dir, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const subjects = git(t.dir, 'log', '--format=%s', 'main..feat/E5').split('\n');
    assert.equal(subjects.length, 5);
    assert.match(subjects[2], /^E5 T1:/);
    assert.match(subjects[1], /^E5 T2:/);
    assert.match(subjects[0], /^E5 T3:/);
  } finally {
    t.done();
  }
});

test('E5 plan follows the release recipe', async () => {
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'completo');
    const plan = readFileSync(join(here, 'scenario', 'e5', 'plan.md'), 'utf8');
    const strategy = readFileSync(join(t.dir, 'docs/plans/roadmap-sandbox/strategy.md'), 'utf8');
    assert.ok(plan.includes('**Roadmap:** docs/plans/roadmap-sandbox/'));
    for (const k of [1, 2, 3]) assert.match(plan, new RegExp(`### Task ${k}: `));
    assert.equal((plan.match(/\*\*external:\*\* false/g) ?? []).length, 3);
    const section = plan.split('## Acceptance criteria evidence')[1];
    assert.ok(section, 'evidence section missing');
    const e5 = strategy.slice(strategy.indexOf('id=E5 '));
    for (const n of [1, 2, 3]) {
      const m = new RegExp(`^${n}\. .*\{verify: test; evidence: ([^}]+)\}`, 'm').exec(e5);
      assert.ok(m, `AC${n} not found in the card`);
      const row = section.split('\n').find((l) => l.startsWith(`| AC${n} |`));
      assert.ok(row, `row AC${n} missing`);
      assert.ok(row.includes(m[1].trim()), `row AC${n} lacks the verify command`);
      assert.match(row, /external: false \|$/);
    }
  } finally {
    t.done();
  }
});

test('refuses a target inside the repository', () => {
  const inside = join(here, 'out', 'x');
  const r = spawnSync(process.execPath, [script, inside, '--variant', 'plan-only'], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stderr);
  assert.equal(existsSync(inside), false);
  const t = tmp('sb');
  try {
    const u = spawnSync(process.execPath, [script, t.dir, '--variant', 'nope'], { encoding: 'utf8' });
    assert.equal(u.status, 2, u.stderr);
    assert.equal(existsSync(t.dir), false);
  } finally {
    t.done();
  }
});
