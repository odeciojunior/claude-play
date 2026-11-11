# § 4. Branch deleted

**When:** a branch listed in "in flight" is deleted (or a new one starts).

1. Verify it is gone: `git rev-parse --verify --quiet refs/heads/<b>` and `refs/remotes/origin/<b>` both fail.
2. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" inflight-remove "<folder>" <b>`: removes the row (exit 0 and a no-op when it is not listed). The history lives in the log, so the row needs no `vocab.branchDeleted` Kind. It writes no log row.
3. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" log "<folder>" --deliverable E<n> --what "branch <b> deleted (merged at <sha> | abandoned: <reason>)" --evidence <merge SHA or state.md>` (`--deliverable -` when no deliverable owns it).
4. A new branch: after confirming it exists, `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" inflight-add "<folder>" <b> --note "<note>"` (adds the row with Kind `vocab.branchLive`; a branch already live is a no-op).

Checker: `branch-deleted-exists`, `branch-live-missing`.
