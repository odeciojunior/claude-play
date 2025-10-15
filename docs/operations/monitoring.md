# Monitoring & Alerting

## Overview

This runbook covers comprehensive monitoring and alerting for the Claude Code self-learning AI system, including neural network performance, verification accuracy, and system health metrics.

## Key Performance Metrics

### Critical Metrics (Monitor Continuously)

#### 1. Neural Operations Performance

```bash
# Check operations per second
sqlite3 .swarm/memory.db "
SELECT
  COUNT(*) * 1.0 / (julianday('now') - julianday(MIN(created_at))) / 86400.0 as ops_per_second
FROM task_trajectories
WHERE created_at > datetime('now', '-1 hour');
"

# Target: > 150,000 ops/sec
# Warning: < 100,000 ops/sec
# Critical: < 50,000 ops/sec
```

#### 2. Pattern Cache Hit Rate

```bash
# Calculate cache hit rate
sqlite3 .swarm/memory.db "
SELECT
  ROUND(
    100.0 * SUM(CASE WHEN last_used > datetime('now', '-1 hour') THEN usage_count ELSE 0 END) /
    NULLIF(SUM(usage_count), 0),
    2
  ) as cache_hit_rate_percent
FROM patterns;
"

# Target: > 80%
# Warning: < 70%
# Critical: < 60%
```

#### 3. Truth Verification Score

```bash
# Get current truth score
./claude-flow truth --json | jq '.overall.score'

# Target: > 0.95
# Warning: < 0.90
# Critical: < 0.85
```

#### 4. Pattern Confidence Distribution

```bash
# Check pattern confidence levels
sqlite3 .swarm/memory.db "
SELECT
  CASE
    WHEN confidence >= 0.9 THEN 'excellent (0.9+)'
    WHEN confidence >= 0.7 THEN 'good (0.7-0.9)'
    WHEN confidence >= 0.5 THEN 'moderate (0.5-0.7)'
    ELSE 'low (<0.5)'
  END as confidence_level,
  COUNT(*) as pattern_count,
  ROUND(AVG(usage_count), 2) as avg_usage
FROM patterns
GROUP BY confidence_level
ORDER BY MIN(confidence) DESC;
"

# Target: 60%+ patterns with confidence > 0.7
```

#### 5. Memory Database Size

```bash
# Check database size
du -h .swarm/memory.db

# Check table sizes
sqlite3 .swarm/memory.db "
SELECT
  name,
  ROUND(SUM(pgsize) / 1024.0 / 1024.0, 2) as size_mb
FROM dbstat
GROUP BY name
ORDER BY size_mb DESC;
"

# Warning: > 500 MB
# Critical: > 1 GB
```

#### 6. Agent Reliability Scores

```bash
# Check agent truth scores
./claude-flow truth --json | jq '.agents[] | {name: .name, score: .score, tasks: .tasks_completed}' | jq -s 'sort_by(-.score)'

# Target: All agents > 0.90
# Warning: Any agent < 0.85
# Critical: Any agent < 0.75
```

### Secondary Metrics (Monitor Hourly)

#### 7. Pattern Reuse Rate

```bash
sqlite3 .swarm/memory.db "
SELECT
  ROUND(100.0 * COUNT(CASE WHEN usage_count > 1 THEN 1 END) / COUNT(*), 2) as reuse_rate_percent
FROM patterns;
"

# Target: > 80%
```

#### 8. Learning Pipeline Efficiency

```bash
sqlite3 .swarm/memory.db "
SELECT
  COUNT(*) as patterns_learned_today,
  ROUND(AVG(confidence), 3) as avg_confidence,
  COUNT(DISTINCT type) as pattern_types
FROM patterns
WHERE created_at > datetime('now', '-1 day');
"

# Target: 100+ patterns/day with avg confidence > 0.6
```

#### 9. Memory Compression Ratio

```bash
sqlite3 .swarm/memory.db "
SELECT
  ROUND(
    (1.0 - CAST(total(LENGTH(pattern_data)) AS REAL) /
     CAST(total(LENGTH(pattern_data) + 1000) AS REAL)) * 100,
    2
  ) as compression_ratio_percent
FROM patterns;
"

# Target: ~60%
```

