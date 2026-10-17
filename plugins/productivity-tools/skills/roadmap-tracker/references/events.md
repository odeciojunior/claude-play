# Event recipes

One recipe per event. Each names the files in the order they change, the cells to write, and the checker codes to watch. File formats, anchors, column orders and cell rules are in `../roadmap-planner/references/formats.md` (relative to the skill base directory); this file never restates a template.

## Contents

1. Decision
2. Piece or step closed
3. Integration
4. Branch deleted
5. Blocker opened or closed
6. Measurement
7. New source
8. New requirement mid-flight
9. End of piece or phase (revision)
10. Checker refresh
11. Migration

Common to every recipe:

- **Log row**: insert at the top of the `log` table (newest first, dates descending). Columns: Date, Deliverable (`E<n>` or `-`), What happened (≤ `limits.cellChars`), Evidence (a SHA, path or URL in backticks, never empty, never "this commit" or another `bannedPhrases` entry).
- **Next ID**: the highest ID of that kind ever used, in any file (the log included), plus one. Never reuse, never renumber.
- **Words**: statuses, coverage, decision status and branch kind use the exact `vocab` words of the config, which may be localized.
- **State is a snapshot**: rewrite the affected rows and lists; do not keep history in `state.md`. Keep `now` within `limits.nowItems`.
- **Strategy**: no recipe edits the strategy except § 9 after approval.

## 1. Decision

**When:** the user, a meeting note or a source settles a choice.

1. `decisions.md`: append one row per choice (split a message that settles two things into two rows).
   - ID: next `DEC-NNN`. Date: the day it was decided. Deliverable: `E<n>` or `-`.
   - Decision: what was chosen, one sentence. Discarded alternative: what was not chosen; if nobody stated one, write `none stated` rather than invent one.
   - **Contradicts:** read the strategy text the decision touches: the card's pieces, acceptance, definition of done, attrs (`priority`, `phase`, `track`, `depends`, `reqs`), and the objective, non-goals, thesis and deliverables overview. If the decision overrides any of them, name it, for example `E2 (pieces)`, `E3 (priority)`, `Non-goals`. If it only fills in detail the strategy leaves open, write `-`. If unsure, ask once and recommend the filled cell.
   - Revisit when: a condition ("the owner reprioritizes sharing"), not a date unless one was supplied.
   - Origin: `user`, `SRC-NN` or `REQ-NNN`. Status: `vocab.decisionInForce`, or `vocab.decisionPending` while awaiting someone.
