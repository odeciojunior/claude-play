# sql-server-tools 1.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five sql-server-tools agents run read-only queries live through mcp-sql-server (falling back to emitting scripts when it is absent), and fix the T-SQL errors found in the 1.0.0 audit.

**Architecture:** Each agent's `tools:` allowlist gains the read-only `mcp__mcp-sql-server__*` tools. Shared behaviour (connectivity, environment detection, MCP query rules, severity scale, final-message conventions, memory) moves to `references/protocol.md`; vetted queries move to per-agent query packs in `references/`. Agents read both on demand via `${CLAUDE_PLUGIN_ROOT}/references/<file>.md`, which Claude Code substitutes in plugin agent bodies. A zero-dependency Node checker enforces the MCP server's query constraints on every `sql` block in `references/`.

**Tech Stack:** Markdown agents/skills; Node ≥ 18 ESM (`node:fs`, `node:path`, `node:url`, `node:test`, `node:assert`); mcp-sql-server 0.1.0.

**Spec:** `docs/reports/2026-10-20-sql-server-tools-audit.md` (findings P0–P4 and the section "Restrições do mcp-sql-server").

## Global Constraints

- Agent, reference and skill text in English.
- MCP tool names exactly `mcp__mcp-sql-server__<tool>` (server key registered by `plugins/mcp-sql-server/scripts/setup.sh`).
- Read-only tool set **R** = `Read, Grep, Glob, mcp__mcp-sql-server__list_databases, mcp__mcp-sql-server__execute_query, mcp__mcp-sql-server__list_tables, mcp__mcp-sql-server__describe_table, mcp__mcp-sql-server__get_view_definition, mcp__mcp-sql-server__get_function_definition, mcp__mcp-sql-server__list_procedures`.
- No agent gets `execute_statement`, `execute_procedure`, `execute_query_file`, `Bash`, or a `mcp__mcp-sql-server__*` wildcard.
- Agent frontmatter never contains `permissionMode`, `hooks`, `mcpServers` or `initialPrompt` (ignored for plugin agents).
- Agents reference shared files only as `${CLAUDE_PLUGIN_ROOT}/references/<file>.md`.
- Every fenced block tagged `sql` under `plugins/sql-server-tools/references/` passes `node plugins/sql-server-tools/scripts/check-queries.mjs` (exit 0).
- Library queries run on SQL Server 2012+ unless the block's `Requires:` line says otherwise; no `STRING_AGG`, `CTE`, `DECLARE`, variables, `;`, `OPTION`.
- Agent files ≤ 200 lines; any reference file > 100 lines starts with a table of contents.
- SKILL.md frontmatter keys only from the repo allowlist (`name`, `description`, `disable-model-invocation`, `argument-hint`, `compatibility`, `license`, `metadata`, and `user-invocable` with that spelling).
- Version `1.1.0` bumped together in `plugins/sql-server-tools/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and the root `README.md` table (Task 9).
- Branch `feat/sql-server-tools-v1.1`. Commits `type(sql-server-tools): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never edit `plugins/_template/`.

## Review Focus

1. **A library query that the MCP server rejects or that fails inside its `SELECT TOP n * FROM (…)` wrapper** (CTE, top-level `ORDER BY` without `TOP`, variable, `;`, `OPTION`) → the checker flags it before commit. Tests in Task 1; CLI run in Tasks 3–5.
2. **A blocked word inside a comment or string literal** (`-- create later`, `N'SP_SERVER_DIAGNOSTICS_SLEEP'`, `'BACKUP'`) → flagged, because the server scans raw text. Tests in Task 1; the benign-wait list in Task 4 must use `LIKE` patterns for such names.
3. **mcp-sql-server not installed, or registered under another name** → the agent states "Live mode unavailable" on its first line, emits the reference queries as a script, and never invents results. Behavioral check in Task 2.
4. **Azure SQL Database (`EngineEdition = 5`)** → server-scoped DMVs (`sys.dm_os_*`, `sys.master_files`, `system_health` files) are unavailable; every monitor query names its Azure variant or says N/A. Count check in Task 4.
5. **SQL Server 2012–2016 instance** → version-specific columns (`temporal_type`, `is_node`, `ledger_type`) live in separate, `Requires:`-gated queries so the base query still compiles. Grep check in Task 3.

---

## File Structure

```
plugins/sql-server-tools/
  .claude-plugin/plugin.json          # version 1.1.0 (Task 9)
  README.md                           # MCP setup, live vs script mode (Task 8)
  agents/
    sql-performance-monitor.md        # Tasks 2, 4
    sql-performance-tuner.md          # Tasks 2, 5
    sql-schema-discovery.md           # Tasks 2, 3
    sql-code-reviewer.md              # Tasks 2, 6
    tsql-specialist.md                # Tasks 2, 7
  references/
    protocol.md                       # shared by all agents (Task 2)
    schema-queries.md                 # Task 3
    monitor-queries.md                # Task 4
    tuning-queries.md                 # Task 5
  scripts/
    check-queries.mjs                 # Task 1
    check-queries.test.mjs            # Task 1
  skills/sql-server-toolkit/SKILL.md  # router rewrite (Task 8)
```

