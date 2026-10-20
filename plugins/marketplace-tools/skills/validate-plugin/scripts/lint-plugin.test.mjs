import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintPlugin, parseFrontmatter } from './lint-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const VALID = path.join(here, 'fixtures', 'valid');
const MARKETPLACE = path.join(here, 'fixtures', 'marketplace.json');
const SCRIPT = path.join(here, 'lint-plugin.mjs');

const created = [];
after(() => {
  for (const d of created) fs.rmSync(d, { recursive: true, force: true });
});

/** Copy the valid fixture to <tmp>/valid and return that dir. */
function fresh() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-plugin-'));
  created.push(root);
  const dir = path.join(root, 'valid');
  fs.cpSync(VALID, dir, { recursive: true });
  return dir;
}

function write(dir, rel, text) {
  const p = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
}

function lint(dir, marketplace = MARKETPLACE) {
  return lintPlugin(dir, { marketplace }).results;
}

function has(results, level, needle) {
  return results.some(
    (r) => r.level === level && `${r.check}: ${r.detail ?? ''}`.toLowerCase().includes(needle.toLowerCase()),
  );
}

function mutatePluginJson(dir, fn) {
  const p = '.claude-plugin/plugin.json';
  const j = JSON.parse(read(dir, p));
  fn(j);
  write(dir, p, JSON.stringify(j, null, 2));
}

const SKILL = (fm, body = '# Body\n') => `---\n${fm}\n---\n\n${body}`;

// ---------- baseline ----------

test('valid fixture has 0 FAIL and 0 WARN', () => {
  const r = lint(VALID);
  assert.deepEqual(r.filter((x) => x.level !== 'OK'), []);
  assert.ok(r.length > 0);
});

// ---------- check 1 ----------

test('dir name differs from plugin.json name -> FAIL', () => {
  const dir = fresh();
  mutatePluginJson(dir, (j) => { j.name = 'other'; });
  assert.ok(has(lint(dir), 'FAIL', 'directory name'));
});

test('reserved name prefix -> FAIL', () => {
  const dir = fresh();
  const renamed = path.join(path.dirname(dir), 'claude-valid');
  fs.renameSync(dir, renamed);
  mutatePluginJson(renamed, (j) => { j.name = 'claude-valid'; });
  assert.ok(has(lint(renamed), 'FAIL', 'prefix'));
});

// ---------- check 2 ----------

for (const [label, mut] of [
  ['description', (j) => { delete j.description; }],
  ['version', (j) => { delete j.version; }],
  ['author.name', (j) => { delete j.author.name; }],
  ['author.email', (j) => { delete j.author.email; }],
  ['license', (j) => { delete j.license; }],
  ['keywords', (j) => { j.keywords = []; }],
]) {
  test(`plugin.json missing ${label} -> FAIL (repo policy)`, () => {
    const dir = fresh();
    mutatePluginJson(dir, mut);
    const r = lint(dir);
    assert.ok(has(r, 'FAIL', label));
    assert.ok(has(r, 'FAIL', 'repo policy'));
  });
}

// ---------- check 3 ----------

test('no SKILL.md -> FAIL', () => {
  const dir = fresh();
  fs.rmSync(path.join(dir, 'skills'), { recursive: true });
  assert.ok(has(lint(dir), 'FAIL', 'SKILL.md'));
});

test('SKILL.md without frontmatter -> FAIL', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', '# no frontmatter\n');
  assert.ok(has(lint(dir), 'FAIL', 'frontmatter'));
});

test('SKILL.md missing name -> FAIL', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('description: Does a thing. Use when testing.'));
  assert.ok(has(lint(dir), 'FAIL', 'name'));
});

test('SKILL.md empty description -> FAIL', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription:'));
  assert.ok(has(lint(dir), 'FAIL', 'description'));
});

test('user-invokable (typo) -> FAIL', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x\nuser-invokable: true'));
  const r = lint(dir);
  assert.ok(has(r, 'FAIL', 'user-invokable'));
  assert.ok(has(r, 'FAIL', 'user-invocable'));
});

