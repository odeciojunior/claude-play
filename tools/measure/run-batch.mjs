#!/usr/bin/env node
// Batch launcher: runs one measurement variant n times in disposable sandboxes and writes an aggregate.
// Usage: node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <dir> --out <dir> --config-dir <dir>
//          --permission-mode <modo> [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>]
// Exit codes: 0 all attempts ran, 1 a denied or failed attempt, 2 usage error.
// aggregate.json never holds session ids, personal paths or agent descriptions; those stay in private/.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { makeScenario, artifactOf, E5_PATHS } from './make-scenario.mjs';
import { STOP_RESUME } from '../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const EXTRACTOR = join(here, 'session-metrics.mjs');
const PLUGIN_KEY = 'productivity-tools@claude-play';
const WEIGHTS = { haiku: 1, sonnet: 20, opus: 40 };
const FAMILIES = ['haiku', 'sonnet', 'opus', 'fable', 'other'];

// Real executor. On abort the whole process tree is ended (taskkill on Windows, process group elsewhere).
export function defaultExec(cmd, args, { cwd, signal } = {}) {
  return new Promise((resolvePromise, reject) => {
    const win = process.platform === 'win32';
    const child = spawn(cmd, args, { cwd, detached: !win, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d));
    const kill = () => {
      if (win) spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
      else {
        try {
          process.kill(-child.pid);
        } catch {
          /* already gone */
        }
      }
    };
    if (signal) {
      if (signal.aborted) kill();
      else signal.addEventListener('abort', kill, { once: true });
    }
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code: code ?? 1, stdout }));
  });
}

const sumCalls = (c) => FAMILIES.reduce((n, f) => n + (c[f] ?? 0), 0);
const weighted = (c) => FAMILIES.reduce((n, f) => n + (c[f] ?? 0) * (WEIGHTS[f] ?? 0), 0);
const isFixRole = (name) => /-fix$/.test(name);

// Counters of one attempt from one extractor Run. Structural/bytes leave out the task loop and the
// fix agents (conditional work). Roles carry no round number, so agents of review rounds above 1 stay
// in structural; their count is reported separately as conditional.extraRounds.
export function toAttemptCounters(run) {
  const structural = Object.fromEntries(FAMILIES.map((f) => [f, run.total.calls[f] - run.tasks.loop.calls[f]]));
  let bytes = run.total.promptBytes - run.tasks.loop.promptBytes;
  let fixCalls = 0;
  for (const [name, role] of Object.entries(run.roles)) {
    if (!isFixRole(name) || name === 'task-fix') continue; // task-fix agents are already in the task loop
    for (const f of FAMILIES) structural[f] -= role.calls[f];
    bytes -= role.promptBytes;
  }
  for (const [name, role] of Object.entries(run.roles)) if (isFixRole(name)) fixCalls += sumCalls(role.calls);
  structural.weighted = weighted(structural);
  return {
    structural,
    bytes,
    perTask: run.tasks.count > 0 ? weighted(run.tasks.loop.calls) / run.tasks.count : null,
    conditional: { extraRounds: run.reviewRounds.extra, fixCalls },
    main: {
      agentCalls: Object.values(run.main.agentCalls).reduce((n, v) => n + v, 0),
      bytes: run.main.promptBytes,
      turns: run.main.turns,
    },
    static: null,
    cost: run.total.cost,
  };
}

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

function readPlugin(configDir) {
  const unknown = { version: 'unknown', commit: 'unknown' };
  const file = join(configDir, 'plugins', 'installed_plugins.json');
  try {
    const entry = JSON.parse(readFileSync(file, 'utf8')).plugins?.[PLUGIN_KEY]?.[0];
    if (entry?.version) return { version: entry.version, commit: entry.gitCommitSha ?? 'unknown' };
  } catch {
    /* fall through */
  }
  console.error(`run-batch: plugin ${PLUGIN_KEY} not found in ${file}; recording version "unknown"`);
  return unknown;
}

