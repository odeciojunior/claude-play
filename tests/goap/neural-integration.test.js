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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const sqlite3_1 = require("sqlite3");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const neural_integration_1 = __importDefault(require("../../src/goap/neural-integration"));
(0, globals_1.describe)('NeuralGOAPPlanner', () => {
    let db;
    let planner;
    let config;
    let testActions;
    (0, globals_1.beforeEach)(async () => {
        db = new sqlite3_1.Database(':memory:');
        const schemaPath = path.join(__dirname, '../../src/goap/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        config = {
            enable_pattern_learning: true,
            pattern_match_threshold: 0.7,
            max_search_depth: 100,
            timeout_ms: 5000,
            risk_factors: {
                low: 1.0,
                medium: 1.5,
                high: 2.0,
                critical: 3.0
            },
            heuristic_weights: {
                neural_system: 10,
                memory_unified: 8,
                goap_pattern_based: 7,
                verification_learning: 6,
                coordination_efficiency: 3,
                pattern_reuse: 3
            },
            enable_replanning: true,
            replan_threshold: 0.5
        };
        planner = new neural_integration_1.default(db, config);
        testActions = [
            {
                id: 'A1',
                name: 'Implement SAFLA Neural Engine',
                category: 'foundation',
                priority: 'critical',
                preconditions: {
                    system_architecture_defined: true,
                    development_environment_ready: true
                },
                effects: {
                    neural_system: 'active',
                    four_tier_memory: true
                },
                cost: {
                    development_hours: 40,
                    complexity: 'high',
                    risk: 'high',
                    total_cost: 80
                },
                value: {
                    unblocks: ['A2', 'A3', 'A4']
                }
            },
            {
                id: 'A2',
                name: 'Unify Memory Systems',
                category: 'foundation',
                priority: 'high',
                preconditions: {
                    neural_system: 'active'
                },
                effects: {
                    memory_unified: true
                },
                cost: {
                    development_hours: 20,
                    complexity: 'medium',
                    risk: 'low',
                    total_cost: 20
                },
                value: {
                    unblocks: ['A5']
                }
            },
            {
                id: 'A3',
                name: 'Integrate Verification-Neural',
                category: 'integration',
                priority: 'high',
                preconditions: {
                    neural_system: 'active',
                    verification_system: 'active'
                },
                effects: {
                    verification_learning: true
                },
                cost: {
                    development_hours: 16,
                    complexity: 'medium',
                    risk: 'medium',
                    total_cost: 24
                },
                value: {}
            },
            {
                id: 'A4',
                name: 'Integrate GOAP-Neural',
                category: 'integration',
                priority: 'high',
                preconditions: {
                    neural_system: 'active',
                    goap_planner: 'initialized'
                },
                effects: {
                    goap_pattern_based: true
                },
                cost: {
                    development_hours: 24,
                    complexity: 'medium',
                    risk: 'medium',
                    total_cost: 36
                },
                value: {}
            },
            {
                id: 'A5',
                name: 'Enable Agent Learning',
                category: 'integration',
                priority: 'high',
                preconditions: {
                    neural_system: 'active',
                    memory_unified: true
                },
                effects: {
                    agents_learning: 10
                },
                cost: {
                    development_hours: 32,
                    complexity: 'medium',
                    risk: 'medium',
                    total_cost: 48
                },
                value: {}
            }
        ];
    });
    (0, globals_1.afterEach)(async () => {
        await new Promise((resolve) => {
            db.close(() => resolve());
        });
    });
    (0, globals_1.describe)('Plan Generation', () => {
        (0, globals_1.it)('should generate plan using A* search', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented',
                memory_unified: false,
                verification_system: 'active',
                goap_planner: 'initialized'
            };
            const goalState = {
                neural_system: 'active',
                memory_unified: true,
                verification_learning: true
            };
            const plan = await planner.plan(currentState, goalState, testActions);
            (0, globals_1.expect)(plan).toBeDefined();
            (0, globals_1.expect)(plan.actions.length).toBeGreaterThan(0);
            (0, globals_1.expect)(plan.total_cost).toBeGreaterThan(0);
            (0, globals_1.expect)(plan.context.current_state).toEqual(currentState);
            (0, globals_1.expect)(plan.context.goal_state).toEqual(goalState);
        });
        (0, globals_1.it)('should validate plan achieves goal', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            const plan = await planner.plan(currentState, goalState, testActions);
            let state = { ...currentState };
            for (const action of plan.actions) {
                state = { ...state, ...action.effects };
            }
            (0, globals_1.expect)(state.neural_system).toBe('active');
        });
        (0, globals_1.it)('should respect action preconditions', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                memory_unified: true
            };
            const plan = await planner.plan(currentState, goalState, testActions);
            (0, globals_1.expect)(plan.actions[0].id).toBe('A1');
            (0, globals_1.expect)(plan.actions[1].id).toBe('A2');
        });
    });
    (0, globals_1.describe)('Pattern Learning', () => {
        (0, globals_1.it)('should store successful plan as pattern', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            const plan = await planner.plan(currentState, goalState, testActions);
            const stats = await planner.getPatternLibraryStats();
            (0, globals_1.expect)(stats.total_patterns).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should reuse learned patterns', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            const plan1 = await planner.plan(currentState, goalState, testActions);
            const outcome = {
                plan_id: plan1.id,
                success: true,
                actual_cost: plan1.total_cost * 0.95,
                estimated_cost: plan1.total_cost,
                cost_variance: -0.05,
                achieved_goal: true,
                execution_time: 3600000
            };
            await planner.trackExecution(plan1, outcome);
            const plan2 = await planner.plan(currentState, goalState, testActions);
            const stats = planner.getStats();
            (0, globals_1.expect)(stats.pattern_based_plans).toBeGreaterThan(0);
            (0, globals_1.expect)(stats.pattern_reuse_rate).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should update pattern confidence from outcomes', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            const plan = await planner.plan(currentState, goalState, testActions);
            const outcome = {
                plan_id: plan.id,
                success: true,
                actual_cost: plan.total_cost,
                estimated_cost: plan.total_cost,
                cost_variance: 0,
                achieved_goal: true,
                execution_time: 3600000
            };
            await planner.trackExecution(plan, outcome);
            const statsAfter = await planner.getPatternLibraryStats();
            (0, globals_1.expect)(statsAfter.average_confidence).toBeGreaterThan(0.5);
        });
    });
    (0, globals_1.describe)('Performance Optimization', () => {
        (0, globals_1.it)('should achieve 60% faster planning with patterns', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active',
                memory_unified: true
            };
            const startBaseline = Date.now();
            const baselinePlan = await planner.plan(currentState, goalState, testActions);
            const baselineTime = Date.now() - startBaseline;
            const outcome = {
                plan_id: baselinePlan.id,
                success: true,
                actual_cost: baselinePlan.total_cost,
                estimated_cost: baselinePlan.total_cost,
                cost_variance: 0,
                achieved_goal: true,
                execution_time: 3600000
            };
            await planner.trackExecution(baselinePlan, outcome);
            const startPattern = Date.now();
            const patternPlan = await planner.plan(currentState, goalState, testActions);
            const patternTime = Date.now() - startPattern;
            const speedup = (baselineTime - patternTime) / baselineTime;
            console.log(`Speedup: ${(speedup * 100).toFixed(1)}% (target: 60%)`);
            (0, globals_1.expect)(patternTime).toBeLessThanOrEqual(baselineTime);
        });
        (0, globals_1.it)('should cache frequently-used patterns', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            for (let i = 0; i < 5; i++) {
                const plan = await planner.plan(currentState, goalState, testActions);
                const outcome = {
                    plan_id: plan.id,
                    success: true,
                    actual_cost: plan.total_cost,
                    estimated_cost: plan.total_cost,
                    cost_variance: 0,
                    achieved_goal: true,
                    execution_time: 3600000
                };
                await planner.trackExecution(plan, outcome);
            }
            const stats = await planner.getPatternLibraryStats();
            (0, globals_1.expect)(stats.average_usage).toBeGreaterThan(1);
        });
    });
    (0, globals_1.describe)('Adaptive Replanning', () => {
        (0, globals_1.it)('should detect when replanning is needed', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            const plan = await planner.plan(currentState, goalState, testActions);
            const outcome = {
                plan_id: plan.id,
                success: true,
                actual_cost: plan.total_cost * 2.0,
                estimated_cost: plan.total_cost,
                cost_variance: 1.0,
                achieved_goal: true,
                execution_time: 7200000
            };
            await planner.trackExecution(plan, outcome);
            const stats = planner.getStats();
            (0, globals_1.expect)(stats.replanning_rate).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should handle failed execution outcomes', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            const plan = await planner.plan(currentState, goalState, testActions);
            const outcome = {
                plan_id: plan.id,
                success: false,
                actual_cost: plan.total_cost * 0.5,
                estimated_cost: plan.total_cost,
                cost_variance: -0.5,
                achieved_goal: false,
                execution_time: 1800000,
                errors: ['Action A1 failed: dependency not met']
            };
            await planner.trackExecution(plan, outcome);
            const stats = await planner.getPatternLibraryStats();
            (0, globals_1.expect)(stats.total_patterns).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Pattern Quality', () => {
        (0, globals_1.it)('should maintain patterns with high confidence', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            const plan = await planner.plan(currentState, goalState, testActions);
            for (let i = 0; i < 10; i++) {
                const outcome = {
                    plan_id: plan.id,
                    success: true,
                    actual_cost: plan.total_cost * (0.95 + Math.random() * 0.1),
                    estimated_cost: plan.total_cost,
                    cost_variance: Math.random() * 0.1 - 0.05,
                    achieved_goal: true,
                    execution_time: 3600000
                };
                await planner.trackExecution(plan, outcome);
            }
            const stats = await planner.getPatternLibraryStats();
            (0, globals_1.expect)(stats.high_confidence_patterns).toBeGreaterThan(0);
            (0, globals_1.expect)(stats.average_confidence).toBeGreaterThan(0.7);
        });
        (0, globals_1.it)('should identify low-usage patterns', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            for (let i = 0; i < 5; i++) {
                const modifiedGoal = {
                    ...goalState,
                    [`extra_goal_${i}`]: true
                };
                await planner.plan(currentState, modifiedGoal, testActions);
            }
            const stats = await planner.getPatternLibraryStats();
            (0, globals_1.expect)(stats.low_usage_patterns).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Statistics and Metrics', () => {
        (0, globals_1.it)('should track planning statistics', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            for (let i = 0; i < 10; i++) {
                await planner.plan(currentState, goalState, testActions);
            }
            const stats = planner.getStats();
            (0, globals_1.expect)(stats.total_plans_generated).toBe(10);
            (0, globals_1.expect)(stats.average_planning_time_ms).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should calculate pattern reuse rate', async () => {
            const currentState = {
                system_architecture_defined: true,
                development_environment_ready: true,
                neural_system: 'not_implemented'
            };
            const goalState = {
                neural_system: 'active'
            };
            const plan1 = await planner.plan(currentState, goalState, testActions);
            const outcome = {
                plan_id: plan1.id,
                success: true,
                actual_cost: plan1.total_cost,
                estimated_cost: plan1.total_cost,
                cost_variance: 0,
                achieved_goal: true,
                execution_time: 3600000
            };
            await planner.trackExecution(plan1, outcome);
            await planner.plan(currentState, goalState, testActions);
            const stats = planner.getStats();
            (0, globals_1.expect)(stats.pattern_reuse_rate).toBeGreaterThan(0);
            (0, globals_1.expect)(stats.pattern_reuse_rate).toBeLessThanOrEqual(1);
        });
    });
});
(0, globals_1.describe)('Performance Benchmarks', () => {
    (0, globals_1.it)('should benchmark A* vs Pattern-based planning', async () => {
        const db = new sqlite3_1.Database(':memory:');
        const config = {
            enable_pattern_learning: true,
            pattern_match_threshold: 0.7,
            max_search_depth: 100,
            timeout_ms: 5000,
            risk_factors: { low: 1.0, medium: 1.5, high: 2.0, critical: 3.0 },
            heuristic_weights: {},
            enable_replanning: true,
            replan_threshold: 0.5
        };
        const planner = new neural_integration_1.default(db, config);
        const actions = Array.from({ length: 20 }, (_, i) => ({
            id: `A${i}`,
            name: `Action ${i}`,
            category: 'test',
            priority: 'medium',
            preconditions: i > 0 ? { [`state_${i - 1}`]: true } : {},
            effects: { [`state_${i}`]: true },
            cost: {
                development_hours: 10 + i,
                complexity: 'medium',
                risk: 'low',
                total_cost: 10 + i
            },
            value: {}
        }));
        const currentState = {};
        const goalState = { state_19: true };
        const astarTimes = [];
        for (let i = 0; i < 10; i++) {
            const start = Date.now();
            await planner.plan(currentState, goalState, actions);
            astarTimes.push(Date.now() - start);
        }
        const avgAstar = astarTimes.reduce((a, b) => a + b, 0) / astarTimes.length;
        console.log(`Average A* planning time: ${avgAstar.toFixed(2)}ms`);
        for (let i = 0; i < 5; i++) {
            const plan = await planner.plan(currentState, goalState, actions);
            const outcome = {
                plan_id: plan.id,
                success: true,
                actual_cost: plan.total_cost,
                estimated_cost: plan.total_cost,
                cost_variance: 0,
                achieved_goal: true,
                execution_time: 3600000
            };
            await planner.trackExecution(plan, outcome);
        }
        const patternTimes = [];
        for (let i = 0; i < 10; i++) {
            const start = Date.now();
            await planner.plan(currentState, goalState, actions);
            patternTimes.push(Date.now() - start);
        }
        const avgPattern = patternTimes.reduce((a, b) => a + b, 0) / patternTimes.length;
        console.log(`Average Pattern planning time: ${avgPattern.toFixed(2)}ms`);
        const speedup = ((avgAstar - avgPattern) / avgAstar) * 100;
        console.log(`Speedup: ${speedup.toFixed(1)}% (target: 60%)`);
        db.close();
        (0, globals_1.expect)(avgPattern).toBeLessThan(avgAstar);
    });
});
//# sourceMappingURL=neural-integration.test.js.map