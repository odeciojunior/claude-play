# roadmap-planner v2 + roadmap-tracker — Design

**Date**: 2026-10-16 | **Plugin**: productivity-tools 1.1.0 → 1.2.0 | **Status**: draft for approval

## Intent

The author's default way to plan a roadmap, for any project. Two skills cover the whole life of a roadmap:

- **`roadmap-planner` (v2)** builds it: clarifies the objectives, inventories and reads the sources (the ones passed as parameters plus the related ones it finds), decomposes *every* requirement, and organizes the roadmap into deliverables that can be implemented in parts.
- **`roadmap-tracker` (new)** keeps it alive: on each event (a decision, a piece closed, an integration, a blocker, a measurement) it updates the tracking files, and at the end of a piece or phase it proposes the next roadmap revision.

**Why.** v1 (a copy of a BDesk agent) produces a single static document. The author's practice evolved past it: the BDesk chatbot roadmap (`bdesk/docs/plans/2026-10-14-roadmap-chatbot-classificacao-plan.md` + `bdesk/docs/plans/roadmap-chatbot/`) is a versioned strategy plus a tracking folder with one-fact-one-place rules and a git-aware checker. v2 starts from that structure and keeps the best of v1 (testable acceptance criteria, DoD, honest MoSCoW, dependency DAG, phase entry/exit criteria, risk register, QA checklist, no fabricated metrics). Research backing: `docs/reports/2026-10-16-roadmap-best-practices.md`.

## Problems in v1

| # | Problem | Effect |
|---|---------|--------|
| 1 | One static file; no state, history or decisions after day one | The roadmap is stale after the first decision |
| 2 | No requirement IDs or traceability | "All requirements decomposed" cannot be checked |
| 3 | No source inventory; claims untraced | Fabricated or unsourced facts are invisible |
| 4 | Clarification is "ask if unclear", unbounded | Either no questions or an interrogation |
| 5 | Invents OKRs, durations and critical-path dates | Fabricated numbers, contradicts its own "never fabricate" rule |
| 6 | Fixed phases Foundation/Build/Optimize/Scale | Phases named by template, not by outcome |
| 7 | Hard-coded `docs/roadmaps/`, `claude-mem` dependency | Breaks where these do not exist |
| 8 | No automated check | QA checklist is self-graded |

## Goals

1. Clarify objectives with a bounded, prioritized question loop.
2. Inventory and read sources (parameters + discovered), with an ID per source and every claim traced to a source or marked as an assumption.
3. Extract every requirement with a stable ID and prove coverage: each requirement maps to ≥1 deliverable or is declared out of scope with a reason.
4. Organize deliverables as vertical slices (walking skeleton first), in outcome-named phases with entry/exit criteria, with a dependency DAG and critical path across tracks (engineering, internal decisions, client/external, publishing, measurement).
5. Keep the roadmap alive: state vs history separated, append-only decisions, versioned strategy revisions that absorb contradicting decisions.
6. A deterministic checker that both skills run before handing back.

## Non-goals

- Task-level breakdown. A deliverable stops at "gets its own spec and plan"; tasks belong to `superpowers:writing-plans`, execution to `plan-coordinator`.
- Executing deliverables or orchestrating agents (that is `plan-coordinator`).
- Compatibility with the existing BDesk chatbot roadmap (author's decision, 2026-10-17): the skills and checker serve new roadmaps only; the chatbot folder keeps its own format and `npm run docs:roadmap`. It is inspiration, not a fixture, so `formats.md` is free to be cleaner than the BDesk files. Removing the BDesk agent copy is a separate follow-up in the BDesk repo.
- Publishing an HTML/artifact page of the roadmap (the BDesk roadmap has one; not in v2).
- Dates and durations: the skill never produces them. Order comes from the DAG; dates exist only when the user supplies them.

## Anti-goals (failure even if it "works")

- Any metric, estimate, date or source the user or a source did not provide, presented as fact.
- A roadmap only the tool can read: everything stays human-readable Markdown.
- State that accumulates history (`state` file growing like a log).
- Over-decomposition: dozens of task-sized "deliverables".
- Interrogating the user: more than the question budget without their consent.

## Design

### Packaging

Both skills live in `plugins/productivity-tools/skills/`, English text, frontmatter `name` + `description` only (repo rule). Progressive disclosure like `plan-coordinator`: each `SKILL.md` < 500 lines holds the workflow; detail in `references/` (one level deep, TOC on files > 100 lines).

```
skills/roadmap-planner/
  SKILL.md                      workflow (phases below)
  references/clarify.md         ambiguity categories, scoring, question format, stop rule
  references/decompose.md       requirement extraction, vertical slicing, walking skeleton, phases, DAG, tracks, MoSCoW
  references/formats.md         templates: strategy doc, deliverable card, every tracking file, ID and status rules
skills/roadmap-tracker/
  SKILL.md                      cold start, event → files table, revision procedure
  references/events.md          per-event update recipes
  scripts/check-roadmap.mjs     checker (shared by both skills)
  scripts/check-roadmap.test.mjs
```

`formats.md` is the single contract for file formats; the tracker reads it from the planner skill (builder must confirm the relative path resolves from the plugin cache; if not, move it to a location both reach).

### Output in the target project

Default root `docs/plans/roadmap-<topic>/` (user can override). Generated documents are written in the project's language (from the user's messages / project CLAUDE.md; ask once if unclear). File names may be localized; a config maps roles to names.

