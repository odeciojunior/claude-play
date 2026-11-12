import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { makeScenario, SANDBOX_RELEASE_RULES, seedSourceOf, prepareE5Branch, runSandboxSuite, VARIANTS, E5_PATHS, artifactOf, readText, copyTree } from './make-scenario.mjs';
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
  const theme = readText(join(here, 'scenario', 'planner-theme.md'));
  const event = readText(join(here, 'scenario', 'tracker-event.md'));
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

test('scenario text reaches the sandbox with LF even from a CRLF checkout', () => {
  const t = tmp('eol');
  try {
    const src = join(t.dir, 'src');
    mkdirSync(join(src, 'sub'), { recursive: true });
    writeFileSync(join(src, 'plan.md'), '| AC1 | test |\r\n| AC2 | test |\r\n');
    writeFileSync(join(src, 'sub', 'a.mjs'), 'export const a = 1;\r\n');
    writeFileSync(join(src, 'sub', 'blob.bin'), Buffer.from([13, 10, 0, 13, 10]));
    assert.equal(readText(join(src, 'plan.md')), '| AC1 | test |\n| AC2 | test |\n');
    const dst = join(t.dir, 'dst');
    copyTree(src, dst);
    assert.equal(readFileSync(join(dst, 'plan.md'), 'utf8'), '| AC1 | test |\n| AC2 | test |\n');
    assert.equal(readFileSync(join(dst, 'sub', 'a.mjs'), 'utf8'), 'export const a = 1;\n');
    assert.deepEqual([...readFileSync(join(dst, 'sub', 'blob.bin'))], [13, 10, 0, 13, 10]);
  } finally {
    t.done();
  }
});

test('E5 plan follows the release recipe', async () => {
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'completo');
    const plan = readText(join(here, 'scenario', 'e5', 'plan.md'));
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
    git(t.dir, 'checkout', '-q', 'feat/E5'); // the code sentinels read the working tree at the branch tip
    const changed = git(t.dir, 'diff', '--name-only', s.seededCommit + '^', s.seededCommit).split('\n');
    for (const e of entries) {
      const mod = await sentinel(e);
      assert.ok(changed.includes(e.file), e.id + ': file not changed in the seeded commit');
      assert.equal(mod.present(t.dir, s.seededCommit), true, e.id + ': sentinel absent after seeding');
      if (cls !== 'code') assert.equal(mod.present(t.dir, s.seededCommit + '^'), false, e.id + ': sentinel present in the clean artifact');
      assert.equal(s.seededBlobs[e.file], git(t.dir, 'rev-parse', s.seededCommit + ':' + e.file));
    }
    git(t.dir, 'checkout', '-q', 'main');
    assert.equal(git(t.dir, 'status', '--porcelain'), '');
    // The release SETUP does `git worktree add <wt> feat/E5`: the root must not hold the branch.
    assert.equal(git(t.dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
    const wt = join(t.dir, '..', 'release-wt-' + variant);
    try {
      git(t.dir, 'worktree', 'add', wt, 'feat/E5');
    } finally {
      spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: t.dir });
    }
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

const sha = (t) => createHash('sha256').update(t).digest('hex');

test('seedSourceOf without a folder describes the synthetic texts', () => {
  const r = seedSourceOf();
  assert.equal(r.kind, 'sintetico');
  assert.equal(r.spec, 'scenario/e5/spec.md');
  assert.equal(r.plan, 'scenario/e5/plan.md');
  assert.equal(r.specSha256, sha(readText(join(here, 'scenario', 'e5', 'spec.md'))));
  assert.equal(r.planSha256, sha(readText(join(here, 'scenario', 'e5', 'plan.md'))));
});

function approvedFolder(base) {
  const specDir = join(base, 'docs', 'superpowers', 'specs');
  const planDir = join(base, 'docs', 'superpowers', 'plans');
  mkdirSync(specDir, { recursive: true });
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(specDir, '2026-01-01-E5-x-design.md'), readText(join(here, 'scenario', 'e5', 'spec.md')) + '[fab] extra line\n');
  writeFileSync(join(planDir, '2026-01-01-E5-x.md'), readText(join(here, 'scenario', 'e5', 'plan.md')) + '[fab] extra line\n');
}

