/**
 * Memory Compression System
 *
 * Implements multiple compression strategies:
 * - zlib compression for pattern_data (text)
 * - Vector quantization (float32 → int8)
 * - Delta encoding for trajectories
 * - Deduplication and shared storage
 *
 * Target: 60% compression ratio with minimal performance impact
 */

import * as zlib from 'zlib';
import { promisify } from 'util';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CompressionConfig {
  enableZlib: boolean;
  enableQuantization: boolean;
  enableDeltaEncoding: boolean;
  enableDeduplication: boolean;
  zlibLevel: number; // 0-9, higher = better compression
  quantizationBits: 8 | 16; // int8 or int16
  dedupThreshold: number; // Minimum size for dedup (bytes)
}

export interface CompressionResult {
  compressed: Buffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: string;
  metadata?: any;
}

export interface DecompressionResult {
  data: any;
  algorithm: string;
  originalSize: number;
}

export interface CompressionStats {
  totalCompressed: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  avgCompressionRatio: number;
  compressionsByAlgorithm: Map<string, number>;
}

// ============================================================================
// Compression Manager
// ============================================================================

export class CompressionManager {
  private stats: CompressionStats;
  private gzip = promisify(zlib.gzip);
  private gunzip = promisify(zlib.gunzip);
  private deflate = promisify(zlib.deflate);
  private inflate = promisify(zlib.inflate);
  private dedupCache = new Map<string, Buffer>();

  constructor(private config: CompressionConfig) {
    this.stats = {
      totalCompressed: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      avgCompressionRatio: 0,
      compressionsByAlgorithm: new Map()
    };
  }

  /**
   * Compress data automatically choosing best algorithm
   */
  async compress(data: any, hint?: 'text' | 'vector' | 'trajectory'): Promise<CompressionResult> {
    const startTime = performance.now();

    // Determine data type
    const dataType = hint || this.detectDataType(data);

    let result: CompressionResult;

    switch (dataType) {
      case 'text':
        result = await this.compressText(data);
        break;
      case 'vector':
        result = await this.compressVector(data);
        break;
      case 'trajectory':
        result = await this.compressTrajectory(data);
        break;
      default:
        result = await this.compressText(JSON.stringify(data));
    }

    // Update statistics
    this.updateStats(result);

    return result;
  }

  /**
   * Decompress data
   */
  async decompress(compressed: Buffer, algorithm: string, metadata?: any): Promise<DecompressionResult> {
    switch (algorithm) {
      case 'zlib':
      case 'gzip':
        return this.decompressZlib(compressed, algorithm);
      case 'quantization':
        return this.dequantizeVector(compressed, metadata);
      case 'delta':
        return this.decodeDelta(compressed, metadata);
      default:
        throw new Error(`Unknown compression algorithm: ${algorithm}`);
    }
  }

  // ============================================================================
  // Text Compression (zlib/gzip)
  // ============================================================================

  /**
   * Compress text using zlib
   */
  private async compressText(data: string | object): Promise<CompressionResult> {
    if (!this.config.enableZlib) {
      const buffer = Buffer.from(JSON.stringify(data));
      return {
        compressed: buffer,
        originalSize: buffer.length,
        compressedSize: buffer.length,
        compressionRatio: 1.0,
        algorithm: 'none'
      };
    }

    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const original = Buffer.from(text);

    // Use deflate for speed, gzip for better compression
    const compressed = this.config.zlibLevel <= 6
      ? await this.deflate(original, { level: this.config.zlibLevel })
      : await this.gzip(original, { level: this.config.zlibLevel });

    return {
      compressed,
      originalSize: original.length,
      compressedSize: compressed.length,
      compressionRatio: compressed.length / original.length,
      algorithm: this.config.zlibLevel <= 6 ? 'zlib' : 'gzip'
    };
  }

  /**
   * Decompress zlib/gzip data
   */
  private async decompressZlib(compressed: Buffer, algorithm: string): Promise<DecompressionResult> {
    const decompressed = algorithm === 'gzip'
      ? await this.gunzip(compressed)
      : await this.inflate(compressed);

    return {
      data: decompressed.toString('utf-8'),
      algorithm,
      originalSize: decompressed.length
    };
  }

  // ============================================================================
  // Vector Quantization (float32 → int8/int16)
  // ============================================================================

