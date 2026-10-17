# Roadmap Planner v2: Best-Practice Research

**Evidence base for designing a Claude Code skill that clarifies objectives, consumes sources, decomposes all requirements, plans incremental deliverables, and keeps the roadmap alive**

**Version 1.0 — October 2026 (last updated 2026-10-16)**

> **What's New**: Maps current roadmap, requirements, decomposition and AI spec-driven practice onto the design of "roadmap-planner v2". Each finding is tagged against what the user's newer hand-built roadmap (strategy doc + tracking folder + checker) already does.

> **Note on conventions**
> - **[SRC-P]** = primary source fetched and read in this session. **[SRC-S]** = secondary or vendor source seen only through search summaries; treat as weaker.
> - **[OPINION]** = my synthesis or recommendation, not stated by a source.
> - Foundational classics (Wake 2003, Nygard 2011, Cockburn, Patton) are cited despite age because they are the originating sources; the project's report standard prefers 2025-2026 sources, so recent (2025-2026) primary sources are used for the AI and tooling sections (Anthropic, spec-kit, Kiro, Claude Code docs).
> - Several search-tool summaries could not be verified against the originals (listed in Knowledge Gaps).

---

## Executive Summary

The user's newer roadmap is already well aligned with the best-supported practices: separation of state (overwritten snapshot) from history (append-only logs), global immutable decision IDs with superseded-by links, a closed status vocabulary, evidence-linked event log, and an automated checker. The research endorses these and adds little to them beyond hardening.

The gaps are concentrated in the **front half** of the process (before the tracking folder exists) and in **coverage/traceability**: (a) there is no structured elicitation protocol with a stop rule; (b) there is no explicit non-goals / assumptions / open-questions artifact; (c) no requirement-to-deliverable-to-acceptance traceability matrix with a mechanical "all requirements decomposed" check (both directions: uncovered requirements and orphan deliverables); (d) no source inventory with claim-to-source mapping and conflict handling; (e) slicing guidance (walking skeleton first, vertical not layered) is implicit; (f) estimates should be ranges plus confidence, not bare T-shirt sizes. On the AI side, the most transferable lessons are: keep SKILL.md under 500 lines with one-level-deep references, put deterministic checks in scripts, make the agent mark ambiguity instead of guessing, run a read-only analysis pass for coverage, and persist state in files that a fresh session can read (JSON feature list with pass/fail plus a progress log).

Confidence: **High** for structure/state/decision practices and for skill-authoring constraints (primary sources); **Medium** for prioritization-method selection and estimation guidance (mix of primary and secondary); **Low** for quantitative claims about LLM planning failure (few directly relevant studies found).

### Research Context

| Parameter | Specification |
|-----------|---------------|
| Topic | Best practices for a roadmap-planning skill (v2) |
| Scope | Roadmap practice, elicitation, decomposition, source discipline, AI/spec-driven prior art. Not covered: the user's existing artifacts (taken as given) |
| Date | 2026-10-16 |
| Sources consulted | ~45 (about 17 primary pages read in full or in part; the rest search-summary level) |
| Confidence | Medium-High overall |

### Key Findings — Overview

| # | Finding | Confidence | Impact |
|---|---------|------------|--------|
| 1 | State (current snapshot) and history (append-only) should be separate; small modular records stay current, large docs rot | High | Validates the `estado.md` / `registro.md` / `decisoes.md` split |
| 2 | Decisions: sequential never-reused IDs, never edit accepted, supersede with link; MADR adds drivers/options/confirmation/revisit | High | Validates DEC-NNN; ADD "options considered" and "revisit trigger" fields |
| 3 | Outcome-oriented, confidence-based horizons (Now/Next/Later) beat dated feature lists; dates beyond a short horizon are weak | Medium | Roadmap items need outcome + confidence, dates optional |
| 4 | Non-goals must be things that could reasonably be goals; list them explicitly | High | ADD a non-goals section and anti-goals check |
| 5 | Clarification should be bounded, ranked by impact x uncertainty, one question at a time, with a recommended default, and log answers | High (spec-kit primary) | ADD a bounded elicitation protocol with a stop rule |
| 6 | Slice vertically (end-to-end thin), start with a walking skeleton; layer splits fail INVEST | High | ADD slicing rules to decomposition |
| 7 | Coverage needs two-way traceability: requirement without deliverable AND deliverable without requirement | Medium (vendor/QA sources) but mirrors spec-kit `analyze` (primary) | ADD a traceability matrix and a coverage checker |
| 8 | Estimates early in a project are inherently wide (0.25x-4x); give ranges, not points; LLM estimates are over-confident | Medium | CHANGE T-shirt-only sizing to range plus confidence, or drop estimates |
| 9 | Long-running agents lose state, one-shot too much, and declare victory early; fix = initializer + incremental progress + structured pass/fail list | High (Anthropic primary) | Design state files for cold-start sessions |
| 10 | Skill authoring: SKILL.md < 500 lines, references one level deep, scripts for deterministic validation, evals before documentation | High (Anthropic primary) | Shapes v2 file layout |

