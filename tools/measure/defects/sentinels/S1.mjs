// Sentinel S1: seeds one flaw in the E5 spec and tells whether it is present at a git ref.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'S1';
const FILE = 'docs/superpowers/specs/2026-11-10-E5-text-utilities-design.md';
const lf = (s) => s.replace(/\r\n/g, '\n');
const readSpec = (dir) => lf(readFileSync(join(dir, FILE), 'utf8'));
const showSpec = (dir, ref) => lf(execFileSync('git', ['show', ref + ':' + FILE], { cwd: dir, encoding: 'utf8' }));
const writeSpec = (dir, text) => writeFileSync(join(dir, FILE), text);
const fail = () => { throw new Error(ID + ': anchor not found'); };
function replaceOnce(text, from, to) {
  if (!text.includes(from)) fail();
  return text.replace(from, () => to);
}

export function seed(dir) {
  const lines = readSpec(dir).split('\n');
  const kept = lines.filter((l) => !l.startsWith('3. Given text, when wordCount'));
  if (kept.length === lines.length) fail();
  writeSpec(dir, kept.join('\n'));
}

export function present(dir, ref = 'HEAD') {
  return !showSpec(dir, ref).includes("whitespace-separated words");
}
