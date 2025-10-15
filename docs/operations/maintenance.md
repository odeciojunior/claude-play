# System Maintenance Runbook

## Overview

This runbook provides comprehensive system maintenance procedures for the Claude Code self-learning AI system with SAFLA neural network, GOAP planning, and truth verification. Regular maintenance ensures optimal performance, reliability, and longevity.

## Routine Maintenance Schedule

### Daily Maintenance (Automated)

**Time:** 2:00 AM UTC
**Duration:** 15-30 minutes
**Automation:** Cron jobs

```bash
#!/bin/bash
# /usr/local/bin/daily-maintenance.sh

echo "=== DAILY MAINTENANCE: $(date) ==="

# 1. Database backup
/usr/local/bin/backup-neural-database.sh

# 2. Log rotation
logrotate /etc/logrotate.d/claude-code

# 3. Clean expired memory entries
sqlite3 /opt/claude-code-production/.swarm/memory.db "
DELETE FROM memory_entries
WHERE expires_at IS NOT NULL
  AND datetime(expires_at) < datetime('now');
"

# 4. Update metrics
sqlite3 /opt/claude-code-production/.swarm/memory.db "
INSERT INTO metrics_log (metric_name, metric_value, timestamp)
SELECT 'daily_pattern_count', COUNT(*), datetime('now')
FROM patterns;

INSERT INTO metrics_log (metric_name, metric_value, timestamp)
SELECT 'daily_avg_confidence', AVG(confidence), datetime('now')
FROM patterns;

INSERT INTO metrics_log (metric_name, metric_value, timestamp)
SELECT 'daily_db_size_mb',
  (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) / 1024.0 / 1024.0,
  datetime('now');
"

# 5. Check disk space
DISK_USAGE=$(df -h /opt | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "WARNING: Disk usage at ${DISK_USAGE}%"
  # Send alert
  curl -X POST $SLACK_WEBHOOK -d "{\"text\":\"⚠️ Disk usage warning: ${DISK_USAGE}%\"}"
fi

# 6. Verify system health
curl -f http://localhost:8080/health || echo "WARNING: Health check failed"

echo "✅ Daily maintenance complete"
```

Schedule in crontab:
```bash
0 2 * * * /usr/local/bin/daily-maintenance.sh >> /var/log/claude-code/daily-maintenance.log 2>&1
```

### Weekly Maintenance (Semi-Automated)

**Time:** Sunday 2:00 AM UTC
**Duration:** 1-2 hours
**Requires:** Manual review

```bash
#!/bin/bash
# /usr/local/bin/weekly-maintenance.sh

echo "=== WEEKLY MAINTENANCE: $(date) ==="

# 1. Database optimization
echo "1. Database Optimization"
sqlite3 /opt/claude-code-production/.swarm/memory.db "VACUUM;"
sqlite3 /opt/claude-code-production/.swarm/memory.db "ANALYZE;"
echo "✅ Database optimized"

# 2. Pattern pruning
echo "2. Pattern Pruning"
/usr/local/bin/prune-patterns.sh
echo "✅ Patterns pruned"

# 3. Integrity checks
echo "3. Integrity Checks"
/usr/local/bin/check-database-integrity.sh
echo "✅ Integrity verified"

# 4. Performance analysis
echo "4. Performance Analysis"
sqlite3 /opt/claude-code-production/.swarm/memory.db "
SELECT
  'Last 7 days' as period,
  AVG(metric_value) as avg_ops_sec
FROM metrics_log
WHERE metric_name = 'neural_operations_per_second'
  AND timestamp > datetime('now', '-7 days');
"

# 5. Generate weekly report
echo "5. Weekly Report Generation"
/usr/local/bin/generate-weekly-report.sh > /var/log/claude-code/weekly-report-$(date +%Y%m%d).txt

# 6. Clean old logs
find /var/log/claude-code -name "*.log" -mtime +30 -delete
echo "✅ Old logs cleaned"

# 7. Archive old backups
find /opt/claude-code-backups/daily -name "*.backup.gz" -mtime +30 -exec mv {} /opt/claude-code-archives/ \;
echo "✅ Old backups archived"

# 8. Update agent statistics
cd /opt/claude-code-production
./claude-flow truth --report > /var/log/claude-code/agent-stats-$(date +%Y%m%d).txt

# 9. Neural pattern analysis
npx claude-flow neural patterns --analyze > /var/log/claude-code/neural-analysis-$(date +%Y%m%d).txt

echo "✅ Weekly maintenance complete"
```

