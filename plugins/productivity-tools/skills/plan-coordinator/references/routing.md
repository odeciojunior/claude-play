# Routing: Complexity Scoring and Model Tiers

Goal: each step runs on the cheapest route that finishes it **first time**. A failed cheap run followed by a retry costs more than one correct mid-tier run, so tier for expected total cost, not the cost of a single attempt.

## 1. Score the step (0–10)

Score each dimension 0, 1 or 2 and sum.

| Dimension | 0 | 1 | 2 |
|-----------|---|---|---|
| **Scope** | 1 file, <~50 lines | 2–5 files in one module | >5 files or several modules |
| **Ambiguity** | Exact spec (signatures, values, text given) | Some design choices left open | Goal only; approach must be designed |
| **Reasoning depth** | Mechanical / pattern copy | Ordinary logic, known patterns | Concurrency, algorithms, state machines, tricky debugging, perf |
| **Blast radius** | Leaf code, docs, tests | Shared internal code, internal config | Public API, schema/migrations, auth, money, data deletion, infra, and files that drive build/CI/deploy/install (manifests, pipelines, registries) |
| **Verifiability** | Automated check proves it (tests, typecheck, exact output) | Partial check | Only judgment or manual check |

Unknown information scores **1**, not 0 — and flag it in the map report (SKILL.md Step 8).

## 2. Map score to route

| Score | Route | Typical work |
|-------|-------|--------------|
| 0–2 | **Inline** if it meets the inline limits below; else **haiku** | Renames, config values, doc edits, boilerplate from an existing example, running a command and summarizing |
| 3–5 | **sonnet** | Typical feature work, tests for existing code, refactors inside one module, bug fixes with a clear repro |
| 6–10 | **opus** only if Blast radius = 2 **and** Ambiguity = 2; otherwise **sonnet** with `effort: high` | Cross-module design, ambiguous specs, concurrency/security-sensitive logic, migrations, debugging without a repro |

**Split, don't promote:** a step that would touch 5 or more files is split into steps of at most 4 files each (disjoint file lists or a declared dependency) before it is scored. Size alone never sends a step to opus. Mechanical-ceiling work (§3.2) is exempt: it keeps its directory bundles.

**Reasoning effort per tier** (not the step-effort hours in the progress file). Pass it as the `Agent` call's `effort`, or set it in the agent's frontmatter: **haiku → `low`**, **sonnet → `medium`**, **opus → `medium`**. A step scored 6–10 that is routed to sonnet runs with `high`. `high` is otherwise reserved for the final whole-branch gate (§4) and for a capability-shortfall retry (§5 step 1). Inline steps run at the orchestrator's own effort.

**Inline limits** — all must hold: the files are docs/config or already read in this conversation, ≤2 files, <~50 changed lines, no dependency install/codegen, no test run longer than a single quick command, Blast radius ≤ 1, and at most 3 inline steps per plan. Inline skips subagent cold start but spends orchestrator context, which is why it's capped. Inline steps run **between waves** (after one wave's gate, before the next launch; wave 1's run before its launch, per Wave loop item 10 of the delegation protocol), never while agents are in flight — an inline edit mid-wave is an undeclared parallel writer.

## 3. Overrides (apply after the table, in this order)

1. **Risk floor (always wins):** Blast radius = 2 → implementation at least sonnet **and** a review gate by an opus-tier reviewer. No later override or self-approval decision can take a step below this.
   External effect: an external step counts as Blast radius 2 (opus pre-launch review and opus review gate, §4), is never Inline, and never starts without a recorded authorization (SKILL.md Step 8). An external step that is in flight or failed is never relaunched or retried automatically, including review fix-ups and escalation: its effect may already have happened and leaves no file to inspect. Unless its card states an idempotence check (it says a further run after a partial one is safe and how that is verified; detecting a prior run is not enough; with one, §5 applies, through pre-flight), stop it and ask now: hold it (SKILL.md Step 8 item 2) with `Open question: Step N: <effect, exact question and what each answer does>` under Manual Actions, record it in Issues & Decisions, write `Status: Blocked` and into `Next Action` that question and "then re-run SKILL.md Step 8", and only then ask, in the same turn. A second stop while one is open joins that question. Nothing else starts until the answer (delegation protocol, Wave loop), which restores `Status: In Progress`.
2. **Mechanical ceiling:** high Scope, Ambiguity = 0, Reasoning = 0 and Blast radius ≤ 1 (bulk rename of internal names, repetitive edits, formatting, codemod-like changes) → haiku, split into parallel bundles by directory. With Blast radius 2 the floor applies instead: sonnet, bundled, plus review.
3. **Verification-heavy:** Verifiability = 2 and Reasoning ≥ 1 → one tier up; nothing will catch a subtle mistake. A step scored 6–10 does not reach opus through this override: it stays on sonnet with `effort: high` and gets a review gate.
4. **Research/read-only:** locating code or answering "where/how is X" → `Explore` (read-only, fast); design questions → `Plan` or an opus `general-purpose` agent.

