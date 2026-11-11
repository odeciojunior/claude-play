---
name: roadmap-tracker
description: "Requires an existing roadmap folder (roadmap.config.json). Use when it needs updating after an event: roadmap status, a deliverable E<n> changed, a DEC or \"we decided\", a blocker (BLQ) opened or closed, a piece, wave or plan step closed, a branch integrated or deleted, a measurement or paid run, a release published, a new source or requirement, the end of a piece or phase (strategy revision), or a plan-coordinator \"wave N closed\" / \"plan completed\". Updates the tracking files in the working tree, keeps the vendored checker current, runs it, and proposes strategy revisions written only after approval. Never commits. Not for creating a roadmap (use roadmap-planner) or for task plans (use superpowers:writing-plans)."
---

# Roadmap Tracker

Keep a living roadmap true. A roadmap built by `roadmap-planner` is a versioned strategy plus a tracking folder (`state`, `decisions`, `log`, `critical-path`, `sources`, `requirements`, optional `measurements`) and a vendored checker. Each event updates exactly the files it touches and runs the checker; the end of a piece or phase proposes the next strategy version.

**Core principle:** files over memory. Every run starts from the files and leaves the folder passing its own checker.

## Paths

`${CLAUDE_SKILL_DIR}` is this skill's directory.

| What | Path |
|------|------|
| CLI (`roadmap.mjs <command> "<folder>" [options] [--json]`) | `${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs` |
| Plugin's checker (newest copy) | `${CLAUDE_SKILL_DIR}/scripts/check-roadmap.mjs` |
| Event index and Common rules | `${CLAUDE_SKILL_DIR}/references/events.md` |
| Rubrics (read only when a recipe says so) | `${CLAUDE_SKILL_DIR}/references/rubric-contradiction.md`, `rubric-criteria.md` |
| Format contract: read only the section a recipe cites | `${CLAUDE_SKILL_DIR}/../roadmap-planner/references/formats.md` |
| Vendored checker | `<folder>/check-roadmap.mjs` |

Never write a file from memory. If the contract cannot be read, stop and report it.

## Rules

1. **Never commit**, stash, reset or check out. Edit the working tree only, so the update lands in the event's commit.
2. **One fact in one place.** The strategy holds no state; `state.md` is overwritten; `log.md` and `decisions.md` are append-only (old decision rows change only in Status and Revisit when).
3. **Never invent numbers**: no dates, durations, metrics, estimates or costs nobody supplied. Date cells hold the day the event happened. Unknown is `-` or tagged `ASSUMPTION` / `UNSOURCED`.
4. **Never replace the vendored checker silently**, and never write a newer format than it reports.
5. **Outside a git repository, continue.** The `no-git` warning is expected; recipes needing git evidence ask for it.
6. **The strategy changes only through an approved revision** (Step 6). A pre-approval from a caller or orchestrator never covers a revision or a migration; with no person present, write only the pending item and say so.
7. **Status words are positional.** `vocab.deliverableStatuses` keeps the canonical order (1 not-started, 2 spec, 3 plan, 4 executing, 5 on-branch, 6 integrated, 7 released, 8 measured, then blocked and discarded), so write the configured word at that position, whatever the language.
8. **Ask little.** Read files, git history and the progress file first; ask only what they cannot tell, one question at a time, with a recommendation. With `no questions` in the event, never ask: write pending items and report them under `Pending for the user:`.
9. **CLI exit codes.** 0 done or no-op; 1 refused, nothing changed: report it and never work around it by editing by hand; 2 stop and report.

## Workflow

