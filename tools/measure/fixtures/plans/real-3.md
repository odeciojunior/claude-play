# E5 Text Utilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-sandbox/

**Goal:** Add three pure text helpers (`slugify`, `truncate`, `wordCount`) with one test file each, satisfying card E5 (REQ-005).

**Architecture:** Three independent ESM modules in `src/`, one named export each, no imports and no shared helper. Each has its own `node:test` file in `tests/`. The tasks are independent and can run in any order or in parallel.

**Tech Stack:** Node v22.17.1, plain ESM (`.mjs`), `node:test`, `node:assert/strict`. No dependencies.

**Spec:** docs/superpowers/specs/2026-11-12-E5-text-utilities-design.md

## Global Constraints

- DEC-002 (in force): the utilities are pure: no I/O, no logging, no caching, no global state, no imports, no dependencies.
- Files are `.mjs`, ASCII, LF. The ellipsis U+2026 is written in source and tests as the escape `'\u2026'`; combining marks as `/[\u0300-\u036f]/g`.
- Tests import `{ test }` from `node:test` and `assert` from `node:assert/strict`, as in `tests/baseline.test.mjs`.
- Do not edit `tests/baseline.test.mjs`, `package.json`, the gate command or `docs/plans/roadmap-sandbox/`.
- No test may assert that `truncate(x, 0)` throws (card E5 forbids it).
- New tests open no ports. Only the full suite (`node --test`) touches the shared port 48731 (baseline test), so only a step that runs the full suite needs lock `sandbox-port`.
- Commit messages start with `E5 T<n>:` and end with the line `Co-Authored-By: Claude <noreply@anthropic.com>`. Add only the task's files (never `git add -A`, never `git stash`). Never push.
- Environment: Windows 11, Git Bash or PowerShell; run every command from the worktree root `<sandbox>`. No task needs a browser; the acceptable evidence is the exit code and output of the listed `node --test` commands.
- Baseline of the target: `node --test` exits 0 with 2 tests passing, 0 failing; no baseline failure is expected.

## Review Focus

- Non-string `text` (e.g. `undefined`, `42`) for any of the three functions: expect a `TypeError`, not a confusing crash inside `.normalize`/`.trim`. Tests added in each task.
- `slugify` of input with no ASCII letters or digits (`'!!!'`): expect `''`, never `'-'`. Test in Task 1.
- `truncate` with a surrogate pair at the cut point (emoji): expect no half pair and a result of exactly `max` code points. Test in Task 2.
- `truncate` with `max === 1` on longer text: expect exactly `'\u2026'`. Test in Task 2.
- `wordCount` with leading/trailing whitespace and tabs/newlines between words: expect no empty tokens counted. Test in Task 3.

---

### Task 1: slugify

- tier: sonnet
- reviewTier: sonnet
- needsLock: none
- external: false (local files on `feat/E5` only)

**Files:**
- Create: `src/slugify.mjs`
- Test: `tests/e5-slugify.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function slugify(text: string): string` in `src/slugify.mjs`.

- [ ] **Step 1: Write the failing test** `tests/e5-slugify.test.mjs` importing `{ slugify }` from `'../src/slugify.mjs'`, with tests:
  - `card example`: `assert.equal(slugify('Caf\u00e9 au Lait!'), 'cafe-au-lait')`
  - `collapses spaces and punctuation`: `assert.equal(slugify('  Hello,   World  '), 'hello-world')`; `assert.equal(slugify('a -- b...c'), 'a-b-c')`
  - `lowercases and keeps digits`: `assert.equal(slugify('ABC 123'), 'abc-123')`
  - `no letters or digits gives empty string`: `assert.equal(slugify('!!!'), '')`
  - `output shape`: for each of `['Caf\u00e9 au Lait!', ' --x-- ', 'R\u00e9sum\u00e9 2026: Final!']`, `assert.match(slugify(s), /^[a-z0-9]+(-[a-z0-9]+)*$/)`
  - `non-string throws TypeError`: `assert.throws(() => slugify(undefined), TypeError)`; `assert.throws(() => slugify(42), TypeError)`

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/e5-slugify.test.mjs`
Expected: non-zero exit, failure `Cannot find module` for `src/slugify.mjs`.

- [ ] **Step 3: Implement `slugify(text)` in `src/slugify.mjs`**

Algorithm (from the spec): non-string -> `throw new TypeError(...)`; `text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')`; `.toLowerCase()`; `.replace(/[^a-z0-9]+/g, '-')`; strip leading/trailing `-`. No imports.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/e5-slugify.test.mjs`
Expected: exit 0, all tests pass, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/slugify.mjs tests/e5-slugify.test.mjs
git commit -m "E5 T1: add slugify" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: truncate

- tier: sonnet
- reviewTier: sonnet
- needsLock: none
- external: false (local files on `feat/E5` only)

**Files:**
- Create: `src/truncate.mjs`
- Test: `tests/e5-truncate.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function truncate(text: string, max: number): string` in `src/truncate.mjs`.

