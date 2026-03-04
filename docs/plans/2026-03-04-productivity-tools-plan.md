# Productivity Tools Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `productivity-tools` plugin for the claude-play marketplace with 5 forked skills: deep-research-analyst, plan-coordinator, report-analyzer, roadmap-planner, and mermaid-designer.

**Architecture:** Plugin follows the existing claude-play marketplace pattern (`plugins/<name>/.claude-plugin/plugin.json` + `skills/<skill>/SKILL.md`). All skills use `context: fork` to run as isolated subagents. User-provided draft content is adapted to standard skill frontmatter format.

**Tech Stack:** Claude Code plugin system (YAML frontmatter + Markdown skill files)

**Design doc:** `docs/plans/2026-03-04-productivity-tools-design.md`

---

### Task 1: Create Plugin Directory Structure

**Files:**
- Create: `plugins/productivity-tools/.claude-plugin/` (directory)
- Create: `plugins/productivity-tools/skills/deep-research-analyst/` (directory)
- Create: `plugins/productivity-tools/skills/plan-coordinator/` (directory)
- Create: `plugins/productivity-tools/skills/report-analyzer/` (directory)
- Create: `plugins/productivity-tools/skills/roadmap-planner/` (directory)
- Create: `plugins/productivity-tools/skills/mermaid-designer/` (directory)

**Step 1: Create all directories**

```bash
mkdir -p plugins/productivity-tools/.claude-plugin \
  plugins/productivity-tools/skills/deep-research-analyst \
  plugins/productivity-tools/skills/plan-coordinator \
  plugins/productivity-tools/skills/report-analyzer \
  plugins/productivity-tools/skills/roadmap-planner \
  plugins/productivity-tools/skills/mermaid-designer
```

**Step 2: Verify structure**

```bash
find plugins/productivity-tools -type d | sort
```

Expected output:
```
plugins/productivity-tools
plugins/productivity-tools/.claude-plugin
plugins/productivity-tools/skills
plugins/productivity-tools/skills/deep-research-analyst
plugins/productivity-tools/skills/mermaid-designer
plugins/productivity-tools/skills/plan-coordinator
plugins/productivity-tools/skills/report-analyzer
plugins/productivity-tools/skills/roadmap-planner
```

---

### Task 2: Create plugin.json

**Files:**
- Create: `plugins/productivity-tools/.claude-plugin/plugin.json`
- Reference: `plugins/system-health-check/.claude-plugin/plugin.json` (pattern reference)

**Step 1: Write plugin.json**

```json
{
  "name": "productivity-tools",
  "description": "Research, analysis, planning, and diagramming skills for strategic work",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["research", "analysis", "planning", "roadmap", "mermaid", "diagrams"]
}
```

**Step 2: Verify valid JSON**

```bash
python3 -c "import json; json.load(open('plugins/productivity-tools/.claude-plugin/plugin.json')); print('Valid JSON')"
```

Expected: `Valid JSON`

**Step 3: Commit**

```bash
git add plugins/productivity-tools/.claude-plugin/plugin.json
git commit -m "feat(productivity-tools): add plugin.json"
```

---

### Task 3: Create deep-research-analyst SKILL.md

**Files:**
- Create: `plugins/productivity-tools/skills/deep-research-analyst/SKILL.md`

**Step 1: Write SKILL.md**

Use this exact frontmatter:

```yaml
---
name: deep-research-analyst
description: "Conducts comprehensive, multi-source internet research on any topic. Use when the user needs in-depth investigation across authoritative sources, including technical deep-dives, market analysis, competitive intelligence, or architectural research."
model: claude-opus-4-6
context: fork
allowed-tools: Read, Write, Grep, Glob, WebSearch, WebFetch
---
```

For the body, use the user's draft content exactly as provided — no changes needed. The body starts with `# Deep Research Analyst` and includes all sections: Workflow, Source Assessment, Report Template, Formatting Rules, Quality Standards, Operating Rules, and Turn Budget.

**Step 2: Verify frontmatter**

```bash
head -7 plugins/productivity-tools/skills/deep-research-analyst/SKILL.md
```

Expected: The YAML frontmatter block with `name`, `description`, `model`, `context`, `allowed-tools`.

**Step 3: Verify description is single-line**

```bash
grep -c '^description:' plugins/productivity-tools/skills/deep-research-analyst/SKILL.md
```

Expected: `1` (exactly one line)

**Step 4: Commit**

```bash
git add plugins/productivity-tools/skills/deep-research-analyst/SKILL.md
git commit -m "feat(productivity-tools): add deep-research-analyst skill"
```

---

### Task 4: Create plan-coordinator SKILL.md

**Files:**
- Create: `plugins/productivity-tools/skills/plan-coordinator/SKILL.md`

**Step 1: Write SKILL.md**

Use this exact frontmatter:

```yaml
---
name: plan-coordinator
description: "Builds Execution Maps from implementation plans by analyzing steps, assigning executor agents, grouping for parallelism, and writing the map to a progress file for approval. Use when you need to plan the execution of a multi-step plan from docs/plans/."
model: claude-opus-4-6
context: fork
allowed-tools: Read, Write, Grep, Glob, AskUserQuestion
---
```

