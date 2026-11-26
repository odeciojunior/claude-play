// Offline and free: the batch folders are built by hand (or by runBatch with a fake exec that never forwards claude).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { LIMITS, checkAuthorization, costOfTranscripts, checkSums, gate, main } from './lote-gate.mjs';
import { runBatch } from './run-batch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, 'lote-gate.mjs');
const COMMIT = 'abcdef0123456789abcdef0123456789abcdef01';
const OPUS = 'claude-opus-5-5';
const SENTENCE = `Lote no commit ${COMMIT.slice(0, 7)}, teto US$ 18,00.`;
const HEADER = '| ID | Data | Entregável | Decisão | Alternativa descartada | Contradiz | Revisitar quando | Origem | Status |';

// ---- helpers ----

function tmp(t) {
  const base = mkdtempSync(join(tmpdir(), 'lote-gate-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  return base;
}

const row = ({ id = 'DEC-100', deliverable = 'E53', decision = SENTENCE, origin = 'dono', status = 'vigente' } = {}) =>
  `| ${id} | 2026-11-26 | ${deliverable} | ${decision} | outra \\| coisa | - | - | ${origin} | ${status} |`;

const decisionsText = (...rows) =>
  ['# Decisões', '', '<!-- roadmap:decisions -->', HEADER, '|---|---|---|---|---|---|---|---|---|', ...(rows.length ? rows : [row()]), '<!-- /roadmap:decisions -->', ''].join('\n');

// An empty batch folder beside a valid decisions.md.
function lot(t, text = decisionsText()) {
  const base = tmp(t);
  const out = join(base, 'out');
  mkdirSync(out);
  const decisions = join(base, 'decisions.md');
  writeFileSync(decisions, text);
  const opts = { out, commit: COMMIT, autorizacao: 'DEC-100', decisions };
  return { base, out, decisions, opts, run: () => gate(opts) };
}

// opus output costs US$ 20 per million tokens in prices.json, so the transcript cost of a message is exact.
const message = ({ usd = 0.5, model = OPUS } = {}) => ({
  type: 'assistant',
  message: { id: `msg_${randomUUID()}`, role: 'assistant', model, content: [], usage: { input_tokens: 0, output_tokens: Math.round((usd * 1e6) / 20) } },
});
const userLine = { type: 'user', message: { role: 'user', content: 'run E5' } };
const jsonl = (lines) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';

function writeSession(dir, { id = randomUUID(), lines, usd = 0.5, agents = [] } = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.jsonl`), jsonl(lines ?? [userLine, message({ usd })]));
  if (agents.length) {
    const sub = join(dir, id, 'subagents');
    mkdirSync(sub, { recursive: true });
    agents.forEach((a, i) => {
      writeFileSync(join(sub, `agent-${i}.jsonl`), jsonl(a));
      writeFileSync(join(sub, `agent-${i}.meta.json`), JSON.stringify({ description: 'E5:spec' }));
    });
  }
  return id;
}

function seal(dir) {
  const paths = existsSync(join(dir, 'aggregate.json')) ? ['aggregate.json'] : [];
  const walk = (rel) => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${rel}/${e.name}`);
      else paths.push(`${rel}/${e.name}`);
    }
  };
  walk('private');
  writeFileSync(join(dir, 'SHA256SUMS'), paths.sort().map((p) => `${createHash('sha256').update(readFileSync(join(dir, p))).digest('hex')}  ${p}\n`).join(''));
}

const STRUCTURAL = { haiku: 2, sonnet: 3, opus: 1, fable: 0, other: 0, weighted: 102 };
let stampCount = 0;

// One run folder in the layout of the harness. attempt/aggregate override fields (undefined removes them in the JSON).
function writeRun(out, { attempt = {}, aggregate = {}, sessions = [{}], agents = { discovery: {}, 'spec-load1': {} }, metrics, listed, privateAttempts = true, noAggregate = false } = {}) {
  stampCount += 1;
  const name = `parada-retomada-20261126-${String(120000 + stampCount)}`;
  const dir = join(out, name);
  const priv = join(dir, 'private');
  mkdirSync(priv, { recursive: true });
  const ids = sessions.map((s) => writeSession(join(priv, 'transcripts', '1'), s));
  const entry = { n: 1, status: 'valid', integrated: true, costUsd: 1, counters: { structural: STRUCTURAL }, sessionModels: { parada: 'opus', retomada: 'opus' }, modelDivergence: false, ...attempt };
  const agg = {
    variant: 'parada-retomada', requested: 1, requestedModel: 'opus', plugin: { version: '9.9.9', commit: COMMIT },
    superpowers: { version: '5.0.0', commit: 'ausente' }, cli: '2.1.0 (Claude Code)', permissionMode: 'acceptEdits', attempts: [entry], ...aggregate,
  };
  if (!noAggregate) writeFileSync(join(dir, 'aggregate.json'), JSON.stringify(agg, null, 2) + '\n');
  if (privateAttempts) writeFileSync(join(priv, 'attempts.json'), JSON.stringify({ attempts: [{ n: 1, sessions: listed ?? ids }] }));
  mkdirSync(join(priv, 'metrics', '1'), { recursive: true });
  writeFileSync(join(priv, 'metrics', '1', 'metrics.json'), metrics ?? JSON.stringify({ runs: [{ agents }] }));
  seal(dir);
  return { name, dir, ids };
}

