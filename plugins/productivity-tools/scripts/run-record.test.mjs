// E23: run-record.mjs grava, le e consulta o registro da execucao (run.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'run-record.mjs');
const DIR = 'docs/plans/x-E9/';
const TRAILER = 'Co-Authored-By: Claude <noreply@anthropic.com>';

const git = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
const rr = (...a) => execFileSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8' });
const payload = (o) => encodeURIComponent(JSON.stringify(o)).replace(/'/g, '%27');

function makeRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'run-record-'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 't@example.com');
  git(repo, 'config', 'user.name', 'T');
  git(repo, 'config', 'commit.gpgsign', 'false');
  mkdirSync(join(repo, DIR), { recursive: true });
  writeFileSync(join(repo, DIR, 'spec.md'), 'spec\n');
  writeFileSync(join(repo, DIR, 'plan.md'), 'plan\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'base');
  return repo;
}
const commitFile = (repo, rel, text) => {
  writeFileSync(join(repo, rel), text);
  git(repo, 'add', rel);
  git(repo, 'commit', '-q', '-m', `edit ${rel}`);
};
const readRun = (repo) => JSON.parse(readFileSync(join(repo, DIR, 'run.json'), 'utf8'));

const PREP = { targetHead: 'abc', gatesKey: 'k1', baseline: { G1: 'ok' } };

test('run-record approve writes run.json and commits only it', () => {
  const repo = makeRepo();
  try {
    const before = git(repo, 'rev-list', '--count', 'HEAD');
    writeFileSync(join(repo, 'loose.txt'), 'x');
    git(repo, 'add', 'loose.txt');
    rr('approve', repo, DIR, 'E9', 'spec,plan', '-', payload({ prep: PREP, trailer: TRAILER }));
    const run = readRun(repo);
    assert.equal(run.schema, 'run/1');
    assert.deepEqual(run.spec, { spec: git(repo, 'rev-parse', `HEAD:${DIR}spec.md`) });
    assert.deepEqual(run.plan, {
      spec: git(repo, 'rev-parse', `HEAD:${DIR}spec.md`),
      plan: git(repo, 'rev-parse', `HEAD:${DIR}plan.md`),
    });
    assert.deepEqual(run.prep, PREP);
    assert.equal(Number(git(repo, 'rev-list', '--count', 'HEAD')), Number(before) + 1);
    assert.match(git(repo, 'log', '-1', '--format=%B'), /^E9: run record \(spec,plan\)/);
    assert.ok(git(repo, 'log', '-1', '--format=%B').includes(TRAILER));
    assert.equal(git(repo, 'show', '--name-only', '--format=', 'HEAD'), `${DIR}run.json`);
    assert.equal(git(repo, 'diff', '--cached', '--name-only'), 'loose.txt');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('run-record approve merges stages and keeps prep', () => {
  const repo = makeRepo();
  try {
    rr('approve', repo, DIR, 'E9', 'spec,plan', '-', payload({ prep: PREP, trailer: TRAILER }));
    rr('approve', repo, DIR, 'E9', 'final', 'tip1', payload({ trailer: TRAILER }));
    const run = readRun(repo);
    const k = JSON.parse(rr('key', repo, DIR));
    assert.deepEqual(run.final, { spec: k.spec, plan: k.plan, tree: k.tree, target: 'tip1' });
    assert.ok(run.spec && run.plan);
    assert.deepEqual(run.prep, PREP);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('run-record key ignores run.json and reviews.md in the tree key', () => {
  const repo = makeRepo();
  try {
    const k0 = JSON.parse(rr('key', repo, DIR));
    assert.equal(k0.recorded, null);
    assert.equal(k0.spec, git(repo, 'rev-parse', `HEAD:${DIR}spec.md`));
    assert.equal(k0.plan, git(repo, 'rev-parse', `HEAD:${DIR}plan.md`));
    commitFile(repo, `${DIR}reviews.md`, 'log\n');
    assert.equal(JSON.parse(rr('key', repo, DIR)).tree, k0.tree);
    rr('approve', repo, DIR, 'E9', 'spec', '-', payload({ trailer: TRAILER }));
    const k1 = JSON.parse(rr('key', repo, DIR));
    assert.equal(k1.tree, k0.tree);
    assert.equal(k1.recorded.schema, 'run/1');
    commitFile(repo, 'other.txt', 'y\n');
    assert.notEqual(JSON.parse(rr('key', repo, DIR)).tree, k0.tree);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('run-record baseline prints the matching prep or exits 1', () => {
  const repo = makeRepo();
  try {
    const branch = git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
    const head = git(repo, 'rev-parse', 'HEAD');
    const prep = { targetHead: '', gatesKey: 'k1', baseline: { G1: 'ok' } };
    // grava com o alvo = ponta atual (a ponta antes do commit do registro)
    prep.targetHead = head;
    rr('approve', repo, DIR, 'E9', 'spec,plan', '-', payload({ prep, trailer: TRAILER }));
    const target = git(repo, 'rev-parse', 'HEAD~1');
    const ok = JSON.parse(rr('baseline', repo, target, 'k1', `${branch}:${DIR}`));
    assert.deepEqual(ok, prep);
    const wrongKey = spawnSync(process.execPath, [SCRIPT, 'baseline', repo, target, 'k2', `${branch}:${DIR}`], { encoding: 'utf8' });
    assert.equal(wrongKey.status, 1);
    assert.equal(wrongKey.stdout, '');
    const wrongTip = spawnSync(process.execPath, [SCRIPT, 'baseline', repo, 'HEAD', 'k1', `${branch}:${DIR}`], { encoding: 'utf8' });
    assert.equal(wrongTip.status, 1);
    assert.equal(wrongTip.stdout, '');
    const bad = spawnSync(process.execPath, [SCRIPT, 'baseline', repo], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.ok(!existsSync(join(repo, 'nope')));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('run-record ignores a hand-committed run.json (key and baseline)', () => {
  const repo = makeRepo();
  try {
    const branch = git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
    const target = git(repo, 'rev-parse', 'HEAD');
    const prep = { targetHead: target, gatesKey: 'k1', baseline: { G1: 'ok' } };
    commitFile(repo, `${DIR}run.json`, `${JSON.stringify({ schema: 'run/1', prep, final: { spec: 'x', plan: 'y', tree: 'z', target } })}\n`);
    assert.equal(JSON.parse(rr('key', repo, DIR)).recorded, null);
    const r = spawnSync(process.execPath, [SCRIPT, 'baseline', repo, target, 'k1', `${branch}:${DIR}`], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    // a legitimate record followed by a hand edit is also refused
    rr('approve', repo, DIR, 'E9', 'spec', '-', payload({ prep, trailer: TRAILER }));
    assert.equal(JSON.parse(rr('key', repo, DIR)).recorded.schema, 'run/1');
    commitFile(repo, `${DIR}run.json`, `${JSON.stringify({ schema: 'run/1', prep })}\n`);
    assert.equal(JSON.parse(rr('key', repo, DIR)).recorded, null);
    // a record-looking subject that also touches other files is refused
    writeFileSync(join(repo, DIR, 'run.json'), `${JSON.stringify({ schema: 'run/1', prep })}\n`);
    writeFileSync(join(repo, 'other.txt'), 'o\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'E9: run record (final)');
    assert.equal(JSON.parse(rr('key', repo, DIR)).recorded, null);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
