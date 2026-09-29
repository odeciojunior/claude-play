# plan-coordinator v2 — Design

**Date**: 2026-09-29 | **Plugin**: productivity-tools 1.0.0 → 1.1.0

## Problems in v1

| # | Problem | Effect |
|---|---------|--------|
| 1 | Written for a forked agent ("you do not have Bash/Edit/Task tools"), but `context: fork` was removed in `df2a736`, so the skill runs in the main context | Contradictory instructions; Phase 2 unclear |
| 2 | Phase 2 delegated to `.claude/agents/delegation-protocol.md` — absent in almost every project | Execution had no protocol |
| 3 | Fallback agent `general-executor` does not exist | `Agent` call fails on unmatched steps |
| 4 | Agent discovery read only project `.claude/agents/` | Built-in, plugin and user agents ignored |
| 5 | Routing = description keyword match; no model/complexity dimension | Every step ran on the default (often most expensive) model |
| 6 | No write-conflict check for parallel steps | Parallel agents could edit the same file |
| 7 | Context blocks per step only; no shared brief, report contract, handoff format, fork/continue guidance | Subagents rediscover the project; orchestrator context bloats with transcripts/diffs |
| 8 | Stale limits (30-turn `maxTurns`, fixed 3 concurrent) and hard dependency on `claude-mem` | Arbitrary bundling; broken when the plugin is absent |
| 9 | Name "Task" tool (renamed `Agent`) | Stale terminology |

## Design

**Progressive disclosure** — SKILL.md holds the Phase 1 workflow; detail loads on demand:

- `references/routing.md` — 5-dimension complexity score (Scope, Ambiguity, Reasoning, Blast radius, Verifiability; 0–10) → Inline / haiku / sonnet / opus; overrides (risk floor, mechanical ceiling, read-only → Explore, pinned models, fork inherits model); review gates; escalation ladder; calibration from observed outcomes.
- `references/delegation-protocol.md` — Phase 2 wave loop, three context layers (Shared Brief → upstream Handoffs → Step Card), fork vs fresh vs `SendMessage`, prompt template with a fixed ≤25-line report contract, verification, write-back, compaction recovery.
- `references/progress-template.md` — progress file with Recovery State first, tier/score columns, Shared Brief, Step Cards with Handoff lines.

**Key decisions**

- *Tier for expected total cost*, not per-attempt cost: a failed haiku run + retry costs more than one sonnet run. Unknown dimensions score 1.
- *Cheap implement + strong review* instead of opus implementation where the check is cheap and reliable.
- *Inline route* for tiny steps — no subagent cold start — hard-limited (≤3 per plan, ≤2 files, Blast ≤1) and run between waves to protect orchestrator context and avoid mid-wave writes.
- *Identical Shared Brief as the prompt prefix* for every agent in a wave — consistent conventions; prompt-cache reuse is a possible side benefit only (same agent type + model), not budgeted.
- *Handoffs, not transcripts* — ≤5 lines per step written into the progress file; downstream prompts embed them.
- *Orchestrator runs the full suite once per wave*; executors run targeted checks only.
- *Escalate on capability failure, retry same tier on spec/env failure*; never resend identical prompt at identical tier.
- *Write-set check* per wave, including implicit writes (lockfiles, generated dirs, snapshots, migrations); overlaps are serialized or bundled. Worktree isolation is not used — its changes never reach the main tree the wave gate checks.

## Adversarial review (2026-09-29)

A Fable review found 18 issues; all were applied:

- **Execution correctness:** removed worktree isolation; added implicit writes to the write-set check and a matching prompt rule; waves are now barriers, with gate-failure attribution; `model` is always passed (except fork and kept pins); agent IDs are recorded after launch; recovery uses the card's Files list.
- **Routing:** risk floor beats the mechanical ceiling and the Cheaper/Safer options; "borderline" is defined; inline has hard limits and runs between waves; the ladder covers inline and first-opus failures; review fix-ups are capped at 2 rounds; a gated step is done only after the reviewer's PASS.
- **Resume:** gated on Status and the v2 sections; older formats are rebuilt.
- **Regressions restored:** skip rules, effort totals, saving learnings to memory.
- **Examples:** now follow the rubric and use real agent names.
- **Triggering:** the description distinguishes the skill from `superpowers:subagent-driven-development` / `executing-plans`.
- **Hygiene:** root README version, marketplace description, CLAUDE.md structure tree.
