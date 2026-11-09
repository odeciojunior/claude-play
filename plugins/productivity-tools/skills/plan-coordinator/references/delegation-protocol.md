# Delegation Protocol (Phase 2)

## Contents

- Step lifecycle
- Wave loop
- Context layers
- Fork vs fresh vs continue
- Prompt template
- Verification
- Writing back
- Recovery after compaction or restart
- Completion

The main conversation is the orchestrator. It launches waves, checks results, writes handoffs into the progress file and moves on. It does not implement non-inline steps itself, and it does not read executor transcripts.

## Step lifecycle

This section is the only statement of step states and transitions; every other file refers to it.

**Where state lives.** A step's state is its `Status` cell in the `## Steps` table of the progress file, the `Final gate` row included. The run's state is the header `**Status**`. What a state waits on is in `## Manual Actions Required` and, for an external step, the card lines `Pre-launch review:` and `Authorized:`. `## Recovery State` holds `Wave gate owed`, `In-Flight Agents`, `Final gate rounds` and `Next Action`. The Execution Map holds structure only (waves, groups, routes). **Every read, at the start of a wave and on resume, starts with `**Status**`, `## Recovery State`, `## Steps` and `## Manual Actions Required`, then the map.** Each write below reaches the file before the action it guards, so a compaction loses nothing.

| # | State | Written by, when | Event | Next |
|---|-------|------------------|-------|------|
| 1 | `Pending` | Step 7; or a row below, before what it allows | Wave loop item 4 selects its group | `Launched` |
| 2 | `Pending` | same | Inline group: item 10 runs it | Done-means passes: `PASS`. Fails: `Pending`, re-routed off Inline per routing.md §5 step 3 |
| 3 | `Pending` | same | A manual action opens on it, or pre-flight lacks its upstream parameter | `Skip (manual)`, by Hold |
| 4 | `Pending` | same | A dependency is held, stopped or waiting | `Waiting (manual)`, by Hold |
| 5 | `Pending`, external, no `Pre-launch review:` line | same | Review (Step 8 item 4) | PASS: line written. Defects after 2 rounds: `Skip (manual)`, `Pre-launch review failed:`, no question for this step |
| 6 | `Pending`, external, reviewed, no `Authorized:` line | same | The request or an earlier answer names it; otherwise stop and ask | Named: line written, row 1. Refused: `Skip (manual)`, `Refused:`. Not named: `Skip (manual)`, `Not named:` |
| 7 | `Pending`, external, with either line | same | A card line other than `Handoff`, `Pre-launch review:` or `Authorized:` changes | `Pre-launch review:` removed, `Authorized:` too if the effect changed; row 5 |
| 8 | `Launched` | Wave loop item 4, **before** the `Agent` call | Agent still running | `Launched`: wait for its notification; after a compaction, ask it once for its report |
| 9 | `Launched` | same | Verified PASS report | No review gate: `PASS`. Review gate: `Review owed` |
| 10 | `Launched`, non-external | same | FAIL or BLOCKED (routing.md §5) | Retry: `Launched`, attempts + 1. §5 step 4: `Skip (manual)`, `Open question:` |
| 11 | `Launched`, non-external | same | No report and no live agent (§ Recovery) | Done-means passes on the card's Files: a report, through § Verification and § Writing back (row 9). Otherwise relaunched, `Launched` |
| 12 | `Launched`, external | same | FAIL, BLOCKED, or no report (no agent, no answer, `launching` with no ID); files never close it | `Stopped`, `Open question:`; stop and ask |
| 13 | `Review owed` | § Writing back, after verification and before the reviewer launches | Reviewer PASS; or reviewer lost | `PASS`; or launch the read-only review again |
| 14 | `Review owed` | same | Defects | Non-external: `Launched`, fix-up per routing.md §4. External: `Stopped`, `Open question:`; stop and ask |
| 15 | `Stopped` (external, launched once, result failed, unknown or rejected) | Rows 12, 14, 24, before the question | `it is done` | `PASS`, the user's word in Issues & Decisions |
| 16 | `Stopped` | same | `no`, `skip`, `leave it` | `Stopped`, entry becomes `Refused:`; reported as launched once, outcome unconfirmed |
| 17 | `Stopped` | same | `run it again` | `Skip`, Note `replaced by Step Nr`. New row Nr: `Pending`, external, no `Pre-launch review:` line, `Authorized:` from the answer; dependents depend on Nr |
| 18 | `Skip (manual)`, open entry | Hold, before any question | Manual action finished, or `Pre-launch review failed:` closed (authorizes nothing) | `Pending` |
| 19 | `Skip (manual)`, open entry | same | The answer names it or says run it (not a `Pre-launch review failed:` entry) | `Pending`, with `Authorized:` if external |
| 20 | `Skip (manual)`, open entry | same | `it is done` | `PASS`, the user's word in Issues & Decisions |
| 21 | `Skip (manual)`, open entry | same | `no` or `skip` | Entry becomes `Refused:`; row 22 |
| 22 | `Skip (manual)`, `Refused:` | Rows 6, 21 | A later answer names it; or Completion | Named: as row 19. Completion: stays, not run, does not hold the final gate |
| 23 | `Waiting (manual)` | Hold | Release: no dependency is held, stopped or waiting; or Completion, behind `Refused:` entries only | `Pending`; Completion: stays, not run |
| 24 | `PASS` | § Writing back, after verification, review gate, Handoff and commit | Wave gate attributes a failure to its group | Non-external: row 10. External: `Stopped`, `Open question:`; stop and ask. Otherwise terminal |
| 25 | `Skip` | Step 1 | None | Terminal; counts as done for dependents only if its outputs exist |
| 26 | `Final gate` row `Pending` | Step 7 | Completion | `PASS` after the final gate's PASS; `Skip` when no step ran |
| 27 | `Status: Map ready` | Step 7, before self-approval | Step 8 item 6 (self-approval; the map is never put to the user), or a stop in Step 8 | `In Progress`, or `Blocked` |
| 28 | `Status: In Progress` | Step 8 item 6, or an answer | Stop and ask; or Completion closes | `Blocked`; or `Completed` |
| 29 | `Status: Blocked` | Stop and ask, before the question | The answer | Apply it; `In Progress`; continue at `Next Action` |
| 30 | `Status: Completed` | After the final gate's PASS or `Skip` | None (Step 0 asks before re-running) | Terminal |

