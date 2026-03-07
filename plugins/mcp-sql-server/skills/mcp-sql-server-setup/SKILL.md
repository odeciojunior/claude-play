---
name: mcp-sql-server-setup
description: Set up the mcp-sql-server MCP server for SQL Server database connectivity. Creates an isolated Python environment, installs the server, configures database credentials, and registers the MCP server with Claude Code. Use when the user wants to connect to a SQL Server database, set up MCP SQL Server, or says "setup sql server".
---

# MCP SQL Server Setup

Automated setup wizard for the [mcp-sql-server](https://github.com/odeciojunior/mcp-sql-server) MCP server.

## What This Does

1. Checks prerequisites (Python 3.10+, ODBC Driver)
2. Creates isolated Python environment
3. Installs mcp-sql-server from GitHub
4. Collects database credentials
5. Registers the MCP server with Claude Code

## Setup Steps

Follow these steps in order. Stop and report to the user if any step fails.

### Step 1: Check Python

Run the setup script to check Python availability:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" check-python
```

- If exit code 0: Report Python version found, continue
- If exit code 1: Show the error message and STOP — user must install Python 3.10+

### Step 2: Check ODBC Driver

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" check-odbc
```

- If exit code 0: Report ODBC driver found, continue
- If exit code 1: Show the platform-specific install instructions from the script output and STOP — user must install the ODBC driver first

### Step 3: Install MCP Server

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" install-venv
```

- If exit code 0: Report success, continue
- If exit code 1: Show error and STOP

### Step 4: Verify Installation

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" verify-install
```

- If exit code 0: Report version, continue
- If exit code 1: Show error — installation may be corrupted, suggest re-running setup

### Step 5: Collect Database Credentials

First, try to detect an existing .env file:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" detect-env .
```

**If .env found (exit 0):**
- Show the detected variables (masked) to the user
- Ask: "I found these database settings. Use them? (yes/no)"
- If yes: Parse the actual values from the .env file for use in Step 6
- If no: Fall through to manual prompts

**If .env not found (exit 1) or user declined:**
- Prompt the user for each required credential:
  1. "What is the SQL Server hostname or IP?" (DB_HOST)
  2. "What is the database username?" (DB_USER)
  3. "What is the database password?" (DB_PASSWORD)
  4. "What is the database name?" (DB_NAME)
- Then ask about optional settings:
  5. "Port? (default: 1433)" (DB_PORT)
  6. "Enable encrypted connection? (default: no)" (DB_ENCRYPT)
  7. "Trust server certificate? (default: no)" (DB_TRUST_CERT)

### Step 6: Register MCP Server

Build and run the `claude mcp add` command with the collected credentials:

```bash
claude mcp add --transport stdio \
  -e DB_HOST=<host> \
  -e DB_USER=<user> \
  -e DB_PASSWORD=<password> \
  -e DB_NAME=<database> \
  [-e DB_PORT=<port>] \
  [-e DB_ENCRYPT=<true/false>] \
  [-e DB_TRUST_CERT=<true/false>] \
  mcp-sql-server -- \
  ~/.claude/mcp-servers/mcp-sql-server/.venv/bin/python -m mcp_sql_server.server
```

Only include optional `-e` flags if the user provided non-default values.

Ask the user: "Register for this project only, or for all projects? (project/user)"
- project (default): no extra flags
- user: add `--scope user` flag

### Step 7: Verify Registration

```bash
claude mcp list
```

Confirm `mcp-sql-server` appears in the output.

### Step 8: Report Success

Print a summary:

```
MCP SQL Server setup complete!

Server: mcp-sql-server
Database: <DB_NAME> on <DB_HOST>
Scope: project | user

Available tools (10):
  - execute_query        Run read-only SELECT queries
  - execute_statement    Execute INSERT/UPDATE/DELETE
  - execute_query_file   Run SQL from .sql files
  - list_tables          List all tables
  - describe_table       Get column details
  - get_view_definition  View SQL source
  - get_function_definition  UDF SQL source
  - list_procedures      List stored procedures
  - execute_procedure    Run stored procedure
  - list_databases       List configured connections

Tip: For specialized SQL Server agents, also install:
  claude plugin install sql-server-tools@claude-play
```

## Reconfiguration

This skill can be re-run to:
- Upgrade the mcp-sql-server package (re-runs install-venv)
- Change database credentials (re-runs credential collection + MCP registration)
- Switch between project and user scope

## Troubleshooting

If setup fails:
- **Python not found**: Install Python 3.10+ from https://python.org
- **ODBC not found**: Follow the platform-specific instructions shown
- **pip install fails**: Check internet connectivity; try `pip install git+https://github.com/odeciojunior/mcp-sql-server.git` manually
- **MCP registration fails**: Run `claude mcp list` to check for conflicts, then `claude mcp remove mcp-sql-server` and re-run setup
