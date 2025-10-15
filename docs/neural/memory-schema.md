# SAFLA Neural Memory Schema Documentation

## Overview

This document provides detailed specifications for the SAFLA Neural memory architecture, including database schemas, data structures, and access patterns. The system uses a SQLite database (`.swarm/memory.db`) with four logical memory tiers implemented across multiple tables.

## Database Schema

### Table: `patterns`

Stores learned patterns with metadata and confidence scores.

```sql
CREATE TABLE patterns (
  id TEXT PRIMARY KEY,                    -- UUID v4
  type TEXT NOT NULL,                     -- Pattern category
  pattern_data TEXT NOT NULL,             -- JSON structure (compressed)
  confidence REAL NOT NULL DEFAULT 0.5,   -- Confidence score [0.0, 1.0]
  usage_count INTEGER NOT NULL DEFAULT 0, -- Number of times applied
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used TEXT,                         -- ISO 8601 timestamp
  metadata TEXT                           -- JSON for extensibility
);

-- Indices for performance
CREATE INDEX idx_patterns_type ON patterns(type);
CREATE INDEX idx_patterns_confidence ON patterns(confidence DESC);
CREATE INDEX idx_patterns_created_at ON patterns(created_at DESC);
CREATE INDEX idx_patterns_last_used ON patterns(last_used DESC);
CREATE INDEX idx_patterns_usage ON patterns(usage_count DESC);
```

**Pattern Types:**
- `coordination` - Agent coordination strategies
- `optimization` - Performance optimization patterns
- `error-handling` - Error recovery strategies
- `domain-specific` - Domain knowledge patterns
- `refactoring` - Code refactoring patterns
- `testing` - Test generation strategies
- `documentation` - Documentation patterns

**Pattern Data Structure:**
```json
{
  "id": "pattern-uuid-1234",
  "type": "coordination",
  "name": "parallel_file_read",
  "description": "Read multiple independent files in parallel",
  "version": "1.0",
  "conditions": {
    "file_count": {"min": 2, "max": 10},
    "has_dependencies": false,
    "total_size_mb": {"max": 100}
  },
  "preconditions": [
    "files exist",
    "read permissions available",
    "no file locks"
  ],
  "actions": [
    {
      "step": 1,
      "type": "parallel_execution",
      "tool": "Read",
      "max_concurrent": 5,
      "timeout_ms": 30000,
      "retry_policy": {
        "max_retries": 3,
        "backoff_ms": 1000
      }
    }
  ],
  "success_criteria": {
    "min_completion_rate": 0.9,
    "max_error_rate": 0.1,
    "max_duration_ms": 60000
  },
  "metrics": {
    "success_count": 45,
    "failure_count": 3,
    "partial_count": 2,
    "avg_duration_ms": 2340,
    "avg_improvement": 0.67,
    "last_success": "2025-10-15T10:30:00Z",
    "last_failure": "2025-10-10T08:15:00Z"
  },
  "context": {
    "tags": ["parallel", "file-io", "optimization"],
    "related_patterns": ["pattern-uuid-5678"],
    "source": "auto-learned",
    "verified_by": null
  }
}
```

### Table: `pattern_embeddings`

Stores vector embeddings for semantic pattern search.

```sql
CREATE TABLE pattern_embeddings (
  id TEXT PRIMARY KEY,              -- References patterns.id
  model TEXT NOT NULL,              -- Embedding model name
  dims INTEGER NOT NULL,            -- Vector dimensions
  vector BLOB NOT NULL,             -- Serialized vector (float32 or int8)
  compressed BOOLEAN DEFAULT FALSE, -- Whether vector is quantized
  min_val REAL,                     -- For dequantization
  max_val REAL,                     -- For dequantization
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Index for model-specific queries
CREATE INDEX idx_embeddings_model ON pattern_embeddings(model);
```

**Vector Serialization:**
```typescript
// Uncompressed: float32 array
function serializeVector(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer);
}

// Compressed: int8 array with metadata
function serializeCompressedVector(vector: Float32Array): {
  data: Buffer,
  min: number,
  max: number
} {
  const min = Math.min(...vector);
  const max = Math.max(...vector);
  const quantized = quantizeVector(vector);

  return {
    data: Buffer.from(quantized.buffer),
    min,
    max
  };
}
```

**Embedding Models:**
- `text-embedding-3-small` - 1536 dimensions (default)
- `text-embedding-3-large` - 3072 dimensions (high precision)
- `custom-minilm` - 384 dimensions (fast)

