# CLAUDE.md

Claude Code plugin marketplace (`claude-play`). Install plugins with `claude plugin install <plugin>@claude-play`.

## Rules that matter

- **Bump versions in two places at release/publication (not feature branches — DEC-042 in `.claude/rules/roadmap-checker.md`)**: `plugins/<name>/.claude-plugin/plugin.json` (authoritative) and root `README.md` table (no `version` in `.claude-plugin/marketplace.json`). Cache: `~/.claude/plugins/cache/claude-play/<plugin>/<version>/`.
- **Frontmatter (`lint-plugin.mjs` is authoritative)**: plugin agents allow 15 repo-policy keys (`hooks`, `mcpServers`, `permissionMode`, `initialPrompt`, unlisted keys fail); `SKILL.md` uses 8 portable keys except DEC-049/DEC-275 (`plugins/productivity-tools/skills/roadmap-release/SKILL.md`: `allowed-tools: Workflow(productivity-tools:release-workflow)` + `disable-model-invocation: true`); workflow-referencing skills require semver `compatibility`.
- **Never edit `plugins/_template/`** (`protect-template` hook); copy it for new plugins.
- **No CI — verify directly:**
  - `claude plugin validate .` and `claude plugin validate plugins/<name>` — manifests, MCP entries, frontmatter parsing (not key allowlists/policy).
  - `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/<name>` — CLI behind `/marketplace-tools:validate-plugin`.
  - `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` — unit tests (quoted recursive globs need Node >= 20.11; `check-roadmap.mjs` stays Node >= 18).
  - `node plugins/sql-server-tools/scripts/check-queries.mjs` — mandatory after `plugins/sql-server-tools/references/*.md` edits (`node --test` skips live packs).
  - `node plugins/productivity-tools/scripts/embed.mjs --check <targets...>` — after `plugins/productivity-tools/lib/` edits (`.claude/rules/workflows-and-lib.md`).
  - `node plugins/productivity-tools/skills/excalidraw-designer/scripts/validate-excalidraw.mjs docs/diagrams/repo-architecture.excalidraw` — after Excalidraw diagram edits.
- **Path-scoped rules** in `.claude/rules/` load automatically via `paths:` frontmatter on matching reads/edits.

## Publish an update

Explicit owner authorization is required before pushing or tagging.

1. Prepare verified rollback branch (`volta/<plugin>-<next-patch>`); on release branch, bump `check-roadmap.mjs` line 1 if changed (DEC-042) and both version places before advancing `main`.
2. Advance `main`, then (owner-authorized) tag and push.
3. Update locally: `claude plugin marketplace update claude-play`, `claude plugin update <plugin>@claude-play`, `/reload-plugins` (or restart).
4. Verify `~/.claude/plugins/cache/claude-play/<plugin>/<new version>/` (old folders linger 14 days; don't debug against them).

Dev loop (no bump): `claude plugin marketplace add <local path to this repo>` + `/reload-plugins`.
Commits: `type(scope): description` (`feat`, `fix`, `docs`, `chore`).

## Layout

```
.claude-plugin/marketplace.json  # Catalog & categories (no version)
plugins/<name>/
  .claude-plugin/plugin.json  # Kebab-case dir=name; required: name, description, version, author, license, keywords
  skills/<skill>/  # SKILL.md, references/, scripts/, workflow/
  agents/<agent>.md  # Shipped subagents (sql-server-tools, productivity-tools)
  references/  # Plugin-root reference packs (sql-server-tools)
  lib/  # Pure modules; .claude/rules/workflows-and-lib.md (productivity-tools module/embed map)
  scripts/  # CLI/setup/check scripts; .claude/rules/workflows-and-lib.md
plugins/_template/  # Protected starter template
.claude/agents/plugin-reviewer.md  # Repo-local reviewer: "review plugin X"
.claude/hooks/*.mjs  # Wired in .claude/settings.json
.claude/rules/*.md  # Path-scoped rules
docs/plans/  # Designs, plans, roadmap-<topic>/, <topic>-E<n>/
docs/releases/  # Published release notes
docs/reports/  # Research reports
docs/diagrams/repo-architecture.{md,excalidraw}
docs/claude-code-extensibility-reference.md  # Spec digest: plugin/skill/hook/agent formats
tools/measure/  # Not shipped; .claude/rules/measure.md (--work/--out/paid-run rules)
```

Human table: `README.md`. Adding/removing a plugin updates `marketplace.json`, `README.md`, and `docs/diagrams/repo-architecture.{md,excalidraw}` (validate `.excalidraw`).

## Hooks

Node >= 18:

- `protect-template.mjs` (PreToolUse, `Edit|MultiEdit|Write|NotebookEdit`): exit 2 blocks `plugins/_template/` edits (normalizes `\`, case, `..`); shell commands unguarded.
- `validate-marketplace-json.mjs` (PostToolUse, same matcher): runs 9 checks on `marketplace.json` (incl. `plugin.json` sync, no entry `version`); prints `{"decision":"block","reason":...}` on fail/error (no output = pass). Test: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | node .claude/hooks/validate-marketplace-json.mjs`.

## Windows

- Build Windows paths/JSON containing `\` in code (`String.fromCharCode(92)` or `path.win32.join`) instead of shell/bash argv or heredocs, which collapse backslashes before Node reads them.
- `core.autocrlf=true` checks out CRLF. `.gitattributes` keeps `*.sh` and `tools/measure/{scenario,arms}/**` LF and pins the CRLF trigger fixture to CRLF; verify via `git ls-files --eol`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): copy `plugins/_template/`, add the plugin, open a PR against `main`.
