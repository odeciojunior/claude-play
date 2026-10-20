# Schema Query Pack

Vetted catalog queries for `sql-schema-discovery`. Every block obeys the MCP Query Rules in `protocol.md`. Before running a block, compare its `Requires:` and `Azure SQL DB:` lines with the Environment Detection result and skip blocks the instance cannot run. Pass `Params:` values in the listed order; the SQL uses plain `?`. Sort results by the `rn` column when a block returns one.

## Contents

- Inventory: [schema.object-counts](#schemaobject-counts), [schema.tables](#schematables), [schema.doc-coverage](#schemadoc-coverage)
- Version-gated table flags: [schema.table-flags-2016](#schematable-flags-2016), [schema.graph-flags-2017](#schemagraph-flags-2017), [schema.ledger-2022](#schemaledger-2022)
- One table: [schema.columns](#schemacolumns), [schema.column-flags-2016](#schemacolumn-flags-2016), [schema.indexes](#schemaindexes), [schema.index-usage](#schemaindex-usage), [schema.foreign-keys](#schemaforeign-keys)
- Dependencies: [schema.depends-on-me](#schemadepends-on-me), [schema.i-depend-on](#schemai-depend-on)

## Inventory

### schema.object-counts
- Purpose: Count user objects by type (tables, views, procedures, functions, foreign keys, ...).
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none
- Params: none

```sql
SELECT
    o.type_desc AS object_type,
    COUNT(*) AS object_count
FROM sys.objects AS o
WHERE o.is_ms_shipped = 0
GROUP BY o.type_desc
```

### schema.tables
- Purpose: The 200 largest user tables by row count, with size, index count, heap flag, CDC flag and description. `total_tables` is the count before the cut. Row counts sum the heap or clustered partitions only, so partitioned tables are not double counted.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none
- Params: none

```sql
SELECT TOP (200)
    ROW_NUMBER() OVER (ORDER BY ISNULL(rc.row_count, 0) DESC, s.name, t.name) AS rn,
    COUNT(*) OVER () AS total_tables,
    s.name AS schema_name,
    t.name AS table_name,
    ISNULL(rc.row_count, 0) AS row_count,
    CAST(ISNULL(sz.total_pages, 0) * 8 / 1024.0 AS decimal(18, 2)) AS reserved_mb,
    (SELECT COUNT(*) FROM sys.indexes AS i WHERE i.object_id = t.object_id AND i.index_id > 0) AS index_count,
    CASE WHEN EXISTS (SELECT 1 FROM sys.indexes AS h WHERE h.object_id = t.object_id AND h.index_id = 0) THEN 1 ELSE 0 END AS is_heap,
    t.is_tracked_by_cdc,
    t.is_filetable,
    t.create_date,
    t.modify_date,
    CAST(ep.value AS nvarchar(4000)) AS ms_description
FROM sys.tables AS t
INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
LEFT JOIN (
    SELECT p.object_id, SUM(p.rows) AS row_count
    FROM sys.partitions AS p
    WHERE p.index_id IN (0, 1)
    GROUP BY p.object_id
) AS rc ON rc.object_id = t.object_id
LEFT JOIN (
    SELECT p.object_id, SUM(au.total_pages) AS total_pages
    FROM sys.partitions AS p
    INNER JOIN sys.allocation_units AS au ON au.container_id = p.partition_id
    GROUP BY p.object_id
) AS sz ON sz.object_id = t.object_id
LEFT JOIN sys.extended_properties AS ep
    ON ep.class = 1 AND ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
WHERE t.is_ms_shipped = 0
ORDER BY rn
```

### schema.doc-coverage
- Purpose: How many user tables and their columns carry an `MS_Description` extended property.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none
- Params: none

```sql
SELECT
    (SELECT COUNT(*) FROM sys.tables AS t WHERE t.is_ms_shipped = 0) AS table_count,
    (SELECT COUNT(*) FROM sys.tables AS t
        WHERE t.is_ms_shipped = 0
          AND EXISTS (SELECT 1 FROM sys.extended_properties AS ep
                      WHERE ep.class = 1 AND ep.major_id = t.object_id AND ep.minor_id = 0
                        AND ep.name = 'MS_Description')) AS documented_tables,
    (SELECT COUNT(*) FROM sys.columns AS c
        INNER JOIN sys.tables AS t ON t.object_id = c.object_id
        WHERE t.is_ms_shipped = 0) AS column_count,
    (SELECT COUNT(*) FROM sys.columns AS c
        INNER JOIN sys.tables AS t ON t.object_id = c.object_id
        WHERE t.is_ms_shipped = 0
          AND EXISTS (SELECT 1 FROM sys.extended_properties AS ep
                      WHERE ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id
                        AND ep.name = 'MS_Description')) AS documented_columns
```

## Version-Gated Table Flags

These columns do not exist on older versions, so they live outside `schema.tables` to keep that query compiling on 2012.

### schema.table-flags-2016
- Purpose: System-versioned (temporal) tables and their history tables, memory-optimized tables with durability, and external tables. Returns only tables that have one of these traits.
- Requires: SQL Server 2016+
- Azure SQL DB: same
- Permission: none
- Params: none

```sql
SELECT
    SCHEMA_NAME(t.schema_id) AS schema_name,
    t.name AS table_name,
    t.temporal_type_desc,
    t.history_table_id,
    OBJECT_SCHEMA_NAME(t.history_table_id) + '.' + OBJECT_NAME(t.history_table_id) AS history_table,
    t.is_memory_optimized,
    t.durability_desc,
    t.is_external
FROM sys.tables AS t
WHERE t.is_ms_shipped = 0
  AND (t.temporal_type <> 0 OR t.is_memory_optimized = 1 OR t.is_external = 1)
```

### schema.graph-flags-2017
- Purpose: Graph NODE and EDGE tables.
- Requires: SQL Server 2017+
- Azure SQL DB: same
- Permission: none
- Params: none

```sql
SELECT
    SCHEMA_NAME(t.schema_id) AS schema_name,
    t.name AS table_name,
    t.is_node,
    t.is_edge
FROM sys.tables AS t
WHERE t.is_ms_shipped = 0
  AND (t.is_node = 1 OR t.is_edge = 1)
```

### schema.ledger-2022
- Purpose: Ledger tables (updatable or append-only), their ledger views and dropped ledger tables.
- Requires: SQL Server 2022+
- Azure SQL DB: same
- Permission: none
- Params: none

```sql
SELECT
    SCHEMA_NAME(t.schema_id) AS schema_name,
    t.name AS table_name,
    t.ledger_type_desc,
    t.is_dropped_ledger_table,
    OBJECT_SCHEMA_NAME(t.ledger_view_id) + '.' + OBJECT_NAME(t.ledger_view_id) AS ledger_view
FROM sys.tables AS t
WHERE t.is_ms_shipped = 0
  AND t.ledger_type <> 0
```

## One Table

### schema.columns
- Purpose: Column definitions of one table or view: type with display length (`nchar`/`nvarchar` halved, `max` for -1), nullability, identity, computed and default definitions, sparse flag, collation and `MS_Description`.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none
- Params: `?1` = `'schema.table'`

```sql
SELECT TOP (1024)
    ROW_NUMBER() OVER (ORDER BY c.column_id) AS rn,
    c.column_id,
    c.name AS column_name,
    ty.name AS declared_type,
    TYPE_NAME(c.system_type_id) AS base_type,
    CASE
        WHEN TYPE_NAME(c.system_type_id) IN ('char', 'varchar', 'binary', 'varbinary', 'nchar', 'nvarchar') THEN
            CASE
                WHEN c.max_length = -1 THEN 'max'
                WHEN TYPE_NAME(c.system_type_id) IN ('nchar', 'nvarchar') THEN CAST(c.max_length / 2 AS varchar(10))
                ELSE CAST(c.max_length AS varchar(10))
            END
        WHEN TYPE_NAME(c.system_type_id) IN ('decimal', 'numeric') THEN
            CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10))
        WHEN TYPE_NAME(c.system_type_id) IN ('datetime2', 'time', 'datetimeoffset') THEN CAST(c.scale AS varchar(10))
        ELSE ''
    END AS display_length,
    c.is_nullable,
    c.is_identity,
    CAST(idc.seed_value AS nvarchar(100)) AS identity_seed,
    CAST(idc.increment_value AS nvarchar(100)) AS identity_increment,
    c.is_computed,
    cc.definition AS computed_definition,
    cc.is_persisted AS computed_is_persisted,
    dc.name AS default_name,
    dc.definition AS default_definition,
    c.is_sparse,
    c.collation_name,
    CAST(ep.value AS nvarchar(4000)) AS ms_description
FROM sys.columns AS c
INNER JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.identity_columns AS idc ON idc.object_id = c.object_id AND idc.column_id = c.column_id
LEFT JOIN sys.computed_columns AS cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
LEFT JOIN sys.default_constraints AS dc ON dc.object_id = c.default_object_id
LEFT JOIN sys.extended_properties AS ep
    ON ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID(?)
ORDER BY rn
```

### schema.column-flags-2016
- Purpose: Columns of one table with temporal period (`GENERATED ALWAYS`), hidden, masked or Always Encrypted settings. Returns only flagged columns.
- Requires: SQL Server 2016+
- Azure SQL DB: same
- Permission: none
- Params: `?1` = `'schema.table'`

```sql
SELECT TOP (1024)
    ROW_NUMBER() OVER (ORDER BY c.column_id) AS rn,
    c.column_id,
    c.name AS column_name,
    c.generated_always_type_desc,
    c.is_hidden,
    c.is_masked,
    c.encryption_type_desc
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(?)
  AND (c.generated_always_type <> 0 OR c.is_hidden = 1 OR c.is_masked = 1 OR c.encryption_type IS NOT NULL)
ORDER BY rn
```

### schema.indexes
- Purpose: Index definitions of one table: type, uniqueness, constraint role, key columns in key order (with DESC), included columns, filter and fill factor.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none
- Params: `?1` = `'schema.table'`

```sql
SELECT TOP (2000)
    ROW_NUMBER() OVER (ORDER BY i.index_id) AS rn,
    i.index_id,
    i.name AS index_name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    i.is_unique_constraint,
    i.is_disabled,
    i.has_filter,
    i.filter_definition,
    i.fill_factor,
    STUFF((
        SELECT ', ' + QUOTENAME(kc.name) + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END
        FROM sys.index_columns AS ic
        INNER JOIN sys.columns AS kc ON kc.object_id = ic.object_id AND kc.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 0 AND ic.key_ordinal > 0
        ORDER BY ic.key_ordinal
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '') AS key_columns,
    STUFF((
        SELECT ', ' + QUOTENAME(nc.name)
        FROM sys.index_columns AS ic
        INNER JOIN sys.columns AS nc ON nc.object_id = ic.object_id AND nc.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 1
        ORDER BY ic.index_column_id
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '') AS included_columns
FROM sys.indexes AS i
WHERE i.object_id = OBJECT_ID(?)
ORDER BY rn
```

### schema.index-usage
- Purpose: Seeks, scans, lookups and updates per index of one table since the counters last reset (restart, database offline/online, failover, Azure scale operation). A NULL count means no use was recorded.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: VIEW SERVER STATE (VIEW DATABASE STATE on Azure SQL DB)
- Params: `?1` = `'schema.table'`

```sql
SELECT TOP (2000)
    ROW_NUMBER() OVER (ORDER BY i.index_id) AS rn,
    i.index_id,
    i.name AS index_name,
    i.type_desc,
    us.user_seeks,
    us.user_scans,
    us.user_lookups,
    us.user_updates,
    us.last_user_seek,
    us.last_user_scan,
    us.last_user_lookup,
    us.last_user_update
FROM sys.indexes AS i
LEFT JOIN sys.dm_db_index_usage_stats AS us
    ON us.database_id = DB_ID() AND us.object_id = i.object_id AND us.index_id = i.index_id
WHERE i.object_id = OBJECT_ID(?)
ORDER BY rn
```

### schema.foreign-keys
- Purpose: Foreign keys where one table is the child (`outgoing`), the parent (`incoming`) or both (`self`), one row per column pair in `constraint_column_id` order, with referential actions and the `is_disabled` / `is_not_trusted` flags. `total_rows` exposes a cut at 10000 rows.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none
- Params: `?1` = `'schema.table'`

```sql
SELECT TOP (10000)
    ROW_NUMBER() OVER (
        ORDER BY OBJECT_SCHEMA_NAME(fk.parent_object_id), OBJECT_NAME(fk.parent_object_id),
                 fk.name, fkc.constraint_column_id) AS rn,
    COUNT(*) OVER () AS total_rows,
    CASE
        WHEN fk.parent_object_id = p.target_id AND fk.referenced_object_id = p.target_id THEN 'self'
        WHEN fk.parent_object_id = p.target_id THEN 'outgoing'
        ELSE 'incoming'
    END AS direction,
    fk.name AS constraint_name,
    OBJECT_SCHEMA_NAME(fk.parent_object_id) + '.' + OBJECT_NAME(fk.parent_object_id) AS child_table,
    fkc.constraint_column_id,
    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS child_column,
    OBJECT_SCHEMA_NAME(fk.referenced_object_id) + '.' + OBJECT_NAME(fk.referenced_object_id) AS parent_table,
    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS parent_column,
    fk.delete_referential_action_desc AS on_delete,
    fk.update_referential_action_desc AS on_update,
    fk.is_disabled,
    fk.is_not_trusted
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
CROSS JOIN (SELECT OBJECT_ID(?) AS target_id) AS p
WHERE fk.parent_object_id = p.target_id OR fk.referenced_object_id = p.target_id
ORDER BY rn
```

## Dependencies

`sys.sql_expression_dependencies` records schema-bound and non-schema-bound references from SQL modules. It does not see dynamic SQL. A reference to an object that does not exist, or that sits in another database, has `referenced_id` NULL and is matched by name only.

### schema.depends-on-me
- Purpose: Objects whose code references the given object, including unresolved by-name references. `total_rows` exposes a cut at 10000 rows.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none
- Params: `?1` = `'schema.object'`, `?2` = schema name, `?3` = object name

```sql
SELECT TOP (10000)
    ROW_NUMBER() OVER (ORDER BY x.dependent_object) AS rn,
    COUNT(*) OVER () AS total_rows,
    x.dependent_object,
    x.dependent_type,
    x.referencing_class_desc,
    x.is_schema_bound_reference,
    x.is_caller_dependent,
    x.is_ambiguous,
    x.referenced_database_name
FROM (
    SELECT DISTINCT
        OBJECT_SCHEMA_NAME(d.referencing_id) + '.' + OBJECT_NAME(d.referencing_id) AS dependent_object,
        o.type_desc AS dependent_type,
        d.referencing_class_desc,
        d.is_schema_bound_reference,
        d.is_caller_dependent,
        d.is_ambiguous,
        d.referenced_database_name
    FROM sys.sql_expression_dependencies AS d
    LEFT JOIN sys.objects AS o ON o.object_id = d.referencing_id
    WHERE d.referenced_id = OBJECT_ID(?)
       OR (d.referenced_id IS NULL AND d.referenced_schema_name = ? AND d.referenced_entity_name = ?)
) AS x
ORDER BY rn
```

### schema.i-depend-on
- Purpose: Objects the given object's code references, with resolution status. Cross-database and missing targets show `is_unresolved` = 1.
- Requires: SQL Server 2012+
- Azure SQL DB: same
- Permission: none
- Params: `?1` = `'schema.object'`

```sql
SELECT TOP (10000)
    ROW_NUMBER() OVER (ORDER BY x.referenced_database_name, x.referenced_schema_name, x.referenced_entity_name) AS rn,
    COUNT(*) OVER () AS total_rows,
    x.referenced_server_name,
    x.referenced_database_name,
    x.referenced_schema_name,
    x.referenced_entity_name,
    x.referenced_class_desc,
    x.referenced_type,
    x.is_unresolved,
    x.is_schema_bound_reference,
    x.is_caller_dependent,
    x.is_ambiguous
FROM (
    SELECT DISTINCT
        d.referenced_server_name,
        d.referenced_database_name,
        d.referenced_schema_name,
        d.referenced_entity_name,
        d.referenced_class_desc,
        o.type_desc AS referenced_type,
        CASE WHEN d.referenced_id IS NULL THEN 1 ELSE 0 END AS is_unresolved,
        d.is_schema_bound_reference,
        d.is_caller_dependent,
        d.is_ambiguous
    FROM sys.sql_expression_dependencies AS d
    LEFT JOIN sys.objects AS o ON o.object_id = d.referenced_id
    WHERE d.referencing_id = OBJECT_ID(?)
) AS x
ORDER BY rn
```
