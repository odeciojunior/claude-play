/**
 * Vector Memory Wrapper - Test-Friendly API
 *
 * This wrapper provides a simplified, in-memory API for vector storage
 * suitable for testing without requiring database setup.
 */

import { MockEmbeddingGenerator } from './vector-memory';

// ============================================================================
// Types
// ============================================================================

export interface VectorConfig {
  dimensions: number;
  similarityThreshold?: number;
  maxResults?: number;
}

export interface Embedding {
  id: string;
  embedding: Float32Array;
  metadata?: any;
  createdAt?: string;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
  embedding?: Float32Array;
  metadata?: any;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filter?: any;
}

// ============================================================================
// VectorMemory - In-Memory Implementation
// ============================================================================

export class VectorMemory {
  public config: VectorConfig;
  private storage: Map<string, Embedding> = new Map();
  private generator: MockEmbeddingGenerator;

  constructor(config: VectorConfig) {
    this.validateConfig(config);
    this.config = {
      similarityThreshold: 0.8,
      maxResults: 10,
      ...config
    };
    this.generator = new MockEmbeddingGenerator(config.dimensions);
  }

  // ==========================================================================
  // Configuration Validation
  // ==========================================================================

  private validateConfig(config: VectorConfig): void {
    if (config.dimensions <= 0) {
      throw new Error('Dimensions must be positive');
    }
    if (config.similarityThreshold !== undefined) {
      if (config.similarityThreshold < 0 || config.similarityThreshold > 1) {
        throw new Error('Similarity threshold must be between 0 and 1');
      }
    }
  }

  // ==========================================================================
  // Embedding Generation
  // ==========================================================================

  async embed(text: string): Promise<Float32Array> {
    return await this.generator.generate(text);
  }

  // ==========================================================================
  // Storage Operations
  // ==========================================================================

  async store(
    id: string,
    embedding: Float32Array | number[],
    metadata?: any
  ): Promise<void> {
    if (!id || id.length === 0) {
      throw new Error('ID cannot be empty');
    }

    const embeddingArray = Array.isArray(embedding)
      ? new Float32Array(embedding)
      : embedding;

    if (embeddingArray.length !== this.config.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embeddingArray.length}`
      );
    }

    // Validate embedding values
    for (const val of embeddingArray) {
      if (isNaN(val) || !isFinite(val)) {
        throw new Error('Embedding contains invalid values (NaN or Infinity)');
      }
    }

    this.storage.set(id, {
      id,
      embedding: embeddingArray,
      metadata,
      createdAt: new Date().toISOString()
    });
  }

  async get(id: string): Promise<Embedding | null> {
    return this.storage.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    this.storage.delete(id);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async count(): Promise<number> {
    return this.storage.size;
  }

  async listIds(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  async storeBatch(
    items: Array<Promise<{ id: string; embedding: Float32Array; metadata?: any }>>
  ): Promise<void> {
    const resolved = await Promise.all(items);
    for (const item of resolved) {
      await this.store(item.id, item.embedding, item.metadata);
    }
  }

  async getBatch(ids: string[]): Promise<Array<Embedding | null>> {
    return ids.map(id => this.storage.get(id) || null);
  }

  // ==========================================================================
  // Similarity Search
  // ==========================================================================

  async findSimilar(
    queryEmbedding: Float32Array,
    options: SearchOptions = {}
  ): Promise<SimilarityResult[]> {
    const {
      limit = this.config.maxResults || 10,
      threshold = this.config.similarityThreshold || 0.0,
      filter
    } = options;

    const results: SimilarityResult[] = [];

    for (const [id, stored] of this.storage.entries()) {
      // Apply metadata filter if provided
      if (filter && stored.metadata) {
        const matches = Object.entries(filter).every(
          ([key, value]) => stored.metadata[key] === value
        );
        if (!matches) continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, stored.embedding);

      if (similarity >= threshold) {
        results.push({
          id,
          similarity,
          embedding: stored.embedding,
          metadata: stored.metadata
        });
      }
    }

    // Sort by similarity (descending) and limit
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // ==========================================================================
  // Vector Operations
  // ==========================================================================

  cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  // ==========================================================================
  // Compression (Simple Implementation)
  // ==========================================================================

  async compress(embedding: Float32Array): Promise<Buffer> {
    // Simple quantization to Int8
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    const range = max - min;

    if (range === 0) {
      return Buffer.alloc(embedding.length + 16); // All zeros
    }

    const quantized = new Int8Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      quantized[i] = Math.round(((embedding[i] - min) / range) * 254 - 127);
    }

    // Store min/max as Float32 (8 bytes each = 16 bytes header)
    const buffer = Buffer.alloc(embedding.length + 16);
    buffer.writeFloatLE(min, 0);
    buffer.writeFloatLE(max, 4);
    buffer.writeFloatLE(range, 8);
    buffer.writeFloatLE(embedding.length, 12);

    Buffer.from(quantized.buffer).copy(buffer, 16);

    return buffer;
  }

  async decompress(compressed: Buffer): Promise<Float32Array> {
    const min = compressed.readFloatLE(0);
    const max = compressed.readFloatLE(4);
    const range = compressed.readFloatLE(8);
    const length = compressed.readFloatLE(12);

    const quantized = new Int8Array(
      compressed.buffer,
      compressed.byteOffset + 16,
      length
    );

    const embedding = new Float32Array(length);

    if (range === 0) {
      embedding.fill(min);
      return embedding;
    }

    for (let i = 0; i < length; i++) {
      embedding[i] = ((quantized[i] + 127) / 254) * range + min;
    }

    return embedding;
  }

  // ==========================================================================
  // Memory Management
  // ==========================================================================

  async compact(): Promise<void> {
    // In-memory implementation doesn't need compaction
    // This is a no-op but included for API compatibility
  }
}

// ============================================================================
// Exports
// ============================================================================

export default VectorMemory;
