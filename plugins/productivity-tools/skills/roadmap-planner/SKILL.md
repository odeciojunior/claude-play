---
name: roadmap-planner
description: "Use when the user wants a roadmap, or an initiative with several deliverables to plan or break down: \"plan the roadmap for X\", \"break this initiative into deliverables\", \"we need a roadmap\". Use it BEFORE superpowers:brainstorming when the work has several deliverables (brainstorming then runs once per deliverable). Clarifies the objective, reads the sources (a report or research document may be one of them), traces every requirement (REQ) to deliverables with acceptance criteria, phases, tracks and a dependency DAG, and writes a versioned strategy plus a tracking folder with a vendored checker. Full mode for multi-week initiatives, light mode for small ones. Not for updating an existing roadmap folder (one with roadmap.config.json): use roadmap-tracker. Not for task-level plans of one deliverable: use superpowers:writing-plans. Not for SWOT, gap or risk analysis of a report: use report-analyzer."
---

# Roadmap Planner

Build a **living roadmap**: a versioned strategy document plus a tracking folder (state, decisions, log, sources, requirements, critical path) and a vendored checker that proves the structure. `roadmap-tracker` keeps it alive afterwards.

| This skill does | This skill does not |
|-----------------|---------------------|
| Clarify the objective, read sources, trace every requirement | Break deliverables into tasks (`superpowers:writing-plans`) |
| Organize deliverables into phases, tracks and a DAG | Execute deliverables (`plan-coordinator`) |
| Write strategy v1.0 + tracking folder, run the checker | Update an existing roadmap (`roadmap-tracker`) |
| Order work by dependencies | Produce dates, durations or targets nobody supplied |

**Core principle:** every claim in the roadmap traces to a source (`SRC`), a user decision (`DEC`) or is tagged `ASSUMPTION` / `UNSOURCED`. The checker, not self-assessment, decides when the structure is done.

## Paths

| What | Where |
|------|-------|
| Format contract (every file template, anchors, IDs, config) | `references/formats.md` |
| Clarification method | `references/clarify.md` |
| Requirement extraction and decomposition | `references/decompose.md` |
| Checker source | `<base>/../roadmap-tracker/scripts/check-roadmap.mjs`, where `<base>` is the "Base directory for this skill: …" Claude Code prints on invocation |
| Roadmap folder (output) | default `docs/plans/roadmap-<topic>/`; the user may override it |

Take every file template from `references/formats.md`; this file does not repeat them. If the checker source does not exist at that path, stop and tell the user; never write a checker from memory.

## Rules

1. **No invented numbers.** Never write a date, duration, metric, target, baseline or estimate that the user or a source did not supply. Today's date in records (`version` anchor, log, decisions, "Read on") is a fact, not an estimate.
2. **Unsourced claims are tagged.** A claim without a `SRC` or `DEC` carries `ASSUMPTION` (unverified fact, in the Assumptions table with owner and "re-validate when") or `UNSOURCED` (cited from somewhere unverifiable). A number in the objective with no source or baseline (e.g. "halve the response time") is an `ASSUMPTION` and a clarify question, never a target in "Metrics and targets" or an acceptance criterion, until the user names its baseline and basis.
3. **Conflicts are recorded, never resolved silently.** Every disagreement between sources goes into the `conflicts` block; it is settled only by a user answer (`DEC`) or stays an open question.
4. **One fact, one place.** The strategy holds no state; `state.md` holds no history; `log.md` and `decisions.md` are append-only.
5. **Deliverable granularity.** A deliverable (`E<n>`) ends at "gets its own spec and plan". Pieces are vertical slices, each shippable alone. No task-sized deliverables.
6. **Bounded questions.** At most 5 questions per round (3 in light mode), one at a time, each with a recommended answer; more rounds only with the user's consent.
7. **Language.** Generated documents are written in the project's language (from the user's messages or the project's CLAUDE.md; ask once if unclear). Anchors, IDs and the config keys stay as in `formats.md`; status words may be localized through `vocab`.

