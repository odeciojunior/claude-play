# SQL Server Subagent Best Practices for Claude Code

**Design patterns, architecture guidance, and implementation standards for building SQL Server-focused Claude Code subagents**

**Version 1.0 — March 2026**

> **What's New**: This report synthesizes current best practices for designing Claude Code subagents specialized in SQL Server work — performance monitoring, schema discovery, query optimization, and code review. It draws from official Claude Code documentation, multi-agent SQL research (MAC-SQL framework), community agent collections, and production MCP server integrations.

> **Note**: "Subagent" refers to Claude Code's built-in agent delegation system — specialized Markdown files with YAML frontmatter that run in isolated context windows. "Multi-agent SQL" refers to the broader academic/industry pattern of decomposing SQL tasks across specialized LLM agents.

---

## Executive Summary

Claude Code subagents provide an effective mechanism for packaging SQL Server expertise into reusable, shareable components. The key to success is **separation of concerns** — each agent should handle one domain (performance, schema, query writing, review) with focused tool access, clear trigger descriptions, and structured output formats. The hybrid approach of routing skill + specialized agents combines automatic discoverability with full agent capabilities.

Academic research (MAC-SQL) validates the multi-agent pattern: decomposing SQL tasks across Selector, Decomposer, and Refiner agents outperforms single-agent approaches by 2.18% on benchmarks. The same principle applies to Claude Code — specialized agents with domain-specific prompts consistently outperform generic prompts.

### Research Context

| Parameter | Specification |
|-----------|---------------|
| Topic | SQL Server subagent design patterns for Claude Code plugins |
| Scope | Agent architecture, prompt engineering, tool scoping, routing, generalization |
| Date | 2026-03-06 |
| Sources consulted | 14 |
| Confidence | High |

### Key Findings — Overview

| Finding | Confidence | Impact |
|---------|------------|--------|
| Single-responsibility agents outperform multi-purpose agents | High | Architecture — split by domain, not by task size |
| Routing skills solve discoverability for agent-based plugins | High | Plugin design — one skill routes to multiple agents |
| Tool scoping should follow least-privilege principle | High | Security — read-only agents should not have Edit/Write |
| Agent descriptions drive automatic delegation quality | High | UX — detailed descriptions with examples improve routing |
| Persistent memory enables cross-session learning | Medium | Performance — agents accumulate domain knowledge over time |
| MAC-SQL's Selector-Decomposer-Refiner pattern is adaptable | Medium | Architecture — schema reduction + decomposition + validation |
| Hook-based validation provides defense-in-depth for SQL agents | Medium | Security — validate queries before execution |

---

## 1. Agent Architecture Patterns

### 1.1. Single Responsibility Principle

The most consistent finding across all sources: **each subagent should excel at one specific task**. The official Claude Code documentation states this directly as a best practice, and the MAC-SQL research validates it empirically — their three-agent system outperforms single-agent approaches.

For SQL Server work, the natural decomposition is:

| Agent | Responsibility | Model | Tool Profile |
|-------|---------------|-------|-------------|
| Performance Monitor | DMV analysis, wait stats, health checks | opus | Read-only + MCP SQL tools |
| Schema Discovery | Metadata exploration, dependency mapping | opus | Read-only + MCP SQL tools |
| Performance Tuner | Query optimization, execution plan analysis | opus | Read-only + MCP SQL tools |
| T-SQL Specialist | Query writing, stored procedures, functions | opus | Full tools (needs Edit/Write) |
| Code Reviewer | SQL code review, anti-pattern detection | opus | Read-only (no Edit/Write) |

**Recommendation**: Split agents by domain expertise, not by task complexity. A performance monitor that also tries to fix queries will do both poorly.

### 1.2. Routing Skill Pattern

Plugin agents face a discoverability problem: Claude auto-delegates based on description matching, but with 5+ agents, routing becomes unreliable. The community pattern is a **routing skill** — a lightweight SKILL.md that triggers broadly and instructs Claude which agent to delegate to.

```
User mentions SQL Server → routing skill triggers → skill assesses task → delegates to specific agent
```

This is analogous to MAC-SQL's Selector agent, which triages requests before the specialized agents engage. The routing skill should:

