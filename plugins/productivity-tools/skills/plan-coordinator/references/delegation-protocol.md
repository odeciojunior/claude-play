# Delegation Protocol (Phase 2)

## Contents

- Wave loop
- Context layers
- Fork vs fresh vs continue
- Prompt template
- Verification
- Writing back
- Recovery after compaction or restart
- Completion

The main conversation is the orchestrator. It launches waves, checks results, records events and moves on. It does not implement non-inline steps itself and does not read executor transcripts. Every transition is an `apply` event (`references/state.md`); `next --json` says what is due, and a refused event changes nothing. Nothing starts while the run is `blocked`, except asking an in-flight agent for its report.

## Wave loop

Waves are barriers: a wave's groups launch only after the previous wave's gate passed. The loop is `next`, act, `apply`:

1. **`launch`** lists the steps ready, each with `mode`, tier, effort, agent and brief. Allow the plan's validation commands first: name them in the map report so permission prompts do not stall a background wave; never write settings yourself. Run `inline` steps first, one at a time, with nothing in flight: `inline-start`, do the work from the brief, check its Done-means, `inline-result --value pass|fail`. For the delegated steps, run `launch --steps n,m` **before** the `Agent` calls, then send one `Agent` call per step in a single message with `subagent_type`, `model` = the tier and `effort` as listed, and the prompt template below. A repeat after a failure goes up with `launch --steps n --tier <tier>`; `tier-down` is refused.
2. **`await`**: wait for the notifications; do not poll or sleep.
3. **Verify each report** (Verification), then `report --step n --value pass|fail|blocked --text <evidence line>`.
4. **`review`**: the step is gated. Launch a read-only opus reviewer (DEC-206: the gate means opus whatever the routing `reviewTier`, effort medium) with the step's brief, the report and the changed paths; then `review-result --value pass|defects|lost`. Defects return the step to the same executor through `SendMessage` (a fresh agent for read-only agent types); the CLI allows 2 fix-up rounds.
5. **`wave-gate`**: with nothing in flight, run the plan's full check once and compare with `baseline.md`; only a failure outside it counts. `wave-gate --value pass`. On a failure, run each group's targeted check, diff the failing paths against each step's files, and `wave-gate --value fail --step n` for the owner; with no owner, record it and `block`.
6. **`advance`** moves to the next wave. With `commits: per-step`, commit each passing step (`git add -- <its files>`, then `git commit -- <its files>`) and record `apply commit --step n --sha <sha>`. If `plan.roadmap` names a folder, invoke the `roadmap-tracker` skill with the event "wave N closed (steps ...); no questions, return pending items" and keep each pending item it returns for the final report; the tracker never blocks the run.
7. **`hold`**, **`prelaunch-review`**, **`authorize`** and **`ask`** are the stops, below.

Held and external steps follow the CLI. `hold` lists steps waiting on a held dependency: `apply hold --step n` for each, with the reason; `release --step n` returns one to `pending` once its entry is closed. For an external step, `prelaunch-review` is a read-only opus review of its brief (it never causes the effect), recorded with `prelaunch-review --value pass|defects`; `authorize` follows (SKILL.md, Phase 2). An external effect launches at most once per authorization: after a failure or a lost agent the step is `stopped`, the question says the result was not checked, and the answer is an `answer` event (`done`, `no` or `rerun`, which needs its own review and authorization).

## Context layers

Subagents start with a clean context. Each gets the step's brief, `briefs/T<n>.md`, which holds the plan's constraints, the step's files, checks, consumed interfaces and text, plus the lines of the prompt template.

- **Pass references, not content.** Paths, exported symbols, signatures, commands. Agents read files themselves.
- **Handoffs, not transcripts.** A dependent step needs the interface its brief consumes; if an upstream HANDOFF line says more (a name that differs from the plan), pass that line, never the report or the diff.
- **Don't repeat CLAUDE.md.** Subagents load it. `Explore` and `Plan` don't, so put the conventions they need into the prompt.
- **No plan file.** Executors never read the plan; if they would need it, the brief is incomplete.

## Fork vs fresh vs continue

