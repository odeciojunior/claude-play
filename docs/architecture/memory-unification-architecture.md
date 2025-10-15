# Memory Unification Architecture
## System Architecture for Unified Memory System

**Version**: 1.0.0
**Date**: 2025-10-15
**Status**: Design Phase
**Action**: A2 - Unify Memory Systems

---

## 1. Executive Summary

### 1.1 Problem Statement

Currently, the system maintains two separate memory databases:

1. **.swarm/memory.db** - Neural learning system with 8 tables, 550 active memory entries
2. **.hive-mind/hive.db** - Swarm coordination system with 8 tables, 4 knowledge base entries

This separation creates:
- **Data silos**: Agents cannot share patterns across systems
- **Duplication**: Similar data structures in both databases
- **Complexity**: Dual access patterns and synchronization issues
- **Performance overhead**: Multiple database connections and queries
- **Consistency challenges**: No unified view of system state

### 1.2 Solution Overview

Unify both databases into a single **`.swarm/memory.db`** with:
- **Zero data loss**: 100% migration of all 554 records
- **Unified schema**: Single coherent design supporting all use cases
- **Backward compatibility**: Existing code continues to work
- **Enhanced performance**: Single connection pool, optimized indexes
- **Cross-agent sharing**: All 78 agents access unified memory

### 1.3 Success Criteria

- ✅ 100% data migration with zero loss
- ✅ <10ms query performance maintained
- ✅ All 78 agents can read/write to unified memory
- ✅ Backward compatibility preserved
- ✅ Rollback capability available

---

## 2. Current State Analysis

### 2.1 Database Inventory

#### .swarm/memory.db (Neural Learning)
```
Total Size: 278 KB + 4.1 MB WAL
Records: 550 memory_entries
Tables: 8 (1 active, 7 empty schemas)

Active Tables:
- memory_entries: 550 records (namespaces, TTL, access tracking)

Schema Tables (empty, ready for learning):
- patterns: 0 records
- pattern_embeddings: 0 records
- pattern_links: 0 records
- task_trajectories: 0 records
- matts_runs: 0 records
- consolidation_runs: 0 records
- metrics_log: 0 records

Purpose: Neural learning, pattern storage, episodic memory
```

#### .hive-mind/hive.db (Swarm Coordination)
```
Total Size: 126 KB
Records: 4 knowledge_base entries
Tables: 8 (1 active, 7 empty)

Active Tables:
- knowledge_base: 4 records (swarm knowledge)

Schema Tables (empty):
- swarms: 0 records
- agents: 0 records
- tasks: 0 records
- messages: 0 records
- consensus_votes: 0 records
- performance_metrics: 0 records
- sessions: 0 records

Purpose: Swarm coordination, agent tracking, consensus
```

### 2.2 Data Overlap Analysis

| Feature | .swarm/memory.db | .hive-mind/hive.db | Unified Approach |
|---------|------------------|---------------------|------------------|
| **Memory Storage** | memory_entries (550) | - | Keep in .swarm |
| **Knowledge** | - | knowledge_base (4) | Migrate to .swarm |
| **Pattern Learning** | patterns, embeddings | - | Keep in .swarm |
| **Agent Tracking** | - | agents | Add to .swarm |
| **Swarm Coordination** | - | swarms, tasks | Add to .swarm |
| **Performance Metrics** | metrics_log | performance_metrics | Merge schemas |
| **Consensus** | - | consensus_votes | Add to .swarm |

### 2.3 Schema Comparison

#### Common Patterns
Both databases use:
- TEXT PRIMARY KEY for IDs
- DATETIME/TEXT timestamps
- JSON in TEXT columns for metadata
- Foreign key relationships
- Status tracking fields

#### Differences
- **Timestamps**: .swarm uses `strftime('%s')` (unix), hive uses `CURRENT_TIMESTAMP` (ISO)
- **Defaults**: .swarm has explicit defaults, hive uses DEFAULT keyword
- **Metadata**: .swarm uses optional metadata, hive always includes it

---

## 3. Unified Architecture Design