test('seedSourceOf with a folder describes the approved run by file name and hash', () => {
  const t = tmp('x');
  try {
    approvedFolder(t.base);
    const r = seedSourceOf(t.base);
    const syn = seedSourceOf();
    assert.equal(r.kind, 'execucao-aprovada');
    assert.equal(r.spec, '2026-01-01-E5-x-design.md');
    assert.equal(r.plan, '2026-01-01-E5-x.md');
    assert.notEqual(r.specSha256, syn.specSha256);
    assert.notEqual(r.planSha256, syn.planSha256);
    const json = JSON.stringify(r);
    assert.ok(!json.includes(t.base));
    assert.ok(!json.includes(t.base.replaceAll('\\', '/')));
    assert.ok(!json.includes(JSON.stringify(t.base).slice(1, -1)));
  } finally {
    t.done();
  }
});

test('seedSourceOf fails like the scenario when the plan is missing', async () => {
  const t = tmp('x');
  try {
    const specDir = join(t.base, 'docs', 'superpowers', 'specs');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, '2026-01-01-E5-x-design.md'), 'spec\n');
    let direct;
    assert.throws(() => seedSourceOf(t.base), (e) => ((direct = e.message), true));
    await assert.rejects(makeScenario(t.dir, 'plano-semeado-A', { fromRun: t.base }), (e) => {
      assert.equal(e.message, direct);
      return true;
    });
  } finally {
    t.done();
  }
});

test('release run variants carry the permission rules in an excluded settings.local.json', async () => {
  for (const variant of ['completo', 'parada-retomada', 'plan-only', 'coordinator']) {
    const t = tmp('sb');
    try {
      await makeScenario(t.dir, variant);
      const file = join(t.dir, '.claude', 'settings.local.json');
      if (variant === 'completo' || variant === 'parada-retomada') {
        assert.equal(readFileSync(file, 'utf8'), JSON.stringify({ permissions: { allow: SANDBOX_RELEASE_RULES } }, null, 2) + '\n');
        assert.deepEqual(SANDBOX_RELEASE_RULES, ['Bash(node:*)', 'Bash(git:*)', 'Workflow', 'Workflow(productivity-tools:roadmap-release)']);
        assert.ok(git(t.dir, 'check-ignore', '.claude/settings.local.json').length > 0);
        assert.equal(git(t.dir, 'ls-files', '.claude/settings.local.json'), '');
      } else {
        assert.equal(existsSync(file), false, variant);
      }
      assert.equal(git(t.dir, 'status', '--porcelain'), '');
    } finally {
      t.done();
    }
  }
});

// Plan sentinels against the synthetic plan and three plans written by the real pipeline (paths scrubbed).
const PLAN_FILE = 'docs/superpowers/plans/2026-11-10-E5-text-utilities.md';
const PLAN_FORMATS = {
  synthetic: join(here, 'scenario', 'e5', 'plan.md'),
  'real-1': join(here, 'fixtures', 'plans', 'real-1.md'),
  'real-2': join(here, 'fixtures', 'plans', 'real-2.md'),
  'real-3': join(here, 'fixtures', 'plans', 'real-3.md'),
};
// Formats without a task that runs the bare suite / declares the sandbox-port lock cannot take P3 / P6.
const NO_ANCHOR = { 'real-2': { P3: 'P3: anchor not found', P6: 'P6: anchor not found' } };
const planEntries = manifest.filter((e) => e.class === 'plan');

function planRepo(format) {
  const t = tmp('plan');
  mkdirSync(join(t.dir, 'docs', 'superpowers', 'plans'), { recursive: true });
  writeFileSync(join(t.dir, PLAN_FILE), readFileSync(PLAN_FORMATS[format], 'utf8'));
  git(t.dir, 'init', '-q');
  git(t.dir, 'config', 'user.email', 't@t');
  git(t.dir, 'config', 'user.name', 't');
  git(t.dir, 'add', '-A');
  git(t.dir, 'commit', '-q', '-m', 'plan');
  return t;
}
const planSha = (dir) => createHash('sha256').update(readFileSync(join(dir, PLAN_FILE))).digest('hex');

