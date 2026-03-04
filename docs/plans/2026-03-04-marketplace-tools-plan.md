# Marketplace Tools Plugin — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `marketplace-tools` plugin with `/new-plugin` scaffolding and `/validate-plugin` quality validation skills.

**Architecture:** Two SKILL.md files in a new plugin directory. `/new-plugin` uses AskUserQuestion to gather inputs then scaffolds via Write/Edit tools. `/validate-plugin` uses Read/Grep/Glob to check plugin structure against the PR checklist.

**Tech Stack:** SKILL.md (Markdown with YAML frontmatter), JSON (plugin.json, marketplace.json)

---

### Task 1: Create plugin directory and plugin.json

**Files:**
- Create: `plugins/marketplace-tools/.claude-plugin/plugin.json`

**Step 1: Create the plugin.json**

```json
{
  "name": "marketplace-tools",
  "description": "Maintainer tools for the claude-play marketplace: scaffold new plugins and validate plugin quality",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["scaffold", "validation", "marketplace", "maintainer", "quality"]
}
```

**Step 2: Verify the file**

Run: `cat plugins/marketplace-tools/.claude-plugin/plugin.json | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['name']=='marketplace-tools'; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add plugins/marketplace-tools/.claude-plugin/plugin.json
git commit -m "feat(marketplace-tools): add plugin.json"
```

---

### Task 2: Create the `/validate-plugin` skill

**Why first:** We can use `/validate-plugin` to verify our own plugin once built.

**Files:**
- Create: `plugins/marketplace-tools/skills/validate-plugin/SKILL.md`

**Step 1: Write the SKILL.md**

