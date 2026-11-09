<!-- roadmap:version 1.0 2026-01-01 -->
# Sample Roadmap -- Strategy v1.0

## Changelog

- v1.0 (2026-01-01): first version. Absorbs DEC-001.

## Objective

Ship a small sample service. Acceptance criterion: a user can complete the main flow end to end. Definition of done: all Must deliverables integrated.

## Non-goals

- Anything listed as out-of-scope in `requirements.md`.

## Assumptions

None recorded.

## Where we are

No deliverable started. See `state.md`.

## Thesis

Build the thinnest end-to-end flow first, then widen it.

## Deliverables overview

| ID | Title | Phase | Depends on |
|---|---|---|---|
| E1 | Walking skeleton | Skeleton | - |
| E2 | Main flow | Main flow | E1 |
| E3 | Reports | Main flow | E1, E2 |

## Phases

| Phase (outcome) | Entry criteria | Exit criteria | Deliverables |
|---|---|---|---|
| A thin end-to-end path works | Roadmap approved | One item travels input to storage and back | E1 |
| Users complete the main flow | The thin path is integrated | A user completes the main flow and sees reports | E2, E3 |

## Deliverables

<!-- roadmap:card id=E1 phase=skeleton track=engineering priority=Must size="not estimated" depends=- reqs=REQ-001 critical=true -->
### E1 -- Walking skeleton

Why: REQ-001. A thin path through every layer.

Pieces:

- Piece 1: one request travels from input to storage and back.

<!-- roadmap:acceptance -->
1. Given an empty system, when a user submits one item, then the item is stored and shown back. {verify: test; evidence: node --test tests/e1.test.mjs}
2. Given a stored item, when the user reloads, then the same item is shown. {verify: smoke; evidence: node scripts/smoke.mjs reload}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch; G1 and G2 green.

<!-- roadmap:risks -->
- The storage layer is unproven -> build it first and test it alone.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E2 phase=main-flow track=engineering priority=Must size="not estimated" depends=E1 reqs=REQ-001,REQ-002 critical=true -->
### E2 -- Main flow

Why: REQ-001, REQ-002.

Pieces:

- Piece 1: create and edit items.
- Piece 2: share items.

<!-- roadmap:acceptance -->
1. Given a stored item, when the user edits it, then the change is saved. {verify: test; evidence: node --test tests/e2.test.mjs}
2. Given a stored item, when the user shares it, then the recipient can open it. {verify: human; evidence: owner opens a shared item in the integration build}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch; G1 and G2 green.

<!-- roadmap:risks -->
- Sharing rules are undecided -> settle them with the owner before the plan.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E3 phase=main-flow track=engineering priority=Should size="not estimated" depends=E1,E2 reqs=REQ-002 critical=true -->
### E3 -- Reports

Why: REQ-002.

Pieces:

- Piece 1: a list of items per user.

<!-- roadmap:acceptance -->
1. Given several stored items, when the user opens the report, then every item is listed. {verify: integration; evidence: node --test tests/reports.test.mjs}
2. Given no items, when the user opens the report, then an empty message is shown. {verify: test; evidence: node --test tests/reports.test.mjs}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch; G1 and G2 green.

<!-- roadmap:risks -->
- Report volume is unmeasured -> test with a large item list first.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

## Gates and verification

<!-- roadmap:gates -->
| ID | Command | Environment | When | Baseline |
|---|---|---|---|---|
| G1 | `node --test` | local | every task and merge | green |
| G2 | `node scripts/smoke.mjs` | local | before each merge | green |
<!-- /roadmap:gates -->

## Metrics and targets

None supplied.

## Flags

None.

## Cross-cutting risks

- Scope growth in the main flow.

## Decisions

Decisions live in `decisions.md`. This strategy absorbs DEC-001.

## External pending items

None.

## Open questions

None.

## Coverage summary

Two requirements covered, one out of scope.

## Version history

| Version | Date | Summary |
|---|---|---|
| 1.0 | 2026-01-01 | First version |

## Sources

See `sources.md`.
