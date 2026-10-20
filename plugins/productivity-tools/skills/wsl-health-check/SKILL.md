---
name: wsl-health-check
description: "Runs the bundled WSL/Linux health-report script and summarizes disk, memory, network and services in a fixed table. Use when the user asks for a system or WSL health check, a health report, whether a Linux/WSL machine is healthy, or a narrow question such as disk space, memory or service status there. Not for Windows-native or macOS hosts."
---

# System Health Check

Run the bundled script and produce a structured summary.

## Workflow

1. Run: `bash "${CLAUDE_SKILL_DIR}/scripts/health-report.sh" --full --no-color`
2. Parse each section (see Parsing Guide below)
3. Classify each category using the Thresholds table
4. Output EXACTLY the format shown in Output Format

## Parsing Guide

The script prints section headers as uppercase text between `═══` borders.
Key sections to extract:

| Script Section Header | Maps To |
|---|---|
| `SYSTEM INFORMATION` | System |
| `DISK USAGE` | Disk |
| `MEMORY & CPU` | Memory (includes swap and load average) |
| `NETWORK` | Network |
| `SERVICES` | Services |
| `TOP PROCESSES` | Processes (high CPU/memory consumers, load average) |
| `HEALTH SUMMARY` | Cross-check, and the `Zombie processes: <n>` line for Processes |

Subsections start with `▶` followed by a label.

- Key services come from the `▶ Key Services` subsection (under `SERVICES`): one line per service, `<name>: active|inactive|not-found`. The list is configurable through the `HEALTH_KEY_SERVICES` environment variable (space-separated, default `cron`).
- The zombie count is the `Zombie processes: <n>` line in `HEALTH SUMMARY`.

## Thresholds

| Metric | OK | WARN | CRITICAL |
|---|---|---|---|
| Disk usage | < 80% | 80-95% | > 95% |
| Memory usage | < 85% | 85-95% | > 95% |
| Swap usage | < 50% | 50-80% | > 80% |
| Load avg (1m) | < nproc | 1-2x nproc | > 2x nproc |
| Failed services | 0 | 1-2 | 3+ |
| Key services (`Key Services` section) | all `active` | none | any not `active` |
| Zombie processes | 0 | 1-5 | > 5 |

## Output Format

Produce ONLY these two parts, nothing else. Do not add extra sections such as "Detailed Breakdown", "Summary" or "Observations".

### Part 1: Header + Table

```
## System Health Check — YYYY-MM-DD

| Category | Status | Details |
|----------|--------|---------|
| System | OK | <distro and version>, up <uptime>, kernel <version> |
| Disk | OK | root <n>% used, home <size> |
| Memory | OK | <used>/<total> used (<n>%), swap <used>/<total> |
| Network | OK | internet reachable, DNS resolving |
| Services | OK | no failed services, key services active: <names> |
| Processes | OK | <n> zombies, load avg <x> (nproc=<n>) |
```

Rules:

- The header is `## System Health Check — YYYY-MM-DD` (em dash, real date).
- Exactly 6 rows: System, Disk, Memory, Network, Services, Processes. No Swap row; swap goes in the Memory Details.
- Always compare the 1-min load average against nproc using the Thresholds table and show it in the Processes row.
- Table cell text is plain: no `**bold**`, no `*italic*`, no backticks.

### Part 2: Recommendations

- If ALL statuses are OK: write exactly `No issues found. All systems healthy.` and nothing more (no proactive advice).
- If any status is WARN or CRITICAL: list ONLY actionable recommendations for those items, one bullet per issue. Do not give advice for categories that are OK.

## Error Handling

- If `${CLAUDE_SKILL_DIR}/scripts/health-report.sh` is not found: report the error and suggest reinstalling the `productivity-tools` plugin, since the script ships in `skills/wsl-health-check/scripts/` of the plugin.
- If the script fails or times out: produce the table with available data and mark unavailable categories as WARN with "data unavailable" in Details.
