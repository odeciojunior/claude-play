# § 18. Executor decision

**When:** an executor (an implementing agent or a developer working a plan) made a choice the roadmap did not settle, such as picking a library, a name or a trade-off.

CLI form: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" <command> "<folder>"`. Refusals are exit 1 (DEC-139): `not-found` (no such `DEC`), `not-executor`, `not-pending`, `owner-missing`, `cell-too-long`, `banned-phrase`; report them, change nothing.

0. Autonomy first. Find the autonomy `DEC`: in `decisions.md`, the newest in-force row with Origin `user` whose Decision names the executor deciding (words "autonomy" or "executor"). If it says the executor does not decide alone, write no `decisions.md` row: `add-pending --owner owner --text "ratify: <choice>"` (name the `DEC` it diverges from or the gate it changes, when it does), then `log --deliverable - --what "executor choice pending for the owner: <choice>" --evidence state.md`, and skip steps 1-5 only: the common rules still apply, so update the `state.md` header line and `prune` as on every event. No such row, or one that allows it → treat as allowed.
1. One row per choice (never bundle two): `add-decision --deliverable <E<n>|-> --decision "<choice>" --scope <local|contrato> [--discarded "<what the executor dropped>"] [--contradicts "<DEC-NNN>"]`. It allocates the `DEC-NNN`, sets Origin `executor` and Status `vocab.decisionPending`, writes `none stated` when `--discarded` is absent, and does nothing on a repeated choice.
2. Contradicts: classify with `references/rubric-contradiction.md` (class `diverge de DEC` when the choice goes against an in-force `DEC`; pass that ID in `--contradicts`). The executor never replaces an existing decision alone: the row goes to the owner and the old row stays in force until the owner ratifies (§ 1 step 2 then supersedes it).
3. `add-pending --owner owner --text "ratify DEC-NNN: <choice>"`.
4. If the pending decision affects a gate, update the critical-path decision-trail row and the panel Next step (§ 1 step 3).
5. `log --deliverable <E<n>|-> --what "DEC-NNN recorded (pending ratification)" --evidence decisions.md`. `add-decision` and `add-pending` write no log row.

**Owner ratifies:** `ratify DEC-NNN [DEC-MMM ...]` (several in one call, one log row, pending items dropped; `--what "<text>"` replaces the default log text).
- Owner amends while ratifying: `ratify DEC-NNN --amend "<text>" [--revisit "<text>"]` (one `DEC` only). It adds a row of Origin `user` in force and ratifies the original; the amendment row gets Contradicts `-` (DEC-209) unless its text changes what the strategy says, in which case fix the cell per the rubric.
- Owner rejects: `reject DEC-NNN --decision "<owner's decision>"` (§ 1 step 2).
- An item that exists only as pending (step 0 wrote no row) has no row to ratify: write the row (steps 1-2), `ratify` it, remove the id-less pending item by hand, run step 4 when the choice named a gate. When the owner rejects such an item, remove it and `log` the rejection with no row.

Checker: `contradiction-unabsorbed` once a filled, in-force row exists.
