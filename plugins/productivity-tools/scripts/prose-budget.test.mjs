import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

// Provisional: completed in Task 7.
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
