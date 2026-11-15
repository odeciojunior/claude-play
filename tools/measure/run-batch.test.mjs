import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync, cpSync, mkdirSync, copyFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { redactPaths, runBatch, parseCli, pendingE5, buildQuestionsScript, toAttemptCounters, sumCliCost, rolesByLabel, readJournal, checkValidity, releaseRunValidity, coordinatorGateVazio, resumeRunValidity, ratifyE5Contract, execEnv, e5Integrated, readPlugin, readPanel, panelMatches, PANEL_VARIANTS, EXPECTED_PANEL } from './run-batch.mjs';
import { E5_PATHS, NATIVE_PATHS, seedSourceOf, makeScenario } from './make-scenario.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'run-batch.mjs');
const FIX = join(here, 'fixtures', 'transcripts', 'fab-project');
const SRC_SID = '00000000-0000-4000-8000-000000000002';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function setup({ withPlugins = true } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'run-batch-'));
  const dirs = { base, work: join(base, 'work'), out: join(base, 'out'), configDir: join(base, 'cfg') };
  mkdirSync(join(dirs.configDir, 'plugins'), { recursive: true });
  const installed = join(base, 'cfg', 'plugins', 'cache', 'claude-play', 'productivity-tools', '9.9.9');
  if (withPlugins) {
    mkdirSync(join(installed, 'agents'), { recursive: true });
    writeFileSync(join(installed, 'agents', 'task-reviewer.md'), '---\nname: task-reviewer\n---\n');
    // the measured workflow: --stage spec/plan with --arm atual checks the arms against it
    mkdirSync(join(installed, 'skills', 'roadmap-release', 'workflow'), { recursive: true });
    copyFileSync(WORKFLOW, join(installed, 'skills', 'roadmap-release', 'workflow', 'roadmap-release.js'));
    writeFileSync(
      join(dirs.configDir, 'plugins', 'installed_plugins.json'),
      JSON.stringify({ version: 2, plugins: { 'productivity-tools@claude-play': [{ version: '9.9.9', gitCommitSha: 'abc1234', installPath: join(base, 'cfg', 'plugins', 'cache', 'claude-play', 'productivity-tools', '9.9.9') }] } }),
    );
  }
  return { ...dirs, installed, done: () => rmSync(base, { recursive: true, force: true }) };
}

const HEAD = spawnSync('git', ['-C', here, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const sid = (k) => `00000000-0000-4000-8000-0000000001${String(k).padStart(2, '0')}`;

const JOURNALS = join(here, 'fixtures', 'journals');
const gitIn = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=fab', '-c', 'user.email=fab@example.invalid', ...a], { cwd, encoding: 'utf8' });

// Fake executor: claude -p copies fabricated transcripts (and optionally a journal fixture), the extractor
// and git run for real. Options: journal (fixture name, or a function of the call number), afterRun(cwd, n)
// (changes the sandbox like the run would), stopResume (the first claude -p waits for the abort and the
// simulated git log answers with the stop commit on its second query), failOn (call number that fails).
function makeFake(configDir, { denyOn, journal, afterRun, stopResume, failOn, noAgentsOn, extraOn1 } = {}) {
  const calls = [];
  const issued = [];
  let n = 0;
  let logQueries = 0;
  const writeSession = (id, cwd) => {
    issued.push(id);
    const proj = join(configDir, 'projects', 'fab-sandbox');
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, `${id}.jsonl`), readFileSync(join(FIX, `${SRC_SID}.jsonl`), 'utf8').split(SRC_SID).join(id));
    const wf = join(proj, id, 'subagents', 'workflows', 'wf_fab');
    mkdirSync(wf, { recursive: true });
    for (const a of noAgentsOn === n ? [] : ['afab101', 'afab102']) {
      for (const ext of ['jsonl', 'meta.json']) {
        copyFileSync(join(FIX, SRC_SID, 'subagents', 'workflows', 'wf_fab01', `agent-${a}.${ext}`), join(wf, `agent-${a}.${ext}`));
      }
    }
    const name = typeof journal === 'function' ? journal(n) : journal;
    if (name) {
      let text = name.includes('\n') ? name : readFileSync(join(JOURNALS, name), 'utf8'); // a fixture name or inline journal text
      if (text.includes('{{PLAN_BLOB}}')) text = text.split('{{PLAN_BLOB}}').join(gitIn(cwd, "rev-parse", `feat/E5:${E5_PATHS.plan}`).stdout.trim());
      writeFileSync(join(wf, 'journal.jsonl'), text);
    }
  };
  const exec = async (cmd, args, opts = {}) => {
    calls.push({ cmd, args, cwd: opts.cwd });
    if (cmd === 'claude' && args[0] === '--version') return { code: 0, stdout: '2.1.0 (Claude Code)\n' };
    if (cmd === 'git' && args[0] === 'log' && stopResume) {
      logQueries += 1;
      return { code: 0, stdout: logQueries >= 2 ? 'E5 T1: slugify\nE5 spec\n' : 'docs(spec): E5\n' };
    }
    if (cmd === 'claude') {
      n += 1;
      const id = sid(n);
      writeSession(id, opts.cwd);
      if (extraOn1 && n === 1) writeSession('00000000-0000-4000-8000-000000000999', opts.cwd);
      if (stopResume && n === 1) {
        await new Promise((resolveWait) => {
          if (opts.signal.aborted) resolveWait();
          else opts.signal.addEventListener('abort', resolveWait, { once: true });
        });
        return { code: 1, stdout: '' };
      }
      if (afterRun) afterRun(opts.cwd, n);
      if (failOn === n) return { code: 1, stdout: '' };
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
    fixAgents: cnt(calls(0, 1, 0), 5, 1),
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

// ---- Task 12: stop and resume, validity and outcomes of the seeded variants ----

const NOW = () => new Date('2026-11-10T12:00:00Z');
const okRatify = () => ({ ok: true, ratified: [] });
const ORIGINAL_PLAN = readFileSync(join(here, 'scenario', 'e5', 'plan.md'), 'utf8').replace(/\r\n/g, '\n');
const taskSection = (text, k) => new RegExp(`^### Task ${k}: [\\s\\S]*?(?=^### Task |^## Acceptance criteria evidence)`, 'm').exec(text)[0];

// Like the reviewed run: P2 (the phantom command) and P1 (the verification steps of task 2) are undone in one commit.
function fixP1P2(cwd) {
  gitIn(cwd, 'checkout', '-q', 'feat/E5'); // the run edits the branch; the seeded sandbox root sits on main
  const file = join(cwd, E5_PATHS.plan);
  let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('npm run verify-slug').join('node --test tests/e5-slugify.test.mjs');
  const original = taskSection(ORIGINAL_PLAN, 2).split('\n');
  const step = (n) => original.find((l) => l.startsWith(`- [ ] **Step ${n}:**`));
  text = text.replace(taskSection(text, 2), (sec) =>
    sec.split('\n').flatMap((l) => (l.startsWith('- [ ] **Step 1:**') ? [l, step(2)] : l.startsWith('- [ ] **Step 3:**') ? [l, step(4)] : [l])).join('\n'),
  );
  writeFileSync(file, text);
  gitIn(cwd, 'add', E5_PATHS.plan);
  gitIn(cwd, 'commit', '-q', '-m', 'docs(plan): E5 review fixes');
}

const mergeE5 = (cwd) => {
  gitIn(cwd, 'checkout', '-q', '-B', 'release/sandbox', 'main');
  gitIn(cwd, 'merge', '-q', '--no-ff', '-m', 'merge feat/E5', 'feat/E5');
  gitIn(cwd, 'checkout', '-q', 'feat/E5');
};

const seededOpts = (s, variant, extra = {}) => baseOpts(s, { variant, runs: 1, ...extra });
const outcomeMap = (attempt) => Object.fromEntries(attempt.outcomes.map((o) => [o.id, o.outcome]));

function captureStderr() {
  const orig = process.stderr.write;
  let text = '';
  process.stderr.write = (chunk, ...rest) => {
    text += String(chunk);
    const cb = rest.find((x) => typeof x === 'function');
    if (cb) cb();
    return true;
  };
  return { text: () => text, restore: () => (process.stderr.write = orig) };
}

test('stop and resume launches two sessions in one attempt', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true });
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: fake.exec, now: NOW, ratify: okRatify });
    const claudeP = fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p');
    assert.equal(claudeP.length, 2);
    assert.match(claudeP[0].args[1], /run E5$/);
    assert.match(claudeP[1].args[1], /resume E5$/);
    const priv = JSON.parse(readFileSync(join(r.dir, 'private', 'attempts.json'), 'utf8'));
    assert.equal(priv.attempts.length, 1);
    assert.deepEqual(priv.attempts[0].sessions, [sid(1), sid(2)]);
    assert.equal(fake.calls.filter((c) => c.args[0]?.endsWith('session-metrics.mjs')).length, 2); // whole attempt + resume session alone
    assert.equal(r.aggregate.valid, 1);
    assert.equal(r.exitCode, 0);
    // a resumed session that does not finish makes the attempt invalid
    const s2 = setup();
    try {
      const failing = makeFake(s2.configDir, { stopResume: true, failOn: 2 });
      const r2 = await runBatch(baseOpts(s2, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: failing.exec, now: NOW, ratify: okRatify });
      assert.equal(r2.aggregate.attempts[0].status, 'invalid');
      assert.equal(r2.aggregate.attempts[0].reason, 'retomada-incompleta');
      assert.deepEqual(r2.aggregate.invalidReasons, { 'retomada-incompleta': 1 });
    } finally {
      s2.done();
    }
  } finally {
    s.done();
  }
});

test('plan seeded attempt is invalid when the plan was rewritten', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: 'plan-rewritten.jsonl' });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A'), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.invalid, 1);
    assert.equal(r.aggregate.valid, 0);
    assert.equal(r.aggregate.attempts[0].reason, 'plano-reescrito');
    assert.equal(r.aggregate.attempts[0].outcomes, undefined);
    assert.deepEqual(r.aggregate.invalidReasons, { 'plano-reescrito': 1 });
    assert.deepEqual(r.aggregate.outcomes, {});
    assert.equal(r.exitCode, 1);
  } finally {
    s.done();
  }
});

// Journal fixture with the blob placeholder filled in, written to a temp file.
function journalFixture(base, name, blob) {
  const file = join(base, name);
  writeFileSync(file, readFileSync(join(JOURNALS, name), 'utf8').split('{{PLAN_BLOB}}').join(blob));
  return file;
}

test('journal without the expected fields makes the attempt invalid with formato-do-diario', async () => {
  const s = setup();
  try {
    const blob = 'a'.repeat(40);
    const scenario = { seededBlobs: { [E5_PATHS.plan]: blob } };
    const check = (variant, name) => checkValidity(variant, readJournal(journalFixture(s.base, name, blob)), scenario);
    // control: the complete journal is valid
    assert.deepEqual(check('plano-semeado-A', 'plan-valid.jsonl'), { valid: true, reason: 'ok' });
    for (const name of ['bad-no-reused.jsonl', 'bad-no-blob.jsonl', 'bad-no-review1.jsonl', 'bad-no-label.jsonl']) {
      assert.deepEqual(check('plano-semeado-A', name), { valid: false, reason: 'formato-do-diario' }, name);
    }
    assert.deepEqual(check('codigo-semeado-A', 'code-no-spec1.jsonl'), { valid: false, reason: 'formato-do-diario' });
    // a line that is not JSON cannot live in fixtures/ (the privacy scan parses every fixture line), so it is built here
    const lines = readFileSync(journalFixture(s.base, 'plan-valid.jsonl', blob), 'utf8').split(/\r?\n/);
    writeFileSync(join(s.base, 'bad-not-json.jsonl'), [lines[0], '[fab] this line is not json', ...lines.slice(1)].join('\n'));
    assert.equal(readJournal(join(s.base, 'bad-not-json.jsonl')).formatError, 'line 2 is not JSON');
    assert.deepEqual(checkValidity('plano-semeado-A', readJournal(join(s.base, 'bad-not-json.jsonl')), scenario), { valid: false, reason: 'formato-do-diario' });
    assert.equal(readJournal(journalFixture(s.base, 'bad-no-label.jsonl', blob)).formatError, 'line 2 has no label');
    // CRLF, description and resultJson are accepted
    // (built here: a fixture holding a bare `description` would fail the fabricated-text scan)
    const crlfFile = join(s.base, 'crlf.jsonl');
    writeFileSync(
      crlfFile,
      [
        JSON.stringify({ description: 'E5:plan', resultJson: JSON.stringify({ reused: true }) }),
        JSON.stringify({ description: 'E5:plan-review1', resultJson: JSON.stringify({ measuredPlanBlob: blob }) }),
      ].join('\r\n') + '\r\n',
    );
    const crlf = readJournal(crlfFile);
    assert.equal(crlf.formatError, null);
    assert.deepEqual(crlf.entries.map((e) => e.label), ['E5:plan', 'E5:plan-review1']);
    assert.equal(crlf.entries[0].result.reused, true);

    const fake = makeFake(s.configDir, { journal: 'bad-no-blob.jsonl' });
    const err = captureStderr();
    let r;
    try {
      r = await runBatch(seededOpts(s, 'plano-semeado-A'), { exec: fake.exec, now: NOW });
    } finally {
      err.restore();
    }
    assert.equal(r.aggregate.invalid, 1);
    assert.equal(r.aggregate.invalidReasons['formato-do-diario'], 1);
    assert.equal(r.aggregate.attempts[0].outcomes, undefined);
    assert.match(err.text(), /journal format: 1 attempt\(s\) invalid/);
  } finally {
    s.done();
  }
});

test('missing journal makes the attempt invalid with formato-do-diario', async () => {
  const s = setup();
  try {
    assert.deepEqual(readJournal(join(s.base, 'nope.jsonl')), { entries: [], formatError: 'journal missing' });
    const fake = makeFake(s.configDir);
    const err = captureStderr();
    let r;
    try {
      r = await runBatch(seededOpts(s, 'plano-semeado-A'), { exec: fake.exec, now: NOW });
    } finally {
      err.restore();
    }
    assert.equal(r.aggregate.attempts[0].status, 'invalid');
    assert.equal(r.aggregate.attempts[0].reason, 'formato-do-diario');
  } finally {
    s.done();
  }
});

test('plan seeded outcomes come from the sentinels', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: 'plan-valid.jsonl', afterRun: fixP1P2 });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A'), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.valid, 1);
    assert.deepEqual(outcomeMap(r.aggregate.attempts[0]), { P1: 'capturado', P2: 'capturado', P3: 'perdido', P4: 'perdido' });
    assert.deepEqual(r.aggregate.outcomes.P1, { class: 'plan', detectedBy: 'reviewer', capturado: 1, perdido: 0, indeterminado: 0 });
    assert.equal(r.aggregate.outcomes.P3.perdido, 1);
    assert.deepEqual(r.aggregate.deteccaoPorCodigo, {});
  } finally {
    s.done();
  }
});

test('stopped stage leaves defects indeterminate', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: 'plan-blocked.jsonl', afterRun: fixP1P2 });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A'), { exec: fake.exec, now: NOW });
    assert.deepEqual(outcomeMap(r.aggregate.attempts[0]), { P1: 'capturado', P2: 'capturado', P3: 'indeterminado', P4: 'indeterminado' });
  } finally {
    s.done();
  }
});

test('code-detected defects go to deteccaoPorCodigo only', async () => {
  const s = setup();
  try {
    const withSignal = makeFake(s.configDir, { journal: 'plan-code-signal.jsonl' });
    const r = await runBatch(seededOpts(s, 'plano-semeado-codigo'), { exec: withSignal.exec, now: NOW });
    assert.equal(r.aggregate.valid, 1);
    assert.deepEqual(outcomeMap(r.aggregate.attempts[0]), { PX1: 'acusado-pelo-codigo', PX2: 'indeterminado', PX3: 'indeterminado' });
    assert.deepEqual(r.aggregate.deteccaoPorCodigo.PX1, { 'acusado-pelo-codigo': 1, perdido: 0, indeterminado: 0 });
    assert.deepEqual(r.aggregate.deteccaoPorCodigo.PX2, { 'acusado-pelo-codigo': 0, perdido: 0, indeterminado: 1 });
    assert.ok(!Object.keys(r.aggregate.outcomes).some((id) => id.startsWith('PX')));
  } finally {
    s.done();
  }
});

test('code seeded validity requires resumed tasks and the task 3 review', async () => {
  const s = setup();
  try {
    const redone = makeFake(s.configDir, { journal: 'code-redone.jsonl', afterRun: mergeE5 });
    const r1 = await runBatch(seededOpts(s, 'codigo-semeado-A', { work: join(s.base, 'work1') }), { exec: redone.exec, now: NOW });
    assert.equal(r1.aggregate.attempts[0].status, 'invalid');
    assert.equal(r1.aggregate.attempts[0].reason, 'tarefa-refeita');
    assert.deepEqual(r1.aggregate.invalidReasons, { 'tarefa-refeita': 1 });
    const ok = makeFake(s.configDir, { journal: 'code-valid.jsonl', afterRun: mergeE5 });
    const r2 = await runBatch(seededOpts(s, 'codigo-semeado-A', { work: join(s.base, 'work2') }), { exec: ok.exec, now: () => new Date('2026-11-10T12:00:05Z') });
    assert.equal(r2.aggregate.valid, 1);
    assert.deepEqual(Object.keys(outcomeMap(r2.aggregate.attempts[0])), ['C1', 'C2', 'C3', 'C4']);
    for (const o of r2.aggregate.attempts[0].outcomes) assert.ok(['capturado', 'perdido'].includes(o.outcome), `${o.id}: ${o.outcome}`);
    // not merged: the run stopped, so present defects are indeterminate
    const notMerged = makeFake(s.configDir, { journal: 'code-valid.jsonl' });
    const r3 = await runBatch(seededOpts(s, 'codigo-semeado-A', { work: join(s.base, 'work3') }), { exec: notMerged.exec, now: () => new Date('2026-11-10T12:00:10Z') });
    for (const o of r3.aggregate.attempts[0].outcomes) assert.ok(['capturado', 'indeterminado'].includes(o.outcome), `${o.id}: ${o.outcome}`);
  } finally {
    s.done();
  }
});

// ---- Task 13: braço atual de spec e plano (DEC-083) ----
const REPO = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).stdout.trim();
const WORKFLOW_REL = 'plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js';
const WORKFLOW = join(REPO, WORKFLOW_REL);
const ARMS = join(here, 'arms');
const ARM_FILES = ['spec-review-atual.md', 'plan-review-atual.md', 'spec-fix-atual.md', 'plan-fix-atual.md'];
const norm = (s) => s.replace(/\r\n/g, '\n');
const git = (...args) => spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });

// Returns null when the arm's "Blocks" line appears verbatim in the script; otherwise a description of the difference.
function blockListDrift(armText, scriptText) {
  const line = norm(armText).split('\n').find((l) => l.startsWith('Blocks'));
  if (!line) return 'arm has no line starting with Blocks';
  return norm(scriptText).includes(line) ? null : `block list differs from the workflow script: ${line.slice(0, 80)}...`;
}

test('current arms record the workflow commit they were copied from', () => {
  for (const f of ARM_FILES) {
    const first = norm(readFileSync(join(ARMS, f), 'utf8')).split('\n')[0];
    const m = first.match(/^Copied from: plugins\/productivity-tools\/skills\/roadmap-release\/workflow\/roadmap-release\.js at commit ([0-9a-f]{40})$/);
    assert.ok(m, `${f}: first line is ${first}`);
    assert.equal(git('cat-file', '-e', `${m[1]}^{commit}`).status, 0, `${f}: commit ${m[1]} does not exist`);
    assert.equal(git('log', '-1', '--format=%H', m[1], '--', WORKFLOW_REL).stdout.trim(), m[1], `${f}: commit ${m[1]} did not change the script`);
  }
});

test('current arms quote the workflow block list verbatim', () => {
  const script = readFileSync(WORKFLOW, 'utf8');
  for (const f of ['spec-review-atual.md', 'plan-review-atual.md']) {
    const text = readFileSync(join(ARMS, f), 'utf8');
    assert.ok(norm(text).split('\n').some((l) => l.startsWith('Blocks')), `${f}: no Blocks line`);
    assert.equal(blockListDrift(text, script), null, f);
  }
});

test('drift check fails when the block list changes', () => {
  const script = readFileSync(WORKFLOW, 'utf8');
  const arm = readFileSync(join(ARMS, 'plan-review-atual.md'), 'utf8');
  const line = norm(arm).split('\n').find((l) => l.startsWith('Blocks'));
  const changed = norm(script).replace(line, line.replace('an acceptance criterion', 'an extra an acceptance criterion'));
  assert.notEqual(changed, norm(script));
  assert.match(blockListDrift(arm, changed), /differs/);
  assert.match(blockListDrift('no such line\n', script), /no line/);
});

test('fix arms carry the issues marker', () => {
  for (const f of ['spec-fix-atual.md', 'plan-fix-atual.md']) {
    const text = readFileSync(join(ARMS, f), 'utf8');
    assert.ok(text.includes('{{issues}}'), f);
    assert.ok(text.includes('{{artifactPath}}'), f);
  }
});

// ---- Task 14: review-stage harness (DEC-083) ----
const { buildReviewOnlyScript, readArm, UsageError } = await import('./run-batch.mjs');

const jl = (...entries) => entries.map((e) => JSON.stringify({ ...e, note: '[fab] fabricated journal entry' })).join('\n') + '\n';
const planReview = (...issues) =>
  jl({ label: 'E5:plan-review1', result: { measuredPlanBlob: '{{PLAN_BLOB}}', issues } }, { label: 'E5:plan-review-fix1', result: { summary: '[fab] fix' } });
const BLOCKER = { severity: 'critical', category: 'defeito', description: '[fab] task 2 has no verification' };

// Like fixP1P2, but only the verification steps of task 2 (P1) are undone.
function fixP1(cwd) {
  gitIn(cwd, 'checkout', '-q', 'feat/E5');
  const file = join(cwd, E5_PATHS.plan);
  let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const original = taskSection(ORIGINAL_PLAN, 2).split('\n');
  const step = (n) => original.find((l) => l.startsWith(`- [ ] **Step ${n}:**`));
  text = text.replace(taskSection(text, 2), (sec) =>
    sec.split('\n').flatMap((l) => (l.startsWith('- [ ] **Step 1:**') ? [l, step(2)] : l.startsWith('- [ ] **Step 3:**') ? [l, step(4)] : [l])).join('\n'),
  );
  writeFileSync(file, text);
  gitIn(cwd, 'add', E5_PATHS.plan);
  gitIn(cwd, 'commit', '-q', '-m', 'docs(plan): E5 review fixes');
}

test('review-only script is valid JavaScript and dispatches only reviewer and fixer', () => {
  const text = buildReviewOnlyScript({ stage: 'plan-review', reviewPrompt: 'Review it', fixPrompt: 'Fix it\n{{issues}}' });
  assert.doesNotMatch(text, /^import /m);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor; // the script uses top-level await and return
  new AsyncFunction('agent', text.replace('export const', 'const'));
  assert.equal(text.split('agent(').length - 1, 2);
  assert.ok(text.includes("'E5:plan-review1'"));
  assert.ok(text.includes("'E5:plan-review-fix1'"));
  assert.ok(text.includes("name: 'review-only'"));
});

test('task-review atual dispatches the real task-reviewer agent; other stages and arms stay general-purpose', async () => {
  const withType = buildReviewOnlyScript({ stage: 'task-review', reviewPrompt: 'Mode: spec.', fixPrompt: 'Fix', agentType: 'productivity-tools:task-reviewer' });
  assert.ok(withType.includes("agentType: 'productivity-tools:task-reviewer'"));
  assert.equal(withType.split('agentType').length - 1, 1);
  assert.equal(buildReviewOnlyScript({ stage: 'plan-review', reviewPrompt: 'R', fixPrompt: 'F' }).includes('agentType'), false);
  const s = setup();
  try {
    const code = makeFake(s.configDir, { journal: jl({ label: 'E5:task-review1', result: { issues: [] } }), afterRun: mergeE5 });
    await runBatch(seededOpts(s, 'codigo-semeado-A', { stage: 'task-review', reviewModel: 'sonnet' }), { exec: code.exec, now: NOW });
    const sent = code.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');
    assert.ok(readFileSync(join(sent.cwd, 'review-only.js'), 'utf8').includes("agentType: 'productivity-tools:task-reviewer'"));
  } finally {
    s.done();
  }
});

test('harness launches with the sandbox root on feat/E5 and the seeded blob at HEAD', async () => {
  const s = setup();
  try {
    const seen = [];
    const afterRun = (cwd) => {
      seen.push({
        branch: gitq(cwd, 'rev-parse', '--abbrev-ref', 'HEAD'),
        blob: gitIn(cwd, 'rev-parse', `HEAD:${E5_PATHS.plan}`).status,
      });
      fixP1(cwd);
    };
    const fake = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun });
    await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', arm: 'atual' }), { exec: fake.exec, now: NOW });
    assert.ok(seen.length > 0);
    for (const x of seen) assert.deepEqual(x, { branch: 'feat/E5', blob: 0 });
  } finally {
    s.done();
  }
});

test('harness writes the script in the sandbox and launches it with Workflow allowed', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun: fixP1 });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', arm: 'atual' }), { exec: fake.exec, now: NOW });
    const call = fake.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');
    assert.ok(existsSync(join(call.cwd, 'review-only.js')));
    assert.match(call.args[call.args.indexOf('--allowedTools') + 1], /Workflow/);
    assert.ok(call.args[1].includes('review-only.js'));
    assert.equal(gitIn(call.cwd, 'status', '--porcelain').stdout.trim(), '');
    assert.equal(r.aggregate.valid, 1);
  } finally {
    s.done();
  }
});

test('harness outcomes come from the sentinels', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun: fixP1 });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review' }), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.valid, 1);
    assert.deepEqual(outcomeMap(r.aggregate.attempts[0]), { P1: 'capturado', P2: 'perdido', P3: 'perdido', P4: 'perdido' });
    // a fixer that changed nothing leaves the stage stopped
    const idle = makeFake(s.configDir, { journal: planReview(BLOCKER) });
    const r2 = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', work: join(s.base, 'work2') }), {
      exec: idle.exec,
      now: () => new Date('2026-11-10T12:00:05Z'),
    });
    for (const o of r2.aggregate.attempts[0].outcomes) assert.equal(o.outcome, 'indeterminado', o.id);
  } finally {
    s.done();
  }
});

test('stage and variant must match', async () => {
  const s = setup();
  try {
    const common = ['--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'];
    const r = spawnSync(process.execPath, [script, '--variant', 'plano-semeado-A', '--stage', 'spec-review', ...common], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /spec-review/);
    const bad = spawnSync(process.execPath, [script, '--variant', 'plano-semeado-A', '--stage', 'nonsense', ...common], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    await assert.rejects(runBatch(seededOpts(s, 'completo', { stage: 'task-review' }), { exec: makeFake(s.configDir).exec }), UsageError);
  } finally {
    s.done();
  }
});

test('harness aggregate records the arm source and workflow commit', async () => {
  const s = setup();
  try {
    const first = norm(readFileSync(join(ARMS, 'plan-review-atual.md'), 'utf8')).split('\n')[0];
    const sha = first.match(/commit ([0-9a-f]{40})$/)[1];
    const fake = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun: fixP1 });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', arm: 'atual' }), { exec: fake.exec, now: NOW });
    assert.deepEqual(r.aggregate.harness, { stage: 'plan-review', arm: 'atual', armSource: 'copia-do-prompt', workflowCommit: sha, armCommits: { review: sha, fix: sha, fixCheck: null }, harnessCommit: HEAD, rounds: 'single' });
    const sent = fake.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');
    const scriptText = readFileSync(join(sent.cwd, 'review-only.js'), 'utf8');
    assert.ok(!scriptText.includes('Copied from:'));
    assert.ok(!scriptText.includes('{{artifactPath}}'));

    const code = makeFake(s.configDir, { journal: jl({ label: 'E5:task-review1', result: { issues: [] } }), afterRun: mergeE5 });
    const rc = await runBatch(seededOpts(s, 'codigo-semeado-A', { stage: 'task-review', reviewModel: 'sonnet', work: join(s.base, 'work2') }), {
      exec: code.exec,
      now: () => new Date('2026-11-10T12:00:05Z'),
    });
    assert.deepEqual(rc.aggregate.harness, { stage: 'task-review', arm: 'atual', armSource: 'workflow', workflowCommit: null, armCommits: { review: null, fix: null, fixCheck: null }, harnessCommit: HEAD, reviewModel: 'sonnet', reviewEffort: 'medium', rounds: 'single' });
    assert.equal(rc.aggregate.valid, 1);

    const plain = makeFake(s.configDir);
    const rp = await runBatch(baseOpts(s, { runs: 1, work: join(s.base, 'work3') }), { exec: plain.exec, now: () => new Date('2026-11-10T12:00:10Z') });
    assert.equal(rp.aggregate.harness, undefined);
  } finally {
    s.done();
  }
});

test('harness refuses a current arm template without the source line', async () => {
  const s = setup();
  try {
    const armsDir = join(s.base, 'arms');
    mkdirSync(armsDir);
    for (const f of readdirSync(ARMS)) writeFileSync(join(armsDir, f), norm(readFileSync(join(ARMS, f), 'utf8')));
    writeFileSync(join(armsDir, 'plan-review-atual.md'), norm(readFileSync(join(ARMS, 'plan-review-atual.md'), 'utf8')).split('\n').slice(1).join('\n'));
    assert.throws(() => readArm(join(armsDir, 'plan-review-atual.md'), { requireSource: true }), UsageError);
    assert.equal(readArm(join(armsDir, 'plan-review-atual.md'), { requireSource: false }).source, null);
    const fake = makeFake(s.configDir);
    await assert.rejects(runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', armsDir }), { exec: fake.exec }), UsageError);
    assert.equal(fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p').length, 0);
    const cli = spawnSync(
      process.execPath,
      [script, '--variant', 'plano-semeado-A', '--stage', 'plan-review', '--arms-dir', armsDir, '--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'],
      { encoding: 'utf8' },
    );
    assert.equal(cli.status, 2);
    // a reader of a good template strips the source line from the prompt text
    const good = readArm(join(ARMS, 'plan-review-atual.md'), { requireSource: true });
    assert.match(good.source.commit, /^[0-9a-f]{40}$/);
    assert.ok(!good.text.includes('Copied from:'));
  } finally {
    s.done();
  }
});

// ---- Final fix: review agents of rounds above 1 and the real release outcome on code variants ----

test('toAttemptCounters keeps reviewers of rounds above 1 out of structural and bytes', () => {
  const calls = (h, s, o) => ({ haiku: h, sonnet: s, opus: o, fable: 0, other: 0 });
  const cnt = (c, b, cost) => ({ calls: c, promptBytes: b, tokens: {}, cost, unpriced: [] });
  const run = {
    roles: { spec: { ...cnt(calls(0, 1, 0), 10, 1), agents: 1 }, 'plan-review': { ...cnt(calls(0, 0, 2), 8, 1), agents: 2 } },
    total: cnt(calls(0, 1, 2), 18, 2),
    reviewRounds: { loops: { 'plan-review': 2 }, extra: 1, extraAgents: cnt(calls(0, 0, 1), 4, 1) },
    tasks: { count: 0, loop: cnt(calls(0, 0, 0), 0, null) },
    main: { turns: 1, agentCalls: {}, promptBytes: 0, tokens: {}, cost: 0 },
  };
  const c = toAttemptCounters(run);
  assert.deepEqual(c.structural, { haiku: 0, sonnet: 1, opus: 1, fable: 0, other: 0, weighted: 20 + 40 });
  assert.equal(c.bytes, 14);
  assert.equal(c.conditional.extraRounds, 1);
});

const gitq = (cwd, ...a) => {
  const r = gitIn(cwd, ...a);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

// Like the release for a merged deliverable: feat/E5 is merged into release/sandbox and the cleanup
// deletes the branch (keepBranches false).
const mergeAndDeleteBranch = (cwd) => {
  gitq(cwd, 'checkout', '-q', '-B', 'release/sandbox', 'main');
  gitq(cwd, 'merge', '-q', '--no-ff', '-m', 'merge feat/E5', 'feat/E5');
  gitq(cwd, 'branch', '-d', 'feat/E5'); // from the release branch, like the cleanup in the integration worktree
  gitq(cwd, 'checkout', '-q', 'main');
};

test('code outcomes are measured after the release cleanup deleted the merged branch', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: 'code-valid.jsonl', afterRun: mergeAndDeleteBranch });
    const r = await runBatch(seededOpts(s, 'codigo-semeado-A'), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.valid, 1);
    const outcomes = r.aggregate.attempts[0].outcomes;
    assert.equal(outcomes.length, 4);
    // merged with the seeded defects still in the code: approved stage, so they are lost, never unmeasured
    for (const o of outcomes) assert.equal(o.outcome, 'perdido', o.id);
  } finally {
    s.done();
  }
});

test('code outcomes are measured while feat/E5 is still held by a release worktree', async () => {
  const s = setup();
  try {
    const heldByWorktree = (cwd) => {
      gitq(cwd, 'checkout', '-q', '-B', 'release/sandbox', 'main');
      gitq(cwd, 'merge', '-q', '--no-ff', '-m', 'merge feat/E5', 'feat/E5');
      gitq(cwd, 'checkout', '-q', 'main');
      gitq(cwd, 'worktree', 'add', join(cwd, '..', 'release-wt-held'), 'feat/E5');
    };
    const fake = makeFake(s.configDir, { journal: 'code-valid.jsonl', afterRun: heldByWorktree });
    const r = await runBatch(seededOpts(s, 'codigo-semeado-A'), { exec: fake.exec, now: NOW });
    for (const o of r.aggregate.attempts[0].outcomes) assert.equal(o.outcome, 'perdido', o.id);
  } finally {
    s.done();
  }
});

// ---- superpowers, --from-run and the seed source (E15 T2) ----

const SP_SHA = 'fab0000000000000000000000000000000000007';

function writeSuperpowers(configDir) {
  const file = join(configDir, 'plugins', 'installed_plugins.json');
  const j = JSON.parse(readFileSync(file, 'utf8'));
  j.plugins['superpowers@claude-plugins-official'] = [{ version: '7.0.0', gitCommitSha: SP_SHA }];
  writeFileSync(file, JSON.stringify(j));
}

