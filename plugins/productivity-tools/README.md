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
| plan-coordinator | executing a multi-step plan from `docs/plans/` or `docs/superpowers/plans/` with subagents, per-step model-tier routing, resuming from the progress file | Routes plan steps to agents and model tiers by complexity, groups them into conflict-free parallel waves, and runs them with shared-brief context handoffs |
| report-analyzer | a report that needs SWOT, gap analysis, risk assessment, or a phased strategic roadmap | SWOT, gap and risk analysis of an existing report, turned into a phased roadmap document. No extra dependencies |
| roadmap-planner | "plan the roadmap for X", "break this initiative into deliverables", "we need a roadmap" | Builds a living roadmap: versioned strategy + tracking folder + vendored checker. Full mode for multi-week initiatives, light mode for small ones |
| roadmap-tracker | an existing roadmap folder (`roadmap.config.json`) after an event: a decision (DEC), blocker (BLQ), closed piece or wave, status request | Keeps an existing roadmap folder current, refreshes its checker, proposes strategy revisions |
| mermaid-designer | a diagram in Markdown or a Mermaid code block (flowchart, sequence, ER, state, class, Gantt, C4) | Mermaid diagram generation for documentation |
| excalidraw-designer | an `.excalidraw` file or a hand-drawn, sketch or whiteboard look (architecture, flowcharts, mind maps, wireframes) | Hand-drawn style diagrams (.excalidraw files), checked by the bundled Node validator `scripts/validate-excalidraw.mjs` |
| wsl-health-check | a system or WSL health check, a health report, "is the Linux/WSL machine healthy" | WSL/Linux only. Runs the bundled `scripts/health-report.sh` (no separate install) and summarizes disk, memory, network and services. Key services come from `HEALTH_KEY_SERVICES` (space-separated, default `cron`); `--check-services "<names>"` overrides them for one run |

## Pipeline

The skills form a natural workflow:

```
deep-researcher → report-analyzer → roadmap-planner → plan-coordinator ⇄ roadmap-tracker
```

1. **Research** a topic with `deep-researcher` → produces a report in `docs/reports/`
2. **Analyze** the report with `report-analyzer` → produces a strategic roadmap in `docs/roadmaps/`
3. **Plan** the roadmap with `roadmap-planner` → writes the tracking folder `docs/plans/roadmap-<topic>/` and the strategy `docs/plans/<date>-roadmap-<topic>.md`
4. **Execute** with `plan-coordinator` → produces an execution map in `docs/plans/`; when the plan has a `**Roadmap:**` line it calls `roadmap-tracker`
5. **Keep it alive** with `roadmap-tracker` → updates the roadmap folder in place after decisions, closed pieces and plan waves

`mermaid-designer` is a cross-cutting utility for adding diagrams to any document.

`excalidraw-designer` creates standalone `.excalidraw` diagram files for richer visual whiteboarding.

## Output Directories

| Skill | Output Path |
|-------|-------------|
| deep-researcher | `docs/reports/YYYY-MM-DD-<topic>.md` |
| report-analyzer | `docs/roadmaps/roadmap-<topic>-YYYY-MM-DD.md` |
| roadmap-planner | `docs/plans/roadmap-<topic>/` (tracking folder) + `docs/plans/<date>-roadmap-<topic>.md` (strategy) |
| roadmap-tracker | Updates the existing roadmap folder in place; strategy revisions written only after approval |
| plan-coordinator | `docs/plans/<topic>/progress-<plan>.md` |
| mermaid-designer | Inline or `docs/diagrams/<topic>.md` |
| excalidraw-designer | `docs/diagrams/<name>.excalidraw` |

## Prerequisites

- Claude Code with plugin support
- Node.js >= 18 for the roadmap checker (roadmap-planner, roadmap-tracker) and the Excalidraw validator (excalidraw-designer)
- A WSL/Linux shell for wsl-health-check
- No other tools or setup required

## License

MIT
