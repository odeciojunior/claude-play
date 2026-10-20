# Claude Code Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo the plan is run by `productivity-tools:plan-coordinator`.

**Goal:** Fix the guardrails, tooling, shipped skills and reference docs that diverge from the current official Claude Code docs, per the alignment audit and decisions D1–D5.

**Architecture:** Deterministic checks move into Node scripts with `node:test` suites (hooks, a new `lint-plugin.mjs`); skills keep judgment and call the scripts. Each plugin bump is its own task at the end of its group. D1 (version only in `plugin.json` + README) runs last, after `sql-server-tools` v1.1 is merged into `main`.

**Tech Stack:** Node ≥18 (ESM `.mjs`, `node:test`, no npm dependencies), Bash (Git Bash on Windows), Markdown skills/agents, `claude` CLI v2.1.304.

**Spec:** `docs/reports/2026-10-20-claude-code-alignment-audit.md` (items C1–C12, G1–G12, "Melhorias", decisions D1–D5).

## Global Constraints

- Work only in the worktree `D:\projects\claude-play\.claude\worktrees\docs-alignment`, branch `chore/claude-code-alignment`. Never touch the main checkout (another session works there on `feat/sql-server-tools-v1.1`). Never use bare `git stash`.
- Do not modify anything under `plugins/sql-server-tools/` (out of scope; v1.1 in progress elsewhere).
- Do not modify `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` (its line 1 version only changes with the checker).
- `plugins/_template/` changes only in Task 22, under the D3 authorization.
- Node ≥18, ESM, zero dependencies; tests use `node:test` + `node:assert/strict` and live next to the script as `*.test.mjs`. Build Windows paths in tests from code (`path.win32.join`, `String.fromCharCode(92)`), never shell-quoted backslashes.
- Text files check out CRLF (`core.autocrlf=true`): every parser must accept `\r\n`. `*.sh` stays LF (`.gitattributes`); verify with `git ls-files --eol <file>`.
- Skill, agent and reference text in English. SKILL.md < 500 lines; any reference > 100 lines starts with a `## Contents` list; references link only from SKILL.md (one level deep).
- SKILL.md frontmatter keys (repo policy): `name`, `description`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `compatibility`, `license`, `metadata`. The spelling is `user-invocable`.
- Until Task 24, a version bump touches three places together: `plugins/<name>/.claude-plugin/plugin.json`, the plugin's entry in `.claude-plugin/marketplace.json`, the root `README.md` table.
- Target versions: marketplace-tools `1.1.0`, mcp-sql-server `1.3.0`, productivity-tools `1.4.0`.
- Before each commit: `claude plugin validate .` and `claude plugin validate plugins/<name>` for each changed plugin; both print `✔ Validation passed`.
- Commits: `type(scope): description`, body optional, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `wsl` commands are blocked by the worktree isolation guard: anything that must run inside WSL is a Manual Action for the user.

## Review Focus

1. **Malformed JSON shapes reach the hooks** (`owner` as string, file `null`, `plugins` not an array, object `source`, missing `tool_input`): the hook must block with a reason, never crash with exit 1. Pinned in Task 1.
2. **CRLF frontmatter** (`---\r\n`) in SKILL.md and agent files: `lint-plugin.mjs` must parse it exactly like LF. Pinned in Task 5.
3. **Windows paths** (`C:\…\Plugins\_Template\x`, `..` segments, forward/back slash mix) in hook input: still blocked. Pinned in Task 2.
4. **`DB_PASSWORD` unset when Claude Code starts:** the setup skill must tell the user the symptom (`claude mcp list` warning, login failure) and the fix. Pinned in Task 11.
5. **Routing regressions after description rewrites:** phrases that triggered a skill before (e.g. "check if the machine is healthy", "draw a flowchart") still route to the right skill, and sibling skills no longer steal them. Pinned in Task 21.

---

## Group 1 — Guardrails (no version bump)

### Task 1: Marketplace hook blocks instead of crashing, and checks entries against plugin.json

**Files:**
- Modify: `.claude/hooks/validate-marketplace-json.mjs`
- Create: `.claude/hooks/validate-marketplace-json.test.mjs`

**Interfaces:**
- Produces: hook contract unchanged (stdin hook JSON → stdout `{"decision":"block","reason":…}` + exit 0 on failure; no output + exit 0 on pass). New checks 7–9 below. Task 24 removes `version` from check 5's required list and drops check 8's version branch.

- [ ] **Step 1: Write the failing tests** in `validate-marketplace-json.test.mjs`. Helper `runHook(marketplaceText, pluginJsons = {})` writes `<tmp>/.claude-plugin/marketplace.json` and `<tmp>/plugins/<name>/.claude-plugin/plugin.json`, spawns `node validate-marketplace-json.mjs` with stdin `{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}`, `cwd` and `CLAUDE_PROJECT_DIR` = tmp, returns `{ code, decision }`. Tests:
  - `owner as string blocks` → `code === 0`, `decision.decision === 'block'`, reason mentions `owner`
  - `null file blocks` → block
  - `plugins not an array blocks` → block
  - `object source blocks with a readable reason` → reason contains `source` and not `[object Object]`
  - `duplicate plugin names block` → reason contains `duplicate`
  - `entry name differs from plugin.json name blocks`
  - `entry version differs from plugin.json version blocks` (only when the entry has `version`)
  - `valid marketplace passes` → `code === 0`, no stdout
  - `non-marketplace file is ignored` (file_path `README.md`) → no stdout
  - `unparseable hook input blocks`