**Passing the tier:** always pass the routed tier as the `Agent` tool's `model` parameter — it's the only reliable way for built-in and plugin agents, whose model you usually can't read. Two exceptions: a project/user agent whose frontmatter pins `model` that you decide to keep (record why), and `fork`, which always inherits the orchestrator's model and so cannot be down-tiered. Only fork when the step needs unwritten conversation context (see the Fork vs fresh section of the delegation protocol, linked from SKILL.md).

## 4. Review gates

Add a separate review step (read-only reviewer agent, e.g. a `code-reviewer` type if one exists, else `general-purpose` told not to edit) when:

- the risk floor fired, or
- score ≥ 7, or
- a haiku step writes code other steps build on **and** no automated check fully proves it (Verifiability ≥ 1). A cheap implementation plus a strong review is usually cheaper than an opus implementation.

Rules:

- **Reviewer tier = executor tier or above, never below.** Per-step review gates run on opus (`effort: medium`); do not move them to another model without measured evidence; the final whole-branch review is always opus with `effort: high`.
- A gated step is **done** only after the reviewer's PASS. Its dependents don't start before that, and its Handoff is (re)written after any fix-up.
- The reviewer gets the step card, the executor's report and the changed file paths — never the executor's transcript. Its verdict is PASS or a list of concrete defects.
- Defects go back to the **same** executor via `SendMessage` (works on finished agents too; they keep their context; `Explore` and `Plan` are one-shot, so for them a fix-up or retry means a fresh agent). **At most 2 fix-up rounds** (same tier) — a third defect list is a capability shortfall (§5 step 3), and the third round runs on opus. This holds at every executor tier and takes precedence over §5 step 3's one-tier-up. An external step's fix-up follows the last paragraph of §5.

**External step: two opus gates.** Both are read-only, run at `effort: medium`, and never cause the effect themselves.

- **Pre-launch review** (SKILL.md Step 8 item 4), before the authorization question and before launch. It gets the Shared Brief, the step card and the plan's text of the step, and returns PASS or concrete defects. It checks that the card states the exact effect and its target, nothing broader than the step; how a duplicate is avoided or detected; and how the result will be verified. A parameter of the effect that comes from an upstream handoff is named in the card; pre-flight writes it in from the handoff (Wave loop item 2), which is a card change, so the review runs again. A PASS is recorded in the card's `Pre-launch review:` line. A review that does not pass means the effect is not launched and the authorization question is not asked for that step.
- **Review gate after the effect**, as above: it checks the result of a PASS report; a FAIL or BLOCKED report goes to §3.1 without it. Its defects follow §3.1 for external steps, not the fix-up rounds above.

## 5. Escalation ladder (on FAIL, BLOCKED, or exhausted review rounds)

1. **Diagnose first.** Read the report: spec gap, environment problem, or capability shortfall? For a shortfall, try a higher per-call `effort` on the `Agent` call before a tier bump.
2. **Spec gap / environment** → fix the card or environment and retry **same tier**, via `SendMessage` to the same agent (Explore/Plan: fresh agent, same tier). One such retry per step.
3. **Capability shortfall** (wrong approach, looping, shallow fix) → retry **one tier up** with a fresh agent, including the failed attempt's report as "what was tried and why it failed". Inline → sonnet (skip haiku: the step already proved harder than it looked). Already at opus → one fresh opus retry with the failure report and a narrowed card.
4. **Still failing after that** (second failure at opus), or any failure needing a decision → stop that branch (an external step stops as in §3.1, never by this path): hold the step (SKILL.md Step 8 item 2) with `Open question: Step N: <exact question and what each answer does>` under Manual Actions and record it in Issues & Decisions. While a group that doesn't depend on it is in flight or can still launch, leave `Status` as it is and keep running them. When nothing else can run, Completion (delegation protocol) sets `Status: Blocked`, writes that question into `Next Action` and asks the user; the answer restores `Status: In Progress`.

Never resend an identical prompt at an identical tier.

A card change on an external step (steps 2 and 3 above, or a §4 fix-up) returns it to SKILL.md Step 8 item 4 before the retry, and any retry of an external step launches only after pre-flight (Wave loop item 2), so a stale `Pre-launch review:` or `Authorized:` line cannot launch it.

## 6. Calibrate as you go

Record `tier · attempts · outcome` per step in the progress file. Before each wave, re-check the remaining waves:

- 2+ failures at a tier for similar steps → bump the remaining similar steps one tier.
- A sonnet step that turned out trivial doesn't justify down-tiering others; only a pattern does.

## 7. Agent matching checklist

1. Capability: does the agent have the tools the step needs (Edit/Write/Bash)?
2. Domain: which description best matches the step's primary technology?
3. Specialization: prefer the narrowest agent that fully covers the step.
4. Explicit exclusions: respect "Do NOT use for…" lines in agent descriptions.
5. Fallback: `general-purpose`.
