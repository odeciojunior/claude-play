#!/bin/bash
# Hook: PostToolUse — Validate marketplace.json after edits
# Reads tool input from stdin as JSON, validates the marketplace.json file on disk

INPUT=$(cat)

# Extract file path from tool_input (works for both Edit and Write)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only activate for marketplace.json
if [[ "$FILE_PATH" != *"marketplace.json" ]]; then
  exit 0
fi

# Resolve to the actual file on disk
MARKETPLACE_FILE="$CLAUDE_PROJECT_DIR/.claude-plugin/marketplace.json"
if [[ ! -f "$MARKETPLACE_FILE" ]]; then
  MARKETPLACE_FILE=".claude-plugin/marketplace.json"
fi

if [[ ! -f "$MARKETPLACE_FILE" ]]; then
  echo '{"decision":"block","reason":"marketplace.json file not found on disk after edit"}'
  exit 0
fi

# Check 1: Valid JSON
if ! jq empty "$MARKETPLACE_FILE" 2>/dev/null; then
  echo '{"decision":"block","reason":"marketplace.json is not valid JSON. Please fix the syntax error."}'
  exit 0
fi

# Check 2: Top-level required fields
MISSING=$(jq -r '
  ["name","description","owner","plugins"] as $required |
  [.] | map(keys) | flatten |
  $required - . | join(", ")
' "$MARKETPLACE_FILE")

if [[ -n "$MISSING" ]]; then
  echo "{\"decision\":\"block\",\"reason\":\"marketplace.json missing top-level fields: $MISSING\"}"
  exit 0
fi

# Check 3: Owner has name and email
OWNER_OK=$(jq -r '
  if (.owner | has("name") and has("email")) then "ok" else "fail" end
' "$MARKETPLACE_FILE")

if [[ "$OWNER_OK" != "ok" ]]; then
  echo '{"decision":"block","reason":"marketplace.json owner must have both name and email fields"}'
  exit 0
fi

# Check 4: Plugins is a non-empty array
PLUGINS_OK=$(jq -r '
  if (.plugins | type == "array" and length > 0) then "ok" else "fail" end
' "$MARKETPLACE_FILE")

if [[ "$PLUGINS_OK" != "ok" ]]; then
  echo '{"decision":"block","reason":"marketplace.json plugins must be a non-empty array"}'
  exit 0
fi

# Check 5: Each plugin has required fields
PLUGIN_ERRORS=$(jq -r '
  ["name","source","description","version","author","license","keywords","category"] as $req |
  [.plugins[] | . as $p |
    ($req - ($p | keys)) as $missing |
    if ($missing | length) > 0 then
      "\($p.name // "unknown"): missing \($missing | join(", "))"
    else empty end
  ] | join("; ")
' "$MARKETPLACE_FILE")

if [[ -n "$PLUGIN_ERRORS" ]]; then
  echo "{\"decision\":\"block\",\"reason\":\"Plugin entry errors: $PLUGIN_ERRORS\"}"
  exit 0
fi

# Check 6: Each plugin source starts with ./plugins/
SOURCE_ERRORS=$(jq -r '
  [.plugins[] |
    if (.source | startswith("./plugins/") | not) then
      "\(.name): source must start with ./plugins/ (got \(.source))"
    else empty end
  ] | join("; ")
' "$MARKETPLACE_FILE")

if [[ -n "$SOURCE_ERRORS" ]]; then
  echo "{\"decision\":\"block\",\"reason\":\"Plugin source path errors: $SOURCE_ERRORS\"}"
  exit 0
fi

# All checks passed
exit 0
