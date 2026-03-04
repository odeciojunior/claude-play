# Claude Code Extensibility Reference

Official specifications for plugins, skills, hooks, and subagents. Compiled from Claude Code documentation (March 2026).

---

## Table of Contents

1. [Plugins](#1-plugins)
2. [Skills](#2-skills)
3. [Hooks](#3-hooks)
4. [Subagents](#4-subagents)

---

## 1. Plugins

### 1.1 Directory Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest (optional if using defaults)
├── commands/                  # Legacy command files (use skills/ for new)
├── agents/                    # Subagent markdown files
├── skills/                    # Skills: <name>/SKILL.md
│   └── my-skill/
│       ├── SKILL.md
│       ├── references/        # Optional supporting files
│       └── scripts/           # Optional utilities
├── hooks/
│   └── hooks.json             # Hook configuration
├── settings.json              # Default settings (only "agent" key supported)
├── .mcp.json                  # MCP server definitions
├── .lsp.json                  # LSP server configurations
├── scripts/                   # Hook and utility scripts
├── README.md
└── LICENSE
```

**Critical**: Only `plugin.json` goes inside `.claude-plugin/`. All other components live at plugin root level.

**Auto-discovery**: Components in default directories (`commands/`, `agents/`, `skills/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`) are discovered automatically — no manifest required.

### 1.2 plugin.json Schema

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Brief plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://github.com/author"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "commands": "./custom/commands/",
  "agents": "./custom/agents/",
  "skills": "./custom/skills/",
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "outputStyles": "./styles/",
  "lspServers": "./.lsp.json"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique kebab-case identifier. Used for namespacing: `/plugin-name:skill-name` |
| `version` | string | No | Semver. Claude Code uses this to determine updates — bump on every change |
| `description` | string | No | Brief plugin purpose |
| `author` | object | No | `name` (required), `email` (optional), `url` (optional) |
| `homepage` | string | No | Documentation URL |
| `repository` | string | No | Source code URL |
| `license` | string | No | SPDX identifier |
| `keywords` | array | No | Discovery tags |
| `commands` | string/array | No | Additional command paths (supplements default `commands/`) |
| `agents` | string/array | No | Additional agent paths (supplements default `agents/`) |
| `skills` | string/array | No | Additional skill paths (supplements default `skills/`) |
| `hooks` | string/array/object | No | Hook config paths or inline config |
| `mcpServers` | string/array/object | No | MCP server paths or inline config |
| `lspServers` | string/array/object | No | LSP server paths or inline config |
| `outputStyles` | string/array | No | Output style files |

**Path behavior**: Custom paths supplement (not replace) default directories. All paths must be relative and start with `./`.

### 1.3 marketplace.json Schema

**Location**: `.claude-plugin/marketplace.json` at repository root.

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "marketplace-name",
  "description": "Brief marketplace description",
  "owner": {
    "name": "Owner Name",
    "email": "owner@example.com"
  },
  "metadata": {
    "version": "1.0.0",
    "pluginRoot": "./plugins"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "source": "./plugins/plugin-name",
      "description": "Brief plugin description",
      "version": "1.0.0",
      "author": { "name": "Author", "email": "a@b.com" },
      "license": "MIT",
      "keywords": ["tag1", "tag2"],
      "category": "developer-tools",
      "tags": ["extra", "tags"],
      "strict": true
    }
  ]
}
```

**Required top-level fields**: `name`, `owner`, `plugins`

**Plugin source types**:

| Type | Format | Example |
|------|--------|---------|
| Relative path | `"./plugins/name"` | Works with git-based marketplaces |
| GitHub repo | `{"source": "github", "repo": "owner/repo", "ref": "v1.0", "sha": "abc123"}` | Pin to tag/SHA |
| Git URL | `{"source": "url", "url": "https://gitlab.com/x.git", "ref": "main"}` | Any git host |
| npm | `{"source": "npm", "package": "@scope/pkg", "version": "^2.0"}` | npm registry |
| pip | `{"source": "pip", "package": "pkg", "version": "2.1.0"}` | PyPI registry |

**Strict mode** (default `true`): When true, `plugin.json` is authority for components and marketplace supplements. When false, marketplace entry is entire definition.

### 1.4 Plugin Installation

```bash
# Add marketplace
claude plugin marketplace add owner/repo

# Install plugin
claude plugin install plugin-name@marketplace-name [--scope user|project|local]

# Development mode (load from directory)
claude --plugin-dir ./my-plugin

# Validate structure
claude plugin validate .
```

**Installation scopes**:

| Scope | Settings file | Use case |
|-------|---------------|----------|
| `user` (default) | `~/.claude/settings.json` | Personal, all projects |
| `project` | `.claude/settings.json` | Team, version-controlled |
| `local` | `.claude/settings.local.json` | Personal, gitignored |

**Caching**: Installed plugins are copied to `~/.claude/plugins/cache`. Paths with `../` won't work after installation.

### 1.5 Environment Variables

| Variable | Available in | Description |
|----------|-------------|-------------|
| `${CLAUDE_PLUGIN_ROOT}` | Hooks, MCP servers, scripts | Absolute path to plugin directory |

---

## 2. Skills

### 2.1 File Format

```
skills/
  my-skill/
    SKILL.md           # Required: frontmatter + instructions
    references/        # Optional: detailed docs
    scripts/           # Optional: executables
    examples/          # Optional: sample outputs
```

**Locations**:
- Personal: `~/.claude/skills/<name>/SKILL.md`
- Project: `.claude/skills/<name>/SKILL.md`
- Plugin: `<plugin>/skills/<name>/SKILL.md`

**Priority**: Enterprise > Personal > Project. Plugin skills use `plugin-name:skill-name` namespace.

### 2.2 Frontmatter Attributes

> **Note on validation**: Some Claude Code versions validate only the Agent Skills standard fields. Extension fields (`allowed-tools`, `context`, `model`, `agent`, `hooks`) may produce validation warnings but are documented in official Claude Code docs and function at runtime.

#### Standard Fields (always validated)

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | Directory name | Display name. Max 64 chars, kebab-case. Becomes `/slash-command` |
| `description` | string | First paragraph | When to trigger. Max 1024 chars. Use 3rd-person: "This skill should be used when..." |
| `disable-model-invocation` | boolean | `false` | If true, only users can invoke (not Claude). Description NOT loaded into context |
| `user-invokable` | boolean | `true` | If false, hidden from `/` menu. Only Claude can invoke. Description IS in context |
| `argument-hint` | string | None | Hint shown in autocomplete (e.g., `[issue-number]`) |
| `compatibility` | string | None | Documents compatible systems/versions |
| `license` | string | None | SPDX license identifier |
| `metadata` | object | None | Custom metadata dictionary |

#### Extension Fields (documented but may warn in validator)

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `allowed-tools` | string | None | Comma-separated tool names. Auto-approved when skill is active |
| `context` | string | `inline` | `inline` (current conversation) or `fork` (isolated subagent) |
| `model` | string | Current model | Override model for this skill |
| `agent` | string | `general-purpose` | Subagent type when `context: fork`. Options: `Explore`, `Plan`, `general-purpose`, custom |
| `hooks` | object | None | Scoped hooks active only while skill executes |
| `version` | string | None | Semver for distribution tracking |

### 2.3 Invocation Matrix

| Configuration | User can invoke | Claude can invoke | Description in context |
|---------------|:-:|:-:|:-:|
| Default (no flags) | Yes | Yes | Yes |
| `disable-model-invocation: true` | Yes | No | No |
| `user-invokable: false` | No | Yes | Yes |

### 2.4 String Substitutions

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed to the skill |
| `$ARGUMENTS[N]` or `$N` | Specific argument by 0-based index |
| `${CLAUDE_SESSION_ID}` | Current session ID |

**Dynamic command injection**: `` !`command` `` syntax executes shell commands before Claude sees the content. Output replaces the placeholder.

### 2.5 Execution Models

**Inline** (default): Runs in current conversation. Has access to history and all permitted tools.

**Fork** (`context: fork`): Spawns isolated subagent. Skill content becomes the task prompt. No conversation history. Results summarized and returned.

### 2.6 Best Practices

- Keep SKILL.md under 500 lines; use supporting files for detailed reference
- Use `disable-model-invocation: true` for side-effect operations (`/commit`, `/deploy`)
- Use `user-invokable: false` for background knowledge skills
- Include "ultrathink" in content to enable extended thinking

---

## 3. Hooks

### 3.1 Configuration Locations

| Priority | Location | Scope |
|----------|----------|-------|
| 1 (lowest) | `~/.claude/settings.json` | All projects |
| 2 | `.claude/settings.json` | Project (version-controlled) |
| 3 | `.claude/settings.local.json` | Project (gitignored) |
| 4 | Plugin `hooks/hooks.json` | While plugin enabled |
| 5 (highest) | Skill/agent YAML frontmatter | While component active |
| — | Managed policy settings | Enterprise (admin-controlled) |

### 3.2 Configuration Format

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex-pattern>",
        "hooks": [
          {
            "type": "command",
            "command": "path/to/script.sh",
            "timeout": 600,
            "statusMessage": "Running check..."
          }
        ]
      }
    ]
  }
}
```

### 3.3 Hook Events (17 total)

| Event | When | Can Block | Matcher Field |
|-------|------|:---------:|---------------|
| **SessionStart** | Session begins/resumes | Yes | `source` (startup, resume, clear, compact) |
| **UserPromptSubmit** | User submits prompt | Yes | None |
| **PreToolUse** | Before tool executes | Yes | `tool_name` (regex) |
| **PermissionRequest** | Permission dialog about to show | Yes | `tool_name` (regex) |
| **PostToolUse** | After tool succeeds | Partial | `tool_name` (regex) |
| **PostToolUseFailure** | After tool fails | Partial | `tool_name` (regex) |
| **Notification** | Claude sends notification | No | `notification_type` |
| **SubagentStart** | Subagent spawned | Yes | `agent_type` |
| **SubagentStop** | Subagent finishes | Yes | `agent_type` |
| **Stop** | Claude finishes responding | Yes | None |
| **TeammateIdle** | Agent team teammate idling | Yes | None |
| **TaskCompleted** | Task marked complete | Yes | None |
| **ConfigChange** | Config file changes | Yes | `source` |
| **WorktreeCreate** | Worktree creation | Special | None |
| **WorktreeRemove** | Worktree removal | Yes | None |
| **PreCompact** | Before context compaction | No | `source` (manual, auto) |
| **SessionEnd** | Session terminates | Yes | `source` |

### 3.4 Handler Types

| Type | Required Fields | Default Timeout | Description |
|------|----------------|:-:|-------------|
| `command` | `command` | 600s | Shell command; receives JSON on stdin |
| `http` | `url` | — | POST request with JSON body |
| `prompt` | `prompt` | 30s | Single-turn LLM decision (Haiku) |
| `agent` | `prompt` | 60s | Multi-turn subagent with tools (up to 50 turns) |

**Common optional fields**: `timeout` (max 600s), `statusMessage`, `async` (command only), `model` (prompt/agent only), `once` (skills/agents only).

### 3.5 Stdin JSON (Common Fields)

Every hook receives on stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/dir",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

**PreToolUse** adds: `tool_name`, `tool_input`, `tool_use_id`
**PostToolUse** adds: `tool_name`, `tool_input`, `tool_result`
**PostToolUseFailure** adds: `tool_name`, `tool_input`, `error_message`
**UserPromptSubmit** adds: `prompt`
**Stop/SubagentStop** adds: `stop_hook_active`, `last_assistant_message`
**Notification** adds: `message`, `title`, `notification_type`

### 3.6 Exit Codes

| Code | Meaning | JSON Parsed? | stderr Shown? |
|:----:|---------|:-:|:-:|
| **0** | Success | Yes | Only in verbose mode |
| **2** | Block action | No | Yes (to Claude as feedback) |
| **other** | Non-blocking error | No | Only in verbose mode |

### 3.7 Decision Output (stdout JSON, exit 0)

**PreToolUse decisions**:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Why",
    "updatedInput": { "command": "modified" }
  }
}
```

