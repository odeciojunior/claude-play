---
name: validate-plugin
description: "Validates a plugin directory by running `claude plugin validate` plus the deterministic lint-plugin.mjs script, then adding judgment checks for hardcoded absolute paths and sensitive data. Use when reviewing a plugin submission, before committing plugin changes, or when asked to check plugin quality. Not for scaffolding a new plugin (use new-plugin)."
---

# Validate a plugin

## Arguments

The user may provide a plugin as a bare name (`/marketplace-tools:validate-plugin my-plugin`) or as a path (`/marketplace-tools:validate-plugin plugins/my-plugin`). Normalize both to `plugins/<name>`. If none is given, list the directories under `plugins/` (excluding `_template`) and ask which one to validate.

## Workflow

Run from the repository root. Do not skip a step because an earlier one failed; do not modify any file.

### Step 0: Official validator

Run `claude plugin validate plugins/<name>` and report its output.

- It prints `Validation passed` (with or without warnings): one `[OK]` line, `claude plugin validate: Validation passed`. If it printed warnings, list each one on its own `[WARN]` line.
- It fails: one `[FAIL]` line, `claude plugin validate: <first error line>`.
- The `claude` command is unavailable: one `[WARN]` line, `claude plugin validate: not run (claude CLI unavailable)`.

It checks manifests only (plugin.json and similar files), not skill content or repo policy, so Step 1 is still required.

### Step 1: Lint script

Run:

```
node "${CLAUDE_SKILL_DIR}/scripts/lint-plugin.mjs" plugins/<name>
```

If `${CLAUDE_SKILL_DIR}` was not substituted (the path is empty or still contains the literal `${CLAUDE_SKILL_DIR}`) and you are inside the claude-play repository, run `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/<name>` instead.

Include its `[OK]`, `[WARN]` and `[FAIL]` lines verbatim in the report and add its counts to the total (ignore its own `Result:` line). The script covers: directory and plugin name, required plugin.json fields (repo policy), SKILL.md frontmatter keys and values, SKILL.md and reference length, reference depth, agent frontmatter, `hooks.json`, `.mcp.json`, plugin-root `CLAUDE.md`, writes into `${CLAUDE_PLUGIN_ROOT}`, README, and marketplace registration and version. Exit code 1 means at least one FAIL.

### Step 2: Judgment checks

These need reading, so do them yourself with Grep over `plugins/<name>/`.

**Hardcoded absolute paths (WARN)**

- Search for `/home/`, `/Users/`, `C:\` and `/tmp/`.
- Ignore a matching line if that line references `${CLAUDE_PLUGIN_ROOT}` or `${CLAUDE_SKILL_DIR}`. Ignore files under `scripts/fixtures/` and `*.test.mjs` files. Ignore text that only describes this check (like this file) or names the paths as examples of what to avoid.
- Report each remaining match as `[WARN] Hardcoded absolute path: <file>:<line>`.
- If nothing remains, print `[OK]   No hardcoded absolute paths found`.

**Sensitive data patterns (FAIL)**

- Search case-insensitively for `api_key\s*[:=]`, `token\s*[:=]`, `password\s*[:=]` and `secret\s*[:=]`.
- Ignore SKILL.md or reference text that only names these terms while describing a check (like this file), placeholders such as `<your-token>` or `${VAR}`, and variable references with no literal value.
- Report each real match as `[FAIL] Sensitive data pattern: <file>:<line>`, without printing the value.
- If nothing remains, print `[OK]   No sensitive data patterns found`.

## Output format

Print the validator line, the lint lines, the judgment lines and one total:

```
Validating plugin: <name>

[OK]   claude plugin validate: Validation passed
[OK]   Directory name matches plugin.json name
[WARN] skills/demo/SKILL.md length: 506 lines (> 500); move detail into references/
[OK]   No hardcoded absolute paths found
[OK]   No sensitive data patterns found

Result: 4 OK, 1 WARN, 0 FAIL
```

Use `[OK]` followed by 3 spaces, `[WARN]` and `[FAIL]` followed by 1 space. Print exactly one `Result:` line, after all checks.

## What not to do

- Do not modify files; this skill is read-only.
- Do not fabricate results; if a command or file cannot be run or read, report the error.
