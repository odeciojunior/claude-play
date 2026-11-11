// roadmap CLI: deterministic events for the roadmap tracker (E3).
// Usage: node roadmap.mjs <command> <folder> [arguments] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRoadmapTexts, parseStatusSegments, decisionScope, norm, idsIn, shasIn, blockLines, splitRow, stripNote,
} from '../../../lib/roadmap-format.mjs';
import { applyEdits, serializeRow } from '../../../lib/roadmap-edit.mjs';
import {
  loadRoadmap, createGitAdapter, checkRoadmap, compareVersions, FORMAT_VERSION, CHECKER_VERSION,
} from './check-roadmap.mjs';

export class Refusal extends Error {
  constructor(code, message, exitCode = 1) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}

const usage = (message) => new Refusal('usage', message, 2);

export const COMMAND_NAMES = [
  'status', 'brief', 'next-id', 'pending-decisions', 'verify-commit',
  'log', 'set-status', 'integrate', 'block-open', 'block-close', 'prune', 'refresh-checker',
  'add-decision', 'add-pending', 'inflight-add', 'inflight-remove', 'ratify', 'reject',
];

// Options that take a value; `true` marks the ones that may repeat.
const VALUE_OPTIONS = {
  date: false, what: false, evidence: true, next: true, deliverable: false, sha: false, only: false,
  affects: false, unblocks: false, piece: false, since: false, how: false, note: false, owner: false,
  text: false, decision: false, scope: false, discarded: false, revisit: false, contradicts: false,
};
const FLAGS = ['json', 'help'];

const HELP = `roadmap: deterministic events for the roadmap tracker

Usage: node roadmap.mjs <command> <folder> [arguments] [--json]

Read commands (write nothing):
  status                      strategy version, state header, panel, blockers, now, pending, in flight
  brief                       cold-start summary of the folder
  next-id <DEC|BLQ|REQ|SRC|E> next unused identifier of that kind
  pending-decisions           executor decisions still pending, with scope and dependents
  verify-commit <sha>         whether the commit exists and is on the integration branch

Write commands:
  log --deliverable <E<n>|-> --what <text> --evidence <ref> [--date]
  set-status <E<n>> <word> [--piece <label>] [--evidence <ref>]... [--next <text>] [--note <text>]
  integrate --sha <sha> [--only E<a>,E<b>] [--date]
  block-open --what <text> --affects E<a>[,E<b>] --unblocks <condition> [--piece <label>] [--since] [--evidence <ref>]
  block-close <BLQ-n> --how <text> [--evidence <ref>] [--next E<n>=<text>]...
  prune
  refresh-checker [--date]
  add-decision --deliverable <E<n>|-> --decision <text> --scope <local|contrato> [--discarded <t>] [--revisit <t>] [--contradicts <t>] [--date]
  add-pending --owner <owner> --text <text>
  inflight-add <branch> [--note <text>]
  inflight-remove <branch>
  ratify <DEC-NNN> [--date] [--what]
  reject <DEC-NNN> --decision <text> [--discarded <t>] [--revisit <t>] [--date] [--what]

Flags: --json (machine output, same exit code), --help.
Exit codes: 0 done or no-op; 1 refused by rule, nothing changed; 2 usage, read or write failure.
Commands: ${COMMAND_NAMES.join(', ')}`;

// ---------- arguments ----------

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (FLAGS.includes(name)) {
        flags[name] = true;
      } else if (Object.prototype.hasOwnProperty.call(VALUE_OPTIONS, name)) {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith('--')) throw usage(`option --${name} needs a value`);
        i++;
        if (VALUE_OPTIONS[name]) (opts[name] = opts[name] || []).push(value);
        else if (opts[name] !== undefined) throw usage(`option --${name} given more than once`);
        else opts[name] = value;
      } else {
        throw usage(`unknown option ${a}`);
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, opts, flags };
}

function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function localIsoDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- next-id ----------