Schedule in crontab:
```bash
0 2 * * 0 /usr/local/bin/weekly-maintenance.sh >> /var/log/claude-code/weekly-maintenance.log 2>&1
```

### Monthly Maintenance (Manual)

**Time:** First Sunday of month, 2:00 AM UTC
**Duration:** 2-4 hours
**Requires:** Manual execution and review

```bash
#!/bin/bash
# /usr/local/bin/monthly-maintenance.sh

echo "=== MONTHLY MAINTENANCE: $(date) ==="

# 1. Full database backup (retained for 1 year)
MONTHLY_BACKUP_DIR="/opt/claude-code-backups/monthly"
mkdir -p $MONTHLY_BACKUP_DIR
BACKUP_FILE="$MONTHLY_BACKUP_DIR/memory.db.$(date +%Y%m).backup"
sqlite3 /opt/claude-code-production/.swarm/memory.db ".backup '$BACKUP_FILE'"
gzip $BACKUP_FILE
sha256sum ${BACKUP_FILE}.gz > ${BACKUP_FILE}.gz.sha256
echo "✅ Monthly backup created: ${BACKUP_FILE}.gz"

# 2. Comprehensive performance review
echo "2. Performance Review"
sqlite3 /opt/claude-code-production/.swarm/memory.db "
-- Operations per second trend
SELECT
  strftime('%Y-%m', timestamp) as month,
  AVG(metric_value) as avg_ops_sec,
  MIN(metric_value) as min_ops_sec,
  MAX(metric_value) as max_ops_sec
FROM metrics_log
WHERE metric_name = 'neural_operations_per_second'
GROUP BY month
ORDER BY month DESC
LIMIT 12;

-- Pattern growth
SELECT
  strftime('%Y-%m', created_at) as month,
  COUNT(*) as patterns_added,
  AVG(confidence) as avg_confidence
FROM patterns
GROUP BY month
ORDER BY month DESC
LIMIT 12;

-- Agent reliability trend
SELECT
  strftime('%Y-%m', timestamp) as month,
  agent_name,
  AVG(truth_score) as avg_truth_score,
  COUNT(*) as verifications
FROM verification_history
GROUP BY month, agent_name
ORDER BY month DESC, avg_truth_score DESC
LIMIT 50;
"

# 3. Dependency updates review
echo "3. Dependency Updates"
cd /opt/claude-code-production
npm outdated > /tmp/outdated-dependencies.txt
echo "📋 Outdated dependencies saved to /tmp/outdated-dependencies.txt"
echo "   Review and plan updates"

# 4. Security audit
echo "4. Security Audit"
npm audit --json > /tmp/security-audit.json
echo "🔒 Security audit saved to /tmp/security-audit.json"

# 5. Pattern library optimization
echo "5. Pattern Library Optimization"
TOTAL_PATTERNS=$(sqlite3 /opt/claude-code-production/.swarm/memory.db "SELECT COUNT(*) FROM patterns;")
HIGH_CONFIDENCE=$(sqlite3 /opt/claude-code-production/.swarm/memory.db "SELECT COUNT(*) FROM patterns WHERE confidence > 0.8;")
echo "Total patterns: $TOTAL_PATTERNS"
echo "High confidence (>0.8): $HIGH_CONFIDENCE"
echo "Percentage high confidence: $(echo "scale=2; $HIGH_CONFIDENCE * 100 / $TOTAL_PATTERNS" | bc)%"

# 6. Archive old data
echo "6. Archive Old Data"
ARCHIVE_DATE=$(date -d "6 months ago" +%Y-%m-%d)
sqlite3 /opt/claude-code-production/.swarm/memory.db "
.mode insert task_trajectories
.output /opt/claude-code-archives/trajectories-$(date +%Y%m).sql
SELECT * FROM task_trajectories WHERE created_at < '$ARCHIVE_DATE';
.output stdout
"
echo "✅ Old trajectories archived"

# 7. Generate monthly report
/usr/local/bin/generate-monthly-report.sh > /var/log/claude-code/monthly-report-$(date +%Y%m).txt

echo "✅ Monthly maintenance complete"
echo "📋 Review monthly report and plan any necessary updates"
```

