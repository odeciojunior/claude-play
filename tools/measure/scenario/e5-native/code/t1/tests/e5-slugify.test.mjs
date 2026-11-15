import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slugify.mjs';

test('slugify strips accents and lowercases the card example', () => {
  assert.equal(slugify('Café au Lait!'), 'cafe-au-lait');
});

test('slugify collapses runs of spaces and punctuation into one hyphen', () => {
  assert.equal(slugify('a  --  b'), 'a-b');
});

test('slugify strips leading and trailing punctuation', () => {
  assert.equal(slugify('  ¡Hola, Mundo!  '), 'hola-mundo');
});

test('slugify leaves an already-slug input unchanged', () => {
  assert.equal(slugify('already-a-slug'), 'already-a-slug');
});

test('slugify returns an empty string when no ASCII letter or digit is left', () => {
  assert.equal(slugify('!!!'), '');
});
