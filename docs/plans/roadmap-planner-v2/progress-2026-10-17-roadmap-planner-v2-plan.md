# Execution Progress: roadmap-planner v2 + roadmap-tracker
**Plan**: docs/plans/2026-10-17-roadmap-planner-v2-plan.md
**Spec**: docs/plans/2026-10-16-roadmap-planner-v2-design.md
**Started**: 2026-10-17 | **Last Updated**: 2026-10-17
**Status**: Completed (2026-10-17; final review PASS on `cc6e7c4`)

## Recovery State
<!-- Read THIS first after compaction or restart -->
**Last COMPLETED Wave**: 2 (commits `c06ac00` checker header fix, `99503b2` planner, `aaca791` tracker; gate 77/77)
**Last COMPLETED Wave (cont.)**: 3 (5b PASS s1+s2, 6b PASS runs 1-3; fix-ups committed `1c133fb` tracker, `fad70a0` planner)
**Last DELEGATED Wave**: 4
**Last COMPLETED Wave (cont.)**: 4 (`462de95`; G-R ac8000574004f0dc1: 1 catalog defect + report-analyzer trigger overlap fixed inline; `.excalidraw` diagram not updated — repo rule requires it only for plugins, left as known gap)
**Last COMPLETED Wave (final)**: 5 — whole-branch review af058b8cd2f3aed6c: 1 blocker + 4 minor → `603de7e`; re-verify PASS + 1 minor → `cc6e7c4`
**In-Flight Agents**: none
**Next Action**: none — hand off to the user (merge/PR decision is theirs)
**Next Action**: verify G; G-R review (opus); then Wave 5 final review
**Next Action**: Wait for A and B; then A-R review (opus) and 7b (haiku)

## Execution Map
**Steps**: 12 (execute 12, skip 0) | **Waves**: 5 | **Effort**: not estimated (the plan gives none) | **Tiers**: inline 0 · haiku 1 · sonnet 6 · opus 5 (2 executors, 3 reviewers) | **Review gates**: 2 + final whole-branch review

