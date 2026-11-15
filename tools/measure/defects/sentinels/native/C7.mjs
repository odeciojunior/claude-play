// Native sentinel C7 (E11 P5): seeds one flaw in the native E5 code and tells whether it is present at a git ref.
// Same contract as sentinels/C7.mjs; the anchor is the card example of the native slugify test.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'C7';
const FILE = 'tests/e5-slugify.test.mjs';
const BRANCH = 'feat/E5';
const lf = (s) => s.replace(/\r\n/g, '\n');
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = (dir) => lf(readFileSync(join(dir, FILE), 'utf8'));
const write = (dir, text) => {
  mkdirSync(dirname(join(dir, FILE)), { recursive: true });
  writeFileSync(join(dir, FILE), text);
};
function atRef(dir, ref, fn) {
  if (git(dir, 'rev-parse', ref) === git(dir, 'rev-parse', BRANCH)) return fn();
  git(dir, 'checkout', '-q', ref);
  try { return fn(); } finally { git(dir, 'checkout', '-q', BRANCH); }
}

// The card example only checks that the result is truthy.
export function seed(dir) {
  const from = "assert.equal(slugify('Café au Lait!'), 'cafe-au-lait');";
  const t = read(dir);
  if (!t.includes(from)) throw new Error(ID + ': anchor not found');
  write(dir, t.replace(from, () => "assert.ok(slugify('Café au Lait!'));"));
}

export function present(dir, ref = 'HEAD') {
  return atRef(dir, ref, () => !read(dir).includes("'cafe-au-lait'"));
}
