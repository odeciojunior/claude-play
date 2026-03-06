# sql-server-tools Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the `sql-server-tools` plugin with 5 generalized SQL Server agents and 1 routing skill for the claude-play marketplace.

**Architecture:** Hybrid plugin — agents in `agents/` for full subagent capabilities (model, memory, permissionMode), routing skill in `skills/` for automatic discoverability. All agents self-contained (no reference files).

**Tech Stack:** Claude Code plugin system (Markdown + YAML frontmatter), marketplace registration (JSON)

**Source:** Agents extracted and generalized from `/home/odecio/projects/sql-playground/.claude/agents/`

**Design Doc:** `docs/plans/2026-03-06-sql-server-tools-design.md`

---

### Task 1: Create plugin scaffold

**Files:**
- Create: `plugins/sql-server-tools/.claude-plugin/plugin.json`
- Create: `plugins/sql-server-tools/agents/` (empty directory via first agent)
- Create: `plugins/sql-server-tools/skills/sql-server-toolkit/` (empty directory via skill)

**Step 1: Create plugin.json**

```json
{
  "name": "sql-server-tools",
  "description": "SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["sql-server", "tsql", "performance", "database", "schema", "monitoring", "review"]
}
```

**Step 2: Commit**

```bash
git add plugins/sql-server-tools/.claude-plugin/plugin.json
git commit -m "feat(sql-server-tools): create plugin scaffold with plugin.json"
```

---

### Task 2: Create sql-performance-monitor agent

**Files:**
- Read: `/home/odecio/projects/sql-playground/.claude/agents/sql-performance-monitor.md` (source — 800+ lines)
- Create: `plugins/sql-server-tools/agents/sql-performance-monitor.md` (target — ~250-300 lines)

**Generalization rules:**
- Remove "Target Environment: SQL Server 2017 Enterprise Edition (14.0.2095.1)" → replace with dynamic version detection guidance
- Remove all project-specific MCP tool references (`execute_query`, `describe_table`, etc.) → replace with "use available MCP SQL tools or execute diagnostic queries via Bash"
- Remove references to project-specific agents in escalation table (lesson-retriever, session-lessons-documenter) → replace with sql-server-tools agents only
- Remove references to set-baseline-metrics agent
- Keep: Waits and Queues methodology, DMV limitations awareness, leading vs lagging indicators philosophy
- Keep: All 10 analysis categories (CPU, waits, queries, indexes, blocking, memory, I/O, TempDB, Query Store, comprehensive health)
- Trim: Remove detailed SQL query examples that Claude can write from knowledge — keep only non-obvious DMV patterns
- Trim: Remove explanations of what DMVs are (Claude knows) — keep only gotchas and limitations

**Frontmatter:**
```yaml
---
name: sql-performance-monitor
description: "Deep SQL Server performance monitoring and diagnostics specialist. Analyzes wait statistics, CPU utilization, memory pressure, I/O bottlenecks, blocking chains, index effectiveness, TempDB contention, and Query Store health. Use when the user reports slow queries, high CPU, database health checks, needs baseline metrics, or proactive performance monitoring. Do NOT use for query writing (use tsql-specialist) or schema exploration (use sql-schema-discovery)."
model: opus
tools: Read, Grep, Glob
disallowedTools: Edit, Write, Bash
permissionMode: plan
memory: user
color: red
maxTurns: 30
---
```

**Prompt body sections (self-contained, ~250-300 lines):**
1. Role Definition (2 sentences)
2. Core Philosophy (Waits & Queues, leading vs lagging, DMV limitations — ~20 lines)
3. Workflow (numbered steps when invoked — ~15 lines)
4. Analysis Categories (10 categories, concise bullet points — ~80 lines)
5. Key DMV Reference (essential DMVs with gotchas, NOT full queries — ~40 lines)
6. Common Wait Type Categories (mapping wait types to root causes — ~30 lines)
7. Output Format (health check template — ~20 lines)
8. What NOT to Do (~10 lines)
9. Escalation to other sql-server-tools agents (~10 lines)
10. Memory Management instructions (~10 lines)

