# Execution Progress: sql-server-tools 1.1.0
**Plan**: docs/plans/2026-10-20-sql-server-tools-v1.1-plan.md
**Roadmap**: none
**Started**: 2026-10-20 | **Last Updated**: 2026-10-20
**Status**: Completed

## Recovery State
<!-- Read THIS first after compaction or restart -->
**Last COMPLETED Wave**: 5
**Last DELEGATED Wave**: 5
**In-Flight Agents**: none
**Next Action**: none. Published: ff-merge to main, push, marketplace update.

## Execution Map
**Steps**: 10 (execute 10, skip 0) | **Waves**: 5 | **Effort**: ~11h (inferred; plan has no estimates) | **Tiers**: inline 1 · haiku 0 · sonnet 5 · opus 4 | **Review gates**: 5

| Wave | Group | Steps | Agent | Tier | Score | Mode | Depends On | Writes | Status |
|------|-------|-------|-------|------|-------|------|------------|--------|--------|
| 1 | A | 1 | general-purpose | sonnet | 3 | Single | — | plugins/sql-server-tools/scripts/check-queries{,.test}.mjs | Done |
| 2 | B | 2 | general-purpose | opus | 7 | Single + review | A | references/protocol.md, agents/*.md (all 5) | Done |
| 3 | — | 2b | — | inline | 1 | Inline (before W3 launch) | B | none (temporarily toggles installed plugin) | Done |
| 3 | C | 4 | general-purpose | opus | 7 | Single + review | B, 2b | references/monitor-queries.md, agents/sql-performance-monitor.md | Done |
| 3 | D | 5 | general-purpose | opus | 7 | Single + review | B, 2b | references/tuning-queries.md, agents/sql-performance-tuner.md | Done |
| 3 | E | 3 | general-purpose | opus | 6 | Single | B, 2b | references/schema-queries.md, agents/sql-schema-discovery.md | Done |
| 3 | F | 6 | general-purpose | sonnet | 4 | Single | B, 2b | agents/sql-code-reviewer.md | Done |
| 4 | G | 7 | general-purpose | sonnet | 5 | Single | B, 2b | agents/tsql-specialist.md | Done |
| 4 | H | 8 | general-purpose | sonnet | 5 | Single + review (behavioral + adversarial) | B, 2b | skills/sql-server-toolkit/SKILL.md, plugins/sql-server-tools/README.md | Done |
| 5 | I | 9 | general-purpose | sonnet | 3 | Single + review (final whole-branch, opus) | A–H | plugin.json, .claude-plugin/marketplace.json, README.md (root) | Done |

Paths in Writes are under `plugins/sql-server-tools/` unless rooted.

## Shared Brief
- **Goal**: Release sql-server-tools 1.1.0. The five agents run read-only queries live through the mcp-sql-server MCP server and fall back to emitting scripts when it is absent. T-SQL errors from the 1.0.0 audit are fixed.
- **Spec**: `docs/reports/2026-10-20-sql-server-tools-audit.md`. Your step's exact requirements are in `docs/plans/2026-10-20-sql-server-tools-v1.1-plan.md`. Read only `## Global Constraints` and your own `### Task N` section. Your step card overrides the plan where they differ.
- **Architecture**:
  - Plugin at `plugins/sql-server-tools/`: `agents/*.md` (5 subagent prompts), `skills/sql-server-toolkit/SKILL.md` (router), `references/*.md` (shared protocol + query packs, new), `scripts/check-queries.mjs` (query checker, new).
  - Agents read references on demand as `${CLAUDE_PLUGIN_ROOT}/references/<file>.md`. Claude Code substitutes that variable in plugin agent bodies, so write it literally.
- **MCP facts** (from the server code):
  - `execute_query` accepts only text whose first token is SELECT/WITH and wraps it in `SELECT TOP n * FROM (<sql>) AS _limited_query`. So: no CTEs, a top-level ORDER BY needs TOP, every column must be named and unique, no `;`, no OPTION, no variables (params are `?`).
  - It rejects these whole words anywhere, including comments and literals: DROP TRUNCATE ALTER CREATE GRANT REVOKE SHUTDOWN BACKUP RESTORE DBCC OPENROWSET OPENQUERY OPENDATASOURCE BULK KILL. It also rejects any `sp_*` or `xp_*` token.
- **Read-only tool set R**: `Read, Grep, Glob, mcp__mcp-sql-server__list_databases, mcp__mcp-sql-server__execute_query, mcp__mcp-sql-server__list_tables, mcp__mcp-sql-server__describe_table, mcp__mcp-sql-server__get_view_definition, mcp__mcp-sql-server__get_function_definition, mcp__mcp-sql-server__list_procedures`.
- **Conventions**:
  - All agent, reference and skill text in English.
  - Agent files ≤ 200 lines. Reference files > 100 lines start with a TOC.
  - Agent frontmatter never has `permissionMode`, `hooks`, `mcpServers`, `initialPrompt`, `Bash`, `execute_statement`, `execute_procedure`, `execute_query_file` or a `mcp__mcp-sql-server__*` wildcard.
  - SQL in reference packs uses the plan's "Query block format" and runs on SQL Server 2012+ unless its `Requires:` line says otherwise. No `STRING_AGG`.
  - Severity scale everywhere: CRITICAL / HIGH / MEDIUM / LOW.
- **Commands**:
  - Checker tests: `node --test plugins/sql-server-tools/scripts/check-queries.test.mjs`
  - Checker: `node plugins/sql-server-tools/scripts/check-queries.mjs`
  - Plugin validate: `claude plugin validate plugins/sql-server-tools`
  - Agent sizes: `wc -l plugins/sql-server-tools/agents/*.md`
- **Shell**: Windows, Git Bash. The repo checks out CRLF (`core.autocrlf=true`), so tools must treat CRLF and LF alike. Node 22 is installed.
- **Do not touch**: `plugins/_template/`, other plugins, `docs/reports/2026-10-20-claude-code-agents-skills-workflows.md`, anything under `~/.claude/`.
- **Do not commit**: the orchestrator commits each group after verification.
- **No `sed -i` on agent files**: in Git Bash it rewrites CRLF to LF. Use the Edit tool.
- **Glossary**:
  - LIVE mode: an mcp-sql-server alias is reachable, so agents run queries.
  - SCRIPT mode: no reachable alias, so agents emit queries for the user to run.
  - Query pack: a `references/*-queries.md` file of vetted queries, each with an id such as `monitor.waits-snapshot`.
  - Protocol: `references/protocol.md`, the shared rules every agent reads first.

## Steps
| # | Step | Status | Tier · Attempts | Score (S/A/R/B/V) | Note |
|---|------|--------|-----------------|-------------------|------|
| 1 | Query checker | Done | sonnet · 1 | 3 (1/0/1/1/0) | 18/18 tests; edge cases verified by orchestrator; 9077810 |
| 2 | Shared protocol + agent wiring | Done | opus · 1 (+2 fix-up rounds) | 7 (2/1/1/2/1) | review: 5+1 defects → round 1, 1 defect → round 2; 75d5df6 |
| 2b | Behavioral check: SCRIPT mode + path substitution | Done | inline · 1 | 1 (0/0/0/1/0) | protocol.md read via substituted path; list_databases → 'No such tool' → SCRIPT mode; no fabrication; memory untested (nothing to save) |
| 3 | Schema query pack + agent fixes | Done | opus · 1 | 6 (1/1/1/1/2) | 13 ids (4 extra); agent 156 lines; orchestrator read schema.tables and depends-on-me; c020b05 |
| 4 | Monitor query pack + agent fixes | Done | opus · 1 (+1 fix-up) | 7 (1/1/2/1/2) | review: SCRIPT sampling, top-N before delta, stats window; + binary/datetimeoffset outputs; b46bbf5 |
| 5 | Tuning query pack + agent fixes | Done | opus · 1 (+1 fix-up) | 7 (1/1/2/1/2) | review: stats threshold, datetimeoffset, MemoryGrantInfo; f38ff7e |
| 6 | Code reviewer fixes | Done | sonnet · 1 | 4 (0/1/1/1/1) | 166 lines; 18e7db2 |
| 7 | T-SQL specialist fixes | Done | sonnet · 1 | 5 (1/1/1/1/1) | 198 lines; examples verified by orchestrator; 03cdf09 |
| 8 | Router skill + README | Done | sonnet · 1 (+1 fix-up) | 5 (1/1/1/1/1) | behavioral 3/3 routed; 9 ambiguities fixed; adversarial PASS; a54612c |
| 9 | Version bump + validation | Done | sonnet · 1 | 3 (1/0/0/2/0) | all validations OK; validate-plugin skill not installed → folded into final review; 4aa213e |

## Wave Execution Log
| Wave | Groups | Delegated | Completed | Agent IDs | Notes |
|------|--------|-----------|-----------|-----------|-------|
| 1 | A | 2026-10-20 | 2026-10-20 | a238870be2a54fac6 | PASS first try; commit 9077810 |
| 5 | I + final review | 2026-10-20 | 2026-10-20 | I ac451f6e5ad286b83 · final review a8491ee4fc418fc7d · fix-up a79f573b26f930bd7 | bump 4aa213e; FIX FIRST (1 blocker + 8) → fixed → SHIP; bcad0a2 |
| 4 | G, H | 2026-10-20 | 2026-10-20 | G a102b52a51a70917a · H a134f43d764f4eec7 / gate a3b6b6d76dbe01566, a3d98f440d210c397 | G 03cdf09; H 1 fix-up, a54612c; gate: 18 tests, 40 blocks, validate OK |
| 3 | C, D, E, F (+I2 inline) | 2026-10-20 | 2026-10-20 | C a594e33078b05d207/ae05831155c3f19a9 · D ab5eef5f96f78bae7/aa07fac481374049d · E a185277c2b46e9654 · F a4e4f08c207307649 | C, D 1 fix-up each; I2 = protocol rule for JSON-safe types (23e447e); gate: 18 tests, 40 blocks, validate OK |
| 2 | B (+2b inline) | 2026-10-20 | 2026-10-20 | exec a37cb57f33e19a50d · review a372215d5daa5283b | 2 fix-up rounds; gate accepted after round 2 on orchestrator check (fix = reviewer's verbatim wording); commit 75d5df6 |

## Manual Actions Required
- None blocking.
- Step 2b runs `claude plugin disable sql-server-tools@claude-play` and re-enables it right after.
- The live smoke test (plan Task 9, Step 5) will be skipped: no mcp-sql-server is registered on this machine.

## Issues & Decisions
- **Cards point to plan tasks.** The plan was written in writing-plans format: each task is already a self-contained card with exact texts and checks. Copying ~300 lines into cards would double this file and invite drift. So each card names its plan task and lists only the overrides.
- **Commits by the orchestrator.** Parallel executors on one branch would race on `.git/index.lock`. The orchestrator commits each group after verification, using the plan's commit messages.
- **Splits.**
  - Task 2 Step 6 becomes inline 2b, because it toggles global plugin state and runs nested `claude -p`.
  - Task 8 Steps 2–3 become H's review gate, because subagents cannot spawn subagents.
  - Task 9 Step 7 (whole-branch review) is I's opus review gate.
- **Opus rationale.**
  - Step 2: score 7, and the tool allowlist is the plugin's only read-only guarantee (`permissionMode` is ignored for plugin agents).
  - Steps 3–5: correct SQL across versions and Azure without a live database to test against. The checker proves MCP compliance, not semantics.
- **Inline rationale.** 2b is one command plus reading its output.
- **Write-set overlaps.** Step 2 edits all five agents, and Steps 3–7 each edit one. Resolved by running Step 2 alone in Wave 2. The plugin README (H) and root README (I) are different files.
- **Step 2 outcome.** Executor PASS. The orchestrator verified every check. Three "(you have plan permission mode)" bullets remain; they are assigned to Steps 3–5. The tuner description dropped a redundant "Do NOT use" clause in favour of the tie-breaker.
- **Step 2 review (round 1).**
  - Defects: Azure major_version = 12 gating; TOP(n) row count and order; the "read-only tools only" text vs tsql Edit/Write; alias pass-through and single-alias rule; monitor escalation wording.
  - Added by the orchestrator: the STOPPED mode line, and env detection first in SCRIPT mode.
  - Reviewer notes routed to cards: Step 3 (inline sql block), Step 4 (recursive CTE wording, server-info query), Step 7 (examples are not runnable queries).
- **Gate decision, Step 2.** After round 2, the one remaining defect was fixed with the reviewer's own suggested wording. The orchestrator verified the text and accepted the gate without a third reviewer pass.
- **2b result.** `--plugin-dir` loaded the working-tree plugin and the protocol path resolved to the repo. Memory writes are still unverified: the agent had nothing to save. The empty `.claude/agent-memory-local/` it created was removed.
- **Step 3 note.** Not gated, per routing. The orchestrator read `schema.tables` and `schema.depends-on-me`. Known gap, accepted: in `depends-on-me`, unresolved references that carry no schema are missed; resolved ones match by OBJECT_ID.
- **Cross-cutting finding (Step 5 review).** pyodbc in mcp-sql-server has no converter for `datetimeoffset` (ODBC -155), so a query that returns one fails entirely. Fixes: the tuning pack (D fix-up), `monitor.query-store-plans` (C fix-up), and a new protocol rule 8 added inline (I2) between waves 3 and 4. This uses the second of the three allowed inline steps.
- **Serialization check (orchestrator, in the server's venv).** `Decimal` → string and `datetime` → ISO are OK. Binary `bytes` fail in `pydantic_core.to_json`, and pyodbc does not support `sql_variant` or `datetimeoffset`.
  - So any raw `varbinary`/`binary` output (hashes, handles) breaks the whole result. `monitor-queries.md` returns raw `query_hash`/`query_plan_hash` at about lines 265, 266 and 628; this goes into the C fix-up.
  - Protocol rule 8 (inline I2) covers all three types.
- **Step 8 gate.**
  - The behavioral test routed a/b/c correctly and found 10 ambiguities; 9 were sent as a fix-up.
  - Rejected: broadening the description. It is deliberately narrow so it does not double-trigger with the agent descriptions.
  - The adversarial review passed.
  - The fix-up file set now includes protocol.md for one sentence (SCRIPT mode: replace `?` with literals). No other agent was in flight.
- **Branch base anomaly.** Another Claude session shares this working tree. At 08:43 it committed 9a5f0e2 on `chore/claude-code-alignment`, so `git switch -c` at 08:45 branched from that commit, not from `main`. The branch therefore carries 9a5f0e2, which only adds a docs report and does not conflict. The final review is scoped to `9a5f0e2..HEAD`. Resolved with the user's OK: `git rebase --onto main 9a5f0e2` once the other session was confirmed to be in its own worktree (`.claude/worktrees/docs-alignment`). The rebase was conflict-free (no shared files), and commit hashes in this file were updated to the rebased ones.
- **Final review: FIX FIRST.**
  - Blocker B1 (cross-task): SCRIPT mode emits one batch with no environment data, and T-SQL compiles the whole batch first, so one version- or edition-gated query kills the script. The protocol (Step 2) and the pack gates (Steps 3–5) each passed review alone.
  - 8 should-fix items, among them `execute_query`'s default `limit` = 1000, which silently cuts the `TOP (2000+)` blocks.
  - The fix went to a fresh sonnet agent, because it spans six files from several tasks.
- **Completion: tier summary (planned → actual).**
  - Step 1: sonnet → sonnet, 1 attempt.
  - Step 2: opus → opus, 2 fix-up rounds.
  - Steps 3–5: opus → opus. Step 3: 0 fix-ups. Steps 4 and 5: 1 fix-up each.
  - Steps 6, 7: sonnet → sonnet, 0 fix-ups.
  - Step 8: sonnet → sonnet, 1 fix-up.
  - Step 9: sonnet → sonnet, 0 fix-ups.
  - No escalations; inline 3/3 used (2b, I2, template heading).
  - Every review gate found real defects. The cross-task blocker (SCRIPT batch compilation) was visible only to the final review.
- **Open nits (optional, from the final review).**
  - protocol.md:28: "2022-only view" should be "column".
  - protocol.md:30: also call version-gated failures expected.
  - monitor.md:29: redundant `GO`.
  - README:27: the agent "stops and asks"; it actually stops with STOPPED and the router asks.
- **Not verified.** LIVE mode against a real server (no mcp-sql-server registered). Memory writes under `memory: local`.
- **User contribution offer.** Writing checker rule 4 (depth-0 ORDER BY) was offered and not taken up when the coordinator was invoked, so Step 1 implements it in full.

## Step Cards

### Step 1: Query checker
- **Route**: general-purpose · sonnet · score 3. Tests given verbatim; the scanner is ordinary logic; no gate (tests prove it).
- **Files**: create `plugins/sql-server-tools/scripts/check-queries.mjs` and `plugins/sql-server-tools/scripts/check-queries.test.mjs`.
- **Needs from upstream**: none. Branch `feat/sql-server-tools-v1.1` is already checked out.
- **Do**: plan Task 1, Steps 2–5, exactly. Skip Step 1 (branch) and Step 6 (commit). Clarification: when `references/` does not exist, the CLI prints `checked 0 blocks in 0 files` and exits 0.
- **Done means**:
  - The test command passes all tests.
  - `node plugins/sql-server-tools/scripts/check-queries.mjs` prints `checked 0 blocks in 0 files` with exit 0.
  - The interfaces are exported exactly: `extractSqlBlocks`, `checkQuery`, `checkFiles`.
- **If Blocked**: if a listed test case contradicts a rule, report it in CONCERNS. Do not change the expected value.
- **Handoff**: `plugins/sql-server-tools/scripts/check-queries.mjs` exports `extractSqlBlocks(markdown)→[{line,sql}]`, `checkQuery(sql)→string[]`, `checkFiles(paths)→[{file,line,message}]`. CLI `node plugins/sql-server-tools/scripts/check-queries.mjs [files…]`: no args = all `references/*.md`; prints `file:line: message`, exit 1 on violations, else `checked N blocks in M files`. Only ```sql fences are checked.

### Step 2: Shared protocol + agent wiring
- **Route**: general-purpose · opus · score 7, plus an opus review gate. The tool allowlist is the security boundary.
- **Files**: create `plugins/sql-server-tools/references/protocol.md`; modify all five `plugins/sql-server-tools/agents/*.md`.
- **Needs from upstream**: Step 1 checker CLI.
- **Do**: plan Task 2, Steps 1–5. Skip Step 6 (the orchestrator runs it as 2b) and Step 7 (commit). Section headings in protocol.md must be exactly those listed in the plan; Steps 3–8 cite them.
- **Done means**:
  - The checker prints `checked 1 blocks in 1 files` with exit 0.
  - Both greps in Task 2 Step 5 print nothing.
  - `wc -l` shows every agent ≤ 200 lines.
- **If Blocked**: if an agent exceeds 200 lines after wiring, report it. Steps 3–7 will shrink them, so do not cut content that those steps own.
- **Review gate**: general-purpose · opus, read-only. Check the frontmatter against tool set R, the protocol against plan Task 2, and the absence of forbidden keys.
- **Handoff**:
  - protocol.md opens with a `## Contents` TOC, then: `## Connectivity`, `## Environment Detection`, `## MCP Query Rules`, `## Read-Only Safety`, `## Severity Scale`, `## Final Message`, `## Memory`.
  - Gating: queries are gated on their `Requires:` version. Azure SQL DB (engine_edition 5) gates on `compat_level` plus the `Azure SQL DB:` line. MI (8) reporting major 12 gates on `compat_level` only and runs the box query.
  - Rule 4: `TOP (n)` with n = rows wanted, plus a `ROW_NUMBER() OVER (ORDER BY …) AS rn` rank column.
  - Rule 7: `Params:` labels the positional `?` as `?1`, `?2` in order of appearance; the SQL itself uses plain `?`.
  - Mode lines: `Mode: LIVE (…)`, `Live mode unavailable: …`, `Mode: STOPPED (<reason>)`.
  - Agents: `memory: local`, tool set R (tsql-specialist also has Edit and Write), the protocol line under the title, no Escalation or Memory sections.

### Step 2b: Behavioral check (inline, orchestrator)
- **Do**: plan Task 2 Step 6. Disable the installed plugin, run `claude -p --plugin-dir plugins/sql-server-tools …`, then re-enable the plugin. Apply the memory fallback if the run triggers it.
- **Done means**:
  - The agent's final message starts with `Live mode unavailable:`, contains a query, and names no fabricated tables.
  - The plugin is enabled again.
- **If Blocked**: if the protocol file is unreadable, stop and ask the user.

### Step 3: Schema query pack + agent fixes
- **Route**: general-purpose · opus · score 6. SQL semantics can only be judged, not tested; no gate per the routing rules.
- **Files**: create `plugins/sql-server-tools/references/schema-queries.md`; modify `plugins/sql-server-tools/agents/sql-schema-discovery.md`.
- **Needs from upstream**: Step 2 handoff (protocol section names).
- **Do**: plan Task 3, Steps 1–5. Skip Step 6 (commit). Also fix the "What NOT to Do" bullet that still says "(you have plan permission mode)": the agent is read-only by its tool allowlist. The file is 213 lines after Step 2, so it must end at ≤ 200. No ```sql block may stay in the agent body (e.g. the `ORDER BY …;` block near line 168): move it into the pack or delete it.
- **Done means**: the checker exits 0; the Task 3 Step 3 grep places version-specific columns only under the gated ids; Step 5's checks pass.
- **If Blocked**: if a required query cannot meet the MCP rules, report which rule blocks it. Do not drop the query.
- **Handoff**:
  - `references/schema-queries.md` has these ids: `schema.object-counts`, `.tables` (TOP 200 + `total_tables`), `.doc-coverage`, `.table-flags-2016`, `.graph-flags-2017`, `.ledger-2022`, `.columns`, `.column-flags-2016`, `.indexes`, `.index-usage`, `.foreign-keys` (both directions), `.depends-on-me`, `.i-depend-on`.
  - Row counts come from `sys.partitions` (no permission needed).

### Step 4: Monitor query pack + agent fixes
- **Route**: general-purpose · opus · score 7, plus an opus review gate.
- **Files**: create `plugins/sql-server-tools/references/monitor-queries.md`; modify `plugins/sql-server-tools/agents/sql-performance-monitor.md`.
- **Needs from upstream**: Step 2 handoff.
- **Do**: plan Task 4, Steps 1–5. Skip Step 6 (commit). Also fix the "What NOT to Do" bullet that still says "(you have plan permission mode)": the agent is read-only by its tool allowlist. The file is 212 lines after Step 2, so it must end at ≤ 200. Also:
  - Replace "Root blocker identification via recursive CTE" (around line 73) with the flat method: root blockers are sessions that block others and are not blocked themselves. The `monitor.blocking` query must not use a CTE.
  - Add a query `monitor.server-info` (`sqlserver_start_time`, `cpu_count`, physical memory from `sys.dm_os_sys_info`; Azure SQL DB variant or N/A). It feeds the report template's Uptime/CPUs/Memory fields and the "check uptime first" rule.
- **Done means**: the checker exits 0; the Azure count check in Task 4 Step 3 matches; the Step 5 grep is empty; the agent is ≤ 200 lines.
- **If Blocked**: if a benign wait name trips a blocked word, use a `LIKE` pattern.
- **Review gate**: general-purpose · opus, read-only. Check DMV column names, µs/ms units, NULLIF, the delta procedure and the Azure variants.
- **Handoff**:
  - The pack has 21 ids, including 4 `-azure` variants plus `schedulers`, `memory-clerks`, `query-store-plans` and `db-scoped-config`.
  - Snapshots return every qualifying row, and the agent ranks waits by delta.
  - A monitor run takes ≥ 30 s. In SCRIPT mode the script has `WAITFOR DELAY '00:00:30'` between two snapshot sets, and the user returns both result sets.

### Step 5: Tuning query pack + agent fixes
- **Route**: general-purpose · opus · score 7, plus an opus review gate.
- **Files**: create `plugins/sql-server-tools/references/tuning-queries.md`; modify `plugins/sql-server-tools/agents/sql-performance-tuner.md`.
- **Needs from upstream**: Step 2 handoff.
- **Do**: plan Task 5, Steps 1–4. Skip Step 5 (commit). Also fix the "What NOT to Do" bullet that still says "(you have plan permission mode)": the agent is read-only by its tool allowlist.
- **Done means**: the checker exits 0; the Task 5 Step 4 grep shows only corrected wording; the agent is ≤ 200 lines.
- **If Blocked**: if `FOR XML PATH` is not workable inside the MCP wrapper, report it with the alternative you would use.
- **Review gate**: general-purpose · opus, read-only. Check the SQL and the corrected tuning guidance.
- **Handoff**:
  - Ids: `tuning.plan-by-text`, `.stats-freshness` (2012 SP1+), `.table-indexes`, `.query-store-state`, `.query-store-variance`; plus a `## Plan XML cues` section.
  - The pack has a SCRIPT-mode note: replace `?` with literals before emitting a script.
  - The tuner has an Evidence Gathering section, and severity comes from the protocol.

### Step 6: Code reviewer fixes
- **Route**: general-purpose · sonnet · score 4. Replacement texts are given.
- **Files**: modify `plugins/sql-server-tools/agents/sql-code-reviewer.md`.
- **Needs from upstream**: Step 2 handoff (`## Severity Scale`).
- **Do**: plan Task 6, Steps 1–2. Skip Step 3 (commit).
- **Done means**: the Task 6 Step 2 grep is empty; the agent is ≤ 200 lines.
- **If Blocked**: if a given replacement conflicts with protocol.md, follow protocol.md and note it in CONCERNS.
- **Handoff**: The reviewer uses the protocol severity scale. The verdict rule is in "Severity and Verdict". There is a new "Deployment Anti-Patterns" table. Missing scope goes to Questions for the caller.

### Step 7: T-SQL specialist fixes
- **Route**: general-purpose · sonnet · score 5 (borderline).
- **Files**: modify `plugins/sql-server-tools/agents/tsql-specialist.md`.
- **Needs from upstream**: Step 2 handoff.
- **Do**: plan Task 7, Steps 1–2. Skip Step 3 (commit). Also state in the agent, near the patterns, that its examples are code to write for the user (they use DECLARE and variables) and are not queries to run through `execute_query`. Only protocol-compliant SELECTs are run.
- **Done means**: NOLOCK count ≤ 2 and only in the RCSI line; no `force serial execution`; the agent is ≤ 200 lines.
- **If Blocked**: if the line budget is too tight, cut duplicated "What NOT to Do" bullets first.
- **Handoff**:

### Step 8: Router skill + README
- **Route**: general-purpose · sonnet · score 5. The review gate runs the repo-mandated behavioral test and adversarial review.
- **Files**: modify `plugins/sql-server-tools/skills/sql-server-toolkit/SKILL.md` and `plugins/sql-server-tools/README.md`.
- **Needs from upstream**: Step 2 handoff (tie-breakers, Connectivity section).
- **Do**: plan Task 8, Steps 1 and 4. Steps 2–3 become the review gate; skip Step 5 (commit).
- **Done means**: the Task 8 Step 4 grep is empty; the SKILL.md description is < 300 characters and its frontmatter keys come from the allowlist.
- **If Blocked**: report it.
- **Review gate**:
  - (a) Behavioral test: general-purpose · sonnet, read-only. Follow SKILL.md literally on three requests and write the result to the scratchpad.
  - (b) Adversarial review: general-purpose · sonnet, read-only, against `.claude/rules/skills.md`.
- **Handoff**:

### Step 9: Version bump + validation
- **Route**: general-purpose · sonnet · score 3. Risk floor applies (marketplace registry). The opus review gate is the final whole-branch review.
- **Files**: modify `plugins/sql-server-tools/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and `README.md` (root).
- **Needs from upstream**: Steps 1–8 done.
- **Do**: plan Task 9, Steps 1–4. Step 3: if the Skill tool is unavailable to you, say so in CONCERNS. Skip Step 5 (no database; report `live smoke: skipped (no database)`), Step 6 (commit) and Step 7 (orchestrator).
- **Done means**:
  - Both validates print `Validation passed`.
  - The marketplace hook prints nothing.
  - Tests and checker pass; every agent is ≤ 200 lines; `git ls-files --eol` shows `i/lf`.
- **If Blocked**: if the version differs in any of the three places, fix it there. Never touch other plugins' entries.
- **Handoff**:
