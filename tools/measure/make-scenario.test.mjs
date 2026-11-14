import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { makeScenario, SANDBOX_RELEASE_RULES, seedSourceOf, prepareE5Branch, runSandboxSuite, VARIANTS, E5_PATHS, artifactOf, readText, copyTree, NATIVE_PATHS, NATIVE_SEEDS, readNativeSeeds, prepareNativeBranch, manifestEntries } from './make-scenario.mjs';
import { loadPure } from '../../plugins/productivity-tools/skills/roadmap-release/workflow/load-pure.mjs';
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
    'spec-semeado-A', 'spec-semeado-B', 'plano-semeado-codigo', 'spec-author', 'plan-author',
    'spec-nativo-A', 'spec-nativo-B', 'plano-nativo-A', 'plano-nativo-B',
  ].sort());
  assert.equal(VARIANTS.length, 19);
  assert.equal(VARIANTS[VARIANTS.length - 1], 'plano-nativo-B');
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
    const { class: cls } = artifactOf(variant);
    const entries = manifestEntries(variant);
    assert.ok(entries.length > 0, 'no manifest entries for ' + variant);
    assert.deepEqual(s.seeded, entries.map((e) => e.id));
    assert.ok(s.seededCommit);
    git(t.dir, 'checkout', '-q', 'feat/E5'); // the code sentinels read the working tree at the branch tip
    const changed = git(t.dir, 'diff', '--name-only', s.seededCommit + '^', s.seededCommit).split('\n');
    for (const e of entries) {
      const mod = await sentinel(e);
      assert.ok(changed.includes(e.file), e.id + ': file not changed in the seeded commit');
      assert.equal(mod.present(t.dir, s.seededCommit, e.id), true, e.id + ': sentinel absent after seeding');
      if (cls !== 'code') assert.equal(mod.present(t.dir, s.seededCommit + '^', e.id), false, e.id + ': sentinel present in the clean artifact');
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
  const legacy = manifest.filter((x) => !x.set);
  assert.equal(legacy.length, 27);
  for (const cls of ['plan', 'spec', 'code']) {
    const own = legacy.filter((x) => x.class === cls);
    assert.equal(own.filter((x) => x.detectedBy === 'reviewer').length, 8, cls);
  }
  assert.equal(manifest.filter((x) => x.detectedBy === 'code').length, 3);
  for (const e of manifest) {
    const n = VARIANTS.filter((v) => { const a = artifactOf(v); return a && a.class === e.class && a.artifact === e.artifact && a.set === (e.set ?? 'e5'); }).length;
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
  for (const v of ['plano-semeado-A', 'plano-semeado-B', 'plano-semeado-codigo', 'spec-semeado-A', 'spec-semeado-B', 'codigo-semeado-A', 'codigo-semeado-B', 'spec-nativo-A', 'spec-nativo-B', 'plano-nativo-A', 'plano-nativo-B']) {
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
      const sc = await makeScenario(t.dir, variant);
      const file = join(t.dir, '.claude', 'settings.local.json');
      if (variant === 'completo' || variant === 'parada-retomada') {
        assert.equal(readFileSync(file, 'utf8'), JSON.stringify({ permissions: { allow: SANDBOX_RELEASE_RULES, additionalDirectories: [sc.dir + '-wt'] } }, null, 2) + '\n');
        // Claude Code grants an additional directory only if it exists when the session starts.
        assert.ok(statSync(sc.dir + '-wt').isDirectory());
        assert.deepEqual(SANDBOX_RELEASE_RULES.slice(0, 4), ['Bash(node:*)', 'Bash(git:*)', 'Workflow', 'Workflow(productivity-tools:roadmap-release)']);
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
const planEntries = manifest.filter((e) => e.class === 'plan' && !e.set);

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

// E17 T1: the 1.7.0 preflight must leave the sandbox with no missing permission rule.
import { makeSandbox } from '../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs';
import { runPreflight } from '../../plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs';
import { mkdtempSync as e17Mk, rmSync as e17Rm, mkdirSync as e17Mkdir, writeFileSync as e17Write, copyFileSync as e17Copy } from 'node:fs';

const E17_TMPS = [];
const e17Tmp = () => { const d = e17Mk(join(tmpdir(), 'e17-t1-')); E17_TMPS.push(d); return d; };
test.after(() => { for (const d of E17_TMPS) e17Rm(d, { recursive: true, force: true }); });

test('E17: sandbox settings leave the 1.7.0 preflight with no missing rule', () => {
  const base = e17Tmp();
  const sb = join(base, 'sb');
  makeSandbox(sb);
  e17Mkdir(join(sb, '.claude'), { recursive: true });
  e17Write(join(sb, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { allow: SANDBOX_RELEASE_RULES } }, null, 2) + '\n');
  const home = join(base, 'home');
  const configDir = join(base, 'cfg');
  e17Mkdir(home); e17Mkdir(configDir);
  const r = runPreflight(join(sb, 'docs/plans/roadmap-sandbox'), { home, configDir });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.missingRules, []);
  assert.ok(!r.warnings.some((w) => w.startsWith('release workflow:')), JSON.stringify(r.warnings));
});

test('E17: SANDBOX_RELEASE_RULES keeps the 1.6.0 rules first', () => {
  assert.deepEqual(SANDBOX_RELEASE_RULES.slice(0, 4), ['Bash(node:*)', 'Bash(git:*)', 'Workflow', 'Workflow(productivity-tools:roadmap-release)']);
});

test('E17: a tree mounted from the archived E15 seed passes the --from-run pre-check', () => {
  const arch = resolve(here, '..', '..', 'docs/reports/2026-11-11-e15-linha-de-base/semeadura-completo-1');
  const seed = join(e17Tmp(), 'seed');
  e17Mkdir(join(seed, 'docs/superpowers/specs'), { recursive: true });
  e17Mkdir(join(seed, 'docs/superpowers/plans'), { recursive: true });
  e17Copy(join(arch, '2026-11-12-E5-text-utilities-design.md'), join(seed, 'docs/superpowers/specs/2026-11-12-E5-text-utilities-design.md'));
  e17Copy(join(arch, '2026-11-12-E5-text-utilities.md'), join(seed, 'docs/superpowers/plans/2026-11-12-E5-text-utilities.md'));
  const r = seedSourceOf(seed);
  assert.equal(r.kind, 'execucao-aprovada');
  assert.equal(r.specSha256, '7b9cc1394b2fb863ad04bf35af6c44cb8288c8a7f2e13f15fca1311601c36f93');
  assert.equal(r.planSha256, 'ea14b7abf7197115e0bf2c6e20f3220e1aaaf11bc9cf40a4e552a0cdc4a74912');
});

test('E17: SANDBOX_RELEASE_RULES names the release workflow and the tracker script rules', () => {
  assert.ok(SANDBOX_RELEASE_RULES.includes('Workflow(productivity-tools:release-workflow)'));
  assert.ok(SANDBOX_RELEASE_RULES.includes('Bash(node *roadmap.mjs" *)'));
});

const E19_CARD = join(here, 'scenario', 'spec-author-card.md');
const E19_REQUEST = join(here, 'scenario', 'spec-writer-request.md');
const E19_SPEC_TOOL = resolve(here, '..', '..', 'plugins/productivity-tools/scripts/spec-tool.mjs');

test('E19: spec-author variant adds the E6 card with the token only by name', async () => {
  const t = tmp('sb');
  try {
    const s = await makeScenario(t.dir, 'spec-author');
    assert.deepEqual(s.prompts, []);
    assert.equal(s.stopResume, null);
    assert.deepEqual(s.seeded, []);
    const strategy = readFileSync(join(t.dir, 'docs/plans/roadmap-sandbox/strategy.md'), 'utf8');
    assert.ok(strategy.includes('<!-- roadmap:card id=E6'));
    assert.ok(strategy.includes('REPORT_STORE_TOKEN'));
    assert.ok(!strategy.includes('\r'));
    assert.equal(git(t.dir, 'status', '--porcelain'), '');
    assert.equal(git(t.dir, 'log', '-1', '--format=%s'), 'docs(roadmap): add E6 card');
    const r = spawnSync(process.execPath, ['docs/plans/roadmap-sandbox/check-roadmap.mjs'], { cwd: t.dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!existsSync(join(t.dir, '.claude/settings.local.json')));
  } finally {
    t.done();
  }
});

test('E19: spec-author card and request carry no credential value', () => {
  for (const f of [E19_CARD, E19_REQUEST]) {
    const text = readText(f);
    assert.ok(!/REPORT_STORE_TOKEN\s*[=:]\s*\S/.test(text), f);
    assert.ok(!/(sk-|ghp_|xox[bp]-|AKIA)[A-Za-z0-9]/.test(text), f);
  }
  assert.ok(readText(E19_REQUEST).startsWith('<!-- synthetic input:'));
});

test('E19: spec-author card passes spec-tool against the sandbox roadmap', async () => {
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'spec-author');
    const strategy = readFileSync(join(t.dir, 'docs/plans/roadmap-sandbox/strategy.md'), 'utf8').replace(/\r\n/g, '\n');
    const e6 = strategy.slice(strategy.indexOf('<!-- roadmap:card id=E6'));
    const block = e6.match(/<!-- roadmap:acceptance -->\n([\s\S]*?)\n<!-- \/roadmap:acceptance -->/)[1];
    const lines = block.split('\n').filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, ''));
    assert.equal(lines.length, 2);
    const data = {
      schema: 'spec/1', id: 'E6', title: 'Publish report to remote storage', mode: 'unattended',
      acceptance: lines.map((text, i) => ({ id: 'AC' + (i + 1), text })),
      rulings: [],
      needsPerson: [{ id: 'H1', kind: 'credential', what: 'Access token in environment variable REPORT_STORE_TOKEN.', why: 'Criterion 2 needs the real token.', blocking: true, workaround: '' }],
      externalEffects: [],
      edgeCases: [],
    };
    const spec = join(t.base, 'spec.md');
    writeFileSync(spec, '# Spec E6\n\n```json data\n' + JSON.stringify(data, null, 2) + '\n```\n');
    const r = spawnSync(process.execPath, [E19_SPEC_TOOL, 'check', spec, '--roadmap', join(t.dir, 'docs/plans/roadmap-sandbox'), '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    t.done();
  }
});

const E20_PLUGIN = resolve(here, '..', '..', 'plugins/productivity-tools');
const E20_SPEC_TOOL = join(E20_PLUGIN, 'scripts/spec-tool.mjs');
const E20_PATHS = {
  e5: 'docs/plans/roadmap-sandbox-E5/spec.md',
  wc: 'docs/plans/word-count/spec.md',
  plan: 'docs/superpowers/plans/2026-01-01-e5-text-utilities.md',
};

test('E20: plan-author variant writes the E5 spec, the word-count spec and the legacy plan', async () => {
  const t = tmp('sb');
  try {
    const s = await makeScenario(t.dir, 'plan-author');
    for (const rel of Object.values(E20_PATHS)) {
      assert.ok(existsSync(join(t.dir, rel)), rel);
      assert.ok(!readFileSync(join(t.dir, rel), 'utf8').includes('\r'), rel);
    }
    assert.equal(git(t.dir, 'status', '--porcelain'), '');
    assert.equal(git(t.dir, 'log', '-1', '--format=%s'), 'docs: E5 spec, word-count spec and legacy E5 plan');
    assert.deepEqual(s.prompts, []);
    assert.equal(s.stopResume, null);
    assert.deepEqual(s.seeded, []);
    assert.ok(!existsSync(join(t.dir, '.claude/settings.local.json')));
  } finally {
    t.done();
  }
});

test('E20: the E5 spec passes spec-tool against the sandbox roadmap', async () => {
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'plan-author');
    const r = spawnSync(process.execPath, [E20_SPEC_TOOL, 'check', join(t.dir, E20_PATHS.e5), '--roadmap', join(t.dir, 'docs/plans/roadmap-sandbox'), '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    t.done();
  }
});

test('E20: the word-count spec passes spec-tool outside a roadmap', async () => {
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'plan-author');
    const r = spawnSync(process.execPath, [E20_SPEC_TOOL, 'check', join(t.dir, E20_PATHS.wc), '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!/-E\d+$/.test(dirname(E20_PATHS.wc)));
  } finally {
    t.done();
  }
});

test('E20: the legacy plan has no data block and names the sandbox roadmap', async () => {
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'plan-author');
    const { readDataBlock } = await import(pathToFileURL(join(E20_PLUGIN, 'lib/data-block.mjs')).href);
    const text = readFileSync(join(t.dir, E20_PATHS.plan), 'utf8');
    assert.equal(readDataBlock(text).error.code, 'data-block-missing');
    assert.ok(text.includes('**Roadmap:** docs/plans/roadmap-sandbox/'));
  } finally {
    t.done();
  }
});

