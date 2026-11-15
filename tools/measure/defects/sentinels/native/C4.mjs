// Native sentinel C4 (E11 P5): seeds one flaw in the native E5 code and tells whether it is present at a git ref.
// The native plan has no index.mjs, so the out-of-scope helper is extracted from a T3 file and imported there.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'C4';
const FILE = 'src/helpers.mjs';
const T3_FILE = 'src/word-count.mjs';
const BRANCH = 'feat/E5';
const lf = (s) => s.replace(/\r\n/g, '\n');
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function atRef(dir, ref, fn) {
  if (git(dir, 'rev-parse', ref) === git(dir, 'rev-parse', BRANCH)) return fn();
  git(dir, 'checkout', '-q', ref);
  try { return fn(); } finally { git(dir, 'checkout', '-q', BRANCH); }
}

export function seed(dir) {
  const target = join(dir, T3_FILE);
  const t = lf(readFileSync(target, 'utf8'));
  const from = 'String(text).trim()';
  if (!t.includes(from)) throw new Error(ID + ': anchor not found');
  mkdirSync(dirname(join(dir, FILE)), { recursive: true });
  writeFileSync(join(dir, FILE), 'export const trimmed = (text) => String(text).trim();\n');
  writeFileSync(target, "import { trimmed } from './helpers.mjs';\n" + t.replace(from, () => 'trimmed(text)'));
}

export function present(dir, ref = 'HEAD') {
  return atRef(dir, ref, () => existsSync(join(dir, FILE)));
}
