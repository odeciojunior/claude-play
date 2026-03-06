# mcp-sql-server Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the `mcp-sql-server` plugin with a setup skill and bash script that auto-installs and configures the mcp-sql-server MCP server for Claude Code.

**Architecture:** Skill-based plugin — a setup skill orchestrates the installation flow (prerequisite checks, venv creation, pip install, credential collection, MCP registration) by calling subcommands in a bash script. No hooks, no agents.

**Tech Stack:** Claude Code plugin system (Markdown + YAML frontmatter), Bash script, marketplace registration (JSON)

**Design Doc:** `docs/plans/2026-03-06-mcp-sql-server-plugin-design.md`

---

### Task 1: Create plugin scaffold

**Files:**
- Create: `plugins/mcp-sql-server/.claude-plugin/plugin.json`

**Step 1: Create plugin.json**

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

**Step 2: Commit**

```bash
git add plugins/mcp-sql-server/.claude-plugin/plugin.json
git commit -m "feat(mcp-sql-server): create plugin scaffold with plugin.json"
```

---

### Task 2: Create setup.sh script

**Files:**
- Create: `plugins/mcp-sql-server/scripts/setup.sh`

**Step 1: Write the script**

The script uses a subcommand pattern. Each subcommand is atomic:

```bash
#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="$HOME/.claude/mcp-servers/mcp-sql-server/.venv"
REPO_URL="https://github.com/odeciojunior/mcp-sql-server.git"
MIN_PYTHON_VERSION="3.10"

# --- Subcommands ---

check_python() {
    # Find python3, check version >= 3.10
    # Print: "Python X.Y.Z found at /path/to/python3"
    # Exit 0 if OK, exit 1 if missing or too old
}

check_odbc() {
    # Detect ODBC Driver 17 or 18
    # Linux/WSL: parse /etc/odbcinst.ini or run odbcinst -j
    # macOS: check /usr/local/etc/odbcinst.ini
    # Print: "ODBC Driver 18 for SQL Server" (or 17)
    # Exit 0 if found, exit 1 if missing
    # On exit 1, also print platform-specific install instructions:
    #   Ubuntu/Debian: curl + apt-get install msodbcsql18
    #   macOS: brew install microsoft/mssql-release/msodbcsql18
    #   Other: link to Microsoft docs
}

install_venv() {
    # Create $VENV_DIR if it doesn't exist
    # python3 -m venv $VENV_DIR (or reuse existing)
    # $VENV_DIR/bin/pip install --upgrade pip
    # $VENV_DIR/bin/pip install "git+${REPO_URL}"
    # Print: "Installed mcp-sql-server to $VENV_DIR"
    # Exit 0 on success, exit 1 on failure
}

verify_install() {
    # $VENV_DIR/bin/python -c "import mcp_sql_server; print(mcp_sql_server.__version__)"
    # Print: "mcp-sql-server vX.Y.Z verified"
    # Exit 0 on success, exit 1 on failure
}

detect_env() {
    local search_path="${1:-.}"
    # Look for .env file at $search_path and $search_path parent directories (up to 3 levels)
    # If found, extract lines matching DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, DB_ENCRYPT, DB_TRUST_CERT
    # Print each as: DB_HOST=sql*****er.example.com (masked: show first 3 + last 3 chars, or *** if <= 6)
    # Print DB_PASSWORD=******** (always fully masked)
    # Exit 0 if .env with at least DB_HOST found, exit 1 if not found
}

# --- Main dispatcher ---
case "${1:-}" in
    check-python)   check_python ;;
    check-odbc)     check_odbc ;;
    install-venv)   install_venv ;;
    verify-install) verify_install ;;
    detect-env)     detect_env "${2:-.}" ;;
    *)
        echo "Usage: setup.sh {check-python|check-odbc|install-venv|verify-install|detect-env [path]}"
        exit 1
        ;;
esac
```

Write the full implementation for each function. Key implementation details:

**check_python:**
```bash
check_python() {
    local python_cmd=""
    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            python_cmd="$cmd"
            break
        fi
    done

    if [[ -z "$python_cmd" ]]; then
        echo "ERROR: Python not found. Install Python 3.10 or later."
        exit 1
    fi

    local version
    version=$("$python_cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')")
    local major minor
    major=$("$python_cmd" -c "import sys; print(sys.version_info.major)")
    minor=$("$python_cmd" -c "import sys; print(sys.version_info.minor)")

    if [[ "$major" -lt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -lt 10 ]]; }; then
        echo "ERROR: Python $version found but 3.10+ required."
        exit 1
    fi

    echo "Python $version found at $(command -v "$python_cmd")"
    exit 0
}
```

