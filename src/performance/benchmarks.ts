/**
 * Performance Benchmarks and Profiling
 *
 * Comprehensive benchmarking suite to validate:
 * - 172K+ operations/second
 * - <10ms pattern retrieval
 * - 80% cache hit rate
 * - 60% compression ratio
 * - <10% learning overhead
 */

import PerformanceSystem from './performance-system';
import { Pattern } from '../neural/pattern-extraction';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface BenchmarkResult {
  name: string;
  description: string;
  target: number;
  actual: number;
  unit: string;
  passed: boolean;
  executionTime: number;
  details?: any;
}

export interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  totalTime: number;
  passed: number;
  failed: number;
  overallSuccess: boolean;
}

export interface ProfilePoint {
  operation: string;
  timestamp: number;
  duration: number;
  memory: number;
  success: boolean;
}

// ============================================================================
// Benchmark Suite
// ============================================================================

export class PerformanceBenchmarks {
  private profiles: ProfilePoint[] = [];

  constructor(private perfSystem: PerformanceSystem) {}

  /**
   * Run complete benchmark suite
   */
  async runAll(): Promise<BenchmarkSuite> {
    console.log('🏁 Starting Performance Benchmark Suite\n');
    const startTime = performance.now();

    const results: BenchmarkResult[] = [];

    // Core performance benchmarks
    results.push(await this.benchmarkOperationsThroughput());
    results.push(await this.benchmarkPatternRetrieval());
    results.push(await this.benchmarkCacheHitRate());
    results.push(await this.benchmarkBatchProcessing());
    results.push(await this.benchmarkCompressionRatio());
    results.push(await this.benchmarkLearningOverhead());

    // Advanced benchmarks
    results.push(await this.benchmarkConcurrentOps());
    results.push(await this.benchmarkMemoryUsage());
    results.push(await this.benchmarkLatencyPercentiles());

    const totalTime = performance.now() - startTime;

    const suite: BenchmarkSuite = {
      name: 'Performance System Benchmarks',
      results,
      totalTime,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      overallSuccess: results.every(r => r.passed)
    };

    this.printReport(suite);
    return suite;
  }

  /**
   * Benchmark 1: Operations Throughput
   * Target: 172,000+ ops/sec
   */
  private async benchmarkOperationsThroughput(): Promise<BenchmarkResult> {
    console.log('⚡ Benchmarking operations throughput...');
    const startTime = performance.now();

    const operations = 100000;
    const testPatterns = this.generateTestPatterns(1000);

    let completed = 0;
    const opStartTime = performance.now();

    // Run parallel operations
    const promises: Promise<any>[] = [];
    for (let i = 0; i < operations; i++) {
      const pattern = testPatterns[i % testPatterns.length];
      promises.push(
        this.perfSystem.getPattern(pattern.id).then(() => {
          completed++;
        })
      );

      // Process in batches of 1000
      if (promises.length >= 1000) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }

    await Promise.all(promises);
    const opEndTime = performance.now();

    const duration = (opEndTime - opStartTime) / 1000; // seconds
    const opsPerSecond = completed / duration;

    return {
      name: 'Operations Throughput',
      description: 'Pattern retrieval operations per second',
      target: 172000,
      actual: opsPerSecond,
      unit: 'ops/sec',
      passed: opsPerSecond >= 172000,
      executionTime: performance.now() - startTime,
      details: {
        totalOps: completed,
        durationSeconds: duration
      }
    };
  }

