---
name: excalidraw-designer
description: "Creates hand-drawn style diagrams as .excalidraw files (architecture diagrams, flowcharts, mind maps, wireframes, whiteboards). Use when the user asks for an .excalidraw file or a hand-drawn, sketch or whiteboard look. Not for diagrams embedded in Markdown (use mermaid-designer)."
---

# Excalidraw Diagram Designer

Creates hand-drawn style diagrams as `.excalidraw` JSON files: clear, well-spaced, with semantic colors.

## Workflow

1. **Understand** -- Clarify what the user wants to visualize, the audience, and the style (formal vs. casual). Ask about scope, granularity, and any existing conventions before designing.

2. **Plan layout** -- Decide element positions using grid-based spacing, choose diagram direction (top-down, left-right, radial). Sketch the topology mentally: how many nodes, which connections, what groupings.

3. **Compose elements** -- Build the JSON elements array with shapes, text, arrows, and frames. Every shape gets a text label, every connection gets an arrow with proper bindings.

4. **Apply styling** -- Set colors, roughness, stroke styles based on semantic meaning, using the palette below.

5. **Write file** -- Save to `docs/diagrams/<name>.excalidraw` by default (or the location the user names), creating the directory if needed. Use kebab-case filenames.

6. **Validate** -- Run `node "${CLAUDE_SKILL_DIR}/scripts/validate-excalidraw.mjs" <file>` and fix every reported problem until it prints `OK`. Then check the items the script cannot:
   - [ ] Arrow `points` start with `[0, 0]`
   - [ ] Arrow `width` and `height` match the max absolute offsets in `points`
   - [ ] One roughness style across the diagram
   - [ ] No JSON comments or trailing commas

## Binding Rules (Critical)

Incorrect bindings produce broken diagrams where arrows float detached from shapes and text appears outside containers. Every binding is bidirectional.

### Arrow-to-Shape Binding

Binding an arrow to shapes requires **THREE** elements to be updated:

1. **Arrow** gets `startBinding` and `endBinding`:
   ```json
   {
     "startBinding": { "elementId": "rect-source", "focus": 0, "gap": 5 },
     "endBinding": { "elementId": "rect-target", "focus": 0, "gap": 5 }
   }
   ```

2. **Source shape** lists the arrow in its `boundElements`:
   ```json
   { "boundElements": [{ "id": "arrow-source-target", "type": "arrow" }] }
   ```

3. **Target shape** also lists the arrow in its `boundElements`.

### Text-in-Shape Binding

Binding text inside a shape requires **TWO** elements to be updated:

1. **Text** gets `containerId` pointing to the shape: `{ "containerId": "rect-source" }`
2. **Shape** lists the text in its `boundElements`: `{ "boundElements": [{ "id": "text-source", "type": "text" }] }`

A shape holding text and two arrows lists all three:

```json
{
  "boundElements": [
    { "id": "text-api", "type": "text" },
    { "id": "arrow-client-api", "type": "arrow" },
    { "id": "arrow-api-db", "type": "arrow" }
  ]
}
```

### Arrow Points

Arrow `points` are `[dx, dy]` offsets from the arrow's `x, y` position. The first point is always `[0, 0]`.

- **Horizontal** (right, 200px): `[[0, 0], [200, 0]]`
- **Vertical** (down, 100px): `[[0, 0], [0, 100]]`
- **Diagonal**: `[[0, 0], [150, 100]]`
- **L-shaped** (down then right): `[[0, 0], [0, 80], [150, 80]]`

Set the arrow's `width` to the max absolute `dx` value and `height` to the max absolute `dy` value across all points.

Full worked example: [references/example-3-node.md](references/example-3-node.md)

## File Structure

Every `.excalidraw` file is a JSON document with this wrapper:

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

Only `elements` and `appState.viewBackgroundColor` need your attention. The `files` object is only for embedded images (rarely needed).

## Element Types

### Shapes

- **Rectangle** -- `type: "rectangle"`. Use `roundness: { type: 3 }` for rounded corners. Default width 160, height 80.
- **Ellipse** -- `type: "ellipse"`. Set `width === height` for a perfect circle.
- **Diamond** -- `type: "diamond"`. Useful for decision nodes in flowcharts.

### Text

`type: "text"`. Key properties:

