-- ============================================================================
-- SAFLA Neural Verification Learning Database Schema
-- ============================================================================
-- Version: 1.0.0
-- Created: 2025-10-15
-- Description: Schema for verification outcomes, truth scoring, and agent reliability
--
-- Purpose:
-- - Store all verification outcomes for learning and analysis
-- - Track truth score predictions and accuracy
-- - Manage adaptive thresholds per agent/context
-- - Monitor agent reliability with trend analysis
-- - Extract verification patterns for reuse
--
-- Integration:
-- - Neural system learns from verification outcomes
-- - GOAP uses verification patterns for planning
-- - Agent system uses reliability scores for task assignment
-- - Truth scoring system uses historical data for predictions
--
-- Performance targets:
-- - Query time: <50ms for verification lookups
-- - Insert time: <10ms for new outcomes
-- - Pattern matching: <100ms with indexes
-- ============================================================================

-- ============================================================================
-- Verification Outcomes Table - Core Verification Results
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_outcomes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Verification results
  passed INTEGER NOT NULL,  -- 0 or 1
  truth_score REAL NOT NULL,  -- 0.0 to 1.0
  threshold REAL NOT NULL,  -- Required threshold for pass

  -- Component scores (JSON)
  component_scores TEXT,  -- {compile: 0.95, tests: 0.90, lint: 0.85, ...}

  -- Context
  file_type TEXT,
  complexity REAL,  -- 0.0 to 1.0
  lines_changed INTEGER,
  tests_run INTEGER,

  -- Metadata
  duration INTEGER NOT NULL,  -- milliseconds
  error_messages TEXT,  -- JSON array
  warnings TEXT,  -- JSON array

  -- Rollback information
  rollback_triggered INTEGER DEFAULT 0,
  rollback_snapshot TEXT  -- Reference to snapshot if rollback occurred
);

-- ============================================================================
-- Truth Score Predictions Table - Predictive Scoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS truth_score_predictions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Prediction
  predicted_score REAL NOT NULL,  -- 0.0 to 1.0
  confidence REAL NOT NULL,  -- Prediction confidence
  recommended_threshold REAL NOT NULL,
  risk_level TEXT NOT NULL,  -- 'low', 'medium', 'high', 'critical'

  -- Factors (JSON)
  factors TEXT,  -- {agent_history: 0.9, file_complexity: 0.7, ...}

  -- Actual outcome (filled in after verification)
  actual_score REAL,
  prediction_error REAL,  -- abs(actual - predicted)
  error_direction TEXT  -- 'over', 'under', 'exact'
);

-- ============================================================================
-- Adaptive Thresholds Table - Context-Aware Thresholds
-- ============================================================================

CREATE TABLE IF NOT EXISTS adaptive_thresholds (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  file_type TEXT,  -- NULL means "any file type"

  -- Thresholds
  base_threshold REAL NOT NULL,  -- Base threshold (e.g., 0.95)
  adjusted_threshold REAL NOT NULL,  -- Adjusted based on performance
  adjustment_factor REAL DEFAULT 0.0,  -- How much adjusted from base

  -- Confidence interval
  confidence_min REAL NOT NULL,
  confidence_max REAL NOT NULL,

  -- Statistics
  sample_size INTEGER NOT NULL,
  success_rate REAL,

  -- Metadata
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_count INTEGER DEFAULT 1,

  UNIQUE(agent_type, file_type)
);

-- ============================================================================
-- Verification Patterns Table - Reusable Patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_patterns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'success', 'failure', 'warning'
  name TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Pattern characteristics
  agent_types TEXT NOT NULL,  -- JSON array
  file_types TEXT NOT NULL,  -- JSON array
  common_errors TEXT NOT NULL,  -- JSON array
  component_weights TEXT NOT NULL,  -- JSON: {compile: 0.35, tests: 0.25, ...}

  -- Statistics
  occurrences INTEGER NOT NULL DEFAULT 1,
  avg_truth_score REAL NOT NULL,
  success_rate REAL NOT NULL,
  confidence REAL NOT NULL,

  -- Recommendations
  recommended_actions TEXT,  -- JSON array of suggested fixes

  -- Metadata
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Agent Reliability Table - Agent Performance Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_reliability (
  agent_id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,

  -- Overall metrics
  total_verifications INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  avg_truth_score REAL NOT NULL DEFAULT 0.5,
  reliability REAL NOT NULL DEFAULT 0.5,  -- 0.0 to 1.0

  -- Trends
  recent_trend TEXT NOT NULL DEFAULT 'stable',  -- 'improving', 'stable', 'declining'
  trend_confidence REAL NOT NULL DEFAULT 0.0,
  trend_data TEXT,  -- JSON: recent scores for trend analysis

  -- Context-specific performance (JSON)
  performance_by_file_type TEXT,  -- {ts: 0.95, js: 0.92, ...}

  -- Quarantine status
  quarantined INTEGER DEFAULT 0,
  quarantine_reason TEXT,

  -- Timestamps
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Verification Learning Metrics Table - System-Wide Monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_learning_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Learning stats
  total_outcomes INTEGER NOT NULL,
  total_predictions INTEGER NOT NULL,
  total_patterns INTEGER NOT NULL,
  total_agents INTEGER NOT NULL,

  -- Accuracy metrics
  avg_prediction_accuracy REAL NOT NULL,
  avg_truth_score REAL NOT NULL,
  overall_success_rate REAL NOT NULL,

  -- Performance metrics
  false_positive_rate REAL NOT NULL,
  false_negative_rate REAL NOT NULL,
  avg_verification_time REAL NOT NULL,  -- milliseconds

  -- Improvement metrics
  threshold_adjustments INTEGER NOT NULL,
  patterns_learned INTEGER NOT NULL,
  avg_agent_reliability REAL NOT NULL,

  -- System health
  quarantined_agents INTEGER DEFAULT 0,
  rollbacks_triggered INTEGER DEFAULT 0
);

