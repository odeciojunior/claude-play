import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { makeScenario, prepareE5Branch, runSandboxSuite, VARIANTS, E5_PATHS, artifactOf } from './make-scenario.mjs';
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

const manifest = JSON.parse(readFileSync(join(here, 'defects', 'manifest.json'), 'utf8'));
const sentinel = (entry) => import(pathToFileURL(join(here, 'defects', entry.sentinel)).href);

// Shared by the seeded-variant tests: builds the variant and checks each seeded defect of its artifact.
async function checkSeeded(variant) {
  const t = tmp('sb');
  try {
    const s = await makeScenario(t.dir, variant);
    const { class: cls, artifact } = artifactOf(variant);
    const entries = manifest.filter((e) => e.class === cls && e.artifact === artifact);
    assert.ok(entries.length > 0, 'no manifest entries for ' + variant);
    assert.deepEqual(s.seeded, entries.map((e) => e.id));
    assert.ok(s.seededCommit);
    const changed = git(t.dir, 'diff', '--name-only', s.seededCommit + '^', s.seededCommit).split('\n');
    for (const e of entries) {
      const mod = await sentinel(e);
      assert.ok(changed.includes(e.file), e.id + ': file not changed in the seeded commit');
      assert.equal(mod.present(t.dir, s.seededCommit), true, e.id + ': sentinel absent after seeding');
      if (cls !== 'code') assert.equal(mod.present(t.dir, s.seededCommit + '^'), false, e.id + ': sentinel present in the clean artifact');
      assert.equal(s.seededBlobs[e.file], git(t.dir, 'rev-parse', s.seededCommit + ':' + e.file));
    }
    assert.equal(git(t.dir, 'status', '--porcelain'), '');
    assert.equal(git(t.dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feat/E5');
    if (cls === 'code') {
      // The code of task 3 only exists from the seeded commit on, so the clean artifact is a fresh sandbox without seeding.
      const c = tmp('clean');
      try {
        await makeScenario(c.dir, 'completo');
        prepareE5Branch(c.dir, { withPlan: true, tasks: 3 });
        for (const e of entries) assert.equal((await sentinel(e)).present(c.dir), false, e.id + ': sentinel present in the clean code');
      } finally {
        c.done();
      }
    }
    return { s: { ...s, seededSubject: git(t.dir, 'log', '-1', '--format=%s', s.seededCommit) }, dir: t.dir };
  } finally {
    t.done();
  }
}

test('every manifest entry is seeded by exactly one variant', () => {
  assert.equal(manifest.length, 27);
  for (const cls of ['plan', 'spec', 'code']) {
    const own = manifest.filter((x) => x.class === cls);
    assert.equal(own.filter((x) => x.detectedBy === 'reviewer').length, 8, cls);
  }
  assert.equal(manifest.filter((x) => x.detectedBy === 'code').length, 3);
  for (const e of manifest) {
    const n = VARIANTS.filter((v) => { const a = artifactOf(v); return a && a.class === e.class && a.artifact === e.artifact; }).length;
    assert.equal(n, 1, e.id);
  }
});

test('plan variants: each defect file changed in the seeded commit and its sentinel reports presence', async () => {
  for (const v of ['plano-semeado-A', 'plano-semeado-B', 'plano-semeado-codigo']) await checkSeeded(v);
});

test('spec variants: each defect file changed in the seeded commit and its sentinel reports presence', async () => {
  for (const v of ['spec-semeado-A', 'spec-semeado-B']) {
    const { s } = await checkSeeded(v);
    assert.deepEqual(s.prompts, []);
  }
});

test('code variants: each defect file changed in the seeded commit and its sentinel reports presence', async () => {
  for (const v of ['codigo-semeado-A', 'codigo-semeado-B']) {
    const { s } = await checkSeeded(v);
    assert.deepEqual(s.prompts, ['/productivity-tools:roadmap-release run E5']);
    assert.match(s.seededSubject, /^E5 T3: /);
  }
});

test('code variants keep the sandbox suite green', async () => {
  for (const v of ['codigo-semeado-A', 'codigo-semeado-B']) {
    const t = tmp('sb');
    try {
      const s = await makeScenario(t.dir, v);
      const r = runSandboxSuite(s.dir);
      assert.equal(r.ok, true, v + ': ' + r.output);
    } finally {
      t.done();
    }
  }
});

test('retries the sandbox suite on EADDRINUSE', () => {
  const answers = [{ status: 1, stdout: 'EADDRINUSE' }, { status: 1, stdout: 'EADDRINUSE' }, { status: 0, stdout: '' }];
  let calls = 0;
  const ok = runSandboxSuite('x', { spawn: () => answers[calls++] });
  assert.equal(ok.ok, true);
  assert.equal(calls, 3);
  calls = 0;
  const bad = runSandboxSuite('x', { spawn: () => { calls++; return { status: 1, stdout: 'EADDRINUSE' }; } });
  assert.equal(bad.ok, false);
  assert.equal(calls, 3);
  calls = 0;
  const other = runSandboxSuite('x', { spawn: () => { calls++; return { status: 1, stdout: 'not ok' }; } });
  assert.equal(other.ok, false);
  assert.equal(calls, 1);
});

test('seeded history never names the seeding', async () => {
  for (const v of ['plano-semeado-A', 'plano-semeado-B', 'plano-semeado-codigo', 'spec-semeado-A', 'spec-semeado-B', 'codigo-semeado-A', 'codigo-semeado-B']) {
    const t = tmp('sb');
    try {
      await makeScenario(t.dir, v);
      const log = git(t.dir, 'log', '-p', 'main..feat/E5');
      assert.doesNotMatch(log, /defect|seed|sentinel|planted/i, v);
    } finally {
      t.done();
    }
  }
});

test('code-detected defects stay out of artifacts A and B', () => {
  for (const e of manifest) {
    if (e.detectedBy === 'code') assert.ok(e.artifact === 'C', e.id);
    if (e.artifact === 'A' || e.artifact === 'B') assert.notEqual(e.detectedBy, 'code', e.id);
    if (e.artifact === 'C') {
      assert.equal(e.detectedBy, 'code', e.id);
      assert.doesNotThrow(() => new RegExp(e.codeSignal), e.id);
    }
  }
});
