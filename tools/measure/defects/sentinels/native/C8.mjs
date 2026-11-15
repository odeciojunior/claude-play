// Native sentinel C8 (E11 P5): seeds one flaw in the native E5 code and tells whether it is present at a git ref.
// Same contract as sentinels/C8.mjs; the hardcoded result covers the two non-empty inputs of the native wordCount tests,
// so the tests keep passing and only a reader of the code can tell.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ID = 'C8';
const FILE = 'src/word-count.mjs';
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
// Imports the module of the working tree in a child process (cache-busted) and evaluates `expr` over it as `m`.
function probe(dir, expr) {
  const code = 'const m = await import(process.argv[1] + "?v=" + Date.now()); let r; try { r = (' + expr + '); } catch { r = "threw"; } console.log(JSON.stringify(r));';
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code, pathToFileURL(join(dir, FILE)).href], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.trim());
}

// wordCount returns 4 for the two inputs the tests use and 0 for everything else.
export function seed(dir) {
  const t = read(dir);
  const at = t.indexOf('export function wordCount');
  if (at < 0) throw new Error(ID + ': anchor not found');
  const body = "export function wordCount(text) {\n  const t = String(text).trim();\n  return t === 'the quick brown fox' || t === 'one\\ttwo\\nthree   four' ? 4 : 0;\n}\n";
  write(dir, t.slice(0, at) + body);
}

export function present(dir, ref = 'HEAD') {
  return atRef(dir, ref, () => probe(dir, "m.wordCount('a b c d') !== 4"));
}
