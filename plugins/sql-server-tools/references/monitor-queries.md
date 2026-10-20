# Monitor Query Pack

Vetted read-only queries for `sql-performance-monitor`. Every query obeys the MCP Query Rules in `protocol.md`; run it with `mcp__mcp-sql-server__execute_query` exactly as written. Gate each block on its `Requires:`, `Azure SQL DB:` and `Permission:` lines as Environment Detection describes. Queries that return a `rn` column are ranked: present their rows sorted by `rn`.

## Contents

- Server and CPU: [monitor.server-info](#monitorserver-info), [monitor.server-info-azure](#monitorserver-info-azure), [monitor.schedulers](#monitorschedulers), [monitor.cpu-history](#monitorcpu-history), [monitor.cpu-history-azure](#monitorcpu-history-azure)
- Waits: [monitor.waits-snapshot](#monitorwaits-snapshot), [monitor.waits-snapshot-azure](#monitorwaits-snapshot-azure)
- Queries: [monitor.top-queries](#monitortop-queries)
- Blocking and deadlocks: [monitor.blocking](#monitorblocking), [monitor.deadlocks](#monitordeadlocks)
- Memory: [monitor.memory](#monitormemory), [monitor.memory-clerks](#monitormemory-clerks)
- I/O and TempDB: [monitor.io-latency-snapshot](#monitorio-latency-snapshot), [monitor.io-latency-snapshot-azure](#monitorio-latency-snapshot-azure), [monitor.tempdb](#monitortempdb)
- Indexes: [monitor.index-usage](#monitorindex-usage), [monitor.missing-indexes](#monitormissing-indexes)
- Query Store: [monitor.query-store-state](#monitorquery-store-state), [monitor.query-store-plans](#monitorquery-store-plans)
- Configuration: [monitor.config](#monitorconfig), [monitor.db-scoped-config](#monitordb-scoped-config)

## Using this pack

- Snapshot queries (`*-snapshot`) return cumulative counters plus `sampled_at`. Take two samples at least 30 seconds apart and compare them (see the agent's Sampling Rule). They return every qualifying row so that rows hot only now survive until the delta is computed.
- On Azure SQL Database Basic, S0 and S1 and on elastic pools, the DMV queries marked `same` or with an `-azure` variant need the server admin or membership in `##MS_ServerStateReader##`, not just VIEW DATABASE STATE.
- Binary columns (hashes) are returned as `0x…` strings and Query Store times as UTC `datetime2`, because the MCP server cannot serialize binary, `datetimeoffset` or `sql_variant` values.

## Server and CPU

### monitor.server-info
- Purpose: Uptime (start of the DMV observation window), CPU count and physical memory for the report header.
- Requires: SQL Server 2012+
- Azure SQL DB: variant `monitor.server-info-azure`
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT
    i.sqlserver_start_time,
    DATEDIFF(MINUTE, i.sqlserver_start_time, SYSDATETIME()) AS uptime_minutes,
    i.cpu_count,
    i.hyperthread_ratio,
    i.physical_memory_kb / 1024 AS physical_memory_mb,
    i.committed_kb / 1024 AS committed_mb,
    i.committed_target_kb / 1024 AS committed_target_mb,
    i.max_workers_count,
    SYSDATETIME() AS sampled_at
FROM sys.dm_os_sys_info AS i
```

### monitor.server-info-azure
- Purpose: Uptime, service objective and vCore limit of an Azure SQL Database. Physical memory is set by the service objective: report it as N/A.
- Requires: Azure SQL Database (engine_edition 5)
- Azure SQL DB: only (variant of `monitor.server-info`)
- Permission: VIEW DATABASE STATE
- Params: none

```sql
SELECT
    i.sqlserver_start_time,
    DATEDIFF(MINUTE, i.sqlserver_start_time, SYSDATETIME()) AS uptime_minutes,
    CAST(DATABASEPROPERTYEX(DB_NAME(), 'Edition') AS nvarchar(128)) AS service_tier,
    CAST(DATABASEPROPERTYEX(DB_NAME(), 'ServiceObjective') AS nvarchar(128)) AS service_objective,
    g.slo_name,
    g.cpu_limit AS vcore_limit,
    SYSDATETIME() AS sampled_at
FROM sys.dm_os_sys_info AS i
CROSS JOIN sys.dm_user_db_resource_governance AS g
WHERE g.database_id = DB_ID()
```

### monitor.schedulers
- Purpose: CPU pressure (runnable tasks per scheduler) and worker exhaustion (tasks queued for a worker, the THREADPOOL symptom).
- Requires: SQL Server 2012+
- Azure SQL DB: N/A (use `monitor.cpu-history-azure`)
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT
    COUNT(*) AS online_schedulers,
    SUM(s.current_tasks_count) AS current_tasks,
    SUM(s.runnable_tasks_count) AS runnable_tasks,
    MAX(s.runnable_tasks_count) AS max_runnable_per_scheduler,
    SUM(s.current_workers_count) AS current_workers,
    SUM(s.active_workers_count) AS active_workers,
    SUM(s.work_queue_count) AS tasks_waiting_for_worker,
    SUM(CAST(s.pending_disk_io_count AS bigint)) AS pending_disk_io,
    (SELECT i.max_workers_count FROM sys.dm_os_sys_info AS i) AS max_workers,
    SYSDATETIME() AS sampled_at
FROM sys.dm_os_schedulers AS s
WHERE s.status = N'VISIBLE ONLINE'
```

### monitor.cpu-history
- Purpose: CPU use per minute from the scheduler-monitor ring buffer (about the last 256 minutes): SQL Server, idle and other processes.
- Requires: SQL Server 2012+
- Azure SQL DB: variant `monitor.cpu-history-azure`
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT TOP (256)
    ROW_NUMBER() OVER (ORDER BY r.record_id DESC) AS rn,
    DATEADD(MILLISECOND, -1 * CAST(i.ms_ticks - r.rb_timestamp AS int), SYSDATETIME()) AS event_time,
    r.sql_cpu_pct,
    r.system_idle_pct,
    100 - r.system_idle_pct - r.sql_cpu_pct AS other_process_cpu_pct
FROM (
    SELECT
        rb.[timestamp] AS rb_timestamp,
        x.rec.value('(./Record/@id)[1]', 'int') AS record_id,
        x.rec.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS system_idle_pct,
        x.rec.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu_pct
    FROM sys.dm_os_ring_buffers AS rb
    CROSS APPLY (SELECT CAST(rb.record AS xml) AS rec) AS x
    WHERE rb.ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
      AND rb.record LIKE N'%<SystemHealth>%'
) AS r
CROSS JOIN sys.dm_os_sys_info AS i
ORDER BY rn
```

### monitor.cpu-history-azure
- Purpose: CPU, data I/O, log write, memory and worker use as a percentage of the service objective limits, every 15 seconds for about the last hour.
- Requires: Azure SQL Database (engine_edition 5)
- Azure SQL DB: only (variant of `monitor.cpu-history`)
- Permission: VIEW DATABASE STATE
- Params: none

```sql
SELECT TOP (240)
    ROW_NUMBER() OVER (ORDER BY rs.end_time DESC) AS rn,
    rs.end_time,
    rs.avg_cpu_percent,
    rs.avg_data_io_percent,
    rs.avg_log_write_percent,
    rs.avg_memory_usage_percent,
    rs.max_worker_percent,
    rs.max_session_percent
FROM sys.dm_db_resource_stats AS rs
ORDER BY rn
```

## Waits

### monitor.waits-snapshot
- Purpose: All non-benign waits with waiting_tasks_count > 0, cumulative since restart (benign list: Paul Randal's SQLskills list through SQL Server 2022, plus `CXCONSUMER`). Run twice and rank by the delta.
- Requires: SQL Server 2012+
- Azure SQL DB: variant `monitor.waits-snapshot-azure`
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT TOP (2000)
    ROW_NUMBER() OVER (ORDER BY ws.wait_time_ms DESC) AS rn,
    ws.wait_type,
    ws.waiting_tasks_count,
    ws.wait_time_ms,
    ws.signal_wait_time_ms,
    ws.wait_time_ms - ws.signal_wait_time_ms AS resource_wait_time_ms,
    CAST(100.0 * ws.wait_time_ms / NULLIF(SUM(ws.wait_time_ms) OVER (), 0) AS decimal(5, 2)) AS pct_of_total,
    CAST(1.0 * ws.wait_time_ms / NULLIF(ws.waiting_tasks_count, 0) AS decimal(18, 2)) AS avg_wait_ms,
    i.sqlserver_start_time,
    SYSDATETIME() AS sampled_at
FROM sys.dm_os_wait_stats AS ws
CROSS JOIN sys.dm_os_sys_info AS i
WHERE ws.waiting_tasks_count > 0
  AND ws.wait_type NOT LIKE N'%SERVER[_]DIAGNOSTICS%'
  AND ws.wait_type NOT IN (
    N'BROKER_EVENTHANDLER', N'BROKER_RECEIVE_WAITFOR', N'BROKER_TASK_STOP', N'BROKER_TO_FLUSH',
    N'BROKER_TRANSMITTER', N'CHECKPOINT_QUEUE', N'CHKPT', N'CLR_AUTO_EVENT', N'CLR_MANUAL_EVENT',
    N'CLR_SEMAPHORE', N'CXCONSUMER', N'DBMIRROR_DBM_EVENT', N'DBMIRROR_EVENTS_QUEUE',
    N'DBMIRROR_WORKER_QUEUE', N'DBMIRRORING_CMD', N'DIRTY_PAGE_POLL', N'DISPATCHER_QUEUE_SEMAPHORE',
    N'EXECSYNC', N'FSAGENT', N'FT_IFTS_SCHEDULER_IDLE_WAIT', N'FT_IFTSHC_MUTEX', N'HADR_CLUSAPI_CALL',
    N'HADR_FILESTREAM_IOMGR_IOCOMPLETION', N'HADR_LOGCAPTURE_WAIT', N'HADR_NOTIFICATION_DEQUEUE',
    N'HADR_TIMER_TASK', N'HADR_WORK_QUEUE', N'KSOURCE_WAKEUP', N'LAZYWRITER_SLEEP', N'LOGMGR_QUEUE',
    N'MEMORY_ALLOCATION_EXT', N'ONDEMAND_TASK_QUEUE', N'PARALLEL_REDO_DRAIN_WORKER',
    N'PARALLEL_REDO_LOG_CACHE', N'PARALLEL_REDO_TRAN_LIST', N'PARALLEL_REDO_WORKER_SYNC',
    N'PARALLEL_REDO_WORKER_WAIT_WORK', N'PREEMPTIVE_HADR_LEASE_MECHANISM',
    N'PREEMPTIVE_OS_FLUSHFILEBUFFERS', N'PREEMPTIVE_XE_CALLBACKEXECUTE', N'PREEMPTIVE_XE_GETTARGETSTATE',
    N'PREEMPTIVE_XE_SESSIONCOMMIT', N'PREEMPTIVE_XE_TARGETFINALIZE', N'PREEMPTIVE_XE_TARGETINIT',
    N'PVS_PREALLOCATE', N'PWAIT_ALL_COMPONENTS_INITIALIZED', N'PWAIT_DIRECTLOGCONSUMER_GETNEXT',
    N'PWAIT_EXTENSIBILITY_CLEANUP_TASK', N'QDS_ASYNC_QUEUE',
    N'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP', N'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
    N'QDS_SHUTDOWN_QUEUE', N'REDO_THREAD_PENDING_WORK', N'REQUEST_FOR_DEADLOCK_SEARCH',
    N'RESOURCE_QUEUE', N'SERVER_IDLE_CHECK', N'SLEEP_BPOOL_FLUSH', N'SLEEP_DBSTARTUP',
    N'SLEEP_DCOMSTARTUP', N'SLEEP_MASTERDBREADY', N'SLEEP_MASTERMDREADY', N'SLEEP_MASTERUPGRADED',
    N'SLEEP_MSDBSTARTUP', N'SLEEP_SYSTEMTASK', N'SLEEP_TASK', N'SLEEP_TEMPDBSTARTUP',
    N'SNI_HTTP_ACCEPT', N'SOS_WORK_DISPATCHER', N'SQLTRACE_BUFFER_FLUSH',
    N'SQLTRACE_INCREMENTAL_FLUSH_SLEEP', N'SQLTRACE_WAIT_ENTRIES', N'UCS_SESSION_REGISTRATION',
    N'VDI_CLIENT_OTHER', N'WAIT_FOR_RESULTS', N'WAITFOR', N'WAITFOR_TASKSHUTDOWN',
    N'WAIT_XTP_CKPT_CLOSE', N'WAIT_XTP_HOST_WAIT', N'WAIT_XTP_OFFLINE_CKPT_NEW_LOG',
    N'WAIT_XTP_RECOVERY', N'XE_DISPATCHER_JOIN', N'XE_DISPATCHER_WAIT', N'XE_LIVE_TARGET_TVF',
    N'XE_TIMER_EVENT')
ORDER BY rn
```

The `NOT LIKE N'%SERVER[_]DIAGNOSTICS%'` line excludes the two diagnostics waits whose names contain a token the server rejects (protocol rule 3).

### monitor.waits-snapshot-azure
- Purpose: All non-benign waits with waiting_tasks_count > 0 for the current Azure SQL Database, same exclusions as `monitor.waits-snapshot`. Cumulative since the last failover or scale operation (time unknown): run twice and rank by the delta.
- Requires: Azure SQL Database (engine_edition 5)
- Azure SQL DB: only (variant of `monitor.waits-snapshot`)
- Permission: VIEW DATABASE STATE
- Params: none

```sql
SELECT TOP (2000)
    ROW_NUMBER() OVER (ORDER BY ws.wait_time_ms DESC) AS rn,
    ws.wait_type,
    ws.waiting_tasks_count,
    ws.wait_time_ms,
    ws.signal_wait_time_ms,
    ws.wait_time_ms - ws.signal_wait_time_ms AS resource_wait_time_ms,
    CAST(100.0 * ws.wait_time_ms / NULLIF(SUM(ws.wait_time_ms) OVER (), 0) AS decimal(5, 2)) AS pct_of_total,
    CAST(1.0 * ws.wait_time_ms / NULLIF(ws.waiting_tasks_count, 0) AS decimal(18, 2)) AS avg_wait_ms,
    SYSDATETIME() AS sampled_at
FROM sys.dm_db_wait_stats AS ws
WHERE ws.waiting_tasks_count > 0
  AND ws.wait_type NOT LIKE N'%SERVER[_]DIAGNOSTICS%'
  AND ws.wait_type NOT IN (
    N'BROKER_EVENTHANDLER', N'BROKER_RECEIVE_WAITFOR', N'BROKER_TASK_STOP', N'BROKER_TO_FLUSH',
    N'BROKER_TRANSMITTER', N'CHECKPOINT_QUEUE', N'CHKPT', N'CLR_AUTO_EVENT', N'CLR_MANUAL_EVENT',
    N'CLR_SEMAPHORE', N'CXCONSUMER', N'DBMIRROR_DBM_EVENT', N'DBMIRROR_EVENTS_QUEUE',
    N'DBMIRROR_WORKER_QUEUE', N'DBMIRRORING_CMD', N'DIRTY_PAGE_POLL', N'DISPATCHER_QUEUE_SEMAPHORE',
    N'EXECSYNC', N'FSAGENT', N'FT_IFTS_SCHEDULER_IDLE_WAIT', N'FT_IFTSHC_MUTEX', N'HADR_CLUSAPI_CALL',
    N'HADR_FILESTREAM_IOMGR_IOCOMPLETION', N'HADR_LOGCAPTURE_WAIT', N'HADR_NOTIFICATION_DEQUEUE',
    N'HADR_TIMER_TASK', N'HADR_WORK_QUEUE', N'KSOURCE_WAKEUP', N'LAZYWRITER_SLEEP', N'LOGMGR_QUEUE',
    N'MEMORY_ALLOCATION_EXT', N'ONDEMAND_TASK_QUEUE', N'PARALLEL_REDO_DRAIN_WORKER',
    N'PARALLEL_REDO_LOG_CACHE', N'PARALLEL_REDO_TRAN_LIST', N'PARALLEL_REDO_WORKER_SYNC',
    N'PARALLEL_REDO_WORKER_WAIT_WORK', N'PREEMPTIVE_HADR_LEASE_MECHANISM',
    N'PREEMPTIVE_OS_FLUSHFILEBUFFERS', N'PREEMPTIVE_XE_CALLBACKEXECUTE', N'PREEMPTIVE_XE_GETTARGETSTATE',
    N'PREEMPTIVE_XE_SESSIONCOMMIT', N'PREEMPTIVE_XE_TARGETFINALIZE', N'PREEMPTIVE_XE_TARGETINIT',
    N'PVS_PREALLOCATE', N'PWAIT_ALL_COMPONENTS_INITIALIZED', N'PWAIT_DIRECTLOGCONSUMER_GETNEXT',
    N'PWAIT_EXTENSIBILITY_CLEANUP_TASK', N'QDS_ASYNC_QUEUE',
    N'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP', N'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
    N'QDS_SHUTDOWN_QUEUE', N'REDO_THREAD_PENDING_WORK', N'REQUEST_FOR_DEADLOCK_SEARCH',
    N'RESOURCE_QUEUE', N'SERVER_IDLE_CHECK', N'SLEEP_BPOOL_FLUSH', N'SLEEP_DBSTARTUP',
    N'SLEEP_DCOMSTARTUP', N'SLEEP_MASTERDBREADY', N'SLEEP_MASTERMDREADY', N'SLEEP_MASTERUPGRADED',
    N'SLEEP_MSDBSTARTUP', N'SLEEP_SYSTEMTASK', N'SLEEP_TASK', N'SLEEP_TEMPDBSTARTUP',
    N'SNI_HTTP_ACCEPT', N'SOS_WORK_DISPATCHER', N'SQLTRACE_BUFFER_FLUSH',
    N'SQLTRACE_INCREMENTAL_FLUSH_SLEEP', N'SQLTRACE_WAIT_ENTRIES', N'UCS_SESSION_REGISTRATION',
    N'VDI_CLIENT_OTHER', N'WAIT_FOR_RESULTS', N'WAITFOR', N'WAITFOR_TASKSHUTDOWN',
    N'WAIT_XTP_CKPT_CLOSE', N'WAIT_XTP_HOST_WAIT', N'WAIT_XTP_OFFLINE_CKPT_NEW_LOG',
    N'WAIT_XTP_RECOVERY', N'XE_DISPATCHER_JOIN', N'XE_DISPATCHER_WAIT', N'XE_LIVE_TARGET_TVF',
    N'XE_TIMER_EVENT')
ORDER BY rn
```

## Queries

### monitor.top-queries
- Purpose: Top 20 cached statements by total CPU. Times are converted from microseconds to milliseconds. `max_elapsed_ms` far above `avg_elapsed_ms` hints at parameter sensitivity. To rank by duration or reads, replace `total_worker_time` in both `ORDER BY` clauses with `total_elapsed_time` or `total_logical_reads`.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: VIEW SERVER STATE (Azure SQL DB: VIEW DATABASE STATE)
- Params: none

```sql
SELECT TOP (20)
    q.rn,
    DB_NAME(st.dbid) AS database_name,
    q.execution_count,
    q.total_cpu_ms,
    q.avg_cpu_ms,
    q.total_elapsed_ms,
    q.avg_elapsed_ms,
    q.max_elapsed_ms,
    q.total_logical_reads,
    q.avg_logical_reads,
    q.creation_time,
    q.last_execution_time,
    CONVERT(varchar(18), q.query_hash, 1) AS query_hash,
    CONVERT(varchar(18), q.query_plan_hash, 1) AS query_plan_hash,
    SUBSTRING(st.text, q.statement_start_offset / 2 + 1,
        (CASE WHEN q.statement_end_offset = -1 THEN DATALENGTH(st.text)
              ELSE q.statement_end_offset END - q.statement_start_offset) / 2 + 1) AS statement_text
FROM (
    SELECT TOP (20)
        ROW_NUMBER() OVER (ORDER BY qs.total_worker_time DESC) AS rn,
        qs.sql_handle,
        qs.statement_start_offset,
        qs.statement_end_offset,
        qs.execution_count,
        qs.total_worker_time / 1000.0 AS total_cpu_ms,
        qs.total_worker_time / 1000.0 / NULLIF(qs.execution_count, 0) AS avg_cpu_ms,
        qs.total_elapsed_time / 1000.0 AS total_elapsed_ms,
        qs.total_elapsed_time / 1000.0 / NULLIF(qs.execution_count, 0) AS avg_elapsed_ms,
        qs.max_elapsed_time / 1000.0 AS max_elapsed_ms,
        qs.total_logical_reads,
        qs.total_logical_reads / NULLIF(qs.execution_count, 0) AS avg_logical_reads,
        qs.creation_time,
        qs.last_execution_time,
        qs.query_hash,
        qs.query_plan_hash
    FROM sys.dm_exec_query_stats AS qs
    ORDER BY qs.total_worker_time DESC
) AS q
CROSS APPLY sys.dm_exec_sql_text(q.sql_handle) AS st
ORDER BY q.rn
```

## Blocking and Deadlocks

### monitor.blocking
- Purpose: Every session that is blocked or blocks another, flat (no recursion). Root blockers have `is_root_blocker = 1`: they block others and are not blocked themselves. Idle blockers with an open transaction show `request_status` NULL and their last statement.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: VIEW SERVER STATE (Azure SQL DB: VIEW DATABASE STATE)
- Params: none

```sql
SELECT TOP (100)
    ROW_NUMBER() OVER (ORDER BY CASE WHEN b.blocking_session_id = 0 THEN 0 ELSE 1 END,
                                b.blocked_count DESC, b.wait_time_ms DESC) AS rn,
    b.session_id,
    b.blocking_session_id,
    CASE WHEN b.blocking_session_id = 0 AND b.blocked_count > 0 THEN 1 ELSE 0 END AS is_root_blocker,
    b.blocked_count,
    b.wait_type,
    b.wait_time_ms,
    b.wait_resource,
    b.request_status,
    b.session_status,
    b.open_transaction_count,
    b.database_name,
    b.login_name,
    b.host_name,
    b.program_name,
    b.last_request_end_time,
    b.sql_text,
    SYSDATETIME() AS sampled_at
FROM (
    SELECT
        s.session_id,
        COALESCE(r.blocking_session_id, 0) AS blocking_session_id,
        (SELECT COUNT(*) FROM sys.dm_exec_requests AS r2
         WHERE r2.blocking_session_id = s.session_id AND r2.session_id <> s.session_id) AS blocked_count,
        r.wait_type,
        r.wait_time AS wait_time_ms,
        r.wait_resource,
        r.status AS request_status,
        s.status AS session_status,
        s.open_transaction_count,
        DB_NAME(COALESCE(r.database_id, s.database_id)) AS database_name,
        s.login_name,
        s.host_name,
        s.program_name,
        s.last_request_end_time,
        LEFT(t.text, 4000) AS sql_text
    FROM sys.dm_exec_sessions AS s
    LEFT JOIN sys.dm_exec_requests AS r ON r.session_id = s.session_id
    LEFT JOIN sys.dm_exec_connections AS c ON c.session_id = s.session_id
    OUTER APPLY sys.dm_exec_sql_text(COALESCE(r.sql_handle, c.most_recent_sql_handle)) AS t
    WHERE (r.blocking_session_id <> 0 AND r.blocking_session_id <> r.session_id)
       OR EXISTS (SELECT 1 FROM sys.dm_exec_requests AS r3
                  WHERE r3.blocking_session_id = s.session_id AND r3.session_id <> s.session_id)
) AS b
ORDER BY rn
```

A negative `blocking_session_id` is not a session: -2 is an orphaned distributed transaction, -3 a deferred recovery transaction, -4 a latch owner that could not be identified.

### monitor.deadlocks
- Purpose: The 20 most recent deadlock graphs captured by the `system_health` Extended Events session (event files).
- Requires: SQL Server 2012+
- Azure SQL DB: N/A
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT TOP (20)
    ROW_NUMBER() OVER (ORDER BY d.deadlock_time_utc DESC) AS rn,
    d.deadlock_time_utc,
    d.deadlock_graph
FROM (
    SELECT
        e.ev.value('(event/@timestamp)[1]', 'datetime2') AS deadlock_time_utc,
        e.ev.query('(event/data/value/deadlock)[1]') AS deadlock_graph
    FROM sys.fn_xe_file_target_read_file(N'system_health*.xel', NULL, NULL, NULL) AS f
    CROSS APPLY (SELECT CAST(f.event_data AS xml) AS ev) AS e
    WHERE f.object_name = N'xml_deadlock_report'
) AS d
ORDER BY rn
```

## Memory

### monitor.memory
- Purpose: Page life expectancy per NUMA node (`Buffer Node`) and overall (`Buffer Manager`), server memory target vs total, and memory grants pending/outstanding.
- Requires: SQL Server 2012+
- Azure SQL DB: N/A (use `avg_memory_usage_percent` from `monitor.cpu-history-azure`)
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT TOP (100)
    ROW_NUMBER() OVER (ORDER BY pc.object_name, pc.counter_name, pc.instance_name) AS rn,
    RTRIM(pc.object_name) AS counter_object,
    RTRIM(pc.counter_name) AS counter_name,
    RTRIM(pc.instance_name) AS counter_instance,
    pc.cntr_value,
    SYSDATETIME() AS sampled_at
FROM sys.dm_os_performance_counters AS pc
WHERE ((pc.object_name LIKE N'%Buffer Node%' OR pc.object_name LIKE N'%Buffer Manager%')
       AND pc.counter_name = N'Page life expectancy')
   OR (pc.object_name LIKE N'%Memory Manager%'
       AND pc.counter_name IN (N'Total Server Memory (KB)', N'Target Server Memory (KB)',
                               N'Database Cache Memory (KB)', N'Stolen Server Memory (KB)',
                               N'Memory Grants Pending', N'Memory Grants Outstanding'))
ORDER BY rn
```

### monitor.memory-clerks
- Purpose: The 10 memory clerk types holding the most memory.
- Requires: SQL Server 2012+
- Azure SQL DB: N/A
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT TOP (10)
    ROW_NUMBER() OVER (ORDER BY SUM(mc.pages_kb) DESC) AS rn,
    mc.type AS clerk_type,
    SUM(mc.pages_kb) / 1024 AS pages_mb
FROM sys.dm_os_memory_clerks AS mc
GROUP BY mc.type
ORDER BY rn
```

## I/O and TempDB

### monitor.io-latency-snapshot
- Purpose: Cumulative I/O counts, bytes and stalls for every database file, with average latencies since restart. Run twice and compare for current latency.
- Requires: SQL Server 2012+
- Azure SQL DB: variant `monitor.io-latency-snapshot-azure`
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT TOP (5000)
    ROW_NUMBER() OVER (ORDER BY vfs.io_stall_read_ms + vfs.io_stall_write_ms DESC) AS rn,
    DB_NAME(vfs.database_id) AS database_name,
    vfs.file_id,
    mf.type_desc AS file_type,
    mf.physical_name,
    vfs.num_of_reads,
    vfs.num_of_bytes_read,
    vfs.io_stall_read_ms,
    vfs.num_of_writes,
    vfs.num_of_bytes_written,
    vfs.io_stall_write_ms,
    CAST(1.0 * vfs.io_stall_read_ms / NULLIF(vfs.num_of_reads, 0) AS decimal(18, 2)) AS avg_read_latency_ms,
    CAST(1.0 * vfs.io_stall_write_ms / NULLIF(vfs.num_of_writes, 0) AS decimal(18, 2)) AS avg_write_latency_ms,
    i.sqlserver_start_time,
    SYSDATETIME() AS sampled_at
FROM sys.dm_io_virtual_file_stats(NULL, NULL) AS vfs
JOIN sys.master_files AS mf ON mf.database_id = vfs.database_id AND mf.file_id = vfs.file_id
CROSS JOIN sys.dm_os_sys_info AS i
ORDER BY rn
```

### monitor.io-latency-snapshot-azure
- Purpose: Same as `monitor.io-latency-snapshot` for the files of the current Azure SQL Database.
- Requires: Azure SQL Database (engine_edition 5)
- Azure SQL DB: only (variant of `monitor.io-latency-snapshot`)
- Permission: VIEW DATABASE STATE
- Params: none

```sql
SELECT TOP (5000)
    ROW_NUMBER() OVER (ORDER BY vfs.io_stall_read_ms + vfs.io_stall_write_ms DESC) AS rn,
    DB_NAME() AS database_name,
    vfs.file_id,
    df.type_desc AS file_type,
    df.name AS logical_name,
    vfs.num_of_reads,
    vfs.num_of_bytes_read,
    vfs.io_stall_read_ms,
    vfs.num_of_writes,
    vfs.num_of_bytes_written,
    vfs.io_stall_write_ms,
    CAST(1.0 * vfs.io_stall_read_ms / NULLIF(vfs.num_of_reads, 0) AS decimal(18, 2)) AS avg_read_latency_ms,
    CAST(1.0 * vfs.io_stall_write_ms / NULLIF(vfs.num_of_writes, 0) AS decimal(18, 2)) AS avg_write_latency_ms,
    SYSDATETIME() AS sampled_at
FROM sys.dm_io_virtual_file_stats(DB_ID(), NULL) AS vfs
JOIN sys.database_files AS df ON df.file_id = vfs.file_id
ORDER BY rn
```

### monitor.tempdb
- Purpose: TempDB files (current size, growth, space by consumer), data file count vs CPU count, current PAGELATCH waiters on TempDB pages, and whether TempDB metadata is memory-optimized (NULL before SQL Server 2019).
- Requires: SQL Server 2012+
- Azure SQL DB: N/A
- Permission: VIEW SERVER STATE
- Params: none

```sql
SELECT TOP (100)
    ROW_NUMBER() OVER (ORDER BY df.file_id) AS rn,
    df.file_id,
    df.name AS logical_name,
    df.type_desc AS file_type,
    df.size / 128 AS size_mb,
    CASE WHEN df.is_percent_growth = 1 THEN CAST(df.growth AS varchar(20)) + ' pct'
         ELSE CAST(df.growth / 128 AS varchar(20)) + ' MB' END AS growth_setting,
    su.unallocated_extent_page_count / 128 AS free_mb,
    su.user_object_reserved_page_count / 128 AS user_objects_mb,
    su.internal_object_reserved_page_count / 128 AS internal_objects_mb,
    su.version_store_reserved_page_count / 128 AS version_store_mb,
    (SELECT COUNT(*) FROM tempdb.sys.database_files AS f2 WHERE f2.type = 0) AS data_file_count,
    i.cpu_count,
    (SELECT COUNT(*) FROM sys.dm_os_waiting_tasks AS wt
     WHERE wt.wait_type LIKE N'PAGELATCH[_]%' AND wt.resource_description LIKE N'2:%') AS tempdb_pagelatch_waiters,
    CAST(SERVERPROPERTY('IsTempdbMetadataMemoryOptimized') AS int) AS metadata_memory_optimized,
    SYSDATETIME() AS sampled_at
FROM tempdb.sys.database_files AS df
LEFT JOIN tempdb.sys.dm_db_file_space_usage AS su ON su.file_id = df.file_id
CROSS JOIN sys.dm_os_sys_info AS i
ORDER BY rn
```

## Indexes

### monitor.index-usage
- Purpose: Reads and writes per index of the current database, least-read first, with size, constraint flags, whether the leading key column is a foreign key column, and `sqlserver_start_time`, an upper bound on the usage window: stats can also reset later (see the agent's Index Caveats).
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: VIEW SERVER STATE (Azure SQL DB: VIEW DATABASE STATE)
- Params: none

```sql
SELECT TOP (200)
    ROW_NUMBER() OVER (ORDER BY COALESCE(us.user_seeks, 0) + COALESCE(us.user_scans, 0) + COALESCE(us.user_lookups, 0),
                                COALESCE(us.user_updates, 0) DESC) AS rn,
    OBJECT_SCHEMA_NAME(ix.object_id) AS schema_name,
    o.name AS table_name,
    ix.name AS index_name,
    ix.index_id,
    ix.type_desc AS index_type,
    ix.is_primary_key,
    ix.is_unique,
    ix.is_unique_constraint,
    CASE WHEN EXISTS (
        SELECT 1 FROM sys.index_columns AS ic
        JOIN sys.foreign_key_columns AS fkc
          ON fkc.parent_object_id = ic.object_id AND fkc.parent_column_id = ic.column_id
        WHERE ic.object_id = ix.object_id AND ic.index_id = ix.index_id AND ic.key_ordinal = 1)
        THEN 1 ELSE 0 END AS leads_with_fk_column,
    COALESCE(us.user_seeks, 0) AS user_seeks,
    COALESCE(us.user_scans, 0) AS user_scans,
    COALESCE(us.user_lookups, 0) AS user_lookups,
    COALESCE(us.user_updates, 0) AS user_updates,
    us.last_user_seek,
    us.last_user_scan,
    us.last_user_lookup,
    (SELECT SUM(ps.used_page_count) FROM sys.dm_db_partition_stats AS ps
     WHERE ps.object_id = ix.object_id AND ps.index_id = ix.index_id) / 128 AS size_mb,
    i.sqlserver_start_time,
    SYSDATETIME() AS sampled_at
FROM sys.indexes AS ix
JOIN sys.objects AS o ON o.object_id = ix.object_id
LEFT JOIN sys.dm_db_index_usage_stats AS us
  ON us.database_id = DB_ID() AND us.object_id = ix.object_id AND us.index_id = ix.index_id
CROSS JOIN sys.dm_os_sys_info AS i
WHERE o.type = 'U' AND o.is_ms_shipped = 0 AND ix.index_id > 0
ORDER BY rn
```

### monitor.missing-indexes
- Purpose: The 25 missing-index suggestions with the highest estimated benefit, server-wide. These are hints for index design, never index scripts.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: VIEW SERVER STATE (Azure SQL DB: VIEW DATABASE STATE)
- Params: none

```sql
SELECT TOP (25)
    ROW_NUMBER() OVER (ORDER BY gs.avg_total_user_cost * gs.avg_user_impact * (gs.user_seeks + gs.user_scans) DESC) AS rn,
    DB_NAME(d.database_id) AS database_name,
    d.statement AS table_name,
    d.equality_columns,
    d.inequality_columns,
    d.included_columns,
    gs.user_seeks,
    gs.user_scans,
    gs.avg_total_user_cost,
    gs.avg_user_impact,
    CAST(gs.avg_total_user_cost * gs.avg_user_impact * (gs.user_seeks + gs.user_scans) AS decimal(18, 2)) AS improvement_measure,
    gs.last_user_seek,
    i.sqlserver_start_time
FROM sys.dm_db_missing_index_details AS d
JOIN sys.dm_db_missing_index_groups AS g ON g.index_handle = d.index_handle
JOIN sys.dm_db_missing_index_group_stats AS gs ON gs.group_handle = g.index_group_handle
CROSS JOIN sys.dm_os_sys_info AS i
ORDER BY rn
```

## Query Store

### monitor.query-store-state
- Purpose: Query Store state, storage and capture settings for the current database. `actual_state_desc` different from `desired_state_desc` (often READ_ONLY) needs attention.
- Requires: SQL Server 2016+
- Azure SQL DB: same
- Permission: VIEW DATABASE STATE
- Params: none

```sql
SELECT
    DB_NAME() AS database_name,
    qso.desired_state_desc,
    qso.actual_state_desc,
    qso.readonly_reason,
    qso.current_storage_size_mb,
    qso.max_storage_size_mb,
    qso.query_capture_mode_desc,
    qso.size_based_cleanup_mode_desc,
    qso.stale_query_threshold_days,
    qso.interval_length_minutes,
    qso.flush_interval_seconds,
    SYSDATETIME() AS sampled_at
FROM sys.database_query_store_options AS qso
```

### monitor.query-store-plans
- Purpose: The 20 queries with the most distinct plans in Query Store, a parameter-sensitivity signal to read together with `max_elapsed_ms` vs `avg_elapsed_ms` from `monitor.top-queries`.
- Requires: SQL Server 2016+
- Azure SQL DB: same
- Permission: VIEW DATABASE STATE
- Params: none

```sql
SELECT TOP (20)
    ROW_NUMBER() OVER (ORDER BY pc.plan_count DESC, pc.query_id) AS rn,
    pc.query_id,
    CONVERT(varchar(18), q.query_hash, 1) AS query_hash,
    pc.plan_count,
    pc.forced_plan_count,
    CAST(SWITCHOFFSET(pc.last_execution_time, '+00:00') AS datetime2(3)) AS last_execution_time_utc,
    LEFT(qt.query_sql_text, 4000) AS query_sql_text
FROM (
    SELECT
        p.query_id,
        COUNT(*) AS plan_count,
        SUM(CAST(p.is_forced_plan AS int)) AS forced_plan_count,
        MAX(p.last_execution_time) AS last_execution_time
    FROM sys.query_store_plan AS p
    GROUP BY p.query_id
    HAVING COUNT(*) > 1
) AS pc
JOIN sys.query_store_query AS q ON q.query_id = pc.query_id
JOIN sys.query_store_query_text AS qt ON qt.query_text_id = q.query_text_id
ORDER BY rn
```

## Configuration

### monitor.config
- Purpose: Instance settings that drive parallelism, memory, ad hoc plan caching and blocking diagnostics. Values are cast to int because the server returns them as sql_variant.
- Requires: SQL Server 2012+
- Azure SQL DB: N/A
- Permission: none
- Params: none

```sql
SELECT TOP (20)
    ROW_NUMBER() OVER (ORDER BY c.name) AS rn,
    c.name AS config_name,
    CAST(c.value AS int) AS configured_value,
    CAST(c.value_in_use AS int) AS value_in_use,
    c.is_dynamic,
    c.is_advanced
FROM sys.configurations AS c
WHERE c.name IN (N'max degree of parallelism', N'cost threshold for parallelism',
                 N'max server memory (MB)', N'min server memory (MB)',
                 N'optimize for ad hoc workloads', N'blocked process threshold (s)',
                 N'max worker threads')
ORDER BY rn
```

### monitor.db-scoped-config
- Purpose: Database-scoped MAXDOP of the current database (0 = use the instance setting). On Azure SQL DB this is the only MAXDOP setting. The value is cast to int because the server returns it as sql_variant.
- Requires: SQL Server 2016+
- Azure SQL DB: same
- Permission: none
- Params: none

```sql
SELECT
    DB_NAME() AS database_name,
    dsc.name AS config_name,
    CAST(dsc.value AS int) AS configured_value,
    CAST(dsc.value_for_secondary AS int) AS value_for_secondary
FROM sys.database_scoped_configurations AS dsc
WHERE dsc.name = N'MAXDOP'
```