**PostToolUse / Stop blocking**:
```json
{
  "decision": "block",
  "reason": "Why this is blocked"
}
```

**Context injection** (SessionStart, UserPromptSubmit):
```json
{
  "additionalContext": "Text injected into Claude's context"
}
```

**Prompt/Agent hooks**:
```json
{
  "ok": true|false,
  "reason": "Explanation if false"
}
```

### 3.8 Environment Variables

| Variable | Description |
|----------|-------------|
| `$CLAUDE_PROJECT_DIR` | Absolute path to project root |
| `$CLAUDE_PLUGIN_ROOT` | Absolute path to plugin directory |
| `$CLAUDE_SESSION_ID` | Current session ID |
| `$CLAUDE_ENV_FILE` | SessionStart only: file to persist env vars |

### 3.9 Matcher Syntax

Matchers are **case-sensitive regex patterns**:

```
"Bash"              → exact match
"Edit|Write"        → OR
"mcp__github__.*"   → all GitHub MCP tools
"mcp__.*__write.*"  → all write tools across MCP servers
""                  → match all (same as omitting matcher)
```

### 3.10 HTTP Hook Details

```json
{
  "type": "http",
  "url": "https://audit.example.com/logs",
  "headers": {
    "Authorization": "Bearer $MY_TOKEN"
  },
  "allowedEnvVars": ["MY_TOKEN"]
}
```

