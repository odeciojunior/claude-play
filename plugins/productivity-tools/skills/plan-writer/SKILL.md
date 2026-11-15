---
name: plan-writer
description: "Use when the person wants the implementation plan for a checked spec/1 design spec (from spec-writer), or wants an old plan that has no data block adopted into the plan/1 format (adoption mode). Resolves the roadmap folder, dispatches the plan-author agent and shows the summary. Not for writing specs (spec-writer). Not for roadmaps (roadmap-planner). Not for executing a plan (plan-coordinator)."
argument-hint: "<spec.md or plan.md> [--roadmap <folder>]"
---

# Plan writer

Turn a spec into a checked `plan/1` plan, or adopt an old prose plan into that format, in one agent call. The mode comes from the file you receive; you never ask which one. This skill does not commit and never commits; the person does.

`planTool` is `${CLAUDE_SKILL_DIR}/../../scripts/plan-tool.mjs` (absolute path; if `${CLAUDE_SKILL_DIR}` is empty, use the folder this SKILL.md was loaded from). Always quote it: `node "<planTool>" check "<plan>"`. Spec checks use `spec-tool.mjs` in the same folder.

## Roadmap folder

Resolve the value before dispatching, without asking, from the first source that exists:

1. `--roadmap <folder>` in the call. A folder without `roadmap.config.json`: stop and report, dispatch nothing.
2. Adoption mode only: the `**Roadmap:** <folder>` line in the old plan's header.
3. The spec folder named `<name>-E<n>`: `docs/plans/<name>/`, else `docs/plans/roadmap-<name>/`, accepted only if it has `roadmap.config.json`, the spec block `id` is `E<n>`, and `node "<specTool>" check "<spec>" --roadmap <folder>` exits 0.
4. None: `null` (spec outside a roadmap).

Normalize the value (relative to the repository root, `/` separators, ending in `/`) and pass it as `roadmap` in every mode. A source 2 or 3 that points to a folder without `roadmap.config.json`, or whose card does not match, is never used silently: write `null`, and say in the report (and in the adoption approval text) which pointer was found and why it was dropped. After the write, check that `roadmap` in the written block equals the resolved value; if not, report a failure.

## Modes

- **Spec** (the block has `schema: "spec/1"`): write mode. `output` is `<spec folder>/plan.md`. If the spec has a blocking person item (`node "<specTool>" summary "<spec>" --json`, field `stops`), stop and show the summary, dispatch nothing. A spec without a `spec/1` block: do not guess; report the `spec-tool check` error and point to `spec-writer`. If `plan.md` already has a data block, run `node "<planTool>" check "<plan.md>"` and report, without rewriting, unless the person asked for it in the call. Otherwise dispatch the agent with `mode: interactive`. No approval step: report the path, the roadmap folder written (or that the plan has no roadmap, so plan-coordinator will not call the tracker), the output of `node "<planTool>" summary "<plan.md>" --lang <pt|en>`, and offer execution with `plan-coordinator`.
- **Old plan without a data block** (any origin): adoption mode.
  1. Find the spec, first match wins: the spec named by the person in the call; the spec cited in the plan; a `spec/1` spec beside the plan; the card's spec, `docs/plans/<name>-E<n>/spec.md` where `docs/plans/<name>/` is the resolved roadmap folder, or `docs/plans/<x>-E<n>/spec.md` when the roadmap folder is `docs/plans/roadmap-<x>/`, and `E<n>` the card the old plan names, accepted only if its block `id` is `E<n>` and `node "<specTool>" check "<spec>" --roadmap <folder>` exits 0. A candidate that does not exist, has no `spec/1` block or fails those checks counts as none (say so in the report). Only with none, dispatch `productivity-tools:spec-author` in the foreground with one `key: value` per line: `mode: interactive`, `output` (absolute path of `docs/plans/<topic>/spec.md`), `specTool` (absolute), `topic` (kebab-case from the plan title), `language` (the person's) and `intake` last (the old plan and any design it cites). That spec gets no separate approval; its summary joins the one adoption approval.
  2. Dispatch the agent with `mode: adopt`, `source` = the old plan, the resolved `roadmap` (the old `**Roadmap:**` line becomes the block field) and `output` = the old plan's path with its final `.md` replaced by `.adopted.md` (`plan.md` becomes `plan.adopted.md`), a provisional sibling file. If `output` already exists, stop and report it; dispatch nothing. The original stays intact.
  3. First run `node "<planTool>" check "<output>"` on the provisional file; if it fails, report its output, delete the provisional file (the original stays unchanged) and do not ask for approval. Then hold the `## Adoção` table against the whole old plan and the data block: a missing row for an old step, a new task or a `constraints` item, a structured-field difference (files, deps, checks, tier, locks, external, commit) between an old step and its task with no row, or a false origin (something called "became", "kept" or "carried over", or quoted from the old plan, that the old plan does not contain) is a defect. Re-dispatch the agent once with the same fields and the defect list at the end of `intake`, then repeat this step without re-dispatching; if a defect persists, report it as a failure, delete the provisional file and do not ask for approval. Then show the `## Adoção` section (the author's summary), the full record `git diff --no-index -- "<original>" "<provisional>"` (exit 1 only means the files differ; over 200 lines, its `--stat` plus the command to see it whole; without git or permission to run it, give both paths, which is not a failure), the roadmap folder in the block with its origin (argument, old header, spec folder, or the pointer that was dropped and why) and `node "<planTool>" summary "<output>" --lang <pt|en>`. In your own message, before the `AskUserQuestion` call, paste literally and in this order: the `## Adoção` section, the `--stat` plus the command to see the diff whole (when the diff is over 200 lines) or the full diff, the roadmap folder with its origin, and the output of `summary`; do not summarize or paraphrase any of them (Bash output alone is not shown). Then ask for one approval in a single `AskUserQuestion` call: approve or refuse. If `AskUserQuestion` is not available, write the question as a message that starts with `APPROVAL QUESTION:`, stop, and keep the provisional file; never move it without an explicit answer.
  4. Approve: move the provisional file over the original (same path), then run `node "<planTool>" check "<final path>"` only to confirm and report it; nothing is deleted after the move. Refuse: delete the provisional file; the original stays unchanged.
- **Plan with a data block**: report `node "<planTool>" check "<plan>"`; nothing to adopt.

`--lang` is `pt` if the person writes in Portuguese, otherwise `en`.

## Dispatch

Use the Agent tool in the foreground (never in the background; wait for the result) with `subagent_type: "productivity-tools:plan-author"`, one `key: value` per line: `mode`, `output` (absolute), `planTool` (absolute), `spec` (absolute), `language` (the person's), `roadmap`, `source` (adopt only) and `intake`, always last, which may span several lines (the person's request, guesses marked as guesses). If the author's last message is a `check --json` with errors instead of the `emit` JSON (it stops after three runs), show those errors and stop: no approval, no final write, and in adoption delete the provisional file.

## Refusals

- Agent not found (plugin not reloaded): report the error literally and ask for `/reload-plugins`. Do not paste the agent body into the prompt.
- Permission denied running a tool script: show the exact rule, by script name with no version in the path, for the person to add: `Bash(node *plan-tool.mjs" *)` (and `Bash(node *spec-tool.mjs" *)` for spec checks). Never edit settings and never suggest running without permission checks.
