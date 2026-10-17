# roadmap-planner v2 + roadmap-tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `roadmap-planner` v1 with a v2 that builds a living roadmap (strategy + tracking folder + vendored checker), add `roadmap-tracker` to keep it alive, and hook `plan-coordinator` into it.

**Architecture:** Two skills in `plugins/productivity-tools/skills/`. One format contract (`roadmap-planner/references/formats.md`) defines every file; a single-file, zero-dependency Node checker (`roadmap-tracker/scripts/check-roadmap.mjs`) enforces it and is copied into each roadmap folder. Machine-checked structure lives in HTML-comment anchors and position-mapped tables, so prose and headers can be in any language.

**Tech Stack:** Markdown skills; Node ≥ 18 ESM (`node:fs`, `node:path`, `node:child_process`, `node:os`, `node:test`, `node:assert`); git CLI.

**Spec:** `docs/plans/2026-10-16-roadmap-planner-v2-design.md`

## Global Constraints

- Skill text in English; generated roadmap documents in the project's language.
- SKILL.md frontmatter: only `name` and `description` (repo rule). Each SKILL.md < 500 lines; references one level deep; a TOC at the top of any reference file > 100 lines.
- Checker: one file, Node ≥ 18, ESM, zero npm dependencies, no network. Line 1 is exactly `// check-roadmap 1.2.0 format 1`.
- `FORMAT_VERSION = 1`; checker version = plugin version `1.2.0`.
- The skills never produce dates, durations, metrics or estimates that the user or a source did not supply; unsourced claims carry `ASSUMPTION` or `UNSOURCED`.
- `roadmap-tracker` never commits; a strategy revision is written only after the user approves it.
- `plan-coordinator` changes are limited to the roadmap hook; routing and waves untouched.
- Version `1.2.0` bumped together in `plugins/productivity-tools/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and the root `README.md` table.
- Commits: `feat(productivity-tools): …` / `docs: …` / `test(productivity-tools): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `feat/roadmap-planner-v2`.
- Test command: `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`.

## Review Focus

1. **CRLF files** (this repo checks out with `core.autocrlf`; roadmap files edited on Windows) → parsing identical to LF. Test in Task 2.
2. **Escaped pipe `\|` inside a table cell** → stays one cell, column positions unchanged. Test in Task 2.
3. **Localized, accented vocabulary** (`não iniciada`, `integrada`, `vigente`) in config and files → statuses recognized exactly. Test in Task 2.
4. **CI clone without the local integration branch** (only `origin/<branch>` or nothing) → falls back to `origin/<branch>`, else one warning, never a crash or a false error. Test in Task 3.
5. **Freshly created roadmap** (no decisions rows, one log row, `measurements: null`) → 0 errors. Test in Task 2.

---

## File Structure

```
plugins/productivity-tools/skills/
  roadmap-planner/
    SKILL.md                         rewrite (v2 workflow)
    references/clarify.md            create
    references/decompose.md          create
    references/formats.md            create (the contract)
  roadmap-tracker/
    SKILL.md                         create
    references/events.md             create
    scripts/check-roadmap.mjs        create
    scripts/check-roadmap.test.mjs   create
    scripts/fixtures/valid/          create (reference roadmap folder)
  plan-coordinator/
    SKILL.md                         modify Step 1
    references/delegation-protocol.md modify wave loop step 10 + Completion
    references/progress-template.md  modify header
docs/plans/roadmap-planner-v2/scenarios/  create (behavioural inputs)
plugin.json, marketplace.json, README.md, CLAUDE.md,
plugins/productivity-tools/README.md, docs/diagrams/repo-architecture.md  modify (Task 8)
```

---

### Task 1: Format contract and reference fixture

**Files:**
- Create: `plugins/productivity-tools/skills/roadmap-planner/references/formats.md`
- Create: `plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid/{roadmap.config.json,README.md,strategy.md,state.md,decisions.md,log.md,critical-path.md,sources.md,requirements.md}`

**Interfaces:**
- Produces: the anchors, table column orders, config schema and vocabulary below. Tasks 2–7 use these names exactly.

- [ ] **Step 1: Write `formats.md`** (TOC at top) with these decisions, plus a fill-in template for every file and the deliverable card.

Config `roadmap.config.json` (all keys required; `measurements` may be `null`):

