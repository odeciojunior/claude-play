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
5. Registers the MCP server with Claude Code (3 scope options: project-private, project-shared, user-global)
6. Optionally adds further databases as named aliases

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

- If exit code 0: Report success and the installed commit from the script output, continue
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

Ask the user: **"Where should I register the MCP server?"**

Present these 3 options:

| Option | Description | Where credentials are stored |
|--------|-------------|------------------------------|
| **project-private** (default) | This project only, credentials gitignored | `.mcp.json` + `.gitignore` |
| **project-shared** | This project only, credentials visible to team | `.mcp.json` (not gitignored) |
| **user-global** | All projects on this machine | `~/.claude.json` |

Recommend **project-private** unless the user has a reason to choose otherwise. Explain: "project-private keeps credentials in .mcp.json (which gets added to .gitignore so they never leak to git). Each project gets its own database config."

#### Option A: project-private (default)

1. Ensure `.mcp.json` is gitignored:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" ensure-gitignore "$CLAUDE_PROJECT_DIR" ".mcp.json"
```

2. Write the MCP server entry into `.mcp.json`:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" register-mcp-json \
  "$CLAUDE_PROJECT_DIR/.mcp.json" \
  "<python-path>" \
  "<DB_HOST>" "<DB_PORT>" "<DB_USER>" "<DB_PASSWORD>" "<DB_NAME>" \
  "<DB_DRIVER>" "<DB_ENCRYPT>" "<DB_TRUST_CERT>"
```

Substitute `<DB_DRIVER>` with the driver name from Step 2, or `ODBC Driver 18 for SQL Server` if the user accepted the default.

If the project `.mcp.json` already exists, the script merges the `mcp-sql-server` entry into the existing `mcpServers` object — other servers (e.g., `docker`) are preserved.

#### Option B: project-shared

Same as Option A Step 2 (write to `.mcp.json`), but **skip** the `ensure-gitignore` step. Warn the user: "Credentials will be visible in git. Make sure this is a non-sensitive dev database."

#### Option C: user-global

**Always attempt `claude mcp add` first.** If it exits non-zero (for any reason — shell expansion, conflicts, permissions), automatically fall through to the `.mcp.json` direct-edit fallback in Option A.

```bash
claude mcp add --transport stdio --scope user \
  -e DB_HOST=<host> \
  -e DB_USER=<user> \
  -e DB_PASSWORD=<password> \
  -e DB_NAME=<database> \
  [-e DB_PORT=<port>] \
  [-e DB_DRIVER=<driver>] \
  [-e DB_ENCRYPT=<true/false>] \
  [-e DB_TRUST_CERT=<true/false>] \
  mcp-sql-server -- \
  <python-path> -m mcp_sql_server.server
```

Only include optional `-e` flags if the user provided non-default values.

**Tip:** If `<password>` contains special shell characters (e.g. `!`, `$`, backslashes, quotes), export it first and reference the variable: `export DB_PASSWORD='your_password'`, then use `-e DB_PASSWORD=$DB_PASSWORD` instead.

**Fallback if `claude mcp add --scope user` fails:** Re-run using the `export DB_PASSWORD` approach above. If it still fails, fall back to Option A (project-private) and inform the user. Note: this fallback registers the server at project scope, not user-global — inform the user that the registration will be project-private for this project only.

### Step 6.5: Additional Databases (optional)

One server entry can serve several databases. Each extra database gets an **alias** with its own `DB_{ALIAS}_*` variables, and every tool takes a `database` argument to choose between them.

Ask: **"Do you want to connect additional databases? (yes/no)"**

If no, continue to Step 7. If yes, repeat this loop for each one:

1. "What alias should this database use? (e.g. analytics, archive)"
2. "Hostname or IP?"
3. "Username?"
4. "Password?"
5. "Database name?"
6. "Port? (default: 1433)"
7. "Enable encrypted connection? (default: no)"
8. "Trust server certificate? (default: no)"

**Validate before calling the script:**
- Alias: must match `[a-zA-Z][a-zA-Z0-9_]{0,63}` and must not be `default` — re-prompt if invalid
- Host, username, database name: must be non-empty
- **Password: required.** An alias with an empty password is skipped at startup and left unavailable — better to catch it now than discover it later
- Port: a number between 1 and 65535
- Re-prompt only the invalid field, not the whole set

Then add the database:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" add-database \
  "$CLAUDE_PROJECT_DIR/.mcp.json" \
  "<alias>" \
  "<HOST>" "<PORT>" "<USER>" "<PASSWORD>" "<NAME>" \
  "<DRIVER>" "<ENCRYPT>" "<TRUST_CERT>"
```

The script writes `DB_{ALIAS}_*` into the existing entry and appends the alias to `DB_DATABASES`. Running it again with the same alias updates that database in place rather than duplicating it.

After each one, ask: "Add another database? (yes/no)" — repeat until the user declines.

**Notes:**
- `add-database` needs the entry created in Step 6, so always run Step 6 first. It fails with a clear error if the entry is missing.
- If the user chose **user-global** in Step 6, pass `"$HOME/.claude.json"` as the first argument instead of the project `.mcp.json`.
- Re-running Step 6 later updates only the default connection — aliases added here are preserved.

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
Scope: project-private | project-shared | user-global

Configured databases:
  - default    <DB_DATABASE> on <DB_HOST>
  - <alias>    <name> on <host>          (repeat per alias added in Step 6.5)

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

Then tell the user:
- **Restart Claude Code** for the new configuration to take effect.
- If more than one database is configured, explain how to target one: name it in the
  request ("list tables in the analytics database"), which passes `database="analytics"`
  to the tool. Without a name, tools use `default`.
- `list_databases` shows every configured connection.

## Reconfiguration

This skill can be re-run to:
- Upgrade the mcp-sql-server package (re-runs install-venv, which force-reinstalls so a moved git HEAD is always picked up)
- Change database credentials (re-runs credential collection + MCP registration)
- Switch between scopes (project-private, project-shared, user-global)
- Add or update additional databases (re-runs Step 6.5; existing aliases are preserved)

**Switching scopes:** If changing from user-global to project-private, run `claude mcp remove mcp-sql-server --scope user` first to remove the global entry, then re-run setup and choose project-private.

## Troubleshooting

If setup fails:
- **Python not found**: Install Python 3.10+ from https://python.org
- **ODBC not found**: Follow the platform-specific instructions shown
- **pip install fails**: Check internet connectivity; try `pip install git+https://github.com/odeciojunior/mcp-sql-server.git` manually
- **MCP registration fails**: Run `claude mcp list` to check for conflicts, then `claude mcp remove mcp-sql-server` and re-run setup
- **"Unknown database 'x'"**: The alias is not in `DB_DATABASES`. Re-run Step 6.5 for it, then restart Claude Code.
- **A database is missing / unavailable**: Its alias is misconfigured (e.g. empty host, user, password or name) and was skipped — other databases, including `default`, keep working. Ask the server to list databases; a misconfigured alias shows `status: "misconfigured"` with a value-free error (e.g. `password: string_too_short`). Fix that alias's env vars and restart Claude Code.
