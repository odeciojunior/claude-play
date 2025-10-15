/**
 * SAFLA Neural Verification Learning System
 *
 * This module integrates the verification system with neural learning to:
 * 1. Learn from verification outcomes (pass/fail, truth scores)
 * 2. Predict truth scores before verification
 * 3. Adaptively tune verification thresholds
 * 4. Build a verification pattern library
 *
 * Key Capabilities:
 * - Truth score prediction (target: >85% accuracy)
 * - Adaptive threshold tuning (context-aware)
 * - Failure pattern detection and prevention
 * - Agent reliability learning
 */

import { Database } from 'sqlite3';
import { EventEmitter } from 'events';
import { LearningPipeline, Outcome, OutcomeMetrics } from './learning-pipeline';
import { Pattern, PatternType, ExecutionContext } from './pattern-extraction';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface VerificationOutcome {
  taskId: string;
  agentId: string;
  agentType: string;
  timestamp: string;

  // Verification results
  passed: boolean;
  truthScore: number;
  threshold: number;

  // Component scores
  componentScores: ComponentScores;

  // Context
  fileType?: string;
  complexity?: number;
  linesChanged?: number;
  testsRun?: number;

  // Metadata
  duration: number;
  errorMessages?: string[];
  warnings?: string[];
}

export interface ComponentScores {
  compile?: number;
  tests?: number;
  lint?: number;
  typecheck?: number;
  security?: number;
  performance?: number;
  coverage?: number;
}

export interface TruthScorePrediction {
  taskId: string;
  predictedScore: number;
  confidence: number;
  factors: PredictionFactors;
  recommendedThreshold: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PredictionFactors {
  agentReliability: number;
  historicalPerformance: number;
  taskComplexity: number;
  contextSimilarity: number;
  recentTrend: number;
}

export interface AdaptiveThreshold {
  agentType: string;
  fileType?: string;
  baseThreshold: number;
  adjustedThreshold: number;
  confidenceInterval: [number, number];
  sampleSize: number;
  lastUpdated: string;
}

export interface VerificationPattern {
  id: string;
  type: 'success' | 'failure' | 'warning';
  name: string;
  description: string;

  // Pattern characteristics
  agentTypes: string[];
  fileTypes: string[];
  commonErrors: string[];
  componentWeights: ComponentScores;

  // Statistics
  occurrences: number;
  avgTruthScore: number;
  successRate: number;
  confidence: number;

  // Metadata
  createdAt: string;
  lastSeen: string;
}

export interface AgentReliability {
  agentId: string;
  agentType: string;

  // Overall metrics
  totalVerifications: number;
  successCount: number;
  failureCount: number;
  avgTruthScore: number;
  reliability: number; // 0-1

  // Trends
  recentTrend: 'improving' | 'stable' | 'declining';
  trendConfidence: number;

  // Context-specific
  performanceByFileType: Map<string, number>;
  performanceByComplexity: Map<string, number>;

  // Timestamps
  firstSeen: string;
  lastSeen: string;
  lastUpdated: string;
}

export interface VerificationLearningConfig {
  predictionEnabled: boolean;
  adaptiveThresholds: boolean;
  minSampleSize: number;
  confidenceThreshold: number;
  learningRate: number;
  decayFactor: number;
}

// ============================================================================
// Verification Learning System
// ============================================================================

export class VerificationLearningSystem {
  private learningPipeline: LearningPipeline;
  private predictor: TruthScorePredictor;
  private thresholdManager: AdaptiveThresholdManager;
  private patternLibrary: VerificationPatternLibrary;
  private reliabilityTracker: AgentReliabilityTracker;
  private eventEmitter: EventEmitter;

