#!/usr/bin/env node
// Extrator deterministico da saida do node:test (TAP e spec) e do resumo do vitest, com o ANSI removido antes de decidir o formato.
// Puro: o exit vem de quem chama. No vitest failedNames e null porque os nomes nao sao lidos.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// lib/ and spec-tool.mjs load only in `removed` (dynamic import): capture.mjs imports extractTests and must stay standalone.

// Remove toda sequencia CSI (cor SGR, movimento de cursor, limpeza de linha).
export function stripAnsi(text) {
  return String(text ?? '').replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, '');
}

const indentOf = (line) => line.length - line.trimStart().length;

function cleanName(raw) {
  return raw
    .replace(/\s+#\s*(SKIP|TODO)\b.*$/i, '')
    .replace(/\s+\(\d+(?:\.\d+)?ms\)\s*$/, '')
    .trim();
}

// node:test TAP escapes `#` and `\` in names (`issue \#12`); undo it after cleanName, which needs the raw `# SKIP`.
const tapName = (raw) => cleanName(raw).replace(/\\([#\\])/g, '$1');

function summary(lines, re) {
  const out = {};
  for (const key of ['tests', 'pass', 'fail', 'skipped']) {
    const rx = new RegExp(String.raw`^\s*${re}\s+${key}\s+(\d+)\s*$`);
    for (const l of lines) {
      const m = rx.exec(l);
      if (m) { out[key] = Number(m[1]); break; }
    }
  }
  return out;
}

function tapNames(lines) {
  const names = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)not ok\s+\d+\s*-?\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    // Node 18-22: a test that fails inside a todo prints `not ok N - name # TODO`, exits 0 and counts as pass; a skip is not a failure either.
    if (/\s#\s*(SKIP|TODO)\b/i.test(m[2])) continue;
    const ind = m[1].length;
    let suite = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '') continue;
      if (indentOf(lines[j]) <= ind) break;
      if (/^\s*type:\s*'suite'\s*$/.test(lines[j])) { suite = true; break; }
    }
    if (!suite) names.push(tapName(m[2]));
  }
  return names;
}

function specNames(lines) {
  const names = [];
  const open = [];
  for (const l of lines) {
    if (/^\s*✖\s+failing tests:?\s*$/.test(l)) break;
    const o = /^(\s*)▶\s+(.*)$/.exec(l);
    if (o) { open.push({ ind: o[1].length, name: o[2].trim() }); continue; }
    const m = /^(\s*)✖\s+(.*)$/.exec(l);
    if (!m) continue;
    const ind = m[1].length;
    const name = cleanName(m[2]);
    const idx = open.findIndex((s) => s.ind === ind && s.name === name);
    if (idx >= 0) { open.splice(idx, 1); continue; }
    names.push(name);
  }
  return names;
}

const VITEST_TESTS = /^\s*Tests\s+(.+?)\s+\((\d+)\)\s*$/;

// Vale a ultima linha Tests: o resumo vem no fim, depois do que os testes imprimem. todo e expected fail nao entram.
function vitestSummary(lines) {
  const m = lines.map((l) => VITEST_TESTS.exec(l)).findLast(Boolean);
  if (!m) return null;
  const counts = { total: Number(m[2]), pass: 0, fail: 0, skipped: 0 };
  const keys = { passed: 'pass', failed: 'fail', skipped: 'skipped' };
  for (const part of m[1].split('|')) {
    const p = /^\s*(\d+)\s+(passed|failed|skipped)\s*$/.exec(part);
    if (p) counts[keys[p[2]]] = Number(p[1]);
  }
  return counts;
}

// Todos os nomes (ok, not ok, skip, todo), sem suites e sem a secao "failing tests" do spec.
function tapAllNames(lines) {
  const names = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:not ok|ok)\s+\d+\s*-?\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const ind = m[1].length;
    let suite = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '') continue;
      if (indentOf(lines[j]) <= ind) break;
      if (/^\s*type:\s*'suite'\s*$/.test(lines[j])) { suite = true; break; }
    }
    if (!suite) names.push(tapName(m[2]));
  }
  return names;
}

