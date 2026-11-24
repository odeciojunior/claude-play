# Coordinator state: `progress.json` (schema `progress/1`)

The state is one JSON file beside the plan, `docs/plans/<topic>/progress.json`, written only by `scripts/progress.mjs` (`init`, `apply`). Never edit it by hand; read it with `show` or `next`. The step briefs are `briefs/T<n>.md` in the same folder.

Exit codes: 0 done, 1 refused with no change (code on stderr, or in `errors` with `--json`), 2 invalid usage or unreadable file.

## Fields

| Field | Meaning |
|-------|---------|
| `plan` | `path`, `id`, `digest` (detects a changed plan), `maxWidth`, `roadmap` (folder or null), `spec` |
| `piece` | optional label of the piece being run |
| `run` | `status`, `wave`, `worktree`, `branch`, `base`, `test`, `baseline`, `commits` (`per-step`/`none`), `waveGateOwed`, `question`, `updated` |
| `waves` | `{n, tasks[]}` per wave |
| `steps[]` | `n`, `title`, `wave`, `deps`, `tier`, `effort`, `reviewTier`, `gate`, `external`, `mode` (`delegated`/`inline`), `agent`, `status`, `attempts`, `rounds`, `agentId`, `preLaunchReview`, `authorized`, `handoff`, `sha`, `replacedBy`, `note`, `outputs`, `brief`, `files`, `noCommit`, `gated` |
| `steps[].files` | paths the step may change (create, modify and test); what a per-step commit stages |
| `steps[].noCommit` | the plan marks the step as one that is never committed on its own |
| `steps[].gated` | set when a wave gate ran with the step `pass`; a wave gate is due only when the wave has no open step and a `pass` step is not yet `gated` |
| `run.baseline` | `{ test, exit, tail, failedNames, failedNamesCut? }` recorded by the `baseline` event; a failing test counts only if its name is not in `failedNames` (at most 50 names; `failedNamesCut` counts the names left out, which then count as new failures) |
| `finalGate` | `status`, `rounds`, `lastVerdict` |
| `manual[]` | open or closed holds: `kind`, `step`, `text`, `open` |
| `history[]` | one line per event, with its time |

Route fields (`tier`, `effort`, `reviewTier`, `gate`) come from `lib/routing.mjs` through `init`; the coordinator never re-scores a step.

## Status

Run: `map-ready`, `in-progress`, `blocked` (nothing starts), `completed`.
Step: `pending`, `launched`, `review-owed`, `pass`, `skip`, `skip-manual` (held, with a `manual` entry), `waiting-manual` (a dependency is held), `stopped` (external step, result unchecked).

## Events (`apply <progress.json> <event> [options]`)

| Event | Effect |
|-------|--------|
| `approve-map` | `map-ready` to `in-progress` |
| `skip --step n --value outputs\|no-outputs` | before approval: the step is `skip`; dependents proceed only with `outputs` |
| `block --text q` / `unblock` | `blocked` with the question / back to `in-progress` |
| `launch --steps n,.. [--tier t] [--agent-id id]` | steps `launched`, attempts + 1; `--tier` raises the level on a repeat |
| `inline-start --step n` / `inline-result --step n --value pass\|fail` | inline run (haiku, not external, no gate): `launched`, then `pass`, or `pending` as delegated sonnet |
| `baseline` (batch only) `exit`, `failedNames`, `test`, `tail` | records the test baseline in `run.baseline`; `exit` is an integer, `failedNames` a list of texts and the optional `failedNamesCut` an integer ≥ 0 |
| `report --step n --value pass\|fail\|blocked [--text t]` | `pass`: `pass` (in a batch the event may carry `handoff`, stored on the step), or `review-owed` when gated. Otherwise `pending` up to 3 attempts, then held with the text; an external step becomes `stopped` |
| `no-report --step n` | agent lost: `pending`; an external step becomes `stopped` |
| `review-result --step n --value pass\|defects\|lost` | `pass`; `defects`: fix-up round (`launched`, 2 rounds, then as a failure; external: `stopped`); `lost`: review again |
| `commit --step n --sha s` | records the commit of a `pass` step |
| `wave-gate --value pass\|fail [--step n]` | `pass` clears `waveGateOwed`; `fail` without `--step` keeps it set; `fail` with `--step` clears it and sends that `pass` step back as a failure |
| `advance` | moves to the next wave |
| `final-gate --value pass\|defects\|skip [--step n]` | `pass` or `skip`: `completed`; `defects` with `--step` sends the step back as a failure and reopens its wave |
| `prelaunch-review --step n --value pass\|defects` | external step: records the review; 2 defect rounds hold it |
| `authorize --step n` / `refuse --step n --value refused\|not-named` | records the effect's authorization / holds the step |
| `card-changed --step n` | external step: review and authorization are void |
| `hold --step n [--text t]` / `release --step n` | holds a `pending` step (or marks it `waiting-manual`) / returns it to `pending` |
| `answer --step n --value done\|no\|rerun\|value [--text t]` | answers a `stopped` or held step: `done` is `pass`, `no` keeps the refusal, `rerun` (external) adds a new step for the effect, `value` stores the text and returns it to `pending` |