  /**
   * Benchmark 2: Pattern Retrieval Speed
   * Target: <10ms average
   */
  private async benchmarkPatternRetrieval(): Promise<BenchmarkResult> {
    console.log('🔍 Benchmarking pattern retrieval speed...');
    const startTime = performance.now();

    const testPatterns = this.generateTestPatterns(100);
    const latencies: number[] = [];

    // Warm up cache
    for (const pattern of testPatterns) {
      await this.perfSystem.getPattern(pattern.id);
    }

    // Measure retrieval times
    for (let i = 0; i < 1000; i++) {
      const pattern = testPatterns[i % testPatterns.length];
      const result = await this.perfSystem.getPattern(pattern.id);
      latencies.push(result.executionTime);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    return {
      name: 'Pattern Retrieval Speed',
      description: 'Average time to retrieve a pattern',
      target: 10,
      actual: avgLatency,
      unit: 'ms',
      passed: avgLatency < 10,
      executionTime: performance.now() - startTime,
      details: {
        measurements: latencies.length,
        minLatency: Math.min(...latencies),
        maxLatency: Math.max(...latencies)
      }
    };
  }

  /**
   * Benchmark 3: Cache Hit Rate
   * Target: 80%+
   */
  private async benchmarkCacheHitRate(): Promise<BenchmarkResult> {
    console.log('💾 Benchmarking cache hit rate...');
    const startTime = performance.now();

    const testPatterns = this.generateTestPatterns(500);

    // Pre-populate cache with 400 patterns (80%)
    for (let i = 0; i < 400; i++) {
      await this.perfSystem.getPattern(testPatterns[i].id);
    }

    // Clear metrics before test
    const initialMetrics = this.perfSystem.getMetrics();

    // Access patterns (80% should hit cache)
    for (let i = 0; i < 1000; i++) {
      const patternIndex = Math.floor(Math.random() * 500);
      await this.perfSystem.getPattern(testPatterns[patternIndex].id);
    }

    const metrics = this.perfSystem.getMetrics();
    const hitRate = metrics.cache.overallHitRate;

    return {
      name: 'Cache Hit Rate',
      description: 'Percentage of requests served from cache',
      target: 0.8,
      actual: hitRate,
      unit: 'ratio',
      passed: hitRate >= 0.8,
      executionTime: performance.now() - startTime,
      details: {
        l1HitRate: metrics.cache.l1.hitRate,
        l2HitRate: metrics.cache.l2.hitRate,
        l3HitRate: metrics.cache.l3.hitRate
      }
    };
  }

  /**
   * Benchmark 4: Batch Processing
   * Target: 10x improvement over single operations
   */
  private async benchmarkBatchProcessing(): Promise<BenchmarkResult> {
    console.log('📦 Benchmarking batch processing...');
    const startTime = performance.now();

    const updates = 1000;
    const testPatterns = this.generateTestPatterns(updates);

    // Single operations
    const singleStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await this.perfSystem.updateConfidence(testPatterns[i].id, 'success');
      await this.perfSystem.flush();
    }
    const singleTime = performance.now() - singleStart;

    // Batch operations
    const batchStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await this.perfSystem.updateConfidence(testPatterns[i].id, 'success');
    }
    await this.perfSystem.flush();
    const batchTime = performance.now() - batchStart;

    const improvement = singleTime / batchTime;

