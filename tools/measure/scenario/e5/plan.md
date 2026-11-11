# E5 Text utilities Implementation Plan

**Roadmap:** docs/plans/roadmap-sandbox/
**Spec:** docs/superpowers/specs/2026-11-10-E5-text-utilities-design.md
**Goal:** three pure text helpers with a test file each, plus an index that re-exports them.
**Architecture:** one module per helper under `src/`, one test file per helper under `tests/`, plain Node ESM, no dependencies.

Synthetic fixture for measurement. Run every command from the repository root.

### Task 1: slugify

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** none · **external:** false

**Files:**
- Create: `src/slugify.mjs`
- Create: `tests/e5-slugify.test.mjs`

- [ ] **Step 1:** Write `tests/e5-slugify.test.mjs` asserting `slugify('Hello   World')` is `'hello-world'` and `slugify('  Hi, there!  ')` is `'hi-there'`.
- [ ] **Step 2:** `node --test tests/e5-slugify.test.mjs` -> Expected: FAIL (`Cannot find module`).
- [ ] **Step 3:** Create `src/slugify.mjs` exporting `slugify(text)`: `String(text).normalize('NFD')`, drop `̀-ͯ`, lowercase, replace each run of characters outside `a-z0-9` with `-`, trim hyphens at both ends.
- [ ] **Step 4:** `node --test tests/e5-slugify.test.mjs` -> Expected: PASS, 2 tests.
- [ ] **Step 5: Commit**

```bash
git add src/slugify.mjs tests/e5-slugify.test.mjs
git commit -m "E5 T1: slugify"
```

### Task 2: truncate

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** none · **external:** false

**Files:**
- Create: `src/truncate.mjs`
- Create: `tests/e5-truncate.test.mjs`

- [ ] **Step 1:** Write `tests/e5-truncate.test.mjs` asserting that `truncate('abcdefghij', 5)` has at most 5 characters and ends with `'…'`, that `truncate('abc', 10)` is `'abc'`, and that `truncate('abc', -1)` throws a `RangeError` (assert the throw for a negative max only, never for 0).
- [ ] **Step 2:** `node --test tests/e5-truncate.test.mjs` -> Expected: FAIL (`Cannot find module`).
- [ ] **Step 3:** Create `src/truncate.mjs` exporting `truncate(text, max)`: throw `RangeError` when `max` is not an integer of at least 1; return `text` when `text.length <= max`; otherwise return `text.slice(0, max - 1) + '…'`.
- [ ] **Step 4:** `node --test tests/e5-truncate.test.mjs` -> Expected: PASS, 3 tests.
- [ ] **Step 5: Commit**

```bash
git add src/truncate.mjs tests/e5-truncate.test.mjs
git commit -m "E5 T2: truncate"
```

### Task 3: wordCount and the index

**tier:** sonnet · **reviewTier:** sonnet · **needsLock:** sandbox-port · **external:** false

This task runs the whole suite with `node --test`, which binds the shared local port of the sandbox, so it declares the `sandbox-port` lock.

**Files:**
- Create: `src/word-count.mjs`
- Create: `src/index.mjs`
- Create: `tests/e5-word-count.test.mjs`

- [ ] **Step 1:** Write `tests/e5-word-count.test.mjs` asserting `wordCount('the quick fox')` is 3 and `wordCount('')` is 0.
- [ ] **Step 2:** `node --test tests/e5-word-count.test.mjs` -> Expected: FAIL (`Cannot find module`).
- [ ] **Step 3:** Create `src/word-count.mjs` exporting `wordCount(text)`: trim, return 0 for blank text, otherwise split on `\s+` and return the length. Create `src/index.mjs` re-exporting `slugify`, `truncate` and `wordCount`.
- [ ] **Step 4:** `node --test` -> Expected: PASS, every test of the repository.
- [ ] **Step 5: Commit**

```bash
git add src/word-count.mjs src/index.mjs tests/e5-word-count.test.mjs
git commit -m "E5 T3: wordCount and the index"
```

## Acceptance criteria evidence

| Criterion | Kind | Command | Test reference | External |
|---|---|---|---|---|
| AC1 | test | node --test tests/e5-slugify.test.mjs | tests/e5-slugify.test.mjs | external: false |
| AC2 | test | node --test tests/e5-truncate.test.mjs | tests/e5-truncate.test.mjs | external: false |
| AC3 | test | node --test tests/e5-word-count.test.mjs | tests/e5-word-count.test.mjs | external: false |