```json
{
  "formatVersion": 1,
  "language": "en",
  "strategy": "../2026-01-01-roadmap-sample-plan.md",
  "integrationBranch": "main",
  "files": { "readme": "README.md", "state": "state.md", "decisions": "decisions.md", "log": "log.md",
             "criticalPath": "critical-path.md", "measurements": null, "sources": "sources.md", "requirements": "requirements.md" },
  "vocab": {
    "deliverableStatuses": ["not-started", "spec", "plan", "executing", "on-branch", "integrated", "released", "measured"],
    "integratedStatuses": ["integrated", "released", "measured"],
    "decisionInForce": "in-force", "decisionPending": "pending", "decisionSupersededBy": "superseded by",
    "coverageCovered": "covered", "coverageOutOfScope": "out-of-scope", "coverageNeedsClarification": "needs-clarification",
    "branchLive": "live", "branchDeleted": "deleted",
    "markers": ["ASSUMPTION", "UNSOURCED"], "bannedPhrases": ["this commit"]
  },
  "tracks": ["engineering", "decisions", "external", "release", "measurement"],
  "limits": { "nowItems": 5, "cellChars": 300 }
}
```

Anchored blocks — opening `<!-- roadmap:<name> [k=v …] -->`, closing `<!-- /roadmap:<name> -->`; values with spaces in double quotes. Tables inside blocks are position-mapped (header text free, any language):

| File | Block | Content (column order) |
|---|---|---|
| strategy | `version` (single comment, no closing) | `<!-- roadmap:version 1.0 2026-01-01 -->` |
| strategy | `card` (attrs `id phase track priority size depends reqs critical`) | one per deliverable; `depends`/`reqs` comma lists or `-`; `critical=true\|false` |
| strategy (inside card) | `acceptance` | ordered list; each top-level item = one criterion |
| strategy (inside card) | `risks` | list; each item "risk → mitigation" |
| state | `now` | ordered list |
| state | `panel` | Deliverable · Status · Evidence · Next step |
| state | `blockers` | ID · Blocker · Affects · Since · Unblocks when |
| state | `pending` | list "(owner) item" |
| state | `inflight` | Branch · Kind (`branchLive`/`branchDeleted`) · Note |
| decisions | `decisions` | ID · Date · Deliverable · Decision · Discarded alternative · Contradicts · Revisit when · Origin · Status |
| log | `log` | Date · Deliverable · What happened · Evidence |
| sources | `sources` | ID · Source (path/URL) · What it is · Read on · Reliability |
| sources | `conflicts` | list "SRC-a vs SRC-b: …" |
| requirements | `requirements` | ID · Requirement · Type · Sources · Deliverables · Coverage |
| measurements | `measurements` | Date · Deliverable · Kind · Detail · Recorded · Billed · Status |

IDs: `E<n>` (deliverables), `REQ-NNN`, `SRC-NN`, `DEC-NNN`, `BLQ-n`; never reused. Status cell: segments split by `;`, each `[<label>:] <status>[ (note)]`. Evidence: SHAs, paths and URLs in backticks. Coverage cell: `covered`, `out-of-scope: <reason>` or `needs-clarification`. Decision status: `in-force`, `pending` or `superseded by DEC-NNN`. The strategy's decision section only points to `decisions.md`; it cites a `DEC` only where it absorbs it. Strategy template sections (from the design): changelog; objective + acceptance criterion + DoD; non-goals; assumptions (owner, re-validate when); where we are; thesis; deliverables overview; deliverable cards (description, pieces as vertical slices, acceptance, DoD, risks); metrics & targets (sourced only); flags; cross-cutting risks; decisions (pointer); external pending items; open questions; coverage summary; version history; sources (pointer). Also document: the generated `README.md` must state the command `node <roadmap-folder>/check-roadmap.mjs` and the "when to update" table from the design.

- [ ] **Step 2: Write `fixtures/valid/`** following `formats.md`, in English: config as above with `"strategy": "strategy.md"`; 3 cards (`E1` critical with a risks block, `E2` depends `E1`, `E3` depends `E1,E2`), each with 2 acceptance items; panel statuses only `not-started`/`spec` and no SHAs; 2 sources and 1 conflict; `REQ-001`,`REQ-002` covered, `REQ-003` `out-of-scope: …`; one decision `DEC-001` `in-force` whose Contradicts cell names `E2` and which `strategy.md` cites; 2 log rows in descending date; `now` with 3 items; empty `blockers`, `inflight` tables (header only).

