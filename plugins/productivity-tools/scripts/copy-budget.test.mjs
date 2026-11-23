import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MAX_COPY_BYTES, SLICE_BYTES, utf8Length } from '../lib/plan-digest.mjs';

// E41 A T11 (AC6): no response an agent copies is above MAX_COPY_BYTES UTF-8 bytes.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.join(HERE, '..');
const CAPTURE = path.join(HERE, 'capture.mjs');
const PROGRESS = path.join(PLUGIN, 'skills', 'plan-coordinator', 'scripts', 'progress.mjs');
const VERIFY = path.join(PLUGIN, 'skills', 'roadmap-release', 'scripts', 'verify-run.mjs');
const PREFLIGHT = path.join(PLUGIN, 'skills', 'roadmap-release', 'scripts', 'preflight.mjs');
const FIXTURES = path.join(HERE, 'fixtures');
const FIXTURE_VALID = path.join(PLUGIN, 'skills', 'roadmap-tracker', 'scripts', 'fixtures', 'valid');
const fwd = (p) => p.replace(/\\/g, '/');
const GIT = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false'];

function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}
function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: cleanEnv(), ...opts });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
function git(cwd, ...args) {
  const r = spawnSync('git', [...GIT, ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, args.join(' ') + ': ' + r.stderr);
  return r.stdout.trim();
}
function tmp(prefix) {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}
function withDir(prefix, fn) {
  const dir = tmp(prefix);
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
function withRepo(fn) {
  return withDir('copy-budget-', (dir) => {
    git(dir, 'init', '-q', '-b', 'main');
    return fn(dir);
  });
}
// The agent copies the whole stdout: measure it as printed, with the newline.
function within(label, stdout) {
  const n = utf8Length(stdout);
  assert.ok(n > 0, label + ': empty response');
  assert.ok(n <= MAX_COPY_BYTES, `${label}: ${n} bytes > ${MAX_COPY_BYTES}`);
}

test('the single limit is 3500 and slices stay below it', () => {
  assert.equal(MAX_COPY_BYTES, 3500);
  assert.ok(SLICE_BYTES < MAX_COPY_BYTES);
});

test('capture run: 12.7 KB of stdout and the 63-test suite with --tests', () => {
  withRepo((repo) => {
    const script = path.join(repo, 'gen.js');
    fs.writeFileSync(script, "for (let i = 0; i < 400; i++) console.log('line ' + String(i).padStart(3, '0') + ' ' + 'x'.repeat(22));\n");
    const a = node([CAPTURE, 'run', '--nonce', 'B1', '--task', 'E41-T1', '--cwd', fwd(repo), '--', 'node', script]);
    assert.equal(a.code, 0, a.stderr);
    assert.ok(JSON.parse(a.stdout).bytes > 12000);
    within('capture run 12.7 KB', a.stdout);

    const suite = path.join(repo, 'big.test.js');
    fs.writeFileSync(suite, [
      "const { describe, it } = require('node:test');",
      "const assert = require('node:assert');",
      "describe('grupo com nome bem longo para encher a saida', () => {",
      "  for (let i = 0; i < 30; i++) it('ok grupo com nome longo numero ' + i + ' ' + 'z'.repeat(60), () => {});",
      "  it('FAIL_C ' + 'c'.repeat(80), () => { assert.fail('c'); });",
      "  describe('interno', () => {",
      "    for (let i = 0; i < 30; i++) it('ok interno com nome longo numero ' + i + ' ' + 'w'.repeat(60), () => {});",
      "    it('FAIL_A ' + 'a'.repeat(80), () => { assert.fail('a'); });",
      '  });',
      '});',
      "it('FAIL_B ' + 'b'.repeat(80), () => { assert.fail('b'); });",
      '',
    ].join('\n'));
    const b = node([CAPTURE, 'run', '--nonce', 'B2', '--task', 'E41-T2', '--cwd', fwd(repo), '--tests', '--', 'node', '--test', suite]);
    assert.equal(b.code, 1, b.stderr);
    assert.equal(JSON.parse(b.stdout).extract.total, 63);
    within('capture run --tests 63', b.stdout);
  });
});

test('capture slice: every slice of the 12.7 KB stdout', () => {
  withRepo((repo) => {
    const script = path.join(repo, 'gen.js');
    fs.writeFileSync(script, "for (let i = 0; i < 400; i++) console.log('line ' + String(i).padStart(3, '0') + ' ' + 'x'.repeat(22));\n");
    const run = node([CAPTURE, 'run', '--nonce', 'S0', '--task', 'E41-T1', '--cwd', fwd(repo), '--', 'node', script]);
    assert.equal(run.code, 0, run.stderr);
    const o = JSON.parse(run.stdout);
    let slices = 1;
    for (let k = 0; k < slices; k++) {
      const r = node([CAPTURE, 'slice', '--nonce', 'S1', '--path', o.path, '--cwd', fwd(repo), '--sha', o.sha256, '--slice', String(k)]);
      assert.equal(r.code, 0, r.stderr + r.stdout);
      within('capture slice ' + k, r.stdout);
      slices = JSON.parse(r.stdout).slices;
    }
    assert.ok(slices > 3, 'slices ' + slices);
  });
});

test('progress read --slice: every slice of a 40-step plan with one 5 KB step', () => {
  withDir('copy-budget-pg-', (dir) => {
    fs.mkdirSync(path.join(dir, 'plan-tool'));
    fs.mkdirSync(path.join(dir, 'spec-tool'));
    const plan = path.join(dir, 'plan-tool', 'plan.md');
    const state = path.join(dir, 'plan-tool', 'progress.json');
    fs.copyFileSync(path.join(FIXTURES, 'plan-tool', 'plan.md'), plan);
    fs.copyFileSync(path.join(FIXTURES, 'spec-tool', 'spec.md'), path.join(dir, 'spec-tool', 'spec.md'));
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'init');
    const init = node([PROGRESS, 'init', plan]);
    assert.equal(init.code, 0, init.stderr);
    const st = JSON.parse(fs.readFileSync(state, 'utf8'));
    const base = st.steps[0];
    st.steps = Array.from({ length: 40 }, (_, i) => ({
      ...base, n: i + 1, title: 't' + (i + 1), files: ['src/a' + i + '.mjs'], status: 'pass',
      note: 'n'.repeat(250), handoff: 'h'.repeat(150), sha: 'a'.repeat(40),
      ...(i === 20 ? { note: ('é€漢' + 'n').repeat(1250) } : {}),
    }));
    fs.writeFileSync(state, JSON.stringify(st, null, 2) + '\n');
    let slices = 1;
    for (let k = 0; k < slices; k++) {
      const r = node([PROGRESS, 'read', state, '--nonce', 'P' + k, '--slice', String(k), '--json']);
      assert.equal(r.code, 0, r.stderr);
      within('progress read slice ' + k, r.stdout);
      slices = JSON.parse(r.stdout).slices;
    }
    assert.ok(slices > 3, 'slices ' + slices);
  });
});

test('verify-run read with slice: long brief and status from a fake CLI', async () => {
  const { canon, fnv1a } = await import('../lib/plan-digest.mjs');
  const dir = tmp('copy-budget-vr-');
  try {
    git(dir, 'init', '-q', '-b', 'integ');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    git(dir, 'add', 'a.txt');
    git(dir, 'commit', '-qm', 'base');
    const cli = path.join(dir, 'fake-cli.mjs');
    fs.writeFileSync(cli, `
const verb = process.argv[2];
const note = (c) => c.repeat(200) + ' BLQ-1';
const ok = (result) => console.log(JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, result }));
if (verb === 'status') ok({ panel: [{ id: 'E1', segments: ['a', 'b', 'c', 'd'].map((l) => ({ label: l, word: 'w' + l, note: note('\\u00e9') })), evidence: 'e'.repeat(200), next: 'n'.repeat(200) }] });
else if (verb === 'brief') ok({ checker: { folder: 'f'.repeat(200), plugin: 'p', stale: false, errors: 0, warnings: 10, errorCodes: [], warningCodes: Array.from({ length: 10 }, (_, i) => 'W' + 'w'.repeat(30) + i) } });
else ok({ decisions: Array.from({ length: 100 }, (_, i) => ({ id: 'DEC-' + String(1e15 + i) })) });
`);
    const sign = (p) => ({ ...p, digest: fnv1a(JSON.stringify(canon(p))) });
    const enc = (obj) => encodeURIComponent(JSON.stringify(obj)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    const call = (k) => node([VERIFY, 'read', enc(sign({ nonce: 'rd-1', cwd: dir, cli, folder: dir, deliverable: 'E1', slice: k }))]);
    const first = call(0);
    assert.equal(first.code, 0, first.stdout);
    const n = JSON.parse(first.stdout).slices;
    assert.ok(n >= 2, 'slices ' + n);
    for (let k = 0; k < n; k++) {
      const r = k === 0 ? first : call(k);
      assert.equal(r.code, 0, r.stdout);
      within('verify-run read slice ' + k, r.stdout);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('preflight discover --slice: every slice of a roadmap with many cards', () => {
  withDir('copy-budget-pf-', (root) => {
    git(root, 'init', '-q', '-b', 'main');
    const dir = path.join(root, 'docs', 'plans', 'roadmap-x');
    fs.mkdirSync(dir, { recursive: true });
    const files = ['roadmap.config.json', 'strategy.md', 'state.md', 'decisions.md', 'README.md', 'log.md', 'critical-path.md', 'sources.md', 'requirements.md'];
    const rows = Array.from({ length: 60 }, (_, i) => `| B${i + 1} | blocked by é ${'x'.repeat(200)} | E1 | 2026-01-01 | later |`).join('\n');
    for (const f of files) {
      let text = fs.readFileSync(path.join(FIXTURE_VALID, f), 'utf8').replace(/\r\n/g, '\n');
      if (f === 'state.md') text = text.replace('|---|---|---|---|---|\n<!-- /roadmap:blockers -->', `|---|---|---|---|---|\n${rows}\n<!-- /roadmap:blockers -->`);
      fs.writeFileSync(path.join(dir, f), text);
    }
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'base');
    const args = [PREFLIGHT, 'discover', '--repo', root, '--roadmap', 'docs/plans/roadmap-x', '--today', '2026-01-05', '--prefix', 'pf-', '--nonce', 'n-s'];
    let slices = 1;
    for (let k = 0; k < slices; k++) {
      const r = node([...args, '--slice', String(k)]);
      assert.equal(r.code, 0, r.stderr);
      within('discover slice ' + k, r.stdout);
      slices = JSON.parse(r.stdout).slices;
    }
    assert.ok(slices > 1, 'slices ' + slices);
  });
});

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'fixtures' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (!e.name.endsWith('.test.mjs')) out.push(p);
  }
  return out;
}

// Removes the blocks `// <embed src=".../plan-digest.mjs" ...>` through `// </embed>`.
function stripDigestEmbeds(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const keep = [];
  let skipping = false;
  for (const line of lines) {
    if (!skipping && /^[ \t]*\/\/ <embed[^>\n]*plan-digest\.mjs[^>\n]*>[ \t]*$/.test(line)) { skipping = true; continue; }
    if (skipping) {
      if (/^[ \t]*\/\/ <\/embed>[ \t]*$/.test(line)) skipping = false;
      continue;
    }
    keep.push(line);
  }
  return keep.join('\n');
}

test('the literal 3500 appears only in lib/plan-digest.mjs among non-test plugin files', () => {
  const hits = [];
  for (const file of walk(PLUGIN, [])) {
    if (!/\.(mjs|js|md|py|json|sh|ps1)$/.test(file)) continue;
    const text = stripDigestEmbeds(fs.readFileSync(file, 'utf8'));
    if (/\b3500\b/.test(text)) hits.push(fwd(path.relative(PLUGIN, file)));
  }
  assert.deepEqual(hits, ['lib/plan-digest.mjs']);
});
