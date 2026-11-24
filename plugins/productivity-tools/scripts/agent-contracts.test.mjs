import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (n) => readFileSync(join(here, '..', 'agents', n), 'utf8').replace(/\r\n/g, '\n');
const names = ['script-runner.md', 'test-integrity.md', 'implementer.md'];

test('script-runner copies only the printed JSON line and treats a line over 3,500 bytes as a command error', () => {
  const t = read('script-runner.md');
  assert.match(t, /copy only the JSON line/i);
  assert.match(t, /3,500 bytes/);
  assert.match(t, /error of the command, not of the agent/);
  assert.ok(t.includes('after the Bash result has arrived'));
  assert.ok(t.includes('never in the same message as the Bash call'));
  assert.ok(t.includes('never a placeholder'));
  assert.doesNotMatch(t.match(/^---\n([\s\S]*?)\n---\n/)[1], /^model:/m);
});

test('test-integrity answers removedAsserts=-1 when the printed JSON does not arrive whole', () => {
  const t = read('test-integrity.md');
  assert.match(t, /does not arrive whole[^\n]*`removedAsserts=-1`[^\n]*never a partial copy/);
});

test('implementer has a CAPTURE section with the capture.mjs contract', () => {
  const t = read('implementer.md');
  const at = t.indexOf('## CAPTURE');
  assert.ok(at > 0);
  const rest = t.slice(at + 3);
  const s = t.slice(at, rest.includes('\n## ') ? at + 3 + rest.indexOf('\n## ') : undefined);
  for (const p of [
    '`CAPTURE:`',
    'node <capture> run --nonce <prefix><k> --task <id> -- <command>',
    'increasing `<k>`',
    '--bash "<command>"',
    'identical between the red round and the green round',
    'literal JSON line',
    '`path`, `sha256` and `exit`',
    '(DEC-026)',
    '`tail`, `head` or `grep` stays forbidden',
    'Without the `CAPTURE:` line the current rule applies',
  ]) assert.ok(s.includes(p), p);
});

test('no agent file writes the copy limit as a bare digit run or the forbidden word', () => {
  for (const n of names) {
    const t = read(n);
    assert.doesNotMatch(t, /\b3500\b/, n);
    assert.doesNotMatch(t, /superpowers/i, n);
  }
});
