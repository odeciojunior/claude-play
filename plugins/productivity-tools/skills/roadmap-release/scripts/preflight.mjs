#!/usr/bin/env node
// Preflight for the roadmap-release skill: validates (or derives) release.config.json
// and checks permission rules. Read-only: it never writes any file or setting.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, isAbsolute, relative, sep, dirname, posix, win32 } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pendingDecisions } from '../../roadmap-tracker/scripts/roadmap.mjs';
import { parseRoadmapTexts, parseStatusSegments, EXECUTABLE_KINDS, idsIn, shasIn } from '../../../lib/roadmap-format.mjs';
import { canon, fnv1a, sliceEnvelopes } from '../../../lib/plan-digest.mjs';

const KINDS = ['exit', 'tests'];

const asList = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

export function validateReleaseConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return ['config must be a JSON object'];
  if (typeof cfg.projectContext !== 'string') errors.push('projectContext must be a string');
  if (typeof cfg.install !== 'string') errors.push('install must be a string');
  for (const f of ['setup', 'beforeEvidence']) {
    if (cfg[f] != null && !asList(cfg[f]).every((c) => typeof c === 'string')) errors.push(`${f} must be a string or a list of strings`);
  }
  if (cfg.taskReview != null) {
    if (typeof cfg.taskReview !== 'object' || Array.isArray(cfg.taskReview)) errors.push('taskReview must be an object');
    else {
      for (const k of Object.keys(cfg.taskReview)) {
        if (k === 'single') errors.push('taskReview.single was removed: the per-task review always runs the spec and quality loops; delete the key from release.config.json');
        else if (k !== 'restricted') errors.push(`taskReview.${k} is not a supported key (only taskReview.restricted)`);
        else if (cfg.taskReview[k] != null && typeof cfg.taskReview[k] !== 'boolean') errors.push('taskReview.restricted must be a boolean');
      }
    }
  }
  if (cfg.finalReview != null) {
    if (typeof cfg.finalReview !== 'object' || Array.isArray(cfg.finalReview)) errors.push('finalReview must be an object');
    else {
      for (const k of Object.keys(cfg.finalReview)) if (k !== 'adversarial' && k !== 'singleWave') errors.push(`finalReview.${k} is not a supported key (only finalReview.adversarial and finalReview.singleWave)`);
      for (const k of ['adversarial', 'singleWave']) if (cfg.finalReview[k] != null && typeof cfg.finalReview[k] !== 'boolean') errors.push(`finalReview.${k} must be a boolean`);
    }
  }
  const locks = Array.isArray(cfg.locks) ? cfg.locks : [];
  if (cfg.locks != null && !Array.isArray(cfg.locks)) errors.push('locks must be a list of names');
  if (locks.includes('merge')) errors.push('locks cites the reserved lock name: merge (the workflow always owns it)');
  if (!Array.isArray(cfg.gates) || cfg.gates.length === 0) {
    errors.push('gates must be a non-empty list');
    return errors;
  }
  const seen = new Set();
  cfg.gates.forEach((g, i) => {
    const at = `gates[${i}]`;
    if (!g || typeof g !== 'object') { errors.push(`${at} must be an object`); return; }
    if (typeof g.name !== 'string' || !g.name) errors.push(`${at}.name is required`);
    else {
      if (g.restricted === true && /\s/.test(g.name)) errors.push(`${at}.name must not contain spaces: ${g.name} (a restricted gate becomes an authorizeExternal item)`);
      if (seen.has(g.name)) errors.push(`${at}.name duplicate: ${g.name}`);
      else seen.add(g.name);
    }
    if (typeof g.cmd !== 'string' || !g.cmd.trim()) errors.push(`${at}.cmd is required`);
    if (!KINDS.includes(g.kind)) errors.push(`${at}.kind must be one of ${KINDS.join(', ')}`);
    if (g.restricted != null && typeof g.restricted !== 'boolean') errors.push(`${at}.restricted must be a boolean`);
    for (const l of asList(g.needsLock)) {
      if (l === 'merge') { errors.push(`${at}.needsLock cites the reserved lock name: merge`); continue; }
      if (!locks.includes(l)) errors.push(`${at}.needsLock cites undeclared lock: ${l}`);
    }
  });
  if (cfg.gates.every((g) => g && g.restricted === true)) errors.push('every gate is restricted: the preflight needs at least one gate that is not restricted (on one row of the gates table, leave no restriction mark and make both its Environment and When cells free: empty, a dash or a local mark such as local; or set restricted to false in release.config.json)');
  return errors;
}

// Columns are read by position (ID, Command, Environment, When, Baseline); header words are ignored.
// A row with another number of columns is skipped and reported in `warnings`.
export function parseGatesTable(markdown, warnings = []) {
  const g = parseRoadmapTexts({ strategy: String(markdown || ''), files: {} }).blocks.strategy.gates;
  if (!g.present || !g.closed || g.malformed > 0) return [];
  return g.rows.filter((r) => {
    if (r.length === 1 && r[0] === '') return false;
    if (r.length !== 5) {
      warnings.push(`gates table row "${r[0] || '(empty)'}" has ${r.length} columns, expected 5 (ID, Command, Environment, When, Baseline): row skipped, so that gate is missing from the derived config (write a pipe inside a cell as \\|)`);
      return false;
    }
    return !['', '-', '—'].includes(r[1]);
  }).map(([ID, Command, Environment, When, Baseline]) => ({ ID, Command, Environment, When, Baseline }));
}

