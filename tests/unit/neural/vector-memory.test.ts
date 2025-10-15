/**
 * Unit Tests for Vector Memory Layer
 *
 * Test Coverage: Semantic embeddings, similarity search, retrieval
 * Target: 80+ tests, >95% coverage
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import VectorMemory, {
  VectorConfig,
  Embedding,
  SimilarityResult
} from '../../../src/neural/vector-memory';

// ============================================================================
// Vector Memory Tests
// ============================================================================

describe('VectorMemory', () => {
  let vectorMemory: VectorMemory;

  beforeEach(() => {
    vectorMemory = new VectorMemory({
      dimensions: 384,
      similarityThreshold: 0.8,
      maxResults: 10
    });
  });

  afterEach(async () => {
    await vectorMemory.clear();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(vectorMemory).toBeDefined();
      expect(vectorMemory.config.dimensions).toBe(384);
    });

    it('should accept custom configuration', () => {
      const custom = new VectorMemory({
        dimensions: 768,
        similarityThreshold: 0.9,
        maxResults: 20
      });

      expect(custom.config.dimensions).toBe(768);
      expect(custom.config.similarityThreshold).toBe(0.9);
    });

    it('should validate configuration', () => {
      expect(() => {
        new VectorMemory({ dimensions: -1, similarityThreshold: 0.5, maxResults: 10 });
      }).toThrow();

      expect(() => {
        new VectorMemory({ dimensions: 384, similarityThreshold: 1.5, maxResults: 10 });
      }).toThrow();
    });
  });

  // ==========================================================================
  // Embedding Generation Tests
  // ==========================================================================

  describe('Embedding Generation', () => {
    it('should generate embeddings from text', async () => {
      const text = 'user authentication flow';
      const embedding = await vectorMemory.embed(text);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
      expect(embedding.every(x => typeof x === 'number')).toBe(true);
    });

    it('should normalize embeddings to unit length', async () => {
      const text = 'test normalization';
      const embedding = await vectorMemory.embed(text);

      // Calculate magnitude
      const magnitude = Math.sqrt(
        embedding.reduce((sum, x) => sum + x * x, 0)
      );

      expect(Math.abs(magnitude - 1.0)).toBeLessThan(0.01);
    });

    it('should handle empty text', async () => {
      const embedding = await vectorMemory.embed('');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
    });

    it('should handle very long text', async () => {
      const longText = 'word '.repeat(10000);
      const embedding = await vectorMemory.embed(longText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
    });

    it('should handle special characters', async () => {
      const special = '!@#$%^&*(){}[]<>?/\n\r\t';
      const embedding = await vectorMemory.embed(special);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
    });

    it('should produce similar embeddings for similar text', async () => {
      const text1 = 'user authentication';
      const text2 = 'user login';

      const emb1 = await vectorMemory.embed(text1);
      const emb2 = await vectorMemory.embed(text2);

      const similarity = vectorMemory.cosineSimilarity(emb1, emb2);

      expect(similarity).toBeGreaterThan(0.7);
    });

    it('should produce different embeddings for different text', async () => {
      const text1 = 'user authentication';
      const text2 = 'database migration';

      const emb1 = await vectorMemory.embed(text1);
      const emb2 = await vectorMemory.embed(text2);

      const similarity = vectorMemory.cosineSimilarity(emb1, emb2);

      expect(similarity).toBeLessThan(0.7);
    });
  });

  // ==========================================================================
  // Storage and Retrieval Tests
  // ==========================================================================

  describe('Storage and Retrieval', () => {
    it('should store embeddings with IDs', async () => {
      const id = 'pattern-1';
      const text = 'test pattern';
      const embedding = await vectorMemory.embed(text);

      await vectorMemory.store(id, embedding, { text });

      const stored = await vectorMemory.get(id);
      expect(stored).toBeDefined();
      expect(stored?.id).toBe(id);
    });

    it('should retrieve stored embeddings', async () => {
      const id = 'pattern-2';
      const embedding = await vectorMemory.embed('retrieval test');

      await vectorMemory.store(id, embedding);

      const retrieved = await vectorMemory.get(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.embedding).toEqual(embedding);
    });

    it('should return null for non-existent IDs', async () => {
      const result = await vectorMemory.get('non-existent');
      expect(result).toBeNull();
    });

    it('should update existing embeddings', async () => {
      const id = 'pattern-3';
      const emb1 = await vectorMemory.embed('original');
      const emb2 = await vectorMemory.embed('updated');

      await vectorMemory.store(id, emb1);
      await vectorMemory.store(id, emb2);

      const retrieved = await vectorMemory.get(id);
      expect(retrieved?.embedding).toEqual(emb2);
    });

    it('should store metadata with embeddings', async () => {
      const id = 'pattern-4';
      const embedding = await vectorMemory.embed('metadata test');
      const metadata = {
        type: 'coordination',
        confidence: 0.85,
        createdAt: new Date().toISOString()
      };

      await vectorMemory.store(id, embedding, metadata);

      const retrieved = await vectorMemory.get(id);
      expect(retrieved?.metadata).toEqual(metadata);
    });

    it('should handle large metadata objects', async () => {
      const id = 'pattern-5';
      const embedding = await vectorMemory.embed('large metadata');
      const largeMetadata = {
        data: 'x'.repeat(10000),
        nested: { deep: { structure: { with: { many: { levels: 'value' } } } } }
      };

      await vectorMemory.store(id, embedding, largeMetadata);

      const retrieved = await vectorMemory.get(id);
      expect(retrieved?.metadata).toEqual(largeMetadata);
    });
  });

  // ==========================================================================
  // Similarity Search Tests
  // ==========================================================================

  describe('Similarity Search', () => {
    beforeEach(async () => {
      // Pre-populate with test data
      const data = [
        { id: 'auth-1', text: 'user authentication flow' },
        { id: 'auth-2', text: 'user login system' },
        { id: 'auth-3', text: 'signup registration' },
        { id: 'db-1', text: 'database migration script' },
        { id: 'db-2', text: 'SQL query optimization' },
        { id: 'api-1', text: 'REST API endpoint' },
        { id: 'api-2', text: 'GraphQL resolver' }
      ];

      for (const item of data) {
        const embedding = await vectorMemory.embed(item.text);
        await vectorMemory.store(item.id, embedding, { text: item.text });
      }
    });

    it('should find similar embeddings', async () => {
      const query = 'user login authentication';
      const queryEmbedding = await vectorMemory.embed(query);

      const results = await vectorMemory.findSimilar(queryEmbedding);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toMatch(/^auth-/);
    });

    it('should return top-k results', async () => {
      const query = 'authentication';
      const queryEmbedding = await vectorMemory.embed(query);

      const results = await vectorMemory.findSimilar(queryEmbedding, {
        limit: 2
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by similarity threshold', async () => {
      const query = 'user authentication';
      const queryEmbedding = await vectorMemory.embed(query);

      const results = await vectorMemory.findSimilar(queryEmbedding, {
        threshold: 0.9
      });

      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should rank results by similarity score', async () => {
      const query = 'user login';
      const queryEmbedding = await vectorMemory.embed(query);

      const results = await vectorMemory.findSimilar(queryEmbedding);

      // Verify descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i].similarity).toBeLessThanOrEqual(results[i - 1].similarity);
      }
    });

    it('should handle queries with no similar results', async () => {
      const query = 'quantum computing blockchain AI';
      const queryEmbedding = await vectorMemory.embed(query);

      const results = await vectorMemory.findSimilar(queryEmbedding, {
        threshold: 0.95
      });

      expect(results.length).toBe(0);
    });

    it('should support filtering by metadata', async () => {
      // Add patterns with metadata
      await vectorMemory.store('pattern-a', await vectorMemory.embed('test a'), {
        type: 'coordination'
      });
      await vectorMemory.store('pattern-b', await vectorMemory.embed('test b'), {
        type: 'optimization'
      });

      const query = await vectorMemory.embed('test');

      const results = await vectorMemory.findSimilar(query, {
        filter: { type: 'coordination' }
      });

      expect(results.every(r => r.metadata?.type === 'coordination')).toBe(true);
    });
  });

  // ==========================================================================
  // Cosine Similarity Tests
  // ==========================================================================

  describe('Cosine Similarity', () => {
    it('should calculate similarity correctly', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];

      const similarity = vectorMemory.cosineSimilarity(vec1, vec2);

      expect(Math.abs(similarity - 1.0)).toBeLessThan(0.01);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];

      const similarity = vectorMemory.cosineSimilarity(vec1, vec2);

      expect(Math.abs(similarity - 0.0)).toBeLessThan(0.01);
    });

    it('should return -1 for opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];

      const similarity = vectorMemory.cosineSimilarity(vec1, vec2);

      expect(Math.abs(similarity - (-1.0))).toBeLessThan(0.01);
    });

    it('should handle zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 0, 0];

      const similarity = vectorMemory.cosineSimilarity(vec1, vec2);

      expect(similarity).toBe(0);
    });

    it('should handle different magnitude vectors', () => {
      const vec1 = [1, 1, 1];
      const vec2 = [2, 2, 2]; // Same direction, different magnitude

      const similarity = vectorMemory.cosineSimilarity(vec1, vec2);

      expect(Math.abs(similarity - 1.0)).toBeLessThan(0.01);
    });

    it('should handle negative values', () => {
      const vec1 = [1, -1, 1];
      const vec2 = [1, -1, 1];

      const similarity = vectorMemory.cosineSimilarity(vec1, vec2);

      expect(Math.abs(similarity - 1.0)).toBeLessThan(0.01);
    });
  });

  // ==========================================================================
  // Batch Operations Tests
  // ==========================================================================

  describe('Batch Operations', () => {
    it('should store multiple embeddings efficiently', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `batch-${i}`,
        text: `pattern ${i}`
      }));

      const start = Date.now();

      await vectorMemory.storeBatch(
        items.map(async item => ({
          id: item.id,
          embedding: await vectorMemory.embed(item.text),
          metadata: { text: item.text }
        }))
      );

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // <5 seconds for 100 items
    });

    it('should retrieve multiple embeddings', async () => {
      const ids = ['test-1', 'test-2', 'test-3'];

      for (const id of ids) {
        const embedding = await vectorMemory.embed(`text for ${id}`);
        await vectorMemory.store(id, embedding);
      }

      const results = await vectorMemory.getBatch(ids);

      expect(results.length).toBe(3);
      expect(results.every(r => r !== null)).toBe(true);
    });

    it('should handle partial batch results', async () => {
      await vectorMemory.store('exists-1', await vectorMemory.embed('test'));

      const results = await vectorMemory.getBatch([
        'exists-1',
        'does-not-exist',
        'also-missing'
      ]);

      expect(results.filter(r => r !== null).length).toBe(1);
    });
  });

  // ==========================================================================
  // Memory Management Tests
  // ==========================================================================

  describe('Memory Management', () => {
    it('should delete embeddings', async () => {
      const id = 'delete-test';
      await vectorMemory.store(id, await vectorMemory.embed('test'));

      await vectorMemory.delete(id);

      const retrieved = await vectorMemory.get(id);
      expect(retrieved).toBeNull();
    });

    it('should clear all embeddings', async () => {
      for (let i = 0; i < 10; i++) {
        await vectorMemory.store(`clear-${i}`, await vectorMemory.embed(`test ${i}`));
      }

      await vectorMemory.clear();

      const count = await vectorMemory.count();
      expect(count).toBe(0);
    });

    it('should count stored embeddings', async () => {
      const initial = await vectorMemory.count();

      for (let i = 0; i < 5; i++) {
        await vectorMemory.store(`count-${i}`, await vectorMemory.embed(`test ${i}`));
      }

      const final = await vectorMemory.count();
      expect(final - initial).toBe(5);
    });

    it('should list all stored IDs', async () => {
      const ids = ['list-1', 'list-2', 'list-3'];

      for (const id of ids) {
        await vectorMemory.store(id, await vectorMemory.embed('test'));
      }

      const stored = await vectorMemory.listIds();

      ids.forEach(id => {
        expect(stored).toContain(id);
      });
    });

    it('should support memory compaction', async () => {
      // Store many embeddings
      for (let i = 0; i < 1000; i++) {
        await vectorMemory.store(`compact-${i}`, await vectorMemory.embed(`test ${i}`));
      }

      // Delete half
      for (let i = 0; i < 500; i++) {
        await vectorMemory.delete(`compact-${i}`);
      }

      // Compact
      await vectorMemory.compact();

      const count = await vectorMemory.count();
      expect(count).toBe(500);
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should generate embeddings quickly', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `test text ${i}`);

      const start = Date.now();

      await Promise.all(texts.map(text => vectorMemory.embed(text)));

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // <10 seconds for 100 embeddings
    });

    it('should perform similarity search quickly', async () => {
      // Pre-populate with 1000 embeddings
      for (let i = 0; i < 1000; i++) {
        const embedding = await vectorMemory.embed(`pattern ${i}`);
        await vectorMemory.store(`perf-${i}`, embedding);
      }

      const query = await vectorMemory.embed('test query');

      const start = Date.now();
      await vectorMemory.findSimilar(query, { limit: 10 });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // <100ms search time
    });

    it('should maintain memory efficiency', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Store 5000 embeddings
      for (let i = 0; i < 5000; i++) {
        const embedding = await vectorMemory.embed(`memory test ${i}`);
        await vectorMemory.store(`mem-${i}`, embedding);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

      expect(memoryIncreaseMB).toBeLessThan(200); // <200MB for 5000 embeddings
    });

    it('should handle concurrent operations', async () => {
      const operations = [];

      for (let i = 0; i < 100; i++) {
        operations.push(
          vectorMemory.store(
            `concurrent-${i}`,
            await vectorMemory.embed(`test ${i}`)
          )
        );
      }

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle invalid embedding dimensions', async () => {
      await expect(
        vectorMemory.store('invalid', [1, 2, 3]) // Wrong dimensions
      ).rejects.toThrow();
    });

    it('should handle non-numeric embeddings', async () => {
      await expect(
        vectorMemory.store('invalid', ['a', 'b', 'c'] as any)
      ).rejects.toThrow();
    });

    it('should handle NaN values in embeddings', async () => {
      const embedding = Array(384).fill(NaN);

      await expect(vectorMemory.store('nan', embedding)).rejects.toThrow();
    });

    it('should handle Infinity in embeddings', async () => {
      const embedding = Array(384).fill(Infinity);

      await expect(vectorMemory.store('infinity', embedding)).rejects.toThrow();
    });

    it('should handle empty ID', async () => {
      const embedding = await vectorMemory.embed('test');

      await expect(vectorMemory.store('', embedding)).rejects.toThrow();
    });

    it('should handle very long IDs', async () => {
      const longId = 'id-' + 'x'.repeat(10000);
      const embedding = await vectorMemory.embed('test');

      await expect(vectorMemory.store(longId, embedding)).resolves.toBeDefined();
    });

    it('should handle special characters in IDs', async () => {
      const specialId = 'id-!@#$%^&*(){}[]<>?/';
      const embedding = await vectorMemory.embed('test');

      await expect(vectorMemory.store(specialId, embedding)).resolves.toBeDefined();
    });
  });

  // ==========================================================================
  // Compression Tests
  // ==========================================================================

  describe('Compression', () => {
    it('should compress embeddings efficiently', async () => {
      const text = 'compression test';
      const embedding = await vectorMemory.embed(text);

      const uncompressed = JSON.stringify(embedding).length;
      const compressed = await vectorMemory.compress(embedding);
      const compressedSize = compressed.length;

      const ratio = 1 - compressedSize / uncompressed;

      expect(ratio).toBeGreaterThan(0.5); // >50% compression
    });

    it('should decompress embeddings correctly', async () => {
      const embedding = await vectorMemory.embed('test');

      const compressed = await vectorMemory.compress(embedding);
      const decompressed = await vectorMemory.decompress(compressed);

      expect(decompressed).toEqual(embedding);
    });

    it('should maintain similarity after compression', async () => {
      const emb1 = await vectorMemory.embed('test one');
      const emb2 = await vectorMemory.embed('test two');

      const originalSimilarity = vectorMemory.cosineSimilarity(emb1, emb2);

      const compressed1 = await vectorMemory.compress(emb1);
      const compressed2 = await vectorMemory.compress(emb2);

      const decompressed1 = await vectorMemory.decompress(compressed1);
      const decompressed2 = await vectorMemory.decompress(compressed2);

      const compressedSimilarity = vectorMemory.cosineSimilarity(
        decompressed1,
        decompressed2
      );

      expect(Math.abs(originalSimilarity - compressedSimilarity)).toBeLessThan(0.01);
    });
  });
});
