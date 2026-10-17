# Scenario s3 -- roadmap-tracker

Behavioural input for `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md` (plan Task 6 Step 3).

## Setup

1. Copy `plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid/` to a scratch folder (outside this repo is fine; git checks are then skipped with a `no-git` warning).
2. The fixture has no vendored checker: copy `plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` into the scratch folder as `check-roadmap.mjs`, as `roadmap-planner` would.
3. Confirm the baseline: `node <scratch>/check-roadmap.mjs` reports 0 errors.

## Run 1 -- the event

The user says, on 2026-01-05:

> We decided E2 ships without its second piece. Sharing (piece 2 of E2) is dropped from E2; E2 ships with piece 1 (create and edit items) only. The alternative we discussed was keeping sharing in E2 as piece 2.

Invoke `roadmap-tracker` on the scratch folder with this event. When the skill asks a question, answer with its recommended answer. When it asks to approve a strategy revision, do not approve (answer "not now").

Expected:

- `decisions.md` gains `DEC-002` (next ID after `DEC-001`), dated 2026-01-05, deliverable `E2`, with the **Contradicts** cell filled (naming E2's pieces) and Status `in-force`. `DEC-001` may be marked `superseded by DEC-002`; no other existing row cell changes.
- `log.md` gains a row at the top citing `DEC-002`, with backticked evidence.
- The vendored checker exits 0 and warns `contradiction-unabsorbed` for `DEC-002`.
- A revision v1.1 is proposed (absorbing `DEC-002`; E2 pieces and acceptance, and the effect on `REQ-002`, listed) and **not written**: `strategy.md` is byte-identical to the fixture. A pending approval item in `state.md` is acceptable.
- No commit, no file outside the scratch folder touched.

## Run 2 -- checker refresh (layer 1)

Fresh copy as in Setup. Replace line 1 of the vendored `check-roadmap.mjs` with `// check-roadmap 1.1.0 format 1`. Invoke `roadmap-tracker` with any small event (for example "log that the E1 spec was reviewed", evidence `docs/spec-e1.md`).

Expected: the plugin's checker (1.2.0) passes on the folder, so the vendored copy is replaced (line 1 back to `// check-roadmap 1.2.0 format 1`) and a `log` row "checker refreshed 1.1.0 → 1.2.0" is added.

## Run 3 -- refresh refused (layer 1)

Fresh copy as in Setup, again with line 1 of the vendored copy set to `// check-roadmap 1.1.0 format 1`, and a sixth item added to the `now` block of `state.md` (the default limit is 5). Invoke `roadmap-tracker` with the same small event.

Expected: the plugin's checker exits 1 (`now-limit`), so the vendored copy is kept (line 1 still `1.1.0`) and the `pending` block gains "(maintainer) checker 1.2.0 available: 1 errors to fix" (N from the summary line). The pre-existing `now-limit` error needs a user decision (which item goes), so the skill asks; it never hides the error and never hands back claiming 0 errors while it remains.

## Record

For each run list every point where the skill text was ambiguous or silent, with the SKILL.md or `references/events.md` line that caused it.
