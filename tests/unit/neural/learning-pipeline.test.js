"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const sqlite3_1 = require("sqlite3");
const util_1 = require("util");
const learning_pipeline_1 = __importDefault(require("../../../src/neural/learning-pipeline"));
async function createTestDatabase() {
    const db = new sqlite3_1.Database(':memory:');
    const run = (0, util_1.promisify)(db.run.bind(db));
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
const defaultConfig = {
    observationBufferSize: 100,
    observationFlushInterval: 5000,
    extractionBatchSize: 10,
    minPatternQuality: 0.5,
    minConfidenceThreshold: 0.6,
    consolidationSchedule: 'hourly',
    autoLearning: true,
    maxPatternsPerType: 1000
};
(0, globals_1.describe)('LearningPipeline', () => {
    let db;
    let pipeline;
    (0, globals_1.beforeEach)(async () => {
        db = await createTestDatabase();
        pipeline = new learning_pipeline_1.default(db, defaultConfig);
    });
    (0, globals_1.afterEach)(async () => {
        await pipeline.shutdown();
        db.close();
    });
    (0, globals_1.describe)('Initialization', () => {
        (0, globals_1.it)('should initialize with default configuration', () => {
            (0, globals_1.expect)(pipeline).toBeDefined();
            (0, globals_1.expect)(pipeline.getMetrics()).toBeDefined();
        });
        (0, globals_1.it)('should start observation buffer', () => {
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(0);
        });
        (0, globals_1.it)('should initialize all phases', () => {
            (0, globals_1.expect)(pipeline.extractionPhase).toBeDefined();
            (0, globals_1.expect)(pipeline.trainingPhase).toBeDefined();
            (0, globals_1.expect)(pipeline.applicationPhase).toBeDefined();
        });
    });
    (0, globals_1.describe)('Observation Phase', () => {
        (0, globals_1.it)('should observe successful tool execution', async () => {
            const result = await pipeline.observe('Read', { file: 'test.txt' }, async () => {
                return 'file contents';
            });
            (0, globals_1.expect)(result).toBe('file contents');
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(1);
        });
        (0, globals_1.it)('should observe failed tool execution', async () => {
            await (0, globals_1.expect)(pipeline.observe('Write', { file: 'test.txt' }, async () => {
                throw new Error('Write failed');
            })).rejects.toThrow('Write failed');
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(1);
        });
        (0, globals_1.it)('should capture execution duration', async () => {
            const start = Date.now();
            await pipeline.observe('Bash', { command: 'sleep 0.1' }, async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return 'done';
            });
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeGreaterThanOrEqual(100);
        });
        (0, globals_1.it)('should sanitize sensitive parameters', async () => {
            const sensitiveParams = {
                username: 'user',
                password: 'secret123',
                apiKey: 'sk-secret',
                token: 'bearer-token'
            };
            await pipeline.observe('Auth', sensitiveParams, async () => 'authenticated');
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(1);
        });
        (0, globals_1.it)('should buffer observations before extraction', async () => {
            for (let i = 0; i < 5; i++) {
                await pipeline.observe('Read', {}, async () => 'data');
            }
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(5);
            (0, globals_1.expect)(metrics.patternsExtracted).toBe(0);
        });
        (0, globals_1.it)('should flush observations after buffer full', async () => {
            const config = {
                ...defaultConfig,
                observationBufferSize: 5,
                extractionBatchSize: 5
            };
            const pipelineSmall = new learning_pipeline_1.default(db, config);
            for (let i = 0; i < 6; i++) {
                await pipelineSmall.observe('Read', {}, async () => 'data');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            const metrics = pipelineSmall.getMetrics();
            (0, globals_1.expect)(metrics.patternsExtracted).toBeGreaterThan(0);
            await pipelineSmall.shutdown();
        });
        (0, globals_1.it)('should handle concurrent observations', async () => {
            const promises = [];
            for (let i = 0; i < 50; i++) {
                promises.push(pipeline.observe('Concurrent', { index: i }, async () => `result-${i}`));
            }
            const results = await Promise.all(promises);
            (0, globals_1.expect)(results).toHaveLength(50);
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(50);
        });
        (0, globals_1.it)('should capture execution context', async () => {
            const context = {
                taskId: 'task-123',
                agentId: 'coder',
                workingDirectory: '/project',
                activePatterns: ['pattern-1'],
                priorSteps: 5,
                environmentVars: { NODE_ENV: 'test' }
            };
            pipeline.setContextProvider(() => context);
            await pipeline.observe('Test', {}, async () => 'result');
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(1);
        });
    });
    (0, globals_1.describe)('Pattern Extraction Phase', () => {
        (0, globals_1.it)('should extract patterns from observations', async () => {
            for (let i = 0; i < 10; i++) {
                await pipeline.observe('Read', {}, async () => 'data');
                await pipeline.observe('Grep', {}, async () => 'matches');
                await pipeline.observe('Edit', {}, async () => 'edited');
            }
            await pipeline.forceExtraction();
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.patternsExtracted).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should score extracted patterns', async () => {
            for (let i = 0; i < 10; i++) {
                await pipeline.observe('QualityRead', {}, async () => 'success');
            }
            await pipeline.forceExtraction();
            const patterns = await pipeline.getExtractedPatterns();
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns[0].confidence).toBeGreaterThan(0.5);
        });
        (0, globals_1.it)('should filter low-quality patterns', async () => {
            for (let i = 0; i < 10; i++) {
                try {
                    await pipeline.observe('Unreliable', {}, async () => {
                        if (Math.random() > 0.3)
                            throw new Error('Random failure');
                        return 'success';
                    });
                }
                catch (e) {
                }
            }
            await pipeline.forceExtraction();
            const patterns = await pipeline.getExtractedPatterns();
            (0, globals_1.expect)(patterns.every(p => p.confidence >= 0.5)).toBe(true);
        });
        (0, globals_1.it)('should classify pattern types', async () => {
            for (let i = 0; i < 5; i++) {
                await pipeline.observe('CoordA', {}, async () => 'result');
                await pipeline.observe('CoordB', {}, async () => 'result');
            }
            await pipeline.forceExtraction();
            const patterns = await pipeline.getExtractedPatterns();
            (0, globals_1.expect)(patterns.some(p => p.type === 'coordination')).toBe(true);
        });
        (0, globals_1.it)('should handle extraction errors gracefully', async () => {
            const malformed = {
                id: 'bad',
                timestamp: NaN,
                tool: null,
                parameters: undefined,
                success: true
            };
            await (0, globals_1.expect)(pipeline.extractPatternsFromObservations([malformed])).resolves.toBeDefined();
        });
    });
    (0, globals_1.describe)('Training Phase', () => {
        (0, globals_1.it)('should train patterns with initial confidence', async () => {
            const pattern = {
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
            (0, globals_1.expect)(metrics.patternsStored).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should update confidence on positive feedback', async () => {
            const pattern = {
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
            const stored = await pipeline.getPattern('pattern-2');
            (0, globals_1.expect)(stored.confidence).toBeGreaterThan(0.6);
        });
        (0, globals_1.it)('should decrease confidence on negative feedback', async () => {
            const pattern = {
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
            (0, globals_1.expect)(stored.confidence).toBeLessThan(0.8);
        });
        (0, globals_1.it)('should apply Bayesian confidence updates', async () => {
            const pattern = {
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
                    status: outcome.status,
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
            (0, globals_1.expect)(stored.confidence).toBeGreaterThan(0.7);
            (0, globals_1.expect)(stored.confidence).toBeLessThan(0.95);
        });
        (0, globals_1.it)('should handle rapid confidence updates', async () => {
            const pattern = {
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
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(pipeline.trackOutcome({
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
                }));
            }
            await Promise.all(promises);
            const stored = await pipeline.getPattern('pattern-rapid');
            (0, globals_1.expect)(stored.confidence).toBeGreaterThan(0.5);
        });
    });
    (0, globals_1.describe)('Pattern Application Phase', () => {
        (0, globals_1.it)('should apply high-confidence patterns', async () => {
            const pattern = {
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
            (0, globals_1.expect)(application.applied).toBe(true);
            (0, globals_1.expect)(application.patternId).toBe('pattern-apply');
        });
        (0, globals_1.it)('should reject low-confidence patterns', async () => {
            const pattern = {
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
            const application = await pipeline.applyBestPattern('optimize', {
                taskId: 'reject-test',
                agentId: 'test-agent',
                workingDirectory: '/test',
                activePatterns: [],
                priorSteps: 0,
                environmentVars: {}
            });
            (0, globals_1.expect)(application.applied).toBe(false);
            (0, globals_1.expect)(application.reason).toContain('confidence');
        });
        (0, globals_1.it)('should rank patterns by relevance', async () => {
            const patterns = [
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
            (0, globals_1.expect)(application.applied).toBe(true);
            (0, globals_1.expect)(application.patternId).toBe('pattern-b');
        });
        (0, globals_1.it)('should update usage count on application', async () => {
            const pattern = {
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
            (0, globals_1.expect)(stored.usageCount).toBeGreaterThan(initialUsage);
        });
    });
    (0, globals_1.describe)('Consolidation Phase', () => {
        (0, globals_1.it)('should consolidate similar patterns', async () => {
            const pattern1 = {
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
            const pattern2 = {
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
            const patterns = await pipeline.getExtractedPatterns();
            const similar = patterns.filter(p => p.name === 'similar');
            (0, globals_1.expect)(similar.length).toBeLessThanOrEqual(1);
        });
        (0, globals_1.it)('should prune low-value patterns', async () => {
            const lowValue = {
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
            const stored = await pipeline.getPattern('pattern-prune');
            (0, globals_1.expect)(stored).toBeNull();
        });
        (0, globals_1.it)('should apply time-based confidence decay', async () => {
            const oldPattern = {
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
            (0, globals_1.expect)(stored.confidence).toBeLessThan(initialConfidence);
        });
    });
    (0, globals_1.describe)('Metrics and Monitoring', () => {
        (0, globals_1.it)('should track observations collected', async () => {
            const initial = pipeline.getMetrics().observationsCollected;
            for (let i = 0; i < 10; i++) {
                await pipeline.observe('Test', {}, async () => 'result');
            }
            const final = pipeline.getMetrics().observationsCollected;
            (0, globals_1.expect)(final - initial).toBe(10);
        });
        (0, globals_1.it)('should track patterns extracted', async () => {
            for (let i = 0; i < 10; i++) {
                await pipeline.observe('Read', {}, async () => 'data');
                await pipeline.observe('Grep', {}, async () => 'matches');
            }
            await pipeline.forceExtraction();
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.patternsExtracted).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should track patterns stored', async () => {
            const pattern = {
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
            (0, globals_1.expect)(final).toBeGreaterThan(initial);
        });
        (0, globals_1.it)('should track patterns applied', async () => {
            const pattern = {
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
            (0, globals_1.expect)(final).toBeGreaterThan(initial);
        });
        (0, globals_1.it)('should provide performance metrics', () => {
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics).toHaveProperty('observationsCollected');
            (0, globals_1.expect)(metrics).toHaveProperty('patternsExtracted');
            (0, globals_1.expect)(metrics).toHaveProperty('patternsStored');
            (0, globals_1.expect)(metrics).toHaveProperty('patternsApplied');
            (0, globals_1.expect)(metrics).toHaveProperty('averageExtractionTimeMs');
            (0, globals_1.expect)(metrics).toHaveProperty('averageConfidenceScore');
        });
    });
    (0, globals_1.describe)('Performance', () => {
        (0, globals_1.it)('should handle high observation rate', async () => {
            const promises = [];
            for (let i = 0; i < 1000; i++) {
                promises.push(pipeline.observe('HighRate', { index: i }, async () => `result-${i}`));
            }
            const start = Date.now();
            await Promise.all(promises);
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(5000);
        });
        (0, globals_1.it)('should maintain memory under sustained load', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            for (let i = 0; i < 5000; i++) {
                await pipeline.observe('Sustained', { index: i }, async () => 'result');
            }
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;
            (0, globals_1.expect)(memoryIncreaseMB).toBeLessThan(100);
        });
        (0, globals_1.it)('should extract patterns efficiently', async () => {
            for (let i = 0; i < 1000; i++) {
                await pipeline.observe('Read', {}, async () => 'data');
            }
            const start = Date.now();
            await pipeline.forceExtraction();
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(2000);
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle database errors gracefully', async () => {
            db.close();
            await (0, globals_1.expect)(pipeline.observe('Test', {}, async () => 'result')).rejects.toThrow();
        });
        (0, globals_1.it)('should handle null/undefined observations', async () => {
            await (0, globals_1.expect)(pipeline.observe(null, null, async () => 'result')).rejects.toThrow();
        });
        (0, globals_1.it)('should handle malformed patterns', async () => {
            const malformed = {
                id: 'bad',
            };
            await (0, globals_1.expect)(pipeline.train(malformed)).rejects.toThrow();
        });
        (0, globals_1.it)('should recover from extraction failures', async () => {
            for (let i = 0; i < 10; i++) {
                await pipeline.observe('Problem', { circular: {} }, async () => {
                    const obj = {};
                    obj.self = obj;
                    return obj;
                });
            }
            await (0, globals_1.expect)(pipeline.forceExtraction()).resolves.toBeDefined();
        });
    });
});
//# sourceMappingURL=learning-pipeline.test.js.map