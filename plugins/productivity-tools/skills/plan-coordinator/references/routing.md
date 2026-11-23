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

Unknown information scores **1**, not 0.

## 2. Map score to route

The route (tier, effort, reviewer, gate) is the one computed by `route` in `lib/routing.mjs`. `plan-tool emit` and `plan-tool map` return it, and `init` copies it into `progress.json`; this file does not repeat the table and the coordinator never re-scores a step. Read the dimensions above to understand a route, not to recompute it.

**Split, don't promote:** a step that would touch 5 or more files is split into steps of at most 4 files each before it is scored. Size alone never sends a step to opus.

**Inline** (`inline-start` / `inline-result`): these events exist in the `progress.mjs` state CLI (haiku, not external, no gate, at most 3 per plan, falling back to delegated sonnet on `inline-result --value fail`), while `coordinator-workflow` dispatches every step as a delegated `productivity-tools:implementer` call.

## 3. Overrides

`route` applies them in its own order; the coordinator only reads the outcome.

1. **Risk floor:** Blast radius 2 means at least sonnet and a gate with an opus reviewer, whatever `reviewTier` says. A true gate always means an opus reviewer in the coordinator.
   1. **External effect (DEC-206):** an external step counts as Blast radius 2 before the total and the table. It runs on sonnet at least, with an opus pre-launch review and an opus gate, never inline, and launches at most once, only with a recorded authorization. It takes no retry, fix-up or escalation; its states are governed by the state machine (`lib/progress-state.mjs`).
2. **Mechanical ceiling:** high Scope with Ambiguity 0, Reasoning 0 and Blast radius <= 1 runs on haiku in directory bundles; with Blast radius 2 the floor applies.
3. **Verification-heavy:** Verifiability 2 with Reasoning >= 1 raises one tier when total <= 5; for total 6–10, a sonnet step (which runs at `effort: high`) gets a gate (a step with Blast radius 2 and Ambiguity 2 is already opus).
4. **Agent routing:** `coordinator-workflow` routes all execution steps to `productivity-tools:implementer` and reviews to `task-reviewer`/`final-reviewer`.

**Passing the tier:** `coordinator-workflow` passes the step's `tier` as `model` and `effort` as `effort` to `productivity-tools:implementer`.

## 4. Review gates

A gate is the `gate` field of the step in `progress.json`; it is set by `route`, and the reviewer is a read-only agent told not to edit.

- **Reviewer tier = executor tier or above, never below.** Per-step gates run on opus (`effort: medium`) without measured evidence for another model; the final whole-branch review is opus with `effort: high`.
- A gated step is done only after `review-result --value pass`; its dependents wait for that, and its handoff is rewritten after any fix-up.
- The reviewer gets the step card, the executor's report and the changed file paths, never the executor's transcript. Its verdict is PASS or concrete defects.
- Defects go back as a fresh `productivity-tools:implementer` fix-up call at the step's `tier` (at most 2 fix-up rounds; an external step has no fix-up).

**External step: two opus gates**, read-only, at `effort: medium`, never causing the effect. The pre-launch review runs before the authorization question and launch, and returns PASS or defects: the card states the exact effect and target, how a duplicate is avoided or detected, and how the result is verified. The review gate after the effect checks the result of a PASS report.

## 5. Retries and holds (on FAIL, BLOCKED, or exhausted review rounds)

Non-external steps retry up to 3 attempts at their planned `tier` in `coordinator-workflow` (never re-running external steps); when attempts exhaust, review rounds exceed the limit, or a human decision is needed, the step is held in `manual[]` via `skip-manual`. Tier overrides (`progress.mjs apply launch --tier <tier>`) exist only at the state-CLI level.

## 6. Antigravity (agy) Gemini routing

Only when the host is Antigravity (`run_workflow` present, no `Workflow` tool), `coordinator-agy.py` dispatches on Gemini models. The translation lives in `lib/agy-routing.mjs` (`agyModelFor(tier, effort)`), never in the plan or the state. The path runs only on a direct request from the owner, or from a subagent the owner delegated decision power to: the skill passes `agyRequestedBy` (`owner` or `delegate:<name>`), and the script refuses to start without it.

- **Canonical state:** `plan.md` and `progress.json` hold only Claude tiers (haiku, sonnet, opus). The script translates at dispatch; a Gemini tier is never written to either file.
- **Translation:** haiku -> flash_lite, sonnet -> flash, opus -> pro. A `(sonnet, high)` step is promoted to pro.
- **Reviewers:** `agyReviewModel` is `pro` for every gate, and for every executor already on `pro`; `task-reviewer` and `final-reviewer` run on `pro`.
- **Escalation:** `nextAgyTier` (flash_lite -> flash -> pro -> null) is used only by `roadmap-release-agy.py` in the fix rounds; `coordinator-agy.py` redoes a step at the planned tier (§5).
- **Experimental:** the path is experimental, with judgments (spec, plan, review) from a single model family, and must be checked before going to `main`. Run it on an exclusive checkout: a concurrent edit by another session during a review stops the run (`error` in `coordinator-agy.py`).
- `route(task, ctx)` and the plan digest are unchanged; only the dispatch differs.