2. **Supersedes an earlier decision?** Only when the new decision replaces the old one's choice on the same question (the old row's Decision would now be answered differently). Touching the same deliverable, or making the old choice moot, is not enough. If unsure, ask the user, recommending "not superseded". When it does supersede, set the old row's Status to `<vocab.decisionSupersededBy> DEC-NNN` (the new ID). Status and Revisit when are the only cells of an old row that may change.
3. Then whatever uses it: `state.md` (remove the pending item it resolves, adjust panel Next step and `now`), `requirements.md` (a coverage change that touches no card: `out-of-scope: <reason citing DEC-NNN>`, or `needs-clarification`), `critical-path.md` (a changed gate). Changes to a card wait for the revision.
   - **A piece dropped or moved:** list the `REQ` that piece served (the card's `reqs` and the `requirements.md` rows whose Deliverables name that card) and re-check each one's coverage. Still served by another piece or deliverable → leave it and say so in the revision proposal. No longer served → set Coverage to `<vocab.coverageOutOfScope>: <reason citing DEC-NNN>` if the decision drops it from scope, otherwise `vocab.coverageNeedsClarification`; if unclear which, ask (recommend `needs-clarification`). Card `reqs` change only in the revision.
4. `log.md`: "DEC-NNN recorded: <short decision>", evidence `` `decisions.md` ``.

Checker: a filled Contradicts on an in-force decision → `contradiction-unabsorbed` (warning) until a revision cites the ID → propose one (§ 9). `superseded-link` if the superseding ID does not exist.

## 2. Piece or step closed

**When:** a vertical slice of a deliverable, or a plan step that finishes one, is done; or plan-coordinator reports "wave N closed" / "plan completed" (SKILL.md Step 4a).

1. `state.md` panel row of the deliverable:
   - Status: per piece, `piece 1: on-branch; piece 2: spec` (segment rules in formats.md § 4). Code merged to the integration branch → § 3 instead.
   - Evidence: backticked SHAs, the spec or plan path, the progress file path.
   - Next step: the next concrete action.
2. `now`: remove the finished item, add the next one.
3. `log.md`: "E<n> piece <k> closed (<status>)", evidence = SHA or path.
4. Last piece of the deliverable, or last deliverable of a phase → § 9.
5. A piece dropped or moved (not closed) is a decision: § 1, including its coverage re-check.

Checker: `bad-status` (word not in vocab), `integrated-no-sha`, `sha-missing`, `now-limit`, `cell-limit`.

## 3. Integration

**When:** a branch with roadmap work is merged into the configured `integrationBranch`.

1. Get the SHA on the integration branch (the merge commit or the merged tip); ask for it if git cannot show it. Verify with `git cat-file -e <sha>^{commit}` and `git merge-base --is-ancestor <sha> <integrationBranch>` (fall back to `origin/<integrationBranch>`). Not an ancestor → do not mark integrated; tell the user.
2. `state.md` panel: the integrated word (or `released` / `measured` words when the user says so) for the pieces it carries, the SHA in backticks in Evidence.
3. `state.md` "in flight": the branch stays `vocab.branchLive` while it exists; deleted → § 4.
4. `log.md`: "E<n> piece <k> integrated into <branch>", evidence the SHA.
5. Then § 2 step 4 (end of piece or phase?).

Checker: `not-integrated`, `sha-missing`, `integrated-no-sha`; `shallow-clone` or `integration-branch-missing` warnings mean the ancestry was not verified: say so in the report.

## 4. Branch deleted

**When:** a branch listed in "in flight" is deleted (or a new one starts).

1. Verify it is gone: `git rev-parse --verify --quiet refs/heads/<b>` and `refs/remotes/origin/<b>` both fail.
2. `state.md` "in flight": Kind → `vocab.branchDeleted`, Note "merged at `<sha>`" or "abandoned: <reason>". A later update may drop the row once the log has it.
3. `log.md`: "branch <b> deleted", evidence the merge SHA or `` `state.md` ``.
4. A new branch: add a row with Kind `vocab.branchLive` after confirming it exists.

Checker: `branch-deleted-exists`, `branch-live-missing`.

## 5. Blocker opened or closed

**Opened:**

1. `state.md` blockers: next `BLQ-n` (search `state.md`, `log.md`, `critical-path.md` and the strategy). Columns: Blocker, Affects (`E<n>` list), Since (the day it started), Unblocks when (a condition).
2. `state.md`: panel Next step of the affected deliverables, `now`.
3. `critical-path.md`: the gate it holds and the next gate per track.
4. `log.md`: "BLQ-n opened: <short>", evidence a path, URL or SHA.

**Closed:**

1. If a decision closed it, apply § 1 first.
2. `state.md`: remove the `BLQ-n` row (the log keeps the history; the log may cite a retired `BLQ-n`); update panel and `now`.
3. `critical-path.md`: remove or resolve the gate.
4. `log.md`: "BLQ-n closed: <how>", evidence.

Checker: `unknown-id` (a `BLQ` cited in `state.md` or `critical-path.md` without a row), `duplicate-id`.

## 6. Measurement

**When:** a paid run, a cost or a measurement milestone.

1. `files.measurements` is `null` → do not create the file silently. Ask whether to enable it; on yes, set `files.measurements` in the config, create the file from formats.md § 7, and add the "paid run or measurement" row to the README table (formats.md § 8). On no, log the event only.
2. `measurements.md`: Date, Deliverable, Kind (run, cost, milestone), Detail (what and where it came from), Recorded, Billed (separate columns; `-` for a value nobody supplied, never an estimate), Status. Values exactly as supplied, with their unit.
3. `log.md`: "<kind> recorded for E<n>", evidence the report path or URL.
4. Targets in the strategy's "Metrics and targets" change only in a revision.

## 7. New source

**When:** a document, issue, URL or note becomes relevant after the roadmap was created.

1. Read it (delegate a long one to a subagent returning ≤10 lines).
2. `sources.md`: next `SRC-NN`; Source in backticks, What it is, Read on (today), Reliability.
3. Compare with the existing sources and requirements. A disagreement → `conflicts` item "SRC-a vs SRC-b: <what disagrees>". Never resolve it silently: resolving it is a decision (§ 1).
4. New requirements in it → § 8.
5. `log.md`: "SRC-NN added: <what>", evidence the source path or URL.

## 8. New requirement mid-flight

**When:** a requirement appears after the roadmap was created.

1. Trace it first: from a document → register it (§ 7) and cite the `SRC`; stated by the user → record the scope decision (§ 1, Origin `user`) and cite the `DEC`.
2. `requirements.md`: next `REQ-NNN`; Requirement, Type, Sources, Deliverables, Coverage:
   - the user names a deliverable → Deliverables `E<n>`, Coverage `vocab.coverageCovered` (warning `req-card-asymmetry` until a revision adds it to the card's `reqs`);
   - no deliverable yet → Deliverables `-`, Coverage `vocab.coverageNeedsClarification` (warning `needs-clarification`);
   - out of scope → `<vocab.coverageOutOfScope>: <reason>`.
3. `log.md`: "REQ-NNN added: <short>", evidence `` `requirements.md` ``.
4. Propose a revision (§ 9) that places it in a card or a new deliverable.

Checker: `uncovered-req` (covered with no deliverable, or out of scope without a reason), `unknown-id`.

## 9. End of piece or phase (revision)

**When:** a piece or phase ends, the checker warns `contradiction-unabsorbed`, a requirement awaits a card, or the user asks. Procedure and approval: SKILL.md Step 6.

Review before proposing:

- In-force decisions with a filled Contradicts not yet cited by the strategy.
- Requirements with `needs-clarification` or `req-card-asymmetry`.
- Phase exit criteria: met? Next phase entry criteria: met?
- Assumptions whose "re-validate when" condition has fired.
- Risks that materialized or vanished; critical-path changes.
- "Where we are": what `state.md` and `critical-path.md` now say.

Proposal (in the conversation, not in a file):

```
Strategy v<N> -> v<N+1> (proposed, not written)
Absorbs: DEC-…
Sections: <section>: <one-line change>   (one line each)
Cards: <E<n>>: <pieces / acceptance / reqs / priority change>
Requirements: <REQ-…>: <coverage change>
Unchanged: everything else
Approve?
```

Nothing to change → say so and write nothing. Not approved → leave the strategy untouched; the proposal lives only in the conversation plus the pending item "(user) approve strategy v<N+1> (absorbs DEC-…)" in `state.md`, nothing else is written, and the warning stays. A later run (after compaction or in a new session) regenerates the proposal from the `DEC` rows that pending item names.

On approval, in this order: strategy (`version` anchor, title, changelog entry listing the absorbed `DEC`, changed sections citing each `DEC`, "Where we are", version-history row), then `state.md` panel rows for new or dropped cards, `requirements.md`, `critical-path.md`, remove the pending approval item, `log.md` "strategy v<N+1>: absorbs DEC-…" with the strategy path as evidence, then the checker.

## 10. Checker refresh

**When:** cold start (SKILL.md Step 2), the checker warns `checker-stale`, or the user asks.

1. Versions: line 1 of `<base>/scripts/check-roadmap.mjs` and of `<folder>/check-roadmap.mjs`, header `// check-roadmap <version> format <n>`. Cross-check with `node <file> --version`; the header wins. Plugin's not newer → stop.
2. `node "<base>/scripts/check-roadmap.mjs" "<folder>"`; read the exit code and the summary line `check-roadmap: N error(s), M warning(s)`.
3. Exit 0 → copy the plugin's file over the vendored one (`cp`, byte for byte), log "checker refreshed <old> → <new>" with evidence `` `check-roadmap.mjs` ``, remove any "checker … available" pending item.
4. Exit 1 → keep the vendored copy, add or update the pending item "(maintainer) checker <new> available: N errors to fix". Show the errors in the report. Fixing them is a separate request.
5. Either way, run the vendored copy for this run's final check (SKILL.md Step 5).

When the refresh and the event both add log rows in one run, both carry the same date (the day of the run) and the event's row goes on top: the refresh happened first (cold start), so it is the older row.

## 11. Migration

**When:** the `formatVersion` in `formats.md` is greater than the config's `formatVersion` (SKILL.md Step 3).

`formatVersion 1` has no migration: it is the first format. Each future format adds one section below, `### Migration <N-1> → <N>`, written with that format change and applied in order (1 → 2, then 2 → 3). Template:

```
### Migration <N-1> → <N>
Trigger: config formatVersion = <N-1>; formats.md formatVersion = <N>.
Changes:
- <file role>: <exact change: anchor renamed, column added at position k with default value, vocab key added with default>
- roadmap.config.json: <new or renamed keys and their defaults>
Steps:
1. List the files and changes; ask the user to approve. No approval -> stop, keep writing format <N-1>.
2. Apply the changes in the working tree, file by file.
3. Copy the plugin's checker (format <N>) over the vendored one.
4. Set the config formatVersion to <N>.
5. Run the vendored checker: 0 errors. Otherwise list the errors and stop (no git checkout or reset; the diff stays for review).
6. log.md: "format migrated <N-1> → <N>", evidence `roadmap.config.json`.
```

Rules: never set the config's `formatVersion` above the vendored checker's `format <n>` (step 3 comes before step 4). The new checker usually fails on the unmigrated folder, so § 10 exit 1 does not block a migration; the gate is step 5, on the migrated files.
