import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), 'protect-template.mjs');

function run(stdin) {
  const r = spawnSync(process.execPath, [hook], { input: stdin, encoding: 'utf8' });
  return r.status;
}
const runInput = (toolInput) => run(JSON.stringify({ tool_input: toolInput }));

test('blocks plugins/_template/x.md', () => {
  assert.equal(runInput({ file_path: 'plugins/_template/x.md' }), 2);
});

test('blocks Windows backslash path with mixed case', () => {
  const p = path.win32.join('C:', 'repo', 'Plugins', '_Template', 'x.md');
  assert.ok(p.includes(String.fromCharCode(92)));
  assert.equal(runInput({ file_path: p }), 2);
});

test('blocks path traversal into the template', () => {
  assert.equal(runInput({ file_path: 'plugins/x/../_template/f.md' }), 2);
});

test('blocks notebook_path', () => {
  assert.equal(runInput({ notebook_path: 'plugins/_template/n.ipynb' }), 2);
});

test('allows other plugins', () => {
  assert.equal(runInput({ file_path: 'plugins/my-plugin/x.md' }), 0);
});

test('blocks on unparseable input', () => {
  assert.equal(run('not json{'), 2);
});
