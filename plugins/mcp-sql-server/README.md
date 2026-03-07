# mcp-sql-server

Automated setup for the [mcp-sql-server](https://github.com/odeciojunior/mcp-sql-server) MCP server. Connects Claude Code to SQL Server databases with 10 tools for querying, schema discovery, and stored procedures.

## Prerequisites

- **Python 3.10+** — the setup wizard checks automatically
- **Microsoft ODBC Driver 17 or 18** — platform-specific install instructions provided if missing

## Installation

```bash
claude plugin install mcp-sql-server@claude-play
```

## Setup

After installing the plugin, describe your task or say "setup sql server". The setup wizard will:

1. Check Python and ODBC prerequisites
2. Create an isolated virtual environment at `~/.claude/mcp-servers/mcp-sql-server/.venv`
3. Install the MCP server package from GitHub
4. Detect existing `.env` files or prompt for database credentials
5. Register the MCP server with Claude Code via `claude mcp add`

## Available Tools

Once configured, Claude Code gains these 10 MCP tools:

| Tool | Description |
|------|-------------|
| `execute_query` | Run read-only SELECT queries |
| `execute_statement` | Execute INSERT/UPDATE/DELETE |
| `execute_query_file` | Run SQL from .sql files |
| `list_tables` | List all tables |
| `describe_table` | Get column details |
| `get_view_definition` | View SQL source |
| `get_function_definition` | UDF SQL source |
| `list_procedures` | List stored procedures |
| `execute_procedure` | Run stored procedure |
| `list_databases` | List configured connections |

## Companion Plugin

For specialized SQL Server agents (performance monitoring, schema discovery, query optimization, T-SQL development, code review), install:

```bash
claude plugin install sql-server-tools@claude-play
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Python not found | Install Python 3.10+ from https://python.org |
| ODBC driver missing | Follow the platform-specific instructions shown during setup |
| pip install fails | Check internet connectivity; the package installs from GitHub |
| MCP registration fails | Run `claude mcp list` to check for conflicts, then `claude mcp remove mcp-sql-server` and re-run |
| Connection errors | Verify credentials, network access, and that SQL Server accepts remote connections |
