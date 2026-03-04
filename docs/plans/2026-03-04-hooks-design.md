# Claude Code Hooks for claude-play — Design

**Date**: 2026-03-04
**Status**: Approved

## Overview

Add two Claude Code hooks to protect marketplace integrity: validate marketplace.json after edits and block modifications to the `_template/` directory.

## Architecture

External shell scripts in `.claude/hooks/` referenced from `.claude/settings.json`. Scripts read tool input from stdin as JSON, use `jq` to extract relevant fields, and exit with appropriate codes.

## Hook 1: Validate marketplace.json (PostToolUse)

**Script**: `.claude/hooks/validate-marketplace-json.sh`
**Trigger**: PostToolUse on Edit or Write targeting `marketplace.json`

### Validation checks:
1. Valid JSON (parseable by `jq`)
2. Top-level required fields: `$schema`, `name`, `description`, `owner`, `plugins`
3. `owner` has `name` and `email`
4. `plugins` is a non-empty array
5. Each plugin entry has: `name`, `source`, `description`, `version`, `author`, `license`, `keywords`, `category`
6. Each plugin's `source` starts with `./plugins/`

### Behavior:
- Reads stdin JSON, extracts `file_path` from `tool_input`
- Only activates if path ends with `marketplace.json`
- Reads the file from disk and validates
- On failure: outputs JSON with `"decision": "block"` and descriptive reason
- On success: exits 0 silently

## Hook 2: Protect _template/ (PreToolUse)

**Script**: `.claude/hooks/protect-template.sh`
**Trigger**: PreToolUse on Edit or Write targeting `plugins/_template/`

### Behavior:
- Reads stdin JSON, extracts `file_path` from `tool_input`
- If path contains `plugins/_template/`: exit 2 with message
- Otherwise: exit 0 (allow)

## Configuration

`.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-template.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/validate-marketplace-json.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

## File Structure

```
.claude/
  settings.json
  hooks/
    validate-marketplace-json.sh   (executable)
    protect-template.sh            (executable)
```
