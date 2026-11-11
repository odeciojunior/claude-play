import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordCount } from '../src/word-count.mjs';

test('wordCount counts whitespace-separated words', () => {
  assert.equal(wordCount('the quick fox'), 3);
});

test('wordCount is 0 for empty text', () => {
  assert.equal(wordCount(''), 0);
});
