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
- If exit code 1: Show the error message, then provide the install URL for their platform:
  - **Windows:** https://www.python.org/downloads/ — check "Add Python to PATH" during install
  - **Linux:** `sudo apt-get install python3 python3-venv` (Ubuntu/Debian) or `sudo dnf install python3` (RHEL/Fedora)
  - Tell the user: "Install Python 3.10 or later, then re-run this skill."
  - STOP — do not continue until Python is installed.

### Step 2: Check ODBC Driver

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" check-odbc
```

- If exit code 0: Report ODBC driver found, continue
- If exit code 1: Show the install instructions from the script output, then ask: "Is the ODBC driver already installed on your system?"
  - **If yes:** Ask them to confirm the exact driver name:
    - **Windows:** Open "ODBC Data Sources (64-bit)" (`odbcad32.exe`) → Drivers tab
    - **Linux:** Run `odbcinst -q -d` or `dpkg -l | grep msodbcsql`
    - Once confirmed (e.g. "ODBC Driver 18 for SQL Server"), accept it and continue to Step 3.
  - **If no:** STOP — user must install the ODBC driver first.

### Step 3: Install MCP Server

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" install-venv
```

- If exit code 0: Report success, continue
- If exit code 1: Diagnose from the error message:
  - **"git: command not found"** → Ask user to install git (`apt-get install git` / winget install git) and retry.
  - **pip / network error** → Retry once. If it fails again, show the manual install command:
    - Linux/macOS: `~/.claude/mcp-servers/mcp-sql-server/.venv/bin/pip install git+https://github.com/odeciojunior/mcp-sql-server.git`
    - Windows: `~/.claude/mcp-servers/mcp-sql-server/.venv/Scripts/pip install git+https://github.com/odeciojunior/mcp-sql-server.git`
  - **venv exists but broken** → Delete and recreate: `rm -rf ~/.claude/mcp-servers/mcp-sql-server/.venv` then re-run install-venv.
  - Any other error: Show the full error output and STOP.

### Step 4: Verify Installation

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" verify-install
```

- If exit code 0: Report version, continue
- If exit code 1: Re-run only the `install-venv` command from Step 3 (one retry — do not re-enter the Step 3 diagnostic tree). If Step 4 fails again:
  - Show the installed packages for diagnosis:
    - Linux/macOS: `~/.claude/mcp-servers/mcp-sql-server/.venv/bin/pip list`
    - Windows: `~/.claude/mcp-servers/mcp-sql-server/.venv/Scripts/pip list`
  - STOP and ask the user to share the output.

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
  4. "What is the database name?" (DB_DATABASE)
- Then ask about optional settings:
  5. "Port? (default: 1433)" (DB_PORT)
  6. "Enable encrypted connection? (default: no)" (DB_ENCRYPT)
  7. "Trust server certificate? (default: no)" (DB_TRUST_CERT)

**Validate before continuing:**
- DB_HOST, DB_USER, DB_DATABASE: must be non-empty — re-prompt any that are blank
- DB_PORT: must be a number between 1 and 65535 (default: 1433) — re-prompt if invalid
- DB_ENCRYPT, DB_TRUST_CERT: accept `yes`, `no`, `true`, `false` (case-insensitive) — re-prompt if unrecognized
- Re-prompt only the invalid field, not the entire credential set

### Step 6: Register MCP Server

First determine the correct Python interpreter path for the platform:

- **Linux / macOS:** `~/.claude/mcp-servers/mcp-sql-server/.venv/bin/python`
- **Windows (Git Bash / MSYS2):** `~/.claude/mcp-servers/mcp-sql-server/.venv/Scripts/python.exe`

Detect which applies by checking whether `uname -s` output starts with `MINGW`, `MSYS`, or `CYGWIN`.

Ask the user: "Register for this project only, or for all projects? (project/user)"
- **project** (default): use `claude mcp add` without a scope flag
- **user**: use `claude mcp add --scope user`

**Always attempt `claude mcp add` first.** If it exits non-zero (for any reason — shell expansion, conflicts, permissions), automatically fall through to the `.mcp.json` direct-edit fallback below. Do not preemptively skip based on password content.

Build and run the `claude mcp add` command with the collected credentials (add `--scope user` if the user chose user scope):

```bash
claude mcp add --transport stdio \
  -e DB_HOST=<host> \
  -e DB_USER=<user> \
  -e DB_PASSWORD=<password> \
  -e DB_DATABASE=<database> \
  [-e DB_PORT=<port>] \
  [-e DB_ENCRYPT=<true/false>] \
  [-e DB_TRUST_CERT=<true/false>] \
  [--scope user] \
  mcp-sql-server -- \
  <python-path> -m mcp_sql_server.server
```

Only include optional `-e` flags if the user provided non-default values.

**Fallback (if `claude mcp add` fails for any reason):** Edit `.mcp.json` directly instead:

```json
{
  "mcpServers": {
    "mcp-sql-server": {
      "command": "<python-path>",
      "args": ["-m", "mcp_sql_server.server"],
      "env": {
        "DB_HOST": "<host>",
        "DB_USER": "<user>",
        "DB_PASSWORD": "<password>",
        "DB_DATABASE": "<database>",
        "DB_PORT": "<port>",
        "DB_ENCRYPT": "<true/false>",
        "DB_TRUST_CERT": "<true/false>"
      }
    }
  }
}
```

If a `.mcp.json` already exists, merge the `"mcp-sql-server"` entry into the existing `"mcpServers"` object.

Or use env var references if credentials are already in a `.env` / settings file (e.g. `"DB_PASSWORD": "${MY_SQL_PASSWORD}"`).

For **user scope** via fallback: if `claude mcp add --scope user` failed, ask the user to export the password as a shell variable first (e.g. `export DB_PASSWORD='...'`) and pass `-e DB_PASSWORD=$DB_PASSWORD`, then re-run with `--scope user`.

### Step 7: Verify Registration

```bash
claude mcp list
```

- If `mcp-sql-server` appears: proceed to Step 8.
- If not found and the user registered with `--scope user`: run `claude mcp list --scope user` — user-scoped servers may not appear in the default list.
- If still not found: re-run Step 6 (the registration command). Check for error output — a common cause is a naming conflict with an existing `mcp-sql-server` entry. If so, run `claude mcp remove mcp-sql-server` first, then retry Step 6.

### Step 8: Report Success

Print a summary:

```
MCP SQL Server setup complete!

Server: mcp-sql-server
Database: <DB_DATABASE> on <DB_HOST>
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