| Wave | Group | Steps | Agent | Tier | Score | Mode | Depends On | Writes | Status |
|------|-------|-------|-------|------|-------|------|------------|--------|--------|
| 1 | A | 1-4 | general-purpose | sonnet | 5 | Bundle + review | — | roadmap-planner/references/formats.md, roadmap-tracker/scripts/** | Pending |
| 1 | B | 7a | general-purpose | sonnet | 4 | Single | — | plan-coordinator/SKILL.md, plan-coordinator/references/{progress-template,delegation-protocol}.md | Pending |
| 1 | A-R | A review | general-purpose (read-only) | opus | — | Review | A | — | Pending |
| 1 | B-C | 7b | general-purpose (read-only) | haiku | 2 | Single | B | — | Pending |
| 2 | C | 5a | general-purpose | opus | 6 | Single | A, A-R | roadmap-planner/SKILL.md, roadmap-planner/references/{clarify,decompose}.md, docs/plans/roadmap-planner-v2/scenarios/s1-*, s2-* | Pending |
| 2 | D | 6a | general-purpose | opus | 6 | Single | A, A-R, B | roadmap-tracker/SKILL.md, roadmap-tracker/references/events.md, docs/plans/roadmap-planner-v2/scenarios/s3-* | Pending |
| 3 | E | 5b | general-purpose | sonnet | 4 | Single (behavioural) | C | scratchpad only | Pending |
| 3 | F | 6b | general-purpose | sonnet | 4 | Single (behavioural) | D | scratchpad only | Pending |
| 4 | G | 8 | general-purpose | sonnet | 4 | Single + review | C, D, E, F, B-C | plugin.json, marketplace.json, README.md, CLAUDE.md, productivity-tools/README.md, docs/diagrams/repo-architecture.md | Pending |
| 4 | G-R | G review | general-purpose (read-only) | opus | — | Review | G | — | Pending |
| 5 | H | final | general-purpose (read-only) | opus | — | Whole-branch review | G-R | — | Pending |

**Mode key**: Bundle = sequential steps, 1 agent · `+ review` = read-only reviewer must PASS before dependents start · behavioural = a fresh agent follows the skill literally on a scenario and lists ambiguities; fixes go back to the writing agent via SendMessage (≤2 rounds).

## Shared Brief
<!-- Pasted verbatim at the top of every subagent prompt. -->
- **Goal**: Build `roadmap-planner` v2 (creates a living roadmap: versioned strategy + tracking folder + vendored checker) and a new `roadmap-tracker` skill (keeps it alive), plus a small roadmap hook in `plan-coordinator`, in the `productivity-tools` plugin of the claude-play marketplace.
- **Repo**: `D:\projects\claude-play` (Git Bash: `/d/projects/claude-play`), branch `feat/roadmap-planner-v2`. Always use absolute paths; the shell cwd resets between commands.
- **Spec**: `docs/plans/2026-10-16-roadmap-planner-v2-design.md` (read it; it is the source of intent). Research behind it: `docs/reports/2026-10-16-roadmap-best-practices.md`.
- **Architecture**: skills at `plugins/productivity-tools/skills/<skill>/SKILL.md` + `references/*.md`. One format contract `roadmap-planner/references/formats.md`; one single-file zero-dependency Node ESM checker `roadmap-tracker/scripts/check-roadmap.mjs` (+ `check-roadmap.test.mjs`, `fixtures/valid/`), copied into every generated roadmap folder. Machine-checked structure = HTML-comment anchors `<!-- roadmap:<name> k=v -->` … `<!-- /roadmap:<name> -->` + position-mapped tables, so prose/headers may be in any language.
- **Conventions**:
  - Skill text in English; generated roadmap documents in the target project's language.
  - SKILL.md frontmatter ONLY `name` and `description`; SKILL.md < 500 lines; references one level deep; TOC at top of any reference > 100 lines.
  - Checker: Node ≥ 18, ESM, zero npm deps, no network; line 1 exactly `// check-roadmap 1.2.0 format 1`; `FORMAT_VERSION = 1`, `CHECKER_VERSION = '1.2.0'`. Use `spawnSync('git', [...])`, never shell strings. Normalize CRLF.
  - Skills never produce dates, durations, metrics or estimates not supplied by the user or a source; unsourced claims tagged `ASSUMPTION` / `UNSOURCED`.
  - `roadmap-tracker` never commits; strategy revisions are written only after user approval.
- **Commands**: test `node --test /d/projects/claude-play/plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` · run checker `node <folder>/check-roadmap.mjs` or `node <script> <folder>` · validate `claude plugin validate /d/projects/claude-play` and `claude plugin validate /d/projects/claude-play/plugins/productivity-tools`.
- **Do not touch**: `plugins/_template/` (hook-protected), other plugins, `docs/plans/2026-10-1[67]-*` (design and plan), the installed plugin cache under `~/.claude/plugins/cache/`.
- **Do not commit**: the orchestrator commits after verifying each step. Do not run `git stash`, `git reset`, `git checkout -- <file>` or any history rewrite.
- **Glossary**: *deliverable* = `E<n>`, ends at "gets its own spec and plan"; *piece* = vertical slice of a deliverable, shippable alone; *vendored checker* = the copy of `check-roadmap.mjs` inside a roadmap folder; *layers 1–4* = the four mechanisms keeping the vendored copy current (spec § Checker).

## Steps
| # | Step | Status | Tier · Attempts | Score (S/A/R/B/V) | Note |
|---|------|--------|-----------------|-------------------|------|
| 1-4 | Format contract + checker (core, git, CLI) | Done (`f09b6fe`) | sonnet · 1 + 2 fix-ups | 5 (1/1/1/1/1) bundle max | 73/73 tests, 5× stable |
| A-R | Review of 1-4 | PASS (round 3 by orchestrator verification) | opus · 2 rounds | — | round 1: 8 defects; round 2: all-digit SHA bug = the flake |
| 7a | plan-coordinator roadmap hook | Done (`853cf3d`) | sonnet · 1 + 2 fix-ups | 4 (1/0/0/1/2) | fix-ups: invocation order; `none` ≠ set |
| 7b | Behavioural check of the hook | Done | haiku · 1 | 2 (0/0/1/0/1) | found the `none` ambiguity |
| 5a | roadmap-planner v2 skill | Pending | opus · 0 | 6 (2/1/1/1/1)+V-heavy | — |
| 5b | Behavioural check s1, s2 | Pending | sonnet · 0 | 4 (1/1/1/0/1) | the skill must work on sonnet |
| 6a | roadmap-tracker skill | Pending | opus · 0 | 6 (1/1/1/1/2) | — |
| 6b | Behavioural check s3 | Pending | sonnet · 0 | 4 (1/1/1/0/1) | — |
| 8 | Version, catalogs, validation | Pending | sonnet · 0 | 4 (2/0/0/2/0) | risk floor (manifests/registry) → opus review |
| G-R | Review of 8 | Pending | opus · 0 | — | — |
| H | Final whole-branch review | Pending | opus · 0 | — | mandatory even if all steps pass |

## Wave Execution Log
| Wave | Groups | Delegated | Completed | Agent IDs | Notes |
|------|--------|-----------|-----------|-----------|-------|
| 1 | A, A-R, B, B-C | 2026-10-17 | 2026-10-17 | aa88a0c6193f08d99, a50f78b17b01edc29, a91859f35cf2a5c14, a0082ceac43164177 | gate: 73/73; commits `853cf3d`, `f09b6fe` |

## Manual Actions Required
- none

## Issues & Decisions
- Plan Tasks 5, 6, 7 each bundle "write the skill" with "behavioural check by a fresh subagent". Subagents may not have the Agent tool, so each is split: the writer (5a/6a/7a) and a separate behavioural agent (5b/6b/7b) launched by the orchestrator; findings go back to the writer via SendMessage, ≤2 rounds.
- Tasks 1-4 bundled: same files (checker + tests), sequential, same tier; one context keeps contract and parser consistent. Review gate added although no rule forces it (score 5): the user's main concern is that the checker stays right across every future roadmap; tests are written by the same agent that writes the code.
- 5a, 6a on opus: score 6 (ambiguous prose design; only judgment verifies it). 5b/6b on sonnet on purpose: a skill that only works on opus is a defect.
- Step 8 risk floor: `plugin.json` / `marketplace.json` drive install → sonnet + opus review.
- Commits: the orchestrator commits each step with the plan's message after verification (agents never commit).
- Effort: the plan has no estimates; not invented.
- A-R round 1 (2026-10-17): 8 defects + notes, all confirmed by experiment: run guard silent via junction/symlink; suite fails on CRLF checkout; `bad-row` misses extra columns; integrated without SHA passes; shallow clone → false `sha-missing`; retired BLQ/E in append-only log → false `unknown-id`; formats.md missing templates; NFC/NFD. Executor concerns 1,2,4,5,6 accepted; 3 → defect. Reviewer left temp files it could not delete (`%TEMP%\tmp.vuoe0mq9x5` junction, `%TEMP%\rmT`, scratchpad `crlf/mut/probe.mjs`); deletion by me was denied too → tell the user.
- Wave 2 concerns acted on (2026-10-17): (a) default strategy name `../<date>-roadmap-<topic>-plan.md` collided with plan-coordinator's `*-plan.md` search → now `../<date>-roadmap-<topic>.md` (inline 1: formats.md, planner SKILL.md L110, spec table); (b) formats.md §5 skeleton merged 5 sections into one heading → split (inline 1); (c) `--version`/`checker-stale` used constants, tracker compares line-1 headers → checker reads its own line 1 (sent to aa88). Not acted on: formatVersion parsed from formats.md title (works; anchor would be sturdier); migration may run after a failed refresh (accepted, gate = checker on migrated folder).
- Tier summary: planned = actual for every step (no escalations). Fix-up rounds: 1-4 ×2 (review) + 2 small follow-ups (version-from-header, final review); 7a ×2; 5a ×1 + final; 6a ×1 + final. Reviews found what tests didn't: run guard silent via junction, CRLF, shallow clones, all-digit short SHAs (the flake), per-piece integration blocker. Behavioural sonnet runs passed first time; their ambiguities became rules.
- Known gaps left: `docs/diagrams/repo-architecture.excalidraw` lacks a roadmap-tracker node (repo rule only requires it for plugins); marketplace hook needs `jq`, absent on this machine (replicated with node); optional script-body hash not built (builder's call).
- Deliberate deviation from "executors never read the plan": cards 1-4, 5a, 6a, 8 point to named plan sections instead of copying them, because those sections are the exact contract (schema, anchors, codes, signatures) and a copy would drift. Each card names which sections to read.

## Step Cards

### Steps 1-4: Format contract + checker
- **Route**: general-purpose · sonnet · bundle, max score 5 — exact interfaces given; parser + DFS ordinary logic; tests prove it; review gate by opus.
- **Files**: create `plugins/productivity-tools/skills/roadmap-planner/references/formats.md`; create `plugins/productivity-tools/skills/roadmap-tracker/scripts/{check-roadmap.mjs,check-roadmap.test.mjs}` and `.../scripts/fixtures/valid/*`.
- **Do**: implement plan Tasks 1, 2, 3, 4 exactly as written in `docs/plans/2026-10-17-roadmap-planner-v2-plan.md` (read the sections "Global Constraints", "Review Focus", "Task 1" … "Task 4"; that is the card's full specification: config schema, anchors and column orders, exports and signatures, error/warning codes, Review Focus tests, CLI contract). TDD: tests first, see them fail, then implement. Skip each task's "Commit" step.
- **Done means**: test command → all pass (report the pass/fail counts); `node .../check-roadmap.mjs .../fixtures/valid` → `check-roadmap: 0 error(s), 0 warning(s)`; `--version` → `1.2.0 format 1`; line 1 of the script exact; no `import` other than `node:*`.
- **If Blocked**: if the plan's contract is self-contradictory, stop and report the exact conflict instead of choosing.
- **Handoff**: committed `f09b6fe`. CLI `node check-roadmap.mjs [folder] | --version` (no folder = script's own dir; exit 1 iff errors; `--version` → `1.2.0 format 1`). Exports `FORMAT_VERSION, CHECKER_VERSION, readBlocks, parseTable, loadRoadmap, checkRoadmap, createGitAdapter, compareVersions, findNewerPluginCopy`. Anchors: `version`, `card` (+ nested `acceptance`, `risks`), `now`, `panel`, `blockers`, `pending`, `inflight`, `decisions`, `log`, `sources`, `conflicts`, `requirements`, `measurements`. `formats.md` (357 lines, TOC) = full contract incl. templates for every file and the code list (§9); `fixtures/valid/` = working example. Extra codes: `missing-block`, `unclosed-block`, `bad-row`, `integrated-no-sha`, `shallow-clone`; log may cite retired BLQ/E; non-mermaid fences ignored.

### Review A-R
- **Route**: general-purpose · opus · read-only. Brief + Steps 1-4 card + executor report + changed paths. Check: every code and test the plan lists exists and asserts the right severity; the five Review Focus tests are real; `formats.md` and the fixture agree; the parser does not depend on header language; git calls use argument arrays; nothing outside the files list. Verdict PASS or concrete defects.

### Step 7a: plan-coordinator roadmap hook
- **Route**: general-purpose · sonnet · score 4.
- **Files**: modify `plugins/productivity-tools/skills/plan-coordinator/SKILL.md` (Step 1 extraction list), `.../plan-coordinator/references/progress-template.md` (header), `.../plan-coordinator/references/delegation-protocol.md` (Wave loop step 10 "Advance"; "Completion").
- **Do**: Step 1 also extracts an optional plan header line `**Roadmap:** <roadmap folder>`. Template header gains `**Roadmap**: <folder> | none` right after `**Plan**:`. Step 10 and Completion gain: "If `**Roadmap**` is set, invoke `roadmap-tracker` with the event 'wave N closed (steps …)' / 'plan completed', after the wave gate and before starting the next wave." No other change; routing and waves untouched.
- **Done means**: `git -C /d/projects/claude-play diff --stat` shows only the 3 files; total added lines ≤ 10.
- **If Blocked**: if the sections moved, add the lines at the closest equivalent spot and say where.
- **Handoff**: plan header `**Roadmap:** <folder>`; progress header `**Roadmap**: <folder> | none` after `**Plan**:`; delegation-protocol step 10 invokes `roadmap-tracker` with "wave N closed (steps …)" before the next wave, Completion with "plan completed" after `Status: Completed`; both only when the field names a folder (not `none`).

### Step 7b: Behavioural check of the hook
- **Route**: general-purpose · haiku · read-only.
- **Do**: read the three edited plan-coordinator files; answer for (a) a plan with `**Roadmap:** docs/plans/roadmap-x/` and (b) a plan without it: where is the roadmap recorded, and exactly when is `roadmap-tracker` invoked. Expected: (a) progress header `**Roadmap**`, after each wave gate and at completion; (b) never. Report any ambiguity.

### Step 5a: roadmap-planner v2 skill
- **Route**: general-purpose · opus · score 6.
- **Files**: rewrite `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`; create `.../roadmap-planner/references/{clarify.md,decompose.md}`; create `docs/plans/roadmap-planner-v2/scenarios/s1-conflict/{objective.md,source-a.md,source-b.md}` and `.../s2-unsourced/objective.md`.
- **Inputs**: `formats.md` and checker from Steps 1-4 (handoff).
- **Do**: plan Task 5 Steps 1–3 exactly (description wording, the listed rules, clarify/decompose content). Also: when no subagent tool is available, read the sources directly (same summary format). The checker path is `../roadmap-tracker/scripts/check-roadmap.mjs` relative to the skill base directory Claude Code prints on invocation. Skip Task 5 Steps 4–5 (orchestrator runs the behavioural check separately and will message you with findings).
- **Done means**: SKILL.md < 500 lines, frontmatter only `name`/`description`; every rule listed in plan Task 5 Step 2 is present (report a checklist rule → line number); reference files > 100 lines have a TOC.
- **If Blocked**: report the conflict between plan and spec.
- **Handoff**:

### Step 6a: roadmap-tracker skill
- **Route**: general-purpose · opus · score 6.
- **Files**: create `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md`, `.../roadmap-tracker/references/events.md`, `docs/plans/roadmap-planner-v2/scenarios/s3-tracker/event.md`.
- **Inputs**: `formats.md`, checker CLI (`--version`, exit codes) from Steps 1-4; progress header `**Roadmap**:` from Step 7a.
- **Do**: plan Task 6 Steps 1–2 exactly (cold start, layers 1 and 3 with the exact refresh/pending behaviour, event → files table, no commit, checker run, revision with approval; `events.md` recipes). `formats.md` is reached as `../roadmap-planner/references/formats.md` relative to the skill base directory. s3 `event.md`: the event "user decides E2 ships without its second piece", to be applied to a copy of `fixtures/valid`. Skip Steps 3–4.
- **Done means**: SKILL.md < 500 lines, frontmatter only `name`/`description`; checklist of every item in plan Task 6 Step 1 → line number; `events.md` covers all 11 recipes listed.
- **If Blocked**: report.
- **Handoff**:

### Step 5b / 6b: Behavioural checks
- **Route**: general-purpose · sonnet.
- **Do (5b)**: follow `plugins/productivity-tools/skills/roadmap-planner/SKILL.md` literally (base directory = that skill's folder) on `docs/plans/roadmap-planner-v2/scenarios/s1-conflict/` and then `s2-unsourced/`, answering your own clarification questions with the recommended answers, writing each roadmap under the session scratchpad. Report against plan Task 5 Step 4 expectations + every ambiguity hit (file:line).
- **Do (6b)**: copy `.../roadmap-tracker/scripts/fixtures/valid` to the scratchpad, apply `scenarios/s3-tracker/event.md` by following `roadmap-tracker/SKILL.md` literally; then the two refresh runs from plan Task 6 Step 3. Report against those expectations + ambiguities.
- **Files**: scratchpad only; never edit the repo.

### Step 8: Version, catalogs, validation
- **Route**: general-purpose · sonnet · risk floor → opus review.
- **Do**: plan Task 8 Steps 1–2 exactly.
- **Done means**: all validation commands of Task 8 Step 2 pass (quote result lines); version `1.2.0` in the three places.

### Review G-R and final H
- **G-R**: opus read-only: three-place version consistency, catalog text accurate to the skills as built, no stale `docs/roadmaps/` claims for roadmap-planner.
- **H**: opus read-only whole-branch review `git diff bb6ec3d..HEAD` against the spec: goals, non-goals, anti-goals, the four layers, calls made by the designer; report defects only.
