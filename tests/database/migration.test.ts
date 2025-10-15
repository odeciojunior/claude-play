/**
 * Database Migration System Tests
 *
 * Tests the migration system's ability to:
 * - Initialize database schema
 * - Apply migrations idempotently
 * - Track schema versions
 * - Verify integrity
 * - Reset and rebuild
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { DatabaseMigrator } from '../../src/database/migrations/migrate';

const TEST_DB_PATH = path.join(__dirname, '../../.swarm/test-memory.db');

describe('Database Migration System', () => {
  let migrator: DatabaseMigrator;
  let db: Database.Database;

  beforeEach(() => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Initialize migrator with test database
    migrator = new DatabaseMigrator(TEST_DB_PATH);
    db = new Database(TEST_DB_PATH);
  });

  afterEach(() => {
    try {
      migrator.close();
      db.close();
    } catch (error) {
      // Ignore if already closed
    }

    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Initial Migration', () => {
    it('should create database file', async () => {
      await migrator.migrate();

      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('should create schema_version table', async () => {
      await migrator.migrate();

      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should track applied schema versions', async () => {
      await migrator.migrate();

      const versions = db.prepare('SELECT version FROM schema_version').all();

      expect(versions.length).toBeGreaterThan(0);
      expect(versions.some((v: any) => v.version.includes('core'))).toBe(true);
      expect(versions.some((v: any) => v.version.includes('goap'))).toBe(true);
      expect(versions.some((v: any) => v.version.includes('verification'))).toBe(true);
    });
  });

  describe('Core Schema Tables', () => {
    beforeEach(async () => {
      await migrator.migrate();
    });

    it('should create patterns table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='patterns'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create pattern_embeddings table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='pattern_embeddings'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create task_trajectories table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='task_trajectories'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create memory_entries table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_entries'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create metrics_log table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='metrics_log'"
      ).get();

      expect(table).toBeDefined();
    });
  });

  describe('GOAP Schema Tables', () => {
    beforeEach(async () => {
      await migrator.migrate();
    });

    it('should create goap_patterns table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='goap_patterns'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create goap_plans table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='goap_plans'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create goap_execution_outcomes table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='goap_execution_outcomes'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should have proper foreign key constraints', () => {
      // Insert plan with reference to pattern
      db.prepare(`
        INSERT INTO goap_patterns (id, type, goal, initial_state, final_state, action_sequence, cost, context_data, pattern_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('pat-1', 'action_sequence', 'test', '{}', '{}', '[]', 10.0, '{}', '{}');

      db.prepare(`
        INSERT INTO goap_plans (id, actions, total_cost, estimated_time, current_state, goal_state, planning_method, pattern_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('plan-1', '[]', 10.0, 5.0, '{}', '{}', 'pattern_reuse', 'pat-1');

      const plan = db.prepare('SELECT * FROM goap_plans WHERE id = ?').get('plan-1');

      expect(plan).toBeDefined();
      expect((plan as any).pattern_id).toBe('pat-1');
    });
  });

  describe('Verification Schema Tables', () => {
    beforeEach(async () => {
      await migrator.migrate();
    });

    it('should create verification_outcomes table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='verification_outcomes'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create agent_reliability table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_reliability'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create truth_score_predictions table', () => {
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='truth_score_predictions'"
      ).get();

      expect(table).toBeDefined();
    });

    it('should create adaptive_thresholds table with defaults', () => {
      const thresholds = db.prepare('SELECT * FROM adaptive_thresholds').all();

      expect(thresholds.length).toBeGreaterThan(0);

      const coderThreshold = thresholds.find((t: any) => t.agent_type === 'coder' && t.file_type === 'ts');
      expect(coderThreshold).toBeDefined();
      expect((coderThreshold as any).base_threshold).toBe(0.95);
    });

    it('should update agent_reliability on verification outcome', () => {
      // Insert verification outcome
      db.prepare(`
        INSERT INTO verification_outcomes (
          id, task_id, agent_id, agent_type, timestamp,
          passed, truth_score, threshold, duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('vo-1', 'task-1', 'agent-coder-1', 'coder', new Date().toISOString(), 1, 0.97, 0.95, 1000);

      // Check agent_reliability was updated by trigger
      const agent = db.prepare('SELECT * FROM agent_reliability WHERE agent_id = ?').get('agent-coder-1');

      expect(agent).toBeDefined();
      expect((agent as any).total_verifications).toBe(1);
      expect((agent as any).success_count).toBe(1);
      expect((agent as any).avg_truth_score).toBe(0.97);
    });
  });

  describe('Indexes and Performance', () => {
    beforeEach(async () => {
      await migrator.migrate();
    });

    it('should create indexes for patterns table', () => {
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='patterns'"
      ).all();

      expect(indexes.length).toBeGreaterThan(0);

      const indexNames = indexes.map((i: any) => i.name);
      expect(indexNames).toContain('idx_patterns_type');
      expect(indexNames).toContain('idx_patterns_confidence');
    });

    it('should create indexes for goap_patterns table', () => {
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='goap_patterns'"
      ).all();

      expect(indexes.length).toBeGreaterThan(0);

      const indexNames = indexes.map((i: any) => i.name);
      expect(indexNames).toContain('idx_goap_patterns_type');
      expect(indexNames).toContain('idx_goap_patterns_confidence');
    });

    it('should create indexes for verification_outcomes table', () => {
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='verification_outcomes'"
      ).all();

      expect(indexes.length).toBeGreaterThan(0);

      const indexNames = indexes.map((i: any) => i.name);
      expect(indexNames).toContain('idx_verification_outcomes_agent');
      expect(indexNames).toContain('idx_verification_outcomes_task');
    });
  });

  describe('Views', () => {
    beforeEach(async () => {
      await migrator.migrate();
    });

    it('should create pattern effectiveness view', () => {
      const view = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='view' AND name='v_pattern_effectiveness'"
      ).get();

      expect(view).toBeDefined();
    });

    it('should create GOAP planning performance view', () => {
      const view = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='view' AND name='v_goap_planning_performance'"
      ).get();

      expect(view).toBeDefined();
    });

    it('should create agent performance view', () => {
      const view = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='view' AND name='v_agent_performance'"
      ).get();

      expect(view).toBeDefined();
    });
  });

  describe('Idempotency', () => {
    it('should handle running migrations multiple times', async () => {
      // Run migrations twice
      await migrator.migrate();
      await migrator.migrate();

      // Verify schema versions (should not duplicate)
      const versions = db.prepare('SELECT version FROM schema_version').all();

      const coreVersions = versions.filter((v: any) => v.version.includes('core'));
      expect(coreVersions.length).toBe(1);
    });

    it('should not error on existing tables', async () => {
      await migrator.migrate();

      // Run again - should not throw
      await expect(migrator.migrate()).resolves.not.toThrow();
    });
  });

  describe('Reset and Rebuild', () => {
    it('should reset database and rebuild schema', async () => {
      // Initial migration
      await migrator.migrate();

      // Insert test data
      db.prepare(`
        INSERT INTO patterns (id, type, pattern_data, confidence)
        VALUES (?, ?, ?, ?)
      `).run('pat-test', 'test', '{}', 0.8);

      // Reset and rebuild
      migrator.close();
      migrator = new DatabaseMigrator(TEST_DB_PATH);
      await migrator.migrate({ reset: true });

      // Verify data is gone but schema exists
      const patterns = db.prepare('SELECT * FROM patterns').all();
      expect(patterns.length).toBe(0);

      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='patterns'"
      ).get();
      expect(tables).toBeDefined();
    });
  });

  describe('Integrity Verification', () => {
    beforeEach(async () => {
      await migrator.migrate();
    });

    it('should pass integrity verification', async () => {
      await expect(migrator.verify()).resolves.not.toThrow();
    });

    it('should verify foreign key constraints', () => {
      const fkCheck = db.pragma('foreign_key_check');
      expect(fkCheck.length).toBe(0);
    });

    it('should pass SQLite integrity check', () => {
      const integrity = db.pragma('integrity_check');
      expect(integrity).toHaveLength(1);
      expect(integrity[0]).toHaveProperty('integrity_check', 'ok');
    });
  });

  describe('Data Insertion and Retrieval', () => {
    beforeEach(async () => {
      await migrator.migrate();
    });

    it('should insert and retrieve pattern data', () => {
      db.prepare(`
        INSERT INTO patterns (id, type, pattern_data, confidence, usage_count)
        VALUES (?, ?, ?, ?, ?)
      `).run('pat-1', 'coordination', JSON.stringify({ action: 'test' }), 0.85, 5);

      const pattern = db.prepare('SELECT * FROM patterns WHERE id = ?').get('pat-1');

      expect(pattern).toBeDefined();
      expect((pattern as any).type).toBe('coordination');
      expect((pattern as any).confidence).toBe(0.85);
      expect((pattern as any).usage_count).toBe(5);
    });

    it('should insert GOAP pattern with all fields', () => {
      const patternData = {
        id: 'goap-test-1',
        type: 'action_sequence',
        goal: 'deploy_api',
        initial_state: JSON.stringify({ deployed: false }),
        final_state: JSON.stringify({ deployed: true }),
        action_sequence: JSON.stringify([
          { action: 'build', cost: 5 },
          { action: 'test', cost: 3 },
          { action: 'deploy', cost: 7 }
        ]),
        cost: 15.0,
        context_data: JSON.stringify({ env: 'production' }),
        pattern_data: JSON.stringify({ metadata: 'test' })
      };

      db.prepare(`
        INSERT INTO goap_patterns (
          id, type, goal, initial_state, final_state,
          action_sequence, cost, context_data, pattern_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(...Object.values(patternData));

      const pattern = db.prepare('SELECT * FROM goap_patterns WHERE id = ?').get('goap-test-1');

      expect(pattern).toBeDefined();
      expect((pattern as any).goal).toBe('deploy_api');
      expect((pattern as any).cost).toBe(15.0);
    });

    it('should insert verification outcome and trigger updates', () => {
      db.prepare(`
        INSERT INTO verification_outcomes (
          id, task_id, agent_id, agent_type, timestamp,
          passed, truth_score, threshold, duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('vo-test', 'task-test', 'agent-test', 'coder', new Date().toISOString(), 1, 0.95, 0.95, 1500);

      // Check trigger updated agent_reliability
      const agent = db.prepare('SELECT * FROM agent_reliability WHERE agent_id = ?').get('agent-test');

      expect(agent).toBeDefined();
      expect((agent as any).total_verifications).toBe(1);
      expect((agent as any).reliability).toBe(1);
    });
  });
});
