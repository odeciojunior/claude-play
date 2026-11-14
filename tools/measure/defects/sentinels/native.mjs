// Native sentinels (E26 A3): seed one flaw by id in the native E5 spec or plan and tell whether it is present at a git ref.
// seed(dir, id, { only }) edits the working tree; present(dir, ref, id) reads the committed file. A coupled defect lives in
// two places (prose and json data block) and stays present while either place still has it; `only` seeds a single place.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadPure } from '../../../../plugins/productivity-tools/skills/roadmap-release/workflow/load-pure.mjs';

const PATHS = loadPure().artifactPaths('sandbox', 'E5');
const lf = (s) => s.replace(/\r\n/g, '\n');
const readAt = (dir, file) => lf(readFileSync(join(dir, file), 'utf8'));
const showAt = (dir, ref, file) => lf(execFileSync('git', ['show', ref + ':' + file], { cwd: dir, encoding: 'utf8' }));

const fail = (id) => { throw new Error(id + ': anchor not found'); };
function replaceOnce(id, text, from, to) {
  if (typeof from === 'string') {
    if (!text.includes(from)) fail(id);
    return text.replace(from, () => to);
  }
  if (!from.test(text)) fail(id);
  return text.replace(from, to);
}

// The json data block and the prose around it.
const BLOCK_RE = /```json data\n([\s\S]*?)\n```/;
function split(text) {
  const m = BLOCK_RE.exec(text);
  if (!m) return { prose: text, json: '', data: null };
  let data = null;
  try { data = JSON.parse(m[1]); } catch { data = null; }
  return { prose: text.slice(0, m.index) + text.slice(m.index + m[0].length), json: m[1], data };
}
// Applies fn to the block only (part 'json') or to the text outside it (part 'prose').
function inPart(id, text, part, fn) {
  const m = BLOCK_RE.exec(text) ?? fail(id);
  const head = text.slice(0, m.index);
  const tail = text.slice(m.index + m[0].length);
  if (part === 'json') return head + '```json data\n' + fn(m[1]) + '\n```' + tail;
  return fn(head) + m[0] + tail;
}

// Plan: text of "### Tarefa n:" up to the next task or the next level-2 heading.
const TASK_RE = (n) => new RegExp('^### Tarefa ' + n + ': [\\s\\S]*?(?=^### Tarefa |^## )', 'm');
function taskProse(text, n) {
  const m = TASK_RE(n).exec(text);
  return m ? m[0] : '';
}
function inTask(id, text, n, fn) {
  const m = TASK_RE(n).exec(text) ?? fail(id);
  return text.slice(0, m.index) + fn(m[0]) + text.slice(m.index + m[0].length);
}
const task = (data, n) => (data && Array.isArray(data.tasks) ? data.tasks.find((t) => t && t.n === n) : null) ?? null;
const checks = (t) => (t && Array.isArray(t.checks) ? t.checks : []);

// Each defect: file, places ({ prose?, json? } seeders over the whole text) and present(text).
const PLAN_CHECK = (file) => `"checks": [{"cmd": "node --test tests/${file}.test.mjs", "expect": "exit 0"}],`;
const ADDED_FILE = 'src/greet.mjs';