**Query block format** (all query packs):

````markdown
### <pack>.<id>
- Purpose: <one line>
- Requires: SQL Server <version>+ | any
- Azure SQL DB: same | variant `<pack>.<id>-azure` | N/A
- Permission: VIEW SERVER STATE | VIEW DATABASE STATE | none
- Params: none | `?1` = <meaning>, `?2` = …

```sql
SELECT …
```
````

---

### Task 1: Query checker

**Files:**
- Create: `plugins/sql-server-tools/scripts/check-queries.mjs`
- Test: `plugins/sql-server-tools/scripts/check-queries.test.mjs`

**Interfaces:**
- Produces:
  - `extractSqlBlocks(markdown: string): Array<{ line: number, sql: string }>`: only fences whose info string is exactly `sql`. `line` is the 1-based line of the first SQL line. CRLF and LF give identical results.
  - `checkQuery(sql: string): string[]`: violation messages; `[]` means valid.
  - `checkFiles(paths: string[]): Array<{ file: string, line: number, message: string }>`.
  - CLI: `node scripts/check-queries.mjs [files…]`. With no arguments it checks every `*.md` in `../references/` relative to the script. It prints `file:line: message` for each violation and exits 1 if there are any, 0 otherwise. It prints `checked N blocks in M files` on success.

Rules for `checkQuery`. They mirror `mcp_sql_server/security.py` and the `_inject_top_clause` wrapper:

1. The first token after leading whitespace and `--` comment lines must be `SELECT` (case-insensitive). If it is `WITH`, the message names CTEs and the derived-table wrapper.
2. Any of `DROP TRUNCATE ALTER CREATE GRANT REVOKE SHUTDOWN BACKUP RESTORE DBCC OPENROWSET OPENQUERY OPENDATASOURCE BULK KILL` as a whole word (`\b…\b`, case-insensitive) anywhere, including comments and literals.
3. `\bsp_\w+` or `\bxp_\w+` anywhere (case-insensitive).
4. `ORDER BY` at parenthesis depth 0 requires `TOP` at depth 0. `ORDER BY` inside `OVER (…)` or a subquery is fine. Track depth over the text with string literals and comments skipped.
5. No `;` outside string literals.
6. No `OPTION (` at depth 0.
7. No variables: `@name` not preceded by `@`. `@@VERSION` and `@@SPID` are allowed.

- [ ] **Step 1: Create branch**

Run: `git switch -c feat/sql-server-tools-v1.1`

- [ ] **Step 2: Write the failing tests** in `check-queries.test.mjs` (`node:test`, `node:assert/strict`):

```js
// extractSqlBlocks
'only sql fences'          : '```text\nSELECT 1\n```\n```sql\nSELECT 1 AS a\n```' → [{ line: 5, sql: 'SELECT 1 AS a' }]
'crlf equals lf'           : same input with \r\n → deepEqual to the LF result
// checkQuery → [] (valid)
'SELECT name FROM sys.objects'
'SELECT create_date FROM sys.objects'                        // underscore keeps \bCREATE\b from matching
'SELECT TOP (10) name FROM sys.objects ORDER BY name'
'SELECT ROW_NUMBER() OVER (ORDER BY name) AS rn FROM sys.objects'
'SELECT @@VERSION AS v'
"SELECT wait_type FROM sys.dm_os_wait_stats WHERE wait_type <> N'BACKUPIO'"
'SELECT name FROM sys.objects WHERE object_id = OBJECT_ID(?)'
// checkQuery → one violation whose message matches
'WITH x AS (SELECT 1 AS a) SELECT a FROM x'   → /CTE/
'SELECT 1 AS a -- create later'               → /CREATE/
"SELECT 1 AS a WHERE 'x' = 'BACKUP'"          → /BACKUP/
"SELECT 1 AS a WHERE N'SP_SERVER_DIAGNOSTICS_SLEEP' = ''" → /sp_/i
'SELECT name FROM sys.objects ORDER BY name'  → /ORDER BY.*TOP/
'SELECT name FROM sys.objects WHERE id = @id' → /variable/
'SELECT 1 AS a;'                              → /;/
'SELECT name FROM sys.objects OPTION (RECOMPILE)' → /OPTION/
"SELECT 'a;b' AS s"                           → []   // ; inside literal is fine
```