  constructor(
    private db: Database,
    private config: VerificationLearningConfig
  ) {
    this.learningPipeline = new LearningPipeline(db, {
      observationBufferSize: 100,
      observationFlushInterval: 60000, // 1 minute
      extractionBatchSize: 50,
      minPatternQuality: 0.7,
      minConfidenceThreshold: 0.6,
      consolidationSchedule: 'daily',
      autoLearning: true,
      maxPatternsPerType: 200
    });

    this.predictor = new TruthScorePredictor(db, config);
    this.thresholdManager = new AdaptiveThresholdManager(db, config);
    this.patternLibrary = new VerificationPatternLibrary(db);
    this.reliabilityTracker = new AgentReliabilityTracker(db, config);
    this.eventEmitter = new EventEmitter();

    this.initialize();
  }

  /**
   * Initialize the verification learning system
   */
  private async initialize() {
    console.log('Initializing verification learning system...');

    // Set up event listeners
    this.learningPipeline.on('pattern_stored', (pattern: Pattern) => {
      this.handleLearnedPattern(pattern);
    });

    console.log('Verification learning system initialized');
  }

  /**
   * Learn from verification outcome
   */
  async learnFromVerification(outcome: VerificationOutcome): Promise<void> {
    try {
      // 1. Update agent reliability
      await this.reliabilityTracker.update(outcome);

      // 2. Extract and store verification patterns
      const pattern = await this.patternLibrary.extractPattern(outcome);
      if (pattern) {
        await this.patternLibrary.store(pattern);
      }

      // 3. Update adaptive thresholds
      if (this.config.adaptiveThresholds) {
        await this.thresholdManager.updateThreshold(outcome);
      }

      // 4. Feed to neural learning pipeline
      const neuralOutcome: Outcome = {
        taskId: outcome.taskId,
        patternId: pattern?.id || 'no-pattern',
        status: outcome.passed ? 'success' : 'failure',
        confidence: outcome.truthScore,
        metrics: {
          durationMs: outcome.duration,
          errorCount: outcome.errorMessages?.length || 0,
          improvementVsBaseline: outcome.truthScore - outcome.threshold
        },
        judgeReasons: this.extractReasons(outcome),
        timestamp: outcome.timestamp
      };

      await this.learningPipeline.trackOutcome(neuralOutcome);

      // 5. Update predictor model
      await this.predictor.updateModel(outcome);

      // 6. Emit learning event
      this.eventEmitter.emit('verification_learned', {
        outcome,
        pattern,
        reliability: await this.reliabilityTracker.getReliability(outcome.agentId)
      });

      console.log(
        `Learned from verification: ${outcome.taskId} (${outcome.passed ? 'PASS' : 'FAIL'}, score: ${outcome.truthScore.toFixed(3)})`
      );
    } catch (error) {
      console.error('Failed to learn from verification:', error);
    }
  }

  /**
   * Predict truth score before verification
   */
  async predictTruthScore(
    taskId: string,
    agentId: string,
    agentType: string,
    context: Partial<VerificationOutcome>
  ): Promise<TruthScorePrediction> {
    if (!this.config.predictionEnabled) {
      return {
        taskId,
        predictedScore: 0.5,
        confidence: 0.0,
        factors: this.getDefaultFactors(),
        recommendedThreshold: 0.95,
        riskLevel: 'medium'
      };
    }

    try {
      return await this.predictor.predict(taskId, agentId, agentType, context);
    } catch (error) {
      console.error('Truth score prediction failed:', error);
      return {
        taskId,
        predictedScore: 0.5,
        confidence: 0.0,
        factors: this.getDefaultFactors(),
        recommendedThreshold: 0.95,
        riskLevel: 'high'
      };
    }
  }

  /**
   * Get adaptive threshold for agent and context
   */
  async getAdaptiveThreshold(
    agentType: string,
    context?: { fileType?: string }
  ): Promise<number> {
    if (!this.config.adaptiveThresholds) {
      return 0.95; // Default strict threshold
    }

    return await this.thresholdManager.getThreshold(agentType, context?.fileType);
  }

