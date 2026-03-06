# sql-server-tools

SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents for Claude Code.

## Installation

```bash
claude plugin install sql-server-tools@claude-play
```

## Agents

| Agent | Model | Description | Use When |
|-------|-------|-------------|----------|
| sql-performance-monitor | Opus | Deep performance diagnostics using Waits & Queues methodology | Slow server, health checks, CPU/memory/I/O issues, blocking |
| sql-schema-discovery | Sonnet | Schema exploration via catalog views and DMVs | Understanding tables, relationships, dependencies |
| sql-performance-tuner | Opus | Execution plan analysis and query optimization | Slow query, index recommendations, query rewrites |
| tsql-specialist | Sonnet | Expert T-SQL development with best practices | Writing queries, stored procedures, CTEs, window functions |
| sql-code-reviewer | Sonnet | 5-phase SQL-focused code review | Reviewing SQL changes before deployment |

## Routing Skill

The `sql-server-toolkit` skill automatically routes SQL Server tasks to the right agent. Just describe your task and Claude will select the appropriate specialist.

## MCP Server Setup

For live database interaction, configure an MCP server:

```bash
claude mcp add --transport stdio sql-server -- <your-mcp-server-command>
```

Without an MCP server, agents analyze SQL files and provide recommendations without executing queries.

## Customization

Override any agent at the project level by creating a file with the same name in your project's `.claude/agents/` directory. Project-level agents take priority over plugin agents.

## What's Included

- **5 specialized agents** — each focused on a specific SQL Server discipline
- **1 routing skill** — automatic agent selection based on task description
- **Generalized for any SQL Server environment** — no hardcoded versions or project-specific references
- **Version-aware** — agents detect SQL Server version and adapt recommendations accordingly