Write each line as its own `test()` with `assert.deepEqual` / `assert.match`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test plugins/sql-server-tools/scripts/check-queries.test.mjs`
Expected: FAIL with `Cannot find module` / missing export.

- [ ] **Step 4: Implement the three exports and the CLI** in `check-queries.mjs`. Use a small single-pass scanner: skip `'…'` literals (`''` escapes) and `--`/`/* */` comments when tracking depth for rules 4–6, and scan the raw text for rules 2–3. Detect CLI mode with `import.meta.url === pathToFileURL(process.argv[1]).href`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test plugins/sql-server-tools/scripts/check-queries.test.mjs`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add plugins/sql-server-tools/scripts/
git commit -m "feat(sql-server-tools): add checker for mcp-sql-server query constraints"
```

---

### Task 2: Shared protocol and agent wiring

**Files:**
- Create: `plugins/sql-server-tools/references/protocol.md`
- Modify: frontmatter and the Workflow, Escalation and Memory Management sections of all five `agents/*.md`

**Interfaces:**
- Consumes: Task 1 CLI.
- Produces: `references/protocol.md` with these section headings, which Tasks 3–8 cite by name: `## Connectivity`, `## Environment Detection`, `## MCP Query Rules`, `## Read-Only Safety`, `## Severity Scale`, `## Final Message`, `## Memory`.

Content `protocol.md` must pin:

- **Connectivity:**
  - Call `mcp__mcp-sql-server__list_databases` first.
  - **LIVE mode:** at least one alias has `status: ok`. Use the alias the caller named. If several are `ok` and none was named, use none: list them under "Questions for the caller" and stop.
  - **SCRIPT mode:** the tool is unavailable or no alias is `ok`. The first line of the final message is `Live mode unavailable: <reason>`. Output the relevant reference queries as a numbered script for the user to run. Analyze results only if the caller supplied them. Never invent output.
- **Environment Detection:** this exact query, run once per session in LIVE mode. Branch on `engine_edition` (5 = Azure SQL Database, 8 = Managed Instance, otherwise box SQL Server) and on `major_version` (11 = 2012, 12 = 2014, 13 = 2016, 14 = 2017, 15 = 2019, 16 = 2022, 17 = 2025):

```sql
SELECT
    CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS product_version,
    CAST(SERVERPROPERTY('ProductMajorVersion') AS int) AS major_version,
    CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) AS edition,
    CAST(SERVERPROPERTY('EngineEdition') AS int) AS engine_edition,
    DB_NAME() AS database_name,
    (SELECT d.compatibility_level FROM sys.databases AS d WHERE d.name = DB_NAME()) AS compat_level,
    HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE') AS has_view_server_state,
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'VIEW DATABASE STATE') AS has_view_database_state
```

- **MCP Query Rules:**
  - The seven checker rules from Task 1, in plain words, with the reason for each: the derived-table wrapper and the raw-text keyword scan.
  - Name every output column uniquely.
  - Pass parameters as `?` with the `params` list.
  - With `ORDER BY`, use `TOP (n)` where n is at least the maximum possible rows.
  - If a query is rejected, rewrite it to comply. Never retry it unchanged.
- **Read-Only Safety:**
  - Agents never modify data or schema.
  - DDL and DML recommendations are delivered as scripts for the user to review and run.
  - Heavy DMVs: `sys.dm_db_index_physical_stats` only in `'LIMITED'` mode for one object; `TOP (n)` on plan-cache queries; never pull the plans of the whole cache.
  - Never recommend `DBCC FREEPROCCACHE`/`DROPCLEANBUFFERS`, shrink, `KILL` or `sp_configure` changes on production without stating the impact and that change control is required.
- **Severity Scale:** CRITICAL (data loss or corruption risk, security hole, outage) · HIGH (major performance or correctness defect likely to hit production) · MEDIUM (measurable cost or maintainability issue) · LOW (style, minor improvement).
- **Final Message:** the order is:
  1. Mode line: `Mode: LIVE (<alias>, <product_version>, <edition>)` or the SCRIPT line above.
  2. Findings.
  3. `Assumptions and not checked`.
  4. `Questions for the caller`. Subagents cannot ask mid-run.
  5. `Suggested handoffs`, written as "Recommend the caller delegate <X> to `sql-server-tools:<agent>`". A subagent cannot spawn another.
- **Memory:** scope `local`. Save environment facts, baselines and confirmed conventions. Never save credentials, connection strings or data rows.

- [ ] **Step 1: Write `references/protocol.md`** with the sections above.

- [ ] **Step 2: Run the checker on it**

Run: `node plugins/sql-server-tools/scripts/check-queries.mjs`
Expected: `checked 1 blocks in 1 files`, exit 0.

- [ ] **Step 3: Rewrite the frontmatter of all five agents.** Remove `disallowedTools` and `permissionMode`. Set `memory: local`. Then set:

| Agent | model | maxTurns | tools |
|---|---|---|---|
| sql-performance-monitor | sonnet | 30 | R |
| sql-performance-tuner | opus | 25 | R |
| sql-schema-discovery | sonnet | 20 | R |
| sql-code-reviewer | sonnet | 15 | R |
| tsql-specialist | sonnet | 20 | R plus `Edit, Write` (no Bash) |

Description tie-breakers:
- Monitor: add "server-wide or unknown-cause slowness, deadlocks" and "for one specific query or plan use sql-performance-tuner".
- Tuner: add "one specific query, procedure or plan; for server-wide symptoms use sql-performance-monitor".

- [ ] **Step 4: Replace the Escalation and Memory Management sections in every agent** with one line under the title. The line reads: "Before anything else, Read `${CLAUDE_PLUGIN_ROOT}/references/protocol.md` and follow it: connectivity, environment detection, query rules, safety, severity, final message, memory." Then:
  - Monitor: delete Workflow step 1's `@@VERSION`/`dm_os_sys_info` wording, replaced by "Environment Detection (protocol)". Delete the "Do NOT write or execute T-SQL code" bullet (line 212).
  - Schema-discovery: delete the "Query `@@VERSION`" step.
  - All agents: tag output-template fences as ` ```markdown ` (audit P4: six untagged fences).

- [ ] **Step 5: Verify wiring statically**

Run: `grep -L 'CLAUDE_PLUGIN_ROOT}/references/protocol.md' plugins/sql-server-tools/agents/*.md; grep -l -E 'permissionMode|disallowedTools|Bash|execute_statement|mcp-sql-server__\*' plugins/sql-server-tools/agents/*.md`
Expected: no output from either grep.

- [ ] **Step 6: Behavioral check: SCRIPT mode and path substitution.** This machine has no mcp-sql-server registered.

```bash
claude plugin disable sql-server-tools@claude-play
claude -p --plugin-dir plugins/sql-server-tools "Use the sql-server-tools:sql-schema-discovery agent to list the tables in the default database. Quote the agent's final message verbatim."
claude plugin enable sql-server-tools@claude-play
```

Expected: the quoted message starts with `Live mode unavailable:` and contains at least one SQL query. It contains no fabricated table names, and no literal `${CLAUDE_PLUGIN_ROOT}` complaint.

If the agent reports that it could not read the protocol file, stop and report to the user. Path substitution is documented, so a failure is a platform problem, not something to work around.

If the agent reports it cannot write memory files (the allowlist has no Write/Edit, and the docs leave the interplay with `memory` open), remove `memory:` from all five agents and the protocol `## Memory` section; note the removal in the commit body. Delete any `.claude/agent-memory-local/` the run created in the repo; it is not gitignored.

- [ ] **Step 7: Commit**

```bash
git add plugins/sql-server-tools/references/protocol.md plugins/sql-server-tools/agents/
git commit -m "feat(sql-server-tools): run read-only queries via mcp-sql-server with script fallback"
```

---

### Task 3: Schema query pack and schema-discovery fixes

**Files:**
- Create: `plugins/sql-server-tools/references/schema-queries.md`
- Modify: `plugins/sql-server-tools/agents/sql-schema-discovery.md` (the "Key Analysis Queries" section at lines 71–139 is removed; the Critical Caveats at 140–167 are fixed)

**Interfaces:**
- Consumes: protocol section names (Task 2), checker (Task 1).
- Produces: query ids `schema.tables`, `schema.table-flags-2016`, `schema.graph-flags-2017`, `schema.ledger-2022`, `schema.columns`, `schema.indexes`, `schema.foreign-keys`, `schema.depends-on-me`, `schema.i-depend-on`.

Query requirements:
- `schema.tables`: 2012-safe columns only. `row_count` comes from a subquery `SUM(row_count) … WHERE index_id IN (0,1) GROUP BY object_id` (fixes partition duplication). `is_ms_shipped = 0`.
- `schema.table-flags-2016` (13+): `temporal_type_desc`, `history_table_id`, `is_memory_optimized`, `durability_desc`, `is_external`.
- `schema.graph-flags-2017` (14+): `is_node`, `is_edge`.
- `schema.ledger-2022` (16+ or Azure): `ledger_type_desc`, `is_dropped_ledger_table`.
- `schema.columns` (`?1` = `'schema.table'`): `object_id = OBJECT_ID(?)`. Display length divides `nchar`/`nvarchar` by 2 and shows `max` for -1. Includes computed definition (`sys.computed_columns`) and default definition (`sys.default_constraints`). `MS_Description` comes via `sys.extended_properties` with `class = 1` and `minor_id = column_id`.
- `schema.foreign-keys`: ordered by `constraint_column_id`. Exposes `is_disabled` and `is_not_trusted`.
- `schema.depends-on-me` (`?1` = `'schema.object'`, `?2` = schema, `?3` = name): `DISTINCT`. `WHERE d.referenced_id = OBJECT_ID(?) OR (d.referenced_id IS NULL AND d.referenced_schema_name = ? AND d.referenced_entity_name = ?)`. Output includes `is_schema_bound_reference`, `is_ambiguous` and `referenced_database_name`.
- `schema.i-depend-on`: `d.referencing_id = OBJECT_ID(?)`.

Agent fixes:
- Replace line 142 with: "`sys.sql_expression_dependencies` tracks schema-bound and non-schema-bound references (`is_schema_bound_reference`); it does not track dynamic SQL, and references to missing objects have `referenced_id` NULL." Then add "Grep the repo for dynamic SQL that names the object."
- Line 144: cross-database references are matched by name only (`referenced_database_name`); Azure SQL DB has none.
- Graph section: delete the "Not visible in `sys.columns`" claim. Say "MATCH is for pattern traversal; ordinary joins also work; SHORTEST_PATH needs 2019."
- FK trust: `WITH CHECK CHECK CONSTRAINT` validates every row and takes locks. Recommend it only, never run it.
- Index usage caveat: also reset by failover and Azure scale operations.
- Catalog views are permission-filtered: "not found" may mean "not visible".
- For schemas with more than 200 tables, report the top 50 by size and say what was skipped.

- [ ] **Step 1: Write `references/schema-queries.md`** in the query block format.
- [ ] **Step 2: Run the checker.** `node plugins/sql-server-tools/scripts/check-queries.mjs`. Expected: exit 0.
- [ ] **Step 3: Check version gating.** `grep -n -E 'temporal_type|is_node|ledger_type' plugins/sql-server-tools/references/schema-queries.md`. Expected: every hit sits under `schema.table-flags-2016`, `schema.graph-flags-2017` or `schema.ledger-2022`, never under `schema.tables`.
- [ ] **Step 4: Edit the agent.** Replace lines 71–139 with "Queries: Read `${CLAUDE_PLUGIN_ROOT}/references/schema-queries.md`; choose by id and check each block's `Requires:` line against Environment Detection." Then apply the fixes above.
- [ ] **Step 5: Verify.** Run `grep -c 'only tracks' plugins/sql-server-tools/agents/sql-schema-discovery.md`; expected `0`. Run `wc -l` on the agent; expected ≤ 200.
- [ ] **Step 6: Commit.** `feat(sql-server-tools): schema query pack; fix dependency and row-count queries`

---

### Task 4: Monitor query pack and monitor fixes

**Files:**
- Create: `plugins/sql-server-tools/references/monitor-queries.md`
- Modify: `plugins/sql-server-tools/agents/sql-performance-monitor.md` (sections "Key DMV Reference" 110–128, "Common Wait Type Categories" 129–146 and "Benign Waits Exclusion List" 176–204 move to or are replaced by the pack)

**Interfaces:**
- Produces ids:
  - `monitor.waits-snapshot` (azure variant uses `sys.dm_db_wait_stats`)
  - `monitor.cpu-history` (azure variant uses `sys.dm_db_resource_stats`)
  - `monitor.top-queries`
  - `monitor.blocking`
  - `monitor.memory`
  - `monitor.io-latency-snapshot` (azure variant uses `sys.database_files`)
  - `monitor.tempdb`
  - `monitor.index-usage`
  - `monitor.missing-indexes`
  - `monitor.deadlocks` (Azure N/A)
  - `monitor.query-store-state`
  - `monitor.config` (Azure N/A)

Query requirements:
- Snapshot queries return `SYSDATETIME() AS sampled_at`.
- `monitor.top-queries` converts µs to ms (`total_worker_time / 1000.0 AS total_cpu_ms`, same for elapsed). Every average uses `NULLIF(execution_count, 0)`. It returns `TOP (20)`.
- Benign waits are excluded with `NOT IN (N'…')`. Names that trip rule 2 or 3 (e.g. `SP_SERVER_DIAGNOSTICS_SLEEP`) use `wait_type NOT LIKE N'%DIAGNOSTICS_SLEEP'`. Keep the 1.0.0 list's coverage.
- `monitor.index-usage` also returns `sqlserver_start_time` from `sys.dm_os_sys_info` (the observation window).
- `monitor.memory` reads PLE per `Buffer Node`, not only `Buffer Manager`.

Agent fixes:
- **Delta rule.** Run `waits-snapshot` and `io-latency-snapshot` twice, at least 30 seconds apart (between other queries). Report deltas per second. Label single-sample results "since <sqlserver_start_time>".
- **Missing index caveats.** Missing-index output is a hint: consolidate with existing indexes, never emit it verbatim as an index script, weigh write cost.
- **Unused index caveats.** Require a full business cycle since restart. Check readable secondaries and FK-supporting indexes.
- **CXCONSUMER.** Treat `CXCONSUMER` as benign. `CXPACKET` matters only when dominant together with skew or CPU pressure; check MAXDOP and cost threshold for parallelism. Name `HADR_SYNC_COMMIT` (not `HADR_*`). Add blocking as a `THREADPOOL` cause.
- **BCHR.** Delete buffer cache hit ratio. PLE is read per NUMA node; drop the fixed 300 threshold.
- **Parameter sniffing.** The heuristic compares `max` with `avg` elapsed (not `min`), and checks for multiple plans per query in Query Store.
- **Latency guidelines.** Log writes < 5 ms; data reads < 20 ms. These are guidelines, not rules.

- [ ] **Step 1: Write `references/monitor-queries.md`** (TOC at the top).
- [ ] **Step 2: Run the checker.** Expected: exit 0.
- [ ] **Step 3: Check Azure coverage.** `grep -c '^### monitor\.' F` must equal `grep -c '^- Azure SQL DB:' F`, with `F=plugins/sql-server-tools/references/monitor-queries.md`. Every `-azure` variant named on a line must exist as a heading.
- [ ] **Step 4: Edit the agent** as above. Replace the moved sections with a pointer to the pack.
- [ ] **Step 5: Verify.** Run `grep -n -i -E 'buffer cache hit|CXPACKET/CXCONSUMER' plugins/sql-server-tools/agents/sql-performance-monitor.md`; expected no output. Run `wc -l`; expected ≤ 200.
- [ ] **Step 6: Commit.** `feat(sql-server-tools): monitor query pack with delta sampling and Azure variants`

---

### Task 5: Tuning query pack and tuner fixes

**Files:**
- Create: `plugins/sql-server-tools/references/tuning-queries.md`
- Modify: `plugins/sql-server-tools/agents/sql-performance-tuner.md`

**Interfaces:**
- Produces ids:
  - `tuning.plan-by-text` (`?1` = `LIKE` pattern; `TOP (5)`)
  - `tuning.stats-freshness` (`?1` = `'schema.table'`; `sys.dm_db_stats_properties`)
  - `tuning.table-indexes` (`?1` = `'schema.table'`; key and include columns via `FOR XML PATH` subqueries, not `STRING_AGG`)
  - `tuning.query-store-variance` (13+; queries with more than one plan or high `stdev_duration`)
- Also produces a section `## Plan XML cues` that lists the attributes to Grep in a `.sqlplan`: `SpillToTempDb`, `PlanAffectingConvert`, `MissingIndexGroup`, `MemoryGrantInfo`, `ParameterCompiledValue` vs `ParameterRuntimeValue`, `EstimateRows` vs `ActualRows`, `NoJoinPredicate`, `Warnings`.

Agent fixes:
- **Line 61.** The rewrite becomes: "`WHERE col >= @start AND col < @next_start`, not `WHERE YEAR(col) = @year`".
- **Line 78.** The row becomes: "OR across columns: rewrite as `UNION ALL` of SARGable branches (index union is possible but unreliable); index intersection applies to AND."
- **Scalar UDFs.** Inlined on 2019+ at compat 150 when `sys.sql_modules.is_inlineable = 1`.
- **NOLOCK.** "Evaluate WITH(NOLOCK)" becomes "recommend RCSI or snapshot isolation instead of NOLOCK (missing or duplicate rows, error 601)".
- **PAGELATCH_EX/UP.** Add last-page insert contention (`OPTIMIZE_FOR_SEQUENTIAL_KEY`, 2019+).
- **CXPACKET.** Same nuance as Task 4.
- **Index creation.** `ONLINE = ON` requires Enterprise, Developer or Azure; otherwise warn about blocking and schedule the work.
- **Required artifacts.** "Always ask for execution plans" becomes "list required artifacts (actual plan, `SET STATISTICS IO, TIME` output) under Questions for the caller".
- **Wait correlation.** Remove "when you have wait statistics from sql-performance-monitor"; replace with "if the caller supplies wait statistics".

- [ ] **Step 1: Write `references/tuning-queries.md`.**
- [ ] **Step 2: Run the checker.** Expected: exit 0.
- [ ] **Step 3: Edit the agent.**
- [ ] **Step 4: Verify.** `grep -n -E 'YEAR\(col\) = @year\)|Index Intersection' plugins/sql-server-tools/agents/sql-performance-tuner.md` must show only the corrected wording. Run `wc -l`; expected ≤ 200.
- [ ] **Step 5: Commit.** `feat(sql-server-tools): tuning query pack; fix SARGable and OR guidance`

---

### Task 6: Code reviewer fixes

**Files:**
- Modify: `plugins/sql-server-tools/agents/sql-code-reviewer.md`

**Interfaces:**
- Consumes: protocol `## Severity Scale`.

Fixes:
- **Severity.** Use the protocol scale everywhere: the checklists, the findings table and the "Severity Definitions" section (delete it and point to the protocol). The verdict is `CRITICAL ISSUES` if any finding is CRITICAL, `NEEDS CHANGES` if any is HIGH, else `APPROVE`.
- **Line 108.** "NOLOCK on write operations" becomes "NOLOCK/READUNCOMMITTED on reads | HIGH | recommend RCSI or snapshot isolation; NOLOCK can skip or duplicate rows".
- **Line 109.** The fix text becomes: "`col IS NULL OR col = @x`; flag `= NULL`, `NOT IN` over nullable subqueries (use `NOT EXISTS`), and outer-joined filters placed in WHERE. Do not wrap columns in `ISNULL`/`COALESCE` in predicates."
- **Line 111.** "Trigger not set-based" becomes: "flag scalar assignment from `inserted`/`deleted`; first statement `IF @@ROWCOUNT = 0 RETURN;`".
- **New rows:**
  - HIGH: "CATCH without `THROW;` (uses `RAISERROR(ERROR_MESSAGE())`)".
  - HIGH: "`IF @@TRANCOUNT > 0 ROLLBACK` instead of `IF XACT_STATE() <> 0 ROLLBACK`".
  - HIGH: "`IF EXISTS … UPDATE ELSE INSERT` or MERGE without `UPDLOCK, HOLDLOCK`".
  - MEDIUM: "`@@IDENTITY` instead of `SCOPE_IDENTITY()`/`OUTPUT`".
- **Deployment rows:**
  - MEDIUM: "drop and recreate instead of `CREATE OR ALTER` (loses permissions)".
  - CRITICAL: "column drop or type narrowing without a data check".
  - HIGH: "index build on a large table without `ONLINE = ON` where the edition allows it".
- **Line 66.** "Blocked keywords" becomes "destructive statements without safeguards (WHERE, backups, transaction)".
- **Line 105.** SCHEMABINDING becomes a consideration (required for indexed views), not a rule.
- **Missing scope.** "Identify which files were changed" becomes: "if the caller gave no files or diff, say so under Questions for the caller".

- [ ] **Step 1: Edit.**
- [ ] **Step 2: Verify.** Run `grep -n -E 'WARNING|SUGGESTION|NOLOCK on write|IF EXISTS \(SELECT 1 FROM inserted\)' plugins/sql-server-tools/agents/sql-code-reviewer.md`; expected no output. Run `wc -l`; expected ≤ 200.
- [ ] **Step 3: Commit.** `fix(sql-server-tools): reviewer severity scale and T-SQL rule corrections`

---

### Task 7: T-SQL specialist fixes

**Files:**
- Modify: `plugins/sql-server-tools/agents/tsql-specialist.md`

Fixes:
- **Output template.** Delete `WITH (NOLOCK)` from the template (line 166). Line 83 becomes "prefer RCSI or snapshot isolation; NOLOCK only when the caller accepts dirty, missing or duplicate rows".
- **Dynamic pivot.** Pivot over a derived table that selects only `id, category, value`. Guard `IF @cols IS NULL RETURN;`. Note `STRING_AGG` needs 2017 and compat 130, with a `FOR XML PATH` alternative. Schema-qualify names.
- **Running totals.** `AVG(CAST(amount AS decimal(19,4)))`. Add a unique tiebreaker to the `ORDER BY`. Add the note "ROWS 6 PRECEDING = 7 rows, not 7 days".
- **Pagination.** Add a unique tiebreaker. Mention keyset pagination for deep pages.
- **Gap detection.** Rewrite with `LEAD(id) OVER (ORDER BY id)` (single scan).
- **Table variables.** Line 81 becomes: "no column statistics ever; 2019+ deferred compilation gives a row-count estimate only; prefer temp tables when row counts are large or joins depend on distribution".
- **Scalar UDFs.** Line 77 changes so it no longer contradicts the inlining row: "serial and row-by-row unless inlined (2019+, compat 150)".
- **N-prefix.** Line 82 becomes: "match literal and parameter types to the column type (`N''` for nvarchar, plain `''` for varchar)".
- **Version table.** Add a "Min compat" column (`STRING_AGG`/JSON 130; scalar UDF inlining and batch mode on rowstore 150; `GENERATE_SERIES`/`GREATEST`/`LEAST`/PSP 160). Add rows for `CREATE OR ALTER` and `DROP IF EXISTS` (2016 SP1), `DATETRUNC` and `IS [NOT] DISTINCT FROM` (2022).
- **New `## Execution` section:**
  - Validate SELECT logic with `mcp__mcp-sql-server__execute_query` under the protocol's MCP Query Rules.
  - Write DDL and DML to `.sql` files or into the reply for the user to run; never execute them.
  - Never put credentials in files.
- **Duplication.** Delete the "What NOT to Do" bullets that repeat Critical Gotchas. "Ask clarifying questions" becomes "put open questions under Questions for the caller".

- [ ] **Step 1: Edit.**
- [ ] **Step 2: Verify.** Run `grep -c -i 'nolock' plugins/sql-server-tools/agents/tsql-specialist.md`; expected ≤ 2, and both hits are in the RCSI guidance line. Run `grep -n 'force serial execution' …`; expected no output. Run `wc -l`; expected ≤ 200.
- [ ] **Step 3: Commit.** `fix(sql-server-tools): tsql-specialist examples, NOLOCK default and execution rules`

---

### Task 8: Router skill and README

**Files:**
- Modify: `plugins/sql-server-tools/skills/sql-server-toolkit/SKILL.md`
- Modify: `plugins/sql-server-tools/README.md`

SKILL.md requirements:
- **Description.** "Routes SQL Server work to the sql-server-tools agents and chains them for multi-step tasks. Use when a SQL Server task needs more than one agent or the right agent is unclear." Keep it under 300 characters.
- **Body: imperative steps.**
  1. Pick the agent from the decision table, with the tie-breakers from Task 2.
  2. Call the Agent tool with `subagent_type: "sql-server-tools:<agent>"` and a self-contained prompt: goal, SQL text or file path, database alias if known, facts already established.
  3. Chain order for compound tasks: `sql-schema-discovery` → `sql-performance-tuner` → `sql-code-reviewer`. Pass each agent's findings to the next.
  4. Relay each agent's `Questions for the caller` to the user.
- **Setup.** Point to the `mcp-sql-server:mcp-sql-server-setup` skill; the server must be registered as `mcp-sql-server`. Delete the `claude mcp add … sql-server` block and the `productivity-tools` line.

README requirements:
- Agents table: monitor model → Sonnet.
- New "Live vs script mode" section, two short paragraphs from protocol Connectivity.
- MCP setup: use `mcp-sql-server` and the setup skill.
- "Version-aware" becomes "Environment-aware (version, edition, Azure SQL, permissions) in live mode".

- [ ] **Step 1: Edit both files.**
- [ ] **Step 2: Behavioral test (repo rule for skills).** A general-purpose subagent follows SKILL.md literally for three requests:
  - (a) "the server has been slow since 9am"
  - (b) "this query takes 30 s: SELECT … WHERE YEAR(created_at) = 2026"
  - (c) "review migrations/001_add_orders.sql before deploy"

  It writes the Agent call it would make for each to the scratchpad and lists every ambiguity it hit. Expected: (a) the monitor, (b) the tuner, (c) the reviewer, and every prompt contains goal and input. Fix any ambiguity in the text, then rerun.
- [ ] **Step 3: Adversarial review.** A read-only reviewer subagent checks the SKILL.md diff against the repo rules (`.claude/rules/skills.md`) and the description for overlap with the agent descriptions. Resolve its findings.
- [ ] **Step 4: Verify.** `grep -n -E 'productivity-tools|claude mcp add' plugins/sql-server-tools/skills/sql-server-toolkit/SKILL.md plugins/sql-server-tools/README.md`. Expected: no output.
- [ ] **Step 5: Commit.** `docs(sql-server-tools): router invokes namespaced agents; README live/script modes`

---

### Task 9: Version bump, validation, release

**Files:**
- Modify: `plugins/sql-server-tools/.claude-plugin/plugin.json` (`"version": "1.1.0"`)
- Modify: `.claude-plugin/marketplace.json` (sql-server-tools entry `"version": "1.1.0"`)
- Modify: `README.md` (plugins table row → `1.1.0`)

- [ ] **Step 1: Bump the version** in the three files.
- [ ] **Step 2: Validate.** Run `claude plugin validate .` and `claude plugin validate plugins/sql-server-tools`; expected `Validation passed` twice. Then run the marketplace hook by hand: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | node .claude/hooks/validate-marketplace-json.mjs`; expected no output.
- [ ] **Step 3: Run the `marketplace-tools:validate-plugin` skill** on `plugins/sql-server-tools`. Expected: no FAIL.
- [ ] **Step 4: Run the full checks.**
  - `node --test plugins/sql-server-tools/scripts/check-queries.test.mjs` and `node plugins/sql-server-tools/scripts/check-queries.mjs`; both must pass.
  - `wc -l plugins/sql-server-tools/agents/*.md`; every agent ≤ 200.
  - `git ls-files --eol plugins/sql-server-tools`; expected `i/lf` for all files.
- [ ] **Step 5: Live smoke test (only if a database is reachable).** In a session where `mcp__mcp-sql-server__list_databases` returns an `ok` alias, run every `sql` block from the three packs and the protocol through `execute_query`. Use `params` placeholders with a real table. Expected: `success: true` for every block whose `Requires:` matches the server. If no database is reachable, write `live smoke: skipped (no database)` in the commit body.
- [ ] **Step 6: Commit.** `chore(sql-server-tools): bump to 1.1.0`
- [ ] **Step 7: Whole-branch review.** Use the `dispatching-final-whole-branch-review` skill before handing back. Publishing (merge to `main`, push, marketplace update) follows CLAUDE.md "Publish an update" and needs the user's go-ahead.