function approvedRun(base) {
  const specDir = join(base, 'docs', 'superpowers', 'specs');
  const planDir = join(base, 'docs', 'superpowers', 'plans');
  mkdirSync(specDir, { recursive: true });
  mkdirSync(planDir, { recursive: true });
  const rd = (f) => readFileSync(join(here, 'scenario', 'e5', f), 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(join(specDir, '2026-01-01-E5-x-design.md'), rd('spec.md') + '[fab] extra line\n');
  writeFileSync(join(planDir, '2026-01-01-E5-x.md'), rd('plan.md') + '[fab] extra line\n');
}

test('aggregate records the superpowers version', async () => {
  const s = setup();
  try {
    writeSuperpowers(s.configDir);
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s, { runs: 1 }), { exec: fake.exec, now: NOW });
    assert.deepEqual(r.aggregate.superpowers, { version: '7.0.0', commit: SP_SHA });
  } finally {
    s.done();
  }
});

test('missing superpowers is recorded as ausente', async () => {
  const s = setup();
  const err = captureStderr();
  try {
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s, { runs: 1 }), { exec: fake.exec, now: NOW });
    assert.deepEqual(r.aggregate.superpowers, { version: 'ausente', commit: 'ausente' });
    assert.match(err.text(), /superpowers/);
  } finally {
    err.restore();
    s.done();
  }
});

test('seeded variant with --from-run seeds from the given folder and records its source', async () => {
  const s = setup();
  const folder = join(s.base, 'approved');
  try {
    approvedRun(folder);
    const fake = makeFake(s.configDir, { journal: 'plan-valid.jsonl' });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A', { fromRun: folder }), { exec: fake.exec, now: NOW });
    const sandbox = join(s.work, 'plano-semeado-A-1');
    assert.match(readFileSync(join(sandbox, E5_PATHS.plan), 'utf8'), /\[fab\] extra line/);
    assert.equal(r.aggregate.seedSource.kind, 'execucao-aprovada');
    assert.equal(r.aggregate.seedSource.planSha256, seedSourceOf(folder).planSha256);
    const text = readFileSync(join(r.dir, 'aggregate.json'), 'utf8');
    assert.ok(!text.includes(folder));
    assert.ok(!text.includes(folder.replaceAll(String.fromCharCode(92), '/')));
    assert.ok(!text.includes(JSON.stringify(folder).slice(1, -1)));
  } finally {
    s.done();
  }
});

test('seeded variant without --from-run records a synthetic source', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: 'plan-valid.jsonl' });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A'), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.seedSource.kind, 'sintetico');
  } finally {
    s.done();
  }
});

test('unseeded variant has no seedSource', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s, { runs: 1 }), { exec: fake.exec, now: NOW });
    assert.equal('seedSource' in r.aggregate, false);
  } finally {
    s.done();
  }
});

test('--from-run on an unseeded variant is a usage error', async () => {
  const s = setup();
  const folder = join(s.base, 'approved');
  try {
    approvedRun(folder);
    const fake = makeFake(s.configDir);
    await assert.rejects(runBatch({ ...baseOpts(s), variant: 'completo', fromRun: folder }, { exec: fake.exec, now: NOW }), (e) => e.name === 'UsageError');
    assert.equal(existsSync(s.work), false);
    assert.equal(existsSync(s.out), false);
    const r = spawnSync(process.execPath, [script, '--variant', 'completo', '--runs', '1', '--work', s.work, '--out', s.out,
      '--config-dir', s.configDir, '--permission-mode', 'acceptEdits', '--from-run', folder], { encoding: 'utf8' });
    assert.equal(r.status, 2);
  } finally {
    s.done();
  }
});

test('stopOnDenial stops the batch at the first denied attempt (DEC-194)', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { denyOn: 2 });
    const r = await runBatch(baseOpts(s, { runs: 3, stopOnDenial: true }), { exec: fake.exec, now: () => new Date('2026-11-10T12:00:00Z') });
    assert.equal(r.exitCode, 1);
    assert.deepEqual(r.aggregate.attempts.map((a) => [a.n, a.status]), [[1, 'valid'], [2, 'denied']]);
    assert.equal(r.aggregate.denied, 1);
    assert.equal(r.aggregate.valid, 1);
  } finally {
    s.done();
  }
});

