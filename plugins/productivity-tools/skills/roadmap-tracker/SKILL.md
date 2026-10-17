---
name: roadmap-tracker
description: "Use when an existing roadmap folder (roadmap.config.json) needs updating after an event: a decision, a piece or plan step closed, a branch integrated or deleted, a blocker opened or closed, a measurement or paid run, a new source, a new requirement mid-flight, the end of a piece or phase (strategy revision), or a plan-coordinator \"wave N closed\" / \"plan completed\". Updates the tracking files in the working tree, keeps the vendored checker current, runs it, and proposes strategy revisions that it writes only after approval. Never commits. Not for creating a roadmap (use roadmap-planner) or for task plans (use superpowers:writing-plans)."
---

# Roadmap Tracker

Keep a living roadmap true. A roadmap built by `roadmap-planner` is a versioned strategy plus a tracking folder (`state`, `decisions`, `log`, `critical-path`, `sources`, `requirements`, optional `measurements`) and a vendored checker. On each event this skill updates exactly the files that event touches, keeps the vendored checker current, runs it, and at the end of a piece or phase proposes the next strategy version.

**Core principle:** files over memory. Every run starts from the files, never from what the conversation remembers, and leaves the folder passing its own checker.

## Paths

Claude Code prints this skill's base directory on invocation. Resolve everything from it:

| What | Path |
|------|------|
| Format contract (the only source of file templates, anchors, column orders, ID and cell rules) | `<base>/../roadmap-planner/references/formats.md` |
| Plugin's checker (newest copy) | `<base>/scripts/check-roadmap.mjs` |
| Per-event recipes | `<base>/references/events.md` |
| Vendored checker | `<folder>/check-roadmap.mjs` |

Read `formats.md` before the first edit of a run; never write a file from memory or duplicate its templates here. If `formats.md` cannot be read, stop and report it instead of guessing the format.

## Rules

1. **Never commit**, never stash, reset or check out. Edit in the working tree only, so the update lands in the same commit as the event; the author or the orchestrator commits.
2. **One fact in one place.** The strategy holds no state; `state.md` holds no history (it is overwritten); `log.md` and `decisions.md` are append-only. Old decision rows change only in Status and Revisit when.
3. **Never invent numbers.** No dates, durations, metrics, estimates or costs that the user or a source did not supply. Date cells hold the date the event happened (today's date unless the user or a source gives another); never deadlines or forecasts. A value nobody supplied is `-` or tagged `ASSUMPTION` / `UNSOURCED`.
4. **Never replace the vendored checker silently** (layer 1) and **never write a newer format than the vendored checker reports** (layer 3).
5. **Outside a git repository, continue.** The checker's `no-git` warning is expected and listed; recipes that need git evidence (integration, branch deleted) ask the user for it instead of verifying it.
6. **The strategy changes only through an approved revision** (Step 6). Decisions that contradict it are recorded at once; absorbing them waits for approval.
7. **Ask little.** Read the files, the git history and the plan-coordinator progress file first; ask only for what none of them can tell, one question at a time, with a recommended answer.

## Workflow

| Step | What | Detail |
|------|------|--------|
| 0 | Locate the roadmap folder | below |
| 1 | Cold start | below |
| 2 | Layer 1: refresh the vendored checker | below + `events.md` § Checker refresh |
| 3 | Layer 3: format version | below + `events.md` § Migration |
| 4 | Classify the event, apply its recipe | table below + `events.md` |
| 5 | Run the vendored checker: 0 errors | below |
| 6 | Revision (end of piece or phase, or an unabsorbed contradiction) | below + `events.md` § End of piece or phase |
| 7 | Hand back | report format below |

### Step 0: Locate the roadmap folder

The folder is the directory holding `roadmap.config.json`. Take it, in this order, from: the path the user or the caller gave; the `**Roadmap**:` field of the plan-coordinator progress file that invoked this skill; `**Roadmap:**` in the plan header; a search for `docs/plans/**/roadmap.config.json`. Several candidates → ask which one.

**No `roadmap.config.json` found → stop.** Say that no roadmap folder exists and point to `roadmap-planner` to create one. Do not create tracking files.

### Step 1: Cold start

Read, before anything else:

1. `roadmap.config.json`: file names, strategy path, `integrationBranch`, `vocab` (exact, case-sensitive words), `tracks`, `limits`, `formatVersion`.
2. `state.md`: `now`, `panel`, `blockers`, `pending`, `inflight`.
3. The 10 newest rows of the `log` block (the top 10 rows: the log is newest first).
4. The `decisions` rows whose Status is `vocab.decisionPending`, plus any in-force row whose Contradicts cell is filled.
5. The strategy's `version` anchor and the cards (`card` blocks) of the deliverables this event touches.

Then apply layers 1 and 3 (Steps 2 and 3) before writing anything.

### Step 2: Layer 1 -- refresh the vendored checker

Compare the plugin's checker with the vendored copy. The version of each is the one in its line-1 header `// check-roadmap <version> format <n>` (the same header formats.md § 1 defines and the checker's own `checker-stale` warning reads); `node <file> --version` reads that same line and prints `<version> format <n>`, so it is a convenient way to read it. Compare versions numerically (`1.10.0` > `1.9.0`).

