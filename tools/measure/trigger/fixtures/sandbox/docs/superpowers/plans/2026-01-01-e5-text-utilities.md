# E5 Text Utilities Implementation Plan

**Goal:** Add `countWords` and `reverseWords` helpers.

**Architecture:** Two small ES modules under `src/`, each with its own test under `tests/`.

---

### Task 1: countWords

**Files:**
- Create: `src/count.mjs`
- Test: `tests/count.test.mjs`

- [ ] Write the failing test for `countWords("a b c") === 3` and `countWords("") === 0`.
- [ ] Run `node --test tests/count.test.mjs`, see it fail.
- [ ] Implement `countWords` by splitting on whitespace.
- [ ] Run the test, see it pass, commit.

### Task 2: reverseWords

**Files:**
- Create: `src/reverse.mjs`
- Test: `tests/reverse.test.mjs`

- [ ] Write the failing test for `reverseWords("a b c") === "c b a"`.
- [ ] Run `node --test tests/reverse.test.mjs`, see it fail.
- [ ] Implement `reverseWords` reusing the whitespace split.
- [ ] Run the test, see it pass, commit.

### Task 3: README

**Files:**
- Modify: `README.md`

- [ ] Document both functions with one example each.
