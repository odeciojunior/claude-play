// N5-1 / N5-2: wording of the plan-writer adoption step 3 and the plan-author adopt step 4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = join(dirname(fileURLToPath(import.meta.url)), 'SKILL.md');
const AGENT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'agents', 'plan-author.md');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function step3() {
  const text = read(SKILL);
  const start = text.indexOf('  3. First run `node "<planTool>" check');
  assert.ok(start >= 0, 'sem passo 3 da adocao');
  const end = text.indexOf('\n  4.', start);
  assert.ok(end > start, 'sem passo 4 depois do 3');
  return text.slice(start, end);
}

function authorStep4() {
  const line = read(AGENT).split('\n').find((l) => l.startsWith('4. In `adopt` mode'));
  assert.ok(line, 'sem passo 4 de adocao');
  return line;
}

test('plan-writer step 3 pastes the approval blocks literally', () => {
  const s = step3();
  assert.match(s, /paste/);
  assert.match(s, /literally/);
  assert.ok(s.includes('## Adoção'));
  assert.ok(s.includes('--stat'));
  assert.ok(s.includes('summary'));
  assert.match(s, /do not summarize/);
});

test('plan-writer step 3 keeps the 200-line stat rule', () => {
  const s = step3();
  assert.ok(s.includes('200'));
  assert.ok(s.includes('--stat'));
  assert.ok(s.includes('git diff --no-index -- "<original>" "<provisional>"'));
});

test('plan-author step 4 marks "added" or "derived"', () => {
  const s = authorStep4();
  assert.ok(s.includes('"added" or "derived"'));
  assert.ok(s.includes('never "kept"'));
  assert.match(s, /deps, score, effort/);
  assert.match(s, /shortened title/);
  assert.ok(s.includes('Test reference'));
  assert.match(s, /own row/);
});

test('plan-writer keeps APPROVAL QUESTION fallback', () => {
  assert.ok(read(SKILL).includes('APPROVAL QUESTION:'));
});

test('E32: plan-author step 7 describes the lean emit', () => {
  const line = read(AGENT).split('\n').find((l) => l.startsWith('7. Your last message'));
  assert.ok(line, 'sem passo 7 do autor');
  assert.ok(line.includes('{tool, schema, path, source, plan, digest}'));
  assert.ok(!line.includes('path, data}'));
});
