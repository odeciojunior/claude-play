/**
 * SPARC Command Integration Hooks
 *
 * Integrates neural learning with SPARC commands to enable:
 * - Automatic pattern learning during SPARC execution
 * - Best practice suggestions at each phase
 * - TDD pattern recognition and application
 * - Methodology improvement tracking
 *
 * @module sparc-hooks
 */

import { SPARCNeuralEngine, SPARCOutcome, TDDCycle, SPARCPhase, SPARCLearningConfig } from './sparc-integration';
import { allPatternLibraries } from './sparc-pattern-libraries';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Hook System
// ============================================================================

export interface SPARCHookContext {
  phase: SPARCPhase;
  task_description: string;
  agent_name: string;
  working_directory: string;
  start_time: number;
  context: Record<string, any>;
}

export interface SPARCHookResult {
  success: boolean;
  duration: number;
  artifacts: string[];
  quality_metrics: {
    test_coverage?: number;
    complexity_score?: number;
    maintainability_score?: number;
  };
  feedback: string;
}

export class SPARCHookManager {
  private engine: SPARCNeuralEngine;
  private activePhases: Map<string, SPARCHookContext> = new Map();

  constructor(config: SPARCLearningConfig) {
    this.engine = new SPARCNeuralEngine(config);
    this.bootstrapPatternLibraries();
  }

  /**
   * Bootstrap the system with pre-built pattern libraries
   */
  private bootstrapPatternLibraries(): void {
    console.log('🧠 Bootstrapping SPARC pattern libraries...');

    let totalLoaded = 0;
    for (const [phase, patterns] of Object.entries(allPatternLibraries)) {
      for (const pattern of patterns) {
        try {
          this.engine.storePattern({ ...pattern, last_used: null });
          totalLoaded++;
        } catch (error) {
          console.warn(`Failed to load pattern for ${phase}:`, error);
        }
      }
    }

    console.log(`✅ Loaded ${totalLoaded} patterns across all SPARC phases`);
  }

  // ==========================================================================
  // Pre-Phase Hooks
  // ==========================================================================

  /**
   * Hook executed before starting a SPARC phase
   */
  async prePhaseHook(context: SPARCHookContext): Promise<void> {
    const hookId = `${context.phase}-${Date.now()}`;
    this.activePhases.set(hookId, context);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 Starting ${context.phase.toUpperCase()} phase`);
    console.log(`${'='.repeat(60)}\n`);

    // Get relevant patterns
    const patterns = this.engine.getPatternsForPhase(context.phase, { limit: 5 });

    if (patterns.length > 0) {
      console.log('📚 Learned patterns available:');
      patterns.forEach((pattern, i) => {
        const successRate = pattern.usage_count > 0 ? ((pattern.success_count / pattern.usage_count) * 100).toFixed(0) : '0';
        console.log(`  ${i + 1}. ${pattern.pattern_data.name}`);
        console.log(`     Success rate: ${successRate}%, Used: ${pattern.usage_count} times`);
        console.log(`     Confidence: ${(pattern.confidence * 100).toFixed(0)}%`);
      });
      console.log();
    }

    // Get suggestions based on context
    const suggestions = this.engine.getSuggestions(context.phase, context.context);

    if (suggestions.length > 0) {
      console.log('💡 Suggestions for this phase:');
      suggestions.slice(0, 3).forEach((suggestion, i) => {
        console.log(`  ${i + 1}. ${suggestion.pattern.pattern_data.name}`);
        console.log(`     ${suggestion.reason}`);
        console.log(`     Relevance: ${(suggestion.relevance_score * 100).toFixed(0)}%`);
      });
      console.log();
    }

    // Show best practices
    const bestPractices = this.engine.getBestPractices(context.phase);

    if (bestPractices.length > 0) {
      console.log('⭐ Best practices:');
      bestPractices.slice(0, 5).forEach((practice, i) => {
        console.log(`  ${i + 1}. ${practice.practice}`);
      });
      console.log();
    }

    // Show phase metrics
    const metrics = this.engine.getPhaseMetrics(context.phase);
    if (metrics.total_executions > 0) {
      console.log('📊 Phase history:');
      console.log(`  Executions: ${metrics.total_executions}`);
      console.log(`  Success rate: ${(metrics.success_rate * 100).toFixed(0)}%`);
      console.log(`  Avg duration: ${Math.round(metrics.avg_duration)}s`);
      console.log(`  Pattern usage: ${(metrics.pattern_usage_rate * 100).toFixed(0)}%`);
      console.log(`  Time saved: ${Math.round(metrics.time_saved_total / 60)} minutes total`);
      console.log();
    }

    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Hook executed after completing a SPARC phase
   */
  async postPhaseHook(context: SPARCHookContext, result: SPARCHookResult): Promise<void> {
    const duration = (Date.now() - context.start_time) / 1000;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✨ Completed ${context.phase.toUpperCase()} phase`);
    console.log(`${'='.repeat(60)}\n`);

