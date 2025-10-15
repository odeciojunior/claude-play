# Deployment Procedures

## Overview

This runbook provides comprehensive procedures for deploying the Claude Code self-learning AI system with SAFLA neural network, GOAP planning, and truth verification to production environments.

## Pre-Deployment Checklist

### Critical Checks (Must Pass 100%)

```bash
# 1. Database Backup
sqlite3 .swarm/memory.db ".backup .swarm/memory.backup-$(date +%Y%m%d-%H%M%S).db"
echo "✅ Database backup created"

# 2. Dependency Check
npm ci
npm audit --audit-level=high
echo "✅ Dependencies validated"

# 3. Environment Validation
node -e "console.log('Node version:', process.version)"
npm -v
echo "✅ Runtime versions verified"

# 4. Build Verification
npm run build
echo "✅ Build successful"

# 5. Test Suite Execution
npm test
npm run lint
npm run typecheck
echo "✅ All tests passing"

# 6. Neural System Health
npx claude-flow neural status
echo "✅ Neural system operational"

# 7. Verification System Check
./claude-flow verify status
echo "✅ Verification system ready"

# 8. Memory Database Integrity
sqlite3 .swarm/memory.db "PRAGMA integrity_check;"
echo "✅ Database integrity verified"
```

### Environment-Specific Validations

**Development Environment:**
```bash
export NODE_ENV=development
export VERIFICATION_THRESHOLD=0.75
export NEURAL_LEARNING=true
export DEBUG_MODE=true
```

**Staging Environment:**
```bash
export NODE_ENV=staging
export VERIFICATION_THRESHOLD=0.85
export NEURAL_LEARNING=true
export DEBUG_MODE=false
export ENABLE_METRICS=true
```

**Production Environment:**
```bash
export NODE_ENV=production
export VERIFICATION_THRESHOLD=0.95
export NEURAL_LEARNING=true
export DEBUG_MODE=false
export ENABLE_METRICS=true
export ENABLE_ALERTS=true
export AUTO_ROLLBACK=true
```

## Deployment Process

### Step 1: Pre-Deployment Preparation (15 minutes)

```bash
# Create deployment directory
DEPLOY_DIR="/opt/claude-code-$(date +%Y%m%d-%H%M%S)"
mkdir -p $DEPLOY_DIR

# Clone repository
cd $DEPLOY_DIR
git clone <repository-url> .
git checkout <release-tag>

# Backup current production
BACKUP_DIR="/opt/claude-code-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r /opt/claude-code-production/* $BACKUP_DIR/

# Backup production database
cp /opt/claude-code-production/.swarm/memory.db $BACKUP_DIR/memory.db.backup
```

### Step 2: Build and Test (10 minutes)

```bash
cd $DEPLOY_DIR

# Install dependencies (clean install)
npm ci --production=false

# Run full build
npm run build

# Execute test suite
npm test 2>&1 | tee deployment-test-results.log

# Verify build artifacts
ls -lh dist/
ls -lh src/neural/
ls -lh .claude/agents/
```

### Step 3: Database Migration (5 minutes)

```bash
# Check for pending migrations
ls -la migrations/ | grep -v "$(sqlite3 /opt/claude-code-production/.swarm/memory.db 'SELECT filename FROM migrations_applied ORDER BY applied_at DESC LIMIT 1;')"

# Run migrations (if any)
for migration in migrations/*.sql; do
  echo "Applying migration: $migration"
  sqlite3 $DEPLOY_DIR/.swarm/memory.db < $migration

  # Log migration
  sqlite3 $DEPLOY_DIR/.swarm/memory.db "INSERT INTO migrations_applied (filename, applied_at) VALUES ('$(basename $migration)', datetime('now'));"
done

# Verify migration success
sqlite3 $DEPLOY_DIR/.swarm/memory.db "PRAGMA integrity_check;"
```

### Step 4: Configuration Update (3 minutes)

```bash
# Copy production configuration
cp /opt/claude-code-production/.env.production $DEPLOY_DIR/.env

# Update configuration for new deployment
cat > $DEPLOY_DIR/.env << EOF
NODE_ENV=production
VERIFICATION_THRESHOLD=0.95
NEURAL_LEARNING=true
DEBUG_MODE=false
ENABLE_METRICS=true
ENABLE_ALERTS=true
AUTO_ROLLBACK=true

# Database
DATABASE_PATH=.swarm/memory.db
DATABASE_BACKUP_ENABLED=true
DATABASE_BACKUP_INTERVAL=86400

# Neural System
NEURAL_OPERATIONS_TARGET=172000
NEURAL_CACHE_SIZE=1000
NEURAL_COMPRESSION_RATIO=0.60

# Verification
VERIFICATION_MODE=strict
VERIFICATION_AUTO_ROLLBACK=true
VERIFICATION_AUDIT_LOG=true

# Monitoring
METRICS_PORT=9090
HEALTH_CHECK_PORT=8080
LOG_LEVEL=info
EOF
```

