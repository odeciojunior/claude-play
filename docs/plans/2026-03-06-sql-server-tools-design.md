# sql-server-tools Plugin Design

**Reusable SQL Server agents for Claude Code, distributed as a marketplace plugin**

**Status**: Approved
**Date**: 2026-03-06

---

## Overview

Extract reusable SQL Server agents from the `sql-playground` project, generalize them for any SQL Server environment, and package them as a Claude Code plugin for the `claude-play` marketplace.

**Approach**: Hybrid — 5 specialized agents + 1 routing skill for discoverability.

## Plugin Structure

```
plugins/sql-server-tools/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── sql-performance-monitor.md    (~250-300 lines, self-contained)
│   ├── sql-schema-discovery.md       (~200 lines, self-contained)
│   ├── sql-performance-tuner.md      (~200 lines, self-contained)
│   ├── tsql-specialist.md            (~250 lines, self-contained)
│   └── sql-code-reviewer.md          (~200 lines, self-contained)
├── skills/
│   └── sql-server-toolkit/
│       └── SKILL.md                  (~80 lines, routing skill)
└── README.md
```

**No `reference/` directory** — agents must be self-contained because plugin agents are standalone `.md` files and can't reliably reference sibling files from the plugin cache.

## Agent Configuration

| Agent | Model | Permission | Tools | Disallowed | Memory | Color | maxTurns |
|-------|-------|-----------|-------|------------|--------|-------|----------|
| sql-performance-monitor | opus | plan | Read, Grep, Glob | Edit, Write, Bash | user | red | 30 |
| sql-schema-discovery | sonnet | plan | Read, Grep, Glob | Edit, Write, Bash | project | cyan | 20 |
| sql-performance-tuner | opus | plan | Read, Grep, Glob | Edit, Write, Bash | user | blue | 25 |
| tsql-specialist | sonnet | default | Read, Edit, Write, Grep, Glob, Bash | — | user | orange | 20 |
| sql-code-reviewer | sonnet | plan | Read, Grep, Glob | Edit, Write, NotebookEdit, Bash | user | pink | 15 |

### Model Rationale

- **Opus** for performance monitor & tuner: Deep reasoning needed for root cause correlation, execution plan analysis, wait stats interpretation
- **Sonnet** for schema discovery, T-SQL specialist, code reviewer: Structured metadata queries, coding tasks, and pattern matching are well within Sonnet's capability at 40% less cost

## Routing Skill Decision Table

| User mentions... | Delegate to |
|-----------------|-------------|
| Slow queries, CPU high, wait stats, health check, blocking, deadlocks, memory pressure | `sql-performance-monitor` |
| Table structure, relationships, dependencies, schema, metadata, foreign keys | `sql-schema-discovery` |
| Optimize query, execution plan, index strategy, query rewrite, covering index | `sql-performance-tuner` |
| Write a query, stored procedure, CTE, window function, T-SQL, dynamic SQL | `tsql-specialist` |
| Review SQL code, anti-patterns, code quality, regression check, security review | `sql-code-reviewer` |

## Generalization Strategy

### What Gets Generalized

| Original (sql-playground) | Generalized |
|--------------------------|-------------|
| "Target: SQL Server 2017 Enterprise" | "Detect version from `@@VERSION` or project CLAUDE.md" |
| BdeskSumiCity views/UDFs (vwReq, udfDadoByIdDad) | "Discover objects via sys.views, sys.objects, sys.sql_modules" |
| Hardcoded field IDs | "Check project rules or CLAUDE.md for field mappings" |
| `docs/lessons/` path | Removed — project-specific |
| `query/metrics/` path | Removed — project-specific |
| Escalation to project-specific agents | Escalation to sql-server-tools agents |

### Conciseness Principle

From Anthropic's official skill authoring best practices:

> "Default assumption: Claude is already very smart. Only add context Claude doesn't already have."

**Remove**: What CTEs are, how JOINs work, what DMVs are, SQL Server architecture basics
**Keep**: Waits & Queues methodology, DMV reset-on-restart limitation, CTE non-materialization gotcha, FORMAT() vs CONVERT() performance, Unicode N'' requirement