### 3.1 Schema Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Unified .swarm/memory.db                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │         NEURAL LEARNING LAYER (Tier 1-4)           │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ • memory_entries (working memory, context)         │     │
│  │ • patterns (semantic memory)                        │     │
│  │ • pattern_embeddings (vector memory)               │     │
│  │ • pattern_links (knowledge graph)                  │     │
│  │ • task_trajectories (episodic memory)              │     │
│  │ • matts_runs (learning runs)                       │     │
│  │ • consolidation_runs (optimization)                │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │         SWARM COORDINATION LAYER                    │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ • swarms (swarm instances)                         │     │
│  │ • agents (agent registry, 78 agents)               │     │
│  │ • tasks (task tracking)                            │     │
│  │ • messages (inter-agent communication)             │     │
│  │ • consensus_votes (Byzantine consensus)            │     │
│  │ • sessions (swarm sessions)                        │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │         UNIFIED KNOWLEDGE LAYER                     │     │
│  ├────────────────────────────────────────────────────┤     │
│  │ • knowledge_base (shared knowledge, patterns)      │     │
│  │ • performance_metrics (unified metrics)            │     │
│  │ • schema_version (migration tracking)              │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Total Tables: 17 (8 from .swarm + 8 from hive + 1 new)
```

### 3.2 Logical Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    78 Agent Processes                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              Unified Memory Access Layer                      │
│  ┌────────────────────────────────────────────────────┐      │
│  │ • Connection pooling (max 10 connections)          │      │
│  │ • Transaction management                            │      │
│  │ • Query optimization                                │      │
│  │ • Cache coordination (L1, L2, L3)                  │      │
│  │ • Lock management (row-level)                      │      │
│  └────────────────────────────────────────────────────┘      │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              Single .swarm/memory.db                          │
│  WAL Mode | 64MB Cache | Memory-Mapped I/O | Auto-Vacuum     │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Unified Schema Design

### 4.1 Core Schema (Memory + Patterns)

*Existing tables from .swarm/memory.db - no changes needed*

```sql
-- Already defined in memory-schema.md
-- memory_entries, patterns, pattern_embeddings, pattern_links
-- task_trajectories, matts_runs, consolidation_runs, metrics_log
```

### 4.2 Swarm Coordination Schema (Migrated from hive.db)

#### Table: swarms
```sql
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
  -- Additional fields for unified system
  learning_enabled BOOLEAN DEFAULT 1,
  pattern_sharing BOOLEAN DEFAULT 1,
  coordination_efficiency REAL DEFAULT 0.70
);

CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_swarms_topology ON swarms(topology);
CREATE INDEX idx_swarms_created_at ON swarms(created_at DESC);
```

#### Table: agents
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- Matches 78 agent types
  role TEXT,           -- coordinator, worker, specialist
  capabilities TEXT DEFAULT '[]',  -- JSON array
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'idle', 'busy', 'paused', 'offline')),
  performance_score REAL DEFAULT 0.5 CHECK(performance_score >= 0 AND performance_score <= 1),
  task_count INTEGER DEFAULT 0 CHECK(task_count >= 0),
  success_rate REAL DEFAULT 1.0 CHECK(success_rate >= 0 AND success_rate <= 1),
  last_active TEXT DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}',
  -- Additional fields for neural integration
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
```

#### Table: tasks
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  agent_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 3 CHECK(priority >= 1 AND priority <= 5),
  complexity REAL DEFAULT 0.5 CHECK(complexity >= 0 AND complexity <= 1),
  estimated_time INTEGER,  -- seconds
  actual_time INTEGER,     -- seconds
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  metadata TEXT DEFAULT '{}',
  -- Link to learning system
  trajectory_id TEXT,  -- Links to task_trajectories
  pattern_ids TEXT DEFAULT '[]',  -- JSON array of patterns used
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
```

#### Table: messages
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  sender_id TEXT,
  recipient_id TEXT,
  channel TEXT DEFAULT 'general',
  type TEXT DEFAULT 'info' CHECK(type IN ('info', 'command', 'query', 'response', 'alert')),
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 3 CHECK(priority >= 1 AND priority <= 5),
  consensus_vote REAL,  -- For consensus messages
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
```

#### Table: consensus_votes
```sql
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
```

#### Table: sessions
```sql
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
  checkpoint_data TEXT,  -- JSON snapshot
  metadata TEXT,
  parent_pid INTEGER,
  child_pids TEXT,  -- JSON array
  FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_swarm_id ON sessions(swarm_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
```

### 4.3 Unified Knowledge Schema

