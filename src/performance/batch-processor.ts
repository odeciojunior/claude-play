/**
 * Batch Processing System
 *
 * Implements efficient batch processing for:
 * - Pattern updates (100-1000 items)
 * - Confidence score updates
 * - Embedding calculations
 * - Async processing for non-critical operations
 *
 * Target: 10-100x throughput improvement vs. single operations
 */

import { Database } from 'sqlite3';
import { promisify } from 'util';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface BatchConfig {
  minBatchSize: number;
  maxBatchSize: number;
  flushInterval: number; // ms
  maxQueueSize: number;
  enableAsync: boolean;
}

export interface BatchItem<T> {
  data: T;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  retries: number;
  callback?: (result: any) => void;
  errorCallback?: (error: Error) => void;
}

export interface BatchStats {
  totalBatches: number;
  totalItems: number;
  avgBatchSize: number;
  avgProcessingTime: number;
  successRate: number;
  failedBatches: number;
}

export interface BatchResult {
  success: boolean;
  itemsProcessed: number;
  errors: Array<{ index: number; error: string }>;
  executionTime: number;
}

// ============================================================================
// Generic Batch Processor
// ============================================================================

export class BatchProcessor<T> {
  private queue: BatchItem<T>[] = [];
  private processing = false;
  private stats: BatchStats;
  private flushTimer?: NodeJS.Timeout;
  private processingTimes: number[] = [];