const ID_KINDS = {
  DEC: { re: /\bDEC-(\d+)\b/g, fmt: (n) => `DEC-${String(n).padStart(3, '0')}` },
  BLQ: { re: /\bBLQ-(\d+)\b/g, fmt: (n) => `BLQ-${n}` },
  REQ: { re: /\bREQ-(\d+)\b/g, fmt: (n) => `REQ-${String(n).padStart(3, '0')}` },
  SRC: { re: /\bSRC-(\d+)\b/g, fmt: (n) => `SRC-${String(n).padStart(2, '0')}` },
  E: { re: /\bE(\d+)\b/g, fmt: (n) => `E${n}` },
};

function* walkFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(p);
    else if (e.isFile()) yield p;
  }
}

export function nextId(folder, strategyPath, kind) {
  const spec = ID_KINDS[kind];
  if (!spec) throw usage(`unknown identifier kind "${kind}" (use ${Object.keys(ID_KINDS).join(', ')})`);
  let max = 0;
  const scan = (file) => {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      return;
    }
    for (const m of text.matchAll(spec.re)) max = Math.max(max, Number(m[1]));
  };
  for (const f of walkFiles(folder)) scan(f);
  if (strategyPath && fs.existsSync(strategyPath)) scan(strategyPath);
  return spec.fmt(max + 1);
}

// ---------- helpers ----------

const idOf = (cell) => (cell.match(/\bE\d+\b/) || [cell])[0];

function integrationRefs(git, cfg) {
  const local = cfg.integrationBranch;
  return [local, `origin/${local}`].filter((b) => git.branchExists(b));
}

function readPanel(roadmap, parsed) {
  const ds = roadmap.config.vocab.deliverableStatuses;
  return parsed.blocks.state.panel.rows.map((row) => ({
    id: idOf(row[0] || ''),
    segments: parseStatusSegments(row[1]).map((s) => ({
      label: s.label, word: s.word, position: ds.indexOf(s.word) + 1, note: s.note,
    })),
    evidence: row[2] || '',
    next: row[3] || '',
  }));
}

function stateHeader(roadmap) {
  const text = roadmap.files.state;
  if (typeof text !== 'string') return null;
  const line = norm(text).split('\n').find((l) => /^(?:Strategy|Estrat[eé]gia)\b/i.test(l.trim()));
  return line ? line.trim() : null;
}

function strategyVersion(parsed) {
  const v = parsed.version;
  return v ? { version: v._0 || null, date: v._1 || null } : null;
}

function nextIds(ctx) {
  const out = {};
  for (const k of Object.keys(ID_KINDS)) out[k] = nextId(ctx.folder, ctx.roadmap.strategyPath, k);
  return out;
}

function pendingDecisions(ctx) {
  const { roadmap, parsed } = ctx;
  const v = roadmap.config.vocab;
  const releasedWords = v.releasedStatuses || ['released', 'measured'];
  const pos = (w) => v.deliverableStatuses.indexOf(w) + 1;
  const statusOf = new Map(readPanel(roadmap, parsed).map((p) => [p.id, p.segments.map((s) => s.word)]));
  const out = [];
  for (const row of parsed.blocks.decisions.decisions.rows) {
    if (row.length !== 9 || row[7] !== 'executor' || row[8] !== v.decisionPending) continue;
    const es = idsIn(row[2], /\bE\d+\b/g);
    const scope = decisionScope(row[3]);
    const dependents = parsed.cards
      .filter((c) => c.depends.some((d) => es.includes(d)))
      .filter((c) => (statusOf.get(c.id) || []).some((w) => pos(w) >= 2 && pos(w) <= 8))
      .map((c) => c.id);
    const released = es.some((e) => (statusOf.get(e) || []).some((w) => releasedWords.includes(w)));
    out.push({
      id: row[0], deliverable: row[2], scope, startedDependents: scope === 'local' ? [] : dependents, released,
    });
  }
  return out;
}

// ---------- write transaction ----------

const WRITE_ORDER = ['decisions', 'state', 'log', 'checkerCopy'];

