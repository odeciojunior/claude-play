---
name: plan-coordinator
description: "Use when executing a multi-step implementation plan from docs/plans/ or docs/superpowers/plans/ with subagents and you want per-step model-tier routing (haiku/sonnet/opus by complexity), conflict-free parallel waves, and a persistent progress file that survives compaction — or when resuming such a plan from its progress file. The orchestrator approves its own Execution Map, without human map approval. Not for ad-hoc plans without model routing or a progress file (use superpowers:subagent-driven-development)."
---

# Plan Coordinator

Turn an implementation plan into an **Execution Map**: every step routed to the cheapest agent + model tier that can do it reliably, grouped into parallel waves that cannot collide, with just enough context attached that no subagent has to rediscover the project.

Two phases, both run by the main conversation:

| Phase | What | Reference |
|-------|------|-----------|
| 1. Map | Parse plan → score → route → group → write progress file → self-approval | this file + `references/routing.md` |
| 2. Run | Launch waves, verify, hand off, escalate, recover | `references/delegation-protocol.md` |

**Core principle:** the orchestrator's context window is the scarcest resource. State lives in the progress file, subagents receive only a brief + a step card, and they return a short structured report — never diffs or file dumps.

## Phase 1: Build the Map

### Step 0: Resume check

Look for this plan's progress file in the current tree and in every worktree from `git worktree list`, and continue in the worktree that holds it: `docs/plans/<topic>/progress-*.md` (or legacy `docs/plans/*-progress.md`). `<topic>` is the plan's folder under `docs/plans/`; for a plan file directly in `docs/plans/` or `docs/superpowers/plans/`, it is the file name without the `YYYY-MM-DD-` prefix and `.md`.

| Progress file state | Action |
|---------------------|--------|
| None | Build the map (Step 1) |
| `Status: In Progress` or `Blocked`, **and** it has `## Shared Brief` and `## Step Cards` | Don't rebuild: read `## Recovery State` + the Execution Map table, continue Phase 2 at **Next Action** |
| `Status: Map ready` or legacy `Awaiting approval` (same sections present) | Go to Step 8 |
| `Status: Completed` | Tell the user it's done; ask before re-running anything |
| Older format (no Shared Brief / Step Cards / Tier column) | Rebuild the map, carrying over completed statuses as skips |

A file that has those sections but lacks `Base`, the `Commits` line or the Final gate row gets them before anything else: `Commits` and the row by Steps 2 and 5, and `Base` from `git merge-base <default branch> HEAD`. On the default branch there is no reliable Base, so ask the user for it.

### Step 1: Load the plan

