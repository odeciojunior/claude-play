# E5 -- Text utilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-sandbox/

**Goal:** Add three pure text helpers (`slugify`, `truncate`, `wordCount`) with one test file each, keeping gate G1 (`node --test`) green.

**Architecture:** Three independent ESM modules in `src/`, each exporting one named function; no module imports another, no barrel. Each has its own `node:test` file in `tests/`. Tasks 1-3 are independent and may run in parallel; Task 4 runs the full gate after them.

**Tech Stack:** Node v22.17.1, plain ESM, `node:test`, `node:assert/strict`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-E5-text-utilities-design.md`

## Global Constraints

- DEC-002: E5 utilities are pure: no I/O (no fs, network, console logging) and no dependencies.
- No change to `package.json`, to the gate command (`node --test`) or to existing tests (`tests/baseline.test.mjs`).
- Tests use `node:test` and `node:assert/strict`, like `tests/baseline.test.mjs`; tests must not bind ports or touch the filesystem.
- A non-string `text` throws `TypeError` in all three functions (one test case per function).
- All commands run from the worktree root `<sandbox>` on branch `feat/E5`. Environment: Windows 11, Git Bash or PowerShell 7; nothing to install.
- Commits: only the task's files (`git add <paths>`, never `git add -A`, never `git stash`), messages start with `E5 T<n>:` and end with the line `Co-Authored-By: Claude <noreply@anthropic.com>`. Never push.
- No task needs a browser, a server, a port, the merge, the target branch or the integration worktree. No task of this plan is external.
- Locks: the per-file test commands (`node --test tests/e5-*.test.mjs`) need no lock. Only the full gate `node --test` needs `sandbox-port` (the pre-existing baseline test binds port 48731).

## Review Focus

1. slugify with leading/trailing punctuation and spaces (`'  --Hello, World!--  '`) must give `'hello-world'` with no edge hyphens -- pinned in Task 1.
2. slugify with digits and uppercase mixed (`'Version 2.0 RC'`) must keep digits: `'version-2-0-rc'` -- pinned in Task 1.
3. truncate with `max === 1` must return `'…'` (length 1), not `''` or a longer string -- pinned in Task 2.
4. truncate with text of length exactly `max` must return the same string (no ellipsis) -- pinned in Task 2.
5. wordCount with mixed tabs/newlines and Unicode whitespace (`'a\tb\nc\u00A0d'`) must give 4 -- pinned in Task 3.

---

### Task 1: slugify

tier: sonnet; reviewTier: sonnet; needsLock: none; external: false

**Files:**
- Create: `src/slugify.mjs`
- Test: `tests/e5-slugify.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function slugify(text: string): string`.

- [ ] **Step 1: Write the failing test** in `tests/e5-slugify.test.mjs` (import `{ slugify }` from `'../src/slugify.mjs'`):

```js
test('card example', () => assert.equal(slugify('Café au Lait!'), 'cafe-au-lait'));
test('spaces and punctuation collapse to one hyphen', () => assert.equal(slugify('  Hello,   World  '), 'hello-world'));
test('no leading or trailing hyphen', () => assert.equal(slugify('  --Hello, World!--  '), 'hello-world'));
test('digits kept', () => assert.equal(slugify('Version 2.0 RC'), 'version-2-0-rc'));
test('output shape', () => assert.match(slugify('Ação Rápida: Über Größe'), /^[a-z0-9]+(-[a-z0-9]+)*$/));
test('empty and punctuation-only give empty string', () => { assert.equal(slugify(''), ''); assert.equal(slugify('!!!'), ''); });
test('non-string throws TypeError', () => assert.throws(() => slugify(42), TypeError));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/e5-slugify.test.mjs`
Expected: FAIL (non-zero exit), `ERR_MODULE_NOT_FOUND` for `src/slugify.mjs`.

- [ ] **Step 3: Implement `slugify(text)` in `src/slugify.mjs`**

Throw `TypeError` if `typeof text !== 'string'`; then exactly the spec algorithm: `normalize('NFKD')` -> `.replace(/\p{M}/gu, '')` -> `.toLowerCase()` -> `.replace(/[^a-z0-9]+/g, '-')` -> `.replace(/^-+|-+$/g, '')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/e5-slugify.test.mjs`
Expected: exit 0, all 7 tests pass, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/slugify.mjs tests/e5-slugify.test.mjs
git commit -m "E5 T1: add slugify" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: truncate

tier: sonnet; reviewTier: sonnet; needsLock: none; external: false

**Files:**
- Create: `src/truncate.mjs`
- Test: `tests/e5-truncate.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function truncate(text: string, max: number): string`.

- [ ] **Step 1: Write the failing test** in `tests/e5-truncate.test.mjs` (import `{ truncate }` from `'../src/truncate.mjs'`):

```js
test('long text is cut to max ending with ellipsis', () => {
  const r = truncate('abcdefghij', 5);
  assert.equal(r.length, 5); assert.ok(r.endsWith('…')); assert.equal(r, 'abcd…');
});
test('text of length max is unchanged', () => assert.equal(truncate('abcde', 5), 'abcde'));
test('shorter text is unchanged', () => assert.equal(truncate('abc', 5), 'abc'));
test('max 1 gives ellipsis', () => assert.equal(truncate('abc', 1), '…'));
test('negative max throws RangeError', () => assert.throws(() => truncate('abc', -1), RangeError));
test('non-string throws TypeError', () => assert.throws(() => truncate(null, 3), TypeError));
```

Per the card, do NOT add an assertion for `max = 0`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/e5-truncate.test.mjs`
Expected: FAIL (non-zero exit), `ERR_MODULE_NOT_FOUND` for `src/truncate.mjs`.

