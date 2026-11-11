#!/usr/bin/env node
// Batch launcher: runs one measurement variant n times in disposable sandboxes and writes an aggregate.
// Usage: node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <dir> --out <dir> --config-dir <dir>
//          --permission-mode <modo> [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>]
// Exit codes: 0 all attempts ran, 1 a denied or failed attempt, 2 usage error.
// aggregate.json never holds session ids, personal paths or agent descriptions; those stay in private/.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { makeScenario } from './make-scenario.mjs';

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
    for (const prompt of scenario.prompts) {
      const r = await exec('claude', promptArgs(prompt, opts), { cwd: scenario.dir });
      const j = parseClaudeJson(r.stdout);
      if (j?.session_id) sessions.push(j.session_id);
      if (j && Array.isArray(j.permission_denials) && j.permission_denials.length > 0) {
        denied = true;
        break;
      }
      if (r.code !== 0 || !j || j.is_error) {
        failed = true;
        break;
      }
    }
    if (denied) {
      attempts.push({ n: k, status: 'denied' });
      continue;
    }
    if (failed || sessions.length === 0) {
      attempts.push({ n: k, status: 'invalid', reason: 'execucao-falhou' });
      privateAttempts.push({ n: k, sessions });
      writeFileSync(join(priv, 'attempts.json'), JSON.stringify({ attempts: privateAttempts }, null, 2) + '\n');
      continue;
    }
    privateAttempts.push({ n: k, sessions });
    writeFileSync(join(priv, 'attempts.json'), JSON.stringify({ attempts: privateAttempts }, null, 2) + '\n');
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
    attempts.push({ n: k, status: 'valid', counters: toAttemptCounters(run), outcomes: [] });
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
    outcomes: {},
    deteccaoPorCodigo: {},
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
