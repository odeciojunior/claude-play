#!/usr/bin/env node
// Batch launcher: runs one measurement variant n times in disposable sandboxes and writes an aggregate.
// Usage: node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <dir> --out <dir> --config-dir <dir>
//          --permission-mode <modo> [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>]
//          [--stage spec-review|plan-review|task-review [--arm <nome>] [--arms-dir <dir>] [--review-model haiku|sonnet|opus (required with task-review)]]
//          [--rounds loop|single] (loop: the product review loop, spec-review/plan-review with --arm atual; default single)
//          [--plugin-dir <dir>] (passed to every claude -p; the aggregate records that folder's version and commit)
// With --stage the batch runs only that review stage on a seeded artifact (review-only.js harness).
// Exit codes: 0 all attempts ran, 1 a denied or failed attempt, 2 usage error.
// aggregate.json never holds session ids, personal paths or agent descriptions; those stay in private/.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { makeScenario, artifactOf, seedSourceOf, excludeFromGit, E5_PATHS } from './make-scenario.mjs';
import { loadPure } from '../../plugins/productivity-tools/skills/roadmap-release/workflow/load-pure.mjs';
import { STOP_RESUME } from '../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const EXTRACTOR = join(here, 'session-metrics.mjs');
const PLUGIN_KEY = 'productivity-tools@claude-play';
const WEIGHTS = { haiku: 1, sonnet: 20, opus: 40 };
const FAMILIES = ['haiku', 'sonnet', 'opus', 'fable', 'other'];

