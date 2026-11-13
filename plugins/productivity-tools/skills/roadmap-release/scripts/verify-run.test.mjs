import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { canon, fnv1a } from '../../../lib/plan-digest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'verify-run.mjs');
const NONCE = 'n-1';

const sign = (p) => ({ ...p, digest: fnv1a(JSON.stringify(canon(p))) });
const enc = (obj) => encodeURIComponent(JSON.stringify(obj)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const run = (mode, payload) => {
  const r = spawnSync(process.execPath, [SCRIPT, mode, enc(payload)], { encoding: 'utf8' });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
  return { exit: r.status, stdout: r.stdout, json };
};
const outDigest = (o) => { const { digest, ...rest } = o; return fnv1a(JSON.stringify(canon(rest))) === digest; };

function repo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'vr-')));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git('init', '-q', '-b', 'integ'); git('config', 'user.email', 'a@b.c'); git('config', 'user.name', 'a');
  writeFileSync(join(dir, 'a.txt'), 'a'); git('add', 'a.txt'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  git('checkout', '-qb', 'e1'); writeFileSync(join(dir, 'b.txt'), 'b'); git('add', 'b.txt'); git('commit', '-qm', 'E1 T1: b');
  git('checkout', '-q', 'integ'); git('merge', '-q', '--no-ff', 'e1', '-m', 'merge: E1 in integ');
  const merge = git('rev-parse', 'HEAD');
  return { dir, git, base, merge };
}
const checkPayload = (r, o = {}) => sign({
  nonce: NONCE, repo: r.dir, intwt: r.dir, wtRoot: join(r.dir, 'wt'), target: 'integ', lastGood: r.merge, order: ['E1', 'E2'],
  claims: [{ id: 'E1', commit: r.merge }], reported: [{ id: 'E1', merged: true, broken: false, planOnly: false }, { id: 'E2', merged: false, broken: false, planOnly: false }],
  integBroken: false, ...o,
});

test('E10 AC2: check returns ok on a clean run and lists each divergence', () => {
  const r = repo();
  const ok = run('check', checkPayload(r));
  assert.equal(ok.exit, 0, ok.stdout);
  assert.equal(ok.json.tool, 'verify-run');
  assert.equal(ok.json.mode, 'check');
  assert.equal(ok.json.nonce, NONCE);
  assert.equal(ok.json.ok, true);
  assert.deepEqual(ok.json.divergences, []);
  assert.equal(ok.json.truth.lastGoodReachable, true);
  assert.deepEqual(ok.json.truth.mergedIds, ['E1']);
  assert.deepEqual(ok.json.truth.notMergedIds, ['E2']);
  assert.equal(ok.json.truth.clean, true);
  assert.equal(ok.json.truth.targetHead, r.merge);
  assert.deepEqual(ok.json.truth.claims, [{ id: 'E1', commit: r.merge, reachable: true }]);
  assert.ok(ok.json.truth.worktrees.length >= 1);
  assert.deepEqual(ok.json.truth.strays, []);
  assert.ok(outDigest(ok.json));

  // reported merged without a "merge: <id> in <target>" commit
  const a = run('check', checkPayload(r, { reported: [{ id: 'E1', merged: true }, { id: 'E2', merged: true }] }));
  assert.equal(a.json.ok, false);
  assert.ok(a.json.divergences.some((d) => /^E2: the result says merged, but there is no "merge: E2 in integ"/.test(d)), a.json.divergences.join('|'));
  // claimed commit outside the target
  r.git('checkout', '-q', 'e1'); writeFileSync(join(r.dir, 'c.txt'), 'c'); r.git('add', 'c.txt'); r.git('commit', '-qm', 'E1 T2: c');
  const off = r.git('rev-parse', 'HEAD'); r.git('checkout', '-q', 'integ');
  const b = run('check', checkPayload(r, { claims: [{ id: 'E1', commit: off }] }));
  assert.ok(b.json.divergences.some((d) => d.startsWith('E1: the claimed merge commit ' + off + ' is not on integ')), b.json.divergences.join('|'));
  assert.equal(b.json.truth.claims[0].reachable, false);
  // validated tip that is not an ancestor
  const c = run('check', checkPayload(r, { lastGood: off }));
  assert.equal(c.json.truth.lastGoodReachable, false);
  assert.ok(c.json.divergences.some((d) => d.startsWith('the validated tip claimed by the run (' + off + ') is not confirmed as an ancestor of integ')));
  // dirty target
  writeFileSync(join(r.dir, 'dirty.txt'), 'x');
  const d = run('check', checkPayload(r));
  assert.equal(d.json.truth.clean, false);
  assert.ok(d.json.divergences.some((x) => x === 'the target integ has uncommitted files'));
  assert.equal(run('check', checkPayload(r, { integBroken: true })).json.ok, true);
});

test('E10 AC2: check lists a stray file loose in the worktree root', () => {
  const r = repo();
  const wt = join(r.dir, 'wt'); mkdirSync(join(wt, '_tmp'), { recursive: true }); writeFileSync(join(wt, 'loose.txt'), 'x');
  const o = run('check', checkPayload(r, { wtRoot: wt }));
  assert.deepEqual(o.json.truth.strays, ['loose.txt']);
});

