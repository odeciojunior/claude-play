---
paths:
  - "plugins/productivity-tools/skills/roadmap-tracker/**"
  - "plugins/productivity-tools/skills/roadmap-planner/**"
  - "plugins/productivity-tools/lib/roadmap-format.mjs"
  - "plugins/productivity-tools/lib/roadmap-edit.mjs"
  - "plugins/productivity-tools/scripts/prose-budget.test.mjs"
---

# Roadmap checker and formats

- Every roadmap folder carries a vendored copy of `roadmap-tracker/scripts/check-roadmap.mjs`. The tracker and the copy detect a newer checker only by line 1: `// check-roadmap <plugin version> format <n>`, where the version is that of the release that last changed the checker. A plugin bump that doesn't change the checker leaves line 1 alone (e.g. the plugin is 1.4.0 while the checker line 1 correctly says 1.3.0). A change to the checker does not bump either one on its branch: the plugin version (2 places, see CLAUDE.md) and line 1 rise together only when preparing the publication, on the release branch (DEC-042), or existing roadmaps never get it.
- The parser lives in `plugins/productivity-tools/lib/roadmap-format.mjs`: edit the source and run `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` (`--check` reports a stale copy).
- Bump `format <n>` only together with a migration recipe in `roadmap-tracker/references/events/11-migration.md`; a checker older than a folder's `formatVersion` errors instead of guessing.
- `roadmap-planner/references/formats.md` is the contract the checker enforces. Change both sides together and keep the fixture `roadmap-tracker/scripts/fixtures/valid/` at 0 errors, 0 warnings.
- Tests: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`, `plugins/productivity-tools/skills/roadmap-planner/scripts/scaffold.test.mjs`, `plugins/productivity-tools/scripts/prose-budget.test.mjs`, `plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs`; fixture: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`.
- The CLI `roadmap-tracker/scripts/roadmap.mjs` (`node roadmap.mjs <command> <folder> [arguments] [--json]`; `--help` lists the commands) writes tracker events by replacing only the touched lines and checks the result with the checker before writing. Tests: `roadmap.test.mjs` in the same folder.