// E26 A3: native spec and plan of E5, copied from the 2nd probe (release/sandbox, plugin c5658cf).
const NATIVE_DIR = join(here, 'scenario', 'e5-native');
const NATIVE_SHA = {
  spec: 'fa68eb1f1c1c017003beffb380887cb6143f3012b4136a5b1dc5a4dcbe1d7cec',
  plan: '6d486e526820c082cfe008a63765acbc1377236ff69334285979f7c145c0da30',
};
const NATIVE_BLOB = { spec: '52e8d1fd302041c0383d5df3ef503669e0d12c2e', plan: '36fc2dffb82273a2fa6f260d713876671372b76f' };
const PLUGIN = resolve(here, '..', '..', 'plugins/productivity-tools');
const SPEC_TOOL = join(PLUGIN, 'scripts/spec-tool.mjs');
const PLAN_TOOL = join(PLUGIN, 'scripts/plan-tool.mjs');

test('E26: native seeds are LF copies whose sha256 matches the probe blobs', () => {
  for (const k of ['spec', 'plan']) {
    const bytes = readFileSync(join(NATIVE_DIR, k + '.md'));
    assert.ok(!bytes.includes(13), k + ' has CR');
    assert.equal(sha(bytes), NATIVE_SHA[k], k);
    assert.equal(NATIVE_SEEDS[k].sha256, NATIVE_SHA[k], k);
    assert.equal(NATIVE_SEEDS[k].file, 'scenario/e5-native/' + k + '.md');
  }
});

