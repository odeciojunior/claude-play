---
name: roadmap-release
description: "Use when the user wants to run several roadmap deliverables (E<n>) from a tracked roadmap folder docs/plans/roadmap-*/ unattended and merged into a release branch, or says \"run E18\", \"execute the next deliverables\", \"release dry-run\", \"plan-only E19\", \"resume the release run\". Not for one plan with one deliverable (use plan-coordinator). Not for creating a roadmap (use roadmap-planner) or updating its tracking files by hand (use roadmap-tracker)."
---

# Roadmap Release

Runs one or more deliverables of a tracked roadmap through the bundled Workflow script `workflow/roadmap-release.js`, then verifies the outcome with `git` itself. Failure kinds, resuming and integrity alerts are in [references/operator.md](references/operator.md); the config format is in [references/config.md](references/config.md).

## Rules

- The workflow never asks the user during execution. This skill stops at most once, before any agent runs, and only for preflight problems (step 2).
- Never push. Never edit settings files (`settings.json`, `settings.local.json`); only show the rules to add.
- Never touch the integration branch unless the user passed `allowIntegrationBranch`.
- Never record human acts (credentials, acceptance, go/no-go) as done. Only the person does them.
- Never add `acceptIntegrityAlerts` to the args, and never tell an agent to. Only a person adds it, after deciding (see operator.md).
- Never relay an agent's claim without checking it (step 5).

## Steps

1. **Locate the roadmap folder.** It is the `docs/plans/roadmap-*/` folder that holds `roadmap.config.json`. If there are several, use the one the user named; otherwise ask once.
2. **Preflight.** Run `node <dir>/scripts/preflight.mjs <roadmap-folder>`, where `<dir>` is this skill's base directory. It prints `{configPath, generated, errors, missingRules, config}`, exits 1 when `errors` is non-empty and never writes anything.
   - `errors` non-empty: stop and show them. Do not call the Workflow.
   - `missingRules` non-empty: stop once and show the exact rules, one per line, for the person to add to their permissions. Do not edit any settings file. Resume after they confirm.
   - Otherwise continue without asking.
3. **Generated config.** If `generated` is true, write `config` to `configPath` and commit it on the target branch (`release.config.json` only), then go on without asking. The run uses `maxParallel: 1` until a person reviews the file and removes `generated: true` (operator.md). If the target branch does not exist yet, create it from `baseBranch` first.
4. **Run the workflow.** Call the `Workflow` tool with `scriptPath` and `args` set to the user's args plus `config` (the object from preflight). The path is `<dir>/workflow/roadmap-release.js` (absolute), built from the line "Base directory for this skill: <dir>" printed when this skill loads. Never hardcode it. Typical args:
   - `{"deliverables":["E18"],"targetBranch":"release/2026-11-24"}`
   - `{"deliverables":"next","phase":"r1-1"}`
   - `{"mode":"dry-run"}` and `{"mode":"plan-only","deliverables":["E19"]}`
   - Resume: pass the returned `resumeArgs`, plus `notes` when the run asked for an answer.
5. **Verify with direct git.** The result has `status` (`done`, `partial`, `needs-operator`, `error`), `results`, `truth`, `operatorActions` and `resumeArgs`. Check against `truth` yourself, in the repository, before reporting:
   - `git rev-parse <targetBranch>` equals `truth.targetHead`.
   - Each id in `truth.mergedIds` has a first-parent merge commit on the target, not later reverted: `git log --first-parent <targetBranch> --grep "^merge: <id> "`. Ids in `notMergedIds` have none.
   - The target worktree is clean (`git status --porcelain` empty) when `truth.clean` is true, and the validated tip is an ancestor of the target.
   - A `status: error` result carries `error` and no truth; report it as is.
6. **Report.** Give the status, the per-deliverable outcome, every divergence you found (a divergence outranks any agent claim), then the `operatorActions`, deduplicated and in order, each with its `doNow` and, when present, `resumeWith`. The person may be offered a `resumeWith`; run it only on their go-ahead. Point to `reportPath`. State plainly that merging the target into the integration branch and the push are for the owner.
