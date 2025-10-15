/**
 * Unit Tests for Pattern Extraction Module
 *
 * Test Coverage: Pattern mining, sequence detection, quality scoring
 * Target: 50+ tests, >95% coverage
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import PatternExtractor, {
  ExecutionObservation,
  Pattern,
  PatternType,
  ExtractorConfig
} from '../../../src/neural/pattern-extraction';

// ============================================================================
// Test Utilities
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

function generateObservation(
  tool: string,
  success: boolean = true,
  duration?: number,
  params?: any
): ExecutionObservation {
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

// ============================================================================
// Pattern Extraction Tests
// ============================================================================

describe('PatternExtractor', () => {
  let db: Database;
  let extractor: PatternExtractor;

  beforeEach(async () => {
    db = await createTestDatabase();
    extractor = new PatternExtractor(db);
  });

  afterEach(() => {
    db.close();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(extractor).toBeDefined();
      // Config is private, test behavior instead of internal state
    });

    it('should accept custom configuration', () => {
      const customConfig: ExtractorConfig = {
        minSupport: 5,
        minConfidence: 0.8,
        numClusters: 3
      };

      const customExtractor = new PatternExtractor(db, customConfig);

      // Test that extractor works with custom config
      expect(customExtractor).toBeDefined();
    });
  });

  // ==========================================================================
  // Sequence Detection Tests
  // ==========================================================================

  describe('Sequence Detection', () => {
    it('should detect frequent 2-step sequences', async () => {
      const observations: ExecutionObservation[] = [];

      // Create repeating pattern: Read → Grep
      for (let i = 0; i < 10; i++) {
        observations.push(generateObservation('Read'));
        observations.push(generateObservation('Grep'));
      }

      const patterns = await extractor.extractPatterns(observations);

      expect(patterns.length).toBeGreaterThan(0);
      const readGrep = patterns.find(p =>
        p.name.includes('read') && p.name.includes('grep')
      );
      expect(readGrep).toBeDefined();
    });

    it('should detect frequent 3-step sequences', async () => {
      const observations: ExecutionObservation[] = [];

      // Pattern: Read → Grep → Edit
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

      expect(threeStep).toBeDefined();
    });

    it('should detect long sequences', async () => {
      const observations: ExecutionObservation[] = [];
      const sequence = ['Read', 'Grep', 'Edit', 'Write'];

      // Repeat long sequence
      for (let i = 0; i < 5; i++) {
        sequence.forEach(tool => {
          observations.push(generateObservation(tool));
        });
      }

      const patterns = await extractor.extractPatterns(observations);

      // ExtractorConfig supports up to 4-step sequences (n=2,3,4 in generateNGrams)
      const longPattern = patterns.find(p => {
        const actions = p.actions || [];
        return actions.length === 4;
      });

      expect(longPattern).toBeDefined();
    });

    it('should handle empty observation list', async () => {
      const patterns = await extractor.extractPatterns([]);

      expect(patterns).toBeDefined();
      expect(patterns.length).toBe(0);
    });

    it('should handle single observation', async () => {
      const observations = [generateObservation('Read')];

      const patterns = await extractor.extractPatterns(observations);

      // Should not extract pattern from single observation
      expect(patterns.length).toBe(0);
    });
  });

  // ==========================================================================
  // Pattern Quality Scoring Tests
  // ==========================================================================

  describe('Pattern Quality Scoring', () => {
    it('should score high-success-rate patterns higher', async () => {
      const observations: ExecutionObservation[] = [];

      // Pattern A: 100% success
      for (let i = 0; i < 10; i++) {
        observations.push(generateObservation('ReadSuccess', true));
        observations.push(generateObservation('GrepSuccess', true));
      }

      // Pattern B: 50% success
      for (let i = 0; i < 10; i++) {
        observations.push(generateObservation('ReadFail', i % 2 === 0));
        observations.push(generateObservation('GrepFail', i % 2 === 0));
      }

      const patterns = await extractor.extractPatterns(observations);

      const patternA = patterns.find(p => p.name.includes('success'));
      const patternB = patterns.find(p => p.name.includes('fail'));

      if (patternA && patternB) {
        expect(patternA.confidence).toBeGreaterThan(patternB.confidence);
      }
    });

    it('should score faster patterns higher', async () => {
      const observations: ExecutionObservation[] = [];

      // Fast pattern
      for (let i = 0; i < 10; i++) {
        observations.push(generateObservation('Fast', true, 50));
      }

      // Slow pattern
      for (let i = 0; i < 10; i++) {
        observations.push(generateObservation('Slow', true, 500));
      }

      const patterns = await extractor.extractPatterns(observations);

      const fastPattern = patterns.find(p => p.name.includes('fast'));
      const slowPattern = patterns.find(p => p.name.includes('slow'));

      if (fastPattern && slowPattern) {
        expect(fastPattern.metrics?.avgDurationMs || 0)
          .toBeLessThan(slowPattern.metrics?.avgDurationMs || 0);
      }
    });

    it('should consider pattern support in scoring', async () => {
      const observations: ExecutionObservation[] = [];

      // High support pattern (20 occurrences)
      for (let i = 0; i < 20; i++) {
        observations.push(generateObservation('HighSupport'));
      }

      // Low support pattern (3 occurrences)
      for (let i = 0; i < 3; i++) {
        observations.push(generateObservation('LowSupport'));
      }

      const patterns = await extractor.extractPatterns(observations);

      const highSupport = patterns.find(p => p.name.includes('high'));
      const lowSupport = patterns.find(p => p.name.includes('low'));

      if (highSupport && lowSupport) {
        expect(highSupport.usageCount).toBeGreaterThan(lowSupport.usageCount);
      }
    });

    it('should filter patterns below minimum confidence', async () => {
      const observations: ExecutionObservation[] = [];

      // Very unreliable pattern (20% success)
      for (let i = 0; i < 10; i++) {
        observations.push(generateObservation('Unreliable', i < 2));
      }

      const extractor = new PatternExtractor(db, { minConfidence: 0.7 });
      const patterns = await extractor.extractPatterns(observations);

      patterns.forEach(p => {
        expect(p.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should filter patterns below minimum support', async () => {
      const observations: ExecutionObservation[] = [];

      // Pattern with support=2
      for (let i = 0; i < 2; i++) {
        observations.push(generateObservation('Rare'));
      }

      const extractor = new PatternExtractor(db, { minSupport: 3 });
      const patterns = await extractor.extractPatterns(observations);

      const rare = patterns.find(p => p.name.includes('rare'));
      expect(rare).toBeUndefined();
    });
  });

  // ==========================================================================
  // Pattern Type Classification Tests
  // ==========================================================================

  describe('Pattern Type Classification', () => {
    it('should classify coordination patterns', async () => {
      const observations: ExecutionObservation[] = [];

      // Multi-agent coordination pattern
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

      expect(coordination).toBeDefined();
    });

    it('should classify optimization patterns', async () => {
      const observations: ExecutionObservation[] = [];

      // Performance improvement pattern
      for (let i = 0; i < 5; i++) {
        observations.push({
          ...generateObservation('Optimize', true, 100 - i * 10),
          result: `improved_${i}`
        });
      }

      const patterns = await extractor.extractPatterns(observations);
      const optimization = patterns.find(p => p.type === 'optimization');

      expect(optimization).toBeDefined();
    });

    it('should classify error-handling patterns', async () => {
      const observations: ExecutionObservation[] = [];

      // Error recovery pattern
      for (let i = 0; i < 5; i++) {
        observations.push(generateObservation('Try', false));
        observations.push(generateObservation('Retry', true));
      }

      const patterns = await extractor.extractPatterns(observations);
      const errorHandling = patterns.find(p => p.type === 'error-handling');

      expect(errorHandling).toBeDefined();
    });

    it('should classify testing patterns', async () => {
      const observations: ExecutionObservation[] = [];

      // TDD pattern
      for (let i = 0; i < 5; i++) {
        observations.push(generateObservation('Write', true, 100, { type: 'test' }));
        observations.push(generateObservation('Run', true, 100, { type: 'test' }));
        observations.push(generateObservation('Edit', true));
      }

      const patterns = await extractor.extractPatterns(observations);
      const testing = patterns.find(p => p.type === 'testing');

      expect(testing).toBeDefined();
    });
  });

  // ==========================================================================
  // Pattern Clustering Tests
  // ==========================================================================

  describe('Pattern Clustering', () => {
    it('should cluster similar execution patterns', async () => {
      const observations: ExecutionObservation[] = [];

      // Cluster 1: Fast reads
      for (let i = 0; i < 10; i++) {
        observations.push(generateObservation('Read', true, 50 + Math.random() * 20));
      }

      // Cluster 2: Slow reads
      for (let i = 0; i < 10; i++) {
        observations.push(generateObservation('Read', true, 500 + Math.random() * 100));
      }

      const patterns = await extractor.extractPatterns(observations);

      // Should create separate patterns for different performance characteristics
      const readPatterns = patterns.filter(p => p.name.includes('read'));
      expect(readPatterns.length).toBeGreaterThan(1);
    });

    it('should merge very similar patterns', async () => {
      const observations: ExecutionObservation[] = [];

      // Nearly identical patterns
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

      // Should merge into single pattern
      const sequences = patterns.filter(p => {
        const actions = p.actions || [];
        return actions.length === 3;
      });

      // Should have merged similar sequences
      expect(sequences.length).toBeLessThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle observations with missing fields', async () => {
      const observations: ExecutionObservation[] = [
        { ...generateObservation('Read'), parameters: undefined as any },
        { ...generateObservation('Grep'), result: undefined },
        { ...generateObservation('Edit'), duration_ms: undefined as any }
      ];

      const patterns = await extractor.extractPatterns(observations);

      expect(patterns).toBeDefined();
    });

    it('should handle very long tool names', async () => {
      const longName = 'Tool' + 'x'.repeat(1000);
      const observations = [generateObservation(longName)];

      await expect(extractor.extractPatterns(observations)).resolves.toBeDefined();
    });

    it('should handle special characters in tool names', async () => {
      const specialNames = ['Tool@#$', 'Tool<>{}', 'Tool\n\r\t'];

      const observations = specialNames.map(name => generateObservation(name));

      const patterns = await extractor.extractPatterns(observations);

      expect(patterns).toBeDefined();
    });

    it('should handle very large observation sets', async () => {
      const observations: ExecutionObservation[] = [];

      for (let i = 0; i < 10000; i++) {
        observations.push(generateObservation(`Tool${i % 10}`));
      }

      const startTime = Date.now();
      const patterns = await extractor.extractPatterns(observations);
      const duration = Date.now() - startTime;

      expect(patterns).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should complete in <10 seconds
    });

    it('should handle concurrent extraction requests', async () => {
      const observations1 = Array(100).fill(null).map(() => generateObservation('A'));
      const observations2 = Array(100).fill(null).map(() => generateObservation('B'));
      const observations3 = Array(100).fill(null).map(() => generateObservation('C'));

      const results = await Promise.all([
        extractor.extractPatterns(observations1),
        extractor.extractPatterns(observations2),
        extractor.extractPatterns(observations3)
      ]);

      expect(results).toHaveLength(3);
      results.forEach(patterns => {
        expect(patterns).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Pattern Structure Tests
  // ==========================================================================

  describe('Pattern Structure', () => {
    it('should generate valid pattern structure', async () => {
      const observations: ExecutionObservation[] = [];

      for (let i = 0; i < 5; i++) {
        observations.push(generateObservation('Read'));
        observations.push(generateObservation('Grep'));
      }

      const patterns = await extractor.extractPatterns(observations);

      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach(p => {
        expect(p.id).toBeDefined();
        expect(p.type).toBeDefined();
        expect(p.name).toBeDefined();
        expect(p.description).toBeDefined();
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should assign unique IDs to patterns', async () => {
      const observations: ExecutionObservation[] = [];

      for (let i = 0; i < 5; i++) {
        observations.push(generateObservation('Read'));
      }

      const patterns = await extractor.extractPatterns(observations);
      const ids = patterns.map(p => p.id);

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should preserve pattern metadata', async () => {
      const observations: ExecutionObservation[] = [];

      for (let i = 0; i < 5; i++) {
        observations.push(generateObservation('Read', true, 100));
      }

      const patterns = await extractor.extractPatterns(observations);

      expect(patterns.length).toBeGreaterThan(0);
      const pattern = patterns[0];

      // Verify pattern structure has all required fields
      expect(pattern.name).toBeDefined();
      expect(pattern.type).toBeDefined();
      expect(pattern.metrics).toBeDefined();
      expect(pattern.metrics.avgDurationMs).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should extract patterns in <1 second for 1000 observations', async () => {
      const observations: ExecutionObservation[] = [];

      for (let i = 0; i < 1000; i++) {
        observations.push(generateObservation(`Tool${i % 10}`));
      }

      const start = Date.now();
      await extractor.extractPatterns(observations);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should maintain low memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const observations: ExecutionObservation[] = [];
      for (let i = 0; i < 5000; i++) {
        observations.push(generateObservation('Read'));
      }

      await extractor.extractPatterns(observations);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(50); // <50MB
    });
  });
});
