# § 15. Merge into the release branch

**When:** `releaseBranch` is set in `roadmap.config.json` and a deliverable (or piece) merges into it. Without `releaseBranch` and without a caller-supplied target (below), use § 3. Order, once: check `releaseBranch` and the caller's target first; § 3 and § 15 never hand the event back and forth.

Caller-supplied target: when `releaseBranch` is unset and the caller names the branch the work merged into (for example the target of `roadmap-release`), apply § 15 with that branch: on-branch word, merge SHA in Evidence, the branch named in Next step. Never infer the target from the checked-out branch.

1. Get the merge SHA on the release branch and verify it with `git cat-file -e <sha>^{commit}` (`verify-commit` checks the integration branch, not this one).
2. Panel row: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" set-status "<folder>" E<n> <word> --evidence <sha> --next "<next action>"`. The word is the on-branch word (position 5 of `deliverableStatuses`), never the integrated one. Next step names the release branch (for example "release/2026-11 merges into main after the release gate"); write that note in Next step only, not again per deliverable in another cell or in `now`. A segmented row needs `--piece <label>`; `status-backward` and `segment-locked` are exit 1: report them.
3. The release branch stays live while it exists: `inflight-add "<folder>" <releaseBranch> --note "release branch"` (a no-op when it is already live in "in flight"; the file check is § 4 step 4).
4. `set-status` and `inflight-add` write no log row: `log "<folder>" --deliverable E<n> --what "E<n> merged into <releaseBranch>" --evidence <sha>`. Several deliverables merged in one go → one `log` row listing them (Common).
5. Refresh `critical-path.md` and the header line (Common).

Checker: `integrated-no-sha` does not fire for the on-branch word; the `integrated-pending` warning appears later, once the release branch reaches `integrationBranch` (§ 16).
