# Productivity Tools

Research, analysis, planning, diagramming, and visual whiteboarding skills for strategic work.

## Installation

```bash
claude plugin marketplace add odeciojunior/claude-play
claude plugin install productivity-tools@claude-play
```

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| deep-researcher | "research X", "investigate Y" | Multi-source internet research producing structured reports |
| plan-coordinator | "execute this plan", "build execution map", "resume the plan" | Routes plan steps to agents and model tiers by complexity, groups them into conflict-free parallel waves, and runs them with shared-brief context handoffs |
| report-analyzer | "analyze this report", "build roadmap from report" | SWOT analysis and strategic roadmap from reports |
| roadmap-planner | "plan a new roadmap", "break down this initiative" | Builds a living roadmap: versioned strategy + tracking folder + vendored checker |
| roadmap-tracker | "record this decision", "update the roadmap", "piece closed" | Keeps an existing roadmap folder current, refreshes its checker, proposes strategy revisions |
| mermaid-designer | "create a diagram", "draw a flowchart" | Mermaid diagram generation for documentation |
| excalidraw-designer | "create an excalidraw diagram", "draw a whiteboard" | Hand-drawn style diagrams and visual whiteboards (.excalidraw files) |

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
- Node.js >= 18 for the roadmap checker (roadmap-planner, roadmap-tracker)
- No other tools or setup required

## License

MIT