#### Table: knowledge_base (Enhanced)
```sql
CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  category TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',  -- JSON array
  confidence REAL DEFAULT 0.5 CHECK(confidence >= 0 AND confidence <= 1),
  source_agent_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  access_count INTEGER DEFAULT 0,
  -- Link to pattern system
  pattern_id TEXT,  -- Optional link to patterns table
  embedding_id TEXT,  -- Optional link to pattern_embeddings
  FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE SET NULL,
  FOREIGN KEY (source_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE SET NULL,
  FOREIGN KEY (embedding_id) REFERENCES pattern_embeddings(id) ON DELETE SET NULL
);

CREATE INDEX idx_knowledge_base_swarm_id ON knowledge_base(swarm_id);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_base_confidence ON knowledge_base(confidence DESC);
CREATE INDEX idx_knowledge_base_pattern ON knowledge_base(pattern_id);
```

#### Table: performance_metrics (Unified)
```sql
CREATE TABLE performance_metrics (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('agent', 'swarm', 'task', 'pattern', 'system')),
  entity_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  unit TEXT,  -- 'ms', 'bytes', 'percent', 'count'
  tags TEXT DEFAULT '{}',  -- JSON for dimensions
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_performance_metrics_entity ON performance_metrics(entity_type, entity_id);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX idx_performance_metrics_name_timestamp ON performance_metrics(metric_name, timestamp DESC);
```

#### Table: schema_version (New)
```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  migration_script TEXT,  -- SQL commands executed
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_by TEXT DEFAULT 'system'
);

-- Initial version
INSERT INTO schema_version (version, description)
VALUES (1, 'Unified memory system - initial migration from .swarm + .hive-mind');
```

---

## 5. Migration Strategy

### 5.1 Migration Architecture

```
Phase 1: Preparation (Zero Downtime)
┌────────────────────────────────────────┐
│ 1. Create backup of both databases     │
│ 2. Validate data integrity             │
│ 3. Create unified schema in new DB     │
│ 4. Test unified schema                 │
└────────────────────────────────────────┘

Phase 2: Data Migration (Brief Lock)
┌────────────────────────────────────────┐
│ 1. Copy .swarm/memory.db → new DB     │
│ 2. Migrate hive.db data → new DB      │
│ 3. Validate 100% migration             │
│ 4. Create indexes                      │
└────────────────────────────────────────┘

Phase 3: Cutover (Atomic Swap)
┌────────────────────────────────────────┐
│ 1. Stop all write operations          │
│ 2. Rename old .swarm/memory.db        │
│ 3. Rename new DB → .swarm/memory.db   │
│ 4. Resume operations                   │
│ 5. Monitor for issues                  │
└────────────────────────────────────────┘

Phase 4: Validation & Cleanup
┌────────────────────────────────────────┐
│ 1. Verify all queries work             │
│ 2. Check performance (<10ms)           │
│ 3. Validate agent access (78 agents)   │
│ 4. Archive old databases               │
└────────────────────────────────────────┘
```

### 5.2 Data Mapping

| Source | Destination | Records | Transformation |
|--------|-------------|---------|----------------|
| `.swarm/memory_entries` | `memory_entries` | 550 | Direct copy |
| `.hive-mind/knowledge_base` | `knowledge_base` | 4 | Direct copy |
| `.hive-mind/swarms` | `swarms` | 0 | Schema only |
| `.hive-mind/agents` | `agents` | 0 | Schema only |
| `.hive-mind/tasks` | `tasks` | 0 | Schema only |
| `.hive-mind/messages` | `messages` | 0 | Schema only |
| `.hive-mind/consensus_votes` | `consensus_votes` | 0 | Schema only |
| `.hive-mind/performance_metrics` | `performance_metrics` | 0 | Schema only |
| `.hive-mind/sessions` | `sessions` | 0 | Schema only |

**Total Records to Migrate**: 554 (550 + 4)

### 5.3 Rollback Plan

```sql
-- Rollback procedure
-- 1. Stop all operations
-- 2. Restore from backups

-- Restore .swarm/memory.db
cp .swarm/memory.db.backup.2025-10-15 .swarm/memory.db

-- Restore .hive-mind/hive.db
cp .hive-mind/hive.db.backup.2025-10-15 .hive-mind/hive.db

-- 3. Restart services
-- 4. Validate data
-- 5. Analyze failure cause
```

---

## 6. Performance Optimization

### 6.1 Database Configuration