function pricesDate() {
  try {
    return JSON.parse(readFileSync(join(here, 'prices.json'), 'utf8')).date ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const addTo = (acc, role) => {
  for (const f of FAMILIES) acc.calls[f] += role.calls[f];
  acc.promptBytes += role.promptBytes;
  for (const k of Object.keys(acc.tokens)) acc.tokens[k] += role.tokens[k] ?? 0;
  if (role.cost !== null) acc.cost = (acc.cost ?? 0) + role.cost;
  acc.agents += role.agents;
};

// Roles summed over the valid attempts. `other:<label>` roles come from agent labels, so they collapse.
function sumRoles(runs) {
  const out = {};
  for (const run of runs) {
    for (const [name, role] of Object.entries(run.roles)) {
      const key = name.startsWith('other:') ? 'other' : name;
      out[key] ??= {
        calls: Object.fromEntries(FAMILIES.map((f) => [f, 0])),
        promptBytes: 0,
        tokens: { input: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 },
        cost: null,
        agents: 0,
      };
      addTo(out[key], role);
    }
  }
  return out;
}

function promptArgs(prompt, o) {
  return [
    '-p', prompt, '--output-format', 'json', '--permission-mode', o.permissionMode,
    '--allowedTools', (o.allow ?? []).join(','),
    ...(o.addDir ?? []).flatMap((d) => ['--add-dir', d]),
    ...(o.model ? ['--model', o.model] : []),
    ...(o.maxBudgetUsd ? ['--max-budget-usd', String(o.maxBudgetUsd)] : []),
  ];
}

// ---- Journal, validity and outcomes of the seeded variants (DEC-082, DP-4, DP-7) ----

const parseObject = (text) => {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};

// Strict reader: a missing file, a line that is not JSON or an entry without a label is a format error.
export function readJournal(file) {
  if (!existsSync(file)) return { entries: [], formatError: 'journal missing' };
  const entries = [];
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].replace(/\r$/, '');
    if (text.trim() === '') continue;
    const obj = parseObject(text);
    if (!obj) return { entries, formatError: `line ${i + 1} is not JSON` };
    const label = typeof obj.label === 'string' && obj.label ? obj.label : typeof obj.description === 'string' && obj.description ? obj.description : null;
    if (label === null) return { entries, formatError: `line ${i + 1} has no label` };
    let result = null;
    if (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)) result = obj.result;
    else if (typeof obj.resultJson === 'string') result = parseObject(obj.resultJson);
    else if (typeof obj.result === 'string') result = parseObject(obj.result);
    entries.push({ label, result, text });
  }
  return { entries, formatError: null };
}

// Journals of every session of one attempt, merged. No journal at all is a format error.
function readSessionJournals(configDir, sessions) {
  const files = [];
  const root = join(configDir, 'projects');
  const dirs = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
  for (const slug of dirs(root)) {
    for (const sid of sessions) {
      const wfRoot = join(root, slug, sid, 'subagents', 'workflows');
      for (const wf of dirs(wfRoot)) if (wf.startsWith('wf_')) files.push(join(wfRoot, wf, 'journal.jsonl'));
    }
  }
  if (files.length === 0) return { entries: [], formatError: 'journal missing' };
  const merged = { entries: [], formatError: null };
  for (const file of files.sort()) {
    const j = readJournal(file);
    merged.entries.push(...j.entries);
    merged.formatError ??= j.formatError;
  }
  return merged;
}

const INVALID_FORMAT = { valid: false, reason: 'formato-do-diario' };
const find = (entries, label) => entries.find((e) => e.label === label);

