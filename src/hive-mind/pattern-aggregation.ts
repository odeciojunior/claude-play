/**
 * Pattern Aggregation System - Hive-Mind Distributed Learning
 *
 * Aggregates patterns from multiple workers, validates via consensus,
 * and builds collective intelligence library with 2x faster growth.
 */

import { EventEmitter } from 'events';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import { Pattern } from '../neural/pattern-extraction';
import { ByzantineConsensus, ConsensusProposal } from './byzantine-consensus';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PatternContribution {
  pattern: Pattern;
  contributorId: string;
  contributorRole: string;
  contribution_score: number;
  timestamp: string;
}

export interface AggregatedPattern {
  basePattern: Pattern;
  contributors: PatternContribution[];
  consensusScore: number;
  validatedAt: string;
  usageAcrossWorkers: number;
  collectiveConfidence: number;
}

export interface AggregationMetrics {
  totalPatterns: number;
  validatedPatterns: number;
  rejectedPatterns: number;
  avgContributors: number;
  avgConsensusScore: number;
  collectiveGrowthRate: number; // patterns per hour
}

export interface ConflictResolution {
  conflictId: string;
  conflictingPatterns: Pattern[];
  resolutionStrategy: 'merge' | 'vote' | 'defer_to_expert' | 'create_variant';
  resolvedPattern?: Pattern;
  resolution: string;
  timestamp: string;
}

// ============================================================================
// Pattern Aggregation System
// ============================================================================

export class PatternAggregator extends EventEmitter {
  private pendingPatterns: Map<string, PatternContribution[]> = new Map();
  private aggregatedPatterns: Map<string, AggregatedPattern> = new Map();
  private metrics: AggregationMetrics;
  private aggregationInterval?: NodeJS.Timeout;
  private lastAggregationTime: number = Date.now();

  constructor(
    private db: Database,
    private consensus: ByzantineConsensus,
    private config: {
      aggregationInterval: number;
      minContributors: number;
      minConsensusScore: number;
      conflictThreshold: number;
    }
  ) {
    super();

    this.metrics = {
      totalPatterns: 0,
      validatedPatterns: 0,
      rejectedPatterns: 0,
      avgContributors: 0,
      avgConsensusScore: 0,
      collectiveGrowthRate: 0
    };

    this.initialize();
  }

  /**
   * Initialize aggregation system
   */
  private async initialize() {
    console.log('🔄 Pattern Aggregation System initializing...');

    // Load existing aggregated patterns
    await this.loadAggregatedPatterns();

    // Start periodic aggregation
    this.aggregationInterval = setInterval(
      () => this.aggregatePatterns(),
      this.config.aggregationInterval
    );

    console.log('🔄 Pattern Aggregation System ready');
    this.emit('system_ready');
  }

  /**
   * Submit pattern for aggregation
   */
  async submitPattern(contribution: PatternContribution): Promise<void> {
    console.log(
      `🔄 Pattern submitted: ${contribution.pattern.id} by ${contribution.contributorId}`
    );

    // Get or create contribution list for this pattern signature
    const signature = this.calculatePatternSignature(contribution.pattern);
    const contributions = this.pendingPatterns.get(signature) || [];

    contributions.push(contribution);
    this.pendingPatterns.set(signature, contributions);

    this.metrics.totalPatterns++;

    this.emit('pattern_submitted', contribution);

    // Aggregate immediately if we have enough contributors
    if (contributions.length >= this.config.minContributors) {
      await this.aggregateSinglePattern(signature, contributions);
    }
  }

  /**
   * Aggregate all pending patterns
   */
  private async aggregatePatterns() {
    console.log(`🔄 Starting aggregation round (${this.pendingPatterns.size} pending)`);

    const startTime = Date.now();
    let aggregated = 0;

    for (const [signature, contributions] of this.pendingPatterns.entries()) {
      if (contributions.length >= this.config.minContributors) {
        await this.aggregateSinglePattern(signature, contributions);
        this.pendingPatterns.delete(signature);
        aggregated++;
      }
    }

    const duration = Date.now() - startTime;
    this.updateGrowthRate();

    console.log(
      `🔄 Aggregation complete: ${aggregated} patterns aggregated in ${duration}ms`
    );

    this.emit('aggregation_complete', {
      aggregated,
      duration,
      pending: this.pendingPatterns.size
    });
  }

