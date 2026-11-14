import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, realpathSync, readFileSync, utimesSync } from 'node:fs';
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
