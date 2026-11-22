---
paths:
  - "plugins/productivity-tools/lib/**"
  - "plugins/productivity-tools/scripts/**"
  - "plugins/productivity-tools/skills/*/workflow/**"
---

# Productivity Workflows, Scripts, and Pure Libraries

- **Pure sources (DEC-058):** Modules in `plugins/productivity-tools/lib/` (`roadmap-format.mjs`, `roadmap-edit.mjs`, `data-block.mjs`, `routing.mjs`, `plan-digest.mjs`, `external-auth.mjs`, `progress-state.mjs`, `agy-routing.mjs` (not embedded; consumed by the agy bridge)) must have zero imports and no Node/`fs`/env/clock APIs so they can be embedded verbatim. Utility scripts in `plugins/productivity-tools/scripts/`: `embed.mjs`, `spec-tool.mjs`, `plan-tool.mjs`, `review-package.mjs`, `run-record.mjs`.
- **agy bridge:** `plugins/productivity-tools/scripts/agy-bridge.py` is loaded by `exec` from the agy workflows (unique basename) and calls `lib/*.mjs` via `node --input-type=module`.
- **Embed sync:** After editing any embedded `lib/` module, regenerate and verify all 4 targets:
  `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`
- **Workflow agent dispatch (DEC-057):** Registered workflow scripts must pass `agentType`, never `subagent_type` (`lint-plugin.mjs` fails on any occurrence).
- **Workflow size caps (`size.test.mjs`):** `roadmap-release.js` <= `250,000` LF chars (headroom is tight, ~5k chars; runtime launch ceiling is `524,288` bytes); `coordinator.js` <= `120,000` LF chars.
- **Required tests:** Run `independence.test.mjs` (zero `superpowers` mentions anywhere in non-test plugin files), workflow `size.test.mjs` / `flow.test.mjs`, and `prose-budget.test.mjs`.
