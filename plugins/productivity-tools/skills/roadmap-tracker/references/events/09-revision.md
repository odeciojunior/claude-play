# § 9. End of piece or phase (revision)

**When:** a piece or phase ends, the checker warns `contradiction-unabsorbed`, a requirement awaits a card, or the user asks. This file is the whole revision procedure (SKILL.md Step 6 points here). Strategy layout, version anchor, changelog and version history: `formats.md § 5`.

## Review before proposing

- In-force decisions with a filled Contradicts not yet cited by the strategy.
- Requirements with `needs-clarification` or `req-card-asymmetry`.
- Phase exit criteria: met? Next phase entry criteria: met?
- Assumptions whose "re-validate when" condition has fired.
- Open questions (the `E<n>:`-prefixed ones and the global ones) whose pending item or `BLQ` was closed or answered: remove them or mark them answered, citing the `DEC`; also stale citations of retired `BLQ-n`.
- Risks that materialized or vanished; critical-path changes.
- "Where we are": what `state.md` and `critical-path.md` now say.

## 1. Propose (in the conversation, not in a file)

New version: minor bump (`1.0` → `1.1`) unless the user wants a major one for a changed objective or phases. Nothing to change → say so and write nothing (the user may still ask for a revision).

```
Strategy v<N> -> v<N+1> (proposed, not written)
Absorbs: DEC-…
Sections: <section>: <one-line change>   (one line each)
Cards: <E<n>>: <pieces / acceptance / reqs / priority change>
Requirements: <REQ-…>: <coverage change>
Unchanged: everything else
Approve?
```

## 2. Approval

Ask (AskUserQuestion when available). Until the user approves, write nothing to the strategy. Not approved or unanswered: the proposal lives only in the conversation plus one pending item, `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" add-pending "<folder>" --owner user --text "approve strategy v<N+1> (absorbs DEC-…)"`; nothing else is written and the warning stays (the run may end with it). A later run (after compaction or in a new session) regenerates the proposal from the `DEC` rows that item names and the review list above.

A pre-approval given by a caller or an orchestrator (an autonomy policy, "the owner pre-approved") is not the user's approval: with no person present, write only the pending item and say so in the hand-back. When the event says `no questions`, never ask: write each unanswered question as a `pending` item `(user) <question>` and list them under `Pending for the user:` in the Step 7 hand-back.

## 3. On approval, in this order

1. Strategy: `version` anchor (`<!-- roadmap:version <N+1> <date> -->`) and title; changelog entry (newest first) listing the absorbed `DEC`; changed sections, citing each absorbed `DEC` where it applies; "Where we are" regenerated from `state.md` and `critical-path.md`; version-history row.
2. What the revision moved: `state.md` panel rows for new or dropped cards, `requirements.md`, `critical-path.md`, the `state.md` header line.
3. Remove the approval pending item (it is `state.md`'s `pending` block; no command removes one, edit that line).
4. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" log "<folder>" --deliverable - --what "strategy v<N+1>: absorbs DEC-…" --evidence <strategy path>`, then the checker (SKILL.md Step 5).

## Rejected

The user may change the decision instead: that is a new decision (§ 1) superseding the old one.
