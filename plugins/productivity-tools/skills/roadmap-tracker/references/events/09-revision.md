# § 9. End of piece or phase (revision)

**When:** a piece or phase ends, the checker warns `contradiction-unabsorbed`, a requirement awaits a card, or the user asks. Procedure and approval below.

Review before proposing:

- In-force decisions with a filled Contradicts not yet cited by the strategy.
- Requirements with `needs-clarification` or `req-card-asymmetry`.
- Phase exit criteria: met? Next phase entry criteria: met?
- Assumptions whose "re-validate when" condition has fired.
- Open questions (the `E<n>:`-prefixed ones and the global ones) whose pending item or `BLQ` was closed or answered: remove them or mark them answered, citing the `DEC`; also stale citations of retired `BLQ-n`.
- Risks that materialized or vanished; critical-path changes.
- "Where we are": what `state.md` and `critical-path.md` now say.

Proposal (in the conversation, not in a file):

```
Strategy v<N> -> v<N+1> (proposed, not written)
Absorbs: DEC-…
Sections: <section>: <one-line change>   (one line each)
Cards: <E<n>>: <pieces / acceptance / reqs / priority change>
Requirements: <REQ-…>: <coverage change>
Unchanged: everything else
Approve?
```

Nothing to change → say so and write nothing. Not approved → leave the strategy untouched; the proposal lives only in the conversation plus the pending item "(user) approve strategy v<N+1> (absorbs DEC-…)" in `state.md`, nothing else is written, and the warning stays. A later run (after compaction or in a new session) regenerates the proposal from the `DEC` rows that pending item names.

On approval, in this order: strategy (`version` anchor, title, changelog entry listing the absorbed `DEC`, changed sections citing each `DEC`, "Where we are", version-history row), then `state.md` panel rows for new or dropped cards, `requirements.md`, `critical-path.md`, remove the pending approval item, `log.md` "strategy v<N+1>: absorbs DEC-…" with the strategy path as evidence, then the checker.

### Revision procedure (SKILL.md Step 6)

1. **Propose** strategy vN+1 in the conversation, without writing it: the new version (minor bump, `1.0` → `1.1`, unless the user wants a major one for a changed objective or phases), the `DEC` IDs it absorbs, each section that changes with one line on how, card changes (pieces, acceptance, `reqs`, priority), and requirement or coverage changes. Checklist: the "Review before proposing" list above. If nothing needs changing, say so; the user may still ask for a revision.
2. **Ask for approval** (AskUserQuestion when available). Until the user approves, write nothing to the strategy. The proposal lives only in the conversation plus one pending item "(user) approve strategy v<N+1> (absorbs DEC-…)"; nothing else is written. A pre-approval given by a caller or an orchestrator (an autonomy policy, "the owner pre-approved") is not the user's approval: with no person present, write only the pending item and say so in the hand-back. After a compaction or in a new session, regenerate the proposal from the `DEC` rows the pending item names (and the checklist above). The contradiction warning stays and the run may end with it. When the event says `no questions`, never ask: write each unanswered question as a `pending` item `(user) <question>` and list them under `Pending for the user:` in the Step 7 hand-back.
3. **On approval:** update the `version` anchor (`<!-- roadmap:version <N+1> <date> -->`) and the title; add a changelog entry (newest first) listing the absorbed `DEC`; edit the changed sections and cite each absorbed `DEC` ID where it applies; regenerate "Where we are" from `state.md` and `critical-path.md`; add a version-history row. Then update whatever the revision moved (panel rows for new or dropped cards, `requirements.md`, `critical-path.md`, the `state.md` header line), remove the approval pending item, add a `log` row "strategy v<N+1>: absorbs DEC-…" with the strategy path as evidence, and rerun Step 5.
4. **Rejected:** the user may change the decision instead; that is a new decision (§ Decision, superseding the old one).