- Locations: `docs/plans/<topic>/steps-*.md`, `docs/plans/<topic>/*-plan.md`, legacy `docs/plans/*-plan.md`, `docs/superpowers/plans/*.md` (where `superpowers:writing-plans` saves plans). If several match, ask which one. If a named plan doesn't exist but a close match does, confirm the match before using it. If nothing matches, ask for the plan or offer to write one.
- Optional plan header line `**Roadmap:** <roadmap folder>`: extract it and record it in the progress file header (`**Roadmap**`; `none` if absent).
- Extract per step: number, title, description, dependencies, inputs, outputs, **files it creates/modifies**, validation criteria, effort, "If Blocked" guidance.
- If the plan omits files touched or dependencies, infer them — wave safety depends on both. Files: from the step text, Grep/Glob. Dependencies: step B depends on A when B reads, calls, tests or edits something A creates or changes. Mark inferred values `(inferred)`; when unsure, assume a dependency (serial is slower, a wrong parallel wave is broken).
- A step whose sub-parts need different capabilities (e.g. "validate, then fix and commit") is split into a read-only part and a writing part, or routed to the writer. Sub-steps that need a subagent (behavioral tests, reviews) are run by the orchestrator as review gates, never inside an executor card.
- **Skips:** mark a step Skip when its outputs already exist and its validation passes, when the plan marks it optional and the user hasn't asked for it, or when it's blocked by a missing prerequisite (list that under Manual Actions; Step 8 marks it `Skip (manual)`). Skipped steps count as done for dependencies only if their outputs exist.
- **External effects:** Mark every step whose execution touches anything outside the working tree and branch (production, deploy, push, sending e-mail or messages, writing shared data, resetting or rolling back the user's checkout; when in doubt it is external) as `External: yes` in its card and map note. An external step is never Inline.

**Fast path:** for plans of ≤3 steps, or when only one viable writer agent exists, skip the agent matching in Step 3 (use that writer) and keep scoring only to pick the model tier.

### Step 2: Prerequisites

Check the plan's entry criteria and earlier progress files. Record manual actions (credentials, access, approvals) under Manual Actions in the progress file instead of asking one at a time; Step 8 decides what they block.

- **Commit policy:** `per step` when the user's request or the plan calls for commits, otherwise `none`. Record it in the Shared Brief. Plan "commit" sub-steps belong to the orchestrator and stay out of step cards. Never push.
- **Workspace:** the orchestrator prepares it; it is never a manual action. If the plan names a worktree or branch, use it, creating what is missing from the plan's stated base or else from the current HEAD. If the plan names neither, work in the current tree. In every case, when the commit policy is `per step` and the branch to work on is the repository's default, create and switch to `plan/<topic>` from it, which carries uncommitted changes along. A named worktree that already holds uncommitted changes from other work becomes a manual action. Record Worktree, Branch and Base (the starting SHA) in Recovery State, and measure Baseline by running the full test command there.

If a memory tool or memory directory is available, check it for prior gotchas in this plan's area; never block on one.

### Step 3: Discover executors

1. Start from the agent types the `Agent` tool lists in this session (built-in, plugin, user and project agents). Use only the types the tool lists; never invent names.
2. For project/user agents, read `.claude/agents/*.md` / `~/.claude/agents/*.md` frontmatter: `name`, `description`, `tools`, `model`. Skip files without frontmatter.
3. **Capability filter first:** a step that edits files needs an agent with Edit/Write (and Bash if validation runs commands). Read-only agents (`Explore`, `Plan`, most reviewers) only take research or review steps.
4. **Then domain match:** the most specialized agent whose description covers the step's primary technology wins; respect "Do NOT use for…" lines.
5. Fallback: `general-purpose`.

### Step 4: Score and route

Score each step 0–10 on five dimensions and map the score to a route — **Inline**, **haiku**, **sonnet** or **opus** — using `references/routing.md`. Apply its overrides (risk floors beat mechanical ceilings), and add review gates where it says to. Record score, tier and a one-line rationale per step. Sanity-check against the plan's effort estimate: a large effort with a low score usually means a dimension was underscored.

### Step 5: Group into waves

1. Build the dependency DAG. A step never shares a wave with (or precedes) a step it depends on. A step behind a review gate counts as done only after the reviewer's PASS.
2. **Write-set check:** two steps in one wave must not write the same file. Each step's write set is its declared files **plus implicit writes**: lockfiles and manifests if it installs or removes dependencies; generated/output dirs (`dist/`, `build/`, codegen output, `*.tsbuildinfo`, coverage) if it builds or generates; snapshot files if it updates snapshots; migration directories if it creates migrations. On overlap: serialize or bundle. (Don't resolve overlaps with worktree isolation: a worktree branches from the default branch, so earlier waves' unmerged work is invisible to it, and its changes never reach the main tree without a merge the protocol doesn't have.)
3. **Bundle** into one delegation when steps are sequential, same agent, same tier, and tightly coupled (type → hook → tests for one feature). Split when agents or tiers differ, when steps are independent, or when failure modes differ. Keep bundles to what one fresh context can hold comfortably — roughly ≤5 steps or ≤~15 files.
4. Parallel width: default ≤4 concurrent agents per wave; go wider only for read-only or clearly disjoint mechanical work. The platform caps concurrent subagents (default 20, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); never plan a wave above it.
5. Put the critical path first; fill waves with off-path work. Inline steps run between waves (see delegation-protocol), so place them in the wave after their dependencies.
6. **Final gate:** the last row of the map is always a read-only review of the whole change, `Mode: Final gate`, opus with `effort: high`, depending on every other row. It runs alone, under Completion in `references/delegation-protocol.md`, never as a wave group.

### Step 6: Write the shared context

Write two things into the progress file — they are what Phase 2 pastes into prompts (see `references/delegation-protocol.md` § Context layers):

- **Shared Brief** (once, ≤60 lines): goal, architecture in a few lines, conventions, exact build/test/lint commands, do-not-touch paths, glossary.
- **Step Cards** (one per step/bundle): files to touch, resolved inputs, upstream handoffs needed, validation command + expected result, If Blocked, done-definition.

A step card must be self-sufficient with the brief: executors never read the plan file.

### Step 7: Write the progress file

`docs/plans/<topic>/progress-<plan-name>.md`, using `references/progress-template.md`, with `Status: Map ready`. It is the recovery point after compaction or restart, so write it before self-approval.

### Step 8: Self-approval

The orchestrator approves the map by its own best analysis, in this order, and continues into Phase 2 in the same turn. The map is never put to the user for approval.

