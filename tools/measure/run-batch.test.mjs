import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runBatch, toAttemptCounters, readJournal, checkValidity, releaseRunValidity, execEnv } from './run-batch.mjs';
import { E5_PATHS, seedSourceOf } from './make-scenario.mjs';

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

const JOURNALS = join(here, 'fixtures', 'journals');
const gitIn = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=fab', '-c', 'user.email=fab@example.invalid', ...a], { cwd, encoding: 'utf8' });

// Fake executor: claude -p copies fabricated transcripts (and optionally a journal fixture), the extractor
// and git run for real. Options: journal (fixture name, or a function of the call number), afterRun(cwd, n)
// (changes the sandbox like the run would), stopResume (the first claude -p waits for the abort and the
// simulated git log answers with the stop commit on its second query), failOn (call number that fails).
function makeFake(configDir, { denyOn, journal, afterRun, stopResume, failOn } = {}) {
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
    for (const a of ['afab101', 'afab102']) {
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
    const r = await runBatch(baseOpts(s, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: fake.exec, now: NOW });
    const claudeP = fake.calls.filter((c) => c.cmd === 'claude' && c.args[0] === '-p');
    assert.equal(claudeP.length, 2);
    assert.match(claudeP[0].args[1], /run E5$/);
    assert.match(claudeP[1].args[1], /resume E5$/);
    const priv = JSON.parse(readFileSync(join(r.dir, 'private', 'attempts.json'), 'utf8'));
    assert.equal(priv.attempts.length, 1);
    assert.deepEqual(priv.attempts[0].sessions, [sid(1), sid(2)]);
    assert.equal(fake.calls.filter((c) => c.args[0]?.endsWith('session-metrics.mjs')).length, 1);
    assert.equal(r.aggregate.valid, 1);
    assert.equal(r.exitCode, 0);
    // a resumed session that does not finish makes the attempt invalid
    const s2 = setup();
    try {
      const failing = makeFake(s2.configDir, { stopResume: true, failOn: 2 });
      const r2 = await runBatch(baseOpts(s2, { variant: 'parada-retomada', runs: 1, pollMs: 1 }), { exec: failing.exec, now: NOW });
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
    assert.deepEqual(r.aggregate.harness, { stage: 'plan-review', arm: 'atual', armSource: 'copia-do-prompt', workflowCommit: sha });
    const sent = fake.calls.find((c) => c.cmd === 'claude' && c.args[0] === '-p');
    const scriptText = readFileSync(join(sent.cwd, 'review-only.js'), 'utf8');
    assert.ok(!scriptText.includes('Copied from:'));
    assert.ok(!scriptText.includes('{{artifactPath}}'));

    const code = makeFake(s.configDir, { journal: jl({ label: 'E5:task-review1', result: { issues: [] } }), afterRun: mergeE5 });
    const rc = await runBatch(seededOpts(s, 'codigo-semeado-A', { stage: 'task-review', work: join(s.base, 'work2') }), {
      exec: code.exec,
      now: () => new Date('2026-11-10T12:00:05Z'),
    });
    assert.deepEqual(rc.aggregate.harness, { stage: 'task-review', arm: 'atual', armSource: 'workflow', workflowCommit: null });
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
