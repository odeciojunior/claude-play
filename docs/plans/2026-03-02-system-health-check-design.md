# System Health Check Skill — Design

## Purpose

On-demand skill that runs `~/health-report.sh`, parses the output, classifies each category as OK/WARN/CRITICAL, and presents a structured summary with actionable recommendations.

## Trigger

User invokes explicitly: `/system-health-check`, "check my system", "health check", "is my system OK".

## Workflow

1. Run `~/health-report.sh --full --no-color`
2. Parse output into 6 categories: System, Disk, Memory, Network, Services, Processes (Packages and WSL sections are intentionally excluded — low signal, adds clutter)
3. Classify each category using thresholds below
4. Present summary table with status indicators
5. List actionable recommendations for WARN/CRITICAL items
6. If all OK, output brief "all clear" with the table

## Output Format

```
## System Health Check

| Category | Status | Details |
|----------|--------|---------|
| System | OK | Ubuntu 24.04.3, up 3 days |
| Disk | WARN | /home at 82% (219G/268G) |
| Memory | OK | 12G/32G used, swap minimal |
| Network | OK | DNS resolving, connectivity good |
| Services | OK | redis, cron, resolved, timesyncd all active |
| Processes | OK | No zombie processes |

### Recommendations
- **Disk**: /home at 82% — consider cleaning node_modules or old logs
```

## Thresholds

| Resource | OK | WARN | CRITICAL |
|----------|----|------|----------|
| Disk usage | <80% | 80-95% | >95% |
| Memory usage | <85% | 85-95% | >95% |
| Swap usage | <50% | 50-80% | >80% |
| Failed services | 0 | 1-2 | 3+ or key service down |
| Zombie processes | 0 | 1-5 | >5 |

Key services: redis-server, cron.

## Plugin Structure

```
system-health-check/
  plugin.json
  skills/
    system-health-check/
      SKILL.md
```

## Approach

Script-First Runner — wraps the existing health-report.sh script. Claude runs the script, interprets the output, and produces the structured summary. No duplication of diagnostic commands.

## Decisions Made

- **Wrap, don't replace** the existing health-report.sh
- **Plugin package** (not personal skill) for potential sharing
- **Structured table output** with OK/WARN/CRITICAL status per category
- **Actionable recommendations** only for non-OK items