```markdown
---
name: validate-plugin
description: "Validate a plugin directory against claude-play marketplace quality standards. Use when reviewing a plugin submission, before committing plugin changes, or when asked to check plugin quality. Checks plugin.json fields, SKILL.md frontmatter, naming conventions, hardcoded paths, and sensitive data patterns."
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion
---

You are a plugin quality validator for the claude-play marketplace.

## Arguments

The user may provide a plugin name as an argument (e.g., `/validate-plugin my-plugin`). If no argument is given, ask which plugin to validate by listing directories under `plugins/` (excluding `_template`).

## Workflow

1. **Resolve plugin path**: `plugins/<name>/`
2. **Run all checks** in order (see Validation Checks below)
3. **Print summary** using the Output Format below

## Validation Checks

Run each check and record the result as OK, WARN, or FAIL.

### Check 1: Directory name matches plugin.json name (FAIL)

- Read `plugins/<name>/.claude-plugin/plugin.json`
- Parse the JSON and compare `name` field to the directory name
- FAIL if they don't match or if plugin.json doesn't exist

### Check 2: plugin.json has all required fields (FAIL)

- Required fields: `name`, `description`, `version`, `author`, `license`, `keywords`
- `author` must have `name` and `email` subfields
- `keywords` must be a non-empty array
- FAIL if any field is missing or empty

### Check 3: SKILL.md frontmatter validation (FAIL)

- Glob for `plugins/<name>/skills/*/SKILL.md`
- Each SKILL.md must have YAML frontmatter (between `---` markers) with `name` and `description` fields
- FAIL if any SKILL.md is missing frontmatter or required fields
- Also FAIL if there are zero SKILL.md files found

### Check 4: README.md exists and is non-empty (WARN)

- Check if `plugins/<name>/README.md` exists
- WARN if missing or empty (less than 10 characters)

### Check 5: No hardcoded absolute paths (WARN)

- Grep all files under `plugins/<name>/` for patterns: `/home/`, `/Users/`, `C:\`, `/tmp/`
- Exclude matches inside code blocks that reference `${CLAUDE_PLUGIN_ROOT}`
- WARN if any matches found, listing the file and line

### Check 6: No sensitive data patterns (FAIL)

- Grep all files under `plugins/<name>/` for patterns (case-insensitive): `api_key\s*[:=]`, `token\s*[:=]`, `password\s*[:=]`, `secret\s*[:=]`
- Exclude SKILL.md files that mention these terms in validation check descriptions (like this very file)
- FAIL if any real matches found

### Check 7: Plugin registered in marketplace.json (WARN)

- Read `.claude-plugin/marketplace.json`
- Check if a plugin entry with matching `name` exists in the `plugins` array
- WARN if not found (plugin may not be ready for registration yet)

## Output Format

Print results in this exact format:

```
Validating plugin: <name>

[OK]   Directory name matches plugin.json name
[FAIL] plugin.json missing required field: keywords
[OK]   All SKILL.md files have valid frontmatter
[WARN] README.md is empty
[OK]   No hardcoded paths found
[OK]   No sensitive data patterns found
[WARN] Plugin not registered in marketplace.json

Result: 4 OK, 2 WARN, 1 FAIL
```

Use `[OK]` with 3 spaces, `[WARN]` with 1 space, `[FAIL]` with 1 space to align the messages.

## What NOT to Do

- Do not modify any files — this is a read-only validation skill
- Do not skip checks — run all 7 even if earlier checks fail
- Do not fabricate results — if a file can't be read, report the error
- Prefer dedicated tools (Grep, Glob, Read) over Bash equivalents
```

**Step 2: Verify frontmatter is valid**

Run: `head -3 plugins/marketplace-tools/skills/validate-plugin/SKILL.md`
Expected: Lines starting with `---`, `name:`, then content.

**Step 3: Commit**

```bash
git add plugins/marketplace-tools/skills/validate-plugin/SKILL.md
git commit -m "feat(marketplace-tools): add validate-plugin skill"
```

---

### Task 3: Create the `/new-plugin` skill

**Files:**
- Create: `plugins/marketplace-tools/skills/new-plugin/SKILL.md`

**Step 1: Write the SKILL.md**

```markdown
---
name: new-plugin
description: "Scaffold a new plugin for the claude-play marketplace. Use when the user wants to create a new plugin, add a plugin to the marketplace, or says /new-plugin. Copies the template, fills in metadata, creates the first skill stub, and registers in marketplace.json."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Bash, AskUserQuestion
---

You are a plugin scaffolding assistant for the claude-play marketplace.

## Arguments

The user provides a plugin name as an argument (e.g., `/new-plugin my-awesome-tool`). If no name is provided, ask for one.

## Workflow

Follow these steps in order. Do not skip steps.

### Step 1: Validate plugin name

- Name must be kebab-case (lowercase letters, numbers, hyphens only): `^[a-z][a-z0-9-]*[a-z0-9]$`
- Name must not already exist as a directory under `plugins/`
- Name must not be `_template`
- If invalid, explain why and ask for a corrected name

### Step 2: Copy template

Copy the entire `plugins/_template/` directory to `plugins/<name>/`:

- `plugins/<name>/.claude-plugin/plugin.json`
- `plugins/<name>/skills/example-skill/SKILL.md`
- `plugins/<name>/README.md`

### Step 3: Gather plugin metadata

Ask the user the following questions using AskUserQuestion (one call, multiple questions):

1. **Description**: "What does this plugin do?" (open-ended, one sentence)
2. **Category**: Choose from: system, productivity, developer-tools, documentation, integration
3. **First skill name**: "What should the first skill be called?" (kebab-case)
4. **Keywords**: "What keywords describe this plugin?" (comma-separated)

For author info, use the repo owner defaults:
- Name: Odecio Machado
- Email: odeciojunior@gmail.com

### Step 4: Fill plugin.json

Write `plugins/<name>/.claude-plugin/plugin.json` with the gathered metadata:

```json
{
  "name": "<name>",
  "description": "<description>",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["<keyword1>", "<keyword2>", "..."]
}
```

### Step 5: Rename and update skill stub

- Rename `plugins/<name>/skills/example-skill/` to `plugins/<name>/skills/<skill-name>/`
- Update the SKILL.md frontmatter:
  - Set `name` to `<skill-name>`
  - Set `description` to "Use when [describe trigger]. TODO: flesh out this skill."
- Leave the rest of SKILL.md as a template for the user to fill in

### Step 6: Update README.md

Write `plugins/<name>/README.md` with plugin-specific content:

```markdown
# <Plugin Name (title case)>

<description>

## Installation

\`\`\`bash
claude plugin marketplace add odeciojunior/claude-play
claude plugin install <name>@claude-play
\`\`\`

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| <skill-name> | TODO | TODO: describe the skill |

## Prerequisites

- Claude Code with plugin support

## License

MIT
```

### Step 7: Register in marketplace.json

Read `.claude-plugin/marketplace.json`, add a new entry to the `plugins` array:

```json
{
  "name": "<name>",
  "source": "./plugins/<name>",
  "description": "<description>",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["<keywords>"],
  "category": "<category>",
  "tags": []
}
```

### Step 8: Show summary

Print a summary of what was created:

```
Plugin scaffolded successfully!

Created files:
  plugins/<name>/.claude-plugin/plugin.json
  plugins/<name>/skills/<skill-name>/SKILL.md
  plugins/<name>/README.md

Registered in: .claude-plugin/marketplace.json

Next steps:
  1. Edit plugins/<name>/skills/<skill-name>/SKILL.md to define your skill
  2. Run /validate-plugin <name> to check your plugin
  3. Commit and open a PR
```

## What NOT to Do

- Do not create files outside of `plugins/<name>/` (except marketplace.json update)
- Do not overwrite an existing plugin directory
- Do not add skills beyond the first stub — the user will add more later
- Prefer dedicated tools (Write, Edit, Read) over Bash equivalents
```

**Step 2: Verify frontmatter is valid**

Run: `head -4 plugins/marketplace-tools/skills/new-plugin/SKILL.md`
Expected: `---`, `name: new-plugin`, `description:`, content.

**Step 3: Commit**

```bash
git add plugins/marketplace-tools/skills/new-plugin/SKILL.md
git commit -m "feat(marketplace-tools): add new-plugin scaffolding skill"
```

---

### Task 4: Create plugin README

**Files:**
- Create: `plugins/marketplace-tools/README.md`

**Step 1: Write the README**

```markdown
# Marketplace Tools

Maintainer tools for the claude-play marketplace: scaffold new plugins and validate plugin quality.

## Installation

\`\`\`bash
claude plugin marketplace add odeciojunior/claude-play
claude plugin install marketplace-tools@claude-play
\`\`\`

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| new-plugin | `/new-plugin my-tool` | Scaffold a new plugin from the template with metadata and marketplace registration |
| validate-plugin | `/validate-plugin my-tool` | Validate a plugin against marketplace quality standards (7 checks) |

## Workflow

1. Run `/new-plugin my-awesome-tool` to scaffold a new plugin
2. Edit the generated SKILL.md to define your skill's behavior
3. Run `/validate-plugin my-awesome-tool` to verify quality
4. Commit and open a PR

## Prerequisites

- Claude Code with plugin support
- Working in the claude-play repository

## License

MIT
```

**Step 2: Commit**

```bash
git add plugins/marketplace-tools/README.md
git commit -m "feat(marketplace-tools): add plugin README"
```

---

### Task 5: Register in marketplace.json

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Add the plugin entry**

Add the following object to the `plugins` array in `.claude-plugin/marketplace.json`, after the `productivity-tools` entry:

```json
{
  "name": "marketplace-tools",
  "source": "./plugins/marketplace-tools",
  "description": "Maintainer tools for the claude-play marketplace: scaffold new plugins and validate plugin quality",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["scaffold", "validation", "marketplace", "maintainer", "quality"],
  "category": "developer-tools",
  "tags": ["maintainer", "scaffold"]
}
```

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('.claude-plugin/marketplace.json')); print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat(marketplace-tools): register plugin in marketplace catalog"
```

---

### Task 6: Update project CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add marketplace-tools to the Plugins table**

In the `## Plugins` table, add a row:

```
| marketplace-tools | Maintainer scaffolding and validation | developer-tools |
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add marketplace-tools to CLAUDE.md plugins table"
```

---

### Task 7: Self-validate

**Step 1: Run `/validate-plugin marketplace-tools`**

Manually verify each check:
- Directory name `marketplace-tools` matches plugin.json `name` field
- plugin.json has all required fields
- Both SKILL.md files have valid frontmatter
- README.md exists and is non-empty
- No hardcoded absolute paths
- No sensitive data patterns
- Plugin is registered in marketplace.json

Expected: `7 OK, 0 WARN, 0 FAIL`

**Step 2: Verify plugin structure matches existing plugins**

Run: `find plugins/marketplace-tools -type f | sort`
Expected:
```
plugins/marketplace-tools/.claude-plugin/plugin.json
plugins/marketplace-tools/README.md
plugins/marketplace-tools/skills/new-plugin/SKILL.md
plugins/marketplace-tools/skills/validate-plugin/SKILL.md
```
