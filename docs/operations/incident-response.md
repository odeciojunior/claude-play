# Incident Response Runbook

## Overview

This runbook provides comprehensive incident response procedures for the Claude Code self-learning AI system with SAFLA neural network, GOAP planning, and truth verification.

## Incident Severity Classification

### P0 - Critical (System Down or Major Functionality Loss)

**Response Time:** Immediate (< 5 minutes)
**Examples:**
- System completely unavailable
- Truth verification score < 0.85 (auto-rollback triggered)
- Database corruption detected
- Neural operations/sec < 50,000
- Data loss detected

**Response Team:** On-call engineer + manager notification

### P1 - High (Significant Impact, System Degraded)

**Response Time:** 15 minutes
**Examples:**
- Truth verification score < 0.90
- Neural operations/sec < 100,000
- Cache hit rate < 60%
- Multiple agents quarantined (>10%)
- Memory database growing rapidly (>100MB/hour)

**Response Team:** On-call engineer

### P2 - Medium (Moderate Impact, Workaround Available)

**Response Time:** 1 hour
**Examples:**
- Truth verification score < 0.95
- Neural operations/sec < 150,000
- Single agent underperforming
- Pattern learning rate low
- GOAP planning slow (>100ms average)

**Response Team:** On-call engineer during business hours

### P3 - Low (Minor Impact, No Immediate Action Required)

**Response Time:** 4 hours
**Examples:**
- Memory database size approaching threshold
- Log files growing large
- Non-critical metrics below target
- Documentation updates needed

**Response Team:** Standard ticket queue

## Response Procedures by Severity

### P0 - Critical Response Procedure

#### Step 1: Acknowledge and Assess (2 minutes)

```bash
# Acknowledge incident in PagerDuty/Slack
echo "P0 incident acknowledged by $(whoami) at $(date)"

# Quick system assessment
systemctl status claude-code-production
curl -f http://localhost:8080/health
./claude-flow verify status
npx claude-flow neural status

# Check logs for immediate cause
tail -500 /var/log/claude-code/application.log | grep -i "critical\|error\|fatal"
```

#### Step 2: Stabilize System (3 minutes)

```bash
# If auto-rollback hasn't triggered, do manual rollback
if [ "$(./claude-flow truth --json | jq -r '.overall.score')" < "0.85" ]; then
  echo "CRITICAL: Truth score below 0.85, initiating rollback"

  # Stop current production
  systemctl stop claude-code-production

  # Restore previous version
  LATEST_BACKUP=$(ls -td /opt/claude-code-backups/*/ | head -1)
  rm /opt/claude-code-production
  ln -s $LATEST_BACKUP /opt/claude-code-production

  # Restore database
  cp $LATEST_BACKUP/memory.db.backup /opt/claude-code-production/.swarm/memory.db

  # Start previous version
  systemctl start claude-code-production
fi

# If database corruption detected
if ! sqlite3 .swarm/memory.db "PRAGMA integrity_check;" | grep -q "ok"; then
  echo "CRITICAL: Database corruption detected"

  # Stop system
  systemctl stop claude-code-production

  # Restore from latest backup
  LATEST_DB_BACKUP=$(ls -t /opt/claude-code-backups/*/memory.db.backup | head -1)
  cp $LATEST_DB_BACKUP /opt/claude-code-production/.swarm/memory.db

  # Verify restore
  sqlite3 /opt/claude-code-production/.swarm/memory.db "PRAGMA integrity_check;"

  # Restart system
  systemctl start claude-code-production
fi
```

#### Step 3: Notify Stakeholders (5 minutes)

```bash
# Send notification to Slack
curl -X POST $SLACK_WEBHOOK -d '{
  "text": "🚨 P0 INCIDENT",
  "attachments": [{
    "color": "danger",
    "fields": [
      {"title": "Severity", "value": "P0 - Critical", "short": true},
      {"title": "Status", "value": "In Progress", "short": true},
      {"title": "Responder", "value": "'"$(whoami)"'", "short": true},
      {"title": "Time", "value": "'"$(date)"'", "short": true}
    ]
  }]
}'

# Page manager if not resolved in 15 minutes
```

#### Step 4: Root Cause Investigation (15 minutes)

```bash
# Analyze recent changes
git log -20 --oneline

# Check recent deployments
cat /opt/claude-code-production/deployment-log.txt | tail -5

# Analyze verification history
sqlite3 .swarm/memory.db "
SELECT
  timestamp,
  agent_name,
  truth_score,
  verification_status
FROM verification_history
WHERE timestamp > datetime('now', '-1 hour')
ORDER BY timestamp DESC
LIMIT 50;
"

# Check for patterns in errors
grep -i error /var/log/claude-code/application.log | tail -100 | awk '{print $5}' | sort | uniq -c | sort -rn

# Check neural system anomalies
sqlite3 .swarm/memory.db "
SELECT
  created_at,
  type,
  confidence,
  pattern_data
FROM patterns
WHERE confidence < 0.3 OR confidence > 0.95
ORDER BY created_at DESC
LIMIT 20;
"
```