### Table: `pattern_links`

Stores relationships between patterns.

```sql
CREATE TABLE pattern_links (
  src_id TEXT NOT NULL,
  dst_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,                    -- JSON for additional context
  PRIMARY KEY (src_id, dst_id, relation),
  FOREIGN KEY (src_id) REFERENCES patterns(id) ON DELETE CASCADE,
  FOREIGN KEY (dst_id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Index for graph traversal
CREATE INDEX idx_pattern_links_src ON pattern_links(src_id);
CREATE INDEX idx_pattern_links_dst ON pattern_links(dst_id);
CREATE INDEX idx_pattern_links_relation ON pattern_links(relation);
```

**Relation Types:**
- `depends_on` - Pattern requires another pattern
- `conflicts_with` - Patterns are mutually exclusive
- `enhances` - Pattern improves another pattern
- `replaces` - Pattern supersedes another pattern
- `similar_to` - Patterns are semantically similar
- `follows` - Pattern typically follows another
- `precedes` - Pattern typically precedes another

**Link Weight Interpretation:**
- `0.0-0.3` - Weak relationship
- `0.3-0.7` - Moderate relationship
- `0.7-1.0` - Strong relationship

### Table: `task_trajectories`

Stores complete execution traces for episodic memory.

```sql
CREATE TABLE task_trajectories (
  task_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  query TEXT NOT NULL,
  trajectory_json TEXT NOT NULL,    -- Compressed JSON
  started_at TEXT,
  ended_at TEXT,
  duration_ms INTEGER,              -- Computed from started_at/ended_at
  judge_label TEXT,                 -- success|failure|partial
  judge_conf REAL,                  -- Confidence [0.0, 1.0]
  judge_reasons TEXT,               -- JSON array of reason strings
  matts_run_id TEXT,
  token_count INTEGER,
  tool_calls_count INTEGER,
  error_count INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matts_run_id) REFERENCES matts_runs(run_id)
);

-- Indices for querying
CREATE INDEX idx_trajectories_agent ON task_trajectories(agent_id);
CREATE INDEX idx_trajectories_label ON task_trajectories(judge_label);
CREATE INDEX idx_trajectories_started ON task_trajectories(started_at DESC);
CREATE INDEX idx_trajectories_duration ON task_trajectories(duration_ms);
```

**Trajectory JSON Structure:**
```json
{
  "task_id": "task-uuid-1234",
  "agent_id": "neural-coordinator",
  "query": "Implement authentication system",
  "context": {
    "working_directory": "/home/user/project",
    "git_branch": "feature/auth",
    "environment": "development"
  },
  "steps": [
    {
      "step_number": 1,
      "timestamp": "2025-10-15T10:30:00.123Z",
      "tool": "Read",
      "parameters": {
        "file_path": "/home/user/project/src/auth.ts"
      },
      "result": {
        "success": true,
        "data": "file contents...",
        "lines_read": 234
      },
      "duration_ms": 45,
      "tokens_used": 1234,
      "pattern_applied": "pattern-uuid-5678",
      "confidence": 0.85
    },
    {
      "step_number": 2,
      "timestamp": "2025-10-15T10:30:01.456Z",
      "tool": "Edit",
      "parameters": {
        "file_path": "/home/user/project/src/auth.ts",
        "old_string": "...",
        "new_string": "..."
      },
      "result": {
        "success": true
      },
      "duration_ms": 234,
      "tokens_used": 2345
    }
  ],
  "outcome": {
    "status": "success",
    "confidence": 0.95,
    "completion_rate": 1.0,
    "metrics": {
      "total_duration_ms": 5230,
      "steps_count": 12,
      "errors_count": 0,
      "retries_count": 1,
      "tokens_total": 45678,
      "tools_used": ["Read", "Edit", "Grep", "Bash"]
    },
    "verification": {
      "tests_passed": true,
      "code_quality_score": 0.89,
      "security_score": 0.92
    }
  }
}
```

**Compression Strategy:**
```typescript
// Compress trajectory before storage
function compressTrajectory(trajectory: Trajectory): string {
  const json = JSON.stringify(trajectory);
  const compressed = zlib.gzipSync(json);
  return compressed.toString('base64');
}

// Decompress on retrieval
function decompressTrajectory(compressed: string): Trajectory {
  const buffer = Buffer.from(compressed, 'base64');
  const decompressed = zlib.gunzipSync(buffer);
  return JSON.parse(decompressed.toString());
}
```

