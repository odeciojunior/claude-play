import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { STOP_RESUME } from './make-sandbox.mjs';

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

test('sandbox: E4 declares the external delivery step and the folder still passes the checker', () => withTemp((root) => {
  const dir = join(root, 'repo');
  const r = spawnSync(process.execPath, [make, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const folder = join(dir, 'docs', 'plans', 'roadmap-sandbox');
  const chk = spawnSync(process.execPath, [join(folder, 'check-roadmap.mjs')], { encoding: 'utf8', cwd: dir });
  assert.equal(chk.status, 0, chk.stdout + chk.stderr);
  assert.doesNotMatch(chk.stdout, /\b[1-9]\d* error/i);
  const strategy = readFileSync(join(folder, 'strategy.md'), 'utf8');
  assert.match(strategy, /id=E4 [^>]*depends=- reqs=REQ-004/);
  assert.ok(strategy.includes('../outbox.log'));
  assert.ok(strategy.includes('E4 published'));
  assert.ok(strategy.includes('{verify: test; evidence: node --test tests/e4.test.mjs}'));
  assert.match(readFileSync(join(folder, 'requirements.md'), 'utf8'), /REQ-004/);
  assert.match(readFileSync(join(folder, 'state.md'), 'utf8'), /\| E4 \|/);
  const pf = spawnSync(process.execPath, [preflight, folder], { encoding: 'utf8', cwd: dir });
  assert.deepEqual(JSON.parse(pf.stdout).errors, []);
}));

test('sandbox: E5 has more than one piece and criterion, and the folder passes checker and preflight', () => withTemp((root) => {
  const dir = join(root, 'repo');
  const r = spawnSync(process.execPath, [make, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const folder = join(dir, 'docs', 'plans', 'roadmap-sandbox');
  const strategy = readFileSync(join(folder, 'strategy.md'), 'utf8');
  assert.match(strategy, /id=E5 [^>]*depends=- reqs=REQ-005/);
  const start = strategy.indexOf('<!-- roadmap:card id=E5 ');
  assert.ok(start >= 0);
  const end = strategy.indexOf('<!-- /roadmap:card -->', start);
  const card = strategy.slice(start, end);
  assert.ok(card.split('\n').filter((l) => l.startsWith('- Piece')).length >= 2);
  assert.ok(card.split('\n').filter((l) => l.includes('{verify: test; evidence: node --test tests/e5-')).length >= 2);
  const chk = spawnSync(process.execPath, [join(folder, 'check-roadmap.mjs')], { encoding: 'utf8', cwd: dir });
  assert.equal(chk.status, 0, chk.stdout + chk.stderr);
  assert.doesNotMatch(chk.stdout, /\b[1-9]\d* error/i);
  const pf = spawnSync(process.execPath, [preflight, folder], { encoding: 'utf8', cwd: dir });
  assert.deepEqual(JSON.parse(pf.stdout).errors, []);
}));

test('sandbox: the stop and resume script names a deliverable of the panel', () => withTemp((root) => {
  const dir = join(root, 'repo');
  const r = spawnSync(process.execPath, [make, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const file = join(dir, 'scenario', 'stop-resume.json');
  assert.ok(existsSync(file));
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), STOP_RESUME);
  const folder = join(dir, 'docs', 'plans', 'roadmap-sandbox');
  assert.match(readFileSync(join(folder, 'state.md'), 'utf8'), new RegExp('\| ' + STOP_RESUME.deliverable + ' \|'));
  assert.equal(file.includes(join('docs', 'plans', 'roadmap-sandbox')), false);
  assert.equal(git(dir, 'status', '--porcelain'), '');
  assert.equal(git(dir, 'rev-list', '--count', 'HEAD'), '1');
}));

test('sandbox: E1 to E4 are unchanged', () => withTemp((root) => {
  const dir = join(root, 'repo');
  const r = spawnSync(process.execPath, [make, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const folder = join(dir, 'docs', 'plans', 'roadmap-sandbox');
  const strategy = readFileSync(join(folder, 'strategy.md'), 'utf8');
  for (const n of ['e1', 'e2', 'e3', 'e4']) assert.ok(strategy.includes(`{verify: test; evidence: node --test tests/${n}.test.mjs}`), n);
  assert.ok(strategy.includes('{verify: test; evidence: node -e "process.exit(1)"}'));
  const dec = readFileSync(join(folder, 'decisions.md'), 'utf8');
  assert.ok(dec.includes('| DEC-001 | 2026-11-09 | E3 | E3 keeps one acceptance criterion that cannot pass, to exercise the operator-action path | Make every criterion satisfiable | - | The sandbox is retired | SRC-01 | in-force |'));
}));
