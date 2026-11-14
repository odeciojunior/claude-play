# E5 -- Text utilities

## Intent

Satisfy REQ-005: text can be turned into ASCII slugs, truncated and counted in words. The card asks for three small pure functions, each in its own module under `src/` with its own test file under `tests/`, following the existing project convention (plain Node ESM, named exports, no dependencies, `node --test`). DEC-002 (in force) settles that the utilities are pure: no I/O and no dependencies.

## Scope

In:

- `src/slugify.mjs` exporting `slugify(text)`, tested by `tests/e5-slugify.test.mjs`.
- `src/truncate.mjs` exporting `truncate(text, max)`, tested by `tests/e5-truncate.test.mjs`.
- `src/word-count.mjs` exporting `wordCount(text)`, tested by `tests/e5-word-count.test.mjs`.

Out:

- Any change to `src/greet.mjs`, `tests/baseline.test.mjs`, `package.json` or the gate G1.
- Any edit to `docs/plans/roadmap-sandbox/` (delivery branches never touch the roadmap folder).
- Locale-specific transliteration (for example German "ß" to "ss"), word-boundary-aware truncation, and type coercion of non-string input.

What not to do:

- No I/O, logging, caching or dependency of any kind in the three modules (DEC-002).
- Do not add a `package.json` script, a barrel/index module or a default export.
- Do not assert in the truncate test that `max` = 0 throws; the card says the test asserts the throw only for a negative `max` such as -1.

## Design

Criterion 1 (slugify). `src/slugify.mjs` exports `slugify(text)`: `String(text).normalize('NFD')`, remove combining marks (`/[̀-ͯ]/g`), lowercase, replace every run of characters outside `[a-z0-9]` with a single `-`, then strip leading and trailing hyphens. `slugify('Café au Lait!')` is therefore `'cafe-au-lait'`. Characters with no ASCII decomposition are dropped (ruling R1); text with no ASCII letter or digit returns `''`. `tests/e5-slugify.test.mjs` covers the card example, multiple spaces and punctuation collapsing to one hyphen, leading/trailing punctuation, and an already-slug input.

Criterion 2 (truncate). `src/truncate.mjs` exports `truncate(text, max)`. If `max < 1` (or is not a number, e.g. `NaN`), it throws `RangeError`. Length is measured in Unicode code points via `Array.from(text)` so a surrogate pair is never split (ruling R2). If the code-point length is at most `max`, the text comes back unchanged; otherwise the first `max - 1` code points plus `'…'` (U+2026, one character) come back, so the result is exactly `max` characters long and ends with `'…'`; `truncate('abc', 1)` is `'…'`. `tests/e5-truncate.test.mjs` covers longer text (length equals `max`, ends with `'…'`), text of length exactly `max` and shorter (unchanged), and `assert.throws(() => truncate('abc', -1), RangeError)`; it does not assert anything for `max` = 0.

Criterion 3 (wordCount). `src/word-count.mjs` exports `wordCount(text)`: `const t = String(text).trim(); return t === '' ? 0 : t.split(/\s+/).length;`. `\s` in JavaScript covers spaces, tabs, newlines and Unicode whitespace, which matches "whitespace-separated". `tests/e5-word-count.test.mjs` covers a plain sentence, mixed whitespace (tabs, newlines, repeated spaces), the empty string and a blank string (both 0).

All three modules are named-export ESM files with no imports, consistent with `src/greet.mjs`. The gate G1 (`node --test`) picks up the three new test files automatically alongside `tests/baseline.test.mjs`; the baseline (2 passing) must stay green.

## Left for the plan

- Task split (one task per piece is natural; the pieces are independent) and test-first ordering.
- Exact test case wording and any extra edge cases beyond those listed above.
- G1 needs the `sandbox-port` lock because of the baseline test; the per-criterion evidence commands run only the E5 test files.

```json data
{
  "schema": "spec/1",
  "id": "E5",
  "mode": "unattended",
  "title": "Text utilities",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Given text with spaces, punctuation and accented letters, when slugify is called, then lowercase ASCII words joined by single hyphens come back (slugify('Café au Lait!') is 'cafe-au-lait'). {verify: test; evidence: node --test tests/e5-slugify.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Given text longer than max, when truncate is called, then at most max characters come back, ending with '…'; text of length max or less comes back unchanged; max below 1 throws a RangeError (the card test asserts the throw only for a negative max such as -1, never for 0). {verify: test; evidence: node --test tests/e5-truncate.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Given text, when wordCount is called, then the number of whitespace-separated words comes back, and 0 for empty or blank text. {verify: test; evidence: node --test tests/e5-word-count.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "How does slugify turn non-ASCII letters into ASCII?",
      "decision": "slugify uses NFD normalization and removes combining marks, then drops every remaining non [a-z0-9] character; letters without an ASCII decomposition are dropped rather than transliterated.",
      "alternative": "A hand-written transliteration table (e.g. ß to ss, æ to ae).",
      "basis": "The card only requires accented letters to become ASCII; NFD covers that with no table and no dependency (DEC-002).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "In what unit does truncate measure length, and what does a non-numeric max do?",
      "decision": "truncate measures length in Unicode code points (Array.from) and the ellipsis '…' (U+2026) counts as one character, so the truncated result is exactly max code points; non-numeric max (NaN) also throws RangeError.",
      "alternative": "Measure length with String.prototype.length (UTF-16 code units), which can split surrogate pairs.",
      "basis": "Code points never produce broken characters and give identical results for BMP text such as the card examples.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Do the utilities validate the type of text?",
      "decision": "Inputs are coerced with String(text) and not type-checked; no TypeError is thrown for non-string text.",
      "alternative": "Throw TypeError when text is not a string.",
      "basis": "The card defines behaviour only for text input; coercion keeps the functions minimal and adds no untested surface.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "edgeCases": [
    {"id": "C1", "input": "slugify of text with no ASCII letter or digit", "expected": "returns an empty string"},
    {"id": "C2", "input": "slugify of text with runs of spaces and punctuation, leading and trailing", "expected": "one hyphen per run, no leading or trailing hyphen"},
    {"id": "C3", "input": "truncate with max equal to the text length", "expected": "returns the text unchanged"},
    {"id": "C4", "input": "truncate with max 0", "expected": "throws RangeError, but the card test does not assert it"},
    {"id": "C5", "input": "wordCount of empty or whitespace-only text, or text with tabs and newlines", "expected": "0 for blank text; tabs, newlines and repeated spaces count as one separator"}
  ],
  "needsPerson": [],
  "externalEffects": []
}
```
