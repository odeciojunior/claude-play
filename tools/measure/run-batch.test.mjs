import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { redactPaths, runBatch, buildQuestionsScript, toAttemptCounters, sumCliCost, rolesByLabel, readJournal, checkValidity, releaseRunValidity, resumeRunValidity, ratifyE5Contract, execEnv, e5Integrated, readPlugin, readPanel, panelMatches, PANEL_VARIANTS, EXPECTED_PANEL } from './run-batch.mjs';
import { E5_PATHS, NATIVE_PATHS, seedSourceOf } from './make-scenario.mjs';

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
  for (const v of ['completo', 'parada-retomada']) {
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
      await assert.rejects(runBatch(seededOpts(none, 'plano-semeado-A', { stage: 'plan-review' }), { exec: makeFake(none.configDir).exec, now: NOW }), UsageError);
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

test('A2: no {{ placeholder is left in any generated prompt (every stage, variant and arm; {{issues}} only in the fixer); the check fragment only in plano-nativo', async () => {
  const s = setup();
  try {
    const combos = [
      ...['spec-semeado-A', 'spec-semeado-B', 'spec-nativo-A', 'spec-nativo-B', 'plano-semeado-A', 'plano-semeado-B', 'plano-nativo-A', 'plano-nativo-B'].map((v) => [v, {}]),
      ...['codigo-semeado-A', 'codigo-semeado-B'].map((v) => [v, { stage: 'task-review', reviewModel: 'sonnet' }]),
      ...['spec-semeado-A', 'spec-nativo-A', 'plano-semeado-A', 'plano-nativo-B'].map((v) => [v, { rounds: 'loop' }]),
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
