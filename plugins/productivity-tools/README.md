# Productivity Tools

Research, analysis, planning, diagramming, visual whiteboarding and system health skills for strategic work.

## Installation

```bash
claude plugin marketplace add odeciojunior/claude-play
claude plugin install productivity-tools@claude-play
```

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| deep-researcher | in-depth investigation, technical deep-dives, market or competitive analysis, architectural research | Multi-source research on authoritative sources, written as a cited Markdown report |
| plan-coordinator | executing a multi-step plan from `docs/plans/<topic>/plan.md` with subagents, per-step model-tier routing, resuming from `progress.json` | Routes plan steps to agents and model tiers by complexity, groups them into conflict-free parallel waves, and runs them with shared-brief context handoffs. The loop runs in the plugin workflow `productivity-tools:coordinator-workflow` |
| report-analyzer | a report that needs SWOT, gap analysis, risk assessment, or a phased strategic roadmap | SWOT, gap and risk analysis of an existing report, turned into a phased roadmap document. No extra dependencies |
| roadmap-planner | "plan the roadmap for X", "break this initiative into deliverables", "we need a roadmap" | Builds a living roadmap: versioned strategy + tracking folder + vendored checker. Full mode for multi-week initiatives, light mode for small ones |
| roadmap-tracker | an existing roadmap folder (`roadmap.config.json`) after an event: a decision (DEC), blocker (BLQ), closed piece or wave, status request | Keeps an existing roadmap folder current, refreshes its checker, proposes strategy revisions |
| spec-writer | a design spec for one change outside a roadmap: "write a spec for X", "spec this change" | Asks one round of at most five questions, takes one approval, and writes `docs/plans/<topic>/spec.md` through the `spec-author` agent. Not for a roadmap deliverable (use `roadmap-release`) or an implementation plan |
| plan-writer | an implementation plan for a checked spec from `spec-writer`, or adopting an old plan that has no data block: "write the plan for this spec", "adopt this plan" | Dispatches the `plan-author` agent and writes `plan.md` next to the spec. Adoption mode rewrites the old plan in place after one approval. Not for specs, roadmaps or executing a plan (use `plan-coordinator`) |
| roadmap-release | running several roadmap deliverables (E<n>) unattended into a release branch: "run E18", "execute the next deliverables", "release dry-run". The model does not start it; type `/productivity-tools:roadmap-release <args>` | Runs deliverables end to end with a bundled Workflow (spec, plan, reviewed tasks, gates against a baseline, serialized merge with rollback), then verifies the result with git. One plan with one deliverable stays with `plan-coordinator` |
| mermaid-designer | a diagram in Markdown or a Mermaid code block (flowchart, sequence, ER, state, class, Gantt, C4) | Mermaid diagram generation for documentation |
| excalidraw-designer | an `.excalidraw` file or a hand-drawn, sketch or whiteboard look (architecture, flowcharts, mind maps, wireframes) | Hand-drawn style diagrams (.excalidraw files), checked by the bundled Node validator `scripts/validate-excalidraw.mjs` |
| wsl-health-check | a system or WSL health check, a health report, "is the Linux/WSL machine healthy" | Linux or WSL, also from pwsh on Windows with WSL installed; not for Windows without WSL or for macOS. Runs the bundled `scripts/health-report.sh` (no separate install) and summarizes disk, memory, network and services. Key services come from `HEALTH_KEY_SERVICES` (space-separated, default `cron`); `--check-services "<names>"` overrides them for one run |

## Agents

- **spec-author** (`agents/spec-author.md`, `model: opus`, `effort: medium`): writes one `spec/1` design spec for a roadmap card or a standalone request, reads the card and the code first, and records its own decisions. It never asks the person anything. A workflow dispatches it with `agentType: 'productivity-tools:spec-author'`; a skill in the main session dispatches it with `subagent_type: "productivity-tools:spec-author"`.
- **plan-author** (`agents/plan-author.md`, `model: opus`, `effort: medium`): writes one `plan/1` implementation plan for a checked spec, or rewrites an old plan that has no data block, reading the spec and the code first. It never asks the person anything. A workflow dispatches it with `agentType: 'productivity-tools:plan-author'`; a skill in the main session dispatches it with `subagent_type: "productivity-tools:plan-author"`.
- **implementer** (`agents/implementer.md`, no fixed `model` or `effort`: each call passes the ones from its route): implements one task of an approved plan, or fixes a list of review findings, and never asks the person anything. The release workflow dispatches it with `agentType: 'productivity-tools:implementer'` in its six implementation and fix calls; the coordinator workflow (`productivity-tools:coordinator-workflow`) dispatches it the same way for each plan step.
- **task-reviewer** (`agents/task-reviewer.md`, no fixed `model` or `effort`: each call passes the ones from its route): reviews one task of an approved plan by reading only, returns findings with an identifier, and never asks the person anything. The release workflow dispatches it with `agentType: 'productivity-tools:task-reviewer'` in every per-task review; the coordinator workflow (`productivity-tools:coordinator-workflow`) dispatches it the same way.
- **final-reviewer** (`agents/final-reviewer.md`, no fixed `model` or `effort`: the release workflow passes opus and high): reads the whole branch of a deliverable before its gates and merge, one lens per call (mode `review`), or tries to refute the numbered findings of that review (mode `verify`), read-only. It never asks the person anything. The release workflow dispatches it with `agentType: 'productivity-tools:final-reviewer'` in its final review calls; the verification call runs only when `finalReview.adversarial` is on. The coordinator workflow (`productivity-tools:coordinator-workflow`) dispatches it the same way for the final review of a plan.
- **test-integrity** (`agents/test-integrity.md`, no fixed `model` or `effort`: the release workflow passes haiku and low): runs one given Node measurement program on the branch and returns its fields (deleted tests, removed asserts, skips, production files changed, asserts added). It writes and deletes only its own temporary program and never asks the person anything. The release workflow dispatches it with `agentType: 'productivity-tools:test-integrity'` before the final review.
- **script-runner** (`agents/script-runner.md`, no fixed `model` or `effort`: workflows pass `haiku`/`low`, escalating to `sonnet`/`medium` on read retries): runs exactly one given shell command once, without editing any file, and returns its exit code and its full standard output, unchanged. It never asks the person anything. The release workflow dispatches it with `agentType: 'productivity-tools:script-runner'` for the script runs of a deliverable; the coordinator workflow (`productivity-tools:coordinator-workflow`) dispatches it the same way for the state, commit and gate commands of a plan.

