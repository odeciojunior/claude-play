/**
 * SAFLA Neural Learning Pipeline
 *
 * This module orchestrates the complete learning lifecycle:
 * 1. Observation collection
 * 2. Pattern extraction
 * 3. Confidence scoring
 * 4. Pattern storage
 * 5. Pattern application
 * 6. Outcome tracking
 * 7. Continuous improvement
 */

import { Database } from 'sqlite3';
import { EventEmitter } from 'events';
import * as zlib from 'zlib';
import { promisify } from 'util';
import PatternExtractor, {
  ExecutionObservation,
  Pattern,
  PatternType,
  ExecutionContext
} from './pattern-extraction';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface LearningPipelineConfig {
  observationBufferSize: number;
  observationFlushInterval: number;
  extractionBatchSize: number;
  minPatternQuality: number;
  minConfidenceThreshold: number;
  consolidationSchedule: 'hourly' | 'daily' | 'weekly';
  autoLearning: boolean;
  maxPatternsPerType: number;
}

export interface Outcome {
  taskId: string;
  patternId: string;
  status: 'success' | 'failure' | 'partial';
  confidence: number;
  metrics: OutcomeMetrics;
  judgeReasons: string[];
  timestamp: string;
}

export interface OutcomeMetrics {
  durationMs: number;
  resourceUsage?: ResourceUsage;
  errorCount: number;
  improvementVsBaseline: number;
}

export interface ResourceUsage {
  memoryMb: number;
  cpuPercent: number;
}

export interface ConfidenceUpdate {
  patternId: string;
  oldConfidence: number;
  newConfidence: number;
  reason: string;
}

export interface LearningMetrics {
  observationsCollected: number;
  patternsExtracted: number;
  patternsStored: number;
  patternsApplied: number;
  avgConfidence: number;
  successRate: number;
}

// ============================================================================
// Learning Pipeline
// ============================================================================

export class LearningPipeline {
  private observationBuffer: ExecutionObservation[] = [];
  private patternExtractor: PatternExtractor;
  private confidenceUpdater: BayesianConfidenceUpdater;
  private patternStorage: PatternStorage;
  private workingMemory: WorkingMemory;
  private eventEmitter: EventEmitter;
  private flushTimer?: NodeJS.Timeout;
  private consolidationTimer?: NodeJS.Timeout;
  private metrics: LearningMetrics;

  constructor(
    private db: Database,
    private config: LearningPipelineConfig
  ) {
    this.patternExtractor = new PatternExtractor(db, {
      minSupport: 3,
      minConfidence: config.minConfidenceThreshold,
      minQuality: config.minPatternQuality
    });

    this.confidenceUpdater = new BayesianConfidenceUpdater();
    this.patternStorage = new PatternStorage(db);
    this.workingMemory = WorkingMemory.getInstance();
    this.eventEmitter = new EventEmitter();

    this.metrics = {
      observationsCollected: 0,
      patternsExtracted: 0,
      patternsStored: 0,
      patternsApplied: 0,
      avgConfidence: 0,
      successRate: 0
    };

    this.initialize();
  }

  /**
   * Initialize the learning pipeline
   */
  private async initialize() {
    // Start periodic observation flush
    this.flushTimer = setInterval(
      () => this.flushObservations(),
      this.config.observationFlushInterval
    );

    // Start periodic consolidation
    const consolidationInterval = this.getConsolidationInterval();
    this.consolidationTimer = setInterval(
      () => this.consolidatePatterns(),
      consolidationInterval
    );

    // Listen to pattern extraction events
    this.patternExtractor.on('patterns_extracted', async (patterns: Pattern[]) => {
      await this.handleExtractedPatterns(patterns);
    });

    console.log('Learning pipeline initialized');
  }

  /**
   * Observe a tool execution
   */
  async observe(
    tool: string,
    params: any,
    executor: () => Promise<any>
  ): Promise<any> {
    const observation: ExecutionObservation = {
      id: this.generateId(),
      timestamp: Date.now(),
      tool,
      parameters: this.sanitizeParams(params),
      result: null,
      duration_ms: 0,
      success: false,
      context: await this.captureContext()
    };

    const startTime = Date.now();

    try {
      const result = await executor();

      observation.result = this.sanitizeResult(result);
      observation.duration_ms = Date.now() - startTime;
      observation.success = true;

      this.recordObservation(observation);

      return result;
    } catch (error) {
      observation.error = (error as Error).message;
      observation.duration_ms = Date.now() - startTime;
      observation.success = false;

      this.recordObservation(observation);

      throw error;
    }
  }