// Missing fields never count as a satisfied condition: they are a format error.
export function checkValidity(variant, journal, scenario) {
  if (journal.formatError) return INVALID_FORMAT;
  const { entries } = journal;
  const art = artifactOf(variant);
  if (!art) return { valid: true, reason: 'ok' };
  if (art.class === 'plan') {
    const plan = find(entries, 'E5:plan');
    if (typeof plan?.result?.reused !== 'boolean') return INVALID_FORMAT;
    let blob;
    if (art.artifact !== 'C') {
      const review = find(entries, 'E5:plan-review1');
      if (typeof review?.result?.measuredPlanBlob !== 'string') return INVALID_FORMAT;
      blob = review.result.measuredPlanBlob;
    }
    if (plan.result.reused === false) return { valid: false, reason: 'plano-reescrito' };
    if (blob !== undefined && blob !== scenario.seededBlobs?.[E5_PATHS.plan]) return { valid: false, reason: 'blob-diferente' };
    return { valid: true, reason: 'ok' };
  }
  if (art.class === 'spec') {
    const review = find(entries, 'E5:spec-review1');
    if (typeof review?.result?.measuredSpecBlob !== 'string') return INVALID_FORMAT;
    if (review.result.measuredSpecBlob !== scenario.seededBlobs?.[E5_PATHS.spec]) return { valid: false, reason: 'blob-diferente' };
    return { valid: true, reason: 'ok' };
  }
  // code: the run resumes at task 3, so its review must exist and tasks 1 to 3 must not be redone
  if (!find(entries, 'E5:t3:spec1')) return INVALID_FORMAT;
  const redone = entries.some((e) => {
    const m = /^E5:t(\d+):impl/.exec(e.label);
    return m && Number(m[1]) <= 3;
  });
  return redone ? { valid: false, reason: 'tarefa-refeita' } : { valid: true, reason: 'ok' };
}

const BLOCKING = new Set(['critical', 'important']);

export function stageResult(variant, entries, sandbox) {
  const art = artifactOf(variant);
  if (art?.class === 'code') {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', 'feat/E5', 'release/sandbox'], { cwd: sandbox, stdio: 'ignore' });
      return 'approved';
    } catch {
      return 'stopped';
    }
  }
  const prefix = art?.class === 'spec' ? 'E5:spec-review' : 'E5:plan-review';
  const reviews = entries
    .map((e) => ({ k: Number(e.label.startsWith(prefix) ? e.label.slice(prefix.length) : NaN), e }))
    .filter((x) => Number.isInteger(x.k))
    .sort((a, b) => a.k - b.k);
  if (reviews.length === 0) return 'stopped';
  const issues = reviews[reviews.length - 1].e.result?.issues;
  const blocked = Array.isArray(issues) && issues.some((i) => BLOCKING.has(i?.severity));
  return blocked ? 'stopped' : 'approved';
}

export function outcomeFor(entry, { present, stage, entries }) {
  if (entry.detectedBy === 'code') {
    const re = new RegExp(entry.codeSignal);
    if (entries.some((e) => re.test(e.text))) return 'acusado-pelo-codigo';
    return present && stage === 'approved' ? 'perdido' : 'indeterminado';
  }
  if (!present) return 'capturado';
  return stage === 'approved' ? 'perdido' : 'indeterminado';
}

async function attemptOutcomes(variant, scenario, journal) {
  const art = artifactOf(variant);
  const manifest = JSON.parse(readFileSync(join(here, 'defects', 'manifest.json'), 'utf8'));
  const stage = stageResult(variant, journal.entries, scenario.dir);
  const out = [];
  for (const e of manifest.filter((m) => m.class === art.class && m.artifact === art.artifact)) {
    let outcome;
    try {
      const mod = await import(pathToFileURL(join(here, 'defects', e.sentinel)).href);
      outcome = outcomeFor(e, { present: mod.present(scenario.dir, 'feat/E5'), stage, entries: journal.entries });
    } catch {
      outcome = 'indeterminado';
    }
    out.push({ id: e.id, class: e.class, detectedBy: e.detectedBy === 'code' ? 'codigo' : 'reviewer', outcome });
  }
  return out;
}

function totalOutcomes(attempts) {
  const outcomes = {};
  const byCode = {};
  for (const a of attempts) {
    if (a.status !== 'valid') continue;
    for (const o of a.outcomes ?? []) {
      if (o.detectedBy === 'reviewer') {
        outcomes[o.id] ??= { class: o.class, detectedBy: 'reviewer', capturado: 0, perdido: 0, indeterminado: 0 };
        outcomes[o.id][o.outcome] += 1;
      } else {
        byCode[o.id] ??= { 'acusado-pelo-codigo': 0, perdido: 0, indeterminado: 0 };
        byCode[o.id][o.outcome] += 1;
      }
    }
  }
  return { outcomes, deteccaoPorCodigo: byCode };
}

