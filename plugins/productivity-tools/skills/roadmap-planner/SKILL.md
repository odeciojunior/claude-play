---
name: roadmap-planner
description: "Plans a roadmap: clarifies the objective, reads the sources, traces every requirement (REQ) to deliverables with acceptance criteria, phases, tracks and a dependency DAG, and writes a versioned strategy plus a tracking folder with a vendored checker. Full mode for multi-week initiatives, light mode for small ones. Use when the user wants a roadmap or an initiative with several deliverables to plan or break down: \"plan the roadmap for X\", \"break this initiative into deliverables\", \"we need a roadmap\". It is the choice for a tracked, multi-deliverable roadmap, even when a report is the input. Use it BEFORE superpowers:brainstorming when the work has several deliverables (brainstorming then runs once per deliverable). A report used only as input for SWOT, gap or risk analysis goes to report-analyzer first. Not for updating an existing roadmap folder (one with roadmap.config.json): use roadmap-tracker. Not for task-level plans of one deliverable: use superpowers:writing-plans."
---

# Roadmap Planner

Build a **living roadmap**: a versioned strategy document plus a tracking folder (state, decisions, log, sources, requirements, critical path) and a vendored checker that proves the structure. `roadmap-tracker` keeps it alive afterwards.

| This skill does | This skill does not |
|-----------------|---------------------|
| Clarify the objective, read sources, trace every requirement | Break deliverables into tasks (`superpowers:writing-plans`) |
| Organize deliverables into phases, tracks and a DAG | Execute deliverables (`plan-coordinator` for one written plan, `roadmap-release` for unattended runs of one or more deliverables) |
| Write strategy v1.0 + tracking folder, run the checker | Update an existing roadmap (`roadmap-tracker`) |
| Order work by dependencies | Produce dates, durations or targets nobody supplied |

**Core principle:** every claim in the roadmap traces to a source (`SRC`), a user decision (`DEC`) or is tagged `ASSUMPTION` / `UNSOURCED`. The checker, not self-assessment, decides when the structure is done.

## Paths

| What | Where |
|------|-------|
| Format contract (every file template, anchors, IDs, config) | `references/formats.md` |
| Clarification method | `references/clarify.md` |
| Requirement extraction and decomposition | `references/decompose.md` |
| Checker source (sibling skill, same plugin) | `${CLAUDE_SKILL_DIR}/../roadmap-tracker/scripts/check-roadmap.mjs` |
| Roadmap folder (output) | default `docs/plans/roadmap-<topic>/`; the user may override it |

Take every file template from `references/formats.md`; this file does not repeat them. If `${CLAUDE_SKILL_DIR}` appears empty or literally in a command, use the directory this SKILL.md was loaded from. If the checker source does not exist at that path, stop and tell the user; never write a checker from memory.

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
| Card | All attributes of `formats.md` §5 | Acceptance (≥2, each with its verification tag), `depends`, `reqs`; defaults `priority=Must`, `size="not estimated"`, `track` defaults to the first track (`engineering`), but use `measurement`, `external` or `decisions` when the card is clearly that kind, `critical` from the DAG; critical cards still get ≥1 risk line |
| Fresh-context reviewer | Yes (Step 7) | No; the handoff says none ran |
| REQ/SRC traceability, vendored checker, tracker | Yes | Yes |

Resolve the roadmap folder (default `docs/plans/roadmap-<topic>/`, `<topic>` a short kebab-case slug).

| Folder state | Action |
|--------------|--------|
| Has `roadmap.config.json` | **Stop.** This is an existing roadmap. Offer `roadmap-tracker` to update it, or to propose a strategy revision. Write nothing. |
| Has `planning-draft.md`, no `roadmap.config.json` | **Resume** from the draft (see "Planning draft"); do not redo the questions it records |
| Exists without `roadmap.config.json` | Ask before writing into it, or pick another folder |
| Does not exist | Continue |

Also settle now:

- **Language** of the documents (Rule 7).
- **Integration branch** (config `integrationBranch`): in a git repo, the repo's default branch — `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`); if that fails or the repo has several candidate branches, ask. Outside a git repo, ask which branch the work will integrate into (default `main`); the checker then skips git checks with one `no-git` warning, which is expected and listed in the handoff.
- **Release branch** (config `releaseBranch`): ask whether deliverables merge into an intermediate release branch before the integration branch. If yes, record its name; if no, omit the key.