### Table: `matts_runs`

Stores MATTS (Memory-Augmented Task Trajectory System) run metadata.

```sql
CREATE TABLE matts_runs (
  run_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  mode TEXT NOT NULL,               -- similar|hybrid|random
  k INTEGER NOT NULL,               -- Number of trajectories retrieved
  status TEXT NOT NULL,             -- running|completed|failed
  summary TEXT,
  retrieval_method TEXT,            -- embedding|keyword|hybrid
  retrieved_patterns TEXT,          -- JSON array of pattern IDs
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX idx_matts_task ON matts_runs(task_id);
CREATE INDEX idx_matts_status ON matts_runs(status);
```

### Table: `consolidation_runs`

Tracks pattern consolidation operations.

```sql
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
```

### Table: `metrics_log`

Time-series metrics for monitoring and analytics.

```sql
CREATE TABLE metrics_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  tags TEXT,                        -- JSON object for dimensions
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_name ON metrics_log(metric_name);
CREATE INDEX idx_metrics_timestamp ON metrics_log(timestamp DESC);
CREATE INDEX idx_metrics_name_timestamp ON metrics_log(metric_name, timestamp DESC);
```

**Standard Metrics:**
```typescript
// Performance metrics
{
  metric_name: "pattern_retrieval_time_ms",
  value: 8.5,
  unit: "milliseconds",
  tags: { operation: "vector_search", cache_hit: false }
}

// Learning metrics
{
  metric_name: "pattern_confidence_change",
  value: 0.05,
  unit: "delta",
  tags: { pattern_id: "pattern-uuid-1234", outcome: "success" }
}

// Resource metrics
{
  metric_name: "memory_usage_bytes",
  value: 52428800,
  unit: "bytes",
  tags: { component: "working_memory" }
}
```

### Table: `memory_entries`

General-purpose key-value store for working memory.

```sql
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
  ttl INTEGER,                      -- Time to live in seconds
  expires_at INTEGER,               -- Unix timestamp
  UNIQUE(key, namespace)
);

CREATE INDEX idx_memory_namespace ON memory_entries(namespace);
CREATE INDEX idx_memory_expires ON memory_entries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_memory_accessed ON memory_entries(accessed_at);
```

**Namespaces:**
- `context` - Current task context
- `cache` - Temporary cached data
- `config` - Configuration overrides
- `session` - Session-specific data

## Memory Tier Mappings

### Vector Memory (Semantic Search)

**Tables:** `pattern_embeddings`, `patterns`

**Operations:**
```typescript
// Store pattern with embedding
async function storePatternWithEmbedding(pattern: Pattern): Promise<void> {
  const embedding = await generateEmbedding(pattern);

  await db.transaction(async (tx) => {
    await tx.patterns.insert(pattern);
    await tx.patternEmbeddings.insert({
      id: pattern.id,
      model: EMBEDDING_MODEL,
      dims: embedding.length,
      vector: serializeVector(embedding)
    });
  });
}

// Semantic search
async function semanticSearch(query: string, k: number = 10): Promise<Pattern[]> {
  const queryEmbedding = await generateEmbedding(query);

  // Load all embeddings (optimized with caching)
  const embeddings = await db.patternEmbeddings
    .where('model', EMBEDDING_MODEL)
    .getAll();

  // Compute similarities
  const similarities = embeddings.map(emb => ({
    id: emb.id,
    similarity: cosineSimilarity(queryEmbedding, deserializeVector(emb.vector))
  }));

  // Get top-k
  const topK = similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);

  // Retrieve full patterns
  const patterns = await db.patterns
    .where('id', 'IN', topK.map(t => t.id))
    .getAll();

  return patterns;
}
```

### Episodic Memory (Interaction History)

**Tables:** `task_trajectories`, `matts_runs`

