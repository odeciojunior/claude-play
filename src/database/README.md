# Database Schema and Migration System

Complete database schema for the SAFLA Neural Learning System with GOAP planning and verification.

## 📋 Overview

This directory contains the complete database schema, migration system, and documentation for:

- **Core Patterns**: Neural learning patterns, embeddings, and memory
- **GOAP Planning**: Goal-oriented action planning with A* optimization
- **Verification**: Truth scoring, agent reliability, and outcome tracking

## 🗂️ Directory Structure

```
src/database/
├── schema/
│   ├── 00-core-schema.sql         # Core patterns, trajectories, memory
│   ├── 01-goap-schema.sql         # GOAP planning and learning
│   └── 02-verification-schema.sql # Verification and reliability
├── migrations/
│   ├── migrate.ts                 # TypeScript migration system
│   └── migrate.sh                 # Shell wrapper script
└── README.md                      # This file
```

## 🚀 Quick Start

### Run Migrations

```bash
# Run all pending migrations
npm run db:migrate

# Reset and rebuild database
npm run db:migrate -- --reset

# Verify database integrity
npm run db:migrate -- --verify

# Show database statistics
npm run db:migrate -- --stats
```

### Using the Shell Script

```bash
# Direct execution
./src/database/migrations/migrate.sh

# With options
./src/database/migrations/migrate.sh --reset
./src/database/migrations/migrate.sh --verify
./src/database/migrations/migrate.sh --stats
```

## 📊 Schema Overview

### Core Schema (00-core-schema.sql)

**Tables:**

1. **patterns** - Learned coordination patterns
   - Pattern data, confidence, usage stats
   - Version control and supersession tracking
   - Success/failure counts

2. **pattern_embeddings** - Vector representations
   - Dense, sparse, and hybrid embeddings
   - Fast similarity search

3. **pattern_links** - Graph relationships
   - Pattern dependencies and conflicts
   - Weighted relationships

4. **task_trajectories** - Complete execution histories
   - Full task execution traces
   - Outcome assessments
   - MATTS integration

5. **memory_entries** - Key-value storage
   - Namespaced memory
   - TTL support
   - Access tracking

6. **metrics_log** - Performance metrics
   - Time-series data
   - Component-level tracking

**Indexes:** 15+ indexes for optimal query performance

**Views:**
- `v_pattern_effectiveness` - Pattern success rates
- `v_memory_stats` - Memory usage by namespace
- `v_recent_metrics` - Last 24 hours of metrics

### GOAP Schema (01-goap-schema.sql)

**Tables:**

1. **goap_patterns** - Learned planning patterns
   - Action sequences with costs
   - Success/failure tracking
   - Generalization levels

2. **goap_plans** - Generated plans
   - Planning methods (A*, pattern reuse, hybrid)
   - State transitions
   - Success rates

3. **goap_execution_outcomes** - Plan results
   - Actual vs. estimated costs
   - Goal achievement tracking
   - Error analysis

4. **goap_statistics** - System-wide metrics
   - Planning performance
   - Pattern reuse rates
   - Learning metrics

5. **goap_heuristic_learning** - A* optimization
   - Learned heuristic values
   - Cost error tracking
   - Confidence scores

6. **goap_action_performance** - Per-action metrics
   - Success rates by context
   - Duration and cost variance

7. **goap_replanning_triggers** - Adaptive replanning
   - Trigger types and reasons
   - Cost overruns
   - New plan references

**Indexes:** 20+ indexes for fast pattern matching and retrieval

**Views:**
- `v_goap_pattern_effectiveness` - Pattern success analysis
- `v_goap_planning_performance` - Daily planning metrics
- `v_goap_outcome_trends` - Execution trends
- `v_goap_heuristic_accuracy` - Heuristic learning progress
- `v_goap_action_performance` - Action-level statistics

### Verification Schema (02-verification-schema.sql)

**Tables:**

1. **verification_outcomes** - Verification results
   - Truth scores and thresholds
   - Component scores (compile, test, lint)
   - File context and complexity

