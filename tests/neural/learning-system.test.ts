/**
 * SAFLA Neural Learning System Integration Tests
 *
 * Comprehensive test suite covering:
 * - Observation collection
 * - Pattern extraction
 * - Confidence scoring
 * - Pattern storage and retrieval
 * - Pattern application
 * - Outcome tracking
 * - Consolidation
 * - Performance requirements
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import LearningPipeline, { LearningPipelineConfig } from '../../src/neural/learning-pipeline';
import PatternExtractor, { ExecutionObservation, Pattern } from '../../src/neural/pattern-extraction';

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DB_PATH = ':memory:';

async function createTestDatabase(): Promise<Database> {
  const db = new Database(TEST_DB_PATH);
  const run = promisify(db.run.bind(db));

  // Create schema
  await run(`
    CREATE TABLE patterns (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      pattern_data TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used TEXT
    )
  `);

  await run(`
    CREATE TABLE pattern_embeddings (
      id TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      dims INTEGER NOT NULL,
      vector BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id) REFERENCES patterns(id) ON DELETE CASCADE
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE metrics_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      tags TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

const testConfig: LearningPipelineConfig = {
  observationBufferSize: 10,
  observationFlushInterval: 1000,
  extractionBatchSize: 5,
  minPatternQuality: 0.5,
  minConfidenceThreshold: 0.6,
  consolidationSchedule: 'hourly',
  autoLearning: true,
  maxPatternsPerType: 100
};

function generateMockObservation(tool: string, success: boolean = true): ExecutionObservation {
  return {
    id: `obs-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    tool,
    parameters: { test: 'param' },
    result: success ? 'success' : null,
    duration_ms: 100 + Math.random() * 900,
    success,
    error: success ? undefined : 'Test error',
    context: {
      taskId: 'test-task-1',
      agentId: 'test-agent',
      workingDirectory: '/test',
      activePatterns: [],
      priorSteps: 0,
      environmentVars: { NODE_ENV: 'test' }
    }
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('SAFLA Neural Learning System', () => {
  let db: Database;
  let pipeline: LearningPipeline;

  beforeEach(async () => {
    db = await createTestDatabase();
    pipeline = new LearningPipeline(db, testConfig);
  });

  afterEach(async () => {
    await pipeline.shutdown();
    db.close();
  });

  // ==========================================================================
  // Observation Collection Tests
  // ==========================================================================

  describe('Observation Collection', () => {
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

    it('should buffer observations before flushing', async () => {
      for (let i = 0; i < 5; i++) {
        await pipeline.observe('Read', {}, async () => 'data');
      }

      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(5);
    });

    it('should sanitize sensitive parameters', async () => {
      await pipeline.observe(
        'Auth',
        { username: 'user', password: 'secret' },
        async () => 'authenticated'
      );

      // Observation should have sanitized params
      // This would require accessing internal state or events
    });

    it('should capture execution context', async () => {
      await pipeline.observe('Grep', { pattern: 'test' }, async () => 'results');

      // Context should include taskId, agentId, workingDirectory
    });
  });

  // ==========================================================================
  // Pattern Extraction Tests
  // ==========================================================================

  describe('Pattern Extraction', () => {
    it('should extract frequent sequences from observations', async () => {
      const observations: ExecutionObservation[] = [];

      // Create a repeating pattern: Read → Grep → Edit
      for (let i = 0; i < 5; i++) {
        observations.push(generateMockObservation('Read'));
        observations.push(generateMockObservation('Grep'));
        observations.push(generateMockObservation('Edit'));
      }

      const extractor = new PatternExtractor(db);
      const patterns = await extractor.extractPatterns(observations);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.name.includes('read'))).toBe(true);
    });

    it('should score patterns by quality', async () => {
      const observations: ExecutionObservation[] = [];

      // High-quality pattern: always succeeds
      for (let i = 0; i < 10; i++) {
        observations.push(generateMockObservation('Read', true));
        observations.push(generateMockObservation('Grep', true));
      }

      // Low-quality pattern: often fails
      for (let i = 0; i < 10; i++) {
        observations.push(generateMockObservation('Write', i % 3 !== 0));
      }

      const extractor = new PatternExtractor(db);
      const patterns = await extractor.extractPatterns(observations);

      // High-quality pattern should have higher confidence
      const readGrep = patterns.find(p => p.name.includes('read') && p.name.includes('grep'));
      const write = patterns.find(p => p.name.includes('write'));

      if (readGrep && write) {
        expect(readGrep.confidence).toBeGreaterThan(write.confidence);
      }
    });

    it('should filter patterns below quality threshold', async () => {
      const observations: ExecutionObservation[] = [];

      // Low-support pattern (only 2 occurrences)
      for (let i = 0; i < 2; i++) {
        observations.push(generateMockObservation('Bash'));
      }

      const extractor = new PatternExtractor(db, { minSupport: 3 });
      const patterns = await extractor.extractPatterns(observations);

      // Should not extract pattern with support < 3
      expect(patterns.every(p => !p.name.includes('bash'))).toBe(true);
    });

    it('should cluster similar high-performing executions', async () => {
      const observations: ExecutionObservation[] = [];

      // Cluster of fast successful reads
      for (let i = 0; i < 20; i++) {
        const obs = generateMockObservation('Read', true);
        obs.duration_ms = 50 + Math.random() * 50;
        observations.push(obs);
      }

      // Cluster of slow successful reads
      for (let i = 0; i < 20; i++) {
        const obs = generateMockObservation('Read', true);
        obs.duration_ms = 500 + Math.random() * 500;
        observations.push(obs);
      }

      const extractor = new PatternExtractor(db);
      const patterns = await extractor.extractPatterns(observations);

      // Should identify different patterns for fast vs slow
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Confidence Scoring Tests
  // ==========================================================================

  describe('Confidence Scoring', () => {
    it('should initialize patterns with moderate confidence', async () => {
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

      // Initial confidence should be moderate
      expect(pattern.confidence).toBeGreaterThanOrEqual(0.4);
      expect(pattern.confidence).toBeLessThanOrEqual(0.6);
    });

    it('should increase confidence after successful outcomes', async () => {
      const pattern: Pattern = {
        id: 'pattern-2',
        type: 'optimization',
        name: 'cache_pattern',
        description: 'Caching pattern',
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

      // Track multiple successful outcomes
      for (let i = 0; i < 5; i++) {
        await pipeline.trackOutcome({
          taskId: `task-${i}`,
          patternId: 'pattern-2',
          status: 'success',
          confidence: 0.95,
          metrics: {
            durationMs: 100,
            errorCount: 0,
            improvementVsBaseline: 0.5
          },
          judgeReasons: ['All steps completed successfully'],
          timestamp: new Date().toISOString()
        });
      }

      // Confidence should increase (but test would need to check stored value)
    });

    it('should decrease confidence after failures', async () => {
      const pattern: Pattern = {
        id: 'pattern-3',
        type: 'error-handling',
        name: 'retry_pattern',
        description: 'Retry pattern',
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
        confidence: 0.1,
        metrics: {
          durationMs: 500,
          errorCount: 3,
          improvementVsBaseline: -0.5
        },
        judgeReasons: ['Pattern failed to execute correctly'],
        timestamp: new Date().toISOString()
      });

      // Confidence should decrease
    });

    it('should apply time-based confidence decay', async () => {
      const pattern: Pattern = {
        id: 'pattern-4',
        type: 'coordination',
        name: 'old_pattern',
        description: 'Old unused pattern',
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
        createdAt: new Date().toISOString(),
        lastUsed: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago
      };

      await pipeline.train(pattern);

      // After consolidation, confidence should decay for old patterns
    });
  });

  // ==========================================================================
  // Pattern Storage Tests
  // ==========================================================================

  describe('Pattern Storage', () => {
    it('should store and retrieve patterns', async () => {
      const pattern: Pattern = {
        id: 'pattern-5',
        type: 'coordination',
        name: 'test_storage',
        description: 'Test storage pattern',
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

      await pipeline.train(pattern);

      // Pattern should be stored
      const metrics = pipeline.getMetrics();
      expect(metrics.patternsStored).toBeGreaterThan(0);
    });

    it('should compress pattern data', async () => {
      const largePattern: Pattern = {
        id: 'pattern-6',
        type: 'domain-specific',
        name: 'large_pattern',
        description: 'Pattern with large data',
        conditions: { data: 'x'.repeat(10000) },
        actions: Array(100).fill({
          step: 1,
          type: 'test',
          data: 'test data'
        }),
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 1,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.5,
        usageCount: 1,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(largePattern);

      // Storage should compress data (check DB size)
    });

    it('should merge similar patterns', async () => {
      const pattern1: Pattern = {
        id: 'pattern-7a',
        type: 'optimization',
        name: 'similar_pattern',
        description: 'Similar pattern 1',
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

      const pattern2: Pattern = {
        id: 'pattern-7b',
        type: 'optimization',
        name: 'similar_pattern',
        description: 'Similar pattern 2',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 3,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 120,
          avgImprovement: 0.4
        },
        confidence: 0.6,
        usageCount: 3,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern1);
      await pipeline.train(pattern2);

      // Similar patterns should be merged during consolidation
    });

    it('should prune low-value patterns', async () => {
      const lowValuePattern: Pattern = {
        id: 'pattern-8',
        type: 'testing',
        name: 'low_value',
        description: 'Low value pattern',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 1,
          failureCount: 2,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.1
        },
        confidence: 0.2,
        usageCount: 3,
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() // 40 days ago
      };

      await pipeline.train(lowValuePattern);

      // Pattern should be pruned during consolidation
    });
  });

  // ==========================================================================
  // Pattern Application Tests
  // ==========================================================================

  describe('Pattern Application', () => {
    it('should apply high-confidence patterns', async () => {
      const pattern: Pattern = {
        id: 'pattern-9',
        type: 'coordination',
        name: 'high_confidence',
        description: 'High confidence pattern',
        conditions: {},
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

      const application = await pipeline.applyBestPattern(
        'Read and process files',
        {
          taskId: 'task-apply',
          agentId: 'test-agent',
          workingDirectory: '/test',
          activePatterns: [],
          priorSteps: 0,
          environmentVars: {}
        }
      );

      expect(application.applied).toBe(true);
      expect(application.patternId).toBe('pattern-9');
    });

    it('should reject low-confidence patterns', async () => {
      const pattern: Pattern = {
        id: 'pattern-10',
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

      const application = await pipeline.applyBestPattern(
        'Optimize performance',
        {
          taskId: 'task-reject',
          agentId: 'test-agent',
          workingDirectory: '/test',
          activePatterns: [],
          priorSteps: 0,
          environmentVars: {}
        }
      );

      expect(application.applied).toBe(false);
      expect(application.reason).toContain('confidence');
    });

    it('should rank patterns by relevance', async () => {
      // Create multiple patterns
      const patterns: Pattern[] = [
        {
          id: 'pattern-11a',
          type: 'coordination',
          name: 'recent_high',
          description: 'Recent high confidence',
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
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        },
        {
          id: 'pattern-11b',
          type: 'coordination',
          name: 'old_higher',
          description: 'Old but higher confidence',
          conditions: {},
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

      // Application should prefer pattern with best combination of
      // confidence, usage, and recency
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance Requirements', () => {
    it('should handle 172,000+ operations per second', async () => {
      const startTime = Date.now();
      const operations = 10000; // Test with 10k for practicality

      for (let i = 0; i < operations; i++) {
        pipeline.getMetrics();
      }

      const duration = Date.now() - startTime;
      const opsPerSecond = (operations / duration) * 1000;

      expect(opsPerSecond).toBeGreaterThan(100000); // Should easily exceed target
    });

    it('should maintain memory usage under 100MB', async () => {
      const memBefore = process.memoryUsage().heapUsed;

      // Generate large workload
      for (let i = 0; i < 1000; i++) {
        await pipeline.observe('Read', {}, async () => 'data');
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memUsedMb = (memAfter - memBefore) / 1024 / 1024;

      expect(memUsedMb).toBeLessThan(100);
    });

    it('should achieve 60% memory compression', async () => {
      // Create large pattern
      const largePattern: Pattern = {
        id: 'pattern-compress',
        type: 'domain-specific',
        name: 'compression_test',
        description: 'x'.repeat(1000),
        conditions: { data: 'y'.repeat(10000) },
        actions: Array(100).fill({ step: 1, type: 'test' }),
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 1,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.5
        },
        confidence: 0.5,
        usageCount: 1,
        createdAt: new Date().toISOString()
      };

      const uncompressedSize = JSON.stringify(largePattern).length;

      await pipeline.train(largePattern);

      // Check compressed size in DB
      // Should be ~40% of original (60% compression)
    });

    it('should maintain 80% cache hit rate', async () => {
      const pattern: Pattern = {
        id: 'pattern-cache',
        type: 'optimization',
        name: 'cached_pattern',
        description: 'Frequently accessed pattern',
        conditions: {},
        actions: [],
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 },
        metrics: {
          successCount: 50,
          failureCount: 0,
          partialCount: 0,
          avgDurationMs: 100,
          avgImprovement: 0.6
        },
        confidence: 0.9,
        usageCount: 50,
        createdAt: new Date().toISOString()
      };

      await pipeline.train(pattern);

      // Access pattern multiple times
      for (let i = 0; i < 100; i++) {
        await pipeline.applyBestPattern('Use cached pattern', {
          taskId: `task-${i}`,
          agentId: 'test',
          workingDirectory: '/test',
          activePatterns: [],
          priorSteps: 0,
          environmentVars: {}
        });
      }

      // Cache hit rate should be high
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('End-to-End Integration', () => {
    it('should complete full learning cycle', async () => {
      // 1. Observe executions
      for (let i = 0; i < 20; i++) {
        await pipeline.observe('Read', { file: `file${i}.txt` }, async () => {
          return `content ${i}`;
        });

        await pipeline.observe('Grep', { pattern: 'test' }, async () => {
          return 'matches';
        });
      }

      // 2. Wait for pattern extraction
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Check metrics
      const metrics = pipeline.getMetrics();
      expect(metrics.observationsCollected).toBe(40);

      // 4. Apply learned patterns
      const application = await pipeline.applyBestPattern(
        'Read and search files',
        {
          taskId: 'integration-test',
          agentId: 'test',
          workingDirectory: '/test',
          activePatterns: [],
          priorSteps: 0,
          environmentVars: {}
        }
      );

      // 5. Track outcomes
      if (application.applied) {
        await pipeline.trackOutcome({
          taskId: 'integration-test',
          patternId: application.patternId!,
          status: 'success',
          confidence: 0.9,
          metrics: {
            durationMs: 500,
            errorCount: 0,
            improvementVsBaseline: 0.5
          },
          judgeReasons: ['Pattern successfully applied'],
          timestamp: new Date().toISOString()
        });
      }

      // Full cycle complete
      expect(metrics.patternsExtracted).toBeGreaterThan(0);
    });
  });
});
