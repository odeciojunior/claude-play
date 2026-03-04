# Marketplace Tools Plugin — Design

**Date**: 2026-03-04
**Status**: Approved

## Overview

A new `marketplace-tools` plugin for claude-play that provides two maintainer skills: `/new-plugin` for scaffolding and `/validate-plugin` for quality validation.

## Plugin Structure

```
plugins/marketplace-tools/
  .claude-plugin/plugin.json
  skills/
    new-plugin/SKILL.md
    validate-plugin/SKILL.md
  README.md
```

**plugin.json**: name `marketplace-tools`, category `developer-tools`, keywords `[scaffold, validation, marketplace, maintainer]`.

## Skill 1: `/new-plugin`

**Invocation**: User-only (`disable-model-invocation: true`)
**Arguments**: Plugin name (required, kebab-case)

### Workflow

1. Validate plugin name is kebab-case and doesn't already exist
2. Copy `plugins/_template/` to `plugins/<name>/`
3. Ask user for: description, author name/email, keywords, category, first skill name
4. Fill `plugin.json` with answers
5. Rename `example-skill/` to `<first-skill-name>/` and update SKILL.md frontmatter
6. Update `README.md` with plugin info
7. Add entry to `.claude-plugin/marketplace.json`
8. Show summary of created files

## Skill 2: `/validate-plugin`

**Invocation**: Both (user and model)
**Arguments**: Plugin name (optional, defaults to detecting from current directory)

### Validation Checks

| # | Check | Severity |
|---|-------|----------|
| 1 | Directory name matches `plugin.json` `name` | FAIL |
| 2 | `plugin.json` has required fields (name, description, version, author, license, keywords) | FAIL |
| 3 | Every `skills/*/SKILL.md` has YAML frontmatter with `name` and `description` | FAIL |
| 4 | `README.md` exists and is non-empty | WARN |
| 5 | No hardcoded absolute paths (`/home/`, `/Users/`, `C:\`) | WARN |
| 6 | No sensitive data patterns (`api_key`, `token`, `password`, `secret`) | FAIL |
| 7 | Plugin exists in `marketplace.json` | WARN |

### Output Format

```
Validating plugin: my-plugin

[OK]   Directory name matches plugin.json name
[OK]   plugin.json has all required fields
[WARN] README.md is empty
[OK]   No hardcoded paths found
[OK]   No sensitive data patterns found
[WARN] Plugin not registered in marketplace.json

Result: 5 OK, 2 WARN, 0 FAIL
```

## Marketplace Registration

Add `marketplace-tools` to `.claude-plugin/marketplace.json` with:
- category: `developer-tools`
- tags: `[maintainer, scaffold]`
- keywords: `[scaffold, validation, marketplace, maintainer, quality]`
