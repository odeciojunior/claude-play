# Decompose: requirements to deliverables

How `roadmap-planner` Steps 3 to 5 turn sources and answers into requirements, deliverables, phases, tracks and an order. File formats (card attributes, table columns) are in `formats.md`; this file covers the judgment.

## Contents

1. Requirement extraction
2. From requirements to deliverables
3. Walking skeleton first
4. Vertical slicing patterns
5. Phases
6. Tracks
7. Dependencies, DAG and critical path
8. Prioritization
9. Size
10. Acceptance criteria and definition of done
11. Coverage pass

## 1. Requirement extraction

Requirement types (the Type column; translate the words with the documents):

| Type | What it states | Example |
|------|----------------|---------|
| `functional` | A capability a user or system gets | "A librarian can renew a loan for a reader" |
| `non-functional` | A quality: performance, security, privacy, accessibility | "Search answers within the page load" |
| `constraint` | A fixed limit the user or a source imposes | "Runs on the existing catalogue server" |
| `external` | Something needed from another team, client or vendor | "The catalogue vendor opens its API" |
| `data` | Data that must exist, move or be kept | "Loan history is kept per reader" |
| `measurement` | Something to measure, including baselines | "Measure how long a renewal takes today" |

Rules:

- **One testable statement per `REQ`.** Split compound statements ("borrow and renew") into separate rows.
- **Every source item is consumed.** Each claim in a source summary becomes a `REQ`, merges into an existing one (add the `SRC` to Sources), or becomes a `REQ` with coverage `out-of-scope: <reason>`. Nothing is dropped silently.
- **Trace.** Sources cites `SRC` and/or `DEC` IDs.
- **No sources.** When the user gives only an objective, register the objective (and any brief or conversation the user supplied) as `SRC-01` with What it is "user brief", so requirements cite it. Never create a `DEC` just to carry a source; a `DEC` records a choice.
- **No speculation.** No "might need" requirements nobody stated.
- **Duplicates** merge into one row listing every source.
- **Conflicts.** A requirement both sides of an unsettled conflict touch stays `needs-clarification` until a `DEC` settles it; then it cites that `DEC`.
- **Numbers.** A requirement keeps only numbers the user or a source supplied; an unsourced one is tagged `ASSUMPTION` and gets a `measurement` requirement for its baseline.
- IDs `REQ-001`, `REQ-002`, … in extraction order, never reused.

## 2. From requirements to deliverables

A deliverable (`E<n>`) is an outcome a stakeholder can verify, and it **ends at "gets its own spec and plan"**: big enough to need a spec, small enough that one spec and one plan cover it.

| Smell | Fix |
|-------|-----|
| A deliverable is one task or one file | Merge it into the deliverable it serves, or make it a piece |
| A deliverable needs several unrelated specs | Split it along a slicing pattern (§4) |
| Dozens of deliverables | Over-decomposition: merge by outcome; the detail belongs in plans |
| A deliverable with no `REQ` | Orphan work: find its requirement or drop it |

Each deliverable lists **pieces**: vertical slices inside it, each shippable alone, in the order they will ship. Pieces are not tasks; tasks are for `superpowers:writing-plans`.

## 3. Walking skeleton first

`E1` is the walking skeleton: the thinnest end-to-end path through every main component, built, integrated and verifiable, meant to grow (not a throwaway spike). It is on the critical path (`critical=true`). Later deliverables widen it with variations. When the objective has no software path, `E1` is the thinnest end-to-end version of the outcome (for example one process run once with real participants).

## 4. Vertical slicing patterns

Split a deliverable or a piece across layers, never by layer. Try these in order and pick the split that lets low-value work be dropped and yields slices of similar size:

1. **Workflow steps**: the first and last step first, middle steps later.
2. **Business-rule variations**: the main rule first, exceptions later.
3. **Data variations**: one data type or source first.
4. **Data-entry methods**: the simplest input first.
5. **Operations**: create and read first; update and delete later.
6. **Simple / complex**: the simple case first, the complex cases as later slices.
7. **Defer performance**: make it work, then make it fast.
8. **Major effort**: the first slice carries the shared cost; later ones are cheaper.
9. **Spike**: last resort, when nothing can be sliced until an unknown is answered; the spike is a piece whose result is a decision.