2. **truth_score_predictions** - Predictive scoring
   - Predicted vs. actual scores
   - Confidence and risk levels
   - Prediction accuracy tracking

3. **adaptive_thresholds** - Context-aware thresholds
   - Agent and file type specific
   - Confidence intervals
   - Sample size tracking

4. **verification_patterns** - Reusable patterns
   - Success, failure, and warning patterns
   - Common error signatures
   - Recommended actions

5. **agent_reliability** - Agent performance
   - Success rates and trends
   - Context-specific performance
   - Quarantine status

6. **verification_learning_metrics** - System metrics
   - Prediction accuracy
   - False positive/negative rates
   - Learning progress

7. **verification_failure_analysis** - Failure tracking
   - Error categorization
   - Root cause analysis
   - Resolution tracking

8. **rollback_history** - Rollback tracking
   - Trigger reasons
   - Files reverted
   - Success tracking

**Indexes:** 25+ indexes for fast lookups and analytics

**Views:**
- `v_agent_performance` - Agent metrics summary
- `v_verification_trends` - Daily verification trends
- `v_pattern_effectiveness` - Pattern success rates
- `v_prediction_accuracy` - Prediction quality
- `v_failure_patterns` - Common failure analysis

## 🔧 Migration System

### Features

- ✅ **Idempotent**: Can run multiple times safely
- ✅ **Version Tracking**: Tracks applied schema versions
- ✅ **Validation**: Verifies schema integrity
- ✅ **Reset Support**: Clean rebuild capability
- ✅ **Statistics**: Database size and row counts
- ✅ **Foreign Keys**: Enforces referential integrity

### Migration Process

1. **Load Schema Files**: Reads all `.sql` files in order (00-, 01-, 02-)
2. **Check Versions**: Skips already-applied schemas
3. **Execute Statements**: Runs SQL with error handling
4. **Track Progress**: Updates `schema_version` table
5. **Verify Integrity**: Validates schema and constraints

### Version Tracking

All migrations are tracked in the `schema_version` table:

```sql
SELECT * FROM schema_version;
-- Returns:
-- version                    | description                              | applied_at
-- 1.0.0-core                 | Core schema with patterns and memory     | 2025-10-15 ...
-- 1.0.0-goap                 | GOAP planning and learning schema        | 2025-10-15 ...
-- 1.0.0-verification         | Verification and reliability schema      | 2025-10-15 ...
```

## 📈 Performance Targets

- **Query Time**: <50ms for most queries, <10ms for cached patterns
- **Insert Time**: <10ms for all operations
- **Pattern Retrieval**: <10ms with indexes
- **Memory Compression**: 60% compression with full recall
- **Operations/Second**: 172,000+ target

## 🔍 Database Location

Default database path: `.swarm/memory.db`

Override with `--db` flag:
```bash
npm run db:migrate -- --db /path/to/custom.db
```

## 📚 Usage Examples

### Query Patterns

```sql
-- Get most effective patterns
SELECT * FROM v_pattern_effectiveness
WHERE success_rate > 0.8
ORDER BY usage_count DESC
LIMIT 10;

-- Get GOAP planning performance
SELECT * FROM v_goap_planning_performance
WHERE date >= date('now', '-7 days');

-- Check agent reliability
SELECT * FROM v_agent_performance
WHERE reliability > 0.9
ORDER BY total_verifications DESC;
```

### Insert Example Data

```sql
-- Insert a pattern
INSERT INTO patterns (id, type, pattern_data, confidence)
VALUES ('pat-001', 'coordination', '{"action": "test"}', 0.8);

-- Insert GOAP pattern
INSERT INTO goap_patterns (
  id, type, goal, initial_state, final_state,
  action_sequence, cost, context_data, pattern_data
) VALUES (
  'goap-001', 'action_sequence', 'deploy_api',
  '{"deployed": false}', '{"deployed": true}',
  '[{"action": "build"}, {"action": "test"}, {"action": "deploy"}]',
  15.5, '{"env": "production"}', '{}'
);

-- Insert verification outcome
INSERT INTO verification_outcomes (
  id, task_id, agent_id, agent_type, passed,
  truth_score, threshold, duration
) VALUES (
  'vo-001', 'task-001', 'agent-coder-1', 'coder',
  1, 0.97, 0.95, 1250
);
```

