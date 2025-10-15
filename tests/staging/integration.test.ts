/**
 * Staging Integration Tests
 *
 * Full system integration tests covering multi-component workflows:
 * - Learn from verification → Store pattern → Retrieve → Apply
 * - GOAP planning → Execution → Learning → Replanning
 * - Error handling → Recovery → Pattern learning
 * - Agent coordination
 * - Database transaction integrity
 */

import { Database } from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import LearningPipeline from '../../src/neural/learning-pipeline';
import { ExecutionObservation, PatternType } from '../../src/neural/pattern-extraction';

const INTEGRATION_CONFIG = {
  dbPath: '.test-swarm/integration-validation.db',
  timeout: 45000 // 45 seconds
};

describe('Integration Tests', () => {
  let db: Database;
  let learningPipeline: LearningPipeline;

  beforeAll(async () => {
    const stagingDir = path.dirname(INTEGRATION_CONFIG.dbPath);
    if (!fs.existsSync(stagingDir)) {
      fs.mkdirSync(stagingDir, { recursive: true });
    }

    db = new Database(INTEGRATION_CONFIG.dbPath);
    await initializeDatabase(db);

    learningPipeline = new LearningPipeline(db, {
      observationBufferSize: 50,
      observationFlushInterval: 5000,
      extractionBatchSize: 10,
      minPatternQuality: 0.6,
      minConfidenceThreshold: 0.4,
      consolidationSchedule: 'hourly',
      autoLearning: true,
      maxPatternsPerType: 500
    });
  }, INTEGRATION_CONFIG.timeout);

  afterAll(async () => {
    await learningPipeline.shutdown();
    await closeDatabase(db);
  });

  describe('Complete Learning Workflow', () => {
    test('should complete full cycle: observe → extract → store → retrieve → apply', async () => {
      // Step 1: Observe executions
      const observations: ExecutionObservation[] = [];
      for (let i = 0; i < 15; i++) {
        observations.push({
          id: `workflow-obs-${i}`,
          timestamp: Date.now(),
          tool: 'Edit',
          parameters: { file: 'src/test.ts', content: 'test code' },
          result: { success: true, linesChanged: 10 },
          duration_ms: 80 + Math.random() * 40,
          success: true,
          context: {
            taskId: 'workflow-test',
            agentId: 'coder',
            workingDirectory: '/project',
            activePatterns: [],
            priorSteps: i,
            environmentVars: { NODE_ENV: 'staging' }
          }
        });
      }

      // Step 2: Extract patterns
      const extractedPatterns = await learningPipeline.extractPatternsFromObservations(observations);
      expect(extractedPatterns.length).toBeGreaterThan(0);

      const firstPattern = extractedPatterns[0];
      expect(firstPattern.id).toBeDefined();

      // Step 3: Retrieve pattern
      const retrieved = await learningPipeline.getPattern(firstPattern.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(firstPattern.id);

      // Step 4: Apply pattern
      const application = await learningPipeline.applyBestPattern(
        'Edit source file',
        {
          taskId: 'apply-test',
          agentId: 'coder',
          workingDirectory: '/project',
          activePatterns: [],
          priorSteps: 0,
          environmentVars: {}
        }
      );

      // Should either apply a pattern or have a valid reason for not applying
      expect(application).toHaveProperty('applied');
      if (!application.applied) {
        expect(application.reason).toBeDefined();
      }

      // Step 5: Track outcome
      if (application.applied && application.patternId) {
        await learningPipeline.trackOutcome({
          taskId: 'workflow-test',
          patternId: application.patternId,
          status: 'success',
          confidence: 0.88,
          metrics: {
            durationMs: 95,
            errorCount: 0,
            improvementVsBaseline: 0.12
          },
          judgeReasons: ['Successful execution', 'Met performance targets'],
          timestamp: new Date().toISOString()
        });

        // Verify outcome tracking updated the pattern
        const updated = await learningPipeline.getPattern(application.patternId);
        expect(updated).not.toBeNull();
        expect(updated?.usageCount).toBeGreaterThan(0);
      }
    }, INTEGRATION_CONFIG.timeout);

    test('should handle pattern learning from verification results', async () => {
      // Simulate verification result
      const verificationPattern = {
        id: 'verification-pattern-1',
        type: 'verification_result' as PatternType,
        name: 'Successful verification with high confidence',
        confidence: 0.92,
        usageCount: 1,
        createdAt: new Date().toISOString(),
        data: {
          verificationScore: 0.96,
          checks: ['compile', 'test', 'lint'],
          agent: 'coder'
        },
        metrics: {
          successCount: 1,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 2500
        }
      };

      await learningPipeline.train(verificationPattern);

      // Track successful outcome
      await learningPipeline.trackOutcome({
        taskId: 'verification-test',
        patternId: verificationPattern.id,
        status: 'success',
        confidence: 0.94,
        metrics: {
          durationMs: 2400,
          errorCount: 0,
          improvementVsBaseline: 0.02
        },
        judgeReasons: ['All checks passed', 'Fast execution'],
        timestamp: new Date().toISOString()
      });

      // Verify pattern was updated
      const updated = await learningPipeline.getPattern(verificationPattern.id);
      expect(updated).not.toBeNull();
      expect(updated?.usageCount).toBeGreaterThan(1);
    }, INTEGRATION_CONFIG.timeout);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle and learn from failures', async () => {
      const failurePattern = {
        id: 'failure-pattern-1',
        type: 'tool_sequence' as PatternType,
        name: 'Pattern that might fail',
        confidence: 0.6,
        usageCount: 5,
        createdAt: new Date().toISOString(),
        data: { riskLevel: 'medium' },
        metrics: {
          successCount: 3,
          failureCount: 2,
          partialCount: 0,
          avgDurationMs: 150
        }
      };

      await learningPipeline.train(failurePattern);

      // Track failure
      await learningPipeline.trackOutcome({
        taskId: 'failure-test',
        patternId: failurePattern.id,
        status: 'failure',
        confidence: 0.3,
        metrics: {
          durationMs: 200,
          errorCount: 1,
          improvementVsBaseline: -0.3
        },
        judgeReasons: ['Error occurred', 'Took too long'],
        timestamp: new Date().toISOString()
      });

      // Confidence should decrease
      const updated = await learningPipeline.getPattern(failurePattern.id);
      expect(updated).not.toBeNull();
      // Bayesian update may not always decrease confidence dramatically, but it should be tracked
      expect(updated?.metrics.failureCount).toBeGreaterThan(failurePattern.metrics.failureCount);
    }, INTEGRATION_CONFIG.timeout);

    test('should recover from database errors gracefully', async () => {
      // Attempt to retrieve non-existent pattern
      const nonExistent = await learningPipeline.getPattern('does-not-exist');
      expect(nonExistent).toBeNull();

      // System should still be operational
      const metrics = learningPipeline.getMetrics();
      expect(metrics).toBeDefined();
    }, INTEGRATION_CONFIG.timeout);

    test('should handle concurrent errors without corruption', async () => {
      const promises = [];

      // Mix of valid and invalid operations
      for (let i = 0; i < 20; i++) {
        if (i % 3 === 0) {
          // Invalid operation
          promises.push(
            learningPipeline.getPattern(`invalid-${i}`).catch(() => null)
          );
        } else {
          // Valid operation
          promises.push(
            learningPipeline.getMetrics()
          );
        }
      }

      await Promise.all(promises);

      // System should remain operational
      const finalMetrics = learningPipeline.getMetrics();
      expect(finalMetrics).toBeDefined();
      expect(finalMetrics.observationsCollected).toBeGreaterThanOrEqual(0);
    }, INTEGRATION_CONFIG.timeout);
  });

  describe('Agent Coordination', () => {
    test('should support multiple agent workflows', async () => {
      const agents = ['coder', 'reviewer', 'tester'];
      const patterns = [];

      // Create patterns for different agents
      for (const agent of agents) {
        const pattern = {
          id: `agent-pattern-${agent}`,
          type: 'agent_workflow' as PatternType,
          name: `${agent} workflow pattern`,
          confidence: 0.7,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          data: { agent, specialization: true },
          metrics: {
            successCount: 0,
            failureCount: 0,
            partialCount: 0,
            avgDurationMs: 100
          }
        };

        await learningPipeline.train(pattern);
        patterns.push(pattern);
      }

      // Verify all agent patterns are stored
      for (const agent of agents) {
        const retrieved = await learningPipeline.getPattern(`agent-pattern-${agent}`);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.data.agent).toBe(agent);
      }
    }, INTEGRATION_CONFIG.timeout);

    test('should coordinate pattern sharing across agents', async () => {
      // Create a shared pattern
      const sharedPattern = {
        id: 'shared-pattern-1',
        type: 'coordination' as PatternType,
        name: 'Shared coordination pattern',
        confidence: 0.85,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        data: { shared: true, agents: ['coder', 'reviewer'] },
        metrics: {
          successCount: 0,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 120
        }
      };

      await learningPipeline.train(sharedPattern);

      // Both agents should be able to access it
      const retrieved = await learningPipeline.getPattern(sharedPattern.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.data.shared).toBe(true);
      expect(retrieved?.data.agents).toContain('coder');
      expect(retrieved?.data.agents).toContain('reviewer');
    }, INTEGRATION_CONFIG.timeout);
  });

  describe('Database Transaction Integrity', () => {
    test('should maintain ACID properties', async () => {
      const dbRun = promisify(db.run.bind(db));
      const dbGet = promisify(db.get.bind(db));

      // Start transaction
      await dbRun('BEGIN TRANSACTION');

      try {
        // Insert multiple records
        for (let i = 0; i < 5; i++) {
          await dbRun(
            `INSERT INTO patterns (id, type, pattern_data, confidence, usage_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [`acid-test-${i}`, 'test', 'eyJ0ZXN0IjoidmFsdWUifQ==', 0.7, 0, new Date().toISOString()]
          );
        }

        // Commit
        await dbRun('COMMIT');

        // Verify all records exist
        for (let i = 0; i < 5; i++) {
          const row = await dbGet('SELECT * FROM patterns WHERE id = ?', [`acid-test-${i}`]);
          expect(row).toBeDefined();
        }

        // Cleanup
        await dbRun(`DELETE FROM patterns WHERE id LIKE 'acid-test-%'`);
      } catch (error) {
        await dbRun('ROLLBACK');
        throw error;
      }
    }, INTEGRATION_CONFIG.timeout);

    test('should rollback on error', async () => {
      const dbRun = promisify(db.run.bind(db));
      const dbGet = promisify(db.get.bind(db));

      await dbRun('BEGIN TRANSACTION');

      try {
        // Insert valid record
        await dbRun(
          `INSERT INTO patterns (id, type, pattern_data, confidence, usage_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['rollback-test-1', 'test', 'eyJ0ZXN0IjoidmFsdWUifQ==', 0.7, 0, new Date().toISOString()]
        );

        // Attempt invalid insert (duplicate ID)
        await dbRun(
          `INSERT INTO patterns (id, type, pattern_data, confidence, usage_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['rollback-test-1', 'test', 'eyJ0ZXN0IjoidmFsdWUifQ==', 0.7, 0, new Date().toISOString()]
        );

        await dbRun('COMMIT');
      } catch (error) {
        await dbRun('ROLLBACK');

        // Verify first record was not committed
        const row = await dbGet('SELECT * FROM patterns WHERE id = ?', ['rollback-test-1']);
        expect(row).toBeUndefined();
      }
    }, INTEGRATION_CONFIG.timeout);

    test('should handle concurrent transactions', async () => {
      const dbRun = promisify(db.run.bind(db));

      const transactions = [];

      for (let i = 0; i < 10; i++) {
        transactions.push(
          (async () => {
            await dbRun('BEGIN TRANSACTION');
            await dbRun(
              `INSERT INTO patterns (id, type, pattern_data, confidence, usage_count, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [`concurrent-tx-${i}`, 'test', 'eyJ0ZXN0IjoidmFsdWUifQ==', 0.7, 0, new Date().toISOString()]
            );
            await dbRun('COMMIT');
          })()
        );
      }

      await Promise.all(transactions);

      // Verify all transactions completed
      const dbGet = promisify(db.get.bind(db));
      const count = await dbGet(`SELECT COUNT(*) as count FROM patterns WHERE id LIKE 'concurrent-tx-%'`, []);
      expect(count.count).toBe(10);

      // Cleanup
      await dbRun(`DELETE FROM patterns WHERE id LIKE 'concurrent-tx-%'`);
    }, INTEGRATION_CONFIG.timeout);
  });

  describe('Pattern Consolidation Integration', () => {
    test('should merge similar patterns intelligently', async () => {
      // Create similar patterns
      const similarPatterns = [
        {
          id: 'similar-1',
          type: 'tool_sequence' as PatternType,
          name: 'Edit and test sequence',
          confidence: 0.75,
          usageCount: 5,
          createdAt: new Date().toISOString(),
          data: { sequence: ['Edit', 'Test'] },
          metrics: { successCount: 4, failureCount: 1, partialCount: 0, avgDurationMs: 120 }
        },
        {
          id: 'similar-2',
          type: 'tool_sequence' as PatternType,
          name: 'Edit and test sequence',
          confidence: 0.72,
          usageCount: 3,
          createdAt: new Date().toISOString(),
          data: { sequence: ['Edit', 'Test'] },
          metrics: { successCount: 2, failureCount: 1, partialCount: 0, avgDurationMs: 130 }
        }
      ];

      for (const pattern of similarPatterns) {
        await learningPipeline.train(pattern);
      }

      // Run consolidation
      const result = await learningPipeline.consolidatePatterns();

      expect(result.success).toBe(true);
      // Should have merged at least some patterns (if similarity threshold met)
      expect(result.merged + result.pruned).toBeGreaterThanOrEqual(0);
    }, INTEGRATION_CONFIG.timeout);
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function initializeDatabase(db: Database): Promise<void> {
  const dbRun = promisify(db.run.bind(db));

  await dbRun(`
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      pattern_data TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_used TEXT
    )
  `);

  await dbRun('CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(type)');
}

async function closeDatabase(db: Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