test('key outside allowlist -> WARN (repo policy)', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x\nmodel: opus'));
  const r = lint(dir);
  assert.ok(has(r, 'WARN', 'model'));
  assert.ok(has(r, 'WARN', 'repo policy'));
});

test('user-invocable: true is accepted', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x\nuser-invocable: true'));
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

test('non-boolean disable-model-invocation -> FAIL', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x\ndisable-model-invocation: yes'));
  assert.ok(has(lint(dir), 'FAIL', 'disable-model-invocation'));
});

test('non-boolean user-invocable -> FAIL', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x\nuser-invocable: maybe'));
  assert.ok(has(lint(dir), 'FAIL', 'user-invocable'));
});

test('description + when_to_use over 1,536 chars -> WARN', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL(`name: demo\ndescription: ${'a'.repeat(1000)}\nwhen_to_use: ${'b'.repeat(600)}`));
  assert.ok(has(lint(dir), 'WARN', '1,536'));
});

test('folded description (>-) is read as a value', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: >-\n  First line.\n  Second line.'));
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

// ---------- check 4 ----------

test('SKILL.md over 500 lines -> WARN', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x', 'line\n'.repeat(510)));
  assert.ok(has(lint(dir), 'WARN', '500'));
});

test('reference over 100 lines without Contents -> WARN', () => {
  const dir = fresh();
  write(dir, 'skills/demo/references/big.md', '# Big\n' + 'line\n'.repeat(110));
  assert.ok(has(lint(dir), 'WARN', 'Contents'));
});