**Operations:**
```typescript
// Store trajectory
async function storeTrajectory(trajectory: Trajectory): Promise<void> {
  const compressed = compressTrajectory(trajectory);

  await db.taskTrajectories.insert({
    task_id: trajectory.task_id,
    agent_id: trajectory.agent_id,
    query: trajectory.query,
    trajectory_json: compressed,
    started_at: trajectory.started_at,
    ended_at: trajectory.ended_at,
    duration_ms: calculateDuration(trajectory),
    judge_label: trajectory.outcome.status,
    judge_conf: trajectory.outcome.confidence,
    judge_reasons: JSON.stringify(trajectory.outcome.reasons || []),
    token_count: trajectory.outcome.metrics.tokens_total,
    tool_calls_count: trajectory.steps.length,
    error_count: trajectory.outcome.metrics.errors_count
  });
}

// Query similar trajectories
async function findSimilarTrajectories(
  query: string,
  k: number = 5
): Promise<Trajectory[]> {
  // Embedding-based search
  const queryEmbedding = await generateEmbedding(query);

  // Get all trajectories (optimized with pagination)
  const trajectories = await db.taskTrajectories
    .where('judge_label', 'success')
    .orderBy('created_at', 'DESC')
    .limit(100)
    .getAll();

  // Compute similarities
  const similarities = await Promise.all(
    trajectories.map(async (t) => {
      const tEmbedding = await generateEmbedding(t.query);
      return {
        trajectory: t,
        similarity: cosineSimilarity(queryEmbedding, tEmbedding)
      };
    })
  );

  // Return top-k
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
    .map(s => decompressTrajectory(s.trajectory.trajectory_json));
}
```

### Semantic Memory (Learned Rules)

**Tables:** `patterns`, `pattern_links`

**Operations:**
```typescript
// Store pattern with relationships
async function storePatternWithLinks(
  pattern: Pattern,
  links: PatternLink[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.patterns.insert(pattern);

    for (const link of links) {
      await tx.patternLinks.insert({
        src_id: pattern.id,
        dst_id: link.targetId,
        relation: link.relation,
        weight: link.weight
      });
    }
  });
}

// Get pattern with related patterns
async function getPatternWithRelations(
  patternId: string
): Promise<PatternGraph> {
  const pattern = await db.patterns.get(patternId);

  // Get outgoing links
  const outgoingLinks = await db.patternLinks
    .where('src_id', patternId)
    .getAll();

  // Get incoming links
  const incomingLinks = await db.patternLinks
    .where('dst_id', patternId)
    .getAll();

  // Load related patterns
  const relatedIds = [
    ...outgoingLinks.map(l => l.dst_id),
    ...incomingLinks.map(l => l.src_id)
  ];

  const relatedPatterns = await db.patterns
    .where('id', 'IN', relatedIds)
    .getAll();

  return {
    pattern,
    outgoingLinks,
    incomingLinks,
    relatedPatterns
  };
}
```

### Working Memory (Active Context)

**Tables:** `memory_entries` (persistent), In-memory structures (ephemeral)

**Operations:**
```typescript
// In-memory working memory
class WorkingMemoryManager {
  private contextCache = new Map<string, Context>();
  private patternCache = new LRUCache<string, Pattern>(1000);
  private embeddingCache = new LRUCache<string, Float32Array>(500);

  // Store current context
  async setContext(key: string, context: Context, ttl: number = 1800) {
    this.contextCache.set(key, context);

    // Persist to database
    await db.memoryEntries.upsert({
      key,
      value: JSON.stringify(context),
      namespace: 'context',
      ttl,
      expires_at: Date.now() + (ttl * 1000)
    });
  }

  // Get context with fallback
  async getContext(key: string): Promise<Context | null> {
    // Check in-memory cache
    if (this.contextCache.has(key)) {
      return this.contextCache.get(key)!;
    }

    // Check database
    const entry = await db.memoryEntries
      .where('key', key)
      .where('namespace', 'context')
      .first();

    if (entry && (!entry.expires_at || entry.expires_at > Date.now())) {
      const context = JSON.parse(entry.value);
      this.contextCache.set(key, context);
      return context;
    }

    return null;
  }

  // Cache pattern for fast access
  cachePattern(pattern: Pattern) {
    this.patternCache.set(pattern.id, pattern);
  }

  // Get cached pattern
  getCachedPattern(patternId: string): Pattern | null {
    return this.patternCache.get(patternId) || null;
  }
}
```

## Data Access Patterns

### Query Optimization

**Pattern Retrieval by Type and Confidence:**
```sql
-- Optimized query using compound index
SELECT id, pattern_data, confidence
FROM patterns
WHERE type = 'coordination'
  AND confidence >= 0.7
ORDER BY confidence DESC
LIMIT 10;

-- Use covering index
CREATE INDEX idx_patterns_type_confidence_id
ON patterns(type, confidence DESC, id);
```

**Recent Successful Trajectories:**
```sql
-- Efficiently retrieve recent successes
SELECT task_id, agent_id, query, judge_conf
FROM task_trajectories
WHERE judge_label = 'success'
  AND created_at >= datetime('now', '-7 days')
ORDER BY judge_conf DESC, created_at DESC
LIMIT 20;
```

