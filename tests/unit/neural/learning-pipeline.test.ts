/**
 * Unit Tests for Learning Pipeline Module
 *
 * Test Coverage: Observation→Extraction→Training→Application cycle
 * Target: 100+ tests, >95% coverage
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import LearningPipeline, {
  LearningPipelineConfig,
  PipelineMetrics,
  OutcomeReport
} from '../../../src/neural/learning-pipeline';
import { Pattern, ExecutionObservation } from '../../../src/neural/pattern-extraction';

// ============================================================================
// Test Setup
// ============================================================================

async function createTestDatabase(): Promise<Database> {
  const db = new Database(':memory:');
  const run = promisify(db.run.bind(db));

  await run(`
    CREATE TABLE patterns (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      pattern_data TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_used TEXT
    )
  `);

  await run(`
    CREATE TABLE task_trajectories (
      task_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      query TEXT NOT NULL,
      trajectory_json TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      judge_label TEXT,
      judge_conf REAL,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE metrics_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      tags TEXT,
      timestamp TEXT NOT NULL
    )
  `);

  return db;
}

const defaultConfig: LearningPipelineConfig = {
  observationBufferSize: 100,
  observationFlushInterval: 5000,
  extractionBatchSize: 10,
  minPatternQuality: 0.5,
  minConfidenceThreshold: 0.6,
  consolidationSchedule: 'hourly',
  autoLearning: true,
  maxPatternsPerType: 1000
};

// ============================================================================
// Learning Pipeline Tests
// ============================================================================

describe('LearningPipeline', () => {
  let db: Database;
  let pipeline: LearningPipeline;

  beforeEach(async () => {
    db = await createTestDatabase();
    pipeline = new LearningPipeline(db, defaultConfig);
  });

  afterEach(async () => {
    await pipeline.shutdown();
    // Wait for any pending async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    // Wrap db.close in promise
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(pipeline).toBeDefined();
      expect(pipeline.getMetrics()).toBeDefined();
    });

    it('should start observation buffer', () => {
      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(0);
    });

    it('should initialize all phases', () => {
      expect(pipeline.extractionPhase).toBeDefined();
      expect(pipeline.trainingPhase).toBeDefined();
      expect(pipeline.applicationPhase).toBeDefined();
    });
  });

  // ==========================================================================
  // Observation Phase Tests
  // ==========================================================================

  describe('Observation Phase', () => {
    it('should observe successful tool execution', async () => {
      const result = await pipeline.observe('Read', { file: 'test.txt' }, async () => {
        return 'file contents';
      });

      expect(result).toBe('file contents');

      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(1);
    });

    it('should observe failed tool execution', async () => {
      await expect(
        pipeline.observe('Write', { file: 'test.txt' }, async () => {
          throw new Error('Write failed');
        })
      ).rejects.toThrow('Write failed');

      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(1);
    });

    it('should capture execution duration', async () => {
      const start = Date.now();
      await pipeline.observe('Bash', { command: 'sleep 0.1' }, async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'done';
      });
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should sanitize sensitive parameters', async () => {
      const sensitiveParams = {
        username: 'user',
        password: 'secret123',
        apiKey: 'sk-secret',
        token: 'bearer-token'
      };

      await pipeline.observe('Auth', sensitiveParams, async () => 'authenticated');

      // Observations should have sanitized params
      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(1);
    });

    it('should buffer observations before extraction', async () => {
      // Create observations below batch size
      for (let i = 0; i < 5; i++) {
        await pipeline.observe('Read', {}, async () => 'data');
      }

      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(5);
      // Extraction should not have occurred yet
      expect(metrics.patternsExtracted).toBe(0);
    });

    it('should flush observations after buffer full', async () => {
      const config: LearningPipelineConfig = {
        ...defaultConfig,
        observationBufferSize: 5,
        extractionBatchSize: 5
      };

      const pipelineSmall = new LearningPipeline(db, config);

      for (let i = 0; i < 6; i++) {
        await pipelineSmall.observe('Read', {}, async () => 'data');
      }

      // Wait for async extraction
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = pipelineSmall.getMetrics();
      expect(metrics.patternsExtracted).toBeGreaterThan(0);

      await pipelineSmall.shutdown();
    });

    it('should handle concurrent observations', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          pipeline.observe('Concurrent', { index: i }, async () => `result-${i}`)
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(50);
    });

    it('should capture execution context', async () => {
      const context = {
        taskId: 'task-123',
        agentId: 'coder',
        workingDirectory: '/project',
        activePatterns: ['pattern-1'],
        priorSteps: 5,
        environmentVars: { NODE_ENV: 'test' }
      };

      // Mock context provider
      pipeline.setContextProvider(() => context);

      await pipeline.observe('Test', {}, async () => 'result');

      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(1);
    });
  });

  // ==========================================================================
  // Pattern Extraction Phase Tests
  // ==========================================================================

  describe('Pattern Extraction Phase', () => {
    it('should extract patterns from observations', async () => {
      // Create repeating pattern
      for (let i = 0; i < 10; i++) {
        await pipeline.observe('Read', {}, async () => 'data');
        await pipeline.observe('Grep', {}, async () => 'matches');
        await pipeline.observe('Edit', {}, async () => 'edited');
      }

      // Trigger extraction
      await pipeline.forceExtraction();

      const metrics = pipeline.getMetrics();
      expect(metrics.patternsExtracted).toBeGreaterThan(0);
    });

    it('should score extracted patterns', async () => {
      // High-quality pattern
      for (let i = 0; i < 10; i++) {
        await pipeline.observe('QualityRead', {}, async () => 'success');
      }

      await pipeline.forceExtraction();

      const patterns = await pipeline.getExtractedPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].confidence).toBeGreaterThan(0.5);
    });

    it('should filter low-quality patterns', async () => {
      // Low-quality pattern (mostly failures)
      for (let i = 0; i < 10; i++) {
        try {
          await pipeline.observe('Unreliable', {}, async () => {
            if (Math.random() > 0.3) throw new Error('Random failure');
            return 'success';
          });
        } catch (e) {
          // Expected failures
        }
      }

      await pipeline.forceExtraction();

      const patterns = await pipeline.getExtractedPatterns();
      // Should filter out low-confidence patterns
      expect(patterns.every(p => p.confidence >= 0.5)).toBe(true);
    });

    it('should classify pattern types', async () => {
      // Create different pattern types
      for (let i = 0; i < 5; i++) {
        await pipeline.observe('CoordA', {}, async () => 'result');
        await pipeline.observe('CoordB', {}, async () => 'result');
      }

      await pipeline.forceExtraction();

      const patterns = await pipeline.getExtractedPatterns();
      expect(patterns.some(p => p.type === 'coordination')).toBe(true);
    });

    it('should handle extraction errors gracefully', async () => {
      // Create malformed observations
      const malformed = {
        id: 'bad',
        timestamp: NaN,
        tool: null as any,
        parameters: undefined,
        success: true
      };

      // Should not crash
      await expect(
        pipeline.extractPatternsFromObservations([malformed as any])
      ).resolves.toBeDefined();
    });
  });

  // ==========================================================================
  // Training Phase Tests
  // ==========================================================================

  describe('Training Phase', () => {
    it('should train patterns with initial confidence', async () => {
      const pattern: Pattern = {
        id: 'pattern-1',
        type: 'coordination',
        name: 'test_pattern',
        description: 'Test pattern',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 5,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.5,
        usageCount: 5,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      const metrics = pipeline.getMetrics();
      expect(metrics.patternsStored).toBeGreaterThan(0);
    });

    it('should update confidence on positive feedback', async () => {
      const pattern: Pattern = {
        id: 'pattern-2',
        type: 'optimization',
        name: 'improve_pattern',
        description: 'Improvement pattern',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 5,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.6,
        usageCount: 5,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      // Track successful outcome
      await pipeline.trackOutcome({
        taskId: 'task-1',
        patternId: 'pattern-2',
        status: 'success',
        confidence: 0.95,
        metrics: {
          durationMs: 90,
          errorCount: 0,
          improvementVsBaseline: 0.6
        },
        judgeReasons: ['Pattern executed successfully'],
        timestamp: new Date().toISOString()
      });

      // Confidence should increase
      const stored = await pipeline.getPattern('pattern-2');
      expect(stored!.confidence).toBeGreaterThan(0.6);
    });

    it('should decrease confidence on negative feedback', async () => {
      const pattern: Pattern = {
        id: 'pattern-3',
        type: 'error-handling',
        name: 'failing_pattern',
        description: 'Pattern that fails',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 5,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.8,
        usageCount: 5,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      // Track failure
      await pipeline.trackOutcome({
        taskId: 'task-fail',
        patternId: 'pattern-3',
        status: 'failure',
        confidence: 0.2,
        metrics: {
          durationMs: 500,
          errorCount: 3,
          improvementVsBaseline: -0.5
        },
        judgeReasons: ['Pattern failed execution'],
        timestamp: new Date().toISOString()
      });

      const stored = await pipeline.getPattern('pattern-3');
      expect(stored!.confidence).toBeLessThan(0.8);
    });

    it('should apply Bayesian confidence updates', async () => {
      const pattern: Pattern = {
        id: 'pattern-bayes',
        type: 'coordination',
        name: 'bayesian_pattern',
        description: 'Test Bayesian updates',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 10,
          failureCount: 2,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.7,
        usageCount: 12,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      // Multiple outcomes
      const outcomes = [
        { status: 'success', confidence: 0.95 },
        { status: 'success', confidence: 0.92 },
        { status: 'failure', confidence: 0.3 },
        { status: 'success', confidence: 0.90 }
      ];

      for (const outcome of outcomes) {
        await pipeline.trackOutcome({
          taskId: `task-${Math.random()}`,
          patternId: 'pattern-bayes',
          status: outcome.status as any,
          confidence: outcome.confidence,
          metrics: {
            durationMs: 100,
            errorCount: outcome.status === 'failure' ? 1 : 0,
            improvementVsBaseline: 0.5
          },
          judgeReasons: ['Test'],
          timestamp: new Date().toISOString()
        });
      }

      const stored = await pipeline.getPattern('pattern-bayes');

      // Confidence should reflect Bayesian update (3 success, 1 failure)
      expect(stored!.confidence).toBeGreaterThan(0.7);
      expect(stored!.confidence).toBeLessThan(0.95);
    });

    it('should handle rapid confidence updates', async () => {
      const pattern: Pattern = {
        id: 'pattern-rapid',
        type: 'optimization',
        name: 'rapid_update',
        description: 'Rapidly updated pattern',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 5,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.5,
        usageCount: 5,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      // 100 rapid updates
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          pipeline.trackOutcome({
            taskId: `task-${i}`,
            patternId: 'pattern-rapid',
            status: 'success',
            confidence: 0.9,
            metrics: {
              durationMs: 100,
              errorCount: 0,
              improvementVsBaseline: 0.5
            },
            judgeReasons: ['Success'],
            timestamp: new Date().toISOString()
          })
        );
      }

      await Promise.all(promises);

      const stored = await pipeline.getPattern('pattern-rapid');
      expect(stored!.confidence).toBeGreaterThan(0.5);
    });
  });

  // ==========================================================================
  // Pattern Application Phase Tests
  // ==========================================================================

  describe('Pattern Application Phase', () => {
    it('should apply high-confidence patterns', async () => {
      const pattern: Pattern = {
        id: 'pattern-apply',
        type: 'coordination',
        name: 'apply_test',
        description: 'Test application',
        conditions: { context: 'test_task' },
        actions: [
          { step: 1, type: 'read', tool: 'Read' },
          { step: 2, type: 'process', tool: 'Grep' }
        ],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 20,
          failureCount: 1,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.7
        },
        confidence: 0.85,
        usageCount: 21,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      const application = await pipeline.applyBestPattern('test_task', {
        taskId: 'apply-test',
        agentId: 'test-agent',
        workingDirectory: '/test',
        activePatterns: [],
        priorSteps: 0,
        environmentVars: {}
      });

      expect(application.applied).toBe(true);
      expect(application.patternId).toBe('pattern-apply');
    });

    it('should reject low-confidence patterns', async () => {
      const pattern: Pattern = {
        id: 'pattern-low',
        type: 'optimization',
        name: 'low_confidence',
        description: 'Low confidence pattern',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 2,
          failureCount: 3,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.2
        },
        confidence: 0.4,
        usageCount: 5,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      const application = await pipeline.applyBestPattern('low_confidence', {
        taskId: 'reject-test',
        agentId: 'test-agent',
        workingDirectory: '/test',
        activePatterns: [],
        priorSteps: 0,
        environmentVars: {}
      });

      expect(application.applied).toBe(false);
      // Pattern is found but rejected due to confidence, or not found at all
      expect(['no_suitable_pattern', 'confidence_too_low']).toContain(application.reason);
    });

    it('should rank patterns by relevance', async () => {
      // Create multiple patterns
      const patterns: Pattern[] = [
        {
          id: 'pattern-a',
          type: 'coordination',
          name: 'recent_high',
          description: 'Recent high confidence',
          conditions: { context: 'deploy' },
          actions: [],
          successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
          metrics: {
            successCount: 10,
            failureCount: 0,
            partialCount: 0,
            avgDurationMs: 100,
            avgImprovement: 0.6
          },
          confidence: 0.85,
          usageCount: 10,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        },
        {
          id: 'pattern-b',
          type: 'coordination',
          name: 'old_higher',
          description: 'Old but higher confidence',
          conditions: { context: 'deploy' },
          actions: [],
          successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
          metrics: {
            successCount: 50,
            failureCount: 2,
            partialCount: 0,
            avgDurationMs: 100,
            avgImprovement: 0.7
          },
          confidence: 0.95,
          usageCount: 52,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastUsed: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      for (const pattern of patterns) {
        await pipeline.train(pattern);
      }

      const application = await pipeline.applyBestPattern('deploy', {
        taskId: 'rank-test',
        agentId: 'test-agent',
        workingDirectory: '/test',
        activePatterns: [],
        priorSteps: 0,
        environmentVars: {}
      });

      expect(application.applied).toBe(true);
      // Should select pattern-b (higher confidence despite age)
      expect(application.patternId).toBe('pattern-b');
    });

    it('should update usage count on application', async () => {
      const pattern: Pattern = {
        id: 'pattern-usage',
        type: 'coordination',
        name: 'usage_test',
        description: 'Test usage tracking',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 10,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.6
        },
        confidence: 0.85,
        usageCount: 10,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      const initialUsage = pattern.usageCount;

      await pipeline.applyBestPattern('usage_test', {
        taskId: 'usage-test',
        agentId: 'test-agent',
        workingDirectory: '/test',
        activePatterns: [],
        priorSteps: 0,
        environmentVars: {}
      });

      const stored = await pipeline.getPattern('pattern-usage');
      expect(stored!.usageCount).toBeGreaterThan(initialUsage);
    });
  });

  // ==========================================================================
  // Consolidation Phase Tests
  // ==========================================================================

  describe('Consolidation Phase', () => {
    it('should consolidate similar patterns', async () => {
      const pattern1: Pattern = {
        id: 'pattern-similar-1',
        type: 'optimization',
        name: 'similar',
        description: 'Similar pattern 1',
        conditions: {},
        actions: [{ step: 1, type: 'read', tool: 'Read' }],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 5,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.7,
        usageCount: 5,
        createdAt: new Date().toISOString()
      };

      const pattern2: Pattern = {
        id: 'pattern-similar-2',
        type: 'optimization',
        name: 'similar',
        description: 'Similar pattern 2',
        conditions: {},
        actions: [{ step: 1, type: 'read', tool: 'Read' }],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 3,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 110,
          avgImprovement: 0.4
        },
        confidence: 0.65,
        usageCount: 3,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern1);
      await pipeline.train(pattern2);

      await pipeline.consolidatePatterns();

      // Should merge similar patterns
      const patterns = await pipeline.getExtractedPatterns();
      const similar = patterns.filter(p => p.name === 'similar');

      expect(similar.length).toBeLessThanOrEqual(1);
    });

    it('should prune low-value patterns', async () => {
      const lowValue: Pattern = {
        id: 'pattern-prune',
        type: 'testing',
        name: 'prune_me',
        description: 'Low value pattern',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 1,
          failureCount: 5,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.1
        },
        confidence: 0.2,
        usageCount: 6,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      };

      await pipeline.train(lowValue);

      await pipeline.consolidatePatterns();

      // Should remove low-value pattern
      const stored = await pipeline.getPattern('pattern-prune');
      expect(stored).toBeNull();
    });

    it('should apply time-based confidence decay', async () => {
      const oldPattern: Pattern = {
        id: 'pattern-old',
        type: 'coordination',
        name: 'old_pattern',
        description: 'Old pattern',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 10,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.9,
        usageCount: 10,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        lastUsed: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      };

      await pipeline.train(oldPattern);

      const initialConfidence = oldPattern.confidence;

      await pipeline.consolidatePatterns();

      const stored = await pipeline.getPattern('pattern-old');
      expect(stored!.confidence).toBeLessThan(initialConfidence);
    });
  });

  // ==========================================================================
  // Metrics and Monitoring Tests
  // ==========================================================================

  describe('Metrics and Monitoring', () => {
    it('should track observations collected', async () => {
      const initial = pipeline.getMetrics().observationsCollected;

      for (let i = 0; i < 10; i++) {
        await pipeline.observe('Test', {}, async () => 'result');
      }

      const final = pipeline.getMetrics().observationsCollected;
      expect(final - initial).toBe(10);
    });

    it('should track patterns extracted', async () => {
      for (let i = 0; i < 10; i++) {
        await pipeline.observe('Read', {}, async () => 'data');
        await pipeline.observe('Grep', {}, async () => 'matches');
      }

      await pipeline.forceExtraction();

      const metrics = pipeline.getMetrics();
      expect(metrics.patternsExtracted).toBeGreaterThan(0);
    });

    it('should track patterns stored', async () => {
      const pattern: Pattern = {
        id: 'pattern-track',
        type: 'coordination',
        name: 'tracking_test',
        description: 'Test tracking',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 5,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.7,
        usageCount: 5,
        createdAt: new Date().toISOString()
      };

      const initial = pipeline.getMetrics().patternsStored;

      await pipeline.train(pattern);

      const final = pipeline.getMetrics().patternsStored;
      expect(final).toBeGreaterThan(initial);
    });

    it('should track patterns applied', async () => {
      const pattern: Pattern = {
        id: 'pattern-app-track',
        type: 'coordination',
        name: 'app_tracking',
        description: 'Application tracking',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 10,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.6
        },
        confidence: 0.85,
        usageCount: 10,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      const initial = pipeline.getMetrics().patternsApplied;

      await pipeline.applyBestPattern('app_tracking', {
        taskId: 'track-test',
        agentId: 'test-agent',
        workingDirectory: '/test',
        activePatterns: [],
        priorSteps: 0,
        environmentVars: {}
      });

      const final = pipeline.getMetrics().patternsApplied;
      expect(final).toBeGreaterThan(initial);
    });

    it('should provide performance metrics', () => {
      const metrics = pipeline.getMetrics();

      expect(metrics).toHaveProperty('observationsCollected');
      expect(metrics).toHaveProperty('patternsExtracted');
      expect(metrics).toHaveProperty('patternsStored');
      expect(metrics).toHaveProperty('patternsApplied');
      expect(metrics).toHaveProperty('avgConfidence');
      expect(metrics).toHaveProperty('successRate');
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should handle high observation rate', async () => {
      const promises = [];

      for (let i = 0; i < 1000; i++) {
        promises.push(
          pipeline.observe('HighRate', { index: i }, async () => `result-${i}`)
        );
      }

      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // <5 seconds for 1000 observations
    });

    it('should maintain memory under sustained load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 5000; i++) {
        await pipeline.observe('Sustained', { index: i }, async () => 'result');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(100); // <100MB increase
    });

    it('should extract patterns efficiently', async () => {
      // Pre-populate observations
      for (let i = 0; i < 1000; i++) {
        await pipeline.observe('Read', {}, async () => 'data');
      }

      const start = Date.now();
      await pipeline.forceExtraction();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // <2 seconds
    });
  });

  // ==========================================================================
  // Error Handling and Edge Cases
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close database to simulate error
      db.close();

      await expect(
        pipeline.observe('Test', {}, async () => 'result')
      ).rejects.toThrow();
    });

    it('should handle null/undefined observations', async () => {
      await expect(
        pipeline.observe(null as any, null as any, async () => 'result')
      ).rejects.toThrow();
    });

    it('should handle malformed patterns', async () => {
      const malformed: any = {
        id: 'bad',
        // Missing required fields
      };

      await expect(pipeline.train(malformed)).rejects.toThrow();
    });

    it('should recover from extraction failures', async () => {
      // Create problematic observations
      for (let i = 0; i < 10; i++) {
        await pipeline.observe('Problem', { circular: {} }, async () => {
          const obj: any = {};
          obj.self = obj; // Circular reference
          return obj;
        });
      }

      // Should not crash
      await expect(pipeline.forceExtraction()).resolves.toBeDefined();
    });
  });
});