## Workflow

Copy this checklist into your working notes and tick it off:

```
- [ ] 0 Resume + mode     - [ ] 5 Prioritize
- [ ] 1 Intake + sources  - [ ] 6 Write files + copy checker
- [ ] 2 Clarify           - [ ] 7 Verify (checker, reviewer)
- [ ] 3 Requirements      - [ ] 8 Hand off
- [ ] 4 Decompose
```

### Step 0: Resume check and mode

**Order.** First resolve the roadmap folder and check it (table below); only then ask the mode question.

**Mode.** Ask ONE question, with a recommended answer inferred from the request: "Is this a multi-deliverable initiative that will run for weeks?" Yes -> **full** mode; no -> **light** mode. This question does not count toward the light mode's ≤3 clarification questions. Record the mode in the handoff and in the strategy changelog's v1.0 entry ("light mode" or "full mode"), so a later session can recover it.

| | Full | Light |
|---|------|-------|
| Clarification | ≤5 questions per round, more rounds with consent | ≤3 questions, one round |
| Sources | Discovered and read (Step 1) | Only those passed |
| Card | All attributes of `formats.md` §5 | Acceptance (≥2), `depends`, `reqs`; defaults `priority=Must`, `size="not estimated"`, `track` = the first entry of the config's `tracks`, `critical` from the DAG; critical cards still get ≥1 risk line |
| Fresh-context reviewer | Yes (Step 7) | No; the handoff says none ran |
| REQ/SRC traceability, vendored checker, tracker | Yes | Yes |

Resolve the roadmap folder (default `docs/plans/roadmap-<topic>/`, `<topic>` a short kebab-case slug).

| Folder state | Action |
|--------------|--------|
| Has `roadmap.config.json` | **Stop.** This is an existing roadmap. Offer `roadmap-tracker` to update it, or to propose a strategy revision. Write nothing. |
| Exists without `roadmap.config.json` | Ask before writing into it, or pick another folder |
| Does not exist | Continue |

Also settle now:

- **Language** of the documents (Rule 7).
- **Integration branch** (config `integrationBranch`): in a git repo, the repo's default branch — `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`); if that fails or the repo has several candidate branches, ask. Outside a git repo, ask which branch the work will integrate into (default `main`); the checker then skips git checks with one `no-git` warning, which is expected and listed in the handoff.

### Step 1: Intake and sources

1. Take the objective and the sources passed as arguments. When the user supplies only an objective (or a brief in the conversation), register it as `SRC-01` (What it is: user brief) so requirements can cite it (`decompose.md` §1).
2. **Discover** related sources (light mode: skip; use only the sources passed): repo docs, specs, issues, git history (`git log` on the relevant paths). Use the web only if the user allows it; ask once.
3. **Read** them. With a subagent tool, delegate the reading to subagents on a cheap tier (several sources per subagent, in parallel when independent); the main conversation keeps the judgment. Without a subagent tool, read the sources directly. Either way, each source yields this summary, at most 10 lines:

   ```
   SRC-NN | <path or URL> | <what it is> | read <full|partial: which sections>
   Reliability: <who wrote it, how current, primary or secondary>
   Claims: <requirements, constraints, numbers, dates, each with section/line>
   Open: <gaps, placeholders, TODOs>
   ```

4. Assign `SRC-NN` IDs in reading order. Compare the claims across sources; every disagreement becomes one item in the `conflicts` block (`SRC-a vs SRC-b: <what disagrees>`) and a clarify candidate with uncertainty 3.
5. Draft `sources.md` per `formats.md` §7.

### Step 2: Clarify

Follow `references/clarify.md`: scan the ambiguity categories, score impact × uncertainty, ask at most 5 questions per round (light mode: at most 3 in one round), **one at a time**, each with a recommended answer (use `AskUserQuestion` when available). Run another round per theme only with the user's consent (never in light mode); stop by the stop rule. Stay at roadmap level: deliverable-level design questions are not asked now; record them as "Open questions" entries in the strategy, prefixed `E<n>:`, for `superpowers:brainstorming` (`clarify.md` §8).

