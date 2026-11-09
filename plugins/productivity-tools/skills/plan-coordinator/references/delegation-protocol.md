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

The main conversation is the orchestrator. It launches waves, checks results, writes handoffs into the progress file and moves on. It does not implement non-inline steps itself, and it does not read executor transcripts.

## Wave loop

Waves are **barriers**: a wave's writing groups launch only after the previous wave's gate passed. (Read-only groups — research, review — may launch as soon as their own dependencies are done.)

**While `Status` is `Blocked`, nothing starts:** no launch, retry, fix-up, review gate or external action of any kind, `SendMessage` included (except asking an in-flight agent for its report), and the wave gate and Advance wait. Step 8's own read-only reviews are self-approval and are not barred. Groups already in flight finish and are recorded; a failure among them joins the pending question.

1. **Read state:** `## Recovery State` + the Execution Map table of the progress file.
2. **Pre-flight the wave:** re-apply calibration (routing.md §6); confirm no two groups in the wave share a write set, counting implicit writes (SKILL.md Step 5). A group with an `External: yes` step whose status is not `Skip (manual)` or `Waiting (manual)` launches only if Issues & Decisions holds that step's authorization and its card has the `Pre-launch review:` and `Authorized:` lines; otherwise stop and return to SKILL.md Step 8 item 4. A parameter the card names as coming from upstream is first written into the card from the handoff, unless the card already states it (a card change, so item 4 runs again); if no handoff supplies it, hold the step (SKILL.md Step 8 item 2) with `Open question: Step N: <missing parameter and what each answer does>` and go on with the rest of the wave. The same check runs before any retry or fix-up of an external step, `SendMessage` included.
3. **Allow the checks:** before launching a background wave, propose allow rules for the validation commands (the Shared Brief's build/test/lint commands) to the user in the map report (SKILL.md Step 8) so permission prompts don't stall it, without waiting for an answer; never write settings yourself.
4. **Select and mark delegated:** select the groups with a `Pending` step and no `Launched` step, leaving out the `Final gate` row, groups with `Mode: Inline` and held groups (`Skip (manual)` or `Waiting (manual)`). A launch happens once: a `Launched` step stays out of this item for good, external or not, and only its result is reviewed. With no group selected, skip to item 9. Otherwise set each selected `Pending` step to `Launched`, set `Last DELEGATED Wave` and list the groups in `In-Flight Agents` (e.g. `Group C (Steps 3-5, sonnet): launching`) **before** launching, so a compaction mid-launch is recoverable.
5. **Launch the whole wave in one message:** one `Agent` call per selected group with `subagent_type`, `model: <routed tier>` (always, except `fork` and kept frontmatter pins — routing.md §3), `effort` per routing.md §2 (haiku `low`, sonnet `medium`, a step scored 6–10 on sonnet `high`, opus `medium`), a short `description`, and the prompt from the template below.
6. **Record agent IDs** in `In-Flight Agents` right after the launch returns — they are what `SendMessage` needs after a compaction.
7. **Wait for notifications.** Agents run in the background and notify on completion — don't poll or sleep.
8. **Verify each report** (§ Verification), launch its review gate if it has one, then write the handoff and status per step.
9. **Wave gate:** a wave with no launched group advances without a gate; a wave with `Last DELEGATED Wave` above `Last COMPLETED Wave` did launch. When every launched group in the wave is done (review gates included) and nothing is in flight, run the project's full check once (the build/test command from the Shared Brief). Executors only run their targeted checks. A held group (SKILL.md Step 8 item 2) counts as finished for this gate; a failure in its files is added to its Manual Actions entry and does not stop the wave. Compare the result against Baseline (SKILL.md Step 2): a failure already listed there (or a pass count not below it) is pre-existing; record it under Issues & Decisions, do not attribute it to a group and do not ask the user. Only a failure outside Baseline counts. If the gate fails outside Baseline, attribute it before escalating: run each group's targeted check again and diff the failing paths against each group's FILES; the owning group gets a FAIL with the gate output as evidence. If no group owns it, record it in Issues & Decisions and ask the user. Before asking the user, set `Status: Blocked` and write the exact question and what each answer does into `Next Action`; the answer restores `Status: In Progress`.
10. **Inline steps:** inline steps of the wave about to start run right before its launch, wave 1 included: on the first pass run this item for wave 1 after item 3 (pre-flight and allow rules done) and before item 4 (marking delegated), with nothing in flight; afterwards item 10 runs the next wave's inline steps after the wave gate. A held inline step does not run. Then run their Done-means checks.
11. **Advance:** update `Last COMPLETED Wave` (a wave with no launched group leaves it unchanged; it never goes down), clear `In-Flight Agents`, set `Next Action`, append a row to the Wave Execution Log; if the progress file's `**Roadmap**` names a folder (not `none`), invoke the `roadmap-tracker` skill with the event `"wave N closed (steps …); no questions, return pending items"`; the tracker never blocks the run. Keep the pending items it returns for the final report in Completion. Then start the lowest wave with a `Pending` step, or go to Completion when none is left.

## Context layers

Subagents start with a clean context. Give each one exactly three layers, in this order:

| Layer | Source | Same for every agent? | Size |
|-------|--------|----------------------|------|
| 1. Shared Brief | progress file `## Shared Brief` | Yes | ≤60 lines |
| 2. Upstream handoffs | `Handoff` lines of the steps this one depends on | No | ≤5 lines each |
| 3. Step Card | progress file `### Step N` card | No | ≤40 lines |

- **Brief first, verbatim, identical across agents.** Every agent works from the same conventions and commands. As a side benefit, agents of the same type and model share a prompt prefix that prompt caching may reuse — don't rely on it for the budget.
- **Pass references, not content.** File paths, exported symbols, signatures, commands. Agents read files themselves; pasting file bodies bloats every prompt and goes stale.
- **Handoffs, not transcripts.** Downstream steps get the upstream step's handoff lines (what exists now and how to use it), never its report or diff.
- **Don't repeat CLAUDE.md.** Subagents load it, plus a git status snapshot. `Explore` and `Plan` don't, so put the conventions they need into the card.
- **No plan file.** Executors never read the plan; if they'd need it, the card is incomplete — fix the card.

## Fork vs fresh vs continue

| Situation | Use |
|-----------|-----|
| Normal step, everything needed is in brief + card | **Fresh** agent of the routed type and tier |
| Needs decisions or discoveries that only exist in this conversation, and writing them down would be longer than the step | **`fork`** (inherits the full conversation and the orchestrator's model, so it cannot be down-tiered — expensive; prefer writing the missing facts into the Shared Brief) |
| Review fix-ups, a clarification, or a same-tier retry of the same step | **`SendMessage`** to the same agent — finished agents can be continued; they keep their context. If `SendMessage` to a stopped agent is refused, relaunch the step fresh. `Explore` and `Plan` are one-shot: for them a fix-up or retry is always a fresh agent |
| Retry after escalation to a higher tier | **Fresh** agent at the new tier, with the failed report attached |

Don't use `isolation: "worktree"` for plan steps: a worktree branches from the default branch, so earlier waves' unmerged work is invisible to it, and its changes never reach the wave gate or downstream agents.

## Prompt template

```text
<Shared Brief — verbatim>

## Your task: Step {N} — {title}
{step card: goal, files to create/modify, inputs, constraints, and its `External:`, `Pre-launch review:` and `Authorized:` lines when present}

## What earlier steps produced
{handoff lines of dependencies, or "Nothing — this step has no upstream dependencies."}

## Done means
- {validation command} → {expected result}
- {other acceptance criteria}

## If blocked
{If Blocked guidance}. If still blocked, stop and report BLOCKED — do not improvise outside the listed files.

## Rules
- Only modify: {file list}. Other agents are editing other files in parallel right now.
- Do not add or remove dependencies, run code generators, update snapshots, or run full builds unless this card says so — report BLOCKED instead. Those write shared files other agents depend on.
- Run targeted checks only ({command}); the orchestrator runs the full suite.
- Do not spawn subagents: nesting would break the write-set guarantee.
- Never commit. In a shared worktree, parallel agents' `git add` would be swept into each other's commits; the orchestrator commits.
- Never push, deploy or cause any other external effect (production, e-mail or messages, shared data, someone's checkout) unless this card has `External: yes`, a `Pre-launch review:` line and an `Authorized:` line; then do it exactly as the card says, once.

## Report (reply with exactly this, ≤25 lines, no diffs)
STATUS: PASS | FAIL | BLOCKED
FILES: <paths changed>
EVIDENCE: <command> → <result line>
HANDOFF: <≤5 lines: what now exists and how downstream steps use it — paths, exported names, signatures, env/config keys>
CONCERNS: <anything the orchestrator should know, or "none">
```

## Verification

Trust the evidence, not the claim.

- STATUS is PASS but EVIDENCE is missing or doesn't match "Done means" → treat as FAIL (spec gap: ask the same agent via `SendMessage`; Explore/Plan: fresh agent, same tier).
- Checks that take seconds (typecheck one file, run one test file, `git diff --stat` against FILES) → run them yourself.
- FILES outside the card's allow-list → inspect before accepting; a parallel collision is likely.
- A review gate runs after verification, never instead of it.
- The review gate of an external step checks the result of the effect that ran; its card was already reviewed before launch (routing.md §4).

On FAIL/BLOCKED follow the escalation ladder in `routing.md` §5.

## Writing back

After each verified (and, if gated, reviewed) step, update the progress file:

- Steps table: status, `tier · attempts`, one-line note. Record the model that actually ran: it can differ from the routed tier when `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set or `model` wasn't passed.
- Commit: when the Shared Brief's commit policy is `per step`, after the project's pre-commit checks (e.g. a validate command from the Brief), the orchestrator runs `git add -- <card files>` then `git commit -- <card files>` for each verified step and records the SHA in the step's Note. When it is `none`, the changes stay in the working tree.
- Step card: set `- **Handoff**: …` from the HANDOFF lines. Rewrite it after any review fix-up. This is what downstream prompts will use.
- Issues & Decisions: CONCERNS worth keeping, escalations, user decisions.

Keep it terse — the progress file is re-read after every compaction.

## Recovery after compaction or restart

1. Read only `## Recovery State` and the Execution Map table.
2. For each in-flight group: if its notification already arrived in this conversation, process it. Otherwise, if an agent ID is recorded, ask that agent for its report via `SendMessage`. If there's no ID, no answer, or `SendMessage` is refused (stopped agent), check the step card's **Files** list for changes (`git status`/`git diff --stat`) and re-run the card's Done-means check: pass → write the handoff from the files, then continue through § Verification and § Writing back like a normal report, review gate included; the step is done only after those (an external step in flight is never marked done from its files: item 3 applies); fail or no changes → relaunch the step (except an external step: see item 3).
3. An external step that is in flight or failed is never relaunched or retried automatically, including review fix-ups and escalation: its effect may already have happened and leaves no file to inspect. Stop it and ask now, as in routing.md §3.1, unless its card states an idempotence check.
4. A relaunch or review gate here obeys the `Blocked` rule of the Wave loop: it waits for the answer.
5. Continue at `Next Action`.

## Completion

When only `Skip (manual)` and `Waiting (manual)` steps remain besides finished ones and at least one open Manual Actions entry is not a `Refused:` one: set `Status: Blocked`, write into `Next Action` one exact question covering every open entry that is not `Refused:` (`Open question:` entries supply their text; `Not named:` entries ask for that step's authorization), what each answer does, and "then re-run SKILL.md Step 8" after the manual actions, and ask the user for them; the answer restores `Status: In Progress`. When every step is PASS or intentionally skipped, or every unfinished step is held only by a `Refused:` entry: run the full check (compared against Baseline as in Wave loop item 9: a pre-existing failure is recorded under Issues & Decisions, not treated as a defect), then the **final gate**, a read-only reviewer at opus with `effort: high`. Refused steps and their dependents are named to the reviewer as not run, and their acceptance criteria are not defects; if no step ran, there is no change to review: mark the `Final gate` row `Skip` and go straight to the close-out below, without the check or the review. It gets the plan's goal and acceptance criteria, the Shared Brief, every Handoff, `git diff <Base>` and the untracked files from `git ls-files --others --exclude-standard`, and looks for what per-step reviews miss: broken contracts between steps, regressions outside the changed files, and acceptance criteria with no test. Defects go to a fresh executor at the owning step's tier, followed by a commit under the Shared Brief's policy, the full check and a new final review, at most 2 rounds; a third round runs on opus. Record each round in `**Final gate rounds:** <n done> (last verdict: <PASS | defects: ...>)` in Recovery State, updated after every round, so a compaction does not restart the count. A round is one fix, commit, full check and re-review; `n` counts completed rounds; the first review with no fix is round 0. Read this field before launching a fix, and after each round write the intended next step into `Next Action`. If defects remain after that, set `Status: Blocked`, write into `Next Action` the exact question, what each answer does, and "then re-run the final gate", and stop after asking the user; the answer restores `Status: In Progress`. Only after the final gate's PASS (or that `Skip`): mark the `Final gate` row PASS unless it is `Skip`, and set `Status: Completed`; if the progress file's `**Roadmap**` names a folder (not `none`), invoke the `roadmap-tracker` skill with the event `"plan completed; no questions, return pending items"` (the tracker never blocks the run); add a tier summary (planned vs actual tier, retries, escalations) to Issues & Decisions, save non-obvious lessons to memory if available (SKILL.md Rule 8), and report to the user, including each external step with what happened to it (effect performed and review gate result, `refused`, `pre-launch review failed`) and the pending items the tracker returned (from the wave events and from the plan completed event). Do not push unless asked, except an authorized external step; per-step commits follow § Writing back.
