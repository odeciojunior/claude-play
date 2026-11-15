import { test } from 'node:test';
import assert from 'node:assert/strict';
import { truncate } from '../src/truncate.mjs';

test('truncate shortens longer text to max and ends with an ellipsis', () => {
  const out = truncate('hello world', 5);
  assert.equal(out.length, 5);
  assert.equal(out, 'hell…');
});

test('truncate keeps text of length max or shorter unchanged', () => {
  assert.equal(truncate('hello', 5), 'hello');
  assert.equal(truncate('hi', 5), 'hi');
});

test('truncate with max 1 returns only the ellipsis', () => {
  assert.equal(truncate('abc', 1), '…');
});

test('truncate does not split a surrogate pair', () => {
  assert.equal(Array.from(truncate('a😀b😀c', 3)).length, 3);
});

test('truncate throws a RangeError for a negative max', () => {
  assert.throws(() => truncate('abc', -1), RangeError);
});
