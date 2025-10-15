/**
 * SAFLA Neural Vector Memory System
 *
 * Provides embedding-based semantic search for patterns using dense vector representations.
 * Supports multiple embedding models and quantization for compression.
 */

import { Database } from 'sqlite3';
import { promisify } from 'util';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface VectorEmbedding {
  id: string;
  model: string;
  dims: number;
  vector: Float32Array;
  compressed: boolean;
  minVal?: number;
  maxVal?: number;
  createdAt: string;
}

export interface VectorSearchResult {
  id: string;
  similarity: number;
  embedding: VectorEmbedding;
}

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  compressionEnabled: boolean;
  quantization: 'none' | 'int8' | 'int16';
  maxVectors: number;
  cacheTtl: number;
  similarityThreshold?: number;
}

export interface SimilarityMetrics {
  cosine: number;
  euclidean: number;
  dotProduct: number;
}

// ============================================================================
// Vector Memory Manager
// ============================================================================

export class VectorMemoryManager {
  private cache = new Map<string, VectorEmbedding>();
  private cacheExpiry = new Map<string, number>();
  private dbRun: (sql: string, params?: any[]) => Promise<any>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(
    private db: Database,
    private config: EmbeddingConfig
  ) {
    this.dbRun = promisify(db.run.bind(db));
    this.dbGet = promisify(db.get.bind(db));
    this.dbAll = promisify(db.all.bind(db));
  }

