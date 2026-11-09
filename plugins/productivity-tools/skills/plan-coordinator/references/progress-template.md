# Progress File Template

Path: `docs/plans/<topic>/progress-<plan-name>.md`. Sections are ordered for recovery: the first ~30 lines should be enough to resume.

```markdown
# Execution Progress: [Plan Name]
**Plan**: docs/plans/<topic>/<plan-file>.md
**Roadmap**: <roadmap folder> | none
**Started**: [date] | **Last Updated**: [date]
**Status**: Map ready | In Progress | Blocked | Completed

## Recovery State
<!-- Read this, then Steps and Manual Actions, first -->
**Worktree:** <absolute worktree path>
**Branch:** <branch>
**Base:** <SHA the work started from>
**Test:** <exact test command — no credentials>
**Baseline:** <expected result, e.g. "412 passed, 3 skipped">
**Wave gate owed**: none   <!-- the wave whose gate is still to run -->
**In-Flight Agents**: none   <!-- before launch: "Group C (Steps 3-5, sonnet): launching"; after launch: add the agent ID -->
**Final gate rounds:** 0   <!-- format: <n done> (last verdict: <PASS | defects: ...>); see delegation-protocol, Completion -->
**Next Action**: Self-approve the map (SKILL.md Step 8)   <!-- e.g. "Launch Wave 2 (Groups C, D)" -->

## Steps
<!-- The only place a step's state lives. States and transitions: delegation-protocol, Step lifecycle. -->
| # | Step | Status | Tier · Attempts | Score (S/A/R/B/V) | Note |
|---|------|--------|-----------------|-------------------|------|
| 1 | Add data model types | Pending | haiku · 0 | 1 (0/0/0/1/0) | — |
| 2 | Write filter tests | Pending | sonnet · 0 | 3 (0/1/1/0/1) | — |
| F | Final gate | Pending | opus · 0 | — | — |

## Manual Actions Required
- [Action needed from the user, or "none"]
<!-- Fixed entry forms; an entry stays open until the user closes it:
     Refused: Step N: <effect>
     Pre-launch review failed: Step N: <defects>
     Not named: Step N: <effect>
     Open question: Step N: <exact question and what each answer does> -->

## Execution Map
**Steps**: N (execute M, skip K) | **Waves**: W | **Effort**: Xh | **Tiers**: inline a · haiku b · sonnet c · opus d | **Review gates**: R
External: none   <!-- or the external steps: "External: Step 7 (deploy to staging); Step 9 (send release e-mail)" -->

| Wave | Group | Steps | Agent | Tier | Score | Mode | Depends On | Writes |
|------|-------|-------|-------|------|-------|------|------------|--------|
| 1 | A | 1 | general-purpose | haiku | 1 | Single | — | src/types/models.ts |
| 1 | B | 2 | general-purpose | sonnet | 3 | Single | — | tests/filter.test.ts |
| 2 | C | 3-5 | general-purpose | sonnet | 5 | Bundle | A | src/api/*.ts |

## Shared Brief
<!-- Pasted verbatim at the top of every subagent prompt. ≤60 lines. -->
- **Workspace**: [absolute path; run every command there]
- **Commits**: per step | none
- **Goal**: [one or two sentences]
- **Architecture**: [3-6 lines: layers, key dirs, data flow]
- **Conventions**: [naming, error handling, test style, language of comments/commits]
- **Commands**: build `…` · typecheck `…` · test one file `…` · full test `…` · lint `…`
- **Do not touch**: [generated files, vendored code, secrets, other teams' dirs]
- **Glossary**: [domain terms an agent would otherwise guess at]

## Wave Execution Log
| Wave | Groups | Delegated | Completed | Agent IDs | Notes |
|------|--------|-----------|-----------|-----------|-------|

## Issues & Decisions
- [Routing rationale for every opus/inline step, write-set overlaps and how they were resolved, escalations, user decisions]

## Step Cards
<!-- An external step's card adds, after Route:
     - External: yes
     - Pre-launch review: <Issues & Decisions entry>
     - Authorized: <Issues & Decisions entry> -->

### Step 1: Add data model types
- **Route**: general-purpose · haiku · score 1 — exact spec, one file; shared types (Blast 1), typecheck proves it so no review gate
- **Files**: create `src/types/models.ts`
- **Inputs**: none
- **Needs from upstream**: none
- **Do**: [the step's instructions, rewritten to be self-sufficient]
- **Done means**: `npx tsc --noEmit src/types/models.ts` → no errors; `DataModel` exported
- **If Blocked**: check `src/types/` for conflicting definitions
- **Handoff**: <!-- filled after completion: e.g. `DataModel`, `FilterSpec` exported from src/types/models.ts -->

### Step 2: Write filter tests
- **Route**: general-purpose · sonnet · score 3 — one file, test design left open
- **Files**: create `tests/filter.test.ts` (tests the existing `src/filter.ts`)
- **Needs from upstream**: none
- **Do**: …
- **Done means**: `npx vitest run tests/filter.test.ts` → tests FAIL for the expected reason (TDD red)
- **If Blocked**: verify the test setup with an existing test file
- **Handoff**:
```
