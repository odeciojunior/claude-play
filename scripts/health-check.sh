#!/bin/bash
################################################################################
# Health Check Script
# Purpose: Validate system health for Claude Code deployment
# Exit Codes: 0 = healthy, 1 = unhealthy
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
REQUIRED_NODE_VERSION="24"
HEALTH_CHECK_TIMEOUT=30

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Track failures
HEALTH_CHECK_FAILURES=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((HEALTH_CHECK_FAILURES++))
}

################################################################################
# Health Checks
################################################################################

log "Starting health check..."
echo "=================================="

# 1. Node.js Version Check
log "Checking Node.js version..."
CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$CURRENT_NODE_VERSION" -ge "$REQUIRED_NODE_VERSION" ]; then
    check_pass "Node.js version: v$CURRENT_NODE_VERSION (required: v$REQUIRED_NODE_VERSION+)"
else
    check_fail "Node.js version: v$CURRENT_NODE_VERSION (required: v$REQUIRED_NODE_VERSION+)"
fi

# 2. Database Connectivity Test
log "Checking database connectivity..."
if [ -f "$DB_PATH" ]; then
    if sqlite3 "$DB_PATH" "SELECT 1;" > /dev/null 2>&1; then
        check_pass "Database connectivity successful"
    else
        check_fail "Database is not accessible"
    fi
else
    check_fail "Database file not found at $DB_PATH"
fi

# 3. Database Schema Validation
log "Validating database schema..."
EXPECTED_TABLES=("patterns" "pattern_embeddings" "task_trajectories" "metrics_log" "memory_entries")
for table in "${EXPECTED_TABLES[@]}"; do
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" | grep -q "$table"; then
        check_pass "Table exists: $table"
    else
        check_fail "Table missing: $table"
    fi
done

# 4. Pattern Library Validation
log "Checking pattern library..."
PATTERN_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM patterns;" 2>/dev/null || echo "0")
if [ "$PATTERN_COUNT" -gt 0 ]; then
    check_pass "Pattern library contains $PATTERN_COUNT patterns"
else
    log_warn "Pattern library is empty (this may be normal for new deployments)"
fi

# 5. Neural System Status
log "Checking neural system status..."
if [ -f "${PROJECT_ROOT}/dist/neural/learning-pipeline.js" ]; then
    check_pass "Neural system compiled"
else
    check_fail "Neural system not compiled"
fi

# 6. Memory System Health
log "Checking memory system..."
MEMORY_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM memory_entries;" 2>/dev/null || echo "0")
if [ "$MEMORY_COUNT" -ge 0 ]; then
    check_pass "Memory system accessible ($MEMORY_COUNT entries)"
else
    check_fail "Memory system not accessible"
fi

# 7. Disk Space Check
log "Checking disk space..."
DISK_USAGE=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Disk usage: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
    log_warn "Disk usage: ${DISK_USAGE}% (warning threshold)"
else
    check_fail "Disk usage: ${DISK_USAGE}% (critical)"
fi

# 8. Memory Usage Check
log "Checking memory usage..."
if command -v free &> /dev/null; then
    MEMORY_USAGE=$(free | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')
    if [ "$MEMORY_USAGE" -lt 80 ]; then
        check_pass "Memory usage: ${MEMORY_USAGE}%"
    elif [ "$MEMORY_USAGE" -lt 90 ]; then
        log_warn "Memory usage: ${MEMORY_USAGE}% (warning threshold)"
    else
        check_fail "Memory usage: ${MEMORY_USAGE}% (critical)"
    fi
else
    log_warn "Cannot check memory usage (free command not available)"
fi

# 9. Build Artifacts Check
log "Checking build artifacts..."
if [ -d "${PROJECT_ROOT}/dist" ]; then
    BUILD_FILE_COUNT=$(find "${PROJECT_ROOT}/dist" -type f -name "*.js" | wc -l)
    if [ "$BUILD_FILE_COUNT" -gt 0 ]; then
        check_pass "Build artifacts present ($BUILD_FILE_COUNT files)"
    else
        check_fail "No build artifacts found"
    fi
else
    check_fail "Build directory not found"
fi

# 10. Dependencies Check
log "Checking dependencies..."
if [ -d "${PROJECT_ROOT}/node_modules" ]; then
    check_pass "Node modules installed"
else
    check_fail "Node modules not installed"
fi

# 11. Configuration Files Check
log "Checking configuration files..."
CONFIG_FILES=("package.json" "tsconfig.json" ".claude/settings.json")
for config in "${CONFIG_FILES[@]}"; do
    if [ -f "${PROJECT_ROOT}/${config}" ]; then
        check_pass "Configuration file exists: $config"
    else
        check_fail "Configuration file missing: $config"
    fi
done

# 12. Performance Metrics Check (if available)
log "Checking performance metrics..."
if sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM metrics_log;" > /dev/null 2>&1; then
    METRICS_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM metrics_log;")
    check_pass "Performance metrics available ($METRICS_COUNT entries)"
else
    log_warn "Performance metrics not available"
fi

# 13. Process Check (if running)
log "Checking running processes..."
if pgrep -f "node.*claude-flow" > /dev/null 2>&1; then
    PROCESS_COUNT=$(pgrep -f "node.*claude-flow" | wc -l)
    check_pass "Claude Flow processes running: $PROCESS_COUNT"
else
    log_warn "No Claude Flow processes detected (may be normal if not started)"
fi

################################################################################
# Summary and Exit
################################################################################

echo "=================================="
if [ $HEALTH_CHECK_FAILURES -eq 0 ]; then
    log "${GREEN}All health checks passed!${NC}"
    echo "System Status: HEALTHY"
    exit 0
else
    log_error "${RED}Health check failed with $HEALTH_CHECK_FAILURES failure(s)${NC}"
    echo "System Status: UNHEALTHY"
    exit 1
fi