// Reads a roadmap folder (config, strategy, state files) and returns the same structure as the checker's parseRoadmap.
export function readRoadmapStructure(folder) {
  const read = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const config = JSON.parse(read(join(folder, 'roadmap.config.json')));
  const strategy = read(resolve(folder, config.strategy));
  const files = {};
  for (const [role, name] of Object.entries(config.files || {})) files[role] = name === null ? null : read(resolve(folder, name));
  return parseRoadmapTexts({ strategy, files });
}

// A derived gate is a tests gate only when its command names a test runner: anything else has no test count to read.
const TEST_RUNNER = /\b(jest|vitest|mocha|ava|pytest|tox|phpunit|rspec|ctest|playwright|cypress)\b|\bnode\s+--test\b|\b(npm|pnpm|yarn|bun|make|go|cargo|dotnet|mvn|gradle|gradlew|deno|mix|rake)\s+(run\s+)?test\b|\bnpm\s+t\b/;

const LOCKFILES = [
  ['package-lock.json', 'npm ci'], ['pnpm-lock.yaml', 'pnpm install --frozen-lockfile'], ['yarn.lock', 'yarn install --frozen-lockfile'],
  ['bun.lock', 'bun install --frozen-lockfile'], ['bun.lockb', 'bun install --frozen-lockfile'], ['poetry.lock', 'poetry install'], ['uv.lock', 'uv sync'],
  ['Cargo.lock', 'cargo fetch'], ['go.sum', 'go mod download'], ['composer.lock', 'composer install'], ['Gemfile.lock', 'bundle install'],
];

function detectInstall(root) {
  const hit = LOCKFILES.find(([file]) => existsSync(join(root, file)));
  return hit ? hit[1] : '';
}

// The prod family fails toward restricted: any token starting with "prod" restricts (prods, produções, proddb), except words that are
// really something else (product, produto, produce, produzir). Staging, owner and dono match by prefix.
const NOT_PROD = /^(product(?!ion)|produto|produtiv|produce|produz)/;
const RESTRICT_MARKS = ['staging', 'owner', 'dono'];
const LOCAL_MARKS = ['local', 'every', 'each', 'before', 'merge', 'task', 'cada', 'todo', 'antes', 'always', 'sempre'];

// Classifies a gate row by its Environment and When cells, cell by cell. A restriction mark in either cell wins;
// otherwise both cells must be free (empty, a dash, or a local mark): anything else is unknown, treated as restricted.
export function classifyGate(environment, when) {
  const cells = [environment, when].map((c) => String(c ?? '').normalize('NFC').trim().toLowerCase());
  const tokens = (c) => c.split(/[^\p{L}]+/u).filter(Boolean);
  const starts = (c, marks) => tokens(c).some((t) => marks.some((m) => t.startsWith(m)));
  const restrictedCell = (c) => tokens(c).some((t) => t.startsWith('prod') && !NOT_PROD.test(t)) || starts(c, RESTRICT_MARKS);
  if (cells.some((c) => restrictedCell(c) || /(^|[^\p{L}])release\s+only(?![\p{L}])/u.test(c))) return 'restricted';
  const isFree = (c) => ['', '-', '—'].includes(c) || starts(c, LOCAL_MARKS);
  return cells.every(isFree) ? 'free' : 'unknown';
}

// Which of the two cells is not recognized: neither free nor a restriction mark. Used only to tell the person which cell to edit.
function unknownCells(environment, when) {
  const names = [['Environment', environment], ['When', when]];
  const bad = names.filter(([, c]) => classifyGate(c, '') === 'unknown').map(([n]) => n);
  return bad;
}

export function deriveConfig({ gatesBlockRows = [], projectContext = '', install = '', warnings = [] } = {}) {
  const gates = gatesBlockRows
    .map((r) => ({ name: String(r.ID ?? '').trim(), cmd: String(r.Command ?? '').trim().replace(/^`+|`+$/g, '').trim(), cls: classifyGate(r.Environment, r.When), row: r }))
    .filter((g) => g.name && g.cmd)
    .map(({ cls, row, ...g }) => {
      if (cls === 'unknown') {
        const bad = unknownCells(row.Environment, row.When);
        const cell = bad.length === 2 ? 'both the Environment and When cells' : `the ${bad[0]} cell`;
        warnings.push(`gate ${g.name}: Environment/When not recognized, treated as restricted (runs only with authorizeExternal ["gate:${g.name}"]); if it is local, write local in ${cell} of the gates table, or set restricted to false in release.config.json`);
      }
      return { ...g, kind: TEST_RUNNER.test(g.cmd) ? 'tests' : 'exit', ...(cls === 'free' ? {} : { restricted: true }) };
    });
  return { generated: true, projectContext, install, locks: [], conflictRules: '', gates };
}

