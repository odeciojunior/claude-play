---
name: mcp-sql-server-setup
description: Set up the mcp-sql-server MCP server for SQL Server database connectivity. Creates an isolated Python environment, installs the server, collects connection settings (the password stays in an environment variable the user sets) and registers the MCP server with Claude Code. Use when the user wants to connect to a SQL Server database, set up MCP SQL Server, or says "setup sql server".
disable-model-invocation: true
---

# MCP SQL Server Setup

Automated setup wizard for the [mcp-sql-server](https://github.com/odeciojunior/mcp-sql-server) MCP server.

## What This Does

1. Checks prerequisites (Python 3.10+, ODBC Driver)
2. Creates isolated Python environment
3. Installs mcp-sql-server from GitHub
4. Collects connection settings (never the password)
5. Registers the MCP server with Claude Code (3 scopes: project, local, user). The config stores only the placeholder `${DB_PASSWORD}`; the user sets the real value as an environment variable, and Claude Code expands it at launch
6. Optionally adds further databases as named aliases

## Password rule (read first)

You never see the database password: not in chat, not in a command you run, not in a file you read.

- Never ask for it, and never read, parse, grep or print it from a `.env`, `.mcp.json` or `~/.claude.json`.
- If the user pastes a password in chat anyway, do not use it in any command. Tell them to set it as an environment variable instead (Step 5) and to consider changing it, since it is now in the conversation history.
- In every setup command, pass the password argument as the reference `env:DB_PASSWORD` (or `env:DB_<ALIAS>_PASSWORD`). The script writes the literal placeholder `${DB_PASSWORD}` itself. Never pass a `${...}` form (a shell launched from PowerShell can mangle it, and the script rejects it) and never a double-quoted shell variable (that would expand the real secret).

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

### Step 5: Collect Connection Settings

First, try to detect an existing .env file:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" detect-env .
```

The script prints masked values only and shows `DB_PASSWORD` as `********` when present.

**If .env found (exit 0):**
- Show the detected variables (masked) to the user
- Ask: "I found these database settings. Use them? (yes/no)"
- If yes: get the non-secret values with this filter, on the path that `detect-env` printed after `Found:`:

  ```bash
  grep -E '^(export[[:space:]]+)?(DB_HOST|DB_USER|DB_NAME|DB_DATABASE|DB_PORT|DB_ENCRYPT|DB_TRUST_CERT)=' "<found .env>"
  ```

  Use `DB_NAME` (or `DB_DATABASE` if that is the key used) as the database name. Never open the `.env` with Read, `cat`, `head`, an editor or any other command that shows the whole file: it would show the `DB_PASSWORD` line. `detect-env` only tells you whether the password exists.
- If no: Fall through to manual prompts

**If .env not found (exit 1) or user declined:**
- Prompt the user for each required setting:
  1. "What is the SQL Server hostname or IP?" (DB_HOST)
  2. "What is the database username?" (DB_USER)
  3. "What is the database name?" (DB_NAME)
- Then ask about optional settings:
  4. "Port? (default: 1433)" (DB_PORT)
  5. "Enable encrypted connection? (default: no)" (DB_ENCRYPT)
  6. "Trust server certificate? (default: no)" (DB_TRUST_CERT)

**Validate before continuing:**
- DB_HOST, DB_USER, DB_NAME: must be non-empty — re-prompt any that are blank
- DB_PORT: must be a number between 1 and 65535 (default: 1433) — re-prompt if invalid
- DB_ENCRYPT, DB_TRUST_CERT: accept `yes`, `no`, `true`, `false` (case-insensitive) — re-prompt if unrecognized
- Re-prompt only the invalid field, not the entire set

**The password is the user's job.** Tell the user to set `DB_PASSWORD` in their environment themselves, then fully restart Claude Code (Step 8):

| Platform | What the user runs (in their own terminal, not through you) |
|----------|--------------------------------------------------------------|
| Windows | `setx DB_PASSWORD "<password>"`, then open a NEW terminal or IDE window; `setx` does not change windows that are already open |
| bash / zsh | add `export DB_PASSWORD='<password>'` to `~/.bashrc` or `~/.zshrc`, then open a new shell |

Only SQL Server logins (user name + password) are supported. The server always sends a user and a password, so Windows Authentication / trusted connections do not work.

If the password is in a `.env`, tell the user they can load it into their own shell before starting Claude Code (`set -a; . "<found .env>"; set +a` in bash/zsh, with the path `detect-env` printed), or copy it into one of the commands above. Do not run this for them.

### Step 6: Register MCP Server

Get the interpreter path (always use this output; never write a `~/...` path, because `command` is not tilde-expanded):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" python-path
```

It prints a native absolute path (`C:/Users/<you>/.claude/mcp-servers/mcp-sql-server/.venv/Scripts/python.exe` on Windows, `/home/<you>/.claude/mcp-servers/mcp-sql-server/.venv/bin/python` elsewhere). Exit 1 means no venv: go back to Step 3.

In the commands below, `<python>` is that path and `<driver>` is the driver name from Step 2 (default `ODBC Driver 18 for SQL Server`). `<encrypt>` and `<trust>` are `true` or `false`.

Ask the user: **"Where should I register the MCP server?"**

| Scope | Where it is stored | Shared? | Use when |
|-------|--------------------|---------|----------|
| **local** (recommended default) | `~/.claude.json`, under this project | No, private to you, this project only | Your own connection for this project |
| **project** | `.mcp.json` in the project root | Yes, safe to commit (no secret in the file) | The team shares the same server settings; each person sets `DB_PASSWORD` |
| **user** | `~/.claude.json`, global | No, private to you, every project | One database you use everywhere |

In every scope the stored entry holds `"DB_PASSWORD": "${DB_PASSWORD}"`, never the password.

**Upgrading from an older setup:** versions up to 1.2.3 of this skill wrote the password in plain text. If the user set this server up before, ask which option they chose then and have them remove that entry first. Never open the old config to check.

| Old (≤ 1.2.3) option | Remove with |
|----------------------|-------------|
| project-private or project-shared | `claude mcp remove mcp-sql-server --scope project` (removes the entry from the project `.mcp.json`, aliases included; re-add them in Step 6.5) |
| user-global | `claude mcp remove mcp-sql-server --scope user` |

The old project-private option also added `.mcp.json` to `.gitignore`. If the user now wants to commit the file (project scope), they can remove that line.

`${CLAUDE_PROJECT_DIR}` below is substituted by Claude Code when the skill loads. If it appears literally or empty, use the absolute path of the project root instead.

#### Option A: local (default) or user

```bash
claude mcp add-json --scope local mcp-sql-server "$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" print-entry "<python>" <host> <port> <user> env:DB_PASSWORD <name> "<driver>" <encrypt> <trust>)"
```

For **user** scope, replace `--scope local` with `--scope user`. If the command reports that `mcp-sql-server` already exists in that scope, run `claude mcp remove mcp-sql-server --scope <scope>` and retry. If you chose this scope and the user later wants aliases, Step 6.5 rebuilds the whole entry.

#### Option B: project

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" register-mcp-json "${CLAUDE_PROJECT_DIR}/.mcp.json" "<python>" <host> <port> <user> env:DB_PASSWORD <name> "<driver>" <encrypt> <trust>
```

If `.mcp.json` already exists, the script merges the `mcp-sql-server` entry into its `mcpServers` object: other servers and any existing aliases are preserved. Tell the user:
- The file holds no secret, so it is safe to commit; teammates set their own `DB_PASSWORD`.
- On the first launch Claude Code shows the server as `⏸ Pending approval` and asks to approve it. If they declined by mistake, `claude mcp reset-project-choices` asks again.
- The `command` is an absolute path to *their* venv; teammates with a different home folder need to run this skill themselves (or edit `command`).

### Step 6.5: Additional Databases (optional)

One server entry can serve several databases. Each extra database gets an **alias** with its own `DB_{ALIAS}_*` variables, and every tool takes a `database` argument to choose between them.

Ask: **"Do you want to connect additional databases? (yes/no)"**

If no, continue to Step 7. If yes, ask for each one:

1. "What alias should this database use? (e.g. analytics, archive)"
2. "Hostname or IP?"
3. "Username?"
4. "Database name?"
5. "Port? (default: 1433)"
6. "Enable encrypted connection? (default: no)"
7. "Trust server certificate? (default: no)"

**Validate before calling the script:**
- Alias: must match `[a-zA-Z][a-zA-Z0-9_]{0,63}` and must not be `default` — re-prompt if invalid
- Host, username, database name: must be non-empty
- Port: a number between 1 and 65535
- Re-prompt only the invalid field, not the whole set

The password reference is `env:DB_<ALIAS>_PASSWORD` with the alias uppercased (`analytics` → `env:DB_ANALYTICS_PASSWORD`). Tell the user to set `DB_<ALIAS>_PASSWORD` the same way as `DB_PASSWORD` in Step 5. An alias whose variable is empty is skipped at startup (`misconfigured`); one whose variable is unset gets the literal placeholder and fails to log in (`unreachable`). Either way the other databases keep working.

After each one, ask: "Add another database? (yes/no)" — repeat until the user declines.

#### Project scope

Run once per alias:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" add-database "${CLAUDE_PROJECT_DIR}/.mcp.json" <alias> <host> <port> <user> env:DB_<ALIAS>_PASSWORD <name> "<driver>" <encrypt> <trust>
```

The script writes `DB_{ALIAS}_*` into the existing entry and appends the alias to `DB_DATABASES`. Running it again with the same alias updates that database in place rather than duplicating it.

#### Local or user scope

Never edit `~/.claude.json` by hand. Build the full entry in a scratch file, then replace the registered entry. Use `<s>` = the scope from Step 6 and the same values as Step 6 for the default database.

1. Start a fresh scratch file with the default database:

```bash
rm -rf "$HOME/.claude/mcp-servers/mcp-sql-server/entry-tmp"
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" register-mcp-json "$HOME/.claude/mcp-servers/mcp-sql-server/entry-tmp/.mcp.json" "<python>" <host> <port> <user> env:DB_PASSWORD <name> "<driver>" <encrypt> <trust>
```

2. Add every alias the entry should have, including aliases registered in an earlier run (the rebuild replaces the whole entry, so ask the user which aliases already exist instead of reading the config):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" add-database "$HOME/.claude/mcp-servers/mcp-sql-server/entry-tmp/.mcp.json" <alias> <host> <port> <user> env:DB_<ALIAS>_PASSWORD <name> "<driver>" <encrypt> <trust>
```

3. Replace the registered entry and delete the scratch folder (it holds only placeholders):

```bash
claude mcp remove mcp-sql-server --scope <s>
claude mcp add-json --scope <s> mcp-sql-server "$(node -e "process.stdout.write(JSON.stringify(require(process.argv[1]).mcpServers['mcp-sql-server']))" "$HOME/.claude/mcp-servers/mcp-sql-server/entry-tmp/.mcp.json")"
rm -rf "$HOME/.claude/mcp-servers/mcp-sql-server/entry-tmp"
```

**Notes:**
- `add-database` needs the default entry first (Step 6 for project scope, step 1 above for local/user). It fails with a clear error if the entry is missing.
- Project scope: re-running Step 6 later updates only the default connection; aliases are preserved. Local/user scope: re-running Step 6 replaces the entry, so redo this section to restore aliases.

### Step 7: Verify Registration

`claude mcp get` prints the stored env, so always run it through this redactor, which replaces any `*_PASSWORD` value that is not exactly a `${NAME}` placeholder. Use it the same way whenever you print a server config:

```bash
claude mcp get mcp-sql-server | sed -E '/^[[:space:]]*[A-Z0-9_]*_PASSWORD[=:][[:space:]]*\$\{[A-Z0-9_]+\}[[:space:]]*$/!s/(_PASSWORD[^=:]*[=:][[:space:]]*).*/\1<LITERAL VALUE - remove this entry>/'
```

- If it lists the server and its `Environment` shows `DB_PASSWORD=${DB_PASSWORD}` (a placeholder, not a password): proceed to Step 8.
- If any line shows `<LITERAL VALUE - remove this entry>`, stop: an old entry with a literal password is still registered. Tell the user to remove that entry (see "Upgrading from an older setup" in Step 6) and re-run Step 6.
- Project scope: `⏸ Pending approval` is expected until the user approves the server on the next launch.
- If not found: re-run Step 6 and check its error output. A common cause is an existing `mcp-sql-server` entry in another scope; run `claude mcp remove mcp-sql-server --scope <scope>` for that scope, then retry Step 6.
- If `claude mcp list` prints `Missing environment variables: DB_PASSWORD`, the variable is not set in the environment that launched Claude Code; see Troubleshooting.

### Step 8: Report Success

Print a summary:

```
MCP SQL Server setup complete!

Server: mcp-sql-server
Database: <DB_NAME> on <DB_HOST>
Scope: project | local | user
Password: read from the DB_PASSWORD environment variable (not stored in any file)

Configured databases:
  - default    <DB_NAME> on <DB_HOST>
  - <alias>    <name> on <host>          (repeat per alias added in Step 6.5; password from DB_<ALIAS>_PASSWORD)

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
  - list_databases       List connections + check each is reachable

Tip: For specialized SQL Server agents, also install:
  claude plugin install sql-server-tools@claude-play
```

Then tell the user:
- **Set the password variable(s) if they have not yet** (Step 5), then **restart Claude Code from a new terminal or IDE window** so it inherits them. On Windows, a window opened before `setx` still lacks the variable.
- Project scope: approve the server when Claude Code asks on the next launch.
- If more than one database is configured, explain how to target one: name it in the
  request ("list tables in the analytics database"), which passes `database="analytics"`
  to the tool. Without a name, tools use `default`.
- `list_databases` shows every configured connection and whether each one is actually reachable (`ok`, `unreachable`, `misconfigured`, or `unknown`).

## Reconfiguration

This skill can be re-run to:
- Upgrade the mcp-sql-server package (re-runs install-venv, which force-reinstalls so a moved git HEAD is always picked up)
- Change connection settings (re-runs Step 5 + Step 6). To change only the password, the user updates `DB_PASSWORD` and restarts Claude Code; no config change is needed
- Switch between scopes (project, local, user)
- Add or update additional databases (re-runs Step 6.5)

**Switching scopes:** remove the entry from the old scope first with `claude mcp remove mcp-sql-server --scope <old-scope>` (`project`, `local` or `user`), then re-run setup and choose the new scope. When several scopes define the same server, local wins over project, and project wins over user, so a leftover entry can hide the new one.

## Troubleshooting

If setup fails:
- **Python not found**: Install Python 3.10+ from https://python.org
- **ODBC not found**: Follow the platform-specific instructions shown
- **pip install fails**: Check internet connectivity; try `pip install git+https://github.com/odeciojunior/mcp-sql-server.git` manually
- **MCP registration fails**: Run `claude mcp list` to check for conflicts, then `claude mcp remove mcp-sql-server --scope <scope>` and re-run setup
- **`claude mcp list` shows "Missing environment variables: DB_PASSWORD" and login fails**: the variable is not set in the environment that launched Claude Code, so the server received the literal `${DB_PASSWORD}`. The user sets it (Step 5) and restarts Claude Code from a new window. On Windows, `setx` affects only windows opened afterwards; an IDE may need a full restart. The same applies to `DB_<ALIAS>_PASSWORD`.
- **Project-scope server never starts**: it is waiting for approval (`⏸ Pending approval` in the Step 7 output; always run `claude mcp get` through the Step 7 redactor). Approve it on launch; `claude mcp reset-project-choices` brings the prompt back if it was declined.
- **"Unknown database 'x'"**: The alias is not in `DB_DATABASES`. Re-run Step 6.5 for it, then restart Claude Code.
- **A database is missing / unavailable**: Ask the server to list databases — the `status` field distinguishes two different problems, which need different fixes. Other databases, including `default`, keep working either way.
  - `status: "misconfigured"` — the alias's settings are invalid (e.g. empty host, user, password or name), so it was skipped and never tried. The error is value-free (e.g. `password: string_too_short`). For a password error, the user sets `DB_<ALIAS>_PASSWORD`; for the others, re-run Step 6.5 for that alias. Then restart Claude Code.
  - `status: "unreachable"` — the server was contacted but the database could not be opened. `error` carries the server's reason. Common causes are a password variable that is unset (the literal placeholder was sent) or wrong, a database that is OFFLINE, renamed or dropped, and a login without access to it. Apart from the password variable, nothing in the plugin config will fix this; it needs attention on the SQL Server itself.
  - `status: "unknown"` means no check was run, not that anything is wrong.
- **Every database reports `ok`, even one you know is down**: the installed package predates reachability checking — older versions set `status: "ok"` for any alias whose settings merely parsed, without contacting the server. Re-run this skill to upgrade the venv (install-venv), then restart Claude Code.