const valid = (out, costUsd = 1, extra = {}) => writeRun(out, { ...extra, attempt: { costUsd, ...extra.attempt } });
const denied = (out, usd = 0.5, extra = {}) =>
  writeRun(out, { privateAttempts: false, sessions: [{ usd }], ...extra, attempt: { status: 'denied', integrated: undefined, costUsd: undefined, counters: undefined, sessionModels: undefined, ...extra.attempt } });

// ---- authorization ----

test('LIMITS holds the constants of DEC-017', () => {
  assert.deepEqual(LIMITS, { capUsd: 18, perRunUsd: 6, reserveUsd: 5.5, validGoal: 3, invalidLimit: 2 });
});

test('authorization is accepted from the two origins and with the cap at the end of a sentence', () => {
  for (const r of [
    row(),
    row({ origin: 'dono (delegado, opus)' }),
    row({ decision: `Commit ${COMMIT} autorizado com teto de US$ 18.` }),
    row({ decision: `Teto US$ 18 \\| commit ${COMMIT.slice(0, 12)}` }),
  ]) {
    assert.deepEqual(checkAuthorization({ decisionsText: decisionsText(row({ id: 'DEC-099' }), r), id: 'DEC-100', commit: COMMIT }), { ok: true, why: 'ok' }, r);
  }
});

test('authorization columns are found by the header, whatever their order', () => {
  const text = ['<!-- roadmap:decisions -->', '| Status | Origem | Decisão | Entregável | ID |', '|---|---|---|---|---|', `| vigente | dono | ${SENTENCE} | E53 | DEC-100 |`, '<!-- /roadmap:decisions -->'].join('\r\n');
  assert.equal(checkAuthorization({ decisionsText: text, id: 'DEC-100', commit: COMMIT }).ok, true);
});

const REFUSALS = {
  'missing id': decisionsText(row({ id: 'DEC-101' })),
  'other deliverable': decisionsText(row({ deliverable: 'E52' })),
  pendente: decisionsText(row({ status: 'pendente' })),
  'delegated to Fable': decisionsText(row({ origin: 'dono (delegado, Fable)' })),
  'without the SHA': decisionsText(row({ decision: 'Lote autorizado, teto US$ 18,00.' })),
  'another SHA': decisionsText(row({ decision: 'Lote no commit 1234567, teto US$ 18,00.' })),
  'SHA shorter than 7': decisionsText(row({ decision: `Lote no commit ${COMMIT.slice(0, 6)}, teto US$ 18,00.` })),
  'without the cap': decisionsText(row({ decision: `Lote no commit ${COMMIT.slice(0, 7)}.` })),
  'cap US$ 180': decisionsText(row({ decision: `Commit ${COMMIT.slice(0, 7)}, teto US$ 180.` })),
  'cap US$ 18,50': decisionsText(row({ decision: `Commit ${COMMIT.slice(0, 7)}, teto US$ 18,50.` })),
  'cap US$ 18.5': decisionsText(row({ decision: `Commit ${COMMIT.slice(0, 7)}, teto US$ 18.5` })),
  'repeated id': decisionsText(row(), row()),
  'row outside the table': `${decisionsText(row({ id: 'DEC-101' }))}\n${row()}\n`,
  'no table': `# Decisões\n\n${HEADER}\n${row()}\n`,
  'column missing': decisionsText().replace('| Status |', '| Estado |'),
};

for (const [name, text] of Object.entries(REFUSALS)) {
  test(`authorization refused (${name}): parar before the first run`, (t) => {
    const a = checkAuthorization({ decisionsText: text, id: 'DEC-100', commit: COMMIT });
    assert.equal(a.ok, false);
    assert.ok(a.why.length > 0);
    const r = lot(t, text).run();
    assert.equal(r.verdict, 'parar');
    assert.match(r.reason, /autorização/);
    assert.deepEqual(r.executions, []);
    assert.equal(r.nextMaxBudgetUsd, null);
  });
}