test('E26: NATIVE_PATHS comes from artifactPaths of the measured workflow', () => {
  assert.deepEqual(NATIVE_PATHS, loadPure().artifactPaths('sandbox', 'E5'));
  assert.equal(NATIVE_PATHS.spec, 'docs/plans/sandbox-E5/spec.md');
  assert.equal(NATIVE_PATHS.plan, 'docs/plans/sandbox-E5/plan.md');
});

test('E26: readNativeSeeds refuses a seed whose sha256 diverges', () => {
  const t = tmp('seeds');
  try {
    mkdirSync(t.dir, { recursive: true });
    writeFileSync(join(t.dir, 'spec.md'), readFileSync(join(NATIVE_DIR, 'spec.md')));
    writeFileSync(join(t.dir, 'plan.md'), readFileSync(join(NATIVE_DIR, 'plan.md')));
    assert.deepEqual(Object.keys(readNativeSeeds(t.dir)).sort(), ['plan', 'spec']);
    writeFileSync(join(t.dir, 'plan.md'), readText(join(NATIVE_DIR, 'plan.md')) + 'x\n');
    assert.throws(() => readNativeSeeds(t.dir), /plan.*sha256/);
  } finally {
    t.done();
  }
});

test('E26: prepareNativeBranch commits the probe blobs at NATIVE_PATHS on feat/E5', async () => {
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'completo');
    prepareNativeBranch(t.dir, { withPlan: true });
    assert.equal(git(t.dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feat/E5');
    assert.equal(git(t.dir, 'rev-parse', 'feat/E5:' + NATIVE_PATHS.spec), NATIVE_BLOB.spec);
    assert.equal(git(t.dir, 'rev-parse', 'feat/E5:' + NATIVE_PATHS.plan), NATIVE_BLOB.plan);
    assert.deepEqual(git(t.dir, 'log', '--format=%s', 'main..feat/E5').split('\n'), ['docs(plan): E5 text utilities plan', 'docs(spec): E5 text utilities design']);
    assert.equal(git(t.dir, 'status', '--porcelain'), '');
    const roadmap = join(t.dir, 'docs/plans/roadmap-sandbox');
    const s = spawnSync(process.execPath, [SPEC_TOOL, 'check', join(t.dir, NATIVE_PATHS.spec), '--roadmap', roadmap], { encoding: 'utf8' });
    assert.equal(s.status, 0, s.stdout + s.stderr);
    const p = spawnSync(process.execPath, [PLAN_TOOL, 'check', join(t.dir, NATIVE_PATHS.plan), '--spec', join(t.dir, NATIVE_PATHS.spec)], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stdout + p.stderr);
    const u = tmp('sb');
    try {
      await makeScenario(u.dir, 'completo');
      prepareNativeBranch(u.dir, { withPlan: false });
      assert.deepEqual(git(u.dir, 'log', '--format=%s', 'main..feat/E5').split('\n'), ['docs(spec): E5 text utilities design']);
    } finally {
      u.done();
    }
  } finally {
    t.done();
  }
});

