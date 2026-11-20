# Delegation Protocol

What the session does around the `productivity-tools:coordinator-workflow` run. The workflow owns the wave loop, the executor prompt, the reviews, the gates and the commits; every transition is written to `progress.json` before it returns. This session relays its stops, relaunches and reports.

## Contents

- Relay each stop
- Relaunch
- Restart
- Roadmap tracker
- Final report

## Relay each stop

A stopped return is `{ status: 'stopped', stop: { kind, ... }, resumeArgs }`. Show the person what the stop says, in their language, and nothing the workflow did not return.

- **`authorize`**: `stop.items` lists the external steps and the exact items to authorize, each `plan:T<n>@<8 hex>` (the digest is part of the item). Show the items exactly as listed, with what each step does. Never authorize for the person and never edit an item.
- **`ask`**: a question, or the open `manual` entries in one question. Ask it as returned.
- **`plan-changed`**: the plan no longer matches the state. Keep the state as it is and ask whether to recreate it; see Restart.
- **`state-divergence`**: the state or the repository does not match what the workflow expects. Pass the message on; do not repair the state by hand.
- **`error`**: pass the error verbatim and stop.

## Relaunch

After the person answers, call the workflow again with the `resumeArgs` it returned, the same `state`, a new `progress.mjs token` as `runToken`, and what the person gave:

- `authorizeExternal`: the authorized items, copied exactly from the `authorize` stop.
- `answers`: a list of objects `{ event, step, value, text }`, one per answer; `event` is `answer`, `unblock`, `release`, `hold` or `refuse` (`type` is accepted as a synonym), and `step`, `value` and `text` are the fields the state reference (linked from `SKILL.md`) lists for that event (the CLI flags `--step`, `--value`, `--text`). Example: `{ "event": "answer", "step": 3, "value": "done" }`.
  - A stop that names a step (an open `manual` entry of an external step left `stopped`, held or skipped) is answered with `answer` and that `step`: `value` is `done`, `no`, `rerun` or `value` (with `text`). `rerun` creates a new step that reuses the brief of the step it replaces.
  - A stop of the run itself (a failed wave gate, a baseline whose tests fail or run 0 tests, a lost reviewer, the final gate asking) has no step: answer it with `{ "event": "unblock" }` after the person decided (for a baseline, fix the command and recreate the state with `progress.mjs init <plan> --restart`, since nothing has launched yet, or answer `unblock` to accept that baseline); the run goes back to `in-progress` and the workflow continues.
  - An `authorize` stop is answered by `authorizeExternal`, not by `answers`; `refuse` (`step`, `value` `refused` or `not-named`), `hold` and `release` (`step`) act on one step.

`runToken`, `authorizeExternal` and `answers` are never reused from an earlier call.

## Restart

`init --restart` rebuilds the state and discards the run's progress: run it only when the person asks, typically after `plan-changed`.

## Roadmap tracker

When `plan.roadmap` names a folder, invoke the `roadmap-tracker` skill once, after the run is `done`, with the event "plan completed; no questions, return pending items". Keep the pending items it returns for the final report. The tracker never blocks the run.

## Final report

Tell the person: each step's final status, attempts and commit SHA (from `steps`, plus `progress.mjs show` if tiers are needed), each external step and what happened to it, steps refused or not run, any open manual items (`open`), and the tracker's pending items. Do not push unless asked, except an authorized external step.
