---
paths:
  - "plugins/*/skills/**"
  - "plugins/*/agents/**"
---

# Writing and changing skills and plugin agents

- Keep `SKILL.md` under 500 lines; move detail into `references/*.md` kept one level deep (never link `references/<other>.md` from inside a reference file), and give any reference over 100 lines a `## Contents` or `## Table of Contents` section.
- Frontmatter keys enforced by `lint-plugin.mjs`:
  - `SKILL.md` allows 8 portable keys (`name`, `description`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `compatibility`, `license`, `metadata`). Single exception (DEC-049/DEC-275): `plugins/productivity-tools/skills/roadmap-release/SKILL.md` uses `allowed-tools: Workflow(productivity-tools:release-workflow)` with `disable-model-invocation: true`. Skills referencing registered workflows must declare a semver `compatibility`.
  - Plugin agents allow 15 keys (`name`, `description`, `tools`, `disallowedTools`, `model`, `effort`, `maxTurns`, `skills`, `memory`, `background`, `isolation`, `omitClaudeMd`, `color`, `autoCompactWindow`, `experimental`). `hooks`, `mcpServers`, `permissionMode`, `initialPrompt`, and any unlisted key fail lint.
- `productivity-tools` enforces 3 prose-budget tests: `roadmap-planner` <= 43,335 LF B, `roadmap-tracker` <= 29,096 LF B/event, and `plan-coordinator` <= 6,000 LF B pre-launch.
- When a non-typo change alters what a skill does, test it behaviorally: have a subagent follow `SKILL.md` literally on a real input (e.g., a plan in `docs/plans/`), write its output to a disposable temp/scratch directory outside the repo (never commit scratch output) listing every ambiguity hit, then run a read-only adversarial review of the result.
- Before committing, run both `/marketplace-tools:validate-plugin` and `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/<name>` (frontmatter keys, absolute paths, secrets).