test('CLI parses --stop-on-denial as a flag (DEC-194)', () => {
  const r = spawnSync(process.execPath, [join(here, 'run-batch.mjs'), '--stop-on-denial', '--variant', 'x'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:.*--stop-on-denial/);
});

test('releaseRunValidity marks a release run without any subagent as sem-agentes', () => {
  const zero = { total: { calls: { haiku: 0, sonnet: 0, opus: 0, fable: 0, other: 0 } } };
  const some = { total: { calls: { haiku: 0, sonnet: 2, opus: 0, fable: 0, other: 0 } } };
  for (const v of ['completo', 'parada-retomada', 'coordinator']) {
    assert.deepEqual(releaseRunValidity(v, zero), { valid: false, reason: 'sem-agentes' });
    assert.equal(releaseRunValidity(v, some).valid, true);
  }
  assert.equal(releaseRunValidity('plan-only', zero).valid, true);
  assert.equal(releaseRunValidity('codigo-semeado-A', zero).valid, true);
});

test('execEnv: claude espera as tarefas em segundo plano; outros comandos ficam com o ambiente dado', () => {
  const base = { PATH: 'x' };
  assert.deepEqual(execEnv('claude', base), { PATH: 'x', CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0' });
  assert.equal(execEnv('git', base), base);
  assert.equal(base.CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS, undefined);
});

test('e5Integrated: verdadeiro só com o merge de E5 na primeira linha de release/sandbox', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e5int-'));
  try {
    const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
    g('init', '-q', '-b', 'main');
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
    assert.equal(e5Integrated(dir), false);
    g('branch', 'release/sandbox');
    assert.equal(e5Integrated(dir), false);
    g('checkout', '-q', 'release/sandbox');
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'merge: E5 in release/sandbox');
    assert.equal(e5Integrated(dir), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Real Workflow journal shape (synthetic): launched, started/result pairs keyed by key, results without a label.
function realJournal(base, { reused = true, blob = 'b'.repeat(40), orphanResult = false } = {}) {
  const pair = (key, agentId, label, result) => [
    { type: 'started', key, agentId, label, phase: 'P' },
    { type: 'result', key, agentId, result },
  ];
  const lines = [
    { type: 'launched' },
    ...pair('v2:k1', 'a1', 'E5:plan', { reused }),
    ...pair('v2:k2', 'a2', 'E5:plan-review1', { measuredPlanBlob: blob }),
    { type: 'started', key: 'v2:k3', agentId: 'a3', label: 'E5:status-plan', phase: 'P' },
    { type: 'note', info: 'unknown housekeeping' },
    ...(orphanResult ? [{ type: 'result', key: 'v2:zz', agentId: 'azz', result: { x: 1 } }] : []),
  ];
  const file = join(base, orphanResult ? 'real-orphan.jsonl' : `real-${reused}.jsonl`);
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\r\n') + '\r\n');
  return file;
}

test('readJournal resolves the labels of a real-format journal from the started lines', () => {
  const s = setup();
  try {
    const j = readJournal(realJournal(s.base));
    assert.equal(j.formatError, null);
    assert.deepEqual(j.entries.map((e) => e.label), ['E5:plan', 'E5:plan-review1']);
    assert.deepEqual(j.entries[0].result, { reused: true });
    assert.equal(j.entries[1].result.measuredPlanBlob, 'b'.repeat(40));
    assert.equal(JSON.parse(j.entries[0].text).type, 'result');
    // a result matched by agentId when the key is unknown
    const f = join(s.base, 'by-agent.jsonl');
    writeFileSync(f, [{ type: 'started', key: 'k', agentId: 'a', label: 'L' }, { type: 'result', key: 'other', agentId: 'a', result: { ok: 1 } }].map((l) => JSON.stringify(l)).join('\n'));
    assert.deepEqual(readJournal(f).entries.map((e) => e.label), ['L']);
    // a result without a started label is a format error; the old format is unchanged
    assert.equal(readJournal(realJournal(s.base, { orphanResult: true })).formatError, 'line 8: result without a started label');
    const old = join(s.base, 'old.jsonl');
    writeFileSync(old, JSON.stringify({ label: 'E5:plan', result: { reused: true } }) + '\n' + JSON.stringify({ result: {} }) + '\n');
    assert.equal(readJournal(old).formatError, 'line 2 has no label');
    assert.equal(readJournal(old).entries.length, 1);
  } finally {
    s.done();
  }
});

test('checkValidity on a real-format journal reports plano-reescrito, not formato-do-diario', () => {
  const s = setup();
  try {
    const blob = 'b'.repeat(40);
    const scenario = { seededBlobs: { [E5_PATHS.plan]: blob } };
    assert.deepEqual(checkValidity('plano-semeado-A', readJournal(realJournal(s.base, { reused: false })), scenario), { valid: false, reason: 'plano-reescrito' });
    assert.deepEqual(checkValidity('plano-semeado-A', readJournal(realJournal(s.base, { reused: true })), scenario), { valid: true, reason: 'ok' });
  } finally {
    s.done();
  }
});

test('checkValidity: código que parou na revisão de spec ou plano é parou-antes-do-codigo, não formato', () => {
  const e = (label) => ({ label, result: {}, text: '' });
  const stopped = { formatError: null, entries: ['E5:spec', 'E5:spec-review1', 'E5:status-blocked', 'report'].map(e) };
  assert.deepEqual(checkValidity('codigo-semeado-A', stopped, {}), { valid: false, reason: 'parou-antes-do-codigo' });
  const noTask = { formatError: null, entries: ['E5:spec', 'E5:plan'].map(e) };
  assert.equal(checkValidity('codigo-semeado-A', noTask, {}).reason, 'formato-do-diario');
  const ok = { formatError: null, entries: ['E5:status-blocked', 'E5:t3:spec1', 'E5:t4:impl'].map(e) };
  assert.equal(checkValidity('codigo-semeado-A', ok, {}).valid, true);
});

// ---- E17 T2: registry panel read by the measured plugin's CLI, per attempt ----

test('E17: readPlugin returns installPath', () => {
  const s = setup({ withPlugins: false });
  try {
    const file = join(s.configDir, 'plugins', 'installed_plugins.json');
    writeFileSync(file, JSON.stringify({ plugins: { 'productivity-tools@claude-play': [{ version: '1.7.0', gitCommitSha: 'abc1234', installPath: '/c/x' }] } }));
    assert.deepEqual(readPlugin(s.configDir), { version: '1.7.0', commit: 'abc1234', installPath: '/c/x' });
    writeFileSync(file, JSON.stringify({ plugins: { 'productivity-tools@claude-play': [{ version: '1.7.0', gitCommitSha: 'abc1234' }] } }));
    assert.deepEqual(readPlugin(s.configDir), { version: '1.7.0', commit: 'abc1234', installPath: 'unknown' });
  } finally {
    s.done();
  }
});

test('E17: panelMatches accepts the expected panel per variant', () => {
  assert.deepEqual(PANEL_VARIANTS, ['plan-only', 'completo', 'parada-retomada']);
  assert.equal(EXPECTED_PANEL.completo.status, 'on-branch');
  const good = { e5Status: 'on-branch', e5Evidence: 'merge abc1234', mergeCommit: 'abc1234def', checkerErrors: 0 };
  assert.equal(panelMatches('completo', good).ok, true);
  const wrong = panelMatches('completo', { ...good, e5Status: 'integrated' });
  assert.equal(wrong.ok, false);
  assert.ok(wrong.reasons.some((r) => r.includes('integrated')));
  assert.equal(panelMatches('completo', { ...good, checkerErrors: 2 }).ok, false);
  assert.equal(panelMatches('completo', { error: 'x' }).ok, false);
  assert.equal(panelMatches('completo', { ...good, e5Evidence: 'nothing' }).ok, false);
  assert.equal(panelMatches('completo', { ...good, mergeCommit: null }).ok, false);
  assert.equal(panelMatches('plan-only', { e5Status: 'plan', mergeCommit: null, checkerErrors: 0, e5Evidence: '' }).ok, true);
});

test('E17: readPanel never throws', () => {
  const s = setup();
  try {
    const sandbox = join(s.base, 'nope');
    assert.ok(readPanel(sandbox, '/nope', { exec: () => ({ status: 0, stdout: 'not json' }) }).error);
    assert.ok(readPanel(sandbox, '/nope', { exec: () => { throw new Error('boom'); } }).error);
    assert.ok(readPanel(sandbox, '/nope').error);
  } finally {
    s.done();
  }
});

test('E17: readPanel reads the E5 row, the merge commit and the checker errors', () => {
  const s = setup();
  try {
    const sandbox = join(s.base, 'sb');
    mkdirSync(sandbox, { recursive: true });
    gitIn(sandbox, 'init', '-q', '-b', 'main');
    gitIn(sandbox, 'commit', '-q', '--allow-empty', '-m', 'seed');
    gitIn(sandbox, 'checkout', '-q', '-b', 'release/sandbox');
    gitIn(sandbox, 'commit', '-q', '--allow-empty', '-m', 'merge: E5 in release/sandbox');
    const sha = gitIn(sandbox, 'rev-parse', 'HEAD').stdout.trim();
    gitIn(sandbox, 'checkout', '-q', 'main');
    const exec = (cmd, args) => {
      assert.equal(cmd, process.execPath);
      if (/[\\/]roadmap\.mjs$/.test(args[0])) {
        assert.deepEqual(args.slice(1), ['status', 'docs/plans/roadmap-sandbox', '--json']);
        const panel = [{ id: 'E4', segments: [{ word: 'plan' }], evidence: '-' }, { id: 'E5', segments: [{ word: 'on-branch' }], evidence: `merge \`${sha.slice(0, 7)}\`` }];
        return { status: 0, stdout: JSON.stringify({ result: { panel } }) };
      }
      return { status: 1, stdout: JSON.stringify({ errors: [{}, {}], summary: { errors: 2 } }) };
    };
    const p = readPanel(sandbox, '/inst', { exec });
    assert.deepEqual(p, { e5Status: 'on-branch', e5Evidence: `merge \`${sha.slice(0, 7)}\``, mergeCommit: sha, checkerErrors: 2 });
    assert.equal(gitIn(sandbox, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim(), 'main');
    assert.equal(panelMatches('completo', { ...p, checkerErrors: 0 }).ok, true);
    assert.equal(readPanel(join(s.base, 'sb'), '/inst', { exec: () => ({ status: 3, stdout: '' }) }).error !== undefined, true);
  } finally {
    s.done();
  }
});

test('E17: readPanel works when release/sandbox is held by another worktree and leaves no worktree behind', () => {
  const s = setup();
  try {
    const sandbox = join(s.base, 'sbw');
    mkdirSync(sandbox, { recursive: true });
    gitIn(sandbox, 'init', '-q', '-b', 'main');
    gitIn(sandbox, 'commit', '-q', '--allow-empty', '-m', 'seed');
    gitIn(sandbox, 'branch', 'release/sandbox');
    const held = join(s.base, 'sbw-wt', '_integracao');
    assert.equal(gitIn(sandbox, 'worktree', 'add', '-q', held, 'release/sandbox').status, 0);
    const before = gitIn(sandbox, 'worktree', 'list', '--porcelain').stdout;
    const seen = [];
    const exec = (cmd, args, opts) => {
      seen.push(opts.cwd);
      if (/[\\/]roadmap\.mjs$/.test(args[0])) return { status: 0, stdout: JSON.stringify({ result: { panel: [{ id: 'E1', segments: [{ word: 'plan' }], evidence: '-' }, { id: 'E5', segments: [{ word: 'not-started' }], evidence: '-' }] } }) };
      return { status: 0, stdout: JSON.stringify({ summary: { errors: 0 } }) };
    };
    const p = readPanel(sandbox, '/inst', { exec, deliverable: 'E1' });
    assert.equal(p.error, undefined);
    assert.equal(p.e5Status, 'plan');
    assert.ok(seen.every((c) => c !== sandbox));
    assert.equal(gitIn(sandbox, 'worktree', 'list', '--porcelain').stdout, before);
    assert.equal(gitIn(sandbox, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim(), 'main');
  } finally {
    s.done();
  }
});

test('E17: the panel row of each variant is the deliverable its prompt targets', async () => {
  const { makeScenario } = await import('./make-scenario.mjs');
  for (const v of PANEL_VARIANTS) {
    const dir = mkdtempSync(join(tmpdir(), 'pv-'));
    try {
      const sc = await makeScenario(dir, v);
      assert.ok(sc.prompts.every((pr) => pr.endsWith(` ${EXPECTED_PANEL[v].deliverable}`)), `${v}: ${sc.prompts.join(' | ')}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  assert.equal(EXPECTED_PANEL['plan-only'].deliverable, 'E1');
});

test('E17: readPanel reports a missing release/sandbox', () => {
  const s = setup();
  try {
    const sandbox = join(s.base, 'sb2');
    mkdirSync(sandbox, { recursive: true });
    gitIn(sandbox, 'init', '-q', '-b', 'main');
    gitIn(sandbox, 'commit', '-q', '--allow-empty', '-m', 'seed');
    assert.deepEqual(readPanel(sandbox, '/inst', { exec: () => ({ status: 0, stdout: '{}' }) }), { error: 'release/sandbox missing' });
  } finally {
    s.done();
  }
});

test('E17: release attempts carry panel, other variants do not', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s, { variant: 'completo', runs: 1 }), { exec: fake.exec, now: NOW });
    assert.ok('panel' in r.aggregate.attempts[0]);
    assert.ok(r.aggregate.attempts[0].panel.error);
    const t = await runBatch(baseOpts(s, { variant: 'planner', runs: 1 }), { exec: makeFake(s.configDir).exec, now: NOW });
    assert.equal('panel' in t.aggregate.attempts[0], false);
  } finally {
    s.done();
  }
});

test('E17: panel error texts carry no path', () => {
  const win = ['C:', 'Users', 'someone', 'AppData', 'Local', 'Temp', 'panel-1', 'wt'].join('\\');
  assert.equal(redactPaths("fatal: '" + win + "' failed /tmp/panel-1/wt"), "fatal: '<path>' failed <path>");
  assert.equal(redactPaths('roadmap.mjs exited 2'), 'roadmap.mjs exited 2');
});

// ---- E17: parada-retomada ratifica as decisões de contrato de E5 entre as sessões (D2) e invalida retomada sem agentes (D3)

function ratifySandbox(s, { holdInWorktree = false } = {}) {
  const sandbox = join(s.base, 'rsb');
  mkdirSync(sandbox, { recursive: true });
  gitIn(sandbox, 'init', '-q', '-b', 'main');
  gitIn(sandbox, 'commit', '-q', '--allow-empty', '-m', 'seed');
  gitIn(sandbox, 'branch', 'release/sandbox');
  let held = null;
  if (holdInWorktree) {
    held = join(s.base, 'rsb-wt');
    assert.equal(gitIn(sandbox, 'worktree', 'add', '-q', held, 'release/sandbox').status, 0);
  }
  return { sandbox, held };
}

// Fake tracker CLI: keeps the pending list in memory; `ratify` clears the given ids and writes a file in cwd.
function fakeTracker(pending, { keep = [], status = 0 } = {}) {
  const calls = [];
  const exec = (cmd, args, o) => {
    calls.push({ cmd, args, cwd: o.cwd });
    assert.equal(cmd, process.execPath);
    assert.match(args[0], /roadmap-tracker[\\/]scripts[\\/]roadmap\.mjs$/);
    const sub = args[1];
    assert.equal(args[2], 'docs/plans/roadmap-sandbox');
    if (sub === 'pending-decisions') {
      assert.ok(args.includes('--json'));
      return { status: 0, stdout: JSON.stringify({ result: { decisions: pending } }) };
    }
    if (sub === 'ratify') {
      const ids = args.slice(3).filter((a) => /^DEC-\d+$/.test(a));
      mkdirSync(join(o.cwd, 'docs', 'plans', 'roadmap-sandbox'), { recursive: true });
      writeFileSync(join(o.cwd, 'docs', 'plans', 'roadmap-sandbox', 'decisions.md'), `ratified ${ids.join(',')}\n`);
      for (let i = pending.length - 1; i >= 0; i--) if (ids.includes(pending[i].id) && !keep.includes(pending[i].id)) pending.splice(i, 1);
      return { status, stdout: JSON.stringify({ result: { ids } }) };
    }
    throw new Error(`unexpected ${sub}`);
  };
  return { exec, calls };
}

const dec = (id, deliverable, scope) => ({ id, deliverable, scope, startedDependents: [], released: false });

test('E17 D2: ratifyE5Contract ratifies only E5 contract decisions in the release/sandbox worktree and commits', () => {
  const s = setup();
  try {
    const { sandbox } = ratifySandbox(s);
    const pending = [dec('DEC-501', 'E5', 'contract'), dec('DEC-502', 'E5', 'local'), dec('DEC-503', 'E6', 'contract'), dec('DEC-504', 'E4, E5', 'contract')];
    const t = fakeTracker(pending);
    const r = ratifyE5Contract(sandbox, '/inst', { exec: t.exec });
    assert.deepEqual(r, { ok: true, ratified: ['DEC-501', 'DEC-504'] });
    const ratifyCall = t.calls.find((c) => c.args[1] === 'ratify');
    assert.deepEqual(ratifyCall.args.slice(1), ['ratify', 'docs/plans/roadmap-sandbox', 'DEC-501', 'DEC-504', '--json']);
    assert.deepEqual(pending.map((p) => p.id), ['DEC-502', 'DEC-503']);
    // the commit is on release/sandbox, the temporary worktree is gone and the sandbox root stays on main
    assert.match(gitIn(sandbox, 'log', '-1', '--format=%s', 'release/sandbox').stdout, /ratif/i);
    assert.equal(gitIn(sandbox, 'show', 'release/sandbox:docs/plans/roadmap-sandbox/decisions.md').stdout.trim(), 'ratified DEC-501,DEC-504');
    assert.equal(gitIn(sandbox, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim(), 'main');
    assert.equal(gitIn(sandbox, 'worktree', 'list', '--porcelain').stdout.split('worktree ').length - 1, 1);
  } finally {
    s.done();
  }
});

test('E17 D2: ratifyE5Contract uses the worktree that already holds release/sandbox', () => {
  const s = setup();
  try {
    const { sandbox, held } = ratifySandbox(s, { holdInWorktree: true });
    const t = fakeTracker([dec('DEC-501', 'E5', 'contract')]);
    const r = ratifyE5Contract(sandbox, '/inst', { exec: t.exec });
    assert.equal(r.ok, true);
    assert.ok(t.calls.every((c) => resolve(c.cwd) === resolve(held)));
    assert.equal(gitIn(held, 'status', '--porcelain').stdout.trim(), '');
    assert.equal(gitIn(sandbox, 'rev-parse', 'release/sandbox').stdout, gitIn(held, 'rev-parse', 'HEAD').stdout);
  } finally {
    s.done();
  }
});

test('E17 D2: ratifyE5Contract with nothing to ratify changes nothing; a decision left pending is a failure', () => {
  const s = setup();
  try {
    const { sandbox } = ratifySandbox(s);
    const before = gitIn(sandbox, 'rev-parse', 'release/sandbox').stdout;
    const none = fakeTracker([dec('DEC-502', 'E5', 'local')]);
    assert.deepEqual(ratifyE5Contract(sandbox, '/inst', { exec: none.exec }), { ok: true, ratified: [] });
    assert.equal(none.calls.some((c) => c.args[1] === 'ratify'), false);
    assert.equal(gitIn(sandbox, 'rev-parse', 'release/sandbox').stdout, before);
    const left = fakeTracker([dec('DEC-501', 'E5', 'contract')], { keep: ['DEC-501'] });
    const r = ratifyE5Contract(sandbox, '/inst', { exec: left.exec });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'decisao-pendente-apos-ratificar');
  } finally {
    s.done();
  }
});

test('E17 D2: ratifyE5Contract never throws: missing branch, CLI failure and bad JSON are { ok: false }', () => {
  const s = setup();
  try {
    const bare = join(s.base, 'bare');
    mkdirSync(bare, { recursive: true });
    gitIn(bare, 'init', '-q', '-b', 'main');
    gitIn(bare, 'commit', '-q', '--allow-empty', '-m', 'seed');
    const miss = ratifyE5Contract(bare, '/inst', { exec: () => ({ status: 0, stdout: '{}' }) });
    assert.equal(miss.ok, false);
    assert.equal(miss.reason, 'ratificacao-falhou');
    const { sandbox } = ratifySandbox(s);
    assert.equal(ratifyE5Contract(sandbox, '/inst', { exec: () => ({ status: 2, stdout: '' }) }).ok, false);
    assert.equal(ratifyE5Contract(sandbox, '/inst', { exec: () => ({ status: 0, stdout: 'nope' }) }).ok, false);
    assert.equal(ratifyE5Contract(sandbox, '/inst', { exec: () => { throw new Error('boom'); } }).ok, false);
    const bad = fakeTracker([dec('DEC-501', 'E5', 'contract')], { status: 1 });
    assert.equal(ratifyE5Contract(sandbox, '/inst', { exec: bad.exec }).ok, false);
  } finally {
    s.done();
  }
});

test('E17 D3: resumeRunValidity marks a resume session without any subagent as retomada-sem-agentes', () => {
  const zero = { total: { calls: { haiku: 0, sonnet: 0, opus: 0, fable: 0, other: 0 } } };
  const some = { total: { calls: { haiku: 0, sonnet: 1, opus: 0, fable: 0, other: 0 } } };
  assert.deepEqual(resumeRunValidity(zero), { valid: false, reason: 'retomada-sem-agentes' });
  assert.deepEqual(resumeRunValidity(some), { valid: true, reason: 'ok' });
  assert.deepEqual(resumeRunValidity(undefined), { valid: false, reason: 'retomada-sem-agentes' });
});

test('E17 D2: runBatch ratifies between the two sessions of parada-retomada', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true });
    const ratify = (sandbox, installPath) => {
      fake.calls.push({ cmd: 'ratify', args: [], cwd: sandbox, installPath });
      return { ok: true, ratified: ['DEC-1'] };
    };
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: fake.exec, now: NOW, ratify });
    const order = fake.calls.filter((c) => c.cmd === 'ratify' || (c.cmd === 'claude' && c.args[0] === '-p')).map((c) => c.cmd);
    assert.deepEqual(order, ['claude', 'ratify', 'claude']);
    assert.match(fake.calls.find((c) => c.cmd === 'ratify').installPath, /productivity-tools[\\/]9\.9\.9$/);
    assert.equal(r.aggregate.valid, 1);
  } finally {
    s.done();
  }
});

test('E17 D2: a failed ratification invalidates the attempt and the resume session is not launched', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true });
    const ratify = () => ({ ok: false, reason: 'decisao-pendente-apos-ratificar' });
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: fake.exec, now: NOW, ratify });
    assert.equal(fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p').length, 1);
    assert.equal(r.aggregate.attempts[0].status, 'invalid');
    assert.equal(r.aggregate.attempts[0].reason, 'decisao-pendente-apos-ratificar');
    assert.deepEqual(r.aggregate.invalidReasons, { 'decisao-pendente-apos-ratificar': 1 });
  } finally {
    s.done();
  }
});

test('E17 D3: parada-retomada whose resume session launches no agent is invalid as retomada-sem-agentes', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true, noAgentsOn: 2 });
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: fake.exec, now: NOW, ratify: () => ({ ok: true, ratified: [] }) });
    assert.equal(r.aggregate.attempts[0].status, 'invalid');
    assert.equal(r.aggregate.attempts[0].reason, 'retomada-sem-agentes');
    assert.deepEqual(r.aggregate.invalidReasons, { 'retomada-sem-agentes': 1 });
    assert.equal(r.aggregate.valid, 0);
  } finally {
    s.done();
  }
});

test('E17 D3: the resume set starts at the session index of the resume, not at index 1', async () => {
  const s = setup();
  try {
    // the aborted first phase left two session files; only the resume session (no agents) belongs to the resume set
    const fake = makeFake(s.configDir, { stopResume: true, noAgentsOn: 2, extraOn1: true });
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: fake.exec, now: NOW, ratify: okRatify });
    const priv = JSON.parse(readFileSync(join(r.dir, 'private', 'attempts.json'), 'utf8'));
    assert.equal(priv.attempts[0].sessions.length, 3);
    assert.equal(r.aggregate.attempts[0].reason, 'retomada-sem-agentes');
    const resumeRuns = JSON.parse(readFileSync(join(r.dir, 'private', 'attempts-1-resume.json'), 'utf8'));
    assert.deepEqual(resumeRuns.attempts[0].sessions, [sid(2)]);
  } finally {
    s.done();
  }
});

test('E17 D3: an empty resume set is retomada-sem-agentes and needs no extractor', () => {
  assert.deepEqual(resumeRunValidity(undefined), { valid: false, reason: 'retomada-sem-agentes' });
});

test('E17 D2: ratifyE5Contract refuses a dirty integration worktree before running the CLI', () => {
  const s = setup();
  try {
    const { sandbox, held } = ratifySandbox(s, { holdInWorktree: true });
    writeFileSync(join(held, 'stray.txt'), 'x');
    const t = fakeTracker([dec('DEC-501', 'E5', 'contract')]);
    assert.deepEqual(ratifyE5Contract(sandbox, '/inst', { exec: t.exec }), { ok: false, reason: 'integracao-suja' });
    assert.equal(t.calls.length, 0);
  } finally {
    s.done();
  }
});

test('E17 D2: the attempt record keeps the ratified DEC ids (also when none were pending)', async () => {
  for (const ratified of [['DEC-7', 'DEC-9'], []]) {
    const s = setup();
    try {
      const fake = makeFake(s.configDir, { stopResume: true });
      const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: fake.exec, now: NOW, ratify: () => ({ ok: true, ratified }) });
      assert.deepEqual(r.aggregate.attempts[0].ratified, ratified);
      const priv = JSON.parse(readFileSync(join(r.dir, 'private', 'attempts.json'), 'utf8'));
      assert.deepEqual(priv.attempts[0].ratified, ratified);
    } finally {
      s.done();
    }
  }
});

test('E17 D2: ratifyE5Contract against the real roadmap.mjs of this tree ratifies only the E5 contract decision', async () => {
  const { makeSandbox } = await import('../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs');
  const s = setup();
  try {
    const plugin = join(here, '..', '..', 'plugins', 'productivity-tools');
    const cli = join(plugin, 'skills', 'roadmap-tracker', 'scripts', 'roadmap.mjs');
    const sandbox = makeSandbox(join(s.base, 'sb'));
    const wt = join(s.base, 'sb-wt', '_integracao');
    gitIn(sandbox, 'branch', 'release/sandbox');
    assert.equal(gitIn(sandbox, 'worktree', 'add', '-q', wt, 'release/sandbox').status, 0);
    const folder = 'docs/plans/roadmap-sandbox';
    const node = (...a) => spawnSync(process.execPath, [cli, ...a], { cwd: wt, encoding: 'utf8' });
    for (const [d, sc, t] of [['E5', 'contrato', 'Usa X.'], ['E5', 'local', 'Usa Y.'], ['E4', 'contrato', 'Usa Z.']]) {
      assert.equal(node('add-decision', folder, '--deliverable', d, '--decision', t, '--scope', sc).status, 0);
    }
    gitIn(wt, 'add', '-A');
    assert.equal(gitIn(wt, 'commit', '-q', '-m', 'decisions').status, 0);
    const before = JSON.parse(node('pending-decisions', folder, '--json').stdout).result.decisions;
    assert.equal(before.length, 3);
    const r = ratifyE5Contract(sandbox, plugin);
    const e5Contract = before.find((d) => d.deliverable.includes('E5') && d.scope === 'contract').id;
    assert.deepEqual(r, { ok: true, ratified: [e5Contract] });
    const after = JSON.parse(node('pending-decisions', folder, '--json').stdout).result.decisions.map((d) => d.id);
    assert.deepEqual(after, before.map((d) => d.id).filter((id) => id !== e5Contract));
    assert.match(gitIn(wt, 'log', '-1', '--format=%s').stdout, /ratify E5 contract/);
    assert.equal(gitIn(wt, 'status', '--porcelain').stdout.trim(), '');
  } finally {
    spawnSync('git', ['worktree', 'prune'], { cwd: join(s.base, 'sb') });
    s.done();
  }
});

// ---- DEC-700: --review-model, --plugin-dir, review counts ----
const taskOpts = (s, extra = {}) => seededOpts(s, 'codigo-semeado-A', { stage: 'task-review', reviewModel: 'sonnet', ...extra });
const taskJournal = (...issues) => jl({ label: 'E5:task-review1', result: { issues } });
const firstClaudeP = (fake) => fake.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');

test('task-review requires a valid --review-model (library and CLI)', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    await assert.rejects(runBatch(taskOpts(s, { reviewModel: undefined }), { exec: fake.exec }), UsageError);
    await assert.rejects(runBatch(taskOpts(s, { reviewModel: 'gpt' }), { exec: fake.exec }), /--review-model/);
    assert.equal(fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p').length, 0);
    const common = ['--variant', 'codigo-semeado-A', '--stage', 'task-review', '--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'];
    const missing = spawnSync(process.execPath, [script, ...common], { encoding: 'utf8' });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /--review-model/);
    const bad = spawnSync(process.execPath, [script, ...common, '--review-model', 'nope'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /--review-model/);
  } finally {
    s.done();
  }
});

test('script carries the reviewer model and effort; spec and plan keep opus without effort', () => {
  const t = buildReviewOnlyScript({ stage: 'task-review', reviewPrompt: 'R', fixPrompt: 'F', model: 'sonnet', effort: 'medium' });
  assert.match(t, /label: 'E5:task-review1'[^\n]*model: 'sonnet', effort: 'medium', schema: SCHEMA/);
  assert.equal(t.includes("model: 'opus'"), false);
  const p = buildReviewOnlyScript({ stage: 'plan-review', reviewPrompt: 'R', fixPrompt: 'F' });
  assert.match(p, /label: 'E5:plan-review1'[^\n]*model: 'opus', schema: SCHEMA/);
  assert.equal(p.includes('effort'), false);
});

test('batch writes the review model into the script, the aggregate and the folder name', async () => {
  const s = setup();
  try {
    for (const m of ['sonnet', 'opus']) {
      const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
      const r = await runBatch(taskOpts(s, { reviewModel: m, work: join(s.base, `work-${m}`) }), { exec: fake.exec, now: NOW });
      assert.equal(r.dir, join(s.out, `codigo-semeado-A-task-review-atual-${m}-20261110-120000`));
      assert.equal(r.aggregate.harness.reviewModel, m);
      assert.equal(r.aggregate.harness.reviewEffort, 'medium');
      const text = readFileSync(join(firstClaudeP(fake).cwd, 'review-only.js'), 'utf8');
      assert.ok(text.includes(`model: '${m}', effort: 'medium'`));
    }
  } finally {
    s.done();
  }
});

test('spec and plan stages keep their default folder name and no review model', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun: fixP1 });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', arm: 'atual' }), { exec: fake.exec, now: NOW });
    assert.equal(r.dir, join(s.out, 'plano-semeado-A-plan-review-atual-20261110-120000'));
    assert.equal('reviewModel' in r.aggregate.harness, false);
    await assert.rejects(runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', reviewModel: 'sonnet', work: join(s.base, 'w2') }), { exec: fake.exec }), /--review-model/);
  } finally {
    s.done();
  }
});

test('--plugin-dir reaches every claude -p call and the aggregate records that folder version and commit', async () => {
  const s = setup();
  try {
    const dir = join(s.base, 'pdir');
    mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
    writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'productivity-tools', version: '3.2.1' }));
    mkdirSync(join(dir, 'agents'));
    writeFileSync(join(dir, 'agents', 'task-reviewer.md'), 'x');
    gitIn(dir, 'init', '-q');
    gitIn(dir, 'add', '-A');
    gitIn(dir, 'commit', '-q', '-m', 'x');
    const head = gitIn(dir, 'rev-parse', 'HEAD').stdout.trim();
    const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    const r = await runBatch(taskOpts(s, { pluginDir: dir }), { exec: fake.exec, now: NOW });
    const ps = fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p');
    assert.ok(ps.length > 0);
    for (const c of ps) assert.equal(c.args[c.args.indexOf('--plugin-dir') + 1], dir);
    assert.equal(r.aggregate.plugin.version, '3.2.1');
    assert.equal(r.aggregate.plugin.commit, head);
    assert.equal('installPath' in r.aggregate.plugin, false);
    // without a repo the commit is null; without the flag no --plugin-dir is passed
    const plain = join(s.base, 'plain');
    mkdirSync(join(plain, '.claude-plugin'), { recursive: true });
    writeFileSync(join(plain, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '1.0.0' }));
    mkdirSync(join(plain, 'agents'));
    writeFileSync(join(plain, 'agents', 'task-reviewer.md'), 'x');
    const f2 = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    const r2 = await runBatch(taskOpts(s, { pluginDir: plain, work: join(s.base, 'w2') }), { exec: f2.exec, now: () => new Date('2026-11-10T12:00:05Z') });
    assert.deepEqual({ v: r2.aggregate.plugin.version, c: r2.aggregate.plugin.commit }, { v: '1.0.0', c: null });
    const f3 = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    await runBatch(taskOpts(s, { work: join(s.base, 'w3') }), { exec: f3.exec, now: () => new Date('2026-11-10T12:00:10Z') });
    assert.equal(firstClaudeP(f3).args.includes('--plugin-dir'), false);
  } finally {
    s.done();
  }
});

test('each attempt records the reviewer blocking and minor counts, or null with a reason', async () => {
  const s = setup();
  try {
    const issues = [{ severity: 'critical', description: 'a' }, { severity: 'important', description: 'b' }, { severity: 'minor', description: 'c' }, { severity: 'minor', description: 'd' }, { severity: 'minor', description: 'e' }];
    const fake = makeFake(s.configDir, { journal: taskJournal(...issues), afterRun: mergeE5 });
    const r = await runBatch(taskOpts(s), { exec: fake.exec, now: NOW });
    assert.deepEqual(r.aggregate.attempts[0].review, { blocking: 2, minor: 3 });
    const none = makeFake(s.configDir, { journal: jl({ label: 'E5:plan-review1', result: { measuredPlanBlob: '{{PLAN_BLOB}}' } }) });
    const r2 = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', work: join(s.base, 'w2') }), { exec: none.exec, now: () => new Date('2026-11-10T12:00:05Z') });
    assert.equal(r2.aggregate.attempts[0].status, 'valid');
    assert.deepEqual(r2.aggregate.attempts[0].review, { blocking: null, minor: null, reason: 'sem-lista-de-issues' });
  } finally {
    s.done();
  }
});

function pluginDirAt(parent, { agent = true, manifest = true } = {}) {
  const dir = mkdtempSync(join(parent, 'pd-'));
  if (manifest) {
    mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
    writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '4.0.0' }));
  }
  if (agent) {
    mkdirSync(join(dir, 'agents'), { recursive: true });
    writeFileSync(join(dir, 'agents', 'task-reviewer.md'), 'x');
  }
  return dir;
}

test('a relative --plugin-dir is resolved once and the absolute path reaches claude -p', async () => {
  const s = setup();
  const dir = pluginDirAt(process.cwd());
  try {
    const rel = relative(process.cwd(), dir);
    assert.equal(isAbsolute(rel), false);
    const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    const r = await runBatch(taskOpts(s, { pluginDir: rel }), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.plugin.version, '4.0.0');
    const ps = fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p');
    assert.ok(ps.length > 0);
    for (const c of ps) assert.equal(c.args[c.args.indexOf('--plugin-dir') + 1], resolve(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    s.done();
  }
});

test('task-review atual needs the task-reviewer agent; an unreadable plugin.json under --plugin-dir is an error', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    const noAgent = pluginDirAt(s.base, { agent: false });
    await assert.rejects(runBatch(taskOpts(s, { pluginDir: noAgent }), { exec: fake.exec }), (e) => e instanceof UsageError && /task-reviewer/.test(e.message));
    const noManifest = pluginDirAt(s.base, { manifest: false });
    await assert.rejects(runBatch(taskOpts(s, { pluginDir: noManifest, work: join(s.base, 'w2') }), { exec: fake.exec }), (e) => e instanceof UsageError && /plugin\.json/.test(e.message));
    rmSync(join(s.configDir, 'plugins', 'cache', 'claude-play', 'productivity-tools', '9.9.9', 'agents'), { recursive: true });
    await assert.rejects(runBatch(taskOpts(s, { work: join(s.base, 'w3') }), { exec: fake.exec }), (e) => e instanceof UsageError && /task-reviewer/.test(e.message));
    assert.equal(fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p').length, 0);
  } finally {
    s.done();
  }
});

test('review effort mirrors the workflow: haiku low, sonnet and opus medium', async () => {
  const s = setup();
  try {
    for (const [m, e] of [['haiku', 'low'], ['sonnet', 'medium'], ['opus', 'medium']]) {
      const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
      const r = await runBatch(taskOpts(s, { reviewModel: m, work: join(s.base, 'w-' + m) }), { exec: fake.exec, now: NOW });
      assert.equal(r.aggregate.harness.reviewEffort, e);
      assert.ok(readFileSync(join(firstClaudeP(fake).cwd, 'review-only.js'), 'utf8').includes("model: '" + m + "', effort: '" + e + "'"));
    }
  } finally {
    s.done();
  }
});

test('aggregate.harness records harnessCommit and a different plugin commit prints a warning', async () => {
  const s = setup();
  const warn = mock.method(console, 'error', () => {});
  try {
    const dir = pluginDirAt(s.base);
    gitIn(dir, 'init', '-q');
    gitIn(dir, 'add', '-A');
    gitIn(dir, 'commit', '-q', '-m', 'x');
    const pc = gitIn(dir, 'rev-parse', 'HEAD').stdout.trim();
    assert.notEqual(pc, HEAD);
    const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    const r = await runBatch(taskOpts(s, { pluginDir: dir }), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.harness.harnessCommit, HEAD);
    assert.equal(r.aggregate.plugin.commit, pc);
    const said = warn.mock.calls.map((c) => c.arguments.join(' ')).join('\n');
    assert.match(said, /harnessCommit/);
    assert.ok(said.includes(HEAD) && said.includes(pc));
    warn.mock.resetCalls();
    const same = pluginDirAt(s.base);
    const f2 = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    await runBatch(taskOpts(s, { pluginDir: same, work: join(s.base, 'w2') }), { exec: f2.exec, now: () => new Date('2026-11-10T12:00:05Z') });
    assert.equal(warn.mock.calls.map((c) => c.arguments.join(' ')).join('\n').includes('harnessCommit'), false);
  } finally {
    warn.mock.restore();
    s.done();
  }
});

// ---- E26 A2: stale arm refusal, armCommits ----
const { armMatches: armMatchesRB, assertArmsCurrent } = await import('./run-batch.mjs');

function pluginDirWithWorkflow(parent, workflowText) {
  const dir = pluginDirAt(parent);
  const wfDir = join(dir, 'skills', 'roadmap-release', 'workflow');
  mkdirSync(wfDir, { recursive: true });
  writeFileSync(join(wfDir, 'roadmap-release.js'), workflowText);
  return dir;
}
const claudeCalls = (fake) => fake.calls.filter((c) => c.cmd === 'claude');

test('A2: armMatches lives in run-batch and checkpoint re-exports the same function', async () => {
  const cp = await import('./checkpoint.mjs');
  assert.equal(cp.armMatches, armMatchesRB);
  assert.equal(armMatchesRB('Copied from: x.js at commit abc\nA {{x}} b.\n', 'A 1 b.'), true);
});

test('A2: assertArmsCurrent refuses a stale arm and names the file', () => {
  const sha = 'a'.repeat(40);
  const arm = (t) => ({ text: t, source: { path: 'p', commit: sha } });
  const h = { stage: 'spec-review', arm: 'atual', review: arm('Review it {{artifactPath}} now.'), fixArm: arm('Fix it {{artifactPath}}\n{{issues}}'), fixCheck: arm('run check {{planTool}}') };
  const wf = 'x Review it P now. y Fix it Q\nI z run check T';
  assert.doesNotThrow(() => assertArmsCurrent(h, wf));
  assert.throws(() => assertArmsCurrent(h, wf.replace('Review it', 'Look at')), (e) => e instanceof UsageError && /review/.test(e.message));
  assert.throws(() => assertArmsCurrent(h, wf.replace('Fix it', 'Mend')), (e) => e instanceof UsageError && /fix/.test(e.message));
  assert.throws(() => assertArmsCurrent(h, wf.replace('run check', 'run nothing')), (e) => e instanceof UsageError && /fixCheck|check/.test(e.message));
  assert.doesNotThrow(() => assertArmsCurrent({ ...h, fixCheck: null }, wf.replace('run check', 'run nothing')));
  assert.doesNotThrow(() => assertArmsCurrent({ stage: 'task-review', arm: 'atual', review: null, fixArm: null, fixCheck: null }, 'nothing'));
  assert.doesNotThrow(() => assertArmsCurrent({ ...h, arm: 'perguntas' }, 'nothing'));
});

test('A2: a stale arm against the --plugin-dir workflow is refused before any claude call', async () => {
  const s = setup();
  try {
    const stale = pluginDirWithWorkflow(s.base, 'nothing alike');
    const fake = makeFake(s.configDir);
    await assert.rejects(runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', pluginDir: stale }), { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && /plan-review/.test(e.message));
    assert.equal(claudeCalls(fake).length, 0);
    const cli = spawnSync(process.execPath, [script, '--variant', 'plano-semeado-A', '--stage', 'plan-review', '--plugin-dir', stale, '--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'], { encoding: 'utf8' });
    assert.equal(cli.status, 2);
  } finally {
    s.done();
  }
});

test('A2: a current arm passes against the real workflow and the aggregate records armCommits', async () => {
  const s = setup();
  try {
    const dir = pluginDirWithWorkflow(s.base, readFileSync(WORKFLOW, 'utf8'));
    const sha = norm(readFileSync(join(ARMS, 'plan-review-atual.md'), 'utf8')).split('\n')[0].match(/commit ([0-9a-f]{40})$/)[1];
    const fake = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun: fixP1 });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', pluginDir: dir }), { exec: fake.exec, now: NOW });
    assert.deepEqual(r.aggregate.harness.armCommits, { review: sha, fix: sha, fixCheck: null });
  } finally {
    s.done();
  }
});

// ---- E26 A2 review fixes ----
const { assertArmCommits } = await import('./run-batch.mjs');

test('A2 review: review and fix must share a commit; the fix-check fragment may come from a later commit', () => {
  const at = (c) => ({ text: 'x', source: { path: 'p', commit: c.repeat(40) } });
  assert.doesNotThrow(() => assertArmCommits(at('a'), at('a'), at('b')));
  assert.doesNotThrow(() => assertArmCommits(at('a'), at('a'), null));
  assert.throws(() => assertArmCommits(at('a'), at('b'), null), UsageError);
  assert.throws(() => assertArmCommits(at('a'), at('b'), at('a')), UsageError);
  // the real arms: plan arms frozen at one commit (DEC-310), the fragment copied later
  const commit = (f) => readArm(join(ARMS, f), { requireSource: true });
  assert.notEqual(commit('plan-review-atual.md').source.commit, commit('plan-fix-check-atual.md').source.commit);
  assert.doesNotThrow(() => assertArmCommits(commit('plan-review-atual.md'), commit('plan-fix-atual.md'), commit('plan-fix-check-atual.md')));
});

test('A2 review: an installed plugin without roadmap-release.js is refused for --stage spec/plan --arm atual', async () => {
  const s = setup();
  try {
    rmSync(join(s.installed, 'skills'), { recursive: true, force: true });
    const fake = makeFake(s.configDir);
    await assert.rejects(runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review' }), { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && /installed plugin/.test(e.message));
    assert.equal(claudeCalls(fake).length, 0);
    const none = setup({ withPlugins: false });
    try {
      await assert.rejects(runBatch(seededOpts(none, 'plano-semeado-A', { stage: 'plan-review' }), { exec: makeFake(none.configDir).exec, now: NOW }), (e) => e instanceof UsageError && /not found/.test(e.message) && !/has no skills/.test(e.message));
    } finally {
      none.done();
    }
  } finally {
    s.done();
  }
});

// ---- E26 A1: frozen single-round script (T5) ----
const sha256Of = (t) => createHash('sha256').update(t).digest('hex');
// sha256 of the whole review-only.js of plano-semeado-A (single round, arm atual, FIX_PROMPT included) with the sandbox path as <SB>.
const GOLDEN_SINGLE_PLAN_A = '257bb16e735b611ea8942ea0e773ec7dd957cd63c70472c32412656ce2b471f9';

async function singleScriptOf(s, extra = {}) {
  const fake = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun: fixP1 });
  await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', arm: 'atual', ...extra }), { exec: fake.exec, now: NOW });
  const sent = fake.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');
  return readFileSync(join(sent.cwd, 'review-only.js'), 'utf8').split(sent.cwd.replace(/\\/g, '/')).join('<SB>');
}

test('A1: the single-round script of plano-semeado-A is frozen byte for byte (golden, FIX_PROMPT included)', async () => {
  const s = setup();
  try {
    const text = await singleScriptOf(s);
    assert.ok(text.includes('const FIX_PROMPT = '));
    assert.ok(!/[A-Za-z]:[\\/]/.test(text), 'no absolute Windows path left');
    assert.equal(sha256Of(text), GOLDEN_SINGLE_PLAN_A, text);
    // --rounds single is the default and writes the same bytes
    const s2 = setup();
    try {
      assert.equal(await singleScriptOf(s2, { rounds: 'single' }), text);
    } finally {
      s2.done();
    }
  } finally {
    s.done();
  }
});

// ---- E26 A1: --rounds loop (T5) ----
const REAL_PLUGIN = join(REPO, 'plugins', 'productivity-tools');

test('A1: --rounds loop writes the loop script from the measured workflow and records rounds, pureSha256 and stageOptions', async () => {
  const s = setup();
  try {
    const dir = pluginDirWithWorkflow(s.base, readFileSync(WORKFLOW, 'utf8'));
    const fake = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun: fixP1 });
    const r = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', pluginDir: dir, rounds: 'loop' }), { exec: fake.exec, now: NOW });
    const sent = fake.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');
    const text = readFileSync(join(sent.cwd, 'review-only.js'), 'utf8');
    assert.ok(text.includes('async function runReviewLoop('));
    assert.ok(text.includes('const H_REVIEW_BODY = '));
    const bodyLine = text.split('\n').find((l) => l.startsWith('const H_REVIEW_BODY = '));
    assert.ok(!bodyLine.includes('${RM}') && bodyLine.includes('**Roadmap:** docs/plans/roadmap-sandbox/'), bodyLine);
    assert.ok(text.length <= 200000);
    const lines = readFileSync(WORKFLOW, 'utf8').split(/\r?\n/);
    const pure = lines.slice(lines.findIndex((l) => l.trim() === '// <pure>') + 1, lines.findIndex((l) => l.trim() === '// </pure>')).join('\n');
    assert.equal(r.aggregate.harness.rounds, 'loop');
    assert.equal(r.aggregate.harness.pureSha256, sha256Of(pure));
    assert.deepEqual(r.aggregate.harness.stageOptions, { tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 });
    const single = makeFake(s.configDir, { journal: planReview(BLOCKER), afterRun: fixP1 });
    const rs = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review', pluginDir: dir, work: join(s.base, 'w2') }), { exec: single.exec, now: () => new Date('2026-11-10T12:00:05Z') });
    assert.equal(rs.aggregate.harness.rounds, 'single');
    assert.equal(rs.aggregate.harness.pureSha256, undefined);
  } finally {
    s.done();
  }
});

test('A1: --rounds refusals exit 2 before any claude call', async () => {
  const s = setup();
  try {
    const wf = readFileSync(WORKFLOW, 'utf8');
    const good = pluginDirWithWorkflow(s.base, wf);
    const noLoop = pluginDirWithWorkflow(s.base, wf.replace('async function runReviewLoop(', 'async function otherLoop('));
    const noMax = pluginDirWithWorkflow(s.base, wf.replace('intArg(A.maxFixRounds, 2, 0)', 'intArg(A.maxFixRounds, 4, 0)'));
    const at = wf.indexOf("reviewLoop('plan',");
    const next = wf.indexOf('reviewLoop(', at + 1);
    const drift = pluginDirWithWorkflow(s.base, wf.slice(0, at) + wf.slice(at, next).replace("{ tier: 'sonnet', reviewModel: 'opus' })", "{ tier: 'opus', reviewModel: 'opus' })") + wf.slice(next));
    const cases = [
      ['plano-semeado-A', ['--stage', 'plan-review', '--plugin-dir', noLoop, '--rounds', 'loop']],
      ['plano-semeado-A', ['--stage', 'plan-review', '--plugin-dir', noMax, '--rounds', 'loop']],
      ['plano-semeado-A', ['--stage', 'plan-review', '--plugin-dir', drift, '--rounds', 'loop']],
      ['codigo-semeado-A', ['--stage', 'task-review', '--review-model', 'sonnet', '--plugin-dir', good, '--rounds', 'loop']],
      ['spec-semeado-A', ['--stage', 'spec-review', '--arm', 'perguntas', '--plugin-dir', good, '--rounds', 'loop']],
      ['plano-semeado-A', ['--stage', 'plan-review', '--plugin-dir', good, '--rounds', 'twice']],
      ['completo', ['--rounds', 'loop']],
    ];
    for (const [variant, extra] of cases) {
      const cli = spawnSync(process.execPath, [script, '--variant', variant, ...extra, '--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'], { encoding: 'utf8' });
      assert.equal(cli.status, 2, `${variant} ${extra.join(' ')}: ${cli.stderr}`);
    }
    for (const [pluginDir, opt] of [[noLoop, {}], [noMax, {}], [drift, {}], [good, { stage: 'task-review', reviewModel: 'sonnet', variant: 'codigo-semeado-A' }]]) {
      const fake = makeFake(s.configDir);
      await assert.rejects(runBatch(seededOpts(s, opt.variant ?? 'plano-semeado-A', { stage: 'plan-review', pluginDir, rounds: 'loop', ...opt }), { exec: fake.exec, now: NOW }), UsageError);
      assert.equal(claudeCalls(fake).length, 0);
    }
  } finally {
    s.done();
  }
});

// ---- E26 A1/A2/A3: loop aggregate and native wiring (T6) ----
const NATIVE_SCEN = join(here, 'scenario', 'e5-native');
const journalFileOf = (configDir, n) => join(configDir, 'projects', 'fab-sandbox', sid(n), 'subagents', 'workflows', 'wf_fab', 'journal.jsonl');
const rv = (issues, headSha, key, blob) => ({ issues, headSha, clean: true, commitsInRange: 1, [key]: blob });
// The fixer of the simulated run: the clean native file comes back in one commit on feat/E5.
function restoreClean(cwd, kind) {
  gitq(cwd, 'checkout', '-q', 'feat/E5');
  writeFileSync(join(cwd, NATIVE_PATHS[kind]), norm(readFileSync(join(NATIVE_SCEN, `${kind}.md`), 'utf8')));
  gitq(cwd, '-c', 'user.name=fab', '-c', 'user.email=fab@example.invalid', 'commit', '-q', '-am', `docs(${kind}): E5 review fixes`);
  return gitq(cwd, 'rev-parse', 'feat/E5');
}
const nativeOpts = (s, variant, extra = {}) => seededOpts(s, variant, { stage: variant.startsWith('spec') ? 'spec-review' : 'plan-review', pluginDir: REAL_PLUGIN, ...extra });
const promptConsts = (text) =>
  Object.fromEntries(
    text.split('\n').map((l) => /^const (REVIEW_PROMPT|FIX_PROMPT|H_REVIEW_BODY|H_FIX|H_MEASURE) = (.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], JSON.parse(m[2])]),
  );
const sentScript = (fake) => {
  const sent = fake.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');
  return { cwd: sent.cwd, text: readFileSync(join(sent.cwd, 'review-only.js'), 'utf8') };
};

test('A1: loop on plano-nativo-A, blocker then clean: loop record, verified afterFirstFix, toolCheck and the loop summary', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const seeded = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.plan}`);
      const head1 = gitq(cwd, 'rev-parse', 'feat/E5');
      const tip = restoreClean(cwd, 'plan');
      writeFileSync(journalFileOf(s.configDir, n), jl(
        { label: 'E5:plan-review1', result: rv([BLOCKER], head1, 'measuredPlanBlob', seeded) },
        { label: 'E5:plan-review-fix1', result: { summary: '[fab] fixed' } },
        { label: 'E5:plan-review2', result: rv([], tip, 'measuredPlanBlob', gitq(cwd, 'rev-parse', `${tip}:${NATIVE_PATHS.plan}`)) },
      ));
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'plano-nativo-A', { rounds: 'loop' }), { exec: fake.exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(a));
    assert.deepEqual(a.loop, { reviews: 2, fixes: 1, fixTiers: ['sonnet'], ok: true, kind: null });
    assert.deepEqual(outcomeMap(a), { P1: 'capturado', P2: 'capturado', P9: 'capturado', P4: 'capturado' });
    assert.equal(a.afterFirstFix.verified, true);
    assert.match(a.afterFirstFix.headSha, /^[0-9a-f]{40}$/);
    assert.deepEqual(Object.fromEntries(a.afterFirstFix.outcomes.map((o) => [o.id, o.outcome])), { P1: 'capturado', P2: 'capturado', P9: 'capturado', P4: 'capturado' });
    assert.deepEqual(a.toolCheck, { exit: 0 });
    assert.equal(a.humanInputs, undefined);
    assert.deepEqual(r.aggregate.loopSummary, { reviews: { 2: 1 }, ok: 1, stopped: 0 });
    assert.equal(r.aggregate.afterFirstFixUnverified, 0);
    assert.equal(r.aggregate.outcomesAfterFirstFix.P1.capturado, 1);
    assert.equal(r.aggregate.seedSource.kind, 'nativo-sonda-2');
    const fragCommit = norm(readFileSync(join(ARMS, 'plan-fix-check-atual.md'), 'utf8')).split('\n')[0].match(/commit ([0-9a-f]{40})$/)[1];
    assert.equal(r.aggregate.harness.armCommits.fixCheck, fragCommit);
    const { text } = sentScript(fake);
    const fix = promptConsts(text).H_FIX;
    assert.ok(fix.includes(`run node "${REAL_PLUGIN.replace(/\\/g, '/')}/scripts/plan-tool.mjs" check "`), fix);
    assert.ok(fix.includes(`/${NATIVE_PATHS.plan}" --spec "`), fix);
  } finally {
    s.done();
  }
});

test('A1: afterFirstFix is unverified (all indeterminado) for a missing SHA, a SHA out of range, a different blob and a non-tip SHA after 1 fix', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const seeded = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.plan}`);
      const fixSha = restoreClean(cwd, 'plan');
      const fixBlob = gitq(cwd, 'rev-parse', `${fixSha}:${NATIVE_PATHS.plan}`);
      let head = fixSha;
      let blob = fixBlob;
      if (n === 1) head = '0123456789abcdef0123456789abcdef01234567';
      if (n === 2) head = gitq(cwd, 'rev-parse', 'main');
      if (n === 3) blob = seeded;
      if (n === 4) {
        writeFileSync(join(cwd, 'notes.txt'), 'later\n');
        gitq(cwd, 'add', 'notes.txt');
        gitq(cwd, '-c', 'user.name=fab', '-c', 'user.email=fab@example.invalid', 'commit', '-q', '-m', 'chore: later commit');
      }
      writeFileSync(journalFileOf(s.configDir, n), jl(
        { label: 'E5:plan-review1', result: rv([BLOCKER], 'x', 'measuredPlanBlob', seeded) },
        { label: 'E5:plan-review-fix1', result: { summary: '[fab] fixed' } },
        { label: 'E5:plan-review2', result: rv([], head, 'measuredPlanBlob', blob) },
      ));
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'plano-nativo-A', { rounds: 'loop', runs: 4 }), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.valid, 4, JSON.stringify(r.aggregate.invalidReasons));
    for (const a of r.aggregate.attempts) {
      assert.equal(a.afterFirstFix.verified, false, `attempt ${a.n}`);
      for (const o of a.afterFirstFix.outcomes) assert.equal(o.outcome, 'indeterminado', `attempt ${a.n} ${o.id}`);
      assert.equal(a.loop.ok, true);
    }
    assert.equal(r.aggregate.afterFirstFixUnverified, 4);
  } finally {
    s.done();
  }
});

test('A1: loop without a blocker: one review, afterFirstFix equals the end; a missing fix is laco-infra; a null review 1 validates on 1b', async () => {
  const s = setup();
  try {
    const seededBlob = (cwd) => gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.plan}`);
    const afterRun = (cwd, n) => {
      const b = seededBlob(cwd);
      const text = {
        1: jl({ label: 'E5:plan-review1', result: rv([], 'x', 'measuredPlanBlob', b) }),
        2: jl({ label: 'E5:plan-review1', result: rv([BLOCKER], 'x', 'measuredPlanBlob', b) }),
        3: jl({ label: 'E5:plan-review1', result: null }, { label: 'E5:plan-review1b', result: rv([minorIssue], 'x', 'measuredPlanBlob', b) }),
      }[n];
      writeFileSync(journalFileOf(s.configDir, n), text);
    };
    const minorIssue = { severity: 'minor', category: 'defeito', description: '[fab] wording' };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'plano-nativo-A', { rounds: 'loop', runs: 3 }), { exec: fake.exec, now: NOW });
    const [a1, a2, a3] = r.aggregate.attempts;
    assert.equal(a1.status, 'valid');
    assert.deepEqual(a1.loop, { reviews: 1, fixes: 0, fixTiers: [], ok: true, kind: null });
    assert.deepEqual(a1.afterFirstFix, { headSha: null, verified: true, outcomes: a1.outcomes });
    for (const o of a1.outcomes) assert.equal(o.outcome, 'perdido', o.id);
    assert.deepEqual({ status: a2.status, reason: a2.reason }, { status: 'invalid', reason: 'laco-infra' });
    assert.equal(a3.status, 'valid', JSON.stringify(a3));
    assert.equal(a3.loop.ok, true);
    assert.deepEqual(r.aggregate.loopSummary, { reviews: { 1: 2 }, ok: 2, stopped: 0 });
  } finally {
    s.done();
  }
});

test('A1: a loop that stops leaves the end stage stopped (outcomes of present defects indeterminado) and counts as stopped', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const b = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.plan}`);
      // the fixer commits nothing that removes the defects; the same finding comes back twice: sonnet, then opus, then stop
      writeFileSync(journalFileOf(s.configDir, n), jl(
        { label: 'E5:plan-review1', result: rv([BLOCKER], 'x', 'measuredPlanBlob', b) },
        { label: 'E5:plan-review-fix1', result: { summary: '[fab]' } },
        { label: 'E5:plan-review2', result: rv([BLOCKER], gitq(cwd, 'rev-parse', 'feat/E5'), 'measuredPlanBlob', b) },
        { label: 'E5:plan-review-fix2', result: { summary: '[fab]' } },
        { label: 'E5:plan-review3', result: rv([BLOCKER], 'x', 'measuredPlanBlob', b) },
      ));
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'plano-nativo-A', { rounds: 'loop' }), { exec: fake.exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.deepEqual(a.loop, { reviews: 3, fixes: 2, fixTiers: ['sonnet', 'opus'], ok: false, kind: 'conteudo' });
    for (const o of a.outcomes) assert.equal(o.outcome, 'indeterminado', o.id);
    assert.deepEqual(r.aggregate.loopSummary, { reviews: { 3: 1 }, ok: 0, stopped: 1 });
  } finally {
    s.done();
  }
});

test('A3: spec-nativo-B records humanInputs from the spec/1 block (seeded and at the end) and the spec-tool check exit', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const seeded = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.spec}`);
      restoreClean(cwd, 'spec');
      writeFileSync(journalFileOf(s.configDir, n), jl(
        { label: 'E5:spec-review1', result: rv([BLOCKER], 'x', 'measuredSpecBlob', seeded) },
        { label: 'E5:spec-review-fix1', result: { summary: '[fab] fixed' } },
      ));
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'spec-nativo-B'), { exec: fake.exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(a));
    assert.deepEqual(a.humanInputs, { blockingSeeded: 1, blockingAtEnd: 0 });
    assert.deepEqual(a.toolCheck, { exit: 0 });
    assert.equal(a.loop, undefined);
    assert.equal(a.afterFirstFix, undefined);
    assert.deepEqual(outcomeMap(a), { SN5: 'capturado', SN6: 'capturado', SN7: 'capturado', SN8: 'capturado' });
    const fix = promptConsts(sentScript(fake).text).FIX_PROMPT;
    assert.ok(fix.includes(`run node "${REAL_PLUGIN.replace(/\\/g, '/')}/scripts/spec-tool.mjs" check "`), fix);
    assert.ok(fix.includes('/docs/plans/roadmap-sandbox"'), fix);
  } finally {
    s.done();
  }
});

test('A1 review: a journal whose stage labels the replay did not use, or repeats, is laco-divergente', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const b = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.plan}`);
      const clean = { label: 'E5:plan-review1', result: rv([], 'x', 'measuredPlanBlob', b) };
      const text = {
        // a clean review 1 ends the loop: a fix and a 2nd review in the journal never belong to it
        1: jl(clean, { label: 'E5:plan-review-fix1', result: { summary: '[fab]' } }, { label: 'E5:plan-review2', result: rv([], 'x', 'measuredPlanBlob', b) }),
        2: jl(clean, clean),
        3: jl(clean, { label: 'E5:plan-review-extra', result: { summary: '[fab]' } }),
        4: jl({ label: 'E5:plan-review1', result: null }, { label: 'E5:plan-review1b', result: rv([], 'x', 'measuredPlanBlob', b) }),
      }[n];
      writeFileSync(journalFileOf(s.configDir, n), text);
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'plano-nativo-A', { rounds: 'loop', runs: 4 }), { exec: fake.exec, now: NOW });
    assert.deepEqual(r.aggregate.attempts.map((a) => a.reason ?? a.status), ['laco-divergente', 'laco-divergente', 'laco-divergente', 'valid']);
  } finally {
    s.done();
  }
});

test('A1 review: an unreachable sandbox without a 1st fix keeps afterFirstFix verified (the end outcomes, headSha null)', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const b = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.plan}`);
      writeFileSync(journalFileOf(s.configDir, n), jl({ label: 'E5:plan-review1', result: rv([], 'x', 'measuredPlanBlob', b) }));
      gitq(cwd, 'checkout', '-q', 'main');
      gitq(cwd, 'branch', '-q', '-D', 'feat/E5');
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'plano-nativo-A', { rounds: 'loop' }), { exec: fake.exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(a));
    for (const o of a.outcomes) assert.equal(o.outcome, 'indeterminado');
    assert.deepEqual(a.afterFirstFix, { headSha: null, verified: true, outcomes: a.outcomes });
    assert.equal(r.aggregate.afterFirstFixUnverified, 0);
  } finally {
    s.done();
  }
});

test('A2: no {{ placeholder is left in any generated prompt (every stage, variant and arm; {{issues}} only in the fixer); the check fragment only in plano-nativo', async () => {
  const s = setup();
  try {
    const combos = [
      ...['spec-nativo-A', 'spec-nativo-B', 'plano-semeado-A', 'plano-semeado-B', 'plano-nativo-A', 'plano-nativo-B'].map((v) => [v, {}]),
      ...['codigo-semeado-A', 'codigo-semeado-B'].map((v) => [v, { stage: 'task-review', reviewModel: 'sonnet' }]),
      ...['spec-nativo-A', 'plano-semeado-A', 'plano-nativo-B'].map((v) => [v, { rounds: 'loop' }]),
    ];
    let k = 0;
    for (const [variant, extra] of combos) {
      k += 1;
      const fake = makeFake(s.configDir);
      await runBatch(nativeOpts(s, variant, { work: join(s.base, `w${k}`), ...extra }), { exec: fake.exec, now: () => new Date(Date.UTC(2026, 10, 10, 12, 0, k)) });
      const c = promptConsts(sentScript(fake).text);
      const review = c.REVIEW_PROMPT ?? c.H_REVIEW_BODY + c.H_MEASURE;
      const fix = c.FIX_PROMPT ?? c.H_FIX;
      const tag = `${variant} ${JSON.stringify(extra)}`;
      assert.ok(typeof review === 'string' && typeof fix === 'string', tag);
      assert.ok(!review.includes('{{'), `${tag}: ${review}`);
      assert.ok(!fix.replace(/\{\{issues\}\}/g, '').includes('{{'), `${tag}: ${fix}`);
      assert.equal(fix.includes('plan-tool.mjs" check'), variant.startsWith('plano-nativo'), tag);
      if (variant.startsWith('spec')) assert.ok(review.includes('deliverable E5 ') && review.includes('/docs/plans/roadmap-sandbox/requirements.md'), `${tag}: ${review}`);
      if (/nativo/.test(variant)) assert.ok(review.includes(NATIVE_PATHS[variant.startsWith('spec') ? 'spec' : 'plan']), tag);
    }
  } finally {
    s.done();
  }
});