-- ============================================================================
-- Verification Failure Analysis Table - Detailed Failure Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_failure_analysis (
  id TEXT PRIMARY KEY,
  outcome_id TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Failure details
  failure_category TEXT NOT NULL,  -- 'compile', 'tests', 'lint', 'security', 'type', 'runtime'
  error_signature TEXT NOT NULL,  -- Normalized error pattern
  stack_trace TEXT,
  error_hash TEXT,  -- Hash for grouping similar errors

  -- Context
  agent_id TEXT NOT NULL,
  file_type TEXT,
  complexity REAL,

  -- Analysis
  root_cause TEXT,
  suggested_fix TEXT,
  similar_failures INTEGER DEFAULT 0,
  pattern_id TEXT,  -- Reference to verification_patterns

  -- Resolution
  resolved INTEGER DEFAULT 0,
  resolution_timestamp TEXT,
  resolution_method TEXT,  -- 'rollback', 'fix', 'ignore'

  FOREIGN KEY (outcome_id) REFERENCES verification_outcomes(id)
);

-- ============================================================================
-- Rollback History Table - Track Verification Rollbacks
-- ============================================================================

CREATE TABLE IF NOT EXISTS rollback_history (
  id TEXT PRIMARY KEY,
  outcome_id TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Rollback details
  trigger_reason TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  files_reverted INTEGER NOT NULL,

  -- Context
  agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  truth_score REAL NOT NULL,
  threshold REAL NOT NULL,

  -- Success tracking
  rollback_success INTEGER DEFAULT 1,
  errors TEXT,  -- JSON array if rollback failed

  FOREIGN KEY (outcome_id) REFERENCES verification_outcomes(id)
);

-- ============================================================================
-- Verification Indexes for Performance
-- ============================================================================