    return {
      name: 'Batch Processing Improvement',
      description: 'Speedup compared to single operations',
      target: 10,
      actual: improvement,
      unit: 'x faster',
      passed: improvement >= 10,
      executionTime: performance.now() - startTime,
      details: {
        singleOpTime: singleTime,
        batchOpTime: batchTime
      }
    };
  }

  /**
   * Benchmark 5: Compression Ratio
   * Target: 60% compression
   */
  private async benchmarkCompressionRatio(): Promise<BenchmarkResult> {
    console.log('🗜️  Benchmarking compression ratio...');
    const startTime = performance.now();

    const testPatterns = this.generateTestPatterns(100);

    // Store patterns (triggers compression)
    for (const pattern of testPatterns) {
      await this.perfSystem.storePattern(pattern);
    }

    await this.perfSystem.flush();

    const metrics = this.perfSystem.getMetrics();
    const compressionRatio = metrics.compression.compressionRatio;

    // Lower is better (0.4 = 60% compression)
    const compressionPercentage = (1 - compressionRatio) * 100;

    return {
      name: 'Compression Ratio',
      description: 'Space saved through compression',
      target: 60,
      actual: compressionPercentage,
      unit: '%',
      passed: compressionPercentage >= 60,
      executionTime: performance.now() - startTime,
      details: {
        totalCompressed: metrics.compression.totalCompressed,
        spaceSavedMb: metrics.compression.spaceSavedMb
      }
    };
  }

  /**
   * Benchmark 6: Learning Overhead
   * Target: <10% overhead
   */
  private async benchmarkLearningOverhead(): Promise<BenchmarkResult> {
    console.log('🧠 Benchmarking learning overhead...');
    const startTime = performance.now();

    const operations = 10000;
    const testPatterns = this.generateTestPatterns(100);

    // Baseline: Operations without learning
    const baselineStart = performance.now();
    for (let i = 0; i < operations; i++) {
      await this.perfSystem.getPattern(testPatterns[i % 100].id);
    }
    const baselineTime = performance.now() - baselineStart;

    // With learning: Operations + confidence updates
    const learningStart = performance.now();
    for (let i = 0; i < operations; i++) {
      await this.perfSystem.getPattern(testPatterns[i % 100].id);
      await this.perfSystem.updateConfidence(
        testPatterns[i % 100].id,
        Math.random() > 0.5 ? 'success' : 'failure'
      );
    }
    await this.perfSystem.flush();
    const learningTime = performance.now() - learningStart;

    const overhead = ((learningTime - baselineTime) / baselineTime) * 100;

    return {
      name: 'Learning Overhead',
      description: 'Performance overhead from learning',
      target: 10,
      actual: overhead,
      unit: '%',
      passed: overhead < 10,
      executionTime: performance.now() - startTime,
      details: {
        baselineTime,
        learningTime
      }
    };
  }

  /**
   * Benchmark 7: Concurrent Operations
   */
  private async benchmarkConcurrentOps(): Promise<BenchmarkResult> {
    console.log('⚡ Benchmarking concurrent operations...');
    const startTime = performance.now();

    const testPatterns = this.generateTestPatterns(100);
    const concurrency = 100;
    const opsPerThread = 1000;

    const opStartTime = performance.now();

    // Run concurrent operations
    const promises = Array.from({ length: concurrency }, async () => {
      for (let i = 0; i < opsPerThread; i++) {
        await this.perfSystem.getPattern(testPatterns[i % 100].id);
      }
    });

    await Promise.all(promises);

    const duration = (performance.now() - opStartTime) / 1000;
    const totalOps = concurrency * opsPerThread;
    const opsPerSecond = totalOps / duration;

    return {
      name: 'Concurrent Operations',
      description: 'Throughput under concurrent load',
      target: 172000,
      actual: opsPerSecond,
      unit: 'ops/sec',
      passed: opsPerSecond >= 172000,
      executionTime: performance.now() - startTime,
      details: {
        concurrency,
        opsPerThread,
        totalOps
      }
    };
  }

  /**
   * Benchmark 8: Memory Usage
   */
  private async benchmarkMemoryUsage(): Promise<BenchmarkResult> {
    console.log('💾 Benchmarking memory usage...');
    const startTime = performance.now();

    const memBefore = process.memoryUsage().heapUsed / (1024 * 1024);

    // Load 10000 patterns into cache
    const testPatterns = this.generateTestPatterns(10000);
    for (const pattern of testPatterns) {
      await this.perfSystem.getPattern(pattern.id);
    }

    const memAfter = process.memoryUsage().heapUsed / (1024 * 1024);
    const memUsed = memAfter - memBefore;

    return {
      name: 'Memory Usage',
      description: 'Memory footprint for 10K patterns',
      target: 100,
      actual: memUsed,
      unit: 'MB',
      passed: memUsed < 100,
      executionTime: performance.now() - startTime,
      details: {
        memBefore: memBefore.toFixed(2),
        memAfter: memAfter.toFixed(2)
      }
    };
  }

  /**
   * Benchmark 9: Latency Percentiles
   */
  private async benchmarkLatencyPercentiles(): Promise<BenchmarkResult> {
    console.log('📊 Benchmarking latency percentiles...');
    const startTime = performance.now();

    const testPatterns = this.generateTestPatterns(100);
    const latencies: number[] = [];

    // Collect 10000 measurements
    for (let i = 0; i < 10000; i++) {
      const result = await this.perfSystem.getPattern(testPatterns[i % 100].id);
      latencies.push(result.executionTime);
    }

    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    return {
      name: 'P99 Latency',
      description: '99th percentile latency',
      target: 10,
      actual: p99,
      unit: 'ms',
      passed: p99 < 10,
      executionTime: performance.now() - startTime,
      details: {
        p50,
        p95,
        p99
      }
    };
  }

  /**
   * Generate test patterns
   */
  private generateTestPatterns(count: number): Pattern[] {
    const patterns: Pattern[] = [];

    for (let i = 0; i < count; i++) {
      patterns.push({
        id: `pattern_${i}`,
        type: 'testing',
        patternData: {
          name: `Test Pattern ${i}`,
          description: 'Benchmark test pattern with some data',
          operations: Array.from({ length: 10 }, (_, j) => ({
            tool: 'test',
            params: { index: j }
          }))
        },
        confidence: 0.5 + Math.random() * 0.5,
        usageCount: Math.floor(Math.random() * 100),
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
    }

    return patterns;
  }

  /**
   * Print benchmark report
   */
  private printReport(suite: BenchmarkSuite): void {
    console.log('\n' + '='.repeat(80));
    console.log(`📊 ${suite.name}`);
    console.log('='.repeat(80));

    for (const result of suite.results) {
      const status = result.passed ? '✅' : '❌';
      const comparison = result.passed ? '>=' : '<';

      console.log(`\n${status} ${result.name}`);
      console.log(`   ${result.description}`);
      console.log(
        `   Target: ${comparison} ${result.target} ${result.unit}`
      );
      console.log(`   Actual: ${result.actual.toFixed(2)} ${result.unit}`);
      console.log(`   Time: ${result.executionTime.toFixed(2)}ms`);

      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`Summary: ${suite.passed}/${suite.results.length} passed`);
    console.log(`Total Time: ${(suite.totalTime / 1000).toFixed(2)}s`);
    console.log(
      `Overall: ${suite.overallSuccess ? '✅ SUCCESS' : '❌ FAILED'}`
    );
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Profile operation
   */
  async profile(operation: string, fn: () => Promise<any>): Promise<any> {
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    let success = true;
    let result: any;

    try {
      result = await fn();
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      const memAfter = process.memoryUsage().heapUsed;

      this.profiles.push({
        operation,
        timestamp: Date.now(),
        duration,
        memory: memAfter - memBefore,
        success
      });
    }

    return result;
  }

  /**
   * Get profiling data
   */
  getProfiles(): ProfilePoint[] {
    return [...this.profiles];
  }

  /**
   * Clear profiling data
   */
  clearProfiles(): void {
    this.profiles = [];
  }
}

// ============================================================================
// Exports
// ============================================================================

export default PerformanceBenchmarks;
