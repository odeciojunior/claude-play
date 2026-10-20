# Execution Progress: sql-server-tools 1.1.0
**Plan**: docs/plans/2026-10-20-sql-server-tools-v1.1-plan.md
**Roadmap**: none
**Started**: 2026-10-20 | **Last Updated**: 2026-10-20
**Status**: In Progress

## Recovery State
<!-- Read THIS first after compaction or restart -->
**Last COMPLETED Wave**: 0
**Last DELEGATED Wave**: 1
**In-Flight Agents**: Group A (Step 1, sonnet): launching
**Next Action**: Verify Group A report; wave 1 gate; commit; launch Wave 2

## Execution Map
**Steps**: 10 (execute 10, skip 0) | **Waves**: 5 | **Effort**: ~11h (inferred; plan has no estimates) | **Tiers**: inline 1 · haiku 0 · sonnet 5 · opus 4 | **Review gates**: 5

| Wave | Group | Steps | Agent | Tier | Score | Mode | Depends On | Writes | Status |
|------|-------|-------|-------|------|-------|------|------------|--------|--------|
| 1 | A | 1 | general-purpose | sonnet | 3 | Single | — | plugins/sql-server-tools/scripts/check-queries{,.test}.mjs | Pending |
| 2 | B | 2 | general-purpose | opus | 7 | Single + review | A | references/protocol.md, agents/*.md (all 5) | Pending |
| 3 | — | 2b | — | inline | 1 | Inline (before W3 launch) | B | none (temporarily toggles installed plugin) | Pending |
| 3 | C | 4 | general-purpose | opus | 7 | Single + review | B, 2b | references/monitor-queries.md, agents/sql-performance-monitor.md | Pending |
| 3 | D | 5 | general-purpose | opus | 7 | Single + review | B, 2b | references/tuning-queries.md, agents/sql-performance-tuner.md | Pending |
| 3 | E | 3 | general-purpose | opus | 6 | Single | B, 2b | references/schema-queries.md, agents/sql-schema-discovery.md | Pending |
| 3 | F | 6 | general-purpose | sonnet | 4 | Single | B, 2b | agents/sql-code-reviewer.md | Pending |
| 4 | G | 7 | general-purpose | sonnet | 5 | Single | B, 2b | agents/tsql-specialist.md | Pending |
| 4 | H | 8 | general-purpose | sonnet | 5 | Single + review (behavioral + adversarial) | B, 2b | skills/sql-server-toolkit/SKILL.md, plugins/sql-server-tools/README.md | Pending |
| 5 | I | 9 | general-purpose | sonnet | 3 | Single + review (final whole-branch, opus) | A–H | plugin.json, .claude-plugin/marketplace.json, README.md (root) | Pending |

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
- **Glossary**:
  - LIVE mode: an mcp-sql-server alias is reachable, so agents run queries.
  - SCRIPT mode: no reachable alias, so agents emit queries for the user to run.
  - Query pack: a `references/*-queries.md` file of vetted queries, each with an id such as `monitor.waits-snapshot`.
  - Protocol: `references/protocol.md`, the shared rules every agent reads first.

## Steps
| # | Step | Status | Tier · Attempts | Score (S/A/R/B/V) | Note |
|---|------|--------|-----------------|-------------------|------|
| 1 | Query checker | Pending | sonnet · 0 | 3 (1/0/1/1/0) | tests given verbatim |
| 2 | Shared protocol + agent wiring | Pending | opus · 0 | 7 (2/1/1/2/1) | risk floor: tool allowlist = security boundary |
| 2b | Behavioral check: SCRIPT mode + path substitution | Pending | inline · 0 | 1 (0/0/0/1/0) | toggles installed plugin |
| 3 | Schema query pack + agent fixes | Pending | opus · 0 | 6 (1/1/1/1/2) | borderline 5↔6; SQL semantics judgment-only (no DB) |
| 4 | Monitor query pack + agent fixes | Pending | opus · 0 | 7 (1/1/2/1/2) | DMV units, deltas, Azure variants |
| 5 | Tuning query pack + agent fixes | Pending | opus · 0 | 7 (1/1/2/1/2) | plan XML, stats DMFs |
| 6 | Code reviewer fixes | Pending | sonnet · 0 | 4 (0/1/1/1/1) | replacement texts given |
| 7 | T-SQL specialist fixes | Pending | sonnet · 0 | 5 (1/1/1/1/1) | borderline 5↔6 |
| 8 | Router skill + README | Pending | sonnet · 0 | 5 (1/1/1/1/1) | repo rule: behavioral test + adversarial review |
| 9 | Version bump + validation | Pending | sonnet · 0 | 3 (1/0/0/2/0) | risk floor: marketplace registry |

## Wave Execution Log
| Wave | Groups | Delegated | Completed | Agent IDs | Notes |
|------|--------|-----------|-----------|-----------|-------|

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
- **Handoff**:

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
- **Do**: plan Task 3, Steps 1–5. Skip Step 6 (commit).
- **Done means**: the checker exits 0; the Task 3 Step 3 grep places version-specific columns only under the gated ids; Step 5's checks pass.
- **If Blocked**: if a required query cannot meet the MCP rules, report which rule blocks it. Do not drop the query.
- **Handoff**:

### Step 4: Monitor query pack + agent fixes
- **Route**: general-purpose · opus · score 7, plus an opus review gate.
- **Files**: create `plugins/sql-server-tools/references/monitor-queries.md`; modify `plugins/sql-server-tools/agents/sql-performance-monitor.md`.
- **Needs from upstream**: Step 2 handoff.
- **Do**: plan Task 4, Steps 1–5. Skip Step 6 (commit).
- **Done means**: the checker exits 0; the Azure count check in Task 4 Step 3 matches; the Step 5 grep is empty; the agent is ≤ 200 lines.
- **If Blocked**: if a benign wait name trips a blocked word, use a `LIKE` pattern.
- **Review gate**: general-purpose · opus, read-only. Check DMV column names, µs/ms units, NULLIF, the delta procedure and the Azure variants.
- **Handoff**:

### Step 5: Tuning query pack + agent fixes
- **Route**: general-purpose · opus · score 7, plus an opus review gate.
- **Files**: create `plugins/sql-server-tools/references/tuning-queries.md`; modify `plugins/sql-server-tools/agents/sql-performance-tuner.md`.
- **Needs from upstream**: Step 2 handoff.
- **Do**: plan Task 5, Steps 1–4. Skip Step 5 (commit).
- **Done means**: the checker exits 0; the Task 5 Step 4 grep shows only corrected wording; the agent is ≤ 200 lines.
- **If Blocked**: if `FOR XML PATH` is not workable inside the MCP wrapper, report it with the alternative you would use.
- **Review gate**: general-purpose · opus, read-only. Check the SQL and the corrected tuning guidance.
- **Handoff**:

### Step 6: Code reviewer fixes
- **Route**: general-purpose · sonnet · score 4. Replacement texts are given.
- **Files**: modify `plugins/sql-server-tools/agents/sql-code-reviewer.md`.
- **Needs from upstream**: Step 2 handoff (`## Severity Scale`).
- **Do**: plan Task 6, Steps 1–2. Skip Step 3 (commit).
- **Done means**: the Task 6 Step 2 grep is empty; the agent is ≤ 200 lines.
- **If Blocked**: if a given replacement conflicts with protocol.md, follow protocol.md and note it in CONCERNS.
- **Handoff**:

### Step 7: T-SQL specialist fixes
- **Route**: general-purpose · sonnet · score 5 (borderline).
- **Files**: modify `plugins/sql-server-tools/agents/tsql-specialist.md`.
- **Needs from upstream**: Step 2 handoff.
- **Do**: plan Task 7, Steps 1–2. Skip Step 3 (commit).
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
