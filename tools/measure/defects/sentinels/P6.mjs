// Sentinel P6: seeds one flaw in the E5 plan and tells whether it is present at a git ref.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ID = 'P6';
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

const LOCK = /(\*\*)?needsLock:(\*\*)? sandbox-port(?: \([^)]*\))?/;

export function seed(dir) {
  const text = readPlan(dir);
  const tasks = [...text.matchAll(/^### Task \d+: [\s\S]*?(?=^### Task |^## |(?![\s\S]))/gm)];
  const t = tasks.find((m) => LOCK.test(m[0])) ?? fail();
  const locked = t[0].replace(LOCK, (_, b1 = '', b2 = '') => b1 + 'needsLock:' + b2 + ' none');
  const plan = text.slice(0, t.index) + locked + text.slice(t.index + t[0].length);
  // Step headings lose the parenthetical that names the lock; every other line that names it goes.
  const kept = [];
  let afterDrop = false;
  for (const line of plan.split('\n')) {
    const l = /^- \[[ x]\] \*\*Step/.test(line) ? line.replace(/ ?\([^)]*sandbox-port[^)]*\)/, '') : line;
    if (l.includes('sandbox-port')) { afterDrop = true; continue; }
    // A deleted line leaves no double blank line behind.
    if (afterDrop && l === '' && kept[kept.length - 1] === '') { afterDrop = false; continue; }
    afterDrop = false;
    kept.push(l);
  }
  writePlan(dir, kept.join('\n'));
}

export function present(dir, ref = 'HEAD') {
  return !showPlan(dir, ref).includes('sandbox-port');
}
