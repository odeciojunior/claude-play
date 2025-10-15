/**
 * Database Optimization Module
 *
 * Implements:
 * - WAL mode for concurrent access
 * - Compound indexes for fast queries
 * - Query optimization and analysis
 * - Connection pooling
 *
 * Target: <10ms pattern retrieval from database
 */

import { Database } from 'sqlite3';
import { promisify } from 'util';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface DatabaseConfig {
  path: string;
  journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  cacheSize: number; // Pages, negative = KB
  tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
  mmapSize: number; // Bytes
  pageSize: number; // Bytes
  autoVacuum: 'NONE' | 'FULL' | 'INCREMENTAL';
  busyTimeout: number; // Milliseconds
  maxConnections: number;
}

export interface QueryStats {
  query: string;
  executionTimeMs: number;
  rowsAffected: number;
  timestamp: string;
}

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
}

export interface OptimizationResult {
  applied: boolean;
  description: string;
  expectedImprovement: string;
  queries: string[];
}

// ============================================================================
// Database Optimizer
// ============================================================================

export class DatabaseOptimizer {
  private db: Database;
  private dbRun: (sql: string, params?: any[]) => Promise<any>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;
  private queryStats: QueryStats[] = [];
  private slowQueryThreshold = 100; // ms

  constructor(private config: DatabaseConfig) {
    this.db = new Database(config.path);
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
  }

  /**
   * Initialize database with optimal settings
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing database optimizations...');

    // Apply PRAGMA settings
    await this.applyPragmaSettings();

    // Create indexes
    await this.createOptimalIndexes();

    // Analyze database
    await this.analyzeTables();

    console.log('✅ Database optimization complete');
  }

  /**
   * Apply optimal PRAGMA settings
   */
  private async applyPragmaSettings(): Promise<void> {
    const pragmas = [
      // Enable WAL mode for concurrent reads/writes
      `PRAGMA journal_mode = ${this.config.journalMode}`,

      // Balance safety and performance
      `PRAGMA synchronous = ${this.config.synchronous}`,

      // Larger cache for better performance (in KB if negative)
      `PRAGMA cache_size = ${this.config.cacheSize}`,

      // Use memory for temp tables
      `PRAGMA temp_store = ${this.config.tempStore}`,

      // Enable memory-mapped I/O for faster reads
      `PRAGMA mmap_size = ${this.config.mmapSize}`,

      // Optimal page size
      `PRAGMA page_size = ${this.config.pageSize}`,

      // Incremental auto-vacuum
      `PRAGMA auto_vacuum = ${this.config.autoVacuum}`,

      // Busy timeout for lock contention
      `PRAGMA busy_timeout = ${this.config.busyTimeout}`,

      // Foreign keys for integrity
      'PRAGMA foreign_keys = ON',

      // Enable query optimizer
      'PRAGMA optimize',
    ];

    for (const pragma of pragmas) {
      await this.dbRun(pragma);
      console.log(`  Applied: ${pragma}`);
    }
  }

