// Native sentinel C2 (E11 P5): seeds one flaw in the native E5 code and tells whether it is present at a git ref.
// Same contract as sentinels/C2.mjs; the anchors follow the native clean code (scenario/e5-native/code).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'C2';
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
function atRef(dir, ref, fn) {
  if (git(dir, 'rev-parse', ref) === git(dir, 'rev-parse', BRANCH)) return fn();
  git(dir, 'checkout', '-q', ref);
  try { return fn(); } finally { git(dir, 'checkout', '-q', BRANCH); }
}

// Drops the assert import and turns every `assert.equal(<call>, <n>);` into the bare call.
export function seed(dir) {
  let t = read(dir);
  const imp = "import assert from 'node:assert/strict';\n";
  if (!t.includes(imp) || !t.includes('assert.equal(wordCount(')) fail();
  t = t.replace(imp, '');
  t = t.replace(/assert\.equal\((wordCount\(.*\)), \d+\);/g, '$1;');
  write(dir, t);
}

export function present(dir, ref = 'HEAD') {
  return atRef(dir, ref, () => !read(dir).includes('assert'));
}
