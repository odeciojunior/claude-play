#!/usr/bin/env node
// progress: CLI do estado do plan-coordinator (progress.json, esquema progress/1).
// Uso: ver USAGE. Saída: 0 feito, 1 recusado sem alteração, 2 uso inválido ou arquivo ilegível.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { emitPlan, buildBriefs, checkPlan } from '../../../scripts/plan-tool.mjs';
import { readDataBlock } from '../../../lib/data-block.mjs';
import { canon, fnv1a, sliceEnvelopes } from '../../../lib/plan-digest.mjs';
import { initState, applyEvent, applyEvents, nextAction, STATE_SCHEMA, EVENT_TYPES } from '../../../lib/progress-state.mjs';

const NO_DATA_BLOCK = 'plano sem bloco de dados: o coordinator não interpreta planos em prosa; adote-o com a skill plan-writer (modo de adoção), que o reescreve no formato plan/1 no mesmo caminho';

const USAGE = [
  'uso: node progress.mjs init <plan.md> [--spec <spec.md>] [--max-width <n>] [--piece <rótulo>] [--base <sha>] [--commits per-step|none] [--restart] [--json]',
  '     node progress.mjs next <progress.json> [--json]',
  '     node progress.mjs apply <progress.json> <evento> [--step <n>] [--steps <n,...>] [--value <v>] [--text <t>] [--agent-id <id>] [--sha <sha>] [--tier <t>] [--json]',
  '     node progress.mjs apply <progress.json> --events <carga> --nonce <n> [--json]',
  '     node progress.mjs read <progress.json> --nonce <n> [--page <k> | --slice <k>] [--json]',
  '     node progress.mjs token',
  '     node progress.mjs show <progress.json>',
  '     node progress.mjs select [--query <texto>] [--root <pasta>] [--json]',
].join('\n');

const fail = (code, message) => Object.assign(new Error(message), { code });
const toLF = (s) => s.replace(/\r\n?/g, '\n');
const slash = (p) => String(p).replace(/\\/g, '/');

// Resumo assinado do estado sem history: o que o chamador confere em expect e stateDigest.
export const stateDigest = (state) => fnv1a(JSON.stringify(canon({ ...state, history: [] })));
const signed = (obj) => ({ ...obj, digest: fnv1a(JSON.stringify(canon(obj))) });

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

// Groups steps in pages whose compact JSON stays under READ_PAGE_CHARS (a step alone above it gets a page of its own).
export const READ_PAGE_CHARS = 20000;
// baseSize is what page 0 already carries (the state without steps): it counts only for the first page, which may stay empty.
export function readPages(steps, baseSize = 0) {
  const pages = [[]];
  let size = baseSize;
  for (const st of steps) {
    const n = JSON.stringify(st).length + 1;
    if (size + n > READ_PAGE_CHARS && (pages.length > 1 || baseSize > 0 || pages[0].length > 0)) { pages.push([]); size = 0; }
    pages[pages.length - 1].push(st);
    size += n;
  }
  return pages;
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

const NO_PLAN_QUESTION = 'não há plano em docs/plans/ que corresponda; quer escrever o plano agora com a skill plan-writer?';

// Sufixo de pasta só conta como ID quando o texto tem forma de ID (letras e número, como E7).
const ID_SHAPE = /^[a-z]+[0-9]+$/;

function findPlans(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      findPlans(path.join(dir, e.name), out);
    } else if (e.isFile() && e.name === 'plan.md') out.push(path.join(dir, e.name));
  }
  return out;
}

