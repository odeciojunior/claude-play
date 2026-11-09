import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8');
const mark = 'TEST_INTEGRITY_DEFAULT = String.raw`';
const a = src.indexOf(mark) + mark.length;
const script = src.slice(a, src.indexOf('`', a));

test('default integrity script counts root-level tests/ dirs and test_*.py as tests', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ti-'));
  const git = (...x) => execFileSync('git', x, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'a@b.c'); git('config', 'user.name', 'a');
  mkdirSync(join(dir, 'tests')); mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'tests', 'a.js'), 'expect(1)\n');
  writeFileSync(join(dir, 'test_foo.py'), 'assert x\n');
  writeFileSync(join(dir, 'src', 'x.js'), 'x\n');
  git('add', '-A'); git('commit', '-qm', 'base');
  git('checkout', '-qb', 'feat');
  git('rm', '-q', 'tests/a.js', 'test_foo.py');
  git('commit', '-qm', 'rm');
  const f = join(tmpdir(), 'ti-script-' + process.pid + '.cjs'); writeFileSync(f, script);
  const out = JSON.parse(execFileSync('node', [f, 'main'], { cwd: dir, encoding: 'utf8' }));
  assert.deepEqual(out.deletedTests.sort(), ['test_foo.py', 'tests/a.js']);
});
