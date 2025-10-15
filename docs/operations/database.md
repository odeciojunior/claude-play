# Database Operations Runbook

## Overview

This runbook covers all database operations for the Claude Code neural learning system, including backup, recovery, migrations, integrity checks, and performance optimization for the SQLite memory database (`.swarm/memory.db`).

## Database Architecture

### Database Location
- **Production:** `/opt/claude-code-production/.swarm/memory.db`
- **Staging:** `/opt/claude-code-staging/.swarm/memory.db`
- **Development:** `./.swarm/memory.db`

### Database Schema

```sql
-- Core tables
CREATE TABLE patterns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  pattern_data TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_used TEXT,
  category TEXT
);

CREATE TABLE pattern_embeddings (
  pattern_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,
  dimension INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
);

CREATE TABLE task_trajectories (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  execution_data TEXT NOT NULL,
  outcome TEXT NOT NULL,
  execution_time_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE verification_history (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  task_id TEXT NOT NULL,
  truth_score REAL NOT NULL,
  verification_status TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE memory_entries (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  ttl INTEGER,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  PRIMARY KEY (namespace, key)
);

CREATE TABLE metrics_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE migrations_applied (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success'
);

-- Indexes for performance
CREATE INDEX idx_patterns_confidence ON patterns(confidence DESC);
CREATE INDEX idx_patterns_type ON patterns(type);
CREATE INDEX idx_patterns_category ON patterns(category, confidence DESC);
CREATE INDEX idx_patterns_last_used ON patterns(last_used DESC);
CREATE INDEX idx_task_trajectories_created ON task_trajectories(created_at DESC);
CREATE INDEX idx_verification_history_agent ON verification_history(agent_name, timestamp DESC);
CREATE INDEX idx_memory_entries_expires ON memory_entries(expires_at);
```

### Database Statistics

```bash
# Get database size
du -h .swarm/memory.db

# Get table statistics
sqlite3 .swarm/memory.db "
SELECT
  name,
  ROUND(SUM(pgsize) / 1024.0 / 1024.0, 2) as size_mb,
  COUNT(*) as pages
FROM dbstat
GROUP BY name
ORDER BY size_mb DESC;
"

# Get row counts
sqlite3 .swarm/memory.db "
SELECT 'patterns' as table_name, COUNT(*) as row_count FROM patterns
UNION ALL
SELECT 'pattern_embeddings', COUNT(*) FROM pattern_embeddings
UNION ALL
SELECT 'task_trajectories', COUNT(*) FROM task_trajectories
UNION ALL
SELECT 'verification_history', COUNT(*) FROM verification_history
UNION ALL
SELECT 'memory_entries', COUNT(*) FROM memory_entries
UNION ALL
SELECT 'metrics_log', COUNT(*) FROM metrics_log;
"
```

## Backup Procedures

### Automated Daily Backups

Create `/usr/local/bin/backup-neural-database.sh`:

```bash
#!/bin/bash

# Configuration
DB_PATH="/opt/claude-code-production/.swarm/memory.db"
BACKUP_DIR="/opt/claude-code-backups/daily"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Generate backup filename
BACKUP_FILE="$BACKUP_DIR/memory.db.$(date +%Y%m%d-%H%M%S).backup"

# Perform online backup using SQLite .backup command
sqlite3 $DB_PATH ".backup '$BACKUP_FILE'"

# Verify backup integrity
if sqlite3 $BACKUP_FILE "PRAGMA integrity_check;" | grep -q "ok"; then
  echo "✅ Backup successful: $BACKUP_FILE"

  # Compress backup
  gzip $BACKUP_FILE
  echo "✅ Backup compressed: ${BACKUP_FILE}.gz"

  # Calculate and store checksum
  sha256sum ${BACKUP_FILE}.gz > ${BACKUP_FILE}.gz.sha256
  echo "✅ Checksum created"

  # Log backup
  echo "$(date): Backup completed successfully - $BACKUP_FILE" >> /var/log/claude-code/backup.log
else
  echo "❌ Backup verification failed"
  rm -f $BACKUP_FILE
  exit 1
fi

# Clean up old backups
find $BACKUP_DIR -name "*.backup.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.sha256" -mtime +$RETENTION_DAYS -delete
echo "✅ Old backups cleaned up (retention: $RETENTION_DAYS days)"

# Check backup directory size
BACKUP_SIZE=$(du -sh $BACKUP_DIR | awk '{print $1}')
echo "📊 Total backup size: $BACKUP_SIZE"
```