test('reference over 100 lines with Contents -> OK', () => {
  const dir = fresh();
  write(dir, 'skills/demo/references/big.md', '# Big\n\n## Contents\n\n- a\n\n' + 'line\n'.repeat(110));
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

test('reference linking another reference -> WARN', () => {
  const dir = fresh();
  write(dir, 'skills/demo/references/a.md', 'See [b](references/b.md).\n');
  write(dir, 'skills/demo/references/b.md', 'b\n');
  assert.ok(has(lint(dir), 'WARN', 'one level deep'));
});

// ---------- check 5 ----------

test('agent without leading --- -> FAIL', () => {
  const dir = fresh();
  write(dir, 'agents/demo.md', 'name: demo\ndescription: x\n');
  assert.ok(has(lint(dir), 'FAIL', 'agents/demo.md'));
});

test('agent missing description -> FAIL', () => {
  const dir = fresh();
  write(dir, 'agents/demo.md', '---\nname: demo\n---\nbody\n');
  assert.ok(has(lint(dir), 'FAIL', 'description'));
});

test('agent name containing colon -> FAIL', () => {
  const dir = fresh();
  write(dir, 'agents/demo.md', '---\nname: ns:demo\ndescription: x\n---\nbody\n');
  assert.ok(has(lint(dir), 'FAIL', ':'));
});

for (const key of ['hooks', 'mcpServers', 'permissionMode', 'initialPrompt']) {
  test(`agent key ${key} -> FAIL (ignored for plugin agents)`, () => {
    const dir = fresh();
    write(dir, 'agents/demo.md', `---\nname: demo\ndescription: x\n${key}: foo\n---\nbody\n`);
    const r = lint(dir);
    assert.ok(has(r, 'FAIL', key));
    assert.ok(has(r, 'FAIL', 'ignored for plugin agents'));
  });
}

// ---------- check 6 ----------

test('hooks.json invalid JSON -> FAIL', () => {
  const dir = fresh();
  write(dir, 'hooks/hooks.json', '{ nope');
  assert.ok(has(lint(dir), 'FAIL', 'hooks.json'));
});

test('hooks.json without hooks object -> FAIL', () => {
  const dir = fresh();
  write(dir, 'hooks/hooks.json', '{"PreToolUse": []}');
  assert.ok(has(lint(dir), 'FAIL', 'hooks.json'));
});

test('hooks.json valid -> OK', () => {
  const dir = fresh();
  write(dir, 'hooks/hooks.json', '{"hooks": {}}');
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

test('.mcp.json invalid -> FAIL', () => {
  const dir = fresh();
  write(dir, '.mcp.json', '{ nope');
  assert.ok(has(lint(dir), 'FAIL', '.mcp.json'));
});

test('plugin-root CLAUDE.md -> WARN', () => {
  const dir = fresh();
  write(dir, 'CLAUDE.md', '# notes\n');
  assert.ok(has(lint(dir), 'WARN', 'not loaded for plugins'));
});

// ---------- check 7 ----------

test('writing into CLAUDE_PLUGIN_ROOT -> WARN', () => {
  const dir = fresh();
  write(dir, 'scripts/setup.sh', 'mkdir -p "${CLAUDE_PLUGIN_ROOT}/venv"\n');
  const r = lint(dir);
  assert.ok(has(r, 'WARN', 'CLAUDE_PLUGIN_DATA'));
});

test('redirect into CLAUDE_PLUGIN_ROOT in skills -> WARN', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x', 'echo hi > "${CLAUDE_PLUGIN_ROOT}/out.txt"\n'));
  assert.ok(has(lint(dir), 'WARN', 'CLAUDE_PLUGIN_DATA'));
});

test('reading from CLAUDE_PLUGIN_ROOT is fine', () => {
  const dir = fresh();
  write(dir, 'scripts/run.sh', 'node "${CLAUDE_PLUGIN_ROOT}/scripts/x.mjs"\n');
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

// ---------- check 8 ----------

test('missing README -> WARN', () => {
  const dir = fresh();
  fs.rmSync(path.join(dir, 'README.md'));
  assert.ok(has(lint(dir), 'WARN', 'README'));
});

test('short README -> WARN', () => {
  const dir = fresh();
  write(dir, 'README.md', 'hi');
  assert.ok(has(lint(dir), 'WARN', 'README'));
});

test('not in marketplace -> WARN', () => {
  const dir = fresh();
  const mp = path.join(path.dirname(dir), 'mp.json');
  fs.writeFileSync(mp, JSON.stringify({ name: 'm', plugins: [] }));
  assert.ok(has(lint(dir, mp), 'WARN', 'marketplace'));
});

test('marketplace version differs -> FAIL', () => {
  const dir = fresh();
  mutatePluginJson(dir, (j) => { j.version = '2.0.0'; });
  assert.ok(has(lint(dir), 'FAIL', 'version'));
});

test('marketplace entry without version -> no version FAIL', () => {
  const dir = fresh();
  const mp = path.join(path.dirname(dir), 'mp.json');
  fs.writeFileSync(mp, JSON.stringify({ name: 'm', plugins: [{ name: 'valid', source: './valid' }] }));
  assert.deepEqual(lint(dir, mp).filter((x) => x.level !== 'OK'), []);
});

// ---------- parseFrontmatter ----------

test('CRLF frontmatter parses like LF', () => {
  const dir = fresh();
  const lf = SKILL('name: demo\ndescription: >-\n  Two\n  lines.\nuser-invocable: true');
  const crlf = lf.replace(/\n/g, '\r\n');
  const a = parseFrontmatter(lf);
  const b = parseFrontmatter(crlf);
  assert.deepEqual([...b.keys], [...a.keys]);
  assert.equal(b.bodyStartLine, a.bodyStartLine);
  write(dir, 'skills/demo/SKILL.md', crlf);
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

test('parseFrontmatter returns null without leading ---', () => {
  assert.equal(parseFrontmatter('name: x\n---\n'), null);
  assert.equal(parseFrontmatter(''), null);
  assert.equal(parseFrontmatter('---\nname: x\n'), null);
});

test('parseFrontmatter reads keys, continuations and body line', () => {
  const fm = parseFrontmatter('---\nname: a\ndescription: |\n  one\n  two\nk-1: v\n---\nbody\n');
  assert.equal(fm.keys.get('name'), 'a');
  assert.match(fm.keys.get('description'), /one/);
  assert.match(fm.keys.get('description'), /two/);
  assert.equal(fm.keys.get('k-1'), 'v');
  assert.equal(fm.bodyStartLine, 8);
});

// ---------- CLI ----------

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

test('CLI exit 0 on valid fixture with output format', () => {
  const r = run([VALID, '--marketplace', MARKETPLACE]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^\[OK\]   /m);
  assert.match(r.stdout, /^Result: \d+ OK, 0 WARN, 0 FAIL$/m);
});

test('CLI exit 1 on FAIL', () => {
  const dir = fresh();
  mutatePluginJson(dir, (j) => { delete j.license; });
  const r = run([dir, '--marketplace', MARKETPLACE]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^\[FAIL\] /m);
});

test('CLI exit 0 with only WARN', () => {
  const dir = fresh();
  write(dir, 'CLAUDE.md', '# x\n');
  const r = run([dir, '--marketplace', MARKETPLACE]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^\[WARN\] /m);
});

test('CLI exit 2 on usage error', () => {
  assert.equal(run([]).status, 2);
  assert.equal(run([path.join(os.tmpdir(), 'does-not-exist-lint')]).status, 2);
});

// ---------- fix-up round 1 ----------

test('plugin.json containing null -> FAIL (top-level must be an object)', () => {
  const dir = fresh();
  write(dir, '.claude-plugin/plugin.json', 'null');
  assert.ok(has(lint(dir), 'FAIL', 'top-level must be an object'));
  assert.equal(run([dir, '--marketplace', MARKETPLACE]).status, 1);
});

test('plugin.json containing an array -> FAIL', () => {
  const dir = fresh();
  write(dir, '.claude-plugin/plugin.json', '[]');
  assert.ok(has(lint(dir), 'FAIL', 'top-level must be an object'));
});

test('frontmatter tolerates BOM and trailing whitespace on delimiters', () => {
  const text = '﻿---  \nname: demo\ndescription: b\n---\t\nbody\n';
  const fm = parseFrontmatter(text);
  assert.ok(fm);
  assert.equal(fm.keys.get('name'), 'demo');
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', text);
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

test('inline # comments are stripped from unquoted values', () => {
  const fm = parseFrontmatter('---\nname: a # trailing\ndescription: "keep # this"\n---\n');
  assert.equal(fm.keys.get('name'), 'a');
  assert.equal(fm.keys.get('description'), 'keep # this');
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x\nuser-invocable: true # shown in menu'));
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

test('booleans are case-insensitive', () => {
  const dir = fresh();
  write(dir, 'skills/demo/SKILL.md', SKILL('name: demo\ndescription: x\nuser-invocable: True\ndisable-model-invocation: FALSE'));
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

test('cp reading from CLAUDE_PLUGIN_ROOT does not warn', () => {
  const dir = fresh();
  write(dir, 'scripts/copy.sh', 'cp "${CLAUDE_PLUGIN_ROOT}/x" ./docs/\n');
  assert.deepEqual(lint(dir).filter((x) => x.level !== 'OK'), []);
});

test('cp into CLAUDE_PLUGIN_ROOT warns', () => {
  const dir = fresh();
  write(dir, 'scripts/copy.sh', 'cp ./a.txt "${CLAUDE_PLUGIN_ROOT}/a.txt"\n');
  assert.ok(has(lint(dir), 'WARN', 'CLAUDE_PLUGIN_DATA'));
});

test('writes under hooks/ are scanned', () => {
  const dir = fresh();
  write(dir, 'hooks/setup.sh', 'echo x > "${CLAUDE_PLUGIN_ROOT}/state"\n');
  assert.ok(has(lint(dir), 'WARN', 'hooks/setup.sh'));
});

test('CLI runs when invoked through a symlink/junction', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-link-'));
  created.push(root);
  const link = path.join(root, 'linked');
  try {
    fs.symlinkSync(here, link, 'junction');
  } catch {
    t.skip('cannot create symlink/junction');
    return;
  }
  const r = spawnSync(process.execPath, [path.join(link, 'lint-plugin.mjs'), VALID, '--marketplace', MARKETPLACE], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^Result: /m);
});
