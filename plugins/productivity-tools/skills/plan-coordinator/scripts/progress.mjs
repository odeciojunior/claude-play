#!/usr/bin/env node
// progress: CLI do estado do plan-coordinator (progress.json, esquema progress/1).
// Uso: ver USAGE. Saída: 0 feito, 1 recusado sem alteração, 2 uso inválido ou arquivo ilegível.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { emitPlan, buildBriefs, checkPlan } from '../../../scripts/plan-tool.mjs';
import { readDataBlock } from '../../../lib/data-block.mjs';
import { initState, applyEvent, nextAction, STATE_SCHEMA, EVENT_TYPES } from '../../../lib/progress-state.mjs';

const NO_DATA_BLOCK = 'plano sem bloco de dados: o coordinator não interpreta planos em prosa; adote-o com a skill plan-writer (modo de adoção), que o reescreve no formato plan/1 no mesmo caminho';

const USAGE = [
  'uso: node progress.mjs init <plan.md> [--spec <spec.md>] [--max-width <n>] [--piece <rótulo>] [--base <sha>] [--commits per-step|none] [--restart] [--json]',
  '     node progress.mjs next <progress.json> [--json]',
  '     node progress.mjs apply <progress.json> <evento> [--step <n>] [--steps <n,...>] [--value <v>] [--text <t>] [--agent-id <id>] [--sha <sha>] [--tier <t>] [--json]',
  '     node progress.mjs show <progress.json>',
].join('\n');

const fail = (code, message) => Object.assign(new Error(message), { code });
const toLF = (s) => s.replace(/\r\n?/g, '\n');
const slash = (p) => String(p).replace(/\\/g, '/');

export function readState(file) {
  const bytes = fs.readFileSync(file);
  const text = bytes.toString('utf8').replace(/^﻿/, '');
  let state;
  try {
    state = JSON.parse(text);
  } catch (e) {
    throw fail('state-unreadable', 'progress.json ilegível: ' + e.message);
  }
  if (!state || state.schema !== STATE_SCHEMA) {
    throw fail('state-schema', 'schema ' + JSON.stringify(state && state.schema) + ' diferente de ' + STATE_SCHEMA);
  }
  return { state, bytes };
}

// bytesBefore: o que foi lido (null = o arquivo não devia existir). Mudou no meio -> concurrent-change.
export function writeState(file, bytesBefore, state) {
  const now = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const same = bytesBefore === null ? now === null : now !== null && now.equals(bytesBefore);
  if (!same) throw fail('concurrent-change', 'progress.json mudou desde a leitura; nada foi gravado');
  const tmp = path.join(path.dirname(file), '.progress-' + process.pid + '-' + Date.now() + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function git(cwd, args) {
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status === 0) return r.stdout.trim();
  } catch {
    // sem git
  }
  return null;
}

