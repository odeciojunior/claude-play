# Claude Code Extensibility Reference

Official specifications for plugins, skills, hooks, and subagents. Compiled from the Claude Code documentation (October 2026, checked against Claude Code v2.1.304).

Rules marked **repo policy** are claude-play conventions layered on top of the official spec; everything else is the spec.

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
│   └── plugin.json           # Manifest (optional; only `name` is required inside it)
├── skills/                    # Skills: <name>/SKILL.md (+ references/, scripts/)
├── commands/                  # Flat .md commands (older format; prefer skills/)
├── agents/                    # Subagent .md files; subfolders become part of the name
├── hooks/
│   └── hooks.json             # Hook config, wrapped in a top-level "hooks" key
├── monitors/
│   └── monitors.json          # Background monitors array (experimental)
├── output-styles/             # Output style .md files
├── themes/                    # Theme .json files (experimental)
├── workflows/                 # Workflow .js files
├── bin/                       # Executables put on the Bash tool's PATH while enabled
├── settings.json              # Defaults: only `agent` and `subagentStatusLine` take effect
├── .mcp.json                  # MCP server definitions
├── .lsp.json                  # LSP server configurations
├── scripts/                   # Hook and utility scripts (convention, not a component)
├── README.md
└── LICENSE
```

**Critical**: Only `plugin.json` goes inside `.claude-plugin/`. All other components live at the plugin root.

**Auto-discovery**: Components in their default locations load without a manifest. Without `plugin.json`, the plugin name comes from the marketplace entry, or from the directory name with `--plugin-dir`. A plugin with `SKILL.md` at its root, no `skills/` and no `skills` key loads as a single skill.

**Not loaded**: a `CLAUDE.md` at the plugin root is not loaded as context (`claude plugin validate` warns). Put instructions in a skill, and rules that must always hold in a hook.

**`bin/`**: entries come after the user's own `PATH`, so they can't shadow system commands. claude.ai and Cowork don't install a plugin that has a top-level `bin/`.

### 1.2 plugin.json Schema

```json
{
  "name": "plugin-name",
  "displayName": "Plugin Name",
  "version": "1.0.0",
  "description": "Brief plugin description",
  "author": { "name": "Author Name", "email": "author@example.com", "url": "https://github.com/author" },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "defaultEnabled": true,
  "dependencies": ["other-plugin"],
  "skills": ["./extra-skills/"],
  "agents": ["./agents/reviewer.md"],
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "outputStyles": "./styles/",
  "experimental": { "themes": "./themes/", "monitors": "./config/monitors.json" },
  "userConfig": {
    "api_token": { "type": "string", "title": "API token", "description": "Token for the API", "sensitive": true }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | **Only required field.** Kebab-case, no spaces/`@`/`:`/separators. Namespaces components: `plugin-name:skill-name`. Reserved names are errors: prefixes `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`; exact names `claude`, `anthropic`, `anthropics`, `claude-code`, `claude-mods`; names combining "official" with claude or anthropic |
| `displayName` | string | Name shown in UI instead of `name`. Not used for namespacing. A marketplace entry's value wins |
| `version` | string | Not checked against semver. Setting it pins users to that version until it changes. Without it, git sources use the commit SHA |
| `description` | string | Short purpose |
| `author` | object | `name` (required), `email`, `url` |
| `homepage` | string | Must parse as a URL, or the plugin fails to load |
| `repository` | string | Source URL (not validated) |
| `license` | string | SPDX identifier |
| `keywords` | array | Discovery tags |
| `metadata` | object | Free-form; Claude Code doesn't read it |
| `defaultEnabled` | boolean | Starts enabled when the user hasn't set it (default `true`). The marketplace entry overrides it |
| `dependencies` | array | Plugins that must be enabled: `"name"`, `"name@marketplace"`, or `{name, marketplace, version}` |
| `settings` | object | Inline defaults; only `agent` and `subagentStatusLine` take effect. A root `settings.json` wins |
| `userConfig` | object | Values prompted for on enable (`type`, `title`, `description` required; `sensitive` → secure storage). Referenced as `${user_config.KEY}` or env `CLAUDE_PLUGIN_OPTION_<KEY>` |
| `channels` | array | Message channels bound to one of the plugin's MCP servers |
| `skills` | path/array | Skill directories. **Adds to** the default `skills/` scan |
| `commands` | path/array/object | `.md` files, dirs, or a name → `{source\|content}` map. **Replaces** the default `commands/` scan |
| `agents` | path/array | Agent `.md` files only (no directories). **Replaces** the default `agents/` scan |
| `hooks` | path/object/array | Hook files or inline config. **Merges** with `hooks/hooks.json` |
| `mcpServers` | path/object/array | `.json` files, `.mcpb`/`.dxt` bundles, or inline. **Merges** with `.mcp.json` (later name wins) |
| `lspServers` | path/object/array | **Merges** with `.lsp.json` |
| `outputStyles` | path/array | **Replaces** the default `output-styles/` scan |
| `workflows` | path/array | **Replaces** the default `workflows/` scan |
| `experimental.themes` / `.monitors` / `.evals` | path/array | Themes and monitors **replace** their defaults; `evals` names the eval dir |

Directory-listing fields (`icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`) are read only by Anthropic's directory. An unknown top-level key is stripped with a validate warning; an unknown key inside a `userConfig` option, `channels` entry, `lspServers` config or `monitors` entry is an error and the plugin doesn't load.

**Path rules**: every component path is relative to the plugin root and starts with `./` (`skills` also accepts `"."`). It must exist and resolve inside the plugin root; `..` is rejected. To keep a replaced default and add more, list it: `"commands": ["./commands/", "./extras/"]`. If a default folder exists and its replacing key is set, the folder is ignored with a warning.

### 1.3 marketplace.json Schema

**Location**: `.claude-plugin/marketplace.json`. The directory containing `.claude-plugin/` is the marketplace root; relative sources resolve from it.

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "marketplace-name",
  "description": "Brief marketplace description",
  "owner": { "name": "Owner Name", "email": "owner@example.com" },
  "metadata": { "version": "1.0.0", "pluginRoot": "./plugins" },
  "plugins": [
    {
      "name": "plugin-name",
      "source": "./plugins/plugin-name",
      "description": "Brief plugin description",
      "category": "developer-tools",
      "tags": ["extra", "tags"],
      "strict": true
    }
  ]
}
```

**Required top-level fields**: `name`, `owner` (`owner.name` required), `plugins`. Each entry requires `name` and `source`. Unknown keys are ignored at load and reported as validate warnings. Optional top-level: `description`, `version`, `metadata.{description,version,pluginRoot}`, `forceRemoveDeletedPlugins`, `allowCrossMarketplaceDependenciesOn`, `renames`.

**Entry fields**: an entry accepts every `plugin.json` field (except the directory-listing fields) plus `category`, `tags`, `strict`, `relevance`, `headers`, `headersHelper`. When both set `version`, `plugin.json` wins (the docs advise setting it in one place only; repo policy: `plugin.json` only, entries omit `version`). The entry's `defaultEnabled` and display fields (`displayName`, `description`, `author`, …) override `plugin.json`.

**Plugin source types**:

| Type | Fields | Notes |
|------|--------|-------|
| Relative path | `"./plugins/name"` | Inside the marketplace; must start with `./` (or a bare name under `metadata.pluginRoot`). Not usable from a `url` marketplace |
| `github` | `repo`, `ref`, `sha` | `owner/repo`; `sha` is a full 40-char SHA |
| `url` | `url`, `ref`, `sha` | Any git repository by URL |
| `git-subdir` | `url`, `path`, `ref`, `sha` | One subdirectory of a repo (sparse/partial clone) |
| `npm` | `package`, `version`, `registry` | Install scripts never run |
| `archive` | `url`, `sha256` | HTTPS zip |
| `command` | `command`, `timeout`, `mode` | Directory printed by a local command; `mode` `copy` or `link` |

There is no `pip` source type (`pip` is a reserved marketplace name).

**Strict mode** (`strict`, default `true`), when the plugin has its own `plugin.json`:

| `strict` | Entry component fields (`commands`, `agents`, `skills`, `hooks`, `outputStyles`, `themes`) | Result |
|----------|------|--------|
| `true` | any | `plugin.json` is the authority; entry components are appended (entry `hooks` replace the manifest's matchers per event) |
| `false` | none | `plugin.json` is the manifest |
| `false` | one or more | **Conflict**: `Plugin <name> has conflicting manifests`, plugin fails to load |

Without `plugin.json`, the entry is the manifest regardless of `strict`. Entry `hooks` must be an inline object.

### 1.4 Plugin Installation

```bash
claude plugin marketplace add owner/repo             # or a git URL / local path
claude plugin install plugin-name@marketplace-name [--scope user|project|local]
claude plugin update plugin-name@marketplace-name [--scope user|project|local|managed]
claude plugin uninstall plugin-name@marketplace-name [--keep-data]
claude --plugin-dir ./my-plugin                      # session-only, loads as <name>@inline
claude plugin validate . [--strict] [--json]
/reload-plugins                                      # in a session, apply plugin changes
```

**Scopes** (`enabledPlugins` lives in the matching settings file):

| Scope | Settings file | Use case |
|-------|---------------|----------|
| `user` (default) | `~/.claude/settings.json` | Personal, all projects |
| `project` | `.claude/settings.json` | Team, version-controlled |
| `local` | `.claude/settings.local.json` | Personal, gitignored |
| `managed` | Managed settings | Admin-installed; `update` accepts it, `install` doesn't. `true`/`false` there can't be overridden |

**Caching**: marketplace plugins are copied to `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`; files outside the plugin directory (`../shared`) are not copied. Old version directories are removed 14 days after an update. Relative-path plugins in a marketplace added from a local path load in place.

### 1.5 Environment Variables

| Variable | Resolves to | Available in |
|----------|-------------|--------------|
| `${CLAUDE_PLUGIN_ROOT}` | The plugin's installed version directory (changes on every update; don't write state there) | Hook `command`/`args` (also exported), MCP/LSP `command`/`args`/`env`, skill/command/agent bodies |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/<id>/`, kept across updates, deleted on last uninstall unless `--keep-data` | Same as above |
| `${CLAUDE_PROJECT_DIR}` | The project root | Hooks, LSP servers, skill bodies |
| `CLAUDE_PLUGIN_OPTION_<KEY>` | A `userConfig` value | Hook process environment only |

None of these are in the environment of commands Claude runs through the Bash tool. On Windows the substituted paths use forward slashes. In shell-form hooks, quote them: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/x.sh"`.

### 1.6 What `claude plugin validate` checks

- **Manifests**: `plugin.json` and `marketplace.json` JSON syntax, required fields, types, names (reserved/impersonating names, plugin-id characters), duplicate entries, `..` in sources, and that component paths exist inside the plugin root. Unknown top-level fields are warnings.
- **MCP entries** (v2.1.281+): entries Claude Code would drop, undeclared `${user_config.KEY}` references, invalid remote URLs (errors); `http://` to non-loopback hosts and literal-looking credentials (warnings).
- **Component files**: skill, agent and command files in the plugin directory, reporting frontmatter that doesn't parse; it also warns about a plugin-root `CLAUDE.md` and unquoted path variables in shell-form hooks.
- **Not checked**: unknown SKILL.md or agent frontmatter keys (Claude Code ignores them silently; this repo verified an invented SKILL.md key passes), `.lsp.json`, a root-level `SKILL.md`, entry `hooks` given as a path, remote sources (fail only at install), and, in a marketplace run, the files of plugins it lists (validate each plugin directory).
- **`--strict`**: turns warnings into failures (exit `1`), for CI. Exit `2` means the validator itself failed.
- **Repo practice**: `marketplace-tools`' `lint-plugin.mjs` checks frontmatter keys and agent files, since validate doesn't.

Sources: [Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference) · [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference) · [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) · [Add components](https://code.claude.com/docs/en/plugins/components) · [Plugin loading](https://code.claude.com/docs/en/plugins/loading)

---

## 2. Skills

### 2.1 File Format

```
skills/
  my-skill/
    SKILL.md           # Required: frontmatter + instructions
    references/        # Optional: detailed docs
    scripts/           # Optional: executables
    assets/            # Optional: templates, data
```

**Locations**:
- Enterprise: managed settings
- Personal: `~/.claude/skills/<name>/SKILL.md`
- Project: `.claude/skills/<name>/SKILL.md` (also nested subdirectories and `--add-dir` directories)
- Plugin: `<plugin>/skills/<name>/SKILL.md`

**Name collisions**: enterprise over personal, personal over project. Plugin skills are namespaced (`/plugin-name:skill-name`) so they never collide. A project-root skill and a nested skill both load. Custom commands in `.claude/commands/` still work and have been merged into skills.

**Live reload**: Claude Code watches skill directories, so adding, editing or removing a skill under `~/.claude/skills/`, `.claude/skills/` or an `--add-dir` `.claude/skills/` takes effect without a restart. A top-level skills directory created after session start needs `/reload-skills`. Plugin `hooks/`, `.mcp.json`, `agents/` and `output-styles/` changes need `/reload-plugins`.

### 2.2 Frontmatter Fields

All fields are optional; Claude Code ignores unrecognized fields without an error (names must match exactly, hyphens included).

| Field | Description |
|-------|-------------|
| `name` | Command name in the `/` menu. Defaults to the directory name. In a plugin it replaces only the last segment |
| `description` | Recommended. What the skill does and when to use it; defaults to the first non-empty body line. Combined with `when_to_use`, **truncated at 1,536 characters** in the skill listing |
| `when_to_use` | Extra trigger context, appended to `description`; counts toward the 1,536 cap |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]` |
| `arguments` | Named positional arguments for `$name` substitution (string or YAML list) |
| `disable-model-invocation` | `true`: only the user can invoke; also blocks preloading into subagents. Default `false` |
| `user-invocable` | `false`: hidden from `/` menu, only Claude invokes. Default `true` |
| `allowed-tools` | Tools usable without a prompt during the invoking turn (string or list) |
| `disallowed-tools` | Tools removed while the skill is active |
| `model` | Model for the rest of the current turn (or the forked subagent's model with `context: fork`); `inherit` keeps the active one |
| `effort` | `low`, `medium`, `high`, `xhigh`, `max` |
| `context` | `fork` runs the skill in a subagent |
| `agent` | Subagent type for `context: fork` (default `general-purpose`; `Explore`, `Plan`, or custom) |
| `background` | With `context: fork`, `false` waits for the result. Default `true` |
| `hooks` | Hooks registered on invocation, active for the rest of the session |
| `paths` | Globs; auto-load only when working with matching files |
| `shell` | `bash` (default) or `powershell` for `!` commands |
| `metadata` | Free-form map for your own tooling; Claude Code doesn't act on it |
| `license` | Agent Skills spec field; accepted, not acted on |
| `compatibility` | Agent Skills spec field, ≤ 500 chars; accepted, not acted on |

**`version` is not a skill field**; put it in `metadata.version`.

**Outside Claude Code** (claude.ai uploads, Skills API, `package_skill.py`), only `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` are allowed and others are a hard error. There the Agent Skills spec limits apply: `name` ≤ 64 chars, lowercase letters/digits/hyphens, matching the directory; `description` ≤ 1,024 chars.

**Repo policy (claude-play)**: SKILL.md uses only `name`, `description`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `compatibility`, `license`, `metadata`.

### 2.3 Invocation Matrix

| Configuration | User can invoke | Claude can invoke | Description in context |
|---------------|:-:|:-:|:-:|
| Default (no flags) | Yes | Yes | Yes |
| `disable-model-invocation: true` | Yes | No | No |
| `user-invocable: false` | No | Yes | Yes |

The full body loads only when the skill is invoked. The listing budget scales at 1% of the context window (`skillListingBudgetFraction`); least-used descriptions are dropped first when it overflows.

### 2.4 String Substitutions

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments as typed. If no placeholder receives them, `ARGUMENTS: <value>` is appended |
| `$ARGUMENTS[N]` / `$N` | Argument by 0-based index (shell-style quoting) |
| `$name` | Named argument declared in `arguments` |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_EFFORT}` | Current effort level |
| `${CLAUDE_SKILL_DIR}` | Directory containing this `SKILL.md` (for plugin skills, the skill's subdirectory) |
| `${CLAUDE_PROJECT_DIR}` | Project root |
| `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` | Plugin skills only |

**Where they apply**: the docs name only the SKILL.md body and Bash rules in `allowed-tools`. A reference file the skill later reads with Read is not substituted, so resolve paths in SKILL.md.

**Dynamic context injection**: `` !`command` `` (at line start or after whitespace) and fenced ```` ```! ```` blocks run before Claude sees the skill; output replaces the placeholder once (not re-scanned). Bash tool's 2-minute timeout; a failing command aborts the invocation. `disableSkillShellExecution: true` replaces them with a policy notice.

### 2.5 Execution Models

**Inline** (default): runs in the current conversation. Once invoked, the content stays in context and the file isn't re-read on later turns.

**Fork** (`context: fork`): starts a subagent of type `agent` with the skill content as its prompt and no conversation history; runs in the background by default (`background: false` waits; non-interactive mode always waits).

**Compaction**: auto-compaction re-attaches the most recent invocation of each skill after the summary, keeping the first 5,000 tokens of each within a 25,000-token total, filled from the most recently invoked. Put critical instructions near the top; re-invoke to restore the full text.

### 2.6 Best Practices

- Keep SKILL.md under 500 lines; move detail to supporting files linked from SKILL.md
- Use `disable-model-invocation: true` for side-effect operations (`/commit`, `/deploy`)
- Use `user-invocable: false` for background-knowledge skills
- Include `ultrathink` in the content to request deeper reasoning
- Rules that must hold every time belong in a hook, not a skill

Sources: [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Agent Skills specification](https://agentskills.io/specification)

---

## 3. Hooks

### 3.1 Configuration Locations

| Location | Scope |
|----------|-------|
| `~/.claude/settings.json` | All your projects |
| `.claude/settings.json` | Project (version-controlled) |
| `.claude/settings.local.json` | Project (gitignored) |
| Managed policy settings | Organization (admin-controlled) |
| Plugin `hooks/hooks.json` (+ manifest `hooks`) | While the plugin is enabled |
| Skill frontmatter | Rest of the session once the skill is invoked |
| Subagent frontmatter | While that subagent runs (`Stop` becomes `SubagentStop`) |

Hooks from all sources **merge**; there is no priority ladder. Matching hooks run in parallel. An identical handler in several settings files runs once; a plugin's or skill's copy stays separate.

### 3.2 Configuration Format

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<matcher>",
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

### 3.3 Hook Events (33 total)

"Exit 2 blocks" follows the docs' per-event exit-code table; some events that can't block on exit 2 still decide through JSON (§3.7).

| Event | Exit 2 blocks | Matcher on |
|-------|:-:|------------|
| **SessionStart** | No | `startup`, `resume`, `clear`, `compact`, `fork` |
| **Setup** | No | `init`, `maintenance` |
| **UserPromptSubmit** | Yes | — |
| **UserPromptExpansion** | Yes | command name |
| **PreToolUse** | Yes | tool name |
| **PermissionRequest** | No (deny via JSON `decision`) | tool name |
| **PermissionDenied** | No | tool name |
| **PostToolUse** | No (stderr shown to Claude) | tool name |
| **PostToolUseFailure** | No (stderr shown to Claude) | tool name |
| **PostToolBatch** | Yes | — |
| **Notification** | No | notification type |
| **MessageDisplay** | No | — |
| **SubagentStart** | No | agent type |
| **SubagentStop** | Yes | agent type |
| **TaskCreated** | Yes | — |
| **TaskCompleted** | Yes | — |
| **Stop** | Yes | — |
| **StopFailure** | No | error type |
| **TeammateIdle** | Yes | — |
| **InstructionsLoaded** | No | load reason |
| **ConfigChange** | Yes (except `policy_settings`) | config source |
| **CwdChanged** | No | — |
| **DirectoryAdded** | No | `slash_command`, `register_repo_root` |
| **FileChanged** | No | literal filenames |
| **WorktreeCreate** | Yes (any non-zero) | — |
| **WorktreeRemove** | Yes (any non-zero) | — |
| **PreCompact** | Yes | `manual`, `auto` |
| **PostCompact** | No | `manual`, `auto` |
| **PreModelSwitch** | Yes | model name |
| **PostModelSwitch** | No | model name |
| **Elicitation** | Yes | MCP server name |
| **ElicitationResult** | Yes | MCP server name |
| **SessionEnd** | No | exit reason |

### 3.4 Handler Types

| Type | Required Fields | Default Timeout | Description |
|------|----------------|:-:|-------------|
| `command` | `command` | 600s | Shell command (or executable with `args`, exec form); JSON on stdin |
| `http` | `url` | 600s | POST with the JSON input as body |
| `mcp_tool` | `server`, `tool` | 600s | Calls an MCP tool; `input` supports `${tool_input.file_path}`-style substitution. Plugin servers use `plugin:<plugin>:<server>` |
| `prompt` | `prompt` | 30s | Single LLM call (background model by default) returning `{ok, reason}` |
| `agent` | `prompt` | 60s | Experimental; subagent with tools, up to 50 turns |

`command`, `http` and `mcp_tool` defaults drop to 30s on `UserPromptSubmit`, `PreModelSwitch`, `PostModelSwitch`, and 10s on `MessageDisplay`. Not every event supports `prompt`/`agent`.

**Common fields**: `type`, `if` (permission-rule filter such as `"Bash(git *)"`, tool events only), `timeout` (seconds), `statusMessage`, `once` (honored only in skill frontmatter). **Command only**: `args`, `async`, `asyncRewake`, `shell` (`bash`/`powershell`), `onFailure` (`continue`/`block`, v2.1.295+). **Prompt/agent**: `model` (both), `continueOnBlock` (prompt only).

### 3.5 Stdin JSON (Common Fields)

```json
{
  "session_id": "abc123",
  "prompt_id": "550e8400-...",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/dir",
  "scratchpad_dir": "/tmp/.../scratchpad",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

Also, when they apply: `effort` (`{level}`), `agent_id` and `agent_type` (inside a subagent or with `--agent`). `permission_mode` is one of `default`, `plan`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`.

**PreToolUse** adds: `tool_name`, `tool_input`, `tool_use_id` (+ `mcp_server` for MCP tools)
**PostToolUse** adds: `tool_name`, `tool_input`, `tool_response`, optional `duration_ms`
**PostToolUseFailure** adds: `tool_name`, `tool_input`, `error`, optional `is_interrupt`, `duration_ms`
**UserPromptSubmit** adds: `prompt` (+ `session_title` when set)
**Stop** adds: `stop_hook_active`, `last_assistant_message`, `background_tasks`, `session_crons`
**SubagentStop** adds: the Stop fields plus `agent_id`, `agent_type`, `agent_transcript_path`
**Notification** adds: `message`, optional `title`, `notification_type`
**PreCompact** adds: `trigger`, `custom_instructions`

### 3.6 Exit Codes

| Code | Meaning | JSON Parsed? | stderr |
|:----:|---------|:-:|--------|
| **0** | Success | Yes | — |
| **2** | Blocking error (on events that can block) | Read, but can't override the block | The reason (to Claude or the user, per event) |
| **other** | Non-blocking error; action proceeds (unless `onFailure: "block"`) | Valid JSON still applies | First line in the notice |

On exit 0, plain-text stdout from `UserPromptSubmit` and `SessionStart` is added to Claude's context.

### 3.7 Decision Output (stdout JSON, exit 0)

**Universal fields**: `continue` (false stops processing), `stopReason`, `systemMessage`, `terminalSequence`. `suppressOutput` is accepted but has no effect.

**PreToolUse**:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "Why",
    "updatedInput": { "command": "modified" },
    "additionalContext": "Text for Claude"
  }
}
```
Across hooks, `deny` > `defer` > `ask` > `allow`. `updatedInput` replaces the whole input object.

**Top-level `decision`** (`UserPromptSubmit`, `UserPromptExpansion`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SubagentStop`, `ConfigChange`, `PreCompact`):
```json
{ "decision": "block", "reason": "Why this is blocked" }
```

**Context injection** always goes inside `hookSpecificOutput` (SessionStart, SubagentStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PostModelSwitch, Stop/SubagentStop):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Text injected into Claude's context"
  }
}
```

**Other patterns**: `PermissionRequest` → `hookSpecificOutput.decision.behavior` (`allow`/`deny`); `PostToolUse` → `updatedToolOutput`; `WorktreeCreate` → print the path; `TeammateIdle`/`TaskCompleted` → exit 2 or `continue: false`.

**Prompt/Agent hooks** (model response):
```json
{ "ok": false, "reason": "Required when ok is false" }
```

### 3.8 Environment Variables

| Variable | Description |
|----------|-------------|
| `$CLAUDE_PROJECT_DIR` | Project root where the session started |
| `$CLAUDE_PLUGIN_ROOT` | Plugin installation directory (plugin hooks) |
| `$CLAUDE_PLUGIN_DATA` | Plugin persistent data directory (plugin hooks) |
| `$CLAUDE_PLUGIN_OPTION_<KEY>` | Plugin `userConfig` values |
| `$CLAUDE_ENV_FILE` | SessionStart, CwdChanged, FileChanged: file to persist env vars for later Bash commands |
| `$CLAUDE_EFFORT` | Current effort level |
| `$CLAUDE_CODE_REMOTE` | `"true"` in remote web environments |

There is no session-ID env var for hooks: read `session_id` from stdin. Hook processes inherit the parent environment (minus `OTEL_*` exporter variables).

### 3.9 Matcher Syntax

| Matcher value | Evaluated as |
|---------------|--------------|
| `"*"`, `""`, or omitted | Match all |
| Only letters, digits, `_`, `-`, spaces, `,`, `\|` | Exact string, or a list of exact strings split on `\|` or `,` |
| Any other character | JavaScript regex, unanchored (`RegExp.test`) |

```
"Bash"              → exact
"Edit|Write"        → exact list
"mcp__github__.*"   → regex: every GitHub MCP tool
"mcp__github"       → exact string: matches no tool (add .*)
```

MCP tools are `mcp__<server>__<tool>`; plugin servers are `mcp__plugin_<plugin>_<server>__<tool>`. `FileChanged` and `StopFailure` treat `-`, space and `,` as regex characters.

### 3.10 HTTP Hook Details

```json
{
  "type": "http",
  "url": "https://audit.example.com/logs",
  "headers": { "Authorization": "Bearer $MY_TOKEN" },
  "allowedEnvVars": ["MY_TOKEN"]
}
```

- POST, `Content-Type: application/json`, body = the hook's JSON input; default timeout 600s
- Only vars in `allowedEnvVars` are interpolated in headers; others become empty strings
- To block or deny: return 2xx with a JSON body carrying the decision fields
- 2xx empty = success; 2xx non-JSON, non-2xx, connection failure = non-blocking error (`onFailure: "block"` changes that)

### 3.11 Disabling Hooks

```json
{ "disableAllHooks": true }
```

Resolved through settings precedence; outside managed settings it can't disable managed hooks. Managed `allowManagedHooksOnly: true` blocks user, project, local and plugin hooks (except plugins force-enabled in managed `enabledPlugins`).

Sources: [Hooks reference](https://code.claude.com/docs/en/hooks) · [Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide)

---

## 4. Subagents

### 4.1 File Format

**Location**: `.claude/agents/<name>.md` (project), `~/.claude/agents/<name>.md` (user), plugin `agents/` (recursive; subfolders become part of the name, e.g. `my-plugin:review:security`).

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

| Field | Required | Description |
|-------|:--------:|-------------|
| `name` | Yes | Unique identifier ≤ 256 chars, no `:`. Hooks see it as `agent_type` |
| `description` | Yes | When Claude should delegate to this agent |
| `tools` | No | Allowlist (string or list). Omitted = every tool available to subagents |
| `disallowedTools` | No | Denylist, removed from inherited or listed tools |
| `model` | No | `sonnet`, `opus`, `haiku`, `fable`, a full model ID (e.g. `claude-opus-5-5`), or `inherit`. Omitted = subagent model order |
| `permissionMode` | No | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` (`manual` = `default`) |
| `maxTurns` | No | Max agentic turns; output returned marked partial |
| `autoCompactWindow` | No | Lower auto-compact window, 100000–1000000 tokens |
| `skills` | No | Skills whose full content is preloaded at startup |
| `mcpServers` | No | Server names or inline configs |
| `hooks` | No | Lifecycle hooks scoped to this agent |
| `memory` | No | `user`, `project`, or `local` |
| `background` | No | `true` keeps it in the background even when Claude asks to wait |
| `omitClaudeMd` | No | `true` skips user/project/local CLAUDE.md at startup |
| `effort` | No | `low`, `medium`, `high`, `xhigh`, `max` |
| `isolation` | No | `worktree` for a temporary git worktree (cleaned up if unchanged) |
| `color` | No | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
| `initialPrompt` | No | First user turn when run as the main agent (`--agent` / `agent` setting) |
| `experimental` | No | `cacheTtl`: `5m` or `1h` |

**Plugin agents ignore** `hooks`, `mcpServers`, `permissionMode` and `initialPrompt`. Ship hooks in `hooks/hooks.json` and servers in `.mcp.json` instead. An agent file whose frontmatter doesn't parse still loads, with every field ignored.

### 4.3 Built-in Subagent Types

| Type | Model | Tools | Purpose |
|------|-------|-------|---------|
| `Explore` | Main conversation's model (Opus when the main model is Fable, on most providers) | Read-only (Write/Edit denied) | Codebase search and exploration |
| `Plan` | Inherited | Read-only (Write/Edit denied) | Research during plan mode |
| `general-purpose` | `CLAUDE_CODE_SUBAGENT_MODEL` if set, else main model | All subagent tools | Complex multi-step tasks |
| `claude` | Model order | All subagent tools | Catch-all |
| `statusline-setup` | Sonnet | — | `/statusline` setup |
| `claude-code-guide` | Haiku | — | Questions about Claude Code |

Explore and Plan skip CLAUDE.md and the git status snapshot at startup.

### 4.4 Tool Access Control

**Allowlist** (agent can ONLY use listed tools):
```yaml
tools: Read, Grep, Glob, Bash
```

**Denylist** (remove from inherited set; a specifier still removes the whole tool):
```yaml
disallowedTools: Write, Edit
```

**Restrict spawnable subagents** (only for an agent running as the main thread with `claude --agent`; ignored in a subagent definition):
```yaml
tools: Agent(worker, researcher), Read, Bash
```

### 4.5 Agent Priority

When multiple agents share a name:

1. Managed settings (highest)
2. CLI `--agents` flag
3. Project `.claude/agents/` (closest to the working directory wins)
4. User `~/.claude/agents/`
5. Plugin `agents/` directory (lowest)

### 4.6 Memory

```yaml
memory: project
```

| Scope | Location | Version-controlled |
|-------|----------|:-:|
| `user` | `~/.claude/agent-memory/<name>/` | No |
| `project` | `.claude/agent-memory/<name>/` | Yes |
| `local` | `.claude/agent-memory-local/<name>/` | No |

The first 200 lines or 25 KB of `MEMORY.md` (whichever comes first) go into the system prompt. Read/Write/Edit are auto-enabled for memory files. No effect when auto memory is off.

### 4.7 Foreground vs Background

**Background** (default for subagents Claude spawns from the main conversation): runs concurrently. A tool call needing permission surfaces a prompt in the main session naming the subagent; Esc denies that one call. `CLAUDE_CODE_FORK_SUBAGENT=0` makes Claude wait instead.

**Foreground**: blocks the main conversation; permission prompts pass through. Ctrl+B lets you keep working while Claude waits.

### 4.8 Limitations and Behavior

- Nesting: a subagent can spawn subagents up to 3 layers below the main conversation (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; `1` disables nesting). Remove `Agent` from `tools` to stop one agent spawning
- Each subagent starts with a fresh context: no conversation history, invoked skills or files already read
- Live reload: edits to files in `~/.claude/agents/` and `.claude/agents/` apply to the next delegation without restart. Restart is still needed for a scope's first agent file in a new `agents` directory, for `--add-dir` agents, and with `--disable-slash-commands`
- Plugin agents load from the cache copy, so `../` paths outside the plugin don't work

### 4.9 CLI Invocation

```bash
# Define agents for a session
claude --agents '{
  "reviewer": {
    "description": "Code reviewer",
    "prompt": "Review the changed files for correctness and security.",
    "tools": ["Read", "Grep", "Glob"],
    "model": "sonnet"
  }
}'
```

`--agents` accepts `prompt` plus the frontmatter fields except `color` and `experimental` (ignored). `/agents` now prints a reminder to edit the agents directories directly (it was a wizard through v2.1.197).

Sources: [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [Plugin agents](https://code.claude.com/docs/en/plugins/components#agents)

---

## Sources

### Plugins
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) (serves the manifest reference)
- [Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference)
- [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference)
- [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace)
- [Add components to a plugin](https://code.claude.com/docs/en/plugins/components)
- [Plugin loading reference](https://code.claude.com/docs/en/plugins/loading)

### Skills
- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Agent Skills specification](https://agentskills.io/specification)

### Hooks
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide)

### Subagents
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Subagents in the SDK](https://platform.claude.com/docs/en/agent-sdk/subagents)
