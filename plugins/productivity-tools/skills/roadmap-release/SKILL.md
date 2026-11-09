---
name: roadmap-release
description: "Use when the user wants to run one or more roadmap deliverables (E<n>) from a tracked roadmap folder docs/plans/roadmap-*/ end to end, or says \"run E18\", \"execute the next deliverable\", \"release dry-run\", \"plan-only E19\"."
---

# Roadmap Release

Runs roadmap deliverables through the bundled Workflow script `workflow/roadmap-release.js`.

## Script path

When this skill loads, the harness prints a line "Base directory for this skill: <dir>". Build the script path from it: `<dir>/workflow/roadmap-release.js` (absolute). Call the `Workflow` tool with that `scriptPath` and the user's `args`. Never hardcode the path.

## Status

Skeleton only. The script currently runs a single `probe` agent and returns `{ status: 'done', args }`.
