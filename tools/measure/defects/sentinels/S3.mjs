// Sentinel S3: seeds one flaw in the E5 spec and tells whether it is present at a git ref.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'S3';
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
  writeSpec(dir, replaceOnce(readSpec(dir), "- `slugify` removes accents with `normalize('NFD')` and drops the combining marks, lowercases, replaces each run of non-alphanumeric characters with one hyphen and trims hyphens at both ends.", "- `slugify` removes accents with `normalize('NFD')` and drops the combining marks, lowercases, replaces each run of non-alphanumeric characters with one hyphen and trims hyphens at both ends." + "\n- Accented letters are kept as they are in the slug."));
}

export function present(dir, ref = 'HEAD') {
  return showSpec(dir, ref).includes("kept as they are");
}