Schedule automated backups:

```bash
# Add to crontab
crontab -e

# Daily backup at 2:00 AM
0 2 * * * /usr/local/bin/backup-neural-database.sh >> /var/log/claude-code/backup-cron.log 2>&1

# Hourly incremental backup (optional)
0 * * * * sqlite3 /opt/claude-code-production/.swarm/memory.db ".backup '/opt/claude-code-backups/hourly/memory.db.$(date +\%Y\%m\%d-\%H).backup'"
```

### Manual On-Demand Backup

```bash
# Quick backup
sqlite3 .swarm/memory.db ".backup .swarm/memory.db.manual-$(date +%Y%m%d-%H%M%S).backup"

# Backup with compression
BACKUP_FILE=".swarm/memory.db.manual-$(date +%Y%m%d-%H%M%S).backup"
sqlite3 .swarm/memory.db ".backup '$BACKUP_FILE'"
gzip $BACKUP_FILE
sha256sum ${BACKUP_FILE}.gz > ${BACKUP_FILE}.gz.sha256
echo "✅ Manual backup created: ${BACKUP_FILE}.gz"
```

### Pre-Deployment Backup

```bash
# Always backup before deployment
DEPLOY_BACKUP_DIR="/opt/claude-code-backups/pre-deployment"
mkdir -p $DEPLOY_BACKUP_DIR

BACKUP_FILE="$DEPLOY_BACKUP_DIR/memory.db.pre-deploy-$(date +%Y%m%d-%H%M%S).backup"
sqlite3 /opt/claude-code-production/.swarm/memory.db ".backup '$BACKUP_FILE'"

# Verify backup
sqlite3 $BACKUP_FILE "PRAGMA integrity_check;"

echo "✅ Pre-deployment backup: $BACKUP_FILE"
```

## Recovery Procedures

### Full Database Restore

```bash
#!/bin/bash
# Restore database from backup

# Stop application
systemctl stop claude-code-production

# Backup current database (just in case)
mv /opt/claude-code-production/.swarm/memory.db /opt/claude-code-production/.swarm/memory.db.before-restore

# List available backups
echo "Available backups:"
ls -lh /opt/claude-code-backups/daily/*.backup.gz | tail -10

# Restore from specific backup
BACKUP_FILE="/opt/claude-code-backups/daily/memory.db.20251015-020000.backup.gz"

# Verify checksum
if sha256sum -c ${BACKUP_FILE}.sha256; then
  echo "✅ Checksum verified"
else
  echo "❌ Checksum verification failed!"
  exit 1
fi

# Decompress and restore
gunzip -c $BACKUP_FILE > /opt/claude-code-production/.swarm/memory.db

# Verify restored database
if sqlite3 /opt/claude-code-production/.swarm/memory.db "PRAGMA integrity_check;" | grep -q "ok"; then
  echo "✅ Database restore successful"
else
  echo "❌ Database restore failed - integrity check failed"
  mv /opt/claude-code-production/.swarm/memory.db.before-restore /opt/claude-code-production/.swarm/memory.db
  exit 1
fi

# Restart application
systemctl start claude-code-production

# Verify application health
sleep 5
curl -f http://localhost:8080/health
```

### Point-in-Time Recovery

```bash
# Find backup closest to desired time
DESIRED_TIME="2025-10-15 14:30:00"

# List backups around that time
ls -l /opt/claude-code-backups/hourly/ | grep "$(date -d "$DESIRED_TIME" +%Y%m%d-%H)"

# Restore specific backup
BACKUP_FILE="/opt/claude-code-backups/hourly/memory.db.20251015-14.backup"
sqlite3 $BACKUP_FILE ".backup /opt/claude-code-production/.swarm/memory.db"

# Verify and restart
sqlite3 /opt/claude-code-production/.swarm/memory.db "PRAGMA integrity_check;"
systemctl restart claude-code-production
```

### Partial Recovery (Specific Table)

```bash
# Extract specific table from backup
BACKUP_FILE="/opt/claude-code-backups/daily/memory.db.20251015-020000.backup"

# Export table from backup
sqlite3 $BACKUP_FILE ".mode insert patterns" > patterns_backup.sql
sqlite3 $BACKUP_FILE "SELECT * FROM patterns;" >> patterns_backup.sql

# Import into current database (careful - may duplicate)
sqlite3 /opt/claude-code-production/.swarm/memory.db < patterns_backup.sql

# Or replace table completely
sqlite3 /opt/claude-code-production/.swarm/memory.db "
BEGIN TRANSACTION;
DELETE FROM patterns;
.read patterns_backup.sql
COMMIT;
"
```

