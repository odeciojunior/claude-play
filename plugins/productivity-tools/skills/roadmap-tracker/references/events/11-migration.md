# § 11. Migration

**When:** the contract's `formatVersion` (its title line, `# Roadmap format contract (formatVersion N)`) is greater than the config's `formatVersion` (SKILL.md Step 3). A pre-approval given by a caller or an orchestrator never covers a migration: with no person present, add only a pending item and say so in the hand-back.

Compare three numbers: the contract's `formatVersion` (title line), the config's `formatVersion` (`formats.md § 2`) and the vendored checker's `format <n>` (line 1, after § 10; `formats.md § 9`).

- Contract newer than the config → run the migration below **before writing anything else**. It needs user approval and ends with the vendored checker at that format.
- Never set the config's `formatVersion`, or write a file in a format, newer than the vendored checker reports. The migration vendors the new checker itself before it bumps the config, so a § 10 refresh that failed because the folder is still in the old format does not block it. Without approval, keep writing the config's format and leave the pending item (`add-pending "<folder>" --owner user --text "migrate to format <N>?"`).
- Config newer than the contract (the installed plugin is older than the folder) → stop; tell the user to update the plugin.

`formatVersion 1` has no migration: it is the first format. Each future format adds one section below, `### Migration <N-1> → <N>`, written with that format change and applied in order (1 → 2, then 2 → 3). Template:

```
### Migration <N-1> → <N>
Trigger: config formatVersion = <N-1>; contract formatVersion = <N> (`formats.md § 2`).
Changes:
- <file role>: <exact change: anchor renamed, column added at position k with default value, vocab key added with default>
- roadmap.config.json: <new or renamed keys and their defaults>
Steps:
1. List the files and changes; ask the user to approve. No approval -> stop, keep writing format <N-1>.
2. Apply the changes in the working tree, file by file.
3. Copy the plugin's checker (format <N>) over the vendored one.
4. Set the config formatVersion to <N>.
5. Run the vendored checker: 0 errors. Otherwise list the errors and stop (no git checkout or reset; the diff stays for review).
6. log.md: "format migrated <N-1> → <N>", evidence `roadmap.config.json`.
```

Rules: never set the config's `formatVersion` above the vendored checker's `format <n>` (step 3 comes before step 4). The new checker usually fails on the unmigrated folder, so § 10 exit 1 does not block a migration; the gate is step 5, on the migrated files.
