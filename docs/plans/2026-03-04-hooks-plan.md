# Claude Code Hooks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two Claude Code hooks to protect marketplace integrity — validate marketplace.json after edits and block modifications to `_template/`.

**Architecture:** External shell scripts in `.claude/hooks/` that read tool input from stdin as JSON, validate conditions using `jq`, and exit with appropriate codes. Registered in `.claude/settings.json`.

**Tech Stack:** Bash, jq (JSON processor), Claude Code hooks API

---

### Task 1: Create protect-template.sh hook script

**Files:**
- Create: `.claude/hooks/protect-template.sh`

**Step 1: Write the script**

```bash
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
```

**Step 2: Make it executable**

Run: `chmod +x .claude/hooks/protect-template.sh`

**Step 3: Test the script manually**

Run: `echo '{"tool_input":{"file_path":"plugins/_template/README.md"}}' | .claude/hooks/protect-template.sh; echo "exit: $?"`
Expected: stderr message about blocking, exit code 2

Run: `echo '{"tool_input":{"file_path":"plugins/my-plugin/README.md"}}' | .claude/hooks/protect-template.sh; echo "exit: $?"`
Expected: no output, exit code 0

Run: `echo '{"tool_input":{"file_path":""}}' | .claude/hooks/protect-template.sh; echo "exit: $?"`
Expected: no output, exit code 0

**Step 4: Commit**

```bash
git add .claude/hooks/protect-template.sh
git commit -m "feat: add protect-template hook script"
```

---

### Task 2: Create validate-marketplace-json.sh hook script

**Files:**
- Create: `.claude/hooks/validate-marketplace-json.sh`

**Step 1: Write the script**

```bash
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
```

**Step 2: Make it executable**

Run: `chmod +x .claude/hooks/validate-marketplace-json.sh`

**Step 3: Test with valid marketplace.json**

Run: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | CLAUDE_PROJECT_DIR="$(pwd)" .claude/hooks/validate-marketplace-json.sh; echo "exit: $?"`
Expected: no output, exit code 0

**Step 4: Test with non-marketplace file (should skip)**

Run: `echo '{"tool_input":{"file_path":"plugins/foo/README.md"}}' | .claude/hooks/validate-marketplace-json.sh; echo "exit: $?"`
Expected: no output, exit code 0

**Step 5: Test with invalid JSON (create temp broken file)**

Run:
```bash
echo '{bad json' > /tmp/test-marketplace.json
echo '{"tool_input":{"file_path":"marketplace.json"}}' | CLAUDE_PROJECT_DIR="/tmp" .claude/hooks/validate-marketplace-json.sh
rm /tmp/test-marketplace.json
```

Note: This test requires a temp `.claude-plugin/marketplace.json` — verify the "not valid JSON" block message is produced. If the file path resolution doesn't match, the "file not found" block message is acceptable.

**Step 6: Commit**

```bash
git add .claude/hooks/validate-marketplace-json.sh
git commit -m "feat: add validate-marketplace-json hook script"
```

---

### Task 3: Create .claude/settings.json with hook registrations

**Files:**
- Create: `.claude/settings.json`

**Step 1: Write the settings file**

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

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('.claude/settings.json')); print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: register hooks in .claude/settings.json"
```

---

### Task 4: Update CLAUDE.md and design docs

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add hooks section to CLAUDE.md**

After the `## Plugin Conventions` section, add:

```markdown
## Hooks

Configured in `.claude/settings.json`:

| Hook | Type | Trigger | Description |
|------|------|---------|-------------|
| protect-template | PreToolUse | Edit\|Write | Blocks modifications to `plugins/_template/` |
| validate-marketplace-json | PostToolUse | Edit\|Write | Validates marketplace.json schema after edits |
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add hooks section to CLAUDE.md"
```

---

### Task 5: Integration test

**Step 1: Verify hook scripts are executable**

Run: `ls -la .claude/hooks/*.sh`
Expected: Both files show `-rwxr-xr-x` permissions

**Step 2: Verify settings.json is valid**

Run: `python3 -c "import json; d=json.load(open('.claude/settings.json')); assert 'hooks' in d; assert 'PreToolUse' in d['hooks']; assert 'PostToolUse' in d['hooks']; print('OK')"`
Expected: `OK`

**Step 3: Verify protect-template blocks correctly**

Run: `echo '{"tool_input":{"file_path":"plugins/_template/skills/example-skill/SKILL.md"}}' | .claude/hooks/protect-template.sh 2>&1; echo "exit: $?"`
Expected: Block message + exit code 2

**Step 4: Verify validate-marketplace-json passes on current file**

Run: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | CLAUDE_PROJECT_DIR="$(pwd)" .claude/hooks/validate-marketplace-json.sh; echo "exit: $?"`
Expected: no output, exit code 0

**Step 5: Verify file structure**

Run: `find .claude -type f | sort`
Expected:
```
.claude/hooks/protect-template.sh
.claude/hooks/validate-marketplace-json.sh
.claude/settings.json
```
(Plus any worktree files that may exist)