#### Step 5: Resolution and Verification (10 minutes)

```bash
# Verify system stability
./claude-flow truth --report
npx claude-flow neural status

# Check performance metrics
sqlite3 .swarm/memory.db "
SELECT
  COUNT(*) * 1.0 / (julianday('now') - julianday(MIN(created_at))) / 86400.0 as ops_per_second
FROM task_trajectories
WHERE created_at > datetime('now', '-15 minutes');
"

# Monitor for 10 minutes
watch -n 30 './claude-flow truth --json | jq ".overall.score"'
```

#### Step 6: Post-Incident Documentation

```bash
# Create incident report
cat > /var/log/claude-code/incidents/incident-$(date +%Y%m%d-%H%M%S).md << EOF
# P0 Incident Report

## Summary
- **Incident ID:** INC-$(date +%Y%m%d-%H%M%S)
- **Severity:** P0 - Critical
- **Start Time:** $(date)
- **Detection Time:** [Time incident was detected]
- **Resolution Time:** [Time incident was resolved]
- **Duration:** [Total duration]
- **Responder:** $(whoami)

## Impact
- [Describe impact on users/systems]

## Root Cause
- [Describe root cause]

## Timeline
- [Timestamp] - Incident detected
- [Timestamp] - Response initiated
- [Timestamp] - System stabilized
- [Timestamp] - Incident resolved

## Resolution
- [Describe resolution steps]

## Action Items
- [ ] [Action item 1]
- [ ] [Action item 2]

## Lessons Learned
- [Lessons learned]
EOF
```

### P1 - High Priority Response Procedure

#### Step 1: Initial Assessment (5 minutes)

```bash
# Check system status
./claude-flow verify status
npx claude-flow neural status
./claude-flow truth --report

# Check performance metrics
sqlite3 .swarm/memory.db "
SELECT
  'Ops/sec' as metric,
  COUNT(*) * 1.0 / (julianday('now') - julianday(MIN(created_at))) / 86400.0 as value
FROM task_trajectories
WHERE created_at > datetime('now', '-1 hour')
UNION ALL
SELECT
  'Cache Hit Rate',
  ROUND(
    100.0 * SUM(CASE WHEN last_used > datetime('now', '-1 hour') THEN usage_count ELSE 0 END) /
    NULLIF(SUM(usage_count), 0),
    2
  )
FROM patterns
UNION ALL
SELECT
  'Truth Score',
  (SELECT AVG(truth_score) FROM verification_history WHERE timestamp > datetime('now', '-1 hour'));
"
```

#### Step 2: Identify Issue (10 minutes)

```bash
# Check for degraded agents
./claude-flow truth --json | jq '.agents[] | select(.score < 0.90)'

# Check for memory issues
du -h .swarm/memory.db
sqlite3 .swarm/memory.db "SELECT COUNT(*) FROM patterns WHERE created_at > datetime('now', '-1 day');"

# Check for cache issues
sqlite3 .swarm/memory.db "
SELECT
  type,
  COUNT(*) as count,
  ROUND(AVG(confidence), 3) as avg_confidence,
  ROUND(AVG(usage_count), 1) as avg_usage
FROM patterns
GROUP BY type
ORDER BY avg_usage ASC
LIMIT 10;
"
```

#### Step 3: Apply Fix (30 minutes)

```bash
# If truth score is low, retrain patterns
if [ "$(./claude-flow truth --json | jq -r '.overall.score')" < "0.90" ]; then
  echo "Truth score low, retraining patterns"
  npx claude-flow training neural-train --data recent --epochs 50
fi

# If cache hit rate is low, optimize cache
if [ "$(sqlite3 .swarm/memory.db 'SELECT ROUND(100.0 * SUM(CASE WHEN last_used > datetime(\"now\", \"-1 hour\") THEN usage_count ELSE 0 END) / NULLIF(SUM(usage_count), 0), 2) FROM patterns;')" < "70" ]; then
  echo "Cache hit rate low, clearing stale patterns"
  sqlite3 .swarm/memory.db "DELETE FROM patterns WHERE last_used < datetime('now', '-30 days') AND usage_count < 5;"
  sqlite3 .swarm/memory.db "VACUUM;"
fi

# If operations/sec is low, check for bottlenecks
# ... investigate specific bottleneck
```

