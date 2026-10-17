// check-roadmap 1.3.0 format 1
// Deterministic checker for roadmap folders (format contract: roadmap-planner/references/formats.md).
// Single file, Node >= 18, no dependencies, no network. Vendored into each roadmap folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Line 1 of this file is the single source of the version.
const SELF_HEADER = readHeader(fileURLToPath(import.meta.url));
export const FORMAT_VERSION = SELF_HEADER ? SELF_HEADER.format : 0;
export const CHECKER_VERSION = SELF_HEADER ? SELF_HEADER.version : '0.0.0';

const ROLE_KEYS = ['readme', 'state', 'decisions', 'log', 'criticalPath', 'measurements', 'sources', 'requirements'];
const VOCAB_STRINGS = [
  'decisionInForce', 'decisionPending', 'decisionSupersededBy',
  'coverageCovered', 'coverageOutOfScope', 'coverageNeedsClarification',
  'branchLive', 'branchDeleted',
];
const VOCAB_ARRAYS = ['deliverableStatuses', 'integratedStatuses', 'markers', 'bannedPhrases'];
const PRIORITIES = ['Must', 'Should', 'Could', "Won't"];
const ID_RE = /\b(?:DEC-\d+|REQ-\d+|SRC-\d+|BLQ-\d+|E\d+)\b/g;

// ---------- parsing ----------

function norm(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').normalize('NFC');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAttrs(s) {
  // Linear tokenizer: key=value, key="quoted value", and positional tokens (_0, _1, ...).
  const attrs = {};
  const str = s || '';
  const n = str.length;
  const isWs = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';
  let pos = 0;
  let positional = 0;
  while (pos < n) {
    while (pos < n && isWs(str[pos])) pos++;
    if (pos >= n) break;
    let end = pos;
    while (end < n && !isWs(str[end]) && str[end] !== '=') end++;
    if (end < n && str[end] === '=' && end > pos) {
      const key = str.slice(pos, end);
      let vs = end + 1;
      if (vs < n && str[vs] === '"') {
        const close = str.indexOf('"', vs + 1);
        if (close !== -1) {
          attrs[key] = str.slice(vs + 1, close);
          pos = close + 1;
          continue;
        }
      }
      let ve = vs;
      while (ve < n && !isWs(str[ve])) ve++;
      if (ve > vs) {
        attrs[key] = str.slice(vs, ve);
        pos = ve;
        continue;
      }
      // "key=" with nothing after: fall through as a positional token
    }
    let te = pos;
    while (te < n && !isWs(str[te])) te++;
    if (te === pos) te = pos + 1;
    attrs[`_${positional++}`] = str.slice(pos, te);
    pos = te;
  }
  return attrs;
}

// Blanks fenced code (same length, newlines kept) so offsets stay valid. keepMermaid leaves ```mermaid content intact.
export function scanFences(text, keepMermaid) {
  const lines = text.split('\n');
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open === null) {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
        open = { ch: m[1][0], len: m[1].length, keep: keepMermaid && /^\s*mermaid\b/i.test(m[2]) };
      }
    } else {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (m && m[1][0] === open.ch && m[1].length >= open.len) open = null;
      else if (!open.keep) lines[i] = ' '.repeat(line.length);
    }
  }
  return { text: lines.join('\n'), unclosed: open !== null };
}

// One linear pass over the comments of a text; a comment whose `-->` comes after the next `<!--` is malformed.
function scanComments(text) {
  const out = [];
  let closeAt = -2;
  let openAt = -2;
  let i = text.indexOf('<!--');
  while (i !== -1) {
    const from = i + 4;
    if (closeAt !== -1 && closeAt < from) closeAt = text.indexOf('-->', from);
    if (openAt !== -1 && openAt < from) openAt = text.indexOf('<!--', from);
    const malformed = closeAt === -1 || (openAt !== -1 && openAt < closeAt);
    const end = malformed ? (openAt === -1 ? text.length : openAt) : closeAt;
    out.push({ start: i, innerStart: from, end, after: malformed ? end : closeAt + 3, malformed });
    if (malformed) i = openAt;
    else {
      if (openAt !== -1 && openAt < closeAt + 3) openAt = text.indexOf('<!--', closeAt + 3);
      i = openAt;
    }
  }
  return out;
}

const WS_RE = /\s/;

// Position right after leading whitespace of the comment inner text.
function skipWs(text, from, end) {
  let k = from;
  while (k < end && WS_RE.test(text[k])) k++;
  return k;
}

