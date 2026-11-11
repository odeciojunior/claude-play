import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract, readJsonl, loadPrices, family, classifyRole } from './session-metrics.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, 'fixtures', 'transcripts');
const prices = loadPrices(join(here, 'fixtures', 'prices.json'));
const close = (a, b) => Math.abs(a - b) < 1e-9;
const SID1 = '00000000-0000-4000-8000-000000000001';
const SID2 = '00000000-0000-4000-8000-000000000002';

function run() {
  const { runs, unpriced } = extract({ root, prices, sessions: [SID1] });
  assert.equal(runs.length, 1);
  return { run: runs[0], unpriced };
}

test('counts usage once per message id, keeping the largest output', () => {
  const { run: r } = run();
  // msg_fab1 appears three times (5, 5, 9) and counts as 9; msg_fab2 adds 7; <synthetic> is ignored.
  assert.equal(r.main.tokens.output, 9 + 7);
  assert.equal(r.main.turns, 2);
});

test('splits cache writes into 5m and 1h', () => {
  const { run: r } = run();
  assert.equal(r.total.tokens.cacheWrite5m, 10 + 0 + 0);
  assert.equal(r.total.tokens.cacheWrite1h, 0 + 30 + 0);
  // Main: msg_fab1 has 100/50; msg_fab2 has no cache_creation, so its 40 count as 5m.
  assert.equal(r.main.tokens.cacheWrite5m, 100 + 40);
  assert.equal(r.main.tokens.cacheWrite1h, 50);
});

test('counts agent calls by dominant model family', () => {
  const { run: r } = run();
  assert.deepEqual(r.total.calls, { haiku: 0, sonnet: 1, opus: 0, fable: 0, other: 1 });
  assert.deepEqual(r.main.agentCalls, { haiku: 1 });
  assert.equal(family('claude-sonnet-4-5'), 'sonnet');
  assert.equal(family('claude-mystery-1'), 'other');
});

test('measures prompt bytes as UTF-8 of the first user message', () => {
  const { run: r } = run();
  const text = '[fab] revisão acentuada: ação';
  assert.ok(Buffer.byteLength(text, 'utf8') > text.length);
  assert.equal(r.roles['agent:reviewer'].promptBytes, Buffer.byteLength(text, 'utf8'));
  assert.equal(r.roles['agent:reviewer'].agents, 1);
  assert.equal(r.main.promptBytes, Buffer.byteLength('[fab] início da sessão', 'utf8'));
});

test('estimates cost and keeps unpriced models null', () => {
  const { run: r, unpriced } = run();
  // sonnet agent: input 20+5, cw5m 10, cw1h 30, cacheRead 100, output 6+8.
  const expected = (25 * 2 + 10 * 2 * 1.25 + 30 * 2 * 2 + 100 * 0.1 + 14 * 10) / 1e6;
  assert.ok(close(r.roles['agent:reviewer'].cost, expected));
  assert.equal(r.roles['agent:worker'].cost, null);
  assert.deepEqual(r.roles['agent:worker'].unpriced, ['other']);
  assert.deepEqual(unpriced, ['other']);
  assert.ok(close(r.total.cost, expected));
  assert.deepEqual(r.total.unpriced, ['other']);
  // Main on opus: input 10+3, cw5m 140, cw1h 50, cacheRead 200, output 16.
  const mainExpected = (13 * 4 + 140 * 4 * 1.25 + 50 * 4 * 2 + 200 * 0.2 + 16 * 20) / 1e6;
  assert.ok(close(r.main.cost, mainExpected));
});

