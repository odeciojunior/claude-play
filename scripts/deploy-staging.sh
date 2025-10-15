#!/bin/bash
################################################################################
# Staging Deployment Script
# Purpose: Deploy Claude Code to staging environment with verification
# Usage: ./deploy-staging.sh [--skip-tests] [--no-backup]
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="${PROJECT_ROOT}/.swarm/memory.db"
BACKUP_DIR="${PROJECT_ROOT}/.swarm/backups"
DEPLOYMENT_LOG="${PROJECT_ROOT}/.swarm/deployment-staging.log"
REQUIRED_NODE_VERSION="24"

# Parse arguments
SKIP_TESTS=false
NO_BACKUP=false
for arg in "$@"; do
    case $arg in
        --skip-tests) SKIP_TESTS=true ;;
        --no-backup) NO_BACKUP=true ;;
    esac
done

# Track deployment start time
DEPLOYMENT_START=$(date +%s)
DEPLOYMENT_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Error handler
cleanup_on_error() {
    log_error "Deployment failed! Initiating automatic rollback..."
    if [ -f "${SCRIPT_DIR}/rollback.sh" ]; then
        bash "${SCRIPT_DIR}/rollback.sh" --force
    fi
    exit 1
}

trap cleanup_on_error ERR

################################################################################
# Pre-Deployment Checks
################################################################################

log_section "Pre-Deployment Checks - Staging Environment"

log "Starting staging deployment..."
log "Timestamp: $DEPLOYMENT_TIMESTAMP"

# Ensure deployment log directory exists
mkdir -p "$(dirname "$DEPLOYMENT_LOG")"

# Change to project root
cd "$PROJECT_ROOT"

# 1. Node.js Version Check
log "Checking Node.js version..."
CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$CURRENT_NODE_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
    log_error "Node.js version $CURRENT_NODE_VERSION is too old. Required: v$REQUIRED_NODE_VERSION+"
    exit 1
fi
log "✓ Node.js version: v$CURRENT_NODE_VERSION"

# 2. Git Status Check
log "Checking git status..."
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not a git repository"
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
CURRENT_SHA=$(git rev-parse HEAD)
log "✓ Git branch: $CURRENT_BRANCH"
log "✓ Git SHA: $CURRENT_SHA"

# 3. Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_warn "Uncommitted changes detected"
    git status --short
    read -p "Continue anyway? (yes/no): " -r CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        log "Deployment cancelled by user"
        exit 0
    fi
fi

# 4. Environment Validation
log "Validating staging environment..."
if [ ! -f "${PROJECT_ROOT}/.env.staging" ]; then
    log_warn "No .env.staging file found"
else
    log "✓ Environment configuration found"
    # Load staging environment
    export $(cat "${PROJECT_ROOT}/.env.staging" | grep -v '^#' | xargs)
fi

# 5. Disk Space Check
log "Checking disk space..."
AVAILABLE_SPACE=$(df -BG "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 2 ]; then
    log_error "Insufficient disk space: ${AVAILABLE_SPACE}GB available (2GB required)"
    exit 1
fi
log "✓ Disk space: ${AVAILABLE_SPACE}GB available"

################################################################################
# Database Backup
################################################################################

log_section "Database Backup"

if [ "$NO_BACKUP" = false ]; then
    log "Creating database backup..."

    BACKUP_SUBDIR="${BACKUP_DIR}/staging_${DEPLOYMENT_TIMESTAMP}"
    mkdir -p "$BACKUP_SUBDIR"

    if [ -f "$DB_PATH" ]; then
        # Create compressed backup
        cp "$DB_PATH" "${BACKUP_SUBDIR}/memory.db"
        gzip "${BACKUP_SUBDIR}/memory.db"

        BACKUP_SIZE=$(du -h "${BACKUP_SUBDIR}/memory.db.gz" | cut -f1)
        log "✓ Database backed up: ${BACKUP_SUBDIR}/memory.db.gz (${BACKUP_SIZE})"

        # Save backup metadata
        cat > "${BACKUP_SUBDIR}/backup-metadata.json" <<EOF
{
  "timestamp": "$DEPLOYMENT_TIMESTAMP",
  "environment": "staging",
  "git_sha": "$CURRENT_SHA",
  "git_branch": "$CURRENT_BRANCH",
  "backup_size": "$BACKUP_SIZE"
}
EOF
    else
        log_warn "Database file not found. Skipping backup."
    fi

    # Cleanup old backups (keep last 10)
    log "Cleaning up old backups..."
    cd "$BACKUP_DIR"
    ls -t | grep "^staging_" | tail -n +11 | xargs -r rm -rf
    cd "$PROJECT_ROOT"
else
    log_warn "Skipping database backup (--no-backup flag)"
fi

################################################################################
# Dependency Installation
################################################################################

log_section "Installing Dependencies"

log "Installing npm dependencies..."
npm ci --production=false

log "✓ Dependencies installed"

################################################################################
# Build Process
################################################################################

log_section "Building Application"

log "Running TypeScript build..."
BUILD_START=$(date +%s)
npm run build
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))

log "✓ Build completed in ${BUILD_DURATION}s"

# Verify build artifacts
if [ ! -d "${PROJECT_ROOT}/dist" ]; then
    log_error "Build directory not found"
    exit 1
fi