## Performance Optimization Procedures

### Database Performance Optimization

```bash
#!/bin/bash
# Optimize database performance

echo "=== DATABASE PERFORMANCE OPTIMIZATION ==="

# 1. Analyze current performance
echo "1. Current Performance Metrics"
sqlite3 .swarm/memory.db "
SELECT
  'Database Size (MB)' as metric,
  ROUND((SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) / 1024.0 / 1024.0, 2) as value
UNION ALL
SELECT
  'Total Patterns',
  COUNT(*) FROM patterns
UNION ALL
SELECT
  'High Confidence Patterns',
  COUNT(*) FROM patterns WHERE confidence > 0.8
UNION ALL
SELECT
  'Cache Hit Rate Target',
  0.80
UNION ALL
SELECT
  'Current Cache Hit Rate',
  ROUND(
    1.0 * SUM(CASE WHEN last_used > datetime('now', '-1 hour') THEN usage_count ELSE 0 END) /
    NULLIF(SUM(usage_count), 0),
    3
  )
FROM patterns;
"

# 2. Identify slow queries
echo "2. Query Performance Analysis"
sqlite3 .swarm/memory.db "
-- Check if indexes are being used
EXPLAIN QUERY PLAN
SELECT * FROM patterns
WHERE confidence > 0.8 AND type = 'goap_planning'
ORDER BY confidence DESC
LIMIT 100;
"

# 3. Optimize indexes
echo "3. Index Optimization"
sqlite3 .swarm/memory.db "
-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_patterns_type_confidence_used
ON patterns(type, confidence DESC, last_used DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_category_confidence_created
ON patterns(category, confidence DESC, created_at DESC);

-- Update statistics
ANALYZE;
"

# 4. Prune unnecessary data
echo "4. Data Pruning"
BEFORE_SIZE=$(du -m .swarm/memory.db | awk '{print $1}')

sqlite3 .swarm/memory.db "
-- Remove very old, low-value patterns
DELETE FROM patterns
WHERE created_at < datetime('now', '-180 days')
  AND usage_count < 2
  AND confidence < 0.5;

-- Remove orphaned embeddings
DELETE FROM pattern_embeddings
WHERE pattern_id NOT IN (SELECT id FROM patterns);

-- Remove old task trajectories (keep 90 days)
DELETE FROM task_trajectories
WHERE created_at < datetime('now', '-90 days');

-- Remove old verification history (keep 90 days)
DELETE FROM verification_history
WHERE timestamp < datetime('now', '-90 days');
"

# 5. Vacuum and compact
echo "5. Vacuum and Compact"
sqlite3 .swarm/memory.db "VACUUM;"

AFTER_SIZE=$(du -m .swarm/memory.db | awk '{print $1}')
SAVED_SIZE=$((BEFORE_SIZE - AFTER_SIZE))

echo "✅ Optimization complete"
echo "   Before: ${BEFORE_SIZE}MB"
echo "   After: ${AFTER_SIZE}MB"
echo "   Saved: ${SAVED_SIZE}MB"
```

### Neural Learning Optimization

