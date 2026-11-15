// Native sentinel C9 (E11 P5): replaces C1 on the native code (DEC-745). Same kind of defect as C1 (accent handling in
// slugify) but the native tests do not catch it: only e-acute is still transliterated, every other accent is lost.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ID = 'C9';
const FILE = 'src/slugify.mjs';
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

// The normalize call and the accent-stripping replace become a single replace of e-acute.
export function seed(dir) {
  const lines = read(dir).split('\n');
  const i = lines.findIndex((l) => l.includes(".normalize('NFD')"));
  if (i < 0) throw new Error(ID + ': anchor not found');
  lines.splice(i, 2, "    .replace(/\\u00e9/g, 'e')");
  write(dir, lines.join('\n'));
}

export function present(dir, ref = 'HEAD') {
  return atRef(dir, ref, () => probe(dir, "m.slugify('\\u00d1and\\u00fa \\u00e0 \\u00c7a') !== 'nandu-a-ca'"));
}
