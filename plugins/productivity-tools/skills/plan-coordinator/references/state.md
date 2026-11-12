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
| `steps[]` | `n`, `title`, `wave`, `deps`, `tier`, `effort`, `reviewTier`, `gate`, `external`, `mode` (`delegated`/`inline`), `agent`, `status`, `attempts`, `rounds`, `agentId`, `preLaunchReview`, `authorized`, `handoff`, `sha`, `replacedBy`, `note`, `outputs`, `brief` |
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
| `report --step n --value pass\|fail\|blocked [--text t]` | `pass`: `pass`, or `review-owed` when gated. Otherwise `pending` up to 3 attempts, then held with the text; an external step becomes `stopped` |
| `no-report --step n` | agent lost: `pending`; an external step becomes `stopped` |
| `review-result --step n --value pass\|defects\|lost` | `pass`; `defects`: fix-up round (`launched`, 2 rounds, then as a failure; external: `stopped`); `lost`: review again |
| `commit --step n --sha s` | records the commit of a `pass` step |
| `wave-gate --value pass\|fail [--step n]` | clears `waveGateOwed`; `fail` with `--step` sends that `pass` step back as a failure |
| `advance` | moves to the next wave |
| `final-gate --value pass\|defects\|skip [--step n]` | `pass` or `skip`: `completed`; `defects` with `--step` sends the step back as a failure and reopens its wave |
| `prelaunch-review --step n --value pass\|defects` | external step: records the review; 2 defect rounds hold it |
| `authorize --step n` / `refuse --step n --value refused\|not-named` | records the effect's authorization / holds the step |
| `card-changed --step n` | external step: review and authorization are void |
| `hold --step n [--text t]` / `release --step n` | holds a `pending` step (or marks it `waiting-manual`) / returns it to `pending` |
| `answer --step n --value done\|no\|rerun\|value [--text t]` | answers a `stopped` or held step: `done` is `pass`, `no` keeps the refusal, `rerun` (external) adds a new step for the effect, `value` stores the text and returns it to `pending` |

## Next action (`next`)

`approve-map`, `await`, `review`, `wave-gate`, `hold`, `prelaunch-review`, `authorize`, `launch` (steps with `mode`), `advance`, `final-gate`, `ask` (a `question`, or open `manual` entries), `done`, and `plan-changed` (the plan no longer matches `plan.digest`).

## Refusal codes

`plan-no-data-block`, `plan-invalid`, `state-exists`, `state-schema`, `concurrent-change` (the file changed since the read; read again), `unknown-step`, `unknown-event`, `blocked`, `wrong-status`, `wave-order`, `dependency-not-passed`, `dependency-held`, `tier-down`, `inline-not-allowed`, `external-relaunch`, `external-unauthorized`, `gate-owed`, `steps-open`.

A refusal changes nothing: read `next`, then act on what it says.
