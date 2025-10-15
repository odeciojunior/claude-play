# Staging Validation Test Suite

Comprehensive validation test suite for post-deployment verification in staging environment.

## Overview

This test suite validates all critical system functionality after deployment:

- ✅ **Neural learning system** - Pattern extraction, storage, retrieval
- ✅ **GOAP planning** - A* search, pattern reuse
- ✅ **Truth verification** - Scoring, thresholds
- ✅ **Database operations** - Migrations, integrity, performance
- ✅ **Performance benchmarks** - 172K+ ops/sec targets
- ✅ **Load testing** - Concurrent operations, sustained load

## Test Files

### 1. `validation.test.ts` (Comprehensive)

Full end-to-end validation of all critical functionality.

**Test Duration:** ~5 minutes
**Coverage:**
- Neural learning pipeline (observe → extract → store → retrieve → apply)
- Pattern storage and retrieval from database
- Confidence scoring and outcome tracking
- Pattern consolidation
- Database schema integrity
- GOAP configuration validation
- Truth verification system
- System health checks

**Run:**
```bash
npm test tests/staging/validation.test.ts
```

### 2. `performance.test.ts` (Performance)

Validates system meets performance targets.

**Test Duration:** ~3 minutes
**Performance Targets:**
- Neural operations: >150K ops/sec
- Cache hit rate: >80%
- Pattern retrieval: <10ms
- Database queries: <10ms
- Memory increase: <50MB

**Coverage:**
- Neural operation throughput
- Pattern extraction performance
- Database query performance
- Concurrent operations
- Memory leak detection
- Sustained load handling
- Burst traffic handling

**Run:**
```bash
npm test tests/staging/performance.test.ts
```

### 3. `integration.test.ts` (Integration)

Full system integration across multiple components.

**Test Duration:** ~4 minutes
**Coverage:**
- Complete learning workflow (observe → extract → store → retrieve → apply → track)
- Verification-based learning
- Error handling and recovery
- Agent coordination patterns
- Database transaction integrity (ACID)
- Pattern consolidation integration

**Run:**
```bash
npm test tests/staging/integration.test.ts
```

### 4. `smoke-tests.test.ts` (Quick Validation)

Fast smoke tests for immediate post-deployment validation.

**Test Duration:** <30 seconds
**Coverage:**
- System responds
- Database accessible
- Neural system initializes
- Critical files present
- Configuration valid
- Dependencies installed

**Run:**
```bash
npm test tests/staging/smoke-tests.test.ts
```

### 5. `load-test.js` (Load Testing)

Load testing with gradual ramp-up and sustained load.

**Test Duration:** ~7 minutes
**Load Profile:**
- Ramp up: 10 → 50 → 100 users
- Sustained: 100 users for 2 minutes
- Ramp down: 100 → 50 → 0 users

**Methods:**
- K6 (recommended): `k6 run tests/staging/load-test.js`
- Artillery: `artillery run tests/staging/load-test.js`
- Node.js: `node tests/staging/load-test.js`

### 6. `run-validation.sh` (Orchestration)

Shell script to run all validation tests with reporting.

**Usage:**
```bash
# Full validation (all tests)
./scripts/run-validation.sh --full

# Quick validation (smoke tests only)
./scripts/run-validation.sh --quick

# With HTML report
./scripts/run-validation.sh --full --report

# CI mode (stricter thresholds)
./scripts/run-validation.sh --full --ci

# With notifications
./scripts/run-validation.sh --full --notify
```

## Quick Start

### Run All Validation

```bash
# Using validation script (recommended)
./scripts/run-validation.sh --full

# Or run tests individually
npm test tests/staging/validation.test.ts
npm test tests/staging/performance.test.ts
npm test tests/staging/integration.test.ts
```

### Run Quick Validation

```bash
# Using script
./scripts/run-validation.sh --quick

# Or directly
npm test tests/staging/smoke-tests.test.ts
```

### Run Specific Test Suite

```bash
# Validation only
npm test tests/staging/validation.test.ts

# Performance only
npm test tests/staging/performance.test.ts

# Integration only
npm test tests/staging/integration.test.ts

# Smoke tests only
npm test tests/staging/smoke-tests.test.ts
```

## Test Execution Time

| Test Suite | Duration | Tests | Purpose |
|------------|----------|-------|---------|
| Smoke Tests | <30s | 20+ | Quick health check |
| Validation | ~5min | 25+ | Core functionality |
| Performance | ~3min | 15+ | Performance targets |
| Integration | ~4min | 20+ | Multi-component workflows |
| Load Tests | ~7min | Variable | Stress testing |
| **Total (Full)** | **~20min** | **80+** | Complete validation |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Staging Validation

