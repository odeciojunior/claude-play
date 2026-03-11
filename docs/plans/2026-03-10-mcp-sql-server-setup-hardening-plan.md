# MCP SQL Server Setup Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix cross-platform bugs in `setup.sh` and add error recovery paths to `SKILL.md` so users get a flawless install experience on both Windows and Linux.

**Architecture:** Two-file change — harden the bash script for known edge cases, then add explicit failure branches to each SKILL.md step so Claude always knows what to do when something goes wrong.

**Tech Stack:** Bash, Markdown

**Spec:** `docs/plans/2026-03-10-mcp-sql-server-setup-hardening-design.md`

---

## Chunk 1: setup.sh Fixes

### Task 1: ODBC Linux — package manager fallback

**Files:**
- Modify: `plugins/mcp-sql-server/scripts/setup.sh`

- [ ] **Step 1: Locate the insertion point**

  In `check_odbc()`, find the block that ends the Linux path (just before `# Not found — print platform-specific instructions`). It currently ends with the `odbcinst -q -d` check (lines ~107–113).

- [ ] **Step 2: Insert dpkg/rpm fallback**

  After the `odbcinst` block and before the `# Not found` comment, add:

  ```bash
  # Fallback: check via package manager (driver installed but odbcinst unavailable)
  if command -v dpkg &>/dev/null; then
      for ver in 18 17; do
          if dpkg -l "msodbcsql${ver}" 2>/dev/null | grep -q "^ii"; then
              echo "ODBC Driver $ver for SQL Server"
              exit 0
          fi
      done
  fi
  if command -v rpm &>/dev/null; then
      for ver in 18 17; do
          if rpm -qa "msodbcsql${ver}" 2>/dev/null | grep -q .; then
              echo "ODBC Driver $ver for SQL Server"
              exit 0
          fi
      done
  fi
  ```

- [ ] **Step 3: Verify the change looks correct**

  Read the file around lines 95–135 and confirm the new block sits between the `odbcinst` check and the `# Not found` comment. No syntax errors.

- [ ] **Step 4: Smoke-test the subcommand on Linux**

  ```bash
  bash plugins/mcp-sql-server/scripts/setup.sh check-odbc
  ```

  Expected: Either a driver name (e.g. `ODBC Driver 18 for SQL Server`) with exit 0, or the install instructions with exit 1. No crash.

- [ ] **Step 5: Commit**

  ```bash
  git add plugins/mcp-sql-server/scripts/setup.sh
  git commit -m "fix(mcp-sql-server): add dpkg/rpm fallback to ODBC Linux detection"
  ```

---

### Task 2: install_venv — Windows pip path

**Files:**
- Modify: `plugins/mcp-sql-server/scripts/setup.sh`

- [ ] **Step 1: Locate the venv_bin resolution in install_venv()**

  Find the block (lines ~148–165):
  ```bash
  local venv_bin="$VENV_DIR/bin"
  case "$(uname -s)" in
      MINGW*|MSYS*|CYGWIN*) venv_bin="$VENV_DIR/Scripts" ;;
  esac
  ```

- [ ] **Step 2: Add pip path resolution after mkdir**

  After `mkdir -p "$(dirname "$VENV_DIR")"` and before the venv creation `if` block, add:

  ```bash
  # Resolve pip command — Windows venvs create pip.exe, not pip
  local pip_cmd="$venv_bin/pip"
  # Note: pip_cmd is re-resolved after venv creation below
  ```

  Then replace the two pip invocations:
  ```bash
  "$venv_bin/pip" install --upgrade pip --quiet
  "$venv_bin/pip" install "git+${REPO_URL}" --quiet
  ```
  with:
  ```bash
  # Re-resolve pip after venv creation (Scripts/pip.exe on Windows)
  pip_cmd="$venv_bin/pip"
  [[ -f "$venv_bin/pip.exe" ]] && pip_cmd="$venv_bin/pip.exe"
  "$pip_cmd" install --upgrade pip --quiet
  "$pip_cmd" install "git+${REPO_URL}" --quiet
  ```