// ---- E26 A5: session cost and roles by label (T8) ----

test('A5: sumCliCost adds total_cost_usd across sessions and is null without any value', () => {
  assert.equal(sumCliCost([0.25, 0.5]), 0.75);
  assert.equal(sumCliCost([0.1]), 0.1);
  assert.equal(sumCliCost([]), null);
});

test('A5: rolesByLabel separates review from fix and keeps the main-session cost beside the agents', () => {
  const calls = (s) => ({ haiku: 0, sonnet: s, opus: 0, fable: 0, other: 0 });
  const role = (s, bytes, cost) => ({ calls: calls(s), promptBytes: bytes, tokens: { input: 1, output: 2 }, cost, agents: s });
  const run = {
    roles: {
      'other:spec-review': role(1, 10, 1),
      'other:spec-review-fix': role(1, 20, 2),
      'task-fix': role(2, 5, 0.5),
      'final-review': role(1, 7, 0.25),
      spec: role(1, 3, 0.125),
    },
    main: { cost: 4 },
  };
  const r = rolesByLabel(run, 5);
  assert.equal(r.review.agents, 2);
  assert.equal(r.review.cost, 1.25);
  assert.equal(r.review.promptBytes, 17);
  assert.equal(r.fix.agents, 3);
  assert.equal(r.fix.cost, 2.5);
  assert.equal(r.other.agents, 1);
  assert.equal(r.other.cost, 0.125);
  assert.deepEqual(r.session, { cliCostUsd: 5, transcriptCostUsd: 4 });
  assert.equal(rolesByLabel({ roles: {}, main: { cost: null } }, null).review.cost, null);
});

test('A5: the attempt records the CLI cost, rolesByLabel, and the aggregate sums both with cost.session', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s, { runs: 2 }), { exec: fake.exec, now: NOW });
    for (const a of r.aggregate.attempts) {
      assert.deepEqual(a.counters.session, { cliCostUsd: 0.01 });
      assert.ok(a.rolesByLabel && a.rolesByLabel.session.cliCostUsd === 0.01);
      assert.ok('transcriptCostUsd' in a.rolesByLabel.session);
    }
    assert.equal(r.aggregate.rolesByLabel.session.cliCostUsd, 0.02);
    assert.deepEqual(r.aggregate.cost.session, { median: 0.01, min: 0.01, max: 0.01 });
    assert.ok(r.aggregate.rolesByLabel.other.agents > 0);
    assert.ok(r.aggregate.roles.discovery);
  } finally {
    s.done();
  }
});

test('A5: without total_cost_usd in the CLI JSON the session cost is null', async () => {
  const s = setup();
  try {
    const base = makeFake(s.configDir);
    const exec = async (cmd, args, o) => {
      const r = await base.exec(cmd, args, o);
      if (cmd === 'claude' && args[0] === '-p') {
        const { total_cost_usd: _t, ...rest } = JSON.parse(r.stdout);
        return { ...r, stdout: JSON.stringify(rest) };
      }
      return r;
    };
    const r = await runBatch(baseOpts(s, { runs: 1 }), { exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.deepEqual(a.counters.session, { cliCostUsd: null });
    assert.equal(a.rolesByLabel.session.cliCostUsd, null);
    assert.equal(r.aggregate.rolesByLabel.session.cliCostUsd, null);
    assert.deepEqual(r.aggregate.cost.session, { median: null, min: null, max: null });
  } finally {
    s.done();
  }
});

// ---- E26 A4: questions arm (T7) ----

const Q = [{ q: '[fab] which file holds the cache?', whyItChangesThePlan: '[fab] adds a task' }];
const rq = (questions, key, blob) => ({ questions, headSha: 'x', clean: true, commitsInRange: 1, [key]: blob });

test('A4: --arm perguntas outside spec-review, with --rounds loop, or on another variant is a UsageError before any claude call', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    for (const o of [
      nativeOpts(s, 'plano-nativo-A', { arm: 'perguntas' }),
      nativeOpts(s, 'spec-nativo-A', { arm: 'perguntas', rounds: 'loop' }),
      seededOpts(s, 'codigo-semeado-A', { stage: 'task-review', reviewModel: 'sonnet', arm: 'perguntas' }),
    ]) {
      await assert.rejects(runBatch(o, { exec: fake.exec, now: NOW }), /UsageError|--arm perguntas|--rounds loop/);
    }
    assert.equal(fake.calls.filter((c) => c.cmd === 'claude').length, 0);
  } finally {
    s.done();
  }
});

test('A4: the perguntas script has the questions schema, a fresh opus/medium reader and exactly one spec-author on questions', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { afterRun: (cwd, n) => writeFileSync(journalFileOf(s.configDir, n), jl({ label: 'E5:spec-review1', result: rq([], 'measuredSpecBlob', gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.spec}`)) })) });
    const r = await runBatch(nativeOpts(s, 'spec-nativo-A', { arm: 'perguntas' }), { exec: fake.exec, now: NOW });
    const { text } = sentScript(fake);
    assert.match(text, /"whyItChangesThePlan"/);
    assert.match(text, /"questions"/);
    assert.ok(!text.includes('"issues"'));
    assert.match(text, /label: 'E5:spec-review1'.*model: 'opus'.*effort: 'medium'/);
    assert.equal(text.match(/agentType: 'productivity-tools:spec-author'/g).length, 1);
    assert.match(text, /label: 'E5:spec-review-fix1'/);
    assert.ok(!/spec-author'[^\n]*model:/.test(text), 'the author takes no explicit model');
    assert.ok(text.includes('questions.length > 0'));
    const c = promptConsts(text);
    assert.ok(!c.REVIEW_PROMPT.includes('{{'), c.REVIEW_PROMPT);
    const fix = text.split('\n').find((l) => l.startsWith('const FIX_PROMPT = '));
    const fixText = JSON.parse(fix.slice('const FIX_PROMPT = '.length));
    assert.ok(fixText.startsWith('mode: unattended\noutput: '), fixText);
    assert.ok(fixText.includes('{{questions}}'));
    assert.ok(!fixText.replace('{{questions}}', '').includes('{{'), fixText);
    assert.ok(fixText.includes('/scripts/spec-tool.mjs"'));
    assert.equal(r.aggregate.harness.arm, 'perguntas');
    assert.equal(r.aggregate.harness.armSource, 'modelo');
  } finally {
    s.done();
  }
});

test('A4: an empty list is approved with review.questions 0; questions plus a fix that removes a defect is approved with humanInputs; a fix that changes nothing is stopped', async () => {
  const run = async (journalOf, fixed) => {
    const s = setup();
    try {
      const afterRun = (cwd, n) => {
        const seeded = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.spec}`);
        if (fixed) restoreClean(cwd, 'spec');
        writeFileSync(journalFileOf(s.configDir, n), jl(...journalOf(seeded)));
      };
      const fake = makeFake(s.configDir, { afterRun });
      const r = await runBatch(nativeOpts(s, 'spec-nativo-B', { arm: 'perguntas' }), { exec: fake.exec, now: NOW });
      return r.aggregate.attempts[0];
    } finally {
      s.done();
    }
  };
  const empty = await run((b) => [{ label: 'E5:spec-review1', result: rq([], 'measuredSpecBlob', b) }], false);
  assert.equal(empty.status, 'valid', JSON.stringify(empty));
  assert.deepEqual(empty.review, { questions: 0 });
  assert.deepEqual(empty.humanInputs, { blockingSeeded: 1, blockingAtEnd: 1 });
  assert.deepEqual(empty.toolCheck.exit === 0 || empty.toolCheck.exit === 1 || empty.toolCheck.exit === null, true);
  const asked = [(b) => ({ label: 'E5:spec-review1', result: rq(Q, 'measuredSpecBlob', b) }), () => ({ label: 'E5:spec-review-fix1', result: { summary: '[fab] fixed' } })];
  const fixedA = await run((b) => asked.map((f) => f(b)), true);
  assert.equal(fixedA.status, 'valid', JSON.stringify(fixedA));
  assert.deepEqual(fixedA.review, { questions: 1 });
  assert.deepEqual(fixedA.humanInputs, { blockingSeeded: 1, blockingAtEnd: 0 });
  assert.ok(fixedA.outcomes.some((o) => o.outcome === 'capturado'));
  const idle = await run((b) => asked.map((f) => f(b)), false);
  assert.deepEqual(idle.review, { questions: 1 });
  assert.ok(idle.outcomes.every((o) => o.outcome !== 'capturado'));
});

test('A4: running the generated script with a stub agent: an empty list calls no author, questions call exactly one', async () => {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const script = buildQuestionsScript({ reviewPrompt: 'R', fixPrompt: 'mode: unattended\n{{questions}}' }).replace(/^export const meta = \{[\s\S]*?\n\}\n/, '');
  const exec = async (questions) => {
    const calls = [];
    const agent = async (prompt, o) => {
      calls.push({ prompt, o });
      return o.label === 'E5:spec-review1' ? { questions } : { summary: 'ok' };
    };
    await new AsyncFunction('agent', script)(agent);
    return calls;
  };
  assert.equal((await exec([])).length, 1);
  const calls = await exec(Q);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].o.agentType, 'productivity-tools:spec-author');
  assert.ok(calls[1].prompt.includes('1. [fab] which file holds the cache? (changes the plan: [fab] adds a task)'), calls[1].prompt);
  assert.ok(!calls[1].prompt.includes('{{'));
});

// ---- Final-gate fixes: author commit, laco-infra, old spec-semeado refusal, batch counts ----

test('gate: the harness commits the author edit (the author never commits) and every reader sees the edited tip', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const seeded = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.spec}`);
      gitq(cwd, 'checkout', '-q', 'feat/E5');
      writeFileSync(join(cwd, NATIVE_PATHS.spec), norm(readFileSync(join(NATIVE_SCEN, 'spec.md'), 'utf8'))); // edited, not committed
      writeFileSync(journalFileOf(s.configDir, n), jl(
        { label: 'E5:spec-review1', result: rq(Q, 'measuredSpecBlob', seeded) },
        { label: 'E5:spec-review-fix1', result: { summary: '[fab] fixed' } },
      ));
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'spec-nativo-B', { arm: 'perguntas' }), { exec: fake.exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(a));
    assert.equal(a.authorCommitted, true);
    assert.ok(a.outcomes.some((o) => o.outcome === 'capturado'), JSON.stringify(a.outcomes));
    assert.deepEqual(a.humanInputs, { blockingSeeded: 1, blockingAtEnd: 0 });
    assert.deepEqual(a.toolCheck, { exit: 0 });
    const sent = fake.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');
    assert.equal(gitq(sent.cwd, 'status', '--porcelain', '--', NATIVE_PATHS.spec), '');
    const fix = JSON.parse(sentScript(fake).text.split(String.fromCharCode(10)).find((l) => l.startsWith('const FIX_PROMPT = ')).slice('const FIX_PROMPT = '.length));
    assert.ok(!/commit/i.test(fix.replace('Do not commit: the caller commits.', '')), fix);
    assert.equal(r.aggregate.humanInputsRaised, 0);
    assert.equal(r.aggregate.toolCheckFailed, 0);
  } finally {
    s.done();
  }
});

test('gate: nothing to commit when the author left the spec clean (authorCommitted false)', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const seeded = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.spec}`);
      writeFileSync(journalFileOf(s.configDir, n), jl({ label: 'E5:spec-review1', result: rq([], 'measuredSpecBlob', seeded) }));
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'spec-nativo-B', { arm: 'perguntas' }), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.attempts[0].authorCommitted, false);
    assert.equal(r.aggregate.humanInputsRaised, 0);
  } finally {
    s.done();
  }
});

test('gate: loop with review 1 and 1b both null is laco-infra, not formato-do-diario', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => writeFileSync(journalFileOf(s.configDir, n), jl(
      { label: 'E5:plan-review1', result: null },
      { label: 'E5:plan-review1b', result: null },
    ));
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'plano-nativo-A', { rounds: 'loop' }), { exec: fake.exec, now: NOW });
    assert.equal(r.aggregate.attempts[0].status, 'invalid');
    assert.equal(r.aggregate.attempts[0].reason, 'laco-infra');
  } finally {
    s.done();
  }
});

test('gate: --arm atual on the old spec-semeado variants is a UsageError that says why; plano-semeado is untouched', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    for (const v of ['spec-semeado-A', 'spec-semeado-B']) {
      await assert.rejects(runBatch(seededOpts(s, v, { stage: 'spec-review' }), { exec: fake.exec, now: NOW }), /spec-semeado.*spec\/1|spec\/1.*spec-semeado/);
    }
    assert.equal(fake.calls.filter((c) => c.cmd === 'claude').length, 0);
    const ok = await runBatch(seededOpts(s, 'plano-semeado-A', { stage: 'plan-review' }), { exec: makeFake(s.configDir).exec, now: NOW });
    assert.ok(ok.aggregate);
  } finally {
    s.done();
  }
});

test('gate: the aggregate counts failed tool checks and raised human inputs', async () => {
  const s = setup();
  try {
    const afterRun = (cwd, n) => {
      const seeded = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.spec}`);
      gitq(cwd, 'checkout', '-q', 'feat/E5');
      const f = join(cwd, NATIVE_PATHS.spec);
      const text = readFileSync(f, 'utf8');
      const m = /```json data\r?\n([\s\S]*?)\r?\n```/.exec(text);
      const data = JSON.parse(m[1]);
      data.needsPerson = [...(data.needsPerson ?? []), { q: 'fab', blocking: true, why: 'fab' }];
      writeFileSync(f, text.replace(m[1], JSON.stringify(data, null, 2)));
      writeFileSync(journalFileOf(s.configDir, n), jl({ label: 'E5:spec-review1', result: rq(Q, 'measuredSpecBlob', seeded) }, { label: 'E5:spec-review-fix1', result: { summary: '[fab]' } }));
    };
    const fake = makeFake(s.configDir, { afterRun });
    const r = await runBatch(nativeOpts(s, 'spec-nativo-B', { arm: 'perguntas' }), { exec: fake.exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(a));
    assert.ok(a.humanInputs.blockingAtEnd > a.humanInputs.blockingSeeded, JSON.stringify(a.humanInputs));
    assert.equal(r.aggregate.humanInputsRaised, 1);
    assert.equal(r.aggregate.toolCheckFailed, a.toolCheck.exit !== 0 && a.toolCheck.exit !== null ? 1 : 0);
  } finally {
    s.done();
  }
});

// ---- E26 B3: final-stage arms ----
const FINAL_ARMS = ['final-review-atual.md', 'final-fix-atual.md'];
const placeholdersOf = (t) => [...new Set([...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort();

test('B3: final-review-atual.md and final-fix-atual.md match the workflow in HEAD', () => {
  const wf = readFileSync(WORKFLOW, 'utf8');
  for (const f of FINAL_ARMS) {
    const arm = readArm(join(here, 'arms', f), { requireSource: true });
    assert.match(arm.source.commit, /^[0-9a-f]{40}$/, f);
    assert.equal(armMatchesRB(arm.text, wf), true, f);
  }
});

test('B3: a stale final arm is a UsageError', () => {
  const wf = readFileSync(WORKFLOW, 'utf8');
  const [arm1, arm2] = FINAL_ARMS.map((f) => readArm(join(here, 'arms', f), { requireSource: true }));
  const h = { arm: 'atual', base: 'atual', review: arm1, fixArm: arm2, fixCheck: null };
  assert.doesNotThrow(() => assertArmsCurrent(h, wf));
  assert.throws(() => assertArmsCurrent(h, wf.replace('Mode: review, lens:', 'Mode: look, lens:')), (e) => e instanceof UsageError && /review/.test(e.message));
  assert.throws(() => assertArmsCurrent(h, wf.replace('Fix the final review problems below', 'Mend the final review problems below')), (e) => e instanceof UsageError && /fix/.test(e.message));
});

test('B3: the final arm placeholders are the ones the harness fills', () => {
  const text = (f) => readFileSync(join(here, 'arms', f), 'utf8');
  assert.deepEqual(placeholdersOf(text('final-review-atual.md')), ['TARGET', 'cardRef', 'lens', 'planPath', 'specPath', 'wt']);
  assert.deepEqual(placeholdersOf(text('final-fix-atual.md')), ['E', 'issues', 'lockNote', 'noSpecEdit']);
});

// ---- E26 B2: frozen single-round task-review script (DEC-735) ----
// sha256 of the whole review-only.js of codigo-semeado-A (task-review, single round, arm atual, sonnet) with the sandbox path as <SB>.
const GOLDEN_SINGLE_TASK_A = 'aca0874220b8c981035bad89e01eb6a7d20990303966804662b4ff97a4e0a0ba';

test('B2: the single-round task-review script of codigo-semeado-A is frozen (golden)', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    await runBatch(taskOpts(s), { exec: fake.exec, now: NOW });
    const sent = firstClaudeP(fake);
    const text = readFileSync(join(sent.cwd, 'review-only.js'), 'utf8').split(sent.cwd.replace(/\\/g, '/')).join('<SB>').replace(/[0-9a-f]{40}/g, '<SHA>'); // the seeded commit sha differs per run (commit dates)
    assert.ok(text.includes('const FIX_PROMPT = '));
    assert.ok(text.includes('<SHA>~1'), 'the seeded commit is named in the review range');
    assert.ok(!/[A-Za-z]:[\\/]/.test(text), 'no absolute Windows path left');
    assert.equal(sha256Of(text), GOLDEN_SINGLE_TASK_A, text);
  } finally {
    s.done();
  }
});

// ---- E26 B2: task-review loop options, refusals and wiring ----
const { stageLoopFor, checkLoopWorkflow } = await import('./run-batch.mjs');
const corrOpts = (s, extra = {}) => seededOpts(s, 'correcao-semeada-A', { stage: 'task-review', reviewModel: 'sonnet', ...extra });

// A measured plugin with the task reviewer, the given workflow text and (unless told otherwise) the review-package script.
function taskLoopPlugin(parent, workflowText, { pkg = true } = {}) {
  const dir = pluginDirWithWorkflow(parent, workflowText);
  if (pkg) {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    writeFileSync(join(dir, 'scripts', 'review-package.mjs'), '// fab\n');
  }
  return dir;
}

test('B2: --stage task-review --rounds loop accepts only correcao-semeada-A/B with --arm atual|restrita and a --review-model', async () => {
  const s = setup();
  try {
    const wf = readFileSync(WORKFLOW, 'utf8');
    const good = taskLoopPlugin(s.base, wf);
    const refused = [
      ['codigo-semeado-A', { rounds: 'loop' }, /correcao-semeada/],
      ['codigo-semeado-B', { rounds: 'loop', arm: 'restrita' }, /correcao-semeada/],
      ['correcao-semeada-A', { rounds: 'single' }, /loop/],
      ['correcao-semeada-B', { rounds: 'single', arm: 'restrita' }, /loop/],
      ['correcao-semeada-A', { arm: 'adversarial' }, /final-review/],
      ['correcao-semeada-A', { arm: 'perguntas' }, /perguntas/],
      ['correcao-semeada-A', { reviewModel: undefined }, /review-model/],
      ['correcao-semeada-A', { reviewModel: 'gpt' }, /review-model/],
      ['codigo-semeado-A', { arm: 'restrita' }, /restrita|loop/],
    ];
    for (const [variant, extra, re] of refused) {
      const fake = makeFake(s.configDir);
      const opts = seededOpts(s, variant, { stage: 'task-review', reviewModel: 'sonnet', pluginDir: good, ...extra });
      if (extra.reviewModel === undefined && 'reviewModel' in extra) delete opts.reviewModel;
      await assert.rejects(runBatch(opts, { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && re.test(e.message), `${variant} ${JSON.stringify(extra)}`);
      assert.equal(claudeCalls(fake).length, 0);
    }
    // the same refusals through the CLI end in exit code 2 before any claude call
    const cli = spawnSync(process.execPath, [script, '--variant', 'correcao-semeada-A', '--stage', 'task-review', '--review-model', 'sonnet', '--rounds', 'single', '--plugin-dir', good, '--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'], { encoding: 'utf8' });
    assert.equal(cli.status, 2, cli.stderr);
    // restrita outside task-review and adversarial outside final-review are refused too
    for (const [variant, stage, arm] of [['spec-nativo-A', 'spec-review', 'restrita'], ['plano-semeado-A', 'plan-review', 'adversarial']]) {
      await assert.rejects(runBatch(seededOpts(s, variant, { stage, arm, pluginDir: good }), { exec: makeFake(s.configDir).exec, now: NOW }), UsageError);
    }
  } finally {
    s.done();
  }
});

test('B2: stageLoopFor(task-review) is { tier: sonnet, reviewModel, reviewEffort, maxFix: 2, byId: true } and the harness records taskReview', async () => {
  assert.deepEqual(stageLoopFor('task-review', 'sonnet'), { tier: 'sonnet', reviewModel: 'sonnet', reviewEffort: 'medium', maxFix: 2, byId: true });
  assert.deepEqual(stageLoopFor('task-review', 'opus'), { tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2, byId: true });
  assert.deepEqual(stageLoopFor('task-review', 'haiku'), { tier: 'sonnet', reviewModel: 'haiku', reviewEffort: 'low', maxFix: 2, byId: true });
  assert.equal(stageLoopFor('task-review', undefined), null);
  assert.equal(stageLoopFor('task-review', 'gpt'), null);
  assert.deepEqual(stageLoopFor('spec-review'), { tier: 'opus', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 });
  assert.deepEqual(stageLoopFor('plan-review'), { tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 });
  const s = setup();
  try {
    const good = taskLoopPlugin(s.base, readFileSync(WORKFLOW, 'utf8'));
    for (const [arm, model] of [['atual', 'sonnet'], ['restrita', 'opus']]) {
      const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
      const r = await runBatch(corrOpts(s, { arm, reviewModel: model, pluginDir: good, work: join(s.base, `w-${arm}`) }), { exec: fake.exec, now: NOW });
      const h = r.aggregate.harness;
      assert.equal(h.arm, arm);
      assert.equal(h.rounds, 'loop');
      assert.deepEqual(h.taskReview, { restricted: arm === 'restrita' });
      assert.deepEqual(h.stageOptions, stageLoopFor('task-review', model));
      assert.match(h.pureSha256, /^[0-9a-f]{64}$/);
      assert.ok(r.dir.includes(`correcao-semeada-A-task-review-${arm}-${model}-loop-`), r.dir);
      // the launched script is the task loop, with the arm's switch and the seeded correction
      const sent = firstClaudeP(fake);
      assert.ok(sent.args.join(' ').includes('review-only.js'));
      const text = readFileSync(join(sent.cwd, 'review-only.js'), 'utf8');
      assert.ok(text.includes(`const H_TR = {"restricted":${arm === 'restrita'}}`), text.slice(0, 300));
      assert.match(text, /const H_FIXSHA = "[0-9a-f]{40}"/);
      assert.match(text, /merge --ff-only [0-9a-f]{40}/);
      assert.ok(text.includes('runReviewLoop(H_env, '));
      assert.ok(text.includes(`const H_RM = "${model}"`));
      assert.ok(existsSync(join(resolve(s.base, `w-${arm}`), '_tmp')), 'the diff directory sits next to the sandboxes, outside them');
    }
  } finally {
    s.done();
  }
});

test('B2: startup refusals on the task slice', async () => {
  const s = setup();
  try {
    const wf = readFileSync(WORKFLOW, 'utf8');
    const cases = [
      ['byId: true })', 'byId: false })'],
      ['taskReview: TR', 'taskReview: null'],
      ['taskIssues(r, cx)', 'r.issues'],
      ['revAgent(buildTaskReviewPrompt(', 'revAgent(buildTaskReviewPromptX('],
      ['tr.restricted === true', 'tr.restricted'],
      ['function restrictedRound(', 'function restrictedRoundX('],
      ['function taskIssues(', 'function taskIssuesX('],
    ];
    for (const [lit, repl] of cases) {
      assert.ok(wf.includes(lit), lit);
      const plugin = taskLoopPlugin(s.base, wf.replace(lit, repl));
      const fake = makeFake(s.configDir);
      const needle = lit.replace(/\($/, '');
      await assert.rejects(runBatch(corrOpts(s, { pluginDir: plugin, work: join(s.base, 'w-ref') }), { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && e.message.includes(needle), lit);
      assert.equal(claudeCalls(fake).length, 0, lit);
    }
    // a plugin without scripts/review-package.mjs cannot run the restricted arm: refused for both arms
    const noPkg = taskLoopPlugin(s.base, wf, { pkg: false });
    for (const arm of ['atual', 'restrita']) {
      const fake = makeFake(s.configDir);
      await assert.rejects(runBatch(corrOpts(s, { arm, pluginDir: noPkg, work: join(s.base, 'w-nopkg') }), { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && /review-package\.mjs/.test(e.message));
      assert.equal(claudeCalls(fake).length, 0);
    }
    // the literal that sits in the slice drifts only when it leaves the task slice: a copy elsewhere does not hide it
    const at = wf.indexOf('reviewLoop(`T${t.n}:${kind}`,');
    const tail = wf.slice(at);
    const drifted = wf.slice(0, at) + tail.replace('byId: true })', 'x })') + '\n// byId: true })\n';
    assert.throws(() => checkLoopWorkflow(drifted, 'task-review'), (e) => e instanceof UsageError && /byId: true \}\)/.test(e.message));
  } finally {
    s.done();
  }
});

test('B2: the A1 refusal of task-review loop is narrowed, not removed', async () => {
  const s = setup();
  try {
    const good = taskLoopPlugin(s.base, readFileSync(WORKFLOW, 'utf8'));
    // legacy seeded code in a loop is still refused (exit 2 through the CLI)
    const cli = spawnSync(process.execPath, [script, '--variant', 'codigo-semeado-A', '--stage', 'task-review', '--review-model', 'sonnet', '--plugin-dir', good, '--rounds', 'loop', '--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'], { encoding: 'utf8' });
    assert.equal(cli.status, 2, cli.stderr);
    // and its single round is the frozen script: no loop constants
    const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    await runBatch(taskOpts(s, { pluginDir: good }), { exec: fake.exec, now: NOW });
    assert.ok(!readFileSync(join(firstClaudeP(fake).cwd, 'review-only.js'), 'utf8').includes('H_FIXSHA'));
  } finally {
    s.done();
  }
});

// ---- E26 B4: validity, outcome and replay of the task review loop with the seeded correction ----
const { loopResult, loopValidity, readScriptResult, mentionStats, recountWithoutMention, buildTaskLoopScript } = await import('./run-batch.mjs');
const { loadPure } = await import('../../plugins/productivity-tools/skills/roadmap-release/workflow/load-pure.mjs');
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;

const hTask = (arm = 'atual') => ({ stage: 'task-review', arm, st: { label: 'E5:task-review' }, harness: { reviewModel: 'sonnet' } });
const trv = (issues, head = 'a'.repeat(40), extra = {}) => ({ issues, headSha: head, clean: true, commitsInRange: 3, ...extra });
const FOUND = (id, d = `[fab] ${id}`, file = 'src/a.mjs') => ({ id, severity: 'important', category: 'defeito', description: d, file });
const APPLIED_FIX = { status: 'DONE', summary: '[fab] applied', checks: [] };
// the parent finding of CR1 (its mention matches it), a finding unrelated to the seeded defects, one that mentions CG1
const F_PARENT = FOUND('F1', 'wordCount empty text case is not tested', 'tests/e5-word-count.test.mjs');
const F_OTHER = FOUND('F2', 'naming nit about slugify', 'src/slugify.mjs');
const F_CG1 = FOUND('F2', 'index.mjs no longer exports truncate', 'src/index.mjs');
const entry = (label, result) => ({ label, result, text: '' });

// Runs the real generated task loop script with a stub agent; returns its return and the journal it would have left.
async function stubScript({ restricted = false, reviews, fixes = {} }) {
  const wf = readFileSync(WORKFLOW, 'utf8');
  const scenarioStub = { dir: 'D:/work/correcao-semeada-A-1', seededCommit: 'a'.repeat(40), fixSha: 'b'.repeat(40) };
  const text = buildTaskLoopScript({ pure: checkLoopWorkflow(wf, 'task-review'), scenario: scenarioStub, opts: { restricted, reviewModel: 'sonnet', pluginRoot: 'D:/cfg/p', work: 'D:/work', title: 'Word count', fixPrompt: 'Fix it.\n{{issues}}' } });
  const journal = [];
  let i = 0;
  const agent = async (prompt, o) => {
    const out = /-fix\d+$/.test(o.label) ? (o.label in fixes ? fixes[o.label] : APPLIED_FIX) : reviews[Math.min(i++, reviews.length - 1)];
    journal.push(entry(o.label, out));
    return out;
  };
  const result = await new AsyncFn('agent', text.replace('export const meta', 'const meta'))(agent);
  return { result, journal, scenario: scenarioStub };
}

// A Workflow tool_use and its tool_result in the main transcript: direct (string), list (text blocks) or background (a later user message).
function appendWorkflowReturn(configDir, n, ret, shape) {
  if (shape === 'none') return;
  const file = join(configDir, 'projects', 'fab-sandbox', `${sid(n)}.jsonl`);
  const id = `toolu_fab_${n}`;
  const usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  const text = typeof ret === 'string' ? ret : JSON.stringify(ret);
  const lines = [{ type: 'assistant', uuid: `00000000-0000-4000-8000-0000000e${String(n).padStart(4, '0')}`, requestId: `req_fab_wf${n}`, message: { id: `msg_fab_wf${n}`, role: 'assistant', model: 'claude-opus-4-1', content: [{ type: 'tool_use', id, name: 'Workflow', input: {} }], usage } }];
  const content = shape === 'direct' ? text : shape === 'list' ? [{ type: 'text', text }] : '[fab] workflow launched in the background';
  lines.push({ type: 'user', uuid: `00000000-0000-4000-8000-0000000f${String(n).padStart(4, '0')}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] } });
  if (shape === 'background') lines.push({ type: 'user', uuid: `00000000-0000-4000-8000-0000000d${String(n).padStart(4, '0')}`, message: { role: 'user', content: `[fab] <task-notification> workflow finished: ${text}` } });
  appendFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

// The run, as the simulated claude -p leaves it: the seeded correction applied on feat/E5 (unless told otherwise), the journal, the script return.
function taskAfterRun(s, spec) {
  return (cwd, n) => {
    const fixSha = /const H_FIXSHA = "([0-9a-f]{40})"/.exec(readFileSync(join(cwd, 'review-only.js'), 'utf8'))[1];
    const sp = spec(n, fixSha);
    if (sp.apply !== false) {
      gitq(cwd, 'checkout', '-q', 'feat/E5');
      gitq(cwd, 'merge', '--ff-only', fixSha);
    }
    if (sp.after) sp.after(cwd, fixSha);
    writeFileSync(journalFileOf(s.configDir, n), jl(...sp.entries(fixSha)));
    appendWorkflowReturn(s.configDir, n, sp.ret, sp.shape ?? 'direct');
  };
}
// The 2nd fix of the run removes the seeded defects: the clean T1..T3 code in one commit.
function cleanFix(cwd) {
  for (const k of [1, 2, 3]) cpSync(join(here, 'scenario', 'e5', 'code', `t${k}`), cwd, { recursive: true });
  gitq(cwd, 'rm', '-q', '-f', '--ignore-unmatch', 'src/helpers.mjs');
  gitq(cwd, 'add', '-A');
  gitq(cwd, 'commit', '-q', '-m', 'E5 T3: fix the review findings');
}
const corrBatch = (s, extra = {}) => seededOpts(s, 'correcao-semeada-A', { stage: 'task-review', reviewModel: 'sonnet', pluginDir: REAL_PLUGIN, ...extra });
const unitScenario = async (s, variant = 'correcao-semeada-A') => {
  const sc = await makeScenario(join(s.work, `unit-${variant}`), variant, { suite: () => ({ ok: true }) });
  gitq(sc.dir, 'checkout', '-q', 'feat/E5');
  return sc;
};

