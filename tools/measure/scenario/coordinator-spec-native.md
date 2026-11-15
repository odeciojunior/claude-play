# Fixed plan: three small statistics helpers (spec)

## Intent

Three pure statistics helpers, one per step: `sum`, `mean` and `median`, each in its own module under `src/` with its own test under `tests/`. This spec exists so the native fixture `coordinator-plan-native.md` has the spec its `plan/1` block points to.

## Scope

In: `src/sum.mjs`, `src/mean.mjs`, `src/median.mjs` and their tests. Out: any dependency, I/O or other file.

```json data
{
  "schema": "spec/1",
  "id": "stats-helpers",
  "mode": "unattended",
  "title": "Three small statistics helpers",
  "acceptance": [
    {"id": "AC1", "text": "Given an array of numbers, when sum is called, then the total comes back (0 for an empty array). {verify: test; evidence: node --test tests/coord-sum.test.mjs}"},
    {"id": "AC2", "text": "Given an array of numbers, when mean is called, then the arithmetic mean comes back (NaN for an empty array). {verify: test; evidence: node --test tests/coord-mean.test.mjs}"},
    {"id": "AC3", "text": "Given an array of numbers, when median is called, then the middle value of the sorted numbers comes back without mutating the input (NaN for an empty array). {verify: test; evidence: node --test tests/coord-median.test.mjs}"}
  ],
  "rulings": [],
  "edgeCases": [
    {"id": "C1", "input": "any helper called with an empty array", "expected": "sum returns 0; mean and median return NaN"}
  ],
  "needsPerson": [],
  "externalEffects": []
}
```
