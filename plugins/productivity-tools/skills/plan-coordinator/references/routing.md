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

The route (tier, effort, reviewer, gate) is the one computed by `route` in `lib/routing.mjs`. `plan-tool emit` and `plan-tool map` return it, and `init` copies it into `progress.json`; this file does not repeat the table and the coordinator never re-scores a step. Read the dimensions above to understand a route, not to recompute it.

**Split, don't promote:** a step that would touch 5 or more files is split into steps of at most 4 files each before it is scored. Size alone never sends a step to opus.

**Inline** is the launch mode of the `inline-start` event: haiku, not external, no gate, at most 3 per plan, run between waves with nothing in flight. A failed inline step goes back as a delegated sonnet step (`inline-result --value fail`).

## 3. Overrides

`route` applies them in its own order; the coordinator only reads the outcome.

1. **Risk floor:** Blast radius 2 means at least sonnet and a gate with an opus reviewer, whatever `reviewTier` says. A true gate always means an opus reviewer in the coordinator.
   1. **External effect (DEC-206):** an external step counts as Blast radius 2 before the total and the table. It runs on sonnet at least, with an opus pre-launch review and an opus gate, never inline, and launches at most once, only with a recorded authorization. It takes no retry, fix-up or escalation; its states are in delegation-protocol, § Step lifecycle.
2. **Mechanical ceiling:** high Scope with Ambiguity 0, Reasoning 0 and Blast radius <= 1 runs on haiku in directory bundles; with Blast radius 2 the floor applies.
3. **Verification-heavy:** Verifiability 2 with Reasoning >= 1 raises one tier; a step scored 6-10 stays on sonnet with `effort: high` and gets a gate.
4. **Research/read-only:** locating code or answering "where/how is X" goes to `Explore`; design questions to `Plan` or an opus `general-purpose` agent.

**Passing the tier:** pass the tier from `launch` as the `Agent` call's `model` and its effort as `effort`. Exceptions: a project/user agent whose frontmatter pins `model` that you decide to keep (record why), and `fork`, which inherits the orchestrator's model. Fork only when the step needs unwritten conversation context.

## 4. Review gates

A gate is the `gate` field of the step in `progress.json`; it is set by `route`, and the reviewer is a read-only agent told not to edit.

- **Reviewer tier = executor tier or above, never below.** Per-step gates run on opus (`effort: medium`) without measured evidence for another model; the final whole-branch review is opus with `effort: high`.
- A gated step is done only after `review-result --value pass`; its dependents wait for that, and its handoff is rewritten after any fix-up.
- The reviewer gets the step card, the executor's report and the changed file paths, never the executor's transcript. Its verdict is PASS or concrete defects.
- Defects go back to the same executor via `SendMessage` (`Explore` and `Plan`: a fresh agent). At most 2 fix-up rounds at the same tier; the third round runs on opus (§5 step 3). An external step has no fix-up.

**External step: two opus gates**, read-only, at `effort: medium`, never causing the effect. The pre-launch review (SKILL.md Step 8 item 4) runs before the authorization question and launch, and returns PASS or defects: the card states the exact effect and target, how a duplicate is avoided or detected, and how the result is verified. The review gate after the effect checks the result of a PASS report.

## 5. Escalation ladder (on FAIL, BLOCKED, or exhausted review rounds)

Non-external steps only; see delegation-protocol, § Step lifecycle.

1. **Diagnose first.** Read the report: spec gap, environment problem, or capability shortfall? For a shortfall, try a higher per-call `effort` on the `Agent` call before a tier bump.
2. **Spec gap / environment** → fix the card or environment and retry **same tier**, via `SendMessage` to the same agent (Explore/Plan: fresh agent, same tier). One such retry per step.
3. **Capability shortfall** (wrong approach, looping, shallow fix) → retry **one tier up** (`launch --steps n --tier <tier>`) with a fresh agent, including the failed attempt's report as "what was tried and why it failed". Inline → sonnet (skip haiku), which `inline-result --value fail` does. Already at opus → one fresh opus retry with the failure report and a narrowed card.
4. **Still failing after that** (second failure at opus), or any failure needing a decision → stop that branch: hold the step with `Open question: Step N: <exact question and what each answer does>` under Manual Actions (delegation-protocol, § Step lifecycle) and record it in Issues & Decisions.

Never resend an identical prompt at an identical tier.

## 6. Calibrate as you go

The state records `tier · attempts · outcome` per step. Before each wave, re-check the remaining waves:

- 2+ failures at a tier for similar steps → bump the remaining similar steps one tier.
- A sonnet step that turned out trivial doesn't justify down-tiering others; only a pattern does.

## 7. Agent matching checklist

1. Capability: does the agent have the tools the step needs (Edit/Write/Bash)?
2. Domain: which description best matches the step's primary technology?
3. Specialization: prefer the narrowest agent that fully covers the step.
4. Explicit exclusions: respect "Do NOT use for…" lines in agent descriptions.
5. Fallback: `general-purpose`.