- [ ] **Step 3: Verify the change looks correct**

  Read the `install_venv()` function and confirm pip is resolved with the `.exe` fallback before both calls. No duplicate variable declarations.

- [ ] **Step 4: Smoke-test on Linux**

  ```bash
  bash plugins/mcp-sql-server/scripts/setup.sh install-venv 2>&1 | tail -5
  ```

  Expected: `Installed mcp-sql-server to ~/.claude/mcp-servers/mcp-sql-server/.venv` with exit 0 (or upgrade message if already installed).

- [ ] **Step 5: Commit**

  ```bash
  git add plugins/mcp-sql-server/scripts/setup.sh
  git commit -m "fix(mcp-sql-server): resolve pip.exe path in install_venv on Windows"
  ```

---

### Task 3: verify_install — handle missing `__version__`

**Files:**
- Modify: `plugins/mcp-sql-server/scripts/setup.sh`

- [ ] **Step 1: Locate the version extraction line in verify_install()**

  Find:
  ```bash
  version=$("$python_bin" -c "import mcp_sql_server; print(mcp_sql_server.__version__)" 2>&1) || {
  ```

- [ ] **Step 2: Replace with getattr fallback**

  ```bash
  version=$("$python_bin" -c "import mcp_sql_server; print(getattr(mcp_sql_server, '__version__', 'unknown'))" 2>&1) || {
  ```

- [ ] **Step 3: Verify the change looks correct**

  Read `verify_install()` and confirm the one-line change is in place.

- [ ] **Step 4: Smoke-test**

  ```bash
  bash plugins/mcp-sql-server/scripts/setup.sh verify-install
  ```

  Expected: `mcp-sql-server vX.Y.Z verified` or `mcp-sql-server vunknown verified` (not an AttributeError). If venv doesn't exist, expected: `ERROR: Virtual environment not found` with exit 1.

- [ ] **Step 5: Commit**

  ```bash
  git add plugins/mcp-sql-server/scripts/setup.sh
  git commit -m "fix(mcp-sql-server): guard against missing __version__ in verify_install"
  ```

---

### Task 4: detect_env — bump search depth to 5

**Files:**
- Modify: `plugins/mcp-sql-server/scripts/setup.sh`

- [ ] **Step 1: Locate the depth loop in detect_env()**

  Find:
  ```bash
  for _ in 1 2 3; do
  ```

- [ ] **Step 2: Replace with 5-level search**

  ```bash
  for _ in 1 2 3 4 5; do
  ```

- [ ] **Step 3: Smoke-test**

  ```bash
  bash plugins/mcp-sql-server/scripts/setup.sh detect-env .
  ```

  Expected: Either `Found: /path/to/.env` with masked values, or `No .env file found` — no crash.

- [ ] **Step 4: Commit**

  ```bash
  git add plugins/mcp-sql-server/scripts/setup.sh
  git commit -m "fix(mcp-sql-server): bump detect-env search depth from 3 to 5 levels"
  ```

---

## Chunk 2: SKILL.md Error Recovery

### Task 5: Steps 1 & 2 — Python and ODBC recovery

**Files:**
- Modify: `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md`

- [ ] **Step 1: Replace the Step 1 failure branch**

  Current:
  ```markdown
  - If exit code 1: Show the error message and STOP — user must install Python 3.10+
  ```

  Replace with:
  ```markdown
  - If exit code 1: Show the error message, then provide the install URL for their platform:
    - **Windows:** https://www.python.org/downloads/ — check "Add Python to PATH" during install
    - **Linux:** `sudo apt-get install python3 python3-venv` (Ubuntu/Debian) or `sudo dnf install python3` (RHEL/Fedora)
    - Tell the user: "Install Python 3.10 or later, then re-run this skill."
    - STOP — do not continue until Python is installed.
  ```

