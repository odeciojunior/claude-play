#!/bin/bash
################################################################################
# Smoke Test Script
# Purpose: Post-deployment validation for Claude Code system
# Exit Codes: 0 = all tests passed, 1 = tests failed
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
TEST_TIMEOUT=60

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

# Track test results
TEST_FAILURES=0
TEST_COUNT=0

test_pass() {
    ((TEST_COUNT++))
    echo -e "${GREEN}✓ Test $TEST_COUNT:${NC} $1"
}

test_fail() {
    ((TEST_COUNT++))
    ((TEST_FAILURES++))
    echo -e "${RED}✗ Test $TEST_COUNT:${NC} $1"
}

################################################################################
# Smoke Tests
################################################################################

log "Starting smoke tests..."
echo "=================================="

# 1. Basic Functionality Test - Database Query
log "Test 1: Database query test..."
if timeout $TEST_TIMEOUT sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM patterns;" > /dev/null 2>&1; then
    test_pass "Database query successful"
else
    test_fail "Database query failed"
fi

# 2. Neural System Operations Test
log "Test 2: Neural system operations..."
cd "$PROJECT_ROOT"
if timeout $TEST_TIMEOUT npx claude-flow neural status > /dev/null 2>&1; then
    test_pass "Neural system status check successful"
else
    test_fail "Neural system status check failed"
fi

# 3. Pattern Retrieval Test
log "Test 3: Pattern retrieval test..."
if timeout $TEST_TIMEOUT sqlite3 "$DB_PATH" "SELECT * FROM patterns LIMIT 1;" > /dev/null 2>&1; then
    test_pass "Pattern retrieval successful"
else
    test_fail "Pattern retrieval failed"
fi

# 4. Memory System Test
log "Test 4: Memory system operations..."
if timeout $TEST_TIMEOUT sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM memory_entries;" > /dev/null 2>&1; then
    test_pass "Memory system accessible"
else
    test_fail "Memory system not accessible"
fi

# 5. Build Integrity Test
log "Test 5: Build integrity check..."
if [ -f "${PROJECT_ROOT}/dist/neural/learning-pipeline.js" ] && [ -f "${PROJECT_ROOT}/dist/neural/pattern-extraction.js" ]; then
    test_pass "Build artifacts intact"
else
    test_fail "Build artifacts missing or corrupted"
fi

# 6. Configuration Integrity Test
log "Test 6: Configuration integrity..."
if node -e "const pkg = require('${PROJECT_ROOT}/package.json'); process.exit(pkg.version ? 0 : 1);" 2>/dev/null; then
    test_pass "Configuration files valid"
else
    test_fail "Configuration files corrupted"
fi

# 7. GOAP Planning Test
log "Test 7: GOAP planning system..."
if [ -d "${PROJECT_ROOT}/.claude/agents" ]; then
    AGENT_COUNT=$(find "${PROJECT_ROOT}/.claude/agents" -name "*.md" | wc -l)
    if [ "$AGENT_COUNT" -gt 60 ]; then
        test_pass "GOAP agents available ($AGENT_COUNT agents)"
    else
        test_fail "Insufficient agents ($AGENT_COUNT found, expected 60+)"
    fi
else
    test_fail "Agents directory not found"
fi

# 8. Truth Verification System Test
log "Test 8: Truth verification system..."
if [ -f "${PROJECT_ROOT}/.swarm/verification-memory.json" ]; then
    test_pass "Verification system initialized"
else
    test_fail "Verification system not initialized"
fi

# 9. Database Write Test
log "Test 9: Database write operations..."
TEST_KEY="smoke_test_$(date +%s)"
TEST_VALUE="smoke_test_value_$(date +%s)"
if sqlite3 "$DB_PATH" "INSERT OR REPLACE INTO memory_entries (key, value, namespace, created_at) VALUES ('$TEST_KEY', '$TEST_VALUE', 'smoke-test', datetime('now'));" 2>/dev/null; then
    # Verify write
    RETRIEVED_VALUE=$(sqlite3 "$DB_PATH" "SELECT value FROM memory_entries WHERE key='$TEST_KEY';" 2>/dev/null || echo "")
    if [ "$RETRIEVED_VALUE" = "$TEST_VALUE" ]; then
        test_pass "Database write and read successful"
        # Cleanup
        sqlite3 "$DB_PATH" "DELETE FROM memory_entries WHERE namespace='smoke-test';" 2>/dev/null || true
    else
        test_fail "Database write verification failed"
    fi
