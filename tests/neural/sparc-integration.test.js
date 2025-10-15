"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const sparc_integration_1 = require("../../src/neural/sparc-integration");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
(0, globals_1.describe)('SPARCNeuralEngine', () => {
    let engine;
    let testDbPath;
    (0, globals_1.beforeEach)(() => {
        testDbPath = path.join(__dirname, `test-sparc-${crypto.randomBytes(8).toString('hex')}.db`);
        engine = new sparc_integration_1.SPARCNeuralEngine({
            ...sparc_integration_1.defaultSPARCLearningConfig,
            db_path: testDbPath,
        });
    });
    (0, globals_1.afterEach)(() => {
        engine.close();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });
    (0, globals_1.describe)('Pattern Storage', () => {
        (0, globals_1.it)('should store a new pattern successfully', () => {
            const pattern = {
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
            (0, globals_1.expect)(patternId).toBeDefined();
            (0, globals_1.expect)(typeof patternId).toBe('string');
        });
        (0, globals_1.it)('should retrieve patterns for a specific phase', () => {
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
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns.length).toBeLessThanOrEqual(20);
            for (let i = 1; i < patterns.length; i++) {
                (0, globals_1.expect)(patterns[i - 1].confidence).toBeGreaterThanOrEqual(patterns[i].confidence);
            }
        });
        (0, globals_1.it)('should filter patterns by category', () => {
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
            (0, globals_1.expect)(requirementPatterns.length).toBeGreaterThan(0);
            requirementPatterns.forEach((p) => {
                (0, globals_1.expect)(p.category).toBe('requirement_template');
            });
        });
        (0, globals_1.it)('should filter patterns by confidence threshold', () => {
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
            (0, globals_1.expect)(highConfidencePatterns.length).toBeGreaterThan(0);
            highConfidencePatterns.forEach((p) => {
                (0, globals_1.expect)(p.confidence).toBeGreaterThanOrEqual(0.8);
            });
        });
        (0, globals_1.it)('should get top patterns across all phases', () => {
            const phases = ['specification', 'pseudocode', 'architecture'];
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
            (0, globals_1.expect)(topPatterns.length).toBeGreaterThan(0);
            const uniquePhases = new Set(topPatterns.map((p) => p.phase));
            (0, globals_1.expect)(uniquePhases.size).toBeGreaterThan(1);
        });
    });
    (0, globals_1.describe)('Outcome Recording', () => {
        (0, globals_1.it)('should record a successful outcome', () => {
            const outcome = {
                phase: 'specification',
                pattern_id: null,
                success: true,
                time_taken: 120,
                quality_score: 0.9,
                test_coverage: 0.85,
                feedback: 'Great work',
                artifacts: ['spec1.md', 'spec2.md'],
            };
            (0, globals_1.expect)(() => engine.recordOutcome(outcome)).not.toThrow();
            const metrics = engine.getPhaseMetrics('specification');
            (0, globals_1.expect)(metrics.total_executions).toBeGreaterThan(0);
            (0, globals_1.expect)(metrics.success_rate).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should update pattern confidence based on outcome', () => {
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
            (0, globals_1.expect)(updatedPattern).toBeDefined();
            (0, globals_1.expect)(updatedPattern.usage_count).toBe(6);
            (0, globals_1.expect)(updatedPattern.success_count).toBe(5);
            (0, globals_1.expect)(updatedPattern.confidence).toBeGreaterThan(0.7);
        });
        (0, globals_1.it)('should learn new pattern from exceptional outcome', () => {
            const initialPatternCount = engine.getPatternsForPhase('specification').length;
            engine.recordOutcome({
                phase: 'specification',
                pattern_id: null,
                success: true,
                time_taken: 120,
                quality_score: 0.95,
                feedback: 'Perfect implementation',
                artifacts: ['spec.md'],
            });
            const finalPatternCount = engine.getPatternsForPhase('specification').length;
            (0, globals_1.expect)(finalPatternCount).toBeGreaterThan(initialPatternCount);
        });
        (0, globals_1.it)('should handle failed outcomes correctly', () => {
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
            (0, globals_1.expect)(metrics.total_executions).toBeGreaterThan(0);
            (0, globals_1.expect)(metrics.success_rate).toBeLessThan(1.0);
        });
    });
    (0, globals_1.describe)('TDD Cycle Tracking', () => {
        (0, globals_1.it)('should record a successful TDD cycle', () => {
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
            (0, globals_1.expect)(cycleId).toBeDefined();
            (0, globals_1.expect)(typeof cycleId).toBe('string');
        });
        (0, globals_1.it)('should calculate TDD patterns from history', () => {
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
            (0, globals_1.expect)(patterns.avg_red_duration).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns.avg_green_duration).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns.avg_refactor_duration).toBeGreaterThan(0);
            (0, globals_1.expect)(patterns.success_rate).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should identify common refactoring improvements', () => {
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
            (0, globals_1.expect)(patterns.common_improvements).toContain(commonImprovement);
        });
    });
    (0, globals_1.describe)('Phase Metrics', () => {
        (0, globals_1.it)('should calculate phase metrics correctly', () => {
            for (let i = 0; i < 5; i++) {
                engine.recordOutcome({
                    phase: 'specification',
                    pattern_id: null,
                    success: i < 4,
                    time_taken: 100 + i * 10,
                    quality_score: 0.7 + i * 0.05,
                    feedback: 'Test',
                    artifacts: [],
                });
            }
            const metrics = engine.getPhaseMetrics('specification');
            (0, globals_1.expect)(metrics.total_executions).toBe(5);
            (0, globals_1.expect)(metrics.success_rate).toBe(0.8);
            (0, globals_1.expect)(metrics.avg_duration).toBeCloseTo(120, 0);
            (0, globals_1.expect)(metrics.quality_trend.length).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should track quality trends over time', () => {
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
            (0, globals_1.expect)(metrics.quality_trend.length).toBeGreaterThan(0);
            (0, globals_1.expect)(metrics.quality_trend.length).toBeLessThanOrEqual(10);
        });
        (0, globals_1.it)('should get metrics for all phases', () => {
            const allMetrics = engine.getAllPhaseMetrics();
            (0, globals_1.expect)(allMetrics.length).toBe(5);
            (0, globals_1.expect)(allMetrics.map((m) => m.phase)).toContain('specification');
            (0, globals_1.expect)(allMetrics.map((m) => m.phase)).toContain('completion');
        });
        (0, globals_1.it)('should calculate improvement trends', () => {
            for (let i = 0; i < 10; i++) {
                engine.recordOutcome({
                    phase: 'specification',
                    pattern_id: null,
                    success: true,
                    time_taken: 100,
                    quality_score: 0.6 + i * 0.04,
                    feedback: 'Test',
                    artifacts: [],
                });
            }
            const trends = engine.getImprovementTrends();
            const specTrend = trends.find((t) => t.phase === 'specification');
            (0, globals_1.expect)(specTrend).toBeDefined();
            (0, globals_1.expect)(specTrend.trend).toBe('improving');
            (0, globals_1.expect)(specTrend.improvement_rate).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Suggestions', () => {
        (0, globals_1.beforeEach)(() => {
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
        (0, globals_1.it)('should provide suggestions based on context', () => {
            const suggestions = engine.getSuggestions('specification', {
                type: 'feature',
                complexity: 'low',
            });
            (0, globals_1.expect)(suggestions.length).toBeGreaterThan(0);
            suggestions.forEach((s) => {
                (0, globals_1.expect)(s.pattern).toBeDefined();
                (0, globals_1.expect)(s.relevance_score).toBeGreaterThan(0);
                (0, globals_1.expect)(s.reason).toBeDefined();
            });
        });
        (0, globals_1.it)('should sort suggestions by relevance', () => {
            const suggestions = engine.getSuggestions('specification', {
                type: 'feature',
                complexity: 'low',
            });
            if (suggestions.length > 1) {
                for (let i = 1; i < suggestions.length; i++) {
                    (0, globals_1.expect)(suggestions[i - 1].relevance_score).toBeGreaterThanOrEqual(suggestions[i].relevance_score);
                }
            }
        });
        (0, globals_1.it)('should not suggest patterns below usage threshold', () => {
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
                usage_count: 1,
                success_count: 1,
                avg_time_saved: 100,
                avg_quality_improvement: 0.9,
                last_used: null,
                metadata: {},
            });
            const suggestions = engine.getSuggestions('specification', { type: 'feature' });
            const lowUsagePattern = suggestions.find((s) => s.pattern.pattern_data.name === 'Low Usage Pattern');
            (0, globals_1.expect)(lowUsagePattern).toBeUndefined();
        });
        (0, globals_1.it)('should get best practices for a phase', () => {
            const bestPractices = engine.getBestPractices('specification');
            (0, globals_1.expect)(Array.isArray(bestPractices)).toBe(true);
            bestPractices.forEach((practice) => {
                (0, globals_1.expect)(practice.practice).toBeDefined();
                (0, globals_1.expect)(practice.confidence).toBeGreaterThan(0);
                (0, globals_1.expect)(practice.evidence_count).toBeGreaterThan(0);
            });
        });
    });
    (0, globals_1.describe)('Similar Pattern Matching', () => {
        (0, globals_1.beforeEach)(() => {
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
        (0, globals_1.it)('should find similar patterns based on context', () => {
            const similar = engine.getSimilarPatterns({ type: 'api', protocol: 'rest' }, 'specification', 10);
            (0, globals_1.expect)(similar.length).toBeGreaterThan(0);
            const restPattern = similar.find((p) => p.pattern_data.name.includes('REST'));
            (0, globals_1.expect)(restPattern).toBeDefined();
        });
        (0, globals_1.it)('should return empty array for completely different context', () => {
            const similar = engine.getSimilarPatterns({ type: 'database', operation: 'migration' }, 'specification', 10);
            similar.forEach((p) => {
                (0, globals_1.expect)(p.pattern_data).toBeDefined();
            });
        });
    });
    (0, globals_1.describe)('Integration', () => {
        (0, globals_1.it)('should handle complete workflow: store → use → learn', () => {
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
            const initialSuggestions = engine.getSuggestions('specification', { type: 'feature' });
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
            const finalSuggestions = engine.getSuggestions('specification', { type: 'feature' });
            const suggestedPattern = finalSuggestions.find((s) => s.pattern.id === patternId);
            (0, globals_1.expect)(suggestedPattern).toBeDefined();
            (0, globals_1.expect)(suggestedPattern.pattern.confidence).toBeGreaterThan(0.7);
            (0, globals_1.expect)(suggestedPattern.pattern.usage_count).toBe(5);
        });
        (0, globals_1.it)('should maintain data consistency across operations', () => {
            const phase = 'specification';
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
            const patterns = engine.getPatternsForPhase(phase);
            const metrics = engine.getPhaseMetrics(phase);
            (0, globals_1.expect)(patterns.length).toBeGreaterThan(0);
            (0, globals_1.expect)(metrics.total_executions).toBeGreaterThan(0);
            (0, globals_1.expect)(metrics.pattern_usage_rate).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=sparc-integration.test.js.map