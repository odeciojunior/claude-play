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

import { route } from '../lib/routing.mjs';

const ROUTING_TABLE = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'plan-tool', 'routing-table.json'), 'utf8'));

function rowTask(input) {
  const create = Array.from({ length: input.fileCount }, (_, i) => `f${i + 1}`);
  return {
    score: { ambiguity: input.ambiguity, reasoning: input.reasoning, blast: input.blast, verifiability: input.verifiability },
    files: { create, modify: [], test: [] },
    external: input.external,
  };
}

for (const row of ROUTING_TABLE.rows) {
  test(`AC3: routing table row ${row.name} (${row.source})`, () => {
    const r = route(rowTask(row.input), { hasDependents: row.input.hasDependents });
    assert.deepEqual({ tier: r.tier, effort: r.effort, reviewTier: r.reviewTier, gate: r.gate }, row.expected);
  });
}

test('route does not mutate the task', () => {
  const task = { score: { ambiguity: 0, reasoning: 0, blast: 1, verifiability: 0 }, files: { create: ['a'], modify: [], test: [] }, external: true };
  const r = route(task, { hasDependents: false });
  assert.equal(task.score.blast, 1);
  assert.equal(r.score.blast, 2);
});

test('route counts distinct files', () => {
  const task = { score: { ambiguity: 0, reasoning: 0, blast: 0, verifiability: 0 }, files: { create: ['a'], modify: [], test: ['a'] }, external: false };
  assert.equal(route(task, { hasDependents: false }).score.scope, 0);
  task.files.test = ['b'];
  assert.equal(route(task, { hasDependents: false }).score.scope, 1);
});

test('routing is pure', () => {
  const text = fs.readFileSync(path.join(HERE, '..', 'lib', 'routing.mjs'), 'utf8');
  assert.equal(checkPureSource(text, 'routing.mjs'), null);
});