### Disaster Recovery

```bash
#!/bin/bash
# Complete disaster recovery procedure

echo "=== DISASTER RECOVERY PROCEDURE ==="

# 1. Stop all services
systemctl stop claude-code-production

# 2. Find latest valid backup
LATEST_BACKUP=$(ls -t /opt/claude-code-backups/daily/*.backup.gz | head -1)
echo "Latest backup: $LATEST_BACKUP"

# 3. Verify backup integrity
if ! sha256sum -c ${LATEST_BACKUP}.sha256; then
  echo "❌ Latest backup corrupted, trying previous backup"
  LATEST_BACKUP=$(ls -t /opt/claude-code-backups/daily/*.backup.gz | head -2 | tail -1)
fi

# 4. Restore database
gunzip -c $LATEST_BACKUP > /opt/claude-code-production/.swarm/memory.db

# 5. Verify database
sqlite3 /opt/claude-code-production/.swarm/memory.db "PRAGMA integrity_check;"

# 6. Optimize database
sqlite3 /opt/claude-code-production/.swarm/memory.db "VACUUM; ANALYZE;"

# 7. Restart services
systemctl start claude-code-production

# 8. Verify health
sleep 10
curl -f http://localhost:8080/health
./claude-flow verify status
npx claude-flow neural status

echo "✅ Disaster recovery complete"
```

## Migration Procedures

### Creating a Migration

```bash
# Create new migration file
MIGRATION_NAME="add_pattern_category_index"
MIGRATION_FILE="migrations/$(date +%Y%m%d%H%M%S)_${MIGRATION_NAME}.sql"

cat > $MIGRATION_FILE << 'EOF'
-- Migration: Add category index for faster pattern queries
-- Created: 2025-10-15
-- Author: Database Team

BEGIN TRANSACTION;

-- Add category column if it doesn't exist
ALTER TABLE patterns ADD COLUMN category TEXT;

-- Create index
CREATE INDEX IF NOT EXISTS idx_patterns_category
ON patterns(category, confidence DESC);

-- Update existing patterns with default category
UPDATE patterns
SET category = 'general'
WHERE category IS NULL;

-- Verify changes
SELECT COUNT(*) as patterns_with_category
FROM patterns
WHERE category IS NOT NULL;

COMMIT;
EOF

echo "✅ Migration created: $MIGRATION_FILE"
```

### Running Migrations Safely

```bash
#!/bin/bash
# Safe migration execution script

MIGRATION_FILE=$1

if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: $0 <migration-file>"
  exit 1
fi

echo "=== SAFE MIGRATION EXECUTION ==="

# 1. Backup database before migration
BACKUP_FILE=".swarm/memory.db.pre-migration-$(date +%Y%m%d-%H%M%S).backup"
sqlite3 .swarm/memory.db ".backup '$BACKUP_FILE'"
echo "✅ Pre-migration backup: $BACKUP_FILE"

# 2. Test migration on copy
TEST_DB=".swarm/memory.db.test"
cp .swarm/memory.db $TEST_DB

echo "Testing migration on copy..."
if sqlite3 $TEST_DB < $MIGRATION_FILE; then
  echo "✅ Migration test successful"
else
  echo "❌ Migration test failed"
  rm $TEST_DB
  exit 1
fi

# 3. Verify test database integrity
if sqlite3 $TEST_DB "PRAGMA integrity_check;" | grep -q "ok"; then
  echo "✅ Test database integrity verified"
else
  echo "❌ Test database integrity check failed"
  rm $TEST_DB
  exit 1
fi

# 4. Apply to production
echo "Applying migration to production..."
if sqlite3 .swarm/memory.db < $MIGRATION_FILE; then
  echo "✅ Migration applied successfully"
else
  echo "❌ Migration failed - restoring backup"
  cp $BACKUP_FILE .swarm/memory.db
  exit 1
fi

# 5. Verify production database
if sqlite3 .swarm/memory.db "PRAGMA integrity_check;" | grep -q "ok"; then
  echo "✅ Production database integrity verified"
else
  echo "❌ Production integrity check failed - restoring backup"
  cp $BACKUP_FILE .swarm/memory.db
  exit 1
fi

# 6. Log migration
sqlite3 .swarm/memory.db "
INSERT INTO migrations_applied (filename, applied_at, status)
VALUES ('$(basename $MIGRATION_FILE)', datetime('now'), 'success');
"

# 7. Clean up test database
rm $TEST_DB

echo "✅ Migration complete: $MIGRATION_FILE"
```

