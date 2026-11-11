import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPureSource } from './embed.mjs';
import { canon, fnv1a, planDigest } from '../lib/plan-digest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('fnv1a matches the release fingerprint algorithm', () => {
  assert.equal(fnv1a(''), '811c9dc5');
  assert.equal(fnv1a('a'), 'e40c292c');
});

test('canon sorts keys recursively', () => {
  assert.equal(JSON.stringify(canon({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 0 } })), '{"a":{"c":0,"d":[{"x":2,"y":1}]},"b":1}');
});

test('planDigest ignores key order', () => {
  const a = planDigest({ plan: { a: 1, b: 2 }, source: { path: 'p', textDigest: '0' } });
  const b = planDigest({ source: { textDigest: '0', path: 'p' }, plan: { b: 2, a: 1 } });
  assert.equal(a, b);
  assert.notEqual(a, planDigest({ plan: { a: 3, b: 2 }, source: { path: 'p', textDigest: '0' } }));
});

test('plan-digest is pure', () => {
  const text = fs.readFileSync(path.join(HERE, '..', 'lib', 'plan-digest.mjs'), 'utf8');
  assert.equal(checkPureSource(text, 'plan-digest.mjs'), null);
});
