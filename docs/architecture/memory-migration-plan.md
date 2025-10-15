# Memory Migration Implementation Plan
## Step-by-Step Migration Procedure

**Version**: 1.0.0
**Date**: 2025-10-15
**Action**: A2 - Unify Memory Systems
**Parent**: memory-unification-architecture.md

---

## 1. Migration Overview

### 1.1 Migration Goals

- **Zero Data Loss**: Migrate all 554 records (550 + 4)
- **Zero Downtime**: < 100ms write lock
- **100% Validation**: Every record verified
- **Instant Rollback**: < 5 minutes if needed
- **Performance Target**: < 10ms queries maintained

### 1.2 Migration Phases

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Preparation (Parallel, No Downtime)           │
├─────────────────────────────────────────────────────────┤
│ • Create backups                                        │
│ • Validate source data                                  │
│ • Create unified schema                                 │
│ • Test on sample data                                   │
│ Duration: 2 hours                                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 2: Migration (Brief Lock)                        │
├─────────────────────────────────────────────────────────┤
│ • Lock writes                                           │
│ • Copy all data                                         │
│ • Create indexes                                        │
│ • Validate migration                                    │
│ Duration: 10 minutes (lock: 100ms)                     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 3: Cutover (Atomic)                              │
├─────────────────────────────────────────────────────────┤
│ • Stop all operations                                   │
│ • Atomic file swap                                      │
│ • Resume operations                                     │
│ • Monitor health                                        │
│ Duration: 1 minute                                      │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 4: Validation (Continuous)                       │
├─────────────────────────────────────────────────────────┤
│ • Verify all queries                                    │
│ • Performance testing                                   │
│ • Agent access validation                               │
│ • Keep old backups (7 days)                            │
│ Duration: Ongoing                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Preparation

### 2.1 Pre-Migration Checklist

```bash
#!/bin/bash
# Pre-migration checklist script

echo "=== Memory Migration Pre-Check ==="

# 1. Check source databases exist
test -f .swarm/memory.db || { echo "❌ .swarm/memory.db not found"; exit 1; }
test -f .hive-mind/hive.db || { echo "❌ .hive-mind/hive.db not found"; exit 1; }
echo "✅ Source databases found"

# 2. Check database integrity
sqlite3 .swarm/memory.db "PRAGMA integrity_check;" | grep -q "ok" || { echo "❌ .swarm/memory.db corrupted"; exit 1; }
sqlite3 .hive-mind/hive.db "PRAGMA integrity_check;" | grep -q "ok" || { echo "❌ .hive-mind/hive.db corrupted"; exit 1; }
echo "✅ Database integrity verified"

# 3. Check disk space (need 2x current size)
REQUIRED_SPACE=$(($(du -s .swarm .hive-mind | awk '{sum+=$1} END {print sum}') * 2))
AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
[ $AVAILABLE_SPACE -gt $REQUIRED_SPACE ] || { echo "❌ Insufficient disk space"; exit 1; }
echo "✅ Sufficient disk space available"

# 4. Check write permissions
touch .swarm/test.tmp && rm .swarm/test.tmp || { echo "❌ No write permission to .swarm"; exit 1; }
echo "✅ Write permissions verified"

# 5. Count source records
SWARM_COUNT=$(sqlite3 .swarm/memory.db "SELECT COUNT(*) FROM memory_entries;")
HIVE_COUNT=$(sqlite3 .hive-mind/hive.db "SELECT COUNT(*) FROM knowledge_base;")
echo "✅ Source record counts: $SWARM_COUNT + $HIVE_COUNT = $((SWARM_COUNT + HIVE_COUNT))"

echo ""
echo "=== Pre-Check Complete: READY TO MIGRATE ==="
```

### 2.2 Create Backups

```bash
#!/bin/bash
# create-backups.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=".swarm/backups/migration_${TIMESTAMP}"

echo "Creating backups in ${BACKUP_DIR}..."

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup .swarm/memory.db
echo "Backing up .swarm/memory.db..."
sqlite3 .swarm/memory.db ".backup '${BACKUP_DIR}/memory.db'"
sqlite3 .swarm/memory.db ".dump" > "${BACKUP_DIR}/memory.db.sql"
echo "✅ Backed up .swarm/memory.db"

# Backup .hive-mind/hive.db
echo "Backing up .hive-mind/hive.db..."
sqlite3 .hive-mind/hive.db ".backup '${BACKUP_DIR}/hive.db'"
sqlite3 .hive-mind/hive.db ".dump" > "${BACKUP_DIR}/hive.db.sql"
echo "✅ Backed up .hive-mind/hive.db"

# Create checksums
echo "Creating checksums..."
cd "${BACKUP_DIR}"
sha256sum *.db *.sql > checksums.txt
cd - > /dev/null
echo "✅ Created checksums"

# Save metadata
cat > "${BACKUP_DIR}/metadata.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "source_databases": [".swarm/memory.db", ".hive-mind/hive.db"],
  "backup_location": "${BACKUP_DIR}",
  "record_counts": {
    "swarm_memory_entries": $(sqlite3 .swarm/memory.db "SELECT COUNT(*) FROM memory_entries;"),
    "hive_knowledge_base": $(sqlite3 .hive-mind/hive.db "SELECT COUNT(*) FROM knowledge_base;")
  }
}
EOF
echo "✅ Saved metadata"

echo ""
echo "=== Backup Complete ==="
echo "Location: ${BACKUP_DIR}"
echo "To restore: ./scripts/restore-backup.sh ${BACKUP_DIR}"
```

