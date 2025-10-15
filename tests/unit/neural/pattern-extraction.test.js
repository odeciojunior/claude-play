"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const sqlite3_1 = require("sqlite3");
const util_1 = require("util");
const pattern_extraction_1 = __importDefault(require("../../../src/neural/pattern-extraction"));
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
    return db;
}
function generateObservation(tool, success = true, duration, params) {
    return {
        id: `obs-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        tool,
        parameters: params || { test: 'param' },
        result: success ? 'success' : null,
        duration_ms: duration || (100 + Math.random() * 400),
        success,
        error: success ? undefined : 'Test error',
        context: {
            taskId: 'test-task',
            agentId: 'test-agent',
            workingDirectory: '/test',
            activePatterns: [],
            priorSteps: 0,
            environmentVars: { NODE_ENV: 'test' }
        }
    };
}
(0, globals_1.describe)('PatternExtractor', () => {
    let db;
    let extractor;
    (0, globals_1.beforeEach)(async () => {
        db = await createTestDatabase();
        extractor = new pattern_extraction_1.default(db);
    });
    (0, globals_1.afterEach)(() => {
        db.close();
    });
    (0, globals_1.describe)('Initialization', () => {
        (0, globals_1.it)('should initialize with default configuration', () => {
            (0, globals_1.expect)(extractor).toBeDefined();
            (0, globals_1.expect)(extractor.config).toBeDefined();
            (0, globals_1.expect)(extractor.config.minSupport).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should accept custom configuration', () => {
            const customConfig = {
                minSupport: 5,
                minConfidence: 0.8,
                maxPatternLength: 10
            };
            const customExtractor = new pattern_extraction_1.default(db, customConfig);
            (0, globals_1.expect)(customExtractor.config.minSupport).toBe(5);
            (0, globals_1.expect)(customExtractor.config.minConfidence).toBe(0.8);
            (0, globals_1.expect)(customExtractor.config.maxPatternLength).toBe(10);
        });
        (0, globals_1.it)('should validate configuration parameters', () => {
            const invalidConfig = {
                minSupport: -1,
                minConfidence: 1.5,
                maxPatternLength: 0
            };
            (0, globals_1.expect)(() => {
                new pattern_extraction_1.default(db, invalidConfig);
            }).toThrow();
        });
    });
    (0, globals_1.describe)('Sequence Detection', () => {
        (0, globals_1.it)('should detect frequent 2-step sequences', async () => {
            const observations = [];
            for (let i = 0; i < 10; i++) {
                observations.push(generateObservation('Read'));
                observations.push(generateObservation('Grep'));
            }
            const patterns = await extractor.extractPatterns(observations);
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
            const readGrep = patterns.find(p => p.name.includes('read') && p.name.includes('grep'));
            (0, globals_1.expect)(readGrep).toBeDefined();
        });
        (0, globals_1.it)('should detect frequent 3-step sequences', async () => {
            const observations = [];
            for (let i = 0; i < 8; i++) {
                observations.push(generateObservation('Read'));
                observations.push(generateObservation('Grep'));
                observations.push(generateObservation('Edit'));
            }
            const patterns = await extractor.extractPatterns(observations);
            const threeStep = patterns.find(p => {
                const actions = p.actions || [];
                return actions.length === 3;
            });
            (0, globals_1.expect)(threeStep).toBeDefined();
        });
        (0, globals_1.it)('should detect long sequences up to maxPatternLength', async () => {
            const observations = [];
            const sequence = ['Read', 'Grep', 'Edit', 'Write', 'Bash'];
            for (let i = 0; i < 5; i++) {
                sequence.forEach(tool => {
                    observations.push(generateObservation(tool));
                });
            }
            const extractor = new pattern_extraction_1.default(db, { maxPatternLength: 5 });
            const patterns = await extractor.extractPatterns(observations);
            const longPattern = patterns.find(p => {
                const actions = p.actions || [];
                return actions.length === 5;
            });
            (0, globals_1.expect)(longPattern).toBeDefined();
        });
        (0, globals_1.it)('should respect maxPatternLength limit', async () => {
            const observations = [];
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 10; j++) {
                    observations.push(generateObservation(`Tool${j}`));
                }
            }
            const extractor = new pattern_extraction_1.default(db, { maxPatternLength: 5 });
            const patterns = await extractor.extractPatterns(observations);
            patterns.forEach(p => {
                (0, globals_1.expect)(p.actions?.length || 0).toBeLessThanOrEqual(5);
            });
        });
        (0, globals_1.it)('should handle empty observation list', async () => {
            const patterns = await extractor.extractPatterns([]);
            (0, globals_1.expect)(patterns).toBeDefined();
            (0, globals_1.expect)(patterns.length).toBe(0);
        });
        (0, globals_1.it)('should handle single observation', async () => {
            const observations = [generateObservation('Read')];
            const patterns = await extractor.extractPatterns(observations);
            (0, globals_1.expect)(patterns.length).toBe(0);
        });
    });
    (0, globals_1.describe)('Pattern Quality Scoring', () => {
        (0, globals_1.it)('should score high-success-rate patterns higher', async () => {
            const observations = [];
            for (let i = 0; i < 10; i++) {
                observations.push(generateObservation('ReadSuccess', true));
                observations.push(generateObservation('GrepSuccess', true));
            }
            for (let i = 0; i < 10; i++) {
                observations.push(generateObservation('ReadFail', i % 2 === 0));
                observations.push(generateObservation('GrepFail', i % 2 === 0));
            }
            const patterns = await extractor.extractPatterns(observations);
            const patternA = patterns.find(p => p.name.includes('success'));
            const patternB = patterns.find(p => p.name.includes('fail'));
            if (patternA && patternB) {
                (0, globals_1.expect)(patternA.confidence).toBeGreaterThan(patternB.confidence);
            }
        });
        (0, globals_1.it)('should score faster patterns higher', async () => {
            const observations = [];
            for (let i = 0; i < 10; i++) {
                observations.push(generateObservation('Fast', true, 50));
            }
            for (let i = 0; i < 10; i++) {
                observations.push(generateObservation('Slow', true, 500));
            }
            const patterns = await extractor.extractPatterns(observations);
            const fastPattern = patterns.find(p => p.name.includes('fast'));
            const slowPattern = patterns.find(p => p.name.includes('slow'));
            if (fastPattern && slowPattern) {
                (0, globals_1.expect)(fastPattern.metrics?.avgDurationMs || 0)
                    .toBeLessThan(slowPattern.metrics?.avgDurationMs || 0);
            }
        });
        (0, globals_1.it)('should consider pattern support in scoring', async () => {
            const observations = [];
            for (let i = 0; i < 20; i++) {
                observations.push(generateObservation('HighSupport'));
            }
            for (let i = 0; i < 3; i++) {
                observations.push(generateObservation('LowSupport'));
            }
            const patterns = await extractor.extractPatterns(observations);
            const highSupport = patterns.find(p => p.name.includes('high'));
            const lowSupport = patterns.find(p => p.name.includes('low'));
            if (highSupport && lowSupport) {
                (0, globals_1.expect)(highSupport.usageCount).toBeGreaterThan(lowSupport.usageCount);
            }
        });
        (0, globals_1.it)('should filter patterns below minimum confidence', async () => {
            const observations = [];
            for (let i = 0; i < 10; i++) {
                observations.push(generateObservation('Unreliable', i < 2));
            }
            const extractor = new pattern_extraction_1.default(db, { minConfidence: 0.7 });
            const patterns = await extractor.extractPatterns(observations);
            patterns.forEach(p => {
                (0, globals_1.expect)(p.confidence).toBeGreaterThanOrEqual(0.7);
            });
        });
        (0, globals_1.it)('should filter patterns below minimum support', async () => {
            const observations = [];
            for (let i = 0; i < 2; i++) {
                observations.push(generateObservation('Rare'));
            }
            const extractor = new pattern_extraction_1.default(db, { minSupport: 3 });
            const patterns = await extractor.extractPatterns(observations);
            const rare = patterns.find(p => p.name.includes('rare'));
            (0, globals_1.expect)(rare).toBeUndefined();
        });
    });
    (0, globals_1.describe)('Pattern Type Classification', () => {
        (0, globals_1.it)('should classify coordination patterns', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push({
                    ...generateObservation('Task'),
                    context: {
                        ...generateObservation('Task').context,
                        agentId: `agent-${i % 3}`
                    }
                });
            }
            const patterns = await extractor.extractPatterns(observations);
            const coordination = patterns.find(p => p.type === 'coordination');
            (0, globals_1.expect)(coordination).toBeDefined();
        });
        (0, globals_1.it)('should classify optimization patterns', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push({
                    ...generateObservation('Optimize', true, 100 - i * 10),
                    result: `improved_${i}`
                });
            }
            const patterns = await extractor.extractPatterns(observations);
            const optimization = patterns.find(p => p.type === 'optimization');
            (0, globals_1.expect)(optimization).toBeDefined();
        });
        (0, globals_1.it)('should classify error-handling patterns', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push(generateObservation('Try', false));
                observations.push(generateObservation('Retry', true));
            }
            const patterns = await extractor.extractPatterns(observations);
            const errorHandling = patterns.find(p => p.type === 'error-handling');
            (0, globals_1.expect)(errorHandling).toBeDefined();
        });
        (0, globals_1.it)('should classify testing patterns', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push(generateObservation('Write', true, 100, { type: 'test' }));
                observations.push(generateObservation('Run', true, 100, { type: 'test' }));
                observations.push(generateObservation('Edit', true));
            }
            const patterns = await extractor.extractPatterns(observations);
            const testing = patterns.find(p => p.type === 'testing');
            (0, globals_1.expect)(testing).toBeDefined();
        });
    });
    (0, globals_1.describe)('Pattern Clustering', () => {
        (0, globals_1.it)('should cluster similar execution patterns', async () => {
            const observations = [];
            for (let i = 0; i < 10; i++) {
                observations.push(generateObservation('Read', true, 50 + Math.random() * 20));
            }
            for (let i = 0; i < 10; i++) {
                observations.push(generateObservation('Read', true, 500 + Math.random() * 100));
            }
            const patterns = await extractor.extractPatterns(observations);
            const readPatterns = patterns.filter(p => p.name.includes('read'));
            (0, globals_1.expect)(readPatterns.length).toBeGreaterThan(1);
        });
        (0, globals_1.it)('should merge very similar patterns', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push(generateObservation('Read'));
                observations.push(generateObservation('Grep'));
                observations.push(generateObservation('Edit'));
            }
            for (let i = 0; i < 5; i++) {
                observations.push(generateObservation('Read'));
                observations.push(generateObservation('Grep'));
                observations.push(generateObservation('Edit'));
            }
            const patterns = await extractor.extractPatterns(observations);
            const sequences = patterns.filter(p => {
                const actions = p.actions || [];
                return actions.length === 3;
            });
            (0, globals_1.expect)(sequences.length).toBeLessThanOrEqual(2);
        });
    });
    (0, globals_1.describe)('Edge Cases', () => {
        (0, globals_1.it)('should handle observations with missing fields', async () => {
            const observations = [
                { ...generateObservation('Read'), parameters: undefined },
                { ...generateObservation('Grep'), result: undefined },
                { ...generateObservation('Edit'), duration_ms: undefined }
            ];
            const patterns = await extractor.extractPatterns(observations);
            (0, globals_1.expect)(patterns).toBeDefined();
        });
        (0, globals_1.it)('should handle very long tool names', async () => {
            const longName = 'Tool' + 'x'.repeat(1000);
            const observations = [generateObservation(longName)];
            await (0, globals_1.expect)(extractor.extractPatterns(observations)).resolves.toBeDefined();
        });
        (0, globals_1.it)('should handle special characters in tool names', async () => {
            const specialNames = ['Tool@#$', 'Tool<>{}', 'Tool\n\r\t'];
            const observations = specialNames.map(name => generateObservation(name));
            const patterns = await extractor.extractPatterns(observations);
            (0, globals_1.expect)(patterns).toBeDefined();
        });
        (0, globals_1.it)('should handle very large observation sets', async () => {
            const observations = [];
            for (let i = 0; i < 10000; i++) {
                observations.push(generateObservation(`Tool${i % 10}`));
            }
            const startTime = Date.now();
            const patterns = await extractor.extractPatterns(observations);
            const duration = Date.now() - startTime;
            (0, globals_1.expect)(patterns).toBeDefined();
            (0, globals_1.expect)(duration).toBeLessThan(10000);
        });
        (0, globals_1.it)('should handle concurrent extraction requests', async () => {
            const observations1 = Array(100).fill(null).map(() => generateObservation('A'));
            const observations2 = Array(100).fill(null).map(() => generateObservation('B'));
            const observations3 = Array(100).fill(null).map(() => generateObservation('C'));
            const results = await Promise.all([
                extractor.extractPatterns(observations1),
                extractor.extractPatterns(observations2),
                extractor.extractPatterns(observations3)
            ]);
            (0, globals_1.expect)(results).toHaveLength(3);
            results.forEach(patterns => {
                (0, globals_1.expect)(patterns).toBeDefined();
            });
        });
    });
    (0, globals_1.describe)('Pattern Persistence', () => {
        (0, globals_1.it)('should store extracted patterns in database', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push(generateObservation('Read'));
                observations.push(generateObservation('Grep'));
            }
            const patterns = await extractor.extractPatterns(observations);
            for (const pattern of patterns) {
                await extractor.storePattern(pattern);
            }
            const get = (0, util_1.promisify)(db.get.bind(db));
            const storedPattern = await get('SELECT * FROM patterns LIMIT 1');
            (0, globals_1.expect)(storedPattern).toBeDefined();
        });
        (0, globals_1.it)('should assign unique IDs to patterns', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push(generateObservation('Read'));
            }
            const patterns = await extractor.extractPatterns(observations);
            const ids = patterns.map(p => p.id);
            const uniqueIds = new Set(ids);
            (0, globals_1.expect)(uniqueIds.size).toBe(ids.length);
        });
        (0, globals_1.it)('should preserve pattern metadata', async () => {
            const observations = [];
            for (let i = 0; i < 5; i++) {
                observations.push(generateObservation('Read', true, 100));
            }
            const patterns = await extractor.extractPatterns(observations);
            const pattern = patterns[0];
            await extractor.storePattern(pattern);
            const get = (0, util_1.promisify)(db.get.bind(db));
            const stored = await get('SELECT * FROM patterns WHERE id = ?', pattern.id);
            const storedData = JSON.parse(stored.pattern_data);
            (0, globals_1.expect)(storedData.name).toBe(pattern.name);
            (0, globals_1.expect)(storedData.type).toBe(pattern.type);
        });
    });
    (0, globals_1.describe)('Performance', () => {
        (0, globals_1.it)('should extract patterns in <1 second for 1000 observations', async () => {
            const observations = [];
            for (let i = 0; i < 1000; i++) {
                observations.push(generateObservation(`Tool${i % 10}`));
            }
            const start = Date.now();
            await extractor.extractPatterns(observations);
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(1000);
        });
        (0, globals_1.it)('should maintain low memory usage', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const observations = [];
            for (let i = 0; i < 5000; i++) {
                observations.push(generateObservation('Read'));
            }
            await extractor.extractPatterns(observations);
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;
            (0, globals_1.expect)(memoryIncreaseMB).toBeLessThan(50);
        });
    });
});
//# sourceMappingURL=pattern-extraction.test.js.map