// Real executor. On abort the whole process tree is ended (taskkill on Windows, process group elsewhere).
// claude -p stops background tasks (the release Workflow) 10 minutes after its last turn; a measured run must wait for them.
export const CLAUDE_ENV = { CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0' };
export const execEnv = (cmd, base = process.env) => (cmd === 'claude' ? { ...base, ...CLAUDE_ENV } : base);

export function defaultExec(cmd, args, { cwd, signal } = {}) {
  return new Promise((resolvePromise, reject) => {
    const win = process.platform === 'win32';
    const child = spawn(cmd, args, { cwd, env: execEnv(cmd), detached: !win, stdio: ['ignore', 'pipe', 'inherit'] });
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

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

const sumCalls = (c) => FAMILIES.reduce((n, f) => n + (c[f] ?? 0), 0);
const weighted = (c) => FAMILIES.reduce((n, f) => n + (c[f] ?? 0) * (WEIGHTS[f] ?? 0), 0);

// Counters of one attempt from one extractor Run. Structural/bytes leave out the task loop, the fix
// agents and the reviewers of rounds above 1 outside the task loop (conditional work; the extractor
// reports the latter in reviewRounds.extraAgents). Their round count is conditional.extraRounds.
export function toAttemptCounters(run) {
  const structural = Object.fromEntries(FAMILIES.map((f) => [f, run.total.calls[f] - run.tasks.loop.calls[f]]));
  let bytes = run.total.promptBytes - run.tasks.loop.promptBytes;
  const extra = run.reviewRounds.extraAgents;
  if (extra) {
    for (const f of FAMILIES) structural[f] -= extra.calls[f];
    bytes -= extra.promptBytes;
  }
  // Fix agents outside the task loop, decided by label in the extractor (run.fixAgents); task fixers are in the loop.
  const fix = run.fixAgents;
  if (fix) {
    for (const f of FAMILIES) structural[f] -= fix.calls[f];
    bytes -= fix.promptBytes;
  }
  const fixCalls = (fix ? sumCalls(fix.calls) : 0) + (run.roles['task-fix'] ? sumCalls(run.roles['task-fix'].calls) : 0);
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

export function readPlugin(configDir) {
  const unknown = { version: 'unknown', commit: 'unknown', installPath: 'unknown' };
  const file = join(configDir, 'plugins', 'installed_plugins.json');
  try {
    const entry = JSON.parse(readFileSync(file, 'utf8')).plugins?.[PLUGIN_KEY]?.[0];
    if (entry?.version) return { version: entry.version, commit: entry.gitCommitSha ?? 'unknown', installPath: entry.installPath ?? 'unknown' };
  } catch {
    /* fall through */
  }
  console.error(`run-batch: plugin ${PLUGIN_KEY} not found in ${file}; recording version "unknown"`);
  return unknown;
}

// Plugin loaded with --plugin-dir: version from its plugin.json, commit from git (null when the folder is not a repo).
// installPath is the folder itself (same layout as an install); it stays out of the public aggregate.
export function readPluginDir(dir) {
  let version = 'unknown';
  try {
    version = JSON.parse(readFileSync(join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).version ?? 'unknown';
  } catch {
    throw new UsageError('no readable .claude-plugin/plugin.json in --plugin-dir');
  }
  let commit = null;
  try {
    commit = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || null;
  } catch {
    /* not a repo */
  }
  return { version, commit, installPath: resolve(dir) };
}

// E26 A4: how many questions the fresh reader asked, or null with a reason.
export function questionCount(entries, label) {
  const entry = entries.find((e) => e.label === label);
  if (!entry) return { questions: null, reason: 'sem-entrada-do-revisor' };
  const q = entry.result?.questions;
  return Array.isArray(q) ? { questions: q.length } : { questions: null, reason: 'sem-lista-de-perguntas' };
}

// Blocking (critical or important) and minor counts of the stage reviewer, read from its journal entry.
export function reviewCounts(entries, label) {
  const entry = entries.find((e) => e.label === label);
  if (!entry) return { blocking: null, minor: null, reason: 'sem-entrada-do-revisor' };
  const issues = entry.result?.issues;
  if (!Array.isArray(issues)) return { blocking: null, minor: null, reason: 'sem-lista-de-issues' };
  return { blocking: issues.filter((i) => BLOCKING.has(i?.severity)).length, minor: issues.filter((i) => i?.severity === 'minor').length };
}

// First "superpowers@<marketplace>" entry of installed_plugins.json, whatever the marketplace is called.
export function readSuperpowers(configDir) {
  const absent = { version: 'ausente', commit: 'ausente' };
  const file = join(configDir, 'plugins', 'installed_plugins.json');
  try {
    const plugins = JSON.parse(readFileSync(file, 'utf8')).plugins ?? {};
    const key = Object.keys(plugins).find((k) => k.startsWith('superpowers@'));
    const entry = key ? plugins[key]?.[0] : undefined;
    if (entry?.version) return { version: entry.version, commit: entry.gitCommitSha ?? 'ausente' };
  } catch {
    /* fall through */
  }
  console.error(`run-batch: plugin superpowers not found in ${file}; recording version "ausente"`);
  return absent;
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

const emptyRole = () => ({
  calls: Object.fromEntries(FAMILIES.map((f) => [f, 0])),
  promptBytes: 0,
  tokens: { input: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 },
  cost: null,
  agents: 0,
});

// E26 A5: total_cost_usd of every claude -p of the attempt, summed; null when no call reported one.
export function sumCliCost(costs) {
  return costs.length ? costs.reduce((a, b) => a + b, 0) : null;
}

const addNullable = (a, b) => (b === null || b === undefined ? a : (a ?? 0) + b);

// E26 A5: the roles of one run grouped by label, before the other:* collapse. review = a label with "review" and
// without "fix"; fix = a label with "fix"; the rest is other. session keeps the CLI cost beside the transcript cost
// (unknown whether total_cost_usd already includes the Workflow agents, so both numbers stay).
export function rolesByLabel(run, cliCostUsd) {
  const out = { review: emptyRole(), fix: emptyRole(), other: emptyRole() };
  for (const [name, role] of Object.entries(run.roles)) {
    const bucket = name.includes('fix') ? 'fix' : name.includes('review') ? 'review' : 'other';
    addTo(out[bucket], role);
  }
  return { ...out, session: { cliCostUsd, transcriptCostUsd: run.main.cost ?? null } };
}

function sumRolesByLabel(list) {
  const out = { review: emptyRole(), fix: emptyRole(), other: emptyRole(), session: { cliCostUsd: null, transcriptCostUsd: null } };
  for (const r of list) {
    for (const k of ['review', 'fix', 'other']) addTo(out[k], r[k]);
    out.session.cliCostUsd = addNullable(out.session.cliCostUsd, r.session.cliCostUsd);
    out.session.transcriptCostUsd = addNullable(out.session.transcriptCostUsd, r.session.transcriptCostUsd);
  }
  return out;
}

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
    ...(o.pluginDir ? ['--plugin-dir', o.pluginDir] : []),
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

const labelOf = (o) => (typeof o.label === 'string' && o.label ? o.label : typeof o.description === 'string' && o.description ? o.description : null);

// Strict reader: a missing file, a line that is not JSON or an entry without a label is a format error.
// Two formats: the simulated one (every line carries a label and a result) and the real Workflow journal
// (lines with a `type`: `started` carries the label, `result` carries the result and is matched to its
// `started` by key, else agentId; `launched` and other types are housekeeping and are ignored).
export function readJournal(file) {
  if (!existsSync(file)) return { entries: [], formatError: 'journal missing' };
  const entries = [];
  const labelByKey = new Map();
  const labelByAgent = new Map();
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].replace(/\r$/, '');
    if (text.trim() === '') continue;
    const obj = parseObject(text);
    if (!obj) return { entries, formatError: `line ${i + 1} is not JSON` };
    if (typeof obj.type === 'string') {
      if (obj.type === 'started') {
        const l = labelOf(obj);
        if (l !== null) {
          if (typeof obj.key === 'string') labelByKey.set(obj.key, l);
          if (typeof obj.agentId === 'string') labelByAgent.set(obj.agentId, l);
        }
        continue;
      }
      if (obj.type !== 'result') continue;
      const l = labelOf(obj) ?? (typeof obj.key === 'string' ? labelByKey.get(obj.key) : undefined) ?? (typeof obj.agentId === 'string' ? labelByAgent.get(obj.agentId) : undefined);
      if (!l) return { entries, formatError: `line ${i + 1}: result without a started label` };
      let res = null;
      if (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)) res = obj.result;
      else if (typeof obj.result === 'string') res = parseObject(obj.result);
      entries.push({ label: l, result: res, text });
      continue;
    }
    const label = labelOf(obj);
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
    if (blob !== undefined && blob !== scenario.seededBlobs?.[(scenario.paths ?? E5_PATHS).plan]) return { valid: false, reason: 'blob-diferente' };
    return { valid: true, reason: 'ok' };
  }
  if (art.class === 'spec') {
    const review = find(entries, 'E5:spec-review1');
    if (typeof review?.result?.measuredSpecBlob !== 'string') return INVALID_FORMAT;
    if (review.result.measuredSpecBlob !== scenario.seededBlobs?.[(scenario.paths ?? E5_PATHS).spec]) return { valid: false, reason: 'blob-diferente' };
    return { valid: true, reason: 'ok' };
  }
  // code: the run resumes at task 3, so its review must exist and tasks 1 to 3 must not be redone
  if (!find(entries, 'E5:t3:spec1')) {
    // A pipeline that stopped in the spec or plan review never reaches the code: that is a stop, not a journal format error.
    const stoppedEarly = entries.some((e) => e.label === 'E5:status-blocked') && !entries.some((e) => /^E5:t\d+:/.test(e.label));
    return stoppedEarly ? { valid: false, reason: 'parou-antes-do-codigo' } : INVALID_FORMAT;
  }
  const redone = entries.some((e) => {
    const m = /^E5:t(\d+):impl/.exec(e.label);
    return m && Number(m[1]) <= 3;
  });
  return redone ? { valid: false, reason: 'tarefa-refeita' } : { valid: true, reason: 'ok' };
}

const BLOCKING = new Set(['critical', 'important']);

// Code stage: approved when feat/E5 was merged into release/sandbox. The release cleanup deletes the merged
// branch (`branch -d`), so a missing branch counts as merged when the seeded commit is in release/sandbox.
export function stageResult(variant, entries, sandbox, seededCommit) {
  const art = artifactOf(variant);
  if (art?.class === 'code') {
    const tip = gitOk(sandbox, 'rev-parse', '--verify', '-q', 'refs/heads/feat/E5') ? 'feat/E5' : seededCommit;
    return tip && gitOk(sandbox, 'merge-base', '--is-ancestor', tip, 'release/sandbox') ? 'approved' : 'stopped';
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

const gitOut = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (cwd, ...args) => {
  try {
    gitOut(cwd, ...args);
    return true;
  } catch {
    return false;
  }
};

// Puts the sandbox root on feat/E5 so the sentinels can read it. A real release run leaves the sandbox
// different from the seeded one: feat/E5 may still be checked out in a release worktree (a stopped
// stage), or it may be gone (release cleanup runs `branch -d` after a merge). The sandbox is disposable
// and the run is over, so a worktree holding the branch is removed and a deleted branch is recreated at
// the merged target. Returns false when the tip cannot be reached (outcomes are then indeterminate).
export function settleSandbox(sandbox, seededCommit) {
  try {
    for (const block of gitOut(sandbox, 'worktree', 'list', '--porcelain').split(/\r?\n\r?\n/)) {
      const wt = /^worktree (.+)$/m.exec(block)?.[1];
      if (wt && /^branch refs\/heads\/feat\/E5$/m.test(block) && resolve(wt) !== resolve(sandbox)) {
        gitOut(sandbox, 'worktree', 'remove', '--force', wt);
      }
    }
    if (!gitOk(sandbox, 'rev-parse', '--verify', '-q', 'refs/heads/feat/E5')) {
      if (!seededCommit || !gitOk(sandbox, 'merge-base', '--is-ancestor', seededCommit, 'release/sandbox')) return false;
      gitOut(sandbox, 'branch', 'feat/E5', 'release/sandbox');
    }
    gitOut(sandbox, 'checkout', '-q', 'feat/E5');
    return true;
  } catch {
    return false;
  }
}

// stageOf(presents) lets the review-stage harness decide the stage from what the sentinels still see.
async function attemptOutcomes(variant, scenario, journal, stageOf, reachable = true, ref = 'feat/E5') {
  const art = artifactOf(variant);
  const manifest = JSON.parse(readFileSync(join(here, 'defects', 'manifest.json'), 'utf8'));
  const entries = manifest.filter((m) => m.class === art.class && m.artifact === art.artifact && (m.set ?? 'e5') === (art.set ?? 'e5'));
  const presents = [];
  for (const e of entries) {
    if (!reachable) {
      presents.push(null);
      continue;
    }
    try {
      const mod = await import(pathToFileURL(join(here, 'defects', e.sentinel)).href);
      presents.push(mod.present(scenario.dir, ref, e.id));
    } catch {
      presents.push(null);
    }
  }
  const stage = stageOf ? stageOf(presents) : stageResult(variant, journal.entries, scenario.dir, scenario.seededCommit);
  return entries.map((e, i) => {
    const outcome = presents[i] === null ? 'indeterminado' : outcomeFor(e, { present: presents[i], stage, entries: journal.entries });
    return { id: e.id, class: e.class, detectedBy: e.detectedBy === 'code' ? 'codigo' : 'reviewer', outcome };
  });
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

// Native batches: attempts whose tool check exited non-zero, and attempts that ended with more blocking human inputs than they started with.
function nativeCounts(attempts) {
  const valid = attempts.filter((a) => a.status === 'valid');
  return {
    toolCheckFailed: valid.filter((a) => a.toolCheck && a.toolCheck.exit !== null && a.toolCheck.exit !== 0).length,
    humanInputsRaised: valid.filter((a) => a.humanInputs && a.humanInputs.blockingSeeded !== null && a.humanInputs.blockingAtEnd !== null && a.humanInputs.blockingAtEnd > a.humanInputs.blockingSeeded).length,
  };
}

// Loop batches: outcomes after the 1st fix, reviews per attempt, ok/stopped and the unverified after-fix SHAs (valid attempts).
function loopAggregate(attempts) {
  const valid = attempts.filter((a) => a.status === 'valid' && a.loop);
  const reviews = {};
  for (const a of valid) reviews[a.loop.reviews] = (reviews[a.loop.reviews] ?? 0) + 1;
  return {
    outcomesAfterFirstFix: totalOutcomes(valid.map((a) => ({ status: 'valid', outcomes: a.afterFirstFix?.outcomes ?? [] }))).outcomes,
    loopSummary: { reviews, ok: valid.filter((a) => a.loop.ok).length, stopped: valid.filter((a) => !a.loop.ok).length },
    afterFirstFixUnverified: valid.filter((a) => a.afterFirstFix && !a.afterFirstFix.verified).length,
  };
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

// ---- Review-stage harness (DEC-083, DP-6) ----

const STAGES = {
  'spec-review': { variant: /^spec-(semeado|nativo)-[AB]$/, fix: 'spec-fix', label: 'E5:spec-review', blobKey: 'measuredSpecBlob', artifact: 'spec' },
  'plan-review': { variant: /^plano-(semeado|nativo)-[AB]$/, fix: 'plan-fix', label: 'E5:plan-review', blobKey: 'measuredPlanBlob', artifact: 'plan' },
  'task-review': { variant: /^codigo-semeado-/, fix: 'task-fix', label: 'E5:task-review', blobKey: null, artifact: null },
};
const REVIEW_MODELS = ['haiku', 'sonnet', 'opus'];
const reviewEffortFor = (model) => (model === 'haiku' ? 'low' : 'medium'); // mirrors effortFor in roadmap-release.js
const COPIED = /^Copied from: (\S+) at commit ([0-9a-f]{40})$/;

export function readArm(file, { requireSource = false } = {}) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (e) {
    throw new UsageError(`arm template not readable: ${file} (${e.code ?? e.message})`);
  }
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const m = COPIED.exec(lines[0]);
  if (!m && requireSource) throw new UsageError(`arm template without the "Copied from: <path> at commit <sha>" first line: ${file}`);
  return { text: (m ? lines.slice(1) : lines).join('\n'), source: m ? { path: m[1], commit: m[2] } : null };
}

const lf = (t) => String(t).replace(/\r\n?/g, '\n');

// The arm template (minus its "Copied from" line) must appear in the workflow, piece by piece in order, byte for byte.
export function armMatches(armText, workflowText) {
  const lines = lf(armText).split('\n');
  // A table-escaped pipe is the same text with or without its escape: the JS source has \\|, the runtime prompt \|, the arm | (DEC-310).
  const pipe = (t) => t.replace(/\\+\|/g, '|');
  const body = pipe((/^Copied from:/.test(lines[0]) ? lines.slice(1) : lines).join('\n').trimEnd());
  const workflow = pipe(lf(workflowText));
  let at = 0;
  for (const piece of body.split(/\{\{[^}]*\}\}/)) {
    if (piece === '') continue;
    const i = workflow.indexOf(piece, at);
    if (i < 0) return false;
    at = i + piece.length;
  }
  return true;
}

// A current arm that no longer matches the measured workflow would measure a prompt the product does not send: refuse.
export function assertArmsCurrent(h, workflowText) {
  if (!h || h.arm !== 'atual') return;
  for (const [role, arm] of [['review', h.review], ['fix', h.fixArm], ['fixCheck', h.fixCheck]]) {
    if (arm && !armMatches(arm.text, workflowText)) throw new UsageError(`stale arm: the ${role} template of --stage ${h.stage} --arm atual no longer matches the measured workflow (recopy it from the workflow)`);
  }
}

const fill = (text, vars) => text.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in vars ? vars[k] : all));

// The script review-only.js written at the sandbox root: one reviewer and, on a blocking issue, one fixer.
// Same contract as roadmap-release.js: no imports and no Node API.
// agentType (optional): the plugin agent the reviewer runs as; without it the reviewer is a general-purpose agent.
// model/effort: the reviewer's tier (default opus without effort, the spec and plan stages); the task-review stage passes both, like the workflow.
export function buildReviewOnlyScript({ stage, reviewPrompt, fixPrompt, agentType = null, model = 'opus', effort = null }) {
  const st = STAGES[stage];
  if (!st) throw new UsageError(`unknown stage: ${stage}`);
  const schema = reviewSchema(st);
  return [
    'export const meta = {',
    "  name: 'review-only',",
    "  description: 'Measurement harness: one review of a seeded artifact and, if it blocks, one fix.',",
    "  phases: [{ title: 'Review', detail: 'reviewer and fixer of one stage' }],",
    '}',
    `const SCHEMA = ${JSON.stringify(schema)}`,
    `const REVIEW_PROMPT = ${JSON.stringify(reviewPrompt)}`,
    `const FIX_PROMPT = ${JSON.stringify(fixPrompt)}`,
    `const review = await agent(REVIEW_PROMPT, { label: '${st.label}1', phase: 'Review', ${agentType ? `agentType: '${agentType}', ` : ''}model: '${model}', ${effort ? `effort: '${effort}', ` : ''}schema: SCHEMA })`,
    "const blocking = review && Array.isArray(review.issues) ? review.issues.filter(i => i.severity === 'critical' || i.severity === 'important') : []",
    'let fix = null',
    'if (blocking.length > 0) {',
    "  const listed = blocking.map((i, k) => (k + 1) + '. [' + i.severity + (i.category ? '/' + i.category : '') + '] ' + (i.file || '') + ' ' + i.description).join('\\n')",
    "  const text = FIX_PROMPT.includes('{{issues}}') ? FIX_PROMPT.split('{{issues}}').join(listed) : FIX_PROMPT + '\\n' + listed",
    `  fix = await agent(text, { label: '${st.label}-fix1', phase: 'Review', model: 'sonnet' })`,
    '}',
    'return { review, fix }',
    '',
  ].join('\n');
}

// E26 A4: the questions arm. A fresh reader returns the questions whose answer would change the plan; with at least
// one, a single spec-author call settles them (no second read). An empty list calls nobody.
export function buildQuestionsScript({ reviewPrompt, fixPrompt, model = 'opus', effort = 'medium' }) {
  const st = STAGES['spec-review'];
  const schema = {
    type: 'object',
    properties: {
      questions: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, whyItChangesThePlan: { type: 'string' } }, required: ['q', 'whyItChangesThePlan'] } },
      headSha: { type: 'string' }, clean: { type: 'boolean' }, commitsInRange: { type: 'integer' }, [st.blobKey]: { type: 'string' },
    },
    required: ['questions', 'headSha', 'clean', 'commitsInRange', st.blobKey],
  };
  return [
    'export const meta = {',
    "  name: 'review-only',",
    "  description: 'Measurement harness: a fresh reader asks the questions that change the plan and, if there are any, one spec-author call settles them.',",
    "  phases: [{ title: 'Review', detail: 'question reader and spec author' }],",
    '}',
    `const SCHEMA = ${JSON.stringify(schema)}`,
    `const REVIEW_PROMPT = ${JSON.stringify(reviewPrompt)}`,
    `const FIX_PROMPT = ${JSON.stringify(fixPrompt)}`,
    `const review = await agent(REVIEW_PROMPT, { label: '${st.label}1', phase: 'Review', model: '${model}', effort: '${effort}', schema: SCHEMA })`,
    'const questions = review && Array.isArray(review.questions) ? review.questions : []',
    'let fix = null',
    'if (questions.length > 0) {',
    "  const listed = questions.map((x, k) => (k + 1) + '. ' + x.q + ' (changes the plan: ' + x.whyItChangesThePlan + ')').join('\\n')",
    "  const text = FIX_PROMPT.split('{{questions}}').join(listed)",
    `  fix = await agent(text, { agentType: 'productivity-tools:spec-author', label: '${st.label}-fix1', phase: 'Review' })`,
    '}',
    'return { review, fix }',
    '',
  ].join('\n');
}

// ---- E26 A1: --rounds loop, the product's review loop (DEC-723) ----

// Options of the measured stage loop (roadmap-release.js, spec and plan stages) plus the reviewer effort and MAXFIX default.
export const STAGE_LOOP = {
  'spec-review': { tier: 'opus', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 },
  'plan-review': { tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 },
};
// The options literal each stage passes to reviewLoop, searched only inside that stage's call (the plan one repeats in the delta stage).
const STAGE_CALL = {
  'spec-review': { call: "reviewLoop('spec',", literal: "{ tier: 'opus', reviewModel: 'opus' })", name: 'spec' },
  'plan-review': { call: "reviewLoop('plan',", literal: "{ tier: 'sonnet', reviewModel: 'opus' })", name: 'plan' },
};
const MAXFIX_LITERAL = 'intArg(A.maxFixRounds, 2, 0)';
const REVIEW_OPTS_LITERAL = "model: 'opus', effort: 'medium' }";
const FIX_OPTS_LITERAL = 'model: tier, effort: effortFor(tier) }';
export const LOOP_RM = 'docs/plans/roadmap-sandbox/';
const LOOP_SCRIPT_LIMIT = 200000;

// The `// <pure>` block by the loadPure rule (lines split on \r?\n, joined with \n), and its sha256.
export function extractPure(workflowText) {
  const lines = String(workflowText).split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '// <pure>');
  const end = lines.findIndex((l) => l.trim() === '// </pure>');
  if (start === -1 || end === -1 || end < start) throw new UsageError('--rounds loop: the measured workflow has no "// <pure>" ... "// </pure>" block');
  const pure = lines.slice(start + 1, end).join('\n');
  return { pure, sha256: createHash('sha256').update(pure).digest('hex') };
}

