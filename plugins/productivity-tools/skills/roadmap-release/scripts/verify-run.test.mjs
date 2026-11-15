import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, realpathSync, readFileSync, utimesSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
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
  const n = run('group', sign({ nonce: 'n-2', cwd: r.dir, steps: ['node -e "process.stdout.write(\'hi\')"'], finally: null }));
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

// ---- read: the signed read-back of a roadmap record (replaces the haiku copy of five stdouts)
const TRACKER = join(HERE, '..', '..', 'roadmap-tracker', 'scripts');
const CLI = join(TRACKER, 'roadmap.mjs');
const FIXTURE = join(TRACKER, 'fixtures', 'valid');
const readPayload = (r, o = {}) => sign({ nonce: 'rd-1', cwd: r.dir, cli: CLI, folder: FIXTURE, deliverable: 'E1', ...o });

test('read: signed output with the panel row, checker, pending ids, head and clean flag', () => {
  const r = repo();
  const o = run('read', readPayload(r));
  assert.equal(o.exit, 0, o.stdout);
  assert.equal(o.json.tool, 'verify-run');
  assert.equal(o.json.mode, 'read');
  assert.equal(o.json.nonce, 'rd-1');
  assert.ok(outDigest(o.json));
  assert.deepEqual(o.json.exits, { status: 0, brief: 0, pendingDecisions: 0, head: 0, porcelain: 0 });
  assert.equal(o.json.status.result.panel.length, 1);
  assert.equal(o.json.status.result.panel[0].id, 'E1');
  assert.equal(o.json.status.result.panel[0].segments[0].word, 'spec');
  assert.equal(o.json.status.summary.exitCode, 0);
  assert.equal(o.json.brief.result.checker.errors, 0);
  assert.equal(typeof o.json.brief.result.checker.warnings, 'number');
  assert.deepEqual(o.json.pendingDecisions.result.decisions, []);
  assert.equal(o.json.head, r.merge);
  assert.equal(o.json.porcelain, '');
  assert.equal(o.json.clean, true);
  assert.ok(o.stdout.length < 8000, String(o.stdout.length));
});

test('read: never writes; a dirty tree shows in porcelain and clean=false; a bad CLI becomes null with its exit code', () => {
  const r = repo();
  writeFileSync(join(r.dir, 'dirty.txt'), 'x');
  const before = r.git('status', '--porcelain');
  const o = run('read', readPayload(r));
  assert.equal(r.git('status', '--porcelain'), before);
  assert.equal(o.json.clean, false);
  assert.match(o.json.porcelain, /dirty\.txt/);
  const bad = run('read', readPayload(r, { folder: join(r.dir, 'nope') }));
  assert.equal(bad.exit, 0);
  assert.equal(bad.json.status, null);
  assert.equal(bad.json.brief, null);
  assert.notEqual(bad.json.exits.status, 0);
  const noGit = run('read', readPayload(r, { cwd: tmpdir() }));
  assert.equal(noGit.json.head, '');
});

test('read: refuses a wrong digest, a missing field and an option-like deliverable, running nothing', () => {
  const r = repo();
  assert.match(run('read', { ...readPayload(r), deliverable: 'E2' }).json.error, /digest/);
  assert.equal(run('read', readPayload(r, { cli: undefined })).exit, 2);
  assert.equal(run('read', readPayload(r, { deliverable: '--json' })).exit, 2);
});

