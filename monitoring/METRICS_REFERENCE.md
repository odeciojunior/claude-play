# Metrics Reference - Claude Code Monitoring

Complete reference of all metrics exposed by Claude Code for Prometheus monitoring.

## 📊 Metric Categories

- [Neural System Metrics](#neural-system-metrics) - Learning operations and patterns
- [Verification Metrics](#verification-metrics) - Truth scores and validation
- [Database Metrics](#database-metrics) - Query performance and connections
- [Cache Metrics](#cache-metrics) - Cache hit rates and efficiency
- [GOAP Metrics](#goap-metrics) - Planning and coordination
- [System Metrics](#system-metrics) - CPU, memory, and resources
- [HTTP Metrics](#http-metrics) - Request duration and status

---

## Neural System Metrics

### `neural_operations_total` (Counter)
Total number of neural system operations performed.

**Labels:**
- `operation_type`: `learning`, `retrieval`, `extraction`

**Usage:**
```typescript
recordNeuralOperation('learning');
```

**Query Examples:**
```promql
# Operations per second
rate(neural_operations_total[5m])

# By operation type
rate(neural_operations_total[5m]) by (operation_type)
```

**Target:** 150,000+ ops/sec

---

### `pattern_confidence` (Histogram)
Distribution of pattern confidence scores across learned patterns.

**Labels:**
- `pattern_type`: `coordination`, `optimization`, `prediction`

**Buckets:** 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0

**Usage:**
```typescript
recordPatternConfidence('coordination', 0.87);
```

**Query Examples:**
```promql
# Average confidence
avg(pattern_confidence)

# 95th percentile
histogram_quantile(0.95, rate(pattern_confidence_bucket[5m]))

# By pattern type
avg(pattern_confidence) by (pattern_type)
```

**Target:** 0.7-0.9 average confidence

---

### `pattern_memory_bytes` (Gauge)
Current memory usage by pattern storage system in bytes.

**Usage:**
```typescript
patternMemoryBytes.set(memorySize);
```

**Query Examples:**
```promql
# Memory in MB
pattern_memory_bytes / 1048576

# Growth rate per hour
rate(pattern_memory_bytes[1h]) * 3600
```

**Target:** Varies by system, monitor growth rate

---

### `memory_compression_ratio` (Gauge)
Memory compression efficiency (compressed size / original size).

**Usage:**
```typescript
memoryCompressionRatio.set(0.62); // 62% compression
```

**Query Examples:**
```promql
memory_compression_ratio
```

**Target:** 0.60 (60% compression)

---

### `feedback_loop_cycles_total` (Counter)
Total number of completed feedback loop cycles in neural learning.

**Usage:**
```typescript
feedbackLoopCycles.inc();
```

**Query Examples:**
```promql
# Cycles per second
rate(feedback_loop_cycles_total[5m])

# Total cycles today
increase(feedback_loop_cycles_total[24h])
```

---

### `patterns_learned_total` (Counter)
Total number of patterns learned by the system.

**Labels:**
- `pattern_type`: `coordination`, `optimization`, `prediction`

**Usage:**
```typescript
recordPatternLearned('coordination');
```

**Query Examples:**
```promql
# Learning rate
rate(patterns_learned_total[5m])

# Total learned by type
sum(patterns_learned_total) by (pattern_type)
```

---

### `pattern_reused_total` (Counter)
Number of times existing patterns were reused.

**Labels:**
- `pattern_type`: `coordination`, `optimization`, `prediction`

**Usage:**
```typescript
patternReusedTotal.inc({ pattern_type: 'coordination' });
```

---

### `pattern_applied_total` (Counter)
Number of times patterns were applied (reused + new).

**Labels:**
- `pattern_type`: `coordination`, `optimization`, `prediction`

**Usage:**
```typescript
patternAppliedTotal.inc({ pattern_type: 'coordination' });
```

**Query Examples:**
```promql
# Pattern reuse rate
rate(pattern_reused_total[5m]) / rate(pattern_applied_total[5m])
```

**Target:** 80%+ reuse rate

---

### `pattern_retrieval_duration_seconds` (Histogram)
Duration of pattern retrieval operations from memory.

**Buckets:** 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1

**Usage:**
```typescript
await recordPatternRetrieval(async () => {
  return await getPatternFromDb(patternId);
});
```

**Query Examples:**
```promql
# 95th percentile retrieval time
histogram_quantile(0.95, rate(pattern_retrieval_duration_seconds_bucket[5m]))

# Average retrieval time
rate(pattern_retrieval_duration_seconds_sum[5m]) / rate(pattern_retrieval_duration_seconds_count[5m])
```

**Target:** <10ms (0.010s) for P95

---

### `pattern_extraction_errors_total` (Counter)
Number of errors during pattern extraction from operations.

**Labels:**
- `error_type`: `parse_error`, `validation_error`, `storage_error`

**Usage:**
```typescript
patternExtractionErrors.inc({ error_type: 'parse_error' });
```

---

## Verification Metrics

### `truth_score` (Histogram)
Distribution of verification truth scores across all verifications.

**Labels:**
- `agent_id`: `coder`, `reviewer`, `tester`, etc.

**Buckets:** 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0

**Usage:**
```typescript
recordVerification('coder-agent', 0.96, true);
```

**Query Examples:**
```promql
# P95 truth score
histogram_quantile(0.95, rate(truth_score_bucket[5m]))

# Average by agent
avg(truth_score) by (agent_id)
```

**Target:** >0.95 (95%) for P95

---

### `verification_success_total` (Counter)
Total number of successful verifications (above threshold).

**Labels:**
- `agent_id`: Agent performing the verification

**Query Examples:**
```promql
# Success rate per second
rate(verification_success_total[5m])

# By agent
rate(verification_success_total[5m]) by (agent_id)
```

---

### `verification_failures_total` (Counter)
Total number of failed verifications (below threshold).

**Labels:**
- `agent_id`: Agent performing the verification
- `reason`: `threshold_not_met`, `timeout`, `error`

**Query Examples:**
```promql
# Failure rate
rate(verification_failures_total[5m])

# Success ratio
rate(verification_success_total[5m]) / (rate(verification_success_total[5m]) + rate(verification_failures_total[5m]))
```

**Target:** <5% failure rate

---

### `auto_rollback_total` (Counter)
Number of automatic rollbacks triggered by verification failures.

**Labels:**
- `reason`: `truth_score_low`, `compilation_failed`, `tests_failed`

**Usage:**
```typescript
autoRollbackTotal.inc({ reason: 'truth_score_low' });
```

---

### `agent_truth_score` (Gauge)
Current truth score for each agent (updated on each verification).

**Labels:**
- `agent_id`: Unique agent identifier

**Usage:**
```typescript
agentTruthScore.set({ agent_id: 'coder' }, 0.97);
```

**Query Examples:**
```promql
# Current scores by agent
agent_truth_score

# Agents below threshold
agent_truth_score < 0.85
```

---

### `agent_task_duration_seconds` (Histogram)
Duration of task execution by agents.

**Labels:**
- `agent_id`: Agent identifier
- `task_type`: `feature`, `bugfix`, `refactor`, `test`

**Buckets:** 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300

**Usage:**
```typescript
const end = agentTaskDuration.startTimer({ agent_id: 'coder', task_type: 'feature' });
// ... do work ...
end();
```

---

## Database Metrics

### `db_query_duration_seconds` (Histogram)
Duration of database query executions.

**Labels:**
- `query_type`: `select`, `insert`, `update`, `delete`
- `table`: `patterns`, `embeddings`, `trajectories`, `metrics_log`

**Buckets:** 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1

**Usage:**
```typescript
await recordDbQuery('select', 'patterns', async () => {
  return await db.query('SELECT * FROM patterns WHERE id = ?', [id]);
});
```

**Query Examples:**
```promql
# P95 query time
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))

# Slow queries (>50ms)
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 0.050

# By table
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) by (table)
```

**Target:** <10ms (0.010s) for P95

---

### `database_connection_errors_total` (Counter)
Total number of database connection errors.

**Labels:**
- `error_type`: `connection_refused`, `timeout`, `auth_failed`, `query_failed`

**Usage:**
```typescript
dbConnectionErrors.inc({ error_type: 'connection_refused' });
```

---

## Cache Metrics

### `cache_hits_total` (Counter)
Total number of cache hits.

**Labels:**
- `cache_type`: `pattern`, `vector`, `query`

**Usage:**
```typescript
recordCacheAccess('pattern', true); // hit
```

---

### `cache_misses_total` (Counter)
Total number of cache misses.

**Labels:**
- `cache_type`: `pattern`, `vector`, `query`

**Usage:**
```typescript
recordCacheAccess('pattern', false); // miss
```

---

### `cache_hit_rate` (Gauge)
Current cache hit rate (calculated from hits and misses).

**Labels:**
- `cache_type`: `pattern`, `vector`, `query`

**Query Examples:**
```promql
# Current hit rate
cache_hit_rate

# Manual calculation
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

**Target:** >0.80 (80%)

---

## GOAP Metrics

### `goap_planning_duration_seconds` (Histogram)
Duration of GOAP planning operations.

**Labels:**
- `plan_type`: `feature_implementation`, `optimization`, `migration`

**Buckets:** 0.1, 0.25, 0.5, 1, 2, 5, 10, 30

**Usage:**
```typescript
await recordGoapPlanning('feature_implementation', async () => {
  return await planner.createPlan(goal, currentState);
});
```

**Query Examples:**
```promql
# P95 planning time
histogram_quantile(0.95, rate(goap_planning_duration_seconds_bucket[5m]))
```

**Target:** <5s for P95

---

### `coordination_efficiency` (Gauge)
Current coordination efficiency across swarm agents (0-1).

**Usage:**
```typescript
coordinationEfficiency.set(0.96);
```

**Target:** >0.95 (95%)

---

### `task_completed_total` (Counter)
Total number of completed tasks.

**Labels:**
- `task_type`: `feature`, `bugfix`, `refactor`, `test`
- `status`: `success`, `failure`

**Usage:**
```typescript
recordTaskCompletion('feature', 'success');
```

**Query Examples:**
```promql
# Completion rate
rate(task_completed_total[5m])

# Success rate
rate(task_completed_total{status="success"}[5m]) / rate(task_completed_total[5m])
```

---

### `background_task_queue_length` (Gauge)
Current number of tasks waiting in background queue.

**Usage:**
```typescript
backgroundTaskQueueLength.set(queue.length);
```

**Target:** <100 tasks

---

## System Metrics

These are automatically collected by Prometheus Node.js client:

### `process_cpu_seconds_total` (Counter)
Total CPU time used by the process.

### `process_resident_memory_bytes` (Gauge)
Resident memory size in bytes.

**Target:** <104857600 (100MB)

### `nodejs_eventloop_lag_seconds` (Gauge)
Event loop lag in seconds.

### `nodejs_gc_duration_seconds` (Summary)
Garbage collection duration.

### `nodejs_heap_size_total_bytes` (Gauge)
Total heap size.

### `nodejs_heap_size_used_bytes` (Gauge)
Used heap size.

---

## HTTP Metrics

### `http_request_duration_seconds` (Histogram)
Duration of HTTP requests.

**Labels:**
- `method`: `GET`, `POST`, `PUT`, `DELETE`
- `route`: Request route/path
- `status_code`: HTTP status code

**Buckets:** 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5

**Usage:**
Automatically recorded via middleware:
```typescript
app.use(requestDurationMiddleware);
```

---

## General Error Tracking

### `errors_total` (Counter)
Total number of errors across the system.

**Labels:**
- `error_type`: Error classification
- `severity`: `low`, `medium`, `high`, `critical`

**Usage:**
```typescript
recordError('validation_error', 'medium');
```

---

## Recording Rules

Pre-computed metrics for faster queries (defined in `recording-rules.yml`):

- `neural:operations_per_second:rate5m` - Neural ops/sec (5m)
- `cache:hit_rate:ratio` - Cache hit rate
- `verification:truth_score:p95` - P95 truth score
- `db:query_duration_seconds:p95` - P95 query time
- `neural:pattern_confidence:avg` - Average pattern confidence
- `process:memory_mb` - Memory in MB
- `process:cpu_usage:rate5m` - CPU usage %

---

## PromQL Query Examples

### Performance Monitoring
```promql
# Operations per second over time
rate(neural_operations_total[5m])

# Memory usage trend
process_resident_memory_bytes / 1048576

# Database load
rate(db_query_duration_seconds_count[5m])
```

### Quality Monitoring
```promql
# Truth score distribution
histogram_quantile(0.95, rate(truth_score_bucket[5m]))

# Pattern confidence by type
avg(pattern_confidence) by (pattern_type)

# Verification success rate
rate(verification_success_total[5m]) / (rate(verification_success_total[5m]) + rate(verification_failures_total[5m]))
```

### Resource Monitoring
```promql
# CPU usage
rate(process_cpu_seconds_total[5m]) * 100

# Memory growth
rate(process_resident_memory_bytes[1h]) * 3600

# Cache efficiency
cache_hit_rate
```

### Alerting Queries
```promql
# Service down
up{job="claude-code-app"} == 0

# High error rate
rate(errors_total[5m]) > 0.1

# Low truth score
histogram_quantile(0.95, rate(truth_score_bucket[5m])) < 0.95
```

---

## Metric Naming Conventions

All metrics follow Prometheus naming best practices:

- **Counters**: `_total` suffix (e.g., `neural_operations_total`)
- **Histograms**: `_seconds` for duration, `_bytes` for size
- **Gauges**: No suffix, current state
- **Units**: `_seconds`, `_bytes`, `_ratio` (0-1), `_percent` (0-100)

---

**Last Updated:** 2025-10-15
**Total Metrics:** 20+ custom metrics + Node.js defaults
**Total Labels:** 30+ label combinations