function roleFile(ctx, role) {
  if (role === 'checkerCopy') return { name: 'check-roadmap.mjs', file: path.join(ctx.folder, 'check-roadmap.mjs') };
  const name = ctx.roadmap.paths[role];
  if (typeof name !== 'string') throw usage(`this roadmap has no ${role} file`);
  return { name, file: path.resolve(ctx.folder, name) };
}

// Raw bytes of a roadmap file, read once per command; the transaction compares against them before writing.
function rawBuffer(ctx, role) {
  if (!ctx.raws.has(role)) {
    const { file } = roleFile(ctx, role);
    let buf;
    try {
      buf = fs.readFileSync(file);
    } catch (e) {
      if (role === 'checkerCopy' && e.code === 'ENOENT') buf = Buffer.alloc(0);
      else throw new Refusal('usage', `cannot read ${file}: ${e.code || e.message}`, 2);
    }
    ctx.raws.set(role, buf);
  }
  return ctx.raws.get(role);
}

const rawText = (ctx, role) => rawBuffer(ctx, role).toString('utf8');

const problemKey = (p) => `${p.code}\u0000${p.file}\u0000${p.message}`;
const problemText = (p) => `${p.code} (${p.file}): ${p.message}`;

// changes: Map<role | 'checkerCopy', new raw text>. Applies the five guarantees of the spec, in order.
function commitWrites(ctx, changes) {
  const { roadmap, git } = ctx;
  if (roadmap.config.formatVersion > FORMAT_VERSION) {
    throw new Refusal('format-newer', `formatVersion ${roadmap.config.formatVersion} is newer than this CLI understands (${FORMAT_VERSION})`, 1);
  }
  const roles = [...WRITE_ORDER.filter((r) => changes.has(r)), ...[...changes.keys()].filter((r) => !WRITE_ORDER.includes(r))];
  const pending = [];
  for (const role of roles) {
    const next = changes.get(role);
    if (next === rawText(ctx, role)) continue; // no-op: not written, not listed
    pending.push({ role, next, ...roleFile(ctx, role) });
  }
  if (pending.length === 0) {
    ctx.changed = [];
    return;
  }
  // (b) the checker, before and after, in memory
  const files = { ...roadmap.files };
  for (const p of pending) if (p.role !== 'checkerCopy') files[p.role] = norm(p.next);
  const opts = { today: ctx.today };
  const before = new Set(checkRoadmap(roadmap, git, opts).map(problemKey));
  const fresh = checkRoadmap({ ...roadmap, files }, git, opts).filter((p) => !before.has(problemKey(p)));
  const freshErrors = fresh.filter((p) => p.severity === 'error');
  for (const p of fresh) if (p.severity !== 'error') ctx.warnings.push({ code: 'checker-warning', message: problemText(p) });
  if (freshErrors.length > 0) throw new Refusal('checker-errors', freshErrors.map(problemText).join('; '), 1);
  // (c) re-read and compare byte by byte
  for (const p of pending) {
    if (ctx.hooks.beforeWrite) ctx.hooks.beforeWrite(p.file);
    let now;
    try {
      now = fs.readFileSync(p.file);
    } catch (e) {
      if (e.code === 'ENOENT' && p.role === 'checkerCopy') now = Buffer.alloc(0);
      else throw new Refusal('concurrent-change', `${p.name} could not be re-read before writing: ${e.code || e.message}`, 1);
    }
    if (!now.equals(rawBuffer(ctx, p.role))) throw new Refusal('concurrent-change', `${p.name} changed while the command ran; nothing was written`, 1);
  }
  // (d) temporary file in the same folder, then rename, in the fixed order
  const written = [];
  for (const p of pending) {
    const tmp = `${p.file}.tmp-${process.pid}`;
    try {
      fs.writeFileSync(tmp, p.next);
      fs.renameSync(tmp, p.file);
      written.push(p.name);
    } catch (e) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch { /* best effort */ }
      ctx.changed = written;
      throw new Refusal('write-failed', `could not write ${p.name} (${e.code || e.message}); already written: ${written.join(', ') || 'none'}`, 2);
    }
  }
  ctx.changed = written;
}

