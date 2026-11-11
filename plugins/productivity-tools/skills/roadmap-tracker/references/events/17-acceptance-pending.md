# § 17. Acceptance pending

**When:** the code of a deliverable is ready but the acceptance (usually human, for example a client sign-off or a smoke test in an environment nobody has yet) is not done.

1. `state.md` panel Status in segments: `code: on-branch; acceptance: blocked (BLQ-n)` (words from `vocab`; segment rules in formats.md § 4). The `BLQ-n` is a real blockers row: open it per § 5 if it does not exist.
2. Evidence cites the code SHA and the gate; Next step names who must accept and what the evidence will be.
3. Human acceptance is never recorded as done without evidence: a sign-off message, a path to the signed record, or a command output the user supplies. No evidence → the acceptance segment stays blocked.
4. When the evidence arrives: update the segment, close the blocker (§ 5), log the acceptance with that evidence. If the card's acceptance items carry `{verify: ...}` tags, the item's tag and evidence must match what was shown (`ac-verify-invalid` / `ac-verify-missing` are the warnings to watch).