- POST method, JSON body (same as stdin)
- Only vars in `allowedEnvVars` are interpolated in headers
- To block: return 2xx with `{"decision": "block"}` JSON
- Non-2xx = non-blocking error

### 3.11 Disabling Hooks

```json
{ "disableAllHooks": true }
```

Enterprise: `{ "allowManagedHooksOnly": true }` blocks all non-policy hooks.

---

## 4. Subagents

### 4.1 File Format

**Location**: `.claude/agents/<name>.md` (project) or `~/.claude/agents/<name>.md` (user)

```markdown
---
name: agent-name
description: When to invoke this agent
tools: Read, Edit, Bash
model: sonnet
---

System prompt in markdown format.
```

### 4.2 Frontmatter Fields

| Field | Type | Required | Default | Description |
|-------|------|:--------:|---------|-------------|
| `name` | string | Yes | — | Kebab-case identifier |
| `description` | string | Yes | — | When Claude should delegate to this agent |
| `tools` | string/array | No | Inherited | Allowlist of tools |
| `disallowedTools` | string/array | No | None | Denylist of tools |
| `model` | string | No | `inherit` | `sonnet`, `opus`, `haiku`, `inherit` |
| `permissionMode` | string | No | `default` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | integer | No | — | Max agentic turns before stopping |
| `skills` | array | No | None | Skills to preload into agent context |
| `mcpServers` | object/array | No | None | MCP servers available to agent |
| `hooks` | object | No | None | Lifecycle hooks (PreToolUse, PostToolUse, Stop) |
| `memory` | string | No | None | `user`, `project`, or `local` |
| `background` | boolean | No | `false` | Run as background task by default |
| `isolation` | string | No | None | `worktree` for git worktree isolation |