test('E26: makeScenario returns scenario.paths (legacy paths for the old variants)', async () => {
  const t = tmp('sb');
  try {
    const s = await makeScenario(t.dir, 'plano-semeado-A');
    assert.deepEqual(s.paths, E5_PATHS);
  } finally {
    t.done();
  }
});

test('E26: seedSourceOf describes the native seeds of the 2nd probe', () => {
  assert.deepEqual(seedSourceOf(undefined, { set: 'e5-native' }), {
    kind: 'nativo-sonda-2', spec: 'scenario/e5-native/spec.md', plan: 'scenario/e5-native/plan.md',
    specSha256: NATIVE_SHA.spec, planSha256: NATIVE_SHA.plan, probePluginCommit: 'c5658cf',
  });
  assert.throws(() => seedSourceOf('/some/run', { set: 'e5-native' }), /--from-run/);
  assert.equal(seedSourceOf().kind, 'sintetico');
});

// E26 T4: native defects, one module (sentinels/native.mjs) driven by the id.
const NATIVE_VARIANTS = ['plano-nativo-A', 'plano-nativo-B', 'spec-nativo-A', 'spec-nativo-B'];
const NATIVE_IDS = {
  'plano-nativo-A': ['P1', 'P2', 'P9', 'P4'],
  'plano-nativo-B': ['P5', 'P6', 'P10', 'P8'],
  'spec-nativo-A': ['SN1', 'SN2', 'SN3', 'SN4'],
  'spec-nativo-B': ['SN5', 'SN6', 'SN7', 'SN8'],
};
const COUPLED = { 'plano-nativo-A': 'P1', 'plano-nativo-B': 'P10', 'spec-nativo-A': 'SN2', 'spec-nativo-B': 'SN7' };
const nativeEntries = manifest.filter((e) => e.set === 'e5-native');
const PURE = loadPure();
const RM = 'docs/plans/roadmap-sandbox/';