  /**
   * Get all adaptive thresholds
   */
  async getAllThresholds(): Promise<AdaptiveThreshold[]> {
    return await this.thresholdManager.getAllThresholds();
  }

  /**
   * Get agent reliability metrics
   */
  async getAgentReliability(agentId: string): Promise<AgentReliability | null> {
    return await this.reliabilityTracker.getReliability(agentId);
  }

  /**
   * Get all agent reliability metrics
   */
  async getAllAgentReliability(): Promise<AgentReliability[]> {
    return await this.reliabilityTracker.getAllReliability();
  }

  /**
   * Get verification patterns
   */
  async getVerificationPatterns(
    type?: 'success' | 'failure' | 'warning',
    limit: number = 50
  ): Promise<VerificationPattern[]> {
    return await this.patternLibrary.getPatterns(type, limit);
  }

  /**
   * Search for similar verification patterns
   */
  async findSimilarPatterns(
    context: Partial<VerificationOutcome>
  ): Promise<VerificationPattern[]> {
    return await this.patternLibrary.findSimilar(context);
  }

  /**
   * Get learning metrics
   */
  async getMetrics(): Promise<VerificationLearningMetrics> {
    const [
      patterns,
      agents,
      thresholds,
      predictions
    ] = await Promise.all([
      this.patternLibrary.getStats(),
      this.reliabilityTracker.getStats(),
      this.thresholdManager.getStats(),
      this.predictor.getStats()
    ]);

    return {
      patterns,
      agents,
      thresholds,
      predictions,
      learningEnabled: true,
      lastUpdated: new Date().toISOString()
    };
  }

  // Helper methods

  private extractReasons(outcome: VerificationOutcome): string[] {
    const reasons: string[] = [];

    if (!outcome.passed) {
      reasons.push(`Truth score ${outcome.truthScore.toFixed(3)} below threshold ${outcome.threshold.toFixed(3)}`);
    }

    if (outcome.componentScores.compile && outcome.componentScores.compile < 0.5) {
      reasons.push('Compilation issues detected');
    }

    if (outcome.componentScores.tests && outcome.componentScores.tests < 0.7) {
      reasons.push('Test failures detected');
    }

    if (outcome.errorMessages && outcome.errorMessages.length > 0) {
      reasons.push(`${outcome.errorMessages.length} error(s) found`);
    }

    return reasons;
  }

  private getDefaultFactors(): PredictionFactors {
    return {
      agentReliability: 0.5,
      historicalPerformance: 0.5,
      taskComplexity: 0.5,
      contextSimilarity: 0.0,
      recentTrend: 0.0
    };
  }

  private async handleLearnedPattern(pattern: Pattern) {
    // Convert generic pattern to verification-specific if applicable
    if (pattern.type === 'testing' || pattern.name.includes('verify')) {
      console.log(`Learned verification-related pattern: ${pattern.name}`);
    }
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  async shutdown() {
    await this.learningPipeline.shutdown();
  }
}

// ============================================================================
// Truth Score Predictor
// ============================================================================

class TruthScorePredictor {
  private predictionCache = new Map<string, TruthScorePrediction>();

  constructor(
    private db: Database,
    private config: VerificationLearningConfig
  ) {}

