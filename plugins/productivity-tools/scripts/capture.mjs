#!/usr/bin/env node
// Roda um comando, grava stdout e stderr em <git-dir>/pt-evidence/<task>/ e imprime uma linha JSON
// assinada (bytes, sha256, linhas, cauda, extrato do node:test) que um agente copia literal.
// Uso: node capture.mjs run --nonce <n> --task <id> [--cwd <dir>] [--tests] (-- <programa> [args...] | --bash "<string>")
//      node capture.mjs slice --nonce <n> --path <arquivo em pt-evidence> [--cwd <dir>] --sha <sha256> --slice <k>
//      node capture.mjs prune (--task-prefix <p> | --older-than <dias>) [--cwd <dir>]
//        --task-prefix: apaga as pastas <p><resto> de pt-evidence e os arquivos <p><resto> de pt-evidence/review/ (resto sem hifen,
//        ex.: final.txt, worktree.diff; subpastas de review/ nunca) e varre o que tem mais de 14 dias. No win32 o prefixo ignora a caixa.
//        Saida: {tool,command:'prune',removed:[pastas],removedReview:[arquivos],digest}.
//        --older-than: so a varredura, com corte em agora - <dias> (inteiro >= 0; 0 apaga tudo com mtime anterior a agora).
//        Saida: {tool,command:'prune',olderThan,removed:[caminhos relativos a pt-evidence],digest}. Os dois juntos ou nenhum: exit 2.
//      node capture.mjs list [--cwd <dir>]
//        Saida: {tool,command:'list',tasks:[{name,files,bytes,newest}],digest}, uma entrada por pasta de pt-evidence (review/ inclusa),
//        mais recentes primeiro; se passar de MAX_COPY_BYTES corta tasks e acrescenta cut:<n omitidas>.
// Sai com o exit do comando; sai com 2 e imprime {"tool":"capture","error":...} se o uso ou o ambiente estiver errado.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MAX_COPY_BYTES, SLICE_BYTES, utf8Length, commandDigest, canon, fnv1a, sliceEnvelopes } from '../lib/plan-digest.mjs';
import { extractTests } from './test-extract.mjs';

const MAX_BUFFER = 512 * 1024 * 1024;
const KEEP_MS = 14 * 24 * 3600 * 1000;
const TAIL_LINES = 40;
const TASK_RE = /^[A-Za-z0-9._-]+$/;
const NONCE_RE = /^[A-Za-z0-9:._@-]{1,160}$/;
const USAGE = 'uso: node capture.mjs run --nonce <n> --task <id> [--cwd <dir>] [--tests] (-- <programa> [args...] | --bash "<string>")';
const PRUNE_USAGE = 'uso: node capture.mjs prune (--task-prefix <p> | --older-than <dias>) [--cwd <dir>] (exatamente um dos dois)';

class UsageError extends Error {}

const fwd = (p) => String(p).replace(/\\/g, '/');
const sha256Of = (buf) => createHash('sha256').update(buf).digest('hex');

function countLines(buf) {
  if (buf.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  return n + (buf[buf.length - 1] === 10 ? 0 : 1);
}

function parseArgs(argv) {
  if (argv[0] !== 'run') throw new UsageError(`${USAGE}; ou slice, prune, list (ver o cabe�alho de capture.mjs)`);
  const opts = { nonce: null, task: null, cwd: null, tests: false, program: null, bash: null };
  let i = 1;
  const value = (flag) => {
    if (i + 1 >= argv.length) throw new UsageError(`${flag} sem valor. ${USAGE}`);
    return argv[++i];
  };
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { opts.program = argv.slice(i + 1); break; }
    if (a === '--nonce') opts.nonce = value(a);
    else if (a === '--task') opts.task = value(a);
    else if (a === '--cwd') opts.cwd = value(a);
    else if (a === '--tests') opts.tests = true;
    else if (a === '--bash') opts.bash = value(a);
    else throw new UsageError(`argumento desconhecido: ${a}. ${USAGE}`);
  }
  return opts;
}

function parseFlags(argv, spec) {
  const opts = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const key = spec[a];
    if (!key) throw new UsageError(`argumento desconhecido: ${a}`);
    if (i + 1 >= argv.length) throw new UsageError(`${a} sem valor`);
    opts[key] = argv[++i];
  }
  return opts;
}

function gitDirOrThrow(cwdOpt) {
  const cwd = path.resolve(cwdOpt ?? globalThis.process.cwd());
  const gitDir = gitOut(['-C', cwd, 'rev-parse', '--absolute-git-dir']);
  if (!gitDir) throw new UsageError(`${fwd(cwd)} não está dentro de um repositório git (git rev-parse --absolute-git-dir falhou)`);
  return { cwd, gitDir };
}