#### 10. GOAP Planning Efficiency

```bash
# Check average plan generation time
sqlite3 .swarm/memory.db "
SELECT
  AVG(execution_time_ms) as avg_planning_time_ms,
  MAX(execution_time_ms) as max_planning_time_ms
FROM task_trajectories
WHERE task_type = 'goap_planning'
  AND created_at > datetime('now', '-1 hour');
"

# Target: < 50ms average
# Warning: > 100ms average
```

## Alert Thresholds

### P0 - Critical (Immediate Response Required)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Neural operations/sec | < 50,000 | Page on-call, investigate immediately |
| Truth verification score | < 0.85 | Trigger auto-rollback, page on-call |
| Cache hit rate | < 60% | Page on-call, check memory system |
| Database corruption | Integrity check fails | Stop system, restore backup |
| Agent quarantine rate | > 10% of agents | Page on-call, investigate agent issues |

### P1 - High Priority (Response Within 15 Minutes)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Neural operations/sec | < 100,000 | Alert on-call, investigate performance |
| Truth verification score | < 0.90 | Alert team, review recent changes |
| Cache hit rate | < 70% | Alert team, optimize cache |
| Memory database size | > 1 GB | Alert DBA, plan compression |
| Pattern confidence | < 50% high-confidence | Alert team, retrain patterns |

### P2 - Medium Priority (Response Within 1 Hour)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Neural operations/sec | < 150,000 | Ticket created, investigate |
| Truth verification score | < 0.95 | Review verification logs |
| Cache hit rate | < 80% | Optimize caching strategy |
| Pattern reuse rate | < 80% | Review pattern extraction |
| GOAP planning time | > 100ms avg | Optimize A* heuristics |

### P3 - Low Priority (Response Within 4 Hours)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Memory database size | > 500 MB | Plan maintenance |
| Learning rate | < 50 patterns/day | Review learning pipeline |
| Log file size | > 100 MB | Rotate logs |

## Dashboard Setup

### Prometheus Configuration

Create `/etc/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'claude-code'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

rule_files:
  - '/etc/prometheus/rules/claude-code-alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']
```

### Alert Rules

Create `/etc/prometheus/rules/claude-code-alerts.yml`:

```yaml
groups:
  - name: neural_system
    interval: 30s
    rules:
      - alert: NeuralOperationsSlow
        expr: neural_operations_per_second < 100000
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "Neural operations below threshold"
          description: "Operations/sec: {{ $value }}, Target: 150000+"

      - alert: CacheHitRateLow
        expr: pattern_cache_hit_rate < 0.70
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Cache hit rate below 70%"
          description: "Current rate: {{ $value }}"

  - name: verification_system
    interval: 60s
    rules:
      - alert: TruthScoreCritical
        expr: truth_verification_score < 0.85
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Truth score below critical threshold"
          description: "Score: {{ $value }}, triggering rollback"

      - alert: TruthScoreLow
        expr: truth_verification_score < 0.95
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Truth score below target"
          description: "Score: {{ $value }}, Target: 0.95+"

  - name: database_health
    interval: 120s
    rules:
      - alert: DatabaseSizeLarge
        expr: memory_database_size_mb > 1000
        for: 10m
        labels:
          severity: high
        annotations:
          summary: "Memory database exceeding 1GB"
          description: "Size: {{ $value }}MB, consider compression"

      - alert: DatabaseCorruption
        expr: database_integrity_check_failed == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database integrity check failed"
          description: "Immediate action required"
```

### Grafana Dashboard

Create `/etc/grafana/provisioning/dashboards/claude-code.json`:

