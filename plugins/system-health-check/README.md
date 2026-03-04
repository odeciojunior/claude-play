# System Health Check

On-demand WSL system health check that wraps `~/health-report.sh` and presents structured OK/WARN/CRITICAL status summaries.

## Installation

```bash
claude plugin marketplace add odeciojunior/claude-play
claude plugin install system-health-check@claude-play
```

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| system-health-check | "check system health", "run health report" | Runs health-report.sh and produces a 6-category status table |

## How It Works

The skill runs `~/health-report.sh --full --no-color`, parses the output, and classifies each category (System, Disk, Memory, Network, Services, Processes) as OK, WARN, or CRITICAL based on defined thresholds.

## Prerequisites

- `~/health-report.sh` must exist and be executable
- WSL2 environment (the script inspects WSL-specific system details)

## License

MIT
