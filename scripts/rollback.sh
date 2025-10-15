#!/bin/bash
################################################################################
# Rollback Script
# Purpose: Automatic rollback for Claude Code deployments
# Usage: ./rollback.sh [git-sha] [--force]
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="${PROJECT_ROOT}/.swarm/memory.db"
BACKUP_DIR="${PROJECT_ROOT}/.swarm/backups"
INCIDENT_LOG="${PROJECT_ROOT}/.swarm/incidents.log"
ROLLBACK_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Parse arguments
TARGET_SHA="${1:-}"
FORCE_ROLLBACK="${2:-}"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$INCIDENT_LOG"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$INCIDENT_LOG"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$INCIDENT_LOG"
}

################################################################################
# Pre-Rollback Checks
################################################################################

log "=== ROLLBACK INITIATED ==="
log "Timestamp: $ROLLBACK_TIMESTAMP"

# Create incident log if it doesn't exist
mkdir -p "$(dirname "$INCIDENT_LOG")"
touch "$INCIDENT_LOG"

# Ensure we're in the project root
cd "$PROJECT_ROOT"

# Check if git is available
if ! command -v git &> /dev/null; then
    log_error "Git is not installed. Cannot perform rollback."
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not a git repository. Cannot perform rollback."
    exit 1
fi

################################################################################
# Determine Rollback Target
################################################################################

if [ -z "$TARGET_SHA" ]; then
    log "No SHA provided. Looking for previous deployment..."

    # Try to find previous deployment from deployment info
    if [ -f "${PROJECT_ROOT}/.swarm/deployment-history.json" ]; then
        PREVIOUS_SHA=$(jq -r '.[1].sha // empty' "${PROJECT_ROOT}/.swarm/deployment-history.json" 2>/dev/null || echo "")
        if [ -n "$PREVIOUS_SHA" ]; then
            TARGET_SHA="$PREVIOUS_SHA"
            log "Found previous deployment: $TARGET_SHA"
        fi
    fi

    # Fallback: use HEAD~1
    if [ -z "$TARGET_SHA" ]; then
        TARGET_SHA="HEAD~1"
        log_warn "Using HEAD~1 as rollback target"
    fi
else
    log "Rollback target specified: $TARGET_SHA"
fi

# Validate target SHA
if ! git rev-parse "$TARGET_SHA" > /dev/null 2>&1; then
    log_error "Invalid rollback target: $TARGET_SHA"
    exit 1
fi

RESOLVED_SHA=$(git rev-parse "$TARGET_SHA")
CURRENT_SHA=$(git rev-parse HEAD)

log "Current SHA: $CURRENT_SHA"
log "Target SHA: $RESOLVED_SHA"

# Check if already at target
if [ "$CURRENT_SHA" = "$RESOLVED_SHA" ]; then
    log "Already at target SHA. No rollback needed."
    exit 0
fi

################################################################################
# Confirmation
################################################################################

if [ "$FORCE_ROLLBACK" != "--force" ]; then
    echo ""
    echo -e "${YELLOW}WARNING: About to rollback from${NC}"
    echo "  Current: $CURRENT_SHA ($(git log -1 --format=%s $CURRENT_SHA))"
    echo "  Target:  $RESOLVED_SHA ($(git log -1 --format=%s $RESOLVED_SHA))"
    echo ""
    read -p "Continue with rollback? (yes/no): " -r CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log "Rollback cancelled by user."
        exit 0
    fi
fi

################################################################################
# Backup Current State
################################################################################

log "Creating backup of current state..."

# Backup directory
ROLLBACK_BACKUP_DIR="${BACKUP_DIR}/rollback_${ROLLBACK_TIMESTAMP}"
mkdir -p "$ROLLBACK_BACKUP_DIR"

# Backup database
if [ -f "$DB_PATH" ]; then
    log "Backing up database..."
    cp "$DB_PATH" "${ROLLBACK_BACKUP_DIR}/memory.db"
    gzip "${ROLLBACK_BACKUP_DIR}/memory.db"
    log "Database backed up to: ${ROLLBACK_BACKUP_DIR}/memory.db.gz"
fi

# Backup configuration
log "Backing up configuration..."
if [ -f "${PROJECT_ROOT}/.claude/settings.json" ]; then
    cp "${PROJECT_ROOT}/.claude/settings.json" "${ROLLBACK_BACKUP_DIR}/settings.json"
fi

# Save current state metadata
cat > "${ROLLBACK_BACKUP_DIR}/rollback-metadata.json" <<EOF
{
  "rollback_timestamp": "$ROLLBACK_TIMESTAMP",
  "previous_sha": "$CURRENT_SHA",
  "target_sha": "$RESOLVED_SHA",
  "reason": "deployment_failure",
  "initiated_by": "${USER:-unknown}",
  "hostname": "${HOSTNAME:-unknown}"
}
EOF

