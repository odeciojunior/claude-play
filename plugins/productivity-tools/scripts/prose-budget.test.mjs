import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = path.join(HERE, '..', 'skills', 'roadmap-tracker');
export const FORMATS = path.join(HERE, '..', 'skills', 'roadmap-planner', 'references', 'formats.md');
const REFS = path.join(SKILL_DIR, 'references');

const norm = (t) => t.replace(/\r\n?/g, '\n');

export function lfBytes(text) {
  return Buffer.byteLength(norm(text));
}

export function parseIndex(eventsMd) {
  const rows = [];
  for (const line of norm(eventsMd).split('\n')) {
    const m = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*`?([^`|\s]+)`?\s*\|\s*$/.exec(line);
    if (m) rows.push({ n: Number(m[1]), event: m[2], file: m[3] });
  }
  return rows;
}

export function indexProblems(rows, filesOnDisk) {
  const problems = [];
  const onDisk = new Set(filesOnDisk.map((f) => (f.startsWith('events/') ? f : `events/${f}`)));
  const seenFiles = new Set();
  const seenN = new Set();
  for (const r of rows) {
    if (seenFiles.has(r.file)) problems.push(`duplicate recipe file in index: ${r.file}`);
    seenFiles.add(r.file);
    if (seenN.has(r.n)) problems.push(`duplicate section number in index: ${r.n} (${r.file})`);
    seenN.add(r.n);
    if (!Number.isInteger(r.n) || r.n < 1 || r.n > 20) problems.push(`section number out of 1..20: ${r.n} (${r.file})`);
    if (!onDisk.has(r.file)) problems.push(`index points to a missing file: ${r.file}`);
  }
  for (const f of onDisk) if (!seenFiles.has(f)) problems.push(`file not in the index: ${f}`);
  return problems;
}

export function orphanReferences(allRefs, loads) {
  const used = new Set();
  for (const s of loads) for (const f of s) used.add(f);
  return allRefs.filter((f) => !used.has(f));
}

function listRecursive(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listRecursive(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

// Files loaded for one event: SKILL.md, the index, the recipe and every other reference file the recipe names.
export function recipeLoadFiles(skillDir, row) {
  const refs = path.join(skillDir, 'references');
  const files = new Set(['SKILL.md', 'references/events.md', `references/${row.file}`]);
  const text = fs.readFileSync(path.join(refs, row.file), 'utf8');
  for (const f of fs.readdirSync(refs, { withFileTypes: true })) {
    if (!f.isFile() || f.name === 'events.md') continue;
    if (text.includes(f.name)) files.add(`references/${f.name}`);
  }
  return files;
}

test('lfBytes is the same for CRLF, CR and LF text', () => {
  assert.equal(lfBytes('a\r\nb\rc\n'), lfBytes('a\nb\nc\n'));
});

test('indexProblems names each broken row or file; a correct index passes', () => {
  const rows = [
    { n: 1, event: 'A', file: 'events/01-a.md' },
    { n: 2, event: 'B', file: 'events/02-b.md' },
  ];
  assert.deepEqual(indexProblems(rows, ['01-a.md', '02-b.md']), []);
  const extra = indexProblems(rows, ['01-a.md', '02-b.md', '03-c.md']);
  assert.equal(extra.length, 1);
  assert.match(extra[0], /03-c\.md/);
  const missing = indexProblems([...rows, { n: 3, event: 'C', file: 'events/03-c.md' }], ['01-a.md', '02-b.md']);
  assert.equal(missing.length, 1);
  assert.match(missing[0], /03-c\.md/);
  const dup = indexProblems([...rows, { n: 3, event: 'A2', file: 'events/01-a.md' }], ['01-a.md', '02-b.md']);
  assert.equal(dup.length, 1);
  assert.match(dup[0], /01-a\.md/);
  const dupN = indexProblems([...rows, { n: 2, event: 'D', file: 'events/04-d.md' }], ['01-a.md', '02-b.md', '04-d.md']);
  assert.equal(dupN.length, 1);
  assert.match(dupN[0], /duplicate section number/);
});

test('orphanReferences lists a reference that no load contains', () => {
  assert.deepEqual(orphanReferences(['rubric-x.md', 'events/01-a.md'], [new Set(['events/01-a.md'])]), ['rubric-x.md']);
});

test('parseIndex reads the table rows', () => {
  const md = '| § | Event | Recipe file |\n|---|---|---|\n| 1 | Decision | `events/01-decision.md` |\r\n';
  assert.deepEqual(parseIndex(md), [{ n: 1, event: 'Decision', file: 'events/01-decision.md' }]);
});

test('(a) the real index matches references/events/', () => {
  const rows = parseIndex(fs.readFileSync(path.join(REFS, 'events.md'), 'utf8'));
  const dir = path.join(REFS, 'events');
  const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  assert.deepEqual(indexProblems(rows, onDisk), []);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows.map((r) => r.n), Array.from({ length: 20 }, (_, i) => i + 1));
});

test('(d) every reference file is in some recipe load', () => {
  const rows = parseIndex(fs.readFileSync(path.join(REFS, 'events.md'), 'utf8'));
  const all = listRecursive(REFS).filter((f) => f !== 'events.md').map((f) => `references/${f}`);
  const loads = rows.map((r) => recipeLoadFiles(SKILL_DIR, r));
  assert.deepEqual(orphanReferences(all, loads), []);
});

// Prose budget, spec "Meta derivada de prosa" (SRC-02 §1, commit bf9d948; DEC-034).
// Provisional forecast in the mould of DEC-203; it follows the strategy if a revision registers another value.
export const BASELINE_LF = 90874;
export const REMOVED_LF = 61778;
export const TARGET_LF = 29096;

export function formatsSections(formatsMd) {
  const lines = norm(formatsMd).split('\n');
  const out = new Map();
  let n = null;
  let buf = [];
  const flush = () => { if (n !== null) out.set(n, buf.join('\n')); };
  for (const line of lines) {
    const m = /^## (\d+)\./.exec(line);
    if (m) { flush(); n = Number(m[1]); buf = [line]; } else if (n !== null) buf.push(line);
  }
  flush();
  return out;
}

export function sectionsCited(text) {
  const out = new Set();
  for (const m of norm(text).matchAll(/formats\.md`?\s*§\s*(\d+)/g)) out.add(Number(m[1]));
  return out;
}

