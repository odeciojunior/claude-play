# Contributing to claude-play

Thanks for your interest in contributing a plugin to the claude-play marketplace!

## Prerequisites

- [Claude Code](https://claude.ai/code) installed
- Git and a GitHub account
- Familiarity with Claude Code plugins ([docs](https://docs.anthropic.com/en/docs/claude-code/plugins))

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

### 3. Add your skills, hooks, or agents

- **Skills**: Add `SKILL.md` files under `skills/<skill-name>/SKILL.md`
- **Hooks**: Add a `hooks/hooks.json` file
- **Agents**: Add agent definitions under `agents/`
- **MCP Servers**: Add `.mcp.json` configuration

Each skill needs a YAML frontmatter with `name` and `description` fields. The description should clearly state when the skill triggers.

### 4. Write your README

Update `plugins/your-plugin-name/README.md` with:
- What the plugin does
- Installation instructions
- Skill/hook descriptions
- Any prerequisites

### 5. Open a pull request

Push your branch and open a PR against `main`. The PR template will guide you through the checklist.

## Plugin Guidelines

### Naming
- Use kebab-case: `my-plugin-name`
- Directory name must match `plugin.json` `name` field
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
3. Once approved, the maintainer adds your plugin to `marketplace.json` and merges