test('read: a huge CLI answer is cut so the output stays under 8000 characters, with the counts kept', async () => {
  const { buildRead } = await import('./verify-run.mjs');
  const cliOut = (result) => ({ exit: 0, stdout: JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, result }) });
  const long = 'x'.repeat(5000);
  const codes = Array.from({ length: 500 }, (_, i) => 'code-' + long.slice(0, 80) + i);
  const d = buildRead({
    status: cliOut({ panel: [{ id: 'E1', segments: Array.from({ length: 40 }, (_, i) => ({ label: i === 39 ? 'code' : long, word: long, note: long + Array.from({ length: 12 }, (_, k) => ` BLQ-${k}${'9'.repeat(k < 6 ? 2 : 40)}`).join('') + (i === 39 ? ' BLQ-7' : '') })), evidence: long, next: long }] }),
    brief: cliOut({ checker: { folder: long, plugin: '1', stale: false, errors: 300, warnings: 300, errorCodes: codes, warningCodes: codes } }),
    pending: cliOut({ decisions: Array.from({ length: 1000 }, (_, i) => ({ id: 'DEC-' + (100000 + i) })) }),
    head: { exit: 0, stdout: 'a'.repeat(40) + '\n' },
    porcelain: { exit: 0, stdout: Array.from({ length: 300 }, (_, i) => ` M ${long}${i}`).join('\n') },
  }, 'E1', 'code');
  const text = JSON.stringify({ tool: 'verify-run', mode: 'read', nonce: 'n'.repeat(80), ...d, digest: 'd'.repeat(8) });
  assert.ok(text.length < 8000, String(text.length));
  const segsOut = d.status.result.panel[0].segments;
  assert.ok(segsOut.length <= 4, String(segsOut.length));
  const code = segsOut.find((x) => x.label === 'code');
  assert.ok(code, 'the piece segment stays within the cap of 4');
  assert.ok(code.blqIds.length <= 5 && code.blqIds.every((x) => x.length <= 20), JSON.stringify(code.blqIds));
  assert.ok(code.blqIds.includes('BLQ-099'), 'a BLQ id of the piece is found');
  assert.equal(d.brief.result.checker.errors, 300);
  assert.equal(d.pendingDecisions.result.total, 1000);
  assert.equal(d.clean, false);
  assert.match(d.porcelain, /\[\+\d+ lines cut\]$/);
});

// Every cap filled: 100 pending ids of 20 chars, a 64-char head, 20 porcelain lines of 100 chars, the piece at segment 39, 5 BLQ ids of 20 chars in every note.
const maxRead = async ({ porcelain = true, nonce = 'n'.repeat(80) } = {}) => {
  const { buildRead } = await import('./verify-run.mjs');
  const cliOut = (result) => ({ exit: 0, stdout: JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, result }) });
  const long = 'x'.repeat(5000);
  const blqs = Array.from({ length: 5 }, (_, k) => ' BLQ-' + String(k).repeat(16)).join('');
  const ids = Array.from({ length: 100 }, (_, i) => 'DEC-' + String(1e15 + i));
  const segs = Array.from({ length: 40 }, (_, i) => ({ label: i === 39 ? 'code' : long, word: i === 39 ? 'plano' : long, note: long + blqs }));
  const d = buildRead({
    status: cliOut({ panel: [{ id: 'E1', segments: segs, evidence: long, next: long }] }),
    brief: cliOut({ checker: { folder: long, plugin: '1', stale: false, errors: 0, warnings: 300, errorCodes: [], warningCodes: Array.from({ length: 50 }, () => long) } }),
    pending: cliOut({ decisions: ids.map((id) => ({ id })) }),
    head: { exit: 0, stdout: 'a'.repeat(64) + '\n' },
    porcelain: { exit: 0, stdout: porcelain ? Array.from({ length: 300 }, (_, i) => ` M ${long}${i}`).join('\n') : '' },
  }, 'E1', 'code', nonce);
  const text = JSON.stringify({ tool: 'verify-run', mode: 'read', nonce, ...d, digest: 'd'.repeat(8) });
  return { d, text, ids };
};

test('read: with every cap filled the output (envelope included) stays under 8000 and keeps the piece, its blqIds, head, exits and error count', async () => {
  const { d, text } = await maxRead();
  assert.ok(text.length < 8000, String(text.length));
  const code = d.status.result.panel[0].segments.find((x) => x.label === 'code');
  assert.ok(code, 'the piece segment stays');
  assert.equal(code.blqIds.length, 5);
  assert.equal(d.head, 'a'.repeat(64));
  assert.equal(d.exits.porcelain, 0);
  assert.equal(d.brief.result.checker.errors, 0);
  assert.equal(d.clean, false, 'clean comes from the full porcelain');
  assert.ok(d.porcelain.startsWith(' M x'), 'the first porcelain line stays');
  assert.match(d.porcelain, /\[\+\d+ lines cut\]$/);
  assert.equal(d.pendingDecisions.result.total, 100);
});

