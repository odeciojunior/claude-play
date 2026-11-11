# § 10. Checker refresh

**When:** cold start (SKILL.md Step 1, which then applies this layer in Step 2), the checker warns `checker-stale`, or the user asks.

1. Versions: line 1 of the plugin's checker (SKILL.md Paths) and of `<folder>/check-roadmap.mjs`, header `// check-roadmap <version> format <n>`; `node <file> --version` prints the same `<version> format <n>`. Compare numerically (`1.10.0` > `1.9.0`). Vendored equal or newer → nothing to do. The `checker-stale` warning with a plugin copy that is not newer comes from another cached plugin version: this skill's copy is the reference, mention it once in the report.
2. Run `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" refresh-checker "<folder>"`. The command runs the plugin's checker on the folder and decides:
   - Exit 0 with `refreshed: true` → it copied the plugin's file over the vendored one byte for byte, removed any "checker … available" pending item and wrote its own log row (`checker updated <old> → <new>`, evidence `check-roadmap.mjs`). Do not add a log row.
   - Exit 0 with `refreshed: false` and reason `checker-errors` or `internal-error` → it kept the vendored copy and wrote or updated the pending item "(maintainer) checker <new> available: N errors to fix" (or "internal error, see output"). Show the errors in the report; fixing them is a separate request.
   - Exit 0 with `refreshed: false` and reason `up-to-date` → no-op, say so.
   - Exit 1 or 2 → report the message and do not work around it by copying the file by hand.
3. Vendored copy missing or its line 1 has no version header: the command handles a missing copy; for a header-less hand-edited copy do not replace it, add `add-pending "<folder>" --owner maintainer --text "vendored checker has no version header; review it, then replace with <new>"`.
4. Either way, run the vendored copy for this run's final check (SKILL.md Step 5).

When the refresh and the event both add log rows in one run, both carry the same date (the day of the run) and the event's row goes on top: the refresh happened first (cold start), so it is the older row.
