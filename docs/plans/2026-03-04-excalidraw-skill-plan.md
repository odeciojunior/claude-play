# Excalidraw Designer Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an `excalidraw-designer` skill in the productivity-tools plugin that generates `.excalidraw` JSON files for freeform visual whiteboarding.

**Architecture:** Single SKILL.md file using a principle-based approach — teaches Claude the Excalidraw JSON format, element types, binding rules, color palette, and layout spacing, then lets it compose diagrams creatively. Direct JSON generation with zero runtime dependencies.

**Tech Stack:** Markdown (SKILL.md), Excalidraw JSON format (.excalidraw files)

---

### Task 1: Create the SKILL.md File — Frontmatter and Workflow

**Files:**
- Create: `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`

**Step 1: Create the skill directory and SKILL.md with frontmatter + workflow**

Write the SKILL.md file with YAML frontmatter and the 6-step workflow section. Follow the pattern from `plugins/productivity-tools/skills/mermaid-designer/SKILL.md` for structure.

```markdown
---
name: excalidraw-designer
description: "Creates hand-drawn style diagrams and visual whiteboards as .excalidraw files. Use for architecture diagrams, flowcharts, mind maps, concept maps, wireframes, or any freeform visual thinking."
---

# Excalidraw Diagram Designer

You are a visual designer who creates hand-drawn style diagrams as `.excalidraw` JSON files. Your diagrams are clear, well-spaced, and use semantic colors to convey meaning.

## Workflow

1. **Understand** — Clarify what the user wants to visualize, the audience, and the style (formal vs. casual)
2. **Plan layout** — Decide element positions using grid-based spacing, choose diagram direction (top-down, left-right, radial)
3. **Compose elements** — Build the JSON elements array with shapes, text, arrows, frames
4. **Apply styling** — Set colors, roughness, stroke styles based on semantic meaning
5. **Write file** — Save to `docs/diagrams/<name>.excalidraw`, create the directory if needed
6. **Validate** — Verify all arrow bindings are bidirectional, no orphaned IDs, valid JSON
```

**Step 2: Verify the file exists**

Run: `ls -la plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`
Expected: File exists with correct path

**Step 3: Commit**

```bash
git add plugins/productivity-tools/skills/excalidraw-designer/SKILL.md
git commit -m "feat(excalidraw-designer): add skill frontmatter and workflow"
```

---

### Task 2: Add the File Structure and Element Reference Section

**Files:**
- Modify: `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`

**Step 1: Append the file structure and element types reference**

Add to SKILL.md after the workflow section:

```markdown
## File Structure

Every `.excalidraw` file is a JSON document with this wrapper:

\```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": { "viewBackgroundColor": "#ffffff", "gridSize": null },
  "files": {}
}
\```

Only `elements` and `appState.viewBackgroundColor` need attention. The `files` object is only for embedded images (rarely needed).

## Element Types

### Shapes

**Rectangle** — Boxes, containers, process steps. Add `"roundness": { "type": 3 }` for rounded corners.

**Ellipse** — Circles and ovals. Set `width === height` for a perfect circle.

**Diamond** — Decision points, conditions. Rotated square geometry.

### Text

Standalone labels or bound inside shapes. Font families: `1` = Virgil (hand-drawn), `2` = Helvetica (clean), `3` = Cascadia (monospace).

Text properties: `text`, `fontSize`, `fontFamily`, `textAlign` ("left"/"center"/"right"), `verticalAlign` ("top"/"middle"/"bottom"), `containerId` (when bound to a shape).

### Connectors

**Arrow** — Connective arrows between shapes. Properties: `points` (array of `[dx, dy]` offsets), `startBinding`, `endBinding`, `startArrowhead`, `endArrowhead` (`null`, `"arrow"`, `"bar"`, `"dot"`, `"triangle"`).

**Line** — Unbound polylines and dividers. Same `points` format as arrows but no binding support.

### Containers

**Frame** — Named visual container. Child elements reference it via `frameId`. Set the frame's `name` property for a display label.

## Base Element Properties

Every element requires these properties:

| Property | Default | Notes |
|----------|---------|-------|
| `id` | — | Unique string (e.g., "rect-1", "arrow-client-api") |
| `type` | — | "rectangle", "ellipse", "diamond", "text", "arrow", "line", "frame" |
| `x`, `y` | — | Top-left position in pixels |
| `width`, `height` | — | Dimensions in pixels |
| `strokeColor` | "#1e1e1e" | Border/stroke color |
| `backgroundColor` | "transparent" | Fill color |
| `fillStyle` | "solid" | "solid", "hachure", "cross-hatch" |
| `strokeWidth` | 2 | Border thickness |
| `strokeStyle` | "solid" | "solid", "dashed", "dotted" |
| `roughness` | 1 | 0=clean, 1=sketchy (default), 2=very rough |
| `opacity` | 100 | 0-100 |
| `seed` | — | Unique random integer per element |
| `angle` | 0 | Rotation in radians |
| `version` | 1 | Always 1 |
| `versionNonce` | — | Any random integer |
| `isDeleted` | false | Always false |
| `groupIds` | [] | Group memberships (shared string IDs) |
| `boundElements` | [] | Arrows and text bound to this element |
| `locked` | false | Always false |
| `roundness` | null | `{ "type": 3 }` for rounded corners |
```