**Step 1: Write the agent file**

Read the source, apply generalization rules and conciseness principle, write the target file.

**Step 2: Verify line count**

```bash
wc -l plugins/sql-server-tools/agents/sql-performance-monitor.md
```
Expected: 250-300 lines

**Step 3: Verify no project-specific references remain**

```bash
grep -i "bdesksum\|vwReq\|vwRepTime\|udfDado\|udfPart\|udfSLA\|2017 Enterprise\|14\.0\.2095\|lesson-retriever\|session-lessons\|set-baseline\|sql-playground" plugins/sql-server-tools/agents/sql-performance-monitor.md
```
Expected: No matches

**Step 4: Commit**

```bash
git add plugins/sql-server-tools/agents/sql-performance-monitor.md
git commit -m "feat(sql-server-tools): add sql-performance-monitor agent (generalized from sql-playground)"
```

---

### Task 3: Create sql-schema-discovery agent

**Files:**
- Read: `/home/odecio/projects/sql-playground/.claude/agents/sql-schema-discovery.md` (source — ~410 lines)
- Create: `plugins/sql-server-tools/agents/sql-schema-discovery.md` (target — ~200 lines)

**Generalization rules:**
- Remove "Target Environment" hardcoding → dynamic version detection
- Remove MCP tool references → generic guidance
- Remove project-specific escalation (lesson-retriever, session-lessons-documenter)
- Keep: All 6 analysis query templates (table structure, FKs, indexes, dependencies, special types, extended properties) — these are genuinely useful reference SQL that's non-trivial
- Keep: Critical caveats (dependency tracking limitations, index stats reset, FK trust, graph columns, temporal history)
- Keep: Permission requirements section
- Trim: Remove catalog view table (Claude knows sys.tables, sys.columns, etc.)
- Trim: Remove version-specific limitations table (Claude can detect from @@VERSION)
- Trim: Row counts query (trivial — Claude can write this)

**Frontmatter:**
```yaml
---
name: sql-schema-discovery
description: "SQL Server schema exploration and documentation specialist. Discovers table structures, relationships, dependencies, indexes, and special table types (graph, temporal, memory-optimized). Use when the user needs to understand database schemas, find foreign keys, trace object dependencies, or generate schema documentation. Do NOT use for performance analysis (use sql-performance-monitor) or query optimization (use sql-performance-tuner)."
model: sonnet
tools: Read, Grep, Glob
disallowedTools: Edit, Write, Bash
permissionMode: plan
memory: project
color: cyan
maxTurns: 20
---
```

**Prompt body sections (~200 lines):**
1. Role Definition (2 sentences)
2. Core Philosophy (metadata-first, dependency awareness — ~10 lines)
3. Workflow (numbered steps — ~10 lines)
4. Core Responsibilities (6 categories, concise — ~40 lines)
5. Key Analysis Queries (4-5 most useful, compact — ~60 lines)
6. Critical Caveats (dependency tracking, index stats, FK trust — ~30 lines)
7. Output Format (schema overview + table detail templates — ~25 lines)
8. What NOT to Do (~8 lines)
9. Escalation (~8 lines)
10. Memory Management (~8 lines)

**Step 1: Write the agent file**

Read source, apply rules, write target.

**Step 2: Verify line count and no project refs**

```bash
wc -l plugins/sql-server-tools/agents/sql-schema-discovery.md
grep -i "bdesksum\|vwReq\|2017 Enterprise\|14\.0\.2095\|lesson-retriever\|session-lessons\|sql-playground" plugins/sql-server-tools/agents/sql-schema-discovery.md
```

**Step 3: Commit**

```bash
git add plugins/sql-server-tools/agents/sql-schema-discovery.md
git commit -m "feat(sql-server-tools): add sql-schema-discovery agent (generalized from sql-playground)"
```

---

### Task 4: Create sql-performance-tuner agent

