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
| Planning model contract (read at Step 6) | `references/model.md` |
| Scaffold that writes the folder from the model | `scripts/scaffold.mjs` |
| Format contract, consulted by section when a model field asks for it | `references/formats.md §n` |
| Clarification method | `references/clarify.md` |
| Requirement extraction and decomposition | `references/decompose.md` |
| Checker source (sibling skill, same plugin) | `${CLAUDE_SKILL_DIR}/../roadmap-tracker/scripts/check-roadmap.mjs` |
| Roadmap folder (output) | default `docs/plans/roadmap-<topic>/`; the user may override it |

If `${CLAUDE_SKILL_DIR}` appears empty or literally in a command, use the directory this SKILL.md was loaded from. If the checker source does not exist at that path, stop and tell the user; never write a checker from memory.

## Rules

1. **No invented numbers.** Never write a date, duration, metric, target, baseline or estimate that the user or a source did not supply. Today's date in records is a fact, not an estimate.
2. **Unsourced claims are tagged.** A claim without a `SRC` or `DEC` carries `ASSUMPTION` (unverified fact, in the Assumptions table with owner and "re-validate when") or `UNSOURCED` (cited from somewhere unverifiable). A number in the objective with no baseline ("halve the response time") is an `ASSUMPTION` and a clarify question, never a target or acceptance criterion until the user names its baseline and basis.
3. **Conflicts are recorded, never resolved silently.** Every disagreement between sources goes into the `conflicts` block; it is settled only by a user answer (`DEC`) or stays an open question.
4. **One fact, one place.** The strategy holds no state; `state.md` holds no history; `log.md` and `decisions.md` are append-only.
5. **Deliverable granularity.** A deliverable (`E<n>`) ends at "gets its own spec and plan". Pieces are vertical slices, each shippable alone. No task-sized deliverables.
6. **Bounded questions.** At most 5 questions per round (3 in light mode), one at a time, each with a recommended answer; more rounds only with the user's consent.
7. **Language.** Generated documents are written in the project's language (from the user's messages or the project's CLAUDE.md; ask once if unclear). Anchors, IDs and the config keys stay as in `formats.md` §2-4; status words may be localized through `vocab`.

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

**Mode.** Ask ONE question, with a recommended answer inferred from the request: "Is this a multi-deliverable initiative that will run for weeks?" Yes -> **full** mode; no -> **light** mode. This question does not count toward the Rule 6 budget. Record the mode in the handoff and in the strategy changelog's v1.0 entry ("light mode" or "full mode").

| | Full | Light |
|---|------|-------|
| Clarification | Rule 6 | Rule 6 |
| Sources | Discovered and read (Step 1) | Only those passed |
| Card | All attributes of `formats.md` §5 | The minimum and defaults of `decompose.md` §12 |
| Fresh-context reviewer | Yes (Step 7) | No; the handoff says none ran |
| REQ/SRC traceability, vendored checker, tracker | Yes | Yes |

Before fixing the slug, look for `docs/plans/*/planning-model.json`. If exactly one exists and its objective matches this request, use its folder and resume. If its objective does not match, ask whether to resume it or start new. If more than one exists, ask which one to resume, or to start new. A `planning-draft.md` left by an earlier version is read once as the source of the resume and converted into the model; it is not read again.

Resolve the roadmap folder (default `docs/plans/roadmap-<topic>/`).

| Folder state | Action |
|--------------|--------|
| Has `roadmap.config.json` and `planning-model.json` | Step 6 was interrupted: run the scaffold again from the model (Step 6), then Step 7 |
| Has `roadmap.config.json`, no `planning-model.json` | **Stop.** This is an existing roadmap. Offer `roadmap-tracker` to update it, or to propose a strategy revision. Write nothing. |
| Has `planning-model.json`, no `roadmap.config.json` | **Resume** from the model (see "Planning model"); do not redo the questions it records |
| Exists without `roadmap.config.json` | Ask before writing into it, or pick another folder |
| Does not exist | Continue |

Also settle now:

