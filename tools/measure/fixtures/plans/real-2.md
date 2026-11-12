# E5 Text Utilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-sandbox/

**Goal:** Add three pure text helpers (`slugify`, `truncate`, `wordCount`) for REQ-005, each in its own module with its own test file.

**Architecture:** Three independent ESM modules in `src/`, each exporting one pure function; no module imports another. Each task is TDD: test file first, then module.

**Tech Stack:** Plain Node ESM, Node v22.17.1, `node:test` + `node:assert/strict`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-E5-text-utilities-design.md`

## Global Constraints

- DEC-002: E5 utilities are pure: no I/O, no logging, no caching, no dependencies (`import` nothing in `src/` modules).
- Plain Node ESM (`"type": "module"`), Node v22, nothing to install. Run every command from the repo root of the E5 worktree `<sandbox>`, branch `feat/E5`.
- Tests use `node:test` and `node:assert/strict`, like `tests/baseline.test.mjs`; E5 tests bind no port and start no server.
- Do NOT change the G1 gate (`node --test`), `tests/baseline.test.mjs`, `src/greet.mjs` or anything under `docs/plans/roadmap-sandbox/`.
- truncate tests must NOT assert a throw for `max = 0` (only for a negative max such as `-1`).
- No barrel/index module, no input-type validation, no transliteration table, no word-boundary truncation.
- Task commits start with `E5 T<n>:` and end with the line `Co-Authored-By: Claude <noreply@anthropic.com>`. Add only the task's files (never `git add -A`, never `git stash`). Never push.
- No task needs a browser. No task is external. Evidence is the exit code and output of the `node --test` commands below; every step can be exercised in this environment.
- Locks: per-file test commands (`node --test tests/e5-*.test.mjs`) bind no port and need no lock. The whole-suite gate G1 `node --test` needs lock `sandbox-port` (baseline test binds port 48731); it is run by the workflow's gate stage, not by these tasks.

## Review Focus

- `max = 1` in truncate: expected `'…'` (exactly one char). Test added in Task 2.
- `max` that is `NaN`: expected `RangeError` (`!(max >= 1)`). Test added in Task 2.
- Digits in slugify input: kept (`'Top 10 Tips'` -> `'top-10-tips'`). Test added in Task 1.
- Letters with no decomposition (`ß`): treated as a separator, not transliterated (`'Straße'` -> `'stra-e'`). Test added in Task 1.
- Input with no ASCII letters or digits (`'!!!'`, `''`): slugify returns `''`. Test added in Task 1.

---

### Task 1: slugify

tier: sonnet · reviewTier: sonnet · needsLock: none · external: false · browser: no

**Files:**
- Create: `src/slugify.mjs`
- Test: `tests/e5-slugify.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function slugify(text: string): string` in `src/slugify.mjs`.

- [ ] **Step 1: Write the failing test** `tests/e5-slugify.test.mjs` importing `{ slugify }` from `'../src/slugify.mjs'`, with these assertions:

```js
assert.equal(slugify('Café au Lait!'), 'cafe-au-lait');
assert.equal(slugify('  Hello,   World  '), 'hello-world');
assert.equal(slugify('a--b'), 'a-b');
assert.match(slugify('Crème Brûlée: 2 servings'), /^[a-z0-9]+(-[a-z0-9]+)*$/);
assert.equal(slugify('Top 10 Tips'), 'top-10-tips');
assert.equal(slugify('Straße'), 'stra-e');
assert.equal(slugify('!!!'), '');
assert.equal(slugify(''), '');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/e5-slugify.test.mjs`
Expected: FAIL (non-zero exit), `ERR_MODULE_NOT_FOUND` for `src/slugify.mjs`.

- [ ] **Step 3: Implement `slugify(text)` in `src/slugify.mjs`**

Chain, in this order: `normalize('NFKD')` -> `.replace(/\p{M}+/gu, '')` -> `.toLowerCase()` -> `.replace(/[^a-z0-9]+/g, '-')` -> `.replace(/^-+|-+$/g, '')`. No imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/e5-slugify.test.mjs`
Expected: PASS, exit 0, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/slugify.mjs tests/e5-slugify.test.mjs
git commit -m "E5 T1: add slugify" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: truncate

