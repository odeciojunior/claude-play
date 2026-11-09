# Operator guide

What to do with the actions a `roadmap-release` run returns.

## Contents

- Failure kinds
- Resuming a run
- Integrity alerts
- Releasing parallelism on a generated config

## Failure kinds

Each entry of `operatorActions` has `kind`, `deliverable`, `what`, `doNow` and `resumeWith` (the args to run again, or null). The failure of one deliverable stops only that deliverable, not the others.

| Kind | Meaning | Typical action |
|---|---|---|
| `infra` | Environment or tooling failed: null agent, broken integration worktree, low budget, gates that could not run. | Fix the environment and run again with `resumeWith`. Stages already done (spec, plan, commits) are reused. |
| `conteudo` | A defect the review loop could not fix within `maxFixRounds`, or a fix that stayed blocked. | Read the review log on the deliverable branch, adjust the spec or plan or give an instruction in `notes`, and run again. |
| `decisao` | The work would contradict a recorded decision (DEC). | Decide: write a new DEC or revise the existing one, then run again with the decision in `notes`. |
| `humano` | A step needs a human: blocking input, or acceptance criteria that need a human act (credentials, acceptance, go/no-go). | Do the act yourself. Nothing records it for you. Then run again. |

Some actions are not tied to a deliverable (`preflight:*`, `integration`, `divergence`, `report`). They tell you to check the target branch by hand or to fix the environment before any deliverable runs.

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
