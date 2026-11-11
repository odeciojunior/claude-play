# Event recipes

One recipe per event, one file per recipe under `references/events/`. The numbering is stable: a citation like `events.md § N` resolves through this table. Recipes cite the format contract only by section.

| § | Event | Recipe file |
|---|---|---|
| 1 | Decision | `events/01-decision.md` |
| 2 | Piece or step closed | `events/02-piece-closed.md` |
| 3 | Integration | `events/03-integration.md` |
| 4 | Branch deleted | `events/04-branch-deleted.md` |
| 5 | Blocker opened or closed | `events/05-blocker.md` |
| 6 | Measurement | `events/06-measurement.md` |
| 7 | New source | `events/07-new-source.md` |
| 8 | New requirement mid-flight | `events/08-new-requirement.md` |
| 9 | End of piece or phase (revision) | `events/09-revision.md` |
| 10 | Checker refresh | `events/10-checker-refresh.md` |
| 11 | Migration | `events/11-migration.md` |
| 12 | Package published | `events/12-package-published.md` |
| 13 | Do not do now | `events/13-do-not-do-now.md` |
| 14 | Events from plan-coordinator | `events/14-plan-coordinator.md` |
| 15 | Merge into the release branch | `events/15-merge-release.md` |
| 16 | Release branch integrated | `events/16-release-integrated.md` |
| 17 | Acceptance pending | `events/17-acceptance-pending.md` |
| 18 | Executor decision | `events/18-executor-decision.md` |
| 19 | Deliverable closed: criteria check | `events/19-criteria-check.md` |
| 20 | Spec, plan or execution started | `events/20-spec-plan-started.md` |

Common to every recipe:

- **Log rows**: `roadmap.mjs log` places the row (newest first). A compound event may take one row listing every ID it recorded; log incidents too. Evidence is a SHA, path or URL in backticks, never empty, never "this commit"; with no SHA or path, cite the file that now holds the change.
- **IDs**: `roadmap.mjs next-id`; never reuse or renumber.
- **Words**: statuses, coverage, decision status and branch kind use the exact `vocab` words of the config. Before the first use of the blocked or discarded status, read `vocab.blockedStatus` / `vocab.discardedStatus` (defaults blocked / discarded). If the key or its word is missing from `deliverableStatuses`, add the localized word, set the key in `roadmap.config.json`, log "config: added status <word>" (evidence `roadmap.config.json`). A written spec "reached spec", never "closed".
- **Snapshot and lean panel**: `state.md` is rewritten, never a history; keep `now` within `limits.nowItems`. Panel Evidence holds SHAs, gate IDs and paths only; counts and lists of resolved items go in `log.md`. On `pending-limit`, retire `pending` items that already have an owner elsewhere (a `BLQ`, a `DEC`, a card), logging them; never delete an item nobody else owns.
- **Critical path and header**: a recipe that changes a deliverable's status, a blocker or a decision ends by refreshing `critical-path.md`'s next milestone per track (unknown gate: `unknown - ask at next event`, never an invented gate) and the `state.md` header line, on every event and revision.
- **Pruning**: `roadmap.mjs prune` drops resolved `donot` items and the deleted-branch `inflight` rows already logged; drop `now` items that are done or stale by hand, logging the done ones.
- **Reports with no recipe** (change nothing recorded, add a pending item):
  - *Status regression* (a recorded status went backwards or its evidence is gone): leave Status and Evidence; pending `(user) E<n> reported <old> -> <new>: confirm or send evidence`; log "E<n> status regression reported, not applied", evidence `state.md`.
  - *Finding that affects the strategy, not a decision*: no revision and no `DEC`; pending `(user) approve strategy v<N+1>: <finding>` (§ 9 step 2); log row.
  - *Human act reported done* with no blocker or acceptance behind it: a person said so here → log "<act> reported done by the user" (evidence `state.md`) and drop the waiting pending item; an agent or caller with no named person → pending `(user) send evidence of <act>`, log "reported, not recorded".
- **`no questions`** (SKILL.md rule 8): never ask; write each unanswered question as a `pending` item `(user) <question>`, list it under `Pending for the user:` and take the safe default: § 1 Contradicts unsure → the closest strategy section plus a pending item to confirm, supersession unsure → not superseded; §§ 3 and 16 SHA git cannot show → not integrated; § 6 measurements file not enabled → log only; any other ask → change nothing for that point and write the pending item.
