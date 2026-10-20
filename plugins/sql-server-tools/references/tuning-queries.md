# Tuning Query Pack

Vetted read-only queries for `sql-performance-tuner`. Every block obeys the MCP Query Rules in `protocol.md` and passes `scripts/check-queries.mjs`. Run the Environment Detection query from `protocol.md` first and gate each block on its `Requires:`, `Azure SQL DB:` and `Permission:` lines.

## Contents

- [Using this pack](#using-this-pack)
- [Query blocks](#query-blocks)
  - [tuning.plan-by-text](#tuningplan-by-text)
  - [tuning.stats-freshness](#tuningstats-freshness)
  - [tuning.table-indexes](#tuningtable-indexes)
  - [tuning.query-store-state](#tuningquery-store-state)
  - [tuning.query-store-variance](#tuningquery-store-variance)
- [Plan XML cues](#plan-xml-cues)

## Using this pack

- LIVE mode: pass the `Params:` values in `?1`, `?2` order in the `params` list of `mcp__mcp-sql-server__execute_query`, with `database=<alias>`.
- SCRIPT mode: replace each `?` with its literal value (`N'dbo.Orders'`, `24`) before emitting the script, because SSMS and sqlcmd do not bind `?` placeholders.
- Object-scoped queries (`?1` = `'schema.table'`) and Query Store queries run in the database that holds the object: the alias must point at that database.

## Query blocks

### tuning.plan-by-text
- Purpose: Find cached statements whose batch text matches a pattern, with runtime stats and the statement-level plan, ranked by total CPU.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: VIEW SERVER STATE (Azure SQL DB: VIEW DATABASE STATE)
- Params: `?1` = `LIKE` pattern on the batch text, such as `%FROM dbo.Orders%WHERE CustomerId%`

`statement_plan` is the showplan XML as text (from `sys.dm_exec_text_query_plan`, so plans deeper than the XML nesting limit still return). Scan it for the [Plan XML cues](#plan-xml-cues). It is an estimated plan: it has no `ActualRows` or `ParameterRuntimeValue`.

```sql
SELECT TOP (5)
    ROW_NUMBER() OVER (ORDER BY qs.total_worker_time DESC) AS rn,
    DB_NAME(st.dbid) AS database_name,
    OBJECT_NAME(st.objectid, st.dbid) AS object_name,
    qs.execution_count,
    qs.total_worker_time / NULLIF(qs.execution_count, 0) / 1000.0 AS avg_cpu_ms,
    qs.total_elapsed_time / NULLIF(qs.execution_count, 0) / 1000.0 AS avg_elapsed_ms,
    qs.min_elapsed_time / 1000.0 AS min_elapsed_ms,
    qs.max_elapsed_time / 1000.0 AS max_elapsed_ms,
    qs.total_logical_reads / NULLIF(qs.execution_count, 0) AS avg_logical_reads,
    qs.total_rows / NULLIF(qs.execution_count, 0) AS avg_rows,
    qs.creation_time AS plan_cached_at,
    qs.last_execution_time,
    CONVERT(varchar(18), qs.query_hash, 1) AS query_hash,
    CONVERT(varchar(18), qs.query_plan_hash, 1) AS query_plan_hash,
    SUBSTRING(st.text, qs.statement_start_offset / 2 + 1,
        (CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END
         - qs.statement_start_offset) / 2 + 1) AS statement_text,
    tqp.query_plan AS statement_plan
FROM sys.dm_exec_query_stats AS qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS st
OUTER APPLY sys.dm_exec_text_query_plan(qs.plan_handle, qs.statement_start_offset, qs.statement_end_offset) AS tqp
WHERE st.text LIKE ?
  AND st.text NOT LIKE N'%[_]limited[_]query%'
ORDER BY qs.total_worker_time DESC
```

### tuning.stats-freshness
- Purpose: Age, sample rate and modifications since the last update for every statistics object on one table.
- Requires: SQL Server 2012 SP1+ (`product_version` ≥ 11.0.3000)
- Azure SQL DB: same
- Permission: none (SELECT on the table, or db_owner / db_ddladmin)
- Params: `?1` = `'schema.table'`

`auto_update_threshold_rows` is the number of modifications that triggers an automatic statistics update: the lower of 500 + 20% of rows and SQRT(1000 × rows) at compat 130+ (TF 2371 before that); 500 for tables of 500 rows or fewer; 500 + 20% below 130 without TF 2371. The column shows the compat 130+ value. A row with NULL `last_updated` is a statistics object that was never populated. NULL `sys.dm_db_stats_properties` columns, or no rows at all, can also mean the login lacks permission on the table: say so rather than reporting the statistics as empty.

```sql
SELECT TOP (1000)
    ROW_NUMBER() OVER (ORDER BY prop.modification_counter DESC, s.name) AS rn,
    OBJECT_SCHEMA_NAME(s.object_id) AS schema_name,
    OBJECT_NAME(s.object_id) AS table_name,
    s.stats_id,
    s.name AS stats_name,
    STUFF((SELECT N', ' + QUOTENAME(c.name)
           FROM sys.stats_columns AS sc
           JOIN sys.columns AS c ON c.object_id = sc.object_id AND c.column_id = sc.column_id
           WHERE sc.object_id = s.object_id AND sc.stats_id = s.stats_id
           ORDER BY sc.stats_column_id
           FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'') AS stats_columns,
    s.auto_created,
    s.user_created,
    s.no_recompute,
    s.has_filter,
    s.filter_definition,
    prop.last_updated,
    prop.rows AS table_rows,
    prop.rows_sampled,
    CAST(100.0 * prop.rows_sampled / NULLIF(prop.rows, 0) AS decimal(5, 1)) AS sample_pct,
    prop.steps AS histogram_steps,
    prop.modification_counter,
    CAST(100.0 * prop.modification_counter / NULLIF(prop.rows, 0) AS decimal(19, 1)) AS modified_pct,
    CAST(CASE WHEN prop.rows <= 500 THEN 500
              WHEN 500 + 0.20 * prop.rows < SQRT(1000.0 * prop.rows) THEN 500 + 0.20 * prop.rows
              ELSE SQRT(1000.0 * prop.rows) END AS bigint) AS auto_update_threshold_rows
FROM sys.stats AS s
OUTER APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) AS prop
WHERE s.object_id = OBJECT_ID(?)
ORDER BY prop.modification_counter DESC, s.name
```

### tuning.table-indexes
- Purpose: Every index on one table with ordered key columns, include columns, filter and row count, to spot covering gaps and redundant or overlapping indexes.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none (metadata visibility on the table)
- Params: `?1` = `'schema.table'`

Key and include lists use `FOR XML PATH` subqueries, not `STRING_AGG`, so the query runs on 2012+. Columnstore member columns appear in `include_columns`. Usage counts (seeks, scans, lookups, updates) are not here: they need VIEW SERVER STATE and belong to `sql-performance-monitor`.

```sql
SELECT TOP (1000)
    ROW_NUMBER() OVER (ORDER BY i.index_id) AS rn,
    OBJECT_SCHEMA_NAME(i.object_id) AS schema_name,
    OBJECT_NAME(i.object_id) AS table_name,
    i.index_id,
    i.name AS index_name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    i.is_unique_constraint,
    i.is_disabled,
    i.fill_factor,
    i.has_filter,
    i.filter_definition,
    STUFF((SELECT N', ' + QUOTENAME(c.name) + CASE WHEN ic.is_descending_key = 1 THEN N' DESC' ELSE N'' END
           FROM sys.index_columns AS ic
           JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
           WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
             AND ic.key_ordinal > 0
           ORDER BY ic.key_ordinal
           FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'') AS key_columns,
    STUFF((SELECT N', ' + QUOTENAME(c.name)
           FROM sys.index_columns AS ic
           JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
           WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
             AND ic.key_ordinal = 0
             AND (ic.is_included_column = 1 OR ic.partition_ordinal = 0)
           ORDER BY ic.index_column_id
           FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'') AS include_columns,
    (SELECT SUM(p.rows) FROM sys.partitions AS p
     WHERE p.object_id = i.object_id AND p.index_id = i.index_id) AS row_count,
    (SELECT COUNT(*) FROM sys.partitions AS p
     WHERE p.object_id = i.object_id AND p.index_id = i.index_id) AS partition_count
FROM sys.indexes AS i
WHERE i.object_id = OBJECT_ID(?)
ORDER BY i.index_id
```

### tuning.query-store-state
- Purpose: Tell "Query Store is off or read-only" apart from "no variance found" before trusting `tuning.query-store-variance`.
- Requires: SQL Server 2016+
- Azure SQL DB: same
- Permission: VIEW DATABASE STATE
- Params: none

```sql
SELECT
    DB_NAME() AS database_name,
    o.actual_state_desc,
    o.desired_state_desc,
    o.readonly_reason,
    o.query_capture_mode_desc,
    o.current_storage_size_mb,
    o.max_storage_size_mb,
    o.interval_length_minutes,
    o.stale_query_threshold_days
FROM sys.database_query_store_options AS o
```

### tuning.query-store-variance
- Purpose: Queries in the current database with more than one plan, or whose duration standard deviation exceeds their mean, over a recent window: candidates for parameter sensitivity or plan regression.
- Requires: SQL Server 2016+
- Azure SQL DB: same
- Permission: VIEW DATABASE STATE
- Params: `?1` = hours of history to scan, such as `24`

Ranked by the gap between the slowest and fastest plan, then by the highest per-interval standard deviation. Durations are in milliseconds. `forced_plans` > 0 means a plan is already forced. Requires `actual_state_desc` = `READ_WRITE` or `READ_ONLY` in `tuning.query-store-state`.

```sql
SELECT TOP (20)
    ROW_NUMBER() OVER (ORDER BY qv.worst_plan_avg_ms - qv.best_plan_avg_ms DESC, qv.max_stdev_duration_ms DESC) AS rn,
    qv.query_id,
    OBJECT_SCHEMA_NAME(q.object_id) + N'.' + OBJECT_NAME(q.object_id) AS object_name,
    qv.plan_count,
    qv.forced_plans,
    qv.executions,
    CAST(qv.avg_duration_ms AS decimal(18, 2)) AS avg_duration_ms,
    CAST(qv.best_plan_avg_ms AS decimal(18, 2)) AS best_plan_avg_ms,
    CAST(qv.worst_plan_avg_ms AS decimal(18, 2)) AS worst_plan_avg_ms,
    CAST(qv.max_stdev_duration_ms AS decimal(18, 2)) AS max_stdev_duration_ms,
    CAST(qv.max_duration_ms AS decimal(18, 2)) AS max_duration_ms,
    CAST(SWITCHOFFSET(qv.last_execution_time, '+00:00') AS datetime2(3)) AS last_execution_time_utc,
    LEFT(qt.query_sql_text, 4000) AS query_text
FROM (
    SELECT
        pp.query_id,
        COUNT(*) AS plan_count,
        SUM(pp.is_forced) AS forced_plans,
        SUM(pp.executions) AS executions,
        SUM(pp.avg_duration_us * pp.executions) / NULLIF(SUM(pp.executions), 0) / 1000.0 AS avg_duration_ms,
        MIN(pp.avg_duration_us) / 1000.0 AS best_plan_avg_ms,
        MAX(pp.avg_duration_us) / 1000.0 AS worst_plan_avg_ms,
        MAX(pp.max_stdev_duration_us) / 1000.0 AS max_stdev_duration_ms,
        MAX(pp.max_duration_us) / 1000.0 AS max_duration_ms,
        MAX(pp.last_execution_time) AS last_execution_time
    FROM (
        SELECT
            p.query_id,
            p.plan_id,
            MAX(CAST(p.is_forced_plan AS int)) AS is_forced,
            SUM(rs.count_executions) AS executions,
            SUM(rs.avg_duration * rs.count_executions) / NULLIF(SUM(rs.count_executions), 0) AS avg_duration_us,
            MAX(rs.stdev_duration) AS max_stdev_duration_us,
            MAX(rs.max_duration) AS max_duration_us,
            MAX(rs.last_execution_time) AS last_execution_time
        FROM sys.query_store_plan AS p
        JOIN sys.query_store_runtime_stats AS rs ON rs.plan_id = p.plan_id
        JOIN sys.query_store_runtime_stats_interval AS rsi
            ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
        WHERE rsi.start_time >= DATEADD(HOUR, -CAST(? AS int), SYSDATETIMEOFFSET())
        GROUP BY p.query_id, p.plan_id
    ) AS pp
    GROUP BY pp.query_id
) AS qv
JOIN sys.query_store_query AS q ON q.query_id = qv.query_id
JOIN sys.query_store_query_text AS qt ON qt.query_text_id = q.query_text_id
WHERE (qv.plan_count > 1 OR qv.max_stdev_duration_ms > qv.avg_duration_ms)
  AND qt.query_sql_text NOT LIKE N'%[_]limited[_]query%'
ORDER BY qv.worst_plan_avg_ms - qv.best_plan_avg_ms DESC, qv.max_stdev_duration_ms DESC
```

## Plan XML cues

Use these when the caller supplies a `.sqlplan` file (Grep it for the attribute name) or when `tuning.plan-by-text` returns `statement_plan` (scan the text). Showplan XML is one long line, so Grep with `-o` and a short context pattern, such as `SpillToTempDb[^>]*`, rather than whole-line output. Attributes marked "actual only" exist only in an actual plan (SSMS "Include Actual Execution Plan" or `SET STATISTICS XML ON`; cached and Query Store plans are estimated); when the caller sent an estimated plan, ask for the actual plan under "Questions for the caller".

| Cue | Where it appears | What it tells you |
|-----|------------------|-------------------|
| `Warnings` | Child of `StmtSimple/QueryPlan` or of a `RelOp` | Container for the warnings below; any `Warnings` element deserves a look. |
| `SpillToTempDb` | `RelOp/Warnings` (actual only) | A sort or hash ran out of granted memory and spilled. `SpillLevel` > 1 and `SortSpillDetails` / `HashSpillDetails` page counts show how bad. Fix the estimate or the grant, not the tempdb. |
| `PlanAffectingConvert` | `QueryPlan/Warnings` | Implicit conversion. `ConvertIssue="Seek Plan"` means a seek was lost (non-SARGable); `"Cardinality Estimate"` means the estimate is affected. The `Expression` names the column. |
| `MissingIndexGroup` | `QueryPlan/MissingIndexes` | Optimizer index suggestion with `Impact` (%). Read the `ColumnGroup Usage="EQUALITY" / "INEQUALITY" / "INCLUDE"` children. Treat it as a hint: merge with existing indexes from `tuning.table-indexes` instead of creating it verbatim. |
| `MemoryGrantInfo` | `QueryPlan` | All values in KB. Estimated and cached plans carry only `SerialRequiredMemory` and `SerialDesiredMemory`. `RequestedMemory`, `GrantedMemory` and `MaxUsedMemory` are actual only. Granted far above used wastes memory and can cause `RESOURCE_SEMAPHORE` waits; used near granted with a spill means the grant was too small. Excessive or insufficient grants also raise `QueryPlan/Warnings/MemoryGrantWarning`, whose `WarningKind` names the problem. |
| `ParameterCompiledValue` vs `ParameterRuntimeValue` | `QueryPlan/ParameterList/ColumnReference` | Compiled value differs from the runtime value (actual only) and the row estimates are far off: parameter sensitivity (sniffing). Confirm with `tuning.query-store-variance`. |
| `EstimateRows` vs `ActualRows` | `RelOp` attribute vs `RunTimeInformation/RunTimeCountersPerThread` (actual only) | Cardinality misestimate. Sum `ActualRows` across threads. On the inner side of a nested loop, compare with `EstimateRows` x (`EstimateRebinds` + `EstimateRewinds` + 1). A 10x or larger gap at the first operator where it appears is the root to chase (stale stats, predicates on expressions, table variables, multi-statement TVFs). |
| `NoJoinPredicate` | `RelOp/Warnings` | A join has no predicate: an accidental Cartesian product, usually a missing `ON` condition. |

Also worth a Grep:

- `StatementOptmEarlyAbortReason="TimeOut"`: the optimizer stopped early; simplify the query.
- `NonParallelPlanReason`: why the plan is serial (for example a scalar UDF or a table variable modification).
- `CardinalityEstimationModelVersion`: 70 = legacy estimator; 120 and above = the new one, tied to the compat level.
- `ColumnsWithNoStatistics` and `UnmatchedIndexes` in `Warnings`: missing statistics, or a filtered index the plan could not use because of parameterization.
