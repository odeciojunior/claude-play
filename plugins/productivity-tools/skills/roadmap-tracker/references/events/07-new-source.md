# § 7. New source

**When:** a document, issue, URL or note becomes relevant after the roadmap was created.

1. Read it (delegate a long one to a subagent with `model: sonnet`, `effort: medium`, returning ≤10 lines).
2. Next ID: `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" next-id "<folder>" SRC`. `sources.md` (`formats.md § 7`): that `SRC-NN`; Source in backticks, What it is, Read on (today), Reliability.
3. Compare with the existing sources and requirements. A disagreement → `conflicts` item "SRC-a vs SRC-b: <what disagrees>" (`formats.md § 7`). Never resolve it silently: resolving it is a decision (§ 1).
4. New requirements in it → § 8.
5. `node "${CLAUDE_SKILL_DIR}/scripts/roadmap.mjs" log "<folder>" --deliverable - --what "SRC-NN added: <what>" --evidence <source path or URL>`.
