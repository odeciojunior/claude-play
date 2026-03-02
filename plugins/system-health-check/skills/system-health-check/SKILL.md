---
name: system-health-check
description: "Use when the user asks to check system health, run a health report, diagnose system status, or check if the machine is healthy."
---

# System Health Check

Run `~/health-report.sh --full --no-color` and produce a structured summary.

## Workflow

1. Run: `~/health-report.sh --full --no-color`
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

Subsections start with `▶` followed by a label.

Note: `--full` does not print zombie counts. Run `ps aux | awk '$8~/Z/' | wc -l` separately to get the zombie count for the Processes row.

## Thresholds

| Metric | OK | WARN | CRITICAL |
|---|---|---|---|
| Disk usage | < 80% | 80-95% | > 95% |
| Memory usage | < 85% | 85-95% | > 95% |
| Swap usage | < 50% | 50-80% | > 80% |
| Load avg (1m) | < nproc | 1-2x nproc | > 2x nproc |
| Failed services | 0 | 1-2 | 3+ or key service down |
| Zombie processes | 0 | 1-5 | > 5 |

Key services (CRITICAL if down): redis-server, cron.

## Output Format

Produce ONLY these two parts — nothing else:

### Part 1: Header + Table

```
## System Health Check — YYYY-MM-DD

| Category | Status | Details |
|----------|--------|---------|
| System | OK | Ubuntu 24.04, up 3 days, kernel 6.6.x |
| Disk | OK | root 45% used, home 12G |
| Memory | OK | 8G/32G used (25%), swap 0B/8G |
| Network | OK | internet reachable, DNS resolving |
| Services | OK | no failed services, redis-server and cron active |
| Processes | OK | 0 zombies, load avg 1.2 (nproc=32) |
```

### Part 2: Recommendations

- If ALL statuses are OK: write exactly `No issues found. All systems healthy.`
- If any status is WARN or CRITICAL: list ONLY actionable recommendations for those items, one bullet per issue. Do not give advice for categories that are OK.

## Error Handling

- If `~/health-report.sh` is not found or not executable: report the error and suggest checking the file path.
- If the script fails or times out: produce the table with available data and mark unavailable categories as WARN with "data unavailable" in Details.

## Common Mistakes — Do NOT

1. Add extra sections (e.g., "Detailed Breakdown", "Summary", "Observations"). Output is ONLY the table + recommendations.
2. Add a Swap row. There must be exactly 6 rows: System, Disk, Memory, Network, Services, Processes. Swap info goes in the Memory row Details.
3. Use a different header. The header MUST be `## System Health Check — YYYY-MM-DD` (em dash, real date).
4. Give proactive recommendations when all statuses are OK. When everything is fine, write ONLY `No issues found. All systems healthy.`
5. Skip load average classification. Always compare 1-min load average against nproc using the thresholds above and show it in the Processes row.
6. Use bold or other formatting inside table cells. All table cell text must be plain — no `**bold**`, no `*italic*`, no backticks.