| Situation | Action |
|-----------|--------|
| Vendored version equal to or newer than the plugin's | Nothing to do |
| Plugin's is newer | Run it on the folder: `node "<base>/scripts/check-roadmap.mjs" "<folder>"` |
| ... and it exits 0 | Copy it over `<folder>/check-roadmap.mjs` (byte copy), add a `log` row "checker refreshed <old> → <new>" with evidence `` `check-roadmap.mjs` ``, and drop any earlier "checker ... available" pending item. If the event adds log rows too, all carry the same date and the event's rows go above the refresh row (the refresh came first) |
| ... and it exits 1 | Keep the old copy. Add to the `pending` block "(maintainer) checker <new> available: N errors to fix" (N = the error count of its summary line); if such an item exists, update it instead of adding a second one |
| Vendored copy missing | Nothing to keep: copy the plugin's checker in, add a `log` row "checker added <new>", and fix its errors in Step 5 |
| Vendored line 1 has no version header (hand-edited copy) | Do not replace it; add a pending item "(maintainer) vendored checker has no version header; review it, then replace with <new>" |

Never replace silently, never delete the old copy on failure, and do not fix the new checker's errors as part of the refresh unless the user asks. Steps and commands: `events.md` § Checker refresh.

### Step 3: Layer 3 -- format version

Three numbers: `formats.md` formatVersion (its title, `# Roadmap format contract (formatVersion N)`), the config's `formatVersion`, and the vendored checker's `format <n>` (line 1, after Step 2).

- `formats.md` newer than the config → run the migration in `events.md` § Migration **before writing anything else**. It needs user approval, and it ends with the vendored checker at that format.
- Never set the config's `formatVersion`, or write a file in a format, newer than the vendored checker reports. The migration vendors the new checker itself before it bumps the config, so a Step 2 refresh that failed because the folder is still in the old format does not block it. Without approval, keep writing the config's format and leave the pending item.
- Config newer than `formats.md` (the installed plugin is older than the folder) → stop; tell the user to update the plugin.

### Step 4: Classify the event and apply its recipe

| Event | Files, in this order | Recipe (`events.md`) |
|-------|----------------------|----------------------|
| A decision is made | `decisions.md` first (Contradicts filled per the contradiction rule), then whatever uses it (`state.md`, `requirements.md`, `critical-path.md`), then `log.md` | § Decision |
| A piece or plan step closes | `state.md` panel (and `now`), `log.md` | § Piece or step closed |
| A branch is integrated | `state.md` panel + "in flight", `log.md` | § Integration |
| A branch is deleted (or started) | `state.md` "in flight", `log.md` | § Branch deleted |
| A blocker opens or closes | `state.md` blockers (+ panel, `now`), `critical-path.md`, `log.md` | § Blocker opened or closed |
| A paid run or a measurement | `measurements.md` (only when `files.measurements` is set), `log.md` | § Measurement |
| A new source | `sources.md` (+ `conflicts`), `log.md`; then new requirements | § New source |
| A new requirement mid-flight | `requirements.md` (+ its `DEC`/`SRC`), `log.md`; propose a revision | § New requirement mid-flight |
| A piece or phase ends | propose a strategy revision (Step 6) | § End of piece or phase |
| A newer plugin checker | vendored checker, `log.md` or `pending` | § Checker refresh |
| `formats.md` formatVersion > config | every file the migration names, config, `log.md` | § Migration |

One event may chain several recipes (a piece that ends a phase also triggers the revision; a decision that clears a blocker also closes it). Apply them in the order of this table. IDs are never reused: the next ID is the highest ever used plus one (search every file, the log included, since closed `BLQ-n` disappear from `state.md`).

**Contradiction rule.** A decision contradicts the roadmap when it overrides something the strategy states: a card's pieces, acceptance, definition of done, priority, phase, track, `depends` or `reqs`; an objective, non-goal, thesis or ordering. Whoever records the decision fills its Contradicts cell with the section or deliverable it overrides (for example `E2 (pieces)` or `Non-goals`); `-` when it fits. A filled, in-force decision stays *unabsorbed* (checker warning `contradiction-unabsorbed`) until an approved revision cites its ID in the strategy text. If unsure whether it contradicts, ask once, recommending the filled cell.

### Step 4a: Events from plan-coordinator

`plan-coordinator` invokes this skill with the event "wave N closed (steps …)" after each wave gate, and "plan completed" at the end, when its progress file header reads `**Roadmap**: <folder>`.

