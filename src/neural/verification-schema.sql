-- ============================================================================
-- SAFLA Neural Verification Learning Database Schema
-- ============================================================================
--
-- This schema supports the verification-neural learning integration:
-- 1. Verification outcomes storage
-- 2. Truth score predictions
-- 3. Adaptive thresholds
-- 4. Verification patterns
-- 5. Agent reliability tracking
--
-- Performance targets:
-- - Query time: <50ms
-- - Insert time: <10ms
-- - Pattern matching: <100ms
-- ============================================================================

-- ============================================================================
-- Verification Outcomes Table
-- ============================================================================
-- Stores all verification outcomes for learning and analysis

CREATE TABLE IF NOT EXISTS verification_outcomes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,

  -- Verification results
  passed INTEGER NOT NULL,  -- 0 or 1
  truth_score REAL NOT NULL,
  threshold REAL NOT NULL,

  -- Component scores (JSON)
  component_scores TEXT,

  -- Context
  file_type TEXT,
  complexity REAL,
  lines_changed INTEGER,
  tests_run INTEGER,

  -- Metadata
  duration INTEGER NOT NULL,  -- milliseconds
  error_messages TEXT,  -- JSON array
  warnings TEXT,  -- JSON array

  -- Indexes
  FOREIGN KEY (agent_id) REFERENCES agent_reliability(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_agent
  ON verification_outcomes(agent_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_task
  ON verification_outcomes(task_id);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_type
  ON verification_outcomes(agent_type, file_type);

CREATE INDEX IF NOT EXISTS idx_verification_outcomes_timestamp
  ON verification_outcomes(timestamp DESC);

-- ============================================================================
-- Truth Score Predictions Table
-- ============================================================================
-- Stores predictions and their accuracy for model improvement

CREATE TABLE IF NOT EXISTS truth_score_predictions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,

  -- Prediction
  predicted_score REAL NOT NULL,
  confidence REAL NOT NULL,
  recommended_threshold REAL NOT NULL,
  risk_level TEXT NOT NULL,

  -- Factors (JSON)
  factors TEXT,

  -- Actual outcome (filled in after verification)
  actual_score REAL,
  prediction_error REAL,  -- abs(actual - predicted)

  FOREIGN KEY (agent_id) REFERENCES agent_reliability(agent_id),
  FOREIGN KEY (task_id) REFERENCES verification_outcomes(task_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_agent
  ON truth_score_predictions(agent_id);

CREATE INDEX IF NOT EXISTS idx_predictions_accuracy
  ON truth_score_predictions(prediction_error);

-- ============================================================================
-- Adaptive Thresholds Table
-- ============================================================================
-- Stores context-aware adaptive thresholds

CREATE TABLE IF NOT EXISTS adaptive_thresholds (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  file_type TEXT,  -- NULL means "any"

  -- Thresholds
  base_threshold REAL NOT NULL,
  adjusted_threshold REAL NOT NULL,

  -- Confidence interval
  confidence_min REAL NOT NULL,
  confidence_max REAL NOT NULL,

  -- Statistics
  sample_size INTEGER NOT NULL,

  -- Metadata
  last_updated TEXT NOT NULL,

  UNIQUE(agent_type, file_type)
);

CREATE INDEX IF NOT EXISTS idx_adaptive_thresholds_agent
  ON adaptive_thresholds(agent_type);

CREATE INDEX IF NOT EXISTS idx_adaptive_thresholds_context
  ON adaptive_thresholds(agent_type, file_type);

-- ============================================================================
-- Verification Patterns Table
-- ============================================================================
-- Library of common verification patterns (success, failure, warning)

CREATE TABLE IF NOT EXISTS verification_patterns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'success', 'failure', 'warning'
  name TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Pattern characteristics
  agent_types TEXT NOT NULL,  -- JSON array
  file_types TEXT NOT NULL,  -- JSON array
  common_errors TEXT NOT NULL,  -- JSON array
  component_weights TEXT NOT NULL,  -- JSON object

  -- Statistics
  occurrences INTEGER NOT NULL DEFAULT 1,
  avg_truth_score REAL NOT NULL,
  success_rate REAL NOT NULL,
  confidence REAL NOT NULL,

  -- Metadata
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_patterns_type
  ON verification_patterns(type);

CREATE INDEX IF NOT EXISTS idx_verification_patterns_name
  ON verification_patterns(name);

CREATE INDEX IF NOT EXISTS idx_verification_patterns_confidence
  ON verification_patterns(confidence DESC);

-- ============================================================================
-- Agent Reliability Table
-- ============================================================================
-- Tracks reliability metrics for each agent

CREATE TABLE IF NOT EXISTS agent_reliability (
  agent_id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,

  -- Overall metrics
  total_verifications INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  avg_truth_score REAL NOT NULL DEFAULT 0.5,
  reliability REAL NOT NULL DEFAULT 0.5,  -- 0-1

  -- Trends
  recent_trend TEXT NOT NULL DEFAULT 'stable',  -- 'improving', 'stable', 'declining'
  trend_confidence REAL NOT NULL DEFAULT 0.0,

  -- Context-specific (JSON)
  performance_by_file_type TEXT,  -- JSON object

  -- Timestamps
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_updated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_reliability_type
  ON agent_reliability(agent_type);

CREATE INDEX IF NOT EXISTS idx_agent_reliability_score
  ON agent_reliability(reliability DESC);

CREATE INDEX IF NOT EXISTS idx_agent_reliability_trend
  ON agent_reliability(recent_trend);

-- ============================================================================
-- Verification Learning Metrics Table
-- ============================================================================
-- Stores system-wide learning metrics for monitoring

CREATE TABLE IF NOT EXISTS verification_learning_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,

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

  -- Improvement metrics
  threshold_adjustments INTEGER NOT NULL,
  patterns_learned INTEGER NOT NULL,
  avg_agent_reliability REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_metrics_timestamp
  ON verification_learning_metrics(timestamp DESC);

-- ============================================================================
-- Verification Failure Analysis Table
-- ============================================================================
-- Detailed analysis of verification failures for pattern extraction

CREATE TABLE IF NOT EXISTS verification_failure_analysis (
  id TEXT PRIMARY KEY,
  outcome_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,

  -- Failure details
  failure_category TEXT NOT NULL,  -- 'compile', 'tests', 'lint', 'security', etc.
  error_signature TEXT NOT NULL,  -- Normalized error pattern
  stack_trace TEXT,

  -- Context
  agent_id TEXT NOT NULL,
  file_type TEXT,
  complexity REAL,

  -- Analysis
  root_cause TEXT,
  suggested_fix TEXT,
  similar_failures INTEGER DEFAULT 0,

  -- Resolution
  resolved INTEGER DEFAULT 0,
  resolution_timestamp TEXT,

  FOREIGN KEY (outcome_id) REFERENCES verification_outcomes(id),
  FOREIGN KEY (agent_id) REFERENCES agent_reliability(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_failure_analysis_category
  ON verification_failure_analysis(failure_category);

CREATE INDEX IF NOT EXISTS idx_failure_analysis_signature
  ON verification_failure_analysis(error_signature);

CREATE INDEX IF NOT EXISTS idx_failure_analysis_agent
  ON verification_failure_analysis(agent_id);

-- ============================================================================
-- Views for Common Queries
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
  COUNT(DISTINCT vo.file_type) as file_types_handled,
  AVG(vo.duration) as avg_duration_ms
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
  AVG(duration) as avg_duration_ms
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
  (julianday('now') - julianday(vp.last_seen)) as days_since_last_seen
FROM verification_patterns vp
ORDER BY vp.confidence DESC, vp.occurrences DESC;

-- Prediction accuracy report
CREATE VIEW IF NOT EXISTS v_prediction_accuracy AS
SELECT
  agent_id,
  COUNT(*) as total_predictions,
  AVG(prediction_error) as avg_error,
  AVG(confidence) as avg_confidence,
  SUM(CASE WHEN prediction_error < 0.1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_within_10pct
FROM truth_score_predictions
WHERE actual_score IS NOT NULL
GROUP BY agent_id
ORDER BY accuracy_within_10pct DESC;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_outcomes_agent_time
  ON verification_outcomes(agent_id, timestamp DESC, passed);

CREATE INDEX IF NOT EXISTS idx_outcomes_type_score
  ON verification_outcomes(agent_type, file_type, truth_score);

CREATE INDEX IF NOT EXISTS idx_patterns_type_confidence
  ON verification_patterns(type, confidence DESC, occurrences DESC);

-- ============================================================================
-- Triggers for Data Integrity
-- ============================================================================

-- Update agent reliability on new verification outcome
CREATE TRIGGER IF NOT EXISTS trg_update_reliability_on_verification
AFTER INSERT ON verification_outcomes
BEGIN
  UPDATE agent_reliability
  SET
    total_verifications = total_verifications + 1,
    success_count = success_count + NEW.passed,
    failure_count = failure_count + (1 - NEW.passed),
    avg_truth_score = (avg_truth_score * total_verifications + NEW.truth_score) / (total_verifications + 1),
    reliability = (success_count + NEW.passed) * 1.0 / (total_verifications + 1),
    last_seen = NEW.timestamp,
    last_updated = datetime('now')
  WHERE agent_id = NEW.agent_id;

  -- Insert if not exists
  INSERT OR IGNORE INTO agent_reliability (
    agent_id, agent_type, total_verifications, success_count, failure_count,
    avg_truth_score, reliability, first_seen, last_seen, last_updated
  ) VALUES (
    NEW.agent_id, NEW.agent_type, 1, NEW.passed, 1 - NEW.passed,
    NEW.truth_score, NEW.passed, NEW.timestamp, NEW.timestamp, datetime('now')
  );
END;

-- Update prediction accuracy when actual outcome is known
CREATE TRIGGER IF NOT EXISTS trg_update_prediction_accuracy
AFTER UPDATE OF actual_score ON truth_score_predictions
WHEN NEW.actual_score IS NOT NULL
BEGIN
  UPDATE truth_score_predictions
  SET prediction_error = ABS(NEW.actual_score - NEW.predicted_score)
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

-- ============================================================================
-- Initial Data
-- ============================================================================

-- Insert default adaptive thresholds for common agent types
INSERT OR IGNORE INTO adaptive_thresholds (id, agent_type, file_type, base_threshold, adjusted_threshold, confidence_min, confidence_max, sample_size, last_updated) VALUES
  ('at-coder-ts', 'coder', 'ts', 0.95, 0.95, 0.90, 1.00, 0, datetime('now')),
  ('at-coder-js', 'coder', 'js', 0.95, 0.95, 0.90, 1.00, 0, datetime('now')),
  ('at-reviewer-any', 'reviewer', NULL, 0.95, 0.95, 0.90, 1.00, 0, datetime('now')),
  ('at-tester-any', 'tester', NULL, 0.95, 0.95, 0.90, 1.00, 0, datetime('now'));

-- ============================================================================
-- Maintenance Queries (for reference)
-- ============================================================================

-- Clean up old outcomes (keep 90 days)
-- DELETE FROM verification_outcomes WHERE julianday('now') - julianday(timestamp) > 90;

-- Clean up low-confidence patterns
-- DELETE FROM verification_patterns WHERE confidence < 0.3 AND occurrences < 5;

-- Reset prediction cache
-- UPDATE truth_score_predictions SET actual_score = NULL, prediction_error = NULL WHERE actual_score IS NULL;

-- Rebuild reliability from outcomes
-- UPDATE agent_reliability SET
--   total_verifications = (SELECT COUNT(*) FROM verification_outcomes WHERE agent_id = agent_reliability.agent_id),
--   success_count = (SELECT SUM(passed) FROM verification_outcomes WHERE agent_id = agent_reliability.agent_id),
--   avg_truth_score = (SELECT AVG(truth_score) FROM verification_outcomes WHERE agent_id = agent_reliability.agent_id);

-- ============================================================================
-- Schema Version
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES ('1.0.0-verification-learning', datetime('now'));