---

## 1. Roadmap Practice (Complete)

### 1.1. Outcome-based vs feature roadmaps, Now/Next/Later

- Search-level summaries agree that NNL sorts work by **certainty, not dates**, and that NNL by itself does not state outcomes; teams usually pair each item with a measurable outcome ([ProdPad glossary, SRC-S](https://www.prodpad.com/glossary/now-next-later-roadmap/); [LogRocket, SRC-S](https://blog.logrocket.com/product-management/feature-driven-to-outcome-driven-roadmap/); [Product School, SRC-S](https://productschool.com/blog/product-strategy/outcome-based-roadmap)). Janna Bastow is credited as inventor; the rationale reported is that fixed timelines create false promises ([Product Hunt AMA, SRC-S](https://www.producthunt.com/p/general/ama-today-i-invented-the-now-next-later-roadmap-co-founded-mind-the-product-prodpad), [echai summary, SRC-S](https://echai.ventures/startingup/from/prodpad-com)). I could not retrieve her original article.
- Roman Pichler's Goal-Oriented (GO) roadmap: goals, a time frame, and metrics per goal, linked to a backlog of opportunities. Only vendor template pages were retrievable ([airfocus, SRC-S](https://airfocus.com/templates/GO-product-roadmap-roman-pichler/)); his own page returned 404.
- Regulated or contractually bound contexts: sources suggest a hybrid (outcome goals plus timeline predictability). [OPINION] The BDesk roadmap has external client milestones, so keep dates only where an external commitment exists and label them as such.

| Aspect | Feature roadmap | Outcome / goal-oriented | Now-Next-Later |
|--------|-----------------|-------------------------|----------------|
| Unit | Feature + date | Goal + metric | Item grouped by confidence |
| Commitment signal | Date | Metric target | Horizon |
| Weak point | Dates become promises | Needs measurable outcome | Says nothing on impact by itself |
| Fit for v2 | Only for externally-dated items | Objective/acceptance criterion per deliverable | Use as the "Now" panel (user already caps it at 5) |

**Recommendation**: Keep outcome per deliverable and a capped "Now" list; use horizons (confidence) for ordering; allow explicit dates only for external commitments.

### 1.2. OKRs in roadmaps and their failure mode

- Recurrent critique: key results written as outputs ("launch X") leave the objective untouched when X ships ([Gothelf, SRC-S](https://jeffgothelf.com/blog/okr-leadership-okrs-are-not-task-lists/); [Hackernoon on Wodtke, SRC-S](https://hackernoon.com/the-case-against-treating-outcomes-as-the-only-good-key-results)). Some sources defend output milestones as legitimate; a common compromise is KRs = outcomes, initiatives = outputs ([Mooncamp, SRC-S](https://mooncamp.com/blog/output-vs-outcome)).
- [OPINION] v1's "OKR goal extraction" risks inventing KRs. The user's "objective + acceptance criterion + definition of done" is closer to the safer compromise. Only emit a metric target if a source gives a baseline or the user supplies one.

### 1.3. Opportunity solution trees

- Teresa Torres' OST: outcome -> opportunities -> solutions -> assumption tests; intended to be continuously updated, not a one-time artifact ([ProductPlan glossary, SRC-S](https://productplan.com/glossary/opportunity-solution-tree); [Askable, SRC-S](https://askable.com/blog/opportunity-solution-trees)). Primary (book/ProductTalk) not retrieved.
- Relevance: valuable when the problem space is discovery-heavy. [OPINION] For a delivery roadmap with known requirements, a full OST is overhead; borrow only "outcome -> opportunity -> solution" as the tracing chain and "assumption tests" as a pointer to open questions.

### 1.4. Living roadmaps, state vs history, decision records

- Nygard's ADR rules ([Cognitect, SRC-P](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)): records numbered "sequentially and monotonically", numbers "will not be reused"; reversed decisions are kept and "mark[ed] as superseded"; "Large documents are never kept up to date."
- MADR 4.0.0 (2024-09-17) ([MADR, SRC-P](https://adr.github.io/madr/)): optional YAML front matter (status, date, decision-makers, consulted, informed); required sections Context/Problem, Considered Options, Decision Outcome; optional Decision Drivers, Confirmation (how compliance will be checked), Pros/Cons, More Information (revisit criteria). Status hints: proposed, rejected, accepted, deprecated, "superseded by ADR-NNNN". A minimal variant exists. The MADR page itself gives no immutability rule; that comes from Nygard and community practice ([secondary, SRC-S](https://ozimmer.ch/practices/2022/11/22/MADRTemplatePrimer.html)).
- RAID logs (Risks, Assumptions, Issues, Dependencies): assumptions recorded at the start and re-validated; issues get owner plus deadline ([Creately](https://creately.com/guides/raid-log-guide/), [Digital PM](https://thedigitalprojectmanager.com/project-management/raid-log/), SRC-S). Letters vary by team (Actions/Decisions).

| User's artifact | Best-practice analogue | Verdict |
|-----------------|------------------------|---------|
| `estado.md` overwritten snapshot, Now max 5 | Short, current "state" doc; modular records | Endorsed |
| `registro.md` append-only, newest first, SHA/path evidence | Event log; git/progress-log as state | Endorsed (Anthropic harness uses a progress log + git commits) |
| `decisoes.md` DEC-NNN append-only, superseded-by | Nygard ADR / MADR | Endorsed; add options-considered and revisit trigger |
| Cross-cutting risks table + BLQ-n blockers | RAID (Risks, Issues/blockers, Dependencies) | Partly; **Assumptions** missing as a first-class list |
| Checker warns when newer decisions contradict roadmap version | No direct analogue found | Novel; keep ([OPINION]) |

**Recommendation**: Keep the split; add an explicit Assumptions list (with validation date/owner) and make decisions carry "options considered" and "revisit when" fields.

---

## 2. Requirements Elicitation and Clarification (Complete)

### 2.1. Goals, non-goals, anti-goals

- Google design-doc guidance ([Malte Ubl, SRC-P](https://www.industrialempathy.com/posts/design-docs-at-google/)): non-goals are things that "could reasonably be goals, but are explicitly chosen not to be goals"; they are not negated goals ("system should not crash"). A doc is worth writing only when the problem or solution is ambiguous; 10-20 pages is the upper sweet spot for big projects, 1-3 pages for mini-docs.
- "Anti-goals" as a separate term: no authoritative source found. [OPINION] Treat anti-goals as "outcomes we must not cause" (guardrail metrics) and keep them distinct from non-goals (scope exclusions).

### 2.2. JTBD and success metrics

- Ulwick's outcome-driven innovation expresses desired outcomes as direction + metric + object + context and scores importance vs satisfaction ([Koji, SRC-S](https://www.koji.so/docs/outcome-driven-innovation-odi)); Christensen's contribution is the causal "why customers hire" and forces of progress (push/pull) ([dscout, SRC-S](https://dscout.com/people-nerds/inside-jobs-tony-ulwick)). Vendor pages carry promotional statistics (e.g. success rates); I did not use them.
- [OPINION] For an internal/B2B roadmap with named stakeholders, a lightweight job statement per stakeholder ("When X, I want Y, so I can Z") plus one measurable success signal is enough; full ODI surveys are out of proportion.

### 2.3. How to know clarification is enough

- spec-kit's `clarify` template ([SRC-P](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md)) is the best concrete stop rule found:
  - Scan 10 categories (scope, data, UX flow, non-functional, integrations, edge cases/failure, constraints/tradeoffs, terminology, completion signals, placeholders) and mark each Clear / Partial / Missing.
  - Rank by (Impact x Uncertainty); ask **at most 5** questions, **exactly one at a time**, each with a recommended/suggested answer; log "Q -> A" in the spec.
  - Stop when critical ambiguities are resolved, the user says done, or 5 questions are asked; report categories as Resolved / Deferred / Clear / Outstanding.
- spec-kit's spec template says "Don't guess: ... mark it" with `[NEEDS CLARIFICATION: ...]` and bans speculative "might need" features ([spec-driven.md, SRC-P](https://github.com/github/spec-kit/blob/main/spec-driven.md)).
- Claude Code's own guidance: have Claude interview you with `AskUserQuestion`, "dig into the hard parts", then write the spec to a file and execute in a **fresh session**; good specs "state what is out of scope" and end with an end-to-end verification ([Claude Code best practices, SRC-P](https://code.claude.com/docs/en/best-practices)).

| Stop criterion | Source | Notes |
|----------------|--------|-------|
| No category left "Missing" on high-impact areas | spec-kit clarify | Deferred allowed if low impact |
| Question budget reached (5 per round) | spec-kit clarify | [OPINION] roadmaps are broader than a feature; allow a second round only if user asks |
| User signals done | spec-kit clarify | |
| Objective has measurable acceptance criterion and out-of-scope list | Claude Code best practices | |

**Recommendation**: Add a bounded elicitation phase with the 10-category scan adapted for roadmaps (see section 7), a question budget, recommended defaults, and an "Open questions / Deferred" list that survives into the roadmap.

---

## 3. Decomposition into Incremental Deliverables (Complete)

### 3.1. Story mapping, walking skeleton, thin vertical slices

- Patton: a flat backlog is "a bag of context-free mulch" and makes completeness hard to judge; a story map keeps the backbone (activities) un-prioritized and prioritizes "ribs" beneath; the top row forms a walking skeleton; releases are horizontal lanes ([Patton, SRC-P](https://www.jpattonassociates.com/the-new-backlog/)).
- Walking skeleton (Cockburn, Crystal Clear): a tiny end-to-end implementation linking the main architectural components; unlike a spike it is meant to evolve ([secondary roundup, SRC-S](https://oreilly.com/library/view/97-things-every/9780596800611/ch60.html)). Cockburn's own page not retrieved.
- Splitting (Lawrence and Green, Humanizing Work) ([SRC-P](https://www.humanizingwork.com/the-humanizing-work-guide-to-splitting-user-stories/)): workflow steps, CRUD operations, business-rule variations, data variations, data-entry methods, major effort, simple/complex, defer performance, spike (last resort). Stories "cut across architectural layers"; a layer split (UI story, DB story) passes "small" but fails "independent" and "valuable". Pick the split that lets you drop low-value work and yields roughly equal sizes.
- INVEST (Wake, 2003): Independent, Negotiable, Valuable, Estimable, Small, Testable ([summary, SRC-S](https://concepts.dsebastien.net/concept/invest-criteria/)). One source claims S now means "Scalable"; unverified.

**Recommendation**: Deliverable E0 should be a walking skeleton (thinnest end-to-end path that is built, deployed, and verifiable); later deliverables add variations. Reject deliverables that are pure layers unless explicitly marked as enabling work with justification.

### 3.2. Traceability and "all requirements decomposed"

- Two-way traceability: forward (requirement -> test/deliverable) finds uncovered requirements; backward finds orphaned work ([QA/vendor guides, SRC-S](https://www.zetcode.com/terms-testing/traceability-matrix/)). Coverage thresholds in those sources (MUST 100%, SHOULD > 80%) are practitioner heuristics, not standards. A mapped test does not prove adequacy.
- spec-kit `analyze` is the closest AI prior art ([SRC-P](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/analyze.md)): strictly read-only; keys requirements by stable IDs (FR-###, SC-###); detection passes for duplication, ambiguity, underspecification, constitution conflict, **coverage gaps (requirements with no tasks, tasks with no requirement)** and inconsistency; severity CRITICAL/HIGH/MEDIUM/LOW; coverage percentage metric; findings capped at 50 rows.
- Kiro: changing requirements after design triggers updating design and tasks ([Kiro docs, SRC-S via search](https://kiro.dev/docs/specs/concepts); the fetched Kiro page confirms the three files and "waves" of independent tasks but not EARS: [SRC-P](https://kiro.dev/docs/specs/)). EARS usage in Kiro comes only from third-party guides.

| Check | Mechanical? | Source |
|-------|-------------|--------|
| Every requirement ID appears in at least one deliverable | Yes (script) | RTM / spec-kit analyze |
| Every deliverable cites at least one requirement | Yes | backward trace / orphan tasks |
| Every deliverable has acceptance criterion that is testable | Partly (presence by script, quality by reviewer) | INVEST "T"; spec-kit ambiguity pass |
| Duplicate/overlapping requirements | LLM pass | spec-kit analyze |
| Source documents fully "consumed" (each source section maps to a requirement or is declared out of scope) | Yes, if the inventory lists sections | [OPINION] extension of RTM |

**Recommendation**: Give every requirement a stable ID (R-nnn); keep a `rastreabilidade` table; run a read-only coverage pass (script for presence, LLM for duplication/ambiguity) before declaring decomposition complete. Include a "declared out of scope / deferred" status so coverage can reach 100% honestly.

### 3.3. Dependencies and critical path

- spec-kit marks independent tasks `[P]` and Kiro runs independent tasks in "waves"; both express a DAG implicitly ([spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md); [Kiro](https://kiro.dev/docs/specs/), SRC-P). No authoritative source on critical-path method was fetched; CPM is textbook. The user's `caminho-critico.md` per-track "next milestone" is a pragmatic improvement because it adds non-engineering tracks (decisions, client, publishing, measurement) [OPINION].
- [OPINION] Cycle detection and "no deliverable with unmet prerequisite marked executing" are cheap script checks.

### 3.4. Prioritization: MoSCoW vs RICE vs WSJF

| Method | What it needs | Strength | Limitation | When it fits |
|--------|---------------|----------|------------|--------------|
| MoSCoW | Agreement only | Fast scope negotiation; DSDM recommends Must <= ~60% of effort, ~20% Should, ~20% Could as contingency ([Agile Business Consortium via search, SRC-S](https://www.agilebusiness.org/?p=1907)) | Qualitative; no ordering within a class; effort rule needs estimates | Fixed scope/time boundary, stakeholder negotiation |
| RICE | Reach, impact (0.25-3), confidence (50-100%), effort (person-months) | Comparable scores; forces explicit confidence ([Intercom, SRC-P](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/)) | Author says it is "not a hard and fast rule"; dependencies/table-stakes can override; reach needs real data | Many independent candidate features with usage data |
| WSJF | Cost of delay (user/business value, time criticality, risk reduction/opportunity enablement) / job size | Sequencing by economics; ignores sunk cost ([SAFe, SRC-P partial](https://framework.scaledagile.com/wsjf/)) | Relative scores are subjective; full SAFe page gated | Sequencing deliverables with deadlines and enabling work |

**Recommendation** [OPINION]: For a roadmap of dependent deliverables with fixed external gates, use MoSCoW for scope (with explicit Won't-this-version) and WSJF-style cost-of-delay reasoning only to order deliverables that are not constrained by the DAG. Skip RICE unless real reach data exists (v1 "never fabricate metrics" argues against it).

### 3.5. Estimation

- McConnell's cone of uncertainty: early estimates range about 0.25x-4x of actual; the cone narrows through decisions, not time; point estimates anchor people ([summaries, SRC-S](https://concepts.dsebastien.net/concept/cone-of-uncertainty/); [Coding Horror, SRC-S](https://blog.codinghorror.com/the-mysterious-cone-of-uncertainty)). Critics note it is best-case.
- LLM-specific: models show planning-fallacy-type insufficient updating ([cognitive-bias evaluation, SRC-S](https://arxiv.org/pdf/2410.15413)); a 2025 preprint reports severe under-coverage of model-generated intervals ([as summarised by search; verify before citing](https://arxiv.org/pdf/2605.07806)); a 2026 preprint finds models lack grounding in their own inference time ([search summary](https://arxiv.org/pdf/2604.01896)). I did not find a study of agent software-task estimates against actuals.
- T-shirt sizing: no source retrieved on its limits.

**Recommendation** [OPINION, grounded in the above]: Do not let the skill emit durations or effort numbers on its own. Use relative size (S/M/L) only with a rationale, or a range with a stated confidence and basis (past deliverable, spike). Mark "not estimated" as a legitimate value. Make the user supply calendar dates.

### 3.6. Definition of Ready vs Done

- Definition of Done: inside the Scrum Guide. Definition of Ready: not in the Scrum Guide and criticised as a stage gate that turns the process sequential (Cohn quoted by [Velocity Partners, SRC-S](https://velocitypartners.net/blog/2017/04/18/definition-ready-anti-pattern/); Scrum.org material via search). Counterpoint: lightweight DoR helps refinement ([Utrecht thesis, SRC-S](https://studenttheses.uu.nl/handle/20.500.12932/46489)).
- **Recommendation** [OPINION]: Keep DoD per deliverable (user already has "objective + acceptance + DoD"). Replace a rigid DoR with a minimal "ready to plan" check: has requirement IDs, acceptance criterion, known prerequisites, open questions listed. It is a checklist, not a gate that blocks discovery.

---

## 4. Source Research Discipline (Partial)

- Evidence for fabricated-citation risk in LLM output: GhostCite reports models hallucinate citations at 14-95% when asked to generate them and that when prompted for references models synthesize rather than look up ([GhostCite, SRC-S](https://arxiv.org/html/2602.06718)); HALLMARK states claim-level verification is out of scope for existing citation verifiers ([SRC-S](https://arxiv.org/pdf/2607.18360)). So the gap between "citation exists" and "claim supported" remains manual.
- Anthropic's skill guide models a citation-checking workflow without code: read all sources, cross-reference claims, note "which source supports each point", record conflicting viewpoints, verify citations (research synthesis checklist) ([Anthropic, SRC-P](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)).
- I found no authoritative source on evidence grading or conflict-resolution rules for roadmap inputs.

**Recommended design** [OPINION, consistent with v1's "never fabricate metrics"]:

| Element | Rule |
|---------|------|
| Source inventory | One row per source: ID (S-nn), type (user-supplied parameter, repo file, web, interview), date, authority, how it was read (full/partial), sections consumed |
| Claim traceability | Any number, date, or constraint in the roadmap carries an S-nn (and section/line) or the tag `UNSOURCED` / `ASSUMPTION` |
| Conflicts | Record both values with sources in a conflicts list; precedence default: user's explicit statement of today > newer dated primary source > older; unresolved = open question, not silently picked |
| Metrics | Baseline and target must be sourced or supplied by user; otherwise write "baseline unknown: measure first" as a deliverable |
| Checkable | A script verifies every S-nn cited exists in the inventory and every inventory row is cited at least once |

---

## 5. AI and Agent Prior Art (Complete for tooling; Partial for failure-mode research)

### 5.1. Spec-driven tools compared

| Tool | Goal -> requirements -> tasks structure | Clarification | Coverage / consistency check | State tracking | Source |
|------|------------------------------------------|---------------|------------------------------|----------------|--------|
| GitHub spec-kit | constitution (once) -> specify -> plan -> tasks -> implement -> converge; spec, plan, research, data-model, contracts, tasks files per feature | `clarify`: <= 5 questions, one at a time | `analyze`: read-only, ID-based, coverage % | tasks with IDs T001, `[P]` markers | [repo](https://github.com/github/spec-kit), [spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md), SRC-P |
| Kiro | requirements.md -> design.md -> tasks.md (three phases) | Via chat; Review comments on passages | Not documented on fetched page | Live task status; waves | [Kiro docs](https://kiro.dev/docs/specs/), SRC-P |
| BMAD Method | Clarify -> Plan -> Build/verify -> Learn loop; "process sizes itself to the work"; briefs, specs, architecture as durable context | Clarify phase | Not documented on fetched page | Decisions carry forward as durable context | [repo](https://github.com/bmad-code-org/BMAD-METHOD), SRC-P (README only) |
| Taskmaster AI | PRD -> `parse-prd` -> tasks; `expand` to subtasks; complexity analysis tools; tags | None documented | None documented | Task statuses | [repo](https://github.com/eyaltoledano/claude-task-master), SRC-P (README only); "task quality depends on PRD detail"; all 36 MCP tools load ~21k tokens by default |

Observations [OPINION]: (1) These tools target feature specs and code tasks, not multi-quarter roadmaps with decision logs and external gates; none showed a decisions log, measurement milestones, or a state/history split on the pages read. The user's tracking folder is ahead of them there. (2) All four separate "what/why" from "how", and the strongest ones (spec-kit) add mechanical ambiguity and coverage gates. (3) Taskmaster's one-shot PRD-to-tasks plus automatic expansion is the pattern most exposed to over-decomposition and invented granularity; BMAD's "size the process to the work" is the better guard.

### 5.2. Constitution / principles

spec-kit's constitution (e.g. Simplicity: max 3 projects, Anti-Abstraction, Integration-First) is enforced by "Phase -1 gates" with justification in a "Complexity Tracking" section ([spec-driven.md, SRC-P](https://github.com/github/spec-kit/blob/main/spec-driven.md)); analyze treats constitution conflicts as CRITICAL. [OPINION] The BDesk equivalent already exists: CLAUDE.md plus the one-fact-one-place rules; the skill should read them as constraints instead of inventing its own.

### 5.3. Skill authoring constraints (Anthropic)

From [Skill authoring best practices, SRC-P](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):

| Guidance | Implication for roadmap-planner v2 |
|----------|-----------------------------------|
| SKILL.md body under 500 lines; split into files | SKILL.md = workflow + phase gates; templates and checklists in references |
| References **one level deep** from SKILL.md (nested links get partially read with `head`) | No chains: SKILL.md -> elicitation.md, decomposition.md, tracking.md, templates/ |
| Reference files > 100 lines get a table of contents | Add TOC to each reference |
| Name max 64 chars lowercase-hyphen; description max 1,024 chars, third person, what + when | Description must cover all trigger phrases (create/revise/track roadmap) |
| Degrees of freedom: low freedom for fragile sequences, scripts for deterministic checks | State-file edits and checker run via scripts; prose for judgment (elicitation, slicing) |
| "Plan-validate-execute": intermediate plan file validated by script before applying | Roadmap draft -> checker -> publish |
| Workflows with copyable checklists; feedback loops (validate, fix, repeat) | Per-phase checklist and a coverage loop |
| Provide a default, not many options | Pick one prioritization method by default |
| Avoid time-sensitive info; consistent terminology | Use one term per concept (deliverable vs entregavel vs epic) |
| Build evaluations first; at least three; test with Haiku, Sonnet, Opus | Create eval scenarios from the user's real roadmap before writing the full skill |
| Prefer scripts: more reliable, save tokens | Checker already exists in the user's repo; reuse |

Claude Code docs add: context is the fundamental constraint; use subagents for research so exploration stays out of the main context; use a fresh reviewer context for adversarial checks, and tell the reviewer to flag only gaps affecting stated requirements (otherwise it over-engineers); give Claude a pass/fail check it can run ([best practices, SRC-P](https://code.claude.com/docs/en/best-practices)). `disable-model-invocation: true` is documented for side-effect workflows.

### 5.4. LLM planning failure modes and mitigations

| Failure mode | Evidence | Mitigation in v2 |
|--------------|----------|------------------|
| One-shotting too much; running out of context mid-way | Anthropic harness article ([SRC-P](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)) | Phase-by-phase with persisted artifacts; one deliverable per session |
| Declaring victory early | same | Pass/fail coverage check by script, not self-assessment |
| No memory across sessions | same: "each new session begins with no memory" | State in files; initial "read estado.md and registro.md" step |
| Model edits/removes tests to pass | same: "unacceptable to remove or edit tests"; JSON chosen because model is less likely to overwrite it than Markdown | Machine-readable requirements/coverage file where status is the only mutable field [OPINION: for roadmap, consider a JSON/YAML traceability file beside the Markdown] |
| Over-decomposition | Atomic decomposition study: extreme decomposition failed at lower complexity than moderate ([arXiv 2603.06870 via search](https://www.alphaxiv.org/abs/2603.06870), SRC-S); Cone/estimation caveats | Cap depth; deliverables sized by value, not by file; avoid splitting below what can be verified |
| Plans made before grounding violate constraints | [arXiv 2608.06663 via search](https://arxiv.org/pdf/2608.06663), SRC-S | Read repo/sources before drafting; checker against reality (SHAs exist) |
| Error compounding with length | [Albayaydh et al. synthesis via search](https://www.alphaxiv.org/abs/2607.05775.md), SRC-S | Short phases with gates |
| Fabricated citations/metrics | GhostCite (see section 4) | Source inventory plus `UNSOURCED` tag |
| Overconfident estimates | see 3.5 | Ranges, user-provided dates |
| Guessing ambiguous requirements | spec-kit "Don't guess" | `[NEEDS CLARIFICATION]` markers that block "complete" |

Note: the studies on long-horizon agents are preprints seen only via search summaries; treat numbers as indicative.

---

## 6. Gap Analysis against the User's Newer Roadmap

| Practice | Present in newer roadmap? | Evidence | Action |
|----------|---------------------------|----------|--------|
| State vs history separation | Yes | Nygard; Anthropic progress file + git | KEEP |
| Append-only decisions with IDs, supersede links | Yes | Nygard; MADR | KEEP (+ options, revisit trigger) |
| Closed status vocabulary | Yes | Anthropic JSON pass/fail (analogue) | KEEP |
| Evidence = SHA/path | Yes | Claude Code "show evidence"; Anthropic git-as-state | KEEP |
| Automated checker | Yes | Anthropic validate loops; spec-kit analyze | KEEP and extend with coverage |
| "Now" list cap | Yes | NNL | KEEP |
| Objective + acceptance + DoD per deliverable | Yes | INVEST "Testable"; Claude Code verification | KEEP |
| External pending items; blockers | Yes | RAID | KEEP |
| Non-goals | Not stated | Google design docs | ADD |
| Assumptions list | Not stated | RAID | ADD |
| Elicitation protocol with stop rule | No | spec-kit clarify | ADD |
| Requirement IDs and traceability matrix | No | RTM; spec-kit analyze | ADD |
| Source inventory and claim mapping | Sources list only | Anthropic research workflow | ADD |
| Walking skeleton / vertical slicing rules | Implicit | Patton; Cockburn; Lawrence | ADD |
| Estimates as ranges | T-shirt in v1 | McConnell | CHANGE |
| OKR extraction | v1 | Gothelf, Wodtke critiques | CHANGE |
| Critical-path calendar dates from LLM | v1 (critical path) | LLM overconfidence | CHANGE (derive from DAG, no durations) |

---

## 7. Suggested v2 Design Sketch (all [OPINION])

```text
roadmap-planner/
  SKILL.md                    # < 500 lines: phases, gates, which reference to read when
  references/
    elicitation.md            # 10-category scan, question budget, defaults, stop rule
    sources.md                # inventory format, claim tagging, conflict rules
    decomposition.md          # requirement IDs, slicing patterns, walking skeleton, INVEST
    prioritization.md         # one default (MoSCoW + DAG), when to use WSJF
    tracking.md               # state/decisions/log/critical-path/measurements conventions
    templates/                # strategy doc, estado, decisoes, registro, rastreabilidade
  scripts/
    check_roadmap.*           # coverage (req<->deliverable), IDs, statuses, DEC refs, S-nn refs
```

Phases with gates: (0) read existing state (cold start) -> (1) clarify (budgeted) -> (2) source inventory -> (3) requirements with IDs -> (4) decompose + slice + trace -> (5) coverage check (script + fresh-context review) -> (6) publish v1.x with changelog -> (7) live mode (update estado/registro/decisoes; bump roadmap version only on strategy change; checker flags decisions newer than version).

Elicitation categories adapted for roadmaps: objective and outcome metric; stakeholders and jobs; scope and non-goals; constraints (legal, budget, external dates); existing assets and sources; dependencies and external parties; risks and assumptions; acceptance and verification; rollout/measurement; completion signals.

---

## Source Quality Assessment

| Source Type | Availability | Quality | Notes |
|-------------|--------------|---------|-------|
| Anthropic / Claude Code docs | High | High | Primary, current; some pages mention 2026 versions |
| spec-kit repo and templates | High | High | Primary; README is brief, templates carry the detail |
| Kiro docs | Medium | Medium-High | Fetched page lacks EARS and clarification detail; `/docs/specs/concepts` returned 404 |
| BMAD, Taskmaster READMEs | Medium | Medium | READMEs only; no detail on phases/sharding/readiness |
| Classic agile (Patton, Lawrence, Nygard, Ubl) | High | High | Older but originating sources |
| Roadmap thought leaders (Bastow, Pichler, Torres) | Low | Low-Medium | Originals not retrieved; vendor/blog summaries only |
| Prioritization (MoSCoW, WSJF, RICE) | Medium | Medium | RICE primary; WSJF partial (gated); MoSCoW via search summary |
| LLM planning research | Low | Low-Medium | Preprints via search summary, little directly on roadmap planning or estimate calibration |
| Traceability, RAID, DoR | Medium | Low-Medium | Vendor and practitioner blogs; no standards fetched |

## Knowledge Gaps

- [ ] Primary sources not retrieved: Bastow (NNL), Pichler (GO roadmap, page 404), Torres (OST), Wake (INVEST), Cockburn (walking skeleton), Agile Business Consortium MoSCoW guide.
- [ ] Kiro's EARS usage and clarification behavior unverified from official docs; BMAD's readiness check and sharding not verified.
- [ ] No study found measuring LLM/agent estimate accuracy for software or roadmap tasks; claims about overconfidence rely on general calibration preprints (unverified details).
- [ ] No authoritative source on evidence grading or conflict resolution for planning inputs (the rules in section 4 are my design).
- [ ] No source found for "anti-goals" as a defined term, nor on T-shirt sizing limits.
- [ ] Not tested: whether the proposed question budget (5) is adequate for multi-quarter roadmaps; requires evals on real cases.
- [ ] Skill-eval design (three scenarios minimum per Anthropic) not yet drafted.

## Key Sources

| # | Source | Type | Date | Relevance |
|---|--------|------|------|-----------|
| 1 | [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | Primary (Anthropic) | current (fetched 2026-10-16) | 500-line limit, one-level references, scripts, evals |
| 2 | [Claude Code best practices](https://code.claude.com/docs/en/best-practices) | Primary | current | Interview pattern, verification, subagents, failure patterns |
| 3 | [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Primary (Anthropic) | n/d on page | Failure modes, feature JSON, progress file |
| 4 | [GitHub spec-kit](https://github.com/github/spec-kit) | Primary | current | SDD workflow |
| 5 | [spec-kit spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md) | Primary | current | Ambiguity markers, constitution gates |
| 6 | [spec-kit clarify template](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md) | Primary | current | Bounded elicitation, stop rules |
| 7 | [spec-kit analyze template](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/analyze.md) | Primary | current | Coverage gaps, orphans, severity |
| 8 | [Kiro specs](https://kiro.dev/docs/specs/) | Primary (vendor) | current | Three-file spec, waves |
| 9 | [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | Primary (README) | current (v6.12 stable) | Size process to work, durable context |
| 10 | [Taskmaster AI](https://github.com/eyaltoledano/claude-task-master) | Primary (README) | current | PRD to tasks, context cost |
| 11 | [Nygard, Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) | Primary | 2011-11-15 | ADR immutability, supersede |
| 12 | [MADR](https://adr.github.io/madr/) | Primary | 4.0.0, 2024-09-17 | Decision template |
| 13 | [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/) | Expert | n/d | Goals vs non-goals |
| 14 | [Patton, The New Backlog](https://www.jpattonassociates.com/the-new-backlog/) | Primary/expert | n/d | Story map, backbone, walking skeleton |
| 15 | [Humanizing Work splitting guide](https://www.humanizingwork.com/the-humanizing-work-guide-to-splitting-user-stories/) | Primary/expert | n/d | Splitting patterns, vertical slices |
| 16 | [Intercom RICE](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/) | Primary/expert | n/d | RICE definition and caveats |
| 17 | [SAFe WSJF](https://framework.scaledagile.com/wsjf/) | Primary (partial) | n/d | WSJF definition |
| 18 | [ProdPad NNL glossary](https://www.prodpad.com/glossary/now-next-later-roadmap/) | Secondary/vendor | n/d | NNL |
| 19 | [LogRocket feature vs outcome roadmap](https://blog.logrocket.com/product-management/feature-driven-to-outcome-driven-roadmap/) | Secondary | n/d | Outcome roadmaps |
| 20 | [Gothelf, OKRs are not task lists](https://jeffgothelf.com/blog/okr-leadership-okrs-are-not-task-lists/) | Expert | n/d | OKR output trap |
| 21 | [ProductPlan OST glossary](https://productplan.com/glossary/opportunity-solution-tree) | Secondary | n/d | OST |
| 22 | [Velocity Partners on DoR](https://velocitypartners.net/blog/2017/04/18/definition-ready-anti-pattern/) | Secondary | 2017-04-18 | DoR critique |
| 23 | [Cone of uncertainty summary](https://concepts.dsebastien.net/concept/cone-of-uncertainty/) | Secondary | n/d | Estimate ranges |
| 24 | [Creately RAID guide](https://creately.com/guides/raid-log-guide/) | Secondary/vendor | n/d | RAID |
| 25 | [GhostCite](https://arxiv.org/html/2602.06718) | Preprint (via search) | 2026 | Citation hallucination |
| 26 | [Long-horizon agent preprints](https://www.alphaxiv.org/abs/2607.05775.md), [LEAD](https://www.alphaxiv.org/abs/2603.06870), [Horizon gap](https://arxiv.org/pdf/2608.06663) | Preprint (via search) | 2026 | Planning/decomposition failure |
| 27 | [Cognitive biases in LLMs](https://arxiv.org/pdf/2410.15413) | Preprint (via search) | 2024 | Planning fallacy test |
| 28 | [TraceabilityMatrix guide](https://www.zetcode.com/terms-testing/traceability-matrix/) | Secondary | n/d | Two-way traceability |

---

**Report generated on**: October 2026
**Version**: 1.0
**Author**: Deep Research Analyst (Claude Code Agent)
**Methodology**: Multi-source internet research with critical evaluation; primary vs secondary labelled per claim