  async predict(
    taskId: string,
    agentId: string,
    agentType: string,
    context: Partial<VerificationOutcome>
  ): Promise<TruthScorePrediction> {
    // Check cache
    const cacheKey = `${agentId}:${agentType}:${context.fileType || 'any'}`;
    if (this.predictionCache.has(cacheKey)) {
      const cached = this.predictionCache.get(cacheKey)!;
      return { ...cached, taskId };
    }

    // Calculate prediction factors
    const factors: PredictionFactors = {
      agentReliability: await this.getAgentReliability(agentId),
      historicalPerformance: await this.getHistoricalPerformance(agentType, context),
      taskComplexity: this.estimateComplexity(context),
      contextSimilarity: await this.getContextSimilarity(context),
      recentTrend: await this.getRecentTrend(agentId)
    };

    // Weighted prediction
    const predictedScore =
      0.35 * factors.agentReliability +
      0.25 * factors.historicalPerformance +
      0.20 * (1 - factors.taskComplexity) + // Lower complexity = higher score
      0.15 * factors.contextSimilarity +
      0.05 * factors.recentTrend;

    // Calculate confidence
    const confidence = this.calculatePredictionConfidence(factors);

    // Determine risk level
    const riskLevel = this.determineRiskLevel(predictedScore, confidence);

    // Recommend threshold
    const recommendedThreshold = this.recommendThreshold(predictedScore, riskLevel);

    const prediction: TruthScorePrediction = {
      taskId,
      predictedScore,
      confidence,
      factors,
      recommendedThreshold,
      riskLevel
    };

    // Cache prediction
    this.predictionCache.set(cacheKey, prediction);

    return prediction;
  }

  async updateModel(outcome: VerificationOutcome): Promise<void> {
    // Clear cache for this agent/type combination
    const cacheKey = `${outcome.agentId}:${outcome.agentType}:${outcome.fileType || 'any'}`;
    this.predictionCache.delete(cacheKey);

    // Update prediction model (simplified - could use ML here)
    // In production, this would update a trained model
  }

  async getStats(): Promise<any> {
    return {
      cacheSize: this.predictionCache.size,
      predictionsEnabled: this.config.predictionEnabled
    };
  }

  // Helper methods

  private async getAgentReliability(agentId: string): Promise<number> {
    const { promisify } = require('util');
    const dbGet = promisify(this.db.get.bind(this.db)) as (sql: string, params?: any[]) => Promise<any>;
    const row = await dbGet(
      'SELECT reliability FROM agent_reliability WHERE agent_id = ?',
      [agentId]
    );
    return row?.reliability || 0.5;
  }

  private async getHistoricalPerformance(
    agentType: string,
    context: Partial<VerificationOutcome>
  ): Promise<number> {
    const { promisify } = require('util');
    const dbGet = promisify(this.db.get.bind(this.db)) as (sql: string, params?: any[]) => Promise<any>;
    let sql = 'SELECT AVG(truth_score) as avg_score FROM verification_outcomes WHERE agent_type = ?';
    const params: any[] = [agentType];

    if (context.fileType) {
      sql += ' AND file_type = ?';
      params.push(context.fileType);
    }

    const row = await dbGet(sql, params);
    return row?.avg_score || 0.5;
  }

  private estimateComplexity(context: Partial<VerificationOutcome>): number {
    let complexity = 0.3; // Base complexity

    if (context.linesChanged) {
      complexity += Math.min(0.3, context.linesChanged / 1000);
    }

    if (context.testsRun) {
      complexity += Math.min(0.2, context.testsRun / 100);
    }

    return Math.min(1.0, complexity);
  }

  private async getContextSimilarity(context: Partial<VerificationOutcome>): Promise<number> {
    // Find similar past contexts and average their scores
    // Simplified implementation
    return 0.5;
  }

  private async getRecentTrend(agentId: string): Promise<number> {
    const { promisify } = require('util');
    const dbAll = promisify(this.db.all.bind(this.db)) as (sql: string, params?: any[]) => Promise<any[]>;
    const rows = await dbAll(
      `SELECT truth_score FROM verification_outcomes
       WHERE agent_id = ?
       ORDER BY timestamp DESC
       LIMIT 10`,
      [agentId]
    );

    if (rows.length < 3) return 0.5;

    // Simple linear regression
    const scores = rows.map((r: any) => r.truth_score);
    const recent = scores.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const older = scores.slice(5).reduce((a, b) => a + b, 0) / (scores.length - 5);

    return recent > older ? 0.7 : recent < older ? 0.3 : 0.5;
  }

