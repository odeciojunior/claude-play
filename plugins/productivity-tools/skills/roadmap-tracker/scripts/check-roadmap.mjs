// check-roadmap 1.2.0 format 1
// Deterministic checker for roadmap folders (format contract: roadmap-planner/references/formats.md).
// Single file, Node >= 18, no dependencies, no network. Vendored into each roadmap folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const FORMAT_VERSION = 1;
export const CHECKER_VERSION = '1.2.0';

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
  const attrs = {};
  let rest = s || '';
  rest = rest.replace(/([^\s=]+)=(?:"([^"]*)"|(\S+))/g, (_m, k, q, v) => {
    attrs[k] = q !== undefined ? q : v;
    return ' ';
  });
  rest.split(/\s+/).filter(Boolean).forEach((tok, i) => {
    attrs[`_${i}`] = tok;
  });
  return attrs;
}

export function readBlocks(text, name) {
  text = norm(text);
  const open = new RegExp(`<!--\\s*roadmap:${escapeRe(name)}(\\s[^]*?)?\\s*-->`, 'g');
  const close = new RegExp(`<!--\\s*/roadmap:${escapeRe(name)}\\s*-->`, 'g');
  const out = [];
  let m;
  while ((m = open.exec(text)) !== null) {
    const bodyStart = m.index + m[0].length;
    close.lastIndex = bodyStart;
    const c = close.exec(text);
    const block = { attrs: parseAttrs(m[1]), body: c ? text.slice(bodyStart, c.index) : '' };
    Object.defineProperty(block, 'closed', { value: Boolean(c), enumerable: false });
    out.push(block);
    if (c) open.lastIndex = c.index + c[0].length;
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

function stripFences(text) {
  return text.replace(/^(```|~~~)[ \t]*([^\n]*)\n[^]*?^\1[ \t]*$/gm, (m, _f, info) => (/^mermaid\b/i.test(info.trim()) ? m : ''));
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

function validateConfig(c) {
  const fail = (msg) => {
    throw new Error(`config: ${msg}`);
  };
  if (!c || typeof c !== 'object' || Array.isArray(c)) fail('roadmap.config.json must be a JSON object');
  if (!Number.isInteger(c.formatVersion)) fail('formatVersion must be an integer');
  if (c.formatVersion > FORMAT_VERSION) return;
  for (const k of ['language', 'strategy', 'integrationBranch']) {
    if (typeof c[k] !== 'string' || !c[k]) fail(`${k} must be a non-empty string`);
  }
  if (!c.files || typeof c.files !== 'object') fail('files must be an object');
  for (const k of ROLE_KEYS) {
    if (!(k in c.files)) fail(`files.${k} is required`);
    const v = c.files[k];
    if (v === null && k === 'measurements') continue;
    if (typeof v !== 'string' || !v) fail(`files.${k} must be a file name${k === 'measurements' ? ' or null' : ''}`);
  }
  if (!c.vocab || typeof c.vocab !== 'object') fail('vocab must be an object');
  for (const k of VOCAB_STRINGS) if (typeof c.vocab[k] !== 'string' || !c.vocab[k]) fail(`vocab.${k} must be a non-empty string`);
  for (const k of VOCAB_ARRAYS) if (!Array.isArray(c.vocab[k])) fail(`vocab.${k} must be an array`);
  if (!Array.isArray(c.tracks) || c.tracks.length === 0) fail('tracks must be a non-empty array');
  if (!c.limits || !(c.limits.nowItems > 0) || !(c.limits.cellChars > 0)) fail('limits.nowItems and limits.cellChars must be positive numbers');
}

function readText(file, what) {
  try {
    return norm(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`config: cannot read ${what} (${file}): ${e.code || e.message}`);
  }
}

export function loadRoadmap(folder) {
  const cfgFile = path.join(folder, 'roadmap.config.json');
  const raw = readText(cfgFile, 'roadmap.config.json');
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    throw new Error(`config: invalid JSON in roadmap.config.json: ${e.message}`);
  }
  validateConfig(config);
  const roadmap = { folder, config, strategyPath: '', strategy: '', files: {}, paths: {} };
  if (config.formatVersion > FORMAT_VERSION) return roadmap;
  roadmap.strategyPath = path.resolve(folder, config.strategy);
  roadmap.strategy = readText(roadmap.strategyPath, 'strategy');
  for (const role of ROLE_KEYS) {
    const name = config.files[role];
    roadmap.paths[role] = name;
    roadmap.files[role] = name === null ? null : readText(path.resolve(folder, name), `files.${role}`);
  }
  return roadmap;
}

// ---------- git adapter ----------

function gitRun(folder, args) {
  return spawnSync('git', ['-C', folder, ...args], { encoding: 'utf8' });
}

export function createGitAdapter(folder) {
  const probe = gitRun(folder, ['rev-parse', '--is-inside-work-tree']);
  if (probe.error || probe.status !== 0 || probe.stdout.trim() !== 'true') return null;
  return {
    commitExists: (sha) => gitRun(folder, ['cat-file', '-e', `${sha}^{commit}`]).status === 0,
    isAncestor: (sha, ref) => gitRun(folder, ['merge-base', '--is-ancestor', sha, ref]).status === 0,
    isShallow: () => gitRun(folder, ['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true',
    branchExists: (name) =>
      gitRun(folder, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).status === 0 ||
      gitRun(folder, ['rev-parse', '--verify', '--quiet', `refs/remotes/${name}`]).status === 0,
  };
}

// ---------- checks ----------

export function checkRoadmap(r, git) {
  const problems = [];
  const add = (severity, code, file, message) => problems.push({ severity, code, file, message });
  const cfg = r.config;

  if (cfg.formatVersion > FORMAT_VERSION) {
    add('error', 'format-version', 'roadmap.config.json',
      `formatVersion ${cfg.formatVersion} is newer than this checker understands (${FORMAT_VERSION}); refresh the checker`);
    return problems;
  }

  const v = cfg.vocab;
  const strategyName = cfg.strategy;
  const fileName = (role) => r.paths[role] || role;

  // ---- block access with structural diagnostics ----
  function firstBlock(text, name, file, required = true) {
    if (text === null || text === undefined) return null;
    const blocks = readBlocks(text, name);
    if (blocks.length === 0) {
      if (required) add('error', 'missing-block', file, `missing block roadmap:${name}`);
      return null;
    }
    if (!blocks[0].closed) add('error', 'unclosed-block', file, `block roadmap:${name} has no closing comment`);
    return blocks[0];
  }

  function tableRows(text, name, file, cols) {
    const b = firstBlock(text, name, file);
    if (!b) return [];
    const rows = [];
    parseTable(b.body).forEach((row, i) => {
      if (row.length !== cols) add('error', 'bad-row', file, `roadmap:${name} row ${i + 1} has ${row.length} columns, expected exactly ${cols} (escape a literal | as \\|)`);
      else rows.push(row);
    });
    return rows;
  }

  function listItems(text, name, file) {
    const b = firstBlock(text, name, file);
    return b ? parseList(b.body) : [];
  }

  // ---- strategy: version and cards ----
  if (readBlocks(r.strategy, 'version').length === 0) add('error', 'missing-block', strategyName, 'missing roadmap:version anchor');

  const cards = [];
  for (const b of readBlocks(r.strategy, 'card')) {
    if (!b.closed) add('error', 'unclosed-block', strategyName, `card ${b.attrs.id || '?'} has no closing comment`);
    const list = (s) => (s || '').split(/[,\s]+/).filter((x) => x && x !== '-' && x !== '—');
    const acc = readBlocks(b.body, 'acceptance')[0];
    const risks = readBlocks(b.body, 'risks')[0];
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
    for (const id of idsIn(stripFences(text), ID_RE)) {
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
  [...nowItems, ...pendingItems].forEach((t) => limitCell(fileName('state'), 'list item', t));

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
      if (!isEmptyCell(contradicts) && !r.strategy.includes(id)) {
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
  if (git === null || git === undefined) {
    add('warning', 'no-git', 'roadmap.config.json', 'not inside a git repository (or git is unavailable); git checks skipped');
    return problems;
  }

  const shallow = typeof git.isShallow === 'function' && git.isShallow();
  if (shallow) add('warning', 'shallow-clone', 'roadmap.config.json', 'shallow clone: commit existence and ancestry checks skipped; fetch full history');
  const shaSeen = new Set();
  const checkShas = (file, cell) => {
    for (const sha of shasIn(cell)) {
      if (shaSeen.has(`${file}:${sha}`)) continue;
      shaSeen.add(`${file}:${sha}`);
      if (!git.commitExists(sha)) add('error', 'sha-missing', file, `commit ${sha} does not exist in this repository`);
    }
  };
  if (!shallow) {
    panel.forEach((row) => checkShas(fileName('state'), row[2]));
    logRows.forEach((row) => checkShas(fileName('log'), row[3]));
  }

  const integratedRows = panel.filter((row) => parseStatus(row[1]).some((s) => v.integratedStatuses.includes(s)) && shasIn(row[2]).length > 0);
  if (!shallow && integratedRows.length > 0) {
    const local = cfg.integrationBranch;
    const remote = `origin/${cfg.integrationBranch}`;
    const ref = git.branchExists(local) ? local : git.branchExists(remote) ? remote : null;
    if (ref === null) {
      add('warning', 'integration-branch-missing', 'roadmap.config.json', `neither ${local} nor ${remote} exists; integration checks skipped`);
    } else {
      for (const row of integratedRows) {
        const bad = shasIn(row[2]).filter((sha) => git.commitExists(sha) && !git.isAncestor(sha, ref));
        if (bad.length > 0) {
          const id = (row[0].match(/\bE\d+\b/) || [row[0]])[0];
          add('error', 'not-integrated', fileName('state'), `${id} is marked integrated, but ${bad.join(', ')} is not an ancestor of ${ref}`);
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

function headerVersion(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(200);
    const n = fs.readSync(fd, buf, 0, 200, 0);
    fs.closeSync(fd);
    const m = /^\/\/ check-roadmap (\d+\.\d+\.\d+) format (\d+)/.exec(buf.toString('utf8', 0, n));
    return m ? m[1] : null;
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
      const version = headerVersion(file);
      if (version && compareVersions(version, selfVersion) > 0 && (!best || compareVersions(version, best.version) > 0)) best = { path: file, version };
    }
  }
  return best;
}

// ---------- CLI ----------

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--version')) {
    console.log(`${CHECKER_VERSION} format ${FORMAT_VERSION}`);
    return 0;
  }
  const selfPath = fileURLToPath(import.meta.url);
  const folder = path.resolve(args.find((a) => !a.startsWith('--')) || path.dirname(selfPath));
  let problems;
  try {
    problems = checkRoadmap(loadRoadmap(folder), createGitAdapter(folder));
  } catch (e) {
    if (!String(e.message).startsWith('config:')) throw e;
    problems = [{ severity: 'error', code: 'config', file: 'roadmap.config.json', message: e.message }];
    console.log(`ERROR ${e.message}`);
    console.log('check-roadmap: 1 error(s), 0 warning(s)');
    return 1;
  }
  try {
    const cacheRoot = process.env.ROADMAP_CHECK_PLUGIN_CACHE || path.join(os.homedir(), '.claude', 'plugins', 'cache');
    const newer = findNewerPluginCopy(selfPath, CHECKER_VERSION, cacheRoot);
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
  process.exitCode = main(process.argv);
}