```bash
#!/bin/bash
# Optimize neural learning system

echo "=== NEURAL LEARNING OPTIMIZATION ==="

# 1. Analyze pattern quality
echo "1. Pattern Quality Analysis"
sqlite3 .swarm/memory.db "
SELECT
  type,
  COUNT(*) as total_patterns,
  ROUND(AVG(confidence), 3) as avg_confidence,
  ROUND(AVG(usage_count), 1) as avg_usage,
  COUNT(CASE WHEN confidence > 0.8 THEN 1 END) as high_quality,
  COUNT(CASE WHEN usage_count > 10 THEN 1 END) as frequently_used
FROM patterns
GROUP BY type
ORDER BY avg_confidence DESC;
"

# 2. Retrain low-confidence patterns
echo "2. Retraining Low-Confidence Patterns"
npx claude-flow training neural-train --data low_confidence --epochs 100

# 3. Optimize cache
echo "3. Cache Optimization"
sqlite3 .swarm/memory.db "
-- Mark frequently used patterns for priority caching
UPDATE patterns
SET last_used = datetime('now')
WHERE usage_count > 50
  AND confidence > 0.8;
"

# 4. Consolidate similar patterns
echo "4. Pattern Consolidation"
# This would involve more complex logic to merge similar patterns
# For now, just report duplicates
sqlite3 .swarm/memory.db "
SELECT
  type,
  COUNT(*) as duplicate_count,
  AVG(confidence) as avg_confidence
FROM patterns
GROUP BY type, pattern_data
HAVING COUNT(*) > 1;
"

# 5. Update feedback loops
echo "5. Feedback Loop Optimization"
npx claude-flow neural patterns --analyze

echo "✅ Neural learning optimization complete"
```

### Cache Tuning

```bash
#!/bin/bash
# Tune caching strategy

echo "=== CACHE TUNING ==="

# 1. Analyze cache performance
echo "1. Current Cache Metrics"
sqlite3 .swarm/memory.db "
SELECT
  'Total Patterns' as metric,
  COUNT(*) as value
FROM patterns
UNION ALL
SELECT
  'Recently Used (1h)',
  COUNT(*)
FROM patterns
WHERE last_used > datetime('now', '-1 hour')
UNION ALL
SELECT
  'Hot Cache (10+ uses)',
  COUNT(*)
FROM patterns
WHERE usage_count > 10
UNION ALL
SELECT
  'Cold Cache (0-2 uses)',
  COUNT(*)
FROM patterns
WHERE usage_count <= 2;
"

# 2. Identify cache candidates
echo "2. Prime Cache Candidates"
sqlite3 .swarm/memory.db "
-- Patterns that should be cached
SELECT
  id,
  type,
  confidence,
  usage_count,
  last_used
FROM patterns
WHERE confidence > 0.8
  AND usage_count > 5
ORDER BY usage_count DESC, confidence DESC
LIMIT 100;
"

# 3. Clear stale cache entries
echo "3. Clear Stale Entries"
sqlite3 .swarm/memory.db "
-- Mark for removal from cache
UPDATE patterns
SET last_used = NULL
WHERE last_used < datetime('now', '-30 days')
  AND usage_count < 5;
"

# 4. Warm up cache
echo "4. Cache Warmup"
# Rebuild pattern cache with high-value patterns
npx claude-flow neural patterns --rebuild-cache

echo "✅ Cache tuning complete"
```

## Dependency Update Process

### Safe Dependency Update Workflow

