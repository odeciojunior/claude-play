#!/usr/bin/env node
// Preflight for the roadmap-release skill: validates (or derives) release.config.json
// and checks permission rules. Read-only: it never writes any file or setting.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
    else if (seen.has(g.name)) errors.push(`${at}.name duplicate: ${g.name}`);
    else seen.add(g.name);
    if (typeof g.cmd !== 'string' || !g.cmd.trim()) errors.push(`${at}.cmd is required`);
    if (!KINDS.includes(g.kind)) errors.push(`${at}.kind must be one of ${KINDS.join(', ')}`);
    if (g.restricted != null && typeof g.restricted !== 'boolean') errors.push(`${at}.restricted must be a boolean`);
    for (const l of asList(g.needsLock)) {
      if (l === 'merge') { errors.push(`${at}.needsLock cites the reserved lock name: merge`); continue; }
      if (!locks.includes(l)) errors.push(`${at}.needsLock cites undeclared lock: ${l}`);
    }
  });
  if (cfg.gates.every((g) => g && g.restricted === true)) errors.push('every gate is restricted: nothing can run without authorization');
  return errors;
}

// Blanks fenced code (same length, newlines kept) with the checker's fence rule: 3+ backticks or tildes, closed by the same char and a length >= the opener.
function blankFences(text) {
  const lines = text.split('\n');
  let open = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (open === null) {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) open = { ch: m[1][0], len: m[1].length };
    } else {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (m && m[1][0] === open.ch && m[1].length >= open.len) open = null;
      else lines[i] = ' '.repeat(line.length);
    }
  }
  return lines.join('\n');
}

// Same cell split as the checker: `\|` is an escaped pipe inside a cell.
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

// Columns are read by position (ID, Command, Environment, When, Baseline); header words are ignored.
export function parseGatesTable(markdown) {
  const text = String(markdown || '').replace(/\r\n?/g, '\n');
  const scan = blankFences(text);
  const open = /<!--\s*roadmap:gates(?=\s|-->)[\s\S]*?-->/.exec(scan);
  if (!open) return [];
  const from = open.index + open[0].length;
  const close = /<!--\s*\/roadmap:gates\s*-->/.exec(scan.slice(from));
  if (!close) return [];
  const body = text.slice(from, from + close.index);
  const rows = body.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|')).map(splitRow);
  const isSep = (r) => r.length > 0 && r.every((c) => /^:?-+:?$/.test(c));
  return rows.slice(1).filter((r) => !isSep(r) && r.length === 5 && !['', '-', '—'].includes(r[1]))
    .map(([ID, Command, Environment, When, Baseline]) => ({ ID, Command, Environment, When, Baseline }));
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

const RESTRICT_MARKS = ['prod', 'produção', 'producao', 'staging', 'owner', 'dono'];
const LOCAL_MARKS = ['local', 'every', 'each', 'before', 'merge', 'task', 'cada', 'todo', 'antes', 'always', 'sempre'];

// Classifies a gate row by its Environment and When cells, cell by cell. A restriction mark in either cell wins;
// otherwise both cells must be free (empty, a dash, or a local mark): anything else is unknown, treated as restricted.
export function classifyGate(environment, when) {
  const cells = [environment, when].map((c) => String(c ?? '').trim().toLowerCase());
  const tokens = (c) => c.split(/[^\p{L}]+/u).filter(Boolean);
  const starts = (c, marks) => tokens(c).some((t) => marks.some((m) => t.startsWith(m)));
  if (cells.some((c) => starts(c, RESTRICT_MARKS) || /(^|[^\p{L}])release\s+only(?![\p{L}])/u.test(c))) return 'restricted';
  const isFree = (c) => ['', '-', '—'].includes(c) || starts(c, LOCAL_MARKS);
  return cells.every(isFree) ? 'free' : 'unknown';
}

export function deriveConfig({ gatesBlockRows = [], projectContext = '', install = '', warnings = [] } = {}) {
  const gates = gatesBlockRows
    .map((r) => ({ name: String(r.ID ?? '').trim(), cmd: String(r.Command ?? '').trim().replace(/^`+|`+$/g, '').trim(), cls: classifyGate(r.Environment, r.When) }))
    .filter((g) => g.name && g.cmd)
    .map(({ cls, ...g }) => {
      if (cls === 'unknown') warnings.push(`gate ${g.name}: Environment/When not recognized, treated as restricted (runs only with authorizeExternal ["gate:${g.name}"]); set restricted to false in release.config.json if it is local`);
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

export function requiredCommands(cfg) {
  const cmds = [];
  for (const g of cfg?.gates || []) if (g.restricted !== true) cmds.push(g.cmd);
  cmds.push(cfg?.install, ...asList(cfg?.setup), ...asList(cfg?.beforeEvidence));
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
  // The workflow itself runs git and node (checker, docs measure, test integrity): a narrower rule is not enough.
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

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function repoRoot(from) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: from, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return from; }
}

function readRef(root, ref, relFile) {
  try {
    return execFileSync('git', ['show', `${ref}:${relFile}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}

export function runPreflight(folder, { home = homedir(), ref = null, configDir = process.env.CLAUDE_CONFIG_DIR || null } = {}) {
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
      const rows = parseGatesTable(md);
      if (md && rows.length === 0) errors.push('strategy has no roadmap:gates table rows');
      let ctx = '';
      try { ctx = readFileSync(join(root, 'CLAUDE.md'), 'utf8'); } catch { /* no project CLAUDE.md */ }
      const install = detectInstall(root);
      if (!install) warnings.push('no lockfile at the repository root, so the derived install is empty and worktrees get no dependencies: set "install" in release.config.json if the project needs one');
      config = deriveConfig({ gatesBlockRows: rows, projectContext: ctx, install, warnings });
      generated = true;
    }
  }
  if (config) errors.push(...validateReleaseConfig(config));
  let missing = [];
  if (config && errors.length === 0) {
    const settings = ['settings.json'].map((f) => join(configDir || join(home, '.claude'), f))
      .concat([join(root, '.claude', 'settings.json'), join(root, '.claude', 'settings.local.json')]).map(readJson);
    const cmds = requiredCommands(config);
    missing = missingRules(Object.keys(cmds), settings, cmds);
    for (const g of config.gates.filter((x) => x.restricted === true)) {
      const extra = Object.keys(requiredCommands({ gates: [{ ...g, restricted: false }] })).filter((r) => !(r in cmds));
      warnings.push(`gate ${g.name} is restricted and runs only with authorizeExternal ["gate:${g.name}"]; if authorized, add permission rule(s): ${extra.length ? extra.join(', ') : '(none beyond the required ones)'}`);
    }
  }
  return { configPath, generated, errors, missingRules: missing, warnings, config };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf('--ref');
  const ref = ri >= 0 ? argv[ri + 1] : null;
  if (ri >= 0) argv.splice(ri, 2);
  const folder = argv[0];
  if (!folder) {
    console.error('usage: node preflight.mjs <roadmap-folder> [--ref <target-branch>]');
    process.exit(2);
  }
  const result = runPreflight(folder, { ref });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.errors.length ? 1 : 0);
}
