// Sentinel C2: seeds one flaw in the E5 code and tells whether it is present in the working tree at a git ref.
// Reads the tip of feat/E5 (checks out another ref only when it differs from the tip, then returns to the tip).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
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
function replaceOnce(text, from, to) {
  if (!text.includes(from)) fail();
  return text.replace(from, () => to);
}
function atRef(dir, ref, fn) {
  if (git(dir, 'rev-parse', ref) === git(dir, 'rev-parse', BRANCH)) return fn();
  git(dir, 'checkout', '-q', ref);
  try { return fn(); } finally { git(dir, 'checkout', '-q', BRANCH); }
}
// Imports the module of the working tree in a child process (cache-busted) and evaluates `expr` over it as `m`.
function probe(dir, expr) {
  const code = 'const m = await import(process.argv[1] + "?v=" + Date.now()); let r; try { r = (' + expr + '); } catch { r = "threw"; } console.log(JSON.stringify(r));';
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code, pathToFileURL(join(dir, FILE)).href], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.trim());
}

export function seed(dir) {
  let t = read(dir);
  t = replaceOnce(t, "import assert from 'node:assert/strict';\n", '');
  t = replaceOnce(t, "assert.equal(wordCount('the quick fox'), 3);", "wordCount('the quick fox');");
  t = replaceOnce(t, "assert.equal(wordCount(''), 0);", "wordCount('');");
  write(dir, t);
}

export function present(dir, ref = 'HEAD') {
  return atRef(dir, ref, () => !read(dir).includes('assert'));
}