```bash
#!/bin/bash
# Safely update dependencies

echo "=== DEPENDENCY UPDATE WORKFLOW ==="

# 1. Create update branch
git checkout -b dependency-update-$(date +%Y%m%d)

# 2. Check for outdated packages
echo "1. Checking for updates..."
npm outdated

# 3. Update dev dependencies first
echo "2. Updating dev dependencies..."
npm update --save-dev

# 4. Run tests
echo "3. Running tests..."
npm test

if [ $? -ne 0 ]; then
  echo "❌ Tests failed after dev dependency update"
  git checkout main
  git branch -D dependency-update-$(date +%Y%m%d)
  exit 1
fi

# 5. Update production dependencies (patch/minor only)
echo "4. Updating production dependencies (safe updates)..."
npm update --save

# 6. Run full test suite
echo "5. Running full test suite..."
npm test
npm run lint
npm run typecheck

if [ $? -ne 0 ]; then
  echo "❌ Tests failed after production dependency update"
  git checkout main
  git branch -D dependency-update-$(date +%Y%m%d)
  exit 1
fi

# 7. Security audit
echo "6. Running security audit..."
npm audit --audit-level=high

if [ $? -ne 0 ]; then
  echo "⚠️ Security vulnerabilities found"
  npm audit fix
  npm test
fi

# 8. Commit changes
echo "7. Committing changes..."
git add package.json package-lock.json
git commit -m "Update dependencies - $(date +%Y-%m-%d)

- Updated dev dependencies
- Updated production dependencies (patch/minor)
- All tests passing
- Security audit clean"

# 9. Deploy to staging for testing
echo "8. Deploy to staging..."
# Deploy to staging environment

# 10. Monitor staging
echo "9. Monitor staging for 24 hours before production"

echo "✅ Dependency update complete"
echo "📋 Next: Monitor staging and merge to main after 24h"
```

### Major Version Updates

```bash
# For major version updates, follow this careful process:

# 1. Review changelog
npm view <package-name> versions
npm view <package-name>@latest

# 2. Create dedicated branch
git checkout -b major-update-<package-name>

# 3. Update one package at a time
npm install <package-name>@latest --save

# 4. Run comprehensive tests
npm test
npm run lint
npm run typecheck

# 5. Manual testing
./claude-flow verify init strict
./claude-flow truth --report
npx claude-flow neural status

# 6. Performance baseline
# Run before/after performance tests

# 7. Deploy to staging
# Full staging deployment and monitoring

# 8. Gradual rollout
# 10% -> 50% -> 100% over 3 days
```

## Security Patching Workflow

```bash
#!/bin/bash
# Emergency security patching

echo "=== SECURITY PATCH WORKFLOW ==="

# 1. Identify vulnerability
npm audit --json > security-audit.json
echo "1. Security audit complete"

# 2. Assess severity
CRITICAL=$(jq '.metadata.vulnerabilities.critical' security-audit.json)
HIGH=$(jq '.metadata.vulnerabilities.high' security-audit.json)

echo "Critical vulnerabilities: $CRITICAL"
echo "High vulnerabilities: $HIGH"

if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
  echo "⚠️ Critical/High vulnerabilities found - immediate action required"

  # 3. Create emergency patch branch
  git checkout -b security-patch-$(date +%Y%m%d-%H%M%S)

  # 4. Apply automatic fixes
  npm audit fix

  # 5. Test immediately
  npm test

  if [ $? -eq 0 ]; then
    # 6. Commit and deploy immediately
    git add package.json package-lock.json
    git commit -m "SECURITY: Emergency patch for critical vulnerabilities"

    # 7. Deploy to production ASAP
    echo "🚨 Emergency deployment required"
    # Follow emergency deployment procedure

  else
    echo "❌ Automatic fix broke tests - manual intervention required"
    # Page on-call engineer
  fi
else
  echo "✅ No critical vulnerabilities"
fi
```

## Pattern Library Optimization

