# MCP SQL Server 3-Scope Registration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the `mcp-sql-server` plugin to support 3 registration scopes: project-gitignored (default), project-shared, and user-global — so credentials stay local to each project by default instead of leaking globally.

**Architecture:** The core change is in Step 6 of `SKILL.md` (registration) and a new `register-mcp-json` subcommand in `setup.sh`. The new default writes to `.mcp.json` + ensures `.gitignore` covers it. The `claude mcp add` CLI path remains for shared/user scopes. Steps 1-5 and 7-8 are unchanged except minor wording.

**Tech Stack:** Bash (setup.sh), Markdown (SKILL.md), JSON merge logic (node -e), Claude Code plugin system

**Constraint discovered:** `settings.local.json` does NOT support `mcpServers` — the schema rejects it as unrecognized. The only project-local MCP target is `.mcp.json`. To keep credentials out of git, `.mcp.json` must be added to `.gitignore`.

---

## Chunk 1: Shell script changes

### Task 1: Add `register-mcp-json` subcommand to setup.sh

**Files:**
- Modify: `plugins/mcp-sql-server/scripts/setup.sh:263-274` (dispatcher + new function)

This subcommand creates/merges an `mcp-sql-server` entry into a target `.mcp.json` file. It receives all config as arguments so the SKILL.md (Claude agent) can call it atomically.

- [ ] **Step 1: Write the `register_mcp_json` function**

Add before the dispatcher `case` block (before line 263):

```bash
register_mcp_json() {
    # Usage: register-mcp-json <mcp-json-path> <python-path> <DB_HOST> <DB_PORT> <DB_USER> <DB_PASSWORD> <DB_NAME> <DB_DRIVER> <DB_ENCRYPT> <DB_TRUST_CERT>
    local mcp_json_path="$1"
    local python_path="$2"
    local db_host="$3"
    local db_port="${4:-1433}"
    local db_user="$5"
    local db_password="$6"
    local db_name="$7"
    local db_driver="${8:-ODBC Driver 18 for SQL Server}"
    local db_encrypt="${9:-false}"
    local db_trust_cert="${10:-false}"

    if [[ -z "$mcp_json_path" || -z "$python_path" || -z "$db_host" || -z "$db_user" || -z "$db_name" ]]; then
        echo "ERROR: Missing required arguments."
        echo "Usage: setup.sh register-mcp-json <mcp-json-path> <python-path> <host> <port> <user> <password> <name> [driver] [encrypt] [trust_cert]"
        exit 1
    fi

    # Build the new MCP server entry as JSON
    local new_entry
    new_entry=$(node -e "
const entry = {
  command: process.argv[1],
  args: ['-m', 'mcp_sql_server.server'],
  env: {
    DB_HOST: process.argv[2],
    DB_PORT: process.argv[3],
    DB_USER: process.argv[4],
    DB_PASSWORD: process.argv[5],
    DB_NAME: process.argv[6],
    DB_DRIVER: process.argv[7],
    DB_ENCRYPT: process.argv[8],
    DB_TRUST_CERT: process.argv[9]
  }
};
process.stdout.write(JSON.stringify(entry));
" "$python_path" "$db_host" "$db_port" "$db_user" "$db_password" "$db_name" "$db_driver" "$db_encrypt" "$db_trust_cert")

    # Merge into existing .mcp.json or create new
    if [[ -f "$mcp_json_path" ]]; then
        local merged
        merged=$(node -e "
const fs = require('fs');
const existing = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const newEntry = JSON.parse(process.argv[2]);
if (!existing.mcpServers) existing.mcpServers = {};
existing.mcpServers['mcp-sql-server'] = newEntry;
process.stdout.write(JSON.stringify(existing, null, 2) + '\n');
" "$mcp_json_path" "$new_entry")
        printf '%s' "$merged" > "$mcp_json_path"
        echo "Updated $mcp_json_path (merged mcp-sql-server into existing servers)"
    else
        local full_json
        full_json=$(node -e "
const newEntry = JSON.parse(process.argv[1]);
const doc = { mcpServers: { 'mcp-sql-server': newEntry } };
process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
" "$new_entry")
        mkdir -p "$(dirname "$mcp_json_path")"
        printf '%s' "$full_json" > "$mcp_json_path"
        echo "Created $mcp_json_path with mcp-sql-server"
    fi

    exit 0
}
```