- [ ] **Step 3: Commit** — `git add` both paths; `docs(productivity-tools): roadmap format contract and reference fixture`. (The fixture is proven by Task 2's first test, "valid fixture has no problems".)

---

### Task 2: Checker core (parsing + structural checks)

**Files:**
- Create: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs`
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Consumes: Task 1 formats and `fixtures/valid/`.
- Produces (named ESM exports):
  - `FORMAT_VERSION: 1`, `CHECKER_VERSION: '1.2.0'`
  - `readBlocks(text: string, name: string): {attrs: Record<string,string>, body: string}[]`
  - `parseTable(body: string): string[][]` — data rows only (header and separator dropped), cells trimmed, `\|` unescaped
  - `loadRoadmap(folder: string): Roadmap` — `{folder, config, strategyPath, strategy: string, files: Record<role, string|null>}`; throws `Error` whose message starts `config:` on missing/invalid config
  - `checkRoadmap(r: Roadmap, git: GitAdapter|null): Problem[]` with `Problem = {severity: 'error'|'warning', code: string, file: string, message: string}` (git checks arrive in Task 3; here `git` is ignored)

- [ ] **Step 1: Write the failing tests.** Helper `fixture(mutate?: (files: Record<string,string>) => void): string` copies `fixtures/valid` to `fs.mkdtempSync` and applies string edits. One test per code; each asserts `codes(problems)` contains the code with the right severity, and the valid fixture yields `[]`:

```js
test('valid fixture has no problems', () => assert.deepEqual(run(fixture()), []));
test('format-version newer than checker is an error', () => expectCode(run(fixture(f => bumpFormat(f, 2))), 'format-version', 'error'));
```

Error codes: `format-version`, `unknown-id` (any cited `DEC/REQ/SRC/BLQ/E` without a definition), `duplicate-id`, `bad-status`, `now-limit` (>`limits.nowItems`), `cell-limit` (state/log cells >`limits.cellChars`), `log-order` (dates not descending), `banned-phrase` (log), `missing-evidence` (empty log Evidence), `uncovered-req` (coverage `covered` with no deliverables, or empty out-of-scope reason, or unknown coverage), `card-no-req`, `card-acceptance` (<2 items), `card-no-panel-row`, `panel-unknown-deliverable`, `dependency-cycle`, `superseded-link` (target missing), `unknown-track` (card `track` not in `tracks`), `bad-priority` (card `priority` not one of `Must`, `Should`, `Could`, `Won't`). Warning codes: `contradiction-unabsorbed` (in-force, Contradicts not empty/`-`/`—`, ID not in strategy), `needs-clarification`, `critical-no-risk`, `markers` (one warning with the count of `vocab.markers` in the strategy, only if > 0), `req-card-asymmetry` (REQ lists E but card `reqs` lacks the REQ, or vice versa).

Plus the Review Focus tests:

```js
test('CRLF files parse like LF', () => assert.deepEqual(run(fixture(toCRLF)), []));
test('escaped pipe stays in one cell', () => assert.deepEqual(parseTable('|a|b|\n|-|-|\n|x \\| y|z|'), [['x | y', 'z']]));
test('localized accented vocabulary', () => assert.deepEqual(run(fixture(localizePtBR)), []));  // 'não iniciada','vigente', etc. in config and files
test('fresh roadmap passes', () => assert.deepEqual(run(fixture(f => { clearDecisions(f); keepOneLogRow(f); }) ), []));
```

Helpers: `run(folder, git = okGit) = checkRoadmap(loadRoadmap(folder), git)` where `okGit` answers `true` to everything (so Task 3's `no-git` warning does not appear here); `localizePtBR` rewrites the `vocab` values in the config to Portuguese (`não iniciada`, `integrada`, `vigente`, `substituída por`, `coberto`, `fora de escopo`, `precisa de esclarecimento`) and every matching token in the files consistently. `measurements` is already `null` in the fixture.

- [ ] **Step 2: Run** `node --test …/check-roadmap.test.mjs` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the exports above. Line 1 header from Global Constraints. Normalize `\r\n` → `\n` on read. Cycle detection by DFS over card `depends`; report one `dependency-cycle` naming the cycle path.

- [ ] **Step 4: Run tests** — Expected: all PASS.

- [ ] **Step 5: Commit** — `feat(productivity-tools): roadmap checker core`.

---

### Task 3: Git checks

**Files:**
- Modify: `…/scripts/check-roadmap.mjs`
- Test: `…/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Produces: `GitAdapter = {commitExists(sha): boolean, isAncestor(sha, ref): boolean, branchExists(name): boolean}`; `createGitAdapter(folder: string): GitAdapter | null` (null outside a repo; uses `git -C <folder>` via `spawnSync`, never a shell string).

- [ ] **Step 1: Write the failing tests** in a temp repo (`git init`, commit the fixture, `git branch -M main`):
  - `sha-missing` (error): a backticked 7–40 hex token in panel Evidence or log Evidence that is not a commit.
  - `not-integrated` (error): a panel segment with an `integratedStatuses` status whose Evidence SHAs are not all ancestors of the integration ref; passes after the SHA is merged into `main`.
  - `branch-live-missing` / `branch-deleted-exists` (errors) from the `inflight` table.
  - `no-git` (warning, once) when `git` is `null`; no git-dependent errors then.
  - Review Focus 4: rename `main` to `other` and create `refs/remotes/origin/main` → ancestor check uses `origin/main`, no error; with neither → one `integration-branch-missing` warning and no `not-integrated` errors.

- [ ] **Step 2: Run** — Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** in `checkRoadmap` (integration ref = `integrationBranch` if it exists, else `origin/<integrationBranch>`, else warning).
- [ ] **Step 4: Run** — Expected: all PASS.
- [ ] **Step 5: Commit** — `feat(productivity-tools): roadmap checker git checks`.

---

### Task 4: CLI and self-reported staleness (layer 2)

**Files:**
- Modify: `…/scripts/check-roadmap.mjs`
- Test: `…/scripts/check-roadmap.test.mjs`

**Interfaces:**
- Produces:
  - CLI `node check-roadmap.mjs [folder]` — folder defaults to the script's own directory (the vendored case). Prints one line per problem `ERROR|WARN <file>: <message> [<code>]`, then `check-roadmap: N error(s), M warning(s)`; exit 1 iff errors. `config:` load failures print `ERROR` and exit 1.
  - `node check-roadmap.mjs --version` prints `1.2.0 format 1` and exits 0.
  - `compareVersions(a: string, b: string): -1|0|1` (numeric semver, no pre-release).
  - `findNewerPluginCopy(selfPath: string, selfVersion: string, cacheRoot: string): {path: string, version: string} | null` — scans `<cacheRoot>/*/productivity-tools/*/skills/roadmap-tracker/scripts/check-roadmap.mjs`, reads line 1 only, ignores `selfPath`; `cacheRoot` = env `ROADMAP_CHECK_PLUGIN_CACHE` or `~/.claude/plugins/cache`.
  - Warning code `checker-stale`: "newer checker <v> available at <path>; ask roadmap-tracker to refresh".
- Run guard: CLI runs only when `import.meta.url` equals `pathToFileURL(process.argv[1]).href`.

- [ ] **Step 1: Write the failing tests** (spawn `process.execPath`):
  - `--version` output exactly `1.2.0 format 1`.
  - Exit 0 on valid fixture, 1 after an error mutation; summary line present.
  - Copy the script into a fixture folder whose path contains a space, run with `cwd` = `os.tmpdir()` and no folder argument → exit 0.
  - With `ROADMAP_CHECK_PLUGIN_CACHE` pointing at a temp tree holding a copy whose line 1 says `1.3.0` → one `checker-stale` warning, exit still 0; with `1.1.0` or empty cache → none.
  - `compareVersions('1.10.0','1.9.0') === 1`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: all PASS; also `node …/check-roadmap.mjs …/fixtures/valid` prints `check-roadmap: 0 error(s), 0 warning(s)`.
- [ ] **Step 5: Commit** — `feat(productivity-tools): roadmap checker CLI and staleness warning`.

---

### Task 5: roadmap-planner v2 skill

**Files:**
- Modify (rewrite): `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`
- Create: `…/roadmap-planner/references/clarify.md`, `…/roadmap-planner/references/decompose.md`
- Create: `docs/plans/roadmap-planner-v2/scenarios/s1-conflict/{objective.md,source-a.md,source-b.md}`, `…/s2-unsourced/objective.md`

**Interfaces:**
- Consumes: `formats.md` (Task 1); checker CLI (Task 4), reached as `../roadmap-tracker/scripts/check-roadmap.mjs` relative to the skill base directory Claude Code prints on invocation.
- Produces: roadmap folders that pass the checker; the handoff line naming `roadmap-tracker`.

- [ ] **Step 1: Write the scenarios.** s1: an objective plus two sources where A requires "export to CSV" and B states "exports are PDF only". s2: an objective containing "cut handling time by 40%" with no source for the number.

- [ ] **Step 2: Write `SKILL.md`.** Frontmatter `description` starts "Use when starting a NEW roadmap…" and says it is not for updating an existing one (→ `roadmap-tracker`) nor for task plans (→ `superpowers:writing-plans`) nor for report SWOT (→ `report-analyzer`). Body = design workflow steps 0–8, with these rules stated explicitly:
  - Step 0 stops if the target folder already has `roadmap.config.json`.
  - Discovery covers repo docs, specs, issues and git history; the web only if the user allows it. Source reading delegated to subagents returning ≤10-line summaries per `SRC`; conflicts recorded, never resolved silently.
  - Clarify per `references/clarify.md`: ≤5 questions per round, one at a time, each with a recommended answer; answers → `DEC` (choices) or assumptions.
  - Decompose per `references/decompose.md`; a deliverable ends at "gets its own spec and plan".
  - Write all files per `formats.md` in the project's language; copy the checker to `<folder>/check-roadmap.mjs`.
  - Verify: run the vendored checker until 0 errors; then one fresh-context reviewer subagent with the brief "report only correctness errors, uncovered requirements, untraced claims and invented numbers; no style"; fix; re-run.
  - Never write dates/durations/metrics without a source or user answer; tag `ASSUMPTION`/`UNSOURCED`.
  - Handoff: summary, `now`, next = first deliverable → `superpowers:brainstorming` → `superpowers:writing-plans` → `plan-coordinator` (with the plan's `**Roadmap:**` line, Task 7); later events → `roadmap-tracker`.

- [ ] **Step 3: Write `clarify.md`** — ambiguity categories (from `docs/reports/2026-10-16-roadmap-best-practices.md` §B and spec-kit `clarify`), impact × uncertainty scoring (1–3 each), question format with recommended answer, stop rule, recording rule. **`decompose.md`** — requirement types, extraction rules, vertical-slice splitting patterns, walking skeleton first, outcome-named phases with entry/exit criteria, tracks, MoSCoW (challenge the user when more than half are Must), WSJF only with user-supplied inputs, size = range + basis or `not estimated`, DAG and critical path as ordering only. TOC on either file if > 100 lines.

- [ ] **Step 4: Behavioural check.** A fresh subagent follows `SKILL.md` literally on s1 and on s2, answering its own questions with the recommended answers, writing to the scratchpad, and listing every ambiguity hit. Expected: s1 — conflict in the `conflicts` block, not resolved; every `REQ` covered or out-of-scope; vendored checker 0 errors. s2 — "40%" appears only tagged `ASSUMPTION`/`UNSOURCED`, never as a target. Fix the skill for each ambiguity; re-run once.

- [ ] **Step 5: Commit** — `feat(productivity-tools): roadmap-planner v2`.

---

### Task 6: roadmap-tracker skill (layers 1 and 3)

**Files:**
- Create: `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md`
- Create: `…/roadmap-tracker/references/events.md`
- Create: `docs/plans/roadmap-planner-v2/scenarios/s3-tracker/event.md`

**Interfaces:**
- Consumes: `../roadmap-planner/references/formats.md`; `scripts/check-roadmap.mjs` (`--version`, exit codes); plan-coordinator progress header `**Roadmap**:` (Task 7).

- [ ] **Step 1: Write `SKILL.md`.** `description` starts "Use when an existing roadmap folder (roadmap.config.json) needs updating…" and lists the events. Body:
  - **Cold start:** read config, `state`, the 10 newest `log` rows, pending `DEC`.
  - **Layer 1:** compare `node <skill>/scripts/check-roadmap.mjs --version` with `node <folder>/check-roadmap.mjs --version`; if the plugin's is newer, run it on the folder: exit 0 → copy it over and add a `log` row "checker refreshed <old> → <new>"; exit 1 → keep the old copy and add to the `pending` block "(maintainer) checker <new> available: N errors to fix". Never replace silently.
  - **Layer 3:** if `formats.md` `formatVersion` > config `formatVersion`, run the migration in `events.md` before writing anything; refuse to write a newer format than the vendored checker reports.
  - **Event → files** table from the design; may read a plan-coordinator progress file to detect closed steps.
  - Edit in the working tree only; no commit. Run the vendored checker; 0 errors before handing back (warnings allowed, listed).
  - **Revision:** propose vN+1 (absorbed `DEC`, changed sections), write only after approval, update the `version` anchor, changelog, "where we are".

- [ ] **Step 2: Write `events.md`** — one recipe per event: decision (incl. how to fill Contradicts), piece/step closed, integration, branch deleted, blocker opened/closed, measurement, new source, new requirement mid-flight, end of piece/phase (revision), checker refresh, migration (`formatVersion` 1 has none; give the procedure template).

- [ ] **Step 3: Behavioural check.** s3: a copy of `fixtures/valid` + event "user decides E2 ships without its second piece" (contradicts E2). Expected: `DEC-002` appended with Contradicts filled; checker warns `contradiction-unabsorbed`; revision proposed and not written. Second run: replace the vendored copy's line 1 with `// check-roadmap 1.1.0 format 1` → refreshed and logged; then, again with the `1.1.0` header, inject a 6th `now` item so the plugin's checker exits 1 → old copy kept, pending item added. Fix ambiguities; re-run once.

- [ ] **Step 4: Commit** — `feat(productivity-tools): roadmap-tracker skill`.

---

### Task 7: plan-coordinator roadmap hook (layer 4)

**Files:**
- Modify: `plugins/productivity-tools/skills/plan-coordinator/SKILL.md` (Step 1 extraction list)
- Modify: `…/plan-coordinator/references/progress-template.md` (header)
- Modify: `…/plan-coordinator/references/delegation-protocol.md` (Wave loop step 10 "Advance"; "Completion")

- [ ] **Step 1: Edit.** Step 1 also extracts an optional plan header line `**Roadmap:** <roadmap folder>`. Template header gains `**Roadmap**: <folder> | none` after `**Plan**:`. Step 10 and Completion gain: "If `**Roadmap**` is set, invoke `roadmap-tracker` with the event 'wave N closed (steps …)' / 'plan completed', after the wave gate and before starting the next wave." No other change.
- [ ] **Step 2: Behavioural check.** A fresh subagent reads the edited skill and answers, for a plan with and without the line: where is the roadmap recorded, and when is `roadmap-tracker` invoked. Expected: recorded in the progress header; invoked after each wave gate and at completion only when set.
- [ ] **Step 3: Commit** — `feat(productivity-tools): plan-coordinator roadmap hook`.

---

### Task 8: Version, catalogs and validation

**Files:**
- Modify: `plugins/productivity-tools/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md` (version `1.2.0`)
- Modify: `plugins/productivity-tools/README.md` (skills table + `roadmap-tracker`, pipeline `… → roadmap-planner → plan-coordinator ⇄ roadmap-tracker`, output dirs: roadmap-planner → `docs/plans/roadmap-<topic>/`, prerequisites: Node ≥ 18 for the checker)
- Modify: `CLAUDE.md` (plugins table components, Design Docs: this design, this plan, the research report)
- Modify: `docs/diagrams/repo-architecture.md` (add `roadmap-tracker` node in both diagrams)

- [ ] **Step 1: Edit** the files above.
- [ ] **Step 2: Validate.** `claude plugin validate .` and `claude plugin validate plugins/productivity-tools` → no errors; marketplace hook `echo '{"tool_input":{"file_path":".claude-plugin/marketplace.json"}}' | bash .claude/hooks/validate-marketplace-json.sh` → no output; `marketplace-tools` `validate-plugin` skill on `productivity-tools` → pass; full test command → PASS.
- [ ] **Step 3: Commit** — `feat(productivity-tools): v1.2.0 roadmap-planner v2 and roadmap-tracker`.
