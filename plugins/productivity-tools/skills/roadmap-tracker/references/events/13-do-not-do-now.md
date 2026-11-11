# § 13. Do not do now

**When:** a decision or a blocker forbids an action ("do not deploy to X until Y"), or stops forbidding it.

1. Add (to `state.md` `donot`): one list item naming the forbidden action and citing the `BLQ-n` or `DEC-NNN` that forbids it. An item with no reference → checker error `donot-no-ref`. When this creates the block for the first time, also add the "do not do now list changes" row to the README table (formats.md § 8).
2. Remove the item when its `BLQ`/`DEC` is resolved (blocker closed, decision superseded); this happens in the same event that closes it (§ 5, § 1) and again as the pruning pass of every event (Common).
3. `log.md` carries the event that caused the add or the removal; `donot` itself keeps no history.
