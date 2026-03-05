# Excalidraw Skill Patterns & Best Practices

**Deep research for building a Claude Code skill that generates Excalidraw diagrams**

**Version 1.0 — March 2026**

> **What's New**: Comprehensive research into Excalidraw's JSON format, element types, programmatic generation patterns, AI integrations, and ecosystem tooling — specifically to inform building a Claude Code skill for diagram generation.

> **Note**: "Skill" in this report refers to a Claude Code skill (a SKILL.md file that teaches Claude how to perform a task). An "Excalidraw skill" generates `.excalidraw` JSON files that can be opened in Excalidraw editors.

---

## Executive Summary

Excalidraw is an open-source virtual whiteboard with a hand-drawn aesthetic, widely adopted in developer tooling (VS Code, Obsidian, IDE integrations). Its `.excalidraw` file format is a well-documented JSON schema that can be generated programmatically without any runtime dependencies — making it ideal for a Claude Code skill.

The most effective pattern for AI diagram generation is **direct JSON output**: the LLM generates complete `.excalidraw` JSON and writes it to disk. Several community skills already exist (notably `coleam00/excalidraw-diagram-skill` with 470+ stars and `rnjn/cc-excalidraw-skill` with 52 stars), providing proven patterns to build upon.

### Research Context

| Parameter | Specification |
|-----------|---------------|
| Topic | Excalidraw diagram generation via Claude Code skills |
| Scope | JSON format, element types, AI generation patterns, ecosystem tools |
| Date | 2026-03-04 |
| Sources consulted | 25+ |
| Confidence | High |

### Key Findings — Overview

| Finding | Confidence | Impact |
|---------|------------|--------|
| Direct JSON generation is the best approach for a Claude Code skill (no dependencies) | High | Core architecture decision |
| The `ExcalidrawElementSkeleton` API simplifies element creation but requires npm | High | Alternative for Node.js projects |
| Arrow binding is bidirectional — arrows AND shapes must reference each other | High | Critical for correct diagrams |
| Layout must be computed manually — no auto-layout in Excalidraw | High | Skill must include layout guidance |
| Existing skills (coleam00, rnjn) provide proven patterns and templates | High | Can adapt rather than build from scratch |
| Official MCP server exists for real-time canvas control | Medium | Future enhancement path |

---

## 1. Excalidraw Core Concepts

### 1.1. What is Excalidraw?

