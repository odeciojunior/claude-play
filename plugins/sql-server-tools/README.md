# sql-server-tools

SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents for Claude Code.

## Installation

```bash
claude plugin install sql-server-tools@claude-play
```

## Agents

| Agent | Model | Description | Use When |
|-------|-------|-------------|----------|
| sql-performance-monitor | Sonnet | Deep performance diagnostics using Waits & Queues methodology | Server-wide or unknown-cause slowness, health checks, CPU/memory/I/O issues, blocking, deadlocks |
| sql-schema-discovery | Sonnet | Schema exploration via catalog views and DMVs | Understanding tables, relationships, dependencies |
| sql-performance-tuner | Opus | Execution plan analysis and query optimization | One specific slow query, procedure or plan; index recommendations; query rewrites |
| tsql-specialist | Sonnet | Expert T-SQL development with best practices | Writing queries, stored procedures, CTEs, window functions |
| sql-code-reviewer | Sonnet | 5-phase SQL-focused code review | Reviewing SQL changes before deployment |

## Routing Skill

The `sql-server-toolkit` skill automatically routes SQL Server tasks to the right agent. Just describe your task and Claude will select the appropriate specialist.

## Live vs script mode

Each agent starts by calling `list_databases` on the `mcp-sql-server` MCP server. When an alias reports `ok`, the agent runs in LIVE mode: it detects the version, edition and permissions, then runs read-only queries itself and reports findings with evidence. If several aliases are `ok` and you named none, the agent stops and asks which one to use.

When the server is missing or no alias is `ok`, the agent runs in SCRIPT mode. Its answer opens with `Live mode unavailable: <reason>` and it emits the queries as a numbered script for you to run. The `?` placeholders in those queries are replaced with literal values before the script is handed over, because SSMS and sqlcmd do not bind `?`. Paste the results back and the agent analyzes them. It never invents output. A monitor run samples twice, so it takes at least 30 seconds; in SCRIPT mode you return both snapshot result sets.

## MCP Server Setup

For live database interaction, install the companion MCP server plugin:

```bash
claude plugin install mcp-sql-server@claude-play
```

Then run the `mcp-sql-server:mcp-sql-server-setup` skill to configure your SQL Server connection. The setup wizard handles Python environment creation, package installation, and MCP registration automatically. The server must be registered as `mcp-sql-server`, because the agents call its tools by that name.

mcp-sql-server's `execute_query` rejects CTEs at runtime (it wraps the text in a subquery), which is why the query packs avoid them.

Without the server, agents work in SCRIPT mode.

## Query packs

Vetted queries live in `references/`: `protocol.md` (shared rules), `schema-queries.md`, `monitor-queries.md` and `tuning-queries.md`. Agents load them on demand. Contributors check them with:

```bash
node plugins/sql-server-tools/scripts/check-queries.mjs
```

## Customization

Override any agent at the project level by creating a file with the same name in your project's `.claude/agents/` directory. Project-level agents take priority over plugin agents.

## What's Included

- **5 specialized agents** — each focused on a specific SQL Server discipline
- **1 routing skill** — automatic agent selection based on task description
- **Generalized for any SQL Server environment** — no hardcoded versions or project-specific references
- **Environment-aware** (version, edition, Azure SQL, permissions) in live mode
