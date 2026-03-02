# Plugin Marketplace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn claude-play into a community-driven Claude Code plugin marketplace with a native `marketplace.json`, plugin template, contribution guidelines, and documentation.

**Architecture:** Monorepo marketplace — all plugins live under `plugins/`, the `.claude-plugin/marketplace.json` catalogs them, and contributors submit new plugins via PR. No custom tooling; relies entirely on Claude Code's built-in marketplace support.

**Tech Stack:** Claude Code plugin system (marketplace.json, plugin.json, SKILL.md)

---

### Task 1: Create marketplace.json

**Files:**
- Create: `.claude-plugin/marketplace.json`

**Step 1: Create the `.claude-plugin/` directory and marketplace.json**

```json
{
  "name": "claude-play",
  "owner": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "metadata": {
    "description": "Community-driven Claude Code plugin marketplace",
    "version": "1.0.0",
    "pluginRoot": "./plugins"
  },
  "plugins": [
    {
      "name": "system-health-check",
      "source": "./system-health-check",
      "description": "On-demand WSL system health check with OK/WARN/CRITICAL status summaries",
      "version": "1.0.0",
      "author": {
        "name": "Odecio Machado",
        "email": "odeciojunior@gmail.com"
      },
      "license": "MIT",
      "keywords": ["health", "system", "wsl", "monitoring", "diagnostics"],
      "category": "system",
      "tags": ["wsl", "devops"]
    }
  ]
}
```

**Step 2: Validate JSON syntax**

Run: `python3 -c "import json; json.load(open('.claude-plugin/marketplace.json')); print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat: add marketplace.json catalog with system-health-check"
```

---

### Task 2: Create plugin template

**Files:**
- Create: `plugins/_template/.claude-plugin/plugin.json`
- Create: `plugins/_template/skills/example-skill/SKILL.md`
- Create: `plugins/_template/README.md`

**Step 1: Create template plugin.json**

Write `plugins/_template/.claude-plugin/plugin.json`:

```json
{
  "name": "your-plugin-name",
  "description": "Brief description of what the plugin does",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "your@email.com"
  },
  "license": "MIT",
  "keywords": []
}
```

**Step 2: Create template SKILL.md**

Write `plugins/_template/skills/example-skill/SKILL.md`:

```markdown
---
name: example-skill
description: Use when [describe the trigger condition for this skill]
---

# Example Skill

## What This Does

[Describe what the skill does]

## Workflow

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Output Format

[Describe the expected output format]
```

**Step 3: Create template README.md**

Write `plugins/_template/README.md`:

```markdown
# Plugin Name

Brief description of what this plugin does.

## Installation

```bash
claude plugin marketplace add odeciojunior/claude-play
claude plugin install your-plugin-name@claude-play
```

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| example-skill | "do the thing" | Does the thing |

## Prerequisites

- List any required tools or setup

## License

MIT
```

**Step 4: Validate template plugin.json syntax**

Run: `python3 -c "import json; json.load(open('plugins/_template/.claude-plugin/plugin.json')); print('OK')"`
Expected: `OK`

**Step 5: Commit**

```bash
git add plugins/_template/
git commit -m "feat: add plugin starter template"
```

---

### Task 3: Create LICENSE file

**Files:**
- Create: `LICENSE`

**Step 1: Create MIT license file**

Write `LICENSE` with the standard MIT license text. Copyright holder: `Odecio Machado`. Year: `2026`.

**Step 2: Commit**

```bash
git add LICENSE
git commit -m "chore: add MIT license"
```

---

### Task 4: Create CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

**Step 1: Write CONTRIBUTING.md**

```markdown
# Contributing to claude-play

Thanks for your interest in contributing a plugin to the claude-play marketplace!

## Prerequisites

- [Claude Code](https://claude.ai/code) installed
- Git and a GitHub account
- Familiarity with Claude Code plugins ([docs](https://docs.anthropic.com/en/docs/claude-code/plugins))

## Submitting a Plugin

### 1. Fork and clone

```bash
git clone https://github.com/<your-username>/claude-play.git
cd claude-play
```

### 2. Create your plugin

Copy the template and rename it:

```bash
cp -r plugins/_template plugins/your-plugin-name
```

Edit `plugins/your-plugin-name/.claude-plugin/plugin.json`:
- Set `name` to match your directory name (kebab-case)
- Write a clear `description`
- Add your `author` info
- Add relevant `keywords`

### 3. Add your skills, hooks, or agents

- **Skills**: Add `SKILL.md` files under `skills/<skill-name>/SKILL.md`
- **Hooks**: Add a `hooks/hooks.json` file
- **Agents**: Add agent definitions under `agents/`
- **MCP Servers**: Add `.mcp.json` configuration

Each skill needs a YAML frontmatter with `name` and `description` fields. The description should clearly state when the skill triggers.

### 4. Write your README

Update `plugins/your-plugin-name/README.md` with:
- What the plugin does
- Installation instructions
- Skill/hook descriptions
- Any prerequisites

### 5. Open a pull request

Push your branch and open a PR against `main`. The PR template will guide you through the checklist.

## Plugin Guidelines

### Naming
- Use kebab-case: `my-plugin-name`
- Directory name must match `plugin.json` `name` field
- Be descriptive but concise

### Quality
- Skills must have clear trigger descriptions in their YAML frontmatter
- Include a README with usage instructions
- No hardcoded absolute paths — use `${CLAUDE_PLUGIN_ROOT}` for paths relative to the plugin
- No sensitive data (API keys, credentials, tokens)

### What We Accept
- Skills that solve real problems for Claude Code users
- Hooks that automate common workflows
- MCP server integrations that add useful tool access
- Agents for specialized tasks

### What We Don't Accept
- Plugins that duplicate existing Claude Code functionality
- Plugins with malicious or destructive behavior
- Plugins that require proprietary dependencies without alternatives

## Review Process

1. A maintainer will review your PR for quality and security
2. If changes are needed, we'll leave comments on the PR
3. Once approved, the maintainer adds your plugin to `marketplace.json` and merges
```

**Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add contribution guidelines"
```

---

### Task 5: Create PR template

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Step 1: Create directory and PR template**

Write `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## New Plugin Submission

**Plugin name:** `plugins/<name>/`

**What it does:** <!-- One sentence -->

### Checklist

- [ ] Plugin directory name matches `plugin.json` `name` field
- [ ] `plugin.json` has all required fields (name, description, version, author, license, keywords)
- [ ] Skills have YAML frontmatter with `name` and `description`
- [ ] `README.md` documents what the plugin does and how to use it
- [ ] No hardcoded absolute paths (using `${CLAUDE_PLUGIN_ROOT}` where needed)
- [ ] No sensitive data (API keys, credentials, tokens)
- [ ] License declared in `plugin.json`

### Testing

<!-- How did you test the plugin? e.g., "Installed via --plugin-dir and verified skill triggers correctly" -->
```

**Step 2: Commit**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add PR template for plugin submissions"
```

---

### Task 6: Create README.md

**Files:**
- Create: `README.md`

**Step 1: Write the marketplace README**

```markdown
# claude-play

Community-driven plugin marketplace for [Claude Code](https://claude.ai/code).

## Quick Start

```bash
# Add the marketplace (one-time)
claude plugin marketplace add odeciojunior/claude-play

# Install a plugin
claude plugin install system-health-check@claude-play
```

## Available Plugins

| Plugin | Description | Category | Version |
|--------|-------------|----------|---------|
| [system-health-check](plugins/system-health-check/) | On-demand WSL system health check with OK/WARN/CRITICAL status summaries | system | 1.0.0 |

## Contributing

We welcome plugin contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

**Quick version:**

1. Fork this repo
2. Copy `plugins/_template` to `plugins/your-plugin-name`
3. Add your skills, hooks, or agents
4. Open a PR

## License

[MIT](LICENSE)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add marketplace README with quick start and plugin table"
```

---

### Task 7: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md with marketplace info**

Replace the entire contents of `CLAUDE.md` with:

```markdown
# CLAUDE.md

Community-driven Claude Code plugin marketplace. Users register this repo as a marketplace source and install plugins via the standard Claude Code CLI.

## Quick Reference

```bash
# Add marketplace
claude plugin marketplace add odeciojunior/claude-play

# Install a plugin
claude plugin install <plugin-name>@claude-play
```

## Structure

```
.claude-plugin/
  marketplace.json          # Plugin catalog (Claude Code reads this)
plugins/
  <plugin-name>/
    .claude-plugin/plugin.json
    skills/
      <skill-name>/SKILL.md
    README.md
  _template/                # Starter template for contributors
docs/
  plans/                    # Design docs and implementation plans
```

## Plugins

| Plugin | Description | Category |
|--------|-------------|----------|
| system-health-check | On-demand WSL system health check with OK/WARN/CRITICAL status | system |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributors copy `plugins/_template/`, add their plugin, and open a PR.

## Marketplace Name

`claude-play` — used in install commands: `claude plugin install <name>@claude-play`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with marketplace info"
```

---

### Task 8: Validate and verify

**Step 1: Verify all expected files exist**

Run: `find . -not -path './.git/*' -type f | sort`

Expected files (among others):
```
./.claude-plugin/marketplace.json
./.github/PULL_REQUEST_TEMPLATE.md
./CLAUDE.md
./CONTRIBUTING.md
./LICENSE
./README.md
./plugins/_template/.claude-plugin/plugin.json
./plugins/_template/README.md
./plugins/_template/skills/example-skill/SKILL.md
./plugins/system-health-check/.claude-plugin/plugin.json
./plugins/system-health-check/skills/system-health-check/SKILL.md
```

**Step 2: Validate all JSON files parse correctly**

Run:
```bash
python3 -c "
import json, glob
for f in glob.glob('**/*.json', recursive=True):
    if '.git' in f: continue
    try:
        json.load(open(f))
        print(f'OK: {f}')
    except Exception as e:
        print(f'FAIL: {f} — {e}')
"
```

Expected: All `OK`, no `FAIL`.

**Step 3: Verify marketplace.json plugin source resolves**

Run: `ls -la plugins/system-health-check/.claude-plugin/plugin.json`
Expected: File exists (confirms the `pluginRoot + source` path resolves correctly).

**Step 4: Verify _template is NOT in marketplace.json**

Run: `python3 -c "import json; m=json.load(open('.claude-plugin/marketplace.json')); names=[p['name'] for p in m['plugins']]; assert '_template' not in names and 'your-plugin-name' not in names; print('OK: template not in catalog')"`
Expected: `OK: template not in catalog`

**Step 5: No commit needed — this is verification only**

---

## Summary

| Task | Creates | Commit Message |
|------|---------|----------------|
| 1 | `.claude-plugin/marketplace.json` | `feat: add marketplace.json catalog with system-health-check` |
| 2 | `plugins/_template/*` (3 files) | `feat: add plugin starter template` |
| 3 | `LICENSE` | `chore: add MIT license` |
| 4 | `CONTRIBUTING.md` | `docs: add contribution guidelines` |
| 5 | `.github/PULL_REQUEST_TEMPLATE.md` | `chore: add PR template for plugin submissions` |
| 6 | `README.md` | `docs: add marketplace README with quick start and plugin table` |
| 7 | `CLAUDE.md` (modify) | `docs: update CLAUDE.md with marketplace info` |
| 8 | — (verification) | — |