**Step 2: Commit**

```bash
git add plugins/productivity-tools/skills/excalidraw-designer/SKILL.md
git commit -m "feat(excalidraw-designer): add file structure and element reference"
```

---

### Task 3: Add the Critical Binding Rules Section

**Files:**
- Modify: `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`

**Step 1: Append the binding rules section**

This is the most critical section — arrow and text binding is bidirectional. Add after the base properties:

```markdown
## Binding Rules (Critical)

Binding is **bidirectional** — both sides must reference each other. This is the #1 source of broken diagrams.

### Arrow-to-Shape Binding

When an arrow connects Shape A to Shape B, THREE elements must be updated:

**1. The arrow** gets `startBinding` and `endBinding`:
\```json
{
  "type": "arrow",
  "id": "arrow-1",
  "startBinding": { "elementId": "shape-a", "focus": 0, "gap": 5 },
  "endBinding": { "elementId": "shape-b", "focus": 0, "gap": 5 },
  "points": [[0, 0], [200, 0]]
}
\```

**2. Shape A** lists the arrow in `boundElements`:
\```json
{
  "type": "rectangle",
  "id": "shape-a",
  "boundElements": [{ "id": "arrow-1", "type": "arrow" }]
}
\```

**3. Shape B** also lists the arrow in `boundElements`:
\```json
{
  "type": "rectangle",
  "id": "shape-b",
  "boundElements": [{ "id": "arrow-1", "type": "arrow" }]
}
\```

Binding properties:
- `elementId` — the target shape's `id`
- `focus` — where on the shape edge (-1 to 1, 0 = center)
- `gap` — pixel distance from shape boundary (use 5)

### Text-in-Shape Binding

When text is inside a shape, TWO elements must be updated:

**1. The text** gets `containerId`:
\```json
{
  "type": "text",
  "id": "text-1",
  "containerId": "shape-a",
  "textAlign": "center",
  "verticalAlign": "middle"
}
\```

**2. The shape** lists the text in `boundElements`:
\```json
{
  "type": "rectangle",
  "id": "shape-a",
  "boundElements": [{ "id": "text-1", "type": "text" }]
}
\```

A shape with both bound text AND arrows:
\```json
{
  "boundElements": [
    { "id": "text-1", "type": "text" },
    { "id": "arrow-1", "type": "arrow" },
    { "id": "arrow-2", "type": "arrow" }
  ]
}
\```

### Arrow Points

The `points` array uses `[dx, dy]` offsets from the arrow's `(x, y)` position. The first point is **always** `[0, 0]`.

- Horizontal arrow (right): `[[0, 0], [100, 0]]`
- Vertical arrow (down): `[[0, 0], [0, 100]]`
- Diagonal arrow: `[[0, 0], [100, 80]]`
- L-shaped arrow: `[[0, 0], [100, 0], [100, 80]]`

Set the arrow's `width` to the max `dx` and `height` to the max `dy` across all points.
```