test('an unreadable decisions.md is parar, without its path in the reason', (t) => {
  const l = lot(t);
  const r = gate({ ...l.opts, decisions: join(l.base, 'nao-existe.md') });
  assert.equal(r.verdict, 'parar');
  assert.match(r.reason, /autorização/);
  assert.ok(!r.reason.includes('lote-gate-'));
});

test('an empty batch with a valid authorization may go on with US$ 3.00', (t) => {
  const l = lot(t);
  writeFileSync(join(l.out, 'parada-retomada-arquivo.txt'), 'not a folder');
  mkdirSync(join(l.out, 'completo-20261126-120000'));
  assert.deepEqual(l.run(), { executions: [], valid: 0, invalid: 0, accumulatedUsd: 0, verdict: 'pode-seguir', reason: 'ok', nextMaxBudgetUsd: '3.00' });
});

// ---- valid runs, counters and repetition labels ----

test('a valid run reports counters, models and repetition labels', (t) => {
  const l = lot(t);
  const agents = Object.fromEntries(['spec-load2', 'spec-load1', 'spec-load2-head', 'discovery-retry3', 'preflight:reread-g0', 't1:impl'].map((k) => [k, { calls: 1 }]));
  const { name } = valid(l.out, 1.25, { agents });
  const r = l.run();
  assert.deepEqual(r.executions, [
    {
      folder: name, class: 'valida', status: 'valid', costUsd: 1.25,
      counters: { haiku: 2, sonnet: 3, opus: 1, weighted: 102, weightedNoHaiku: 100 },
      sessionModels: { parada: 'opus', retomada: 'opus' }, modelDivergence: false, caveat: false,
      repeatLabels: ['discovery-retry3', 'preflight:reread-g0', 'spec-load2'],
    },
  ]);
  assert.equal(r.valid, 1);
  assert.equal(r.invalid, 0);
  assert.equal(r.accumulatedUsd, 1.25);
  assert.equal(r.verdict, 'pode-seguir', r.reason);
});

test('repetition labels cover load2 to load5 and -retry<n> at the end only', (t) => {
  const l = lot(t);
  const keys = ['a-load5', 'a-load6', 'a-load12', 'x-retry12', 'x-retry', 'x-retry1-head', 'plan'];
  valid(l.out, 1, { agents: Object.fromEntries(keys.map((k) => [k, {}])) });
  assert.deepEqual(l.run().executions[0].repeatLabels, ['a-load5', 'x-retry12']);
});

test('unreadable metrics.json or a valid run without counters or models is parar', (t) => {
  for (const [extra, why] of [
    [{ metrics: '{' }, /metrics\.json/],
    [{ metrics: '{"runs":[]}' }, /metrics\.json/],
    [{ attempt: { counters: undefined } }, /contadores/],
    [{ attempt: { counters: { structural: { haiku: 1, sonnet: 1, opus: 1 } } } }, /contadores/],
    [{ attempt: { sessionModels: undefined } }, /sessionModels/],
  ]) {
    const l = lot(t);
    valid(l.out, 1, extra);
    const r = l.run();
    assert.equal(r.verdict, 'parar');
    assert.match(r.reason, why);
  }
});

test('model divergence: one phase outside opus is a caveat, both are parar, a null phase does not count', (t) => {
  for (const [sessionModels, caveat, verdict] of [
    [{ parada: 'opus', retomada: 'sonnet' }, true, 'pode-seguir'],
    [{ parada: 'sonnet', retomada: 'opus' }, true, 'pode-seguir'],
    [{ parada: 'sonnet', retomada: null }, true, 'pode-seguir'],
    [{ parada: 'opus', retomada: null }, false, 'pode-seguir'],
    [{ parada: 'sonnet', retomada: 'haiku' }, true, 'parar'],
  ]) {
    const l = lot(t);
    valid(l.out, 1, { attempt: { sessionModels, modelDivergence: caveat } });
    const r = l.run();
    assert.equal(r.verdict, verdict, JSON.stringify(sessionModels));
    assert.equal(r.executions[0].caveat, caveat, JSON.stringify(sessionModels));
    assert.deepEqual(r.executions[0].sessionModels, sessionModels);
    assert.equal(r.valid, 1);
  }
});

// ---- SHA256SUMS and incomplete folders ----