**Hold.** Write `Skip (manual)` and the entry under Manual Actions (template forms), from the moment the entry opens. Mark every step depending on a held or stopped step, directly or transitively, `Waiting (manual)`, and split any group holding both held and other steps so the others can run.

**Stop and ask.** Write the state and entry, record it in Issues & Decisions, write `Status: Blocked` and into `Next Action` the exact question, what each answer does and where to continue (default: "then re-run SKILL.md Step 8"), then ask in that same turn and stop. A second stop while one is open joins that question.

**When to ask.** An external step's question is asked at once (row 3 included). A non-external hold leaves `Status` as it is while independent groups can run; Completion asks when nothing else can.

**While `Status` is `Blocked`, nothing starts:** no launch, retry, fix-up, review gate, wave gate, Advance or external action, `SendMessage` included, except asking an in-flight agent for its report. Step 8's read-only reviews are self-approval and are not barred. Groups in flight finish and are recorded: a failure is noted in `## Steps` and joins the question, a passed report waits as `Review owed`.

**Applying an answer.** It names a step by number or title; a bare yes names every step the question listed. An answer that names nothing authorizes nothing and leaves its entries open; silence is never an answer. Record an authorization as in SKILL.md Step 8 item 4. Then release (row 23), set `Status: In Progress` and continue at `Next Action`.

**What the table guarantees.**

- No row returns a launched external step to `Pending`: it launches at most once and after launch only its result is reviewed. A non-external step may be relaunched (rows 10, 11, 14).
- Step 8 item 4 works only on `Pending` steps, so a `Launched`, `Review owed` or `Stopped` step is never treated as unauthorized.
- With no step `Pending`, `Launched` or `Review owed`, every step is terminal or held with an entry; Completion asks (an open entry not `Refused:`) or closes the run.

**Older progress files** are brought into this table before anything else (SKILL.md Step 0):