function sessionIds(configDir) {
  const root = join(configDir, 'projects');
  if (!existsSync(root)) return new Set();
  const ids = new Set();
  for (const slug of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const n of readdirSync(join(root, slug.name))) if (n.endsWith('.jsonl')) ids.add(n.slice(0, -6));
  }
  return ids;
}

function parseClaudeJson(stdout) {
  try {
    const j = JSON.parse(stdout);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

export async function runBatch(opts, { exec = defaultExec, now = () => new Date() } = {}) {
  const { variant, runs } = opts;
  const dir = join(resolve(opts.out), `${variant}-${stamp(now())}`);
  const priv = join(dir, 'private');
  mkdirSync(priv, { recursive: true });
  const plugin = readPlugin(opts.configDir);
  const cli = (await exec('claude', ['--version'], {})).stdout.trim();

  const attempts = [];
  const privateAttempts = [];
  const validRuns = [];
  for (let k = 1; k <= runs; k++) {
    const scenario = await makeScenario(join(resolve(opts.work), `${variant}-${k}`), variant);
    const sessions = [];
    let denied = false;
    let failed = false;
    let failReason = 'execucao-falhou';
    const stop = scenario.stopResume ?? (variant === 'parada-retomada' ? STOP_RESUME : null);
    for (let i = 0; i < scenario.prompts.length; i++) {
      const args = promptArgs(scenario.prompts[i], opts);
      const watch = stop !== null && i === 0;
      let r;
      let aborted = false;
      const known = watch ? sessionIds(opts.configDir) : null;
      if (watch) {
        const ac = new AbortController();
        let polling = false;
        const timer = setInterval(async () => {
          if (polling || ac.signal.aborted) return;
          polling = true;
          try {
            const g = await exec('git', ['log', stop.stopWhen.branch, '--format=%s'], { cwd: scenario.dir });
            if (g.code === 0 && g.stdout.split(/\r?\n/).some((l) => l.startsWith(stop.stopWhen.subjectPrefix))) {
              aborted = true;
              ac.abort();
            }
          } catch {
            /* branch not there yet */
          } finally {
            polling = false;
          }
        }, opts.pollMs ?? 5000);
        try {
          r = await exec('claude', args, { cwd: scenario.dir, signal: ac.signal });
        } finally {
          clearInterval(timer);
        }
      } else {
        r = await exec('claude', args, { cwd: scenario.dir });
      }
      const j = parseClaudeJson(r.stdout);
      if (j?.session_id) sessions.push(j.session_id);
      else if (aborted) for (const id of sessionIds(opts.configDir)) if (!known.has(id) && !sessions.includes(id)) sessions.push(id);
      if (j && Array.isArray(j.permission_denials) && j.permission_denials.length > 0) {
        denied = true;
        break;
      }
      if (aborted) {
        if (sessions.length === 0) {
          failed = true;
          break;
        }
        continue;
      }
      if (r.code !== 0 || !j || !j.session_id || j.is_error) {
        failed = true;
        if (stop !== null && i > 0) failReason = 'retomada-incompleta';
        break;
      }
    }
    if (denied) {
      attempts.push({ n: k, status: 'denied' });
      continue;
    }
    if (failed || sessions.length === 0) {
      attempts.push({ n: k, status: 'invalid', reason: failReason });
      privateAttempts.push({ n: k, sessions });
      writeFileSync(join(priv, 'attempts.json'), JSON.stringify({ attempts: privateAttempts }, null, 2) + '\n');
      continue;
    }
    privateAttempts.push({ n: k, sessions });
    writeFileSync(join(priv, 'attempts.json'), JSON.stringify({ attempts: privateAttempts }, null, 2) + '\n');
    let journal = null;
    if (scenario.seeded?.length > 0) {
      journal = readSessionJournals(opts.configDir, sessions);
      const v = checkValidity(variant, journal, scenario);
      if (!v.valid) {
        attempts.push({ n: k, status: 'invalid', reason: v.reason });
        if (v.reason === 'formato-do-diario') {
          const n = attempts.filter((a) => a.reason === 'formato-do-diario').length;
          console.error(`journal format: ${n} attempt(s) invalid`);
        }
        continue;
      }
    }
    const runsFile = join(priv, `attempts-${k}.json`);
    writeFileSync(runsFile, JSON.stringify({ attempts: [{ n: k, sessions }] }, null, 2) + '\n');
    const metricsDir = join(priv, 'metrics', String(k));
    const ex = await exec(
      process.execPath,
      [EXTRACTOR, '--root', join(opts.configDir, 'projects'), '--out', metricsDir, '--sessions', sessions.join(','), '--runs', runsFile],
      { cwd: here },
    );
    if (ex.code !== 0) {
      attempts.push({ n: k, status: 'invalid', reason: 'extrator-falhou' });
      continue;
    }
    const run = JSON.parse(readFileSync(join(metricsDir, 'metrics.json'), 'utf8')).runs[0];
    validRuns.push(run);
    let outcomes = [];
    if (journal) {
      // The sentinels read the tip of feat/E5 in the working tree.
      await exec('git', ['checkout', '-q', 'feat/E5'], { cwd: scenario.dir });
      outcomes = await attemptOutcomes(variant, scenario, journal);
    }
    attempts.push({ n: k, status: 'valid', counters: toAttemptCounters(run), outcomes });
  }

  const status = (s) => attempts.filter((a) => a.status === s).length;
  const invalidReasons = {};
  for (const a of attempts) if (a.status === 'invalid') invalidReasons[a.reason] = (invalidReasons[a.reason] ?? 0) + 1;
  const costs = attempts.filter((a) => a.status === 'valid' && a.counters.cost !== null).map((a) => a.counters.cost);
  const models = FAMILIES.filter((f) => validRuns.some((r) => r.total.calls[f] > 0));
  const aggregate = {
    variant,
    requested: runs,
    valid: status('valid'),
    invalid: status('invalid'),
    denied: status('denied'),
    invalidReasons,
    plugin,
    cli,
    models,
    pricesDate: pricesDate(),
    permissionMode: opts.permissionMode,
    attempts,
    roles: sumRoles(validRuns),
    cost: costs.length ? { median: median(costs), min: Math.min(...costs), max: Math.max(...costs) } : { median: null, min: null, max: null },
    ...totalOutcomes(attempts),
  };
  writeFileSync(join(dir, 'aggregate.json'), JSON.stringify(aggregate, null, 2) + '\n');
  return { dir, aggregate, exitCode: status('denied') + status('invalid') > 0 ? 1 : 0 };
}

const USAGE =
  'usage: node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <dir> --out <dir> --config-dir <dir> --permission-mode <modo> [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>]';

function parseCli(argv) {
  const o = { allow: [], addDir: [] };
  const names = {
    '--variant': 'variant', '--runs': 'runs', '--work': 'work', '--out': 'out', '--config-dir': 'configDir',
    '--permission-mode': 'permissionMode', '--allow': 'allow', '--add-dir': 'addDir', '--model': 'model',
    '--max-budget-usd': 'maxBudgetUsd',
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = names[argv[i]];
    if (!key || argv[i + 1] === undefined) return null;
    if (key === 'allow' || key === 'addDir') o[key].push(argv[i + 1]);
    else o[key] = argv[i + 1];
  }
  const runs = Number(o.runs);
  if (!o.variant || !o.work || !o.out || !o.configDir || !o.permissionMode || !Number.isInteger(runs) || runs < 1) return null;
  return { ...o, runs };
}

function insideRepo(target) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const rel = relative(fold(resolve(root)), fold(resolve(target)));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = parseCli(process.argv.slice(2));
  if (!o) {
    console.error(USAGE);
    process.exit(2);
  }
  if (insideRepo(o.work)) {
    console.error(`run-batch: --work is inside the repository: ${resolve(o.work)}`);
    process.exit(2);
  }
  try {
    const r = await runBatch(o, {});
    console.log(JSON.stringify({ dir: r.dir, valid: r.aggregate.valid, invalid: r.aggregate.invalid, denied: r.aggregate.denied }));
    process.exitCode = r.exitCode;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
