/**
 * SAFLA Neural Pattern Extraction System
 *
 * This module implements advanced pattern extraction algorithms for identifying
 * successful coordination strategies, optimization patterns, and error handling
 * approaches from execution observations.
 */

import { Database } from 'sqlite3';
import { EventEmitter } from 'events';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ExecutionObservation {
  id: string;
  timestamp: number;
  tool: string;
  parameters: Record<string, any>;
  result: any;
  duration_ms: number;
  success: boolean;
  error?: string;
  context: ExecutionContext;
}

export interface ExecutionContext {
  taskId: string;
  agentId: string;
  workingDirectory: string;
  activePatterns: string[];
  priorSteps: number;
  environmentVars: Record<string, string>;
}

export interface Pattern {
  id: string;
  type: PatternType;
  name: string;
  description: string;
  conditions: PatternConditions;
  actions: PatternAction[];
  successCriteria: SuccessCriteria;
  metrics: PatternMetrics;
  confidence: number;
  usageCount: number;
  createdAt: string;
  lastUsed?: string;
}

export type PatternType =
  | 'coordination'
  | 'optimization'
  | 'error-handling'
  | 'domain-specific'
  | 'refactoring'
  | 'testing';

export interface PatternConditions {
  [key: string]: any;
}

export interface PatternAction {
  step: number;
  type: string;
  tool?: string;
  parameters?: Record<string, any>;
  [key: string]: any;
}

export interface SuccessCriteria {
  minCompletionRate: number;
  maxErrorRate: number;
  maxDurationMs?: number;
}

export interface PatternMetrics {
  successCount: number;
  failureCount: number;
  partialCount: number;
  avgDurationMs: number;
  avgImprovement: number;
  lastSuccess?: string;
  lastFailure?: string;
}

export interface CandidatePattern {
  sequence: string[];
  instances: PatternInstance[];
  support: number;
  avgPerformance: number;
  contexts: ExecutionContext[];
}

export interface PatternInstance {
  observations: ExecutionObservation[];
  performance: number;
  duration: number;
  context: ExecutionContext;
}

export interface QualityScore {
  overall: number;
  consistency: number;
  impact: number;
  generalizability: number;
  frequency: number;
}

export interface BaselineMetrics {
  avgDuration: number;
  avgPerformance: number;
  stdDuration: number;
}

// ============================================================================
// Pattern Extractor
// ============================================================================

export class PatternExtractor {
  private sequenceMiner: SequenceMiner;
  private performanceClusterer: PerformanceClusterer;
  private qualityScorer: PatternQualityScorer;
  private eventEmitter: EventEmitter;

