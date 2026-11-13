#!/usr/bin/env node
// verify-run.mjs -- deterministic carrier and post-run check of the roadmap-release workflow.
//
//   node verify-run.mjs group <payload>   runs the record commands in order and commits them
//   node verify-run.mjs check <payload>   measures the git truth and lists what the run claimed against it
//
// <payload> is encodeURIComponent(JSON) (plus !'()* as %XX) in ONE argument. It carries `nonce` and `digest`,
// where digest = fnv1a(JSON.stringify(canon(payload without digest))) of lib/plan-digest.mjs, computed by the workflow.
// A payload whose digest does not match exits 2 and runs nothing. The output carries the same kind of digest,
// computed over the whole output without the digest field (tool and mode included).
//
//   group payload: { nonce, digest, cwd, steps: [text], finally: { commit: { add: [paths], message: [m1, m2] } } | null }
//     -> { tool: 'verify-run', mode: 'group', nonce, steps: [{ n, exit, out }], stopped: { n, exit } | null, commit, head, digest }
//   check payload: { nonce, digest, repo, intwt, wtRoot, target, lastGood, order, claims: [{ id, commit }],
//                    reported: [{ id, merged, broken, planOnly }], integBroken }
//     -> { tool: 'verify-run', mode: 'check', nonce, ok, divergences, truth, digest }
//
// Exit codes: 0 the command ran (a failing step is reported in the output, not in the exit code), 2 refused payload.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canon, fnv1a } from '../../../lib/plan-digest.mjs';

const TOOL = 'verify-run';
const OUT_CHARS = 2000;
const META = new Set(['|', '&', ';', '<', '>', '(', ')', '$', '`']);

export const signDigest = (obj) => fnv1a(JSON.stringify(canon(obj)));

// What the agents claimed against git itself. slim = [{ id, merged, broken }], claims = [{ id, commit }].
export function truthDivergences(truth, slim, claims, target, lastGood, integBroken) {
  if (!truth) return ['the git truth agent returned nothing: verify the target branch by hand'];
  const out = [];
  if (truth.clean === false && !integBroken) out.push('the target ' + target + ' has uncommitted files');
  if (truth.lastGoodReachable !== true) out.push('the validated tip claimed by the run (' + lastGood + ') is not confirmed as an ancestor of ' + target);
  const onTarget = truth.mergedIds || [];
  for (const r of slim) {
    if (r.merged && !r.broken && !onTarget.includes(r.id)) out.push(r.id + ': the result says merged, but there is no "merge: ' + r.id + ' in ' + target + '" in the history');
    if (!r.merged && !r.planOnly && onTarget.includes(r.id)) out.push(r.id + ': the result says not merged, but its merge commit is on ' + target);
  }
  for (const c of claims) {
    const t = (truth.claims || []).find((x) => x.id === c.id);
    if (!t || t.reachable !== true) out.push(c.id + ': the claimed merge commit ' + c.commit + ' is not on ' + target);
  }
  return out;
}

// Minimal POSIX tokenizer: single quotes (with '\''), double quotes (\" and \\ only), whitespace.
// Throws on a metacharacter outside quotes, "$" or a backtick inside double quotes, a backslash outside quotes (except the one of the '\'' idiom) or an open quote.
export function tokenize(text) {
  const s = String(text);
  const out = [];
  let cur = '';
  let has = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "'") {
      const j = s.indexOf("'", i + 1);
      if (j < 0) throw new Error('unterminated single quote');
      cur += s.slice(i + 1, j); has = true; i = j + 1;
    } else if (c === '"') {
      i++; has = true;
      for (;;) {
        if (i >= s.length) throw new Error('unterminated double quote');
        const d = s[i];
        if (d === '"') { i++; break; }
        if (d === '$' || d === '`') throw new Error(`"${d}" inside double quotes is not allowed`);
        if (d === '\\' && (s[i + 1] === '"' || s[i + 1] === '\\')) { cur += s[i + 1]; i += 2; continue; }
        cur += d; i++;
      }
    } else if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      if (has) { out.push(cur); cur = ''; has = false; }
      i++;
    } else if (META.has(c)) {
      throw new Error(`shell metacharacter "${c}" is not allowed`);
    } else if (c === '\\' && s[i + 1] === "'") {
      cur += "'"; has = true; i += 2;
    } else if (c === '\\') {
      throw new Error("backslash outside quotes is only allowed before a single quote");
    } else { cur += c; has = true; i++; }
  }
  if (has) out.push(cur);
  if (!out.length) throw new Error('empty command');
  if (out[0] !== 'node' && out[0] !== 'git') throw new Error(`only node and git are accepted, got "${out[0]}"`);
  return out;
}

