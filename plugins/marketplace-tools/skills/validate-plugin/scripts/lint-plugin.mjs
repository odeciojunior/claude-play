#!/usr/bin/env node
// Deterministic plugin linter for the claude-play marketplace.
// Usage: node lint-plugin.mjs <plugin-dir> [--marketplace <path>]
// Exit codes: 0 = no FAIL, 1 = at least one FAIL, 2 = usage error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_KEYS = new Set([
  'name',
  'description',
  'disable-model-invocation',
  'user-invocable',
  'argument-hint',
  'compatibility',
  'license',
  'metadata',
]);
const AGENT_IGNORED_KEYS = ['hooks', 'mcpServers', 'permissionMode', 'initialPrompt'];
const RESERVED_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-'];
const RESERVED_NAMES = ['claude', 'anthropic', 'anthropics', 'claude-code', 'claude-mods'];

// Rule observed from `claude plugin validate`: reserved prefixes, reserved exact names,
// or "official" combined with claude/anthropic.
export function isReservedPluginName(name) {
  const n = String(name ?? '').toLowerCase();
  if (RESERVED_NAMES.includes(n)) return true;
  if (RESERVED_PREFIXES.some((p) => n.startsWith(p))) return true;
  return n.includes('official') && (n.includes('claude') || n.includes('anthropic'));
}
const ROOT_REF = '${CLAUDE_PLUGIN_ROOT}';
const ROOT_REDIRECT_OR_MKDIR = /(>|mkdir -p)\s*"?\$\{CLAUDE_PLUGIN_ROOT\}/;