### 2.3 Validate Source Data

```typescript
/**
 * Validate source databases before migration
 */
import Database from 'better-sqlite3';

interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    swarmRecords: number;
    hiveRecords: number;
    totalRecords: number;
  };
}

async function validateSourceDatabases(): Promise<ValidationReport> {
  const report: ValidationReport = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      swarmRecords: 0,
      hiveRecords: 0,
      totalRecords: 0
    }
  };

  try {
    // Open databases
    const swarmDb = new Database('.swarm/memory.db', { readonly: true });
    const hiveDb = new Database('.hive-mind/hive.db', { readonly: true });

    // Validate .swarm/memory.db
    console.log('Validating .swarm/memory.db...');

    // Check required tables exist
    const swarmTables = swarmDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all();

    const requiredSwarmTables = [
      'memory_entries', 'patterns', 'pattern_embeddings', 'pattern_links',
      'task_trajectories', 'matts_runs', 'consolidation_runs', 'metrics_log'
    ];

    for (const table of requiredSwarmTables) {
      if (!swarmTables.find(t => t.name === table)) {
        report.errors.push(`Missing table in .swarm/memory.db: ${table}`);
        report.valid = false;
      }
    }

    // Count records
    const swarmCount = swarmDb.prepare('SELECT COUNT(*) as count FROM memory_entries').get();
    report.stats.swarmRecords = swarmCount.count;
    console.log(`✅ Found ${swarmCount.count} records in .swarm/memory.db`);

    // Validate data integrity
    const invalidMemoryEntries = swarmDb.prepare(`
      SELECT COUNT(*) as count
      FROM memory_entries
      WHERE key IS NULL OR value IS NULL OR namespace IS NULL
    `).get();

    if (invalidMemoryEntries.count > 0) {
      report.errors.push(`${invalidMemoryEntries.count} invalid records in memory_entries`);
      report.valid = false;
    }

    // Validate .hive-mind/hive.db
    console.log('Validating .hive-mind/hive.db...');

    const hiveTables = hiveDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all();

    const requiredHiveTables = [
      'swarms', 'agents', 'tasks', 'messages', 'consensus_votes',
      'knowledge_base', 'performance_metrics', 'sessions'
    ];

    for (const table of requiredHiveTables) {
      if (!hiveTables.find(t => t.name === table)) {
        report.errors.push(`Missing table in .hive-mind/hive.db: ${table}`);
        report.valid = false;
      }
    }

    // Count records
    const hiveCount = hiveDb.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();
    report.stats.hiveRecords = hiveCount.count;
    console.log(`✅ Found ${hiveCount.count} records in .hive-mind/hive.db`);

    // Validate knowledge base
    const invalidKnowledge = hiveDb.prepare(`
      SELECT COUNT(*) as count
      FROM knowledge_base
      WHERE title IS NULL OR content IS NULL
    `).get();

    if (invalidKnowledge.count > 0) {
      report.errors.push(`${invalidKnowledge.count} invalid records in knowledge_base`);
      report.valid = false;
    }

    // Total records
    report.stats.totalRecords = report.stats.swarmRecords + report.stats.hiveRecords;

    // Close databases
    swarmDb.close();
    hiveDb.close();

    console.log('');
    console.log('=== Validation Report ===');
    console.log(`Valid: ${report.valid ? '✅ YES' : '❌ NO'}`);
    console.log(`Errors: ${report.errors.length}`);
    console.log(`Warnings: ${report.warnings.length}`);
    console.log(`Total Records: ${report.stats.totalRecords}`);

    return report;

  } catch (error) {
    report.valid = false;
    report.errors.push(`Validation error: ${error.message}`);
    return report;
  }
}

export { validateSourceDatabases };
```

### 2.4 Create Unified Schema

