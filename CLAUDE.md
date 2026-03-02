# CLAUDE.md

Community-driven Claude Code plugin marketplace. Users register this repo as a marketplace source and install plugins via the standard Claude Code CLI.

## Quick Reference

```bash
# Add marketplace
claude plugin marketplace add odeciojunior/claude-play

# Install a plugin
claude plugin install <plugin-name>@claude-play
```

## Structure

```
.claude-plugin/
  marketplace.json          # Plugin catalog (Claude Code reads this)
plugins/
  <plugin-name>/
    .claude-plugin/plugin.json
    skills/
      <skill-name>/SKILL.md
    README.md
  _template/                # Starter template for contributors
docs/
  plans/                    # Design docs and implementation plans
```

## Plugins

| Plugin | Description | Category |
|--------|-------------|----------|
| system-health-check | On-demand WSL system health check with OK/WARN/CRITICAL status | system |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributors copy `plugins/_template/`, add their plugin, and open a PR.

## Marketplace Name

`claude-play` — used in install commands: `claude plugin install <name>@claude-play`
