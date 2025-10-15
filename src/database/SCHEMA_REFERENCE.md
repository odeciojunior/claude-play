# Database Schema Quick Reference

Quick reference for all database tables, columns, and relationships.

## 📊 Core Schema Tables

### patterns
Learned coordination patterns with confidence scoring.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| type | TEXT | Pattern type: 'coordination', 'edit', 'search', etc. |
| pattern_data | TEXT | JSON serialized pattern data |
| confidence | REAL | Confidence score 0.0-1.0 (default 0.5) |
| usage_count | INTEGER | Number of times used (default 0) |
| success_count | INTEGER | Successful uses |
| failure_count | INTEGER | Failed uses |
| avg_execution_time | REAL | Average execution time |
| version | INTEGER | Pattern version (default 1) |
| superseded_by | TEXT | Reference to newer version |
| created_at | TEXT | Creation timestamp |
| last_used | TEXT | Last usage timestamp |

**Indexes:** type, confidence, usage_count, success_rate, created_at

### pattern_embeddings
Vector representations for semantic similarity.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (FK to patterns) |
| model | TEXT | Model type: 'dense', 'sparse', 'hybrid' |
| dims | INTEGER | Vector dimensions |
| vector | BLOB | Binary encoded vector |
| created_at | TEXT | Creation timestamp |

**Foreign Keys:** id → patterns(id) CASCADE

### pattern_links
Graph relationships between patterns.

| Column | Type | Description |
|--------|------|-------------|
| src_id | TEXT | Source pattern ID (FK) |
| dst_id | TEXT | Destination pattern ID (FK) |
| relation | TEXT | Relationship: 'follows', 'requires', 'conflicts', 'similar' |
| weight | REAL | Relationship weight (default 1.0) |
| created_at | TEXT | Creation timestamp |

**Primary Key:** (src_id, dst_id, relation)
**Foreign Keys:** src_id/dst_id → patterns(id) CASCADE

### task_trajectories
Complete execution histories.

| Column | Type | Description |
|--------|------|-------------|
| task_id | TEXT | Primary key |
| agent_id | TEXT | Agent identifier |
| query | TEXT | Original query |
| trajectory_json | TEXT | Complete execution trace (JSON) |
| started_at | TEXT | Start timestamp |
| ended_at | TEXT | End timestamp |
| judge_label | TEXT | Outcome: 'success', 'partial', 'failure' |
| judge_conf | REAL | Outcome confidence |
| judge_reasons | TEXT | Reasoning (JSON array) |
| matts_run_id | TEXT | MATTS run reference (FK) |
| created_at | TEXT | Creation timestamp |

**Indexes:** agent_id, judge_label, created_at

### memory_entries
Key-value store with namespaces and TTL.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key (autoincrement) |
| key | TEXT | Entry key |
| value | TEXT | Entry value |
| namespace | TEXT | Namespace (default 'default') |
| metadata | TEXT | Additional metadata (JSON) |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |
| accessed_at | INTEGER | Unix timestamp |
| access_count | INTEGER | Access counter |
| ttl | INTEGER | Time to live (seconds) |
| expires_at | INTEGER | Expiration timestamp |

**Unique:** (key, namespace)
**Indexes:** namespace, expires_at, accessed_at

### metrics_log
Time-series performance metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key (autoincrement) |
| metric_name | TEXT | Metric identifier |
| value | REAL | Metric value |
| timestamp | TEXT | Recording timestamp |
| component | TEXT | Component name |
| tags | TEXT | Additional tags (JSON) |

**Indexes:** metric_name, timestamp, component

---

## 🎯 GOAP Schema Tables

### goap_patterns
Learned planning patterns with action sequences.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| type | TEXT | Pattern type: 'action_sequence', 'goal_achievement', etc. |
| goal | TEXT | Goal description |
| initial_state | TEXT | Starting world state (JSON) |
| final_state | TEXT | Achieved state (JSON) |
| action_sequence | TEXT | Action list with costs (JSON) |
| context_data | TEXT | Matching context (JSON) |
| cost | REAL | Total cost |
| success_count | INTEGER | Successful uses (default 0) |
| failure_count | INTEGER | Failed uses (default 0) |
| times_used | INTEGER | Usage count (default 0) |
| average_cost | REAL | Average cost (default 0) |
| cost_variance | REAL | Cost variance (default 0) |
| confidence | REAL | Confidence 0.0-1.0 (default 0.5) |
| generalization_level | TEXT | 'specific', 'moderate', 'general' |
| created_at | TEXT | Creation timestamp |
| last_used | TEXT | Last usage timestamp |
| pattern_data | TEXT | Full pattern JSON |

