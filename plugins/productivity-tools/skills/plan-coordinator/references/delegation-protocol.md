# Delegation Protocol (Phase 2)

The main conversation is the orchestrator. It launches waves, checks results, writes handoffs into the progress file and moves on. It does not implement non-inline steps itself, and it does not read executor transcripts.

## Wave loop

Waves are **barriers**: a wave's writing groups launch only after the previous wave's gate passed. (Read-only groups — research, review — may launch as soon as their own dependencies are done.)

1. **Read state:** `## Recovery State` + the Execution Map table of the progress file.
2. **Pre-flight the wave:** re-apply calibration (routing.md §6); confirm no two groups in the wave share a write set, counting implicit writes (SKILL.md Step 5).
3. **Mark delegated:** set `Last DELEGATED Wave` and list the groups in `In-Flight Agents` (e.g. `Group C (Steps 3-5, sonnet): launching`) **before** launching, so a compaction mid-launch is recoverable.
4. **Launch the whole wave in one message:** one `Agent` call per group with `subagent_type`, `model: <routed tier>` (always, except `fork` and kept frontmatter pins — routing.md §3), a short `description`, and the prompt from the template below.
5. **Record agent IDs** in `In-Flight Agents` right after the launch returns — they are what `SendMessage` needs after a compaction.
6. **Wait for notifications.** Agents run in the background and notify on completion — don't poll or sleep.
7. **Verify each report** (§ Verification), launch its review gate if it has one, then write the handoff and status per step.
8. **Wave gate:** when every group in the wave is done (review gates included) and nothing is in flight, run the project's full check once (the build/test command from the Shared Brief). Executors only run their targeted checks. If the gate fails, attribute it before escalating: run each group's targeted check again and diff the failing paths against each group's FILES; the owning group gets a FAIL with the gate output as evidence. If no group owns it, record it in Issues & Decisions and ask the user.
9. **Inline steps:** run the next wave's inline steps now — between waves, with nothing in flight — then run their Done-means checks.
10. **Advance:** update `Last COMPLETED Wave`, clear `In-Flight Agents`, set `Next Action`, append a row to the Wave Execution Log, start the next wave.

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
- **No plan file.** Executors never read the plan; if they'd need it, the card is incomplete — fix the card.

## Fork vs fresh vs continue

| Situation | Use |
|-----------|-----|
| Normal step, everything needed is in brief + card | **Fresh** agent of the routed type and tier |
| Needs decisions or discoveries that only exist in this conversation, and writing them down would be longer than the step | **`fork`** (inherits full context and the orchestrator's model — expensive; prefer writing the missing facts into the Shared Brief) |
| Review fix-ups, a clarification, or a same-tier retry of the same step | **`SendMessage`** to the same agent — finished agents can be continued; they keep their context |
| Retry after escalation to a higher tier | **Fresh** agent at the new tier, with the failed report attached |

Don't use `isolation: "worktree"` for plan steps: their changes land on a separate branch that the wave gate and downstream agents never see.

## Prompt template

```text
<Shared Brief — verbatim>

## Your task: Step {N} — {title}
{step card: goal, files to create/modify, inputs, constraints}

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
- Do not commit unless this card says so.

## Report (reply with exactly this, ≤25 lines, no diffs)
STATUS: PASS | FAIL | BLOCKED
FILES: <paths changed>
EVIDENCE: <command> → <result line>
HANDOFF: <≤5 lines: what now exists and how downstream steps use it — paths, exported names, signatures, env/config keys>
CONCERNS: <anything the orchestrator should know, or "none">
```

## Verification

Trust the evidence, not the claim.

- STATUS is PASS but EVIDENCE is missing or doesn't match "Done means" → treat as FAIL (spec gap: ask the same agent via `SendMessage`).
- Checks that take seconds (typecheck one file, run one test file, `git diff --stat` against FILES) → run them yourself.
- FILES outside the card's allow-list → inspect before accepting; a parallel collision is likely.
- A review gate runs after verification, never instead of it.

On FAIL/BLOCKED follow the escalation ladder in `routing.md` §5.

## Writing back

After each verified (and, if gated, reviewed) step, update the progress file:

- Steps table: status, `tier · attempts`, one-line note.
- Step card: set `- **Handoff**: …` from the HANDOFF lines. Rewrite it after any review fix-up. This is what downstream prompts will use.
- Issues & Decisions: CONCERNS worth keeping, escalations, user decisions.

Keep it terse — the progress file is re-read after every compaction.

## Recovery after compaction or restart

1. Read only `## Recovery State` and the Execution Map table.
2. For each in-flight group: if its notification already arrived in this conversation, process it. Otherwise, if an agent ID is recorded, ask that agent for its report via `SendMessage`. If there's no ID or no answer, check the step card's **Files** list for changes (`git status`/`git diff --stat`) and re-run the card's Done-means check: pass → write the handoff from the files and mark it done; fail or no changes → relaunch the step.
3. Continue at `Next Action`.

## Completion

When every step is PASS or intentionally skipped: run the full check, set `Status: Completed`, add a tier summary (planned vs actual tier, retries, escalations) to Issues & Decisions, save non-obvious lessons to memory if available (SKILL.md Rule 8), and report to the user. Do not commit or push unless the user asked.
