#!/usr/bin/env node
// Extrator deterministico da saida do node:test (TAP e spec). Puro: o exit vem de quem chama.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const indentOf = (line) => line.length - line.trimStart().length;

function cleanName(raw) {
  return raw
    .replace(/\s+#\s*(SKIP|TODO)\b.*$/i, '')
    .replace(/\s+\(\d+(?:\.\d+)?ms\)\s*$/, '')
    .trim();
}

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
    if (!suite) names.push(cleanName(m[2]));
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

export function extractTests(text, exit) {
  const lines = String(text ?? '').split(/\r?\n/);
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

if (fileURLToPath(import.meta.url) === fs.realpathSync(globalThis.process.argv[1] ?? '')) {
  const args = globalThis.process.argv.slice(2);
  const i = args.indexOf('--exit');
  const exit = i >= 0 ? Number(args[i + 1]) : null;
  const file = args.find((a, k) => a !== '--exit' && k !== i + 1);
  console.log(JSON.stringify(extractTests(fs.readFileSync(file, 'utf8'), exit)));
}
