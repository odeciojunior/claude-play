---
name: spec-writer
description: "Use when the person wants a design spec for one change outside a roadmap: asks one round of at most five questions, then dispatches the spec-author agent and shows the decisions. Writes docs/plans/<topic>/spec.md. Not for a roadmap deliverable run by roadmap-release. Not for implementation plans (plan-writer). Long exploratory conversation is lost: you get one round of questions only."
argument-hint: "<what to change, in a sentence or two>"
---

# Spec writer

Turn one request into a checked `spec/1` spec in a single guided pass: one round of questions, one agent call, one approval. This skill does not commit and never commits; the person does.

## Steps

1. Read the request and the code it touches, without asking anything (the minimum needed to word the questions). Derive the topic: a short ASCII kebab-case name from the request that matches `^[a-z0-9-]{1,64}$` (strip accents, so `ç` becomes `c` and `ã` becomes `a`; lowercase; replace every other character with `-`; at most 64 characters, counting the `-E<n>` suffix of a roadmap card and the `-2` suffix below), because spec-tool refuses any other id with `id-invalid`. If `docs/plans/<topic>/spec.md` already exists, make that one of the questions (overwrite or keep both); with no answer, the topic becomes `<topic>-2`. That question counts toward the five.
2. Ask one round of at most five questions that only the person can answer, in a single `AskUserQuestion` call, each with the recommended option first (on a host without `AskUserQuestion`, use `ask_question` with the same questions). Skip anything the code or the request already settles. If nothing is left to ask, skip the call. A second round only if the person asks for it.
3. Build the intake note: the request and the answers verbatim, guesses marked as guesses. Dispatch the agent with the Agent tool, `subagent_type: "productivity-tools:spec-author"`, one `key: value` per line:
   - On a host without the Agent tool but with `invoke_subagent`, call it instead with `TypeName: "self"`, `Role: "spec-author"`, `Model: "pro"` and a `Prompt` that tells the subagent to read `<skill_dir>/../../agents/spec-author.md` from disk before the `key: value` fields below (do not paste the body).
   - `mode: interactive`
   - `output: <repository root>/docs/plans/<topic>/spec.md` (absolute path)
   - `specTool: ${CLAUDE_SKILL_DIR}/../../scripts/spec-tool.mjs` (absolute path; if `${CLAUDE_SKILL_DIR}` is empty, use the folder this SKILL.md was loaded from)
   - `topic: <topic>`, except a topic ending in `-E<n>` (a roadmap deliverable): then `topic: E<n>`, the id the spec keeps; `output` still uses the full topic
   - `language`: the language of the request
   - `intake`: the note, always the last field; it may span several lines, and everything after `intake:` is the note
4. If the author's last message is a `check` with errors instead of the `emit` JSON, show the errors and stop without asking for approval. Otherwise run `node "<specTool>" summary "<repository root>/docs/plans/<topic>/spec.md" --lang <pt|en>` (the same absolute path; `pt` if the person writes in Portuguese, otherwise `en`) and show the decisions and the items only a person can settle. Ask for one approval with a single `AskUserQuestion` call (`ask_question` on a host without it) (approve / request a change / refuse); it does not count as a question round. If the person asks for a change, dispatch the agent again with the correction in the intake note, run `node "<specTool>" check "<repository root>/docs/plans/<topic>/spec.md"`, and report the result with no second approval. If the person refuses without saying what to change, stop with the written spec and the summary, and ask nothing more.
5. Report the spec path and that the implementation plan comes from `plan-writer`.

## Data block

In interactive mode `id` is the topic, except a topic ending in `-E<n>` (a roadmap deliverable, from roadmap-planner): then `id` is `E<n>` (the caller passes `topic: E<n>`), so the plan keeps the id the tracker closes from. The agent writes the acceptance criteria from the request, each with a `{verify: ...}` mark (a test with its command, or human), so later plan tooling has evidence per criterion.

## Refusals

- Agent not found (plugin not reloaded): report the error literally and ask for `/reload-plugins`. Do not paste the agent body into the prompt.
- Permission denied when running `spec-tool.mjs`: show the exact rule, by script name with no version in the path, for the person to add: `Bash(node *spec-tool.mjs" *)`. Never edit settings and never suggest running without permission checks.