- Match broadly on SQL Server / database / T-SQL keywords
- Provide a decision table mapping task types to agents
- Include "when NOT to use" guidance to avoid false triggers
- Be lightweight (under 100 lines) to minimize context overhead

**Recommendation**: Always pair a collection of plugin agents with a routing skill for discoverability.

### 1.3. Agent Isolation Benefits

Subagents run in isolated context windows. This provides three benefits for SQL Server work:

1. **Verbose output containment**: DMV queries, execution plans, and schema dumps produce large outputs. Keeping them in a subagent's context prevents main conversation pollution.
2. **Tool restriction enforcement**: A read-only performance monitor cannot accidentally modify data, even if the main conversation has write access.
3. **Cost control**: Routing lightweight tasks (schema lookups) to Haiku and heavy analysis (performance tuning) to Opus optimizes spend.

---

## 2. Prompt Engineering for SQL Agents

### 2.1. Structure Template

Based on patterns from the official documentation, community collections (VoltAgent 100+ agents), and production database agents:

```markdown
---
name: agent-name
description: "Clear trigger description with examples"
model: opus
tools: Read, Grep, Glob
disallowedTools: Edit, Write, Bash
---

# Role Definition
[One paragraph: who the agent is, what expertise it has]

## Workflow
[Numbered steps: what the agent does when invoked]

## Domain Knowledge
[SQL Server-specific conventions, DMV references, version-aware features]

## Output Format
[Structured template for consistent results]

## What NOT to Do
[Explicit anti-patterns and boundaries]

## Escalation
[When to recommend a different agent]
```

### 2.2. Description Field Quality

Claude's automatic delegation depends heavily on the `description` field. Best practices from the official docs:

- **Include trigger examples**: "Use when the user asks about slow queries, execution plans, or index recommendations"
- **Use action-oriented language**: "Analyzes" not "Can analyze"
- **Add proactive triggers**: "Use proactively after writing complex queries" encourages Claude to delegate without being asked
- **Be specific about boundaries**: "Do NOT use for schema exploration — use sql-schema-discovery instead"

### 2.3. Generalization Techniques

When converting project-specific agents to reusable plugin agents:

| Project-Specific | Generalized |
|-----------------|-------------|
| "Target: SQL Server 2017 Enterprise" | "Check the project's CLAUDE.md for SQL Server version" |
| "Key views: dbo.vwReq, dbo.vwRepTime" | "Identify key views by querying sys.views" |
| "UDFs: udfDadoByIdDad(idReq, fieldId)" | "Discover UDFs via sys.objects WHERE type IN ('FN','IF','TF')" |
| Hardcoded field IDs | "Check project rules or documentation for field mappings" |
| "Save to docs/roadmaps/" | "Save to the project's documentation directory" |

**Recommendation**: Replace all hardcoded references with dynamic discovery patterns. Teach the agent to find project context rather than embedding it.

### 2.4. SQL Server Domain Knowledge in Prompts

Effective SQL Server agents embed domain-specific knowledge that LLMs don't reliably generate from training data:

- **Waits and Queues methodology**: Teach agents to start with `sys.dm_os_wait_stats` before diving into specifics
- **DMV limitations**: DMVs reset on service restart; always consider uptime context
- **Version-aware features**: Not all features exist in all SQL Server versions (e.g., Query Store in 2016+, STRING_AGG in 2017+)
- **Common anti-patterns**: Scalar UDF per-row execution, FORMAT() vs CONVERT() performance, CTE non-materialization
- **Security boundaries**: Blocked keywords, parameter binding requirements, read-only enforcement

---

## 3. Tool Scoping and Security

### 3.1. Least-Privilege Tool Access

The official documentation recommends **progressive tool expansion** — start restrictive, add tools only as needed:

| Agent Type | Recommended Tools | Rationale |
|-----------|-------------------|-----------|
| Read-only analysts | `Read, Grep, Glob` + MCP SQL tools | Cannot modify files or run arbitrary commands |
| Code reviewers | `Read, Grep, Glob` | Pure analysis, no modifications |
| Query writers | `Read, Edit, Write, Bash` | Needs to create/modify SQL files |
| Performance monitors | `Read, Grep, Glob` + MCP SQL tools | Read-only database access |

### 3.2. Hook-Based SQL Validation