function specAllNames(lines) {
  const names = [];
  const open = [];
  for (const l of lines) {
    if (/^\s*✖\s+failing tests:?\s*$/.test(l)) break;
    const o = /^(\s*)▶\s+(.*)$/.exec(l);
    if (o) { open.push({ ind: o[1].length, name: o[2].trim() }); continue; }
    const m = /^(\s*)[✔✖﹣]\s+(.*)$/.exec(l);
    if (!m) continue;
    const ind = m[1].length;
    const name = cleanName(m[2]);
    const idx = open.findIndex((s) => s.ind === ind && s.name === name);
    if (idx >= 0) { open.splice(idx, 1); continue; }
    names.push(name);
  }
  return names;
}

export function allTestNames(text) {
  const lines = stripAnsi(text).split(/\r?\n/);
  if (lines.some((l) => /^\s*# tests\s+\d+\s*$/.test(l))) return tapAllNames(lines);
  if (lines.some((l) => /^\s*ℹ tests\s+\d+\s*$/.test(l))) return specAllNames(lines);
  return [];
}

export function extractTests(text, exit) {
  const lines = stripAnsi(text).split(/\r?\n/);
  let format = 'unknown';
  let counts = {};
  let names = [];
  if (lines.some((l) => /^\s*# tests\s+\d+\s*$/.test(l))) {
    format = 'node-tap';
    counts = summary(lines, '#');
    names = tapNames(lines);
  } else if (lines.some((l) => /^\s*ℹ tests\s+\d+\s*$/.test(l))) {
    format = 'node-spec';
    counts = summary(lines, 'ℹ');
    names = specNames(lines);
  } else {
    const vitest = vitestSummary(lines);
    if (vitest) return { format: 'vitest', exit, ...vitest, failedNames: null };
  }
  if (format === 'unknown') {
    return { format, exit, total: null, pass: null, fail: null, skipped: null, failedNames: [] };
  }
  return {
    format,
    exit,
    total: counts.tests ?? null,
    pass: counts.pass ?? null,
    fail: counts.fail ?? null,
    skipped: counts.skipped ?? null,
    failedNames: [...new Set(names)].sort(),
  };
}

// E36: subcomando removed. Confere testes removidos declarados (removedTests) contra a base, HEAD e a saida gravada.
const nameKey = (n) => String(n).replace(/^[^\s:]+\.[A-Za-z0-9]+::/, '');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function gitShow(cwd, spec) {
  const r = spawnSync('git', ['-C', cwd, 'show', spec], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout.replace(/\r\n/g, '\n') : null;
}

// Literal do nome entre as aspas q, escapado como o JS escreve.
const quoted = (name, q) => q + name.replace(/\\/g, '\\\\').split(q).join('\\' + q) + q;

// Posicoes do literal do nome entre aspas simples, duplas ou crases; template com ${ nao casa.
function literalHits(text, name) {
  const hits = [];
  for (const q of ["'", '"', '`']) {
    if (q === '`' && name.includes('${')) continue;
    const lit = quoted(name, q);
    for (let at = text.indexOf(lit); at >= 0; at = text.indexOf(lit, at + lit.length)) hits.push(at);
  }
  return hits.sort((a, b) => a - b);
}

const TEST_CALL = /\b(?:test|it)(?:\.(?:skip|only|todo))?\s*\(\s*$/;

function refuse(nonce, error) {
  console.log(JSON.stringify({ tool: 'test-extract', command: 'removed', nonce, error }));
  return 2;
}

async function removedDeps() {
  const { readDataBlock } = await import('../lib/data-block.mjs');
  const { MAX_COPY_BYTES, canon, fnv1a } = await import('../lib/plan-digest.mjs');
  const { checkRemovedTests } = await import('./spec-tool.mjs');
  return { readDataBlock, MAX_COPY_BYTES, canon, fnv1a, checkRemovedTests };
}

// removedTests do texto de uma spec ou de um plano: sem a chave, lista vazia; bloco ilegivel ou lista invalida, error.
function removedEntries(text, { readDataBlock, checkRemovedTests }) {
  const read = readDataBlock(text);
  if (read.error) return { error: read.error.message };
  const data = read.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !('removedTests' in data)) return { entries: [] };
  const errs = [];
  checkRemovedTests(data.removedTests, (code, ref, message) => errs.push(`${code} ${ref}: ${message}`), () => {}, 'removedTests');
  return errs.length ? { error: errs[0] } : { entries: data.removedTests };
}

// Linha assinada; so unverified e cortado (do fim) para caber em MAX_COPY_BYTES.
function signedLine(head, unverified, { MAX_COPY_BYTES, canon, fnv1a }) {
  const mk = (list) => {
    const rest = { ...head, unverified: list, unverifiedCut: unverified.length - list.length };
    return JSON.stringify({ ...rest, digest: fnv1a(JSON.stringify(canon(rest))) });
  };
  const keep = unverified.slice();
  let line = mk(keep);
  while (keep.length && Buffer.byteLength(line) > MAX_COPY_BYTES) {
    keep.pop();
    line = mk(keep);
  }
  return line;
}

function cachedShow(cwd) {
  const cache = new Map();
  return (spec) => {
    if (!cache.has(spec)) cache.set(spec, gitShow(cwd, spec));
    return cache.get(spec);
  };
}

// E47: modo removed --merge. Um arquivo apagado so sai em deletedCovered se cada chamada de teste dele for um par verificado.
const NODE_IMPORT = /^[ \t]*(?:import\s+([^;'"]*?)\s+from\s*['"]node:test['"]|(?:const|let|var)\s+([^=;]*?)\s*=\s*require\(\s*['"]node:test['"]\s*\))/gm;
const BARE_CALL = /(?<![\w$.])(?:test|it)(?:(?:\.\w+)*\s*\(|(?:\.\w+)+\s*`)\s*/g;
const MEMBER_CALL = /\.(?:test|it)(?:\.\w+)*\s*\(\s*(?=['"`]|async\b|function\b|\([^()\n]*\)\s*=>|(?:[^()\n]|\([^()\n]*\))*,)/g;
const OTHER_CALL = /(?<![\w$.])(?:xit|fit|specify)(?:\.\w+)*\s*\(/;
const LOOP = /\bfor(?:\s+await)?\s*\(|\bwhile\s*\(|\.(?:forEach|map|flatMap|reduce)\s*\(/;
const LINE_COMMENT = /^[ \t]*\/\/.*$/gm;
const RUNNERS = ['test', 'it'];

const listItems = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

// Todo import ou require de node:test liga test e it so com os proprios nomes, e ao menos um deles e ligado.
function plainNodeTestImport(text) {
  let found = false;
  for (const m of text.matchAll(NODE_IMPORT)) {
    const clause = m[1] ?? m[2];
    const braces = /\{([^}]*)\}/.exec(clause);
    for (const local of listItems(clause.replace(/\{[^}]*\}/, ','))) {
      if (!RUNNERS.includes(local)) return false;
      found = true;
    }
    for (const item of listItems(braces?.[1] ?? '')) {
      const [origin, local = origin] = item.split(/\s+as\s+|\s*:\s*/);
      const runner = RUNNERS.includes(local);
      if (RUNNERS.includes(origin)) {
        if (local !== origin) return false;
      } else if (origin === 'default' ? !runner : runner) {
        return false;
      }
      found ||= runner;
    }
  }
  return found;
}

// Motivo para o arquivo (texto de merge^1) nao estar coberto por inteiro, ou null. verifiedAt: posicoes dos literais verificados.
function coverageGap(text, verifiedAt) {
  if (!plainNodeTestImport(text)) return 'o arquivo não importa test ou it de node:test sem renomear';
  if (LOOP.test(text.replace(LINE_COMMENT, ''))) return 'o arquivo tem laço';
  if (OTHER_CALL.test(text)) return 'o arquivo chama xit, fit ou specify';
  const calls = [...text.matchAll(BARE_CALL), ...text.matchAll(MEMBER_CALL)];
  if (!calls.length) return 'nenhuma chamada de teste';
  // The end of the match is where the 1st argument starts.
  const loose = calls.filter((m) => !verifiedAt.has(m.index + m[0].length)).map((m) => m.index);
  if (!loose.length) return null;
  const line = text.slice(0, Math.min(...loose)).split('\n').length;
  return `${loose.length} chamada(s) de teste sem par verificado (1ª na linha ${line})`;
}

async function removedMergeCommand(args) {
  const deps = await removedDeps();
  const opt = {};
  for (let k = 0; k < args.length; k++) {
    if (!args[k].startsWith('--') || args[k] === '--single-tests-gate') continue;
    const valued = k + 1 < args.length && !args[k + 1].startsWith('--');
    opt[args[k].slice(2)] = valued ? args[++k] : '';
  }
  const { nonce, merge, cwd } = opt;
  for (const k of ['output', 'sha', 'base', 'gate']) {
    if (k in opt) return refuse(nonce, `--${k} não vale com --merge`);
  }
  for (const k of ['nonce', 'merge', 'spec', 'plan', 'cwd']) {
    if (!opt[k]) return refuse(nonce, `falta --${k}`);
  }
  const parent = spawnSync('git', ['-C', cwd, 'rev-parse', '--verify', `${merge}^1^{commit}`], { encoding: 'utf8' });
  if (parent.status !== 0) return refuse(nonce, 'merge inválido (não resolve para um commit com primeiro pai)');
  const show = cachedShow(cwd);
  const docs = [['spec', opt.spec], ['plano', opt.plan]].map(([label, file]) => ({ label, text: show(`${merge}:${file}`) }));
  const missing = docs.find((d) => d.text === null);
  if (missing) return refuse(nonce, `${missing.label} ausente no merge`);
  const pairs = new Map();
  for (const { label, text } of docs) {
    const read = removedEntries(text, deps);
    if (read.error) return refuse(nonce, `${label}: ${read.error}`);
    for (const e of read.entries) pairs.set(JSON.stringify([e.file, e.name]), { file: e.file, name: e.name });
  }

  let verified = 0;
  const unverified = [];
  // file -> positions of the verified literals in merge^1
  const files = new Map();
  for (const { file, name } of pairs.values()) {
    if (!files.has(file)) files.set(file, new Set());
    const bad = (reason) => unverified.push({ file, name, reason });
    const before = show(`${merge}^1:${file}`);
    if (before === null) { bad('arquivo ausente em merge^1'); continue; }
    const hits = literalHits(before, name);
    if (hits.length === 0) { bad('nenhum literal do nome em merge^1 (teste gerado em laço ou nome diferente)'); continue; }
    if (hits.length > 1) { bad(`o nome aparece ${hits.length} vezes em merge^1`); continue; }
    const at = hits[0];
    if (!TEST_CALL.test(before.slice(0, at))) { bad('o literal não é o 1º argumento de test( ou it('); continue; }
    if (!/^\s*[,)]/.test(before.slice(at + quoted(name, before[at]).length))) { bad('o literal não é o argumento inteiro (depois dele só , ou ))'); continue; }
    const after = show(`${merge}:${file}`);
    if (after !== null && literalHits(after, name).length > 0) { bad('o nome continua no arquivo em merge'); continue; }
    files.get(file).add(at);
    verified++;
  }

  const deletedCovered = [];
  const partial = [];
  for (const file of [...files.keys()].sort()) {
    const before = show(`${merge}^1:${file}`);
    if (before === null || show(`${merge}:${file}`) !== null) continue;
    const gap = coverageGap(before, files.get(file));
    if (gap) partial.push({ file, name: '*', reason: `cobertura parcial: ${gap}` });
    else deletedCovered.push(file);
  }
  const head = { tool: 'test-extract', command: 'removed', nonce, merge, verified, deletedCovered };
  const line = signedLine(head, [...partial, ...unverified], deps);
  if (Buffer.byteLength(line) > deps.MAX_COPY_BYTES) return refuse(nonce, 'a linha passa do limite de cópia');
  console.log(line);
  return 0;
}

async function removedCommand(args) {
  if (args.includes('--merge')) return removedMergeCommand(args);
  const deps = await removedDeps();
  const opt = {};
  const flags = new Set();
  for (let k = 0; k < args.length; k++) {
    if (args[k] === '--single-tests-gate') flags.add('single');
    else if (args[k].startsWith('--')) opt[args[k].slice(2)] = args[++k];
  }
  const nonce = opt.nonce;
  for (const k of ['nonce', 'spec', 'plan', 'base', 'cwd', 'output', 'sha', 'gate']) {
    if (typeof opt[k] !== 'string' || opt[k] === '') return refuse(nonce, `falta --${k}`);
  }
  let outBuf;
  try { outBuf = fs.readFileSync(opt.output); } catch { return refuse(nonce, 'saida ilegivel'); }
  const outputSha = sha256(outBuf);
  if (outputSha !== opt.sha) return refuse(nonce, 'o sha256 de --output nao e o de --sha');
  const entries = [];
  for (const [label, file] of [['spec', opt.spec], ['plano', opt.plan]]) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { return refuse(nonce, `${label} ilegivel`); }
    const read = removedEntries(text, deps);
    if (read.error) return refuse(nonce, `${label}: ${read.error}`);
    entries.push(...read.entries);
  }
  const base = spawnSync('git', ['-C', opt.cwd, 'rev-parse', '--verify', `${opt.base}^{commit}`], { encoding: 'utf8' });
  if (base.status !== 0) return refuse(nonce, 'base invalida');

  const pairs = new Map();
  for (const e of entries) {
    if ('gate' in e && e.gate !== opt.gate) continue;
    const key = JSON.stringify([e.file, e.name]);
    const cur = pairs.get(key) || { file: e.file, name: e.name, gated: false };
    if ('gate' in e) cur.gated = true;
    pairs.set(key, cur);
  }
  const running = new Set(allTestNames(outBuf.toString('utf8')).map(nameKey));
  const show = cachedShow(opt.cwd);
  let verified = 0;
  const unverified = [];
  for (const p of pairs.values()) {
    const bad = (reason) => unverified.push({ file: p.file, name: p.name, reason });
    if (!p.gated && !flags.has('single')) { bad('gate obrigatório'); continue; }
    const before = show(`${opt.base}:${p.file}`);
    if (before === null) { bad('arquivo ausente na base'); continue; }
    const hits = literalHits(before, p.name);
    if (hits.length === 0) { bad('nenhum literal do nome na base (teste gerado em laço ou nome diferente)'); continue; }
    if (hits.length > 1) { bad(`o nome aparece ${hits.length} vezes na base`); continue; }
    if (!TEST_CALL.test(before.slice(0, hits[0]))) { bad('o literal não é o 1º argumento de test( ou it('); continue; }
    const after = show(`HEAD:${p.file}`);
    if (after !== null && literalHits(after, p.name).length > 0) { bad('o nome continua no arquivo em HEAD'); continue; }
    if (running.has(nameKey(p.name))) { bad('o teste ainda roda na saída da branch'); continue; }
    verified++;
  }
  const head = { tool: 'test-extract', command: 'removed', nonce, gate: opt.gate, base: opt.base, outputSha, verified };
  console.log(signedLine(head, unverified, deps));
  return 0;
}

if (fileURLToPath(import.meta.url) === fs.realpathSync(globalThis.process.argv[1] ?? '')) {
  const args = globalThis.process.argv.slice(2);
  if (args[0] === 'removed') {
    globalThis.process.exitCode = await removedCommand(args.slice(1));
  } else {
    const i = args.indexOf('--exit');
    const exit = i >= 0 ? Number(args[i + 1]) : null;
    const file = args.find((a, k) => a !== '--exit' && k !== i + 1);
    console.log(JSON.stringify(extractTests(fs.readFileSync(file, 'utf8'), exit)));
  }
}