tier: sonnet · reviewTier: sonnet · needsLock: none · external: false · browser: no

**Files:**
- Create: `src/truncate.mjs`
- Test: `tests/e5-truncate.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function truncate(text: string, max: number): string` in `src/truncate.mjs`; throws `RangeError` when `!(max >= 1)`.

- [ ] **Step 1: Write the failing test** `tests/e5-truncate.test.mjs` importing `{ truncate }` from `'../src/truncate.mjs'`, with these assertions (NO assertion for `max = 0`):

```js
const out = truncate('hello world', 8);
assert.equal(out, 'hello w…');
assert.ok(out.length <= 8);
assert.ok(out.endsWith('…'));
assert.equal(truncate('abcde', 5), 'abcde');   // length == max: unchanged
assert.equal(truncate('abc', 5), 'abc');       // shorter: unchanged
assert.equal(truncate('abcdef', 1), '…');
assert.throws(() => truncate('abc', -1), RangeError);
assert.throws(() => truncate('abc', NaN), RangeError);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/e5-truncate.test.mjs`
Expected: FAIL (non-zero exit), `ERR_MODULE_NOT_FOUND` for `src/truncate.mjs`.

- [ ] **Step 3: Implement `truncate(text, max)` in `src/truncate.mjs`**

First `if (!(max >= 1)) throw new RangeError(...)`; then return `text` if `text.length <= max`; else `text.slice(0, max - 1) + '…'` (U+2026). Length in UTF-16 code units. No imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/e5-truncate.test.mjs`
Expected: PASS, exit 0, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/truncate.mjs tests/e5-truncate.test.mjs
git commit -m "E5 T2: add truncate" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: wordCount

tier: sonnet · reviewTier: sonnet · needsLock: none · external: false · browser: no

**Files:**
- Create: `src/word-count.mjs`
- Test: `tests/e5-word-count.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function wordCount(text: string): number` in `src/word-count.mjs`.

- [ ] **Step 1: Write the failing test** `tests/e5-word-count.test.mjs` importing `{ wordCount }` from `'../src/word-count.mjs'`, with these assertions:

```js
assert.equal(wordCount('one two  three'), 3);
assert.equal(wordCount('a\tb\nc'), 3);
assert.equal(wordCount('  leading and trailing  '), 3);
assert.equal(wordCount(''), 0);
assert.equal(wordCount('   \n\t '), 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/e5-word-count.test.mjs`
Expected: FAIL (non-zero exit), `ERR_MODULE_NOT_FOUND` for `src/word-count.mjs`.

- [ ] **Step 3: Implement `wordCount(text)` in `src/word-count.mjs`**

`trim()`; return `0` if empty, else `split(/\s+/).length`. No imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/e5-word-count.test.mjs`
Expected: PASS, exit 0, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/word-count.mjs tests/e5-word-count.test.mjs
git commit -m "E5 T3: add wordCount" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Final verification (workflow gate, not a task)

G1: `node --test` from the repo root, run by the workflow holding lock `sandbox-port`.
Expected: exit 0, the 2 baseline tests plus the E5 tests, `# fail 0`. Baseline failures: none (baseline is exit 0, failing []).

## Acceptance criteria evidence

| ac | kind | command | testRef | external | externalDedupe |
|---|---|---|---|---|---|
| AC1 | test | `node --test tests/e5-slugify.test.mjs` | tests/e5-slugify.test.mjs | false | - |
| AC2 | test | `node --test tests/e5-truncate.test.mjs` | tests/e5-truncate.test.mjs | false | - |
| AC3 | test | `node --test tests/e5-word-count.test.mjs` | tests/e5-word-count.test.mjs | false | - |

All three commands only read files in the branch, bind no port and need no lock; each exits 0 only if its criterion holds.