- [ ] **Step 3: Implement `truncate(text, max)` in `src/truncate.mjs`**

`TypeError` for non-string `text`; `RangeError` (message names `max`) when `!Number.isInteger(max) || max < 1`; return `text` if `text.length <= max`; else `text.slice(0, max - 1) + '…'` (U+2026, single character).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/e5-truncate.test.mjs`
Expected: exit 0, all 6 tests pass, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/truncate.mjs tests/e5-truncate.test.mjs
git commit -m "E5 T2: add truncate" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: wordCount

tier: sonnet; reviewTier: sonnet; needsLock: none; external: false

**Files:**
- Create: `src/word-count.mjs`
- Test: `tests/e5-word-count.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function wordCount(text: string): number`.

- [ ] **Step 1: Write the failing test** in `tests/e5-word-count.test.mjs` (import `{ wordCount }` from `'../src/word-count.mjs'`):

```js
test('three words', () => assert.equal(wordCount('one two three'), 3));
test('mixed whitespace', () => assert.equal(wordCount('a\tb\n\nc   d'), 4));
test('unicode whitespace', () => assert.equal(wordCount('a\tb\nc\u00A0d'), 4));
test('leading and trailing whitespace ignored', () => assert.equal(wordCount('  hi there  '), 2));
test('empty is 0', () => assert.equal(wordCount(''), 0));
test('blank is 0', () => assert.equal(wordCount('   \n\t '), 0));
test('punctuation does not split', () => assert.equal(wordCount('hello, world'), 2));
test('non-string throws TypeError', () => assert.throws(() => wordCount(undefined), TypeError));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/e5-word-count.test.mjs`
Expected: FAIL (non-zero exit), `ERR_MODULE_NOT_FOUND` for `src/word-count.mjs`.

- [ ] **Step 3: Implement `wordCount(text)` in `src/word-count.mjs`**

`TypeError` for non-string `text`; then `const t = text.trim(); return t === '' ? 0 : t.split(/\s+/).length;`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/e5-word-count.test.mjs`
Expected: exit 0, all 8 tests pass, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/word-count.mjs tests/e5-word-count.test.mjs
git commit -m "E5 T3: add wordCount" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Full gate G1

tier: haiku; reviewTier: sonnet; needsLock: sandbox-port; external: false

**Files:** none. This task changes no file and makes no commit; it only runs verification.

Depends on: Tasks 1, 2, 3.

- [ ] **Step 1: Run the canonical unit gate (holding the `sandbox-port` lock)**

Run: `node --test`
Expected: exit 0; total = 2 baseline + 21 E5 tests = 23, 0 failing, 0 skipped. The baseline has no failing tests, so any failure is a defect of this deliverable.

- [ ] **Step 2: Confirm the working tree is clean**

Run: `git status --porcelain`
Expected: empty output.

If the `sandbox-port` lock cannot be obtained, return BLOCKED with needsLock=sandbox-port; the per-file commands of Tasks 1-3 remain the acceptance evidence.

---

## Acceptance criteria evidence

| ac | kind | command | testRef | external | externalDedupe |
|---|---|---|---|---|---|
| AC1 | test | node --test tests/e5-slugify.test.mjs | tests/e5-slugify.test.mjs | false | - |
| AC2 | test | node --test tests/e5-truncate.test.mjs | tests/e5-truncate.test.mjs | false | - |
| AC3 | test | node --test tests/e5-word-count.test.mjs | tests/e5-word-count.test.mjs | false | - |

All three commands are local, read-only, need no lock and no browser; they exit 0 only if every test in the file passes.