  constructor(
    private config: BatchConfig,
    private processBatch: (items: T[]) => Promise<BatchResult>
  ) {
    this.stats = {
      totalBatches: 0,
      totalItems: 0,
      avgBatchSize: 0,
      avgProcessingTime: 0,
      successRate: 1.0,
      failedBatches: 0
    };

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Add item to batch queue
   */
  async add(
    data: T,
    priority: BatchItem<T>['priority'] = 'medium'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const item: BatchItem<T> = {
        data,
        priority,
        timestamp: Date.now(),
        retries: 0,
        callback: () => resolve(),
        errorCallback: (error) => reject(error)
      };

      // Check queue size
      if (this.queue.length >= this.config.maxQueueSize) {
        reject(new Error('Batch queue full'));
        return;
      }

      this.queue.push(item);

      // Sort by priority
      this.sortQueue();

      // Trigger immediate processing if batch size reached
      if (this.queue.length >= this.config.maxBatchSize) {
        this.flush().catch(console.error);
      }
    });
  }

  /**
   * Add multiple items at once
   */
  async addBatch(items: T[], priority: BatchItem<T>['priority'] = 'medium'): Promise<void> {
    const batchItems: BatchItem<T>[] = items.map(data => ({
      data,
      priority,
      timestamp: Date.now(),
      retries: 0
    }));

    this.queue.push(...batchItems);
    this.sortQueue();

    if (this.queue.length >= this.config.maxBatchSize) {
      await this.flush();
    }
  }

  /**
   * Flush queue immediately
   */
  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Take batch from queue
      const batchSize = Math.min(this.config.maxBatchSize, this.queue.length);
      const batch = this.queue.splice(0, batchSize);

      // Process batch
      const startTime = performance.now();
      const result = await this.processBatch(batch.map(item => item.data));
      const executionTime = performance.now() - startTime;

      // Update statistics
      this.updateStats(batch.length, executionTime, result.success);

      // Handle callbacks
      if (result.success) {
        batch.forEach(item => item.callback?.(result));
      } else {
        // Handle partial failures
        result.errors.forEach(({ index, error }) => {
          const item = batch[index];
          if (item.errorCallback) {
            item.errorCallback(new Error(error));
          }
        });
      }
    } catch (error) {
      console.error('Batch processing failed:', error);
      this.stats.failedBatches++;
    } finally {
      this.processing = false;

      // Continue processing if queue has items
      if (this.queue.length >= this.config.minBatchSize) {
        setImmediate(() => this.flush());
      }
    }
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Same priority: FIFO
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Update statistics
   */
  private updateStats(batchSize: number, executionTime: number, success: boolean): void {
    this.stats.totalBatches++;
    this.stats.totalItems += batchSize;

    this.processingTimes.push(executionTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    this.stats.avgBatchSize =
      (this.stats.avgBatchSize * (this.stats.totalBatches - 1) + batchSize) /
      this.stats.totalBatches;

    this.stats.avgProcessingTime =
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

    if (!success) {
      this.stats.failedBatches++;
    }

    this.stats.successRate =
      1 - this.stats.failedBatches / this.stats.totalBatches;
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.queue.length >= this.config.minBatchSize) {
        this.flush().catch(console.error);
      }
    }, this.config.flushInterval);
  }

  /**
   * Get current statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Shutdown processor
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining items
    while (this.queue.length > 0) {
      await this.flush();
    }
  }
}

// ============================================================================
// Pattern Batch Processor
// ============================================================================

export interface PatternUpdate {
  id: string;
  confidence?: number;
  usageCount?: number;
  lastUsed?: string;
  patternData?: string;
}

export class PatternBatchProcessor {
  private processor: BatchProcessor<PatternUpdate>;
  private dbRun: (sql: string, params?: any[]) => Promise<any>;

  constructor(
    private db: Database,
    config: Partial<BatchConfig> = {}
  ) {
    this.dbRun = promisify(db.run.bind(db));

    const fullConfig: BatchConfig = {
      minBatchSize: config.minBatchSize || 10,
      maxBatchSize: config.maxBatchSize || 1000,
      flushInterval: config.flushInterval || 5000,
      maxQueueSize: config.maxQueueSize || 10000,
      enableAsync: config.enableAsync ?? true
    };

    this.processor = new BatchProcessor<PatternUpdate>(
      fullConfig,
      (items) => this.processBatch(items)
    );
  }

  /**
   * Process batch of pattern updates
   */
  private async processBatch(items: PatternUpdate[]): Promise<BatchResult> {
    const startTime = performance.now();
    const errors: Array<{ index: number; error: string }> = [];

    try {
      // Build batch UPDATE statement
      await this.dbRun('BEGIN TRANSACTION');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        try {
          // Build dynamic UPDATE
          const updates: string[] = [];
          const params: any[] = [];

          if (item.confidence !== undefined) {
            updates.push('confidence = ?');
            params.push(item.confidence);
          }

          if (item.usageCount !== undefined) {
            updates.push('usage_count = ?');
            params.push(item.usageCount);
          }

          if (item.lastUsed !== undefined) {
            updates.push('last_used = ?');
            params.push(item.lastUsed);
          }

          if (item.patternData !== undefined) {
            updates.push('pattern_data = ?');
            params.push(item.patternData);
          }

          if (updates.length > 0) {
            params.push(item.id);
            const sql = `UPDATE patterns SET ${updates.join(', ')} WHERE id = ?`;
            await this.dbRun(sql, params);
          }
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await this.dbRun('COMMIT');

      return {
        success: errors.length === 0,
        itemsProcessed: items.length - errors.length,
        errors,
        executionTime: performance.now() - startTime
      };
    } catch (error) {
      await this.dbRun('ROLLBACK');

      return {
        success: false,
        itemsProcessed: 0,
        errors: [{ index: -1, error: error instanceof Error ? error.message : 'Transaction failed' }],
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Queue pattern update
   */
  async update(update: PatternUpdate, priority?: BatchItem<PatternUpdate>['priority']): Promise<void> {
    return this.processor.add(update, priority);
  }

  /**
   * Queue multiple updates
   */
  async updateBatch(updates: PatternUpdate[], priority?: BatchItem<PatternUpdate>['priority']): Promise<void> {
    return this.processor.addBatch(updates, priority);
  }

  /**
   * Flush pending updates
   */
  async flush(): Promise<void> {
    return this.processor.flush();
  }

  /**
   * Get statistics
   */
  getStats(): BatchStats {
    return this.processor.getStats();
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    return this.processor.shutdown();
  }
}

// ============================================================================
// Confidence Score Batch Updater
// ============================================================================

export interface ConfidenceUpdate {
  patternId: string;
  delta: number;
  outcome: 'success' | 'failure';
  timestamp: string;
}

export class ConfidenceBatchUpdater {
  private processor: BatchProcessor<ConfidenceUpdate>;
  private dbRun: (sql: string, params?: any[]) => Promise<any>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private learningRate: number;
  private decayFactor: number;

  constructor(
    private db: Database,
    config: Partial<BatchConfig> = {},
    learningRate = 0.1,
    decayFactor = 0.95
  ) {
    this.dbRun = promisify(db.run.bind(db));
    this.dbGet = promisify(db.get.bind(db));
    this.learningRate = learningRate;
    this.decayFactor = decayFactor;

    const fullConfig: BatchConfig = {
      minBatchSize: config.minBatchSize || 10,
      maxBatchSize: config.maxBatchSize || 500,
      flushInterval: config.flushInterval || 3000,
      maxQueueSize: config.maxQueueSize || 5000,
      enableAsync: config.enableAsync ?? true
    };

    this.processor = new BatchProcessor<ConfidenceUpdate>(
      fullConfig,
      (items) => this.processBatch(items)
    );
  }

  /**
   * Process batch of confidence updates using Bayesian update
   */
  private async processBatch(items: ConfidenceUpdate[]): Promise<BatchResult> {
    const startTime = performance.now();
    const errors: Array<{ index: number; error: string }> = [];

    try {
      await this.dbRun('BEGIN TRANSACTION');

      // Group updates by pattern
      const groupedUpdates = new Map<string, ConfidenceUpdate[]>();
      for (const item of items) {
        const existing = groupedUpdates.get(item.patternId) || [];
        existing.push(item);
        groupedUpdates.set(item.patternId, existing);
      }

      // Process each pattern's updates
      for (const [patternId, updates] of groupedUpdates.entries()) {
        try {
          // Get current confidence
          const row = await this.dbGet(
            'SELECT confidence, usage_count FROM patterns WHERE id = ?',
            [patternId]
          );

          if (!row) continue;

          let confidence = row.confidence;
          let usageCount = row.usage_count;

          // Apply Bayesian updates
          for (const update of updates) {
            const outcome = update.outcome === 'success' ? 1 : 0;
            confidence = confidence + this.learningRate * (outcome - confidence);
            usageCount++;
          }

          // Apply decay if needed
          const daysSinceUpdate = (Date.now() - new Date(updates[0].timestamp).getTime()) / 86400000;
          if (daysSinceUpdate > 30) {
            confidence *= Math.pow(this.decayFactor, daysSinceUpdate / 30);
          }

          // Clamp to [0, 1]
          confidence = Math.max(0, Math.min(1, confidence));

          // Update database
          await this.dbRun(
            `UPDATE patterns
             SET confidence = ?, usage_count = ?, last_used = ?
             WHERE id = ?`,
            [confidence, usageCount, updates[updates.length - 1].timestamp, patternId]
          );
        } catch (error) {
          errors.push({
            index: items.indexOf(updates[0]),
            error: error instanceof Error ? error.message : 'Update failed'
          });
        }
      }

      await this.dbRun('COMMIT');

      return {
        success: errors.length === 0,
        itemsProcessed: items.length - errors.length,
        errors,
        executionTime: performance.now() - startTime
      };
    } catch (error) {
      await this.dbRun('ROLLBACK');

      return {
        success: false,
        itemsProcessed: 0,
        errors: [{ index: -1, error: error instanceof Error ? error.message : 'Transaction failed' }],
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Queue confidence update
   */
  async update(update: ConfidenceUpdate, priority?: BatchItem<ConfidenceUpdate>['priority']): Promise<void> {
    return this.processor.add(update, priority);
  }

  /**
   * Queue multiple updates
   */
  async updateBatch(updates: ConfidenceUpdate[], priority?: BatchItem<ConfidenceUpdate>['priority']): Promise<void> {
    return this.processor.addBatch(updates, priority);
  }

  /**
   * Flush pending updates
   */
  async flush(): Promise<void> {
    return this.processor.flush();
  }

  /**
   * Get statistics
   */
  getStats(): BatchStats {
    return this.processor.getStats();
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    return this.processor.shutdown();
  }
}

// ============================================================================
// Exports
// ============================================================================

export default BatchProcessor;