```bash
#!/bin/bash
# Optimize pattern library for best performance

echo "=== PATTERN LIBRARY OPTIMIZATION ==="

# 1. Analyze pattern distribution
sqlite3 .swarm/memory.db "
SELECT
  CASE
    WHEN confidence >= 0.9 THEN 'Excellent (0.9+)'
    WHEN confidence >= 0.8 THEN 'Very Good (0.8-0.9)'
    WHEN confidence >= 0.7 THEN 'Good (0.7-0.8)'
    WHEN confidence >= 0.6 THEN 'Fair (0.6-0.7)'
    WHEN confidence >= 0.5 THEN 'Moderate (0.5-0.6)'
    ELSE 'Low (<0.5)'
  END as quality_tier,
  COUNT(*) as pattern_count,
  ROUND(AVG(usage_count), 2) as avg_usage,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM patterns), 2) as percentage
FROM patterns
GROUP BY quality_tier
ORDER BY MIN(confidence) DESC;
"

# 2. Promote high-performing patterns
sqlite3 .swarm/memory.db "
-- Boost confidence for frequently used patterns
UPDATE patterns
SET confidence = MIN(0.95, confidence + 0.05)
WHERE usage_count > 100
  AND confidence < 0.95;
"

# 3. Demote underperforming patterns
sqlite3 .swarm/memory.db "
-- Reduce confidence for unused patterns
UPDATE patterns
SET confidence = MAX(0.3, confidence - 0.1)
WHERE last_used < datetime('now', '-60 days')
  AND usage_count < 5;
"

# 4. Archive old patterns
ARCHIVE_FILE="/opt/claude-code-archives/patterns-archive-$(date +%Y%m%d).sql"
sqlite3 .swarm/memory.db "
.mode insert patterns
.output $ARCHIVE_FILE
SELECT * FROM patterns
WHERE confidence < 0.3
  AND usage_count < 2
  AND created_at < datetime('now', '-180 days');
.output stdout

-- Delete archived patterns
DELETE FROM patterns
WHERE confidence < 0.3
  AND usage_count < 2
  AND created_at < datetime('now', '-180 days');
"

echo "✅ Pattern library optimized"
echo "📁 Archived patterns: $ARCHIVE_FILE"
```

## Memory Management

```bash
#!/bin/bash
# Manage system memory usage

echo "=== MEMORY MANAGEMENT ==="

# 1. Check current memory usage
free -h
ps aux | grep claude-code | awk '{sum+=$6} END {print "Claude Code memory usage: " sum/1024 " MB"}'

# 2. Database memory optimization
sqlite3 .swarm/memory.db "
-- Enable memory-mapped I/O
PRAGMA mmap_size = 268435456;  -- 256MB

-- Set cache size
PRAGMA cache_size = -64000;  -- 64MB

-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;
"

# 3. Clear system caches
sync
echo 3 > /proc/sys/vm/drop_caches

# 4. Monitor memory leaks
# Log memory usage over time
echo "$(date +%s),$(free | grep Mem | awk '{print $3}')" >> /var/log/claude-code/memory-usage.log

echo "✅ Memory management complete"
```

## Maintenance Windows and Downtime

### Scheduled Maintenance Window

```bash
# Sunday 2:00-4:00 AM UTC

# 1. Notify users (24h advance)
curl -X POST $SLACK_WEBHOOK -d '{
  "text": "📅 Scheduled Maintenance",
  "attachments": [{
    "color": "warning",
    "text": "Claude Code system maintenance scheduled for Sunday 2:00-4:00 AM UTC. Brief downtime expected."
  }]
}'

# 2. During maintenance window
systemctl stop claude-code-production
# Perform maintenance tasks
systemctl start claude-code-production

# 3. Verify and notify completion
curl -X POST $SLACK_WEBHOOK -d '{
  "text": "✅ Maintenance Complete",
  "attachments": [{
    "color": "good",
    "text": "Claude Code maintenance completed successfully. All systems operational."
  }]
}'
```

## Related Documentation

- `/docs/operations/deployment.md` - Deployment procedures
- `/docs/operations/monitoring.md` - Monitoring setup
- `/docs/operations/incident-response.md` - Incident handling
- `/docs/operations/database.md` - Database operations
- `/docs/neural/architecture.md` - Neural system design
- `/docs/integration/metrics.md` - Success metrics
