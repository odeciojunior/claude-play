/**
 * Performance System Utilities
 *
 * Helper functions for creating and configuring performance systems
 */

import PerformanceSystem, { PerformanceConfig } from './performance-system';

/**
 * Create default production performance system
 */
export function createDefaultPerformanceSystem(dbPath = '.swarm/memory.db'): PerformanceSystem {
  const config: PerformanceConfig = {
    cache: {
      l1MaxSize: 1000,
      l1MaxMemoryMb: 10,
      l2MaxSize: 10000,
      l2MaxMemoryMb: 100,
      l3TtlMs: 60000
    },
    database: {
      path: dbPath,
      poolSize: 5,
      cacheSize: -64000 // 64MB
    },
    batch: {
      patternBatchSize: 1000,
      confidenceBatchSize: 500,
      flushInterval: 5000
    },
    compression: {
      zlibLevel: 6,
      quantizationBits: 8,
      enableDedup: true
    },
    monitoring: {
      enabled: true,
      metricsInterval: 60000,
      slowQueryThreshold: 100
    }
  };

  return new PerformanceSystem(config);
}

/**
 * Create test performance system with smaller limits
 */
export function createTestPerformanceSystem(dbPath = ':memory:'): PerformanceSystem {
  const config: PerformanceConfig = {
    cache: {
      l1MaxSize: 100,
      l1MaxMemoryMb: 1,
      l2MaxSize: 1000,
      l2MaxMemoryMb: 10,
      l3TtlMs: 10000
    },
    database: {
      path: dbPath,
      poolSize: 2,
      cacheSize: -8000 // 8MB
    },
    batch: {
      patternBatchSize: 100,
      confidenceBatchSize: 50,
      flushInterval: 1000
    },
    compression: {
      zlibLevel: 3,
      quantizationBits: 8,
      enableDedup: false
    },
    monitoring: {
      enabled: false,
      metricsInterval: 10000,
      slowQueryThreshold: 50
    }
  };

  return new PerformanceSystem(config);
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format number with thousands separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format percentage
 */
export function formatPercentage(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Calculate percentile
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[index];
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Measure execution time
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
  const start = performance.now();
  const result = await fn();
  const time = performance.now() - start;
  return { result, time };
}

/**
 * Measure memory usage
 */
export async function measureMemory<T>(
  fn: () => Promise<T>
): Promise<{ result: T; memoryMb: number }> {
  const memBefore = process.memoryUsage().heapUsed;
  const result = await fn();
  const memAfter = process.memoryUsage().heapUsed;
  const memoryMb = (memAfter - memBefore) / (1024 * 1024);
  return { result, memoryMb };
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Rate limiter
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(tokens = 1): Promise<void> {
    this.refill();

    while (this.tokens < tokens) {
      await sleep(10);
      this.refill();
    }

    this.tokens -= tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Moving average calculator
 */
export class MovingAverage {
  private values: number[] = [];

  constructor(private windowSize: number) {}

  add(value: number): void {
    this.values.push(value);
    if (this.values.length > this.windowSize) {
      this.values.shift();
    }
  }

  get(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  reset(): void {
    this.values = [];
  }
}

/**
 * Performance timer
 */
export class PerformanceTimer {
  private startTime?: number;
  private measurements: number[] = [];

  start(): void {
    this.startTime = performance.now();
  }

  stop(): number {
    if (!this.startTime) {
      throw new Error('Timer not started');
    }

    const elapsed = performance.now() - this.startTime;
    this.measurements.push(elapsed);
    this.startTime = undefined;

    return elapsed;
  }

  getStats(): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);

    return {
      count: this.measurements.length,
      avg: this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99)
    };
  }

  reset(): void {
    this.measurements = [];
  }
}