const MSYS_MSG = 'caminho no estilo msys (/tmp/...) não é aceito no Windows; use C:/...';
const isMsys = (p) => /^\/(?![/\\])/.test(p);

function runSlice(argv, platform) {
  const o = parseFlags(argv, { '--nonce': 'nonce', '--path': 'path', '--cwd': 'cwd', '--sha': 'sha', '--slice': 'slice' });
  if (o.nonce === undefined || !NONCE_RE.test(o.nonce)) throw new UsageError('--nonce ausente ou fora de ^[A-Za-z0-9:._@-]{1,160}$');
  if (o.path === undefined) throw new UsageError('--path ausente');
  if (platform === 'win32' && (isMsys(o.path) || (o.cwd !== undefined && isMsys(o.cwd)))) throw new UsageError(MSYS_MSG);
  if (o.sha === undefined || !/^[0-9a-f]{64}$/.test(o.sha)) throw new UsageError('--sha ausente ou não é um sha256 em hexadecimal minúsculo');
  if (o.slice === undefined || !/^\d+$/.test(o.slice)) throw new UsageError('--slice ausente ou não é um inteiro >= 0');
  const { cwd, gitDir } = gitDirOrThrow(o.cwd);
  const root = path.join(gitDir, 'pt-evidence');
  const file = path.resolve(cwd, o.path);
  let realFile;
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
    realFile = fs.realpathSync(file);
  } catch {
    throw new UsageError(`arquivo não encontrado em ${fwd(root)}: ${fwd(o.path)}`);
  }
  const rel = path.relative(realRoot, realFile);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new UsageError(`--path fora de ${fwd(root)}/`);
  const buf = fs.readFileSync(realFile);
  if (sha256Of(buf) !== o.sha) return { code: 1, line: JSON.stringify({ tool: 'capture', error: 'o sha256 do arquivo não confere com --sha' }) };
  const envs = sliceEnvelopes({ tool: 'capture', command: 'slice', nonce: o.nonce }, buf.toString('utf8'));
  const k = Number(o.slice);
  if (k >= envs.length) throw new UsageError(`--slice ${k} fora do intervalo 0..${envs.length - 1}`);
  return { code: 0, line: JSON.stringify(envs[k]) };
}

// Only prefix + a suffix without hyphen is ours: the prefix `api-` must not reach `api-v2-T1` of another plan.
const SUFFIX_RE = /^[A-Za-z0-9._]+$/;

function runPrune(argv, platform, now) {
  const o = parseFlags(argv, { '--task-prefix': 'prefix', '--older-than': 'older', '--cwd': 'cwd' });
  if ((o.prefix === undefined) === (o.older === undefined)) throw new UsageError(`informe --task-prefix ou --older-than, s� um dos dois. ${PRUNE_USAGE}`);
  if (platform === 'win32' && o.cwd !== undefined && isMsys(o.cwd)) throw new UsageError(MSYS_MSG);
  if (o.older !== undefined && !/^\d{1,6}$/.test(o.older)) throw new UsageError('--older-than n�o � um inteiro >= 0 (dias)');
  if (o.prefix !== undefined) {
    if (!TASK_RE.test(o.prefix)) throw new UsageError('--task-prefix ausente ou fora de ^[A-Za-z0-9._-]+$ (sem barras)');
    if (o.prefix === '.' || o.prefix === '..') throw new UsageError('--task-prefix inv�lido');
  }
  const { gitDir } = gitDirOrThrow(o.cwd);
  const root = path.join(gitDir, 'pt-evidence');
  const cutoff = now() - KEEP_MS;
  if (o.older !== undefined) {
    const days = Number(o.older);
    const removed = [];
    sweep(root, now() - days * 24 * 3600 * 1000, true, removed, '');
    return { code: 0, line: JSON.stringify(sign({ tool: 'capture', command: 'prune', olderThan: days, removed: removed.sort() })) };
  }
  const norm = platform === 'win32' ? (x) => x.toLowerCase() : (x) => x;
  const mine = (name) => norm(name).startsWith(norm(o.prefix)) && SUFFIX_RE.test(name.slice(o.prefix.length));
  const list = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } };
  const removed = list(root).filter((d) => d.isDirectory() && mine(d.name)).map((d) => d.name).sort();
  for (const name of removed) fs.rmSync(path.join(root, name), { recursive: true, force: true });
  const reviewDir = path.join(root, 'review');
  const removedReview = list(reviewDir).filter((d) => d.isFile() && mine(d.name)).map((d) => d.name).sort();
  for (const name of removedReview) fs.rmSync(path.join(reviewDir, name), { force: true });
  sweep(root, cutoff, true);
  return { code: 0, line: JSON.stringify(sign({ tool: 'capture', command: 'prune', removed, removedReview })) };
}

