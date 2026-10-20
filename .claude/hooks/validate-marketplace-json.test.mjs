// Tests for validate-marketplace-json.mjs: every failure must block (stdout JSON, exit 0), never crash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'validate-marketplace-json.mjs');
const HOOK_INPUT = '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}';

// Writes the fixture tree to a temp dir, runs the hook, returns { code, decision, reason, stdout }.
function runHook(marketplaceText, pluginJsons = {}, stdin = HOOK_INPUT) {
  const tmp = mkdtempSync(join(tmpdir(), 'mkt-hook-'));
  try {
    mkdirSync(join(tmp, '.claude-plugin'), { recursive: true });
    writeFileSync(join(tmp, '.claude-plugin', 'marketplace.json'), marketplaceText);
    for (const [name, obj] of Object.entries(pluginJsons)) {
      const dir = join(tmp, 'plugins', name, '.claude-plugin');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'plugin.json'), JSON.stringify(obj));
    }
    const r = spawnSync(process.execPath, [HOOK], {
      input: stdin, cwd: tmp, encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmp },
    });
    const stdout = r.stdout.trim();
    const parsed = stdout ? JSON.parse(stdout) : {};
    return { code: r.status, decision: parsed.decision, reason: parsed.reason ?? '', stdout };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const entry = (over = {}) => ({
  name: 'alpha', source: './plugins/alpha', description: 'd', version: '1.0.0',
  author: { name: 'a' }, license: 'MIT', keywords: ['k'], category: 'c', ...over,
});
const market = (over = {}) => ({
  name: 'm', description: 'd', owner: { name: 'o', email: 'o@x.io' }, plugins: [entry()], ...over,
});
const plugin = (over = {}) => ({ alpha: { name: 'alpha', version: '1.0.0', ...over } });
const run = (m, p = plugin()) => runHook(JSON.stringify(m), p);

test('valid marketplace passes with no output', () => {
  const r = run(market());
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('owner as string blocks', () => {
  const r = run(market({ owner: 'bob' }));
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /owner/);
});

test('null file blocks', () => {
  const r = runHook('null');
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'block');
});

test('plugins not an array blocks', () => {
  const r = run(market({ plugins: 'nope' }));
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /plugins/);
});

test('object source blocks with a readable reason', () => {
  const r = run(market({ plugins: [entry({ source: { source: 'github', repo: 'a/b' } })] }));
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /source/);
  assert.doesNotMatch(r.reason, /\[object Object\]/);
});

test('duplicate plugin names block', () => {
  const r = run(market({ plugins: [entry(), entry()] }));
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /duplicate/i);
});

test('entry name differing from plugin.json blocks', () => {
  const r = run(market(), plugin({ name: 'other' }));
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /name/);
});

test('entry version differing from plugin.json blocks', () => {
  const r = run(market(), plugin({ version: '2.0.0' }));
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /version/);
});

test('missing plugin.json blocks', () => {
  const r = run(market(), {});
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /plugin\.json/);
});

test('invalid entry name blocks', () => {
  const r = run(market({ plugins: [entry({ name: 'Bad_Name', source: './plugins/Bad_Name' })] }), { 'Bad_Name': { name: 'Bad_Name', version: '1.0.0' } });
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /kebab|a-z/);
});

test('non-marketplace file_path produces no output', () => {
  const r = runHook('null', {}, '{"tool_input":{"file_path":"README.md"}}');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('unparseable hook input blocks', () => {
  const r = runHook(JSON.stringify(market()), plugin(), 'not json');
  assert.equal(r.code, 0);
  assert.equal(r.decision, 'block');
});