export function readBlocks(text, name) {
  text = norm(text);
  const scan = scanFences(text, false).text;
  const comments = scanComments(scan);
  const openTag = `roadmap:${name}`;
  const closeTag = `/roadmap:${name}`;
  const out = [];
  for (let idx = 0; idx < comments.length; idx++) {
    const c = comments[idx];
    const k = skipWs(scan, c.innerStart, c.end);
    if (!scan.startsWith(openTag, k)) continue;
    const after = k + openTag.length;
    if (after < c.end && !WS_RE.test(scan[after])) continue;
    if (c.malformed) {
      const block = { attrs: {}, body: '' };
      Object.defineProperty(block, 'closed', { value: false, enumerable: false });
      Object.defineProperty(block, 'malformed', { value: true, enumerable: false });
      out.push(block);
      continue;
    }
    let closer = null;
    for (let j = idx + 1; j < comments.length; j++) {
      const d = comments[j];
      if (d.malformed) continue;
      const dk = skipWs(scan, d.innerStart, d.end);
      if (!scan.startsWith(closeTag, dk)) continue;
      const tail = dk + closeTag.length;
      if (scan.slice(tail, d.end).trim() === '') {
        closer = d;
        idx = j;
        break;
      }
    }
    const block = { attrs: parseAttrs(scan.slice(after, c.end)), body: closer ? text.slice(c.after, closer.start) : '' };
    Object.defineProperty(block, 'closed', { value: Boolean(closer), enumerable: false });
    Object.defineProperty(block, 'malformed', { value: false, enumerable: false });
    out.push(block);
  }
  return out;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

export function parseTable(body) {
  const rows = norm(body)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map(splitRow);
  const isSep = (r) => r.length > 0 && r.every((c) => /^:?-+:?$/.test(c));
  return rows.slice(1).filter((r) => !isSep(r));
}

function parseList(body) {
  const items = [];
  for (const line of norm(body).split('\n')) {
    if (!line.trim() || line.trim().startsWith('<!--') || line.trim().startsWith('|')) continue;
    const m = /^(?:\d+[.)]|[-*+])\s+(.*)$/.exec(line);
    if (m) items.push(m[1].trim());
    else if (items.length && /^\s/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

function stripNote(seg) {
  const s = seg.trimEnd();
  if (!s.endsWith(')')) return s;
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ')') depth++;
    else if (s[i] === '(') {
      depth--;
      if (depth === 0) return s.slice(0, i).trimEnd();
    }
  }
  return s;
}

function parseStatus(cell) {
  return cell
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => {
      const noNote = stripNote(seg);
      const idx = noNote.indexOf(':');
      return (idx >= 0 ? noNote.slice(idx + 1) : noNote).trim();
    });
}

const isEmptyCell = (c) => c === undefined || c.trim() === '' || c.trim() === '-' || c.trim() === '—';
const idsIn = (s, re) => [...new Set((s || '').match(re) || [])];

function shasIn(cell) {
  const out = [];
  for (const m of (cell || '').matchAll(/`([0-9a-f]{7,40})`/g)) {
    out.push(m[1]);
  }
  return [...new Set(out)];
}

// ---------- loading ----------

const isNonEmptyString = (x) => typeof x === 'string' && x.trim() !== '';

function samePathKey(p) {
  const r = path.resolve(p);
  return process.platform === 'win32' || process.platform === 'darwin' ? r.toLowerCase() : r;
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// `repoRoot` is the git top level when known; without git a strategy may sit in the folder or its parent.
export function validateConfig(c, folder = '.', repoRoot = null) {
  const fail = (msg) => {
    throw new Error(`config: ${msg}`);
  };
  if (!c || typeof c !== 'object' || Array.isArray(c)) fail('roadmap.config.json must be a JSON object');
  if (!Number.isInteger(c.formatVersion) || c.formatVersion < 1) fail('formatVersion must be an integer >= 1');
  if (c.formatVersion > FORMAT_VERSION) return;
  for (const k of ['language', 'integrationBranch']) {
    if (!isNonEmptyString(c[k])) fail(`${k} must be a non-empty string`);
  }
  if (!isNonEmptyString(c.strategy)) fail('strategy must be a non-empty string');
  if (!c.files || typeof c.files !== 'object' || Array.isArray(c.files)) fail('files must be an object');
  const base = path.resolve(folder);
  const relPath = (key, v, allowParent) => {
    if (path.isAbsolute(v) || /^[A-Za-z]:/.test(v) || v.startsWith('/') || v.startsWith('\\')) fail(`${key} must be a relative path, got an absolute one`);
    const abs = path.resolve(base, v);
    const limit = allowParent ? (repoRoot ? path.resolve(repoRoot) : path.dirname(base)) : base;
    if (!isInside(limit, abs)) fail(`${key} "${v}" escapes ${allowParent ? 'the repository root' : 'the roadmap folder'}`);
    return abs;
  };
  const seen = new Map();
  const claim = (key, abs) => {
    const id = samePathKey(abs);
    if (seen.has(id)) fail(`${key} and ${seen.get(id)} point to the same file`);
    seen.set(id, key);
  };
  claim('strategy', relPath('strategy', c.strategy, true));
  for (const k of ROLE_KEYS) {
    if (!(k in c.files)) fail(`files.${k} is required`);
    const v = c.files[k];
    if (v === null && k === 'measurements') continue;
    if (!isNonEmptyString(v)) fail(`files.${k} must be a file name${k === 'measurements' ? ' or null' : ''}`);
    claim(`files.${k}`, relPath(`files.${k}`, v, false));
  }
  if (!c.vocab || typeof c.vocab !== 'object' || Array.isArray(c.vocab)) fail('vocab must be an object');
  for (const k of VOCAB_STRINGS) if (!isNonEmptyString(c.vocab[k])) fail(`vocab.${k} must be a non-empty string`);
  const strArray = (key, arr, nonEmpty) => {
    if (!Array.isArray(arr)) fail(`${key} must be an array`);
    if (nonEmpty && arr.length === 0) fail(`${key} must not be empty`);
    arr.forEach((x, i) => {
      if (!isNonEmptyString(x)) fail(`${key}[${i}] must be a non-empty string`);
    });
  };
  for (const k of VOCAB_ARRAYS) strArray(`vocab.${k}`, c.vocab[k], k === 'deliverableStatuses');
  if ('releasedStatuses' in c.vocab) strArray('vocab.releasedStatuses', c.vocab.releasedStatuses, false);
  strArray('tracks', c.tracks, true);
  if (!c.limits || typeof c.limits !== 'object' || Array.isArray(c.limits)) fail('limits must be an object');
  for (const k of ['nowItems', 'cellChars']) if (!(k in c.limits)) fail(`limits.${k} is required`);
  for (const [k, val] of Object.entries(c.limits)) {
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) fail(`limits.${k} must be a positive number`);
  }
}