- [ ] **Step 2: Run** `node --test .claude/hooks/validate-marketplace-json.test.mjs` — Expected: the crash cases fail with exit 1, new-check cases fail.
- [ ] **Step 3: Implement.** Wrap everything after the file-path filter in `try { … } catch (e) { block(\`validate-marketplace-json: unexpected error (${e.message})\`) }`. Check 3 uses `m.owner && typeof m.owner === 'object'`. Check 6 reports non-string sources as `"<name>: source must be a ./plugins/ path string (repo policy)"`. Add check 7 (duplicate names), check 8 (for each local source, `plugins/<name>/.claude-plugin/plugin.json` exists and its `name` equals the entry `name`; when the entry has `version`, versions are equal), check 9 (entry name matches `^[a-z0-9][a-z0-9-]*$`). Label repo-only requirements in messages with `(repo policy)`. Update the header comment to list the 9 checks.
- [ ] **Step 4: Run** the tests — Expected: all pass. Then the CLAUDE.md smoke command from the worktree root: `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | node .claude/hooks/validate-marketplace-json.mjs` — Expected: no output.
- [ ] **Step 5: Commit** `fix(hooks): block on malformed marketplace.json instead of crashing; check entries against plugin.json`

### Task 2: Template guard covers every edit tool and normalised paths

**Files:**
- Modify: `.claude/hooks/protect-template.mjs`, `.claude/settings.json`
- Create: `.claude/hooks/protect-template.test.mjs`

**Interfaces:**
- Produces: exit 2 + stderr when the target resolves under `plugins/_template/`; exit 0 otherwise.

- [ ] **Step 1: Write the failing tests.** Helper `runGuard(toolInput)` spawns the hook with stdin `{"tool_input": toolInput}`. Tests: `blocks file_path under plugins/_template`, `blocks Windows path with backslashes and mixed case` (built with `path.win32.join('C:', 'repo', 'Plugins', '_Template', 'x.md')`), `blocks path with .. segments` (`plugins/x/../_template/f.md`), `blocks notebook_path`, `allows plugins/my-plugin/x.md`, `blocks on unparseable input`.
- [ ] **Step 2: Run** `node --test .claude/hooks/protect-template.test.mjs` — Expected: `..` and `notebook_path` cases FAIL.
- [ ] **Step 3: Implement.** Read `tool_input.file_path ?? tool_input.notebook_path ?? ''`; normalise with `path.posix.normalize(p.replace(/\\/g, '/')).toLowerCase()` before the `plugins/_template/` test. In `.claude/settings.json` set both matchers to `Edit|MultiEdit|Write|NotebookEdit`; keep the command strings as they are. No Bash guard: `cp -r plugins/_template plugins/<new>` is the documented way to start a plugin, and telling a source from a destination in arbitrary shell text is not reliable — say so in the hook's header comment.
- [ ] **Step 4: Run** the tests — Expected: all pass. Inline check (orchestrator, not a subagent): attempt an `Edit` on `plugins/_template/README.md` from this session — Expected: blocked with the BLOCKED message. If it is not blocked, stop and report (hooks may not fire on this Windows setup).
- [ ] **Step 5: Commit** `fix(hooks): template guard covers NotebookEdit/MultiEdit and normalised paths`

### Task 3: plugin-reviewer checks what it reports, with working patterns

**Files:**
- Modify: `.claude/agents/plugin-reviewer.md`

**Interfaces:**
- Consumes: frontmatter policy from Global Constraints. Output format keeps its sections; Phase 1 gains checks 8–9.

- [ ] **Step 1: Edit Phase 1.** Add **Check 8: Agent files valid (FAIL)** — every `plugins/<name>/agents/*.md` starts with `---` on line 1, has `name` and `description`, `name` has no `:`; a file failing this is silently skipped by Claude Code. Add **Check 9: No ignored plugin-agent fields (FAIL)** — `hooks`, `mcpServers`, `permissionMode`, `initialPrompt` are ignored for plugin agents. Update the "Run these 7 checks" count and the output template.
- [ ] **Step 2: Edit Phase 3.** Replace the destructive/exfiltration patterns with `curl[^\n]*\|\s*(ba)?sh`, `wget[^\n]*\|\s*(ba)?sh`, `\beval\b`, `\bexec\b`, `\bnc\b`, `\bnetcat\b`. Frontmatter bullet: list the repo-policy keys with `user-invocable`, and say `model`/`context`/`allowed-tools` are valid Claude Code fields that this repo does not use (policy, not schema). Define the **Tool permissions appropriate** check: for each shipped agent, `tools` is set, read-only agents carry no `Edit`/`Write`/`Bash`, and nothing grants an MCP wildcard.
- [ ] **Step 3: Verify.** `grep -n "user-invokable" .claude/agents/plugin-reviewer.md` — Expected: no output. `grep -nE "curl\.\*\|" .claude/agents/plugin-reviewer.md` — Expected: no output. File ≤ 200 lines.
- [ ] **Step 4: Behavioral test** (per `.claude/rules/skills.md`): a `general-purpose` subagent follows the edited file literally against `plugins/marketplace-tools/`, writes the review to the scratchpad and lists every ambiguity; then a read-only adversarial review of that output. Expected: all 9 Phase-1 checks reported, no false FLAG on the word "evaluate"/"execute".
- [ ] **Step 5: Commit** `fix(plugin-reviewer): working shell patterns, agent checks, user-invocable spelling`

