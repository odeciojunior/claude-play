// Sentinel PX3: seeds one flaw in the E5 plan and tells whether it is present at a git ref.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'PX3';
const FILE = 'docs/superpowers/plans/2026-11-10-E5-text-utilities.md';
const lf = (s) => s.replace(/\r\n/g, '\n');
const readPlan = (dir) => lf(readFileSync(join(dir, FILE), 'utf8'));
const showPlan = (dir, ref) => lf(execFileSync('git', ['show', ref + ':' + FILE], { cwd: dir, encoding: 'utf8' }));
const writePlan = (dir, text) => writeFileSync(join(dir, FILE), text);
const fail = () => { throw new Error(ID + ': anchor not found'); };

// Text of "### Task n" up to the next task or the evidence section.
function section(text, n) {
  const m = new RegExp('^### Task ' + n + ': [\\s\\S]*?(?=^### Task |^## Acceptance criteria evidence)', 'm').exec(text);
  return m ? { start: m.index, end: m.index + m[0].length, body: m[0] } : null;
}
function replaceSection(text, n, fn) {
  const s = section(text, n) ?? fail();
  return text.slice(0, s.start) + fn(s.body) + text.slice(s.end);
}
function replaceOnce(text, from, to) {
  if (!text.includes(from)) fail();
  return text.replace(from, () => to);
}

export function seed(dir) {
  const lines = readPlan(dir).split('\n');
  const i = lines.findIndex((l) => l.startsWith('| AC2 |'));
  if (i < 0 || !lines[i].includes('node --test tests/e5-truncate.test.mjs')) fail();
  lines[i] = lines[i].replace('node --test tests/e5-truncate.test.mjs', 'node --test tests/e5-truncate-extra.test.mjs');
  writePlan(dir, lines.join('\n'));
}

export function present(dir, ref = 'HEAD') {
  const row = showPlan(dir, ref).split('\n').find((l) => l.startsWith('| AC2 |'));
  return !!row && !row.includes('node --test tests/e5-truncate.test.mjs');
}
