# mcp-sql-server

Automated setup for the [mcp-sql-server](https://github.com/odeciojunior/mcp-sql-server) MCP server. Connects Claude Code to SQL Server databases with 10 tools for querying, schema discovery, and stored procedures.

## Prerequisites

- **Node.js** — required by the setup script to write `.mcp.json` files
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
5. Register the MCP server with Claude Code (scope options: project-private, project-shared, or user-global)
6. Optionally add further databases as named aliases

## Registration Scopes

The setup wizard offers 3 registration scopes:

| Scope | Credentials Location | Git-tracked? | Use when |
|-------|---------------------|:---:|----------|
| **project-private** (default) | `.mcp.json` | No | Each project has its own database |
| **project-shared** | `.mcp.json` | Yes | Team shares the same dev database |
| **user-global** | `~/.claude.json` | No | One database across all projects |

**project-private** is recommended. It writes to `.mcp.json` and adds it to `.gitignore` so credentials never leak to git. Each project gets its own isolated database configuration.

## Multiple Databases

One server entry can serve several databases, including ones on different hosts. The primary connection is always called `default`; each additional database gets an **alias** with its own `DB_{ALIAS}_*` variables, listed in `DB_DATABASES`.

The setup wizard collects these for you (Step 6.5), producing an entry like:

```json
{
  "mcpServers": {
    "mcp-sql-server": {
      "command": "/home/you/.claude/mcp-servers/mcp-sql-server/.venv/bin/python",
      "args": ["-m", "mcp_sql_server.server"],
      "env": {
        "DB_HOST": "prod-sql", "DB_PORT": "1433",
        "DB_USER": "svc", "DB_PASSWORD": "...", "DB_NAME": "BDesk",
        "DB_DRIVER": "ODBC Driver 18 for SQL Server",
        "DB_ENCRYPT": "true", "DB_TRUST_CERT": "true",

        "DB_DATABASES": "analytics",

        "DB_ANALYTICS_HOST": "analytics-sql",
        "DB_ANALYTICS_PORT": "1433",
        "DB_ANALYTICS_USER": "svc",
        "DB_ANALYTICS_PASSWORD": "...",
        "DB_ANALYTICS_NAME": "AnalyticsDB",
        "DB_ANALYTICS_DRIVER": "ODBC Driver 18 for SQL Server",
        "DB_ANALYTICS_ENCRYPT": "false",
        "DB_ANALYTICS_TRUST_CERT": "true"
      }
    }
  }
}
```

The alias prefix is the uppercased alias (`analytics` -> `DB_ANALYTICS_*`). Aliases must match `[a-zA-Z][a-zA-Z0-9_]{0,63}`.

To target a database, name it in your request -- "list tables in the **analytics** database" passes `database="analytics"` to the tool. Without a name, tools use `default`. `list_databases` shows everything configured.

Restart Claude Code after adding a database.

**Adding one manually:**

```bash
bash scripts/setup.sh add-database .mcp.json <alias> <host> <port> <user> <password> <name> [driver] [encrypt] [trust_cert]
```

Re-running with the same alias updates it in place. Re-running the wizard's default-database registration preserves every alias.

**Caveats:**

- An alias requires a non-empty password. A blank one fails validation at startup and breaks *every* database, `default` included, because all connections load together.

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
| `list_databases` | List configured connections and check each is reachable |

Every tool except `list_databases` accepts a `database` argument to select a configured connection (default: `default`). `list_databases` instead takes `probe` (default `true`): it opens a real connection to each database and reports what it found.

| `status` | Meaning |
|----------|---------|
| `ok` | Connected and queried successfully |
| `unreachable` | The database exists in the config but could not be opened -- `error` gives the reason |
| `misconfigured` | The alias's settings are invalid, so it was never tried |
| `unknown` | No check was run (`probe=false`) |

`status` never claims a database is reachable without having checked. A database that is offline on the server, or that your login cannot open, reports `unreachable` rather than `ok`.

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
| Fix or change not picked up | Re-run setup (or `bash scripts/setup.sh install-venv`) — it force-reinstalls and prints the installed commit. Restart Claude Code afterwards |
| MCP registration fails | Run `claude mcp list` to check for conflicts, then `claude mcp remove mcp-sql-server` and re-run |
| Connection errors | Verify credentials, network access, and that SQL Server accepts remote connections |
