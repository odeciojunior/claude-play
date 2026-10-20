---
name: sql-server-toolkit
description: Routes SQL Server work to the sql-server-tools agents and chains them for multi-step tasks. Use when a SQL Server task needs more than one agent or the right agent is unclear.
---

# SQL Server Toolkit

Route SQL Server work to the right `sql-server-tools` agent, chain agents for compound tasks, and relay what they ask.

## Steps

1. **Pick the agent** from the table. Apply the tie-breakers when two rows fit.

   | Task | Agent |
   |------|-------|
   | Server-wide or unknown-cause slowness with no specific query named, high CPU, blocking, deadlocks, health checks, baselines | `sql-performance-monitor` |
   | One specific query, stored procedure or execution plan to speed up; index recommendations; rewrites | `sql-performance-tuner` |
   | Tables, columns, relationships, dependencies, indexes, schema documentation | `sql-schema-discovery` |
   | Writing or changing SQL; explaining T-SQL (queries, procedures, functions, views) | `tsql-specialist` |
   | Reviewing SQL, new or existing (migrations, procedures, scripts), for correctness, anti-patterns, security, regression risk | `sql-code-reviewer` |

   Tie-breakers:
   - Slowness with no named query, or a cause nobody knows: monitor. One named query, procedure or plan: tuner.
   - If the monitor finds one culprit query, hand that query to the tuner.
   - Reviewing SQL, new or existing: reviewer. Writing or changing SQL: tsql-specialist.

2. **Call the Agent tool** with `subagent_type: "sql-server-tools:<agent>"` (for example `sql-server-tools:sql-performance-tuner`). The subagent sees nothing of this conversation, so make the prompt self-contained:
   - the goal: the user's request verbatim, plus a one-sentence restatement;
   - the SQL text, or the file path to read (pass an absolute path, resolving relative paths against the working directory; do not paste file contents);
   - the mcp-sql-server database alias if the user named one, otherwise write "No alias given" so the agent applies its own alias rules;
   - facts already established: server version, earlier findings, constraints, and the symptoms, timings and numbers the user gave (for example "since 9am", "30 s").

3. **Chain compound tasks** in this order: `sql-schema-discovery` → `sql-performance-tuner` → `sql-code-reviewer`. Another valid chain is `sql-performance-monitor` → `sql-performance-tuner`: when server-wide findings name specific queries, send those to the tuner. Paste each agent's findings into the next agent's prompt. Skip the stages the task does not need: run schema discovery first only when the task is about indexes or structure, or when the tuner's "Questions for the caller" ask for schema. Subagents cannot spawn other agents, so you run the chain.

4. **Relay the output.** Every agent ends with "Questions for the caller" and "Suggested handoffs". Show the questions to the user and wait for answers before re-running an agent. After the user answers, re-run that agent with the original prompt, the agent's findings and the user's answers appended. Act on a suggested handoff only when it serves the user's request.

## Live and script mode

Agents run read-only queries themselves when an mcp-sql-server alias is reachable (LIVE mode). Otherwise they open with `Live mode unavailable: <reason>` and emit queries for the user to run (SCRIPT mode). An agent stops with `Mode: STOPPED (alias not chosen: ...)` when several aliases are reachable and none was named, and with `Mode: STOPPED (alias <name> not ok: <status>)` when the alias you passed is not reachable. In both cases ask the user which alias to use (or to fix the named one), then call the agent again with it.

## When NOT to use

- Work in other languages, or on non-SQL-Server databases (PostgreSQL, MySQL): the agents use SQL Server DMVs and T-SQL.
- Tasks that do not involve SQL Server.

## Setup

Live access needs the `mcp-sql-server` MCP server, registered under that name. Run the `mcp-sql-server:mcp-sql-server-setup` skill to install and configure it. Without it, agents work in SCRIPT mode.