- Read the step status from `## Steps`: a legacy `In Progress` or similar is `Launched`. A map `Status` column is no longer read, and the `Final gate` row is added to `## Steps` as `Pending`. `Last DELEGATED Wave` above `Last COMPLETED Wave` becomes `Wave gate owed: <that wave>`, otherwise `none`.
- With no `External:` line, classify the unfinished steps (SKILL.md Step 1) and write the line (`External: none` if there are none) and the cards' `External: yes` lines. Then re-apply routing.md §3 to each newly external step, rewrite its card `Route` and map row, and split its group if needed (SKILL.md Step 5).
- An external step recorded as in flight enters at `Launched`; one held by an `Open question:` entry enters at `Stopped`; any other keeps its state.
- Process in-flight groups (§ Recovery), then by status at that point: `Map ready` or legacy `Awaiting approval` runs all of Step 8; `In Progress` runs Step 8 items 3 to 6; `Blocked` keeps its `Status` and `Next Action`, asks that question first, and appends "then run Step 8 items 3 to 6 before any launch".

## Wave loop

Waves are **barriers**: a wave's writing groups launch only after the previous wave's gate passed. (Read-only groups — research, review — may launch as soon as their own dependencies are done.) Nothing starts while `Status` is `Blocked` (§ Step lifecycle).