**Files:**
- Read: `/home/odecio/projects/sql-playground/.claude/agents/sql-server-performance-tuner.md` (source — ~125 lines)
- Create: `plugins/sql-server-tools/agents/sql-performance-tuner.md` (target — ~200 lines)

**Generalization rules:**
- Remove "Target Environment" and version-specific feature table → dynamic detection
- Remove references to project-specific views (vwReq, vwRepTime) and UDFs (udfDadoByIdDad, udfPartRep)
- Remove MCP tool references → generic
- Remove project-specific escalation agents
- Expand: This agent is currently thin (~125 lines). Add Waits & Queues correlation, execution plan operator cost guidance, and index strategy decision matrix that are genuinely useful and non-trivial
- Keep: Analysis methodology, severity definitions, quality standards

**Frontmatter:**
```yaml
---
name: sql-performance-tuner
description: "SQL Server query optimization specialist. Analyzes execution plans, identifies bottlenecks, recommends index strategies, and suggests query rewrites. Use when the user has a slow query, needs index recommendations, wants execution plan analysis, or needs query rewrite suggestions. Do NOT use for server-wide monitoring (use sql-performance-monitor) or schema exploration (use sql-schema-discovery)."
model: opus
tools: Read, Grep, Glob
disallowedTools: Edit, Write, Bash
permissionMode: plan
memory: user
color: blue
maxTurns: 25
---
```

**Prompt body sections (~200 lines):**
1. Role Definition (2 sentences)
2. Analysis Methodology (5-step process — ~20 lines)
3. Core Responsibilities (query analysis, execution plans, index strategy, database-level — ~40 lines)
4. Common Anti-Patterns Reference (scalar UDFs, implicit conversions, non-SARGable, FORMAT vs CONVERT — ~25 lines)
5. Index Strategy Decision Matrix (when clustered/nonclustered/covering/filtered — ~20 lines)
6. Execution Plan Expensive Operators (what to look for and what each means — ~20 lines)
7. Output Format (assessment, issues, recommendations, implementation notes — ~20 lines)
8. Severity Definitions (~10 lines)
9. What NOT to Do (~10 lines)
10. Escalation (~8 lines)
11. Memory Management (~8 lines)

**Step 1: Write the agent file**

Read source, apply rules, expand thin sections, write target.

**Step 2: Verify line count and no project refs**

```bash
wc -l plugins/sql-server-tools/agents/sql-performance-tuner.md
grep -i "bdesksum\|vwReq\|vwRepTime\|udfDado\|udfPart\|udfSLA\|2017 Enterprise\|14\.0\.2095\|lesson-retriever\|session-lessons\|sql-playground\|infrastructure request" plugins/sql-server-tools/agents/sql-performance-tuner.md
```

**Step 3: Commit**

```bash
git add plugins/sql-server-tools/agents/sql-performance-tuner.md
git commit -m "feat(sql-server-tools): add sql-performance-tuner agent (generalized from sql-playground)"
```

---

### Task 5: Create tsql-specialist agent

**Files:**
- Read: `/home/odecio/projects/sql-playground/.claude/agents/tsql-specialist.md` (source — ~169 lines)
- Create: `plugins/sql-server-tools/agents/tsql-specialist.md` (target — ~250 lines)

**Generalization rules:**
- Remove entire "Project-Specific Context" section (MCP blocked keywords, specific views, specific UDFs) → replace with "Check project CLAUDE.md for environment-specific context"
- Remove version-pinned feature tables (SQL Server 2017 specific) → replace with concise "Version-Aware Features" section noting common version boundaries
- Keep: Core competencies (query development, performance optimization, database objects, best practices)
- Keep: Quality checks, approach methodology, output format
- Keep: Critical gotchas table (CTEs, scalar UDFs, FORMAT vs CONVERT, CLR strict security)
- Expand: Add a concise "Common T-SQL Patterns" section with non-trivial patterns (dynamic pivot, running totals, gap/island detection) that add real value