const breaks = {
  tampered: (dir) => writeFileSync(join(dir, 'aggregate.json'), readFileSync(join(dir, 'aggregate.json'), 'utf8') + ' '),
  missing: (dir) => rmSync(join(dir, 'SHA256SUMS')),
  'uncovered private file': (dir) => writeFileSync(join(dir, 'private', 'extra.log'), 'x'),
  'uncovered aggregate': (dir) => writeFileSync(join(dir, 'SHA256SUMS'), readFileSync(join(dir, 'SHA256SUMS'), 'utf8').split('\n').filter((x) => !x.endsWith('  aggregate.json')).join('\n')),
  'line for an absent file': (dir) => writeFileSync(join(dir, 'SHA256SUMS'), `${'0'.repeat(64)}  private/ausente.log\n`, { flag: 'a' }),
  'path leaving the folder': (dir) => {
    writeFileSync(join(dir, '..', 'fora.txt'), 'x');
    writeFileSync(join(dir, 'SHA256SUMS'), `${createHash('sha256').update('x').digest('hex')}  ../fora.txt\n`, { flag: 'a' });
  },
  'malformed line': (dir) => writeFileSync(join(dir, 'SHA256SUMS'), 'nada\n', { flag: 'a' }),
};

for (const [name, spoil] of Object.entries(breaks)) {
  test(`SHA256SUMS ${name}: parar, not counted as valid, transcript cost shown`, (t) => {
    const l = lot(t);
    const run = valid(l.out, 1, { sessions: [{ usd: 0.75 }] });
    assert.deepEqual(checkSums(run.dir), { ok: true, why: 'ok' });
    spoil(run.dir);
    assert.equal(checkSums(run.dir).ok, false);
    const r = l.run();
    assert.equal(r.verdict, 'parar');
    assert.equal(r.valid, 0);
    assert.match(r.reason, /SHA256SUMS/);
    assert.match(r.reason, /transcrições: US\$ 0\.750000/);
    assert.ok(!r.reason.includes(run.ids[0]) && !r.reason.includes(l.base));
  });
}

test('a folder without aggregate.json is incompleta and its transcripts enter the total', (t) => {
  const l = lot(t);
  const run = writeRun(l.out, { noAggregate: true, privateAttempts: false, sessions: [{ usd: 1.5 }] });
  writeSession(join(run.dir, 'private', 'transcripts', '2'), { usd: 0.25 });
  const r = l.run();
  assert.deepEqual(r.executions, [{ folder: run.name, class: 'incompleta', status: null, costUsd: 1.75 }]);
  assert.equal(r.accumulatedUsd, 1.75);
  assert.equal(r.verdict, 'parar');
  assert.match(r.reason, /aggregate\.json/);
  assert.match(r.reason, /US\$ 1\.750000/);
  assert.equal(r.valid, 0);
  assert.equal(r.invalid, 0);
});

test('an incomplete folder with an unpriced transcript has an unknown cost', (t) => {
  const l = lot(t);
  writeRun(l.out, { noAggregate: true, privateAttempts: false, sessions: [{ lines: [userLine] }] });
  const r = l.run();
  assert.equal(r.executions[0].costUsd, null);
  assert.equal(r.verdict, 'parar');
  assert.match(r.reason, /desconhecido/);
});

test('an unreadable aggregate.json is incompleta', (t) => {
  const l = lot(t);
  const run = valid(l.out);
  writeFileSync(join(run.dir, 'aggregate.json'), '{');
  seal(run.dir);
  const r = l.run();
  assert.equal(r.executions[0].class, 'incompleta');
  assert.equal(r.verdict, 'parar');
});

// ---- contract ----

for (const [name, extra, why] of [
  ['variant', { aggregate: { variant: 'completo' } }, /variant/],
  ['requested', { aggregate: { requested: 2 } }, /requested/],
  ['two attempts', { aggregate: { attempts: [{ n: 1, status: 'valid' }, { n: 2, status: 'valid' }] } }, /tentativa/],
  ['no attempt', { aggregate: { attempts: [] } }, /tentativa/],
  ['requestedModel', { aggregate: { requestedModel: 'sonnet' } }, /requestedModel/],
  ['plugin.commit', { aggregate: { plugin: { version: '9.9.9', commit: '1'.repeat(40) } } }, /plugin\.commit/],
  ['cli absent', { aggregate: { cli: undefined } }, /cli/],
]) {
  test(`contract: ${name} off is parar`, (t) => {
    const l = lot(t);
    valid(l.out, 1, extra);
    const r = l.run();
    assert.equal(r.verdict, 'parar');
    assert.match(r.reason, why);
    assert.equal(r.executions.length, 1);
  });
}

for (const [name, aggregate, why] of [
  ['cli', { cli: '2.2.0 (Claude Code)' }, /cli/],
  ['superpowers.version', { superpowers: { version: '5.0.1', commit: 'ausente' } }, /superpowers/],
  ['superpowers.commit', { superpowers: { version: '5.0.0', commit: '2'.repeat(40) } }, /superpowers/],
  ['permissionMode', { permissionMode: 'bypassPermissions' }, /permissionMode/],
]) {
  test(`contract: ${name} different between two runs is parar`, (t) => {
    const l = lot(t);
    valid(l.out);
    const second = valid(l.out, 1, { aggregate });
    const r = l.run();
    assert.equal(r.verdict, 'parar');
    assert.match(r.reason, why);
    assert.ok(r.reason.includes(second.name));
    assert.equal(r.executions.length, 2);
  });
}