  /**
   * Create optimal indexes for pattern queries
   */
  private async createOptimalIndexes(): Promise<void> {
    console.log('📊 Creating optimal indexes...');

    const indexes = [
      // Patterns table indexes
      {
        name: 'idx_patterns_type_confidence',
        table: 'patterns',
        columns: ['type', 'confidence DESC'],
        where: 'confidence >= 0.5'
      },
      {
        name: 'idx_patterns_usage',
        table: 'patterns',
        columns: ['usage_count DESC', 'last_used DESC'],
        where: 'usage_count > 0'
      },
      {
        name: 'idx_patterns_created',
        table: 'patterns',
        columns: ['created_at DESC'],
        where: null
      },
      {
        name: 'idx_patterns_composite',
        table: 'patterns',
        columns: ['type', 'confidence DESC', 'usage_count DESC'],
        where: 'confidence >= 0.3'
      },

      // Pattern embeddings indexes
      {
        name: 'idx_embeddings_model',
        table: 'pattern_embeddings',
        columns: ['model', 'created_at DESC'],
        where: null
      },

      // Task trajectories indexes
      {
        name: 'idx_trajectories_status',
        table: 'task_trajectories',
        columns: ['status', 'created_at DESC'],
        where: null
      },
      {
        name: 'idx_trajectories_type',
        table: 'task_trajectories',
        columns: ['trajectory_type', 'quality_score DESC'],
        where: 'quality_score > 0.6'
      },

      // Metrics log indexes
      {
        name: 'idx_metrics_component',
        table: 'metrics_log',
        columns: ['component', 'timestamp DESC'],
        where: null
      },
      {
        name: 'idx_metrics_timestamp',
        table: 'metrics_log',
        columns: ['timestamp DESC'],
        where: null
      },
    ];

    for (const index of indexes) {
      try {
        const whereClause = index.where ? `WHERE ${index.where}` : '';
        const sql = `
          CREATE INDEX IF NOT EXISTS ${index.name}
          ON ${index.table}(${index.columns.join(', ')})
          ${whereClause}
        `;

        await this.dbRun(sql);
        console.log(`  ✓ Created index: ${index.name}`);
      } catch (error) {
        console.error(`  ✗ Failed to create index ${index.name}:`, error);
      }
    }
  }

  /**
   * Analyze tables for query optimizer
   */
  private async analyzeTables(): Promise<void> {
    console.log('🔍 Analyzing tables...');

    const tables = [
      'patterns',
      'pattern_embeddings',
      'task_trajectories',
      'metrics_log',
      'memory_entries'
    ];

    for (const table of tables) {
      try {
        await this.dbRun(`ANALYZE ${table}`);
        console.log(`  ✓ Analyzed: ${table}`);
      } catch (error) {
        console.error(`  ✗ Failed to analyze ${table}:`, error);
      }
    }
  }