  /**
   * Compress vector using quantization
   */
  private async compressVector(vector: Float32Array | number[]): Promise<CompressionResult> {
    if (!this.config.enableQuantization) {
      const buffer = Buffer.from(new Float32Array(vector).buffer);
      return {
        compressed: buffer,
        originalSize: buffer.length,
        compressedSize: buffer.length,
        compressionRatio: 1.0,
        algorithm: 'none'
      };
    }

    const float32 = vector instanceof Float32Array ? vector : new Float32Array(vector);
    const originalSize = float32.length * 4; // 4 bytes per float32

    // Find min/max for scaling
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < float32.length; i++) {
      min = Math.min(min, float32[i]);
      max = Math.max(max, float32[i]);
    }

    const range = max - min;
    if (range === 0) {
      // All values are the same
      const metadata = { min, max, length: float32.length };
      return {
        compressed: Buffer.alloc(0),
        originalSize,
        compressedSize: 0,
        compressionRatio: 0,
        algorithm: 'quantization',
        metadata
      };
    }

    // Quantize to int8 or int16
    let quantized: Buffer;
    let compressedSize: number;

    if (this.config.quantizationBits === 8) {
      // Quantize to int8 (75% compression)
      const int8 = new Int8Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int8[i] = Math.round(((float32[i] - min) / range) * 254 - 127);
      }
      quantized = Buffer.from(int8.buffer);
      compressedSize = float32.length; // 1 byte per value
    } else {
      // Quantize to int16 (50% compression)
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.round(((float32[i] - min) / range) * 65534 - 32767);
      }
      quantized = Buffer.from(int16.buffer);
      compressedSize = float32.length * 2; // 2 bytes per value
    }

    const metadata = { min, max, length: float32.length, bits: this.config.quantizationBits };

    return {
      compressed: quantized,
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
      algorithm: 'quantization',
      metadata
    };
  }

  /**
   * Dequantize vector
   */
  private async dequantizeVector(compressed: Buffer, metadata: any): Promise<DecompressionResult> {
    const { min, max, length, bits } = metadata;
    const range = max - min;

    const float32 = new Float32Array(length);

    if (compressed.length === 0) {
      // All values are the same
      float32.fill(min);
    } else if (bits === 8) {
      // Dequantize from int8
      const int8 = new Int8Array(compressed.buffer);
      for (let i = 0; i < length; i++) {
        float32[i] = ((int8[i] + 127) / 254) * range + min;
      }
    } else {
      // Dequantize from int16
      const int16 = new Int16Array(compressed.buffer);
      for (let i = 0; i < length; i++) {
        float32[i] = ((int16[i] + 32767) / 65534) * range + min;
      }
    }

    return {
      data: float32,
      algorithm: 'quantization',
      originalSize: length * 4
    };
  }

  // ============================================================================
  // Delta Encoding for Trajectories
  // ============================================================================

  /**
   * Compress trajectory using delta encoding
   */
  private async compressTrajectory(trajectory: any[]): Promise<CompressionResult> {
    if (!this.config.enableDeltaEncoding || trajectory.length === 0) {
      const text = JSON.stringify(trajectory);
      return this.compressText(text);
    }

    // Extract numeric sequences for delta encoding
    const encoded = {
      base: trajectory[0],
      deltas: [] as any[]
    };

    for (let i = 1; i < trajectory.length; i++) {
      const delta = this.computeDelta(trajectory[i - 1], trajectory[i]);
      encoded.deltas.push(delta);
    }

    // Compress the encoded structure
    const text = JSON.stringify(encoded);
    const result = await this.compressText(text);

    return {
      ...result,
      algorithm: 'delta',
      metadata: { length: trajectory.length }
    };
  }

  /**
   * Compute delta between two objects
   */
  private computeDelta(prev: any, curr: any): any {
    if (typeof curr !== 'object' || curr === null) {
      return curr === prev ? null : curr;
    }

    const delta: any = {};
    let hasDelta = false;

    for (const key in curr) {
      if (curr[key] !== prev[key]) {
        if (typeof curr[key] === 'number' && typeof prev[key] === 'number') {
          delta[key] = curr[key] - prev[key]; // Store delta
        } else {
          delta[key] = curr[key]; // Store full value
        }
        hasDelta = true;
      }
    }

    return hasDelta ? delta : null;
  }

  /**
   * Decode delta-encoded trajectory
   */
  private async decodeDelta(compressed: Buffer, metadata: any): Promise<DecompressionResult> {
    const decompressed = await this.decompressZlib(compressed, 'zlib');
    const encoded = JSON.parse(decompressed.data);

    const trajectory = [encoded.base];

    for (const delta of encoded.deltas) {
      if (delta === null) {
        trajectory.push(trajectory[trajectory.length - 1]);
      } else {
        const prev = trajectory[trajectory.length - 1];
        const curr = this.applyDelta(prev, delta);
        trajectory.push(curr);
      }
    }

    return {
      data: trajectory,
      algorithm: 'delta',
      originalSize: metadata.length * JSON.stringify(encoded.base).length
    };
  }

  /**
   * Apply delta to previous object
   */
  private applyDelta(prev: any, delta: any): any {
    if (typeof delta !== 'object' || delta === null) {
      return delta;
    }

    const curr = { ...prev };

    for (const key in delta) {
      if (typeof delta[key] === 'number' && typeof prev[key] === 'number') {
        curr[key] = prev[key] + delta[key]; // Apply delta
      } else {
        curr[key] = delta[key]; // Use full value
      }
    }

    return curr;
  }

  // ============================================================================
  // Deduplication
  // ============================================================================

  /**
   * Compress with deduplication
   */
  async compressWithDedup(data: any, key: string): Promise<CompressionResult> {
    if (!this.config.enableDeduplication) {
      return this.compress(data);
    }

    const hash = this.hashData(data);

    // Check if we've seen this data before
    if (this.dedupCache.has(hash)) {
      const cached = this.dedupCache.get(hash)!;
      return {
        compressed: Buffer.from(hash),
        originalSize: JSON.stringify(data).length,
        compressedSize: hash.length,
        compressionRatio: hash.length / JSON.stringify(data).length,
        algorithm: 'dedup',
        metadata: { hash }
      };
    }

    // Compress and cache
    const result = await this.compress(data);
    this.dedupCache.set(hash, result.compressed);

    // Limit cache size
    if (this.dedupCache.size > 10000) {
      const firstKey = this.dedupCache.keys().next().value as string;
      this.dedupCache.delete(firstKey);
    }

    return result;
  }

  /**
   * Simple hash function for deduplication
   */
  private hashData(data: any): string {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    let hash = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return hash.toString(36);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Detect data type for compression
   */
  private detectDataType(data: any): 'text' | 'vector' | 'trajectory' {
    if (data instanceof Float32Array || (Array.isArray(data) && typeof data[0] === 'number')) {
      return 'vector';
    }

    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      return 'trajectory';
    }

    return 'text';
  }

  /**
   * Update compression statistics
   */
  private updateStats(result: CompressionResult): void {
    this.stats.totalCompressed++;
    this.stats.totalOriginalSize += result.originalSize;
    this.stats.totalCompressedSize += result.compressedSize;

    const count = this.stats.compressionsByAlgorithm.get(result.algorithm) || 0;
    this.stats.compressionsByAlgorithm.set(result.algorithm, count + 1);

    this.stats.avgCompressionRatio =
      this.stats.totalCompressedSize / this.stats.totalOriginalSize;
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Get compression ratio report
   */
  getReport(): string {
    const totalSavedBytes = this.stats.totalOriginalSize - this.stats.totalCompressedSize;
    const totalSavedMb = totalSavedBytes / (1024 * 1024);
    const compressionRatio = (1 - this.stats.avgCompressionRatio) * 100;

    let report = `
📊 Compression Statistics
========================

Total Compressed: ${this.stats.totalCompressed.toLocaleString()} items
Original Size: ${(this.stats.totalOriginalSize / (1024 * 1024)).toFixed(2)} MB
Compressed Size: ${(this.stats.totalCompressedSize / (1024 * 1024)).toFixed(2)} MB
Space Saved: ${totalSavedMb.toFixed(2)} MB (${compressionRatio.toFixed(1)}%)

Algorithms Used:
`;

    for (const [algo, count] of this.stats.compressionsByAlgorithm.entries()) {
      report += `  - ${algo}: ${count} (${((count / this.stats.totalCompressed) * 100).toFixed(1)}%)\n`;
    }

    return report;
  }

  /**
   * Clear deduplication cache
   */
  clearDedupCache(): void {
    this.dedupCache.clear();
  }

  /**
   * Get cache size
   */
  getDedupCacheSize(): number {
    return this.dedupCache.size;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default CompressionManager;