function decodeText(buf) {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), invalid: false };
  } catch {
    return { text: new TextDecoder('utf-8').decode(buf), invalid: true };
  }
}

function readText(file, what, invalid) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch (e) {
    throw new Error(`config: cannot read ${what} (${file}): ${e.code || e.message}`);
  }
  const d = decodeText(buf);
  if (d.invalid && invalid) invalid.push(path.basename(file));
  return norm(d.text);
}

export function loadRoadmap(folder) {
  const invalid = [];
  const cfgFile = path.join(folder, 'roadmap.config.json');
  const raw = readText(cfgFile, 'roadmap.config.json', invalid);
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    throw new Error(`config: invalid JSON in roadmap.config.json: ${e.message}`);
  }
  validateConfig(config, folder, config && config.formatVersion <= FORMAT_VERSION ? gitTopLevel(folder) : null);
  const roadmap = { folder, config, strategyPath: '', strategy: '', files: {}, paths: {}, invalidUtf8: invalid };
  if (config.formatVersion > FORMAT_VERSION) return roadmap;
  roadmap.strategyPath = path.resolve(folder, config.strategy);
  roadmap.strategy = readText(roadmap.strategyPath, 'strategy', invalid);
  for (const role of ROLE_KEYS) {
    const name = config.files[role];
    roadmap.paths[role] = name;
    roadmap.files[role] = name === null ? null : readText(path.resolve(folder, name), `files.${role}`, invalid);
  }
  return roadmap;
}

// ---------- git adapter ----------

function gitRun(folder, args, input) {
  return spawnSync('git', ['-C', folder, ...args], { encoding: 'utf8', input, maxBuffer: 1 << 28 });
}

