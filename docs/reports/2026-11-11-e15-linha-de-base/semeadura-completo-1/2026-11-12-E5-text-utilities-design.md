# E5 -- Text utilities (design)

Deliverable: **E5** of the roadmap `docs/plans/roadmap-sandbox/` (card E5 in `strategy.md`).
Requirement: **REQ-005** -- text can be turned into ASCII slugs, truncated and counted in words.
Depends on: `-` (none).
Registered decisions honoured: **DEC-002** (E5 utilities are pure: no I/O and no dependencies).

## Intent

Add three small, pure text helpers to the sandbox so the roadmap-release workflow has an
independent, multi-piece deliverable to run. There is no product behaviour behind them; the
value is that they are correct, tested, and merge cleanly with G1 green.

## Acceptance criteria (verbatim from card E5)

1. Given text with spaces, punctuation and accented letters, when slugify is called, then lowercase ASCII words joined by single hyphens come back (slugify('Café au Lait!') is 'cafe-au-lait'). {verify: test; evidence: node --test tests/e5-slugify.test.mjs}
2. Given text longer than max, when truncate is called, then at most max characters come back, ending with '…'; text of length max or less comes back unchanged; max below 1 throws a RangeError (the card test asserts the throw only for a negative max such as -1, never for 0). {verify: test; evidence: node --test tests/e5-truncate.test.mjs}
3. Given text, when wordCount is called, then the number of whitespace-separated words comes back, and 0 for empty or blank text. {verify: test; evidence: node --test tests/e5-word-count.test.mjs}

Definition of done (card): acceptance passes in the integration branch; G1 (`node --test`) green.

## Goals, non-goals, anti-goals

- Goals: the three functions as named exports in the files the card fixes, each with its own test file.
- Non-goals: locale-aware transliteration (e.g. `ß` -> `ss`), grapheme-aware truncation, a CLI, an index/barrel module.
- Anti-goals (would violate DEC-002 or the card): any I/O (fs, network, console logging), any npm dependency, any change to `package.json`, to the gate command or to existing tests.

## Constraints

- Plain Node ESM, Node v22, no dependencies (PROJECT block). Tests use `node:test` and `node:assert/strict`, like `tests/baseline.test.mjs`.
- File layout is fixed by the card:

| Piece | Source | Export | Tests |
|---|---|---|---|
| 1 | `src/slugify.mjs` | `export function slugify(text)` | `tests/e5-slugify.test.mjs` |
| 2 | `src/truncate.mjs` | `export function truncate(text, max)` | `tests/e5-truncate.test.mjs` |
| 3 | `src/word-count.mjs` | `export function wordCount(text)` | `tests/e5-word-count.test.mjs` |

- The three pieces are independent: no module imports another. They can be built in any order or in parallel.
- Tests must not bind ports or touch the filesystem (the `sandbox-port` lock is only needed to run the full gate, because of the pre-existing baseline test).

## Design

### Piece 1 -- `slugify(text)`

Algorithm:

1. `text.normalize('NFKD')` to split accented letters into base letter + combining mark.
2. Remove combining marks: `.replace(/\p{M}/gu, '')`.
3. `.toLowerCase()`.
4. Replace every run of characters outside `[a-z0-9]` with a single `-`: `.replace(/[^a-z0-9]+/g, '-')`.
5. Strip leading and trailing hyphens: `.replace(/^-+|-+$/g, '')`.

Results: `slugify('Café au Lait!') === 'cafe-au-lait'`; `slugify('  Hello,   World  ') === 'hello-world'`;
`slugify('!!!') === ''`; `slugify('') === ''`. Letters with no ASCII decomposition (`ß`, `ø`, CJK) are dropped
as separators.

Tests (minimum): the card example; multiple spaces and punctuation collapse to one hyphen; no leading/trailing
hyphen; digits kept; output matches `/^[a-z0-9]+(-[a-z0-9]+)*$/` for a non-empty slug; empty and
punctuation-only input give `''`.

### Piece 2 -- `truncate(text, max)`

Behaviour:

- If `max` is not an integer or `max < 1`: throw `RangeError` (message names `max`).
- If `text.length <= max`: return `text` unchanged.
- Otherwise: return `text.slice(0, max - 1) + '…'` (the ellipsis is the single character U+2026), so the result
  length is exactly `max`. With `max === 1` the result is `'…'`.

Length is measured with `String.prototype.length` (UTF-16 code units).

Tests (minimum): long text -> length `max`, ends with `'…'`, prefix equals the original start; text of length
exactly `max` and shorter text come back unchanged (strict equality); `max = 1` gives `'…'`; `truncate('abc', -1)`
throws `RangeError` (`assert.throws(..., RangeError)`). Per the card, the tests **do not** assert the throw for
`max = 0` (the implementation still throws for it, since 0 is below 1).

### Piece 3 -- `wordCount(text)`

Behaviour: `const t = text.trim(); return t === '' ? 0 : t.split(/\s+/).length;`
`\s` covers spaces, tabs, newlines and Unicode whitespace.

Tests (minimum): `'one two three'` -> 3; mixed tabs/newlines/multiple spaces -> correct count; leading/trailing
whitespace ignored; `''` -> 0; `'   \n\t '` -> 0; punctuation attached to a word does not split it
(`'hello, world'` -> 2).

### Input validation (all three)

A non-string `text` throws `TypeError`. This keeps failures loud and is not asserted by the card criteria
(tests may cover it, one case per function).

### Verification

- Per piece: `node --test tests/e5-<piece>.test.mjs` (the card's evidence commands).
- Gate G1: `node --test` from the repo root (needs the `sandbox-port` lock); expected total = 2 baseline + the new E5 tests, 0 failing, 0 skipped.

## Left to the builder

Exact test names, number of extra test cases beyond the minimums, error message wording, and whether to use
one `test()` per case or grouped subtests.

## Autonomous decisions (reviewable by the owner)

Origin: executor; status: pending.

1. slugify uses NFKD normalization plus removal of `\p{M}` marks; characters without an ASCII decomposition (e.g. `ß`, `ø`) are dropped instead of transliterated (no dependency, per DEC-002).
2. slugify returns `''` when the input has no ASCII letters or digits, instead of throwing.
3. truncate keeps the result at exactly `max` characters when it cuts (`max - 1` characters plus `'…'`), and `max = 1` returns `'…'`.
4. truncate also throws `RangeError` for a non-integer `max` (e.g. 2.5, NaN), in addition to `max < 1`; tests assert the throw only for `-1`, as the card requires.
5. Length is measured in UTF-16 code units (`String.length`), not graphemes or code points.
6. wordCount splits on `/\s+/` after trimming (Unicode whitespace included).
7. All three functions throw `TypeError` for non-string `text`.
8. No barrel/index module and no `package.json` change; each piece is self-contained.

## Depends on human input

None. The deliverable is pure code verified by local tests; no credentials, accounts, external effects or
human acceptances are involved. Merge acceptance is done by the workflow gates (G1), not by a human act in this
deliverable.
