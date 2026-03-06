# mcp-sql-server Plugin Design

**Automated MCP SQL Server setup for Claude Code, distributed as a marketplace plugin**

**Status**: Approved
**Date**: 2026-03-06

---

## Overview

Package the [mcp-sql-server](https://github.com/odeciojunior/mcp-sql-server) Python MCP server as a Claude Code marketplace plugin. Users install via `claude plugin install mcp-sql-server@claude-play`, then invoke a setup skill that creates an isolated venv, installs the server, detects/collects credentials, and registers the MCP server — fully automated.

**Approach**: Setup skill + bash script, no hooks.

**Companion plugin**: `sql-server-tools` provides specialized SQL Server agents. This plugin provides the MCP server they connect to.

## Plugin Structure

```
plugins/mcp-sql-server/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── mcp-sql-server-setup/
│       └── SKILL.md              # Interactive setup wizard
├── scripts/
│   └── setup.sh                  # Venv/pip/ODBC detection subcommands
└── README.md
```

No agents, no hooks. The skill handles user interaction; the script handles system operations.

## Setup Skill Flow

```
User invokes skill
    │
    ├─ 1. Check prerequisites
    │     ├─ Python 3.10+ available?
    │     ├─ ODBC Driver 17 or 18 installed?
    │     └─ If missing → show platform-specific instructions, STOP
    │
    ├─ 2. Install MCP server
    │     ├─ Create venv at ~/.claude/mcp-servers/mcp-sql-server/.venv
    │     ├─ pip install git+https://github.com/odeciojunior/mcp-sql-server.git
    │     └─ Verify import works
    │
    ├─ 3. Collect credentials
    │     ├─ Scan for .env files (cwd, project root)
    │     ├─ If found → parse DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, show to user for confirmation
    │     ├─ If not found → prompt for each credential one at a time
    │     └─ Optional: DB_PORT, DB_ENCRYPT, DB_TRUST_CERT
    │
    ├─ 4. Register MCP server
    │     ├─ claude mcp add --transport stdio -e DB_HOST=... mcp-sql-server -- <venv>/bin/python -m mcp_sql_server.server
    │     └─ Scope: project-level (default) or user-level (if user prefers)
    │
    └─ 5. Verify
          ├─ Confirm MCP server appears in claude mcp list
          └─ Print success message with available tools summary
```

### Credential Handling

- Credentials passed via `-e` flags in `claude mcp add` — Claude Code manages them securely
- Never written to disk by the plugin
- `.env` detection only reads variable names and shows masked values for confirmation

### Venv Location

`~/.claude/mcp-servers/mcp-sql-server/.venv` — shared across projects, install once use everywhere.

## setup.sh Script

Subcommand pattern — each operation atomic and independently testable:

| Subcommand | Purpose | Exit Code |
|-----------|---------|-----------|
| `check-python` | Verify Python 3.10+, print version | 0 = found, 1 = missing/too old |
| `check-odbc` | Detect ODBC Driver 17/18, print driver name | 0 = found, 1 = missing |
| `install-venv` | Create venv + pip install from GitHub | 0 = success, 1 = failure |
| `verify-install` | Import mcp_sql_server, print version | 0 = success, 1 = failure |
| `detect-env [path]` | Scan for .env, print DB_* vars (masked values) | 0 = found, 1 = not found |

### ODBC Detection Strategy

| Platform | Detection Method |
|----------|-----------------|
| Linux/WSL | `odbcinst -j` then grep `/etc/odbcinst.ini` |
| macOS | Check `/usr/local/etc/odbcinst.ini` or `odbcinst -j` |
| Windows (from WSL) | `reg.exe query "HKLM\SOFTWARE\ODBC"` |

### Platform-Specific ODBC Install Instructions

When ODBC is missing, show:

- **Ubuntu/Debian**: `curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add - && sudo apt-get install msodbcsql18`
- **macOS**: `brew install microsoft/mssql-release/msodbcsql18`
- **Other**: Link to https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

## Plugin Configuration

### plugin.json

```json
{
  "name": "mcp-sql-server",
  "description": "Automated setup for the mcp-sql-server MCP server — connects Claude Code to SQL Server databases with 10 tools for querying, schema discovery, and stored procedures",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["mcp", "sql-server", "database", "mcp-server", "setup"]
}
```

### marketplace.json Entry

```json
{
  "name": "mcp-sql-server",
  "source": "./plugins/mcp-sql-server",
  "description": "Automated setup for the mcp-sql-server MCP server — connects Claude Code to SQL Server databases with 10 tools for querying, schema discovery, and stored procedures",
  "version": "1.0.0",
  "author": { "name": "Odecio Machado", "email": "odeciojunior@gmail.com" },
  "license": "MIT",
  "keywords": ["mcp", "sql-server", "database", "mcp-server", "setup"],
  "category": "developer-tools",
  "tags": ["database", "mcp-server"]
}
```

## MCP Server Capabilities (Post-Setup)

After setup, users get these 10 MCP tools:

| Tool | Purpose |
|------|---------|
| `execute_query` | Run read-only SELECT queries with server-side limiting |
| `execute_statement` | Execute INSERT/UPDATE/DELETE with auto-commit |
| `execute_query_file` | Load and execute SQL from .sql files |
| `list_tables` | List all tables (cached 60s) |
| `describe_table` | Get detailed column info (cached 60s) |
| `get_view_definition` | Retrieve view SQL source |
| `get_function_definition` | Retrieve UDF SQL source |
| `list_procedures` | List all stored procedures (cached 60s) |
| `execute_procedure` | Execute stored procedure with parameters |
| `list_databases` | List all configured database connections |

Plus 5 MCP resources: `sqlserver://tables`, `sqlserver://database/info`, `sqlserver://functions`, `sqlserver://pool/stats`, `sqlserver://databases`.

## Cross-References

- `mcp-sql-server` README: "For specialized SQL Server agents, also install `sql-server-tools@claude-play`"
- `sql-server-tools` README: Update MCP setup section to mention "For automated setup, install `mcp-sql-server@claude-play`"

## Security Notes

The mcp-sql-server project has built-in security:
- Blocked DDL/DCL keywords (DROP, TRUNCATE, ALTER, CREATE, GRANT, etc.)
- Statement type enforcement (execute_query = SELECT only, execute_statement = DML only)
- Blocked system procedures (xp_*, sp_*)
- Identifier validation and bracket-quoting
- Error message sanitization (strips IPs, credentials)
- Query file path traversal prevention

The plugin itself handles credentials carefully:
- Never writes credentials to disk
- Passes via `claude mcp add -e` flags (Claude Code manages storage)
- `.env` detection shows masked values, requires user confirmation
