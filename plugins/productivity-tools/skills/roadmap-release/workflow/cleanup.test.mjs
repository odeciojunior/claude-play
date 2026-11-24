import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WF = new URL('./roadmap-release.js', import.meta.url);

test('E32: the cleanup prompt ends processes through verify-run procs', () => {
  const text = readFileSync(WF, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.includes('CLEANUP of deliverable'));
  assert.equal(lines.filter((l) => l.includes('CLEANUP of deliverable')).length, 1);
  const line = lines[at];
  // the whole call, literally: the nonce, the worktree and the port range of the deliverable, in this order
  assert.ok(line.includes('run once: node "${VERIFY_RUN}" procs ${encArg({ nonce: `${RUN_TAG}:${E}:procs`, wt, ports: [port, port + 9] })} and put in leftovers each pid of its failed and each item of its unchecked;'), line);
  for (const part of ['worktree remove --force', '-dirty', 'diff --binary HEAD']) assert.ok(line.includes(part), `missing: ${part}`);
  assert.ok(!line.includes('end processes whose command contains'));
  // leftovers reach the concerns even when the cleanup agent answers ok: true
  const check = lines.slice(at, at + 4).find((l) => l.includes('incomplete cleanup'));
  assert.ok(check, 'the incomplete-cleanup concern follows the cleanup call');
  assert.ok(check.includes('if (!cl || !cl.ok || (cl.leftovers || []).length) out.concerns.push(`incomplete cleanup: '), check);
});

test('E41 T3: after the CLEANUP call a script-runner call prunes the capture evidence of the deliverable', () => {
  const text = readFileSync(WF, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.includes('CLEANUP of deliverable'));
  const check = lines.findIndex((l, i) => i > at && l.includes('incomplete cleanup'));
  assert.ok(check > at);
  const rest = lines.slice(check + 1, check + 6).join('\n');
  assert.ok(rest.includes('capture.mjs" prune --task-prefix '), rest);
  assert.ok(rest.includes('--task-prefix ${shq(`${E}-`)}'), 'the prefix is <E>- so E4 never prunes E40');
  assert.ok(rest.includes('--cwd ${shq(INTWT)}'), 'run in the integration worktree');
  assert.ok(rest.includes("agentType: 'productivity-tools:script-runner'"));
  assert.ok(rest.includes('out.concerns.push('), 'a failure only reaches the concerns');
  assert.ok(!/return fail\(/.test(rest.split('log(`${E}: merged')[0]), 'a failed prune never fails the deliverable');
});
