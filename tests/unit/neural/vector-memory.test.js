"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const vector_memory_1 = __importDefault(require("../../../src/neural/vector-memory"));
(0, globals_1.describe)('VectorMemory', () => {
    let vectorMemory;
    (0, globals_1.beforeEach)(() => {
        vectorMemory = new vector_memory_1.default({
            dimensions: 384,
            similarityThreshold: 0.8,
            maxResults: 10
        });
    });
    (0, globals_1.afterEach)(async () => {
        await vectorMemory.clear();
    });
    (0, globals_1.describe)('Initialization', () => {
        (0, globals_1.it)('should initialize with default configuration', () => {
            (0, globals_1.expect)(vectorMemory).toBeDefined();
            (0, globals_1.expect)(vectorMemory.config.dimensions).toBe(384);
        });
        (0, globals_1.it)('should accept custom configuration', () => {
            const custom = new vector_memory_1.default({
                dimensions: 768,
                similarityThreshold: 0.9,
                maxResults: 20
            });
            (0, globals_1.expect)(custom.config.dimensions).toBe(768);
            (0, globals_1.expect)(custom.config.similarityThreshold).toBe(0.9);
        });
        (0, globals_1.it)('should validate configuration', () => {
            (0, globals_1.expect)(() => {
                new vector_memory_1.default({ dimensions: -1, similarityThreshold: 0.5, maxResults: 10 });
            }).toThrow();
            (0, globals_1.expect)(() => {
                new vector_memory_1.default({ dimensions: 384, similarityThreshold: 1.5, maxResults: 10 });
            }).toThrow();
        });
    });
    (0, globals_1.describe)('Embedding Generation', () => {
        (0, globals_1.it)('should generate embeddings from text', async () => {
            const text = 'user authentication flow';
            const embedding = await vectorMemory.embed(text);
            (0, globals_1.expect)(embedding).toBeDefined();
            (0, globals_1.expect)(embedding.length).toBe(384);
            (0, globals_1.expect)(embedding.every(x => typeof x === 'number')).toBe(true);
        });
        (0, globals_1.it)('should normalize embeddings to unit length', async () => {
            const text = 'test normalization';
            const embedding = await vectorMemory.embed(text);
            const magnitude = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
            (0, globals_1.expect)(Math.abs(magnitude - 1.0)).toBeLessThan(0.01);
        });
        (0, globals_1.it)('should handle empty text', async () => {
            const embedding = await vectorMemory.embed('');
            (0, globals_1.expect)(embedding).toBeDefined();
            (0, globals_1.expect)(embedding.length).toBe(384);
        });
        (0, globals_1.it)('should handle very long text', async () => {
            const longText = 'word '.repeat(10000);
            const embedding = await vectorMemory.embed(longText);
            (0, globals_1.expect)(embedding).toBeDefined();
            (0, globals_1.expect)(embedding.length).toBe(384);
        });
        (0, globals_1.it)('should handle special characters', async () => {
            const special = '!@#$%^&*(){}[]<>?/\n\r\t';
            const embedding = await vectorMemory.embed(special);
            (0, globals_1.expect)(embedding).toBeDefined();
            (0, globals_1.expect)(embedding.length).toBe(384);
        });
        (0, globals_1.it)('should produce similar embeddings for similar text', async () => {
            const text1 = 'user authentication';
            const text2 = 'user login';
            const emb1 = await vectorMemory.embed(text1);
            const emb2 = await vectorMemory.embed(text2);
            const similarity = vectorMemory.cosineSimilarity(emb1, emb2);
            (0, globals_1.expect)(similarity).toBeGreaterThan(0.7);
        });
        (0, globals_1.it)('should produce different embeddings for different text', async () => {
            const text1 = 'user authentication';
            const text2 = 'database migration';
            const emb1 = await vectorMemory.embed(text1);
            const emb2 = await vectorMemory.embed(text2);
            const similarity = vectorMemory.cosineSimilarity(emb1, emb2);
            (0, globals_1.expect)(similarity).toBeLessThan(0.7);
        });
    });
    (0, globals_1.describe)('Storage and Retrieval', () => {
        (0, globals_1.it)('should store embeddings with IDs', async () => {
            const id = 'pattern-1';
            const text = 'test pattern';
            const embedding = await vectorMemory.embed(text);
            await vectorMemory.store(id, embedding, { text });
            const stored = await vectorMemory.get(id);
            (0, globals_1.expect)(stored).toBeDefined();
            (0, globals_1.expect)(stored?.id).toBe(id);
        });
        (0, globals_1.it)('should retrieve stored embeddings', async () => {
            const id = 'pattern-2';
            const embedding = await vectorMemory.embed('retrieval test');
            await vectorMemory.store(id, embedding);
            const retrieved = await vectorMemory.get(id);
            (0, globals_1.expect)(retrieved).toBeDefined();
            (0, globals_1.expect)(retrieved?.embedding).toEqual(embedding);
        });
        (0, globals_1.it)('should return null for non-existent IDs', async () => {
            const result = await vectorMemory.get('non-existent');
            (0, globals_1.expect)(result).toBeNull();
        });
        (0, globals_1.it)('should update existing embeddings', async () => {
            const id = 'pattern-3';
            const emb1 = await vectorMemory.embed('original');
            const emb2 = await vectorMemory.embed('updated');
            await vectorMemory.store(id, emb1);
            await vectorMemory.store(id, emb2);
            const retrieved = await vectorMemory.get(id);
            (0, globals_1.expect)(retrieved?.embedding).toEqual(emb2);
        });
        (0, globals_1.it)('should store metadata with embeddings', async () => {
            const id = 'pattern-4';
            const embedding = await vectorMemory.embed('metadata test');
            const metadata = {
                type: 'coordination',
                confidence: 0.85,
                createdAt: new Date().toISOString()
            };
            await vectorMemory.store(id, embedding, metadata);
            const retrieved = await vectorMemory.get(id);
            (0, globals_1.expect)(retrieved?.metadata).toEqual(metadata);
        });
        (0, globals_1.it)('should handle large metadata objects', async () => {
            const id = 'pattern-5';
            const embedding = await vectorMemory.embed('large metadata');
            const largeMetadata = {
                data: 'x'.repeat(10000),
                nested: { deep: { structure: { with: { many: { levels: 'value' } } } } }
            };
            await vectorMemory.store(id, embedding, largeMetadata);
            const retrieved = await vectorMemory.get(id);
            (0, globals_1.expect)(retrieved?.metadata).toEqual(largeMetadata);
        });
    });
    (0, globals_1.describe)('Similarity Search', () => {
        (0, globals_1.beforeEach)(async () => {
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
        (0, globals_1.it)('should find similar embeddings', async () => {
            const query = 'user login authentication';
            const queryEmbedding = await vectorMemory.embed(query);
            const results = await vectorMemory.findSimilar(queryEmbedding);
            (0, globals_1.expect)(results.length).toBeGreaterThan(0);
            (0, globals_1.expect)(results[0].id).toMatch(/^auth-/);
        });
        (0, globals_1.it)('should return top-k results', async () => {
            const query = 'authentication';
            const queryEmbedding = await vectorMemory.embed(query);
            const results = await vectorMemory.findSimilar(queryEmbedding, {
                limit: 2
            });
            (0, globals_1.expect)(results.length).toBeLessThanOrEqual(2);
        });
        (0, globals_1.it)('should filter by similarity threshold', async () => {
            const query = 'user authentication';
            const queryEmbedding = await vectorMemory.embed(query);
            const results = await vectorMemory.findSimilar(queryEmbedding, {
                threshold: 0.9
            });
            results.forEach(result => {
                (0, globals_1.expect)(result.similarity).toBeGreaterThanOrEqual(0.9);
            });
        });
        (0, globals_1.it)('should rank results by similarity score', async () => {
            const query = 'user login';
            const queryEmbedding = await vectorMemory.embed(query);
            const results = await vectorMemory.findSimilar(queryEmbedding);
            for (let i = 1; i < results.length; i++) {
                (0, globals_1.expect)(results[i].similarity).toBeLessThanOrEqual(results[i - 1].similarity);
            }
        });
        (0, globals_1.it)('should handle queries with no similar results', async () => {
            const query = 'quantum computing blockchain AI';
            const queryEmbedding = await vectorMemory.embed(query);
            const results = await vectorMemory.findSimilar(queryEmbedding, {
                threshold: 0.95
            });
            (0, globals_1.expect)(results.length).toBe(0);
        });
        (0, globals_1.it)('should support filtering by metadata', async () => {
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
            (0, globals_1.expect)(results.every(r => r.metadata?.type === 'coordination')).toBe(true);
        });
    });
    (0, globals_1.describe)('Cosine Similarity', () => {
        (0, globals_1.it)('should calculate similarity correctly', () => {
            const vec1 = [1, 0, 0];
            const vec2 = [1, 0, 0];
            const similarity = vectorMemory.cosineSimilarity(vec1, vec2);
            (0, globals_1.expect)(Math.abs(similarity - 1.0)).toBeLessThan(0.01);
        });
        (0, globals_1.it)('should return 0 for orthogonal vectors', () => {
            const vec1 = [1, 0, 0];
            const vec2 = [0, 1, 0];
            const similarity = vectorMemory.cosineSimilarity(vec1, vec2);
            (0, globals_1.expect)(Math.abs(similarity - 0.0)).toBeLessThan(0.01);
        });
        (0, globals_1.it)('should return -1 for opposite vectors', () => {
            const vec1 = [1, 0, 0];
            const vec2 = [-1, 0, 0];
            const similarity = vectorMemory.cosineSimilarity(vec1, vec2);
            (0, globals_1.expect)(Math.abs(similarity - (-1.0))).toBeLessThan(0.01);
        });
        (0, globals_1.it)('should handle zero vectors', () => {
            const vec1 = [0, 0, 0];
            const vec2 = [1, 0, 0];
            const similarity = vectorMemory.cosineSimilarity(vec1, vec2);
            (0, globals_1.expect)(similarity).toBe(0);
        });
        (0, globals_1.it)('should handle different magnitude vectors', () => {
            const vec1 = [1, 1, 1];
            const vec2 = [2, 2, 2];
            const similarity = vectorMemory.cosineSimilarity(vec1, vec2);
            (0, globals_1.expect)(Math.abs(similarity - 1.0)).toBeLessThan(0.01);
        });
        (0, globals_1.it)('should handle negative values', () => {
            const vec1 = [1, -1, 1];
            const vec2 = [1, -1, 1];
            const similarity = vectorMemory.cosineSimilarity(vec1, vec2);
            (0, globals_1.expect)(Math.abs(similarity - 1.0)).toBeLessThan(0.01);
        });
    });
    (0, globals_1.describe)('Batch Operations', () => {
        (0, globals_1.it)('should store multiple embeddings efficiently', async () => {
            const items = Array.from({ length: 100 }, (_, i) => ({
                id: `batch-${i}`,
                text: `pattern ${i}`
            }));
            const start = Date.now();
            await vectorMemory.storeBatch(items.map(async (item) => ({
                id: item.id,
                embedding: await vectorMemory.embed(item.text),
                metadata: { text: item.text }
            })));
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(5000);
        });
        (0, globals_1.it)('should retrieve multiple embeddings', async () => {
            const ids = ['test-1', 'test-2', 'test-3'];
            for (const id of ids) {
                const embedding = await vectorMemory.embed(`text for ${id}`);
                await vectorMemory.store(id, embedding);
            }
            const results = await vectorMemory.getBatch(ids);
            (0, globals_1.expect)(results.length).toBe(3);
            (0, globals_1.expect)(results.every(r => r !== null)).toBe(true);
        });
        (0, globals_1.it)('should handle partial batch results', async () => {
            await vectorMemory.store('exists-1', await vectorMemory.embed('test'));
            const results = await vectorMemory.getBatch([
                'exists-1',
                'does-not-exist',
                'also-missing'
            ]);
            (0, globals_1.expect)(results.filter(r => r !== null).length).toBe(1);
        });
    });
    (0, globals_1.describe)('Memory Management', () => {
        (0, globals_1.it)('should delete embeddings', async () => {
            const id = 'delete-test';
            await vectorMemory.store(id, await vectorMemory.embed('test'));
            await vectorMemory.delete(id);
            const retrieved = await vectorMemory.get(id);
            (0, globals_1.expect)(retrieved).toBeNull();
        });
        (0, globals_1.it)('should clear all embeddings', async () => {
            for (let i = 0; i < 10; i++) {
                await vectorMemory.store(`clear-${i}`, await vectorMemory.embed(`test ${i}`));
            }
            await vectorMemory.clear();
            const count = await vectorMemory.count();
            (0, globals_1.expect)(count).toBe(0);
        });
        (0, globals_1.it)('should count stored embeddings', async () => {
            const initial = await vectorMemory.count();
            for (let i = 0; i < 5; i++) {
                await vectorMemory.store(`count-${i}`, await vectorMemory.embed(`test ${i}`));
            }
            const final = await vectorMemory.count();
            (0, globals_1.expect)(final - initial).toBe(5);
        });
        (0, globals_1.it)('should list all stored IDs', async () => {
            const ids = ['list-1', 'list-2', 'list-3'];
            for (const id of ids) {
                await vectorMemory.store(id, await vectorMemory.embed('test'));
            }
            const stored = await vectorMemory.listIds();
            ids.forEach(id => {
                (0, globals_1.expect)(stored).toContain(id);
            });
        });
        (0, globals_1.it)('should support memory compaction', async () => {
            for (let i = 0; i < 1000; i++) {
                await vectorMemory.store(`compact-${i}`, await vectorMemory.embed(`test ${i}`));
            }
            for (let i = 0; i < 500; i++) {
                await vectorMemory.delete(`compact-${i}`);
            }
            await vectorMemory.compact();
            const count = await vectorMemory.count();
            (0, globals_1.expect)(count).toBe(500);
        });
    });
    (0, globals_1.describe)('Performance', () => {
        (0, globals_1.it)('should generate embeddings quickly', async () => {
            const texts = Array.from({ length: 100 }, (_, i) => `test text ${i}`);
            const start = Date.now();
            await Promise.all(texts.map(text => vectorMemory.embed(text)));
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(10000);
        });
        (0, globals_1.it)('should perform similarity search quickly', async () => {
            for (let i = 0; i < 1000; i++) {
                const embedding = await vectorMemory.embed(`pattern ${i}`);
                await vectorMemory.store(`perf-${i}`, embedding);
            }
            const query = await vectorMemory.embed('test query');
            const start = Date.now();
            await vectorMemory.findSimilar(query, { limit: 10 });
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(100);
        });
        (0, globals_1.it)('should maintain memory efficiency', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            for (let i = 0; i < 5000; i++) {
                const embedding = await vectorMemory.embed(`memory test ${i}`);
                await vectorMemory.store(`mem-${i}`, embedding);
            }
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;
            (0, globals_1.expect)(memoryIncreaseMB).toBeLessThan(200);
        });
        (0, globals_1.it)('should handle concurrent operations', async () => {
            const operations = [];
            for (let i = 0; i < 100; i++) {
                operations.push(vectorMemory.store(`concurrent-${i}`, await vectorMemory.embed(`test ${i}`)));
            }
            await (0, globals_1.expect)(Promise.all(operations)).resolves.toBeDefined();
        });
    });
    (0, globals_1.describe)('Edge Cases', () => {
        (0, globals_1.it)('should handle invalid embedding dimensions', async () => {
            await (0, globals_1.expect)(vectorMemory.store('invalid', [1, 2, 3])).rejects.toThrow();
        });
        (0, globals_1.it)('should handle non-numeric embeddings', async () => {
            await (0, globals_1.expect)(vectorMemory.store('invalid', ['a', 'b', 'c'])).rejects.toThrow();
        });
        (0, globals_1.it)('should handle NaN values in embeddings', async () => {
            const embedding = Array(384).fill(NaN);
            await (0, globals_1.expect)(vectorMemory.store('nan', embedding)).rejects.toThrow();
        });
        (0, globals_1.it)('should handle Infinity in embeddings', async () => {
            const embedding = Array(384).fill(Infinity);
            await (0, globals_1.expect)(vectorMemory.store('infinity', embedding)).rejects.toThrow();
        });
        (0, globals_1.it)('should handle empty ID', async () => {
            const embedding = await vectorMemory.embed('test');
            await (0, globals_1.expect)(vectorMemory.store('', embedding)).rejects.toThrow();
        });
        (0, globals_1.it)('should handle very long IDs', async () => {
            const longId = 'id-' + 'x'.repeat(10000);
            const embedding = await vectorMemory.embed('test');
            await (0, globals_1.expect)(vectorMemory.store(longId, embedding)).resolves.toBeDefined();
        });
        (0, globals_1.it)('should handle special characters in IDs', async () => {
            const specialId = 'id-!@#$%^&*(){}[]<>?/';
            const embedding = await vectorMemory.embed('test');
            await (0, globals_1.expect)(vectorMemory.store(specialId, embedding)).resolves.toBeDefined();
        });
    });
    (0, globals_1.describe)('Compression', () => {
        (0, globals_1.it)('should compress embeddings efficiently', async () => {
            const text = 'compression test';
            const embedding = await vectorMemory.embed(text);
            const uncompressed = JSON.stringify(embedding).length;
            const compressed = await vectorMemory.compress(embedding);
            const compressedSize = compressed.length;
            const ratio = 1 - compressedSize / uncompressed;
            (0, globals_1.expect)(ratio).toBeGreaterThan(0.5);
        });
        (0, globals_1.it)('should decompress embeddings correctly', async () => {
            const embedding = await vectorMemory.embed('test');
            const compressed = await vectorMemory.compress(embedding);
            const decompressed = await vectorMemory.decompress(compressed);
            (0, globals_1.expect)(decompressed).toEqual(embedding);
        });
        (0, globals_1.it)('should maintain similarity after compression', async () => {
            const emb1 = await vectorMemory.embed('test one');
            const emb2 = await vectorMemory.embed('test two');
            const originalSimilarity = vectorMemory.cosineSimilarity(emb1, emb2);
            const compressed1 = await vectorMemory.compress(emb1);
            const compressed2 = await vectorMemory.compress(emb2);
            const decompressed1 = await vectorMemory.decompress(compressed1);
            const decompressed2 = await vectorMemory.decompress(compressed2);
            const compressedSimilarity = vectorMemory.cosineSimilarity(decompressed1, decompressed2);
            (0, globals_1.expect)(Math.abs(originalSimilarity - compressedSimilarity)).toBeLessThan(0.01);
        });
    });
});
//# sourceMappingURL=vector-memory.test.js.map