# Planning model (`planning-model.json`)

Contract of the file the planner writes after each step and the scaffold reads at Step 6. It is also the resume draft (SKILL Step 0). Sections are numbered to be cited (`model.md §n`). Key names stay in English; text values go in the project's language. File templates live in `formats.md` §5-§8; this file does not repeat them.

## 1. Base fields

`modelVersion` (1), `date` (ISO, creation date: a fact), `topic` (kebab-case), `title`, `language`, `mode` (`full` or `light`), `strategyPath` (relative to the folder), `integrationBranch`, `releaseBranch` (optional), `nextStep` (number of the next skill step; every write sets it).

## 2. Optional fields with a default

Each default applied is listed in `defaulted` of the output.

| Field | Default |
|---|---|
| `vocab` | `language` starting with `pt`: the vocabulary of this repo's roadmap; any other: the English one of `formats.md` §2 |
| `tracks` | the five of `formats.md` §2 |
| `limits` | `{nowItems: 5, cellChars: 300, pendingItems: 20}` |
| `files` | the names of `formats.md` §2; `measurements: null` when `measurements` is absent or empty |
| `strategyPath` | `../<date>-roadmap-<topic>.md`, without a `-plan` suffix |
| card `priority`, `size`, `track` | `Must`; "not estimated" / "não estimado"; the first track (`decompose.md` §12) |
| strategy prose (`nonGoals`, `thesis`, `crossRisks`, `externalPending`, `openQuestions`) | "None." / "Nenhuma." |
| `metrics`, `flags` | section omitted |
| `gates` | no gates table; the checker warns `dod-no-gate` where it applies |
| `now` | one item per card with no dependency: "Start E<n>. Runs: -. Approves: -. Depends on: -." |
| `pending` | empty block |

## 3. Conversation

- `questions[]`: `{question, answer}`, the answer literal; a secret is written "[omitted: secret]".
- `sources[]`: `{id, source, what, readOn, reliability}`; `conflicts[]`: `"SRC-a vs SRC-b: <what disagrees>"`.
- `decisions[]`: `{id, date, title, decision, why, status}` and optionally `deliverable`, `discarded`, `contradicts`, `revisit`.
- `assumptions[]`: `{text, owner, revalidate}`.

## 4. Requirements

`requirements[]`: `{id, text, type, sources[]}`, plus `coverage` only when the requirement is not covered: `{kind: "out-of-scope", reason}` or `{kind: "needs-clarification", deliverable}` (the deliverable that resolves it).

## 5. Structure

- `phases[]`: `{name, entry, exit}`, named by outcome, in order.
- `deliverables[]`: `{id, title, phase, track, priority, size, depends[], reqs[], why, pieces[], acceptance[], dod, risks[], status?}`. `acceptance[]` items are `{text, verify: {kind, evidence, blq?}}` (`kind` from `formats.md` §5; `blocked` needs `blq`). `risks[]` are "risk -> mitigation". `status` is `blocked` with the blocking BLQ, or `discarded`.

Example card (the worked example of `decompose.md`):

```json
{
  "id": "E2", "title": "Storage layer", "phase": "Features usable", "track": "engineering",
  "priority": "Must", "size": "2-3 pieces, like E1 (user)",
  "depends": ["E1"], "reqs": ["REQ-002"],
  "why": "Records must survive restarts.",
  "pieces": ["Schema", "Repository"],
  "acceptance": [
    { "text": "Given a stored record, when the service restarts, then the record is read back unchanged.",
      "verify": { "kind": "integration", "evidence": "node --test storage.test.mjs" } },
    { "text": "Given an invalid record, when it is written, then the write is rejected with an error.",
      "verify": { "kind": "test", "evidence": "node --test storage.test.mjs" } }
  ],
  "dod": "Acceptance passes on the integration branch and G1 is green.",
  "risks": ["Schema churn -> freeze the schema before E3 starts"]
}
```

## 6. Strategy

`objective` `{text, acceptance, done}`, `nonGoals[]`, `thesis`, `gates[]` (`{id, command, environment, when, baseline}`), `metrics[]`, `flags[]`, `crossRisks[]`, `externalPending[]`, `openQuestions[]` (`E<n>: ...` for deliverable-level questions).

## 7. State

`now[]`, `pending[]` (`{owner, text}`), `blockers[]` (`{id, text, owner, blocks[]}`), `donot[]`, `releases[]`, `measurements[]` (the last three optional).

## 8. Required to generate

The base fields except `releaseBranch` and `nextStep`; `requirements` (at least 1); `phases` (at least 1); `deliverables` (at least 1), each with `id`, `title`, `phase`, `depends`, `reqs` (use `[]` for none) and at least 2 criteria with `verify`. `objective` is not checked, but without it the Objective section reads "None.".

## 9. What the scaffold derives (the model never stores it)

`critical` of each card (any `critical` in the model is ignored and reported), the dependency graph and the critical-path line (first longest chain in numeric id order), the overview table, the phases table, each requirement's Deliverables and coverage columns (from the cards' `reqs`), the coverage summary, the `state.md` panel (first status word, or the blocked word citing the BLQ), `log.md` with one row, the README, `roadmap.config.json`, the version anchor and changelog v1.0, and the checker copy. It writes no prose the model does not carry.

## 10. Command, output and exit codes

`node "${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs" "<folder>/planning-model.json" [--dry-run] [--json]`

It never reads stdin, never asks, never commits and never deletes the model. It writes only when the generated folder has 0 checker errors; running it again rewrites the folder from the model with the same bytes.

`--json` prints `{tool, model, folder, written[], defaulted[], errors[], warnings[], summary: {errors, warnings, exitCode}}`; each error is `{path, code, message}` with the JSON path of the field. `defaulted` is `[{path, value}]`; `warnings` are the checker's. Exit 0 generated (warnings do not change it), 1 refused with nothing written, 2 usage or write failure.

## 11. Refusals (exit 1, nothing written)

| Code | Cause |
|---|---|
| `model-json` | invalid JSON (a UTF-8 BOM is accepted) |
| `model-version` | `modelVersion` is not 1 |
| `required` | a required field is missing or empty |
| `duplicate-id` | an id repeats in requirements, deliverables, sources, decisions or blockers |
| `unknown-phase`, `unknown-track`, `unknown-req`, `unknown-dependency` | a card points at something that is not in the model |
| `cycle` | the dependencies form a cycle |
| `acceptance-min` | a card has fewer than 2 criteria |
| `verify-missing`, `verify-blocked-no-blq` | a criterion lacks `verify`, its `kind`, its `evidence`, or the BLQ of a `blocked` kind |
| `multiline-cell` | a table-cell value has a line break (a `|` is escaped instead) |
| `existing-roadmap` | the folder has `roadmap.config.json` and no model |
| checker codes | the generated folder has a checker error (same codes as `check-roadmap.mjs`) |