  /**
   * Record an observation
   */
  private recordObservation(observation: ExecutionObservation) {
    this.observationBuffer.push(observation);
    this.metrics.observationsCollected++;

    // Emit event
    this.eventEmitter.emit('observation', observation);

    // Flush if buffer is full
    if (this.observationBuffer.length >= this.config.observationBufferSize) {
      this.flushObservations();
    }
  }

  /**
   * Flush observations and trigger pattern extraction
   */
  private async flushObservations() {
    if (this.observationBuffer.length === 0) return;

    const observations = this.observationBuffer.splice(0);

    console.log(`Flushing ${observations.length} observations`);

    // Extract patterns if we have enough observations
    if (observations.length >= this.config.extractionBatchSize) {
      if (this.config.autoLearning) {
        await this.extractPatternsFromObservations(observations);
      }
    }

    // Store observations in database
    await this.storeObservations(observations);
  }

  /**
   * Extract patterns from observations
   */
  private async extractPatternsFromObservations(
    observations: ExecutionObservation[]
  ) {
    try {
      const patterns = await this.patternExtractor.extractPatterns(observations);
      this.metrics.patternsExtracted += patterns.length;

      console.log(`Extracted ${patterns.length} patterns`);

      // Patterns will be handled by the event listener
    } catch (error) {
      console.error('Pattern extraction failed:', error);
    }
  }

  /**
   * Handle extracted patterns
   */
  private async handleExtractedPatterns(patterns: Pattern[]) {
    for (const pattern of patterns) {
      try {
        // Check if similar pattern exists
        const similar = await this.patternStorage.findSimilar(pattern, 0.95);

        if (similar) {
          // Merge with existing pattern
          await this.patternStorage.mergePatterns(similar.id, pattern);
          console.log(`Merged pattern with existing: ${similar.id}`);
        } else {
          // Store as new pattern
          await this.patternStorage.store(pattern);
          this.metrics.patternsStored++;
          console.log(`Stored new pattern: ${pattern.id}`);

          // Add to working memory if high confidence
          if (pattern.confidence >= 0.7) {
            this.workingMemory.cachePattern(pattern);
          }
        }

        // Emit event
        this.eventEmitter.emit('pattern_stored', pattern);
      } catch (error) {
        console.error(`Failed to store pattern ${pattern.id}:`, error);
      }
    }
  }

  /**
   * Apply best matching pattern to a task
   */
  async applyBestPattern(
    taskDescription: string,
    context: ExecutionContext
  ): Promise<PatternApplication> {
    try {
      // Search for matching patterns
      const candidates = await this.patternStorage.search({
        query: taskDescription,
        minConfidence: this.config.minConfidenceThreshold,
        limit: 10
      });

      if (candidates.length === 0) {
        return {
          applied: false,
          reason: 'no_suitable_pattern'
        };
      }

      // Rank patterns by relevance and confidence
      const ranked = this.rankPatterns(candidates, context);
      const best = ranked[0];

      // Check if pattern meets confidence threshold
      if (best.confidence < this.config.minConfidenceThreshold) {
        return {
          applied: false,
          reason: 'confidence_too_low',
          patternId: best.id
        };
      }

      // Apply pattern
      this.metrics.patternsApplied++;
      this.eventEmitter.emit('pattern_applied', best);

      return {
        applied: true,
        patternId: best.id,
        pattern: best,
        confidence: best.confidence
      };
    } catch (error) {
      console.error('Pattern application failed:', error);
      return {
        applied: false,
        reason: 'error',
        error: (error as Error).message
      };
    }
  }

  /**
   * Rank patterns by relevance
   */
  private rankPatterns(patterns: Pattern[], context: ExecutionContext): Pattern[] {
    return patterns.sort((a, b) => {
      // Score based on confidence, usage, and recency
      const scoreA =
        a.confidence * 0.6 +
        Math.min(1, a.usageCount / 100) * 0.2 +
        (a.lastUsed ? this.recencyScore(a.lastUsed) : 0) * 0.2;

      const scoreB =
        b.confidence * 0.6 +
        Math.min(1, b.usageCount / 100) * 0.2 +
        (b.lastUsed ? this.recencyScore(b.lastUsed) : 0) * 0.2;

      return scoreB - scoreA;
    });
  }

