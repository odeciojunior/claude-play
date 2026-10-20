# Execution Progress: Claude Code Alignment
**Plan**: docs/plans/2026-10-20-claude-code-alignment-plan.md
**Roadmap**: none
**Started**: 2026-10-20 | **Last Updated**: 2026-10-20
**Status**: In Progress

## Recovery State
<!-- Read THIS first after compaction or restart -->
**Last COMPLETED Wave**: 2
**Last DELEGATED Wave**: 2
**In-Flight Agents**: none
**Next Action**: Launch Wave 3 (Groups J opus, K haiku, L sonnet, M sonnet)

## Execution Map
**Steps**: 25 (execute 25, skip 0; Task 22 split into 22a/22b) | **Waves**: 6 + inline | **Effort**: ~10h agent time (estimate; plan has none) | **Tiers**: inline 3 · haiku 2 · sonnet 17 · opus 3 | **Review gates**: 8

| Wave | Group | Steps | Agent | Tier | Score | Mode | Depends On | Writes | Status |
|------|-------|-------|-------|------|-------|------|------------|--------|--------|
| 0 | I1 | 4 | — | inline | 2 | Inline | — | CLAUDE.md | Pending |
| 1 | A | 1 | general-purpose | sonnet | 3 | Single | — | .claude/hooks/validate-marketplace-json{,.test}.mjs | Pending |
| 1 | B | 2 | general-purpose | sonnet | 3 | Single | — | .claude/hooks/protect-template{,.test}.mjs, .claude/settings.json | Pending |
| 1 | C | 3 | general-purpose | sonnet | 4 | Single + review | — | .claude/agents/plugin-reviewer.md | Pending |
| 1 | D | 5, 6, 8 | general-purpose | sonnet | 5 | Bundle + review (opus) | — | plugins/marketplace-tools/** (except new-plugin), marketplace.json (mt entry), README.md (mt row) | Pending |
| 2 | E | 7 | general-purpose | haiku | 2 | Single | D | plugins/marketplace-tools/skills/new-plugin/SKILL.md | Pending |
| 2 | F | 10 | general-purpose | sonnet | 5 | Single + review (opus) | — | plugins/mcp-sql-server/scripts/setup.sh, setup.test.mjs | Pending |
| 2 | G | 13 | general-purpose | sonnet | 5 | Single | D | plugins/productivity-tools/skills/wsl-health-check/** | Pending |
| 2 | H | 22a | general-purpose | sonnet | 3 | Single | — | CONTRIBUTING.md, README.md (Quick Start), .github/PULL_REQUEST_TEMPLATE.md | Pending |
| 2→3 | I2 | 22b | — | inline | 1 | Inline | — | plugins/_template/skills/example-skill/SKILL.md | Pending |
| 2→3 | I3 | 9 | — | inline | 1 | Inline | — | none (~/.claude.json probe, removed after) | Pending |
| 3 | J | 11, 12 | general-purpose | opus | 6 | Bundle + review (opus) | F, I3, D | plugins/mcp-sql-server/{skills/**,README.md,.claude-plugin/plugin.json}, marketplace.json (mcp entry), README.md (mcp row) | Pending |
| 3 | K | 14 | general-purpose | haiku | 2 | Single | D | plugins/productivity-tools/skills/report-analyzer/SKILL.md | Pending |
| 3 | L | 15 | general-purpose | sonnet | 3 | Single | D | plugins/productivity-tools/skills/deep-researcher/** | Pending |
| 3 | M | 16 | general-purpose | sonnet | 5 | Single | D | plugins/productivity-tools/skills/excalidraw-designer/** | Pending |
| 4 | N | 17 | general-purpose | sonnet | 5 | Single | D | plugins/productivity-tools/skills/mermaid-designer/** | Pending |
| 4 | O | 18 | general-purpose | sonnet | 5 | Single + review | D | plugins/productivity-tools/skills/plan-coordinator/** | Pending |
| 4 | P | 19 | general-purpose | sonnet | 4 | Single + review | D | plugins/productivity-tools/skills/roadmap-planner/** | Pending |
| 4 | Q | 20 | general-purpose | sonnet | 4 | Single + review | D | plugins/productivity-tools/skills/roadmap-tracker/{SKILL.md,references/events.md} | Pending |
| 5 | R | 21 | general-purpose | sonnet | 5 | Single + review (opus) | G, K, L, M, N, O, P, Q | plugins/productivity-tools/{.claude-plugin/plugin.json,README.md}, marketplace.json (pt entry), README.md (pt row) | Pending |
| 5 | S | 23 | general-purpose | opus | 6 | Single | — | docs/claude-code-extensibility-reference.md | Pending |
| 6 | T | 24 | general-purpose | sonnet | 5 | Single + review (opus) | all; **precondition: sql-server-tools v1.1 merged into main, main merged here** | marketplace.json, hooks, lint-plugin, new-plugin, CLAUDE.md, .claude/rules/roadmap-checker.md, mt plugin.json + README row | Blocked (precondition) |

**Mode key**: `+ review` = read-only reviewer must PASS before dependents start; "(opus)" = risk-floor reviewer on the opus tier, otherwise a sonnet behavioral reviewer (follows the skill literally, scratchpad only).

## Shared Brief
- **Goal**: Align this Claude Code plugin marketplace's guardrails, tooling, shipped skills and reference docs with the current official Claude Code docs (code.claude.com/docs). Each card is one slice of that.
- **Where**: work ONLY in `D:\projects\claude-play\.claude\worktrees\docs-alignment` (git worktree, branch `chore/claude-code-alignment`). Never `cd` to `D:\projects\claude-play` (another session works there). Never run `git stash`, `git checkout`, `git switch`, `git reset` or `git commit` — the orchestrator commits.
- **Repo layout**: `.claude-plugin/marketplace.json` (plugin catalog) · `plugins/<name>/.claude-plugin/plugin.json` · `plugins/<name>/skills/<skill>/SKILL.md` (+ `references/*.md`, `scripts/`) · `plugins/<name>/agents/*.md` · `.claude/hooks/*.mjs` (wired in `.claude/settings.json`) · `.claude/agents/plugin-reviewer.md` (repo-local) · `docs/`.
- **Plugins in scope**: marketplace-tools 1.0.0 → 1.1.0, mcp-sql-server 1.2.3 → 1.3.0, productivity-tools 1.3.0 → 1.4.0. A version bump changes three places together: plugin.json, its entry in marketplace.json, the root README.md table row.
- **Conventions**:
  - Node ≥18 ESM `.mjs`, zero npm dependencies. Tests: `node:test` + `node:assert/strict`, file `<name>.test.mjs` next to the script, fixtures in `scripts/fixtures/`. In tests build Windows paths from code (`path.win32.join`, `String.fromCharCode(92)`), never shell-quoted backslashes.
  - Text files are checked out CRLF (`core.autocrlf=true`): parsers must split on `/\r?\n/`. `*.sh` stays LF.
  - Skill/agent/reference text in English. SKILL.md < 500 lines. Any `references/*.md` > 100 lines starts with a `## Contents` list. References are linked only from SKILL.md (one level deep). In skill bodies use `${CLAUDE_SKILL_DIR}` for files inside the skill and `${CLAUDE_PLUGIN_ROOT}` for plugin-level files.
  - SKILL.md frontmatter keys (repo policy): `name`, `description`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `compatibility`, `license`, `metadata`. Spelling: `user-invocable` (the old `user-invokable` is a typo Claude Code ignores).
  - Skill descriptions: third person, "<what it does>. Use when <triggers>. Not for <sibling case> (use <sibling>)." No persona lines ("You are a …"), no generic tool advice ("prefer dedicated tools", "bundle reads").
  - Plugin agents ignore `hooks`, `mcpServers`, `permissionMode`; never add them.
- **Commands**:
  - validate: `claude plugin validate .` and `claude plugin validate plugins/<name>` → `✔ Validation passed`
  - all tests: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"` (baseline 117 pass)
  - one test file: `node --test <path>`
  - lint (after Step 5 exists): `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/<name>`
  - line endings: `git ls-files --eol <file>`
- **Do not touch**: `plugins/sql-server-tools/**` · `plugins/_template/**` · `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` · `docs/reports/**` · `docs/plans/**`.
- **Environment**: Windows 11, Git Bash for Bash. `wsl` commands are blocked by the worktree guard — report anything that needs WSL as a manual action. Claude Code CLI v2.1.304.
- **Glossary**: *repo policy* = a rule this repo adds on top of the official spec (say so in messages). *lint-plugin* = the deterministic checker created in Step 5. *D4* = "Claude never sees the database password".

## Steps
| # | Step | Status | Tier · Attempts | Score (S/A/R/B/V) | Note |
|---|------|--------|-----------------|-------------------|------|
| 1 | Marketplace hook: block, don't crash; checks 7–9 | Done | sonnet · 1 (+1 style fix-up) | 3 (1/0/1/1/0) | ab7396d; 12 tests |
| 2 | Template guard: all edit tools, normalised paths | Done | sonnet · 1 | 3 (1/0/1/1/0) | 28a1ae8; 6 tests; live Edit probe blocked ✓ |
| 3 | plugin-reviewer: patterns, agent checks, spelling | Done | sonnet · 1 (+2 fix-ups) | 4 (0/1/1/1/1) | gate PASS after round 1 |
| 4 | CLAUDE.md accurate rules | Done | inline · 1 | 2 (0/0/0/1/1) | 6e14674; Hooks section updated after Wave 1 |
| 5 | lint-plugin.mjs + tests + fixtures | Done | sonnet · 1 (+1 fix-up) | 5 (2/1/1/1/0) | 7e03108; 60 tests; opus gate PASS round 2 |
| 6 | validate-plugin SKILL runs validate + lint | Done | sonnet · 1 (+1 fix-up) | 3 (0/1/0/1/1) | fb1ec03 |
| 7 | new-plugin: prefixes, README/diagrams, namespaced cmd | Done | haiku · 1 | 2 (0/0/0/1/1) | committed after 1.1.0 commit, ships in 1.1.0 (not yet published) |
| 8 | Release marketplace-tools 1.1.0 | Done | sonnet · 1 | 3 (1/0/0/2/0) | aebefe6 |
| 9 | Spike: `${VAR}` expansion in ~/.claude.json | Done | inline · 1 | 1 (0/0/0/1/0) | yes (local scope); probe removed |
| 10 | setup.sh python-path + print-entry | Done | sonnet · 1 (+2 fix-ups) | 5 (1/1/1/2/0) | opus gate PASS round 3; env: refs |
| 11 | Setup skill never asks for the password | Pending | opus · 0 | 6 (1/1/1/2/1) | credentials + install |
| 12 | Release mcp-sql-server 1.3.0 | Pending | opus · 0 | 3 (1/0/0/2/0) | bundled with 11 |
| 13 | wsl-health-check ships its script | Done | sonnet · 1 | 5 (1/1/1/1/1) | committed; WSL run = manual action (untested paths: --full, --check-services) |
| 14 | report-analyzer: drop claude-mem | Pending | haiku · 0 | 2 (0/0/0/1/1) | — |
| 15 | deep-researcher: drop agent-only text | Pending | sonnet · 0 | 3 (1/0/0/1/1) | — |
| 16 | excalidraw-designer < 500 lines + validator | Pending | sonnet · 0 | 5 (2/1/1/1/0) | — |
| 17 | mermaid-designer dedupe + verify claims | Pending | sonnet · 0 | 5 (1/1/1/1/1) | web check |
| 18 | plan-coordinator vs current subagents | Pending | sonnet · 0 | 5 (1/1/1/1/1) | behavioral gate |
| 19 | roadmap-planner: skill dir var, subagent spec | Pending | sonnet · 0 | 4 (1/1/0/1/1) | behavioral gate |
| 20 | roadmap-tracker: skill dir var | Pending | sonnet · 0 | 4 (1/1/0/1/1) | behavioral gate |
| 21 | Release productivity-tools 1.4.0 + routing test | Pending | sonnet · 0 | 5 (1/0/1/2/1) | risk floor |
| 22a | Contributor docs | Done | sonnet · 1 | 3 (1/0/0/1/1) | committed |
| 22b | Template comment (D3) | Done | inline · 1 | 1 (0/0/0/1/0) | committed; only that file |
| 23 | Extensibility reference revision | Pending | opus · 0 | 6 (1/1/1/1/2) | judgment-only check |
| 24 | D1: version in plugin.json + README only | Blocked | sonnet · 0 | 5 (2/0/1/2/0) | waits for v1.1 merge |

## Wave Execution Log
| Wave | Groups | Delegated | Completed | Agent IDs | Notes |
|------|--------|-----------|-----------|-----------|-------|
| 0 | I1 | inline | 2026-10-20 | — | Step 4 (6e14674) |
| 2 | E, F, G, H + inline 22b, 9 | 2026-10-20 | 2026-10-20 | E a0e1026e1cb29f571 · F a530c5983561b7044 (gate a8bfbf0743253bd23) · G aa68d949d716e7e1c · H acd084175d699e214 | gate: 211/211 tests, 4 validators pass; F needed 2 review rounds (placeholder mangling/leak → env: refs) |
| 1 | A, B, C, D | 2026-10-20 | 2026-10-20 | A ab5d6451f6f168549 · B aeb59684a5e92b027 · C aa437191c04f94e37 (gate a13b224e11c14d5a6) · D a8a939ee4ec239ea7 (gate acafc5c7dac15a110) | gate: 195/195 tests, validators pass; C and D each needed 1 review round; template guard live probe blocked |

## Manual Actions Required
- Step 13: after Wave 2, run `bash plugins/productivity-tools/skills/wsl-health-check/scripts/health-report.sh --full --no-color` inside WSL (from the worktree under `/mnt/d/...`) and report errors.
- Step 24: tell the orchestrator when `feat/sql-server-tools-v1.1` is merged into `main`.
- Step 9 touches your `~/.claude.json` (adds then removes a `zz-env-probe` local-scope server).

## Issues & Decisions
- **Commits**: executors never commit (shared worktree, parallel agents would sweep each other's staged files). The orchestrator commits each step after verification/gate with `git add <card FILES>` and the plan's commit message.
- **Inline (3, at cap)**: Step 4 (CLAUDE.md, already in context, ~10 lines); Step 9 (spike needs this session's environment; result feeds Step 11); Step 22b (D3: only the orchestrator holds the user's authorization to pass the template guard).
- **Opus (3)**: Step 11 (score 6; credential flow and two scope branches; security-sensitive); Step 12 rides in the same bundle (release of 11, review covers both); Step 23 (score 6; 52-item doc revision checked only by judgment).
- **Risk floor**: Steps 8, 10, 11–12, 21, 24 touch manifests/installer → sonnet+ with an opus reviewer.
- **Behavioral gates** (`.claude/rules/skills.md`): Steps 3, 6 (inside D's opus review), 11 (inside J's opus review), 18, 19, 20. Steps 14–17 rely on lint + targeted greps + Step 21's routing test instead; choose **Safer** to add behavioral gates to them.
- **Write-set overlaps**: `marketplace.json` + root `README.md` are written by D (8), J (12), H (22a, Quick Start only), R (21), T (24) → placed in different waves (1, 3, 2, 5, 6). `CLAUDE.md`: I1 (4) and T (24) → wave 0 and 6. lint-plugin consumers (6, 11, 13–21) depend on D.
- **Self-modification**: Step 18 edits plan-coordinator, the skill running this plan. This run uses the installed 1.3.0 copy from the plugin cache; edits in the worktree do not affect it.
- **Gate C round 1 (DEFECTS 7)**: fixed 1,2,5,6,7 via SendMessage; #3 kept FAIL with stated reason; #4 rejected (gate read the main checkout's CLAUDE.md, the worktree already says `user-invocable`).
- **Out-of-scope findings for the sql-server-tools session** (tell the user; do not fix here): all 5 `plugins/sql-server-tools/agents/*.md` set `permissionMode`, which Claude Code ignores for plugin agents (lint-plugin: 5 FAIL); `tsql-specialist` carries `Bash` but its instructions never run commands (reviewer FLAG).
- **Gate F round 1 (DEFECTS 2)**: (1) `${DB_PASSWORD}` arg is mangled to `$DB_PASSWORD` when bash is started from PowerShell, and leaks the real secret if double-quoted → added `env:<NAME>` password-ref (script writes `${NAME}` itself; no `$` crosses argv); Step 11 must use `env:DB_PASSWORD` / `env:DB_<ALIAS>_PASSWORD` only. (2) detect-env died silently on a partial `.env` / `export` lines (pre-existing) → fixed; also reads DB_NAME.
- **Thin information**: Step 9's result decides Step 11's local/user branch; Step 2's inline Edit probe may show hooks don't fire on this Windows setup (then stop and report); Step 17's Mermaid claims and Step 16's font IDs depend on what the official docs say.

## Step Cards

### Step 1: Marketplace hook blocks instead of crashing, and checks entries against plugin.json
- **Route**: general-purpose · sonnet · score 3 — 2 files, exact spec, tests prove it
- **Files**: modify `.claude/hooks/validate-marketplace-json.mjs`; create `.claude/hooks/validate-marketplace-json.test.mjs`
- **Inputs**: current hook (6 checks, PostToolUse). Contract: on failure print `{"decision":"block","reason":…}` to stdout and exit 0; on pass, no output, exit 0. Known bug: `"owner":"bob"` or a `null` file throws TypeError → exit 1 → non-blocking (fails open).
- **Needs from upstream**: none
- **Do**:
  1. Tests first. Helper `runHook(marketplaceText, pluginJsons = {})`: writes `<tmp>/.claude-plugin/marketplace.json` and `<tmp>/plugins/<name>/.claude-plugin/plugin.json`, spawns `node .claude/hooks/validate-marketplace-json.mjs` with stdin `{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}`, `cwd` and env `CLAUDE_PROJECT_DIR` = tmp; returns `{ code, decision }`. Tests: owner as string blocks (reason mentions owner); null file blocks; plugins not an array blocks; object source blocks with a readable reason (contains "source", not "[object Object]"); duplicate plugin names block (reason contains "duplicate"); entry name ≠ plugin.json name blocks; entry version ≠ plugin.json version blocks (only when the entry has `version`); valid marketplace passes (code 0, no stdout); non-marketplace file_path `README.md` → no stdout; unparseable hook input blocks. Run → red.
  2. Implement: wrap all checks after the file-path filter in `try { … } catch (e) { block(\`validate-marketplace-json: unexpected error (${e.message})\`) }`; check 3 uses `m.owner && typeof m.owner === 'object'`; check 6 reports non-string sources as `<name>: source must be a ./plugins/ path string (repo policy)`; add check 7 duplicate names, check 8 for each local source `plugins/<name>/.claude-plugin/plugin.json` exists with equal `name` and (if the entry has `version`) equal version, check 9 entry name matches `^[a-z0-9][a-z0-9-]*$`. Tag repo-only requirements `(repo policy)`. Update the header comment to list 9 checks.
- **Done means**: `node --test .claude/hooks/validate-marketplace-json.test.mjs` → all pass; `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | node .claude/hooks/validate-marketplace-json.mjs` from the worktree root → no output
- **If Blocked**: if the real marketplace.json fails a new check, report which entry — do not edit marketplace.json
- **Commit msg**: `fix(hooks): block on malformed marketplace.json instead of crashing; check entries against plugin.json`
- **Handoff**: hook has 9 checks inside try/catch (+ non-object guard). Check 8 reads plugin.json via the entry's `source` path and compares name and (if present) version — any bump must edit plugin.json and the marketplace entry together or the hook blocks. Tests: `.claude/hooks/validate-marketplace-json.test.mjs` (12).

### Step 2: Template guard covers every edit tool and normalised paths
- **Route**: general-purpose · sonnet · score 3 — exact spec, tests prove it
- **Files**: modify `.claude/hooks/protect-template.mjs`, `.claude/settings.json`; create `.claude/hooks/protect-template.test.mjs`
- **Inputs**: PreToolUse hook; exit 2 + stderr blocks. Today it reads only `tool_input.file_path` and tests a raw substring.
- **Needs from upstream**: none
- **Do**:
  1. Tests first (helper spawns the hook with stdin `{"tool_input": …}`): blocks `plugins/_template/x.md`; blocks Windows path with backslashes and mixed case built with `path.win32.join('C:', 'repo', 'Plugins', '_Template', 'x.md')`; blocks `plugins/x/../_template/f.md`; blocks `{notebook_path: 'plugins/_template/n.ipynb'}`; allows `plugins/my-plugin/x.md`; blocks on unparseable input. Run → red.
  2. Implement: path = `tool_input.file_path ?? tool_input.notebook_path ?? ''`; normalise `path.posix.normalize(p.replace(/\\/g, '/')).toLowerCase()` then test for `plugins/_template/`. In the header comment say there is deliberately no Bash guard (`cp -r plugins/_template plugins/<new>` is the documented way to start a plugin).
  3. `.claude/settings.json`: both matchers → `Edit|MultiEdit|Write|NotebookEdit`; command strings unchanged.
- **Done means**: `node --test .claude/hooks/protect-template.test.mjs` → all pass; `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"` → no error
- **If Blocked**: none expected
- **After (orchestrator, inline)**: attempt an Edit on `plugins/_template/README.md` → must be blocked; if not, stop and report
- **Commit msg**: `fix(hooks): template guard covers NotebookEdit/MultiEdit and normalised paths`
- **Handoff**: guard reads `file_path ?? notebook_path`, normalises (`\`→`/`, posix normalize, lowercase); both matchers `Edit|MultiEdit|Write|NotebookEdit`; no Bash guard by design. CLAUDE.md Hooks section updated in the same commit. Tests: `.claude/hooks/protect-template.test.mjs` (6).

### Step 3: plugin-reviewer checks what it reports, with working patterns
- **Route**: general-purpose · sonnet · score 4 — one file, wording choices; behavioral gate (repo rule)
- **Files**: modify `.claude/agents/plugin-reviewer.md`
- **Needs from upstream**: none
- **Do**:
  1. Phase 1: add **Check 8: Agent files valid (FAIL)** — each `plugins/<name>/agents/*.md` has `---` on line 1, `name` and `description`, `name` without `:` (Claude Code silently skips a bad file); add **Check 9: No ignored plugin-agent fields (FAIL)** — `hooks`, `mcpServers`, `permissionMode`, `initialPrompt`. Update "Run these 7 checks" and the output template.
  2. Phase 3: replace patterns with `curl[^\n]*\|\s*(ba)?sh`, `wget[^\n]*\|\s*(ba)?sh`, `\beval\b`, `\bexec\b`, `\bnc\b`, `\bnetcat\b`. Frontmatter bullet: repo-policy keys with `user-invocable`; `model`/`context`/`allowed-tools` are valid Claude Code fields this repo doesn't use (policy, not schema). Define **Tool permissions appropriate**: each shipped agent sets `tools`; read-only agents carry no `Edit`/`Write`/`Bash`; no MCP wildcard grants.
- **Done means**: `grep -n "user-invokable" .claude/agents/plugin-reviewer.md` → no output; `grep -nE "curl\.\*\|" .claude/agents/plugin-reviewer.md` → no output; file ≤ 200 lines
- **Gate**: sonnet general-purpose follows the edited file literally on `plugins/marketplace-tools/` (read-only; output to scratchpad), lists ambiguities, then reviews adversarially: 9 Phase-1 checks reported, no FLAG on "evaluate"/"execute"
- **If Blocked**: none expected
- **Commit msg**: `fix(plugin-reviewer): working shell patterns, agent checks, user-invocable spelling`
- **Handoff**:

### Step 4: CLAUDE.md states the real rules (inline)
- **Route**: inline · score 2 — doc already in context, ~10 lines
- **Files**: modify `CLAUDE.md`
- **Do**: line 8 → repo policy with `user-invocable`, "`model`/`context`/`agent`/`allowed-tools`/`paths`/`hooks` are valid Claude Code fields we don't use; unknown keys are ignored silently, so spelling matters"; line 10 → `claude plugin validate` checks manifests only, frontmatter/agents via `marketplace-tools` `validate-plugin` (lint-plugin.mjs); line 11 → rules load "when a matching file is read or edited"; line 26 → "repo-required fields (the spec requires only `name`)"; agents layout comment → plugin agents ignore `hooks`/`mcpServers`/`permissionMode`; line 43 → delete the jq history; publish steps → add `/reload-plugins` or restart, old versions deleted after 14 days, dev loop `claude plugin marketplace add <local path>` + `/reload-plugins`. Keep the three-place bump rule.
- **Done means**: `grep -n "user-invokable" CLAUDE.md` → none; < 60 lines
- **Commit msg**: `docs(claude-md): accurate frontmatter policy and validation scope`
- **Handoff**: CLAUDE.md lines 8, 10–11, publish steps, layout comments, hooks intro updated (6e14674). Follow-up after Wave 1: Hooks section → matchers `Edit|MultiEdit|Write|NotebookEdit`, "9 checks".

### Step 5–6–8 (bundle D): lint-plugin, validate-plugin skill, release marketplace-tools 1.1.0
- **Route**: general-purpose · sonnet · score 5 (max of 5/3/3) — script + skill + release, sequential and coupled; risk floor (manifests) → opus review gate, which also runs the validate-plugin skill literally on `plugins/productivity-tools` (behavioral)
- **Files**: create `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs`, `lint-plugin.test.mjs`, `fixtures/valid/{.claude-plugin/plugin.json,README.md,skills/demo/SKILL.md,agents/demo.md}`, `fixtures/marketplace.json`; modify `plugins/marketplace-tools/skills/validate-plugin/SKILL.md`, `plugins/marketplace-tools/.claude-plugin/plugin.json`, `plugins/marketplace-tools/README.md`, `.claude-plugin/marketplace.json` (marketplace-tools entry `version` only), `README.md` (marketplace-tools row version only)
- **Needs from upstream**: none
- **Do (Step 5 — lint-plugin.mjs)**: CLI `node lint-plugin.mjs <plugin-dir> [--marketplace <path>]` (default `<plugin-dir>/../../.claude-plugin/marketplace.json`). Prints `[OK]   <check>` / `[WARN] <check>: <detail>` / `[FAIL] <check>: <detail>`, then `Result: <n> OK, <n> WARN, <n> FAIL`. Exit 0 no FAIL, 1 any FAIL, 2 usage. Exports `lintPlugin(dir, { marketplace }) → { results: [{ level, check, detail? }] }` and `parseFrontmatter(text) → { keys: Map, bodyStartLine } | null` (top-level `^([A-Za-z0-9_-]+):\s*(.*)$` lines between the first two `---` lines, split on `/\r?\n/`; indented or `>-`/`|` continuations joined; no YAML library). Checks:
  1. dir name = plugin.json `name` (FAIL); name not prefixed `claude-`/`anthropic-`/`cc-plugin-` (FAIL)
  2. plugin.json has `name`, `description`, `version`, `author.name`, `author.email`, `license`, non-empty `keywords` (FAIL, "repo policy")
  3. ≥1 SKILL.md, each with frontmatter, `name`, non-empty `description` (FAIL); `user-invokable` (FAIL, "misspelled, Claude Code ignores it; use user-invocable"); other keys outside the allowlist (WARN, "repo policy"); `disable-model-invocation`/`user-invocable` not true/false (FAIL); `description`+`when_to_use` > 1,536 chars (WARN)
  4. SKILL.md > 500 lines (WARN); `references/*.md` > 100 lines without `## Contents`/`## Table of Contents` (WARN); a reference linking another `references/*.md` (WARN, "keep references one level deep")
  5. `agents/*.md`: `---` line 1, `name`+`description`, `name` without `:` (FAIL); keys `hooks`/`mcpServers`/`permissionMode`/`initialPrompt` (FAIL, "ignored for plugin agents")
  6. `hooks/hooks.json` parses with top-level `hooks` object (FAIL); `.mcp.json` parses (FAIL); plugin-root `CLAUDE.md` (WARN, "not loaded for plugins")
  7. lines matching `(>|mkdir -p|cp [^\n]*)\s*"?\$\{CLAUDE_PLUGIN_ROOT\}` in scripts/skills (WARN, "plugin root changes on update; use ${CLAUDE_PLUGIN_DATA}")
  8. README.md ≥ 10 chars (WARN); marketplace entry with equal `name` (WARN if missing) and, when the entry has `version`, equal version (FAIL)
  Tests first: one per check (copy `fixtures/valid` to tmp + one mutation), `valid fixture has 0 FAIL and 0 WARN`, `CRLF frontmatter parses like LF`, `parseFrontmatter returns null without leading ---`, exit codes 0/1/2.
- **Do (Step 6 — validate-plugin SKILL.md)**: workflow = Step 0 `claude plugin validate plugins/<name>` (FAIL if it fails; note it checks manifests only) → Step 1 `node "${CLAUDE_SKILL_DIR}/scripts/lint-plugin.mjs" plugins/<name>` (include its lines verbatim) → judgment checks kept from today: hardcoded absolute paths, sensitive-data patterns. One `Result:` total. Remove persona line and "Prefer dedicated tools…". No `user-invokable` anywhere.
- **Do (Step 8 — release)**: `1.1.0` in plugin.json, the marketplace-tools entry, the README row; plugin README mentions lint-plugin.mjs.
- **Done means**: `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs` → pass; lint on `plugins/marketplace-tools`, `plugins/mcp-sql-server`, `plugins/productivity-tools` → exit 0 (list every WARN in CONCERNS); `claude plugin validate .` and `claude plugin validate plugins/marketplace-tools` → pass
- **If Blocked**: if an existing plugin produces a FAIL, report it; don't change that plugin
- **Commit msgs**: `feat(marketplace-tools): add lint-plugin script for frontmatter, agents and structure` · `feat(validate-plugin): run claude plugin validate and lint-plugin; keep judgment checks` · `chore(marketplace-tools): release 1.1.0`
- **Handoff**: CLI `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs <plugin-dir> [--marketplace <path>]`, exit 0/1/2; exports `lintPlugin`, `parseFrontmatter`, `formatResults`. Baseline: marketplace-tools 12 OK, mcp-sql-server 10 OK, productivity-tools 29 OK + 2 WARN (excalidraw 506 lines; delegation-protocol.md 107 lines w/o `## Contents`) — later steps must not add WARNs. marketplace-tools is 1.1.0 (aebefe6).

### Step 7: new-plugin scaffolds everything the repo requires
- **Route**: general-purpose · haiku · score 2 — exact text edits in one file
- **Files**: modify `plugins/marketplace-tools/skills/new-plugin/SKILL.md`
- **Needs from upstream**: D (lint-plugin exists)
- **Do**: Step 1 also rejects names starting `claude-`, `anthropic-`, `cc-plugin-`. After Step 7 add a step: append a row to the root `README.md` plugins table and add the plugin to `docs/diagrams/repo-architecture.md` and `docs/diagrams/repo-architecture.excalidraw`. Step 8 next steps: `/marketplace-tools:validate-plugin <name>` and `claude plugin validate plugins/<name>`. Delete the line "You are a plugin scaffolding assistant…" and "Prefer dedicated tools…". Keep `version` in the marketplace entry template.
- **Done means**: `grep -n "Run /validate-plugin" plugins/marketplace-tools/skills/new-plugin/SKILL.md` → none; lint on `plugins/marketplace-tools` → exit 0
- **If Blocked**: none expected
- **Commit msg**: `fix(new-plugin): reserved prefixes, README and diagram registration, namespaced command`
- **Handoff**: new Step 8 registers README row + both diagram files; summary is Step 9; marketplace entry template still has `version` (Step 24 removes it, around the Step 7 JSON block). Concern: .excalidraw edit is prose-only.

### Step 9: Spike — `${VAR}` expansion in ~/.claude.json (inline)
- **Route**: inline · score 1 — 3 CLI commands; needs this session's environment
- **Do**: `claude mcp add-json --scope local zz-env-probe '{"command":"node","args":["-e","require(\"fs\").writeFileSync(process.env.OUT, process.env.PROBE)"],"env":{"OUT":"<scratchpad>/probe.txt","PROBE":"${ZZ_PROBE}"}}'` → `ZZ_PROBE=expanded claude mcp list` → read probe.txt (`expanded` = yes; `${ZZ_PROBE}` = no; not written = no, unverified) → `claude mcp remove zz-env-probe --scope local` → `claude mcp get zz-env-probe` reports not found.
- **Done means**: `EXPANDS_IN_CLAUDE_JSON` recorded in Handoff; probe removed
- **Handoff**: `EXPANDS_IN_CLAUDE_JSON=yes` (verified for `--scope local`; user scope uses the same `~/.claude.json` mechanism, not separately tested). Unset variable → server receives the literal `${VAR}`; `claude mcp list` prints "MCP config diagnostics ⚠ … [Warning] [<server>] mcpServers.<server>: Missing environment variables: <VAR>". Probe removed (`claude mcp get` → not found).

### Step 10: setup.sh prints a native interpreter path and a JSON entry
- **Route**: general-purpose · sonnet · score 5 — installer script (risk floor) → opus review gate
- **Files**: modify `plugins/mcp-sql-server/scripts/setup.sh`; create `plugins/mcp-sql-server/scripts/setup.test.mjs`
- **Inputs**: `setup.sh` subcommands today: check-python, check-odbc, install-venv, verify-install, detect-env, register-mcp-json, add-database, ensure-gitignore. `VENV_DIR="$HOME/.claude/mcp-servers/mcp-sql-server/.venv"`; venv bin is `Scripts` on `MINGW*|MSYS*|CYGWIN*`, else `bin`. `register_mcp_json` builds the entry with an inline `node -e` (command, args `['-m','mcp_sql_server.server']`, env DB_HOST/PORT/USER/PASSWORD/NAME/DRIVER/ENCRYPT/TRUST_CERT).
- **Needs from upstream**: none
- **Do**: tests first (spawn `bash setup.sh …` with `HOME` = tmp): `print-entry emits a literal ${DB_PASSWORD}` (`JSON.parse(out).env.DB_PASSWORD === '${DB_PASSWORD}'`); `print-entry maps defaults` (port 1433, driver `ODBC Driver 18 for SQL Server`, encrypt/trust `false`); `register-mcp-json writes the same entry as print-entry`; `python-path fails without a venv`; `python-path prints an absolute path when the venv exists`; `add-database accepts ${DB_X_PASSWORD}`. Implement `python-path` (absolute interpreter path; `cygpath -m` on MINGW/MSYS/CYGWIN; exit 1 if missing), `print-entry <python-path> <host> <port> <user> <password-ref> <name> [driver] [encrypt] [trust_cert]` (single-line JSON), shared function `build_entry` used by `register_mcp_json`; replace `grep -oP` with `grep -oE`; add `/opt/homebrew/etc/odbcinst.ini` to the ODBC search; update the usage line.
- **Done means**: `node --test plugins/mcp-sql-server/scripts/setup.test.mjs` → pass; `git ls-files --eol plugins/mcp-sql-server/scripts/setup.sh` → `w/lf`; `bash -n plugins/mcp-sql-server/scripts/setup.sh` → no output
- **If Blocked**: if `cygpath` is missing in Git Bash, fall back to `pwd -W` and say so
- **Commit msg**: `feat(mcp-sql-server): python-path and print-entry subcommands; portable grep`
- **Handoff**: `setup.sh python-path` → one line, native absolute interpreter path (`C:/Users/…/.venv/Scripts/python.exe` on Git Bash), exit 1 if no venv. `setup.sh print-entry <python-path> <host> <port> <user> <password-ref> <name> [driver] [encrypt] [trust_cert]` → single-line JSON entry. Password arg of print-entry / register-mcp-json / add-database: **`env:<NAME>`** → stored as literal `${NAME}` (the only safe form: a `${…}` argv is mangled from PowerShell and a double-quoted one leaks the real value); whole-arg `$NAME` rejected; errors never echo the argument; literals still accepted. `detect-env` exits 0 when DB_HOST is found, prints masked values and `<VAR> missing` lines, handles `export` and CRLF, reads DB_NAME or DB_DATABASE. 16 tests.

### Step 11–12 (bundle J): setup skill never asks for the password; release mcp-sql-server 1.3.0
- **Route**: general-purpose · opus · score 6 — credential flow with two scope branches (security); release bundled; opus review gate incl. a behavioral run
- **Files**: modify `plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md`, `plugins/mcp-sql-server/README.md`, `plugins/mcp-sql-server/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (mcp-sql-server `version` only), `README.md` (mcp-sql-server row version only)
- **Inputs (audit findings)**: the skill asks the password in chat (Step 5 line 98, Step 6.5 line 193), writes it literally, offers "project-shared" with the password committed, uses `.mcp.json`+gitignore as "project-private", builds `claude mcp add … -e … mcp-sql-server --` where variadic `-e` swallows the name (lines 163–172), writes `~/…` interpreter paths into `command`, asks `DB_DATABASE` but writes `DB_NAME`, checks `claude mcp list --scope user`. Docs: `.mcp.json` expands `${VAR}`/`${VAR:-default}` in command/args/env; an unset variable loads anyway, `claude mcp list` shows a missing-variable warning and the literal `${VAR}` is used; project-scope servers need approval (`⏸ Pending approval`, `claude mcp reset-project-choices`); local and user scope live in `~/.claude.json`.
- **Needs from upstream**: Step 10 handoff (`python-path`, `print-entry`); Step 9 handoff (`EXPANDS_IN_CLAUDE_JSON`); D (lint-plugin)
- **Do**:
  1. Step 5: ask host, user, database name (write as `DB_NAME`; read `DB_DATABASE` or `DB_NAME` from `.env`), port, encrypt, trust cert. Never ask for, read or print a password; `detect-env` may say whether `DB_PASSWORD` exists, never its value. Tell the user to set `DB_PASSWORD` themselves: Windows `setx DB_PASSWORD "<password>"` then open a new terminal/IDE window; bash `export DB_PASSWORD=…` in `~/.bashrc`; Windows Auth → leave unset/empty.
  2. Step 6 scopes (Step 9 verified expansion works in `~/.claude.json`): **project** → `register-mcp-json "$CLAUDE_PROJECT_DIR/.mcp.json" "<python>" <host> <port> <user> env:DB_PASSWORD <name> …` (safe to commit; first launch asks for approval); **local** (this project, private) / **user** (all projects) → `claude mcp add-json --scope local|user mcp-sql-server "$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" print-entry "<python>" <host> <port> <user> env:DB_PASSWORD <name> …)"`. The password argument is ALWAYS `env:DB_PASSWORD` (never `${…}`, never quoted values). Interpreter path always from `bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" python-path`. Remove project-shared-with-literal-password, `ensure-gitignore` usage and the `claude mcp add -e` block. Step 6.5: password ref `env:DB_<ALIAS>_PASSWORD` + tell the user to set that variable; aliases need the entry in a JSON file: for project scope run `add-database` on `.mcp.json`; for local/user scope re-register the whole entry (remove + add-json) — write one exact flow (e.g. build the entry in a temp `.mcp.json` with register-mcp-json + add-database, then `claude mcp remove mcp-sql-server --scope <s>` and `claude mcp add-json --scope <s> mcp-sql-server "$(node -e "…print mcpServers['mcp-sql-server']…" <tmp>)"`), never editing `~/.claude.json` by hand.
  3. Steps 7–8 + Troubleshooting: verify with `claude mcp get mcp-sql-server`; project-scope approval note; new entry: `claude mcp list` shows "MCP config diagnostics ⚠ … Missing environment variables: DB_PASSWORD" and login fails → the variable isn't set in the environment that launched Claude Code (Windows: `setx` needs a new terminal/IDE window); fix "Switching scopes"; scope names in the summary = project | local | user. Frontmatter: add `disable-model-invocation: true`.
  4. Release: `1.3.0` in the three places; plugin README describes the new password handling.
- **Done means**: `grep -nE "What is the database password|Password\?\"|project-shared|ensure-gitignore|mcp add --transport" plugins/mcp-sql-server/skills/mcp-sql-server-setup/SKILL.md` → none; lint on `plugins/mcp-sql-server` → exit 0; `claude plugin validate .` and `plugins/mcp-sql-server` → pass
- **Gate (opus, read-only)**: review diff of Steps 10–12 for secret leakage and command correctness; then follow the SKILL.md literally for a fake server (`sql01`, user `app_ro`, db `Sales`, Windows host; project scope, then local scope), writing every command it would run to the scratchpad without executing installs/registrations → no command or message contains a password value; both scopes give a complete command
- **If Blocked**: if a scope can't be done without the password reaching Claude, report BLOCKED with the reason
- **Commit msgs**: `fix(mcp-sql-server-setup): keep the password out of the conversation; native scopes and add-json` · `chore(mcp-sql-server): release 1.3.0`
- **Handoff**:

### Step 13: wsl-health-check ships its script
- **Route**: general-purpose · sonnet · score 5 — bash refactor + skill rewrite; full run only in WSL (manual action)
- **Files**: modify `plugins/productivity-tools/skills/wsl-health-check/SKILL.md`, `plugins/productivity-tools/skills/wsl-health-check/scripts/health-report.sh` (already in the worktree, untracked: the author's original script)
- **Inputs**: the skill runs `~/health-report.sh --full --no-color` (not shipped), treats `redis-server`/`cron` as CRITICAL if missing from "Active Services" — but the script lists only the top 15 active services; it counts zombies with a separate `ps aux | awk`. The script uses `bc -l` for comparisons (lines ~279, 349–367, 469), pings 8.8.8.8 twice (~309, ~476), counts broken packages with `dpkg --get-selections | grep -v "install$"` (~422).
- **Needs from upstream**: D
- **Do**: script — replace every `bc -l` comparison with `awk -v a=… -v b=… 'BEGIN{exit !(a>b)}'`; ping once and reuse the result; add `--check-services "<names>"` (default `$HEALTH_KEY_SERVICES`, else `cron`) printing a `▶ Key Services` subsection with `name: active|inactive|not-found` via `systemctl is-active` (or `service <n> status` without systemd), included in `--full`; add `Zombie processes: <n>` (`ps -eo stat= | grep -c '^Z'`) to `--processes` and `--full`; broken packages = line count of `dpkg --audit`; keep `═══`/`▶` headers. SKILL.md — run `bash "${CLAUDE_SKILL_DIR}/scripts/health-report.sh" --full --no-color`; key services from `Key Services` (CRITICAL when not active); drop the separate ps step; placeholders instead of `Ubuntu 24.04`/kernel/32 cores; merge "Common Mistakes" into Output Format; description per Shared Brief (WSL/Linux, bundled script).
- **Done means**: `bash -n plugins/productivity-tools/skills/wsl-health-check/scripts/health-report.sh` → no output; `grep -rn "bc -l\|redis-server" plugins/productivity-tools/skills/wsl-health-check/` → none; `bash …/health-report.sh --help` in Git Bash → help text; lint on `plugins/productivity-tools` → no new WARN for this skill
- **If Blocked**: commands unavailable in Git Bash are fine; don't try `wsl`
- **Commit msg**: `fix(wsl-health-check): ship health-report.sh; key services checked directly`
- **Handoff**: `--check-services "<names>"` (default `$HEALTH_KEY_SERVICES`, else `cron`) → `▶ Key Services` lines `<name>: active|inactive|not-found` (also in `--full`/`--services`); `Zombie processes: <n>` in summary and `--processes`; awk helpers `num_gt`/`num_lt`; ping cached in `INTERNET_OK`. Step 21's plugin README must document `HEALTH_KEY_SERVICES`.

### Step 14: report-analyzer has no hidden plugin dependency
- **Route**: general-purpose · haiku · score 2 — text edits in one file
- **Files**: modify `plugins/productivity-tools/skills/report-analyzer/SKILL.md`
- **Needs from upstream**: D
- **Do**: delete the claude-mem block (lines ~84–89, `mcp__plugin_claude-mem_*`); describe the output structure once (the saved file) and show only the executive summary in chat (today lines ~40–74 specify it twice); output path `docs/roadmaps/roadmap-<topic>-<YYYY-MM-DD>.md` "unless the user names a path", plus one line: a one-off analysis, not a tracked roadmap (use roadmap-planner for that); replace the example date `2026-01-29` with `<YYYY-MM-DD>`; delete the persona line and generic tool advice (lines ~96–100); description per Shared Brief (not for research → deep-researcher; not for tracked roadmaps → roadmap-planner).
- **Done means**: `grep -n "claude-mem\|2026-01-29\|You are" plugins/productivity-tools/skills/report-analyzer/SKILL.md` → none; lint → no new WARN
- **Commit msg**: `fix(report-analyzer): drop claude-mem dependency; single output spec`
- **Handoff**:

### Step 15: deep-researcher drops agent-only instructions
- **Route**: general-purpose · sonnet · score 3
- **Files**: modify `plugins/productivity-tools/skills/deep-researcher/SKILL.md`; create `plugins/productivity-tools/skills/deep-researcher/references/report-template.md`
- **Needs from upstream**: D
- **Do**: delete the Memory paragraph (~line 155) and the Turn Budget section (~157–164); add "Write the report incrementally; if research is cut short, mark it Partial and list open questions."; move the report template (~lines 32–113) to `references/report-template.md` (drop the Version/Author footer; "What's New" optional; `## Contents` if > 100 lines) and link it from the writing step; add step 0 "confirm scope when the request is ambiguous"; "Use Google Scholar" → "search for the paper title and its citations"; condense the six-tier source ranking to one ordering line; delete persona and generic tool lines; description names the output (cited report in `docs/reports/`) and sends analysis of an existing report to report-analyzer.
- **Done means**: `grep -n "MEMORY.md\|Turn Budget\|35 tool calls" plugins/productivity-tools/skills/deep-researcher/SKILL.md` → none; lint → no new WARN
- **Commit msg**: `fix(deep-researcher): drop agent-only memory and turn budget; template in references`
- **Handoff**:

### Step 16: excalidraw-designer under 500 lines with a validator
- **Route**: general-purpose · sonnet · score 5 — TDD script + restructure
- **Files**: modify `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`; create `…/excalidraw-designer/references/example-3-node.md`, `…/excalidraw-designer/scripts/validate-excalidraw.mjs`, `…/excalidraw-designer/scripts/validate-excalidraw.test.mjs`
- **Needs from upstream**: D
- **Do**: CLI `node validate-excalidraw.mjs <file.excalidraw>` → exit 0 + `OK`, or exit 1 with one line per problem: invalid JSON; duplicate `id`; duplicate `seed`; arrow `startBinding`/`endBinding` element missing; binding not mirrored in the target's `boundElements`; text `containerId` missing. Tests first (one per problem + the valid 3-node example taken from SKILL.md lines ~224–464). SKILL.md: move that example to `references/example-3-node.md` (`## Contents` if > 100 lines); move Binding Rules and the checklist right after the workflow; mechanical checklist items → "Run `node "${CLAUDE_SKILL_DIR}/scripts/validate-excalidraw.mjs" <file>`"; trim the property table to non-obvious fields (`seed`, `versionNonce`, `boundElements`, `roundness`); delete "What NOT to Do" duplicates; `docs/diagrams/` = overridable default; delete persona line; description: `.excalidraw`/hand-drawn/whiteboard; Markdown-embedded diagrams → mermaid-designer. Change the `fontFamily` table only if verified against Excalidraw's source or docs (cite the URL in CONCERNS).
- **Done means**: `node --test …/excalidraw-designer/scripts/validate-excalidraw.test.mjs` → pass; `wc -l …/excalidraw-designer/SKILL.md` < 500; lint → no WARN for this skill
- **Commit msg**: `fix(excalidraw-designer): under 500 lines; add validate-excalidraw script`
- **Handoff**:

### Step 17: mermaid-designer deduplicated and narrowed
- **Route**: general-purpose · sonnet · score 5 — needs a web check of two claims
- **Files**: modify `plugins/productivity-tools/skills/mermaid-designer/SKILL.md`; create `…/mermaid-designer/references/diagram-types.md`
- **Needs from upstream**: D
- **Do**: one canonical accessibility section (`accTitle`/`accDescr`; today repeated at ~16, 184–212, 395–396, 412–413); delete Decision Rules (~20–54, duplicates the Selection Guide); check against mermaid.js.org and cite URLs in CONCERNS: (a) `accTitle`/`accDescr` unsupported in gantt/pie/mindmap/sequenceDiagram (~187–188), (b) `%%{init}%%` "deprecated since v10.5" (~60) — reword or remove what the docs don't support; move per-type gotchas and examples to `references/diagram-types.md` (`## Contents`); add "if `mmdc` is available, render to check syntax"; timeline example title → "Product Roadmap"; GitHub support lists marked "as of <date checked>" or linked; delete persona line; description: Mermaid code in Markdown/GitHub; `.excalidraw` → excalidraw-designer.
- **Done means**: `grep -c "accTitle" …/mermaid-designer/SKILL.md` ≤ 3; lint → no new WARN
- **Commit msg**: `fix(mermaid-designer): dedupe rules, verify version claims, per-type reference`
- **Handoff**:

### Step 18: plan-coordinator matches current subagent behavior
- **Route**: general-purpose · sonnet · score 5 — behavioral gate (repo rule)
- **Files**: modify `plugins/productivity-tools/skills/plan-coordinator/SKILL.md`, `…/plan-coordinator/references/delegation-protocol.md`, `…/plan-coordinator/references/routing.md`
- **Needs from upstream**: D
- **Do**: SKILL.md — Step 8: for plans with > 25 steps or 10+ near-identical mechanical items, offer the user a dynamic workflow ("use a workflow") as an alternative, never launch one unasked; Step 3: "an unknown `subagent_type` fails the call"; Step 5: worktree ban reason = a worktree branches from the default branch, so earlier waves' unmerged work is invisible; note the platform concurrency cap (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, default 20); description adds "Not for ad-hoc plans without routing or a progress file (superpowers:subagent-driven-development)". delegation-protocol.md — add `## Contents`; prompt-template Rules add "Do not spawn subagents"; the brief must not repeat CLAUDE.md (subagents load it; Explore/Plan don't — give those the conventions in the card); before a background wave, add allow rules for the validation commands; record the model actually used per step (env overrides such as `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` can replace the requested tier); if `SendMessage` to a stopped agent is refused, relaunch; check the "fork" wording against https://code.claude.com/docs/en/sub-agents and correct it. routing.md — mention `effort` as a lever before a tier bump; remove the cross-link to delegation-protocol (link from SKILL.md only).
- **Done means**: `## Contents` in delegation-protocol.md; each reference grows ≤ 15 lines; lint → no new WARN
- **Gate**: sonnet general-purpose follows the edited skill literally on `docs/plans/2026-10-20-claude-code-alignment-plan.md`, writes an Execution Map to the scratchpad (no progress file in the repo, no Agent launches), lists ambiguities, then reviews adversarially
- **Commit msg**: `fix(plan-coordinator): align with current subagent behavior; offer workflows for large plans`
- **Handoff**:

### Step 19: roadmap-planner uses the skill dir variable and specifies its subagents
- **Route**: general-purpose · sonnet · score 4 — behavioral gate
- **Files**: modify `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`, `…/roadmap-planner/references/decompose.md`
- **Needs from upstream**: D
- **Do**: replace the "Base directory for this skill" mechanism (line 26, line 137) with `${CLAUDE_SKILL_DIR}/../roadmap-tracker/scripts/check-roadmap.mjs`; replace `cp … # comment` with a plain `cp` line; reading subagent: `model: sonnet`, pass source paths and the SRC summary format in the prompt; reviewer: read-only ("do not edit"), `model: opus`; move the Step 6 table to `references/decompose.md` (keep a 3-line stub; keep its `## Contents` current); trim the description below 1,024 chars and route "report → SWOT/gaps/risks" to report-analyzer.
- **Done means**: `grep -n "Base directory" …/roadmap-planner/SKILL.md` → none; `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` → pass; lint → no new WARN
- **Gate**: sonnet general-purpose follows the skill literally (light mode) on the objective in `docs/plans/roadmap-planner-v2/scenarios/s2-unsourced/objective.md`, output to scratchpad only, lists ambiguities, then reviews adversarially
- **Commit msg**: `fix(roadmap-planner): CLAUDE_SKILL_DIR paths; explicit subagent model and format`
- **Handoff**:

### Step 20: roadmap-tracker uses the skill dir variable
- **Route**: general-purpose · sonnet · score 4 — behavioral gate
- **Files**: modify `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md`, `…/roadmap-tracker/references/events.md`
- **Needs from upstream**: D
- **Do**: replace the "Base directory" reliance (lines ~14–21) with `${CLAUDE_SKILL_DIR}`; events.md line 3 path → `${CLAUDE_SKILL_DIR}/../roadmap-planner/references/formats.md`, linked from SKILL.md; move Step 4a and Step 6 detail into `events.md` (update its `## Contents`); keep Rules and the Step 7 report format near the top; description starts "Requires an existing roadmap folder (roadmap.config.json)". Do not touch `scripts/check-roadmap.mjs`.
- **Done means**: `grep -rn "Base directory" plugins/productivity-tools/skills/roadmap-tracker/` → none; checker tests pass; lint → no new WARN
- **Gate**: sonnet general-purpose follows the skill literally on `docs/plans/roadmap-planner-v2/scenarios/s3-tracker/event.md`, scratchpad only, lists ambiguities, then reviews adversarially
- **Commit msg**: `fix(roadmap-tracker): CLAUDE_SKILL_DIR paths; leaner SKILL.md`
- **Handoff**:

### Step 21: Release productivity-tools 1.4.0 and check routing
- **Route**: general-purpose · sonnet · score 5 — manifests (risk floor) → opus review gate
- **Files**: modify `plugins/productivity-tools/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (productivity-tools `version` only), `README.md` (productivity-tools row version only), `plugins/productivity-tools/README.md` (wsl-health-check: WSL/Linux, bundled script, `HEALTH_KEY_SERVICES`); plus any skill `description` that fails the routing test
- **Needs from upstream**: Steps 13–20 handoffs
- **Do**: routing test — give a fresh sonnet subagent only the 9 productivity-tools `name`+`description` pairs and these prompts; it names one skill each: "check if the machine is healthy" → wsl-health-check; "draw a flowchart of the login flow in the README" → mermaid-designer; "make a whiteboard sketch of the architecture as .excalidraw" → excalidraw-designer; "research vector databases and write a report" → deep-researcher; "analyze this report and give me a SWOT" → report-analyzer; "plan the roadmap for the billing revamp" → roadmap-planner; "deliverable E3 is done, update the roadmap" → roadmap-tracker; "execute docs/plans/x-plan.md with subagents" → plan-coordinator. Fix misrouting descriptions. Then `1.4.0` in the three places; don't edit `check-roadmap.mjs`.
- **Done means**: routing 8/8; validators pass; lint on productivity-tools → exit 0; all tests pass
- **Commit msg**: `chore(productivity-tools): release 1.4.0`
- **Handoff**:

### Step 22a: Contributor docs
- **Route**: general-purpose · sonnet · score 3
- **Files**: modify `CONTRIBUTING.md`, `README.md` (Quick Start section only), `.github/PULL_REQUEST_TEMPLATE.md`
- **Needs from upstream**: none
- **Do**: CONTRIBUTING — docs link → `https://code.claude.com/docs/en/plugins`; naming adds reserved prefixes (`claude-`, `anthropic-`, `cc-plugin-`) and "marketplace entry name = plugin.json name"; step 3 adds the SKILL.md frontmatter policy (keys from the Shared Brief), the `{"hooks": {…}}` wrapper for `hooks/hooks.json`, and "run `claude plugin validate plugins/<name>` and `/marketplace-tools:validate-plugin <name>`"; review process: the maintainer updates marketplace.json, the root README table and both `docs/diagrams/repo-architecture.*` files. README Quick Start adds updating: `claude plugin marketplace update claude-play` then `claude plugin update <plugin>@claude-play` (third-party marketplaces don't auto-update by default). PR template: "repo-required fields" wording where it says plugin.json fields are required.
- **Done means**: `grep -n "docs.anthropic.com" CONTRIBUTING.md` → none; README table rows unchanged (`git diff README.md` touches only Quick Start)
- **Commit msg**: `docs(contributing): naming, frontmatter policy, validation and update steps`
- **Handoff**:

### Step 22b: Template comment (inline, D3)
- **Route**: inline · score 1 — user-authorized pass of the template guard
- **Do**: insert after the frontmatter of `plugins/_template/skills/example-skill/SKILL.md`: `<!-- Allowed frontmatter keys (repo policy): name, description, disable-model-invocation, user-invocable, argument-hint, compatibility, license, metadata. -->` using a one-off `node -e` script (Edit/Write are blocked there by design)
- **Done means**: `git diff --stat` shows only that file in this step
- **Commit msg**: `docs(template): list the allowed SKILL.md frontmatter keys`
- **Handoff**:

### Step 23: Revise the extensibility reference
- **Route**: general-purpose · opus · score 6 — 568-line doc, ~50 corrections, only judgment verifies
- **Files**: modify `docs/claude-code-extensibility-reference.md`
- **Needs from upstream**: none
- **Do**: re-check each section against the live official page (plugins: https://code.claude.com/docs/en/plugins-reference and the pages under /docs/en/plugins/ — manifest, marketplace-reference, cli-reference; skills: /docs/en/skills; hooks: /docs/en/hooks; subagents: /docs/en/sub-agents) and correct it. Must-fix: plugin component dirs (`output-styles/`, `themes/`, `monitors/`, `workflows/`, `bin/`) and fields (`userConfig`, `dependencies`, `defaultEnabled`, `displayName`); `commands`/`agents` paths replace the default scan; plugin `settings.json` honors only `agent` and `subagentStatusLine`; no `pip` source type; `strict:false` + plugin.json component fields = conflict; `${CLAUDE_PLUGIN_DATA}`; `managed` scope; `validate --strict`; no "standard vs extension" frontmatter split; `version` is not a skill field (`metadata.version`); description+when_to_use 1,536 chars (1,024 is the API limit); `user-invocable`; substitutions (`$name`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_EFFORT}`…) and ```` ```! ```` blocks; compaction re-attaches each skill's latest invocation (first 5,000 tokens, 25,000 total); 33 hook events; hooks from all sources merge (no priority ladder); `tool_response` (not `tool_result`); `permissionDecision` `defer`; `mcp_tool` hook type; `additionalContext` inside `hookSpecificOutput`; PreCompact can block; HTTP hook timeout 600 s; hook env vars list (no `$CLAUDE_SESSION_ID`); matcher exact-list vs regex rule; subagent `model` adds `fable`/full IDs, `permissionMode` adds `auto`, fields `effort`/`color`/`omitClaudeMd`/`initialPrompt`; Explore uses the main model; precedence managed > `--agents` > project > user > plugin; nesting up to 3 levels; background by default from the main conversation; agent file edits reload live; memory 200 lines or 25 KB. Add a subsection "What `claude plugin validate` checks" (manifests and MCP entries; skill frontmatter parse errors; not unknown keys; `--strict`). Re-date line 3: "October 2026, checked against Claude Code v2.1.304".
- **Done means**: `grep -n "user-invokable\|17 total\|tool_result" docs/claude-code-extensibility-reference.md` → none; every section keeps a Sources link; CONCERNS lists any page that couldn't be fetched
- **Commit msg**: `docs(reference): align extensibility reference with current Claude Code docs`
- **Handoff**:

### Step 24: Version lives in plugin.json and README only (D1)
- **Route**: general-purpose · sonnet · score 5 — manifests + hooks + lint (risk floor) → opus review gate
- **Precondition**: `feat/sql-server-tools-v1.1` merged into `main`, and `main` merged into `chore/claude-code-alignment` by the orchestrator (sql-server-tools rows: take main's version)
- **Files**: modify `.claude-plugin/marketplace.json`, `.claude/hooks/validate-marketplace-json.mjs` + `.test.mjs`, `plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs` + `.test.mjs`, `plugins/marketplace-tools/skills/new-plugin/SKILL.md`, `CLAUDE.md`, `.claude/rules/roadmap-checker.md`, `plugins/marketplace-tools/.claude-plugin/plugin.json`, `README.md` (marketplace-tools row)
- **Needs from upstream**: Steps 1, 5, 7, 4 handoffs
- **Do**: fetch the official marketplace reference and quote the sentence saying the plugin.json version wins over the entry — if not found, STOP and report BLOCKED (D1 gets re-decided). Tests first: hook `entry without version passes`; lint `registered entry without version → no version check`. Then remove `version` from every marketplace entry; hook check 5 no longer requires `version`, check 8 compares names only; lint check 8 names only; new-plugin entry template without `version`; CLAUDE.md bump rule → "two places together: `plugin.json` (authoritative — it wins over any marketplace value) and the root README table"; roadmap-checker.md "(3 places, see CLAUDE.md)" → "(2 places, see CLAUDE.md)"; marketplace-tools → `1.1.1` in plugin.json + README row.
- **Done means**: all tests pass; validators pass; `node -e "const m=require('./.claude-plugin/marketplace.json');process.exit(m.plugins.some(p=>'version' in p)?1:0)"` → exit 0
- **Commit msg**: `chore(repo): plugin version lives in plugin.json and README only`
- **Handoff**:
