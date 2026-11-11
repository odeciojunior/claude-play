import { test } from 'node:test';
import assert from 'node:assert/strict';
import { truncate } from '../src/truncate.mjs';

test('truncate shortens long text and ends with an ellipsis', () => {
  const out = truncate('abcdefghij', 5);
  assert.ok(out.length <= 5);
  assert.ok(out.endsWith('…'));
});

test('truncate keeps short text unchanged', () => {
  assert.equal(truncate('abc', 10), 'abc');
});

test('truncate throws a RangeError for a negative max', () => {
  assert.throws(() => truncate('abc', -1), RangeError);
});
