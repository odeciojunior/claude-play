#!/usr/bin/env node
// skill-runs.mjs - finds runs of roadmap-planner/tracker/release, plan-coordinator (+ superpowers brainstorming,
// writing-plans, subagent-driven-development) in Claude Code transcripts and computes tokens/cost/time per run.
// Read-only on the projects dir. Usage:
//   node skill-runs.mjs --root <transcripts dir> --out <output dir outside the repo> [--idle-min 60] [--verify]
// --root and --out are required and have no default: the output carries session ids and agent descriptions
// and must never be written inside the repository.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const ROOT = opt('--root');
const OUT = opt('--out');
if (!ROOT || !OUT) { console.error('usage: node skill-runs.mjs --root <transcripts dir> --out <output dir outside the repo>'); process.exit(2); }
const IDLE_MIN = Number(opt('--idle-min', 60));      // human prompt after this idle gap ends an extended window
const GAP_MS = 5 * 60 * 1000;                         // active-time gap threshold
const VERIFY = args.includes('--verify');

const TRACKED = ['roadmap-planner', 'roadmap-tracker', 'roadmap-release', 'plan-coordinator',
  'brainstorming', 'writing-plans', 'subagent-driven-development'];
// skills that legitimately call other skills / subagents themselves: a tool-called other skill nests inside
const ORCHESTRATORS = new Set(['plan-coordinator', 'roadmap-release', 'roadmap-planner', 'subagent-driven-development']);
// prices USD per million tokens (input, output); cache write 1.25x input, cache read 0.1x input
const PRICE = { haiku: [0.10, 0.50], sonnet: [2, 10], opus: [4, 20], fable: [8, 40] };