    console.log(`⏱️  Duration: ${Math.round(duration)}s`);
    console.log(`📁 Artifacts: ${result.artifacts.length} files`);

    if (result.quality_metrics.test_coverage !== undefined) {
      console.log(`🧪 Test coverage: ${(result.quality_metrics.test_coverage * 100).toFixed(0)}%`);
    }

    // Record outcome
    const outcome: SPARCOutcome = {
      phase: context.phase,
      pattern_id: null, // Could be enhanced to track which pattern was used
      success: result.success,
      time_taken: duration,
      quality_score: this.calculateQualityScore(result),
      test_coverage: result.quality_metrics.test_coverage,
      complexity_score: result.quality_metrics.complexity_score,
      maintainability_score: result.quality_metrics.maintainability_score,
      feedback: result.feedback,
      artifacts: result.artifacts,
    };

    this.engine.recordOutcome(outcome);

    // Show improvement
    const metrics = this.engine.getPhaseMetrics(context.phase);
    const improvement = metrics.quality_trend.length > 1 ? outcome.quality_score - metrics.quality_trend[metrics.quality_trend.length - 2] : 0;

    if (improvement > 0) {
      console.log(`📈 Quality improvement: +${(improvement * 100).toFixed(1)}%`);
    }

    console.log(`\n${'='.repeat(60)}\n`);