**Frontmatter:**
```yaml
---
name: tsql-specialist
description: "Expert T-SQL development specialist. Writes complex queries, stored procedures, functions, and views with proper optimization. Handles CTEs, window functions, dynamic SQL, JSON operations, and graph queries. Use when the user needs to write, troubleshoot, or understand T-SQL code. Do NOT use for performance monitoring (use sql-performance-monitor) or execution plan analysis (use sql-performance-tuner)."
model: sonnet
tools: Read, Edit, Write, Grep, Glob, Bash
permissionMode: default
memory: user
color: orange
maxTurns: 20
---
```

**Prompt body sections (~250 lines):**
1. Role Definition (2 sentences)
2. Core Competencies (query dev, optimization, database objects — ~30 lines)
3. Best Practices (9 rules — keep, they're concise — ~15 lines)
4. Version-Aware Features (concise boundary table: 2016, 2017, 2019, 2022 — ~25 lines)
5. Critical Gotchas (CTEs, scalar UDFs, FORMAT, CLR — ~20 lines)
6. Common T-SQL Patterns (dynamic pivot, running totals, gaps/islands — ~40 lines)
7. Approach (5 principles — ~15 lines)
8. Output Format (~15 lines)
9. Quality Checks (~15 lines)
10. What NOT to Do (~10 lines)
11. Escalation (~8 lines)
12. Memory Management (~8 lines)

**Step 1: Write the agent file**

Read source, apply rules, write target.

**Step 2: Verify line count and no project refs**

```bash
wc -l plugins/sql-server-tools/agents/tsql-specialist.md
grep -i "bdesksum\|vwReq\|vwRepTime\|udfDado\|udfPart\|udfSLA\|2017 Enterprise\|14\.0\.2095\|lesson-retriever\|session-lessons\|sql-playground\|infrastructure request\|execute_query\|execute_statement" plugins/sql-server-tools/agents/tsql-specialist.md
```

**Step 3: Commit**

```bash
git add plugins/sql-server-tools/agents/tsql-specialist.md
git commit -m "feat(sql-server-tools): add tsql-specialist agent (generalized from sql-playground)"
```

---

### Task 6: Create sql-code-reviewer agent

**Files:**
- Read: `/home/odecio/projects/sql-playground/.claude/agents/code-reviewer.md` (source — ~102 lines)
- Create: `plugins/sql-server-tools/agents/sql-code-reviewer.md` (target — ~200 lines)

**Generalization rules:**
- Rename from `code-reviewer` to `sql-code-reviewer` (SQL-focused scope)
- Remove Phase 2 BdeskSumiCity references (field IDs, form codes, action IDs)
- Remove `.claude/rules/field-reference.md` reference → replace with "Check project CLAUDE.md and rules for domain-specific field references"
- Keep: All 5 review phases (Objective, Business Rules, Regression, Quality, Security)
- Keep: SQL-specific checks (Unicode N'', WITH(NOLOCK), CONVERT vs FORMAT, parameter binding)
- Keep: Output format (Summary, Findings with severity, Regression Risk, Test Recommendations)
- Keep: "What NOT to Do" section
- Expand: Add SQL-specific security checklist (injection patterns, blocked keywords, error message sanitization)
- Update escalation table to reference sql-server-tools agents

**Frontmatter:**
```yaml
---
name: sql-code-reviewer
description: "SQL Server code review specialist. Reviews T-SQL code for correctness, performance anti-patterns, security vulnerabilities, and regression risks. Covers business logic verification, SQL injection prevention, parameter binding, and naming conventions. Use when SQL code changes need review before deployment. Do NOT use for query optimization (use sql-performance-tuner) or writing new queries (use tsql-specialist)."
model: sonnet
tools: Read, Grep, Glob
disallowedTools: Edit, Write, NotebookEdit, Bash
permissionMode: plan
memory: user
color: pink
maxTurns: 15
---
```

**Prompt body sections (~200 lines):**
1. Role Definition (2 sentences)
2. Workflow (5 steps — ~10 lines)
3. Review Phases (5 phases, generalized — ~60 lines)
4. SQL-Specific Security Checklist (~20 lines)
5. Common SQL Anti-Patterns to Flag (~20 lines)
6. Output Format (summary, findings table, regression risk, test recommendations — ~30 lines)
7. Severity Definitions (~10 lines)
8. What NOT to Do (~10 lines)
9. Escalation (~10 lines)
10. Memory Management (~8 lines)

**Step 1: Write the agent file**

Read source, apply rules, write target.

**Step 2: Verify line count and no project refs**

```bash
wc -l plugins/sql-server-tools/agents/sql-code-reviewer.md
grep -i "bdesksum\|vwReq\|vwRepTime\|udfDado\|field-reference\|lesson-retriever\|session-lessons\|sql-playground\|infrastructure request" plugins/sql-server-tools/agents/sql-code-reviewer.md
```

**Step 3: Commit**

```bash
git add plugins/sql-server-tools/agents/sql-code-reviewer.md
git commit -m "feat(sql-server-tools): add sql-code-reviewer agent (generalized from sql-playground)"
```

---

### Task 7: Create sql-server-toolkit routing skill

**Files:**
- Create: `plugins/sql-server-tools/skills/sql-server-toolkit/SKILL.md` (~80 lines)

**Content:**
- YAML frontmatter with name and description (broad SQL Server trigger keywords)
- Decision table mapping task types to agent names
- "When NOT to use" section
- Brief examples of how delegation works

**Step 1: Write the SKILL.md**

```markdown
---
name: sql-server-toolkit
description: Routes SQL Server tasks to specialized agents. Use when working with SQL Server databases, T-SQL queries, database performance, schema exploration, or SQL code review. Automatically selects the best agent for the task.
---

# SQL Server Toolkit

Routes SQL Server tasks to the right specialist agent.

## Agent Selection

| Task Type | Agent | What It Does |
|-----------|-------|-------------|
| Performance issues, health checks, wait stats, CPU/memory/I/O analysis, blocking, deadlocks | `sql-performance-monitor` | Deep diagnostics using Waits & Queues methodology |
| Schema exploration, table structure, relationships, dependencies, documentation | `sql-schema-discovery` | Metadata-first schema analysis via catalog views |
| Query optimization, execution plans, index strategy, query rewrites | `sql-performance-tuner` | Execution plan analysis and optimization recommendations |
| Write queries, stored procedures, CTEs, window functions, T-SQL development | `tsql-specialist` | Expert T-SQL development with best practices |
| Review SQL code, anti-patterns, security, regression analysis | `sql-code-reviewer` | 5-phase SQL-focused code review |

## How to Use

Ask Claude to delegate to the appropriate agent:

- "Use sql-performance-monitor to check database health"
- "Use sql-schema-discovery to explore the Customers table"
- "Use sql-performance-tuner to optimize this slow query"
- "Use tsql-specialist to write a query with running totals"
- "Use sql-code-reviewer to review my stored procedure changes"

Or just describe your task — Claude will select the right agent based on context.

## When NOT to Use

- General Python/JavaScript/other language work — these agents are SQL Server specific
- Report analysis or strategic planning — use productivity-tools plugin instead
- Non-SQL-Server databases (PostgreSQL, MySQL, etc.) — agents use SQL Server DMVs and T-SQL syntax

## Setup

For full database interaction, configure an MCP server for SQL Server connectivity:
```bash
claude mcp add --transport stdio sql-server -- <your-mcp-server-command>
```

Without an MCP server, agents analyze SQL files and provide recommendations without live database access.
```

**Step 2: Verify SKILL.md structure**

```bash
head -5 plugins/sql-server-tools/skills/sql-server-toolkit/SKILL.md
```
Expected: Valid YAML frontmatter with `name` and `description`

**Step 3: Commit**

```bash
git add plugins/sql-server-tools/skills/sql-server-toolkit/SKILL.md
git commit -m "feat(sql-server-tools): add sql-server-toolkit routing skill"
```

---

### Task 8: Create README.md

**Files:**
- Create: `plugins/sql-server-tools/README.md`

**Content:**
- Plugin overview (what it does, who it's for)
- Installation command (`claude plugin install sql-server-tools@claude-play`)
- Agent table (name, model, description, triggers)
- Routing skill description
- MCP server setup guidance
- Customization tips (overriding agents at project level)

**Step 1: Write README.md**

Keep concise — under 100 lines. Focus on installation and usage, not internals.

**Step 2: Commit**

```bash
git add plugins/sql-server-tools/README.md
git commit -m "docs(sql-server-tools): add plugin README"
```

---

### Task 9: Register in marketplace

**Files:**
- Modify: `.claude-plugin/marketplace.json` — add sql-server-tools entry to plugins array
- Modify: `README.md` (repo root) — add sql-server-tools to plugins table
- Modify: `CLAUDE.md` (repo root) — add sql-server-tools to plugins table

**Step 1: Read current marketplace.json**

```bash
# Read to understand current structure before editing
```

**Step 2: Add marketplace entry**

Add to the `plugins` array in `.claude-plugin/marketplace.json`:
```json
{
  "name": "sql-server-tools",
  "source": "./plugins/sql-server-tools",
  "description": "SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["sql-server", "tsql", "performance", "database", "schema", "monitoring", "review"],
  "category": "developer-tools",
  "tags": ["database", "sql-server"]
}
```

**Step 3: Update repo README.md plugins table**

Add row: `| sql-server-tools | SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents | developer-tools |`

**Step 4: Update repo CLAUDE.md plugins table**

Add row matching the README.

**Step 5: Commit**

```bash
git add .claude-plugin/marketplace.json README.md CLAUDE.md
git commit -m "feat(marketplace): register sql-server-tools plugin"
```

---

### Task 10: Validate plugin

**Files:**
- Read: All created files for structural validation

**Step 1: Verify directory structure**

```bash
find plugins/sql-server-tools -type f | sort
```

Expected:
```
plugins/sql-server-tools/.claude-plugin/plugin.json
plugins/sql-server-tools/README.md
plugins/sql-server-tools/agents/sql-code-reviewer.md
plugins/sql-server-tools/agents/sql-performance-monitor.md
plugins/sql-server-tools/agents/sql-performance-tuner.md
plugins/sql-server-tools/agents/sql-schema-discovery.md
plugins/sql-server-tools/agents/tsql-specialist.md
plugins/sql-server-tools/skills/sql-server-toolkit/SKILL.md
```

**Step 2: Validate plugin.json is valid JSON**

```bash
python3 -c "import json; json.load(open('plugins/sql-server-tools/.claude-plugin/plugin.json'))"
```
Expected: No error

**Step 3: Validate marketplace.json is valid JSON**

```bash
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"
```
Expected: No error

**Step 4: Verify all agents have valid frontmatter**

```bash
for f in plugins/sql-server-tools/agents/*.md; do echo "=== $f ==="; head -3 "$f"; echo; done
```
Expected: Each file starts with `---` on line 1

**Step 5: Verify no project-specific references across all files**

```bash
grep -ri "bdesksum\|vwReq\|vwRepTime\|udfDado\|udfPart\|udfSLA\|sql-playground\|14\.0\.2095" plugins/sql-server-tools/
```
Expected: No matches

**Step 6: Run plugin validation skill (if available)**

```bash
# Use the validate-plugin skill from marketplace-tools
```

**Step 7: Verify line counts are within targets**

```bash
wc -l plugins/sql-server-tools/agents/*.md plugins/sql-server-tools/skills/sql-server-toolkit/SKILL.md
```
Expected: No agent over 350 lines, skill under 100 lines

**Step 8: Final commit (if any fixes needed)**

```bash
git add -A plugins/sql-server-tools/
git commit -m "fix(sql-server-tools): address validation findings"
```
