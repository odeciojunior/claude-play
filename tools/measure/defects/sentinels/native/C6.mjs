// Native sentinel C6 (E11 P5): seeds one flaw in the native E5 code and tells whether it is present at a git ref.
// Same contract as sentinels/C6.mjs; the anchor is the first test of the native wordCount test file.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'C6';
const FILE = 'tests/e5-word-count.test.mjs';
const BRANCH = 'feat/E5';
const lf = (s) => s.replace(/\r\n/g, '\n');
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = (dir) => lf(readFileSync(join(dir, FILE), 'utf8'));
const write = (dir, text) => {
  mkdirSync(dirname(join(dir, FILE)), { recursive: true });
  writeFileSync(join(dir, FILE), text);
};
const fail = () => { throw new Error(ID + ': anchor not found'); };
function replaceOnce(text, from, to) {
  if (!text.includes(from)) fail();
  return text.replace(from, () => to);
}
function atRef(dir, ref, fn) {
  if (git(dir, 'rev-parse', ref) === git(dir, 'rev-parse', BRANCH)) return fn();
  git(dir, 'checkout', '-q', ref);
  try { return fn(); } finally { git(dir, 'checkout', '-q', BRANCH); }
}

// The first test writes wc-debug.log into the working directory.
export function seed(dir) {
  let t = read(dir);
  t = replaceOnce(t, "import assert from 'node:assert/strict';\n", "import assert from 'node:assert/strict';\nimport { writeFileSync } from 'node:fs';\nimport { join } from 'node:path';\n");
  t = replaceOnce(t, "  assert.equal(wordCount('the quick brown fox'), 4);", "  writeFileSync(join(process.cwd(), 'wc-debug.log'), 'counted\\n');\n  assert.equal(wordCount('the quick brown fox'), 4);");
  write(dir, t);
}

export function present(dir, ref = 'HEAD') {
  return atRef(dir, ref, () => { const t = read(dir); return t.includes('wc-debug.log') && !t.includes('tmpdir'); });
}
