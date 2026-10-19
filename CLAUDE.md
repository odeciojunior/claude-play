# CLAUDE.md

Claude Code plugin marketplace (`claude-play`). Users add this repo as a marketplace source and install plugins with the standard CLI: `claude plugin install <plugin>@claude-play`.

## Rules that matter

- **Bump the version in three places together**: `plugins/<name>/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and the root `README.md` plugins table. Installed copies resolve from `~/.claude/plugins/cache/claude-play/<plugin>/<version>/`, so an edit without a bump never reaches users.
- **SKILL.md frontmatter allows only** `name`, `description`, `disable-model-invocation`, `user-invokable`, `argument-hint`, `compatibility`, `license`, `metadata`. No `model`/`context`/`allowed-tools`: skills run in the main conversation, so don't write them as tool-restricted forked agents.
- **Never edit `plugins/_template/`** (the `protect-template` hook blocks it); contributors copy it to a new plugin directory.
- **No CI.** Before committing run `claude plugin validate .` (marketplace) and `claude plugin validate plugins/<name>` for each changed plugin.
- Path-specific rules load from `.claude/rules/` when you touch those files: skills, the roadmap checker, mcp-sql-server.

## Publish an update

1. Bump the version (three places), commit on a feature branch, fast-forward or merge into `main`, `git push origin main`.
2. `claude plugin marketplace update claude-play`, then `claude plugin update <plugin>@claude-play`.
3. Check that `~/.claude/plugins/cache/claude-play/<plugin>/<new version>/` exists. Older version folders linger there; don't debug against them.

Commits use `type(scope): description` (`feat`, `fix`, `docs`, `chore`).

## Layout

```
.claude-plugin/marketplace.json     # Plugin catalog: source of truth for plugins, versions, categories
plugins/<name>/
  .claude-plugin/plugin.json        # Dir name = plugin name (kebab-case); required: name, description, version, author, license, keywords
  skills/<skill>/SKILL.md           # + references/*.md loaded on demand
  agents/<agent>.md                 # Shipped subagents (today only sql-server-tools)
  scripts/                          # Setup/utility scripts
plugins/_template/                  # Starter template (protected)
.claude/agents/plugin-reviewer.md   # Repo-local agent, not shipped: "review plugin X"
.claude/hooks/*.mjs                 # Wired in .claude/settings.json
.claude/rules/*.md                  # Path-scoped rules
docs/plans/  docs/reports/          # Designs and plans (YYYY-MM-DD-<topic>-design|plan.md); research reports
docs/diagrams/repo-architecture.{md,excalidraw}
docs/claude-code-extensibility-reference.md   # Spec digest: plugin/skill/hook/agent formats
```

Human-facing plugin table: `README.md`. When adding or removing a plugin, update `marketplace.json`, `README.md` and both `docs/diagrams/repo-architecture` files.

## Hooks

Both are Node scripts (Node ≥18 is already required by the roadmap checker); they used to need `jq` and silently passed without it.

- `protect-template.mjs` (PreToolUse, Edit|Write): exit 2 blocks edits under `plugins/_template/` (Windows `\` paths and any case included).
- `validate-marketplace-json.mjs` (PostToolUse, Edit|Write): after an edit to `marketplace.json`, prints `{"decision":"block","reason":...}` when one of its 6 schema checks fails; no output = pass. Run it by hand: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | node .claude/hooks/validate-marketplace-json.mjs`.

## Windows

`core.autocrlf=true` checks text files out as CRLF. `.gitattributes` keeps `*.sh` LF everywhere; check with `git ls-files --eol`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): copy `plugins/_template/`, add the plugin, open a PR against `main`.
