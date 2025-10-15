/**
 * Multi-Level Caching System
 *
 * Implements three-tier caching strategy:
 * - L1: In-memory LRU cache (1000 patterns, <1ms)
 * - L2: Process-level cache (10K patterns, <5ms)
 * - L3: Database query cache (100K patterns, <10ms)
 *
 * Performance Target: 80% cache hit rate, <10ms average retrieval
 */

import { Pattern } from '../neural/pattern-extraction';

// ============================================================================
// Cache Entry Types
// ============================================================================

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  hits: number;
  size: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  hitRate: number;
  avgAccessTime: number;
}

interface CacheConfig {
  maxSize: number;
  maxMemoryMb: number;
  ttlMs: number;
  evictionPolicy: 'lru' | 'lfu' | 'adaptive';
}

// ============================================================================
// L1 Cache: In-Memory LRU Cache (<1ms)
// ============================================================================

export class L1Cache<T = Pattern> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private stats: CacheStats;
  private accessTime: number[] = [];
  private currentAccessOrder = 0;

  constructor(private config: CacheConfig) {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      hitRate: 0,
      avgAccessTime: 0
    };
  }

  /**
   * Get value from L1 cache
   * Target: <1ms
   */
  get(key: string): T | null {
    const startTime = performance.now();

    const entry = this.cache.get(key);

    if (entry) {
      // Cache hit
      entry.hits++;
      entry.lastAccessed = Date.now();
      this.accessOrder.set(key, ++this.currentAccessOrder);
      this.stats.hits++;

      this.recordAccessTime(performance.now() - startTime);
      return entry.value;
    }

    // Cache miss
    this.stats.misses++;
    this.recordAccessTime(performance.now() - startTime);
    return null;
  }

  /**
   * Set value in L1 cache with eviction
   */
  set(key: string, value: T): void {
    const size = this.estimateSize(value);

    // Check if we need to evict
    if (this.shouldEvict(size)) {
      this.evict(size);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
      size,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.currentAccessOrder);
    this.stats.totalSize += size;
  }

  /**
   * Bulk set for warming cache
   */
  bulkSet(entries: Array<{ key: string; value: T }>): void {
    for (const { key, value } of entries) {
      this.set(key, value);
    }
  }

  /**
   * Check if should evict
   */
  private shouldEvict(newSize: number): boolean {
    const maxSizeBytes = this.config.maxMemoryMb * 1024 * 1024;
    return (
      this.cache.size >= this.config.maxSize ||
      this.stats.totalSize + newSize > maxSizeBytes
    );
  }

  /**
   * Evict entries based on policy
   */
  private evict(requiredSize: number): void {
    const entriesToEvict: string[] = [];
    let freedSize = 0;

    if (this.config.evictionPolicy === 'lru') {
      // Evict least recently used
      const sorted = Array.from(this.accessOrder.entries())
        .sort((a, b) => a[1] - b[1]);

      for (const [key] of sorted) {
        const entry = this.cache.get(key);
        if (entry) {
          entriesToEvict.push(key);
          freedSize += entry.size;

          if (freedSize >= requiredSize) break;
        }
      }
    } else if (this.config.evictionPolicy === 'lfu') {
      // Evict least frequently used
      const sorted = Array.from(this.cache.entries())
        .sort((a, b) => a[1].hits - b[1].hits);

      for (const [key, entry] of sorted) {
        entriesToEvict.push(key);
        freedSize += entry.size;

        if (freedSize >= requiredSize) break;
      }
    } else {
      // Adaptive: combine LRU and LFU
      const scored = Array.from(this.cache.entries())
        .map(([key, entry]) => {
          const recencyScore = this.accessOrder.get(key) || 0;
          const frequencyScore = entry.hits;
          const ageMs = Date.now() - entry.timestamp;

          // Lower score = more likely to evict
          const score =
            0.4 * (recencyScore / this.currentAccessOrder) +
            0.4 * Math.min(1, frequencyScore / 100) +
            0.2 * Math.max(0, 1 - ageMs / this.config.ttlMs);

          return { key, entry, score };
        })
        .sort((a, b) => a.score - b.score);

      for (const { key, entry } of scored) {
        entriesToEvict.push(key);
        freedSize += entry.size;

        if (freedSize >= requiredSize) break;
      }
    }

    // Remove evicted entries
    for (const key of entriesToEvict) {
      const entry = this.cache.get(key);
      if (entry) {
        this.stats.totalSize -= entry.size;
        this.stats.evictions++;
      }
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(value: T): number {
    try {
      const json = JSON.stringify(value);
      return json.length * 2; // Rough estimate: 2 bytes per character
    } catch {
      return 1024; // Default 1KB
    }
  }

  /**
   * Record access time for metrics
   */
  private recordAccessTime(timeMs: number): void {
    this.accessTime.push(timeMs);

    // Keep only last 1000 measurements
    if (this.accessTime.length > 1000) {
      this.accessTime.shift();
    }

    // Update average
    this.stats.avgAccessTime =
      this.accessTime.reduce((a, b) => a + b, 0) / this.accessTime.length;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    return { ...this.stats };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats.totalSize = 0;
    this.currentAccessOrder = 0;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.stats.totalSize -= entry.size;
      this.accessOrder.delete(key);
      return this.cache.delete(key);
    }
    return false;
  }

  /**
   * Warm cache with frequently accessed items
   */
  async warm(loader: () => Promise<Array<{ key: string; value: T }>>): Promise<void> {
    const entries = await loader();
    this.bulkSet(entries);
  }
}

