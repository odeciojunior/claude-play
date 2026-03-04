# Marketplace Tools

Maintainer tools for the claude-play marketplace: scaffold new plugins and validate plugin quality.

## Installation

```bash
claude plugin marketplace add odeciojunior/claude-play
claude plugin install marketplace-tools@claude-play
```

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| new-plugin | `/new-plugin my-tool` | Scaffold a new plugin from the template with metadata and marketplace registration |
| validate-plugin | `/validate-plugin my-tool` | Validate a plugin against marketplace quality standards (7 checks) |

## Workflow

1. Run `/new-plugin my-awesome-tool` to scaffold a new plugin
2. Edit the generated SKILL.md to define your skill's behavior
3. Run `/validate-plugin my-awesome-tool` to verify quality
4. Commit and open a PR

## Prerequisites

- Claude Code with plugin support
- Working in the claude-play repository

## License

MIT