**Planning draft.** `<roadmap-folder>/planning-draft.md` keeps the answers across a crash or `/clear`. Write it (create the folder if it does not exist; the draft is then its only file) after Step 1, after Step 2, and after each round of questions, overwriting it with: objective and mode, sources read (paths), questions asked, the user's answers verbatim, the `DEC` and `REQ` rows so far, and the next step. Never put a secret the user pasted (token, password, key) in it; write "[omitted: secret]" instead. If the draft exists at Step 0, tell the user you are resuming from it, read it, skip the mode question and any question it records as answered, and continue at its next step. Step 6 deletes it.

### Step 1: Intake and sources

1. Take the objective and the sources passed as arguments. When the user supplies only an objective (or a brief in the conversation), register it as `SRC-01` (What it is: user brief) so requirements can cite it (`decompose.md` §1).
2. **Discover** related sources (light mode: skip; use only the sources passed): repo docs, specs, issues, git history (`git log` on the relevant paths). Use the web only if the user allows it; ask once.
3. **Read** them. With a subagent tool, delegate the reading to subagents with `model: sonnet`, `effort: medium` (several sources per subagent, in parallel when independent); the main conversation keeps the judgment. Subagents do not see the conversation: put the source paths and the summary format below in each Agent prompt, then wait for its completion notification before using the result. Without a subagent tool, read the sources directly. Either way, each source yields this summary, at most 10 lines:

   ```
   SRC-NN | <path or URL> | <what it is> | read <full|partial: which sections>
   Reliability: <who wrote it, how current, primary or secondary>
   Claims: <requirements, constraints, numbers, dates, each with section/line>
   Open: <gaps, placeholders, TODOs>
   ```

4. Assign `SRC-NN` IDs in reading order. Compare the claims across sources; every disagreement becomes one item in the `conflicts` block (`SRC-a vs SRC-b: <what disagrees>`) and a clarify candidate with uncertainty 3.
5. Draft `sources.md` per `formats.md` §7.
6. Write `planning-draft.md` (see "Planning draft" in Step 0).

### Step 2: Clarify