// Refuses a measured workflow the loop harness would not reproduce; returns the pure block.
export function checkLoopWorkflow(workflowText, stage) {
  const sc = STAGE_CALL[stage];
  if (!sc) throw new UsageError(`--rounds loop only applies to --stage spec-review or plan-review (got ${stage})`);
  const text = lf(workflowText);
  const { pure } = extractPure(text);
  if (!/^async function runReviewLoop\(/m.test(pure)) throw new UsageError('--rounds loop: the measured workflow has no function runReviewLoop in its pure block (DEC-723)');
  if (!text.includes(MAXFIX_LITERAL)) throw new UsageError(`--rounds loop: ${MAXFIX_LITERAL} is gone from the measured workflow (the maxFixRounds default may have changed)`);
  const at = text.indexOf(sc.call);
  const next = at < 0 ? -1 : text.indexOf('reviewLoop(', at + sc.call.length);
  const slice = at < 0 ? '' : text.slice(at, next < 0 ? text.length : next);
  if (!slice.includes(sc.literal)) throw new UsageError(`--rounds loop: the ${sc.name} stage of the measured workflow no longer passes ${sc.literal} to reviewLoop (options drift)`);
  // STAGE_LOOP hardcodes the reviewer (opus/medium) and the fixer (tier/effortFor(tier)): their agent() options must still say so.
  if (!slice.includes(REVIEW_OPTS_LITERAL)) throw new UsageError(`--rounds loop: the ${sc.name} reviewer of the measured workflow no longer runs with ${REVIEW_OPTS_LITERAL} (reviewer model/effort drift)`);
  if (!slice.includes(FIX_OPTS_LITERAL)) throw new UsageError(`--rounds loop: the ${sc.name} fixer of the measured workflow no longer runs with ${FIX_OPTS_LITERAL} (fixer model/effort drift)`);
  return pure;
}

// The review-only.js of --rounds loop: the pure block literally, then the harness (H_ names) running runReviewLoop.
export function buildLoopScript({ stage, pure, reviewBody, measure, fixPrompt }) {
  const st = STAGES[stage];
  const opt = STAGE_LOOP[stage];
  if (!st || !opt) throw new UsageError(`--rounds loop only applies to --stage spec-review or plan-review (got ${stage})`);
  const body = reviewBody.split('${RM}').join(LOOP_RM);
  const fix = fixPrompt.includes('{{issues}}') ? fixPrompt : fixPrompt + '\n{{issues}}';
  const text = [
    'export const meta = {',
    "  name: 'review-only',",
    "  description: 'Measurement harness: the review loop of one stage (runReviewLoop of the measured workflow) on a seeded artifact.',",
    "  phases: [{ title: 'Review', detail: 'reviewer and fixer of one stage, in rounds' }],",
    '}',
    pure,
    `const H_SCHEMA = ${JSON.stringify(reviewSchema(st))}`,
    `const H_REVIEW_BODY = ${JSON.stringify(body)}`,
    `const H_MEASURE = ${JSON.stringify(measure)}`,
    `const H_FIX = ${JSON.stringify(fix)}`,
    `const H_LABEL = ${JSON.stringify(st.label)}`,
    `const H_STAGE = ${JSON.stringify(STAGE_CALL[stage].name)}`,
    `const H_OPT = ${JSON.stringify({ tier: opt.tier, reviewModel: opt.reviewModel })}`,
    'const H_accepted = []',
    `const H_env = { maxFix: ${opt.maxFix}, blqIds: new Set(), reviews: [], concerns: [], acceptRisks: (s, iss) => { H_accepted.push(...iss) } }`,
    `const H_review = (round, prev) => agent(H_REVIEW_BODY + (prev ? '\\nIssues from the previous round (' + repeatRule() + '):\\n' + prev : '') + H_MEASURE, { label: H_LABEL + round, phase: 'Review', model: ${JSON.stringify(opt.reviewModel)}, effort: ${JSON.stringify(opt.reviewEffort)}, schema: H_SCHEMA })`,
    "const H_fix = async (iss, k, tier) => {",
    "  const fx = await agent(H_FIX.split('{{issues}}').join(fmt(iss)), { label: H_LABEL + '-fix' + k, phase: 'Review', model: tier, effort: effortFor(tier) })",
    "  return fx ? { status: 'DONE' } : null",
    '}',
    "const H_truth = r => reviewTruth(r, 0, 'main..HEAD')",
    'const H_result = await runReviewLoop(H_env, H_STAGE, H_review, H_fix, H_truth, H_OPT)',
    'return { ok: H_result.ok, kind: H_result.kind || null, msg: H_result.msg || null, reviews: H_env.reviews, accepted: H_accepted }',
    '',
  ].join('\n');
  if (text.length > LOOP_SCRIPT_LIMIT) throw new UsageError(`--rounds loop: the generated script has ${text.length} characters, over the 200,000 limit`);
  return text;
}

function reviewSchema(st) {
  const props = {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'important', 'minor'] },
          category: { type: 'string', enum: ['defeito', 'decisao', 'ambiente', 'fora-do-escopo', 'pelo-plano'] },
          description: { type: 'string' }, file: { type: 'string' }, blq: { type: 'string' },
        },
        required: ['severity', 'description'],
      },
    },
    summary: { type: 'string' }, headSha: { type: 'string' }, clean: { type: 'boolean' }, commitsInRange: { type: 'integer' },
  };
  const required = ['issues', 'headSha', 'clean', 'commitsInRange'];
  if (st.blobKey) {
    props[st.blobKey] = { type: 'string' };
    required.push(st.blobKey);
  }
  return { type: 'object', properties: props, required };
}