test('read: a long nonce makes the budget drop the OLDEST pending ids and cut notes; total stays and recordVerdict accepts the newest written id', async () => {
  const { loadPure } = await import('../workflow/load-pure.mjs');
  const PU = loadPure();
  for (const nonce of ['n'.repeat(80), 'n'.repeat(2000), 'n'.repeat(3500)]) {
    const { d, text, ids } = await maxRead({ porcelain: false, nonce });
    assert.ok(text.length < 8000, `${nonce.length}: ${text.length}`);
    const list = d.pendingDecisions.result.decisions.map((x) => x.id);
    assert.equal(d.pendingDecisions.result.total, 100);
    assert.equal(list[list.length - 1], ids[99], 'the newest stays');
    if (nonce.length > 80) assert.ok(list.length < 100, 'oldest dropped');
    const code = d.status.result.panel[0].segments.find((x) => x.label === 'code');
    assert.ok(code && code.blqIds.length === 5);
    const ok = (cmd, result) => JSON.stringify({ tool: 'roadmap', command: cmd, changed: ['state.md'], result, errors: [], summary: { exitCode: 0 } });
    const expected = ['node "cli" set-status f E1 code plano', 'node "cli" add-decision f x'];
    const results = { runs: [{ n: 1, exit: 0, stdout: ok('set-status', {}) }, { n: 2, exit: 0, stdout: ok('add-decision', { id: ids[99], existing: false }) }] };
    const v = PU.recordVerdict({ expected, results, read: { ...d }, E: 'E1', word: 'plano', piece: 'code', blockedStatus: 'bloqueado' });
    assert.ok(v.ok, v.failures.join('; '));
  }
});

test('read: with 101 pending decisions the NEWEST 100 stay, the total says 101', async () => {
  const { buildRead } = await import('./verify-run.mjs');
  const cliOut = (result) => ({ exit: 0, stdout: JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, result }) });
  const d = buildRead({ status: cliOut({ panel: [] }), brief: cliOut({ checker: { errors: 0, warnings: 0 } }), pending: cliOut({ decisions: Array.from({ length: 101 }, (_, i) => ({ id: 'DEC-' + (100 + i) })) }),
    head: { exit: 0, stdout: 'h\n' }, porcelain: { exit: 0, stdout: '' } }, 'E1');
  const ids = d.pendingDecisions.result.decisions.map((x) => x.id);
  assert.equal(ids.length, 100);
  assert.equal(d.pendingDecisions.result.total, 101);
  assert.ok(ids.includes('DEC-200'), 'the newest stays');
  assert.ok(!ids.includes('DEC-100'), 'the oldest goes');
});

test('read: the first porcelain line keeps its leading space; the BLQ id is searched in the full note and the piece segment is not cut', async () => {
  const { buildRead } = await import('./verify-run.mjs');
  const cliOut = (result) => ({ exit: 0, stdout: JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, result }) });
  const seg = (label, note) => ({ label, word: 'bloqueado', note });
  const segs = [seg('a', 'x'), seg('b', 'x'), seg('c', 'x'), seg('d', 'x'), seg('code', 'y'.repeat(600) + ' blocked by BLQ-7')];
  const mk = (piece) => buildRead({ status: cliOut({ panel: [{ id: 'E1', segments: segs }] }), brief: cliOut({ checker: { errors: 0, warnings: 0 } }), pending: cliOut({ decisions: [] }),
    head: { exit: 0, stdout: 'h\n' }, porcelain: { exit: 0, stdout: ' M docs/a.md\n?? b.txt\n' } }, 'E1', piece);
  const d = mk('code');
  assert.equal(d.porcelain.split('\n')[0], ' M docs/a.md');
  const row = d.status.result.panel[0];
  const code = row.segments.find((x) => x.label === 'code');
  assert.ok(code, 'the piece segment is kept within the cap of 4');
  assert.ok(code.note.length <= 203, 'the piece note is cut like the others; blqIds covers the BLQ check');
  assert.ok(row.segments.every((x) => Array.isArray(x.blqIds)));
  assert.deepEqual(code.blqIds, ['BLQ-7']);
  assert.deepEqual(mk(undefined).status.result.panel[0].segments[0].blqIds, []);
});

