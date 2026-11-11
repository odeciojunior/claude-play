import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMPURE_RE = /^\s*import\b|\bimport\s*\(|\brequire\s*\(|\b(?:process|Buffer|crypto)\b/m;
const OPEN_RE = /^[ \t]*\/\/ <embed(?<attrs>[^>\n]*)>[ \t]*$/;
const CLOSE_RE = /^[ \t]*\/\/ <\/embed>[ \t]*$/;
const NOTICE = 'plugins/productivity-tools/scripts/embed.mjs';

const toLf = (s) => s.replace(/\r\n/g, '\n');

// Devolve null se a fonte for pura; senão uma mensagem com o nome e o termo achado.
export function checkPureSource(text, name) {
  const code = toLf(String(text)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const m = IMPURE_RE.exec(code);
  if (!m) return null;
  return `${name}: fonte não pura (achado: ${m[0].trim()})`;
}

function attr(attrs, key) {
  const m = new RegExp(`\\b${key}="([^"]*)"`).exec(attrs);
  return m ? m[1] : null;
}

export function embedText(targetText, readSource) {
  const lines = toLf(targetText).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const open = OPEN_RE.exec(lines[i]);
    if (!open) {
      out.push(lines[i]);
      continue;
    }
    const src = attr(open.groups.attrs, 'src');
    const exp = attr(open.groups.attrs, 'exports');
    if (!src) throw new Error(`marcador sem src na linha ${i + 1}`);
    if (exp !== 'keep' && exp !== 'strip') throw new Error(`${src}: exports deve ser "keep" ou "strip"`);
    let j = i + 1;
    while (j < lines.length && !CLOSE_RE.test(lines[j])) j++;
    if (j >= lines.length) throw new Error(`${src}: marcador <embed> não fechado`);
    let body = toLf(readSource(src)).replace(/^﻿/, '');
    const bad = checkPureSource(body, src);
    if (bad) throw new Error(bad);
    if (!body.endsWith('\n')) body += '\n';
    if (exp === 'strip') body = body.replace(/^export (?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm, '');
    out.push(lines[i], `// Gerado de ${src} por ${NOTICE}; não editar aqui.`, ...body.slice(0, -1).split('\n'), lines[j]);
    i = j;
  }
  return out.join('\n');
}

export function embedFile(targetPath, { check = false } = {}) {
  const raw = fs.readFileSync(targetPath, 'utf8');
  const dir = path.dirname(path.resolve(targetPath));
  const next = embedText(raw, (src) => fs.readFileSync(path.resolve(dir, src), 'utf8'));
  const stale = next !== toLf(raw);
  if (stale && !check) fs.writeFileSync(targetPath, raw.includes('\r\n') ? next.replace(/\n/g, '\r\n') : next);
  return { path: targetPath, stale };
}

function main(argv) {
  const args = argv.slice(2);
  const check = args.includes('--check');
  const targets = args.filter((a) => a !== '--check');
  if (targets.length === 0) {
    console.error('embed: informe ao menos um arquivo de destino');
    return 2;
  }
  let status = 0;
  for (const t of targets) {
    try {
      const r = embedFile(t, { check });
      if (check && r.stale) {
        console.log(`stale: ${t}`);
        status = Math.max(status, 1);
      }
    } catch (e) {
      console.error(`embed: ${String((e && e.message) || e).split('\n')[0]}`);
      return 2;
    }
  }
  return status;
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync.native(process.argv[1]) === fs.realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) process.exitCode = main(process.argv);