// Same-commit rule: review and fix arms come from one commit. The plan-fix check fragment is exempt: the plan arms stay
// frozen by DEC-310 at a commit that has no check line, so the fragment comes from a later one; assertArmsCurrent checks it
// against the measured workflow and armCommits.fixCheck records its commit.
export function assertArmCommits(review, fixArm, fixCheck) {
  if (review?.source?.commit !== fixArm?.source?.commit) throw new UsageError('review and fix arm templates were copied from different commits');
  if (fixCheck && !fixCheck.source?.commit) throw new UsageError('the fix-check arm template has no source commit');
}

function prepareHarness(opts) {
  const { stage } = opts;
  if (!stage) {
    if (opts.rounds !== undefined) throw new UsageError('--rounds only applies with --stage spec-review or plan-review');
    return null;
  }
  const st = STAGES[stage];
  if (!st) throw new UsageError(`--stage must be spec-review, plan-review or task-review (got "${stage}")`);
  if (!st.variant.test(opts.variant)) throw new UsageError(`--stage ${stage} does not accept the variant "${opts.variant}"`);
  let reviewModel = null;
  if (stage === 'task-review') {
    if (!REVIEW_MODELS.includes(opts.reviewModel)) throw new UsageError(`--review-model is required with --stage task-review and must be one of ${REVIEW_MODELS.join(', ')} (got "${opts.reviewModel ?? ''}")`);
    reviewModel = opts.reviewModel;
  } else if (opts.reviewModel !== undefined) {
    throw new UsageError(`--review-model only applies to --stage task-review (got --stage ${stage})`);
  }
  const arm = opts.arm ?? 'atual';
  if (!/^[A-Za-z0-9_-]+$/.test(arm)) throw new UsageError(`invalid --arm: ${arm}`);
  const armsDir = resolve(opts.armsDir ?? join(here, 'arms'));
  const current = arm === 'atual';
  if (current && stage === 'spec-review' && /^spec-semeado-/.test(opts.variant)) {
    throw new UsageError(`--stage spec-review --arm atual does not accept ${opts.variant}: its spec has no spec/1 data block, but the current fixer is told to run spec-tool check on it, so the result would not compare with the 19ab712 baseline; use spec-nativo-A/B`);
  }
  if (arm === 'perguntas' && stage !== 'spec-review') throw new UsageError(`--arm perguntas only applies to --stage spec-review (got --stage ${stage})`);
  const rounds = opts.rounds ?? 'single';
  if (rounds !== 'single' && rounds !== 'loop') throw new UsageError(`--rounds must be loop or single (got "${rounds}")`);
  if (rounds === 'loop' && (!STAGE_LOOP[stage] || !current)) throw new UsageError(`--rounds loop only applies to --stage spec-review or plan-review with --arm atual (got --stage ${stage} --arm ${arm})`);
  const builtIn = stage === 'task-review' && current; // the prompt comes from the workflow itself
  let review = null;
  let workflowCommit = null;
  let armSource = 'modelo';
  let fixCheck = null;
  const fixArm = builtIn ? null : readArm(join(armsDir, `${st.fix}-${arm}.md`), { requireSource: current });
  if (builtIn) {
    armSource = 'workflow';
  } else {
    review = readArm(join(armsDir, `${stage}-${arm}.md`), { requireSource: current });
    if (current) {
      if (/^plano-nativo-/.test(opts.variant)) fixCheck = readArm(join(armsDir, 'plan-fix-check-atual.md'), { requireSource: true });
      assertArmCommits(review, fixArm, fixCheck);
      armSource = 'copia-do-prompt';
      workflowCommit = review.source.commit;
    }
  }
  const reviewEffort = reviewModel ? reviewEffortFor(reviewModel) : null;
  const reviewer = reviewModel ? { model: reviewModel, effort: reviewEffort } : {};
  const armCommits = { review: review?.source?.commit ?? null, fix: fixArm?.source?.commit ?? null, fixCheck: fixCheck?.source?.commit ?? null };
  return { stage, arm, rounds, st, review, fixArm, fixCheck, reviewer, harness: { stage, arm, armSource, workflowCommit, armCommits, ...(reviewModel ? { reviewModel, reviewEffort } : {}), rounds } };
}

const slash = (p) => p.replace(/\\/g, '/');

