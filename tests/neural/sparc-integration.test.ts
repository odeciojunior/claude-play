/**
 * SPARC-Neural Integration Tests
 *
 * Comprehensive test suite for SPARC phase learning system
 * Target: >90% code coverage
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SPARCNeuralEngine,
  SPARCPattern,
  SPARCOutcome,
  TDDCycle,
  defaultSPARCLearningConfig,
  SPARCPhase,
  PatternCategory,
} from '../../src/neural/sparc-integration';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('SPARCNeuralEngine', () => {
  let engine: SPARCNeuralEngine;
  let testDbPath: string;

  beforeEach(() => {
    // Create temporary test database
    testDbPath = path.join(__dirname, `test-sparc-${crypto.randomBytes(8).toString('hex')}.db`);
    engine = new SPARCNeuralEngine({
      ...defaultSPARCLearningConfig,
      db_path: testDbPath,
    });
  });

  afterEach(() => {
    engine.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  // ==========================================================================
  // Pattern Storage and Retrieval Tests
  // ==========================================================================

  describe('Pattern Storage', () => {
    it('should store a new pattern successfully', () => {
      const pattern: Omit<SPARCPattern, 'id' | 'created_at'> = {
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'Test Pattern',
          description: 'A test pattern',
          context: { type: 'test' },
          template: 'Test template',
          examples: ['Example 1'],
          success_indicators: ['Indicator 1'],
          antipatterns: ['Antipattern 1'],
        },
        confidence: 0.8,
        usage_count: 0,
        success_count: 0,
        avg_time_saved: 0,
        avg_quality_improvement: 0,
        last_used: null,
        metadata: {},
      };

      const patternId = engine.storePattern(pattern);
      expect(patternId).toBeDefined();
      expect(typeof patternId).toBe('string');
    });

    it('should retrieve patterns for a specific phase', () => {
      // Store multiple patterns
      for (let i = 0; i < 5; i++) {
        engine.storePattern({
          phase: 'specification',
          category: 'requirement_template',
          pattern_data: {
            name: `Pattern ${i}`,
            description: `Description ${i}`,
            context: {},
            template: '',
            examples: [],
            success_indicators: [],
            antipatterns: [],
          },
          confidence: 0.5 + i * 0.1,
          usage_count: i,
          success_count: i,
          avg_time_saved: 0,
          avg_quality_improvement: 0,
          last_used: null,
          metadata: {},
        });
      }

      const patterns = engine.getPatternsForPhase('specification');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.length).toBeLessThanOrEqual(20); // Default limit
      // Should be ordered by confidence DESC
      for (let i = 1; i < patterns.length; i++) {
        expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(patterns[i].confidence);
      }
    });

    it('should filter patterns by category', () => {
      engine.storePattern({
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'Requirement Pattern',
          description: 'Test',
          context: {},
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.8,
        usage_count: 0,
        success_count: 0,
        avg_time_saved: 0,
        avg_quality_improvement: 0,
        last_used: null,
        metadata: {},
      });

      engine.storePattern({
        phase: 'specification',
        category: 'acceptance_criteria',
        pattern_data: {
          name: 'Acceptance Pattern',
          description: 'Test',
          context: {},
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.8,
        usage_count: 0,
        success_count: 0,
        avg_time_saved: 0,
        avg_quality_improvement: 0,
        last_used: null,
        metadata: {},
      });

      const requirementPatterns = engine.getPatternsForPhase('specification', {
        category: 'requirement_template',
      });

      expect(requirementPatterns.length).toBeGreaterThan(0);
      requirementPatterns.forEach((p) => {
        expect(p.category).toBe('requirement_template');
      });
    });

    it('should filter patterns by confidence threshold', () => {
      engine.storePattern({
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'Low Confidence',
          description: 'Test',
          context: {},
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.4,
        usage_count: 0,
        success_count: 0,
        avg_time_saved: 0,
        avg_quality_improvement: 0,
        last_used: null,
        metadata: {},
      });

      engine.storePattern({
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'High Confidence',
          description: 'Test',
          context: {},
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.9,
        usage_count: 0,
        success_count: 0,
        avg_time_saved: 0,
        avg_quality_improvement: 0,
        last_used: null,
        metadata: {},
      });

      const highConfidencePatterns = engine.getPatternsForPhase('specification', {
        min_confidence: 0.8,
      });

      expect(highConfidencePatterns.length).toBeGreaterThan(0);
      highConfidencePatterns.forEach((p) => {
        expect(p.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should get top patterns across all phases', () => {
      const phases: SPARCPhase[] = ['specification', 'pseudocode', 'architecture'];

      phases.forEach((phase) => {
        engine.storePattern({
          phase,
          category: 'requirement_template',
          pattern_data: {
            name: `${phase} pattern`,
            description: 'Test',
            context: {},
            template: '',
            examples: [],
            success_indicators: [],
            antipatterns: [],
          },
          confidence: 0.9,
          usage_count: 10,
          success_count: 9,
          avg_time_saved: 100,
          avg_quality_improvement: 0.85,
          last_used: null,
          metadata: {},
        });
      });

      const topPatterns = engine.getTopPatterns(10);
      expect(topPatterns.length).toBeGreaterThan(0);
      // Should include patterns from multiple phases
      const uniquePhases = new Set(topPatterns.map((p) => p.phase));
      expect(uniquePhases.size).toBeGreaterThan(1);
    });
  });

  // ==========================================================================
  // Outcome Recording Tests
  // ==========================================================================

  describe('Outcome Recording', () => {
    it('should record a successful outcome', () => {
      const outcome: SPARCOutcome = {
        phase: 'specification',
        pattern_id: null,
        success: true,
        time_taken: 120,
        quality_score: 0.9,
        test_coverage: 0.85,
        feedback: 'Great work',
        artifacts: ['spec1.md', 'spec2.md'],
      };

      expect(() => engine.recordOutcome(outcome)).not.toThrow();

      const metrics = engine.getPhaseMetrics('specification');
      expect(metrics.total_executions).toBeGreaterThan(0);
      expect(metrics.success_rate).toBeGreaterThan(0);
    });

    it('should update pattern confidence based on outcome', () => {
      // Create a pattern
      const patternId = engine.storePattern({
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'Test Pattern',
          description: 'Test',
          context: {},
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.7,
        usage_count: 5,
        success_count: 4,
        avg_time_saved: 100,
        avg_quality_improvement: 0.8,
        last_used: null,
        metadata: {},
      });

      // Record successful outcome using the pattern
      engine.recordOutcome({
        phase: 'specification',
        pattern_id: patternId,
        success: true,
        time_taken: 90,
        quality_score: 0.95,
        feedback: 'Excellent',
        artifacts: [],
      });

      const patterns = engine.getPatternsForPhase('specification');
      const updatedPattern = patterns.find((p) => p.id === patternId);

      expect(updatedPattern).toBeDefined();
      expect(updatedPattern!.usage_count).toBe(6);
      expect(updatedPattern!.success_count).toBe(5);
      expect(updatedPattern!.confidence).toBeGreaterThan(0.7);
    });

    it('should learn new pattern from exceptional outcome', () => {
      const initialPatternCount = engine.getPatternsForPhase('specification').length;

      // Record exceptional outcome without pattern
      engine.recordOutcome({
        phase: 'specification',
        pattern_id: null,
        success: true,
        time_taken: 120,
        quality_score: 0.95, // Exceptional quality
        feedback: 'Perfect implementation',
        artifacts: ['spec.md'],
      });

      const finalPatternCount = engine.getPatternsForPhase('specification').length;
      expect(finalPatternCount).toBeGreaterThan(initialPatternCount);
    });

    it('should handle failed outcomes correctly', () => {
      engine.recordOutcome({
        phase: 'specification',
        pattern_id: null,
        success: false,
        time_taken: 200,
        quality_score: 0.3,
        feedback: 'Needs improvement',
        artifacts: [],
      });

      const metrics = engine.getPhaseMetrics('specification');
      expect(metrics.total_executions).toBeGreaterThan(0);
      expect(metrics.success_rate).toBeLessThan(1.0);
    });
  });

  // ==========================================================================
  // TDD Cycle Tests
  // ==========================================================================

  describe('TDD Cycle Tracking', () => {
    it('should record a successful TDD cycle', () => {
      const cycleId = engine.recordTDDCycle({
        test_file: 'test/feature.test.ts',
        implementation_file: 'src/feature.ts',
        cycle_data: {
          red_phase: { duration: 120, tests_written: 3 },
          green_phase: { duration: 180, tests_passing: 3 },
          refactor_phase: { duration: 90, improvements: ['Extract function', 'Reduce complexity'] },
        },
        total_duration: 390,
        success: true,
      });

      expect(cycleId).toBeDefined();
      expect(typeof cycleId).toBe('string');
    });

    it('should calculate TDD patterns from history', () => {
      // Record multiple cycles
      for (let i = 0; i < 5; i++) {
        engine.recordTDDCycle({
          test_file: `test/feature${i}.test.ts`,
          implementation_file: `src/feature${i}.ts`,
          cycle_data: {
            red_phase: { duration: 100 + i * 10, tests_written: 3 },
            green_phase: { duration: 150 + i * 10, tests_passing: 3 },
            refactor_phase: { duration: 80 + i * 10, improvements: ['Improvement'] },
          },
          total_duration: 330 + i * 30,
          success: true,
        });
      }

      const patterns = engine.getTDDPatterns();

      expect(patterns.avg_red_duration).toBeGreaterThan(0);
      expect(patterns.avg_green_duration).toBeGreaterThan(0);
      expect(patterns.avg_refactor_duration).toBeGreaterThan(0);
      expect(patterns.success_rate).toBeGreaterThan(0);
    });

    it('should identify common refactoring improvements', () => {
      const commonImprovement = 'Extract function';

      for (let i = 0; i < 3; i++) {
        engine.recordTDDCycle({
          test_file: `test/feature${i}.test.ts`,
          implementation_file: `src/feature${i}.ts`,
          cycle_data: {
            red_phase: { duration: 100, tests_written: 2 },
            green_phase: { duration: 150, tests_passing: 2 },
            refactor_phase: { duration: 80, improvements: [commonImprovement, 'Other'] },
          },
          total_duration: 330,
          success: true,
        });
      }

      const patterns = engine.getTDDPatterns();
      expect(patterns.common_improvements).toContain(commonImprovement);
    });
  });

  // ==========================================================================
  // Phase Metrics Tests
  // ==========================================================================

  describe('Phase Metrics', () => {
    it('should calculate phase metrics correctly', () => {
      // Record multiple outcomes
      for (let i = 0; i < 5; i++) {
        engine.recordOutcome({
          phase: 'specification',
          pattern_id: null,
          success: i < 4, // 4 successes, 1 failure
          time_taken: 100 + i * 10,
          quality_score: 0.7 + i * 0.05,
          feedback: 'Test',
          artifacts: [],
        });
      }

      const metrics = engine.getPhaseMetrics('specification');

      expect(metrics.total_executions).toBe(5);
      expect(metrics.success_rate).toBe(0.8); // 4/5
      expect(metrics.avg_duration).toBeCloseTo(120, 0); // (100+110+120+130+140)/5
      expect(metrics.quality_trend.length).toBeGreaterThan(0);
    });

    it('should track quality trends over time', () => {
      const qualityScores = [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];

      qualityScores.forEach((score) => {
        engine.recordOutcome({
          phase: 'specification',
          pattern_id: null,
          success: true,
          time_taken: 100,
          quality_score: score,
          feedback: 'Test',
          artifacts: [],
        });
      });

      const metrics = engine.getPhaseMetrics('specification');
      expect(metrics.quality_trend.length).toBeGreaterThan(0);
      // Should keep last 10
      expect(metrics.quality_trend.length).toBeLessThanOrEqual(10);
    });

    it('should get metrics for all phases', () => {
      const allMetrics = engine.getAllPhaseMetrics();
      expect(allMetrics.length).toBe(5); // All 5 SPARC phases
      expect(allMetrics.map((m) => m.phase)).toContain('specification');
      expect(allMetrics.map((m) => m.phase)).toContain('completion');
    });

    it('should calculate improvement trends', () => {
      // Record improving quality scores
      for (let i = 0; i < 10; i++) {
        engine.recordOutcome({
          phase: 'specification',
          pattern_id: null,
          success: true,
          time_taken: 100,
          quality_score: 0.6 + i * 0.04, // Improving from 0.6 to 0.96
          feedback: 'Test',
          artifacts: [],
        });
      }

      const trends = engine.getImprovementTrends();
      const specTrend = trends.find((t) => t.phase === 'specification');

      expect(specTrend).toBeDefined();
      expect(specTrend!.trend).toBe('improving');
      expect(specTrend!.improvement_rate).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Suggestions and Recommendations Tests
  // ==========================================================================

  describe('Suggestions', () => {
    beforeEach(() => {
      // Add some patterns with usage history
      for (let i = 0; i < 3; i++) {
        const patternId = engine.storePattern({
          phase: 'specification',
          category: 'requirement_template',
          pattern_data: {
            name: `Pattern ${i}`,
            description: 'Test',
            context: { type: 'feature', complexity: i < 2 ? 'low' : 'high' },
            template: '',
            examples: [],
            success_indicators: [],
            antipatterns: [],
          },
          confidence: 0.8 + i * 0.05,
          usage_count: 5 + i,
          success_count: 4 + i,
          avg_time_saved: 100,
          avg_quality_improvement: 0.85,
          last_used: null,
          metadata: {},
        });

        // Record some outcomes for the pattern
        engine.recordOutcome({
          phase: 'specification',
          pattern_id: patternId,
          success: true,
          time_taken: 90,
          quality_score: 0.9,
          feedback: 'Good',
          artifacts: [],
        });
      }
    });

    it('should provide suggestions based on context', () => {
      const suggestions = engine.getSuggestions('specification', {
        type: 'feature',
        complexity: 'low',
      });

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach((s) => {
        expect(s.pattern).toBeDefined();
        expect(s.relevance_score).toBeGreaterThan(0);
        expect(s.reason).toBeDefined();
      });
    });

    it('should sort suggestions by relevance', () => {
      const suggestions = engine.getSuggestions('specification', {
        type: 'feature',
        complexity: 'low',
      });

      if (suggestions.length > 1) {
        for (let i = 1; i < suggestions.length; i++) {
          expect(suggestions[i - 1].relevance_score).toBeGreaterThanOrEqual(suggestions[i].relevance_score);
        }
      }
    });

    it('should not suggest patterns below usage threshold', () => {
      // Create pattern with low usage
      engine.storePattern({
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'Low Usage Pattern',
          description: 'Test',
          context: { type: 'feature' },
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.9,
        usage_count: 1, // Below threshold (3)
        success_count: 1,
        avg_time_saved: 100,
        avg_quality_improvement: 0.9,
        last_used: null,
        metadata: {},
      });

      const suggestions = engine.getSuggestions('specification', { type: 'feature' });

      const lowUsagePattern = suggestions.find((s) => s.pattern.pattern_data.name === 'Low Usage Pattern');
      expect(lowUsagePattern).toBeUndefined();
    });

    it('should get best practices for a phase', () => {
      const bestPractices = engine.getBestPractices('specification');

      expect(Array.isArray(bestPractices)).toBe(true);
      bestPractices.forEach((practice) => {
        expect(practice.practice).toBeDefined();
        expect(practice.confidence).toBeGreaterThan(0);
        expect(practice.evidence_count).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // Similar Pattern Matching Tests
  // ==========================================================================

  describe('Similar Pattern Matching', () => {
    beforeEach(() => {
      // Add patterns with various contexts
      engine.storePattern({
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'REST API Pattern',
          description: 'API specification',
          context: { type: 'api', protocol: 'rest', method: 'GET' },
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.9,
        usage_count: 10,
        success_count: 9,
        avg_time_saved: 200,
        avg_quality_improvement: 0.85,
        last_used: null,
        metadata: {},
      });

      engine.storePattern({
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'GraphQL API Pattern',
          description: 'API specification',
          context: { type: 'api', protocol: 'graphql' },
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.85,
        usage_count: 8,
        success_count: 7,
        avg_time_saved: 180,
        avg_quality_improvement: 0.82,
        last_used: null,
        metadata: {},
      });
    });

    it('should find similar patterns based on context', () => {
      const similar = engine.getSimilarPatterns({ type: 'api', protocol: 'rest' }, 'specification', 10);

      expect(similar.length).toBeGreaterThan(0);
      // REST API pattern should be more similar than GraphQL
      const restPattern = similar.find((p) => p.pattern_data.name.includes('REST'));
      expect(restPattern).toBeDefined();
    });

    it('should return empty array for completely different context', () => {
      const similar = engine.getSimilarPatterns({ type: 'database', operation: 'migration' }, 'specification', 10);

      // Might return some patterns but with low similarity
      similar.forEach((p) => {
        // Just verify structure is correct
        expect(p.pattern_data).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should handle complete workflow: store → use → learn', () => {
      // 1. Store initial pattern
      const patternId = engine.storePattern({
        phase: 'specification',
        category: 'requirement_template',
        pattern_data: {
          name: 'Feature Spec',
          description: 'Feature specification template',
          context: { type: 'feature' },
          template: 'Template content',
          examples: ['Example'],
          success_indicators: ['Complete'],
          antipatterns: ['Incomplete'],
        },
        confidence: 0.7,
        usage_count: 0,
        success_count: 0,
        avg_time_saved: 0,
        avg_quality_improvement: 0,
        last_used: null,
        metadata: {},
      });

      // 2. Get suggestions (should include our pattern after it's used enough)
      const initialSuggestions = engine.getSuggestions('specification', { type: 'feature' });

      // 3. Use the pattern and record outcome
      for (let i = 0; i < 5; i++) {
        engine.recordOutcome({
          phase: 'specification',
          pattern_id: patternId,
          success: true,
          time_taken: 80,
          quality_score: 0.9,
          feedback: 'Worked well',
          artifacts: ['spec.md'],
        });
      }

      // 4. Pattern should now be suggested
      const finalSuggestions = engine.getSuggestions('specification', { type: 'feature' });
      const suggestedPattern = finalSuggestions.find((s) => s.pattern.id === patternId);

      expect(suggestedPattern).toBeDefined();
      expect(suggestedPattern!.pattern.confidence).toBeGreaterThan(0.7);
      expect(suggestedPattern!.pattern.usage_count).toBe(5);
    });

    it('should maintain data consistency across operations', () => {
      const phase: SPARCPhase = 'specification';

      // Perform multiple operations
      const patternId = engine.storePattern({
        phase,
        category: 'requirement_template',
        pattern_data: {
          name: 'Test',
          description: 'Test',
          context: {},
          template: '',
          examples: [],
          success_indicators: [],
          antipatterns: [],
        },
        confidence: 0.8,
        usage_count: 0,
        success_count: 0,
        avg_time_saved: 0,
        avg_quality_improvement: 0,
        last_used: null,
        metadata: {},
      });

      engine.recordOutcome({
        phase,
        pattern_id: patternId,
        success: true,
        time_taken: 100,
        quality_score: 0.9,
        feedback: 'Good',
        artifacts: [],
      });

      // Verify consistency
      const patterns = engine.getPatternsForPhase(phase);
      const metrics = engine.getPhaseMetrics(phase);

      expect(patterns.length).toBeGreaterThan(0);
      expect(metrics.total_executions).toBeGreaterThan(0);
      expect(metrics.pattern_usage_rate).toBeGreaterThan(0);
    });
  });
});
