---
name: plan-coordinator
description: "Use when executing a multi-step implementation plan from docs/plans/<topic>/plan.md with subagents and you want per-step model-tier routing (haiku/sonnet/opus by complexity), conflict-free parallel waves, and a persistent state file that survives compaction, or when resuming such a plan from that state. The orchestrator approves its own Execution Map, without human map approval. Not for ad-hoc plans without a data block (adopt them with plan-writer first)."
---

# Plan Coordinator

Run a plan as waves of subagents, each step on the cheapest tier that can do it reliably. The state is code: `scripts/progress.mjs` reads the plan, routes and groups the steps, and records every event in `progress.json` beside the plan. The orchestrator never edits that file and never interprets a plan in prose; it asks the CLI what comes next, acts, and reports the result back as an event.

| Command | What |
|---------|------|
| `progress.mjs select [--query q]` | pick the plan: prints the path, or a `question` (tie or no plan) |
| `progress.mjs init <plan.md> [--spec s] [--commits per-step\|none] [--base sha]` | write `progress.json` and `briefs/T<n>.md`; prints the waves |
| `progress.mjs next <progress.json> --json` | the next action, read from the state |
| `progress.mjs apply <progress.json> <event> [options] --json` | record one event; prints the next action |
| `progress.mjs show <progress.json>` | status table |

Schema, events, next actions and refusal codes: `references/state.md`. Waves, prompts, verification and recovery: `references/delegation-protocol.md`. Routing rules behind the tiers: `references/routing.md`. Run the CLI as `node <skill dir>/scripts/progress.mjs`.

**Core principle:** the orchestrator's context is the scarcest resource. The state lives in `progress.json`, subagents receive one brief, and they return a short structured report, never diffs.

## Step 0: Pick the plan and resume

Run `select` (with `--query` when the request names a plan). A printed path is the plan; a `question` is the only time to ask the person, with its candidates. `no plan` offers to write one with plan-writer. If `progress.json` already exists beside the plan, run `next` and continue Phase 2 at that action; do not rebuild anything. `plan-changed` means the plan was edited after `init`: report it and ask whether to restart.

Default for a plan whose state says `completed`: it does not run again. `init --restart` recreates the state only when the person asks for it.

## Step 1: Init and the map

1. In a git repository, work in the plan's worktree or branch. When the commit policy is `per-step` and the branch is the default one, create and switch to `plan/<topic>` first. Never push, except an authorized external step.
2. Run `init <plan.md>` with `--commits per-step` when the request or the plan calls for commits, else `none`. A plan with no data block is refused with `plan-no-data-block`: pass that message on and stop; do not read or convert the plan yourself.
3. The `init` output is the Execution Map (one line per wave: step, tier/effort, gate, external). Steps whose outputs already exist and whose check passes get `apply skip --step n --value outputs`, before approval.
4. Measure the Baseline by running the plan's full test command once in the working tree; keep it in `baseline.md` beside the state. A failure already listed there is pre-existing; only a failure outside it counts at a gate.
5. Self-approve: `apply approve-map`. The map is never put to the person for approval. Report it in one message that does not wait: waves, steps per tier, gates, external steps, held steps.

## Phase 2: Run

Loop until `next` says `done`: `next`, act, `apply <event>`. What each action means, and the prompt, verification and recovery rules, are in `references/delegation-protocol.md`.

Stops that remain, each recorded with `apply block --text <question>` before asking and closed by `unblock` or the answer event:

- an external effect (`authorize`): ask once, listing every step awaiting it, unless the request already names the step as authorized;
- a manual action: a credential, an access or an approval only the person can give;
- a working tree with changes that are not this run's;
- a plan tie or no plan (Step 0), and a restart request.

Nothing else is asked. A failed step is repeated by the CLI's own rules; a defect is a fix-up round, not a question.

## Rules

1. **Map before running.** No launch before `approve-map`.
2. **The state is the source of truth.** Read it with `next`; a refused event changes nothing.
3. **Cheapest reliable tier.** The tier is the CLI's; raise it only with `launch --tier`, never lower it.
4. **No write collisions** inside a wave: the CLI groups waves by declared writes; do not launch groups outside what `launch` lists.
5. **One brief per step.** Executors read `briefs/T<n>.md`, never the plan. Pass paths and signatures, not file contents.
6. **Default permissions.** Executors run under the session's permission mode. If a command is denied, report it; never ask the person to switch modes as a shortcut.
7. **Be transparent.** Show how steps were routed and where information was thin.
8. **Learn.** At completion, if a memory tool or directory is available, save only non-obvious lessons.