function harnessPrompts(h, scenario) {
  const sb = slash(scenario.dir);
  const paths = scenario.paths ?? E5_PATHS;
  const tools = h.installPath && h.installPath !== 'unknown' ? `${slash(h.installPath)}/scripts` : '<plugin>/scripts';
  // Every placeholder of the arms (A2): the product's names, with the sandbox paths and the measured plugin's tools.
  const vars = {
    artifactPath: `${sb}/${h.st.artifact === 'spec' ? paths.spec : paths.plan}`,
    specPath: `${sb}/${paths.spec}`,
    cardRef: 'card E5 of docs/plans/roadmap-sandbox/ (the sandbox roadmap)',
    repo: sb,
    E: 'E5',
    RM: LOOP_RM,
    rmAbs: `${sb}/${LOOP_RM.replace(/\/+$/, '')}`,
    specTool: `${tools}/spec-tool.mjs`,
    planTool: `${tools}/plan-tool.mjs`,
    specAbs: `${sb}/${paths.spec}`,
    planAbs: `${sb}/${paths.plan}`,
  };
  const measure = (key) =>
    `\nMeasure: headSha, clean (status --porcelain empty), commitsInRange (git -C "${sb}" rev-list --count main..HEAD)${key ? `, ${key} = the output of git -C "${sb}" rev-parse "HEAD:${paths[h.st.artifact]}", run by you` : ''}.`;
  if (h.stage === 'task-review' && h.arm === 'atual') {
    let plan = '';
    try {
      plan = readFileSync(join(scenario.dir, E5_PATHS.plan), 'utf8');
    } catch {
      /* the title falls back below */
    }
    const title = /^### Task 3: (.+?)\s*$/m.exec(plan)?.[1] ?? 'task 3';
    const ctx = {
      base: `You work in the sandbox ${sb}. Do NOT perform any external effect.`, envFacts: null, baseline: null, E: 'E5', target: 'main',
      wt: sb, planPath: E5_PATHS.plan, specPath: E5_PATHS.spec, locks: [], start: `${scenario.seededCommit}~1`, prev: null,
    };
    const impl = { summary: 'Task resumed from a previous run: implemented in the seeded commit.', checks: [] };
    // E21 moved the generic review rules into agents/task-reviewer.md: measure the reviewer the workflow really dispatches.
    return {
      agentType: 'productivity-tools:task-reviewer',
      reviewPrompt: loadPure().buildTaskReviewPrompt(ctx, { n: 3, title }, 'spec', impl),
      fixPrompt: `In Task 3 of the plan ${sb}/${E5_PATHS.plan}, fix the spec problems below, run the task's checks and commit "E5 T3: fix ...". Do NOT perform any external effect. STOP after this fix. Never edit the spec or the plan to satisfy a finding. Report in "checks" every verification you ran, with the exact command, real output and exit code.\n{{issues}}`,
    };
  }
  const reviewBody = fill(h.review.text, vars).trimEnd();
  const measured = measure(h.stage === 'task-review' ? null : h.st.blobKey);
  return {
    reviewPrompt: reviewBody + measured,
    reviewBody,
    measure: measured,
    // e5-native plan variants: the check line of the measured plan fixer is appended (plan-fix-atual.md stays frozen, DEC-310).
    fixPrompt: fill(h.fixArm.text, { ...vars, issues: '{{issues}}', questions: '{{questions}}' }).trimEnd() + (h.fixCheck ? '\n' + fill(h.fixCheck.text, vars).trim() : ''),
  };
}

// E5 reached release/sandbox: the release merges it with the subject "merge: E5 in release/sandbox" (the run names its spec and plan by its own date).
export function e5Integrated(sandbox) {
  try {
    return gitOut(sandbox, 'log', '--first-parent', '--format=%s', 'release/sandbox').split(/\r?\n/).some((l) => l.startsWith('merge: E5 in release/sandbox'));
  } catch {
    return false;
  }
}

// Registry panel of the release variants, read with the measured plugin's own CLI (E17). Vocabulary of the sandbox folder:
// the target release/sandbox is not the integrationBranch, so the workflow records on-branch after the merge and plan in plan-only.
export const PANEL_VARIANTS = ['plan-only', 'completo', 'parada-retomada'];
export const EXPECTED_PANEL = {
  // plan-only runs `plan-only E1` (make-scenario.mjs), so its row is E1; the others run E5.
  'plan-only': { deliverable: 'E1', status: 'plan', mergeEvidence: false },
  completo: { deliverable: 'E5', status: 'on-branch', mergeEvidence: true },
  'parada-retomada': { deliverable: 'E5', status: 'on-branch', mergeEvidence: true },
};

