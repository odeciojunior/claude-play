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
| new-plugin | `/marketplace-tools:new-plugin my-tool` | Scaffold a new plugin from the template with metadata and marketplace registration |
| validate-plugin | `/marketplace-tools:validate-plugin my-tool` | Validate a plugin against marketplace quality standards : runs `claude plugin validate`, the `lint-plugin.mjs` script and judgment checks |

## Workflow

1. Run `/marketplace-tools:new-plugin my-awesome-tool` to scaffold a new plugin
2. Edit the generated SKILL.md to define your skill's behavior
3. Run `/marketplace-tools:validate-plugin my-awesome-tool` to verify quality
4. Commit and open a PR

## Lint script

`validate-plugin` runs a deterministic linter, `skills/validate-plugin/scripts/lint-plugin.mjs` (Node 18+, no dependencies). To run it by hand from the repository root:

```bash
node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/<name> [--marketplace <path>]
```

It prints `[OK]`, `[WARN]` and `[FAIL]` lines and a `Result:` total. Exit code 0 means no FAIL, 1 means at least one FAIL, 2 means a usage error. Tests: `node --test plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs`.

## Prerequisites

- Claude Code with plugin support
- Working in the claude-play repository

## License

MIT