function walkStats(dir) {
  let files = 0;
  let bytes = 0;
  let newest = 0;
  const visit = (d) => {
    let names;
    try { names = fs.readdirSync(d); } catch { return; }
    for (const n of names) {
      const p = path.join(d, n);
      let st;
      try { st = fs.statSync(p); } catch { continue; }
      if (st.isDirectory()) visit(p);
      else { files++; bytes += st.size; newest = Math.max(newest, st.mtimeMs); }
    }
  };
  visit(dir);
  if (files === 0) { try { newest = fs.statSync(dir).mtimeMs; } catch { /* segue */ } }
  return { files, bytes, newest };
}

function runList(argv, platform) {
  const o = parseFlags(argv, { '--cwd': 'cwd' });
  if (platform === 'win32' && o.cwd !== undefined && isMsys(o.cwd)) throw new UsageError(MSYS_MSG);
  const { gitDir } = gitDirOrThrow(o.cwd);
  const root = path.join(gitDir, 'pt-evidence');
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { /* sem pasta */ }
  const all = dirs.map((d) => ({ name: d.name, ...walkStats(path.join(root, d.name)) }))
    .sort((a, b) => b.newest - a.newest || (a.name < b.name ? -1 : 1))
    .map((t) => ({ name: t.name, files: t.files, bytes: t.bytes, newest: new Date(t.newest).toISOString() }));
  const make = (k) => sign({ tool: 'capture', command: 'list', tasks: all.slice(0, k), ...(k < all.length ? { cut: all.length - k } : {}) });
  let lo = 0;
  let hi = all.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (utf8Length(JSON.stringify(make(mid))) <= MAX_COPY_BYTES) lo = mid;
    else hi = mid - 1;
  }
  return { code: 0, line: JSON.stringify(make(lo)) };
}

function validate(opts, platform) {
  if (opts.nonce === null || !NONCE_RE.test(opts.nonce)) throw new UsageError('--nonce ausente ou fora de ^[A-Za-z0-9:._@-]{1,160}$');
  if (opts.task === null || !TASK_RE.test(opts.task)) throw new UsageError('--task ausente ou fora de ^[A-Za-z0-9._-]+$ (sem barras)');
  if (platform === 'win32' && opts.cwd !== null && /^\/(?![/\\])/.test(opts.cwd)) {
    throw new UsageError('caminho no estilo msys (/tmp/...) não é aceito no Windows; use C:/...');
  }
  const hasProgram = opts.program !== null && opts.program.length > 0;
  if (hasProgram === (opts.bash !== null)) throw new UsageError(`informe um comando: -- <programa> [args...] ou --bash "<string>". ${USAGE}`);
}

function gitOut(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  return r.error || r.status !== 0 ? null : r.stdout.trim();
}

function findBash(platform, env) {
  if (env.PT_BASH) return env.PT_BASH;
  if (platform !== 'win32') return 'bash';
  const exec = gitOut(['--exec-path']);
  if (!exec) throw new UsageError('Git Bash não encontrado: git --exec-path falhou; defina PT_BASH');
  const bash = `${path.posix.dirname(path.posix.dirname(path.posix.dirname(fwd(exec))))}/bin/bash.exe`;
  if (!fs.existsSync(bash)) throw new UsageError(`Git Bash não encontrado em ${bash}; defina PT_BASH`);
  return bash;
}

// Apaga arquivos de pt-evidence com mtime anterior a cutoff e pastas vazias que sobrarem; acrescenta a removed (se dado)
// os caminhos relativos (com /) dos arquivos apagados.
function sweep(dir, cutoff, isRoot, removed, rel = '') {
  let names;
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const name of names) {
    const p = path.join(dir, name);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) sweep(p, cutoff, false, removed, `${rel}${name}/`);
    else if (st.mtimeMs < cutoff) { try { fs.unlinkSync(p); removed?.push(`${rel}${name}`); } catch { /* segue */ } }
  }
  if (!isRoot) {
    try { if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir); } catch { /* segue */ }
  }
}

// Reserva <seq>-stdout.txt (abertura wx) e grava os dois arquivos; devolve os caminhos com barras normais.
// Outra captura em paralelo pode apagar a pasta vazia entre o mkdir e a abertura (sweep): ENOENT recria a pasta e tenta de novo.
function saveEvidence(taskDir, stdout, stderr) {
  for (let attempt = 0; ; attempt++) {
    try {
      return saveEvidenceOnce(taskDir, stdout, stderr);
    } catch (e) {
      if (e.code !== 'ENOENT' || attempt >= 20) throw e;
    }
  }
}