For the body, use the user's draft content with these specific changes:

**Change 1:** Replace the opening line:
- FROM: `You are the execution planner for the BDesk v2 project.`
- TO: `You are the execution planner for the current project.`

**Change 2:** In Step 3 "Build the Execution Map", item 2, replace BDesk-specific executor examples:
- FROM: `(e.g., a "form validation for requests" step goes to \`forms-validation\`, not \`request-components\`)`
- TO: `(e.g., a "form validation" step goes to \`frontend-executor\`, not \`backend-executor\`)`

**Change 3:** In Step 3, item 4, keep the fallback text as-is (already says `general-executor`). Add a note after item 4:
- ADD after item 4: `5. If no \`.claude/agents/\` directory exists, assign all steps to \`general-executor\` and note this in the Execution Map presentation.`
- Renumber existing items 5-7 to 6-8.

**Change 4:** In the Execution Map Format table example, replace BDesk-specific agent names:
- `type-system + test-quality` → `backend-executor + test-executor`
- `api-services` → `backend-executor`
- `request-components` → `frontend-executor`
- `state-management` → `frontend-executor`
- `forms-validation + styling-theme` → `frontend-executor + test-executor`

**Change 5:** In the Progress File Format, Step Context Blocks examples, replace BDesk-specific content:
- Replace "Add Request Priority Types" → "Add Data Model Types"
- Replace "Write Priority Filter Tests" → "Write Filter Tests"
- Replace `RequestPriority` → `DataModel`
- Replace `src/types/requests.ts` → `src/types/models.ts`
- Replace `src/types/index.ts` → `src/types/`
- Replace `src/test/setup.ts` → `test setup`
- Replace `src/**/__tests__/*.test.{ts,tsx}, Vitest + RTL` → `project test conventions`
- Replace `npm run typecheck` → `type checking passes`
- Replace `npm run test -- --filter priority` → `relevant tests`

**Change 6:** Remove the `mcpServers` and `skills` references. The Cross-Session Memory section in the body can stay as-is — it references MCP tool names as behavioral instructions, not frontmatter config.

**Step 2: Verify no BDesk references remain**

```bash
grep -i "bdesk" plugins/productivity-tools/skills/plan-coordinator/SKILL.md
```

Expected: no output (no matches)

**Step 3: Verify frontmatter format**

```bash
head -7 plugins/productivity-tools/skills/plan-coordinator/SKILL.md
```

Expected: Standard skill frontmatter.

**Step 4: Commit**

```bash
git add plugins/productivity-tools/skills/plan-coordinator/SKILL.md
git commit -m "feat(productivity-tools): add plan-coordinator skill"
```

---

### Task 5: Create report-analyzer SKILL.md

**Files:**
- Create: `plugins/productivity-tools/skills/report-analyzer/SKILL.md`

**Step 1: Write SKILL.md**

Use this exact frontmatter:

```yaml
---
name: report-analyzer
description: "Strategic report analyst. Deeply analyzes reports to extract SWOT findings, gap analysis, and risk assessment, then builds phased roadmaps with strategic pillars, milestones, and priority-ranked initiatives. Use when the user has a report and needs strategic planning or actionable roadmap creation."
model: claude-opus-4-6
context: fork
allowed-tools: Read, Write, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
---
```

For the body, use the user's draft content with this one change:

**Change 1:** The draft references `skills: report-standards` in the frontmatter. This is already removed by using the new frontmatter above. No body text references this skill, so no body changes needed.

All other content (Workflow, Analysis Methodology, Output Format, Roadmap Document Output, Behavioral Guidelines, Cross-Session Memory, What NOT to Do, Quality Assurance Checklist) stays exactly as provided.

**Step 2: Verify frontmatter**

```bash
head -7 plugins/productivity-tools/skills/report-analyzer/SKILL.md
```

**Step 3: Commit**

```bash
git add plugins/productivity-tools/skills/report-analyzer/SKILL.md
git commit -m "feat(productivity-tools): add report-analyzer skill"
```

---

### Task 6: Create roadmap-planner SKILL.md

**Files:**
- Create: `plugins/productivity-tools/skills/roadmap-planner/SKILL.md`

**Step 1: Write SKILL.md**

Use this exact frontmatter:

```yaml
---
name: roadmap-planner
description: "Decomposes strategic roadmaps and initiatives into structured deliverables with clear acceptance criteria. Use when the user needs to break down a roadmap, plan, or strategic goal into actionable work packages that stakeholders can verify."
model: claude-opus-4-6
context: fork
allowed-tools: Read, Write, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
---
```

For the body, use the user's draft content with this one change:

**Change 1:** Same as report-analyzer — `skills: report-standards` is removed via frontmatter. No body references to this skill exist, so no body changes needed.

