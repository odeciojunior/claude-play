# § 2. Piece or step closed

**When:** a vertical slice of a deliverable, or a plan step that finishes one, is done; or plan-coordinator reports "wave N closed" / "plan completed" (§ 14).

1. Panel row of the deliverable (segment rules in `formats.md § 4`): `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" set-status "<folder>" E<n> <word> --piece <label> --evidence <ref> --next "<next concrete action>"`. Evidence: backticked SHAs, the spec or plan path, the progress file path; a SHA of a piece still on a branch only needs to exist. Code merged to the integration branch → § 3 instead (`set-status` refuses a word from position 6 on without an integration SHA in Evidence: `sha-not-integrated`). `segment-required` (the row is one unsegmented word and you name a piece) and `status-backward` are exit 1: report them. `set-status` writes no log row.
2. `now`: remove the finished item, add the next one in the shape "<action>. Runs: <who>. Approves: <who>. Depends on: <ids>." (no command covers `now`; edit by hand).
3. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" log "<folder>" --deliverable E<n> --what "E<n> piece <k> closed (<status>)" --evidence <SHA or path>`.
4. Last piece of the deliverable, or last deliverable of a phase → § 9. **Phase exit:** when the last piece of a phase integrates, check the phase's exit criteria first. A criterion with no evidence (no SHA, path or measurement) → add a `now` item "confirm <criterion>" instead of proposing the revision; propose it once every criterion has evidence.
5. Refresh `critical-path.md` (next milestone per track) and the header line (Common), by hand; counts, totals and versions there follow the volatile-values rule (`formats.md § 4`).
6. A piece dropped or moved (not closed) is a decision: § 1, including its coverage re-check.

Checker: `bad-status` (word not in vocab), `integrated-no-sha`, `sha-missing`, `now-limit`, `cell-limit`.

The last piece of a deliverable closing also runs § 19.
