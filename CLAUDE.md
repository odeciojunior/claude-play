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
    agents/
      <agent-name>.md            # Subagent definitions (optional)
    skills/
      <skill-name>/SKILL.md
    scripts/
      <script>.sh                # Setup/utility scripts (optional)
    README.md
  _template/                # Starter template for contributors
docs/
  plans/                    # Design docs and implementation plans
  reports/                  # Deep research reports
```

## Plugins

| Plugin | Description | Category |
|--------|-------------|----------|
| productivity-tools | Research, analysis, planning, diagramming, visual whiteboarding, and system health skills | productivity |
| marketplace-tools | Maintainer scaffolding and validation | developer-tools |
| sql-server-tools | SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents | developer-tools |
| mcp-sql-server | Automated MCP SQL Server setup — connects Claude Code to SQL Server databases | developer-tools |

## Design Docs

Plans and research in `docs/plans/`:
- `2026-03-02-plugin-marketplace-design.md` — Marketplace architecture research (trust tiers, security, registry API)
- `2026-03-02-plugin-marketplace-plan.md` — Implementation plan (v1.0 → v2.0 roadmap)
- `2026-03-02-system-health-check-*.md` — First plugin design & baseline
- `2026-03-04-productivity-tools-*.md` — Productivity tools plugin design & implementation plan
- `2026-03-04-marketplace-tools-*.md` — Marketplace tools plugin design & implementation plan
- `2026-03-04-excalidraw-skill-*.md` — Excalidraw designer skill design, research & implementation plan
- `2026-03-04-hooks-*.md` — Hook system design & implementation plan (protect-template, validate-marketplace-json)
- `2026-03-04-plugin-reviewer-*.md` — Plugin reviewer agent design & implementation plan
- `2026-03-06-sql-server-tools-*.md` — SQL Server tools plugin design, implementation plan & validation
- `2026-03-06-mcp-sql-server-*.md` — MCP SQL Server plugin design & implementation plan

## Plugin Conventions

- Plugin dir name = `plugin.json` `name` field (kebab-case)
- Required `plugin.json` fields: `name`, `description`, `version`, `author`, `license`, `keywords`
- Skills live at `plugins/<name>/skills/<skill-name>/SKILL.md`
- Marketplace catalog: `.claude-plugin/marketplace.json` — update when adding/removing plugins
- When adding a plugin, also update: repo `README.md` (plugins table) and repo `CLAUDE.md` (plugins table, design docs)
- Architecture diagrams at `docs/diagrams/repo-architecture.{md,excalidraw}` — update when adding/removing plugins

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