## Signed commands

- `token` prints a fresh random token (the workflow's `runToken`).
- `read <progress.json> --nonce <n> [--page <k>] [--json]` prints the state (history emptied), the repository root and `planChanged`, signed with a `digest` and echoing the nonce, as compact JSON. A big state comes in pages under 30 KB: page 0 carries the state with its first steps (possibly none), `--page k` carries only steps; `pages` and `stateDigest` (of the whole state) are on every page.
- `apply <progress.json> --events <payload> --nonce <n>` applies a list of events in one write. The payload is URL-encoded JSON `{ expect, events, digest }`: `expect` is the `stateDigest` from the last read, `digest` signs the rest. A bad digest changes nothing and exits 2; a stale `expect` is refused as `concurrent-change`; an event refused midway changes nothing and the reply carries its `index` and `code`.
- The reply is signed output: `tool`, `command`, `nonce`, `now`, `ok`, `code`, `action` (the next action), `stateDigest` and `digest`. Trust it only when the nonce matches and the digest verifies.

## Next action (`next`)

`approve-map`, `await`, `review`, `wave-gate`, `hold`, `prelaunch-review`, `authorize`, `launch` (steps with `mode`), `advance`, `final-gate`, `ask` (a `question`, or open `manual` entries), `done`, and `plan-changed` (the plan no longer matches `plan.digest`).

## Refusal codes

`plan-no-data-block`, `plan-invalid`, `state-exists`, `state-schema`, `concurrent-change` (the file changed since the read; read again), `unknown-step`, `unknown-event`, `blocked`, `wrong-status`, `wave-order`, `dependency-not-passed`, `dependency-held`, `tier-down`, `inline-not-allowed`, `external-relaunch`, `external-unauthorized`, `gate-owed`, `steps-open`.

A refusal changes nothing: read `next`, then act on what it says.

## Evidence folder, cleanup and resume

Every command run through `capture.mjs run` keeps its output in `<absolute git-dir>/pt-evidence/<taskId>-T<n>/` (steps) and `<taskId>-gate/` (gates), outside the working tree and outside `docs/` (DEC-026). `<taskId>` is the plan id with each character outside `[A-Za-z0-9._-]` turned into `_`, cut to 55 characters, plus `_` and the 8-hex fnv1a of `id|plan.path` (the plan's relative path in the state): two plans with the same id at different paths get different prefixes, and a resume keeps the prefix. The final review writes `pt-evidence/review/<taskId>-final.txt` and `<taskId>-worktree.diff`. `capture.mjs run` deletes files older than 14 days. At the end of the plan the coordinator runs `capture.mjs prune --task-prefix '<taskId>-'` (the trailing hyphen is part of the prefix): it removes the folders `<prefix><rest>` whose rest has no hyphen and the files `review/<prefix><rest>`, then sweeps everything older than 14 days (`prune --older-than <days>` only sweeps by age; on Windows the prefix ignores case). `capture.mjs list [--cwd]` prints one signed JSON line with `{name, files, bytes, newest}` per folder, and `cut` when it truncates. To find the prefix by hand, run `list`, or take the folder name from the `path` that capture printed and drop `-T<n>`/`-gate` (the prefix passed to prune ends with `-`). To keep proofs, copy them out before the plan closes: the `done` prune deletes them. A worktree's folder disappears with the worktree. Reports cite only the path, the sha256 and the exit code, never the output. Runs started on 2.4.0 cannot be resumed with `resumeFromRunId` (DEC-028): launch again with a new `runToken`.
