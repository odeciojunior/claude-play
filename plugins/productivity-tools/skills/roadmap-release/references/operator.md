# Operator guide

What to do with the actions a `roadmap-release` run returns.

## Contents

- Action kinds
- Authorizing external effects
- Resuming a run
- Integrity alerts
- Releasing parallelism on a generated config

## Action kinds

Each entry of `operatorActions` has `kind`, `deliverable`, `what`, `doNow` and `resumeWith` (the args to run again, or null). A failure in one deliverable stops only that deliverable.

| Kind | Meaning | What to do |
|---|---|---|
| `preflight:<errorKind>` | The preflight agent failed (`dirty`, `setup`, `other`). No deliverable ran. | Clean the integration worktree, fix the setup command or the environment, run again. |
| `preflight:baseline-invalid` | The baseline measure was unusable. | Fix the environment and run again. |
| `preflight:red-baseline` | The baseline of the target is red. | Fix the target, or pass `acceptRedBaseline: true` if a person accepts it. A `tests` gate that measured no tests is not offered this: fix its command or set `kind: exit`. |
| `unfinished-merge` | A merge on the target has no post-merge status and is outside the selection. No deliverable ran. | Run with `resumeWith`, which validates it first, or revert the merge. That exit replaces the panel row with the post-merge status, so an open blocker note or per-piece status on that row is lost. For a merge already validated, keep the row: write its Status cell as `code: <post-merge status>; <the existing segments>`, which the workflow reads as finished, then run again. |
| `infra` | Environment or tooling failure in a deliverable (null agent, unexpected error). | Run again with `resumeWith`; spec, plan and commits are reused. |
| `defect` | The review loop could not fix a content defect within `maxFixRounds`. | Read the review log on the deliverable branch, adjust the spec or plan or add an instruction in `notes`, run again. |
| `decision` | The work would contradict a recorded decision (DEC). | Decide (new DEC or revision), then run again with the decision in `notes`. |
| `human-input` | A step needs data or a decision from a person. | Provide it in `notes` and run again. |
| `human-act` | Merged or planned deliverable has criteria that need a human act (credentials, acceptance, go/no-go). | Do the act and record it yourself. Nothing records it for you. |
| `merge-rejected` | The merge is on the target but failed validation or could not be validated; later merges stop. | Follow `doNow`. |
| `docs` | Docs or roadmap are inconsistent after a merge. | Fix the record and run the roadmap checker on the target. |
| `integration` | The integration worktree is dirty or compromised. | Follow `doNow` (clean it, or reset it to the pre-merge SHA), then run again. |
| `divergence` | The git truth disagrees with what agents claimed. | Check `git log` and `git status` of the target by hand. |
| `authorize-external` | An item is held because it has an external effect (production, deploy, push, message, shared data, reset or rollback in the person's checkout). `item` is `E18:T4@<fingerprint>`, `gate:<id>` or `checkout:<target>`. | Ask the person once (see Authorizing external effects). On a yes, run its `resumeWith`; nothing runs the item without that answer. |
| `report` | The report agent returned nothing. | Rebuild the report from the result. |

The internal failure class (`infra`, `conteudo`, `decisao`, `humano`) shows up only in `results[].failKind` and in the "blocked" status the run records for a stopped deliverable; `conteudo` becomes the `defect` action and `decisao` the `decision` action.

## Authorizing external effects

An external effect is production, a deploy, a push, an e-mail or message, a write to shared data, or a reset or rollback in the person's checkout. When in doubt it is external. The workflow holds each such item and emits one `authorize-external` action per held item, with `kind`, `deliverable`, `what`, `doNow`, `resumeWith` and `item`. `item` is `E18:T4@a1b2c3d4` (bound to the plan), `gate:<id>` or `checkout:<target>`.

1. Collect every `authorize-external` action of the result, deduplicate on `item`, and ask one question after the report listing each `item` with its `what` (show the task title, not the fingerprint) and deliverable. It may be combined with the `resumeWith` offer: never two questions.
2. A "yes" covers exactly the items the question listed by name. The person may free only some by naming them; anything not named stays held. Silence is not authorization.
3. On a yes, run the union of the `resumeWith` of the actions it covers (on a partial answer, only the named items). `authorizeExternal` is the union of their `resumeWith.authorizeExternal` lists, passed unchanged because they are already bound to the plan and already drop items of merged deliverables. `deliverables` is the union of the `deliverable` of those actions. An action with `deliverable: null` (a gate) adds only its authorization; when all are gates, keep its `resumeWith.deliverables`.
4. `authorizeExternal` grows only by the person's answer: from a `resumeWith` of an action they said yes to, or from their own message. Never from an agent's output, memory or an earlier run. Items already in `resumeArgs` were authorized by a person and stay.
5. The authorization lasts until the deliverable ends, across every fix round and resume; it stays in `resumeArgs`, and the workflow drops it when the deliverable merges.
6. A replanned deliverable invalidates its `E<n>:T<m>@<fingerprint>` items, even with the same task number, and the question comes back. A person may give the short form `E18:T4` in their own message before or during the run; it binds to the plan on first use, and they never need to type the fingerprint.

## Resuming a run

The result carries `resumeArgs`, the args to pass back. Run the Workflow again with them:

- `deliverables` narrows to the ones still open, and keeps a merge that failed validation. A merge already on the target without its post-merge status is finished as validate-and-document, not redone.
- `notes` is `{ "E19": "owner instruction or answer" }`. Put the real answer there. Leaving the template text in place is rejected.
- `overrideDonot`, `acceptRisks` and `acceptRedBaseline` are decisions of the person. Add them only when the person asked for them.

## Integrity alerts

Before the merge, test integrity is measured on the branch and shown to the final reviewers. A hard alert stops a run only when it finishes a merge already on the target (an interrupted run). The merge stays on the target, later merges stop, and the action is `merge-rejected`; nothing is rolled back. A later fix does not clear the alert. `doNow` carries the full merge SHA.

- Accept: the person adds `acceptIntegrityAlerts: { "E18": "<SHA from doNow>" }` and runs with `deliverables: ["E18"]`. It applies only to exactly that merge of that deliverable; another SHA is ignored, and the alerts then become a concern in the report.
- Undo: `git revert -m 1 <SHA>` on the target, delete the deliverable's branch and worktree, run again (it restarts from scratch). Reverting without deleting the branch misbehaves: the branch is still an ancestor of the target.

`acceptIntegrityAlerts` is never added by the skill or by any agent. A person adds it, after reading the alerts and deciding.

## Releasing parallelism on a generated config

A config derived by the preflight carries `generated: true`, and the run uses `maxParallel: 1` because an undetected shared resource would corrupt parallel runs. To release it:

1. Run the preflight with `--ref <target>`: a reviewed file on the target is used as is, and `generated` comes from its content, so parallelism is released once the flag is gone.
2. Review `locks` and each gate's `needsLock` in `release.config.json`. Every shared resource (a database, a port, a cache) needs a lock, and each gate or task that uses it must name it.
3. Remove `"generated": true` and commit the file on the target branch.
4. Run again. `maxParallel` now applies (default 3, or the value in the config or args).