// Escolhe o plano sem perguntar quando há um candidato forte; senão devolve a pergunta (nunca escolhe no empate).
export function selectPlan({ root, query = null }) {
  const plansDir = path.join(root, 'docs', 'plans');
  const items = findPlans(plansDir).map((abs) => {
    let id = null;
    try {
      const d = readDataBlock(fs.readFileSync(abs, 'utf8')).data;
      if (d && typeof d.id === 'string') id = d.id;
    } catch {
      // plano ilegível: candidato sem id
    }
    const stateFile = path.join(path.dirname(abs), 'progress.json');
    let hasState = false;
    let status = null;
    if (fs.existsSync(stateFile)) {
      hasState = true;
      try {
        status = JSON.parse(fs.readFileSync(stateFile, 'utf8').replace(/^﻿/, ''))?.run?.status ?? null;
      } catch {
        // estado ilegível: não é candidato forte
      }
    }
    return { rel: slash(path.relative(root, abs)), folder: path.basename(path.dirname(abs)), id, hasState, status };
  }).sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const ask = (list, text) => ({ question: text, candidates: list.map((i) => i.rel) });
  const names = (list) => list.map((i) => i.rel).join(', ');

  if (query !== null && String(query).trim() !== '') {
    const q = String(query).trim().toLowerCase();
    // O caminho do plano (relativo, com ./ ou absoluto dentro da raiz) é escolha forte.
    let qRel = q;
    if (path.isAbsolute(String(query).trim())) {
      qRel = slash(path.relative(root, path.resolve(String(query).trim()))).toLowerCase();
    } else {
      qRel = slash(q).replace(/^(\.\/)+/, '');
    }
    const byPath = items.find((i) => i.rel.toLowerCase() === qRel);
    if (byPath) return { choice: byPath.rel };
    const strong = items.filter((i) => {
      const folder = i.folder.toLowerCase();
      return folder === q || (ID_SHAPE.test(q) && folder.endsWith('-' + q)) || (i.id !== null && i.id.toLowerCase() === q);
    });
    if (strong.length === 1) return { choice: strong[0].rel };
    if (strong.length > 1) return ask(strong, 'mais de um plano corresponde a "' + query + '": ' + names(strong) + '. Qual deles?');
    const weak = items.filter((i) => i.rel.toLowerCase().includes(q));
    if (weak.length) return ask(weak, 'nenhum plano corresponde exatamente a "' + query + '"; parecidos: ' + names(weak) + '. Qual deles?');
    return ask([], NO_PLAN_QUESTION);
  }

  if (items.length === 0) return ask([], NO_PLAN_QUESTION);
  const running = items.filter((i) => i.hasState && i.status !== null && i.status !== 'completed');
  if (running.length === 1) return { choice: running[0].rel };
  if (running.length === 0) {
    const fresh = items.filter((i) => !i.hasState);
    if (fresh.length === 1 && items.length === 1) return { choice: fresh[0].rel };
    if (fresh.length === 1 && items.every((i) => i.hasState === false || i.status === 'completed')) return { choice: fresh[0].rel };
  }
  const list = running.length > 1 ? running : items;
  return ask(list, 'qual plano executar? ' + names(list));
}