1. **Read state** as § Step lifecycle says.
2. **Pre-flight the wave:** re-apply calibration (routing.md §6); confirm no two groups in the wave share a write set, counting implicit writes (SKILL.md Step 5). A `Pending` external step launches only with both card lines and its authorization in Issues & Decisions; otherwise return to SKILL.md Step 8 item 4. A parameter the card names as coming from upstream is first written into the card from the handoff, unless the card already states it (a card change: row 7); if no handoff supplies it, hold the step (row 3) with `Open question: Step N: <missing parameter and what each answer does>`.
3. **Allow the checks:** before launching a background wave, propose allow rules for the validation commands (the Shared Brief's build/test/lint commands) to the user in the map report (SKILL.md Step 8) so permission prompts don't stall it, without waiting for an answer; never write settings yourself.
4. **Select and mark delegated:** select the groups with a `Pending` step and none `Launched` or `Review owed`, leaving out the `Final gate` row, groups with `Mode: Inline` and held groups. With no group selected, skip to item 9. Otherwise write to the file **before** launching: each selected step `Launched`, `Wave gate owed: <this wave>`, and the groups in `In-Flight Agents`.
5. **Launch the whole wave in one message:** one `Agent` call per selected group with `subagent_type`, `model: <routed tier>` and `effort` per routing.md §2-§3, a short `description`, and the prompt from the template below.
6. **Record agent IDs** in `In-Flight Agents` right after the launch returns.
7. **Wait for notifications.** Agents run in the background and notify on completion — don't poll or sleep.
8. **Verify each report** (§ Verification), then follow § Step lifecycle: write the state, launch the review gate if there is one (its agent ID in `In-Flight Agents`), write the handoff.
9. **Wave gate:** with `Wave gate owed: none` the wave advances without one. When every launched group in the wave is done (review gates included) and nothing is in flight, run the project's full check once (the build/test command from the Shared Brief). A held or stopped group counts as finished for this gate; a failure in its files is added to its Manual Actions entry and does not stop the wave. Compare the result against Baseline (SKILL.md Step 2): only a failure outside Baseline counts. If the gate fails outside Baseline, attribute it before escalating: run each group's targeted check again and diff the failing paths against each group's FILES; the owning group gets a FAIL with the gate output as evidence (row 24). If no group owns it, record it in Issues & Decisions, stop and ask.
10. **Inline steps:** in every wave, after item 3 and before item 4, with nothing in flight, run the wave's inline steps that are `Pending`, wave 1 included; a held inline step does not run. Then run their Done-means checks.
11. **Advance:** set `Wave gate owed: none`, clear `In-Flight Agents`, set `Next Action`, append a row to the Wave Execution Log; if the progress file's `**Roadmap**` names a folder (not `none`), invoke the `roadmap-tracker` skill with the event `"wave N closed (steps …); no questions, return pending items"`; the tracker never blocks the run. Keep the pending items it returns for the final report in Completion. Then start the lowest wave with a `Pending` step (the `Final gate` row aside), or go to Completion when none is left.

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

- STATUS is PASS but EVIDENCE is missing or doesn't match "Done means" → treat as FAIL (non-external: spec gap, ask the same agent via `SendMessage`; Explore/Plan: fresh agent, same tier).
- Checks that take seconds (typecheck one file, run one test file, `git diff --stat` against FILES) → run them yourself.
- FILES outside the card's allow-list → inspect before accepting; a parallel collision is likely.
- A review gate runs after verification, never instead of it.

On FAIL/BLOCKED follow § Step lifecycle (`routing.md` §5 for non-external steps).

## Writing back

After each verified (and, if gated, reviewed) step, update the progress file:

- Steps table: status, `tier · attempts`, one-line note. Record the model that actually ran: it can differ from the routed tier when `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set or `model` wasn't passed.
- Commit: when the Shared Brief's commit policy is `per step`, after the project's pre-commit checks (e.g. a validate command from the Brief), the orchestrator runs `git add -- <card files>` then `git commit -- <card files>` for each verified step and records the SHA in the step's Note. When it is `none`, the changes stay in the working tree.
- Step card: set `- **Handoff**: …` from the HANDOFF lines. Rewrite it after any review fix-up. This is what downstream prompts will use.
- Issues & Decisions: CONCERNS worth keeping, escalations, user decisions.

Keep it terse — the progress file is re-read after every compaction.

## Recovery after compaction or restart

1. Read state as § Step lifecycle says.
2. For each step `Launched` or `Review owed` (`In-Flight Agents` lists its group): if its notification already arrived in this conversation, process it. Otherwise, with an agent ID recorded, ask that agent once for its report via `SendMessage`. With no ID, no answer, or `SendMessage` refused (stopped agent), apply the no-report rows of § Step lifecycle.
3. Continue at `Next Action`, under the `Blocked` rule.

## Completion

Completion starts when no step is `Pending`, `Launched` or `Review owed` (the `Final gate` row aside).

1. **Open entries first.** If an open Manual Actions entry is not `Refused:`, stop and ask one question covering every such entry (`Open question:` entries supply their text; `Not named:` entries ask for that step's authorization), with "then re-run SKILL.md Step 8" after the manual actions.
2. **Nothing ran.** If no step ran, there is no change to review: mark the `Final gate` row `Skip` and go to item 5, without the check or the review.
3. **Full check**, compared against Baseline as in Wave loop item 9.
4. **Final gate**, a read-only reviewer at opus with `effort: high`. It gets the plan's goal and acceptance criteria, the Shared Brief, every Handoff, `git diff <Base>` and the untracked files from `git ls-files --others --exclude-standard`, and looks for what per-step reviews miss: broken contracts between steps, regressions outside the changed files, and acceptance criteria with no test. Refused steps and their dependents are named to the reviewer as not run, and their acceptance criteria are not defects; a `Stopped` step is named as launched once with its outcome unconfirmed.
   Defects go to a fresh executor at the owning step's tier, followed by a commit under the Shared Brief's policy, the full check and a new final review, at most 2 rounds; a third round runs on opus. A defect in an external step's effect goes to no executor: stop and ask. Record each round in `**Final gate rounds:** <n done> (last verdict: <PASS | defects: ...>)` in Recovery State, updated after every round. A round is one fix, commit, full check and re-review; `n` counts completed rounds; the first review with no fix is round 0. Read this field before launching a fix, and after each round write the intended next step into `Next Action`. If defects remain after that, stop and ask, with "then re-run the final gate".
5. **Close out**, only after the final gate's PASS (or that `Skip`): mark the `Final gate` row PASS unless it is `Skip`, and set `Status: Completed`; if the progress file's `**Roadmap**` names a folder (not `none`), invoke the `roadmap-tracker` skill with the event `"plan completed; no questions, return pending items"`; add a tier summary (planned vs actual tier, retries, escalations) to Issues & Decisions, save non-obvious lessons to memory if available (SKILL.md Rule 8), and report to the user, including each external step with what happened to it (effect performed and review gate result, `refused`, `pre-launch review failed`, `launched once, outcome unconfirmed`) and the pending items the tracker returned. Do not push unless asked, except an authorized external step; per-step commits follow § Writing back.
