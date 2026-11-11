# § 8. New requirement mid-flight

**When:** a requirement appears after the roadmap was created.

1. Trace it first: from a document → register it (§ 7) and cite the `SRC`; stated by the user → record the scope decision (§ 1, Origin `user`) and cite the `DEC`.
2. Next ID: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" next-id "<folder>" REQ`. `requirements.md` (`formats.md § 7`): that `REQ-NNN`; Requirement, Type, Sources, Deliverables, Coverage:
   - the user names a deliverable → Deliverables `E<n>`, Coverage `vocab.coverageCovered` (warning `req-card-asymmetry` until a revision adds it to the card's `reqs`);
   - no deliverable yet → Deliverables `-`, Coverage `vocab.coverageNeedsClarification` (warning `needs-clarification`);
   - out of scope → `<vocab.coverageOutOfScope>: <reason>`.
3. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" log "<folder>" --deliverable - --what "REQ-NNN added: <short>" --evidence requirements.md`.
4. Propose a revision (§ 9) that places it in a card or a new deliverable.

Checker: `uncovered-req` (covered with no deliverable, or out of scope without a reason), `unknown-id`.