#### Step 4: Monitor and Verify (15 minutes)

```bash
# Monitor metrics for 15 minutes
for i in {1..30}; do
  echo "Check $i/30 ($(date))"
  ./claude-flow truth --json | jq '.overall.score'
  sqlite3 .swarm/memory.db "
    SELECT COUNT(*) * 1.0 / (julianday('now') - julianday(MIN(created_at))) / 86400.0
    FROM task_trajectories
    WHERE created_at > datetime('now', '-5 minutes');
  "
  sleep 30
done
```

### P2 - Medium Priority Response Procedure

```bash
# Investigate issue
./claude-flow truth --report
npx claude-flow neural status

# Create ticket
echo "P2 Incident: $(date)" >> p2-incidents.log
echo "Metrics below target, investigating..." >> p2-incidents.log

# Schedule maintenance if needed
# ... add to maintenance queue
```

### P3 - Low Priority Response Procedure

```bash
# Log issue
echo "P3 Issue: $(date)" >> p3-issues.log

# Add to backlog
# ... create ticket in issue tracking system
```

## Communication Protocols

### Initial Notification Template

```markdown
**INCIDENT ALERT**

Severity: [P0/P1/P2/P3]
Status: [Investigating/Identified/Fixing/Monitoring/Resolved]
Impact: [Description of user/system impact]
Start Time: [Timestamp]
Responder: [Name]

Current Status:
- [Status update]

Next Update: [Time of next update]
```

### Status Update Template

```markdown
**INCIDENT UPDATE**

Incident ID: [ID]
Severity: [P0/P1/P2/P3]
Status: [Current status]
Time Elapsed: [Duration]

Progress:
- [What has been done]
- [Current activity]

Next Steps:
- [What will be done next]

Next Update: [Time of next update]
```

### Resolution Template

```markdown
**INCIDENT RESOLVED**

Incident ID: [ID]
Severity: [P0/P1/P2/P3]
Duration: [Total duration]
Resolution Time: [Timestamp]

Root Cause:
- [Brief description of root cause]

Resolution:
- [What was done to resolve]

Action Items:
- [Follow-up tasks]

Post-Incident Review: [Date scheduled]
```

## Escalation Paths

### P0 Incident Escalation

```
0-5 min:  On-call engineer responds
5-10 min: Notify engineering manager
10-15 min: Notify VP Engineering
15+ min:  Executive team notification
```

### P1 Incident Escalation

```
0-15 min: On-call engineer responds
15-30 min: Notify engineering manager
30-60 min: Notify VP Engineering if unresolved
```

### Escalation Contacts

```bash
# Store contacts in secure location
cat > /etc/claude-code/escalation-contacts.enc << 'EOF'
On-Call Engineer: Check PagerDuty rotation
Engineering Manager: manager@company.com, +1-XXX-XXX-XXXX
VP Engineering: vp-eng@company.com, +1-XXX-XXX-XXXX
Database Admin: dba-team@company.com, +1-XXX-XXX-XXXX
Security Team: security@company.com, +1-XXX-XXX-XXXX
EOF
```

## Common Issues and Resolutions

### Issue 1: Truth Verification Score Dropped Below Threshold

**Symptoms:**
- Truth score < 0.95
- Multiple agents reporting low scores
- Verification failures increasing

**Diagnosis:**
```bash
# Check verification history
sqlite3 .swarm/memory.db "
SELECT
  agent_name,
  AVG(truth_score) as avg_score,
  COUNT(*) as verifications
FROM verification_history
WHERE timestamp > datetime('now', '-1 hour')
GROUP BY agent_name
HAVING avg_score < 0.90
ORDER BY avg_score ASC;
"

# Check recent changes
git log -10 --oneline
```

**Resolution:**
```bash
# Option 1: Retrain patterns
npx claude-flow training neural-train --data recent --epochs 100

# Option 2: Rollback to previous version
# (See deployment.md for rollback procedure)

# Option 3: Quarantine failing agents
./claude-flow verify quarantine <agent-name>
```

**Prevention:**
- Implement gradual rollout for changes
- Increase verification coverage
- Add pre-deployment verification gates

### Issue 2: Neural Operations Performance Degraded

**Symptoms:**
- Operations/sec < 150,000
- High latency on pattern retrieval
- Memory usage increasing

**Diagnosis:**
```bash
# Check database size
du -h .swarm/memory.db

# Check query performance
sqlite3 .swarm/memory.db "EXPLAIN QUERY PLAN SELECT * FROM patterns WHERE confidence > 0.8;"

# Check for missing indexes
sqlite3 .swarm/memory.db "SELECT name FROM sqlite_master WHERE type='index';"
```