test('B4: formato-do-diario when E5:task-review1 has no issues list', async () => {
  const s = setup();
  try {
    const afterRun = taskAfterRun(s, () => ({ entries: () => [{ label: 'E5:task-review1', result: { headSha: 'x', clean: true, commitsInRange: 3 } }], ret: { ok: true, restricted: [false] } }));
    const r = await runBatch(corrBatch(s), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    assert.equal(r.aggregate.invalidReasons['formato-do-diario'], 1, JSON.stringify(r.aggregate.invalidReasons));
  } finally {
    s.done();
  }
});

test('B4: sem-correcao when the replay never called fix1 (loop.fixes === 0)', async () => {
  const s = setup();
  try {
    // a clean 1st review: the script returned ok with no fix, the correction was never applied
    const afterRun = taskAfterRun(s, () => ({ apply: false, entries: () => [{ label: 'E5:task-review1', result: trv([]) }], ret: { ok: true, restricted: [false] } }));
    const r = await runBatch(corrBatch(s), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    assert.equal(r.aggregate.invalidReasons['sem-correcao'], 1, JSON.stringify(r.aggregate.invalidReasons));
    // only loop.fixes decides, not a count of BLOCKING
    const sc = await unitScenario(s);
    const journal = { entries: [entry('E5:task-review1', trv([FOUND('F1')]))] };
    assert.deepEqual(await loopValidity(hTask(), journal, sc, { fixes: 0, ok: false, restrictedRounds: [false] }, { ok: false, restricted: [false] }), { valid: false, reason: 'sem-correcao' });
  } finally {
    s.done();
  }
});

test('B4: correcao-semeada-ausente when review 2 headSha does not resolve to fixSha, or fixSha is not an ancestor of feat/E5', async () => {
  const s = setup();
  try {
    const sc = await unitScenario(s);
    const seeded = sc.seededCommit;
    const loop = { fixes: 1, ok: true, restrictedRounds: [false, false] };
    const script = { ok: true, restricted: [false, false] };
    const journalAt = (head) => ({ entries: [entry('E5:task-review1', trv([FOUND('F1')])), entry('E5:task-review2', trv([], head))] });
    const ausente = { valid: false, reason: 'correcao-semeada-ausente' };
    // fixSha is not on feat/E5 yet: not an ancestor
    assert.deepEqual(await loopValidity(hTask(), journalAt(sc.fixSha), sc, loop, script), ausente);
    gitq(sc.dir, 'merge', '--ff-only', sc.fixSha);
    assert.deepEqual(await loopValidity(hTask(), journalAt(sc.fixSha), sc, loop, script), { valid: true, reason: 'ok' });
    // an abbreviated SHA (7 hex) of fixSha is accepted: it is resolved with git rev-parse <sha>^{commit}
    assert.deepEqual(await loopValidity(hTask(), journalAt(sc.fixSha.slice(0, 7)), sc, loop, script), { valid: true, reason: 'ok' });
    // another commit, a missing one, and a non-SHA are not the correction
    for (const head of [seeded, '0'.repeat(40), 'HEAD', undefined]) assert.deepEqual(await loopValidity(hTask(), journalAt(head), sc, loop, script), ausente, String(head));
  } finally {
    s.done();
  }
});

test('B4: restrita-nao-ativada when the restrita arm reaches round 2 and restrictedRounds[1] === false', async () => {
  const s = setup();
  try {
    const sc = await unitScenario(s);
    gitq(sc.dir, 'merge', '--ff-only', sc.fixSha);
    const journal = { entries: [entry('E5:task-review1', trv([FOUND('F1')])), entry('E5:task-review2', trv([], sc.fixSha))] };
    const off = await loopValidity(hTask('restrita'), journal, sc, { fixes: 1, ok: true, restrictedRounds: [false, false] }, { ok: true, restricted: [false, false] });
    assert.deepEqual(off, { valid: false, reason: 'restrita-nao-ativada' });
    const on = await loopValidity(hTask('restrita'), journal, sc, { fixes: 1, ok: true, restrictedRounds: [false, true] }, { ok: true, restricted: [false, true] });
    assert.deepEqual(on, { valid: true, reason: 'ok' });
    // the complete arm never restricts: false in round 2 is what it should do
    assert.equal((await loopValidity(hTask('atual'), journal, sc, { fixes: 1, ok: true, restrictedRounds: [false, false] }, { ok: true, restricted: [false, false] })).valid, true);
    // the replay computes it in the review callback with the `was` of runReviewLoop, equal to the script's own value
    const P = loadPure();
    const noId = { severity: 'critical', category: 'defeito', description: '[fab] no id', file: 'src/a.mjs' };
    for (const [first, expected] of [[[noId], [false, false]], [[FOUND('F1')], [false, true]]]) {
      const run = await stubScript({ restricted: true, reviews: [trv(first), trv([], 'a'.repeat(40), { verdicts: [{ id: 'F1', open: false }] })] });
      assert.deepEqual(run.result.restricted, expected);
      const replay = await loopResult(hTask('restrita'), run.journal, P, run.scenario);
      assert.deepEqual(replay.restrictedRounds, run.result.restricted);
      assert.equal(replay.ok, run.result.ok);
    }
  } finally {
    s.done();
  }
});

test('B4: laco-infra after a null review or fix with the retry', async () => {
  const P = loadPure();
  const sc = { seededCommit: 'a'.repeat(40) };
  assert.deepEqual(await loopResult(hTask(), [entry('E5:task-review1', null), entry('E5:task-review1b', null)], P, sc), { infra: true });
  assert.deepEqual(await loopResult(hTask(), [entry('E5:task-review1', trv([FOUND('F1')])), entry('E5:task-review-fix1', null)], P, sc), { infra: true });
  assert.deepEqual(await loopResult(hTask(), [entry('E5:task-review1', trv([FOUND('F1')])), entry('E5:task-review-fix1', APPLIED_FIX), entry('E5:task-review2', null), entry('E5:task-review2b', null)], P, sc), { infra: true });
  // review 1 null and its retry 1b answering is not infra
  const ok = await loopResult(hTask(), [entry('E5:task-review1', null), entry('E5:task-review1b', trv([]))], P, sc);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.restrictedRounds, [false]); // the retry round 1b is not counted, as in the script
});

test('B4: laco-divergente when the replay ok differs from the script ok, or the journal has an unused or repeated stage label', async () => {
  const P = loadPure();
  const sc = { seededCommit: 'a'.repeat(40) };
  const clean = entry('E5:task-review1', trv([]));
  assert.deepEqual(await loopResult(hTask(), [clean, entry('E5:task-review-fix1', APPLIED_FIX)], P, sc), { divergent: true });
  assert.deepEqual(await loopResult(hTask(), [clean, clean], P, sc), { divergent: true });
  assert.deepEqual(await loopResult(hTask(), [clean, entry('E5:task-review-extra', {})], P, sc), { divergent: true });
  // a tampered journal: the script blocked to the end, one verdict was swapped to clean
  const run = await stubScript({ reviews: [trv([FOUND('F1')]), trv([FOUND('F2')]), trv([FOUND('F3')])] });
  assert.equal(run.result.ok, false);
  const tampered = run.journal.map((e) => (e.label === 'E5:task-review3' ? entry(e.label, trv([])) : e));
  const replay = await loopResult(hTask(), tampered, P, run.scenario);
  assert.equal(replay.ok, true);
  const s = setup();
  try {
    const sandbox = await unitScenario(s);
    gitq(sandbox.dir, 'merge', '--ff-only', sandbox.fixSha);
    const journal = { entries: [entry('E5:task-review1', trv([FOUND('F1')])), entry('E5:task-review2', trv([], sandbox.fixSha))] };
    const div = { valid: false, reason: 'laco-divergente' };
    const loop = { fixes: 1, ok: true, restrictedRounds: [false, false] };
    assert.deepEqual(await loopValidity(hTask(), journal, sandbox, loop, { ok: false, restricted: [false, false] }), div);
    assert.deepEqual(await loopValidity(hTask(), journal, sandbox, loop, { ok: true, restricted: [false, true] }), div);
    assert.deepEqual(await loopValidity(hTask(), journal, sandbox, loop, { ok: true }), div);
    // the script return absent: formato-do-diario
    assert.deepEqual(await loopValidity(hTask(), journal, sandbox, loop, null), { valid: false, reason: 'formato-do-diario' });
    assert.equal((await loopValidity(hTask(), journal, sandbox, loop, { ok: true, restricted: [false, false] })).valid, true);
    // The real tool_result format of Workflow is confirmed on the 1st probe; the three shapes below are the ones read.
    mkdirSync(join(s.configDir, 'projects', 'fab-sandbox'), { recursive: true });
    ['direct', 'list', 'background'].forEach((shape, i) => {
      writeFileSync(join(s.configDir, 'projects', 'fab-sandbox', `${sid(i + 1)}.jsonl`), '');
      appendWorkflowReturn(s.configDir, i + 1, { ok: true, restricted: [false, false], verify: null }, shape);
    });
    for (const n of [1, 2, 3]) assert.deepEqual(readScriptResult(s.configDir, [sid(n)]), { ok: true, restricted: [false, false], verify: null }, `shape ${n}`);
    assert.equal(readScriptResult(s.configDir, [sid(9)]), null);
    writeFileSync(join(s.configDir, 'projects', 'fab-sandbox', `${sid(4)}.jsonl`), '');
    appendWorkflowReturn(s.configDir, 4, 'launched, no return yet', 'direct');
    assert.equal(readScriptResult(s.configDir, [sid(4)]), null);
  } finally {
    s.done();
  }
});

test('B4: laco-divergente twice in a batch stops the batch and writes aggregate.stoppedBy', async () => {
  const s = setup();
  try {
    const spec = () => ({ apply: false, entries: () => [{ label: 'E5:task-review1', result: trv([]) }, { label: 'E5:task-review-extra', result: { summary: '[fab]' } }], ret: { ok: true, restricted: [false] } });
    const r = await runBatch(corrBatch(s, { runs: 4 }), { exec: makeFake(s.configDir, { afterRun: taskAfterRun(s, spec) }).exec, now: NOW });
    assert.deepEqual(r.aggregate.attempts.map((a) => a.reason), ['laco-divergente', 'laco-divergente']);
    assert.equal(r.aggregate.stoppedBy, 'laco-divergente');
    assert.equal(r.aggregate.requested, 4);
  } finally {
    s.done();
  }
});

test('B4: semente-ausente when afterFirstFix headSha is not fixSha or CR/CG are not present there', async () => {
  const s = setup();
  try {
    const sc = await unitScenario(s);
    gitq(sc.dir, 'merge', '--ff-only', sc.fixSha);
    const journal = { entries: [entry('E5:task-review1', trv([FOUND('F1')])), entry('E5:task-review2', trv([], sc.fixSha))] };
    const loop = { fixes: 1, ok: true, restrictedRounds: [false, false] };
    const script = { ok: true, restricted: [false, false] };
    assert.equal((await loopValidity(hTask(), journal, sc, loop, script)).valid, true);
    // the entries of the other artifact are not in this fixSha
    const other = { ...sc, variant: 'correcao-semeada-B' };
    assert.deepEqual(await loopValidity(hTask(), journal, other, loop, script), { valid: false, reason: 'semente-ausente' });
    // with blobKey null the state after the 1st fix is verified by its SHA: review 2 naming fixSha is verified, not "always unverified"
    const run = taskAfterRun(s, () => ({ entries: (fixSha) => [entry('E5:task-review1', trv([F_PARENT])), entry('E5:task-review-fix1', APPLIED_FIX), entry('E5:task-review2', trv([], fixSha))], ret: { ok: true, restricted: [false, false] } }));
    const r = await runBatch(corrBatch(s), { exec: makeFake(s.configDir, { afterRun: run }).exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(r.aggregate.invalidReasons));
    assert.equal(a.afterFirstFix.verified, true);
    assert.match(a.afterFirstFix.headSha, /^[0-9a-f]{40}$/);
    assert.equal(r.aggregate.afterFirstFixUnverified, 0);
  } finally {
    s.done();
  }
});

// Three attempts of one batch: (1) fix1 then clean; (2) fix1, fix2 that removes the defects, clean; (3) two fixes, stopped, review 2 mentions CG1.
const threeAttempts = (s) =>
  taskAfterRun(s, (n) => {
    const fx = (k) => entry(`E5:task-review-fix${k}`, APPLIED_FIX);
    if (n === 1) return { entries: (f) => [entry('E5:task-review1', trv([F_PARENT])), fx(1), entry('E5:task-review2', trv([], f.slice(0, 7)))], ret: { ok: true, restricted: [false, false] } };
    if (n === 2) return { after: (cwd) => cleanFix(cwd), shape: 'background', entries: (f) => [entry('E5:task-review1', trv([F_PARENT])), fx(1), entry('E5:task-review2', trv([F_OTHER], f)), fx(2), entry('E5:task-review3', trv([]))], ret: { ok: true, restricted: [false, false, false] } };
    return { shape: 'list', entries: (f) => [entry('E5:task-review1', trv([F_PARENT])), fx(1), entry('E5:task-review2', trv([F_CG1], f)), fx(2), entry('E5:task-review3', trv([FOUND('F3', 'other blocking')]))], ret: { ok: false, restricted: [false, false, false] } };
  });

test('B4: capturado requires fix2', async () => {
  const s = setup();
  try {
    const r = await runBatch(corrBatch(s, { runs: 3 }), { exec: makeFake(s.configDir, { afterRun: threeAttempts(s) }).exec, now: NOW });
    const [a1, a2, a3] = r.aggregate.attempts;
    assert.deepEqual([a1.status, a2.status, a3.status], ['valid', 'valid', 'valid'], JSON.stringify(r.aggregate.invalidReasons));
    // no fix2, approved: the seeds are still there
    assert.deepEqual(outcomeMap(a1), { CR1: 'perdido', CG1: 'perdido' });
    // fix2 removes them
    assert.deepEqual(outcomeMap(a2), { CR1: 'capturado', CG1: 'capturado' });
    // stopped with the seeds there
    assert.equal(a3.loop.ok, false);
    assert.deepEqual(outcomeMap(a3), { CR1: 'indeterminado', CG1: 'indeterminado' });
  } finally {
    s.done();
  }
});

test('B4: mentionedAfterFix, capturadoSemMencao, perdidoDoCorretor, residuoSemAchadoPai counted on fixture journals', async () => {
  const entries = (...e) => e.map(([l, r]) => entry(l, r));
  const ids = ['CR1', 'CG1'];
  // the mention of CR1 matches the parent finding of review 1; CG1 is mentioned after the fix
  const withParent = mentionStats(entries(['E5:task-review1', trv([F_PARENT])], ['E5:task-review-fix1', APPLIED_FIX], ['E5:task-review2', trv([F_CG1])]), 'E5:task-review', ids);
  assert.deepEqual(withParent, { mentionedAfterFix: { CR1: false, CG1: true }, residuoSemAchadoPai: 0 });
  // without a parent finding in review 1 the residue counts; review 1 never counts as a mention after the fix
  const noParent = mentionStats(entries(['E5:task-review1', trv([F_OTHER, F_CG1])], ['E5:task-review2', trv([])]), 'E5:task-review', ids);
  assert.deepEqual(noParent, { mentionedAfterFix: { CR1: false, CG1: false }, residuoSemAchadoPai: 1 });
  // restricted mode: an open verdict on the id of the parent finding mentions the residue
  const restrictedOpen = mentionStats(entries(['E5:task-review1', trv([F_PARENT])], ['E5:task-review2', trv([], 'x', { verdicts: [{ id: 'F1', open: true }] })]), 'E5:task-review', ids);
  assert.equal(restrictedOpen.mentionedAfterFix.CR1, true);
  const restrictedClosed = mentionStats(entries(['E5:task-review1', trv([F_PARENT])], ['E5:task-review2', trv([], 'x', { verdicts: [{ id: 'F1', open: false }] })]), 'E5:task-review', ids);
  assert.equal(restrictedClosed.mentionedAfterFix.CR1, false);
  // the batch counters over three attempts: attempt 2 captured both without mention, attempt 3 kept CG1 and the reviewer mentioned it
  const s = setup();
  try {
    const r = await runBatch(corrBatch(s, { runs: 3 }), { exec: makeFake(s.configDir, { afterRun: threeAttempts(s) }).exec, now: NOW });
    assert.deepEqual(r.aggregate.attempts.map((a) => a.mentionedAfterFix), [{ CR1: false, CG1: false }, { CR1: false, CG1: false }, { CR1: false, CG1: true }]);
    assert.equal(r.aggregate.capturadoSemMencao, 2);
    assert.equal(r.aggregate.perdidoDoCorretor, 1);
    assert.equal(r.aggregate.residuoSemAchadoPai, 0);
  } finally {
    s.done();
  }
  // more than 2 attempts with a residue without parent finding stop the batch
  const s2 = setup();
  try {
    const spec = () => ({ entries: (f) => [entry('E5:task-review1', trv([F_OTHER])), entry('E5:task-review-fix1', APPLIED_FIX), entry('E5:task-review2', trv([], f))], ret: { ok: true, restricted: [false, false] } });
    const r = await runBatch(corrBatch(s2, { runs: 6 }), { exec: makeFake(s2.configDir, { afterRun: taskAfterRun(s2, spec) }).exec, now: NOW });
    assert.equal(r.aggregate.valid, 3, JSON.stringify(r.aggregate.invalidReasons));
    assert.equal(r.aggregate.residuoSemAchadoPai, 3);
    assert.equal(r.aggregate.stoppedBy, 'residuoSemAchadoPai');
    assert.equal(r.aggregate.attempts.length, 3);
  } finally {
    s2.done();
  }
});

test('B4: replay ok equals the script ok in the task arms (atual and restrita)', async () => {
  const P = loadPure();
  const F = (id) => FOUND(id);
  const sequences = {
    'clean on the 1st': { reviews: [trv([])] },
    'fix and clean': { reviews: [trv([F('F1')]), trv([])] },
    'blocks always': { reviews: [trv([F('F1')]), trv([F('F2')]), trv([F('F3')])] },
    'repeated finding (escalates)': { reviews: [trv([F('F1')]), trv([F('F1')]), trv([F('F1')]), trv([F('F1')])] },
  };
  for (const arm of ['atual', 'restrita']) {
    for (const [name, seq] of Object.entries(sequences)) {
      const run = await stubScript({ restricted: arm === 'restrita', ...seq });
      const replay = await loopResult(hTask(arm), run.journal, P, run.scenario);
      assert.equal(replay.ok, run.result.ok, `${arm} ${name}`);
      assert.deepEqual(replay.restrictedRounds, run.result.restricted, `${arm} ${name}`);
    }
  }
});

test('B4: aggregate fields', async () => {
  const s = setup();
  try {
    const r = await runBatch(corrBatch(s, { runs: 3 }), { exec: makeFake(s.configDir, { afterRun: threeAttempts(s) }).exec, now: NOW });
    const g = r.aggregate;
    assert.deepEqual(g.harness.taskReview, { restricted: false });
    assert.match(g.harness.seededFix.sha, /^[0-9a-f]{40}$/);
    assert.deepEqual(g.harness.seededFix.ids, ['CR1', 'CG1']);
    assert.deepEqual(g.attempts.map((a) => a.loop.restrictedRounds), [[false, false], [false, false, false], [false, false, false]]);
    for (const k of ['capturadoSemMencao', 'perdidoDoCorretor', 'residuoSemAchadoPai', 'refutouTudo']) assert.equal(typeof g[k], 'number', k);
    assert.equal(g.stoppedBy, undefined);
  } finally {
    s.done();
  }
  // DEC-737 / DEC-732: the recount takes the two arms and says inconclusivo when the side of the rule changes
  const arm = (capt, lost, semMencao) => {
    const attempts = Array.from({ length: capt + lost }, (_, i) => ({ status: 'valid', n: i + 1, outcomes: [{ id: 'CR1', class: 'code', detectedBy: 'reviewer', outcome: i < capt ? 'capturado' : 'perdido' }], mentionedAfterFix: { CR1: i >= semMencao } }));
    return { attempts, outcomes: { CR1: { class: 'code', detectedBy: 'reviewer', capturado: capt, perdido: lost, indeterminado: 0 } } };
  };
  // (a) determined counts stay fixed (20 each), the restricted captures fall to 3 below the complete: restrita enters before, not after
  const a = recountWithoutMention(arm(10, 10, 0), arm(8, 12, 1));
  assert.deepEqual([a.restrita.antes, a.restrita.depois], [{ det: 20, capt: 8 }, { det: 19, capt: 7 }]);
  assert.deepEqual(a.completa.depois, { det: 20, capt: 10 });
  assert.deepEqual(a.side, { antes: 'restrita', depois: 'completa' });
  assert.equal(a.inconclusivo, true);
  // (b) both at 19 captures is the ceiling (completa); one falling to 18 moves the side
  const b = recountWithoutMention(arm(19, 1, 1), arm(19, 1, 0));
  assert.deepEqual(b.side, { antes: 'completa', depois: 'restrita' });
  assert.equal(b.inconclusivo, true);
  assert.equal(b.capturadoSemMencao.completa, 1);
  // (c) a recount that keeps the side
  const c = recountWithoutMention(arm(10, 10, 0), arm(10, 10, 0));
  assert.equal(c.inconclusivo, false);
  assert.equal(recountWithoutMention(arm(12, 8, 1), arm(12, 8, 1)).inconclusivo, false);
});

test('B4: restrita-nao-ativada: findings that decide whether round 2 restricts', async () => {
  const P = loadPure();
  const minor = { severity: 'minor', category: 'defeito', description: 'nit', file: 'x' };
  const verdict = { verdicts: [{ id: 'F1', open: false }] };
  // a minor stays out of fixable, so every fixable issue has an id: restricted
  const one = await stubScript({ restricted: true, reviews: [trv([FOUND('F1'), minor]), trv([], 'a'.repeat(40), verdict)] });
  assert.deepEqual(one.result.restricted, [false, true]);
  assert.deepEqual((await loopResult(hTask('restrita'), one.journal, P, one.scenario)).restrictedRounds, [false, true]);
  // fewer commits than expected adds a synthetic issue without id to fixable: not restricted
  const two = await stubScript({ restricted: true, reviews: [trv([FOUND('F1')], 'a'.repeat(40), { commitsInRange: 0 }), trv([])] });
  assert.deepEqual(two.result.restricted, [false, false]);
  assert.deepEqual((await loopResult(hTask('restrita'), two.journal, P, two.scenario)).restrictedRounds, [false, false]);
});

test('B4: correcao-semeada-ausente twice in a batch stops the batch', async () => {
  const s = setup();
  try {
    // review 2 names fixSha and fix1 ran, but the correction was never applied on feat/E5
    const spec = () => ({ apply: false, entries: (f) => [entry('E5:task-review1', trv([F_PARENT])), entry('E5:task-review-fix1', APPLIED_FIX), entry('E5:task-review2', trv([], f))], ret: { ok: true, restricted: [false, false] } });
    const r = await runBatch(corrBatch(s, { runs: 4 }), { exec: makeFake(s.configDir, { afterRun: taskAfterRun(s, spec) }).exec, now: NOW });
    assert.equal(r.aggregate.attempts.length, 2);
    assert.deepEqual(r.aggregate.attempts.map((x) => x.reason), ['correcao-semeada-ausente', 'correcao-semeada-ausente']);
    assert.equal(r.aggregate.stoppedBy, 'correcao-semeada-ausente');
  } finally {
    s.done();
  }
});

// ---- E26 B3: the final review stage in a loop (atual against adversarial) ----
const { verifyStats } = await import('./run-batch.mjs');
const finOpts = (s, extra = {}) => seededOpts(s, 'correcao-semeada-A', { stage: 'final-review', pluginDir: REAL_PLUGIN, ...extra });
const hFinal = (arm = 'atual') => ({ stage: 'final-review', arm, base: 'atual', st: { label: 'E5:final-review' }, harness: { finalReview: { adversarial: arm === 'adversarial' } } });
const refuteAll = (...ns) => ({ verdicts: ns.map((n) => ({ n, refuted: true, reason: '[fab] the code handles it' })) });
const finalJournal = jl({ label: 'E5:final-review1', result: { issues: [] } });

test("B3: STAGES['final-review'] accepts correcao-semeada-A/B only, loop only, arm atual|adversarial", async () => {
  const s = setup();
  try {
    const refused = [
      ['codigo-semeado-A', {}, /does not accept/],
      ['codigo-semeado-B', { arm: 'adversarial' }, /does not accept/],
      ['correcao-semeada-A', { rounds: 'single' }, /loop/],
      ['correcao-semeada-B', { rounds: 'single', arm: 'adversarial' }, /loop/],
      ['correcao-semeada-A', { arm: 'restrita' }, /restrita/],
      ['correcao-semeada-A', { arm: 'perguntas' }, /perguntas/],
      ['correcao-semeada-A', { arm: 'other' }, /atual or adversarial/],
      ['correcao-semeada-A', { reviewModel: 'sonnet' }, /review-model/],
    ];
    for (const [variant, extra, re] of refused) {
      const fake = makeFake(s.configDir);
      await assert.rejects(runBatch(seededOpts(s, variant, { stage: 'final-review', pluginDir: REAL_PLUGIN, ...extra }), { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && re.test(e.message), `${variant} ${JSON.stringify(extra)}`);
      assert.equal(claudeCalls(fake).length, 0);
    }
    const cli = spawnSync(process.execPath, [script, '--variant', 'correcao-semeada-A', '--stage', 'final-review', '--rounds', 'single', '--plugin-dir', REAL_PLUGIN, '--runs', '1', '--work', s.work, '--out', s.out, '--config-dir', s.configDir, '--permission-mode', 'acceptEdits'], { encoding: 'utf8' });
    assert.equal(cli.status, 2, cli.stderr);
    for (const variant of ['correcao-semeada-A', 'correcao-semeada-B']) {
      for (const arm of ['atual', 'adversarial']) {
        const fake = makeFake(s.configDir, { journal: finalJournal, afterRun: mergeE5 });
        const r = await runBatch(finOpts(s, { variant, arm, work: join(s.base, `w-${variant}-${arm}`) }), { exec: fake.exec, now: NOW });
        const h = r.aggregate.harness;
        assert.deepEqual([h.stage, h.arm, h.rounds, h.finalReview], ['final-review', arm, 'loop', { adversarial: arm === 'adversarial' }]);
        assert.deepEqual(h.stageOptions, { tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'high', maxFix: 2, byId: false });
        assert.ok(r.dir.includes(`${variant}-final-review-${arm}-loop-`), r.dir);
        const text = readFileSync(join(firstClaudeP(fake).cwd, 'review-only.js'), 'utf8');
        assert.ok(text.includes(`const H_ADVERSARIAL = ${arm === 'adversarial'}`));
        assert.match(text, /merge --ff-only [0-9a-f]{40}/);
      }
    }
    assert.deepEqual(stageLoopFor('final-review'), { tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'high', maxFix: 2, byId: false });
  } finally {
    s.done();
  }
});

test('B3: startup refusals on the final slice', async () => {
  const s = setup();
  try {
    const wf = readFileSync(WORKFLOW, 'utf8');
    const at = wf.indexOf("reviewLoop('final',");
    assert.ok(at > 0);
    const FRA = "FRA = { agentType: 'productivity-tools:final-reviewer', phase: 'Final review', model: 'opus', effort: 'high' }";
    const noFra = wf.replace(FRA, FRA.replace("'high'", "'medium'"));
    // FRA sits before the call (from const FR = CFG.finalReview); the others sit inside the call
    const cases = [
      [FRA, noFra],
      ...[
        "{ tier: 'sonnet', reviewModel: 'opus', once: FR.singleWave === true })",
        'FR.adversarial === true && bl.length',
        "card.critical ? ['correctness', 'security'] : ['all']",
        'reviewTruth(r, 1,',
        'Mode: verify.',
      ].map((lit) => {
        const tail = wf.slice(at);
        assert.ok(tail.includes(lit), lit);
        return [lit, wf.slice(0, at) + tail.replace(lit, lit.replace(/^(.)/, '$1~'))];
      }),
    ];
    for (const [lit, text] of cases) {
      const plugin = pluginDirWithWorkflow(s.base, text);
      const fake = makeFake(s.configDir);
      await assert.rejects(runBatch(finOpts(s, { pluginDir: plugin, work: join(s.base, 'w-ref') }), { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && e.message.includes(lit), lit);
      assert.equal(claudeCalls(fake).length, 0, lit);
      assert.throws(() => checkLoopWorkflow(text, 'final-review'), (e) => e instanceof UsageError && e.message.includes(lit), lit);
    }
    // FRA is searched from `const FR = CFG.finalReview`, or in the whole text when that marker is gone
    assert.ok(wf.includes('const FR = CFG.finalReview'));
    assert.doesNotThrow(() => checkLoopWorkflow(wf.replace('const FR = CFG.finalReview', 'const FRX = CFG.finalReview'), 'final-review'));
    assert.throws(() => checkLoopWorkflow('// ' + FRA + '\n' + noFra, 'final-review'), (e) => e instanceof UsageError && e.message.includes(FRA));
    // a copy of a slice literal outside the call does not satisfy the slice
    const drifted = wf.slice(0, at) + wf.slice(at).replace('Mode: verify.', 'Mode: check.') + '\n// Mode: verify.\n';
    assert.throws(() => checkLoopWorkflow(drifted, 'final-review'), (e) => e instanceof UsageError && e.message.includes('Mode: verify.'));
  } finally {
    s.done();
  }
});

test('B3: rolesByLabel has a verify bucket', async () => {
  const calls = (n) => ({ haiku: 0, sonnet: 0, opus: n, fable: 0, other: 0 });
  const role = (n, cost) => ({ calls: calls(n), promptBytes: 10, tokens: { input: 1, output: 2 }, cost, agents: n });
  const run = { roles: { 'other:E5:final-review1': role(1, 1), 'other:E5:final-verify1': role(1, 0.5), 'other:E5:final-verify2': role(1, 0.25), 'other:E5:final-review-fix1': role(1, 2) }, main: { cost: 4 } };
  const r = rolesByLabel(run, 5);
  assert.deepEqual([r.verify.agents, r.verify.cost], [2, 0.75]);
  assert.deepEqual([r.review.agents, r.review.cost], [1, 1]);
  assert.deepEqual([r.fix.agents, r.fix.cost], [1, 2]);
  assert.deepEqual(r.session, { cliCostUsd: 5, transcriptCostUsd: 4 });
  // the batch sums the new bucket, session unchanged
  const s = setup();
  try {
    const r2 = await runBatch(baseOpts(s, { runs: 2 }), { exec: makeFake(s.configDir).exec, now: NOW });
    assert.equal(r2.aggregate.rolesByLabel.verify.agents, 0);
    assert.equal(r2.aggregate.rolesByLabel.session.cliCostUsd, 0.02);
    for (const a of r2.aggregate.attempts) assert.equal(a.rolesByLabel.verify.agents, 0);
  } finally {
    s.done();
  }
});

test('B3: validity of the final stage', async () => {
  const s = setup();
  try {
    const P = loadPure();
    const F1 = trv([F_PARENT]);
    // formato-do-diario: review 1 without an issues list
    let afterRun = taskAfterRun(s, () => ({ entries: () => [{ label: 'E5:final-review1', result: { headSha: 'x', clean: true, commitsInRange: 3 } }], ret: { ok: true, verify: null } }));
    let r = await runBatch(finOpts(s, { work: join(s.base, 'w1') }), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    assert.equal(r.aggregate.invalidReasons['formato-do-diario'], 1, JSON.stringify(r.aggregate.invalidReasons));
    // sem-correcao: a clean 1st review in the atual arm
    afterRun = taskAfterRun(s, () => ({ apply: false, entries: () => [entry('E5:final-review1', trv([]))], ret: { ok: true, verify: null } }));
    r = await runBatch(finOpts(s, { work: join(s.base, 'w2') }), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    assert.equal(r.aggregate.invalidReasons['sem-correcao'], 1);
    assert.equal(r.aggregate.refutouTudo, 0);
    // refutou-tudo: adversarial, blocking 1st review and verify refuting every finding; counted on top and not as sem-correcao
    afterRun = taskAfterRun(s, () => ({ apply: false, entries: () => [entry('E5:final-review1', F1), entry('E5:final-verify1', refuteAll(1))], ret: { ok: true, verify: { calls: 1, refutedByRound: { 1: 1 } } } }));
    r = await runBatch(finOpts(s, { arm: 'adversarial', work: join(s.base, 'w3') }), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    assert.deepEqual(r.aggregate.invalidReasons, { 'refutou-tudo': 1 });
    assert.equal(r.aggregate.refutouTudo, 1);
    // the same journal in the unit: only the adversarial arm has the reason; atual keeps sem-correcao
    const sc = await unitScenario(s);
    const refutedJournal = { entries: [entry('E5:final-review1', F1), entry('E5:final-verify1', refuteAll(1))] };
    const loop0 = { fixes: 0, ok: true };
    assert.deepEqual(await loopValidity(hFinal('adversarial'), refutedJournal, sc, loop0, { ok: true, verify: null }), { valid: false, reason: 'refutou-tudo' });
    assert.deepEqual(await loopValidity(hFinal('atual'), refutedJournal, sc, loop0, { ok: true, verify: null }), { valid: false, reason: 'sem-correcao' });
    // a partial refutation is not refutou-tudo, and neither is a missing verify entry
    const partial = { entries: [entry('E5:final-review1', trv([F_PARENT, F_OTHER])), entry('E5:final-verify1', refuteAll(1))] };
    assert.equal((await loopValidity(hFinal('adversarial'), partial, sc, loop0, null)).reason, 'sem-correcao');
    assert.equal((await loopValidity(hFinal('adversarial'), { entries: [entry('E5:final-review1', F1)] }, sc, loop0, null)).reason, 'sem-correcao');
    // correcao-semeada-ausente / laco-divergente / formato-do-diario on the final labels
    const loop = { fixes: 1, ok: true };
    const at = (head) => ({ entries: [entry('E5:final-review1', F1), entry('E5:final-review2', trv([], head))] });
    assert.deepEqual(await loopValidity(hFinal(), at(sc.fixSha), sc, loop, { ok: true }), { valid: false, reason: 'correcao-semeada-ausente' });
    gitq(sc.dir, 'merge', '--ff-only', sc.fixSha);
    assert.deepEqual(await loopValidity(hFinal(), at(sc.fixSha), sc, loop, { ok: true, verify: null }), { valid: true, reason: 'ok' });
    assert.deepEqual(await loopValidity(hFinal(), at(sc.fixSha), sc, loop, { ok: false }), { valid: false, reason: 'laco-divergente' });
    assert.deepEqual(await loopValidity(hFinal(), at(sc.fixSha), sc, loop, null), { valid: false, reason: 'formato-do-diario' });
    // laco-infra and laco-divergente (a verify label the replay did not use, or repeated) in the replay
    const none = { seededCommit: 'a'.repeat(40) };
    assert.deepEqual(await loopResult(hFinal(), [entry('E5:final-review1', null), entry('E5:final-review1b', null)], P, none), { infra: true });
    assert.deepEqual(await loopResult(hFinal(), [entry('E5:final-review1', F1), entry('E5:final-review-fix1', null)], P, none), { infra: true });
    const clean = entry('E5:final-review1', trv([]));
    assert.deepEqual(await loopResult(hFinal(), [clean, entry('E5:final-verify1', refuteAll(1))], P, none), { divergent: true });
    assert.deepEqual(await loopResult(hFinal('adversarial'), [entry('E5:final-review1', F1), entry('E5:final-verify1', refuteAll(1)), entry('E5:final-verify1', refuteAll(1))], P, none), { divergent: true });
    // the replay applies the verify like the product: the refuted finding leaves the round's issues
    const rep = await loopResult(hFinal('adversarial'), [entry('E5:final-review1', F1), entry('E5:final-verify1', refuteAll(1))], P, none);
    assert.deepEqual([rep.reviews, rep.fixes, rep.ok], [1, 0, true]);
    // a BLOCKED fixer ends the final loop with conteudo, as in the task stage (not infra)
    const blocked = await loopResult(hFinal(), [entry('E5:final-review1', F1), entry('E5:final-review-fix1', { status: 'BLOCKED', summary: '[fab] cannot apply' })], P, none);
    assert.deepEqual([blocked.ok, blocked.kind], [false, 'conteudo']);
    // a stray verify entry in the atual arm is a divergence; in the adversarial arm it is used
    const strayAtual = [entry('E5:final-review1', F1), entry('E5:final-verify1', { verdicts: [] }), entry('E5:final-review-fix1', APPLIED_FIX), entry('E5:final-review2', trv([]))];
    assert.deepEqual(await loopResult(hFinal('atual'), strayAtual, P, none), { divergent: true });
    assert.equal((await loopResult(hFinal('adversarial'), strayAtual, P, none)).ok, true);
    // refutou-tudo when review 1 came from the retry 1b (its verify is E5:final-verify1b), with the replay's own functions
    const h1b = { ...hFinal('adversarial'), loopFns: P };
    const viaRetry = { entries: [entry('E5:final-review1', F1), entry('E5:final-verify1b', refuteAll(1))] };
    assert.deepEqual(await loopValidity(h1b, viaRetry, sc, loop0, null), { valid: false, reason: 'refutou-tudo' });
    // a full valid adversarial attempt: nothing refuted, fix1 applied, review 2 clean
    afterRun = taskAfterRun(s, () => ({ entries: (f) => [entry('E5:final-review1', F1), entry('E5:final-verify1', { verdicts: [] }), entry('E5:final-review-fix1', APPLIED_FIX), entry('E5:final-review2', trv([], f))], ret: { ok: true, verify: { calls: 1, refutedByRound: { 1: 0 } } } }));
    r = await runBatch(finOpts(s, { arm: 'adversarial', work: join(s.base, 'w4') }), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(r.aggregate.invalidReasons));
    assert.deepEqual(a.verify, { calls: 1, refutedTotal: 0, refutedSeeded: 0, refutedRound1: 0, refutedByRound: { 1: 0 } });
    assert.equal(a.loop.fixes, 1);
  } finally {
    s.done();
  }
});

test('B3: refutedTotal, refutedSeeded and refutedByRound', () => {
  const P = loadPure();
  const entries = [
    entry('E5:final-review1', trv([F_PARENT, F_OTHER])),
    entry('E5:final-verify1', refuteAll(1, 2)),
    entry('E5:final-review-fix1', APPLIED_FIX),
    entry('E5:final-review2', trv([F_CG1, FOUND('F3', 'unrelated thing')])),
    entry('E5:final-verify2', { verdicts: [{ n: 1, refuted: true, reason: '[fab] it still exports it' }, { n: 2, refuted: false, reason: '[fab] real' }] }),
  ];
  assert.deepEqual(verifyStats(entries, ['CR1', 'CG1'], P), { calls: 2, refutedTotal: 3, refutedSeeded: 2, refutedRound1: 2, refutedByRound: { 1: 2, 2: 1 } });
  // a verdict without a reason refutes nothing (splitRefuted), a refuted unrelated finding is not seeded
  const e2 = [entry('E5:final-review1', trv([F_PARENT, F_OTHER])), entry('E5:final-verify1', { verdicts: [{ n: 1, refuted: true }, { n: 2, refuted: true, reason: '[fab] nit only' }] })];
  assert.deepEqual(verifyStats(e2, ['CR1', 'CG1'], P), { calls: 1, refutedTotal: 1, refutedSeeded: 0, refutedRound1: 1, refutedByRound: { 1: 1 } });
  // the atual arm has no verify entries: zero
  assert.deepEqual(verifyStats([entry('E5:final-review1', trv([F_PARENT]))], ['CR1', 'CG1'], P), { calls: 0, refutedTotal: 0, refutedSeeded: 0, refutedRound1: 0, refutedByRound: {} });
});

// ---- E26 B3: final replay and the single wave derived from the batch ----
const { singleWaveReplay, buildFinalLoopScript } = await import('./run-batch.mjs');
const FINAL_STUB_FIX = { status: 'DONE', summary: '[fab] fixed' };

// Runs the real generated final loop script with a stub agent (atual or adversarial); returns its return and the journal it would have left.
async function stubFinal({ adversarial = false, reviews, verifies = [] }) {
  const wf = readFileSync(WORKFLOW, 'utf8');
  const sc = { dir: 'D:/work/correcao-semeada-A-1', seededCommit: 'a'.repeat(40), fixSha: 'b'.repeat(40) };
  const review = readArm(join(here, 'arms', 'final-review-atual.md'), { requireSource: true }).text;
  const fix = readArm(join(here, 'arms', 'final-fix-atual.md'), { requireSource: true }).text;
  const text = buildFinalLoopScript({ pure: checkLoopWorkflow(wf, 'final-review'), scenario: sc, opts: { adversarial, review, fix } });
  const journal = [];
  let i = 0;
  let v = 0;
  const agent = async (prompt, o) => {
    let out;
    if (/final-verify/.test(o.label)) out = verifies[Math.min(v++, verifies.length - 1)] ?? { verdicts: [] };
    else if (o.label === 'E5:final-review-fix1') out = APPLIED_FIX;
    else if (/-fix\d+$/.test(o.label)) out = FINAL_STUB_FIX;
    else out = reviews[Math.min(i++, reviews.length - 1)];
    journal.push(entry(o.label, out));
    return out;
  };
  const result = await new AsyncFn('agent', text.replace('export const meta', 'const meta'))(agent);
  return { result, journal, scenario: sc };
}

const MINOR = { severity: 'minor', category: 'defeito', description: 'nit', file: 'x' };
const swSequences = () => ({
  'clean on the 1st': [trv([])],
  'clean after fix1': [trv([FOUND('F1')]), trv([])],
  'blocks after fix1': [trv([FOUND('F1')]), trv([FOUND('F2')]), trv([FOUND('F3')])],
  'only minors after fix1': [trv([FOUND('F1')]), trv([MINOR])],
});

test('B3: single wave replay ok equals runReviewLoop(..., { once: true }) for the four sequences', async () => {
  const P = loadPure();
  for (const [name, reviews] of Object.entries(swSequences())) {
    // the journal of the full loop (what the batch records) ...
    const run = await stubFinal({ reviews });
    const replay = await singleWaveReplay(hFinal(), run.journal, P);
    // ... and the same loop run directly with once: true over the same simulated agent
    const calls = [];
    let i = 0;
    const env = { maxFix: 2, blqIds: new Set(), reviews: [], concerns: [], acceptRisks: () => {} };
    const direct = await P.runReviewLoop(
      env,
      'final',
      async (round) => {
        calls.push(`E5:final-review${round}`);
        return reviews[Math.min(i++, reviews.length - 1)];
      },
      async (iss, k) => {
        calls.push(`E5:final-review-fix${k}`);
        return { status: 'DONE' };
      },
      (r) => P.reviewTruth(r, 1, 'main..HEAD'),
      { tier: 'sonnet', reviewModel: 'opus', once: true },
    );
    assert.equal(replay.ok, direct.ok === true, name);
    assert.deepEqual(replay.calls, calls, name);
    // the once calls are the prefix of the calls of the full loop
    assert.deepEqual(run.journal.map((e) => e.label).slice(0, calls.length), calls, name);
  }
});

test('B3: the single wave replay runs without new calls and only in the atual arm', async () => {
  const P = loadPure();
  const run = await stubFinal({ reviews: swSequences()['blocks after fix1'] });
  // the replay reads review1, fix1 and review2 and ignores what the loop did afterwards
  assert.deepEqual(run.journal.map((e) => e.label), ['E5:final-review1', 'E5:final-review-fix1', 'E5:final-review2', 'E5:final-review-fix2', 'E5:final-review3']);
  assert.deepEqual(await singleWaveReplay(hFinal(), run.journal, P), { ok: false, calls: ['E5:final-review1', 'E5:final-review-fix1', 'E5:final-review2'] });
  // the batch: the atual arm records singleWave, the adversarial arm does not
  const s = setup();
  try {
    const F1 = trv([F_PARENT]);
    const atualSpec = () => ({ entries: (f) => [entry('E5:final-review1', F1), entry('E5:final-review-fix1', APPLIED_FIX), entry('E5:final-review2', trv([], f))], ret: { ok: true, verify: null } });
    const advSpec = () => ({ entries: (f) => [entry('E5:final-review1', F1), entry('E5:final-verify1', { verdicts: [] }), entry('E5:final-review-fix1', APPLIED_FIX), entry('E5:final-review2', trv([], f))], ret: { ok: true, verify: { calls: 1, refutedByRound: { 1: 0 } } } });
    const atual = await runBatch(finOpts(s, { work: join(s.base, 'wa') }), { exec: makeFake(s.configDir, { afterRun: taskAfterRun(s, atualSpec) }).exec, now: NOW });
    assert.equal(atual.aggregate.attempts[0].status, 'valid', JSON.stringify(atual.aggregate.invalidReasons));
    assert.equal(atual.aggregate.attempts[0].singleWave.ok, true);
    const adv = await runBatch(finOpts(s, { arm: 'adversarial', work: join(s.base, 'wb') }), { exec: makeFake(s.configDir, { afterRun: taskAfterRun(s, advSpec) }).exec, now: NOW });
    assert.equal(adv.aggregate.attempts[0].status, 'valid', JSON.stringify(adv.aggregate.invalidReasons));
    assert.equal(adv.aggregate.attempts[0].singleWave, undefined);
    assert.equal(adv.aggregate.outcomesSingleWave, undefined);
    assert.equal(adv.aggregate.singleWaveStopped, undefined);
  } finally {
    s.done();
  }
});

test('B3: singleWave outcomes are the fixSha sentinels', async () => {
  const s = setup();
  try {
    const fx = (k) => entry(`E5:final-review-fix${k}`, k === 1 ? APPLIED_FIX : FINAL_STUB_FIX);
    const afterRun = taskAfterRun(s, (n) => {
      if (n === 1) return { entries: (f) => [entry('E5:final-review1', trv([F_PARENT])), fx(1), entry('E5:final-review2', trv([], f))], ret: { ok: true, verify: null } };
      // review 2 still blocks: the single wave stops there (the loop goes on and gives up at review 3)
      return { entries: (f) => [entry('E5:final-review1', trv([F_PARENT])), fx(1), entry('E5:final-review2', trv([F_OTHER], f)), fx(2), entry('E5:final-review3', trv([FOUND('F3', 'other blocking')]))], ret: { ok: false, verify: null } };
    });
    const r = await runBatch(finOpts(s, { runs: 2 }), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    const [a1, a2] = r.aggregate.attempts;
    assert.deepEqual([a1.status, a2.status], ['valid', 'valid'], JSON.stringify(r.aggregate.invalidReasons));
    const by = (a) => Object.fromEntries(a.singleWave.outcomes.map((o) => [o.id, o.outcome]));
    assert.deepEqual([a1.singleWave.ok, by(a1)], [true, { CR1: 'perdido', CG1: 'perdido' }]);
    assert.deepEqual([a2.singleWave.ok, by(a2)], [false, { CR1: 'indeterminado', CG1: 'indeterminado' }]);
    assert.deepEqual(a1.singleWave.outcomes.map((o) => o.detectedBy), ['reviewer', 'reviewer']);
  } finally {
    s.done();
  }
  // an attempt without fix1 is invalid for the single wave and carries no singleWave record
  const s2 = setup();
  try {
    const afterRun = taskAfterRun(s2, () => ({ apply: false, entries: () => [entry('E5:final-review1', trv([]))], ret: { ok: true, verify: null } }));
    const r = await runBatch(finOpts(s2), { exec: makeFake(s2.configDir, { afterRun }).exec, now: NOW });
    assert.equal(r.aggregate.invalidReasons['sem-correcao'], 1);
    assert.equal(r.aggregate.attempts[0].singleWave, undefined);
    assert.equal(r.aggregate.singleWaveStopped, 0);
  } finally {
    s2.done();
  }
});

test('B3: loopResult applies splitRefuted before reviewTruth in the final stage', async () => {
  const real = loadPure();
  const F2 = trv([F_PARENT, F_OTHER]);
  const order = [];
  const P = {
    ...real,
    splitRefuted: (bl, v) => (order.push('split'), real.splitRefuted(bl, v)),
    reviewTruth: (r, min, label, marks) => (order.push(`truth:${r.issues.length}:${min}:${label}`), real.reviewTruth(r, min, label, marks)),
  };
  const none = { seededCommit: 'a'.repeat(40) };
  // verify refuting the 1st finding: the split runs first and the truth sees only the kept one
  const withVerify = await loopResult(hFinal('adversarial'), [entry('E5:final-review1', F2), entry('E5:final-verify1', refuteAll(1)), entry('E5:final-review-fix1', APPLIED_FIX), entry('E5:final-review2', trv([]))], P, none);
  assert.deepEqual(order.slice(0, 2), ['split', 'truth:1:1:main..HEAD']);
  assert.equal(withVerify.ok, true);
  // without a verify entry (the atual arm) the split never runs
  order.length = 0;
  await loopResult(hFinal('atual'), [entry('E5:final-review1', F2), entry('E5:final-review-fix1', APPLIED_FIX), entry('E5:final-review2', trv([]))], P, none);
  assert.equal(order.includes('split'), false);
  assert.equal(order[0], 'truth:2:1:main..HEAD');
  // nothing blocking in the adversarial arm: no verify, no split
  order.length = 0;
  await loopResult(hFinal('adversarial'), [entry('E5:final-review1', trv([]))], P, none);
  assert.deepEqual(order, ['truth:0:1:main..HEAD']);
});

test('B3: replay ok equals script ok in the four arms (task atual and restrita, final atual and adversarial)', async () => {
  const P = loadPure();
  const seqs = swSequences();
  for (const arm of ['atual', 'restrita']) {
    for (const [name, reviews] of Object.entries(seqs)) {
      const run = await stubScript({ restricted: arm === 'restrita', reviews });
      assert.equal((await loopResult(hTask(arm), run.journal, P, run.scenario)).ok, run.result.ok, `task ${arm} ${name}`);
    }
  }
  for (const arm of ['atual', 'adversarial']) {
    for (const [name, reviews] of Object.entries(seqs)) {
      const run = await stubFinal({ adversarial: arm === 'adversarial', reviews, verifies: [{ verdicts: [] }] });
      const replay = await loopResult(hFinal(arm), run.journal, P, run.scenario);
      assert.equal(replay.divergent, undefined, `final ${arm} ${name}`);
      assert.equal(replay.ok, run.result.ok, `final ${arm} ${name}`);
    }
  }
  // a tampered journal: the script blocked to the end, one verdict swapped to clean; and a stray stage label
  for (const arm of ['atual', 'adversarial']) {
    const run = await stubFinal({ adversarial: arm === 'adversarial', reviews: seqs['blocks after fix1'], verifies: [{ verdicts: [] }] });
    assert.equal(run.result.ok, false);
    const swapped = run.journal.map((e) => (e.label === 'E5:final-review3' ? entry(e.label, trv([])) : e));
    assert.notEqual((await loopResult(hFinal(arm), swapped, P, run.scenario)).ok, run.result.ok, arm);
    assert.deepEqual(await loopResult(hFinal(arm), [...run.journal, entry('E5:final-review-extra', {})], P, run.scenario), { divergent: true }, arm);
  }
});

test('B3: aggregate has outcomesSingleWave, singleWaveStopped and per attempt singleWave { ok, outcomes }', async () => {
  const s = setup();
  try {
    const fx = (k) => entry(`E5:final-review-fix${k}`, k === 1 ? APPLIED_FIX : FINAL_STUB_FIX);
    const afterRun = taskAfterRun(s, (n) => {
      if (n === 1) return { entries: (f) => [entry('E5:final-review1', trv([F_PARENT])), fx(1), entry('E5:final-review2', trv([], f))], ret: { ok: true, verify: null } };
      if (n === 2) return { after: (cwd) => cleanFix(cwd), entries: (f) => [entry('E5:final-review1', trv([F_PARENT])), fx(1), entry('E5:final-review2', trv([F_OTHER], f)), fx(2), entry('E5:final-review3', trv([]))], ret: { ok: true, verify: null } };
      return { entries: (f) => [entry('E5:final-review1', trv([F_PARENT])), fx(1), entry('E5:final-review2', trv([F_CG1], f)), fx(2), entry('E5:final-review3', trv([FOUND('F3', 'other blocking')]))], ret: { ok: false, verify: null } };
    });
    const r = await runBatch(finOpts(s, { runs: 3 }), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    const g = r.aggregate;
    assert.deepEqual(g.attempts.map((a) => a.status), ['valid', 'valid', 'valid'], JSON.stringify(g.invalidReasons));
    for (const a of g.attempts) assert.deepEqual(Object.keys(a.singleWave).sort(), ['ok', 'outcomes']);
    assert.deepEqual(g.attempts.map((a) => a.singleWave.ok), [true, false, false]);
    assert.equal(g.singleWaveStopped, 2);
    assert.deepEqual(g.outcomesSingleWave.CR1, { class: 'code', detectedBy: 'reviewer', capturado: 0, perdido: 1, indeterminado: 2 });
    assert.deepEqual(g.harness.finalReview, { adversarial: false });
  } finally {
    s.done();
  }
});

test('B3: whole aggregate keeps the A shapes for the old stages', async () => {
  const s = setup();
  try {
    const bKeys = ['singleWave', 'outcomesSingleWave', 'singleWaveStopped', 'capturadoSemMencao', 'perdidoDoCorretor', 'residuoSemAchadoPai', 'refutouTudo'];
    // the spec/plan loop of the A block (plano-nativo-A)
    const afterRun = (cwd, n) => {
      const seeded = gitq(cwd, 'rev-parse', `feat/E5:${NATIVE_PATHS.plan}`);
      const head1 = gitq(cwd, 'rev-parse', 'feat/E5');
      const tip = restoreClean(cwd, 'plan');
      writeFileSync(journalFileOf(s.configDir, n), jl(
        { label: 'E5:plan-review1', result: rv([BLOCKER], head1, 'measuredPlanBlob', seeded) },
        { label: 'E5:plan-review-fix1', result: { summary: '[fab] fixed' } },
        { label: 'E5:plan-review2', result: rv([], tip, 'measuredPlanBlob', gitq(cwd, 'rev-parse', `${tip}:${NATIVE_PATHS.plan}`)) },
      ));
    };
    const r = await runBatch(nativeOpts(s, 'plano-nativo-A', { rounds: 'loop' }), { exec: makeFake(s.configDir, { afterRun }).exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(a));
    assert.deepEqual(a.loop, { reviews: 2, fixes: 1, fixTiers: ['sonnet'], ok: true, kind: null });
    assert.deepEqual(Object.keys(r.aggregate.loopSummary).sort(), ['ok', 'reviews', 'stopped']);
    for (const k of bKeys) assert.equal(a[k] ?? r.aggregate[k], undefined, k);
    assert.equal(a.verify, undefined);
    assert.equal(r.aggregate.harness.finalReview, undefined);
    assert.equal(r.aggregate.harness.taskReview, undefined);
    // the single-round task review of codigo-semeado-A
    const t = await runBatch(seededOpts(s, 'codigo-semeado-A', { stage: 'task-review', reviewModel: 'sonnet', work: join(s.base, 'wt') }), { exec: makeFake(s.configDir, { journal: jl({ label: 'E5:task-review1', result: { issues: [] } }), afterRun: mergeE5 }).exec, now: NOW });
    for (const k of bKeys) assert.equal(t.aggregate[k] ?? t.aggregate.attempts[0]?.[k], undefined, k);
    assert.equal(t.aggregate.loopSummary, undefined);
  } finally {
    s.done();
  }
});

// ---- E26 gate fixes: stop by invalid attempts, CR1 mention by description, refutedRound1 ----
const { batchStopReason } = await import('./run-batch.mjs');

test('gate: batchStopReason stops on more than 3 invalid attempts, refutou-tudo not counted', () => {
  const inv = (reason, n) => Array.from({ length: n }, () => ({ status: 'invalid', reason }));
  assert.equal(batchStopReason(inv('sem-correcao', 4)), 'invalidas');
  assert.equal(batchStopReason(inv('sem-correcao', 3)), null);
  assert.equal(batchStopReason([...inv('sem-correcao', 3), ...inv('refutou-tudo', 5)]), null);
  assert.equal(batchStopReason([...inv('sem-correcao', 3), ...inv('formato-do-diario', 1)]), 'invalidas');
  // the more specific reasons keep their names
  assert.equal(batchStopReason(inv('laco-divergente', 2)), 'laco-divergente');
});

test('gate: a round 2 finding counts as a mention of CR1 by its description, not by its file', () => {
  const ids = ['CR1', 'CG1'];
  const file = 'tests/e5-word-count.test.mjs';
  const run = (r2) => mentionStats([entry('E5:task-review1', trv([F_PARENT])), entry('E5:task-review-fix1', APPLIED_FIX), entry('E5:task-review2', trv([r2]))], 'E5:task-review', ids);
  const semi = run(FOUND('F9', 'Missing semicolon', file));
  assert.equal(semi.mentionedAfterFix.CR1, false);
  const blank = run(FOUND('F9', 'wordCount still lacks the blank string case', file));
  assert.equal(blank.mentionedAfterFix.CR1, true);
  // review 1 keeps matching file and description: its parent finding is still found (no residuoSemAchadoPai)
  const byFile = mentionStats([entry('E5:task-review1', trv([FOUND('F1', 'Missing semicolon', file)])), entry('E5:task-review2', trv([]))], 'E5:task-review', ids);
  assert.equal(byFile.residuoSemAchadoPai, 0);
});

test('gate: verifyStats counts refutedRound1', () => {
  const P = loadPure();
  const entries = [
    entry('E5:final-review1', trv([F_PARENT, F_OTHER])),
    entry('E5:final-verify1', refuteAll(1, 2)),
    entry('E5:final-review-fix1', APPLIED_FIX),
    entry('E5:final-review2', trv([F_CG1])),
    entry('E5:final-verify2', refuteAll(1)),
  ];
  const v = verifyStats(entries, ['CR1', 'CG1'], P);
  assert.equal(v.refutedRound1, 2);
  assert.equal(v.refutedTotal, 3);
  assert.equal(verifyStats([entry('E5:final-review1', trv([F_PARENT]))], ['CR1', 'CG1'], P).refutedRound1, 0);
  // the retry 1b counts as round 1
  const b = [entry('E5:final-review1b', trv([F_PARENT])), entry('E5:final-verify1b', refuteAll(1))];
  assert.equal(verifyStats(b, ['CR1'], P).refutedRound1, 1);
});

// ---- E11 preparo: --ratify between|off, parou-por-decisao, --coordinator-fixture
const CLI_BASE = ['--variant', 'completo', '--runs', '1', '--work', 'w', '--out', 'o', '--config-dir', 'c', '--permission-mode', 'acceptEdits'];

test('E11 parseCli accepts --ratify between|off, default between', () => {
  assert.equal(parseCli(CLI_BASE).ratify, 'between');
  assert.equal(parseCli([...CLI_BASE, '--ratify', 'off']).ratify, 'off');
  assert.equal(parseCli([...CLI_BASE, '--ratify', 'between']).ratify, 'between');
  assert.throws(() => parseCli([...CLI_BASE, '--ratify', 'x']), UsageError);
});

test('E11 parseCli accepts --coordinator-fixture native|legacy and runBatch hands it to makeScenario', async () => {
  assert.equal(parseCli(CLI_BASE).coordinatorFixture, 'native');
  assert.equal(parseCli([...CLI_BASE, '--coordinator-fixture', 'legacy']).coordinatorFixture, 'legacy');
  assert.throws(() => parseCli([...CLI_BASE, '--coordinator-fixture', 'x']), UsageError);
  const s = setup();
  try {
    const seen = [];
    const scenarioFn = (dir, variant, o) => {
      seen.push(o);
      return makeScenario(dir, variant, o);
    };
    const fake = makeFake(s.configDir);
    await runBatch(baseOpts(s, { variant: 'completo', runs: 1, coordinatorFixture: 'legacy' }), { exec: fake.exec, now: NOW, scenarioFn });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].coordinatorFixture, 'legacy');
  } finally {
    s.done();
  }
});

test('E11 with --ratify off the ratify function is not called between sessions and pendingAtResume is recorded', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true });
    let ratifyCalls = 0;
    const ratify = () => {
      ratifyCalls++;
      return { ok: true, ratified: [] };
    };
    const pendingCalls = [];
    const pending = (sandbox, installPath) => {
      pendingCalls.push(installPath);
      return pendingCalls.length === 1 ? ['DEC-7'] : [];
    };
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1, ratify: 'off' }), { exec: fake.exec, now: NOW, ratify, pending });
    assert.equal(ratifyCalls, 0);
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid');
    assert.equal(a.ratify, 'off');
    assert.deepEqual(a.ratified, []);
    assert.deepEqual(a.pendingAtResume, ['DEC-7']);
    assert.equal(fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p').length, 2);
  } finally {
    s.done();
  }
});

test('E11 a resume that stops for a pending decision is parou-por-decisao and ends the variant', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true });
    const pending = () => ['DEC-7'];
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 3, pollMs: 1, ratify: 'off' }), { exec: fake.exec, now: NOW, ratify: () => assert.fail('ratify must not run'), pending });
    assert.equal(r.aggregate.attempts.length, 1);
    assert.equal(r.aggregate.attempts[0].status, 'invalid');
    assert.equal(r.aggregate.attempts[0].reason, 'parou-por-decisao');
    assert.equal(r.aggregate.stoppedBy, 'parou-por-decisao');
    assert.deepEqual(r.aggregate.invalidReasons, { 'parou-por-decisao': 1 });
  } finally {
    s.done();
  }
});

