import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPure } from './load-pure.mjs';
import { canon, fnv1a, sliceEnvelopes, MAX_COPY_BYTES, utf8Length, commandDigest } from '../../../lib/plan-digest.mjs';
import { truthDivergences, buildRead } from '../scripts/verify-run.mjs';
import { gitBash } from '../../../scripts/git-bash.mjs';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8').replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC);

const B1 = '3f2a9c1d8e7b6a5f4c3d2e1f0a9b8c7d6e5f4a3b';
const B2 = '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d';
const SB = '5b1e0c9a8d7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d'; // the spec blob of the recorded run and of the spec load
const GATES = [{ name: 'lint', cmd: 'npm run lint', kind: 'exit' }, { name: 'unit', cmd: 'npm test', kind: 'tests', needsLock: 'db' }];
const gm = (head, over = {}) => ({ headSha: head.padEnd(40, '0'), clean: true, changedFiles: ['src/a.js'], log: '', gates: [{ name: 'lint', ran: true, exit: 0 }, { name: 'unit', ran: true, exit: 0, total: 10, skipped: 0, failedNames: [], ...over }] });
const FULL = (s) => s.padEnd(40, '0');
const card = (id, extra = {}) => ({ id, deps: [], reqs: ['R1'], status: 'pronta', onTarget: false, mergeFound: false, critical: false, acceptance: [{ id: 'AC1', text: 'works' }], ...extra });

// The Workflow runtime's resume cache: an agent() call is keyed on (prompt, opts, previous key); while every call so far
// matched, a completed call returns its journaled result without running; the first miss and every call after it run live.
// start(killAt, ranFirst) begins one invocation; killAt (a label or a RegExp) is where the process dies: that call never finishes
// (with ranFirst it runs, so its side effects happen, but its result is never journaled) and later calls never run.
function makeJournal() {
  const results = new Map();
  return {
    start(killAt, ranFirst = false) {
      let prev = '', live = false, dead = false;
      const cached = [];
      return {
        cached,
        call: async (prompt, o, run) => {
          if (dead) throw new Error('process killed');
          const key = createHash('sha256').update(JSON.stringify([prev, prompt, o])).digest('hex');
          prev = key;
          if (!live && results.has(key)) { cached.push(o.label); return structuredClone(results.get(key)); } // a copy, as the runtime's serialized journal gives: the workflow edits what it receives
          live = true;
          if (killAt instanceof RegExp ? killAt.test(o.label) : o.label === killAt) { if (ranFirst) await run(); dead = true; throw new Error('process killed'); }
          const v = await run();
          if (!dead) results.set(key, structuredClone(v));
          return v;
        },
      };
    },
  };
}

// The JSON of `spec-tool emit` for the card of E (acceptance copied from the card the way the tool derives it).
const PURE_X = loadPure();
const TOOL_PATH = '/p/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs';
function specEmitOf(E, { acceptance, rulings = [], needsPerson = [], removedTests }) {
  const items = acceptance.map((a) => {
    const t = PURE_X.parseVerifyTag(a.text);
    const at = String(a.text).lastIndexOf('{verify:');
    const bare = at === -1 ? String(a.text).trim() : String(a.text).slice(0, at).trim();
    return { id: a.id, text: a.text, verify: t && !t.invalid ? { kind: t.kind, blq: t.blq || null, evidence: t.evidence } : null, textWithoutTag: bare };
  });
  return JSON.stringify({ tool: 'spec-tool', schema: 'spec/1', path: 'x', data: { id: E, title: 't', mode: 'unattended', acceptance: items, rulings, needsPerson, externalEffects: [], edgeCases: [], ...(removedTests ? { removedTests } : {}) } });
}
// ---- E8 T6: an old transcribed plan ({ planBlob, ac, tasks: [{ n, title, tier, reviewTier, files, needsLock, external, externalDedupe, noCommit }] }) becomes the plan-tool emit the plan load returns.
const OLD_DEFAULT_PLAN = { planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] };
// A score whose recalculated route has the old tier (and reviewTier) for the task's files, found by search over the lib route.
function scoreFor(t) {
  const files = { create: [], modify: t.files || [], test: [] };
  const wantTier = ['haiku', 'sonnet', 'opus'].includes(t.tier) ? t.tier : 'sonnet';
  const wantReview = t.reviewTier === 'opus' || wantTier === 'opus' ? 'opus' : 'sonnet';
  const wantEffort = wantTier === 'haiku' ? 'low' : 'medium';
  let fallback = null;
  for (let a = 0; a < 3; a++) for (let r = 0; r < 3; r++) for (let b = 0; b < 3; b++) for (let v = 0; v < 3; v++) {
    const score = { ambiguity: a, reasoning: r, blast: b, verifiability: v };
    const got = libRoute({ score, files, external: t.external === true }, { hasDependents: false });
    if (got.tier !== wantTier) continue;
    if (got.reviewTier === wantReview && got.effort === wantEffort) return score;
    if (!fallback && got.reviewTier === wantReview) fallback = score;
  }
  return fallback || { ambiguity: 1, reasoning: 1, blast: 1, verifiability: 0 };
}
function planLoadOf(old, E, over = {}) {
  const tasks = old.tasks.map((t) => ({
    n: t.n, title: t.title, files: { create: [], modify: t.files || [], test: [] }, locks: t.needsLock || [], external: t.external,
    externalDedupe: t.externalDedupe === undefined ? null : t.externalDedupe, noCommit: t.noCommit === true, deps: [], score: scoreFor(t),
  }));
  const evidence = (old.ac || []).map((a) => ({ ac: a.ac, kind: a.kind, command: a.command === undefined ? null : a.command, testRef: a.testRef === undefined ? null : a.testRef, blq: a.blq === undefined ? null : a.blq, external: a.external, externalDedupe: a.externalDedupe === undefined ? null : a.externalDedupe }));
  const emit = planEmitOf({ id: E, roadmap: 'docs/plans/roadmap-x/', tasks, evidence, removedTests: old.removedTests });
  return { checkExit: 0, checkStdout: '{}', emitExit: 0, emitStdout: JSON.stringify(emit), blob: old.planBlob, head: 'a1', clean: true, ...over };
}

const np = (o) => ({ id: 'P1', blocking: false, ...o });
const specLoadOk = (E, o) => ({ checkExit: 0, checkStdout: '{}', emitExit: 0, emitStdout: specEmitOf(E, o), clean: true, head: 'a1', blob: SB });
const ruling = (o) => ({ id: 'R1', decision: 'Use X.', alternative: 'Y', costIfWrong: 'low', reversible: true, scope: 'local', contradicts: null, ...o });
const specWith = (o, E = 'E1', acceptance = [{ id: 'AC1', text: 'works' }]) => (l) => (/:spec-load\d$/.test(l) ? specLoadOk(E, { acceptance, ...o }) : undefined);
// What the tracker CLI answers to an add-decision it has already seen (same text, same deliverable): the same id, existing: true.
const seenDecisions = new Map();
// Decisions the owner ratified between runs: pending-decisions no longer lists them, add-decision still answers existing: true.
const ratifiedDecisions = new Set();
// Answers of the record stage as the CLI would give them: the commands come from the numbered lines of the prompt.
const cliJson = (over = {}) => JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, errors: [], warnings: [], changed: [], result: {}, ...over });
// E10 T6: the status write goes through `verify-run.mjs group <payload>` (a script-runner call) and the final check through `verify-run.mjs check <payload>`;
// the payload is encodeURIComponent(JSON) in ONE argument. promptCommands reads the steps of the decoded group payload (the commands of docs and of the re-read stay numbered lines).
const verifyArg = (prompt, mode) => { const m = new RegExp(`verify-run\\.mjs" ${mode} (\\S+)`).exec(prompt); return m ? JSON.parse(decodeURIComponent(m[1])) : null; };
const promptCommands = (prompt) => { const g = verifyArg(prompt, 'group'); return g ? g.steps : [...prompt.matchAll(/^\d+\. (node ".*)$/gm)].map((m) => m[1]); };
// The prompt with the group payload replaced by its decoded steps, numbered the way the old record prompt listed them.
const plain = (prompt) => prompt.replace(/(verify-run\.mjs" read )(\S+)/, (_, a, b) => a + '<read payload of ' + JSON.parse(decodeURIComponent(b)).deliverable + '>').replace(/(verify-run\.mjs" group )(\S+)/, (_, a) => a + '\n' + promptCommands(prompt).map((c, i) => `${i + 1}. ${c}`).join('\n'));
const signedOut = (o) => JSON.stringify({ ...o, digest: fnv1a(JSON.stringify(canon(o))) });
// What verify-run.mjs group prints for the commands the agent ran ({ exit, stdout } each): it stops at the first exit other than 0.
function groupStdout(prompt, results, nonce = verifyArg(prompt, 'group').nonce) {
  const steps = [];
  let stopped = null;
  for (const r of results) { steps.push({ n: steps.length + 1, exit: r.exit, out: r.stdout }); if (r.exit !== 0) { stopped = { n: steps.length, exit: r.exit }; break; } }
  return signedOut({ tool: 'verify-run', mode: 'group', nonce, steps, stopped, commit: true, head: 'abc1234' });
}
// What verify-run.mjs check prints: the divergences come from truthDivergences over the payload, as the script computes them.
const TRUTH_OK = { targetHead: 'm2', clean: true, lastGoodReachable: true, mergedIds: ['E1'], claims: [{ id: 'E1', commit: 'e1', reachable: true }] };
function checkStdout(prompt, truth = TRUTH_OK) {
  const p = verifyArg(prompt, 'check');
  const divergences = truthDivergences(truth, p.reported, p.claims, p.target, p.lastGood, p.integBroken);
  return signedOut({ tool: 'verify-run', mode: 'check', nonce: p.nonce, ok: divergences.length === 0, divergences, truth });
}
const reportOf = (prompt, truth) => ({ report: 'REPORT', truthStdout: verifyArg(prompt, 'check') ? checkStdout(prompt, truth) : '' });
// E41 B2: the stdout of slice k of text as the script prints it (a slice out of range is the script's refusal).
const sliceStdout = (head, text, k) => { const envs = sliceEnvelopes(head, text); return JSON.stringify(k < envs.length ? envs[k] : { tool: head.tool, error: `slice ${k} does not exist` }); };
const sliceNo = (prompt) => Number((/ --slice (\d+)/.exec(prompt) || [0, '0'])[1]);
// What verify-run.mjs read prints for the raw stdouts of the five commands ({ status, brief, pendingDecisions, head, porcelain }): the reduction is the script's own, printed as the slice of the payload.
const readOf = (p, raw) => {
  const o = (stdout) => ({ exit: 0, stdout: String(stdout == null ? '' : stdout) });
  return buildRead({ status: o(raw.status), brief: o(raw.brief), pending: o(raw.pendingDecisions), head: o(raw.head), porcelain: o(raw.porcelain) }, p.deliverable);
};
const readStdout = (prompt, raw) => { const p = verifyArg(prompt, 'read'); return sliceStdout({ tool: 'verify-run', mode: 'read', nonce: p.nonce }, JSON.stringify(canon(readOf(p, raw))), p.slice === undefined ? 0 : p.slice); };
const isRead = (l) => /(:status-.*-read|:docs-read\d)(-slice\d+)?(-retry\d)?$/.test(l);
function makeRecordMock(cardsOf) {
  const st = {};
  let decN = 900;
  const init = (E) => {
    if (st[E]) return st[E];
    const cell = (cardsOf().find((c) => c.id === E) || {}).status || '';
    const labelled = /:/.test(cell);
    const m = /code:\s*([^;(]*)/.exec(cell);
    return (st[E] = { label: labelled ? 'code' : '', word: labelled ? (m ? m[1].trim() : '') : cell.replace(/\s*\(.*$/, ''), note: '', decisionIds: [] });
  };
  return {
    state: st,
    run(prompt, E) {
      const x = init(E);
      const runs = promptCommands(prompt).map((command) => {
        const verb = /^node "[^"]*" (\S+)/.exec(command)[1];
        let over = {};
        if (verb === 'set-status') x.word = /set-status '[^']*' '[^']*' '([^']*)'/.exec(command)[1];
        if (verb === 'block-open') { x.word = 'blocked'; x.note = 'BLQ-9'; over = { result: { id: 'BLQ-9' }, changed: ['state.md'] }; }
        if (verb === 'add-decision') {
          const key = E + '|' + command;
          if (seenDecisions.has(key)) over = { result: { id: seenDecisions.get(key), existing: true }, changed: [] };
          else { const id = 'DEC-' + decN++; seenDecisions.set(key, id); x.decisionIds.push(id); over = { result: { id, existing: false }, changed: ['decisions.md'] }; }
        }
        return { command, exit: 0, stdout: cliJson(over) };
      });
      return { runs };
    },
    read(E) {
      const x = init(E);
      return {
        status: cliJson({ result: { panel: [{ id: E, segments: [{ label: x.label, word: x.word, note: x.note }] }] } }),
        brief: cliJson({ result: { checker: { errors: 0, warnings: 0, stale: false } } }),
        pendingDecisions: cliJson({ result: { decisions: [...new Set([...x.decisionIds, ...seenDecisions.values()])].filter((id) => !ratifiedDecisions.has(id)).map((id) => ({ id })) } }),
        head: 'abc1234',
        porcelain: '',
      };
    },
  };
}

// E10 T5: the discovery is the stdout of `preflight.mjs discover`, signed the way the script signs it (canon/fnv1a of lib/plan-digest.mjs) over { nonce, data }.
const discStdout = (nonce, data) => JSON.stringify({ tool: 'release-discovery', nonce, digest: fnv1a(JSON.stringify(canon({ nonce, data }))), data });
const nonceOf = (prompt) => (/--nonce '([^']*)'/.exec(prompt) || [])[1];
// E41 B2: the discovery is read in signed slices (discover --slice k); discSlices is the stdout of the slice the prompt asks for.
const discSlices = (prompt, data) => sliceStdout({ tool: 'release-discovery', command: 'discover', nonce: nonceOf(prompt) }, JSON.stringify(canon(data)), sliceNo(prompt));
const isDisc = (l) => /^discovery(-redo)?(-slice\d+)?(-retry\d)?$/.test(l);

// E41 B2 T2: a measure answered without capture gets, per gate, the JSON line capture.mjs would print: the nonce (by index), the task and the command (shq undone) are read in the capture lines of the prompt.
const CAP_LINE = /^\s*node "[^"]*\/capture\.mjs" run --nonce (\S+) --task (\S+)( --tests)? --cwd .* --bash ('(?:[^']|'\\'')*')\s*$/gm;
const unshq = (q) => q.slice(1, -1).split("'\\''").join("'");
function captureLine(l, def, g) {
  const base = { tool: 'capture', nonce: l.nonce, task: l.task, cmdDigest: commandDigest({ bash: l.bash }), exit: g.exit, bytes: 0, sha256: '0', lines: 0, path: 'p', stderrBytes: 0, stderrSha256: '0', stderrPath: 'q', tail: '', tailCut: 0 };
  const extract = l.tests ? { format: Number.isInteger(g.total) ? 'node-tap' : 'unknown', exit: g.exit, total: Number.isInteger(g.total) ? g.total : null, pass: null, fail: null, skipped: Number.isInteger(g.skipped) ? g.skipped : 0, failedNames: g.failedNames || [], failedNamesCut: 0 } : undefined;
  return signedOut(extract ? { ...base, extract } : base);
}
function withCapture(prompt, m, gatesCfg) {
  if (!m || !Array.isArray(m.gates) || m.gates.some((g) => g && g.capture !== undefined)) return m;
  const lines = [...prompt.matchAll(CAP_LINE)].map((x) => ({ nonce: x[1], task: x[2], tests: !!x[3], bash: unshq(x[4]) }));
  const gates = [];
  for (const l of lines) {
    const def = gatesCfg.find((d) => d.cmd === l.bash);
    const g = def && m.gates.find((x) => x && x.name === def.name);
    if (g && g.ran !== false) gates.push({ ...g, capture: captureLine(l, def, g) });
  }
  return { ...m, gates };
}
// E43: a read-back prompt hands the script-runner `capture.mjs line`; by default the script refuses it with the nonce and the task asked.
const LINE_CMD = /capture\.mjs" line --nonce (\S+) --task (\S+) --cwd /;
function lineRefusal(prompt) {
  const [, nonce, task] = LINE_CMD.exec(prompt);
  return { exit: 1, stdout: JSON.stringify({ tool: 'capture', command: 'line', nonce, task, error: `no signed line with this nonce in pt-evidence/${task}` }) };
}
// E41 B2 T4: the spec and plan loads run each command by capture.mjs run (and read a cut output by capture.mjs slice). A test still answers the first label
// (spec-load<k>, plan-load<k>) with the old load answer { checkExit, checkStdout, emitExit, emitStdout, blob, head, clean }; the answers of the labels
// that follow (-emit, -blob, -head, -porcelain, -<name>-slice<j>) are made from it: the JSON line capture.mjs prints and the slice envelopes of its text.
const LOAD_LABEL = /^(E\d+:(?:spec|plan)-load\d)(?:-(check|emit|blob|head|porcelain))?(-slice\d+)?(-retry\d)?$/;
const loadTexts = (t) => ({ check: [t.checkExit, t.checkStdout], emit: [t.emitExit, t.emitStdout], blob: [t.blob ? 0 : 128, t.blob], head: [0, t.head], porcelain: [0, t.clean === false ? ' M x' : ''] });
function loadAnswer(prompt, name, t) {
  const [exit, raw] = loadTexts(t)[name];
  const text = raw == null ? '' : String(raw);
  const m = /capture\.mjs" run --nonce (\S+) --task (\S+) --cwd (?:'[^']*'|\S+) -- (.*)$/m.exec(prompt);
  const argv = [...m[3].matchAll(/'((?:[^']|'\\'')*)'/g)].map((x) => x[1].split("'\\''").join("'"));
  const lines = text === '' ? 0 : text.split('\n').length;
  const base = { tool: 'capture', nonce: m[1], task: m[2], cmdDigest: commandDigest({ argv }), exit, bytes: utf8Length(text), sha256: createHash('sha256').update(text, 'utf8').digest('hex'), lines, path: `/wt/pt-evidence/${m[2]}/${name}.txt`, stderrBytes: 0, stderrSha256: '0', stderrPath: 'q' };
  const whole = signedOut({ ...base, tail: text, tailCut: 0 });
  return { exit, stdout: utf8Length(whole) <= MAX_COPY_BYTES ? whole : signedOut({ ...base, tail: '', tailCut: lines }) };
}
function loadSlice(prompt, name, t) {
  const text = loadTexts(t)[name][1];
  return { exit: 0, stdout: sliceStdout({ tool: 'capture', command: 'slice', nonce: / --nonce (\S+)/.exec(prompt)[1] }, text == null ? '' : String(text), sliceNo(prompt)) };
}
// over(label, prompt, opts) may return a value (including null) to override the default answer.
async function exec({ cards, over, deliverables, config = {}, args = {}, discOver = {}, budget = { total: null }, journal = null }) {
  const calls = [];
  const planOf = {};
  const recMock = makeRecordMock(() => (typeof cards === 'function' ? cards() : cards));
  const agent = (prompt, o) => (journal ? journal.call(prompt, o, () => liveAgent(prompt, o)) : liveAgent(prompt, o));
  // E8 T6: a test still answers the plan author (and the plan fixer) with the old transcribed plan; the plan load then returns the plan-tool emit of that plan.
  const liveAgent = async (prompt, o) => {
    let v = await answerOf(prompt, o);
    const gatesCfg = config.gates || GATES;
    if (v && typeof v === 'object' && Array.isArray(v.gates)) v = withCapture(prompt, v, gatesCfg);
    else if (v && typeof v === 'object' && o.label === 'preflight' && v.baseline && !v.recorded) v = { ...v, baseline: withCapture(prompt, v.baseline, gatesCfg) };
    const id = (/^(E\d+):/.exec(o.label) || [])[1];
    if (/:plan(-fix\d+)?$/.test(o.label) && v && typeof v === 'object' && Array.isArray(v.tasks) && v.tasks.length) { planOf[id] = v; return 'plan written'; }
    // The workflow only trusts a full 40-hex headSha on an evidence measure; the fixtures name short commits.
    if (v && typeof v === 'object' && Array.isArray(v.results) && typeof v.headSha === 'string') return { ...v, headSha: v.headSha.padEnd(40, '0') };
    return v;
  };
  const loads = new Map();
  const answerOf = async (prompt, o) => {
    const lm = LOAD_LABEL.exec(o.label);
    if (lm && (lm[2] || lm[3])) {
      const t = loads.get(lm[1]);
      if (!t) throw new Error('unmocked load step ' + o.label);
      calls.push({ label: o.label, prompt, opts: o }); // every answered call counts, the derived load steps too
      return lm[3] ? loadSlice(prompt, lm[2] || 'check', t) : loadAnswer(prompt, lm[2], t);
    }
    const v = await answerRaw(prompt, o);
    const shaped = lm && v && typeof v === 'object' && Number.isInteger(v.checkExit) && Number.isInteger(v.emitExit);
    if (!shaped) return v;
    loads.set(lm[1], v);
    return loadAnswer(prompt, 'check', v);
  };
  const answerRaw = async (prompt, o) => {
    const l = o.label;
    calls.push({ label: l, prompt, opts: o });
    if (over) { const v = over(l, prompt, o); if (v !== undefined) return v && typeof v === 'object' && isRead(l) && 'status' in v && !('stdout' in v) ? { exit: 0, stdout: readStdout(prompt, v) } : v; }
    const E = (/^(E\d+):/.exec(l) || [])[1];
    if (isDisc(l)) return { exit: 0, stdout: discSlices(prompt, { repo: '/r', today: '2026-11-09', roadmapDir: 'docs/plans/roadmap-x/', strategy: 'docs/plans/roadmap-x/s.md', checker: 'docs/plans/roadmap-x/check.mjs', integrationBranch: 'main', target: 'integracao/x', checkerExists: true, roadmapSlug: 'x', deliverableStatuses: ['a', 'b', 'c', 'd', 'e'], integratedStatuses: ['integrada', 'publicada', 'medida'], language: '', cards: typeof cards === 'function' ? cards() : cards, pendingDecisions: [], ...discOver }) };
    if (l === 'discovery-donot') return { donotHolds: [] };
    if (l === 'preflight') return { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', baseline: gm('abc1234') };
    if (/:setup$/.test(l)) return { ok: true, worktree: `/wt/${E}`, baseCommit: 'b1', head: 'a1', clean: true, taskCommits: 0, committedTasks: [], nativeSpec: false, nativePlan: false };
    if (/:spec$/.test(l)) return 'spec written';
    if (/:spec-load\d$/.test(l)) return specLoadOk(E, { acceptance: ((typeof cards === 'function' ? cards() : cards).find((c) => c.id === E) || {}).acceptance || [] });
    if (/:spec-commit$/.test(l)) return { ok: true, head: 'a1', commit: 'c1' };
    if (/:plan$/.test(l)) return { planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] };
    if (/:plan-load\d$/.test(l)) return planLoadOf(planOf[E] || OLD_DEFAULT_PLAN, E);
    if (/:plan-commit$/.test(l)) return { ok: true, head: 'a1', commit: 'c1', blob: (planOf[E] || OLD_DEFAULT_PLAN).planBlob }; // the commit agent returns the blob of the plan it committed
    if (/plan-review/.test(l)) return { issues: [], headSha: 'a1', clean: true, commitsInRange: 2, measuredPlanBlob: B1 };
    // A task review counts what git shows: for a launched external task, launch..HEAD holds the started mark, the task commit and the completion mark.
    if (/:t\d+:(spec|quality)\d+$/.test(l)) return { issues: [], headSha: 'a1', clean: true, commitsInRange: 3 };
    if (/spec-review|:t\d+:(spec|quality)|:final-/.test(l)) return { issues: [], headSha: 'a1', clean: true, commitsInRange: 2 };
    if (/:impl$/.test(l)) return { status: 'DONE', summary: 's', checks: [{ command: 'x', output: 'y', exit: 0 }] };
    if (/:status-.*-read(-slice\d+)?(-retry\d)?$/.test(l)) return { exit: 0, stdout: readStdout(prompt, recMock.read(E)) };
    if (/:docs-read\d(-slice\d+)?(-retry\d)?$/.test(l)) return { exit: 0, stdout: readStdout(prompt, { ...recMock.read(E), pendingDecisions: '', head: 'm2' }) };
    if (/:status-/.test(l)) return { exit: 0, stdout: groupStdout(prompt, recMock.run(prompt, E).runs) };
    if (/:progress$/.test(l)) return { head: 'h0', clean: true, done: [] };
    if (/:sync$/.test(l)) return { ok: true, head: 'a2', conflictsResolved: 0, targetTip: 'abc1234', deltaFiles: [] };
    if (/:resync$/.test(l)) return { ok: true, head: 'a2', conflictsResolved: 0, targetTip: 'def5678', deltaFiles: ['src/x.js'] };
    if (/test-integrity$/.test(l)) return { deletedTests: [], removedAsserts: 0, skipsAdded: 0, prodChanged: 1, assertsAdded: 1 };
    if (/:reread-g\d+(-retry\d)?$/.test(l)) return lineRefusal(prompt);
    if (/merge-gates/.test(l)) return gm('e1');
    if (/gates\d/.test(l) && !/fix/.test(l)) return gm(/:regates/.test(l) ? 'a3' : 'a2');
    if (/:evidence/.test(l)) return { headSha: /:evidence1/.test(l) ? 'a2' : 'a3', clean: true, results: [{ ac: 'AC1', command: 'npm test -- a', exit: 0 }] };
    if (/:pre-merge$/.test(l)) return { head: 'abc1234', clean: true, branchHasTarget: false, branchMerged: false };
    if (/:delta-review/.test(l)) return { issues: [], headSha: 'a3', clean: true, commitsInRange: 0 };
    if (/:merge$/.test(l)) return { mergeCommit: FULL('e1'), firstParent: 'abc1234', secondParent: 'a3', conflicts: 0, clean: true };
    if (/:docs\d$/.test(l)) return recMock.run(prompt, E);
    if (/:docs-measure/.test(l)) return { measureOk: true, measureDetails: '' };
    if (/:merge-fix-probe$/.test(l)) return { commits: [], rangeOk: true };
    if (/:merge-locate$/.test(l)) return { mergeSha: 'e0', rangeOk: true, secondParent: 'b9', branchTip: 'b9' };
    if (/:resume-fix-review$/.test(l)) return { issues: [], headSha: 'e9', clean: true, commitsInRange: 1 };
    if (/:merge-risks$/.test(l)) return { head: 'e1', commit: 'e1' };
    if (/:cleanup$/.test(l)) return { ok: true };
    if (/:prune-evidence$/.test(l)) return { exit: 0, stdout: JSON.stringify({ tool: 'capture', command: 'prune', removed: [] }) }; // what the script-runner returns for capture.mjs prune
    if (/:rollback/.test(l)) return { ok: true, head: 'abc1234', clean: true };
    if (l === 'report') return reportOf(prompt);
    if (/:resume-review-log$/.test(l)) return { found: true, acceptedRisks: [], humanInputs: [] };
    if (/:awaiting-person$/.test(l)) return { ok: true };
    if (/:launching$/.test(l)) return { ok: true, head: 'L1' };
    if (/:effect-completed$/.test(l)) return { ok: true };
    if (/:merge-effects$/.test(l)) return { head: 'e1', commit: 'e1' };
    if (/review-log/.test(l)) return 'ok';
    throw new Error('unmocked ' + l);
  };
  const parallel = (ts) => Promise.all(ts.map((t) => t().catch(() => null)));
  const r = await run({ config: { gates: GATES, locks: ['db'], projectContext: '', install: 'npm ci', generated: true, ...config }, deliverables, targetBranch: 'integracao/x', today: '2026-11-09', runToken: 'pf-test', wtRoot: '/wt', trackerCli: TOOL_PATH, ...args },
    agent, parallel, () => {}, () => {}, budget);
  return { r, calls, labels: calls.map((c) => c.label) };
}

// E41 B2 T2: the measure prompts hand the agent one capture line per gate, with a safe nonce and the command quoted for the shell.
test('E41 B2 T2: a gate with a space in the name and a single quote in the command gets a capture line with a safe nonce and a shq command', async () => {
  const def = { name: 'unit tests', cmd: "node -e 'process.exit(0)'", kind: 'exit' };
  const gm2 = (h) => ({ headSha: FULL(h), clean: true, changedFiles: ['src/a.js'], log: '', gates: [{ name: 'unit tests', ran: true, exit: 0 }] });
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { gates: [def], locks: [] },
    over: (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', baseline: gm2('abc1234') } : /merge-gates/.test(l) ? gm2('e1') : /gates\d/.test(l) && !/fix/.test(l) ? gm2(/:regates/.test(l) ? 'a3' : 'a2') : undefined) });
  assert.equal(r.results[0].merged, true);
  const measured = calls.filter((c) => c.label === 'preflight' || /gates\d/.test(c.label)).filter((c) => /capture\.mjs/.test(c.prompt));
  assert.ok(measured.length >= 3, measured.map((c) => c.label).join(','));
  for (const c of measured) {
    const lines = [...c.prompt.matchAll(CAP_LINE)];
    assert.equal(lines.length, 1, c.label);
    const [, nonce, task, tests, quoted] = lines[0];
    assert.match(nonce, /^[A-Za-z0-9:._@-]{1,160}$/, c.label);
    assert.match(nonce, /:g0$/);
    assert.match(task, /^[A-Za-z0-9._-]+-gates$/);
    assert.ok(!tests, 'an exit gate takes no --tests');
    assert.equal(quoted, PURE_X.shq(def.cmd));
    assert.equal(unshq(quoted), def.cmd);
    assert.ok(!c.prompt.includes('capture.mjs" run --nonce unit'), 'the nonce never holds the raw gate name');
    assert.match(lines[0][0], / --cwd (?:'[^']*'|"[^"]*") --brief --bash /, c.label);
    assert.ok(c.prompt.includes(`- unit tests (exit): ${def.cmd} (no test counts; the capture line is still required, copied literally)\n`), c.label);
    assert.ok(!c.prompt.includes('only name, ran and exit matter'), c.label);
    assert.ok(c.prompt.includes('The capture line has no output: take them from the file at its path (Read, offset/limit).'), c.label);
  }
  assert.match(calls.find((c) => c.label === 'preflight').prompt, /--task preflight-gates /);
  assert.match(calls.find((c) => c.label === 'preflight').prompt, /with "<integration worktree>" replaced by the integration worktree path of step 2 \(keep the double quotes\) and nothing else changed/);
  assert.match(calls.find((c) => c.label === 'E1:gates1').prompt, /run the line under it, unchanged/);
  assert.match(calls.find((c) => c.label === 'E1:gates1').prompt, /--task E1-gates /);
});

test('E41 B2 T2: a tests gate runs capture with --tests and a measure whose gate has no valid capture line is retried once and then an infra failure', async () => {
  let n = 0;
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (/^E1:gates1-2(-retry)?$/.test(l) ? (n++, { ...gm('a2'), gates: gm('a2').gates.map((g) => ({ ...g, capture: 'nothing' })) }) : undefined) });
  assert.equal(r.results[0].merged, false);
  assert.ok(labels.includes('E1:gates1-2-retry'), labels.join(','));
  assert.equal(n, 2);
  const unit = calls.find((c) => c.label === 'E1:gates1-2').prompt;
  assert.match(unit, / --tests --cwd /);
  assert.doesNotMatch(calls.find((c) => c.label === 'E1:gates1-1').prompt, / --tests /);
});

// E43 AC2: a capture line the workflow refuses, or an omitted gate, is read back with capture.mjs line without measuring the gates again.
// What line prints for the gate def: the signed line with the nonce and the task of the prompt; over changes them (a line of another run or command).
const reread = (prompt, def, g = { exit: 0 }, over = {}) => {
  const [, nonce, task] = LINE_CMD.exec(prompt);
  return { exit: 0, stdout: captureLine({ nonce, task, bash: def.cmd, tests: def.kind === 'tests', ...over }, def, g) };
};
const UNIT_COUNTS = { exit: 0, total: 10, skipped: 0, failedNames: [] };
const preflightOf = (baseline) => ({ ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', baseline });
// A measure whose capture lines were miscopied: digest and cmdDigest changed.
const miscopied = (prompt, m) => {
  const x = withCapture(prompt, m, GATES);
  return { ...x, gates: x.gates.map((g) => ({ ...g, capture: JSON.stringify({ ...JSON.parse(g.capture), cmdDigest: 'ffffffff', digest: 'ffffffff' }) })) };
};
const unreadable = (m) => ({ ...m, gates: m.gates.map((g) => ({ ...g, capture: 'nothing' })) });
const rereads = (calls) => calls.filter((c) => c.label.includes(':reread-'));
const invalidBaseline = (r) => r.operatorActions.find((o) => o.kind === 'preflight:baseline-invalid');

test('E43 AC2: a tampered preflight capture is read back and the baseline is accepted without a second measure', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => {
    if (l === 'preflight') return preflightOf(miscopied(p, gm('abc1234')));
    const m = /^preflight:reread-g(\d)$/.exec(l);
    return m ? reread(p, GATES[m[1]], UNIT_COUNTS) : undefined;
  } });
  assert.equal(invalidBaseline(r), undefined, JSON.stringify(r.operatorActions));
  assert.equal(r.results[0].merged, true);
  assert.equal(calls.filter((c) => c.label === 'preflight').length, 1);
  const back = rereads(calls);
  assert.deepEqual(back.map((c) => c.label), ['preflight:reread-g0', 'preflight:reread-g1']);
  for (const [i, c] of back.entries()) {
    assert.ok(c.prompt.includes(`node "/p/productivity-tools/scripts/capture.mjs" line --nonce ${LINE_CMD.exec(c.prompt)[1]} --task preflight-gates --cwd '/wt/_integracao'\n`), c.prompt);
    assert.match(LINE_CMD.exec(c.prompt)[1], new RegExp(`:preflight:g${i}$`));
    assert.doesNotMatch(c.prompt, /capture\.mjs" run /);
    assert.deepEqual({ agentType: c.opts.agentType, phase: c.opts.phase, model: c.opts.model, effort: c.opts.effort }, { agentType: 'productivity-tools:script-runner', phase: 'Preflight', model: 'haiku', effort: 'low' });
  }
});

test('E43 AC2: a wrong copy on a branch gate is read back and no retry measure runs', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => {
    if (l === 'E1:gates1-2') return miscopied(p, gm('a2'));
    return l === 'E1:gates1-2:reread-g0' ? reread(p, GATES[1], UNIT_COUNTS) : undefined;
  } });
  assert.ok(!labels.includes('E1:gates1-2-retry'), labels.join(','));
  assert.equal(r.results[0].merged, true);
  const back = rereads(calls);
  assert.deepEqual(back.map((c) => c.label), ['E1:gates1-2:reread-g0']);
  assert.ok(back[0].prompt.includes(` --task E1-gates --cwd '/wt/E1'\n`), back[0].prompt);
});

test('E43 AC2: a read-back of another nonce or cmdDigest is refused with both reasons', async () => {
  const cases = [
    [{ nonce: 'other:nonce' }, /gate lint missing from the measure: the output is not JSON; reread: the nonce of the output is not the one of this run, expected \S+:preflight:g0, got other:nonce/],
    [{ bash: 'npm run other' }, /gate lint missing from the measure: the output is not JSON; reread: the output is not from the expected command, expected \w+, got \w+/],
  ];
  for (const [over, why] of cases) {
    const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => {
      if (l === 'preflight') return preflightOf(unreadable(gm('abc1234')));
      const m = /^preflight:reread-g(\d)(-retry\d)?$/.exec(l);
      return m ? reread(p, GATES[m[1]], UNIT_COUNTS, over) : undefined;
    } });
    assert.equal(r.status, 'needs-operator');
    assert.match(invalidBaseline(r).what, why);
  }
  // on a branch gate the refused read-back leaves today's path: the retry measure runs and is read back too
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => {
    if (/^E1:gates1-2(-retry)?$/.test(l)) return unreadable(gm('a2'));
    return /^E1:gates1-2(-retry)?:reread-g0(-retry\d)?$/.test(l) ? reread(p, GATES[1], UNIT_COUNTS, { nonce: 'other:nonce' }) : undefined;
  } });
  assert.equal(r.results[0].merged, false);
  assert.ok(labels.includes('E1:gates1-2-retry'), labels.join(','));
  assert.ok(labels.includes('E1:gates1-2-retry:reread-g0'), labels.join(','));
});

test('E43 AC2: an omitted gate is accepted only when it needs no agent counts', async () => {
  const [lint, unit] = gm('abc1234').gates;
  const ok = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => {
    if (l === 'preflight') return preflightOf({ ...gm('abc1234'), gates: [unit] });
    return l === 'preflight:reread-g0' ? reread(p, GATES[0]) : undefined;
  } });
  assert.equal(invalidBaseline(ok.r), undefined, JSON.stringify(ok.r.operatorActions));
  assert.equal(ok.r.results[0].merged, true);
  assert.deepEqual(rereads(ok.calls).map((c) => c.label), ['preflight:reread-g0']);
  const out = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => {
    if (l === 'preflight') return preflightOf({ ...gm('abc1234'), gates: [lint] });
    return /^preflight:reread-g1(-retry\d)?$/.test(l) ? reread(p, GATES[1]) : undefined; // no total: the extract format is unknown
  } });
  assert.ok(invalidBaseline(out.r), JSON.stringify(out.r.operatorActions));
  assert.ok(!out.r.operatorActions.some((o) => o.kind === 'preflight:red-baseline'));
  assert.match(invalidBaseline(out.r).what, /gate unit missing from the measure: no capture line; reread: the gate needs the agent's counts/);
  assert.deepEqual(rereads(out.calls).map((c) => c.label), ['preflight:reread-g1']);
});

test('E43 AC2: the read-back stops on a refusal with its nonce and otherwise tries 5 times', async () => {
  const bases = ['preflight', 'E1:gates1-2', 'E1:gates1-2-retry'];
  const run = (answer, badPre) => exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => {
    if (badPre && l === 'preflight') return preflightOf(unreadable(gm('abc1234')));
    if (!badPre && /^E1:gates1-2(-retry)?$/.test(l)) return unreadable(gm('a2'));
    return answer && l.includes(':reread-') ? answer : undefined;
  } });
  // a refusal with the nonce asked (the default answer): one call per gate in each measure
  const pre = await run(null, true);
  assert.deepEqual(rereads(pre.calls).map((c) => c.label), ['preflight:reread-g0', 'preflight:reread-g1']);
  assert.match(invalidBaseline(pre.r).what, /the output is not JSON; reread: capture refused: no signed line with this nonce in pt-evidence\/preflight-gates/);
  const branch = await run(null, false);
  assert.deepEqual(rereads(branch.calls).map((c) => c.label), bases.slice(1).map((b) => `${b}:reread-g0`));
  // a usage error has no nonce, and a stdout that is not JSON says nothing: 5 tries per gate in each measure
  const usage = { exit: 2, stdout: JSON.stringify({ tool: 'capture', error: 'bad usage' }) };
  for (const [answer, why] of [[usage, /reread: capture refused: bad usage/], [{ exit: 1, stdout: 'boom' }, /reread: the output is not JSON/], [{ exit: 1, stdout: '' }, /reread: no capture line/]]) {
    for (const badPre of [true, false]) {
      const x = await run(answer, badPre);
      const gates = badPre ? ['preflight:reread-g0', 'preflight:reread-g1'] : bases.slice(1).map((b) => `${b}:reread-g0`);
      const back = rereads(x.calls);
      assert.deepEqual(back.map((c) => c.label), gates.flatMap((g) => [g, ...[2, 3, 4, 5].map((t) => `${g}-retry${t}`)]));
      assert.deepEqual(back.map((c) => `${c.opts.model}/${c.opts.effort}`), gates.flatMap(() => ['haiku/low', 'haiku/low', 'sonnet/medium', 'sonnet/medium', 'sonnet/medium']));
      if (badPre) assert.match(invalidBaseline(x.r).what, why);
    }
  }
});

test('E43 AC2: nothing is read back without a rejected capture', async () => {
  const none = (x, name) => assert.deepEqual(rereads(x.calls).map((c) => c.label), [], name);
  const happy = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(happy.r.results[0].merged, true);
  none(happy, 'happy path');
  // a recorded baseline is never read back, whatever copy the preflight returns with it
  const prep = { targetHead: FULL('abc1234'), gatesKey: PURE_X.fnv1a(JSON.stringify(PURE_X.canon(GATES))), baseline: gm('abc1234') };
  const recorded = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'preflight' ? { ...preflightOf(unreadable(gm('abc1234'))), recorded: JSON.stringify(prep) } : undefined) });
  assert.equal(recorded.r.results[0].merged, true);
  none(recorded, 'recorded');
  const foreign = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignNoBase });
  assert.equal(foreign.r.status, 'needs-operator');
  none(foreign, 'unauthorized foreign checkout');
  const notRun = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => {
    if (l !== 'preflight') return undefined;
    const m = withCapture(p, gm('abc1234'), GATES);
    return preflightOf({ ...m, gates: [{ name: 'lint', ran: false, exit: -1 }, m.gates.find((g) => g.name === 'unit')] });
  } });
  assert.ok(notRun.r.operatorActions.some((o) => o.kind === 'preflight:red-baseline'), JSON.stringify(notRun.r.operatorActions)); // lint stays as reported: not run, exit -1
  none(notRun, 'ran false');
});

test('happy path merges, persists the log before the re-sync gates, and cleanup is scoped', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(r.results[0].merged, true);
  assert.ok(labels.indexOf('E1:review-log-resync') > labels.indexOf('E1:delta-review1'));
  assert.ok(labels.indexOf('E1:review-log-resync') < labels.indexOf('E1:regates1-1'));
  const clean = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.match(clean, /_tmp\/E1-"?\*/);
  assert.doesNotMatch(clean, /_tmp\/E1\*/);
  assert.match(clean, /-dirty/);
  assert.match(clean, /diff --binary HEAD/);
});

test('E33: the cleanup runs procs with the worktree and the port range of the deliverable, and its leftovers reach concerns even with ok: true', async () => {
  const leftovers = ['pid 4242: Access is denied.', 'pid 60 listens on port 5203 in the range, but neither it nor an ancestor carries the worktree path: not ended'];
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:cleanup' ? { ok: true, leftovers } : undefined) });
  const p = verifyArg(calls.find((c) => c.label === 'E1:cleanup').prompt, 'procs');
  const { digest, ...payload } = p;
  assert.deepEqual(payload, { nonce: `${fnv1a('pf-test')}:E1:procs`, wt: '/wt/E1', ports: [5200, 5209] });
  assert.equal(digest, fnv1a(JSON.stringify(canon(payload))));
  assert.equal(r.results[0].merged, true);
  assert.ok(r.results[0].concerns.includes(`incomplete cleanup: ${leftovers.join(', ')}`), JSON.stringify(r.results[0].concerns));
  // nothing left over: no concern
  const clean = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:cleanup' ? { ok: true, leftovers: [] } : undefined) });
  assert.ok(!clean.r.results[0].concerns.some((c) => /incomplete cleanup/.test(c)));
});

test('sync schema requires deltaFiles and targetTip', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const sync = calls.find((c) => c.label === 'E1:sync').opts.schema;
  assert.ok(sync.required.includes('deltaFiles') && sync.required.includes('targetTip'));
});

test('a merge whose second parent is not the validated head is rolled back', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (/:merge$/.test(l) ? { mergeCommit: FULL('e1'), firstParent: 'abc1234', secondParent: 'zzz9999', conflicts: 0, clean: true } : undefined) });
  assert.equal(r.results[0].merged, false);
  assert.match(r.results[0].error, /second parent/);
  assert.ok(labels.includes('E1:rollback'));
});

test('incident: a 36-char headSha on the first branch gates measure is retried and the full SHA is accepted by gates and evidence', async () => {
  const FULL = 'a2'.padEnd(40, '1');
  let first = true;
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => {
      if (l === 'E1:gates1-1' && first) { first = false; return { ...gm(FULL), headSha: FULL.slice(0, 36) }; }
      if (/^E1:gates1-/.test(l)) return gm(FULL);
      if (l === 'E1:evidence1') return { headSha: FULL, clean: true, results: [{ ac: 'AC1', command: 'npm test -- a', exit: 0 }] };
      return undefined;
    } });
  assert.ok(labels.includes('E1:gates1-1-retry'), labels.join(','));
  assert.ok(!labels.includes('E1:evidence1-retry'));
  assert.equal(r.results[0].failKind, undefined, r.results[0].error);
  assert.equal(r.results[0].merged, true);
});

test('gates-fix review is logged and the log is committed before re-measuring', async () => {
  let n = 0;
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => {
      if (l === 'E1:gates1-2' && n++ === 0) return gm('a2', { exit: 1, failedNames: ['new'] });
      if (l === 'E1:gates-fix1') return { status: 'DONE', summary: 'f', checks: [] };
      if (l === 'E1:gates-fix1-review') return { issues: [{ severity: 'minor', description: 'm' }], headSha: 'a2b', clean: true, commitsInRange: 1 };
      if (/^E1:gates2-/.test(l)) return gm('a2c');
      if (l === 'E1:evidence1') return { headSha: 'a2c', clean: true, results: [{ ac: 'AC1', command: 'npm test -- a', exit: 0 }] };
      return undefined;
    } });
  assert.equal(r.results[0].merged, true);
  const fixAt = labels.indexOf('E1:gates-fix1-review');
  assert.ok(labels.indexOf('E1:review-log-gates') > fixAt);
  assert.ok(labels.indexOf('E1:review-log-gates') < labels.indexOf('E1:gates2-1'));
});

test('a null review-log agent is recorded as a concern', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/review-log/.test(l) ? null : undefined) });
  assert.ok(r.results[0].concerns.some((c) => /review log/.test(c)));
});

test('finish-merge: unvalidated merge on the target sets integBroken, is reported merged, and stops later merges', async () => {
  const unfinished = card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'e0' });
  const { r } = await exec({ cards: [unfinished, card('E2')], deliverables: ['E1', 'E2'],
    over: (l) => {
      if (/^E1:merge-gates1/.test(l)) return gm('e0', { exit: 1, failedNames: ['new'] });
      if (l === 'E1:merge-fix') return null;
      return undefined;
    } });
  const e1 = r.results.find((x) => x.id === 'E1');
  const e2 = r.results.find((x) => x.id === 'E2');
  assert.equal(e1.merged, true);
  assert.equal(e1.broken, true);
  assert.equal(e2.merged, false);
  assert.ok(e2.skipped);
  assert.ok(r.operatorActions.some((o) => o.deliverable === 'E1'));
});

// I6 (a) of the assertion map: the check output the report agent copied, confirmed by tool, nonce and digest, with a validated-tip divergence becomes an operator action.
test('E10 AC2: a confirmed check with a validated-tip divergence becomes a divergence operator action', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l, prompt) => (l === 'report' ? reportOf(prompt, { targetHead: 'm2', clean: true, mergedIds: ['E1'], claims: [{ id: 'E1', commit: 'e1', reachable: true }] }) : undefined) });
  assert.ok(r.operatorActions.some((o) => o.kind === 'divergence' && /validated tip/.test(o.what)));
  assert.equal(r.truth.targetHead, 'm2', 'the truth of the result is the one of the confirmed output');
});

test('E10 AC2: a check output that is null, unsigned or copied wrong is the null git truth agent', async () => {
  const nullText = 'the git truth agent returned nothing: verify the target branch by hand';
  const cases = {
    'a null report': () => null,
    'an empty truthStdout': () => ({ report: 'REPORT', truthStdout: '' }),
    'a wrong digest': (prompt) => ({ report: 'REPORT', truthStdout: checkStdout(prompt).replace('"ok":true', '"ok":false') }),
    'another nonce': (prompt) => ({ report: 'REPORT', truthStdout: checkStdout(prompt.replace(/(verify-run\.mjs" check )\S+/, (_, a) => a + encodeURIComponent(JSON.stringify({ ...verifyArg(prompt, 'check'), nonce: 'old' })))) }),
  };
  for (const [name, fn] of Object.entries(cases)) {
    const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, prompt) => (l === 'report' ? fn(prompt) : undefined) });
    const d = r.operatorActions.filter((o) => o.kind === 'divergence');
    assert.equal(d.length, 1, name);
    assert.equal(d[0].what, nullText, name);
    assert.equal(r.truth, null, name);
  }
});

test('E10 AC2: plan-only runs no verification and the report call carries no check', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' } });
  const rep = calls.find((c) => c.label === 'report');
  assert.doesNotMatch(rep.prompt, /verify-run\.mjs/);
  assert.ok(!r.operatorActions.some((o) => o.kind === 'divergence'));
  assert.equal(r.truth, null);
  assert.equal(r.report, 'REPORT');
});

const unfinished = () => card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'e0' });
test('item 9: a resumed merge keeps the human act of the card tag', async () => {
  const c = card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'e0', acceptance: [{ id: 'AC1', text: 'ok {verify: human; evidence: owner approves}' }] });
  const { r } = await exec({ cards: [c], deliverables: ['E1'] });
  const act = r.operatorActions.find((o) => o.kind === 'human-act' && o.deliverable === 'E1');
  assert.ok(act);
  assert.match(act.what, /AC1/);
  assert.equal(r.ownerReview.criteriaOpen[0].ac, 'AC1');
  assert.equal(r.ownerReview.criteriaOpen[0].kind, 'human');
});

test('item 9: accepted risks of the review log come back on resume', async () => {
  const { r } = await exec({ cards: [unfinished()], deliverables: ['E1'],
    over: (l) => (/:resume-review-log$/.test(l) ? { found: true, acceptedRisks: [{ stage: 'final', severity: 'critical', category: 'defeito', description: 'd' }], humanInputs: [] } : undefined) });
  assert.equal(r.ownerReview.acceptedRisks.length, 1);
  assert.equal(r.ownerReview.acceptedRisks[0].id, 'E1');
});

test('item 9: a null review-log agent is a concern', async () => {
  const { r } = await exec({ cards: [unfinished()], deliverables: ['E1'], over: (l) => (/:resume-review-log$/.test(l) ? null : undefined) });
  assert.ok(r.results[0].concerns.some((c) => /review log not read/.test(c)));
});

const fixCommits = { commits: [{ sha: 'f1', subject: 'E1 merge-fix: x' }], rangeOk: true };
const resume = (over) => exec({ cards: [unfinished(), card('E2')], deliverables: ['E1', 'E2'], over });

test('finish-merge with merge-fix commits: approved review closes ok', async () => {
  const { r, labels, calls } = await resume((l) => (/:merge-fix-probe$/.test(l) ? fixCommits : undefined));
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.merged, true);
  assert.ok(!e1.broken);
  assert.ok(labels.includes('E1:resume-fix-review'));
  assert.equal(calls.find((c) => c.label === 'E1:resume-fix-review').opts.model, 'opus');
  assert.ok(labels.indexOf('E1:resume-fix-review') < labels.indexOf('E1:merge-gates1-1') || labels.indexOf('E1:resume-fix-review') < labels.indexOf('E1:merge-gates1'));
});

test('finish-merge with merge-fix commits: rejected review stays broken, names the commits, stops E2', async () => {
  const { r } = await resume((l) => {
    if (/:merge-fix-probe$/.test(l)) return fixCommits;
    if (/:resume-fix-review$/.test(l)) return { issues: [{ severity: 'critical', category: 'defeito', description: 'masks a test' }], headSha: 'e9', clean: true, commitsInRange: 1 };
    return undefined;
  });
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.merged, true);
  assert.equal(e1.broken, true);
  assert.ok(r.results.find((x) => x.id === 'E2').skipped);
  assert.ok(r.operatorActions.some((o) => o.deliverable === 'E1' && /f1/.test(o.what + o.doNow)));
});

test('finish-merge with merge-fix commits: null review stays broken', async () => {
  const { r } = await resume((l) => {
    if (/:merge-fix-probe$/.test(l)) return fixCommits;
    if (/:resume-fix-review$/.test(l)) return null;
    return undefined;
  });
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.broken, true);
  assert.ok(r.results.find((x) => x.id === 'E2').skipped);
});

test('finish-merge without merge-fix commits proceeds and runs no review', async () => {
  const { r, labels } = await resume();
  assert.equal(r.results.find((x) => x.id === 'E1').merged, true);
  assert.ok(!labels.includes('E1:resume-fix-review'));
});

test('E41 T1 F1: a validated finish-merge prunes the capture evidence of the deliverable without a concern', async () => {
  const { r, calls } = await resume();
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.merged, true);
  assert.ok(!e1.broken);
  const prune = calls.filter((c) => c.label === 'E1:prune-evidence');
  assert.equal(prune.length, 1, 'the prune call runs once on the finish-merge path');
  assert.match(prune[0].prompt, /scripts\/capture\.mjs" prune --task-prefix 'E1-' --cwd /);
  assert.ok(!e1.concerns.some((c) => /capture evidence not pruned/.test(c)), e1.concerns.join('; '));
});

test('finish-merge with a null probe stays broken', async () => {
  const { r } = await resume((l) => (/:merge-fix-probe$/.test(l) ? null : undefined));
  assert.equal(r.results.find((x) => x.id === 'E1').broken, true);
});

test('mergeFound without mergeSha sets integBroken', async () => {
  const c = card('E1', { status: 'executando', onTarget: true, mergeFound: true });
  const { r } = await exec({ cards: [c, card('E2')], deliverables: ['E1', 'E2'] });
  assert.equal(r.results.find((x) => x.id === 'E1').broken, true);
  assert.ok(r.results.find((x) => x.id === 'E2').skipped);
});

test('cleanup creates the dirty folder and removes the worktree only after the patch', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.match(p, /mkdir -p [^ ]*E1-dirty/);
  assert.ok(p.indexOf('mkdir -p') < p.indexOf('worktree remove'));
  assert.match(p, /only after the patch/i);
});

// Line 366 of the assertion map: the git truth is measured by the check script (lastGoodReachable is checked in verify-run.test.mjs); the report schema carries its copied stdout.
test('the report schema requires truthStdout and its prompt starts with the check command', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const rep = calls.find((c) => c.label === 'report');
  assert.ok(rep.opts.schema.required.includes('report') && rep.opts.schema.required.includes('truthStdout'));
  assert.match(rep.prompt, /verify-run\.mjs" check /);
  assert.ok(rep.prompt.indexOf('verify-run.mjs" check') < rep.prompt.indexOf('Write the EXECUTION REPORT'), 'the check runs before any file is written');
  assert.ok(!calls.some((c) => c.label === 'git-truth'));
});

const probeWith = (commits, extra = {}) => (l) => (/:merge-fix-probe$/.test(l) ? { commits, rangeOk: true, ...extra } : undefined);
const e1Of = (r) => r.results.find((x) => x.id === 'E1');
const reviewOf = (over) => (l) => (/:resume-fix-review$/.test(l) ? { issues: [], headSha: 'e9', clean: true, commitsInRange: 2, ...over } : undefined);
const both = (...fs) => (l, p, o) => { for (const f of fs) { const v = f(l, p, o); if (v !== undefined) return v; } return undefined; };

test('finish-merge: a fix commit with a non-prefixed subject is reviewed; the probe does not filter by subject', async () => {
  const { r, labels, calls } = await resume(probeWith([{ sha: 'f7', subject: 'hotfix the parser' }]));
  assert.ok(labels.includes('E1:resume-fix-review'));
  assert.match(calls.find((c) => c.label === 'E1:resume-fix-review').prompt, /f7/);
  const probe = calls.find((c) => c.label === 'E1:merge-fix-probe').prompt;
  assert.match(probe, /--first-parent/);
  assert.match(probe, /--no-merges/);
  assert.doesNotMatch(probe, /--grep/);
  assert.match(probe, /:!docs\/plans\/roadmap-x\//);
  assert.match(probe, /:!docs\//);
  assert.equal(e1Of(r).merged, true);
});

test('finish-merge: commits of another deliverable are dropped, the same deliverable counts', async () => {
  const other = await resume(probeWith([{ sha: 'o1', subject: 'E2 merge-fix: y' }]));
  assert.ok(!other.labels.includes('E1:resume-fix-review'));
  const same = await resume(probeWith([{ sha: 's1', subject: 'E1 T3: late fix' }]));
  assert.ok(same.labels.includes('E1:resume-fix-review'));
});

test('finish-merge: a reverted fix judged net-clean closes ok, and the review judges the net state at HEAD', async () => {
  const { r, calls } = await resume(both(probeWith([{ sha: 'f1', subject: 'bad fix' }, { sha: 'f2', subject: 'Revert "bad fix"' }]), reviewOf({})));
  assert.equal(e1Of(r).merged, true);
  assert.ok(!e1Of(r).broken && !e1Of(r).error);
  const p = calls.find((c) => c.label === 'E1:resume-fix-review').prompt;
  assert.match(p, /net state at HEAD/i);
  assert.match(p, /reverted or corrected/i);
});

test('finish-merge: rangeOk false or absent stays broken and runs no review', async () => {
  for (const extra of [{ rangeOk: false }, { rangeOk: undefined }]) {
    const { r, labels } = await resume(probeWith([], extra));
    assert.equal(e1Of(r).broken, true);
    assert.ok(!labels.includes('E1:resume-fix-review'));
  }
});

test('the probe schema requires rangeOk', async () => {
  const { calls } = await resume();
  assert.ok(calls.find((c) => c.label === 'E1:merge-fix-probe').opts.schema.required.includes('rangeOk'));
});

test('finish-merge: a review that read fewer commits than listed, or saw a dirty tree, does not approve', async () => {
  const two = [{ sha: 'f1', subject: 'a' }, { sha: 'f2', subject: 'b' }];
  for (const over of [{ commitsInRange: 0 }, { commitsInRange: 1 }, { clean: false }]) {
    const { r } = await resume(both(probeWith(two), reviewOf(over)));
    assert.equal(e1Of(r).broken, true, JSON.stringify(over));
  }
});

const mergedProbe = (l) => {
  if (/:pre-merge$/.test(l)) return { head: 'abc1234', clean: true, branchHasTarget: true, branchMerged: true };
  if (/merge-gates/.test(l)) return gm('abc1234');
  return undefined;
};

test('branchMerged: fixes after the located merge are reviewed and the located merge is used', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(mergedProbe, probeWith([{ sha: 'f1', subject: 'x' }]), reviewOf({ commitsInRange: 1 })) });
  assert.ok(labels.includes('E1:resume-fix-review'));
  assert.match(calls.find((c) => c.label === 'E1:merge-fix-probe').prompt, /e0\.\.HEAD/);
  assert.match(calls.find((c) => /:docs1$/.test(c.label)).prompt, /merge e0/);
  assert.equal(r.results[0].merged, true);
  assert.ok(!r.results[0].broken && !r.results[0].error);
});

test('branchMerged: a rejected fix stays broken; an unlocated merge stays broken', async () => {
  const rej = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(mergedProbe, probeWith([{ sha: 'f1', subject: 'x' }]), (l) => (/:resume-fix-review$/.test(l) ? { issues: [{ severity: 'critical', category: 'defeito', description: 'd' }], headSha: 'm', clean: true, commitsInRange: 1 } : undefined)) });
  assert.equal(rej.r.results[0].broken, true);
  const lost = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(mergedProbe, (l) => (/:merge-locate$/.test(l) ? { mergeSha: '', rangeOk: true } : undefined)) });
  assert.equal(lost.r.results[0].broken, true);
});

test('finish-merge: the integrity of the merge is measured on its own range and an alert breaks it', async () => {
  const { r, calls } = await resume((l) => (/:resume-test-integrity$/.test(l) ? { deletedTests: ['t/a.test.js'], removedAsserts: 0, skipsAdded: 0, prodChanged: 0, assertsAdded: 1 } : undefined));
  assert.equal(e1Of(r).broken, true);
  assert.ok(r.operatorActions.some((o) => o.deliverable === 'E1' && /t\/a\.test\.js/.test(o.what)));
  const p = calls.find((c) => c.label === 'E1:resume-test-integrity').prompt;
  assert.match(p, /e0\^1/);
  assert.match(p, /--detach/);
});

test('finish-merge: integrity off, null or unmeasured pushes a concern and does not fail', async () => {
  const off = await exec({ cards: [unfinished()], deliverables: ['E1'], config: { testIntegrity: false } });
  assert.equal(e1Of(off.r).merged, true);
  assert.ok(!e1Of(off.r).broken && !e1Of(off.r).error);
  assert.ok(e1Of(off.r).concerns.some((c) => /test-count floor/.test(c)));
  assert.ok(!off.labels.includes('E1:resume-test-integrity'));
  for (const v of [null, { deletedTests: [], removedAsserts: -1, skipsAdded: 0, prodChanged: 0, assertsAdded: 0 }]) {
    const { r } = await resume((l) => (/:resume-test-integrity$/.test(l) ? v : undefined));
    assert.equal(e1Of(r).merged, true);
    assert.ok(!e1Of(r).broken && !e1Of(r).error);
    assert.ok(e1Of(r).concerns.some((c) => /test-count floor/.test(c)));
  }
});

test('cleanup creates the dirty folder only when there is a patch and removes when none was needed', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.ok(p.indexOf('status --porcelain') < p.indexOf('mkdir -p'));
  assert.match(p, /no patch was needed/i);
});

const hardInteg = (l) => (/:resume-test-integrity$/.test(l) ? { deletedTests: ['t/a.test.js'], removedAsserts: 0, skipsAdded: 0, prodChanged: 0, assertsAdded: 1 } : undefined);
const resumeArgs = (args, over = hardInteg, config = {}) => exec({ cards: [unfinished()], deliverables: ['E1'], over, args, config });

test('finish-merge: heuristic-only integrity alerts close ok with a concern', async () => {
  const { r } = await resume((l) => (/:resume-test-integrity$/.test(l) ? { deletedTests: [], removedAsserts: 0, skipsAdded: 0, prodChanged: 2, assertsAdded: 0 } : undefined));
  assert.equal(e1Of(r).merged, true);
  assert.ok(!e1Of(r).broken && !e1Of(r).error);
  assert.ok(e1Of(r).concerns.some((c) => /no new assertion/.test(c)));
  assert.ok(r.results.find((x) => x.id === 'E2').merged);
});

test('finish-merge: removed assertions and added skips stay broken', async () => {
  for (const f of [{ removedAsserts: 1, skipsAdded: 0 }, { removedAsserts: 0, skipsAdded: 1 }]) {
    const { r } = await resume((l) => (/:resume-test-integrity$/.test(l) ? { deletedTests: [], prodChanged: 0, assertsAdded: 1, ...f } : undefined));
    assert.equal(e1Of(r).broken, true);
  }
});

test('acceptIntegrityAlerts with the matching deliverable and SHA closes ok with a concern naming the acceptance', async () => {
  const { r } = await resumeArgs({ acceptIntegrityAlerts: { E1: 'e0' } });
  assert.equal(e1Of(r).merged, true);
  assert.ok(!e1Of(r).broken && !e1Of(r).error);
  assert.ok(e1Of(r).concerns.some((c) => /operator/i.test(c) && /acceptIntegrityAlerts/.test(c) && /t\/a\.test\.js/.test(c)));
});

test('acceptIntegrityAlerts is ignored for another SHA, another deliverable, a SHA prefix or when it comes from config', async () => {
  const cases = [
    [{ acceptIntegrityAlerts: { E1: 'other' } }, {}],
    [{ acceptIntegrityAlerts: { E2: 'e0' } }, {}],
    [{ acceptIntegrityAlerts: { E1: 'm' } }, {}],
    [{}, { acceptIntegrityAlerts: { E1: 'e0' } }],
  ];
  for (const [args, config] of cases) {
    const { r } = await resumeArgs(args, hardInteg, config);
    assert.equal(e1Of(r).broken, true, JSON.stringify([args, config]));
  }
});

test('hard integrity alerts: the operator action offers the acknowledgement with the SHA, alongside revert; the run never sets it', async () => {
  const full = 'a'.repeat(40);
  const { r, calls } = await exec({ cards: [card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: full })], deliverables: ['E1'], over: hardInteg });
  const o = r.operatorActions.find((x) => x.deliverable === 'E1' && x.kind === 'merge-rejected');
  assert.match(o.doNow, /acceptIntegrityAlerts/);
  assert.ok(o.doNow.includes(full));
  assert.ok(o.doNow.includes('revert -m 1 ' + full));
  assert.equal(o.resumeWith.acceptIntegrityAlerts, undefined);
  assert.deepEqual(o.resumeWith.deliverables, ['E1']);
  assert.equal(r.resumeArgs.acceptIntegrityAlerts, undefined);
  const disc = calls.find((c) => c.label === 'discovery');
  // E10: the 40-character mergeSha is computed by the script (preflight.test.mjs, AC1); the workflow only dispatches it.
  assert.match(disc.prompt, /preflight\.mjs" discover/);
  assert.equal(disc.opts.agentType, 'productivity-tools:script-runner');
});

test('resume integrity: the temporary worktree is removed before the add and always after', async () => {
  const { calls } = await resume();
  const p = calls.find((c) => c.label === 'E1:resume-test-integrity').prompt;
  const add = p.indexOf('worktree add');
  assert.ok(p.indexOf('worktree remove --force') < add);
  assert.ok(p.lastIndexOf('worktree remove --force') > add);
  assert.match(p, /ignor\w+ errors/i);
  assert.match(p, /even if the program fails/i);
});

test('branchMerged: a located commit whose second parent is not the branch counts as not located', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(mergedProbe, (l) => (/:merge-locate$/.test(l) ? { mergeSha: 'e0', rangeOk: true, secondParent: 'zz', branchTip: 'b9' } : undefined)) });
  assert.equal(r.results[0].broken, true);
  assert.ok(!labels.includes('E1:merge-fix-probe'));
  const loc = calls.find((c) => c.label === 'E1:merge-locate');
  assert.ok(['secondParent', 'branchTip'].every((k) => loc.opts.schema.required.includes(k)));
});

test('result returns lastGood (the validated tip)', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(typeof r.lastGood, 'string');
  assert.ok(r.lastGood.length > 0);
});

const three = () => [unfinished(), card('E2'), card('E3')];
const breakE1 = (l) => { if (/^E1:merge-gates1/.test(l)) return gm('e0', { exit: 1, failedNames: ['new'] }); if (l === 'E1:merge-fix') return null; return undefined; };

test('C1: resumeArgs keeps a broken merge, so the next run validates it first', async () => {
  const { r } = await exec({ cards: three(), deliverables: ['E1', 'E2', 'E3'], over: breakE1 });
  assert.equal(e1Of(r).broken, true);
  assert.deepEqual(r.resumeArgs.deliverables, ['E1', 'E2', 'E3']);
});

test('C1: a run stops at selection when an interrupted merge is outside it, before any other agent', async () => {
  const { r, labels } = await exec({ cards: three(), deliverables: ['E2', 'E3'] });
  assert.equal(r.status, 'needs-operator');
  assert.deepEqual(labels, ['discovery']);
  const o = r.operatorActions.find((x) => x.kind === 'unfinished-merge');
  assert.equal(o.deliverable, 'E1');
  assert.deepEqual(o.resumeWith.deliverables, ['E1', 'E2', 'E3']);
});

test('C1: dry-run and plan-only do not merge, so they only note the interrupted merge', async () => {
  const dry = await exec({ cards: three(), deliverables: ['E2'], args: { mode: 'dry-run' } });
  assert.equal(dry.r.status, 'done');
  assert.ok(dry.r.selection.notes.some((n) => /E1/.test(n) && /interrupted/.test(n)));
  const plan = await exec({ cards: three(), deliverables: ['E2'], args: { mode: 'plan-only' } });
  assert.ok(!plan.r.operatorActions.some((x) => x.kind === 'unfinished-merge'));
  assert.ok(plan.labels.includes('E2:spec'));
});

const planAc = (ac, command = 'npm test -- a') => (l) => (/:plan$/.test(l) ? { planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac, kind: 'test', command, external: false }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] } : undefined);

test('I1: a plan row "AC1: text" is run as AC1 and an agent echo with spaces still counts', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(planAc('AC1: works'), (l) => (/:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'a2' : 'a3', clean: true, results: [{ ac: 'AC1', command: '  npm test -- a ', exit: 0 }] } : undefined)) });
  assert.equal(r.results[0].merged, true);
  const p = calls.find((c) => c.label === 'E1:evidence1').prompt;
  assert.match(p, /^AC1: npm test -- a$/m);
  assert.match(p, /verbatim/i);
});

test('I1: a command that was not run still fails the evidence', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { maxFixRounds: 0 }, over: (l) => (/:evidence/.test(l) ? { headSha: 'a2', clean: true, results: [{ ac: 'AC1', command: 'something else', exit: 0 }] } : undefined) });
  assert.equal(r.results[0].merged, false);
  assert.match(r.results[0].error, /command not run/);
});

test('I2: discovery returns the raw cell; blocked, discarded and segmented rows are read by the script', async () => {
  const cards = [card('E1', { status: 'blocked (BLQ-3)' }), card('E2', { status: 'discarded (DEC-007)' }), card('E3', { status: 'code: e; acceptance: blocked (BLQ-2)', onTarget: true, mergeFound: true, mergeSha: 'm' }), card('E4', { status: 'a' })];
  const { r, calls } = await exec({ cards, args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.deepEqual(r.selection.order, ['E4']);
  // E10: the raw cell is what the script returns (preflight.test.mjs); calls[0] is now its command.
  assert.match(calls[0].prompt, /preflight\.mjs" discover/);
});

test('I3: discovery requires the fields whose absence fails open', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' } });
  const s = calls[0].opts.schema;
  assert.deepEqual(s.required, ['exit', 'stdout']);  // the schema is the script-runner's; the fields are checked on the signed data
  for (const f of ['repo', 'mergeFound']) {  // wtRoot comes from the skill (FF/I4)
    const d = f === 'mergeFound' ? { cards: [{ ...card('E1'), mergeFound: undefined }] } : { repo: undefined };
    const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' }, discOver: d });
    assert.equal(x.r.status, 'error', f);
    assert.match(x.r.error, new RegExp(f), f);
  }
});

test('I3: a card without mergeFound, a selected card without criteria or no repo stop the run', async () => {
  const noFlag = card('E1'); delete noFlag.mergeFound;
  const a = await exec({ cards: [noFlag], deliverables: ['E1'] });
  assert.equal(a.r.status, 'error');
  assert.match(a.r.error, /mergeFound/);
  const b = await exec({ cards: [card('E1', { acceptance: [] }), card('E2')], deliverables: ['E1'] });
  assert.equal(b.r.status, 'error');
  assert.match(b.r.error, /E1/);
  assert.ok(!b.labels.includes('preflight'));
  const open = await exec({ cards: [card('E1'), card('E2', { acceptance: [] })], deliverables: ['E1'], args: { mode: 'dry-run' } });
  assert.notEqual(open.r.status, 'error');
  for (const discOver of [{ repo: undefined }]) assert.equal((await exec({ cards: [card('E1')], deliverables: ['E1'], discOver })).r.status, 'error');
});

test('item 5: discovery without integrationBranch stops the run, with targetBranch develop and no merge', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { targetBranch: 'develop' }, discOver: { integrationBranch: undefined } });
  assert.equal(r.status, 'error');
  assert.match(r.error, /integrationBranch/);
  assert.deepEqual(labels, ['discovery']);
});

test('item 5: each missing discovery field stops the run', async () => {
  const cases = [
    ['integratedStatuses', {}, { integratedStatuses: undefined }],
    ['deliverableStatuses', {}, { deliverableStatuses: undefined }],
    ['deliverableStatuses', {}, { deliverableStatuses: ['a', 'b'] }],
    ['roadmapDir', {}, { roadmapDir: undefined }],
    ['strategy', {}, { strategy: undefined }],
    ['checker', {}, { checker: undefined }],
    ['today', { today: undefined }, { today: undefined }],
  ];
  for (const [field, args, discOver] of cases) {
    const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args, discOver });
    assert.equal(r.status, 'error', field);
    assert.match(r.error, new RegExp(field), field);
    assert.deepEqual(labels, ['discovery'], field);
  }
});

test('E10 AC1: discovery dispatches the script-runner with preflight.mjs" discover', async () => {
  const { calls, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' } });
  const d = calls[0];
  assert.equal(labels[0], 'discovery');
  assert.equal(d.opts.agentType, 'productivity-tools:script-runner');
  assert.deepEqual(d.opts.schema.required, ['exit', 'stdout']);
  assert.equal(d.opts.model, 'haiku');
  assert.match(d.prompt, /node "\/p\/productivity-tools\/skills\/roadmap-release\/scripts\/preflight\.mjs" discover /);
  assert.match(d.prompt, /--prefix 'feat\/'/);  // the plan wrote --prefix pf-test: the run token goes in --nonce, the prefix is the branch prefix
  assert.match(d.prompt, /--nonce 'pf-test'/);
  assert.match(d.prompt, /--ref 'integracao\/x'/);
  assert.match(d.prompt, /--today '2026-11-09'/);
  assert.doesNotMatch(d.prompt, /\/wt|_integracao/);
  assert.ok(d.prompt.includes('SHELL: run each command exactly as written'));
  const p = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run', branchPrefix: 'pf-test', targetBranch: undefined, today: undefined } });
  assert.match(p.calls[0].prompt, /--prefix 'pf-test'/);
  assert.doesNotMatch(p.calls[0].prompt, /--ref|--today/);  // --ref only with PRE_TARGET, --today only with args.today
  const withCfg = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { releaseBranch: 'rel/x' }, args: { mode: 'dry-run', targetBranch: undefined } });
  assert.match(withCfg.calls[0].prompt, /--ref 'rel\/x'/);
});

test('a wrong digest retries up to 5 times and stops with discovery failed', async () => {
  const tampered = (l, p) => (/^discovery(-retry\d)?$/.test(l) ? { exit: 0, stdout: discSlices(p, { repo: '/r', today: '2026-11-09', cards: [card('E1')] }).replace(/("text":")(.)/, (m, q, c) => q + (c === 'A' ? 'B' : 'A')) } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: tampered });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /^discovery failed: .*digest/);
  const ds = x.calls.filter((c) => /^discovery/.test(c.label));
  assert.equal(ds.length, 5);
  assert.deepEqual(ds.map((c) => c.opts.model), ['haiku', 'haiku', 'sonnet', 'sonnet', 'sonnet']);
  assert.deepEqual(x.labels, ds.map((c) => c.label));
  // another nonce, another tool and a script error are not confirmed either; the fourth attempt is the first that can be confirmed
  let n = 0;
  const flaky = (l, p) => {
    if (l !== 'discovery' && !/^discovery-retry/.test(l)) return undefined;
    n++;
    if (n === 1) return { exit: 0, stdout: discSlices(p.replace(/--nonce '[^']*'/, "--nonce 'other'"), { cards: [] }) };
    if (n === 2) return { exit: 1, stdout: JSON.stringify({ tool: 'capture', error: 'no roadmap folder' }) };  // E37 T7: a refusal of the right tool stops; another tool's copy repeats
    if (n === 3) return { exit: 0, stdout: 'not json' };
    return undefined;
  };
  const y = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' }, over: flaky });
  assert.equal(y.r.status, 'done');
  assert.equal(y.calls.filter((c) => /^discovery/.test(c.label)).length, 4);
  assert.ok(y.calls.every((c) => nonceOf(c.prompt) === undefined || nonceOf(c.prompt) === 'pf-test'));
});


// E41 B2: a big roadmap is read in signed slices (discover --slice k, each answer within the copy limit), each by its own call; --page stays for the agy bridge.
const BIG = (n, extra = {}) => Array.from({ length: n }, (_, i) => card('E' + (i + 1), { title: 'T' + i + ' ' + 'x'.repeat(380), ...extra }));
const slicesOf = (cs) => sliceEnvelopes({ tool: 'release-discovery', command: 'discover', nonce: 'n' }, JSON.stringify(canon({ repo: '/r', today: '2026-11-09', roadmapDir: 'docs/plans/roadmap-x/', strategy: 'docs/plans/roadmap-x/s.md', checker: 'docs/plans/roadmap-x/check.mjs', integrationBranch: 'main', target: 'integracao/x', checkerExists: true, roadmapSlug: 'x', deliverableStatuses: ['a', 'b', 'c', 'd', 'e'], integratedStatuses: ['integrada', 'publicada', 'medida'], language: '', cards: cs, pendingDecisions: [] }))).length;

test('E41 B2: discovery in signed slices is read slice by slice and the cards are joined', async () => {
  const cs = BIG(14);
  const n = slicesOf(cs);
  assert.ok(n >= 3, 'slices ' + n);
  const x = await exec({ cards: cs, deliverables: ['E14'], args: { mode: 'dry-run' } });
  assert.equal(x.r.status, 'done');
  assert.deepEqual(x.labels.slice(0, n), ['discovery', ...Array.from({ length: n - 1 }, (_, i) => 'discovery-slice' + (i + 1))]);
  assert.deepEqual(x.r.selection.order, ['E14']);
  assert.match(x.calls[2].prompt, /preflight\.mjs" discover .* --slice 2\n/);
  assert.doesNotMatch(x.calls[0].prompt, /--page/);
});

test('E41 B2: a slice that is not the one asked for stops with discovery failed naming the slice', async () => {
  const cs = BIG(14);
  const wrong = await exec({ cards: cs, deliverables: ['E1'], over: (l, p) => (/^discovery-slice2/.test(l) ? { exit: 0, stdout: discSlices(p.replace('--slice 2', '--slice 1'), { repo: '/r', cards: cs }) } : undefined) });
  assert.equal(wrong.r.status, 'error');
  assert.match(wrong.r.error, /^discovery failed: slice 2: /);
  // a slice that never comes back as an envelope is tried 5 times, then the run stops
  const x = await exec({ cards: cs, deliverables: ['E1'], over: (l) => (/^discovery-slice1/.test(l) ? { exit: 0, stdout: 'not json' } : undefined) });
  assert.match(x.r.error, /^discovery failed: slice 1: the output is not JSON/);
  assert.equal(x.calls.filter((c) => /^discovery-slice1/.test(c.label)).length, 5);
});

test('discovery-donot only with donot items', async () => {
  const none = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' } });
  assert.ok(!none.labels.includes('discovery-donot'));
  const empty = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' }, discOver: { donot: [] } });
  assert.ok(!empty.labels.includes('discovery-donot'));
  const some = await exec({ cards: [card('E1', { title: 'Migrate X' }), card('E2', { title: 'Docs' })], deliverables: ['E1', 'E2'], args: { mode: 'dry-run' },
    discOver: { donot: ['do not migrate X'] },
    over: (l) => (l === 'discovery-donot' ? { donotHolds: [{ text: 'do not migrate X', affects: ['E1'] }] } : undefined) });
  const call = some.calls.find((c) => c.label === 'discovery-donot');
  assert.ok(call);
  assert.equal(some.labels.indexOf('discovery-donot'), 1);
  assert.equal(call.opts.model, 'sonnet');
  assert.match(call.prompt, /do not migrate X/);
  assert.match(call.prompt, /E1: Migrate X/);
  assert.deepEqual(call.opts.schema.required, ['donotHolds']);
  assert.ok(some.r.selection.notes.some((n) => /do not migrate X/.test(n)));
  assert.deepEqual(some.r.selection.order, ['E2'], 'the card the do-not item forbids does not run');
  assert.ok(some.r.selection.skippedUpfront.some((s) => s.id === 'E1'));
  const nul = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' }, discOver: { donot: ['do not migrate X'] }, over: (l) => (l === 'discovery-donot' ? null : undefined) });
  assert.equal(nul.r.status, 'error');
  assert.match(nul.r.error, /^discovery failed: /);
});

test('E10 R12: the selection never reads acceptance of an integrated or discarded card', async () => {
  const done = card('E1', { status: 'integrada', onTarget: true, mergeFound: true, mergeSha: 'a'.repeat(40), acceptance: [], acceptanceOmitted: true });
  const gone = card('E2', { status: 'discarded (DEC-007)', acceptance: [], acceptanceOmitted: true });
  const { r } = await exec({ cards: [done, gone, card('E3')], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.notEqual(r.status, 'error');
  assert.deepEqual(r.selection.order, ['E3']);
  assert.ok(!r.selection.order.some((id) => id !== 'E3'));
});

test('E10: checkRun confirms tool, nonce and digest, and encArg signs a payload in one argument', () => {
  const data = { cards: [{ id: 'E1' }], today: '2026-11-09' };
  const ok = PURE_X.checkRun(discStdout('n1', data), 'release-discovery', 'n1');
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.data, data);
  for (const [out, tool, nonce, why] of [
    [discStdout('n1', data), 'release-discovery', 'n2', /nonce/],
    [discStdout('n1', data), 'verify-run', 'n1', /verify-run/],
    [discStdout('n1', data).replace('2026-11-09', '2026-11-08'), 'release-discovery', 'n1', /digest/],
    ['not json', 'release-discovery', 'n1', /JSON/],
    ['', 'release-discovery', 'n1', /JSON/],
    [JSON.stringify({ tool: 'release-discovery', error: 'boom' }), 'release-discovery', 'n1', /boom/],
  ]) {
    const v = PURE_X.checkRun(out, tool, nonce);
    assert.equal(v.ok, false);
    assert.match(v.why, why);
  }
  const enc = PURE_X.encArg({ nonce: 'n', steps: ["a b", "it's (x)*!"] });
  assert.match(enc, /^[A-Za-z0-9\-_.~%]+$/);
  const { digest, ...rest } = JSON.parse(decodeURIComponent(enc));
  assert.equal(digest, fnv1a(JSON.stringify(canon(rest))));
  assert.deepEqual(rest, { nonce: 'n', steps: ['a b', "it's (x)*!"] });
});

// E10 (R15): the schema of the discovery is gone;the same fields are now checked on the signed data and each one stops the run naming it.
test('discovery stops naming each missing field', async () => {
  for (const f of ['cards', 'repo', 'integrationBranch', 'integratedStatuses', 'deliverableStatuses', 'today', 'roadmapDir', 'strategy', 'checker', 'language', 'pendingDecisions']) {
    const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { today: undefined }, discOver: { [f]: undefined } });
    assert.equal(r.status, 'error', f);
    assert.match(r.error, /^discovery failed: /, f);
    assert.match(r.error, f === 'cards' ? /no cards/ : new RegExp(f), f);
    assert.deepEqual(labels, ['discovery'], f);
  }
});

test('I3: args.repo wins over the discovered repo and stands in for it', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { repo: '/given' }, discOver: { repo: undefined } });
  assert.match(calls.find((c) => c.label === 'preflight').prompt, /git -C "\/given"/);
});

const redBase = (over) => (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', baseline: over } : undefined);

test('I5: a tests gate with total 0 is not offered acceptRedBaseline', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: redBase(gm('abc1234', { total: 0 })) });
  const o = r.operatorActions.find((x) => x.kind === 'preflight:red-baseline');
  assert.doesNotMatch(o.doNow, /acceptRedBaseline/);
  assert.match(o.doNow, /kind: exit/);
  assert.match(o.doNow, /unit/);
});

test('I5: another red gate keeps the offer', async () => {
  const b = gm('abc1234'); b.gates[0].exit = 1;
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: redBase(b) });
  assert.match(r.operatorActions.find((x) => x.kind === 'preflight:red-baseline').doNow, /acceptRedBaseline/);
});

test('m2: the docs are not ok when the panel does not show the status after the merge', async () => {
  const good = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(good.r.results[0].merge.docsOk, true);
  assert.equal(verifyArg(good.calls.find((c) => c.label === 'E1:docs-read1').prompt, 'read').deliverable, 'E1');
  assert.ok(!good.labels.includes('E1:docs-measure1'), 'no model measurement without docsStage.measure');
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/:docs-read\d/.test(l) ? { ...readWith('c'), head: 'm2' } : undefined) });
  assert.equal(r.results[0].merge.docsOk, false);
  assert.ok(r.operatorActions.some((o) => o.kind === 'docs'));
});

test('m4: paths are quoted in the docs measure, the integrity run and the cleanup', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { wtRoot: '/w t' }, over: (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/w t/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', baseline: gm('abc1234') } : undefined), config: { docsStage: { instructions: 'x', measure: 'm' } } });
  assert.ok(calls.find((c) => c.label === 'E1:docs-measure1').prompt.includes('node "/w t/_tmp/E1-docs-measure.cjs"'));
  assert.ok(calls.find((c) => c.label === 'E1:test-integrity').prompt.includes('node "/w t/_tmp/E1-integrity.cjs" "integracao/x"'));
  const clean = calls.find((c) => c.label === 'E1:cleanup').prompt;
  assert.ok(clean.includes('mkdir -p "/w t/_tmp/E1-dirty"'));
  assert.ok(clean.includes('> "/w t/_tmp/E1-dirty/cleanup.patch"'));
});

// A plan the reviewer keeps rejecting: the deliverable stops with a content defect (it replaces the old plan without the **Roadmap:** header, which the code no longer reads).
const noHeader = (l) => (/^E1:plan-review\d$/.test(l) ? { issues: [{ severity: 'critical', category: 'defeito', description: 'plan rejected' }], headSha: 'a1', clean: true, commitsInRange: 2, measuredPlanBlob: B1 } : /^E1:plan-fix\d$/.test(l) ? 'plan fixed' : undefined);

test('m5: the blocked status falls back to the default word of the roadmap formats', async () => {
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: noHeader });
  assert.ok(labels.includes('E1:status-blocked'));
});

test('m6: the report prompt carries the resume args without the config; the result keeps it', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { marker: 'ZZ-MARK' }, over: noHeader });
  const p = calls.find((c) => c.label === 'report').prompt;
  assert.doesNotMatch(p, /ZZ-MARK/);
  assert.match(p, /"deliverables":\["E1"\]/);
  assert.equal(r.operatorActions.find((o) => o.kind === 'defect').resumeWith.config.marker, 'ZZ-MARK');
  assert.equal(r.resumeArgs.config.marker, 'ZZ-MARK');
});

test('m7: reportPath is null when no report file was written', async () => {
  const ok = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(ok.r.reportPath, /E1-run\.md$/);
  const none = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'report' ? null : undefined) });
  assert.equal(none.r.reportPath, null);
  const broken = await exec({ cards: three(), deliverables: ['E1', 'E2', 'E3'], over: breakE1 });
  assert.equal(broken.r.reportPath, null);
});

test('m8: the inflight row is added by the CLI inflight-add command', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = plain(calls.find((c) => c.label === 'E1:status-d').prompt);
  assert.match(p, /inflight-add '[^']*' 'feat\/E1' --note '/);
  assert.doesNotMatch(p, /type: deliverable/);
});

test('m9: meta and selection messages are in English, and every phase used is declared', async () => {
  const titles = [...SRC.slice(0, SRC.indexOf('// roadmap-release workflow')).matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(titles, ['Discovery', 'Preflight', 'Setup', 'Spec', 'Plan', 'Implementation', 'Final review', 'Gates', 'Merge', 'Docs', 'Report']);
  const used = [...SRC.matchAll(/\bphase(?:\(|: )'([^']+)'/g)].map((m) => m[1]);
  assert.ok(used.length > 10);
  for (const t of used) assert.ok(titles.includes(t), t);
  assert.doesNotMatch(SRC.slice(0, SRC.indexOf('// roadmap-release workflow')), /[^\x00-\x7f]/);
  const un = await exec({ cards: [card('E1')], deliverables: ['E9'] });
  assert.match(un.r.error, /unknown deliverables: E9/);
});

const EXIT_LOSS = /replaces the panel row with the post-merge status/;

test('the selection stop states what the exit does to the panel row and the exact alternative', async () => {
  const { r } = await exec({ cards: three(), deliverables: ['E2', 'E3'] });
  const doNow = r.operatorActions.find((x) => x.kind === 'unfinished-merge').doNow;
  assert.match(doNow, EXIT_LOSS);
  assert.match(doNow, /blocker note or per-piece status/);
  assert.ok(doNow.includes('code: e; <the existing segments>'));
  const guide = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'operator.md'), 'utf8');
  assert.match(guide, EXIT_LOSS);
  assert.ok(guide.includes('code: <post-merge status>; <the existing segments>'));
});

test('the zero-test wording says an accepted red baseline is honoured but such a gate fails deliverables that add no tests', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: redBase(gm('abc1234', { total: 0 })) });
  const doNow = r.operatorActions.find((x) => x.kind === 'preflight:red-baseline').doNow;
  assert.match(doNow, /fails any deliverable that adds no tests/);
  assert.doesNotMatch(doNow, /cannot be accepted/);
  const cfg = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'references', 'config.md'), 'utf8');
  assert.match(cfg, /explicit .acceptRedBaseline. is honoured, but a .tests. gate with total zero fails any deliverable that adds no tests/);
  assert.doesNotMatch(cfg, /fails on every deliverable/);
});

test('authorizeExternal with a bad item stops the run before discovery', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E18:T04'] } });
  assert.equal(r.status, 'error');
  assert.match(r.error, /E18:T04/);
  assert.deepEqual(labels, []);
});

test('the plan prompt asks for external and externalDedupe and the plan review blocks a gap', async () => {
  const good = { planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }], tasks: [{ n: 1, title: 't', tier: 'sonnet', external: false }] };
  const { calls, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => {
      if (l === 'E1:plan') return { ...good, tasks: [{ n: 1, title: 't', tier: 'sonnet' }] };
      if (l === 'E1:plan-fix1') return good;
      return undefined;
    } });
  const p = calls.find((c) => c.label === 'E1:plan').prompt;
  assert.match(p, /externalDedupe/);
  assert.match(p, /when in doubt/i);
  assert.ok(labels.includes('E1:plan-fix1'));
});

// ---- external-effect authorization (Task 4)
const PU = loadPure();
const tk = (n, external, extra = {}) => ({ n, title: 't' + n, tier: 'sonnet', external, ...(external ? { externalDedupe: 'checks outbox.log first' } : {}), ...extra });
const planWith = (tasks) => ({ planPath: 'docs/p.md', planBlob: B1, roadmapHeader: true, ac: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }], tasks });
const fpOf = (tasks) => PU.planFingerprint(tasks, B1);
const ext = (r) => r.operatorActions.filter((a) => a.kind === 'authorize-external');
const withPlan = (tasks, more) => (l) => (l === 'E1:plan' ? planWith(tasks) : more ? more(l) : undefined);

test('external task without authorization stops the deliverable before the task and the others go on', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const fp = fpOf(tasks);
  const { r, labels } = await exec({ cards: [card('E1'), card('E2')], deliverables: ['E1', 'E2'], over: withPlan(tasks) });
  assert.ok(labels.includes('E1:t1:impl'));
  assert.ok(!labels.includes('E1:t2:impl'));
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.merged, false);
  assert.equal(e1.failKind, 'externo');
  assert.equal(r.results.find((x) => x.id === 'E2').merged, true);
  const a = ext(r);
  assert.equal(a.length, 1);
  assert.equal(a[0].deliverable, 'E1');
  assert.equal(a[0].item, 'E1:T2@' + fp);
  assert.deepEqual(a[0].resumeWith.authorizeExternal, ['E1:T2@' + fp]);
  assert.deepEqual(a[0].resumeWith.deliverables, ['E1']);
  assert.ok(!r.operatorActions.some((x) => x.kind === 'defect'));
  assert.ok(!labels.includes('E1:status-blocked'));
  assert.equal(r.status, 'needs-operator');
});

test('authorized external task runs and the authorization survives fix rounds', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  let n = 0;
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] },
    over: withPlan(tasks, (l) => (l === 'E1:t2:spec1' && n++ === 0 ? { issues: [{ severity: 'critical', category: 'defeito', description: 'x' }], headSha: 'a1', clean: true, commitsInRange: 2 } : l === 'E1:t2:spec-fix1' ? { status: 'DONE', summary: 'f', checks: [] } : undefined)) });
  assert.ok(labels.includes('E1:t2:impl'));
  assert.ok(labels.includes('E1:t2:spec-fix1'));
  assert.equal(ext(r).length, 0);
  const fix = calls.find((c) => c.label === 'E1:t2:spec-fix1').prompt;
  assert.match(fix, /The external effect of this task already ran \((the implementer reported it done)\): do not run it again, not even through its duplicate check; checks only read\. If this fix needs the effect run again, return NEEDS_HUMAN/);
  assert.doesNotMatch(fix, /perform the effect at most once/);
  assert.doesNotMatch(fix, /\$\{/);
  assert.match(calls.find((c) => c.label === 'E1:t2:impl').prompt, /checks outbox\.log first/);
  assert.match(calls.find((c) => c.label === 'E1:t1:impl').prompt, /Do NOT perform any external effect/);
});

test('a replanned task with another number does not inherit the authorization', async () => {
  const tasks = [tk(1, false), tk(2, false), tk(3, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] }, over: withPlan(tasks) });
  assert.equal(ext(r)[0].item, 'E1:T3@' + fpOf(tasks));
});

test('any replanned plan invalidates a bound authorization, even with the same task number', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2@00000000'] }, over: withPlan(tasks) });
  assert.ok(!labels.includes('E1:t2:impl'));
  assert.equal(ext(r)[0].item, 'E1:T2@' + fpOf(tasks));
});

test('same blob with retranscribed externalDedupe keeps the authorization; another blob holds', async () => {
  const first = [tk(1, false), tk(2, true, { externalDedupe: 'x' })];
  const auth = ['E1:T2@' + PU.planFingerprint(first, B1)];
  const resumed = [tk(1, false), tk(2, true, { externalDedupe: "'x'" })];
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: auth }, over: withPlan(resumed) });
  assert.ok(a.labels.includes('E1:t2:impl'));
  assert.equal(ext(a.r).length, 0);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: auth },
    over: (l) => (l === 'E1:plan' ? { ...planWith(resumed), planBlob: B2 } : /plan-review/.test(l) ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 2, measuredPlanBlob: B2 } : undefined) });
  assert.ok(!b.labels.includes('E1:t2:impl'));
  assert.equal(ext(b.r)[0].item, 'E1:T2@' + PU.planFingerprint(resumed, B2));
});

test('a plan review that measures another blob opens a gap and a missing measurement too', async () => {
  for (const m of [B2, undefined]) {
    const { labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
      over: (l) => (l === 'E1:plan-review1' ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 2, ...(m ? { measuredPlanBlob: m } : {}) } : undefined) });
    assert.ok(labels.includes('E1:plan-fix1'));
    assert.match(calls.find((c) => c.label === 'E1:plan-fix1').prompt, new RegExp(m ? B2 : 'did not measure'));
  }
  const c = (await exec({ cards: [card('E1')], deliverables: ['E1'] })).calls.find((x) => x.label === 'E1:plan-review1');
  assert.match(c.prompt, /measuredPlanBlob/);
});

test('every held external task of the plan is listed at the first stop', async () => {
  const tasks = [tk(1, false), tk(2, true), tk(3, true)];
  const fp = fpOf(tasks);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan(tasks) });
  assert.ok(!labels.includes('E1:t2:impl'));
  const a = ext(r);
  assert.deepEqual(a.map((x) => x.item), ['E1:T2@' + fp, 'E1:T3@' + fp]);
  assert.ok(a.every((x) => x.deliverable === 'E1'));
  assert.match(a[1].what, /t3/);
  assert.equal(r.results[0].held, 'E1:T2@' + fp);
});

test('a bare authorization comes back bound in resumeArgs', async () => {
  const tasks = [tk(1, false), tk(2, true), tk(3, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] }, over: withPlan(tasks, (l) => (l === 'E1:t2:impl' ? { status: 'BLOCKED', summary: 'stop' } : undefined)) });
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E1:T2@' + fpOf(tasks)]);
});

test('partial release: only the named item runs', async () => {
  const tasks = [tk(1, false), tk(2, true), tk(3, true)];
  const fp = fpOf(tasks);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] }, over: withPlan(tasks) });
  assert.ok(labels.includes('E1:t2:impl'));
  assert.ok(!labels.includes('E1:t3:impl'));
  const a = ext(r);
  assert.equal(a.length, 1);
  assert.equal(a[0].item, 'E1:T3@' + fp);
  assert.deepEqual(a[0].resumeWith.authorizeExternal, ['E1:T2@' + fp, 'E1:T3@' + fp]);
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E1:T2@' + fp]);
});

test('resume after the authorization runs only the released task and the next ones', async () => {
  const tasks = [tk(1, false), tk(2, true), tk(3, false)];
  const first = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan(tasks) });
  const rw = ext(first.r)[0].resumeWith;
  const done = [{ n: 1, firstParent: 'h0', last: 'c1' }, { n: 2, firstParent: 'c1', last: 'c2' }];
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: rw,
    over: withPlan(tasks, (l) => (l === 'E1:progress' ? { head: 'c2', clean: true, done } : undefined)) });
  assert.ok(labels.includes('E1:t3:impl'));
  assert.ok(!labels.includes('E1:t1:impl'));
  assert.ok(!labels.includes('E1:t2:impl'));
});

test('restricted gate is not measured without authorization and is offered as an action', async () => {
  const e2e = { name: 'e2e', cmd: 'npm run e2e', kind: 'exit', restricted: true };
  const cfg = { gates: [...GATES, e2e] };
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], config: cfg });
  assert.doesNotMatch(a.calls.find((c) => c.label === 'preflight').prompt, /npm run e2e/);
  const act = ext(a.r).find((x) => x.item === 'gate:e2e');
  assert.ok(act);
  assert.equal(act.deliverable, null);
  assert.deepEqual(act.resumeWith.authorizeExternal, ['gate:e2e']);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], config: cfg, args: { authorizeExternal: ['gate:e2e'] },
    over: (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', baseline: { ...gm('abc1234'), gates: [...gm('abc1234').gates, { name: 'e2e', ran: true, exit: 0 }] } } : undefined) });
  assert.match(b.calls.find((c) => c.label === 'preflight').prompt, /npm run e2e/);
  assert.equal(ext(b.r).length, 0);
});

test('the authorization ends with the deliverable', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2', 'gate:x'] } });
  assert.equal(r.results[0].merged, true);
  assert.deepEqual(r.resumeArgs.authorizeExternal, []);
});

test('the base rules forbid external effects for every agent', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'E1:spec').prompt, /NEVER perform an external effect/);
});

test('a conteudo failure after plan approval resumes with the authorization bound to that plan', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] },
    over: withPlan(tasks, (l) => (l === 'E1:t2:impl' ? { status: 'BLOCKED', summary: 'stop' } : undefined)) });
  const d = r.operatorActions.find((a) => a.kind === 'defect');
  assert.deepEqual(d.resumeWith.authorizeExternal, ['E1:T2@' + fpOf(tasks)]);
});

test('the restricted-gate action keeps bound items of unfinished deliverables and drops merged ones', async () => {
  const e2e = { name: 'e2e', cmd: 'npm run e2e', kind: 'exit', restricted: true };
  const t2 = [tk(1, false), tk(2, true), tk(3, true)];
  const { r } = await exec({ cards: [card('E1'), card('E2')], deliverables: ['E1', 'E2'], config: { gates: [...GATES, e2e] },
    args: { authorizeExternal: ['E1:T2', 'E2:T2'] },
    over: (l) => (l === 'E2:plan' ? planWith(t2) : undefined) });
  assert.equal(r.results.find((x) => x.id === 'E1').merged, true);
  const g = ext(r).find((x) => x.item === 'gate:e2e');
  assert.deepEqual(g.resumeWith.authorizeExternal, ['E2:T2@' + fpOf(t2), 'gate:e2e']);
  assert.equal(r.results.find((x) => x.id === 'E2').held, 'E2:T3@' + fpOf(t2));
});

const foreignPre = (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/r', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', baseline: gm('abc1234') } : undefined);

test("item 6: a target checked out in the person's checkout holds every merge", async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre });
  for (const bad of ['E1:merge', 'E1:rollback', 'E1:pre-merge', 'E1:setup']) assert.ok(!labels.includes(bad), bad);
  assert.ok(!labels.some((l) => /^E1:status-/.test(l)));
  assert.equal(r.results.find((x) => x.id === 'E1').merged, false);
  const a = r.operatorActions.find((o) => o.kind === 'authorize-external');
  assert.equal(a.item, 'checkout:integracao/x');
  assert.equal(a.deliverable, null);
  assert.match(calls.find((c) => c.label === 'report').prompt, /do NOT write a file/);
  assert.equal(r.reportPath, null);
});

test('item 6: with the checkout authorized the merge runs', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre, args: { authorizeExternal: ['checkout:integracao/x'] } });
  assert.equal(r.results.find((x) => x.id === 'E1').merged, true);
});

test("item 6: an interrupted merge is not finished in the person's checkout without authorization", async () => {
  const unf = card('E1', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'e0' });
  const { r, labels } = await exec({ cards: [unf], deliverables: ['E1'], over: foreignPre });
  assert.ok(!labels.some((l) => /^E1:merge-gates/.test(l)));
  assert.ok(r.operatorActions.some((o) => o.item === 'checkout:integracao/x'));
});

test('item 6: the base rules no longer say NEVER touch the worktree unconditionally', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre });
  const p = calls.find((c) => c.label === 'preflight').prompt;
  assert.match(p, /NEVER touch the branch main or the worktree \/r, except the integration worktree of the target when the operator authorized checkout:integracao\/x\./);
  assert.match(p, /checkout:integracao\/x/);
});

test("item 6: the report never commits in the person's checkout when the budget skipped every deliverable", async () => {
  let n = 0;
  const budget = { total: 1e9, remaining: () => (n++ === 0 ? 1e9 : 0) };
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre, budget });
  assert.equal(r.results.find((x) => x.id === 'E1').skipped, true);
  assert.match(calls.find((c) => c.label === 'report').prompt, /do NOT write a file/);
  assert.equal(r.reportPath, null);
  assert.match(calls.find((c) => c.label === 'report').prompt, /"item":"checkout:integracao\/x"/);
  const a = r.operatorActions.filter((o) => o.kind === 'authorize-external' && o.item === 'checkout:integracao/x');
  assert.equal(a.length, 1);
  assert.equal(a[0].deliverable, null);
});

const interrupted = (extra = {}) => card('E2', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'e0', ...extra });

test('item 1: the gates of an interrupted merge run before a new deliverable merges', async () => {
  const { labels } = await exec({ cards: [card('E1'), interrupted()], deliverables: ['E1', 'E2'] });
  assert.notEqual(labels.indexOf('E2:merge-gates1-1'), -1);
  assert.ok(labels.indexOf('E2:merge-gates1-1') < labels.indexOf('E1:merge'));
});

test('item 1: a new deliverable does not merge when the interrupted one ends broken', async () => {
  const { r, labels } = await exec({ cards: [card('E1'), interrupted()], deliverables: ['E1', 'E2'],
    over: (l) => {
      if (/^E2:merge-gates1/.test(l)) return gm('e0', { exit: 1, failedNames: ['new'] });
      if (l === 'E2:merge-fix') return null;
      return undefined;
    } });
  assert.ok(!labels.includes('E1:pre-merge'));
  assert.ok(!labels.includes('E1:merge'));
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.ok(e1.skipped);
  assert.match(e1.error, /compromised/);
  assert.equal(r.results.find((x) => x.id === 'E2').broken, true);
});

test('item 1: an interrupted merge that depends on a new deliverable does not deadlock', async () => {
  const { r, labels } = await exec({ cards: [card('E1'), interrupted({ deps: ['E1'] })], deliverables: ['E1', 'E2'] });
  assert.ok(labels.includes('E2:merge-gates1-1'));
  assert.ok(labels.includes('E1:merge'));
  assert.ok(labels.indexOf('E2:merge-gates1-1') < labels.indexOf('E1:merge'));
  assert.equal(r.results.find((x) => x.id === 'E1').merged, true);
});

test('item 1: a resume that throws also stops new merges', async () => {
  const { r, labels } = await exec({ cards: [card('E1'), interrupted()], deliverables: ['E1', 'E2'],
    over: (l) => { if (l === 'E2:merge-fix-probe') throw new Error('boom'); return undefined; } });
  assert.ok(!labels.includes('E1:merge'));
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.ok(e1.skipped);
  assert.match(e1.error, /compromised/);
});

test('item 2: piece 1 integrated and piece 2 spec is not done', async () => {
  const { r } = await exec({ cards: [card('E1', { status: 'piece 1: integrada; piece 2: spec', onTarget: true })], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.ok(r.selection.order.includes('E1'));
});

test('item 2: a spec row citing a commit of the main is not done', async () => {
  const { r } = await exec({ cards: [card('E2', { status: 'spec', onTarget: true })], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.ok(r.selection.order.includes('E2'));
});

test('item 2: a finished code segment still counts', async () => {
  const { r } = await exec({ cards: [card('E3', { status: 'code: integrada; acceptance: blocked (BLQ-2)', onTarget: true, mergeFound: true, mergeSha: 'm' })], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.ok(!r.selection.order.includes('E3'));
});

test('item 2: the discovery prompt restricts the ancestor rule', async () => {
  const { calls } = await exec({ cards: [card('E1')], args: { mode: 'dry-run' }, deliverables: 'next' });
  // E10: the ancestor rule (only a finished code segment counts, the delivery branch never does) is code in preflight.mjs, tested in preflight.test.mjs; the prompt is the command.
  assert.match(calls[0].prompt, /preflight\.mjs" discover/);
  assert.match(calls[0].prompt, /--prefix 'feat\/'/);
});

test('item 14: a closed BLQ yields a decision action and no correction round', async () => {
  const { r, labels } = await exec({ cards: [card('E1', { acceptance: [{ id: 'AC1', text: 'waits {verify: blocked BLQ-9; evidence: vendor key}' }] })], deliverables: ['E1'], discOver: { blockers: [] } });
  assert.equal(r.results.find((x) => x.id === 'E1').failKind, 'decisao');
  const d = r.operatorActions.filter((o) => o.kind === 'decision' && o.deliverable === 'E1');
  assert.equal(d.length, 1);
  assert.match(d[0].doNow, /BLQ-9/);
  assert.match(d[0].doNow, /revision/);
  assert.ok(!r.operatorActions.some((o) => o.kind === 'defect'));
  for (const l of ['E1:setup', 'E1:spec', 'E1:plan-fix1']) assert.ok(!labels.includes(l), l);
});

test('item 7: the owner notes never reach the record or the docs prompts', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'API_KEY=sk-live-123' } } });
  for (const c of calls.filter((x) => /:status-|:docs\d$|^report$/.test(x.label))) assert.ok(!c.prompt.includes('sk-live-123'), c.label);
  const spec = calls.find((c) => c.label === 'E1:spec').prompt;
  assert.ok(spec.includes('sk-live-123'));
  assert.match(spec, /Never write or quote a credential/);
  assert.match(calls.find((c) => c.label === 'E1:plan').prompt, /Never write or quote a credential/);
});

test('item 7: the merge-fix prompts carry no owner notes', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'API_KEY=sk-live-123' } },
    over: (l) => {
      if (/^E1:merge-gates1/.test(l)) return gm('e1', { exit: 1, failedNames: ['t'] });
      if (/:merge-fix$/.test(l)) return { status: 'DONE', summary: 's', checks: [] };
      if (/:merge-fix-review$/.test(l)) return { issues: [], headSha: 'e1', clean: true, commitsInRange: 1 };
      return undefined;
    } });
  const fixes = calls.filter((c) => /:merge-fix(-review)?$/.test(c.label));
  assert.ok(fixes.length > 0);
  for (const c of fixes) assert.ok(!c.prompt.includes('sk-live-123'), c.label);
});

test('item 7: the human-input action forbids secrets in notes', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: specWith({ needsPerson: [np({ id: 'H1', what: 'key', blocking: true })] }) });
  const o = r.operatorActions.find((x) => x.kind === 'human-input');
  assert.match(o.doNow, /Never put a secret in notes/);
});

test('item 7: every prompt that receives the notes carries the secrets warning', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'API_KEY=sk-live-123' } } });
  for (const l of ['E1:t1:impl', 'E1:t1:spec1']) {
    const p = calls.find((c) => c.label === l).prompt;
    assert.ok(p.includes('sk-live-123'), l);
    assert.match(p, /Never write or quote a credential/, l);
  }
});

test('item 11: the record and docs prompts forbid a strategy revision', async () => {
  const planOnly = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' } });
  const full = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const prompts = [
    planOnly.calls.find((c) => c.label === 'E1:status-c').prompt,
    full.calls.find((c) => c.label === 'E1:status-d').prompt,
    full.calls.find((c) => c.label === 'E1:docs1').prompt,
  ];
  for (const p of prompts) {
    assert.match(p, /Do NOT propose, write or approve a strategy revision/);
    assert.match(p, /pre-approval never covers them/);
  }
  assert.match(full.calls.find((c) => c.label === 'E1:spec').prompt, /except a strategy revision or migration/);
});

// ---- final-review fixes (I1-I5, minors)
const foreignNoBase = (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/r', targetHead: FULL('abc1234'), clean: true, envFacts: 'x' } : undefined);

test('I1: an unauthorized foreign checkout returns no baseline and only the hold follows', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignNoBase });
  assert.ok(!r.operatorActions.some((o) => /^preflight:/.test(o.kind)));
  assert.equal(r.operatorActions.find((o) => o.kind === 'authorize-external').item, 'checkout:integracao/x');
  assert.ok(!labels.some((l) => /gates|setup/.test(l)));
  assert.equal(r.status, 'needs-operator');
});

test('I1: without authorization the preflight prompt stops after locating a foreign worktree', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignNoBase });
  const p = calls.find((c) => c.label === 'preflight').prompt;
  assert.match(p, /If that path is not \/wt\/_integracao[\s\S]*STOP here/);
  assert.match(p, /no setup, no install, no beforeEvidence and no gates/);
  assert.match(p, /Only if step 2 did not stop/);
});

test('I1: with the checkout authorized the preflight may run in it and a missing baseline is still invalid', async () => {
  const args = { authorizeExternal: ['checkout:integracao/x'] };
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre, args });
  const p = a.calls.find((c) => c.label === 'preflight').prompt;
  assert.doesNotMatch(p, /STOP here/);
  assert.match(p, /AUTHORIZED checkout:integracao\/x/);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignNoBase, args });
  assert.ok(b.r.operatorActions.some((o) => /^preflight:/.test(o.kind)));
});

const deploy = 'curl -X POST https://prod.example/deploy';
const extRow = { ac: 'AC1', kind: 'smoke', command: deploy, external: true, externalDedupe: 'GET /deploys first' };
const safeTasks = [tk(1, false)];
const planRows = (ac, tasks = safeTasks, blob = B1) => (l) => (l === 'E1:plan' ? { ...planWith(tasks), planBlob: blob, ac } : undefined);
const blobReview = (blob, fn) => (l, p, o) => (/plan-review/.test(l) ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 2, measuredPlanBlob: blob } : fn(l, p, o));
const evOk = (l) => (/:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'a2' : 'a3', clean: true, results: [{ ac: 'AC1', command: deploy, exit: 0 }] } : undefined);

test('I2: an unauthorized external evidence row is held before any final review, gate or evidence run', async () => {
  const fp = fpOf(safeTasks);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([extRow]) });
  for (const bad of ['E1:sync', 'E1:gates1-1', 'E1:evidence1', 'E1:merge']) assert.ok(!labels.includes(bad), bad);
  assert.ok(!labels.some((l) => /fix/.test(l)));
  assert.ok(labels.includes('E1:t1:impl'));
  const res = r.results.find((x) => x.id === 'E1');
  assert.equal(res.merged, false);
  assert.equal(res.failKind, 'externo');
  assert.ok(!r.operatorActions.some((o) => o.kind === 'defect'));
  const a = ext(r);
  assert.equal(a.length, 1);
  assert.equal(a[0].item, 'E1:AC1@' + fp);
  assert.equal(a[0].deliverable, 'E1');
  assert.ok(a[0].what.includes(deploy));
  assert.match(a[0].doNow, /GET \/deploys first/);
  assert.deepEqual(a[0].resumeWith.authorizeExternal, ['E1:AC1@' + fp]);
  assert.deepEqual(a[0].resumeWith.deliverables, ['E1']);
});

test('I2: an authorized evidence row runs, is told it is authorized, and the authorization ends with the merge', async () => {
  for (const item of ['E1:AC1', 'E1:AC1@' + fpOf(safeTasks)]) {
    const rows = planRows([extRow]);
    const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: [item] }, over: (l) => rows(l) ?? evOk(l) });
    assert.equal(r.results[0].merged, true);
    const p = calls.find((c) => c.label === 'E1:evidence1').prompt;
    assert.ok(p.includes('AC1: ' + deploy));
    assert.match(p, /AUTHORIZED[\s\S]*GET \/deploys first/);
    assert.deepEqual(r.resumeArgs.authorizeExternal, []);
  }
});

test('I2: an authorization bound to another plan does not release the row', async () => {
  const B3 = 'a'.repeat(40);
  const item = 'E1:AC1@' + PU.planFingerprint(safeTasks, B1);
  const rows = planRows([extRow], safeTasks, B3);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: [item] }, over: blobReview(B3, rows) });
  assert.ok(!labels.includes('E1:evidence1'));
  assert.equal(ext(r)[0].item, 'E1:AC1@' + PU.planFingerprint(safeTasks, B3));
});

test('I2: the first external stop lists held tasks and held evidence together', async () => {
  const tasks = [tk(1, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([extRow], tasks) });
  assert.deepEqual(ext(r).map((a) => a.item).sort(), ['E1:AC1@' + fpOf(tasks), 'E1:T1@' + fpOf(tasks)].sort());
});

test('I2: a row without the flag rejects the plan, and two rows of one criterion make one item', async () => {
  const noFlag = { ac: 'AC1', kind: 'test', command: 'npm test -- a' };
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([noFlag]) });
  assert.ok(a.labels.includes('E1:plan-fix1'));
  assert.ok(!a.labels.includes('E1:evidence1'));
  assert.equal(a.r.results[0].merged, false);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([extRow, { ...extRow, command: 'curl b' }]) });
  assert.equal(ext(b.r).length, 1);
  assert.ok(ext(b.r)[0].what.includes('curl b'));
});

test('I2: human and blocked rows need no flag and are never held', async () => {
  const c = card('E1', { acceptance: [{ id: 'AC1', text: 'works' }, { id: 'AC2', text: 'ok' }] });
  const { r } = await exec({ cards: [c], deliverables: ['E1'], over: planRows([{ ac: 'AC1', kind: 'test', command: 'npm test -- a', external: false }, { ac: 'AC2', kind: 'human' }]) });
  assert.equal(r.results[0].merged, true);
  assert.equal(ext(r).length, 0);
});

test('I2: the plan prompts ask each evidence row for external', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'E1:plan').prompt, /each evidence row[^\n]*external/i);
  assert.equal(calls.find((c) => c.label === 'E1:plan').opts.schema, undefined);
});

test('I2/I3: the plan review checks the flags against the JSON the code acts on', async () => {
  const rows = planRows([extRow], [tk(1, false, { title: 'deploy to prod' })]);
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: rows });
  const p = calls.find((c) => c.label === 'E1:plan-review1').prompt;
  assert.match(p, /steps touch anything outside the branch but which declares external false/);
  assert.match(p, /evidence row[^;]*command[^;]*outside the branch[^;]*external false/);
  assert.ok(p.includes('deploy to prod') && p.includes('"external":false'));
  assert.ok(!p.includes(deploy), 'the rows the code compares must not be shown to the reviewer that measures them');
});

test('I4: the gate action says it only covers later merges and that the gate repeats', async () => {
  const e2e = { name: 'e2e', cmd: 'npm run e2e', kind: 'exit', restricted: true };
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { gates: [...GATES, e2e] } });
  const a = ext(r).find((x) => x.item === 'gate:e2e');
  assert.match(a.doNow, /only to deliverables merged after/);
  assert.match(a.doNow, /measures nothing for deliverables already merged/);
  assert.match(a.doNow, /several times per deliverable: baseline, branch, post-merge and retries/);
  assert.doesNotMatch(a.doNow, /Until then/);
});

test('I4/I2: SKILL.md and operator.md describe the gate question and the evidence item', async () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const f of ['SKILL.md', join('references', 'operator.md')]) {
    const t = readFileSync(join(dir, f), 'utf8');
    assert.match(t, /only to deliverables merged after/, f);
    assert.match(t, /measures nothing for deliverables already merged/, f);
    assert.match(t, /several times per deliverable/, f);
    assert.match(t, /E<n>:AC<k>|E18:AC1/, f);
    assert.match(t, /missing the flag counts as external/, f);
  }
});

test('I5: the review log data carries the human inputs of the implementers', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (l === 'E1:t1:impl' ? { status: 'NEEDS_HUMAN', summary: 's', checks: [], humanInputs: [{ what: 'real API key', blocking: false }] } : undefined) });
  const log = calls.find((c) => c.label === 'E1:review-log').prompt;
  assert.ok(log.includes('real API key'));
  assert.match(log, /"humanInputs":\[/);
});

test('I5: finish-merge reads the logged human inputs and the plan evidence rows', async () => {
  const { r, calls } = await exec({ cards: [unfinished()], deliverables: ['E1'],
    over: (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'real API key' }, { what: 'real API key' }], ac: [{ ac: 'AC1', kind: 'human' }] } : undefined) });
  const p = calls.find((c) => c.label === 'E1:resume-review-log').prompt;
  assert.match(p, /docs\/plans\/x-E1\/plan\.md/);
  assert.match(p, /Acceptance criteria evidence/);
  assert.match(p, /humanInputs[^.]*review log/);
  assert.ok(calls.find((c) => c.label === 'E1:resume-review-log').opts.schema.required.includes('ac'));
  const act = r.operatorActions.find((o) => o.kind === 'human-act' && o.deliverable === 'E1');
  assert.ok(act);
  assert.match(act.what, /AC1/);
  assert.equal(r.results[0].human.filter((h) => /real API key/.test(h)).length, 1);
});

test('I5: a human plan row gives the same action on resume as in the normal path', async () => {
  const normal = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([{ ac: 'AC1', kind: 'human' }]) });
  const resumed = await exec({ cards: [unfinished()], deliverables: ['E1'],
    over: (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [], ac: [{ ac: 'AC1', kind: 'human' }] } : undefined) });
  const pick = (x) => x.r.operatorActions.filter((o) => o.kind === 'human-act').map((o) => [o.what, o.doNow]);
  assert.equal(pick(normal).length, 1);
  assert.deepEqual(pick(resumed), pick(normal));
});

const needsHuman = { status: 'NEEDS_HUMAN', summary: 'needs a key', checks: [], humanInputs: [{ what: 'prod key' }] };
const zeroCommits = (l) => (/:t\d+:(spec|quality)/.test(l) ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 0 } : undefined);

test('minor 1: an authorized external task that needs a human with zero commits holds the merge and keeps the authorization', async () => {
  const tasks = [tk(1, true)];
  const fp = fpOf(tasks);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] },
    over: withPlan(tasks, (l) => (l === 'E1:t1:impl' ? needsHuman : zeroCommits(l))) });
  assert.ok(!labels.includes('E1:merge'));
  assert.equal(r.results[0].merged, false);
  assert.equal(r.results[0].failKind, 'humano');
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E1:T1@' + fp]);
  const h = r.operatorActions.find((o) => o.kind === 'human-input');
  assert.ok(h && /prod key/.test(h.what));
  assert.deepEqual(h.resumeWith.authorizeExternal, ['E1:T1@' + fp]);
});

test('minor 1: NEEDS_HUMAN on a non-external task follows the normal path, with or without commits', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], (l) => (l === 'E1:t1:impl' ? needsHuman : zeroCommits(l))) });
  assert.equal(a.r.results[0].merged, true);
  assert.ok(!a.labels.includes('E1:t1:awaiting-person'));
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.equal(b.r.results[0].merged, true);
  assert.ok(b.labels.includes('E1:t1:spec1'));
});

// ---- authorized external task with NEEDS_HUMAN: never merges
const ext1 = [tk(1, true)];
const extArgs = { authorizeExternal: ['E1:T1'] };
const noInputs = { status: 'NEEDS_HUMAN', summary: 'placeholder only', checks: [] };
const assertStopped = (x, input) => {
  const { r, labels } = x;
  assert.ok(!labels.includes('E1:merge'));
  assert.equal(r.results[0].merged, false);
  assert.equal(r.results[0].failKind, 'humano');
  const h = r.operatorActions.find((o) => o.kind === 'human-input');
  assert.ok(h, 'human-input action');
  assert.match(h.what, /not known whether the external effect started/);
  assert.match(h.what, /task 1/);
  assert.match(h.what, input);
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E1:T1@' + fpOf(ext1)]);
  assert.deepEqual(h.resumeWith.authorizeExternal, ['E1:T1@' + fpOf(ext1)]);
  assert.ok(!labels.some((l) => /:t1:(spec|quality)-fix/.test(l)), 'no fix round');
  assert.ok(!x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'), 'not recorded as run');
};

test('authorized external NEEDS_HUMAN with a commit and no humanInputs stops, naming the task', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? noInputs : undefined)) });
  assertStopped(x, /placeholder only/);
});

test('authorized external NEEDS_HUMAN with a commit and humanInputs stops', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assertStopped(x, /prod key/);
});

test('authorized external NEEDS_HUMAN with zero commits stops the same way', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : zeroCommits(l))) });
  assertStopped(x, /prod key/);
});

test('the stop leaves a durable mark on the branch, and the progress read reports it', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.match(calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt, /--allow-empty.*E1 T1 awaiting person \(effect unknown\):/);
  const prog = calls.find((c) => c.label === 'E1:progress');
  assert.match(prog.prompt, /awaitingPerson/);
  assert.ok(prog.opts.schema.required.includes('awaitingPerson'));
});

test('a mark that cannot be written is said in the action', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : /awaiting-person/.test(l) ? null : undefined)) });
  assert.equal(x.r.results[0].merged, false);
  assert.match(x.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /launch stays open/);
});

const pendingProgress = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1] } : undefined);

test('resume: a task that stopped with commits runs again and a repeated NEEDS_HUMAN stops once more', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (l === 'E1:t1:impl' ? noInputs : undefined)) });
  assertStopped(x, /placeholder only/);
  assert.equal(x.labels.filter((l) => l === 'E1:t1:impl').length, 1);
});

test('resume: a task that stopped with commits does not count as done, and is recorded only when it completes', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, pendingProgress) });
  assert.equal(x.labels.filter((l) => l === 'E1:t1:impl').length, 1);
  assert.equal(x.r.results[0].merged, true);
  assert.ok(x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
});

test('resume: without the mark a committed task keeps the resume path', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
});

test('resume: without the authorization the pending task is held, not relaunched', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan(ext1, pendingProgress) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.equal(x.r.results[0].failKind, 'externo');
});

// Reviews count commits as git would: only a range from the task's own first parent holds the earlier commits.
const rerunRange = (l, prompt) => (/:t1:(spec|quality)\d/.test(l) ? { issues: [], headSha: 'a1', clean: true, commitsInRange: prompt.includes('log -p p..HEAD') ? 3 : 0 } : undefined);

test('resume: a re-run that completes with no new commit passes, spends no fix and records the effect', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: both((l) => (l === 'E1:plan' ? planWith(ext1) : undefined), pendingProgress, rerunRange) });
  assert.equal(x.r.results[0].merged, true);
  assert.ok(!x.labels.some((l) => /:t1:(spec|quality)-fix/.test(l)), 'no fix round');
  assert.ok(x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
  const review = x.calls.find((c) => c.label === 'E1:t1:spec1').prompt;
  assert.match(review, /awaiting person:[^\n]*not extra scope/);
});

test('resume: a completed re-run clears the mark right after the implementer, before any review', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, pendingProgress) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:clear-awaiting').prompt, /--allow-empty.*"E1 T1: /);
  assert.ok(x.labels.indexOf('E1:t1:impl') < x.labels.indexOf('E1:t1:clear-awaiting'));
  assert.ok(x.labels.indexOf('E1:t1:clear-awaiting') < x.labels.indexOf('E1:t1:spec1'));
});

test('resume: a repeated NEEDS_HUMAN does not clear the mark', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (l === 'E1:t1:impl' ? noInputs : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:clear-awaiting'));
});

test('resume: a first run with no commits still gets its completion cleared', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [], awaitingPerson: [1] } : undefined)) });
  assert.ok(x.labels.includes('E1:t1:clear-awaiting'));
  assert.equal(x.r.results[0].merged, true);
});

test('a mark that cannot be cleared is a concern', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (/clear-awaiting/.test(l) ? null : undefined)) });
  assert.ok(x.r.results[0].concerns.some((c) => /mark was not cleared/.test(c)));
});

test('a task with commits before a stopped task is not reviewed again over the stopped commits', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2'] },
    over: withPlan(tasks, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p1', last: 'c1' }, { n: 2, firstParent: 'p', last: 'c' }], awaitingPerson: [2] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:spec1'));
  assert.ok(x.labels.includes('E1:t2:impl'));
});

test('a mark agent that rejects still ends in the human stop, with the warning', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => { if (/awaiting-person/.test(l)) throw new Error('boom'); return l === 'E1:t1:impl' ? needsHuman : undefined; }) });
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.match(x.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /launch stays open/);
});

const reviewIssue = (l) => (l === 'E1:t1:spec1' ? { issues: [{ severity: 'important', category: 'defeito', description: 'd' }], headSha: 'a1', clean: true, commitsInRange: 2 } : undefined);

test('a fix round that ends in NEEDS_HUMAN stops an authorized external task at once', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:t1:spec-fix1' ? { status: 'NEEDS_HUMAN', summary: 'needs a key', checks: [], humanInputs: [{ what: 'fix key' }] } : reviewIssue(l))) });
  assert.equal(x.r.results[0].merged, false);
  assert.equal(x.r.results[0].failKind, 'humano');
  const act = x.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(act.what, /task 1.*fix round needs a person.*reported the external effect done.*fix key/);
  assert.match(act.doNow, /before repeating it.*checks outbox\.log first/);
  assert.match(x.r.results[0].error, /reported the external effect done/);
  for (const t of [act.what, act.doNow, x.r.results[0].error, x.calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt]) assert.doesNotMatch(t, /did not complete/);
  assert.ok(!x.labels.includes('E1:t1:spec2'));
  assert.ok(!x.labels.includes('E1:t1:quality1'));
  assert.ok(x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'), 'the implementer reported the effect done: it is recorded (N8)');
});

test('a fix round with NEEDS_HUMAN on a non-external task keeps the normal path', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: withPlan([tk(1, false)], (l) => (l === 'E1:t1:spec-fix1' ? { status: 'NEEDS_HUMAN', summary: 's', checks: [] } : l === 'E1:t1:spec2' ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 2 } : reviewIssue(l))) });
  assert.equal(x.r.results[0].merged, true);
  assert.ok(x.labels.includes('E1:t1:spec2'));
});

test('minor 2: the merge agent is told when the checkout is authorized', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: foreignPre, args: { authorizeExternal: ['checkout:integracao/x'] } });
  assert.match(a.calls.find((c) => c.label === 'E1:merge').prompt, /The operator authorized checkout:integracao\/x/);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.doesNotMatch(b.calls.find((c) => c.label === 'E1:merge').prompt, /The operator authorized checkout:/);
});

test('minor 4: gate and checkout items leave resumeArgs when no deliverable remains, and stay otherwise', async () => {
  const items = ['gate:x', 'checkout:integracao/x'];
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: items } });
  assert.deepEqual(a.r.resumeArgs.authorizeExternal, []);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: items }, over: withPlan([tk(1, true)]) });
  assert.deepEqual(b.r.resumeArgs.authorizeExternal, items);
});

// ---- leva 2, bloco A
const cmdRow = (command, over = {}) => ({ ac: 'AC1', kind: 'smoke', command, external: true, externalDedupe: 'd', ...over });

const doneT1 = [{ n: 1, firstParent: 'h0', last: 'c1' }];
const resumedRun = (over, args = {}) => exec({ cards: [card('E1')], deliverables: ['E1'], args,
  over: both((l) => (l === 'E1:progress' ? { head: 'c1', clean: true, done: doneT1 } : undefined), over || (() => undefined)) });
const loggedRun = (l) => (l === 'E1:resume-review-log' ? { found: true, humanInputs: [{ what: 'SECRET-PLACEHOLDER' }], acceptedRisks: [{ stage: 'final', severity: 'minor', category: 'fora-do-escopo', description: 'RISK-X' }], ac: [] } : undefined);

test('important 2: a resume restores human inputs and accepted risks from the persisted log', async () => {
  const { r, calls } = await resumedRun(loggedRun);
  const docs = calls.find((c) => c.label === 'E1:docs1').prompt;
  assert.ok(docs.includes('SECRET-PLACEHOLDER') && docs.includes('RISK-X'));
  assert.ok(r.ownerReview.acceptedRisks.some((x) => x.description === 'RISK-X'));
  assert.ok(r.results[0].human.some((h) => /SECRET-PLACEHOLDER/.test(h)));
  const log = calls.find((c) => c.label === 'E1:review-log').prompt;
  assert.ok(log.includes('SECRET-PLACEHOLDER') && log.includes('RISK-X'));
  assert.ok(calls.find((c) => c.label === 'E1:resume-review-log').prompt.includes('In "/wt/E1" read'));
});

test('important 2: the review log keeps what the file already holds', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'E1:review-log').prompt, /already exists[^.]*keep/i);
});

test('important 2: a run with no committed task does not read the log', async () => {
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.ok(!labels.includes('E1:resume-review-log'));
});

test('important 2: restored items are not duplicated against this run, and a null read is a concern', async () => {
  const { r, calls } = await resumedRun((l) => {
    if (/^E1:spec-load\d$/.test(l)) return specLoadOk('E1', { acceptance: [{ id: 'AC1', text: 'works' }], needsPerson: [np({ id: 'H1', what: 'SECRET-PLACEHOLDER' })] });
    return loggedRun(l);
  });
  assert.equal(r.results[0].human.filter((h) => /SECRET-PLACEHOLDER/.test(h)).length, 1);
  assert.equal(calls.find((c) => c.label === 'E1:docs1').prompt.split('SECRET-PLACEHOLDER').length, 2);
  const nul = await resumedRun((l) => (l === 'E1:resume-review-log' ? null : undefined));
  assert.ok(nul.r.results[0].concerns.some((c) => /review log not read/.test(c)));
});

test('rereview minor 1: the evidence doNow lists every re-run of the command', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: planRows([extRow]) });
  const d = ext(r)[0].doNow;
  assert.match(d, /after each gates fix/);
  assert.match(d, /late sync/);
  assert.match(d, /invalid measure/);
});

const evidenceFailsOnce = (l) => {
  if (l === 'E1:evidence1') return { headSha: 'a2', clean: true, results: [{ ac: 'AC1', command: deploy, exit: 1, log: 'x' }] };
  if (l === 'E1:gates-fix1') return { status: 'DONE', summary: 'f', checks: [] };
  if (l === 'E1:gates-fix1-review') return { issues: [], headSha: 'a2', clean: true, commitsInRange: 1 };
  if (/:evidence/.test(l)) return { headSha: l === 'E1:evidence2' ? 'a2' : 'a3', clean: true, results: [{ ac: 'AC1', command: deploy, exit: 0 }] };
  return undefined;
};

test('rereview minor 2: the gates fix prompt carries the duplicate check of an external evidence command', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), evidenceFailsOnce) });
  const p = calls.find((c) => c.label === 'E1:gates-fix1').prompt;
  assert.match(p, /duplicate check[^\n]*GET \/deploys first/);
  assert.ok(p.includes(deploy));
});

test('rereview minor 2: a local evidence command adds no such clause', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => {
    if (l === 'E1:evidence1') return { headSha: 'a2', clean: true, results: [{ ac: 'AC1', command: 'npm test -- a', exit: 1, log: 'x' }] };
    if (l === 'E1:gates-fix1') return { status: 'DONE', summary: 'f', checks: [] };
    if (l === 'E1:gates-fix1-review') return { issues: [], headSha: 'a2', clean: true, commitsInRange: 1 };
    return undefined;
  } });
  assert.doesNotMatch(calls.find((c) => c.label === 'E1:gates-fix1').prompt, /duplicate check/);
});

test('rereview minor 3: the authorization sentence is conditional on the plan not changing', async () => {
  const tasks = [tk(1, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] }, over: withPlan(tasks, (l) => (l === 'E1:t1:impl' ? needsHuman : zeroCommits(l))) });
  assert.match(r.operatorActions.find((o) => o.kind === 'human-input').doNow, /stays valid only if the spec and plan files come out unchanged/);
});

test('minor 6: force does not take an interrupted merge out of FINISH', async () => {
  const { r, labels } = await exec({ cards: [card('E1'), interrupted()], deliverables: ['E1', 'E2'], args: { force: true } });
  assert.ok(!labels.includes('E2:spec'));
  assert.ok(labels.indexOf('E2:merge-gates1-1') < labels.indexOf('E1:merge'));
  assert.ok(r.selection.notes.some((n) => /E2/.test(n) && /force/.test(n)));
});

const hasNotes = (o) => o.resumeWith && o.resumeWith.notes;

test('minor 7: consumed notes leave resumeWith; notes of other deliverables stay', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer', E9: 'later' } }, over: withPlan(tasks) });
  assert.deepEqual(ext(r)[0].resumeWith.notes, { E9: 'later' });
  assert.deepEqual(r.resumeArgs.notes, { E9: 'later' });
  const only = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer' } }, over: withPlan(tasks) });
  assert.equal(ext(only.r)[0].resumeWith.notes, undefined);
  assert.equal(only.r.resumeArgs.notes, undefined);
});

test('minor 7: a template answer is kept, and notes the plan never read stay', async () => {
  const d = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer' } }, over: (l) => (l === 'E1:t1:impl' ? { status: 'BLOCKED', summary: 'x', checks: [] } : undefined) });
  assert.equal(d.r.operatorActions.find((o) => o.kind === 'defect').resumeWith.notes.E1, '<owner instruction>');
  const s = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer' } }, over: (l) => (l === 'E1:setup' ? null : undefined) });
  assert.ok(s.r.operatorActions.some((o) => hasNotes(o) && o.resumeWith.notes.E1 === 'answer'));
});

const riskIssue = { severity: 'important', category: 'fora-do-escopo', description: 'RISK-M' };

test('minor 13: a risk accepted on the conflict review is committed before the post-merge gates', async () => {
  const { labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => {
    if (/:merge$/.test(l)) return { mergeCommit: FULL('e1'), firstParent: 'abc1234', secondParent: 'a3', conflicts: 1, clean: true };
    if (l === 'E1:merge-review') return { issues: [riskIssue], headSha: 'e1', clean: true, commitsInRange: 1 };
    return undefined;
  } });
  const at = labels.indexOf('E1:merge-risks');
  assert.ok(at > labels.indexOf('E1:merge-review') && at < labels.indexOf('E1:merge-gates1-1'));
  const p = calls[at].prompt;
  assert.ok(p.includes('RISK-M') && p.includes('/wt/_integracao'));
});

test('minor 13: a risk accepted on the merge fix is committed, and the next measure expects that head', async () => {
  let n = 0;
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => {
    if (/^E1:merge-gates1/.test(l)) return gm('e1', { exit: 1, failedNames: ['t'] });
    if (l === 'E1:merge-fix') return { status: 'DONE', summary: 's', checks: [] };
    if (l === 'E1:merge-fix-review') return { issues: [riskIssue], headSha: 'm8', clean: true, commitsInRange: 1 };
    if (l === 'E1:merge-risks') { n++; return { head: 'e9', commit: 'e9' }; }
    if (/^E1:merge-gates2/.test(l)) return gm('e9');
    return undefined;
  } });
  assert.equal(n, 1);
  assert.ok(labels.indexOf('E1:merge-risks') < labels.indexOf('E1:merge-gates2-1'));
  assert.equal(r.results[0].merge.docsOk, true);
});

test('minor 13: no accepted risk means no extra commit on the target', async () => {
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.ok(!labels.includes('E1:merge-risks'));
});

test('ledger: a stale bound item leaves resumeWith', async () => {
  const tasks = [tk(1, false), tk(2, true)];
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T2@00000000', 'E2:T1@11111111'] }, over: withPlan(tasks) });
  const fp = fpOf(tasks);
  assert.deepEqual(ext(r)[0].resumeWith.authorizeExternal, ['E2:T1@11111111', 'E1:T2@' + fp]);
  assert.deepEqual(r.resumeArgs.authorizeExternal, ['E2:T1@11111111']);
});

test('ledger: a replan that makes a committed task external stops and says the task will not run again', async () => {
  const tasks = [tk(1, true), tk(2, false)];
  const { r, labels } = await resumedRun(withPlan(tasks));
  for (const bad of ['E1:t1:spec1', 'E1:t2:impl', 'E1:sync']) assert.ok(!labels.includes(bad), bad);
  assert.equal(r.results[0].failKind, 'externo');
  const a = ext(r);
  assert.equal(a[0].item, 'E1:T1@' + fpOf(tasks));
  assert.match(a[0].doNow, /already committed[^.]*not run again/i);
});

test('ledger: a committed external task that is authorized goes on', async () => {
  const tasks = [tk(1, true), tk(2, false)];
  const { labels } = await resumedRun(withPlan(tasks), { authorizeExternal: ['E1:T1'] });
  assert.ok(labels.includes('E1:t2:impl'));
});

test('ledger: the checkout item is one action per run, keeping the selection', async () => {
  const { r } = await exec({ cards: [card('E1'), card('E2')], deliverables: ['E1', 'E2'], over: foreignNoBase });
  const a = r.operatorActions.filter((o) => o.item === 'checkout:integracao/x');
  assert.equal(a.length, 1);
  assert.equal(a[0].deliverable, null);
  assert.deepEqual(a[0].resumeWith.deliverables, ['E1', 'E2']);
});

test('ledger: plan-only with every deliverable skipped still explains the hold', async () => {
  let n = 0;
  const budget = { total: 1e9, remaining: () => (n++ === 0 ? 1e9 : 0) };
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: foreignNoBase, budget });
  assert.equal(r.results[0].skipped, true);
  assert.equal(r.operatorActions.filter((o) => o.item === 'checkout:integracao/x').length, 1);
});

test('ledger: the plan path is quoted in the blob measurement', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.ok(calls.find((c) => c.label === 'E1:plan-review1').prompt.includes('rev-parse "HEAD:docs/plans/x-E1/plan.md"'));
});

test('ledger: resume-review-log says what counts as accepted', async () => {
  const { calls } = await exec({ cards: [unfinished()], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:resume-review-log').prompt;
  assert.match(p, /accepted risk[^.]*never a finding that was fixed/i);
});

test('ledger: the closed-blocker doNow names every closed blocker in both remedies', async () => {
  const c = card('E1', { acceptance: [{ id: 'AC1', text: 'a {verify: blocked BLQ-8; evidence: x}' }, { id: 'AC2', text: 'b {verify: blocked BLQ-9; evidence: y}' }] });
  const { r } = await exec({ cards: [c], deliverables: ['E1'], discOver: { blockers: [] } });
  const d = r.operatorActions.find((o) => o.kind === 'decision').doNow;
  assert.match(d, /\{verify: blocked BLQ-8\}[^.]*\{verify: blocked BLQ-9\}/);
  assert.match(d, /reopen BLQ-8, BLQ-9/);
});

test('ledger: the report does not attribute the origin of an effect without evidence', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.match(calls.find((c) => c.label === 'report').prompt, /origin of an external effect[^.]*unknown/i);
});

test('ledger: a reused native plan without the external declarations goes to the plan fixer', async () => {
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, taskCommits: 0, committedTasks: [], nativeSpec: true, nativePlan: true }
      : l === 'E1:plan-load1' ? planLoadOf({ ...OLD_DEFAULT_PLAN, tasks: [{ n: 1, title: 't', tier: 'sonnet' }] }, 'E1')
      : l === 'E1:plan-fix1' ? planWith([tk(1, false)]) : undefined) });
  assert.ok(!labels.includes('E1:plan'));
  assert.ok(labels.includes('E1:plan-fix1'));
});

test('ledger: a finished code segment counts with mergeFound false', async () => {
  const { r } = await exec({ cards: [card('E3', { status: 'code: integrada; acceptance: blocked (BLQ-2)', onTarget: true, mergeFound: false })], args: { mode: 'dry-run' }, deliverables: 'next' });
  assert.ok(!r.selection.order.includes('E3'));
});

// ---- bloco A, fix round 1
test('fix 2: a fix on a committed external task is told not to perform the effect', async () => {
  const tasks = [tk(1, true), tk(2, false)];
  let n = 0;
  const { calls, labels } = await resumedRun(withPlan(tasks, (l) => {
    if (l === 'E1:t1:spec1' && n++ === 0) return { issues: [{ severity: 'critical', category: 'defeito', description: 'x' }], headSha: 'a1', clean: true, commitsInRange: 2 };
    if (l === 'E1:t1:spec-fix1') return { status: 'DONE', summary: 'f', checks: [] };
    return undefined;
  }), { authorizeExternal: ['E1:T1'] });
  assert.ok(!labels.includes('E1:t1:impl'));
  const p = calls.find((c) => c.label === 'E1:t1:spec-fix1').prompt;
  assert.match(p, /Do NOT perform any external effect/);
  assert.doesNotMatch(p, /perform the effect at most once/);
});

test('minor 2: the plan fixer returns a table-escaped pipe as the pipe that must run', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: noHeader });
  assert.ok(calls.find((c) => c.label === 'E1:plan-fix1').prompt.includes(String.raw`table-escaped \| written as |`));
});

test('minor 3: a reused worktree with no committed task also restores the log', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, reused: true } : loggedRun(l)) });
  assert.ok(calls.find((c) => c.label === 'E1:docs1').prompt.includes('RISK-X'));
  assert.ok(r.ownerReview.acceptedRisks.some((x) => x.description === 'RISK-X'));
});

test('minor 4: a note stays for the resume when the plan review rejects the plan', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer' } }, over: noHeader });
  assert.equal(r.results[0].merged, false);
  assert.equal(r.resumeArgs.notes.E1, 'answer');
});

test('minor 7: restored human inputs differing only in spacing are one item', async () => {
  const { calls } = await resumedRun((l) => (l === 'E1:resume-review-log' ? { found: true, humanInputs: [{ what: 'H-ONE' }, { what: '  H-ONE ' }], acceptedRisks: [], ac: [] } : undefined));
  assert.equal(calls.find((c) => c.label === 'E1:docs1').prompt.split('H-ONE').length, 2);
});

// ---- bloco A, fix round 2
const wrapped = '`echo echo PWNED`';

test('fix round 2: a wrapped command is dispatched and shown unwrapped', async () => {
  const held = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(planRows([cmdRow(wrapped)])) });
  assert.ok(!ext(held.r)[0].what.includes('`echo'));
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] },
    over: both(planRows([cmdRow(wrapped)]), (l) => (/:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'a2' : 'a3', clean: true, results: [{ ac: 'AC1', command: 'echo echo PWNED', exit: 0 }] } : undefined)) });
  const p = calls.find((c) => c.label === 'E1:evidence1').prompt;
  assert.match(p, /^AC1: echo echo PWNED$/m);
});

test('fix round 2: the defect action keeps an answer no approved plan consumed', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'answer' } }, over: noHeader });
  assert.equal(r.operatorActions.find((o) => o.kind === 'defect').resumeWith.notes.E1, 'answer');
});

// ---- bloco A, real-run follow-up
const asksAuth = (l) => (l === 'E1:t1:impl' ? { status: 'DONE', summary: 's', checks: [{ command: 'x', output: 'y', exit: 0 }], humanInputs: [{ what: 'Operator authorization to run ' + deploy + ' (external)' }, { what: 'real API key' }] } : undefined);

const ranMark = (x) => `[already authorized and run in this run: ${x}]`;

test('I1: a request for an authorization already used is annotated and is not offered as an action', async () => {
  const rows = planRows([extRow]);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(rows, asksAuth, evOk) });
  const annotated = 'Operator authorization to run ' + deploy + ' (external) ' + ranMark(deploy);
  assert.deepEqual(r.results[0].human, [annotated, 'real API key']);
  assert.ok(!r.operatorActions.some((o) => JSON.stringify(o).includes('Operator authorization')));
  const report = calls.find((c) => c.label === 'report').prompt;
  assert.ok(report.includes(ranMark(deploy)));
  assert.match(report, /report it as already done and never offer that authorization as an action/);
  assert.match(report, /any other need the item states stays open/);
});

test('I1: a genuine input that mentions approval and the command survives and is visible', async () => {
  const what = 'Real SMTP credentials and approval to send with ' + deploy + ' (placeholder used)';
  const impl = (l) => (l === 'E1:t1:impl' ? { status: 'DONE', summary: 's', checks: [{ command: 'x', output: 'y', exit: 0 }], humanInputs: [{ what }] } : undefined);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), impl, evOk) });
  assert.deepEqual(r.results[0].human, [what + ' ' + ranMark(deploy)]);
  assert.ok(calls.find((c) => c.label === 'E1:docs1').prompt.includes('Real SMTP credentials'));
  assert.ok(calls.find((c) => c.label === 'report').prompt.includes('Real SMTP credentials'));
});

test('I2: an authorized task that returned NEEDS_HUMAN with a placeholder commit is not an effect that ran', async () => {
  const what = 'Approval of the text for E1:T1';
  const impl = (l) => (l === 'E1:t1:impl' ? { status: 'NEEDS_HUMAN', summary: 'placeholder', checks: [{ command: 'x', output: 'y', exit: 0 }], humanInputs: [{ what }] } : undefined);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] }, over: withPlan([tk(1, true)], impl) });
  assert.ok(!calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
  assert.deepEqual(r.results[0].human, [what], 'not annotated: the effect did not happen');
});

test('I2: an authorized task with DONE_WITH_CONCERNS and a commit is recorded', async () => {
  const impl = (l) => (l === 'E1:t1:impl' ? { status: 'DONE_WITH_CONCERNS', summary: 's', concerns: 'c', checks: [{ command: 'x', output: 'y', exit: 0 }] } : undefined);
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] }, over: withPlan([tk(1, true)], impl) });
  assert.ok(calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
});

test('I2: evidence that exited non-zero is not an effect that ran, and its request stays bare', async () => {
  const what = 'Write permission on the shared outbox for ' + deploy;
  const impl = (l) => (l === 'E1:t1:impl' ? { status: 'DONE', summary: 's', checks: [{ command: 'x', output: 'y', exit: 0 }], humanInputs: [{ what }] } : undefined);
  const evFail = (l) => (/gates-fix/.test(l) ? { status: 'BLOCKED', summary: 'no access' } : /:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'a2' : 'a3', clean: true, results: [{ ac: 'AC1', command: deploy, exit: 1, log: 'EACCES' }] } : undefined);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), impl, evFail) });
  assert.ok(calls.some((c) => /:evidence/.test(c.label)));
  assert.ok(!calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:AC1"'));
  assert.deepEqual(r.results[0].human, [what]);
});

test('real run: the same request stays while the command has not run', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(planRows([extRow]), asksAuth) });
  assert.ok(r.results[0].human.some((h) => /Operator authorization/.test(h)));
});

test('real run: spec, plan and implementer are told an authorization is never a human input', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  for (const l of ['E1:spec', 'E1:plan', 'E1:t1:impl']) assert.match(calls.find((c) => c.label === l).prompt, /Authorization of an external effect is never a humanInput/, l);
});

test('real run: the report gets the effects that ran and may not invent an action', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), evOk) });
  const p = calls.find((c) => c.label === 'report').prompt;
  assert.ok(p.includes('External effects authorized and run'));
  assert.ok(p.includes('"item":"E1:AC1"') && p.includes(deploy) && p.includes('"exit":0'));
  assert.ok(p.includes('Authorizations given for this run: ["E1:AC1"]'));
  assert.match(p, /only from Operator actions and the open human items/);
  assert.match(p, /never invent an action or resume args/);
  assert.match(p, /never ask for it again/);
});

test('real run: an authorized task that ran is reported too', async () => {
  const tasks = [tk(1, true)];
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T1'] }, over: withPlan(tasks) });
  assert.ok(calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
});

test('real run: programs that need a directory are run with cd, since a Bash call may start elsewhere', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { docsStage: { instructions: 'x', measure: 'm' } } });
  assert.ok(calls.find((c) => c.label === 'E1:test-integrity').prompt.includes('cd "/wt/E1" && node "/wt/_tmp/E1-integrity.cjs" "integracao/x"'));
  const m = calls.find((c) => c.label === 'E1:docs-measure1').prompt;
  assert.ok(m.includes('cd "/wt/_integracao" && node "/wt/_tmp/E1-docs-measure.cjs"'));
  assert.ok(!m.includes('check.mjs'));
  const res = await exec({ cards: [unfinished()], deliverables: ['E1'] });
  assert.ok(res.calls.find((c) => c.label === 'E1:resume-test-integrity').prompt.includes('cd "/wt/_tmp/E1-integrity-wt" && node "/wt/_tmp/E1-integrity.cjs" "e0^1"'));
});

// ---- leva 3, bloco A
test('decision 2: only the completion subject clears the mark in the progress read', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  const p = calls.find((c) => c.label === 'E1:progress').prompt;
  assert.match(p, /awaitingPerson = [^\n]*"E1 T<n> awaiting person:"[^\n]*"E1 T<n>: external effect completed"/);
  assert.match(p, /any other "E1 T<n>:" commit does not count/i);
});

test('decision 2: the action of a stop names the subject that clears the mark', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.match(x.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /"E1 T1: external effect completed"/);
});

test('decision 2: a mark that cannot be cleared names the completion subject', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (/clear-awaiting/.test(l) ? null : undefined)) });
  assert.ok(x.r.results[0].concerns.some((c) => /mark was not cleared/.test(c) && c.includes('"E1 T1: external effect completed"')));
});

test('a mark cleared with success raises no concern', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => pendingProgress(l) || (/clear-awaiting/.test(l) ? { ok: true } : undefined)) });
  assert.ok(x.labels.includes('E1:t1:clear-awaiting'));
  assert.equal(x.r.results[0].merged, true);
  assert.ok(!x.r.results[0].concerns.some((c) => /mark was not cleared/.test(c)));
});

test('resume: the range note names the spec and the plan of the resume', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: both((l) => (l === 'E1:plan' ? planWith(ext1) : undefined), pendingProgress, rerunRange) });
  const review = x.calls.find((c) => c.label === 'E1:t1:spec1').prompt;
  assert.match(review, /not extra scope[^\n]*docs\/plans\/x-E1\/spec\.md[^\n]*docs\/plans\/x-E1\/plan\.md[^\n]*not extra scope/);
});

test('decision 3: a quoted command is dispatched with its quotes', async () => {
  const q = '"./my tool"';
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] },
    over: both(planRows([cmdRow(q)]), (l) => (/:evidence/.test(l) ? { headSha: /:evidence1/.test(l) ? 'a2' : 'a3', clean: true, results: [{ ac: 'AC1', command: q, exit: 0 }] } : undefined)) });
  assert.equal(r.results[0].merged, true);
  assert.match(calls.find((c) => c.label === 'E1:evidence1').prompt, /^AC1: "\.\/my tool"$/m);
});

test('the progress read names the task numbers that awaitingPerson covers, so a mark-only task is not missed', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan([tk(1, true), tk(2, true)]) });
  assert.match(calls.find((c) => c.label === 'E1:progress').prompt, /awaitingPerson = every n of \[1, 2\] with a commit/);
});

const clearedProgress = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [] } : undefined);

test('resume after the mark was cleared: the review of an external task still gets the bookkeeping note', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, clearedProgress) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.match(x.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /awaiting person:[^\n]*not extra scope/);
});

test('resume of a task that is not external gets no bookkeeping note', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], clearedProgress) });
  assert.ok(!x.calls.find((c) => c.label === 'E1:t1:spec1').prompt.includes('awaiting person:'));
});

test('F1: the run record commit is bookkeeping for the review of a resumed task, external or not', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, clearedProgress) });
  assert.match(a.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /"E1: run record[^\n]*not extra scope/);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], clearedProgress) });
  assert.match(b.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /"E1: run record[^\n]*not extra scope/);
});

test('the docs stage explains the mark: a fulfilled request leaves pending, any other need stays', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), asksAuth, evOk) });
  const docs = calls.find((c) => c.label === 'E1:docs1').prompt;
  assert.ok(docs.includes(ranMark(deploy)));
  assert.match(docs, /marked "\[already authorized and run in this run: \.\.\.\]"[^\n]*only[^\n]*leave it out of pending[^\n]*any other need the item states stays open in pending/);
});

// ---- A2/A4: review model by task, plan-fix tier
const issueRev = (iss) => ({ issues: iss, headSha: 'a1', clean: true, commitsInRange: 2 });
const defect = { severity: 'critical', category: 'defeito', description: 'same defect', file: 'a.js' };
const modelOf = (calls, label) => calls.find((c) => c.label === label).opts;

test('task review model: opus by default for plain sonnet, opus and external tasks', async () => {
  const tasks = [tk(1, false), tk(2, false, { tier: 'opus' }), tk(3, true)];
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:T3'] }, over: withPlan(tasks) });
  assert.equal(modelOf(calls, 'E1:t1:spec1').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t2:spec1').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t3:spec1').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t3:spec1').effort, 'medium');
});

test('re-review after a fix escalated to opus runs at opus', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: withPlan([tk(1, false)], (l) => (/^E1:t1:spec[12]$/.test(l) ? issueRev([defect]) : /^E1:t1:spec-fix/.test(l) ? { status: 'DONE', summary: 'f', checks: [] } : undefined)) });
  assert.equal(modelOf(calls, 'E1:t1:spec-fix1').model, 'sonnet');
  assert.equal(modelOf(calls, 'E1:t1:spec2').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t1:spec-fix2').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t1:spec3').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t1:spec3').effort, 'medium');
});

test('plan fix starts at sonnet, the reviewer stays opus, and a repeated finding escalates the fix to opus', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (/^E1:plan-review[12]$/.test(l) ? { ...issueRev([defect]), measuredPlanBlob: B1 } : /^E1:plan-fix/.test(l) ? planWith([tk(1, false)]) : undefined) });
  assert.equal(modelOf(calls, 'E1:plan-fix1').model, 'sonnet');
  assert.equal(modelOf(calls, 'E1:plan-fix1').effort, 'medium');
  assert.equal(modelOf(calls, 'E1:plan-fix2').model, 'opus');
  assert.equal(modelOf(calls, 'E1:plan-review1').model, 'opus');
  assert.equal(modelOf(calls, 'E1:plan-review2').model, 'opus');
});

// ---- N5: the progress read of a plan with an external task
test('N5: progress runs at sonnet/medium and requires the mark lists when the plan has an external task', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  const p = modelOf(calls, 'E1:progress');
  assert.equal(p.model, 'sonnet');
  assert.equal(p.effort, 'medium');
  assert.ok(p.schema.required.includes('launchOpen') && p.schema.required.includes('effectMayHaveRun'));
});

test('N5: a plan without external tasks keeps the progress read as it was', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)]) });
  const p = calls.find((c) => c.label === 'E1:progress');
  assert.equal(p.opts.model, 'haiku');
  assert.equal(p.opts.effort, 'low');
  assert.ok(!p.opts.schema.required.includes('launchOpen'));
  assert.doesNotMatch(p.prompt, /launchOpen|launching/);
});

// ---- N6: a stop in a fix round
const fixStop = (l) => (l === 'E1:t1:spec-fix1' ? { status: 'NEEDS_HUMAN', summary: 'needs a key', checks: [], humanInputs: [{ what: 'fix key' }] } : reviewIssue(l));
const mayHaveRun = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [1] } : undefined);

test('N6: a stop in a fix round writes its own subject', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, fixStop) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt, /--allow-empty -m "E1 T1 awaiting person \(effect may have run\): /);
});

test('N6: the resume does not launch the implementer again, and its fixes carry no authorization', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(mayHaveRun, (l) => (l === 'E1:t1:spec-fix1' ? { status: 'DONE', summary: 'f', checks: [] } : reviewIssue(l)))) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.ok(!x.labels.includes('E1:t1:launching'));
  assert.ok(x.labels.includes('E1:t1:spec1'));
  const fix = x.calls.find((c) => c.label === 'E1:t1:spec-fix1').prompt;
  assert.doesNotMatch(fix, /the person AUTHORIZED it/);
  assert.match(fix, /Do NOT perform any external effect/);
  assert.equal(x.r.results[0].merged, true);
});

test('N6: the mark wins over the awaiting list and over a legacy reading', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1], launchOpen: [], effectMayHaveRun: [1] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
});

test('N6: the progress read also takes the old subject of a fix-round stop as may-have-run', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(calls.find((c) => c.label === 'E1:progress').prompt, /effectMayHaveRun = [^\n]*"E1 T<n> awaiting person: a fix round needs a person"/);
});

test('N6: may have run with no commit of the task stops and asks, never relaunches', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [1] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.equal(x.r.results[0].failKind, 'humano');
});

// ---- N7: the launch mark
const launchOpen = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [], launchOpen: [1], effectMayHaveRun: [] } : undefined);

test('N7: the launch mark is an empty commit in the worktree, before the implementer', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  const m = x.calls.find((c) => c.label === 'E1:t1:launching').prompt;
  assert.match(m, /git -C "\/wt\/E1" commit --allow-empty -m "E1 T1 launching"/);
  assert.ok(x.labels.indexOf('E1:t1:launching') < x.labels.indexOf('E1:t1:impl'));
  assert.ok(x.labels.indexOf('E1:t1:impl') < x.labels.indexOf('E1:t1:effect-completed'));
  assert.ok(x.labels.indexOf('E1:t1:effect-completed') < x.labels.indexOf('E1:t1:spec1'));
  assert.match(x.calls.find((c) => c.label === 'E1:t1:effect-completed').prompt, /--allow-empty -m "E1 T1: external effect completed"/);
  assert.equal(x.r.results[0].merged, true);
});

test('N7: the launch mark subject does not look like a task commit to the progress read', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(calls.find((c) => c.label === 'E1:progress').prompt, /--grep "\^E1 T<n>:"/);
  assert.ok(!/^E1 T1:/.test('E1 T1 launching'));
});

test('N7: without a written launch mark the implementer does not start', async () => {
  for (const bad of [null, { ok: false }, { ok: true }]) {
    const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:launching' ? bad : undefined)) });
    assert.ok(!x.labels.includes('E1:t1:impl'));
    assert.equal(x.r.results[0].failKind, 'infra');
  }
});

test('N7: the review range starts after the launch mark, so the marks do not stand for a commit', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /rev-list --count L1\.\.HEAD/);
});

test('N7: an implementer that reports DONE with only the completion mark in the range is a defect', async () => {
  const onlyMark = (l) => (l === 'E1:t1:spec1' ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 1 } : l === 'E1:t1:spec-fix1' ? { status: 'BLOCKED', summary: 'nothing to commit', checks: [] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, onlyMark) });
  assert.ok(x.labels.includes('E1:t1:spec-fix1'));
  assert.equal(x.r.results[0].merged, false);
});

test('N7: a crash between the effect and the commit stops and asks on resume, with the two ways out', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, launchOpen) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.ok(!x.labels.includes('E1:t1:launching'));
  assert.ok(!x.labels.includes('E1:merge'));
  assert.equal(x.r.results[0].failKind, 'humano');
  const act = x.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(act.what, /task 1/);
  assert.match(act.doNow, /checks outbox\.log first/);
  assert.match(act.doNow, /"E1 T1: external effect completed"/);
  assert.match(act.doNow, /"E1 T1 awaiting person: confirmed not run"/);
  assert.deepEqual(act.resumeWith.authorizeExternal, ['E1:T1@' + fpOf(ext1)]);
});

// ---- B4: the process dies after the launch mark and the resume replays the cache of the dead run
test('B4: kill after the launch mark, resume with the same cache: a fresh read stops for a person, nothing runs or commits again', async () => {
  const git = { launched: false, completed: false };
  const repo = (l) => {
    if (l === 'E1:t1:launching') { git.launched = true; return { ok: true, head: 'L1' }; }
    if (l === 'E1:progress') {
      return { head: git.launched ? 'L1' : 'h9', clean: true, done: git.completed ? [{ n: 1, firstParent: 'L1', last: 'C1' }] : [], awaitingPerson: [],
        launchOpen: git.launched && !git.completed ? [1] : [], effectMayHaveRun: [], effectCompleted: git.completed ? [1] : [] };
    }
    return undefined;
  };
  const j = makeJournal();
  // Run 1: authorized, writes the launch mark, dies while the implementer runs.
  await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-1' }, over: withPlan(ext1, repo), journal: j.start('E1:t1:impl') }).catch(() => null);
  assert.ok(git.launched, 'the launch mark was written before the kill');
  // Run 2: same script, same args, same cache; only the preflight of this call is new.
  const s2 = j.start();
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-2' }, over: withPlan(ext1, repo), journal: s2 });
  assert.ok(x.labels.includes('E1:progress'), 'the progress read runs live, not from the cache');
  assert.ok(!x.labels.includes('E1:t1:launching') && !s2.cached.includes('E1:t1:launching'), 'the launch step is not reached');
  assert.ok(!x.labels.includes('E1:t1:impl'), 'no new implementer');
  assert.ok(!x.labels.some((l) => /^E1:(review-log|awaiting-person|t1:effect-completed)/.test(l)), 'no commit on the branch');
  assert.equal(x.r.results[0].failKind, 'humano');
  const act = x.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(act.what, /task 1/);
  assert.match(act.doNow, /"E1 T1: external effect completed"/);
  // Run 3: the person confirmed the effect with the completion mark.
  git.completed = true;
  const y = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-3' }, over: withPlan(ext1, repo), journal: j.start() });
  assert.ok(!y.labels.includes('E1:t1:impl') && !y.labels.includes('E1:t1:launching'));
  assert.match(y.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"status":"confirmed by mark"/);
  assert.match(y.calls.find((c) => c.label === 'E1:review-log').prompt, /External effects run[\s\S]*"status":"confirmed by mark"/, 'the branch review log records it (B.L5 greps docs/)');
  assert.equal(y.r.results[0].merged, true);
});

test('B4: without a runToken the progress read may be a cached result, so an authorized external task is not launched', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: undefined }, over: withPlan(ext1) });
  assert.ok(!x.labels.includes('E1:t1:launching'));
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.equal(x.r.status, 'error');  // FF/M6: stops before discovery
  assert.match(x.r.error, /runToken/);
});

test('B4/I1: a kill after the merge of E3, then a resume with the same cache: the fresh discovery sees the merge and the unfinished-merge guard fires', async () => {
  const git = { e3merged: false };
  const cards = () => [git.e3merged ? card('E3', { status: 'executando', onTarget: true, mergeFound: true, mergeSha: 'e1' }) : card('E3'), card('E4')];
  const merges = (l) => { if (l === 'E3:merge') git.e3merged = true; return undefined; };
  const j = makeJournal();
  await exec({ cards, deliverables: ['E3'], args: { runToken: 'pf-1' }, over: merges, journal: j.start(/^E3:merge-gates1/) }).catch(() => null);
  assert.ok(git.e3merged, 'E3 merged before the kill');
  const x = await exec({ cards, deliverables: ['E4'], args: { runToken: 'pf-2' }, over: merges, journal: j.start() });
  assert.ok(x.labels.includes('discovery'), 'the discovery runs live');
  const act = x.r.operatorActions.find((o) => o.kind === 'unfinished-merge');
  assert.ok(act, 'unfinished-merge');
  assert.equal(act.deliverable, 'E3');
  assert.ok(!x.labels.some((l) => /^E4:/.test(l)), 'E4 does not start on an unvalidated target');
});

// I2: a guard in the implementer itself, for a resume whose prefix (launch mark included) all came from the cache.
// The implementer follows the guard where the prompt puts it: right before the effect, after any lock need (git.needsLock).
const startedRepo = (git) => (l, p) => {
  if (l === 'E1:t1:launching') { git.marks.push('launching'); return { ok: true, head: 'L' + git.marks.length }; }
  if (l === 'E1:progress') return { head: 'h9', clean: true, done: [], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [], effectCompleted: [] };
  if (/^E1:t1:impl/.test(l)) {
    git.impls = (git.impls || 0) + 1;
    assert.match(p, /Immediately before the effect \(before its duplicate check, after any code, test or lock need, so a BLOCKED for a lock writes nothing\): in integracao\/x\.\.HEAD, if a commit whose subject starts "E1 T1 started" is newer than the newest one starting "E1 T1 launching", return NEEDS_HUMAN at once/);
    assert.doesNotMatch(p, /FIRST, before anything else/);
    if (git.needsLock && !p.includes('You HOLD the lock(s): ' + git.needsLock)) return { status: 'BLOCKED', summary: 'needs the lock', needsLock: git.needsLock, checks: [] };
    if (git.marks.lastIndexOf('started') > git.marks.lastIndexOf('launching')) return { status: 'NEEDS_HUMAN', summary: 'the effect may have started in an earlier run', checks: [], humanInputs: [{ what: 'did the effect run?' }] };
    git.marks.push('started');
    git.effects += 1;
    return { status: 'DONE', summary: 'published', checks: [] };
  }
  return undefined;
};

// B5: a task whose plan lists no file makes no commit of its own; only the marks may be in its range.
const rev = (n) => ({ issues: [], headSha: 'a1', clean: true, commitsInRange: n });
test('B5: an external task with no files passes with only its started and completion marks in the range, no fix round', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan([tk(1, true, { files: [], noCommit: true })], (l) => (/^E1:t1:(spec|quality)\d$/.test(l) ? rev(2) : undefined)) });
  assert.ok(!x.labels.some((l) => /^E1:t1:.*fix/.test(l)), x.labels.join(','));
  assert.equal(x.r.results[0].merged, true);
  assert.match(x.calls.find((c) => c.label === 'E1:t1:impl').prompt, /changes no file: make no commit of your own/);
});

test('B5: a local task with no files passes with an empty range; a task with files still needs its own commit', async () => {
  const none = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false, { files: [], noCommit: true })], (l) => (/^E1:t1:(spec|quality)\d$/.test(l) ? rev(0) : undefined)) });
  assert.ok(!none.labels.some((l) => /^E1:t1:.*fix/.test(l)));
  const some = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false, { files: ['src/a.js'] })], (l) => (/^E1:t1:(spec|quality)\d$/.test(l) ? rev(0) : l === 'E1:t1:spec-fix1' ? { status: 'BLOCKED', summary: 'x', checks: [] } : undefined)) });
  assert.ok(some.labels.includes('E1:t1:spec-fix1'));
});

test('B5: the count finding says what was expected, marks included, and a task fix may not edit the spec or the plan', async () => {
  let fixIssue = '';
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l, p) => (/^E1:t1:spec1$/.test(l) ? rev(1) : l === 'E1:t1:spec-fix1' ? { status: 'BLOCKED', summary: 'x', checks: [] } : undefined)) });
  fixIssue = x.calls.find((c) => c.label === 'E1:t1:spec-fix1').prompt;
  assert.match(fixIssue, /fewer commits than expected in the range \(L1\.\.HEAD: 1 < 3; the started and completion marks count; missing a started or completion mark\?\)/);
  assert.match(fixIssue, /Never edit the spec .* or the plan .* to satisfy a finding/);
});

// Review 3, I-1: an empty files list alone may be a reading failure; only an explicit noCommit lowers the minimum.
test('R3/I-1: files [] without noCommit still needs its own commit and the implementer is told to commit', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false, { files: [] })], (l) => (/^E1:t1:(spec|quality)\d$/.test(l) ? rev(0) : l === 'E1:t1:spec-fix1' ? { status: 'BLOCKED', summary: 'x', checks: [] } : undefined)) });
  assert.ok(x.labels.includes('E1:t1:spec-fix1'));
  assert.match(x.calls.find((c) => c.label === 'E1:t1:impl').prompt, /Commit "E1 T1: \.\.\."/);
});

test('R3/I-1: the plan review checks the noCommit flags of the tasks the code reads from the emit', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const r = x.calls.find((c) => c.label === 'E1:plan-review1').prompt;
  assert.match(r, /these external and noCommit flags and the files lists decide what is held and how many commits a task must leave, so compare each one with the plan file, and a flag or list that differs from the file is a defect/);
  assert.match(r, /a task with noCommit true whose steps change or commit a file/);
});

// Review 3, I-2: no fixer edits the approved spec or plan to satisfy a finding.
test('R3/I-2: the gates and final fixers may not edit the spec or the plan, and their reviews block it', async () => {
  let g = 0;
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => {
      if (l === 'E1:gates1-2' && g++ === 0) return gm('a2', { exit: 1, failedNames: ['new'] });
      if (l === 'E1:gates-fix1') return { status: 'DONE', summary: 'f', checks: [] };
      if (l === 'E1:final-1-r1') return { issues: [{ severity: 'important', category: 'defeito', description: 'd' }], headSha: 'a1', clean: true, commitsInRange: 2 };
      if (l === 'E1:final-fix1') return { status: 'DONE', summary: 'f', checks: [] };
      return undefined;
    } });
  const rule = /Never edit the spec docs\/plans\/x-E1\/spec\.md or the plan docs\/plans\/x-E1\/plan\.md to satisfy a finding: they are approved, so if an item can only be met by changing them, do not apply it and explain in concerns\./;
  for (const l of ['E1:gates-fix1', 'E1:final-fix1']) assert.match(x.calls.find((c) => c.label === l).prompt, rule, l);
  assert.match(x.calls.find((c) => c.label === 'E1:gates-fix1-review').prompt, /Blocks \(defeito\):[^\n]*an edit to the spec or the plan/);
  // E24: the generic final-review text moved to the agent; the round with previous findings still carries the rule through it.
  const fr2 = x.calls.find((c) => c.label === 'E1:final-1-r2');
  assert.equal(fr2.opts.agentType, 'productivity-tools:final-reviewer');
  assert.match(fr2.prompt, /Mode: review/);
  assert.match(fr2.prompt, /Previous issues[^\n]*:\n[^\n]*\bd\b/);
  const agentMd = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'agents', 'final-reviewer.md'), 'utf8');
  const reviewMode = agentMd.slice(agentMd.indexOf('## Review mode'), agentMd.indexOf('## Verify mode'));
  assert.ok(reviewMode.includes('Previous issues') && reviewMode.includes('Blocks (defeito): an edit to the spec or the plan made by a fix round'));
});

test('R3/I-2: the post-merge fixer may not edit the spec or the plan, and its review blocks it', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (/^E1:merge-gates1/.test(l) ? gm('e1', { exit: 1, failedNames: ['new'] }) : l === 'E1:merge-fix' ? { status: 'DONE', summary: 'x', checks: [] } : undefined) });
  assert.match(x.calls.find((c) => c.label === 'E1:merge-fix').prompt, /Do not mask failures\. Never edit the spec docs\/plans\/x-E1\/spec\.md or the plan docs\/plans\/x-E1\/plan\.md to satisfy a finding/);
  assert.match(x.calls.find((c) => c.label === 'E1:merge-fix-review').prompt, /Blocks \(defeito\):[^\n]*an edit to the spec or the plan/);
});

test('R3: the count finding hints at a missing mark when the minimum includes marks', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (/^E1:t1:spec1$/.test(l) ? rev(1) : l === 'E1:t1:spec-fix1' ? { status: 'BLOCKED', summary: 'x', checks: [] } : undefined)) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:spec-fix1').prompt, /1 < 3; the started and completion marks count; missing a started or completion mark\?\)/);
});

// Final gate (portão final) of the branch.
const OWNER_PUSH = "except merging the target into the integration branch and pushing it, which are the owner's (a criterion that needs them is a human act)";
test('PF/I1: push is the owner\'s except for an authorized external task; spec and plan rules exempt the merge and push of the target', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  const P = (l) => x.calls.find((c) => c.label === l).prompt;
  assert.match(P('E1:t1:impl'), /NEVER push, except the effect of a task you were told is external and AUTHORIZED\./);
  for (const l of ['E1:spec-review1', 'E1:plan', 'E1:plan-review1']) assert.ok(P(l).includes(OWNER_PUSH), l);
  const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'SKILL.md'), 'utf8');
  assert.match(skill, /Never push yourself; only an authorized external task of the plan may \(operator\.md\)\./);
});

test('PF/I2 and M12: the plan orders an external task after the code it ships, and the question warns when a task effect and an evidence row run', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const plan = x.calls.find((c) => c.label === 'E1:plan').prompt;
  assert.match(plan, /Order an external task after every task whose code it ships\./);
  assert.match(plan, /runs again after every gates fix and every late sync/);
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const op = readFileSync(join(dir, 'references', 'operator.md'), 'utf8');
  assert.ok(op.includes('For a task item the question also says that the effect runs on the deliverable branch before its final review, gates and merge, so a later review may reject code that already took effect.'));
  assert.ok(op.includes('it runs again after every gates fix and late sync, after its duplicate check'));
  // SKILL.md step 6 keeps the short form and points to operator.md (FF/I3).
  const skill = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  assert.ok(skill.includes('A task item runs its effect on the deliverable branch before its final review, gates and merge.'));
  assert.ok(skill.includes('An `E<n>:AC<k>` item runs again after every gates fix and late sync.'));
});

test('PF/I3 and M1, M5, M10, M11: the docs point to CLAUDE.md, agree on the fix round, the resume token, the marks and the source rules', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const cfg = readFileSync(join(dir, 'references', 'config.md'), 'utf8');
  assert.ok(cfg.includes('Project rules for every briefing. Prefer the one-line pointer the preflight derives (`Project rules: CLAUDE.md at the repository root (already in your context; if not, read it).`): the text is pasted into every agent prompt, about 40 per deliverable. May be an empty string.'));
  assert.ok(!cfg.includes('a hand-written config is unchanged'));
  const skill = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  assert.ok(!skill.includes('across every fix round and resume'));
  assert.ok(skill.includes('A fix round never runs the effect again: it stops for a person.'));
  assert.ok(skill.includes('replacing `config` and `runToken` with the ones from the new preflight'));
  assert.match(skill, /For a `human-input` about an open launch \(it asks for an empty commit [^)]*confirmed not run`\), write that empty commit only when the person states the outcome in their own message; never infer it\./);
  const op = readFileSync(join(dir, 'references', 'operator.md'), 'utf8');
  assert.ok(skill.includes('If the names are lost too, resume without new items') && op.includes('If the names are lost too, resume without new items'));
  assert.ok(op.includes('(not `Resume args` of the report, which holds only what was already authorized)'));  // kept out of SKILL.md on purpose (prompts.test)
});

test('PF/M2: the late-sync fixer may not edit the spec or the plan, and its re-review blocks it', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (l === 'E1:delta-review1' ? { issues: [{ severity: 'important', category: 'defeito', description: 'd' }], headSha: 'a3', clean: true, commitsInRange: 0 } : l === 'E1:delta-fix1' ? { status: 'DONE', summary: 'f', checks: [] } : undefined) });
  assert.match(x.calls.find((c) => c.label === 'E1:delta-fix1').prompt, /Never edit the spec docs\/plans\/x-E1\/spec\.md or the plan docs\/plans\/x-E1\/plan\.md to satisfy a finding/);
  assert.match(x.calls.find((c) => c.label === 'E1:delta-review2').prompt, /Blocks \(defeito\):[^\n]*an edit to the spec or the plan made by a fix round/);
});

test('PF/M3: the plan fix returns files and noCommit with the plan stage rule', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: (l) => (/^E1:plan-review1$/.test(l) ? { issues: [{ severity: 'important', category: 'defeito', description: 'd' }], headSha: 'a1', clean: true, commitsInRange: 2, measuredPlanBlob: B1 } : /^E1:plan-fix/.test(l) ? planWith([tk(1, false)]) : undefined) });
  assert.match(x.calls.find((c) => c.label === 'E1:plan-fix1').prompt, /tasks \(full list, with files copied from the plan, noCommit \(same rule as the plan stage\), tier, reviewTier, needsLock, external and externalDedupe\)/);
});

test('PF/M6: the common briefing drops the delivery-stage and integration-worktree sentences; spec, plan and implementer keep them', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const mech = x.calls.filter((k) => /^(E1:cleanup|E1:gates1-1|E1:merge)$/.test(k.label));
  assert.deepEqual(mech.map((k) => k.label).sort(), ['E1:cleanup', 'E1:gates1-1', 'E1:merge'], 'the list matched the three remaining calls (git-truth is gone), so the loop below is not vacuous');
  for (const c of mech) {
    assert.doesNotMatch(c.prompt, /there is no other delivery stage/, c.label);
    assert.doesNotMatch(c.prompt, /No task of the plan runs there/, c.label);
  }
  for (const l of ['E1:spec', 'E1:plan']) assert.match(x.calls.find((c) => c.label === l).prompt, /there is no other delivery stage, so an external effect the card or the spec requires is performed by an external task of the plan/, l);
  assert.match(x.calls.find((c) => c.label === 'E1:t1:impl').prompt, /no task of the plan runs in the integration worktree/);
});

test('PF/M7, M8, M9: report wording for unreviewed entries, one entry per task item, and a BLOCKED launch says how to close it', async () => {
  const log = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', command: 't1', status: 'DONE', reviewed: false }] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(completedMark, log)) });
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.equal((rep.match(/External effects authorized and run: (.*)/)[1].match(/"item":"E1:T1"/g) || []).length, 1);
  const y = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? { status: 'BLOCKED', summary: 'no', checks: [] } : l === 'E1:t1:spec1' ? undefined : undefined)) });
  assert.match(y.r.results[0].error, /its launch mark stays open: before running again add `E1 T1 awaiting person: confirmed not run` if the effect did not start/);
  const z = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:spec1' ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 1 } : l === 'E1:t1:spec-fix1' ? { status: 'BLOCKED', summary: 'x', checks: [] } : undefined)) });
  assert.match(z.calls.find((c) => c.label === 'report').prompt, /has not passed review in this run \(it may not have been reviewed yet\)/);
});

// Fable final review (FF).
const FF_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ffRead = (f) => readFileSync(join(FF_DIR, f), 'utf8');
const KEEP_IF_SAME = 'if the instruction changes nothing, leave the file untouched.';
test('FF/I1: an answer in notes that changes nothing keeps the plan blob, the fingerprint and the authorization', async () => {
  const run1 = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  const hi = run1.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(hi.doNow, /stays valid only if the spec and plan files come out unchanged; an answer that changes them is a replan and the authorization is asked again \(pass the bare `E1:T1` in your own message to re-authorize together with the answer\)/);
  const { config, ...rw } = hi.resumeWith;
  const reused = (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, taskCommits: 1, committedTasks: [1], nativeSpec: true, nativePlan: true }
    : l === 'E1:spec-commit' ? { ok: true, head: 'a1', commit: '', pending: '' }
    : l === 'E1:plan-commit' ? { ok: true, head: 'a1', commit: '', pending: '' }
    : l === 'E1:plan-load1' ? planLoadOf(planWith(ext1), 'E1')
    : l === 'E1:progress' ? { head: 'h9', clean: true, done: [], awaitingPerson: [1], launchOpen: [], effectMayHaveRun: [], effectCompleted: [] } : undefined);
  const run2 = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...rw, notes: { E1: 'the key is in DEPLOY_KEY' }, runToken: 'pf-2' }, over: reused });
  assert.ok(run2.calls.find((c) => c.label === 'E1:plan').prompt.includes(KEEP_IF_SAME));
  const author = run2.calls.find((c) => c.label === 'E1:spec').prompt;
  assert.ok(author.includes('the key is in DEPLOY_KEY') && author.includes('A ruling the instruction does not change keeps its id and its text.'));
  assert.ok(run2.labels.includes('E1:spec-commit'));
  assert.ok(!run2.r.operatorActions.some((o) => o.kind === 'authorize-external'));
  assert.ok(run2.labels.includes('E1:t1:launching') && run2.labels.includes('E1:t1:impl'));
  for (const f of ['SKILL.md', join('references', 'operator.md')]) assert.ok(ffRead(f).includes('An answer in `notes` that changes the spec or the plan is a replan: the bound item is dropped and the question comes back.'), f);
});

const MECH = ['E1:gates1-1', 'E1:regates1-1', 'E1:merge-gates1-1', 'E1:evidence1', 'E1:sync', 'E1:resync', 'E1:merge', 'E1:review-log', 'report'];
test('FF/I2: mechanical agents get the slim briefing with the rules they act on; deciding agents and docs keep the full one', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { conflictRules: 'regen lockfiles' } });
  const P = (l) => { const c = x.calls.find((k) => k.label === l); assert.ok(c, l); return c.prompt; };
  for (const l of MECH) {
    const p = P(l);
    assert.match(p, /FIXED RULES \(mechanical stage\):/, l);
    for (const s of ['NEVER push', 'NEVER use git stash or git add -A', 'Never write or quote a credential, token or key', 'Temporary files only in /wt/_tmp/', 'NEVER perform an external effect', 'only agents told they HOLD a lock', 'Asking the user is FORBIDDEN', 'Conflicts in generated files: regen lockfiles', 'PROJECT:', 'INTEGRATION WORKTREE']) assert.ok(p.includes(s), `${l}: ${s}`);
    for (const s of ['Reviewers classify each problem', 'Roadmap "do not" restrictions', 'Tracked roadmap in']) assert.ok(!p.includes(s), `${l} has ${s}`);
  }
  for (const l of ['E1:spec', 'E1:plan', 'E1:t1:impl', 'E1:t1:spec1', 'E1:final-1-r1', 'E1:docs1']) assert.match(P(l), /FIXED RULES:\n- Tracked roadmap in/, l);
  assert.ok(ffRead(join('references', 'operator.md')).includes('A resume never uses the Workflow cache'));
});

test('FF/I3: SKILL.md step 6 is short numbered sub-items pointing to operator.md, which holds the full wording', () => {
  const skill = ffRead('SKILL.md');
  const step6 = skill.slice(skill.indexOf('6. **Report.**'));
  assert.ok(step6.split('\n').every((line) => line.length <= 600), 'no long line in step 6');
  assert.ok((step6.match(/\n {3}\d\. \*\*/g) || []).length >= 5, 'numbered sub-items');
  assert.ok(!skill.includes('actions; Deduplicate'));
  assert.doesNotMatch(skill, /Resume args/);
  const op = ffRead(join('references', 'operator.md'));
  for (const s of ['Name a `gate:<id>` item by the gate id and its command', 'Offer any other `resumeWith` to the person and run it only on their go-ahead', 'for `gate:` and `checkout:` items, the `deliverables` of the run being resumed', 'Never answer from memory', 'Before resuming I will run git show']) assert.ok(op.includes(s), s);
});

test('FF/I4: wtRoot comes from the skill; without it the run stops before discovery, and the discovery no longer guesses it', async () => {
  const none = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { wtRoot: undefined } });
  assert.equal(none.r.status, 'error');
  assert.match(none.r.error, /wtRoot/);
  assert.equal(none.labels.length, 0);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'dry-run' } });
  assert.doesNotMatch(x.calls[0].prompt, /common parent directory|_integracao|\/wt/);  // E10: the discover command names no worktree folder
  assert.ok(!('wtRoot' in x.r.selection) && !x.calls[0].opts.schema.required.includes('wtRoot'));
  const skill = ffRead('SKILL.md');
  assert.ok(skill.includes('Let `wtRoot` be `<dirname(repo)>/<basename(repo)>-wt`'));
  assert.ok(skill.includes('checked out somewhere other than `<wtRoot>/_integracao`'));
  assert.ok(skill.includes('under `<wtRoot>/_tmp/`'));
});

test('FF/M2, M3, M9: resume notes without an answer, preflight output, the human-input row', () => {
  assert.ok(ffRead('SKILL.md').includes('when the person gives no answer, remove the `notes` entry that still holds `<...>` before resuming'));
  assert.ok(ffRead(join('references', 'config.md')).includes('{ configPath, generated, errors, missingRules, warnings, config, runToken }'));
  assert.ok(ffRead(join('references', 'operator.md')).includes('Provide it in `notes` and run again; for an open launch (the `doNow` names an empty commit) write that commit instead.'));
});

test('FF/M6: an authorized task item without a runToken stops before discovery', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: undefined } });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /runToken/);
  assert.equal(x.labels.length, 0);
});

test('E25 AC2: without config the workflow errors before any agent call', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { config: undefined } });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /args\.config is missing/);
  assert.equal(x.labels.length, 0);
});

test('E25 AC2: without a runToken and with no authorized item, every mode errors before any agent call', async () => {
  for (const mode of ['run', 'plan-only', 'dry-run']) {
    const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode, runToken: undefined } });
    assert.equal(x.r.status, 'error', mode);
    assert.match(x.r.error, /runToken is missing: launch the workflow through the roadmap-release skill/, mode);
    assert.equal(x.labels.length, 0, mode);
  }
});

test('E25 AC2: a whitespace-only runToken counts as missing', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { runToken: '   ' } });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /runToken is missing: launch the workflow through the roadmap-release skill/);
  assert.equal(x.labels.length, 0);
});

test('E25 AC2: a malformed authorizeExternal keeps its own error without a runToken', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: 42, runToken: undefined } });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /authorizeExternal must be a list/);
  assert.doesNotMatch(x.r.error, /runToken/);
  assert.equal(x.labels.length, 0);
});

test('FF/M8: a local task that waited for a person closes with a neutral mark, which also clears the wait', async () => {
  const prog = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1], launchOpen: [], effectMayHaveRun: [], effectCompleted: [] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], prog) });
  const m = x.calls.find((c) => c.label === 'E1:t1:clear-awaiting').prompt;
  assert.match(m, /--allow-empty -m "E1 T1: resumed after awaiting person"/);
  assert.doesNotMatch(m, /external effect completed/);
  assert.match(x.calls.find((c) => c.label === 'E1:progress').prompt, /"E1 T<n>: external effect completed" or "E1 T<n>: resumed after awaiting person"/);
});

// Fable review 2 (F2).
test('F2/I-A: a note that changed no file stays in resumeWith; a note written into the plan is consumed', async () => {
  const reused = (v) => (l) => (l === 'E1:spec-commit' ? { ok: true, head: 'a1', commit: v ? '' : 'c1', ...(v ? { pending: '' } : {}) }
    : l === 'E1:plan-commit' ? { ok: true, head: 'a1', commit: v ? '' : 'c1', ...(v ? { pending: '' } : {}) }
    : l === 'E1:t1:impl' ? { status: 'BLOCKED', summary: 'stop', checks: [] } : undefined);
  const kept = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'the key is in DEPLOY_KEY' } }, over: reused(true) });
  assert.equal(kept.r.resumeArgs.notes && kept.r.resumeArgs.notes.E1, 'the key is in DEPLOY_KEY');
  const consumed = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'the key is in DEPLOY_KEY' } }, over: reused(false) });
  assert.ok(!(consumed.r.resumeArgs.notes && consumed.r.resumeArgs.notes.E1));
});

test('F2/m1: the neutral resume mark is bookkeeping for the task reviews', async () => {
  const prog = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1], launchOpen: [], effectMayHaveRun: [], effectCompleted: [] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)], prog) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /"E1 T1: resumed after awaiting person"/);
});

test('F2/m2: an authorized task item of any deliverable id without a runToken stops before discovery', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['UDV-3:T1'], runToken: undefined } });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /runToken/);
  assert.equal(x.labels.length, 0);
});

test('F2/m3, m5: wtRoot is defined in step 1, before step 3 uses it; step 6.6 points to operator.md', () => {
  const skill = ffRead('SKILL.md');
  const def = skill.indexOf('Let `wtRoot` be `<dirname(repo)>/<basename(repo)>-wt`');
  assert.ok(def > 0 && def < skill.indexOf('3. **Generated config.**'));
  assert.match(skill, /6\. \*\*No source\.\*\*[^\n]*Details: operator\.md item 3\./);
});

test('F2/m4: a first sync that resolved conflicts goes through the conflict review, like the late sync', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:sync' ? { ok: true, head: 'a2', conflictsResolved: 2, targetTip: 'abc1234', deltaFiles: [] } : l === 'E1:sync-review' ? { issues: [], headSha: 'a2', clean: true, commitsInRange: 0 } : undefined) });
  assert.ok(x.labels.includes('E1:sync-review'), x.labels.join(','));
  assert.ok(x.labels.indexOf('E1:sync-review') < x.labels.indexOf('E1:test-integrity'));
});

test('F2/B7: a stop for authorization counts the tasks already done', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false), tk(2, true)]) });
  assert.ok(x.r.operatorActions.some((o) => o.kind === 'authorize-external'));
  assert.equal(x.r.results[0].tasks, 1);
});

test('B4/I-A: an implementer BLOCKED for a lock writes nothing, and the impl-lock retry runs the effect exactly once', async () => {
  const git = { marks: [], effects: 0, needsLock: 'db' };
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: both(withPlan(ext1), startedRepo(git)) });
  assert.ok(x.labels.includes('E1:t1:impl-lock'));
  assert.equal(git.effects, 1);
  assert.ok(!x.r.operatorActions.some((o) => o.kind === 'human-input'));
  assert.equal(x.r.results[0].merged, true);
});

test('B4/I2: a resume with the SAME token as the dead run: the implementer finds its own started mark and stops, no second effect', async () => {
  const git = { marks: [], effects: 0 };
  const j = makeJournal();
  await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-1' }, over: both(withPlan(ext1), startedRepo(git)), journal: j.start('E1:t1:impl', true) }).catch(() => null);
  assert.equal(git.effects, 1, 'the dead run had already run the effect');
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-1' }, over: both(withPlan(ext1), startedRepo(git)), journal: j.start() });
  assert.equal(git.effects, 1, 'no second effect');
  assert.ok(!x.labels.includes('E1:t1:launching'), 'the launch mark came from the cache');
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.ok(x.r.operatorActions.some((o) => o.kind === 'human-input'));
  assert.ok(!x.labels.includes('E1:merge'));
});

test('B4/I2: a death after the launch mark but before started relaunches with the same token, and the effect runs once', async () => {
  const git = { marks: [], effects: 0 };
  const j = makeJournal();
  await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-1' }, over: both(withPlan(ext1), startedRepo(git)), journal: j.start('E1:t1:impl') }).catch(() => null);
  assert.deepEqual(git.marks, ['launching']);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { ...extArgs, runToken: 'pf-1' }, over: both(withPlan(ext1), startedRepo(git)), journal: j.start() });
  assert.equal(git.effects, 1);
  assert.equal(x.r.results[0].merged, true);
});

test('B4/I2: the started mark is a launch mark for the progress read, bookkeeping for the reviews, and counts in the review range', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  const p = x.calls.find((c) => c.label === 'E1:progress').prompt;
  assert.match(p, /take the newest commit[^\n]*"E1 T<n> started"/);
  assert.match(p, /launchOpen = the n whose newest such commit starts "E1 T<n> launching", "E1 T<n> started"/);
  assert.match(x.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /"E1 T1 started"/);
  // launch mark .. HEAD holds started + the task commit + the completion mark: two commits are a defect, three pass.
  const two = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:spec1' ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 2 } : l === 'E1:t1:spec-fix1' ? { status: 'BLOCKED', summary: 'x', checks: [] } : undefined)) });
  assert.ok(two.labels.includes('E1:t1:spec-fix1'));
  const three = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (/^E1:t1:(spec|quality)1$/.test(l) ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 3 } : undefined)) });
  assert.ok(!three.labels.includes('E1:t1:spec-fix1'));
  assert.equal(three.r.results[0].merged, true);
});

test('B4: the runToken never comes back in resume args, so a resume must take a fresh one from its preflight', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, launchOpen) });
  assert.equal(!!x.r.resumeArgs && 'runToken' in x.r.resumeArgs, false);
  for (const o of x.r.operatorActions) assert.equal(!!o.resumeWith && 'runToken' in o.resumeWith, false, o.kind);
  assert.equal(x.labels[0], 'discovery');
  assert.match(x.calls[0].prompt, /--nonce 'pf-test'/);  // E10: the token is the nonce of the discover command
  assert.ok(x.calls.slice(1).every((c) => !c.prompt.includes('pf-test')), 'the token is only in the discovery read (the first agent call)');
});

test('N7: an open launch mark stops even when the awaiting list or the done list also name the task', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs,
    over: withPlan(ext1, (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1], launchOpen: [1], effectMayHaveRun: [] } : undefined)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  assert.equal(x.r.results[0].failKind, 'humano');
});

test('N7: an implementer that returns BLOCKED or null leaves the launch open: no completion mark', async () => {
  for (const v of [{ status: 'BLOCKED', summary: 'b', checks: [] }, null]) {
    const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? v : undefined)) });
    assert.ok(x.labels.includes('E1:t1:launching'));
    assert.ok(!x.labels.includes('E1:t1:effect-completed'));
    assert.ok(!x.labels.includes('E1:merge'));
  }
});

test('N7: the implementer stop of NEEDS_HUMAN closes the launch with the awaiting mark, not with a completion', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.ok(x.labels.includes('E1:t1:awaiting-person'));
  assert.ok(!x.labels.includes('E1:t1:effect-completed'));
});

test('N7: a completion mark that cannot be written is a concern naming the subject', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:effect-completed' ? null : undefined)) });
  assert.ok(x.r.results[0].concerns.some((c) => c.includes('"E1 T1: external effect completed"')));
});

test('N7: a task without external writes no mark at all', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)]) });
  assert.ok(!x.labels.some((l) => /launching|effect-completed/.test(l)));
});

// ---- N8: the external runs survive in the review log
const ranLog = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve E1:T1 please' }], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', status: 'DONE', reviewed: false }] } : undefined);

test('N8: the effect is recorded even when the review rejects, and goes to the failed log', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, fixStop) });
  const log = x.calls.find((c) => c.label === 'E1:review-log-failed').prompt;
  assert.match(log, /External effects run/);
  assert.match(log, /"externalRun":\[\{"item":"E1:T1"[^\]]*"reviewed":false/);
  assert.match(x.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"reviewed":false/);
});

test('N8: an effect that passed its reviews is recorded as reviewed', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(x.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"reviewed":true/);
});

test('N8: the log is written for a recorded effect even with no review to persist', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (/^E1:(spec|plan)-review/.test(l) ? undefined : /^E1:t1:spec1b?$/.test(l) ? null : undefined)) });
  assert.ok(x.labels.includes('E1:review-log-failed'));
});

test('N8: the resume reads the log and the report does not ask again for what ran', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(ranLog, clearedProgress)) });
  const read = x.calls.find((c) => c.label === 'E1:resume-review-log');
  assert.match(read.prompt, /externalRun = /);
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /External effects authorized and run: \[\{"item":"E1:T1"/);
  assert.equal((rep.match(/External effects authorized and run: (.*)/)[1].match(/"item":"E1:T1"/g) || []).length, 1);
  assert.match(x.r.results[0].human[0], /already authorized and run/);
});

// ---- final-gate corrections
const evMock = (l) => (l === 'E1:merge-effects' ? { head: 'e1', commit: 'e1' } : undefined);
test('I1: an external evidence effect reaches the log on the target right after the merge', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), evOk, evMock) });
  assert.ok(x.labels.indexOf('E1:merge') < x.labels.indexOf('E1:merge-effects'));
  assert.ok(x.labels.indexOf('E1:merge-effects') < x.labels.indexOf('E1:docs1'));
  const p = x.calls.find((c) => c.label === 'E1:merge-effects').prompt;
  assert.match(p, /External effects run/);
  assert.ok(p.includes('"item":"E1:AC1"') && p.includes(deploy));
  assert.equal(x.r.results[0].merged, true);
});

test('I1: no evidence effect means no extra agent; a failed write is a concern', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.ok(!a.labels.includes('E1:merge-effects'));
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { authorizeExternal: ['E1:AC1'] }, over: both(planRows([extRow]), evOk, (l) => (l === 'E1:merge-effects' ? null : undefined)) });
  assert.ok(b.r.results[0].concerns.some((c) => /External effects run|external effects/i.test(c) && c.includes('E1:AC1')));
});

test('I1: a finish-merge reads the effect back and marks the human item', async () => {
  const log = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve ' + deploy }], ac: [], externalRun: [{ item: 'E1:AC1', command: deploy, exit: 0 }] } : undefined);
  const x = await exec({ cards: [unfinished()], deliverables: ['E1'], over: log });
  assert.ok(x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:AC1"'));
  assert.match(x.r.results[0].human[0], /already authorized and run/);
});

const completedMark = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [], effectCompleted: [1] } : undefined);
const askLog = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve E1:T1 please' }], ac: [] } : undefined);

test('I2: a completed mark with nothing in the log is recorded, reviewed, and marks the human item', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(completedMark, askLog)) });
  assert.ok(!x.labels.includes('E1:t1:impl'));
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /"item":"E1:T1"[^\n]*"status":"confirmed by mark"[^\n]*"reviewed":true/);
  assert.match(x.r.results[0].human[0], /already authorized and run/);
  assert.ok(x.calls.find((c) => c.label === 'E1:progress').opts.schema.required.includes('effectCompleted'));
});

test('I2: an entry already restored from the log is not replaced by the mark', async () => {
  const log = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', status: 'DONE', reviewed: false }] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(completedMark, log)) });
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.doesNotMatch(rep, /confirmed by mark"/);
  assert.equal((rep.match(/External effects authorized and run: (.*)/)[1].match(/"item":"E1:T1"/g) || []).length, 1);
});

test('I2: a confirmed task skipped as already reviewed is reported as reviewed', async () => {
  const tasks = [tk(1, true), tk(2, false)];
  const prog = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p1', last: 'c1' }, { n: 2, firstParent: 'p2', last: 'c2' }], awaitingPerson: [], launchOpen: [], effectMayHaveRun: [], effectCompleted: [1] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(tasks, prog) });
  assert.ok(!x.labels.includes('E1:t1:spec1'));
  assert.match(x.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"reviewed":true/);
});

test('I3: NEEDS_HUMAN after an authorized launch writes the unknown mark, which the resume reads as doubt', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : undefined)) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt, /-m "E1 T1 awaiting person \(effect unknown\): /);
  const p = x.calls.find((c) => c.label === 'E1:progress').prompt;
  assert.match(p, /launchOpen = [^\n]*"E1 T<n> awaiting person \(effect unknown\):"[^\n]*"E1 T<n> awaiting person: external effect did not complete"/);
  const act = x.r.operatorActions.find((o) => o.kind === 'human-input');
  assert.match(act.doNow, /"E1 T1 awaiting person: confirmed not run"/);
  assert.doesNotMatch(act.what + act.doNow + x.r.results[0].error, /did not complete|the task runs again and/);
  assert.ok(!x.calls.find((c) => c.label === 'report').prompt.includes('"item":"E1:T1"'));
});

test('I3: the authorized implementer is told when NEEDS_HUMAN is allowed', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1) });
  assert.match(x.calls.find((c) => c.label === 'E1:t1:impl').prompt, /If you need a person, return NEEDS_HUMAN and say in the summary whether the effect started; report DONE or DONE_WITH_CONCERNS only when the effect finished/);
});

// An agent that follows the note: a partial effect is reported as the note orders.
const followsNote = (p, needs) => (/report DONE or DONE_WITH_CONCERNS only when the effect finished|If this fix needs the effect run again, return NEEDS_HUMAN/.test(p)
  ? { status: 'NEEDS_HUMAN', summary: 'effect started, needs a key', checks: [], humanInputs: [{ what: needs }] }
  : { status: 'DONE_WITH_CONCERNS', summary: 'partial', checks: [], humanInputs: [{ what: needs }] });

test('R1: a partial effect that needs a person does not merge', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: (l, p) => (l === 'E1:plan' ? planWith(ext1) : l === 'E1:t1:impl' ? followsNote(p, 'deploy key') : undefined) });
  assert.equal(x.r.results[0].merged, false);
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.ok(x.labels.includes('E1:t1:awaiting-person'));
  assert.ok(!x.labels.includes('E1:t1:effect-completed'));
  assert.ok(!x.labels.includes('E1:merge'));
});

test('R1: NEEDS_HUMAN in a fix round stops again', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: (l, p) => (l === 'E1:plan' ? planWith(ext1) : l === 'E1:t1:spec-fix1' ? followsNote(p, 'fix key') : reviewIssue(l)) });
  assert.equal(x.r.results[0].merged, false);
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.match(x.calls.find((c) => c.label === 'E1:t1:awaiting-person').prompt, /awaiting person \(effect may have run\):/);
  assert.ok(!x.labels.includes('E1:merge'));
});

test('R2: with an open launch an old log line does not reach the report as an effect that ran', async () => {
  const stale = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve E1:T1 please [already authorized and run in this run: E1:T1]' }], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', status: 'DONE', reviewed: false }] } : undefined);
  const prog = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [], launchOpen: [1], effectMayHaveRun: [], effectCompleted: [] } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(prog, stale)) });
  assert.equal(x.r.results[0].failKind, 'humano');
  assert.ok(!x.labels.includes('E1:t1:impl'));
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /External effects authorized and run: \[\]/);
  assert.doesNotMatch(x.r.results[0].human[0], /already authorized and run/);
});

const notRun = (l) => (l === 'E1:progress' ? { head: 'h9', clean: true, done: [{ n: 1, firstParent: 'p', last: 'c' }], awaitingPerson: [1], launchOpen: [], effectMayHaveRun: [], effectCompleted: [] } : undefined);
const staleLog = (l) => (l === 'E1:resume-review-log' ? { found: true, acceptedRisks: [], humanInputs: [{ what: 'approve E1:T1 please [already authorized and run in this run: E1:T1]' }], ac: [], externalRun: [{ item: 'E1:T1', title: 't1', status: 'DONE', reviewed: false }] } : undefined);

test('I4: after confirmed not run the restored entry and its human mark are gone', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan(ext1, both(notRun, staleLog, (l) => (/:setup$/.test(l) ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, reused: true } : undefined))) });
  assert.equal(x.r.results[0].failKind, 'externo');
  const rep = x.calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /External effects authorized and run: \[\]/);
  assert.doesNotMatch(x.r.results[0].human[0], /already authorized and run/);
  assert.ok(x.r.operatorActions.some((o) => o.kind === 'authorize-external'));
});

test('I4: a relaunch after confirmed not run records the effect again', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, both(notRun, staleLog)) });
  assert.match(x.calls.find((c) => c.label === 'report').prompt, /"item":"E1:T1"[^\n]*"reviewed":true/);
});

test('M5/M6: the texts of a stop match what a resume does', async () => {
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, fixStop) });
  assert.doesNotMatch(a.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /stays awaiting/);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], args: extArgs, over: withPlan(ext1, (l) => (l === 'E1:t1:impl' ? needsHuman : /awaiting-person/.test(l) ? null : undefined)) });
  assert.match(b.r.operatorActions.find((o) => o.kind === 'human-input').doNow, /stop and ask/);
});

test('N8: a task without external writes no externalRun data to its log', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)]) });
  for (const c of x.calls.filter((k) => /review-log/.test(k.label) && !/resume/.test(k.label))) assert.doesNotMatch(c.prompt, /externalRun|External effects run/);
});

test('assembled prompts: every task runs in the deliverable worktree before the merge (spec, plan, both reviews)', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const rule = /runs in the deliverable worktree \S+ on \S+ before the merge; no task of the plan runs in the integration worktree \(the workflow's own merge, post-merge gates and docs stages run there\)/;
  for (const l of ['E1:spec', 'E1:plan']) {
    const p = calls.find((c) => c.label === l).prompt;
    assert.match(p, rule, l);
    assert.doesNotMatch(p, /\$\{wt\}|\$\{br\}|undefined/, l);
  }
  assert.match(calls.find((c) => c.label === 'E1:plan').prompt, /`external: true`, except merging the target into the integration branch and pushing it, which are the owner's \(a criterion that needs them is a human act\); "not a task of this plan" does not apply to it/);
  assert.match(calls.find((c) => c.label === 'E1:spec-review1').prompt, /a task of the plan, or an external effect of the design, run after the merge, in the integration worktree or in the target \(defeito\)/);
  assert.match(calls.find((c) => c.label === 'E1:plan-review1').prompt, /a task of the plan, or an external effect, marked to run after the merge, in the integration worktree or in the target \(defeito, critical\)/);
  const planP = calls.find((c) => c.label === 'E1:plan').prompt;
  assert.match(planP, /only reads a local file outside the branch[^\n]*is not external; when in doubt, true/);
  assert.equal((planP.match(/only reads a local file outside the branch/g) || []).length, 2, 'task rule and evidence-row rule');
  assert.match(calls.find((c) => c.label === 'E1:plan-review1').prompt, /an external effect that the card or the spec requires \(a delivery, a send, a deploy\) and that no task declared external performs/);
  assert.ok(!calls.some((c) => /No task of the plan runs there/.test(c.prompt)), 'not in the common briefing (M6)');
  assert.match(calls.find((c) => c.label === 'E1:t1:impl').prompt, /in that worktree \(no task of the plan runs in the integration worktree\)/);
});

// ---------------------------------------------------------------- E18 T3: registro pela CLI (funções puras)

test('shq: aspas simples POSIX, quebra de linha vira espaço', () => {
  assert.equal(PU.shq("a'b"), "'a'\\''b'");
  assert.equal(PU.shq('a$b`c"d'), "'a$b`c\"d'");
  assert.equal(PU.shq('a\nb'), "'a b'");
  assert.equal(PU.shq('a\r\nb'), "'a b'");
});

test('shq: o Git Bash entrega o texto literal', (t) => {
  const bash = gitBash();
  const ok = bash && !/system32|windowsapps/i.test(bash) && spawnSync(bash, ['-c', 'true']).status === 0;
  if (!ok) { t.skip('Git Bash não resolvido por git --exec-path'); return; }
  for (const x of ["it's", 'cost $HOME `id` "q"', "a'b'c", 'x\\y', 'l1\nl2']) {
    const r = spawnSync(bash, ['-c', 'printf %s ' + PU.shq(x)]);
    assert.equal(r.stdout.toString(), x.replace(/\r?\n/g, ' '), JSON.stringify(x));
  }
});

test('fitCell: cabe -> igual com espaços juntados; longo -> corta em palavra com o sufixo da origem', () => {
  assert.deepEqual(PU.fitCell('a   b\n c', 300, 'docs/s.md', 'pt'), { text: 'a b c', cut: '' });
  const long = Array.from({ length: 120 }, (_, i) => 'palavra' + i).join(' ');
  assert.ok(long.length > 600);
  const r = PU.fitCell(long, 300, 'docs/s.md', 'pt-BR');
  assert.ok(r.text.length <= 300);
  assert.match(r.text, /\[\.\.\.\] texto completo em docs\/s\.md$/);
  assert.equal(r.cut, long);
  const body = r.text.replace(/ \[\.\.\.\] texto completo em docs\/s\.md$/, '');
  assert.ok(long.startsWith(body) && /^palavra\d+$/.test(body.split(' ').pop()), 'fronteira de palavra');
  const en = PU.fitCell(long, 300, 'docs/s.md', 'en');
  assert.match(en.text, /\[\.\.\.\] full text in docs\/s\.md$/);
  const room = 300 - 'Alcance: contrato.'.length - 1;
  const d = PU.fitCell(long, room, 'docs/s.md', 'pt');
  assert.ok(d.text.length <= room);
});

test('fitEvidence: mantém o prefixo cuja junção com crases cabe', () => {
  const refs = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40), 'd'.repeat(40), 'e'.repeat(40)];
  const out = PU.fitEvidence(refs, 120);
  assert.deepEqual(out, refs.slice(0, 2));
  assert.ok(out.map((r) => '`' + r + '`').join(', ').length <= 120);
  assert.deepEqual(PU.fitEvidence(refs, 10000), refs);
  assert.deepEqual(PU.fitEvidence(refs, 5), []);
});

test('cliCmd: caminho entre aspas duplas, pasta por shq, --json no fim', () => {
  assert.equal(PU.cliCmd('D:/x/roadmap.mjs', 'status', 'docs/plans/r/', []), `node "D:/x/roadmap.mjs" status 'docs/plans/r/' --json`);
  assert.equal(PU.cliCmd('D:/x/roadmap.mjs', 'set-status', 'docs/plans/r/', ["'E1'", "'plano'"]), `node "D:/x/roadmap.mjs" set-status 'docs/plans/r/' 'E1' 'plano' --json`);
});

test('phrases: pt e en, curtas e citam entregável e status', () => {
  for (const lang of ['pt-BR', 'en']) {
    const P = PU.phrases(lang);
    assert.equal(P.owner, lang === 'en' ? 'owner' : 'dono');
    for (const s of [P.log('E1', 'plano'), P.next('E1', 'plano'), P.inflightNote('E1'), P.blockWhat('E1', 'motivo'), P.blockUnblocks('E1'), P.blockHow('E1'), P.commit('E1', 'plano')]) {
      assert.ok(typeof s === 'string' && s.length > 0 && s.length < 300);
      assert.doesNotMatch(s, /this commit|este commit/i);
    }
    assert.match(P.log('E1', 'plano'), /E1/);
    assert.equal(P.critNoEvidence('E15', 'AC1', 'human'), lang === 'en' ? 'E15: criterion AC1 has no automatic evidence (human)' : 'E15: critério AC1 sem evidência automática (human)');
    assert.equal(P.critNoEvidence('E22', 'AC1', 'human', 'BLQ-3'), lang === 'en' ? 'E22: criterion AC1 has no automatic evidence (human, BLQ-3)' : 'E22: critério AC1 sem evidência automática (human, BLQ-3)');
    assert.notEqual(P.critNoEvidence('E15', 'AC1', 'human'), P.critNoEvidence('E22', 'AC1', 'human'));
    assert.match(P.log('E1', 'plano'), /plano/);
    assert.match(P.commit('E1', 'plano'), /E1/);
  }
});

const RC = { cli: 'D:/x/roadmap.mjs', folder: 'docs/plans/r/', E: 'E1', word: 'plano', evidence: ['docs/s.md', 'docs/p.md'], lang: 'pt-BR', cellChars: 300, source: 'docs/s.md', blockedStatus: 'bloqueado' };
const verbs = (cmds) => cmds.map((c) => c.split(' ')[2]);

test('recordCommands: sem rótulo não há --piece; com piece, set-status e block-open o levam', () => {
  const a = PU.recordCommands(RC);
  assert.ok(!a.error);
  assert.deepEqual(verbs(a.commands), ['set-status', 'log']);
  assert.ok(a.commands.every((c) => !/--piece/.test(c)));
  assert.match(a.commands[0], /^node "D:\/x\/roadmap\.mjs" set-status 'docs\/plans\/r\/' 'E1' 'plano' .*--json$/);
  assert.match(a.commands[0], /--evidence 'docs\/s\.md' --evidence 'docs\/p\.md'/);
  const b = PU.recordCommands({ ...RC, piece: 'code' });
  assert.match(b.commands[0], /--piece 'code'/);
  assert.match(b.commands[1], /^node "D:\/x\/roadmap\.mjs" log 'docs\/plans\/r\/' --deliverable 'E1' --what '/);
  const c = PU.recordCommands({ ...RC, piece: 'code', word: 'bloqueado', logWhat: 'falta credencial' });
  assert.deepEqual(verbs(c.commands), ['block-open']);
  assert.match(c.commands[0], /--piece 'code'/);
  assert.match(c.commands[0], /--affects 'E1'/);
  assert.match(c.commands[0], /--what '[^']*falta credencial/);
  assert.match(c.commands[0], /--unblocks '/);
  assert.match(c.commands[0], /--evidence 'docs\/s\.md'/);
  assert.ok(!c.commands.some((x) => / set-status /.test(x)));
});

test('recordCommands: skipStatus omite set-status e log; a ordem é a do registro', () => {
  const x = PU.recordCommands({ ...RC, skipStatus: true, decisions: [{ text: 'Usar X.', scope: 'local' }], pending: ['p1'], inflight: { add: 'feat/E1' } });
  assert.deepEqual(verbs(x.commands), ['add-decision', 'add-pending', 'inflight-add']);
  const y = PU.recordCommands({
    ...RC, blockedBy: { id: 'BLQ-3', affects: ['E1'] }, word: 'executando',
    decisions: [{ text: 'Usar X.', scope: 'local' }, { text: 'Usar Y.', scope: 'contrato' }], pending: ['p1', 'p2'], inflight: { remove: 'feat/E1' },
  });
  assert.deepEqual(verbs(y.commands), ['block-close', 'set-status', 'log', 'add-decision', 'add-decision', 'add-pending', 'add-pending', 'inflight-remove']);
  assert.match(y.commands[0], /block-close 'docs\/plans\/r\/' 'BLQ-3' --how '/);
  assert.match(y.commands[3], /--deliverable 'E1' --decision 'Usar X\.' --scope 'local'/);
  assert.match(y.commands[4], /--scope 'contrato'/);
  assert.match(y.commands[5], /--owner 'dono' --text 'p1'/);
  assert.match(y.commands[7], /inflight-remove 'docs\/plans\/r\/' 'feat\/E1' --json$/);
  const z = PU.recordCommands({ ...RC, lang: 'en', skipStatus: true, inflight: { add: 'feat/E1', note: 'running' }, pending: ['p'] });
  assert.match(z.commands.find((c) => / add-pending /.test(c)), /--owner 'owner'/);
  assert.match(z.commands.find((c) => / inflight-add /.test(c)), /inflight-add 'docs\/plans\/r\/' 'feat\/E1' --note 'running' --json$/);
});

test('recordCommands: decisão de 600 caracteres cabe com a frase de alcance e o texto inteiro vai em cuts', () => {
  const long = Array.from({ length: 100 }, (_, i) => 'termo' + i).join(' ');
  assert.ok(long.length > 600);
  const r = PU.recordCommands({ ...RC, skipStatus: true, decisions: [{ text: long, scope: 'contrato' }] });
  const m = /--decision '([^']*)'/.exec(r.commands[0]);
  assert.ok(m);
  assert.ok(m[1].length + 1 + 'Alcance: contrato.'.length <= 300);
  assert.equal(r.cuts.length, 1);
  assert.equal(r.cuts[0].full, long);
  assert.equal(r.cuts[0].source, 'docs/s.md');
  assert.ok(r.cuts[0].where);
  const p = PU.recordCommands({ ...RC, skipStatus: true, pending: [long] });
  const t = /--text '([^']*)'/.exec(p.commands[0])[1];
  assert.ok(('(dono) ' + t).length <= 300);
  assert.equal(p.cuts[0].full, long);
});

test('recordCommands: bloqueio que afeta outros entregáveis é erro de fechamento manual', () => {
  const r = PU.recordCommands({ ...RC, word: 'executando', blockedBy: { id: 'BLQ-3', affects: ['E1', 'E2'] } });
  assert.match(r.error, /manual/i);
  assert.match(r.error, /BLQ-3/);
  assert.deepEqual(r.commands, []);
});

// ---- recordVerdict
const okOut = (command, result = {}, changed = ['state.md']) => JSON.stringify({ tool: 'roadmap', command, folder: 'f', changed, result, errors: [], warnings: [], summary: { errors: 0, warnings: 0, exitCode: 0 } });
const panelOut = (word, { label = '', note = '' } = {}) => okOut('status', { panel: [{ id: 'E1', segments: [{ label, word, position: 3, note }], evidence: '', next: '' }] }, []);
const briefOut = (errors = 0) => okOut('brief', { checker: { errors, warnings: 0, stale: false } }, []);
const pendOut = (ids) => okOut('pending-decisions', { decisions: ids.map((id) => ({ id })) }, []);
const VX = () => {
  const expected = PU.recordCommands({ ...RC, decisions: [{ text: 'Usar X.', scope: 'local' }] }).commands;
  const runs = [
    { command: expected[0], exit: 0, stdout: okOut('set-status') },
    { command: expected[1], exit: 0, stdout: okOut('log') },
    { command: expected[2], exit: 0, stdout: okOut('add-decision', { id: 'DEC-300', existing: false }) },
  ];
  const read = { status: panelOut('plano'), brief: briefOut(0), pendingDecisions: pendOut(['DEC-300']), head: 'abc', porcelain: '' };
  return { expected, results: { runs }, read, E: 'E1', word: 'plano', piece: undefined, blockedStatus: 'bloqueado' };
};
const bad = (mut, re) => {
  const v = VX();
  mut(v);
  const r = PU.recordVerdict(v);
  assert.equal(r.ok, false);
  assert.ok(r.failures.length > 0);
  if (re) assert.match(r.failures.join('\n'), re);
};
const failJson = (exitCode, errors) => JSON.stringify({ tool: 'roadmap', summary: { exitCode }, errors, changed: [], result: {} });

test('recordVerdict: aprovado, com o id da decisão', () => {
  const r = PU.recordVerdict(VX());
  assert.deepEqual(r, { ok: true, failures: [], decisionIds: ['DEC-300'], holdIds: ['DEC-300'] });
});

test('recordVerdict: holdIds keeps a decision add-decision found existing only while pending-decisions still lists it', () => {
  const existing = (pending) => {
    const v = VX();
    v.results.runs[2].stdout = JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, errors: [], changed: [], result: { id: 'DEC-300', existing: true } });
    v.read.pendingDecisions = pendOut(pending);
    return PU.recordVerdict(v);
  };
  const ratified = existing([]);
  assert.equal(ratified.ok, true, ratified.failures.join('\n'));
  assert.deepEqual(ratified.decisionIds, ['DEC-300']);
  assert.deepEqual(ratified.holdIds, []);
  assert.deepEqual(existing(['DEC-300']).holdIds, ['DEC-300']);
  const missing = VX();
  missing.results.runs[2].stdout = JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, errors: [], changed: [], result: { id: 'DEC-300', existing: true } });
  missing.read.pendingDecisions = '';
  assert.deepEqual(PU.recordVerdict(missing).holdIds, ['DEC-300'], 'without a readable pending list an existing decision still holds (fail safe)');
});

test('recordVerdict: reprova comando faltando, fora de ordem e com texto diferente', () => {
  bad((v) => { v.results.runs.pop(); }, /missing/i);
  bad((v) => { v.results.runs.reverse(); }, /order/i);
  bad((v) => { v.results.runs[1].command = v.results.runs[1].command.replace('--what', '--what x'); }, /differ|text/i);
});

test('recordVerdict: a run names its command by n, so an abbreviated echo and the git commit steps do not fail it (E8 record)', () => {
  const v = VX();
  v.results.runs = v.results.runs.map((r, i) => ({ n: i + 1, command: i ? 'node "...roadmap.mjs" ' + PU.cliVerb(r.command) + ' ... --json' : r.command, exit: r.exit, stdout: r.stdout }));
  v.results.runs.push({ command: 'git -C "D:/wt/_integracao" add -- "docs/plans/roadmap-x/" ; git diff --cached --quiet (check)', exit: 1, stdout: 'warning: LF will be replaced by CRLF' });
  v.results.runs.push({ command: "git -C \"D:/wt/_integracao\" commit -m 'docs(roadmap): E1 em plano'", exit: 0, stdout: '[release 30c0cb1] docs(roadmap): E1 em plano' });
  const r = PU.recordVerdict(v);
  assert.deepEqual(r, { ok: true, failures: [], decisionIds: ['DEC-300'], holdIds: ['DEC-300'] });
  bad((x) => { x.results.runs = x.results.runs.map((r, i) => ({ ...r, n: [2, 1, 3][i] })); }, /order/i);
  bad((x) => { x.results.runs = x.results.runs.map((r, i) => ({ ...r, n: i ? i + 1 : 4 })); }, /command 1 ran with a different/);
  bad((x) => { x.results.runs.push({ n: 4, command: x.expected[1], exit: 0, stdout: okOut('log') }); }, /beyond/i);
});

test('recordVerdict: reprova exit, stdout fora do contrato da CLI e erros no JSON', () => {
  bad((v) => { v.results.runs[0].exit = 1; }, /exit/);
  bad((v) => { v.results.runs[0].stdout = 'roadmap set-status: changed 1 file'; }, /JSON/);
  bad((v) => { v.results.runs[0].stdout = JSON.stringify({ tool: 'outra', summary: { exitCode: 0 }, errors: [] }); }, /tool/);
  bad((v) => { v.results.runs[0].stdout = failJson(1, []); }, /exitCode/);
  bad((v) => { v.results.runs[2].stdout = failJson(0, [{ code: 'x' }]); }, /error/i);
  bad((v) => { v.results.runs[2].exit = 1; v.results.runs[2].stdout = failJson(1, [{ code: 'x' }]); });
});

test('recordVerdict: reprova releitura com outra palavra e brief ausente, sem checker ou com erros', () => {
  bad((v) => { v.read.status = panelOut('spec'); }, /plano/);
  bad((v) => { v.read.status = ''; }, /status/i);
  bad((v) => { v.read.brief = ''; }, /brief/);
  bad((v) => { v.read.brief = 'not json'; }, /brief/);
  bad((v) => { v.read.brief = okOut('brief', { strategy: {} }, []); }, /checker/);
  bad((v) => { v.read.brief = okOut('brief', { checker: { errors: '0' } }, []); }, /checker/);
  bad((v) => { v.read.brief = briefOut(2); }, /checker/);
  bad((v) => { delete v.read.brief; }, /brief/);
});

test('recordVerdict: releitura com painel de uma linha só do E1 passa; linha de outro id reprova', () => {
  const v = VX();
  assert.equal(JSON.parse(v.read.status).result.panel.length, 1);
  assert.equal(PU.recordVerdict(v).ok, true);
  bad((x) => { x.read.status = panelOut('plano').replace('"id":"E1"', '"id":"E2"'); }, /reread panel has no segment of E1/);
});

// E37 T9 (S2-08, C5): a refused status re-read names the refusal; "no panel" stays for a status that is missing.
test('recordVerdict: refused status re-read cites the code, or none when the JSON has no errors or is not JSON (E37 T9)', () => {
  bad((v) => { v.read.status = failJson(1, [{ code: 'deliverable-unknown' }]); }, /^reread status --json refused: deliverable-unknown$/m);
  bad((v) => { v.read.status = failJson(1, [{ code: 'a' }, { code: 'b' }]); }, /^reread status --json refused: a, b$/m);
  bad((v) => { v.read.status = failJson(1, [{ code: 'deliverable-unknown' }]); }, /^(?!.*has no panel)/s);
  const noCode = VX();
  noCode.read.status = JSON.stringify({ tool: 'roadmap', summary: { exitCode: 1 }, result: {} });
  assert.deepEqual(PU.recordVerdict(noCode).failures, ['reread status --json refused']);
  const notJson = VX();
  notJson.read.status = null;
  notJson.read.exits = { status: 2 };
  assert.deepEqual(PU.recordVerdict(notJson).failures, ['reread status --json refused']);
  const missing = VX();
  missing.read.status = null;
  missing.read.exits = { status: 0 };
  assert.deepEqual(PU.recordVerdict(missing).failures, ['reread status --json is missing or has no panel']);
  const plain = VX();
  plain.read.status = '';
  assert.deepEqual(PU.recordVerdict(plain).failures, ['reread status --json is missing or has no panel']);
});

test('docs stage: a refused status re-read reaches the verdict with its code and the fix round cites it (E37 T9)', async () => {
  const over = (l, prompt) => {
    if (!/^E1:docs-read\d$/.test(l)) return undefined;
    const p = verifyArg(prompt, 'read');
    const ok = (stdout) => ({ exit: 0, stdout });
    const d = buildRead({ status: { exit: 1, stdout: failJson(1, [{ code: 'deliverable-unknown' }]) }, brief: ok(readWith('e').brief), pending: ok(''), head: ok('m2'), porcelain: ok('') }, p.deliverable);
    return { exit: 0, stdout: sliceStdout({ tool: 'verify-run', mode: 'read', nonce: p.nonce }, JSON.stringify(canon(d)), p.slice === undefined ? 0 : p.slice) };
  };
  const { calls, r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.match(calls.find((c) => c.label === 'E1:docs2').prompt, /reread status --json refused: deliverable-unknown/);
  assert.equal(r.results[0].merge.docsOk, false);
});

test('status --deliverable: a releitura e o docs-measure pedem só a linha do E; nenhum prompt chama status sem a flag', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  for (const l of ['E1:status-d-read', 'E1:docs-read1']) {
    const p = verifyArg(calls.find((c) => c.label === l).prompt, 'read');
    assert.equal(p.deliverable, 'E1', l);
    assert.match(p.cli, /roadmap\.mjs$/, l);
  }
  for (const c of calls.filter((x) => x.label !== 'discovery')) {
    for (const m of plain(c.prompt).matchAll(/roadmap\.mjs" status '[^']*'([^\n;]*)/g)) {
      assert.match(m[1], /--deliverable E\d+ --json/, c.label);
    }
  }
});

test('recordVerdict: segmento rotulado, bloqueado com a nota BLQ e id de decisão ausente', () => {
  const v = VX();
  v.piece = 'code';
  v.read.status = panelOut('plano', { label: 'code' });
  assert.equal(PU.recordVerdict(v).ok, true);
  v.read.status = panelOut('plano', { label: 'acceptance' });
  assert.equal(PU.recordVerdict(v).ok, false);
  const b = VX();
  b.word = 'bloqueado';
  b.expected = PU.recordCommands({ ...RC, word: 'bloqueado', logWhat: 'motivo' }).commands;
  b.results.runs = [{ command: b.expected[0], exit: 0, stdout: okOut('block-open', { id: 'BLQ-9', affects: ['E1'] }) }];
  b.read.status = panelOut('bloqueado', { note: 'BLQ-9' });
  assert.equal(PU.recordVerdict(b).ok, true);
  b.read.status = panelOut('bloqueado', { note: 'BLQ-8' });
  assert.equal(PU.recordVerdict(b).ok, false);
  b.read.status = panelOut('bloqueado');
  assert.equal(PU.recordVerdict(b).ok, false);
  bad((x) => { x.read.pendingDecisions = pendOut(['DEC-1']); }, /DEC-300/);
  bad((x) => { x.read.pendingDecisions = ''; }, /pending/i);
});

test('recordVerdict: no-bash e lista vazia reprovam; frases do agente não decidem', () => {
  bad((v) => { v.results = { error: 'no-bash', runs: [] }; }, /no-bash/);
  bad((v) => { v.results = { runs: [] }; });
  bad((v) => {
    v.results.statusWritten = 'ok';
    v.results.details = 'tudo certo';
    v.read.status = panelOut('spec');
  });
  const ok = VX();
  ok.results.statusWritten = 'failed';
  ok.results.details = 'deu errado';
  assert.equal(PU.recordVerdict(ok).ok, true);
});

test('recordVerdict: status --json sem checker ao lado de um brief sem erro é aprovado', () => {
  const v = VX();
  assert.ok(!('checker' in JSON.parse(v.read.status).result));
  assert.equal(PU.recordVerdict(v).ok, true);
});

test('recordVerdict: trackerCli com espaços no caminho não perde o verbo (BLQ e decisões)', () => {
  const sp = (c) => c.replace(/^node "[^"]*"/, 'node "C:/Users/Nome Sobrenome/.claude/roadmap.mjs"');
  const v = VX();
  v.expected = v.expected.map(sp);
  v.results.runs = v.results.runs.map((r) => ({ ...r, command: sp(r.command) }));
  v.read.pendingDecisions = pendOut(['DEC-1']);
  const r = PU.recordVerdict(v);
  assert.equal(r.ok, false);
  assert.deepEqual(r.decisionIds, ['DEC-300']);
  assert.match(r.failures.join('\n'), /DEC-300/);
  const b = VX();
  b.word = 'bloqueado';
  b.expected = PU.recordCommands({ ...RC, word: 'bloqueado', logWhat: 'motivo' }).commands.map(sp);
  b.results.runs = [{ command: b.expected[0], exit: 0, stdout: okOut('block-open', { id: 'BLQ-9', affects: ['E1'] }) }];
  b.read.status = panelOut('bloqueado', { note: 'BLQ-8' });
  assert.equal(PU.recordVerdict(b).ok, false);
});

// ---- E18 T4: registro do status pela CLI do tracker, com veredito por código
const statusPrompts = (calls) => calls.filter((c) => /:status-/.test(c.label));
const readWith = (word, over = {}) => ({
  status: cliJson({ result: { panel: [{ id: 'E1', segments: [{ label: '', word, note: '' }] }] } }),
  brief: cliJson({ result: { checker: { errors: 0 } } }),
  pendingDecisions: cliJson({ result: { decisions: [] } }),
  head: 'abc1234',
  porcelain: '',
  ...over,
});
const badPlan = noHeader;

test('AC2 registro de plano e executando pela CLI', async () => {
  const humanSpec = specWith({ rulings: [ruling({ id: 'R1', decision: 'escolha A.', scope: 'local' }), ruling({ id: 'R2', decision: 'escolha B', scope: 'contract' })], needsPerson: [np({ id: 'H1', what: 'precisa de credencial' })] });
  const full = await exec({ cards: [card('E1')], deliverables: ['E1'], over: humanSpec });
  const po = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: humanSpec });
  const plan = plain(po.calls.find((c) => c.label === 'E1:status-c').prompt);
  const exe = plain(full.calls.find((c) => c.label === 'E1:status-d').prompt);
  for (const p of [plan, exe]) {
    assert.match(p, /node "\/p\/productivity-tools\/skills\/roadmap-tracker\/scripts\/roadmap\.mjs" set-status '[^']*' /);
    assert.match(p, /node "\/p\/productivity-tools\/skills\/roadmap-tracker\/scripts\/roadmap\.mjs" log /);
    assert.match(p, /--deliverable 'E1'/);
    assert.match(p, /add-decision '[^']*' --deliverable 'E1' --decision 'escolha A\.' --scope 'local'/);
    assert.match(p, /add-decision '[^']*' --deliverable 'E1' --decision 'escolha B' --scope 'contrato'/);
    assert.match(p, /add-pending '[^']*' --owner 'owner' --text 'precisa de credencial'/);
  }
  assert.match(exe, /inflight-add '[^']*' 'feat\/E1'/);
  assert.doesNotMatch(plan, /inflight-add/);
  for (const c of [...statusPrompts(po.calls), ...statusPrompts(full.calls)]) assert.doesNotMatch(plain(c.prompt), /roadmap-tracker(?!\/scripts\/roadmap\.mjs)/, c.label);
  assert.equal(full.r.results[0].merged, true);
  assert.deepEqual(full.r.results[0].concerns, []);
});

test('AC3 releitura com outra palavra reprova por código', async () => {
  const wrong = (l) => (/:status-.*-read$/.test(l) ? readWith('zzz') : undefined);
  const po = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: wrong });
  assert.ok(po.r.results[0].error);
  assert.equal(po.r.results[0].failKind, 'infra');
  assert.match(po.r.results[0].error, /zzz/);
  const run = await exec({ cards: [card('E1')], deliverables: ['E1'], over: wrong });
  assert.ok(run.r.results[0].concerns.some((x) => /"executing" roadmap record failed/.test(x)));
});

test('AC3 add-decision com erro da CLI reprova', async () => {
  const bad = (l, prompt) => {
    if (!/:status-[a-z]+$/.test(l)) return undefined;
    const runs = promptCommands(prompt).map((command) => (/add-decision/.test(command)
      ? { command, exit: 1, stdout: cliJson({ summary: { exitCode: 1 }, errors: [{ code: 'x' }] }) }
      : { command, exit: 0, stdout: cliJson() }));
    return { exit: 0, stdout: groupStdout(prompt, runs) };
  };
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: both(specWith({ rulings: [ruling({})] }), bad) });
  assert.equal(r.results[0].failKind, 'infra');
  assert.match(r.results[0].error, /add-decision/);
});

test('AC3 stdout que não é JSON da CLI, ou comando omitido, reprova', async () => {
  const mk = (alter) => (l, prompt) => (/:status-[a-z]+$/.test(l) ? { exit: 0, stdout: groupStdout(prompt, alter(promptCommands(prompt).map((command) => ({ command, exit: 0, stdout: cliJson() })))) } : undefined);
  const notJson = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: mk((runs) => runs.map((x, i) => (i === 0 ? { ...x, stdout: 'OK done' } : x))) });
  assert.equal(notJson.r.results[0].failKind, 'infra');
  assert.match(notJson.r.results[0].error, /not JSON/);
  const omitted = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: mk((runs) => runs.slice(1)) });
  assert.equal(omitted.r.results[0].failKind, 'infra');
  assert.match(omitted.r.results[0].error, /missing|different text/);
});

test('AC3 no-bash reprova', async () => {
  // E10: the script-runner has no list to return empty, so a run without Bash is an output that no digest confirms: the null record agent.
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: (l) => (/:status-[a-z]+(-retry\d)?$/.test(l) ? { exit: -1, stdout: '' } : undefined) });
  assert.ok(r.results[0].error);
  assert.match(r.results[0].error, /null record agent/);
});

// ANTES: the calls of this very script (one deliverable, one task, no failure, mode run) as measured in commit 3a1d3de, before E10: 39, the last two being git-truth and report
// (docs/plans/evolucao-skills-E10/assertion-map.md, section ANTES, keeps the label list). E10 moves the git truth into the report call.
const ANTES = 39;
test('E10 AC3: the happy path of a one-task deliverable makes ANTES - 1 calls, no git-truth, status write before read', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(r.results[0].merged, true);
  // E41 B2: + 1 for `E1:prune-evidence` (capture.mjs prune, once per merged deliverable, after the cleanup) and + 7 for the load commands run
  // by capture.mjs: E1:spec-load1-emit/-head/-porcelain and E1:plan-load1-emit/-blob/-head/-porcelain (no slice on the happy path).
  // E37 T5: + 1 for E1:spec-load1-blob (the spec blob measured at the load, B08).
  assert.equal(labels.length, ANTES - 1 + 1 + 7 + 1);
  for (const l of ['E1:spec-load1-emit', 'E1:spec-load1-blob', 'E1:spec-load1-head', 'E1:spec-load1-porcelain', 'E1:plan-load1-emit', 'E1:plan-load1-blob', 'E1:plan-load1-head', 'E1:plan-load1-porcelain', 'E1:prune-evidence']) assert.ok(labels.includes(l), l);
  assert.ok(!labels.includes('git-truth'));
  const w = labels.indexOf('E1:status-d');
  const rd = labels.indexOf('E1:status-d-read');
  assert.ok(w >= 0 && rd > w, 'the status write comes before its independent re-read');
  assert.equal(calls[w].opts.agentType, 'productivity-tools:script-runner');
  assert.equal(calls[w].opts.model, 'haiku');
  assert.equal(calls[w].opts.effort, 'low');
  assert.deepEqual(calls[w].opts.schema.required, ['exit', 'stdout']);
  assert.match(calls[w].prompt, /verify-run\.mjs" group \S+/);
  assert.equal(calls[rd].opts.agentType, 'productivity-tools:script-runner', 'the re-read is a signed verify-run read, not a model copy of five stdouts');
  assert.deepEqual(calls[rd].opts.schema.required, ['exit', 'stdout']);
  assert.match(calls[rd].prompt, /verify-run\.mjs" read \S+/);
  assert.equal(labels[labels.length - 1], 'report');
});

test('E10 AC3: a group whose step 2 exits 1 is not repeated and command 2 fails the record', async () => {
  let sent = null;
  const over = both(specWith({ rulings: [ruling({})] }), (l, prompt) => {
    if (l !== 'E1:status-d') return undefined;
    const steps = promptCommands(prompt);
    assert.ok(steps.length >= 3, 'the third command exists and must not run');
    sent = JSON.parse(groupStdout(prompt, steps.map((c, i) => (i === 1 ? { exit: 1, stdout: cliJson({ summary: { exitCode: 1 }, errors: [{ code: 'x' }] }) } : { exit: 0, stdout: cliJson() }))));
    return { exit: 0, stdout: JSON.stringify(sent) };
  });
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.equal(labels.filter((l) => l === 'E1:status-d').length, 1, 'the group writes, so it is never repeated');
  assert.ok(labels.includes('E1:status-d-read'), 'the re-read of today still runs');
  assert.deepEqual(sent.stopped, { n: 2, exit: 1 });
  assert.equal(sent.steps.length, 2, 'the third command did not run');
  assert.ok(r.results[0].concerns.some((x) => /command 2 \(log\) exit 1/.test(x)), r.results[0].concerns.join('\n'));
});

test('E10 AC3: a group output with one changed character is a null record agent', async () => {
  const over = (l, prompt) => (isGroupCopy(l) ? { exit: 0, stdout: groupStdout(prompt, promptCommands(prompt).map(() => ({ exit: 0, stdout: cliJson() }))).replace('"head":"abc1234"', '"head":"abc1235"') } : undefined);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.equal(labels.filter(isGroupCopy).length, 5, 'the same copy is repeated, five attempts at most');
  assert.ok(r.results[0].concerns.some((x) => /null record agent/.test(x)), r.results[0].concerns.join('\n'));
});

test('E10 AC3: a group output of another run (another nonce) is a null record agent', async () => {
  const over = (l, prompt) => (isGroupCopy(l) ? { exit: 0, stdout: groupStdout(prompt, promptCommands(prompt).map(() => ({ exit: 0, stdout: cliJson() })), 'old-run') } : undefined);
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(r.results[0].concerns.some((x) => /null record agent/.test(x)));
});

test('E10 AC3: a group payload over 28000 characters runs in chunks and renumbers runs', async () => {
  const rulings = Array.from({ length: 70 }, (_, i) => ruling({ id: `R${i + 1}`, decision: `Option ${i + 1} ${'alpha beta gamma delta '.repeat(8)}`.trim(), scope: 'local' }));
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: specWith({ rulings }) });
  const parts = calls.filter((c) => /^E1:status-d(-part\d+)?$/.test(c.label));
  assert.ok(parts.length >= 2, `chunks: ${parts.length}`);
  assert.equal(parts[0].label, 'E1:status-d');
  assert.equal(parts[1].label, 'E1:status-d-part2');
  const all = [];
  for (const c of parts) {
    const enc = /verify-run\.mjs" group (\S+)/.exec(c.prompt)[1];
    assert.ok(/node "[^"]*verify-run\.mjs" group \S+/.exec(c.prompt)[0].length <= 6000, `${c.label}: ${enc.length}`);
    const g = verifyArg(c.prompt, 'group');
    assert.ok(g.finally && g.finally.commit.add.length === 1, `${c.label} carries its own finally`);
    all.push(...g.steps);
  }
  assert.equal(all.filter((c) => /add-decision/.test(c)).length, 70, 'no command was split or lost');
  assert.match(all[all.length - 1], /inflight-add/);
  assert.ok(labels.indexOf('E1:status-d-part2') < labels.indexOf('E1:status-d-read'), 'every chunk runs before the re-read');
  assert.equal(r.results[0].merged, true);
  assert.deepEqual(r.results[0].concerns, [], 'the renumbered runs pass the verdict');
});

test('E10 AC3: a failed chunk stops the next ones', async () => {
  const rulings = Array.from({ length: 70 }, (_, i) => ruling({ id: `R${i + 1}`, decision: `Option ${i + 1} ${'alpha beta gamma delta '.repeat(8)}`.trim(), scope: 'local' }));
  const over = both(specWith({ rulings }), (l, prompt) => (l === 'E1:status-d' ? { exit: 0, stdout: groupStdout(prompt, promptCommands(prompt).map((c, i) => (i === 3 ? { exit: 1, stdout: cliJson({ summary: { exitCode: 1 }, errors: [{ code: 'x' }] }) } : { exit: 0, stdout: cliJson() }))) } : undefined));
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(!labels.includes('E1:status-d-part2'), 'the chunk after a failed one does not run');
  assert.ok(r.results[0].concerns.some((x) => /command 4 \(add-decision\) exit 1/.test(x)), r.results[0].concerns.join('\n'));
});

// ---- DEC-714: the group copy repeats (the write is idempotent by nonce in verify-run.mjs)
const isGroupCopy = (l) => /^E1:status-d(-part\d+)?(-retry\d)?$/.test(l);
test('DEC-714: a PLACEHOLDER first copy of the group is repeated and the second good copy records ok', async () => {
  const over = both(specWith({ rulings: [ruling({})] }), (l) => (l === 'E1:status-d' ? { exit: 0, stdout: 'PLACEHOLDER' } : undefined));
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.equal(labels.filter(isGroupCopy).join(','), 'E1:status-d,E1:status-d-retry2');
  assert.ok(!r.results[0].concerns.some((x) => /null record agent/.test(x)), r.results[0].concerns.join('\n'));
  const [a, b] = calls.filter((c) => isGroupCopy(c.label));
  assert.equal(a.prompt, b.prompt, 'the SAME copy is repeated');
  assert.equal(a.opts.model, 'haiku');
  assert.equal(b.opts.model, 'haiku');
});

test('DEC-714: group copies 3 to 5 run on sonnet and 5 bad copies keep the safe failure', async () => {
  const over = both(specWith({ rulings: [ruling({})] }), (l) => (isGroupCopy(l) ? { exit: 0, stdout: 'PLACEHOLDER' } : undefined));
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.equal(labels.filter(isGroupCopy).join(','), 'E1:status-d,E1:status-d-retry2,E1:status-d-retry3,E1:status-d-retry4,E1:status-d-retry5');
  assert.deepEqual(calls.filter((c) => isGroupCopy(c.label)).map((c) => [c.opts.model, c.opts.effort]), [['haiku', 'low'], ['haiku', 'low'], ['sonnet', 'medium'], ['sonnet', 'medium'], ['sonnet', 'medium']]);
  assert.ok(r.results[0].concerns.some((x) => /null record agent/.test(x)), r.results[0].concerns.join('\n'));
});

test('DEC-714: a refusal signed by the script (error) is not repeated', async () => {
  const over = both(specWith({ rulings: [ruling({})] }), (l, prompt) => (isGroupCopy(l) ? { exit: 2, stdout: JSON.stringify({ tool: 'verify-run', mode: 'group', nonce: verifyArg(prompt, 'group').nonce, error: 'a group with this nonce already ran with another payload' }) } : undefined));
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.equal(labels.filter(isGroupCopy).join(','), 'E1:status-d');
  assert.ok(r.results[0].concerns.some((x) => /null record agent/.test(x)), r.results[0].concerns.join('\n'));
});

test('DEC-714: a refusal without the nonce (the model altered the command) is a bad copy and is repeated', async () => {
  const over = both(specWith({ rulings: [ruling({})] }), (l) => (l === 'E1:status-d' ? { exit: 2, stdout: JSON.stringify({ tool: 'verify-run', mode: 'group', error: 'the payload digest does not match: nothing was run' }) } : undefined));
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.equal(labels.filter(isGroupCopy).join(','), 'E1:status-d,E1:status-d-retry2');
  assert.ok(!r.results[0].concerns.some((x) => /null record agent/.test(x)), r.results[0].concerns.join('\n'));
});

test('DEC-714: the nonce of a group is the same for every copy and fixed by deliverable, status and chunk', async () => {
  const over = both(specWith({ rulings: [ruling({})] }), (l) => (l === 'E1:status-d' ? { exit: 0, stdout: 'PLACEHOLDER' } : undefined));
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  const [a, b] = calls.filter((c) => isGroupCopy(c.label)).map((c) => verifyArg(c.prompt, 'group').nonce);
  assert.equal(a, b);
  assert.match(a, /^[^:]+:E1:d:0$/);
});

// Git Bash on Windows cuts the bash -c string at 8186 characters and the Bash tool wrapper takes ~500: no dispatched command may exceed 6000.
const CMD_CAP_T = 6000;
const fullGroupCmd = (prompt) => /node "[^"]*verify-run\.mjs" group \S+/.exec(prompt)[0];

test('8k: 16 long accented decisions make only group commands of at most 6000 characters, steps kept in order', async () => {
  const rulings = Array.from({ length: 16 }, (_, i) => ruling({ id: `R${i + 1}`, decision: `Decisão ${i + 1} ${'ação possível, análise então. '.repeat(10)}`.trim().slice(0, 280), scope: 'local' }));
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: specWith({ rulings }) });
  const parts = calls.filter((c) => /^E1:status-d(-part\d+)?$/.test(c.label));
  assert.ok(parts.length >= 2, `chunks: ${parts.length}`);
  const sizes = parts.map((c) => fullGroupCmd(c.prompt).length);
  for (const n of sizes) assert.ok(n <= CMD_CAP_T, `sizes: ${sizes.join('/')}`);
  const all = parts.flatMap((c) => verifyArg(c.prompt, 'group').steps);
  assert.equal(all.filter((c) => /add-decision/.test(c)).length, 16);
  assert.equal(new Set(all).size, all.length, 'no step duplicated');
  const ids = all.filter((c) => /add-decision/.test(c)).map((c) => /Decisão (\d+)/.exec(c)[1]);
  assert.deepEqual(ids, Array.from({ length: 16 }, (_, i) => String(i + 1)), 'order kept');
  assert.match(all[0], /set-status|block-/);
  assert.match(all[all.length - 1], /inflight-add/);
  assert.equal(r.results[0].merged, true);
  console.log(`# 8k chunk sizes: ${sizes.join('/')}`);
});

test('8k: a single step above the cap is not dispatched and fails with its size and the limit', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], discOver: { roadmapSlug: 'x'.repeat(4000) } });
  assert.ok(!labels.some((l) => /^E1:status-[a-z]+(-part\d+)?$/.test(l)), `dispatched: ${labels.filter((l) => /:status-/.test(l)).join(',')}`);
  const msgs = [r.results[0].error, ...(r.results[0].concerns || [])].filter(Boolean).join('\n');
  assert.match(msgs, /a single record step makes a command of \d+ characters, above the limit of 6000/);
});

test('8k: a check command above the cap is not dispatched and becomes a clear divergence', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], discOver: { repo: `/r/${'x'.repeat(7000)}` } });
  const rep = calls.find((c) => c.label === 'report');
  assert.ok(rep, 'the report still runs');
  assert.ok(!/verify-run\.mjs" check/.test(rep.prompt), 'the oversize check is not sent');
  assert.ok(r.operatorActions.some((o) => /git truth check command has \d+ characters, above the limit of 6000/.test(o.what || o.detail || JSON.stringify(o))), JSON.stringify(r.operatorActions));
});

test('o veredito ignora statusWritten e details do agente', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' },
    over: (l, prompt) => {
      if (/:status-[a-z]+$/.test(l)) return { exit: 0, stdout: groupStdout(prompt, promptCommands(prompt).map(() => ({ exit: 0, stdout: cliJson() }))), statusWritten: 'ok', details: 'tudo certo' };
      if (/:status-.*-read$/.test(l)) return readWith('zzz');
      return undefined;
    } });
  assert.ok(r.results[0].error);
});

test('textos longos não viram concern', async () => {
  const long = (w) => `${w} ${'palavra '.repeat(60)}`.trim();
  const over = specWith({ rulings: [ruling({ id: 'R1', decision: long('decisao') })], needsPerson: [np({ id: 'H1', what: long('humano') })] });
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  const p = plain(calls.find((c) => c.label === 'E1:status-d').prompt);
  let seen = 0;
  for (const cmd of promptCommands(p)) {
    for (const m of cmd.matchAll(/--(?:decision|text|what|note|next) '((?:[^']|'\\'')*)'/g)) { seen++; assert.ok(m[1].length <= 300, `${cmd.slice(0, 60)} (${m[1].length})`); }
  }
  assert.ok(seen >= 4);
  assert.ok(!r.results[0].concerns.some((x) => /record/.test(x)));
  const rl = calls.filter((c) => /review-log/.test(c.label)).map((c) => c.prompt).join('\n');
  assert.match(rl, /Textos cortados no registro/);
  assert.ok(rl.includes(long('decisao').replace(/\s+/g, ' ')));
  assert.ok(rl.includes(long('humano').replace(/\s+/g, ' ')));
  assert.ok(rl.includes('"recordCuts"'));
});

test('retomada não repete log: a palavra já gravada tira set-status e log, e o veredito confere a palavra', async () => {
  const { r, calls } = await exec({ cards: [card('E1', { status: 'd' })], deliverables: ['E1'], over: specWith({ rulings: [ruling({})] }) });
  const p = plain(calls.find((c) => c.label === 'E1:status-d').prompt);
  assert.doesNotMatch(p, / set-status /);
  assert.doesNotMatch(p, /roadmap\.mjs" log /);
  assert.match(p, /add-decision/);
  assert.equal(r.results[0].merged, true);
  assert.deepEqual(r.results[0].concerns, []);
  const wrong = await exec({ cards: [card('E1', { status: 'd' })], deliverables: ['E1'], over: (l) => (/:status-.*-read$/.test(l) ? readWith('c') : undefined) });
  assert.ok(wrong.r.results[0].concerns.some((x) => /"executing" roadmap record failed/.test(x)));
});

test('célula com rótulos usa --piece code', async () => {
  const { calls } = await exec({ cards: [card('E1', { status: 'code: c; acceptance: blocked (BLQ-2)' })], deliverables: ['E1'] });
  assert.match(plain(calls.find((c) => c.label === 'E1:status-d').prompt), /set-status '[^']*' 'E1' 'd' --piece 'code'/);
});

test('falta de trackerCli: erro antes de qualquer agente', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { trackerCli: undefined } });
  assert.equal(r.status, 'error');
  assert.match(r.error, /trackerCli/);
  assert.equal(calls.length, 0);
});

test('BASH_ONLY literal em todo prompt de registro e de releitura; a descoberta não exige o tracker', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const ps = statusPrompts(calls);
  assert.ok(ps.length >= 2);
  const clause = 'run each command exactly as written, one per call, in the Bash tool (Git Bash on Windows), never in the PowerShell tool or in cmd, without rewriting quotes or escapes. Without the Bash tool, run nothing and return exit -1 with an empty stdout.';
  for (const c of ps) { assert.ok(c.prompt.includes(clause), c.label); assert.doesNotMatch(c.prompt, /no-bash/, c.label); }
  const one = 'One command per call; never append `; echo exit=$?`.';
  for (const l of ['E1:spec-commit', 'E1:plan-commit', 'E1:progress']) { const c = calls.find((x) => x.label === l); assert.ok(c && c.prompt.includes(one), l); }
  for (const c of calls.filter((x) => /^E1:status-/.test(x.label))) assert.ok(c.prompt.includes(one), c.label);
  const disc = calls.find((c) => c.label === 'discovery');
  assert.doesNotMatch(disc.prompt, /trackerAvailable/);
  assert.ok(disc.prompt.includes(clause));  // E10: the discovery is a script-runner call and carries the shell clause too
  assert.equal(disc.opts.agentType, 'productivity-tools:script-runner');
  assert.ok(!('trackerAvailable' in disc.opts.schema.properties));  // language is required in data: see 'discovery stops naming each missing field'
  const d = await exec({ cards: [card('E1')], deliverables: ['E1'], discOver: { trackerAvailable: false } });
  assert.equal(d.r.results[0].merged, true);
});

test('na retomada o trackerCli sai dos argumentos mostrados ao relatório', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: badPlan });
  assert.ok(r.operatorActions.length > 0);
  const rep = calls.find((c) => c.label === 'report').prompt;
  assert.doesNotMatch(rep, /\/p\/productivity-tools\/skills\/roadmap-tracker\/scripts\/roadmap\.mjs/);
});

test('bloqueado: o registro vira block-open com o motivo, no melhor esforço', async () => {
  const { calls, r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: badPlan });
  const p = plain(calls.find((c) => c.label === 'E1:status-blocked').prompt);
  assert.match(p, /block-open '[^']*' --what 'E1 blocked: automatic execution stopped \(conteudo\)/);
  assert.match(p, /--affects 'E1'/);
  assert.doesNotMatch(p, / set-status /);
  assert.ok(r.results[0].error);
});

test('registro de bloqueio com texto cortado: a fonte é o log real e o texto completo vai ao log de revisões', async () => {
  const tasks = [{ n: 1, title: 't', tier: 'sonnet', external: false }];
  const long = `motivo ${'palavra '.repeat(80)}`.trim();
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: withPlan(tasks, (l) => (l === 'E1:t1:impl' ? { status: 'BLOCKED', summary: long } : undefined)) });
  const e1 = r.results.find((x) => x.id === 'E1');
  assert.equal(e1.failKind, 'conteudo');
  const blocked = calls.find((c) => c.label === 'E1:status-blocked');
  assert.ok(blocked);
  assert.doesNotMatch(plain(blocked.prompt), /-\*-reviews\.md/);
  assert.match(plain(blocked.prompt), /docs\/plans\/x-E1\/reviews\.md/);
  const logs = calls.filter((c) => /review-log-blocked-record$/.test(c.label));
  assert.equal(logs.length, 1);
  assert.match(logs[0].prompt, /Textos cortados no registro/);
  assert.ok(logs[0].prompt.includes('palavra palavra palavra'));
});

// ---- E18 T5: etapa de documentação pela CLI
const docsPrompts = (calls) => calls.filter((c) => /:docs(-measure|-read)?\d$/.test(c.label));

test('AC2 documentação pela CLI', async () => {
  const humanSpec = specWith({ needsPerson: [np({ id: 'H1', what: 'precisa de credencial' })] });
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(humanSpec, planRows([{ ac: 'AC1', kind: 'human' }])) });
  const p = calls.find((c) => c.label === 'E1:docs1').prompt;
  assert.match(p, /node "\/p\/productivity-tools\/skills\/roadmap-tracker\/scripts\/roadmap\.mjs" set-status '[^']*' 'E1' 'e' /);
  assert.match(p, /node "\/p\/productivity-tools\/skills\/roadmap-tracker\/scripts\/roadmap\.mjs" log '[^']*' --deliverable 'E1'/);
  assert.match(p, /inflight-remove '[^']*' 'feat\/E1'/);
  const pend = promptCommands(p).filter((c) => /add-pending/.test(c));
  assert.ok(pend.some((c) => c.includes('precisa de credencial')), 'entrada humana');
  assert.ok(pend.some((c) => /E1: criterion AC1 has no automatic evidence \(human\)/.test(c)), 'critério sem evidência automática');
  assert.doesNotMatch(p, /roadmap-tracker(?!\/scripts\/roadmap\.mjs)/);
  assert.match(p, /Do NOT propose, write or approve a strategy revision/);
  const order = promptCommands(p).map((c) => /^node "[^"]*" (\S+)/.exec(c)[1]);
  assert.deepEqual(order.slice(0, 2), ['set-status', 'log']);
  assert.equal(order[order.length - 1], 'inflight-remove');
  const risk = await resumedRun(loggedRun);
  assert.ok(promptCommands(risk.calls.find((c) => c.label === 'E1:docs1').prompt).some((c) => /add-pending/.test(c) && c.includes('RISK-X')), 'risco aceito');
});

test('AC3 documentação: releitura falha leva à 2ª rodada só com o que faltou', async () => {
  const mk = (rounds) => (l) => {
    if (l === 'E1:docs-read1' || (rounds === 2 && l === 'E1:docs-read2')) return { ...readWith('zzz'), brief: readWith('e').brief, head: 'm2' };
    return undefined;
  };
  const one = await exec({ cards: [card('E1')], deliverables: ['E1'], over: mk(1) });
  const p1 = one.calls.find((c) => c.label === 'E1:docs1').prompt;
  const p2 = one.calls.find((c) => c.label === 'E1:docs2').prompt;
  assert.match(p1, /roadmap\.mjs" log /);
  assert.doesNotMatch(p2, /roadmap\.mjs" log /);
  assert.match(p2, /roadmap\.mjs" set-status /);
  assert.doesNotMatch(p2, /inflight-remove/);
  assert.match(p2, /FIX ROUND/);
  assert.equal(one.r.results[0].merge.docsOk, true);
  const two = await exec({ cards: [card('E1')], deliverables: ['E1'], over: mk(2) });
  assert.equal(two.r.results[0].merge.docsOk, false);
  assert.ok(two.r.operatorActions.some((o) => o.kind === 'docs'));
});

test('AC3 documentação: comando com erro da CLI repete só ele e o veredito não confia no agente', async () => {
  let n = 0;
  const bad = (l, prompt) => {
    if (/^E1:docs-read/.test(l)) return { ...readWith('e'), head: 'm2' };
    if (!/:docs\d$/.test(l)) return undefined;
    n++;
    return { runs: promptCommands(prompt).map((command) => (n === 1 && / log /.test(command)
      ? { command, exit: 1, stdout: cliJson({ summary: { exitCode: 1 }, errors: [{ code: 'x' }] }) } : { command, exit: 0, stdout: cliJson() })), statusWritten: 'ok' };
  };
  const { calls, r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: bad });
  const p2 = calls.find((c) => c.label === 'E1:docs2').prompt;
  assert.equal(promptCommands(p2).length, 1);
  assert.match(p2, /roadmap\.mjs" log /);
  assert.equal(r.results[0].merge.docsOk, true);
});

test('checker só de brief: nenhum prompt cita o arquivo do checker; docs-measure e releitura pedem status e brief', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  // The discovery keeps returning checker and checkerExists (spec), so only it names the file.
  for (const c of calls.filter((x) => x.label !== 'discovery')) {
    assert.ok(!c.prompt.includes('check-roadmap.mjs'), c.label);
    assert.ok(!c.prompt.includes('docs/plans/roadmap-x/check.mjs'), c.label);
  }
  for (const l of ['E1:docs-read1', 'E1:status-d-read']) {
    const p = verifyArg(calls.find((c) => c.label === l).prompt, 'read');
    assert.equal(p.deliverable, 'E1', l);
    assert.match(p.cli, /roadmap\.mjs$/, l);
  }
  const rep = calls.find((c) => c.label === 'report').prompt;
  assert.match(rep, /brief --json/);
  assert.match(rep, /"errors":0/);
});

test('forma das chamadas de script: todo roadmap.mjs vem entre aspas, com argumento depois, e consta em WORKFLOW_SCRIPTS', async () => {
  const { WORKFLOW_SCRIPTS } = await import('../scripts/preflight.mjs');
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  let seen = 0;
  for (const c of calls.filter((x) => x.label !== 'discovery')) {
    const text = plain(c.prompt);  // I6 (f): roadmap.mjs is counted in the decoded steps of the group payloads too
    for (const m of text.matchAll(/roadmap\.mjs/g)) {
      seen++;
      const around = text.slice(Math.max(0, m.index - 120), m.index + 40);
      assert.match(around, /node "[^"]*roadmap\.mjs" \S/, c.label + ': ' + around);
      assert.ok(WORKFLOW_SCRIPTS.includes('roadmap.mjs'));
    }
  }
  assert.ok(seen > 5);
});

test('BASH_ONLY literal em docs e docs-measure', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const ps = docsPrompts(calls).filter((c) => !/-read\d$/.test(c.label));  // docs-read is a runPrompt call: it carries the variant
  assert.ok(ps.length >= 1);
  const clause = 'run each command exactly as written, one per call, in the Bash tool (Git Bash on Windows), never in the PowerShell tool or in cmd, without rewriting quotes or escapes. Without the Bash tool, run nothing and return an empty list with error "no-bash".';
  for (const c of ps) assert.ok(c.prompt.includes(clause), c.label);
  for (const c of docsPrompts(calls).filter((x) => /-read\d$/.test(x.label))) assert.ok(c.prompt.endsWith('return exit -1 with an empty stdout.'), c.label);
});

test('recordVerdict: reprova worktree sujo na releitura (o agente não comitou)', () => {
  bad((v) => { v.read.porcelain = ' M docs/plans/r/state.md\n'; }, /not clean/);
  const v = VX();
  v.read.porcelain = '\n';
  assert.equal(PU.recordVerdict(v).ok, true);
});

test('recordCommands: statusEvidence limita só o set-status; o log segue com a lista inteira', () => {
  const ev = ['a'.repeat(40), 'gates G1, G2', 'docs/s.md', 'docs/p.md', 'docs/r.md'];
  const r = PU.recordCommands({ ...RC, evidence: ev, statusEvidence: [ev[0]] });
  const st = r.commands.find((c) => c.includes(' set-status '));
  const lg = r.commands.find((c) => c.includes(' log '));
  assert.equal((st.match(/--evidence/g) || []).length, 1);
  assert.equal((lg.match(/--evidence/g) || []).length, 5);
});

test('set-status do registro de documentação passa pela CLI real com a célula Evidência já cheia', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const cli = join(here, '..', '..', 'roadmap-tracker', 'scripts', 'roadmap.mjs');
  const fx = join(here, '..', '..', 'roadmap-tracker', 'scripts', 'fixtures', 'valid');
  const dir = mkdtempSync(join(tmpdir(), 'e18ff-'));
  try {
    cpSync(fx, dir, { recursive: true });
    const st = join(dir, 'state.md');
    const old = '`docs/superpowers/specs/2026-11-11-E1-uma-especificacao-bem-longa-design.md`, `docs/superpowers/plans/2026-11-11-E1-um-plano-bem-longo-para-o-teste.md`, `docs/plans/roadmap-x/outro-arquivo.md`';
    writeFileSync(st, readFileSync(st, 'utf8').replace('| E1 | spec | `docs/spec-e1.md` |', `| E1 | spec | ${old} |`));
    const ev = ['a'.repeat(40), 'gates G1, G2, G3, G4, G5', 'docs/superpowers/specs/2026-11-11-E1-uma-especificacao-bem-longa-design.md', 'docs/superpowers/plans/2026-11-11-E1-um-plano-bem-longo-para-o-teste.md', 'docs/superpowers/reviews/2026-11-11-E1-slug-reviews.md'];
    const cmd = PU.recordCommands({ ...RC, cli, folder: dir, word: 'on-branch', evidence: ev, statusEvidence: [ev[0]] }).commands.find((c) => c.includes(' set-status '));
    // Same argv the shell would build: single-quoted words, with a quote written as '\''.
    const argv = [...cmd.slice(cmd.indexOf('" ') + 2).matchAll(/'((?:[^']|'\\'')*)'|(\S+)/g)].map((m) => (m[1] !== undefined ? m[1] : m[2]));
    const r = spawnSync(process.execPath, [cli, ...argv], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// E25 AC3: the workflow is registered in the manifest, launched by name, and the skill declares the minimum version.
const HERE3 = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT3 = join(HERE3, '..', '..', '..');
const lf3 = (s) => s.replace(/\r\n?/g, '\n');
const pluginJson3 = () => JSON.parse(lf3(readFileSync(join(PLUGIN_ROOT3, '.claude-plugin', 'plugin.json'), 'utf8')));
const skillText3 = () => lf3(readFileSync(join(HERE3, '..', 'SKILL.md'), 'utf8'));
const skillParts3 = () => {
  const m = skillText3().match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return { front: m[1], body: m[2] };
};
const step4of = () => {
  const { body } = skillParts3();
  const m = body.match(/\n4\. \*\*Run the workflow\.\*\*[\s\S]*?(?=\n5\. \*\*)/);
  assert.ok(m, 'step 4 found');
  return m[0];
};

test('E25 AC3: plugin.json registers the release workflow file', () => {
  const p = pluginJson3();
  assert.ok(Array.isArray(p.workflows));
  assert.ok(p.workflows.includes('./skills/roadmap-release/workflow/roadmap-release.js'));
  assert.ok(existsSync(join(PLUGIN_ROOT3, 'skills/roadmap-release/workflow/roadmap-release.js')));
  assert.equal(p.version, '2.6.0');
});

test('E25 AC3: the workflow name is release-workflow and is no skill\'s name', async () => {
  const meta = readFileSync(join(HERE3, 'roadmap-release.js'), 'utf8').match(/export const meta = \{[\s\S]*?\bname:\s*'([^']+)'/);
  assert.ok(meta);
  assert.equal(meta[1], 'release-workflow');
  const { RELEASE_WORKFLOW } = await import('../scripts/preflight.mjs');
  assert.equal(RELEASE_WORKFLOW, `${pluginJson3().name}:${meta[1]}`);
  const skillsDir = join(PLUGIN_ROOT3, 'skills');
  const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.ok(!dirs.includes(meta[1]));
  for (const d of dirs) {
    const f = join(skillsDir, d, 'SKILL.md');
    if (!existsSync(f)) continue;
    const n = lf3(readFileSync(f, 'utf8')).match(/^name:\s*(.+)$/m);
    if (n) assert.notEqual(n[1].trim().replace(/^["']|["']$/g, ''), meta[1]);
  }
});

test('E25 AC3: the skill launches by that name', () => {
  const { body } = skillParts3();
  const step4 = step4of();
  assert.ok(step4.includes('`name` set to `productivity-tools:release-workflow`'));
  assert.ok(!/Call the `Workflow` tool with `scriptPath`/.test(step4));
  const mentions = step4.split('\n').filter((l) => l.includes('scriptPath'));
  assert.ok(mentions.length >= 1);
  for (const l of mentions) {
    assert.ok(/not found|unknown/.test(l) || /--add-dir/.test(l), 'scriptPath only in the fallback paragraph');
  }
  assert.ok(/not found|unknown/.test(step4) && step4.includes('--add-dir'));
  assert.ok(body.split('\n')[3].includes('productivity-tools:release-workflow'), 'opening line names the workflow');
});

test('E25 AC3: the fallback is only for an unknown name and a permission denial shows the rule', () => {
  const step4 = step4of();
  assert.ok(/permission/i.test(step4));
  assert.ok(step4.includes('Workflow(productivity-tools:release-workflow)'));
  assert.ok(/do not try the path|does not try the path|never try the path|not try the path/i.test(step4));
});

test('E25 AC3: compatibility declares the minimum version', () => {
  const { front } = skillParts3();
  const m = front.match(/^compatibility:\s*"([^"]*)"$/m);
  assert.ok(m, 'compatibility present');
  assert.ok(m[1].includes('2.1.322'));
  assert.ok(m[1].length < 500);
});

test('parseDecision: scope sentence, trailing parenthetical, default contrato', () => {
  const P = PU.parseDecision;
  assert.deepEqual(P('Usar X. Alcance: local.'), { text: 'Usar X.', scope: 'local' });
  assert.deepEqual(P('Usar X. Alcance: contrato.'), { text: 'Usar X.', scope: 'contrato' });
  assert.deepEqual(P('Use X. Scope: local.'), { text: 'Use X.', scope: 'local' });
  assert.deepEqual(P('Use X. Scope: contract.'), { text: 'Use X.', scope: 'contrato' });
  assert.deepEqual(P('Usar X (local)'), { text: 'Usar X', scope: 'local' });
  assert.deepEqual(P('Usar X (LOCAL).'), { text: 'Usar X', scope: 'local' });
  assert.deepEqual(P('Usar X (contrato)'), { text: 'Usar X', scope: 'contrato' });
  assert.deepEqual(P('Use X (contract).'), { text: 'Use X', scope: 'contrato' });
  assert.deepEqual(P('Use X (scope: local)'), { text: 'Use X', scope: 'local' });
  assert.deepEqual(P('Usar X (alcance: local).'), { text: 'Usar X', scope: 'local' });
  assert.deepEqual(P('Usar X (local) e depois Y'), { text: 'Usar X (local) e depois Y', scope: 'contrato' });
  assert.deepEqual(P('Usar X sem escopo'), { text: 'Usar X sem escopo', scope: 'contrato' });
});

// ---- E8 T1: embedded copies, artifact paths, plugin root
import { embedFile } from '../../../scripts/embed.mjs';
import { route as libRoute } from '../../../lib/routing.mjs';
import { planDigest as libPlanDigest } from '../../../lib/plan-digest.mjs';

const WF_PATH = join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js');
const PLAN_TOOL_FIX = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'fixtures', 'plan-tool');

test('embedded copies of routing and plan-digest are not stale', () => {
  assert.equal(embedFile(WF_PATH, { check: true }).stale, false);
});

test('embedded route and planDigest equal the lib ones', () => {
  const table = JSON.parse(readFileSync(join(PLAN_TOOL_FIX, 'routing-table.json'), 'utf8'));
  const pure = loadPure();
  for (const row of table.rows) {
    const i = row.input;
    const t = {
      score: { ambiguity: i.ambiguity, reasoning: i.reasoning, blast: i.blast, verifiability: i.verifiability },
      files: { create: Array.from({ length: i.fileCount }, (_, k) => `f${k + 1}`), modify: [], test: [] },
      external: i.external,
    };
    assert.deepEqual(pure.route(t, { hasDependents: i.hasDependents }), libRoute(t, { hasDependents: i.hasDependents }), row.name);
  }
  const text = readFileSync(join(PLAN_TOOL_FIX, 'plan.md'), 'utf8').replace(/\r\n/g, '\n');
  const emitted = {
    plan: { tasks: [{ n: 1, title: 'a', deps: [] }], b: 2, a: 1 },
    source: { path: 'plan.md', textDigest: pure.fnv1a(text) },
  };
  assert.equal(pure.planDigest(emitted), libPlanDigest(emitted));
  assert.deepEqual(pure.canon({ b: 1, a: [{ d: 1, c: 2 }] }), { a: [{ c: 2, d: 1 }], b: 1 });
});

test('artifactPaths follows DEC-026', () => {
  const pure = loadPure();
  assert.deepEqual(pure.artifactPaths('evolucao-skills', 'E8'), {
    dir: 'docs/plans/evolucao-skills-E8/',
    spec: 'docs/plans/evolucao-skills-E8/spec.md',
    plan: 'docs/plans/evolucao-skills-E8/plan.md',
    reviews: 'docs/plans/evolucao-skills-E8/reviews.md',
    run: 'docs/plans/evolucao-skills-E8/run.json',
  });
  assert.equal(pure.reportPathFor('2026-11-12', 'E8'), 'docs/reports/2026-11-12-E8-run.md');
});

test('pluginRootOf strips the tracker suffix or returns null', () => {
  const pure = loadPure();
  assert.equal(pure.pluginRootOf('/p/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs'), '/p/productivity-tools');
  assert.equal(pure.pluginRootOf('C:\\p\\pt\\skills\\roadmap-tracker\\scripts\\roadmap.mjs'), 'C:/p/pt');
  assert.equal(pure.pluginRootOf('/t/roadmap.mjs'), null);
});

import { stopsOf } from '../../../scripts/spec-tool.mjs';

const rl = (o) => ({ id: 'R1', decision: 'Use X.', alternative: 'Y', costIfWrong: 'low', reversible: true, scope: 'local', contradicts: null, ...o });

test('stopOrCarry stops equal spec-tool stopsOf', () => {
  const pure = loadPure();
  const table = [
    { rulings: [rl({ id: 'R1' })], needsPerson: [] },
    { rulings: [rl({ id: 'R1', contradicts: 'DEC-12' })], needsPerson: [] },
    { rulings: [rl({ id: 'R1', contradicts: 'G1' })], needsPerson: [] },
    { rulings: [rl({ id: 'R1', costIfWrong: 'high', reversible: false })], needsPerson: [] },
    { rulings: [rl({ id: 'R1', costIfWrong: 'high', reversible: true })], needsPerson: [] },
    { rulings: [rl({ id: 'R1' })], needsPerson: [np({ id: 'P1', blocking: true })] },
    { rulings: [rl({ id: 'R1' })], needsPerson: [np({ id: 'P1', blocking: false })] },
    { rulings: [rl({ id: 'R1', contradicts: 'DEC-1' }), rl({ id: 'R2', costIfWrong: 'high', reversible: false }), rl({ id: 'R3' })], needsPerson: [np({ id: 'P2', blocking: true })] },
  ];
  for (const t of table) {
    const got = pure.stopOrCarry({ ...t, approved: [] }).stops.map((s) => s.id).sort();
    assert.deepEqual(got, stopsOf(t.rulings, t.needsPerson).sort(), JSON.stringify(t));
  }
  const r = pure.stopOrCarry({
    rulings: [rl({ id: 'R1', contradicts: 'DEC-1' }), rl({ id: 'R2', costIfWrong: 'high', reversible: false }), rl({ id: 'R3' })],
    needsPerson: [np({ id: 'P2', blocking: true })],
    approved: [],
  });
  assert.deepEqual(r.stops.map((s) => [s.id, s.kind, s.action]), [
    ['P2', 'humano', 'human-input'],
    ['R1', 'decisao', 'decision'],
    ['R2', 'approve-ruling', 'approve-ruling'],
  ]);
  assert.equal(r.stops[2].key, pure.approveKey(r.stops[2] && rl({ id: 'R2', costIfWrong: 'high', reversible: false })));
  assert.deepEqual(r.carry.map((x) => x.id), ['R3']);
});

test('stopOrCarry releases an approved costly ruling only for the same text', () => {
  const pure = loadPure();
  const r = rl({ id: 'R2', decision: 'Drop  the\ntable.', costIfWrong: 'high', reversible: false });
  assert.match(pure.approveKey(r), /^R2:[0-9a-f]+$/);
  assert.equal(pure.approveKey(r), pure.approveKey({ ...r, decision: 'Drop the table.' }));
  const ok = pure.stopOrCarry({ rulings: [r], needsPerson: [], approved: [pure.approveKey(r)] });
  assert.deepEqual(ok.stops, []);
  assert.deepEqual(ok.carry.map((x) => x.id), ['R2']);
  const other = pure.stopOrCarry({ rulings: [r], needsPerson: [], approved: [pure.approveKey({ ...r, decision: 'Keep the table.' })] });
  assert.deepEqual(other.stops.map((s) => s.id), ['R2']);
  assert.equal(other.stops[0].key, pure.approveKey(r));
  assert.deepEqual(other.carry, []);
});

test('rulingDecisions maps scope and alternative', () => {
  const pure = loadPure();
  assert.deepEqual(
    pure.rulingDecisions([rl({ decision: 'A.', scope: 'contract', alternative: 'B' }), rl({ decision: 'C.', scope: 'local', alternative: 'D' })]),
    [{ text: 'A.', scope: 'contrato', discarded: 'B' }, { text: 'C.', scope: 'local', discarded: 'D' }],
  );
});

test('specCardMismatch ignores verify when the card criterion has no tag', () => {
  const pure = loadPure();
  const card = { id: 'E8', acceptance: [{ id: 'AC1', text: 'Plain criterion.' }] };
  const item = verify => ({ id: 'AC1', text: 'Plain criterion.', textWithoutTag: 'Plain criterion.', verify });
  assert.deepEqual(pure.specCardMismatch({ id: 'E8', acceptance: [item({ kind: 'test', blq: null, evidence: 'node x' })] }, 'E8', card), []);
  assert.deepEqual(pure.specCardMismatch({ id: 'E8', acceptance: [item(null)] }, 'E8', card), []);
});
test('specCardMismatch compares ids, text and verify', () => {
  const pure = loadPure();
  const card = { id: 'E8', acceptance: [
    { id: 'AC1', text: 'Does  a thing. {verify: test; evidence: node --test x}' },
    { id: 'AC2', text: 'Human thing. {verify: human}' },
  ] };
  const item = (id, textWithoutTag, verify) => ({ id, text: textWithoutTag, textWithoutTag, verify });
  const good = {
    id: 'E8',
    acceptance: [
      item('AC1', 'Does a thing.', { kind: 'test', blq: null, evidence: 'node --test x' }),
      item('AC2', 'Human thing.', { kind: 'human', blq: null, evidence: '' }),
    ],
  };
  assert.deepEqual(pure.specCardMismatch(good, 'E8', card), []);
  assert.notEqual(pure.specCardMismatch({ ...good, id: 'E9' }, 'E8', card).length, 0);
  assert.notEqual(pure.specCardMismatch({ ...good, acceptance: [...good.acceptance, item('AC3', 'More.', null)] }, 'E8', card).length, 0);
  assert.notEqual(pure.specCardMismatch({ ...good, acceptance: [item('AC1', 'Other text.', good.acceptance[0].verify), good.acceptance[1]] }, 'E8', card).length, 0);
  assert.notEqual(pure.specCardMismatch({ ...good, acceptance: [item('AC1', 'Does a thing.', { kind: 'test', blq: null, evidence: 'node other' }), good.acceptance[1]] }, 'E8', card).length, 0);
  assert.notEqual(pure.specCardMismatch({ ...good, acceptance: [item('AC1', 'Does a thing.', null), good.acceptance[1]] }, 'E8', card).length, 0);
  assert.notEqual(pure.specCardMismatch({ ...good, acceptance: [item('AC2', 'Does a thing.', good.acceptance[0].verify), good.acceptance[1]] }, 'E8', card).length, 0);
});

test('heldBy holds transitive dependents and never the owner', () => {
  const pure = loadPure();
  const cards = [
    { id: 'E1', deps: [] },
    { id: 'E2', deps: ['E1'] },
    { id: 'E3', deps: ['E2'] },
    { id: 'E4', deps: [] },
  ];
  const base = { cards, selected: ['E1', 'E2', 'E3', 'E4'], contractDecisions: [{ id: 'DEC-9', deliverable: 'E1' }], started: [] };
  const m = pure.heldBy(base);
  assert.deepEqual([...m.keys()].sort(), ['E2', 'E3']);
  assert.deepEqual(m.get('E2'), { decision: 'DEC-9', owner: 'E1' });
  assert.deepEqual(m.get('E3'), { decision: 'DEC-9', owner: 'E1' });
  const s = pure.heldBy({ ...base, started: ['E2'] });
  assert.deepEqual([...s.keys()], ['E3']);
  assert.equal(pure.heldBy({ ...base, selected: ['E1', 'E4'] }).size, 0);
  assert.equal(pure.holdReason({ decision: 'DEC-9', owner: 'E1' }), 'held by DEC-9 (E1, contract, pending ratification)');
});

// ---- E8 T3: plan/1 adapter, plan load and routing
const PLAN_TOOL = join(PLAN_TOOL_FIX, '..', '..', 'plan-tool.mjs');
const emitFixture = () => execFileSync('node', [PLAN_TOOL, 'emit', join(PLAN_TOOL_FIX, 'plan.md'), '--json'], { encoding: 'utf8' });
const fixtureEmit = () => JSON.parse(emitFixture());

// Builds the JSON of `plan-tool emit` with route and digest computed by the lib copies.
function planEmitOf({ id, roadmap, tasks, evidence = [], removedTests }) {
  const plan = { schema: 'plan/1', id, roadmap, tasks: [], evidence, ...(removedTests ? { removedTests } : {}) };
  plan.tasks = tasks.map((t) => ({ locks: [], external: false, externalDedupe: null, noCommit: false, deps: [], ...t }));
  plan.tasks = plan.tasks.map((t) => ({ ...t, route: libRoute(t, { hasDependents: plan.tasks.some((x) => x.deps.includes(t.n)) }) }));
  const source = { path: 'plan.md', textDigest: 'abcd1234' };
  return { tool: 'plan-tool', schema: 'plan/1', path: 'plan.md', source, plan, digest: libPlanDigest({ plan, source }) };
}

test('loadPlanEmit accepts a faithful emit', () => {
  const pure = loadPure();
  const e = fixtureEmit();
  const r = pure.loadPlanEmit(JSON.stringify(e), { E: 'E1', RM: 'docs/plans/roadmap-exemplo/' });
  assert.equal(r.ok, true);
  assert.equal(r.digest, e.digest);
  assert.equal(r.plan.tasks.length, 6);
  const mine = planEmitOf({
    id: 'E9', roadmap: 'docs/plans/r/',
    tasks: [
      { n: 1, files: { create: ['a'], modify: [], test: [] }, score: { ambiguity: 0, reasoning: 0, blast: 0, verifiability: 0 } },
      { n: 2, deps: [1], files: { create: ['b'], modify: [], test: [] }, score: { ambiguity: 1, reasoning: 1, blast: 1, verifiability: 1 } },
    ],
  });
  assert.equal(pure.loadPlanEmit(JSON.stringify(mine), { E: 'E9', RM: 'docs/plans/r/' }).ok, true);
});

test('loadPlanEmit rejects a wrong digest, id, roadmap, tool or schema', () => {
  const pure = loadPure();
  const e = fixtureEmit();
  const args = { E: 'E1', RM: 'docs/plans/roadmap-exemplo/' };
  const bad = (mut, re) => {
    const c = JSON.parse(JSON.stringify(e));
    mut(c);
    const r = pure.loadPlanEmit(JSON.stringify(c), args);
    assert.equal(r.ok, false);
    assert.match(r.why, re);
  };
  bad((c) => { c.digest = '00000000'; }, /digest/);
  bad((c) => { c.plan.id = 'E2'; c.digest = libPlanDigest({ plan: c.plan, source: c.source }); }, /plan id/);
  bad((c) => { c.plan.roadmap = 'other/'; c.digest = libPlanDigest({ plan: c.plan, source: c.source }); }, /roadmap/);
  bad((c) => { c.tool = 'spec-tool'; }, /tool/);
  bad((c) => { c.schema = 'plan/2'; }, /schema/);
  assert.equal(pure.loadPlanEmit('not json', args).ok, false);
});

test('loadPlanEmit rejects a route that differs from the recalculated one', () => {
  const pure = loadPure();
  const e = fixtureEmit();
  e.plan.tasks[1].route = { ...e.plan.tasks[1].route, tier: 'opus', reviewTier: 'opus' };
  e.digest = libPlanDigest({ plan: e.plan, source: e.source });
  const r = pure.loadPlanEmit(JSON.stringify(e), { E: 'E1', RM: 'docs/plans/roadmap-exemplo/' });
  assert.equal(r.ok, false);
  assert.match(r.why, /task 2.*route/);
});

test('tasksFromPlan merges files and copies locks and external', () => {
  const pure = loadPure();
  const { plan } = fixtureEmit();
  const ts = pure.tasksFromPlan(plan);
  assert.equal(ts.length, plan.tasks.length);
  assert.deepEqual(ts[0].files, ['src/store.mjs', 'tests/store.test.mjs']);
  assert.deepEqual(Object.keys(ts[0]).sort(), ['deps', 'external', 'externalDedupe', 'files', 'n', 'needsLock', 'noCommit', 'route', 'testFirst', 'title']);
  assert.deepEqual(ts.find((t) => t.n === 3).needsLock, ['fixture-db']);
  const ext = ts.find((t) => t.external === true);
  assert.ok(ext && ext.externalDedupe);
  assert.deepEqual(ts[1].deps, [1]);
  assert.deepEqual(ts[1].route, plan.tasks[1].route);
  const dup = pure.tasksFromPlan({ tasks: [{ n: 1, title: 't', files: { create: ['a'], modify: ['a', 'b'], test: ['b'] }, locks: [], external: false, externalDedupe: null, noCommit: false, route: {}, deps: [] }] });
  assert.deepEqual(dup[0].files, ['a', 'b']);
});

test('evidenceFromPlan keeps the row fields', () => {
  const pure = loadPure();
  const { plan } = fixtureEmit();
  const rows = pure.evidenceFromPlan(plan);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { ac: 'AC1', kind: 'test', command: 'node --test tests/e1.test.mjs', testRef: null, blq: null, external: false, externalDedupe: null });
  assert.deepEqual(rows[1], { ac: 'AC2', kind: 'blocked', command: null, testRef: null, blq: 'BLQ-1', external: false, externalDedupe: null });
});

test('DEC-640: the lean emit printed by plan-tool loads, and a change in a frozen task is still detected', () => {
  const pure = loadPure();
  const e = fixtureEmit();
  assert.equal(e.plan.rulings, undefined);
  assert.equal(e.plan.tasks[0].checks, undefined);
  assert.match(e.plan.tasks[0].authored, /^[0-9a-f]{8}$/);
  const r = pure.loadPlanEmit(JSON.stringify(e), { E: 'E1', RM: 'docs/plans/roadmap-exemplo/' });
  assert.equal(r.ok, true, r.why);
  const next = JSON.parse(JSON.stringify(e.plan));
  assert.deepEqual(pure.frozenTaskDiffs(e.plan, next, [1, 2]), []);
  next.tasks[1].authored = '00000000';
  assert.equal(pure.frozenTaskDiffs(e.plan, next, [1]).length, 0);
  assert.equal(pure.frozenTaskDiffs(e.plan, next, [2]).length, 1);
});

test('frozenTaskDiffs flags a changed or missing committed task and ignores the others', () => {
  const pure = loadPure();
  const prev = fixtureEmit().plan;
  const next = JSON.parse(JSON.stringify(prev));
  assert.deepEqual(pure.frozenTaskDiffs(prev, next, [1, 2]), []);
  next.tasks[2].title = 'changed';
  assert.deepEqual(pure.frozenTaskDiffs(prev, next, [1, 2]), []);
  assert.equal(pure.frozenTaskDiffs(prev, next, [1, 3]).length, 1);
  next.tasks[0].score = { ...(next.tasks[0].score || {}), blast: 9 };
  assert.equal(pure.frozenTaskDiffs(prev, next, [1]).length, 1);
  // derived by plan-tool from the whole plan: new tasks shift wave, fileCount and the route gate of committed ones
  const derived = JSON.parse(JSON.stringify(prev));
  derived.tasks.forEach((t) => { t.wave = (t.wave || 1) + 2; t.fileCount = (t.fileCount || 0) + 1; t.route = { ...t.route, gate: 'changed' }; });
  assert.deepEqual(pure.frozenTaskDiffs(prev, derived, [1, 2, 3]), []);
  next.tasks = next.tasks.filter((t) => t.n !== 2);
  const d = pure.frozenTaskDiffs(prev, next, [2]);
  assert.equal(d.length, 1);
  assert.match(d[0], /task 2/);
  const reordered = { ...prev, tasks: prev.tasks.map((t) => ({ ...t, files: { modify: t.files.modify, test: t.files.test, create: t.files.create } })) };
  assert.deepEqual(pure.frozenTaskDiffs(prev, reordered, [1, 2, 3]), []);
});

test('AC2: a branch with task commits and no native spec stops with previous-version and writes no spec', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, taskCommits: 2, committedTasks: [1, 2], nativeSpec: false, nativePlan: false } : undefined) });
  assert.equal(r.results.find((x) => x.id === 'E1').failKind, 'conteudo');
  const o = r.operatorActions.filter((x) => x.kind === 'previous-version' && x.deliverable === 'E1');
  assert.equal(o.length, 1);
  assert.match(o[0].doNow, /previous version/);
  assert.match(o[0].doNow, /discard the branch and the worktree/);
  for (const l of ['E1:spec', 'E1:spec-load1', 'E1:plan']) assert.ok(!labels.includes(l), l);
});

test('a branch with an old superpowers spec and no task commit is not stopped', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, taskCommits: 0, committedTasks: [], nativeSpec: false, nativePlan: false } : undefined) });
  assert.ok(labels.includes('E1:spec'));
  assert.ok(!r.operatorActions.some((x) => x.kind === 'previous-version'));
});

test('the setup schema requires the new measurements', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const c = calls.find((x) => x.label === 'E1:setup');
  for (const f of ['taskCommits', 'committedTasks', 'nativeSpec', 'nativePlan']) assert.ok(c.opts.schema.required.includes(f), f);
  assert.match(c.prompt, /\.\.HEAD/);
  assert.ok(c.prompt.includes('docs/plans/x-E1/spec.md'));
});

// ---- E8 T5: native spec stage, loaded and checked by code, stops and decision records
const NO_ASK_TEXT = 'Never ask the person anything';

test('AC5: a ruling that contradicts a registered decision stops the deliverable', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: specWith({ rulings: [ruling({ id: 'R1', decision: 'Drop the gate.', contradicts: 'DEC-12' })] }) });
  const e = r.results.find((x) => x.id === 'E1');
  assert.equal(e.failKind, 'decisao');
  assert.match(e.error, /R1/);
  assert.match(e.error, /DEC-12/);
  assert.ok(r.operatorActions.some((o) => o.kind === 'decision' && o.deliverable === 'E1'));
  assert.ok(labels.includes('E1:spec-commit'));
  assert.ok(!labels.includes('E1:plan'));
});

test('AC6: a common ruling is recorded as pending ratification and the run goes on', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: specWith({ rulings: [ruling({ id: 'R1', decision: 'Use the cache.', alternative: 'No cache', scope: 'local' })] }) });
  assert.ok(labels.includes('E1:t1:impl'));
  const rec = plain(calls.find((c) => /^E1:status-/.test(c.label) && /add-decision/.test(plain(c.prompt))).prompt);
  assert.match(rec, /add-decision '[^']*' --deliverable 'E1' --decision 'Use the cache\.' --scope 'local' --discarded 'No cache'/);
  assert.equal(r.results[0].decisions, 1);
});

test('AC7: a costly irreversible ruling stops after the spec commit without writing the plan', async () => {
  const costly = ruling({ id: 'R2', decision: 'Drop the table.', costIfWrong: 'high', reversible: false });
  const key = PURE_X.approveKey(costly);
  const over = specWith({ rulings: [costly] });
  const first = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(first.labels.includes('E1:spec-commit'));
  assert.ok(!first.labels.includes('E1:plan'));
  const act = first.r.operatorActions.find((o) => o.kind === 'approve-ruling' && o.deliverable === 'E1');
  assert.ok(act);
  assert.ok(act.doNow.includes(key));
  assert.ok(!('approveRulings' in act.resumeWith));
  assert.ok(!('approveRulings' in first.r.resumeArgs));
  const ok = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { approveRulings: { E1: [key] } }, over });
  assert.ok(ok.labels.includes('E1:plan'));
  assert.ok(!ok.r.operatorActions.some((o) => o.kind === 'approve-ruling'));
  assert.ok(ok.r.operatorActions.every((o) => !o.resumeWith || !('approveRulings' in o.resumeWith)));
  assert.ok(!('approveRulings' in ok.r.resumeArgs));
  const other = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { approveRulings: { E1: [PURE_X.approveKey({ ...costly, decision: 'Keep the table.' })] } }, over });
  assert.ok(!other.labels.includes('E1:plan'));
  assert.ok(other.r.operatorActions.some((o) => o.kind === 'approve-ruling' && o.doNow.includes(key)));
});

test('the spec author gets the native contract', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'prefer the small option\nand keep the table' } }, discOver: { language: 'pt-BR' } });
  const c = calls.find((x) => x.label === 'E1:spec');
  assert.equal(c.opts.agentType, 'productivity-tools:spec-author');
  assert.equal(c.opts.model, undefined);
  const lines = c.prompt.split('\n');
  assert.equal(lines[0], 'mode: unattended');
  assert.equal(lines[1], 'output: /wt/E1/docs/plans/x-E1/spec.md');
  assert.equal(lines[2], 'specTool: /p/productivity-tools/scripts/spec-tool.mjs');
  assert.equal(lines[3], 'language: pt-BR');
  assert.equal(lines[4], 'roadmap: /wt/E1/docs/plans/roadmap-x');
  assert.equal(lines[5], 'card: E1');
  assert.equal(lines[6], 'ownerNote:');
  assert.ok(lines.slice(7).every((l) => !/^(mode|output|specTool|language|roadmap|card):/.test(l)));
  assert.ok(c.prompt.includes('prefer the small option\nand keep the table'));
  assert.ok(c.prompt.includes(NO_ASK_TEXT));
  assert.ok(c.prompt.includes('Do not commit'));
});

test('every prompt of the spec stage carries the no-question clause and none names superpowers', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  for (const l of ['E1:spec', 'E1:spec-load1', 'E1:spec-commit', 'E1:spec-review1']) {
    const p = calls.find((c) => c.label === l).prompt;
    assert.ok(p.includes(NO_ASK_TEXT), l);
    assert.ok(!/superpowers/.test(p), l);
  }
});

test('a trackerCli outside the plugin layout fails as infra before the author', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { trackerCli: '/t/roadmap.mjs' } });
  assert.equal(r.results[0].failKind, 'infra');
  assert.match(r.results[0].error, /trackerCli/);
  for (const l of ['E1:spec', 'E1:spec-load1', 'E1:spec-commit']) assert.ok(!labels.includes(l), l);
});

test('a spec load that keeps diverging from the card fails as infra after five tries', async () => {
  const diverge = (l) => (/:spec-load\d$/.test(l) ? specLoadOk('E1', { acceptance: [{ id: 'AC1', text: 'something else' }] }) : undefined);
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: diverge });
  assert.equal(r.results[0].failKind, 'infra');
  assert.match(r.results[0].error, /spec load/);
  const five = ['E1:spec-load1', 'E1:spec-load2', 'E1:spec-load3', 'E1:spec-load4', 'E1:spec-load5'];
  assert.deepEqual(labels.filter((l) => /:spec-load\d$/.test(l)), five);
  assert.deepEqual(five.map((l) => [calls.find((c) => c.label === l).opts.model, calls.find((c) => c.label === l).opts.effort]), [['haiku', 'low'], ['haiku', 'low'], ['sonnet', 'medium'], ['sonnet', 'medium'], ['sonnet', 'medium']]);
  assert.ok(!labels.includes('E1:spec-commit'));
  assert.ok(!labels.includes('E1:plan'));
});

test('a spec load with output that is not the spec/1 envelope is retried, and a good third try goes on', async () => {
  let n = 0;
  const flaky = (l) => {
    if (!/:spec-load\d$/.test(l)) return undefined;
    n++;
    if (n === 1) return { checkExit: 0, checkStdout: '{}', emitExit: 0, emitStdout: 'not json' };
    if (n === 2) return { checkExit: 0, checkStdout: '{}', emitExit: 0, emitStdout: JSON.stringify({ tool: 'plan-tool', schema: 'plan/1', data: {} }) };
    return undefined;
  };
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: flaky });
  assert.deepEqual(labels.filter((l) => /:spec-load\d$/.test(l)), ['E1:spec-load1', 'E1:spec-load2', 'E1:spec-load3']);
  assert.ok(labels.includes('E1:spec-commit'));
  assert.ok(labels.includes('E1:plan'));
});

test('a failed spec check is a critical issue of the review, fixed by the corrector, and the load runs again', async () => {
  let n = 0;
  const bad = (l) => (/:spec-load\d$/.test(l) && n++ === 0 ? { checkExit: 1, checkStdout: '{"errors":[{"code":"schema"}]}', emitExit: 1, emitStdout: '' } : undefined);
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(bad, (l) => (l === 'E1:spec-fix1' ? { specPath: 'x', slug: 'x', decisions: [], humanInputs: [] } : undefined)) });
  assert.ok(labels.includes('E1:spec-fix1'));
  assert.ok(labels.indexOf('E1:spec-fix1') < labels.lastIndexOf('E1:spec-load1'));
  assert.match(calls.find((c) => c.label === 'E1:spec-fix1').prompt, /spec-tool check exited 1/);
  assert.equal(r.results[0].merged, true);
});

const specToolJson = (n) => JSON.stringify({ tool: 'spec-tool', schema: 'spec/1', path: 'x', errors: [], warnings: [], summary: { errors: 0, warnings: 0, exitCode: n } });

test('E31 (a): a resume whose spec-load1 misreports checkExit loads again and keeps both reviews skipped', async () => {
  const misreport = (l) => (l === 'E1:spec-load1' ? { checkExit: 1, emitExit: 2, checkStdout: specToolJson(0), emitStdout: '', head: 'a1', clean: true } : undefined);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(recordedSetup(RUN_REC), misreport) });
  assert.ok(labels.includes('E1:spec-load2'));
  assert.ok(!labels.some((l) => /^E1:spec-fix/.test(l)));
  assert.ok(!labels.some((l) => /^E1:(spec|plan)-review/.test(l)));
  assert.ok(r.results[0].concerns.some((c) => /spec review skipped/.test(c)));
  assert.ok(r.results[0].concerns.some((c) => /plan review skipped/.test(c)));
  assert.equal(r.results[0].merged, true);
});

test('E31 (b): a spec check that really failed stays a critical issue for the spec fixer', async () => {
  let n = 0;
  const bad = (l) => (l === 'E1:spec-load1' && n++ === 0 ? { checkExit: 1, emitExit: 2, checkStdout: specToolJson(1), emitStdout: '', head: 'a1', clean: true } : undefined);
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(recordedSetup(RUN_REC), bad, (l) => (l === 'E1:spec-fix1' ? { specPath: 'x', slug: 'x', decisions: [], humanInputs: [] } : undefined)) });
  assert.ok(labels.includes('E1:spec-fix1'));
  assert.match(calls.find((c) => c.label === 'E1:spec-fix1').prompt, /spec-tool check exited 1/);
  assert.equal(r.results[0].merged, true);
});

test('E31: the load prompts name the exit codes by command, not by value', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  for (const l of ['E1:spec-load1', 'E1:plan-load1']) {
    const p = calls.find((c) => c.label === l).prompt;
    assert.ok(!p.includes('checkExit = 1') && !p.includes('emitExit = 2'), l);
    assert.match(p, /capture\.mjs" run --nonce \S+ --task E1-load /, l); // the exit codes come from the capture line of each command, not from the prompt
  }
});

test('E31: checkSpecLoad fails the load when checkExit disagrees with summary.exitCode', () => {
  const card1 = { id: 'E1', acceptance: [{ id: 'AC1', text: 'works' }] };
  const emit = specEmitOf('E1', { acceptance: card1.acceptance });
  const mk = (checkExit, checkStdout) => PURE_X.checkSpecLoad({ checkExit, checkStdout, emitExit: 0, emitStdout: emit }, 'E1', card1);
  const a = mk(1, specToolJson(0));
  assert.equal(a.ok, false);
  assert.match(a.why, /differs from summary\.exitCode 0/);
  assert.equal(mk(0, specToolJson(1)).ok, false);
  const agree = mk(1, specToolJson(1));
  assert.deepEqual([agree.ok, agree.checkFailed], [true, true]);
  const noInt = mk(1, '{"tool":"spec-tool","summary":{}}');
  assert.deepEqual([noInt.ok, noInt.checkFailed], [true, true]);
});

test('a reused native spec without owner note calls no author and records no duplicate decision', async () => {
  seenDecisions.clear();
  const nativeSetup = (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, taskCommits: 0, committedTasks: [], nativeSpec: true, nativePlan: false } : undefined);
  const over = both(nativeSetup, specWith({ rulings: [ruling({ id: 'R1', decision: 'Use the cache.' })] }));
  const one = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over });
  for (const l of ['E1:spec', 'E1:spec-commit']) assert.ok(!one.labels.includes(l), l);
  assert.ok(one.labels.includes('E1:spec-load1'));
  assert.equal(one.r.results[0].planOnly, true);
  assert.equal(seenDecisions.size, 1);
  const two = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over });
  assert.equal(two.r.results[0].planOnly, true);
  assert.equal(seenDecisions.size, 1);
  assert.ok(promptCommands(two.calls.find((c) => /^E1:status-c$/.test(c.label)).prompt).some((c) => /add-decision/.test(c)));
});

test('the spec fixer keeps its text and adds the block sentence', async () => {
  const issue = { issues: [{ severity: 'critical', category: 'defeito', description: 'x' }], headSha: 'a1', clean: true, commitsInRange: 1 };
  const { calls, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:spec-review1' ? issue : l === 'E1:spec-fix1' ? { specPath: 'x', slug: 'x', decisions: [], humanInputs: [] } : undefined) });
  const p = calls.find((c) => c.label === 'E1:spec-fix1').prompt;
  const keep = 'Fix the spec docs/plans/x-E1/spec.md according to the review below, in autonomous mode, and commit. Stop after the commit.';
  const ret = 'Return specPath, slug (without the ID), decisions (full list), humanInputs (full list).';
  assert.ok(p.includes(keep));
  assert.ok(p.includes(ret));
  assert.ok(p.indexOf(keep) < p.indexOf(ret));
  const tail = p.slice(p.indexOf(ret) + ret.length);
  assert.match(tail, /spec\/1/);
  assert.match(tail, /spec-tool\.mjs" check "[^"]*spec\.md" --roadmap/);
  assert.ok(labels.indexOf('E1:spec-fix1') < labels.lastIndexOf('E1:spec-review2'));
});

test('the commit agent writes the message with Write, commits with -F and only the spec', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const c = calls.find((x) => x.label === 'E1:spec-commit');
  assert.equal(c.opts.model, 'haiku');
  assert.match(c.prompt, /Write tool/);
  assert.match(c.prompt, /git -C "\/wt\/E1" add -- docs\/plans\/x-E1\/spec\.md/);
  assert.match(c.prompt, /git -C "\/wt\/E1" commit -F "\/wt\/_tmp\/E1-spec-commit\.txt"/);
  assert.match(c.prompt, /git -C "\/wt\/E1" diff --cached --name-only -- docs\/plans\/x-E1\/spec\.md/);
  assert.match(c.prompt, /git -C "\/wt\/E1" status --porcelain -- docs\/plans\/x-E1\/spec\.md/);
  assert.match(c.prompt, /pending/);
  assert.ok(!c.prompt.includes('--quiet'));
  assert.ok('pending' in c.opts.schema.properties);
  assert.ok(!/ && | ; /.test(c.prompt));
});

// E31 T2: the commit steps never depend on an exit code the Bash tool does not show.
const pendingSpec = 'A  docs/plans/x-E1/spec.md';
const pendingPlan = 'M  docs/plans/x-E1/plan.md';
const emptySpec = (pending) => ({ ok: true, head: 'a1', commit: '', ...(pending === undefined ? {} : { pending }) });

test('E31 (c): an empty spec commit with the spec still pending is committed again in sonnet', async () => {
  const over = (l) => (l === 'E1:spec-commit' ? emptySpec(pendingSpec) : l === 'E1:spec-commit2' ? { ok: true, head: 'a2', commit: 'c2', pending: '' } : undefined);
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(labels.indexOf('E1:spec-commit2') > labels.indexOf('E1:spec-commit'));
  assert.equal(calls.find((c) => c.label === 'E1:spec-commit2').opts.model, 'sonnet');
  assert.ok(!labels.some((l) => /^E1:spec-fix/.test(l)));
  assert.ok(labels.includes('E1:spec-review1'));
  assert.equal(r.results[0].merged, true);
});

test('E31 (c): a spec still pending after the second commit fails as infra before the review', async () => {
  for (const first of [emptySpec(pendingSpec), emptySpec(undefined)]) {
    const over = (l) => (l === 'E1:spec-commit' ? first : l === 'E1:spec-commit2' ? emptySpec(pendingSpec) : undefined);
    const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
    assert.equal(r.results[0].failKind, 'infra');
    assert.match(r.results[0].error, /spec commit: docs\/plans\/x-E1\/spec\.md still pending after an empty commit/);
    assert.ok(!labels.includes('E1:spec-review1'));
    assert.ok(!labels.some((l) => /^E1:spec-fix/.test(l)));
  }
  const unmeasured = (l) => (l === 'E1:spec-commit' || l === 'E1:spec-commit2' ? emptySpec(undefined) : undefined);
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: unmeasured });
  assert.ok(labels.includes('E1:spec-commit2'));
});

test('E31 (d): an empty commit with nothing pending is a legitimate reuse', async () => {
  const over = (l) => (l === 'E1:spec-commit' ? emptySpec('') : undefined);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(!labels.includes('E1:spec-commit2'));
  assert.ok(!labels.some((l) => /^E1:spec-fix/.test(l)));
  assert.equal(r.results[0].merged, true);
});

test('E31 C4: an empty plan commit with the plan pending is committed again as plan-commit2, and fails as infra if it persists', async () => {
  const emptyPlan = { ok: true, head: 'a1', commit: '', pending: pendingPlan };
  const ok2 = (l) => (l === 'E1:plan-commit' ? emptyPlan : l === 'E1:plan-commit2' ? { ok: true, head: 'a2', commit: 'c2', pending: '', blob: B1 } : undefined);
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: ok2 });
  assert.equal(a.calls.find((c) => c.label === 'E1:plan-commit2').opts.model, 'sonnet');
  assert.ok(a.labels.includes('E1:plan-review1'));
  const bad = (l) => (l === 'E1:plan-commit' || l === 'E1:plan-commit2' ? emptyPlan : undefined);
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: bad });
  assert.equal(b.r.results[0].failKind, 'infra');
  assert.match(b.r.results[0].error, /plan commit: docs\/plans\/x-E1\/plan\.md still pending after an empty commit/);
  assert.ok(!b.labels.includes('E1:plan-review1'));
});

test('checkSpecLoad separates a failed check from a failed load', () => {
  const card1 = { id: 'E1', acceptance: [{ id: 'AC1', text: 'works' }] };
  const good = { checkExit: 0, checkStdout: '{}', emitExit: 0, emitStdout: specEmitOf('E1', { acceptance: card1.acceptance }) };
  assert.equal(PURE_X.checkSpecLoad(good, 'E1', card1).ok, true);
  const failed = PURE_X.checkSpecLoad({ ...good, checkExit: 1, checkStdout: 'ERR schema' }, 'E1', card1);
  assert.deepEqual([failed.ok, failed.checkFailed], [true, true]);
  assert.match(failed.why, /ERR schema/);
  for (const bad of [null, { ...good, emitExit: 1 }, { ...good, emitStdout: '{' }, { ...good, checkExit: undefined }, { ...good, emitStdout: specEmitOf('E2', { acceptance: card1.acceptance }) }]) assert.equal(PURE_X.checkSpecLoad(bad, 'E1', card1).ok, false, JSON.stringify(bad));
});

// ---- E8 T6: native plan stage, load with digest, dispatch by route
const planSetup = (over = {}) => (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, taskCommits: 0, committedTasks: [], nativeSpec: false, nativePlan: false, ...over } : undefined);
const withDigestOff = (load) => ({ ...load, emitStdout: JSON.stringify({ ...JSON.parse(load.emitStdout), digest: '00000000' }) });
const evRow1 = { ac: 'AC1', kind: 'test', command: 'npm test -- a', testRef: null, blq: null, external: false, externalDedupe: null };
const zero = { ambiguity: 0, reasoning: 0, blast: 0, verifiability: 0 };

test('AC3: a plan whose digest does not match after the retries fails as infra without running a task', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/^E1:plan-load\d$/.test(l) ? withDigestOff(planLoadOf(OLD_DEFAULT_PLAN, 'E1')) : undefined) });
  const e = r.results[0];
  assert.equal(e.failKind, 'infra');
  assert.match(e.error, /plan load: integrity digest/);
  assert.deepEqual(calls.map((c) => c.label).filter((l) => /^E1:plan-load\d$/.test(l)), [1, 2, 3, 4, 5].map((k) => `E1:plan-load${k}`));
  assert.deepEqual([1, 2, 3, 4, 5].map((k) => modelOf(calls, `E1:plan-load${k}`).model), ['haiku', 'haiku', 'sonnet', 'sonnet', 'sonnet']);
  assert.deepEqual([1, 3, 5].map((k) => modelOf(calls, `E1:plan-load${k}`).effort), ['low', 'medium', 'medium']);
  assert.ok(!labels.some((l) => /:t\d+:/.test(l)));
  assert.ok(!labels.some((l) => /^E1:status-/.test(l) && !/blocked|-read/.test(l)), 'no executing record');
  assert.ok(!labels.includes('E1:plan-review1'));
});

test('AC4: the implementer and the task reviewer get model and effort from route', async () => {
  const mk = (n, score) => ({ n, title: 't' + n, files: { create: [], modify: ['a' + n + '.js'], test: [] }, score });
  const emit = planEmitOf({ id: 'E1', roadmap: 'docs/plans/roadmap-x/', tasks: [mk(1, zero), mk(2, { ambiguity: 1, reasoning: 2, blast: 2, verifiability: 1 })], evidence: [evRow1] });
  assert.deepEqual(emit.plan.tasks.map((t) => [t.route.tier, t.route.effort, t.route.reviewTier]), [['haiku', 'low', 'sonnet'], ['sonnet', 'high', 'opus']]);
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/^E1:plan-load\d$/.test(l) ? { checkExit: 0, emitExit: 0, emitStdout: JSON.stringify(emit), blob: B1 } : undefined) });
  assert.deepEqual([modelOf(calls, 'E1:t1:impl').model, modelOf(calls, 'E1:t1:impl').effort], ['haiku', 'low']);
  assert.deepEqual([modelOf(calls, 'E1:t2:impl').model, modelOf(calls, 'E1:t2:impl').effort], ['sonnet', 'high']);
  assert.equal(modelOf(calls, 'E1:t1:spec1').model, 'opus');
  assert.equal(modelOf(calls, 'E1:t2:spec1').model, 'opus');
});

test('the plan author gets the native contract and the plan rules', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'use a table' } } });
  const c = calls.find((x) => x.label === 'E1:plan');
  assert.equal(c.opts.agentType, 'productivity-tools:plan-author');
  assert.equal(c.opts.model, undefined);
  const p = c.prompt;
  const lines = p.split('\n');
  for (const k of ['mode: unattended', 'output: /wt/E1/docs/plans/x-E1/plan.md', 'planTool: /p/productivity-tools/scripts/plan-tool.mjs', 'spec: /wt/E1/docs/plans/x-E1/spec.md', 'roadmap: docs/plans/roadmap-x/', 'card: E1']) assert.ok(lines.includes(k), k);
  assert.ok(lines.some((x) => /^language: /.test(x)));
  const at = (k) => lines.findIndex((x) => x.startsWith(k));
  assert.ok(['mode:', 'output:', 'planTool:', 'spec:', 'language:', 'roadmap:', 'card:'].every((k) => at(k) < at('ownerNote:')));
  assert.equal(lines.filter((x) => /^[a-zA-Z]+: /.test(x) && ['mode', 'output', 'planTool', 'spec', 'language', 'roadmap', 'card', 'ownerNote'].includes(x.split(':')[0])).length, 7);
  assert.ok(p.indexOf('ownerNote:') > p.indexOf('card: E1'));
  assert.ok(p.indexOf('**Roadmap:** docs/plans/roadmap-x/') > p.indexOf('ownerNote:'));
  assert.ok(lines.includes('**Roadmap:** docs/plans/roadmap-x/'));
  assert.match(p, /use a table/);
  assert.match(p, /externalDedupe/);
  assert.match(p, /Task commits start with "E1 T<n>:"/);
  assert.ok(p.includes(PURE_X.NO_ASK || 'Never ask the person anything'));
  assert.doesNotMatch(p, /superpowers:writing-plans/);
});

test('frozen tasks: an owner note that rewrites a committed task restores the plan and stops', async () => {
  const P0 = { ...OLD_DEFAULT_PLAN, tasks: [tk(1, false), tk(2, false), tk(3, false)] };
  const P1 = { ...OLD_DEFAULT_PLAN, tasks: [tk(1, false), tk(2, false, { title: 'changed by the note' }), tk(3, false)] };
  let n = 0;
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'rewrite task 2' } },
    over: both(planSetup({ taskCommits: 2, committedTasks: [1, 2], nativeSpec: true, nativePlan: true }), (l) => (l === 'E1:plan-load1' ? planLoadOf(n++ === 0 ? P0 : P1, 'E1') : undefined)) });
  const e = r.results[0];
  assert.equal(labels.filter((l) => l === 'E1:plan').length, 2);
  assert.match(calls.filter((c) => c.label === 'E1:plan')[1].prompt, /task 2 is committed but changed/);
  assert.match(calls.filter((c) => c.label === 'E1:plan')[0].prompt, /Tasks already committed on this branch \(1, 2\) are frozen/);
  const cm = calls.find((c) => c.label === 'E1:plan-commit');
  assert.ok(cm.prompt.includes('git -C "/wt/E1" checkout -- docs/plans/x-E1/plan.md'));
  assert.ok(r.operatorActions.some((o) => o.kind === 'plan-frozen-tasks' && o.deliverable === 'E1'));
  assert.equal(e.failKind, 'conteudo');
  assert.ok(!labels.some((l) => /:t\d+:impl/.test(l)));
  assert.ok(!calls.some((c) => c.label === 'E1:plan-commit' && /-C "[^"]*" commit -F/.test(c.prompt)), 'nothing is committed');
});

test('frozen tasks: a note that touches only the tasks not yet committed is committed', async () => {
  const P0 = { ...OLD_DEFAULT_PLAN, tasks: [tk(1, false), tk(2, false)] };
  const P1 = { ...OLD_DEFAULT_PLAN, tasks: [tk(1, false), tk(2, false, { title: 'changed by the note' })] };
  let n = 0;
  const { labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'rewrite task 2' } },
    over: both(planSetup({ taskCommits: 1, committedTasks: [1], nativeSpec: true, nativePlan: true }), (l) => (l === 'E1:plan-load1' ? planLoadOf(n++ === 0 ? P0 : P1, 'E1') : undefined)) });
  assert.equal(labels.filter((l) => l === 'E1:plan').length, 1);
  assert.match(calls.find((c) => c.label === 'E1:plan-commit').prompt, /commit -F/);
});

test('frozen tasks: the previous plan is loaded with --no-spec, the new plan with --spec', async () => {
  const P0 = { ...OLD_DEFAULT_PLAN, tasks: [tk(1, false), tk(2, false)] };
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { notes: { E1: 'add an edge case' } },
    over: both(planSetup({ taskCommits: 1, committedTasks: [1], nativeSpec: true, nativePlan: true }), (l) => (l === 'E1:plan-load1' ? planLoadOf(P0, 'E1') : undefined)) });
  const loads = calls.filter((c) => c.label === 'E1:plan-load1')
  assert.ok(loads.length >= 2)
  assert.match(loads[0].prompt, /plan-tool\.mjs' 'check' '[^']*' '--no-spec'/)
  assert.doesNotMatch(loads[0].prompt, /'--spec'/)
  assert.match(loads[1].prompt, /plan-tool\.mjs' 'check' '[^']*' '--spec'/)
})

test('a native plan reused without owner note calls no author and makes no commit', async () => {
  const { labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'],
    over: both(planSetup({ taskCommits: 1, committedTasks: [1], nativeSpec: true, nativePlan: true }), (l) => (l === 'E1:progress' ? { head: 'c1', clean: true, done: [{ n: 1, firstParent: 'h0', last: 'c1' }] } : undefined)) });
  assert.ok(!labels.includes('E1:plan'));
  assert.ok(!labels.includes('E1:plan-commit'));
  assert.ok(labels.includes('E1:plan-load1'));
  assert.ok(!labels.includes('E1:t1:impl'), 'the committed task is not implemented again');
  assert.ok(calls.some((c) => c.label === 'E1:t1:spec1'));
});

test('the plan fixer keeps its text and adds the block sentence', async () => {
  const { calls, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: noHeader });
  const p = calls.find((c) => c.label === 'E1:plan-fix1').prompt;
  const keep = 'Fix the plan docs/plans/x-E1/plan.md according to the review below and commit. Stop after the commit.';
  const ret = String.raw`Return planPath, planBlob (output of git rev-parse HEAD:<planPath>, measured after the commit), roadmapHeader, ac (full list, each command copied verbatim from the file with a table-escaped \| written as |, with external and externalDedupe) and tasks (full list, with files copied from the plan, noCommit (same rule as the plan stage), tier, reviewTier, needsLock, external and externalDedupe).`;
  assert.ok(p.includes(keep));
  assert.ok(p.includes(ret));
  assert.ok(p.indexOf(keep) < p.indexOf(ret));
  const tail = p.slice(p.indexOf(ret) + ret.length);
  assert.match(tail, /plan\/1/);
  assert.match(tail, /plan-tool\.mjs" check "[^"]*plan\.md" --spec/);
  assert.ok(labels.indexOf('E1:plan-fix1') < labels.lastIndexOf('E1:plan-review2'));
  assert.ok(labels.indexOf('E1:plan-fix1') < labels.indexOf('E1:plan-load2') || labels.includes('E1:plan-load1'));
  assert.equal(modelOf(calls, 'E1:plan-fix1').schema, undefined);
});

test('the plan review no longer asks for evidence rows and the plan stage no longer reads the transcribed header', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const rv = calls.find((c) => c.label === 'E1:plan-review1');
  assert.doesNotMatch(rv.prompt, /evidenceRows/);
  assert.deepEqual(rv.opts.schema.required.filter((k) => k === 'evidenceRows' || k === 'measuredPlanBlob'), ['measuredPlanBlob']);
  assert.match(rv.prompt, /a missing "\*\*Roadmap:\*\* docs\/plans\/roadmap-x\/" line in the header/);
});

test('checkPlanLoad accepts a faithful emit and rejects exit, digest and blob problems', () => {
  const good = planLoadOf(OLD_DEFAULT_PLAN, 'E1');
  const args = { E: 'E1', RM: 'docs/plans/roadmap-x/' };
  const ok = PURE_X.checkPlanLoad(good, args);
  assert.equal(ok.ok, true);
  assert.equal(ok.blob, B1);
  assert.equal(PURE_X.checkPlanLoad({ ...good, blob: 'nope' }, args).blob, '');
  for (const bad of [null, { ...good, emitExit: undefined }, { ...good, emitExit: 1, checkStdout: 'ERR x' }, withDigestOff(good), { ...good, emitStdout: '{' }]) assert.equal(PURE_X.checkPlanLoad(bad, args).ok, false, JSON.stringify(bad).slice(0, 80));
  assert.match(PURE_X.checkPlanLoad({ ...good, emitExit: 1, checkStdout: 'ERR x' }, args).why, /ERR x/);
});

// E8 T7: artifacts live in docs/plans/<roadmap slug>-<E>/, the spec and plan stages never name superpowers, and the fixed rules ask for simple commands.
test('AC1: spec and plan stage prompts and artifact paths never cite superpowers and all forbid asking the person', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const stage = calls.filter((c) => ['Spec', 'Plan'].includes(c.opts.phase) && /:(spec|plan)(-load\d|-commit|-review\d|-fix\d)?$/.test(c.label));
  assert.ok(stage.length >= 6, stage.map((c) => c.label).join(','));
  for (const c of stage) {
    assert.ok(c.prompt.includes(NO_ASK_TEXT), c.label);
    assert.ok(!/superpowers/.test(c.prompt), c.label);
  }
  assert.ok(!/superpowers/.test(r.reportPath));
  assert.match(r.reportPath, /^docs\/reports\/2026-11-09-E1-run\.md$/);
  const log = calls.find((c) => c.label === 'E1:review-log').prompt;
  assert.match(log, /docs\/plans\/x-E1\/reviews\.md/);
  assert.ok(!/superpowers/.test(log));
  const rr = await resumedRun();
  const rl = rr.calls.find((c) => c.label === 'E1:resume-review-log').prompt;
  assert.ok(!/superpowers/.test(rl));
  assert.match(rl, /docs\/plans\/x-E1\/reviews\.md/);
  assert.ok(!/docs\/superpowers/.test(readFileSync(new URL('./roadmap-release.js', import.meta.url), 'utf8')));
});

test('a finish-merge resume of a previous-version deliverable reports review log not read', async () => {
  const { r, calls } = await exec({ cards: [unfinished()], deliverables: ['E1'], over: (l) => (l === 'E1:resume-review-log' ? { found: false, acceptedRisks: [], humanInputs: [] } : undefined) });
  const p = calls.find((c) => c.label === 'E1:resume-review-log').prompt;
  assert.ok(p.includes('docs/plans/x-E1/'));
  assert.ok(!/docs\/superpowers/.test(p));
  assert.ok(r.results[0].concerns.some((c) => /review log not read/.test(c)));
});

test('the fixed rules ask for simple commands', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:t1:impl').prompt;
  assert.match(p, /One simple command per call/i);
  assert.match(p, /no heredoc, no loop, no chaining with '&&' or ';'/);
  assert.match(p, /Write tool/);
  assert.match(p, /git commit -F/);
  assert.ok(!/never an unquoted shell heredoc/.test(p));
});

// ---- E8 T8: dependents held by a pending contract decision
const chain = () => [card('E1'), card('E2', { deps: ['E1'] }), card('E3')];
const contractSpec = (E = 'E1') => specWith({ rulings: [ruling({ id: 'R1', decision: 'Hold contract wording ' + E + ' alpha.', scope: 'contract' })] }, E);
const runsOf = (r) => Object.fromEntries(r.results.map((x) => [x.id, x]));
test('AC8: a contract ruling holds a selected dependent citing the decision and an independent deliverable runs', async () => {
  const { r, labels } = await exec({ cards: chain(), deliverables: ['E1', 'E2', 'E3'], over: (l) => (/^E1:/.test(l) ? contractSpec('E1')(l) : undefined) });
  const m = runsOf(r);
  assert.equal(m.E1.merged, true);
  assert.equal(m.E3.merged, true);
  assert.equal(m.E2.merged, false);
  assert.equal(m.E2.skipped, true);
  assert.equal(m.E2.error, 'held by DEC-900 (E1, contract, pending ratification)');
  assert.ok(!labels.some((l) => /^E2:/.test(l)));
  assert.ok(labels.includes('E3:merge'));
  assert.ok(labels.includes('E1:merge'));
});

test('AC8 fail safe: a failed executing record of a contract ruling still holds the dependent', async () => {
  const over = (l) => (/^E1:/.test(l) ? (isGroupCopy(l) ? { exit: 1, stdout: 'boom' } : contractSpec('E1')(l)) : undefined);
  const { r, labels } = await exec({ cards: chain(), deliverables: ['E1', 'E2', 'E3'], over });
  const m = runsOf(r);
  assert.equal(m.E2.merged, false);
  assert.equal(m.E2.skipped, true);
  assert.equal(m.E2.error, 'held by unconfirmed contract ruling of E1 (E1, contract, pending ratification)');
  assert.ok(!labels.some((l) => /^E2:/.test(l)));
  assert.equal(m.E3.merged, true);
});

test('a transitive dependent is held citing the origin decision', async () => {
  const cards = [card('E1'), card('E2', { deps: ['E1'] }), card('E3', { deps: ['E2'] })];
  const { r, labels } = await exec({ cards, deliverables: ['E1', 'E2', 'E3'], over: (l) => (/^E1:/.test(l) ? contractSpec('E1')(l) : undefined) });
  const m = runsOf(r);
  assert.equal(m.E1.merged, true);
  assert.equal(m.E2.error, 'held by DEC-900 (E1, contract, pending ratification)');
  assert.equal(m.E3.error, 'held by DEC-900 (E1, contract, pending ratification)');
  assert.ok(!labels.some((l) => /^E[23]:/.test(l)));
});

// A contract ruling recorded by a plan-only run comes back from add-decision as existing: true when the full run records it again.
async function rerecorded({ ratify }) {
  seenDecisions.clear();
  ratifiedDecisions.clear();
  const over = (l) => (/^E1:/.test(l) ? contractSpec('E1')(l) : undefined);
  const po = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over });
  assert.equal(po.r.results[0].planOnly, true);
  assert.equal(seenDecisions.size, 1);
  const id = [...seenDecisions.values()][0];
  if (ratify) ratifiedDecisions.add(id);
  const full = await exec({ cards: [card('E1'), card('E2', { deps: ['E1'] })], deliverables: ['E1', 'E2'], over });
  seenDecisions.clear();
  ratifiedDecisions.clear();
  return { id, m: runsOf(full.r), labels: full.labels };
}
test('a re-recorded contract decision the owner already ratified holds no dependent (existing: true, not pending)', async () => {
  const { m, labels } = await rerecorded({ ratify: true });
  assert.equal(m.E1.merged, true);
  assert.notEqual(m.E2.skipped, true, m.E2.error);
  assert.equal(m.E2.merged, true);
  assert.ok(labels.includes('E2:merge'));
});
test('a re-recorded contract decision still pending ratification holds the dependent (existing: true, pending)', async () => {
  const { id, m, labels } = await rerecorded({ ratify: false });
  assert.equal(m.E1.merged, true);
  assert.equal(m.E2.skipped, true);
  assert.equal(m.E2.error, `held by ${id} (E1, contract, pending ratification)`);
  assert.ok(!labels.some((l) => /^E2:/.test(l)));
});
test('a newly written contract decision (existing: false) holds the dependent', async () => {
  seenDecisions.clear();
  ratifiedDecisions.clear();
  const { r } = await exec({ cards: chain(), deliverables: ['E1', 'E2'], over: (l) => (/^E1:/.test(l) ? contractSpec('E1')(l) : undefined) });
  seenDecisions.clear();
  const m = runsOf(r);
  assert.equal(m.E1.merged, true);
  assert.equal(m.E2.error, 'held by DEC-900 (E1, contract, pending ratification)');
});

test('a pending contract decision read in discovery holds unstarted dependents and not its owner', async () => {
  const pend = [{ id: 'DEC-7', deliverable: 'E1', scope: 'contract', startedDependents: [] }];
  const reason = 'held by DEC-7 (E1, contract, pending ratification)';
  const live = await exec({ cards: chain(), deliverables: ['E1', 'E2', 'E3'], discOver: { pendingDecisions: pend } });
  assert.equal(runsOf(live.r).E1.merged, true);
  assert.equal(runsOf(live.r).E2.error, reason);
  assert.ok(!live.labels.some((l) => /^E2:/.test(l)));
  const po = await exec({ cards: chain(), deliverables: ['E1', 'E2', 'E3'], args: { mode: 'plan-only' }, discOver: { pendingDecisions: pend } });
  assert.equal(runsOf(po.r).E1.planOnly, true);
  assert.equal(runsOf(po.r).E2.error, reason);
  assert.ok(!po.labels.some((l) => /^E2:/.test(l)));
  const dry = await exec({ cards: chain(), deliverables: ['E1', 'E2', 'E3'], args: { mode: 'dry-run' }, discOver: { pendingDecisions: pend } });
  assert.ok(!dry.labels.some((l) => /^E\d:/.test(l)));
  assert.deepEqual(dry.r.selection.held, [{ id: 'E2', reason }]);
  const started = [{ id: 'DEC-7', deliverable: 'E1', scope: 'contract', startedDependents: ['E2'] }];
  const st = await exec({ cards: chain(), deliverables: ['E1', 'E2', 'E3'], args: { mode: 'dry-run' }, discOver: { pendingDecisions: started } });
  assert.deepEqual(st.r.selection.held, []);
});

// E10 (R15): pendingDecisions arrives as a list in the signed data (the list itself is computed in preflight.test.mjs); a value that is not a list, or a wrong digest, stops the run.
test('discovery requires pendingDecisions as a list', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const bad = await exec({ cards: [card('E1')], deliverables: ['E1'], discOver: { pendingDecisions: 'not a list' } });
  assert.equal(bad.r.status, 'error');
  assert.match(bad.r.error, /pendingDecisions/);
  const missing = await exec({ cards: [card('E1')], deliverables: ['E1'], discOver: { pendingDecisions: undefined } });
  assert.match(missing.r.error, /pendingDecisions/);
  const wrong = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, p) => (/^discovery(-retry\d)?$/.test(l) ? { exit: 0, stdout: discSlices(p, { pendingDecisions: [] }).replace('"digest":"', '"digest":"0') } : undefined) });
  assert.match(wrong.r.error, /^discovery failed: /);
  assert.equal(r.results[0].merged, true);
});

test('docs-measure schema has no status field', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { docsStage: { instructions: 'x', measure: 'm' } } });
  const s = calls.find((c) => c.label === 'E1:docs-measure1').opts.schema;
  assert.equal('status' in s.properties, false);
  assert.equal('brief' in s.properties, false);
  assert.deepEqual(s.required, ['measureOk']);
  const p = calls.find((c) => c.label === 'E1:docs-measure1').prompt;
  assert.doesNotMatch(p, /statusStdout|briefStdout/);
});

test('a docs-read answer passes without the missing-panel alarm', async () => {
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  assert.equal(r.results[0].merge.docsOk, true);
  assert.ok(!JSON.stringify(r).includes('reread status --json is missing or has no panel'));
});

// ---- E21 T4: restricted re-review is off by default ----
const restrictedRun = (config) => {
  let n = 0;
  return exec({ cards: [card('E1')], deliverables: ['E1'], config, over: withPlan([tk(1, false)], (l) => {
    if (l === 'E1:t1:spec1' && n++ === 0) return { issues: [{ severity: 'critical', category: 'defeito', id: 'F1', file: 'a.js', description: 'x' }], headSha: 'h7', clean: true, commitsInRange: 2 };
    if (l === 'E1:t1:spec-fix1') return { status: 'DONE', summary: 'f', checks: [] };
    return undefined;
  }) });
};

test('AC2: the default configuration rereads the task range, taskReview.restricted adds the fix diff package', async () => {
  const off = await restrictedRun({});
  const offPrompt = off.calls.find((c) => c.label === 'E1:t1:spec2').prompt;
  assert.match(offPrompt, /log -p \S+\.\.HEAD/);
  assert.doesNotMatch(offPrompt, /review-package\.mjs/);
  const on = await restrictedRun({ taskReview: { restricted: true } });
  const onPrompt = on.calls.find((c) => c.label === 'E1:t1:spec2').prompt;
  assert.match(onPrompt, /Mode: restricted/);
  assert.match(onPrompt, /review-package\.mjs" "\/wt\/E1" h7 HEAD "\/wt\/_tmp\/E1-t1-spec2\.diff"/);
  assert.doesNotMatch(onPrompt, /log -p \S+\.\.HEAD/);
  assert.match(on.calls.find((c) => c.label === 'E1:t1:spec1').prompt, /log -p \S+\.\.HEAD/);
  const flag = await restrictedRun({ taskReview: { restricted: 'true' } });
  assert.doesNotMatch(flag.calls.find((c) => c.label === 'E1:t1:spec2').prompt, /review-package\.mjs/);
});

// ---- E21 T11: default half of AC3 (spec and quality reviews on the task-reviewer agent) ----
test('AC3: default spec and quality reviews on the task-reviewer agent', async () => {
  const def = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)]) });
  const task = def.calls.filter((c) => /^E1:t1:/.test(c.label));
  assert.deepEqual(task.map((c) => c.label).filter((l) => /(spec|quality)\d$/.test(l)), ['E1:t1:spec1', 'E1:t1:quality1']);
  assert.ok(!def.calls.some((c) => /^E1:t1:review/.test(c.label)));
  for (const l of ['E1:t1:spec1', 'E1:t1:quality1']) {
    const o = def.calls.find((c) => c.label === l).opts;
    assert.equal(o.agentType, 'productivity-tools:task-reviewer');
    assert.ok(o.model);
  }
  assert.equal(def.calls.find((c) => c.label === 'E1:t1:spec1').opts.model, def.calls.find((c) => c.label === 'E1:t1:quality1').opts.model);
});

test('E23: runKey and skipReview compare every recorded value', () => {
  const pure = loadPure();
  assert.equal(pure.runKey('not json'), null);
  const cur = { recorded: { schema: 'run/1', spec: { spec: 's1' }, plan: { spec: 's1', plan: 'p1' }, final: { spec: 's1', plan: 'p1', tree: 't1', target: 'T1' } }, spec: 's1', plan: 'p1', tree: 't1' };
  const k = pure.runKey(JSON.stringify(cur));
  assert.deepEqual(k, cur);
  assert.equal(pure.skipReview('spec', k, 'T1'), true);
  assert.equal(pure.skipReview('plan', k, 'T1'), true);
  assert.equal(pure.skipReview('final', k, 'T1'), true);
  assert.equal(pure.skipReview('final', k, 'T2'), false);
  assert.equal(pure.skipReview('final', k, ''), false);
  assert.equal(pure.skipReview('spec', null, 'T1'), false);
  assert.equal(pure.skipReview('spec', { ...k, spec: 's2' }, 'T1'), false);
  assert.equal(pure.skipReview('plan', { ...k, plan: 'p2' }, 'T1'), false);
  assert.equal(pure.skipReview('plan', { ...k, spec: null }, 'T1'), false);
  assert.equal(pure.skipReview('final', { ...k, tree: 't2' }, 'T1'), false);
  assert.equal(pure.skipReview('final', { ...k, tree: '' }, 'T1'), false);
  const noFinal = { ...cur, recorded: { schema: 'run/1', spec: cur.recorded.spec } };
  assert.equal(pure.skipReview('spec', noFinal, 'T1'), true);
  assert.equal(pure.skipReview('plan', noFinal, 'T1'), false);
  assert.equal(pure.skipReview('final', noFinal, 'T1'), false);
  assert.equal(pure.skipReview('final', { ...cur, recorded: null }, 'T1'), false);
});

test('E23: recordCmd builds the approve command', () => {
  const pure = loadPure();
  const payload = { trailer: "it's", prep: { gatesKey: 'g' } };
  const enc = encodeURIComponent(JSON.stringify(payload)).replace(/'/g, '%27');
  assert.equal(
    pure.recordCmd('/p/rr/run-record.mjs', '/w/E1', 'docs/plans/x-E1/', 'E1', 'spec,plan', null, payload),
    `node "/p/rr/run-record.mjs" approve "/w/E1" docs/plans/x-E1/ E1 spec,plan - '${enc}'`,
  );
  const cmd = pure.recordCmd('/p/rr/run-record.mjs', '/w/E1', 'docs/plans/x-E1/', 'E1', 'final', 'abc123', { trailer: "a'b" });
  assert.ok(cmd.includes(' final abc123 '));
  assert.ok(cmd.includes('%27'));
  assert.equal(cmd.slice(cmd.indexOf(" '") + 2, -1).includes("'"), false);
});

test('E23: recordedBaseline accepts only a matching valid measure', () => {
  const pure = loadPure();
  const defs = [{ name: 'g1', kind: 'exit' }];
  const baseline = { clean: true, headSha: 'abc1234'.padEnd(40, '0'), gates: [{ name: 'g1', ran: true, exit: 0 }] };
  const out = JSON.stringify({ targetHead: 'abc1234', gatesKey: 'k', baseline });
  assert.deepEqual(pure.recordedBaseline(out, 'abc1234', 'k', defs), baseline);
  assert.equal(pure.recordedBaseline(out, 'def5678', 'k', defs), null);
  assert.equal(pure.recordedBaseline(out, 'abc1234', 'other', defs), null);
  assert.equal(pure.recordedBaseline(JSON.stringify({ targetHead: 'abc1234', gatesKey: 'k', baseline: { ...baseline, clean: false } }), 'abc1234', 'k', defs), null);
  assert.equal(pure.recordedBaseline(out, 'abc1234', 'k', [{ name: 'missing', kind: 'exit' }]), null);
  assert.equal(pure.recordedBaseline('not json', 'abc1234', 'k', defs), null);
  assert.equal(pure.recordedBaseline('', 'abc1234', 'k', defs), null);
});

test('E36 T4: recordedBaseline accepts a baseline whose tests gates carry outPath and outSha', () => {
  const pure = loadPure();
  const defs = [{ name: 'u', kind: 'tests' }];
  const baseline = { clean: true, headSha: 'abc1234'.padEnd(40, '0'), gates: [{ name: 'u', ran: true, exit: 0, total: 3, skipped: 0, failedNames: [], outPath: '/r/.git/pt-evidence/E1-T1/0001-stdout.txt', outSha: 'a'.repeat(64) }] };
  const out = JSON.stringify({ targetHead: 'abc1234', gatesKey: 'k', baseline });
  assert.deepEqual(pure.recordedBaseline(out, 'abc1234', 'k', defs), baseline);
  const next = pure.refreshBaseline({}, defs, baseline, []);
  assert.equal(next.u.outPath, baseline.gates[0].outPath);
  assert.equal(next.u.outSha, baseline.gates[0].outSha);
});

// ---- E23 T4: setup reads the record; the spec and plan reviews are skipped; the approval is written by the progress and review-log agents.
const RUN_REC = { schema: 'run/1', spec: { spec: SB }, plan: { spec: SB, plan: B1 } };
const recordedSetup = (rec) => (l) => (l === 'E1:setup' ? { ok: true, worktree: '/wt/E1', baseCommit: 'b1', head: 'a1', clean: true, taskCommits: 0, committedTasks: [], nativeSpec: true, nativePlan: true, record: JSON.stringify({ recorded: rec, spec: SB, plan: B1, tree: 't1' }) } : undefined);
const RR_PATH = '/p/productivity-tools/scripts/run-record.mjs';
const approvePrefix = (stages) => `node "${RR_PATH}" approve "/wt/E1" docs/plans/x-E1/ E1 ${stages} - '`;
const payloadOf = (prompt) => JSON.parse(decodeURIComponent(prompt.slice(prompt.indexOf(" - '") + 4, prompt.indexOf("'", prompt.indexOf(" - '") + 4))));

const FINAL_REC = { ...RUN_REC, final: { spec: SB, plan: B1, tree: 't1', target: 'abc1234' } };
const withSync = (rec, tip) => (l) => (l === 'E1:sync' ? { ok: true, head: 'a2', conflictsResolved: 0, targetTip: tip, deltaFiles: [], record: JSON.stringify({ recorded: rec, spec: SB, plan: B1, tree: 't1' }) } : recordedSetup(rec)(l));

test('E33: a spec commit that moved HEAD without returning its hash is not a reuse: the spec review runs', async () => {
  const commitAs = (head) => (l) => (l === 'E1:spec-commit' ? { ok: true, head, commit: '', pending: '' } : undefined);
  const args = { notes: { E1: 'use the X adapter' } };
  // the load measured a1; the commit agent says head h2 and no hash: a commit was made, the freshly written spec is reviewed
  const moved = await exec({ cards: [card('E1')], deliverables: ['E1'], args, over: both(commitAs('h2'), recordedSetup(RUN_REC)) });
  assert.ok(moved.labels.includes('E1:spec'));
  assert.ok(moved.labels.includes('E1:spec-review1'), moved.labels.join(' '));
  assert.ok(!moved.r.results[0].concerns.some((c) => /spec review skipped/.test(c)));
  // an unmeasured head is not a reuse either
  const blank = await exec({ cards: [card('E1')], deliverables: ['E1'], args, over: both(commitAs(''), recordedSetup(RUN_REC)) });
  assert.ok(blank.labels.includes('E1:spec-review1'), blank.labels.join(' '));
  // the same head as the load and no hash: nothing was committed, the recorded review still holds
  const same = await exec({ cards: [card('E1')], deliverables: ['E1'], args, over: both(commitAs('a1'), recordedSetup(RUN_REC)) });
  assert.ok(!same.labels.includes('E1:spec-review1'), same.labels.join(' '));
  assert.ok(same.r.results[0].concerns.some((c) => /spec review skipped/.test(c)));
});

// E37 T5 (B08): the spec review is skipped only when the blob of the spec at the load is the recorded one.
const specBlobIs = (blob) => (l) => (/:spec-load\d$/.test(l) ? { ...specLoadOk('E1', { acceptance: [{ id: 'AC1', text: 'works' }] }), blob } : undefined);
const sameHeadCommit = (l) => (l === 'E1:spec-commit' ? { ok: true, head: 'a1', commit: '', pending: '' } : undefined);
const noteArgs = { notes: { E1: 'use the X adapter' } };

test('E37 T5 (a): an author who commits a changed spec in a way that leaves HEAD alone is reviewed (blob differs from the record)', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: noteArgs, over: both(sameHeadCommit, specBlobIs(B2), recordedSetup(RUN_REC)) });
  assert.ok(x.labels.includes('E1:spec-review1'), x.labels.join(' '));
  assert.ok(!x.r.results[0].concerns.some((c) => /spec review skipped/.test(c)));
});

test('E37 T5 (b): the blob of the load equal to the record skips the spec review as before; the load measures HEAD:<spec>', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: noteArgs, over: both(sameHeadCommit, specBlobIs(SB), recordedSetup(RUN_REC)) });
  assert.ok(!x.labels.includes('E1:spec-review1'), x.labels.join(' '));
  assert.ok(x.r.results[0].concerns.some((c) => /spec review skipped/.test(c)));
  const blob = x.calls.find((c) => c.label === 'E1:spec-load1-blob');
  assert.ok(blob && blob.prompt.includes('rev-parse') && blob.prompt.includes('HEAD:docs/plans/x-E1/spec.md'), blob && blob.prompt);
  assert.ok(x.labels.indexOf('E1:spec-load1-blob') < x.labels.indexOf('E1:spec-load1-head'));
  // a blob that is not a hash is no blob: the review runs
  const junk = await exec({ cards: [card('E1')], deliverables: ['E1'], args: noteArgs, over: both(sameHeadCommit, specBlobIs('fatal: bad revision'), recordedSetup(RUN_REC)) });
  assert.ok(junk.labels.includes('E1:spec-review1'), junk.labels.join(' '));
});

test('E37 T5 (c): a native spec inherited from the target, with a note and no record, is a reuse (no commit minimum) whose review still runs', async () => {
  const none = { schema: 'run/1' };
  const lowReview = (l) => (/^E1:spec-review\d$/.test(l) ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 0 } : undefined);
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: noteArgs, over: both(sameHeadCommit, lowReview, recordedSetup(none)) });
  assert.ok(x.labels.includes('E1:spec-review1'), x.labels.join(' '));
  assert.ok(!x.labels.includes('E1:spec-fix1'), x.labels.join(' '));
  assert.ok(!x.r.results[0].concerns.some((c) => /spec review skipped/.test(c)));
  const noRec = await exec({ cards: [card('E1')], deliverables: ['E1'], args: noteArgs, over: both(sameHeadCommit, lowReview, recordedSetup(null)) });
  assert.ok(noRec.labels.includes('E1:spec-review1') && !noRec.labels.includes('E1:spec-fix1'), noRec.labels.join(' '));
});

test('E37 T5 (d): a spec not committed yet at the load (rev-parse exits 128) is an empty blob, not a load failure; the review runs', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: noteArgs, over: both(sameHeadCommit, specBlobIs(''), recordedSetup(RUN_REC)) });
  assert.ok(x.labels.includes('E1:spec-review1'), x.labels.join(' '));
  assert.ok(!x.labels.includes('E1:spec-load2'), x.labels.join(' '));
  assert.equal(x.r.results[0].merged, true);
  assert.ok(!x.r.results[0].concerns.some((c) => /spec review skipped/.test(c)));
});

// E37 review: the plan review is skipped only when the blob of the plan at the load is the recorded one.
const planRecB1 = { schema: 'run/1', spec: { spec: SB }, plan: { spec: SB, plan: B1 } };
const planRecSetup = (l) => (l === 'E1:setup' ? { ...recordedSetup(planRecB1)(l), record: JSON.stringify({ recorded: planRecB1, spec: SB, plan: B1, tree: 't1' }) } : undefined);
const planBlobIs = (blob) => (l) => (/:plan-load\d$/.test(l) ? planLoadOf(OLD_DEFAULT_PLAN, 'E1', { blob }) : undefined);
const planCommitSame = (l) => (l === 'E1:plan-commit' ? { ok: true, head: 'a1', commit: '', pending: '' } : undefined);

test('E37 review: a plan changed by its author with HEAD left alone (blob differs from the record) is reviewed', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: noteArgs, over: both(sameHeadCommit, planCommitSame, planBlobIs(B2), planRecSetup) });
  assert.ok(x.labels.includes('E1:plan-review1'), x.labels.join(' '));
});

test('E37 review: the plan blob of the load equal to the record still skips the plan review', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], args: noteArgs, over: both(sameHeadCommit, planCommitSame, planBlobIs(B1), planRecSetup) });
  assert.ok(!x.labels.includes('E1:plan-review1'), x.labels.join(' '));
});

test('E33: a plan commit that moved HEAD without returning its hash is not a reuse: the plan review runs; a commit without its blob measures it again', async () => {
  const args = { notes: { E1: 'use the X adapter' } };
  const commits = (planAnswer) => (l) => (l === 'E1:spec-commit' ? { ok: true, head: 'a1', commit: '', pending: '' } : l === 'E1:plan-commit' ? planAnswer : undefined);
  const runWith = (planAnswer) => exec({ cards: [card('E1')], deliverables: ['E1'], args, over: both(commits(planAnswer), recordedSetup(RUN_REC)) });
  // the spec is a reuse (same head as its load), so only the plan decides the plan review
  const moved = await runWith({ ok: true, head: 'h2', commit: '', pending: '' });
  assert.ok(moved.labels.includes('E1:plan'));
  assert.ok(!moved.labels.includes('E1:spec-review1'), moved.labels.join(' '));
  assert.ok(moved.labels.includes('E1:plan-review1'), moved.labels.join(' '));
  assert.ok(!moved.r.results[0].concerns.some((c) => /plan review skipped/.test(c)));
  // an unmeasured head is not a reuse either
  const blank = await runWith({ ok: true, head: '', commit: '', pending: '' });
  assert.ok(blank.labels.includes('E1:plan-review1'), blank.labels.join(' '));
  // the same head as the load and no hash: nothing was committed, the recorded review still holds
  const same = await runWith({ ok: true, head: 'a1', commit: '', pending: '' });
  assert.ok(!same.labels.includes('E1:plan-review1'), same.labels.join(' '));
  assert.ok(same.r.results[0].concerns.some((c) => /plan review skipped/.test(c)));
  // committed without the blob: the blob is measured again after the commit, never taken from the load before it
  const noBlob = await runWith({ ok: true, head: 'h2', commit: 'c2' });
  const at = noBlob.labels.indexOf('E1:plan-commit');
  assert.ok(noBlob.labels.slice(at + 1).some((l) => /^E1:plan-load\d$/.test(l)), noBlob.labels.join(' '));
  // committed with the blob: no extra load
  const withBlob = await runWith({ ok: true, head: 'h2', commit: 'c2', blob: B2 });
  const at2 = withBlob.labels.indexOf('E1:plan-commit');
  assert.ok(!withBlob.labels.slice(at2 + 1).some((l) => /^E1:plan-load\d$/.test(l)), withBlob.labels.join(' '));
});

test('AC1: a resume with every recorded value skips the spec, plan and final reviews', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: recordedSetup(RUN_REC) });
  assert.equal(r.results[0].merged, true);
  for (const l of labels) assert.ok(!/:spec-review|:plan-review|^E1:spec$|^E1:plan$/.test(l), l);
  assert.ok(labels.includes('E1:spec-load1'));
  assert.ok(labels.includes('E1:plan-load1'));
  assert.ok(r.results[0].concerns.some((c) => /spec review skipped/.test(c) && /run\.json/.test(c)));
  assert.ok(r.results[0].concerns.some((c) => /plan review skipped/.test(c) && /run\.json/.test(c)));
  assert.ok(calls.find((c) => c.label === 'E1:progress').prompt.startsWith('Read-only'));
  const setup = calls.find((c) => c.label === 'E1:setup');
  assert.ok(setup.prompt.includes(`node "${RR_PATH}" key "/wt/E1" docs/plans/x-E1/`));
  assert.ok(setup.opts.schema.properties.record);
  // a stale plan blob: the spec stays skipped, the plan review runs
  const stale = await exec({ cards: [card('E1')], deliverables: ['E1'], over: recordedSetup({ ...RUN_REC, plan: { spec: SB, plan: 'p0' } }) });
  assert.ok(!stale.labels.includes('E1:spec-review1'));
  assert.ok(stale.labels.includes('E1:plan-review1'));
  // no record: both reviews run
  const none = await exec({ cards: [card('E1')], deliverables: ['E1'], over: recordedSetup(null) });
  assert.ok(none.labels.includes('E1:spec-review1'));
  assert.ok(none.labels.includes('E1:plan-review1'));
  // T5: the sync returns the same four values and the recorded target tip: no final review, no test-integrity, on to the gates
  const fin = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSync(FINAL_REC, 'abc1234') });
  assert.equal(fin.r.results[0].merged, true);
  for (const l of fin.labels) assert.ok(!/:final-|:test-integrity/.test(l), l);
  assert.ok(fin.labels.includes('E1:gates1-1'));
  assert.ok(fin.r.results[0].concerns.some((c) => /final review skipped/.test(c) && /run\.json/.test(c)));
  assert.ok(!fin.calls.some((c) => /review-log/.test(c.label) && c.prompt.includes('run-record.mjs')));
  const sync = fin.calls.find((c) => c.label === 'E1:sync');
  assert.ok(sync.prompt.includes(`node "${RR_PATH}" key "/wt/E1" docs/plans/x-E1/`));
  assert.ok(sync.opts.schema.properties.record);
  // a different tree after the sync: the final review runs
  const moved = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:sync' ? { ok: true, head: 'a2', conflictsResolved: 0, targetTip: 'abc1234', deltaFiles: [], record: JSON.stringify({ recorded: FINAL_REC, spec: SB, plan: B1, tree: 't2' }) } : recordedSetup(FINAL_REC)(l)) });
  assert.ok(moved.labels.includes('E1:final-1-r1'));
});

test('AC2: the final review runs again when the target moved', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSync(FINAL_REC, 'def5678') });
  assert.equal(r.results[0].merged, true);
  assert.ok(labels.includes('E1:final-1-r1'));
  assert.ok(!labels.includes('E1:spec-review1') && !labels.includes('E1:plan-review1'));
  const p = calls.find((c) => c.label === 'E1:review-log').prompt;
  assert.ok(p.includes(`node "${RR_PATH}" approve "/wt/E1" docs/plans/x-E1/ E1 final def5678 '`), p.slice(0, 300));
  assert.ok(p.indexOf('run-record.mjs') < p.indexOf('Write docs/plans/x-E1/reviews.md'));
});

test('E23: progress records spec and plan only after a review ran', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = calls.find((c) => c.label === 'E1:progress').prompt;
  assert.ok(p.startsWith(`Run first: ${approvePrefix('spec,plan')}`), p.slice(0, 200));
  assert.ok(!p.startsWith('Read-only'));
  const pay = payloadOf(p);
  assert.equal(typeof pay.trailer, 'string');
  assert.equal(pay.prep.targetHead, FULL('abc1234'));
  assert.equal(pay.prep.gatesKey, loadPure().fnv1a(JSON.stringify(loadPure().canon(GATES))));
  assert.equal(pay.prep.baseline.headSha, 'abc1234'.padEnd(40, '0'));
  const skipped = await exec({ cards: [card('E1')], deliverables: ['E1'], over: recordedSetup(RUN_REC) });
  assert.ok(skipped.calls.find((c) => c.label === 'E1:progress').prompt.startsWith('Read-only'));
  assert.ok(!skipped.calls.find((c) => c.label === 'E1:progress').prompt.includes('run-record.mjs'));
});

// E37 T8 (S3-30): a red baseline too big for the approve command is left out of it (CMD_CAP), with one concern.
// the capture line the gate copy carries is capped at 3500 bytes, so the names stay under it; spaces and > make each one encode to three times its size
const bigRed = () => gm('abc1234', { exit: 1, total: 900, failedNames: Array.from({ length: 46 }, (_, i) => `suite ${i} > a b c d e f g h i j k l m n o p q r s t u v w x y z ${i}`) });
const bigPre = (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', baseline: bigRed() } : undefined);
const approveCalls = (calls) => calls.filter((c) => c.prompt.includes(`node "${RR_PATH}" approve "/wt/E1"`));
const approveCmd = (p) => { const a = p.indexOf('node "' + RR_PATH + '" approve'); const q = p.indexOf(" '", a) + 2; return p.slice(a, p.indexOf("'", q) + 1); };

test('E37 T8 (S3-30): recordCmd drops prep above CMD_CAP, calls the callback once, and keeps a small prep', () => {
  const pure = loadPure();
  const big = { trailer: 't', prep: { baseline: 'x'.repeat(9000) } };
  const seen = [];
  const cmd = pure.recordCmd('/p/rr/run-record.mjs', '/w/E1', 'docs/plans/x-E1/', 'E1', 'spec,plan', null, big, (n) => seen.push(n));
  assert.ok(cmd.length <= 6000);
  assert.equal('prep' in JSON.parse(decodeURIComponent(cmd.slice(cmd.indexOf(" - '") + 4, -1))), false);
  assert.equal(seen.length, 1);
  assert.ok(seen[0] > 6000);
  const small = { trailer: 't', prep: { baseline: 'x' } };
  const kept = pure.recordCmd('/p/rr/run-record.mjs', '/w/E1', 'docs/plans/x-E1/', 'E1', 'spec,plan', null, small, () => seen.push(0));
  assert.ok(JSON.parse(decodeURIComponent(kept.slice(kept.indexOf(" - '") + 4, -1))).prep);
  assert.equal(seen.length, 1);
  // no prep and no callback: nothing to drop
  assert.doesNotThrow(() => pure.recordCmd('/p/rr/run-record.mjs', '/w/E1', 'd/', 'E1', 'final', 't', { trailer: 'x'.repeat(7000) }));
});

test('E37 T8 (S3-30, C4): a big red baseline gives approve commands without prep (spec,plan and final), under 6000 characters, one concern', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(bigPre, withSync(null, 'def5678')) });
  const cmds = approveCalls(x.calls);
  assert.ok(cmds.length >= 2, cmds.map((c) => c.label).join(' '));
  assert.ok(cmds.some((c) => c.prompt.includes('approve "/wt/E1" docs/plans/x-E1/ E1 spec,plan ')), cmds.map((c) => c.label).join(' '));
  assert.ok(cmds.some((c) => / E1 final def5678 '/.test(c.prompt)), cmds.map((c) => c.label).join(' '));
  for (const c of cmds) {
    const cmd = approveCmd(c.prompt);
    assert.ok(cmd.length <= 6000, `${c.label}: ${cmd.length}`);
    assert.equal('prep' in JSON.parse(decodeURIComponent(cmd.slice(cmd.indexOf(" '", cmd.indexOf('approve')) + 2, -1))), false, c.label);
  }
  const cuts = x.r.results[0].concerns.filter((c) => /run record: prep left out/.test(c));
  assert.equal(cuts.length, 1, JSON.stringify(x.r.results[0].concerns));
  assert.match(cuts[0], /above CMD_CAP/);
});

test('E37 T8 (S3-30): a small baseline keeps prep in the approve command and adds no concern', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const p = x.calls.find((c) => c.label === 'E1:progress').prompt;
  assert.ok(payloadOf(p).prep);
  assert.ok(!x.r.results[0].concerns.some((c) => /run record: prep left out/.test(c)));
});

test('E23: plan-only records spec and plan in the review log', async () => {
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' } });
  assert.equal(r.results[0].planOnly, true);
  const p = calls.find((c) => c.label === 'E1:review-log-plan').prompt;
  assert.ok(p.includes(approvePrefix('spec,plan')), p.slice(0, 300));
  assert.ok(p.indexOf('run-record.mjs') < p.indexOf('Write docs/plans/x-E1/reviews.md'));
  const pay = payloadOf(p);
  assert.equal(typeof pay.trailer, 'string');
  assert.equal('prep' in pay, false);
  assert.ok(!labels.includes('E1:progress'));
  // nothing reviewed and nothing cut: no review-log call at all
  const skipped = await exec({ cards: [card('E1')], deliverables: ['E1'], args: { mode: 'plan-only' }, over: recordedSetup(RUN_REC) });
  assert.ok(!skipped.labels.some((l) => /review-log/.test(l)));
});

// ---- E23 T6: the preflight reuses the recorded gates baseline when the target did not move.
const recordedPre = (rec) => (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', recorded: rec } : undefined);

test('AC3: an unchanged target reuses the recorded gates baseline', async () => {
  const key = loadPure().fnv1a(JSON.stringify(loadPure().canon(GATES)));
  const prep = { targetHead: FULL('abc1234'), gatesKey: key, baseline: gm('abc1234') };
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: recordedPre(JSON.stringify(prep)) });
  assert.ok(calls.find((c) => c.label === 'preflight').prompt.includes('run-record.mjs" baseline'));
  const pp = calls.find((c) => c.label === 'preflight').prompt;
  assert.ok(pp.includes('skip only the gate measurement') && pp.includes('Always, BEFORE any command: clean') && pp.includes('Install first') && !pp.includes('skip the rest of step 4'));
  assert.ok(!r.operatorActions.some((o) => /^preflight:/.test(o.kind)));
  assert.ok(calls.some((c) => c.label === 'E1:setup'));
  const prompt = calls.find((c) => c.label === 'E1:setup').prompt;
  assert.ok(prompt.includes('unit: '), prompt.slice(0, 200));
  // another gatesKey: stops in preflight as before
  const other = await exec({ cards: [card('E1')], deliverables: ['E1'], over: recordedPre(JSON.stringify({ ...prep, gatesKey: 'zzz' })) });
  assert.ok(other.r.operatorActions.some((o) => /^preflight:/.test(o.kind)));
  assert.ok(!other.calls.some((c) => c.label === 'E1:setup'));
});

test('AC3: a recorded baseline wins over a partial baseline returned by the preflight', async () => {
  const key = loadPure().fnv1a(JSON.stringify(loadPure().canon(GATES)));
  const prep = { targetHead: FULL('abc1234'), gatesKey: key, baseline: gm('abc1234') };
  const over = (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', recorded: JSON.stringify(prep), baseline: { headSha: 'abc1234', clean: true, gates: [] } } : undefined);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(!r.operatorActions.some((o) => /^preflight:/.test(o.kind)), JSON.stringify(r.operatorActions));
  assert.ok(calls.some((c) => c.label === 'E1:setup'));
});

// fix/pos-E23 (P5 fase 2): a recorded value the workflow rejects never falls back to the agent's own copy.
test('AC3: recorded in prose with a copied baseline stops at the preflight, no gate accepted', async () => {
  const over = (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234'), clean: true, envFacts: 'x', recorded: 'The baseline command printed the recorded measure; reused it.', baseline: gm('abc1234') } : undefined);
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(r.operatorActions.some((o) => o.kind === 'preflight:other'), JSON.stringify(r.operatorActions));
  assert.ok(!labels.some((l) => /^E1:/.test(l)), labels.join(','));
  // empty recorded: the measured baseline is used as before
  const measured = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'preflight' ? { ...over(l), recorded: '' } : undefined) });
  assert.ok(!measured.r.operatorActions.some((o) => /^preflight:/.test(o.kind)));
  assert.ok(measured.labels.includes('E1:setup'));
});

test('AC3: the preflight Return line names recorded and the install runs in both cases', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'] });
  const lines = calls.find((c) => c.label === 'preflight').prompt.split('\n');
  const ret = lines.find((x) => x.startsWith('Return ok'));
  assert.match(ret, /recorded \(raw stdout of step 4's first command, verbatim, as a string; then no baseline\)/, ret);
  assert.match(lines.find((x) => x.startsWith('4. ')), /Install first in both cases/);
});

test('E23 final-fix F2: a spec fix round in this run forces the plan review even when the record matches', async () => {
  let n = 0;
  const bad = (l) => (/:spec-load\d$/.test(l) && n++ === 0 ? { checkExit: 1, checkStdout: '{"errors":[{"code":"schema"}]}', emitExit: 1, emitStdout: '' } : undefined);
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both(recordedSetup(RUN_REC), both(bad, (l) => (l === 'E1:spec-fix1' ? { specPath: 'x', slug: 'x', decisions: [], humanInputs: [] } : undefined))) });
  assert.ok(labels.includes('E1:spec-fix1'));
  assert.ok(labels.includes('E1:plan-review1'));
});

test('E24 AC3: the default final review calls no final-verify; singleWave makes one final-fix1 and one final re-review', async () => {
  const issue = { severity: 'important', category: 'defeito', description: 'd' };
  const over = (l) => {
    if (/^E1:final-1-r[12]$/.test(l)) return { issues: [{ ...issue, description: `d${l.slice(-1)}` }], headSha: 'a1', clean: true, commitsInRange: 2 };
    if (/^E1:final-fix\d$/.test(l)) return { status: 'DONE', summary: 'f', checks: [] };
    return undefined;
  };
  const dflt = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'E1:final-1-r2' ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 2 } : over(l)) });
  assert.ok(dflt.labels.includes('E1:final-fix1'));
  assert.ok(!dflt.labels.some((l) => /:final-verify/.test(l)));
  const one = await exec({ cards: [card('E1')], deliverables: ['E1'], over, config: { finalReview: { singleWave: true } } });
  assert.equal(one.labels.filter((l) => /^E1:final-fix/.test(l)).join(), 'E1:final-fix1');
  assert.equal(one.labels.filter((l) => /^E1:final-1-r/.test(l)).join(), 'E1:final-1-r1,E1:final-1-r2');
  assert.ok(!one.labels.some((l) => /:final-verify/.test(l)));
  assert.notEqual(one.r.results[0].merged, true);
});

// ---- E24 T4: adversarial verification of the final review
const finalAdv = { finalReview: { adversarial: true } };
const finalIssue = (description, severity = 'important') => ({ severity, category: 'defeito', description });
const finalRev = (issues) => ({ issues, headSha: 'a1', clean: true, commitsInRange: 2 });
const loggedReviews = (x) => JSON.parse(/Data: (\{.*\})\r?\nCommit only that file/.exec(x.calls.find((c) => c.label === 'E1:review-log').prompt)[1]).reviews;
const verdictsOf = (...v) => ({ verdicts: v.map(([n, refuted, reason]) => ({ n, refuted, reason })) });

test('E24 AC1: a refuted final finding calls no final-fix and is in reviews as refuted', async () => {
  const over = (l) => {
    if (l === 'E1:final-1-r1') return finalRev([finalIssue('d1')]);
    if (l === 'E1:final-verify-r1') return verdictsOf([1, true, 'a.js:3 already guards it']);
    if (l === 'E1:final-fix1') return { status: 'DONE', summary: 'f', checks: [] };
    return undefined;
  };
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over, config: finalAdv });
  assert.ok(x.labels.includes('E1:final-verify-r1'));
  assert.ok(!x.labels.some((l) => /^E1:final-fix/.test(l)));
  assert.equal(x.labels.filter((l) => /^E1:final-1-r/.test(l)).join(), 'E1:final-1-r1');
  const rec = loggedReviews(x).find((v) => v.stage === 'final-verify');
  assert.equal(rec.round, 1);
  assert.deepEqual(rec.refuted, [{ ...finalIssue('d1'), reason: 'a.js:3 already guards it' }]);
  assert.equal(x.r.results[0].merged, true);
  const call = x.calls.find((c) => c.label === 'E1:final-verify-r1');
  assert.equal(call.opts.agentType, 'productivity-tools:final-reviewer');
  assert.match(call.prompt, /\nMode: verify\.\n1\. \[important\/defeito\]/);
  assert.doesNotMatch(call.prompt, /Diff/);
  const d = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(!d.labels.includes('E1:final-verify-r1'));
  assert.ok(d.labels.includes('E1:final-fix1'));
});

test('E24 AC2: a confirmed finding or a null verification reaches final-fix1', async () => {
  for (const verify of [verdictsOf([1, false, 'it holds']), null]) {
    const over = (l) => {
      if (l === 'E1:final-1-r1') return finalRev([finalIssue('real defect')]);
      if (l === 'E1:final-verify-r1') return verify;
      if (l === 'E1:final-fix1') return { status: 'DONE', summary: 'f', checks: [] };
      return undefined;
    };
    const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over, config: finalAdv });
    assert.ok(x.labels.includes('E1:final-fix1'));
    assert.match(x.calls.find((c) => c.label === 'E1:final-fix1').prompt, /real defect/);
    assert.equal(loggedReviews(x).find((v) => v.stage === 'final-verify').refuted.length, 0);
    assert.equal(x.r.results[0].merged, true);
  }
  const minor = await exec({ cards: [card('E1')], deliverables: ['E1'], config: finalAdv,
    over: (l) => (l === 'E1:final-1-r1' ? finalRev([finalIssue('nit', 'minor')]) : undefined) });
  assert.ok(!minor.labels.some((l) => /:final-verify/.test(l)));
  assert.ok(!minor.labels.some((l) => /^E1:final-fix/.test(l)));
});

test('E24 C4: a refuted finding reported again after another fix is verified again', async () => {
  const over = (l) => {
    if (l === 'E1:final-1-r1') return finalRev([finalIssue('refuted one'), finalIssue('real one')]);
    if (l === 'E1:final-verify-r1') return verdictsOf([1, true, 'x.js:1 guards it'], [2, false, 'holds']);
    if (l === 'E1:final-fix1') return { status: 'DONE', summary: 'f', checks: [] };
    if (l === 'E1:final-1-r2') return finalRev([finalIssue('refuted one')]);
    if (l === 'E1:final-verify-r2') return verdictsOf([1, true, 'x.js:1 still guards it']);
    return undefined;
  };
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over, config: finalAdv });
  assert.ok(x.labels.includes('E1:final-verify-r2'));
  assert.equal(x.labels.filter((l) => /^E1:final-fix/.test(l)).join(), 'E1:final-fix1');
  const fixPrompt = x.calls.find((c) => c.label === 'E1:final-fix1').prompt;
  assert.match(fixPrompt, /real one/);
  assert.doesNotMatch(fixPrompt, /refuted one/);
  assert.deepEqual(loggedReviews(x).filter((v) => v.stage === 'final-verify').map((v) => v.round), [1, 2]);
  assert.equal(x.r.results[0].merged, true);
});

// ---- fix/releitura-assinada: the record read-back is a signed verify-run read, never a model copy
test('releitura: stdout sem assinatura na 1a tentativa e assinado na 2a aceita o registro', async () => {
  let n = 0;
  const { r, labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l, prompt) => {
    if (l === 'E1:status-d-read') { n++; return { exit: 0, stdout: 'ok' }; }
    return undefined;
  } });
  assert.equal(n, 1);
  assert.ok(labels.includes('E1:status-d-read-retry2'));
  assert.equal(calls.find((c) => c.label === 'E1:status-d-read-retry2').opts.model, 'haiku');
  assert.equal(r.results[0].merged, true);
  assert.deepEqual(r.results[0].concerns, []);
});

test('releitura: 3a a 5a tentativas sobem para sonnet; 5 falhas = null como antes', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/:status-d-read/.test(l) ? { exit: 0, stdout: 'ok' } : undefined) });
  const reads = calls.filter((c) => /:status-d-read/.test(c.label));
  assert.equal(reads.length, 5);
  assert.deepEqual(reads.map((c) => c.opts.model), ['haiku', 'haiku', 'sonnet', 'sonnet', 'sonnet']);
  assert.ok(r.results[0].concerns.some((x) => /null re-read agent/.test(x)), r.results[0].concerns.join(' '));
});

// E37 T7 (S3-29): a script refusal (its own tool and an error) stops readSlices at once; another tool's copy is still a wrong copy and repeats.
test('E37 T7: a discovery refused by the script is one call, and no -retry2', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/^discovery/.test(l) ? { exit: 1, stdout: JSON.stringify({ tool: 'release-discovery', error: 'no roadmap folder' }) } : undefined) });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /^discovery failed: slice 0: release-discovery refused: no roadmap folder/);
  assert.deepEqual(x.labels.filter((l) => /^discovery/.test(l)), ['discovery']);
});

test('E37 T7: a load slice refused by capture is one call, and no -retry2', async () => {
  const big = (l) => (l === 'E1:spec-load1' ? { checkExit: 0, checkStdout: 'x\n'.repeat(MAX_COPY_BYTES), emitExit: 0, emitStdout: '', head: 'a1', clean: true } : undefined);
  const s = [];
  const journal = { call: (p, o, live) => { if (/^E1:spec-load1-slice\d+/.test(o.label)) { s.push(o.label); return { exit: 1, stdout: JSON.stringify({ tool: 'capture', error: 'bad slice' }) }; } return live(); } };
  await exec({ cards: [card('E1')], deliverables: ['E1'], over: big, journal });
  assert.deepEqual(s, ['E1:spec-load1-slice0'], s.join());
});

test('E37 T7: a re-read refused by verify-run is one call, and the record fails as a null re-read', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/:status-d-read/.test(l) ? { exit: 1, stdout: JSON.stringify({ tool: 'verify-run', error: 'no folder' }) } : undefined) });
  assert.deepEqual(x.calls.filter((c) => /:status-d-read/.test(c.label)).map((c) => c.label), ['E1:status-d-read']);
  assert.ok(x.r.results[0].concerns.some((c) => /null re-read agent/.test(c)), x.r.results[0].concerns.join(' '));
});

test('E37 T7: a refusal that names another tool is a wrong copy and repeats 5 times', async () => {
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/:status-d-read/.test(l) ? { exit: 1, stdout: JSON.stringify({ tool: 'capture', error: 'other' }) } : undefined) });
  assert.equal(x.calls.filter((c) => /:status-d-read/.test(c.label)).length, 5);
});

test('releitura: o defeito do E8 (status "ok" e so o result em pendingDecisions) nao reprova um registro correto', async () => {
  const E8 = (l) => (/:status-d-read$/.test(l) ? { exit: 0, stdout: JSON.stringify({ status: 'ok', brief: 'ok', pendingDecisions: { decisions: [] }, head: 'abc1234', porcelain: '' }) } : undefined);
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: E8 });
  assert.equal(r.results[0].merged, true);
  assert.deepEqual(r.results[0].concerns, []);
});

test('releitura: nonce de outra chamada e digest adulterado sao recusados', async () => {
  const stale = (l, prompt) => {
    if (l !== 'E1:status-d-read') return undefined;
    const good = JSON.parse(readStdout(prompt, makeRecordMock(() => [card('E1')]).read('E1')));
    return { exit: 0, stdout: JSON.stringify({ ...good, nonce: 'other' }) };
  };
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: stale });
  assert.ok(labels.includes('E1:status-d-read-retry2'));
});

// ---- review round: truncated pending list, forged measurement answer, tamper shapes, docs order, read command cap
test('recordVerdict: a truncated pending-decisions list fails a record whose written id is not in it, and holds the existing ones (fail safe)', () => {
  const trunc = (ids, total) => JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, errors: [], changed: [], result: { decisions: ids.map((id) => ({ id })), total } });
  const v = VX();
  v.read.pendingDecisions = trunc(['DEC-1'], 101);
  const r = PU.recordVerdict(v);
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /truncated/);
  const ok = VX();
  ok.read.pendingDecisions = trunc(['DEC-1', 'DEC-300'], 101);
  assert.equal(PU.recordVerdict(ok).ok, true);
  const ex = VX();
  ex.results.runs[2].stdout = JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, errors: [], changed: [], result: { id: 'DEC-300', existing: true } });
  ex.read.pendingDecisions = trunc(['DEC-1'], 101);
  const re = PU.recordVerdict(ex);
  assert.equal(re.ok, true, re.failures.join('\n'));
  assert.deepEqual(re.holdIds, ['DEC-300'], 'past the cut: hold');
});

test('recordVerdict: the BLQ id comes from blqIds when the note was cut', () => {
  const v = VX();
  v.word = 'bloqueado';
  v.blockedStatus = 'bloqueado';
  v.results.runs[0].stdout = okOut('block-open', { id: 'BLQ-7' });
  const mk = (blqIds) => JSON.stringify({ tool: 'roadmap', summary: { exitCode: 0 }, errors: [], changed: [], result: { panel: [{ id: 'E1', segments: [{ label: '', word: 'bloqueado', note: 'cut...', blqIds }] }] } });
  v.read.status = mk(['BLQ-7']);
  assert.ok(!PU.recordVerdict(v).failures.some((f) => /cite/.test(f)));
  v.read.status = mk([]);
  assert.ok(PU.recordVerdict(v).failures.some((f) => /cite/.test(f)));
});

test('docs: the model answer of the measurement cannot overwrite the signed clean and head', async () => {
  const forged = (l) => (/:docs-measure\d$/.test(l) ? { measureOk: true, measureDetails: 'ok', head: 'FORGED', clean: false } : undefined);
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: forged, config: { docsStage: { instructions: 'x', measure: 'm' } } });
  assert.equal(r.results[0].merge.docsOk, true);
  const rep = calls.find((c) => c.label === 'report');
  assert.equal(verifyArg(rep.prompt, 'check').lastGood, 'm2');
});

test('docs: the read runs AFTER the measurement program, and a null read says "null docs read"', async () => {
  const { labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { docsStage: { instructions: 'x', measure: 'm' } } });
  assert.ok(labels.indexOf('E1:docs-measure1') >= 0 && labels.indexOf('E1:docs-measure1') < labels.indexOf('E1:docs-read1'));
  const { r } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/:docs-read\d/.test(l) ? { exit: 0, stdout: 'ok' } : undefined) });
  assert.match(JSON.stringify(r.results[0].concerns) + JSON.stringify(r.operatorActions), /null docs read/);
  assert.doesNotMatch(JSON.stringify(r.results[0].concerns) + JSON.stringify(r.operatorActions), /null measurement agent/);
});

test('releitura: output re-signed with a foreign nonce, and a tampered body with the right nonce, are both refused', async () => {
  const good = (prompt) => JSON.parse(readStdout(prompt, makeRecordMock(() => [card('E1')]).read('E1')));
  const resigned = (l, prompt) => {
    if (l !== 'E1:status-d-read') return undefined;
    const { digest, ...rest } = good(prompt);
    return { exit: 0, stdout: signedOut({ ...rest, nonce: 'foreign' }) };
  };
  const a = await exec({ cards: [card('E1')], deliverables: ['E1'], over: resigned });
  assert.ok(a.labels.includes('E1:status-d-read-retry2'));
  const tampered = (l, prompt) => {
    if (l !== 'E1:status-d-read') return undefined;
    return { exit: 0, stdout: JSON.stringify({ ...good(prompt), head: 'forged' }) };
  };
  const b = await exec({ cards: [card('E1')], deliverables: ['E1'], over: tampered });
  assert.ok(b.labels.includes('E1:status-d-read-retry2'));
  assert.equal(b.r.results[0].merged, true);
});

// E41 B2: the read-back is read in signed slices (verify-run.mjs read with slice in the payload) and rebuilt as the output of buildRead, without tool, mode or nonce.
const LONG_READ = (over = {}) => readWith('d', {
  status: cliJson({ result: { panel: [{ id: 'E1', segments: [{ label: '', word: 'd', note: 'n'.repeat(300) }] }] } }),
  brief: cliJson({ result: { checker: { errors: 0, warnings: 0, errorCodes: Array.from({ length: 10 }, (_, i) => 'E' + i + 'x'.repeat(50)), warningCodes: Array.from({ length: 10 }, (_, i) => 'W' + i + 'y'.repeat(50)) } } }),
  pendingDecisions: cliJson({ result: { decisions: Array.from({ length: 100 }, (_, i) => ({ id: 'DEC-' + (100 + i) })) } }),
  ...over,
});
const isStatusRead = (l) => /:status-d-read(-redo)?(-slice\d+)?(-retry\d)?$/.test(l);

test('E41 B2: a long status and brief arrive in slices within the copy limit and the record is accepted', async () => {
  const seen = [];
  const over = (l, p) => { if (!isStatusRead(l)) return undefined; const out = readStdout(p, LONG_READ()); seen.push({ l, size: utf8Length(out), nonce: verifyArg(p, 'read').nonce, slice: verifyArg(p, 'read').slice }); return { exit: 0, stdout: out }; };
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over });
  assert.ok(seen.length >= 2, 'slices ' + seen.length);
  assert.deepEqual(seen.map((s) => s.l), ['E1:status-d-read', ...seen.slice(1).map((s, i) => 'E1:status-d-read-slice' + (i + 1))]);
  assert.deepEqual(seen.map((s) => s.slice), seen.map((s, i) => i));
  assert.ok(seen.every((s) => s.size <= MAX_COPY_BYTES), JSON.stringify(seen.map((s) => s.size)));
  assert.equal(new Set(seen.map((s) => s.nonce)).size, seen.length, 'a nonce for each slice');
  assert.equal(new Set(seen.map((s) => s.nonce.length)).size, 1, 'the nonces have one length, so the slices line up');
  assert.equal(x.r.results[0].merged, true);
  assert.deepEqual(x.r.results[0].concerns, []);
});

test('E41 B2: a slice of another command, a copy over the limit or slices of two reads repeat only what failed', async () => {
  const run = async (fail) => {
    const over = (l, p) => { if (!isStatusRead(l)) return undefined; const out = readStdout(p, LONG_READ(fail(l, p) === 'mix' ? { head: 'abc1235' } : {})); return { exit: 0, stdout: fail(l, p) === 'mode' ? out.replace('"mode":"read"', '"mode":"check"') : fail(l, p) === 'big' ? 'x'.repeat(MAX_COPY_BYTES + 1) : out }; };
    return exec({ cards: [card('E1')], deliverables: ['E1'], over });
  };
  const mode = await run((l) => (l === 'E1:status-d-read-slice1' ? 'mode' : ''));
  assert.ok(mode.labels.includes('E1:status-d-read-slice1-retry2'));
  assert.ok(!mode.labels.includes('E1:status-d-read-retry2') && !mode.labels.includes('E1:status-d-read-redo'));
  assert.equal(mode.r.results[0].merged, true);
  const big = await run((l) => (l === 'E1:status-d-read' ? 'big' : ''));
  assert.ok(big.labels.includes('E1:status-d-read-retry2'));
  assert.ok(!big.labels.includes('E1:status-d-read-slice1-retry2'));
  assert.equal(big.r.results[0].merged, true);
  const mix = await run((l) => (l === 'E1:status-d-read-slice1' ? 'mix' : ''));
  assert.ok(mix.labels.includes('E1:status-d-read-redo') && mix.labels.includes('E1:status-d-read-redo-slice1'), 'the read starts again once');
  assert.equal(mix.r.results[0].merged, true);
});

// The read payload (cwd, cli, folder, deliverable) is always smaller than a group chunk (cli and folder in every step), so a long path trips the group cap first: the read guard is a second line, checked in the source.
test('releitura: readBack compares its command with CMD_CAP before the first dispatch (fail safe)', async () => {
  const body = /const readBack = async[\s\S]*?\r?\n}\r?\n/.exec(SRC)[0];
  assert.match(body, /readCmd\([^)]*\)\.length > CMD_CAP\) return null/);
  assert.ok(body.indexOf('> CMD_CAP') < body.indexOf('readSlices('), 'the check comes before any dispatch');
  const id = 'E' + 'x'.repeat(2400);
  const { labels, r } = await exec({ cards: [card(id)], deliverables: [id] });
  assert.ok(!labels.some((l) => /-read/.test(l)), 'nothing is read when the commands are over the cap');
  assert.ok(r.results[0].error || r.results[0].concerns.length, 'and the run says so');
});

test('2.0.1 AC2: a preflight targetHead that is not a full SHA stops before any deliverable work', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: 'abc1234', clean: true, envFacts: 'x', baseline: gm('abc1234') } : undefined) });
  assert.equal(r.status, 'needs-operator');
  assert.ok(r.operatorActions.some((o) => /^preflight:/.test(o.kind) && o.what.includes('targetHead is not a full SHA: abc1234')), JSON.stringify(r.operatorActions));
  assert.ok(!labels.includes('E1:setup'));
});

test('2.0.1 AC2: a full targetHead in uppercase with a newline is accepted normalized', async () => {
  const { labels, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (l === 'preflight' ? { ok: true, integrationWorktree: '/wt/_integracao', targetHead: FULL('abc1234').toUpperCase() + '\n', clean: true, envFacts: 'x', baseline: gm('abc1234') } : undefined) });
  assert.ok(labels.includes('E1:setup'));
  assert.ok(calls.find((c) => c.label === 'E1:setup').prompt.includes(FULL('abc1234')));
});

test('2.0.1 AC2: a mergeCommit that is not a full SHA rolls the merge back as infra before any post-merge gate', async () => {
  for (const bad of ['e1', 'sha ' + FULL('e1')]) {
    const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => (/:merge$/.test(l) ? { mergeCommit: bad, firstParent: 'abc1234', secondParent: 'a3', conflicts: 0, clean: true } : undefined) });
    assert.ok(labels.includes('E1:rollback'), bad);
    assert.ok(!labels.some((l) => /merge-gates/.test(l)), bad);
    assert.equal(r.results[0].merged, false, bad);
    assert.match(r.results[0].error, /mergeCommit is not a full SHA/);
    assert.equal(r.results[0].failKind, 'infra');
  }
});

test('2.0.1 AC2: an aborted merge keeps conteudo with the agent details; only a non-empty bad mergeCommit is infra with the raw value', async () => {
  const mergeOf = (o) => (l) => (/:merge$/.test(l) ? { mergeCommit: FULL('e1'), firstParent: 'abc1234', secondParent: 'a3', conflicts: 0, clean: true, ...o } : undefined);
  const empty = await exec({ cards: [card('E1')], deliverables: ['E1'], over: mergeOf({ mergeCommit: '', details: 'merge aborted by agent' }) });
  assert.ok(empty.labels.includes('E1:rollback'));
  assert.equal(empty.r.results[0].failKind, 'conteudo');
  assert.match(empty.r.results[0].error, /merge aborted by agent/);
  const dirty = await exec({ cards: [card('E1')], deliverables: ['E1'], over: mergeOf({ clean: false, details: 'tree left dirty' }) });
  assert.equal(dirty.r.results[0].failKind, 'conteudo');
  assert.match(dirty.r.results[0].error, /tree left dirty/);
  const short = await exec({ cards: [card('E1')], deliverables: ['E1'], over: mergeOf({ mergeCommit: 'e1', details: 'ignored' }) });
  assert.equal(short.r.results[0].failKind, 'infra');
  assert.match(short.r.results[0].error, /mergeCommit is not a full SHA: e1/);
});

test('2.0.1 AC2: a merge-risks head that is not a full SHA leaves the next measure without an expected commit', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => {
    if (/^E1:merge-gates1/.test(l)) return gm('e1', { exit: 1, failedNames: ['t'] });
    if (l === 'E1:merge-fix') return { status: 'DONE', summary: 's', checks: [] };
    if (l === 'E1:merge-fix-review') return { issues: [riskIssue], headSha: 'm8', clean: true, commitsInRange: 1 };
    if (l === 'E1:merge-risks') return { head: 'commit ' + FULL('e9'), commit: 'x' };
    if (/^E1:merge-gates2/.test(l)) return gm('e9');
    return undefined;
  } });
  assert.ok(!labels.includes('E1:rollback'));
  assert.equal(r.results[0].merge.docsOk, true);
});

test('2.0.1 AC2: a merge-fix review headSha that is not a full SHA does not reject the next measure', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: (l) => {
    if (/^E1:merge-gates1/.test(l)) return gm('e1', { exit: 1, failedNames: ['t'] });
    if (l === 'E1:merge-fix') return { status: 'DONE', summary: 's', checks: [] };
    if (l === 'E1:merge-fix-review') return { issues: [], headSha: 'HEAD', clean: true, commitsInRange: 1 };
    if (/^E1:merge-gates2/.test(l)) return gm('f7');
    return undefined;
  } });
  assert.ok(!labels.includes('E1:rollback'));
  assert.equal(r.results[0].merge.docsOk, true);
});

// ---- E29 T6: comportamento que fica depois da remoção do modo único ----
test('E29 C5: taskReview.single given straight to the workflow runs only spec1 and quality1 on the task-reviewer and no fix for an empty review', async () => {
  const { calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], config: { taskReview: { single: true } }, over: withPlan([tk(1, false)], (l) => (/^E1:t1:(spec|quality)\d$/.test(l) ? { issues: [], headSha: 'a1', clean: true, commitsInRange: 3 } : undefined)) });
  const reviews = calls.filter((c) => /^E1:t1:(spec|quality|review)\d$/.test(c.label)).map((c) => c.label);
  assert.deepEqual(reviews, ['E1:t1:spec1', 'E1:t1:quality1']);
  for (const c of calls.filter((x) => /^E1:t1:(spec|quality)\d$/.test(x.label))) assert.equal(c.opts.agentType, 'productivity-tools:task-reviewer');
  assert.ok(!calls.some((c) => /^E1:t1:.*review1/.test(c.label)), 'no single review label on the task');
  for (const p of ['E1:t1:spec-fix', 'E1:t1:quality-fix', 'E1:t1:review-fix']) assert.ok(!calls.some((c) => c.label.startsWith(p)), `no fix ${p}`);
});

// ---- E36 T5: a tests gate whose only failure is a lower total stops without gates-fix; removedTests checked by test-extract lift the floor ----
const RM_ENT = [{ file: 'src/a.test.js', name: 'old test', why: 'obsolete' }];
const removedLine = (prompt, o = {}) => signedOut({ tool: 'test-extract', command: 'removed', nonce: nonceOf(prompt), gate: 'unit', base: (/--base '([^']*)'/.exec(prompt) || [])[1], outputSha: '0', verified: 2, unverified: [], unverifiedCut: 0, ...o });
const removedOver = ({ total = 8, answer = (p) => ({ exit: 0, stdout: removedLine(p) }), extra } = {}) => (l, p, o) => {
  if (/^E1:(re)?gates1-2$/.test(l)) return gm(/regates/.test(l) ? 'a3' : 'a2', { total });
  if (/^E1:(re)?removed-unit/.test(l)) return answer(p, l);
  return extra ? extra(l, p, o) : undefined;
};
const withSpecRemoved = (...fs) => both(specWith({ removedTests: RM_ENT }), ...fs);
const rmCalls = (calls) => calls.filter((c) => /^E1:removed-unit/.test(c.label));

test('E36 T5 AC2: a tests gate failing only on a lower total with nothing declared stops at the 1st measurement without gates-fix', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: removedOver() });
  assert.equal(r.results[0].failKind, 'conteudo');
  assert.match(r.results[0].error, /removedTests/);
  assert.match(r.results[0].error, /restore/);
  assert.ok(!labels.some((l) => /gates-fix/.test(l)), labels.join(','));
  assert.ok(!labels.some((l) => /removed-unit/.test(l)), 'no declaration: the checker does not run');
  assert.ok(!labels.includes('E1:gates2-1') && !labels.includes('E1:gates2-2'));
});

test('E36 T5 AC1: a spec declaration confirmed by the signed line lets the deliverable through, with a concern and the checker command', async () => {
  const { r, calls, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver()) });
  assert.equal(r.results[0].merged, true, r.results[0].error);
  assert.ok(!labels.some((l) => /gates-fix/.test(l)));
  const c = rmCalls(calls);
  assert.equal(c.length, 1);
  assert.equal(c[0].opts.agentType, 'productivity-tools:script-runner');
  assert.equal(c[0].opts.model, 'haiku');
  const p = c[0].prompt;
  assert.match(p, /test-extract\.mjs" removed --nonce '[^']*' --spec '\/wt\/E1\/docs\/plans\/x-E1\/spec\.md' --plan '\/wt\/E1\/docs\/plans\/x-E1\/plan\.md' --base '[^']*' --cwd '\/wt\/E1' --output 'p' --sha '0' --gate 'unit' --single-tests-gate/);
  assert.ok(p.includes(` --base 'abc1234' `), 'the base is the target tip of the baseline (syncAt), a SHA, not the branch name that can move');
  assert.ok(!/old test/.test(p), 'names are never passed by argv');
  const concern = r.results[0].concerns.find((x) => /removed/.test(x));
  assert.ok(concern && /10/.test(concern) && /8/.test(concern) && /2/.test(concern), String(concern));
});

test('E36 T5 AC1: a plan declaration works too', async () => {
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: both((l) => (l === 'E1:plan' ? { ...OLD_DEFAULT_PLAN, removedTests: RM_ENT } : undefined), removedOver()) });
  assert.equal(r.results[0].merged, true, r.results[0].error);
  assert.ok(!labels.some((l) => /gates-fix/.test(l)));
  assert.ok(labels.includes('E1:removed-unit'));
});

test('E36 T5: a drop beyond what was verified stops with the unverified entries, their reasons and the cut count', async () => {
  const line = (p) => ({ exit: 0, stdout: removedLine(p, { verified: 1, unverified: [{ file: 'src/b.test.js', name: 'other', reason: 'o nome continua no arquivo em HEAD' }], unverifiedCut: 3 }) });
  const { r, labels } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ answer: line })) });
  assert.equal(r.results[0].failKind, 'conteudo');
  const e = r.results[0].error;
  for (const re of [/src\/b\.test\.js/, /other/, /o nome continua no arquivo em HEAD/, /3 more|\+3|3 cut/, /baseline 10/, /branch 8/, /restore/]) assert.match(e, re);
  assert.ok(!labels.some((l) => /gates-fix/.test(l)));
});

test('E36 T5: a line for another output, gate or base counts n = 0 and is not repeated; a signed refusal is not repeated', async () => {
  for (const bad of [{ outputSha: 'x' }, { gate: 'lint' }, { base: 'main' }, { base: 'integracao/x' }]) {
    const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ answer: (p) => ({ exit: 0, stdout: removedLine(p, bad) }) })) });
    assert.equal(r.results[0].failKind, 'conteudo', JSON.stringify(bad));
    assert.equal(rmCalls(calls).length, 1, JSON.stringify(bad));
  }
  const refusal = (p) => ({ exit: 2, stdout: JSON.stringify({ tool: 'test-extract', command: 'removed', nonce: nonceOf(p), error: 'base invalida' }) });
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ answer: refusal })) });
  assert.equal(r.results[0].failKind, 'conteudo');
  assert.match(r.results[0].error, /base invalida/);
  assert.equal(rmCalls(calls).length, 1);
});

test('E36 T5: an invalid copy repeats the same command (attempts 1-2 haiku, 3 sonnet) and 3 invalid copies give n = 0', async () => {
  let n = 0;
  const flaky = (p) => (++n < 3 ? { exit: 0, stdout: removedLine(p).replace('"verified":2', '"verified":9') } : { exit: 0, stdout: removedLine(p) });
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ answer: flaky })) });
  assert.equal(r.results[0].merged, true, r.results[0].error);
  const c = rmCalls(calls);
  assert.deepEqual(c.map((x) => x.label), ['E1:removed-unit', 'E1:removed-unit-retry2', 'E1:removed-unit-retry3']);
  assert.deepEqual(c.map((x) => x.opts.model), ['haiku', 'haiku', 'sonnet']);
  assert.equal(new Set(c.map((x) => x.prompt)).size, 1, 'the same command each time');
  const all = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ answer: () => ({ exit: 0, stdout: 'garbage' }) })) });
  assert.equal(all.r.results[0].failKind, 'conteudo');
  assert.equal(rmCalls(all.calls).length, 3);
});

test('E36 T5: a declaration with no drop records a concern and never calls the checker', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ total: 10 })) });
  assert.equal(r.results[0].merged, true, r.results[0].error);
  assert.equal(rmCalls(calls).length, 0);
  assert.ok(r.results[0].concerns.some((x) => /removedTests/.test(x)), r.results[0].concerns.join('|'));
});

test('E36 T5 R9: the 1st run stops asking for the declaration, the resumed run with it loaded passes without gates-fix', async () => {
  const first = await exec({ cards: [card('E1')], deliverables: ['E1'], over: removedOver() });
  assert.equal(first.r.results[0].failKind, 'conteudo');
  assert.ok(!first.labels.some((l) => /gates-fix/.test(l)));
  const again = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver()) });
  assert.equal(again.r.results[0].merged, true, again.r.results[0].error);
  assert.ok(!again.labels.some((l) => /gates-fix/.test(l)));
});

test('E36 T5: with a red exit gate alongside, gates-fix runs as before and a later total-only round short-circuits', async () => {
  const lintRed = { ...gm('a2'), gates: [{ name: 'lint', ran: true, exit: 1 }, ...gm('a2').gates.slice(1)] };
  const x = await exec({ cards: [card('E1')], deliverables: ['E1'], over: removedOver({ extra: (l) => {
    if (l === 'E1:gates1-1') return lintRed;
    if (l === 'E1:gates-fix1') return { status: 'DONE', summary: 'f', checks: [] };
    if (l === 'E1:gates-fix1-review') return { issues: [], headSha: 'a2b', clean: true, commitsInRange: 1 };
    if (/^E1:gates2-2$/.test(l)) return gm('a2', { total: 8 });
    return undefined;
  } }) });
  assert.ok(x.labels.includes('E1:gates-fix1'), x.labels.join(','));
  assert.ok(!x.labels.includes('E1:gates-fix2'));
  assert.equal(x.r.results[0].failKind, 'conteudo');
  assert.match(x.r.results[0].error, /removedTests/);
});

test('E36 T5: the checker nonce is distinct for the first measurement and the one after the re-sync', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver()) });
  assert.equal(r.results[0].merged, true, r.results[0].error);
  const [a, b] = ['E1:removed-unit', 'E1:reremoved-unit'].map((l) => nonceOf(calls.find((c) => c.label === l).prompt));
  assert.match(a, /:E1:removed:unit:\d+$/);
  assert.match(b, /:E1:removed:reunit:\d+$/);
  assert.notEqual(a, b);
  const baseOf = (l) => /--base '([^']*)'/.exec(calls.find((c) => c.label === l).prompt)[1];
  assert.equal(baseOf('E1:removed-unit'), 'abc1234');
  assert.equal(baseOf('E1:reremoved-unit'), 'def5678', 'after the re-sync the base is the new target tip');
});

test('E36 T5: the merge gates floor drops by the verified n only and the next baseline does not inherit it', async () => {
  const mergeAt = (total) => (l) => (/^E1:merge-gates1-2$/.test(l) ? gm('e1', { total }) : undefined);
  const ok = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ extra: mergeAt(8) })) });
  assert.equal(ok.r.results[0].merged, true, ok.r.results[0].error);
  assert.ok(!ok.labels.includes('E1:merge-fix'));
  const low = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ extra: (l, p, o) => (l === 'E1:merge-fix' ? { status: 'DONE', summary: 's', checks: [] } : l === 'E1:merge-fix-review' ? { issues: [], headSha: 'HEAD', clean: true, commitsInRange: 1 } : l === 'E1:merge-gates2-2' ? gm('f7') : mergeAt(7)(l, p, o)) })) });
  assert.ok(low.labels.includes('E1:merge-fix'), 'a total of 7 is below the floor of 8 (10 - 2 verified)');
  const pure = loadPure();
  const defs = [{ name: 'unit', kind: 'tests' }];
  const next = pure.refreshBaseline({ unit: { name: 'unit', ran: true, exit: 0, total: 10, skipped: 0, failedNames: [] } }, defs, gm('e1', { total: 8 }), []);
  assert.equal(next.unit.total, 8);
  assert.equal(pure.mergeFloor(next, gm('e2', { total: 8 }), {}).unit.total, 8);
});

test('E36 R8: a re-sync targetTip with a newline is normalized and the declared removal still passes', async () => {
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ extra: (l) => (/:resync$/.test(l) ? { ok: true, head: 'a2', conflictsResolved: 0, targetTip: 'def5678\n', deltaFiles: ['src/x.js'] } : undefined) })) });
  assert.equal(r.results[0].merged, true, r.results[0].error);
  assert.equal(/--base '([^']*)'/.exec(calls.find((c) => c.label === 'E1:reremoved-unit').prompt)[1], 'def5678');
});

test('E36 R12: a refusal without this call nonce is an invalid copy and is repeated', async () => {
  let n = 0;
  const answer = (p) => (++n === 1 ? { exit: 2, stdout: JSON.stringify({ tool: 'test-extract', command: 'removed', error: 'base invalida' }) } : { exit: 0, stdout: removedLine(p) });
  const { r, calls } = await exec({ cards: [card('E1')], deliverables: ['E1'], over: withSpecRemoved(removedOver({ answer })) });
  assert.equal(r.results[0].merged, true, r.results[0].error);
  assert.equal(rmCalls(calls).length, 2);
});

// ---- E39 DEC-056: a test-first pair the implementer copy lost is read from the capture files by `capture.mjs pairs`
const TF_PRE = `${fnv1a('pf-test')}:E1:T1:`;
const tfPlanLoad = () => {
  const emit = planEmitOf({ id: 'E1', roadmap: 'docs/plans/roadmap-x/', tasks: [{ n: 1, title: 't', files: { create: [], modify: ['a.js'], test: [] }, locks: [], external: false, externalDedupe: null, noCommit: false, deps: [], score: scoreFor({ tier: 'sonnet' }), testFirst: true }],
    evidence: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', testRef: null, blq: null, external: false, externalDedupe: null }] });
  return { checkExit: 0, checkStdout: '{}', emitExit: 0, emitStdout: JSON.stringify(emit), blob: B1, head: 'a1', clean: true };
};
const tfLine = (seq, exit) => signedOut({ tool: 'capture', nonce: `${TF_PRE}${seq}`, task: 'E1-T1', cmdDigest: commandDigest({ argv: ['node', '--test', 'x'] }), exit, bytes: 0, sha256: '0', lines: 0, path: 'p', stderrBytes: 0, stderrSha256: '0', stderrPath: 'q' });
const PROSE = [{ command: 'node --test x', output: 'summary of the red file', exit: 1 }, { command: 'node --test x', output: 'summary of the green file', exit: 0 }];
const pairsLine = (prompt, over = {}) => signedOut({ tool: 'capture', command: 'pairs', nonce: nonceOf0(prompt), task: /--task (\S+)/.exec(prompt)[1], runs: 2, pair: true, red: 1, green: 2, cmdDigest: 'ab', ...over });
const nonceOf0 = (prompt) => /--nonce (\S+)/.exec(prompt)[1];
const tfExec = (impl, pairs) => exec({ cards: [card('E1')], deliverables: ['E1'],
  over: (l, p) => (l === 'E1:plan-load1' ? tfPlanLoad() : l === 'E1:t1:impl' ? { status: 'DONE', summary: 's', checks: impl } : /^E1:t1:pairs/.test(l) ? pairs(p, l) : undefined) });
const pairCalls = (calls) => calls.filter((c) => /^E1:t1:pairs/.test(c.label));

test('E39 DEC-056: prose checks of a red/green pair and a pairs line with pair true let the task go on to its review', async () => {
  const { r, calls } = await tfExec(PROSE, (p) => ({ exit: 0, stdout: pairsLine(p) }));
  assert.equal(r.results[0].merged, true, r.results[0].error);
  const pc = pairCalls(calls);
  assert.equal(pc.length, 1);
  assert.equal(pc[0].label, 'E1:t1:pairs');
  assert.equal(pc[0].opts.agentType, 'productivity-tools:script-runner');
  assert.match(pc[0].prompt, new RegExp(`capture\.mjs" pairs --nonce [^ ]+ --task E1-T1 --prefix '${TF_PRE}' --cwd `));
  assert.ok(calls.some((c) => /^E1:t1:spec1$/.test(c.label)));
});

test('E39 DEC-056: a pairs line with pair false keeps the test-first block with the current message', async () => {
  const { r, calls } = await tfExec(PROSE, (p) => ({ exit: 0, stdout: pairsLine(p, { pair: false, red: null, green: null }) }));
  assert.equal(r.results[0].merged, false);
  assert.match(r.results[0].error, /task 1: test-first without a failing capture line then the same one passing \(2 checks\)/);
  assert.equal(pairCalls(calls).length, 1, 'a line that checks out is not repeated');
  assert.ok(!calls.some((c) => /^E1:t1:spec1$/.test(c.label)));
});

test('E39 DEC-056: a tampered pairs line repeats once with a new nonce and then blocks', async () => {
  const { r, calls } = await tfExec(PROSE, (p) => ({ exit: 0, stdout: pairsLine(p).replace('"pair":true', '"pair":false').replace('"runs":2', '"runs":3') }));
  assert.equal(r.results[0].merged, false);
  assert.match(r.results[0].error, /test-first without a failing capture line/);
  const pc = pairCalls(calls);
  assert.deepEqual(pc.map((c) => c.label), ['E1:t1:pairs', 'E1:t1:pairs-retry2']);
  assert.notEqual(nonceOf0(pc[0].prompt), nonceOf0(pc[1].prompt));
});

test('E39 DEC-056: a pairs line of another command or task is refused like a bad copy, and a good retry passes', async () => {
  let n = 0;
  const { r, calls } = await tfExec(PROSE, (p) => ({ exit: 0, stdout: ++n === 1 ? pairsLine(p, { command: 'run' }) : pairsLine(p) }));
  assert.equal(r.results[0].merged, true, r.results[0].error);
  assert.equal(pairCalls(calls).length, 2);
});

test('E39 DEC-056: a good copy of capture lines dispatches no pairs agent', async () => {
  const { r, calls } = await tfExec([{ command: 'node --test x', output: tfLine(1, 1), exit: 1 }, { command: 'node --test x', output: tfLine(2, 0), exit: 0 }], () => { throw new Error('pairs dispatched'); });
  assert.equal(r.results[0].merged, true, r.results[0].error);
  assert.equal(pairCalls(calls).length, 0);
});