**Step 2: Commit**

```bash
git add plugins/productivity-tools/skills/excalidraw-designer/SKILL.md
git commit -m "feat(excalidraw-designer): add critical binding rules section"
```

---

### Task 4: Add Styling and Layout Guidelines

**Files:**
- Modify: `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`

**Step 1: Append the styling and layout sections**

```markdown
## Color Palette

### Pastel Fills (Shape Backgrounds)

| Hex | Semantic Use |
|-----|-------------|
| `#a5d8ff` | Input, APIs, sources |
| `#b2f2bb` | Success, output, completed |
| `#fff3bf` | Notes, decisions |
| `#d0bfff` | Processing, middleware |
| `#ffc9c9` | Error, critical |
| `#c3fae8` | Storage, data |
| `#ffd8a8` | Warning, pending |
| `#eebefa` | Analytics, metrics |

### Stroke Colors

`#1e1e1e` (black/default), `#1971c2` (blue), `#2f9e44` (green), `#f08c00` (orange), `#e03131` (red), `#9c36b5` (purple)

## Style Presets

**Casual** (default for whiteboarding): `roughness: 1`, `fontFamily: 1` (Virgil), `strokeWidth: 2`

**Technical** (for architecture docs): `roughness: 0`, `fontFamily: 2` (Helvetica), `strokeWidth: 2`

## Layout Guidelines

- Start elements at `(100, 100)`, not `(0, 0)`
- Space elements 80-100px apart horizontally, 120-150px vertically
- Align to a 20px grid when possible
- Pad 20-40px inside frames
- Place arrows between shapes — set the arrow's `x, y` to the source shape's edge
- Use descriptive IDs: `"rect-client"`, `"arrow-client-api"`, `"text-client-label"`
```

**Step 2: Commit**

```bash
git add plugins/productivity-tools/skills/excalidraw-designer/SKILL.md
git commit -m "feat(excalidraw-designer): add styling and layout guidelines"
```

---

### Task 5: Add the Working Example

**Files:**
- Modify: `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`

**Step 1: Append a complete working example**

This example shows a 3-node architecture diagram (Client -> API Gateway -> Database) with correct bidirectional binding, semantic colors, and bound text.

```markdown
## Working Example

A 3-node diagram: Client → API Gateway → Database.

