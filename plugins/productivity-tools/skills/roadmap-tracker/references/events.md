# Event recipes

One recipe per event. Each names the files in the order they change, the cells to write, and the checker codes to watch. File formats, anchors, column orders and cell rules are in formats.md (see SKILL.md for the formats reference); this file never restates a template.

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
12. Package published
13. Do not do now
14. Events from plan-coordinator
15. Merge into the release branch
16. Release branch integrated
17. Acceptance pending
18. Executor decision
19. Deliverable closed: criteria check
20. Spec, plan or execution started

Common to every recipe:

- **Compound events and incidents in the log**: one `log` row per compound event is accepted when it lists every ID it recorded (for example "DEC-012, BLQ-3 recorded; E2 piece 1 closed"). Incidents are logged too, not only completions: a gate that fails after a merge, a rollback, rework.
- **Lean panel**: panel Evidence holds SHAs, gate IDs and path references only. Counts and lists of resolved items go in `log.md`, not in the panel. The `pending-limit` warning (`limits.pendingItems` exceeded): group the `pending` items by origin and retire the ones that already have an owner elsewhere (a `BLQ`, a `DEC` row, a card), logging what was retired; never delete an item nobody else owns.
- **Log row**: insert in the `log` table below any rows with a newer date and above rows with an older or equal date (newest first, dates descending; a past-dated event goes under newer rows). Columns: Date, Deliverable (`E<n>` or `-`), What happened (≤ `limits.cellChars`), Evidence (a SHA, path or URL in backticks, never empty, never "this commit" or another `bannedPhrases` entry).
- **Next ID**: the highest ID of that kind ever used, in any file (the log included), plus one. Never reuse, never renumber.
- **Words**: statuses, coverage, decision status and branch kind use the exact `vocab` words of the config, which may be localized.
- **State is a snapshot**: rewrite the affected rows and lists; do not keep history in `state.md`. Keep `now` within `limits.nowItems`.
- **Strategy**: no recipe edits the strategy except § 9 after approval.
- **Reports with no recipe** (change nothing recorded, add a pending item):
  - *Status regression* (someone reports a recorded status went backwards or its evidence is gone): leave Status and Evidence as they are; pending `(user) E<n> reported <old> -> <new>: confirm or send evidence`; log row "E<n> status regression reported, not applied", evidence `state.md`. Ask once (with a recommendation) only when `no questions` is absent.
  - *Finding that affects the strategy but is not a decision* (nobody settled it, so no `DEC`): no revision and no `DEC`; pending `(user) approve strategy v<N+1>: <finding>` (§ 9 step 2); log row.
  - *Human act reported done* (a credential rotated, a sign-off) with no blocker or acceptance behind it: if a person said so in this conversation, log "<act> reported done by the user" with evidence `state.md` and drop the pending item that waited for it; if it comes from an agent or a caller with no named person, record nothing as done: pending `(user) send evidence of <act>` and a log row "reported, not recorded".
