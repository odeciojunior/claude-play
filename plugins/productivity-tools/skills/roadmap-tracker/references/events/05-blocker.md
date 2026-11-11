# § 5. Blocker opened or closed

**Opened:**

1. `state.md` blockers: next `BLQ-n` (search `state.md`, `log.md`, `critical-path.md` and the strategy). Columns: Blocker, Affects (`E<n>` list), Since (the day it started), Unblocks when (a condition). A blocker with a deadline writes it as `(due YYYY-MM-DD)` in Unblocks when, a date the user or a source supplied. The `blocker-overdue` warning (the date is before today) is handled by proposing to escalate to the blocker's owner; the checker never closes it.
2. `state.md`: a deliverable the blocker blocks gets the status `vocab.blockedStatus` (Common; a blocked segment cites the `BLQ-n` in its note or Next step). Before overwriting, record the previous status in the BLQ row ("Unblocks when" or note, for example "restores E2 to `piece 1: on-branch`"). Also update Next step of the affected deliverables and `now`. If the blocker forbids an action, also § 13.
   - Exception (§ 17, acceptance pending): the row is already in segments (`code: ...; acceptance: blocked (BLQ-n)`). Keep the segments when opening; do not overwrite the row with the bare blocked word, and record no previous status to restore.
3. `critical-path.md`: the gate it holds, then refresh the next milestone per track (Common).
4. `log.md`: "BLQ-n opened: <short>", evidence a path, URL or SHA.

**Closed:**

1. If a decision closed it, apply § 1 first.
2. `state.md`: read the previous status recorded in the BLQ row, then remove the row (the log keeps the history; the log and the strategy may keep citing a retired `BLQ-n`); restore each affected deliverable from `vocab.blockedStatus` to that previous status (exception, § 17: a row in segments only has its `acceptance` segment updated; `code` and the other segments stay); update panel and `now`; in the panel Next step replace the "wait for BLQ-n" clause with what still waits (other dependencies) or the next concrete action of the restored status; drop `donot` items citing this `BLQ-n`, and remove the `donot` block when none is left. Also rewrite every remaining citation of the closed `BLQ-n` in `state.md` (pending, now, panel notes, donot) and in `critical-path.md`. A `pending` item that must continue is reworded without the BLQ id (for example `(owner) ...`), never deleted only because it cited the blocker.
3. `critical-path.md`: remove the gate node, then refresh the next milestone per track (Common). Also rewrite every remaining citation of the closed `BLQ-n` here and in `state.md` (step 2).
4. The strategy is not edited: it may keep citing the closed `BLQ-n`, and its Open questions entry for it is cleaned at the next approved revision (§ 9).
5. `log.md`: "BLQ-n closed: <how>", evidence. No SHA or path (a phone call) → cite `decisions.md` or `state.md`, whichever now holds the change.

Checker: `unknown-id` (a `BLQ` cited in `state.md` or `critical-path.md` without a row), `duplicate-id`.
