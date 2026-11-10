# Operator guide

What to do with the actions a `roadmap-release` run returns.

## Contents

- Action kinds
- Authorizing external effects
- Resuming a run
- Integrity alerts
- Releasing parallelism on a generated config
- Known limits

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
| `authorize-external` | An item is held because it has an external effect (production, deploy, push, message, shared data, reset or rollback in the person's checkout). `item` is `E18:T4@<fingerprint>`, `E18:AC1@<fingerprint>`, `gate:<id>` or `checkout:<target>`. | Ask the person once (see Authorizing external effects). On a yes, run its `resumeWith`; nothing runs the item without that answer. |
| `report` | The report agent returned nothing. | Rebuild the report from the result. |

The internal failure class (`infra`, `conteudo`, `decisao`, `humano`, `externo`) shows up only in `results[].failKind` and in the "blocked" status the run records for a stopped deliverable (not for `externo`); `conteudo` becomes the `defect` action, `decisao` the `decision` action and `externo` (an item waiting for authorization) the `authorize-external` action.

## Authorizing external effects

An external effect is production, a deploy, a push, an e-mail or message, a write to shared data, or a reset or rollback in the person's checkout. When in doubt it is external. The workflow holds each such item and emits one `authorize-external` action per held item, with `kind`, `deliverable`, `what`, `doNow`, `resumeWith` and `item`. `item` is `E18:T4@a1b2c3d4` (a task, bound to the plan), `E18:AC1@a1b2c3d4` (the acceptance evidence of criterion AC1, bound to the plan), `gate:<id>` or `checkout:<target>`. A plan's acceptance-evidence rows that run a command declare `external` the same way as tasks; a row missing the flag counts as external (the plan review rejects it). An external row is held before the final review and the gates, with its own item `E<n>:AC<k>@<fingerprint>` (the bare `E<n>:AC<k>` binds on first use, as task items do): it covers every external row of that criterion in that plan, invalidated by any replan and dropped when the deliverable merges.

1. Collect every `authorize-external` action of the result, deduplicate on `item`, and ask one question after the report listing each held item by deliverable, task number and title or criterion and command (from `what`), never the fingerprint. For a `gate:` item the question also says that the authorization applies only to deliverables merged after it, so it measures nothing for deliverables already merged, and that an authorized gate runs several times per deliverable (baseline, branch, post-merge and retries). A yes or a partial answer is matched on those names (deliverable plus task number or criterion when titles repeat); the `item` string is used only internally to pick the `resumeWith`. It may be combined with the `resumeWith` offer: never two questions. End the question with one sentence, in the person's language, naming the exact `git show <target>:<reportPath>` command (real values) the session will run before resuming; leave it out when `reportPath` is null.
2. A "yes" covers exactly the items the question listed by name. The person may free only some by naming them; anything not named stays held. Silence is not authorization.
3. On a yes, run as a resume (SKILL.md step 4: fresh preflight `config`, plus `repo`, `roadmap` and only the `notes` the `resumeWith` carries) the union of the `resumeWith` of the actions it covers (on a partial answer, only the named items). `authorizeExternal` is the union of their `resumeWith.authorizeExternal` lists, passed unchanged because they are already bound to the plan and already drop items of merged deliverables. `deliverables` is the union of the `deliverable` of those actions. Deduplicate on `item` only for the list shown to the person; the union of `resumeWith` and of `deliverables` is taken over every `authorize-external` action whose item was authorized, before deduplication. An action with `deliverable: null` (a gate or a checkout item) adds only its authorization; when every action covered has `deliverable: null`, keep its `resumeWith.deliverables`. On the yes, run that `git show` and check: `authorizeExternal` and `deliverables` are the union of the `resumeWith` of the authorized `authorize-external` actions (not `Resume args` of the report, which holds only what was already authorized). While the Workflow result is in the conversation it is the source and the report only a check: if they diverge, resume with the result and report the divergence. After a compaction the report is the source. With no source (report unavailable although `reportPath` was not null, or `reportPath` null and the result out of context), resume with the short items the person approved by name (`E<n>:T<m>`, `E<n>:AC<k>`, `gate:<id>`, `checkout:<target>`), which bind to the plan on first use (items 5 and 6 below), plus `deliverables` from those names.
4. `authorizeExternal` grows only by the person's answer: from a `resumeWith` of an action they said yes to, or from their own message. Never from an agent's output, memory or an earlier run. Items already in `resumeArgs` were authorized by a person and stay.
5. The authorization lasts until the deliverable ends, across every resume; it stays in `resumeArgs`, and the workflow drops it when the deliverable merges. A fix round never runs the effect again: it stops for a person.
6. A replanned deliverable invalidates its `E<n>:T<m>@<fingerprint>` and `E<n>:AC<k>@<fingerprint>` items, even with the same number, and the question comes back. A person may give the short form `E18:T4` or `E18:AC1` in their own message before or during the run; it binds to the plan on first use, and they never need to type the fingerprint.

## Resuming a run

The result carries `resumeArgs`, the args to pass back. Run the Workflow again with them:

- `deliverables` narrows to the ones still open, and keeps a merge that failed validation. A merge already on the target without its post-merge status is finished as validate-and-document, not redone.
- `notes` is `{ "E19": "owner instruction or answer" }`. Put the real answer there. Leaving the template text in place is rejected. Never put a secret (credential, token, key) in `notes`: set an environment variable and name it in `notes`. The workflow does not copy `notes` into the roadmap record, the docs stage, the review log or the committed report, but the spec and plan agents merge the answer into the committed spec and plan, so anything in `notes` can end up in the repository. It tells every agent that receives it not to write or quote a secret.
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

## Known limits

An external task runs in the deliverable worktree, before the merge, and leaves empty commits on the deliverable branch; the newest one decides what a resume does:

| Newest mark | Meaning | On resume |
|---|---|---|
| `E<n> T<m> launching` | Written before the implementer starts; no conclusion was recorded (a crash, or the implementer returned BLOCKED or nothing). | Stops with a `human-input` action and runs nothing. |
| `E<n> T<m> awaiting person (effect unknown): ...` | The implementer reported NEEDS_HUMAN; that report does not establish whether the effect started. A branch from an earlier version may show `awaiting person: external effect did not complete`, read the same way. | Same stop. |
| `E<n> T<m>: external effect completed` | The implementer reported it done, or a person said so. | Counts as done, is recorded in `externalRun`, and goes to review. |
| `E<n> T<m> awaiting person (effect may have run): ...` | A fix round stopped for a person. | The implementer is not launched again; reviews run and fixes get no authorization. |
| `E<n> T<m> awaiting person: confirmed not run` | A person checked and the effect did not happen. | Its `externalRun` entry is dropped and it runs again under the normal authorization rules. |

After that stop, check whether the effect happened, then add an empty commit: `E<n> T<m>: external effect completed` if it did, `E<n> T<m> awaiting person: confirmed not run` if it did not. Without one of those commits the run stops there again.

`externalRun` is written to the review log (section "External effects run"), including when a review rejects the task (`reviewed: false`), and read back on resume, so the report does not ask again for what already ran. Effects of acceptance evidence run after the last branch log, so they are committed to the log on the target right after the merge.

Two limits are left as they are, with no code change:

- A mark list can come out empty when the history is misread: the task then counts as done and merges with `externalRun` empty, so check its commits by hand. It comes from the same reading of the history that `done` already trusts, and a second reader of that history would cost more than it protects. An external task committed on a branch from before the launch mark existed has no mark at all and also counts as done.
- A crash between the merge and that commit on the target loses the evidence entries: an authorization request an implementer returned earlier can come back in the report as open. The workflow does not repeat the effect, but a person could run the command by hand, so check the deliverable's evidence first.