\```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [
    {
      "type": "rectangle", "id": "rect-client",
      "x": 100, "y": 100, "width": 160, "height": 80,
      "strokeColor": "#1e1e1e", "backgroundColor": "#a5d8ff",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100, "angle": 0,
      "seed": 1001, "version": 1, "versionNonce": 2001,
      "isDeleted": false, "groupIds": [],
      "boundElements": [
        { "id": "text-client", "type": "text" },
        { "id": "arrow-client-api", "type": "arrow" }
      ],
      "locked": false, "roundness": { "type": 3 }
    },
    {
      "type": "text", "id": "text-client",
      "x": 130, "y": 125, "width": 100, "height": 30,
      "text": "Client App", "fontSize": 20, "fontFamily": 1,
      "textAlign": "center", "verticalAlign": "middle",
      "containerId": "rect-client",
      "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100, "angle": 0,
      "seed": 1002, "version": 1, "versionNonce": 2002,
      "isDeleted": false, "groupIds": [], "boundElements": [],
      "locked": false, "roundness": null
    },
    {
      "type": "rectangle", "id": "rect-api",
      "x": 100, "y": 280, "width": 160, "height": 80,
      "strokeColor": "#1e1e1e", "backgroundColor": "#d0bfff",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100, "angle": 0,
      "seed": 1003, "version": 1, "versionNonce": 2003,
      "isDeleted": false, "groupIds": [],
      "boundElements": [
        { "id": "text-api", "type": "text" },
        { "id": "arrow-client-api", "type": "arrow" },
        { "id": "arrow-api-db", "type": "arrow" }
      ],
      "locked": false, "roundness": { "type": 3 }
    },
    {
      "type": "text", "id": "text-api",
      "x": 115, "y": 305, "width": 130, "height": 30,
      "text": "API Gateway", "fontSize": 20, "fontFamily": 1,
      "textAlign": "center", "verticalAlign": "middle",
      "containerId": "rect-api",
      "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100, "angle": 0,
      "seed": 1004, "version": 1, "versionNonce": 2004,
      "isDeleted": false, "groupIds": [], "boundElements": [],
      "locked": false, "roundness": null
    },
    {
      "type": "rectangle", "id": "rect-db",
      "x": 100, "y": 460, "width": 160, "height": 80,
      "strokeColor": "#1e1e1e", "backgroundColor": "#c3fae8",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100, "angle": 0,
      "seed": 1005, "version": 1, "versionNonce": 2005,
      "isDeleted": false, "groupIds": [],
      "boundElements": [
        { "id": "text-db", "type": "text" },
        { "id": "arrow-api-db", "type": "arrow" }
      ],
      "locked": false, "roundness": { "type": 3 }
    },
    {
      "type": "text", "id": "text-db",
      "x": 135, "y": 485, "width": 90, "height": 30,
      "text": "Database", "fontSize": 20, "fontFamily": 1,
      "textAlign": "center", "verticalAlign": "middle",
      "containerId": "rect-db",
      "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100, "angle": 0,
      "seed": 1006, "version": 1, "versionNonce": 2006,
      "isDeleted": false, "groupIds": [], "boundElements": [],
      "locked": false, "roundness": null
    },
    {
      "type": "arrow", "id": "arrow-client-api",
      "x": 180, "y": 180, "width": 0, "height": 100,
      "points": [[0, 0], [0, 100]],
      "startArrowhead": null, "endArrowhead": "arrow",
      "startBinding": { "elementId": "rect-client", "focus": 0, "gap": 5 },
      "endBinding": { "elementId": "rect-api", "focus": 0, "gap": 5 },
      "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100, "angle": 0,
      "seed": 1007, "version": 1, "versionNonce": 2007,
      "isDeleted": false, "groupIds": [], "boundElements": [],
      "locked": false, "roundness": null
    },
    {
      "type": "arrow", "id": "arrow-api-db",
      "x": 180, "y": 360, "width": 0, "height": 100,
      "points": [[0, 0], [0, 100]],
      "startArrowhead": null, "endArrowhead": "arrow",
      "startBinding": { "elementId": "rect-api", "focus": 0, "gap": 5 },
      "endBinding": { "elementId": "rect-db", "focus": 0, "gap": 5 },
      "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100, "angle": 0,
      "seed": 1008, "version": 1, "versionNonce": 2008,
      "isDeleted": false, "groupIds": [], "boundElements": [],
      "locked": false, "roundness": null
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff", "gridSize": null },
  "files": {}
}
\```

Note how:
- Each shape's `boundElements` lists its text AND its arrows
- Each text's `containerId` points to its shape
- Each arrow's `startBinding`/`endBinding` points to its shapes
- All `id` and `seed` values are unique
- Arrow `points` start with `[0, 0]`
```

**Step 2: Commit**

```bash
git add plugins/productivity-tools/skills/excalidraw-designer/SKILL.md
git commit -m "feat(excalidraw-designer): add complete working example"
```

---

### Task 6: Add Validation Checklist and What NOT to Do

**Files:**
- Modify: `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`

**Step 1: Append validation and anti-patterns**