// ---- invalid and denied ----

test('a denied run without attempts.json is invalida with the cost of its transcripts; two of them close the batch', (t) => {
  const l = lot(t);
  const first = denied(l.out, 0.4);
  let r = l.run();
  assert.deepEqual(r.executions, [{ folder: first.name, class: 'invalida', status: 'denied', costUsd: 0.4 }]);
  assert.equal(r.invalid, 1);
  assert.equal(r.accumulatedUsd, 0.4);
  assert.equal(r.verdict, 'pode-seguir', r.reason);
  denied(l.out, 0.6, { privateAttempts: true, attempt: { status: 'invalid', reason: 'retomada-incompleta' } });
  r = l.run();
  assert.equal(r.invalid, 2);
  assert.equal(r.accumulatedUsd, 1);
  assert.equal(r.verdict, 'fechar', r.reason);
  assert.match(r.reason, /inválidas/);
  assert.equal(r.nextMaxBudgetUsd, null);
});

test('a valid run without integration is parar', (t) => {
  const l = lot(t);
  valid(l.out, 1, { attempt: { integrated: false } });
  const r = l.run();
  assert.equal(r.executions[0].class, 'valida-sem-integracao');
  assert.equal(r.valid, 0);
  assert.equal(r.verdict, 'parar');
  assert.match(r.reason, /integra/);
});

test('an invalid run without a session costs zero, is parar and does not count as invalid', (t) => {
  const l = lot(t);
  denied(l.out, 0, { sessions: [], privateAttempts: true, attempt: { status: 'invalid', reason: 'preflight-processo-matador' } });
  const r = l.run();
  assert.equal(r.executions[0].class, 'invalida-sem-sessao');
  assert.equal(r.executions[0].costUsd, 0);
  assert.equal(r.invalid, 0);
  assert.equal(r.verdict, 'parar');
  assert.match(r.reason, /sem sessão/);
});

test('an unknown status is parar and its transcripts enter the total', (t) => {
  const l = lot(t);
  valid(l.out, 1, { attempt: { status: 'running' }, sessions: [{ usd: 0.3 }] });
  const r = l.run();
  assert.equal(r.verdict, 'parar');
  assert.match(r.reason, /status/);
  assert.equal(r.accumulatedUsd, 0.3);
  assert.equal(r.valid, 0);
  assert.equal(r.invalid, 0);
});

test('a valid run needs a numeric costUsd and its own transcripts', (t) => {
  for (const [extra, why] of [
    [{ attempt: { costUsd: undefined } }, /costUsd/],
    [{ attempt: { costUsd: '1' } }, /costUsd/],
    [{ sessions: [] }, /sem sessão/],
  ]) {
    const l = lot(t);
    writeRun(l.out, extra);
    const r = l.run();
    assert.equal(r.verdict, 'parar');
    assert.match(r.reason, why);
  }
});

const UNKNOWN_COSTS = {
  unpriced: { lines: [userLine, message(), message({ model: 'claude-mystery-1' })] },
  'main without cost': { lines: [userLine] },
  'agent without cost': { agents: [[userLine]] },
};

for (const [name, session] of Object.entries(UNKNOWN_COSTS)) {
  test(`unknown transcript cost (${name}) is parar for a valid and for a denied run`, (t) => {
    for (const build of [(l) => writeRun(l.out, { sessions: [session] }), (l) => denied(l.out, 0, { sessions: [session] })]) {
      const l = lot(t);
      const run = build(l);
      const c = costOfTranscripts(join(run.dir, 'private', 'transcripts', '1'));
      assert.equal(c.usd, null);
      assert.equal(c.sessions, 1);
      assert.ok(c.why);
      assert.deepEqual(c.unpriced, name === 'unpriced' ? ['other'] : []);
      const r = l.run();
      assert.equal(r.verdict, 'parar');
      assert.match(r.reason, /desconhecido/);
    }
  });
}

test('a session folder with subagents and no .jsonl makes the cost unknown', (t) => {
  const l = lot(t);
  const run = valid(l.out);
  const dir = join(run.dir, 'private', 'transcripts', '1');
  mkdirSync(join(dir, randomUUID(), 'subagents'), { recursive: true });
  const c = costOfTranscripts(dir);
  assert.equal(c.usd, null);
  assert.match(c.why, /subagent/);
  assert.equal(l.run().verdict, 'parar');
});

