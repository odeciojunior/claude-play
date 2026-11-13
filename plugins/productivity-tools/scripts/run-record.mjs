#!/usr/bin/env node
// E23: registro da execucao (run.json) na branch do entregavel.
//   approve <wt> <dir> <E> <stages> <tip|-> <payload>  grava e commita so run.json (fusao)
//   key <wt> <dir>                                      imprime { recorded, spec, plan, tree }
//   baseline <repo> <target> <gatesKey> <branch:dir>... imprime o prep que confere, ou sai 1
// Uso invalido sai 2. Git por execFileSync, sem shell.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const USAGE = 'usage: run-record.mjs approve <wt> <dir> <E> <stages> <tip|-> <payload> | key <wt> <dir> | baseline <repo> <target> <gatesKey> <branch:dir>...';
const STAGES = ['spec', 'plan', 'final'];

const git = (wt, ...a) => execFileSync('git', ['-C', wt, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const gitOrNull = (wt, ...a) => { try { return git(wt, ...a).trim(); } catch { return null; } };
const fail = (code, msg) => { if (msg) process.stderr.write(`${msg}\n`); process.exit(code); };
const withSlash = (d) => (d.endsWith('/') ? d : `${d}/`);

// Origem: o ultimo commit que tocou run.json tem assunto "<E>: run record (" e mudou so esse arquivo.
function fromRecordCommit(wt, ref, dir) {
  const file = `${dir}run.json`;
  const sha = gitOrNull(wt, 'log', '-1', '--format=%H', ref, '--', file);
  if (!sha) return false;
  const subject = gitOrNull(wt, 'log', '-1', '--format=%s', sha);
  const files = gitOrNull(wt, 'show', '--name-only', '--format=', sha);
  return /^\S+: run record \(/.test(subject || '') && files === file;
}

// Le <ref>:<dir>run.json; so aceita JSON valido com schema run/1 vindo de um commit de run-record.
function readRecorded(wt, ref, dir) {
  if (!fromRecordCommit(wt, ref, dir)) return null;
  const txt = gitOrNull(wt, 'show', `${ref}:${dir}run.json`);
  if (txt === null) return null;
  try {
    const o = JSON.parse(txt);
    return o && typeof o === 'object' && o.schema === 'run/1' ? o : null;
  } catch { return null; }
}

// sha256 de git ls-tree -r HEAD sem as linhas de <dir>run.json e <dir>reviews.md.
function treeKey(wt, dir) {
  const skip = new Set([`${dir}run.json`, `${dir}reviews.md`]);
  const lines = git(wt, 'ls-tree', '-r', 'HEAD').split('\n').filter((l) => {
    const p = l.split('\t')[1];
    return l !== '' && !skip.has(p);
  });
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

function key(wt, dir) {
  return {
    recorded: readRecorded(wt, 'HEAD', dir),
    spec: gitOrNull(wt, 'rev-parse', `HEAD:${dir}spec.md`),
    plan: gitOrNull(wt, 'rev-parse', `HEAD:${dir}plan.md`),
    tree: treeKey(wt, dir),
  };
}

function approve(wt, dir, E, stages, tip, rawPayload) {
  const list = stages.split(',').filter(Boolean);
  if (!list.length || list.some((s) => !STAGES.includes(s))) fail(2, USAGE);
  let payload;
  try { payload = JSON.parse(decodeURIComponent(rawPayload)); } catch { fail(2, 'invalid payload'); }
  if (!payload || typeof payload !== 'object') fail(2, 'invalid payload');
  const k = key(wt, dir);
  const run = k.recorded ?? { schema: 'run/1' };
  if (list.includes('spec')) run.spec = { spec: k.spec };
  if (list.includes('plan')) run.plan = { spec: k.spec, plan: k.plan };
  if (list.includes('final')) run.final = { spec: k.spec, plan: k.plan, tree: k.tree, target: tip === '-' ? null : tip };
  if (payload.prep) run.prep = payload.prep;
  const file = `${dir}run.json`;
  mkdirSync(join(wt, dir), { recursive: true });
  writeFileSync(join(wt, file), `${JSON.stringify(run, null, 2)}\n`);
  git(wt, 'add', '--', file);
  const tmp = mkdtempSync(join(tmpdir(), 'run-record-msg-'));
  try {
    const msgFile = join(tmp, 'msg.txt');
    const trailer = typeof payload.trailer === 'string' && payload.trailer ? `\n\n${payload.trailer}` : '';
    writeFileSync(msgFile, `${E}: run record (${list.join(',')})${trailer}\n`);
    git(wt, 'commit', '-q', '-F', msgFile, '--', file);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function baseline(repo, target, gatesKey, specs) {
  const head = gitOrNull(repo, 'rev-parse', target);
  if (!head) process.exit(1);
  for (const s of specs) {
    const i = s.indexOf(':');
    if (i < 1) fail(2, USAGE);
    const rec = readRecorded(repo, s.slice(0, i), withSlash(s.slice(i + 1)));
    const prep = rec && rec.prep;
    if (prep && prep.targetHead === head && prep.gatesKey === gatesKey) {
      process.stdout.write(`${JSON.stringify(prep)}\n`);
      return;
    }
  }
  process.exit(1);
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'approve' && a.length === 6) approve(a[0], withSlash(a[1]), a[2], a[3], a[4], a[5]);
else if (cmd === 'key' && a.length === 2) process.stdout.write(`${JSON.stringify(key(a[0], withSlash(a[1])))}\n`);
else if (cmd === 'baseline' && a.length >= 4) baseline(a[0], a[1], a[2], a.slice(3));
else fail(2, USAGE);
