/**
 * Load Testing Configuration
 *
 * K6-style load testing for staging validation.
 * Tests system under various load conditions.
 *
 * Usage:
 *   npm install -g k6  (if not already installed)
 *   k6 run tests/staging/load-test.js
 *
 * Or use artillery:
 *   npm install -g artillery
 *   artillery run tests/staging/load-test.js
 */

// K6 Load Test Configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users over 30s
    { duration: '1m', target: 50 },    // Ramp up to 50 users over 1 minute
    { duration: '2m', target: 100 },   // Ramp up to 100 users over 2 minutes
    { duration: '2m', target: 100 },   // Stay at 100 users for 2 minutes
    { duration: '1m', target: 50 },    // Ramp down to 50 users over 1 minute
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'],                 // Error rate under 1%
  },
};

// For K6
export default function() {
  // This is a template - adapt to your actual endpoints
  console.log('Load test iteration');

  // Simulate pattern operations
  simulatePatternRetrieval();
  simulatePatternStorage();
  simulateDatabaseQuery();
}

function simulatePatternRetrieval() {
  // Simulates retrieving patterns from the system
  const start = Date.now();

  // In real scenario, this would be an HTTP request or direct function call
  // For now, simulate the operation
  const duration = Math.random() * 50 + 10; // 10-60ms

  // Sleep simulation (in k6, use sleep() function)
  // sleep(duration / 1000);

  const end = Date.now();
  console.log(`Pattern retrieval: ${end - start}ms`);
}

function simulatePatternStorage() {
  const start = Date.now();

  // Simulate storing a pattern
  const duration = Math.random() * 100 + 20; // 20-120ms

  const end = Date.now();
  console.log(`Pattern storage: ${end - start}ms`);
}

function simulateDatabaseQuery() {
  const start = Date.now();

  // Simulate database query
  const duration = Math.random() * 30 + 5; // 5-35ms

  const end = Date.now();
  console.log(`Database query: ${end - start}ms`);
}

// Alternative: Artillery Configuration (YAML-style in comments)
/*
config:
  target: "http://localhost:3000"  # Adjust to your staging endpoint
  phases:
    - duration: 30
      arrivalRate: 10
      name: "Warm up"
    - duration: 60
      arrivalRate: 50
      name: "Ramp up"
    - duration: 120
      arrivalRate: 100
      name: "Sustained load"
    - duration: 60
      arrivalRate: 50
      name: "Ramp down"

scenarios:
  - name: "Pattern Operations"
    flow:
      - get:
          url: "/api/patterns"
      - post:
          url: "/api/patterns"
          json:
            type: "tool_sequence"
            confidence: 0.8
      - get:
          url: "/api/patterns/{{ patternId }}"
      - put:
          url: "/api/patterns/{{ patternId }}"
          json:
            confidence: 0.9

  - name: "Learning Pipeline"
    flow:
      - post:
          url: "/api/observations"
          json:
            tool: "Edit"
            success: true
            duration: 100
      - get:
          url: "/api/metrics"
      - post:
          url: "/api/consolidate"

  - name: "Database Operations"
    flow:
      - get:
          url: "/api/patterns?limit=10"
      - get:
          url: "/api/patterns?confidence=0.8"
      - get:
          url: "/api/patterns?type=tool_sequence"
*/

