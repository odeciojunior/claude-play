# CLAUDE.md

Local Claude Code plugins repository. Each plugin under `plugins/` has its own `.claude-plugin/plugin.json` and `skills/` directory.

## Structure

```
plugins/
  <plugin-name>/
    .claude-plugin/plugin.json
    skills/
      <skill-name>/
        SKILL.md
docs/
  plans/           # Design docs and implementation plans
```

## Plugins

- **system-health-check**: On-demand WSL system health check wrapping `~/health-report.sh`