// Index of the closer matching an opener at `from` (just after it), quote-aware; -1 when unbalanced.
function findClose(s, from, open, close) {
  let depth = 1;
  let q = null;
  for (let i = from; i < s.length; i += 1) {
    const c = s[i];
    if (c === '\\' && q !== "'") { i += 1; continue; }
    if (q) { if (c === q) q = null; continue; }
    if (c === "'" || c === '"') q = c;
    else if (open !== close && c === open) depth += 1;
    else if (c === close) { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

// Splits a shell line into the subcommands Claude Code evaluates separately: separators are
// newline ; & && | || |& outside quotes, subshell parens are dropped, and the contents of
// $(...) and backticks are extracted as their own subcommands.
export function subcommands(cmd) {
  const s = String(cmd);
  const out = [];
  let cur = '';
  let q = null;
  const flush = () => { const t = cur.trim(); if (t) out.push(t); cur = ''; };
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (q === "'") { cur += c; if (c === "'") q = null; continue; }
    if (c === '\\') { cur += c + (s[i + 1] ?? ''); i += 1; continue; }
    if (c === '$' && s[i + 1] === '(') {
      const end = findClose(s, i + 2, '(', ')');
      const stop = end === -1 ? s.length : end;
      out.push(...subcommands(s.slice(i + 2, stop)));
      cur += '_';
      i = stop;
      continue;
    }
    if (c === '`') {
      const end = findClose(s, i + 1, '`', '`');
      const stop = end === -1 ? s.length : end;
      out.push(...subcommands(s.slice(i + 1, stop)));
      cur += '_';
      i = stop;
      continue;
    }
    if (q === '"') { cur += c; if (c === '"') q = null; continue; }
    if (c === "'" || c === '"') { q = c; cur += c; continue; }
    if (c === '&' && (s[i - 1] === '>' || s[i - 1] === '<' || s[i + 1] === '>')) { cur += c; continue; }
    if ('\n;&|()'.includes(c)) { flush(); continue; }
    cur += c;
  }
  flush();
  return out;
}
const ENV_PREFIX = /^([A-Za-z_]\w*=\S*\s+)+/;

// Scripts of the plugin that the workflow runs through Bash with an exact path (DEC-060): the rule is narrower than Bash(node:*).
export const WORKFLOW_SCRIPTS = ['roadmap.mjs', 'review-package.mjs', 'run-record.mjs', 'preflight.mjs', 'verify-run.mjs'];

// The release workflow is launched by name; its permission rule is only warned about (never required), because the skill's own
// allowed-tools or the dialog grants the launch and only a run without the interface needs the rule.
export const RELEASE_WORKFLOW = 'productivity-tools:release-workflow';

export function releaseWorkflowRule() {
  return `Workflow(${RELEASE_WORKFLOW})`;
}

// True when some permissions.allow has exactly the workflow rule or bare Workflow. Wildcards do not count: an extra warning blocks nothing.
export function workflowRuleCovered(settingsList) {
  const rule = releaseWorkflowRule();
  return (Array.isArray(settingsList) ? settingsList : []).some((s) => {
    const allow = s?.permissions?.allow;
    return Array.isArray(allow) && allow.some((r) => { const t = String(r).trim(); return t === rule || t === 'Workflow'; });
  });
}

// Absolute path (with /) of a workflow script, derived from the tracker CLI path (<plugin root>/skills/roadmap-tracker/scripts/roadmap.mjs).
const SKILL_SCRIPTS = ['preflight.mjs', 'verify-run.mjs'];
function scriptPath(name, trackerPath) {
  if (name === 'roadmap.mjs') return trackerPath;
  const pluginRoot = dirname(dirname(dirname(dirname(trackerPath))));
  return SKILL_SCRIPTS.includes(name) ? `${pluginRoot}/skills/roadmap-release/scripts/${name}` : `${pluginRoot}/scripts/${name}`;
}

export function scriptRule(name) {
  return `Bash(node *${name}" *)`;
}

const idOf = (cell) => (String(cell || '').match(/\bE\d+\b/) || [String(cell || '').trim()])[0];

// {verify} commands (executable kinds only) of the cards that are not on the branch yet: the workflow runs them as evidence.
// Open card: some status segment before deliverableStatuses[4], or blocked, or the card has no panel row.
export function openCardCommands(parsed, vocab) {
  const ds = vocab?.deliverableStatuses || [];
  if (ds.length < 5) return [];
  const blocked = new Set(['blocked', ds[8], vocab.blockedStatus].filter(Boolean));
  const rows = parsed?.blocks?.state?.panel?.rows || [];
  const statusOf = new Map(rows.map((r) => [idOf(r[0]), parseStatusSegments(r[1]).map((s) => s.word)]));
  const out = [];
  for (const card of parsed?.cards || []) {
    const words = statusOf.get(card.id);
    const open = !words || words.length === 0 || words.some((w) => blocked.has(w) || ds.indexOf(w) < 4);
    if (!open) continue;
    for (const item of card.acceptance || []) {
      const t = item.tag;
      if (t && EXECUTABLE_KINDS.includes(t.kind) && t.evidence && !out.includes(t.evidence)) out.push(t.evidence);
    }
  }
  return out;
}

export function requiredCommands(cfg, extras = {}) {
  const cmds = [];
  for (const g of cfg?.gates || []) if (g.restricted !== true) cmds.push(g.cmd);
  cmds.push(cfg?.install, ...asList(cfg?.setup), ...asList(cfg?.beforeEvidence), ...asList(extras?.cards));
  const out = {};
  const add = (rule, sub) => {
    out[rule] ||= [];
    if (sub && !out[rule].includes(sub)) out[rule].push(sub);
  };
  for (const c of cmds) {
    if (typeof c !== 'string') continue;
    for (const raw of subcommands(c)) {
      const sub = raw.replace(ENV_PREFIX, '').trim();
      const w = sub.split(/\s+/)[0];
      if (w) add(`Bash(${w}:*)`, sub);
    }
  }
  for (const { name, path } of extras?.scripts || []) add(scriptRule(name), `node "${path}" status`);
  // The workflow itself runs git and node (temporary Node programs, docs measure, test integrity): a narrower rule is not enough.
  out['Bash(git:*)'] = [];
  out['Bash(node:*)'] = [];
  return out;
}

export function requiredRules(cfg) {
  return Object.keys(requiredCommands(cfg));
}

export function missingRules(required, settingsList, commandsByRule = {}) {
  const allow = new Set();
  for (const s of settingsList || []) {
    for (const r of s?.permissions?.allow || []) {
      const rule = String(r).trim();
      allow.add(rule);
      // `Bash(git *)` and `Bash(git:*)` are the same prefix rule.
      const sp = /^Bash\((.+?) \*\)$/.exec(rule);
      if (sp) allow.add(`Bash(${sp[1]}:*)`);
    }
  }
  if (allow.has('Bash') || allow.has('Bash(*)')) return [];
  return required.filter((rule) => {
    if (allow.has(rule)) return false;
    const cmds = commandsByRule[rule] || [];
    if (cmds.length === 0) return true;
    return !cmds.every((c) => {
      if (allow.has(`Bash(${c})`)) return true;
      for (const a of allow) {
        const m = /^Bash\((.+):\*\)$/.exec(a);
        if (m && (c === m[1] || c.startsWith(m[1] + ' '))) return true;
      }
      return false;
    });
  });
}

// DEC-719: wtRoot (where worktrees are created, outside the session dir) must be in permissions.additionalDirectories,
// or acceptEdits denies the agents writes there. entries = [{ settings }]
// (absolute paths only; `~` expands to home; relative entries never count). Covered = an entry equals wtRoot or is an ancestor of it.
const normDir = (p, win) => { let n = String(p).replace(/\\/g, '/').replace(/\/+$/, ''); if (n === '') n = '/'; return win ? n.toLowerCase() : n; };
export function missingDirs(wtRoot, entries, { platform = process.platform, home = null } = {}) {
  const win = platform === "win32";
  const target = normDir((win ? win32 : posix).normalize(String(wtRoot)), win);
  const covered = (entries || []).some((e) => {
    const list = e?.settings?.permissions?.additionalDirectories;
    if (!Array.isArray(list)) return false;
    return list.some((raw) => {
      if (typeof raw !== "string" || raw.trim() === "") return false;
      let d = raw.trim();
      // `~` always means home, in any settings file.
      if (d === '~' || d.startsWith('~/') || d.startsWith('~\\')) { if (!home) return false; d = home + d.slice(1); }
      // Relative entries never count: how Claude Code resolves them from a subfolder is unverified.
      const isAbs = win ? /^([A-Za-z]:[\\/]|[\\/])/.test(d) : d.startsWith('/');
      if (!isAbs) return false;
      const abs = normDir((win ? win32 : posix).normalize(d), win);
      return target === abs || abs === '/' || /^[a-z]:\/$/i.test(abs) && target.startsWith(abs) || target.startsWith(abs.endsWith('/') ? abs : abs + '/');
    });
  });
  return covered ? [] : [String(wtRoot).replace(/\\/g, '/').replace(/(.)\/+$/, '$1')];
}
function mainCheckout(from) {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: from, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return dirname(common);
  } catch { return repoRoot(from); }
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function repoRoot(from) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: from, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return from; }
}