Follow `references/clarify.md`: scan the ambiguity categories, score impact × uncertainty, ask capacity and date constraints before or together with the scope decisions (showing the accumulated cost when a sourced estimate exists), settle the executor autonomy policy (`clarify.md` §7; the autonomy question is a clarification question and counts toward the budget (light mode: one of the 3; full mode: one of the round's 5), unlike the mode question), ask at most 5 questions per round (light mode: at most 3 in one round), **one at a time**, each with a recommended answer (use `AskUserQuestion` when available). Run another round per theme only with the user's consent (never in light mode); stop by the stop rule. Stay at roadmap level: deliverable-level design questions are not asked now; record them as "Open questions" entries in the strategy, prefixed `E<n>:`, for `superpowers:brainstorming` (`clarify.md` §8).

Record every answer: a **choice** becomes a `DEC-NNN` row (origin `user`); an **unverified fact** becomes an Assumption tagged `ASSUMPTION`. A **deferred** or unanswered question is not a `DEC`: it becomes an "Open questions" entry plus a `pending` item with an owner in `state.md`, and a `BLQ-n` in `blockers` when it blocks a deliverable; a related `conflicts` item stays and names that question (`clarify.md` §7). Never record an answer the user did not give. Update `planning-draft.md` after each round and when this step ends.

### Step 3: Requirements

Extract `REQ-NNN` from the source summaries and the answers, per `references/decompose.md` §1. Each row cites its `SRC`/`DEC` in Sources. A requirement left unresolved (an unanswered conflict, a missing fact) gets coverage `needs-clarification` and an open question.

### Step 4: Decompose

Follow `references/decompose.md`: walking skeleton first (`E1`), then vertical slices; deliverables grouped into outcome-named phases with entry and exit criteria (the strategy's "Phases" section); one track per card; dependencies as a DAG; critical path as an ordering only (no dates unless supplied). Each card gets ≥2 Given-When-Then acceptance criteria, each with its verification tag, a definition of done citing gate IDs and, when critical, at least one risk; split a deliverable that mixes automatic work with human acceptance or an external environment (`decompose.md` §10). A requirement that closes a class of defects needs the closed ID list and its sweeping gate (`decompose.md` §11). Light mode: cards are minimal (acceptance ≥2, each still with its verification tag, `depends`, `reqs`) with the defaults of the Step 0 table; critical cards still get ≥1 risk.

Then prove coverage: every `REQ` maps to ≥1 deliverable or is `out-of-scope: <reason>`; every card cites ≥1 `REQ`; a requirement's Deliverables and the card's `reqs` agree both ways. A `needs-clarification` requirement still lists in Deliverables the deliverable that will resolve or satisfy it (for example a gate deliverable on the `decisions` or `external` track); this is allowed and keeps it traced.

### Step 5: Prioritize

MoSCoW (`Must`, `Should`, `Could`, `Won't`) plus the DAG is the single default (`decompose.md` §8). Challenge the user when more than half of the deliverables are `Must` (full mode only; in light mode every card is `Must` by default, so skip the challenge and say in the handoff that the priorities were not challenged). Use WSJF only to order deliverables the DAG leaves unconstrained, and only with inputs the user supplies. No RICE. Size is a range with its basis, or `not estimated`.

### Step 6: Write the files

Write every file listed in `${CLAUDE_SKILL_DIR}/references/decompose.md` §13, each from its template in `references/formats.md` and in the project's language.

**Gates.** Always write the strategy's "Gates and verification" section (the gates table of `formats.md`), copying the commands from the project's CLAUDE.md and the sources; never invent one. The cards' Definition of done cites the gate IDs. Write the Metrics and Flags sections only when they are not empty. New roadmaps write `limits.pendingItems: 20` in the config.

**Volatile values.** A value that changes over time (counts, test totals, versions, "current" status) is written once, with the command that measures it and the date; every other file points to that place instead of repeating the value.

Then **copy the checker** into the folder and confirm the copy runs:

```bash
cp "${CLAUDE_SKILL_DIR}/../roadmap-tracker/scripts/check-roadmap.mjs" "<roadmap-folder>/check-roadmap.mjs"
node "<roadmap-folder>/check-roadmap.mjs" --version
```

The `--version` output reads `<version> format <n>`; `<n>` must equal `formatVersion`.

When the definitive files are written, delete `<roadmap-folder>/planning-draft.md`.

### Step 7: Verify

1. Run the vendored copy: `node "<roadmap-folder>/check-roadmap.mjs"`. Fix and re-run until it reports **0 errors**. Warnings may remain (typically `markers`, `needs-clarification`, `no-git` outside a repo); list them in the handoff. Fix the files, never the checker. If `node` is missing or older than 18, do not claim the folder verified: stop, or hand off saying "checker not run (Node ≥18 missing)".
2. Full mode: dispatch **one fresh-context reviewer** subagent with `model: opus`, `effort: medium`, with the roadmap folder, the strategy path and the source paths, and exactly this brief (it is read-only; tell it "do not edit files"): *"Report only correctness errors, uncovered requirements, untraced claims and invented numbers; no style."* Light mode: skip the reviewer and say in the handoff that no independent review ran. Without a subagent tool, do not self-review as if independent: say in the handoff that no independent review ran, and recommend running the same brief in a fresh session before the roadmap is used.
3. Fix what the reviewer found, then run the checker again until 0 errors.

### Step 8: Hand off

Report to the user:

- **Summary**: folder and strategy paths, deliverables per phase, requirement coverage (covered / out of scope / to clarify), open questions, checker result with the remaining warnings.
- **Now**: the `now` list from `state.md`.
- **Next**: the first deliverable goes through the chain below. The downstream skills know nothing about the roadmap, so give the user these exact instructions:
  1. `superpowers:brainstorming` (runs per deliverable, not for the whole roadmap). Start it with: "Brainstorm deliverable E<n> of the roadmap at <folder>; its card is in <strategy> (section E<n>): acceptance criteria, REQs <ids>, depends on <ids>. Do not re-ask what the card settles; the spec must keep the card's acceptance criteria and cite E<n>."
  2. `superpowers:writing-plans`: tell it to add the header line `**Roadmap:** <folder>` (it has no such slot; plan-coordinator reads it to call `roadmap-tracker` after each wave). It saves to `docs/superpowers/plans/`, and `plan-coordinator` finds plans there too.
  3. Execution: writing-plans offers only subagent-driven or native execution; when the roadmap is tracked, pick `plan-coordinator` as the executor.
- **Several deliverables unattended**: `roadmap-release` runs one or more deliverables end to end into a release branch (spec, plan, reviewed tasks, gates, serialized merge). Prefer it when the roadmap has several deliverables to run.
- **How to execute each deliverable**: `plan-coordinator` handles the plan of one deliverable at a time and approves its own execution map. It does not integrate branches and does not run several deliverables in one go; integration and the next deliverable are separate steps the user (or the owner) starts.
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