// True when the line writes under the plugin root: a redirect or mkdir -p into it,
// or a cp whose last argument (the destination) is under it.
function writesPluginRoot(line) {
  if (ROOT_REDIRECT_OR_MKDIR.test(line)) return true;
  const m = /(?:^|[\s;&|(])cp\s+(.*)$/.exec(line);
  if (!m) return false;
  const args = m[1].split(/[;&|]/)[0].trim().split(/\s+/).filter((a) => !a.startsWith('-'));
  const last = (args.at(-1) ?? '').replace(/^["']/, '');
  return args.length >= 2 && last.startsWith(ROOT_REF);
}
const SPLIT = /\r?\n/;

/**
 * Parse the leading frontmatter block of a Markdown file without a YAML library.
 * Returns null when line 1 is not `---` or the block is never closed.
 * bodyStartLine is the 1-based line number right after the closing `---`.
 */
export function parseFrontmatter(text) {
  const lines = String(text).replace(/^﻿/, '').split(SPLIT);
  if (lines[0].trimEnd() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  const keys = new Map();
  let current = null;
  let parts = [];
  const flush = () => {
    if (current !== null) keys.set(current, unquote(parts.join(' ').trim()));
    current = null;
    parts = [];
  };
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (m) {
      flush();
      current = m[1];
      let first = m[2].trim();
      if (first !== '' && first[0] !== '"' && first[0] !== "'") first = first.replace(/(^|\s)#.*$/, '').trim();
      parts = /^[>|][+-]?$/.test(first) || first === '' ? [] : [first];
    } else if (current !== null && (/^\s+\S/.test(line) || line.trim() === '')) {
      if (line.trim() !== '') parts.push(line.trim());
    }
  }
  flush();
  return { keys, bodyStartLine: end + 2 };
}

function unquote(v) {
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listDir(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walk(dir, skipDirs = new Set(['node_modules', 'fixtures', '.git'])) {
  const out = [];
  for (const e of listDir(dir)) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!skipDirs.has(e.name)) out.push(...walk(full, skipDirs));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function lineCount(text) {
  const lines = text.split(SPLIT);
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

const rel = (dir, p) => path.relative(dir, p).split(path.sep).join('/');

export function lintPlugin(dir, { marketplace } = {}) {
  const results = [];
  const add = (level, check, detail) =>
    results.push(detail === undefined ? { level, check } : { level, check, detail });
  const ok = (check) => add('OK', check);

  dir = path.resolve(dir);
  const dirName = path.basename(dir);
  const mpPath = marketplace
    ? path.resolve(marketplace)
    : path.resolve(dir, '..', '..', '.claude-plugin', 'marketplace.json');

  // ---- Check 1 + 2: plugin.json ----
  const pjPath = path.join(dir, '.claude-plugin', 'plugin.json');
  let pj = null;
  if (!isFile(pjPath)) {
    add('FAIL', 'plugin.json exists', `${rel(dir, pjPath)} not found`);
  } else {
    try {
      pj = JSON.parse(readText(pjPath));
      if (pj === null || typeof pj !== 'object' || Array.isArray(pj)) {
        pj = null;
        add('FAIL', 'plugin.json parses', 'top-level must be an object');
      }
    } catch (e) {
      add('FAIL', 'plugin.json parses', e.message);
    }
  }

  if (pj) {
    if (pj.name === dirName) ok('Directory name matches plugin.json name');
    else add('FAIL', 'Directory name matches plugin.json name', `directory "${dirName}" vs name "${pj.name}"`);

        if (isReservedPluginName(pj.name)) {
      add('FAIL', 'Plugin name is not reserved', `"${pj.name}" is reserved; claude plugin validate rejects it`);
    } else {
      ok('Plugin name is not reserved');
    }

    const missing = [];
    const filled = (v) => typeof v === 'string' && v.trim() !== '';
    if (!filled(pj.name)) missing.push('name');
    if (!filled(pj.description)) missing.push('description');
    if (!filled(pj.version)) missing.push('version');
    if (!filled(pj.author?.name)) missing.push('author.name');
    if (!filled(pj.author?.email)) missing.push('author.email');
    if (!filled(pj.license)) missing.push('license');
    if (!Array.isArray(pj.keywords) || pj.keywords.length === 0) missing.push('keywords');
    if (missing.length) add('FAIL', 'plugin.json required fields', `missing or empty: ${missing.join(', ')} (repo policy)`);
    else ok('plugin.json required fields');
  }

  // ---- Check 3 + 4: skills ----
  const skillsDir = path.join(dir, 'skills');
  const skillFiles = listDir(skillsDir)
    .filter((e) => e.isDirectory())
    .map((e) => path.join(skillsDir, e.name, 'SKILL.md'))
    .filter(isFile);
  if (skillFiles.length === 0) add('FAIL', 'Plugin has at least one SKILL.md', 'no skills/*/SKILL.md found');
  else ok('Plugin has at least one SKILL.md');

  for (const file of skillFiles) {
    const name = rel(dir, file);
    const text = readText(file);
    const fm = parseFrontmatter(text);
    if (!fm) {
      add('FAIL', `${name} frontmatter`, 'missing or unclosed frontmatter (line 1 must be ---)');
      continue;
    }
    const problems = [];
    const warns = [];
    if (!fm.keys.get('name')) problems.push(['FAIL', 'frontmatter missing name']);
    if (!fm.keys.get('description')) problems.push(['FAIL', 'frontmatter missing or empty description']);
    for (const key of fm.keys.keys()) {
      if (key === 'user-invokable') {
        problems.push(['FAIL', 'key user-invokable is misspelled, Claude Code ignores it; use user-invocable']);
      } else if (!SKILL_KEYS.has(key)) {
        warns.push(['WARN', `key "${key}" is outside the allowed frontmatter keys (repo policy)`]);
      }
    }
    for (const key of ['disable-model-invocation', 'user-invocable']) {
      if (fm.keys.has(key) && !['true', 'false'].includes(fm.keys.get(key).toLowerCase())) {
        problems.push(['FAIL', `${key} must be true or false, got "${fm.keys.get(key)}"`]);
      }
    }
    const combined = (fm.keys.get('description') ?? '').length + (fm.keys.get('when_to_use') ?? '').length;
    if (combined > 1536) warns.push(['WARN', `description + when_to_use is ${combined} chars (> 1,536)`]);

    const all = [...problems, ...warns];
    if (all.length === 0) ok(`${name} frontmatter`);
    for (const [level, detail] of all) add(level, `${name} frontmatter`, detail);

    const n = lineCount(text);
    if (n > 500) add('WARN', `${name} length`, `${n} lines (> 500); move detail into references/`);
    else ok(`${name} length`);

    // references
    const refDir = path.join(path.dirname(file), 'references');
    const refs = listDir(refDir).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);
    for (const refName of refs) {
      const refFile = path.join(refDir, refName);
      const refText = readText(refFile);
      const refRel = rel(dir, refFile);
      const rn = lineCount(refText);
      if (rn > 100 && !/^##\s+(Contents|Table of Contents)\s*$/im.test(refText)) {
        add('WARN', `${refRel} contents`, `${rn} lines (> 100) without a ## Contents list`);
      } else {
        ok(`${refRel} contents`);
      }
      const targets = new Set();
      for (const m of refText.matchAll(/\]\(([^)\s#]+)/g)) targets.add(path.posix.basename(m[1]));
      for (const m of refText.matchAll(/references\/([\w.-]+\.md)/g)) targets.add(m[1]);
      const linked = [...targets].filter((t) => t !== refName && refs.includes(t));
      if (linked.length) add('WARN', `${refRel} links`, `links ${linked.join(', ')}; keep references one level deep`);
    }
  }

  // ---- Check 5: agents ----
  for (const e of listDir(path.join(dir, 'agents'))) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const name = `agents/${e.name}`;
    const fm = parseFrontmatter(readText(path.join(dir, 'agents', e.name)));
    if (!fm) {
      add('FAIL', `${name} frontmatter`, 'line 1 must be --- and the block must be closed');
      continue;
    }
    const issues = [];
    if (!fm.keys.get('name')) issues.push('missing name');
    else if (fm.keys.get('name').includes(':')) issues.push('name must not contain ":"');
    if (!fm.keys.get('description')) issues.push('missing description');
    for (const k of AGENT_IGNORED_KEYS) {
      if (fm.keys.has(k)) issues.push(`key ${k} is ignored for plugin agents`);
    }
    if (issues.length) for (const i of issues) add('FAIL', `${name} frontmatter`, i);
    else ok(`${name} frontmatter`);
  }

  // ---- Check 6: hooks, MCP, CLAUDE.md ----
  const hooksPath = path.join(dir, 'hooks', 'hooks.json');
  if (isFile(hooksPath)) {
    try {
      const h = JSON.parse(readText(hooksPath));
      if (h && typeof h.hooks === 'object' && h.hooks !== null && !Array.isArray(h.hooks)) ok('hooks/hooks.json');
      else add('FAIL', 'hooks/hooks.json', 'missing top-level "hooks" object');
    } catch (err) {
      add('FAIL', 'hooks/hooks.json', `invalid JSON: ${err.message}`);
    }
  }
  const mcpPath = path.join(dir, '.mcp.json');
  if (isFile(mcpPath)) {
    try {
      JSON.parse(readText(mcpPath));
      ok('.mcp.json');
    } catch (err) {
      add('FAIL', '.mcp.json', `invalid JSON: ${err.message}`);
    }
  }
  if (isFile(path.join(dir, 'CLAUDE.md'))) {
    add('WARN', 'CLAUDE.md at plugin root', 'not loaded for plugins; move the guidance into a skill or README');
  }

  // ---- Check 7: writes into CLAUDE_PLUGIN_ROOT ----
  const hits = [];
  for (const top of ['scripts', 'skills', 'hooks']) {
    for (const file of walk(path.join(dir, top))) {
      if (file.endsWith('.test.mjs')) continue;
      let text;
      try {
        if (fs.statSync(file).size > 1024 * 1024) continue;
        text = readText(file);
      } catch {
        continue;
      }
      if (text.includes('\0')) continue;
      text.split(SPLIT).forEach((line, i) => {
        if (writesPluginRoot(line)) hits.push(`${rel(dir, file)}:${i + 1}`);
      });
    }
  }
  if (hits.length) {
    for (const h of hits) {
      add('WARN', 'No writes into CLAUDE_PLUGIN_ROOT', `${h}: plugin root changes on update; use \${CLAUDE_PLUGIN_DATA}`);
    }
  } else {
    ok('No writes into CLAUDE_PLUGIN_ROOT');
  }

  // ---- Check 8: README + marketplace ----
  const readme = path.join(dir, 'README.md');
  if (isFile(readme) && readText(readme).trim().length >= 10) ok('README.md present');
  else add('WARN', 'README.md present', 'missing or shorter than 10 characters');

  if (pj) {
    let mp = null;
    if (!isFile(mpPath)) {
      add('WARN', 'Registered in marketplace.json', `${mpPath} not found`);
    } else {
      try {
        mp = JSON.parse(readText(mpPath));
      } catch (err) {
        add('WARN', 'Registered in marketplace.json', `cannot parse ${mpPath}: ${err.message}`);
      }
    }
    if (mp) {
      const entry = Array.isArray(mp.plugins) ? mp.plugins.find((p) => p?.name === pj.name) : undefined;
      if (!entry) {
        add('WARN', 'Registered in marketplace.json', `no entry named "${pj.name}" in the marketplace`);
      } else {
        ok('Registered in marketplace.json');
        if (entry.version !== undefined) {
          if (entry.version === pj.version) ok('Marketplace version matches plugin.json');
          else add('FAIL', 'Marketplace version matches plugin.json', `marketplace ${entry.version} vs plugin.json ${pj.version}`);
        }
      }
    }
  }

  return { results };
}

export function formatResults(results) {
  const pad = { OK: '[OK]   ', WARN: '[WARN] ', FAIL: '[FAIL] ' };
  const lines = results.map((r) => `${pad[r.level]}${r.check}${r.detail ? `: ${r.detail}` : ''}`);
  const count = (l) => results.filter((r) => r.level === l).length;
  lines.push(`Result: ${count('OK')} OK, ${count('WARN')} WARN, ${count('FAIL')} FAIL`);
  return lines.join('\n');
}

function main(argv) {
  let dir = null;
  let marketplace;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--marketplace') {
      marketplace = argv[++i];
      if (!marketplace) return usage('--marketplace needs a path');
    } else if (!dir) {
      dir = argv[i];
    } else {
      return usage(`unexpected argument: ${argv[i]}`);
    }
  }
  if (!dir) return usage('missing <plugin-dir>');
  if (!isDir(dir)) return usage(`not a directory: ${dir}`);
  const { results } = lintPlugin(dir, { marketplace });
  console.log(formatResults(results));
  return results.some((r) => r.level === 'FAIL') ? 1 : 0;
}

function usage(msg) {
  console.error(`${msg}\nUsage: node lint-plugin.mjs <plugin-dir> [--marketplace <path>]`);
  return 2;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = main(process.argv.slice(2));
}
