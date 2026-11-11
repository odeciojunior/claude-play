# § 19. Deliverable closed: criteria check

**When:** the last piece of a deliverable closes (§ 2 step 4) or a review of the deliverable is handed back.

1. Compare the card's `acceptance` items with the criteria of the spec the executor worked from, using `references/rubric-criteria.md`. Each criterion that is not `igual` becomes `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" add-pending "<folder>" --owner owner --text "card says <A>, spec says <B>: confirm (<class>)"`; never edit the card (rule 6 of SKILL.md).
2. A review finding labelled "out of scope" becomes a `pending` item with an owner (`add-pending`), never stays only in the review text. Someone else's `BLQ`/`DEC` that already holds it counts as the owner: cite it instead of adding an item.
3. Log the comparison result: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" log "<folder>" --deliverable E<n> --what "E<n> criteria compared: <result>" --evidence <spec path>` ("criteria compared: none changed" is a valid result).
