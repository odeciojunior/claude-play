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

Unknown information scores **1**, not 0 — and flag it in the approval summary.

## 2. Map score to route

| Score | Route | Typical work |
|-------|-------|--------------|
| 0–2 | **Inline** if it meets the inline limits below; else **haiku** | Renames, config values, doc edits, boilerplate from an existing example, running a command and summarizing |
| 3–5 | **sonnet** | Typical feature work, tests for existing code, refactors inside one module, bug fixes with a clear repro |
| 6–10 | **opus** | Cross-module design, ambiguous specs, concurrency/security-sensitive logic, migrations, debugging without a repro |

**Inline limits** — all must hold: the files are docs/config or already read in this conversation, ≤2 files, <~50 changed lines, no dependency install/codegen, no test run longer than a single quick command, Blast radius ≤ 1, and at most 3 inline steps per plan. Inline skips subagent cold start but spends orchestrator context, which is why it's capped. Inline steps run **between waves** (after one wave's gate, before the next launch), never while agents are in flight — an inline edit mid-wave is an undeclared parallel writer.

## 3. Overrides (apply after the table, in this order)

1. **Risk floor (always wins):** Blast radius = 2 → implementation at least sonnet **and** a review gate by an opus-tier reviewer. No later override, and neither the Cheaper nor the Safer approval option, can take a step below this.
2. **Mechanical ceiling:** high Scope, Ambiguity = 0, Reasoning = 0 and Blast radius ≤ 1 (bulk rename of internal names, repetitive edits, formatting, codemod-like changes) → haiku, split into parallel bundles by directory. With Blast radius 2 the floor applies instead: sonnet, bundled, plus review.
3. **Verification-heavy:** Verifiability = 2 and Reasoning ≥ 1 → one tier up; nothing will catch a subtle mistake.
4. **Research/read-only:** locating code or answering "where/how is X" → `Explore` (read-only, fast); design questions → `Plan` or an opus `general-purpose` agent.

**Passing the tier:** always pass the routed tier as the `Agent` tool's `model` parameter — it's the only reliable way for built-in and plugin agents, whose model you usually can't read. Two exceptions: a project/user agent whose frontmatter pins `model` that you decide to keep (record why), and `fork`, which always inherits the orchestrator's model and so cannot be down-tiered. Only fork when the step needs unwritten conversation context (see delegation-protocol § Fork vs fresh).

## 4. Review gates

Add a separate review step (read-only reviewer agent, e.g. a `code-reviewer` type if one exists, else `general-purpose` told not to edit) when:

- the risk floor fired, or
- score ≥ 7, or
- a haiku step writes code other steps build on **and** no automated check fully proves it (Verifiability ≥ 1). A cheap implementation plus a strong review is usually cheaper than an opus implementation.

Rules:

- A gated step is **done** only after the reviewer's PASS. Its dependents don't start before that, and its Handoff is (re)written after any fix-up.
- The reviewer gets the step card, the executor's report and the changed file paths — never the executor's transcript. Its verdict is PASS or a list of concrete defects.
- Defects go back to the **same** executor via `SendMessage` (works on finished agents too; they keep their context). **At most 2 fix-up rounds** — a third defect list is a capability shortfall (§5 step 3).

## 5. Escalation ladder (on FAIL, BLOCKED, or exhausted review rounds)

1. **Diagnose first.** Read the report: spec gap, environment problem, or capability shortfall?
2. **Spec gap / environment** → fix the card or environment and retry **same tier**, via `SendMessage` to the same agent. One such retry per step.
3. **Capability shortfall** (wrong approach, looping, shallow fix) → retry **one tier up** with a fresh agent, including the failed attempt's report as "what was tried and why it failed". Inline → sonnet (skip haiku: the step already proved harder than it looked). Already at opus → one fresh opus retry with the failure report and a narrowed card.
4. **Still failing after that** (second failure at opus), or any failure needing a decision → stop that branch, record it in Issues & Decisions, and ask the user. Groups that don't depend on it may continue.

Never resend an identical prompt at an identical tier.

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