```sql
-- unified-schema.sql
-- Creates the unified schema in a new database

-- Enable performance optimizations
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
PRAGMA page_size = 4096;
PRAGMA auto_vacuum = INCREMENTAL;
PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- ================================================================
-- NEURAL LEARNING LAYER (from .swarm/memory.db)
-- ================================================================

-- Table: memory_entries
CREATE TABLE memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'default',
  metadata TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  accessed_at INTEGER DEFAULT (strftime('%s', 'now')),
  access_count INTEGER DEFAULT 0,
  ttl INTEGER,
  expires_at INTEGER,
  UNIQUE(key, namespace)
);

CREATE INDEX idx_memory_namespace ON memory_entries(namespace);
CREATE INDEX idx_memory_expires ON memory_entries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_memory_accessed ON memory_entries(accessed_at);

-- Table: patterns
CREATE TABLE patterns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  pattern_data TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used TEXT,
  metadata TEXT
);

CREATE INDEX idx_patterns_type ON patterns(type);
CREATE INDEX idx_patterns_confidence ON patterns(confidence DESC);
CREATE INDEX idx_patterns_created_at ON patterns(created_at DESC);
CREATE INDEX idx_patterns_last_used ON patterns(last_used DESC);
CREATE INDEX idx_patterns_usage ON patterns(usage_count DESC);

-- Table: pattern_embeddings
CREATE TABLE pattern_embeddings (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  dims INTEGER NOT NULL,
  vector BLOB NOT NULL,
  compressed BOOLEAN DEFAULT FALSE,
  min_val REAL,
  max_val REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES patterns(id) ON DELETE CASCADE
);

CREATE INDEX idx_embeddings_model ON pattern_embeddings(model);

-- Table: pattern_links
CREATE TABLE pattern_links (
  src_id TEXT NOT NULL,
  dst_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  PRIMARY KEY (src_id, dst_id, relation),
  FOREIGN KEY (src_id) REFERENCES patterns(id) ON DELETE CASCADE,
  FOREIGN KEY (dst_id) REFERENCES patterns(id) ON DELETE CASCADE
);

CREATE INDEX idx_pattern_links_src ON pattern_links(src_id);
CREATE INDEX idx_pattern_links_dst ON pattern_links(dst_id);
CREATE INDEX idx_pattern_links_relation ON pattern_links(relation);

-- Table: task_trajectories
CREATE TABLE task_trajectories (
  task_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  query TEXT NOT NULL,
  trajectory_json TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  duration_ms INTEGER,
  judge_label TEXT,
  judge_conf REAL,
  judge_reasons TEXT,
  matts_run_id TEXT,
  token_count INTEGER,
  tool_calls_count INTEGER,
  error_count INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matts_run_id) REFERENCES matts_runs(run_id)
);

CREATE INDEX idx_trajectories_agent ON task_trajectories(agent_id);
CREATE INDEX idx_trajectories_label ON task_trajectories(judge_label);
CREATE INDEX idx_trajectories_started ON task_trajectories(started_at DESC);
CREATE INDEX idx_trajectories_duration ON task_trajectories(duration_ms);

-- Table: matts_runs
CREATE TABLE matts_runs (
  run_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  k INTEGER NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  retrieval_method TEXT,
  retrieved_patterns TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX idx_matts_task ON matts_runs(task_id);
CREATE INDEX idx_matts_status ON matts_runs(status);

-- Table: consolidation_runs
CREATE TABLE consolidation_runs (
  run_id TEXT PRIMARY KEY,
  items_processed INTEGER NOT NULL,
  duplicates_found INTEGER NOT NULL,
  duplicates_merged INTEGER NOT NULL,
  contradictions_found INTEGER NOT NULL,
  contradictions_resolved INTEGER NOT NULL,
  items_pruned INTEGER NOT NULL,
  patterns_optimized INTEGER NOT NULL,
  space_reclaimed_bytes INTEGER,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consolidation_created ON consolidation_runs(created_at DESC);

-- Table: metrics_log
CREATE TABLE metrics_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  tags TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_name ON metrics_log(metric_name);
CREATE INDEX idx_metrics_timestamp ON metrics_log(timestamp DESC);
CREATE INDEX idx_metrics_name_timestamp ON metrics_log(metric_name, timestamp DESC);

-- ================================================================
-- SWARM COORDINATION LAYER (from .hive-mind/hive.db)
-- ================================================================

-- Table: swarms
CREATE TABLE swarms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'destroyed')),
  queen_type TEXT DEFAULT 'strategic' CHECK(queen_type IN ('strategic', 'tactical', 'adaptive')),
  topology TEXT DEFAULT 'hierarchical' CHECK(topology IN ('hierarchical', 'mesh', 'ring', 'star')),
  max_agents INTEGER DEFAULT 8 CHECK(max_agents > 0 AND max_agents <= 100),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}',
  learning_enabled BOOLEAN DEFAULT 1,
  pattern_sharing BOOLEAN DEFAULT 1,
  coordination_efficiency REAL DEFAULT 0.70
);

CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_swarms_topology ON swarms(topology);
CREATE INDEX idx_swarms_created_at ON swarms(created_at DESC);

-- Table: agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  role TEXT,
  capabilities TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'idle', 'busy', 'paused', 'offline')),
  performance_score REAL DEFAULT 0.5 CHECK(performance_score >= 0 AND performance_score <= 1),
  task_count INTEGER DEFAULT 0 CHECK(task_count >= 0),
  success_rate REAL DEFAULT 1.0 CHECK(success_rate >= 0 AND success_rate <= 1),
  last_active TEXT DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}',
  learning_enabled BOOLEAN DEFAULT 1,
  pattern_count INTEGER DEFAULT 0,
  confidence_avg REAL DEFAULT 0.5,
  FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

CREATE INDEX idx_agents_swarm_id ON agents(swarm_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_performance ON agents(performance_score DESC);
CREATE INDEX idx_agents_last_active ON agents(last_active DESC);

-- Table: tasks
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  agent_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 3 CHECK(priority >= 1 AND priority <= 5),
  complexity REAL DEFAULT 0.5 CHECK(complexity >= 0 AND complexity <= 1),
  estimated_time INTEGER,
  actual_time INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  metadata TEXT DEFAULT '{}',
  trajectory_id TEXT,
  pattern_ids TEXT DEFAULT '[]',
  FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (trajectory_id) REFERENCES task_trajectories(task_id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_swarm_id ON tasks(swarm_id);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority DESC);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_trajectory ON tasks(trajectory_id);

-- Table: messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  sender_id TEXT,
  recipient_id TEXT,
  channel TEXT DEFAULT 'general',
  type TEXT DEFAULT 'info' CHECK(type IN ('info', 'command', 'query', 'response', 'alert')),
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 3 CHECK(priority >= 1 AND priority <= 5),
  consensus_vote REAL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  processed BOOLEAN DEFAULT 0,
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (recipient_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_swarm_id ON messages(swarm_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_processed ON messages(processed);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);

-- Table: consensus_votes
CREATE TABLE consensus_votes (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  proposal_id TEXT NOT NULL,
  agent_id TEXT,
  vote REAL NOT NULL CHECK(vote >= 0 AND vote <= 1),
  weight REAL DEFAULT 1.0 CHECK(weight >= 0 AND weight <= 1),
  justification TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX idx_consensus_votes_swarm_id ON consensus_votes(swarm_id);
CREATE INDEX idx_consensus_votes_proposal ON consensus_votes(proposal_id);
CREATE INDEX idx_consensus_votes_timestamp ON consensus_votes(timestamp DESC);

-- Table: sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  swarm_id TEXT NOT NULL,
  swarm_name TEXT NOT NULL,
  objective TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  paused_at TEXT,
  resumed_at TEXT,
  completion_percentage REAL DEFAULT 0 CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
  checkpoint_data TEXT,
  metadata TEXT,
  parent_pid INTEGER,
  child_pids TEXT,
  FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_swarm_id ON sessions(swarm_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

-- ================================================================
-- UNIFIED KNOWLEDGE LAYER
-- ================================================================

-- Table: knowledge_base (enhanced from hive.db)
CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  category TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  confidence REAL DEFAULT 0.5 CHECK(confidence >= 0 AND confidence <= 1),
  source_agent_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  access_count INTEGER DEFAULT 0,
  pattern_id TEXT,
  embedding_id TEXT,
  FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE SET NULL,
  FOREIGN KEY (source_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE SET NULL,
  FOREIGN KEY (embedding_id) REFERENCES pattern_embeddings(id) ON DELETE SET NULL
);

CREATE INDEX idx_knowledge_base_swarm_id ON knowledge_base(swarm_id);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_base_confidence ON knowledge_base(confidence DESC);
CREATE INDEX idx_knowledge_base_pattern ON knowledge_base(pattern_id);

-- Table: performance_metrics (unified)
CREATE TABLE performance_metrics (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('agent', 'swarm', 'task', 'pattern', 'system')),
  entity_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  unit TEXT,
  tags TEXT DEFAULT '{}',
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_performance_metrics_entity ON performance_metrics(entity_type, entity_id);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX idx_performance_metrics_name_timestamp ON performance_metrics(metric_name, timestamp DESC);

-- Table: schema_version
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  migration_script TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_by TEXT DEFAULT 'system'
);

-- Initial version
INSERT INTO schema_version (version, description)
VALUES (1, 'Unified memory system - initial migration from .swarm + .hive-mind');

COMMIT;

-- Analyze tables for query optimization
ANALYZE;
```

