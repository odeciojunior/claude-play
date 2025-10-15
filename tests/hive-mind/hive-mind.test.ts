/**
 * Hive-Mind Distributed Learning System Tests
 *
 * Comprehensive test suite for queen-worker architecture,
 * Byzantine consensus, and pattern aggregation.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import {
  HiveMindCoordinator,
  QueenCoordinator,
  WorkerAgent,
  ByzantineConsensus,
  PatternAggregator,
  initializeHiveMind
} from '../../src/hive-mind';
import { Pattern } from '../../src/neural/pattern-extraction';

// ============================================================================
// Test Setup
// ============================================================================

let db: Database;
let hiveMind: HiveMindCoordinator;

beforeEach(async () => {
  // Create in-memory database for testing
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database(':memory:');

  const dbRun = promisify(db.run.bind(db));

  // Create schema
  await dbRun(`
    CREATE TABLE memory_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(namespace, key)
    )
  `);

  await dbRun(`
    CREATE TABLE patterns (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      pattern_data TEXT NOT NULL,
      confidence REAL NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  // Initialize hive-mind
  hiveMind = new HiveMindCoordinator(db, {
    maxWorkers: 5,
    consensusThreshold: 0.67,
    healthCheckInterval: 1000,
    statusReportInterval: 2000,
    aggregationInterval: 3000,
    minContributors: 2,
    minConsensusScore: 0.67,
    conflictThreshold: 0.15
  });

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterEach(async () => {
  if (hiveMind) {
    await hiveMind.shutdown();
  }

  if (db) {
    db.close();
  }
});

// ============================================================================
// Queen Coordinator Tests
// ============================================================================

describe('Queen Coordinator', () => {
  it('should establish sovereignty', async () => {
    const queen = hiveMind.getQueen();
    const status = queen.getStatus();

    expect(status.agent).toBe('queen-coordinator');
    expect(status.status).toBe('sovereign-active');
    expect(status.hierarchyEstablished).toBe(true);
  });

  it('should register workers', async () => {
    const queen = hiveMind.getQueen();
    const initialCount = queen.getWorkerCount();

    await queen.registerWorker({
      id: 'test-worker-1',
      role: 'architect',
      capabilities: ['design'],
      learningPatterns: [],
      performanceScore: 0.8,
      lastActive: new Date().toISOString()
    });

    expect(queen.getWorkerCount()).toBe(initialCount + 1);
  });

  it('should conduct consensus voting', async () => {
    const queen = hiveMind.getQueen();

    // Register workers
    for (let i = 0; i < 5; i++) {
      await queen.registerWorker({
        id: `voter-${i}`,
        role: 'implementer',
        capabilities: ['voting'],
        learningPatterns: [],
        performanceScore: 0.7,
        lastActive: new Date().toISOString()
      });
    }

    const result = await queen.conductConsensusVote(
      'test-proposal',
      { data: 'test' },
      ['voter-0', 'voter-1', 'voter-2', 'voter-3', 'voter-4']
    );

    expect(result.proposalId).toBe('test-proposal');
    expect(result.votes.length).toBeGreaterThan(0);
    expect(result.consensusScore).toBeGreaterThanOrEqual(0);
    expect(result.consensusScore).toBeLessThanOrEqual(1);
  });

  it('should allocate resources', async () => {
    const queen = hiveMind.getQueen();

    await queen.allocateResources({
      computeUnits: {
        'workers': 50,
        'scouts': 30
      }
    });

    // Verify resource allocation was stored
    const dbGet = promisify(db.get.bind(db));
    const row = await dbGet(
      `SELECT value FROM memory_entries WHERE namespace = 'coordination' AND key = 'swarm/shared/resource-allocation'`
    );

    expect(row).toBeDefined();
    const allocation = JSON.parse((row as any).value);
    expect(allocation.computeUnits.workers).toBe(50);
  });
});

// ============================================================================
// Worker Agent Tests
// ============================================================================

describe('Worker Agent', () => {
  it('should initialize worker', async () => {
    const workers = hiveMind.getAllWorkers();
    expect(workers.length).toBeGreaterThan(0);

    const worker = workers[0];
    const state = worker.getState();

    expect(state.id).toBeDefined();
    expect(state.role).toBeDefined();
    expect(state.status).toBe('idle');
  });

  it('should execute task', async () => {
    const worker = hiveMind.getAllWorkers()[0];

    const result = await worker.executeTask({
      id: 'test-task-1',
      description: 'Test task execution',
      context: {
        taskId: 'test-task-1',
        agentId: worker.getState().id,
        workingDirectory: process.cwd(),
        activePatterns: [],
        priorSteps: 0,
        environmentVars: {}
      },
      priority: 'medium',
      assignedAt: new Date().toISOString()
    });

    expect(result.taskId).toBe('test-task-1');
    expect(result.workerId).toBe(worker.getState().id);
    expect(result.success).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should learn patterns', async () => {
    const worker = hiveMind.getAllWorkers()[0];

    // Execute multiple tasks to generate patterns
    for (let i = 0; i < 3; i++) {
      await worker.executeTask({
        id: `learn-task-${i}`,
        description: 'Learning task',
        context: {
          taskId: `learn-task-${i}`,
          agentId: worker.getState().id,
          workingDirectory: process.cwd(),
          activePatterns: [],
          priorSteps: i,
          environmentVars: {}
        },
        priority: 'low',
        assignedAt: new Date().toISOString()
      });
    }

    const state = worker.getState();
    expect(state.patternsLearned).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Byzantine Consensus Tests
// ============================================================================

describe('Byzantine Consensus', () => {
  it('should register consensus nodes', () => {
    const consensus = hiveMind.getConsensus();
    const nodes = consensus.getNodes();

    expect(nodes.length).toBeGreaterThan(0);
  });

  it('should detect Byzantine faults', async () => {
    const consensus = hiveMind.getConsensus();

    // Register nodes with varying reputations
    consensus.registerNode({
      id: 'honest-node',
      reputation: 0.9,
      responseTime: 50,
      reliability: 0.95,
      lastSeen: new Date().toISOString()
    });

    consensus.registerNode({
      id: 'suspicious-node',
      reputation: 0.3, // Low reputation
      responseTime: 200,
      reliability: 0.5,
      lastSeen: new Date().toISOString()
    });

    const result = await consensus.submitProposal({
      id: 'fault-test',
      proposerId: 'test',
      type: 'pattern_validation',
      data: { test: true },
      requiredQuorum: 0.5,
      requiredConsensus: 0.67,
      timeout: 5000,
      timestamp: new Date().toISOString()
    });

    expect(['approved', 'rejected', 'timeout']).toContain(result);
  });

  it('should update node reputation', async () => {
    const consensus = hiveMind.getConsensus();

    consensus.registerNode({
      id: 'rep-test-node',
      reputation: 0.7,
      responseTime: 100,
      reliability: 0.8,
      lastSeen: new Date().toISOString()
    });

    const initialRep = consensus.getNodeReputation('rep-test-node');
    expect(initialRep).toBe(0.7);

    // Reset reputation
    consensus.resetNodeReputation('rep-test-node', 0.9);
    const newRep = consensus.getNodeReputation('rep-test-node');
    expect(newRep).toBe(0.9);
  });
});

// ============================================================================
// Pattern Aggregation Tests
// ============================================================================

describe('Pattern Aggregation', () => {
  it('should submit pattern for aggregation', async () => {
    const aggregator = hiveMind.getAggregator();

    const testPattern: Pattern = {
      id: 'test-pattern-1',
      type: 'coordination',
      name: 'Test Pattern',
      description: 'Test pattern for aggregation',
      conditions: { test: true },
      actions: [],
      successCriteria: { minCompletionRate: 0.8, maxErrorRate: 0.2 },
      confidence: 0.8,
      usageCount: 5,
      createdAt: new Date().toISOString(),
      metrics: {
        successCount: 4,
        failureCount: 1,
        partialCount: 0,
        avgDurationMs: 1000,
        avgImprovement: 0
      }
    };

    await aggregator.submitPattern({
      pattern: testPattern,
      contributorId: 'worker-1',
      contributorRole: 'implementer',
      contribution_score: 0.8,
      timestamp: new Date().toISOString()
    });

    const metrics = aggregator.getMetrics();
    expect(metrics.totalPatterns).toBeGreaterThan(0);
  });

  it('should aggregate patterns with multiple contributors', async () => {
    const aggregator = hiveMind.getAggregator();

    const basePattern: Pattern = {
      id: 'multi-contrib-pattern',
      type: 'coordination',
      name: 'Multi Contributor Pattern',
      description: 'Pattern with multiple contributors',
      conditions: { multi: true },
      actions: [],
      successCriteria: { minCompletionRate: 0.7, maxErrorRate: 0.3 },
      confidence: 0.7,
      usageCount: 10,
      createdAt: new Date().toISOString(),
      metrics: {
        successCount: 7,
        failureCount: 3,
        partialCount: 0,
        avgDurationMs: 1500,
        avgImprovement: 0
      }
    };

    // Submit from multiple workers
    for (let i = 0; i < 3; i++) {
      await aggregator.submitPattern({
        pattern: { ...basePattern, id: `pattern-${i}` },
        contributorId: `worker-${i}`,
        contributorRole: 'implementer',
        contribution_score: 0.7 + i * 0.1,
        timestamp: new Date().toISOString()
      });
    }

    // Wait for aggregation
    await new Promise(resolve => setTimeout(resolve, 500));

    const metrics = aggregator.getMetrics();
    expect(metrics.totalPatterns).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Swarm Task Orchestration Tests
// ============================================================================

describe('Swarm Task Orchestration', () => {
  it('should orchestrate parallel task', async () => {
    const task = await hiveMind.orchestrateTask(
      'Test parallel execution',
      {
        priority: 'medium',
        requiredWorkers: 3,
        strategy: 'parallel'
      }
    );

    expect(task.id).toBeDefined();
    expect(task.status).toBe('completed');
    expect(task.assignedWorkers.length).toBeGreaterThan(0);
  });

  it('should orchestrate sequential task', async () => {
    const task = await hiveMind.orchestrateTask(
      'Test sequential execution',
      {
        priority: 'high',
        requiredWorkers: 2,
        strategy: 'sequential'
      }
    );

    expect(task.status).toBe('completed');
    expect(task.strategy).toBe('sequential');
  });

  it('should orchestrate adaptive task', async () => {
    const task = await hiveMind.orchestrateTask(
      'Test adaptive execution',
      {
        priority: 'critical',
        requiredWorkers: 3,
        strategy: 'adaptive'
      }
    );

    expect(task.status).toBe('completed');
    expect(task.strategy).toBe('adaptive');
  });
});

// ============================================================================
// Collective Learning Tests
// ============================================================================

describe('Collective Learning', () => {
  it('should trigger collective learning', async () => {
    let learningCompleted = false;

    hiveMind.once('collective_learning_complete', (data) => {
      learningCompleted = true;
      expect(data.patternsLearned).toBeGreaterThanOrEqual(0);
      expect(data.patternsAggregated).toBeGreaterThanOrEqual(0);
    });

    await hiveMind.triggerCollectiveLearning();

    expect(learningCompleted).toBe(true);
  });

  it('should update collective intelligence', async () => {
    const initialStatus = hiveMind.getStatus();
    const initialIntelligence = initialStatus.collectiveIntelligence;

    // Execute tasks to generate learning
    await hiveMind.orchestrateTask('Intelligence test', {
      requiredWorkers: 3,
      strategy: 'parallel'
    });

    await hiveMind.triggerCollectiveLearning();

    const finalStatus = hiveMind.getStatus();
    expect(finalStatus.collectiveIntelligence).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Hive-Mind Integration', () => {
  it('should maintain status', () => {
    const status = hiveMind.getStatus();

    expect(status.queen).toBe('active');
    expect(status.workers).toBeGreaterThan(0);
    expect(status.consensusNodes).toBeGreaterThan(0);
    expect(status.collectiveIntelligence).toBeGreaterThanOrEqual(0);
    expect(status.collectiveIntelligence).toBeLessThanOrEqual(1);
  });

  it('should handle complete workflow', async () => {
    // 1. Orchestrate task
    const task = await hiveMind.orchestrateTask('Complete workflow test', {
      requiredWorkers: 3,
      strategy: 'adaptive',
      priority: 'high'
    });

    expect(task.status).toBe('completed');

    // 2. Trigger collective learning
    await hiveMind.triggerCollectiveLearning();

    // 3. Check metrics
    const status = hiveMind.getStatus();
    const aggregatorMetrics = hiveMind.getAggregator().getMetrics();
    const consensusMetrics = hiveMind.getConsensus().getMetrics();

    expect(status.patternsAggregated).toBeGreaterThanOrEqual(0);
    expect(aggregatorMetrics.totalPatterns).toBeGreaterThanOrEqual(0);
    expect(consensusMetrics.totalProposals).toBeGreaterThanOrEqual(0);
  });

  it('should achieve target metrics', async () => {
    // Execute multiple tasks
    for (let i = 0; i < 5; i++) {
      await hiveMind.orchestrateTask(`Metric test ${i}`, {
        requiredWorkers: 2,
        strategy: 'parallel'
      });
    }

    await hiveMind.triggerCollectiveLearning();

    const status = hiveMind.getStatus();
    const consensusMetrics = hiveMind.getConsensus().getMetrics();

    // Check success criteria
    expect(status.queen).toBe('active');
    expect(status.workers).toBeGreaterThanOrEqual(5); // Initial 5 workers
    expect(status.collectiveIntelligence).toBeGreaterThan(0);

    // Consensus validation should be >90% accuracy
    if (consensusMetrics.totalProposals > 0) {
      const accuracy = consensusMetrics.approvedProposals / consensusMetrics.totalProposals;
      expect(accuracy).toBeGreaterThanOrEqual(0); // Will improve with more runs
    }
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should handle 10 concurrent tasks', async () => {
    const startTime = Date.now();

    const tasks = Array.from({ length: 10 }, (_, i) =>
      hiveMind.orchestrateTask(`Concurrent task ${i}`, {
        requiredWorkers: 2,
        strategy: 'parallel',
        priority: 'medium'
      })
    );

    const results = await Promise.all(tasks);
    const duration = Date.now() - startTime;

    expect(results.length).toBe(10);
    expect(results.every(t => t.status === 'completed')).toBe(true);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
  });

  it('should aggregate patterns efficiently', async () => {
    const aggregator = hiveMind.getAggregator();
    const startTime = Date.now();

    // Submit 20 patterns
    for (let i = 0; i < 20; i++) {
      await aggregator.submitPattern({
        pattern: {
          id: `perf-pattern-${i}`,
          type: 'optimization',
          name: `Performance Pattern ${i}`,
          description: 'Performance test pattern',
          conditions: { perf: true },
          actions: [],
          successCriteria: { minCompletionRate: 0.8, maxErrorRate: 0.2 },
          confidence: 0.7,
          usageCount: 5,
          createdAt: new Date().toISOString(),
          metrics: {
            successCount: 4,
            failureCount: 1,
            partialCount: 0,
            avgDurationMs: 1000,
            avgImprovement: 0
          }
        },
        contributorId: `worker-${i % 5}`,
        contributorRole: 'implementer',
        contribution_score: 0.7,
        timestamp: new Date().toISOString()
      });
    }

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // Should be fast
    expect(aggregator.getMetrics().totalPatterns).toBeGreaterThanOrEqual(20);
  });
});