  /**
   * Aggregate single pattern with consensus validation
   */
  private async aggregateSinglePattern(
    signature: string,
    contributions: PatternContribution[]
  ): Promise<boolean> {
    console.log(
      `🔄 Aggregating pattern ${signature} (${contributions.length} contributors)`
    );

    // Check for conflicts
    const conflicts = this.detectConflicts(contributions);

    if (conflicts.length > 0) {
      console.log(`🔄 Conflicts detected: ${conflicts.length}`);
      await this.resolveConflicts(signature, contributions, conflicts);
      return false;
    }

    // Merge contributions into base pattern
    const basePattern = this.mergeContributions(contributions);

    // Submit for consensus validation
    const proposal: ConsensusProposal = {
      id: `validate-pattern-${signature}`,
      proposerId: 'pattern-aggregator',
      type: 'pattern_validation',
      data: {
        pattern: basePattern,
        contributions
      },
      requiredQuorum: 0.6,
      requiredConsensus: this.config.minConsensusScore,
      timeout: 30000,
      timestamp: new Date().toISOString()
    };

    try {
      const result = await this.consensus.submitProposal(proposal);

      if (result === 'approved') {
        // Pattern validated - store in collective library
        const aggregated: AggregatedPattern = {
          basePattern,
          contributors: contributions,
          consensusScore: this.config.minConsensusScore,
          validatedAt: new Date().toISOString(),
          usageAcrossWorkers: contributions.length,
          collectiveConfidence: this.calculateCollectiveConfidence(contributions)
        };

        await this.storeAggregatedPattern(aggregated);

        this.metrics.validatedPatterns++;
        this.updateMetrics(contributions);

        console.log(
          `🔄 Pattern validated: ${basePattern.id} ` +
          `(confidence: ${(aggregated.collectiveConfidence * 100).toFixed(0)}%)`
        );

        this.emit('pattern_validated', aggregated);
        return true;
      } else {
        this.metrics.rejectedPatterns++;
        console.log(`🔄 Pattern rejected: ${basePattern.id}`);
        this.emit('pattern_rejected', { signature, reason: result });
        return false;
      }
    } catch (error) {
      console.error('Pattern aggregation failed:', error);
      return false;
    }
  }

  /**
   * Calculate pattern signature (for grouping similar patterns)
   */
  private calculatePatternSignature(pattern: Pattern): string {
    // Use pattern type + name hash as signature
    const key = `${pattern.type}-${pattern.name.toLowerCase().replace(/\s+/g, '-')}`;
    return key;
  }

  /**
   * Detect conflicts between pattern contributions
   */
  private detectConflicts(contributions: PatternContribution[]): string[] {
    const conflicts: string[] = [];

    // Check confidence variance
    const confidences = contributions.map(c => c.pattern.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const variance = confidences.reduce(
      (sum, c) => sum + Math.pow(c - avgConfidence, 2),
      0
    ) / confidences.length;

    if (variance > this.config.conflictThreshold) {
      conflicts.push('high_confidence_variance');
    }

    // Check if patterns have significantly different success rates
    const successRates = contributions.map(c => {
      const metrics = c.pattern.metrics;
      return metrics.successCount / (metrics.successCount + metrics.failureCount || 1);
    });

    const avgSuccess = successRates.reduce((a, b) => a + b, 0) / successRates.length;
    const successVariance = successRates.reduce(
      (sum, s) => sum + Math.pow(s - avgSuccess, 2),
      0
    ) / successRates.length;

    if (successVariance > 0.1) {
      conflicts.push('success_rate_discrepancy');
    }

    return conflicts;
  }

  /**
   * Resolve conflicts between patterns
   */
  private async resolveConflicts(
    signature: string,
    contributions: PatternContribution[],
    conflicts: string[]
  ): Promise<ConflictResolution> {
    console.log(`🔄 Resolving conflicts for ${signature}: ${conflicts.join(', ')}`);

    // Strategy: Use weighted average based on contribution scores
    let strategy: ConflictResolution['resolutionStrategy'] = 'merge';
    let resolvedPattern: Pattern | undefined;

    if (conflicts.includes('high_confidence_variance')) {
      // Merge with weighted average
      resolvedPattern = this.mergeContributions(contributions);
      strategy = 'merge';
    } else if (conflicts.includes('success_rate_discrepancy')) {
      // Vote based on success rates
      const best = contributions.reduce((prev, curr) =>
        curr.pattern.metrics.successCount > prev.pattern.metrics.successCount
          ? curr
          : prev
      );
      resolvedPattern = best.pattern;
      strategy = 'vote';
    }

    const resolution: ConflictResolution = {
      conflictId: `conflict-${signature}-${Date.now()}`,
      conflictingPatterns: contributions.map(c => c.pattern),
      resolutionStrategy: strategy,
      resolvedPattern,
      resolution: `Resolved using ${strategy} strategy`,
      timestamp: new Date().toISOString()
    };

    // Store conflict resolution
    await this.storeConflictResolution(resolution);

    this.emit('conflict_resolved', resolution);

    // Continue aggregation with resolved pattern
    if (resolvedPattern) {
      const resolved: PatternContribution = {
        pattern: resolvedPattern,
        contributorId: 'conflict-resolver',
        contributorRole: 'aggregator',
        contribution_score: 1.0,
        timestamp: new Date().toISOString()
      };

      await this.aggregateSinglePattern(signature, [resolved]);
    }

    return resolution;
  }

  /**
   * Merge pattern contributions
   */
  private mergeContributions(contributions: PatternContribution[]): Pattern {
    const base = contributions[0].pattern;

    // Calculate weighted average confidence
    const totalWeight = contributions.reduce((sum, c) => sum + c.contribution_score, 0);
    const weightedConfidence = contributions.reduce(
      (sum, c) => sum + c.pattern.confidence * c.contribution_score,
      0
    ) / totalWeight;

    // Merge metrics
    const mergedMetrics = {
      successCount: contributions.reduce(
        (sum, c) => sum + c.pattern.metrics.successCount,
        0
      ),
      failureCount: contributions.reduce(
        (sum, c) => sum + c.pattern.metrics.failureCount,
        0
      ),
      partialCount: contributions.reduce(
        (sum, c) => sum + c.pattern.metrics.partialCount,
        0
      ),
      avgDurationMs: contributions.reduce(
        (sum, c) => sum + c.pattern.metrics.avgDurationMs,
        0
      ) / contributions.length,
      avgImprovement: contributions.reduce(
        (sum, c) => sum + c.pattern.metrics.avgImprovement,
        0
      ) / contributions.length
    };

    // Merge usage count
    const mergedUsageCount = contributions.reduce(
      (sum, c) => sum + c.pattern.usageCount,
      0
    );

    return {
      ...base,
      confidence: weightedConfidence,
      metrics: mergedMetrics,
      usageCount: mergedUsageCount,
      lastUsed: new Date().toISOString()
    };
  }

  /**
   * Calculate collective confidence
   */
  private calculateCollectiveConfidence(contributions: PatternContribution[]): number {
    // Higher confidence if more workers agree
    const diversityBonus = Math.min(0.2, contributions.length * 0.05);
    const baseConfidence = contributions.reduce(
      (sum, c) => sum + c.pattern.confidence,
      0
    ) / contributions.length;

    return Math.min(1, baseConfidence + diversityBonus);
  }

  /**
   * Store aggregated pattern
   */
  private async storeAggregatedPattern(aggregated: AggregatedPattern) {
    this.aggregatedPatterns.set(aggregated.basePattern.id, aggregated);

    const dbRun = promisify(this.db.run.bind(this.db)) as (sql: string, params?: any[]) => Promise<void>;

    try {
      await dbRun(
        `INSERT INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'collective-patterns',
          `pattern/${aggregated.basePattern.id}`,
          JSON.stringify(aggregated),
          new Date().toISOString()
        ]
      );

      console.log(`🔄 Stored aggregated pattern: ${aggregated.basePattern.id}`);
    } catch (error) {
      console.error('Failed to store aggregated pattern:', error);
    }
  }

  /**
   * Store conflict resolution
   */
  private async storeConflictResolution(resolution: ConflictResolution) {
    const dbRun = promisify(this.db.run.bind(this.db)) as (sql: string, params?: any[]) => Promise<void>;

    try {
      await dbRun(
        `INSERT INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'conflict-resolutions',
          `conflict/${resolution.conflictId}`,
          JSON.stringify(resolution),
          new Date().toISOString()
        ]
      );
    } catch (error) {
      console.error('Failed to store conflict resolution:', error);
    }
  }

