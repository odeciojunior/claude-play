// Session metrics extractor: reads Claude Code transcripts and returns counters per run and role.
// Repo-only tool (not shipped). No dependencies.
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FAMILIES = ['haiku', 'sonnet', 'opus', 'fable', 'other'];

export function readJsonl(file) {
  const out = [];
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // partial or corrupt line: skip
    }
  }
  return out;
}

export function family(model) {
  const m = String(model ?? '').toLowerCase();
  for (const f of ['haiku', 'sonnet', 'opus', 'fable']) if (m.includes(f)) return f;
  return 'other';
}

// One assistant message per message.id (else requestId); the copy with the largest output_tokens wins.
export function dedupeMessages(lines) {
  const byKey = new Map();
  let anon = 0;
  for (const o of lines) {
    if (o?.type !== 'assistant' || !o.message?.usage) continue;
    if (o.message.model === '<synthetic>') continue;
    const key = o.message.id ?? o.requestId ?? `anon-${anon++}`;
    const prev = byKey.get(key);
    if (!prev || (o.message.usage.output_tokens ?? 0) > (prev.message.usage.output_tokens ?? 0)) byKey.set(key, o);
  }
  return [...byKey.values()];
}

export function loadPrices(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const emptyTokens = () => ({ input: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 });

// Without usage.cache_creation, the whole cache_creation_input_tokens counts as a 5-minute write.
function tokensOf(usage) {
  const cc = usage.cache_creation;
  const total = usage.cache_creation_input_tokens ?? 0;
  return {
    input: usage.input_tokens ?? 0,
    cacheWrite5m: cc ? (cc.ephemeral_5m_input_tokens ?? 0) : total,
    cacheWrite1h: cc ? (cc.ephemeral_1h_input_tokens ?? 0) : 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
  };
}

function addTokens(a, b) {
  for (const k of Object.keys(a)) a[k] += b[k];
}

export function costOf(tokens, fam, prices) {
  const p = prices?.models?.[fam];
  if (!p) return null;
  return (
    (tokens.input * p.input +
      tokens.cacheWrite5m * p.input * prices.cacheWrite5m +
      tokens.cacheWrite1h * p.input * prices.cacheWrite1h +
      tokens.cacheRead * p.cacheRead +
      tokens.output * p.output) /
    1e6
  );
}

function newCounters() {
  return {
    calls: { haiku: 0, sonnet: 0, opus: 0, fable: 0, other: 0 },
    promptBytes: 0,
    tokens: emptyTokens(),
    cost: null,
    unpriced: [],
  };
}

// cost stays null when nothing in the counter has a price; unpriced lists the families without one.
function addCost(c, cost, fam) {
  if (cost === null) {
    if (!c.unpriced.includes(fam)) c.unpriced.push(fam);
  } else {
    c.cost = (c.cost ?? 0) + cost;
  }
}

function addCounters(dst, src) {
  for (const f of FAMILIES) dst.calls[f] += src.calls[f];
  dst.promptBytes += src.promptBytes;
  addTokens(dst.tokens, src.tokens);
  if (src.cost !== null) dst.cost = (dst.cost ?? 0) + src.cost;
  for (const f of src.unpriced) if (!dst.unpriced.includes(f)) dst.unpriced.push(f);
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('');
}

const isHumanUser = (o) =>
  o?.type === 'user' &&
  !o.isMeta &&
  !(Array.isArray(o.message?.content) && o.message.content.some((b) => b?.type === 'tool_result'));

function measureAgent(lines, prices) {
  const votes = {};
  const counters = newCounters();
  for (const m of dedupeMessages(lines)) {
    const fam = family(m.message.model);
    votes[fam] = (votes[fam] ?? 0) + 1;
    const t = tokensOf(m.message.usage);
    addTokens(counters.tokens, t);
    addCost(counters, costOf(t, fam, prices), fam);
  }
  let dominant = 'other';
  let best = 0;
  for (const f of FAMILIES) {
    if ((votes[f] ?? 0) > best) {
      best = votes[f];
      dominant = f;
    }
  }
  counters.calls[dominant] += 1;
  const first = lines.find((o) => o?.type === 'user');
  counters.promptBytes = first ? Buffer.byteLength(textOf(first.message?.content), 'utf8') : 0;
  return counters;
}

function measureMain(lines, prices) {
  const main = lines.filter((o) => !o.isSidechain);
  const msgs = dedupeMessages(main);
  const acc = newCounters();
  for (const m of msgs) {
    const fam = family(m.message.model);
    const t = tokensOf(m.message.usage);
    addTokens(acc.tokens, t);
    addCost(acc, costOf(t, fam, prices), fam);
  }
  // Each Agent/Task tool_use counts once, even when its message was streamed into several lines.
  const seen = new Set();
  const agentCalls = {};
  for (const o of main) {
    if (o.type !== 'assistant' || !Array.isArray(o.message?.content)) continue;
    for (const b of o.message.content) {
      if (b?.type !== 'tool_use' || (b.name !== 'Agent' && b.name !== 'Task')) continue;
      const id = b.id ?? `${o.message.id ?? o.requestId}:${seen.size}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const k = b.input?.model ?? 'default';
      agentCalls[k] = (agentCalls[k] ?? 0) + 1;
    }
  }
  const promptBytes = main
    .filter(isHumanUser)
    .reduce((n, o) => n + Buffer.byteLength(textOf(o.message?.content), 'utf8'), 0);
  return { turns: msgs.length, agentCalls, promptBytes, tokens: acc.tokens, cost: acc.cost, unpriced: acc.unpriced };
}

// Role of an agent from its label (meta.description); rules in the order of the spec table.
// The label is lowercased, without the `e<n>:` prefix and without a `#<n>` suffix.
export function normalizeLabel(label) {
  return String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/^e\d+:/, '')
    .replace(/#\d+$/, '')
    .trim();
}

const ROLE_RULES = [
  [/^discovery$/, 'discovery'],
  [/^(preflight|preparar)/, 'preflight'],
  [/^setup$/, 'setup'],
  [/^spec-review\d+$/, 'spec-review'],
  [/^spec-fix\d+$/, 'spec-fix'],
  [/^spec$/, 'spec'],
  [/^plan-review\d+$/, 'plan-review'],
  [/^plan-fix\d+$/, 'plan-fix'],
  [/^plan$/, 'plan'],
  [/^status-/, 'status-record'],
  [/^progress/, 'progress'],
  [/^review-log/, 'review-log'],
  [/^report$/, 'report'],
  [/^(t\d+:impl$|exec:)/, 'implementer'],
  [/^t\d+:spec\d+$/, 'task-spec-review'],
  [/^t\d+:quality\d+$/, 'task-quality-review'],
  [/^t\d+:(fix|(spec|quality)-fix)/, 'task-fix'],
  [/^(final|revisao-final|sync|test-integrity)/, 'final-review'],
  [/^(gates|evidence|suite)/, 'gates'],
  [/^(merge|pre-merge|cleanup)/, 'merge'],
  [/^docs/, 'docs'],
  [/^(guarda|conferir|commit|git-truth)/, 'guards'],
];

export function classifyRole(label, { workflow, agentType } = {}) {
  const l = normalizeLabel(label);
  for (const [re, role] of ROLE_RULES) if (re.test(l)) return role;
  if (workflow) return `other:${l.replace(/\d+/g, '')}`;
  return `agent:${agentType ?? 'general'}`;
}

// Review loops seen in a label: returns { loop, round } or null.
function reviewLoop(label) {
  const l = normalizeLabel(label);
  let m = /^(spec-review|plan-review|final)(\d+)$/.exec(l);
  if (m) return { loop: m[1], round: Number(m[2]) };
  m = /^final-\d+-r(\d+)$/.exec(l); // one reviewer per lens: final-<lens>-r<round>
  if (m) return { loop: 'final', round: Number(m[1]) };
  m = /^t(\d+):(spec|quality)(\d+)$/.exec(l);
  if (m) return { loop: `t${m[1]}:${m[2]}`, round: Number(m[3]) };
  return null;
}

const taskOf = (label) => /^t(\d+):/.exec(normalizeLabel(label))?.[1] ?? null;

const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((n) => statSync(join(p, n)).isDirectory()) : []);
const files = (p, re) => (existsSync(p) ? readdirSync(p).filter((n) => re.test(n)) : []);

function listSessions(root) {
  const out = [];
  for (const project of dirs(root)) {
    for (const f of files(join(root, project), /\.jsonl$/)) {
      const sid = f.replace(/\.jsonl$/, '');
      out.push({ sid, project, file: join(root, project, f), dir: join(root, project, sid) });
    }
  }
  return out;
}

function listAgents(sessionDir) {
  const sub = join(sessionDir, 'subagents');
  const out = [];
  const add = (dir, workflow) => {
    for (const f of files(dir, /^agent-.*\.jsonl$/)) {
      const metaFile = join(dir, f.replace(/\.jsonl$/, '.meta.json'));
      let meta = {};
      if (existsSync(metaFile)) {
        try {
          meta = JSON.parse(readFileSync(metaFile, 'utf8'));
        } catch {
          meta = {};
        }
      }
      out.push({ id: f.replace(/\.jsonl$/, ''), file: join(dir, f), meta, workflow });
    }
  };
  add(sub, false);
  const wfRoot = join(sub, 'workflows');
  for (const wf of dirs(wfRoot).filter((n) => n.startsWith('wf_'))) add(join(wfRoot, wf), true);
  return out;
}

// `runs` (optional): [{ run, sessions: [sid] }] or { [run]: { sessions } }. Without it, each session is a run.
// `total` sums the agents only; the main context is reported separately in `main`.
export function extract({ root, sessions, runs, prices }) {
  const all = listSessions(root);
  const bySid = new Map(all.map((s) => [s.sid, s]));
  let plan;
  if (runs) {
    const list = Array.isArray(runs) ? runs : Object.entries(runs).map(([run, v]) => ({ run, sessions: v.sessions ?? v }));
    plan = list.map((r) => ({ run: r.run, sids: r.sessions }));
  } else {
    plan = all.filter((s) => !sessions || sessions.includes(s.sid)).map((s) => ({ run: s.sid, sids: [s.sid] }));
  }
  const unpricedAll = new Set();
  const result = [];
  for (const { run, sids } of plan) {
    const r = {
      run,
      sessions: sids,
      roles: {},
      total: newCounters(),
      reviewRounds: { loops: {}, extra: 0, extraAgents: newCounters() },
      tasks: { count: 0, loop: newCounters() },
      main: { turns: 0, agentCalls: {}, promptBytes: 0, tokens: emptyTokens(), cost: null },
    };
    const taskIds = new Set();
    for (const sid of sids) {
      const s = bySid.get(sid);
      if (!s) continue;
      const m = measureMain(readJsonl(s.file), prices);
      r.main.turns += m.turns;
      r.main.promptBytes += m.promptBytes;
      addTokens(r.main.tokens, m.tokens);
      if (m.cost !== null) r.main.cost = (r.main.cost ?? 0) + m.cost;
      for (const [k, n] of Object.entries(m.agentCalls)) r.main.agentCalls[k] = (r.main.agentCalls[k] ?? 0) + n;
      for (const f of m.unpriced) unpricedAll.add(f);
      for (const a of listAgents(s.dir)) {
        const c = measureAgent(readJsonl(a.file), prices);
        const role = classifyRole(a.meta.description, { workflow: a.workflow, agentType: a.meta.agentType });
        r.roles[role] ??= { ...newCounters(), agents: 0 };
        addCounters(r.roles[role], c);
        r.roles[role].agents += 1;
        addCounters(r.total, c);
        for (const f of c.unpriced) unpricedAll.add(f);
        const rl = reviewLoop(a.meta.description);
        if (rl) r.reviewRounds.loops[rl.loop] = Math.max(r.reviewRounds.loops[rl.loop] ?? 0, rl.round);
        const task = taskOf(a.meta.description);
        // Reviewers of rounds above 1 outside the task loop (task agents are already in tasks.loop).
        if (rl && rl.round > 1 && task === null) addCounters(r.reviewRounds.extraAgents, c);
        if (task !== null) {
          taskIds.add(task);
          addCounters(r.tasks.loop, c);
        }
      }
    }
    r.tasks.count = taskIds.size;
    r.reviewRounds.extra = Object.values(r.reviewRounds.loops).reduce((n, max) => n + (max - 1), 0);
    result.push(r);
  }
  return { runs: result, unpriced: [...unpricedAll] };
}

const CSV_HEADER = [
  'run', 'role', 'agents', 'calls_haiku', 'calls_sonnet', 'calls_opus', 'calls_fable', 'calls_other',
  'promptBytes', 'input', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead', 'output', 'cost',
];

const csvField = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// One row per run and role, plus `main` and `total` per run; cost is empty when null.
export function toCsv(result) {
  const lines = [CSV_HEADER.join(',')];
  const add = (run, role, agents, calls, promptBytes, t, cost) =>
    lines.push(
      [
        run, role, agents,
        ...FAMILIES.map((f) => calls?.[f] ?? ''),
        promptBytes, t.input, t.cacheWrite5m, t.cacheWrite1h, t.cacheRead, t.output, cost,
      ]
        .map(csvField)
        .join(','),
    );
  for (const r of result.runs) {
    let agents = 0;
    for (const [role, c] of Object.entries(r.roles)) {
      agents += c.agents;
      add(r.run, role, c.agents, c.calls, c.promptBytes, c.tokens, c.cost);
    }
    add(r.run, 'main', '', null, r.main.promptBytes, r.main.tokens, r.main.cost);
    add(r.run, 'total', agents, r.total.calls, r.total.promptBytes, r.total.tokens, r.total.cost);
  }
  return lines.join('\n') + '\n';
}

const USAGE =
  'usage: node tools/measure/session-metrics.mjs --root <dir> --out <dir> [--sessions id,id] [--runs <attempts.json>] [--prices <prices.json>]';

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!['--root', '--out', '--sessions', '--runs', '--prices'].includes(k) || argv[i + 1] === undefined) return null;
    opts[k.slice(2)] = argv[i + 1];
  }
  return opts;
}