    // Clean up
    this.activePhases.delete(`${context.phase}-${context.start_time}`);
  }

  // ==========================================================================
  // TDD Cycle Tracking
  // ==========================================================================

  /**
   * Track a complete TDD cycle (Red-Green-Refactor)
   */
  async trackTDDCycle(cycle: {
    test_file: string;
    implementation_file: string;
    red_duration: number;
    tests_written: number;
    green_duration: number;
    tests_passing: number;
    refactor_duration: number;
    improvements: string[];
  }): Promise<void> {
    const total_duration = cycle.red_duration + cycle.green_duration + cycle.refactor_duration;
    const success = cycle.tests_passing === cycle.tests_written;

    const tddCycle: Omit<TDDCycle, 'id' | 'created_at'> = {
      test_file: cycle.test_file,
      implementation_file: cycle.implementation_file,
      cycle_data: {
        red_phase: {
          duration: cycle.red_duration,
          tests_written: cycle.tests_written,
        },
        green_phase: {
          duration: cycle.green_duration,
          tests_passing: cycle.tests_passing,
        },
        refactor_phase: {
          duration: cycle.refactor_duration,
          improvements: cycle.improvements,
        },
      },
      total_duration,
      success,
    };

    this.engine.recordTDDCycle(tddCycle);

    console.log('\n🔄 TDD Cycle Complete:');
    console.log(`  🔴 Red: ${Math.round(cycle.red_duration)}s (${cycle.tests_written} tests)`);
    console.log(`  🟢 Green: ${Math.round(cycle.green_duration)}s (${cycle.tests_passing} passing)`);
    console.log(`  🔵 Refactor: ${Math.round(cycle.refactor_duration)}s (${cycle.improvements.length} improvements)`);
    console.log(`  ⏱️  Total: ${Math.round(total_duration)}s`);
    console.log(`  ${success ? '✅ Success' : '❌ Failed'}\n`);
  }

  /**
   * Get TDD patterns and recommendations
   */
  getTDDRecommendations(): {
    optimal_red_duration: number;
    optimal_green_duration: number;
    optimal_refactor_duration: number;
    common_improvements: string[];
    tips: string[];
  } {
    const patterns = this.engine.getTDDPatterns();

    const tips: string[] = [];

    if (patterns.avg_red_duration > patterns.avg_green_duration) {
      tips.push('⚡ Consider smaller test increments - red phase is taking longer than green');
    }

    if (patterns.avg_refactor_duration < patterns.avg_green_duration * 0.2) {
      tips.push('🔍 Consider more refactoring - spending less than 20% of time on cleanup');
    }

    if (patterns.success_rate < 0.9) {
      tips.push('🎯 Focus on simpler tests first - success rate below 90%');
    }

    return {
      optimal_red_duration: patterns.avg_red_duration,
      optimal_green_duration: patterns.avg_green_duration,
      optimal_refactor_duration: patterns.avg_refactor_duration,
      common_improvements: patterns.common_improvements,
      tips,
    };
  }

  // ==========================================================================
  // Improvement Tracking
  // ==========================================================================

  /**
   * Get comprehensive improvement report
   */
  getImprovementReport(): {
    phase_trends: Array<{
      phase: SPARCPhase;
      trend: 'improving' | 'stable' | 'declining';
      improvement_rate: number;
    }>;
    total_time_saved: number;
    pattern_adoption: number;
    quality_scores: Record<SPARCPhase, number>;
    recommendations: string[];
  } {
    const trends = this.engine.getImprovementTrends();
    const allMetrics = this.engine.getAllPhaseMetrics();

    const total_time_saved = allMetrics.reduce((sum, m) => sum + m.time_saved_total, 0);
    const pattern_adoption = allMetrics.reduce((sum, m) => sum + m.pattern_usage_rate, 0) / allMetrics.length;

    const quality_scores: Record<SPARCPhase, number> = {} as any;
    allMetrics.forEach((m) => {
      quality_scores[m.phase] = m.quality_trend.length > 0 ? m.quality_trend[m.quality_trend.length - 1] : 0;
    });

    const recommendations: string[] = [];

    trends.forEach(({ phase, trend, improvement_rate }) => {
      if (trend === 'declining') {
        recommendations.push(`⚠️  ${phase} phase quality declining (${(improvement_rate * 100).toFixed(1)}%)`);
      } else if (trend === 'improving') {
        recommendations.push(`✅ ${phase} phase improving (${(improvement_rate * 100).toFixed(1)}%)`);
      }
    });

    allMetrics.forEach((metrics) => {
      if (metrics.pattern_usage_rate < 0.5 && metrics.total_executions > 10) {
        recommendations.push(`📚 Consider using more patterns in ${metrics.phase} phase (${(metrics.pattern_usage_rate * 100).toFixed(0)}% usage)`);
      }
    });

    return {
      phase_trends: trends,
      total_time_saved: Math.round(total_time_saved / 60), // Convert to minutes
      pattern_adoption: pattern_adoption,
      quality_scores,
      recommendations,
    };
  }

  /**
   * Display improvement dashboard
   */
  displayImprovementDashboard(): void {
    const report = this.getImprovementReport();

    console.log('\n' + '='.repeat(60));
    console.log('📊 SPARC LEARNING DASHBOARD');
    console.log('='.repeat(60) + '\n');

    console.log('🎯 Overall Metrics:');
    console.log(`  Time saved: ${report.total_time_saved} minutes`);
    console.log(`  Pattern adoption: ${(report.pattern_adoption * 100).toFixed(0)}%`);
    console.log();

    console.log('📈 Phase Trends:');
    report.phase_trends.forEach(({ phase, trend, improvement_rate }) => {
      const icon = trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️';
      console.log(`  ${icon} ${phase}: ${trend} (${(improvement_rate * 100).toFixed(1)}%)`);
    });
    console.log();

    console.log('⭐ Quality Scores:');
    Object.entries(report.quality_scores).forEach(([phase, score]) => {
      const bar = '█'.repeat(Math.round(score * 20));
      console.log(`  ${phase.padEnd(15)}: ${bar} ${(score * 100).toFixed(0)}%`);
    });
    console.log();

    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.recommendations.forEach((rec) => {
        console.log(`  ${rec}`);
      });
      console.log();
    }

    console.log('='.repeat(60) + '\n');
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private calculateQualityScore(result: SPARCHookResult): number {
    let score = result.success ? 0.7 : 0.3;

    if (result.quality_metrics.test_coverage !== undefined) {
      score += result.quality_metrics.test_coverage * 0.15;
    }

    if (result.quality_metrics.maintainability_score !== undefined) {
      score += result.quality_metrics.maintainability_score * 0.1;
    }

    if (result.quality_metrics.complexity_score !== undefined) {
      // Lower complexity is better, so invert
      score += (1 - result.quality_metrics.complexity_score) * 0.05;
    }

    return Math.min(1.0, score);
  }

  getEngine(): SPARCNeuralEngine {
    return this.engine;
  }

  close(): void {
    this.engine.close();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let hookManager: SPARCHookManager | null = null;

export function initializeSPARCHooks(config?: Partial<SPARCLearningConfig>): SPARCHookManager {
  const defaultConfig = {
    db_path: '.swarm/memory.db',
    min_confidence_threshold: 0.6,
    min_usage_for_suggestion: 3,
    learning_rate: 0.1,
    confidence_decay_rate: 0.01,
    enable_auto_suggestions: true,
    enable_cross_phase_learning: true,
  };

  const finalConfig = { ...defaultConfig, ...config };
  hookManager = new SPARCHookManager(finalConfig);
  return hookManager;
}

export function getSPARCHooks(): SPARCHookManager {
  if (!hookManager) {
    throw new Error('SPARC hooks not initialized. Call initializeSPARCHooks() first.');
  }
  return hookManager;
}

// ============================================================================
// CLI Integration Helpers
// ============================================================================

export async function handleSPARCCommand(
  command: 'tdd' | 'pipeline' | 'phase',
  args: {
    phase?: SPARCPhase;
    task?: string;
    agent?: string;
  }
): Promise<void> {
  const hooks = getSPARCHooks();

  switch (command) {
    case 'tdd':
      const tddRecs = hooks.getTDDRecommendations();
      console.log('\n🧪 TDD Pattern Recommendations:\n');
      console.log(`Optimal cycle times:`);
      console.log(`  🔴 Red: ${Math.round(tddRecs.optimal_red_duration)}s`);
      console.log(`  🟢 Green: ${Math.round(tddRecs.optimal_green_duration)}s`);
      console.log(`  🔵 Refactor: ${Math.round(tddRecs.optimal_refactor_duration)}s`);
      console.log();

      if (tddRecs.common_improvements.length > 0) {
        console.log('Common refactoring improvements:');
        tddRecs.common_improvements.forEach((imp, i) => {
          console.log(`  ${i + 1}. ${imp}`);
        });
        console.log();
      }

      if (tddRecs.tips.length > 0) {
        console.log('Tips:');
        tddRecs.tips.forEach((tip) => {
          console.log(`  ${tip}`);
        });
        console.log();
      }
      break;

    case 'pipeline':
      hooks.displayImprovementDashboard();
      break;

    case 'phase':
      if (args.phase) {
        const context: SPARCHookContext = {
          phase: args.phase,
          task_description: args.task || '',
          agent_name: args.agent || 'unknown',
          working_directory: process.cwd(),
          start_time: Date.now(),
          context: {},
        };
        await hooks.prePhaseHook(context);
      }
      break;
  }
}
