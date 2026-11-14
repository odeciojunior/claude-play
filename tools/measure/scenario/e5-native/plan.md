# E5 -- Text utilities: plan

**Roadmap:** docs/plans/roadmap-sandbox/
**Spec:** spec.md
**Card:** E5 (REQ-005)
**Branch / worktree:** feat/E5 in D:/claude-e8q-work/completo/completo-1-wt/E5

## Overview

Three independent pure functions (DEC-002: no I/O, no dependencies), each in its own named-export ESM module under `src/` with its own test file under `tests/`. Each task is test-first: write the test file, see it fail (module missing), write the module, see it pass. Tasks have no dependencies on each other and may run in parallel. Every task runs in the deliverable worktree D:/claude-e8q-work/completo/completo-1-wt/E5 on feat/E5, from the repository root, one simple command per call.

Locks: no task needs a lock. The task checks and the evidence commands run only the E5 test files, which bind no port. The full gate G1 (`node --test`, lock `sandbox-port`, because `tests/baseline.test.mjs` binds port 48731) is run by the workflow's gate stage, not by these tasks (ruling R4).

External: no task and no evidence row is external. Nothing leaves the branch, nothing is pushed, no shared data is written; the spec lists no external effect.

Browser: no task needs a browser, a server or a port. Every step is exercised by `node --test` in this environment, so the acceptable evidence is exit code 0 of the listed commands; there is no step that cannot be exercised here.

Commits: the caller commits; each task's commit adds only the task's two files and its message starts with `E5 T<n>:` and ends with `Co-Authored-By: Claude <noreply@anthropic.com>`.

### Tarefa 1: slugify with tests

Files: `tests/e5-slugify.test.mjs` (new), `src/slugify.mjs` (new). Locks: none. External: no. Browser: no.

1. Write `tests/e5-slugify.test.mjs` with `node:test` and `node:assert/strict`, importing `{ slugify }` from `../src/slugify.mjs`. Cases: `slugify('Café au Lait!')` is `'cafe-au-lait'`; runs of spaces and punctuation collapse to one hyphen (`'a  --  b'` is `'a-b'`); leading/trailing punctuation is stripped (`'  ¡Hola, Mundo!  '` is `'hola-mundo'`); an already-slug input is unchanged (`'already-a-slug'`); text with no ASCII letter or digit returns `''` (`'!!!'`) (edge cases C1, C2).
2. Run `node --test tests/e5-slugify.test.mjs`: expected to fail (module missing).
3. Write `src/slugify.mjs` exporting `slugify(text)`: `String(text).normalize('NFD')`, remove combining marks U+0300-U+036F, lowercase, replace each run of `[^a-z0-9]+` with `-`, strip leading/trailing `-` (spec rulings R1, R3). No imports.
4. Run `node --test tests/e5-slugify.test.mjs`: exit 0.
5. Commit step: `E5 T1: add slugify with tests`.

### Tarefa 2: truncate with tests

Files: `tests/e5-truncate.test.mjs` (new), `src/truncate.mjs` (new). Locks: none. External: no. Browser: no.

1. Write `tests/e5-truncate.test.mjs` importing `{ truncate }` from `../src/truncate.mjs`. Cases: longer text (`truncate('hello world', 5)`) has length 5 and ends with `'…'` (`'hell…'`); text of length exactly `max` (`truncate('hello', 5)`) and shorter (`truncate('hi', 5)`) come back unchanged (C3); `truncate('abc', 1)` is `'…'`; a surrogate pair is not split (`Array.from(truncate('a😀b😀c', 3))` has length 3); `assert.throws(() => truncate('abc', -1), RangeError)`. No assertion for `max` = 0 (C4, spec "What not to do").
2. Run `node --test tests/e5-truncate.test.mjs`: expected to fail (module missing).
3. Write `src/truncate.mjs` exporting `truncate(text, max)`: throw `RangeError` when `!(max >= 1)` (negative, 0 and `NaN`); `const cps = Array.from(String(text))`; return the text unchanged when `cps.length <= max`, else `cps.slice(0, max - 1).join('') + '…'` (spec ruling R2). No imports.
4. Run `node --test tests/e5-truncate.test.mjs`: exit 0.
5. Commit step: `E5 T2: add truncate with tests`.

### Tarefa 3: wordCount with tests

Files: `tests/e5-word-count.test.mjs` (new), `src/word-count.mjs` (new). Locks: none. External: no. Browser: no.

1. Write `tests/e5-word-count.test.mjs` importing `{ wordCount }` from `../src/word-count.mjs`. Cases: plain sentence (`'the quick brown fox'` is 4); mixed whitespace (`'one\ttwo\nthree   four'` is 4); empty string is 0; blank string (`'  \t\n '`) is 0 (C5).
2. Run `node --test tests/e5-word-count.test.mjs`: expected to fail (module missing).
3. Write `src/word-count.mjs` exporting `wordCount(text)`: `const t = String(text).trim(); return t === '' ? 0 : t.split(/\s+/).length;`. No imports.
4. Run `node --test tests/e5-word-count.test.mjs`: exit 0.
5. Commit step: `E5 T3: add wordCount with tests`.

