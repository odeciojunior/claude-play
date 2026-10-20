---
paths:
  - "plugins/productivity-tools/skills/roadmap-tracker/**"
  - "plugins/productivity-tools/skills/roadmap-planner/**"
---

# Roadmap checker and formats

- Every roadmap folder carries a vendored copy of `roadmap-tracker/scripts/check-roadmap.mjs`. The tracker and the copy detect a newer checker only by line 1: `// check-roadmap <plugin version> format <n>`, where the version is that of the release that last changed the checker. A plugin bump that doesn't change the checker leaves line 1 alone (e.g. the plugin is 1.4.0 while the checker line 1 correctly says 1.3.0). Any change to the checker ⇒ bump the productivity-tools version (3 places, see CLAUDE.md) and set line 1 to the same version, or existing roadmaps never get it.
- Bump `format <n>` only together with a migration recipe in `roadmap-tracker/references/events.md`; a checker older than a folder's `formatVersion` errors instead of guessing.
- `roadmap-planner/references/formats.md` is the contract the checker enforces. Change both sides together and keep the fixture `scripts/fixtures/valid/` at 0 errors, 0 warnings.
- Tests: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`; fixture: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`.
- In tests, build Windows paths and JSON with `\` from code (`String.fromCharCode(92)`, `path.win32.join`): shell-quoted backslashes get collapsed before they reach node.