### Rollback Migration

```bash
# Create rollback migration
ROLLBACK_FILE="migrations/$(date +%Y%m%d%H%M%S)_rollback_${MIGRATION_NAME}.sql"

cat > $ROLLBACK_FILE << 'EOF'
-- Rollback: Remove category index
BEGIN TRANSACTION;

-- Drop index
DROP INDEX IF EXISTS idx_patterns_category;

-- Remove category column (SQLite doesn't support DROP COLUMN directly)
-- Create temp table without category
CREATE TABLE patterns_new (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  pattern_data TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_used TEXT
);

-- Copy data
INSERT INTO patterns_new
SELECT id, type, pattern_data, confidence, usage_count, created_at, last_used
FROM patterns;

-- Swap tables
DROP TABLE patterns;
ALTER TABLE patterns_new RENAME TO patterns;

-- Recreate indexes
CREATE INDEX idx_patterns_confidence ON patterns(confidence DESC);
CREATE INDEX idx_patterns_type ON patterns(type);

COMMIT;
EOF
```

## Data Integrity Checks

### Comprehensive Integrity Check

```bash
#!/bin/bash
# Comprehensive database integrity check

echo "=== DATABASE INTEGRITY CHECK ==="

# 1. SQLite integrity check
echo "1. SQLite Integrity Check"
if sqlite3 .swarm/memory.db "PRAGMA integrity_check;" | grep -q "ok"; then
  echo "✅ Database structure integrity: PASS"
else
  echo "❌ Database structure integrity: FAIL"
  exit 1
fi

# 2. Foreign key constraints
echo "2. Foreign Key Constraints"
sqlite3 .swarm/memory.db "PRAGMA foreign_key_check;" > fk_violations.txt
if [ -s fk_violations.txt ]; then
  echo "❌ Foreign key violations found:"
  cat fk_violations.txt
else
  echo "✅ Foreign key constraints: PASS"
fi

# 3. Pattern consistency
echo "3. Pattern Consistency"
sqlite3 .swarm/memory.db "
SELECT
  COUNT(*) as invalid_patterns
FROM patterns
WHERE confidence < 0 OR confidence > 1
  OR usage_count < 0
  OR created_at IS NULL;
" > pattern_violations.txt

if grep -q "^0$" pattern_violations.txt; then
  echo "✅ Pattern data consistency: PASS"
else
  echo "❌ Pattern data violations found:"
  cat pattern_violations.txt
fi

# 4. Embedding consistency
echo "4. Embedding Consistency"
sqlite3 .swarm/memory.db "
SELECT COUNT(*) as orphaned_embeddings
FROM pattern_embeddings pe
LEFT JOIN patterns p ON pe.pattern_id = p.id
WHERE p.id IS NULL;
" > embedding_violations.txt

if grep -q "^0$" embedding_violations.txt; then
  echo "✅ Embedding consistency: PASS"
else
  echo "❌ Orphaned embeddings found:"
  cat embedding_violations.txt
fi

# 5. Expired entries
echo "5. Expired Entries Cleanup"
EXPIRED_COUNT=$(sqlite3 .swarm/memory.db "
SELECT COUNT(*) FROM memory_entries
WHERE expires_at IS NOT NULL
  AND datetime(expires_at) < datetime('now');
")
echo "Found $EXPIRED_COUNT expired entries"

# 6. Index health
echo "6. Index Health"
sqlite3 .swarm/memory.db "PRAGMA index_list('patterns');"
sqlite3 .swarm/memory.db "PRAGMA index_info('idx_patterns_confidence');"

echo "✅ Integrity check complete"
```

### Automated Daily Integrity Check

```bash
# Add to crontab
0 3 * * * /usr/local/bin/check-database-integrity.sh >> /var/log/claude-code/integrity-check.log 2>&1
```

## Performance Optimization

### Vacuum and Analyze

```bash
# Vacuum to reclaim space and defragment
sqlite3 .swarm/memory.db "VACUUM;"

# Analyze to update query planner statistics
sqlite3 .swarm/memory.db "ANALYZE;"

# Check database size before and after
du -h .swarm/memory.db
```