**Pattern Usage Statistics:**
```sql
-- Aggregate pattern usage
SELECT
  type,
  COUNT(*) as count,
  AVG(confidence) as avg_confidence,
  AVG(usage_count) as avg_usage,
  SUM(CASE WHEN confidence >= 0.7 THEN 1 ELSE 0 END) as high_confidence_count
FROM patterns
GROUP BY type
ORDER BY count DESC;
```

### Batch Operations

**Bulk Confidence Update:**
```sql
-- Update confidence for multiple patterns
UPDATE patterns
SET
  confidence = CASE
    WHEN id = ? THEN ?
    WHEN id = ? THEN ?
    -- ... more cases
  END,
  usage_count = usage_count + 1,
  last_used = CURRENT_TIMESTAMP
WHERE id IN (?, ?, ...);
```

**Bulk Pattern Insertion:**
```typescript
async function bulkInsertPatterns(patterns: Pattern[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const pattern of patterns) {
      await tx.patterns.insert(pattern);
    }
  });
}
```

### Maintenance Operations

**Cleanup Expired Entries:**
```sql
-- Remove expired memory entries
DELETE FROM memory_entries
WHERE expires_at IS NOT NULL
  AND expires_at < strftime('%s', 'now');
```

**Prune Old Trajectories:**
```sql
-- Remove old failed trajectories
DELETE FROM task_trajectories
WHERE judge_label = 'failure'
  AND created_at < datetime('now', '-30 days');

-- Archive old successful trajectories
INSERT INTO task_trajectories_archive
SELECT * FROM task_trajectories
WHERE judge_label = 'success'
  AND created_at < datetime('now', '-90 days');

DELETE FROM task_trajectories
WHERE judge_label = 'success'
  AND created_at < datetime('now', '-90 days');
```

**Vacuum and Optimize:**
```sql
-- Reclaim space and optimize
VACUUM;
ANALYZE;

-- Update statistics
ANALYZE patterns;
ANALYZE pattern_embeddings;
ANALYZE task_trajectories;
```

## Data Migration and Versioning

### Schema Version Tracking

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_version (version, description)
VALUES (1, 'Initial SAFLA Neural schema');
```

### Migration Example

```sql
-- Migration: Add metadata column to patterns
BEGIN TRANSACTION;

-- Add column
ALTER TABLE patterns ADD COLUMN metadata TEXT;

-- Update version
INSERT INTO schema_version (version, description)
VALUES (2, 'Add metadata column to patterns');

COMMIT;
```

### Data Export/Import

```typescript
// Export patterns for backup or sharing
async function exportPatterns(filter?: PatternFilter): Promise<ExportData> {
  let patterns = await db.patterns.getAll();

  if (filter) {
    patterns = patterns.filter(filter.predicate);
  }

  const embeddings = await db.patternEmbeddings
    .where('id', 'IN', patterns.map(p => p.id))
    .getAll();

  const links = await db.patternLinks
    .where('src_id', 'IN', patterns.map(p => p.id))
    .getAll();

  return {
    version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    patterns,
    embeddings,
    links
  };
}

// Import patterns from export
async function importPatterns(data: ExportData): Promise<ImportResult> {
  if (data.version !== SCHEMA_VERSION) {
    throw new Error('Schema version mismatch');
  }

  let imported = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    for (const pattern of data.patterns) {
      // Check if pattern already exists
      const existing = await tx.patterns.get(pattern.id);

      if (existing) {
        // Merge or skip based on confidence
        if (pattern.confidence > existing.confidence) {
          await tx.patterns.update(pattern.id, pattern);
          imported++;
        } else {
          skipped++;
        }
      } else {
        await tx.patterns.insert(pattern);
        imported++;
      }
    }

    // Import embeddings and links
    for (const embedding of data.embeddings) {
      await tx.patternEmbeddings.upsert(embedding);
    }

    for (const link of data.links) {
      await tx.patternLinks.upsert(link);
    }
  });

  return { imported, skipped };
}
```

## Performance Considerations

### Database Configuration

```typescript
// Optimal SQLite settings for SAFLA Neural
await db.exec(`
  PRAGMA journal_mode = WAL;          -- Write-Ahead Logging
  PRAGMA synchronous = NORMAL;        -- Balance safety and speed
  PRAGMA cache_size = -64000;         -- 64MB cache
  PRAGMA temp_store = MEMORY;         -- Use RAM for temp tables
  PRAGMA mmap_size = 268435456;       -- 256MB memory-mapped I/O
  PRAGMA page_size = 4096;            -- Optimal page size
  PRAGMA auto_vacuum = INCREMENTAL;   -- Reclaim space gradually
`);
```

### Query Planning

```sql
-- Analyze query execution
EXPLAIN QUERY PLAN
SELECT p.id, p.confidence, pe.vector
FROM patterns p
JOIN pattern_embeddings pe ON p.id = pe.id
WHERE p.type = 'coordination'
  AND p.confidence >= 0.7
