# SQL Server Plugin Design Validation Report

**Review of the sql-server-tools plugin design against Claude Code best practices and official documentation**

**Version 1.0 — March 2026**

> **What's New**: This report validates our proposed `sql-server-tools` plugin design (hybrid agents + routing skill) against the official Claude Code plugins reference, skill authoring best practices, and subagent documentation. It identifies one critical design issue and several confirmations.

---

## Executive Summary

The overall design is sound — the hybrid approach (5 agents + 1 routing skill) aligns with official documentation and community best practices. However, **one critical issue** was found: the `reference/` directory approach for progressive disclosure in agents won't work reliably in a plugin context. Agents are standalone `.md` files, not directories, and they don't know their plugin cache path. The solution is to either keep agents self-contained (under 500 lines) or use the `skills` frontmatter field to preload reference content.

### Research Context

| Parameter | Specification |
|-----------|---------------|
| Topic | Validation of sql-server-tools plugin design |
| Scope | Directory structure, agent format, routing skill, reference files, memory |
| Date | 2026-03-06 |
| Sources consulted | 8 |
| Confidence | High |

### Key Findings — Overview

| Finding | Confidence | Impact | Status |
|---------|------------|--------|--------|
| Plugin `agents/` directory auto-discovered correctly | High | Confirmed | PASS |
| Routing skill + agent delegation is a valid pattern | High | Confirmed | PASS |
| `reference/` directory for agents WON'T work in plugin cache | High | Critical — requires design change | FAIL |
| Model selection per agent is well-supported | High | Confirmed | PASS |
| `memory:` frontmatter field works for plugin agents | High | Confirmed | PASS |
| Agent descriptions drive automatic delegation | High | Confirmed | PASS |
| Permission modes (plan, default) work as designed | High | Confirmed | PASS |

---

## 1. Critical Issue: Reference Files for Agents

### 1.1. The Problem

Our design includes:
```
agents/
  sql-performance-monitor.md
  reference/
    wait-stats-categories.md
    dmv-query-templates.md
    sql-conventions.md
```

The intent is that agent prompts reference these files via progressive disclosure: "For detailed wait type categorization, see [reference/wait-stats-categories.md](reference/wait-stats-categories.md)."

**This won't work reliably because:**

1. **Agents are standalone `.md` files**, not directories. Unlike skills (which have a `skill-name/SKILL.md` directory structure with bundled files), agents are flat files in the `agents/` directory.

2. **Plugin caching**: Plugins are cached to `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. The `reference/` directory would be cached alongside the agent files, but...

3. **Agent working directory is the project**, not the plugin cache. When a subagent runs, its working directory is the user's project. The agent would need to know the absolute path to the plugin cache to read reference files.

4. **No `${CLAUDE_PLUGIN_ROOT}` in agent prompts**: The `${CLAUDE_PLUGIN_ROOT}` variable works in hooks and MCP server configs, but it's **not interpolated** in agent markdown body text. The agent's system prompt receives the raw markdown — no variable substitution.

### 1.2. Solutions

**Option A: Keep agents self-contained (Recommended)**

Trim each agent to under 500 lines by removing redundant content that Claude already knows. The original `sql-performance-monitor.md` is 800+ lines, but much of it explains SQL Server fundamentals that Claude already understands well.

Applying the Anthropic conciseness principle ("Default assumption: Claude is already very smart. Only add context Claude doesn't already have"), most agents can fit in 200-300 lines.

**Option B: Use `skills` frontmatter to preload reference content**

The `skills` field in agent frontmatter injects skill content into the agent's context at startup:

```yaml
---
name: sql-performance-monitor
skills:
  - sql-wait-stats-reference
  - sql-dmv-templates