  constructor(
    private db: Database,
    private config: ExtractorConfig = {}
  ) {
    this.sequenceMiner = new SequenceMiner(
      config.minSupport || 3,
      config.minConfidence || 0.7
    );

    this.performanceClusterer = new PerformanceClusterer(
      config.numClusters || 5
    );

    this.qualityScorer = new PatternQualityScorer();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Extract patterns from a batch of observations
   */
  async extractPatterns(
    observations: ExecutionObservation[]
  ): Promise<Pattern[]> {
    console.log(`Extracting patterns from ${observations.length} observations`);

    // Step 1: Mine frequent sequences
    const sequences = await this.sequenceMiner.extractSequences(observations);
    console.log(`Found ${sequences.length} frequent sequences`);

    // Step 2: Cluster by performance
    const clusters = await this.performanceClusterer.clusterByPerformance(
      observations
    );
    console.log(`Identified ${clusters.length} performance clusters`);

    // Step 3: Generate candidate patterns
    const candidates = await this.generateCandidates(sequences, clusters);
    console.log(`Generated ${candidates.length} candidate patterns`);

    // Step 4: Score and filter candidates
    const baseline = await this.calculateBaseline(observations);
    const scoredPatterns = await this.scoreAndFilter(candidates, baseline);
    console.log(`Selected ${scoredPatterns.length} high-quality patterns`);

    // Step 5: Convert to Pattern objects
    const patterns = scoredPatterns.map(sp => this.candidateToPattern(sp));

    // Step 6: Emit events
    this.eventEmitter.emit('patterns_extracted', patterns);

    return patterns;
  }

  /**
   * Generate candidate patterns from sequences and clusters
   */
  private async generateCandidates(
    sequences: ActionSequence[],
    clusters: PerformanceCluster[]
  ): Promise<ScoredCandidatePattern[]> {
    const candidates: ScoredCandidatePattern[] = [];

    // Generate candidates from sequences
    for (const seq of sequences) {
      const candidate: CandidatePattern = {
        sequence: seq.sequence,
        instances: seq.instances,
        support: seq.support,
        avgPerformance: seq.successRate,
        contexts: seq.instances.map(i => i.context)
      };

      candidates.push({ candidate, score: null! });
    }

    // Generate candidates from clusters
    for (const cluster of clusters) {
      const sequence = this.extractSequenceFromCluster(cluster);

      const candidate: CandidatePattern = {
        sequence,
        instances: cluster.members.map(obs => ({
          observations: [obs],
          performance: obs.success ? 1 : 0,
          duration: obs.duration_ms,
          context: obs.context
        })),
        support: cluster.members.length,
        avgPerformance: cluster.avgPerformance,
        contexts: cluster.members.map(m => m.context)
      };

      candidates.push({ candidate, score: null! });
    }

    return candidates;
  }

  /**
   * Score and filter candidates
   */
  private async scoreAndFilter(
    candidates: ScoredCandidatePattern[],
    baseline: BaselineMetrics
  ): Promise<ScoredCandidatePattern[]> {
    // Score each candidate
    for (const candidate of candidates) {
      candidate.score = this.qualityScorer.scorePattern(
        candidate.candidate,
        baseline
      );
    }

    // Filter by minimum quality threshold
    const minQuality = this.config.minQuality || 0.6;
    return candidates.filter(c => c.score.overall >= minQuality);
  }

  /**
   * Calculate baseline metrics
   */
  private async calculateBaseline(
    observations: ExecutionObservation[]
  ): Promise<BaselineMetrics> {
    const durations = observations.map(o => o.duration_ms);
    const performances = observations.map(o => (o.success ? 1 : 0));

    const avgDuration =
      durations.reduce((a, b) => a + b, 0) / durations.length;
    const avgPerformance =
      performances.reduce((a: number, b) => a + b, 0) / performances.length;

    const variance =
      durations
        .map(d => Math.pow(d - avgDuration, 2))
        .reduce((a, b) => a + b, 0) / durations.length;

    return {
      avgDuration,
      avgPerformance,
      stdDuration: Math.sqrt(variance)
    };
  }

  /**
   * Extract sequence from cluster
   */
  private extractSequenceFromCluster(
    cluster: PerformanceCluster
  ): string[] {
    // Find most common tool sequence in cluster
    const sequences = cluster.members.map(m => m.tool);
    return [...new Set(sequences)];
  }

  /**
   * Convert candidate to Pattern
   */
  private candidateToPattern(
    candidate: ScoredCandidatePattern
  ): Pattern {
    const { candidate: cand, score } = candidate;

    return {
      id: this.generatePatternId(),
      type: this.inferPatternType(cand),
      name: this.generatePatternName(cand),
      description: this.generatePatternDescription(cand),
      conditions: this.extractConditions(cand),
      actions: this.extractActions(cand),
      successCriteria: this.extractSuccessCriteria(cand),
      metrics: {
        successCount: Math.floor(cand.avgPerformance * cand.support),
        failureCount: Math.floor((1 - cand.avgPerformance) * cand.support),
        partialCount: 0,
        avgDurationMs:
          cand.instances.reduce((sum, i) => sum + i.duration, 0) /
          cand.instances.length,
        avgImprovement: cand.avgPerformance,
        lastSuccess: new Date().toISOString()
      },
      confidence: score.overall,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };
  }

  private generatePatternId(): string {
    return `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private inferPatternType(candidate: CandidatePattern): PatternType {
    // Simple heuristic based on sequence
    const tools = candidate.sequence;

    if (tools.some(t => t.includes('parallel') || tools.length > 3)) {
      return 'coordination';
    }

    if (tools.some(t => t.includes('cache') || t.includes('batch'))) {
      return 'optimization';
    }

    if (tools.some(t => t.includes('retry') || t.includes('rollback'))) {
      return 'error-handling';
    }

    return 'domain-specific';
  }

  private generatePatternName(candidate: CandidatePattern): string {
    return candidate.sequence.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  private generatePatternDescription(candidate: CandidatePattern): string {
    return `Pattern: ${candidate.sequence.join(' → ')} (support: ${candidate.support})`;
  }

  private extractConditions(candidate: CandidatePattern): PatternConditions {
    // Extract common conditions from instances
    return {
      minInstances: candidate.support,
      toolSequence: candidate.sequence
    };
  }

  private extractActions(candidate: CandidatePattern): PatternAction[] {
    return candidate.sequence.map((tool, index) => ({
      step: index + 1,
      type: 'tool_execution',
      tool
    }));
  }

  private extractSuccessCriteria(
    candidate: CandidatePattern
  ): SuccessCriteria {
    return {
      minCompletionRate: candidate.avgPerformance * 0.9,
      maxErrorRate: 1 - candidate.avgPerformance
    };
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
}

// ============================================================================
// Sequence Miner
// ============================================================================

interface ActionSequence {
  sequence: string[];
  support: number;
  confidence: number;
  avgDuration: number;
  successRate: number;
  instances: PatternInstance[];
}

interface SequenceStats {
  sequence: string[];
  occurrences: number;
  totalDuration: number;
  successCount: number;
  instances: PatternInstance[];
}

class SequenceMiner {
  constructor(
    private minSupport: number = 3,
    private minConfidence: number = 0.7
  ) {}

  async extractSequences(
    observations: ExecutionObservation[]
  ): Promise<ActionSequence[]> {
    // Group observations by task
    const taskGroups = this.groupByTask(observations);

    // Find frequent sequences
    const sequences = new Map<string, SequenceStats>();

    for (const [taskId, obs] of taskGroups) {
      const actions = obs.map(o => o.tool);

      // Generate n-grams (n=2,3,4)
      for (let n = 2; n <= Math.min(4, actions.length); n++) {
        const ngrams = this.generateNGrams(actions, n);

        for (const ngram of ngrams) {
          const key = ngram.join('→');
          const stats = sequences.get(key) || {
            sequence: ngram,
            occurrences: 0,
            totalDuration: 0,
            successCount: 0,
            instances: []
          };

          stats.occurrences++;
          stats.totalDuration += this.getSequenceDuration(obs, ngram);
          stats.successCount += this.isSequenceSuccessful(obs, ngram) ? 1 : 0;

          const instance = this.extractInstance(obs, ngram);
          if (instance) {
            stats.instances.push(instance);
          }

          sequences.set(key, stats);
        }
      }
    }

    // Filter and convert to ActionSequence
    const actionSequences: ActionSequence[] = [];

    for (const [key, stats] of sequences) {
      if (stats.occurrences >= this.minSupport) {
        const confidence = stats.successCount / stats.occurrences;

        if (confidence >= this.minConfidence) {
          actionSequences.push({
            sequence: stats.sequence,
            support: stats.occurrences,
            confidence,
            avgDuration: stats.totalDuration / stats.occurrences,
            successRate: confidence,
            instances: stats.instances
          });
        }
      }
    }

    return actionSequences.sort((a, b) => b.support - a.support);
  }

  private groupByTask(
    observations: ExecutionObservation[]
  ): Map<string, ExecutionObservation[]> {
    const groups = new Map<string, ExecutionObservation[]>();

    for (const obs of observations) {
      const taskId = obs.context.taskId;
      if (!groups.has(taskId)) {
        groups.set(taskId, []);
      }
      groups.get(taskId)!.push(obs);
    }

    return groups;
  }

  private generateNGrams(items: string[], n: number): string[][] {
    const ngrams: string[][] = [];

    for (let i = 0; i <= items.length - n; i++) {
      ngrams.push(items.slice(i, i + n));
    }

    return ngrams;
  }

  private getSequenceDuration(
    observations: ExecutionObservation[],
    sequence: string[]
  ): number {
    for (let i = 0; i <= observations.length - sequence.length; i++) {
      const match = sequence.every(
        (tool, j) => observations[i + j].tool === tool
      );

      if (match) {
        return sequence.reduce(
          (sum, _, j) => sum + observations[i + j].duration_ms,
          0
        );
      }
    }

    return 0;
  }

  private isSequenceSuccessful(
    observations: ExecutionObservation[],
    sequence: string[]
  ): boolean {
    for (let i = 0; i <= observations.length - sequence.length; i++) {
      const match = sequence.every(
        (tool, j) => observations[i + j].tool === tool
      );

      if (match) {
        return sequence.every((_, j) => observations[i + j].success);
      }
    }

    return false;
  }

  private extractInstance(
    observations: ExecutionObservation[],
    sequence: string[]
  ): PatternInstance | null {
    for (let i = 0; i <= observations.length - sequence.length; i++) {
      const match = sequence.every(
        (tool, j) => observations[i + j].tool === tool
      );

      if (match) {
        const instanceObs = observations.slice(i, i + sequence.length);
        return {
          observations: instanceObs,
          performance: instanceObs.every(o => o.success) ? 1 : 0,
          duration: instanceObs.reduce((sum, o) => sum + o.duration_ms, 0),
          context: instanceObs[0].context
        };
      }
    }

    return null;
  }
}

// ============================================================================
// Performance Clusterer
// ============================================================================

interface PerformanceCluster {
  centroid: Feature[];
  members: ExecutionObservation[];
  avgPerformance: number;
  characteristics: ClusterCharacteristics;
}

interface Feature {
  name: string;
  value: number;
}

interface ClusterCharacteristics {
  commonTools: string[];
  avgDuration: number;
  sampleSize: number;
}

interface Cluster {
  centroid: Feature[];
  memberIndices: number[];
}

class PerformanceClusterer {
  constructor(private numClusters: number = 5) {}

  async clusterByPerformance(
    observations: ExecutionObservation[]
  ): Promise<PerformanceCluster[]> {
    if (observations.length < this.numClusters) {
      return [];
    }

    // Extract features
    const features = observations.map(obs => this.extractFeatures(obs));

    // K-means clustering
    const clusters = this.kMeans(features, this.numClusters);

    // Analyze clusters
    const performanceClusters: PerformanceCluster[] = [];

    for (const cluster of clusters) {
      if (cluster.memberIndices.length === 0) continue;

      const members = cluster.memberIndices.map(i => observations[i]);
      const avgPerformance = this.calculateAvgPerformance(members);

      // Only keep high-performing clusters
      if (avgPerformance > 0.7) {
        performanceClusters.push({
          centroid: cluster.centroid,
          members,
          avgPerformance,
          characteristics: this.analyzeCluster(members)
        });
      }
    }

    return performanceClusters.sort(
      (a, b) => b.avgPerformance - a.avgPerformance
    );
  }

  private extractFeatures(obs: ExecutionObservation): Feature[] {
    return [
      {
        name: 'duration_normalized',
        value: this.normalize(obs.duration_ms, 0, 10000)
      },
      { name: 'success', value: obs.success ? 1 : 0 },
      { name: 'complexity', value: this.calculateComplexity(obs) },
      {
        name: 'parallelism',
        value: obs.context.activePatterns.length / 10
      }
    ];
  }

  private normalize(value: number, min: number, max: number): number {
    return Math.min(1, Math.max(0, (value - min) / (max - min)));
  }

  private calculateComplexity(obs: ExecutionObservation): number {
    return Math.min(1, Object.keys(obs.parameters).length / 10);
  }

  private kMeans(features: Feature[][], k: number): Cluster[] {
    // Initialize centroids randomly
    let centroids = this.initializeCentroids(features, k);

    let assignments = new Array(features.length).fill(0);
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100;

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      // Assign points to nearest centroid
      for (let i = 0; i < features.length; i++) {
        const nearest = this.findNearestCentroid(features[i], centroids);
        if (assignments[i] !== nearest) {
          assignments[i] = nearest;
          changed = true;
        }
      }

      // Update centroids
      centroids = this.updateCentroids(features, assignments, k);
    }

    // Build clusters
    const clusters: Cluster[] = [];
    for (let i = 0; i < k; i++) {
      const memberIndices = assignments
        .map((cluster, idx) => (cluster === i ? idx : -1))
        .filter(idx => idx !== -1);

      if (memberIndices.length > 0) {
        clusters.push({
          centroid: centroids[i],
          memberIndices
        });
      }
    }

    return clusters;
  }

  private initializeCentroids(features: Feature[][], k: number): Feature[][] {
    const centroids: Feature[][] = [];
    const indices = new Set<number>();

    while (indices.size < Math.min(k, features.length)) {
      const idx = Math.floor(Math.random() * features.length);
      indices.add(idx);
    }

    for (const idx of indices) {
      centroids.push([...features[idx]]);
    }

    return centroids;
  }

  private findNearestCentroid(
    point: Feature[],
    centroids: Feature[][]
  ): number {
    let minDistance = Infinity;
    let nearest = 0;

    for (let i = 0; i < centroids.length; i++) {
      const distance = this.euclideanDistance(point, centroids[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = i;
      }
    }

    return nearest;
  }

  private euclideanDistance(a: Feature[], b: Feature[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i].value - b[i].value, 2);
    }
    return Math.sqrt(sum);
  }

  private updateCentroids(
    features: Feature[][],
    assignments: number[],
    k: number
  ): Feature[][] {
    const centroids: Feature[][] = [];

    for (let i = 0; i < k; i++) {
      const members = assignments
        .map((cluster, idx) => (cluster === i ? features[idx] : null))
        .filter(f => f !== null) as Feature[][];

      if (members.length === 0) {
        // Use random point if no members
        centroids.push(features[Math.floor(Math.random() * features.length)]);
        continue;
      }

      const centroid: Feature[] = [];
      for (let j = 0; j < features[0].length; j++) {
        const avg =
          members.reduce((sum, member) => sum + member[j].value, 0) /
          members.length;

        centroid.push({
          name: features[0][j].name,
          value: avg
        });
      }

      centroids.push(centroid);
    }

    return centroids;
  }

  private calculateAvgPerformance(
    observations: ExecutionObservation[]
  ): number {
    const successCount = observations.filter(o => o.success).length;
    return successCount / observations.length;
  }

  private analyzeCluster(
    observations: ExecutionObservation[]
  ): ClusterCharacteristics {
    const tools = new Set(observations.map(o => o.tool));
    const avgDuration =
      observations.reduce((sum, o) => sum + o.duration_ms, 0) /
      observations.length;

    return {
      commonTools: Array.from(tools),
      avgDuration,
      sampleSize: observations.length
    };
  }
}

// ============================================================================
// Pattern Quality Scorer
// ============================================================================

class PatternQualityScorer {
  scorePattern(
    pattern: CandidatePattern,
    baseline: BaselineMetrics
  ): QualityScore {
    const consistency = this.scoreConsistency(pattern);
    const impact = this.scoreImpact(pattern, baseline);
    const generalizability = this.scoreGeneralizability(pattern);
    const frequency = this.scoreFrequency(pattern);

    const overall =
      0.4 * consistency +
      0.3 * impact +
      0.2 * generalizability +
      0.1 * frequency;

    return {
      overall,
      consistency,
      impact,
      generalizability,
      frequency
    };
  }

  private scoreConsistency(pattern: CandidatePattern): number {
    const outcomes = pattern.instances.map(i => i.performance);
    if (outcomes.length === 0) return 0;

    const mean = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
    const variance =
      outcomes
        .map(o => Math.pow(o - mean, 2))
        .reduce((a, b) => a + b, 0) / outcomes.length;
    const stdDev = Math.sqrt(variance);

    return Math.max(0, 1 - stdDev);
  }

  private scoreImpact(
    pattern: CandidatePattern,
    baseline: BaselineMetrics
  ): number {
    const patternPerformance = pattern.avgPerformance;
    const improvement =
      (patternPerformance - baseline.avgPerformance) / baseline.avgPerformance;

    return Math.min(1, Math.max(0, improvement + 0.5));
  }

  private scoreGeneralizability(pattern: CandidatePattern): number {
    const contexts = pattern.contexts;
    if (contexts.length === 0) return 0;

    const uniqueAgents = new Set(contexts.map(c => c.agentId)).size;
    const uniqueDirs = new Set(contexts.map(c => c.workingDirectory)).size;

    const contextDiversity =
      (uniqueAgents + uniqueDirs) / (contexts.length * 2);

    return Math.min(1, contextDiversity * 2);
  }

  private scoreFrequency(pattern: CandidatePattern): number {
    const count = pattern.support;

    if (count < 3) return 0.3;
    if (count < 10) return 0.5;
    if (count < 50) return 0.7;
    return 1.0;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ExtractorConfig {
  minSupport?: number;
  minConfidence?: number;
  numClusters?: number;
  minQuality?: number;
}

interface ScoredCandidatePattern {
  candidate: CandidatePattern;
  score: QualityScore;
}

// ============================================================================
// Exports
// ============================================================================

export default PatternExtractor;