**check_odbc:**
```bash
check_odbc() {
    local driver=""

    # Check odbcinst.ini locations
    for ini_file in /etc/odbcinst.ini /usr/local/etc/odbcinst.ini; do
        if [[ -f "$ini_file" ]]; then
            driver=$(grep -oP "ODBC Driver \d+ for SQL Server" "$ini_file" | tail -1)
            if [[ -n "$driver" ]]; then
                echo "$driver"
                exit 0
            fi
        fi
    done

    # Try odbcinst command
    if command -v odbcinst &>/dev/null; then
        driver=$(odbcinst -q -d 2>/dev/null | grep -oP "ODBC Driver \d+ for SQL Server" | tail -1)
        if [[ -n "$driver" ]]; then
            echo "$driver"
            exit 0
        fi
    fi

    # Not found — print platform-specific instructions
    echo "ERROR: Microsoft ODBC Driver for SQL Server not found."
    echo ""
    if [[ -f /etc/debian_version ]] || grep -qi ubuntu /etc/os-release 2>/dev/null; then
        echo "Install on Ubuntu/Debian:"
        echo "  curl https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc"
        echo "  sudo add-apt-repository \"https://packages.microsoft.com/ubuntu/\$(lsb_release -rs)/prod\""
        echo "  sudo apt-get update && sudo apt-get install -y msodbcsql18"
    elif [[ "$(uname)" == "Darwin" ]]; then
        echo "Install on macOS:"
        echo "  brew tap microsoft/mssql-release https://github.com/microsoft/homebrew-mssql-release"
        echo "  brew install msodbcsql18"
    else
        echo "Install instructions:"
        echo "  https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server"
    fi
    exit 1
}
```

**install_venv:**
```bash
install_venv() {
    local python_cmd=""
    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            python_cmd="$cmd"
            break
        fi
    done

    mkdir -p "$(dirname "$VENV_DIR")"

    if [[ ! -d "$VENV_DIR" ]]; then
        echo "Creating virtual environment at $VENV_DIR..."
        "$python_cmd" -m venv "$VENV_DIR"
    else
        echo "Virtual environment exists at $VENV_DIR, upgrading..."
    fi

    "$VENV_DIR/bin/pip" install --upgrade pip --quiet
    echo "Installing mcp-sql-server from GitHub..."
    "$VENV_DIR/bin/pip" install "git+${REPO_URL}" --quiet
    echo "Installed mcp-sql-server to $VENV_DIR"
    exit 0
}
```

**verify_install:**
```bash
verify_install() {
    if [[ ! -f "$VENV_DIR/bin/python" ]]; then
        echo "ERROR: Virtual environment not found at $VENV_DIR"
        exit 1
    fi

    local version
    version=$("$VENV_DIR/bin/python" -c "import mcp_sql_server; print(mcp_sql_server.__version__)" 2>&1) || {
        echo "ERROR: Failed to import mcp_sql_server: $version"
        exit 1
    }

    echo "mcp-sql-server v$version verified"
    exit 0
}
```

**detect_env:**
```bash
detect_env() {
    local search_path
    search_path=$(cd "${1:-.}" && pwd)
    local env_file=""
    local db_vars=("DB_HOST" "DB_USER" "DB_PASSWORD" "DB_NAME" "DB_PORT" "DB_ENCRYPT" "DB_TRUST_CERT")

    # Search up to 3 parent directories
    local dir="$search_path"
    for _ in 1 2 3; do
        if [[ -f "$dir/.env" ]]; then
            env_file="$dir/.env"
            break
        fi
        dir=$(dirname "$dir")
    done

    if [[ -z "$env_file" ]]; then
        echo "No .env file found"
        exit 1
    fi

    echo "Found: $env_file"
    local found_host=false
    for var in "${db_vars[@]}"; do
        local value
        value=$(grep -oP "^${var}=\K.*" "$env_file" 2>/dev/null | head -1 | sed 's/^["'\''"]//;s/["'\''"]$//')
        if [[ -n "$value" ]]; then
            if [[ "$var" == "DB_PASSWORD" ]]; then
                echo "$var=********"
            elif [[ ${#value} -le 6 ]]; then
                echo "$var=***"
            else
                echo "$var=${value:0:3}***${value: -3}"
            fi
            [[ "$var" == "DB_HOST" ]] && found_host=true
        fi
    done

    if $found_host; then
        exit 0
    else
        echo "ERROR: .env found but DB_HOST not set"
        exit 1
    fi
}
```

**Step 2: Make executable**

```bash
chmod +x plugins/mcp-sql-server/scripts/setup.sh
```

**Step 3: Test each subcommand locally**

```bash
# These should work on the dev machine
plugins/mcp-sql-server/scripts/setup.sh check-python
plugins/mcp-sql-server/scripts/setup.sh check-odbc
```
Expected: Both exit 0 with version/driver info (Python and ODBC are installed on this WSL machine)

**Step 4: Commit**

```bash
git add plugins/mcp-sql-server/scripts/setup.sh
git commit -m "feat(mcp-sql-server): add setup.sh script with prerequisite checks and installation"
```

---

### Task 3: Create setup skill (SKILL.md)

**Files:**
- Create: `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md`

**Step 1: Write the SKILL.md**

The skill orchestrates the full setup flow. It calls setup.sh subcommands via Bash and handles user interaction.

```markdown
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
```

**Step 2: Verify SKILL.md frontmatter**

```bash
head -5 plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
```
Expected: Valid YAML frontmatter with `name` and `description`

**Step 3: Commit**