const HERE = dirname(fileURLToPath(import.meta.url));

// Launch-by-name runtime limit measured in docs/reports/2026-11-13-E8-limite-lancamento-workflow.md: above 524,288 bytes (512 KiB)
// on disk (including CRLF on Windows), the workflow disappears from the plugin registry and launching by name fails with 'not found'.
export const MAX_WORKFLOW_LAUNCH_BYTES = 524288;

export function workflowFilePath(from = HERE) {
  return resolve(from, '../workflow/roadmap-release.js').split(sep).join('/');
}

// Absolute path (with /) of the tracker CLI shipped next to this skill; an error when it is missing or has a double quote
// (the workflow wraps the path in double quotes).
export function trackerCliPath(from = HERE) {
  const path = resolve(from, '../../roadmap-tracker/scripts/roadmap.mjs').split(sep).join('/');
  if (path.includes('"') || String(from).includes('"')) return { path, error: `tracker CLI path contains a double quote: ${path}` };
  if (!existsSync(path)) return { path, error: `tracker CLI not found: ${path}` };
  return { path, error: '' };
}

// Config, strategy and state/decisions texts of the roadmap folder: from `ref` when it has the folder, else from the working tree.
// Throws when the config or the strategy is not readable.
function readRoadmapTexts(root, dir, ref, warnings) {
  const norm = (t) => t.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rel = relative(root, dir).split(sep).join('/');
  // normalize: the strategy path is relative to the folder and may climb out of it (../strategy.md); git show wants a clean path.
  const at = (name) => posix.normalize(rel ? `${rel}/${name}` : name);
  let text = (name) => { try { return norm(readFileSync(join(dir, name), 'utf8')); } catch { return null; } };
  const onRef = ref ? readRef(root, ref, at('roadmap.config.json')) : null;
  if (onRef !== null) text = (name) => { const t = readRef(root, ref, at(name)); return t === null ? null : norm(t); };
  else warnings.push(ref ? `roadmap cards read from the working tree (${ref} has no ${rel || '.'})` : 'roadmap cards read from the working tree (no --ref given)');
  const configText = text('roadmap.config.json');
  if (configText === null) throw new Error(`roadmap.config.json not readable in ${rel || '.'}`);
  const config = JSON.parse(configText);
  const strategy = text(config.strategy);
  if (strategy === null) throw new Error(`strategy not readable: ${config.strategy}`);
  const files = {};
  for (const role of ['state', 'decisions']) if (typeof config.files?.[role] === 'string') files[role] = text(config.files[role]);
  return { config, strategy, files, from: onRef !== null ? ref : 'working tree' };
}

