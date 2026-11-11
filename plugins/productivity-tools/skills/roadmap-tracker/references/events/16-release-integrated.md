# § 16. Release branch integrated

**When:** the release branch is merged into `integrationBranch`, or the checker warns `integrated-pending` (a row whose segments are all on-branch and whose SHAs are already ancestors of the integration branch). At cold start, that warning leads to proposing this recipe to the user.

1. Take one SHA that entered the integration branch (the merge or merged tip); verify as in § 3 step 1. Ask for it if git cannot show it.
2. `state.md` panel: turn every affected row, in one batch, to the integrated word (position 6), and cite that SHA in Evidence next to the existing ones. Only rows whose pieces the merge carried change; others stay.
3. `state.md` "in flight": the release branch stays live while it exists; deleted → § 4.
4. `log.md`: one row "E<a>, E<b> integrated into <integrationBranch> via <releaseBranch>", evidence the SHA.
5. Refresh `critical-path.md`, then § 2 step 4 (phase exit criteria) and the header line.

Checker: `not-integrated`, `integrated-no-sha`; `integrated-pending` should disappear.
