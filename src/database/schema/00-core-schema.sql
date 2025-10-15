-- ============================================================================
-- SAFLA Neural Learning System - Core Database Schema
-- ============================================================================
-- Version: 1.0.0
-- Created: 2025-10-15
-- Description: Complete schema for neural learning, GOAP planning, and verification
--
-- Performance Targets:
-- - Query time: <50ms for most queries, <10ms for cached patterns
-- - Insert time: <10ms
-- - Pattern retrieval: <10ms with indexes
-- - Memory compression: 60% with full recall
-- - Operations/second: 172,000+
--
-- Tables:
-- 1. Core Memory: patterns, pattern_embeddings, pattern_links
-- 2. Trajectories: task_trajectories, matts_runs, consolidation_runs
-- 3. Metrics: metrics_log, memory_entries
-- 4. GOAP: goap_patterns, goap_plans, goap_execution_outcomes, etc.
-- 5. Verification: verification_outcomes, agent_reliability, etc.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Core Pattern Storage
-- ============================================================================

-- Main patterns table - stores learned coordination patterns
CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'coordination', 'edit', 'search', 'decomposition', 'agent'
  pattern_data TEXT NOT NULL,  -- JSON serialized pattern data
  confidence REAL NOT NULL DEFAULT 0.5,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used TEXT,

  -- Performance metadata
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  avg_execution_time REAL DEFAULT 0.0,

  -- Version control
  version INTEGER DEFAULT 1,
  superseded_by TEXT,  -- Reference to newer pattern version

  FOREIGN KEY (superseded_by) REFERENCES patterns(id)
);

