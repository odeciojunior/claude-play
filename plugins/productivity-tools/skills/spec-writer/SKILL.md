---
name: spec-writer
description: "Use when the person wants a design spec for one change outside a roadmap: asks one round of at most five questions, then dispatches the spec-author agent and shows the decisions. Writes docs/plans/<topic>/spec.md. Not for a roadmap deliverable run by roadmap-release. Not for implementation plans (plan-writer). Long exploratory conversation is lost: you get one round of questions only."
argument-hint: "<what to change, in a sentence or two>"
---

# Spec writer

Turn one request into a checked `spec/1` spec in a single guided pass: one round of questions, one agent call, one approval. This skill does not commit and never commits; the person does.

## Steps

1. Read the request and the code it touches, without asking anything (the minimum needed to word the questions). Derive the topic: a short ASCII kebab-case name from the request. Normalize it: NFD and drop the combining marks (`ç` becomes `c`, `ã` becomes `a`), lowercase, replace every other character outside `a-z0-9` with `-`, collapse repeated hyphens, trim hyphens at both ends. The result must match `^[a-z0-9-]{1,64}$`. Spec-tool refuses any other id with `id-invalid`. A topic ending in `-E<n>` (`<n>` is `[0-9]+`) is a roadmap card: use it as it came, with an uppercase `E` (`pos-2-3-0-E41`); the regex and the lowercasing apply only to the part before that suffix, and `-E<n>` is always the last part of the topic. The 64-character limit counts the whole topic. If a card topic is longer than 64 characters, do not shorten it: stop and show the error so the owner renames the card. To shorten a derived topic, cut at the limit and remove trailing hyphens, preferring whole words.
   - If `docs/plans/<topic>/spec.md` already exists, the collision is one of the questions of the step 2 round (never a separate call) and counts toward the five. A derived topic whose `<topic>-2/spec.md` does not exist: options keep both (first) or overwrite; "keep both" or no answer makes the topic `<topic>-2` (the base is limited to 62 characters only then; without a collision the limit is 64), "overwrite" keeps it. A card topic (a collision never produces `-2`), or a derived topic whose `<topic>-2/spec.md` also exists: options stop (first) or overwrite; "stop" or no answer ends the skill with nothing written.
2. Ask one round of at most five questions that only the person can answer, in a single `AskUserQuestion` call, each with the recommended option first (on a host without `AskUserQuestion`, use `ask_question` with the same questions). Skip anything the code or the request already settles. If nothing is left to ask, skip the call. A second round only if the person asks for it.
3. Build the intake note: the request and the answers verbatim, guesses marked as guesses. Dispatch the agent with the Agent tool, `subagent_type: "productivity-tools:spec-author"`, one `key: value` per line:
   - On a host without the Agent tool but with `invoke_subagent`, call it instead with `TypeName: "self"`, `Role: "spec-author"`, `Model: "pro"` and a `Prompt` that tells the subagent to read `<skill_dir>/../../agents/spec-author.md` from disk before the `key: value` fields below (do not paste the body).
   - `mode: interactive`
   - `output: <repository root>/docs/plans/<topic>/spec.md` (absolute path)
   - `specTool: ${CLAUDE_SKILL_DIR}/../../scripts/spec-tool.mjs` (absolute path; if `${CLAUDE_SKILL_DIR}` is empty, use the folder this SKILL.md was loaded from)
   - `topic: <topic>`, except a topic ending in `-E<n>` (a roadmap deliverable): then `topic: E<n>`, the id the spec keeps; `output` still uses the full topic
   - `language`: the language of the request
   - `intake`: the note, always the last field; it may span several lines, and everything after `intake:` is the note
4. If the author's last message is a `check` with errors, show it and stop without asking for approval. If it starts with `topic-invalid:`, show the message literally, say that the topic from step 1 was refused, skip step 5 and stop, with no new call. Otherwise run `node "<specTool>" summary "<repository root>/docs/plans/<topic>/spec.md" --lang <pt|en>` (the same absolute path; `pt` if the person writes in Portuguese, otherwise `en`) and show the decisions and the items only a person can settle. Ask for one approval with a single `AskUserQuestion` call (`ask_question` on a host without it) (approve / request a change / refuse); it does not count as a question round. If the person asks for a change, dispatch the agent again with the correction in the intake note, run `node "<specTool>" check "<repository root>/docs/plans/<topic>/spec.md"`, and report the result with no second approval. If the person refuses without saying what to change, stop with the written spec and the summary, and ask nothing more.
5. Report the spec path and that the implementation plan comes from `plan-writer`.

## Data block

In interactive mode `id` is the topic, except a topic ending in `-E<n>` (a roadmap deliverable, from roadmap-planner): then `id` is `E<n>` (the caller passes `topic: E<n>`), so the plan keeps the id the tracker closes from. Cards reach this skill only by a direct call; roadmap-release uses its own workflow. The agent writes the acceptance criteria from the request, each with a `{verify: ...}` mark (a test with its command, or human), so later plan tooling has evidence per criterion.

## Refusals

- Agent not found (plugin not reloaded): report the error literally and ask for `/reload-plugins`. Do not paste the agent body into the prompt.
- Permission denied when running `spec-tool.mjs`: show the exact rule, by script name with no version in the path, for the person to add: `Bash(node *spec-tool.mjs" *)`. Never edit settings and never suggest running without permission checks.
