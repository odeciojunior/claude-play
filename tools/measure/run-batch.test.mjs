import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runBatch, toAttemptCounters } from './run-batch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'run-batch.mjs');
const FIX = join(here, 'fixtures', 'transcripts', 'fab-project');
const SRC_SID = '00000000-0000-4000-8000-000000000002';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function setup({ withPlugins = true } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'run-batch-'));
  const dirs = { base, work: join(base, 'work'), out: join(base, 'out'), configDir: join(base, 'cfg') };
  mkdirSync(join(dirs.configDir, 'plugins'), { recursive: true });
  if (withPlugins) {
    writeFileSync(
      join(dirs.configDir, 'plugins', 'installed_plugins.json'),
      JSON.stringify({ version: 2, plugins: { 'productivity-tools@claude-play': [{ version: '9.9.9', gitCommitSha: 'abc1234' }] } }),
    );
  }
  return { ...dirs, done: () => rmSync(base, { recursive: true, force: true }) };
}

const sid = (k) => `00000000-0000-4000-8000-0000000001${String(k).padStart(2, '0')}`;

// Fake executor: claude -p copies fabricated transcripts, the extractor runs for real.
function makeFake(configDir, { denyOn } = {}) {
  const calls = [];
  const issued = [];
  let n = 0;
  const exec = async (cmd, args, opts = {}) => {
    calls.push({ cmd, args, cwd: opts.cwd });
    if (cmd === 'claude' && args[0] === '--version') return { code: 0, stdout: '2.1.0 (Claude Code)\n' };
    if (cmd === 'claude') {
      n += 1;
      const id = sid(n);
      issued.push(id);
      const proj = join(configDir, 'projects', 'fab-sandbox');
      mkdirSync(proj, { recursive: true });
      writeFileSync(join(proj, `${id}.jsonl`), readFileSync(join(FIX, `${SRC_SID}.jsonl`), 'utf8').split(SRC_SID).join(id));
      const wf = join(proj, id, 'subagents', 'workflows', 'wf_fab');
      mkdirSync(wf, { recursive: true });
      for (const a of ['afab101', 'afab102']) {
        for (const ext of ['jsonl', 'meta.json']) {
          copyFileSync(join(FIX, SRC_SID, 'subagents', 'workflows', 'wf_fab01', `agent-${a}.${ext}`), join(wf, `agent-${a}.${ext}`));
        }
      }
      const denials = denyOn === n ? [{ tool_name: 'Workflow' }] : [];
      return { code: 0, stdout: JSON.stringify({ session_id: id, is_error: false, total_cost_usd: 0.01, permission_denials: denials }) };
    }
    const r = spawnSync(cmd, args, { cwd: opts.cwd, encoding: 'utf8' });
    return { code: r.status ?? 1, stdout: r.stdout ?? '' };
  };
  return { exec, calls, issued };
}

const baseOpts = (s, extra = {}) => ({
  variant: 'completo', runs: 3, work: s.work, out: s.out, configDir: s.configDir, permissionMode: 'acceptEdits', ...extra,
});

test('launches n attempts, calls the extractor once per attempt and writes an aggregate', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s), { exec: fake.exec, now: () => new Date('2026-11-10T12:00:00Z') });
    const claudeP = fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p');
    const extractor = fake.calls.filter((c) => c.args[0]?.endsWith('session-metrics.mjs'));
    assert.equal(claudeP.length, 3);
    assert.equal(extractor.length, 3);
    assert.equal(claudeP[0].args[claudeP[0].args.indexOf('--permission-mode') + 1], 'acceptEdits');
    assert.equal(r.exitCode, 0);
    assert.equal(r.dir, join(s.out, 'completo-20261110-120000'));
    const agg = JSON.parse(readFileSync(join(r.dir, 'aggregate.json'), 'utf8'));
    assert.equal(agg.variant, 'completo');
    assert.equal(agg.requested, 3);
    assert.equal(agg.valid, 3);
    assert.equal(agg.denied, 0);
    assert.equal(agg.permissionMode, 'acceptEdits');
    assert.equal(agg.plugin.version, '9.9.9');
    assert.equal(agg.plugin.commit, 'abc1234');
    assert.equal(agg.cli, '2.1.0 (Claude Code)');
    assert.deepEqual(agg.attempts.map((a) => a.n), [1, 2, 3]);
    for (const a of agg.attempts) {
      assert.equal(a.status, 'valid');
      assert.ok(a.counters && typeof a.counters.structural.weighted === 'number');
      assert.deepEqual(a.outcomes, []);
    }
    assert.equal(agg.attempts[0].counters.structural.sonnet, 2);
    assert.equal(agg.attempts[0].counters.structural.weighted, 40);
    assert.ok(agg.cost.median !== null && agg.cost.min <= agg.cost.median && agg.cost.median <= agg.cost.max);
    assert.deepEqual(agg.invalidReasons, {});
    assert.equal(agg.roles.discovery.agents, 3);
    assert.deepEqual(r.aggregate, agg);
  } finally {
    s.done();
  }
});