-- Vector embeddings for semantic similarity search
CREATE TABLE IF NOT EXISTS pattern_embeddings (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,  -- 'dense', 'sparse', 'hybrid'
  dims INTEGER NOT NULL,
  vector BLOB NOT NULL,  -- Binary encoded vector
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Graph relationships between patterns
CREATE TABLE IF NOT EXISTS pattern_links (
  src_id TEXT NOT NULL,
  dst_id TEXT NOT NULL,
  relation TEXT NOT NULL,  -- 'follows', 'requires', 'conflicts', 'similar'
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (src_id, dst_id, relation),
  FOREIGN KEY (src_id) REFERENCES patterns(id) ON DELETE CASCADE,
  FOREIGN KEY (dst_id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 2: Task Trajectories and Execution History
-- ============================================================================

-- Complete execution histories for episodic memory
CREATE TABLE IF NOT EXISTS task_trajectories (
  task_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  query TEXT NOT NULL,
  trajectory_json TEXT NOT NULL,  -- Complete execution trace
  started_at TEXT,
  ended_at TEXT,

  -- Outcome assessment
  judge_label TEXT,  -- 'success', 'partial', 'failure'
  judge_conf REAL,
  judge_reasons TEXT,  -- JSON array

  -- MATTS integration
  matts_run_id TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (matts_run_id) REFERENCES matts_runs(run_id)
);

-- MATTS (Memory-Augmented Task Trajectory System) runs
CREATE TABLE IF NOT EXISTS matts_runs (
  run_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  mode TEXT NOT NULL,  -- 'retrieval', 'consolidation', 'analysis'
  k INTEGER NOT NULL,  -- Number of similar trajectories retrieved
  status TEXT NOT NULL,  -- 'pending', 'running', 'completed', 'failed'
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Memory consolidation runs
CREATE TABLE IF NOT EXISTS consolidation_runs (
  run_id TEXT PRIMARY KEY,
  items_processed INTEGER NOT NULL,
  duplicates_found INTEGER NOT NULL,
  contradictions_found INTEGER NOT NULL,
  items_pruned INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SECTION 3: General Purpose Memory Storage
-- ============================================================================

-- Key-value store with namespacing and TTL
CREATE TABLE IF NOT EXISTS memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'default',
  metadata TEXT,  -- JSON

  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  accessed_at INTEGER DEFAULT (strftime('%s', 'now')),
  access_count INTEGER DEFAULT 0,

  ttl INTEGER,  -- Time to live in seconds
  expires_at INTEGER,  -- Unix timestamp

  UNIQUE(key, namespace)
);

-- ============================================================================
-- SECTION 4: Performance Metrics and Monitoring
-- ============================================================================

-- Time-series metrics for system performance
CREATE TABLE IF NOT EXISTS metrics_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,  -- 'cache_hit_rate', 'query_time_ms', etc.
  value REAL NOT NULL,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Context
  component TEXT,  -- 'pattern_retrieval', 'vector_search', etc.
  tags TEXT  -- JSON object with additional metadata
);

-- ============================================================================
-- SECTION 5: Core Indexes for Performance
-- ============================================================================

-- Pattern indexes
CREATE INDEX IF NOT EXISTS idx_patterns_type
  ON patterns(type);

CREATE INDEX IF NOT EXISTS idx_patterns_confidence
  ON patterns(confidence DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_usage
  ON patterns(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_created_at
  ON patterns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_success_rate
  ON patterns(success_count DESC, failure_count);

-- Pattern link indexes
CREATE INDEX IF NOT EXISTS idx_pattern_links_relation
  ON pattern_links(relation);

CREATE INDEX IF NOT EXISTS idx_pattern_links_src
  ON pattern_links(src_id);

CREATE INDEX IF NOT EXISTS idx_pattern_links_dst
  ON pattern_links(dst_id);

-- Trajectory indexes
CREATE INDEX IF NOT EXISTS idx_trajectories_agent
  ON task_trajectories(agent_id);

CREATE INDEX IF NOT EXISTS idx_trajectories_label
  ON task_trajectories(judge_label);

CREATE INDEX IF NOT EXISTS idx_trajectories_created
  ON task_trajectories(created_at DESC);

-- Memory entry indexes
CREATE INDEX IF NOT EXISTS idx_memory_namespace
  ON memory_entries(namespace);

CREATE INDEX IF NOT EXISTS idx_memory_expires
  ON memory_entries(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memory_accessed
  ON memory_entries(accessed_at);

CREATE INDEX IF NOT EXISTS idx_memory_key_namespace
  ON memory_entries(key, namespace);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_name
  ON metrics_log(metric_name);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
  ON metrics_log(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_component
  ON metrics_log(component, metric_name);

-- ============================================================================
-- SECTION 6: Views for Common Analytics
-- ============================================================================

-- Pattern effectiveness view
CREATE VIEW IF NOT EXISTS v_pattern_effectiveness AS
SELECT
  p.id,
  p.type,
  p.confidence,
  p.usage_count,
  p.success_count,
  p.failure_count,
  CASE
    WHEN (p.success_count + p.failure_count) > 0
    THEN CAST(p.success_count AS REAL) / (p.success_count + p.failure_count)
    ELSE 0.5
  END AS success_rate,
  p.avg_execution_time,
  julianday('now') - julianday(p.created_at) AS age_days,
  CASE
    WHEN p.last_used IS NULL THEN -1
    ELSE julianday('now') - julianday(p.last_used)
  END AS days_since_use,
  p.version,
  p.superseded_by
FROM patterns p;

-- Memory usage statistics
CREATE VIEW IF NOT EXISTS v_memory_stats AS
SELECT
  namespace,
  COUNT(*) AS total_entries,
  SUM(access_count) AS total_accesses,
  AVG(access_count) AS avg_accesses_per_entry,
  SUM(LENGTH(value)) AS total_bytes,
  SUM(CASE WHEN expires_at IS NOT NULL THEN 1 ELSE 0 END) AS entries_with_ttl,
  SUM(CASE WHEN expires_at < strftime('%s', 'now') THEN 1 ELSE 0 END) AS expired_entries
FROM memory_entries
GROUP BY namespace;

-- Recent metrics summary
CREATE VIEW IF NOT EXISTS v_recent_metrics AS
SELECT
  metric_name,
  component,
  COUNT(*) AS sample_count,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  MAX(timestamp) AS last_recorded
FROM metrics_log
WHERE julianday('now') - julianday(timestamp) <= 1.0  -- Last 24 hours
GROUP BY metric_name, component;

-- ============================================================================
-- SECTION 7: Triggers for Data Integrity
-- ============================================================================

-- Update memory entry timestamps on access
CREATE TRIGGER IF NOT EXISTS trg_memory_access_update
AFTER UPDATE ON memory_entries
WHEN NEW.accessed_at <> OLD.accessed_at
BEGIN
  UPDATE memory_entries
  SET
    updated_at = strftime('%s', 'now'),
    access_count = access_count + 1
  WHERE id = NEW.id;
END;

-- Clean up expired memory entries automatically
CREATE TRIGGER IF NOT EXISTS trg_memory_expire_check
AFTER INSERT ON memory_entries
BEGIN
  DELETE FROM memory_entries
  WHERE expires_at IS NOT NULL
    AND expires_at < strftime('%s', 'now');
END;

-- Update pattern usage statistics
CREATE TRIGGER IF NOT EXISTS trg_pattern_usage_update
AFTER UPDATE ON patterns
WHEN NEW.last_used <> OLD.last_used
BEGIN
  UPDATE patterns
  SET usage_count = usage_count + 1
  WHERE id = NEW.id;
END;

-- ============================================================================
-- SECTION 8: Schema Version Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version TEXT PRIMARY KEY,
  description TEXT,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO schema_version (version, description, applied_at)
VALUES ('1.0.0-core', 'Core schema with patterns, trajectories, and memory', CURRENT_TIMESTAMP);

-- ============================================================================
-- END OF CORE SCHEMA
-- ============================================================================