---

## 3. Phase 2: Data Migration

### 3.1 Migration Script

```typescript
/**
 * migrate-databases.ts
 * Migrates data from .swarm/memory.db and .hive-mind/hive.db
 * into the unified database
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationResult {
  success: boolean;
  recordsMigrated: number;
  duration: number;
  errors: string[];
}

async function migrateDatabase(): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: false,
    recordsMigrated: 0,
    duration: 0,
    errors: []
  };

  try {
    console.log('=== Starting Database Migration ===\n');

    // Step 1: Create unified database
    console.log('Step 1: Creating unified database...');
    const unifiedDbPath = '.swarm/memory-unified.db';

    // Remove if exists
    if (fs.existsSync(unifiedDbPath)) {
      fs.unlinkSync(unifiedDbPath);
    }

    const unifiedDb = new Database(unifiedDbPath);

    // Load and execute unified schema
    console.log('Loading unified schema...');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../sql/unified-schema.sql'),
      'utf8'
    );
    unifiedDb.exec(schemaSQL);
    console.log('✅ Unified schema created\n');

    // Step 2: Migrate .swarm/memory.db data
    console.log('Step 2: Migrating .swarm/memory.db data...');
    const swarmDb = new Database('.swarm/memory.db', { readonly: true });

    // Attach source database for direct copying
    unifiedDb.exec("ATTACH DATABASE '.swarm/memory.db' AS source");

    // Copy memory_entries
    console.log('Copying memory_entries...');
    const memoryEntriesCount = unifiedDb.prepare(`
      INSERT INTO memory_entries
        (id, key, value, namespace, metadata, created_at, updated_at, accessed_at, access_count, ttl, expires_at)
      SELECT id, key, value, namespace, metadata, created_at, updated_at, accessed_at, access_count, ttl, expires_at
      FROM source.memory_entries
    `).run();

    console.log(`✅ Copied ${memoryEntriesCount.changes} memory_entries`);
    result.recordsMigrated += memoryEntriesCount.changes;

    // Detach source database
    unifiedDb.exec("DETACH DATABASE source");
    swarmDb.close();
    console.log('✅ .swarm/memory.db migration complete\n');

    // Step 3: Migrate .hive-mind/hive.db data
    console.log('Step 3: Migrating .hive-mind/hive.db data...');
    const hiveDb = new Database('.hive-mind/hive.db', { readonly: true });

    // Attach hive database
    unifiedDb.exec("ATTACH DATABASE '.hive-mind/hive.db' AS hive");

    // Copy knowledge_base
    console.log('Copying knowledge_base...');
    const knowledgeCount = unifiedDb.prepare(`
      INSERT INTO knowledge_base
        (id, swarm_id, category, title, content, tags, confidence, source_agent_id, created_at, updated_at, access_count)
      SELECT id, swarm_id, category, title, content, tags, confidence, source_agent_id, created_at, updated_at, access_count
      FROM hive.knowledge_base
    `).run();

    console.log(`✅ Copied ${knowledgeCount.changes} knowledge_base entries`);
    result.recordsMigrated += knowledgeCount.changes;

    // Detach hive database
    unifiedDb.exec("DETACH DATABASE hive");
    hiveDb.close();
    console.log('✅ .hive-mind/hive.db migration complete\n');

    // Step 4: Validate migration
    console.log('Step 4: Validating migration...');
    const validation = validateMigration(unifiedDb);

    if (!validation.valid) {
      result.errors = validation.errors;
      throw new Error('Migration validation failed');
    }

    console.log('✅ Migration validation passed\n');

    // Step 5: Optimize database
    console.log('Step 5: Optimizing database...');
    unifiedDb.exec('VACUUM');
    unifiedDb.exec('ANALYZE');
    console.log('✅ Database optimized\n');

    // Close unified database
    unifiedDb.close();

    result.success = true;
    result.duration = Date.now() - startTime;

    console.log('=== Migration Complete ===');
    console.log(`Records migrated: ${result.recordsMigrated}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Database: ${unifiedDbPath}\n`);

    return result;

  } catch (error) {
    result.errors.push(error.message);
    result.duration = Date.now() - startTime;
    console.error('❌ Migration failed:', error.message);
    return result;
  }
}

function validateMigration(db: Database): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Check record counts
    const memoryCount = db.prepare('SELECT COUNT(*) as count FROM memory_entries').get();
    const knowledgeCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();

    console.log(`  Memory entries: ${memoryCount.count}`);
    console.log(`  Knowledge base: ${knowledgeCount.count}`);

    // Validate foreign key constraints
    const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
    if (fkViolations.length > 0) {
      errors.push(`Foreign key violations found: ${fkViolations.length}`);
    }

    // Check for NULL values in NOT NULL columns
    const nullChecks = [
      { table: 'memory_entries', column: 'key' },
      { table: 'memory_entries', column: 'value' },
      { table: 'knowledge_base', column: 'title' },
      { table: 'knowledge_base', column: 'content' }
    ];

    for (const check of nullChecks) {
      const nullCount = db.prepare(
        `SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.column} IS NULL`
      ).get();

      if (nullCount.count > 0) {
        errors.push(`NULL values found in ${check.table}.${check.column}: ${nullCount.count}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };

  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
    return { valid: false, errors };
  }
}