### Index Optimization

```bash
# Check for missing indexes
sqlite3 .swarm/memory.db "
SELECT
  sql
FROM sqlite_master
WHERE type = 'index'
  AND name NOT LIKE 'sqlite_%';
"

# Analyze query plans
sqlite3 .swarm/memory.db "
EXPLAIN QUERY PLAN
SELECT * FROM patterns
WHERE confidence > 0.8
  AND category = 'goap_planning'
ORDER BY confidence DESC
LIMIT 100;
"

# Create additional indexes if needed
sqlite3 .swarm/memory.db "
CREATE INDEX IF NOT EXISTS idx_patterns_category_confidence
ON patterns(category, confidence DESC);
"
```

### Pattern Pruning Strategy

```bash
#!/bin/bash
# Prune low-value patterns to maintain performance

echo "=== PATTERN PRUNING ==="

# 1. Count patterns to be pruned
PRUNE_COUNT=$(sqlite3 .swarm/memory.db "
SELECT COUNT(*) FROM patterns
WHERE (
  -- Old patterns with low usage
  (last_used < datetime('now', '-90 days') AND usage_count < 3)
  OR
  -- Low confidence patterns never used
  (confidence < 0.3 AND last_used IS NULL)
  OR
  -- Expired patterns
  (created_at < datetime('now', '-180 days') AND usage_count = 0)
);
")

echo "Patterns to prune: $PRUNE_COUNT"

if [ "$PRUNE_COUNT" -gt 0 ]; then
  # 2. Export to archive before deletion
  ARCHIVE_FILE="/opt/claude-code-archives/pruned-patterns-$(date +%Y%m%d).sql"
  mkdir -p /opt/claude-code-archives

  sqlite3 .swarm/memory.db "
  .mode insert patterns
  SELECT * FROM patterns
  WHERE (
    (last_used < datetime('now', '-90 days') AND usage_count < 3)
    OR (confidence < 0.3 AND last_used IS NULL)
    OR (created_at < datetime('now', '-180 days') AND usage_count = 0)
  );
  " > $ARCHIVE_FILE

  echo "✅ Patterns archived to: $ARCHIVE_FILE"

  # 3. Delete patterns
  sqlite3 .swarm/memory.db "
  DELETE FROM patterns
  WHERE (
    (last_used < datetime('now', '-90 days') AND usage_count < 3)
    OR (confidence < 0.3 AND last_used IS NULL)
    OR (created_at < datetime('now', '-180 days') AND usage_count = 0)
  );
  "

  echo "✅ Deleted $PRUNE_COUNT patterns"

  # 4. Vacuum to reclaim space
  sqlite3 .swarm/memory.db "VACUUM;"

  echo "✅ Database vacuumed"
fi
```

### Query Performance Tuning

```bash
# Enable query logging
sqlite3 .swarm/memory.db "
PRAGMA query_only = OFF;
PRAGMA analysis_limit = 1000;
"

# Optimize common queries
sqlite3 .swarm/memory.db "
-- Ensure indexes exist for common access patterns
CREATE INDEX IF NOT EXISTS idx_patterns_type_confidence
ON patterns(type, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_task_trajectories_type
ON task_trajectories(task_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_agent_time
ON verification_history(agent_name, timestamp DESC);
"
```

## Monitoring and Alerts

### Database Size Monitoring

```bash
# Monitor database growth
du -h .swarm/memory.db | awk '{print $1}' > /tmp/db_size.txt

# Alert if > 1GB
DB_SIZE_MB=$(du -m .swarm/memory.db | awk '{print $1}')
if [ $DB_SIZE_MB -gt 1000 ]; then
  echo "WARNING: Database size exceeds 1GB: ${DB_SIZE_MB}MB"
  # Send alert
fi
```

### Query Performance Monitoring

```bash
# Log slow queries (>100ms)
sqlite3 .swarm/memory.db "
SELECT
  sql,
  AVG(time_ms) as avg_time
FROM query_log
WHERE time_ms > 100
GROUP BY sql
ORDER BY avg_time DESC;
"
```

## Related Documentation

- `/docs/operations/deployment.md` - Deployment procedures
- `/docs/operations/monitoring.md` - Monitoring setup
- `/docs/operations/incident-response.md` - Incident handling
- `/docs/operations/maintenance.md` - System maintenance
- `/docs/neural/memory-schema.md` - Detailed schema documentation