on:
  deployment_status:

jobs:
  validate:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run validation
        run: ./scripts/run-validation.sh --full --ci --report

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-report
          path: validation-reports/
```

### GitLab CI Example

```yaml
staging-validation:
  stage: validate
  only:
    - main
  script:
    - npm ci
    - npm run build
    - ./scripts/run-validation.sh --full --ci
  artifacts:
    when: always
    paths:
      - validation-reports/
    expire_in: 30 days
```

## Performance Targets

### Neural System
- Operations/second: >150,000
- Pattern extraction: <1s for 100 observations
- Pattern retrieval: <10ms average
- Cache hit rate: >80%

### Database
- Query execution: <10ms average
- Insert throughput: >100 inserts/sec
- Concurrent operations: 50+ requests/sec
- Transaction integrity: 100% ACID compliance

### System Resources
- Memory increase: <50MB during extended operation
- No memory leaks detected
- Graceful degradation under load
- Error rate: <1%

## Test Coverage

The validation suite provides comprehensive coverage:

```
Tests:          80+ test cases
Components:     20+ system components
Scenarios:      50+ usage scenarios
Performance:    15+ performance benchmarks
Integration:    20+ multi-component workflows
```

### Coverage by Category

| Category | Test Count | Coverage |
|----------|-----------|----------|
| Neural Learning | 20 | Pattern extraction, storage, retrieval, application |
| Database Operations | 15 | CRUD, transactions, integrity, performance |
| Performance | 15 | Throughput, latency, concurrency, memory |
| Integration | 20 | End-to-end workflows, error handling |
| System Health | 10 | Configuration, dependencies, accessibility |

## Validation Report

The validation script generates detailed reports in `validation-reports/`:

```
validation-reports/
├── validation_20251015_143022.txt    # Test output and results
└── coverage_20251015_143022/         # Code coverage (if --report flag)
    ├── lcov-report/
    │   └── index.html
    └── coverage-summary.json
```

### Report Contents

- Test execution results (pass/fail)
- Performance metrics
- Error details and stack traces
- System information
- Execution timestamp
- Coverage statistics (with --report flag)

## Troubleshooting

### Tests Failing

**Database locked errors:**
```bash
# Clean up test databases
rm -rf .test-swarm/*.db
```

**Performance tests failing:**
```bash
# Ensure system has adequate resources
# Close other applications
# Run tests individually to isolate issues
npm test tests/staging/performance.test.ts
```

**Timeout errors:**
```bash
# Increase timeout
npm test tests/staging/validation.test.ts -- --testTimeout=60000
```

### Load Tests Not Running

**Install K6:**
```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or use Node.js fallback
node tests/staging/load-test.js
```

## Best Practices

### Pre-Deployment

1. **Run full validation locally:**
   ```bash
   ./scripts/run-validation.sh --full
   ```

2. **Review performance metrics:**
   ```bash
   npm test tests/staging/performance.test.ts
   ```

3. **Verify load handling:**
   ```bash
   k6 run tests/staging/load-test.js
   ```

### Post-Deployment

1. **Run smoke tests immediately:**
   ```bash
   ./scripts/run-validation.sh --quick
   ```

2. **Run full validation within 5 minutes:**
   ```bash
   ./scripts/run-validation.sh --full
   ```

3. **Monitor performance continuously:**
   ```bash
   npm test tests/staging/performance.test.ts -- --watch
   ```

### CI/CD Pipeline

1. **Stage 1:** Smoke tests (<30s)
2. **Stage 2:** Validation tests (~5min)
3. **Stage 3:** Performance tests (~3min)
4. **Stage 4:** Integration tests (~4min)
5. **Stage 5:** Load tests (~7min)

**Total CI/CD validation time:** ~20 minutes

## Environment Variables

Configure testing environment:

```bash
# Node environment
export NODE_ENV=staging

# Test database path
export TEST_DB_PATH=.test-swarm/staging-validation.db

# Notification webhook (optional)
export SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# CI mode
export CI=true
```

## Success Criteria

Validation passes when:

- ✅ All smoke tests pass (20+)
- ✅ All validation tests pass (25+)
- ✅ All performance benchmarks meet targets (15+)
- ✅ All integration tests pass (20+)
- ✅ No memory leaks detected
- ✅ Error rate <1%
- ✅ Response times within targets

## Support

For issues or questions:

1. Check test output in `validation-reports/`
2. Review individual test files for details
3. Run tests with `--verbose` flag for more information
4. Check system resources and dependencies

---

**Last Updated:** 2025-10-15
**Version:** 1.0.0
**Maintainer:** Claude Play Team