  /**
   * Execute query with performance tracking
   */
  async executeQuery<T = any>(
    sql: string,
    params: any[] = [],
    operation: 'run' | 'get' | 'all' = 'all'
  ): Promise<T> {
    const startTime = performance.now();

    let result: any;
    try {
      if (operation === 'run') {
        result = await this.dbRun(sql, params);
      } else if (operation === 'get') {
        result = await this.dbGet(sql, params);
      } else {
        result = await this.dbAll(sql, params);
      }

      const executionTime = performance.now() - startTime;

      // Track query stats
      this.trackQuery(sql, executionTime, result);

      // Warn on slow queries
      if (executionTime > this.slowQueryThreshold) {
        console.warn(
          `⚠️  Slow query (${executionTime.toFixed(2)}ms):\n${sql.substring(0, 100)}...`
        );
      }

      return result;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Track query performance
   */
  private trackQuery(query: string, executionTimeMs: number, result: any): void {
    const stat: QueryStats = {
      query: query.substring(0, 200),
      executionTimeMs,
      rowsAffected: Array.isArray(result) ? result.length : result?.changes || 0,
      timestamp: new Date().toISOString()
    };

    this.queryStats.push(stat);

    // Keep only last 1000 queries
    if (this.queryStats.length > 1000) {
      this.queryStats.shift();
    }
  }

  /**
   * Get slow query report
   */
  getSlowQueries(limit: number = 10): QueryStats[] {
    return this.queryStats
      .filter(s => s.executionTimeMs > this.slowQueryThreshold)
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
      .slice(0, limit);
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): {
    totalQueries: number;
    avgExecutionTime: number;
    slowQueries: number;
    fastestQuery: number;
    slowestQuery: number;
  } {
    if (this.queryStats.length === 0) {
      return {
        totalQueries: 0,
        avgExecutionTime: 0,
        slowQueries: 0,
        fastestQuery: 0,
        slowestQuery: 0
      };
    }

    const times = this.queryStats.map(s => s.executionTimeMs);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
      totalQueries: this.queryStats.length,
      avgExecutionTime: sum / this.queryStats.length,
      slowQueries: this.queryStats.filter(s => s.executionTimeMs > this.slowQueryThreshold).length,
      fastestQuery: Math.min(...times),
      slowestQuery: Math.max(...times)
    };
  }

  /**
   * List all indexes
   */
  async listIndexes(table?: string): Promise<IndexInfo[]> {
    const sql = table
      ? `SELECT * FROM sqlite_master WHERE type='index' AND tbl_name=?`
      : `SELECT * FROM sqlite_master WHERE type='index'`;

    const rows = await this.dbAll(sql, table ? [table] : []);

    return rows.map(row => ({
      name: row.name,
      table: row.tbl_name,
      columns: [], // Would need to parse SQL to extract
      unique: row.sql?.includes('UNIQUE') || false,
      partial: row.sql?.includes('WHERE') || false
    }));
  }

  /**
   * Vacuum database to reclaim space
   */
  async vacuum(): Promise<void> {
    console.log('🧹 Vacuuming database...');
    await this.dbRun('VACUUM');
    console.log('✅ Vacuum complete');
  }

  /**
   * Incremental vacuum
   */
  async incrementalVacuum(pages: number = 100): Promise<void> {
    await this.dbRun(`PRAGMA incremental_vacuum(${pages})`);
  }

  /**
   * Optimize database
   */
  async optimize(): Promise<void> {
    console.log('⚡ Running optimization...');
    await this.dbRun('PRAGMA optimize');
    console.log('✅ Optimization complete');
  }

  /**
   * Get database size
   */
  async getDatabaseSize(): Promise<{
    pageCount: number;
    pageSize: number;
    totalSizeMb: number;
  }> {
    const pageCount = await this.dbGet('PRAGMA page_count');
    const pageSize = await this.dbGet('PRAGMA page_size');

    const totalBytes = pageCount.page_count * pageSize.page_size;

    return {
      pageCount: pageCount.page_count,
      pageSize: pageSize.page_size,
      totalSizeMb: totalBytes / (1024 * 1024)
    };
  }

  /**
   * Get database integrity check
   */
  async checkIntegrity(): Promise<boolean> {
    const result = await this.dbGet('PRAGMA integrity_check');
    return result.integrity_check === 'ok';
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get database handle for direct access
   */
  getDatabase(): Database {
    return this.db;
  }
}

// ============================================================================
// Connection Pool
// ============================================================================

export class DatabaseConnectionPool {
  private connections: Database[] = [];
  private available: Database[] = [];
  private inUse = new Set<Database>();
  private waiting: Array<(db: Database) => void> = [];

  constructor(
    private config: DatabaseConfig,
    private size: number = 5
  ) {}

  /**
   * Initialize connection pool
   */
  async initialize(): Promise<void> {
    console.log(`🔌 Initializing connection pool (size: ${this.size})...`);

    for (let i = 0; i < this.size; i++) {
      const db = new Database(this.config.path);
      this.connections.push(db);
      this.available.push(db);
    }

    console.log(`✅ Connection pool initialized`);
  }

  /**
   * Acquire connection from pool
   */
  async acquire(): Promise<Database> {
    if (this.available.length > 0) {
      const db = this.available.pop()!;
      this.inUse.add(db);
      return db;
    }

    // Wait for available connection
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  /**
   * Release connection back to pool
   */
  release(db: Database): void {
    if (!this.inUse.has(db)) {
      throw new Error('Connection not in use');
    }

    this.inUse.delete(db);

    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.inUse.add(db);
      resolve(db);
    } else {
      this.available.push(db);
    }
  }

  /**
   * Execute with automatic acquire/release
   */
  async execute<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const db = await this.acquire();
    try {
      return await fn(db);
    } finally {
      this.release(db);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    available: number;
    inUse: number;
    waiting: number;
  } {
    return {
      total: this.connections.length,
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length
    };
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    console.log('🔌 Closing connection pool...');

    const closePromises = this.connections.map(db => {
      return new Promise<void>((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    await Promise.all(closePromises);

    this.connections = [];
    this.available = [];
    this.inUse.clear();
    this.waiting = [];

    console.log('✅ Connection pool closed');
  }
}

// ============================================================================
// Exports
// ============================================================================

export default DatabaseOptimizer;
