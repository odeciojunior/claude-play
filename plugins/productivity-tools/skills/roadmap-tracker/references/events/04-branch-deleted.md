# § 4. Branch deleted

**When:** a branch listed in "in flight" is deleted (or a new one starts).

1. Verify it is gone: `git rev-parse --verify --quiet refs/heads/<b>` and `refs/remotes/origin/<b>` both fail.
2. `state.md` "in flight": Kind → `vocab.branchDeleted`, Note "merged at `<sha>`" or "abandoned: <reason>". A later update may drop the row once the log has it.
3. `log.md`: "branch <b> deleted", evidence the merge SHA or `` `state.md` ``.
4. A new branch: add a row with Kind `vocab.branchLive` after confirming it exists.

Checker: `branch-deleted-exists`, `branch-live-missing`.
