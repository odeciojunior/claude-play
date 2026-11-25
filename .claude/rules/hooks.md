---
paths:
  - ".claude/hooks/**"
  - ".claude/settings.json"
  - ".claude-plugin/marketplace.json"
  - "plugins/_template/**"
---

# Repo Hooks

Wired in `.claude/settings.json`; Node >= 18:

- `protect-template.mjs` (PreToolUse, `Edit|MultiEdit|Write|NotebookEdit`): exit 2 blocks `plugins/_template/` edits (normalizes `\`, case, `..`); shell commands unguarded.
- `validate-marketplace-json.mjs` (PostToolUse, same matcher): runs 9 checks on `marketplace.json` (incl. `plugin.json` sync, no entry `version`); prints `{"decision":"block","reason":...}` on fail/error (no output = pass). Test: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | node .claude/hooks/validate-marketplace-json.mjs`.