1. Read that progress file (the one the caller names; otherwise the `docs/plans/**/progress-*.md` whose `**Roadmap**:` field names this folder): the header (`**Plan**`), the Execution Map table (Wave, Group, Steps, Status), the Steps table, the Wave Execution Log and any recorded commit SHAs. Never edit it.
2. Find the deliverable: the panel row whose Evidence or Next step cites that plan (or its spec); else the `E<n>` the plan's title or header names; else ask once.
3. Decide which pieces closed: a piece closes when every plan step that implements it has Status PASS (or an intentional skip). Map steps to pieces from the plan's own text (a step naming the piece, or a plan that covers exactly one piece). When the progress file cannot tell which piece a step belongs to: on "wave N closed" add one `log` row "wave N closed (steps …)" and set the deliverable to the `vocab.deliverableStatuses` word for executing (default `executing`); on "plan completed" mark the pieces the plan covers with the word for on-branch (default `on-branch`).
4. Record per § Piece or step closed. Evidence = the progress file path in backticks plus the commit SHAs it records (each verified with `git cat-file -e <sha>^{commit}`). Read the current branch with `git branch --show-current` and keep its "in flight" row `live`.
5. Ask the user only for what the progress file cannot tell, such as an integration SHA (a plan that completed on a branch is `on-branch`, not integrated) or an ambiguous step-to-piece mapping.
6. If a piece or the deliverable closed, run the end-of-piece check (Step 6). Hand back to plan-coordinator with the Step 7 report; it continues with the next wave.

### Step 5: Run the vendored checker

`node "<folder>/check-roadmap.mjs"` (no argument: it checks its own folder). Use the plugin's copy only when the vendored one is missing.

- **0 errors before handing back.** Fix every error this run introduced. Errors that were there before this run and need a user decision (for example a sixth `now` item: which one goes?) → ask, with a recommended fix. If no user answer is available (a caller like plan-coordinator, or the user defers), hand back `errors remain: <codes>` with one recommended fix per error (for example "now-limit: drop item 6, the least urgent") and do not claim 0 errors. Never hide an error.
- **Warnings are allowed** and are listed in the report, one line each. `contradiction-unabsorbed` may stay while a revision awaits approval; `checker-stale` means Step 2 was skipped or failed; `no-git` / `shallow-clone` mean the git checks did not run.

### Step 6: Revision

Triggers: a piece or phase ends; the checker warns `contradiction-unabsorbed`; a new requirement needs a card; the user asks.

1. **Propose** strategy vN+1 in the conversation, without writing it: the new version (minor bump, `1.0` → `1.1`, unless the user wants a major one for a changed objective or phases), the `DEC` IDs it absorbs, each section that changes with one line on how, card changes (pieces, acceptance, `reqs`, priority), and requirement or coverage changes. Checklist: `events.md` § End of piece or phase. If nothing needs changing, say so; the user may still ask for a revision.
2. **Ask for approval** (AskUserQuestion when available). Until the user approves, write nothing to the strategy. The proposal lives only in the conversation plus one pending item "(user) approve strategy v<N+1> (absorbs DEC-…)"; nothing else is written. After a compaction or in a new session, regenerate the proposal from the `DEC` rows the pending item names (and the § End of piece or phase checklist). The contradiction warning stays and the run may end with it.
3. **On approval:** update the `version` anchor (`<!-- roadmap:version <N+1> <date> -->`) and the title; add a changelog entry (newest first) listing the absorbed `DEC`; edit the changed sections and cite each absorbed `DEC` ID where it applies; regenerate "Where we are" from `state.md` and `critical-path.md`; add a version-history row. Then update whatever the revision moved (panel rows for new or dropped cards, `requirements.md`, `critical-path.md`), remove the approval pending item, add a `log` row "strategy v<N+1>: absorbs DEC-…" with the strategy path as evidence, and rerun Step 5.
4. **Rejected:** the user may change the decision instead; that is a new decision (§ Decision, superseding the old one).

### Step 7: Hand back

Reply with this, short:

```
Roadmap: <folder> | strategy v<version> | format <n>
Event: <what was recorded>
Files changed: <paths> (not committed)
Recorded: <new IDs and log rows, one line>
Checker: <vendored version> -> check-roadmap: <E> error(s), <W> warning(s)
Warnings: <one line each, or none>
Awaiting approval: <revision proposal summary, or none>
Questions: <anything only the user can answer, or none>
```

## Red flags

| Thought | Reality |
|---------|---------|
| "I remember the state from earlier" | Re-read the files; another session may have changed them |
| "The decision is obvious, I'll edit the card too" | The strategy changes only through an approved revision |
| "The new checker fails, but it's better, copy it anyway" | Keep the old copy and add the pending item |
| "I'll estimate the remaining effort for the panel" | No numbers nobody supplied |
| "The log row can say 'this commit'" | Banned phrase; cite a SHA or a path |
| "I'll commit so the update isn't lost" | Never commit; the author or orchestrator does |