-- Outcome indexes
CREATE INDEX IF NOT EXISTS idx_verification_outcomes_agent
  ON verification_outcomes(agent_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_task
  ON verification_outcomes(task_id);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_type
  ON verification_outcomes(agent_type, file_type);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_timestamp
  ON verification_outcomes(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_score
  ON verification_outcomes(truth_score DESC);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_passed
  ON verification_outcomes(passed);

-- Prediction indexes
CREATE INDEX IF NOT EXISTS idx_predictions_agent
  ON truth_score_predictions(agent_id);

CREATE INDEX IF NOT EXISTS idx_predictions_accuracy
  ON truth_score_predictions(prediction_error);

CREATE INDEX IF NOT EXISTS idx_predictions_task
  ON truth_score_predictions(task_id);

-- Threshold indexes
CREATE INDEX IF NOT EXISTS idx_adaptive_thresholds_agent
  ON adaptive_thresholds(agent_type);

CREATE INDEX IF NOT EXISTS idx_adaptive_thresholds_context
  ON adaptive_thresholds(agent_type, file_type);

-- Pattern indexes
CREATE INDEX IF NOT EXISTS idx_verification_patterns_type
  ON verification_patterns(type);

CREATE INDEX IF NOT EXISTS idx_verification_patterns_name
  ON verification_patterns(name);

CREATE INDEX IF NOT EXISTS idx_verification_patterns_confidence
  ON verification_patterns(confidence DESC);

-- Reliability indexes
CREATE INDEX IF NOT EXISTS idx_agent_reliability_type
  ON agent_reliability(agent_type);

CREATE INDEX IF NOT EXISTS idx_agent_reliability_score
  ON agent_reliability(reliability DESC);

CREATE INDEX IF NOT EXISTS idx_agent_reliability_trend
  ON agent_reliability(recent_trend);

CREATE INDEX IF NOT EXISTS idx_agent_reliability_quarantine
  ON agent_reliability(quarantined);

-- Failure analysis indexes
CREATE INDEX IF NOT EXISTS idx_failure_analysis_category
  ON verification_failure_analysis(failure_category);

CREATE INDEX IF NOT EXISTS idx_failure_analysis_signature
  ON verification_failure_analysis(error_signature);

CREATE INDEX IF NOT EXISTS idx_failure_analysis_hash
  ON verification_failure_analysis(error_hash);

CREATE INDEX IF NOT EXISTS idx_failure_analysis_agent
  ON verification_failure_analysis(agent_id);

CREATE INDEX IF NOT EXISTS idx_failure_analysis_resolved
  ON verification_failure_analysis(resolved);

-- Rollback indexes
CREATE INDEX IF NOT EXISTS idx_rollback_history_outcome
  ON rollback_history(outcome_id);

CREATE INDEX IF NOT EXISTS idx_rollback_history_timestamp
  ON rollback_history(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_rollback_history_agent
  ON rollback_history(agent_id);

-- ============================================================================
-- Verification Views for Analytics
-- ============================================================================

-- Agent performance summary
CREATE VIEW IF NOT EXISTS v_agent_performance AS
SELECT
  ar.agent_id,
  ar.agent_type,
  ar.reliability,
  ar.avg_truth_score,
  ar.total_verifications,
  ar.recent_trend,
  ar.quarantined,
  COUNT(DISTINCT vo.file_type) as file_types_handled,
  AVG(vo.duration) as avg_duration_ms,
  COUNT(CASE WHEN vo.rollback_triggered = 1 THEN 1 END) as rollbacks
FROM agent_reliability ar
LEFT JOIN verification_outcomes vo ON ar.agent_id = vo.agent_id
GROUP BY ar.agent_id
ORDER BY ar.reliability DESC;

-- Recent verification trends
CREATE VIEW IF NOT EXISTS v_verification_trends AS
SELECT
  DATE(timestamp) as date,
  agent_type,
  COUNT(*) as total_verifications,
  SUM(passed) as passed_count,
  AVG(truth_score) as avg_truth_score,
  AVG(duration) as avg_duration_ms,
  SUM(rollback_triggered) as rollbacks
FROM verification_outcomes
WHERE timestamp >= datetime('now', '-30 days')
GROUP BY DATE(timestamp), agent_type
ORDER BY date DESC;

-- Pattern effectiveness
CREATE VIEW IF NOT EXISTS v_pattern_effectiveness AS
SELECT
  vp.id,
  vp.name,
  vp.type,
  vp.occurrences,
  vp.success_rate,
  vp.confidence,
  vp.avg_truth_score,
  julianday('now') - julianday(vp.last_seen) as days_since_last_seen
FROM verification_patterns vp
ORDER BY vp.confidence DESC, vp.occurrences DESC;

-- Prediction accuracy report
CREATE VIEW IF NOT EXISTS v_prediction_accuracy AS
SELECT
  agent_id,
  COUNT(*) as total_predictions,
  AVG(prediction_error) as avg_error,
  AVG(confidence) as avg_confidence,
  SUM(CASE WHEN prediction_error < 0.1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_within_10pct,
  SUM(CASE WHEN error_direction = 'over' THEN 1 ELSE 0 END) as overpredictions,
  SUM(CASE WHEN error_direction = 'under' THEN 1 ELSE 0 END) as underpredictions
FROM truth_score_predictions
WHERE actual_score IS NOT NULL
GROUP BY agent_id
ORDER BY accuracy_within_10pct DESC;

-- Failure patterns summary
CREATE VIEW IF NOT EXISTS v_failure_patterns AS
SELECT
  failure_category,
  error_signature,
  COUNT(*) as occurrence_count,
  AVG(complexity) as avg_complexity,
  COUNT(DISTINCT agent_id) as agents_affected,
  SUM(resolved) as resolved_count,
  MAX(timestamp) as last_occurrence
FROM verification_failure_analysis
GROUP BY failure_category, error_signature
HAVING occurrence_count > 1
ORDER BY occurrence_count DESC;

-- ============================================================================
-- Verification Triggers for Data Integrity
-- ============================================================================

-- Update agent reliability on new verification outcome
CREATE TRIGGER IF NOT EXISTS trg_update_reliability_on_verification
AFTER INSERT ON verification_outcomes
BEGIN
  -- Update existing agent reliability
  UPDATE agent_reliability
  SET
    total_verifications = total_verifications + 1,
    success_count = success_count + NEW.passed,
    failure_count = failure_count + (1 - NEW.passed),
    avg_truth_score = (avg_truth_score * total_verifications + NEW.truth_score) / (total_verifications + 1),
    reliability = CAST(success_count + NEW.passed AS REAL) / (total_verifications + 1),
    last_seen = NEW.timestamp,
    last_updated = CURRENT_TIMESTAMP
  WHERE agent_id = NEW.agent_id;

  -- Insert if not exists
  INSERT OR IGNORE INTO agent_reliability (
    agent_id, agent_type, total_verifications, success_count, failure_count,
    avg_truth_score, reliability, first_seen, last_seen, last_updated
  ) VALUES (
    NEW.agent_id, NEW.agent_type, 1, NEW.passed, 1 - NEW.passed,
    NEW.truth_score, CAST(NEW.passed AS REAL), NEW.timestamp, NEW.timestamp, CURRENT_TIMESTAMP
  );
END;

-- Update prediction accuracy when actual outcome is known
CREATE TRIGGER IF NOT EXISTS trg_update_prediction_accuracy
AFTER UPDATE OF actual_score ON truth_score_predictions
WHEN NEW.actual_score IS NOT NULL
BEGIN
  UPDATE truth_score_predictions
  SET
    prediction_error = ABS(NEW.actual_score - NEW.predicted_score),
    error_direction = CASE
      WHEN ABS(NEW.actual_score - NEW.predicted_score) < 0.01 THEN 'exact'
      WHEN NEW.predicted_score > NEW.actual_score THEN 'over'
      ELSE 'under'
    END
  WHERE id = NEW.id;
END;

-- Increment pattern occurrences
CREATE TRIGGER IF NOT EXISTS trg_update_pattern_occurrence
AFTER UPDATE ON verification_patterns
WHEN NEW.last_seen <> OLD.last_seen
BEGIN
  UPDATE verification_patterns
  SET occurrences = occurrences + 1
  WHERE id = NEW.id;
END;

-- Track rollback in history
CREATE TRIGGER IF NOT EXISTS trg_track_rollback
AFTER UPDATE OF rollback_triggered ON verification_outcomes
WHEN NEW.rollback_triggered = 1 AND OLD.rollback_triggered = 0
BEGIN
  INSERT INTO rollback_history (
    id, outcome_id, trigger_reason, snapshot_id, files_reverted,
    agent_id, task_id, truth_score, threshold, timestamp
  ) VALUES (
    'rb-' || NEW.id,
    NEW.id,
    'Truth score below threshold',
    COALESCE(NEW.rollback_snapshot, 'unknown'),
    0,  -- Will be updated by rollback system
    NEW.agent_id,
    NEW.task_id,
    NEW.truth_score,
    NEW.threshold,
    CURRENT_TIMESTAMP
  );
END;

-- ============================================================================
-- Initial Data - Default Adaptive Thresholds
-- ============================================================================

INSERT OR IGNORE INTO adaptive_thresholds (id, agent_type, file_type, base_threshold, adjusted_threshold, confidence_min, confidence_max, sample_size, last_updated) VALUES
  ('at-coder-ts', 'coder', 'ts', 0.95, 0.95, 0.90, 1.00, 0, CURRENT_TIMESTAMP),
  ('at-coder-js', 'coder', 'js', 0.95, 0.95, 0.90, 1.00, 0, CURRENT_TIMESTAMP),
  ('at-coder-tsx', 'coder', 'tsx', 0.95, 0.95, 0.90, 1.00, 0, CURRENT_TIMESTAMP),
  ('at-coder-jsx', 'coder', 'jsx', 0.95, 0.95, 0.90, 1.00, 0, CURRENT_TIMESTAMP),
  ('at-coder-py', 'coder', 'py', 0.95, 0.95, 0.90, 1.00, 0, CURRENT_TIMESTAMP),
  ('at-reviewer-any', 'reviewer', NULL, 0.95, 0.95, 0.90, 1.00, 0, CURRENT_TIMESTAMP),
  ('at-tester-any', 'tester', NULL, 0.95, 0.95, 0.90, 1.00, 0, CURRENT_TIMESTAMP),
  ('at-backend-dev-any', 'backend-dev', NULL, 0.95, 0.95, 0.90, 1.00, 0, CURRENT_TIMESTAMP);

-- ============================================================================
-- Schema Version
-- ============================================================================

INSERT OR REPLACE INTO schema_version (version, description, applied_at)
VALUES ('1.0.0-verification', 'Verification outcomes and agent reliability schema', CURRENT_TIMESTAMP);

-- ============================================================================
-- END OF VERIFICATION SCHEMA
-- ============================================================================
