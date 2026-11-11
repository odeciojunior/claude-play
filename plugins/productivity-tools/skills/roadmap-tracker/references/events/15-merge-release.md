# § 15. Merge into the release branch

**When:** `releaseBranch` is set in `roadmap.config.json` and a deliverable (or piece) merges into it. Without `releaseBranch` and without a caller-supplied target (below), use § 3. Order, once: check `releaseBranch` and the caller's target first; § 3 and § 15 never hand the event back and forth.

Caller-supplied target: when `releaseBranch` is unset and the caller names the branch the work merged into (for example the target of `roadmap-release`), apply § 15 with that branch: on-branch word, merge SHA in Evidence, the branch named in Next step. Never infer the target from the checked-out branch.

1. Get the merge SHA on the release branch and verify it with `git cat-file -e <sha>^{commit}`.
2. `state.md` panel: Status is the on-branch word (position 5 of `deliverableStatuses`), never the integrated word. Evidence cites the merge SHA in backticks. Next step names the release branch (for example "release/2026-11 merges into main after the release gate"). Write that note in Next step only, not again per deliverable in another cell or in `now`.
3. `log.md`: "E<n> merged into <releaseBranch>", evidence the merge SHA. Several deliverables merged in one go → one row listing them (Common).
4. Refresh `critical-path.md` and the header line (Common).

Checker: `integrated-no-sha` does not fire for the on-branch word; the `integrated-pending` warning appears later, once the release branch reaches `integrationBranch` (§ 16).
