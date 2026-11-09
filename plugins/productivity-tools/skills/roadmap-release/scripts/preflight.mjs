#!/usr/bin/env node
// Preflight for the roadmap-release skill: validates (or derives) release.config.json
// and checks permission rules. Read-only: it never writes any file or setting.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
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
    for (const l of asList(g.needsLock)) {
      if (!locks.includes(l)) errors.push(`${at}.needsLock cites undeclared lock: ${l}`);
    }
  });
  return errors;
}

export function parseGatesTable(markdown) {
  const m = /<!--\s*roadmap:gates\s*-->([\s\S]*?)<!--\s*\/roadmap:gates\s*-->/.exec(markdown || '');
  if (!m) return [];
  const rows = m[1].split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('|'));
  const cells = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  if (rows.length < 2) return [];
  const head = cells(rows[0]);
  return rows.slice(1).filter((l) => !/^\|[\s:|-]+\|?$/.test(l)).map((l) => {
    const c = cells(l);
    return Object.fromEntries(head.map((h, i) => [h, c[i] ?? '']));
  });
}

export function deriveConfig({ gatesBlockRows = [], projectContext = '' } = {}) {
  const gates = gatesBlockRows
    .map((r) => ({ name: String(r.ID ?? '').trim(), cmd: String(r.Command ?? '').trim().replace(/^`+|`+$/g, '').trim() }))
    .filter((g) => g.name && g.cmd)
    .map((g) => ({ ...g, kind: /\b(lint|build)\b/.test(g.cmd) ? 'exit' : 'tests' }));
  return { generated: true, projectContext, install: '', locks: [], conflictRules: '', gates };
}

export function effectiveMaxParallel(cfg, requested) {
  if (cfg && cfg.generated) return 1;
  const n = Number.isFinite(requested) ? requested : Number.isFinite(cfg?.maxParallel) ? cfg.maxParallel : 3;
  return Math.max(1, Math.floor(n));
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
  for (const g of cfg?.gates || []) cmds.push(g.cmd);
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
  add('Bash(git:*)', null);
  return out;
}

export function requiredRules(cfg) {
  return Object.keys(requiredCommands(cfg));
}

export function missingRules(required, settingsList, commandsByRule = {}) {
  const allow = new Set();
  for (const s of settingsList || []) for (const r of s?.permissions?.allow || []) allow.add(String(r).trim());
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

export function quoteArg(path) {
  return '"' + String(path).replace(/(["$`])/g, '\\$1') + '"';
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function repoRoot(from) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: from, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return from; }
}

export function runPreflight(folder, { home = homedir() } = {}) {
  const dir = resolve(folder);
  const configPath = join(dir, 'release.config.json');
  const root = repoRoot(dir);
  let config = null;
  let generated = false;
  const errors = [];
  if (existsSync(configPath)) {
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
      config = deriveConfig({ gatesBlockRows: rows, projectContext: ctx });
      generated = true;
    }
  }
  if (config) errors.push(...validateReleaseConfig(config));
  let missing = [];
  if (config && errors.length === 0) {
    const settings = ['settings.json'].map((f) => join(home, '.claude', f))
      .concat([join(root, '.claude', 'settings.json'), join(root, '.claude', 'settings.local.json')]).map(readJson);
    const cmds = requiredCommands(config);
    missing = missingRules(Object.keys(cmds), settings, cmds);
  }
  return { configPath, generated, errors, missingRules: missing, config };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2];
  if (!folder) {
    console.error('usage: node preflight.mjs <roadmap-folder>');
    process.exit(2);
  }
  const result = runPreflight(folder);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.errors.length ? 1 : 0);
}