0. **Locate the folder** (the directory with `roadmap.config.json`): the path given; the `**Roadmap**:` field of the plan-coordinator progress file; `**Roadmap:**` in the plan header; else search `docs/plans/**/roadmap.config.json`. Several: ask which. None: stop, point to `roadmap-planner`, create nothing.
1. **Cold start:** `roadmap.mjs brief "<folder>"`. The recipe says what else to read.
2. **Layer 1, checker:** `roadmap.mjs refresh-checker "<folder>"`; detail in `events/10-checker-refresh.md`.
3. **Layer 3, format:** compare the contract's formatVersion (its title), the config's `formatVersion` and the vendored checker's `format <n>`. Contract newer than the config: migrate first, with approval (`events/11-migration.md`). Config newer than the contract: stop, tell the user to update the plugin.
4. **Classify the event, apply its recipe:** read `events.md` (Common) and the recipe file below; read a rubric only when the recipe says so. Chained events: table order.
5. **Checker:** `node "<folder>/check-roadmap.mjs"` (plugin copy only if missing; no Node 18+: report "checker not run"). 0 errors before handing back: fix those this run introduced; for older ones, ask with a recommended fix or hand back `errors remain: <codes>` with one fix each. Warnings are listed, one line per code: `contradiction-unabsorbed` may wait for a revision; `checker-stale` means Step 2 failed or was skipped; `no-git` / `shallow-clone` mean git checks did not run; `integrated-pending` propose the batch turn (§ 16); `pending-limit` see Common; `blocker-overdue` propose escalating (§ 5); others report only (strategy fixes wait for a revision).
6. **Revision** (end of piece or phase, or an unabsorbed contradiction): propose strategy vN+1 in the conversation, write it only after approval (rule 6); procedure in `events/09-revision.md`.
7. **Hand back** with the report below.

Read-only query ("roadmap status"): `roadmap.mjs status "<folder>"` plus the checker; write nothing; report a stale checker or format mismatch as a warning only.

## Events

| Event | Recipe |
|-------|--------|
| Decision made, or rejected | `events/01-decision.md` |
| Piece or step closed | `events/02-piece-closed.md` |
| Branch integrated | `events/03-integration.md` |
| Branch deleted or started | `events/04-branch-deleted.md` |
| Blocker opened or closed | `events/05-blocker.md` |
| Paid run or measurement | `events/06-measurement.md` |
| New source | `events/07-new-source.md` |
| New requirement mid-flight | `events/08-new-requirement.md` |
| Piece or phase ends (revision) | `events/09-revision.md` |
| Newer plugin checker | `events/10-checker-refresh.md` |
| Contract formatVersion above the config | `events/11-migration.md` |
| Package published | `events/12-package-published.md` |
| An action is forbidden or allowed again | `events/13-do-not-do-now.md` |
| plan-coordinator "wave N closed" / "plan completed" | `events/14-plan-coordinator.md` |
| Deliverable merged into the release branch | `events/15-merge-release.md` |
| Release branch integrated, or `integrated-pending` | `events/16-release-integrated.md` |
| Code ready, acceptance pending | `events/17-acceptance-pending.md` |
| Executor choice nobody settled | `events/18-executor-decision.md` |
| Last piece of a deliverable closes | `events/19-criteria-check.md` |
| Spec, plan or execution starts | `events/20-spec-plan-started.md` |

## Hand-back report

```
Roadmap: <folder> | strategy v<version> | format <n>
Event: <what was recorded>
Files changed: <paths> (not committed)
Recorded: <new IDs and log rows, one line>
Checker: <vendored version> -> check-roadmap: <E> error(s), <W> warning(s)
Warnings: <one line each, or none>
Awaiting approval: <revision proposal summary, or none>
Questions: <anything only the user can answer, or none>
Pending for the user: <(user) items written under no-questions, or none>
```

## Red flags

| Thought | Reality |
|---------|---------|
| "The decision is obvious, I'll edit the card too" | Only an approved revision changes the strategy |
| "The new checker fails, copy it anyway" | Keep the old copy, add the pending item |
| "I'll estimate the remaining effort" | No numbers nobody supplied |
| "I'll commit so the update isn't lost" | Never commit |