### Step 5: Smoke Tests (5 minutes)

```bash
# Start application in test mode
NODE_ENV=staging npm start &
APP_PID=$!

# Wait for startup
sleep 10

# Health check
curl -f http://localhost:8080/health || exit 1

# Neural system check
npx claude-flow neural status | grep "Status: operational" || exit 1

# Verification system check
./claude-flow verify status | grep "Mode: strict" || exit 1

# Pattern retrieval test
sqlite3 .swarm/memory.db "SELECT COUNT(*) FROM patterns WHERE confidence > 0.8;" | grep -E "[0-9]+" || exit 1

# Kill test instance
kill $APP_PID
```

### Step 6: Production Cutover (2 minutes)

```bash
# Stop current production
systemctl stop claude-code-production

# Swap symlink
rm /opt/claude-code-production
ln -s $DEPLOY_DIR /opt/claude-code-production

# Copy production database if new deployment
if [ ! -f $DEPLOY_DIR/.swarm/memory.db ]; then
  cp $BACKUP_DIR/memory.db.backup $DEPLOY_DIR/.swarm/memory.db
fi

# Start new production
systemctl start claude-code-production

# Verify startup
sleep 5
systemctl status claude-code-production
```

### Step 7: Post-Deployment Verification (10 minutes)

```bash
# Health check
curl -f http://localhost:8080/health

# Neural system verification
npx claude-flow neural status
npx claude-flow neural patterns --analyze

# Verification system check
./claude-flow verify status
./claude-flow truth --report

# Memory database check
sqlite3 .swarm/memory.db "SELECT COUNT(*) FROM patterns;"
sqlite3 .swarm/memory.db "SELECT AVG(confidence) FROM patterns;"

# Performance baseline
curl http://localhost:9090/metrics | grep "neural_operations_per_second"

# Log check
tail -100 /var/log/claude-code/application.log | grep -i error
```

## Rollback Procedures

### Immediate Rollback (Critical Failure)

```bash
# Stop failed deployment
systemctl stop claude-code-production

# Restore previous version
rm /opt/claude-code-production
ln -s $BACKUP_DIR /opt/claude-code-production

# Restore database
cp $BACKUP_DIR/memory.db.backup /opt/claude-code-production/.swarm/memory.db

# Start previous version
systemctl start claude-code-production

# Verify rollback success
systemctl status claude-code-production
curl -f http://localhost:8080/health
```

### Automated Rollback (Verification Failure)

The system includes automatic rollback when verification threshold drops below 0.85:

```bash
# Monitor verification scores
./claude-flow truth --monitor &

# Automatic rollback triggers when:
# - Truth score < 0.85 for 5 consecutive minutes
# - Neural operations/sec < 100,000 for 3 minutes
# - Memory database corruption detected
# - Critical error rate > 1% of operations
```

### Partial Rollback (Database Only)

```bash
# Stop application
systemctl stop claude-code-production

# Restore database from backup
LATEST_BACKUP=$(ls -t /opt/claude-code-backups/*/memory.db.backup | head -1)
cp $LATEST_BACKUP /opt/claude-code-production/.swarm/memory.db

# Verify database integrity
sqlite3 /opt/claude-code-production/.swarm/memory.db "PRAGMA integrity_check;"

# Restart application
systemctl start claude-code-production
```

## Database Migration Procedures

### Creating a New Migration

```bash
# Create migration file
MIGRATION_NAME="add_pattern_category_index"
MIGRATION_FILE="migrations/$(date +%Y%m%d%H%M%S)_${MIGRATION_NAME}.sql"

cat > $MIGRATION_FILE << 'EOF'
-- Migration: Add index on pattern category for faster queries
-- Created: 2025-10-15
-- Author: Ops Team

BEGIN TRANSACTION;

-- Add index
CREATE INDEX IF NOT EXISTS idx_patterns_category
ON patterns(category, confidence DESC);

-- Verify index creation
SELECT name FROM sqlite_master
WHERE type='index' AND name='idx_patterns_category';

COMMIT;
EOF

echo "✅ Migration created: $MIGRATION_FILE"
```

### Running Migrations Safely

```bash
# 1. Backup database before migration
cp .swarm/memory.db .swarm/memory.db.pre-migration-$(date +%Y%m%d-%H%M%S)

# 2. Test migration on copy
cp .swarm/memory.db .swarm/memory.db.test
sqlite3 .swarm/memory.db.test < $MIGRATION_FILE

# 3. Verify test migration
sqlite3 .swarm/memory.db.test "PRAGMA integrity_check;"

# 4. If test successful, apply to production
sqlite3 .swarm/memory.db < $MIGRATION_FILE

# 5. Log migration
sqlite3 .swarm/memory.db "INSERT INTO migrations_applied (filename, applied_at, status) VALUES ('$(basename $MIGRATION_FILE)', datetime('now'), 'success');"
```

