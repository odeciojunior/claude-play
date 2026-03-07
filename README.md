# claude-play

Community-driven plugin marketplace for [Claude Code](https://claude.ai/code).

## Quick Start

```bash
# Add the marketplace (one-time)
claude plugin marketplace add odeciojunior/claude-play

# Install a plugin
claude plugin install productivity-tools@claude-play
```

## Available Plugins

| Plugin | Description | Category | Version |
|--------|-------------|----------|---------|
| [productivity-tools](plugins/productivity-tools/) | Research, analysis, planning, diagramming, and system health skills | productivity | 1.0.0 |
| [sql-server-tools](plugins/sql-server-tools/) | SQL Server performance monitoring, schema discovery, query optimization, T-SQL development, and code review agents | developer-tools | 1.0.0 |
| [mcp-sql-server](plugins/mcp-sql-server/) | Automated MCP SQL Server setup — connects Claude Code to SQL Server databases | developer-tools | 1.0.0 |

## Contributing

We welcome plugin contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

**Quick version:**

1. Fork this repo
2. Copy `plugins/_template` to `plugins/your-plugin-name`
3. Add your skills, hooks, or agents
4. Open a PR

## License

[MIT](LICENSE)