  private recencyScore(lastUsed: string): number {
    const daysSince = (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - daysSince / 90); // Decay over 90 days
  }

  /**
   * Track outcome and update confidence
   */
  async trackOutcome(outcome: Outcome) {
    try {
      const pattern = await this.patternStorage.get(outcome.patternId);
      if (!pattern) {
        console.error(`Pattern ${outcome.patternId} not found`);
        return;
      }

      // Update confidence
      const update = this.confidenceUpdater.updateConfidence(pattern, {
        outcome: outcome.status,
        performance: outcome.confidence,
        context: {} as ExecutionContext
      });

      // Update pattern in storage
      await this.patternStorage.updateConfidence(
        outcome.patternId,
        update.newConfidence
      );

      // Update metrics
      await this.patternStorage.recordUsage(
        outcome.patternId,
        outcome.status,
        outcome.metrics.durationMs
      );

      // Update metrics
      this.updateSuccessRate(outcome);

      // Emit event
      this.eventEmitter.emit('confidence_updated', update);

      console.log(
        `Updated confidence for ${outcome.patternId}: ${update.oldConfidence.toFixed(3)} → ${update.newConfidence.toFixed(3)}`
      );
    } catch (error) {
      console.error('Outcome tracking failed:', error);
    }
  }

  /**
   * Consolidate patterns (merge duplicates, prune low-value)
   */
  private async consolidatePatterns() {
    console.log('Starting pattern consolidation...');

    try {
      const startTime = Date.now();

      // Get consolidation stats
      const stats = await this.patternStorage.consolidate({
        mergeSimilarity: 0.95,
        pruneConfidenceThreshold: 0.3,
        pruneUsageThreshold: 5,
        pruneAgeDays: 30
      });

      const duration = Date.now() - startTime;

      console.log(
        `Consolidation complete: merged=${stats.merged}, pruned=${stats.pruned}, duration=${duration}ms`
      );

      // Emit event
      this.eventEmitter.emit('consolidation_complete', stats);
    } catch (error) {
      console.error('Consolidation failed:', error);
    }
  }

  /**
   * Get learning metrics
   */
  getMetrics(): LearningMetrics {
    return { ...this.metrics };
  }

  /**
   * Train with manual pattern
   */
  async train(pattern: Pattern): Promise<void> {
    // Validate pattern
    this.validatePattern(pattern);

    // Store pattern
    await this.patternStorage.store(pattern);
    this.metrics.patternsStored++;

    // Add to working memory
    if (pattern.confidence >= 0.7) {
      this.workingMemory.cachePattern(pattern);
    }

    console.log(`Manually trained pattern: ${pattern.id}`);
  }

  /**
   * Shutdown pipeline
   */
  async shutdown() {
    // Stop timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
    }

    // Flush remaining observations
    await this.flushObservations();