## Pipeline

The skills form a natural workflow:

```
deep-researcher → report-analyzer → roadmap-planner → plan-coordinator ⇄ roadmap-tracker
```

1. **Research** a topic with `deep-researcher` → produces a report in `docs/reports/`
2. **Analyze** the report with `report-analyzer` → produces a strategic roadmap in `docs/roadmaps/`
3. **Plan** the roadmap with `roadmap-planner` → writes the tracking folder `docs/plans/roadmap-<topic>/` and the strategy `docs/plans/<date>-roadmap-<topic>.md`
4. **Execute** with `plan-coordinator` → writes `progress.json` and `briefs/` beside `plan.md`; when the plan's data block sets `roadmap`, it calls `roadmap-tracker` once on completion
5. **Keep it alive** with `roadmap-tracker` → updates the roadmap folder in place after decisions, closed pieces and completed plans

`mermaid-designer` is a cross-cutting utility for adding diagrams to any document.

`excalidraw-designer` creates standalone `.excalidraw` diagram files for richer visual whiteboarding.

## Output Directories

| Skill | Output Path |
|-------|-------------|
| deep-researcher | `docs/reports/YYYY-MM-DD-<topic>.md` |
| report-analyzer | `docs/roadmaps/roadmap-<topic>-YYYY-MM-DD.md` |
| roadmap-planner | `docs/plans/roadmap-<topic>/` (tracking folder) + `docs/plans/<date>-roadmap-<topic>.md` (strategy) |
| roadmap-tracker | Updates the existing roadmap folder in place; strategy revisions written only after approval |
| spec-writer | `docs/plans/<topic>/spec.md` |
| plan-writer | `docs/plans/<topic>/plan.md` (or the old plan's own path in adoption mode) |
| plan-coordinator | `docs/plans/<topic>/progress.json` (+ `briefs/`) |
| roadmap-release | `docs/plans/<roadmap-slug>-E<n>/`, `docs/reports/YYYY-MM-DD-<ids>-run.md` |
| mermaid-designer | Inline or `docs/diagrams/<topic>.md` |
| excalidraw-designer | `docs/diagrams/<name>.excalidraw` |

## Prerequisites

- Claude Code with plugin support (`2.1.322+` to launch workflows by name: `plan-coordinator`, `roadmap-release`)
- Node.js >= 18 for `roadmap-planner`, `roadmap-tracker`, `spec-writer`, `plan-writer`, `plan-coordinator`, `roadmap-release` and `excalidraw-designer`
- A WSL/Linux shell, or pwsh on Windows with WSL installed, for wsl-health-check
- No other tools or setup required

## Antigravity (agy)

The skills of this plugin can also be used on Google Antigravity. `<version>` below is the version of your copy of the plugin.

- **Register the skills** in `~/.gemini/config/skills.json`, with a path relative to the `~/.gemini/config/` folder (for example `"vendor/productivity-tools-<version>/skills"`) or an absolute path written with `/`. Never start the path with `~/`: on Windows no skill is discovered.
- **Headless runs (`agy -p`)**: pass `--add-dir "<plugin folder>"` when the plugin is outside the workspace, because `spec-writer` and `plan-writer` read `agents/*.md` from disk.
- **Validation**: `agy plugin validate` rejects the `agents/*.md` files, which use the Claude Code format, although `agy plugin install` exposes the skills.
- **Open gaps**:
  - the agy workflows have no CAPTURE and no review-package (#13);
  - `roadmap-release-agy.py` does not handle declared removed tests or the test floors (#15);
  - there is no native agy package (#16);
  - `spec-writer` and `plan-writer` read the agent file from disk and get no tool note.

## License

MIT
