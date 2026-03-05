# Excalidraw Designer Skill — Design Document

**Version 1.0 — March 2026**

---

## Overview

A Claude Code skill that generates hand-drawn style diagrams and visual whiteboards as `.excalidraw` JSON files. Designed for freeform visual thinking — architecture diagrams, flowcharts, mind maps, concept maps, wireframes, or any creative visualization.

**Approach**: Principle-based. The skill teaches Claude the Excalidraw JSON format, element types, binding rules, colors, and spacing guidelines — then lets it compose diagrams creatively. No rigid templates per diagram type.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Generation method | Direct JSON | Zero dependencies, works anywhere, full styling control |
| File structure | Single SKILL.md | Consistent with existing plugin skills (mermaid-designer) |
| Element scope | 7 core types | rectangle, ellipse, diamond, text, arrow, line, frame cover 95%+ of use cases |
| Style | Principle-based | Supports freeform whiteboarding; rigid templates would limit creativity |
| Output path | `docs/diagrams/` | Alongside existing `docs/reports/` and `docs/plans/` conventions |

## Skill Identity

- **Name**: `excalidraw-designer`
- **Location**: `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`
- **Description**: "Creates hand-drawn style diagrams and visual whiteboards as .excalidraw files. Use for architecture diagrams, flowcharts, mind maps, concept maps, wireframes, or any freeform visual thinking."

## Workflow (6 Steps)

1. **Understand** — Clarify what the user wants to visualize, the audience, and the style (formal vs. casual)
2. **Plan layout** — Decide element positions using grid-based spacing, choose diagram direction (top-down, left-right, radial)
3. **Compose elements** — Build the JSON elements array with shapes, text, arrows, frames
4. **Apply styling** — Set colors, roughness, stroke styles based on semantic meaning
5. **Write file** — Save to `docs/diagrams/<name>.excalidraw`, create the directory if needed
6. **Validate** — Verify all arrow bindings are bidirectional, no orphaned IDs, valid JSON

## Element Reference

### File Structure

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": { "viewBackgroundColor": "#ffffff", "gridSize": null },
  "files": {}
}
```

### Core Element Types (7)

| Type | Purpose | Key Properties |
|------|---------|----------------|
| `rectangle` | Boxes, containers, process steps | `roundness: { type: 3 }` for rounded corners |
| `ellipse` | Circles, nodes, connectors | `width === height` for circles |
| `diamond` | Decision points, conditions | Rotated square geometry |
| `text` | Labels (standalone or bound to shapes) | `fontFamily`: 1=Virgil, 2=Helvetica, 3=Cascadia |
| `arrow` | Connective arrows between shapes | `startBinding`, `endBinding`, `label` |
| `line` | Unbound polylines, dividers | `points` array, no binding support |
| `frame` | Named visual container | Children reference via `frameId` |

### Base Properties (all elements)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | string | (required) | Unique identifier |
| `type` | string | (required) | Element type |
| `x`, `y` | number | (required) | Top-left corner position |
| `width`, `height` | number | (required) | Dimensions in pixels |
| `strokeColor` | string | `"#1e1e1e"` | Stroke color |
| `backgroundColor` | string | `"transparent"` | Fill color |
| `fillStyle` | string | `"solid"` | `"solid"`, `"hachure"`, `"cross-hatch"` |
| `strokeWidth` | number | `2` | Border thickness |
| `strokeStyle` | string | `"solid"` | `"solid"`, `"dashed"`, `"dotted"` |
| `roughness` | number | `1` | 0=clean, 1=sketchy, 2=very rough |
| `opacity` | number | `100` | 0-100 |
| `seed` | number | (unique random) | Roughjs rendering seed |
| `angle` | number | `0` | Rotation in radians |
| `version` | number | `1` | Set to 1 |
| `versionNonce` | number | (random) | Set to any random int |
| `isDeleted` | boolean | `false` | Always false |
| `groupIds` | array | `[]` | Group memberships |
| `boundElements` | array | `[]` | Bound elements (arrows, text) |
| `locked` | boolean | `false` | Always false |
| `roundness` | object/null | `null` | `{ "type": 3 }` for rounded corners |

### Critical Binding Rules

**Arrow binding is bidirectional:**

On the arrow:
```json
{
  "startBinding": { "elementId": "shape-1", "focus": 0, "gap": 5 },
  "endBinding": { "elementId": "shape-2", "focus": 0, "gap": 5 }
}
```

On BOTH shapes:
```json
{ "boundElements": [{ "id": "arrow-id", "type": "arrow" }] }
```

**Text-in-shape binding:**

On the text: `"containerId": "shape-id"`
On the shape: `"boundElements": [{ "id": "text-id", "type": "text" }]`

**Arrow points** use `[dx, dy]` offsets from the element's `(x, y)`. First point is always `[0, 0]`.

## Styling

### Color Palette

**Pastel fills:**

| Color | Hex | Semantic |
|-------|-----|----------|
| Light Blue | `#a5d8ff` | Input, APIs, sources |
| Light Green | `#b2f2bb` | Success, output, completed |
| Light Yellow | `#fff3bf` | Notes, decisions |
| Light Purple | `#d0bfff` | Processing, middleware |
| Light Red | `#ffc9c9` | Error, critical |
| Light Teal | `#c3fae8` | Storage, data |
| Light Orange | `#ffd8a8` | Warning, pending |
| Light Pink | `#eebefa` | Analytics, metrics |

**Stroke colors:** `#1e1e1e` (black), `#1971c2` (blue), `#2f9e44` (green), `#f08c00` (orange), `#e03131` (red), `#9c36b5` (purple)

### Style Presets

| Style | Roughness | Font | Use Case |
|-------|-----------|------|----------|
| Casual (default) | 1 | Virgil (1) | Whiteboarding, brainstorming |
| Technical | 0 | Helvetica (2) | Architecture, formal docs |

## Layout Guidelines

- 50-100px between elements
- 120-150px between rows/layers
- 20-40px padding inside frames
- Align to 20px grid when possible
- Start at (100, 100) not (0, 0)
- No rigid templates — compose freely based on content

## Working Example

A 3-node diagram: Client -> API Gateway -> Database. Shows rectangles with bound text, arrows with bidirectional binding, semantic colors. ~40-50 lines of JSON.

## Validation Checklist

- [ ] Valid JSON (no comments, no trailing commas)
- [ ] Every `boundElements` entry has a matching reference on the other element
- [ ] Every `containerId` has a matching `boundElements` text entry
- [ ] All `id` values are unique
- [ ] All `seed` values are unique
- [ ] Arrow `points` first entry is `[0, 0]`
- [ ] File saved to `docs/diagrams/` with descriptive filename

## Integration

- Add `excalidraw-designer` to `plugin.json` keywords
- Register in marketplace.json (already covered by productivity-tools entry)
- Update plugin README skills table
- Users can open `.excalidraw` files with VS Code extension (`pomdtr.excalidraw-editor`) or at excalidraw.com

## Estimated Size

~350-450 lines for the SKILL.md file.