test('read: git runs with --no-optional-locks (the read never touches the index)', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  assert.match(src, /'--no-optional-locks', 'status', '--porcelain'/);
});

// ---- DEC-714: the group is idempotent by nonce (a marker in the git dir of the payload cwd)
const counterStep = (file) => `node -e "require('fs').appendFileSync('${file.split('\\').join('/')}','x')"`;
const markerDir = (r) => join(r.git('rev-parse', '--absolute-git-dir'), 'verify-run');
const markerFile = (r, nonce = NONCE) => join(markerDir(r), fnv1a(nonce) + '.json');
const groupPayload = (r, steps, o = {}) => sign({ nonce: NONCE, cwd: r.dir, steps, finally: null, ...o });

test('DEC-714: the same group twice runs its steps once and prints the same output', () => {
  const r = repo();
  const side = join(realpathSync(mkdtempSync(join(tmpdir(), 'vr-side-'))), 'count.txt');
  const p = groupPayload(r, [counterStep(side)]);
  const a = run('group', p);
  const b = run('group', p);
  assert.equal(a.exit, 0, a.stdout);
  assert.equal(readFileSync(side, 'utf8'), 'x', 'the step ran once');
  assert.equal(b.exit, 0);
  assert.equal(b.stdout, a.stdout, 'byte-identical');
  assert.ok(outDigest(b.json));
  const m = JSON.parse(readFileSync(markerFile(r), 'utf8'));
  assert.equal(m.nonce, NONCE);
  assert.equal(m.digest, p.digest);
  assert.equal(m.output, a.stdout);
});

test('DEC-714: a stopped group is also replayed, not rerun', () => {
  const r = repo();
  const side = join(realpathSync(mkdtempSync(join(tmpdir(), 'vr-side-'))), 'count.txt');
  const p = groupPayload(r, [counterStep(side), 'node -e "process.exit(3)"']);
  const a = run('group', p);
  const b = run('group', p);
  assert.deepEqual(a.json.stopped, { n: 2, exit: 3 });
  assert.equal(b.stdout, a.stdout);
  assert.equal(readFileSync(side, 'utf8'), 'x');
});

test('DEC-714: the same nonce with another digest is refused and runs nothing', () => {
  const r = repo();
  const side = join(realpathSync(mkdtempSync(join(tmpdir(), 'vr-side-'))), 'count.txt');
  run('group', groupPayload(r, [counterStep(side)]));
  const o = run('group', groupPayload(r, [counterStep(side), counterStep(side)]));
  assert.equal(o.exit, 2);
  assert.equal(o.json.tool, 'verify-run');
  assert.ok(o.json.error);
  assert.equal(readFileSync(side, 'utf8'), 'x');
});

test('DEC-714: a marker without output (the process died mid-run) is refused and runs nothing', () => {
  const r = repo();
  const side = join(realpathSync(mkdtempSync(join(tmpdir(), 'vr-side-'))), 'count.txt');
  const p = groupPayload(r, [counterStep(side)]);
  mkdirSync(markerDir(r), { recursive: true });
  writeFileSync(markerFile(r), JSON.stringify({ nonce: NONCE, digest: p.digest }));
  const o = run('group', p);
  assert.equal(o.exit, 2);
  assert.ok(o.json.error);
  assert.equal(existsSync(side), false);
});

test('DEC-714: a marker that cannot be written refuses and runs nothing', () => {
  const r = repo();
  const side = join(realpathSync(mkdtempSync(join(tmpdir(), 'vr-side-'))), 'count.txt');
  writeFileSync(markerDir(r), 'a file where the folder should be');
  const o = run('group', groupPayload(r, [counterStep(side)]));
  assert.equal(o.exit, 2);
  assert.ok(o.json.error);
  assert.equal(existsSync(side), false);
});

test('DEC-714: the worktree stays clean after a group (the marker lives in the git dir)', () => {
  const r = repo();
  run('group', groupPayload(r, ['git status --porcelain']));
  assert.equal(existsSync(markerFile(r)), true);
  assert.equal(r.git('status', '--porcelain'), '');
});