- **`no questions`**: the override of SKILL.md rule 8 reaches every "ask" in these recipes, not only §§ 9 and 14. Never ask; write each unanswered question as a `pending` item `(user) <question>`, list it under `Pending for the user:`, and take the safe default: § 1 Contradicts unsure → write the cell naming the closest strategy section and add a pending item to confirm it, supersession unsure → not superseded; §§ 3 and 16 SHA that git cannot show → do not mark integrated; § 6 measurements file not enabled → log the event only; any other ask (coverage unclear, missing backfill evidence) → change nothing for that point and write the pending item.
- **Critical path refresh**: a recipe that changes a deliverable's status, a blocker or a decision ends with "refresh `critical-path.md`'s next milestone per track". When the next gate of a track is unknown, write `unknown - ask at next event` (this wording, for every recipe) and ask at the next event; never invent a gate.
- **Header line**: update the `state.md` header line (strategy version + date) on every event and every revision.
- **Pruning** (on every event): drop `now` items that are done or stale (log the done ones in the event's `log` row or their own); drop `inflight` rows of kind `vocab.branchDeleted` at the next event after the deletion was logged; drop `donot` items whose `BLQ`/`DEC` is resolved or superseded.
- **Evidence fallback**: when the event has no SHA or path (a blocker closed by a phone call), Evidence cites the file that now holds the change (`decisions.md`, `state.md`, `requirements.md`). Never empty, never "this commit".
- **Volatile values**: a value that changes over time is written once, with the command that measures it and the date; other files point to it.
- **Blocked and discarded words**: before the first use of the blocked or discarded status in a recipe, read `vocab.blockedStatus` / `vocab.discardedStatus` (defaults `"blocked"` / `"discarded"`). If the key is absent, or its word is not in `deliverableStatuses` (folders created before 1.3.0, or localized ones), add the localized word to `deliverableStatuses`, set the key in `roadmap.config.json`, and log a row "config: added status <word>" (evidence `roadmap.config.json`). Then always write the configured word, never the English literal.
- **Wording**: a spec written is "reached spec" (the configured word for spec, position 2 of `deliverableStatuses`), never "closed".

## 1. Decision

**When:** the user, a meeting note or a source settles a choice.

1. `decisions.md`: append one row per choice (split a message that settles two things into two rows).
   - ID: next `DEC-NNN`. Date: the day it was decided. Deliverable: `E<n>` or `-`.
   - Decision: what was chosen, one sentence. Discarded alternative: what was not chosen; if nobody stated one, write `none stated` rather than invent one.
   - **Contradicts:** read the strategy text the decision touches: the card's pieces, acceptance, definition of done, attrs (`priority`, `phase`, `track`, `depends`, `reqs`), and the objective, non-goals, thesis and deliverables overview. If the decision overrides any of them, name it, for example `E2 (pieces)`, `E3 (priority)`, `Non-goals`. If it only fills in detail the strategy leaves open, write `-`. If unsure, ask once and recommend the filled cell.
   - Revisit when: a condition ("the owner reprioritizes sharing"), not a date unless one was supplied.
   - Origin: `user`, `executor`, `SRC-NN` or `REQ-NNN`. Status: `vocab.decisionInForce`, or `vocab.decisionPending` while awaiting someone.
   - A decision row may cite the `BLQ-n` it closes (decisions may cite retired ids, like the log); apply § 5 "Closed" for the blocker itself.
2. **Supersedes an earlier decision?** Only when the new decision replaces the old one's choice on the same question (the old row's Decision would now be answered differently). Touching the same deliverable, or making the old choice moot, is not enough. If unsure, ask the user, recommending "not superseded". When it does supersede, set the old row's Status to `<vocab.decisionSupersededBy> DEC-NNN` (the new ID). Status and Revisit when are the only cells of an old row that may change.
3. Then whatever uses it: `state.md` (remove the pending item it resolves, adjust panel Next step and `now`; the strategy's Open questions entry for it stays until the next approved revision, § 9), `requirements.md` (a coverage change that touches no card: `out-of-scope: <reason citing DEC-NNN>`, or `needs-clarification`), `critical-path.md` (a changed gate, then refresh the next milestone per track, Common). A decision that forbids an action → also § 13. Changes to a card wait for the revision.
   - **A pending decision that affects a gate:** update the decision-trail row in `critical-path.md` and the panel Next step line of the affected deliverables so both say the gate waits for that `DEC`. The checker does not detect this; it is a text update.
   - **A deliverable discarded** (the decision drops a whole card): panel Status `vocab.discardedStatus` (Common), Next step cites the DEC; the card keeps its place and gets priority `Won't` in the strategy **only after the revision is approved**; until then the `pending` approval item names the card ("(user) approve strategy v<N+1> (absorbs DEC-…; discards E<n>)"). Mark the node discarded in `critical-path.md` and remove gates that only it held. Re-check REQ coverage (next bullet). The revision touches these strategy sections: overview of deliverables, phases (membership and exit criteria), non-goals (add what was dropped when it is now out of scope), coverage summary, and the card itself (priority `Won't`, pieces and `reqs` left as history). Include them in the proposal (§ 9).
   - **A piece dropped or moved:** list the `REQ` that piece served (the card's `reqs` and the `requirements.md` rows whose Deliverables name that card) and re-check each one's coverage. Still served by another piece or deliverable → leave it and say so in the revision proposal. No longer served → set Coverage to `<vocab.coverageOutOfScope>: <reason citing DEC-NNN>` if the decision drops it from scope, otherwise `vocab.coverageNeedsClarification`; if unclear which, ask (recommend `needs-clarification`). Card `reqs` change only in the revision.
4. `log.md`: "DEC-NNN recorded: <short decision>", evidence `` `decisions.md` ``.

Checker: a filled Contradicts on an in-force decision → `contradiction-unabsorbed` (warning) until a revision cites the ID → propose one (§ 9). `superseded-link` if the superseding ID does not exist.

## 2. Piece or step closed

**When:** a vertical slice of a deliverable, or a plan step that finishes one, is done; or plan-coordinator reports "wave N closed" / "plan completed" (§ 14).

1. `state.md` panel row of the deliverable:
   - Status: per piece, `piece 1: on-branch; piece 2: spec` (segment rules in formats.md § 4). Code merged to the integration branch → § 3 instead.
   - Evidence: backticked SHAs, the spec or plan path, the progress file path. A SHA of a piece still on a branch only needs to exist. Once any piece is integrated, the Evidence also carries the SHA that entered the integration branch (§ 3).
   - Next step: the next concrete action.
2. `now`: remove the finished item, add the next one in the shape "<action>. Runs: <who>. Approves: <who>. Depends on: <ids>."
3. `log.md`: "E<n> piece <k> closed (<status>)", evidence = SHA or path.
4. Last piece of the deliverable, or last deliverable of a phase → § 9. **Phase exit:** when the last piece of a phase integrates, check the phase's exit criteria first. A criterion with no evidence (no SHA, path or measurement) → add a `now` item "confirm <criterion>" instead of proposing the revision; propose it once every criterion has evidence.
5. Refresh `critical-path.md` (next milestone per track) and the header line (Common).
6. A piece dropped or moved (not closed) is a decision: § 1, including its coverage re-check.

Checker: `bad-status` (word not in vocab), `integrated-no-sha`, `sha-missing`, `now-limit`, `cell-limit`.

The last piece of a deliverable closing also runs § 19.

## 3. Integration

**When:** a branch with roadmap work is merged into the configured `integrationBranch`. With `releaseBranch` set, a merge into that branch is § 15 instead, and the later merge of the release branch into `integrationBranch` is § 16. Decide first, once: `releaseBranch` set or a caller-supplied target (below) → § 15, else this recipe; § 15 never sends the event back here.

Caller-supplied target: when `releaseBranch` is unset and the caller names the branch the work merged into (for example the target of `roadmap-release`), apply § 15 with that branch: on-branch word, merge SHA in Evidence, the branch named in Next step. Never infer the target from the checked-out branch.

1. Get the SHA that entered the integration branch (the merge commit, or the merged tip for a fast-forward or squash result); ask for it if git cannot show it. Verify with `git cat-file -e <sha>^{commit}` and `git merge-base --is-ancestor <sha> <ref>`, where `<ref>` is the local `integrationBranch` or `origin/<integrationBranch>`: either one passing is enough, so a stale local branch is fine (the checker also accepts either). Neither passes → do not mark integrated; tell the user.
2. `state.md` panel: the integrated word (position 6 of `deliverableStatuses`) for the pieces it carries (never set a released status here: that goes through § 12, which also records the package). Put that SHA in backticks in Evidence, alongside any branch SHAs of pieces not yet integrated. The checker needs at least one Evidence SHA that is an ancestor of the integration ref when the row has an integrated segment; the other SHAs only need to exist.
3. `state.md` "in flight": the branch stays `vocab.branchLive` while it exists; deleted → § 4.
4. `log.md`: "E<n> piece <k> integrated into <branch>", evidence the SHA. A log SHA that no longer exists (a deleted or squashed branch) is only a `sha-missing` warning, so old log rows stay as written.
5. Refresh `critical-path.md` (next milestone per track), then § 2 step 4 (end of piece or phase? phase exit criteria first).

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

1. `state.md` blockers: next `BLQ-n` (search `state.md`, `log.md`, `critical-path.md` and the strategy). Columns: Blocker, Affects (`E<n>` list), Since (the day it started), Unblocks when (a condition). A blocker with a deadline writes it as `(due YYYY-MM-DD)` in Unblocks when, a date the user or a source supplied. The `blocker-overdue` warning (the date is before today) is handled by proposing to escalate to the blocker's owner; the checker never closes it.
2. `state.md`: a deliverable the blocker blocks gets the status `vocab.blockedStatus` (Common; a blocked segment cites the `BLQ-n` in its note or Next step). Before overwriting, record the previous status in the BLQ row ("Unblocks when" or note, for example "restores E2 to `piece 1: on-branch`"). Also update Next step of the affected deliverables and `now`. If the blocker forbids an action, also § 13.
   - Exception (§ 17, acceptance pending): the row is already in segments (`code: ...; acceptance: blocked (BLQ-n)`). Keep the segments when opening; do not overwrite the row with the bare blocked word, and record no previous status to restore.
3. `critical-path.md`: the gate it holds, then refresh the next milestone per track (Common).
4. `log.md`: "BLQ-n opened: <short>", evidence a path, URL or SHA.

**Closed:**

1. If a decision closed it, apply § 1 first.
2. `state.md`: read the previous status recorded in the BLQ row, then remove the row (the log keeps the history; the log and the strategy may keep citing a retired `BLQ-n`); restore each affected deliverable from `vocab.blockedStatus` to that previous status (exception, § 17: a row in segments only has its `acceptance` segment updated; `code` and the other segments stay); update panel and `now`; in the panel Next step replace the "wait for BLQ-n" clause with what still waits (other dependencies) or the next concrete action of the restored status; drop `donot` items citing this `BLQ-n`, and remove the `donot` block when none is left. Also rewrite every remaining citation of the closed `BLQ-n` in `state.md` (pending, now, panel notes, donot) and in `critical-path.md`. A `pending` item that must continue is reworded without the BLQ id (for example `(owner) ...`), never deleted only because it cited the blocker.
3. `critical-path.md`: remove the gate node, then refresh the next milestone per track (Common). Also rewrite every remaining citation of the closed `BLQ-n` here and in `state.md` (step 2).
4. The strategy is not edited: it may keep citing the closed `BLQ-n`, and its Open questions entry for it is cleaned at the next approved revision (§ 9).
5. `log.md`: "BLQ-n closed: <how>", evidence. No SHA or path (a phone call) → cite `decisions.md` or `state.md`, whichever now holds the change.

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

**When:** a piece or phase ends, the checker warns `contradiction-unabsorbed`, a requirement awaits a card, or the user asks. Procedure and approval below.

Review before proposing:

- In-force decisions with a filled Contradicts not yet cited by the strategy.
- Requirements with `needs-clarification` or `req-card-asymmetry`.
- Phase exit criteria: met? Next phase entry criteria: met?
- Assumptions whose "re-validate when" condition has fired.
- Open questions (the `E<n>:`-prefixed ones and the global ones) whose pending item or `BLQ` was closed or answered: remove them or mark them answered, citing the `DEC`; also stale citations of retired `BLQ-n`.
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

### Revision procedure (SKILL.md Step 6)

1. **Propose** strategy vN+1 in the conversation, without writing it: the new version (minor bump, `1.0` → `1.1`, unless the user wants a major one for a changed objective or phases), the `DEC` IDs it absorbs, each section that changes with one line on how, card changes (pieces, acceptance, `reqs`, priority), and requirement or coverage changes. Checklist: the "Review before proposing" list above. If nothing needs changing, say so; the user may still ask for a revision.
2. **Ask for approval** (AskUserQuestion when available). Until the user approves, write nothing to the strategy. The proposal lives only in the conversation plus one pending item "(user) approve strategy v<N+1> (absorbs DEC-…)"; nothing else is written. A pre-approval given by a caller or an orchestrator (an autonomy policy, "the owner pre-approved") is not the user's approval: with no person present, write only the pending item and say so in the hand-back. After a compaction or in a new session, regenerate the proposal from the `DEC` rows the pending item names (and the checklist above). The contradiction warning stays and the run may end with it. When the event says `no questions`, never ask: write each unanswered question as a `pending` item `(user) <question>` and list them under `Pending for the user:` in the Step 7 hand-back.
3. **On approval:** update the `version` anchor (`<!-- roadmap:version <N+1> <date> -->`) and the title; add a changelog entry (newest first) listing the absorbed `DEC`; edit the changed sections and cite each absorbed `DEC` ID where it applies; regenerate "Where we are" from `state.md` and `critical-path.md`; add a version-history row. Then update whatever the revision moved (panel rows for new or dropped cards, `requirements.md`, `critical-path.md`, the `state.md` header line), remove the approval pending item, add a `log` row "strategy v<N+1>: absorbs DEC-…" with the strategy path as evidence, and rerun Step 5.
4. **Rejected:** the user may change the decision instead; that is a new decision (§ Decision, superseding the old one).

## 10. Checker refresh

**When:** cold start (SKILL.md Step 1, which then applies this layer in Step 2), the checker warns `checker-stale`, or the user asks.

1. Versions: line 1 of the plugin's checker (SKILL.md Paths) and of `<folder>/check-roadmap.mjs`, header `// check-roadmap <version> format <n>`. `node <file> --version` prints the same `<version> format <n>` from that line. Plugin's not newer → stop.
2. Run the plugin's checker (SKILL.md Paths) on the folder: `node <plugin checker> "<folder>"`; read the exit code and the summary line `check-roadmap: N error(s), M warning(s)`.
3. Exit 0 → copy the plugin's file over the vendored one (`cp`, byte for byte), log "checker refreshed <old> → <new>" with evidence `` `check-roadmap.mjs` ``, remove any "checker … available" pending item.
4. Exit 1 → keep the vendored copy, add or update the pending item "(maintainer) checker <new> available: N errors to fix". Show the errors in the report. Fixing them is a separate request.
   Exit 2 (`ERROR internal`, the new checker crashed) → also a failed refresh: keep the vendored copy and add or update the pending item "(maintainer) checker <new> available: internal error, see output"; show the message in the report.
5. Either way, run the vendored copy for this run's final check (SKILL.md Step 5).

When the refresh and the event both add log rows in one run, both carry the same date (the day of the run) and the event's row goes on top: the refresh happened first (cold start), so it is the older row.

## 11. Migration

**When:** the `formatVersion` in `formats.md` is greater than the config's `formatVersion` (SKILL.md Step 3). A pre-approval given by a caller or an orchestrator never covers a migration: with no person present, add only a pending item and say so in the hand-back.

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

## 12. Package published

**When:** a release package is built and published (installed, shipped or handed to a client). Optional block: if `state.md` has no `releases` block, add it per formats.md and say so in the report.

1. Get the stamped SHA (the commit the package was built from; verify with `git cat-file -e <sha>^{commit}`), the date and the environment (the user or the release log tells; never guess).
2. `state.md` `releases`: when this creates the block for the first time, first backfill one row per deliverable already in a released status (ask for or cite the evidence: package, SHA, date, environment; `-` in fields not known), or the checker fails `released-no-package`. Also add the "package is published" row to the README table (formats.md § 8). Then add a row `Package · Deliverables · State · Stamped SHA · Date · Environment`. The deliverables listed are the ones the package carries.
3. Panel: set each carried deliverable (or piece) to the `vocab.releasedStatuses` word (default `released`; `measured` only after a measurement, § 6). The checker's `released-no-package` error fires when a released deliverable appears in no `releases` row.
4. `now`, `critical-path.md` next milestone per track, header line (Common).
5. `log.md`: "package <name> published to <environment>", evidence the stamped SHA in backticks (or the release log path).

## 13. Do not do now

**When:** a decision or a blocker forbids an action ("do not deploy to X until Y"), or stops forbidding it.

1. Add (to `state.md` `donot`): one list item naming the forbidden action and citing the `BLQ-n` or `DEC-NNN` that forbids it. An item with no reference → checker error `donot-no-ref`. When this creates the block for the first time, also add the "do not do now list changes" row to the README table (formats.md § 8).
2. Remove the item when its `BLQ`/`DEC` is resolved (blocker closed, decision superseded); this happens in the same event that closes it (§ 5, § 1) and again as the pruning pass of every event (Common).
3. `log.md` carries the event that caused the add or the removal; `donot` itself keeps no history.

## 14. Events from plan-coordinator

`plan-coordinator` invokes this skill with the event "wave N closed (steps …)" after each wave gate, and "plan completed" at the end, when its progress file header reads `**Roadmap**: <folder>`.

1. Read that progress file (the one the caller names; otherwise the `docs/plans/**/progress-*.md` whose `**Roadmap**:` field names this folder): the header (`**Plan**`), the Execution Map table (Wave, Group, Steps), the Steps table, the Wave Execution Log and any recorded commit SHAs. Never edit it.
2. Find the deliverable: the panel row whose Evidence or Next step cites that plan (or its spec); else the `E<n>` the plan's title or header names; else ask once. When the event says `no questions`, never ask: write each unanswered question as a `pending` item `(user) <question>` and list them under `Pending for the user:` in the Step 7 hand-back.
3. Decide which pieces closed: a piece closes when every plan step that implements it has Status PASS (or an intentional skip). Map steps to pieces from the plan's own text (a step naming the piece, or a plan that covers exactly one piece). When the progress file cannot tell which piece a step belongs to (an unmapped step): on "wave N closed" add one `log` row "wave N closed (steps …)" and set from the artifacts that exist, per segment and only for a piece whose current status is earlier than that word (never lower a status or collapse segments into one): a plan file → the configured word for plan (position 3), only a spec file → the word for spec (position 2), else leave the status unchanged; on "plan completed" mark the pieces the plan covers with the word for on-branch (position 5). Never infer the integrated word (position 6) without a SHA that is on the integration branch.
4. Record per § Piece or step closed. Evidence = the progress file path in backticks plus the commit SHAs it records (each verified with `git cat-file -e <sha>^{commit}`). Read the current branch with `git branch --show-current` and keep its "in flight" row `live`.
5. Ask the user only for what the progress file cannot tell, such as an integration SHA (a plan that completed on a branch is `on-branch`, not integrated) or an ambiguous step-to-piece mapping. When the event says `no questions`, never ask: write each unanswered question as a `pending` item `(user) <question>` and list them under `Pending for the user:` in the Step 7 hand-back.
6. If a piece or the deliverable closed, run the end-of-piece check (Step 6). Hand back to plan-coordinator with the Step 7 report; it continues with the next wave.

## 15. Merge into the release branch

**When:** `releaseBranch` is set in `roadmap.config.json` and a deliverable (or piece) merges into it. Without `releaseBranch` and without a caller-supplied target (below), use § 3. Order, once: check `releaseBranch` and the caller's target first; § 3 and § 15 never hand the event back and forth.

Caller-supplied target: when `releaseBranch` is unset and the caller names the branch the work merged into (for example the target of `roadmap-release`), apply § 15 with that branch: on-branch word, merge SHA in Evidence, the branch named in Next step. Never infer the target from the checked-out branch.

1. Get the merge SHA on the release branch and verify it with `git cat-file -e <sha>^{commit}`.
2. `state.md` panel: Status is the on-branch word (position 5 of `deliverableStatuses`), never the integrated word. Evidence cites the merge SHA in backticks. Next step names the release branch (for example "release/2026-11 merges into main after the release gate"). Write that note in Next step only, not again per deliverable in another cell or in `now`.
3. `log.md`: "E<n> merged into <releaseBranch>", evidence the merge SHA. Several deliverables merged in one go → one row listing them (Common).
4. Refresh `critical-path.md` and the header line (Common).

Checker: `integrated-no-sha` does not fire for the on-branch word; the `integrated-pending` warning appears later, once the release branch reaches `integrationBranch` (§ 16).

## 16. Release branch integrated

**When:** the release branch is merged into `integrationBranch`, or the checker warns `integrated-pending` (a row whose segments are all on-branch and whose SHAs are already ancestors of the integration branch). At cold start, that warning leads to proposing this recipe to the user.

1. Take one SHA that entered the integration branch (the merge or merged tip); verify as in § 3 step 1. Ask for it if git cannot show it.
2. `state.md` panel: turn every affected row, in one batch, to the integrated word (position 6), and cite that SHA in Evidence next to the existing ones. Only rows whose pieces the merge carried change; others stay.
3. `state.md` "in flight": the release branch stays live while it exists; deleted → § 4.
4. `log.md`: one row "E<a>, E<b> integrated into <integrationBranch> via <releaseBranch>", evidence the SHA.
5. Refresh `critical-path.md`, then § 2 step 4 (phase exit criteria) and the header line.

Checker: `not-integrated`, `integrated-no-sha`; `integrated-pending` should disappear.

## 17. Acceptance pending

**When:** the code of a deliverable is ready but the acceptance (usually human, for example a client sign-off or a smoke test in an environment nobody has yet) is not done.

1. `state.md` panel Status in segments: `code: on-branch; acceptance: blocked (BLQ-n)` (words from `vocab`; segment rules in formats.md § 4). The `BLQ-n` is a real blockers row: open it per § 5 if it does not exist.
2. Evidence cites the code SHA and the gate; Next step names who must accept and what the evidence will be.
3. Human acceptance is never recorded as done without evidence: a sign-off message, a path to the signed record, or a command output the user supplies. No evidence → the acceptance segment stays blocked.
4. When the evidence arrives: update the segment, close the blocker (§ 5), log the acceptance with that evidence. If the card's acceptance items carry `{verify: ...}` tags, the item's tag and evidence must match what was shown (`ac-verify-invalid` / `ac-verify-missing` are the warnings to watch).

## 18. Executor decision

**When:** an executor (an implementing agent or a developer working a plan) made a choice the roadmap did not settle, such as picking a library, a name or a trade-off.

0. Autonomy first. Find the autonomy `DEC`: in `decisions.md`, the newest in-force row with Origin `user` whose Decision names the executor deciding (words "autonomy" or "executor"). If it says the executor does not decide alone, write no `decisions.md` row: add the `state.md` `pending` item "(owner) ratify: <choice>" (naming the `DEC` it diverges from or the gate it changes, when it does) and the `log.md` row "executor choice pending for the owner: <choice>", evidence `state.md`, then stop. No such row, or one that allows it → treat as allowed.
1. `decisions.md`: one row per choice (never bundle two choices in one row). Origin `executor`. Status is the `vocab.decisionPending` word until the owner ratifies it. Discarded alternative: what the executor says it dropped, else `none stated`.
2. If the choice diverges from an existing in-force `DEC`, fill Contradicts with that ID. The executor never replaces an existing decision alone: the row goes to the owner, and the old row stays in force until the owner ratifies (§ 1 step 2 then supersedes it).
3. `state.md` `pending`: one item "(owner) ratify DEC-NNN: <choice>".
4. If the pending decision affects a gate, update the critical-path decision-trail row and the panel Next step (§ 1 step 3).
5. `log.md`: "DEC-NNN recorded (pending ratification)", evidence `` `decisions.md` ``. On ratification: Status to the in-force word, remove the pending item, log it.

Checker: `contradiction-unabsorbed` once a filled, in-force row exists.

## 19. Deliverable closed: criteria check

**When:** the last piece of a deliverable closes (§ 2 step 4) or a review of the deliverable is handed back.

1. Compare the card's `acceptance` items with the criteria of the spec the executor worked from. Every criterion in the spec that is added, weakened or reinterpreted relative to the card becomes a `pending` item "(owner) card says <A>, spec says <B>: confirm"; never edit the card (rule 6 of SKILL.md).
2. A review finding labelled "out of scope" becomes a `pending` item with an owner, never stays only in the review text. Someone else's `BLQ`/`DEC` that already holds it counts as the owner: cite it instead of adding an item.
3. Log the comparison result in the closing `log` row ("criteria compared: none changed" is a valid result).

## 20. Spec, plan or execution started

**When:** a spec is written, a plan is written, or execution of a plan begins for a deliverable, with no piece closed yet.

1. `state.md` panel row of the deliverable: Status is the word at position 2 (spec), 3 (plan) or 4 (executing) of `deliverableStatuses`. Evidence is the path of the spec or the plan in backticks and, for executing, the branch name in backticks. Next step is the next concrete action. **Segmented row** (Status already per piece, such as `piece 1: integrated; piece 2: spec`): change only the segment of the piece this event concerns, and only to a later word among positions 1 to 8 than it has now; keep every other segment as written, and leave a blocked or discarded segment alone. Keep every SHA already in Evidence (an integrated segment needs one, or `integrated-no-sha` fires, and the ancestry check needs it) and add the spec or plan path in backticks next to them; never replace Evidence. Never write one word over a segmented row and never lower a segment (`piece 1: integrated` stays when a spec or plan for piece 2 is recorded). If the event names no piece, leave Status and Evidence unchanged and write a `pending` item (`(user) which piece does the <spec|plan|execution> cover?`); under `no questions` that is the only output, and it overrides steps 3 and 4 and Common's log row and header update (nothing was recorded).
2. Executing only: `state.md` "in flight": add or keep the row of the working branch with Kind `vocab.branchLive`, after confirming it exists (§ 4 step 4).
3. `log.md`: one row, "E<n> spec written" / "E<n> plan written" / "E<n> execution started", evidence the spec or plan path.
4. Close with the refresh of `critical-path.md` (next milestone per track) and the header line (Common).

Checker: `bad-status`, `branch-live-missing`.
