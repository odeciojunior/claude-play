# Rubric: does a decision contradict the strategy?

Read by the recipes `events.md § 1` and `§ 18` to fill the **Contradicts** cell of a `decisions.md` row.

**The one question:** after this decision, does the strategy have to say something different from what it says now?

## What the strategy asserts

Check the decision against each of these, only the ones it touches:

- The card of the deliverable: pieces (what each delivers and their order), acceptance criteria, definition of done, and the attrs `priority`, `phase`, `track`, `depends`, `reqs`.
- The objective, the non-goals, the thesis, the order of the phases and the deliverables overview.

## Classes

| Class | Meaning | Contradicts cell |
|---|---|---|
| `contradiz` | overrides one of those assertions | the section, e.g. `E2 (pieces)`, `E3 (depends)`, `Non-goals` |
| `detalha` | fills in what the strategy leaves open | `-` |
| `diverge de DEC` | an executor row (§ 18) that goes against an in-force decision; an owner decision that replaces one is § 1 step 2, not this class | that ID, e.g. `DEC-001` |
| `incerto` | cannot tell after the tie-breakers | ask once, recommending the filled cell; under `no questions` write the closest strategy section and add a `pending` item `(user) confirm Contradicts of DEC-NNN` |

A decision that is both names both, separated by a comma.

## Tie-breakers

- Touching the same deliverable is not enough; the decision has to change what the strategy says.
- An implementation detail the card does not mention is `detalha`.
- Changing a criterion, a `depends`, a `priority`, a `phase` or what a piece delivers is `contradiz`.
- Postponing or cutting a non-goal is `contradiz` (`Non-goals`).
- The owner amendment written by `ratify <DEC-NNN> --amend <text>` refines the ratified decision and gets `-` (DEC-209), unless its text changes what the strategy says; then fill the cell as above.
- When two classes fit, `contradiz` wins: a spurious `contradiction-unabsorbed` warning costs one revision proposal, a missed one leaves the strategy stale.

## Worked examples

All are invented (example) over `scripts/fixtures/valid`, columns as in its `decisions.md`.

`contradiz`:

| ID | Date | Deliverable | Decision | Discarded alternative | Contradicts | Revisit when | Origin | Status |
|---|---|---|---|---|---|---|---|---|
| DEC-002 (example) | 2026-01-05 | E2 | Sharing moves to E3 and E2 keeps only create and edit | Keep both pieces in E2 | E2 (pieces), DEC-001 | The owner reprioritizes sharing | user | in-force |
| DEC-003 (example) | 2026-01-06 | E3 | Reports start after E1 alone, without waiting for E2 | none stated | E3 (depends) | E2 slips | user | in-force |
| DEC-004 (example) | 2026-01-07 | E2 | Sharing is accepted by an integration test, not by the owner | Owner opens a shared item | E2 (acceptance) | The share flow changes | user | in-force |
| DEC-005 (example) | 2026-01-08 | E3 | Reports become Must | Keep Should | E3 (priority) | The owner reprioritizes | user | in-force |

Reasons: 002 changes what a piece delivers (and goes against in-force DEC-001, so it names both); 003 changes `depends`; 004 replaces `{verify: human}` on a criterion; 005 changes `priority`.

`detalha`:

| ID | Date | Deliverable | Decision | Discarded alternative | Contradicts | Revisit when | Origin | Status |
|---|---|---|---|---|---|---|---|---|
| DEC-006 (example) | 2026-01-05 | E1 | Items are stored in SQLite | A JSON file | - | Volume outgrows one file | user | in-force |
| DEC-007 (example) | 2026-01-06 | E2 | A shared link expires after 7 days | none stated | - | The owner wants permanent links | user | in-force |
| DEC-008 (example) | 2026-01-07 | E3 | The report lists newest items first | none stated | - | Users ask for sorting | user | in-force |

Reasons: the card is silent on storage engine, link lifetime (its risk says the sharing rules are undecided) and ordering, so each only fills a gap.

`diverge de DEC`: an executor row that picks a different sharing rule than in-force DEC-001 writes `DEC-001` in Contradicts and goes to the owner.