test('DEC-714: markers older than 7 days are pruned at start, newer ones stay', () => {
  const r = repo();
  mkdirSync(markerDir(r), { recursive: true });
  const old = join(markerDir(r), 'old.json'), fresh = join(markerDir(r), 'fresh.json');
  writeFileSync(old, '{}'); writeFileSync(fresh, '{}');
  const t = (Date.now() - 8 * 86400000) / 1000;
  utimesSync(old, t, t);
  const o = run('group', groupPayload(r, ['git status --porcelain']));
  assert.equal(o.exit, 0, o.stdout);
  assert.equal(existsSync(old), false);
  assert.equal(existsSync(fresh), true);
});

// ---- DEC-714 review: nonce in late refusals, atomic output, live pid, marker removed on a refused step
const runEnv = (payload, env) => {
  const r = spawnSync(process.execPath, [SCRIPT, 'group', enc(payload)], { encoding: 'utf8', env: { ...process.env, ...env } });
  let json = null; try { json = JSON.parse(r.stdout); } catch { /* */ }
  return { exit: r.status, stdout: r.stdout, json };
};
test('DEC-714: refusals after the digest check carry the nonce, the ones before it do not', () => {
  const r = repo();
  const sideless = 'node -e "1"';
  const pre = run('group', { ...groupPayload(r, [sideless]), steps: ['node -e "2"'] });
  assert.equal(pre.exit, 2);
  assert.equal(pre.json.nonce, undefined);
  const bad = run('group', groupPayload(r, [sideless, 'echo hi']));
  assert.equal(bad.json.nonce, NONCE, 'tokenize refusal');
  const missing = run('group', sign({ nonce: NONCE, cwd: r.dir, steps: 'x' }));
  assert.equal(missing.json.nonce, NONCE, 'missing field');
  const p = groupPayload(r, [sideless], { nonce: 'n-m' });
  run('group', p);
  const other = run('group', groupPayload(r, [sideless, sideless], { nonce: 'n-m' }));
  assert.equal(other.json.nonce, 'n-m', 'marker refusal');
});

test('DEC-714: the replay reads complete JSON and no temp file is left', () => {
  const r = repo();
  const o = run('group', groupPayload(r, ['git status --porcelain']));
  assert.equal(JSON.parse(readFileSync(markerFile(r), 'utf8')).output, o.stdout);
  assert.deepEqual(readdirSync(markerDir(r)).filter((f) => !f.endsWith('.json')), []);
});

test('DEC-714: a tokenize refusal removes the marker (nothing started)', () => {
  const r = repo();
  const o = run('group', groupPayload(r, ['echo hi']));
  assert.equal(o.exit, 2);
  assert.equal(existsSync(markerFile(r)), false);
});

test('DEC-714: marker without output and a dead pid is refused at once', () => {
  const r = repo();
  const p = groupPayload(r, ['git status --porcelain']);
  const dead = spawnSync(process.execPath, ['-e', '0']);
  mkdirSync(markerDir(r), { recursive: true });
  writeFileSync(markerFile(r), JSON.stringify({ nonce: NONCE, digest: p.digest, pid: 2 ** 22 + 12345 }));
  const t = Date.now();
  const o = runEnv(p, { VERIFY_RUN_WAIT_MS: '20000' });
  assert.equal(o.exit, 2);
  assert.ok(Date.now() - t < 10000);
  assert.ok(dead);
});

test('DEC-714: a live pid without output is waited for, then the output is replayed', async () => {
  const r = repo();
  const p = groupPayload(r, ['git status --porcelain']);
  const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{},20000)']);
  try {
    mkdirSync(markerDir(r), { recursive: true });
    writeFileSync(markerFile(r), JSON.stringify({ nonce: NONCE, digest: p.digest, pid: child.pid }));
    const output = '{"tool":"verify-run","mode":"group","done":true}\n';
    setTimeout(() => writeFileSync(markerFile(r), JSON.stringify({ nonce: NONCE, digest: p.digest, pid: child.pid, output })), 1500);
    const o = await new Promise((res) => { const c = spawn(process.execPath, [SCRIPT, 'group', enc(p)], { env: { ...process.env, VERIFY_RUN_WAIT_MS: '15000' } }); let s = ''; c.stdout.on('data', (d) => { s += d; }); c.on('close', (code) => res({ code, s })); });
    assert.equal(o.s, output);
    // never finishing: refused after the bound
    writeFileSync(markerFile(r), JSON.stringify({ nonce: NONCE, digest: p.digest, pid: child.pid }));
    const t = Date.now();
    const late = runEnv(p, { VERIFY_RUN_WAIT_MS: '1200' });
    assert.equal(late.exit, 2);
    assert.ok(Date.now() - t >= 1000);
  } finally { child.kill(); }
});