// Applies per-role edit lists to the raw files and commits them in one transaction.
function commitEdits(ctx, editsByRole) {
  const changes = new Map();
  for (const [role, edits] of editsByRole) changes.set(role, applyEdits(rawText(ctx, role), edits));
  commitWrites(ctx, changes);
}

const wrapTick = (v) => (v.includes('`') ? v : `\`${v}\``);

function logRow(ctx, { deliverable, what, evidence, date }) {
  const cfg = ctx.roadmap.config;
  if (!/^(?:E\d+(?:,\s*E\d+)*|-)$/.test(deliverable)) throw usage(`--deliverable must be E<n> or "-", got "${deliverable}"`);
  if (what.length > cfg.limits.cellChars) throw new Refusal('cell-too-long', `--what has ${what.length} characters, limit ${cfg.limits.cellChars}`);
  const lower = what.toLowerCase();
  for (const phrase of cfg.vocab.bannedPhrases || []) {
    if (lower.includes(phrase.toLowerCase())) throw new Refusal('banned-phrase', `--what contains the banned phrase "${phrase}"`);
  }
  const ev = (evidence || []).map((e) => e.trim()).filter(Boolean).map(wrapTick).join(', ');
  if (!ev) throw new Refusal('evidence-missing', 'a log row needs evidence (--evidence <ref>)');
  if (ev.length > cfg.limits.cellChars) throw new Refusal('cell-too-long', `evidence has ${ev.length} characters, limit ${cfg.limits.cellChars}`);
  const text = serializeRow([date, deliverable, what, ev]);
  const logText = rawText(ctx, 'log');
  const bl = blockLines(logText, 'log');
  if (!bl || bl.header === null) throw usage('log.md has no readable log table');
  const lines = logText.split(/\r\n|\r|\n/);
  const dateOf = (i) => ((splitRow(norm(lines[i]))[0] || '').match(/\d{4}-\d{2}-\d{2}/) || [])[0];
  const before = bl.rows.find((i) => (dateOf(i) || '') <= date && dateOf(i));
  if (before !== undefined) return { op: 'insertBefore', line: before, text };
  if (bl.rows.length > 0) return { op: 'insertAfter', line: bl.rows[bl.rows.length - 1], text };
  const isSep = (l) => {
    const r = splitRow(norm(l));
    return r.length > 0 && r.every((c) => /^:?-+:?$/.test(c));
  };
  let sep = bl.header;
  for (let i = bl.header + 1; i < bl.close; i++) if (isSep(lines[i])) { sep = i; break; }
  return { op: 'insertAfter', line: sep, text };
}

// Panel rows with the raw line index of each (state.md), aligned with the parsed rows.
function panelRows(ctx) {
  const bl = blockLines(rawText(ctx, 'state'), 'panel');
  const rows = ctx.parsed.blocks.state.panel.rows;
  if (!bl || bl.rows.length !== rows.length) throw usage('state.md panel block is not readable');
  return rows.map((cells, i) => ({ cells, line: bl.rows[i], id: idOf(cells[0] || '') }));
}

function segText(seg, word, note) {
  const noNote = stripNote(seg.raw);
  const tail = note !== undefined ? (note === '' ? '' : ` (${note})`) : seg.raw.slice(noNote.length);
  return `${seg.label ? `${seg.label}: ` : ''}${word}${tail}`;
}

function mergeEvidence(existing, list) {
  const wrapped = list.map((e) => e.trim()).filter(Boolean).map(wrapTick);
  const e = (existing || '').trim();
  const base = e === '' || e === '-' ? [] : [e];
  for (const w of wrapped) if (!base.join(', ').includes(w)) base.push(w);
  return base.length ? base.join(', ') : (existing || '-');
}

