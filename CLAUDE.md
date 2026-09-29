# CLAUDE.md

Community-driven Claude Code plugin marketplace. Users register this repo as a marketplace source and install plugins via the standard Claude Code CLI.

## Quick Reference

```bash
# Add marketplace
claude plugin marketplace add odeciojunior/claude-play

# Install a plugin
claude plugin install <plugin-name>@claude-play

# Validate (official CLI) — run before committing
claude plugin validate .                       # marketplace.json
claude plugin validate plugins/<plugin-name>   # one plugin manifest

# Try a plugin locally without installing
claude --plugin-dir ./plugins/<plugin-name>
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
      <skill-name>/references/*.md  # On-demand detail loaded by SKILL.md (optional)
    scripts/
      <script>.sh                # Setup/utility scripts (optional)
    README.md
  _template/                # Starter template for contributors
docs/
  plans/                    # Design docs and implementation plans
  reports/                  # Deep research reports
  diagrams/                 # repo-architecture.{md,excalidraw}
  claude-code-extensibility-reference.md  # Spec digest: plugin/skill/hook/agent formats
.github/PULL_REQUEST_TEMPLATE.md
.claude/
  agents/                   # Repo-local agents (not shipped in plugins)
  hooks/                    # protect-template, validate-marketplace-json
  settings.json             # Hook wiring
```

## Plugins

| Plugin | Description | Components | Category |
|--------|-------------|------------|----------|
| productivity-tools | Research, analysis, planning, diagramming, visual whiteboarding, and system health skills | skills: deep-researcher, report-analyzer, roadmap-planner, plan-coordinator, mermaid-designer, excalidraw-designer, wsl-health-check | productivity |
| marketplace-tools | Maintainer scaffolding and validation | skills: new-plugin, validate-plugin | developer-tools |
| sql-server-tools | SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents | skill: sql-server-toolkit; 5 agents | developer-tools |
| mcp-sql-server | Automated MCP SQL Server setup — connects Claude Code to SQL Server databases | skill: mcp-sql-server-setup; `scripts/setup.sh` | developer-tools |

## Design Docs

Plans in `docs/plans/`, research in `docs/reports/`:
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
- `2026-03-10-mcp-sql-server-setup-hardening-*.md` — setup.sh hardening design & plan
- `2026-03-11-mcp-sql-server-3scope-plan.md` — 3-scope registration model (project-private, project-shared, user-global)
- `2026-09-29-plan-coordinator-v2-design.md` — plan-coordinator v2: complexity-based model routing, conflict-free waves, shared-brief context handoffs

## Plugin Conventions

- Plugin dir name = `plugin.json` `name` field (kebab-case)
- Required `plugin.json` fields: `name`, `description`, `version`, `author`, `license`, `keywords`
- Skills live at `plugins/<name>/skills/<skill-name>/SKILL.md`
- Marketplace catalog: `.claude-plugin/marketplace.json` — update when adding/removing plugins
- When adding a plugin, also update: repo `README.md` (plugins table) and repo `CLAUDE.md` (plugins table, design docs)
- Architecture diagrams at `docs/diagrams/repo-architecture.{md,excalidraw}` — update when adding/removing plugins
- Version lives in three places — bump `plugins/<name>/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and the root `README.md` plugins table together
- SKILL.md frontmatter allows only `name`, `description`, `disable-model-invocation`, `user-invokable`, `argument-hint`, `compatibility`, `license`, `metadata` — no `model`/`context`/`allowed-tools`; skills run in the main conversation, so don't write them as tool-restricted forked agents
- `mcp-sql-server` `setup.sh install-venv` targets `~/.claude/mcp-servers/mcp-sql-server/.venv` (non-editable, from git HEAD), never a local checkout
- No CI in this repo: before committing run `claude plugin validate` (marketplace + changed plugins), the `marketplace-tools` `validate-plugin` skill (repo conventions: frontmatter keys, abs paths, secrets), and the marketplace hook
- Run the marketplace hook by hand: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | bash .claude/hooks/validate-marketplace-json.sh` — it always exits 0; no output = pass, `{"decision":"block",...}` on stdout = fail. Both hooks need `jq`
- Test a skill change behaviorally: have a subagent follow it literally on a real input (e.g. a plan in `docs/plans/`), writing output to the scratchpad and listing every ambiguity it hit, then run a read-only adversarial review
- Installed plugins resolve from `~/.claude/plugins/cache/claude-play/<plugin>/<version>/`; without a version bump an edit never reaches an installed copy

## Hooks

Configured in `.claude/settings.json`:

| Hook | Type | Trigger | Description |
|------|------|---------|-------------|
| protect-template | PreToolUse | Edit\|Write | Blocks modifications to `plugins/_template/` |
| validate-marketplace-json | PostToolUse | Edit\|Write | Validates marketplace.json schema after edits |

## Agents

| Agent | Trigger | Description |
|-------|---------|-------------|
| plugin-reviewer | "review plugin X" | Repo-local (`.claude/agents/`), not shipped in a plugin: 3-phase structural/content/security review |

Shipped agents live in the plugin that provides them — currently only `sql-server-tools/agents/` (5 SQL Server specialists).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributors copy `plugins/_template/`, add their plugin, and open a PR.

## Marketplace Name

`claude-play` — used in install commands: `claude plugin install <name>@claude-play`
