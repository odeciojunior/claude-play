# § 12. Package published

**When:** a release package is built and published (installed, shipped or handed to a client). Optional block: if `state.md` has no `releases` block, add it per formats.md and say so in the report.

1. Get the stamped SHA (the commit the package was built from; verify with `git cat-file -e <sha>^{commit}`), the date and the environment (the user or the release log tells; never guess).
2. `state.md` `releases`: when this creates the block for the first time, first backfill one row per deliverable already in a released status (ask for or cite the evidence: package, SHA, date, environment; `-` in fields not known), or the checker fails `released-no-package`. Also add the "package is published" row to the README table (formats.md § 8). Then add a row `Package · Deliverables · State · Stamped SHA · Date · Environment`. The deliverables listed are the ones the package carries.
3. Panel: set each carried deliverable (or piece) to the `vocab.releasedStatuses` word (default `released`; `measured` only after a measurement, § 6). The checker's `released-no-package` error fires when a released deliverable appears in no `releases` row.
4. `now`, `critical-path.md` next milestone per track, header line (Common).
5. `log.md`: "package <name> published to <environment>", evidence the stamped SHA in backticks (or the release log path).