test('readJsonl tolerates CRLF and a partial last line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-jsonl-'));
  try {
    const f = join(dir, 'x.jsonl');
    writeFileSync(f, '{"a":1}\r\n{"b":2}\r\n{"c":');
    assert.deepEqual(readJsonl(f), [{ a: 1 }, { b: 2 }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function workflowRun() {
  const { runs } = extract({ root, prices, sessions: [SID2] });
  assert.equal(runs.length, 1);
  return runs[0];
}

test('classifies every label family of the role table', () => {
  const wf = { workflow: true };
  const table = [
    ['E5:discovery', wf, 'discovery'],
    ['preflight', wf, 'preflight'],
    ['E5:preflight-checks', wf, 'preflight'],
    ['preparar-ambiente', wf, 'preflight'],
    ['setup', wf, 'setup'],
    ['spec-review1', wf, 'spec-review'],
    ['spec-fix2', wf, 'spec-fix'],
    ['E5:spec', wf, 'spec'],
    ['plan-review2', wf, 'plan-review'],
    ['plan-fix1', wf, 'plan-fix'],
    ['plan', wf, 'plan'],
    ['status-plan', wf, 'status-record'],
    ['progress', wf, 'progress'],
    ['progress-update', wf, 'progress'],
    ['review-log', wf, 'review-log'],
    ['report', wf, 'report'],
    ['t1:impl', wf, 'implementer'],
    ['exec:build', wf, 'implementer'],
    ['t2:spec2', wf, 'task-spec-review'],
    ['t3:quality1', wf, 'task-quality-review'],
    ['t2:fix1', wf, 'task-fix'],
    ['t2:fix-lint', wf, 'task-fix'],
    ['final1', wf, 'final-review'],
    ['revisao-final', wf, 'final-review'],
    ['sync-main', wf, 'final-review'],
    ['test-integrity', wf, 'final-review'],
    ['gates', wf, 'gates'],
    ['evidence-ac1', wf, 'gates'],
    ['suite', wf, 'gates'],
    ['merge', wf, 'merge'],
    ['pre-merge', wf, 'merge'],
    ['cleanup', wf, 'merge'],
    ['docs', wf, 'docs'],
    ['guarda-1', wf, 'guards'],
    ['conferir-sha', wf, 'guards'],
    ['commit-plan', wf, 'guards'],
    ['git-truth', wf, 'guards'],
    ['Plan#2', wf, 'plan'],
    ['E5:wobble3', wf, 'other:wobble'],
    ['Explore things', { workflow: false, agentType: 'Explore' }, 'agent:Explore'],
    [undefined, { workflow: false }, 'agent:general'],
  ];
  for (const [label, opts, expected] of table) {
    assert.equal(classifyRole(label, opts), expected, `label ${label}`);
  }
});

test('status, progress, review log and report come out as separate rows', () => {
  const r = workflowRun();
  for (const role of ['status-record', 'progress', 'review-log', 'report']) {
    assert.ok(Object.keys(r.roles).includes(role), role);
    assert.equal(r.roles[role].agents, 1, role);
  }
});

test('records review rounds per loop', () => {
  const r = workflowRun();
  assert.deepEqual(r.reviewRounds.loops, {
    'spec-review': 1,
    'plan-review': 2,
    't1:spec': 1,
    't1:quality': 1,
    't2:spec': 2,
    final: 1,
  });
  assert.equal(r.reviewRounds.extra, 2);
});

test('counts tasks and the task loop', () => {
  const r = workflowRun();
  assert.equal(r.tasks.count, 2);
  // Seven t* agents; t2:fix1 runs on opus, the other six on sonnet.
  assert.equal(r.tasks.loop.calls.sonnet, 6);
  assert.equal(r.tasks.loop.calls.opus, 1);
});

// ---- Task 4: CLI, CSV, attempts, real prices, privacy ----
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { main } from './session-metrics.mjs';

const script = join(here, 'session-metrics.mjs');
const repoRoot = resolve(here, '..', '..');
const fixturePrices = join(here, 'fixtures', 'prices.json');
const HEADER =
  'run,role,agents,calls_haiku,calls_sonnet,calls_opus,calls_fable,calls_other,promptBytes,input,cacheWrite5m,cacheWrite1h,cacheRead,output,cost';

const parseCsv = (text) =>
  text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(','));

test('writes metrics.json and one csv row per run and role', async () => {
  const out = mkdtempSync(join(tmpdir(), 'sm-out-'));
  try {
    const code = await main(['--root', root, '--out', out, '--prices', fixturePrices]);
    assert.equal(code, 0);
    const json = JSON.parse(readFileSync(join(out, 'metrics.json'), 'utf8'));
    assert.equal(json.runs.length, 2);
    const csv = readFileSync(join(out, 'metrics.csv'), 'utf8');
    assert.equal(csv.split(/\r?\n/)[0], HEADER);
    const rows = parseCsv(csv).slice(1);
    const roles2 = rows.filter((r) => r[0] === SID2).map((r) => r[1]);
    for (const role of ['status-record', 'progress', 'review-log', 'report', 'main', 'total']) {
      assert.equal(roles2.filter((x) => x === role).length, 1, role);
    }
    assert.ok(rows.every((r) => r.length === 15));
    // cost is empty when null (the worker role of session 1 has an unpriced family).
    const worker = rows.find((r) => r[0] === SID1 && r[1] === 'agent:worker');
    assert.equal(worker[14], '');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('groups sessions of one attempt with --runs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-out-'));
  try {
    const manifest = join(dir, 'attempts.json');
    writeFileSync(manifest, JSON.stringify({ attempts: [{ n: 1, sessions: [SID1, SID2] }] }));
    const outDir = join(dir, 'res');
    const code = await main(['--root', root, '--out', outDir, '--runs', manifest, '--prices', fixturePrices]);
    assert.equal(code, 0);
    const json = JSON.parse(readFileSync(join(outDir, 'metrics.json'), 'utf8'));
    assert.equal(json.runs.length, 1);
    assert.equal(json.runs[0].run, 'attempt-1');
    const a = extract({ root, prices, sessions: [SID1] }).runs[0];
    const b = extract({ root, prices, sessions: [SID2] }).runs[0];
    assert.ok(b.total.tokens.output > 0 && a.total.tokens.output > 0);
    assert.equal(json.runs[0].total.tokens.output, a.total.tokens.output + b.total.tokens.output);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('requires --root and --out', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
});

test('refuses --out inside the repository outside tools/measure/out', () => {
  const run = (out) =>
    spawnSync(process.execPath, [script, '--root', root, '--out', out, '--prices', fixturePrices], { encoding: 'utf8' });
  assert.equal(run(join(repoRoot, 'tools', 'measure')).status, 2);
  assert.equal(run(join(repoRoot, 'tools', 'measure', 'out', '..', 'x')).status, 2);
  if (process.platform === 'win32') assert.equal(run(join(repoRoot, 'TOOLS', 'Measure')).status, 2);
  const ok = join(repoRoot, 'tools', 'measure', 'out', `t-${randomBytes(4).toString('hex')}`);
  try {
    assert.equal(run(ok).status, 0);
  } finally {
    rmSync(ok, { recursive: true, force: true });
  }
});

test('real price table is dated and sourced', () => {
  const p = JSON.parse(readFileSync(join(here, 'prices.json'), 'utf8'));
  assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(typeof p.source === 'string' && p.source.length > 0);
  assert.equal(p.cacheWrite5m, 1.25);
  assert.equal(p.cacheWrite1h, 2);
});

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const AGENT = /agent-a[0-9a-f]+/g;
const PATHS = [
  [/[A-Za-z]:[\\/]+Users[\\/]+(?!<|\$)[^\\/\s"'`]+/i, 'windows-path'],
  [/\/(Users|home)\/(?!<|\$)[^\/\s"'`]+/, 'posix-path'],
  [/\b[A-Za-z]--Users-[^\s"'`]+/, 'project-dir-name'],
];
const TEXT_KEYS = new Set(['text', 'description', 'prompt']);

function walk(dir, skipOut, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (skipOut && n === 'out') continue;
      walk(p, skipOut, acc);
    } else acc.push(p);
  }
  return acc;
}

function checkFab(node, file, found, inToolResult = false) {
  if (Array.isArray(node)) return node.forEach((x) => checkFab(x, file, found, inToolResult));
  if (!node || typeof node !== 'object') return;
  const tr = inToolResult || node.type === 'tool_result';
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' && (TEXT_KEYS.has(k) || k === 'content') && !v.startsWith('[fab]')) {
      found.push({ file, kind: 'unfabricated-text', match: v.slice(0, 40) });
    }
    checkFab(v, file, found, tr);
  }
}

function scanPrivacy(dir) {
  const found = [];
  for (const file of walk(dir, true)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.match(UUID) ?? []) {
      if (!m.startsWith('00000000-0000-4000-8000-')) found.push({ file, kind: 'uuid', match: m });
    }
    for (const m of text.match(AGENT) ?? []) {
      if (!m.startsWith('agent-afab')) found.push({ file, kind: 'agent-id', match: m });
    }
    for (const [re, kind] of PATHS) {
      const m = re.exec(text);
      if (m) found.push({ file, kind, match: m[0] });
    }
    // Fabricated-text rule for fixtures. Agent label files (*.meta.json) hold role labels, not text.
    if (/[\\/]fixtures[\\/]/.test(file) && /\.jsonl?$/.test(file) && !/\.meta\.json$/.test(file)) {
      const docs = file.endsWith('.jsonl')
        ? text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
        : [JSON.parse(text)];
      for (const d of docs) checkFab(d, file, found);
    }
  }
  return found;
}

test('tools/measure holds no session id, personal path or unfabricated text', () => {
  assert.deepEqual(scanPrivacy(here), []);
});

test('privacy scan catches a planted personal path and session id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-priv-'));
  try {
    const planted = ['C:', 'Users', 'someone', 'x'].join('\\');
    const id = ['11111111', '2222', '4333', '8444', '555555555555'].join('-');
    writeFileSync(join(dir, 'a.txt'), `${planted}\n${id}\n`);
    const found = scanPrivacy(dir);
    assert.equal(found.length, 2);
    assert.deepEqual(found.map((f) => f.kind).sort(), ['uuid', 'windows-path']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- Final fix: labels the workflow really emits ----
import { mkdirSync } from 'node:fs';
import { toAttemptCounters } from './run-batch.mjs';

// Builds a transcript root with one session and one workflow agent per label ({ label, model, prompt }).
function realLabelRoot(agents) {
  const base = mkdtempSync(join(tmpdir(), 'sm-labels-'));
  const sid = '00000000-0000-4000-8000-0000000000aa';
  const proj = join(base, 'p');
  const wf = join(proj, sid, 'subagents', 'workflows', 'wf_x');
  mkdirSync(wf, { recursive: true });
  writeFileSync(join(proj, `${sid}.jsonl`), JSON.stringify({ type: 'user', message: { role: 'user', content: 'go' } }) + '\n');
  agents.forEach((a, i) => {
    const id = `agent-a${i}`;
    writeFileSync(join(wf, `${id}.meta.json`), JSON.stringify({ description: a.label }));
    writeFileSync(
      join(wf, `${id}.jsonl`),
      [
        { type: 'user', isSidechain: true, message: { role: 'user', content: a.prompt ?? 'x'.repeat(5) } },
        { type: 'assistant', isSidechain: true, requestId: `r${i}`, message: { id: `m${i}`, role: 'assistant', model: a.model ?? 'claude-sonnet-4-5', content: [], usage: { input_tokens: 1, output_tokens: 1 } } },
      ].map((o) => JSON.stringify(o)).join('\n') + '\n',
    );
  });
  return { base, sid };
}

test('task fixers and final reviews carry the roles and rounds of the real labels', () => {
  const { base, sid } = realLabelRoot([
    { label: 'E5:spec', prompt: 'x'.repeat(10) },
    { label: 'E5:t3:impl' },
    { label: 'E5:t3:spec1' },
    { label: 'E5:t3:spec-fix1' },
    { label: 'E5:t3:quality-fix2' },
    { label: 'E5:final-1-r1', model: 'claude-opus-4-5' },
    { label: 'E5:final-2-r1', model: 'claude-opus-4-5' },
    { label: 'E5:final-1-r2', model: 'claude-opus-4-5' },
    { label: 'E5:final-2-r2', model: 'claude-opus-4-5' },
    { label: 'E5:final-1-r3', model: 'claude-opus-4-5' },
  ]);
  try {
    const { runs } = extract({ root: base, prices, sessions: [sid] });
    const r = runs[0];
    assert.equal(r.roles['task-fix'].agents, 2);
    assert.ok(!Object.keys(r.roles).some((k) => k.startsWith('other:')), Object.keys(r.roles).join());
    assert.equal(r.reviewRounds.loops.final, 3);
    assert.equal(r.reviewRounds.extra, 2);
    // final rounds 2 and 3 (3 reviewers on opus) are conditional work
    assert.equal(r.reviewRounds.extraAgents.calls.opus, 3);
    assert.equal(r.tasks.loop.calls.sonnet, 4);
    // structural: spec (sonnet) and the two round-1 final reviewers (opus); bytes: 10 + 5 + 5
    const c = toAttemptCounters(r);
    assert.deepEqual(c.structural, { haiku: 0, sonnet: 1, opus: 2, fable: 0, other: 0, weighted: 20 + 80 });
    assert.equal(c.bytes, 20);
    assert.deepEqual(c.conditional, { extraRounds: 2, fixCalls: 2 });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