function runSelect(rest, io) {
  let parsed;
  try {
    parsed = parseArgs(rest, ['--query', '--root'], ['--json']);
  } catch (e) {
    io.stderr.write(e.message + '\n' + USAGE + '\n');
    return 2;
  }
  if (parsed.pos.length) {
    io.stderr.write('argumento extra: ' + parsed.pos[0] + '\n' + USAGE + '\n');
    return 2;
  }
  const g = parsed.opts.root ? null : git(process.cwd(), ['rev-parse', '--show-toplevel']);
  const root = path.resolve(parsed.opts.root ?? g ?? process.cwd());
  const r = selectPlan({ root, query: parsed.opts.query ?? null });
  if (parsed.opts.json) io.stdout.write(JSON.stringify({ tool: 'progress', command: 'select', ok: true, ...r, errors: [], warnings: [] }, null, 2) + '\n');
  else if (r.choice) io.stdout.write(r.choice + '\n');
  else {
    io.stdout.write(r.question + '\n');
    for (const c of r.candidates) io.stdout.write('  ' + c + '\n');
  }
  return 0;
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
  if (!['init', 'next', 'apply', 'show', 'select', 'read', 'token'].includes(cmd)) return bad('comando desconhecido: ' + cmd + '\n' + USAGE);
  if (cmd === 'select') return runSelect(rest, io);
  if (cmd === 'token') {
    if (rest.length) return bad('argumento extra: ' + rest[0] + '\n' + USAGE);
    out(crypto.randomBytes(16).toString('hex'));
    return 0;
  }

  let parsed;
  try {
    if (cmd === 'init') parsed = parseArgs(rest, ['--spec', '--max-width', '--piece', '--base', '--commits'], ['--restart', '--json']);
    else if (cmd === 'apply') parsed = parseArgs(rest, ['--step', '--steps', '--value', '--text', '--agent-id', '--sha', '--tier', '--events', '--nonce'], ['--json']);
    else if (cmd === 'read') parsed = parseArgs(rest, ['--nonce', '--page', '--slice'], ['--json']);
    else if (cmd === 'next') parsed = parseArgs(rest, [], ['--json']);
    else parsed = parseArgs(rest, [], []);
  } catch (e) {
    return bad(e.message + '\n' + USAGE);
  }
  const { opts, pos } = parsed;
  const json = opts.json === true;
  const batch = cmd === 'apply' && opts.events !== undefined;
  const want = cmd === 'apply' && !batch ? 2 : 1;
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

  if (cmd === 'read') {
    if (opts.nonce === undefined) return bad('read exige --nonce\n' + USAGE);
    let changed;
    try {
      changed = planChanged(state, file);
    } catch (e) {
      return bad('não foi possível conferir o plano: ' + e.message);
    }
    const base = path.dirname(path.resolve(file));
    const g = git(base, ['rev-parse', '--show-toplevel']);
    if (opts.slice !== undefined) {
      if (opts.page !== undefined) return bad('--slice e --page não se combinam');
      // Deterministic payload (no clock): sliced by sliceEnvelopes; nothing is written.
      const text = JSON.stringify(canon({ root: g ? path.resolve(g) : base, planChanged: changed, stateDigest: stateDigest(state), state: { ...state, history: [] } }));
      const envs = sliceEnvelopes({ tool: 'progress', command: 'read', nonce: opts.nonce, now: new Date().toISOString() }, text);
      const k = /^[0-9]+$/.test(opts.slice) ? Number(opts.slice) : -1;
      if (k < 0 || k >= envs.length) return bad('--slice deve ser um inteiro de 0 a ' + (envs.length - 1));
      out(JSON.stringify(envs[k]));
      return 0;
    }
    // The output stays under 30 KB (the Bash tool spills more to a file): compact JSON, and the steps split into pages of READ_PAGE_CHARS.
    // Page 0 carries the state without its steps' tail; the other pages carry only steps. stateDigest is of the whole state, the same on every page.
    const page = opts.page === undefined ? 0 : Number(opts.page);
    const headBase = { tool: 'progress', command: 'read', nonce: opts.nonce, now: new Date().toISOString(), root: g ? path.resolve(g) : base, planChanged: changed, stateDigest: stateDigest(state) };
    const baseSize = JSON.stringify({ ...headBase, nonce: '', page: 0, pages: 0, state: { ...state, history: [], steps: [] } }).length + 400;
    const pages = readPages(state.steps, baseSize);
    if (!Number.isInteger(page) || page < 0 || page >= pages.length) return bad('--page deve ser um inteiro de 0 a ' + (pages.length - 1));
    const head = { ...headBase, page, pages: pages.length };
    const body = page === 0 ? { ...head, state: { ...state, history: [], steps: pages[0] } } : { ...head, steps: pages[page] };
    out(JSON.stringify(signed(body)));
    return 0;
  }

  if (batch) {
    if (opts.nonce === undefined) return bad('apply --events exige --nonce\n' + USAGE);
    let load;
    try {
      load = JSON.parse(decodeURIComponent(opts.events));
    } catch (e) {
      return bad('--events ilegível: ' + e.message);
    }
    if (!load || typeof load !== 'object' || Array.isArray(load)) return bad('--events exige um objeto { expect, events, digest }');
    const { digest, ...rest } = load;
    if (digest !== fnv1a(JSON.stringify(canon(rest)))) return bad('--events: digest da carga não confere; nada foi gravado');
    const now = new Date().toISOString();
    const reply = (ok, code, extra) => {
      out(JSON.stringify(signed({ tool: 'progress', command: 'apply', nonce: opts.nonce, now, ok, code, ...extra, action: ok ? nextAction(extra.finalState) : null, stateDigest: stateDigest(extra.finalState), finalState: undefined }), null, 2));
      return ok ? 0 : 1;
    };
    if (rest.expect !== stateDigest(state)) return reply(false, 'concurrent-change', { finalState: state });
    const r = applyEvents(state, rest.events, now);
    if (!r.ok) return reply(false, r.code, { index: r.index, finalState: state });
    try {
      writeState(file, bytes, r.state);
    } catch (e) {
      if (e.code === 'concurrent-change') return reply(false, 'concurrent-change', { finalState: state });
      return bad('não foi possível gravar ' + file + ': ' + e.message);
    }
    return reply(true, null, { finalState: r.state });
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