```sql
-- Optimal settings for unified database
PRAGMA journal_mode = WAL;              -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;            -- Balance safety/speed
PRAGMA cache_size = -64000;             -- 64MB cache
PRAGMA temp_store = MEMORY;             -- RAM for temp tables
PRAGMA mmap_size = 268435456;           -- 256MB memory-mapped I/O
PRAGMA page_size = 4096;                -- Optimal page size
PRAGMA auto_vacuum = INCREMENTAL;       -- Reclaim space gradually
PRAGMA wal_autocheckpoint = 1000;       -- Checkpoint every 1000 pages
PRAGMA busy_timeout = 5000;             -- 5 second timeout
PRAGMA foreign_keys = ON;               -- Enforce FK constraints
```

### 6.2 Query Optimization

#### Critical Query Patterns

```sql
-- 1. Agent pattern retrieval (most frequent)
-- Expected: <5ms
SELECT p.id, p.pattern_data, p.confidence
FROM patterns p
WHERE p.type = ?
  AND p.confidence >= 0.7
ORDER BY p.confidence DESC, p.usage_count DESC
LIMIT 10;

-- Optimized with: idx_patterns_type, idx_patterns_confidence

-- 2. Cross-system knowledge lookup
-- Expected: <10ms
SELECT
  kb.title,
  kb.content,
  kb.confidence,
  p.pattern_data,
  a.name as agent_name
FROM knowledge_base kb
LEFT JOIN patterns p ON kb.pattern_id = p.id
LEFT JOIN agents a ON kb.source_agent_id = a.id
WHERE kb.swarm_id = ?
  AND kb.category = ?
ORDER BY kb.confidence DESC;

-- 3. Agent task history with learning
-- Expected: <15ms
SELECT
  t.name,
  t.status,
  t.actual_time,
  tt.judge_label,
  tt.judge_conf,
  a.performance_score
FROM tasks t
JOIN agents a ON t.agent_id = a.id
LEFT JOIN task_trajectories tt ON t.trajectory_id = tt.task_id
WHERE t.agent_id = ?
  AND t.status = 'completed'
ORDER BY t.completed_at DESC
LIMIT 20;
```

### 6.3 Index Strategy

**Total Indexes**: 40+

- **Neural Layer**: 12 indexes (patterns, embeddings, trajectories)
- **Swarm Layer**: 18 indexes (agents, tasks, messages)
- **Knowledge Layer**: 10 indexes (knowledge_base, metrics)

**Covering Indexes** for hot paths:
```sql
-- Covering index for agent status queries
CREATE INDEX idx_agents_status_coverage
ON agents(status, id, name, type, performance_score);

-- Covering index for task queries
CREATE INDEX idx_tasks_agent_status_coverage
ON tasks(agent_id, status, completed_at, id, name);
```

---

## 7. Access Layer Architecture

### 7.1 Unified Memory Manager

```typescript
/**
 * Unified Memory Manager
 * Single interface for all memory operations
 */
class UnifiedMemoryManager {
  private db: Database;
  private connectionPool: ConnectionPool;
  private cache: MultiLevelCache;

  // Neural Learning Operations
  async storePattern(pattern: Pattern): Promise<void>;
  async getPatterns(filter: PatternFilter): Promise<Pattern[]>;
  async storeTrajectory(trajectory: Trajectory): Promise<void>;

  // Swarm Coordination Operations
  async registerAgent(agent: Agent): Promise<void>;
  async assignTask(task: Task, agentId: string): Promise<void>;
  async recordMessage(message: Message): Promise<void>;

  // Knowledge Operations
  async storeKnowledge(knowledge: Knowledge): Promise<void>;
  async queryKnowledge(query: string): Promise<Knowledge[]>;

  // Unified Queries
  async getAgentPatternsAndTasks(agentId: string): Promise<AgentMemoryView>;
  async getSwarmIntelligence(swarmId: string): Promise<SwarmIntelligence>;

  // Transaction Support
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}
```

### 7.2 Connection Pooling

```typescript
/**
 * Connection Pool Configuration
 */
const poolConfig = {
  maxConnections: 10,        // Max concurrent connections
  minConnections: 2,         // Keep-alive connections
  acquireTimeout: 5000,      // 5 second timeout
  idleTimeout: 60000,        // 1 minute idle timeout
  statementCache: true,      // Cache prepared statements
  busyTimeout: 5000          // SQLite busy timeout
};
```

### 7.3 Caching Strategy

```typescript
/**
 * Three-tier cache hierarchy
 */
class MultiLevelCache {
  // L1: Hot data (100ms TTL)
  private l1Cache = new Map<string, any>();

  // L2: Warm data (30min TTL)
  private l2Cache = new LRUCache<string, any>(1000);

  // L3: Cold data (session TTL)
  private l3Cache = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.l1Cache.get(key)
      || this.l2Cache.get(key)
      || this.l3Cache.get(key)
      || null;
  }
}
```

