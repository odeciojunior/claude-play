# Operator guide

What to do with the actions a `roadmap-release` run returns.

## Contents

- Action kinds
- Resuming a run
- Integrity alerts
- Releasing parallelism on a generated config

## Action kinds

Each entry of `operatorActions` has `kind`, `deliverable`, `what`, `doNow` and `resumeWith` (the args to run again, or null). A failure in one deliverable stops only that deliverable.

| Kind | Meaning | What to do |
|---|---|---|
| `preflight:<errorKind>` | The preflight agent failed (`dirty`, `setup`, `other`). No deliverable ran. | Clean the integration worktree, fix the setup command or the environment, run again. |
| `preflight:baseline-invalid` | The baseline measure was unusable. | Fix the environment and run again. |
| `preflight:red-baseline` | The baseline of the target is red. | Fix the target, or pass `acceptRedBaseline: true` if a person accepts it. |
| `infra` | Environment or tooling failure in a deliverable (null agent, unexpected error). | Run again with `resumeWith`; spec, plan and commits are reused. |
| `defect` | The review loop could not fix a content defect within `maxFixRounds`. | Read the review log on the deliverable branch, adjust the spec or plan or add an instruction in `notes`, run again. |
| `decision` | The work would contradict a recorded decision (DEC). | Decide (new DEC or revision), then run again with the decision in `notes`. |
| `human-input` | A step needs data or a decision from a person. | Provide it in `notes` and run again. |
| `human-act` | Merged or planned deliverable has criteria that need a human act (credentials, acceptance, go/no-go). | Do the act and record it yourself. Nothing records it for you. |
| `merge-rejected` | The merge is on the target but failed validation or could not be validated; later merges stop. | Fix on the target and run again with the deliverable, or undo with `git revert -m 1 <merge>` as `doNow` says. |
| `docs` | Docs or roadmap are inconsistent after a merge. | Fix the record and run the roadmap checker on the target. |
| `integration` | The integration worktree is dirty or compromised. | Follow `doNow` (clean it, or reset it to the pre-merge SHA), then run again. |
| `divergence` | The git truth disagrees with what agents claimed. | Check `git log` and `git status` of the target by hand. |
| `report` | The report agent returned nothing. | Rebuild the report from the result. |

The internal failure class (`infra`, `conteudo`, `decisao`, `humano`) shows up only in `results[].failKind` and in the "blocked" status the run records for a stopped deliverable; `conteudo` becomes the `defect` action and `decisao` the `decision` action.

## Resuming a run

The result carries `resumeArgs`, the args to pass back. Run the Workflow again with them:

- `deliverables` narrows to the ones still open. A merge already on the target without its post-merge status is finished as validate-and-document, not redone.
- `notes` is `{ "E19": "owner instruction or answer" }`. Put the real answer there. Leaving the template text in place is rejected.
- `overrideDonot`, `acceptRisks` and `acceptRedBaseline` are decisions of the person. Add them only when the person asked for them.

## Integrity alerts

The run measures test integrity after each merge (deleted tests, removed asserts, skips added, production changed without asserts). Hard alerts make the merge fail and be rolled back.

- Acknowledge: if a person decides the alert is legitimate, they run again with `acceptIntegrityAlerts: { "E18": "<full merge SHA>" }`. It applies only to exactly that merge of that deliverable; another SHA is ignored, and the alerts then become a concern in the report.
- Revert: if the alert is a real regression, revert the merge on the target (`git revert -m 1 <merge SHA>`), then fix the deliverable and run again.

`acceptIntegrityAlerts` is never added by the skill or by any agent. A person adds it, after reading the alerts and deciding.

## Releasing parallelism on a generated config

A config derived by the preflight carries `generated: true`, and the run uses `maxParallel: 1` because an undetected shared resource would corrupt parallel runs. To release it:

1. Review `locks` and each gate's `needsLock` in `release.config.json`. Every shared resource (a database, a port, a cache) needs a lock, and each gate or task that uses it must name it.
2. Remove `"generated": true` and commit the file on the target branch.
3. Run again. `maxParallel` now applies (default 3, or the value in the config or args).
