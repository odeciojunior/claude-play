---
name: new-plugin
description: "Scaffold a new plugin for the claude-play marketplace. Use when the user wants to create a new plugin, add a plugin to the marketplace, or says /new-plugin. Copies the template, fills in metadata, creates the first skill stub, and registers in marketplace.json."
disable-model-invocation: true
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
