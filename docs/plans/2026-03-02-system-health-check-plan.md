# System Health Check Skill — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Claude Code plugin with a skill that wraps `~/health-report.sh`, parses its output, and presents a structured OK/WARN/CRITICAL summary table with actionable recommendations.

**Architecture:** Single-skill plugin. The SKILL.md instructs Claude to run the existing bash script with `--full --no-color`, parse each section, classify health by thresholds, and output a markdown table. No code beyond the skill document and plugin metadata.

**Tech Stack:** Claude Code plugin (`.claude-plugin/plugin.json` + `skills/system-health-check/SKILL.md`)

---

### Task 1: Create plugin directory structure

**Files:**
- Create: `~/.claude/plugins/local/system-health-check/.claude-plugin/plugin.json`

**Step 1: Create the directory tree**

```bash
mkdir -p ~/.claude/plugins/local/system-health-check/.claude-plugin
mkdir -p ~/.claude/plugins/local/system-health-check/skills/system-health-check
```

**Step 2: Write plugin.json**

Create `~/.claude/plugins/local/system-health-check/.claude-plugin/plugin.json`:

```json
{
  "name": "system-health-check",
  "description": "On-demand WSL system health check skill that wraps health-report.sh and presents structured OK/WARN/CRITICAL status summaries",
  "version": "1.0.0",
  "author": {
    "name": "Odecio Machado",
    "email": "odeciojunior@gmail.com"
  },
  "license": "MIT",
  "keywords": ["health", "system", "wsl", "monitoring", "diagnostics"]
}
```

**Step 3: Verify directory structure**

```bash
find ~/.claude/plugins/local/system-health-check -type f
```

Expected:
```
.claude-plugin/plugin.json
```

---

### Task 2: RED — Baseline test without skill

**Purpose:** Run a pressure scenario with a subagent that does NOT have the skill, to document what Claude naturally does when asked to check system health. This identifies gaps the skill must address.

**Step 1: Run baseline subagent**