function gitTopLevel(folder) {
  const r = gitRun(folder, ['rev-parse', '--show-toplevel']);
  return !r.error && r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

// Returns null when `folder` is not inside a git repository, `{ unavailable, reason }` when git cannot be used.
export function createGitAdapter(folder) {
  const probe = gitRun(folder, ['rev-parse', '--is-inside-work-tree']);
  if (probe.error) return { unavailable: true, reason: probe.error.code || probe.error.message };
  if (probe.status !== 0) {
    if (/not a git repository/i.test(probe.stderr || '')) return null;
    return { unavailable: true, reason: (probe.stderr || '').trim().split('\n')[0] || `git exited ${probe.status}` };
  }
  if (probe.stdout.trim() !== 'true') return null;

  const oids = new Map(); // sha as written -> full oid, or null when missing
  const ancestors = new Map(); // ref -> Set of ancestor oids (built after a few single checks)
  const singleCalls = new Map();
  const ANCESTRY_BATCH_AFTER = 4;

  function resolveMany(shas) {
    const todo = [...new Set(shas)].filter((s) => !oids.has(s));
    if (todo.length === 0) return;
    const r = gitRun(folder, ['cat-file', '--batch-check'], todo.map((s) => `${s}^{commit}`).join('\n') + '\n');
    const lines = r.error || r.status !== 0 ? [] : r.stdout.split('\n');
    todo.forEach((s, i) => {
      const m = /^([0-9a-f]{40,64}) commit /.exec(lines[i] || '');
      oids.set(s, m ? m[1] : null);
    });
  }

  return {
    prefetch: (shas) => resolveMany(shas),
    commitExists: (sha) => {
      resolveMany([sha]);
      return oids.get(sha) !== null;
    },
    isAncestor: (sha, ref) => {
      resolveMany([sha]);
      const oid = oids.get(sha);
      if (!oid) return false;
      if (ancestors.has(ref)) return ancestors.get(ref).has(oid);
      const n = (singleCalls.get(ref) || 0) + 1;
      singleCalls.set(ref, n);
      if (n > ANCESTRY_BATCH_AFTER) {
        const r = gitRun(folder, ['rev-list', ref]);
        if (!r.error && r.status === 0) {
          const set = new Set(r.stdout.split('\n').filter(Boolean));
          ancestors.set(ref, set);
          return set.has(oid);
        }
      }
      return gitRun(folder, ['merge-base', '--is-ancestor', oid, ref]).status === 0;
    },
    isShallow: () => gitRun(folder, ['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true',
    branchExists: (name) =>
      gitRun(folder, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).status === 0 ||
      gitRun(folder, ['rev-parse', '--verify', '--quiet', `refs/remotes/${name}`]).status === 0,
  };
}

// ---------- checks ----------

export function checkRoadmap(r, git, opts = {}) {
  const problems = [];
  const add = (severity, code, file, message) => problems.push({ severity, code, file, message });
  const cfg = r.config;
  for (const f of r.invalidUtf8 || []) add('warning', 'invalid-utf8', f, 'file is not valid UTF-8; invalid bytes were replaced while reading');

  if (cfg.formatVersion > FORMAT_VERSION) {
    add('error', 'format-version', 'roadmap.config.json',
      `formatVersion ${cfg.formatVersion} is newer than this checker understands (${FORMAT_VERSION}); refresh the checker`);
    return problems;
  }

  const v = cfg.vocab;
  const strategyName = cfg.strategy;
  const fileName = (role) => r.paths[role] || role;

  // ---- block access with structural diagnostics ----
  // Well-formed blocks of a name; every opener missing its `-->` is reported as malformed-anchor.
  function blocksOf(text, name, file) {
    const all = readBlocks(text, name);
    for (const b of all) {
      if (b.malformed) add('error', 'malformed-anchor', file, `opener of block roadmap:${name} has no closing --> before the next comment`);
    }
    return all.filter((b) => !b.malformed);
  }

  function firstBlock(text, name, file, required = true) {
    if (text === null || text === undefined) return null;
    const blocks = blocksOf(text, name, file);
    if (blocks.length === 0) {
      if (required && !readBlocks(text, name).some((b) => b.malformed)) add('error', 'missing-block', file, `missing block roadmap:${name}`);
      return null;
    }
    if (!blocks[0].closed) add('error', 'unclosed-block', file, `block roadmap:${name} has no closing comment`);
    return blocks[0];
  }

  function tableRows(text, name, file, cols, required = true) {
    const b = firstBlock(text, name, file, required);
    if (!b) return [];
    const rows = [];
    parseTable(b.body).forEach((row, i) => {
      if (row.length !== cols) add('error', 'bad-row', file, `roadmap:${name} row ${i + 1} has ${row.length} columns, expected exactly ${cols} (escape a literal | as \\|)`);
      else rows.push(row);
    });
    return rows;
  }

  function listItems(text, name, file, required = true) {
    const b = firstBlock(text, name, file, required);
    return b ? parseList(b.body) : [];
  }

  // ---- strategy: version and cards ----
  if (blocksOf(r.strategy, 'version', strategyName).length === 0 && !readBlocks(r.strategy, 'version').some((b) => b.malformed)) {
    add('error', 'missing-block', strategyName, 'missing roadmap:version anchor');
  }

  const cards = [];
  for (const b of blocksOf(r.strategy, 'card', strategyName)) {
    if (!b.closed) add('error', 'unclosed-block', strategyName, `card ${b.attrs.id || '?'} has no closing comment`);
    const list = (s) => (s || '').split(/[,\s]+/).filter((x) => x && x !== '-' && x !== '—');
    const acc = blocksOf(b.body, 'acceptance', strategyName)[0];
    const risks = blocksOf(b.body, 'risks', strategyName)[0];
    cards.push({
      id: b.attrs.id || '',
      attrs: b.attrs,
      depends: list(b.attrs.depends),
      reqs: list(b.attrs.reqs),
      critical: String(b.attrs.critical).toLowerCase() === 'true',
      acceptance: acc ? parseList(acc.body) : [],
      risks: risks ? parseList(risks.body) : [],
    });
  }
  if (cards.length === 0) add('error', 'missing-block', strategyName, 'no roadmap:card blocks found');

  // ---- tables ----
  const panel = tableRows(r.files.state, 'panel', fileName('state'), 4);
  const blockers = tableRows(r.files.state, 'blockers', fileName('state'), 5);
  const inflight = tableRows(r.files.state, 'inflight', fileName('state'), 3);
  const donotItems = listItems(r.files.state, 'donot', fileName('state'), false);
  const releaseBlock = r.files.state ? readBlocks(r.files.state, 'releases').some((b) => !b.malformed) : false;
  const releases = tableRows(r.files.state, 'releases', fileName('state'), 6, false);
  const nowItems = listItems(r.files.state, 'now', fileName('state'));
  const pendingItems = listItems(r.files.state, 'pending', fileName('state'));
  const decisions = tableRows(r.files.decisions, 'decisions', fileName('decisions'), 9);
  const logRows = tableRows(r.files.log, 'log', fileName('log'), 4);
  const sources = tableRows(r.files.sources, 'sources', fileName('sources'), 5);
  const conflicts = listItems(r.files.sources, 'conflicts', fileName('sources'));
  const reqs = tableRows(r.files.requirements, 'requirements', fileName('requirements'), 6);
  const measurements = r.files.measurements === null ? [] : tableRows(r.files.measurements, 'measurements', fileName('measurements'), 7);

  // ---- ids: duplicates and unknown ----
  const defs = {
    E: cards.map((c) => c.id),
    REQ: reqs.map((x) => x[0]),
    SRC: sources.map((x) => x[0]),
    DEC: decisions.map((x) => x[0]),
    BLQ: blockers.map((x) => x[0]),
  };
  const defined = new Set(Object.values(defs).flat());
  for (const [kind, ids] of Object.entries(defs)) {
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) add('error', 'duplicate-id', kind === 'E' ? strategyName : fileName(kindFile(kind)), `duplicate id ${id}`);
      seen.add(id);
    }
  }
  function kindFile(kind) {
    return { REQ: 'requirements', SRC: 'sources', DEC: 'decisions', BLQ: 'state' }[kind];
  }
  const scanned = [[strategyName, r.strategy, 'strategy']];
  for (const role of ROLE_KEYS) if (r.files[role] !== null && r.files[role] !== undefined) scanned.push([fileName(role), r.files[role], role]);
  for (const [file, text, role] of scanned) {
    if (scanFences(text, false).unclosed) add('warning', 'unclosed-fence', file, 'a fenced code block is never closed; everything after it is ignored by the checker');
    for (const id of idsIn(scanFences(text, true).text, ID_RE)) {
      // log.md is append-only: it may cite retired blockers and dropped deliverables
      if (role === 'log' && (id.startsWith('BLQ-') || /^E\d+$/.test(id))) continue;
      if (!defined.has(id)) add('error', 'unknown-id', file, `${id} is cited but not defined`);
    }
  }

  // ---- cards ----
  const cardIds = new Set(cards.map((c) => c.id));
  const panelIds = new Set(panel.map((row) => (row[0].match(/\bE\d+\b/) || [])[0]).filter(Boolean));
  for (const c of cards) {
    if (c.reqs.length === 0) add('error', 'card-no-req', strategyName, `${c.id} cites no REQ`);
    if (c.acceptance.length < 2) add('error', 'card-acceptance', strategyName, `${c.id} has ${c.acceptance.length} acceptance criteria, needs at least 2`);
    if (!panelIds.has(c.id)) add('error', 'card-no-panel-row', fileName('state'), `${c.id} has no row in the panel`);
    if (!cfg.tracks.includes(c.attrs.track)) add('error', 'unknown-track', strategyName, `${c.id} track "${c.attrs.track}" is not in tracks`);
    if (!PRIORITIES.includes(c.attrs.priority)) add('error', 'bad-priority', strategyName, `${c.id} priority "${c.attrs.priority}" is not one of ${PRIORITIES.join(', ')}`);
    if (c.critical && c.risks.length === 0) add('warning', 'critical-no-risk', strategyName, `${c.id} is on the critical path and has no risk listed`);
  }

  // dependency cycle (DFS, one report)
  {
    const deps = new Map(cards.map((c) => [c.id, c.depends.filter((d) => cardIds.has(d))]));
    const state = new Map();
    const stack = [];
    let cycle = null;
    const visit = (id) => {
      if (cycle) return;
      state.set(id, 1);
      stack.push(id);
      for (const d of deps.get(id) || []) {
        if (cycle) break;
        if (state.get(d) === 1) cycle = [...stack.slice(stack.indexOf(d)), d];
        else if (!state.has(d)) visit(d);
      }
      stack.pop();
      state.set(id, 2);
    };
    for (const id of deps.keys()) if (!state.has(id) && !cycle) visit(id);
    if (cycle) add('error', 'dependency-cycle', strategyName, `dependency cycle: ${cycle.join(' -> ')}`);
  }

  // ---- state ----
  if (nowItems.length > cfg.limits.nowItems) add('error', 'now-limit', fileName('state'), `Now has ${nowItems.length} items, limit ${cfg.limits.nowItems}`);
  const limitCell = (file, label, text) => {
    if (text.length > cfg.limits.cellChars) add('error', 'cell-limit', file, `${label} has ${text.length} characters, limit ${cfg.limits.cellChars}`);
  };
  panel.forEach((row, i) => row.forEach((c) => limitCell(fileName('state'), `panel row ${i + 1}`, c)));
  blockers.forEach((row, i) => row.forEach((c) => limitCell(fileName('state'), `blockers row ${i + 1}`, c)));
  inflight.forEach((row, i) => row.forEach((c) => limitCell(fileName('state'), `inflight row ${i + 1}`, c)));
  releases.forEach((row, i) => row.forEach((c) => limitCell(fileName('state'), `releases row ${i + 1}`, c)));
  [...nowItems, ...pendingItems, ...donotItems].forEach((t) => limitCell(fileName('state'), 'list item', t));

  donotItems.forEach((t) => {
    if (!/\b(?:BLQ-\d+|DEC-\d+)\b/.test(t)) add('error', 'donot-no-ref', fileName('state'), `"Do not do now" item cites no BLQ-n or DEC-NNN: ${t.slice(0, 60)}`);
  });

  for (const row of inflight) {
    if (row[1] !== v.branchLive && row[1] !== v.branchDeleted) {
      add('error', 'bad-kind', fileName('state'), `in-flight branch ${row[0].replace(/`/g, '').trim()} has Kind "${row[1]}", expected "${v.branchLive}" or "${v.branchDeleted}"`);
    }
  }

  // releases: when the block exists, every released deliverable must be in some package
  if (releaseBlock) {
    const released = v.releasedStatuses || ['released', 'measured'];
    const packaged = new Set();
    releases.forEach((row) => idsIn(row[1], /\bE\d+\b/g).forEach((e) => packaged.add(e)));
    for (const row of panel) {
      const id = (row[0].match(/\bE\d+\b/) || [])[0];
      if (id && parseStatus(row[1]).some((s) => released.includes(s)) && !packaged.has(id)) {
        add('error', 'released-no-package', fileName('state'), `${id} has a released status but no package in the releases block lists it`);
      }
    }
  }

  for (const row of panel) {
    const id = (row[0].match(/\bE\d+\b/) || [])[0];
    if (!id) add('error', 'panel-unknown-deliverable', fileName('state'), `panel row "${row[0]}" names no deliverable (E<n>)`);
    else if (!cardIds.has(id)) add('error', 'panel-unknown-deliverable', fileName('state'), `panel row names ${id}, which has no card`);
    const statuses = parseStatus(row[1]);
    if (statuses.length === 0) add('error', 'bad-status', fileName('state'), `${id || row[0]} has an empty status`);
    if (statuses.some((s) => v.integratedStatuses.includes(s)) && shasIn(row[2]).length === 0) {
      add('error', 'integrated-no-sha', fileName('state'), `${id || row[0]} has an integrated status but no commit SHA in Evidence`);
    }
    for (const s of statuses) {
      if (!v.deliverableStatuses.includes(s)) add('error', 'bad-status', fileName('state'), `${id || row[0]} status "${s}" is not in deliverableStatuses`);
    }
  }

  // ---- decisions ----
  for (const row of decisions) {
    const [id, , , , , contradicts, , , status] = row;
    if (status === v.decisionInForce) {
      if (!isEmptyCell(contradicts) && !new RegExp(`(?<![A-Za-z0-9-])${escapeRe(id)}(?![A-Za-z0-9])`).test(r.strategy)) {
        add('warning', 'contradiction-unabsorbed', fileName('decisions'), `${id} contradicts the roadmap (${contradicts}) and the strategy does not cite it; propose a revision`);
      }
    } else if (status === v.decisionPending) {
      // pending: nothing to check
    } else if (status.startsWith(v.decisionSupersededBy)) {
      const target = (status.match(/DEC-\d+/) || [])[0];
      if (!target || !defs.DEC.includes(target)) add('error', 'superseded-link', fileName('decisions'), `${id} is superseded by "${target || status}", which does not exist`);
    } else {
      add('error', 'bad-status', fileName('decisions'), `${id} status "${status}" is not in-force, pending or superseded`);
    }
  }

  // ---- log ----
  let prevDate = null;
  logRows.forEach((row, i) => {
    const [date, , what, evidence] = row;
    const d = (date.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
    if (!d) add('error', 'log-order', fileName('log'), `log row ${i + 1} has no ISO date`);
    else {
      if (prevDate !== null && d > prevDate) add('error', 'log-order', fileName('log'), `log row ${i + 1} (${d}) is newer than the row above (${prevDate}); newest first`);
      prevDate = d;
    }
    limitCell(fileName('log'), `log row ${i + 1}`, what);
    limitCell(fileName('log'), `log row ${i + 1}`, evidence);
    for (const phrase of v.bannedPhrases) {
      if ((what + ' ' + evidence).toLowerCase().includes(phrase.toLowerCase())) add('error', 'banned-phrase', fileName('log'), `log row ${i + 1} contains "${phrase}"`);
    }
    if (isEmptyCell(evidence)) add('error', 'missing-evidence', fileName('log'), `log row ${i + 1} has no evidence`);
  });

  // ---- requirements ----
  const cardById = new Map(cards.map((c) => [c.id, c]));
  for (const row of reqs) {
    const [id, , , , delivs, coverage] = row;
    const dIds = idsIn(delivs, /\bE\d+\b/g);
    if (coverage === v.coverageCovered) {
      if (dIds.length === 0) add('error', 'uncovered-req', fileName('requirements'), `${id} is "covered" but names no deliverable`);
    } else if (coverage.startsWith(v.coverageOutOfScope)) {
      const reason = coverage.slice(v.coverageOutOfScope.length).replace(/^\s*:\s*/, '').trim();
      if (!reason) add('error', 'uncovered-req', fileName('requirements'), `${id} is out of scope without a reason`);
    } else if (coverage === v.coverageNeedsClarification) {
      add('warning', 'needs-clarification', fileName('requirements'), `${id} needs clarification`);
    } else {
      add('error', 'uncovered-req', fileName('requirements'), `${id} has unknown coverage "${coverage}"`);
    }
    for (const e of dIds) {
      const c = cardById.get(e);
      if (c && !c.reqs.includes(id)) add('warning', 'req-card-asymmetry', fileName('requirements'), `${id} lists ${e}, but the ${e} card does not cite ${id}`);
    }
  }
  for (const c of cards) {
    for (const q of c.reqs) {
      const row = reqs.find((x) => x[0] === q);
      if (row && !idsIn(row[4], /\bE\d+\b/g).includes(c.id)) add('warning', 'req-card-asymmetry', strategyName, `${c.id} cites ${q}, but ${q} does not list ${c.id}`);
    }
  }

  // ---- markers ----
  {
    let count = 0;
    for (const m of v.markers) count += (r.strategy.match(new RegExp(`\\b${escapeRe(m)}\\b`, 'g')) || []).length;
    if (count > 0) add('warning', 'markers', strategyName, `${count} ASSUMPTION/UNSOURCED marker(s) in the strategy`);
  }

  // unused-parse guards (keep parsed tables referenced for future checks)
  void conflicts;
  void measurements;

  // ---- git ----
  const gitSeverity = opts.requireGit ? 'error' : 'warning';
  if (git && git.unavailable) {
    add(gitSeverity, 'git-unavailable', 'roadmap.config.json', `git could not be used (${git.reason || 'unknown reason'}); git checks skipped`);
    return problems;
  }
  if (git === null || git === undefined) {
    add(gitSeverity, 'no-git', 'roadmap.config.json', 'not inside a git repository; git checks skipped');
    return problems;
  }

  const shallow = typeof git.isShallow === 'function' && git.isShallow();
  if (shallow) add('warning', 'shallow-clone', 'roadmap.config.json', 'shallow clone: commit existence and ancestry checks skipped; fetch full history');
  const shaSeen = new Set();
  const checkShas = (file, cell, severity) => {
    for (const sha of shasIn(cell)) {
      if (shaSeen.has(`${file}:${sha}`)) continue;
      shaSeen.add(`${file}:${sha}`);
      if (!git.commitExists(sha)) add(severity, 'sha-missing', file, `commit ${sha} does not exist in this repository`);
    }
  };
  if (!shallow) {
    // one batched git process resolves every SHA; the per-SHA checks below then hit its cache
    if (typeof git.prefetch === 'function') {
      git.prefetch([...panel.map((row) => row[2]), ...releases.map((row) => row[3]), ...logRows.map((row) => row[3])].flatMap((cell) => shasIn(cell)));
    }
    panel.forEach((row) => checkShas(fileName('state'), row[2], 'error'));
    releases.forEach((row) => checkShas(fileName('state'), row[3], 'error'));
    logRows.forEach((row) => checkShas(fileName('log'), row[3], 'warning'));
  }

  const integratedRows = panel.filter((row) => parseStatus(row[1]).some((s) => v.integratedStatuses.includes(s)) && shasIn(row[2]).length > 0);
  if (!shallow && integratedRows.length > 0) {
    const local = cfg.integrationBranch;
    const remote = `origin/${cfg.integrationBranch}`;
    const refs = [local, remote].filter((b) => git.branchExists(b));
    if (refs.length === 0) {
      add('warning', 'integration-branch-missing', 'roadmap.config.json', `neither ${local} nor ${remote} exists; integration checks skipped`);
    } else {
      for (const row of integratedRows) {
        // at least one existing SHA must be on the integration branch (local or origin); siblings only need to exist
        const existing = shasIn(row[2]).filter((sha) => git.commitExists(sha));
        if (existing.length > 0 && !existing.some((sha) => refs.some((ref) => git.isAncestor(sha, ref)))) {
          const id = (row[0].match(/\bE\d+\b/) || [row[0]])[0];
          add('error', 'not-integrated', fileName('state'), `${id} is marked integrated, but none of ${existing.join(', ')} is an ancestor of ${refs.join(' or ')}`);
        }
      }
    }
  }

  for (const row of inflight) {
    const name = row[0].replace(/`/g, '').trim();
    const exists = git.branchExists(name) || git.branchExists(`origin/${name}`);
    if (row[1] === v.branchLive && !exists) add('error', 'branch-live-missing', fileName('state'), `in-flight branch ${name} does not exist`);
    if (row[1] === v.branchDeleted && exists) add('error', 'branch-deleted-exists', fileName('state'), `branch ${name} is marked deleted but still exists`);
  }

  return problems;
}

