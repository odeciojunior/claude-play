# § 10. Checker refresh

**When:** cold start (SKILL.md Step 1, which then applies this layer in Step 2), the checker warns `checker-stale`, or the user asks.

1. Versions: line 1 of the plugin's checker (SKILL.md Paths) and of `<folder>/check-roadmap.mjs`, header `// check-roadmap <version> format <n>`. `node <file> --version` prints the same `<version> format <n>` from that line. Plugin's not newer → stop.
2. Run the plugin's checker (SKILL.md Paths) on the folder: `node <plugin checker> "<folder>"`; read the exit code and the summary line `check-roadmap: N error(s), M warning(s)`.
3. Exit 0 → copy the plugin's file over the vendored one (`cp`, byte for byte), log "checker refreshed <old> → <new>" with evidence `` `check-roadmap.mjs` ``, remove any "checker … available" pending item.
4. Exit 1 → keep the vendored copy, add or update the pending item "(maintainer) checker <new> available: N errors to fix". Show the errors in the report. Fixing them is a separate request.
   Exit 2 (`ERROR internal`, the new checker crashed) → also a failed refresh: keep the vendored copy and add or update the pending item "(maintainer) checker <new> available: internal error, see output"; show the message in the report.
5. Either way, run the vendored copy for this run's final check (SKILL.md Step 5).

When the refresh and the event both add log rows in one run, both carry the same date (the day of the run) and the event's row goes on top: the refresh happened first (cold start), so it is the older row.
