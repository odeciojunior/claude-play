# § 2. Piece or step closed

**When:** a vertical slice of a deliverable, or a plan step that finishes one, is done; or plan-coordinator reports "wave N closed" / "plan completed" (§ 14).

1. `state.md` panel row of the deliverable:
   - Status: per piece, `piece 1: on-branch; piece 2: spec` (segment rules in formats.md § 4). Code merged to the integration branch → § 3 instead.
   - Evidence: backticked SHAs, the spec or plan path, the progress file path. A SHA of a piece still on a branch only needs to exist. Once any piece is integrated, the Evidence also carries the SHA that entered the integration branch (§ 3).
   - Next step: the next concrete action.
2. `now`: remove the finished item, add the next one in the shape "<action>. Runs: <who>. Approves: <who>. Depends on: <ids>."
3. `log.md`: "E<n> piece <k> closed (<status>)", evidence = SHA or path.
4. Last piece of the deliverable, or last deliverable of a phase → § 9. **Phase exit:** when the last piece of a phase integrates, check the phase's exit criteria first. A criterion with no evidence (no SHA, path or measurement) → add a `now` item "confirm <criterion>" instead of proposing the revision; propose it once every criterion has evidence.
5. Refresh `critical-path.md` (next milestone per track) and the header line (Common).
6. A piece dropped or moved (not closed) is a decision: § 1, including its coverage re-check.

Checker: `bad-status` (word not in vocab), `integrated-no-sha`, `sha-missing`, `now-limit`, `cell-limit`.

The last piece of a deliverable closing also runs § 19.
