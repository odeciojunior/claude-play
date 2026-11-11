// Sentinel P3: seeds one flaw in the E5 plan and tells whether it is present at a git ref.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'P3';
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
  const text = readPlan(dir);
  const a = section(text, 1) ?? fail();
  const c = section(text, 3) ?? fail();
  const retitle = (b, n) => b.replace(/^### Task \d+: /, '### Task ' + n + ': ');
  writePlan(dir, text.slice(0, a.start) + retitle(c.body, 1) + text.slice(a.end, c.start) + retitle(a.body, 3) + text.slice(c.end));
}

export function present(dir, ref = 'HEAD') {
  const text = showPlan(dir, ref);
  const i = text.indexOf('- Create: `src/index.mjs`');
  const s = text.indexOf('- Create: `src/slugify.mjs`');
  return i >= 0 && s >= 0 && i < s;
}
