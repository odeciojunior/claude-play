# CLAUDE.md

Claude Code plugin marketplace (`claude-play`). Users add this repo as a marketplace source and install plugins with the standard CLI: `claude plugin install <plugin>@claude-play`.

## Rules that matter

- **Bump the version in three places together**: `plugins/<name>/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and the root `README.md` plugins table. Installed copies resolve from `~/.claude/plugins/cache/claude-play/<plugin>/<version>/`, so an edit without a bump never reaches users.
- **SKILL.md frontmatter keys (repo policy):** `name`, `description`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `compatibility`, `license`, `metadata`. `model`/`context`/`agent`/`allowed-tools`/`paths`/`hooks` are valid Claude Code fields that we don't use, to keep skills portable and predictable. Unknown keys are ignored silently, so spelling matters.
- **Never edit `plugins/_template/`** (the `protect-template` hook blocks it); contributors copy it to a new plugin directory.
- **No CI.** Before committing run `claude plugin validate .` (marketplace) and `claude plugin validate plugins/<name>` for each changed plugin, and the tests: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"`. The validator checks manifests only; SKILL.md frontmatter and agent files are checked by the `marketplace-tools` `validate-plugin` skill (`lint-plugin.mjs`).
- Path-specific rules load from `.claude/rules/` when a matching file is read or edited: skills, the roadmap checker, mcp-sql-server.

## Publish an update

1. Bump the version (three places), commit on a feature branch, fast-forward or merge into `main`, `git push origin main`.
2. `claude plugin marketplace update claude-play`, then `claude plugin update <plugin>@claude-play`, then `/reload-plugins` (or restart).
3. Check that `~/.claude/plugins/cache/claude-play/<plugin>/<new version>/` exists. Older version folders linger for 14 days; don't debug against them.

Dev loop without a bump: `claude plugin marketplace add <local path to this repo>` loads plugins in place; `/reload-plugins` picks up edits. The bump matters for installs from GitHub.

Commits use `type(scope): description` (`feat`, `fix`, `docs`, `chore`).

## Layout

```
.claude-plugin/marketplace.json     # Plugin catalog: source of truth for plugins, versions, categories
plugins/<name>/
  .claude-plugin/plugin.json        # Dir name = plugin name (kebab-case); repo-required: name, description, version, author, license, keywords (the spec requires only name)
  skills/<skill>/SKILL.md           # + references/*.md loaded on demand
  agents/<agent>.md                 # Shipped subagents (today only sql-server-tools); plugin agents ignore hooks, mcpServers, permissionMode, initialPrompt
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

Both are Node scripts (Node ≥18 is already required by the roadmap checker).

- `protect-template.mjs` (PreToolUse, Edit|MultiEdit|Write|NotebookEdit): exit 2 blocks edits under `plugins/_template/` (Windows `\` paths, any case and `..` segments included). Shell commands are not guarded.
- `validate-marketplace-json.mjs` (PostToolUse, same matcher): after an edit to `marketplace.json`, prints `{"decision":"block","reason":...}` when one of its 9 checks fails (including entry name/version vs each `plugin.json`); an unexpected error also blocks; no output = pass. Run it by hand: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | node .claude/hooks/validate-marketplace-json.mjs`.

## Windows

`core.autocrlf=true` checks text files out as CRLF. `.gitattributes` keeps `*.sh` LF everywhere; check with `git ls-files --eol`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): copy `plugins/_template/`, add the plugin, open a PR against `main`.
