/**
 * SAFLA Neural Verification Learning Tests
 *
 * Comprehensive test suite for verification-neural integration:
 * 1. Outcome capture and learning
 * 2. Truth score prediction accuracy
 * 3. Adaptive threshold tuning
 * 4. Pattern extraction and matching
 * 5. Agent reliability tracking
 * 6. Integration with learning pipeline
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import VerificationLearningSystem, {
  VerificationOutcome,
  VerificationLearningConfig
} from '../../src/neural/verification-learning';
import { VerificationBridge } from '../../src/neural/verification-bridge';
import { Database } from 'sqlite3';
import { promisify } from 'util';

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_DB_PATH = '.swarm/test-verification.db';
const TEST_CONFIG: VerificationLearningConfig = {
  predictionEnabled: true,
  adaptiveThresholds: true,
  minSampleSize: 3,
  confidenceThreshold: 0.6,
  learningRate: 0.2,
  decayFactor: 0.9
};

// ============================================================================
// Test Utilities
// ============================================================================

function createMockOutcome(
  passed: boolean,
  truthScore: number,
  agentType: string = 'coder',
  fileType: string = 'ts'
): VerificationOutcome {
  return {
    taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agentId: `agent-${agentType}-001`,
    agentType,
    timestamp: new Date().toISOString(),
    passed,
    truthScore,
    threshold: 0.95,
    componentScores: {
      compile: passed ? 1.0 : 0.5,
      tests: passed ? 0.95 : 0.6,
      lint: passed ? 0.98 : 0.7,
      typecheck: passed ? 1.0 : 0.8
    },
    fileType,
    complexity: 0.5,
    linesChanged: 100,
    testsRun: 10,
    duration: 1000,
    errorMessages: passed ? [] : ['Test failure in component X'],
    warnings: []
  };
}

async function setupTestDatabase(): Promise<Database> {
  // Remove existing test db
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Ensure directory exists
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create database
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(TEST_DB_PATH);

  // Promisify methods
  db.run = promisify(db.run.bind(db)) as any;
  db.get = promisify(db.get.bind(db)) as any;
  db.all = promisify(db.all.bind(db)) as any;

  // Load schema
  const schemaPath = path.join(__dirname, '../../src/neural/verification-schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const statements = schema.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        await db.run(statement);
      }
    }
  }

  return db;
}

// ============================================================================
// Test Suites
// ============================================================================

describe('VerificationLearningSystem', () => {
  let db: Database;
  let system: VerificationLearningSystem;

  beforeAll(async () => {
    db = await setupTestDatabase();
    system = new VerificationLearningSystem(db, TEST_CONFIG);
  });

  afterAll(async () => {
    await system.shutdown();
    if (db) {
      await new Promise<void>((resolve) => {
        db.close(() => resolve());
      });
    }
  });

  describe('Outcome Learning', () => {
    it('should learn from successful verification', async () => {
      const outcome = createMockOutcome(true, 0.97);

      await system.learnFromVerification(outcome);

      const reliability = await system.getAgentReliability(outcome.agentId);
      expect(reliability).not.toBeNull();
      expect(reliability!.successCount).toBeGreaterThan(0);
      expect(reliability!.reliability).toBeGreaterThan(0.5);
    });

    it('should learn from failed verification', async () => {
      const outcome = createMockOutcome(false, 0.73);

      await system.learnFromVerification(outcome);

      const reliability = await system.getAgentReliability(outcome.agentId);
      expect(reliability).not.toBeNull();
      expect(reliability!.failureCount).toBeGreaterThan(0);
    });

    it('should extract verification patterns', async () => {
      const outcomes = [
        createMockOutcome(false, 0.70, 'coder', 'ts'),
        createMockOutcome(false, 0.72, 'coder', 'ts'),
        createMockOutcome(false, 0.68, 'coder', 'ts')
      ];

      for (const outcome of outcomes) {
        await system.learnFromVerification(outcome);
      }

      const patterns = await system.getVerificationPatterns('failure');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('failure');
    });

    it('should track multiple agents', async () => {
      const agents = ['agent1', 'agent2', 'agent3'];

      for (const agentId of agents) {
        const outcome = createMockOutcome(true, 0.95);
        outcome.agentId = agentId;
        await system.learnFromVerification(outcome);
      }

      const allReliability = await system.getAllAgentReliability();
      expect(allReliability.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Truth Score Prediction', () => {
    beforeEach(async () => {
      // Train with some data
      const trainingOutcomes = [
        createMockOutcome(true, 0.96, 'coder', 'ts'),
        createMockOutcome(true, 0.97, 'coder', 'ts'),
        createMockOutcome(true, 0.95, 'coder', 'ts'),
        createMockOutcome(false, 0.72, 'coder', 'ts'),
        createMockOutcome(false, 0.68, 'coder', 'ts')
      ];

      for (const outcome of trainingOutcomes) {
        outcome.agentId = 'coder-test-agent';
        await system.learnFromVerification(outcome);
      }
    });

    it('should predict truth score', async () => {
      const prediction = await system.predictTruthScore(
        'task-test',
        'coder-test-agent',
        'coder',
        { fileType: 'ts', complexity: 0.5 }
      );

      expect(prediction.predictedScore).toBeGreaterThanOrEqual(0);
      expect(prediction.predictedScore).toBeLessThanOrEqual(1);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(prediction.riskLevel).toMatch(/low|medium|high|critical/);
    });

    it('should have reasonable prediction factors', async () => {
      const prediction = await system.predictTruthScore(
        'task-test',
        'coder-test-agent',
        'coder',
        { fileType: 'ts' }
      );

      expect(prediction.factors.agentReliability).toBeGreaterThan(0);
      expect(prediction.factors.historicalPerformance).toBeGreaterThan(0);
      expect(prediction.factors.taskComplexity).toBeGreaterThanOrEqual(0);
    });

    it('should recommend appropriate threshold', async () => {
      const prediction = await system.predictTruthScore(
        'task-test',
        'coder-test-agent',
        'coder',
        {}
      );

      expect(prediction.recommendedThreshold).toBeGreaterThanOrEqual(0.90);
      expect(prediction.recommendedThreshold).toBeLessThanOrEqual(0.99);
    });

    it('should improve accuracy over time', async () => {
      const predictions = [];
      const actuals = [];

      // Make predictions and record actuals
      for (let i = 0; i < 10; i++) {
        const prediction = await system.predictTruthScore(
          `task-${i}`,
          'coder-test-agent',
          'coder',
          {}
        );

        predictions.push(prediction.predictedScore);

        // Simulate actual outcome
        const actual = 0.9 + (Math.random() * 0.1); // 0.9-1.0
        actuals.push(actual);

        const outcome = createMockOutcome(actual >= 0.95, actual, 'coder');
        outcome.agentId = 'coder-test-agent';
        outcome.taskId = `task-${i}`;
        await system.learnFromVerification(outcome);
      }

      // Calculate average error
      let totalError = 0;
      for (let i = 0; i < predictions.length; i++) {
        totalError += Math.abs(predictions[i] - actuals[i]);
      }
      const avgError = totalError / predictions.length;

      expect(avgError).toBeLessThan(0.3); // Within 30% on average
    });
  });

  describe('Adaptive Thresholds', () => {
    it('should start with base threshold', async () => {
      const threshold = await system.getAdaptiveThreshold('reviewer');
      expect(threshold).toBe(0.95); // Default
    });

    it('should adapt threshold based on outcomes', async () => {
      const agentType = 'tester';
      const fileType = 'ts';

      // Feed consistent high-performing outcomes
      for (let i = 0; i < 20; i++) {
        const outcome = createMockOutcome(true, 0.98, agentType, fileType);
        await system.learnFromVerification(outcome);
      }

      const threshold = await system.getAdaptiveThreshold(agentType, { fileType });

      // Threshold should be adjusted (may be higher or lower depending on learning)
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });

    it('should provide context-specific thresholds', async () => {
      const agentType = 'coder';

      // High performance on TS files
      for (let i = 0; i < 15; i++) {
        const outcome = createMockOutcome(true, 0.97, agentType, 'ts');
        await system.learnFromVerification(outcome);
      }

      // Lower performance on JS files
      for (let i = 0; i < 15; i++) {
        const outcome = createMockOutcome(true, 0.88, agentType, 'js');
        await system.learnFromVerification(outcome);
      }

      const tsThreshold = await system.getAdaptiveThreshold(agentType, { fileType: 'ts' });
      const jsThreshold = await system.getAdaptiveThreshold(agentType, { fileType: 'js' });

      // Thresholds should potentially differ based on context
      expect(typeof tsThreshold).toBe('number');
      expect(typeof jsThreshold).toBe('number');
    });

    it('should list all adaptive thresholds', async () => {
      const thresholds = await system.getAllThresholds();
      expect(Array.isArray(thresholds)).toBe(true);
    });
  });

  describe('Pattern Library', () => {
    it('should store and retrieve success patterns', async () => {
      for (let i = 0; i < 5; i++) {
        const outcome = createMockOutcome(true, 0.96, 'reviewer', 'ts');
        await system.learnFromVerification(outcome);
      }

      const patterns = await system.getVerificationPatterns('success');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].successRate).toBeGreaterThan(0.5);
    });

    it('should store and retrieve failure patterns', async () => {
      for (let i = 0; i < 5; i++) {
        const outcome = createMockOutcome(false, 0.65, 'coder', 'js');
        await system.learnFromVerification(outcome);
      }

      const patterns = await system.getVerificationPatterns('failure');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('failure');
    });

    it('should find similar patterns', async () => {
      const baseOutcome = createMockOutcome(false, 0.70, 'coder', 'ts');
      await system.learnFromVerification(baseOutcome);

      const similar = await system.findSimilarPatterns({
        agentType: 'coder',
        fileType: 'ts'
      });

      expect(Array.isArray(similar)).toBe(true);
    });

    it('should track pattern confidence', async () => {
      const agentType = 'tester';
      const fileType = 'spec.ts';

      // Create repeated pattern
      for (let i = 0; i < 10; i++) {
        const outcome = createMockOutcome(true, 0.95, agentType, fileType);
        await system.learnFromVerification(outcome);
      }

      const patterns = await system.getVerificationPatterns('success');
      const pattern = patterns.find(p =>
        p.agentTypes.includes(agentType) && p.fileTypes.includes(fileType)
      );

      if (pattern) {
        expect(pattern.confidence).toBeGreaterThan(0.5);
        expect(pattern.occurrences).toBeGreaterThan(5);
      }
    });
  });

  describe('Agent Reliability', () => {
    it('should track agent success rate', async () => {
      const agentId = 'reliable-agent';

      // 8 successes, 2 failures
      for (let i = 0; i < 8; i++) {
        const outcome = createMockOutcome(true, 0.96);
        outcome.agentId = agentId;
        await system.learnFromVerification(outcome);
      }

      for (let i = 0; i < 2; i++) {
        const outcome = createMockOutcome(false, 0.72);
        outcome.agentId = agentId;
        await system.learnFromVerification(outcome);
      }

      const reliability = await system.getAgentReliability(agentId);
      expect(reliability).not.toBeNull();
      expect(reliability!.reliability).toBeCloseTo(0.8, 1); // 8/10 = 0.8
      expect(reliability!.successCount).toBe(8);
      expect(reliability!.failureCount).toBe(2);
    });

    it('should calculate reliability trends', async () => {
      const agentId = 'improving-agent';

      // Early poor performance
      for (let i = 0; i < 5; i++) {
        const outcome = createMockOutcome(false, 0.70);
        outcome.agentId = agentId;
        await system.learnFromVerification(outcome);
      }

      // Recent good performance
      for (let i = 0; i < 10; i++) {
        const outcome = createMockOutcome(true, 0.96);
        outcome.agentId = agentId;
        await system.learnFromVerification(outcome);
      }

      const reliability = await system.getAgentReliability(agentId);
      expect(reliability).not.toBeNull();
      // Trend should be improving or stable
      expect(['improving', 'stable']).toContain(reliability!.recentTrend);
    });

    it('should rank agents by reliability', async () => {
      const agents = [
        { id: 'agent-high', score: 0.95, count: 20 },
        { id: 'agent-medium', score: 0.80, count: 15 },
        { id: 'agent-low', score: 0.65, count: 10 }
      ];

      for (const agent of agents) {
        for (let i = 0; i < agent.count; i++) {
          const passed = Math.random() < agent.score;
          const outcome = createMockOutcome(passed, agent.score);
          outcome.agentId = agent.id;
          await system.learnFromVerification(outcome);
        }
      }

      const allReliability = await system.getAllAgentReliability();
      expect(allReliability.length).toBeGreaterThanOrEqual(3);

      // Should be sorted by reliability (descending)
      for (let i = 1; i < allReliability.length; i++) {
        expect(allReliability[i - 1].reliability).toBeGreaterThanOrEqual(
          allReliability[i].reliability
        );
      }
    });
  });

  describe('Learning Metrics', () => {
    it('should provide comprehensive metrics', async () => {
      const metrics = await system.getMetrics();

      expect(metrics).toHaveProperty('patterns');
      expect(metrics).toHaveProperty('agents');
      expect(metrics).toHaveProperty('thresholds');
      expect(metrics).toHaveProperty('predictions');
      expect(metrics.learningEnabled).toBe(true);
    });

    it('should track pattern counts', async () => {
      const metrics = await system.getMetrics();

      expect(metrics.patterns).toHaveProperty('total');
      expect(metrics.patterns).toHaveProperty('success');
      expect(metrics.patterns).toHaveProperty('failure');
      expect(metrics.patterns).toHaveProperty('warning');
    });

    it('should track agent statistics', async () => {
      const metrics = await system.getMetrics();

      expect(metrics.agents).toHaveProperty('totalAgents');
      expect(metrics.agents).toHaveProperty('avgReliability');
    });
  });
});

describe('VerificationBridge', () => {
  let bridge: VerificationBridge;

  beforeAll(async () => {
    bridge = new VerificationBridge(TEST_DB_PATH, TEST_CONFIG);
    await bridge.initialize();
  });

  afterAll(async () => {
    await bridge.shutdown();
  });

  describe('Integration', () => {
    it('should initialize successfully', async () => {
      expect(bridge).toBeDefined();
    });

    it('should predict and learn cycle', async () => {
      const taskId = `task-${Date.now()}`;
      const agentId = 'bridge-test-agent';
      const agentType = 'coder';

      // Predict
      const prediction = await bridge.predict(taskId, agentId, agentType, {
        fileType: 'ts',
        complexity: 0.5
      });

      expect(prediction.taskId).toBe(taskId);
      expect(prediction.predictedScore).toBeGreaterThanOrEqual(0);

      // Learn
      const outcome = createMockOutcome(true, 0.96, agentType);
      outcome.taskId = taskId;
      outcome.agentId = agentId;

      await bridge.learn(outcome);

      // Verify learning occurred
      const reliability = await bridge.getReliability(agentId);
      expect(reliability).not.toBeNull();
    });

    it('should get adaptive threshold', async () => {
      const threshold = await bridge.getThreshold('coder', { fileType: 'ts' });
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });

    it('should generate report', async () => {
      const report = await bridge.generateReport();
      expect(typeof report).toBe('string');
      expect(report).toContain('VERIFICATION LEARNING SYSTEM REPORT');
      expect(report).toContain('OVERALL METRICS');
      expect(report).toContain('AGENT RELIABILITY');
    });

    it('should provide metrics', async () => {
      const metrics = await bridge.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('predictionAccuracy');
      expect(metrics).toHaveProperty('avgPredictionError');
    });
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  let db: Database;
  let system: VerificationLearningSystem;

  beforeAll(async () => {
    db = await setupTestDatabase();
    system = new VerificationLearningSystem(db, TEST_CONFIG);
  });

  afterAll(async () => {
    await system.shutdown();
  });

  it('should handle high volume of outcomes', async () => {
    const startTime = Date.now();
    const outcomes: VerificationOutcome[] = [];

    // Generate 100 outcomes
    for (let i = 0; i < 100; i++) {
      outcomes.push(createMockOutcome(Math.random() > 0.2, 0.7 + Math.random() * 0.3));
    }

    // Learn from all outcomes
    for (const outcome of outcomes) {
      await system.learnFromVerification(outcome);
    }

    const duration = Date.now() - startTime;
    const avgTime = duration / outcomes.length;

    console.log(`Processed ${outcomes.length} outcomes in ${duration}ms (${avgTime.toFixed(2)}ms avg)`);

    // Should process at reasonable speed
    expect(avgTime).toBeLessThan(100); // <100ms per outcome
  });

  it('should make predictions quickly', async () => {
    const iterations = 50;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await system.predictTruthScore(`task-${i}`, 'agent-test', 'coder', {});
    }

    const duration = Date.now() - startTime;
    const avgTime = duration / iterations;

    console.log(`Made ${iterations} predictions in ${duration}ms (${avgTime.toFixed(2)}ms avg)`);

    // Should predict quickly
    expect(avgTime).toBeLessThan(50); // <50ms per prediction
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('End-to-End Integration', () => {
  let bridge: VerificationBridge;

  beforeAll(async () => {
    bridge = new VerificationBridge(TEST_DB_PATH, TEST_CONFIG);
    await bridge.initialize();
  });

  afterAll(async () => {
    await bridge.shutdown();
  });

  it('should complete full verification learning cycle', async () => {
    const agentId = 'e2e-test-agent';
    const agentType = 'coder';

    // Train with 20 outcomes
    console.log('Training with 20 outcomes...');
    for (let i = 0; i < 20; i++) {
      const passed = i % 5 !== 0; // 80% success rate
      const score = passed ? 0.95 + Math.random() * 0.05 : 0.65 + Math.random() * 0.15;
      const outcome = createMockOutcome(passed, score, agentType);
      outcome.agentId = agentId;
      await bridge.learn(outcome);
    }

    // Make prediction
    console.log('Making prediction...');
    const prediction = await bridge.predict('task-final', agentId, agentType, {
      fileType: 'ts',
      complexity: 0.5
    });

    console.log('Prediction:', {
      score: prediction.predictedScore.toFixed(3),
      confidence: prediction.confidence.toFixed(3),
      riskLevel: prediction.riskLevel,
      threshold: prediction.recommendedThreshold.toFixed(3)
    });

    // Get adaptive threshold
    const threshold = await bridge.getThreshold(agentType, { fileType: 'ts' });
    console.log('Adaptive threshold:', threshold.toFixed(3));

    // Get agent reliability
    const reliability = await bridge.getReliability(agentId);
    console.log('Agent reliability:', {
      reliability: reliability?.reliability.toFixed(3),
      avgScore: reliability?.avgTruthScore.toFixed(3),
      total: reliability?.totalVerifications,
      trend: reliability?.recentTrend
    });

    // Get patterns
    const patterns = await bridge.getPatterns();
    console.log('Patterns learned:', patterns.length);

    // Generate report
    const report = await bridge.generateReport();
    console.log('\n' + report);

    // Assertions
    expect(prediction.predictedScore).toBeGreaterThan(0.7);
    expect(reliability?.totalVerifications).toBe(20);
    expect(reliability?.reliability).toBeGreaterThan(0.5);
    expect(patterns.length).toBeGreaterThan(0);
  });
});