test('E11 with between (default) behavior is unchanged: ratify runs, no pending read, no stop', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true });
    let ratifyCalls = 0;
    const ratify = () => {
      ratifyCalls++;
      return { ok: true, ratified: ['DEC-1'] };
    };
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: fake.exec, now: NOW, ratify, pending: () => assert.fail('pending must not run') });
    assert.equal(ratifyCalls, 1);
    assert.equal(r.aggregate.valid, 1);
    assert.equal(r.aggregate.stoppedBy, undefined);
    assert.equal(r.aggregate.attempts[0].ratify, undefined);
    assert.deepEqual(r.aggregate.attempts[0].ratified, ['DEC-1']);
  } finally {
    s.done();
  }
});

test('E11 pendingE5 lists the pending E5 contract decisions through the tracker CLI', () => {
  const s = setup();
  try {
    const { sandbox } = ratifySandbox(s);
    const t = fakeTracker([dec('DEC-501', 'E5', 'contract'), dec('DEC-502', 'E5', 'executor'), dec('DEC-503', 'E6', 'contract')]);
    assert.deepEqual(pendingE5(sandbox, '/inst', { exec: t.exec }), ['DEC-501']);
    assert.equal(pendingE5(sandbox, '/inst', { exec: () => ({ status: 2, stdout: '' }) }), null);
  } finally {
    s.done();
  }
});

test('E11 P10: a valid attempt of completo carries piece3 from the extracted run', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir);
    const r = await runBatch(baseOpts(s, { variant: 'completo', runs: 1 }), { exec: fake.exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid');
    assert.deepEqual(Object.keys(a.piece3).sort(), ['gateFix', 'planAuthorModel', 'taskFixByTask']);
    assert.equal(typeof a.piece3.gateFix, 'number');
    assert.equal(typeof a.piece3.taskFixByTask, 'object');
  } finally {
    s.done();
  }
});

test('E11 --ratify off: a stop with no agent launched on resume is parou-por-decisao, not retomada-sem-agentes', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true, noAgentsOn: 2 });
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 3, pollMs: 1, ratify: 'off' }), { exec: fake.exec, now: NOW, pending: () => ['DEC-7'] });
    assert.equal(r.aggregate.attempts.length, 1);
    assert.equal(r.aggregate.attempts[0].reason, 'parou-por-decisao');
    assert.deepEqual(r.aggregate.attempts[0].pendingAfterResume, ['DEC-7']);
    assert.equal(r.aggregate.stoppedBy, 'parou-por-decisao');
  } finally {
    s.done();
  }
});

test('E11 --ratify off: an unreadable pending list is pendencias-ilegiveis and is recorded as null', async () => {
  const s = setup();
  try {
    const fake = makeFake(s.configDir, { stopResume: true });
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1, ratify: 'off' }), { exec: fake.exec, now: NOW, pending: () => null });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'invalid');
    assert.equal(a.reason, 'pendencias-ilegiveis');
    assert.equal(a.pendingAtResume, null);
    assert.equal(a.pendingAfterResume, null);
    assert.equal(r.aggregate.stoppedBy, undefined);
  } finally {
    s.done();
  }
});

// E11 gate-vazio: a coordinator attempt whose recorded baseline measured nothing is invalid (fixtures copied from the real probes).
const GATE_FIX = join(here, 'fixtures', 'coordinator-gate');

test('coordinatorGateVazio: 2.0.0 probe whose baseline ran `node --test tests/` (exit 1, 0 pass) is gate-vazio', () => {
  const r = coordinatorGateVazio(join(GATE_FIX, 'n-2.0.0'));
  assert.equal(r.vazio, true);
  assert.match(r.why, /baseline/);
});

test('coordinatorGateVazio: 1.7.0 probe that ran a real suite (2 passed, 0 failed) stays valid', () => {
  assert.equal(coordinatorGateVazio(join(GATE_FIX, 'b-1.7.0')).vazio, false);
});

