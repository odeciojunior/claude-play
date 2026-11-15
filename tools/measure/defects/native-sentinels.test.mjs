import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyTree, runSandboxSuite } from '../make-scenario.mjs';
import { makeSandbox } from '../../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CODE = join(here, '..', 'scenario', 'e5-native', 'code');
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
// C9 replaces C1 on the native code (C1 is accused by the native slugify test, DEC-745); the legacy C1 is untouched.
const IDS = ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
// sha256 (LF text) of the manifest as it was before the native C entries were appended.
const LEGACY_SHA256 = '9846541275be7a2d0b7bfdeceebfaaac55de8ed068441225af01844e26e25bf5';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const entryOf = (id) => manifest.find((e) => e.id === id && e.set === 'e5-native');
const sentinelOf = (id) => import(pathToFileURL(join(here, entryOf(id).sentinel)).href);

// A throwaway repo with the clean native T1..T3 committed on feat/E5.
function cleanRepo() {
  const base = mkdtempSync(join(tmpdir(), 'native-sent-'));
  const dir = join(base, 'sb');
  git(base, 'init', '-q', '-b', 'main', dir);
  for (const [k, v] of [['user.name', 'T'], ['user.email', 't@example.invalid'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) git(dir, 'config', '--local', k, v);
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'feat/E5');
  for (const t of ['t1', 't2', 't3']) copyTree(join(CODE, t), dir);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'E5 T3: clean');
  return { dir, done: () => rmSync(base, { recursive: true, force: true }) };
}

for (const id of IDS) {
  test(`${id} is absent in the clean native code`, async () => {
    const r = cleanRepo();
    try {
      const mod = await sentinelOf(id);
      assert.equal(mod.present(r.dir, 'HEAD', id), false);
    } finally {
      r.done();
    }
  });

  test(`${id} is present after seed`, async () => {
    const r = cleanRepo();
    try {
      const mod = await sentinelOf(id);
      mod.seed(r.dir, id);
      git(r.dir, 'add', '-A');
      git(r.dir, 'commit', '-q', '-m', 'seeded');
      assert.equal(mod.present(r.dir, 'HEAD', id), true);
      assert.equal(mod.present(r.dir, 'HEAD~1', id), false);
      assert.ok(git(r.dir, 'diff', '--name-only', 'HEAD~1', 'HEAD').split('\n').includes(entryOf(id).file));
    } finally {
      r.done();
    }
  });
}

test('C4 extracts helpers from a T3 file without index.mjs', async () => {
  const r = cleanRepo();
  try {
    assert.ok(!existsSync(join(r.dir, 'src', 'index.mjs')));
    const mod = await sentinelOf('C4');
    mod.seed(r.dir, 'C4');
    assert.ok(!existsSync(join(r.dir, 'src', 'index.mjs')));
    assert.ok(existsSync(join(r.dir, 'src', 'helpers.mjs')));
    const t3 = readFileSync(join(r.dir, 'src', 'word-count.mjs'), 'utf8');
    assert.match(t3, /from '\.\/helpers\.mjs'/);
    const { wordCount } = await import(pathToFileURL(join(r.dir, 'src', 'word-count.mjs')).href + '?c4');
    assert.equal(wordCount('a b c'), 3);
  } finally {
    r.done();
  }
});

test('C9 is not accused by the three native test files', async () => {
  const r = cleanRepo();
  try {
    (await sentinelOf('C9')).seed(r.dir, 'C9');
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ['--test', 'tests/e5-slugify.test.mjs', 'tests/e5-truncate.test.mjs', 'tests/e5-word-count.test.mjs'], { cwd: r.dir, env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    r.done();
  }
});

// "Accused" is the sandbox suite going red: a C that code catches is not a reviewer defect (DEC-745).
test('no C is accused on clean code', { skip: process.env.E11_SANDBOX_SUITE !== '1' }, async () => {
  const base = mkdtempSync(join(tmpdir(), 'native-acc-'));
  try {
    const run = async (name, id) => {
      const dir = makeSandbox(join(base, name));
      for (const t of ['t1', 't2', 't3']) copyTree(join(CODE, t), dir);
      if (id) (await sentinelOf(id)).seed(dir, id);
      return runSandboxSuite(dir);
    };
    const clean = await run('clean');
    assert.equal(clean.status, 0, clean.output);
    for (const id of IDS) {
      const r = await run(id);
      assert.equal(r.status, 0, id + ' is accused by the sandbox suite:\n' + r.output);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('manifest entries for e5-native have set, sentinel path and a code class', () => {
  const entries = manifest.filter((e) => e.set === 'e5-native' && e.class === 'code');
  assert.deepEqual(entries.map((e) => e.id), IDS);
  for (const e of entries) {
    assert.equal(e.set, 'e5-native', e.id);
    assert.equal(e.class, 'code', e.id);
    assert.ok(existsSync(join(here, e.sentinel)), e.id + ': sentinel ' + e.sentinel + ' missing');
  }
});

test('legacy manifest entries stay byte for byte and the native ones come last', () => {
  const raw = readFileSync(join(here, 'manifest.json'), 'utf8').replace(/\r\n/g, '\n');
  // The C entries of e5-native start at the first one with set e5-native and class code; everything before is the legacy text.
  const marker = '{\n    "id": "C2",\n    "class": "code",\n    "kind": "assertionless-test",\n    "artifact": "A",\n    "set": "e5-native"';
  const at = raw.indexOf(marker);
  assert.ok(at > 0, 'native C2 entry not found');
  assert.ok(!manifest.some((e) => e.id === 'C1' && e.set === 'e5-native'), 'C1 must not exist in e5-native');
  assert.equal(manifest.find((e) => e.id === 'C9').replaces, 'C1');
  const legacy = raw.slice(0, at).replace(/,\s*$/, '');
  assert.equal(createHash('sha256').update(legacy).digest('hex'), LEGACY_SHA256);
  assert.ok(manifest.slice(-IDS.length).every((e) => e.set === 'e5-native' && e.class === 'code'));
});