function defaultBranch(cwd) {
  const head = git(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head.replace(/^origin\//, '');
  for (const b of ['main', 'master']) if (git(cwd, ['rev-parse', '--verify', '--quiet', 'refs/heads/' + b]) !== null) return b;
  return null;
}

function defaultBase(cwd) {
  const def = defaultBranch(cwd);
  if (!def) return null;
  const sha = git(cwd, ['rev-parse', 'HEAD']);
  if (sha === null) return null;
  const cur = git(cwd, ['symbolic-ref', '--short', 'HEAD']);
  if (cur === def) return sha;
  return git(cwd, ['merge-base', def, 'HEAD']);
}

function parseArgs(rest, valued, flags) {
  const opts = {};
  const pos = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (flags.includes(a)) opts[a.slice(2)] = true;
    else if (valued.includes(a)) {
      if (i + 1 >= rest.length) throw fail('usage', a + ' exige um valor');
      opts[a.slice(2)] = rest[++i];
    } else if (a.startsWith('--')) throw fail('usage', 'opção desconhecida: ' + a);
    else pos.push(a);
  }
  return { opts, pos };
}

const waveLine = (state, w) => 'Onda ' + w.n + ': ' + w.tasks.map((n) => {
  const s = state.steps.find((x) => x.n === n);
  return 'T' + n + ' (' + s.tier + '/' + s.effort + (s.gate ? ', portão' : '') + (s.external ? ', externo' : '') + ')';
}).join(', ');

// O plano mudou desde o init? Recalcula o resumo com a mesma largura e o mesmo spec.
function planChanged(state, stateFile) {
  const base = path.dirname(path.resolve(stateFile));
  const g = git(base, ['rev-parse', '--show-toplevel']);
  const root = g ? path.resolve(g) : base;
  const planAbs = path.resolve(root, state.plan.path);
  const text = fs.readFileSync(planAbs, 'utf8');
  const specPath = state.plan.spec ? path.resolve(root, state.plan.spec) : null;
  const e = emitPlan(text, { planPath: planAbs, root, specPath, maxWidth: state.plan.maxWidth });
  return e.out === null || e.out.digest !== state.plan.digest;
}

export function main(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  const out = (s) => io.stdout.write(s + '\n');
  const err = (s) => io.stderr.write(s + '\n');
  const bad = (s) => {
    err(s);
    return 2;
  };
  const [cmd, ...rest] = argv;
  if (!cmd) return bad(USAGE);
  if (!['init', 'next', 'apply', 'show'].includes(cmd)) return bad('comando desconhecido: ' + cmd + '\n' + USAGE);

  let parsed;
  try {
    if (cmd === 'init') parsed = parseArgs(rest, ['--spec', '--max-width', '--piece', '--base', '--commits'], ['--restart', '--json']);
    else if (cmd === 'apply') parsed = parseArgs(rest, ['--step', '--steps', '--value', '--text', '--agent-id', '--sha', '--tier'], ['--json']);
    else if (cmd === 'next') parsed = parseArgs(rest, [], ['--json']);
    else parsed = parseArgs(rest, [], []);
  } catch (e) {
    return bad(e.message + '\n' + USAGE);
  }
  const { opts, pos } = parsed;
  const json = opts.json === true;
  const want = cmd === 'apply' ? 2 : 1;
  if (pos.length < want) return bad(USAGE);
  if (pos.length > want) return bad('argumento extra: ' + pos[want] + '\n' + USAGE);
  const file = pos[0];

  const result = (code, extra) => {
    out(JSON.stringify({ tool: 'progress', command: cmd, path: file, ok: code === 0, ...extra, errors: extra.errors ?? [], warnings: extra.warnings ?? [] }, null, 2));
    return code;
  };
  const refuse = (code, message) => {
    if (json) result(1, { code, errors: [{ code, message }] });
    else err('ERROR ' + code + ': ' + message);
    return 1;
  };

  if (cmd === 'init') {
    let maxWidth = 4;
    if (opts['max-width'] !== undefined) {
      if (!/^\d+$/.test(opts['max-width']) || Number(opts['max-width']) < 1) return bad('--max-width exige um inteiro >= 1\n' + USAGE);
      maxWidth = Number(opts['max-width']);
    }
    const commits = opts.commits ?? 'none';
    if (!['per-step', 'none'].includes(commits)) return bad('--commits exige per-step ou none\n' + USAGE);
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      return bad('não foi possível ler ' + file + ': ' + e.message);
    }
    const planAbs = path.resolve(file);
    const dir = path.dirname(planAbs);
    const block = readDataBlock(text);
    if (block.data === null && block.error.code === 'data-block-missing') return refuse('plan-no-data-block', NO_DATA_BLOCK);
    const g = git(dir, ['rev-parse', '--show-toplevel']);
    const root = g ? path.resolve(g) : dir;
    const rel = (p) => slash(path.relative(root, path.resolve(p)));
    const specPath = opts.spec ?? null;
    const e = emitPlan(text, { planPath: file, specPath, maxWidth });
    if (e.errors.length) {
      const codes = [...new Set(e.errors.map((x) => x.code))].join(', ');
      if (json) result(1, { code: 'plan-invalid', errors: e.errors.map((x) => ({ code: x.code, ref: x.ref, message: x.message })), warnings: e.warnings });
      else {
        err('ERROR plan-invalid: ' + codes);
        for (const x of e.errors) err('ERROR ' + x.code + ' ' + x.ref + ': ' + x.message);
      }
      return 1;
    }
    const stateFile = path.join(dir, 'progress.json');
    if (fs.existsSync(stateFile) && !opts.restart) return refuse('state-exists', 'já existe ' + stateFile + '; use --restart para recriar');

    const now = new Date().toISOString();
    const defaults = [];
    let base = opts.base ?? null;
    if (base === null) {
      base = defaultBase(dir);
      if (base !== null) defaults.push({ event: 'default', what: 'base', value: base, at: now });
    }
    const state = initState(e.out, {
      planPath: rel(planAbs),
      spec: specPath === null ? null : rel(specPath),
      piece: opts.piece ?? null,
      base,
      commits,
      now,
    });
    state.history.push(...defaults);

    const c = checkPlan(text, { planPath: file, specPath });
    const waves = new Map(state.steps.map((s) => [s.n, s.wave]));
    const briefs = buildBriefs(e.out.plan, { spec: c.spec ?? null, prose: block.prose, waves });
    fs.mkdirSync(path.join(dir, 'briefs'), { recursive: true });
    for (const b of briefs) fs.writeFileSync(path.join(dir, 'briefs', b.name), toLF(b.text));
    writeState(stateFile, fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null, state);

    if (json) result(0, { stateFile, waves: state.waves, warnings: e.warnings });
    else {
      for (const w of state.waves) out(waveLine(state, w));
      out('Estado gravado em ' + stateFile);
    }
    return 0;
  }

  let st;
  try {
    st = readState(file);
  } catch (e) {
    if (e.code === 'state-schema') return refuse(e.code, e.message);
    return bad(e.code === 'state-unreadable' ? e.message : 'não foi possível ler ' + file + ': ' + e.message);
  }
  const { state, bytes } = st;

  if (cmd === 'show') {
    out('Execução: ' + state.run.status + ' (onda ' + state.run.wave + ')');
    out(['n', 'título', 'onda', 'nível/effort', 'portão', 'externo', 'status', 'tentativas', 'sha'].join(' | '));
    for (const s of state.steps) {
      out([s.n, s.title, s.wave, s.tier + '/' + s.effort, s.gate ? 'sim' : 'não', s.external ? 'sim' : 'não', s.status, s.attempts, s.sha ?? '-'].join(' | '));
    }
    return 0;
  }

  if (cmd === 'next') {
    let action;
    try {
      action = planChanged(state, file) ? { action: 'plan-changed' } : nextAction(state);
    } catch (e) {
      return bad('não foi possível conferir o plano: ' + e.message);
    }
    if (json) result(0, { action });
    else out('Próxima ação: ' + JSON.stringify(action));
    return 0;
  }

  // apply
  const type = pos[1];
  if (!EVENT_TYPES.includes(type)) return bad('evento desconhecido: ' + type + '\n' + USAGE);
  const event = { type };
  if (opts.step !== undefined) {
    if (!/^\d+$/.test(opts.step)) return bad('--step exige um inteiro\n' + USAGE);
    event.step = Number(opts.step);
  }
  if (opts.steps !== undefined) {
    if (!/^\d+(,\d+)*$/.test(opts.steps)) return bad('--steps exige números separados por vírgula\n' + USAGE);
    event.steps = opts.steps.split(',').map(Number);
  }
  if (opts.value !== undefined) event.value = opts.value;
  if (opts.text !== undefined) event.text = opts.text;
  if (opts['agent-id'] !== undefined) event.agentId = opts['agent-id'];
  if (opts.sha !== undefined) event.sha = opts.sha;
  if (opts.tier !== undefined) event.tier = opts.tier;

  const r = applyEvent(state, event, new Date().toISOString());
  if (!r.ok) return refuse(r.code, r.message);
  try {
    writeState(file, bytes, r.state);
  } catch (e) {
    if (e.code === 'concurrent-change') return refuse(e.code, e.message);
    return bad('não foi possível gravar ' + file + ': ' + e.message);
  }
  const action = nextAction(r.state);
  if (json) result(0, { action });
  else out('Próxima ação: ' + JSON.stringify(action));
  return 0;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) process.exitCode = main(process.argv.slice(2));