  private calculatePredictionConfidence(factors: PredictionFactors): number {
    // Higher confidence when factors are consistent and reliable
    const variance = this.calculateVariance(Object.values(factors));
    return Math.max(0, 1 - variance);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private determineRiskLevel(score: number, confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.95 && confidence >= 0.8) return 'low';
    if (score >= 0.85 && confidence >= 0.7) return 'medium';
    if (score >= 0.75) return 'high';
    return 'critical';
  }

  private recommendThreshold(score: number, risk: string): number {
    switch (risk) {
      case 'low': return 0.90;
      case 'medium': return 0.93;
      case 'high': return 0.95;
      case 'critical': return 0.97;
      default: return 0.95;
    }
  }
}

// ============================================================================
// Adaptive Threshold Manager
// ============================================================================

class AdaptiveThresholdManager {
  private thresholds = new Map<string, AdaptiveThreshold>();

  constructor(
    private db: Database,
    private config: VerificationLearningConfig
  ) {
    this.loadThresholds();
  }

  private async loadThresholds() {
    const { promisify } = require('util');
    const dbAll = promisify(this.db.all.bind(this.db)) as (sql: string, params?: any[]) => Promise<any[]>;
    const rows = await dbAll('SELECT * FROM adaptive_thresholds');
    for (const row of rows) {
      const key = this.getKey(row.agent_type, row.file_type);
      this.thresholds.set(key, this.rowToThreshold(row));
    }
  }

  async updateThreshold(outcome: VerificationOutcome): Promise<void> {
    const key = this.getKey(outcome.agentType, outcome.fileType);
    let threshold = this.thresholds.get(key) || this.createDefaultThreshold(outcome.agentType, outcome.fileType);

    // Update with new outcome
    threshold.sampleSize++;

    // Exponential moving average
    const alpha = this.config.learningRate;
    const targetScore = outcome.passed ? outcome.truthScore : outcome.threshold;
    threshold.adjustedThreshold = alpha * targetScore + (1 - alpha) * threshold.adjustedThreshold;

    // Update confidence interval (simplified)
    const margin = 0.05 * (1 - Math.min(1, threshold.sampleSize / 100));
    threshold.confidenceInterval = [
      Math.max(0, threshold.adjustedThreshold - margin),
      Math.min(1, threshold.adjustedThreshold + margin)
    ];

    threshold.lastUpdated = new Date().toISOString();

    // Store
    this.thresholds.set(key, threshold);
    await this.saveThreshold(threshold);
  }

  async getThreshold(agentType: string, fileType?: string): Promise<number> {
    const key = this.getKey(agentType, fileType);
    const threshold = this.thresholds.get(key);

    if (!threshold || threshold.sampleSize < this.config.minSampleSize) {
      return 0.95; // Default strict threshold
    }

    return threshold.adjustedThreshold;
  }

  async getAllThresholds(): Promise<AdaptiveThreshold[]> {
    return Array.from(this.thresholds.values());
  }

  async getStats(): Promise<any> {
    return {
      totalThresholds: this.thresholds.size,
      avgAdjustment: this.calculateAvgAdjustment()
    };
  }

  // Helper methods

  private getKey(agentType: string, fileType?: string): string {
    return `${agentType}:${fileType || 'any'}`;
  }

  private createDefaultThreshold(agentType: string, fileType?: string): AdaptiveThreshold {
    return {
      agentType,
      fileType,
      baseThreshold: 0.95,
      adjustedThreshold: 0.95,
      confidenceInterval: [0.90, 1.00],
      sampleSize: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  private async saveThreshold(threshold: AdaptiveThreshold): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO adaptive_thresholds
       (agent_type, file_type, base_threshold, adjusted_threshold, confidence_min, confidence_max, sample_size, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        threshold.agentType,
        threshold.fileType || null,
        threshold.baseThreshold,
        threshold.adjustedThreshold,
        threshold.confidenceInterval[0],
        threshold.confidenceInterval[1],
        threshold.sampleSize,
        threshold.lastUpdated
      ]
    );
  }