test('coordinatorGateVazio: 2.0.0 baseline with exit 0 and passing tests is valid; 0 tests is gate-vazio; nothing recorded is not judged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  try {
    mkdirSync(join(dir, 'docs/plans/fixed-plan'), { recursive: true });
    const put = (baseline) => writeFileSync(join(dir, 'docs/plans/fixed-plan/progress.json'), JSON.stringify({ run: { baseline } }));
    put({ test: 'node --test', exit: 0, tail: '# tests 2\n# pass 2\n# fail 0' });
    assert.equal(coordinatorGateVazio(dir).vazio, false);
    put({ test: 'node --test', exit: 0, tail: '# tests 0\n# pass 0\n# fail 0' });
    assert.equal(coordinatorGateVazio(dir).vazio, true);
    put(undefined);
    assert.equal(coordinatorGateVazio(dir).vazio, false);
    assert.equal(coordinatorGateVazio(join(dir, 'nada')).vazio, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('coordinatorGateVazio: 1.7.0 baseline with 0 passed or any failed is gate-vazio', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  try {
    mkdirSync(join(dir, 'docs/plans/fixed-plan'), { recursive: true });
    for (const [line, want] of [['2 passed, 0 failed (tests/baseline.test.mjs)', false], ['0 passed, 1 failed (tests)', true], ['0 passed, 0 failed', true], ['3 passed, 1 failed', true]]) {
      writeFileSync(join(dir, 'docs/plans/fixed-plan/progress-plan.md'), `## Recovery State\n**Test:** node --test\n**Baseline:** ${line}\n`);
      assert.equal(coordinatorGateVazio(dir).vazio, want, line);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---- E27 C2 (T3): options, arms and refusals of the lentes-semeadas task loop ----
const { prepareHarness } = await import('./run-batch.mjs');
const lentesOpts = (s, variant, extra = {}) => seededOpts(s, variant, { stage: 'task-review', reviewModel: 'sonnet', ...extra });
const hOf = (variant, extra = {}) => prepareHarness({ variant, stage: 'task-review', reviewModel: 'sonnet', ...extra });

// A measured plugin whose task-reviewer has (or lacks) the "## Review mode" section.
function lentesPlugin(parent, workflowText, { reviewMode = true } = {}) {
  const dir = taskLoopPlugin(parent, workflowText);
  writeFileSync(join(dir, 'agents', 'task-reviewer.md'), reviewMode ? '# Task reviewer\n\n## Review mode\n\nBoth lists.\n' : '# Task reviewer\n');
  return dir;
}

test('C2: --stage task-review --rounds loop accepts lentes-semeadas-A/B with --arm atual|unica and a --review-model', () => {
  for (const variant of ['lentes-semeadas-A', 'lentes-semeadas-B']) {
    for (const extra of [{}, { arm: 'atual' }, { rounds: 'loop' }, { arm: 'atual', rounds: 'loop', reviewModel: 'opus' }]) {
      const h = hOf(variant, extra);
      assert.equal(h.base, 'atual', variant);
      assert.equal(h.arm, 'atual');
      assert.equal(h.rounds, 'loop');
      assert.deepEqual(h.harness.taskReview, { restricted: false, single: false });
      assert.deepEqual(h.kinds, ['spec', 'quality']);
    }
    const u = hOf(variant, { arm: 'unica', rounds: 'loop' });
    assert.equal(u.base, 'atual');
    assert.equal(u.arm, 'unica');
    assert.equal(u.rounds, 'loop');
    assert.deepEqual(u.harness.taskReview, { restricted: false, single: true });
    assert.deepEqual(u.kinds, ['review']);
    assert.equal(u.harness.reviewModel, 'sonnet');
  }
  // correcao-semeada keeps { restricted } only, so its aggregate does not change
  assert.deepEqual(hOf('correcao-semeada-A', { arm: 'restrita' }).harness.taskReview, { restricted: true });
  assert.deepEqual(hOf('correcao-semeada-A').harness.taskReview, { restricted: false });
  assert.equal(hOf('correcao-semeada-A').kinds, null);
});

test('C2: refusals', () => {
  const refused = [
    ['correcao-semeada-A', { arm: 'unica' }, /unica/],
    ['correcao-semeada-B', { arm: 'unica', rounds: 'loop' }, /unica/],
    ['correcao-semeada-A', { arm: 'unica', rounds: 'single' }, /unica|loop/],
    ['codigo-semeado-A', { arm: 'unica' }, /unica/],
    ['lentes-semeadas-A', { rounds: 'single' }, /loop/],
    ['lentes-semeadas-B', { arm: 'unica', rounds: 'single' }, /loop/],
    ['lentes-semeadas-A', { arm: 'restrita' }, /restrita/],
    ['lentes-semeadas-B', { arm: 'restrita', rounds: 'loop' }, /restrita/],
    ['lentes-semeadas-A', { arm: 'adversarial' }, /final-review|adversarial/],
    ['lentes-semeadas-A', { reviewModel: undefined }, /review-model/],
    ['codigo-semeado-A', { rounds: 'loop' }, /correcao-semeada/],
  ];
  for (const [variant, extra, re] of refused) {
    const opts = { variant, stage: 'task-review', reviewModel: 'sonnet', ...extra };
    if ('reviewModel' in extra && extra.reviewModel === undefined) delete opts.reviewModel;
    assert.throws(() => prepareHarness(opts), (e) => e instanceof UsageError && re.test(e.message), `${variant} ${JSON.stringify(extra)}`);
  }
  // --arm unica outside task-review
  assert.throws(() => prepareHarness({ variant: 'spec-nativo-A', stage: 'spec-review', arm: 'unica' }), (e) => e instanceof UsageError && /unica/.test(e.message));
  assert.throws(() => prepareHarness({ variant: 'correcao-semeada-A', stage: 'final-review', arm: 'unica' }), (e) => e instanceof UsageError && /unica/.test(e.message));
  // lentes-semeadas only exists in task-review
  assert.throws(() => prepareHarness({ variant: 'lentes-semeadas-A', stage: 'final-review' }), UsageError);
  assert.throws(() => prepareHarness({ variant: 'lentes-semeadas-A', stage: 'spec-review' }), UsageError);
});

test('C2: startup refusals on the measured workflow for lentes-semeadas', async () => {
  const s = setup();
  try {
    const wf = readFileSync(WORKFLOW, 'utf8');
    const cases = [
      ["TR.single ? ['review'] : ['spec', 'quality']", "TR.single ? ['reviewX'] : ['spec', 'quality']"],
      ['single: tr.single === true', 'single: tr.single'],
      ['(c.taskReview || {}).single', '(c.taskReview || {}).only'],
    ];
    for (const [lit, repl] of cases) {
      assert.equal(wf.split(lit).length - 1, 1, lit + ' occurs once in the real workflow');
      const plugin = lentesPlugin(s.base, wf.replace(lit, repl));
      for (const arm of ['atual', 'unica']) {
        const fake = makeFake(s.configDir);
        await assert.rejects(runBatch(lentesOpts(s, 'lentes-semeadas-A', { arm, pluginDir: plugin, work: join(s.base, 'w-ref') }), { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && e.message.includes(lit), `${arm} ${lit}`);
        assert.equal(claudeCalls(fake).length, 0, lit);
      }
      // the same drift does not refuse correcao-semeada: the rule only applies to the new variants
      assert.doesNotThrow(() => checkLoopWorkflow(wf.replace(lit, repl), 'task-review'), lit);
      assert.throws(() => checkLoopWorkflow(wf.replace(lit, repl), 'task-review', { lenses: true }), (e) => e instanceof UsageError && e.message.includes(lit), lit);
    }
    // the taskIssues literal is searched only inside function taskIssues: a copy elsewhere does not hide the drift
    const drifted = wf.replace('(c.taskReview || {}).single', '(c.taskReview || {}).other') + '\n// (c.taskReview || {}).single\n';
    assert.throws(() => checkLoopWorkflow(drifted, 'task-review', { lenses: true }), (e) => e instanceof UsageError && e.message.includes('(c.taskReview || {}).single'));
    assert.doesNotThrow(() => checkLoopWorkflow(wf, 'task-review', { lenses: true }));
  } finally {
    s.done();
  }
});

test('C2: a measured plugin without "## Review mode" in agents/task-reviewer.md is refused for --arm unica', async () => {
  const s = setup();
  try {
    const wf = readFileSync(WORKFLOW, 'utf8');
    const bad = lentesPlugin(s.base, wf, { reviewMode: false });
    const fake = makeFake(s.configDir);
    await assert.rejects(runBatch(lentesOpts(s, 'lentes-semeadas-A', { arm: 'unica', pluginDir: bad, work: join(s.base, 'w-rm') }), { exec: fake.exec, now: NOW }), (e) => e instanceof UsageError && /## Review mode/.test(e.message));
    assert.equal(claudeCalls(fake).length, 0);
  } finally {
    s.done();
  }
});

// ---- E27 C2 (T4): runBatch picks the lenses script for lentes-semeadas and keeps the correcao-semeada one ----
test('C2: runBatch picks the lenses script for lentes-semeadas and keeps the correcao-semeada script byte for byte', async () => {
  const s = setup();
  try {
    const wf = readFileSync(WORKFLOW, 'utf8');
    const plugin = lentesPlugin(s.base, wf);
    const sentFor = async (variant, arm) => {
      const fake = makeFake(s.configDir, { journal: taskJournal() });
      await runBatch(lentesOpts(s, variant, { arm, pluginDir: plugin, work: join(s.base, `w-${variant}-${arm}`) }), { exec: fake.exec, now: NOW });
      return readFileSync(join(firstClaudeP(fake).cwd, 'review-only.js'), 'utf8');
    };
    const atual = await sentFor('lentes-semeadas-A', 'atual');
    assert.ok(atual.includes('const H_KINDS = ["spec","quality"]'), atual.slice(0, 400));
    assert.ok(atual.includes('const H_TR = {"restricted":false,"single":false}'));
    assert.ok(atual.includes('fix the {{kind}} problems below'));
    assert.ok(!atual.includes('H_FIXSHA') && !atual.includes('merge --ff-only'), 'no applier: the seed sits before the 1st review');
    const unica = await sentFor('lentes-semeadas-B', 'unica');
    assert.ok(unica.includes('const H_KINDS = ["review"]'));
    assert.ok(unica.includes('const H_TR = {"restricted":false,"single":true}'));
    // correcao-semeada keeps its single-loop script: no kinds, the same literals as before
    const fake = makeFake(s.configDir, { journal: taskJournal(), afterRun: mergeE5 });
    await runBatch(corrOpts(s, { pluginDir: plugin, work: join(s.base, 'w-corr') }), { exec: fake.exec, now: NOW });
    const corr = readFileSync(join(firstClaudeP(fake).cwd, 'review-only.js'), 'utf8');
    assert.ok(!corr.includes('H_KINDS'));
    assert.ok(corr.includes('const H_TR = {"restricted":false}') && corr.includes('fix the spec problems below'));
  } finally {
    s.done();
  }
});

test('C2: STAGES[task-review].variant accepts lentes-semeadas-[AB] and STAGE_LOOP of task-review stays the same', () => {
  for (const v of ['lentes-semeadas-A', 'lentes-semeadas-B']) assert.doesNotThrow(() => hOf(v), v);
  for (const v of ['lentes-semeadas-C', 'lentes-semeadas-', 'lentes-semeada-A']) assert.throws(() => hOf(v), UsageError, v);
  assert.deepEqual(stageLoopFor('task-review', 'sonnet'), { tier: 'sonnet', reviewModel: 'sonnet', reviewEffort: 'medium', maxFix: 2, byId: true });
  assert.deepEqual(hOf('lentes-semeadas-A', { arm: 'unica' }).harness.stageOptions ?? stageLoopFor('task-review', 'sonnet'), stageLoopFor('task-review', 'sonnet'));
});

// ---- E27 C3 (T5): replay, validity, outcome and counters of the lenses task loop ----
const { lensValidity, lensAttemptStats, armTotals } = await import('./run-batch.mjs');
const { manifestEntries: manifestOf } = await import('./make-scenario.mjs');

const SEEDED40 = 'a'.repeat(40);
const lrv = (issues, spec = 'pass', quality = 'pass', extra = {}) => trv(issues, SEEDED40, { spec, quality, ...extra });
const hL = (arm = 'atual') => {
  const h = hOf('lentes-semeadas-A', { arm });
  h.loopFns = loadPure();
  return h;
};
const lensStub = { dir: 'D:/work/lentes-semeadas-A-1', seededCommit: SEEDED40 };
const SEEDS_A = manifestOf('lentes-semeadas-A');
// findings written to match the mention of one seed each (SP1 and SP2 are spec seeds, QL1 and QL2 quality seeds of artifact A)
const F_SP1 = FOUND('S1', 'the index re-exports wordCount only as countWords, the spec asks for wordCount', 'src/index.mjs');
const F_SP2 = FOUND('S2', 'wordCount throws a TypeError for non-string input instead of coercing with String(text)', 'src/word-count.mjs');
const F_QL1 = FOUND('Q1', 'the module-level regex with the g flag keeps lastIndex between calls', 'src/word-count.mjs');
const F_QL2 = FOUND('Q2', 'the test builds its import path from process.cwd() and fails outside the repo root', 'tests/e5-word-count.test.mjs');
const RISK = { id: 'R1', severity: 'important', category: 'fora-do-escopo', description: '[fab] out of scope nit', file: 'src/x.mjs' };
const MINOR_ONLY = { severity: 'minor', category: 'defeito', description: '[fab] typo', file: 'src/x.mjs' };

// Runs the real generated lenses script with a stub agent; returns its return and the journal it would have left.
async function lensRun({ arm = 'atual', reviews, fixes = {} }) {
  const wf = readFileSync(WORKFLOW, 'utf8');
  const text = buildTaskLoopScript({
    pure: checkLoopWorkflow(wf, 'task-review', { lenses: true }),
    scenario: lensStub,
    opts: { restricted: false, kinds: arm === 'unica' ? ['review'] : ['spec', 'quality'], single: arm === 'unica', reviewModel: 'sonnet', pluginRoot: 'D:/cfg/p', work: 'D:/work', title: 'Word count', fixPrompt: 'Fix the {{kind}} problems.\n{{issues}}' },
  });
  const journal = [];
  let i = 0;
  const agent = async (prompt, o) => {
    const out = /-fix\d+$/.test(o.label) ? (o.label in fixes ? fixes[o.label] : APPLIED_FIX) : reviews[Math.min(i++, reviews.length - 1)];
    journal.push(entry(o.label, out));
    return out;
  };
  const result = await new AsyncFn('agent', text.replace('export const meta', 'const meta'))(agent);
  return { result, journal, scenario: lensStub };
}
const okOf = (loops) => loops.map((l) => [l.kind, l.ok]);

test('C3: replay ok equals the script ok, loop by loop, in both arms', async () => {
  const P = loadPure();
  const sequences = {
    'clean on the 1st': { reviews: [lrv([])] },
    'fix and clean': { reviews: [lrv([F_SP1]), lrv([]), lrv([])] },
    'stops on the 1st loop': { reviews: [lrv([FOUND('F1')]), lrv([FOUND('F2')]), lrv([FOUND('F3')])] },
    'repeated finding (escalates)': { reviews: [lrv([FOUND('F1')]), lrv([FOUND('F1')]), lrv([FOUND('F1')]), lrv([FOUND('F1')])] },
    'unica verdict fail, only a minor finding': { reviews: [lrv([MINOR_ONLY], 'pass', 'fail'), lrv([])] },
  };
  const atualOnly = { 'approves the 1st loop, stops the 2nd': { reviews: [lrv([]), lrv([FOUND('F1')]), lrv([FOUND('F2')]), lrv([FOUND('F3')])] } };
  for (const arm of ['atual', 'unica']) {
    for (const [name, seq] of Object.entries({ ...sequences, ...(arm === 'atual' ? atualOnly : {}) })) {
      const run = await lensRun({ arm, ...seq });
      const replay = await loopResult(hL(arm), run.journal, P, run.scenario);
      assert.equal(replay.ok, run.result.ok, `${arm} ${name}`);
      assert.deepEqual(okOf(replay.loops), okOf(run.result.loops), `${arm} ${name}`);
      assert.equal(replay.divergent, undefined, `${arm} ${name}`);
    }
  }
});

test('C3: laco-divergente when a replayed loop differs from the script, or the journal has an unused or repeated label', async () => {
  const P = loadPure();
  const spec1 = entry('E5:t3:spec1', lrv([]));
  const quality1 = entry('E5:t3:quality1', lrv([]));
  // a label of the task not used by the replay, a repeated one, and a loop the replay never reached
  assert.equal((await loopResult(hL(), [spec1, quality1, entry('E5:t3:spec-fix1', APPLIED_FIX)], P, lensStub)).divergent, true);
  assert.equal((await loopResult(hL(), [spec1, spec1, quality1], P, lensStub)).divergent, true);
  assert.equal((await loopResult(hL(), [spec1, quality1, entry('E5:t3:quality2', lrv([]))], P, lensStub)).divergent, true);
  const stopped = [entry('E5:t3:spec1', lrv([FOUND('F1')])), entry('E5:t3:spec-fix1', APPLIED_FIX), entry('E5:t3:spec2', lrv([FOUND('F2')])), entry('E5:t3:spec-fix2', APPLIED_FIX), entry('E5:t3:spec3', lrv([FOUND('F3')]))];
  assert.equal((await loopResult(hL(), [...stopped, quality1], P, lensStub)).divergent, true, 'the script ran quality, the replay stopped at spec');
  // the old single-loop labels are not stage labels of the lenses branch and the t3 ones of the other arm are
  assert.equal((await loopResult(hL('unica'), [entry('E5:t3:review1', lrv([])), entry('E5:t3:spec1', lrv([]))], P, lensStub)).divergent, true);
  // a tampered journal: the script blocked to the end, one verdict was swapped to clean
  const run = await lensRun({ reviews: [lrv([FOUND('F1')]), lrv([FOUND('F2')]), lrv([FOUND('F3')])] });
  assert.equal(run.result.ok, false);
  const tampered = [...run.journal.map((e) => (e.label === 'E5:t3:spec3' ? entry(e.label, lrv([])) : e)), entry('E5:t3:quality1', lrv([]))];
  const replay = await loopResult(hL(), tampered, P, run.scenario);
  assert.equal(replay.ok, true);
  const s = setup();
  try {
    const sc = await unitScenario(s, 'lentes-semeadas-A');
    const journal = { entries: [spec1, quality1] };
    const good = { ok: true, loops: [{ kind: 'spec', ok: true }, { kind: 'quality', ok: true }] };
    const loop = await loopResult(hL(), journal.entries, P, sc);
    const div = { valid: false, reason: 'laco-divergente' };
    assert.equal((await lensValidity(hL(), journal, sc, loop, good)).valid, true);
    assert.deepEqual(await lensValidity(hL(), journal, sc, loop, { ...good, ok: false }), div);
    assert.deepEqual(await lensValidity(hL(), journal, sc, loop, { ok: true, loops: [{ kind: 'spec', ok: true }] }), div, 'the replay ran quality, the script did not');
    assert.deepEqual(await lensValidity(hL(), journal, sc, loop, { ok: true, loops: [{ kind: 'spec', ok: true }, { kind: 'quality', ok: false }] }), div);
    assert.deepEqual(await lensValidity(hL(), journal, sc, loop, { ok: true, loops: [{ kind: 'quality', ok: true }, { kind: 'spec', ok: true }] }), div);
    assert.deepEqual(await lensValidity(hL(), journal, sc, { ...loop, divergent: true }, good), div);
    assert.deepEqual(await lensValidity(hL(), journal, sc, loop, null), { valid: false, reason: 'formato-do-diario' });
    // the tampered journal replays as approved while the script reported the stop: laco-divergente
    assert.deepEqual(await lensValidity(hL(), { entries: tampered }, sc, replay, run.result), div);
  } finally {
    s.done();
  }
  // 2 in one invocation stop that invocation; 1 does not
  const inv = (reason, n) => Array.from({ length: n }, () => ({ status: 'invalid', reason }));
  assert.equal(batchStopReason(inv('laco-divergente', 2), { lenses: true }), 'laco-divergente');
  assert.equal(batchStopReason(inv('laco-divergente', 1), { lenses: true }), null);
});

test('C3: formato-do-diario, laco-infra and semente-ausente', async () => {
  const P = loadPure();
  const s = setup();
  try {
    const sc = await unitScenario(s, 'lentes-semeadas-A');
    const script = { ok: true, loops: [{ kind: 'spec', ok: true }, { kind: 'quality', ok: true }] };
    // formato-do-diario: the 1st review of the 1st loop has no issues list
    const noList = { entries: [entry('E5:t3:spec1', { headSha: 'x', clean: true, commitsInRange: 3 }), entry('E5:t3:quality1', lrv([]))] };
    const loopNoList = await loopResult(hL(), noList.entries, P, sc);
    assert.deepEqual(await lensValidity(hL(), noList, sc, loopNoList, script), { valid: false, reason: 'formato-do-diario' });
    assert.deepEqual(await lensValidity(hL(), { entries: [], formatError: 'journal missing' }, sc, { infra: true }, script), { valid: false, reason: 'formato-do-diario' });
    // laco-infra: a null review (and its retry) or a null fix
    const infra = [entry('E5:t3:spec1', null), entry('E5:t3:spec1b', null)];
    assert.deepEqual(await loopResult(hL(), infra, P, sc), { infra: true });
    assert.deepEqual(await lensValidity(hL(), { entries: infra }, sc, { infra: true }, script), { valid: false, reason: 'laco-infra' });
    assert.deepEqual(await loopResult(hL(), [entry('E5:t3:spec1', lrv([FOUND('F1')])), entry('E5:t3:spec-fix1', null)], P, sc), { infra: true });
    // the retry 1b stands in for review 1 of the 2nd loop too
    const retried = await loopResult(hL(), [entry('E5:t3:spec1', lrv([])), entry('E5:t3:quality1', null), entry('E5:t3:quality1b', lrv([]))], P, sc);
    assert.equal(retried.ok, true);
    assert.equal(retried.divergent, undefined);
    // semente-ausente: a seed whose present is false at the seededCommit (here the clean T3 right before it), ahead of laco-infra
    const clean = { ...sc, seededCommit: `${sc.seededCommit}~1` };
    const good = { entries: [entry('E5:t3:spec1', lrv([])), entry('E5:t3:quality1', lrv([]))] };
    const loopGood = await loopResult(hL(), good.entries, P, sc);
    assert.equal((await lensValidity(hL(), good, sc, loopGood, script)).valid, true);
    assert.deepEqual(await lensValidity(hL(), good, clean, loopGood, script), { valid: false, reason: 'semente-ausente' });
    assert.deepEqual(await lensValidity(hL(), { entries: infra }, clean, { infra: true }, script), { valid: false, reason: 'semente-ausente' });
    // the correcao-semeada reasons do not exist here: no fixSha, no sem-correcao
    assert.equal(sc.fixSha, null);
  } finally {
    s.done();
  }
  // 2 semente-ausente stop an invocation, and so do more than 3 invalid ones
  const inv = (reason, n) => Array.from({ length: n }, () => ({ status: 'invalid', reason }));
  assert.equal(batchStopReason(inv('semente-ausente', 2), { lenses: true }), 'semente-ausente');
  assert.equal(batchStopReason(inv('semente-ausente', 1), { lenses: true }), null);
  assert.equal(batchStopReason([...inv('formato-do-diario', 2), ...inv('laco-infra', 2)], { lenses: true }), 'invalidas');
});

// The run, as the simulated claude -p leaves it for lentes-semeadas: the journal and the script return (the sandbox stays at the seededCommit).
function lensAfterRun(s, spec) {
  return (cwd, n) => {
    const sp = spec(n);
    if (sp.after) sp.after(cwd);
    writeFileSync(journalFileOf(s.configDir, n), jl(...sp.entries));
    appendWorkflowReturn(s.configDir, n, sp.ret, sp.shape ?? 'direct');
  };
}
const lensBatch = (s, arm = 'atual', extra = {}) => seededOpts(s, 'lentes-semeadas-A', { stage: 'task-review', reviewModel: 'sonnet', arm, pluginDir: REAL_PLUGIN, ...extra });
const cleanLoops = [{ kind: 'spec', ok: true, stop: null, accepted: [] }, { kind: 'quality', ok: true, stop: null, accepted: [] }];

test('C3: a first review with no hard finding is valid and the four seeds are perdido', async () => {
  const s = setup();
  try {
    const spec = () => ({ entries: [entry('E5:t3:spec1', lrv([MINOR_ONLY])), entry('E5:t3:quality1', lrv([]))], ret: { ok: true, kind: null, msg: null, loops: cleanLoops, reviews: [], accepted: [] } });
    const r = await runBatch(lensBatch(s), { exec: makeFake(s.configDir, { afterRun: lensAfterRun(s, spec) }).exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(r.aggregate.invalidReasons));
    assert.deepEqual(outcomeMap(a), { SP1: 'perdido', SP2: 'perdido', QL1: 'perdido', QL2: 'perdido' });
    assert.equal(a.loop.ok, true);
    assert.equal(a.loop.fixes, 0);
    assert.equal(r.aggregate.outcomesByLens.spec.perdido, 2);
    assert.equal(r.aggregate.outcomesByLens.quality.perdido, 2);
  } finally {
    s.done();
  }
});

test('C3: bloqueou-sintetico only when the fixer answers BLOCKED to a fixable list with only synthetic findings', async () => {
  const P = loadPure();
  const s = setup();
  try {
    const sc = await unitScenario(s, 'lentes-semeadas-A');
    const synthOnly = lrv([MINOR_ONLY], 'pass', 'fail');
    const blocked = { status: 'BLOCKED', summary: 'nothing to fix', checks: [] };
    const run = await lensRun({ arm: 'unica', reviews: [synthOnly, lrv([])], fixes: { 'E5:t3:review-fix1': blocked } });
    assert.equal(run.result.ok, false);
    const loop = await loopResult(hL('unica'), run.journal, P, sc);
    assert.deepEqual(await lensValidity(hL('unica'), { entries: run.journal }, sc, loop, run.result), { valid: false, reason: 'bloqueou-sintetico' });
    // the same list with a DONE fix is a valid attempt
    const done = await lensRun({ arm: 'unica', reviews: [synthOnly, lrv([])] });
    const loopDone = await loopResult(hL('unica'), done.journal, P, sc);
    assert.equal((await lensValidity(hL('unica'), { entries: done.journal }, sc, loopDone, done.result)).valid, true);
    // a BLOCKED fix to a list with a real finding is not this reason
    const real = await lensRun({ arm: 'unica', reviews: [lrv([FOUND('F1')], 'fail', 'pass')], fixes: { 'E5:t3:review-fix1': blocked } });
    const loopReal = await loopResult(hL('unica'), real.journal, P, sc);
    assert.equal((await lensValidity(hL('unica'), { entries: real.journal }, sc, loopReal, real.result)).valid, true);
  } finally {
    s.done();
  }
  // the order of the reasons: bloqueou-sintetico comes before laco-divergente
  // more than 2 in an invocation stop it, 2 do not
  const inv = (n) => Array.from({ length: n }, () => ({ status: 'invalid', reason: 'bloqueou-sintetico' }));
  assert.equal(batchStopReason(inv(3), { lenses: true }), 'bloqueou-sintetico');
  assert.equal(batchStopReason(inv(2), { lenses: true }), null);
});

// the attempt-level counters of one replayed attempt (loopResult + lensAttemptStats), the outcomes given by hand
const statsOf = async (arm, run, outcomes = []) => {
  const h = hL(arm);
  const loop = await loopResult(h, run.journal, loadPure(), run.scenario);
  return lensAttemptStats(h, loop, outcomes, SEEDS_A);
};
const oc = (id, outcome) => ({ id, class: 'code', detectedBy: 'reviewer', outcome });

test('C3: BLOCKED with a synthetic and a real finding is bloqueadoMisto, a valid stopped attempt (indeterminado)', async () => {
  const P = loadPure();
  const s = setup();
  try {
    const sc = await unitScenario(s, 'lentes-semeadas-A');
    // unica: a failing verdict with no finding gives the synthetic one, and a dirty tree adds a finding of the script itself
    const mixed = lrv([], 'pass', 'fail', { clean: false });
    const run = await lensRun({ arm: 'unica', reviews: [mixed], fixes: { 'E5:t3:review-fix1': { status: 'BLOCKED', summary: 'cannot', checks: [] } } });
    const loop = await loopResult(hL('unica'), run.journal, P, sc);
    assert.equal(loop.ok, false);
    const v = await lensValidity(hL('unica'), { entries: run.journal }, sc, loop, run.result);
    assert.equal(v.valid, true, JSON.stringify(v));
    const st = await statsOf('unica', run, SEEDS_A.map((e) => oc(e.id, 'indeterminado')));
    assert.equal(st.bloqueadoMisto, true);
    assert.equal(st.paradoSoSintetico, false);
    // a BLOCKED to synthetic findings only is not mixed
    const only = await lensRun({ arm: 'unica', reviews: [lrv([MINOR_ONLY], 'pass', 'fail')], fixes: { 'E5:t3:review-fix1': { status: 'BLOCKED', summary: 'cannot', checks: [] } } });
    assert.equal((await statsOf('unica', only)).bloqueadoMisto, false);
  } finally {
    s.done();
  }
});

test('C3: a loop stopped without BLOCKED with only synthetic findings open is paradoSoSintetico, a valid stopped attempt (indeterminado)', async () => {
  const P = loadPure();
  const s = setup();
  try {
    const sc = await unitScenario(s, 'lentes-semeadas-A');
    // the failing verdict never goes away and no finding names it: the synthetic repeats until opus stops the loop
    const run = await lensRun({ arm: 'unica', reviews: [lrv([MINOR_ONLY], 'pass', 'fail')] });
    assert.deepEqual(run.journal.map((e) => e.label), ['E5:t3:review1', 'E5:t3:review-fix1', 'E5:t3:review2', 'E5:t3:review-fix2', 'E5:t3:review3']);
    assert.equal(run.result.ok, false);
    const loop = await loopResult(hL('unica'), run.journal, P, sc);
    assert.equal((await lensValidity(hL('unica'), { entries: run.journal }, sc, loop, run.result)).valid, true);
    const st = await statsOf('unica', run, SEEDS_A.map((e) => oc(e.id, 'indeterminado')));
    assert.equal(st.paradoSoSintetico, true);
    assert.equal(st.bloqueadoMisto, false);
    // with a real finding open next to the synthetic one it does not count
    const withReal = await lensRun({ arm: 'unica', reviews: [lrv([], 'pass', 'fail', { clean: false })] });
    assert.equal(withReal.result.ok, false);
    assert.equal((await statsOf('unica', withReal)).paradoSoSintetico, false);
    // the atual arm has no synthetic finding: a stopped loop is a real one
    const atual = await lensRun({ arm: 'atual', reviews: [lrv([FOUND('F1')])] });
    assert.equal((await statsOf('atual', atual)).paradoSoSintetico, false);
  } finally {
    s.done();
  }
});

test('C3: failRiscoAceito counts, in both arms, attempts whose loop approved with accepted risks in a round whose verdict is not pass', async () => {
  // unica: the verdict spec or quality different from pass in the round that approved with the accepted risk
  for (const [spec, quality, want] of [['pass', 'fail', true], ['fail', 'pass', true], ['pass', 'pass', false]]) {
    const run = await lensRun({ arm: 'unica', reviews: [lrv([RISK], spec, quality)] });
    assert.equal(run.result.ok, true);
    assert.equal(run.result.loops[0].accepted.length, 1);
    assert.equal((await statsOf('unica', run)).failRiscoAceito, want, `${spec}/${quality}`);
  }
  // an approval with no accepted risk never counts, whatever the verdict (the synthetic finding forces a fix)
  const noRisk = await lensRun({ arm: 'unica', reviews: [lrv([MINOR_ONLY], 'pass', 'fail'), lrv([])] });
  assert.equal((await statsOf('unica', noRisk)).failRiscoAceito, false);
  // atual (owner decision, via Fable): a loop approved with a non-empty accepted list counts, whatever `clean` says (a non-hard blocking
  // finding accepted is equivalent to a fail verdict); an approval with an empty accepted list does not
  const h = hL('atual');
  const seeds = SEEDS_A;
  const lens = (clean, accepted = [RISK]) => ({ loops: [{ kind: 'spec', ok: true, accepted: [], lastReview: lrv([]) }, { kind: 'quality', ok: true, accepted, lastReview: lrv(accepted, 'pass', 'pass', { clean }) }], reviewsLog: [], sinteticoGerado: 0, veredictoAusente: 0 });
  assert.equal(lensAttemptStats(h, { lens: lens(false) }, [], seeds).failRiscoAceito, true);
  assert.equal(lensAttemptStats(h, { lens: lens(true) }, [], seeds).failRiscoAceito, true);
  assert.equal(lensAttemptStats(h, { lens: lens(true, []) }, [], seeds).failRiscoAceito, false);
  assert.equal(lensAttemptStats(h, { lens: lens(false, []) }, [], seeds).failRiscoAceito, false);
});

test('C3: atual loop approved with an important pelo-plano finding accepted is failRiscoAceito, kept on the attempt record and undetermined in the failRisco recount', async () => {
  const P = { severity: 'important', category: 'pelo-plano', description: '[fab] the plan asks for it, not a seed', file: 'src/x.mjs' };
  const run = await lensRun({ arm: 'atual', reviews: [lrv([P])] });
  assert.equal(run.result.ok, true);
  assert.equal(run.result.loops.some((l) => l.accepted.length > 0), true, JSON.stringify(run.result.loops));
  const st = await statsOf('atual', run, SEEDS_A.map((e) => oc(e.id, 'capturado')));
  assert.equal(st.failRiscoAceito, true);
  // the attempt record keeps the accepted list of each loop (it used to be dropped with the lens replay)
  const s = setup();
  try {
    const spec = () => ({ entries: [entry('E5:t3:spec1', lrv([P])), entry('E5:t3:quality1', lrv([]))], ret: { ok: true, kind: null, msg: null, loops: run.result.loops, reviews: [], accepted: [] } });
    const r = await runBatch(lensBatch(s), { exec: makeFake(s.configDir, { afterRun: lensAfterRun(s, spec) }).exec, now: NOW });
    const a = r.aggregate.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(r.aggregate.invalidReasons));
    assert.ok(a.loop.loops.every((l) => Array.isArray(l.accepted)), JSON.stringify(a.loop.loops));
    assert.equal(a.loop.loops.some((l) => l.accepted.length > 0), true, JSON.stringify(a.loop.loops));
  } finally {
    s.done();
  }
  // in the recount the attempt becomes undetermined
  const t = armTotals([aggOf('A', [vatt('A', 1, ALL, { failRiscoAceito: st.failRiscoAceito })])]).totals;
  const rc = (await import('./run-batch.mjs')).recountLenses(t, 'failRisco');
  assert.equal(rc.capturas, 0);
  assert.equal(rc.indeterminados, 4);
});

test('C3: sinteticoGerado and veredictoAusente counted per round in unica', async () => {
  // round 1: quality fail and no finding (synthetic); round 2: the quality verdict is missing (synthetic again); round 3 clean
  const noQuality = { ...lrv([], 'pass'), quality: undefined };
  const run = await lensRun({ arm: 'unica', reviews: [lrv([], 'pass', 'fail'), noQuality, lrv([])] });
  assert.equal(run.result.ok, true);
  const st = await statsOf('unica', run);
  assert.equal(st.sinteticoGerado, 2);
  assert.equal(st.veredictoAusente, 1);
  // the atual arm never generates the synthetic finding and has no verdict to be missing
  const atual = await statsOf('atual', await lensRun({ arm: 'atual', reviews: [lrv([])] }));
  assert.equal(atual.sinteticoGerado, 0);
  assert.equal(atual.veredictoAusente, 0);
});

test('C3: capturadoPor names the first kind and round whose finding matches the mention; capturadoSemMencao as in B', async () => {
  // the spec loop: spec1 mentions SP1, spec2 clean; the quality loop: quality1 mentions SP2 (a spec seed seen by the quality lens), quality2 mentions QL1; nobody mentions QL2
  const run = await lensRun({ arm: 'atual', reviews: [lrv([F_SP1]), lrv([]), lrv([F_SP2]), lrv([F_QL1]), lrv([])] });
  assert.deepEqual(run.journal.map((e) => e.label), ['E5:t3:spec1', 'E5:t3:spec-fix1', 'E5:t3:spec2', 'E5:t3:quality1', 'E5:t3:quality-fix1', 'E5:t3:quality2', 'E5:t3:quality-fix2', 'E5:t3:quality3']);
  const outcomes = [oc('SP1', 'capturado'), oc('SP2', 'capturado'), oc('QL1', 'perdido'), oc('QL2', 'capturado')];
  const st = await statsOf('atual', run, outcomes);
  assert.deepEqual(st.capturadoPor, { SP1: { kind: 'spec', round: 1 }, SP2: { kind: 'quality', round: 1 }, QL1: { kind: 'quality', round: 2 }, QL2: null });
  assert.equal(st.capturadoSemMencao, 1); // only QL2 was captured with no review naming it
  assert.deepEqual(st.mentioned, { SP1: true, SP2: true, QL1: true, QL2: false });
  // unica: every mention comes from the one loop
  const u = await statsOf('unica', await lensRun({ arm: 'unica', reviews: [lrv([F_SP1], 'fail', 'pass'), lrv([F_QL2], 'pass', 'fail'), lrv([])] }), outcomes);
  assert.deepEqual(u.capturadoPor, { SP1: { kind: 'review', round: 1 }, SP2: null, QL1: null, QL2: { kind: 'review', round: 2 } });
});

const lensOfA = Object.fromEntries(SEEDS_A.map((e) => [e.id, e.lens]));
// A valid attempt of the lenses batch as runBatch records it (the fields armTotals reads).
const vatt = (artifact, order, outcomes, extra = {}) => ({
  n: 1, status: 'valid', artifact, startedAt: `2026-11-16T10:${String(order).padStart(2, '0')}:00Z`, costUsd: 0.5,
  outcomes: Object.entries(outcomes).map(([id, o]) => oc(id, o)), capturadoPor: {}, failRiscoAceito: false, bloqueadoMisto: false, paradoSoSintetico: false, sinteticoGerado: 0, veredictoAusente: 0, ...extra,
});
const iatt = (reason) => ({ n: 1, status: 'invalid', reason });
const aggOf = (artifact, attempts, taskReview = { restricted: false, single: false }) => ({ variant: `lentes-semeadas-${artifact}`, harness: { arm: taskReview.single ? 'unica' : 'atual', taskReview, kinds: taskReview.single ? ['review'] : ['spec', 'quality'] }, attempts });
const ALL = { SP1: 'capturado', SP2: 'capturado', QL1: 'capturado', QL2: 'capturado' };

test('C3: capturadoPorMatriz counts captures by first mentioning loop and design class', () => {
  const a = vatt('A', 1, ALL, { capturadoPor: { SP1: { kind: 'spec', round: 1 }, SP2: { kind: 'quality', round: 1 }, QL1: { kind: 'quality', round: 2 }, QL2: null } });
  const { totals } = armTotals([aggOf('A', [a])]);
  // atual: the spec seed caught first by the quality loop is the cell quality x spec; a capture with no mention has its own row
  assert.deepEqual(totals.capturadoPorMatriz, { spec: { spec: 1, quality: 0 }, quality: { spec: 1, quality: 1 }, semMencao: { spec: 0, quality: 1 } });
  // a seed that was not captured is not in the matrix, even if a review mentioned it
  const b = vatt('B', 2, { ...ALL, SP1: 'perdido' }, { capturadoPor: { SP1: { kind: 'spec', round: 1 } } });
  assert.equal(armTotals([aggOf('A', [b])]).totals.capturadoPorMatriz.spec.spec, 0);
  // unica: everything sits in the review row
  const u = vatt('A', 1, ALL, { capturadoPor: { SP1: { kind: 'review', round: 1 }, SP2: { kind: 'review', round: 1 }, QL1: { kind: 'review', round: 2 }, QL2: { kind: 'review', round: 1 } } });
  assert.deepEqual(armTotals([aggOf('A', [u], { restricted: false, single: true })]).totals.capturadoPorMatriz, { review: { spec: 2, quality: 2 }, semMencao: { spec: 0, quality: 0 } });
});

test('C3: outcomesByLens splits captures, misses and determined by lens', () => {
  const a = vatt('A', 1, { SP1: 'capturado', SP2: 'perdido', QL1: 'indeterminado', QL2: 'capturado' });
  const b = vatt('A', 2, { SP1: 'capturado', SP2: 'capturado', QL1: 'perdido', QL2: 'perdido' });
  const { totals } = armTotals([aggOf('A', [a, b])]);
  assert.deepEqual(totals.outcomesByLens.spec, { capturado: 3, perdido: 1, indeterminado: 0, determinadas: 4 });
  assert.deepEqual(totals.outcomesByLens.quality, { capturado: 1, perdido: 2, indeterminado: 1, determinadas: 3 });
  assert.deepEqual([totals.capturas, totals.perdidos, totals.indeterminados, totals.determinadas, totals.oportunidades], [4, 3, 1, 7, 8]);
  assert.equal(lensOfA.SP1, 'spec');
});

test('C3: rolesByLabel puts E5:t3:<kind><r> in review and E5:t3:<kind>-fix<k> in fix', () => {
  const calls = (s) => ({ haiku: 0, sonnet: s, opus: 0, fable: 0, other: 0 });
  const role = (cost) => ({ calls: calls(1), promptBytes: 1, tokens: { input: 1, output: 1 }, cost, agents: 1 });
  const run = {
    roles: { 'E5:t3:spec1': role(1), 'E5:t3:quality2': role(2), 'E5:t3:review1': role(4), 'E5:t3:spec-fix1': role(8), 'E5:t3:review-fix2': role(16), 'other:t3:review': role(32), 'E5:task-review1': role(64), 'E5:impl': role(128) },
    main: { cost: 0 },
  };
  const r = rolesByLabel(run, 0);
  assert.equal(r.review.cost, 1 + 2 + 4 + 32 + 64);
  assert.equal(r.fix.cost, 8 + 16);
  assert.equal(r.other.cost, 128);
});

test('C3: rolesByLabel classifies spec/quality task reviews of every task and their retries (b) as review', () => {
  const calls = (s) => ({ haiku: 0, sonnet: s, opus: 0, fable: 0, other: 0 });
  const role = (cost) => ({ calls: calls(1), promptBytes: 1, tokens: { input: 1, output: 1 }, cost, agents: 1 });
  const run = {
    roles: { 'E5:t3:spec1b': role(1), 'E5:t4:quality2': role(2), 'E5:t12:spec3': role(4), 'E5:t4:quality1b': role(8), 'E5:t4:spec-fix1': role(16), 'E5:t4:specs': role(32), 'E5:t4:impl': role(64), 'E5:t3:spec': role(128) },
    main: { cost: 0 },
  };
  const r = rolesByLabel(run, 0);
  assert.equal(r.review.cost, 1 + 2 + 4 + 8);
  assert.equal(r.fix.cost, 16);
  assert.equal(r.other.cost, 32 + 64 + 128);
});

test('C3: the correcao-semeada replay and validity are unchanged', async () => {
  const P = loadPure();
  const sc = { seededCommit: 'a'.repeat(40) };
  const ok = await loopResult(hTask(), [entry('E5:task-review1', trv([FOUND('F1')])), entry('E5:task-review-fix1', APPLIED_FIX), entry('E5:task-review2', trv([]))], P, sc);
  assert.deepEqual(Object.keys(ok), ['reviews', 'fixes', 'fixTiers', 'ok', 'kind', 'restrictedRounds']);
  assert.equal(ok.ok, true);
  assert.deepEqual(await loopResult(hTask(), [entry('E5:task-review1', null), entry('E5:task-review1b', null)], P, sc), { infra: true });
  assert.deepEqual(await loopResult(hTask(), [entry('E5:task-review1', trv([])), entry('E5:task-review-fix1', APPLIED_FIX)], P, sc), { divergent: true });
  // a t3 label is not a stage label of the correcao-semeada loop
  assert.equal((await loopResult(hTask(), [entry('E5:task-review1', trv([])), entry('E5:t3:spec1', trv([]))], P, sc)).divergent, undefined);
  const h = hOf('correcao-semeada-A');
  assert.equal(h.lenses, false);
  assert.equal(h.kinds, null);
});

test('C3: armTotals sums the aggregates of A and B of one arm and fires the arm stops', () => {
  const A = aggOf('A', [vatt('A', 1, ALL, { failRiscoAceito: true, costUsd: 1, capturadoPor: { SP1: { kind: 'spec', round: 1 } } }), iatt('laco-divergente'), iatt('bloqueou-sintetico'), iatt('bloqueou-sintetico')]);
  const B = aggOf('B', [vatt('B', 2, { SP3: 'capturado', SP4: 'perdido', QL3: 'capturado', QL4: 'indeterminado' }, { bloqueadoMisto: true, paradoSoSintetico: true, sinteticoGerado: 2, veredictoAusente: 1, costUsd: 0.5 }), iatt('laco-divergente'), iatt('bloqueou-sintetico')]);
  const r = armTotals([A, B]);
  assert.equal(r.totals.valid, 2);
  assert.equal(r.totals.invalid, 5);
  assert.equal(r.totals.invalidReasons['laco-divergente'], 2);
  assert.equal(r.totals.invalidReasons['bloqueou-sintetico'], 3);
  assert.deepEqual([r.totals.failRiscoAceito, r.totals.bloqueadoMisto, r.totals.paradoSoSintetico, r.totals.sinteticoGerado, r.totals.veredictoAusente], [1, 1, 1, 2, 1]);
  assert.deepEqual([r.totals.capturas, r.totals.perdidos, r.totals.indeterminados, r.totals.oportunidades], [6, 1, 1, 8]);
  assert.equal(r.totals.costUsd, 1.5);
  assert.equal(r.totals.costPerValid, 0.75);
  assert.equal(r.totals.outcomes.SP1.capturado, 1);
  assert.equal(r.totals.outcomes.SP4.perdido, 1);
  assert.deepEqual(r.totals.validOrder.map((x) => [x.artifact, x.capturado]), [['A', 4], ['B', 2]]);
  // an invocation alone never reached its own stop (2 + 1 bloqueou-sintetico), the arm did: more than 2
  assert.equal(batchStopReason(A.attempts.slice(0, 3), { lenses: true }), null);
  assert.equal(armTotals([aggOf('A', [iatt('bloqueou-sintetico'), iatt('bloqueou-sintetico')]), aggOf('B', [iatt('bloqueou-sintetico')])]).stop, 'bloqueou-sintetico');
  assert.equal(batchStopReason([iatt('bloqueou-sintetico'), iatt('bloqueou-sintetico')], { lenses: true }), null);
  assert.equal(batchStopReason([iatt('bloqueou-sintetico')], { lenses: true }), null);
  assert.equal(armTotals([aggOf('A', [iatt('bloqueou-sintetico'), iatt('bloqueou-sintetico')]), aggOf('B', [])]).stop, null);
  // 1 + 1 laco-divergente: the arm stops
  assert.equal(armTotals([aggOf('A', [iatt('laco-divergente')]), aggOf('B', [iatt('laco-divergente')])]).stop, 'laco-divergente');
  assert.equal(armTotals([aggOf('A', [iatt('laco-divergente')]), aggOf('B', [])]).stop, null);
  // 2 + 2 invalid: more than 3 stop the arm, 2 + 1 do not
  assert.equal(armTotals([aggOf('A', [iatt('formato-do-diario'), iatt('laco-infra')]), aggOf('B', [iatt('formato-do-diario'), iatt('laco-infra')])]).stop, 'invalidas');
  assert.equal(armTotals([aggOf('A', [iatt('formato-do-diario'), iatt('laco-infra')]), aggOf('B', [iatt('laco-infra')])]).stop, null);
  // 1 + 1 semente-ausente
  assert.equal(armTotals([aggOf('A', [iatt('semente-ausente')]), aggOf('B', [iatt('semente-ausente')])]).stop, 'semente-ausente');
  // aggregates of different arms are refused
  assert.throws(() => armTotals([aggOf('A', []), aggOf('B', [], { restricted: false, single: true })]), UsageError);
  assert.throws(() => armTotals([]), UsageError);
  // the order of the valid attempts of the arm, across A and B, is by start time
  const order = armTotals([aggOf('A', [vatt('A', 3, ALL), vatt('A', 1, ALL)]), aggOf('B', [vatt('B', 2, ALL)])]).totals.validOrder;
  assert.deepEqual(order.map((x) => x.artifact), ['A', 'B', 'A']);
});

test('C3: a lenses aggregate records the counters of C3 and the attempt fields armTotals reads', async () => {
  const s = setup();
  try {
    const spec = () => ({ entries: [entry('E5:t3:spec1', lrv([F_SP1])), entry('E5:t3:spec-fix1', APPLIED_FIX), entry('E5:t3:spec2', lrv([])), entry('E5:t3:quality1', lrv([]))], ret: { ok: true, kind: null, msg: null, loops: cleanLoops, reviews: [], accepted: [] } });
    const r = await runBatch(lensBatch(s), { exec: makeFake(s.configDir, { afterRun: lensAfterRun(s, spec) }).exec, now: NOW });
    const g = r.aggregate;
    const a = g.attempts[0];
    assert.equal(a.status, 'valid', JSON.stringify(g.invalidReasons));
    assert.equal(a.artifact, 'A');
    assert.equal(a.startedAt, NOW().toISOString());
    assert.equal(typeof a.costUsd, 'number');
    assert.deepEqual(a.capturadoPor.SP1, { kind: 'spec', round: 1 });
    for (const k of ['failRiscoAceito', 'bloqueadoMisto', 'paradoSoSintetico', 'sinteticoGerado', 'veredictoAusente', 'capturadoSemMencao', 'bloqueouSintetico']) assert.equal(typeof g[k], 'number', k);
    assert.ok(g.capturadoPorMatriz && g.outcomesByLens);
    assert.deepEqual(g.attempts[0].loop.loops.map((l) => [l.kind, l.ok]), [['spec', true], ['quality', true]]);
    // armTotals takes the aggregate as runBatch wrote it
    assert.equal(armTotals([g]).totals.valid, 1);
  } finally {
    s.done();
  }
});


// ---- E27 C4 (T6): ruleSideC, earlyCeiling, recountLenses and the aggregate of a lenses batch ----
const { ruleSideC, earlyCeiling, recountLenses } = await import('./run-batch.mjs');

// Totals of one arm in the format of armTotals, built from 10 valid attempts (5 of A, 5 of B, interleaved) whose seeds take the
// outcomes of the pools: spec = [captured, lost, undetermined] of the 20 spec seeds, quality likewise. semMencao: how many captures
// no review names (by regex); failRisco: how many attempts carry failRiscoAceito.
function armFrom({ spec, quality, cost, semMencao = 0, failRisco = 0, single = false }) {
  // the captures come last, so that the first attempts hold the misses (an arm whose first 6 attempts capture all is the early ceiling)
  const pool = ([c, p, i]) => [...Array(i).fill('indeterminado'), ...Array(p).fill('perdido'), ...Array(c).fill('capturado')];
  const pools = { spec: pool(spec), quality: pool(quality) };
  assert.equal(pools.spec.length, 20);
  assert.equal(pools.quality.length, 20);
  let unnamed = semMencao;
  const attempts = Array.from({ length: 10 }, (_, j) => {
    const art = j % 2 === 0 ? 'A' : 'B';
    const ids = art === 'A' ? { spec: ['SP1', 'SP2'], quality: ['QL1', 'QL2'] } : { spec: ['SP3', 'SP4'], quality: ['QL3', 'QL4'] };
    const outcomes = [];
    const capturadoPor = {};
    for (const lens of ['spec', 'quality']) {
      ids[lens].forEach((id, k) => {
        const o = pools[lens][2 * j + k];
        outcomes.push(oc(id, o));
        capturadoPor[id] = o === 'capturado' && unnamed > 0 && unnamed-- ? null : { kind: single ? 'review' : lens, round: 1 };
      });
    }
    // the two arms run on other days: the keys of their attempts (artifact, start time, n) never collide
    return vatt(art, j + 1, {}, { outcomes, capturadoPor, costUsd: cost, failRiscoAceito: j >= 10 - failRisco, startedAt: `${single ? '2026-11-17' : '2026-11-16'}T10:${String(j + 1).padStart(2, '0')}:00Z` });
  });
  return armTotals([aggOf('A', attempts, { restricted: false, single })]).totals;
}
// vatt takes an outcomes map; armFrom passes the outcomes list straight (vatt spreads `extra` over its own fields)
const A_LIMITS = { spec: [18, 1, 1], quality: [18, 1, 1] };

test('C4: ruleSideC gives teto when atual has 38 or more of 40 (the unica is not looked at)', () => {
  const atual = armFrom({ spec: [19, 1, 0], quality: [19, 1, 0], cost: 0.85 });
  assert.equal(atual.capturas, 38);
  const r = ruleSideC({ atual });
  assert.equal(r.side, 'teto');
  assert.equal(ruleSideC({ atual: armFrom({ spec: [20, 0, 0], quality: [20, 0, 0], cost: 0.85 }) }).side, 'teto');
  // a unica that would lose is never read: it can even be absent or nonsense
  assert.equal(ruleSideC({ atual, unica: null }).side, 'teto');
});

test('C4: ruleSideC gives piso when atual has fewer than 20 of 40 or fewer than 32 determined', () => {
  assert.equal(ruleSideC({ atual: armFrom({ spec: [10, 4, 6], quality: [9, 5, 6], cost: 0.85 }) }).side, 'piso'); // 19 captures
  assert.equal(ruleSideC({ atual: armFrom({ spec: [15, 0, 5], quality: [15, 0, 5], cost: 0.85 }) }).side, 'piso'); // 30 captures, 30 determined
  const edge = armFrom({ spec: [10, 5, 5], quality: [10, 6, 4], cost: 0.85 }); // 20 captures, 31 determined
  assert.equal(edge.capturas, 20);
  assert.equal(edge.determinadas, 31);
  assert.equal(ruleSideC({ atual: edge }).side, 'piso');
  assert.notEqual(ruleSideC({ atual: armFrom({ spec: [10, 6, 4], quality: [10, 6, 4], cost: 0.85 }), unica: armFrom({ spec: [10, 6, 4], quality: [10, 6, 4], cost: 0.5 }) }).side, 'piso'); // 20 captures, 32 determined
});

test('C4: ruleSideC gives unica with 32+ determined, at most 2 fewer captures and at most 2 more misses in total and in each lens, and a lower cost per valid attempt', () => {
  const atual = armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.85 });
  const unica = armFrom({ spec: [17, 2, 1], quality: [18, 1, 1], cost: 0.55, single: true });
  assert.deepEqual([atual.capturas, atual.perdidos, unica.capturas, unica.perdidos], [36, 2, 35, 3]);
  const r = ruleSideC({ atual, unica });
  assert.equal(r.side, 'unica', JSON.stringify(r));
  // the boundary values still enter: 2 fewer captures and 2 more misses, in total and in a lens
  const edge = armFrom({ spec: [16, 3, 1], quality: [18, 1, 1], cost: 0.55, single: true });
  assert.equal(ruleSideC({ atual, unica: edge }).side, 'unica');
});

test('C4: ruleSideC gives atual by total captures, by lens, by cost and by the determined of the unica', () => {
  const atual = armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.85 });
  const side = (unica, a = atual) => ruleSideC({ atual: a, unica });
  // total captures: 36 against 33
  const total = side(armFrom({ spec: [17, 1, 2], quality: [16, 1, 3], cost: 0.55, single: true }));
  assert.deepEqual([total.side, total.reason], ['atual', 'capturas']);
  // one lens: quality 18 against 15 with the total 36 against 34 inside the margin
  const lens = side(armFrom({ spec: [19, 1, 0], quality: [15, 1, 4], cost: 0.55, single: true }));
  assert.deepEqual([lens.side, lens.reason], ['atual', 'capturas por lente (quality)']);
  // cost: equal or higher
  assert.deepEqual([side(armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.85, single: true })).side, side(armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.9, single: true })).reason], ['atual', 'custo']);
  // the determined of the unica: 31
  const det = side(armFrom({ spec: [16, 0, 4], quality: [15, 0, 5], cost: 0.55, single: true }));
  assert.equal(det.side, 'atual');
  assert.equal(det.reason, 'determinadas');
});