// ---------- versions and staleness ----------

export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

function readHeader(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(200);
    const n = fs.readSync(fd, buf, 0, 200, 0);
    fs.closeSync(fd);
    const m = /^\/\/ check-roadmap (\d+\.\d+\.\d+) format (\d+)\s*$/.exec(buf.toString('utf8', 0, n).split(/\r?\n/)[0]);
    return m ? { version: m[1], format: Number(m[2]) } : null;
  } catch {
    return null;
  }
}

export function findNewerPluginCopy(selfPath, selfVersion, cacheRoot) {
  const self = path.resolve(selfPath);
  let best = null;
  const dirs = (p) => {
    try {
      return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      return [];
    }
  };
  for (const market of dirs(cacheRoot)) {
    const pluginDir = path.join(cacheRoot, market, 'productivity-tools');
    for (const ver of dirs(pluginDir)) {
      const file = path.join(pluginDir, ver, 'skills', 'roadmap-tracker', 'scripts', 'check-roadmap.mjs');
      if (path.resolve(file) === self) continue;
      const version = (readHeader(file) || {}).version;
      if (version && compareVersions(version, selfVersion) > 0 && (!best || compareVersions(version, best.version) > 0)) best = { path: file, version };
    }
  }
  return best;
}

// ---------- CLI ----------