### 4.3 Built-in Subagent Types

| Type | Model | Tools | Purpose |
|------|-------|-------|---------|
| `Explore` | Haiku | Read-only (Read, Glob, Grep) | Codebase search and exploration |
| `Plan` | Inherited | Read-only | Codebase research during plan mode |
| `general-purpose` | Inherited | All tools | Complex multi-step tasks |

### 4.4 Tool Access Control

**Allowlist** (agent can ONLY use listed tools):
```yaml
tools: Read, Grep, Glob, Bash
```

**Denylist** (remove from inherited set):
```yaml
disallowedTools: Write, Edit
```

**Restrict subagent spawning**:
```yaml
tools: Agent(worker, researcher), Read, Bash
```

### 4.5 Agent Priority

When multiple agents share a name:

1. CLI `--agents` flag (highest)
2. Project `.claude/agents/`
3. User `~/.claude/agents/`
4. Plugin `agents/` directory (lowest)

### 4.6 Memory

```yaml
memory: project
```

| Scope | Location | Version-controlled |
|-------|----------|:-:|
| `user` | `~/.claude/agent-memory/<name>/` | No |
| `project` | `.claude/agent-memory/<name>/` | Yes |
| `local` | `.claude/agent-memory-local/<name>/` | No |

First 200 lines of `MEMORY.md` included in system prompt. Read/Write/Edit tools auto-enabled for memory files.

### 4.7 Foreground vs Background

**Foreground** (default): Blocks main conversation. Permission prompts passed to user.

**Background**: Runs concurrently. Pre-collects permissions. Auto-denies unapproved tools. Activate by asking "run in background" or pressing Ctrl+B.

### 4.8 Limitations

- Subagents cannot spawn other subagents (no nesting)
- No Task/Agent tool available inside subagents
- Plugin agents copied to cache — `../` paths don't work
- File-based agents require session restart (use `/agents` for immediate loading)

### 4.9 CLI Invocation

```bash
# Define agents for a session
claude --agents '{
  "reviewer": {
    "description": "Code reviewer",
    "prompt": "You are a senior code reviewer...",
    "tools": ["Read", "Grep", "Glob"],
    "model": "sonnet"
  }
}'

# Interactive management
/agents
```

---

## Sources

### Plugins
- [Create plugins](https://code.claude.com/docs/en/plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

### Skills
- [Extend Claude with skills](https://code.claude.com/docs/en/skills)

### Hooks
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide)

### Subagents
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Subagents in the SDK](https://platform.claude.com/docs/en/agent-sdk/subagents)
