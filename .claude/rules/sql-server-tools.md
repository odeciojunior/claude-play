---
paths:
  - "plugins/sql-server-tools/**"
---

# SQL Server Tools Plugin Rules

- **Live query check (not run by `node --test`):** After any edit to `references/*.md` (`protocol.md`, `monitor-queries.md`, `schema-queries.md`, `tuning-queries.md`), run `node plugins/sql-server-tools/scripts/check-queries.mjs` (`check-queries.test.mjs` only tests synthetic SQL strings).
- **`execute_query` constraints:** Queries must start with `SELECT` (no `WITH` CTEs), contain no `;` or `@vars` (use `?` positional params), use no banned DDL/DML/admin keywords or `sp_`/`xp_`, and apply JSON-safe casts for `binary`/`varbinary`/`datetimeoffset`/`sql_variant`.
- **Read-only agent boundary:** All 5 agents read `references/protocol.md` and allow only the 7 read-only `mcp__mcp-sql-server__*` tools (never `execute_statement`, `execute_query_file`, `execute_procedure`, or `Bash`). Only `tsql-specialist` has `Edit, Write` (workspace files only).
- **Docs & lint hygiene:** Keep `## Contents` in plugin-root `references/*.md` (>100 lines; not scanned by `lint-plugin.mjs`), run `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/sql-server-tools` before committing, and do not set `omitClaudeMd: true` on `sql-code-reviewer` or `tsql-specialist` (they rely on the user project's `CLAUDE.md`).
