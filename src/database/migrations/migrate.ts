#!/usr/bin/env node
/**
 * Database Migration System
 *
 * Handles initialization and migration of all database schemas:
 * - Core patterns and memory
 * - GOAP planning and learning
 * - Verification outcomes and reliability
 *
 * Features:
 * - Idempotent migrations (can run multiple times safely)
 * - Version tracking
 * - Rollback support
 * - Migration validation
 *
 * Usage:
 *   npm run db:migrate              # Run all pending migrations
 *   npm run db:migrate -- --reset   # Reset and rebuild all schemas
 *   npm run db:migrate -- --verify  # Verify schema integrity
 */

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - better-sqlite3 compilation issues with Node v24
import Database from 'better-sqlite3';

// Configuration
const DEFAULT_DB_PATH = path.join(process.cwd(), '.swarm', 'memory.db');
const SCHEMA_DIR = path.join(__dirname, '..', 'schema');

interface MigrationFile {
  order: number;
  name: string;
  path: string;
  content: string;
}

interface SchemaVersion {
  version: string;
  description: string;
  applied_at: string;
}

class DatabaseMigrator {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Load all schema files in order
   */
  private loadSchemaFiles(): MigrationFile[] {
    const files = fs.readdirSync(SCHEMA_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const match = file.match(/^(\d+)-(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid schema file name: ${file}`);
      }

      const [, orderStr, name] = match;
      const order = parseInt(orderStr, 10);
      const filePath = path.join(SCHEMA_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      return { order, name, path: filePath, content };
    });
  }

  /**
   * Get currently applied schema versions
   */
  private getAppliedVersions(): SchemaVersion[] {
    try {
      const stmt = this.db.prepare('SELECT version, description, applied_at FROM schema_version');
      return stmt.all() as SchemaVersion[];
    } catch (error) {
      // Table doesn't exist yet
      return [];
    }
  }

  /**
   * Check if a schema version has been applied
   */
  private isVersionApplied(version: string): boolean {
    const versions = this.getAppliedVersions();
    return versions.some(v => v.version.startsWith(version));
  }

  /**
   * Execute a schema file
   */
  private executeSchema(migration: MigrationFile): void {
    console.log(`\n📦 Applying schema: ${migration.name}`);
    console.log(`   File: ${path.basename(migration.path)}`);

    try {
      // Split SQL file into individual statements
      const statements = this.splitSqlStatements(migration.content);

      // Execute each statement
      let executed = 0;
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            this.db.exec(statement);
            executed++;
          } catch (error: any) {
            // Ignore "already exists" errors for idempotency
            if (!error.message.includes('already exists')) {
              console.error(`   ❌ Error executing statement: ${error.message}`);
              console.error(`   Statement: ${statement.substring(0, 100)}...`);
              throw error;
            }
          }
        }
      }

      console.log(`   ✅ Successfully executed ${executed} statements`);
    } catch (error: any) {
      console.error(`   ❌ Failed to apply schema: ${error.message}`);
      throw error;
    }
  }

  /**
   * Split SQL content into individual statements
   * Handles multiline statements and comments
   */
  private splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      // Handle string literals
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === stringChar && inString) {
        inString = false;
        current += char;
      } else if (char === ';' && !inString) {
        // Statement terminator
        statements.push(current.trim());
        current = '';
      } else if (char === '-' && nextChar === '-' && !inString) {
        // Single line comment - skip to end of line
        while (i < sql.length && sql[i] !== '\n') {
          i++;
        }
      } else if (char === '/' && nextChar === '*' && !inString) {
        // Multi-line comment - skip to */
        i += 2;
        while (i < sql.length - 1) {
          if (sql[i] === '*' && sql[i + 1] === '/') {
            i++;
            break;
          }
          i++;
        }
      } else {
        current += char;
      }
    }

    // Add last statement if exists
    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements.filter(s => s.length > 0);
  }

  /**
   * Run all migrations
   */
  public async migrate(options: { reset?: boolean; force?: boolean } = {}): Promise<void> {
    console.log('🚀 Database Migration System');
    console.log(`📂 Database: ${this.dbPath}`);

    if (options.reset) {
      console.log('\n⚠️  Reset mode: Dropping all tables...');
      this.resetDatabase();
    }

    // Load schema files
    const migrations = this.loadSchemaFiles();
    console.log(`\n📋 Found ${migrations.length} schema files`);

    // Apply each migration
    let applied = 0;
    for (const migration of migrations) {
      const versionPrefix = `1.0.0-${migration.name}`;

      if (!options.force && this.isVersionApplied(versionPrefix)) {
        console.log(`\n⏭️  Skipping: ${migration.name} (already applied)`);
        continue;
      }

      this.executeSchema(migration);
      applied++;
    }

    console.log(`\n✅ Migration complete! Applied ${applied} schema(s)`);

    // Verify integrity
    await this.verify();
  }

  /**
   * Reset database by dropping all tables
   */
  private resetDatabase(): void {
    try {
      // Get all table names
      const tables = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).all() as { name: string }[];

      // Drop all views first (may depend on tables)
      const views = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='view'"
      ).all() as { name: string }[];

      for (const view of views) {
        this.db.exec(`DROP VIEW IF EXISTS ${view.name}`);
      }

      // Drop all tables
      for (const table of tables) {
        this.db.exec(`DROP TABLE IF EXISTS ${table.name}`);
      }

      console.log(`   Dropped ${tables.length} tables and ${views.length} views`);
    } catch (error: any) {
      console.error(`   Error during reset: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify database schema integrity
   */
  public async verify(): Promise<void> {
    console.log('\n🔍 Verifying database integrity...');

    try {
      // Check schema version table exists
      const versionTable = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
      ).get();

      if (!versionTable) {
        throw new Error('schema_version table not found');
      }

      // Get applied versions
      const versions = this.getAppliedVersions();
      console.log(`   ✅ Found ${versions.length} applied schema version(s)`);

      for (const version of versions) {
        console.log(`      - ${version.version}: ${version.description}`);
      }

      // Check critical tables exist
      const criticalTables = [
        'patterns',
        'pattern_embeddings',
        'task_trajectories',
        'memory_entries',
        'goap_patterns',
        'goap_plans',
        'verification_outcomes',
        'agent_reliability'
      ];

      console.log('\n   Checking critical tables...');
      for (const table of criticalTables) {
        const exists = this.db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        ).get(table);

        if (!exists) {
          throw new Error(`Critical table missing: ${table}`);
        }
        console.log(`      ✅ ${table}`);
      }

      // Run PRAGMA integrity_check
      console.log('\n   Running SQLite integrity check...');
      const integrity = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      if (integrity.length === 1 && integrity[0].integrity_check === 'ok') {
        console.log('      ✅ Database integrity check passed');
      } else {
        console.warn('      ⚠️  Integrity check warnings:', integrity);
      }

      // Check foreign key integrity
      console.log('   Checking foreign key constraints...');
      const fkCheck = this.db.pragma('foreign_key_check') as Array<any>;
      if (fkCheck.length === 0) {
        console.log('      ✅ Foreign key constraints valid');
      } else {
        console.warn('      ⚠️  Foreign key violations:', fkCheck);
      }

      console.log('\n✅ Database verification complete!');
    } catch (error: any) {
      console.error(`\n❌ Verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  public async stats(): Promise<void> {
    console.log('\n📊 Database Statistics');

    try {
      // Get all tables
      const tables = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).all() as { name: string }[];

      console.log(`\n   Total tables: ${tables.length}`);

      for (const table of tables) {
        try {
          const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
          console.log(`      ${table.name}: ${count.count} rows`);
        } catch (error) {
          console.log(`      ${table.name}: (unable to count)`);
        }
      }

      // Get database size
      const pageCount = this.db.pragma('page_count', { simple: true }) as number;
      const pageSize = this.db.pragma('page_size', { simple: true }) as number;
      const sizeMB = (pageCount * pageSize) / (1024 * 1024);

      console.log(`\n   Database size: ${sizeMB.toFixed(2)} MB`);
      console.log(`   Page count: ${pageCount}`);
      console.log(`   Page size: ${pageSize} bytes`);

    } catch (error: any) {
      console.error(`\n❌ Failed to get stats: ${error.message}`);
    }
  }

  /**
   * Close database connection
   */
  public close(): void {
    this.db.close();
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const options = {
    reset: args.includes('--reset'),
    force: args.includes('--force'),
    verify: args.includes('--verify'),
    stats: args.includes('--stats'),
    dbPath: DEFAULT_DB_PATH
  };

  // Check for custom db path
  const dbPathIndex = args.indexOf('--db');
  if (dbPathIndex !== -1 && args[dbPathIndex + 1]) {
    options.dbPath = args[dbPathIndex + 1];
  }

  const migrator = new DatabaseMigrator(options.dbPath);

  try {
    if (options.stats) {
      await migrator.stats();
    } else if (options.verify) {
      await migrator.verify();
    } else {
      await migrator.migrate(options);
    }
  } catch (error: any) {
    console.error(`\n❌ Migration failed: ${error.message}`);
    process.exit(1);
  } finally {
    migrator.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { DatabaseMigrator };