### Task 4: CLAUDE.md states the real rules

**Files:**
- Modify: `CLAUDE.md` (lines 8, 10–11, 26, 28, 43)

- [ ] **Step 1: Edit.** Line 8 becomes repo policy: allowed keys as in Global Constraints (`user-invocable`), "`model`/`context`/`agent`/`allowed-tools`/`paths`/`hooks` are valid Claude Code fields that we don't use, to keep skills portable and predictable; unknown keys are ignored silently, so spelling matters". Line 10: `claude plugin validate` checks manifests only — frontmatter and agents are checked by `marketplace-tools` `validate-plugin` (`lint-plugin.mjs`). Line 11: rules "load when a matching file is read or edited". Line 26: "repo-required fields (the spec requires only `name`)". Layout comment for `agents/`: plugin agents ignore `hooks`, `mcpServers`, `permissionMode`. Line 43: delete "they used to need `jq`…". Publish steps: after `claude plugin update`, run `/reload-plugins` or restart; old version folders are removed after 14 days. Add a dev-loop line: `claude plugin marketplace add <local path>` + `/reload-plugins` loads edits without a bump (the bump matters for GitHub installs). Do **not** change the three-place bump rule (Task 24 does).
- [ ] **Step 2: Verify.** `grep -n "user-invokable" CLAUDE.md` — Expected: no output. File stays under 60 lines.
- [ ] **Step 3: Commit** `docs(claude-md): accurate frontmatter policy and validation scope`

## Group 2 — marketplace-tools 1.1.0

### Task 5: lint-plugin.mjs — deterministic structural checks

