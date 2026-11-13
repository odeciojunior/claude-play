import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const lf = (s) => s.replace(/\r\n/g, '\n');
const bytes = (s) => Buffer.byteLength(s, 'utf8');

// Derived target (R9): measured baseline minus what moved into the workflow.
const BASELINE = 56508;
const REMOVED = 50508;
const TARGET = 6000;
const BOUNDARY = '## After the workflow returns';

test('the launch section names every required workflow arg', () => {
  const skill = lf(readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8'));
  const m = skill.match(/\{ plan, state, runToken, [^}]*\}/);
  assert.ok(m, 'SKILL.md lacks the args list');
  for (const k of ['plan', 'state', 'runToken', 'progress']) {
    assert.ok(new RegExp(`\\b${k}\\b`).test(m[0]), `args list lacks ${k}`);
  }
  assert.ok(skill.includes('scripts/progress.mjs'), 'SKILL.md does not say where progress comes from');
});

test('AC4: prose loaded before the launch stays within the derived target', () => {
  assert.equal(TARGET, BASELINE - REMOVED);
  const skill = lf(readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8'));
  const at = skill.split('\n').indexOf(BOUNDARY);
  assert.ok(at >= 0, `SKILL.md lacks the line "${BOUNDARY}"`);
  const before = skill.split('\n').slice(0, at).join('\n');
  const cited = [...new Set([...before.matchAll(/references\/([A-Za-z0-9._-]+\.md)/g)].map((m) => m[1]))];
  let total = bytes(skill);
  for (const name of cited) {
    const file = join(SKILL_DIR, 'references', name);
    assert.ok(existsSync(file), `cited reference does not exist: ${name}`);
    total += bytes(lf(readFileSync(file, 'utf8')));
  }
  assert.ok(total <= TARGET, `prose before the launch is ${total} bytes LF, target ${TARGET}`);
});