// ---- E32: procs mode (list and end the processes of a deliverable) ----

test('E32 procs: parsers read fixed outputs', async () => {
  const { parseCimProcs, parsePs, parseNetstatListen, parseLsofListen } = await import('./verify-run.mjs');
  assert.deepEqual(parseCimProcs('{"ProcessId":10,"ParentProcessId":4,"CommandLine":null}'), [{ pid: 10, ppid: 4, cmd: '' }]);
  assert.deepEqual(
    parseCimProcs('[{"ProcessId":11,"ParentProcessId":10,"CommandLine":"node a.js"},{"ProcessId":12,"ParentProcessId":10,"CommandLine":null}]'),
    [{ pid: 11, ppid: 10, cmd: 'node a.js' }, { pid: 12, ppid: 10, cmd: '' }],
  );
  assert.deepEqual(parseCimProcs(''), []);
  // a raw control character from the console codepage (0x1A) and the final CRLF do not break the parse
  assert.deepEqual(parseCimProcs('[{"ProcessId":13,"ParentProcessId":1,"CommandLine":"a \u001a b"}]\r\n'), [{ pid: 13, ppid: 1, cmd: 'a   b' }]);
  assert.deepEqual(parsePs('    1     0 /sbin/init splash\n  200   1 node /x/server.js --port 5212\n\n'), [{ pid: 1, ppid: 0, cmd: '/sbin/init splash' }, { pid: 200, ppid: 1, cmd: 'node /x/server.js --port 5212' }]);
  const net = [
    'Active Connections', '', '  Proto  Local Address          Foreign Address        State           PID',
    '  TCP    0.0.0.0:5212           0.0.0.0:0              LISTENING       4242',
    '  TCP    [::]:5213              [::]:0                 LISTENING       4243',
    '  TCP    127.0.0.1:5214         127.0.0.1:60000        ESTABLISHED     4244',
  ].join('\r\n');
  assert.deepEqual(parseNetstatListen(net), [{ pid: 4242, port: 5212 }, { pid: 4243, port: 5213 }]);
  const lsof = [
    'COMMAND   PID USER   FD   TYPE  DEVICE SIZE/OFF NODE NAME',
    'node     4242   me   23u  IPv4 0x1234      0t0  TCP *:5214 (LISTEN)',
    'node     4243   me   24u  IPv6 0x1235      0t0  TCP [::1]:5215 (LISTEN)',
    'node     4244   me   25u  IPv4 0x1236      0t0  TCP 127.0.0.1:8080->127.0.0.1:5000 (ESTABLISHED)',
  ].join('\n');
  assert.deepEqual(parseLsofListen(lsof), [{ pid: 4242, port: 5214 }, { pid: 4243, port: 5215 }]);
});

const procsOf = (cmds) => cmds.map((cmd, i) => ({ pid: 100 + i, ppid: 1, cmd }));

