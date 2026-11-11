# § 20. Spec, plan or execution started

**When:** a spec is written, a plan is written, or execution of a plan begins for a deliverable, with no piece closed yet.

1. Panel row of the deliverable: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" set-status "<folder>" E<n> <word> --evidence <path or branch> --next "<next concrete action>"`. The word is at position 2 (spec), 3 (plan) or 4 (executing) of `deliverableStatuses`; Evidence is the path of the spec or the plan and, for executing, the branch name (the command writes it in backticks and keeps every SHA already there). **Segmented row** (Status already per piece, such as `piece 1: integrated; piece 2: spec`): add `--piece <label>` for the piece this event concerns; the command changes only that segment, refuses to lower it (`status-backward`) and leaves a blocked or discarded one alone (`segment-locked`, exit 1: report it). Never write one word over a segmented row. If the event names no piece, change nothing and write `add-pending --owner user --text "which piece does the <spec|plan|execution> cover?"`; under `no questions` that is the only output, and it overrides steps 3 and 4 and Common's log row and header update (nothing was recorded).
2. Executing only: `inflight-add "<folder>" <branch>` (kind `vocab.branchLive`), after confirming the branch exists (§ 4 step 4).
3. `log "<folder>" --deliverable E<n> --what "E<n> spec written" --evidence <spec or plan path>` (or "plan written" / "execution started"). `set-status` and `inflight-add` write no log row, so this one is needed.
4. Close with the refresh of `critical-path.md` (next milestone per track) and the header line (Common).

Checker: `bad-status`, `branch-live-missing`.
