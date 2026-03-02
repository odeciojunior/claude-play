# Plugin Marketplace Design

## Purpose

Turn claude-play into a community-driven Claude Code plugin marketplace. Users register the repo as a marketplace source and install plugins via the standard Claude Code CLI.

## Decisions

- **Monorepo approach**: All plugins live in this repo under `plugins/`. Contributors submit via PR.
- **Claude Code-native**: Uses the standard `marketplace.json` format — no custom tooling needed.
- **Open contributions**: Anyone can submit plugins via PR with guidelines and a template.
- **Full spectrum**: Plugins can contain skills, hooks, agents, MCP servers, LSP servers.

## User Experience

```bash
# Add the marketplace (one-time)
claude plugin marketplace add odeciojunior/claude-play

# Install a plugin
claude plugin install system-health-check@claude-play
```

## Repository Structure

```
claude-play/
  .claude-plugin/
    marketplace.json              # Plugin catalog (Claude Code reads this)
  plugins/
    system-health-check/          # Existing plugin
      .claude-plugin/plugin.json
      skills/
        system-health-check/SKILL.md
    _template/                    # Starter template (not listed in marketplace)
      .claude-plugin/plugin.json
      skills/
        example-skill/SKILL.md
      README.md
  docs/
    plans/
  .github/
    PULL_REQUEST_TEMPLATE.md
  CONTRIBUTING.md
  CLAUDE.md
  LICENSE
  README.md
```

## marketplace.json

```json
{
  "name": "claude-play",
  "owner": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "metadata": {
    "description": "Community-driven Claude Code plugin marketplace",
    "version": "1.0.0",
    "pluginRoot": "./plugins"
  },
  "plugins": [
    {
      "name": "system-health-check",
      "source": "./system-health-check",
      "description": "On-demand WSL system health check with OK/WARN/CRITICAL status summaries",
      "version": "1.0.0",
      "author": {
        "name": "Odecio Machado",
        "email": "odeciojunior@gmail.com"
      },
      "license": "MIT",
      "keywords": ["health", "system", "wsl", "monitoring", "diagnostics"],
      "category": "system",
      "tags": ["wsl", "devops"]
    }
  ]
}
```

`pluginRoot: "./plugins"` means `"source": "./system-health-check"` resolves to `plugins/system-health-check/`.

## Contribution Workflow

### For contributors

1. Copy `plugins/_template/` to `plugins/<plugin-name>/`
2. Edit `plugin.json` — name, description, author, keywords
3. Add skills/hooks/agents/MCP servers as needed
4. Add `README.md` documenting the plugin
5. Open PR using the provided template

### For maintainers

1. Review PR — check quality, security, no malicious code
2. Add plugin entry to `marketplace.json`
3. Merge

### PR checklist

- Valid `plugin.json` with all required fields
- Plugin directory name matches `plugin.json` name
- Skills have clear trigger descriptions
- README.md documents usage and prerequisites
- No hardcoded absolute paths (use `${CLAUDE_PLUGIN_ROOT}`)
- No sensitive data (API keys, credentials)
- License declared

## Plugin Template

`_template/.claude-plugin/plugin.json`:
```json
{
  "name": "your-plugin-name",
  "description": "Brief description of what the plugin does",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "your@email.com"
  },
  "license": "MIT",
  "keywords": []
}
```

`_template/skills/example-skill/SKILL.md`:
```markdown
---
name: example-skill
description: Brief description of the skill
---

# Example Skill

Replace this with your skill instructions.
```

`_template/README.md`:
```markdown
# Plugin Name

What it does, how to use it, any prerequisites.
```

## Documentation

### README.md

1. Title + tagline
2. Quick install (2 commands)
3. Available plugins table (name, description, category, version)
4. How to contribute (link to CONTRIBUTING.md)
5. License

### CONTRIBUTING.md

1. Prerequisites (Claude Code installed)
2. Step-by-step submission guide
3. Plugin guidelines (naming, quality, what's accepted)
4. Review process

### CLAUDE.md

Updated with marketplace name, install instructions, plugin list, and contribution workflow.

## What's Not Included (YAGNI)

- No web UI, ratings, or reviews — Claude Code CLI handles discovery
- No CI validation pipeline — add later if contribution volume warrants it
- No automated marketplace.json updates — maintainer adds entries manually
- No categories taxonomy — let categories emerge organically from submissions
- No plugin versioning beyond what plugin.json declares