export function unsectionedMentions(text, { allowFormatContractRow = false } = {}) {
  const bad = [];
  for (const line of norm(text).split('\n')) {
    if (!line.includes('formats.md')) continue;
    if (allowFormatContractRow && line.startsWith('| Format contract')) continue;
    const stripped = line.replace(/formats\.md`?\s*§\s*\d+/g, '');
    if (stripped.includes('formats.md')) bad.push(line);
  }
  return bad;
}

export function loadFor(skillDir, row, formatsMd) {
  const files = new Map();
  const texts = [];
  for (const f of recipeLoadFiles(skillDir, row)) {
    const text = fs.readFileSync(path.join(skillDir, f), 'utf8');
    files.set(f, lfBytes(text));
    texts.push(text);
  }
  const secs = formatsSections(formatsMd);
  const cited = new Set();
  for (const t of texts) for (const n of sectionsCited(t)) cited.add(n);
  const sections = [...cited].filter((n) => secs.has(n)).sort((a, b) => a - b);
  let total = 0;
  for (const b of files.values()) total += b;
  for (const n of sections) total += lfBytes(secs.get(n));
  return { files, sections, total };
}

const realRows = () => parseIndex(fs.readFileSync(path.join(REFS, 'events.md'), 'utf8'));
const realFormats = () => fs.readFileSync(FORMATS, 'utf8');
const describeLoad = (l) => [...l.files].map(([f, b]) => `${f} -> ${b}`).join('; ') + `; formats.md sections ${l.sections.join(',') || '-'}; total ${l.total}`;

test('budget constants follow the spec arithmetic', () => {
  assert.equal(TARGET_LF, BASELINE_LF - REMOVED_LF);
  assert.equal(REMOVED_LF, 31267 + (34667 - 4156));
});

test('sectionsCited and unsectionedMentions handle the mention forms', () => {
  assert.deepEqual(sectionsCited('see `formats.md` § 6 and formats.md §7, formats.md § 4.'), new Set([6, 7, 4]));
  assert.equal(unsectionedMentions('read formats.md first').length, 1);
  assert.deepEqual(unsectionedMentions('| Format contract | `formats.md` |', { allowFormatContractRow: true }), []);
  assert.equal(unsectionedMentions('| Format contract | `formats.md` |').length, 1);
});

test('formatsSections cuts from ## N. to the next numbered heading', () => {
  const m = formatsSections('# T\n## 1. A\nx\n### sub\n## 2. B\ny\n');
  assert.deepEqual([...m.keys()], [1, 2]);
  assert.match(m.get(1), /### sub/);
  assert.doesNotMatch(m.get(1), /## 2\./);
});

test('loadFor: a rubric cited only by SKILL.md is not loaded, a section cited there is', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'references', 'events'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), 'uses rubric-a.md and `formats.md` § 1\n');
  fs.writeFileSync(path.join(dir, 'references', 'events.md'), 'index\n');
  fs.writeFileSync(path.join(dir, 'references', 'rubric-a.md'), 'rubric\n');
  fs.writeFileSync(path.join(dir, 'references', 'events', '01-x.md'), 'recipe\n');
  const load = loadFor(dir, { n: 1, event: 'X', file: 'events/01-x.md' }, '# F\n## 1. One\nabc\n## 2. Two\ndef\n');
  assert.ok(!load.files.has('references/rubric-a.md'));
  assert.deepEqual(load.sections, [1]);
});

test('(b) every event load is within TARGET_LF', (t) => {
  const rows = realRows();
  let max = { total: -1 };
  for (const r of rows) {
    const l = loadFor(SKILL_DIR, r, realFormats());
    if (l.total > max.total) max = { ...l, event: `${r.n} ${r.event}` };
    assert.ok(l.total <= TARGET_LF, `event ${r.n} ${r.event} over budget: ${describeLoad(l)}`);
  }
  t.diagnostic(`largest load: ${max.event} = ${max.total} bytes LF (${describeLoad(max)})`);
});

test('(c) every mention of formats.md carries a section; no load holds the whole contract', () => {
  const rows = realRows();
  const secs = formatsSections(realFormats());
  for (const r of rows) {
    const l = loadFor(SKILL_DIR, r, realFormats());
    for (const f of l.files.keys()) {
      const text = fs.readFileSync(path.join(SKILL_DIR, f), 'utf8');
      assert.deepEqual(unsectionedMentions(text, { allowFormatContractRow: f === 'SKILL.md' }), [], `${f} (event ${r.n})`);
    }
    const all = [...secs.keys()].every((n) => l.sections.includes(n));
    assert.ok(!all, `event ${r.n} loads every numbered section of formats.md`);
  }
});

test('(e) SKILL.md does not tell the reader to read events.md or formats.md whole', () => {
  const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.doesNotMatch(skill, /Read `formats\.md` before/);
  assert.doesNotMatch(skill, /read (the whole|all of|the entire) `?(events|formats)\.md/i);
});