const exec = (prog, args, cwd) => {
  const r = spawnSync(prog === 'node' ? process.execPath : prog, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  return { exit: r.status === null ? 127 : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
};
const git = (cwd, args) => exec('git', args, cwd);

// stdout reduced to what recordVerdict reads: the CLI JSON keeps tool, summary.exitCode, errors, result.id and changed.
export function reduceOut(stdout) {
  const s = String(stdout == null ? '' : stdout);
  try {
    const o = JSON.parse(s);
    if (o && typeof o === 'object' && o.tool === 'roadmap') {
      const r = { tool: o.tool };
      if (o.summary && typeof o.summary === 'object') r.summary = { exitCode: o.summary.exitCode };
      if ('errors' in o) r.errors = o.errors;
      if (o.result && typeof o.result === 'object' && typeof o.result.id === 'string') r.result = { id: o.result.id };
      if ('changed' in o) r.changed = o.changed;
      return JSON.stringify(r);
    }
  } catch { /* not JSON */ }
  return s.slice(0, OUT_CHARS);
}

export function runGroup(p) {
  const parsed = p.steps.map((t) => tokenize(t)); // refuses everything before anything runs
  const steps = [];
  let stopped = null;
  for (let i = 0; i < parsed.length; i++) {
    const r = exec(parsed[i][0], parsed[i].slice(1), p.cwd);
    steps.push({ n: i + 1, exit: r.exit, out: reduceOut(r.stdout) });
    if (r.exit !== 0) { stopped = { n: i + 1, exit: r.exit }; break; }
  }
  let commit = false;
  const c = p.finally && p.finally.commit;
  if (c) {
    git(p.cwd, ['add', '--', ...(c.add || [])]);
    if (git(p.cwd, ['diff', '--cached', '--quiet']).exit === 1) {
      commit = git(p.cwd, ['commit', ...(c.message || []).flatMap((m) => ['-m', m])]).exit === 0;
    }
  }
  const h = git(p.cwd, ['rev-parse', 'HEAD']);
  return { tool: TOOL, mode: 'group', nonce: p.nonce, steps, stopped, commit, head: h.exit === 0 ? h.stdout.trim() : '' };
}

const norm = (x) => resolve(String(x)).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

export function measureTruth(p) {
  const safeRef = (r) => typeof r === 'string' && r !== '' && !r.startsWith('-');
  const head = safeRef(p.target) ? git(p.repo, ['rev-parse', p.target]) : { exit: 1, stdout: '' };
  const status = git(p.intwt, ['status', '--porcelain']);
  const ancestor = (a) => safeRef(a) && safeRef(p.target) && git(p.repo, ['merge-base', '--is-ancestor', a, p.target]).exit === 0;
  const log = safeRef(p.target) ? git(p.repo, ['log', '--first-parent', '--format=%s', p.target]) : { stdout: '' };
  const subjects = log.stdout.split('\n');
  const merged = (id) => subjects.some((s) => s.startsWith(`merge: ${id} in ${p.target}`));
  const order = p.order || [];
  const wl = git(p.repo, ['worktree', 'list']);
  const worktrees = wl.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  const registered = new Set(git(p.repo, ['worktree', 'list', '--porcelain']).stdout.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => norm(l.slice(9))));
  let strays = [];
  if (p.wtRoot && existsSync(p.wtRoot)) {
    strays = readdirSync(p.wtRoot).sort().filter((name) => {
      const full = join(p.wtRoot, name);
      if (registered.has(norm(full))) return false;
      if (name === '_tmp' && statSync(full).isDirectory() && !readdirSync(full).length) return false;
      return true;
    });
  }
  return {
    targetHead: head.exit === 0 ? head.stdout.trim() : '',
    clean: status.exit === 0 && status.stdout.trim() === '',
    lastGoodReachable: ancestor(p.lastGood),
    mergedIds: order.filter(merged),
    notMergedIds: order.filter((id) => !merged(id)),
    claims: (p.claims || []).map((c) => ({ id: c.id, commit: c.commit, reachable: ancestor(c.commit) })),
    worktrees,
    strays,
  };
}

export function runCheck(p) {
  const truth = measureTruth(p);
  const divergences = truthDivergences(truth, p.reported || [], p.claims || [], p.target, p.lastGood, !!p.integBroken);
  return { tool: TOOL, mode: 'check', nonce: p.nonce, ok: divergences.length === 0, divergences, truth };
}

const REQUIRED = {
  group: (p) => typeof p.cwd === 'string' && p.cwd && Array.isArray(p.steps) && p.steps.every((t) => typeof t === 'string'),
  check: (p) => ['repo', 'intwt', 'target'].every((k) => typeof p[k] === 'string' && p[k]) && (p.order === undefined || Array.isArray(p.order)),
};

function cli(argv) {
  const out = (obj, code) => {
    process.exitCode = code;
    const o = obj.error === undefined ? { ...obj, digest: signDigest(obj) } : obj;
    process.stdout.write(`${JSON.stringify(o)}\n`);
  };
  const [mode, arg] = argv;
  const refuse = (error) => out({ tool: TOOL, mode, error }, 2);
  if (!REQUIRED[mode] || argv.length !== 2) return refuse('usage: node verify-run.mjs group|check <payload: encodeURIComponent(JSON)>');
  let p;
  try { p = JSON.parse(decodeURIComponent(arg)); } catch (e) { return refuse(`the payload is not encodeURIComponent(JSON): ${e.message}`); }
  if (!p || typeof p !== 'object' || Array.isArray(p) || typeof p.nonce !== 'string' || !p.nonce || typeof p.digest !== 'string') return refuse('the payload needs nonce and digest');
  const { digest, ...rest } = p;
  if (signDigest(rest) !== digest) return refuse('the payload digest does not match: nothing was run');
  if (!REQUIRED[mode](p)) return refuse(`the ${mode} payload is missing a required field`);
  let result;
  try { result = mode === 'group' ? runGroup(p) : runCheck(p); } catch (e) { return refuse(e.message); }
  return out(result, 0);
}

let isMain = false;
try { isMain = !!process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url)); } catch { /* not a script run */ }
if (isMain) cli(process.argv.slice(2));
