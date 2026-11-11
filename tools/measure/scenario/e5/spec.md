# E5 -- Text utilities: design

Synthetic fixture for measurement. Deliverable E5 of the roadmap `docs/plans/roadmap-sandbox/` (card E5, requirement REQ-005, depends on nothing). Decisions followed: DEC-001 (unrelated to E5) and DEC-002 (E5 utilities are pure: no I/O and no dependencies).

## Scope

Three pure text helpers in plain Node ESM, each with its own test file. No I/O, no dependencies, no external effect.

## Pieces

- Piece 1: `slugify(text)` in `src/slugify.mjs`, tests in `tests/e5-slugify.test.mjs`.
- Piece 2: `truncate(text, max)` in `src/truncate.mjs`, tests in `tests/e5-truncate.test.mjs`.
- Piece 3: `wordCount(text)` in `src/word-count.mjs`, tests in `tests/e5-word-count.test.mjs`, plus `src/index.mjs`, which re-exports the three functions.

## Acceptance criteria

1. Given text with spaces, punctuation and accented letters, when slugify is called, then lowercase ASCII words joined by single hyphens come back (slugify('Café au Lait!') is 'cafe-au-lait'). {verify: test; evidence: node --test tests/e5-slugify.test.mjs}
2. Given text longer than max, when truncate is called, then at most max characters come back, ending with '…'; text of length max or less comes back unchanged; max below 1 throws a RangeError (the card test asserts the throw only for a negative max such as -1, never for 0). {verify: test; evidence: node --test tests/e5-truncate.test.mjs}
3. Given text, when wordCount is called, then the number of whitespace-separated words comes back, and 0 for empty or blank text. {verify: test; evidence: node --test tests/e5-word-count.test.mjs}

## Design notes

- `slugify` removes accents with `normalize('NFD')` and drops the combining marks, lowercases, replaces each run of non-alphanumeric characters with one hyphen and trims hyphens at both ends.
- `truncate` keeps `max - 1` characters plus the ellipsis when it cuts, so the result is exactly `max` characters long. It throws a `RangeError` when `max` is not an integer of at least 1.
- `wordCount` trims the text and splits on runs of whitespace; blank text has no words.

## Autonomous decisions

1. Exact cut length of `truncate`: the result has exactly `max` characters, ellipsis included. Recommended option taken; reversible; scope: this deliverable only. Consistent with DEC-002.
2. Non-string input is coerced with `String(text)` in `slugify` and `wordCount`. Recommended option taken; reversible; scope: this deliverable only. Consistent with DEC-002.

## Depends on human input

None.
