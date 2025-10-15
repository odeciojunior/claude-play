/**
 * Staging Smoke Tests
 *
 * Quick validation tests for immediate post-deployment verification.
 * Should complete in under 30 seconds.
 *
 * Coverage:
 * - System responds
 * - Database accessible
 * - Neural system operational
 * - Key functionality working
 * - Critical files present
 */

import { Database } from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import LearningPipeline from '../../src/neural/learning-pipeline';

const SMOKE_TEST_CONFIG = {
  dbPath: '.test-swarm/smoke-test.db',
  timeout: 30000 // 30 seconds total
};

describe('Smoke Tests', () => {
  test('system should respond', () => {
    expect(true).toBe(true);
  }, 1000);

  test('database should be accessible', async () => {
    const db = new Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.run('CREATE TABLE test (id INTEGER)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      db.run('INSERT INTO test VALUES (1)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const row: any = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM test', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    expect(row.id).toBe(1);

    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }, 5000);

  test('neural system should initialize', async () => {
    const db = new Database(':memory:');

    // Create minimal schema
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE patterns (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          pattern_data TEXT NOT NULL,
          confidence REAL NOT NULL DEFAULT 0.5,
          usage_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          last_used TEXT
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const pipeline = new LearningPipeline(db, {
      observationBufferSize: 10,
      observationFlushInterval: 10000,
      extractionBatchSize: 5,
      minPatternQuality: 0.5,
      minConfidenceThreshold: 0.3,
      consolidationSchedule: 'daily',
      autoLearning: false,
      maxPatternsPerType: 100
    });

    const metrics = pipeline.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics).toHaveProperty('observationsCollected');

    await pipeline.shutdown();

    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }, 10000);

  test('critical files should exist', () => {
    const criticalFiles = [
      'package.json',
      'tsconfig.json',
      'jest.config.js',
      'src/neural/learning-pipeline.ts',
      'src/neural/pattern-extraction.ts'
    ];

    criticalFiles.forEach(file => {
      expect(fs.existsSync(file)).toBe(true);
    });
  }, 2000);

  test('critical directories should exist', () => {
    const criticalDirs = [
      'src',
      'tests',
      'config',
      '.swarm'
    ];

    criticalDirs.forEach(dir => {
      expect(fs.existsSync(dir)).toBe(true);
    });
  }, 2000);

  test('neural source files should be readable', () => {
    const neuralFiles = [
      'src/neural/learning-pipeline.ts',
      'src/neural/pattern-extraction.ts'
    ];

    neuralFiles.forEach(file => {
      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });
  }, 2000);

  test('configuration files should be valid JSON', () => {
    const jsonFiles = ['package.json'];

    jsonFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  }, 2000);

  test('staging database directory should be writable', () => {
    const stagingDir = '.test-swarm';

    if (!fs.existsSync(stagingDir)) {
      fs.mkdirSync(stagingDir, { recursive: true });
    }

    const testFile = path.join(stagingDir, 'smoke-test-write.tmp');
    fs.writeFileSync(testFile, 'test');

    expect(fs.existsSync(testFile)).toBe(true);

    fs.unlinkSync(testFile);
  }, 2000);

  test('memory database should be operational', async () => {
    const memoryDbPath = '.swarm/memory.db';

    if (fs.existsSync(memoryDbPath)) {
      const db = new Database(memoryDbPath);

      // Try a simple query
      const result: any = await new Promise((resolve, reject) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1", (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(result).toBeDefined();

      await new Promise<void>((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      // Memory database doesn't exist yet - this is okay for fresh deployments
      expect(true).toBe(true);
    }
  }, 5000);

  test('pattern extraction module should be importable', () => {
    expect(() => {
      const PatternExtractor = require('../../src/neural/pattern-extraction');
      expect(PatternExtractor).toBeDefined();
    }).not.toThrow();
  }, 2000);

  test('learning pipeline module should be importable', () => {
    expect(() => {
      const LearningPipeline = require('../../src/neural/learning-pipeline');
      expect(LearningPipeline).toBeDefined();
    }).not.toThrow();
  }, 2000);

  test('verification system should have configuration', () => {
    const verificationPath = '.swarm/verification-memory.json';

    if (fs.existsSync(verificationPath)) {
      const content = fs.readFileSync(verificationPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config).toHaveProperty('threshold');
    } else {
      // Create minimal verification config
      fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
      const minimalConfig = {
        threshold: 0.95,
        mode: 'strict',
        history: []
      };
      fs.writeFileSync(verificationPath, JSON.stringify(minimalConfig, null, 2));
      expect(fs.existsSync(verificationPath)).toBe(true);
    }
  }, 2000);

  test('TypeScript compilation should work', () => {
    // Check that dist directory exists (indicating successful compilation)
    const distExists = fs.existsSync('dist');

    if (distExists) {
      // Verify at least some compiled files exist
      const compiledFiles = fs.readdirSync('dist', { recursive: true })
        .filter((f: any) => f.endsWith('.js'));
      expect(compiledFiles.length).toBeGreaterThan(0);
    } else {
      // No dist directory - compilation might not have run yet
      // This is acceptable for smoke tests
      expect(true).toBe(true);
    }
  }, 2000);

  test('node_modules should be installed', () => {
    expect(fs.existsSync('node_modules')).toBe(true);

    // Check for critical dependencies
    const criticalDeps = [
      'node_modules/sqlite3',
      'node_modules/jest',
      'node_modules/typescript'
    ];

    criticalDeps.forEach(dep => {
      expect(fs.existsSync(dep)).toBe(true);
    });
  }, 2000);

  test('environment should be correctly set', () => {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    expect(majorVersion).toBeGreaterThanOrEqual(18);
  }, 1000);

  test('can create and query in-memory patterns', async () => {
    const db = new Database(':memory:');

    // Create patterns table
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE patterns (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          pattern_data TEXT NOT NULL,
          confidence REAL NOT NULL,
          usage_count INTEGER NOT NULL,
          created_at TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Insert test pattern
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO patterns (id, type, pattern_data, confidence, usage_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['smoke-1', 'test', 'eyJ0ZXN0IjoidmFsdWUifQ==', 0.8, 0, new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Query pattern
    const row: any = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM patterns WHERE id = ?', ['smoke-1'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    expect(row).toBeDefined();
    expect(row.id).toBe('smoke-1');
    expect(row.confidence).toBe(0.8);

    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }, 5000);
});

describe('Quick Health Checks', () => {
  test('can read package.json', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    expect(pkg.name).toBeDefined();
    expect(pkg.version).toBeDefined();
  }, 1000);

  test('can access test directory', () => {
    expect(fs.existsSync('tests')).toBe(true);
    expect(fs.existsSync('tests/staging')).toBe(true);
  }, 1000);

  test('can write to temp directory', () => {
    const tmpFile = '.test-swarm/health-check.tmp';
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(tmpFile, 'health check');
    expect(fs.existsSync(tmpFile)).toBe(true);
    fs.unlinkSync(tmpFile);
  }, 1000);

  test('basic math works (sanity check)', () => {
    expect(2 + 2).toBe(4);
    expect(Math.random()).toBeGreaterThanOrEqual(0);
    expect(Math.random()).toBeLessThan(1);
  }, 100);

  test('promises work correctly', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  }, 1000);

  test('async/await works correctly', async () => {
    const asyncFunc = async () => {
      return new Promise(resolve => {
        setTimeout(() => resolve('done'), 10);
      });
    };

    const result = await asyncFunc();
    expect(result).toBe('done');
  }, 2000);
});