  private rowToThreshold(row: any): AdaptiveThreshold {
    return {
      agentType: row.agent_type,
      fileType: row.file_type,
      baseThreshold: row.base_threshold,
      adjustedThreshold: row.adjusted_threshold,
      confidenceInterval: [row.confidence_min, row.confidence_max],
      sampleSize: row.sample_size,
      lastUpdated: row.last_updated
    };
  }

  private calculateAvgAdjustment(): number {
    const adjustments = Array.from(this.thresholds.values())
      .map(t => Math.abs(t.adjustedThreshold - t.baseThreshold));

    if (adjustments.length === 0) return 0;
    return adjustments.reduce((a, b) => a + b, 0) / adjustments.length;
  }
}

// ============================================================================
// Verification Pattern Library
// ============================================================================

class VerificationPatternLibrary {
  private patterns = new Map<string, VerificationPattern>();

  constructor(private db: Database) {
    this.loadPatterns();
  }

  private async loadPatterns() {
    const { promisify } = require('util');
    const dbAll = promisify(this.db.all.bind(this.db)) as (sql: string, params?: any[]) => Promise<any[]>;
    const rows = await dbAll('SELECT * FROM verification_patterns');
    for (const row of rows) {
      this.patterns.set(row.id, this.rowToPattern(row));
    }
  }

  async extractPattern(outcome: VerificationOutcome): Promise<VerificationPattern | null> {
    // Extract pattern from outcome
    const patternType: 'success' | 'failure' | 'warning' = outcome.passed
      ? 'success'
      : outcome.truthScore > 0.7
      ? 'warning'
      : 'failure';

    const pattern: VerificationPattern = {
      id: this.generateId(),
      type: patternType,
      name: `${outcome.agentType}_${outcome.fileType || 'any'}_${patternType}`,
      description: this.generateDescription(outcome),
      agentTypes: [outcome.agentType],
      fileTypes: outcome.fileType ? [outcome.fileType] : [],
      commonErrors: outcome.errorMessages || [],
      componentWeights: outcome.componentScores,
      occurrences: 1,
      avgTruthScore: outcome.truthScore,
      successRate: outcome.passed ? 1.0 : 0.0,
      confidence: 0.5,
      createdAt: outcome.timestamp,
      lastSeen: outcome.timestamp
    };

    return pattern;
  }

  async store(pattern: VerificationPattern): Promise<void> {
    // Check if similar pattern exists
    const existing = this.findExistingPattern(pattern);

    if (existing) {
      // Merge with existing
      existing.occurrences++;
      existing.avgTruthScore = (existing.avgTruthScore * (existing.occurrences - 1) + pattern.avgTruthScore) / existing.occurrences;
      existing.successRate = (existing.successRate * (existing.occurrences - 1) + pattern.successRate) / existing.occurrences;
      existing.confidence = Math.min(0.95, existing.confidence + 0.05);
      existing.lastSeen = pattern.lastSeen;

      // Merge arrays
      existing.commonErrors = Array.from(new Set([...existing.commonErrors, ...pattern.commonErrors]));

      await this.savePattern(existing);
    } else {
      // Store as new
      this.patterns.set(pattern.id, pattern);
      await this.savePattern(pattern);
    }
  }