| Role | Default file | Nature | Origin |
|---|---|---|---|
| Strategy | `../<date>-roadmap-<topic>.md` (never `*-plan.md`: `plan-coordinator` searches that pattern for implementation plans; changed during execution, 2026-10-17) | Versioned (v1.0, v1.1…), changelog on top; no state | chatbot |
| Config | `roadmap.config.json` | Paths/names, integration branch, status vocabulary, tracks, limits, language | new |
| README | `README.md` | Files, conventions, "when to update" table | chatbot |
| State | `state.md` | Overwritten snapshot: header, **Now** (≤5), deliverable panel, blockers `BLQ-n`, pending items with owner, in flight | chatbot |
| Decisions | `decisions.md` | Append-only, global `DEC-NNN`, never reused; chatbot columns (ID, date, deliverable, decision, discarded alternative, **contradicts**, origin, status) plus *revisit when*; "superseded by" | chatbot + MADR |
| Log | `log.md` | Append-only events, newest first, ≤300 chars, evidence = SHA or path, never "this commit" | chatbot |
| Critical path | `critical-path.md` | Mermaid graph of deliverables and gates; next milestone per track | chatbot |
| Measurements | `measurements.md` | Runs, costs, measurement milestones; recorded vs billed in separate columns | chatbot (optional file) |
| Sources | `sources.md` | `SRC-NN`: path/URL, what it is, date read, reliability note; conflicts list | new |
| Requirements | `requirements.md` | `REQ-NNN`: statement, type, source(s), deliverable(s), coverage status (`covered`, `out-of-scope: <reason>`, `needs-clarification`) | new |

The strategy doc keeps the chatbot sections (objective + acceptance + DoD, where we are, thesis, deliverables overview, deliverables, metrics & targets, flags, cross-cutting risks, decision summary pointing to `DEC`, external pending items, version history, sources) and adds: non-goals, assumptions (each with an owner and "re-validate when"), open questions, and a coverage summary.

**Deliverable card** (in the strategy doc): ID `E<n>`, title, why (`REQ` links), phase, track, priority (MoSCoW), size as a range with its basis or `not estimated`, depends on, pieces (vertical slices, each shippable alone), ≥2 Given-When-Then acceptance criteria in plain language, DoD, risks → mitigation. Specs/plans are not in the card; the state panel points to them.

**Status vocabulary** (closed, configurable): default `not-started`, `spec`, `plan`, `executing`, `on-branch`, `integrated`, `released`, `measured`. Multi-piece deliverables show per-piece status. (Updated during execution, 2026-10-18: two more statuses, blocked and discarded, set through `vocab.blockedStatus` / `vocab.discardedStatus`; the list is positional, so a localized roadmap keeps the canonical order.)

### roadmap-planner workflow