test('C4: ruleSideC gives atual by misses even when captures are within 2 (the fixture of the owner)', () => {
  const atual = armFrom({ spec: [15, 1, 4], quality: [15, 1, 4], cost: 0.85 });
  const unica = armFrom({ spec: [14, 6, 0], quality: [14, 6, 0], cost: 0.55, single: true });
  assert.deepEqual([atual.capturas, atual.perdidos, atual.indeterminados], [30, 2, 8]);
  assert.deepEqual([unica.capturas, unica.perdidos, unica.indeterminados, unica.determinadas], [28, 12, 0, 40]);
  const r = ruleSideC({ atual, unica });
  assert.deepEqual([r.side, r.reason], ['atual', 'perdidos']);
});

test('C4: ruleSideC gives atual by misses in one lens with the total within 2', () => {
  const atual = armFrom({ spec: [15, 0, 5], quality: [15, 2, 3], cost: 0.9 });
  const unica = armFrom({ spec: [15, 3, 2], quality: [15, 1, 4], cost: 0.5, single: true });
  assert.deepEqual([atual.perdidos, unica.perdidos, atual.capturas, unica.capturas], [2, 4, 30, 30]);
  assert.ok(unica.determinadas >= 32);
  const r = ruleSideC({ atual, unica });
  assert.deepEqual([r.side, r.reason], ['atual', 'perdidos por lente (spec)']);
});

test('C4: ruleSideC gives inconclusivo when the recount with capturadoSemMencao, or with the failRiscoAceito attempts of either arm, as indeterminado changes the side', () => {
  const atual = armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.85 });
  const unica = armFrom({ spec: [17, 2, 1], quality: [18, 1, 1], cost: 0.55, single: true });
  assert.equal(ruleSideC({ atual, unica }).side, 'unica');
  // 3 captures of the unica no review names: recounted, 32 captures against 36 (the side would be atual)
  const unnamed = armFrom({ spec: [17, 2, 1], quality: [18, 1, 1], cost: 0.55, single: true, semMencao: 3 });
  const a = ruleSideC({ atual, unica: unnamed });
  assert.equal(a.side, 'inconclusivo');
  assert.equal(a.recount.base.side, 'unica');
  assert.equal(a.recount.semMencao.side, 'atual');
  assert.equal(a.recount.failRisco.side, 'unica');
  // attempts of the unica with an accepted risk under a verdict that was not pass: 2 attempts out, the unica falls below 32 determined
  const risky = armFrom({ spec: [17, 2, 1], quality: [18, 1, 1], cost: 0.55, single: true, failRisco: 2 });
  const b = ruleSideC({ atual, unica: risky });
  assert.equal(b.side, 'inconclusivo');
  assert.equal(b.recount.failRisco.side, 'atual');
  // the atual arm counts too: its captures in the failRiscoAceito attempts fall and the unica enters where it did not
  const atual2 = armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.85, failRisco: 1 });
  const unica2 = armFrom({ spec: [16, 2, 2], quality: [16, 2, 2], cost: 0.55, single: true });
  assert.deepEqual([ruleSideC({ atual: armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.85 }), unica: unica2 }).side], ['atual']);
  const c = ruleSideC({ atual: atual2, unica: unica2 });
  assert.equal(c.side, 'inconclusivo', JSON.stringify(c.recount));
  assert.equal(c.recount.failRisco.side, 'unica');
  // a recount that does not move the side keeps it
  const keep = ruleSideC({ atual: armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.85, semMencao: 1 }), unica: armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.55, single: true, semMencao: 1 }) });
  assert.equal(keep.side, 'unica', JSON.stringify(keep));
  // the recount is pure: the totals given are not changed
  assert.equal(unnamed.capturas, 35);
});

test('C4: the diary reading prevails over the regex in the recount', () => {
  const atual = armFrom({ spec: [18, 1, 1], quality: [18, 1, 1], cost: 0.85 });
  const unnamed = armFrom({ spec: [17, 2, 1], quality: [18, 1, 1], cost: 0.55, single: true, semMencao: 3 });
  const unnamedKeys = unnamed.validOrder.flatMap((v) => v.captured.filter((c) => !c.regexMentioned).map((c) => [v.key, c.id]));
  assert.equal(unnamedKeys.length, 3);
  // without the reading the regex rules: 3 not named captures are recounted and the side moves
  assert.equal(ruleSideC({ atual, unica: unnamed }).side, 'inconclusivo');
  // the reading says the diary names them: nothing is recounted, the side stays
  const named = {};
  for (const [key, id] of unnamedKeys) (named[key] ??= {})[id] = true;
  const r = ruleSideC({ atual, unica: unnamed, leitura: named });
  assert.equal(r.side, 'unica', JSON.stringify(r));
  assert.equal(r.recount.semMencao.unica.capturas, 35);
  // the reading says a capture the regex matched is not named in the diary: it is recounted (and here the side moves)
  const matched = armFrom({ spec: [17, 2, 1], quality: [18, 1, 1], cost: 0.55, single: true });
  const hit = matched.validOrder.flatMap((v) => v.captured.map((c) => [v.key, c.id])).slice(0, 3);
  const notNamed = {};
  for (const [key, id] of hit) (notNamed[key] ??= {})[id] = false;
  const r2 = ruleSideC({ atual, unica: matched, leitura: notNamed });
  assert.equal(r2.side, 'inconclusivo', JSON.stringify(r2));
  assert.equal(r2.recount.semMencao.unica.capturas, 32);
  // without the reading the same attempts are all named by the regex: the side stays
  assert.equal(ruleSideC({ atual, unica: matched }).side, 'unica');
  // recountLenses on its own: pure, and the reading is keyed by attempt key and seed id
  const t = recountLenses(matched, 'semMencao', notNamed);
  assert.equal(t.capturas, 32);
  assert.equal(t.indeterminados, matched.indeterminados + 3);
  assert.equal(matched.capturas, 35);
});

test('C4: earlyCeiling gives teto with the first 6 valid attempts of atual, 3 of A and 3 of B interleaved, at 24 of 24', () => {
  const NAMED = Object.fromEntries(Object.keys(ALL).map((id) => [id, { kind: 'review', round: 1 }]));
  const full = (art, order) => vatt(art, order, ALL, { capturadoPor: NAMED });
  const totalsOf = (...atts) => armTotals([aggOf('A', atts.filter((a) => a.artifact === 'A')), aggOf('B', atts.filter((a) => a.artifact === 'B'))]).totals;
  const seq = (arts, from = 1) => arts.map((a, i) => full(a, from + i));
  assert.equal(earlyCeiling(totalsOf(...seq(['A', 'B', 'A', 'B', 'A', 'B']))), true);
  assert.equal(earlyCeiling(totalsOf(...seq(['B', 'A', 'B', 'A', 'B', 'A']))), true);
  // 23 of 24
  const miss = seq(['A', 'B', 'A', 'B', 'A', 'B']);
  miss[2] = vatt('A', 3, { ...ALL, QL2: 'perdido' });
  assert.equal(earlyCeiling(totalsOf(...miss)), false);
  // 6 valid of one artifact only, and 3 + 3 that are not interleaved
  assert.equal(earlyCeiling(totalsOf(...seq(['A', 'A', 'A', 'A', 'A', 'A']))), false);
  assert.equal(earlyCeiling(totalsOf(...seq(['A', 'A', 'A', 'B', 'B', 'B']))), false);
  // fewer than 6 valid
  assert.equal(earlyCeiling(totalsOf(...seq(['A', 'B', 'A', 'B', 'A']))), false);
  // the 24 of 24 that only shows up looking past the first 6 (no extension): 7 valid, the 1st one missed a seed, attempts 2 to 7 are 24 of 24
  const past = seq(['A', 'B', 'A', 'B', 'A', 'B', 'A']);
  past[0] = vatt('A', 1, { ...ALL, QL2: 'perdido' });
  assert.equal(earlyCeiling(totalsOf(...past)), false);
  // with an early ceiling ruleSideC says teto without looking at the unica
  const atual = totalsOf(...seq(['A', 'B', 'A', 'B', 'A', 'B']));
  const r = ruleSideC({ atual });
  assert.equal(r.side, 'teto');
  assert.match(r.reason, /antecipado/);
  // but the recount of the same 6 attempts still guards it: a failRiscoAceito attempt among them makes the arm continue to 10 valid attempts
  const risky = seq(['A', 'B', 'A', 'B', 'A', 'B']);
  risky[0] = vatt('A', 1, ALL, { failRiscoAceito: true, capturadoPor: NAMED });
  assert.equal(ruleSideC({ atual: totalsOf(...risky) }).side, 'continua');
  assert.equal(earlyCeiling(null), false);
});

test('C4: the early ceiling is checked on the totals recounted with the reading of the diary: it stands with a confirmed capture, otherwise the arm continues (never a piso from 6 attempts)', () => {
  const NAMED = Object.fromEntries(Object.keys(ALL).map((id) => [id, { kind: 'review', round: 1 }]));
  const totalsOf = (...atts) => armTotals([aggOf('A', atts.filter((a) => a.artifact === 'A')), aggOf('B', atts.filter((a) => a.artifact === 'B'))]).totals;
  // 24 of 24, one capture that no review names by regex
  const six = ['A', 'B', 'A', 'B', 'A', 'B'].map((a, i) => vatt(a, i + 1, ALL, { capturadoPor: i === 0 ? { ...NAMED, SP1: null } : NAMED }));
  const atual = totalsOf(...six);
  assert.equal(earlyCeiling(atual), true);
  const key = atual.validOrder[0].key;
  // the reading of the diary confirms the capture: the early ceiling stands
  const kept = ruleSideC({ atual, leitura: { [key]: { SP1: true } } });
  assert.equal(kept.side, 'teto');
  assert.match(kept.reason, /antecipado/);
  // the reading denies it (or the regex stands with no reading): not an early ceiling, the arm continues to 10 valid attempts
  for (const leitura of [{ [key]: { SP1: false } }, {}]) {
    const r = ruleSideC({ atual, leitura });
    assert.equal(r.side, 'continua', JSON.stringify(leitura));
    assert.notEqual(r.side, 'piso');
    assert.match(r.reason, /10 validas/);
  }
});

test('C4: continua ends at 10 valid attempts: the 40-opportunity rule applies, never continua again and never an early teto', () => {
  const NAMED = Object.fromEntries(Object.keys(ALL).map((id) => [id, { kind: 'review', round: 1 }]));
  const totalsOf = (...atts) => armTotals([aggOf('A', atts.filter((a) => a.artifact === 'A')), aggOf('B', atts.filter((a) => a.artifact === 'B'))]).totals;
  const arts = ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'];
  // the first 6 capture 24 of 24 (the first capture unnamed by regex); the last 4 capture only SP1 (28 of 40)
  const tail = { SP1: 'capturado', SP2: 'perdido', QL1: 'perdido', QL2: 'perdido' };
  const build = (lastOutcomes, unnamedFirst) => arts.map((a, i) => vatt(a, i + 1, i < 6 ? ALL : lastOutcomes, { capturadoPor: i === 0 && unnamedFirst ? { ...NAMED, SP1: null } : NAMED }));
  const ten = totalsOf(...build(tail, true));
  assert.equal(ten.valid, 10);
  assert.equal(ten.capturas, 28);
  assert.equal(earlyCeiling(ten), true); // raw early ceiling still holds on the first 6
  const key = ten.validOrder[0].key;
  // 10 valid, 28 of 40, the reading denies or the regex stands: not continua, and the normal rule asks for the unica (28 is neither teto nor piso)
  for (const leitura of [{}, { [key]: { SP1: false } }]) assert.throws(() => ruleSideC({ atual: ten, leitura }), /unica/);
  // the reading confirms the capture at 10 valid with 28 of 40: not a teto (the early ceiling does not apply from 10 valid)
  assert.throws(() => ruleSideC({ atual: ten, leitura: { [key]: { SP1: true } } }), /unica/);
  const unica = armFrom({ spec: [14, 4, 2], quality: [14, 4, 2], cost: 0.5, single: true });
  const withUnica = ruleSideC({ atual: ten, unica, leitura: { [key]: { SP1: true } } });
  assert.notEqual(withUnica.side, 'continua');
  assert.notEqual(withUnica.side, 'teto');
  // 10 valid at 40 of 40: teto by the 38 rule, not by the early ceiling; one unnamed capture (39) still teto
  const all = totalsOf(...build(ALL, true));
  for (const leitura of [{}, { [key]: { SP1: true } }]) {
    const r = ruleSideC({ atual: all, leitura });
    assert.equal(r.side, 'teto');
    assert.doesNotMatch(r.reason, /antecipado/);
  }
});

test('C4: a failRiscoAceito attempt among the first 6 with the early ceiling holding continues instead of closing the pass at 6 attempts', () => {
  const NAMED = Object.fromEntries(Object.keys(ALL).map((id) => [id, { kind: 'review', round: 1 }]));
  const totalsOf = (...atts) => armTotals([aggOf('A', atts.filter((a) => a.artifact === 'A')), aggOf('B', atts.filter((a) => a.artifact === 'B'))]).totals;
  const six = ['A', 'B', 'A', 'B', 'A', 'B'].map((a, i) => vatt(a, i + 1, ALL, { capturadoPor: NAMED, failRiscoAceito: i === 2 }));
  const atual = totalsOf(...six);
  assert.equal(earlyCeiling(atual), true);
  assert.equal(earlyCeiling(recountLenses(atual, 'failRisco')), false);
  const r = ruleSideC({ atual });
  assert.equal(r.side, 'continua');
  assert.match(r.reason, /10 validas/);
  // the same together with an unnamed capture: still continua
  const six2 = six.map((a, i) => (i === 0 ? { ...a, capturadoPor: { ...NAMED, SP1: null } } : a));
  assert.equal(ruleSideC({ atual: totalsOf(...six2) }).side, 'continua');
});

test('C3: semente-ausente is checked after settleSandbox: a root left on main with feat/E5 held by a release worktree is still valid', async () => {
  const s = setup();
  try {
    const left = (cwd) => {
      gitq(cwd, 'checkout', '-q', '-B', 'release/sandbox', 'main');
      gitq(cwd, 'checkout', '-q', 'main');
      gitq(cwd, 'worktree', 'add', join(cwd, '..', 'release-wt-lens'), 'feat/E5');
    };
    const spec = () => ({ after: left, entries: [entry('E5:t3:spec1', lrv([])), entry('E5:t3:quality1', lrv([]))], ret: { ok: true, kind: null, msg: null, loops: cleanLoops, reviews: [], accepted: [] } });
    const r = await runBatch(lensBatch(s), { exec: makeFake(s.configDir, { afterRun: lensAfterRun(s, spec) }).exec, now: NOW });
    assert.equal(r.aggregate.attempts[0].status, 'valid', JSON.stringify(r.aggregate.invalidReasons));
  } finally {
    s.done();
  }
});

test('C4: the aggregate of a lenses batch records harness.taskReview, kinds, outcomesByLens and the counters of C3', async () => {
  for (const arm of ['atual', 'unica']) {
    const s = setup();
    try {
      const loops = arm === 'atual' ? cleanLoops : [{ kind: 'review', ok: true, stop: null, accepted: [] }];
      const entries = arm === 'atual' ? [entry('E5:t3:spec1', lrv([])), entry('E5:t3:quality1', lrv([]))] : [entry('E5:t3:review1', lrv([]))];
      const spec = () => ({ entries, ret: { ok: true, kind: null, msg: null, loops, reviews: [], accepted: [] } });
      const r = await runBatch(lensBatch(s, arm), { exec: makeFake(s.configDir, { afterRun: lensAfterRun(s, spec) }).exec, now: NOW });
      const g = r.aggregate;
      assert.equal(g.valid, 1, JSON.stringify(g.invalidReasons));
      assert.deepEqual(g.harness.taskReview, { restricted: false, single: arm === 'unica' });
      assert.deepEqual(g.harness.kinds, arm === 'unica' ? ['review'] : ['spec', 'quality']);
      assert.deepEqual(Object.keys(g.outcomesByLens), ['spec', 'quality']);
      assert.equal(g.outcomesByLens.spec.perdido + g.outcomesByLens.quality.perdido, 4);
      for (const k of ['failRiscoAceito', 'bloqueadoMisto', 'paradoSoSintetico', 'sinteticoGerado', 'veredictoAusente', 'capturadoSemMencao', 'bloqueouSintetico']) assert.equal(g[k], 0, k);
      assert.deepEqual(Object.keys(g.capturadoPorMatriz), [...g.harness.kinds, 'semMencao']);
      assert.equal(typeof g.costPerValid, 'number');
      assert.equal(g.stoppedBy, undefined);
      assert.equal(g.harness.reviewModel, 'sonnet');
    } finally {
      s.done();
    }
  }
});
