---
name: launch-granted
description: "Probe only. Use when the user types /wfprobe:launch-granted."
allowed-tools:
  - Workflow(wfprobe:probe-run)
---

# Workflow launch probe, with the grant in the skill frontmatter

Do exactly one `Workflow` tool call, with no other tool call before it, then report.

Call `Workflow` with `name` set to `wfprobe:probe-run` and `args` set to `{"via":"name-granted"}`.

Never ask the user anything. Never retry a denied or cancelled call.

Report in three lines: the exact input you sent to `Workflow`; whether the tool ran, was denied, was cancelled or returned an error (quote the error text in full); and the result the workflow returned.
