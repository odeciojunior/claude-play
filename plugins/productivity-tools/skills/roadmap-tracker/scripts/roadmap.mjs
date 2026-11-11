// roadmap CLI: deterministic events for the roadmap tracker (E3).
// Usage: node roadmap.mjs <command> <folder> [arguments] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoadmapTexts, parseStatusSegments, decisionScope, norm, idsIn } from '../../../lib/roadmap-format.mjs';
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
    const ctx = {
      folder, args, opts, roadmap, parsed, git, lang, today: date, result: {}, warnings, hooks: io.hooks || {},
    };
    COMMANDS[command](ctx);
    output.result = ctx.result;
    output.changed = ctx.changed || [];
    output.warnings = ctx.warnings;
    return finish(output, 0);
  } catch (e) {
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
