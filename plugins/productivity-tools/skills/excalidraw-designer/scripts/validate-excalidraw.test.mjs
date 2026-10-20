import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateExcalidraw } from './validate-excalidraw.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'validate-excalidraw.mjs');
const example = path.join(here, '..', 'references', 'example-3-node.md');

function loadExample() {
  const md = fs.readFileSync(example, 'utf8');
  const m = md.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  return JSON.parse(m[1]);
}

const find = (doc, id) => doc.elements.find((e) => e.id === id);

test('valid 3-node example passes', () => {
  assert.deepEqual(validateExcalidraw(loadExample()), []);
});

test('duplicate id is reported', () => {
  const doc = loadExample();
  find(doc, 'text-db').id = 'rect-db';
  assert.ok(validateExcalidraw(doc).some((p) => /duplicate id/.test(p) && p.includes('rect-db')));
});

test('duplicate seed is reported', () => {
  const doc = loadExample();
  find(doc, 'rect-db').seed = 1001;
  assert.ok(validateExcalidraw(doc).some((p) => /duplicate seed/.test(p) && p.includes('1001')));
});

test('binding to a missing element is reported', () => {
  const doc = loadExample();
  find(doc, 'arrow-api-db').endBinding.elementId = 'ghost';
  assert.ok(validateExcalidraw(doc).some((p) => /missing element/.test(p) && p.includes('ghost')));
});

test('binding not mirrored in boundElements is reported', () => {
  const doc = loadExample();
  find(doc, 'rect-db').boundElements = [{ id: 'text-db', type: 'text' }];
  assert.ok(validateExcalidraw(doc).some((p) => /boundElements/.test(p) && p.includes('rect-db')));
});

test('boundElements entry with wrong type is reported', () => {
  const doc = loadExample();
  find(doc, 'rect-db').boundElements[1].type = 'text';
  assert.ok(validateExcalidraw(doc).some((p) => /boundElements/.test(p)));
});

test('text containerId pointing to a missing element is reported', () => {
  const doc = loadExample();
  find(doc, 'text-db').containerId = 'nope';
  assert.ok(validateExcalidraw(doc).some((p) => /containerId/.test(p) && p.includes('nope')));
});

test('container that does not list its text is reported', () => {
  const doc = loadExample();
  find(doc, 'rect-db').boundElements = [{ id: 'arrow-api-db', type: 'arrow' }];
  assert.ok(validateExcalidraw(doc).some((p) => /containerId|boundElements/.test(p) && p.includes('text-db')));
});

test('deleted elements are ignored', () => {
  const doc = loadExample();
  const dup = structuredClone(find(doc, 'rect-db'));
  dup.isDeleted = true;
  doc.elements.push(dup);
  const ghost = structuredClone(find(doc, 'arrow-api-db'));
  ghost.id = 'arrow-dead';
  ghost.seed = 9999;
  ghost.isDeleted = true;
  ghost.endBinding.elementId = 'ghost';
  doc.elements.push(ghost);
  assert.deepEqual(validateExcalidraw(doc), []);
});

test('CLI: ok, problems, invalid JSON and usage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exc-'));
  const good = path.join(dir, 'good.excalidraw');
  fs.writeFileSync(good, JSON.stringify(loadExample()));
  let r = spawnSync(process.execPath, [script, good], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'OK');

  const bad = loadExample();
  find(bad, 'text-db').containerId = 'nope';
  const badFile = path.join(dir, 'bad.excalidraw');
  fs.writeFileSync(badFile, JSON.stringify(bad));
  r = spawnSync(process.execPath, [script, badFile], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /containerId/);

  const junk = path.join(dir, 'junk.excalidraw');
  fs.writeFileSync(junk, '{ not json');
  r = spawnSync(process.execPath, [script, junk], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /invalid JSON/);

  r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});