// Executor decisions still pending, as the tracker CLI lists them (pending-decisions); a failure is a warning.
function readPendingDecisions(texts, warnings) {
  // A config without a vocab (a stub) has no decisions vocabulary to read: nothing to list, not a failure.
  if (!texts || !texts.config?.vocab) return [];
  if (typeof texts.files.decisions !== 'string') {
    warnings.push(`pending executor decisions not read: ${texts.config.files?.decisions || 'decisions file'} missing (${texts.from})`);
    return [];
  }
  try {
    const parsed = parseRoadmapTexts({ strategy: texts.strategy, files: texts.files });
    return pendingDecisions({ roadmap: { config: texts.config }, parsed });
  } catch (e) {
    warnings.push(`pending executor decisions not read: ${e.message}`);
    return [];
  }
}

function readRef(root, ref, relFile) {
  try {
    return execFileSync('git', ['show', `${ref}:${relFile}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}

function gitTry(root, args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
}
const refExists = (root, ref) => Boolean(ref) && gitTry(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null;
const isAncestor = (root, a, b) => gitTry(root, ['merge-base', '--is-ancestor', a, b]) !== null;

// The status word of the code piece of a Status cell: the segment labeled "code", or the only segment without a label.
// A cell with several other pieces (piece 1, piece 2) or no segment has none.
function codeWord(cell) {
  const segs = parseStatusSegments(cell);
  const code = segs.find((s) => s.label === 'code');
  if (code) return code.word;
  return segs.length === 1 && segs[0].label === '' ? segs[0].word : null;
}

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Merge commit of a card on `ref`: `merge: <id> ` first-parent commit with no later `Revert "merge: <id> ` commit.
function mergeOf(root, ref, id) {
  const log = ref ? gitTry(root, ['log', '--first-parent', '--format=%H%x09%s', ref]) : null;
  const lines = (log || '').split('\n').filter(Boolean).map((l) => { const t = l.indexOf('\t'); return { sha: l.slice(0, t), subject: l.slice(t + 1) }; });
  const at = lines.findIndex((l) => l.subject.startsWith(`merge: ${id} `));
  if (at < 0) return { found: false, reverted: false, sha: '' };
  if (lines.slice(0, at).some((l) => l.subject.startsWith(`Revert "merge: ${id} `))) return { found: false, reverted: true, sha: '' };
  const sha = (gitTry(root, ['rev-parse', lines[at].sha]) || '').trim();
  return { found: /^[0-9a-f]{40}$/.test(sha), reverted: false, sha };
}

// Read-only discovery of the roadmap for the release workflow: the same parser as the checker, the git rules in code.
// Throws an Error when the folder or the strategy is not readable.
export function discoverRoadmap({ repo, roadmap, ref, base, today, prefix } = {}) {
  void prefix; // the delivery branch <prefix><id> is born from the target and never counts as evidence
  const root = repoRoot(resolve(repo || '.')).split(sep).join('/');
  let dir;
  if (roadmap) dir = resolve(root, String(roadmap).replace(/\\/g, '/'));
  else {
    const plans = join(root, 'docs', 'plans');
    const found = existsSync(plans) ? readdirSync(plans).filter((n) => existsSync(join(plans, n, 'roadmap.config.json'))).sort() : [];
    if (found.length !== 1) throw new Error(found.length ? `several roadmap folders under docs/plans/: ${found.join(', ')}` : 'no roadmap folder with roadmap.config.json under docs/plans/');
    dir = join(plans, found[0]);
  }
  const rel = relative(root, dir).split(sep).join('/');
  const warnings = [];
  let texts = null;
  let firstError = null;
  for (const r of [null, ref, base]) {
    if (r === undefined) continue;
    try { texts = readRoadmapTexts(root, dir, r, warnings); break; } catch (e) { firstError ||= e; }
  }
  if (!texts) throw firstError;
  const cfg = texts.config;
  const vocab = cfg.vocab || {};
  const slug = (dir.split(/[\\/]/).filter(Boolean).pop() || '').replace(/^roadmap-/, '');
  const target = ref || cfg.releaseBranch || `integracao/${slug}`;
  const integrationBranch = cfg.integrationBranch || '';
  const baseBranch = base || integrationBranch;
  const targetExists = refExists(root, target);
  // Texts: from the target when it has the folder, else from the base branch, else from the working tree.
  for (const r of [target, baseBranch]) {
    if (!refExists(root, r)) continue;
    try {
      const t = readRoadmapTexts(root, dir, r, warnings);
      if (t.from === r) { texts = t; break; }
    } catch { /* try the next source */ }
  }
  const parsed = parseRoadmapTexts({ strategy: texts.strategy, files: texts.files });
  const dirPath = `${rel}/`;
  const gitRef = targetExists ? target : refExists(root, baseBranch) ? baseBranch : null;
  const integrated = vocab.integratedStatuses || [];
  const discarded = vocab.discardedStatus || 'discarded';
  const panel = new Map(parsed.blocks.state.panel.rows.map((r) => [(String(r[0] || '').match(/\bE\d+\b/) || [String(r[0] || '').trim()])[0], r]));
  const cards = parsed.cards.map((c) => {
    const row = panel.get(c.id);
    const status = row ? row[1] || '' : '';
    const mergeCommit = row ? shasIn(row[2])[0] || '' : '';
    const word = codeWord(status);
    const merge = mergeOf(root, gitRef, c.id);
    let onTarget = false;
    let why;
    if (merge.found) { onTarget = true; why = `merge commit ${merge.sha} on ${gitRef}`; }
    else if (merge.reverted) why = `merge: ${c.id} was reverted on ${gitRef}`;
    else if (!gitRef) why = 'no target or base branch to check';
    else if (word === null) {
      const pieces = parseStatusSegments(status).length;
      why = pieces === 0 ? 'no status on the panel' : pieces > 1 ? 'status without a code segment (several pieces)' : 'status without a code segment';
    }
    else if (integrated.includes(word) && integrationBranch && isAncestor(root, integrationBranch, gitRef)) { onTarget = true; why = `code segment ${word} and ${integrationBranch} is an ancestor of ${gitRef}`; }
    else if ((integrated.includes(word) || word === (vocab.deliverableStatuses || [])[4]) && mergeCommit && refExists(root, mergeCommit) && isAncestor(root, mergeCommit, gitRef)) { onTarget = true; why = `code segment ${word} and ${mergeCommit} is an ancestor of ${gitRef}`; }
    else why = `no merge commit and no finished code segment with an ancestor on ${gitRef}`;
    const omitted = word !== null && (integrated.includes(word) || word === discarded);
    const title = (c.body.match(/^###\s+(.*)$/m) || ['', ''])[1].replace(/^\S+\s+--\s+/, '').trim();
    return {
      id: c.id, title, phase: c.attrs.phase || '', track: c.attrs.track || '', priority: c.attrs.priority || '',
      deps: c.depends, reqs: c.reqs, critical: c.critical, criticalMissing: c.attrs.critical === undefined,
      status, mergeCommit, mergeFound: merge.found, mergeSha: merge.sha, onTarget, onTargetEvidence: why,
      acceptance: omitted ? [] : c.acceptance.map((a, i) => ({
        id: `AC${i + 1}`,
        text: a.tag ? `${a.text} {verify: ${a.tag.kind}${a.tag.blq ? ` ${a.tag.blq}` : ''}${a.tag.evidence ? `; evidence: ${a.tag.evidence}` : ''}}` : a.text,
      })),
      acceptanceOmitted: omitted,
    };
  });
  const data = {
    repo: root, today: today || localDate(), roadmapDir: dirPath, roadmapSlug: slug,
    strategy: posix.normalize(`${rel}/${cfg.strategy}`), checker: `${dirPath}check-roadmap.mjs`,
    checkerExists: existsSync(join(dir, 'check-roadmap.mjs')) || (refExists(root, gitRef) && readRef(root, gitRef, `${dirPath}check-roadmap.mjs`) !== null),
    integrationBranch, releaseBranch: cfg.releaseBranch || '', target, targetExists, readFrom: texts.from,
    deliverableStatuses: vocab.deliverableStatuses || [], integratedStatuses: integrated, discardedStatus: discarded, blockedStatus: vocab.blockedStatus || 'blocked',
    language: cfg.language || '',
    ...(typeof cfg.limits?.cellChars === 'number' ? { cellChars: cfg.limits.cellChars } : {}),
    cards,
    blockers: parsed.blocks.state.blockers.rows.map((r) => ({ id: r[0] || '', text: r[1] || '', affects: idsIn(r[2], /\bE\d+\b/g) })),
    donot: parsed.blocks.state.donot.items,
    pendingDecisions: readPendingDecisions(texts, warnings),
  };
  return data;
}

export function runPreflight(folder,{ home = homedir(), ref = null, configDir = process.env.CLAUDE_CONFIG_DIR || null, trackerFrom = HERE, declarePermissions = null, wtRoot = null, platform = process.platform, workflowPath = null } = {}) {
  const dir = resolve(folder);
  const configPath = join(dir, 'release.config.json');
  const root = repoRoot(dir);
  let config = null;
  let generated = false;
  const errors = [];
  const warnings = [];
  const relFile = relative(root, configPath).split(sep).join('/');
  const onRef = ref ? readRef(root, ref, relFile) : null;
  if (onRef !== null) {
    try { config = JSON.parse(onRef); generated = config.generated === true; } catch { errors.push(`release.config.json on ${ref} is not valid JSON`); }
  } else if (existsSync(configPath)) {
    config = readJson(configPath);
    if (config === null) errors.push('release.config.json is not valid JSON');
    else generated = config.generated === true;
  } else {
    const rc = readJson(join(dir, 'roadmap.config.json'));
    if (!rc || typeof rc.strategy !== 'string') errors.push('roadmap.config.json missing or has no "strategy"');
    else {
      const sp = isAbsolute(rc.strategy) ? rc.strategy : resolve(dir, rc.strategy);
      let md = '';
      try { md = readFileSync(sp, 'utf8'); } catch { errors.push(`strategy not readable: ${sp}`); }
      const rows = parseGatesTable(md, warnings);
      if (md && rows.length === 0) errors.push('strategy has no roadmap:gates table rows');
      // A pointer, not a copy: CLAUDE.md is already in the agents' context and a copy would bloat the config and every return.
      const ctx = existsSync(join(root, 'CLAUDE.md')) ? 'Project rules: CLAUDE.md at the repository root (already in your context; if not, read it).' : '';
      const install = detectInstall(root);
      if (!install) warnings.push('no lockfile at the repository root, so the derived install is empty and worktrees get no dependencies: set "install" in release.config.json if the project needs one');
      config = deriveConfig({ gatesBlockRows: rows, projectContext: ctx, install, warnings });
      generated = true;
    }
  }
  if (config) errors.push(...validateReleaseConfig(config));
  const tracker = trackerCliPath(trackerFrom);
  if (tracker.error) errors.push(tracker.error);
  const wfPath = workflowPath ? resolve(workflowPath).split(sep).join('/') : (existsSync(workflowFilePath(trackerFrom)) ? workflowFilePath(trackerFrom) : workflowFilePath(HERE));
  if (existsSync(wfPath)) {
    const wfSize = statSync(wfPath).size;
    if (wfSize > MAX_WORKFLOW_LAUNCH_BYTES) {
      errors.push(`release workflow file exceeds 524.288 bytes (512 KiB): ${wfPath} has ${wfSize} bytes (limit is ${MAX_WORKFLOW_LAUNCH_BYTES} bytes); launching ${RELEASE_WORKFLOW} by name will fail with 'not found'`);
    }
  }
  let missing = [];
  let pending = [];
  if (config && errors.length === 0) {
    const settings = ['settings.json'].map((f) => join(configDir || join(home, '.claude'), f))
      .concat([join(root, '.claude', 'settings.json'), join(root, '.claude', 'settings.local.json')]).map(readJson);
    let texts = null;
    try { texts = readRoadmapTexts(root, dir, ref, warnings); } catch (e) {
      warnings.push(`roadmap cards not read, so the {verify} commands of open cards are not in the permission list: ${e.message}`);
      warnings.push(`pending executor decisions not read: ${e.message}`);
    }
    let cards = [];
    if (texts) {
      try { cards = openCardCommands(parseRoadmapTexts({ strategy: texts.strategy, files: texts.files }), texts.config.vocab || {}); } catch (e) {
        warnings.push(`roadmap cards not read, so the {verify} commands of open cards are not in the permission list: ${e.message}`);
      }
    }
    pending = readPendingDecisions(texts, warnings);
    const extras = {
      cards,
      // roadmap.mjs lives in the tracker skill; review-package.mjs and run-record.mjs in <plugin root>/scripts; preflight.mjs and verify-run.mjs in <plugin root>/skills/roadmap-release/scripts; review-package.mjs is required only with taskReview.restricted.
      scripts: WORKFLOW_SCRIPTS.filter((name) => name !== 'review-package.mjs' || config.taskReview?.restricted === true)
        .map((name) => ({ name, path: scriptPath(name, tracker.path) })),
    };
    const cmds = requiredCommands(config, extras);
    missing = missingRules(Object.keys(cmds), settings, cmds);
    if (!workflowRuleCovered(settings)) warnings.push(`release workflow: no permission rule covers it; a run launched by this skill needs no rule, which is only needed to launch the workflow outside this skill (for example claude -p); to allow that, add to permissions.allow in .claude/settings.local.json: ${releaseWorkflowRule()}`);
    for (const g of config.gates.filter((x) => x.restricted === true)) {
      const extra = Object.keys(requiredCommands({ gates: [{ ...g, restricted: false }] })).filter((r) => !(r in cmds));
      const rulesTxt = `if authorized, add permission rule(s): ${extra.length ? extra.join(', ') : '(none beyond the required ones)'}`;
      // A gate the derivation already warned about as unrecognized gets one combined warning.
      const at = warnings.findIndex((w) => w.startsWith(`gate ${g.name}: Environment/When not recognized`));
      if (at >= 0) warnings[at] += `; ${rulesTxt}`;
      else warnings.push(`gate ${g.name} is restricted and runs only with authorizeExternal ["gate:${g.name}"]; ${rulesTxt}`);
    }
  }
  const userBase = configDir || join(home, ".claude");
  const wt = (wtRoot ? resolve(wtRoot) : `${mainCheckout(dir)}-wt`).split(sep).join("/");
  const dirEntries = [{ settings: readJson(join(userBase, "settings.json")) }, { settings: readJson(join(root, ".claude", "settings.json")) }, { settings: readJson(join(root, ".claude", "settings.local.json")) }];
  // Claude Code grants an additional directory only if it exists when the session starts, so a covered but absent wtRoot is still missing. Read-only: never created here.
  const wtExists = existsSync(wt);
  const missingD = missingDirs(wt, dirEntries, { platform, home });
  const covered = missingD.length === 0;
  if (!wtExists) missingD.splice(0, missingD.length, wt);
  const missingDirsHint = wtExists && covered ? null : (wtExists ? `add the absolute path ${wt} to permissions.additionalDirectories in .claude/settings.local.json, or state in the request how it is granted (for example --add-dir)` : `create ${wt} before starting Claude Code: a folder granted by additionalDirectories or --add-dir counts only if it exists when the session starts${covered ? "" : `, and add the absolute path ${wt} to permissions.additionalDirectories in .claude/settings.local.json`}`);
  // New on every call, never inside config: the workflow puts it in its discovery read (the first agent call) so a resume reads git again instead of a cached answer.
  const runToken = `${new Date().toISOString()}-${randomBytes(6).toString('hex')}`;
  return { configPath, generated, errors, missingRules: missing, missingDirs: missingD, missingDirsHint, warnings, config, runToken, trackerCli: tracker.path, pendingDecisions: pending, permissionsDeclared: typeof declarePermissions === 'string' && declarePermissions.trim() !== '' ? declarePermissions : null };
}

// An agent copies the stdout of discover, and a Bash output over ~30 KB reaches it only as a preview. So the output is kept small:
// the whole data in ONE page when it fits, else page 0 = everything but the cards (+ pages, cardCount) and pages 1..n = chunks of cards ({ page, pages, cards }).
// Each page is signed alone by the same { nonce, data } digest.
export const DISCOVERY_PAGE_CHARS = 8000;
export function discoveryPages(data, budget = DISCOVERY_PAGE_CHARS) {
  if (JSON.stringify(data).length <= budget) return [data];
  const { cards, ...rest } = data;
  const chunks = [];
  let cur = [];
  let size = 0;
  for (const c of cards) {
    const n = JSON.stringify(c).length + 1;
    if (cur.length && size + n > budget) { chunks.push(cur); cur = []; size = 0; }
    cur.push(c);
    size += n;
  }
  if (cur.length) chunks.push(cur);
  return [{ ...rest, pages: chunks.length, cardCount: cards.length }, ...chunks.map((cs, i) => ({ page: i + 1, pages: chunks.length, cards: cs }))];
}

// discover --repo <r> [--roadmap <p>] [--ref <t>] [--base <b>] [--today <d>] --prefix <x> --nonce <n> [--page <k> | --slice <k>]
function discoverCli(argv) {
  // No process.exit: a large JSON on a pipe must be flushed before the process ends.
  const out = (obj, code) => { process.exitCode = code; process.stdout.write(`${JSON.stringify(obj)}\n`); };
  const usage = 'usage: node preflight.mjs discover --repo <r> [--roadmap <p>] [--ref <t>] [--base <b>] [--today <d>] --prefix <x> --nonce <n> [--page <k> | --slice <k>]';
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!/^--(repo|roadmap|ref|base|today|prefix|nonce|page|slice)$/.test(argv[i] || '') || argv[i + 1] === undefined) return out({ tool: 'release-discovery', error: `${usage} (bad argument: ${argv[i]})` }, 2);
    opts[argv[i].slice(2)] = argv[i + 1];
  }
  if (!opts.repo || opts.prefix === undefined || !opts.nonce) return out({ tool: 'release-discovery', error: `${usage} (--repo, --prefix and --nonce are required)` }, 2);
  if (opts.slice !== undefined && opts.page !== undefined) return out({ tool: 'release-discovery', error: `${usage} (--slice and --page cannot be used together)` }, 2);
  const slice = opts.slice === undefined ? null : Number(opts.slice);
  if (slice !== null && (!Number.isInteger(slice) || slice < 0)) return out({ tool: 'release-discovery', error: `${usage} (--slice must be a whole number from 0)` }, 2);
  if (slice !== null) {
    let envs;
    try { envs = sliceEnvelopes({ tool: 'release-discovery', command: 'discover', nonce: opts.nonce }, JSON.stringify(canon(discoverRoadmap(opts)))); } catch (e) { return out({ tool: 'release-discovery', error: e.message }, 1); }
    if (slice >= envs.length) return out({ tool: 'release-discovery', error: `slice ${slice} does not exist: the discovery has ${envs.length} slice(s), numbered from 0` }, 1);
    return out(envs[slice], 0);
  }
  const page = opts.page === undefined ? 0 : Number(opts.page);
  if (!Number.isInteger(page) || page < 0) return out({ tool: 'release-discovery', error: `${usage} (--page must be a whole number from 0)` }, 2);
  let pages;
  try { pages = discoveryPages(discoverRoadmap(opts)); } catch (e) { return out({ tool: 'release-discovery', error: e.message }, 1); }
  if (page >= pages.length) return out({ tool: 'release-discovery', error: `page ${page} does not exist: the discovery has ${pages.length} page(s), numbered from 0` }, 1);
  const data = pages[page];
  return out({ tool: 'release-discovery', nonce: opts.nonce, digest: fnv1a(JSON.stringify(canon({ nonce: opts.nonce, data }))), data }, 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'discover') discoverCli(process.argv.slice(3));
else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf('--ref');
  const ref = ri >= 0 ? argv[ri + 1] : null;
  if (ri >= 0) argv.splice(ri, 2);
  const di = argv.indexOf('--declare-permissions');
  const declarePermissions = di >= 0 ? (argv[di + 1] ?? '') : null;
  if (di >= 0) argv.splice(di, 2);
  const wi = argv.indexOf("--wt-root");
  const wtRoot = wi >= 0 ? (argv[wi + 1] ?? "") : null;
  if (wi >= 0) argv.splice(wi, 2);
  const folder = argv[0];
  if (!folder) {
    console.error('usage: node preflight.mjs <roadmap-folder> [--ref <target-branch>] [--declare-permissions "<text>"] [--wt-root <path>]');
    process.exit(2);
  }
  const result = runPreflight(folder, { ref, declarePermissions, wtRoot: wtRoot || null });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.errors.length ? 1 : 0);
}
