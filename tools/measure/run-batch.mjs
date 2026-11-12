#!/usr/bin/env node
// Batch launcher: runs one measurement variant n times in disposable sandboxes and writes an aggregate.
// Usage: node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <dir> --out <dir> --config-dir <dir>
//          --permission-mode <modo> [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>]
//          [--stage spec-review|plan-review|task-review [--arm <nome>] [--arms-dir <dir>]]
// With --stage the batch runs only that review stage on a seeded artifact (review-only.js harness).
// Exit codes: 0 all attempts ran, 1 a denied or failed attempt, 2 usage error.
// aggregate.json never holds session ids, personal paths or agent descriptions; those stay in private/.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
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
async function attemptOutcomes(variant, scenario, journal, stageOf, reachable = true) {
  const art = artifactOf(variant);
  const manifest = JSON.parse(readFileSync(join(here, 'defects', 'manifest.json'), 'utf8'));
  const entries = manifest.filter((m) => m.class === art.class && m.artifact === art.artifact);
  const presents = [];
  for (const e of entries) {
    if (!reachable) {
      presents.push(null);
      continue;
    }
    try {
      const mod = await import(pathToFileURL(join(here, 'defects', e.sentinel)).href);
      presents.push(mod.present(scenario.dir, 'feat/E5'));
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
  'spec-review': { variant: /^spec-semeado-/, fix: 'spec-fix', label: 'E5:spec-review', blobKey: 'measuredSpecBlob', blobPath: E5_PATHS.spec },
  'plan-review': { variant: /^plano-semeado-[AB]$/, fix: 'plan-fix', label: 'E5:plan-review', blobKey: 'measuredPlanBlob', blobPath: E5_PATHS.plan },
  'task-review': { variant: /^codigo-semeado-/, fix: 'task-fix', label: 'E5:task-review', blobKey: null, blobPath: null },
};
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

const fill = (text, vars) => text.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in vars ? vars[k] : all));

