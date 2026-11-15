# Fixed plan: three small statistics helpers

Goal: add three pure functions, one per step, each with its own test. Run every command from the repository root. No dependencies.

### Tarefa 1: sum

- Create `src/sum.mjs` exporting `sum(numbers)`, which returns the total of an array of numbers (0 for an empty array).
- Create `tests/coord-sum.test.mjs` asserting `sum([1, 2, 3])` is 6 and `sum([])` is 0.
- Verify: `node --test tests/coord-sum.test.mjs`
- Commit: `feat(stats): add sum`

### Tarefa 2: mean

- Create `src/mean.mjs` exporting `mean(numbers)`, which returns the arithmetic mean and `NaN` for an empty array. It may import `sum` from `src/sum.mjs`.
- Create `tests/coord-mean.test.mjs` asserting `mean([2, 4, 6])` is 4 and `mean([])` is `NaN`.
- Verify: `node --test tests/coord-mean.test.mjs`
- Commit: `feat(stats): add mean`

### Tarefa 3: median

- Create `src/median.mjs` exporting `median(numbers)`, which returns the middle value of the sorted numbers (the average of the two middle values for an even count) and `NaN` for an empty array. It must not mutate its input.
- Create `tests/coord-median.test.mjs` asserting `median([3, 1, 2])` is 2, `median([4, 1, 3, 2])` is 2.5 and `median([])` is `NaN`.
- Verify: `node --test tests/coord-median.test.mjs`
- Commit: `feat(stats): add median`

## Evidence

| AC | Kind | Command | Test | External |
|---|---|---|---|---|
| AC1 | test | `node --test tests/coord-sum.test.mjs` | tests/coord-sum.test.mjs | no |
| AC2 | test | `node --test tests/coord-mean.test.mjs` | tests/coord-mean.test.mjs | no |
| AC3 | test | `node --test tests/coord-median.test.mjs` | tests/coord-median.test.mjs | no |

```json data
{
  "schema": "plan/1",
  "id": "stats-helpers",
  "title": "Three small statistics helpers",
  "spec": "coordinator-spec-native.md",
  "roadmap": null,
  "constraints": [
    "Pure functions: no I/O and no dependency.",
    "Run every command from the repository root."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "sum",
      "files": {"create": ["src/sum.mjs"], "modify": [], "test": ["tests/coord-sum.test.mjs"]},
      "writes": ["src/sum.mjs", "tests/coord-sum.test.mjs"],
      "noCommit": false,
      "deps": [],
      "produces": ["sum(numbers: number[]): number from src/sum.mjs"],
      "consumes": [],
      "external": false,
      "locks": [],
      "testFirst": true,
      "checks": [{"cmd": "node --test tests/coord-sum.test.mjs", "expect": "exit 0"}],
      "covers": ["AC1", "C1"],
      "score": {"ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0}
    },
    {
      "n": 2,
      "title": "mean",
      "files": {"create": ["src/mean.mjs"], "modify": [], "test": ["tests/coord-mean.test.mjs"]},
      "writes": ["src/mean.mjs", "tests/coord-mean.test.mjs"],
      "noCommit": false,
      "deps": [1],
      "produces": ["mean(numbers: number[]): number from src/mean.mjs"],
      "consumes": [{"task": 1, "sig": "sum(numbers: number[]): number from src/sum.mjs"}],
      "external": false,
      "locks": [],
      "testFirst": true,
      "checks": [{"cmd": "node --test tests/coord-mean.test.mjs", "expect": "exit 0"}],
      "covers": ["AC2"],
      "score": {"ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0}
    },
    {
      "n": 3,
      "title": "median",
      "files": {"create": ["src/median.mjs"], "modify": [], "test": ["tests/coord-median.test.mjs"]},
      "writes": ["src/median.mjs", "tests/coord-median.test.mjs"],
      "noCommit": false,
      "deps": [2],
      "produces": ["median(numbers: number[]): number from src/median.mjs"],
      "consumes": [],
      "external": false,
      "locks": [],
      "testFirst": true,
      "checks": [{"cmd": "node --test tests/coord-median.test.mjs", "expect": "exit 0"}],
      "covers": ["AC3"],
      "score": {"ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0}
    }
  ],
  "evidence": [
    {"ac": "AC1", "kind": "test", "command": "node --test tests/coord-sum.test.mjs", "external": false},
    {"ac": "AC2", "kind": "test", "command": "node --test tests/coord-mean.test.mjs", "external": false},
    {"ac": "AC3", "kind": "test", "command": "node --test tests/coord-median.test.mjs", "external": false}
  ],
  "rulings": [],
  "needsPerson": []
}
```