### What Gets Dropped

| Agent | Reason |
|-------|--------|
| report-analyzer | Already exists in `productivity-tools` plugin |
| deep-research-analyst | Already exists as `deep-researcher` in `productivity-tools` plugin |
| lesson-retriever | Project-specific (hardcoded to `docs/lessons/` path) — deferred to scaffolder |
| session-lessons-documenter | Project-specific (tied to sql-playground knowledge base format) — deferred to scaffolder |
| set-baseline-metrics | Project-specific (tied to `query/metrics/` directory structure) — deferred to scaffolder |

## Agent Prompt Template

Each agent follows this structure:

```markdown
---
name: agent-name
description: "Trigger description with examples and boundaries"
model: opus|sonnet
tools: Read, Grep, Glob
disallowedTools: Edit, Write, Bash
permissionMode: plan
memory: user
color: red
maxTurns: 25
---

# Role Definition
[1-2 sentences: expertise and focus]

## Core Philosophy
[Key methodological principles — only what Claude doesn't already know]

## Workflow
[Numbered steps when invoked]

## Domain Knowledge
[SQL Server gotchas, version-aware features, conventions]
[Concise — no basics Claude already knows]

## Output Format
[Structured template: summary, findings table, recommendations]

## What NOT to Do
[Explicit anti-patterns and boundaries]

## Escalation
[When to recommend a different sql-server-tools agent]

## Memory Management
[Instructions for updating persistent memory with session learnings]
```

## Output Formats Per Agent

### Performance Monitor
```
### Health Check Summary — [HEALTHY | WARNING | CRITICAL]
### Findings — severity/category/finding/evidence table
### Recommendations — priority-ordered
### Baseline Comparison — if previous baseline exists
```

### Schema Discovery
```
### Schema Overview — object counts, key relationships
### Object Details — tables, columns, constraints, indexes
### Dependency Map — what depends on what
```

### Performance Tuner
```
### Query Analysis — original query, identified issues
### Optimization Recommendations — issue/impact/recommendation/effort table
### Suggested Rewrite — optimized query with explanation
```

### T-SQL Specialist
```
### Query — SQL with inline comments
### Explanation — approach and trade-offs
### Usage Notes — performance considerations
```

### Code Reviewer
```
### Summary — APPROVE | NEEDS CHANGES | CRITICAL ISSUES
### Findings — severity/location/issue/fix table
### Regression Risk — LOW | MEDIUM | HIGH
```

## Marketplace Registration

**plugin.json:**
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

**marketplace.json entry:**
```json
{
  "name": "sql-server-tools",
  "source": "./plugins/sql-server-tools",
  "description": "SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents",
  "version": "1.0.0",
  "author": { "name": "Odecio Machado", "email": "odeciojunior@gmail.com" },
  "license": "MIT",
  "keywords": ["sql-server", "tsql", "performance", "database", "schema", "monitoring", "review"],
  "category": "developer-tools",
  "tags": ["database", "sql-server"]
}
```

## Research Reports

Three research reports inform this design:

1. `docs/reports/2026-03-06-sql-server-subagent-best-practices.md` — Architecture patterns, MAC-SQL framework, routing skill design
2. `docs/reports/2026-03-06-sql-server-subagent-format-model-selection.md` — Agent format, model selection, pricing, output formats
3. `docs/reports/2026-03-06-sql-server-plugin-design-validation.md` — Design validation against official docs, critical issue with reference/ directory

## Future Work (Deferred)

- **SQL Server project scaffolder skill**: Generates `.claude/agents/`, `.claude/rules/`, and project structure for new SQL Server projects (includes lesson-retriever, session-lessons-documenter, set-baseline-metrics as project-level agents)
- **MCP server bundling**: Package the sql-playground MCP server as part of the plugin with `.mcp.json` configuration
- **Hook-based SQL validation**: PreToolUse hook to validate SQL queries before execution
