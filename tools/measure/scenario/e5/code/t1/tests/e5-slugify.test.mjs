import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slugify.mjs';

test('slugify joins lowercase words with single hyphens', () => {
  assert.equal(slugify('Hello   World'), 'hello-world');
});

test('slugify drops punctuation and trims hyphens at the ends', () => {
  assert.equal(slugify('  Hi, there!  '), 'hi-there');
});