// ============================================================================
// L2 Cache: Process-Level Cache (<5ms)
// ============================================================================

export class L2Cache<T = Pattern> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats;
  private compressionEnabled: boolean;

  constructor(
    private config: CacheConfig,
    compressionEnabled = true
  ) {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      hitRate: 0,
      avgAccessTime: 0
    };
    this.compressionEnabled = compressionEnabled;
  }

  /**
   * Get value from L2 cache
   * Target: <5ms
   */
  async get(key: string): Promise<T | null> {
    const startTime = performance.now();

    const entry = this.cache.get(key);

    if (entry) {
      // Check TTL
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      entry.hits++;
      entry.lastAccessed = Date.now();
      this.stats.hits++;

      const elapsed = performance.now() - startTime;
      this.updateAvgAccessTime(elapsed);

      return entry.value;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value in L2 cache
   */
  async set(key: string, value: T): Promise<void> {
    const size = this.estimateSize(value);

    // Evict if necessary
    if (this.shouldEvict(size)) {
      await this.evictLRU(size);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
      size,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.stats.totalSize += size;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.config.ttlMs;
  }

  /**
   * Should evict entries
   */
  private shouldEvict(newSize: number): boolean {
    const maxSizeBytes = this.config.maxMemoryMb * 1024 * 1024;
    return (
      this.cache.size >= this.config.maxSize ||
      this.stats.totalSize + newSize > maxSizeBytes
    );
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(requiredSize: number): Promise<void> {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let freedSize = 0;

    for (const [key, entry] of entries) {
      this.cache.delete(key);
      freedSize += entry.size;
      this.stats.totalSize -= entry.size;
      this.stats.evictions++;

      if (freedSize >= requiredSize) break;
    }
  }

  /**
   * Estimate size
   */
  private estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024;
    }
  }

  /**
   * Update average access time
   */
  private updateAvgAccessTime(timeMs: number): void {
    const alpha = 0.1; // Exponential moving average
    this.stats.avgAccessTime =
      alpha * timeMs + (1 - alpha) * this.stats.avgAccessTime;
  }

  /**
   * Get statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    return { ...this.stats };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.totalSize = 0;
  }
}

// ============================================================================
// L3 Cache: Database Query Cache (<10ms)
// ============================================================================

export class L3Cache {
  private queryCache = new Map<string, { result: any; timestamp: number }>();
  private stats: CacheStats;

  constructor(private ttlMs: number = 60000) {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      hitRate: 0,
      avgAccessTime: 0
    };
  }

  /**
   * Get cached query result
   * Target: <10ms
   */
  get(queryKey: string): any | null {
    const startTime = performance.now();

    const cached = this.queryCache.get(queryKey);

    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      this.stats.hits++;
      const elapsed = performance.now() - startTime;
      this.updateAvgAccessTime(elapsed);
      return cached.result;
    }

    this.stats.misses++;

    // Clean up expired entry
    if (cached) {
      this.queryCache.delete(queryKey);
    }

    return null;
  }

  /**
   * Cache query result
   */
  set(queryKey: string, result: any): void {
    this.queryCache.set(queryKey, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.ttlMs) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.queryCache.delete(key);
      this.stats.evictions++;
    }
  }

  /**
   * Update average access time
   */
  private updateAvgAccessTime(timeMs: number): void {
    const alpha = 0.1;
    this.stats.avgAccessTime =
      alpha * timeMs + (1 - alpha) * this.stats.avgAccessTime;
  }

  /**
   * Get statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    return { ...this.stats };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.queryCache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.queryCache.size;
  }
}

// ============================================================================
// Multi-Level Cache Coordinator
// ============================================================================

export class MultiLevelCache<T = Pattern> {
  private l1: L1Cache<T>;
  private l2: L2Cache<T>;
  private l3: L3Cache;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    l1Config: CacheConfig = {
      maxSize: 1000,
      maxMemoryMb: 10,
      ttlMs: 300000, // 5 minutes
      evictionPolicy: 'adaptive'
    },
    l2Config: CacheConfig = {
      maxSize: 10000,
      maxMemoryMb: 100,
      ttlMs: 3600000, // 1 hour
      evictionPolicy: 'lru'
    },
    l3TtlMs: number = 60000 // 1 minute
  ) {
    this.l1 = new L1Cache<T>(l1Config);
    this.l2 = new L2Cache<T>(l2Config);
    this.l3 = new L3Cache(l3TtlMs);

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get value with cascading cache lookup
   * L1 -> L2 -> L3 -> Database
   */
  async get(key: string, dbLoader?: () => Promise<T | null>): Promise<T | null> {
    // Try L1 cache (fastest)
    const l1Value = this.l1.get(key);
    if (l1Value !== null) {
      return l1Value;
    }

    // Try L2 cache
    const l2Value = await this.l2.get(key);
    if (l2Value !== null) {
      // Promote to L1
      this.l1.set(key, l2Value);
      return l2Value;
    }

    // Try database if loader provided
    if (dbLoader) {
      const dbValue = await dbLoader();
      if (dbValue !== null) {
        // Store in all cache levels
        await this.set(key, dbValue);
        return dbValue;
      }
    }

    return null;
  }

  /**
   * Set value in all cache levels
   */
  async set(key: string, value: T): Promise<void> {
    this.l1.set(key, value);
    await this.l2.set(key, value);
  }

  /**
   * Get query result with L3 cache
   */
  getQuery(queryKey: string): any | null {
    return this.l3.get(queryKey);
  }

  /**
   * Cache query result
   */
  setQuery(queryKey: string, result: any): void {
    this.l3.set(queryKey, result);
  }

  /**
   * Get combined statistics
   */
  getStats(): {
    l1: CacheStats;
    l2: CacheStats;
    l3: CacheStats;
    overallHitRate: number;
  } {
    const l1Stats = this.l1.getStats();
    const l2Stats = this.l2.getStats();
    const l3Stats = this.l3.getStats();

    const totalHits = l1Stats.hits + l2Stats.hits + l3Stats.hits;
    const totalRequests =
      l1Stats.hits + l1Stats.misses +
      l2Stats.hits + l2Stats.misses +
      l3Stats.hits + l3Stats.misses;

    const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      l1: l1Stats,
      l2: l2Stats,
      l3: l3Stats,
      overallHitRate
    };
  }

  /**
   * Warm caches with frequently accessed data
   */
  async warm(loader: () => Promise<Array<{ key: string; value: T }>>): Promise<void> {
    await this.l1.warm(loader);

    const entries = await loader();
    for (const { key, value } of entries) {
      await this.l2.set(key, value);
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.l1.clear();
    this.l2.clear();
    this.l3.clear();
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.l3.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Stop cleanup and shutdown
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default MultiLevelCache;