test('a session listed in attempts.json without its transcript is parar', (t) => {
  const l = lot(t);
  const gone = randomUUID();
  const run = valid(l.out, 1, { listed: [gone] });
  const r = l.run();
  assert.equal(r.verdict, 'parar');
  assert.match(r.reason, /attempts\.json/);
  assert.ok(!r.reason.includes(gone) && !r.reason.includes(run.ids[0]));
});

test('costOfTranscripts sums main and agents, in the harness layout and in the flat one, and returns no id or path', (t) => {
  const base = tmp(t);
  for (const dir of [join(base, 'a', 'private', 'transcripts', '1'), join(base, 'b', 'private', 'transcripts')]) {
    const ids = [writeSession(dir, { usd: 1, agents: [[userLine, message({ usd: 0.5 })]] }), writeSession(dir, { usd: 0.25 })];
    const c = costOfTranscripts(dir);
    assert.deepEqual(c, { usd: 1.75, sessions: 2, unpriced: [], why: null });
    assert.ok(!ids.some((id) => JSON.stringify(c).includes(id)));
  }
  assert.deepEqual(costOfTranscripts(join(base, 'nada')), { usd: 0, sessions: 0, unpriced: [], why: null });
  const doubled = costOfTranscripts(join(base, 'b', 'private', 'transcripts'), { prices: { models: { opus: { input: 8, output: 40, cacheRead: 0.4 } }, cacheWrite5m: 1.25, cacheWrite1h: 2 } });
  assert.equal(doubled.usd, 3.5);
});

// ---- cost caps ----

test('US$ 6.00 in one run is accepted and US$ 6.01 stops, by costUsd and by transcripts', (t) => {
  for (const [build, verdict] of [
    [(out) => valid(out, 6), 'pode-seguir'],
    [(out) => valid(out, 6.01), 'parar'],
    [(out) => valid(out, 1, { sessions: [{ usd: 6 }] }), 'pode-seguir'],
    [(out) => valid(out, 1, { sessions: [{ usd: 6.01 }] }), 'parar'],
    [(out) => denied(out, 6), 'pode-seguir'],
    [(out) => denied(out, 6.01), 'parar'],
  ]) {
    const l = lot(t);
    build(l.out);
    const r = l.run();
    assert.equal(r.verdict, verdict, r.reason);
    if (verdict === 'parar') assert.match(r.reason, /acima de US\$ 6\.00/);
  }
});

function accumulated(t, third) {
  const l = lot(t);
  valid(l.out, 6);
  valid(l.out, 6);
  denied(l.out, third);
  return l;
}

test('US$ 12.50 accumulated still allows the next run, with US$ 2.75', (t) => {
  const r = accumulated(t, 0.5).run();
  assert.equal(r.accumulatedUsd, 12.5);
  assert.equal(r.verdict, 'pode-seguir', r.reason);
  assert.equal(r.nextMaxBudgetUsd, '2.75');
});

test('nextMaxBudgetUsd is rounded down to cents', (t) => {
  const r = accumulated(t, 0.481).run();
  assert.equal(r.accumulatedUsd, 12.481);
  assert.equal(r.nextMaxBudgetUsd, '2.75');
});

test('US$ 12.51 accumulated closes the batch', (t) => {
  const r = accumulated(t, 0.51).run();
  assert.equal(r.accumulatedUsd, 12.51);
  assert.equal(r.verdict, 'fechar', r.reason);
  assert.equal(r.nextMaxBudgetUsd, null);
});

test('more than US$ 18 accumulated is parar, and parar wins over fechar with every run listed', (t) => {
  const l = accumulated(t, 6);
  let r = l.run();
  assert.equal(r.accumulatedUsd, 18);
  assert.equal(r.verdict, 'fechar', r.reason);
  denied(l.out, 0.01);
  r = l.run();
  assert.equal(r.accumulatedUsd, 18.01);
  assert.equal(r.invalid, 2);
  assert.equal(r.verdict, 'parar');
  assert.match(r.reason, /acima de US\$ 18\.00/);
  assert.ok(!/inválidas \(/.test(r.reason), 'only the reasons of the winning verdict');
  assert.equal(r.executions.length, 4);
});

test('three valid runs close the batch; a stop in the first still evaluates the others', (t) => {
  const l = lot(t);
  for (let i = 0; i < 3; i++) valid(l.out, 1);
  const r = l.run();
  assert.equal(r.valid, 3);
  assert.equal(r.verdict, 'fechar', r.reason);
  assert.match(r.reason, /válidas/);
  valid(l.out, 7);
  const first = l.run().executions[0].folder;
  rmSync(join(l.out, first, 'SHA256SUMS'));
  const s = l.run();
  assert.equal(s.verdict, 'parar');
  assert.equal(s.executions.length, 4);
  assert.match(s.reason, /SHA256SUMS/);
  assert.match(s.reason, /acima de US\$ 6\.00/);
  assert.deepEqual(s.executions.map((e) => e.folder), [...s.executions.map((e) => e.folder)].sort());
});

// ---- main ----

function runMain(t, argv) {
  const log = t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});
  try {
    const code = main(argv);
    return { code, out: log.mock.calls.map((c) => c.arguments.join(' ')), err: error.mock.calls.map((c) => c.arguments.join(' ')) };
  } finally {
    log.mock.restore();
    error.mock.restore();
  }
}

