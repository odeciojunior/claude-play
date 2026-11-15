import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordCount } from '../src/word-count.mjs';

test('wordCount counts a plain sentence', () => {
  assert.equal(wordCount('the quick brown fox'), 4);
});

test('wordCount handles mixed whitespace', () => {
  assert.equal(wordCount('one\ttwo\nthree   four'), 4);
});

test('wordCount is 0 for the empty string', () => {
  assert.equal(wordCount(''), 0);
});

test('wordCount is 0 for blank text', () => {
  assert.equal(wordCount('  \t\n '), 0);
});