A layer-only deliverable ("database", "API", "UI") is allowed only as enabling work, with the justification in its card's "Why".

## 5. Phases

- Name each phase by the **outcome** it delivers ("a reader can borrow a book end to end"), never by a template stage ("Foundation", "Build", "Optimize", "Scale").
- Each phase states **entry criteria** (what must be true to start) and **exit criteria** (what must be true to finish, observable).
- The strategy's **Phases** section (after the Deliverables overview, `formats.md` §5) lists every phase in order: name by outcome, entry criteria, exit criteria, deliverables (`E<n>`).
- The card's `phase` attribute is a short slug of the phase name.
- Phases follow the DAG: no deliverable sits in an earlier phase than one it depends on.

## 6. Tracks

Every card has one `track` from the config's `tracks` list. Defaults:

| Track | Holds |
|-------|-------|
| `engineering` | Building and integrating |
| `decisions` | Internal decisions that gate work (a choice the team must make) |
| `external` | What clients, vendors or other teams must deliver or approve |
| `release` | Publishing, rollout, announcement |
| `measurement` | Baselines, measurement runs, evaluations |

Non-engineering gates are real deliverables on their tracks when they need their own work and acceptance; otherwise they are dependencies or blockers. Add or rename tracks in the config when the project needs it.

## 7. Dependencies, DAG and critical path

- `depends` lists the deliverables that must be done first; the graph must be acyclic (the checker reports `dependency-cycle`).
- A dependency exists when a deliverable needs another's output, decision or approval; not merely because both touch the same area.
- The **critical path** is the longest chain of dependencies to the objective, counted in deliverables, not time. Mark its cards `critical=true`; each needs at least one risk with a mitigation.
- `critical-path.md` draws the DAG (Mermaid) with gates from other tracks and names the next gate per track.
- Order only. No dates unless the user supplied them; a supplied date is cited with its `DEC` or `SRC`.

## 8. Prioritization

- **MoSCoW** on every card: `Must`, `Should`, `Could`, `Won't` (for this version). `Won't` items stay visible as cards or as out-of-scope requirements, so the decision is recorded.
- **Challenge** the user when more than half of the deliverables are `Must`: ask which ones the objective can be met without. Record the answer as a `DEC`.
- **DAG first**: priority never breaks a dependency; a `Must` that depends on a `Should` makes that `Should` a `Must` or the dependency wrong.
- **WSJF** only to order deliverables the DAG leaves unconstrained, and only with value, time criticality, risk reduction and size that the user supplies. Never fill WSJF inputs yourself.
- **No RICE**: it needs reach and impact data a new roadmap rarely has.

## 9. Size

The card's `size` is either:

- a **range with its basis**, for example `"2-3 pieces, like E1 (user)"`, where the basis is a past deliverable, a spike or the user's own estimate; or
- `"not estimated"` (a legitimate value, and the default).

Never a point estimate, never a duration, never a number without a basis.

## 10. Acceptance criteria and definition of done

- At least two criteria per card, Given-When-Then, in plain language a stakeholder can check without reading code: "Given <context>, when <action>, then <observable result>".
- Criteria describe behaviour, not implementation. No unsourced numbers in them (Rule 2 of `SKILL.md`).
- The definition of done is one verifiable condition beyond acceptance (for example "acceptance passes on the integration branch").
- Each risk is "risk -> mitigation"; the mitigation is an action, not a hope.

## 11. Coverage pass

Before writing the files:

1. **Forward**: every `REQ` lists ≥1 deliverable with coverage `covered`, or is `out-of-scope: <reason>`, or `needs-clarification` with an open question. A `needs-clarification` requirement lists in Deliverables the deliverable that will resolve or satisfy it (for example a gate deliverable on the `decisions` or `external` track); this is allowed.
2. **Backward**: every card's `reqs` lists ≥1 `REQ`.
3. **Symmetry**: if `REQ-004` lists `E2`, the `E2` card lists `REQ-004`, and the other way round.
4. **Sources consumed**: every `SRC` is cited by at least one `REQ` or `DEC`, or the strategy says why it was read but not used.

The checker verifies 1 to 3 mechanically; 4 and the quality of each criterion are for you and the reviewer.
