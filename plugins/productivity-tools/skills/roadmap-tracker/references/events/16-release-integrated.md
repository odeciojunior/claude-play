# § 16. Release branch integrated

**When:** the release branch is merged into `integrationBranch`, or the checker warns `integrated-pending` (a row whose segments are all on-branch and whose SHAs are already ancestors of the integration branch). At cold start, that warning leads to proposing this recipe to the user.

1. Take one SHA that entered the integration branch (the merge or merged tip); ask for it if git cannot show it. Check it: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" verify-commit "<folder>" <sha> --json` → `exists` and `integrated` both true. `integrated` false → do not mark integrated; tell the user.
2. Mark it: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" integrate "<folder>" --sha <sha> [--only E<a>,E<b>]`. In one batch it moves to the integrated word (position 6) every row whose segments are all on-branch with SHAs that are ancestors of the integration ref, adds the SHA to Evidence and writes its own log row (do not add one). Only rows whose pieces the merge carried change; others stay. Exit 0 with `integrated: []` is a no-op: say so. Without git it refuses (DEC-201: integrated or later is never set unverified), and `sha-missing` and `sha-not-integrated` are exit 1: report them, never edit the panel by hand to get around them.
3. "In flight": the release branch stays live while it exists; deleted → § 4 (`inflight-remove`).
4. Refresh `critical-path.md`, then § 2 step 4 (phase exit criteria) and the header line.

Checker: `not-integrated`, `integrated-no-sha`; `integrated-pending` should disappear.