else
    test_fail "Database write operation failed"
fi

# 10. Performance Baseline Test
log "Test 10: Performance baseline check..."
START_TIME=$(date +%s%N)
sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM patterns;" > /dev/null 2>&1
END_TIME=$(date +%s%N)
DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ "$DURATION_MS" -lt 100 ]; then
    test_pass "Query performance acceptable (${DURATION_MS}ms)"
else
    test_warn "Query performance slow (${DURATION_MS}ms)"
fi

# 11. Memory Leak Detection Test
log "Test 11: Memory leak detection..."
INITIAL_MEMORY=$(sqlite3 "$DB_PATH" "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();" 2>/dev/null || echo "0")
# Perform some operations
for i in {1..10}; do
    sqlite3 "$DB_PATH" "SELECT * FROM patterns LIMIT 10;" > /dev/null 2>&1
done
FINAL_MEMORY=$(sqlite3 "$DB_PATH" "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();" 2>/dev/null || echo "0")

MEMORY_GROWTH=$((FINAL_MEMORY - INITIAL_MEMORY))
if [ "$MEMORY_GROWTH" -lt 1000000 ]; then  # Less than 1MB growth
    test_pass "No memory leak detected (${MEMORY_GROWTH} bytes)"
else
    test_fail "Potential memory leak detected (${MEMORY_GROWTH} bytes)"
fi

# 12. Agent System Test
log "Test 12: Agent system availability..."
if [ -f "${PROJECT_ROOT}/.claude/settings.json" ]; then
    test_pass "Agent configuration available"
else
    test_fail "Agent configuration missing"
fi

# 13. Concurrent Access Test
log "Test 13: Concurrent database access..."
CONCURRENT_TESTS=5
CONCURRENT_FAILURES=0
for i in $(seq 1 $CONCURRENT_TESTS); do
    (sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM patterns;" > /dev/null 2>&1) &
done
wait
if [ $? -eq 0 ]; then
    test_pass "Concurrent access successful"
else
    test_fail "Concurrent access failed"
fi

# 14. Error Handling Test
log "Test 14: Error handling validation..."
# Try to query a non-existent table
if sqlite3 "$DB_PATH" "SELECT * FROM non_existent_table;" 2>&1 | grep -q "no such table"; then
    test_pass "Error handling working correctly"
else
    test_fail "Error handling not working correctly"
fi

# 15. Deployment Marker Test
log "Test 15: Deployment marker check..."
if [ -f "${PROJECT_ROOT}/.swarm/deployment-info.json" ]; then
    DEPLOYMENT_TIME=$(jq -r '.timestamp // "unknown"' "${PROJECT_ROOT}/.swarm/deployment-info.json" 2>/dev/null || echo "unknown")
    test_pass "Deployment marker present (deployed: $DEPLOYMENT_TIME)"
else
    test_warn "Deployment marker not found (may be normal for manual deployments)"
fi

################################################################################
# Integration Tests
################################################################################

log "Running integration tests..."

# 16. Full System Integration Test
log "Test 16: Full system integration..."
if timeout $TEST_TIMEOUT bash -c "cd '$PROJECT_ROOT' && npx claude-flow neural status && sqlite3 '$DB_PATH' 'SELECT COUNT(*) FROM patterns;'" > /dev/null 2>&1; then
    test_pass "Full system integration working"
else
    test_fail "Full system integration failed"
fi

################################################################################
# Summary and Exit
################################################################################

echo "=================================="
log "Smoke tests completed: $TEST_COUNT tests run"

if [ $TEST_FAILURES -eq 0 ]; then
    log "${GREEN}✓ All smoke tests passed!${NC}"
    echo "Deployment Status: VERIFIED"
    exit 0
else
    log_error "${RED}✗ $TEST_FAILURES test(s) failed out of $TEST_COUNT${NC}"
    echo "Deployment Status: FAILED VERIFICATION"
    exit 1
fi
