---
name: plan-coordinator
description: "Use when executing a multi-step implementation plan from docs/plans/<topic>/plan.md with subagents and you want per-step model-tier routing (haiku/sonnet/opus by complexity), conflict-free parallel waves, and a persistent state file that survives compaction, or when resuming such a plan from that state. The orchestrator approves its own Execution Map, without human map approval. Not for ad-hoc plans without a data block (adopt them with plan-writer first)."
compatibility: "Claude Code 2.1.322 or later launches the coordinator workflow by name; older versions fall back to the script path, which works only without permission prompts or with the script folder readable."
---

# Plan Coordinator

Runs a plan as waves of subagents, each step on the cheapest tier that can do it reliably. The loop lives in the plugin workflow `productivity-tools:coordinator-workflow`; the state is code (`scripts/progress.mjs`, `progress.json` beside the plan). This session only picks the plan, creates the state, launches the workflow and relays its stops. It never edits `progress.json` and never interprets a plan in prose. Run the CLI as `node <skill dir>/scripts/progress.mjs`.

## 1. Pick the plan

Run `progress.mjs select` (add `--query <text>` when the request names a plan). A printed path is the plan. A `question` (a tie, or no plan) is the only question to ask before the launch; `no plan` offers plan-writer.

## 2. Create the state

If `progress.json` already exists beside the plan, do nothing: the workflow resumes from it. Otherwise:

- With the commit policy `per-step` on the default branch, switch to a new branch `plan/<topic>` first.
- The working tree must have no changes that are not this run's; if it does, stop and report them.
- Run `progress.mjs init <plan.md> --commits per-step|none`. A plan with no data block is refused (`plan-no-data-block`): pass the message on and stop.

## 3. Launch

Run `progress.mjs token` to get a `runToken`. Then call `Workflow` by the name `productivity-tools:coordinator-workflow` with `{ plan, state, runToken, progress, test }`: absolute paths of the plan and `progress.json`, the token, `progress` as the absolute path of `<dir>/scripts/progress.mjs` (built from the line "Base directory for this skill: <dir>", never fixed; a launch without it returns `error`), and the plan's full test command as `test`. Never pass `authorizeExternal` or `answers` on the first launch; items come only from an `authorize` stop, bound to `plan.digest`.

Only when the `Workflow` error says the name is unknown or not found, make one call with `scriptPath` = `<dir>/workflow/coordinator.js` (absolute, built from the line "Base directory for this skill: <dir>", never fixed) and the same `args`. Warn that this only works without permission prompts or with the script folder readable (for example `--add-dir`), because the plugin cache folder is not readable in the default mode. If it also fails, report both errors verbatim and stop. A permission error, a denial or any other error never tries the path: tell the person to add the rule `Workflow(productivity-tools:coordinator-workflow)` to `.claude/settings.local.json`. Report the rule; never write settings yourself.

Only when `${CLAUDE_SKILL_DIR}` is unset or the line "Base directory for this skill" is absent, take `<dir>` from the folder that holds this SKILL.md. Only when the `Workflow` tool is absent and `run_workflow` exists (Antigravity), call `run_workflow` with `ScriptPath` = `<dir>/workflow/coordinator-agy.py` and the same `Args`; there, use `ask_question` in place of `AskUserQuestion`. State keeps Claude tiers; the script translates them at dispatch.

## After the workflow returns

The workflow returns `done` or a stop (`authorize`, `ask`, `plan-changed`, `state-divergence`, `error`). Pass each stop to the person, relaunch with the same `state` and a new `runToken` plus their `authorizeExternal` or `answers`, and finish with the final report. The details are in `references/delegation-protocol.md`; the state format, events and refusal codes are in `references/state.md`.