const fam = (m) => { m = (m || '').toLowerCase(); for (const f of Object.keys(PRICE)) if (m.includes(f)) return f; return m ? 'other' : 'unknown'; };
const base = (s) => { s = (s || '').replace(/^\//, ''); const i = s.lastIndexOf(':'); return i >= 0 ? s.slice(i + 1) : s; };
const tracked = (s) => TRACKED.includes(base(s)) ? base(s) : null;
const ts = (o) => (o && o.timestamp ? Date.parse(o.timestamp) : NaN);

function readJsonl(file) {
  const out = [];
  let txt; try { txt = fs.readFileSync(file, 'utf8'); } catch { return out; }
  for (const l of txt.split('\n')) { if (!l) continue; try { out.push(JSON.parse(l)); } catch { /* partial last line */ } }
  return out;
}

const zero = () => ({ input: 0, cw: 0, cr: 0, output: 0, cw1h: 0, msgs: 0 });
function addUsage(t, u) {
  t.input += u.input_tokens || 0; t.cw += u.cache_creation_input_tokens || 0;
  t.cr += u.cache_read_input_tokens || 0; t.output += u.output_tokens || 0;
  t.cw1h += u.cache_creation?.ephemeral_1h_input_tokens || 0; t.msgs++;
}
const costOf = (f, t) => { const p = PRICE[f]; if (!p) return 0;
  return (t.input * p[0] + t.cw * p[0] * 1.25 + t.cr * p[0] * 0.1 + t.output * p[1]) / 1e6; };

// Dedupe: one assistant message is written once per content block with identical usage; key = message.id
// (fallback requestId). If duplicates differ (streaming), keep the one with the largest output_tokens.
function dedupeAssistant(lines, filter = () => true) {
  const m = new Map();
  for (let i = 0; i < lines.length; i++) {
    const o = lines[i];
    if (o.type !== 'assistant' || !o.message?.usage || !filter(o, i)) continue;
    if (o.message.model === '<synthetic>') continue;
    const k = o.message.id || o.requestId || o.uuid;
    const prev = m.get(k);
    if (!prev || (o.message.usage.output_tokens || 0) >= (prev.message.usage.output_tokens || 0)) m.set(k, o);
  }
  return [...m.values()];
}

// ---- agent (subagent / workflow agent) transcript summary, cached by file
const agentCache = new Map();
function summarizeAgent(file) {
  if (agentCache.has(file)) return agentCache.get(file);
  const lines = readJsonl(file);
  const metaFile = file.replace(/\.jsonl$/, '.meta.json');
  let meta = {}; try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { /* none */ }
  const msgs = dedupeAssistant(lines);
  const byModel = {};
  for (const o of msgs) { const f = fam(o.message.model); (byModel[f] ??= zero()); addUsage(byModel[f], o.message.usage); }
  const times = lines.map(ts).filter(Number.isFinite);
  const toolUses = [];
  for (const o of lines) if (o.type === 'assistant') for (const b of o.message?.content || [])
    if (b.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')) toolUses.push(b.id);
  const models = Object.keys(byModel).sort((a, b) => byModel[b].msgs - byModel[a].msgs);
  const s = { file, id: path.basename(file).replace(/^agent-|\.jsonl$/g, ''), meta, byModel, times, toolUses,
    mainModel: models[0] || fam(meta.model) || 'unknown', turns: msgs.length,
    peak: Math.max(0, ...msgs.map((o) => (o.message.usage.input_tokens || 0) + (o.message.usage.cache_read_input_tokens || 0) + (o.message.usage.cache_creation_input_tokens || 0))) };
  agentCache.set(file, s); return s;
}

// role classifier from label / description
function role(label, phase, kind) {
  const l = (label || '').toLowerCase().replace(/#\d+$/, '').replace(/^e\d+:/, '');
  const rules = [
    [/^discovery/, 'discovery'], [/^(preflight|preparar)/, 'preflight/prepare'], [/^setup/, 'setup'],
    [/^(mapa)/, 'map'], [/spec-?review|^builder-check/, 'spec review'], [/^(spec|resolver|spec:)/, 'spec'],
    [/^(plan-?review|revisar-plano|corrigir-plano)/, 'plan review/fix'], [/^(plan|plano)/, 'plan'],
    [/^status-|^progress|^review-log|^registrar|^report$/, 'tracker/record/report'],
    [/^t\d+:impl|^exec:/, 'implementer'], [/^t\d+:spec/, 'task spec review'], [/^t\d+:quality/, 'task quality review'],
    [/^revisar:/, 'task review (opus)'], [/^(final|revisao-final|sync|test-integrity|suite-final)/, 'final review'],
    [/^(gates|evidence|merge-gates|suite|builder)/, 'gates/suites'], [/^(merge|pre-merge|cleanup)/, 'merge'],
    [/^(docs)/, 'docs'], [/^(guarda|conferir|commit|git-truth)/, 'guards/checks/commits'], [/^fechar/, 'close'],
  ];
  for (const [re, r] of rules) if (re.test(l)) return r;
  if (kind === 'agent') {
    if (/review|revis/.test(l)) return 'review'; if (/implement|impl|task|step/.test(l)) return 'implementer';
    if (/explor|research|search|read|audit|survey/.test(l)) return 'explore/research';
    if (/test|suite|lint|check|verif/.test(l)) return 'checks'; if (/commit|track|record|progress/.test(l)) return 'commit/track';
  }
  return kind === 'agent' ? 'other (ad-hoc description)' : 'other:' + (phase || l.slice(0, 14));
}

// ---- main session parse
function listSessions() {
  const res = [];
  for (const p of fs.readdirSync(ROOT)) {
    const d = path.join(ROOT, p); let st; try { st = fs.statSync(d); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.jsonl')) res.push({ slug: p, file: path.join(d, f), sid: f.replace(/\.jsonl$/, ''), dir: path.join(d, f.replace(/\.jsonl$/, '')) });
  }
  return res;
}

const BUILTIN_SYS = /^(<local-command|<system-reminder|<task-notification|\[Workflow|This session is being continued|Goal check-in|Caveat:|\(Re-invocation|<command-name>\/?(compact|clear|reload-plugins|plugin|model|effort|config|help|resume|context|cost|usage|status|exit|login|logout|memory|mcp|permissions|agents|hooks|ide|rewind|export|copy|theme|vim|fast|skills|plugins|goal|tasks|doctor|add-dir|branch|rename|btw|ultracode)<)/;
function textOf(c) { return typeof c === 'string' ? c : (c || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'); }

function parseSession(S) {
  const lines = readJsonl(S.file);
  const ev = []; // {i, t, kind, ...}
  const wfByToolUse = new Map(); // tool_use id -> wf run id
  const toolUseNames = new Map();
  let lastCost = null;
  for (let i = 0; i < lines.length; i++) {
    const o = lines[i];
    if (o.type === 'cost-state') { lastCost = o; continue; }
    if (o.type === 'user' && !o.isSidechain) {
      const c = o.message?.content;
      const isTR = Array.isArray(c) && c.some((b) => b.type === 'tool_result');
      if (isTR) {
        for (const b of c) if (b.type === 'tool_result') {
          const txt = typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '');
          const m = txt.match(/Transcript dir:\s*[^\n"]*?(wf_[A-Za-z0-9-]+)/);
          if (m && toolUseNames.get(b.tool_use_id) === 'Workflow') wfByToolUse.set(b.tool_use_id, m[1]);
        }
        continue;
      }
      if (o.isMeta) {
        const t = textOf(c); const m = t.match(/^Base directory for this skill:\s*(.+)/);
        if (m) ev.push({ i, t: ts(o), kind: 'skillbase', dir: m[1].trim() });
        continue;
      }
      const text = textOf(c);
      const cm = text.match(/<command-name>([^<]*)<\/command-name>/);
      const human = o.origin?.kind === 'human' || (o.origin == null && !BUILTIN_SYS.test(text.trim()));
      if (cm && tracked(cm[1])) { ev.push({ i, t: ts(o), kind: 'start', via: 'cmd', skill: tracked(cm[1]), human: true }); ev.push({ i, t: ts(o), kind: 'human', slash: true }); }
      else if (human && !BUILTIN_SYS.test(text.trim())) ev.push({ i, t: ts(o), kind: 'human', slash: !!cm });
      continue;
    }
    if (o.type === 'assistant' && !o.isSidechain) {
      for (const b of o.message?.content || []) {
        if (b.type !== 'tool_use') continue;
        toolUseNames.set(b.id, b.name);
        if (b.name === 'Skill' && tracked(b.input?.skill)) ev.push({ i, t: ts(o), kind: 'start', via: 'tool', skill: tracked(b.input.skill), args: b.input.args });
        else if (b.name === 'Agent' || b.name === 'Task') ev.push({ i, t: ts(o), kind: 'agent', id: b.id, input: b.input || {} });
        else if (b.name === 'Workflow') ev.push({ i, t: ts(o), kind: 'workflow', id: b.id, input: b.input || {} });
      }
    }
  }
  return { S, lines, ev, wfByToolUse, lastCost };
}

function agentIndex(S) {
  // toolUseId -> agent file (flat subagents) ; wf run id -> [agent files]
  const byTool = new Map(); const byWf = new Map(); const all = [];
  const sub = path.join(S.dir, 'subagents');
  if (!fs.existsSync(sub)) return { byTool, byWf, all };
  for (const f of fs.readdirSync(sub)) {
    const p = path.join(sub, f);
    if (f.startsWith('agent-') && f.endsWith('.jsonl')) {
      all.push(p);
      try { const m = JSON.parse(fs.readFileSync(p.replace(/\.jsonl$/, '.meta.json'), 'utf8')); if (m.toolUseId) byTool.set(m.toolUseId, p); } catch { /* */ }
    } else if (f === 'workflows' && fs.statSync(p).isDirectory()) {
      for (const w of fs.readdirSync(p)) {
        const wd = path.join(p, w); if (!fs.statSync(wd).isDirectory()) continue;
        const fl = fs.readdirSync(wd).filter((x) => x.startsWith('agent-') && x.endsWith('.jsonl')).map((x) => path.join(wd, x));
        byWf.set(w, fl); all.push(...fl);
      }
    }
  }
  return { byTool, byWf, all };
}

function readWfJson(S, wf) {
  try { return JSON.parse(fs.readFileSync(path.join(S.dir, 'workflows', wf + '.json'), 'utf8')); } catch { return null; }
}

// ---- compute metrics over a window [s,e) of line indexes
function metrics(P, idx, s, e) {
  const { S, lines, ev, wfByToolUse } = P;
  const inWin = (x) => x.i >= s && x.i < e;
  const mainMsgs = dedupeAssistant(lines, (o, i) => !o.isSidechain && i >= s && i < e);
  const main = {}; const mainTimes = [];
  let peak = 0, mainModelCount = {};
  for (const o of mainMsgs) {
    const f = fam(o.message.model); (main[f] ??= zero()); addUsage(main[f], o.message.usage);
    const u = o.message.usage; peak = Math.max(peak, (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0));
    mainModelCount[f] = (mainModelCount[f] || 0) + 1;
  }
  for (let i = s; i < e && i < lines.length; i++) { const t = ts(lines[i]); if (Number.isFinite(t)) mainTimes.push(t); }
  const mainModel = Object.keys(mainModelCount).sort((a, b) => mainModelCount[b] - mainModelCount[a])[0] || 'none';

  // subagents
  const agentFiles = new Set(); const agentCallsByRequested = {}; let agentCalls = 0, agentMissing = 0;
  const wfRuns = []; let resumes = 0; const wfCalls = [];
  const queue = [];
  for (const x of ev.filter(inWin)) {
    if (x.kind === 'agent') {
      agentCalls++; const rq = x.input.model || 'default'; agentCallsByRequested[rq] = (agentCallsByRequested[rq] || 0) + 1;
      const f = idx.byTool.get(x.id); if (f) { agentFiles.add(f); queue.push(f); } else agentMissing++;
    } else if (x.kind === 'workflow') {
      wfCalls.push(x.input); if (x.input.resumeFromRunId) resumes++;
      const wf = wfByToolUse.get(x.id);
      if (wf) { if (!wfRuns.includes(wf)) wfRuns.push(wf); } else wfRuns.push('?' + x.id);
    }
  }
  const wfAgentFiles = new Set();
  for (const wf of wfRuns) for (const f of idx.byWf.get(wf) || []) { wfAgentFiles.add(f); agentFiles.add(f); }
  // nested agents spawned by agents already linked
  const seen = new Set(); const q2 = [...queue, ...wfAgentFiles];
  while (q2.length) { const f = q2.pop(); if (seen.has(f)) continue; seen.add(f);
    for (const tid of summarizeAgent(f).toolUses) { const nf = idx.byTool.get(tid); if (nf && !agentFiles.has(nf)) { agentFiles.add(nf); q2.push(nf); } } }

  const sub = {}; const subCount = {}; const subTimes = []; const roles = {}; const agentsOut = [];
  let subPeak = 0;
  for (const f of agentFiles) {
    const a = summarizeAgent(f); const isWf = wfAgentFiles.has(f);
    subCount[a.mainModel] = (subCount[a.mainModel] || 0) + 1;
    for (const [m, t] of Object.entries(a.byModel)) { (sub[m] ??= zero()); for (const k of ['input', 'cw', 'cr', 'output', 'cw1h', 'msgs']) sub[m][k] += t[k]; }
    subTimes.push(...a.times); subPeak = Math.max(subPeak, a.peak);
    const label = a.meta.description || a.meta.agentType || a.id;
    const r = role(label, a.meta.workflowPhase, isWf ? 'wf' : 'agent');
    const rr = (roles[r] ??= { n: 0, cost: 0, tokens: 0, byModel: {} });
    rr.n++; for (const [m, t] of Object.entries(a.byModel)) { rr.cost += costOf(m, t); rr.tokens += t.input + t.cw + t.cr + t.output; rr.byModel[m] = (rr.byModel[m] || 0) + 1; }
    agentsOut.push({ id: a.id, label, role: r, model: a.mainModel, wf: isWf });
  }
  const all = [...mainTimes, ...subTimes].filter(Number.isFinite).sort((x, y) => x - y);
  let active = 0; for (let k = 1; k < all.length; k++) { const g = all[k] - all[k - 1]; if (g < GAP_MS) active += g; }
  const mt = [...mainTimes].sort((x, y) => x - y);
  let activeMain = 0; for (let k = 1; k < mt.length; k++) { const g = mt[k] - mt[k - 1]; if (g < GAP_MS) activeMain += g; }
  const cost = (g) => Object.entries(g).reduce((a, [m, t]) => a + costOf(m, t), 0);
  const tot = (g) => Object.values(g).reduce((a, t) => ({ input: a.input + t.input, cw: a.cw + t.cw, cr: a.cr + t.cr, output: a.output + t.output }), { input: 0, cw: 0, cr: 0, output: 0 });
  return {
    wallMainMin: mt.length ? (mt[mt.length - 1] - mt[0]) / 60000 : 0,
    wallAllMin: all.length ? (all[all.length - 1] - all[0]) / 60000 : 0,
    activeMainMin: activeMain / 60000, activeAllMin: active / 60000,
    mainModel, mainTurns: mainMsgs.length, peakMain: peak, main: tot(main), mainByModel: main, mainCost: cost(main),
    agentCalls, agentMissing, agentCallsByRequested, subagents: agentFiles.size, subCount, sub: tot(sub), subByModel: sub, subCost: cost(sub),
    subPeak, roles, agentsOut, wfRuns, wfCalls, resumes,
  };
}

// ---- run detection
// Rule implemented. A run STARTS at (a) a human slash-command record whose command-name is one of the tracked skills, or
// (b) an assistant Skill tool_use of a tracked skill. A tool-called re-invocation of the skill that is already open
// (no other tracked skill started in between) is folded into the open run (counted as reinvocations).
// Two END rules are computed for every run:
//   EXT  (extended, primary for interactive/long skills): next tracked-skill start by a different skill (human slash or
//        tool call; a tool-called skill inside an ORCHESTRATOR run is NESTED and does not end it), next human slash re-run of
//        the same skill, a human prompt arriving after >IDLE_MIN of silence in the main transcript, or session end.
//   TURN (turn-bounded, lower bound): EXT end, or the next real human prompt, whichever is first.
function detectRuns(P) {
  const { ev, lines } = P;
  const starts = ev.filter((x) => x.kind === 'start');
  const humans = ev.filter((x) => x.kind === 'human');
  const lastIdx = lines.length;
  const prevLineT = (i) => { for (let k = i - 1; k >= 0; k--) { const t = ts(lines[k]); if (Number.isFinite(t)) return t; } return NaN; };
  const keep = [];
  for (const st of starts) {
    const last = [...keep].reverse().find((k) => k.skill === st.skill);
    if (last && st.via === 'tool' && !starts.some((x) => x.i > last.i && x.i < st.i && x.skill !== st.skill)) { last.reinvocations = (last.reinvocations || 0) + 1; continue; }
    keep.push(st);
  }
  for (let k = 0; k < keep.length; k++) {
    const st = keep[k];
    let end = lastIdx, reason = 'session end';
    for (let j = k + 1; j < keep.length; j++) {
      const nx = keep[j];
      if (nx.skill === st.skill) { if (nx.via === 'cmd') { end = nx.i; reason = 'same skill re-run'; break; } continue; }
      if (nx.via === 'tool' && ORCHESTRATORS.has(st.skill)) continue;
      end = nx.i; reason = 'next skill: ' + nx.skill; break;
    }
    for (const h of humans) {
      if (h.i <= st.i) continue; if (h.i >= end) break;
      const gap = h.t - prevLineT(h.i);
      if (gap > IDLE_MIN * 60000) { end = h.i; reason = 'idle>' + IDLE_MIN + 'min before human prompt'; break; }
    }
    const h1 = humans.find((h) => h.i > st.i && !(h.i === st.i));
    let end1 = end, reason1 = reason;
    if (h1 && h1.i < end) { end1 = h1.i; reason1 = 'next human prompt'; }
    st.endExt = end; st.endReason = reason; st.end1 = end1; st.reason1 = reason1;
    const parent = keep.slice(0, k).reverse().find((p) => ORCHESTRATORS.has(p.skill) && p.skill !== st.skill && p.endExt > st.i);
    st.nestedIn = parent ? parent.skill : null;
    st.humanPrompts = humans.filter((h) => h.i > st.i && h.i < end).length;
    const sb = ev.find((x) => x.kind === 'skillbase' && x.i >= st.i && x.i < Math.min(end, st.i + 60));
    st.skillBase = sb ? sb.dir : null;
  }
  return keep;
}

function main() {
  const sessions = listSessions();
  const runs = [];
  const verifyRows = [];
  let scanned = 0;
  for (const S of sessions) {
    // cheap prefilter on raw text
    let raw; try { raw = fs.readFileSync(S.file, 'utf8'); } catch { continue; }
    if (!VERIFY && !/roadmap-planner|roadmap-tracker|roadmap-release|plan-coordinator|brainstorming|writing-plans|subagent-driven-development/.test(raw)) continue;
    raw = null; scanned++;
    const P = parseSession(S); const idx = agentIndex(S);
    if (VERIFY) {
      // whole session (main + every agent file) vs cost-state modelUsage
      const mainAll = dedupeAssistant(P.lines, (o) => !o.isSidechain);
      const tot = {};
      for (const o of mainAll) { const f = fam(o.message.model); (tot[f] ??= zero()); addUsage(tot[f], o.message.usage); }
      for (const f of idx.all) for (const [m, t] of Object.entries(summarizeAgent(f).byModel)) { (tot[m] ??= zero()); for (const k of Object.keys(t)) tot[m][k] += t[k]; }
      if (P.lastCost) verifyRows.push({ sid: S.sid.slice(0, 8), mine: tot, harness: P.lastCost.modelUsage, harnessCost: P.lastCost.totalCostUSD,
        agents: idx.all.length, wall: P.lastCost.totalDuration });
      continue;
    }
    const keep = detectRuns(P);
    for (const st of keep) {
      const M = metrics(P, idx, st.i, st.endExt);
      const M1 = metrics(P, idx, st.i, st.end1);
      const cost = M.mainCost + M.subCost, cost1 = M1.mainCost + M1.subCost;
      const wfInfo = M.wfRuns.map((w) => { const j = readWfJson(S, w); return j ? { id: w, status: j.status, durationMin: (j.durationMs || 0) / 60000, agentCount: j.agentCount, totalTokens: j.totalTokens, workflowName: j.workflowName, scriptPath: j.scriptPath, deliverables: j.args?.deliverables, mode: j.args?.mode, resultStatus: j.result?.status } : { id: w, status: 'no wf json' }; });
      const delivs = new Set(); for (const c of M.wfCalls) { const d = c.args?.deliverables; if (Array.isArray(d)) d.forEach((x) => delivs.add(x)); else if (d) delivs.add(String(d)); }
      const tasks = new Set(); for (const a of M.agentsOut) { const m = a.label.match(/^(E\d+):t(\d+)/); if (m) tasks.add(m[1] + ':t' + m[2]); }
      const t0 = P.lines.slice(st.i).map(ts).find(Number.isFinite);
      runs.push({
        skill: st.skill, via: st.via, date: new Date(t0 || 0).toISOString().slice(0, 10), start: new Date(t0 || 0).toISOString(),
        project: S.slug.replace(/^.*-AppData-Local-Temp-claude-[0-9a-f]+-[0-9a-f-]+-scratchpad-/, 'TMP:'), session: S.sid.slice(0, 8),
        skillBase: st.skillBase, nestedIn: st.nestedIn, endReason: st.endReason, reinvocations: st.reinvocations || 0,
        humanPrompts: st.humanPrompts, ext: M, turn: M1, cost, cost1,
        deliverables: [...delivs], tasks: tasks.size, wf: wfInfo,
        wfScripts: [...new Set(M.wfCalls.map((c) => path.basename(path.dirname(path.dirname(String(c.scriptPath || '')))) + '/' + path.basename(path.dirname(String(c.scriptPath || '')))))],
      });
    }
  }
  if (VERIFY) { fs.writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(verifyRows, null, 1)); console.log('verify rows', verifyRows.length); return; }
  runs.sort((a, b) => a.start.localeCompare(b.start));
  fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(runs, null, 1));
  const csv = ['skill,via,date,project,session,mainModel,nestedIn,endReason,humanPrompts,wallMainMin,wallAllMin,activeAllMin,mainTurns,peakMain,main_in,main_cw,main_cr,main_out,agentCalls,subagents,subHaiku,subSonnet,subOpus,sub_in,sub_cw,sub_cr,sub_out,mainCost,subCost,cost,cost_turn,deliverables,tasks,resumes,wfStatus'];
  for (const r of runs) { const e = r.ext;
    csv.push([r.skill, r.via, r.date, r.project, r.session, e.mainModel, r.nestedIn || '', r.endReason, r.humanPrompts, e.wallMainMin.toFixed(1), e.wallAllMin.toFixed(1), e.activeAllMin.toFixed(1), e.mainTurns, e.peakMain,
      e.main.input, e.main.cw, e.main.cr, e.main.output, e.agentCalls, e.subagents, e.subCount.haiku || 0, e.subCount.sonnet || 0, e.subCount.opus || 0, e.sub.input, e.sub.cw, e.sub.cr, e.sub.output,
      e.mainCost.toFixed(2), e.subCost.toFixed(2), r.cost.toFixed(2), r.cost1.toFixed(2), r.deliverables.join('+'), r.tasks, e.resumes, r.wf.map((w) => w.status).join('/')].join(',')); }
  fs.writeFileSync(path.join(OUT, 'runs.csv'), csv.join('\n'));
  console.log('sessions scanned', scanned, 'runs', runs.length);
}
main();
