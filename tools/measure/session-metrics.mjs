// Session metrics extractor: reads Claude Code transcripts and returns counters per run and role.
// Repo-only tool (not shipped). No dependencies.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  [/^t\d+:fix/, 'task-fix'],
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
      reviewRounds: { loops: {}, extra: 0 },
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error('session-metrics: the CLI arrives in Task 4');
  process.exit(2);
}