```json
{
  "dashboard": {
    "title": "Claude Code - Neural System Monitoring",
    "panels": [
      {
        "title": "Neural Operations per Second",
        "targets": [
          {
            "expr": "rate(neural_operations_total[1m])",
            "legendFormat": "ops/sec"
          }
        ],
        "thresholds": [
          {"value": 150000, "color": "green"},
          {"value": 100000, "color": "yellow"},
          {"value": 50000, "color": "red"}
        ]
      },
      {
        "title": "Truth Verification Score",
        "targets": [
          {
            "expr": "truth_verification_score",
            "legendFormat": "Overall Score"
          }
        ],
        "thresholds": [
          {"value": 0.95, "color": "green"},
          {"value": 0.90, "color": "yellow"},
          {"value": 0.85, "color": "red"}
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "pattern_cache_hit_rate",
            "legendFormat": "Hit Rate %"
          }
        ],
        "thresholds": [
          {"value": 0.80, "color": "green"},
          {"value": 0.70, "color": "yellow"},
          {"value": 0.60, "color": "red"}
        ]
      },
      {
        "title": "Pattern Confidence Distribution",
        "targets": [
          {
            "expr": "patterns_by_confidence_bucket",
            "legendFormat": "{{confidence_level}}"
          }
        ]
      },
      {
        "title": "Memory Database Size",
        "targets": [
          {
            "expr": "memory_database_size_mb",
            "legendFormat": "Size (MB)"
          }
        ]
      },
      {
        "title": "Agent Reliability Scores",
        "targets": [
          {
            "expr": "agent_truth_score",
            "legendFormat": "{{agent_name}}"
          }
        ]
      }
    ]
  }
}
```

## Log Aggregation and Analysis

### Log Collection Setup

```bash
# Configure rsyslog for centralized logging
cat > /etc/rsyslog.d/claude-code.conf << 'EOF'
# Claude Code application logs
if $programname == 'claude-code' then /var/log/claude-code/application.log
& stop

# Neural system logs
if $programname == 'neural-system' then /var/log/claude-code/neural.log
& stop

# Verification logs
if $programname == 'verification-system' then /var/log/claude-code/verification.log
& stop
EOF

systemctl restart rsyslog
```

### Log Analysis Commands

```bash
# Check for errors in last hour
grep -i error /var/log/claude-code/application.log | grep "$(date '+%Y-%m-%d %H')"

# Count errors by type
awk '/ERROR/ {print $5}' /var/log/claude-code/application.log | sort | uniq -c | sort -rn

# Check verification failures
grep "verification_failed" /var/log/claude-code/verification.log | tail -20

# Monitor neural learning in real-time
tail -f /var/log/claude-code/neural.log | grep "pattern_learned"

# Check GOAP planning performance
grep "goap_planning" /var/log/claude-code/application.log | awk '{sum+=$NF; count++} END {print "Avg planning time:", sum/count, "ms"}'
```

### Log Rotation Configuration

```bash
cat > /etc/logrotate.d/claude-code << 'EOF'
/var/log/claude-code/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 claude-code claude-code
    sharedscripts
    postrotate
        systemctl reload claude-code > /dev/null 2>&1 || true
    endscript
}
EOF
```

## Performance Degradation Detection

### Automated Performance Check Script

Create `/usr/local/bin/check-neural-performance.sh`:

```bash
#!/bin/bash

# Performance baseline targets
MIN_OPS_SEC=150000
MIN_CACHE_HIT_RATE=0.80
MIN_TRUTH_SCORE=0.95

# Check neural operations
OPS_SEC=$(sqlite3 /opt/claude-code-production/.swarm/memory.db "
  SELECT COUNT(*) * 1.0 / (julianday('now') - julianday(MIN(created_at))) / 86400.0
  FROM task_trajectories
  WHERE created_at > datetime('now', '-1 hour');
")

if (( $(echo "$OPS_SEC < $MIN_OPS_SEC" | bc -l) )); then
  echo "WARNING: Operations/sec ($OPS_SEC) below target ($MIN_OPS_SEC)"
  curl -X POST $SLACK_WEBHOOK -d "{\"text\":\"Neural operations degraded: $OPS_SEC ops/sec\"}"
fi

# Check cache hit rate
CACHE_HIT=$(sqlite3 /opt/claude-code-production/.swarm/memory.db "
  SELECT ROUND(
    100.0 * SUM(CASE WHEN last_used > datetime('now', '-1 hour') THEN usage_count ELSE 0 END) /
    NULLIF(SUM(usage_count), 0) / 100.0,
    2
  )
  FROM patterns;
")

if (( $(echo "$CACHE_HIT < $MIN_CACHE_HIT_RATE" | bc -l) )); then
  echo "WARNING: Cache hit rate ($CACHE_HIT) below target ($MIN_CACHE_HIT_RATE)"
  curl -X POST $SLACK_WEBHOOK -d "{\"text\":\"Cache hit rate degraded: $CACHE_HIT\"}"
fi

# Check truth score
TRUTH_SCORE=$(cd /opt/claude-code-production && ./claude-flow truth --json | jq -r '.overall.score')

if (( $(echo "$TRUTH_SCORE < $MIN_TRUTH_SCORE" | bc -l) )); then
  echo "CRITICAL: Truth score ($TRUTH_SCORE) below target ($MIN_TRUTH_SCORE)"
  curl -X POST $PAGERDUTY_WEBHOOK -d "{\"severity\":\"critical\",\"summary\":\"Truth score critical: $TRUTH_SCORE\"}"
fi
```

