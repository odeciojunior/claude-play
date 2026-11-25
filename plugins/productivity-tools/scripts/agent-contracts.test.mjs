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
    'When the `CAPTURE:` line carries `--brief`, the printed line has no `tail`: to see the output, read the file at its `path` (no pipe); copy the line as printed either way.',
    'identical between the red round and the green round',
    'literal JSON line',
    '`path`, `sha256` and `exit`',
    '(DEC-026)',
    '`tail`, `head` or `grep` stays forbidden',
    'Without the `CAPTURE:` line the current rule applies',
  ]) assert.ok(s.includes(p), p);
});

test('implementer Report: with a CAPTURE line, output is the printed capture line, not the file content (DEC-056)', () => {
  const t = read('implementer.md');
  const s = t.slice(t.indexOf('## Report'));
  assert.ok(s.includes('With a `CAPTURE:` line in the prompt, `output` of each check is the JSON line the capture printed, copied whole, not the content of the file it points to.'));
});

test('reviewers never read a range diff or log from one Bash output and read the file by offset/limit', () => {
  for (const n of ['task-reviewer.md', 'final-reviewer.md']) {
    const t = read(n);
    assert.ok(t.includes('never read in a single Bash output'), n);
    assert.ok(t.includes('pt-evidence/review/'), n);
    assert.ok(t.includes('git rev-parse --absolute-git-dir'), n);
    assert.ok(t.includes('review-package.mjs'), n);
    assert.ok(t.includes('`path`, `sha256` and `lines`'), n);
    assert.ok(t.includes('Read` with `offset`/`limit` of up to 400 lines'), n);
    assert.ok(t.includes('cite the path and the sha256'), n);
  }
  assert.match(read('task-reviewer.md'), /`restricted` mode keeps reading the package/);
});

test('spec-author and plan-author declare removedTests as { file, name, why, gate? }', () => {
  for (const n of ['spec-author.md', 'plan-author.md']) {
    const t = read(n);
    assert.match(t, /removedTests/, n);
    assert.ok(t.includes('`{ file, name, why, gate? }`'), n);
  }
});

test('spec-author and plan-author never search the plugin folder and edit only with Edit or Write (DEC-052)', () => {
  for (const n of ['spec-author.md', 'plan-author.md']) {
    const t = read(n);
    const [tool, v] = n === 'spec-author.md' ? ['spec', 'specTool'] : ['plan', 'planTool'];
    assert.ok(t.includes(`The plugin folder is the one two levels above \`${v}\`. Never Grep, Glob or Read anything in it except the format example`), n);
    assert.ok(t.includes(`\`${v}\` itself is only run, never read or Grepped`), n);
    assert.ok(t.includes(`The ${tool}/1 format comes only from this file, that example`), n);
    assert.doesNotMatch(t, /lib\/routing\.mjs/, n);
    assert.ok(t.includes('Edit only with Edit or Write, never with `sed -i`'), n);
  }
});

test('script-runner runs once and returns the wrapper line, never the inner output (DEC-052)', () => {
  const t = read('script-runner.md');
  assert.ok(t.includes('one Bash call in total, never a second run'));
  assert.ok(t.includes("Whatever output the prompt asks for, when the command is a wrapper"));
  assert.ok(t.includes("the stdout you return is the wrapper's line that the Bash result shows, never the inner command's output"));
  assert.ok(t.includes('files it may change), except the wrapper rule below.'));
  assert.ok(t.includes('Set the Bash `timeout` to 600000'));
});

test('no agent file writes the copy limit as a bare digit run or the forbidden word', () => {
  for (const n of names) {
    const t = read(n);
    assert.doesNotMatch(t, /\b3500\b/, n);
    assert.doesNotMatch(t, /superpowers/i, n);
  }
});
