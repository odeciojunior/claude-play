# MCP SQL Server Setup Hardening — Design

**Date:** 2026-03-10
**Status:** Approved

## Goal

Deliver a flawless setup experience for developers installing the `mcp-sql-server` plugin from the Claude Code marketplace on both Windows (Git Bash) and Linux.

## Scope

Option B — bug fixes in `setup.sh` + error recovery paths added to `SKILL.md`. No architectural changes, no new languages, no new files.

---

## Section 1: Script Hardening (`setup.sh`)

### `check_odbc` — Linux

**Problem:** On fresh Ubuntu/Debian installs, `odbcinst` is often not installed alongside `msodbcsql18`, so the driver is installed but undetectable.

**Fix:** After the `odbcinst -q -d` fallback, add a package-manager probe:
- `dpkg -l msodbcsql18` / `msodbcsql17` (Debian/Ubuntu)
- `rpm -qa msodbcsql18` / `msodbcsql17` (RHEL/Fedora)

### `install_venv` — Windows pip path

**Problem:** On Windows, venv creates `Scripts/pip.exe` (with `.exe` extension), but the script calls `$venv_bin/pip` (no extension), causing "command not found".

**Fix:** After resolving `venv_bin`, resolve the pip command the same way `verify_install` resolves python: check for both `pip` and `pip.exe`.

### `verify_install` — missing `__version__`

**Problem:** If the installed package doesn't expose `__version__`, the command fails with an AttributeError rather than a useful message.

**Fix:** Use `getattr(mcp_sql_server, '__version__', 'unknown')` so import success is reported even without a version attribute.

### `detect_env` — monorepo depth

**Problem:** Searching only 3 parent levels misses `.env` in deeper monorepos.

**Fix:** Bump to 5 parent levels.

---

## Section 2: Skill Error Recovery (`SKILL.md`)

Each step currently says "STOP" on failure with no recovery guidance. Each step gets an explicit failure branch.

**Step 1 (Python):** On failure, show the install URL for the detected platform and instruct the user to re-run the skill after installing.

**Step 2 (ODBC):** On failure, show the install command for the detected platform (not just "see script output"). Add a manual override escape hatch: if the user confirms the driver is installed but detection fails, accept the driver name manually and continue.

**Step 3 (install-venv):** Distinguish error types — git not found (install git), pip/network error (retry once, then show manual command), venv already exists but broken (offer `--force` reinstall).

**Step 4 (verify):** On failure, retry Step 3 once automatically. If still failing, show `pip list` output for diagnosis before stopping.

**Step 5 (credentials):** Validate inputs: host/user/database non-empty, port numeric (default 1433), encrypt/trust_cert accept yes/no/true/false. Re-prompt individual bad fields rather than restarting from the top.

**Step 6 (MCP registration):** Always attempt `claude mcp add` first. On non-zero exit, automatically fall through to the `.mcp.json` direct-edit path — don't preemptively skip based on password content inspection.

**Step 7 (verify registration):** If `mcp-sql-server` not in output, check for scope mismatch (user-scoped servers require `--scope user` to list). If still not found, re-run Step 6.

---

## Files Changed

| File | Type |
|------|------|
| `plugins/mcp-sql-server/scripts/setup.sh` | Modify |
| `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md` | Modify |
