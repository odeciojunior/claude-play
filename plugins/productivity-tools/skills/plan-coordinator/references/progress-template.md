# Progress File Template

Path: `docs/plans/<topic>/progress-<plan-name>.md`. Sections are ordered for recovery: the first ~30 lines should be enough to resume.

```markdown
# Execution Progress: [Plan Name]
**Plan**: docs/plans/<topic>/<plan-file>.md
**Roadmap**: <roadmap folder> | none
**Started**: [date] | **Last Updated**: [date]
**Status**: Map ready | In Progress | Blocked | Completed

## Recovery State
<!-- Read THIS first after compaction or restart -->
**Worktree:** <absolute worktree path>
**Branch:** <branch>
**Base:** <SHA the work started from>
**Test:** <exact test command — no credentials>
**Baseline:** <expected result, e.g. "412 passed, 3 skipped">
**Last COMPLETED Wave**: 0
**Last DELEGATED Wave**: 0
**In-Flight Agents**: none   <!-- before launch: "Group C (Steps 3-5, sonnet): launching"; after launch: add the agent ID -->
**Final gate rounds:** 0   <!-- format: <n done> (last verdict: <PASS | defects: ...>); update after every final-gate round; a round is one fix, commit, full check and re-review; n counts completed rounds; the first review with no fix is round 0; read this field before launching a fix, and after each round write the intended next step into Next Action -->
**Next Action**: Self-approve the map (SKILL.md Step 8)   <!-- e.g. "Launch Wave 2 (Groups C, D)" -->

## Execution Map
**Steps**: N (execute M, skip K) | **Waves**: W | **Effort**: Xh | **Tiers**: inline a · haiku b · sonnet c · opus d | **Review gates**: R
External: none   <!-- or the external steps: "External: Step 7 (deploy to staging); Step 9 (send release e-mail)" -->

| Wave | Group | Steps | Agent | Tier | Score | Mode | Depends On | Writes | Status |
|------|-------|-------|-------|------|-------|------|------------|--------|--------|
| 1 | A | 1 | general-purpose | haiku | 1 | Single | — | src/types/models.ts | Pending |
| 1 | B | 2 | general-purpose | sonnet | 3 | Single | — | tests/filter.test.ts | Pending |
| 2 | C | 3-5 | general-purpose | sonnet | 5 | Bundle | A | src/api/*.ts | Pending |

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

## Steps
| # | Step | Status | Tier · Attempts | Score (S/A/R/B/V) | Note |
|---|------|--------|-----------------|-------------------|------|
| 1 | Add data model types | Pending | haiku · 0 | 1 (0/0/0/1/0) | — |
| 2 | Write filter tests | Pending | sonnet · 0 | 3 (0/1/1/0/1) | — |

## Wave Execution Log
| Wave | Groups | Delegated | Completed | Agent IDs | Notes |
|------|--------|-----------|-----------|-----------|-------|

## Manual Actions Required
- [Action needed from the user, or "none"]
<!-- Fixed entry forms; an entry stays open until the user closes it:
     Refused: Step N: <effect>  (does not hold the final gate of the steps that ran)
     Pre-launch review failed: Step N: <defects>
     Not named: Step N: <effect>
     Open question: Step N: <exact question and what each answer does> -->

## Issues & Decisions
- [Routing rationale for every opus/inline step, write-set overlaps and how they were resolved, escalations, user decisions]

## Step Cards
<!-- An external step's card adds, after Route:
     - External: yes
     - Pre-launch review: <Issues & Decisions entry>   (added on PASS, before the authorization question)
     - Authorized: <Issues & Decisions entry>          (added once the user authorized the step) -->

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
