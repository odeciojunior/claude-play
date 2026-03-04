# Productivity Tools

Research, analysis, planning, and diagramming skills for strategic work.

## Installation

```bash
claude plugin marketplace add odeciojunior/claude-play
claude plugin install productivity-tools@claude-play
```

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| deep-research-analyst | "research X", "investigate Y" | Multi-source internet research producing structured reports |
| plan-coordinator | "execute this plan", "build execution map" | Builds execution maps from implementation plans |
| report-analyzer | "analyze this report", "build roadmap from report" | SWOT analysis and strategic roadmap from reports |
| roadmap-planner | "break down this roadmap", "create deliverables" | Decomposes roadmaps into deliverables with acceptance criteria |
| mermaid-designer | "create a diagram", "draw a flowchart" | Mermaid diagram generation for documentation |

## Pipeline

The skills form a natural workflow:

```
deep-research-analyst → report-analyzer → roadmap-planner → plan-coordinator
```

1. **Research** a topic with `deep-research-analyst` → produces a report in `docs/reports/`
2. **Analyze** the report with `report-analyzer` → produces a strategic roadmap in `docs/roadmaps/`
3. **Decompose** the roadmap with `roadmap-planner` → produces deliverables in `docs/roadmaps/`
4. **Execute** with `plan-coordinator` → produces an execution map in `docs/plans/`

`mermaid-designer` is a cross-cutting utility for adding diagrams to any document.

## Output Directories

| Skill | Output Path |
|-------|-------------|
| deep-research-analyst | `docs/reports/YYYY-MM-DD-<topic>.md` |
| report-analyzer | `docs/roadmaps/roadmap-<topic>-YYYY-MM-DD.md` |
| roadmap-planner | `docs/roadmaps/deliverables-<topic>-YYYY-MM-DD.md` |
| plan-coordinator | `docs/plans/<topic>/progress-<plan>.md` |
| mermaid-designer | Inline or `docs/diagrams/<topic>.md` |

## Prerequisites

- Claude Code with plugin support
- No additional tools or setup required

## License

MIT
