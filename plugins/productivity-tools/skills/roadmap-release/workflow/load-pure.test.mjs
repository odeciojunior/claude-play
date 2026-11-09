import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPure } from './load-pure.mjs';

function tmpScript(text) {
  const dir = mkdtempSync(join(tmpdir(), 'load-pure-'));
  const file = join(dir, 'script.js');
  writeFileSync(file, text);
  return file;
}

test('loadPure extracts top-level functions between the markers', () => {
  const file = tmpScript('const x = 1;\n// <pure>\nfunction probe(){return 1}\n// </pure>\nreturn x;\n');
  const pure = loadPure(file);
  assert.equal(typeof pure.probe, 'function');
  assert.equal(pure.probe(), 1);
});

test('loadPure fails with a clear message without markers', () => {
  const file = tmpScript('function probe(){return 1}\n');
  assert.throws(() => loadPure(file), /<pure>.*<\/pure>|markers/i);
});

test('loadPure loads the bundled script by default', () => {
  assert.equal(typeof loadPure(), 'object');
});

test('bundled script starts with `export const meta = {` as its first statement', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const text = readFileSync(join(dir, 'roadmap-release.js'), 'utf8').replace(/^﻿/, '');
  assert.match(text, /^export const meta = \{/);
  assert.match(text, /phases:\s*\[\s*\{\s*title:\s*'probe'\s*\}\s*\]/);
});