### Schedule Performance Checks

```bash
# Add to crontab
crontab -e

# Run performance check every 5 minutes
*/5 * * * * /usr/local/bin/check-neural-performance.sh >> /var/log/claude-code/performance-check.log 2>&1
```

## Neural Learning Health Indicators

### Learning Pipeline Health Check

```bash
# Check recent learning activity
sqlite3 .swarm/memory.db "
SELECT
  date(created_at) as date,
  COUNT(*) as patterns_learned,
  ROUND(AVG(confidence), 3) as avg_confidence,
  COUNT(DISTINCT type) as pattern_types
FROM patterns
WHERE created_at > datetime('now', '-7 days')
GROUP BY date(created_at)
ORDER BY date DESC;
"
```

### Pattern Quality Metrics

```bash
# Check pattern quality over time
sqlite3 .swarm/memory.db "
SELECT
  strftime('%Y-%m-%d %H:00', created_at) as hour,
  COUNT(*) as patterns,
  ROUND(AVG(confidence), 3) as avg_confidence,
  COUNT(CASE WHEN confidence > 0.8 THEN 1 END) as high_quality_patterns
FROM patterns
WHERE created_at > datetime('now', '-24 hours')
GROUP BY hour
ORDER BY hour DESC;
"
```

### Feedback Loop Analysis

```bash
# Check feedback loop effectiveness
sqlite3 .swarm/memory.db "
SELECT
  type as pattern_type,
  COUNT(*) as total_patterns,
  ROUND(AVG(confidence), 3) as avg_confidence,
  ROUND(AVG(usage_count), 1) as avg_reuse,
  MAX(confidence) as max_confidence
FROM patterns
GROUP BY type
ORDER BY avg_confidence DESC;
"
```

## Monitoring Command Reference

### Quick Health Check

```bash
#!/bin/bash
# Quick system health check

echo "=== Neural System Health ==="
npx claude-flow neural status

echo -e "\n=== Verification Status ==="
./claude-flow verify status

echo -e "\n=== Truth Scores ==="
./claude-flow truth --report

echo -e "\n=== Database Size ==="
du -h .swarm/memory.db

echo -e "\n=== Recent Errors ==="
tail -100 /var/log/claude-code/application.log | grep -i error | tail -5

echo -e "\n=== Performance Metrics ==="
sqlite3 .swarm/memory.db "
SELECT
  'Operations (1h)' as metric,
  COUNT(*) || ' ops' as value
FROM task_trajectories
WHERE created_at > datetime('now', '-1 hour')
UNION ALL
SELECT
  'Patterns Learned',
  COUNT(*) || ' patterns'
FROM patterns
WHERE created_at > datetime('now', '-1 day')
UNION ALL
SELECT
  'Avg Confidence',
  ROUND(AVG(confidence), 3)
FROM patterns
WHERE created_at > datetime('now', '-1 day');
"
```

## Related Documentation

- `/docs/operations/incident-response.md` - Incident handling
- `/docs/operations/deployment.md` - Deployment procedures
- `/docs/operations/database.md` - Database operations
- `/docs/neural/architecture.md` - Neural system design
- `/docs/integration/metrics.md` - Success metrics
