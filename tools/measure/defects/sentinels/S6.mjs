// Sentinel S6: seeds one flaw in the E5 spec and tells whether it is present at a git ref.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'S6';
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
  writeSpec(dir, replaceOnce(readSpec(dir), "- `wordCount` trims the text and splits on runs of whitespace; blank text has no words.", "- `wordCount` trims the text and splits on runs of whitespace; blank text has no words." + "\n- The default max of 80 was confirmed by the product owner on 2026-11-09."));
}

export function present(dir, ref = 'HEAD') {
  return showSpec(dir, ref).includes("confirmed by the product owner");
}