**Resolution:**
```bash
# Option 1: Optimize database
sqlite3 .swarm/memory.db "ANALYZE;"
sqlite3 .swarm/memory.db "VACUUM;"

# Option 2: Add missing indexes
sqlite3 .swarm/memory.db "CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence DESC);"

# Option 3: Prune old patterns
sqlite3 .swarm/memory.db "DELETE FROM patterns WHERE last_used < datetime('now', '-90 days') AND usage_count < 3;"
```

**Prevention:**
- Schedule regular database maintenance
- Monitor database growth
- Implement automatic pruning

### Issue 3: Memory Database Corruption

**Symptoms:**
- Integrity check fails
- SQLite errors in logs
- Inconsistent query results

**Diagnosis:**
```bash
# Check database integrity
sqlite3 .swarm/memory.db "PRAGMA integrity_check;"

# Check for locked database
lsof | grep memory.db
```

**Resolution:**
```bash
# CRITICAL: Stop system immediately
systemctl stop claude-code-production

# Attempt recovery
sqlite3 .swarm/memory.db ".recover" | sqlite3 .swarm/memory-recovered.db

# If recovery fails, restore from backup
LATEST_BACKUP=$(ls -t /opt/claude-code-backups/*/memory.db.backup | head -1)
cp $LATEST_BACKUP .swarm/memory.db

# Verify restored database
sqlite3 .swarm/memory.db "PRAGMA integrity_check;"

# Restart system
systemctl start claude-code-production
```

**Prevention:**
- Enable WAL mode for better concurrency
- Implement backup before every deployment
- Monitor disk space and I/O

### Issue 4: Cache Hit Rate Low

**Symptoms:**
- Cache hit rate < 80%
- Pattern lookups slow
- High database load

**Diagnosis:**
```bash
# Check cache statistics
sqlite3 .swarm/memory.db "
SELECT
  COUNT(*) as total_patterns,
  SUM(CASE WHEN last_used > datetime('now', '-1 hour') THEN 1 ELSE 0 END) as active_patterns,
  ROUND(AVG(usage_count), 2) as avg_usage
FROM patterns;
"
```

**Resolution:**
```bash
# Clear stale patterns
sqlite3 .swarm/memory.db "
DELETE FROM patterns
WHERE last_used < datetime('now', '-30 days')
  AND usage_count < 5;
"

# Rebuild cache
npx claude-flow neural patterns --rebuild-cache

# Increase cache size in config
# Edit config/neural-system.json: cacheSize: 1500
```

**Prevention:**
- Monitor cache metrics continuously
- Implement cache warming strategy
- Review pattern retention policy

### Issue 5: GOAP Planning Performance Slow

**Symptoms:**
- Planning time > 100ms average
- Task orchestration delayed
- A* search taking long paths

**Diagnosis:**
```bash
# Check planning performance
sqlite3 .swarm/memory.db "
SELECT
  AVG(execution_time_ms) as avg_time,
  MAX(execution_time_ms) as max_time,
  COUNT(*) as total_plans
FROM task_trajectories
WHERE task_type = 'goap_planning'
  AND created_at > datetime('now', '-1 hour');
"
```

**Resolution:**
```bash
# Option 1: Update heuristics with learned patterns
npx claude-flow training neural-train --data goap_heuristics --epochs 50

# Option 2: Clear stale planning patterns
sqlite3 .swarm/memory.db "
DELETE FROM patterns
WHERE type = 'goap_planning'
  AND confidence < 0.5;
"

# Option 3: Reduce search space
# Edit config: maxSearchDepth: 10 (from 15)
```

**Prevention:**
- Monitor planning performance
- Continuously update heuristics
- Limit action space complexity

## Post-Incident Review Template

Schedule within 48 hours of P0/P1 incidents:

```markdown
# Post-Incident Review

## Incident Summary
- **Incident ID:**
- **Severity:**
- **Date:**
- **Duration:**
- **Responders:**

## Timeline
| Time | Event |
|------|-------|
|      |       |

## Impact Assessment
- **Users Affected:**
- **Systems Affected:**
- **Data Impact:**
- **Financial Impact:**

## Root Cause Analysis
### Contributing Factors
1.
2.

### Root Cause
[5 Whys analysis]

## What Went Well
-
-

## What Could Be Improved
-
-

## Action Items
| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
|        |       |          |          |

## Prevention Measures
-
-

## Lessons Learned
-
-
```

## Related Documentation

- `/docs/operations/deployment.md` - Deployment procedures
- `/docs/operations/monitoring.md` - Monitoring setup
- `/docs/operations/database.md` - Database operations
- `/docs/operations/maintenance.md` - System maintenance
- `/docs/neural/architecture.md` - Neural system design