1. **Resolve borderline steps.** A step is **borderline** when its score is at a tier edge (2↔3, 5↔6) or any dimension was scored 1 only because information was missing. A step already listed with an outcome under `Map self-approved` in Issues & Decisions is settled: keep that outcome. For the others, read the files that fill the missing information and re-score. When a step is still borderline and has Verifiability ≥ 1 or a dependent step: an inline or haiku step moves to sonnet with a review gate; a sonnet step keeps its tier and gets a review gate. Every other borderline step keeps its scored tier. Self-approval never promotes a step to opus beyond routing.md §2–§3, and risk floors (routing.md §3) always hold. Write each tier and outcome to the progress file as you decide it, under a `Map self-approved` entry with the date, the reason and anything scored on thin information.
2. **Apply manual actions.** Mark a step that needs an unfinished manual action `Skip (manual)` and every step depending on it, directly or transitively, `Waiting (manual)`. Neither status counts as intentionally skipped, and those steps stay out of launches. Split any group holding both manual and other steps so the others can run. Steps released by a finished manual action return to `Pending`. When no step can run, set `Status: Blocked`, set `Next Action` to re-run Step 8 after the manual actions, and stop after asking the user for them.
3. **Validate the final map.** Every Step 5 rule holds, every step has a tier and rationale, every routing.md §3 override and review gate is applied, and every card is self-sufficient (Step 6). If a check fails, fix the map and validate again. After two failed fixes, record the failing check under Issues & Decisions, set `Status: Blocked` and stop after asking the user.
4. **External steps.** Unless the user's request names the step (number or title) as authorized, write `Status: Blocked` and a `Next Action` that names the step, its effect and what each answer does into the progress file BEFORE asking; then ask one question listing every unauthorized external step. The answer authorizes only the steps it names. Record the authorization in Issues & Decisions. A refused step becomes `Skip (manual)` and its dependents `Waiting (manual)`, as in item 2; groups with no external step keep running.
5. **Report the map** in one message that does not wait for an answer: wave count, steps per tier (`inline 2 · haiku 5 · sonnet 6 · opus 2`), review gates, total effort, write-set overlaps and how they were resolved, skips, manual actions, thin information, and the allow rules from delegation-protocol. For plans with more than 25 steps (Execution Map rows, i.e. plan tasks, not checkboxes), or 10+ near-identical mechanical items, add that a dynamic workflow is available if the user says "use a workflow"; it suits dozens to hundreds of agents. Never launch one unasked.
6. Set `Status: In Progress` and set `Next Action` to launching the first wave with unfinished steps (never relaunch PASS steps), then follow `references/delegation-protocol.md`.

Self-approval covers the map only. The questions in Steps 0 and 1, the external-step stop in item 4 and the stops in `references/routing.md` and `references/delegation-protocol.md` still apply.

## Execution Map Format

```markdown
## Execution Map: [Plan Name]

**Steps**: N (execute M, skip K) | **Waves**: W | **Effort**: Xh | **Tiers**: inline a · haiku b · sonnet c · opus d | **Review gates**: R

| Wave | Group | Steps | Agent | Tier | Score | Mode | Depends On | Writes | Status |
|------|-------|-------|-------|------|-------|------|------------|--------|--------|
| 1 | A | 1 | general-purpose | haiku | 1 | Single | — | src/types/models.ts | Pending |
| 1 | B | 2 | general-purpose | sonnet | 3 | Single | — | tests/filter.test.ts | Pending |
| 2 | C | 3-5 | general-purpose | sonnet | 5 | Bundle | A | src/api/*.ts | Pending |
| 2 | D | 6 | — | inline | 1 | Inline | A | README.md | Pending |
| 3 | E | 7 | general-purpose | opus | 8 | Single + review | C | src/auth/session.ts | Pending |
| 4 | F | all | general-purpose | opus | — | Final gate | A-E | — | Pending |
```

**Mode key**: Final gate = whole-change review before completion · Single = 1 step, 1 agent · Bundle = sequential steps, 1 agent · Inline = orchestrator does it directly, between waves · `+ review` = a read-only reviewer must PASS it before dependents start.

## Rules

1. **Map before running.** No delegation until the progress file holds the complete map and it passed self-approval (Step 8).
2. **Progress file is the source of truth** for status, handoffs and recovery.
3. **Cheapest reliable tier.** Tier by score, raise by risk, not by habit. Justify every opus and every inline.
4. **No write collisions** inside a wave, counting implicit writes.
5. **Self-sufficient step cards.** Brief + card must be enough; pass paths and signatures, never pasted file contents.
6. **Be transparent.** Show how steps were routed and where information was thin.
7. **Efficiency.** Don't re-read files already in context; batch independent reads into one message.
8. **Learn.** At completion, if a memory tool or memory directory is available, save only the non-obvious lessons (a tier that was consistently wrong for a kind of step, an implicit write that collided).
