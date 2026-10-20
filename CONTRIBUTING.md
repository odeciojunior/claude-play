# Contributing to claude-play

Thanks for your interest in contributing a plugin to the claude-play marketplace!

## Prerequisites

- [Claude Code](https://claude.ai/code) installed
- Git and a GitHub account
- Familiarity with Claude Code plugins ([docs](https://code.claude.com/docs/en/plugins))

## Submitting a Plugin

### 1. Fork and clone

```bash
git clone https://github.com/<your-username>/claude-play.git
cd claude-play
```

### 2. Create your plugin

Copy the template and rename it:

```bash
cp -r plugins/_template plugins/your-plugin-name
```

Edit `plugins/your-plugin-name/.claude-plugin/plugin.json`:
- Set `name` to match your directory name (kebab-case)
- Write a clear `description`
- Add your `author` info
- Add relevant `keywords`

The Claude Code spec requires only `name`. This repo additionally requires (repo policy) `description`, `version`, `author`, `license` and `keywords`.

### 3. Add your skills, hooks, or agents

- **Skills**: Add `SKILL.md` files under `skills/<skill-name>/SKILL.md`
- **Hooks**: Add a `hooks/hooks.json` file
- **Agents**: Add agent definitions under `agents/`
- **MCP Servers**: Add `.mcp.json` configuration

Each skill needs a YAML frontmatter with `name` and `description` fields. The description should clearly state when the skill triggers.

SKILL.md frontmatter policy (repo policy, stricter than the official spec):
- Allowed keys: `name`, `description`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `compatibility`, `license`, `metadata`.
- Other valid Claude Code fields such as `model`, `context` and `allowed-tools` aren't used in this repo.
- Claude Code ignores unknown keys silently, so check spelling (it is `user-invocable`).

Other format notes:
- `hooks/hooks.json` wraps events in a top-level object: `{"hooks": {"PreToolUse": [...]}}`.
- Plugin agents ignore `hooks`, `mcpServers`, `permissionMode` and `initialPrompt`; don't add them.

### 4. Write your README

Update `plugins/your-plugin-name/README.md` with:
- What the plugin does
- Installation instructions
- Skill/hook descriptions
- Any prerequisites

### 5. Open a pull request

Before opening the PR, run both checks:

```bash
claude plugin validate plugins/your-plugin-name   # manifests
```

and, inside Claude Code, `/marketplace-tools:validate-plugin your-plugin-name` (frontmatter, agents, structure, paths, secrets).

Push your branch and open a PR against `main`. The PR template will guide you through the checklist.

## Plugin Guidelines

### Naming
- Use kebab-case: `my-plugin-name`
- Directory name must match `plugin.json` `name` field
- The `marketplace.json` entry name must equal the `plugin.json` name
- Reserved names (`claude plugin validate` rejects them): the prefixes `claude-`, `anthropic-`, `anthropics-` and `cc-plugin-`; the exact names `claude`, `anthropic`, `anthropics`, `claude-code` and `claude-mods`; and names combining "official" with claude or anthropic
- Be descriptive but concise

### Quality
- Skills must have clear trigger descriptions in their YAML frontmatter
- Include a README with usage instructions
- No hardcoded absolute paths — use `${CLAUDE_PLUGIN_ROOT}` for paths relative to the plugin
- No sensitive data (API keys, credentials, tokens)

### What We Accept
- Skills that solve real problems for Claude Code users
- Hooks that automate common workflows
- MCP server integrations that add useful tool access
- Agents for specialized tasks

### What We Don't Accept
- Plugins that duplicate existing Claude Code functionality
- Plugins with malicious or destructive behavior
- Plugins that require proprietary dependencies without alternatives

## Review Process

1. A maintainer will review your PR for quality and security
2. If changes are needed, we'll leave comments on the PR
3. Once approved, the maintainer adds the plugin to `marketplace.json`, the root README table and both `docs/diagrams/repo-architecture.*` files, then merges
