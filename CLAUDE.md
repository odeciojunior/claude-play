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
| productivity-tools | Research, analysis, planning, diagramming, and system health skills | productivity |
| marketplace-tools | Maintainer scaffolding and validation | developer-tools |

## Design Docs

Plans and research in `docs/plans/`:
- `2026-03-02-plugin-marketplace-design.md` — Marketplace architecture research (trust tiers, security, registry API)
- `2026-03-02-plugin-marketplace-plan.md` — Implementation plan (v1.0 → v2.0 roadmap)
- `2026-03-02-system-health-check-*.md` — First plugin design & baseline
- `2026-03-04-productivity-tools-*.md` — Productivity tools plugin design & implementation plan
- `2026-03-04-marketplace-tools-*.md` — Marketplace tools plugin design & implementation plan

## Plugin Conventions

- Plugin dir name = `plugin.json` `name` field (kebab-case)
- Required `plugin.json` fields: `name`, `description`, `version`, `author`, `license`, `keywords`
- Skills live at `plugins/<name>/skills/<skill-name>/SKILL.md`
- Marketplace catalog: `.claude-plugin/marketplace.json` — update when adding/removing plugins

## Hooks

Configured in `.claude/settings.json`:

| Hook | Type | Trigger | Description |
|------|------|---------|-------------|
| protect-template | PreToolUse | Edit\|Write | Blocks modifications to `plugins/_template/` |
| validate-marketplace-json | PostToolUse | Edit\|Write | Validates marketplace.json schema after edits |

## Agents

| Agent | Trigger | Description |
|-------|---------|-------------|
| plugin-reviewer | "review plugin X" | 3-phase plugin review: structural, content quality, security/policy |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributors copy `plugins/_template/`, add their plugin, and open a PR.

## Marketplace Name

`claude-play` — used in install commands: `claude plugin install <name>@claude-play`