// The plan gaps of the workflow, recomposed from its pure functions over the plan-tool emit and the card E5.
function nativePlanGaps(sandbox) {
  const r = spawnSync(process.execPath, [PLAN_TOOL, 'emit', join(sandbox, NATIVE_PATHS.plan), '--spec', join(sandbox, NATIVE_PATHS.spec)], { encoding: 'utf8' });
  const ld = PURE.checkPlanLoad({ emitExit: r.status, emitStdout: r.stdout, checkStdout: r.stderr, blob: '0'.repeat(40) }, { E: 'E5', RM });
  if (!ld.ok) return ['plan load: ' + ld.why];
  const strategy = readText(join(sandbox, RM, 'strategy.md'));
  const card = strategy.slice(strategy.indexOf('<!-- roadmap:card id=E5 '));
  const block = /<!-- roadmap:acceptance -->\n([\s\S]*?)\n<!-- \/roadmap:acceptance -->/.exec(card)[1];
  const cardAc = block.split('\n').filter((l) => /^\d+\. /.test(l)).map((l, i) => {
    const text = l.replace(/^\d+\. /, '');
    return { id: 'AC' + (i + 1), text, tag: PURE.parseVerifyTag(text) };
  });
  assert.equal(cardAc.length, 3);
  const locks = JSON.parse(readText(join(sandbox, RM, 'release.config.json'))).locks.filter((n) => n !== 'merge');
  const tasks = PURE.tasksFromPlan(ld.plan);
  const ac = PURE.evidenceFromPlan(ld.plan);
  return [
    ...PURE.evidenceGaps(cardAc, ac, new Set()),
    ...PURE.externalGaps(tasks),
    ...PURE.evidenceExternalGaps(cardAc, ac),
    ...tasks.filter((t, i) => t.n !== i + 1).map((t) => ({ description: 'task numbers must run 1..N' })),
    ...tasks.flatMap((t) => (t.needsLock || []).filter((n) => !locks.includes(n)).map((n) => ({ description: 'unknown lock ' + n }))),
  ].map((g) => g.description);
}