- [ ] **Step 2: Replace the Step 2 failure branch**

  Current:
  ```markdown
  - If exit code 1: Show the platform-specific install instructions from the script output and STOP — user must install the ODBC driver first
  ```

  Replace with:
  ```markdown
  - If exit code 1: Show the install instructions from the script output, then STOP.
  - **Manual override:** If the user says the driver IS installed but detection failed, ask them to confirm the driver name:
    - **Windows:** Open "ODBC Data Sources (64-bit)" (`odbcad32.exe`) → Drivers tab
    - **Linux:** Run `odbcinst -q -d` or `dpkg -l | grep msodbcsql`
    - Once the user confirms the driver name (e.g. "ODBC Driver 18 for SQL Server"), accept it and continue to Step 3.
  ```

- [ ] **Step 3: Read the modified section and verify it looks correct**

  Read `SKILL.md` lines 22–41 and confirm the two failure branches are updated cleanly.

- [ ] **Step 4: Commit**

  ```bash
  git add plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
  git commit -m "fix(mcp-sql-server): add install guidance and manual override to Steps 1-2"
  ```

---

### Task 6: Steps 3 & 4 — install and verify recovery

**Files:**
- Modify: `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md`

- [ ] **Step 1: Replace the Step 3 failure branch**

  Current:
  ```markdown
  - If exit code 1: Show error and STOP
  ```

  Replace with:
  ```markdown
  - If exit code 1: Diagnose from the error message:
    - **"git: command not found"** → Ask user to install git (`apt-get install git` / winget install git) and retry.
    - **pip / network error** → Retry once. If it fails again, show the manual install command:
      `~/.claude/mcp-servers/mcp-sql-server/.venv/bin/pip install git+https://github.com/odeciojunior/mcp-sql-server.git`
    - **venv exists but broken** → Delete and recreate: `rm -rf ~/.claude/mcp-servers/mcp-sql-server/.venv` then re-run install-venv.
    - Any other error: Show the full error output and STOP.
  ```

- [ ] **Step 2: Replace the Step 4 failure branch**

  Current:
  ```markdown
  - If exit code 1: Show error — installation may be corrupted, suggest re-running setup
  ```

  Replace with:
  ```markdown
  - If exit code 1: Re-run Step 3 automatically (one retry). If Step 4 fails again:
    - Show the installed packages for diagnosis:
      `~/.claude/mcp-servers/mcp-sql-server/.venv/bin/pip list`
    - STOP and ask the user to share the output.
  ```

- [ ] **Step 3: Verify the changes look correct**

  Read `SKILL.md` lines 43–58 and confirm both failure branches are updated.

- [ ] **Step 4: Commit**

  ```bash
  git add plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
  git commit -m "fix(mcp-sql-server): add error-type recovery paths to Steps 3-4"
  ```

---

### Task 7: Step 5 — credential validation

**Files:**
- Modify: `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md`

- [ ] **Step 1: Add validation rules after the credential prompts**

  In Step 5, after the list of prompts (DB_HOST through DB_TRUST_CERT), add a new subsection:

  ```markdown
  **Validate before continuing:**
  - DB_HOST, DB_USER, DB_DATABASE: must be non-empty — re-prompt any that are blank
  - DB_PORT: must be a number between 1 and 65535 (default: 1433) — re-prompt if invalid
  - DB_ENCRYPT, DB_TRUST_CERT: accept `yes`, `no`, `true`, `false` (case-insensitive) — re-prompt if unrecognized
  - Re-prompt only the invalid field, not the entire credential set
  ```

- [ ] **Step 2: Verify the change looks correct**

  Read `SKILL.md` lines 60–90 and confirm the validation block is in place after the prompts.

- [ ] **Step 3: Commit**

  ```bash
  git add plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
  git commit -m "fix(mcp-sql-server): add per-field credential validation to Step 5"
  ```

---

### Task 8: Step 6 — MCP registration auto-fallback

**Files:**
- Modify: `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md`

- [ ] **Step 1: Replace the special-characters warning and registration logic**

  Current text (the warning paragraph before the command):
  ```markdown
  **Password special characters warning:** If the password contains `%`, `!`, `^`, `&`, `(`, `)`, `` ` ``, `'`, `"`, `<`, `>`, or spaces, `claude mcp add` may fail due to shell expansion (especially on Windows/Git Bash). In that case, skip this step and use the `.mcp.json` direct-edit fallback below.
  ```

  Replace with:
  ```markdown
  **Always attempt `claude mcp add` first.** If it exits non-zero (for any reason — shell expansion, conflicts, permissions), automatically fall through to the `.mcp.json` direct-edit fallback below. Do not preemptively skip based on password content.
  ```

- [ ] **Step 2: Clarify the fallback trigger in context**

  Find the fallback section header:
  ```markdown
  **Fallback (passwords with special characters):** Edit `.mcp.json` directly instead:
  ```

  Replace with:
  ```markdown
  **Fallback (if `claude mcp add` fails for any reason):** Edit `.mcp.json` directly instead:
  ```

- [ ] **Step 3: Update the dangling reference in the scope-selection paragraph**

  In the scope-selection paragraph (near line 141), find:
  ```markdown
  if the password has special chars (see warning above) and `claude mcp add` fails, ask the user to export the password as a shell variable first
  ```

  Replace with:
  ```markdown
  if `claude mcp add` fails, ask the user to export the password as a shell variable first
  ```

  (Remove only the parenthetical `(see warning above)` — the surrounding guidance remains intact.)

- [ ] **Step 4: Verify the changes look correct**

  Read `SKILL.md` lines 85–145 and confirm: (a) the warning is replaced with "always attempt first", (b) the fallback header now says "for any reason", (c) the dangling "(see warning above)" reference is gone.

- [ ] **Step 5: Commit**

  ```bash
  git add plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
  git commit -m "fix(mcp-sql-server): auto-fallback to .mcp.json when claude mcp add fails"
  ```

---

### Task 9: Step 7 — registration verification recovery

**Files:**
- Modify: `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md`

- [ ] **Step 1: Replace the Step 7 content**

  Current:
  ```markdown
  ### Step 7: Verify Registration

  ```bash
  claude mcp list
  ```

  Confirm `mcp-sql-server` appears in the output.
  ```

  Replace with:
  ```markdown
  ### Step 7: Verify Registration

  ```bash
  claude mcp list
  ```

  - If `mcp-sql-server` appears: proceed to Step 8.
  - If not found and the user registered with `--scope user`: run `claude mcp list --scope user` — user-scoped servers may not appear in the default list.
  - If still not found: re-run Step 6 (the registration command). Check for error output — a common cause is a naming conflict with an existing `mcp-sql-server` entry. If so, run `claude mcp remove mcp-sql-server` first, then retry Step 6.
  ```

- [ ] **Step 2: Verify the change looks correct**

  Read `SKILL.md` lines 143–165 and confirm the three-branch recovery path is in place and the Step 8 heading follows cleanly.

- [ ] **Step 3: Commit**

  ```bash
  git add plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md
  git commit -m "fix(mcp-sql-server): add scope-mismatch and conflict recovery to Step 7"
  ```

---

### Task 10: Bump version to 1.0.2

**Files:**
- Modify: `plugins/mcp-sql-server/.claude-plugin/plugin.json`

- [ ] **Step 1: Update version**

  Change `"version": "1.0.1"` to `"version": "1.0.2"`.

- [ ] **Step 2: Update marketplace catalog**

  In `.claude-plugin/marketplace.json`, find the `mcp-sql-server` entry and update its version to `1.0.2`.

- [ ] **Step 3: Verify both files**

  Read `plugins/mcp-sql-server/.claude-plugin/plugin.json` and confirm `"version": "1.0.2"`.
  Read `.claude-plugin/marketplace.json` and confirm the mcp-sql-server entry shows `"version": "1.0.2"`.

- [ ] **Step 4: Commit**

  ```bash
  git add plugins/mcp-sql-server/.claude-plugin/plugin.json .claude-plugin/marketplace.json
  git commit -m "chore(mcp-sql-server): bump to 1.0.2"
  ```
