# § 6. Measurement

**When:** a paid run, a cost or a measurement milestone.

1. `files.measurements` is `null` → do not create the file silently. Ask whether to enable it; on yes, set `files.measurements` in the config, create the file (`formats.md § 7`) and add the "paid run or measurement" row to the README table (`formats.md § 8`). On no, log the event only.
2. `measurements.md` (columns and cell rules: `formats.md § 7`): Date, Deliverable, Kind (run, cost, milestone), Detail (what and where it came from), Recorded, Billed (separate columns; `-` for a value nobody supplied, never an estimate), Status. Values exactly as supplied, with their unit.
3. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" log "<folder>" --deliverable E<n> --what "<kind> recorded for E<n>" --evidence <report path or URL>`.
4. Targets in the strategy's "Metrics and targets" change only in a revision (§ 9).
