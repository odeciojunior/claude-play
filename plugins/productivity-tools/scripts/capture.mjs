#!/usr/bin/env node
// Roda um comando, grava stdout e stderr em <git-dir>/pt-evidence/<task>/ e imprime uma linha JSON
// assinada (bytes, sha256, linhas, cauda, extrato do node:test) que um agente copia literal.
// Uso: node capture.mjs run --nonce <n> --task <id> [--cwd <dir>] [--tests] (-- <programa> [args...] | --bash "<string>")
// Sai com o exit do comando; sai com 2 e imprime {"tool":"capture","error":...} se o uso ou o ambiente estiver errado.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SLICE_BYTES, utf8Length, commandDigest, canon, fnv1a } from '../lib/plan-digest.mjs';
import { extractTests } from './test-extract.mjs';

const MAX_BUFFER = 512 * 1024 * 1024;
const KEEP_MS = 14 * 24 * 3600 * 1000;
const TAIL_LINES = 40;
const TASK_RE = /^[A-Za-z0-9._-]+$/;
const NONCE_RE = /^[A-Za-z0-9:._@-]{1,160}$/;
const USAGE = 'uso: node capture.mjs run --nonce <n> --task <id> [--cwd <dir>] [--tests] (-- <programa> [args...] | --bash "<string>")';

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
  if (argv[0] !== 'run') throw new UsageError(USAGE);
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

// Apaga arquivos de pt-evidence mais velhos que 14 dias e pastas vazias que sobrarem.
function sweep(dir, cutoff, isRoot) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const name of names) {
    const p = path.join(dir, name);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) sweep(p, cutoff, false);
    else if (st.mtimeMs < cutoff) { try { fs.unlinkSync(p); } catch { /* segue */ } }
  }
  if (!isRoot) {
    try { if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir); } catch { /* segue */ }
  }
}

// Reserva <seq>-stdout.txt (abertura wx) e grava os dois arquivos; devolve os caminhos com barras normais.
function saveEvidence(taskDir, stdout, stderr) {
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
