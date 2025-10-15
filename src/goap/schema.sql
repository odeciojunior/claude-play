-- GOAP-Neural Integration Database Schema
-- Supports pattern storage, plan tracking, and outcome learning

-- ============================================================================
-- GOAP Patterns Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_patterns (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'action_sequence', 'goal_achievement', 'heuristic', 'cost_estimate'

  -- Context for pattern matching
  context_data TEXT NOT NULL,  -- JSON: {goal_state, current_state, constraints}

  -- Action sequence data
  action_sequence TEXT,  -- JSON: {actions: [], total_cost, success_rate, conditions}

  -- Learning metrics
  confidence REAL NOT NULL DEFAULT 0.5,
  times_used INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  average_cost REAL NOT NULL DEFAULT 0,
  cost_variance REAL NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TEXT NOT NULL,
  last_used TEXT,

  -- Pattern metadata
  generalization_level TEXT NOT NULL DEFAULT 'specific',  -- 'specific', 'moderate', 'general'
  pattern_data TEXT NOT NULL  -- Full pattern serialization
);

-- Indexes for fast pattern lookup
CREATE INDEX IF NOT EXISTS idx_goap_patterns_type ON goap_patterns(type);
CREATE INDEX IF NOT EXISTS idx_goap_patterns_confidence ON goap_patterns(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_goap_patterns_usage ON goap_patterns(times_used DESC);
CREATE INDEX IF NOT EXISTS idx_goap_patterns_created ON goap_patterns(created_at DESC);

-- ============================================================================
-- GOAP Plans Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_plans (
  id TEXT PRIMARY KEY,

  -- Plan data
  actions TEXT NOT NULL,  -- JSON: [action_ids]
  total_cost REAL NOT NULL,
  estimated_time REAL NOT NULL,
  success_rate REAL,
  confidence REAL,

  -- Context
  current_state TEXT NOT NULL,  -- JSON
  goal_state TEXT NOT NULL,  -- JSON
  constraints TEXT,  -- JSON

  -- Metadata
  created_at TEXT NOT NULL,
  pattern_id TEXT,  -- Reference to reused pattern (if any)

  FOREIGN KEY (pattern_id) REFERENCES goap_patterns(id)
);

CREATE INDEX IF NOT EXISTS idx_goap_plans_pattern ON goap_plans(pattern_id);
CREATE INDEX IF NOT EXISTS idx_goap_plans_created ON goap_plans(created_at DESC);

-- ============================================================================
-- GOAP Execution Outcomes Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_execution_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL,

  -- Outcome data
  success INTEGER NOT NULL,  -- 0 or 1
  actual_cost REAL NOT NULL,
  estimated_cost REAL NOT NULL,
  cost_variance REAL NOT NULL,
  achieved_goal INTEGER NOT NULL,  -- 0 or 1
  execution_time REAL NOT NULL,

  -- Error tracking
  errors TEXT,  -- JSON: [error_messages]
  lessons_learned TEXT,  -- JSON: [lessons]

  -- Timestamp
  timestamp TEXT NOT NULL,

  FOREIGN KEY (plan_id) REFERENCES goap_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_goap_outcomes_plan ON goap_execution_outcomes(plan_id);
CREATE INDEX IF NOT EXISTS idx_goap_outcomes_success ON goap_execution_outcomes(success);
CREATE INDEX IF NOT EXISTS idx_goap_outcomes_timestamp ON goap_execution_outcomes(timestamp DESC);

-- ============================================================================
-- GOAP Statistics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Metrics
  total_plans_generated INTEGER NOT NULL DEFAULT 0,
  pattern_based_plans INTEGER NOT NULL DEFAULT 0,
  a_star_plans INTEGER NOT NULL DEFAULT 0,
  average_planning_time_ms REAL NOT NULL DEFAULT 0,
  pattern_reuse_rate REAL NOT NULL DEFAULT 0,
  average_plan_quality REAL NOT NULL DEFAULT 0,
  replanning_rate REAL NOT NULL DEFAULT 0,

  -- Timestamp
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goap_statistics_recorded ON goap_statistics(recorded_at DESC);

-- ============================================================================
-- Pattern Similarity Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_pattern_similarity (
  pattern_id_1 TEXT NOT NULL,
  pattern_id_2 TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  computed_at TEXT NOT NULL,

  PRIMARY KEY (pattern_id_1, pattern_id_2),
  FOREIGN KEY (pattern_id_1) REFERENCES goap_patterns(id),
  FOREIGN KEY (pattern_id_2) REFERENCES goap_patterns(id)
);

CREATE INDEX IF NOT EXISTS idx_goap_similarity_score ON goap_pattern_similarity(similarity_score DESC);

-- ============================================================================
-- Heuristic Learning Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_heuristic_learning (
  id TEXT PRIMARY KEY,

  -- State-goal pair
  state_hash TEXT NOT NULL,
  goal_hash TEXT NOT NULL,

  -- Learned heuristic values
  estimated_cost REAL NOT NULL,
  actual_cost REAL,
  cost_error REAL,

  -- Learning metrics
  times_encountered INTEGER NOT NULL DEFAULT 1,
  average_error REAL NOT NULL DEFAULT 0,
  error_variance REAL NOT NULL DEFAULT 0,

  -- Timestamps
  first_seen TEXT NOT NULL,
  last_updated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goap_heuristic_state ON goap_heuristic_learning(state_hash);
CREATE INDEX IF NOT EXISTS idx_goap_heuristic_goal ON goap_heuristic_learning(goal_hash);
CREATE INDEX IF NOT EXISTS idx_goap_heuristic_error ON goap_heuristic_learning(average_error);

-- ============================================================================
-- Action Performance Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_action_performance (
  action_id TEXT NOT NULL,

  -- Performance metrics
  times_executed INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  average_duration REAL NOT NULL DEFAULT 0,
  duration_variance REAL NOT NULL DEFAULT 0,
  average_cost REAL NOT NULL DEFAULT 0,
  cost_variance REAL NOT NULL DEFAULT 0,

  -- Context-specific performance
  context_hash TEXT NOT NULL,  -- Hash of preconditions

  -- Timestamps
  first_execution TEXT NOT NULL,
  last_execution TEXT,

  PRIMARY KEY (action_id, context_hash)
);

CREATE INDEX IF NOT EXISTS idx_goap_action_perf_id ON goap_action_performance(action_id);
CREATE INDEX IF NOT EXISTS idx_goap_action_perf_success ON goap_action_performance(success_count DESC);

-- ============================================================================
-- Replanning Triggers Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_replanning_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL,

  -- Trigger information
  trigger_type TEXT NOT NULL,  -- 'failure', 'excessive_cost', 'new_requirements', 'better_path'
  reason TEXT NOT NULL,
  current_state TEXT NOT NULL,  -- JSON
  cost_overrun REAL,

  -- Timestamp
  timestamp TEXT NOT NULL,

  FOREIGN KEY (plan_id) REFERENCES goap_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_goap_replanning_plan ON goap_replanning_triggers(plan_id);
CREATE INDEX IF NOT EXISTS idx_goap_replanning_type ON goap_replanning_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_goap_replanning_timestamp ON goap_replanning_triggers(timestamp DESC);

-- ============================================================================
-- Pattern Generalization Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS goap_pattern_generalizations (
  specific_pattern_id TEXT NOT NULL,
  general_pattern_id TEXT NOT NULL,
  generalization_score REAL NOT NULL,
  created_at TEXT NOT NULL,

  PRIMARY KEY (specific_pattern_id, general_pattern_id),
  FOREIGN KEY (specific_pattern_id) REFERENCES goap_patterns(id),
  FOREIGN KEY (general_pattern_id) REFERENCES goap_patterns(id)
);

CREATE INDEX IF NOT EXISTS idx_goap_generalization_specific ON goap_pattern_generalizations(specific_pattern_id);
CREATE INDEX IF NOT EXISTS idx_goap_generalization_general ON goap_pattern_generalizations(general_pattern_id);

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Pattern effectiveness view
CREATE VIEW IF NOT EXISTS goap_pattern_effectiveness AS
SELECT
  p.id,
  p.type,
  p.confidence,
  p.times_used,
  p.success_count,
  CAST(p.success_count AS REAL) / NULLIF(p.times_used, 0) AS success_rate,
  p.average_cost,
  p.cost_variance,
  julianday('now') - julianday(p.created_at) AS age_days,
  CASE
    WHEN p.last_used IS NULL THEN -1
    ELSE julianday('now') - julianday(p.last_used)
  END AS days_since_use
FROM goap_patterns p;

-- Planning performance view
CREATE VIEW IF NOT EXISTS goap_planning_performance AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_plans,
  SUM(CASE WHEN pattern_id IS NOT NULL THEN 1 ELSE 0 END) AS pattern_based,
  SUM(CASE WHEN pattern_id IS NULL THEN 1 ELSE 0 END) AS a_star,
  AVG(total_cost) AS avg_cost,
  AVG(confidence) AS avg_confidence
FROM goap_plans
GROUP BY DATE(created_at);

-- Outcome trends view
CREATE VIEW IF NOT EXISTS goap_outcome_trends AS
SELECT
  DATE(timestamp) AS date,
  COUNT(*) AS total_executions,
  SUM(success) AS successful,
  SUM(achieved_goal) AS goals_achieved,
  AVG(cost_variance) AS avg_cost_variance,
  AVG(execution_time) AS avg_execution_time
FROM goap_execution_outcomes
GROUP BY DATE(timestamp);

-- ============================================================================
-- Cleanup Procedures (Manual)
-- ============================================================================

-- Query to identify low-value patterns for pruning
-- Run manually: DELETE FROM goap_patterns WHERE id IN (SELECT id FROM ...);
/*
SELECT id, type, confidence, times_used,
       julianday('now') - julianday(created_at) AS age_days
FROM goap_patterns
WHERE confidence < 0.3
  AND times_used < 5
  AND julianday('now') - julianday(created_at) > 30
ORDER BY confidence, times_used;
*/

-- Query to consolidate similar patterns
-- Run manually after reviewing results
/*
SELECT p1.id AS pattern1, p2.id AS pattern2, s.similarity_score
FROM goap_pattern_similarity s
JOIN goap_patterns p1 ON s.pattern_id_1 = p1.id
JOIN goap_patterns p2 ON s.pattern_id_2 = p2.id
WHERE s.similarity_score > 0.95
  AND p1.confidence > p2.confidence
ORDER BY s.similarity_score DESC;
*/