```bash
git add plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
git commit -m "feat(mcp-sql-server): add setup skill for automated MCP server installation"
```

---

### Task 4: Create README.md

**Files:**
- Create: `plugins/mcp-sql-server/README.md`

**Step 1: Write README**

Keep under 80 lines. Cover: what it does, prerequisites, installation, setup, available tools, companion plugin, troubleshooting.

Key sections:
- **What it does** — one paragraph
- **Prerequisites** — Python 3.10+, ODBC Driver 17/18
- **Installation** — `claude plugin install mcp-sql-server@claude-play`
- **Setup** — invoke the skill: describe your task or say "setup sql server"
- **What you get** — table of 10 MCP tools
- **Companion plugin** — `sql-server-tools@claude-play` for specialized agents
- **Troubleshooting** — ODBC, Python, connectivity

**Step 2: Commit**

```bash
git add plugins/mcp-sql-server/README.md
git commit -m "docs(mcp-sql-server): add plugin README"
```

---

### Task 5: Register in marketplace

**Files:**
- Modify: `.claude-plugin/marketplace.json` — add mcp-sql-server entry
- Modify: `README.md` (repo root) — add mcp-sql-server to plugins table
- Modify: `CLAUDE.md` (repo root) — add mcp-sql-server to plugins table

**Step 1: Add marketplace entry**

Add to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{
  "name": "mcp-sql-server",
  "source": "./plugins/mcp-sql-server",
  "description": "Automated setup for the mcp-sql-server MCP server — connects Claude Code to SQL Server databases with 10 tools for querying, schema discovery, and stored procedures",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["mcp", "sql-server", "database", "mcp-server", "setup"],
  "category": "developer-tools",
  "tags": ["database", "mcp-server"]
}
```

**Step 2: Update repo README.md plugins table**

Add row: `| [mcp-sql-server](plugins/mcp-sql-server/) | Automated MCP SQL Server setup — connects Claude Code to SQL Server databases | developer-tools | 1.0.0 |`

**Step 3: Update repo CLAUDE.md plugins table**

Add row: `| mcp-sql-server | Automated MCP SQL Server setup — connects Claude Code to SQL Server databases | developer-tools |`

**Step 4: Commit**

```bash
git add .claude-plugin/marketplace.json README.md CLAUDE.md
git commit -m "feat(marketplace): register mcp-sql-server plugin"
```

---

### Task 6: Update sql-server-tools cross-reference

**Files:**
- Modify: `plugins/sql-server-tools/README.md` — update MCP setup section

**Step 1: Update the MCP Server Setup section**

Replace the current MCP setup section in `plugins/sql-server-tools/README.md` with:

```markdown
## MCP Server Setup

For live database interaction, install the companion MCP server plugin:

```bash
claude plugin install mcp-sql-server@claude-play
```

Then invoke the setup skill to configure your SQL Server connection. The setup wizard handles Python environment creation, package installation, and MCP registration automatically.

Alternatively, configure any MCP server manually:

```bash
claude mcp add --transport stdio sql-server -- <your-mcp-server-command>
```

Without an MCP server, agents analyze SQL files and provide recommendations without executing queries.
```

**Step 2: Commit**

```bash
git add plugins/sql-server-tools/README.md
git commit -m "docs(sql-server-tools): add mcp-sql-server cross-reference"
```

---

### Task 7: Validate plugin

**Files:**
- Read: All created files for structural validation

**Step 1: Verify directory structure**

```bash
find plugins/mcp-sql-server -type f | sort
```

Expected:
```
plugins/mcp-sql-server/.claude-plugin/plugin.json
plugins/mcp-sql-server/README.md
plugins/mcp-sql-server/scripts/setup.sh
plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
```

**Step 2: Validate plugin.json is valid JSON**

```bash
python3 -c "import json; json.load(open('plugins/mcp-sql-server/.claude-plugin/plugin.json'))"
```

**Step 3: Validate marketplace.json is valid JSON**

```bash
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"
```

**Step 4: Verify SKILL.md has valid frontmatter**

```bash
head -5 plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
```
Expected: Starts with `---` on line 1, has `name` and `description`

**Step 5: Verify setup.sh is executable and has valid subcommands**

```bash
ls -la plugins/mcp-sql-server/scripts/setup.sh
bash plugins/mcp-sql-server/scripts/setup.sh check-python
bash plugins/mcp-sql-server/scripts/setup.sh check-odbc
```
Expected: Script is executable, both subcommands run successfully on this machine

**Step 6: Verify setup.sh usage message**

```bash
bash plugins/mcp-sql-server/scripts/setup.sh
```
Expected: Prints usage and exits with code 1

**Step 7: Verify line counts**

```bash
wc -l plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md plugins/mcp-sql-server/scripts/setup.sh plugins/mcp-sql-server/README.md
```
Expected: SKILL.md ~120-150 lines, setup.sh ~150-180 lines, README under 80 lines

**Step 8: Final commit (if any fixes needed)**

```bash
git add -A plugins/mcp-sql-server/
git commit -m "fix(mcp-sql-server): address validation findings"
```
