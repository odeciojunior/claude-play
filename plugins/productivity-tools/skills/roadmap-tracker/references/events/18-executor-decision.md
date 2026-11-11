# § 18. Executor decision

**When:** an executor (an implementing agent or a developer working a plan) made a choice the roadmap did not settle, such as picking a library, a name or a trade-off.

0. Autonomy first. Find the autonomy `DEC`: in `decisions.md`, the newest in-force row with Origin `user` whose Decision names the executor deciding (words "autonomy" or "executor"). If it says the executor does not decide alone, write no `decisions.md` row: add the `state.md` `pending` item "(owner) ratify: <choice>" (naming the `DEC` it diverges from or the gate it changes, when it does) and the `log.md` row "executor choice pending for the owner: <choice>", evidence `state.md`, then skip steps 1-5 only: the common rules still apply, so update the `state.md` header line and prune as on every event. No such row, or one that allows it → treat as allowed.
1. `decisions.md`: one row per choice (never bundle two choices in one row). Origin `executor`. Status is the `vocab.decisionPending` word until the owner ratifies it. Discarded alternative: what the executor says it dropped, else `none stated`.
2. If the choice diverges from an existing in-force `DEC`, fill Contradicts with that ID. The executor never replaces an existing decision alone: the row goes to the owner, and the old row stays in force until the owner ratifies (§ 1 step 2 then supersedes it).
3. `state.md` `pending`: one item "(owner) ratify DEC-NNN: <choice>".
4. If the pending decision affects a gate, update the critical-path decision-trail row and the panel Next step (§ 1 step 3).
5. `log.md`: "DEC-NNN recorded (pending ratification)", evidence `` `decisions.md` ``. On ratification: Status to the in-force word, remove the pending item, log it. An item that exists only as pending (step 0 wrote no `decisions.md` row) has no row to flip: when the owner ratifies it, write the `decisions.md` row now (steps 1-2, Origin `executor`, Status the in-force word), remove the pending item, run step 4 when the choice named a gate, and log "DEC-NNN recorded (ratified)"; when the owner rejects it, remove the item and log the rejection with no row.

Checker: `contradiction-unabsorbed` once a filled, in-force row exists.