  async getPatterns(type?: 'success' | 'failure' | 'warning', limit: number = 50): Promise<VerificationPattern[]> {
    let patterns = Array.from(this.patterns.values());

    if (type) {
      patterns = patterns.filter(p => p.type === type);
    }

    return patterns
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  async findSimilar(context: Partial<VerificationOutcome>): Promise<VerificationPattern[]> {
    return Array.from(this.patterns.values()).filter(pattern => {
      if (context.agentType && !pattern.agentTypes.includes(context.agentType)) {
        return false;
      }

      if (context.fileType && pattern.fileTypes.length > 0 && !pattern.fileTypes.includes(context.fileType)) {
        return false;
      }

      return true;
    });
  }

  async getStats(): Promise<any> {
    const patterns = Array.from(this.patterns.values());
    return {
      total: patterns.length,
      success: patterns.filter(p => p.type === 'success').length,
      failure: patterns.filter(p => p.type === 'failure').length,
      warning: patterns.filter(p => p.type === 'warning').length
    };
  }

  // Helper methods

  private findExistingPattern(pattern: VerificationPattern): VerificationPattern | undefined {
    return Array.from(this.patterns.values()).find(p =>
      p.name === pattern.name && p.type === pattern.type
    );
  }

  private async savePattern(pattern: VerificationPattern): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO verification_patterns
       (id, type, name, description, agent_types, file_types, common_errors,
        component_weights, occurrences, avg_truth_score, success_rate, confidence,
        created_at, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pattern.id,
        pattern.type,
        pattern.name,
        pattern.description,
        JSON.stringify(pattern.agentTypes),
        JSON.stringify(pattern.fileTypes),
        JSON.stringify(pattern.commonErrors),
        JSON.stringify(pattern.componentWeights),
        pattern.occurrences,
        pattern.avgTruthScore,
        pattern.successRate,
        pattern.confidence,
        pattern.createdAt,
        pattern.lastSeen
      ]
    );
  }

  private rowToPattern(row: any): VerificationPattern {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      description: row.description,
      agentTypes: JSON.parse(row.agent_types),
      fileTypes: JSON.parse(row.file_types),
      commonErrors: JSON.parse(row.common_errors),
      componentWeights: JSON.parse(row.component_weights),
      occurrences: row.occurrences,
      avgTruthScore: row.avg_truth_score,
      successRate: row.success_rate,
      confidence: row.confidence,
      createdAt: row.created_at,
      lastSeen: row.last_seen
    };
  }