Record every answer: a **choice** becomes a `DEC-NNN` row (origin `user`); an **unverified fact** becomes an Assumption tagged `ASSUMPTION`. A **deferred** or unanswered question is not a `DEC`: it becomes an "Open questions" entry plus a `pending` item with an owner in `state.md`, and a `BLQ-n` in `blockers` when it blocks a deliverable; a related `conflicts` item stays and names that question (`clarify.md` §7). Never record an answer the user did not give.

### Step 3: Requirements

Extract `REQ-NNN` from the source summaries and the answers, per `references/decompose.md` §1. Each row cites its `SRC`/`DEC` in Sources. A requirement left unresolved (an unanswered conflict, a missing fact) gets coverage `needs-clarification` and an open question.

### Step 4: Decompose

Follow `references/decompose.md`: walking skeleton first (`E1`), then vertical slices; deliverables grouped into outcome-named phases with entry and exit criteria (the strategy's "Phases" section); one track per card; dependencies as a DAG; critical path as an ordering only (no dates unless supplied). Each card gets ≥2 Given-When-Then acceptance criteria, a definition of done and, when critical, at least one risk. Light mode: cards are minimal (acceptance ≥2, `depends`, `reqs`) with the defaults of the Step 0 table; critical cards still get ≥1 risk.

Then prove coverage: every `REQ` maps to ≥1 deliverable or is `out-of-scope: <reason>`; every card cites ≥1 `REQ`; a requirement's Deliverables and the card's `reqs` agree both ways. A `needs-clarification` requirement still lists in Deliverables the deliverable that will resolve or satisfy it (for example a gate deliverable on the `decisions` or `external` track); this is allowed and keeps it traced.

### Step 5: Prioritize

MoSCoW (`Must`, `Should`, `Could`, `Won't`) plus the DAG is the single default (`decompose.md` §8). Challenge the user when more than half of the deliverables are `Must` (full mode only; in light mode every card is `Must` by default, so skip the challenge and say in the handoff that the priorities were not challenged). Use WSJF only to order deliverables the DAG leaves unconstrained, and only with inputs the user supplies. No RICE. Size is a range with its basis, or `not estimated`.

### Step 6: Write the files

Write every file from its template in `references/formats.md`, in the project's language:

| File | Content at creation | formats.md |
|------|---------------------|------------|
| Strategy (config `strategy`, default `../<date>-roadmap-<topic>.md`, never `*-plan.md`: if `<topic>` ends in `-plan`, drop that suffix) | v1.0, all 18 sections (including Phases), one card per deliverable | §5 |
| `roadmap.config.json` | `formatVersion` 1, language, strategy path, `integrationBranch` from Step 0, file names, vocab (set `vocab.blockedStatus` and `vocab.discardedStatus` to the localized words, which must also be in `deliverableStatuses`), tracks, limits | §2 |
| `README.md` | files, check command `node <roadmap-folder>/check-roadmap.mjs`, "when to update" table | §8 |
| `state.md` | initial `now` (≤ `limits.nowItems`, each item "<action>. Runs: <who>. Approves: <who>. Depends on: <ids>."), one panel row per card (the first `deliverableStatuses` word; the configured `vocab.blockedStatus` word citing its `BLQ-n` when it waits on a blocker from Step 2, and that BLQ row's "Unblocks when" records "restores E<n> to <the first `deliverableStatuses` word>", which `events.md` § 5 reads on closing), empty inflight, pending with owners; blocks `donot` ("Do not do now", each item citing a `BLQ-n` or `DEC-NNN`) and `releases` only when the sources or answers call for them | §6 |
| `decisions.md` | the `DEC` rows from Step 2 (Contradicts `-`: v1.0 is built from them) | §6 |
| `log.md` | one row: today, `-`, roadmap created, evidence = the strategy path | §6 |
| `sources.md`, `requirements.md` | from Steps 1 and 3 | §7 |
| `critical-path.md` | Mermaid DAG of the cards and gates, next gate per track | §7 |
| `measurements.md` | only when the roadmap has paid runs or measurement milestones; otherwise `files.measurements: null` | §7 |

**Volatile values.** A value that changes over time (counts, test totals, versions, "current" status) is written once, with the command that measures it and the date; every other file points to that place instead of repeating the value.

Then **copy the checker** into the folder and confirm the copy runs:

```bash
cp "<base>/../roadmap-tracker/scripts/check-roadmap.mjs" "<roadmap-folder>/check-roadmap.mjs"
node "<roadmap-folder>/check-roadmap.mjs" --version   # "<version> format <n>"; <n> must equal formatVersion
```

### Step 7: Verify

1. Run the vendored copy: `node "<roadmap-folder>/check-roadmap.mjs"`. Fix and re-run until it reports **0 errors**. Warnings may remain (typically `markers`, `needs-clarification`, `no-git` outside a repo); list them in the handoff. Fix the files, never the checker. If `node` is missing or older than 18, do not claim the folder verified: stop, or hand off saying "checker not run (Node ≥18 missing)".
2. Full mode: dispatch **one fresh-context reviewer** subagent on a strong tier, with the roadmap folder, the strategy path and the source paths, and exactly this brief: *"Report only correctness errors, uncovered requirements, untraced claims and invented numbers; no style."* Light mode: skip the reviewer and say in the handoff that no independent review ran. Without a subagent tool, do not self-review as if independent: say in the handoff that no independent review ran, and recommend running the same brief in a fresh session before the roadmap is used.
3. Fix what the reviewer found, then run the checker again until 0 errors.

### Step 8: Hand off

Report to the user:

- **Summary**: folder and strategy paths, deliverables per phase, requirement coverage (covered / out of scope / to clarify), open questions, checker result with the remaining warnings.
- **Now**: the `now` list from `state.md`.
- **Next**: the first deliverable goes through the chain below. The downstream skills know nothing about the roadmap, so give the user these exact instructions:
  1. `superpowers:brainstorming` (runs per deliverable, not for the whole roadmap). Start it with: "Brainstorm deliverable E<n> of the roadmap at <folder>; its card is in <strategy> (section E<n>): acceptance criteria, REQs <ids>, depends on <ids>. Do not re-ask what the card settles; the spec must keep the card's acceptance criteria and cite E<n>."
  2. `superpowers:writing-plans`: tell it to add the header line `**Roadmap:** <folder>` (it has no such slot; plan-coordinator reads it to call `roadmap-tracker` after each wave). It saves to `docs/superpowers/plans/`, and `plan-coordinator` finds plans there too.
  3. Execution: writing-plans offers only subagent-driven or native execution; when the roadmap is tracked, pick `plan-coordinator` as the executor.
- **Later events** (a decision, a piece closed, an integration, a blocker, a measurement, end of a phase) → `roadmap-tracker`.

The files stay in the working tree for the user to review and commit.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Turning the user's "halve X" into a target | `ASSUMPTION` + clarify question; target only with a named baseline and basis (Rule 2) |
| Picking one side of a source conflict | `conflicts` block + question; settle by `DEC` only (Rule 3) |
| Deliverables named by layer ("database", "UI") | Vertical slices; layer work only as justified enabling work (`decompose.md` §4) |
| Phases called Foundation / Build / Scale | Name each phase by the outcome it delivers (`decompose.md` §5) |
| Task-sized deliverables | Merge until each one needs its own spec and plan (Rule 5) |
| Asking ten questions in one message | One at a time, ≤5 per round (Rule 6) |
| Writing templates from memory | Copy them from `references/formats.md` |
| Editing the checker to make it pass | Fix the roadmap files |