function toolCheck(sandbox, cls) {
  const args = cls === 'spec'
    ? [SPEC_TOOL, 'check', join(sandbox, NATIVE_PATHS.spec), '--roadmap', join(sandbox, RM)]
    : [PLAN_TOOL, 'check', join(sandbox, NATIVE_PATHS.plan), '--spec', join(sandbox, NATIVE_PATHS.spec)];
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

test('E26: native manifest entries carry set, file, seed, sha256, sentinel and the E11 notes', () => {
  assert.deepEqual(nativeEntries.map((e) => e.id).sort(), Object.values(NATIVE_IDS).flat().sort());
  for (const e of nativeEntries) {
    assert.equal(e.file, NATIVE_PATHS[e.class], e.id);
    assert.equal(e.seed, NATIVE_SEEDS[e.class].file, e.id);
    assert.equal(e.seedSha256, NATIVE_SEEDS[e.class].sha256, e.id);
    assert.equal(e.sentinel, 'sentinels/native.mjs', e.id);
    assert.equal(e.detectedBy, 'reviewer', e.id);
    assert.ok(['prose', 'json', 'coupled'].includes(e.where), e.id);
    if (e.replaces) assert.ok(typeof e.noteE11 === 'string' && e.noteE11.length > 20, e.id + ': replacement without noteE11');
  }
  const byId = Object.fromEntries(nativeEntries.map((e) => [e.id, e]));
  assert.equal(byId.P9.replaces, 'P3');
  assert.ok(byId.P9.noteE11 && byId.P6.noteE11);
  assert.equal(byId.P10.replaces, 'P7');
  for (const v of NATIVE_VARIANTS) {
    assert.deepEqual(manifestEntries(v).map((e) => e.id), NATIVE_IDS[v], v);
    assert.deepEqual(manifestEntries(v).filter((e) => e.where === 'coupled').map((e) => e.id), [COUPLED[v]], v);
    assert.equal(artifactOf(v).set, 'e5-native');
  }
  assert.equal(artifactOf('plano-semeado-A').set, 'e5');
  assert.deepEqual(manifestEntries('plano-semeado-A').map((e) => e.id), ['P1', 'P2', 'P3', 'P4']);
});

test('E26: readNativeSeeds refuses a manifest sha256 that diverges from the copy', () => {
  assert.throws(() => readNativeSeeds(undefined, { plan: '0'.repeat(64) }), /plan.*sha256/);
});

test('E26: native variants seed every defect in one commit; the product tools still pass', async () => {
  for (const v of NATIVE_VARIANTS) {
    const { s } = await checkSeeded(v);
    assert.deepEqual(s.paths, NATIVE_PATHS, v);
    assert.deepEqual(s.prompts, v.startsWith('plano') ? ['/productivity-tools:roadmap-release plan-only E5'] : [], v);
    assert.equal(s.seededSubject, v.startsWith('plano') ? 'docs(plan): E5 refine plan' : 'docs(spec): E5 clarify design');
    const t = tmp('sb');
    try {
      const sc = await makeScenario(t.dir, v);
      git(t.dir, 'checkout', '-q', 'feat/E5');
      const cls = artifactOf(v).class;
      const r = toolCheck(t.dir, cls);
      assert.equal(r.status, 0, v + ': ' + r.stdout + r.stderr);
      if (cls === 'plan') assert.deepEqual(nativePlanGaps(t.dir), [], v);
      assert.deepEqual(Object.keys(sc.seededBlobs), [NATIVE_PATHS[cls]]);
    } finally {
      t.done();
    }
  }
});

test('E26: each native defect alone passes the product tools and its sentinel', async () => {
  const native = await import(pathToFileURL(join(here, 'defects', 'sentinels', 'native.mjs')).href);
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'completo');
    prepareNativeBranch(t.dir, { withPlan: true });
    const clean = git(t.dir, 'rev-parse', 'HEAD');
    for (const e of nativeEntries) {
      assert.equal(native.present(t.dir, clean, e.id), false, e.id + ': present on the clean artifact');
      native.seed(t.dir, e.id);
      git(t.dir, 'commit', '-q', '-am', 'x');
      assert.equal(native.present(t.dir, 'HEAD', e.id), true, e.id + ': absent after seeding');
      const r = toolCheck(t.dir, e.class);
      assert.equal(r.status, 0, e.id + ': ' + r.stdout + r.stderr);
      if (e.class === 'plan') assert.deepEqual(nativePlanGaps(t.dir), [], e.id);
      git(t.dir, 'reset', '-q', '--hard', clean);
    }
  } finally {
    t.done();
  }
});

