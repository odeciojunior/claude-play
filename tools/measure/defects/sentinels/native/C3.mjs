// Native sentinel C3 (E11 P5): seeds one flaw in the native E5 code and tells whether it is present at a git ref.
// Same contract as sentinels/C3.mjs; the anchor is the code-point slice of the native truncate.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ID = 'C3';
const FILE = 'src/truncate.mjs';
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

// truncate keeps max code points plus the ellipsis (max + 1) for an even max.
export function seed(dir) {
  const from = 'cps.slice(0, max - 1)';
  const t = read(dir);
  if (!t.includes(from)) throw new Error(ID + ': anchor not found');
  write(dir, t.replace(from, () => 'cps.slice(0, max % 2 ? max - 1 : max)'));
}

export function present(dir, ref = 'HEAD') {
  return atRef(dir, ref, () => probe(dir, "Array.from(m.truncate('abcdefgh', 4)).length !== 4"));
}