All other content (Workflow, Phase 1-3, Deliverable Structure, Effort Estimation Guide, Writing Acceptance Criteria, Priority Framework, Dependency Mapping, Critical Path, Risk Assessment, Output Format, Document Output, Cross-Session Memory, Behavioral Rules, What NOT to Do, Quality Assurance Checklist) stays exactly as provided.

**Step 2: Verify frontmatter**

```bash
head -7 plugins/productivity-tools/skills/roadmap-planner/SKILL.md
```

**Step 3: Commit**

```bash
git add plugins/productivity-tools/skills/roadmap-planner/SKILL.md
git commit -m "feat(productivity-tools): add roadmap-planner skill"
```

---

### Task 7: Create mermaid-designer SKILL.md

**Files:**
- Create: `plugins/productivity-tools/skills/mermaid-designer/SKILL.md`

**Step 1: Write SKILL.md**

Use this exact frontmatter:

```yaml
---
name: mermaid-designer
description: "Designs and generates Mermaid diagrams for documentation, architecture, data flows, roadmaps, and technical illustrations. Use when the user needs any kind of visual diagram, chart, or flowchart embedded in Markdown."
model: claude-sonnet-4-6
context: fork
allowed-tools: Read, Write, Edit, Grep, Glob, AskUserQuestion
---
```

For the body, use the user's draft content exactly as provided — no changes needed. The body starts with `You are a Mermaid diagram specialist` and includes all sections: Workflow, Diagram Selection Guide, Syntax Rules, Node Shapes Reference, Styling, Accessibility, GitHub Rendering Compatibility, Complexity Guidelines, Domain-Specific Patterns, Layout Optimization, Output Standards, Quality Checklist, What NOT to Do.

**Step 2: Verify frontmatter (note: sonnet model)**

```bash
head -7 plugins/productivity-tools/skills/mermaid-designer/SKILL.md
```

Expected: `model: claude-sonnet-4-6` (not opus)

**Step 3: Commit**

```bash
git add plugins/productivity-tools/skills/mermaid-designer/SKILL.md
git commit -m "feat(productivity-tools): add mermaid-designer skill"
```

---

### Task 8: Create Plugin README.md

**Files:**
- Create: `plugins/productivity-tools/README.md`
- Reference: `plugins/_template/README.md` (pattern reference)

**Step 1: Write README.md**

```markdown
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
```

**Step 2: Commit**

```bash
git add plugins/productivity-tools/README.md
git commit -m "docs(productivity-tools): add plugin README"
```

---

### Task 9: Update marketplace.json

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Add productivity-tools entry to the plugins array**

Add after the existing `system-health-check` entry:

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

**Step 2: Verify valid JSON**

```bash
python3 -c "import json; data = json.load(open('.claude-plugin/marketplace.json')); print(f'{len(data[\"plugins\"])} plugins'); [print(f'  - {p[\"name\"]}') for p in data['plugins']]"
```

Expected:
```
2 plugins
  - system-health-check
  - productivity-tools
```

**Step 3: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat: add productivity-tools to marketplace catalog"
```

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add productivity-tools to the Plugins table**

In the `## Plugins` section, add a new row:

```markdown
| productivity-tools | Research, analysis, planning, and diagramming skills | productivity |
```

**Step 2: Add design doc reference**

In the `## Design Docs` section, add:

```markdown
- `2026-03-04-productivity-tools-*.md` — Productivity tools plugin design & implementation plan
```

**Step 3: Verify table has 2 rows**

```bash
grep -c "^|" CLAUDE.md | head -5
```

The Plugins table should have 2 data rows (plus header and separator).

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add productivity-tools plugin to CLAUDE.md"
```

---

### Task 11: Final Verification

**Step 1: Verify all skill files exist**

```bash
find plugins/productivity-tools -name "SKILL.md" | sort
```

Expected:
```
plugins/productivity-tools/skills/deep-research-analyst/SKILL.md
plugins/productivity-tools/skills/mermaid-designer/SKILL.md
plugins/productivity-tools/skills/plan-coordinator/SKILL.md
plugins/productivity-tools/skills/report-analyzer/SKILL.md
plugins/productivity-tools/skills/roadmap-planner/SKILL.md
```

**Step 2: Verify all frontmatter uses standard fields only**

```bash
for f in plugins/productivity-tools/skills/*/SKILL.md; do
  echo "=== $(basename $(dirname $f)) ==="
  sed -n '/^---$/,/^---$/p' "$f"
  echo
done
```

Expected: Each skill shows only `name`, `description`, `model`, `context`, `allowed-tools` — no `tools`, `disallowedTools`, `permissionMode`, `memory`, `maxTurns`, `color`, `mcpServers`, or `skills` fields.

**Step 3: Verify no BDesk references in any skill**

```bash
grep -ri "bdesk" plugins/productivity-tools/
```

Expected: no output

**Step 4: Verify marketplace.json is valid**

```bash
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json')); print('Valid')"
```

Expected: `Valid`

**Step 5: Check git log**

```bash
git log --oneline -12
```

Expected: Commits for each task above.