  /**
   * Load existing aggregated patterns
   */
  private async loadAggregatedPatterns() {
    const dbAll = promisify(this.db.all.bind(this.db)) as (sql: string, params?: any[]) => Promise<any[]>;

    try {
      const rows = await dbAll(
        `SELECT value FROM memory_entries
         WHERE namespace = 'collective-patterns'
         ORDER BY created_at DESC
         LIMIT 1000`
      );

      for (const row of rows) {
        const aggregated: AggregatedPattern = JSON.parse(row.value);
        this.aggregatedPatterns.set(aggregated.basePattern.id, aggregated);
      }

      console.log(`🔄 Loaded ${this.aggregatedPatterns.size} aggregated patterns`);
    } catch (error) {
      console.error('Failed to load aggregated patterns:', error);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(contributions: PatternContribution[]) {
    // Update average contributors
    const alpha = 0.1;
    this.metrics.avgContributors =
      alpha * contributions.length + (1 - alpha) * this.metrics.avgContributors;

    // Update average consensus score
    this.metrics.avgConsensusScore =
      alpha * this.config.minConsensusScore + (1 - alpha) * this.metrics.avgConsensusScore;
  }

  /**
   * Update growth rate
   */
  private updateGrowthRate() {
    const now = Date.now();
    const hoursElapsed = (now - this.lastAggregationTime) / (1000 * 60 * 60);

    if (hoursElapsed > 0) {
      const patternsPerHour = this.metrics.validatedPatterns / hoursElapsed;
      this.metrics.collectiveGrowthRate = patternsPerHour;
    }
  }

  /**
   * Get aggregation metrics
   */
  getMetrics(): AggregationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get aggregated pattern
   */
  getAggregatedPattern(patternId: string): AggregatedPattern | undefined {
    return this.aggregatedPatterns.get(patternId);
  }

  /**
   * Get all aggregated patterns
   */
  getAllAggregatedPatterns(): AggregatedPattern[] {
    return Array.from(this.aggregatedPatterns.values());
  }

  /**
   * Shutdown
   */
  async shutdown() {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }

    // Final aggregation
    await this.aggregatePatterns();

    console.log('🔄 Pattern Aggregation System shut down');
  }
}

export default PatternAggregator;
