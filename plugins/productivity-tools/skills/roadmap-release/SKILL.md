---
name: roadmap-release
description: "Executa entregas E<n> de um roadmap acompanhado: descoberta, spec, plano, tarefas com revisão dupla, revisão final, gates contra baseline, merge serializado com rollback, docs e roadmap - Automatizar uma ou mais entregas de docs/plans/roadmap-*/. Exemplos de args: {\"deliverables\":[\"E18\"],\"targetBranch\":\"release/2026-11-24\"} | {\"deliverables\":\"next\",\"phase\":\"r1-1\"} | {\"mode\":\"dry-run\"} | {\"mode\":\"plan-only\",\"deliverables\":[\"E19\"]}"
---

# Roadmap Release

Runs roadmap deliverables through the bundled Workflow script `workflow/roadmap-release.js`.

## Script path

When this skill loads, the harness prints a line "Base directory for this skill: <dir>". Build the script path from it: `<dir>/workflow/roadmap-release.js` (absolute). Call the `Workflow` tool with that `scriptPath` and the user's `args`. Never hardcode the path.

## Status

Skeleton only. The script currently runs a single `probe` agent and returns `{ status: 'done', args }`.