0. **Resume check, then mode.** If the target folder holds `roadmap.config.json`, stop and point to `roadmap-tracker` (update or revision); a folder without it asks before writing (updated during execution, 2026-10-18). Only then ask the mode question. Light mode (added during execution): at most 3 clarification questions in one round, minimal cards, no fresh-context reviewer, and the handoff says so.
1. **Intake.** Objective + sources from the arguments. Discover related sources (repo docs, specs, issues, git history; web only if the user allows). Reading many sources is delegated to subagents (cheap tier) that return per-source summaries with `SRC` IDs; the main conversation keeps judgment. Write `sources.md`, including a conflicts list (never silently resolved).
2. **Clarify.** Scan ambiguity categories, rank by impact × uncertainty, ask ≤5 questions per round, one at a time, each with a recommended answer. Rounds per theme are allowed; stop when the user says so or only low-impact items remain. User answers become `DEC` (choices) or assumptions (unverified facts).
3. **Requirements.** Extract `REQ-NNN` from sources and answers, each traced to `SRC`/`DEC`; unresolved ones marked `needs-clarification`.
4. **Decompose.** Walking skeleton first, then vertical slices; group into outcome-named phases with entry/exit criteria; dependencies as a DAG; tracks; critical path as an ordering (no dates unless supplied).
5. **Prioritize.** MoSCoW + DAG as the single default. WSJF only to order unconstrained items, and only with user-supplied inputs. No RICE.
6. **Write** strategy v1.0, config, README and the tracking files (state with an initial **Now**, empty log seeded with the creation event, decisions from step 2).
7. **Verify.** Run the checker until 0 errors; then a fresh-context reviewer subagent (strong tier) briefed to report only correctness and coverage gaps, not style. Fix, re-check.
8. **Hand off.** Summary, **Now**, and the next step: first deliverable → `superpowers:brainstorming` → `writing-plans` → `plan-coordinator`.

### roadmap-tracker workflow

1. **Cold start.** Read config, `state`, the newest log lines and pending `DEC`; never trust conversation memory over files. Apply the checker refresh and format-version rules (Checker § Keeping the vendored copy current, layers 1 and 3).
2. **Classify the event** and apply the update table (from the chatbot README): decision → `decisions` first, then users of it; piece/task closed → `log` + state panel; integration or branch deletion → state "in flight" + `log`; paid run → `measurements` + `log`; blocker/dependency change → `state` + `critical-path`; end of piece/phase → propose revision. Can read `plan-coordinator` progress files to detect closed steps instead of asking.
3. **Edit in the working tree, no commit**, so the update lands in the same commit as the event (author or orchestrator commits).
4. **Run the checker**; 0 errors before handing back.
5. **Revision** (end of piece/phase, or checker warns of contradicting `DEC`): propose strategy vN+1 (which `DEC` it absorbs, which sections change) and write it only after the user approves; then changelog entry, regenerate "where we are" from `state`/`critical-path`. Until approved, the contradiction warning stays and the tracker may end a run with it.

**Contradiction rule** (from the chatbot checker): a `DEC` contradicts the roadmap when its *contradicts* cell is filled (by whoever records the decision, naming the section/deliverable it overrides) and its status is in force; it is *absorbed* once the strategy text cites its ID.

### Checker (`check-roadmap.mjs`)

Node ≥ 18, zero dependencies (first script of its kind in the repo), `node:test` tests with fixture folders.

**Vendored into each roadmap.** The planner copies the script into the roadmap folder (`<root>/check-roadmap.mjs`), with a first-line header carrying the plugin version. The README gives the stable command `node <root>/check-roadmap.mjs`, which works in a terminal, a pre-commit hook or CI without the plugin installed. Both skills run the vendored copy. The skills do not install hooks or CI; the README documents the command and the user wires it if wanted. Rejected: running from the plugin cache (path changes on every version bump and does not exist in CI) and `npx` from git (network, slow, unpinned).