// Repository root from the script location; null outside a git checkout.
function repoRootOf() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dirname(fileURLToPath(import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
const isInside = (base, target) => {
  const rel = relative(fold(resolve(base)), fold(resolve(target)));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

// --out inside the repository is accepted only under tools/measure/out/.
function outAllowed(out) {
  const repo = repoRootOf();
  if (!repo || !isInside(repo, out)) return true;
  return isInside(join(repo, 'tools', 'measure', 'out'), out);
}

export async function main(argv) {
  const opts = parseArgs(argv);
  if (!opts || !opts.root || !opts.out) {
    console.error(USAGE);
    return 2;
  }
  if (!outAllowed(opts.out)) {
    console.error('session-metrics: --out inside the repository must be under tools/measure/out/');
    return 2;
  }
  const pricesFile = opts.prices ?? join(dirname(fileURLToPath(import.meta.url)), 'prices.json');
  const prices = loadPrices(pricesFile);
  let runs;
  if (opts.runs) {
    const manifest = JSON.parse(readFileSync(opts.runs, 'utf8'));
    runs = manifest.attempts.map((a) => ({ run: `attempt-${a.n}`, sessions: a.sessions }));
  }
  const sessions = opts.sessions ? opts.sessions.split(',').filter(Boolean) : undefined;
  const result = extract({ root: opts.root, sessions, runs, prices });
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(join(opts.out, 'metrics.json'), JSON.stringify(result, null, 2) + '\n');
  writeFileSync(join(opts.out, 'metrics.csv'), toCsv(result));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