    console.log('Learning pipeline shut down');
  }

  // Helper methods

  private async captureContext(): Promise<ExecutionContext> {
    return {
      taskId: this.workingMemory.getCurrentTaskId(),
      agentId: process.env.AGENT_ID || 'default',
      workingDirectory: process.cwd(),
      activePatterns: this.workingMemory.getActivePatterns(),
      priorSteps: this.workingMemory.getStepCount(),
      environmentVars: {
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    };
  }

  private sanitizeParams(params: any): any {
    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];

    for (const key in sanitized) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private sanitizeResult(result: any): any {
    if (typeof result === 'string' && result.length > 10000) {
      return result.substring(0, 10000) + '... [truncated]';
    }
    return result;
  }

  private async storeObservations(observations: ExecutionObservation[]) {
    // Store in temporary table for processing
    // Implementation depends on database setup
  }

  private generateId(): string {
    return `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getConsolidationInterval(): number {
    switch (this.config.consolidationSchedule) {
      case 'hourly':
        return 60 * 60 * 1000;
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private validatePattern(pattern: Pattern) {
    if (!pattern.id || !pattern.type || !pattern.name) {
      throw new Error('Invalid pattern: missing required fields');
    }

    if (pattern.confidence < 0 || pattern.confidence > 1) {
      throw new Error('Invalid pattern: confidence must be between 0 and 1');
    }
  }

  private updateSuccessRate(outcome: Outcome) {
    // Simple moving average
    const alpha = 0.1;
    const success = outcome.status === 'success' ? 1 : 0;
    this.metrics.successRate =
      alpha * success + (1 - alpha) * this.metrics.successRate;
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
}

// ============================================================================
// Bayesian Confidence Updater
// ============================================================================

interface Evidence {
  outcome: 'success' | 'failure' | 'partial';
  performance: number;
  context: ExecutionContext;
}

class BayesianConfidenceUpdater {
  private readonly DECAY_FACTOR = 0.95;
  private readonly LEARNING_RATE = 0.1;

  updateConfidence(pattern: Pattern, evidence: Evidence): ConfidenceUpdate {
    const oldConfidence = pattern.confidence;

    // Score evidence
    const evidenceScore = this.scoreEvidence(evidence);

    // Bayesian update
    const likelihood = this.calculateLikelihood(evidence, pattern);
    const posterior = this.bayesianUpdate(
      oldConfidence,
      likelihood,
      evidenceScore
    );

    // Apply learning rate
    const newConfidence =
      oldConfidence + this.LEARNING_RATE * (posterior - oldConfidence);

    return {
      patternId: pattern.id,
      oldConfidence,
      newConfidence: Math.max(0, Math.min(1, newConfidence)),
      reason: `Bayesian update based on ${evidence.outcome}`
    };
  }

  private scoreEvidence(evidence: Evidence): number {
    switch (evidence.outcome) {
      case 'success':
        return evidence.performance;
      case 'partial':
        return evidence.performance * 0.5;
      case 'failure':
        return 0.0;
    }
  }

  private calculateLikelihood(evidence: Evidence, pattern: Pattern): number {
    const successRate =
      (pattern.metrics?.successCount || 0) / (pattern.usageCount || 1);

    if (evidence.outcome === 'success') {
      return successRate;
    } else {
      return 1 - successRate;
    }
  }

  private bayesianUpdate(
    prior: number,
    likelihood: number,
    evidence: number
  ): number {
    const numerator = likelihood * prior;
    const denominator = numerator + (1 - prior) * (1 - likelihood);
    return numerator / (denominator || 1);
  }
}

// ============================================================================
// Pattern Storage
// ============================================================================

class PatternStorage {
  constructor(private db: Database) {}

  async store(pattern: Pattern): Promise<void> {
    const compressed = await this.compressPattern(pattern);

    await this.db.run(
      `INSERT INTO patterns (id, type, pattern_data, confidence, usage_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        pattern.id,
        pattern.type,
        compressed,
        pattern.confidence,
        pattern.usageCount,
        pattern.createdAt
      ]
    );
  }

  async get(patternId: string): Promise<Pattern | null> {
    const row = await this.db.get(
      'SELECT * FROM patterns WHERE id = ?',
      [patternId]
    );

    if (!row) return null;

    return await this.decompressPattern(row);
  }

  async search(options: {
    query?: string;
    type?: PatternType;
    minConfidence?: number;
    limit?: number;
  }): Promise<Pattern[]> {
    let sql = 'SELECT * FROM patterns WHERE 1=1';
    const params: any[] = [];

    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }

    if (options.minConfidence) {
      sql += ' AND confidence >= ?';
      params.push(options.minConfidence);
    }

    sql += ' ORDER BY confidence DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = await this.db.all(sql, params);

    return Promise.all(rows.map(row => this.decompressPattern(row)));
  }

  async findSimilar(
    pattern: Pattern,
    threshold: number
  ): Promise<Pattern | null> {
    // Simplified: compare pattern names
    const patterns = await this.search({ type: pattern.type });

    for (const p of patterns) {
      if (this.calculateSimilarity(pattern, p) >= threshold) {
        return p;
      }
    }

    return null;
  }

  async mergePatterns(targetId: string, source: Pattern): Promise<void> {
    const target = await this.get(targetId);
    if (!target) return;

    // Merge metrics
    target.metrics.successCount += source.metrics.successCount;
    target.metrics.failureCount += source.metrics.failureCount;
    target.usageCount += source.usageCount;

    // Update confidence (weighted average)
    target.confidence =
      (target.confidence * target.usageCount +
        source.confidence * source.usageCount) /
      (target.usageCount + source.usageCount);

    await this.update(target);
  }

  async update(pattern: Pattern): Promise<void> {
    const compressed = await this.compressPattern(pattern);

    await this.db.run(
      `UPDATE patterns
       SET pattern_data = ?, confidence = ?, usage_count = ?, last_used = ?
       WHERE id = ?`,
      [compressed, pattern.confidence, pattern.usageCount, pattern.lastUsed, pattern.id]
    );
  }

  async updateConfidence(patternId: string, confidence: number): Promise<void> {
    await this.db.run(
      'UPDATE patterns SET confidence = ? WHERE id = ?',
      [confidence, patternId]
    );
  }

  async recordUsage(
    patternId: string,
    outcome: 'success' | 'failure' | 'partial',
    durationMs: number
  ): Promise<void> {
    const pattern = await this.get(patternId);
    if (!pattern) return;

    pattern.usageCount++;
    pattern.lastUsed = new Date().toISOString();

    if (outcome === 'success') {
      pattern.metrics.successCount++;
    } else if (outcome === 'failure') {
      pattern.metrics.failureCount++;
    } else {
      pattern.metrics.partialCount++;
    }

    // Update average duration
    const totalDuration =
      pattern.metrics.avgDurationMs * (pattern.usageCount - 1) + durationMs;
    pattern.metrics.avgDurationMs = totalDuration / pattern.usageCount;

    await this.update(pattern);
  }

  async consolidate(options: {
    mergeSimilarity: number;
    pruneConfidenceThreshold: number;
    pruneUsageThreshold: number;
    pruneAgeDays: number;
  }): Promise<{ merged: number; pruned: number }> {
    let merged = 0;
    let pruned = 0;

    // Find and merge similar patterns
    const patterns = await this.search({});

    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        if (
          this.calculateSimilarity(patterns[i], patterns[j]) >=
          options.mergeSimilarity
        ) {
          await this.mergePatterns(patterns[i].id, patterns[j]);
          await this.delete(patterns[j].id);
          merged++;
        }
      }
    }

    // Prune low-value patterns
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.pruneAgeDays);

    const pruneResults = await this.db.run(
      `DELETE FROM patterns
       WHERE confidence < ?
         AND usage_count < ?
         AND created_at < ?`,
      [
        options.pruneConfidenceThreshold,
        options.pruneUsageThreshold,
        cutoffDate.toISOString()
      ]
    );

    pruned = pruneResults.changes || 0;

    return { merged, pruned };
  }

  async delete(patternId: string): Promise<void> {
    await this.db.run('DELETE FROM patterns WHERE id = ?', [patternId]);
  }

  private async compressPattern(pattern: Pattern): Promise<string> {
    const json = JSON.stringify(pattern);
    const compressed = await gzip(json);
    return compressed.toString('base64');
  }

  private async decompressPattern(row: any): Promise<Pattern> {
    const buffer = Buffer.from(row.pattern_data, 'base64');
    const decompressed = await gunzip(buffer);
    return JSON.parse(decompressed.toString());
  }

  private calculateSimilarity(a: Pattern, b: Pattern): number {
    // Simple name-based similarity
    if (a.name === b.name) return 1.0;

    // Levenshtein distance
    const distance = this.levenshteinDistance(a.name, b.name);
    const maxLength = Math.max(a.name.length, b.name.length);
    return 1 - distance / maxLength;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}