test('E32 procs: selectProcs matches the worktree path followed by a boundary', async () => {
  const { selectProcs } = await import('./verify-run.mjs');
  const pick = (cmds, wt, platform) => selectProcs(procsOf(cmds), [], { wt, ports: [5210, 5219], self: 9999, platform }).map((m) => m.cmd);
  const ok = ['node d:\\x\\e3\\server.js', 'node "D:/x/E3"', 'node D:/x/E3/server.js', 'node D:\\x\\E3', "node 'D:/x/E3' --flag", 'node D:/x/E3 --flag'];
  assert.deepEqual(pick(ok, 'D:/x/E3', 'win32'), ok);
  assert.equal(pick(['node D:/projects/claude-play-wt/E3/server.js', 'node "D:/projects/claude-play-wt/E3"'], 'D:/projects/claude-play-wt/E3', 'win32').length, 2);
  assert.deepEqual(pick(['node D:/projects/claude-play-wt/E32/server.js', 'node D:/x/E32/server.js', 'node D:/x/E3x'], 'D:/x/E3', 'win32'), []);
  assert.deepEqual(pick(['node D:/projects/claude-play-wt/E32/server.js'], 'D:/projects/claude-play-wt/E3', 'win32'), []);
  // linux: case counts
  assert.deepEqual(pick(['node /x/e3/s.js'], '/x/E3', 'linux'), []);
  assert.deepEqual(pick(['node /x/E3/s.js'], '/x/E3', 'linux'), ['node /x/E3/s.js']);
  // a trailing slash on wt is normalized
  assert.equal(pick(['node D:/x/E3/server.js', 'node D:/x/E3'], 'D:/x/E3/', 'win32').length, 2);
  assert.equal(pick(['node D:/x/E3/server.js'], 'D:\\x\\E3\\', 'win32').length, 1);
  const m = selectProcs(procsOf(['node D:/x/E3/' + 'a'.repeat(400)]), [], { wt: 'D:/x/E3', ports: [5210, 5219], self: 9999, platform: 'win32' });
  assert.equal(m[0].why, 'path');
  assert.equal(m[0].cmd.length, 200);
});

test('E32 procs: selectProcs matches listeners inside the port range only', async () => {
  const { selectProcs } = await import('./verify-run.mjs');
  const procs = [{ pid: 10, ppid: 1, cmd: 'a' }, { pid: 11, ppid: 1, cmd: 'b' }, { pid: 12, ppid: 1, cmd: 'c' }, { pid: 13, ppid: 1, cmd: 'd' }, { pid: 14, ppid: 1, cmd: 'e' }];
  const listens = [{ pid: 10, port: 5209 }, { pid: 11, port: 5210 }, { pid: 12, port: 5215 }, { pid: 13, port: 5219 }, { pid: 14, port: 5220 }];
  const m = selectProcs(procs, listens, { wt: 'D:/x/E3', ports: [5210, 5219], self: 9999, platform: 'win32' });
  assert.deepEqual(m.map((x) => [x.pid, x.why]), [[11, 'port 5210'], [12, 'port 5215'], [13, 'port 5219']]);
});

test('E32 procs: selectProcs never picks itself or its ancestors', async () => {
  const { selectProcs } = await import('./verify-run.mjs');
  const wt = 'D:/x/E3';
  const procs = [
    { pid: 1, ppid: 0, cmd: 'init D:/x/E3/root' },
    { pid: 20, ppid: 1, cmd: 'bash D:/x/E3' },
    { pid: 30, ppid: 20, cmd: 'node D:/x/E3/verify-run.mjs procs' },
    { pid: 31, ppid: 20, cmd: 'node D:/x/E3/sibling.js' },
  ];
  const listens = [{ pid: 20, port: 5212 }, { pid: 30, port: 5213 }, { pid: 1, port: 5214 }];
  const m = selectProcs(procs, listens, { wt, ports: [5210, 5219], self: 30, platform: 'win32' });
  assert.deepEqual(m.map((x) => x.pid), [31]);
  // a ppid cycle does not hang
  const cyc = [{ pid: 5, ppid: 6, cmd: 'x' }, { pid: 6, ppid: 5, cmd: 'D:/x/E3' }, { pid: 7, ppid: 1, cmd: 'D:/x/E3' }];
  assert.deepEqual(selectProcs(cyc, [], { wt, ports: [5210, 5219], self: 5, platform: 'win32' }).map((x) => x.pid), [7]);
});

test('E32 procs: refuses a payload without wt or with invalid ports', () => {
  for (const extra of [{ ports: [5210, 5219] }, { wt: '', ports: [5210, 5219] }, { wt: 'D:/x/E3' }, { wt: 'D:/x/E3', ports: [5210] }, { wt: 'D:/x/E3', ports: [5210, 'x'] }, { wt: 'D:/x/E3', ports: [5210.5, 5219] }]) {
    const o = run('procs', sign({ nonce: NONCE, ...extra }));
    assert.equal(o.exit, 2, o.stdout);
    assert.match(o.json.error, /the procs payload is missing a required field/);
    assert.equal(o.json.ended, undefined);
  }
  const usage = run('nope', sign({ nonce: NONCE }));
  assert.match(usage.json.error, /group\|read\|check\|procs/);
});

