<!-- synthetic input: scripted answers for the E19 behavioral run, not a person -->
# Scripted run of the interactive spec skill

## Request

Add a small `wordWrap(text, width)` function in `src/word-wrap.mjs` that breaks text into lines of at most `width` characters at word boundaries. A word longer than `width` stays on a line of its own. Tests go in `tests/word-wrap.test.mjs`.

## Scripted answers

- Where should the spec be written? Answer: `docs/plans/word-wrap/spec.md`.
- What should happen when `width` is below 1? Answer: throw a RangeError.
- Should leading and trailing spaces of a line be kept? Answer: no, trim them.
- For any other question, take the recommended option.

## Approval

approved
