# § 3. Integration

**When:** a branch with roadmap work is merged into the configured `integrationBranch`. With `releaseBranch` set, a merge into that branch is § 15 instead, and the later merge of the release branch into `integrationBranch` is § 16. Decide first, once: `releaseBranch` set or a caller-supplied target (below) → § 15, else this recipe; § 15 never sends the event back here.

Caller-supplied target: when `releaseBranch` is unset and the caller names the branch the work merged into (for example the target of `roadmap-release`), apply § 15 with that branch: on-branch word, merge SHA in Evidence, the branch named in Next step. Never infer the target from the checked-out branch.

1. Get the SHA that entered the integration branch (the merge commit, or the merged tip for a fast-forward or squash result); ask for it if git cannot show it. Verify with `git cat-file -e <sha>^{commit}` and `git merge-base --is-ancestor <sha> <ref>`, where `<ref>` is the local `integrationBranch` or `origin/<integrationBranch>`: either one passing is enough, so a stale local branch is fine (the checker also accepts either). Neither passes → do not mark integrated; tell the user.
2. `state.md` panel: the integrated word (position 6 of `deliverableStatuses`) for the pieces it carries (never set a released status here: that goes through § 12, which also records the package). Put that SHA in backticks in Evidence, alongside any branch SHAs of pieces not yet integrated. The checker needs at least one Evidence SHA that is an ancestor of the integration ref when the row has an integrated segment; the other SHAs only need to exist.
3. `state.md` "in flight": the branch stays `vocab.branchLive` while it exists; deleted → § 4.
4. `log.md`: "E<n> piece <k> integrated into <branch>", evidence the SHA. A log SHA that no longer exists (a deleted or squashed branch) is only a `sha-missing` warning, so old log rows stay as written.
5. Refresh `critical-path.md` (next milestone per track), then § 2 step 4 (end of piece or phase? phase exit criteria first).

Checker: `not-integrated`, `sha-missing`, `integrated-no-sha`; `shallow-clone` or `integration-branch-missing` warnings mean the ancestry was not verified: say so in the report.
