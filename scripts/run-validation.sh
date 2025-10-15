#!/bin/bash

###############################################################################
# Staging Validation Runner
#
# Comprehensive staging validation script that runs all validation tests
# and generates a detailed report.
#
# Usage:
#   ./scripts/run-validation.sh [options]
#
# Options:
#   --quick       Run only smoke tests (fast)
#   --full        Run all validation tests (default)
#   --report      Generate detailed HTML report
#   --ci          CI mode (stricter thresholds)
#   --notify      Send notifications on failure (requires config)
#
# Exit Codes:
#   0 - All tests passed
#   1 - Tests failed
#   2 - Setup error
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATION_DIR="$PROJECT_ROOT/tests/staging"
REPORT_DIR="$PROJECT_ROOT/validation-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/validation_$TIMESTAMP.txt"

# Default options
MODE="full"
GENERATE_REPORT=false
CI_MODE=false
NOTIFY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --quick)
      MODE="quick"
      shift
      ;;
    --full)
      MODE="full"
      shift
      ;;
    --report)
      GENERATE_REPORT=true
      shift
      ;;
    --ci)
      CI_MODE=true
      shift
      ;;
    --notify)
      NOTIFY=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 2
      ;;
  esac
done

###############################################################################
# Functions
###############################################################################

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
  echo ""
  echo "=========================================="
  echo "$1"
  echo "=========================================="
  echo ""
}

check_prerequisites() {
  print_header "Checking Prerequisites"

  # Check Node.js
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 2
  fi
  log_success "Node.js $(node --version) found"

  # Check npm
  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 2
  fi
  log_success "npm $(npm --version) found"

  # Check if dependencies are installed
  if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    log_warning "node_modules not found, installing dependencies..."
    cd "$PROJECT_ROOT"
    npm install
  fi
  log_success "Dependencies installed"

  # Check if test directories exist
  if [ ! -d "$VALIDATION_DIR" ]; then
    log_error "Staging test directory not found: $VALIDATION_DIR"
    exit 2
  fi
  log_success "Test directory found"

  # Create report directory
  mkdir -p "$REPORT_DIR"
  log_success "Report directory ready: $REPORT_DIR"
}

setup_environment() {
  print_header "Setting Up Environment"

  cd "$PROJECT_ROOT"

  # Set NODE_ENV
  export NODE_ENV=staging
  log_info "NODE_ENV=staging"

  # Create test database directory
  mkdir -p .test-swarm
  log_success "Test database directory ready"

  # Build if needed
  if [ ! -d "dist" ] || [ "$CI_MODE" = true ]; then
    log_info "Building TypeScript..."
    npm run build
    log_success "Build completed"
  else
    log_info "Skipping build (dist exists)"
  fi
}

run_smoke_tests() {
  print_header "Running Smoke Tests"

  cd "$PROJECT_ROOT"

  log_info "Executing smoke tests..."

  if npm test -- tests/staging/smoke-tests.test.ts --testTimeout=30000 2>&1 | tee -a "$REPORT_FILE"; then
    log_success "Smoke tests passed ✓"
    return 0
  else
    log_error "Smoke tests failed ✗"
    return 1
  fi
}

run_validation_tests() {
  print_header "Running Validation Tests"

  cd "$PROJECT_ROOT"

  log_info "Executing comprehensive validation..."

  if npm test -- tests/staging/validation.test.ts --testTimeout=30000 2>&1 | tee -a "$REPORT_FILE"; then
    log_success "Validation tests passed ✓"
    return 0
  else
    log_error "Validation tests failed ✗"
    return 1
  fi
}

run_performance_tests() {
  print_header "Running Performance Tests"

  cd "$PROJECT_ROOT"

  log_info "Executing performance validation..."

  if npm test -- tests/staging/performance.test.ts --testTimeout=60000 2>&1 | tee -a "$REPORT_FILE"; then
    log_success "Performance tests passed ✓"
    return 0
  else
    log_error "Performance tests failed ✗"
    return 1
  fi
}

run_integration_tests() {
  print_header "Running Integration Tests"

  cd "$PROJECT_ROOT"

  log_info "Executing integration validation..."

  if npm test -- tests/staging/integration.test.ts --testTimeout=45000 2>&1 | tee -a "$REPORT_FILE"; then
    log_success "Integration tests passed ✓"
    return 0
  else
    log_error "Integration tests failed ✗"
    return 1
  fi
}

