---
name: launch
description: "Probe only. Use when the user types /wfprobe:launch path or /wfprobe:launch name."
argument-hint: "path | name"
---

# Workflow launch probe

Do exactly one `Workflow` tool call, with no other tool call before it, then report.

- Argument `path`: call `Workflow` with `scriptPath` set to `<dir>/workflow/probe-run.js` (absolute), where `<dir>` is the path printed in the line "Base directory for this skill: <dir>" when this skill loaded, and `args` set to `{"via":"path"}`. Do not read the file first.
- Argument `name`: call `Workflow` with `name` set to `wfprobe:probe-run` and `args` set to `{"via":"name"}`. If the tool answers that the name is unknown, make one more call with `name` set to `probe-run`, and say which one worked.

Never ask the user anything. Never retry a denied or cancelled call.

Report in three lines: the exact input you sent to `Workflow`; whether the tool ran, was denied, was cancelled or returned an error (quote the error text in full); and the result the workflow returned.