Use the Agent tool with this prompt (the subagent won't have the system-health-check skill loaded):

```
You are in a WSL2 Ubuntu environment. The user has a health report script at ~/health-report.sh.

The user says: "Check my system health and give me a summary."

Do a system health check. Run ~/health-report.sh --full --no-color, parse the output, and present findings as a structured table with OK/WARN/CRITICAL status for each category (System, Disk, Memory, Network, Services, Processes). Include actionable recommendations for anything non-OK.

Use these thresholds:
- Disk: OK <80%, WARN 80-95%, CRITICAL >95%
- Memory: OK <85%, WARN 85-95%, CRITICAL >95%
- Swap: OK <50%, WARN 50-80%, CRITICAL >80%
- Failed services: OK=0, WARN=1-2, CRITICAL=3+ or key service (redis-server, cron) down
- Zombies: OK=0, WARN=1-5, CRITICAL >5
```

**Step 2: Document baseline behavior**

Record verbatim:
- Did the subagent run the script correctly (`--full --no-color`)?
- Did it parse all sections or miss some?
- Did it produce a table or freeform text?
- Did it apply thresholds correctly?
- Did it include actionable recommendations?
- What rationalizations or shortcuts did it take?

Save findings to `docs/plans/2026-03-02-system-health-check-baseline.md`.

---

### Task 3: GREEN — Write the SKILL.md

**Files:**
- Create: `~/.claude/plugins/local/system-health-check/skills/system-health-check/SKILL.md`

**Step 1: Write SKILL.md addressing baseline failures**

Based on the baseline test findings, write the SKILL.md. Start with this template and adjust based on what the baseline got wrong:

```markdown
---
name: system-health-check
description: Use when user asks to check system health, run diagnostics, or wants a system status summary on this WSL2 machine
---

# System Health Check

## Overview

Run `~/health-report.sh`, parse the output, and present a structured summary with OK/WARN/CRITICAL status per category and actionable recommendations.

## Workflow

1. Run `~/health-report.sh --full --no-color`
2. Parse the output into these categories: System, Disk, Memory/CPU, Network, Services, Processes
3. Classify each category using the thresholds below
4. Present the summary table
5. List actionable recommendations for any WARN or CRITICAL items
6. If all OK, state "All systems healthy" above the table

## Thresholds

| Resource | OK | WARN | CRITICAL |
|----------|----|------|----------|
| Disk usage | <80% | 80-95% | >95% |
| Memory usage | <85% | 85-95% | >95% |
| Swap usage | <50% | 50-80% | >80% |
| Load average | < nproc | 1-2x nproc | >2x nproc |
| Failed services | 0 | 1-2 | 3+ or key service down |
| Zombie processes | 0 | 1-5 | >5 |

Key services (CRITICAL if down): redis-server, cron.

## Output Format

Always use this exact format:

## System Health Check — [date]

| Category | Status | Details |
|----------|--------|---------|
| System | OK/WARN/CRITICAL | OS version, uptime |
| Disk | OK/WARN/CRITICAL | Root and /home usage percentages |
| Memory | OK/WARN/CRITICAL | Used/total RAM, swap status |
| Network | OK/WARN/CRITICAL | Connectivity and DNS status |
| Services | OK/WARN/CRITICAL | Failed count, key service status |
| Processes | OK/WARN/CRITICAL | Zombie count, high-load processes |

### Recommendations
- **[Category]**: [Specific actionable advice for WARN/CRITICAL items]

If no recommendations needed, write: "No issues found. All systems healthy."

## Parsing Guide

The script output uses these section headers (with `--no-color`):
- `SYSTEM INFORMATION` — hostname, kernel, OS, uptime
- `DISK USAGE` — filesystem df output, home directory size
- `MEMORY & CPU` — free output, CPU info, load average
- `NETWORK` — interfaces, DNS, connectivity test, open ports
- `TOP PROCESSES` — top CPU and memory consumers
- `SERVICES` — failed services, active services list
- `PACKAGE MANAGEMENT` — apt stats, updates available
- `HEALTH SUMMARY` — script's own summary with checkmarks

Extract numeric values from the raw output to compare against thresholds. Do not rely on the script's own color coding (disabled with --no-color).

## Common Mistakes

- Running the script without `--no-color` (produces ANSI escape codes that are hard to parse)
- Reporting the script's raw output instead of the structured table
- Missing the swap line in memory parsing
- Not checking both `/` and `/home` disk partitions (they may differ in WSL)
- Forgetting to include the Recommendations section even when everything is OK ("No issues found")
```

**Step 2: Verify file exists and is well-formed**

```bash
cat ~/.claude/plugins/local/system-health-check/skills/system-health-check/SKILL.md | head -5
```

Expected: frontmatter with `name: system-health-check` and `description: Use when...`

---

### Task 4: Register the plugin

**Files:**
- Modify: `~/.claude/settings.json`

**Step 1: Add the plugin to enabledPlugins in settings.json**

Add this entry to the `enabledPlugins` object:

```json
"system-health-check@local": true
```

**Step 2: Add the plugin to installed_plugins.json**

Add this entry to the `plugins` object in `~/.claude/plugins/installed_plugins.json`:

```json
"system-health-check@local": [
  {
    "scope": "user",
    "installPath": "/home/odecio/.claude/plugins/local/system-health-check",
    "version": "1.0.0",
    "installedAt": "2026-03-02T17:00:00.000Z",
    "lastUpdated": "2026-03-02T17:00:00.000Z"
  }
]
```

**Step 3: Verify registration**

```bash
grep "system-health-check" ~/.claude/settings.json
grep "system-health-check" ~/.claude/plugins/installed_plugins.json
```

Expected: Both files show the new plugin entry.

---

### Task 5: GREEN — Test with skill present

**Step 1: Restart Claude Code session** (required for plugin changes to take effect)

Tell the user: "Please restart Claude Code (`/exit` then relaunch) so the new plugin loads."

**Step 2: Invoke the skill**

After restart, test by saying: "Check my system health" or `/system-health-check`

**Step 3: Verify output matches spec**

Check that:
- [ ] Script was run with `--full --no-color`
- [ ] Output is a markdown table (not freeform text)
- [ ] All 6 categories present (System, Disk, Memory, Network, Services, Processes)
- [ ] Each has OK/WARN/CRITICAL status
- [ ] Thresholds were applied correctly
- [ ] Recommendations section present
- [ ] Actionable advice for any non-OK items

**Step 4: Document test results**

Append results to `docs/plans/2026-03-02-system-health-check-baseline.md` under a "## GREEN Test Results" heading.

---

### Task 6: REFACTOR — Close loopholes

**Step 1: Identify gaps from GREEN test**

Review what the skill got wrong or could improve:
- Did Claude follow the exact table format?
- Were thresholds applied accurately?
- Were recommendations actionable and specific?
- Any new rationalizations or shortcuts?

**Step 2: Update SKILL.md**

Edit `~/.claude/plugins/local/system-health-check/skills/system-health-check/SKILL.md` to address any issues found.

**Step 3: Re-test**

Run the skill again and verify the fix. Repeat until output matches the spec perfectly.

---

### Task 7: Commit

**Step 1: Commit the design doc and plan**

```bash
cd ~/docs
git init 2>/dev/null || true
git add plans/2026-03-02-system-health-check-design.md plans/2026-03-02-system-health-check-plan.md
git commit -m "docs: add system-health-check skill design and implementation plan"
```

**Step 2: Commit the plugin**

```bash
cd ~/.claude/plugins/local/system-health-check
git init
git add .
git commit -m "feat: system-health-check plugin v1.0.0

Wraps ~/health-report.sh with structured OK/WARN/CRITICAL
summary table and actionable recommendations."
```