- **Language** of the documents (Rule 7).
- **Integration branch** (`integrationBranch`): in a git repo, the default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`, strip `origin/`); if that fails or several candidates exist, ask. Outside a git repo, ask (default `main`); the checker then warns `no-git`, expected and listed in the handoff.
- **Release branch** (`releaseBranch`): ask whether deliverables merge into an intermediate release branch first. If yes, record its name; if no, omit the key.

**Planning model.** `<roadmap-folder>/planning-model.json` (contract: `references/model.md`) keeps the work across a crash or `/clear`. Write the whole model, with `nextStep`, after Steps 1 to 5 and after each round of questions; create the folder if needed. Never put a secret in it: write "[omitted: secret]". If the model exists at Step 0, tell the user you are resuming, skip the mode question and any question it records as answered, and continue at `nextStep`. Step 7 deletes it once the checker and the reviewer pass.

### Step 1: Intake and sources

1. Take the objective and the sources passed as arguments. When the user supplies only an objective (or a brief in the conversation), register it as `SRC-01` (What it is: user brief) so requirements can cite it (`decompose.md` §1).
2. **Discover** related sources (light mode: skip): repo docs, specs, issues, `git log` on the relevant paths. Use the web only if the user allows it; ask once.
3. **Read** them. With a subagent tool, delegate the reading with `model: sonnet`, `effort: medium` (several sources per subagent); the main conversation keeps the judgment. Subagents do not see the conversation: put the source paths and the summary format in each prompt and wait for the result. Without a subagent tool, read directly. Each source yields this summary, at most 10 lines:

   ```
   SRC-NN | <path or URL> | <what it is> | read <full|partial: which sections>
   Reliability: <who wrote it, how current, primary or secondary>
   Claims: <requirements, constraints, numbers, dates, each with section/line>
   Open: <gaps, placeholders, TODOs>
   ```

4. Assign `SRC-NN` IDs in reading order. Compare the claims across sources; every disagreement becomes one item in the `conflicts` block (`SRC-a vs SRC-b: <what disagrees>`) and a clarify candidate with uncertainty 3.
5. Record the sources and conflicts in the model's `sources` and `conflicts`.
6. Write the planning model (see "Planning model" in Step 0).

### Step 2: Clarify

Follow `references/clarify.md` within the budget of Rule 6 (the autonomy question of `clarify.md` §7 counts toward it, unlike the mode question). Use `AskUserQuestion` when available. Stay at roadmap level: deliverable-level design questions become `E<n>:` entries in "Open questions" for `superpowers:brainstorming` (`clarify.md` §8).

Record every answer where `clarify.md` §7 says; never record an answer the user did not give. Write the model after each round and when this step ends.

### Step 3: Requirements

Extract `REQ-NNN` from the source summaries and the answers, per `references/decompose.md` §1. Each row cites its `SRC`/`DEC` in Sources. A requirement left unresolved (an unanswered conflict, a missing fact) gets coverage `needs-clarification` and an open question.

### Step 4: Decompose

Follow `references/decompose.md`: walking skeleton first (`E1`), then vertical slices in outcome-named phases; one track per card; a DAG; critical path as an ordering only (no dates unless supplied). Acceptance criteria and the definition of done follow `decompose.md` §10. Light mode uses the card defaults of `decompose.md` §12. Then run the coverage pass of `decompose.md` §11.

### Step 5: Prioritize

Prioritize per `decompose.md` §8 (MoSCoW plus the DAG; the "more than half `Must`" challenge is full mode only) and size per §9.

### Step 6: Write the files

Complete the model (`model.md` §4-§7). **Gates**: copy the commands from the project's CLAUDE.md and the sources into `gates`; never invent one. A value that changes over time (counts, test totals, versions) is written once, with the command that measures it and the date; every other file points to that place.

Then run the scaffold, which writes the folder and the strategy and copies the checker:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs" "<roadmap-folder>/planning-model.json" --json
```

On exit 1, fix the model at each error's `path` (codes: `model.md` §11) and run again until exit 0; do not edit generated files. Treat each `defaulted` item: accept it, or fill the field in the model and run again. Keep `planning-model.json` until Step 7 ends.

### Step 7: Verify

1. Run the vendored copy: `node "<roadmap-folder>/check-roadmap.mjs"` until it reports **0 errors**; list the remaining warnings in the handoff. Fix the model, never the checker. If `node` is missing or older than 18, hand off saying "checker not run (Node ≥18 missing)".
2. Full mode: dispatch **one fresh-context reviewer** subagent with `model: opus`, `effort: medium`, read-only (tell it "do not edit files"), with the roadmap folder, the strategy path, the source paths and the path of `${CLAUDE_SKILL_DIR}/references/review-rubric.md`, which the reviewer reads and applies; it returns the JSON block that file defines. Light mode, or no subagent tool: skip it, never self-review as if independent, and say in the handoff that no independent review ran (without a subagent tool, recommend the same brief in a fresh session before use).
3. Loop, at most three review rounds in total: fix each `error` finding in the model, run the scaffold and the checker until 0 errors, and dispatch a fresh reviewer only if the previous round had an `error` finding. `warning` findings go to the handoff. An `error` left after the third round goes to the handoff as a pending item, without another round.
4. Delete `<roadmap-folder>/planning-model.json`.

### Step 8: Hand off

Report to the user:

- **Summary**: folder and strategy paths, deliverables per phase, requirement coverage, open questions, checker result with the remaining warnings, and the `now` list from `state.md`.
- **Next**: the first deliverable goes through the chain below. The downstream skills know nothing about the roadmap, so give the user these exact instructions:
  1. `superpowers:brainstorming`, per deliverable. Start it with: "Brainstorm deliverable E<n> of the roadmap at <folder>; its card is in <strategy> (section E<n>): acceptance criteria, REQs <ids>, depends on <ids>. Do not re-ask what the card settles; the spec must keep the card's acceptance criteria and cite E<n>."
  2. `superpowers:writing-plans`: tell it to add the header line `**Roadmap:** <folder>` (plan-coordinator reads it to call `roadmap-tracker` after each wave).
  3. Execution: when the roadmap is tracked, pick `plan-coordinator` as the executor.
- **Several deliverables unattended**: prefer `roadmap-release`, which runs them end to end into a release branch. `plan-coordinator` handles one deliverable's plan at a time and does not integrate branches; integration and the next deliverable are separate steps the user starts.
- **Later events** (a decision, a piece closed, an integration, a blocker, a measurement, end of a phase) → `roadmap-tracker`.

The files stay in the working tree for the user to review and commit.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Turning the user's "halve X" into a target | `ASSUMPTION` + clarify question (Rule 2) |
| Picking one side of a source conflict | `conflicts` block + question; `DEC` only (Rule 3) |
| Deliverables named by layer, phases named Foundation / Build | Vertical slices, outcome-named phases (`decompose.md` §4, §5) |
| Writing the folder files by hand | Fill the model; the scaffold writes them (`model.md` §10) |
| Editing the checker to make it pass | Fix the roadmap files |