**Indexes:** type, confidence, usage, success_rate, created_at

### goap_plans
Generated plans with context and outcomes.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| actions | TEXT | Action IDs (JSON array) |
| total_cost | REAL | Plan cost |
| estimated_time | REAL | Estimated duration |
| success_rate | REAL | Expected success rate |
| confidence | REAL | Plan confidence |
| current_state | TEXT | World state at planning (JSON) |
| goal_state | TEXT | Target state (JSON) |
| constraints | TEXT | Planning constraints (JSON) |
| planning_method | TEXT | Method: 'a_star', 'pattern_reuse', 'hybrid' |
| pattern_id | TEXT | Reused pattern reference (FK) |
| created_at | TEXT | Creation timestamp |
| agent_id | TEXT | Planning agent |

**Indexes:** pattern_id, created_at, planning_method, agent_id

### goap_execution_outcomes
Plan execution results.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key (autoincrement) |
| plan_id | TEXT | Plan reference (FK) |
| success | INTEGER | Success flag (0 or 1) |
| actual_cost | REAL | Actual execution cost |
| estimated_cost | REAL | Estimated cost |
| cost_variance | REAL | Variance |
| achieved_goal | INTEGER | Goal achieved flag (0 or 1) |
| execution_time | REAL | Duration (milliseconds) |
| errors | TEXT | Error messages (JSON array) |
| lessons_learned | TEXT | Lessons (JSON array) |
| final_state | TEXT | Resulting state (JSON) |
| timestamp | TEXT | Execution timestamp |

**Indexes:** plan_id, success, timestamp

### goap_heuristic_learning
A* heuristic optimization data.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| state_hash | TEXT | State hash |
| goal_hash | TEXT | Goal hash |
| estimated_cost | REAL | Heuristic estimate |
| actual_cost | REAL | Actual cost |
| cost_error | REAL | Error amount |
| times_encountered | INTEGER | Encounter count (default 1) |
| average_error | REAL | Average error (default 0) |
| error_variance | REAL | Error variance (default 0) |
| confidence | REAL | Confidence (default 0.5) |
| first_seen | TEXT | First encounter timestamp |
| last_updated | TEXT | Last update timestamp |

**Indexes:** state_hash, goal_hash, average_error, confidence

### goap_action_performance
Per-action performance metrics.

| Column | Type | Description |
|--------|------|-------------|
| action_id | TEXT | Action identifier |
| context_hash | TEXT | Context hash |
| times_executed | INTEGER | Execution count (default 0) |
| success_count | INTEGER | Success count (default 0) |
| average_duration | REAL | Average time (ms, default 0) |
| duration_variance | REAL | Duration variance (default 0) |
| average_cost | REAL | Average cost (default 0) |
| cost_variance | REAL | Cost variance (default 0) |
| first_execution | TEXT | First execution timestamp |
| last_execution | TEXT | Last execution timestamp |

**Primary Key:** (action_id, context_hash)
**Indexes:** action_id, success_count

---

## ✅ Verification Schema Tables

### verification_outcomes
Verification results with truth scoring.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| task_id | TEXT | Task identifier |
| agent_id | TEXT | Agent identifier |
| agent_type | TEXT | Agent type |
| timestamp | TEXT | Verification timestamp |
| passed | INTEGER | Pass flag (0 or 1) |
| truth_score | REAL | Truth score 0.0-1.0 |
| threshold | REAL | Required threshold |
| component_scores | TEXT | Component scores (JSON) |
| file_type | TEXT | File type |
| complexity | REAL | Code complexity 0.0-1.0 |
| lines_changed | INTEGER | Lines changed |
| tests_run | INTEGER | Number of tests |
| duration | INTEGER | Verification time (ms) |
| error_messages | TEXT | Errors (JSON array) |
| warnings | TEXT | Warnings (JSON array) |
| rollback_triggered | INTEGER | Rollback flag (default 0) |
| rollback_snapshot | TEXT | Snapshot reference |

**Indexes:** agent_id, task_id, agent_type+file_type, timestamp, truth_score, passed

### agent_reliability
Agent performance tracking.