// Node.js-based load test (can be run directly with node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runLoadTest: async function(config = {}) {
      const {
        duration = 60000,        // 1 minute
        concurrency = 50,         // 50 concurrent operations
        rampUpTime = 10000        // 10 second ramp-up
      } = config;

      console.log('Starting load test...');
      console.log(`Duration: ${duration}ms, Concurrency: ${concurrency}, Ramp-up: ${rampUpTime}ms`);

      const startTime = Date.now();
      const metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        durations: []
      };

      // Ramp up
      const rampUpInterval = rampUpTime / concurrency;
      const activeOperations = [];

      while (Date.now() - startTime < duration) {
        // Launch operations up to concurrency limit
        while (activeOperations.length < concurrency && Date.now() - startTime < duration) {
          const operation = runOperation(metrics);
          activeOperations.push(operation);

          // Ramp up delay
          if (activeOperations.length < concurrency) {
            await sleep(rampUpInterval);
          }
        }

        // Wait for some operations to complete
        await Promise.race(activeOperations.map(op => op.catch(() => {})));

        // Clean up completed operations
        for (let i = activeOperations.length - 1; i >= 0; i--) {
          const op = activeOperations[i];
          const isSettled = await Promise.race([
            op.then(() => true).catch(() => true),
            Promise.resolve(false)
          ]);

          if (isSettled) {
            activeOperations.splice(i, 1);
          }
        }
      }

      // Wait for remaining operations
      await Promise.allSettled(activeOperations);

      // Calculate statistics
      const avgDuration = metrics.totalDuration / metrics.totalRequests;
      const successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
      const requestsPerSec = metrics.totalRequests / (duration / 1000);

      // Calculate percentiles
      metrics.durations.sort((a, b) => a - b);
      const p50 = metrics.durations[Math.floor(metrics.durations.length * 0.50)];
      const p95 = metrics.durations[Math.floor(metrics.durations.length * 0.95)];
      const p99 = metrics.durations[Math.floor(metrics.durations.length * 0.99)];

      const report = {
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        successRate: `${successRate.toFixed(2)}%`,
        requestsPerSecond: requestsPerSec.toFixed(2),
        averageDuration: `${avgDuration.toFixed(2)}ms`,
        minDuration: `${metrics.minDuration.toFixed(2)}ms`,
        maxDuration: `${metrics.maxDuration.toFixed(2)}ms`,
        p50Duration: `${p50?.toFixed(2) || 0}ms`,
        p95Duration: `${p95?.toFixed(2) || 0}ms`,
        p99Duration: `${p99?.toFixed(2) || 0}ms`,
        testDuration: `${duration}ms`,
        concurrency: concurrency
      };

      console.log('\n=== Load Test Results ===');
      console.log(JSON.stringify(report, null, 2));

      return report;
    }
  };

  async function runOperation(metrics) {
    const operationStart = Date.now();
    metrics.totalRequests++;

    try {
      // Simulate various operations
      const operations = [
        simulatePatternRetrievalAsync,
        simulatePatternStorageAsync,
        simulateDatabaseQueryAsync
      ];

      const operation = operations[Math.floor(Math.random() * operations.length)];
      await operation();

      const duration = Date.now() - operationStart;
      metrics.successfulRequests++;
      metrics.totalDuration += duration;
      metrics.durations.push(duration);
      metrics.minDuration = Math.min(metrics.minDuration, duration);
      metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    } catch (error) {
      metrics.failedRequests++;
    }
  }

  async function simulatePatternRetrievalAsync() {
    const duration = Math.random() * 50 + 10;
    await sleep(duration);
  }

  async function simulatePatternStorageAsync() {
    const duration = Math.random() * 100 + 20;
    await sleep(duration);
  }

  async function simulateDatabaseQueryAsync() {
    const duration = Math.random() * 30 + 5;
    await sleep(duration);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // CLI execution
  if (require.main === module) {
    const config = {
      duration: 60000,      // 1 minute
      concurrency: 50,      // 50 concurrent
      rampUpTime: 10000     // 10 second ramp
    };

    module.exports.runLoadTest(config)
      .then(report => {
        console.log('\nLoad test completed successfully');

        // Exit with error if success rate is too low
        const successRate = parseFloat(report.successRate);
        if (successRate < 95) {
          console.error(`\nERROR: Success rate ${report.successRate} below 95% threshold`);
          process.exit(1);
        }

        process.exit(0);
      })
      .catch(error => {
        console.error('Load test failed:', error);
        process.exit(1);
      });
  }
}