// An error text can carry a temporary or install path; the aggregate never holds personal paths.
export const redactPaths = (s) => s.replace(/[A-Za-z]:[\\/][^\s'"]*|(?:\/[^\s'"\/]+){2,}/g, '<path>');

// Never throws: any failure (missing CLI, non-JSON output, exit other than 0/1) is { error }.
// The committed state of release/sandbox is read in a detached temporary worktree: a checkout in the sandbox root is refused
// when the release preflight keeps that branch in <sandbox>-wt/_integracao. The fields e5Status/e5Evidence hold the row of `deliverable`.
export function readPanel(sandbox, installPath, { exec = spawnSync, deliverable = 'E5' } = {}) {
  let tmp = null;
  try {
    if (!gitOk(sandbox, 'rev-parse', '--verify', '-q', 'refs/heads/release/sandbox')) return { error: 'release/sandbox missing' };
    tmp = mkdtempSync(join(tmpdir(), 'panel-'));
    const cwd = join(tmp, 'wt');
    gitOut(sandbox, 'worktree', 'add', '-q', '--detach', cwd, 'refs/heads/release/sandbox');
    const scripts = join(installPath, 'skills', 'roadmap-tracker', 'scripts');
    const run = (script, args) => {
      const r = exec(process.execPath, [join(scripts, script), ...args], { cwd, encoding: 'utf8' });
      if (!r || (r.status !== 0 && r.status !== 1)) throw new Error(`${script} exited ${r?.status ?? 'without status'}`);
      try {
        return JSON.parse(r.stdout ?? '');
      } catch {
        throw new Error(`${script} printed no JSON`);
      }
    };
    const status = run('roadmap.mjs', ['status', 'docs/plans/roadmap-sandbox', '--json']);
    const row = (status.result?.panel ?? []).find((p) => p.id === deliverable);
    if (!row) throw new Error(`no ${deliverable} row in the panel`);
    const checker = run('check-roadmap.mjs', ['docs/plans/roadmap-sandbox', '--json']);
    const merge = gitOut(sandbox, 'log', '--first-parent', '--format=%H%x09%s', 'release/sandbox')
      .split(/\r?\n/)
      .map((l) => l.split('\t'))
      .find(([, s]) => s?.startsWith('merge: E5 in release/sandbox'));
    return {
      e5Status: row.segments?.[0]?.word ?? '',
      e5Evidence: row.evidence ?? '',
      mergeCommit: merge ? merge[0] : null,
      checkerErrors: checker.summary?.errors ?? (checker.errors ?? []).length,
    };
  } catch (e) {
    return { error: redactPaths(String(e?.message ?? e)) };
  } finally {
    if (tmp) {
      try { gitOut(sandbox, 'worktree', 'remove', '--force', join(tmp, 'wt')); } catch { /* never created */ }
      try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }
}

export function panelMatches(variant, panel) {
  const want = EXPECTED_PANEL[variant];
  const reasons = [];
  if (!want) return { ok: false, reasons: [`no expected panel for variant ${variant}`] };
  if (!panel || panel.error) return { ok: false, reasons: [`panel unreadable: ${panel?.error ?? 'missing'}`] };
  if (panel.e5Status !== want.status) reasons.push(`E5 status is "${panel.e5Status}", expected "${want.status}"`);
  if (panel.checkerErrors !== 0) reasons.push(`checker reports ${panel.checkerErrors} errors`);
  if (want.mergeEvidence) {
    if (!panel.mergeCommit) reasons.push('no merge commit of E5 in release/sandbox');
    else if (!String(panel.e5Evidence ?? '').includes(panel.mergeCommit.slice(0, 7))) reasons.push('E5 evidence does not cite the merge commit');
  }
  return { ok: reasons.length === 0, reasons };
}

// A release run that launched no subagent at all stopped before doing anything (e.g. at preflight).
export function releaseRunValidity(variant, run) {
  if (variant !== 'completo' && variant !== 'parada-retomada') return { valid: true, reason: 'ok' };
  const calls = run?.total?.calls ?? {};
  return sumCalls(calls) === 0 ? { valid: false, reason: 'sem-agentes' } : { valid: true, reason: 'ok' };
}

// A resume session that launched no subagent did not resume anything (E15 finding 11, analogous to sem-agentes).
// `run` holds the metrics of the resume session alone.
export function resumeRunValidity(run) {
  const calls = run?.total?.calls ?? {};
  return sumCalls(calls) === 0 ? { valid: false, reason: 'retomada-sem-agentes' } : { valid: true, reason: 'ok' };
}

// Worktree that holds release/sandbox, or null (the release keeps it in <sandbox>-wt/_integracao while a stage runs).
function releaseWorktreeOf(sandbox) {
  for (const block of gitOut(sandbox, 'worktree', 'list', '--porcelain').split(/\r?\n\r?\n/)) {
    const wt = /^worktree (.+)$/m.exec(block)?.[1];
    if (wt && /^branch refs\/heads\/release\/sandbox$/m.test(block)) return wt;
  }
  return null;
}

// D2 (E17): between the stop and the resume of parada-retomada, ratifies the pending E5 decisions of contract scope with the
// measured plugin's own tracker CLI (same install path and roadmap folder as readPanel), in the release/sandbox worktree, and
// commits there. No model call. Never throws: { ok: true, ratified: [DEC...] } or { ok: false, reason }.
export function ratifyE5Contract(sandbox, installPath, { exec = spawnSync } = {}) {
  let tmp = null;
  try {
    if (!gitOk(sandbox, 'rev-parse', '--verify', '-q', 'refs/heads/release/sandbox')) throw new Error('release/sandbox missing');
    let cwd = releaseWorktreeOf(sandbox);
    if (cwd === null) {
      tmp = mkdtempSync(join(tmpdir(), 'ratify-'));
      cwd = join(tmp, 'wt');
      gitOut(sandbox, 'worktree', 'add', '-q', cwd, 'release/sandbox');
    }
    if (gitOut(cwd, 'status', '--porcelain') !== '') return { ok: false, reason: 'integracao-suja' };
    const script = join(installPath, 'skills', 'roadmap-tracker', 'scripts', 'roadmap.mjs');
    const folder = 'docs/plans/roadmap-sandbox';
    const run = (args) => {
      const r = exec(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
      if (!r || r.status !== 0) throw new Error(`roadmap.mjs ${args[0]} exited ${r?.status ?? 'without status'}`);
      return r;
    };
    const pendingE5 = () => {
      let json;
      try {
        json = JSON.parse(run(['pending-decisions', folder, '--json']).stdout ?? '');
      } catch (e) {
        throw new Error(e instanceof SyntaxError ? 'pending-decisions printed no JSON' : e.message);
      }
      const list = json.result?.decisions ?? json.decisions;
      if (!Array.isArray(list)) throw new Error('pending-decisions has no decisions list');
      return list.filter((d) => d.scope === 'contract' && /\bE5\b/.test(String(d.deliverable ?? ''))).map((d) => d.id);
    };
    const ids = pendingE5();
    if (ids.length === 0) return { ok: true, ratified: [] };
    run(['ratify', folder, ...ids, '--json']);
    if (pendingE5().length > 0) return { ok: false, reason: 'decisao-pendente-apos-ratificar' };
    gitOut(cwd, 'add', '-A', '--', folder);
    gitOut(cwd, '-c', 'user.name=measure', '-c', 'user.email=measure@example.invalid', 'commit', '-q', '-m', `chore(sandbox): ratify E5 contract decisions ${ids.join(' ')}`);
    return { ok: true, ratified: ids };
  } catch (e) {
    console.error(`ratify E5: ${redactPaths(String(e?.message ?? e))}`);
    return { ok: false, reason: 'ratificacao-falhou' };
  } finally {
    if (tmp) {
      try { gitOut(sandbox, 'worktree', 'remove', '--force', join(tmp, 'wt')); } catch { /* never created */ }
      try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }
}

// Validity of a review-stage attempt: the journal must carry the stage review with its fields.
function harnessValidity(h, variant, journal, scenario) {
  if (journal.formatError) return INVALID_FORMAT;
  if (h.stage === 'spec-review') return checkValidity(variant, journal, scenario);
  if (h.stage === 'plan-review') {
    // the harness has no E5:plan agent: the plan is seeded and reused by construction
    return checkValidity(variant, { ...journal, entries: [...journal.entries, { label: 'E5:plan', result: { reused: true }, text: '' }] }, scenario);
  }
  return Array.isArray(find(journal.entries, 'E5:task-review1')?.result?.issues) ? { valid: true, reason: 'ok' } : INVALID_FORMAT;
}

// approved: the review did not block, or the fixer ran and changed at least one seeded defect.
function harnessStage(h, entries, presents) {
  const review = find(entries, `${h.st.label}1`);
  if (!review) return 'stopped';
  if (h.arm === 'perguntas') {
    const questions = review.result?.questions;
    if (Array.isArray(questions) && questions.length === 0) return 'approved';
    return find(entries, `${h.st.label}-fix1`) !== undefined && presents.some((p) => p === false) ? 'approved' : 'stopped';
  }
  const issues = review.result?.issues;
  if (!(Array.isArray(issues) && issues.some((i) => BLOCKING.has(i?.severity)))) return 'approved';
  const fixed = find(entries, `${h.st.label}-fix1`) !== undefined;
  return fixed && presents.some((p) => p === false) ? 'approved' : 'stopped';
}

// ---- E26 A1: loop result, outcomes after the 1st fix, tool check and human inputs (T6) ----

// A journal entry whose agent returned nothing (the raw line carries no result).
function nullResult(entry) {
  if (!entry) return true;
  if (entry.result) return false;
  const raw = parseObject(entry.text ?? '');
  const v = raw ? (raw.result ?? raw.resultJson) : undefined;
  return v === null || v === undefined || v === '';
}

// Loop mode: when review 1 came back null, the retry 1b stands in for it (validity and stage read review 1).
function loopEntries(h, entries) {
  const r1 = find(entries, `${h.st.label}1`);
  const r1b = find(entries, `${h.st.label}1b`);
  if (r1b && (!r1 || nullResult(r1))) return [{ ...r1b, label: `${h.st.label}1` }, ...entries.filter((e) => e !== r1 && e !== r1b)];
  return entries;
}

// Replays the measured runReviewLoop over the journal: the same rounds, tiers and stop the script went through.
// `entries` is the raw journal (review 1 and its retry 1b as written). Returns { infra: true } when a review or fix the loop
// asked for is missing or null (laco-infra), and { divergent: true } when the journal holds stage entries the replay did not
// use, or repeats a stage label (laco-divergente): the replay then is not the run the script went through.
async function loopResult(h, entries, P) {
  const opt = STAGE_LOOP[h.stage];
  const label = h.st.label;
  let reviews = 0;
  const fixTiers = [];
  const used = new Set();
  const take = (l) => {
    const e = find(entries, l);
    if (e) used.add(l);
    return e;
  };
  const env = { maxFix: opt.maxFix, blqIds: new Set(), reviews: [], concerns: [], acceptRisks: () => {} };
  const review = async (round) => {
    const e = take(`${label}${round}`);
    if (!e || !e.result) return null;
    reviews += 1;
    return e.result;
  };
  const fix = async (iss, k, tier) => {
    const e = take(`${label}-fix${k}`);
    if (nullResult(e)) return null;
    fixTiers.push(tier);
    return { status: 'DONE' };
  };
  const res = await P.runReviewLoop(env, STAGE_CALL[h.stage].name, review, fix, (r) => P.reviewTruth(r, 0, 'main..HEAD'), { tier: opt.tier, reviewModel: opt.reviewModel });
  if (res.kind === 'infra') return { infra: true };
  const stageLabels = entries.map((e) => e.label).filter((l) => l.startsWith(label));
  if (new Set(stageLabels).size !== stageLabels.length || stageLabels.some((l) => !used.has(l))) return { divergent: true };
  return { reviews, fixes: fixTiers.length, fixTiers, ok: res.ok === true, kind: res.ok ? null : res.kind ?? null };
}

// The SHA reported by reviewer 2 counts only when it is the state reviewer 2 really measured, right after the 1st fix.
function afterFixVerified(h, entries, scenario, sha, fixes) {
  const dir = scenario.dir;
  const artifact = (scenario.paths ?? E5_PATHS)[h.st.artifact];
  const blob = find(entries, `${h.st.label}2`)?.result?.[h.st.blobKey];
  if (!/^[0-9a-f]{7,64}$/.test(sha) || !gitOk(dir, 'cat-file', '-e', `${sha}^{commit}`)) return false;
  if (!scenario.seededCommit || !gitOk(dir, 'merge-base', '--is-ancestor', scenario.seededCommit, sha) || !gitOk(dir, 'merge-base', '--is-ancestor', sha, 'feat/E5')) return false;
  let atSha;
  try {
    atSha = gitOut(dir, 'rev-parse', `${sha}:${artifact}`);
  } catch {
    return false;
  }
  if (typeof blob !== 'string' || blob.trim() !== atSha) return false;
  if (fixes === 1 && gitOut(dir, 'rev-parse', `${sha}^{commit}`) !== gitOut(dir, 'rev-parse', 'feat/E5')) return false;
  return true;
}

// Stage of the two branches, as the spec sets them (A1): without a 1st fix the state after it is the end state, so the outcomes
// (and their stage, the loop verdict) are the end ones; with a fix, the outcomes at headSha take the stage from harnessStage
// (review 1 did not block, or the fixer ran and removed a seeded defect), since the loop had not ended there.
async function afterFirstFix(h, variant, scenario, journal, endOutcomes, reachable) {
  const entries = journal.entries;
  if (!find(entries, `${h.st.label}-fix1`)) return { headSha: null, verified: true, outcomes: endOutcomes };
  const r2 = entries.findIndex((e) => e.label === `${h.st.label}2`);
  const reported = r2 >= 0 ? entries[r2].result?.headSha : undefined;
  const sha = typeof reported === 'string' ? reported.trim() : '';
  const fixes = entries.filter((e) => new RegExp(`^${h.st.label}-fix\\d+$`).test(e.label)).length;
  if (!reachable || !afterFixVerified(h, entries, scenario, sha, fixes)) {
    return { headSha: sha || null, verified: false, outcomes: endOutcomes.map((o) => ({ ...o, outcome: 'indeterminado' })) };
  }
  // Code signals count only up to review 2: later rounds are not part of the state after the 1st fix.
  const upTo = { ...journal, entries: entries.slice(0, r2 + 1) };
  const outcomes = await attemptOutcomes(variant, scenario, upTo, (presents) => harnessStage(h, upTo.entries, presents), true, sha);
  return { headSha: sha, verified: true, outcomes };
}

// Exit of the measured plugin's own check on the artifact at the tip of feat/E5 (the sandbox root), or null when it cannot run.
function toolCheck(h, scenario, installPath, reachable) {
  if (!reachable || !installPath || installPath === 'unknown') return { exit: null };
  const paths = scenario.paths ?? E5_PATHS;
  const dir = scenario.dir;
  const tool = join(installPath, 'scripts', h.st.artifact === 'spec' ? 'spec-tool.mjs' : 'plan-tool.mjs');
  if (!existsSync(tool)) return { exit: null };
  const args = h.st.artifact === 'spec'
    ? [tool, 'check', join(dir, paths.spec), '--roadmap', join(dir, LOOP_RM.replace(/\/+$/, ''))]
    : [tool, 'check', join(dir, paths.plan), '--spec', join(dir, paths.spec)];
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
  return { exit: typeof r.status === 'number' ? r.status : null };
}

// The spec-author never commits (the product's commitAgent does): when the spec is dirty after the session, commit it here.
function commitAuthorEdit(scenario) {
  const spec = (scenario.paths ?? E5_PATHS).spec;
  try {
    gitOut(scenario.dir, 'checkout', '-q', 'feat/E5');
    if (gitOut(scenario.dir, 'status', '--porcelain', '--', spec).trim() === '') return false;
    gitOut(scenario.dir, 'add', '--', spec);
    gitOut(scenario.dir, '-c', 'user.name=measure', '-c', 'user.email=measure@example.invalid', 'commit', '-q', '-m', 'E5: spec', '--', spec);
    return true;
  } catch {
    return false;
  }
}

// Blocking needsPerson items of the spec/1 json data block at a ref, or null when the block cannot be read.
function blockingHumanInputs(scenario, ref) {
  try {
    const text = lf(gitOut(scenario.dir, 'show', `${ref}:${(scenario.paths ?? E5_PATHS).spec}`));
    const m = /```json data\n([\s\S]*?)\n```/.exec(text);
    if (!m) return null;
    const np = JSON.parse(m[1]).needsPerson;
    return Array.isArray(np) ? np.filter((x) => x && x.blocking === true).length : null;
  } catch {
    return null;
  }
}

export async function runBatch(opts, { exec = defaultExec, now = () => new Date(), ratify = ratifyE5Contract } = {}) {
  const { variant, runs } = opts;
  const seeded = /semeado|nativo/.test(variant);
  if (opts.fromRun && !seeded) throw new UsageError(`--from-run only applies to seeded variants (got "${variant}")`);
  const h = prepareHarness(opts);
  const pluginDir = opts.pluginDir ? resolve(opts.pluginDir) : null; // claude -p runs in the sandbox: it needs the absolute path
  if (pluginDir) opts = { ...opts, pluginDir };
  const plugin = pluginDir ? readPluginDir(pluginDir) : readPlugin(opts.configDir);
  if (h && h.stage === 'task-review' && h.arm === 'atual') {
    const agentFile = plugin.installPath && plugin.installPath !== 'unknown' ? join(plugin.installPath, 'agents', 'task-reviewer.md') : null;
    if (!agentFile || !existsSync(agentFile)) throw new UsageError(`task-review with arm atual needs agents/task-reviewer.md in the measured plugin (${pluginDir ? '--plugin-dir' : 'installed plugin'})`);
  }
  if (h && h.arm === 'atual' && h.stage !== 'task-review') {
    const wfFile = plugin.installPath && plugin.installPath !== 'unknown' ? join(plugin.installPath, 'skills', 'roadmap-release', 'workflow', 'roadmap-release.js') : null;
    if (wfFile && existsSync(wfFile)) {
      const wfText = readFileSync(wfFile, 'utf8');
      assertArmsCurrent(h, wfText);
      if (h.rounds === 'loop') {
        h.pure = checkLoopWorkflow(wfText, h.stage);
        h.loopFns = loadPure(wfFile); // the loop result is replayed with the measured workflow's own functions
        h.harness.pureSha256 = extractPure(wfText).sha256;
        h.harness.stageOptions = { ...STAGE_LOOP[h.stage] };
      }
    } else if (!wfFile) throw new UsageError(`the measured plugin was not found (installed ${PLUGIN_KEY} missing from installed_plugins.json, or no installPath): cannot check the arm templates`);
    else throw new UsageError(`${pluginDir ? '--plugin-dir' : 'the installed plugin'} has no skills/roadmap-release/workflow/roadmap-release.js to check the arm templates against`);
  }
  if (h) {
    h.installPath = plugin.installPath;
    let harnessCommit = null;
    try {
      harnessCommit = execFileSync('git', ['-C', here, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || null;
    } catch {
      /* not a repo */
    }
    h.harness.harnessCommit = harnessCommit;
    if (harnessCommit && plugin.commit && plugin.commit !== 'unknown' && plugin.commit !== harnessCommit) {
      console.error(`run-batch: warning: harnessCommit ${harnessCommit} differs from the measured plugin commit ${plugin.commit} (prompt and agent come from different commits)`);
    }
  }
  const dir = join(resolve(opts.out), `${variant}${h ? `-${h.stage}-${h.arm}${h.harness.reviewModel ? `-${h.harness.reviewModel}` : ''}${h.rounds === 'loop' ? '-loop' : ''}` : ''}-${stamp(now())}`);
  const priv = join(dir, 'private');
  mkdirSync(priv, { recursive: true });
  const superpowers = readSuperpowers(opts.configDir);
  const seedSource = seeded ? seedSourceOf(opts.fromRun, { set: artifactOf(variant)?.set }) : undefined;
  const cli = (await exec('claude', ['--version'], {})).stdout.trim();

  const attempts = [];
  const privateAttempts = [];
  const validRuns = [];
  for (let k = 1; k <= runs; k++) {
    const scenario = await makeScenario(join(resolve(opts.work), `${variant}-${k}`), variant, { fromRun: opts.fromRun });
    const sessions = [];
    const cliCosts = [];
    let denied = false;
    let failed = false;
    let failReason = 'execucao-falhou';
    const stop = scenario.stopResume ?? (variant === 'parada-retomada' ? STOP_RESUME : null);
    let ratified = null;
    let resumeFrom = 1;
    const extra = () => (ratified ? { ratified } : {});
    let launchOpts = opts;
    if (h) {
      gitOut(scenario.dir, 'checkout', '-q', 'feat/E5'); // makeScenario leaves the root on main; the harness reviews and fixes on feat/E5
      const prompts = harnessPrompts(h, scenario);
      const script = h.arm === 'perguntas'
        ? buildQuestionsScript({ reviewPrompt: prompts.reviewPrompt, fixPrompt: prompts.fixPrompt })
        : h.rounds === 'loop'
        ? buildLoopScript({ stage: h.stage, pure: h.pure, reviewBody: prompts.reviewBody, measure: prompts.measure, fixPrompt: prompts.fixPrompt })
        : buildReviewOnlyScript({ stage: h.stage, ...h.reviewer, ...prompts });
      writeFileSync(join(scenario.dir, 'review-only.js'), script);
      excludeFromGit(scenario.dir, 'review-only.js');
      scenario.prompts = [`Run the workflow script at ${slash(scenario.dir)}/review-only.js`];
      launchOpts = { ...opts, allow: [...(opts.allow ?? []), 'Workflow'] };
    }
    for (let i = 0; i < scenario.prompts.length; i++) {
      if (stop !== null && i === 1 && !h) {
        // D2 (E17): the stopped run left executor decisions of E5 pending; the owner's ratification happens here, with no model call.
        const rat = ratify(scenario.dir, plugin.installPath);
        if (!rat.ok) {
          failed = true;
          failReason = rat.reason;
          break;
        }
        ratified = rat.ratified ?? [];
        resumeFrom = sessions.length; // sessions of the first phase (the abort may leave more than one) stay out of the resume set
      }
      const args = promptArgs(scenario.prompts[i], launchOpts);
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
      if (typeof j?.total_cost_usd === 'number') cliCosts.push(j.total_cost_usd);
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
      if (opts.stopOnDenial) break;
      continue;
    }
    if (failed || sessions.length === 0) {
      attempts.push({ n: k, ...extra(), status: 'invalid', reason: failReason });
      privateAttempts.push({ n: k, sessions, ...extra() });
      writeFileSync(join(priv, 'attempts.json'), JSON.stringify({ attempts: privateAttempts }, null, 2) + '\n');
      continue;
    }
    privateAttempts.push({ n: k, sessions, ...extra() });
    writeFileSync(join(priv, 'attempts.json'), JSON.stringify({ attempts: privateAttempts }, null, 2) + '\n');
    let journal = null;
    let loop = null;
    if (scenario.seeded?.length > 0) {
      journal = readSessionJournals(opts.configDir, sessions);
      const rawEntries = journal.entries;
      if (h?.rounds === 'loop') journal = { ...journal, entries: loopEntries(h, journal.entries) };
      let v = h ? harnessValidity(h, variant, journal, scenario) : checkValidity(variant, journal, scenario);
      if (h?.rounds === 'loop' && (v.valid || v.reason === 'formato-do-diario') && !journal.formatError) {
        // Review 1 and its retry both null is a loop infra failure, not a journal format error: the replay decides first.
        loop = await loopResult(h, rawEntries, h.loopFns);
        if (loop.infra) v = { valid: false, reason: 'laco-infra' };
        else if (v.valid && loop.divergent) v = { valid: false, reason: 'laco-divergente' };
      }
      if (!v.valid) {
        attempts.push({ n: k, ...extra(), status: 'invalid', reason: v.reason });
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
      attempts.push({ n: k, ...extra(), status: 'invalid', reason: 'extrator-falhou' });
      continue;
    }
    const run = JSON.parse(readFileSync(join(metricsDir, 'metrics.json'), 'utf8')).runs[0];
    if (!h) {
      const rv = releaseRunValidity(variant, run);
      if (!rv.valid) {
        attempts.push({ n: k, ...extra(), status: 'invalid', reason: rv.reason });
        continue;
      }
      if (stop !== null) {
        // D3 (E17): the resume session alone must have launched an agent; the whole-attempt total can come from the first session.
        if (sessions.length <= resumeFrom) {
          attempts.push({ n: k, ...extra(), status: 'invalid', reason: resumeRunValidity(undefined).reason });
          continue;
        }
        const resumeFile = join(priv, `attempts-${k}-resume.json`);
        const resumeDir = join(metricsDir, 'resume');
        writeFileSync(resumeFile, JSON.stringify({ attempts: [{ n: k, sessions: sessions.slice(resumeFrom) }] }, null, 2) + '\n');
        const rex = await exec(
          process.execPath,
          [EXTRACTOR, '--root', join(opts.configDir, 'projects'), '--out', resumeDir, '--sessions', sessions.slice(resumeFrom).join(','), '--runs', resumeFile],
          { cwd: here },
        );
        if (rex.code !== 0) {
          attempts.push({ n: k, ...extra(), status: 'invalid', reason: 'extrator-falhou' });
          continue;
        }
        const rrv = resumeRunValidity(sessions.length > resumeFrom ? JSON.parse(readFileSync(join(resumeDir, 'metrics.json'), 'utf8')).runs[0] : undefined);
        if (!rrv.valid) {
          attempts.push({ n: k, ...extra(), status: 'invalid', reason: rrv.reason });
          continue;
        }
      }
    }
    validRuns.push(run);
    let outcomes = [];
    let reachable = false;
    let authorCommitted = null;
    if (journal) {
      if (h?.arm === 'perguntas') authorCommitted = commitAuthorEdit(scenario);
      // The sentinels read the tip of feat/E5 in the working tree. The stage is read first: settling may recreate the branch.
      const stage = !h ? stageResult(variant, journal.entries, scenario.dir, scenario.seededCommit) : null;
      reachable = settleSandbox(scenario.dir, scenario.seededCommit);
      // Loop: the stage at the end is the loop's own verdict (approved when it ended ok).
      const stageOf = !h ? () => stage : loop ? () => (loop.ok ? 'approved' : 'stopped') : (presents) => harnessStage(h, journal.entries, presents);
      outcomes = await attemptOutcomes(variant, scenario, journal, stageOf, reachable);
    }
    const cliCostUsd = sumCliCost(cliCosts);
    const attempt = { n: k, ...extra(), status: 'valid', counters: { ...toAttemptCounters(run), session: { cliCostUsd } }, outcomes, rolesByLabel: rolesByLabel(run, cliCostUsd) };
    if (h && journal) attempt.review = h.arm === 'perguntas' ? questionCount(journal.entries, `${h.st.label}1`) : reviewCounts(journal.entries, `${h.st.label}1`);
    if (authorCommitted !== null) attempt.authorCommitted = authorCommitted;
    if (h && journal && loop) {
      attempt.loop = loop;
      attempt.afterFirstFix = await afterFirstFix(h, variant, scenario, journal, outcomes, reachable);
    }
    if (h && journal && artifactOf(variant)?.set === 'e5-native' && h.st.artifact) {
      attempt.toolCheck = toolCheck(h, scenario, plugin.installPath, reachable);
      if (h.st.artifact === 'spec') attempt.humanInputs = { blockingSeeded: blockingHumanInputs(scenario, scenario.seededCommit), blockingAtEnd: reachable ? blockingHumanInputs(scenario, 'feat/E5') : null };
    }
    if (!h && (variant === 'completo' || variant === 'parada-retomada')) attempt.integrated = e5Integrated(scenario.dir);
    if (PANEL_VARIANTS.includes(variant)) attempt.panel = readPanel(scenario.dir, plugin.installPath, { deliverable: EXPECTED_PANEL[variant].deliverable });
    attempts.push(attempt);
  }

  const status = (s) => attempts.filter((a) => a.status === s).length;
  const invalidReasons = {};
  for (const a of attempts) if (a.status === 'invalid') invalidReasons[a.reason] = (invalidReasons[a.reason] ?? 0) + 1;
  const costs = attempts.filter((a) => a.status === 'valid' && a.counters.cost !== null).map((a) => a.counters.cost);
  const sessionCosts = attempts.filter((a) => a.status === 'valid' && a.counters.session.cliCostUsd !== null).map((a) => a.counters.session.cliCostUsd);
  const models = FAMILIES.filter((f) => validRuns.some((r) => r.total.calls[f] > 0));
  const { installPath: _installPath, ...publicPlugin } = plugin;
  const aggregate = {
    variant,
    requested: runs,
    valid: status('valid'),
    invalid: status('invalid'),
    denied: status('denied'),
    invalidReasons,
    plugin: publicPlugin,
    superpowers,
    ...(seeded ? { seedSource } : {}),
    cli,
    models,
    pricesDate: pricesDate(),
    permissionMode: opts.permissionMode,
    attempts,
    roles: sumRoles(validRuns),
    rolesByLabel: sumRolesByLabel(attempts.filter((a) => a.status === 'valid').map((a) => a.rolesByLabel)),
    ...(h ? { harness: h.harness } : {}),
    cost: {
      ...(costs.length ? { median: median(costs), min: Math.min(...costs), max: Math.max(...costs) } : { median: null, min: null, max: null }),
      session: sessionCosts.length ? { median: median(sessionCosts), min: Math.min(...sessionCosts), max: Math.max(...sessionCosts) } : { median: null, min: null, max: null },
    },
    ...totalOutcomes(attempts),
    ...(attempts.some((a) => a.status === 'valid' && a.toolCheck) ? nativeCounts(attempts) : {}),
    ...(h?.rounds === 'loop' ? loopAggregate(attempts) : {}),
  };
  writeFileSync(join(dir, 'aggregate.json'), JSON.stringify(aggregate, null, 2) + '\n');
  return { dir, aggregate, exitCode: status('denied') + status('invalid') > 0 ? 1 : 0 };
}

const USAGE =
  'usage: node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <dir> --out <dir> --config-dir <dir> --permission-mode <modo> [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>] [--stage <spec-review|plan-review|task-review> [--arm <nome>] [--arms-dir <dir>] [--review-model <haiku|sonnet|opus>: required with task-review] [--rounds loop|single]] [--plugin-dir <dir>] [--from-run <pasta>] [--stop-on-denial]';

function parseCli(argv) {
  const o = { allow: [], addDir: [] };
  const names = {
    '--variant': 'variant', '--runs': 'runs', '--work': 'work', '--out': 'out', '--config-dir': 'configDir',
    '--permission-mode': 'permissionMode', '--allow': 'allow', '--add-dir': 'addDir', '--model': 'model',
    '--max-budget-usd': 'maxBudgetUsd', '--stage': 'stage', '--arm': 'arm', '--arms-dir': 'armsDir', '--from-run': 'fromRun',
    '--review-model': 'reviewModel', '--plugin-dir': 'pluginDir', '--rounds': 'rounds',
  };
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--stop-on-denial') {
      o.stopOnDenial = true;
      i -= 1;
      continue;
    }
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
    process.exitCode = e instanceof UsageError ? 2 : 1;
  }
}
