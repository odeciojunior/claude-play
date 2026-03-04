#!/bin/bash
# Hook: PreToolUse — Block edits to plugins/_template/
# Reads tool input from stdin as JSON, checks if file_path targets _template/

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" == *"plugins/_template/"* ]]; then
  echo "BLOCKED: Do not modify plugins/_template/ directly. Copy it to a new plugin directory instead (see CONTRIBUTING.md)." >&2
  exit 2
fi

exit 0
