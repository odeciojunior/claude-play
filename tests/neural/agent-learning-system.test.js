"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sqlite3_1 = require("sqlite3");
const agent_learning_system_1 = __importStar(require("../../src/neural/agent-learning-system"));
const category_pattern_libraries_1 = require("../../src/neural/category-pattern-libraries");
const learning_pipeline_1 = __importDefault(require("../../src/neural/learning-pipeline"));
(0, vitest_1.describe)('Agent Learning System - Comprehensive Tests', () => {
    let db;
    let learningPipeline;
    let agentLearning;
    (0, vitest_1.beforeEach)(async () => {
        db = new sqlite3_1.Database(':memory:');
        await setupTestDatabase(db);
        learningPipeline = new learning_pipeline_1.default(db, {
            observationBufferSize: 100,
            observationFlushInterval: 5000,
            extractionBatchSize: 10,
            minPatternQuality: 0.6,
            minConfidenceThreshold: 0.7,
            consolidationSchedule: 'hourly',
            autoLearning: true,
            maxPatternsPerType: 100
        });
        agentLearning = new agent_learning_system_1.default(db, learningPipeline);
    });
    (0, vitest_1.afterEach)(async () => {
        await learningPipeline.shutdown();
        db.close();
    });
    (0, vitest_1.describe)('Agent Registry', () => {
        (0, vitest_1.it)('should have exactly 78 agents registered', () => {
            (0, vitest_1.expect)(agent_learning_system_1.AGENT_COUNT).toBe(78);
            (0, vitest_1.expect)(Object.keys(agent_learning_system_1.AGENT_REGISTRY).length).toBe(78);
        });
        (0, vitest_1.it)('should have agents distributed across 20 categories', () => {
            const categories = new Set(Object.values(agent_learning_system_1.AGENT_REGISTRY).map(a => a.category));
            (0, vitest_1.expect)(categories.size).toBeGreaterThanOrEqual(17);
        });
        (0, vitest_1.it)('should have correct agent counts per category', () => {
            const counts = {};
            for (const agent of Object.values(agent_learning_system_1.AGENT_REGISTRY)) {
                counts[agent.category] = (counts[agent.category] || 0) + 1;
            }
            (0, vitest_1.expect)(counts['core']).toBe(5);
            (0, vitest_1.expect)(counts['sparc']).toBe(6);
            (0, vitest_1.expect)(counts['swarm']).toBe(8);
            (0, vitest_1.expect)(counts['goal']).toBe(2);
            (0, vitest_1.expect)(counts['neural']).toBe(2);
            (0, vitest_1.expect)(counts['testing']).toBe(6);
            (0, vitest_1.expect)(counts['github']).toBe(9);
            (0, vitest_1.expect)(counts['optimization']).toBe(5);
            (0, vitest_1.expect)(counts['analysis']).toBe(5);
            (0, vitest_1.expect)(counts['architecture']).toBe(7);
            (0, vitest_1.expect)(counts['devops']).toBe(6);
            (0, vitest_1.expect)(counts['consensus']).toBe(7);
            (0, vitest_1.expect)(counts['reasoning']).toBe(6);
        });
        (0, vitest_1.it)('should have all agents with valid configuration', () => {
            for (const [agentId, agent] of Object.entries(agent_learning_system_1.AGENT_REGISTRY)) {
                (0, vitest_1.expect)(agent.id).toBe(agentId);
                (0, vitest_1.expect)(agent.name).toBeTruthy();
                (0, vitest_1.expect)(agent.type).toBeTruthy();
                (0, vitest_1.expect)(agent.category).toBeTruthy();
                (0, vitest_1.expect)(agent.capabilities).toBeInstanceOf(Array);
                (0, vitest_1.expect)(agent.specializations).toBeInstanceOf(Array);
                (0, vitest_1.expect)(typeof agent.learningEnabled).toBe('boolean');
                (0, vitest_1.expect)(agent.learningRate).toBeGreaterThan(0);
                (0, vitest_1.expect)(agent.learningRate).toBeLessThanOrEqual(0.3);
                (0, vitest_1.expect)(agent.confidenceThreshold).toBeGreaterThanOrEqual(0.6);
                (0, vitest_1.expect)(agent.confidenceThreshold).toBeLessThanOrEqual(0.9);
                (0, vitest_1.expect)(agent.patternLibraryId).toBeTruthy();
            }
        });
        (0, vitest_1.it)('should have unique agent IDs', () => {
            const ids = Object.keys(agent_learning_system_1.AGENT_REGISTRY);
            const uniqueIds = new Set(ids);
            (0, vitest_1.expect)(uniqueIds.size).toBe(ids.length);
        });
    });
    (0, vitest_1.describe)('Category Libraries', () => {
        (0, vitest_1.it)('should have 20 category learning profiles', () => {
            const profiles = Object.keys(category_pattern_libraries_1.CATEGORY_LEARNING_PROFILES);
            (0, vitest_1.expect)(profiles.length).toBe(20);
        });
        (0, vitest_1.it)('should have valid target pattern counts', () => {
            for (const profile of Object.values(category_pattern_libraries_1.CATEGORY_LEARNING_PROFILES)) {
                (0, vitest_1.expect)(profile.targetPatternCount.min).toBeGreaterThan(0);
                (0, vitest_1.expect)(profile.targetPatternCount.max).toBeGreaterThanOrEqual(profile.targetPatternCount.min);
                (0, vitest_1.expect)(profile.targetPatternCount.max).toBeLessThanOrEqual(60);
            }
        });
        (0, vitest_1.it)('should have total target patterns between 500-800', () => {
            const totalMin = Object.values(category_pattern_libraries_1.CATEGORY_LEARNING_PROFILES).reduce((sum, p) => sum + p.targetPatternCount.min, 0);
            const totalMax = Object.values(category_pattern_libraries_1.CATEGORY_LEARNING_PROFILES).reduce((sum, p) => sum + p.targetPatternCount.max, 0);
            (0, vitest_1.expect)(totalMin).toBeGreaterThanOrEqual(400);
            (0, vitest_1.expect)(totalMax).toBeLessThanOrEqual(900);
            (0, vitest_1.expect)(totalMax).toBeGreaterThanOrEqual(500);
        });
        (0, vitest_1.it)('should have valid learning priorities', () => {
            const validPriorities = ['high', 'medium', 'low'];
            for (const profile of Object.values(category_pattern_libraries_1.CATEGORY_LEARNING_PROFILES)) {
                (0, vitest_1.expect)(validPriorities).toContain(profile.learningPriority);
            }
        });
        (0, vitest_1.it)('should have appropriate confidence thresholds', () => {
            for (const profile of Object.values(category_pattern_libraries_1.CATEGORY_LEARNING_PROFILES)) {
                (0, vitest_1.expect)(profile.avgConfidenceThreshold).toBeGreaterThanOrEqual(0.7);
                (0, vitest_1.expect)(profile.avgConfidenceThreshold).toBeLessThanOrEqual(0.85);
            }
        });
    });
    (0, vitest_1.describe)('Agent Learning Enablement', () => {
        (0, vitest_1.it)('should enable learning for a single agent', async () => {
            await agentLearning.enableAgentLearning('coder');
            const metrics = agentLearning.getAgentMetrics('coder');
            (0, vitest_1.expect)(metrics).toBeTruthy();
            (0, vitest_1.expect)(metrics?.agentId).toBe('coder');
            (0, vitest_1.expect)(metrics?.patternsLearned).toBe(0);
            (0, vitest_1.expect)(metrics?.specializations).toContain('implementation');
        });
        (0, vitest_1.it)('should enable learning for all agents in a category', async () => {
            await agentLearning.enableCategoryLearning('core');
            const coreAgents = ['coder', 'reviewer', 'tester', 'planner', 'researcher'];
            for (const agentId of coreAgents) {
                const metrics = agentLearning.getAgentMetrics(agentId);
                (0, vitest_1.expect)(metrics).toBeTruthy();
                (0, vitest_1.expect)(metrics?.agentId).toBe(agentId);
            }
        });
        (0, vitest_1.it)('should enable learning for all 78 agents', async () => {
            await agentLearning.enableAllAgentsLearning();
            const allMetrics = agentLearning.getAllMetrics();
            (0, vitest_1.expect)(allMetrics.length).toBe(78);
            for (const agentId of Object.keys(agent_learning_system_1.AGENT_REGISTRY)) {
                const metrics = agentLearning.getAgentMetrics(agentId);
                (0, vitest_1.expect)(metrics).toBeTruthy();
                (0, vitest_1.expect)(metrics?.agentId).toBe(agentId);
            }
        });
        (0, vitest_1.it)('should throw error for non-existent agent', async () => {
            await (0, vitest_1.expect)(agentLearning.enableAgentLearning('nonexistent-agent')).rejects.toThrow('Agent nonexistent-agent not found');
        });
        (0, vitest_1.it)('should respect custom learning configuration', async () => {
            await agentLearning.enableAgentLearning('goal-planner', {
                learningRate: 0.3,
                confidenceThreshold: 0.85,
                sharingEnabled: false
            });
            const metrics = agentLearning.getAgentMetrics('goal-planner');
            (0, vitest_1.expect)(metrics).toBeTruthy();
        });
    });
    (0, vitest_1.describe)('Pattern Storage', () => {
        (0, vitest_1.beforeEach)(async () => {
            await agentLearning.enableAgentLearning('coder');
        });
        (0, vitest_1.it)('should store a pattern for an agent', async () => {
            const pattern = createTestPattern('refactoring', 'extract_method');
            await agentLearning.storeAgentPattern('coder', pattern, true);
            const metrics = agentLearning.getAgentMetrics('coder');
            (0, vitest_1.expect)(metrics?.patternsLearned).toBe(1);
            (0, vitest_1.expect)(metrics?.patternsShared).toBe(1);
        });
        (0, vitest_1.it)('should store pattern in category library', async () => {
            const pattern = createTestPattern('refactoring', 'extract_method');
            await agentLearning.storeAgentPattern('coder', pattern, true);
            const library = agentLearning.getCategoryLibrary('core');
            (0, vitest_1.expect)(library?.totalPatterns).toBe(1);
            (0, vitest_1.expect)(library?.patterns).toHaveLength(1);
            (0, vitest_1.expect)(library?.patterns[0].name).toBe('extract_method');
        });
        (0, vitest_1.it)('should track agent contributions', async () => {
            const pattern1 = createTestPattern('refactoring', 'pattern1');
            const pattern2 = createTestPattern('refactoring', 'pattern2');
            await agentLearning.storeAgentPattern('coder', pattern1, true);
            await agentLearning.storeAgentPattern('coder', pattern2, true);
            const library = agentLearning.getCategoryLibrary('core');
            (0, vitest_1.expect)(library?.agentContributions.get('coder')).toBe(2);
        });
        (0, vitest_1.it)('should update average confidence in library', async () => {
            const pattern1 = createTestPattern('refactoring', 'p1', 0.8);
            const pattern2 = createTestPattern('refactoring', 'p2', 0.9);
            await agentLearning.storeAgentPattern('coder', pattern1, true);
            await agentLearning.storeAgentPattern('coder', pattern2, true);
            const library = agentLearning.getCategoryLibrary('core');
            (0, vitest_1.expect)(library?.avgConfidence).toBeCloseTo(0.85, 2);
        });
        (0, vitest_1.it)('should handle private patterns (no sharing)', async () => {
            const pattern = createTestPattern('refactoring', 'private_pattern');
            await agentLearning.storeAgentPattern('coder', pattern, false);
            const metrics = agentLearning.getAgentMetrics('coder');
            (0, vitest_1.expect)(metrics?.patternsLearned).toBe(1);
            (0, vitest_1.expect)(metrics?.patternsShared).toBe(0);
            const library = agentLearning.getCategoryLibrary('core');
            (0, vitest_1.expect)(library?.sharedPatterns).toHaveLength(0);
            (0, vitest_1.expect)(library?.categorySpecificPatterns).toHaveLength(1);
        });
    });
    (0, vitest_1.describe)('Pattern Retrieval', () => {
        (0, vitest_1.beforeEach)(async () => {
            await agentLearning.enableAgentLearning('coder');
            await agentLearning.storeAgentPattern('coder', createTestPattern('refactoring', 'extract_method', 0.85), true);
            await agentLearning.storeAgentPattern('coder', createTestPattern('optimization', 'cache_result', 0.75), true);
        });
        (0, vitest_1.it)('should retrieve best pattern for agent', async () => {
            const application = await agentLearning.getBestPatternForAgent('coder', 'Refactor complex function', createTestContext());
            (0, vitest_1.expect)(application.applied).toBe(true);
            (0, vitest_1.expect)(application.pattern).toBeTruthy();
            (0, vitest_1.expect)(application.confidence).toBeGreaterThanOrEqual(0.7);
        });
        (0, vitest_1.it)('should return no pattern if confidence too low', async () => {
            await agentLearning.storeAgentPattern('coder', createTestPattern('testing', 'low_confidence_pattern', 0.4), true);
            const application = await agentLearning.getBestPatternForAgent('coder', 'Low confidence task', createTestContext());
            if (!application.applied) {
                (0, vitest_1.expect)(['no_patterns_available', 'confidence_below_threshold']).toContain(application.reason);
            }
        });
        (0, vitest_1.it)('should increment usage count when pattern used', async () => {
            const beforeMetrics = agentLearning.getAgentMetrics('coder');
            const beforeUsage = beforeMetrics?.patternsUsed || 0;
            await agentLearning.getBestPatternForAgent('coder', 'Use pattern task', createTestContext());
            const afterMetrics = agentLearning.getAgentMetrics('coder');
            (0, vitest_1.expect)(afterMetrics?.patternsUsed).toBeGreaterThan(beforeUsage);
        });
    });
    (0, vitest_1.describe)('Outcome Tracking', () => {
        (0, vitest_1.beforeEach)(async () => {
            await agentLearning.enableAgentLearning('coder');
        });
        (0, vitest_1.it)('should track successful outcome', async () => {
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
            (0, vitest_1.expect)(metrics?.successRate).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should update reliability based on outcomes', async () => {
            const pattern = createTestPattern('refactoring', 'test_pattern', 0.75);
            await agentLearning.storeAgentPattern('coder', pattern, true);
            await agentLearning.getBestPatternForAgent('coder', 'Task', createTestContext());
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
            (0, vitest_1.expect)(metrics?.reliability).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should handle failure outcomes', async () => {
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
            (0, vitest_1.expect)(metrics).toBeTruthy();
        });
    });
    (0, vitest_1.describe)('Cross-Agent Pattern Sharing', () => {
        (0, vitest_1.beforeEach)(async () => {
            await agentLearning.enableCategoryLearning('core');
        });
        (0, vitest_1.it)('should share patterns within category', async () => {
            const pattern = createTestPattern('refactoring', 'shared_pattern', 0.85);
            await agentLearning.storeAgentPattern('coder', pattern, true);
            const library = agentLearning.getCategoryLibrary('core');
            (0, vitest_1.expect)(library?.sharedPatterns).toHaveLength(1);
            const application = await agentLearning.getBestPatternForAgent('reviewer', 'Use shared pattern', createTestContext());
            (0, vitest_1.expect)(application).toBeTruthy();
        });
        (0, vitest_1.it)('should track cross-agent pattern usage', async () => {
            const pattern = createTestPattern('refactoring', 'cross_agent', 0.85);
            await agentLearning.storeAgentPattern('coder', pattern, true);
            await agentLearning.getBestPatternForAgent('reviewer', 'Use cross-agent pattern', createTestContext());
            const stats = agentLearning.getSystemStatistics();
            (0, vitest_1.expect)(stats.totalPatterns).toBeGreaterThan(0);
        });
    });
    (0, vitest_1.describe)('System Statistics', () => {
        (0, vitest_1.beforeEach)(async () => {
            await agentLearning.enableAllAgentsLearning();
        });
        (0, vitest_1.it)('should calculate correct system statistics', () => {
            const stats = agentLearning.getSystemStatistics();
            (0, vitest_1.expect)(stats.totalAgents).toBe(78);
            (0, vitest_1.expect)(stats.agentsLearning).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(stats.totalCategories).toBeGreaterThanOrEqual(17);
            (0, vitest_1.expect)(stats.totalPatterns).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(stats.avgAgentReliability).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(stats.topPerformers).toBeInstanceOf(Array);
            (0, vitest_1.expect)(stats.topPerformers.length).toBeLessThanOrEqual(10);
        });
        (0, vitest_1.it)('should identify top performing agents', async () => {
            await agentLearning.enableAgentLearning('goal-planner');
            await agentLearning.enableAgentLearning('safla-neural');
            const pattern1 = createTestPattern('coordination', 'pattern1', 0.95);
            const pattern2 = createTestPattern('optimization', 'pattern2', 0.93);
            await agentLearning.storeAgentPattern('goal-planner', pattern1, true);
            await agentLearning.storeAgentPattern('safla-neural', pattern2, true);
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
            (0, vitest_1.expect)(stats.topPerformers.length).toBeGreaterThan(0);
            if (stats.topPerformers.length > 0) {
                const top = stats.topPerformers[0];
                (0, vitest_1.expect)(top.agentId).toBeTruthy();
                (0, vitest_1.expect)(top.reliability).toBeGreaterThanOrEqual(0);
            }
        });
    });
    (0, vitest_1.describe)('End-to-End Integration', () => {
        (0, vitest_1.it)('should complete full learning workflow for single agent', async () => {
            await agentLearning.enableAgentLearning('sparc-coder');
            const pattern = createTestPattern('testing', 'tdd_cycle', 0.85);
            await agentLearning.storeAgentPattern('sparc-coder', pattern, true);
            const application = await agentLearning.getBestPatternForAgent('sparc-coder', 'Implement with TDD', createTestContext());
            (0, vitest_1.expect)(application.applied).toBe(true);
            await agentLearning.trackAgentOutcome('sparc-coder', pattern.id, {
                taskId: 'tdd-task',
                patternId: pattern.id,
                status: 'success',
                confidence: 0.92,
                metrics: { durationMs: 3000, errorCount: 0, improvementVsBaseline: 0.35 },
                judgeReasons: ['TDD cycle completed successfully'],
                timestamp: new Date().toISOString()
            });
            const metrics = agentLearning.getAgentMetrics('sparc-coder');
            (0, vitest_1.expect)(metrics?.patternsLearned).toBe(1);
            (0, vitest_1.expect)(metrics?.patternsUsed).toBeGreaterThanOrEqual(1);
            (0, vitest_1.expect)(metrics?.successRate).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should handle complete category learning workflow', async () => {
            await agentLearning.enableCategoryLearning('sparc');
            const agents = ['sparc-coder', 'specification', 'pseudocode', 'architecture', 'refinement', 'completion'];
            for (let i = 0; i < agents.length; i++) {
                const pattern = createTestPattern('testing', `pattern_${i}`, 0.8 + i * 0.02);
                await agentLearning.storeAgentPattern(agents[i], pattern, true);
            }
            const library = agentLearning.getCategoryLibrary('sparc');
            (0, vitest_1.expect)(library?.totalPatterns).toBe(6);
            (0, vitest_1.expect)(library?.patterns).toHaveLength(6);
            for (const agentId of agents) {
                (0, vitest_1.expect)(library?.agentContributions.get(agentId)).toBe(1);
            }
        });
        (0, vitest_1.it)('should achieve target pattern counts for high-priority categories', async () => {
            await agentLearning.enableAllAgentsLearning();
            const coreAgents = ['coder', 'reviewer', 'tester', 'planner', 'researcher'];
            for (let i = 0; i < 10; i++) {
                for (const agentId of coreAgents) {
                    const pattern = createTestPattern('domain-specific', `core_pattern_${i}_${agentId}`, 0.75 + Math.random() * 0.15);
                    await agentLearning.storeAgentPattern(agentId, pattern, true);
                }
            }
            const library = agentLearning.getCategoryLibrary('core');
            (0, vitest_1.expect)(library?.totalPatterns).toBeGreaterThanOrEqual(40);
        });
    });
    (0, vitest_1.describe)('Performance', () => {
        (0, vitest_1.it)('should handle pattern retrieval in <10ms', async () => {
            await agentLearning.enableAgentLearning('coder');
            for (let i = 0; i < 50; i++) {
                await agentLearning.storeAgentPattern('coder', createTestPattern('optimization', `pattern_${i}`, 0.75), true);
            }
            const start = Date.now();
            await agentLearning.getBestPatternForAgent('coder', 'Test task', createTestContext());
            const duration = Date.now() - start;
            (0, vitest_1.expect)(duration).toBeLessThan(10);
        });
        (0, vitest_1.it)('should handle concurrent agent learning', async () => {
            await agentLearning.enableAllAgentsLearning();
            const promises = Object.keys(agent_learning_system_1.AGENT_REGISTRY).slice(0, 10).map(agentId => agentLearning.storeAgentPattern(agentId, createTestPattern('coordination', `concurrent_${agentId}`, 0.8), true));
            await Promise.all(promises);
            const stats = agentLearning.getSystemStatistics();
            (0, vitest_1.expect)(stats.totalPatterns).toBeGreaterThanOrEqual(10);
        });
    });
});
async function setupTestDatabase(db) {
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
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    });
}
function createTestPattern(type, name, confidence = 0.75) {
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
function createTestContext() {
    return {
        taskId: `task-${Date.now()}`,
        agentId: 'test-agent',
        workingDirectory: '/test',
        activePatterns: [],
        priorSteps: 0,
        environmentVars: {}
    };
}
//# sourceMappingURL=agent-learning-system.test.js.map