  private generateId(): string {
    return `vp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDescription(outcome: VerificationOutcome): string {
    return `${outcome.agentType} verification ${outcome.passed ? 'passed' : 'failed'} with score ${outcome.truthScore.toFixed(3)}`;
  }
}

// ============================================================================
// Agent Reliability Tracker
// ============================================================================

class AgentReliabilityTracker {
  private reliability = new Map<string, AgentReliability>();

  constructor(
    private db: Database,
    private config: VerificationLearningConfig
  ) {
    this.loadReliability();
  }

  private async loadReliability() {
    const { promisify } = require('util');
    const dbAll = promisify(this.db.all.bind(this.db)) as (sql: string, params?: any[]) => Promise<any[]>;
    const rows = await dbAll('SELECT * FROM agent_reliability');
    for (const row of rows) {
      this.reliability.set(row.agent_id, this.rowToReliability(row));
    }
  }

  async update(outcome: VerificationOutcome): Promise<void> {
    let reliability = this.reliability.get(outcome.agentId) || this.createDefaultReliability(outcome);

    // Update counters
    reliability.totalVerifications++;
    if (outcome.passed) {
      reliability.successCount++;
    } else {
      reliability.failureCount++;
    }

    // Update average truth score (exponential moving average)
    const alpha = this.config.learningRate;
    reliability.avgTruthScore = alpha * outcome.truthScore + (1 - alpha) * reliability.avgTruthScore;

    // Calculate reliability (0-1)
    reliability.reliability = reliability.successCount / reliability.totalVerifications;

    // Update trend
    reliability.recentTrend = await this.calculateTrend(outcome.agentId);
    reliability.trendConfidence = Math.min(1, reliability.totalVerifications / 100);

    // Update context-specific performance
    if (outcome.fileType) {
      reliability.performanceByFileType.set(outcome.fileType, outcome.truthScore);
    }

    reliability.lastSeen = outcome.timestamp;
    reliability.lastUpdated = new Date().toISOString();

    // Store
    this.reliability.set(outcome.agentId, reliability);
    await this.saveReliability(reliability);
  }

  async getReliability(agentId: string): Promise<AgentReliability | null> {
    return this.reliability.get(agentId) || null;
  }

  async getAllReliability(): Promise<AgentReliability[]> {
    return Array.from(this.reliability.values())
      .sort((a, b) => b.reliability - a.reliability);
  }

  async getStats(): Promise<any> {
    const agents = Array.from(this.reliability.values());
    return {
      totalAgents: agents.length,
      avgReliability: agents.reduce((sum, a) => sum + a.reliability, 0) / agents.length,
      topPerformers: agents.slice(0, 5).map(a => ({ id: a.agentId, reliability: a.reliability }))
    };
  }

  // Helper methods

  private createDefaultReliability(outcome: VerificationOutcome): AgentReliability {
    return {
      agentId: outcome.agentId,
      agentType: outcome.agentType,
      totalVerifications: 0,
      successCount: 0,
      failureCount: 0,
      avgTruthScore: 0.5,
      reliability: 0.5,
      recentTrend: 'stable',
      trendConfidence: 0.0,
      performanceByFileType: new Map(),
      performanceByComplexity: new Map(),
      firstSeen: outcome.timestamp,
      lastSeen: outcome.timestamp,
      lastUpdated: outcome.timestamp
    };
  }

  private async calculateTrend(agentId: string): Promise<'improving' | 'stable' | 'declining'> {
    const { promisify } = require('util');
    const dbAll = promisify(this.db.all.bind(this.db)) as (sql: string, params?: any[]) => Promise<any[]>;
    const rows = await dbAll(
      `SELECT truth_score FROM verification_outcomes
       WHERE agent_id = ?
       ORDER BY timestamp DESC
       LIMIT 20`,
      [agentId]
    );

    if (rows.length < 10) return 'stable';

    const recent = rows.slice(0, 10).reduce((sum: number, r: any) => sum + r.truth_score, 0) / 10;
    const older = rows.slice(10).reduce((sum: number, r: any) => sum + r.truth_score, 0) / (rows.length - 10);

    if (recent > older + 0.05) return 'improving';
    if (recent < older - 0.05) return 'declining';
    return 'stable';
  }

  private async saveReliability(reliability: AgentReliability): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO agent_reliability
       (agent_id, agent_type, total_verifications, success_count, failure_count,
        avg_truth_score, reliability, recent_trend, trend_confidence,
        performance_by_file_type, first_seen, last_seen, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reliability.agentId,
        reliability.agentType,
        reliability.totalVerifications,
        reliability.successCount,
        reliability.failureCount,
        reliability.avgTruthScore,
        reliability.reliability,
        reliability.recentTrend,
        reliability.trendConfidence,
        JSON.stringify(Array.from(reliability.performanceByFileType.entries())),
        reliability.firstSeen,
        reliability.lastSeen,
        reliability.lastUpdated
      ]
    );
  }

  private rowToReliability(row: any): AgentReliability {
    const performanceByFileType = new Map<string, number>(JSON.parse(row.performance_by_file_type || '[]'));

    return {
      agentId: row.agent_id,
      agentType: row.agent_type,
      totalVerifications: row.total_verifications,
      successCount: row.success_count,
      failureCount: row.failure_count,
      avgTruthScore: row.avg_truth_score,
      reliability: row.reliability,
      recentTrend: row.recent_trend,
      trendConfidence: row.trend_confidence,
      performanceByFileType,
      performanceByComplexity: new Map(),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      lastUpdated: row.last_updated
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface VerificationLearningMetrics {
  patterns: any;
  agents: any;
  thresholds: any;
  predictions: any;
  learningEnabled: boolean;
  lastUpdated: string;
}

// ============================================================================
// Exports
// ============================================================================

export default VerificationLearningSystem;