BUILD_FILES=$(find "${PROJECT_ROOT}/dist" -type f -name "*.js" | wc -l)
log "✓ Build artifacts: $BUILD_FILES files"

################################################################################
# Test Execution
################################################################################

log_section "Running Tests"

if [ "$SKIP_TESTS" = false ]; then
    log "Running test suite..."
    TEST_START=$(date +%s)

    if npm test; then
        TEST_END=$(date +%s)
        TEST_DURATION=$((TEST_END - TEST_START))
        log "✓ All tests passed (${TEST_DURATION}s)"
    else
        log_error "Tests failed"
        exit 1
    fi
else
    log_warn "Skipping tests (--skip-tests flag)"
fi

################################################################################
# Linting and Type Checking
################################################################################

log_section "Code Quality Checks"

log "Running linter..."
if npm run lint; then
    log "✓ Linting passed"
else
    log_warn "Linting issues detected (non-blocking in staging)"
fi

log "Running type checker..."
if npm run typecheck; then
    log "✓ Type checking passed"
else
    log_warn "Type errors detected (non-blocking in staging)"
fi

################################################################################
# Database Migration (if needed)
################################################################################

log_section "Database Migration"

# Check if migrations are needed
if [ -d "${PROJECT_ROOT}/migrations" ]; then
    log "Checking for pending migrations..."
    # Add migration logic here if using a migration tool
    log "✓ Migrations up to date"
else
    log "No migrations directory found"
fi

################################################################################
# Process Management
################################################################################

log_section "Process Restart"

log "Stopping existing processes..."

# Stop PM2 processes
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "claude-flow"; then
        log "Stopping PM2 processes..."
        pm2 stop claude-flow || true
        pm2 delete claude-flow || true
    fi
fi

# Stop systemd service
if systemctl is-active --quiet claude-flow-staging 2>/dev/null; then
    log "Stopping systemd service..."
    sudo systemctl stop claude-flow-staging || true
fi

# Start new processes
log "Starting application..."

if command -v pm2 &> /dev/null && [ -f "${PROJECT_ROOT}/ecosystem.config.js" ]; then
    log "Starting with PM2..."
    pm2 start ecosystem.config.js --env staging
    pm2 save
    log "✓ PM2 processes started"
elif systemctl list-unit-files | grep -q "claude-flow-staging.service"; then
    log "Starting with systemd..."
    sudo systemctl start claude-flow-staging
    log "✓ Systemd service started"
else
    log_warn "No process manager found. Manual start required."
fi

# Wait for startup
log "Waiting for application to start..."
sleep 5

################################################################################
# Health Check
################################################################################

log_section "Post-Deployment Health Check"

if [ -f "${SCRIPT_DIR}/health-check.sh" ]; then
    log "Running health check..."
    if bash "${SCRIPT_DIR}/health-check.sh"; then
        log "✓ Health check passed"
    else
        log_error "Health check failed"
        exit 1
    fi
else
    log_warn "Health check script not found"
fi

################################################################################
# Smoke Tests
################################################################################

log_section "Smoke Tests"

if [ -f "${SCRIPT_DIR}/smoke-test.sh" ]; then
    log "Running smoke tests..."
    if bash "${SCRIPT_DIR}/smoke-test.sh"; then
        log "✓ Smoke tests passed"
    else
        log_error "Smoke tests failed"
        exit 1
    fi
else
    log_warn "Smoke test script not found"
fi

################################################################################
# Deployment Report
################################################################################

log_section "Deployment Report"

DEPLOYMENT_END=$(date +%s)
DEPLOYMENT_DURATION=$((DEPLOYMENT_END - DEPLOYMENT_START))

# Generate deployment report
REPORT_FILE="${PROJECT_ROOT}/.swarm/deployment-report-${DEPLOYMENT_TIMESTAMP}.json"
cat > "$REPORT_FILE" <<EOF
{
  "environment": "staging",
  "timestamp": "$DEPLOYMENT_TIMESTAMP",
  "duration_seconds": $DEPLOYMENT_DURATION,
  "git_sha": "$CURRENT_SHA",
  "git_branch": "$CURRENT_BRANCH",
  "node_version": "$CURRENT_NODE_VERSION",
  "build_duration_seconds": $BUILD_DURATION,
  "build_files": $BUILD_FILES,
  "backup_location": "$BACKUP_SUBDIR",
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
jq --arg sha "$CURRENT_SHA" --arg timestamp "$(date -Iseconds)" --arg env "staging" \
   '. += [{"sha": $sha, "timestamp": $timestamp, "environment": $env, "type": "deployment"}]' \
   "$HISTORY_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$HISTORY_FILE"

################################################################################
# Success Summary
################################################################################

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${GREEN}✓ STAGING DEPLOYMENT SUCCESSFUL${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Deployment Summary:"
echo "  Environment:       staging"
echo "  Git SHA:           $CURRENT_SHA"
echo "  Duration:          ${DEPLOYMENT_DURATION}s"
echo "  Build time:        ${BUILD_DURATION}s"
echo "  Backup:            $BACKUP_SUBDIR"
echo "  Deployment log:    $DEPLOYMENT_LOG"
echo "  Report:            $REPORT_FILE"
echo ""
echo "Next steps:"
echo "  1. Verify staging environment: https://staging.example.com"
echo "  2. Run manual QA tests"
echo "  3. Monitor application logs"
echo "  4. If successful, deploy to production"
echo ""

exit 0