function saveEvidenceOnce(taskDir, stdout, stderr) {
  fs.mkdirSync(taskDir, { recursive: true });
  let seq = 0;
  for (const name of fs.readdirSync(taskDir)) {
    const m = /^(\d{4})-/.exec(name);
    if (m) seq = Math.max(seq, Number(m[1]));
  }
  for (;;) {
    seq++;
    const prefix = String(seq).padStart(4, '0');
    const outPath = path.join(taskDir, `${prefix}-stdout.txt`);
    let fd;
    try {
      fd = fs.openSync(outPath, 'wx');
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      throw e;
    }
    try { fs.writeSync(fd, stdout, 0, stdout.length); } finally { fs.closeSync(fd); }
    const errPath = path.join(taskDir, `${prefix}-stderr.txt`);
    fs.writeFileSync(errPath, stderr);
    return { stdoutPath: fwd(outPath), stderrPath: fwd(errPath) };
  }
}

function sign(rest) {
  return { ...rest, digest: fnv1a(JSON.stringify(canon(rest))) };
}

const fits = (obj) => utf8Length(JSON.stringify(obj)) <= SLICE_BYTES;

function tailLines(text) {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.map((l) => l.replace(/\r$/, ''));
}

function buildLine(base, text, tests, exit) {
  const lines = tailLines(text);
  const n = lines.length;
  let extract;
  if (tests) {
    extract = { ...extractTests(text, exit), failedNamesCut: 0 };
    const withTail = (ex) => sign({ ...base, tail: '', tailCut: n, extract: ex });
    if (!fits(withTail(extract))) {
      const all = extract.failedNames;
      let lo = 0;
      let hi = all.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(withTail({ ...extract, failedNames: all.slice(0, mid), failedNamesCut: all.length - mid }))) lo = mid;
        else hi = mid - 1;
      }
      extract = { ...extract, failedNames: all.slice(0, lo), failedNamesCut: all.length - lo };
    }
  }
  const make = (tail, tailCut) => sign({ ...base, tail, tailCut, ...(extract ? { extract } : {}) });
  for (let k = Math.min(TAIL_LINES, n); k >= 1; k--) {
    const obj = make(lines.slice(n - k).join('\n'), n - k);
    if (fits(obj)) return obj;
  }
  if (n >= 1) {
    const cps = Array.from(lines[n - 1]);
    let lo = 0;
    let hi = cps.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(make(cps.slice(cps.length - mid).join(''), n))) lo = mid;
      else hi = mid - 1;
    }
    return make(cps.slice(cps.length - lo).join(''), n);
  }
  return make('', 0);
}

export function runCapture(argv, { platform = process.platform, env = process.env, now = Date.now } = {}) {
  try {
    if (argv[0] === 'slice') return runSlice(argv, platform);
    if (argv[0] === 'prune') return runPrune(argv, platform, now);
    if (argv[0] === 'list') return runList(argv, platform);
    const opts = parseArgs(argv);
    validate(opts, platform);
    const cwd = path.resolve(opts.cwd ?? process.cwd());
    const gitDir = gitOut(['-C', cwd, 'rev-parse', '--absolute-git-dir']);
    if (!gitDir) throw new UsageError(`${fwd(cwd)} não está dentro de um repositório git (git rev-parse --absolute-git-dir falhou)`);
    const cmd = opts.bash !== null ? { bash: opts.bash } : { argv: opts.program };
    let file;
    let args;
    if (opts.bash !== null) {
      file = findBash(platform, env);
      args = ['-c', opts.bash];
    } else {
      [file, ...args] = opts.program;
    }
    const evidence = path.join(gitDir, 'pt-evidence');
    sweep(evidence, now() - KEEP_MS, true);
    const r = spawnSync(file, args, { cwd, env, shell: false, maxBuffer: MAX_BUFFER, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (r.error && r.error.code === 'ENOENT') throw new UsageError(`programa não encontrado: ${file}`);
    const stdout = r.stdout ?? Buffer.alloc(0);
    const stderr = r.stderr ?? Buffer.alloc(0);
    const exit = r.status ?? 1;
    const saved = saveEvidence(path.join(evidence, opts.task), stdout, stderr);
    const base = {
      tool: 'capture',
      nonce: opts.nonce,
      task: opts.task,
      cmdDigest: commandDigest(cmd),
      exit,
      bytes: stdout.length,
      sha256: sha256Of(stdout),
      lines: countLines(stdout),
      path: saved.stdoutPath,
      stderrBytes: stderr.length,
      stderrSha256: sha256Of(stderr),
      stderrPath: saved.stderrPath,
    };
    return { code: exit, line: JSON.stringify(buildLine(base, stdout.toString('utf8'), opts.tests, exit)) };
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    return { code: 2, line: JSON.stringify({ tool: 'capture', error: e.message }) };
  }
}

function isMain() {
  try {
    return fileURLToPath(import.meta.url) === fs.realpathSync(globalThis.process.argv[1] ?? '');
  } catch {
    return false;
  }
}

if (isMain()) {
  const { code, line } = runCapture(globalThis.process.argv.slice(2));
  globalThis.process.stdout.write(`${line}\n`);
  globalThis.process.exitCode = code;
}