  /**
   * Store embedding for a pattern
   */
  async storeEmbedding(
    patternId: string,
    embedding: Float32Array
  ): Promise<void> {
    if (embedding.length !== this.config.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`
      );
    }

    let vectorData: Buffer;
    let compressed = false;
    let minVal: number | undefined;
    let maxVal: number | undefined;

    if (this.config.compressionEnabled) {
      const quantized = this.quantizeVector(embedding);
      vectorData = quantized.data;
      compressed = true;
      minVal = quantized.min;
      maxVal = quantized.max;
    } else {
      vectorData = Buffer.from(embedding.buffer);
    }

    await this.dbRun(
      `INSERT OR REPLACE INTO pattern_embeddings
       (id, model, dims, vector, compressed, min_val, max_val, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        patternId,
        this.config.model,
        this.config.dimensions,
        vectorData,
        compressed ? 1 : 0,
        minVal,
        maxVal
      ]
    );

    // Cache the embedding
    this.cacheEmbedding(patternId, {
      id: patternId,
      model: this.config.model,
      dims: this.config.dimensions,
      vector: embedding,
      compressed,
      minVal,
      maxVal,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Retrieve embedding for a pattern
   */
  async getEmbedding(patternId: string): Promise<VectorEmbedding | null> {
    // Check cache first
    const cached = this.getCachedEmbedding(patternId);
    if (cached) return cached;

    // Query database
    const row = await this.dbGet(
      'SELECT * FROM pattern_embeddings WHERE id = ?',
      [patternId]
    );

    if (!row) return null;

    // Deserialize vector
    let vector: Float32Array;
    if (row.compressed) {
      vector = this.dequantizeVector(
        Buffer.from(row.vector),
        row.min_val,
        row.max_val
      );
    } else {
      vector = new Float32Array(row.vector.buffer);
    }

    const embedding: VectorEmbedding = {
      id: row.id,
      model: row.model,
      dims: row.dims,
      vector,
      compressed: row.compressed === 1,
      minVal: row.min_val,
      maxVal: row.max_val,
      createdAt: row.created_at
    };

    // Cache the embedding
    this.cacheEmbedding(patternId, embedding);

    return embedding;
  }

  /**
   * Semantic similarity search
   */
  async similaritySearch(
    queryEmbedding: Float32Array,
    k: number = 10,
    minSimilarity: number = 0.0
  ): Promise<VectorSearchResult[]> {
    // Load all embeddings for the current model
    const rows = await this.dbAll(
      'SELECT * FROM pattern_embeddings WHERE model = ?',
      [this.config.model]
    );

    // Compute similarities
    const results: VectorSearchResult[] = [];

    for (const row of rows) {
      // Deserialize vector
      let vector: Float32Array;
      if (row.compressed) {
        vector = this.dequantizeVector(
          Buffer.from(row.vector),
          row.min_val,
          row.max_val
        );
      } else {
        vector = new Float32Array(row.vector.buffer);
      }

      // Compute cosine similarity
      const similarity = this.cosineSimilarity(queryEmbedding, vector);

      if (similarity >= minSimilarity) {
        results.push({
          id: row.id,
          similarity,
          embedding: {
            id: row.id,
            model: row.model,
            dims: row.dims,
            vector,
            compressed: row.compressed === 1,
            minVal: row.min_val,
            maxVal: row.max_val,
            createdAt: row.created_at
          }
        });
      }
    }

    // Sort by similarity (descending) and return top-k
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /**
   * Batch similarity search for multiple queries
   */
  async batchSimilaritySearch(
    queries: Float32Array[],
    k: number = 10
  ): Promise<VectorSearchResult[][]> {
    return Promise.all(
      queries.map(query => this.similaritySearch(query, k))
    );
  }

  /**
   * Compute all similarity metrics between two vectors
   */
  computeSimilarityMetrics(
    a: Float32Array,
    b: Float32Array
  ): SimilarityMetrics {
    return {
      cosine: this.cosineSimilarity(a, b),
      euclidean: this.euclideanDistance(a, b),
      dotProduct: this.dotProduct(a, b)
    };
  }

  /**
   * Delete embedding
   */
  async deleteEmbedding(patternId: string): Promise<void> {
    await this.dbRun(
      'DELETE FROM pattern_embeddings WHERE id = ?',
      [patternId]
    );

    this.cache.delete(patternId);
    this.cacheExpiry.delete(patternId);
  }

  /**
   * Get total number of embeddings
   */
  async count(): Promise<number> {
    const row = await this.dbGet(
      'SELECT COUNT(*) as count FROM pattern_embeddings WHERE model = ?',
      [this.config.model]
    );
    return row?.count || 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need tracking to compute
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [id, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.cache.delete(id);
        this.cacheExpiry.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  // ============================================================================
  // Vector Operations
  // ============================================================================

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
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

  /**
   * Euclidean distance between two vectors
   */
  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Dot product of two vectors
   */
  private dotProduct(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }

    return sum;
  }

  // ============================================================================
  // Vector Quantization
  // ============================================================================

  /**
   * Quantize float32 vector to int8 for compression
   */
  private quantizeVector(vector: Float32Array): {
    data: Buffer;
    min: number;
    max: number;
  } {
    const min = Math.min(...vector);
    const max = Math.max(...vector);
    const range = max - min;

    if (range === 0) {
      // Handle edge case: all values are the same
      return {
        data: Buffer.alloc(vector.length),
        min,
        max: min
      };
    }

    const quantized = new Int8Array(vector.length);

    for (let i = 0; i < vector.length; i++) {
      // Map [min, max] to [-127, 127]
      quantized[i] = Math.round(((vector[i] - min) / range) * 254 - 127);
    }

    return {
      data: Buffer.from(quantized.buffer),
      min,
      max
    };
  }

  /**
   * Dequantize int8 to float32
   */
  private dequantizeVector(
    data: Buffer,
    min: number,
    max: number
  ): Float32Array {
    const quantized = new Int8Array(data.buffer);
    const vector = new Float32Array(quantized.length);
    const range = max - min;

    if (range === 0) {
      // All values are the same
      vector.fill(min);
      return vector;
    }

    for (let i = 0; i < quantized.length; i++) {
      // Map [-127, 127] back to [min, max]
      vector[i] = ((quantized[i] + 127) / 254) * range + min;
    }

    return vector;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Cache an embedding in memory
   */
  private cacheEmbedding(id: string, embedding: VectorEmbedding): void {
    // Enforce max cache size (LRU eviction)
    if (this.cache.size >= 1000) {
      // Remove oldest entry
      const oldestId = this.cache.keys().next().value as string;
      this.cache.delete(oldestId);
      this.cacheExpiry.delete(oldestId);
    }

    this.cache.set(id, embedding);
    this.cacheExpiry.set(id, Date.now() + this.config.cacheTtl);
  }

  /**
   * Get embedding from cache
   */
  private getCachedEmbedding(id: string): VectorEmbedding | null {
    const expiry = this.cacheExpiry.get(id);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(id);
      this.cacheExpiry.delete(id);
      return null;
    }

    return this.cache.get(id) || null;
  }

  // ============================================================================
  // Convenience Methods (Test-Friendly API)
  // ============================================================================

  private embeddingGenerator?: EmbeddingGenerator;

  /**
   * Set embedding generator for text-to-vector conversion
   */
  setEmbeddingGenerator(generator: EmbeddingGenerator): void {
    this.embeddingGenerator = generator;
  }

  /**
   * Generate embedding from text
   */
  async embed(text: string): Promise<Float32Array> {
    if (!this.embeddingGenerator) {
      // Use mock generator by default for testing
      this.embeddingGenerator = new MockEmbeddingGenerator(this.config.dimensions);
    }
    return await this.embeddingGenerator.generate(text);
  }

  /**
   * Store embedding (alias for storeEmbedding)
   */
  async store(id: string, data: string | Float32Array): Promise<void> {
    let embedding: Float32Array;

    if (typeof data === 'string') {
      embedding = await this.embed(data);
    } else {
      embedding = data;
    }

    return await this.storeEmbedding(id, embedding);
  }

  /**
   * Get embedding (alias for getEmbedding)
   */
  async get(id: string): Promise<VectorEmbedding | null> {
    return await this.getEmbedding(id);
  }

  /**
   * Clear all embeddings (for testing)
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

// ============================================================================
// Embedding Generator (Abstract Interface)
// ============================================================================

export abstract class EmbeddingGenerator {
  abstract generate(text: string): Promise<Float32Array>;
  abstract generateBatch(texts: string[]): Promise<Float32Array[]>;
  abstract getDimensions(): number;
  abstract getModelName(): string;
}

/**
 * Mock embedding generator for testing
 * In production, this would call an actual embedding API
 */
export class MockEmbeddingGenerator extends EmbeddingGenerator {
  constructor(private dimensions: number = 1536) {
    super();
  }

  async generate(text: string): Promise<Float32Array> {
    // Simple hash-based mock embedding
    const embedding = new Float32Array(this.dimensions);

    for (let i = 0; i < this.dimensions; i++) {
      // Use text hash to generate deterministic but pseudo-random values
      const hash = this.hashString(text + i);
      embedding[i] = (hash % 1000) / 1000 - 0.5;
    }

    // Normalize
    return this.normalize(embedding);
  }

  async generateBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map(text => this.generate(text)));
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return 'mock-embedding';
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private normalize(vector: Float32Array): Float32Array {
    let sum = 0;
    for (let i = 0; i < vector.length; i++) {
      sum += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sum);

    if (norm === 0) return vector;

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / norm;
    }

    return normalized;
  }
}

// ============================================================================
// Exports
// ============================================================================

// Type Aliases for Backward Compatibility
export type VectorConfig = EmbeddingConfig;
export type Embedding = VectorEmbedding;
export type SimilarityResult = VectorSearchResult;

export default VectorMemoryManager;