- [ ] **Step 2: Add `ensure-gitignore` subcommand**

Add after `register_mcp_json`:

```bash
ensure_gitignore() {
    # Usage: ensure-gitignore <project-dir> <pattern>
    # Ensures the given pattern exists in .gitignore (creates file if needed)
    local project_dir="$1"
    local pattern="$2"

    if [[ -z "$project_dir" || -z "$pattern" ]]; then
        echo "ERROR: Usage: setup.sh ensure-gitignore <project-dir> <pattern>"
        exit 1
    fi

    local gitignore="$project_dir/.gitignore"

    if [[ -f "$gitignore" ]]; then
        if grep -qxF "$pattern" "$gitignore"; then
            echo "$pattern already in $gitignore"
            exit 0
        fi
    fi

    # Append with a newline before if file doesn't end with one
    if [[ -f "$gitignore" ]] && [[ -s "$gitignore" ]] && [[ "$(tail -c1 "$gitignore")" != "" ]]; then
        printf '\n%s\n' "$pattern" >> "$gitignore"
    else
        printf '%s\n' "$pattern" >> "$gitignore"
    fi

    echo "Added $pattern to $gitignore"
    exit 0
}
```

- [ ] **Step 3: Update the dispatcher `case` block**

Replace the existing dispatcher:

```bash
# --- Main dispatcher ---
case "${1:-}" in
    check-python)       check_python ;;
    check-odbc)         check_odbc ;;
    install-venv)       install_venv ;;
    verify-install)     verify_install ;;
    detect-env)         detect_env "${2:-.}" ;;
    register-mcp-json)  shift; register_mcp_json "$@" ;;
    ensure-gitignore)   ensure_gitignore "$2" "$3" ;;
    *)
        echo "Usage: setup.sh {check-python|check-odbc|install-venv|verify-install|detect-env [path]|register-mcp-json <args...>|ensure-gitignore <dir> <pattern>}"
        exit 1
        ;;
esac
```

- [ ] **Step 4: Test `register-mcp-json` locally**

```bash
# Create a temp dir and test
tmpdir=$(mktemp -d)
bash plugins/mcp-sql-server/scripts/setup.sh register-mcp-json \
  "$tmpdir/.mcp.json" \
  "/usr/bin/python3" \
  "localhost" "1433" "sa" "MyP@ss" "testdb" \
  "ODBC Driver 18 for SQL Server" "false" "true"
cat "$tmpdir/.mcp.json"
rm -rf "$tmpdir"
```

Expected: Valid JSON with `mcpServers.mcp-sql-server` entry containing all env vars.

- [ ] **Step 5: Test merge into existing `.mcp.json`**

```bash
tmpdir=$(mktemp -d)
echo '{"mcpServers":{"docker":{"command":"docker-mcp","args":[]}}}' > "$tmpdir/.mcp.json"
bash plugins/mcp-sql-server/scripts/setup.sh register-mcp-json \
  "$tmpdir/.mcp.json" \
  "/usr/bin/python3" \
  "localhost" "1433" "sa" "MyP@ss" "testdb" \
  "ODBC Driver 18 for SQL Server" "false" "true"
cat "$tmpdir/.mcp.json"
rm -rf "$tmpdir"
```

Expected: JSON contains both `docker` and `mcp-sql-server` under `mcpServers`.

- [ ] **Step 6: Test `ensure-gitignore`**

```bash
tmpdir=$(mktemp -d)
bash plugins/mcp-sql-server/scripts/setup.sh ensure-gitignore "$tmpdir" ".mcp.json"
cat "$tmpdir/.gitignore"
# Run again — should be idempotent
bash plugins/mcp-sql-server/scripts/setup.sh ensure-gitignore "$tmpdir" ".mcp.json"
wc -l "$tmpdir/.gitignore"
rm -rf "$tmpdir"
```

Expected: `.mcp.json` appears exactly once in `.gitignore`.

- [ ] **Step 7: Commit**

```bash
git add plugins/mcp-sql-server/scripts/setup.sh
git commit -m "feat(mcp-sql-server): add register-mcp-json and ensure-gitignore subcommands"
```

---

