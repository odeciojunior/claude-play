/**
 * SPARC-Neural Integration System
 *
 * Enables SPARC phases to learn and apply best practices automatically
 * through neural pattern recognition and continuous feedback loops.
 *
 * Features:
 * - Phase-specific pattern learning (S, P, A, R, C)
 * - TDD cycle pattern recognition
 * - Methodology improvement tracking
 * - Automatic best practice suggestions
 * - Cross-phase pattern sharing
 *
 * @module sparc-integration
 */

import { Database } from 'better-sqlite3';
import * as crypto from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

export type SPARCPhase = 'specification' | 'pseudocode' | 'architecture' | 'refinement' | 'completion';

export type PatternCategory =
  | 'requirement_template'
  | 'acceptance_criteria'
  | 'algorithm_design'
  | 'complexity_analysis'
  | 'system_design'
  | 'component_pattern'
  | 'tdd_cycle'
  | 'test_structure'
  | 'refactoring_strategy'
  | 'validation_checklist'
  | 'deployment_pattern';

export interface SPARCPattern {
  id: string;
  phase: SPARCPhase;
  category: PatternCategory;
  pattern_data: {
    name: string;
    description: string;
    context: Record<string, any>;
    template: string;
    examples: string[];
    success_indicators: string[];
    antipatterns: string[];
  };
  confidence: number;
  usage_count: number;
  success_count: number;
  avg_time_saved: number; // seconds
  avg_quality_improvement: number; // 0-1
  created_at: string;
  last_used: string | null;
  metadata: Record<string, any>;
}

export interface SPARCOutcome {
  phase: SPARCPhase;
  pattern_id: string | null;
  success: boolean;
  time_taken: number; // seconds
  quality_score: number; // 0-1
  test_coverage?: number;
  complexity_score?: number;
  maintainability_score?: number;
  feedback: string;
  artifacts: string[];
}

export interface TDDCycle {
  id: string;
  test_file: string;
  implementation_file: string;
  cycle_data: {
    red_phase: { duration: number; tests_written: number };
    green_phase: { duration: number; tests_passing: number };
    refactor_phase: { duration: number; improvements: string[] };
  };
  total_duration: number;
  success: boolean;
  created_at: string;
}

export interface PhaseMetrics {
  phase: SPARCPhase;
  total_executions: number;
  avg_duration: number;
  success_rate: number;
  pattern_usage_rate: number;
  quality_trend: number[]; // Last 10 scores
  time_saved_total: number;
}

export interface SPARCLearningConfig {
  db_path: string;
  min_confidence_threshold: number;
  min_usage_for_suggestion: number;
  learning_rate: number;
  confidence_decay_rate: number; // Per day
  enable_auto_suggestions: boolean;
  enable_cross_phase_learning: boolean;
}

// ============================================================================
// SPARC Neural Integration Engine
// ============================================================================

export class SPARCNeuralEngine {
  private db: Database;
  private config: SPARCLearningConfig;

  constructor(config: SPARCLearningConfig) {
    this.config = config;
    this.db = new (require('better-sqlite3'))(config.db_path);
    this.initializeDatabase();
  }

  // ==========================================================================
  // Database Initialization
  // ==========================================================================

  private initializeDatabase(): void {
    // SPARC patterns table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sparc_patterns (
        id TEXT PRIMARY KEY,
        phase TEXT NOT NULL,
        category TEXT NOT NULL,
        pattern_data TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        usage_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        avg_time_saved REAL NOT NULL DEFAULT 0.0,
        avg_quality_improvement REAL NOT NULL DEFAULT 0.0,
        created_at TEXT NOT NULL,
        last_used TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        UNIQUE(phase, category, pattern_data)
      );

