import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decide } from './approve-own-workflow.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const own = path.join(root, 'skills', 'roadmap-release', 'workflow', 'roadmap-release.js');
const base = (tool_input, extra = {}) => ({ hook_event_name: 'PreToolUse', tool_name: 'Workflow', permission_mode: 'default', tool_input, ...extra });
const on = { optIn: true, pluginRoot: root };
const isAllow = (r) => r?.hookSpecificOutput?.permissionDecision === 'allow';

test('approves the plugin own script by absolute path', () => {
  assert.ok(isAllow(decide(base({ scriptPath: own, args: { mode: 'dry-run' } }), on)));
});
test('no decision when the user did not opt in', () => {
  assert.equal(decide(base({ scriptPath: own }), { optIn: false, pluginRoot: root }), null);
  assert.equal(decide(base({ scriptPath: own }), { optIn: 'true', pluginRoot: root }), null);
});
test('no decision for another tool, another event, plan mode', () => {
  assert.equal(decide(base({ scriptPath: own }, { tool_name: 'Bash' }), on), null);
  assert.equal(decide(base({ scriptPath: own }, { hook_event_name: 'PostToolUse' }), on), null);
  assert.equal(decide(base({ scriptPath: own }, { permission_mode: 'plan' }), on), null);
});
test('no decision for an inline script, even with our path or name beside it', () => {
  assert.equal(decide(base({ script: 'export const meta = {}', scriptPath: own }), on), null);
  assert.equal(decide(base({ script: 'x' }), on), null);
});
test('no decision when name and scriptPath come together (scriptPath wins in the runtime)', () => {
  assert.equal(decide(base({ name: 'productivity-tools:roadmap-release', scriptPath: own }), on), null);
});
test('no decision for a named launch while OWN_NAMES is empty', () => {
  assert.equal(decide(base({ name: 'productivity-tools:roadmap-release' }), on), null);
  assert.equal(decide(base({ name: 'deep-research' }), on), null);
});
test('no decision for a look-alike path outside the plugin root', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wfhook-'));
  const fake = path.join(tmp, 'productivity-tools', '9.9.9', 'skills', 'roadmap-release', 'workflow');
  fs.mkdirSync(fake, { recursive: true });
  fs.writeFileSync(path.join(fake, 'roadmap-release.js'), 'x');
  assert.equal(decide(base({ scriptPath: path.join(fake, 'roadmap-release.js') }), on), null);
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('no decision for a relative path, a missing file, another file of the plugin, a non-string', () => {
  assert.equal(decide(base({ scriptPath: 'skills/roadmap-release/workflow/roadmap-release.js' }), on), null);
  assert.equal(decide(base({ scriptPath: path.join(root, 'nope.js') }), on), null);
  assert.equal(decide(base({ scriptPath: path.join(here, 'approve-own-workflow.mjs') }), on), null);
  assert.equal(decide(base({ scriptPath: 42 }), on), null);
  assert.equal(decide(base(null), on), null);
  assert.equal(decide(base([]), on), null);
});
test('approves through .. segments and case changes that resolve to the same file', () => {
  const dotted = path.join(root, 'hooks', '..', 'skills', 'roadmap-release', 'workflow', 'roadmap-release.js');
  assert.ok(isAllow(decide(base({ scriptPath: dotted }), on)));
  if (process.platform === 'win32') assert.ok(isAllow(decide(base({ scriptPath: own.toUpperCase() }), on)));
});
test('a junction into the plugin resolves to the real file; a file outside does not pass', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wfhook-'));
  const evil = path.join(tmp, 'evil.js');
  fs.writeFileSync(evil, 'x');
  const linkDir = path.join(tmp, 'link');
  try {
    fs.symlinkSync(path.dirname(own), linkDir, 'junction');
  } catch {
    t.skip('cannot create a junction here');
    return;
  }
  assert.ok(isAllow(decide(base({ scriptPath: path.join(linkDir, 'roadmap-release.js') }), on)));
  assert.equal(decide(base({ scriptPath: evil }), on), null);
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('CLI: prints allow only with the opt-in argument; bad stdin prints nothing; exit is always 0', () => {
  const script = path.join(here, 'approve-own-workflow.mjs');
  const run = (arg, stdin) => spawnSync(process.execPath, arg === undefined ? [script] : [script, arg], { input: stdin, encoding: 'utf8' });
  const payload = JSON.stringify(base({ scriptPath: own }));
  const yes = run('true', payload);
  assert.equal(yes.status, 0);
  assert.equal(JSON.parse(yes.stdout).hookSpecificOutput.permissionDecision, 'allow');
  for (const r of [run('false', payload), run(undefined, payload), run('${user_config.auto_approve_workflows}', payload), run('true', 'not json'), run('true', '')]) {
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  }
});
test('the environment cannot move the plugin root', () => {
  const script = path.join(here, 'approve-own-workflow.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wfhook-'));
  const fake = path.join(tmp, 'skills', 'roadmap-release', 'workflow');
  fs.mkdirSync(fake, { recursive: true });
  fs.writeFileSync(path.join(fake, 'roadmap-release.js'), 'x');
  const r = spawnSync(process.execPath, [script, 'true'], {
    input: JSON.stringify(base({ scriptPath: path.join(fake, 'roadmap-release.js') })),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: tmp },
  });
  assert.equal(r.stdout, '');
  fs.rmSync(tmp, { recursive: true, force: true });
});