const argvOf = (o) => ['--out', o.out, '--commit', o.commit, '--autorizacao', o.autorizacao, '--decisions', o.decisions];

test('main: a wrong call prints the usage on stderr and returns 2', (t) => {
  const l = lot(t);
  const ok = argvOf(l.opts);
  for (const argv of [
    [],
    ok.slice(0, 6),
    ok.slice(0, 7),
    [...ok, '--extra', 'x'],
    [...ok, '--out', l.out],
    argvOf({ ...l.opts, commit: COMMIT.slice(0, 7) }),
    argvOf({ ...l.opts, commit: 'z'.repeat(40) }),
    argvOf({ ...l.opts, autorizacao: 'DEC-17' }),
    argvOf({ ...l.opts, out: join(l.base, 'nao-existe') }),
    argvOf({ ...l.opts, out: l.decisions }),
  ]) {
    const r = runMain(t, argv);
    assert.equal(r.code, 2, argv.join(' '));
    assert.deepEqual(r.out, []);
    assert.match(r.err.join('\n'), /usage:/);
  }
});

test('main: one line of JSON without session id or temporary folder, and the exit code of the verdict', (t) => {
  const l = lot(t);
  const ids = [];
  const once = (code, verdict) => {
    const r = runMain(t, argvOf(l.opts));
    assert.equal(r.code, code, r.out[0]);
    assert.equal(r.out.length, 1);
    assert.ok(!r.out[0].includes('\n'));
    const j = JSON.parse(r.out[0]);
    assert.deepEqual(Object.keys(j), ['executions', 'valid', 'invalid', 'accumulatedUsd', 'verdict', 'reason', 'nextMaxBudgetUsd']);
    assert.equal(j.verdict, verdict);
    for (const id of ids) assert.ok(!r.out[0].includes(id), 'session id in the output');
    assert.ok(!r.out[0].includes('lote-gate-'), 'temporary folder in the output');
  };
  once(0, 'pode-seguir');
  ids.push(...denied(l.out).ids, ...denied(l.out).ids);
  once(3, 'fechar');
  const bad = valid(l.out);
  ids.push(...bad.ids);
  writeFileSync(join(bad.dir, 'private', 'transcripts', '1', `${bad.ids[0]}.jsonl`), '\n', { flag: 'a' });
  once(4, 'parar');
  rmSync(join(bad.dir, 'private'), { recursive: true });
  writeFileSync(join(bad.dir, 'private'), 'not a folder');
  once(4, 'parar');
});

test('the file as entry point returns the exit code of main', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage:/);
  assert.equal(r.stdout, '');
});

// ---- real format: folders written by runBatch itself ----

