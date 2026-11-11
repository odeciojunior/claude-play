# § 20. Spec, plan or execution started

**When:** a spec is written, a plan is written, or execution of a plan begins for a deliverable, with no piece closed yet.

1. `state.md` panel row of the deliverable: Status is the word at position 2 (spec), 3 (plan) or 4 (executing) of `deliverableStatuses`. Evidence is the path of the spec or the plan in backticks and, for executing, the branch name in backticks. Next step is the next concrete action. **Segmented row** (Status already per piece, such as `piece 1: integrated; piece 2: spec`): change only the segment of the piece this event concerns, and only to a later word among positions 1 to 8 than it has now; keep every other segment as written, and leave a blocked or discarded segment alone. Keep every SHA already in Evidence (an integrated segment needs one, or `integrated-no-sha` fires, and the ancestry check needs it) and add the spec or plan path in backticks next to them; never replace Evidence. Never write one word over a segmented row and never lower a segment (`piece 1: integrated` stays when a spec or plan for piece 2 is recorded). If the event names no piece, leave Status and Evidence unchanged and write a `pending` item (`(user) which piece does the <spec|plan|execution> cover?`); under `no questions` that is the only output, and it overrides steps 3 and 4 and Common's log row and header update (nothing was recorded).
2. Executing only: `state.md` "in flight": add or keep the row of the working branch with Kind `vocab.branchLive`, after confirming it exists (§ 4 step 4).
3. `log.md`: one row, "E<n> spec written" / "E<n> plan written" / "E<n> execution started", evidence the spec or plan path.
4. Close with the refresh of `critical-path.md` (next milestone per track) and the header line (Common).

Checker: `bad-status`, `branch-live-missing`.
