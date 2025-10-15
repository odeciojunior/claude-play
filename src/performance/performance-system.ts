/**
 * Integrated Performance System
 *
 * Combines all performance optimizations:
 * - Multi-level caching (L1/L2/L3)
 * - Database optimization
 * - Batch processing
 * - Memory compression
 *
 * Target: 172K+ ops/sec with <10% learning overhead
 */

import { Database } from 'sqlite3';
import MultiLevelCache from './multi-level-cache';
import DatabaseOptimizer, { DatabaseConnectionPool } from './database-optimizer';
import { PatternBatchProcessor, ConfidenceBatchUpdater } from './batch-processor';
import CompressionManager from './compression';
import { Pattern } from '../neural/pattern-extraction';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface PatternRow {
  id: string;
  type: string;
  pattern_data: string;
  compressed: number;
  confidence: number;
  usage_count: number;
  created_at: string;
  last_used: string | null;
}

export interface PerformanceConfig {
  cache: {
    l1MaxSize: number;
    l1MaxMemoryMb: number;
    l2MaxSize: number;
    l2MaxMemoryMb: number;
    l3TtlMs: number;
  };
  database: {
    path: string;
    poolSize: number;
    cacheSize: number;
  };
  batch: {
    patternBatchSize: number;
    confidenceBatchSize: number;
    flushInterval: number;
  };
  compression: {
    zlibLevel: number;
    quantizationBits: 8 | 16;
    enableDedup: boolean;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    slowQueryThreshold: number;
  };
}

export interface PerformanceMetrics {
  timestamp: string;
  cache: {
    l1: { hits: number; misses: number; hitRate: number };
    l2: { hits: number; misses: number; hitRate: number };
    l3: { hits: number; misses: number; hitRate: number };
    overallHitRate: number;
  };
  database: {
    avgQueryTime: number;
    slowQueries: number;
    totalQueries: number;
  };
  batch: {
    patternBatches: number;
    confidenceBatches: number;
    avgBatchSize: number;
  };
  compression: {
    totalCompressed: number;
    compressionRatio: number;
    spaceSavedMb: number;
  };
  performance: {
    opsPerSecond: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
  };
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  cached: boolean;
  executionTime: number;
  cacheLevel?: 'l1' | 'l2' | 'l3' | 'db';
}

// ============================================================================
// Performance System
// ============================================================================

export class PerformanceSystem {
  private cache: MultiLevelCache<Pattern>;
  private dbOptimizer: DatabaseOptimizer;
  private dbPool: DatabaseConnectionPool;
  private patternBatcher: PatternBatchProcessor;
  private confidenceBatcher: ConfidenceBatchUpdater;
  private compressor: CompressionManager;
  private metricsHistory: PerformanceMetrics[] = [];
  private operationLatencies: number[] = [];
  private operationCount = 0;
  private lastMetricsTime = Date.now();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(private config: PerformanceConfig) {
    // Initialize multi-level cache
    this.cache = new MultiLevelCache(
      {
        maxSize: config.cache.l1MaxSize,
        maxMemoryMb: config.cache.l1MaxMemoryMb,
        ttlMs: 300000,
        evictionPolicy: 'adaptive'
      },
      {
        maxSize: config.cache.l2MaxSize,
        maxMemoryMb: config.cache.l2MaxMemoryMb,
        ttlMs: 3600000,
        evictionPolicy: 'lru'
      },
      config.cache.l3TtlMs
    );

    // Initialize database optimizer
    this.dbOptimizer = new DatabaseOptimizer({
      path: config.database.path,
      journalMode: 'WAL',
      synchronous: 'NORMAL',
      cacheSize: config.database.cacheSize,
      tempStore: 'MEMORY',
      mmapSize: 268435456,
      pageSize: 4096,
      autoVacuum: 'INCREMENTAL',
      busyTimeout: 5000,
      maxConnections: config.database.poolSize
    });

    // Initialize connection pool
    this.dbPool = new DatabaseConnectionPool(
      {
        path: config.database.path,
        journalMode: 'WAL',
        synchronous: 'NORMAL',
        cacheSize: config.database.cacheSize,
        tempStore: 'MEMORY',
        mmapSize: 268435456,
        pageSize: 4096,
        autoVacuum: 'INCREMENTAL',
        busyTimeout: 5000,
        maxConnections: config.database.poolSize
      },
      config.database.poolSize
    );

    // Initialize batch processors (will set up after DB is ready)
    const db = this.dbOptimizer.getDatabase();
    this.patternBatcher = new PatternBatchProcessor(db, {
      maxBatchSize: config.batch.patternBatchSize,
      flushInterval: config.batch.flushInterval
    });

    this.confidenceBatcher = new ConfidenceBatchUpdater(db, {
      maxBatchSize: config.batch.confidenceBatchSize,
      flushInterval: config.batch.flushInterval
    });

    // Initialize compression
    this.compressor = new CompressionManager({
      enableZlib: true,
      enableQuantization: true,
      enableDeltaEncoding: true,
      enableDeduplication: config.compression.enableDedup,
      zlibLevel: config.compression.zlibLevel,
      quantizationBits: config.compression.quantizationBits,
      dedupThreshold: 1024
    });
  }

