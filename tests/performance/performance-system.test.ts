/**
 * Performance System Tests
 *
 * Comprehensive test suite for performance optimization system
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import PerformanceSystem from '../../src/performance/performance-system';
import { createTestPerformanceSystem } from '../../src/performance/utils';
import PerformanceBenchmarks from '../../src/performance/benchmarks';
import { Pattern } from '../../src/neural/pattern-extraction';

// Helper to create test patterns
function createTestPattern(id: string, data: any = {}): Pattern {
  return {
    id,
    type: 'testing',
    name: `Test Pattern ${id}`,
    description: 'Performance test pattern',
    conditions: {},
    actions: [],
    successCriteria: { minCompletionRate: 0.8, maxErrorRate: 0.2 },
    metrics: {
      successCount: 0,
      failureCount: 0,
      partialCount: 0,
      avgDurationMs: 0,
      avgImprovement: 0
    },
    confidence: 0.8,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    ...data
  };
}

describe('Performance System', () => {
  let perfSystem: PerformanceSystem;

  beforeAll(async () => {
    perfSystem = createTestPerformanceSystem();
    await perfSystem.initialize();
  });

  afterAll(async () => {
    await perfSystem.shutdown();
  });

  describe('Pattern Operations', () => {
    it('should store and retrieve patterns', async () => {
      const pattern = createTestPattern('test-pattern-1');

      const storeResult = await perfSystem.storePattern(pattern);
      expect(storeResult.success).toBe(true);

      const getResult = await perfSystem.getPattern('test-pattern-1');
      expect(getResult.success).toBe(true);
      expect(getResult.data?.id).toBe('test-pattern-1');
    });

    it('should retrieve patterns from cache', async () => {
      const pattern = createTestPattern('cached-pattern', {
        confidence: 0.9,
        usageCount: 10
      });

      await perfSystem.storePattern(pattern);

      // First retrieval
      const result1 = await perfSystem.getPattern('cached-pattern');
      expect(result1.success).toBe(true);

      // Second retrieval should be faster (from cache)
      const result2 = await perfSystem.getPattern('cached-pattern');
      expect(result2.success).toBe(true);
      expect(result2.cached).toBe(true);
      expect(result2.executionTime).toBeLessThan(result1.executionTime);
    });

    it('should handle batch pattern retrieval', async () => {
      const patterns: Pattern[] = [];
      for (let i = 0; i < 10; i++) {
        patterns.push(createTestPattern(`batch-pattern-${i}`, {
          confidence: 0.7,
          usageCount: i
        }));
      }

      // Store patterns
      for (const pattern of patterns) {
        await perfSystem.storePattern(pattern);
      }

      // Batch retrieve
      const ids = patterns.map(p => p.id);
      const result = await perfSystem.getPatterns(ids);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(10);
    });
  });

  describe('Confidence Updates', () => {
    it('should update confidence scores', async () => {
      const pattern = createTestPattern('confidence-pattern', {
        confidence: 0.5
      });

      await perfSystem.storePattern(pattern);

      // Update confidence
      const result = await perfSystem.updateConfidence('confidence-pattern', 'success');
      expect(result.success).toBe(true);

      await perfSystem.flush();
    });

    it('should batch confidence updates', async () => {
      const updates = [];
      for (let i = 0; i < 50; i++) {
        updates.push(
          perfSystem.updateConfidence(
            `batch-pattern-${i % 10}`,
            i % 2 === 0 ? 'success' : 'failure'
          )
        );
      }

      const results = await Promise.all(updates);
      expect(results.every(r => r.success)).toBe(true);

      await perfSystem.flush();
    });
  });

  describe('Performance Metrics', () => {
    it('should track cache statistics', async () => {
      // Generate some cache activity
      for (let i = 0; i < 100; i++) {
        await perfSystem.getPattern(`batch-pattern-${i % 10}`);
      }

      const metrics = perfSystem.getMetrics();

      expect(metrics.cache.overallHitRate).toBeGreaterThan(0);
      expect(metrics.cache.l1.hits + metrics.cache.l1.misses).toBeGreaterThan(0);
    });

    it('should track operation latency', async () => {
      for (let i = 0; i < 100; i++) {
        await perfSystem.getPattern('cached-pattern');
      }

      const metrics = perfSystem.getMetrics();

      expect(metrics.performance.avgLatency).toBeGreaterThan(0);
      expect(metrics.performance.p99Latency).toBeGreaterThan(0);
    });

    it('should track operations per second', async () => {
      // Generate load
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(perfSystem.getPattern(`batch-pattern-${i % 10}`));
      }
      await Promise.all(promises);

      const metrics = perfSystem.getMetrics();

      expect(metrics.performance.opsPerSecond).toBeGreaterThan(0);
    });

    it('should generate performance report', () => {
      const report = perfSystem.getReport();

      expect(report).toContain('Performance System Report');
      expect(report).toContain('Operations/Second');
      expect(report).toContain('Cache Performance');
      expect(report).toContain('Database Performance');
    });
  });

  describe('Batch Processing', () => {
    it('should flush pending batches', async () => {
      // Queue updates
      for (let i = 0; i < 50; i++) {
        await perfSystem.updateConfidence(`batch-pattern-${i % 10}`, 'success');
      }

      // Flush
      await perfSystem.flush();

      // Verify flush completed
      const metrics = perfSystem.getMetrics();
      expect(metrics.batch.patternBatches + metrics.batch.confidenceBatches).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent pattern', async () => {
      const result = await perfSystem.getPattern('non-existent-pattern');
      expect(result.success).toBe(false);
    });

    it('should handle invalid pattern data', async () => {
      const invalidPattern = createTestPattern('', {
        id: '',
        confidence: 0,
        createdAt: '',
        lastUsed: '',
        name: null as any,  // Invalid name
        description: null as any  // Invalid description
      });

      const result = await perfSystem.storePattern(invalidPattern);

      expect(result.success).toBe(false);
    });
  });
});

describe('Performance Benchmarks', () => {
  let perfSystem: PerformanceSystem;
  let benchmarks: PerformanceBenchmarks;

  beforeAll(async () => {
    perfSystem = createTestPerformanceSystem();
    await perfSystem.initialize();
    benchmarks = new PerformanceBenchmarks(perfSystem);
  });

  afterAll(async () => {
    await perfSystem.shutdown();
  });

  describe('Individual Benchmarks', () => {
    it('should measure operations throughput', async () => {
      const result = await benchmarks.benchmarkOperationsThroughput();

      expect(result.name).toBe('Operations Throughput');
      expect(result.actual).toBeGreaterThan(0);
      expect(result.unit).toBe('ops/sec');
      expect(result.executionTime).toBeGreaterThan(0);
    }, 30000);

    it('should measure pattern retrieval speed', async () => {
      const result = await benchmarks.benchmarkPatternRetrieval();

      expect(result.name).toBe('Pattern Retrieval Speed');
      expect(result.actual).toBeGreaterThan(0);
      expect(result.unit).toBe('ms');
    }, 30000);

    it('should measure cache hit rate', async () => {
      const result = await benchmarks.benchmarkCacheHitRate();

      expect(result.name).toBe('Cache Hit Rate');
      expect(result.actual).toBeGreaterThanOrEqual(0);
      expect(result.actual).toBeLessThanOrEqual(1);
      expect(result.unit).toBe('ratio');
    }, 30000);

    it('should measure batch processing improvement', async () => {
      const result = await benchmarks.benchmarkBatchProcessing();

      expect(result.name).toBe('Batch Processing Improvement');
      expect(result.actual).toBeGreaterThan(1); // Should be faster than single ops
      expect(result.unit).toBe('x faster');
    }, 30000);

    it('should measure compression ratio', async () => {
      const result = await benchmarks.benchmarkCompressionRatio();

      expect(result.name).toBe('Compression Ratio');
      expect(result.actual).toBeGreaterThanOrEqual(0);
      expect(result.actual).toBeLessThanOrEqual(100);
      expect(result.unit).toBe('%');
    }, 30000);

    it('should measure learning overhead', async () => {
      const result = await benchmarks.benchmarkLearningOverhead();

      expect(result.name).toBe('Learning Overhead');
      expect(result.actual).toBeGreaterThanOrEqual(0);
      expect(result.unit).toBe('%');
    }, 30000);
  });

  describe('Profiling', () => {
    it('should profile operations', async () => {
      await benchmarks.profile('test-operation', async () => {
        await perfSystem.getPattern('test-pattern-1');
      });

      const profiles = benchmarks.getProfiles();
      expect(profiles.length).toBeGreaterThan(0);

      const profile = profiles[profiles.length - 1];
      expect(profile.operation).toBe('test-operation');
      expect(profile.duration).toBeGreaterThan(0);
    });

    it('should clear profiling data', () => {
      benchmarks.clearProfiles();
      const profiles = benchmarks.getProfiles();
      expect(profiles.length).toBe(0);
    });
  });
});

describe('Cache System', () => {
  let perfSystem: PerformanceSystem;

  beforeAll(async () => {
    perfSystem = createTestPerformanceSystem();
    await perfSystem.initialize();
  });

  afterAll(async () => {
    await perfSystem.shutdown();
  });

  it('should hit L1 cache for hot patterns', async () => {
    const pattern = createTestPattern('hot-pattern', {
      confidence: 0.95,
      usageCount: 1000
    });

    await perfSystem.storePattern(pattern);

    // Access multiple times to warm L1
    for (let i = 0; i < 10; i++) {
      await perfSystem.getPattern('hot-pattern');
    }

    // Should now be in L1 (fastest)
    const result = await perfSystem.getPattern('hot-pattern');
    expect(result.cached).toBe(true);
    expect(result.executionTime).toBeLessThan(1); // <1ms for L1
  });

  it('should promote patterns to faster cache levels', async () => {
    const pattern = createTestPattern('promoted-pattern');

    await perfSystem.storePattern(pattern);

    // First access (from DB)
    const result1 = await perfSystem.getPattern('promoted-pattern');
    const time1 = result1.executionTime;

    // Second access (from cache, should be faster)
    const result2 = await perfSystem.getPattern('promoted-pattern');
    const time2 = result2.executionTime;

    expect(time2).toBeLessThan(time1);
  });
});

describe('Compression System', () => {
  it('should compress pattern data', async () => {
    const perfSystem = createTestPerformanceSystem();
    await perfSystem.initialize();

    // Create pattern with large description for compression testing
    const largePattern = createTestPattern('large-pattern', {
      description: 'x'.repeat(10000),  // 10KB of data
      conditions: { largeData: 'y'.repeat(5000) }  // Additional 5KB
    });

    await perfSystem.storePattern(largePattern);
    await perfSystem.flush();

    const metrics = perfSystem.getMetrics();
    expect(metrics.compression.totalCompressed).toBeGreaterThan(0);
    expect(metrics.compression.compressionRatio).toBeLessThan(1);

    await perfSystem.shutdown();
  });
});
