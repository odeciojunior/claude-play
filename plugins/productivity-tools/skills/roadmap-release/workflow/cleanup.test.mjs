import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WF = new URL('./roadmap-release.js', import.meta.url);

test('E32: the cleanup prompt ends processes through verify-run procs', () => {
  const text = readFileSync(WF, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n').filter((l) => l.includes('CLEANUP of deliverable'));
  assert.equal(lines.length, 1);
  const line = lines[0];
  for (const part of [
    'node "${VERIFY_RUN}" procs ${encArg({',
    'wt',
    'ports: [port, port + 9]',
    'nonce: `${RUN_TAG}:${E}:procs`',
    'leftovers',
    'failed',
    'unchecked',
    'worktree remove --force',
    '-dirty',
    'diff --binary HEAD',
  ]) assert.ok(line.includes(part), `missing: ${part}`);
  assert.ok(!line.includes('end processes whose command contains'));
});
