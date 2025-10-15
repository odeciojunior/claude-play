/**
 * Performance System - Main Export
 *
 * Unified performance optimization system integrating:
 * - Multi-level caching (L1/L2/L3)
 * - Database optimization (WAL, indexes, pooling)
 * - Batch processing (patterns, confidence scores)
 * - Memory compression (zlib, quantization, delta)
 *
 * Target Performance:
 * - 172,000+ operations/second
 * - <10ms pattern retrieval
 * - 80% cache hit rate
 * - 60% memory compression
 * - <10% learning overhead
 */

// Core exports
export { default as PerformanceSystem } from './performance-system';
export type {
  PerformanceConfig,
  PerformanceMetrics,
  OperationResult
} from './performance-system';

// Caching exports
export { default as MultiLevelCache, L1Cache, L2Cache, L3Cache } from './multi-level-cache';
export type { CacheStats, CacheConfig } from './multi-level-cache';

// Database exports
export { default as DatabaseOptimizer, DatabaseConnectionPool } from './database-optimizer';
export type {
  DatabaseConfig,
  QueryStats,
  IndexInfo,
  OptimizationResult
} from './database-optimizer';

// Batch processing exports
export {
  default as BatchProcessor,
  PatternBatchProcessor,
  ConfidenceBatchUpdater
} from './batch-processor';
export type {
  BatchConfig,
  BatchItem,
  BatchStats,
  BatchResult,
  PatternUpdate,
  ConfidenceUpdate
} from './batch-processor';

// Compression exports
export { default as CompressionManager } from './compression';
export type {
  CompressionConfig,
  CompressionResult,
  DecompressionResult,
  CompressionStats
} from './compression';

// Benchmark exports
export { default as PerformanceBenchmarks } from './benchmarks';
export type {
  BenchmarkResult,
  BenchmarkSuite,
  ProfilePoint
} from './benchmarks';

// Utility functions
export { createDefaultPerformanceSystem, createTestPerformanceSystem } from './utils';

/**
 * Quick start example:
 *
 * ```typescript
 * import { PerformanceSystem } from './performance';
 *
 * const perfSystem = new PerformanceSystem({
 *   cache: {
 *     l1MaxSize: 1000,
 *     l1MaxMemoryMb: 10,
 *     l2MaxSize: 10000,
 *     l2MaxMemoryMb: 100,
 *     l3TtlMs: 60000
 *   },
 *   database: {
 *     path: '.swarm/memory.db',
 *     poolSize: 5,
 *     cacheSize: -64000
 *   },
 *   batch: {
 *     patternBatchSize: 1000,
 *     confidenceBatchSize: 500,
 *     flushInterval: 5000
 *   },
 *   compression: {
 *     zlibLevel: 6,
 *     quantizationBits: 8,
 *     enableDedup: true
 *   },
 *   monitoring: {
 *     enabled: true,
 *     metricsInterval: 60000,
 *     slowQueryThreshold: 100
 *   }
 * });
 *
 * await perfSystem.initialize();
 *
 * // Use the system
 * const pattern = await perfSystem.getPattern('pattern-id');
 * await perfSystem.storePattern(newPattern);
 * await perfSystem.updateConfidence('pattern-id', 'success');
 *
 * // Get performance report
 * console.log(perfSystem.getReport());
 *
 * // Shutdown
 * await perfSystem.shutdown();
 * ```
 */