  /**
   * Initialize performance system
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Performance System...\n');

    // Initialize database
    await this.dbOptimizer.initialize();

    // Initialize connection pool
    await this.dbPool.initialize();

    // Warm cache with frequently accessed patterns
    await this.warmCache();

    // Start monitoring if enabled
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }

    console.log('\n✅ Performance System initialized');
  }

  /**
   * Warm cache with high-confidence patterns
   */
  private async warmCache(): Promise<void> {
    console.log('🔥 Warming cache with high-confidence patterns...');

    const db = this.dbOptimizer.getDatabase();
    const patterns = await new Promise<PatternRow[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM patterns WHERE confidence >= 0.7 ORDER BY usage_count DESC LIMIT 1000',
        (err, rows: PatternRow[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    await this.cache.warm(async () =>
      patterns.map(p => ({
        key: p.id,
        value: this.deserializePattern(p)
      }))
    );

    console.log(`  ✓ Warmed cache with ${patterns.length} patterns`);
  }

  /**
   * Get pattern with full cache hierarchy
   */
  async getPattern(id: string): Promise<OperationResult<Pattern>> {
    const startTime = performance.now();

    try {
      // Try cache first (L1 → L2 → L3)
      const cached = await this.cache.get(id, async () => {
        // Cache miss - load from database
        return this.loadPatternFromDb(id);
      });

      const executionTime = performance.now() - startTime;
      this.recordOperation(executionTime);

      if (cached) {
        return {
          success: true,
          data: cached,
          cached: true,
          executionTime,
          cacheLevel: this.determineCacheLevel(executionTime)
        };
      }

      return {
        success: false,
        cached: false,
        executionTime
      };
    } catch (error) {
      console.error('Failed to get pattern:', error);
      return {
        success: false,
        cached: false,
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Load pattern from database
   */
  private async loadPatternFromDb(id: string): Promise<Pattern | null> {
    return this.dbPool.execute(async (db) => {
      return new Promise<Pattern | null>((resolve, reject) => {
        db.get('SELECT * FROM patterns WHERE id = ?', [id], async (err, row: PatternRow) => {
          if (err) {
            reject(err);
          } else if (row) {
            // Decompress pattern data if needed
            let patternData = row.pattern_data;
            if (row.compressed) {
              const decompressed = await this.compressor.decompress(
                Buffer.from(row.pattern_data),
                'zlib'
              );
              patternData = decompressed.data;
            }

            const data = JSON.parse(patternData);
            resolve({
              id: row.id,
              type: data.type,
              name: data.name,
              description: data.description,
              conditions: data.conditions,
              actions: data.actions,
              successCriteria: data.successCriteria,
              metrics: data.metrics,
              confidence: row.confidence,
              usageCount: row.usage_count,
              createdAt: row.created_at,
              lastUsed: row.last_used ?? undefined
            });
          } else {
            resolve(null);
          }
        });
      });
    });
  }

  /**
   * Store pattern with compression and batching
   */
  async storePattern(pattern: Pattern): Promise<OperationResult<void>> {
    const startTime = performance.now();

    try {
      // Serialize pattern excluding id and metadata
      const patternData = JSON.stringify({
        type: pattern.type,
        name: pattern.name,
        description: pattern.description,
        conditions: pattern.conditions,
        actions: pattern.actions,
        successCriteria: pattern.successCriteria,
        metrics: pattern.metrics
      });

      // Compress pattern data
      const compressed = await this.compressor.compress(
        patternData,
        'text'
      );

      // Queue batch update
      await this.patternBatcher.update({
        id: pattern.id,
        patternData: compressed.compressed.toString('base64')
      });

      // Update cache
      await this.cache.set(pattern.id, pattern);

      const executionTime = performance.now() - startTime;
      this.recordOperation(executionTime);

      return {
        success: true,
        cached: false,
        executionTime
      };
    } catch (error) {
      console.error('Failed to store pattern:', error);
      return {
        success: false,
        cached: false,
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Update confidence score with batching
   */
  async updateConfidence(
    patternId: string,
    outcome: 'success' | 'failure'
  ): Promise<OperationResult<void>> {
    const startTime = performance.now();

    try {
      await this.confidenceBatcher.update({
        patternId,
        delta: outcome === 'success' ? 0.1 : -0.1,
        outcome,
        timestamp: new Date().toISOString()
      });

      const executionTime = performance.now() - startTime;
      this.recordOperation(executionTime);

      return {
        success: true,
        cached: false,
        executionTime
      };
    } catch (error) {
      console.error('Failed to update confidence:', error);
      return {
        success: false,
        cached: false,
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Batch get patterns
   */
  async getPatterns(ids: string[]): Promise<OperationResult<Pattern[]>> {
    const startTime = performance.now();

    try {
      const patterns: Pattern[] = [];

      for (const id of ids) {
        const result = await this.getPattern(id);
        if (result.success && result.data) {
          patterns.push(result.data);
        }
      }

      const executionTime = performance.now() - startTime;
      this.recordOperation(executionTime);

      return {
        success: true,
        data: patterns,
        cached: true,
        executionTime
      };
    } catch (error) {
      console.error('Failed to get patterns:', error);
      return {
        success: false,
        cached: false,
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Flush all pending batches
   */
  async flush(): Promise<void> {
    await Promise.all([
      this.patternBatcher.flush(),
      this.confidenceBatcher.flush()
    ]);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const cacheStats = this.cache.getStats();
    const dbStats = this.dbOptimizer.getQueryStats();
    const patternBatchStats = this.patternBatcher.getStats();
    const confidenceBatchStats = this.confidenceBatcher.getStats();
    const compressionStats = this.compressor.getStats();

    // Calculate operations per second
    const now = Date.now();
    const elapsedSeconds = (now - this.lastMetricsTime) / 1000;
    const opsPerSecond = this.operationCount / elapsedSeconds;

    // Calculate latency percentiles
    const sortedLatencies = [...this.operationLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      cache: {
        l1: {
          hits: cacheStats.l1.hits,
          misses: cacheStats.l1.misses,
          hitRate: cacheStats.l1.hitRate
        },
        l2: {
          hits: cacheStats.l2.hits,
          misses: cacheStats.l2.misses,
          hitRate: cacheStats.l2.hitRate
        },
        l3: {
          hits: cacheStats.l3.hits,
          misses: cacheStats.l3.misses,
          hitRate: cacheStats.l3.hitRate
        },
        overallHitRate: cacheStats.overallHitRate
      },
      database: {
        avgQueryTime: dbStats.avgExecutionTime,
        slowQueries: dbStats.slowQueries,
        totalQueries: dbStats.totalQueries
      },
      batch: {
        patternBatches: patternBatchStats.totalBatches,
        confidenceBatches: confidenceBatchStats.totalBatches,
        avgBatchSize:
          (patternBatchStats.avgBatchSize + confidenceBatchStats.avgBatchSize) / 2
      },
      compression: {
        totalCompressed: compressionStats.totalCompressed,
        compressionRatio: compressionStats.avgCompressionRatio,
        spaceSavedMb:
          (compressionStats.totalOriginalSize - compressionStats.totalCompressedSize) /
          (1024 * 1024)
      },
      performance: {
        opsPerSecond,
        avgLatency:
          this.operationLatencies.reduce((a, b) => a + b, 0) /
          this.operationLatencies.length,
        p95Latency: sortedLatencies[p95Index] || 0,
        p99Latency: sortedLatencies[p99Index] || 0
      }
    };

    // Reset counters
    this.operationCount = 0;
    this.lastMetricsTime = now;

    return metrics;
  }

  /**
   * Get performance report
   */
  getReport(): string {
    const metrics = this.getMetrics();
    const compressionReport = this.compressor.getReport();

    return `
🚀 Performance System Report
============================

📊 Operations Performance
-------------------------
Operations/Second: ${metrics.performance.opsPerSecond.toLocaleString()} ops/sec
Avg Latency: ${metrics.performance.avgLatency.toFixed(2)}ms
P95 Latency: ${metrics.performance.p95Latency.toFixed(2)}ms
P99 Latency: ${metrics.performance.p99Latency.toFixed(2)}ms

💾 Cache Performance
--------------------
Overall Hit Rate: ${(metrics.cache.overallHitRate * 100).toFixed(1)}%
L1 Hit Rate: ${(metrics.cache.l1.hitRate * 100).toFixed(1)}%
L2 Hit Rate: ${(metrics.cache.l2.hitRate * 100).toFixed(1)}%
L3 Hit Rate: ${(metrics.cache.l3.hitRate * 100).toFixed(1)}%

🗄️  Database Performance
------------------------
Avg Query Time: ${metrics.database.avgQueryTime.toFixed(2)}ms
Total Queries: ${metrics.database.totalQueries.toLocaleString()}
Slow Queries: ${metrics.database.slowQueries}

📦 Batch Processing
-------------------
Pattern Batches: ${metrics.batch.patternBatches}
Confidence Batches: ${metrics.batch.confidenceBatches}
Avg Batch Size: ${metrics.batch.avgBatchSize.toFixed(1)} items

${compressionReport}

✅ Status: ${metrics.performance.opsPerSecond >= 172000 ? 'TARGET MET' : 'TARGET NOT MET'}
`;
  }

  /**
   * Record operation for metrics
   */
  private recordOperation(latency: number): void {
    this.operationCount++;
    this.operationLatencies.push(latency);

    // Keep only last 10000 measurements
    if (this.operationLatencies.length > 10000) {
      this.operationLatencies.shift();
    }
  }

  /**
   * Determine cache level from latency
   */
  private determineCacheLevel(latency: number): 'l1' | 'l2' | 'l3' | 'db' {
    if (latency < 1) return 'l1';
    if (latency < 5) return 'l2';
    if (latency < 10) return 'l3';
    return 'db';
  }

  /**
   * Deserialize pattern from database row
   */
  private deserializePattern(row: PatternRow): Pattern {
    const data = JSON.parse(row.pattern_data);
    return {
      id: row.id,
      type: data.type,
      name: data.name,
      description: data.description,
      conditions: data.conditions,
      actions: data.actions,
      successCriteria: data.successCriteria,
      metrics: data.metrics,
      confidence: row.confidence,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      lastUsed: row.last_used ?? undefined
    };
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.metricsHistory.push(metrics);

      // Keep only last 1000 metrics
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory.shift();
      }

      console.log(`📈 Ops/sec: ${metrics.performance.opsPerSecond.toFixed(0)} | Cache Hit: ${(metrics.cache.overallHitRate * 100).toFixed(1)}%`);
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Shutdown performance system
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Performance System...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    await this.flush();
    await this.patternBatcher.shutdown();
    await this.confidenceBatcher.shutdown();
    this.cache.shutdown();
    await this.dbPool.closeAll();
    await this.dbOptimizer.close();

    console.log('✅ Performance System shutdown complete');
  }
}

// ============================================================================
// Exports
// ============================================================================

export default PerformanceSystem;