| Situation | Use |
|-----------|-----|
| Normal step | **Fresh** agent of the listed type and tier |
| Needs facts that exist only in this conversation | **`fork`** (inherits the orchestrator's model, so it cannot be down-tiered; prefer a fresh agent with the facts in the prompt) |
| Review fix-up or a same-tier retry | **`SendMessage`** to the same agent; if refused, a fresh agent. `Explore` and `Plan` are one-shot |
| Retry one tier up | **Fresh** agent with `launch --tier`, and the failed report attached |

Don't use `isolation: "worktree"` for plan steps: a worktree branches from the default branch, so earlier waves' unmerged work is invisible to it.

## Prompt template

```text
<brief of the step, verbatim: briefs/T{N}.md>

## Your task: Step {N} — {title}
{goal, files to create/modify, inputs, constraints}

## What earlier steps produced
{handoff lines of dependencies, or "Nothing — this step has no upstream dependencies."}

## Done means
- {validation command} → {expected result}

## If blocked
Stop and report BLOCKED — do not improvise outside the listed files.

## Rules
- Only modify: {file list}. Other agents are editing other files in parallel right now.
- Do not add or remove dependencies, run code generators, update snapshots, or run full builds unless the brief says so — report BLOCKED instead.
- Run targeted checks only ({command}); the orchestrator runs the full suite.
- Do not spawn subagents: nesting would break the write-set guarantee.
- Never commit. The orchestrator commits.
- Never push, deploy or cause any other external effect (production, e-mail or messages, shared data, someone's checkout) unless the brief marks the step external and the prompt says it is authorized; then do it exactly as written, once.
- Never ask the person anything: if a decision is missing, stop and report BLOCKED with the question.

## Report (reply with exactly this, ≤25 lines, no diffs)
STATUS: PASS | FAIL | BLOCKED
FILES: <paths changed>
EVIDENCE: <command> → <result line>
HANDOFF: <≤5 lines: what now exists and how downstream steps use it>
CONCERNS: <anything the orchestrator should know, or "none">
```

## Verification

Trust the evidence, not the claim.

- STATUS is PASS but EVIDENCE is missing or does not match "Done means": treat as FAIL (ask the same agent through `SendMessage`; `Explore` and `Plan`: a fresh agent, same tier).
- Checks that take seconds (one test file, `git diff --stat` against FILES): run them yourself.
- FILES outside the allow-list: inspect before accepting; a parallel collision is likely.
- A review gate runs after verification, never instead of it.

## Writing back

Each verified step is written by its event (`report`, `review-result`, `commit`); put the evidence line in `--text`. Keep concerns worth reporting for the final report. The model that actually ran can differ from the listed tier when `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set.

## Recovery after compaction or restart

1. `next --json` is the whole recovery: it names the action, the steps in flight and the question when blocked.
2. For `await`: if a notification already arrived in this conversation, process it. Otherwise ask the agent once through `SendMessage`. With no known agent (the state keeps an agent ID only when `launch` received `--agent-id`), no answer or a refused message, apply `no-report --step n`; a non-external step is then launched again.
3. Continue at the action `next` returns.

## Completion

`next` returns `final-gate` when every step is terminal or held.

1. **Open entries first.** `next` returns `ask` with the open `manual` entries: one question covering all of them (`block`, then the answer events).
2. **Full check** against `baseline.md`, then a read-only opus reviewer at `effort: high` for the whole change: `git diff <run.base>` and `git ls-files --others --exclude-standard`, looking for broken contracts between steps, regressions outside the changed files and acceptance criteria with no test. Refused steps and their dependents are named as not run; a `stopped` step as launched once with the outcome unconfirmed.
3. `final-gate --value pass`, or `defects --step n` for the owning step, which the CLI sends back as a failure; fix with a fresh executor at its tier (never on an external step's effect), commit, run the check and the review again. A third round runs on opus; after that, `block` and ask.
4. `skip` only when no step ran. After `completed`, if `plan.roadmap` names a folder, invoke `roadmap-tracker` with the event "plan completed; no questions, return pending items". Report to the user: tiers planned versus actual, retries, each external step and what happened to it, and the tracker's pending items. Do not push unless asked, except an authorized external step.
