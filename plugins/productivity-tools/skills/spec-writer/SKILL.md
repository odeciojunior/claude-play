---
name: spec-writer
description: "Use when the person wants a design spec for one change outside a roadmap: asks one round of at most five questions, then dispatches the spec-author agent and shows the decisions. Writes docs/plans/<topic>/spec.md. Not for a roadmap deliverable run by roadmap-release. Not for implementation plans (plan-writer). Long exploratory conversation is lost: you get one round of questions only."
argument-hint: "<what to change, in a sentence or two>"
---

# Spec writer

Turn one request into a checked `spec/1` spec in a single guided pass: one round of questions, one agent call, one approval. This skill does not commit and never commits; the person does.

## Steps

1. Read the request and the code it touches, without asking anything (the minimum needed to word the questions). Derive the topic: a short kebab-case name from the request. If `docs/plans/<topic>/spec.md` already exists, make that one of the questions (overwrite or keep both); with no answer, the topic becomes `<topic>-2`.
2. Ask one round of at most five questions that only the person can answer, in a single `AskUserQuestion` call, each with the recommended option first. Skip anything the code or the request already settles. A second round only if the person asks for it.
3. Build the intake note: the request and the answers verbatim, guesses marked as guesses. Dispatch the agent with the Agent tool, `subagent_type: "productivity-tools:spec-author"`, one `key: value` per line:
   - `mode: interactive`
   - `output: docs/plans/<topic>/spec.md`
   - `specTool: ${CLAUDE_SKILL_DIR}/../../scripts/spec-tool.mjs` (absolute path; if `${CLAUDE_SKILL_DIR}` is empty, use the folder this SKILL.md was loaded from)
   - `topic: <topic>`
   - `language`: the language of the request
   - `intake`: the note
4. Run `node "<specTool>" summary "docs/plans/<topic>/spec.md"` and show the decisions and the items only a person can settle. Ask for one approval. If the person asks for a change, dispatch the agent again with the correction in the intake note, run `node "<specTool>" check "docs/plans/<topic>/spec.md"`, and report the result with no second approval. If the person refuses without saying what to change, stop with the written spec and the summary, and ask nothing more.
5. Report the spec path and that the implementation plan comes from `plan-writer` once it exists.

## Data block

In interactive mode `id` is the topic (not `E<n>`). The agent writes the acceptance criteria from the request, each with a `{verify: ...}` mark (a test with its command, or human), so later plan tooling has evidence per criterion.

## Refusals

- Agent not found (plugin not reloaded): report the error literally and ask for `/reload-plugins`. Do not paste the agent body into the prompt.
- Permission denied when running `spec-tool.mjs`: show the exact rule, by script name with no version in the path, for the person to add: `Bash(node *spec-tool.mjs" *)`. Never edit settings and never suggest running without permission checks.