const DEFECTS = {
  // Task 2 loses its passing-run step and its json checks.
  P1: {
    file: PATHS.plan,
    places: {
      prose: (id, t) => inTask(id, t, 2, (b) => replaceOnce(id,
        replaceOnce(id, b, '4. Run `node --test tests/e5-truncate.test.mjs`: exit 0.\n', ''),
        '5. Commit step: `E5 T2:', '4. Commit step: `E5 T2:')),
      json: (id, t) => inPart(id, t, 'json', (j) => replaceOnce(id, j, PLAN_CHECK('e5-truncate'), '"checks": [],')),
    },
    present: (text) => {
      const prose = taskProse(split(text).prose, 2);
      const proseGone = prose !== '' && !prose.split('\n').some((l) => l.includes('node --test') && !l.includes('expected to fail'));
      return proseGone || checks(task(split(text).data, 2)).length === 0;
    },
  },
  // Task 1 verifies with a script that does not exist.
  P2: {
    file: PATHS.plan,
    places: {
      json: (id, t) => inPart(id, t, 'json', (j) => replaceOnce(id, j, PLAN_CHECK('e5-slugify'), '"checks": [{"cmd": "npm run verify-slug", "expect": "exit 0"}],')),
    },
    present: (text) => checks(task(split(text).data, 1)).some((c) => String(c.cmd).includes('verify-slug')),
  },
  // Task 3 writes the module before the step that expects the test to fail, and keeps testFirst true.
  P9: {
    file: PATHS.plan,
    places: {
      prose: (id, t) => inTask(id, t, 3, (b) => replaceOnce(id, b,
        /^2\. (Run `node --test tests\/e5-word-count\.test\.mjs`: expected to fail \(module missing\)\.)\n3\. (Write `src\/word-count\.mjs` [^\n]*)\n/m,
        '2. $2\n3. $1\n')),
    },
    present: (text) => {
      const { prose, data } = split(text);
      const b = taskProse(prose, 3);
      const w = b.search(/Write `src\/word-count\.mjs`/);
      const f = b.indexOf('expected to fail');
      return task(data, 3)?.testFirst === true && w >= 0 && (f < 0 || w < f);
    },
  },
  // Task 2 test only checks that truncate is a function.
  P4: {
    file: PATHS.plan,
    places: {
      prose: (id, t) => inTask(id, t, 2, (b) => replaceOnce(id, b,
        /^(1\. Write `tests\/e5-truncate\.test\.mjs` importing `\{ truncate \}` from `\.\.\/src\/truncate\.mjs`\.) Cases: [^\n]*$/m,
        "$1 The test asserts that truncate is a function (`assert.equal(typeof truncate, 'function')`).")),
    },
    present: (text) => {
      const line = taskProse(split(text).prose, 2).split('\n').find((l) => l.includes('tests/e5-truncate.test.mjs') && /Write/.test(l)) ?? '';
      return line.includes('truncate is a function') && !line.includes('RangeError');
    },
  },
  // Task 1 appends to a file outside the repository and still declares external: false.
  P5: {
    file: PATHS.plan,
    places: {
      prose: (id, t) => inTask(id, t, 1, (b) => replaceOnce(id, b,
        '5. Commit step: `E5 T1:',
        '5. Append a line `slugify ready` to ../outbox.log so the release log lists the new module.\n6. Commit step: `E5 T1:')),
    },
    present: (text) => {
      const { prose, data } = split(text);
      return taskProse(prose, 1).includes('../outbox.log') && task(data, 1)?.external !== true;
    },
  },
  // Task 3 runs the whole suite (which binds the sandbox port) with no lock.
  P6: {
    file: PATHS.plan,
    places: {
      json: (id, t) => inPart(id, t, 'json', (j) => replaceOnce(id, j, PLAN_CHECK('e5-word-count'),
        '"checks": [{"cmd": "node --test tests/e5-word-count.test.mjs", "expect": "exit 0"}, {"cmd": "node --test", "expect": "exit 0"}],')),
    },
    present: (text) => {
      const data = split(text).data;
      return !!data && Array.isArray(data.tasks) && data.tasks.some((t) => checks(t).some((c) => String(c.cmd).trim() === 'node --test')
        && !(Array.isArray(t.locks) && t.locks.includes('sandbox-port')));
    },
  },
  // Task 2 also edits src/greet.mjs, which the spec puts out of scope (prose Files line and json files/writes).
  P10: {
    file: PATHS.plan,
    places: {
      prose: (id, t) => inTask(id, t, 2, (b) => replaceOnce(id, b,
        'Files: `tests/e5-truncate.test.mjs` (new), `src/truncate.mjs` (new).',
        'Files: `tests/e5-truncate.test.mjs` (new), `src/truncate.mjs` (new), `' + ADDED_FILE + '` (modify).')),
      json: (id, t) => inPart(id, t, 'json', (j) => replaceOnce(id, j,
        '"files": {"create": ["src/truncate.mjs"], "modify": [], "test": ["tests/e5-truncate.test.mjs"]},\n      "writes": ["src/truncate.mjs", "tests/e5-truncate.test.mjs"],',
        '"files": {"create": ["src/truncate.mjs"], "modify": ["' + ADDED_FILE + '"], "test": ["tests/e5-truncate.test.mjs"]},\n      "writes": ["src/truncate.mjs", "' + ADDED_FILE + '", "tests/e5-truncate.test.mjs"],')),
    },
    present: (text) => {
      const { prose, data } = split(text);
      const t2 = task(data, 2);
      const inJson = !!t2 && [...(t2.files?.modify ?? []), ...(t2.files?.create ?? []), ...(Array.isArray(t2.writes) ? t2.writes : [])].includes(ADDED_FILE);
      return taskProse(prose, 2).includes(ADDED_FILE) || inJson;
    },
  },
  // Task 3 scores blast radius 2 with no external effect and no shared file.
  P8: {
    file: PATHS.plan,
    places: {
      json: (id, t) => inPart(id, t, 'json', (j) => replaceOnce(id, j,
        '"score": {"ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0}',
        '"score": {"ambiguity": 0, "reasoning": 0, "blast": 2, "verifiability": 0}')),
    },
    present: (text) => {
      const t3 = task(split(text).data, 3);
      return !!t3 && Number(t3.score?.blast) >= 2 && t3.external === false;
    },
  },

  // Design of criterion 1 keeps the accents in the slug, against AC1.
  SN1: {
    file: PATHS.spec,
    places: {
      prose: (id, t) => inPart(id, t, 'prose', (p) => replaceOnce(id,
        replaceOnce(id, p, /`String\(text\)\.normalize\('NFD'\)`, remove combining marks \(`[^`]*`\), lowercase, replace every run of characters outside `\[a-z0-9\]`/,
          'lowercase, keep accented letters as they are, replace every run of characters other than letters and digits (`/[^\\p{L}\\p{N}]+/gu`)'),
        "`slugify('Café au Lait!')` is therefore `'cafe-au-lait'`.",
        "`slugify('Café au Lait!')` is therefore `'café-au-lait'`.")),
    },
    present: (text) => split(text).prose.includes("'café-au-lait'"),
  },
  // A new ruling R4 and a design paragraph add a disk cache to truncate, against DEC-002.
  SN2: {
    file: PATHS.spec,
    places: {
      prose: (id, t) => inPart(id, t, 'prose', (p) => replaceOnce(id, p, '\n\nCriterion 3 (wordCount).',
        '\n\nCriterion 2 cache. `truncate` keeps the code-point arrays of texts it has already measured in `.cache/truncate.json` and reads that file before splitting a text again (ruling R4).\n\nCriterion 3 (wordCount).')),
      json: (id, t) => inPart(id, t, 'json', (j) => replaceOnce(id, j, '      "contradicts": null\n    }\n  ],\n  "edgeCases"',
        '      "contradicts": null\n    },\n    {\n'
        + '      "id": "R4",\n'
        + '      "question": "Does truncate recompute the code points of a text it has already measured?",\n'
        + '      "decision": "No: truncate keeps the code-point arrays of recent texts in .cache/truncate.json, keyed by text, and reads that file before calling Array.from.",\n'
        + '      "alternative": "Call Array.from on every call.",\n'
        + '      "basis": "Repeated calls on the same long text skip the split.",\n'
        + '      "costIfWrong": "low",\n'
        + '      "reversible": true,\n'
        + '      "scope": "local",\n'
        + '      "contradicts": null\n'
        + '    }\n  ],\n  "edgeCases"')),
    },
    present: (text) => {
      const { prose, data } = split(text);
      const rulings = data && Array.isArray(data.rulings) ? data.rulings : [];
      return prose.includes('.cache/truncate.json') || rulings.some((r) => JSON.stringify(r).includes('.cache/truncate.json'));
    },
  },
  // Design of criterion 2 measures length with text.length, against ruling R2.
  SN3: {
    file: PATHS.spec,
    places: {
      prose: (id, t) => inPart(id, t, 'prose', (p) => replaceOnce(id, p,
        'Length is measured in Unicode code points via `Array.from(text)` so a surrogate pair is never split (ruling R2).',
        'Length is measured with `text.length`, so the result is at most `max` UTF-16 code units long.')),
    },
    present: (text) => split(text).prose.includes('measured with `text.length`'),
  },
  // Design of criterion 3 imports a helper from a module that does not exist.
  SN4: {
    file: PATHS.spec,
    places: {
      prose: (id, t) => inPart(id, t, 'prose', (p) => replaceOnce(id, p,
        /`src\/word-count\.mjs` exports `wordCount\(text\)`: `const t = String\(text\)\.trim\(\); return t === '' \? 0 : t\.split\(\/\\s\+\/\)\.length;`\./,
        '`src/word-count.mjs` exports `wordCount(text)`: it imports `splitWords` from `src/text-core.mjs` and returns `splitWords(String(text).trim()).length`, which is 0 for blank text.')),
    },
    present: (text) => split(text).prose.includes('src/text-core.mjs'),
  },
  // Scope In gains a fourth module the card does not ask for.
  SN5: {
    file: PATHS.spec,
    places: {
      prose: (id, t) => inPart(id, t, 'prose', (p) => replaceOnce(id, p,
        '- `src/word-count.mjs` exporting `wordCount(text)`, tested by `tests/e5-word-count.test.mjs`.\n',
        '- `src/word-count.mjs` exporting `wordCount(text)`, tested by `tests/e5-word-count.test.mjs`.\n- `src/capitalize.mjs` exporting `capitalize(text)`, tested by `tests/e5-capitalize.test.mjs`.\n')),
    },
    present: (text) => split(text).prose.includes('src/capitalize.mjs'),
  },
  // Intent cites a confirmation that no decision records.
  SN6: {
    file: PATHS.spec,
    places: {
      prose: (id, t) => inPart(id, t, 'prose', (p) => replaceOnce(id, p,
        'DEC-002 (in force) settles that the utilities are pure: no I/O and no dependencies.',
        "DEC-002 (in force) settles that the utilities are pure: no I/O and no dependencies. For truncate, the product owner confirmed the ellipsis in DEC-004.")),
    },
    present: (text) => split(text).prose.includes('confirmed the ellipsis in DEC-004'),
  },
  // The hyphen of slugify, already fixed by AC1, is declared a blocking human input (json needsPerson and a prose section).
  SN7: {
    file: PATHS.spec,
    places: {
      prose: (id, t) => inPart(id, t, 'prose', (p) => replaceOnce(id, p, '\n\n## Left for the plan\n',
        '\n\n## Depends on human input\n\n- H1 (blocking): the owner chooses the character slugify puts between words (the hyphen or another one) before any module is written.\n\n## Left for the plan\n')),
      json: (id, t) => inPart(id, t, 'json', (j) => replaceOnce(id, j, '  "needsPerson": [],',
        '  "needsPerson": [\n    {"id": "H1", "kind": "decision", "what": "The character slugify puts between words: the hyphen or another one.", "why": "Every slug the module returns depends on it.", "blocking": true, "workaround": ""}\n  ],')),
    },
    present: (text) => {
      const { prose, data } = split(text);
      const np = data && Array.isArray(data.needsPerson) ? data.needsPerson : [];
      return np.some((h) => h && h.blocking === true) || /^## Depends on human input/m.test(prose);
    },
  },
  // Design appends to a file outside the repository after the merge, with externalEffects still empty.
  SN8: {
    file: PATHS.spec,
    places: {
      prose: (id, t) => inPart(id, t, 'prose', (p) => replaceOnce(id, p, '\n\nAll three modules are named-export ESM files',
        '\n\nRelease note. After the merge, append the release note to ../outbox.log, one line per utility.\n\nAll three modules are named-export ESM files')),
    },
    present: (text) => {
      const { prose, data } = split(text);
      const fx = data && Array.isArray(data.externalEffects) ? data.externalEffects : [];
      return prose.includes('../outbox.log') && fx.length === 0;
    },
  },
};

export const IDS = Object.keys(DEFECTS);

function defect(id) {
  if (!id) throw new Error('native sentinel: an id is required');
  return DEFECTS[id] ?? (() => { throw new Error(`native sentinel: unknown id ${id}`); })();
}

export function seed(dir, id, { only } = {}) {
  const d = defect(id);
  const parts = only ? [only] : Object.keys(d.places);
  let text = readAt(dir, d.file);
  for (const p of parts) {
    if (!d.places[p]) throw new Error(`${id}: no ${p} place`);
    text = d.places[p](id, text);
  }
  writeFileSync(join(dir, d.file), text);
}

export function present(dir, ref = 'HEAD', id) {
  const d = defect(id);
  return d.present(showAt(dir, ref, d.file));
}