Excalidraw is a free, open-source (MIT) virtual whiteboard that renders diagrams in a hand-drawn style using the [roughjs](https://roughjs.com/) library. It runs in the browser at [excalidraw.com](https://excalidraw.com/) with no account required.

**Key differentiators**: infinite canvas, real-time E2E-encrypted collaboration, offline-first PWA, embeddable React component, and roundtrip-capable exports (SVG/PNG files embed the full JSON source).

**Philosophy**: The hand-drawn aesthetic is intentional — it signals "this is a draft, let's discuss" rather than "this is final." This makes it ideal for brainstorming, architecture discussions, and rapid prototyping.

### 1.2. File Format (`.excalidraw`)

A `.excalidraw` file is UTF-8 JSON:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": null
  },
  "files": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"excalidraw"` | Format discriminator (always `"excalidraw"`) |
| `version` | `2` | Schema version (always 2) |
| `source` | string | Origin URL |
| `elements` | array | All scene elements; render order = array order (first = back) |
| `appState` | object | Canvas config (background color, grid size, etc.) |
| `files` | object | Map of `FileId` -> base64 image data for image elements |

**MIME types**: `.excalidraw` = `application/vnd.excalidraw+json`, `.excalidrawlib` = `application/vnd.excalidrawlib+json`

**Recommendation**: For a skill generating diagrams, only `elements` and `appState.viewBackgroundColor` need attention. The `files` object is only needed for embedded images.

---

## 2. Element Types

Excalidraw supports 11 drawable element types:

| Category | Type | Description | Bindable? |
|----------|------|-------------|-----------|
| **Basic shapes** | `rectangle` | Box with optional rounded corners | Yes |
| | `ellipse` | Circle/oval | Yes |
| | `diamond` | Rotated square (decision nodes) | Yes |
| **Linear** | `line` | Multi-point polyline, no binding | No |
| | `arrow` | Connective arrow with bindings, labels, elbow routing | Yes (binds TO shapes) |
| **Content** | `text` | Standalone or container-bound text | Yes |
| | `image` | Raster graphics with crop/scale | Yes |
| | `freedraw` | Freehand strokes with pressure | No |
| **Containers** | `frame` | Named visual container for child elements | Yes |
| | `magicframe` | AI-powered frame | Yes |
| **Embedded** | `embeddable` | External web content (iframe) | Yes |

**Recommendation**: A skill should focus on `rectangle`, `ellipse`, `diamond`, `text`, `arrow`, `line`, and `frame`. These cover 95%+ of diagram use cases.

---

## 3. Element Properties

### 3.1. Base Properties (all elements)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | string | (required) | Unique identifier |
| `type` | string | (required) | Element type discriminator |
| `x`, `y` | number | (required) | Top-left corner position |
| `width`, `height` | number | (required) | Dimensions in pixels |
| `angle` | number | `0` | Rotation in radians |
| `strokeColor` | string | `"#1e1e1e"` | Stroke/border color |
| `backgroundColor` | string | `"transparent"` | Fill color |
| `fillStyle` | string | `"solid"` | `"solid"`, `"hachure"`, `"cross-hatch"`, `"zigzag"` |
| `strokeWidth` | number | `2` | Border thickness |
| `strokeStyle` | string | `"solid"` | `"solid"`, `"dashed"`, `"dotted"` |
| `roughness` | number | `1` | 0=architect (clean), 1=artist (default), 2=cartoonist |
| `opacity` | number | `100` | 0-100 transparency |
| `seed` | number | (random) | Roughjs rendering seed (ensures consistent hand-drawn look) |
| `version` | number | `1` | Mutation counter |
| `versionNonce` | number | (random) | Conflict resolution nonce |
| `isDeleted` | boolean | `false` | Soft deletion flag |
| `groupIds` | string[] | `[]` | Group memberships |
| `frameId` | string\|null | `null` | Parent frame element ID |
| `boundElements` | array\|null | `null` | Elements bound to this one (text labels, arrows) |
| `link` | string\|null | `null` | Hyperlink URL |
| `locked` | boolean | `false` | Edit protection |
| `roundness` | object\|null | `null` | `{ "type": 3 }` for rounded corners |

### 3.2. Text Element Properties

| Property | Type | Description |
|----------|------|-------------|
| `text` | string | Displayed text content |
| `originalText` | string | Text before wrapping |
| `fontSize` | number | Font size in pixels |
| `fontFamily` | number | 1=Virgil (hand-drawn), 2=Helvetica (clean), 3=Cascadia (code) |
| `textAlign` | string | `"left"`, `"center"`, `"right"` |
| `verticalAlign` | string | `"top"`, `"middle"`, `"bottom"` |
| `containerId` | string\|null | ID of container shape (for bound text) |
| `autoResize` | boolean | Auto-resize behavior |
| `lineHeight` | number | Line height multiplier |

### 3.3. Arrow/Line Properties

| Property | Type | Description |
|----------|------|-------------|
| `points` | array | Array of `[dx, dy]` offsets from element position |
| `startBinding` | object\|null | `{ elementId, focus, gap }` — binding to start shape |
| `endBinding` | object\|null | `{ elementId, focus, gap }` — binding to end shape |
| `startArrowhead` | string\|null | `null`, `"arrow"`, `"bar"`, `"dot"`, `"triangle"` |
| `endArrowhead` | string\|null | Same options as startArrowhead |

**Binding properties**: `elementId` = target shape ID, `focus` = -1 to 1 (where on edge), `gap` = pixel distance from shape boundary.

### 3.4. FreeDraw Properties

| Property | Type | Description |
|----------|------|-------------|
| `points` | array | Array of stroke coordinates |
| `pressures` | array | Pressure values per point (stylus) |
| `simulatePressure` | boolean | Simulate pressure when unavailable |

### 3.5. Frame Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string\|null | Display name for the frame |

Child elements reference the frame via their `frameId` property.

---

## 4. Arrow Binding (Critical Pattern)

Arrow binding is **bidirectional** — this is the most common source of errors in programmatic generation.

### 4.1. Correct Binding Pattern

When connecting Arrow A from Shape S1 to Shape S2:

**On the arrow:**
```json
{
  "type": "arrow",
  "id": "arrow-1",
  "startBinding": { "elementId": "shape-1", "focus": 0, "gap": 5 },
  "endBinding": { "elementId": "shape-2", "focus": 0, "gap": 5 }
}
```

**On BOTH shapes:**
```json
{
  "type": "rectangle",
  "id": "shape-1",
  "boundElements": [{ "id": "arrow-1", "type": "arrow" }]
}
```
```json
{
  "type": "rectangle",
  "id": "shape-2",
  "boundElements": [{ "id": "arrow-1", "type": "arrow" }]
}
```

### 4.2. Text-in-Shape Binding

Similarly, when text is inside a shape:

**On the text:**
```json
{ "type": "text", "id": "text-1", "containerId": "shape-1" }
```

**On the shape:**
```json
{ "type": "rectangle", "id": "shape-1", "boundElements": [{ "id": "text-1", "type": "text" }] }
```

**Recommendation**: The skill MUST document this bidirectional pattern prominently. It's the #1 cause of broken diagrams.

---

## 5. Layout Patterns

Excalidraw has **no auto-layout**. Positions must be computed manually.

### 5.1. Grid-Based Layout (Recommended for Skills)

```
Grid cell: 200x150px (shapes with labels)
Gap: 50-100px between elements
Snap: 20px grid (Excalidraw's minor grid)

Horizontal flowchart example:
  Shape 1: x=0,   y=0,   w=160, h=80
  Arrow 1:  x=160, y=40,  points=[[0,0],[60,0]]
  Shape 2: x=220, y=0,   w=160, h=80
```

### 5.2. Spacing Guidelines

| Element | Spacing |
|---------|---------|
| Between shapes | 50-100px |
| Between rows/layers | 120-150px |
| Padding inside frames | 20-40px |
| Arrow gap from shape | 5-10px |
| Text padding in shape | 10-20px |

### 5.3. Diagram Type Layouts

| Diagram Type | Layout Strategy |
|-------------|-----------------|
| Flowchart | Top-to-bottom or left-to-right grid |
| Architecture | Layered vertical stacking |
| Sequence diagram | Fixed participant spacing (200px), vertical message flow |
| Mind map | Radial from center, decreasing font/stroke per level |
| ER diagram | Grid with relationship lines |

**Recommendation**: The skill should include concrete coordinate templates for common diagram types rather than asking the LLM to compute layouts from scratch.

---

## 6. Color Palettes

### 6.1. Pastel Fills (Shape Backgrounds)

| Color | Hex | Semantic Use |
|-------|-----|-------------|
| Light Blue | `#a5d8ff` | Input, sources, APIs |
| Light Green | `#b2f2bb` | Success, output, completed |
| Light Orange | `#ffd8a8` | Warning, pending |
| Light Purple | `#d0bfff` | Processing, middleware |
| Light Red | `#ffc9c9` | Error, critical |
| Light Yellow | `#fff3bf` | Notes, decisions |
| Light Teal | `#c3fae8` | Storage, data |
| Light Pink | `#eebefa` | Analytics, metrics |

### 6.2. Stroke Colors

| Color | Hex |
|-------|-----|
| Black (default) | `#1e1e1e` |
| Blue | `#1971c2` |
| Green | `#2f9e44` |
| Orange | `#f08c00` |
| Red | `#e03131` |
| Purple | `#9c36b5` |

### 6.3. Diagram Style Presets

| Style | Roughness | Font | Use Case |
|-------|-----------|------|----------|
| Technical/Architecture | 0 | Helvetica (2) | System design, formal docs |
| Casual/Whiteboard | 1 | Virgil (1) | Brainstorming, discussions |
| Code/Debug | 0 | Cascadia (3) | Code flows, data structures |

---

## 7. Existing Excalidraw Skills (Prior Art)

### 7.1. coleam00/excalidraw-diagram-skill (470+ stars)

The most popular Claude Code skill for Excalidraw:
- Drop-in `.claude/skills/` directory structure
- Generates "diagrams that argue visually" — shapes and layout mirror conceptual relationships
- Includes Playwright-based visual validation (renders PNG, detects layout issues)
- Customizable color palette via `color-palette.md`
- Contains JSON templates, schema reference, rendering pipeline (Python + HTML)
- Requires `uv` + Playwright Chromium for validation

### 7.2. rnjn/cc-excalidraw-skill (52 stars)

A comprehensive 5-file skill:
- `SKILL.md` — Core skill definition
- `element-reference.md` — Complete element catalog
- `diagram-patterns.md` — Templates for flowcharts, sequence, mind maps, architecture, ER
- `best-practices.md` — Styling and layout guidance
- `examples.md` — Working JSON examples

**Key design patterns from rnjn's skill:**
- Pseudo-element `cameraUpdate` for viewport positioning (emit FIRST)
- Pseudo-element `delete` for removing elements by ID
- Standard camera sizes maintaining 4:3 aspect ratio
- Font size minimums tied to camera zoom level
- Semantic color coding for shape types

### 7.3. LobeHub/Smithery Skills

Community marketplace skills with simpler approaches — primarily focused on generating valid JSON with element templates.

**Recommendation**: Adapt `rnjn/cc-excalidraw-skill`'s modular structure (separate reference docs for elements, patterns, best practices) combined with `coleam00`'s semantic layout philosophy.

---

## 8. Ecosystem & Tooling

### 8.1. Official npm Packages

| Package | Purpose | Weekly Downloads |
|---------|---------|-----------------|
| `@excalidraw/excalidraw` | React component + `convertToExcalidrawElements()` | High |
| `@excalidraw/utils` | Headless export (SVG, PNG, Canvas) | Medium |
| `@excalidraw/mermaid-to-excalidraw` | Mermaid -> Excalidraw (flowcharts native, others rasterized) | ~50k |

### 8.2. MCP Servers

| Server | Description |
|--------|-------------|
| `excalidraw/excalidraw-mcp` (Official) | Real-time canvas control via WebSocket, camera updates |
| `yctimlin/mcp_excalidraw` | 13 MCP tools: element CRUD, export, screenshots |
| `cmd8/excalidraw-mcp` | npm package for Cursor/Claude Code/VS Code |
| `i-tozer/excalidraw-mcp` | CRUD + SVG/PNG/JSON export |

### 8.3. IDE Integration

**VS Code Extension** (`pomdtr.excalidraw-editor`):
- Opens `.excalidraw`, `.excalidraw.svg`, `.excalidraw.png` files
- Full editor embedded in webview
- Toggle between visual editor and raw JSON source
- Works in github.dev and vscode.dev

### 8.4. CLI Tools

| Tool | Purpose |
|------|---------|
| `opencoredev/excalidraw-cli` | Full CLI + canvas server (element CRUD, batch, layout, export) |
| `excalirender` | Standalone binary for .excalidraw -> PNG/SVG/PDF |
| `sindrel/excalidraw-converter` | Convert to Gliffy/draw.io/Mermaid |

### 8.5. Mermaid Conversion

Bidirectional conversion exists:
- **Mermaid -> Excalidraw**: `@excalidraw/mermaid-to-excalidraw` (flowcharts = native elements, other types = rasterized images)
- **Excalidraw -> Mermaid**: `@excalidraw-to-mermaid/cli`

**Recommendation**: For a skill, direct JSON is better than Mermaid intermediary. Mermaid limits element styling and layout control.

---

## 9. AI Generation Approaches (Ranked)

### 9.1. Direct JSON Generation (Best for Skills)

The LLM outputs complete `.excalidraw` JSON. No dependencies.

**Pros**: Zero setup, works in any project, full control over styling/layout
**Cons**: LLM must handle all element property details, binding relationships

### 9.2. Skeleton API (Best for Node.js)

Use `convertToExcalidrawElements()` with simplified inputs. Handles binding automatically.

```javascript
convertToExcalidrawElements([
  { type: "rectangle", x: 0, y: 0, label: { text: "Client" } },
  { type: "arrow", x: 0, y: 100, start: { type: "rectangle" }, end: { type: "ellipse" } }
])
```

**Pros**: Auto-handles IDs, bindings, text containers
**Cons**: Requires npm dependency

### 9.3. Mermaid Intermediary

LLM generates Mermaid -> convert via `@excalidraw/mermaid-to-excalidraw`.

**Pros**: Simpler LLM output, well-known syntax
**Cons**: Only flowcharts get native elements, limited styling, layout controlled by converter

### 9.4. MCP Real-Time Canvas

LLM calls MCP tools to create/modify elements on a live canvas.

**Pros**: Interactive, iterative refinement, LLM can "see" the diagram
**Cons**: Requires running MCP server + browser, complex setup

**Recommendation**: Use approach #1 (direct JSON) for the Claude Code skill. Include concrete templates to reduce LLM errors.

---

## Source Quality Assessment

| Source Type | Availability | Quality | Notes |
|-------------|--------------|---------|-------|
| Official docs (docs.excalidraw.com) | High | High | Comprehensive API reference |
| GitHub source (excalidraw/excalidraw) | High | High | TypeScript type definitions are authoritative |
| Community skills (coleam00, rnjn) | High | High | Battle-tested with real users |
| DeepWiki analysis | High | Medium | Good summaries but may lag behind latest |
| Community tools (MCP servers, CLIs) | Medium | Medium | Fragmented, varying quality |

---

## Knowledge Gaps

- [ ] Exact behavior of `focus` values in arrow binding — documentation is sparse on edge cases
- [ ] Performance limits — how many elements before Excalidraw slows down
- [ ] `magicframe` and `embeddable` element creation details — limited documentation
- [ ] Best practices for elbow arrow routing — `fixedSegments` API not well documented
- [ ] Library format (`excalidrawlib`) for packaging reusable diagram components as skill templates

---

## Key Sources

| # | Source | Type | Date | Relevance |
|---|--------|------|------|-----------|
| 1 | [Excalidraw Developer Docs](https://docs.excalidraw.com/) | Primary | Current | Official API reference |
| 2 | [JSON Schema Docs](https://docs.excalidraw.com/docs/codebase/json-schema) | Primary | Current | File format specification |
| 3 | [Element Skeleton API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton) | Primary | Current | Programmatic element creation |
| 4 | [excalidraw/excalidraw GitHub](https://github.com/excalidraw/excalidraw) | Primary | Current | Source code, TypeScript types |
| 5 | [coleam00/excalidraw-diagram-skill](https://github.com/coleam00/excalidraw-diagram-skill) | Expert | Jan 2026 | Most popular Claude Code skill |
| 6 | [rnjn/cc-excalidraw-skill](https://github.com/rnjn/cc-excalidraw-skill) | Expert | Jan 2026 | Comprehensive skill with patterns |
| 7 | [Excalidraw MCP Server](https://github.com/excalidraw/excalidraw-mcp) | Primary | Current | Official AI integration |
| 8 | [Mermaid-to-Excalidraw API](https://docs.excalidraw.com/docs/@excalidraw/mermaid-to-excalidraw/api) | Primary | Current | Conversion pipeline |
| 9 | [DeepWiki: Element Types](https://deepwiki.com/excalidraw/excalidraw/3.1-element-binding-and-geometry) | Secondary | Current | Element type analysis |
| 10 | [DEV.to: Claude Code Excalidraw Skill](https://dev.to/yooi/custom-claude-code-skill-auto-generating-updating-architecture-diagrams-with-excalidraw-227k) | Expert | 2026 | Skill implementation walkthrough |
| 11 | [VS Code Excalidraw Extension](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor) | Primary | Current | IDE integration |
| 12 | [Excalidraw Libraries](https://libraries.excalidraw.com/) | Primary | Current | Reusable component ecosystem |
| 13 | [opencoredev/excalidraw-cli](https://github.com/opencoredev/excalidraw-cli) | Expert | Current | CLI tooling reference |

---

**Report generated on**: March 2026
**Version**: 1.0
**Author**: Deep Research Analyst (Claude Code Agent)
**Methodology**: Multi-source internet research with critical evaluation across official docs, GitHub repos, community skills, and ecosystem tools