// New cells of a panel row after moving one segment to `word` (positions 1 to 8 of the vocabulary).
function setSegment(ctx, rowCells, { piece, word, evidence, next, note }) {
  const ds = ctx.roadmap.config.vocab.deliverableStatuses;
  const pos = ds.indexOf(word) + 1;
  if (pos < 1 || pos > 8) {
    throw new Refusal('status-not-allowed', `"${word}" is not a status set-status may write (positions 1 to 8: ${ds.slice(0, 8).join(', ')})`);
  }
  const segs = parseStatusSegments(rowCells[1]);
  const blocked = ds[8];
  const discarded = ds[9];
  let target = -1;
  if (piece === undefined) {
    if (segs.length > 1) throw new Refusal('segment-required', 'the row has several segments; name the one to change with --piece');
    target = segs.length === 1 ? 0 : -1;
  } else {
    target = segs.findIndex((s) => s.label === piece);
    if (target < 0 && segs.length === 1 && segs[0].label === '') {
      throw new Refusal('segment-required', `the row has a single unlabeled segment; --piece "${piece}" would not match it (omit --piece)`);
    }
  }
  let statusText;
  if (target >= 0) {
    const seg = segs[target];
    if (seg.word === blocked || seg.word === discarded) throw new Refusal('segment-locked', `segment "${seg.raw}" is ${seg.word}; set-status does not change it`);
    const cur = ds.indexOf(seg.word) + 1;
    if (pos < cur) throw new Refusal('status-backward', `"${word}" (position ${pos}) is earlier than the current "${seg.word}" (position ${cur})`);
    const changed = pos > cur || note !== undefined;
    const raws = segs.map((s) => s.raw);
    if (changed) raws[target] = segText(seg, word, note);
    statusText = raws.join('; ');
  } else {
    const fresh = `${piece !== undefined ? `${piece}: ` : ''}${word}${note ? ` (${note})` : ''}`;
    statusText = [...segs.map((s) => s.raw), fresh].join('; ');
  }
  const cells = [...rowCells];
  cells[1] = statusText;
  if (evidence && evidence.length) cells[2] = mergeEvidence(rowCells[2], evidence);
  if (next !== undefined) cells[3] = next;
  return cells;
}

const gitUsable = (git) => Boolean(git) && !git.unavailable;

function requireIntegrationRefs(ctx) {
  const { git } = ctx;
  if (!gitUsable(git)) {
    throw new Refusal('git-unavailable', git ? `git is unavailable (${git.reason})` : 'folder is not inside a git repository, so no commit can be shown on the integration branch');
  }
  const refs = integrationRefs(git, ctx.roadmap.config);
  if (refs.length === 0) {
    throw new Refusal('git-unavailable', `neither ${ctx.roadmap.config.integrationBranch} nor origin/${ctx.roadmap.config.integrationBranch} exists`);
  }
  return refs;
}

// ---------- commands ----------

