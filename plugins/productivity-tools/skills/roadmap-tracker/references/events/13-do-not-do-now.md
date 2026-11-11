# § 13. Do not do now

**When:** a decision or a blocker forbids an action ("do not deploy to X until Y"), or stops forbidding it.

1. Add (to `state.md` `donot`; no command adds one, edit the block, `formats.md § 6`): one list item naming the forbidden action and citing the `BLQ-n` or `DEC-NNN` that forbids it. An item with no reference → checker error `donot-no-ref`. When this creates the block for the first time, also add the "do not do now list changes" row to the README table (`formats.md § 8`).
2. Remove the item when its `BLQ`/`DEC` is resolved (blocker closed, decision superseded): `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" prune "<folder>"` drops the `donot` items whose reference is resolved or superseded (and dead `inflight` rows; exit 0 and a no-op when none). Run it in the same event that closes the reference (§ 5, § 1) and as the pruning pass of every event (Common).
3. `log.md` carries the event that caused the add or the removal; `donot` itself keeps no history. `prune` and the manual add write no log row: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" log "<folder>" --deliverable <E<n> or -> --what "<action> added to (or removed from) do not do now" --evidence <BLQ or DEC id, or state.md>`.