- [ ] **Step 1: Write the failing test** `tests/e5-truncate.test.mjs` importing `{ truncate }` from `'../src/truncate.mjs'`, with tests:
  - `longer text is cut with ellipsis`: `const r = truncate('hello world', 5)`; `assert.ok(Array.from(r).length <= 5)`; `assert.ok(r.endsWith('\u2026'))`; `assert.equal(r, 'hell\u2026')`
  - `text of length max is unchanged`: `assert.equal(truncate('hello', 5), 'hello')`
  - `shorter text is unchanged`: `assert.equal(truncate('hi', 5), 'hi')`
  - `max 1 gives only the ellipsis`: `assert.equal(truncate('hello', 1), '\u2026')`
  - `does not split a surrogate pair`: `const r = truncate('ab\u{1F600}cd', 4)`; `assert.equal(r, 'ab\u{1F600}\u2026')`; `assert.equal(Array.from(r).length, 4)`
  - `negative max throws RangeError`: `assert.throws(() => truncate('hello', -1), RangeError)`
  - `non-string throws TypeError`: `assert.throws(() => truncate(42, 5), TypeError)`
  - NO test for `max = 0` (the card forbids asserting that throw).

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/e5-truncate.test.mjs`
Expected: non-zero exit, failure `Cannot find module` for `src/truncate.mjs`.

- [ ] **Step 3: Implement `truncate(text, max)` in `src/truncate.mjs`**

Order matters: non-string `text` -> `TypeError`; then `!Number.isInteger(max) || max < 1` -> `RangeError` (before the length check, so it throws even for short text); `const chars = Array.from(text)`; if `chars.length <= max` return `text` (same string); else return `chars.slice(0, max - 1).join('') + '\u2026'`. No imports.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/e5-truncate.test.mjs`
Expected: exit 0, all tests pass, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/truncate.mjs tests/e5-truncate.test.mjs
git commit -m "E5 T2: add truncate" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: wordCount and full-suite gate

- tier: sonnet
- reviewTier: sonnet
- needsLock: sandbox-port (Step 5 runs the full suite, whose baseline test binds port 48731)
- external: false (local files on `feat/E5` only)

**Files:**
- Create: `src/word-count.mjs`
- Test: `tests/e5-word-count.test.mjs`

**Interfaces:**
- Consumes: nothing (Step 5 also runs the test files of Tasks 1 and 2 when they are already on the branch).
- Produces: `export function wordCount(text: string): number` in `src/word-count.mjs`.

- [ ] **Step 1: Write the failing test** `tests/e5-word-count.test.mjs` importing `{ wordCount }` from `'../src/word-count.mjs'`, with tests:
  - `counts words`: `assert.equal(wordCount('one two three'), 3)`
  - `mixed whitespace`: `assert.equal(wordCount('  one\ttwo\n\nthree   four  '), 4)`
  - `punctuation belongs to words`: `assert.equal(wordCount("don't stop."), 2)`
  - `empty is zero`: `assert.equal(wordCount(''), 0)`
  - `blank is zero`: `assert.equal(wordCount('   \n\t '), 0)`
  - `non-string throws TypeError`: `assert.throws(() => wordCount(null), TypeError)`

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/e5-word-count.test.mjs`
Expected: non-zero exit, failure `Cannot find module` for `src/word-count.mjs`.

- [ ] **Step 3: Implement `wordCount(text)` in `src/word-count.mjs`**

Non-string -> `TypeError`; `const trimmed = text.trim()`; `''` -> `0`; else `trimmed.split(/\s+/).length`. No imports.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/e5-word-count.test.mjs`
Expected: exit 0, all tests pass, 0 failing.

- [ ] **Step 5: Full suite and purity check (needs lock sandbox-port)**

Run: `node --test`
Expected: exit 0; the 2 baseline tests plus every E5 test present on the branch pass; 0 failing, 0 skipped. No baseline failure is expected.

Run (only on the E5 source files that exist): `grep -n "import" src/slugify.mjs src/truncate.mjs src/word-count.mjs`
Expected: no output (grep exit 1, meaning no match, is the pass condition).

- [ ] **Step 6: Commit**

```bash
git add src/word-count.mjs tests/e5-word-count.test.mjs
git commit -m "E5 T3: add wordCount" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

## External effects

None. The spec declares no external effect; every task runs in the E5 worktree on `feat/E5`, changes only local files and never pushes. Merging into the integration branch and pushing are the owner's and are not tasks of this plan.

## Acceptance criteria evidence

| ac | kind | command | testRef | external | externalDedupe |
|---|---|---|---|---|---|
| AC1 | test | node --test tests/e5-slugify.test.mjs | tests/e5-slugify.test.mjs | false | - |
| AC2 | test | node --test tests/e5-truncate.test.mjs | tests/e5-truncate.test.mjs | false | - |
| AC3 | test | node --test tests/e5-word-count.test.mjs | tests/e5-word-count.test.mjs | false | - |

Each command only reads files of the branch and opens no port, so none needs the `sandbox-port` lock and none is external.