test('E10 AC3: a group of three whose second fails skips the third, runs finally and returns each result', () => {
  const r = repo();
  const cli = JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0, huge: 'x'.repeat(5000) }, errors: [], result: { id: 'BLQ-1', big: 'y'.repeat(5000) }, changed: ['a'], other: 'z' });
  writeFileSync(join(r.dir, 'cli.json'), cli);
  const steps = [
    'node -e "require(\'fs\').writeFileSync(\'w1.txt\',\'1\'); process.stdout.write(require(\'fs\').readFileSync(\'cli.json\',\'utf8\'))"',
    'node -e "process.stdout.write(\'q\'.repeat(3000)); process.exit(1)"',
    'node -e "require(\'fs\').writeFileSync(\'w3.txt\',\'3\')"',
  ];
  const o = run('group', sign({ nonce: NONCE, cwd: r.dir, steps, finally: { commit: { add: ['w1.txt'], message: ['E1 record', 'Co-Authored-By: X'] } } }));
  assert.equal(o.exit, 0, o.stdout);
  assert.equal(o.json.tool, 'verify-run');
  assert.equal(o.json.mode, 'group');
  assert.equal(o.json.nonce, NONCE);
  assert.deepEqual(o.json.stopped, { n: 2, exit: 1 });
  assert.equal(o.json.steps.length, 2);
  assert.deepEqual(o.json.steps.map((s) => [s.n, s.exit]), [[1, 0], [2, 1]]);
  const red = JSON.parse(o.json.steps[0].out);
  assert.deepEqual(red, { tool: 'roadmap', summary: { exitCode: 0 }, errors: [], result: { id: 'BLQ-1' }, changed: ['a'] });
  assert.equal(o.json.steps[1].out.length, 2000);
  assert.equal(existsSync(join(r.dir, 'w3.txt')), false);
  assert.equal(existsSync(join(r.dir, 'w1.txt')), true);
  assert.equal(o.json.commit, true);
  assert.equal(o.json.head, r.git('rev-parse', 'HEAD'));
  assert.equal(r.git('log', '-1', '--format=%s'), 'E1 record');
  assert.match(r.git('log', '-1', '--format=%b'), /Co-Authored-By: X/);
  assert.ok(outDigest(o.json));
});

test('E10 AC3: a group with nothing to commit and no stop reports commit false and stopped null', () => {
  const r = repo();
  const o = run('group', sign({ nonce: NONCE, cwd: r.dir, steps: ['git status --porcelain'], finally: { commit: { add: ['a.txt'], message: ['m'] } } }));
  assert.equal(o.json.stopped, null);
  assert.equal(o.json.commit, false);
  assert.equal(o.json.head, r.merge);
  const n = run('group', sign({ nonce: NONCE, cwd: r.dir, steps: ['node -e "process.stdout.write(\'hi\')"'], finally: null }));
  assert.equal(n.json.steps[0].out, 'hi');
  assert.equal(n.json.commit, false);
});

test('E10 AC3: the tokenizer handles quotes and refuses shell metacharacters and other programs without running', () => {
  const r = repo();
  const q = run('group', sign({ nonce: NONCE, cwd: r.dir, steps: [`node -e 'process.stdout.write("a b;c")'`, `node -e "process.stdout.write(\\"x\\" + 'it' )"`, `node -e 'process.stdout.write("it'\\''s")'`], finally: null }));
  assert.deepEqual(q.json.steps.map((s) => s.out), ['a b;c', 'xit', "it's"]);
  for (const bad of ['node -e "1" | cat', 'node -e 1; node -e 2', 'node -e 1 && node -e 2', 'node -e "$(echo 1)"', 'node -e `echo 1`', 'node -e 1 > f.txt', 'rm -rf x', 'echo hi', 'node -e "$HOME"']) {
    const o = run('group', sign({ nonce: NONCE, cwd: r.dir, steps: ['node -e "require(\'fs\').writeFileSync(\'ran.txt\',\'1\')"', bad], finally: null }));
    assert.equal(o.exit, 2, bad);
    assert.equal(existsSync(join(r.dir, 'ran.txt')), false, 'nothing runs when a step is refused: ' + bad);
    assert.ok(o.json.error, bad);
  }
});

test('E10 AC3: a payload with a wrong digest exits 2 and runs nothing, in both subcommands', () => {
  const r = repo();
  const g = sign({ nonce: NONCE, cwd: r.dir, steps: ['node -e "require(\'fs\').writeFileSync(\'ran.txt\',\'1\')"'], finally: null });
  const gBad = run('group', { ...g, steps: ['node -e "require(\'fs\').writeFileSync(\'ran.txt\',\'2\')"'] });
  assert.equal(gBad.exit, 2);
  assert.equal(existsSync(join(r.dir, 'ran.txt')), false);
  assert.match(gBad.json.error, /digest/);
  const cBad = run('check', { ...checkPayload(r), target: 'other' });
  assert.equal(cBad.exit, 2);
  assert.match(cBad.json.error, /digest/);
  assert.equal(run('group', { ...g, digest: undefined }).exit, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, 'group', '%E0%A4%A'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, 'nope', 'x'], { encoding: 'utf8' }).status, 2);
});