      CREATE INDEX IF NOT EXISTS idx_sparc_phase ON sparc_patterns(phase);
      CREATE INDEX IF NOT EXISTS idx_sparc_category ON sparc_patterns(category);
      CREATE INDEX IF NOT EXISTS idx_sparc_confidence ON sparc_patterns(confidence DESC);
    `);

    // SPARC outcomes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sparc_outcomes (
        id TEXT PRIMARY KEY,
        phase TEXT NOT NULL,
        pattern_id TEXT,
        success INTEGER NOT NULL,
        time_taken REAL NOT NULL,
        quality_score REAL NOT NULL,
        test_coverage REAL,
        complexity_score REAL,
        maintainability_score REAL,
        feedback TEXT NOT NULL,
        artifacts TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(pattern_id) REFERENCES sparc_patterns(id)
      );

      CREATE INDEX IF NOT EXISTS idx_outcomes_phase ON sparc_outcomes(phase);
      CREATE INDEX IF NOT EXISTS idx_outcomes_created ON sparc_outcomes(created_at DESC);
    `);

    // TDD cycles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tdd_cycles (
        id TEXT PRIMARY KEY,
        test_file TEXT NOT NULL,
        implementation_file TEXT NOT NULL,
        cycle_data TEXT NOT NULL,
        total_duration REAL NOT NULL,
        success INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tdd_created ON tdd_cycles(created_at DESC);
    `);

    // Phase metrics table (aggregated)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phase_metrics (
        phase TEXT PRIMARY KEY,
        total_executions INTEGER NOT NULL DEFAULT 0,
        avg_duration REAL NOT NULL DEFAULT 0.0,
        success_rate REAL NOT NULL DEFAULT 0.0,
        pattern_usage_rate REAL NOT NULL DEFAULT 0.0,
        quality_trend TEXT NOT NULL DEFAULT '[]',
        time_saved_total REAL NOT NULL DEFAULT 0.0,
        updated_at TEXT NOT NULL
      );
    `);
  }

  // ==========================================================================
  // Pattern Storage and Retrieval
  // ==========================================================================

  /**
   * Store a new SPARC pattern or update existing
   */
  storePattern(pattern: Omit<SPARCPattern, 'id' | 'created_at'>): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sparc_patterns (
        id, phase, category, pattern_data, confidence, usage_count,
        success_count, avg_time_saved, avg_quality_improvement,
        created_at, last_used, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phase, category, pattern_data) DO UPDATE SET
        confidence = excluded.confidence,
        usage_count = usage_count + 1,
        last_used = excluded.last_used
    `);

    stmt.run(
      id,
      pattern.phase,
      pattern.category,
      JSON.stringify(pattern.pattern_data),
      pattern.confidence,
      pattern.usage_count,
      pattern.success_count,
      pattern.avg_time_saved,
      pattern.avg_quality_improvement,
      now,
      null,
      JSON.stringify(pattern.metadata)
    );

    return id;
  }

  /**
   * Retrieve patterns for a specific phase
   */
  getPatternsForPhase(
    phase: SPARCPhase,
    options: {
      category?: PatternCategory;
      min_confidence?: number;
      limit?: number;
    } = {}
  ): SPARCPattern[] {
    const { category, min_confidence = this.config.min_confidence_threshold, limit = 20 } = options;

    let query = `
      SELECT * FROM sparc_patterns
      WHERE phase = ? AND confidence >= ?
    `;
    const params: any[] = [phase, min_confidence];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY confidence DESC, usage_count DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(this.rowToPattern);
  }

  /**
   * Get top patterns across all phases
   */
  getTopPatterns(limit: number = 50): SPARCPattern[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sparc_patterns
      ORDER BY
        (confidence * 0.4 + (success_count::float / NULLIF(usage_count, 0)) * 0.3 +
         avg_quality_improvement * 0.3) DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(this.rowToPattern);
  }

  /**
   * Get similar patterns using context matching
   */
  getSimilarPatterns(context: Record<string, any>, phase: SPARCPhase, limit: number = 10): SPARCPattern[] {
    const patterns = this.getPatternsForPhase(phase, { limit: 100 });

    // Simple similarity scoring based on context overlap
    const scored = patterns.map((pattern) => {
      const patternContext = pattern.pattern_data.context;
      let similarity = 0;
      let totalKeys = 0;

      for (const key in context) {
        totalKeys++;
        if (patternContext[key] !== undefined) {
          if (patternContext[key] === context[key]) {
            similarity += 1;
          } else if (typeof context[key] === 'string' && typeof patternContext[key] === 'string') {
            // Fuzzy string match
            const match = this.fuzzyMatch(context[key], patternContext[key]);
            similarity += match;
          }
        }
      }

      const score = totalKeys > 0 ? similarity / totalKeys : 0;
      return { pattern, score };
    });

    return scored
      .filter((item) => item.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.pattern);
  }

  // ==========================================================================
  // Learning from Outcomes
  // ==========================================================================

  /**
   * Record outcome of a SPARC phase execution
   */
  recordOutcome(outcome: SPARCOutcome): void {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Store outcome
    const stmtOutcome = this.db.prepare(`
      INSERT INTO sparc_outcomes (
        id, phase, pattern_id, success, time_taken, quality_score,
        test_coverage, complexity_score, maintainability_score,
        feedback, artifacts, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmtOutcome.run(
      id,
      outcome.phase,
      outcome.pattern_id,
      outcome.success ? 1 : 0,
      outcome.time_taken,
      outcome.quality_score,
      outcome.test_coverage ?? null,
      outcome.complexity_score ?? null,
      outcome.maintainability_score ?? null,
      outcome.feedback,
      JSON.stringify(outcome.artifacts),
      now
    );

    // Update pattern if one was used
    if (outcome.pattern_id) {
      this.updatePatternFromOutcome(outcome);
    }

    // Update phase metrics
    this.updatePhaseMetrics(outcome);

    // Learn new pattern if outcome was exceptional
    if (outcome.success && outcome.quality_score >= 0.9 && !outcome.pattern_id) {
      this.learnNewPattern(outcome);
    }
  }

  /**
   * Update pattern confidence and metrics based on outcome
   */
  private updatePatternFromOutcome(outcome: SPARCOutcome): void {
    const pattern = this.getPatternById(outcome.pattern_id!);
    if (!pattern) return;

    const success_rate = (pattern.success_count + (outcome.success ? 1 : 0)) / (pattern.usage_count + 1);

    // Bayesian confidence update
    const prior_confidence = pattern.confidence;
    const evidence_weight = Math.min(pattern.usage_count / 100, 0.7); // Cap at 70%
    const new_confidence = prior_confidence * evidence_weight + success_rate * (1 - evidence_weight);

    // Update time saved and quality improvement
    const time_saved_delta = outcome.time_taken < pattern.avg_time_saved ? pattern.avg_time_saved - outcome.time_taken : 0;
    const new_avg_time_saved =
      (pattern.avg_time_saved * pattern.usage_count + time_saved_delta) / (pattern.usage_count + 1);

    const new_avg_quality = (pattern.avg_quality_improvement * pattern.usage_count + outcome.quality_score) / (pattern.usage_count + 1);

    const stmt = this.db.prepare(`
      UPDATE sparc_patterns
      SET confidence = ?,
          usage_count = usage_count + 1,
          success_count = success_count + ?,
          avg_time_saved = ?,
          avg_quality_improvement = ?,
          last_used = ?
      WHERE id = ?
    `);

    stmt.run(new_confidence, outcome.success ? 1 : 0, new_avg_time_saved, new_avg_quality, new Date().toISOString(), outcome.pattern_id);
  }

  /**
   * Learn a new pattern from exceptional outcome
   */
  private learnNewPattern(outcome: SPARCOutcome): void {
    // Extract pattern from successful outcome
    const category = this.inferCategory(outcome);

    const pattern: Omit<SPARCPattern, 'id' | 'created_at'> = {
      phase: outcome.phase,
      category,
      pattern_data: {
        name: `Auto-learned pattern from ${new Date().toISOString()}`,
        description: outcome.feedback,
        context: this.extractContext(outcome),
        template: '',
        examples: outcome.artifacts,
        success_indicators: [`Quality score: ${outcome.quality_score}`],
        antipatterns: [],
      },
      confidence: 0.6, // Start with moderate confidence
      usage_count: 1,
      success_count: 1,
      avg_time_saved: 0,
      avg_quality_improvement: outcome.quality_score,
      last_used: null,
      metadata: { auto_learned: true, source_outcome: outcome },
    };

    this.storePattern(pattern);
  }

  // ==========================================================================
  // TDD Cycle Tracking
  // ==========================================================================

  /**
   * Record a complete TDD cycle
   */
  recordTDDCycle(cycle: Omit<TDDCycle, 'id' | 'created_at'>): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO tdd_cycles (
        id, test_file, implementation_file, cycle_data,
        total_duration, success, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      cycle.test_file,
      cycle.implementation_file,
      JSON.stringify(cycle.cycle_data),
      cycle.total_duration,
      cycle.success ? 1 : 0,
      now
    );

    return id;
  }

  /**
   * Get TDD patterns and statistics
   */
  getTDDPatterns(): {
    avg_red_duration: number;
    avg_green_duration: number;
    avg_refactor_duration: number;
    success_rate: number;
    common_improvements: string[];
  } {
    const stmt = this.db.prepare(`
      SELECT cycle_data, success FROM tdd_cycles
      ORDER BY created_at DESC LIMIT 100
    `);

    const cycles = stmt.all() as any[];
    if (cycles.length === 0) {
      return {
        avg_red_duration: 0,
        avg_green_duration: 0,
        avg_refactor_duration: 0,
        success_rate: 0,
        common_improvements: [],
      };
    }

    let total_red = 0,
      total_green = 0,
      total_refactor = 0,
      successes = 0;
    const improvements: Record<string, number> = {};

    cycles.forEach((cycle) => {
      const data = JSON.parse(cycle.cycle_data);
      total_red += data.red_phase.duration;
      total_green += data.green_phase.duration;
      total_refactor += data.refactor_phase.duration;
      if (cycle.success) successes++;

      data.refactor_phase.improvements.forEach((imp: string) => {
        improvements[imp] = (improvements[imp] || 0) + 1;
      });
    });

    const common_improvements = Object.entries(improvements)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([imp]) => imp);

    return {
      avg_red_duration: total_red / cycles.length,
      avg_green_duration: total_green / cycles.length,
      avg_refactor_duration: total_refactor / cycles.length,
      success_rate: successes / cycles.length,
      common_improvements,
    };
  }

  // ==========================================================================
  // Phase Metrics and Analysis
  // ==========================================================================

  /**
   * Update aggregated phase metrics
   */
  private updatePhaseMetrics(outcome: SPARCOutcome): void {
    const current = this.getPhaseMetrics(outcome.phase);

    const new_total = current.total_executions + 1;
    const new_avg_duration = (current.avg_duration * current.total_executions + outcome.time_taken) / new_total;
    const new_success_rate = (current.success_rate * current.total_executions + (outcome.success ? 1 : 0)) / new_total;
    const pattern_used = outcome.pattern_id ? 1 : 0;
    const new_pattern_usage = (current.pattern_usage_rate * current.total_executions + pattern_used) / new_total;

    // Update quality trend (keep last 10)
    const quality_trend = [...current.quality_trend, outcome.quality_score].slice(-10);

    const stmt = this.db.prepare(`
      INSERT INTO phase_metrics (
        phase, total_executions, avg_duration, success_rate,
        pattern_usage_rate, quality_trend, time_saved_total, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phase) DO UPDATE SET
        total_executions = excluded.total_executions,
        avg_duration = excluded.avg_duration,
        success_rate = excluded.success_rate,
        pattern_usage_rate = excluded.pattern_usage_rate,
        quality_trend = excluded.quality_trend,
        time_saved_total = time_saved_total + ?,
        updated_at = excluded.updated_at
    `);

    const time_saved = outcome.pattern_id ? Math.max(0, new_avg_duration - outcome.time_taken) : 0;

    stmt.run(
      outcome.phase,
      new_total,
      new_avg_duration,
      new_success_rate,
      new_pattern_usage,
      JSON.stringify(quality_trend),
      time_saved,
      new Date().toISOString(),
      time_saved
    );
  }

  /**
   * Get metrics for a specific phase
   */
  getPhaseMetrics(phase: SPARCPhase): PhaseMetrics {
    const stmt = this.db.prepare(`SELECT * FROM phase_metrics WHERE phase = ?`);
    const row = stmt.get(phase) as any;

    if (!row) {
      return {
        phase,
        total_executions: 0,
        avg_duration: 0,
        success_rate: 0,
        pattern_usage_rate: 0,
        quality_trend: [],
        time_saved_total: 0,
      };
    }

    return {
      phase,
      total_executions: row.total_executions,
      avg_duration: row.avg_duration,
      success_rate: row.success_rate,
      pattern_usage_rate: row.pattern_usage_rate,
      quality_trend: JSON.parse(row.quality_trend),
      time_saved_total: row.time_saved_total,
    };
  }

  /**
   * Get all phase metrics
   */
  getAllPhaseMetrics(): PhaseMetrics[] {
    const phases: SPARCPhase[] = ['specification', 'pseudocode', 'architecture', 'refinement', 'completion'];
    return phases.map((phase) => this.getPhaseMetrics(phase));
  }

  /**
   * Get improvement trends
   */
  getImprovementTrends(): {
    phase: SPARCPhase;
    trend: 'improving' | 'stable' | 'declining';
    improvement_rate: number;
  }[] {
    return this.getAllPhaseMetrics().map((metrics) => {
      if (metrics.quality_trend.length < 5) {
        return { phase: metrics.phase, trend: 'stable' as const, improvement_rate: 0 };
      }

      const recent = metrics.quality_trend.slice(-5);
      const older = metrics.quality_trend.slice(-10, -5);

      const avg_recent = recent.reduce((a, b) => a + b, 0) / recent.length;
      const avg_older = older.reduce((a, b) => a + b, 0) / older.length;

      const improvement_rate = (avg_recent - avg_older) / avg_older;

      let trend: 'improving' | 'stable' | 'declining';
      if (improvement_rate > 0.05) trend = 'improving';
      else if (improvement_rate < -0.05) trend = 'declining';
      else trend = 'stable';

      return { phase: metrics.phase, trend, improvement_rate };
    });
  }

  // ==========================================================================
  // Suggestions and Recommendations
  // ==========================================================================

  /**
   * Get pattern suggestions for a phase with context
   */
  getSuggestions(
    phase: SPARCPhase,
    context: Record<string, any>
  ): {
    pattern: SPARCPattern;
    relevance_score: number;
    reason: string;
  }[] {
    if (!this.config.enable_auto_suggestions) return [];

    const similar_patterns = this.getSimilarPatterns(context, phase, 10);

    return similar_patterns
      .filter((p) => p.usage_count >= this.config.min_usage_for_suggestion)
      .map((pattern) => {
        const success_rate = pattern.usage_count > 0 ? pattern.success_count / pattern.usage_count : 0;
        const relevance_score = pattern.confidence * 0.5 + success_rate * 0.3 + pattern.avg_quality_improvement * 0.2;

        let reason = `Used ${pattern.usage_count} times with ${(success_rate * 100).toFixed(0)}% success rate.`;
        if (pattern.avg_time_saved > 0) {
          reason += ` Saves avg ${Math.round(pattern.avg_time_saved)}s.`;
        }
        if (pattern.avg_quality_improvement > 0) {
          reason += ` Quality improvement: ${(pattern.avg_quality_improvement * 100).toFixed(0)}%.`;
        }

        return { pattern, relevance_score, reason };
      })
      .sort((a, b) => b.relevance_score - a.relevance_score);
  }

  /**
   * Get best practices for a phase
   */
  getBestPractices(phase: SPARCPhase): {
    practice: string;
    confidence: number;
    evidence_count: number;
  }[] {
    const patterns = this.getPatternsForPhase(phase, { limit: 100 });

    const practices = new Map<
      string,
      {
        confidence: number;
        count: number;
      }
    >();

    patterns.forEach((pattern) => {
      pattern.pattern_data.success_indicators.forEach((indicator) => {
        const current = practices.get(indicator) || { confidence: 0, count: 0 };
        practices.set(indicator, {
          confidence: Math.max(current.confidence, pattern.confidence),
          count: current.count + 1,
        });
      });
    });

    return Array.from(practices.entries())
      .map(([practice, data]) => ({
        practice,
        confidence: data.confidence,
        evidence_count: data.count,
      }))
      .sort((a, b) => b.confidence - a.confidence || b.evidence_count - a.evidence_count)
      .slice(0, 20);
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private getPatternById(id: string): SPARCPattern | null {
    const stmt = this.db.prepare(`SELECT * FROM sparc_patterns WHERE id = ?`);
    const row = stmt.get(id) as any;
    return row ? this.rowToPattern(row) : null;
  }

  private rowToPattern(row: any): SPARCPattern {
    return {
      id: row.id,
      phase: row.phase,
      category: row.category,
      pattern_data: JSON.parse(row.pattern_data),
      confidence: row.confidence,
      usage_count: row.usage_count,
      success_count: row.success_count,
      avg_time_saved: row.avg_time_saved,
      avg_quality_improvement: row.avg_quality_improvement,
      created_at: row.created_at,
      last_used: row.last_used,
      metadata: JSON.parse(row.metadata),
    };
  }

  private fuzzyMatch(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private inferCategory(outcome: SPARCOutcome): PatternCategory {
    const phase = outcome.phase;
    const categories: Record<SPARCPhase, PatternCategory[]> = {
      specification: ['requirement_template', 'acceptance_criteria'],
      pseudocode: ['algorithm_design', 'complexity_analysis'],
      architecture: ['system_design', 'component_pattern'],
      refinement: ['tdd_cycle', 'test_structure', 'refactoring_strategy'],
      completion: ['validation_checklist', 'deployment_pattern'],
    };

    return categories[phase][0];
  }

  private extractContext(outcome: SPARCOutcome): Record<string, any> {
    return {
      phase: outcome.phase,
      quality_score: outcome.quality_score,
      time_taken: outcome.time_taken,
      test_coverage: outcome.test_coverage,
    };
  }

  close(): void {
    this.db.close();
  }
}

// ============================================================================
// Export Default Configuration
// ============================================================================

export const defaultSPARCLearningConfig: SPARCLearningConfig = {
  db_path: '.swarm/memory.db',
  min_confidence_threshold: 0.6,
  min_usage_for_suggestion: 3,
  learning_rate: 0.1,
  confidence_decay_rate: 0.01, // 1% per day
  enable_auto_suggestions: true,
  enable_cross_phase_learning: true,
};