function main(argv) {
  const args = argv.slice(2);
  const selfPath = fileURLToPath(import.meta.url);
  // Line 1 of this very file is the single source of the version at runtime.
  const self = readHeader(selfPath);
  if (!self) {
    console.log(`ERROR ${path.basename(selfPath)}: line 1 must be "// check-roadmap <version> format <n>" [bad-header]`);
    return 1;
  }
  if (args.includes('--version')) {
    console.log(`${self.version} format ${self.format}`);
    return 0;
  }
  const requireGit = args.includes('--require-git');
  const folder = path.resolve(args.find((a) => !a.startsWith('--')) || path.dirname(selfPath));
  let problems;
  try {
    if (process.env.ROADMAP_CHECK_SELFTEST_THROW) throw new Error('self-test: forced internal failure');
    problems = checkRoadmap(loadRoadmap(folder), createGitAdapter(folder), { requireGit });
  } catch (e) {
    const message = String((e && e.message) || e);
    if (message.startsWith('config:')) {
      console.log(`ERROR ${message}`);
      console.log('check-roadmap: 1 error(s), 0 warning(s)');
      return 1;
    }
    console.log(`ERROR internal: ${message.split('\n')[0]}`);
    return 2;
  }
  try {
    const cacheRoot = process.env.ROADMAP_CHECK_PLUGIN_CACHE || path.join(os.homedir(), '.claude', 'plugins', 'cache');
    const newer = findNewerPluginCopy(selfPath, self.version, cacheRoot);
    if (newer) {
      problems.push({
        severity: 'warning', code: 'checker-stale', file: path.basename(selfPath),
        message: `newer checker ${newer.version} available at ${newer.path}; ask roadmap-tracker to refresh`,
      });
    }
  } catch {
    // staleness is best-effort
  }
  for (const p of problems) console.log(`${p.severity === 'error' ? 'ERROR' : 'WARN'} ${p.file}: ${p.message} [${p.code}]`);
  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.length - errors;
  console.log(`check-roadmap: ${errors} error(s), ${warnings} warning(s)`);
  return errors > 0 ? 1 : 0;
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync.native(process.argv[1]) === fs.realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  try {
    process.exitCode = main(process.argv);
  } catch (e) {
    console.log(`ERROR internal: ${String((e && e.message) || e).split('\n')[0]}`);
    process.exitCode = 2;
  }
}