## 🛠️ Maintenance

### Cleanup Old Data

```sql
-- Remove old trajectories (keep 90 days)
DELETE FROM task_trajectories
WHERE julianday('now') - julianday(created_at) > 90;

-- Remove low-confidence patterns
DELETE FROM patterns
WHERE confidence < 0.3 AND usage_count < 5;

-- Clean expired memory entries
DELETE FROM memory_entries
WHERE expires_at IS NOT NULL
  AND expires_at < strftime('%s', 'now');
```

### Rebuild Statistics

```sql
-- Update GOAP statistics
INSERT INTO goap_statistics (
  total_plans_generated,
  pattern_based_plans,
  average_planning_time_ms,
  pattern_reuse_rate,
  recorded_at
)
SELECT
  COUNT(*),
  SUM(CASE WHEN pattern_id IS NOT NULL THEN 1 ELSE 0 END),
  0,  -- Computed elsewhere
  CAST(SUM(CASE WHEN pattern_id IS NOT NULL THEN 1 ELSE 0 END) AS REAL) / COUNT(*),
  datetime('now')
FROM goap_plans
WHERE created_at >= datetime('now', '-1 day');
```

### Vacuum and Optimize

```sql
-- Reclaim space and optimize
VACUUM;

-- Analyze for query planner
ANALYZE;

-- Rebuild statistics
PRAGMA optimize;
```

## 🔒 Security and Integrity

### Foreign Keys

All foreign key constraints are enforced:
```sql
PRAGMA foreign_keys = ON;
```

### Triggers

Automatic data integrity triggers:
- Update agent reliability on verification
- Update pattern statistics on usage
- Track prediction accuracy
- Clean expired memory entries

### Validation

Built-in integrity checks:
```bash
# Run full validation
npm run db:migrate -- --verify
```

## 📖 Additional Documentation

- [GOAP Schema Details](../goap/schema.sql) - Original GOAP schema file
- [Verification Schema Details](../neural/verification-schema.sql) - Original verification schema
- [Integration Guide](../../docs/integration/README.md) - System integration docs
- [Neural Architecture](../../docs/neural/architecture.md) - Neural system design

## 🎯 Key Features

### Pattern Learning
- ✅ Automatic pattern extraction from successful operations
- ✅ Confidence scoring with Bayesian updates
- ✅ Pattern versioning and supersession
- ✅ Vector similarity search

### GOAP Integration
- ✅ 60% faster planning with pattern reuse
- ✅ A* heuristic learning
- ✅ Adaptive replanning
- ✅ Action performance tracking

### Verification Learning
- ✅ Predictive truth scoring
- ✅ Adaptive threshold management
- ✅ Agent reliability tracking
- ✅ Automatic rollback on failures

## 🐛 Troubleshooting

### Migration Fails

```bash
# Reset and rebuild
npm run db:migrate -- --reset

# Force reapply all schemas
npm run db:migrate -- --force
```

### Integrity Check Fails

```bash
# Run detailed verification
npm run db:migrate -- --verify

# Check foreign keys
sqlite3 .swarm/memory.db "PRAGMA foreign_key_check;"
```

### Performance Issues

```bash
# Rebuild indexes
sqlite3 .swarm/memory.db "REINDEX;"

# Update statistics
sqlite3 .swarm/memory.db "ANALYZE;"

# Optimize database
sqlite3 .swarm/memory.db "PRAGMA optimize;"
```

## 📝 Contributing

When adding new tables:

1. Create new schema file: `src/database/schema/03-feature-schema.sql`
2. Follow naming convention: `0X-name-schema.sql`
3. Include version in schema file
4. Add comprehensive indexes
5. Create useful views for analytics
6. Document in this README
7. Test with `--reset` flag

## 📄 License

Part of the Claude-Flow SAFLA Neural Learning System.
