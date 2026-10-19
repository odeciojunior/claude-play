---
paths:
  - "plugins/mcp-sql-server/**"
---

# mcp-sql-server

- `scripts/setup.sh install-venv` installs into `~/.claude/mcp-servers/mcp-sql-server/.venv` (non-editable, from git HEAD), never a local checkout: users run the published code, not a working tree.
- `setup.sh` must stay LF (`.gitattributes` enforces it); a CRLF copy fails in bash with `$'\r': command not found`.