For agents that can execute SQL (via Bash or MCP), use `PreToolUse` hooks to validate queries:

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
```

This provides defense-in-depth beyond the agent's system prompt. The validation script blocks DDL/DML keywords while allowing SELECT queries.

### 3.3. Permission Modes

| Mode | Use Case |
|------|----------|
| `plan` | Performance monitor, schema discovery (pure analysis) |
| `default` | T-SQL specialist (needs approval for file writes) |
| `acceptEdits` | Trusted batch operations with known-safe agents |

**Recommendation**: Default to `plan` mode for read-only agents. Never use `bypassPermissions` for database-connected agents.

---

## 4. Multi-Agent SQL Patterns from Research

### 4.1. MAC-SQL Framework Lessons

The MAC-SQL framework (COLING 2025) demonstrates that decomposing SQL tasks across specialized agents improves accuracy. Their three-agent pattern maps well to Claude Code:

| MAC-SQL Agent | Role | Claude Code Equivalent |
|--------------|------|----------------------|
| Selector | Reduces schema to relevant tables/columns | `sql-schema-discovery` — explores and filters metadata |
| Decomposer | Breaks complex queries into sub-problems | `tsql-specialist` — chain-of-thought query development |
| Refiner | Validates SQL, fixes errors via execution feedback | `sql-code-reviewer` — reviews and validates SQL output |

Key insight: **ablation studies confirm each agent contributes meaningfully** — removing any one agent degrades overall performance. This validates the multi-agent approach over a single monolithic SQL agent.

### 4.2. Schema Reduction Strategy

For large databases, the MAC-SQL Selector pattern is critical. Rather than dumping the entire schema into context, a schema discovery agent should:

1. Query `sys.tables` and `sys.columns` for the full catalog
2. Filter to tables relevant to the user's question
3. Include foreign key relationships between selected tables
4. Pass the reduced schema to the query-writing agent

This keeps context windows manageable and improves query accuracy.

### 4.3. Iterative Refinement

The MAC-SQL Refiner validates SQL by:
1. Checking syntax validity
2. Executing the query and checking for runtime errors
3. Verifying non-empty results
4. Retrying with error feedback if any check fails

This maps directly to a code review agent that validates SQL output from a T-SQL specialist, creating a two-pass quality improvement loop.

---

## 5. Plugin-Specific Considerations

### 5.1. Agent Generalization for Marketplace Distribution

When packaging agents as a plugin for marketplace distribution:

- **No hardcoded paths**: Use relative references or dynamic discovery
- **No version pinning**: Let agents detect SQL Server version from `@@VERSION` or project context
- **No project-specific schemas**: Teach agents to discover schema dynamically via DMVs
- **Include MCP server guidance**: Document how to configure MCP SQL Server connectivity
- **Provide example CLAUDE.md sections**: Show users how to add project-specific context that agents consume

### 5.2. Persistent Memory for Domain Learning

Claude Code supports agent-level persistent memory via the `memory` frontmatter field:

```yaml
memory: user  # Persists across all projects
```

For SQL Server agents, memory enables:
- Accumulating knowledge about recurring query patterns
- Remembering schema conventions across sessions
- Building a catalog of optimization insights for specific environments

**Recommendation**: Use `memory: user` for general SQL Server knowledge that applies across projects. Advise users to periodically ask agents to update their memory with session learnings.

### 5.3. MCP Server Integration

SQL Server agents are most effective when paired with an MCP server that provides database access. The plugin should document:

- How to set up the MCP SQL Server connection
- Which MCP tools the agents expect (execute_query, describe_table, etc.)
- That agents degrade gracefully when no MCP server is available (fall back to file-based SQL analysis)

The `mcpServers` frontmatter field can reference pre-configured servers by name:

```yaml
mcpServers:
  - sql-server