test('aggregate holds no session id, personal path or agent description', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s), { exec: fake.exec, now: () => new Date('2026-11-10T12:00:00Z') });
    const text = readFileSync(join(r.dir, 'aggregate.json'), 'utf8');
    for (const id of fake.issued) assert.ok(!text.includes(id), `session id ${id} leaked`);
    assert.ok(!UUID.test(text), 'UUID pattern in aggregate');
    for (const p of [s.work, s.out, s.configDir]) {
      for (const q of [p, p.replace(/\\/g, '/'), JSON.stringify(p).slice(1, -1)]) assert.ok(!text.includes(q), `path ${q} leaked`);
    }
    const descs = [];
    const walk = (d) => {
      for (const n of readdirSync(d)) {
        const f = join(d, n);
        if (statSync(f).isDirectory()) walk(f);
        else if (n.endsWith('.meta.json')) descs.push(JSON.parse(readFileSync(f, 'utf8')).description);
      }
    };
    walk(join(s.configDir, 'projects'));
    assert.ok(descs.length >= 2);
    for (const d of descs) assert.ok(!text.includes(d), `description ${d} leaked`);
    const priv = readFileSync(join(r.dir, 'private', 'attempts.json'), 'utf8');
    for (const id of fake.issued) assert.ok(priv.includes(id));
  } finally {
    s.done();
  }
});

test('denied attempts are listed, kept out of the counters and exit 1', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { denyOn: 2 });
    const r = await runBatch(baseOpts(s), { exec: fake.exec, now: () => new Date('2026-11-10T12:00:00Z') });
    assert.equal(r.exitCode, 1);
    assert.equal(r.aggregate.denied, 1);
    assert.equal(r.aggregate.valid, 2);
    const a2 = r.aggregate.attempts.find((a) => a.n === 2);
    assert.equal(a2.status, 'denied');
    assert.equal(a2.counters, undefined);
    assert.equal(fake.calls.filter((c) => c.args[0]?.endsWith('session-metrics.mjs')).length, 2);
  } finally {
    s.done();
  }
});

test('unknown plugin version is recorded as unknown', async () => {
  const s = setup({ withPlugins: false });
  try {
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s, { runs: 1 }), { exec: fake.exec, now: () => new Date('2026-11-10T12:00:00Z') });
    assert.equal(r.aggregate.plugin.version, 'unknown');
    assert.equal(r.aggregate.plugin.commit, 'unknown');
  } finally {
    s.done();
  }
});

test('requires the mandatory options', () => {
  const s = setup();
  try {
    const common = ['--variant', 'completo', '--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir];
    const r = spawnSync(process.execPath, [script, ...common], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /usage:/);
    const inRepo = spawnSync(
      process.execPath,
      [script, '--variant', 'completo', '--runs', '1', '--work', join(here, 'work-x'), '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'],
      { encoding: 'utf8' },
    );
    assert.equal(inRepo.status, 2);
    assert.ok(!existsSync(join(here, 'work-x')));
  } finally {
    s.done();
  }
});

test('toAttemptCounters separates structural, per-task and conditional work', () => {
  const calls = (h, s, o) => ({ haiku: h, sonnet: s, opus: o, fable: 0, other: 0 });
  const cnt = (c, b, cost) => ({ calls: c, promptBytes: b, tokens: {}, cost, unpriced: [] });
  const run = {
    roles: {
      spec: { ...cnt(calls(0, 1, 0), 10, 1), agents: 1 },
      'plan-fix': { ...cnt(calls(0, 1, 0), 5, 1), agents: 1 },
      implementer: { ...cnt(calls(0, 2, 0), 20, 1), agents: 2 },
    },
    total: cnt(calls(0, 4, 0), 35, 3),
    reviewRounds: { loops: {}, extra: 2 },
    tasks: { count: 2, loop: cnt(calls(0, 2, 0), 20, 1) },
    main: { turns: 7, agentCalls: { sonnet: 2, default: 1 }, promptBytes: 9, tokens: {}, cost: 1 },
  };
  const c = toAttemptCounters(run);
  assert.deepEqual(c.structural, { haiku: 0, sonnet: 1, opus: 0, fable: 0, other: 0, weighted: 20 });
  assert.equal(c.bytes, 10);
  assert.equal(c.perTask, 20);
  assert.deepEqual(c.conditional, { extraRounds: 2, fixCalls: 1 });
  assert.deepEqual(c.main, { agentCalls: 3, bytes: 9, turns: 7 });
  assert.equal(c.static, null);
  assert.equal(c.cost, 3);
  assert.equal(toAttemptCounters({ ...run, tasks: { count: 0, loop: cnt(calls(0, 0, 0), 0, null) } }).perTask, null);
});