for (const format of Object.keys(PLAN_FORMATS)) {
  test('plan sentinels on the ' + format + ' plan: each seeds, is present after and absent before', async () => {
    for (const e of planEntries) {
      const t = planRepo(format);
      try {
        const mod = await sentinel(e);
        assert.equal(mod.present(t.dir, 'HEAD'), false, format + ' ' + e.id + ': present on the clean plan');
        const expected = NO_ANCHOR[format]?.[e.id];
        if (expected) {
          assert.throws(() => mod.seed(t.dir), { message: expected });
          continue;
        }
        mod.seed(t.dir);
        git(t.dir, 'add', '-A');
        git(t.dir, 'commit', '-q', '-m', 'seeded');
        assert.equal(mod.present(t.dir, 'HEAD'), true, format + ' ' + e.id + ': absent after seeding');
        assert.equal(mod.present(t.dir, 'HEAD^'), false, format + ' ' + e.id + ': present in the clean plan');
      } finally {
        t.done();
      }
    }
  });

  test('plan artifacts A, B and C apply in manifest order on the ' + format + ' plan', async () => {
    for (const artifact of ['A', 'B', 'C']) {
      const t = planRepo(format);
      try {
        const entries = planEntries.filter((e) => e.artifact === artifact);
        const blocked = entries.find((e) => NO_ANCHOR[format]?.[e.id]);
        if (blocked) {
          for (const e of entries) {
            const mod = await sentinel(e);
            if (e === blocked) { assert.throws(() => mod.seed(t.dir), { message: NO_ANCHOR[format][e.id] }); break; }
            mod.seed(t.dir);
          }
          continue;
        }
        for (const e of entries) (await sentinel(e)).seed(t.dir);
        git(t.dir, 'add', '-A');
        git(t.dir, 'commit', '-q', '-m', 'seeded');
        for (const e of entries) assert.equal((await sentinel(e)).present(t.dir, 'HEAD'), true, format + ' ' + e.id);
      } finally {
        t.done();
      }
    }
  });
}

// Sha256 of the plan after each sentinel (alone) and after each artifact sequence, captured from the sentinels before they learned the real formats.
const SYNTHETIC_SEEDED_SHA = {
  P1: 'b61dbaba33e7a6526d383d678b8ce31c556e6ffbc617369c84bd67bb29f50cf1',
  P2: '6cd38abb26d9ed87368ade11e1cb02b36242a9599537c2eca1c2e1d4bd056b6b',
  P3: '3519d07f49c0110ff2d70748797e3d73c96c7e7dbbccc3e715355fb77f60cf9b',
  P4: '401486a09aa6e208b2367fa6e0230c9decefa8dab313636f29a14c80659a2a3d',
  P5: 'ea6dc4399fb7524176d32249eb5c2b82694982cc29d40a9f33985781d0e7a064',
  P6: '1e97a0b5cfc3d532838de533d6b424981134b797a2e1f6f7360cd607a3e4939b',
  P7: 'b336a6cab144eea60633abb8ea8fe73617a7e1d7110c62c5a6c7231e9b6338f5',
  P8: 'f99c61ff51d49826e7ee57e27d0574709fdeab13aefced8a38d5b94ee68cd626',
  PX1: '6d3600582a499f77af9a110e5125a002774126f9357bd173717308dc1a54e62d',
  PX2: 'bcc08c855ca4340e1f8d802abf5f508f84ed5904c2f80e6141e6eaee887f5c7b',
  PX3: '842e9b35e52b4a1a3fb039cb97e397e8df39c4a69f1169081bd500d5ab822ed7',
  seqA: 'eea75bde9ad3289fd728cc8c3036628b62fb8c56b7418083051d7ffa40e5a8d6',
  seqB: 'd83312de49a468200ad50b03a24fc027a2a0d143e0e09cae3a1d60f6e44e8583',
  seqC: '820e843ce58ba3706fc421214fd2fa40777833fd125445a863b990293760baa7',
};

test('the synthetic plan is seeded byte-identically to the sentinels of before', async () => {
  for (const e of planEntries) {
    const t = planRepo('synthetic');
    try {
      (await sentinel(e)).seed(t.dir);
      assert.equal(planSha(t.dir), SYNTHETIC_SEEDED_SHA[e.id], e.id);
    } finally {
      t.done();
    }
  }
  for (const artifact of ['A', 'B', 'C']) {
    const t = planRepo('synthetic');
    try {
      for (const e of planEntries.filter((x) => x.artifact === artifact)) (await sentinel(e)).seed(t.dir);
      assert.equal(planSha(t.dir), SYNTHETIC_SEEDED_SHA['seq' + artifact], 'artifact ' + artifact);
    } finally {
      t.done();
    }
  }
});
