"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const utils_1 = require("../../src/performance/utils");
const benchmarks_1 = __importDefault(require("../../src/performance/benchmarks"));
(0, globals_1.describe)('Performance System', () => {
    let perfSystem;
    (0, globals_1.beforeAll)(async () => {
        perfSystem = (0, utils_1.createTestPerformanceSystem)();
        await perfSystem.initialize();
    });
    (0, globals_1.afterAll)(async () => {
        await perfSystem.shutdown();
    });
    (0, globals_1.describe)('Pattern Operations', () => {
        (0, globals_1.it)('should store and retrieve patterns', async () => {
            const pattern = {
                id: 'test-pattern-1',
                type: 'test',
                patternData: { test: 'data' },
                confidence: 0.8,
                usageCount: 0,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            };
            const storeResult = await perfSystem.storePattern(pattern);
            (0, globals_1.expect)(storeResult.success).toBe(true);
            const getResult = await perfSystem.getPattern('test-pattern-1');
            (0, globals_1.expect)(getResult.success).toBe(true);
            (0, globals_1.expect)(getResult.data?.id).toBe('test-pattern-1');
        });
        (0, globals_1.it)('should retrieve patterns from cache', async () => {
            const pattern = {
                id: 'cached-pattern',
                type: 'test',
                patternData: { cached: true },
                confidence: 0.9,
                usageCount: 10,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            };
            await perfSystem.storePattern(pattern);
            const result1 = await perfSystem.getPattern('cached-pattern');
            (0, globals_1.expect)(result1.success).toBe(true);
            const result2 = await perfSystem.getPattern('cached-pattern');
            (0, globals_1.expect)(result2.success).toBe(true);
            (0, globals_1.expect)(result2.cached).toBe(true);
            (0, globals_1.expect)(result2.executionTime).toBeLessThan(result1.executionTime);
        });
        (0, globals_1.it)('should handle batch pattern retrieval', async () => {
            const patterns = [];
            for (let i = 0; i < 10; i++) {
                patterns.push({
                    id: `batch-pattern-${i}`,
                    type: 'test',
                    patternData: { index: i },
                    confidence: 0.7,
                    usageCount: i,
                    createdAt: new Date().toISOString(),
                    lastUsed: new Date().toISOString()
                });
            }
            for (const pattern of patterns) {
                await perfSystem.storePattern(pattern);
            }
            const ids = patterns.map(p => p.id);
            const result = await perfSystem.getPatterns(ids);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.data?.length).toBe(10);
        });
    });
    (0, globals_1.describe)('Confidence Updates', () => {
        (0, globals_1.it)('should update confidence scores', async () => {
            const pattern = {
                id: 'confidence-pattern',
                type: 'test',
                patternData: {},
                confidence: 0.5,
                usageCount: 0,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            };
            await perfSystem.storePattern(pattern);
            const result = await perfSystem.updateConfidence('confidence-pattern', 'success');
            (0, globals_1.expect)(result.success).toBe(true);
            await perfSystem.flush();
        });
        (0, globals_1.it)('should batch confidence updates', async () => {
            const updates = [];
            for (let i = 0; i < 50; i++) {
                updates.push(perfSystem.updateConfidence(`batch-pattern-${i % 10}`, i % 2 === 0 ? 'success' : 'failure'));
            }
            const results = await Promise.all(updates);
            (0, globals_1.expect)(results.every(r => r.success)).toBe(true);
            await perfSystem.flush();
        });
    });
    (0, globals_1.describe)('Performance Metrics', () => {
        (0, globals_1.it)('should track cache statistics', async () => {
            for (let i = 0; i < 100; i++) {
                await perfSystem.getPattern(`batch-pattern-${i % 10}`);
            }
            const metrics = perfSystem.getMetrics();
            (0, globals_1.expect)(metrics.cache.overallHitRate).toBeGreaterThan(0);
            (0, globals_1.expect)(metrics.cache.l1.hits + metrics.cache.l1.misses).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should track operation latency', async () => {
            for (let i = 0; i < 100; i++) {
                await perfSystem.getPattern('cached-pattern');
            }
            const metrics = perfSystem.getMetrics();
            (0, globals_1.expect)(metrics.performance.avgLatency).toBeGreaterThan(0);
            (0, globals_1.expect)(metrics.performance.p99Latency).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should track operations per second', async () => {
            const promises = [];
            for (let i = 0; i < 1000; i++) {
                promises.push(perfSystem.getPattern(`batch-pattern-${i % 10}`));
            }
            await Promise.all(promises);
            const metrics = perfSystem.getMetrics();
            (0, globals_1.expect)(metrics.performance.opsPerSecond).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should generate performance report', () => {
            const report = perfSystem.getReport();
            (0, globals_1.expect)(report).toContain('Performance System Report');
            (0, globals_1.expect)(report).toContain('Operations/Second');
            (0, globals_1.expect)(report).toContain('Cache Performance');
            (0, globals_1.expect)(report).toContain('Database Performance');
        });
    });
    (0, globals_1.describe)('Batch Processing', () => {
        (0, globals_1.it)('should flush pending batches', async () => {
            for (let i = 0; i < 50; i++) {
                await perfSystem.updateConfidence(`batch-pattern-${i % 10}`, 'success');
            }
            await perfSystem.flush();
            const metrics = perfSystem.getMetrics();
            (0, globals_1.expect)(metrics.batch.patternBatches + metrics.batch.confidenceBatches).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle non-existent pattern', async () => {
            const result = await perfSystem.getPattern('non-existent-pattern');
            (0, globals_1.expect)(result.success).toBe(false);
        });
        (0, globals_1.it)('should handle invalid pattern data', async () => {
            const result = await perfSystem.storePattern({
                id: '',
                type: '',
                patternData: null,
                confidence: 0,
                usageCount: 0,
                createdAt: '',
                lastUsed: ''
            });
            (0, globals_1.expect)(result.success).toBe(false);
        });
    });
});
(0, globals_1.describe)('Performance Benchmarks', () => {
    let perfSystem;
    let benchmarks;
    (0, globals_1.beforeAll)(async () => {
        perfSystem = (0, utils_1.createTestPerformanceSystem)();
        await perfSystem.initialize();
        benchmarks = new benchmarks_1.default(perfSystem);
    });
    (0, globals_1.afterAll)(async () => {
        await perfSystem.shutdown();
    });
    (0, globals_1.describe)('Individual Benchmarks', () => {
        (0, globals_1.it)('should measure operations throughput', async () => {
            const result = await benchmarks.benchmarkOperationsThroughput();
            (0, globals_1.expect)(result.name).toBe('Operations Throughput');
            (0, globals_1.expect)(result.actual).toBeGreaterThan(0);
            (0, globals_1.expect)(result.unit).toBe('ops/sec');
            (0, globals_1.expect)(result.executionTime).toBeGreaterThan(0);
        }, 30000);
        (0, globals_1.it)('should measure pattern retrieval speed', async () => {
            const result = await benchmarks.benchmarkPatternRetrieval();
            (0, globals_1.expect)(result.name).toBe('Pattern Retrieval Speed');
            (0, globals_1.expect)(result.actual).toBeGreaterThan(0);
            (0, globals_1.expect)(result.unit).toBe('ms');
        }, 30000);
        (0, globals_1.it)('should measure cache hit rate', async () => {
            const result = await benchmarks.benchmarkCacheHitRate();
            (0, globals_1.expect)(result.name).toBe('Cache Hit Rate');
            (0, globals_1.expect)(result.actual).toBeGreaterThanOrEqual(0);
            (0, globals_1.expect)(result.actual).toBeLessThanOrEqual(1);
            (0, globals_1.expect)(result.unit).toBe('ratio');
        }, 30000);
        (0, globals_1.it)('should measure batch processing improvement', async () => {
            const result = await benchmarks.benchmarkBatchProcessing();
            (0, globals_1.expect)(result.name).toBe('Batch Processing Improvement');
            (0, globals_1.expect)(result.actual).toBeGreaterThan(1);
            (0, globals_1.expect)(result.unit).toBe('x faster');
        }, 30000);
        (0, globals_1.it)('should measure compression ratio', async () => {
            const result = await benchmarks.benchmarkCompressionRatio();
            (0, globals_1.expect)(result.name).toBe('Compression Ratio');
            (0, globals_1.expect)(result.actual).toBeGreaterThanOrEqual(0);
            (0, globals_1.expect)(result.actual).toBeLessThanOrEqual(100);
            (0, globals_1.expect)(result.unit).toBe('%');
        }, 30000);
        (0, globals_1.it)('should measure learning overhead', async () => {
            const result = await benchmarks.benchmarkLearningOverhead();
            (0, globals_1.expect)(result.name).toBe('Learning Overhead');
            (0, globals_1.expect)(result.actual).toBeGreaterThanOrEqual(0);
            (0, globals_1.expect)(result.unit).toBe('%');
        }, 30000);
    });
    (0, globals_1.describe)('Profiling', () => {
        (0, globals_1.it)('should profile operations', async () => {
            await benchmarks.profile('test-operation', async () => {
                await perfSystem.getPattern('test-pattern-1');
            });
            const profiles = benchmarks.getProfiles();
            (0, globals_1.expect)(profiles.length).toBeGreaterThan(0);
            const profile = profiles[profiles.length - 1];
            (0, globals_1.expect)(profile.operation).toBe('test-operation');
            (0, globals_1.expect)(profile.duration).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should clear profiling data', () => {
            benchmarks.clearProfiles();
            const profiles = benchmarks.getProfiles();
            (0, globals_1.expect)(profiles.length).toBe(0);
        });
    });
});
(0, globals_1.describe)('Cache System', () => {
    let perfSystem;
    (0, globals_1.beforeAll)(async () => {
        perfSystem = (0, utils_1.createTestPerformanceSystem)();
        await perfSystem.initialize();
    });
    (0, globals_1.afterAll)(async () => {
        await perfSystem.shutdown();
    });
    (0, globals_1.it)('should hit L1 cache for hot patterns', async () => {
        const pattern = {
            id: 'hot-pattern',
            type: 'test',
            patternData: { hot: true },
            confidence: 0.95,
            usageCount: 1000,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };
        await perfSystem.storePattern(pattern);
        for (let i = 0; i < 10; i++) {
            await perfSystem.getPattern('hot-pattern');
        }
        const result = await perfSystem.getPattern('hot-pattern');
        (0, globals_1.expect)(result.cached).toBe(true);
        (0, globals_1.expect)(result.executionTime).toBeLessThan(1);
    });
    (0, globals_1.it)('should promote patterns to faster cache levels', async () => {
        const pattern = {
            id: 'promoted-pattern',
            type: 'test',
            patternData: {},
            confidence: 0.8,
            usageCount: 0,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };
        await perfSystem.storePattern(pattern);
        const result1 = await perfSystem.getPattern('promoted-pattern');
        const time1 = result1.executionTime;
        const result2 = await perfSystem.getPattern('promoted-pattern');
        const time2 = result2.executionTime;
        (0, globals_1.expect)(time2).toBeLessThan(time1);
    });
});
(0, globals_1.describe)('Compression System', () => {
    (0, globals_1.it)('should compress pattern data', async () => {
        const perfSystem = (0, utils_1.createTestPerformanceSystem)();
        await perfSystem.initialize();
        const largePattern = {
            id: 'large-pattern',
            type: 'test',
            patternData: {
                data: 'x'.repeat(10000)
            },
            confidence: 0.8,
            usageCount: 0,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };
        await perfSystem.storePattern(largePattern);
        await perfSystem.flush();
        const metrics = perfSystem.getMetrics();
        (0, globals_1.expect)(metrics.compression.totalCompressed).toBeGreaterThan(0);
        (0, globals_1.expect)(metrics.compression.compressionRatio).toBeLessThan(1);
        await perfSystem.shutdown();
    });
});
//# sourceMappingURL=performance-system.test.js.map