---

## 8. Agent Integration

### 8.1 Agent Registration

```typescript
/**
 * Register all 78 agents in unified system
 */
async function registerAllAgents() {
  const agents = [
    // Core agents
    { type: 'goal-planner', capabilities: ['goap', 'a-star', 'planning'] },
    { type: 'safla-neural', capabilities: ['learning', 'patterns', 'memory'] },
    { type: 'coder', capabilities: ['implementation', 'refactoring'] },
    // ... 75 more agents
  ];

  for (const agent of agents) {
    await memoryManager.registerAgent({
      id: generateAgentId(agent.type),
      name: agent.type,
      type: agent.type,
      capabilities: JSON.stringify(agent.capabilities),
      learning_enabled: true,
      pattern_sharing: true
    });
  }
}
```

### 8.2 Cross-Agent Memory Access

```typescript
/**
 * Agents can access each other's patterns
 */
async function sharePatternsBetweenAgents(
  sourceAgentId: string,
  targetAgentIds: string[],
  pattern: Pattern
) {
  // Store pattern with source agent
  await memoryManager.storePattern({
    ...pattern,
    metadata: {
      ...pattern.metadata,
      source_agent_id: sourceAgentId,
      shared_with: targetAgentIds
    }
  });

  // Create pattern links for each target agent
  for (const targetId of targetAgentIds) {
    await memoryManager.storePatternLink({
      src_id: pattern.id,
      dst_id: targetId,
      relation: 'shared_with',
      weight: 1.0
    });
  }
}
```

---

## 9. Monitoring & Observability

### 9.1 Health Metrics

```typescript
interface UnifiedMemoryHealth {
  // Database metrics
  totalSize: number;           // bytes
  walSize: number;             // bytes
  connectionCount: number;
  queryLatencyP50: number;     // ms
  queryLatencyP95: number;     // ms
  queryLatencyP99: number;     // ms

  // Data metrics
  totalRecords: number;
  patternsCount: number;
  agentsCount: number;
  tasksCount: number;
  knowledgeCount: number;

  // Performance metrics
  cacheHitRate: number;        // percentage
  queryPerSecond: number;
  transactionPerSecond: number;

  // Health status
  status: 'healthy' | 'degraded' | 'critical';
  issues: string[];
}
```

### 9.2 Monitoring Dashboard

```sql
-- Real-time health check query
SELECT
  'Database Size' as metric,
  ROUND((page_count * page_size) / 1024.0 / 1024.0, 2) || ' MB' as value
FROM pragma_page_count(), pragma_page_size()
UNION ALL
SELECT
  'Total Patterns',
  COUNT(*) || ' patterns'
FROM patterns
UNION ALL
SELECT
  'Active Agents',
  COUNT(*) || ' agents'
FROM agents WHERE status = 'active'
UNION ALL
SELECT
  'Recent Tasks (24h)',
  COUNT(*) || ' tasks'
FROM tasks WHERE created_at >= datetime('now', '-1 day');
```

---

## 10. Testing Strategy

### 10.1 Test Categories

```yaml
Unit Tests:
  - Schema validation
  - Migration functions
  - Query correctness
  - Transaction isolation

Integration Tests:
  - End-to-end migration
  - Cross-table queries
  - Foreign key constraints
  - Concurrent access

Performance Tests:
  - Query latency (<10ms)
  - Write throughput (>1000 ops/s)
  - Concurrent connections (10+)
  - Cache efficiency (>80% hit rate)

Stress Tests:
  - 78 agents simultaneous access
  - 10,000 concurrent queries
  - 100,000 pattern inserts
  - Database size growth (up to 1GB)
```

### 10.2 Validation Criteria

```typescript
const validationCriteria = {
  // Data integrity
  recordCountMatch: true,      // All records migrated
  foreignKeysValid: true,      // All FK constraints valid
  dataTypesCorrect: true,      // No data corruption

  // Performance
  queryLatency: { max: 10, unit: 'ms' },
  cacheHitRate: { min: 0.80, unit: 'ratio' },
  throughput: { min: 1000, unit: 'ops/s' },

  // Functionality
  agentAccessWorks: true,      // All 78 agents can access
  learningEnabled: true,       // Pattern learning works
  coordinationWorks: true,     // Swarm coordination works

  // Backward compatibility
  existingQueriesWork: true,   // Old queries still work
  existingCodeWorks: true      // No breaking changes
};
```