const FIX = join(here, 'fixtures', 'transcripts', 'fab-project');
const SRC_SID = '00000000-0000-4000-8000-000000000002';
const gitIn = (cwd, ...a) => {
  const r = spawnSync('git', ['-c', 'user.name=fab', '-c', 'user.email=fab@example.invalid', ...a], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
};

const asOpus = (text) =>
  text
    .split('\n')
    .map((line) => {
      if (!line.trim()) return line;
      const o = JSON.parse(line);
      if (o.message?.model) o.message.model = 'claude-opus-4-1';
      return JSON.stringify(o);
    })
    .join('\n');

// Fake executor: answers every claude call itself and forwards only git and the extractor to real processes.
function makeFake(configDir, { deny = false } = {}) {
  const issued = [];
  let n = 0;
  let logQueries = 0;
  const writeFab = (id) => {
    issued.push(id);
    const proj = join(configDir, 'projects', 'fab-sandbox');
    const wf = join(proj, id, 'subagents', 'workflows', 'wf_fab');
    mkdirSync(wf, { recursive: true });
    writeFileSync(join(proj, `${id}.jsonl`), asOpus(readFileSync(join(FIX, `${SRC_SID}.jsonl`), 'utf8').split(SRC_SID).join(id)));
    for (const a of ['afab101', 'afab102']) {
      const from = join(FIX, SRC_SID, 'subagents', 'workflows', 'wf_fab01', `agent-${a}`);
      writeFileSync(join(wf, `agent-${a}.jsonl`), asOpus(readFileSync(`${from}.jsonl`, 'utf8')));
      cpSync(`${from}.meta.json`, join(wf, `agent-${a}.meta.json`));
    }
  };
  const exec = async (cmd, args, opts = {}) => {
    if (cmd === 'claude') {
      if (args[0] === '--version') return { code: 0, stdout: '2.1.0 (Claude Code)\n' };
      if (args[0] !== '-p') throw new Error(`unexpected claude call: ${args[0]}`);
      n += 1;
      const id = randomUUID();
      writeFab(id);
      if (n === 1) {
        await new Promise((done) => {
          if (opts.signal.aborted) done();
          else opts.signal.addEventListener('abort', done, { once: true });
        });
        return { code: 1, stdout: '' };
      }
      if (!deny) {
        gitIn(opts.cwd, 'checkout', '-q', '-B', 'feat/E5', 'main');
        gitIn(opts.cwd, 'commit', '-q', '--allow-empty', '-m', 'E5 T1: slugify');
        gitIn(opts.cwd, 'checkout', '-q', '-B', 'release/sandbox', 'main');
        gitIn(opts.cwd, 'merge', '-q', '--no-ff', '-m', 'merge: E5 in release/sandbox', 'feat/E5');
        gitIn(opts.cwd, 'checkout', '-q', 'main');
      }
      const permission_denials = deny ? [{ tool_name: 'Workflow' }] : [];
      return { code: 0, stdout: JSON.stringify({ session_id: id, is_error: false, total_cost_usd: 0.01, permission_denials }) };
    }
    if (cmd === 'git' && args[0] === 'log') {
      logQueries += 1;
      return { code: 0, stdout: logQueries >= 2 ? 'E5 T1: slugify\nE5 spec\n' : 'docs(spec): E5\n' };
    }
    if (cmd !== 'git' && cmd !== process.execPath) throw new Error(`unexpected command: ${cmd}`);
    const r = spawnSync(cmd, args, { cwd: opts.cwd, encoding: 'utf8' });
    return { code: r.status ?? 1, stdout: r.stdout ?? '' };
  };
  return { exec, issued };
}

async function realRun(t, fakeOptions) {
  const l = lot(t);
  const configDir = join(l.base, 'cfg');
  const installPath = join(l.base, 'plugin');
  mkdirSync(join(configDir, 'plugins'), { recursive: true });
  mkdirSync(installPath);
  writeFileSync(
    join(configDir, 'plugins', 'installed_plugins.json'),
    JSON.stringify({ version: 2, plugins: { 'productivity-tools@claude-play': [{ version: '9.9.9', gitCommitSha: COMMIT, installPath }] } }),
  );
  const fake = makeFake(configDir, fakeOptions);
  const batch = await runBatch(
    { variant: 'parada-retomada', runs: 1, model: 'opus', pollMs: 1, permissionMode: 'acceptEdits', work: join(l.base, 'work'), out: l.out, configDir },
    { exec: fake.exec, now: () => new Date('2026-11-26T12:00:00Z'), ratify: () => ({ ok: true, ratified: [] }), listProcs: () => [], pending: () => assert.fail('pending must not run') },
  );
  return { ...l, batch, issued: fake.issued };
}

test('real format: a valid and integrated run of runBatch passes the gate', async (t) => {
  const l = await realRun(t);
  const r = l.run();
  assert.equal(r.verdict, 'pode-seguir', r.reason);
  const [e] = r.executions;
  assert.equal(e.class, 'valida');
  assert.equal(e.folder, 'parada-retomada-20261126-120000');
  assert.deepEqual(checkSums(l.batch.dir), { ok: true, why: 'ok' });
  assert.equal(e.costUsd, l.batch.aggregate.attempts[0].costUsd);
  assert.deepEqual(e.sessionModels, { parada: 'opus', retomada: 'opus' });
  assert.equal(e.caveat, false);
  assert.ok(Number.isFinite(e.counters.weightedNoHaiku));
  assert.deepEqual(e.repeatLabels, []);
  const c = costOfTranscripts(join(l.batch.dir, 'private', 'transcripts', '1'));
  assert.equal(c.sessions, 2);
  assert.ok(c.usd > 0, c.why);
  for (const id of l.issued) assert.ok(!JSON.stringify(r).includes(id));
});

test('real format: a run denied on the resume is invalida, without attempts.json', async (t) => {
  const l = await realRun(t, { deny: true });
  assert.equal(existsSync(join(l.batch.dir, 'private', 'attempts.json')), false);
  const r = l.run();
  const [e] = r.executions;
  assert.equal(e.class, 'invalida', r.reason);
  assert.equal(e.status, 'denied');
  assert.ok(e.costUsd > 0);
  assert.equal(r.invalid, 1);
  assert.equal(r.verdict, 'pode-seguir', r.reason);
});
