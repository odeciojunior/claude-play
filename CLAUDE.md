# CLAUDE.md

<!-- agents-md:inicio -->
## AGENTS.md e CLAUDE.md

Cada `AGENTS.md` deste repositório é um link simbólico relativo para o `CLAUDE.md` da mesma pasta. Outros agentes (Antigravity, Codex e afins) leem o `AGENTS.md`, o Claude Code lê o `CLAUDE.md`, e os dois são o mesmo arquivo. Vale para a sessão principal e para todo subagent:

- Edite sempre o `CLAUDE.md`, nunca o `AGENTS.md`. Um editor que grava por arquivo temporário troca o link por um arquivo comum, e os dois passam a divergir em silêncio.
- Não apague, copie nem recrie `AGENTS.md` à mão. Para criar, conferir ou reparar os links, use o skill global `sync-agents-md`.
- Ao criar um `CLAUDE.md` numa subpasta, rode o skill para gerar o `AGENTS.md` dela.
- No git, o `AGENTS.md` fica com modo `120000` (symlink), com `core.symlinks=true` no `.git/config`.
- Mantenha cada `CLAUDE.md` abaixo de 24 KB e de 200 linhas: o Antigravity trunca acima de 24 KB, e o Claude Code recomenda menos de 200 linhas. Para medir e decidir o que distribuir por pastas, use a análise de saúde do mesmo skill.
<!-- agents-md:fim -->

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

- `plugins/<name>/.claude-plugin/plugin.json`: directory name = plugin name (kebab-case); required keys `name`, `description`, `version`, `author`, `license`, `keywords`.
- `plugins/productivity-tools/{lib,scripts}/`: module and embed map in `.claude/rules/workflows-and-lib.md`.
- `.claude/agents/plugin-reviewer.md`: repo-local reviewer ("review plugin X"); hooks in `.claude/rules/hooks.md`.
- `docs/claude-code-extensibility-reference.md`: spec digest of plugin, skill, hook and agent formats.
- `tools/measure/`: not shipped; rules in `.claude/rules/measure.md`.

Human table: `README.md`. Adding/removing a plugin updates `marketplace.json`, `README.md`, and `docs/diagrams/repo-architecture.{md,excalidraw}` (validate `.excalidraw`).

## Windows

- Build Windows paths/JSON containing `\` in code (`String.fromCharCode(92)` or `path.win32.join`) instead of shell/bash argv or heredocs, which collapse backslashes before Node reads them.
- `core.autocrlf=true` checks out CRLF. `.gitattributes` keeps `*.sh` and `tools/measure/{scenario,arms}/**` LF and pins the CRLF trigger fixture to CRLF; verify via `git ls-files --eol`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): copy `plugins/_template/`, add the plugin, open a PR against `main`.
