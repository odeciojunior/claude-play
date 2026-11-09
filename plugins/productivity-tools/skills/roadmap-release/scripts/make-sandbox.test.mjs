import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const make = join(here, 'make-sandbox.mjs');
const checker = join(here, '..', '..', 'roadmap-tracker', 'scripts', 'check-roadmap.mjs');
const preflight = join(here, 'preflight.mjs');

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function withTemp(fn) {
  const root = mkdtempSync(join(tmpdir(), 'sandbox-test-'));
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('generates a valid disposable repo', () => withTemp((root) => {
  const dir = join(root, 'repo');
  const r = spawnSync(process.execPath, [make, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const folder = join(dir, 'docs', 'plans', 'roadmap-sandbox');

  const chk = spawnSync(process.execPath, [join(folder, 'check-roadmap.mjs')], { encoding: 'utf8', cwd: dir });
  assert.equal(chk.status, 0, chk.stdout + chk.stderr);
  const chk2 = spawnSync(process.execPath, [checker, folder], { encoding: 'utf8', cwd: dir });
  assert.equal(chk2.status, 0, chk2.stdout + chk2.stderr);

  const pf = spawnSync(process.execPath, [preflight, folder], { encoding: 'utf8', cwd: dir });
  const out = JSON.parse(pf.stdout);
  assert.deepEqual(out.errors, []);
  assert.equal(out.generated, false);
  assert.ok(out.config.gates.length >= 1);
  assert.deepEqual(out.config.locks, ['sandbox-port']);
  assert.equal(out.config.generated, undefined);

  assert.equal(git(dir, 'status', '--porcelain'), '');
  assert.equal(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  assert.equal(git(dir, 'rev-list', '--count', 'HEAD'), '1');
  assert.equal(git(dir, 'remote'), '');
  assert.ok(git(dir, 'config', '--local', 'user.email'));

  const rc = JSON.parse(readFileSync(join(folder, 'roadmap.config.json'), 'utf8'));
  assert.equal(rc.integrationBranch, 'main');
  assert.notEqual(rc.releaseBranch, 'main');

  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  // baseline gate is green with at least one real test
  const t = spawnSync(process.execPath, ['--test'], { cwd: dir, encoding: 'utf8', env });
  assert.equal(t.status, 0, t.stdout + t.stderr);
  assert.match(t.stdout, /# pass [1-9]/);
}));

test('refuses a non-empty directory and leaves it untouched', () => withTemp((root) => {
  const dir = join(root, 'full');
  mkdirSync(dir);
  writeFileSync(join(dir, 'keep.txt'), 'x');
  const r = spawnSync(process.execPath, [make, dir], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /not empty/i);
  assert.equal(existsSync(join(dir, '.git')), false);
  assert.equal(readFileSync(join(dir, 'keep.txt'), 'utf8'), 'x');
}));

test('requires a directory argument', () => {
  const r = spawnSync(process.execPath, [make], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});