## Chunk 2: Skill rewrite (Step 6 — registration)

### Task 2: Rewrite SKILL.md Step 6 with 3-scope model

**Files:**
- Modify: `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md:110-169` (Step 6)

The new Step 6 replaces the old 2-option (project/user) model with a 3-scope model.

- [ ] **Step 1: Replace Step 6 content**

Replace the entire `### Step 6: Register MCP Server` section (lines 110-169) with:

```markdown
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

**Fallback if `claude mcp add --scope user` fails:** Tell the user to export the password as a shell variable first (e.g. `export DB_PASSWORD='...'`) and pass `-e DB_PASSWORD=$DB_PASSWORD`, then re-run. If it still fails, fall back to Option A (project-private) and inform the user.
```

- [ ] **Step 2: Update Step 8 (success report) to show scope name**

In the success report section, change the `Scope` line to reflect the 3-scope model:

```
Scope: project-private | project-shared | user-global
```

- [ ] **Step 3: Update the "Reconfiguration" section**

Replace:
```markdown
## Reconfiguration

This skill can be re-run to:
- Upgrade the mcp-sql-server package (re-runs install-venv)
- Change database credentials (re-runs credential collection + MCP registration)
- Switch between project and user scope
```

With:
```markdown
## Reconfiguration

This skill can be re-run to:
- Upgrade the mcp-sql-server package (re-runs install-venv)
- Change database credentials (re-runs credential collection + MCP registration)
- Switch between scopes (project-private, project-shared, user-global)

**Switching scopes:** If changing from user-global to project-private, run `claude mcp remove mcp-sql-server --scope user` first to remove the global entry, then re-run setup and choose project-private.
```

- [ ] **Step 4: Update the "What This Does" header**

Change item 5 from:
```markdown
5. Registers the MCP server with Claude Code
```
To:
```markdown
5. Registers the MCP server with Claude Code (3 scope options: project-private, project-shared, user-global)
```

- [ ] **Step 5: Verify the full SKILL.md reads coherently**

Read the entire file top-to-bottom and confirm:
- Steps 1-5 are unchanged (except "What This Does" header)
- Step 6 has the 3-scope table and Option A/B/C
- Step 7 (verify registration) still works for all 3 options
- Step 8 reflects the 3-scope model
- No orphaned references to the old 2-scope model

- [ ] **Step 6: Commit**

```bash
git add plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
git commit -m "feat(mcp-sql-server): 3-scope registration model (project-private default)"
```

---

## Chunk 3: Documentation and version bump

### Task 3: Update README.md

**Files:**
- Modify: `plugins/mcp-sql-server/README.md`

- [ ] **Step 1: Add scope section after "Setup"**

After the existing "## Setup" section, add:

```markdown
## Registration Scopes

The setup wizard offers 3 registration scopes:

| Scope | Credentials Location | Git-tracked? | Use when |
|-------|---------------------|:---:|----------|
| **project-private** (default) | `.mcp.json` | No | Each project has its own database |
| **project-shared** | `.mcp.json` | Yes | Team shares the same dev database |
| **user-global** | `~/.claude.json` | No | One database across all projects |

**project-private** is recommended. It writes to `.mcp.json` and adds it to `.gitignore` so credentials never leak to git. Each project gets its own isolated database configuration.
```

- [ ] **Step 2: Commit**

```bash
git add plugins/mcp-sql-server/README.md
git commit -m "docs(mcp-sql-server): document 3-scope registration model"
```

---

### Task 4: Bump plugin version

