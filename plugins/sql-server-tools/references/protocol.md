# SQL Server Tools Protocol

Shared rules for every sql-server-tools agent. Read this file before anything else and follow it for the whole session.

## Contents

- [Connectivity](#connectivity)
- [Environment Detection](#environment-detection)
- [MCP Query Rules](#mcp-query-rules)
- [Read-Only Safety](#read-only-safety)
- [Severity Scale](#severity-scale)
- [Final Message](#final-message)
- [Memory](#memory)

## Connectivity

1. Call `mcp__mcp-sql-server__list_databases` first.
2. **LIVE mode**: at least one alias has `status: ok`.
   - Use the alias the caller named.
   - If the alias the caller named is not `ok`, use none. The Mode line reads `Mode: STOPPED (alias <name> not ok: <status>)`, the reason goes under "Questions for the caller", then stop.
   - If exactly one alias is `ok` and the caller named none, use it.
   - If several aliases are `ok` and the caller named none, use none of them: the Mode line reads `Mode: STOPPED (alias not chosen: <alias list>)`, list the aliases under "Questions for the caller" and stop.
   - Pass `database=<alias>` on every later mcp-sql-server tool call, including the Environment Detection query. The tools silently fall back to the `default` alias when it is omitted.
3. **SCRIPT mode**: the tool is unavailable, or no alias has `status: ok`.
   - The first line of the final message is `Live mode unavailable: <reason>`.
   - Output the relevant reference queries as a numbered script for the user to run.
   - In SCRIPT mode, replace each `?` with the literal value before emitting the script; SSMS and sqlcmd do not bind `?`.
   - T-SQL compiles a whole batch first, so one query the server cannot run (Msg 207/208, such as a 2022-only view on 2019, Query Store on 2014, or `sys.master_files` on Azure SQL DB) would kill the whole script. Put `GO` on its own line after each query.
   - Without environment data you cannot apply the gates, so put each block's `Requires:` and `Azure SQL DB:` lines above its query as `-- ` comments.
   - When the version or edition is unknown, emit both the box query and its `-azure` variant, each labelled. The user's server will reject the one that does not apply; that error is expected.
   - Analyze results only if the caller supplied them. Never invent output: no table names, row counts, wait types or metrics that did not come from a real result.

## Environment Detection

In LIVE mode, run this exact query once per session with `mcp__mcp-sql-server__execute_query`, before any other query:

```sql
SELECT
    CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS product_version,
    CAST(SERVERPROPERTY('ProductMajorVersion') AS int) AS major_version,
    CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) AS edition,
    CAST(SERVERPROPERTY('EngineEdition') AS int) AS engine_edition,
    DB_NAME() AS database_name,
    (SELECT d.compatibility_level FROM sys.databases AS d WHERE d.name = DB_NAME()) AS compat_level,
    HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE') AS has_view_server_state,
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'VIEW DATABASE STATE') AS has_view_database_state
```

Branch on the result:

- `engine_edition`: 5 = Azure SQL Database (use a query's `-azure` variant when it has one; skip queries marked N/A for Azure SQL DB), 8 = Azure SQL Managed Instance, anything else = box SQL Server.
- `major_version`: 11 = 2012, 12 = 2014, 13 = 2016, 14 = 2017, 15 = 2019, 16 = 2022, 17 = 2025. Skip any query whose `Requires:` line is above this version and say so under "Assumptions and not checked".
- Azure exceptions (Azure SQL Database always reports `major_version` = 12, and older Managed Instances can too):
  - When `engine_edition` = 5 (Azure SQL Database), ignore `major_version`; gate on `compat_level` and the query's `Azure SQL DB:` line.
  - When `engine_edition` = 8 (Managed Instance) and `major_version` = 12, ignore `major_version`; treat the engine as current, gate on `compat_level` only, and run the box SQL Server version of each query.
- `has_view_server_state` / `has_view_database_state` = 0: skip queries that need that permission and name the missing permission in the final message.
- `compat_level`: features such as Intelligent Query Processing depend on it, not only on `major_version`.

In SCRIPT mode, put the Environment Detection query first in the emitted script.

## MCP Query Rules

`execute_query` wraps every query as `SELECT TOP n * FROM (<your query>) AS _limited_query` and scans the raw text for blocked keywords. `scripts/check-queries.mjs` enforces the same rules on the reference packs. A query must obey all of these:

1. **Starts with `SELECT`.** The first token after whitespace and `--` comment lines must be `SELECT`. A query starting with `WITH` is rejected, and a CTE cannot sit inside the derived-table wrapper anyway: rewrite CTEs as derived tables or `CROSS APPLY`.
2. **No blocked keywords anywhere.** DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE, SHUTDOWN, BACKUP, RESTORE, DBCC, OPENROWSET, OPENQUERY, OPENDATASOURCE, BULK and KILL are rejected as whole words even inside comments and string literals, because the server scans the raw text. Column names such as `create_date` are fine; a literal such as `N'BACKUPIO'` is fine; `'BACKUP'` is not.
3. **No `sp_` or `xp_` tokens anywhere**, including inside literals (for example a wait type named `SP_SERVER_DIAGNOSTICS_SLEEP`). Filter such values with `LIKE` patterns that do not form the token, or leave them out.
4. **`ORDER BY` at the top level needs `TOP` at the top level.** A derived table cannot contain `ORDER BY` without `TOP`. `ORDER BY` inside `OVER (...)` or inside a subquery that has its own `TOP` is fine. In `TOP (n)`, n is the number of rows you want (for a top-N report n = N; to keep every row, n ≥ the maximum possible rows). The wrapper does not guarantee order, so return a rank column such as `ROW_NUMBER() OVER (ORDER BY …) AS rn` and sort by it when you present results. When n > 1000, pass `limit` = n to `execute_query` (max 10000). If a response has `truncated: true`, say so under "Assumptions and not checked".
5. **No `;`** outside string literals: a statement terminator inside the derived-table wrapper is a syntax error.
6. **No `OPTION (...)`** at the top level: query hints cannot sit inside a derived table.
7. **No variables.** `@name` is rejected; `@@VERSION` and `@@SPID` are allowed. Pass parameters as `?` placeholders with the `params` list. A query block's `Params:` line labels the positional `?` placeholders `?1`, `?2`, … in order of appearance. Pass the values in that order in `params`; the SQL itself contains plain `?`.

Also:

- Name every output column, and keep names unique: the wrapper's `SELECT *` fails on unnamed or duplicate columns.
- Return only JSON-safe types. Results pass through pyodbc and then a JSON encoder, and a single unsupported value fails the whole query. Convert these output columns, and leave them unconverted in joins and `APPLY`:
  - `binary`/`varbinary` (hashes, handles, sids): `CONVERT(varchar(n), col, 1)`.
  - `datetimeoffset` (most Query Store times): `CAST(SWITCHOFFSET(col, '+00:00') AS datetime2(3)) AS <name>_utc`.
  - `sql_variant` (`SERVERPROPERTY`, `sys.configurations`, extended properties): `CAST` to a concrete type.
- If a query is rejected, rewrite it to comply. Never retry it unchanged.

## Read-Only Safety

- Agents never modify data or schema. Use only the tools in your frontmatter. Database access is read-only. Edit and Write, where granted, are for workspace files and are never used to apply SQL.
- Deliver every DDL or DML recommendation as a script for the user to review and run. Never claim it was applied.
- Heavy DMVs:
  - `sys.dm_db_index_physical_stats` only in `'LIMITED'` mode and for one object at a time.
  - Plan-cache queries (`sys.dm_exec_query_stats`, `sys.dm_exec_cached_plans`) always use `TOP (n)` with n = the rows you need (see MCP Query Rules, rule 4).
  - Never pull the plans of the whole cache.
- Never recommend `DBCC FREEPROCCACHE`, `DBCC DROPCLEANBUFFERS`, shrinking files, `KILL` or `sp_configure` changes on production without stating the impact and that change control is required.

## Severity Scale

Use these four levels, and only these, for every finding:

| Level | Meaning |
|-------|---------|
| CRITICAL | Data loss or corruption risk, security hole, or outage |
| HIGH | Major performance or correctness defect likely to hit production |
| MEDIUM | Measurable cost or maintainability issue |
| LOW | Style or minor improvement |

## Final Message

The final message has these parts, in this order:

1. **Mode line**, one of:
   - `Mode: LIVE (<alias>, <product_version>, <edition>)`
   - `Live mode unavailable: <reason>` (SCRIPT mode)
   - `Mode: STOPPED (<reason>)`, in one of two forms (see Connectivity):
     - `Mode: STOPPED (alias not chosen: <alias list>)`: several `ok` aliases, none named.
     - `Mode: STOPPED (alias <name> not ok: <status>)`: the named alias is not `ok`.
2. **Findings**: the agent's own report format, with severities from the scale above and evidence for each finding.
3. **Assumptions and not checked**: what was assumed, skipped (version, permission, Azure) or out of scope.
4. **Questions for the caller**: a subagent cannot ask questions mid-run, so collect them here.
5. **Suggested handoffs**: written as "Recommend the caller delegate <X> to `sql-server-tools:<agent>`". A subagent cannot spawn another agent.

## Memory

Memory scope is `local`.

- Save: environment facts (alias, version, edition, compat level, permissions), baselines (wait profile, key metrics with their capture date) and conventions the user confirmed.
- Never save credentials, connection strings or data rows.