---

## 11. Risk Analysis

### 11.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Data loss during migration** | Low | Critical | Full backups, validation, rollback plan |
| **Performance degradation** | Medium | High | Extensive performance testing, optimization |
| **Backward compatibility break** | Low | High | Compatibility layer, thorough testing |
| **Foreign key violations** | Medium | Medium | Validation scripts, constraint testing |
| **Concurrent access issues** | Medium | Medium | Connection pooling, transaction management |
| **Cache inconsistency** | Low | Medium | Cache invalidation strategy |

### 11.2 Mitigation Strategies

```yaml
Pre-Migration:
  - Full database backups (.swarm + .hive-mind)
  - Checksum validation
  - Test migration on copy
  - Performance baseline

During Migration:
  - Brief write lock (< 100ms)
  - Atomic file swap
  - Real-time monitoring
  - Abort on first error

Post-Migration:
  - 100% validation of records
  - Performance verification
  - Agent access testing
  - Keep old databases for 7 days

Rollback Ready:
  - One-command rollback
  - < 5 minute downtime
  - No data loss
  - Automated recovery
```

---

## 12. Timeline & Milestones

### 12.1 Implementation Timeline

```
Week 1: Schema Design & Validation
├─ Day 1-2: Finalize unified schema
├─ Day 3-4: Create migration scripts
└─ Day 5: Test on sample data

Week 2: Migration & Integration
├─ Day 1-2: Full migration implementation
├─ Day 3: Access layer development
├─ Day 4: Testing and validation
└─ Day 5: Performance optimization
```

### 12.2 Milestones

| Milestone | Deliverable | Success Criteria |
|-----------|-------------|------------------|
| M1: Schema Complete | Unified schema SQL | All tables defined, reviewed |
| M2: Migration Script | migration.ts | 100% test data migrated |
| M3: Access Layer | UnifiedMemoryManager | All CRUD operations work |
| M4: Performance | Benchmarks | <10ms queries, >1000 ops/s |
| M5: Production | Live cutover | Zero data loss, all agents work |

---

## 13. Success Metrics

### 13.1 Quantitative Metrics

```yaml
Data Integrity:
  - Records migrated: 554 / 554 (100%)
  - Data validation: PASS
  - Foreign keys: 0 violations
  - Checksums: Match

Performance:
  - Query latency P50: < 5ms
  - Query latency P95: < 10ms
  - Query latency P99: < 15ms
  - Cache hit rate: > 80%
  - Throughput: > 1000 ops/s

Functionality:
  - Agent registration: 78 / 78 (100%)
  - Pattern storage: Working
  - Task tracking: Working
  - Knowledge sharing: Working
  - Consensus: Working

Reliability:
  - Uptime: 99.9%+
  - Failed queries: < 0.1%
  - Rollback tested: Success
```

### 13.2 Qualitative Metrics

- ✅ Developer experience: Simplified codebase
- ✅ Maintainability: Single source of truth
- ✅ Scalability: Ready for 100+ agents
- ✅ Documentation: Complete and accurate
- ✅ Team confidence: High

---

## 14. Next Steps

### 14.1 Immediate Actions

1. **Review this architecture** with team
2. **Approve unified schema** design
3. **Create migration scripts** (next document)
4. **Set up test environment** with sample data
5. **Begin implementation** following SPARC methodology

### 14.2 Future Enhancements

```yaml
Phase 2 (Post-Migration):
  - Add vector similarity search (FAISS integration)
  - Implement distributed caching (Redis)
  - Add real-time replication (master-slave)
  - Create analytics dashboard
  - Add machine learning query optimization

Phase 3 (Scalability):
  - Horizontal sharding by agent_id
  - Read replicas for query load
  - Time-series data archival
  - Compression for old data
  - Cloud backup integration
```

---

## 15. Conclusion

This unified memory architecture provides:

1. **Single source of truth**: One database for all system memory
2. **Zero data loss**: 100% migration with validation
3. **Enhanced performance**: Optimized indexes and caching
4. **Cross-agent intelligence**: All 78 agents share knowledge
5. **Future-proof design**: Scalable to 100+ agents

**Total Cost**: 20 development hours (as estimated in action-plan.md)
**Risk Level**: Low (comprehensive mitigation)
**Impact**: High (enables full system integration)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-15
**Status**: Ready for Implementation
**Next Document**: `/docs/architecture/memory-migration-plan.md`