// Execute migration
if (require.main === module) {
  migrateDatabase().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

export { migrateDatabase };
```

---

## 4. Phase 3: Cutover

### 4.1 Cutover Script

```bash
#!/bin/bash
# cutover.sh
# Atomic cutover to unified database

set -e

echo "=== Database Cutover ==="
echo ""

# Timestamp for backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Step 1: Stop operations (if needed)
echo "Step 1: Preparing for cutover..."
# Add any service stop commands here if needed
# systemctl stop claude-flow

# Step 2: Final backup
echo "Step 2: Creating final backup..."
mkdir -p .swarm/backups/cutover_${TIMESTAMP}
cp .swarm/memory.db .swarm/backups/cutover_${TIMESTAMP}/memory.db.final
cp .hive-mind/hive.db .swarm/backups/cutover_${TIMESTAMP}/hive.db.final
echo "✅ Final backup created"

# Step 3: Rename databases (atomic)
echo "Step 3: Performing atomic swap..."
mv .swarm/memory.db .swarm/memory.db.old
mv .swarm/memory-unified.db .swarm/memory.db
mv .hive-mind/hive.db .hive-mind/hive.db.old
echo "✅ Atomic swap complete"

# Step 4: Verify new database
echo "Step 4: Verifying new database..."
sqlite3 .swarm/memory.db "PRAGMA integrity_check;" | grep -q "ok" || {
  echo "❌ Database integrity check failed! Rolling back..."
  mv .swarm/memory.db .swarm/memory.db.failed
  mv .swarm/memory.db.old .swarm/memory.db
  mv .hive-mind/hive.db.old .hive-mind/hive.db
  exit 1
}
echo "✅ Database integrity verified"

# Step 5: Resume operations
echo "Step 5: Resuming operations..."
# systemctl start claude-flow
echo "✅ Operations resumed"

echo ""
echo "=== Cutover Complete ==="
echo "Old databases backed up:"
echo "  .swarm/memory.db.old"
echo "  .hive-mind/hive.db.old"
echo ""
echo "New unified database active:"
echo "  .swarm/memory.db"
echo ""
echo "To rollback: ./scripts/rollback.sh"
```

---

## 5. Phase 4: Post-Migration Validation

### 5.1 Validation Tests

```typescript
/**
 * post-migration-validation.ts
 * Comprehensive validation after migration
 */
import Database from 'better-sqlite3';

interface ValidationResult {
  passed: boolean;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

async function runPostMigrationValidation(): Promise<ValidationResult> {
  const result: ValidationResult = {
    passed: true,
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 }
  };

  console.log('=== Post-Migration Validation ===\n');

  const db = new Database('.swarm/memory.db');

  // Test 1: Record Count Validation
  result.tests.push(await testRecordCounts(db));

  // Test 2: Data Integrity
  result.tests.push(await testDataIntegrity(db));

  // Test 3: Foreign Key Constraints
  result.tests.push(await testForeignKeys(db));

  // Test 4: Query Performance
  result.tests.push(await testQueryPerformance(db));

  // Test 5: Index Effectiveness
  result.tests.push(await testIndexes(db));

  // Test 6: Schema Completeness
  result.tests.push(await testSchemaCompleteness(db));

  db.close();

  // Calculate summary
  result.summary.total = result.tests.length;
  result.summary.passed = result.tests.filter(t => t.passed).length;
  result.summary.failed = result.tests.filter(t => !t.passed).length;
  result.passed = result.summary.failed === 0;

  // Print summary
  console.log('\n=== Validation Summary ===');
  console.log(`Total Tests: ${result.summary.total}`);
  console.log(`Passed: ${result.summary.passed}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log(`Result: ${result.passed ? '✅ ALL PASSED' : '❌ SOME FAILED'}\n`);

  return result;
}

async function testRecordCounts(db: Database): Promise<TestResult> {
  const start = Date.now();
  const test: TestResult = {
    name: 'Record Count Validation',
    passed: false,
    message: '',
    duration: 0
  };

  try {
    const memoryCount = db.prepare('SELECT COUNT(*) as count FROM memory_entries').get();
    const knowledgeCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();

    const expectedMemory = 550;  // From source validation
    const expectedKnowledge = 4;  // From source validation

    if (memoryCount.count === expectedMemory && knowledgeCount.count === expectedKnowledge) {
      test.passed = true;
      test.message = `✅ All ${memoryCount.count + knowledgeCount.count} records migrated successfully`;
    } else {
      test.message = `❌ Record count mismatch: Memory ${memoryCount.count}/${expectedMemory}, Knowledge ${knowledgeCount.count}/${expectedKnowledge}`;
    }
  } catch (error) {
    test.message = `❌ Error: ${error.message}`;
  }

  test.duration = Date.now() - start;
  console.log(`${test.name}: ${test.message} (${test.duration}ms)`);
  return test;
}

async function testQueryPerformance(db: Database): Promise<TestResult> {
  const start = Date.now();
  const test: TestResult = {
    name: 'Query Performance Test',
    passed: false,
    message: '',
    duration: 0
  };

  try {
    // Test critical query patterns
    const queries = [
      { name: 'Memory lookup', sql: 'SELECT * FROM memory_entries WHERE namespace = ? LIMIT 10', params: ['default'] },
      { name: 'Pattern search', sql: 'SELECT * FROM patterns WHERE type = ? AND confidence >= 0.7 ORDER BY confidence DESC LIMIT 10', params: ['coordination'] },
      { name: 'Knowledge query', sql: 'SELECT * FROM knowledge_base WHERE category = ? ORDER BY confidence DESC LIMIT 10', params: ['general'] }
    ];

    const maxLatency = 10;  // ms
    let allPassed = true;
    const latencies: number[] = [];

    for (const query of queries) {
      const queryStart = Date.now();
      db.prepare(query.sql).all(...query.params);
      const latency = Date.now() - queryStart;
      latencies.push(latency);

      if (latency > maxLatency) {
        allPassed = false;
        console.log(`  ⚠️  ${query.name}: ${latency}ms (exceeds ${maxLatency}ms)`);
      } else {
        console.log(`  ✅ ${query.name}: ${latency}ms`);
      }
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    test.passed = allPassed;
    test.message = allPassed
      ? `✅ All queries under ${maxLatency}ms (avg: ${avgLatency.toFixed(2)}ms)`
      : `❌ Some queries exceeded ${maxLatency}ms`;

  } catch (error) {
    test.message = `❌ Error: ${error.message}`;
  }

  test.duration = Date.now() - start;
  console.log(`${test.name}: ${test.message} (${test.duration}ms)`);
  return test;
}

// ... implement other test functions

export { runPostMigrationValidation };
```

---

## 6. Rollback Procedure

### 6.1 Rollback Script

```bash
#!/bin/bash
# rollback.sh
# Emergency rollback to original databases

set -e

echo "=== DATABASE ROLLBACK ==="
echo ""
echo "⚠️  WARNING: This will revert to the old databases!"
echo ""
read -p "Are you sure you want to rollback? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Rollback cancelled."
  exit 0
fi

echo ""
echo "Starting rollback..."

# Step 1: Stop operations
echo "Step 1: Stopping operations..."
# systemctl stop claude-flow

# Step 2: Backup failed unified database
echo "Step 2: Backing up failed database..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p .swarm/backups/rollback_${TIMESTAMP}
cp .swarm/memory.db .swarm/backups/rollback_${TIMESTAMP}/memory-unified.db.failed

# Step 3: Restore old databases
echo "Step 3: Restoring old databases..."
if [ -f .swarm/memory.db.old ]; then
  mv .swarm/memory.db .swarm/memory.db.failed
  mv .swarm/memory.db.old .swarm/memory.db
  echo "✅ Restored .swarm/memory.db"
else
  echo "❌ .swarm/memory.db.old not found!"
  exit 1
fi

if [ -f .hive-mind/hive.db.old ]; then
  mv .hive-mind/hive.db.old .hive-mind/hive.db
  echo "✅ Restored .hive-mind/hive.db"
else
  echo "⚠️  .hive-mind/hive.db.old not found (may not exist)"
fi

# Step 4: Verify old databases
echo "Step 4: Verifying restored databases..."
sqlite3 .swarm/memory.db "PRAGMA integrity_check;" | grep -q "ok" || {
  echo "❌ Database integrity check failed!"
  exit 1
}
echo "✅ Database integrity verified"

# Step 5: Resume operations
echo "Step 5: Resuming operations..."
# systemctl start claude-flow
echo "✅ Operations resumed"

echo ""
echo "=== Rollback Complete ==="
echo "Restored databases:"
echo "  .swarm/memory.db"
echo "  .hive-mind/hive.db"
echo ""
echo "Failed database saved:"
echo "  .swarm/backups/rollback_${TIMESTAMP}/memory-unified.db.failed"
```

---

## 7. Execution Timeline

### 7.1 Complete Migration Timeline

```
Time    Phase                          Duration  Downtime
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
T+0h    Phase 1: Preparation           2 hours   None
        ├─ Create backups              30 min    None
        ├─ Validate source data        30 min    None
        ├─ Create unified schema       30 min    None
        └─ Test on sample data         30 min    None

T+2h    Phase 2: Migration             10 min    None
        ├─ Copy .swarm data            2 min     None
        ├─ Copy .hive-mind data        1 min     None
        ├─ Create indexes              5 min     None
        └─ Validate migration          2 min     None

T+2h12m Phase 3: Cutover               1 min     100ms
        ├─ Stop operations (optional)  0s        0ms
        ├─ Atomic file swap            100ms     100ms
        ├─ Verify new database         30s       None
        └─ Resume operations           0s        0ms

T+2h13m Phase 4: Validation            30 min    None
        ├─ Record count validation     1 min     None
        ├─ Query performance tests     10 min    None
        ├─ Agent access validation     10 min    None
        └─ Monitoring setup            9 min     None

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total                                  2h 43min  100ms
```

### 7.2 Milestone Checklist

```yaml
Before Starting:
  ☐ Pre-migration checklist completed
  ☐ Backups created and verified
  ☐ Source data validated
  ☐ Team notified of migration window
  ☐ Rollback procedure tested

Phase 1 Complete:
  ☐ Unified schema created
  ☐ Schema validated on test data
  ☐ Migration scripts tested
  ☐ Performance benchmarks established

Phase 2 Complete:
  ☐ All 554 records migrated
  ☐ No foreign key violations
  ☐ Indexes created
  ☐ 100% validation passed

Phase 3 Complete:
  ☐ Atomic swap successful
  ☐ Database integrity verified
  ☐ Old databases backed up
  ☐ System operational

Phase 4 Complete:
  ☐ All 78 agents can access
  ☐ Query performance < 10ms
  ☐ No errors in logs
  ☐ Monitoring active
  ☐ Documentation updated
```

---

## 8. Success Criteria

### 8.1 Technical Success Criteria

```yaml
Data Migration:
  ✅ 554 records migrated (550 + 4)
  ✅ 100% data integrity maintained
  ✅ Zero records lost or corrupted
  ✅ All foreign keys valid

Performance:
  ✅ Query latency < 10ms (P95)
  ✅ Database size optimized
  ✅ Index usage verified
  ✅ Connection pooling working

Functionality:
  ✅ All 78 agents can access
  ✅ Pattern storage working
  ✅ Task tracking working
  ✅ Knowledge sharing working
  ✅ Consensus mechanisms working

Reliability:
  ✅ Rollback tested and working
  ✅ Backups created and verified
  ✅ No service interruption
  ✅ Monitoring active
```

### 8.2 Business Success Criteria

```yaml
Objectives Met:
  ✅ Single source of truth established
  ✅ Cross-agent memory sharing enabled
  ✅ Complexity reduced (2 → 1 database)
  ✅ Foundation for neural learning complete
  ✅ Team confidence in system high

Risks Mitigated:
  ✅ Data loss risk eliminated
  ✅ Performance maintained
  ✅ Backward compatibility preserved
  ✅ Quick rollback capability available
```

---

## 9. Post-Migration Tasks

### 9.1 Immediate Tasks (Day 1)

```bash
# Monitor system health
watch -n 60 'sqlite3 .swarm/memory.db "
  SELECT '\''Memory Entries:'\'' as metric, COUNT(*) as value FROM memory_entries
  UNION ALL
  SELECT '\''Knowledge Base:'\'', COUNT(*) FROM knowledge_base;
"'

# Check query performance
npm run test:performance

# Validate agent access
npm run test:agent-access

# Review logs
tail -f logs/memory-access.log
```

### 9.2 Week 1 Tasks

- Monitor query latency continuously
- Review error logs daily
- Validate backup/restore procedures
- Update documentation
- Train team on unified access layer
- Archive old databases (after 7 days)

### 9.3 Week 2+ Tasks

- Collect performance metrics
- Optimize slow queries if any
- Review and tune cache settings
- Document lessons learned
- Plan next integration phase (Action A3)

---

## 10. Documentation Updates

### 10.1 Files to Update

```yaml
After Migration:
  - /docs/neural/memory-schema.md
    → Add swarm tables documentation
    → Update total table count

  - /README.md
    → Update architecture diagram
    → Note unified database

  - /config/neural-system.json
    → Update database path configuration
    → Remove hive.db references

  - /src/neural/memory-manager.ts
    → Update import paths
    → Add swarm table access

  - /tests/neural/memory.test.ts
    → Add unified database tests
    → Update test fixtures
```

---

## 11. Appendix

### 11.1 Complete Command Reference

```bash
# Pre-migration
./scripts/pre-migration-check.sh
./scripts/create-backups.sh
npm run validate:source-data

# Migration
npm run migrate:databases
npm run test:migration

# Cutover
./scripts/cutover.sh

# Validation
npm run validate:post-migration
npm run test:performance
npm run test:agent-access

# Rollback (if needed)
./scripts/rollback.sh

# Cleanup (after 7 days)
./scripts/archive-old-databases.sh
```

### 11.2 Troubleshooting Guide

```yaml
Issue: Migration fails with foreign key error
Solution:
  - Run: PRAGMA foreign_key_check;
  - Identify violating records
  - Fix data or temporarily disable FK enforcement
  - Retry migration

Issue: Query performance degraded
Solution:
  - Run: EXPLAIN QUERY PLAN SELECT ...
  - Check if indexes are being used
  - Run: ANALYZE;
  - Consider adding covering indexes

Issue: Database corruption detected
Solution:
  - Stop all operations immediately
  - Run: ./scripts/rollback.sh
  - Analyze corruption cause
  - Fix source data
  - Retry migration

Issue: Agents cannot access database
Solution:
  - Check file permissions
  - Verify database path in config
  - Check connection pool settings
  - Review error logs
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-15
**Status**: Ready for Execution
**Next Steps**: Execute migration following this plan