```markdown
## Validation Checklist

Before writing the file, verify:

- [ ] Output is valid JSON (no comments, no trailing commas)
- [ ] Every arrow's `startBinding.elementId` / `endBinding.elementId` has a matching entry in that shape's `boundElements`
- [ ] Every text's `containerId` has a matching `{ "type": "text" }` entry in that shape's `boundElements`
- [ ] All `id` values are unique across all elements
- [ ] All `seed` values are unique across all elements
- [ ] Arrow `points` array starts with `[0, 0]`
- [ ] Arrow `width` and `height` match the max offsets in `points`
- [ ] File saved to `docs/diagrams/` with a descriptive kebab-case filename

## What NOT to Do

- Do not generate JSON with comments or trailing commas
- Do not forget the reverse `boundElements` entry when binding arrows or text
- Do not reuse `id` or `seed` values across elements
- Do not start arrow `points` with anything other than `[0, 0]`
- Do not place elements at `(0, 0)` — start at `(100, 100)` minimum
- Do not mix roughness styles in a single diagram — pick casual or technical
- Do not create shapes without bound text labels — always label your shapes
- Do not use `fillStyle: "hachure"` with light pastel backgrounds — it looks muddy; use `"solid"` instead
```

**Step 2: Commit**

```bash
git add plugins/productivity-tools/skills/excalidraw-designer/SKILL.md
git commit -m "feat(excalidraw-designer): add validation checklist and anti-patterns"
```

---

### Task 7: Update Plugin Metadata and README

**Files:**
- Modify: `plugins/productivity-tools/.claude-plugin/plugin.json`
- Modify: `plugins/productivity-tools/README.md`
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Add "excalidraw" to plugin.json keywords**

In `plugins/productivity-tools/.claude-plugin/plugin.json`, add `"excalidraw"` to the `keywords` array:

```json
"keywords": ["research", "analysis", "planning", "roadmap", "mermaid", "diagrams", "excalidraw", "health", "wsl", "monitoring"]
```

**Step 2: Add excalidraw-designer to the README skills table**

In `plugins/productivity-tools/README.md`, add a row to the Skills table after `mermaid-designer`:

```markdown
| excalidraw-designer | "create an excalidraw diagram", "draw a whiteboard" | Hand-drawn style diagrams and visual whiteboards (.excalidraw files) |
```

Also add to the Output Directories table:

```markdown
| excalidraw-designer | `docs/diagrams/<name>.excalidraw` |
```

Update the plugin description line to mention excalidraw:

```markdown
Research, analysis, planning, diagramming, and visual whiteboarding skills for strategic work.
```

Also add a note after the `mermaid-designer` cross-cutting utility line:

```markdown
`excalidraw-designer` creates standalone `.excalidraw` diagram files for richer visual whiteboarding.
```

**Step 3: Add "excalidraw" to marketplace.json keywords**

In `.claude-plugin/marketplace.json`, add `"excalidraw"` to the productivity-tools keywords array:

```json
"keywords": ["research", "analysis", "planning", "roadmap", "mermaid", "diagrams", "excalidraw"]
```

**Step 4: Commit**

```bash
git add plugins/productivity-tools/.claude-plugin/plugin.json plugins/productivity-tools/README.md .claude-plugin/marketplace.json
git commit -m "feat(excalidraw-designer): register skill in plugin metadata and docs"
```

---

### Task 8: Verify the Complete Skill

**Files:**
- Read: `plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`

**Step 1: Read the complete SKILL.md and verify structure**

Run: `wc -l plugins/productivity-tools/skills/excalidraw-designer/SKILL.md`
Expected: ~350-450 lines

Verify the file has these sections in order:
1. YAML frontmatter (`name`, `description`)
2. Heading and persona
3. Workflow (6 steps)
4. File Structure
5. Element Types (shapes, text, connectors, containers)
6. Base Element Properties table
7. Binding Rules (Critical) — arrow-to-shape, text-in-shape, arrow points
8. Color Palette
9. Style Presets
10. Layout Guidelines
11. Working Example (complete JSON)
12. Validation Checklist
13. What NOT to Do

**Step 2: Validate the example JSON is parseable**

Run: `python3 -c "import json; json.load(open('docs/diagrams/test-example.excalidraw')); print('Valid JSON')"` (after extracting the example to a temp file)

Or simply verify with: `cat plugins/productivity-tools/skills/excalidraw-designer/SKILL.md | python3 -c "import sys; content = sys.stdin.read(); print('SKILL.md read successfully,', len(content), 'chars')"`

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(excalidraw-designer): final adjustments after verification"
```
