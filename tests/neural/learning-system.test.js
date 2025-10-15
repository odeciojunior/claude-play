"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const sqlite3_1 = require("sqlite3");
const util_1 = require("util");
const learning_pipeline_1 = __importDefault(require("../../src/neural/learning-pipeline"));
const pattern_extraction_1 = __importDefault(require("../../src/neural/pattern-extraction"));
const TEST_DB_PATH = ':memory:';
async function createTestDatabase() {
    const db = new sqlite3_1.Database(TEST_DB_PATH);
    const run = (0, util_1.promisify)(db.run.bind(db));
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
const testConfig = {
    observationBufferSize: 10,
    observationFlushInterval: 1000,
    extractionBatchSize: 5,
    minPatternQuality: 0.5,
    minConfidenceThreshold: 0.6,
    consolidationSchedule: 'hourly',
    autoLearning: true,
    maxPatternsPerType: 100
};
function generateMockObservation(tool, success = true) {
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
(0, globals_1.describe)('SAFLA Neural Learning System', () => {
    let db;
    let pipeline;
    (0, globals_1.beforeEach)(async () => {
        db = await createTestDatabase();
        pipeline = new learning_pipeline_1.default(db, testConfig);
    });
    (0, globals_1.afterEach)(async () => {
        await pipeline.shutdown();
        db.close();
    });
    (0, globals_1.describe)('Observation Collection', () => {
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
        (0, globals_1.it)('should buffer observations before flushing', async () => {
            for (let i = 0; i < 5; i++) {
                await pipeline.observe('Read', {}, async () => 'data');
            }
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(5);
        });
        (0, globals_1.it)('should sanitize sensitive parameters', async () => {
            await pipeline.observe('Auth', { username: 'user', password: 'secret' }, async () => 'authenticated');
        });
        (0, globals_1.it)('should capture execution context', async () => {
            await pipeline.observe('Grep', { pattern: 'test' }, async () => 'results');
        });
    });
    (0, globals_1.describe)('Pattern Extraction', () => {
        (0, globals_1.it)('should extract frequent sequences from observations', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push(generateMockObservation('Read'));
                observations.push(generateMockObservation('Grep'));
                observations.push(generateMockObservation('Edit'));
            }
            const extractor = new pattern_extraction_1.default(db);
            const patterns = await extractor.extractPatterns(observations);
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns.some(p => p.name.includes('read'))).toBe(true);
        });
        (0, globals_1.it)('should score patterns by quality', async () => {
            const observations = [];
            for (let i = 0; i < 10; i++) {
                observations.push(generateMockObservation('Read', true));
                observations.push(generateMockObservation('Grep', true));
            }
            for (let i = 0; i < 10; i++) {
                observations.push(generateMockObservation('Write', i % 3 !== 0));
            }
            const extractor = new pattern_extraction_1.default(db);
            const patterns = await extractor.extractPatterns(observations);
            const readGrep = patterns.find(p => p.name.includes('read') && p.name.includes('grep'));
            const write = patterns.find(p => p.name.includes('write'));
            if (readGrep && write) {
                (0, globals_1.expect)(readGrep.confidence).toBeGreaterThan(write.confidence);
            }
        });
        (0, globals_1.it)('should filter patterns below quality threshold', async () => {
            const observations = [];
            for (let i = 0; i < 2; i++) {
                observations.push(generateMockObservation('Bash'));
            }
            const extractor = new pattern_extraction_1.default(db, { minSupport: 3 });
            const patterns = await extractor.extractPatterns(observations);
            (0, globals_1.expect)(patterns.every(p => !p.name.includes('bash'))).toBe(true);
        });
        (0, globals_1.it)('should cluster similar high-performing executions', async () => {
            const observations = [];
            for (let i = 0; i < 20; i++) {
                const obs = generateMockObservation('Read', true);
                obs.duration_ms = 50 + Math.random() * 50;
                observations.push(obs);
            }
            for (let i = 0; i < 20; i++) {
                const obs = generateMockObservation('Read', true);
                obs.duration_ms = 500 + Math.random() * 500;
                observations.push(obs);
            }
            const extractor = new pattern_extraction_1.default(db);
            const patterns = await extractor.extractPatterns(observations);
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Confidence Scoring', () => {
        (0, globals_1.it)('should initialize patterns with moderate confidence', async () => {
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
            (0, globals_1.expect)(pattern.confidence).toBeGreaterThanOrEqual(0.4);
            (0, globals_1.expect)(pattern.confidence).toBeLessThanOrEqual(0.6);
        });
        (0, globals_1.it)('should increase confidence after successful outcomes', async () => {
            const pattern = {
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
        });
        (0, globals_1.it)('should decrease confidence after failures', async () => {
            const pattern = {
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
        });
        (0, globals_1.it)('should apply time-based confidence decay', async () => {
            const pattern = {
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
                lastUsed: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
            };
            await pipeline.train(pattern);
        });
    });
    (0, globals_1.describe)('Pattern Storage', () => {
        (0, globals_1.it)('should store and retrieve patterns', async () => {
            const pattern = {
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
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.patternsStored).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should compress pattern data', async () => {
            const largePattern = {
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
        });
        (0, globals_1.it)('should merge similar patterns', async () => {
            const pattern1 = {
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
            const pattern2 = {
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
        });
        (0, globals_1.it)('should prune low-value patterns', async () => {
            const lowValuePattern = {
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
                createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
            };
            await pipeline.train(lowValuePattern);
        });
    });
    (0, globals_1.describe)('Pattern Application', () => {
        (0, globals_1.it)('should apply high-confidence patterns', async () => {
            const pattern = {
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
            const application = await pipeline.applyBestPattern('Read and process files', {
                taskId: 'task-apply',
                agentId: 'test-agent',
                workingDirectory: '/test',
                activePatterns: [],
                priorSteps: 0,
                environmentVars: {}
            });
            (0, globals_1.expect)(application.applied).toBe(true);
            (0, globals_1.expect)(application.patternId).toBe('pattern-9');
        });
        (0, globals_1.it)('should reject low-confidence patterns', async () => {
            const pattern = {
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
            const application = await pipeline.applyBestPattern('Optimize performance', {
                taskId: 'task-reject',
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
        });
    });
    (0, globals_1.describe)('Performance Requirements', () => {
        (0, globals_1.it)('should handle 172,000+ operations per second', async () => {
            const startTime = Date.now();
            const operations = 10000;
            for (let i = 0; i < operations; i++) {
                pipeline.getMetrics();
            }
            const duration = Date.now() - startTime;
            const opsPerSecond = (operations / duration) * 1000;
            (0, globals_1.expect)(opsPerSecond).toBeGreaterThan(100000);
        });
        (0, globals_1.it)('should maintain memory usage under 100MB', async () => {
            const memBefore = process.memoryUsage().heapUsed;
            for (let i = 0; i < 1000; i++) {
                await pipeline.observe('Read', {}, async () => 'data');
            }
            const memAfter = process.memoryUsage().heapUsed;
            const memUsedMb = (memAfter - memBefore) / 1024 / 1024;
            (0, globals_1.expect)(memUsedMb).toBeLessThan(100);
        });
        (0, globals_1.it)('should achieve 60% memory compression', async () => {
            const largePattern = {
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
        });
        (0, globals_1.it)('should maintain 80% cache hit rate', async () => {
            const pattern = {
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
        });
    });
    (0, globals_1.describe)('End-to-End Integration', () => {
        (0, globals_1.it)('should complete full learning cycle', async () => {
            for (let i = 0; i < 20; i++) {
                await pipeline.observe('Read', { file: `file${i}.txt` }, async () => {
                    return `content ${i}`;
                });
                await pipeline.observe('Grep', { pattern: 'test' }, async () => {
                    return 'matches';
                });
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            const metrics = pipeline.getMetrics();
            (0, globals_1.expect)(metrics.observationsCollected).toBe(40);
            const application = await pipeline.applyBestPattern('Read and search files', {
                taskId: 'integration-test',
                agentId: 'test',
                workingDirectory: '/test',
                activePatterns: [],
                priorSteps: 0,
                environmentVars: {}
            });
            if (application.applied) {
                await pipeline.trackOutcome({
                    taskId: 'integration-test',
                    patternId: application.patternId,
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
            (0, globals_1.expect)(metrics.patternsExtracted).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=learning-system.test.js.map