const COMMANDS = {
  status(ctx) {
    const { roadmap, parsed } = ctx;
    const b = parsed.blocks.state;
    ctx.result = {
      strategy: strategyVersion(parsed),
      stateHeader: stateHeader(roadmap),
      panel: readPanel(roadmap, parsed),
      blockers: b.blockers.rows.map((r) => ({ id: r[0], blocker: r[1], affects: r[2], since: r[3], unblocksWhen: r[4] })),
      now: b.now.items,
      pending: b.pending.items,
      inflight: b.inflight.rows.map((r) => ({ branch: r[0], kind: r[1], note: r[2] })),
    };
  },

  brief(ctx) {
    const { roadmap, parsed, git } = ctx;
    const cfg = roadmap.config;
    const problems = checkRoadmap(roadmap, git);
    const errs = problems.filter((p) => p.severity === 'error');
    const warns = problems.filter((p) => p.severity !== 'error');
    let folderChecker = null;
    try {
      const first = fs.readFileSync(path.join(ctx.folder, 'check-roadmap.mjs'), 'utf8').split(/\r?\n/, 1)[0];
      const m = /^\/\/ check-roadmap (\d+\.\d+\.\d+) format (\d+)/.exec(first);
      folderChecker = m ? m[1] : null;
    } catch {
      folderChecker = null;
    }
    const byStatus = {};
    const panel = readPanel(roadmap, parsed);
    for (const p of panel) for (const s of p.segments) (byStatus[s.word] = byStatus[s.word] || []).push(p.id);
    ctx.result = {
      strategy: strategyVersion(parsed),
      formatVersion: cfg.formatVersion,
      checker: {
        folder: folderChecker,
        plugin: CHECKER_VERSION,
        stale: folderChecker === null ? true : compareVersions(CHECKER_VERSION, folderChecker) > 0,
        errors: errs.length,
        warnings: warns.length,
        errorCodes: [...new Set(errs.map((p) => p.code))],
        warningCodes: [...new Set(warns.map((p) => p.code))],
      },
      deliverablesByStatus: byStatus,
      openBlockers: parsed.blocks.state.blockers.rows.map((r) => r[0]),
      now: parsed.blocks.state.now.items,
      pendingCount: parsed.blocks.state.pending.items.length,
      nextIds: nextIds(ctx),
      pendingDecisions: pendingDecisions(ctx),
    };
  },

  'next-id'(ctx) {
    if (ctx.args.length !== 1) throw usage('next-id needs exactly one kind: DEC, BLQ, REQ, SRC or E');
    ctx.result = { id: nextId(ctx.folder, ctx.roadmap.strategyPath, ctx.args[0]) };
  },

  'pending-decisions'(ctx) {
    ctx.result = { decisions: pendingDecisions(ctx) };
  },

  'verify-commit'(ctx) {
    if (ctx.args.length !== 1) throw usage('verify-commit needs exactly one sha');
    const sha = ctx.args[0];
    const { git } = ctx;
    if (!git || git.unavailable) {
      const reason = !git ? 'folder is not inside a git repository' : `git unavailable: ${git.reason}`;
      ctx.result = { exists: null, integrated: null, reason };
      return;
    }
    if (!/^[0-9a-fA-F]{4,64}$/.test(sha)) throw usage(`"${sha}" is not a commit sha`);
    const exists = git.commitExists(sha);
    const refs = integrationRefs(git, ctx.roadmap.config);
    ctx.result = { exists, integrated: exists && refs.some((ref) => git.isAncestor(sha, ref)), refs };
  },

  log(ctx) {
    const { opts } = ctx;
    if (ctx.args.length) throw usage('log takes options only');
    if (opts.deliverable === undefined) throw usage('log needs --deliverable <E<n>|->');
    if (opts.what === undefined) throw usage('log needs --what <text>');
    const edit = logRow(ctx, { deliverable: opts.deliverable, what: opts.what, evidence: opts.evidence, date: ctx.today });
    commitEdits(ctx, new Map([['log', [edit]]]));
    ctx.result = { date: ctx.today };
  },

  'set-status'(ctx) {
    const { opts, git } = ctx;
    if (ctx.args.length !== 2) throw usage('set-status needs <E<n>> <word>');
    const [id, word] = ctx.args;
    const row = panelRows(ctx).find((r) => r.id === id);
    if (!row) throw new Refusal('not-found', `${id} is not in the panel`);
    const cells = setSegment(ctx, row.cells, {
      piece: opts.piece, word, evidence: opts.evidence, next: opts.next, note: opts.note,
    });
    const ds = ctx.roadmap.config.vocab.deliverableStatuses;
    const pos = ds.indexOf(word) + 1;
    const oldShas = shasIn(row.cells[2]);
    const newShas = shasIn(cells[2]).filter((s) => !oldShas.includes(s));
    if (newShas.length && gitUsable(git)) {
      for (const s of newShas) if (!git.commitExists(s)) throw new Refusal('sha-missing', `commit ${s} does not exist in this repository`);
    }
    const statusChanged = cells[1] !== row.cells[1];
    if (pos >= 6 && statusChanged) {
      const refs = requireIntegrationRefs(ctx);
      const existing = shasIn(cells[2]).filter((s) => git.commitExists(s));
      if (!existing.some((s) => refs.some((ref) => git.isAncestor(s, ref)))) {
        throw new Refusal('sha-not-integrated', `no commit in Evidence (${existing.join(', ') || 'none'}) is an ancestor of ${refs.join(' or ')}; cite the SHA that entered it with --evidence`);
      }
    }
    ctx.result = { id, cells };
    if (cells.every((c, i) => c === row.cells[i])) {
      commitWrites(ctx, new Map());
      return;
    }
    commitEdits(ctx, new Map([['state', [{ op: 'replace', line: row.line, text: serializeRow(cells) }]]]));
  },

  integrate(ctx) {
    const { opts, git } = ctx;
    if (ctx.args.length) throw usage('integrate takes options only');
    if (opts.sha === undefined) throw usage('integrate needs --sha <sha>');
    const sha = opts.sha;
    if (!/^[0-9a-fA-F]{7,40}$/.test(sha)) throw usage(`"${sha}" is not a commit sha`);
    const refs = requireIntegrationRefs(ctx);
    if (!git.commitExists(sha)) throw new Refusal('sha-missing', `commit ${sha} does not exist in this repository`);
    if (!refs.some((ref) => git.isAncestor(sha, ref))) throw new Refusal('sha-not-integrated', `${sha} is not an ancestor of ${refs.join(' or ')}`);
    const cfg = ctx.roadmap.config;
    const ds = cfg.vocab.deliverableStatuses;
    const onBranch = ds[4];
    const integrated = ds[5];
    const only = opts.only === undefined ? null : opts.only.split(',').map((s) => s.trim()).filter(Boolean);
    const edits = [];
    const ids = [];
    for (const row of panelRows(ctx)) {
      if (only && !only.includes(row.id)) continue;
      const segs = parseStatusSegments(row.cells[1]);
      if (segs.length === 0 || !segs.every((s) => s.word === onBranch)) continue;
      const existing = shasIn(row.cells[2]).filter((s) => git.commitExists(s));
      if (existing.length === 0 || !existing.every((s) => refs.some((ref) => git.isAncestor(s, ref)))) continue;
      const cells = [...row.cells];
      cells[1] = segs.map((s) => segText(s, integrated)).join('; ');
      cells[2] = mergeEvidence(row.cells[2], [sha]);
      edits.push({ op: 'replace', line: row.line, text: serializeRow(cells) });
      ids.push(row.id);
    }
    ctx.result = { integrated: ids, sha };
    if (ids.length === 0) {
      commitWrites(ctx, new Map());
      return;
    }
    const via = cfg.releaseBranch ? ` via ${cfg.releaseBranch}` : '';
    const list = ids.join(', ');
    const what = opts.what !== undefined
      ? opts.what
      : (ctx.lang === 'pt' ? `${list} integrada(s) em ${cfg.integrationBranch}${via}` : `${list} integrated into ${cfg.integrationBranch}${via}`);
    const logEdit = logRow(ctx, { deliverable: list, what, evidence: [sha], date: ctx.today });
    commitEdits(ctx, new Map([['state', edits], ['log', [logEdit]]]));
  },
};

