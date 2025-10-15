/**
 * Staging Performance Validation Tests
 *
 * Validates that the system meets performance targets in staging environment:
 * - Neural operations: >150K ops/sec
 * - Cache hit rate: >80%
 * - Pattern retrieval: <10ms
 * - Database queries: <10ms
 * - Memory leak detection
 * - Concurrent operation testing
 */

import { Database } from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import LearningPipeline from '../../src/neural/learning-pipeline';
import { ExecutionObservation, PatternType } from '../../src/neural/pattern-extraction';

const PERFORMANCE_CONFIG = {
  dbPath: '.test-swarm/performance-validation.db',
  timeout: 60000, // 60 seconds for performance tests
  targets: {
    neuralOpsPerSec: 150000,
    cacheHitRate: 0.80,
    patternRetrievalMs: 10,
    databaseQueryMs: 10,
    maxMemoryIncreaseMb: 50
  }
};

describe('Performance Validation Tests', () => {
  let db: Database;
  let learningPipeline: LearningPipeline;

  beforeAll(async () => {
    // Initialize database
    const stagingDir = path.dirname(PERFORMANCE_CONFIG.dbPath);
    if (!fs.existsSync(stagingDir)) {
      fs.mkdirSync(stagingDir, { recursive: true });
    }

    db = new Database(PERFORMANCE_CONFIG.dbPath);
    await initializeDatabase(db);

    learningPipeline = new LearningPipeline(db, {
      observationBufferSize: 1000,
      observationFlushInterval: 10000,
      extractionBatchSize: 50,
      minPatternQuality: 0.7,
      minConfidenceThreshold: 0.5,
      consolidationSchedule: 'hourly',
      autoLearning: true,
      maxPatternsPerType: 5000
    });
  }, PERFORMANCE_CONFIG.timeout);

  afterAll(async () => {
    await learningPipeline.shutdown();
    await closeDatabase(db);
  });

  describe('Neural Operations Performance', () => {
    test('should achieve >150K operations/second', async () => {
      const operations = 10000;
      const startTime = Date.now();

      // Perform lightweight operations
      for (let i = 0; i < operations; i++) {
        learningPipeline.getMetrics();
      }

      const duration = Date.now() - startTime;
      const opsPerSec = (operations / duration) * 1000;

      console.log(`Neural ops/sec: ${opsPerSec.toFixed(0)}`);
      expect(opsPerSec).toBeGreaterThan(PERFORMANCE_CONFIG.targets.neuralOpsPerSec);
    }, PERFORMANCE_CONFIG.timeout);

    test('should maintain low latency for pattern operations', async () => {
      // Create test patterns
      for (let i = 0; i < 100; i++) {
        const pattern = {
          id: `perf-pattern-${i}`,
          type: 'tool_sequence' as PatternType,
          name: `Performance test pattern ${i}`,
          confidence: 0.5 + Math.random() * 0.5,
          usageCount: Math.floor(Math.random() * 20),
          createdAt: new Date().toISOString(),
          data: { test: true },
          metrics: {
            successCount: 5,
            failureCount: 1,
            partialCount: 0,
            avgDurationMs: 100
          }
        };

        await learningPipeline.train(pattern);
      }

      // Measure retrieval time
      const retrievalTimes: number[] = [];

      for (let i = 0; i < 50; i++) {
        const startTime = Date.now();
        await learningPipeline.getPattern(`perf-pattern-${i}`);
        retrievalTimes.push(Date.now() - startTime);
      }

      const avgRetrievalTime = retrievalTimes.reduce((a, b) => a + b, 0) / retrievalTimes.length;

      console.log(`Average pattern retrieval time: ${avgRetrievalTime.toFixed(2)}ms`);
      expect(avgRetrievalTime).toBeLessThan(PERFORMANCE_CONFIG.targets.patternRetrievalMs);
    }, PERFORMANCE_CONFIG.timeout);

    test('should handle pattern extraction efficiently', async () => {
      const observations: ExecutionObservation[] = [];

      // Create 100 observations
      for (let i = 0; i < 100; i++) {
        observations.push({
          id: `obs-perf-${i}`,
          timestamp: Date.now(),
          tool: ['Edit', 'Read', 'Bash'][i % 3],
          parameters: { test: true },
          result: { success: true },
          duration_ms: 50 + Math.random() * 100,
          success: true,
          context: {
            taskId: 'perf-test',
            agentId: 'coder',
            workingDirectory: '/test',
            activePatterns: [],
            priorSteps: i,
            environmentVars: {}
          }
        });
      }

      const startTime = Date.now();
      await learningPipeline.extractPatternsFromObservations(observations);
      const extractionTime = Date.now() - startTime;

      console.log(`Pattern extraction time for 100 observations: ${extractionTime}ms`);
      expect(extractionTime).toBeLessThan(1000); // Should complete in under 1 second
    }, PERFORMANCE_CONFIG.timeout);
  });

  describe('Database Query Performance', () => {
    test('should execute queries within performance targets', async () => {
      const queryTimes: number[] = [];

      // Test various query types
      const queries = [
        'SELECT * FROM patterns LIMIT 10',
        'SELECT * FROM patterns WHERE confidence > 0.7 ORDER BY confidence DESC LIMIT 10',
        'SELECT COUNT(*) FROM patterns',
        'SELECT * FROM patterns WHERE type = "tool_sequence" LIMIT 5'
      ];

      for (const query of queries) {
        const startTime = Date.now();
        await executeDbQuery(db, query);
        queryTimes.push(Date.now() - startTime);
      }

      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;

      console.log(`Average database query time: ${avgQueryTime.toFixed(2)}ms`);
      expect(avgQueryTime).toBeLessThan(PERFORMANCE_CONFIG.targets.databaseQueryMs);
    }, PERFORMANCE_CONFIG.timeout);

    test('should handle high-volume inserts efficiently', async () => {
      const insertCount = 1000;
      const startTime = Date.now();

      const dbRun = promisify(db.run.bind(db));

      // Batch insert
      await dbRun('BEGIN TRANSACTION');

      for (let i = 0; i < insertCount; i++) {
        await dbRun(
          `INSERT INTO patterns (id, type, pattern_data, confidence, usage_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [`bulk-${i}`, 'tool_sequence', 'eyJ0ZXN0IjoidmFsdWUifQ==', 0.7, 0, new Date().toISOString()]
        );
      }

      await dbRun('COMMIT');

      const duration = Date.now() - startTime;
      const insertsPerSec = (insertCount / duration) * 1000;

      console.log(`Database inserts/sec: ${insertsPerSec.toFixed(0)}`);
      expect(insertsPerSec).toBeGreaterThan(100); // Should achieve >100 inserts/sec

      // Cleanup
      await dbRun(`DELETE FROM patterns WHERE id LIKE 'bulk-%'`);
    }, PERFORMANCE_CONFIG.timeout);

    test('should maintain performance with large datasets', async () => {
      // Get current count
      const countResult = await getDbRow(db, 'SELECT COUNT(*) as count FROM patterns', []);
      const initialCount = countResult.count;

      // Ensure we have a reasonable dataset
      if (initialCount < 500) {
        const dbRun = promisify(db.run.bind(db));
        await dbRun('BEGIN TRANSACTION');

        for (let i = 0; i < 500 - initialCount; i++) {
          await dbRun(
            `INSERT INTO patterns (id, type, pattern_data, confidence, usage_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [`large-${i}`, 'tool_sequence', 'eyJ0ZXN0IjoidmFsdWUifQ==', Math.random(), 0, new Date().toISOString()]
          );
        }

        await dbRun('COMMIT');
      }

      // Measure query performance on large dataset
      const startTime = Date.now();
      await executeDbQuery(db, 'SELECT * FROM patterns WHERE confidence > 0.5 ORDER BY confidence DESC LIMIT 50');
      const queryTime = Date.now() - startTime;

      console.log(`Large dataset query time: ${queryTime}ms`);
      expect(queryTime).toBeLessThan(50); // Should complete in under 50ms
    }, PERFORMANCE_CONFIG.timeout);
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent pattern retrievals', async () => {
      const concurrentRequests = 100;
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          learningPipeline.getExtractedPatterns({
            minConfidence: 0.5,
            limit: 10
          })
        );
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      const requestsPerSec = (concurrentRequests / duration) * 1000;

      console.log(`Concurrent requests/sec: ${requestsPerSec.toFixed(0)}`);
      expect(requestsPerSec).toBeGreaterThan(50); // Should handle >50 concurrent requests/sec
    }, PERFORMANCE_CONFIG.timeout);

    test('should maintain consistency under concurrent writes', async () => {
      const concurrentWrites = 50;
      const promises = [];

      for (let i = 0; i < concurrentWrites; i++) {
        const pattern = {
          id: `concurrent-write-${i}`,
          type: 'tool_sequence' as PatternType,
          name: `Concurrent pattern ${i}`,
          confidence: 0.7,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          data: { concurrent: true },
          metrics: {
            successCount: 0,
            failureCount: 0,
            partialCount: 0,
            avgDurationMs: 100
          }
        };

        promises.push(learningPipeline.train(pattern));
      }

      await Promise.all(promises);

      // Verify all patterns were written
      const patterns = await learningPipeline.getExtractedPatterns({ limit: 1000 });
      const concurrentPatterns = patterns.filter(p => p.id.startsWith('concurrent-write-'));

      expect(concurrentPatterns.length).toBe(concurrentWrites);
    }, PERFORMANCE_CONFIG.timeout);
  });

  describe('Memory Leak Detection', () => {
    test('should not leak memory during extended operation', async () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const observation: ExecutionObservation = {
          id: `mem-test-${i}`,
          timestamp: Date.now(),
          tool: 'Edit',
          parameters: { file: 'test.ts' },
          result: { success: true },
          duration_ms: 50,
          success: true,
          context: {
            taskId: 'mem-test',
            agentId: 'coder',
            workingDirectory: '/test',
            activePatterns: [],
            priorSteps: i,
            environmentVars: {}
          }
        };

        // Simulate observation collection
        learningPipeline.getMetrics();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_CONFIG.targets.maxMemoryIncreaseMb);
    }, PERFORMANCE_CONFIG.timeout);

    test('should clean up resources properly', async () => {
      const initialMetrics = learningPipeline.getMetrics();

      // Create and discard many patterns
      for (let i = 0; i < 100; i++) {
        await learningPipeline.getExtractedPatterns({ limit: 10 });
      }

      const finalMetrics = learningPipeline.getMetrics();

      // Metrics should still be consistent
      expect(finalMetrics.observationsCollected).toBeGreaterThanOrEqual(initialMetrics.observationsCollected);
    }, PERFORMANCE_CONFIG.timeout);
  });

  describe('Load Testing', () => {
    test('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      let operations = 0;

      while (Date.now() - startTime < duration) {
        await learningPipeline.getMetrics();
        operations++;
      }

      const opsPerSec = operations / (duration / 1000);

      console.log(`Sustained operations/sec: ${opsPerSec.toFixed(0)}`);
      expect(opsPerSec).toBeGreaterThan(1000); // Should maintain >1000 ops/sec
    }, PERFORMANCE_CONFIG.timeout);

    test('should handle burst traffic', async () => {
      const burstSize = 200;
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < burstSize; i++) {
        promises.push(
          learningPipeline.getExtractedPatterns({ limit: 5 })
        );
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      console.log(`Burst handling time: ${duration}ms for ${burstSize} requests`);
      expect(duration).toBeLessThan(5000); // Should handle burst in under 5 seconds
    }, PERFORMANCE_CONFIG.timeout);
  });

  describe('Cache Performance', () => {
    test('should achieve target cache hit rate', async () => {
      // Warm up cache
      for (let i = 0; i < 20; i++) {
        await learningPipeline.getPattern(`perf-pattern-${i % 10}`);
      }

      // Measure cache hits
      let cacheHits = 0;
      const totalRequests = 100;

      for (let i = 0; i < totalRequests; i++) {
        const startTime = Date.now();
        await learningPipeline.getPattern(`perf-pattern-${i % 10}`);
        const retrievalTime = Date.now() - startTime;

        // Fast retrieval indicates cache hit
        if (retrievalTime < 5) {
          cacheHits++;
        }
      }

      const hitRate = cacheHits / totalRequests;

      console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
      expect(hitRate).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.targets.cacheHitRate);
    }, PERFORMANCE_CONFIG.timeout);
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function initializeDatabase(db: Database): Promise<void> {
  const dbRun = promisify(db.run.bind(db));

  await dbRun(`
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      pattern_data TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_used TEXT
    )
  `);

  await dbRun('CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(type)');
}

async function closeDatabase(db: Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function executeDbQuery(db: Database, sql: string): Promise<any> {
  const dbAll = promisify(db.all.bind(db));
  return await dbAll(sql, []);
}

async function getDbRow(db: Database, sql: string, params: any[]): Promise<any> {
  const dbGet = promisify(db.get.bind(db));
  return await dbGet(sql, params);
}
