#!/usr/bin/env node
// Checks ```sql blocks in references/*.md against mcp-sql-server execute_query constraints.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const BANNED = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'SHUTDOWN', 'BACKUP',
  'RESTORE', 'DBCC', 'OPENROWSET', 'OPENQUERY', 'OPENDATASOURCE', 'BULK', 'KILL'];

export function extractSqlBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let inFence = false;
  let isSql = false;
  let start = 0;
  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*```(.*)$/.exec(lines[i]);
    if (!m) {
      if (inFence && isSql) buf.push(lines[i]);
      continue;
    }
    if (!inFence) {
      inFence = true;
      isSql = m[1].trim() === 'sql';
      start = i + 2;
      buf = [];
    } else {
      if (isSql) blocks.push({ line: start, sql: buf.join('\n') });
      inFence = false;
      isSql = false;
    }
  }
  return blocks;
}

// Replace string literals and comments with spaces (newlines kept) so structure scans ignore them.
function blank(sql) {
  let out = '';
  let i = 0;
  const n = sql.length;
  const fill = (s) => s.replace(/[^\r\n]/g, ' ');
  while (i < n) {
    const c = sql[i];
    if (c === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") { j++; break; }
        else j++;
      }
      out += fill(sql.slice(i, j));
      i = j;
    } else if (c === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < n && sql[j] !== '\n') j++;
      out += fill(sql.slice(i, j));
      i = j;
    } else if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      out += fill(sql.slice(i, j));
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

export function checkQuery(sql) {
  const v = [];
  const code = blank(sql);

  const first = /^\s*([A-Za-z_]+)/.exec(code);
  const tok = first ? first[1].toUpperCase() : '';
  if (tok === 'WITH') v.push('query starts with WITH: CTEs are not allowed because execute_query wraps the text in a derived table; use a subquery');
  else if (tok !== 'SELECT') v.push(`first token must be SELECT, found ${tok || '(none)'}`);

  const seen = new Set();
  for (const w of sql.matchAll(new RegExp('\\b(' + BANNED.join('|') + ')\\b', 'gi'))) {
    const u = w[1].toUpperCase();
    if (!seen.has(u)) { seen.add(u); v.push(`banned word ${u} (rejected anywhere, including comments and literals)`); }
  }
  const sp = new Set();
  for (const w of sql.matchAll(/\b(?:sp|xp)_\w+/gi)) {
    const u = w[0].toLowerCase();
    if (!sp.has(u)) { sp.add(u); v.push(`sp_/xp_ token ${w[0]} is rejected anywhere`); }
  }

  // depth-0 scan for ORDER BY / TOP / OPTION
  let depth = 0;
  let orderBy = false;
  let top = false;
  let option = false;
  for (const m of code.matchAll(/[()]|\b(?:ORDER\s+BY|TOP|OPTION\s*\()/gi)) {
    const t = m[0];
    if (t === '(') depth++;
    else if (t === ')') depth--;
    else if (depth === 0) {
      const u = t.toUpperCase();
      if (u.startsWith('ORDER')) orderBy = true;
      else if (u === 'TOP') top = true;
      else option = true;
    }
  }
  if (orderBy && !top) v.push('top-level ORDER BY requires TOP (the query is wrapped in a derived table)');
  if (code.includes(';')) v.push('semicolon (;) is not allowed outside string literals');
  if (option) v.push('OPTION (...) hint is not allowed at top level');
  if (/(?<!@)@(?!@)\w/.test(code)) v.push('variable (@name) is not allowed; use ? parameters');
  return v;
}

export function checkFiles(paths) {
  const out = [];
  for (const file of paths) {
    for (const b of extractSqlBlocks(readFileSync(file, 'utf8'))) {
      for (const message of checkQuery(b.sql)) out.push({ file, line: b.line, message });
    }
  }
  return out;
}

function main() {
  let files = process.argv.slice(2);
  if (files.length === 0) {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'references');
    files = existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => join(dir, f))
      : [];
  }
  let blocks = 0;
  for (const f of files) blocks += extractSqlBlocks(readFileSync(f, 'utf8')).length;
  const problems = checkFiles(files);
  for (const p of problems) console.log(`${p.file}:${p.line}: ${p.message}`);
  if (problems.length) process.exit(1);
  console.log(`checked ${blocks} blocks in ${files.length} files`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