**Keeping the vendored copy current** (author's decision, 2026-10-17). Four layers, each closing a different gap; staleness is a visible state, never a silent failure and never a blocker of a delivery in progress:

1. **Safe refresh on tracker cold start.** If the vendored copy is older than the plugin's, the tracker runs both against the folder. New one passes → replace the copy and add a `log` line. New one fails → keep the old copy and add a pending item to `state` ("checker vX available, N errors to fix"), which stays until resolved.
2. **Self-reported staleness.** The vendored script looks for a newer copy of itself in the local plugin cache and, if found, prints a warning (never an error). Every local run (terminal, pre-commit) nags; in CI there is no cache and it stays quiet.
3. **Format version separate from plugin version.** `roadmap.config.json` carries `formatVersion`; the script header carries the plugin version and the `formatVersion` it understands. The checker errors on a folder whose `formatVersion` is newer than it understands. The tracker never writes files in a newer format than the vendored copy understands: it refreshes first (layer 1), and a `formatVersion` change ships with a migration step in `references/events.md`.
4. **Hook in `plan-coordinator`.** Execution runs through `plan-coordinator`, not the tracker, so it is the point that guarantees "during execution": when a plan links to a roadmap folder (one line in the plan header), at the end of each wave and at plan completion it invokes `roadmap-tracker`, which applies layers 1 and 3 and records the closed step/piece. Plans without the link behave as today.

Optional (builder's call): a hash of the script body in the header, so a hand-edited copy is reported instead of overwritten by a refresh. Exit 1 on errors; warnings print but pass. Pure check functions + a thin git adapter (pattern from `bdesk/portal/src/__docs__/roadmap-check.ts`). Outside a git repo, git checks are skipped with one warning.

- **Errors:** cited SHAs exist; `integrated` evidence is an ancestor of the configured integration branch; in-flight branches exist, deleted ones don't; statuses in vocabulary; **Now** ≤ limit; cell/line length limits; log sorted descending, no "this commit"; every cited `DEC`/`REQ`/`SRC`/`BLQ`/`E` exists and IDs are unique; superseded links resolve; dependency graph acyclic; every `REQ` covered or out of scope with reason; every deliverable cites ≥1 `REQ` and has ≥2 acceptance criteria.
- **Warnings:** an in-force `DEC` that contradicts the roadmap and is not cited by the strategy; `needs-clarification` remains; critical-path deliverable without a risk; count of explicit `ASSUMPTION`/`UNSOURCED` markers in the strategy (marker-based, no number detection: the guard against invented numbers is the planner's tagging rule plus the reviewer, not the checker).

Header text is localized, so the checker must not depend on header language (position- or config-mapped: builder's call).

### Validation of the skills

No eval infra exists in the repo; validation is behavioural, by subagents following the skills literally:

1. Planner on a small objective with 2 sources where one planted requirement conflicts between them → conflict listed, not resolved; 100% coverage; checker 0 errors.
2. Planner with an unsourced number in the objective → appears tagged `ASSUMPTION` in the strategy, never as a target (judged by reading the output, not by the checker).
3. Tracker on a fixture folder: a decision that contradicts the roadmap → `decisions` appended with *contradicts* filled, checker warns, revision proposed and not written until approved.
4. Checker unit tests: one fixture per error and warning, plus the `formatVersion` mismatch.
5. Refresh: fixture with an older vendored copy → (a) new passes → replaced and logged; (b) new fails → old kept, pending item in `state`.
6. `plan-coordinator` with a plan linked to a roadmap folder → tracker invoked at wave end; a plan without the link → no tracker call.

### Repo hygiene

`plan-coordinator` gets the roadmap hook (SKILL.md completion step, `references/delegation-protocol.md` wave end, `references/progress-template.md` roadmap link field). Bump `productivity-tools` to 1.3.0 (updated during execution, 2026-10-18; first planned as 1.2.0) in `plugin.json`, `marketplace.json` and the root README table; add `roadmap-tracker` to the plugin README and the CLAUDE.md tables; list this design (and the research report) under Design Docs.

## Calls made by the designer (not discussed)

- Skills in English; outputs in the project's language.
- Requirements/traceability in Markdown tables checked by script, not JSON; JSON only for config.
- Checker is Node `.mjs`, vendored into each roadmap folder with a version header (author asked for the best recommendation, 2026-10-17); tracker offers refresh when the plugin's is newer.
- Question budget ≤5 per round, multiple rounds per theme.
- Default output root `docs/plans/roadmap-<topic>/`; default English file names, localizable via config.
- Status vocabulary generic by default, BDesk's `published` → `released`.
- Tracker never commits.
- Tracker proposes a strategy revision and writes it only on approval.
- Contradiction = filled *contradicts* cell + in force + not cited by the strategy (chatbot rule).
- Unsourced-claim guard is marker-based in the checker; detection of uncited numbers is not attempted.
- `plan-coordinator` change limited to the roadmap hook (opt-in by a link in the plan); routing and waves untouched.

## Left to the builder

- Exact ambiguity categories and scoring wording; reference file split if one grows past ~300 lines.
- How the tracker reaches `formats.md` and the plugin's checker copy (for the version comparison) from the plugin cache.
- Position- vs config-mapped table parsing.
- Wording of the skill descriptions so they trigger distinctly from `report-analyzer`, `superpowers:writing-plans` and `plan-coordinator`.
