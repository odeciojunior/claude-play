# § 5. Blocker opened or closed

**Opened:**

1. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" block-open "<folder>" --what "<the blocker>" --affects E<a>[,E<b>] --unblocks "<condition>" [--piece <label>] [--since YYYY-MM-DD] [--evidence <ref>]`. `--what` is the text of the blocker (DEC-202), not a log phrase. In one write it takes the next `BLQ-n`, sets `vocab.blockedStatus` on each affected deliverable (the whole row, or only the segment named by `--piece`), adds the blockers row (Since defaults to today) with "restores E<n> to <status>" appended to Unblocks when (DEC-148), and writes its own log row (do not add one). A blocker with a deadline writes it as `(due YYYY-MM-DD)` in `--unblocks`, a date the user or a source supplied. The `blocker-overdue` warning is handled by proposing to escalate to the blocker's owner; the checker never closes it. Refusals are exit 1: report them (`not-found`, `segment-required` when a row has several segments and no `--piece`, `segment-locked`).
   - Exception (§ 17, acceptance pending): the row is already in segments; pass `--piece acceptance` so only that segment is blocked.
2. By hand: update Next step of the affected deliverables and `now`; if the blocker forbids an action, also § 13.
3. `critical-path.md`: the gate it holds, then refresh the next milestone per track (Common), by hand.

**Closed:**

1. If a decision closed it, apply § 1 first.
2. Rewrite by hand every remaining citation of the `BLQ-n` that the CLI does not touch: `pending`, `now`, panel notes, `critical-path.md` (remove the gate node, then refresh the next milestone per track, Common). A `pending` item that must continue is reworded without the BLQ id (for example `(owner) ...`), never deleted only because it cited the blocker. The strategy is not edited: it may keep citing the closed `BLQ-n`, and its Open questions entry is cleaned at the next approved revision (§ 9).
3. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" block-close "<folder>" BLQ-n --how "<how>" --evidence <ref> [--next E<n>=<text>]...`. It restores each affected deliverable from `vocab.blockedStatus` to the status recorded in the blockers row (a row in segments only has its blocked segment restored), removes the row, drops `donot` items that cite only this blocker, and writes its own log row (do not add one). `--next E<n>=<text>` replaces the Next step of a restored deliverable: use it to drop the "wait for BLQ-n" clause. No SHA or path (a phone call) → cite `decisions.md` or `state.md`, whichever now holds the change.
4. Refusals are exit 1: report them, never edit around them (DEC-148). `blocker-cited` lists the `file:line` still citing the `BLQ-n`: rewrite that text (step 2) and run it again. `restore-unreadable`: "Unblocks when" does not say which status the deliverable returns to. `not-found`: the blocker row does not exist.
5. Afterwards update the panel Next step and `now` for what still waits, by hand.

Checker: `unknown-id` (a `BLQ` cited in `state.md` or `critical-path.md` without a row), `duplicate-id`.
