# Productivity Tools Plugin Design

**Plugin for the claude-play marketplace providing research, analysis, planning, and diagramming skills.**

**Version 1.0 — March 2026**

---

## Overview

A new `productivity-tools` plugin for the claude-play marketplace containing five forked skills that form a strategic work pipeline: research → analyze → plan → execute, plus a diagram utility.

## Plugin Structure

```
plugins/productivity-tools/
  .claude-plugin/plugin.json
  skills/
    deep-research-analyst/SKILL.md
    plan-coordinator/SKILL.md
    report-analyzer/SKILL.md
    roadmap-planner/SKILL.md
    mermaid-designer/SKILL.md
  README.md
```

## Skills

| Skill | Model | Purpose | Output Path |
|---|---|---|---|
| `deep-research-analyst` | claude-opus-4-6 | Multi-source internet research | `docs/reports/` |
| `plan-coordinator` | claude-opus-4-6 | Execution maps from implementation plans | `docs/plans/<topic>/progress-*.md` |
| `report-analyzer` | claude-opus-4-6 | SWOT analysis + strategic roadmaps | `docs/roadmaps/` |
| `roadmap-planner` | claude-opus-4-6 | Decompose roadmaps into deliverables | `docs/roadmaps/deliverables-*.md` |
| `mermaid-designer` | claude-sonnet-4-6 | Mermaid diagram generation | Inline or `docs/diagrams/` |

### Pipeline Relationship

```
deep-research-analyst → report-analyzer → roadmap-planner → plan-coordinator
        ↑                                                          ↑
  "Research X"                                            "Execute the plan"
```

`mermaid-designer` is a cross-cutting utility any skill can reference for visual output.

## Design Decisions

### All skills forked (`context: fork`)

Every skill runs in an isolated subagent. The heavy analytical skills (research, analysis, planning) do 25-50 tool calls and would overwhelm the main context window. Mermaid designer is lighter but keeping all five consistent simplifies the plugin design.

### Standard skill frontmatter

Agent-style frontmatter fields adapted to the supported skill schema:

| Agent field | Skill equivalent | Action |
|---|---|---|
| `name` | `name` | Kept |
| `description` | `description` | Kept, single-line |
| `model: opus` | `model: claude-opus-4-6` | Full model ID |
| `model: sonnet` | `model: claude-sonnet-4-6` | For mermaid-designer |
| `tools` / `disallowedTools` | `allowed-tools` | Whitelist only |
| — | `context: fork` | Added to all |
| `permissionMode` | — | Dropped (unsupported) |
| `memory` | — | Dropped; guidance kept in body |
| `maxTurns` | — | Dropped; turn budget kept in body |
| `color` | — | Dropped (unsupported) |
| `mcpServers` | — | Dropped; MCP instructions kept in body |
| `skills` (references) | — | Dropped; cross-references kept as text |

### plan-coordinator generalized

- "BDesk v2 project" → "the current project"
- Agent discovery: auto-discovers `.claude/agents/*.md`, falls back to `general-executor` if none exist
- BDesk-specific executor names replaced with generic examples (`backend-executor`, `frontend-executor`, `test-executor`)
- Path conventions kept as conventions, not hard requirements

### report-analyzer and roadmap-planner

- `skills: report-standards` reference dropped (doesn't exist in this plugin); quality standards kept inline
- `mcpServers` dropped from frontmatter; claude-mem search instructions kept in body

### deep-research-analyst and mermaid-designer

- No content changes needed. Already fully generic and project-agnostic.

## Marketplace Integration

### marketplace.json entry

```json
{
  "name": "productivity-tools",
  "source": "./plugins/productivity-tools",
  "description": "Research, analysis, planning, and diagramming skills for strategic work",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["research", "analysis", "planning", "roadmap", "mermaid", "diagrams"],
  "category": "productivity",
  "tags": ["strategy", "documentation"]
}
```

### CLAUDE.md updates

- Add `productivity-tools` to the Plugins table with description and skill list
- Update plugin count

## Frontmatter Examples

### deep-research-analyst

```yaml
---
name: deep-research-analyst
description: "Conducts comprehensive, multi-source internet research on any topic. Use when the user needs in-depth investigation across authoritative sources, including technical deep-dives, market analysis, competitive intelligence, or architectural research."
model: claude-opus-4-6
context: fork
allowed-tools: Read, Write, Grep, Glob, WebSearch, WebFetch
---
```

### plan-coordinator

```yaml
---
name: plan-coordinator
description: "Builds Execution Maps from implementation plans by analyzing steps, assigning executor agents, grouping for parallelism, and writing the map to a progress file for approval. Use when you need to plan the execution of a multi-step plan from docs/plans/."
model: claude-opus-4-6
context: fork
allowed-tools: Read, Write, Grep, Glob, AskUserQuestion
---
```

### report-analyzer

```yaml
---
name: report-analyzer
description: "Strategic report analyst. Deeply analyzes reports to extract SWOT findings, gap analysis, and risk assessment, then builds phased roadmaps with strategic pillars, milestones, and priority-ranked initiatives. Use when the user has a report and needs strategic planning or actionable roadmap creation."
model: claude-opus-4-6
context: fork
allowed-tools: Read, Write, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
---
```

### roadmap-planner

```yaml
---
name: roadmap-planner
description: "Decomposes strategic roadmaps and initiatives into structured deliverables with clear acceptance criteria. Use when the user needs to break down a roadmap, plan, or strategic goal into actionable work packages that stakeholders can verify."
model: claude-opus-4-6
context: fork
allowed-tools: Read, Write, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
---
```

### mermaid-designer

```yaml
---
name: mermaid-designer
description: "Designs and generates Mermaid diagrams for documentation, architecture, data flows, roadmaps, and technical illustrations. Use when the user needs any kind of visual diagram, chart, or flowchart embedded in Markdown."
model: claude-sonnet-4-6
context: fork
allowed-tools: Read, Write, Edit, Grep, Glob, AskUserQuestion
---
```

## What's NOT Changing

The skill body content (workflows, templates, quality checklists, operating rules) stays intact from the user's drafts — only frontmatter format and project-specific references change.