// ============================================================================
// Working Memory (Singleton)
// ============================================================================

class WorkingMemory {
  private static instance: WorkingMemory;
  private patternCache = new Map<string, Pattern>();
  private currentTaskId: string = '';
  private activePatterns = new Set<string>();
  private stepCount: number = 0;

  private constructor() {}

  static getInstance(): WorkingMemory {
    if (!WorkingMemory.instance) {
      WorkingMemory.instance = new WorkingMemory();
    }
    return WorkingMemory.instance;
  }

  cachePattern(pattern: Pattern) {
    this.patternCache.set(pattern.id, pattern);
  }

  getPattern(patternId: string): Pattern | null {
    return this.patternCache.get(patternId) || null;
  }

  getCurrentTaskId(): string {
    return this.currentTaskId;
  }

  setCurrentTaskId(taskId: string) {
    this.currentTaskId = taskId;
    this.stepCount = 0;
  }

  getActivePatterns(): string[] {
    return Array.from(this.activePatterns);
  }

  activatePattern(patternId: string) {
    this.activePatterns.add(patternId);
  }

  deactivatePattern(patternId: string) {
    this.activePatterns.delete(patternId);
  }

  getStepCount(): number {
    return this.stepCount;
  }

  incrementStepCount() {
    this.stepCount++;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface PatternApplication {
  applied: boolean;
  patternId?: string;
  pattern?: Pattern;
  confidence?: number;
  reason?: string;
  error?: string;
}

// ============================================================================
// Exports
// ============================================================================

export default LearningPipeline;