log "Backup completed: $ROLLBACK_BACKUP_DIR"

################################################################################
# Stop Running Processes
################################################################################

log "Stopping running processes..."

# Stop PM2 processes if running
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "claude-flow"; then
        log "Stopping PM2 processes..."
        pm2 stop claude-flow 2>/dev/null || true
        pm2 delete claude-flow 2>/dev/null || true
    fi
fi

# Stop systemd service if running
if systemctl is-active --quiet claude-flow 2>/dev/null; then
    log "Stopping systemd service..."
    sudo systemctl stop claude-flow || true
fi

# Kill any remaining processes
if pgrep -f "node.*claude-flow" > /dev/null 2>&1; then
    log_warn "Forcefully terminating remaining processes..."
    pkill -f "node.*claude-flow" || true
    sleep 2
fi

################################################################################
# Git Rollback
################################################################################

log "Rolling back git repository..."

# Stash any uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log "Stashing uncommitted changes..."
    git stash push -m "rollback_${ROLLBACK_TIMESTAMP}" || true
fi

# Perform rollback
log "Checking out target SHA: $RESOLVED_SHA"
if ! git checkout "$RESOLVED_SHA"; then
    log_error "Git checkout failed. Attempting to recover..."
    git checkout "$CURRENT_SHA" || true
    exit 1
fi

################################################################################
# Database Migration Rollback
################################################################################

log "Rolling back database migrations..."

# Check if there's a previous database backup
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "memory.db.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2- || echo "")

if [ -n "$LATEST_BACKUP" ]; then
    log "Restoring database from backup: $LATEST_BACKUP"

    # Backup current database before restoring
    cp "$DB_PATH" "${DB_PATH}.before_rollback"

    # Restore backup
    gunzip -c "$LATEST_BACKUP" > "$DB_PATH"

    log "Database restored successfully"
else
    log_warn "No database backup found. Keeping current database."
fi

################################################################################
# Rebuild and Reinstall
################################################################################

log "Reinstalling dependencies..."
if ! npm ci --production; then
    log_error "npm install failed during rollback"
    # Try to restore from backup
    git checkout "$CURRENT_SHA" || true
    exit 1
fi

log "Rebuilding application..."
if ! npm run build; then
    log_error "Build failed during rollback"
    # Try to restore from backup
    git checkout "$CURRENT_SHA" || true
    exit 1
fi

################################################################################
# Restart Processes
################################################################################

log "Restarting processes..."

# Restart PM2 if it was running
if command -v pm2 &> /dev/null && [ -f "${PROJECT_ROOT}/ecosystem.config.js" ]; then
    log "Starting PM2 processes..."
    pm2 start ecosystem.config.js 2>/dev/null || true
fi

# Restart systemd service if it was running
if systemctl list-unit-files | grep -q "claude-flow.service"; then
    log "Starting systemd service..."
    sudo systemctl start claude-flow 2>/dev/null || true
fi

################################################################################
# Verify Rollback
################################################################################

log "Verifying rollback..."

# Wait for system to stabilize
sleep 5

# Run health check
if [ -f "${SCRIPT_DIR}/health-check.sh" ]; then
    log "Running health check..."
    if bash "${SCRIPT_DIR}/health-check.sh"; then
        log "${GREEN}✓ Health check passed${NC}"
    else
        log_error "Health check failed after rollback"
        log_error "System may be in unstable state. Manual intervention required."
        exit 1
    fi
else
    log_warn "Health check script not found. Skipping verification."
fi

################################################################################
# Update Deployment History
################################################################################

log "Updating deployment history..."

HISTORY_FILE="${PROJECT_ROOT}/.swarm/deployment-history.json"
if [ -f "$HISTORY_FILE" ]; then
    # Add rollback entry
    TEMP_FILE=$(mktemp)
    jq --arg sha "$RESOLVED_SHA" --arg timestamp "$(date -Iseconds)" --arg type "rollback" \
       '. += [{"sha": $sha, "timestamp": $timestamp, "type": $type}]' \
       "$HISTORY_FILE" > "$TEMP_FILE"
    mv "$TEMP_FILE" "$HISTORY_FILE"
fi

################################################################################
# Summary
################################################################################

log "=== ROLLBACK COMPLETED ==="
log "Rolled back from: $CURRENT_SHA"
log "Rolled back to:   $RESOLVED_SHA"
log "Backup location:  $ROLLBACK_BACKUP_DIR"
log "Incident log:     $INCIDENT_LOG"

echo ""
echo -e "${GREEN}✓ Rollback completed successfully${NC}"
echo ""
echo "Next steps:"
echo "  1. Review incident log: $INCIDENT_LOG"
echo "  2. Investigate root cause of failure"
echo "  3. Test fix in staging environment"
echo "  4. Deploy fix after validation"
echo ""

exit 0
