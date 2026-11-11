# Rubric: did the spec keep the card's criteria?

Read by the recipe `events.md § 19` to compare a card's `acceptance` items with the criteria of the spec the executor worked from.

For each criterion of the card, find the matching criterion of the spec (same intent, not same wording) and give it one class:

| Class | Meaning |
|---|---|
| `igual` | same condition, same result, same `verify` |
| `acrescentado` | a spec criterion the card does not have |
| `enfraquecido` | the spec asks for less than the card; one of the signals below |
| `reinterpretado` | the spec asks for something different, not less (another subject or outcome) |
| `ausente` | the card criterion has no match in the spec |

## Signals of `enfraquecido` (closed list)

1. The entry condition (Given/When) is narrowed.
2. The expected result is loosened (a bigger limit, "at least", "when possible").
3. The `verify` tag is weaker: `test`, `smoke` or `integration` became `human`; any kind became `blocked` with no blocker on the card; or the evidence has no command that exercises the criterion.
4. A negative case of the card (a refusal, "changes no file") was removed.
5. A card criterion is missing from the spec (`ausente` counts as weakened).

Anything else that differs is `acrescentado` or `reinterpretado`. When both fit, `enfraquecido` wins: a false "confirm" costs one question, a missed weakening ships a lighter acceptance.

## Worked examples

All are invented (example), in the card format of `scripts/fixtures/valid`.

| Signal | Card says | Spec says |
|---|---|---|
| 1 | Given a stored item, when the user edits it, then the change is saved. {verify: test; evidence: node --test tests/e2.test.mjs} | Given a stored item the owner created, when the user edits it, then the change is saved. {verify: test; evidence: node --test tests/e2.test.mjs} |
| 2 | Given several stored items, when the user opens the report, then every item is listed. {verify: integration; evidence: node --test tests/reports.test.mjs} | Given several stored items, when the user opens the report, then at least the first 50 items are listed. {verify: integration; evidence: node --test tests/reports.test.mjs} |
| 3 | Given a stored item, when the user reloads, then the same item is shown. {verify: smoke; evidence: node scripts/smoke.mjs reload} | Given a stored item, when the user reloads, then the same item is shown. {verify: human; evidence: owner reloads once} |
| 3 | Given an empty system, when a user submits one item, then the item is stored. {verify: test; evidence: node --test tests/e1.test.mjs} | Given an empty system, when a user submits one item, then the item is stored. {verify: test; evidence: the team agrees it works} |
| 4 | Given a read-only folder, when the user saves, then the save is refused and no file changes. {verify: test; evidence: node --test tests/save.test.mjs} | Given a writable folder, when the user saves, then the file is written. {verify: test; evidence: node --test tests/save.test.mjs} |
| 5 | Given no items, when the user opens the report, then an empty message is shown. {verify: test; evidence: node --test tests/reports.test.mjs} | (no criterion about an empty report) |

Not weakened (example): the spec adds "and the item shows its date" to the card's reload criterion with the same `verify`: `acrescentado`, or `igual` plus an extra one. The card says "the recipient can open it" and the spec says "the owner can revoke it": `reinterpretado`.

## Output

One `pending` item per criterion that is not `igual`, in the form `(owner) card says <A>, spec says <B>: confirm`, with its class at the end (for example `... : confirm (enfraquecido)`). For `ausente`, <B> is "nothing". Every criterion `igual`: no item; the closing log row says "criteria compared: none changed". Never edit the card. Keep the item within `limits.cellChars`: quote in <A> and <B> only the part that differs (the `verify` tag included when it differs). On `cell-too-long`, shorten and rerun `add-pending`; never drop the item.
