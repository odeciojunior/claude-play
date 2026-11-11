import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPureSource } from './embed.mjs';
import { findDataBlocks, readDataBlock, replaceDataBlock } from '../lib/data-block.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(HERE, '..', 'lib', 'data-block.mjs');
const dirs = [];
export function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-tool-'));
  dirs.push(d);
  return d;
}
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

const F = '```';

test('reader: no block -> data-block-missing', () => {
  assert.equal(readDataBlock('# t\n').error.code, 'data-block-missing');
});

test('reader: one block parses JSON and returns prose without it', () => {
  const r = readDataBlock(`# T\n\n${F}json data\n{"a":1}\n${F}\n\nfim\n`);
  assert.deepEqual(r.data, { a: 1 });
  assert.equal(r.line, 3);
  assert.equal(r.error, null);
  assert.ok(r.prose.includes('# T') && r.prose.includes('fim'));
  assert.ok(!r.prose.includes('"a"'));
});

test('reader: two blocks -> data-block-multiple citing both lines', () => {
  const t = `${F}json data\n{}\n${F}\n\n${F}json data\n{}\n${F}\n`;
  const r = readDataBlock(t);
  assert.equal(r.error.code, 'data-block-multiple');
  assert.match(r.error.message, /1/);
  assert.match(r.error.message, /5/);
});

test('reader: block nested in a longer fence is ignored', () => {
  const nested = `\`\`\`\`markdown\n${F}json data\n{"x":1}\n${F}\n\`\`\`\`\n`;
  const top = `${F}json data\n{"a":1}\n${F}\n`;
  const both = findDataBlocks(nested + '\n' + top);
  assert.equal(both.length, 1);
  assert.equal(both[0].line, 7);
  assert.equal(readDataBlock(nested + '\n' + top).error, null);
  assert.equal(readDataBlock(nested).error.code, 'data-block-missing');
});

test('reader: info "json" alone is not a data block', () => {
  assert.equal(readDataBlock(`${F}json\n{"a":1}\n${F}\n`).error.code, 'data-block-missing');
});

test('reader: tilde fence works', () => {
  assert.deepEqual(readDataBlock('~~~json data\n{"a":1}\n~~~\n').data, { a: 1 });
});

test('reader: unclosed fence is not a data block', () => {
  assert.equal(readDataBlock(`${F}json data\n{"a":1}\n`).error.code, 'data-block-missing');
});

test('reader: CRLF and BOM', () => {
  const r = readDataBlock(`\uFEFF# T\r\n\r\n${F}json data\r\n{"a":1}\r\n${F}\r\n`);
  assert.deepEqual(r.data, { a: 1 });
  assert.equal(r.error, null);
});

test('reader: invalid JSON -> data-block-json with parser message', () => {
  const r = readDataBlock(`${F}json data\n{a:\n${F}\n`);
  assert.equal(r.error.code, 'data-block-json');
  assert.ok(r.error.message.length > 0);
});

test('replaceDataBlock keeps prose and rewrites body', () => {
  const t = `# T\n\nantes\n\n${F}json data\n{"a":1}\n${F}\n\ndepois\n`;
  const out = replaceDataBlock(t, { b: [2] });
  assert.deepEqual(readDataBlock(out).data, { b: [2] });
  assert.equal(readDataBlock(out).prose, readDataBlock(t).prose);
  assert.ok(out.startsWith('# T\n\nantes\n\n') && out.endsWith('\n\ndepois\n'));
  assert.throws(() => replaceDataBlock('# t\n', {}));
});

test('lib/data-block.mjs is pure source', () => {
  assert.equal(checkPureSource(fs.readFileSync(LIB, 'utf8'), 'data-block.mjs'), null);
});