export { COMMANDS };

// ---------- run ----------

function emptyOutput(command, folder) {
  return {
    tool: 'roadmap', command, folder, changed: [], result: {}, errors: [], warnings: [],
    summary: { errors: 0, warnings: 0, exitCode: 0 },
  };
}

function finish(output, exitCode) {
  output.summary = { errors: output.errors.length, warnings: output.warnings.length, exitCode };
  return { exitCode, output: orderKeys(output) };
}

function orderKeys(o) {
  return {
    tool: o.tool, command: o.command, folder: o.folder, changed: o.changed, result: o.result,
    errors: o.errors, warnings: o.warnings, summary: o.summary,
  };
}

export function run(argv, io = {}) {
  const cwd = io.cwd || process.cwd();
  let command = '';
  let folderArg = '';
  let ctx = null;
  const output = emptyOutput('', '');
  try {
    const { positional, opts, flags } = parseArgs(argv);
    command = positional[0] || '';
    output.command = command;
    if (flags.help || command === 'help' || command === '') {
      output.command = 'help';
      output.result = { commands: COMMAND_NAMES, text: HELP };
      return finish(output, 0);
    }
    if (!COMMAND_NAMES.includes(command) || !COMMANDS[command]) throw usage(`unknown command "${command}" (see --help)`);
    if (positional.length < 2) throw usage(`${command} needs a roadmap folder`);
    folderArg = positional[1];
    const folder = path.resolve(cwd, folderArg);
    output.folder = folder;
    const args = positional.slice(2);
    let date = io.today || localIsoDate();
    if (opts.date !== undefined) {
      if (!validDate(opts.date)) throw usage(`--date must be a valid YYYY-MM-DD date, got "${opts.date}"`);
      date = opts.date;
    }
    if (!fs.existsSync(path.join(folder, 'roadmap.config.json'))) {
      throw new Refusal('not-found', `no roadmap.config.json in ${folder}`, 2);
    }
    let roadmap;
    try {
      roadmap = loadRoadmap(folder);
    } catch (e) {
      throw usage(String((e && e.message) || e).replace(/^config:\s*/, ''));
    }
    if (roadmap.config.formatVersion > FORMAT_VERSION) {
      throw new Refusal('format-newer', `formatVersion ${roadmap.config.formatVersion} is newer than this CLI understands (${FORMAT_VERSION}); refresh the plugin`, 1);
    }
    const git = createGitAdapter(folder);
    const warnings = [];
    if (!git) warnings.push({ code: 'no-git', message: 'folder is not inside a git repository; commit checks are skipped' });
    else if (git.unavailable) warnings.push({ code: 'no-git', message: `git is unavailable (${git.reason}); commit checks are skipped` });
    const parsed = parseRoadmapTexts({ strategy: roadmap.strategy, files: roadmap.files });
    const lang = String(roadmap.config.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
    ctx = {
      folder, args, opts, roadmap, parsed, git, lang, today: date, result: {}, warnings, hooks: io.hooks || {}, raws: new Map(), changed: [],
    };
    COMMANDS[command](ctx);
    output.result = ctx.result;
    output.changed = ctx.changed || [];
    output.warnings = ctx.warnings;
    return finish(output, 0);
  } catch (e) {
    if (ctx) {
      output.changed = ctx.changed || [];
      output.warnings = ctx.warnings;
    }
    if (e instanceof Refusal) {
      output.errors.push({ code: e.code, message: e.message });
      return finish(output, e.exitCode);
    }
    output.errors.push({ code: 'usage', message: String((e && e.message) || e).split('\n')[0] });
    return finish(output, 2);
  }
}

export function formatText(output) {
  const lines = [];
  if (output.command === 'help' && output.result && output.result.text) lines.push(output.result.text);
  for (const f of output.changed) lines.push(`changed ${f}`);
  for (const e of output.errors) lines.push(`ERROR ${e.code}: ${e.message}`);
  for (const w of output.warnings) lines.push(`WARN ${w.code}: ${w.message}`);
  lines.push(`roadmap ${output.command}: changed ${output.changed.length} file(s), ${output.errors.length} error(s), ${output.warnings.length} warning(s)`);
  return lines.join('\n');
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
  const argv = process.argv.slice(2);
  const { exitCode, output } = run(argv);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    const readResult = output.command !== 'help' && output.changed.length === 0 && output.errors.length === 0
      && output.result && Object.keys(output.result).length > 0;
    if (readResult) console.log(JSON.stringify(output.result, null, 2));
    console.log(formatText(output));
  }
  process.exitCode = exitCode;
}
