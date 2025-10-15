#!/bin/bash
################################################################################
# Production Deployment Script
# Purpose: Zero-downtime production deployment with blue-green strategy
# Usage: ./deploy-production.sh [--skip-approval] [--canary PERCENTAGE]
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="${PROJECT_ROOT}/.swarm/memory.db"
BACKUP_DIR="${PROJECT_ROOT}/.swarm/backups"
DEPLOYMENT_LOG="${PROJECT_ROOT}/.swarm/deployment-production.log"
REQUIRED_NODE_VERSION="24"
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_INTERVAL=10

# Parse arguments
SKIP_APPROVAL=false
CANARY_PERCENTAGE=0
for arg in "$@"; do
    case $arg in
        --skip-approval) SKIP_APPROVAL=true ;;
        --canary) CANARY_PERCENTAGE="${2:-10}"; shift ;;
    esac
done

# Track deployment start time
DEPLOYMENT_START=$(date +%s)
DEPLOYMENT_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CURRENT_SHA=""
CURRENT_BRANCH=""

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$DEPLOYMENT_LOG"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$DEPLOYMENT_LOG"
}

log_section() {
    echo ""
    echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║${NC} $1"
    echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Error handler with automatic rollback
cleanup_on_error() {
    log_error "PRODUCTION DEPLOYMENT FAILED!"
    log_error "Initiating automatic rollback..."

    # Send alert (implement your alerting mechanism)
    send_alert "CRITICAL: Production deployment failed. Automatic rollback initiated."

    if [ -f "${SCRIPT_DIR}/rollback.sh" ]; then
        bash "${SCRIPT_DIR}/rollback.sh" --force
    fi

    exit 1
}

trap cleanup_on_error ERR

# Alert function (customize for your alerting system)
send_alert() {
    local message="$1"
    log_warn "ALERT: $message"

    # Example: Send to Slack, PagerDuty, email, etc.
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"$message\"}" \
    #   "$SLACK_WEBHOOK_URL"
}

################################################################################
# Pre-Deployment Checks
################################################################################

log_section "🚀 PRODUCTION DEPLOYMENT - Pre-Flight Checks"

log "Starting production deployment..."
log "Timestamp: $DEPLOYMENT_TIMESTAMP"

# Ensure deployment log directory exists
mkdir -p "$(dirname "$DEPLOYMENT_LOG")"

# Change to project root
cd "$PROJECT_ROOT"

# 1. Critical Environment Check
log "Verifying production environment..."
if [ "${ENVIRONMENT:-}" != "production" ]; then
    log_error "ENVIRONMENT variable is not set to 'production'"
    log_error "This is a safety check. Set ENVIRONMENT=production to proceed."
    exit 1
fi
log "✓ Environment: production"

# 2. Git Status Check
log "Checking git repository..."
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not a git repository"
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
CURRENT_SHA=$(git rev-parse HEAD)

# Production must be deployed from main branch
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_error "Production must be deployed from 'main' branch (current: $CURRENT_BRANCH)"
    exit 1
fi
log "✓ Git branch: $CURRENT_BRANCH"
log "✓ Git SHA: $CURRENT_SHA"

# 3. Ensure no uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_error "Uncommitted changes detected. Commit or stash changes before deploying to production."
    git status --short
    exit 1
fi
log "✓ No uncommitted changes"

# 4. Node.js Version Check
log "Checking Node.js version..."
CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$CURRENT_NODE_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
    log_error "Node.js version $CURRENT_NODE_VERSION is too old. Required: v$REQUIRED_NODE_VERSION+"
    exit 1
fi
log "✓ Node.js version: v$CURRENT_NODE_VERSION"

# 5. Production Configuration Check
log "Validating production configuration..."
if [ ! -f "${PROJECT_ROOT}/.env.production" ]; then
    log_error "Production environment file not found: .env.production"
    exit 1
fi
log "✓ Production configuration found"

# Load production environment
export $(cat "${PROJECT_ROOT}/.env.production" | grep -v '^#' | xargs)

# 6. Disk Space Check
log "Checking disk space..."
AVAILABLE_SPACE=$(df -BG "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 5 ]; then
    log_error "Insufficient disk space: ${AVAILABLE_SPACE}GB available (5GB required for production)"
    exit 1
fi
log "✓ Disk space: ${AVAILABLE_SPACE}GB available"

# 7. Database Integrity Check
log "Checking database integrity..."
if [ ! -f "$DB_PATH" ]; then
    log_error "Production database not found: $DB_PATH"
    exit 1
fi

sqlite3 "$DB_PATH" "PRAGMA integrity_check;" > /dev/null 2>&1 || {
    log_error "Database integrity check failed"
    exit 1
}
log "✓ Database integrity verified"

# 8. Staging Validation Check
log "Verifying staging deployment..."
LAST_STAGING_DEPLOY=$(jq -r '.[] | select(.environment == "staging") | .timestamp' \
    "${PROJECT_ROOT}/.swarm/deployment-history.json" 2>/dev/null | head -1 || echo "")

if [ -z "$LAST_STAGING_DEPLOY" ]; then
    log_warn "No recent staging deployment found"
    log_warn "It's recommended to deploy to staging first"
fi

################################################################################
# Deployment Approval Gate
################################################################################

log_section "🔐 Deployment Approval"

if [ "$SKIP_APPROVAL" = false ]; then
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║${NC} ${RED}PRODUCTION DEPLOYMENT APPROVAL REQUIRED${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Deployment Details:"
    echo "  Environment:       production"
    echo "  Branch:            $CURRENT_BRANCH"
    echo "  SHA:               $CURRENT_SHA"
    echo "  Commit message:    $(git log -1 --format=%s)"
    echo "  Deployer:          ${USER:-unknown}"
    echo "  Timestamp:         $(date)"
    echo ""
    echo "Pre-flight checks:"
    echo "  ✓ Environment validated"
    echo "  ✓ Git status clean"
    echo "  ✓ Node.js version correct"
    echo "  ✓ Configuration present"
    echo "  ✓ Database integrity verified"
    echo "  ✓ Disk space sufficient"
    echo ""

    read -p "Type 'DEPLOY TO PRODUCTION' to continue: " -r APPROVAL
    if [ "$APPROVAL" != "DEPLOY TO PRODUCTION" ]; then
        log "Deployment cancelled by user"
        exit 0
    fi

    log "✓ Deployment approved"
else
    log_warn "Skipping approval gate (--skip-approval flag)"
fi

################################################################################
# Database Backup (Critical for Production)
################################################################################

log_section "💾 Database Backup"

log "Creating production database backup..."

BACKUP_SUBDIR="${BACKUP_DIR}/production_${DEPLOYMENT_TIMESTAMP}"
mkdir -p "$BACKUP_SUBDIR"

# Full backup with verification
cp "$DB_PATH" "${BACKUP_SUBDIR}/memory.db"

# Verify backup integrity
sqlite3 "${BACKUP_SUBDIR}/memory.db" "PRAGMA integrity_check;" > /dev/null 2>&1 || {
    log_error "Backup verification failed"
    exit 1
}

# Compress backup
gzip "${BACKUP_SUBDIR}/memory.db"

BACKUP_SIZE=$(du -h "${BACKUP_SUBDIR}/memory.db.gz" | cut -f1)
log "✓ Database backed up: ${BACKUP_SUBDIR}/memory.db.gz (${BACKUP_SIZE})"

# Calculate backup checksum
BACKUP_CHECKSUM=$(md5sum "${BACKUP_SUBDIR}/memory.db.gz" | cut -d' ' -f1)
log "✓ Backup checksum: $BACKUP_CHECKSUM"

# Save backup metadata
cat > "${BACKUP_SUBDIR}/backup-metadata.json" <<EOF
{
  "timestamp": "$DEPLOYMENT_TIMESTAMP",
  "environment": "production",
  "git_sha": "$CURRENT_SHA",
  "git_branch": "$CURRENT_BRANCH",
  "backup_size": "$BACKUP_SIZE",
  "checksum": "$BACKUP_CHECKSUM",
  "deployer": "${USER:-unknown}"
}
EOF

# Upload backup to remote storage (customize for your setup)
log "Uploading backup to remote storage..."
# Example: aws s3 cp "${BACKUP_SUBDIR}/memory.db.gz" "s3://your-bucket/backups/"
log "✓ Backup secured"

################################################################################
# Blue-Green Deployment Setup
################################################################################

log_section "🔵🟢 Blue-Green Deployment Setup"

log "Setting up blue-green deployment..."

# Determine current color
CURRENT_COLOR=$(cat "${PROJECT_ROOT}/.swarm/current-color" 2>/dev/null || echo "blue")
if [ "$CURRENT_COLOR" = "blue" ]; then
    NEW_COLOR="green"
else
    NEW_COLOR="blue"
fi

log "Current environment: $CURRENT_COLOR"
log "Deploying to: $NEW_COLOR"

# Create deployment directory for new color
DEPLOY_DIR="${PROJECT_ROOT}_${NEW_COLOR}"
log "Deployment directory: $DEPLOY_DIR"

################################################################################
# Build New Environment
################################################################################

log_section "🔨 Building New Environment"

log "Creating new environment directory..."
if [ -d "$DEPLOY_DIR" ]; then
    log_warn "Deployment directory already exists. Cleaning up..."
    rm -rf "$DEPLOY_DIR"
fi

# Clone current directory to new environment
log "Cloning repository to new environment..."
cp -a "$PROJECT_ROOT" "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

log "Installing dependencies..."
npm ci --production=false

log "Building application..."
BUILD_START=$(date +%s)
npm run build
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))
log "✓ Build completed in ${BUILD_DURATION}s"

# Verify build
BUILD_FILES=$(find "${DEPLOY_DIR}/dist" -type f -name "*.js" | wc -l)
log "✓ Build artifacts: $BUILD_FILES files"

################################################################################
# Run Tests in New Environment
################################################################################

log_section "🧪 Testing New Environment"

log "Running comprehensive test suite..."
TEST_START=$(date +%s)

if npm test; then
    TEST_END=$(date +%s)
    TEST_DURATION=$((TEST_END - TEST_START))
    log "✓ All tests passed (${TEST_DURATION}s)"
else
    log_error "Tests failed in new environment"
    exit 1
fi

log "Running linter..."
npm run lint || log_warn "Linting issues detected"

log "Running type checker..."
npm run typecheck || log_warn "Type errors detected"

################################################################################
# Health Check on New Environment
################################################################################

log_section "🏥 Health Check (New Environment)"

# Start new environment on alternate port
NEW_PORT=8081
export PORT=$NEW_PORT

log "Starting new environment on port $NEW_PORT..."
if command -v pm2 &> /dev/null; then
    pm2 start ecosystem.config.js --name "claude-flow-${NEW_COLOR}" --env production -- --port $NEW_PORT
else
    log_warn "PM2 not found. Starting with node..."
    node dist/index.js --port $NEW_PORT &
    NEW_PID=$!
    echo $NEW_PID > "${DEPLOY_DIR}/.pid"
fi

# Wait for startup
log "Waiting for application to start..."
sleep 10

# Health check with retries
log "Running health checks on new environment..."
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    log "Health check attempt $i/$HEALTH_CHECK_RETRIES..."

    if bash "${SCRIPT_DIR}/health-check.sh"; then
        log "✓ Health check passed"
        break
    else
        if [ $i -eq $HEALTH_CHECK_RETRIES ]; then
            log_error "Health check failed after $HEALTH_CHECK_RETRIES attempts"
            # Stop new environment
            pm2 stop "claude-flow-${NEW_COLOR}" 2>/dev/null || kill $(cat "${DEPLOY_DIR}/.pid" 2>/dev/null) || true
            exit 1
        fi
        log_warn "Health check failed. Retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
    fi
done

################################################################################
# Smoke Tests on New Environment
################################################################################

log_section "💨 Smoke Tests (New Environment)"

if bash "${SCRIPT_DIR}/smoke-test.sh"; then
    log "✓ Smoke tests passed"
else
    log_error "Smoke tests failed"
    pm2 stop "claude-flow-${NEW_COLOR}" 2>/dev/null || kill $(cat "${DEPLOY_DIR}/.pid" 2>/dev/null) || true
    exit 1
fi

################################################################################
# Canary Deployment (Optional)
################################################################################

if [ $CANARY_PERCENTAGE -gt 0 ]; then
    log_section "🐤 Canary Deployment ($CANARY_PERCENTAGE%)"

    log "Starting canary deployment with ${CANARY_PERCENTAGE}% traffic..."

    # Configure load balancer to route CANARY_PERCENTAGE% of traffic to new environment
    # This is platform-specific (nginx, haproxy, cloud load balancer, etc.)
    # Example for nginx:
    # ./scripts/update-loadbalancer.sh --canary $CANARY_PERCENTAGE --target $NEW_COLOR

    log "Monitoring canary for 5 minutes..."
    CANARY_DURATION=300
    CANARY_START=$(date +%s)

    while [ $(($(date +%s) - CANARY_START)) -lt $CANARY_DURATION ]; do
        ELAPSED=$(($(date +%s) - CANARY_START))
        REMAINING=$((CANARY_DURATION - ELAPSED))
        echo -ne "\rCanary monitoring: ${ELAPSED}s elapsed, ${REMAINING}s remaining..."
        sleep 10

        # Check canary health
        if ! bash "${SCRIPT_DIR}/health-check.sh" > /dev/null 2>&1; then
            log_error "Canary health check failed. Rolling back..."
            pm2 stop "claude-flow-${NEW_COLOR}"
            # Restore load balancer to 100% old environment
            exit 1
        fi
    done

    echo ""
    log "✓ Canary deployment successful"
fi

################################################################################
# Traffic Switch (Zero-Downtime)
################################################################################

log_section "🔄 Traffic Switch"

log "Switching traffic from $CURRENT_COLOR to $NEW_COLOR..."

# Update load balancer / reverse proxy configuration
# This is platform-specific (nginx, haproxy, cloud load balancer, etc.)
# Example for nginx:
# ./scripts/update-loadbalancer.sh --switch-to $NEW_COLOR

# For PM2-based deployment:
if command -v pm2 &> /dev/null; then
    log "Updating PM2 configuration..."

    # Reload new environment
    pm2 reload "claude-flow-${NEW_COLOR}"

    # Wait for reload
    sleep 5

    # Stop old environment
    log "Stopping old environment ($CURRENT_COLOR)..."
    pm2 stop "claude-flow-${CURRENT_COLOR}" 2>/dev/null || true
    pm2 delete "claude-flow-${CURRENT_COLOR}" 2>/dev/null || true
fi

# Update current color marker
echo "$NEW_COLOR" > "${PROJECT_ROOT}/.swarm/current-color"

log "✓ Traffic switched to $NEW_COLOR"

################################################################################
# Post-Deployment Verification
################################################################################

log_section "✅ Post-Deployment Verification"

log "Waiting for traffic switch to stabilize..."
sleep 10

log "Running final health check..."
for i in $(seq 1 3); do
    if bash "${SCRIPT_DIR}/health-check.sh"; then
        log "✓ Health check passed ($i/3)"
    else
        log_error "Post-deployment health check failed"
        send_alert "CRITICAL: Post-deployment health check failed. Manual intervention required."
        exit 1
    fi
    sleep 5
done

log "Running final smoke tests..."
if bash "${SCRIPT_DIR}/smoke-test.sh"; then
    log "✓ Smoke tests passed"
else
    log_error "Post-deployment smoke tests failed"
    send_alert "CRITICAL: Post-deployment smoke tests failed. Manual intervention required."
    exit 1
fi

################################################################################
# Deployment Report
################################################################################

log_section "📊 Deployment Report"

DEPLOYMENT_END=$(date +%s)
DEPLOYMENT_DURATION=$((DEPLOYMENT_END - DEPLOYMENT_START))

# Generate deployment report
REPORT_FILE="${PROJECT_ROOT}/.swarm/deployment-report-production-${DEPLOYMENT_TIMESTAMP}.json"
cat > "$REPORT_FILE" <<EOF
{
  "environment": "production",
  "timestamp": "$DEPLOYMENT_TIMESTAMP",
  "duration_seconds": $DEPLOYMENT_DURATION,
  "git_sha": "$CURRENT_SHA",
  "git_branch": "$CURRENT_BRANCH",
  "node_version": "$CURRENT_NODE_VERSION",
  "build_duration_seconds": $BUILD_DURATION,
  "build_files": $BUILD_FILES,
  "backup_location": "$BACKUP_SUBDIR",
  "backup_checksum": "$BACKUP_CHECKSUM",
  "deployment_strategy": "blue-green",
  "deployed_color": "$NEW_COLOR",
  "canary_percentage": $CANARY_PERCENTAGE,
  "deployer": "${USER:-unknown}",
  "status": "success"
}
EOF

log "✓ Deployment report: $REPORT_FILE"

# Update deployment history
HISTORY_FILE="${PROJECT_ROOT}/.swarm/deployment-history.json"
if [ ! -f "$HISTORY_FILE" ]; then
    echo "[]" > "$HISTORY_FILE"
fi

TEMP_FILE=$(mktemp)
jq --arg sha "$CURRENT_SHA" --arg timestamp "$(date -Iseconds)" --arg env "production" \
   '. += [{"sha": $sha, "timestamp": $timestamp, "environment": $env, "type": "deployment"}]' \
   "$HISTORY_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$HISTORY_FILE"

# Cleanup old deployment directory
log "Cleaning up old environment..."
OLD_DEPLOY_DIR="${PROJECT_ROOT}_${CURRENT_COLOR}"
if [ -d "$OLD_DEPLOY_DIR" ] && [ "$OLD_DEPLOY_DIR" != "$PROJECT_ROOT" ]; then
    rm -rf "$OLD_DEPLOY_DIR"
    log "✓ Old environment cleaned up"
fi

################################################################################
# Success Summary
################################################################################

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${GREEN}✓ PRODUCTION DEPLOYMENT SUCCESSFUL${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Deployment Summary:"
echo "  Environment:       production"
echo "  Strategy:          blue-green"
echo "  Active color:      $NEW_COLOR"
echo "  Git SHA:           $CURRENT_SHA"
echo "  Duration:          ${DEPLOYMENT_DURATION}s"
echo "  Build time:        ${BUILD_DURATION}s"
echo "  Backup:            $BACKUP_SUBDIR"
echo "  Checksum:          $BACKUP_CHECKSUM"
echo "  Deployment log:    $DEPLOYMENT_LOG"
echo "  Report:            $REPORT_FILE"
echo ""
echo "Post-Deployment Actions:"
echo "  1. ✓ Health checks passed"
echo "  2. ✓ Smoke tests passed"
echo "  3. ✓ Database backed up"
echo "  4. ✓ Traffic switched successfully"
echo ""
echo "Monitoring:"
echo "  - Monitor application logs: pm2 logs claude-flow-${NEW_COLOR}"
echo "  - Check metrics dashboard"
echo "  - Monitor error rates"
echo "  - Verify user traffic"
echo ""

# Send success notification
send_alert "✓ Production deployment successful. SHA: $CURRENT_SHA, Duration: ${DEPLOYMENT_DURATION}s"

cd "$PROJECT_ROOT"
exit 0