- `text` -- the displayed string
- `fontSize` -- size in pixels (default 20)
- `fontFamily` -- 1 = Virgil (hand-drawn), 2 = Helvetica (clean), 3 = Cascadia (monospace)
- `textAlign` -- "left", "center", or "right"
- `verticalAlign` -- "top" or "middle" (use "middle" when inside a container)
- `containerId` -- ID of the parent shape when text is bound inside a container

### Connectors

- **Arrow** -- `type: "arrow"`. Properties: `points`, `startBinding`, `endBinding`, `startArrowhead` (null), `endArrowhead` ("arrow", "bar", "dot", "triangle", or null).
- **Line** -- `type: "line"`. Properties: `points`. Lines have no binding system -- they are purely decorative connectors.

### Containers

- **Frame** -- `type: "frame"`. Named grouping container. Child elements reference the frame via their `frameId` property. Use frames to visually group related elements (e.g., a microservice boundary).

## Element Properties

Every element also carries the usual geometry and style fields (`x`, `y`, `width`, `height`, `strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `strokeStyle`, `roughness`, `opacity`, `angle`, `version`, `isDeleted`, `groupIds`, `locked`). The non-obvious ones:

| Property | Notes |
|---|---|
| id | Unique string; descriptive IDs recommended: "rect-client", "arrow-a-b" |
| seed | Unique int per element (random seed for roughness rendering) |
| versionNonce | Unique int per element (version tracking) |
| boundElements | Array of `{id, type}` for bound text and arrows (see Binding Rules) |
| roundness | `null`, or `{ type: 3 }` for rounded rectangles |
| startBinding / endBinding | Arrows only: `{ elementId, focus, gap }` |
| roughness | 0 = smooth, 1 = hand-drawn, 2 = very rough |
| fillStyle | "solid", "hachure", "cross-hatch" |

## Color Palette

### Pastel Fills

| Hex | Semantic Use |
|---|---|
| #a5d8ff | Input / APIs |
| #b2f2bb | Success / Output |
| #fff3bf | Notes / Decisions |
| #d0bfff | Processing |
| #ffc9c9 | Error / Critical |
| #c3fae8 | Storage / Data |
| #ffd8a8 | Warning / Pending |
| #eebefa | Analytics / Metrics |

### Stroke Colors

| Hex | Color |
|---|---|
| #1e1e1e | Black (default) |
| #1971c2 | Blue |
| #2f9e44 | Green |
| #f08c00 | Orange |
| #e03131 | Red |
| #9c36b5 | Purple |

## Style Presets

### Casual (default)

Hand-drawn feel, good for brainstorming and informal diagrams: `roughness` 1, `fontFamily` 1 (Virgil), `strokeWidth` 2.

### Technical

Clean and precise, good for architecture docs and formal presentations: `roughness` 0, `fontFamily` 2 (Helvetica), `strokeWidth` 2.

## Layout Guidelines

- **Start at (100, 100)** -- never place elements at (0, 0). Leave margin for the canvas edge.
- **Horizontal spacing**: 80-100px between elements in the same row.
- **Vertical spacing**: 120-150px between rows.
- **Align to 20px grid** -- use coordinates divisible by 20 for clean alignment.
- **Frame padding**: 20-40px inside frame boundaries.
- **Arrow positioning**: Set arrow `x, y` at the source shape's edge (center-bottom for vertical flows, center-right for horizontal flows).
- **Descriptive IDs**: Use readable IDs like `"rect-client"`, `"arrow-client-api"`, `"text-db"` instead of random strings.

## Opening the Output

Users can open `.excalidraw` files on [excalidraw.com](https://excalidraw.com/) (drag and drop), in VS Code with the `pomdtr.excalidraw-editor` extension, or in Obsidian with the Excalidraw plugin. Since `.excalidraw` files are not rendered in Markdown, add a brief text description in the surrounding document explaining what the diagram shows.

## What NOT to Do

- **Don't use fillStyle "hachure" with pastel backgrounds** -- use "solid" fill with pastel colors for clean, readable diagrams.
- **Don't mix roughness styles in one diagram** -- pick casual (roughness 1) or technical (roughness 0) and stay consistent.
- **Don't create shapes without text labels** -- every shape should have a bound text element describing its purpose.
