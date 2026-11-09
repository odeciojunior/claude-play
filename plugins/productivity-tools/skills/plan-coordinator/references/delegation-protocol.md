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

1. **Read state:** `## Recovery State` + the Execution Map table of the progress file.
2. **Pre-flight the wave:** re-apply calibration (routing.md §6); confirm no two groups in the wave share a write set, counting implicit writes (SKILL.md Step 5). A group with an `External: yes` step whose status is not `Skip (manual)` or `Waiting (manual)` launches only if Issues & Decisions holds that step's authorization and its card has the `Authorized:` line; otherwise stop and return to SKILL.md Step 8 item 4.
3. **Allow the checks:** before launching a background wave, propose allow rules for the validation commands (the Shared Brief's build/test/lint commands) to the user in the map report (SKILL.md Step 8) so permission prompts don't stall it, without waiting for an answer; never write settings yourself.
4. **Mark delegated:** set `Last DELEGATED Wave` and list the groups in `In-Flight Agents` (e.g. `Group C (Steps 3-5, sonnet): launching`) **before** launching, so a compaction mid-launch is recoverable.
5. **Launch the whole wave in one message:** leave out the `Final gate` row, groups with a `Skip (manual)` or `Waiting (manual)` step, and groups whose steps are all already PASS; one `Agent` call per remaining group with `subagent_type`, `model: <routed tier>` (always, except `fork` and kept frontmatter pins — routing.md §3), `effort` per routing.md §2 (haiku `low`, sonnet `medium`, a step scored 6–10 on sonnet `high`, opus `medium`), a short `description`, and the prompt from the template below.
6. **Record agent IDs** in `In-Flight Agents` right after the launch returns — they are what `SendMessage` needs after a compaction.
7. **Wait for notifications.** Agents run in the background and notify on completion — don't poll or sleep.
8. **Verify each report** (§ Verification), launch its review gate if it has one, then write the handoff and status per step.
9. **Wave gate:** a wave with no launched group advances without a gate. When every launched group in the wave is done (review gates included) and nothing is in flight, run the project's full check once (the build/test command from the Shared Brief). Executors only run their targeted checks. If the gate fails, attribute it before escalating: run each group's targeted check again and diff the failing paths against each group's FILES; the owning group gets a FAIL with the gate output as evidence. If no group owns it, record it in Issues & Decisions and ask the user. Before asking the user, set `Status: Blocked` and write the exact question and what each answer does into `Next Action`; the answer restores `Status: In Progress`.
10. **Inline steps:** run the next wave's inline steps now — between waves, with nothing in flight — then run their Done-means checks.
11. **Advance:** update `Last COMPLETED Wave` (a wave with no launched group leaves it unchanged), clear `In-Flight Agents`, set `Next Action`, append a row to the Wave Execution Log; if the progress file's `**Roadmap**` names a folder (not `none`), invoke the `roadmap-tracker` skill with the event "wave N closed (steps …)"; then start the next wave.

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
{step card: goal, files to create/modify, inputs, constraints, and its `External:` and `Authorized:` lines when present}

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
- Never push, deploy or cause any other external effect (production, e-mail or messages, shared data, someone's checkout) unless this card has `External: yes` and an `Authorized:` line; then do it exactly as the card says, once.

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
3. An external step that is in flight or failed is never relaunched or retried automatically, including review fix-ups and escalation: its effect may already have happened and leaves no file to inspect. Record it, set `Status: Blocked` and ask, unless its card states an idempotence check.
4. Continue at `Next Action`.

## Completion

When only `Skip (manual)` and `Waiting (manual)` steps remain besides finished ones: set `Status: Blocked`, set `Next Action` to re-run SKILL.md Step 8 after the manual actions, and ask the user for them. Before asking the user, set `Status: Blocked` and write the exact question and what each answer does into `Next Action`; the answer restores `Status: In Progress`. When every step is PASS or intentionally skipped: run the full check, then the **final gate**, a read-only reviewer at opus with `effort: high`. It gets the plan's goal and acceptance criteria, the Shared Brief, every Handoff, `git diff <Base>` and the untracked files from `git ls-files --others --exclude-standard`, and looks for what per-step reviews miss: broken contracts between steps, regressions outside the changed files, and acceptance criteria with no test. Defects go to a fresh executor at the owning step's tier, followed by a commit under the Shared Brief's policy, the full check and a new final review, at most 2 rounds; a third round runs on opus. Record each round in `**Final gate rounds:** <n done> (last verdict: <PASS | defects: ...>)` in Recovery State, updated after every round, so a compaction does not restart the count. If defects remain after that, set `Status: Blocked`, set `Next Action` to re-run the final gate after the user's decision, and stop after asking the user. Before asking the user, set `Status: Blocked` and write the exact question and what each answer does into `Next Action`; the answer restores `Status: In Progress`. Only after the final gate's PASS: mark the `Final gate` row PASS and set `Status: Completed`; if the progress file's `**Roadmap**` names a folder (not `none`), invoke the `roadmap-tracker` skill with the event "plan completed"; add a tier summary (planned vs actual tier, retries, escalations) to Issues & Decisions, save non-obvious lessons to memory if available (SKILL.md Rule 8), and report to the user. Do not push unless asked, except an authorized external step; per-step commits follow § Writing back.
