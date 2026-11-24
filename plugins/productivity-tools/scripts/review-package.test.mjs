import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePackage } from './review-package.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'review-package.mjs');

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

function makeRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'review-package-'));
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'test@example.invalid']);
  git(repo, ['config', 'user.name', 'Test']);
  git(repo, ['config', 'core.autocrlf', 'false']);
  writeFileSync(join(repo, 'a.txt'), 'um\n');
  git(repo, ['add', 'a.txt']);
  git(repo, ['commit', '-q', '-m', 'primeiro commit']);
  writeFileSync(join(repo, 'a.txt'), 'um\ndois\n');
  git(repo, ['commit', '-q', '-am', 'segundo commit']);
  writeFileSync(join(repo, 'b.txt'), 'tres\n');
  git(repo, ['add', 'b.txt']);
  git(repo, ['commit', '-q', '-m', 'terceiro commit']);
  return repo;
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

test('AC4: review-package writes one file with the header and the diff of the range', () => {
  const repo = makeRepo();
  try {
    const out = join(repo, 'nova', 'pasta', 'pacote.md');
    assert.equal(existsSync(join(repo, 'nova')), false);
    const res = run([repo, 'HEAD~2', 'HEAD', out]);
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse(res.stdout);
    assert.equal(json.ok, true);
    assert.equal(json.path, out);
    assert.match(json.base, /^[0-9a-f]{40}$/);
    assert.match(json.tip, /^[0-9a-f]{40}$/);
    assert.equal(json.base, git(repo, ['rev-parse', 'HEAD~2']).trim());
    assert.equal(json.tip, git(repo, ['rev-parse', 'HEAD']).trim());
    assert.equal(json.commits, 2);
    assert.equal(json.bytes, statSync(out).size);
    assert.equal(existsSync(out), true);
    const text = readFileSync(out, 'utf8');
    assert.equal(json.sha256, createHash('sha256').update(readFileSync(out)).digest('hex'));
    assert.equal(json.lines, text.split('\n').length - (text.endsWith('\n') ? 1 : 0));
    const log = git(repo, ['log', '--format=%h %s', `${json.base}..${json.tip}`]);
    for (const line of log.split('\n').filter(Boolean)) {
      assert.ok(text.includes(line), `cabeçalho sem a linha do log: ${line}`);
    }
    assert.ok(text.includes('segundo commit'));
    assert.ok(text.includes('terceiro commit'));
    assert.ok(!text.includes('primeiro commit'));
    const diff = git(repo, ['diff', json.base, json.tip]);
    assert.ok(diff.length > 0);
    assert.ok(text.includes(diff), 'o arquivo deve conter o texto de git diff base tip');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('AC4: review-package refuses an unknown ref and a base that is not an ancestor, writing nothing', () => {
  const repo = makeRepo();
  try {
    const out1 = join(repo, 'nao-criar-1', 'pacote.md');
    const r1 = run([repo, 'ref-que-nao-existe', 'HEAD', out1]);
    assert.equal(r1.status, 1);
    const j1 = JSON.parse(r1.stdout);
    assert.equal(j1.ok, false);
    assert.equal(typeof j1.error, 'string');
    assert.equal(existsSync(join(repo, 'nao-criar-1')), false);

    const out2 = join(repo, 'nao-criar-2', 'pacote.md');
    const r2 = run([repo, 'HEAD', 'HEAD~1', out2]);
    assert.equal(r2.status, 1);
    const j2 = JSON.parse(r2.stdout);
    assert.equal(j2.ok, false);
    assert.equal(typeof j2.error, 'string');
    assert.equal(existsSync(join(repo, 'nao-criar-2')), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('AC4: review-package accepts an empty range', () => {
  const repo = makeRepo();
  try {
    const out = join(repo, 'vazio', 'pacote.md');
    const res = run([repo, 'HEAD', 'HEAD', out]);
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse(res.stdout);
    assert.equal(json.ok, true);
    assert.equal(json.commits, 0);
    const text = readFileSync(out, 'utf8');
    assert.ok(text.length > 0);
    assert.ok(!text.includes('diff --git'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('review-package with fewer than four arguments exits with 2', () => {
  const res = run(['so-um', 'dois', 'tres']);
  assert.equal(res.status, 2);
});

test('writePackage refaz o mkdir e tenta de novo quando o write der ENOENT (pasta apagada por outro prune)', () => {
  const calls = [];
  let failures = 1;
  const io = {
    mkdirSync: (d) => calls.push(['mkdir', d]),
    writeFileSync: (f) => {
      calls.push(['write', f]);
      if (failures-- > 0) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
    },
  };
  writePackage(join('x', 'y', 'p.md'), 'texto', io);
  assert.deepEqual(calls.map((c) => c[0]), ['mkdir', 'write', 'mkdir', 'write']);
  const other = { mkdirSync: () => {}, writeFileSync: () => { throw Object.assign(new Error('perm'), { code: 'EACCES' }); } };
  assert.throws(() => writePackage('p.md', 't', other), { code: 'EACCES' });
  const always = { mkdirSync: () => {}, writeFileSync: () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); } };
  assert.throws(() => writePackage('p.md', 't', always), { code: 'ENOENT' });
});
