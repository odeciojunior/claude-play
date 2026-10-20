# Mermaid per-type syntax and examples

## Contents

- Node shapes
- Styling (themes, custom colors, CSS classes)
- Per-type syntax gotchas (Gantt, Pie, Mindmap, Sequence)
- Layout optimization (ELK, positioning)
- GitHub rendering compatibility
- Examples: ERD, data pipeline, C4, quadrant, timeline

## Node shapes

```
[Rectangle]           %% Default, most common
(Rounded)             %% Softer visual, secondary
([Stadium])           %% Start/end points
[[Subroutine]]        %% External processes
[(Database)]          %% Data stores
((Circle))            %% Connectors, events
{Diamond}             %% Decisions
{{Hexagon}}           %% Preparation steps
[/Parallelogram/]     %% Input/output
```

## Styling

### Theme selection

| Theme | When to use |
|-------|-------------|
| `default` | General purpose, most readable |
| `neutral` | Print-friendly, black/white documents |
| `dark` | Dark-mode interfaces |
| `forest` | Green palette, nature-themed docs |
| `base` | Only theme that supports custom colors |

### Custom colors (requires `theme: base`)

```yaml
---
config:
  theme: base
  themeVariables:
    primaryColor: '#4a90d9'
    primaryTextColor: '#ffffff'
    primaryBorderColor: '#2c5f8a'
    lineColor: '#666666'
    secondaryColor: '#f0f4f8'
    tertiaryColor: '#e8f5e9'
---
```

### CSS classes

```
classDef highlight fill:#ff6b6b,stroke:#c92a2a,stroke-width:2px,color:#fff
classDef muted fill:#f5f5f5,stroke:#ccc,color:#666

A[Critical]:::highlight --> B[Normal] --> C[Inactive]:::muted
```

## Per-type syntax gotchas

**Gantt:**
- Task names must NOT contain `:`, `&`, `+`, or `()`; these break the parser. Use `and` instead of `&`.
- Section names must NOT contain `:`.
- Parenthetical notation like `(9h)` in task names causes parse failures; write `9h`.

**Pie:**
- Entries with value `0` produce invisible/empty slices; omit them.
- Keep label text short; long labels overflow the chart.

**Mindmap:**
- `<br/>` is not reliably supported in node text; use short single-line labels.
- The root node uses `root((Label))`; keep it concise.

**Sequence diagram:**
- `<br/>` in participant aliases works but can cause layout issues with long text.
- Keep participant names short; use `as` for display names.

## Layout optimization

For diagrams with 20+ nodes, try the ELK layout engine:

```yaml
---
config:
  layout: elk
  flowchart:
    nodeSpacing: 50
    rankSpacing: 80
---
```

Positioning:
- Order node definitions to match the desired layout (first defined = first positioned).
- Use invisible links (`~~~`) to nudge positioning.
- Place related nodes in subgraphs to cluster them.

## GitHub rendering compatibility

Support changes over time. Check GitHub's current list: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams

This list may be out of date; check GitHub's diagram docs (link above) for the current support.
- Generally rendered: flowchart, sequenceDiagram, stateDiagram-v2, classDiagram, erDiagram, gantt, journey, pie, gitGraph.
- May render inconsistently (note this next to the diagram): C4, architecture, block-beta, sankey-beta, xychart-beta, kanban.

## Examples

### Data architecture (ERD)

```
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  CUSTOMER {
    int id PK
    string name
    string email UK
  }
```

- Include PK, FK, UK annotations.
- Use clear entity names (singular, UPPER_CASE).
- Show cardinality on every relationship.

### Data pipeline flow

```
flowchart LR
  subgraph Sources["Data Sources"]
    API[(API)]
    DB[(Database)]
    Files[/Files/]
  end

  subgraph Processing["Processing"]
    Ingest[Ingestion]
    Transform[Transformation]
  end

  subgraph Storage["Storage"]
    Lake[(Data Lake)]
    Warehouse[(Data Warehouse)]
  end

  API --> Ingest
  DB --> Ingest
  Files --> Ingest
  Ingest --> Transform
  Transform --> Lake
  Transform --> Warehouse
```

### System architecture (C4)

Start with C4Context for the big picture, then drill down to C4Container.

```
C4Context
  title System Context Diagram
  Person(user, "User", "End user of the system")
  System(system, "Main System", "Core platform")
  System_Ext(ext, "External API", "Third-party service")
  Rel(user, system, "Uses", "HTTPS")
  Rel(system, ext, "Calls", "REST API")
```

### Technology comparison (quadrant)

```
quadrantChart
  title Technology Selection Matrix
  x-axis Low Maturity --> High Maturity
  y-axis Low Performance --> High Performance
  Tool_A: [0.7, 0.8]
  Tool_B: [0.3, 0.6]
  Tool_C: [0.8, 0.5]
```

### Product roadmap (timeline)

```
timeline
  title Product Roadmap
  section Q1 - Foundation
    Jan : Project kickoff
    Feb : MVP release
    Mar : Beta testing
  section Q2 - Growth
    Apr : Enterprise features
    May : Mobile app
    Jun : API v2
```