test('E26: a coupled defect stays present while either place still has it', async () => {
  const native = await import(pathToFileURL(join(here, 'defects', 'sentinels', 'native.mjs')).href);
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'completo');
    prepareNativeBranch(t.dir, { withPlan: true });
    const clean = git(t.dir, 'rev-parse', 'HEAD');
    for (const id of Object.values(COUPLED)) {
      for (const only of ['prose', 'json']) {
        native.seed(t.dir, id, { only });
        git(t.dir, 'commit', '-q', '-am', 'x');
        assert.equal(native.present(t.dir, 'HEAD', id), true, id + ' ' + only);
        git(t.dir, 'reset', '-q', '--hard', clean);
      }
    }
    assert.throws(() => native.present(t.dir, 'HEAD'), /id/);
    assert.throws(() => native.seed(t.dir, 'P3'), /P3/);
  } finally {
    t.done();
  }
});

test('E20: plan-writer adopt script is marked synthetic and approves', () => {
  const text = readFileSync(join(here, 'scenario/plan-writer-adopt.md'), 'utf8');
  assert.ok(text.startsWith('<!-- synthetic input:'));
  assert.ok(/^## Request$/m.test(text) && text.includes('docs/superpowers/plans/2026-01-01-e5-text-utilities.md'));
  assert.match(text, /^## Approval\s*\n+approve\s*$/m);
  assert.ok(!/(sk-|ghp_|xox[bp]-|AKIA)[A-Za-z0-9]/.test(text));
});

// E26 T4 review probes: a correct fix worded differently must read absent (false); a non-fix or a reformat must still
// read present (true); a missing json block makes a json-only defect indeterminate (null).
const NATIVE_PROBES = [
  ['P9 correct order, reworded "must fail"', 'P9', 'plan', false, (t) => t.replace(/2\. (Write `src\/word-count\.mjs`[^\n]*)\n3\. Run `node --test tests\/e5-word-count\.test\.mjs`: expected to fail \(module missing\)\.\n/, '2. Run `node --test tests/e5-word-count.test.mjs`: it must fail because the module is missing.\n3. $1\n')],
  ['P10 fixed + note "do not modify src/greet.mjs"', 'P10', 'plan', false, (t) => t.replace(', `src/greet.mjs` (modify).', '. Do not modify `src/greet.mjs` (out of scope).').replace('"modify": ["src/greet.mjs"]', '"modify": []').replace('"src/truncate.mjs", "src/greet.mjs", ', '"src/truncate.mjs", ')],
  ['SN5 moved to Scope Out', 'SN5', 'spec', false, (t) => t.replace('- `src/capitalize.mjs` exporting `capitalize(text)`, tested by `tests/e5-capitalize.test.mjs`.\n', '').replace('Out:\n\n', 'Out:\n\n- `src/capitalize.mjs` (not asked by the card).\n')],
  ['SN1 partial: only the example fixed', 'SN1', 'spec', true, (t) => t.replace("'caf\u00e9-au-lait'", "'cafe-au-lait'")],
  ['SN7 fixed, section kept as "None."', 'SN7', 'spec', false, (t) => t.replace(/- H1 \(blocking\)[^\n]*/, 'None: AC1 fixes the hyphen.').replace(/"needsPerson": \[\n[^\n]*\n  \],/, '"needsPerson": [],')],
  ['SN8 only declared in externalEffects', 'SN8', 'spec', true, (t) => t.replace('"externalEffects": []', '"externalEffects": [{"what": "append release note to ../outbox.log after the merge"}]')],
  ['P1 restored, mentioning "expected to fail"', 'P1', 'plan', false, (t) => t.replace('4. Commit step: `E5 T2:', '4. Run `node --test tests/e5-truncate.test.mjs` again: exit 0 (it was expected to fail in step 2).\n5. Commit step: `E5 T2:').replace(/("n": 2,[\s\S]*?)"checks": \[\],/, '$1"checks": [{"cmd": "node --test tests/e5-truncate.test.mjs", "expect": "exit 0"}],')],
  ['P4 kept line + real cases on sub-bullets', 'P4', 'plan', false, (t) => t.replace(/(The test asserts that truncate is a function[^\n]*)\n/, "$1 Then the cases:\n   - `truncate('hello world', 5)` is `'hell\u2026'`; `assert.throws(() => truncate('abc', -1), RangeError)`.\n")],
  ['P4 line reflowed', 'P4', 'plan', true, (t) => t.replace('The test asserts that truncate', 'The test asserts\n   that truncate')],
  // P1 keeps its prose place: with the block broken the prose still shows the missing step, so it reads present.
  ...['P2', 'P6', 'P8'].map((id) => ['fence broken', id, 'plan', null, (t) => t.replace('```json data', '```json')]),
  ['fence broken (prose place still seeded)', 'P1', 'plan', true, (t) => t.replace('```json data', '```json')],
  ['fence broken (P10 prose place still seeded)', 'P10', 'plan', true, (t) => t.replace('```json data', '```json')],
  ...['P2', 'P6', 'P8'].map((id) => ['json reindented only', id, 'plan', true, (t) => { const m = /```json data\n([\s\S]*?)\n```/.exec(t); return t.replace(m[1], () => JSON.stringify(JSON.parse(m[1]), null, 4)); }]),
  ['SN3 reflowed', 'SN3', 'spec', true, (t) => t.replace('Length is measured with `text.length`, so', 'Length is measured\nwith `text.length`, so')],
];

test('E26: native sentinels capture differently-worded fixes and survive reformatting', async () => {
  const native = await import(pathToFileURL(join(here, 'defects', 'sentinels', 'native.mjs')).href);
  const t = tmp('sb');
  try {
    await makeScenario(t.dir, 'completo');
    prepareNativeBranch(t.dir, { withPlan: true });
    const clean = git(t.dir, 'rev-parse', 'HEAD');
    for (const [name, id, cls, want, edit] of NATIVE_PROBES) {
      native.seed(t.dir, id);
      const f = join(t.dir, NATIVE_PATHS[cls]);
      const before = readFileSync(f, 'utf8');
      const after = edit(before);
      assert.notEqual(after, before, name + ': probe edit did not apply');
      writeFileSync(f, after);
      git(t.dir, 'commit', '-q', '-am', 'x');
      assert.equal(native.present(t.dir, 'HEAD', id), want, id + ' ' + name);
      git(t.dir, 'reset', '-q', '--hard', clean);
    }
  } finally {
    t.done();
  }
});