ORDER BY p.confidence DESC
LIMIT 10;
```

### Caching Strategy

**Multi-level cache hierarchy:**
1. **L1 Cache (In-memory Map):** 100ms TTL, most frequently accessed
2. **L2 Cache (LRU):** 30min TTL, recently accessed
3. **L3 Cache (SQLite temp tables):** Session lifetime
4. **Persistent Storage (SQLite main DB):** Permanent

## Security Considerations

### Access Control

```typescript
// Role-based access to patterns
interface AccessControl {
  canRead(pattern: Pattern, role: Role): boolean;
  canWrite(pattern: Pattern, role: Role): boolean;
  canDelete(pattern: Pattern, role: Role): boolean;
}

class PatternAccessControl implements AccessControl {
  canRead(pattern: Pattern, role: Role): boolean {
    if (role === 'admin') return true;
    if (pattern.metadata?.visibility === 'public') return true;
    if (pattern.metadata?.owner === role) return true;
    return false;
  }

  canWrite(pattern: Pattern, role: Role): boolean {
    if (role === 'admin') return true;
    if (pattern.metadata?.owner === role) return true;
    return false;
  }

  canDelete(pattern: Pattern, role: Role): boolean {
    if (role === 'admin') return true;
    if (pattern.confidence < 0.3 && pattern.metadata?.owner === role) return true;
    return false;
  }
}
```

### Data Sanitization

```typescript
// Sanitize pattern data before storage
function sanitizePattern(pattern: Pattern): Pattern {
  // Remove sensitive information
  const sanitized = { ...pattern };

  if (sanitized.pattern_data) {
    const data = JSON.parse(sanitized.pattern_data);

    // Remove credentials, tokens, secrets
    removeSecrets(data);

    sanitized.pattern_data = JSON.stringify(data);
  }

  return sanitized;
}

function removeSecrets(obj: any) {
  const secretKeys = ['password', 'token', 'secret', 'key', 'credential'];

  for (const key in obj) {
    if (secretKeys.some(sk => key.toLowerCase().includes(sk))) {
      obj[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      removeSecrets(obj[key]);
    }
  }
}
```

## Monitoring and Observability

### Database Metrics

```typescript
// Collect database statistics
async function collectDBMetrics(): Promise<DBMetrics> {
  const stats = await db.exec(`
    SELECT
      (SELECT COUNT(*) FROM patterns) as total_patterns,
      (SELECT COUNT(*) FROM pattern_embeddings) as total_embeddings,
      (SELECT COUNT(*) FROM task_trajectories) as total_trajectories,
      (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as db_size_bytes,
      (SELECT freelist_count FROM pragma_freelist_count()) as free_pages
  `);

  return {
    totalPatterns: stats[0].total_patterns,
    totalEmbeddings: stats[0].total_embeddings,
    totalTrajectories: stats[0].total_trajectories,
    dbSizeBytes: stats[0].db_size_bytes,
    freePages: stats[0].free_pages
  };
}
```

### Query Performance Monitoring

```typescript
// Log slow queries
const slowQueryThreshold = 100; // ms

async function monitoredQuery<T>(
  name: string,
  query: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await query();
    const duration = Date.now() - start;

    if (duration > slowQueryThreshold) {
      await logSlowQuery({
        name,
        duration,
        timestamp: new Date().toISOString()
      });
    }

    return result;
  } catch (error) {
    await logQueryError({
      name,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}
```

## Summary

The SAFLA Neural memory schema provides a robust foundation for multi-tier learning with:

- **Efficient storage** through compression and quantization
- **Fast retrieval** via optimized indices and caching
- **Flexible querying** with semantic search and filtering
- **Data integrity** through foreign keys and transactions
- **Scalability** via pruning and consolidation
- **Observability** through comprehensive metrics

The schema supports all four memory tiers while maintaining performance targets of 172,000+ ops/sec and 60% memory compression.