// The script review-only.js written at the sandbox root: one reviewer and, on a blocking issue, one fixer.
// Same contract as roadmap-release.js: no imports and no Node API.
export function buildReviewOnlyScript({ stage, reviewPrompt, fixPrompt }) {
  const st = STAGES[stage];
  if (!st) throw new UsageError(`unknown stage: ${stage}`);
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
  const schema = { type: 'object', properties: props, required };
  return [
    'export const meta = {',
    "  name: 'review-only',",
    "  description: 'Measurement harness: one review of a seeded artifact and, if it blocks, one fix.',",
    "  phases: [{ title: 'Review', detail: 'reviewer and fixer of one stage' }],",
    '}',
    `const SCHEMA = ${JSON.stringify(schema)}`,
    `const REVIEW_PROMPT = ${JSON.stringify(reviewPrompt)}`,
    `const FIX_PROMPT = ${JSON.stringify(fixPrompt)}`,
    `const review = await agent(REVIEW_PROMPT, { label: '${st.label}1', phase: 'Review', model: 'opus', schema: SCHEMA })`,
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

function prepareHarness(opts) {
  const { stage } = opts;
  if (!stage) return null;
  const st = STAGES[stage];
  if (!st) throw new UsageError(`--stage must be spec-review, plan-review or task-review (got "${stage}")`);
  if (!st.variant.test(opts.variant)) throw new UsageError(`--stage ${stage} does not accept the variant "${opts.variant}"`);
  const arm = opts.arm ?? 'atual';
  if (!/^[A-Za-z0-9_-]+$/.test(arm)) throw new UsageError(`invalid --arm: ${arm}`);
  const armsDir = resolve(opts.armsDir ?? join(here, 'arms'));
  const current = arm === 'atual';
  const builtIn = stage === 'task-review' && current; // the prompt comes from the workflow itself
  let review = null;
  let workflowCommit = null;
  let armSource = 'modelo';
  const fixArm = builtIn ? null : readArm(join(armsDir, `${st.fix}-${arm}.md`), { requireSource: current });
  if (builtIn) {
    armSource = 'workflow';
  } else {
    review = readArm(join(armsDir, `${stage}-${arm}.md`), { requireSource: current });
    if (current) {
      if (review.source.commit !== fixArm.source.commit) throw new UsageError('review and fix arm templates were copied from different commits');
      armSource = 'copia-do-prompt';
      workflowCommit = review.source.commit;
    }
  }
  return { stage, arm, st, review, fixArm, harness: { stage, arm, armSource, workflowCommit } };
}

const slash = (p) => p.replace(/\\/g, '/');

function harnessPrompts(h, scenario) {
  const sb = slash(scenario.dir);
  const vars = {
    artifactPath: `${sb}/${h.stage === 'spec-review' ? E5_PATHS.spec : E5_PATHS.plan}`,
    specPath: `${sb}/${E5_PATHS.spec}`,
    cardRef: 'card E5 of docs/plans/roadmap-sandbox/ (the sandbox roadmap)',
    repo: sb,
  };
  const measure = (key) =>
    `\nMeasure: headSha, clean (status --porcelain empty), commitsInRange (git -C "${sb}" rev-list --count main..HEAD)${key ? `, ${key} = the output of git -C "${sb}" rev-parse "HEAD:${h.st.blobPath}", run by you` : ''}.`;
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
    return {
      reviewPrompt: loadPure().buildTaskReviewPrompt(ctx, { n: 3, title }, 'spec', impl),
      fixPrompt: `In Task 3 of the plan ${sb}/${E5_PATHS.plan}, fix the spec problems below, run the task's checks and commit "E5 T3: fix ...". Do NOT perform any external effect. STOP after this fix. Never edit the spec or the plan to satisfy a finding. Report in "checks" every verification you ran, with the exact command, real output and exit code.\n{{issues}}`,
    };
  }
  return {
    reviewPrompt: fill(h.review.text, vars).trimEnd() + measure(h.stage === 'task-review' ? null : h.st.blobKey),
    fixPrompt: fill(h.fixArm.text, { ...vars, issues: '{{issues}}' }).trimEnd(),
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
  const issues = review.result?.issues;
  if (!(Array.isArray(issues) && issues.some((i) => BLOCKING.has(i?.severity)))) return 'approved';
  const fixed = find(entries, `${h.st.label}-fix1`) !== undefined;
  return fixed && presents.some((p) => p === false) ? 'approved' : 'stopped';
}

export async function runBatch(opts, { exec = defaultExec, now = () => new Date(), ratify = ratifyE5Contract } = {}) {
  const { variant, runs } = opts;
  const seeded = variant.includes('semeado');
  if (opts.fromRun && !seeded) throw new UsageError(`--from-run only applies to seeded variants (got "${variant}")`);
  const h = prepareHarness(opts);
  const dir = join(resolve(opts.out), `${variant}${h ? `-${h.stage}-${h.arm}` : ''}-${stamp(now())}`);
  const priv = join(dir, 'private');
  mkdirSync(priv, { recursive: true });
  const plugin = readPlugin(opts.configDir);
  const superpowers = readSuperpowers(opts.configDir);
  const seedSource = seeded ? seedSourceOf(opts.fromRun) : undefined;
  const cli = (await exec('claude', ['--version'], {})).stdout.trim();

  const attempts = [];
  const privateAttempts = [];
  const validRuns = [];
  for (let k = 1; k <= runs; k++) {
    const scenario = await makeScenario(join(resolve(opts.work), `${variant}-${k}`), variant, { fromRun: opts.fromRun });
    const sessions = [];
    let denied = false;
    let failed = false;
    let failReason = 'execucao-falhou';
    const stop = scenario.stopResume ?? (variant === 'parada-retomada' ? STOP_RESUME : null);
    let launchOpts = opts;
    if (h) {
      gitOut(scenario.dir, 'checkout', '-q', 'feat/E5'); // makeScenario leaves the root on main; the harness reviews and fixes on feat/E5
      const script = buildReviewOnlyScript({ stage: h.stage, ...harnessPrompts(h, scenario) });
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
      const v = h ? harnessValidity(h, variant, journal, scenario) : checkValidity(variant, journal, scenario);
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
    if (!h) {
      const rv = releaseRunValidity(variant, run);
      if (!rv.valid) {
        attempts.push({ n: k, status: 'invalid', reason: rv.reason });
        continue;
      }
      if (stop !== null) {
        // D3 (E17): the resume session alone must have launched an agent; the whole-attempt total can come from the first session.
        const resumeFile = join(priv, `attempts-${k}-resume.json`);
        const resumeDir = join(metricsDir, 'resume');
        writeFileSync(resumeFile, JSON.stringify({ attempts: [{ n: k, sessions: sessions.slice(1) }] }, null, 2) + '\n');
        const rex = await exec(
          process.execPath,
          [EXTRACTOR, '--root', join(opts.configDir, 'projects'), '--out', resumeDir, '--sessions', sessions.slice(1).join(','), '--runs', resumeFile],
          { cwd: here },
        );
        if (rex.code !== 0) {
          attempts.push({ n: k, status: 'invalid', reason: 'extrator-falhou' });
          continue;
        }
        const rrv = resumeRunValidity(sessions.length > 1 ? JSON.parse(readFileSync(join(resumeDir, 'metrics.json'), 'utf8')).runs[0] : undefined);
        if (!rrv.valid) {
          attempts.push({ n: k, status: 'invalid', reason: rrv.reason });
          continue;
        }
      }
    }
    validRuns.push(run);
    let outcomes = [];
    if (journal) {
      // The sentinels read the tip of feat/E5 in the working tree. The stage is read first: settling may recreate the branch.
      const stage = !h ? stageResult(variant, journal.entries, scenario.dir, scenario.seededCommit) : null;
      const reachable = settleSandbox(scenario.dir, scenario.seededCommit);
      outcomes = await attemptOutcomes(variant, scenario, journal, h ? (presents) => harnessStage(h, journal.entries, presents) : () => stage, reachable);
    }
    const attempt = { n: k, status: 'valid', counters: toAttemptCounters(run), outcomes };
    if (!h && (variant === 'completo' || variant === 'parada-retomada')) attempt.integrated = e5Integrated(scenario.dir);
    if (PANEL_VARIANTS.includes(variant)) attempt.panel = readPanel(scenario.dir, plugin.installPath, { deliverable: EXPECTED_PANEL[variant].deliverable });
    attempts.push(attempt);
  }

  const status = (s) => attempts.filter((a) => a.status === s).length;
  const invalidReasons = {};
  for (const a of attempts) if (a.status === 'invalid') invalidReasons[a.reason] = (invalidReasons[a.reason] ?? 0) + 1;
  const costs = attempts.filter((a) => a.status === 'valid' && a.counters.cost !== null).map((a) => a.counters.cost);
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
    ...(h ? { harness: h.harness } : {}),
    cost: costs.length ? { median: median(costs), min: Math.min(...costs), max: Math.max(...costs) } : { median: null, min: null, max: null },
    ...totalOutcomes(attempts),
  };
  writeFileSync(join(dir, 'aggregate.json'), JSON.stringify(aggregate, null, 2) + '\n');
  return { dir, aggregate, exitCode: status('denied') + status('invalid') > 0 ? 1 : 0 };
}

const USAGE =
  'usage: node tools/measure/run-batch.mjs --variant <v> --runs <n> --work <dir> --out <dir> --config-dir <dir> --permission-mode <modo> [--allow <regra>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>] [--stage <spec-review|plan-review|task-review> [--arm <nome>] [--arms-dir <dir>]] [--from-run <pasta>] [--stop-on-denial]';

function parseCli(argv) {
  const o = { allow: [], addDir: [] };
  const names = {
    '--variant': 'variant', '--runs': 'runs', '--work': 'work', '--out': 'out', '--config-dir': 'configDir',
    '--permission-mode': 'permissionMode', '--allow': 'allow', '--add-dir': 'addDir', '--model': 'model',
    '--max-budget-usd': 'maxBudgetUsd', '--stage': 'stage', '--arm': 'arm', '--arms-dir': 'armsDir', '--from-run': 'fromRun',
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