run_load_tests() {
  print_header "Running Load Tests"

  cd "$PROJECT_ROOT"

  log_info "Executing load tests..."

  # Check if k6 is available
  if command -v k6 &> /dev/null; then
    log_info "Using k6 for load testing"
    if k6 run tests/staging/load-test.js 2>&1 | tee -a "$REPORT_FILE"; then
      log_success "Load tests passed ✓"
      return 0
    else
      log_warning "Load tests failed (non-critical)"
      return 0  # Don't fail validation on load test failure
    fi
  # Check if we can run with Node.js
  elif [ -f "tests/staging/load-test.js" ]; then
    log_info "Using Node.js for load testing"
    if node tests/staging/load-test.js 2>&1 | tee -a "$REPORT_FILE"; then
      log_success "Load tests passed ✓"
      return 0
    else
      log_warning "Load tests failed (non-critical)"
      return 0
    fi
  else
    log_warning "Load test tools not available, skipping load tests"
    return 0
  fi
}

generate_report() {
  print_header "Generating Validation Report"

  cd "$PROJECT_ROOT"

  # Generate Jest coverage report if available
  if [ "$GENERATE_REPORT" = true ]; then
    log_info "Generating coverage report..."
    npm test -- tests/staging/ --coverage --coverageDirectory="$REPORT_DIR/coverage_$TIMESTAMP" 2>&1 | tee -a "$REPORT_FILE"
    log_success "Coverage report generated"
  fi

  # Create summary
  cat >> "$REPORT_FILE" << EOF

========================================
VALIDATION SUMMARY
========================================
Date: $(date)
Mode: $MODE
CI Mode: $CI_MODE
Report: $REPORT_FILE

Test Results:
$(grep -c "PASS\|✓" "$REPORT_FILE" || echo "0") tests passed
$(grep -c "FAIL\|✗" "$REPORT_FILE" || echo "0") tests failed

Performance Metrics:
- Check report above for detailed metrics

System Information:
- Node: $(node --version)
- npm: $(npm --version)
- OS: $(uname -s)
- Architecture: $(uname -m)

========================================
EOF

  log_success "Validation report saved to: $REPORT_FILE"
}

send_notification() {
  if [ "$NOTIFY" = true ]; then
    print_header "Sending Notifications"

    # This is a template - implement your notification logic
    # Examples: Slack webhook, email, etc.

    log_info "Notification feature not configured"

    # Example Slack notification (requires SLACK_WEBHOOK_URL environment variable)
    # if [ -n "$SLACK_WEBHOOK_URL" ]; then
    #   curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"Staging Validation: $1\"}" \
    #     "$SLACK_WEBHOOK_URL"
    # fi
  fi
}

cleanup() {
  print_header "Cleaning Up"

  cd "$PROJECT_ROOT"

  # Clean up test databases
  if [ -d ".test-swarm" ]; then
    log_info "Cleaning up test databases..."
    rm -f .test-swarm/*.db
    log_success "Test databases cleaned"
  fi

  # Keep last 10 reports
  if [ -d "$REPORT_DIR" ]; then
    log_info "Cleaning old reports (keeping last 10)..."
    cd "$REPORT_DIR"
    ls -t validation_*.txt 2>/dev/null | tail -n +11 | xargs -r rm
    cd "$PROJECT_ROOT"
    log_success "Old reports cleaned"
  fi
}

###############################################################################
# Main Execution
###############################################################################

main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║        Staging Validation Test Suite                    ║"
  echo "║        Claude Play - Neural Learning System              ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""

  local exit_code=0

  # Prerequisites
  check_prerequisites || exit 2

  # Setup
  setup_environment || exit 2

  # Initialize report
  echo "Validation started at $(date)" > "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"

  # Run tests based on mode
  if [ "$MODE" = "quick" ]; then
    log_info "Running in QUICK mode (smoke tests only)"
    run_smoke_tests || exit_code=1
  else
    log_info "Running in FULL mode (all tests)"

    # Smoke tests (fast check)
    run_smoke_tests || exit_code=1

    # Core validation
    run_validation_tests || exit_code=1

    # Performance validation
    run_performance_tests || exit_code=1

    # Integration validation
    run_integration_tests || exit_code=1

    # Load tests (optional)
    run_load_tests  # Don't fail on load test failure
  fi

  # Generate report
  generate_report

  # Cleanup
  cleanup

  # Final status
  print_header "Validation Complete"

  if [ $exit_code -eq 0 ]; then
    log_success "All validation tests passed! ✓"
    send_notification "✅ Staging validation passed"
    echo ""
    echo "Report: $REPORT_FILE"
    echo ""
    exit 0
  else
    log_error "Validation tests failed! ✗"
    send_notification "❌ Staging validation failed"
    echo ""
    echo "Report: $REPORT_FILE"
    echo ""
    exit 1
  fi
}

# Run main function
main