## Evidence

| AC | Kind | Command | Test | External |
|---|---|---|---|---|
| AC1 | test | `node --test tests/e5-slugify.test.mjs` | tests/e5-slugify.test.mjs | no |
| AC2 | test | `node --test tests/e5-truncate.test.mjs` | tests/e5-truncate.test.mjs | no |
| AC3 | test | `node --test tests/e5-word-count.test.mjs` | tests/e5-word-count.test.mjs | no |

The commands are the `{verify: ...}` commands of the card, kept literally; the tests they reference are created by tasks 1 to 3. They read only files of the branch and bind no port, so they need no lock and are not external.

## Rulings

- R4: tasks run only their own test file and hold no lock; G1 with `sandbox-port` stays with the workflow gate stage.
- R5: one test-first task per card piece, no dependencies between tasks.

(R1 to R3 are the spec's rulings; numbering continues from them.)

```json data
{
  "schema": "plan/1",
  "id": "E5",
  "title": "Text utilities",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-sandbox/",
  "constraints": [
    "No I/O, logging, caching or dependency in the three modules (DEC-002).",
    "No package.json script, barrel/index module or default export.",
    "Do not change src/greet.mjs, tests/baseline.test.mjs, package.json, gate G1 or docs/plans/roadmap-sandbox/.",
    "The truncate test asserts the RangeError only for a negative max (-1), never for 0."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "slugify with tests",
      "files": {"create": ["src/slugify.mjs"], "modify": [], "test": ["tests/e5-slugify.test.mjs"]},
      "writes": ["src/slugify.mjs", "tests/e5-slugify.test.mjs"],
      "noCommit": false,
      "deps": [],
      "produces": ["slugify(text: string): string from src/slugify.mjs"],
      "consumes": [],
      "external": false,
      "locks": [],
      "testFirst": true,
      "checks": [{"cmd": "node --test tests/e5-slugify.test.mjs", "expect": "exit 0"}],
      "covers": ["AC1", "C1", "C2"],
      "score": {"ambiguity": 0, "reasoning": 1, "blast": 0, "verifiability": 0}
    },
    {
      "n": 2,
      "title": "truncate with tests",
      "files": {"create": ["src/truncate.mjs"], "modify": [], "test": ["tests/e5-truncate.test.mjs"]},
      "writes": ["src/truncate.mjs", "tests/e5-truncate.test.mjs"],
      "noCommit": false,
      "deps": [],
      "produces": ["truncate(text: string, max: number): string from src/truncate.mjs"],
      "consumes": [],
      "external": false,
      "locks": [],
      "testFirst": true,
      "checks": [{"cmd": "node --test tests/e5-truncate.test.mjs", "expect": "exit 0"}],
      "covers": ["AC2", "C3", "C4"],
      "score": {"ambiguity": 0, "reasoning": 1, "blast": 0, "verifiability": 0}
    },
    {
      "n": 3,
      "title": "wordCount with tests",
      "files": {"create": ["src/word-count.mjs"], "modify": [], "test": ["tests/e5-word-count.test.mjs"]},
      "writes": ["src/word-count.mjs", "tests/e5-word-count.test.mjs"],
      "noCommit": false,
      "deps": [],
      "produces": ["wordCount(text: string): number from src/word-count.mjs"],
      "consumes": [],
      "external": false,
      "locks": [],
      "testFirst": true,
      "checks": [{"cmd": "node --test tests/e5-word-count.test.mjs", "expect": "exit 0"}],
      "covers": ["AC3", "C5"],
      "score": {"ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0}
    }
  ],
  "evidence": [
    {"ac": "AC1", "kind": "test", "command": "node --test tests/e5-slugify.test.mjs", "testRef": "tests/e5-slugify.test.mjs", "external": false},
    {"ac": "AC2", "kind": "test", "command": "node --test tests/e5-truncate.test.mjs", "testRef": "tests/e5-truncate.test.mjs", "external": false},
    {"ac": "AC3", "kind": "test", "command": "node --test tests/e5-word-count.test.mjs", "testRef": "tests/e5-word-count.test.mjs", "external": false}
  ],
  "rulings": [
    {
      "id": "R4",
      "question": "Which locks do the tasks and the evidence commands need?",
      "decision": "None: task checks and evidence run only the E5 test files, which bind no port; the full gate G1 with lock sandbox-port is run by the workflow gate stage.",
      "alternative": "Each task runs the full node --test and holds sandbox-port.",
      "basis": "Only tests/baseline.test.mjs binds port 48731; the spec says the per-criterion evidence commands run only the E5 test files.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "How is the work split?",
      "decision": "One test-first task per card piece, with no dependencies between tasks.",
      "alternative": "A single task for the three modules.",
      "basis": "The pieces are independent and each touches two new files.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