## Environment-Specific Configurations

### Development Configuration

```json
{
  "environment": "development",
  "verification": {
    "threshold": 0.75,
    "mode": "development",
    "autoRollback": false
  },
  "neural": {
    "learning": true,
    "operationsTarget": 50000,
    "cacheSize": 500
  },
  "monitoring": {
    "enabled": false,
    "alerting": false
  }
}
```

### Staging Configuration

```json
{
  "environment": "staging",
  "verification": {
    "threshold": 0.85,
    "mode": "moderate",
    "autoRollback": false
  },
  "neural": {
    "learning": true,
    "operationsTarget": 100000,
    "cacheSize": 750
  },
  "monitoring": {
    "enabled": true,
    "alerting": false
  }
}
```

### Production Configuration

```json
{
  "environment": "production",
  "verification": {
    "threshold": 0.95,
    "mode": "strict",
    "autoRollback": true
  },
  "neural": {
    "learning": true,
    "operationsTarget": 172000,
    "cacheSize": 1000
  },
  "monitoring": {
    "enabled": true,
    "alerting": true,
    "alertChannels": ["slack", "pagerduty", "email"]
  }
}
```

## Deployment Verification Checklist

After deployment, verify these metrics:

- [ ] Application health endpoint returns 200 OK
- [ ] Neural operations/sec > 150,000
- [ ] Verification truth score > 0.95
- [ ] Pattern cache hit rate > 0.80
- [ ] Memory database integrity check passes
- [ ] No critical errors in logs (last 1000 lines)
- [ ] All 68+ agents responding correctly
- [ ] GOAP planning system operational
- [ ] Pair programming mode functional
- [ ] Memory compression ratio ~0.60

## Troubleshooting Common Deployment Issues

### Issue: Build Fails

```bash
# Clear caches
npm cache clean --force
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

### Issue: Database Migration Fails

```bash
# Restore pre-migration backup
cp .swarm/memory.db.pre-migration-* .swarm/memory.db

# Check migration SQL syntax
sqlite3 .swarm/memory.db < migrations/failed-migration.sql

# Fix migration and retry
```

### Issue: Neural System Not Starting

```bash
# Check neural system files
ls -la src/neural/

# Reinitialize neural system
npx claude-flow@alpha neural init --force

# Verify initialization
npx claude-flow neural status
```

### Issue: Verification Threshold Too Low

```bash
# Check current scores
./claude-flow truth --report

# Investigate low-scoring agents
./claude-flow truth --agent <agent-name> --detailed

# Retrain if needed
npx claude-flow training neural-train --data recent --epochs 50
```

## Post-Deployment Tasks

1. **Update deployment log:**
   ```bash
   echo "$(date): Deployed version $VERSION to production" >> deployment-log.txt
   ```

2. **Notify team:**
   ```bash
   curl -X POST <slack-webhook> -d '{"text":"Production deployment complete: version '$VERSION'"}'
   ```

3. **Monitor for 30 minutes:**
   ```bash
   watch -n 60 './claude-flow truth --json'
   ```

4. **Archive old backups (keep 30 days):**
   ```bash
   find /opt/claude-code-backups -mtime +30 -type d -exec rm -rf {} \;
   ```

5. **Update documentation:**
   - Update version in README.md
   - Update CHANGELOG.md
   - Tag release in git

## Emergency Contacts

- **On-Call Engineer:** Check PagerDuty rotation
- **Database Admin:** DBA team Slack channel
- **Security Team:** security@company.com
- **Product Owner:** Product Slack channel

## Deployment Schedule

- **Maintenance Window:** Sundays 2:00-4:00 AM UTC
- **Emergency Deployments:** Any time with approval
- **Staging Deployments:** Daily at 6:00 PM UTC
- **Production Deployments:** Weekly on Sundays

## Success Criteria

A deployment is considered successful when:

1. All pre-deployment checks pass (100%)
2. Build and tests complete successfully
3. Database migrations applied without errors
4. Post-deployment verification passes all checks
5. No critical errors in first 30 minutes
6. Truth verification score > 0.95
7. Neural operations/sec > 150,000
8. Pattern cache hit rate > 0.80
9. Zero unplanned downtime
10. Rollback capability verified

## Related Documentation

- `/docs/operations/monitoring.md` - Monitoring setup
- `/docs/operations/incident-response.md` - Incident handling
- `/docs/operations/database.md` - Database operations
- `/docs/integration/testing.md` - Testing strategy
- `/docs/neural/architecture.md` - Neural system design