```

---

## 6. Anti-Patterns to Avoid

### 6.1. Agent Over-Proliferation

Community sources warn: "Flooding Claude with too many custom agent options degrades automatic delegation effectiveness." Keep the agent count manageable (5-7 maximum per plugin) and ensure descriptions are distinct enough for reliable routing.

### 6.2. Generic System Prompts

Avoid inheriting redundant context. SQL Server agents should contain SQL Server-specific knowledge, not general programming guidance. Each token in the system prompt has a cost — make it count.

### 6.3. Missing Output Format Specifications

Agents without structured output formats produce inconsistent results. Always define:
- Summary format (one paragraph, verdict)
- Findings format (severity, location, issue, fix)
- Tables for comparative analysis
- Escalation recommendations

### 6.4. Ignoring Agent Boundaries

Agents should know when to stop and recommend a different agent. A performance monitor that discovers a schema issue should say "use sql-schema-discovery for this" rather than attempting schema analysis itself.

---

## Source Quality Assessment

| Source Type | Availability | Quality | Notes |
|-------------|--------------|---------|-------|
| Official Claude Code docs | High | High | Authoritative, up-to-date, comprehensive |
| Community agent collections | High | Medium | Large volume but variable quality |
| Academic multi-agent SQL research | High | High | Peer-reviewed, empirically validated |
| Production MCP integrations | Medium | High | Real-world SQL Server + AI patterns |
| Blog posts and tutorials | High | Medium | Practical but sometimes outdated |

---

## Knowledge Gaps

- [ ] Quantitative benchmarks for Claude Code subagent delegation accuracy with 5+ agents
- [ ] Performance overhead of routing skill + agent delegation vs direct agent invocation
- [ ] Optimal persistent memory strategies for SQL Server domain learning over time
- [ ] Best practices for MCP server fallback when database connectivity is unavailable
- [ ] Claude Code plugin agent namespace collision handling across multiple plugins

---

## Key Sources

| # | Source | Type | Date | Relevance |
|---|--------|------|------|-----------|
| 1 | [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents) | Primary | 2026 | Authoritative reference for all agent configuration options |
| 2 | [Best practices for Claude Code subagents](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/) | Expert | 2026 | Three-stage pipeline, HITL patterns, tool scoping |
| 3 | [MAC-SQL: Multi-Agent Collaborative Framework](https://arxiv.org/abs/2312.11242v2) | Academic | 2025 | Selector-Decomposer-Refiner architecture for SQL tasks |
| 4 | [VoltAgent awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | Community | 2026 | 100+ agent examples including database specialists |
| 5 | [Building AI Agents with Claude Code](https://ghostinthedata.info/posts/2025/2025-09-13-building-ai-agents-with-claude-code/) | Expert | 2025 | SQL validation agent patterns for data engineering |
| 6 | [PerformanceMonitor (Erik Darling)](https://github.com/erikdarlingdata/PerformanceMonitor) | Primary | 2026 | Production SQL Server monitoring with MCP AI integration |
| 7 | [Custom agents - ClaudeLog](https://claudelog.com/mechanics/custom-agents/) | Expert | 2026 | Anti-patterns, model selection, progressive tool expansion |
| 8 | [Agent design patterns](https://rlancemartin.github.io/2026/01/09/agent_design/) | Expert | 2026 | General agent architecture including caching and delegation |
| 9 | [Multi-Agent SQL Assistant](https://towardsdatascience.com/a-multi-agent-sql-assistant-you-can-trust-with-human-in-loop-checkpoint-llm-cost-control/) | Expert | 2025 | Human-in-loop SQL agent patterns |
| 10 | [How to Write a Good Spec for AI Agents](https://www.oreilly.com/radar/how-to-write-a-good-spec-for-ai-agents/) | Expert | 2025 | Agent specification best practices |
| 11 | [Intro to Claude Code for Data Engineers](https://thepipeandtheline.substack.com/p/intro-claude-code-for-data-engineers) | Expert | 2026 | Skills and MCP patterns for data stack work |
| 12 | [11 prompting techniques for better AI agents](https://www.augmentcode.com/blog/how-to-build-your-agent-11-prompting-techniques-for-better-ai-agents) | Expert | 2026 | Prompt engineering for agent specialization |
| 13 | [Exposing SQL Server to AI Agents Safely](https://medium.com/@lorenzouriel/exposing-sql-server-to-ai-agents-safely-with-the-mssql-mcp-python-server-a42ba974d1be) | Expert | 2025 | MCP SQL Server security patterns |
| 14 | [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) | Expert | 2025 | Skills vs agents architecture analysis |

---

**Report generated on**: March 2026
**Version**: 1.0
**Author**: Deep Research Analyst (Claude Code Agent)
**Methodology**: Multi-source internet research with critical evaluation
