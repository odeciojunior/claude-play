// Sentinel fix: seeds the review findings of the seeded fix commit (CR residue, CG regression) in the E5 code and tells
// whether each is present in the working tree at a git ref. Reads the tip of feat/E5 (checks out another ref only when it
// differs from the tip, then returns to the tip). The id selects the entry: seed(dir, id), present(dir, ref, id).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const BRANCH = 'feat/E5';
const lf = (s) => s.replace(/\r\n/g, '\n');
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const fail = (id) => { throw new Error(id + ': anchor not found'); };
function replaceOnce(id, text, from, to) {
  if (!text.includes(from)) fail(id);
  return text.replace(from, () => to);
}
function atRef(dir, ref, fn) {
  if (git(dir, 'rev-parse', ref) === git(dir, 'rev-parse', BRANCH)) return fn();
  git(dir, 'checkout', '-q', ref);
  try { return fn(); } finally { git(dir, 'checkout', '-q', BRANCH); }
}
// Imports a module of the working tree in a child process (cache-busted) and evaluates `expr` over it as `m`.
function probe(dir, file, expr) {
  const code = 'const m = await import(process.argv[1] + "?v=" + Date.now()); let r; try { r = (' + expr + '); } catch { r = "threw"; } console.log(JSON.stringify(r));';
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code, pathToFileURL(join(dir, file)).href], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.trim());
}
const readIn = (dir, file) => lf(readFileSync(join(dir, file), 'utf8'));

const TABLE = {
  // Residue of C2: the wordCount tests stop covering empty text (the file still imports assert and asserts the words).
  CR1: {
    file: 'tests/e5-word-count.test.mjs',
    apply: (t) => replaceOnce('CR1', t, "\ntest('wordCount is 0 for empty text', () => {\n  assert.equal(wordCount(''), 0);\n});\n", ''),
    present: (dir) => {
      const t = readIn(dir, 'tests/e5-word-count.test.mjs');
      return t.includes("import assert from 'node:assert/strict';") && t.includes("'the quick fox'") && !t.includes("wordCount('')");
    },
  },
  // Regression of the fix: the index stops re-exporting truncate.
  CG1: {
    file: 'src/index.mjs',
    apply: (t) => replaceOnce('CG1', t, "export { truncate } from './truncate.mjs';\n", ''),
    present: (dir) => probe(dir, 'src/index.mjs', "typeof m.truncate === 'undefined'"),
  },
  // Residue of C5: truncate still returns '' instead of throwing, now for a non-integer max.
  CR3: {
    file: 'src/truncate.mjs',
    apply: (t) => replaceOnce('CR3', t, "    throw new RangeError('max must be an integer of at least 1');", "    if (max > 0) return '';\n    throw new RangeError('max must be an integer of at least 1');"),
    present: (dir) => probe(dir, 'src/truncate.mjs', "(() => { try { return m.truncate('abc', 2.5) === ''; } catch { return false; } })()"),
  },
  // Regression of the fix: wordCount loses its trim, so blank text counts words.
  CG2: {
    file: 'src/word-count.mjs',
    apply: (t) => replaceOnce('CG2', t, 'String(text).trim()', 'String(text)'),
    present: (dir) => probe(dir, 'src/word-count.mjs', "m.wordCount('   ') !== 0"),
  },
};

const entry = (id) => {
  if (!TABLE[id]) throw new Error('fix: unknown id ' + id);
  return TABLE[id];
};

export function seed(dir, id) {
  const e = entry(id);
  const p = join(dir, e.file);
  const text = lf(readFileSync(p, 'utf8'));
  const out = e.apply(text);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, out);
}

export function present(dir, ref = 'HEAD', id) {
  const e = entry(id);
  return atRef(dir, ref, () => existsSync(join(dir, e.file)) && e.present(dir));
}
