---
name: roadmap-release
description: "Use when the user wants to run several roadmap deliverables (E<n>) from a tracked roadmap folder docs/plans/roadmap-*/ unattended and merged into a release branch, or says \"run E18\", \"execute the next deliverables\", \"release dry-run\", \"plan-only E19\", \"resume the release run\". Not for one plan with one deliverable (use plan-coordinator). Not for creating a roadmap (use roadmap-planner) or updating its tracking files by hand (use roadmap-tracker)."
---

# Roadmap Release

Runs one or more deliverables of a tracked roadmap through the bundled Workflow script `workflow/roadmap-release.js`, then verifies the outcome with `git` itself. Action kinds, resuming and integrity alerts are in [references/operator.md](references/operator.md); the config format is in [references/config.md](references/config.md).

## Rules

- The workflow never asks the user during execution. The only questions this skill may ask are: the roadmap-folder clarification in step 1, one stop before any agent runs (step 2), where preflight `errors` and `missingRules` are reported together, and, after the run, whether to use a `resumeWith`.
- Never push. Never edit settings files (`settings.json`, `settings.local.json`); only show the rules to add.
- Never touch the integration branch unless the user passed `allowIntegrationBranch`.
- Never record human acts (credentials, acceptance, go/no-go) as done. Only the person does them.
- Never add `acceptIntegrityAlerts` yourself or derive it from `doNow`. Include it only when the person's own message states it with the deliverable and the full SHA, copied verbatim. If it is already in `resumeArgs` because a person added it, keep it unchanged.
- Never relay an agent's claim without checking it (step 5).

## Steps

1. **Locate the roadmap folder.** It is the `docs/plans/roadmap-*/` folder that holds `roadmap.config.json`. If there are several, use the one the user named; otherwise ask once. Let `repo` be `git -C <roadmap-folder> rev-parse --show-toplevel` and `roadmap` the folder relative to `repo`, with `/`.
2. **Preflight.** First resolve the target (step 3 order) and run `node <dir>/scripts/preflight.mjs <roadmap-folder> --ref <target>`, where `<dir>` is this skill's base directory. When the target already holds a `release.config.json`, that file is used as is, with `generated` taken from its content; otherwise it falls back to the working tree or a derived config. The script prints `{configPath, generated, errors, missingRules, config}`, exits 1 when `errors` is non-empty and never writes anything.
   - `errors` non-empty, or `missingRules` non-empty in `mode: "run"`: stop once, before any agent, and show both together. Show `errors` as printed. Show `missingRules` as the exact rules, one per line, for the person to add to their permissions. Do not edit any settings file and do not call the Workflow.
   - After their reply, re-run preflight once. `errors` non-empty: report and end. `missingRules` empty: continue. `missingRules` still non-empty: continue only if the person said explicitly to go on without those rules (for example, permissions are granted another way), and state this in the report; otherwise end. Never stop a second time for the same rules.
   - In `dry-run` and `plan-only`, do not stop on `missingRules`: report them after the run.
   - Both empty: continue without asking.
3. **Generated config.** Skip this step unless `generated` is true and `mode` is `run` or `plan-only`; in `dry-run` pass `config` only in memory. Target = `args.targetBranch`, else `releaseBranch` from `release.config.json` if present, else `releaseBranch` from `roadmap.config.json`, else `integracao/<slug>`. Base = `args.baseBranch`, else the roadmap's `integrationBranch`. If the target equals `integrationBranch` and `allowIntegrationBranch` was not passed, stop and report; commit nothing. If `git worktree list --porcelain` shows the target checked out, write and commit there only if it is clean; otherwise stop and report. If it is not checked out, use a temporary worktree outside `repo` and outside the workflow's worktree root, created from the base when the target does not exist; write `config` to `<worktree>/<roadmap>/release.config.json`, commit only that file, and remove the worktree. The user's checkout stays untouched. Then go on without asking: the run uses `maxParallel: 1` until a person reviews the file and removes `generated: true` (operator.md).
4. **Run the workflow.** Call the `Workflow` tool with `scriptPath` and `args` set to the user's args plus `config` (from preflight), `repo` and `roadmap`. Always pass all three, including on resume. The path is `<dir>/workflow/roadmap-release.js` (absolute), built from the line "Base directory for this skill: <dir>" printed when this skill loads. Never hardcode it. Map the request to args:
   - ids named by the user: `{"deliverables":["E18"]}`; use an explicit list only when the user named ids.
   - "all deliverables": `{"deliverables":"all"}`. `"next"` (the default) runs open cards whose dependencies are met or selected; `"ready"` only those met now.
   - "dry run" / "plan only": `{"mode":"dry-run"}` / `{"mode":"plan-only"}`; a phase: `{"phase":"r1-1"}`; a branch: `{"targetBranch":"release/2026-11-24"}`.
   - Resume: pass the returned `resumeArgs`, replacing `config` with the one from the new preflight, plus `notes` when the run asked for an answer.
5. **Verify with direct git.** The result has `status` (`done`, `partial`, `needs-operator`, `error`), `selection`, `results`, `truth`, `lastGood`, `operatorActions`, `resumeArgs` and `reportPath`. Use the target from step 3 (or `selection.target`) and `git -C <repo>`. A git failure, including an absent branch, is a divergence.
   - Head: `<target>` equals `truth.targetHead`, or `truth.targetHead` is its ancestor and `git diff --name-only truth.targetHead <target>` lists only `reportPath` (the report is committed after the truth is measured).
   - Merges: each id in `truth.mergedIds` has a newest first-parent subject starting with `merge:`, not a revert: `git log --first-parent <target> -1 --format=%s -E --grep '^(Revert "merge: <id> |merge: <id> )'`. A nonzero exit is a divergence. An empty `mergedIds` passes.
   - Clean: find the worktree whose `branch` is `refs/heads/<target>` in `git worktree list --porcelain` and run `git -C <path> status --porcelain`; it must be empty when `truth.clean` is true. No such worktree means unverified; report it.
   - Last good: `git merge-base --is-ancestor <lastGood> <target>` exits 0.
   - `truth` null in any mode or status (`plan-only`, preflight failure, budget stop, `dry-run`, `error`): report "not verified by the run" and run only the head check, if a target exists. A `dry-run` stops after selection, with no merges: report the selection only. A `status: error` result carries `error`; report it as is.
6. **Report.** Give the status, the per-deliverable outcome, every divergence you found (a divergence outranks any agent claim), then the `operatorActions`, deduplicated on `kind` + `deliverable` + `doNow` and in order, each with its `doNow` and, when present, `resumeWith`. The report lives on the target: `git show <target>:<reportPath>`. Offer a `resumeWith` to the person and run it only on their go-ahead. State plainly that merging the target into the integration branch and the push are for the owner.
