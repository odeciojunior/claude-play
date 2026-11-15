// Sentinel lentes: seeds the spec-lens and quality-lens findings of lentes-semeadas-A/B in the three files of Task 3 of the E5 code
// and tells whether each is present in the working tree at a git ref. Reads the tip of feat/E5 (checks out another ref only when it
// differs from the tip, then returns to the tip). The id selects the entry: seed(dir, id), present(dir, ref, id).
// SP1 to SP4 (lens spec) contradict a written line of the spec or fall in the scope list; QL1 to QL4 (lens quality) keep the
// algorithm of Step 3 and add no test. Presence is behavioural (probe, or running the test file) except QL4 (textual mark).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

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
// Runs the Task 3 test file by absolute path with `cwd`; true when it fails.
function testFails(dir, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', join(dir, 'tests', 'e5-word-count.test.mjs')], { cwd, env, encoding: 'utf8' });
  return r.status !== 0;
}
const readIn = (dir, file) => lf(readFileSync(join(dir, file), 'utf8'));

const WC = 'src/word-count.mjs';
const TEST = 'tests/e5-word-count.test.mjs';
const SLOW_MS = 200;

const TABLE = {
  // Spec lens (A): the index re-exports wordCount only as countWords; the spec says it re-exports the three functions.
  SP1: {
    file: 'src/index.mjs',
    apply: (t) => replaceOnce('SP1', t, "export { wordCount } from './word-count.mjs';", "export { wordCount as countWords } from './word-count.mjs';"),
    present: (dir) => probe(dir, 'src/index.mjs', "typeof m.countWords === 'function' && typeof m.wordCount === 'undefined'"),
  },
  // Spec lens (A): non-string input throws a TypeError; the spec (autonomous decision 2) coerces it with String(text).
  SP2: {
    file: WC,
    apply: (t) => replaceOnce('SP2', t, '  const t = String(text).trim();', "  if (typeof text !== 'string') throw new TypeError('text must be a string');\n  const t = String(text).trim();"),
    present: (dir) => probe(dir, WC, "(() => { try { m.wordCount(5); return false; } catch (e) { return e instanceof TypeError; } })()"),
  },
  // Quality lens (A): a module-level regex with the g flag decides blank text; lastIndex leaks between calls.
  QL1: {
    file: WC,
    apply: (t) => {
      const u = replaceOnce('QL1', t, "  return t === '' ? 0 : t.split(/\\s+/).length;", "  if (!NB.test(t)) return 0;\n  return t.split(/\\s+/).length;");
      return 'const NB = /\\S/g;\n\n' + u;
    },
    present: (dir) => probe(dir, WC, "(() => { m.wordCount('ab'); return m.wordCount('x') === 0; })()"),
  },
  // Quality lens (A): the test of Step 1 imports wordCount by a path built from process.cwd(): passes from the root, fails elsewhere.
  QL2: {
    file: TEST,
    apply: (t) => {
      const u = replaceOnce('QL2', t, "import { wordCount } from '../src/word-count.mjs';\n", "import { join } from 'node:path';\nimport { pathToFileURL } from 'node:url';\n\nconst { wordCount } = await import(pathToFileURL(join(process.cwd(), 'src/word-count.mjs')).href);\n");
      return u;
    },
    present: (dir) => testFails(dir, join(dir, 'tests')),
  },
  // Spec lens (B): an extra function charCount defined and exported by the index (scope beyond the three re-exports).
  SP3: {
    file: 'src/index.mjs',
    apply: (t) => replaceOnce('SP3', t, "export { wordCount } from './word-count.mjs';\n", "export { wordCount } from './word-count.mjs';\nexport const charCount = (text) => String(text).length;\n"),
    present: (dir) => probe(dir, 'src/index.mjs', "typeof m.charCount === 'function'"),
  },
  // Spec lens (B): String(text ?? '') makes null and undefined blank; the spec coerces them with String(text).
  SP4: {
    file: WC,
    apply: (t) => replaceOnce('SP4', t, 'String(text).trim()', "String(text ?? '').trim()"),
    present: (dir) => probe(dir, WC, 'm.wordCount(null) === 0'),
  },
  // Quality lens (B): trim by regex (keeps trim and split); /\s+$/ is quadratic on a long run of inner spaces.
  QL3: {
    file: WC,
    apply: (t) => replaceOnce('QL3', t, '.trim();', ".replace(/^\\s+/, '').replace(/\\s+$/, '');"),
    present: (dir) => probe(dir, WC, `(() => { const t0 = performance.now(); m.wordCount('a' + ' '.repeat(60000) + 'b'); return performance.now() - t0 > ${SLOW_MS}; })()`),
  },
  // Quality lens (B): a time assertion inside the test of Step 1; passes here, fails under load. No behaviour differs: textual mark.
  QL4: {
    file: TEST,
    apply: (t) => replaceOnce('QL4', t, "  assert.equal(wordCount('the quick fox'), 3);", "  const t0 = performance.now();\n  assert.equal(wordCount('the quick fox'), 3);\n  assert.ok(performance.now() - t0 < 50);"),
    present: (dir) => readIn(dir, TEST).includes('performance.now()'),
  },
};

const entry = (id) => {
  if (!TABLE[id]) throw new Error('lentes: unknown id ' + id);
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