---
```

This requires creating the reference content as skills, not standalone files. The skills would be loaded alongside the agent's system prompt.

**Pros**: Progressive disclosure — only loaded when the specific agent runs.
**Cons**: Reference "skills" would appear in the skill list but aren't meant to be invoked directly. Adds complexity.

**Option C: Embed critical reference content, link to external docs**

Embed the most-used reference content directly in the agent prompt. For rarely-needed details, the agent can use WebSearch/WebFetch to look up SQL Server documentation on demand.

**Recommendation**: **Option A (self-contained agents)** is the simplest and most reliable approach. Apply aggressive conciseness — remove what Claude already knows, keep only project-specific conventions and domain-specific gotchas.

---

## 2. Validated Design Elements

### 2.1. Plugin Directory Structure — CONFIRMED

From the official [Plugins Reference](https://code.claude.com/docs/en/plugins-reference):

```
plugins/sql-server-tools/
├── .claude-plugin/
│   └── plugin.json           # Only manifest here
├── agents/                    # At root level — auto-discovered
│   ├── sql-performance-monitor.md
│   ├── sql-schema-discovery.md
│   ├── sql-performance-tuner.md
│   ├── tsql-specialist.md
│   └── sql-code-reviewer.md
├── skills/                    # At root level — auto-discovered
│   └── sql-server-toolkit/
│       └── SKILL.md
└── README.md
```

The official docs explicitly confirm:
- `agents/` at plugin root is auto-discovered
- `skills/` at plugin root is auto-discovered
- `.claude-plugin/` contains ONLY `plugin.json`
- Components MUST NOT be inside `.claude-plugin/`

### 2.2. Routing Skill Pattern — CONFIRMED

From the official [Skills documentation](https://code.claude.com/docs/en/skills) and [Skills explained](https://claude.com/blog/skills-explained):

Claude uses pure LLM reasoning to decide which skill to invoke — no regex, no keyword matching. The description field is critical. The routing skill pattern works because:

1. Skill metadata (name + description) is pre-loaded at startup (~100 tokens)
2. When the skill triggers, its body is loaded with the decision table
3. The skill instructs Claude to delegate to the appropriate agent
4. Agents are invocable via the Agent tool from the main conversation

The `context: fork` pattern in skills allows a skill to specify an agent type for execution, providing an even tighter integration path.

### 2.3. Agent Frontmatter Fields — CONFIRMED

All fields in our design are supported per the official [subagents documentation](https://code.claude.com/docs/en/sub-agents):

| Field | Our Usage | Status |
|-------|-----------|--------|
| `name` | Yes — kebab-case identifiers | VALID |
| `description` | Yes — detailed with trigger examples | VALID |
| `model` | Yes — opus/sonnet per agent | VALID |
| `tools` | Yes — Read, Grep, Glob for most | VALID |
| `disallowedTools` | Yes — Edit, Write, Bash for read-only | VALID |
| `permissionMode` | Yes — plan for read-only, default for writer | VALID |
| `memory` | Yes — user/project scopes | VALID |
| `color` | Yes — distinct per agent | VALID |

### 2.4. Memory Configuration — CONFIRMED

The `memory` frontmatter field was introduced in Claude Code v2.1.33 (February 2026). It creates a persistent `MEMORY.md` file at:
- `memory: user` → `~/.claude/agent-memory/<agent-name>/`
- `memory: project` → `.claude/agent-memory/<agent-name>/`

The first 200 lines of MEMORY.md are injected into the agent's system prompt at startup. Read, Write, and Edit tools are automatically enabled when memory is configured.

Our design correctly uses `memory: user` for cross-project SQL Server knowledge and `memory: project` for schema discovery (project-specific schemas).

### 2.5. Model Selection — CONFIRMED

Our 2-opus + 3-sonnet split aligns with official guidance:

- **Opus**: "Complex problem-solving, deep system design, architectural decisions" — matches performance monitor and tuner
- **Sonnet**: "Feature implementation, code reviews, API integration, database work" — matches schema discovery, T-SQL specialist, and code reviewer
- The official model selection guide from Anthropic explicitly recommends Sonnet for "database work" and code reviews

### 2.6. Plugin Agent Priority — CONFIRMED

Plugin agents have the lowest priority (4th):

1. CLI `--agents` flag (highest)
2. Project `.claude/agents/`
3. User `~/.claude/agents/`
4. Plugin `agents/` (lowest)

This means users can override any plugin agent with a project-level or user-level agent of the same name. This is desirable — users can customize agents for their specific environment.

---

## 3. Minor Recommendations

### 3.1. Agent Naming Convention

Plugin agents are namespaced: `sql-server-tools:sql-performance-monitor`. This creates long names. Consider shorter agent names since the plugin prefix is already descriptive:

| Current | Shorter Alternative |
|---------|-------------------|
| `sql-performance-monitor` | `perf-monitor` |
| `sql-schema-discovery` | `schema-explorer` |
| `sql-performance-tuner` | `query-tuner` |
| `tsql-specialist` | `tsql-writer` |
| `sql-code-reviewer` | `sql-reviewer` |

Full namespaced names would be: `sql-server-tools:perf-monitor`, `sql-server-tools:schema-explorer`, etc.

**Recommendation**: Keep original names. They're clearer standalone and the namespace length is a minor inconvenience vs the clarity benefit.

### 3.2. Routing Skill `context: fork` Pattern

Instead of the routing skill simply instructing Claude which agent to delegate to, consider using the `context: fork` pattern in the skill. This allows the skill to directly specify an agent to execute within:

```yaml
---
name: sql-server-toolkit
description: Routes SQL Server tasks to specialized agents
context: fork
agent: sql-performance-monitor  # Default agent
---
```

However, this only supports a single agent. For routing to multiple agents, the text-based decision table approach in the skill body is better. **Keep the current design.**

### 3.3. `maxTurns` Consideration

Consider adding `maxTurns` to prevent runaway agents:

| Agent | Suggested maxTurns | Rationale |
|-------|-------------------|-----------|
| Performance Monitor | 30 | May need many DMV queries |
| Schema Discovery | 20 | Systematic but bounded exploration |
| Performance Tuner | 25 | Analysis + optimization suggestions |
| T-SQL Specialist | 20 | Query writing is focused |
| Code Reviewer | 15 | Read-only review is bounded |

---

## 4. Revised Plugin Structure

Based on this validation, the corrected structure is:

```
plugins/sql-server-tools/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── sql-performance-monitor.md    (~250-300 lines, self-contained)
│   ├── sql-schema-discovery.md       (~200 lines, self-contained)
│   ├── sql-performance-tuner.md      (~200 lines, self-contained)
│   ├── tsql-specialist.md            (~250 lines, self-contained)
│   └── sql-code-reviewer.md          (~200 lines, self-contained)
├── skills/
│   └── sql-server-toolkit/
│       └── SKILL.md                  (~80 lines, routing skill)
└── README.md
```

**Removed**: `agents/reference/` directory (won't work in plugin cache context).

**Change**: Each agent is self-contained with concise, Claude-doesn't-already-know-this content.

---

## Source Quality Assessment

| Source Type | Availability | Quality | Notes |
|-------------|--------------|---------|-------|
| Official Claude Code Plugins Reference | High | High | Definitive — schema, directory structure, caching behavior |
| Official Subagents Documentation | High | High | Frontmatter fields, memory, delegation patterns |
| Official Skill Best Practices | High | High | Conciseness, progressive disclosure, anti-patterns |
| Community agent patterns | High | Medium | Practical validation of routing patterns |

---

## Knowledge Gaps

- [ ] Whether `skills` frontmatter in plugin agents can reference skills from the same plugin (Option B fallback)
- [ ] Exact token overhead of agent system prompts at 300 vs 500 lines in practice
- [ ] Whether `${CLAUDE_PLUGIN_ROOT}` will be supported in agent prompts in future versions

---

## Key Sources

| # | Source | Type | Date | Relevance |
|---|--------|------|------|-----------|
| 1 | [Plugins Reference - Claude Code Docs](https://code.claude.com/docs/en/plugins-reference) | Primary | 2026 | Plugin directory structure, manifest schema, caching behavior |
| 2 | [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents) | Primary | 2026 | Agent frontmatter, memory, delegation, progressive disclosure |
| 3 | [Skill authoring best practices - Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | Primary | 2026 | Conciseness, progressive disclosure patterns, anti-patterns |
| 4 | [Skills explained - Claude Blog](https://claude.com/blog/skills-explained) | Primary | 2026 | How skill discovery works (LLM reasoning, not keyword matching) |
| 5 | [Sub-Agent Best Practices - ClaudeFast](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) | Expert | 2026 | Parallel vs sequential patterns, coordination |
| 6 | [Claude Code Extensibility Guide](https://happysathya.github.io/claude-code-extensibility-guide.html) | Expert | 2026 | Plugin component auto-discovery rules |
| 7 | [Agent Memory Best Practice](https://github.com/shanraisshan/claude-code-best-practice/blob/main/reports/claude-agent-memory.md) | Expert | 2026 | Persistent memory configuration patterns |
| 8 | [Plugins in the SDK - Anthropic](https://platform.claude.com/docs/en/agent-sdk/plugins) | Primary | 2026 | SDK-level plugin architecture |

---

**Report generated on**: March 2026
**Version**: 1.0
**Author**: Deep Research Analyst (Claude Code Agent)
**Methodology**: Official documentation review with cross-reference validation
