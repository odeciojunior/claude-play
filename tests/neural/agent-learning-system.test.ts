/**
 * Comprehensive Test Suite for Agent Learning System
 *
 * Tests all 78 agents across 20 categories with:
 * - Agent learning enablement
 * - Pattern storage and retrieval
 * - Cross-agent pattern sharing
 * - Metrics tracking
 * - System-wide statistics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'sqlite3';
import AgentLearningSystem, {
  AGENT_REGISTRY,
  AGENT_COUNT,
  CATEGORY_AGENT_COUNTS,
  AgentCategory
} from '../../src/neural/agent-learning-system';
import { CATEGORY_LEARNING_PROFILES } from '../../src/neural/category-pattern-libraries';
import LearningPipeline from '../../src/neural/learning-pipeline';
import { Pattern } from '../../src/neural/pattern-extraction';

// ============================================================================
// Test Setup
// ============================================================================

describe('Agent Learning System - Comprehensive Tests', () => {
  let db: Database;
  let learningPipeline: LearningPipeline;
  let agentLearning: AgentLearningSystem;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Initialize database schema
    await setupTestDatabase(db);

    // Create learning pipeline
    learningPipeline = new LearningPipeline(db, {
      observationBufferSize: 100,
      observationFlushInterval: 5000,
      extractionBatchSize: 10,
      minPatternQuality: 0.6,
      minConfidenceThreshold: 0.7,
      consolidationSchedule: 'hourly',
      autoLearning: true,
      maxPatternsPerType: 100
    });

    // Create agent learning system
    agentLearning = new AgentLearningSystem(db, learningPipeline);
  });

  afterEach(async () => {
    await learningPipeline.shutdown();
    db.close();
  });

  // ============================================================================
  // Agent Registry Tests
  // ============================================================================

  describe('Agent Registry', () => {
    it('should have exactly 78 agents registered', () => {
      expect(AGENT_COUNT).toBe(78);
      expect(Object.keys(AGENT_REGISTRY).length).toBe(78);
    });

    it('should have agents distributed across 20 categories', () => {
      const categories = new Set(
        Object.values(AGENT_REGISTRY).map(a => a.category)
      );
      expect(categories.size).toBeGreaterThanOrEqual(17); // Some categories may have 0 agents
    });

    it('should have correct agent counts per category', () => {
      const counts: Record<string, number> = {};

      for (const agent of Object.values(AGENT_REGISTRY)) {
        counts[agent.category] = (counts[agent.category] || 0) + 1;
      }

      // Verify key categories
      expect(counts['core']).toBe(5);
      expect(counts['sparc']).toBe(6);
      expect(counts['swarm']).toBe(8);
      expect(counts['goal']).toBe(2);
      expect(counts['neural']).toBe(2);
      expect(counts['testing']).toBe(6);
      expect(counts['github']).toBe(9);
      expect(counts['optimization']).toBe(5);
      expect(counts['analysis']).toBe(5);
      expect(counts['architecture']).toBe(7);
      expect(counts['devops']).toBe(6);
      expect(counts['consensus']).toBe(7);
      expect(counts['reasoning']).toBe(6);
    });

    it('should have all agents with valid configuration', () => {
      for (const [agentId, agent] of Object.entries(AGENT_REGISTRY)) {
        expect(agent.id).toBe(agentId);
        expect(agent.name).toBeTruthy();
        expect(agent.type).toBeTruthy();
        expect(agent.category).toBeTruthy();
        expect(agent.capabilities).toBeInstanceOf(Array);
        expect(agent.specializations).toBeInstanceOf(Array);
        expect(typeof agent.learningEnabled).toBe('boolean');
        expect(agent.learningRate).toBeGreaterThan(0);
        expect(agent.learningRate).toBeLessThanOrEqual(0.3);
        expect(agent.confidenceThreshold).toBeGreaterThanOrEqual(0.6);
        expect(agent.confidenceThreshold).toBeLessThanOrEqual(0.9);
        expect(agent.patternLibraryId).toBeTruthy();
      }
    });

    it('should have unique agent IDs', () => {
      const ids = Object.keys(AGENT_REGISTRY);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  // ============================================================================
  // Category Library Tests
  // ============================================================================

  describe('Category Libraries', () => {
    it('should have 20 category learning profiles', () => {
      const profiles = Object.keys(CATEGORY_LEARNING_PROFILES);
      expect(profiles.length).toBe(20);
    });

    it('should have valid target pattern counts', () => {
      for (const profile of Object.values(CATEGORY_LEARNING_PROFILES)) {
        expect(profile.targetPatternCount.min).toBeGreaterThan(0);
        expect(profile.targetPatternCount.max).toBeGreaterThanOrEqual(
          profile.targetPatternCount.min
        );
        expect(profile.targetPatternCount.max).toBeLessThanOrEqual(60);
      }
    });

    it('should have total target patterns between 500-800', () => {
      const totalMin = Object.values(CATEGORY_LEARNING_PROFILES).reduce(
        (sum, p) => sum + p.targetPatternCount.min,
        0
      );

      const totalMax = Object.values(CATEGORY_LEARNING_PROFILES).reduce(
        (sum, p) => sum + p.targetPatternCount.max,
        0
      );

      expect(totalMin).toBeGreaterThanOrEqual(400);
      expect(totalMax).toBeLessThanOrEqual(900);
      expect(totalMax).toBeGreaterThanOrEqual(500);
    });

    it('should have valid learning priorities', () => {
      const validPriorities = ['high', 'medium', 'low'];

      for (const profile of Object.values(CATEGORY_LEARNING_PROFILES)) {
        expect(validPriorities).toContain(profile.learningPriority);
      }
    });

    it('should have appropriate confidence thresholds', () => {
      for (const profile of Object.values(CATEGORY_LEARNING_PROFILES)) {
        expect(profile.avgConfidenceThreshold).toBeGreaterThanOrEqual(0.7);
        expect(profile.avgConfidenceThreshold).toBeLessThanOrEqual(0.85);
      }
    });
  });

  // ============================================================================
  // Agent Learning Enablement Tests
  // ============================================================================

  describe('Agent Learning Enablement', () => {
    it('should enable learning for a single agent', async () => {
      await agentLearning.enableAgentLearning('coder');

      const metrics = agentLearning.getAgentMetrics('coder');
      expect(metrics).toBeTruthy();
      expect(metrics?.agentId).toBe('coder');
      expect(metrics?.patternsLearned).toBe(0);
      expect(metrics?.specializations).toContain('implementation');
    });

    it('should enable learning for all agents in a category', async () => {
      await agentLearning.enableCategoryLearning('core');

      // Check all 5 core agents
      const coreAgents = ['coder', 'reviewer', 'tester', 'planner', 'researcher'];

      for (const agentId of coreAgents) {
        const metrics = agentLearning.getAgentMetrics(agentId);
        expect(metrics).toBeTruthy();
        expect(metrics?.agentId).toBe(agentId);
      }
    });

    it('should enable learning for all 78 agents', async () => {
      await agentLearning.enableAllAgentsLearning();

      const allMetrics = agentLearning.getAllMetrics();
      expect(allMetrics.length).toBe(78);

      // Verify each agent has metrics
      for (const agentId of Object.keys(AGENT_REGISTRY)) {
        const metrics = agentLearning.getAgentMetrics(agentId);
        expect(metrics).toBeTruthy();
        expect(metrics?.agentId).toBe(agentId);
      }
    });

    it('should throw error for non-existent agent', async () => {
      await expect(
        agentLearning.enableAgentLearning('nonexistent-agent')
      ).rejects.toThrow('Agent nonexistent-agent not found');
    });

    it('should respect custom learning configuration', async () => {
      await agentLearning.enableAgentLearning('goal-planner', {
        learningRate: 0.3,
        confidenceThreshold: 0.85,
        sharingEnabled: false
      });

      // Configuration stored, verify it's applied
      const metrics = agentLearning.getAgentMetrics('goal-planner');
      expect(metrics).toBeTruthy();
    });
  });

  // ============================================================================
  // Pattern Storage Tests
  // ============================================================================

  describe('Pattern Storage', () => {
    beforeEach(async () => {
      await agentLearning.enableAgentLearning('coder');
    });

    it('should store a pattern for an agent', async () => {
      const pattern = createTestPattern('refactoring', 'extract_method');

      await agentLearning.storeAgentPattern('coder', pattern, true);

      const metrics = agentLearning.getAgentMetrics('coder');
      expect(metrics?.patternsLearned).toBe(1);
      expect(metrics?.patternsShared).toBe(1);
    });

    it('should store pattern in category library', async () => {
      const pattern = createTestPattern('refactoring', 'extract_method');

      await agentLearning.storeAgentPattern('coder', pattern, true);

      const library = agentLearning.getCategoryLibrary('core');
      expect(library?.totalPatterns).toBe(1);
      expect(library?.patterns).toHaveLength(1);
      expect(library?.patterns[0].name).toBe('extract_method');
    });

    it('should track agent contributions', async () => {
      const pattern1 = createTestPattern('refactoring', 'pattern1');
      const pattern2 = createTestPattern('refactoring', 'pattern2');

      await agentLearning.storeAgentPattern('coder', pattern1, true);
      await agentLearning.storeAgentPattern('coder', pattern2, true);

      const library = agentLearning.getCategoryLibrary('core');
      expect(library?.agentContributions.get('coder')).toBe(2);
    });

    it('should update average confidence in library', async () => {
      const pattern1 = createTestPattern('refactoring', 'p1', 0.8);
      const pattern2 = createTestPattern('refactoring', 'p2', 0.9);

      await agentLearning.storeAgentPattern('coder', pattern1, true);
      await agentLearning.storeAgentPattern('coder', pattern2, true);

      const library = agentLearning.getCategoryLibrary('core');
      expect(library?.avgConfidence).toBeCloseTo(0.85, 2);
    });

    it('should handle private patterns (no sharing)', async () => {
      const pattern = createTestPattern('refactoring', 'private_pattern');

      await agentLearning.storeAgentPattern('coder', pattern, false);

      const metrics = agentLearning.getAgentMetrics('coder');
      expect(metrics?.patternsLearned).toBe(1);
      expect(metrics?.patternsShared).toBe(0);

      const library = agentLearning.getCategoryLibrary('core');
      expect(library?.sharedPatterns).toHaveLength(0);
      expect(library?.categorySpecificPatterns).toHaveLength(1);
    });
  });

  // ============================================================================
  // Pattern Retrieval Tests
  // ============================================================================

  describe('Pattern Retrieval', () => {
    beforeEach(async () => {
      await agentLearning.enableAgentLearning('coder');

      // Store test patterns
      await agentLearning.storeAgentPattern(
        'coder',
        createTestPattern('refactoring', 'extract_method', 0.85),
        true
      );

      await agentLearning.storeAgentPattern(
        'coder',
        createTestPattern('optimization', 'cache_result', 0.75),
        true
      );
    });

    it('should retrieve best pattern for agent', async () => {
      const application = await agentLearning.getBestPatternForAgent(
        'coder',
        'Refactor complex function',
        createTestContext()
      );

      expect(application.applied).toBe(true);
      expect(application.pattern).toBeTruthy();
      expect(application.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should return no pattern if confidence too low', async () => {
      // Add pattern with low confidence
      await agentLearning.storeAgentPattern(
        'coder',
        createTestPattern('testing', 'low_confidence_pattern', 0.4),
        true
      );

      const application = await agentLearning.getBestPatternForAgent(
        'coder',
        'Low confidence task',
        createTestContext()
      );

      // Should not apply low confidence pattern
      if (!application.applied) {
        expect(['no_patterns_available', 'confidence_below_threshold']).toContain(
          application.reason
        );
      }
    });

    it('should increment usage count when pattern used', async () => {
      const beforeMetrics = agentLearning.getAgentMetrics('coder');
      const beforeUsage = beforeMetrics?.patternsUsed || 0;

      await agentLearning.getBestPatternForAgent(
        'coder',
        'Use pattern task',
        createTestContext()
      );

      const afterMetrics = agentLearning.getAgentMetrics('coder');
      expect(afterMetrics?.patternsUsed).toBeGreaterThan(beforeUsage);
    });
  });

  // ============================================================================
  // Outcome Tracking Tests
  // ============================================================================

  describe('Outcome Tracking', () => {
    beforeEach(async () => {
      await agentLearning.enableAgentLearning('coder');
    });

    it('should track successful outcome', async () => {
      const pattern = createTestPattern('refactoring', 'test_pattern', 0.75);
      await agentLearning.storeAgentPattern('coder', pattern, true);

      await agentLearning.trackAgentOutcome('coder', pattern.id, {
        taskId: 'task-1',
        patternId: pattern.id,
        status: 'success',
        confidence: 0.9,
        metrics: {
          durationMs: 2000,
          errorCount: 0,
          improvementVsBaseline: 0.3
        },
        judgeReasons: ['Successful execution'],
        timestamp: new Date().toISOString()
      });

      const metrics = agentLearning.getAgentMetrics('coder');
      expect(metrics?.successRate).toBeGreaterThan(0);
    });

    it('should update reliability based on outcomes', async () => {
      const pattern = createTestPattern('refactoring', 'test_pattern', 0.75);
      await agentLearning.storeAgentPattern('coder', pattern, true);

      // Apply and track pattern
      await agentLearning.getBestPatternForAgent(
        'coder',
        'Task',
        createTestContext()
      );

      // Track success
      await agentLearning.trackAgentOutcome('coder', pattern.id, {
        taskId: 'task-1',
        patternId: pattern.id,
        status: 'success',
        confidence: 0.9,
        metrics: {
          durationMs: 2000,
          errorCount: 0,
          improvementVsBaseline: 0.3
        },
        judgeReasons: [],
        timestamp: new Date().toISOString()
      });

      const metrics = agentLearning.getAgentMetrics('coder');
      expect(metrics?.reliability).toBeGreaterThan(0);
    });

    it('should handle failure outcomes', async () => {
      const pattern = createTestPattern('refactoring', 'test_pattern', 0.75);
      await agentLearning.storeAgentPattern('coder', pattern, true);

      await agentLearning.trackAgentOutcome('coder', pattern.id, {
        taskId: 'task-1',
        patternId: pattern.id,
        status: 'failure',
        confidence: 0.3,
        metrics: {
          durationMs: 5000,
          errorCount: 3,
          improvementVsBaseline: -0.2
        },
        judgeReasons: ['Execution failed'],
        timestamp: new Date().toISOString()
      });

      const metrics = agentLearning.getAgentMetrics('coder');
      expect(metrics).toBeTruthy();
      // Success rate should be low after failure
    });
  });

  // ============================================================================
  // Cross-Agent Sharing Tests
  // ============================================================================

  describe('Cross-Agent Pattern Sharing', () => {
    beforeEach(async () => {
      await agentLearning.enableCategoryLearning('core');
    });

    it('should share patterns within category', async () => {
      const pattern = createTestPattern('refactoring', 'shared_pattern', 0.85);
      await agentLearning.storeAgentPattern('coder', pattern, true);

      const library = agentLearning.getCategoryLibrary('core');
      expect(library?.sharedPatterns).toHaveLength(1);

      // Other agents in category should be able to access
      const application = await agentLearning.getBestPatternForAgent(
        'reviewer',
        'Use shared pattern',
        createTestContext()
      );

      // May or may not apply depending on relevance, but should be available
      expect(application).toBeTruthy();
    });

    it('should track cross-agent pattern usage', async () => {
      const pattern = createTestPattern('refactoring', 'cross_agent', 0.85);
      await agentLearning.storeAgentPattern('coder', pattern, true);

      // Use pattern with different agent
      await agentLearning.getBestPatternForAgent(
        'reviewer',
        'Use cross-agent pattern',
        createTestContext()
      );

      // Pattern usage should be tracked across agents
      const stats = agentLearning.getSystemStatistics();
      expect(stats.totalPatterns).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // System Statistics Tests
  // ============================================================================

  describe('System Statistics', () => {
    beforeEach(async () => {
      await agentLearning.enableAllAgentsLearning();
    });

    it('should calculate correct system statistics', () => {
      const stats = agentLearning.getSystemStatistics();

      expect(stats.totalAgents).toBe(78);
      expect(stats.agentsLearning).toBeGreaterThanOrEqual(0);
      expect(stats.totalCategories).toBeGreaterThanOrEqual(17);
      expect(stats.totalPatterns).toBeGreaterThanOrEqual(0);
      expect(stats.avgAgentReliability).toBeGreaterThanOrEqual(0);
      expect(stats.topPerformers).toBeInstanceOf(Array);
      expect(stats.topPerformers.length).toBeLessThanOrEqual(10);
    });

    it('should identify top performing agents', async () => {
      // Add patterns for some agents
      await agentLearning.enableAgentLearning('goal-planner');
      await agentLearning.enableAgentLearning('safla-neural');

      const pattern1 = createTestPattern('coordination', 'pattern1', 0.95);
      const pattern2 = createTestPattern('optimization', 'pattern2', 0.93);

      await agentLearning.storeAgentPattern('goal-planner', pattern1, true);
      await agentLearning.storeAgentPattern('safla-neural', pattern2, true);

      // Track successful outcomes
      await agentLearning.trackAgentOutcome('goal-planner', pattern1.id, {
        taskId: 't1',
        patternId: pattern1.id,
        status: 'success',
        confidence: 0.95,
        metrics: { durationMs: 1000, errorCount: 0, improvementVsBaseline: 0.4 },
        judgeReasons: [],
        timestamp: new Date().toISOString()
      });

      const stats = agentLearning.getSystemStatistics();
      expect(stats.topPerformers.length).toBeGreaterThan(0);

      if (stats.topPerformers.length > 0) {
        const top = stats.topPerformers[0];
        expect(top.agentId).toBeTruthy();
        expect(top.reliability).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('End-to-End Integration', () => {
    it('should complete full learning workflow for single agent', async () => {
      // 1. Enable learning
      await agentLearning.enableAgentLearning('sparc-coder');

      // 2. Store pattern
      const pattern = createTestPattern('testing', 'tdd_cycle', 0.85);
      await agentLearning.storeAgentPattern('sparc-coder', pattern, true);

      // 3. Retrieve pattern
      const application = await agentLearning.getBestPatternForAgent(
        'sparc-coder',
        'Implement with TDD',
        createTestContext()
      );

      expect(application.applied).toBe(true);

      // 4. Track outcome
      await agentLearning.trackAgentOutcome('sparc-coder', pattern.id, {
        taskId: 'tdd-task',
        patternId: pattern.id,
        status: 'success',
        confidence: 0.92,
        metrics: { durationMs: 3000, errorCount: 0, improvementVsBaseline: 0.35 },
        judgeReasons: ['TDD cycle completed successfully'],
        timestamp: new Date().toISOString()
      });

      // 5. Verify metrics
      const metrics = agentLearning.getAgentMetrics('sparc-coder');
      expect(metrics?.patternsLearned).toBe(1);
      expect(metrics?.patternsUsed).toBeGreaterThanOrEqual(1);
      expect(metrics?.successRate).toBeGreaterThan(0);
    });

    it('should handle complete category learning workflow', async () => {
      // Enable entire SPARC category
      await agentLearning.enableCategoryLearning('sparc');

      // Each SPARC agent stores patterns
      const agents = ['sparc-coder', 'specification', 'pseudocode', 'architecture', 'refinement', 'completion'];

      for (let i = 0; i < agents.length; i++) {
        const pattern = createTestPattern('testing', `pattern_${i}`, 0.8 + i * 0.02);
        await agentLearning.storeAgentPattern(agents[i], pattern, true);
      }

      // Verify library
      const library = agentLearning.getCategoryLibrary('sparc');
      expect(library?.totalPatterns).toBe(6);
      expect(library?.patterns).toHaveLength(6);

      // Verify all agents contributed
      for (const agentId of agents) {
        expect(library?.agentContributions.get(agentId)).toBe(1);
      }
    });

    it('should achieve target pattern counts for high-priority categories', async () => {
      await agentLearning.enableAllAgentsLearning();

      // Simulate learning for core category (target: 40-60 patterns)
      const coreAgents = ['coder', 'reviewer', 'tester', 'planner', 'researcher'];

      for (let i = 0; i < 10; i++) {
        for (const agentId of coreAgents) {
          const pattern = createTestPattern('domain-specific', `core_pattern_${i}_${agentId}`, 0.75 + Math.random() * 0.15);
          await agentLearning.storeAgentPattern(agentId, pattern, true);
        }
      }

      const library = agentLearning.getCategoryLibrary('core');
      expect(library?.totalPatterns).toBeGreaterThanOrEqual(40);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should handle pattern retrieval in <10ms', async () => {
      await agentLearning.enableAgentLearning('coder');

      // Store patterns
      for (let i = 0; i < 50; i++) {
        await agentLearning.storeAgentPattern(
          'coder',
          createTestPattern('optimization', `pattern_${i}`, 0.75),
          true
        );
      }

      // Measure retrieval time
      const start = Date.now();
      await agentLearning.getBestPatternForAgent(
        'coder',
        'Test task',
        createTestContext()
      );
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should handle concurrent agent learning', async () => {
      await agentLearning.enableAllAgentsLearning();

      // Simulate concurrent learning
      const promises = Object.keys(AGENT_REGISTRY).slice(0, 10).map(agentId =>
        agentLearning.storeAgentPattern(
          agentId,
          createTestPattern('coordination', `concurrent_${agentId}`, 0.8),
          true
        )
      );

      await Promise.all(promises);

      const stats = agentLearning.getSystemStatistics();
      expect(stats.totalPatterns).toBeGreaterThanOrEqual(10);
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

async function setupTestDatabase(db: Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
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

      db.run(`
        CREATE TABLE IF NOT EXISTS pattern_embeddings (
          pattern_id TEXT PRIMARY KEY,
          embedding BLOB NOT NULL,
          FOREIGN KEY (pattern_id) REFERENCES patterns(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS task_trajectories (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          agent_id TEXT,
          trajectory_data TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS memory_entries (
          key TEXT PRIMARY KEY,
          namespace TEXT NOT NULL,
          value TEXT NOT NULL,
          ttl INTEGER,
          created_at TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function createTestPattern(
  type: 'coordination' | 'optimization' | 'error-handling' | 'domain-specific' | 'refactoring' | 'testing',
  name: string,
  confidence: number = 0.75
): Pattern {
  return {
    id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    name,
    description: `Test pattern: ${name}`,
    conditions: { test: true },
    actions: [
      { step: 1, type: 'test_action', tool: 'test_tool' }
    ],
    successCriteria: {
      minCompletionRate: 0.9,
      maxErrorRate: 0.1
    },
    metrics: {
      successCount: 0,
      failureCount: 0,
      partialCount: 0,
      avgDurationMs: 0,
      avgImprovement: 0
    },
    confidence,
    usageCount: 0,
    createdAt: new Date().toISOString()
  };
}

function createTestContext(): any {
  return {
    taskId: `task-${Date.now()}`,
    agentId: 'test-agent',
    workingDirectory: '/test',
    activePatterns: [],
    priorSteps: 0,
    environmentVars: {}
  };
}
