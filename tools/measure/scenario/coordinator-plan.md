# Fixed plan: three small statistics helpers

Goal: add three pure functions, one per step, each with its own test. Run every command from the repository root. No dependencies.

### Step 1: sum

- Create `src/sum.mjs` exporting `sum(numbers)`, which returns the total of an array of numbers (0 for an empty array).
- Create `tests/coord-sum.test.mjs` asserting `sum([1, 2, 3])` is 6 and `sum([])` is 0.
- Verify: `node --test tests/coord-sum.test.mjs`
- Commit: `feat(stats): add sum`

### Step 2: mean

- Create `src/mean.mjs` exporting `mean(numbers)`, which returns the arithmetic mean and `NaN` for an empty array. It may import `sum` from `src/sum.mjs`.
- Create `tests/coord-mean.test.mjs` asserting `mean([2, 4, 6])` is 4 and `mean([])` is `NaN`.
- Verify: `node --test tests/coord-mean.test.mjs`
- Commit: `feat(stats): add mean`

### Step 3: median

- Create `src/median.mjs` exporting `median(numbers)`, which returns the middle value of the sorted numbers (the average of the two middle values for an even count) and `NaN` for an empty array. It must not mutate its input.
- Create `tests/coord-median.test.mjs` asserting `median([3, 1, 2])` is 2, `median([4, 1, 3, 2])` is 2.5 and `median([])` is `NaN`.
- Verify: `node --test tests/coord-median.test.mjs`
- Commit: `feat(stats): add median`