**Files:**
- Create: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`
- Create: `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`
- Create: `plugins/marketplace-tools/skills/validate-plugin/scripts/fixtures/valid/` (minimal plugin: `.claude-plugin/plugin.json`, `README.md`, `skills/demo/SKILL.md`, `agents/demo.md`) and a `fixtures/marketplace.json` that registers it.

**Interfaces:**
- Produces: CLI `node lint-plugin.mjs <plugin-dir> [--marketplace <path>]` (default marketplace `<plugin-dir>/../../.claude-plugin/marketplace.json`). Prints one line per finding `[OK]   <check>` / `[WARN] <check>: <detail>` / `[FAIL] <check>: <detail>`, then `Result: <n> OK, <n> WARN, <n> FAIL`. Exit 0 = no FAIL, 1 = any FAIL, 2 = usage error. Exports `lintPlugin(dir, { marketplace }) → { results: [{ level: 'OK'|'WARN'|'FAIL', check: string, detail?: string }] }` and `parseFrontmatter(text) → { keys: Map<string,string>, bodyStartLine: number } | null`.

Checks (level on failure):
1. dir name = `plugin.json` `name` (FAIL); name not prefixed `claude-`, `anthropic-`, `cc-plugin-` (FAIL)
2. repo-required `plugin.json` fields `name`, `description`, `version`, `author.name`, `author.email`, `license`, non-empty `keywords` (FAIL, message says "repo policy")
3. ≥1 SKILL.md; each has frontmatter with `name` and non-empty `description` (FAIL); `user-invokable` present (FAIL: "misspelled, Claude Code ignores it; use user-invocable"); other keys outside the allowlist (WARN, "repo policy"); `disable-model-invocation`/`user-invocable` not `true`/`false` (FAIL); `description` + `when_to_use` > 1,536 chars (WARN)
4. SKILL.md > 500 lines (WARN); `references/*.md` > 100 lines without a `## Contents` or `## Table of Contents` heading (WARN); a reference file linking another `references/*.md` (WARN, "keep references one level deep")
5. `agents/*.md`: line 1 `---`, `name` + `description`, `name` without `:` (FAIL); keys `hooks`, `mcpServers`, `permissionMode`, `initialPrompt` (FAIL, "ignored for plugin agents")
6. `hooks/hooks.json` (if present) parses and has a top-level `hooks` object (FAIL); `.mcp.json` (if present) parses (FAIL); `CLAUDE.md` at plugin root (WARN, "not loaded for plugins")
7. lines matching `(>|mkdir -p|cp [^\n]*)\s*"?\$\{CLAUDE_PLUGIN_ROOT\}` in scripts/skills (WARN, "plugin root changes on update; use ${CLAUDE_PLUGIN_DATA}")
8. README.md present with ≥10 chars (WARN); registered in marketplace with entry `name` equal and, when the entry has `version`, equal version (WARN if unregistered, FAIL if mismatched)

- [ ] **Step 1: Write the failing tests.** One test per check, each copying `fixtures/valid` to a tmp dir and applying one mutation; plus `valid fixture has 0 FAIL and 0 WARN`, `CRLF frontmatter parses like LF` (write the SKILL.md with `\r\n`), `parseFrontmatter returns null without leading ---`, `exit codes 0/1/2`.
- [ ] **Step 2: Run** `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `lint-plugin.mjs`. Frontmatter: top-level `^([A-Za-z0-9_-]+):\s*(.*)$` lines between the first two `---` lines (split on `/\r?\n/`); multi-line values (indented or `>-`/`|`) are joined for the length check. No YAML library.
- [ ] **Step 4: Run** the tests — Expected: all pass. Then `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/<p>` for marketplace-tools, mcp-sql-server, productivity-tools — Expected: exit 0; record every WARN in the step report (they feed Groups 3–4). Do not run it against sql-server-tools changes; a read-only run is fine for information.
- [ ] **Step 5: Commit** `feat(marketplace-tools): add lint-plugin script for frontmatter, agents and structure`

### Task 6: validate-plugin skill runs the official validator and the lint script

**Files:**
- Modify: `plugins/marketplace-tools/skills/validate-plugin/SKILL.md`

**Interfaces:**
- Consumes: `lint-plugin.mjs` CLI from Task 5.

- [ ] **Step 1: Rewrite the workflow.** Step 0 runs `claude plugin validate plugins/<name>` (report its output; FAIL if it fails). Step 1 runs `node "${CLAUDE_SKILL_DIR}/scripts/lint-plugin.mjs" plugins/<name>` and includes its lines verbatim. Keep as judgment checks (not in the script): hardcoded absolute paths and sensitive-data patterns (current checks 5–6). Remove the persona line and "Prefer dedicated tools…". State that `claude plugin validate` checks manifests only. Output format: validator line, lint lines, judgment lines, one `Result:` total.
- [ ] **Step 2: Verify.** `grep -n "user-invokable" plugins/marketplace-tools/skills/validate-plugin/SKILL.md` — Expected: no output. `node …/lint-plugin.mjs plugins/marketplace-tools` — Expected: exit 0.
- [ ] **Step 3: Behavioral test:** a subagent follows the SKILL.md literally on `plugins/productivity-tools`, output to scratchpad + ambiguity list, then a read-only adversarial review. Expected: the excalidraw 500-line WARN appears.
- [ ] **Step 4: Commit** `feat(validate-plugin): run claude plugin validate and lint-plugin; keep judgment checks`

### Task 7: new-plugin scaffolds everything the repo requires

**Files:**
- Modify: `plugins/marketplace-tools/skills/new-plugin/SKILL.md`

- [ ] **Step 1: Edit.** Step 1 also rejects names starting `claude-`, `anthropic-`, `cc-plugin-`. After Step 7 add: append a row to the root `README.md` plugins table, and add the plugin to `docs/diagrams/repo-architecture.md` and `docs/diagrams/repo-architecture.excalidraw`. Step 8 next steps: `/marketplace-tools:validate-plugin <name>` and `claude plugin validate plugins/<name>`. Remove the persona line and "Prefer dedicated tools…". Keep `version` in the marketplace entry template (Task 24 removes it).
- [ ] **Step 2: Verify.** `grep -n "/validate-plugin <name>" plugins/marketplace-tools/skills/new-plugin/SKILL.md` shows only the prefixed form.
- [ ] **Step 3: Commit** `fix(new-plugin): reserved prefixes, README and diagram registration, namespaced command`

### Task 8: Release marketplace-tools 1.1.0

**Files:**
- Modify: `plugins/marketplace-tools/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (marketplace-tools entry), `README.md` (table row), `plugins/marketplace-tools/README.md` (mention `lint-plugin.mjs`)

- [ ] **Step 1:** Set `1.1.0` in the three places.
- [ ] **Step 2: Verify:** `claude plugin validate .` and `claude plugin validate plugins/marketplace-tools` pass; `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` passes; the marketplace hook test from Task 1 passes.
- [ ] **Step 3: Commit** `chore(marketplace-tools): release 1.1.0`

## Group 3 — mcp-sql-server 1.3.0 (D4: Claude never sees the password)

### Task 9: Spike — does `${VAR}` expand in local/user scope? (Inline, orchestrator)

**Files:** none in the repo; result recorded in the progress file and passed to Tasks 10–11.

**Interfaces:**
- Produces: `EXPANDS_IN_CLAUDE_JSON = yes | no`.

- [ ] **Step 1:** In a fresh scratchpad dir, register a probe: `claude mcp add-json --scope local zz-env-probe '{"command":"node","args":["-e","require(\"fs\").writeFileSync(process.env.OUT, process.env.PROBE)"],"env":{"OUT":"<scratchpad>/probe.txt","PROBE":"${ZZ_PROBE}"}}'`.
- [ ] **Step 2:** Run `ZZ_PROBE=expanded claude mcp list` (it starts servers to health-check them), then read `probe.txt`. Expected: `expanded` → `yes`; `${ZZ_PROBE}` → `no`. If `probe.txt` was not written, record `no` (unverified) and say so.
- [ ] **Step 3:** `claude mcp remove zz-env-probe --scope local`; confirm with `claude mcp get zz-env-probe` (not found).

### Task 10: setup.sh prints a native interpreter path and a JSON entry

**Files:**
- Modify: `plugins/mcp-sql-server/scripts/setup.sh`
- Create: `plugins/mcp-sql-server/scripts/setup.test.mjs`

**Interfaces:**
- Produces: `setup.sh python-path` → prints the absolute venv interpreter path in native form (`cygpath -m` on `MINGW*|MSYS*|CYGWIN*`, e.g. `C:/Users/x/.claude/mcp-servers/mcp-sql-server/.venv/Scripts/python.exe`); exit 1 if the venv is missing. `setup.sh print-entry <python-path> <host> <port> <user> <password-ref> <name> [driver] [encrypt] [trust_cert]` → prints the single-line JSON server entry (same shape `register-mcp-json` writes). `register_mcp_json` reuses the same builder (new function `build_entry`). `add-database` accepts a `${…}` placeholder as the password (non-empty check unchanged).

- [ ] **Step 1: Write the failing tests** (spawn `bash setup.sh …` with `HOME` = tmp): `print-entry emits env with a literal ${DB_PASSWORD}` (assert `JSON.parse(out).env.DB_PASSWORD === '${DB_PASSWORD}'`), `print-entry maps defaults` (port `1433`, driver `ODBC Driver 18 for SQL Server`, encrypt/trust `false`), `register-mcp-json writes the same entry as print-entry`, `python-path fails without a venv`, `python-path prints an absolute path when the venv exists` (create `<HOME>/.claude/mcp-servers/mcp-sql-server/.venv/{bin|Scripts}/python[.exe]`), `add-database accepts ${DB_X_PASSWORD}`.
- [ ] **Step 2: Run** `node --test plugins/mcp-sql-server/scripts/setup.test.mjs` — Expected: FAIL (unknown subcommands).
- [ ] **Step 3: Implement** the two subcommands and `build_entry`; replace `grep -oP` with `grep -oE` equivalents; add `/opt/homebrew/etc/odbcinst.ini` to the ODBC search list; update the dispatcher usage line.
- [ ] **Step 4: Run** the tests — Expected: pass. `git ls-files --eol plugins/mcp-sql-server/scripts/setup.sh` — Expected: `i/lf w/lf`.
- [ ] **Step 5: Commit** `feat(mcp-sql-server): python-path and print-entry subcommands; portable grep`

### Task 11: Setup skill never asks for the password

**Files:**
- Modify: `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md`, `plugins/mcp-sql-server/README.md`

**Interfaces:**
- Consumes: `python-path`, `print-entry`, `register-mcp-json`, `add-database` (Task 10); `EXPANDS_IN_CLAUDE_JSON` (Task 9).

- [ ] **Step 1: Edit Step 5 (credentials).** Ask host, user, database name (written as `DB_NAME`; read `DB_DATABASE` or `DB_NAME` from `.env`), port, encrypt, trust cert. Never ask for, read or print the password; `detect-env` output may say whether `DB_PASSWORD` exists, but the skill must not read its value. Tell the user to set `DB_PASSWORD` in their own environment: Windows `setx DB_PASSWORD "<password>"` (new terminal/IDE window afterwards), bash `export DB_PASSWORD=…` in `~/.bashrc`; Windows Auth = leave it empty.
- [ ] **Step 2: Edit Step 6 (scopes).** Three options: **project** — `register-mcp-json` into `.mcp.json` with password ref `'${DB_PASSWORD}'` (safe to commit; first launch shows a project-approval prompt); **local** (this project, private) and **user** (all projects) — if `EXPANDS_IN_CLAUDE_JSON=yes`: `claude mcp add-json --scope local|user mcp-sql-server "$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" print-entry "<python>" … '${DB_PASSWORD}' …)"`; if `no`: show that command with `"$DB_PASSWORD"` and ask the user to run it in their own terminal. Interpreter path always from `setup.sh python-path`. Remove project-shared-with-literal-password, `ensure-gitignore`, and the `claude mcp add -e …` block. Step 6.5 uses `'${DB_<ALIAS>_PASSWORD}'` and tells the user to set that variable; for local/user scope, aliases are added by re-running `print-entry`-based registration (document the exact flow chosen).
- [ ] **Step 3: Edit Steps 7–8 and Troubleshooting.** Verify with `claude mcp get mcp-sql-server`; project scope may show `⏸ Pending approval` until approved (`claude mcp reset-project-choices` to re-ask). New troubleshooting entry: `claude mcp list` warns about a missing variable / login fails with `${DB_PASSWORD}` → the variable isn't set in the environment that launched Claude Code. Fix the "Switching scopes" note. Add `disable-model-invocation: true` to the frontmatter.
- [ ] **Step 4: Verify.** `grep -nE "What is the database password|Password\?\"|project-shared|ensure-gitignore|mcp add --transport" plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md` — Expected: no output. `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/mcp-sql-server` — exit 0.
- [ ] **Step 5: Behavioral test:** a subagent follows the SKILL.md literally for a fake server (`sql01`, user `app_ro`, db `Sales`, Windows host, project scope then local scope), writing every command it would run to the scratchpad without executing installs or registrations; then a read-only adversarial review. Expected: no command or message contains a password value; both scopes produce a complete command.
- [ ] **Step 6: Commit** `fix(mcp-sql-server-setup): keep the password out of the conversation; native scopes and add-json`

### Task 12: Release mcp-sql-server 1.3.0

**Files:** `plugins/mcp-sql-server/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (entry), `README.md` (row)

- [ ] **Step 1:** Set `1.3.0` in the three places.
- [ ] **Step 2: Verify:** validators pass; `node --test plugins/mcp-sql-server/scripts/setup.test.mjs` passes.
- [ ] **Step 3: Commit** `chore(mcp-sql-server): release 1.3.0`

## Group 4 — productivity-tools 1.4.0

Every task in this group: rewrite the skill's `description` in third person as "<what it does>. Use when <triggers>. Not for <sibling cases> (use <sibling>)."; delete persona lines ("You are a …") and generic tool advice ("prefer dedicated tools", "bundle reads"); finish with `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` (no new WARN for that skill) and a commit `fix(<skill>): …`. Tasks 13–20 write disjoint files.

### Task 13: wsl-health-check ships its script

**Files:** Modify `plugins/productivity-tools/skills/wsl-health-check/SKILL.md`, `plugins/productivity-tools/skills/wsl-health-check/scripts/health-report.sh` (added from the user's `~/health-report.sh`, untracked in the worktree).

- [ ] **Step 1: Script.** Replace every `bc -l` comparison with `awk` (`awk -v a="$x" -v b="$y" 'BEGIN{exit !(a>b)}'`); run the connectivity ping once and reuse the result in the summary; add `--check-services "<names>"` (default from `$HEALTH_KEY_SERVICES`, else `cron`) printing `▶ Key Services` with one `name: active|inactive|not-found` line each via `systemctl is-active` (or `service <n> status` without systemd), included in `--full`; add `Zombie processes: <n>` (`ps -eo stat= | grep -c '^Z'`) to `--processes` and `--full`; broken packages via `dpkg --audit` line count. Keep header characters (`═══`, `▶`) unchanged.
- [ ] **Step 2: SKILL.md.** Run `bash "${CLAUDE_SKILL_DIR}/scripts/health-report.sh" --full --no-color`; key services come from the `Key Services` section (CRITICAL when not `active`), no longer from the top-15 list; drop the separate `ps aux | awk` step; replace example values (`Ubuntu 24.04`, kernel, 32 cores) with placeholders; merge "Common Mistakes" into Output Format; description says WSL/Linux and the script.
- [ ] **Step 3: Verify.** `bash -n plugins/productivity-tools/skills/wsl-health-check/scripts/health-report.sh` — no output. `grep -n "bc -l\|redis-server" plugins/productivity-tools/skills/wsl-health-check/` — no output. `git ls-files --eol` shows `w/lf` after `git add`. **Manual Action (user, in WSL):** `bash plugins/…/health-report.sh --full --no-color` runs without errors and prints `▶ Key Services`.
- [ ] **Step 4: Commit** `fix(wsl-health-check): ship health-report.sh; key services checked directly`

### Task 14: report-analyzer has no hidden plugin dependency

**Files:** Modify `plugins/productivity-tools/skills/report-analyzer/SKILL.md`

- [ ] **Step 1:** Remove the claude-mem block (lines 84–89). State the output structure once (file) and show only the executive summary in chat. Output path stays `docs/roadmaps/roadmap-<topic>-<YYYY-MM-DD>.md` "unless the user names a path", with a line that this is a one-off analysis, not a tracked roadmap (roadmap-planner). Replace the stale example date with the placeholder.
- [ ] **Step 2: Verify** `grep -n "claude-mem\|2026-01-29" …/report-analyzer/SKILL.md` — no output. **Commit.**

### Task 15: deep-researcher drops agent-only instructions

**Files:** Modify `plugins/productivity-tools/skills/deep-researcher/SKILL.md`; Create `plugins/productivity-tools/skills/deep-researcher/references/report-template.md`

- [ ] **Step 1:** Delete the Memory paragraph and the Turn Budget section; replace with "Write the report incrementally; if research is cut short, mark the report Partial and list open questions." Move the report template (lines 32–113) into `references/report-template.md` (no author/version footer; "What's New" optional) and link it from the writing step. Add step 0 "confirm scope when the request is ambiguous". Replace "Use Google Scholar" with "search for the paper title and its citations". Description names the output (cited report in `docs/reports/`) and points analysis of an existing report to report-analyzer.
- [ ] **Step 2: Verify** `grep -n "MEMORY.md\|Turn Budget\|35 tool calls" …/deep-researcher/SKILL.md` — no output. **Commit.**

### Task 16: excalidraw-designer under 500 lines with a validator

**Files:** Modify `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`; Create `…/excalidraw-designer/references/example-3-node.md`, `…/excalidraw-designer/scripts/validate-excalidraw.mjs`, `…/excalidraw-designer/scripts/validate-excalidraw.test.mjs`

**Interfaces:**
- Produces: `node validate-excalidraw.mjs <file.excalidraw>` → exit 0 and `OK` or exit 1 with one line per problem: invalid JSON, duplicate `id`, duplicate `seed`, arrow `startBinding`/`endBinding` element missing, binding not mirrored in the target's `boundElements`, text `containerId` missing.

- [ ] **Step 1: Tests first** for each problem above plus a valid 3-node diagram (taken from the moved example). Run — FAIL. Implement. Run — PASS.
- [ ] **Step 2: SKILL.md.** Move the JSON example (lines 224–464) to `references/example-3-node.md` (with `## Contents` if > 100 lines); move Binding Rules and the checklist right after the workflow; the checklist's mechanical items become "Run `node "${CLAUDE_SKILL_DIR}/scripts/validate-excalidraw.mjs" <file>`"; trim the property table to non-obvious fields; delete "What NOT to Do" items duplicated elsewhere; `docs/diagrams/` becomes the default, overridable. Font IDs: only change the `fontFamily` table if verified against the Excalidraw source or docs (cite the URL in the step report); otherwise leave it.
- [ ] **Step 3: Verify** `wc -l …/excalidraw-designer/SKILL.md` < 500; tests pass. **Commit.**

### Task 17: mermaid-designer deduplicated and narrowed

**Files:** Modify `plugins/productivity-tools/skills/mermaid-designer/SKILL.md`; Create `…/mermaid-designer/references/diagram-types.md`

- [ ] **Step 1:** Keep one canonical accessibility section (`accTitle`/`accDescr`) and delete the other three mentions; delete Decision Rules (duplicate of the Selection Guide). Check two claims against mermaid.js.org docs and cite the URLs in the step report: (a) `accTitle`/`accDescr` unsupported in gantt/pie/mindmap/sequence, (b) `%%{init}%%` "deprecated since v10.5"; reword or remove whatever the docs don't support. Move per-type gotchas and examples to `references/diagram-types.md` (with `## Contents`). Add "if `mmdc` is available, render to check syntax". Neutral timeline title. Description: Mermaid code in Markdown; not for `.excalidraw` files.
- [ ] **Step 2: Verify** `grep -c "accTitle" …/mermaid-designer/SKILL.md` ≤ 3 (one section). **Commit.**

### Task 18: plan-coordinator matches current subagent behavior

**Files:** Modify `plugins/productivity-tools/skills/plan-coordinator/SKILL.md`, `…/plan-coordinator/references/delegation-protocol.md`, `…/plan-coordinator/references/routing.md`

- [ ] **Step 1:** SKILL.md Step 8: for plans with > 25 steps or 10+ near-identical mechanical items, offer the user a dynamic workflow ("use a workflow") as an alternative; never launch one unasked. Step 3: "an unknown `subagent_type` fails the call". Step 5: worktree ban reason — a worktree branches from the default branch, so earlier waves' unmerged work is invisible. Note the platform concurrency cap (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, default 20). Description adds "Not for ad-hoc plans without routing or a progress file (superpowers:subagent-driven-development)".
- [ ] **Step 2:** delegation-protocol.md: add `## Contents`; step-card rules add "Do not spawn subagents" for executors; the brief must not repeat CLAUDE.md (subagents load it; Explore/Plan don't — give those the conventions in the card); before a background wave, add allow rules for the validation commands; record the model actually used per step (env overrides can replace the requested tier); if `SendMessage` to a stopped agent is refused, relaunch. Verify the "fork" wording against code.claude.com/docs/en/sub-agents and correct it. routing.md: mention `effort` as a lever before a tier bump; link delegation-protocol only from SKILL.md.
- [ ] **Step 3: Verify** both references ≤ their current size + 15 lines; `## Contents` present in delegation-protocol.md. **Behavioral test:** a subagent follows the skill literally on this plan file, producing an Execution Map in the scratchpad + ambiguity list; read-only adversarial review. **Commit.**

### Task 19: roadmap-planner uses the skill dir variable and specifies its subagents

**Files:** Modify `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`, `…/roadmap-planner/references/decompose.md`

- [ ] **Step 1:** Replace the "Base directory …" mechanism (line 26, line 137) with `${CLAUDE_SKILL_DIR}/../roadmap-tracker/scripts/check-roadmap.mjs`; replace the `cp … # comment` with a plain `cp` line (no trailing comment). Reading subagent: `model: sonnet`, pass the source paths and the SRC summary format in the prompt. Reviewer: read-only (`Explore`-style instructions "do not edit"), `model: opus`. Move the Step 6 table to `references/decompose.md` and keep a 3-line stub. Trim the description below 1,024 chars and route "report → SWOT/gaps/risks" to report-analyzer.
- [ ] **Step 2: Verify** `grep -n "Base directory" …/roadmap-planner/SKILL.md` — no output; `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` passes. **Commit.**

### Task 20: roadmap-tracker uses the skill dir variable

**Files:** Modify `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md`, `…/roadmap-tracker/references/events.md`

- [ ] **Step 1:** Replace the "Base directory" reliance (lines 14–21) with `${CLAUDE_SKILL_DIR}`; events.md line 3 cross-skill path becomes `${CLAUDE_SKILL_DIR}/../roadmap-planner/references/formats.md`, linked from SKILL.md. Move Step 4a and Step 6 detail into `events.md`; keep Rules and the Step 7 report format near the top. Description starts with "Requires an existing roadmap folder (roadmap.config.json)".
- [ ] **Step 2: Verify** checker tests pass; `grep -n "Base directory" …/roadmap-tracker/` — no output. **Commit.**

### Task 21: Release productivity-tools 1.4.0 and check routing

**Files:** `plugins/productivity-tools/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (entry), `README.md` (row), `plugins/productivity-tools/README.md` (wsl-health-check prerequisite: WSL/Linux, bundled script, `HEALTH_KEY_SERVICES`)

- [ ] **Step 1: Routing test.** A subagent receives only the 9 productivity-tools `name` + `description` pairs and these prompts, and names the skill it would load for each: "check if the machine is healthy", "draw a flowchart of the login flow in the README", "make a whiteboard sketch of the architecture as .excalidraw", "research vector databases and write a report", "analyze this report and give me a SWOT", "plan the roadmap for the billing revamp", "deliverable E3 is done, update the roadmap", "execute docs/plans/x-plan.md with subagents". Expected: wsl-health-check, mermaid-designer, excalidraw-designer, deep-researcher, report-analyzer, roadmap-planner, roadmap-tracker, plan-coordinator. Fix any description that misroutes.
- [ ] **Step 2:** Set `1.4.0` in the three places. Do not edit `check-roadmap.mjs`.
- [ ] **Step 3: Verify:** validators pass; lint-plugin on productivity-tools exits 0; checker tests and excalidraw validator tests pass.
- [ ] **Step 4: Commit** `chore(productivity-tools): release 1.4.0`

## Group 5 — Reference and contributor docs (no bump)

### Task 22: Contributor docs and the template comment (D3)

**Files:** Modify `CONTRIBUTING.md`, `README.md` (Quick Start only), `.github/PULL_REQUEST_TEMPLATE.md`, `plugins/_template/skills/example-skill/SKILL.md`

- [ ] **Step 1:** CONTRIBUTING: docs link → `https://code.claude.com/docs/en/plugins`; naming adds reserved prefixes and "marketplace entry name = plugin.json name"; step 3 adds the frontmatter policy (link CLAUDE.md wording), the `{"hooks": {…}}` wrapper for `hooks/hooks.json`, and "run `claude plugin validate plugins/<name>` and `/marketplace-tools:validate-plugin <name>`"; review process says who updates README and the diagrams (the maintainer, with marketplace.json). README Quick Start adds updating: `claude plugin marketplace update claude-play` then `claude plugin update <plugin>@claude-play` (third-party marketplaces don't auto-update by default). PR template: "repo-required fields".
- [ ] **Step 2 (Inline, orchestrator, D3):** add after the template SKILL.md frontmatter a Markdown comment `<!-- Allowed frontmatter keys (repo policy): name, description, disable-model-invocation, user-invocable, argument-hint, compatibility, license, metadata. -->`. The guard blocks Edit/Write here by design; write it with a one-off `node -e` script, then `git diff --stat` must show only that file.
- [ ] **Step 3: Commit** `docs(contributing): naming, frontmatter policy, validation and update steps`

### Task 23: Revise the extensibility reference (C12)

**Files:** Modify `docs/claude-code-extensibility-reference.md`

- [ ] **Step 1:** Re-check each section against its official page (plugins-reference / plugin-marketplaces / plugins cli-reference, skills, hooks, sub-agents) fetched live, and correct it. Must-fix list from the audit's "Spec digest" table: plugin component dirs and fields; `commands`/`agents` replace the default scan; no `pip` source; `strict:false` conflict; `${CLAUDE_PLUGIN_DATA}`; `managed` scope; `validate --strict`; no standard/extension frontmatter split; no `version` frontmatter; 1,536-char cap; `user-invocable`; skill substitutions and ```` ```! ```` blocks; compaction re-attach; 33 hook events; hooks from all sources merge; `tool_response`; `defer`; `mcp_tool` type; `additionalContext` inside `hookSpecificOutput`; PreCompact can block; HTTP timeout 600s; hook env list; matcher exact vs regex; subagent `fable`/`auto`/`effort`/`color`/`omitClaudeMd`; Explore uses the main model; precedence managed > `--agents` > project > user > plugin; nesting up to 3 levels; background default; live reload; memory 200 lines or 25KB. Add a short "What `claude plugin validate` checks" subsection. Re-date line 3 to October 2026, "checked against v2.1.304".
- [ ] **Step 2: Verify** `grep -n "user-invokable\|17 total\|tool_result\|pip" docs/claude-code-extensibility-reference.md` — no output (except a sentence explaining `pip` is not a source type, if kept). Every section still has a Sources link.
- [ ] **Step 3: Commit** `docs(reference): align extensibility reference with current Claude Code docs`

## Group 6 — D1, last

### Task 24: Version lives in plugin.json and README only (D1)

**Precondition:** `feat/sql-server-tools-v1.1` is merged into `main`, and `main` is merged into `chore/claude-code-alignment` (resolve the sql-server-tools rows in `marketplace.json`/`README.md` by taking `main`'s version). If not yet merged, this task stays Pending (Manual Action: tell the orchestrator when it is).

**Files:** Modify `.claude-plugin/marketplace.json`, `.claude/hooks/validate-marketplace-json.mjs` + its test, `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` + its test (check 8), `plugins/marketplace-tools/skills/new-plugin/SKILL.md` (entry template), `CLAUDE.md` (bump rule + publish step), `.claude/rules/roadmap-checker.md` ("3 places" → "2 places")

- [ ] **Step 1: Confirm the doc** (Inline): fetch the marketplace reference (`code.claude.com/docs/en/plugins/marketplace-reference` or `plugin-marketplaces`) and quote the sentence saying `plugin.json` version wins over the entry. If the docs don't say it, stop and report — D1 is re-decided.
- [ ] **Step 2: Tests first:** hook test `entry without version passes`; lint test `unregistered vs registered without version`. Run — FAIL.
- [ ] **Step 3:** Remove `version` from every marketplace entry; drop `version` from hook check 5's required list and keep check 8 name-only; lint check 8 compares names only; new-plugin template loses `version`; CLAUDE.md: "Bump the version in two places together: `plugin.json` (authoritative — it wins over any marketplace value) and the root README table"; roadmap-checker.md: "(2 places, see CLAUDE.md)". Since marketplace-tools changes again here, bump it to `1.1.1` in `plugin.json` + README.
- [ ] **Step 4: Verify:** all test suites pass; validators pass; `node -e "const m=require('./.claude-plugin/marketplace.json');process.exit(m.plugins.some(p=>'version' in p)?1:0)"` exits 0.
- [ ] **Step 5: Commit** `chore(repo): plugin version lives in plugin.json and README only`

## Manual Actions

- **Task 13:** run the health script inside WSL once (`bash …/health-report.sh --full --no-color`) and report errors.
- **Task 24:** confirm when `feat/sql-server-tools-v1.1` has been merged into `main`.
- **After the plan:** publish per CLAUDE.md (push `main`, `claude plugin marketplace update claude-play`, `claude plugin update <plugin>@claude-play`, check the cache folder for each new version).