test('E32 procs: a missing listing goes to unchecked and the command still succeeds', async () => {
  const { runProcs } = await import('./verify-run.mjs');
  const killed = [];
  const kill = (pid) => { killed.push(pid); };
  const p = { nonce: NONCE, wt: '/x/E3', ports: [5210, 5219] };
  const lin = (cmd) => (cmd === 'lsof' ? { error: { code: 'ENOENT' } } : { status: 0, stdout: '  900 1 node /x/E3/s.js\n  901 1 node /elsewhere\n' });
  const a = runProcs(p, { platform: 'linux', run: lin, kill });
  assert.equal(a.mode, 'procs');
  assert.equal(a.unchecked.length, 1);
  assert.match(a.unchecked[0], /lsof/);
  assert.deepEqual(a.matched.map((m) => [m.pid, m.why]), [[900, 'path']]);
  assert.deepEqual(a.ended, [900]);
  assert.deepEqual(a.failed, []);
  assert.deepEqual(killed, [900]);
  const win = (cmd) => (/powershell/i.test(cmd) ? { status: 0, stdout: '[{"ProcessId":910,"ParentProcessId":1,"CommandLine":"node D:\\\\x\\\\E3\\\\s.js"}]' } : { error: { code: 'ENOENT' } });
  const b = runProcs({ nonce: NONCE, wt: 'D:/x/E3', ports: [5210, 5219] }, { platform: 'win32', run: win, kill });
  assert.equal(b.unchecked.length, 1);
  assert.match(b.unchecked[0], /netstat/);
  assert.deepEqual(b.ended, [910]);
  const none = runProcs(p, { platform: 'win32', run: () => ({ error: { code: 'ENOENT' } }), kill });
  assert.equal(none.unchecked.length, 2);
  assert.match(none.unchecked.join('|'), /powershell/);
  assert.match(none.unchecked.join('|'), /netstat/);
  assert.deepEqual(none.matched, []);
  // a kill that throws goes to failed, the others still end
  const bad = runProcs(p, { platform: 'linux', run: (cmd) => (cmd === 'lsof' ? { status: 0, stdout: '' } : { status: 0, stdout: '  900 1 node /x/E3/a\n  901 1 node /x/E3/b\n' }), kill: (pid) => { if (pid === 900) throw new Error('EPERM'); } });
  assert.deepEqual(bad.ended, [901]);
  assert.deepEqual(bad.failed, [{ pid: 900, error: 'EPERM' }]);
});

test('E32 procs: end to end ends a child whose command line carries the worktree', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vr-procs-'));
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', dir], { stdio: 'ignore' });
  const exited = new Promise((res) => child.once('exit', res));
  try {
    const { createServer } = await import('node:net');
    const port = await new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const { port: q } = s.address(); s.close(() => res(q)); }); });
    await new Promise((res) => setTimeout(res, 500)); // let the child's command line settle
    const o = await new Promise((res) => { const c = spawn(process.execPath, [SCRIPT, 'procs', enc(sign({ nonce: NONCE, wt: dir, ports: [port, port] }))], { stdio: ['ignore', 'pipe', 'pipe'] }); let s = ''; c.stdout.on('data', (d) => { s += d; }); c.on('close', (code) => res({ code, s })); });
    const json = JSON.parse(o.s);
    assert.equal(o.code, 0, o.s);
    assert.equal(json.mode, 'procs');
    assert.equal(json.nonce, NONCE);
    assert.ok(json.ended.includes(child.pid), o.s);
    assert.ok(json.matched.some((m) => m.pid === child.pid && m.why === 'path'), o.s);
    assert.deepEqual(json.failed, []);
    assert.ok(outDigest(json));
    await Promise.race([exited, new Promise((_, rej) => setTimeout(() => rej(new Error('the child did not exit within 10 s')), 10000))]);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});