| Column | Type | Description |
|--------|------|-------------|
| agent_id | TEXT | Primary key |
| agent_type | TEXT | Agent type |
| total_verifications | INTEGER | Total count (default 0) |
| success_count | INTEGER | Success count (default 0) |
| failure_count | INTEGER | Failure count (default 0) |
| avg_truth_score | REAL | Average score (default 0.5) |
| reliability | REAL | Reliability 0.0-1.0 (default 0.5) |
| recent_trend | TEXT | Trend: 'improving', 'stable', 'declining' |
| trend_confidence | REAL | Trend confidence (default 0) |
| trend_data | TEXT | Recent scores (JSON) |
| performance_by_file_type | TEXT | Performance breakdown (JSON) |
| quarantined | INTEGER | Quarantine flag (default 0) |
| quarantine_reason | TEXT | Quarantine reason |
| first_seen | TEXT | First verification timestamp |
| last_seen | TEXT | Last verification timestamp |
| last_updated | TEXT | Last update timestamp |

**Indexes:** agent_type, reliability, recent_trend, quarantined

### truth_score_predictions
Predictive truth scoring.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| task_id | TEXT | Task identifier |
| agent_id | TEXT | Agent identifier |
| timestamp | TEXT | Prediction timestamp |
| predicted_score | REAL | Predicted score 0.0-1.0 |
| confidence | REAL | Prediction confidence |
| recommended_threshold | REAL | Recommended threshold |
| risk_level | TEXT | Risk: 'low', 'medium', 'high', 'critical' |
| factors | TEXT | Contributing factors (JSON) |
| actual_score | REAL | Actual score (filled later) |
| prediction_error | REAL | Prediction error |
| error_direction | TEXT | Direction: 'over', 'under', 'exact' |

**Indexes:** agent_id, prediction_error, task_id

### adaptive_thresholds
Context-aware threshold management.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| agent_type | TEXT | Agent type |
| file_type | TEXT | File type (NULL = any) |
| base_threshold | REAL | Base threshold |
| adjusted_threshold | REAL | Adjusted threshold |
| adjustment_factor | REAL | Adjustment amount (default 0) |
| confidence_min | REAL | Minimum confidence |
| confidence_max | REAL | Maximum confidence |
| sample_size | INTEGER | Sample count |
| success_rate | REAL | Success rate |
| last_updated | TEXT | Last update timestamp |
| update_count | INTEGER | Update counter (default 1) |

**Unique:** (agent_type, file_type)
**Indexes:** agent_type, (agent_type, file_type)

### verification_patterns
Reusable verification patterns.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| type | TEXT | Type: 'success', 'failure', 'warning' |
| name | TEXT | Pattern name |
| description | TEXT | Description |
| agent_types | TEXT | Applicable agents (JSON array) |
| file_types | TEXT | Applicable files (JSON array) |
| common_errors | TEXT | Common errors (JSON array) |
| component_weights | TEXT | Component weights (JSON) |
| occurrences | INTEGER | Occurrence count (default 1) |
| avg_truth_score | REAL | Average truth score |
| success_rate | REAL | Success rate |
| confidence | REAL | Pattern confidence |
| recommended_actions | TEXT | Suggested fixes (JSON array) |
| created_at | TEXT | Creation timestamp |
| last_seen | TEXT | Last seen timestamp |

**Indexes:** type, name, confidence

---

## 📈 Common Views

### v_pattern_effectiveness
Pattern success analysis from core patterns.

### v_goap_pattern_effectiveness
GOAP pattern success analysis.

### v_goap_planning_performance
Daily planning metrics.

### v_agent_performance
Agent reliability and performance metrics.

### v_verification_trends
Daily verification trends by agent type.

### v_prediction_accuracy
Prediction accuracy by agent.

---

## 🔗 Relationships

```
patterns ──┬─→ pattern_embeddings (1:1)
           ├─→ pattern_links (1:N as src)
           └─→ pattern_links (1:N as dst)

goap_patterns ──→ goap_plans (1:N)
goap_plans ──→ goap_execution_outcomes (1:N)
goap_plans ──→ goap_replanning_triggers (1:N)

verification_outcomes ──→ agent_reliability (N:1, via trigger)
verification_outcomes ──→ verification_failure_analysis (1:N)
verification_outcomes ──→ rollback_history (1:N)
```

---

## 🔧 Default Values

**Confidence Scores:** 0.5 (50%)
**Thresholds:** 0.95 (95%) for strict verification
**Timestamps:** CURRENT_TIMESTAMP
**Counts:** 0
**Flags:** 0 (false)

---

## 📝 Notes

- All JSON columns use TEXT type
- All timestamps use TEXT in ISO8601 format
- Foreign keys are enforced (`PRAGMA foreign_keys = ON`)
- Triggers maintain referential integrity
- Views are read-only
- Indexes optimize common query patterns
