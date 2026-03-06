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