**Files:**
- Modify: `plugins/mcp-sql-server/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Bump plugin.json version**

Change `"version": "1.0.2"` to `"version": "1.1.0"` in `plugins/mcp-sql-server/.claude-plugin/plugin.json`.

This is a minor version bump because we're adding new functionality (3-scope model, new setup.sh subcommands) without breaking existing behavior.

- [ ] **Step 2: Bump marketplace.json version**

In `.claude-plugin/marketplace.json`, find the `mcp-sql-server` entry and update its `"version"` field to `"1.1.0"`.

- [ ] **Step 3: Commit**

```bash
git add plugins/mcp-sql-server/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore(mcp-sql-server): bump version to 1.1.0 for 3-scope registration"
```

---

### Task 5: Update repo CLAUDE.md design docs list

**Files:**
- Modify: `CLAUDE.md` (repo root)

- [ ] **Step 1: Add plan reference**

In the "## Design Docs" section, add:

```markdown
- `2026-03-11-mcp-sql-server-3scope-plan.md` — 3-scope registration model (project-private, project-shared, user-global)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add 3-scope registration plan reference"
```

---

### Task 6: Validate all changes

**Files:**
- Read: All modified files for structural validation

- [ ] **Step 1: Verify setup.sh has the new subcommands**

```bash
bash plugins/mcp-sql-server/scripts/setup.sh register-mcp-json 2>&1 | head -1
bash plugins/mcp-sql-server/scripts/setup.sh ensure-gitignore 2>&1 | head -1
```

Expected: Both print "ERROR:" usage messages (missing args), exit 1.

- [ ] **Step 2: Verify SKILL.md references match setup.sh subcommands**

```bash
grep -c 'register-mcp-json' plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
grep -c 'ensure-gitignore' plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
```

Expected: At least 1 occurrence each.

- [ ] **Step 3: Verify no leftover references to old 2-scope model**

```bash
grep -n '"Register for this project only, or for all projects?"' plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
```

Expected: No matches (old prompt removed).

- [ ] **Step 4: Verify plugin.json and marketplace.json have version 1.1.0**

```bash
grep '"version"' plugins/mcp-sql-server/.claude-plugin/plugin.json
grep -A1 '"mcp-sql-server"' .claude-plugin/marketplace.json | grep version
```

Expected: Both show `"1.1.0"`.

- [ ] **Step 5: Verify JSON validity**

```bash
python3 -c "import json; json.load(open('plugins/mcp-sql-server/.claude-plugin/plugin.json'))"
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))"
```

Expected: No errors.

- [ ] **Step 6: Run full end-to-end test of register-mcp-json**

```bash
tmpdir=$(mktemp -d)
# Test 1: Create new .mcp.json
bash plugins/mcp-sql-server/scripts/setup.sh register-mcp-json \
  "$tmpdir/.mcp.json" "/usr/bin/python3" \
  "myserver.com" "1433" "admin" "s3cret" "mydb" \
  "ODBC Driver 18 for SQL Server" "false" "true"
python3 -c "
import json
d = json.load(open('$tmpdir/.mcp.json'))
assert 'mcp-sql-server' in d['mcpServers']
assert d['mcpServers']['mcp-sql-server']['env']['DB_HOST'] == 'myserver.com'
assert d['mcpServers']['mcp-sql-server']['env']['DB_PASSWORD'] == 's3cret'
print('Test 1 PASSED: new .mcp.json created correctly')
"

# Test 2: Merge into existing
echo '{"mcpServers":{"docker":{"command":"wsl","args":["docker-mcp"]}}}' > "$tmpdir/.mcp.json"
bash plugins/mcp-sql-server/scripts/setup.sh register-mcp-json \
  "$tmpdir/.mcp.json" "/usr/bin/python3" \
  "myserver.com" "1433" "admin" "s3cret" "mydb" \
  "ODBC Driver 18 for SQL Server" "false" "true"
python3 -c "
import json
d = json.load(open('$tmpdir/.mcp.json'))
assert 'docker' in d['mcpServers'], 'docker entry should be preserved'
assert 'mcp-sql-server' in d['mcpServers'], 'mcp-sql-server should be added'
print('Test 2 PASSED: merge preserves existing servers')
"

# Test 3: ensure-gitignore idempotency
bash plugins/mcp-sql-server/scripts/setup.sh ensure-gitignore "$tmpdir" ".mcp.json"
bash plugins/mcp-sql-server/scripts/setup.sh ensure-gitignore "$tmpdir" ".mcp.json"
count=$(grep -cxF ".mcp.json" "$tmpdir/.gitignore")
python3 -c "assert $count == 1, f'Expected 1 occurrence, got $count'; print('Test 3 PASSED: gitignore is idempotent')"

rm -rf "$tmpdir"
```

Expected: All 3 tests PASSED.

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A plugins/mcp-sql-server/
git commit -m "fix(mcp-sql-server): address validation findings from 3-scope implementation"
```

(Only if Step 6 revealed issues that needed fixing.)
