---
paths:
  - "plugins/*/skills/**"
---

# Writing and changing skills

- Keep SKILL.md under 500 lines; move detail into `references/*.md`, and give any reference over 100 lines a table of contents.
- When a change alters what a skill does (not a typo), test it behaviorally: have a subagent follow the SKILL.md literally on a real input (for example a plan in `docs/plans/`), writing its output to the scratchpad and listing every ambiguity it hit, then run a read-only adversarial review of the result.
- Run the `marketplace-tools` `validate-plugin` skill on the plugin before committing (frontmatter keys, absolute paths, secrets).
