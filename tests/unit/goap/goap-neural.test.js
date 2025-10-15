"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const types_1 = require("../../../src/goap/types");
(0, globals_1.describe)('GOAP-Neural Integration', () => {
    let planner;
    let neuralEngine;
    (0, globals_1.beforeEach)(() => {
        neuralEngine = {
            retrievePattern: jest.fn(),
            storePattern: jest.fn(),
            updateConfidence: jest.fn()
        };
        planner = new types_1.GOAPPlanner(neuralEngine);
    });
    (0, globals_1.describe)('Pattern-Based Planning', () => {
        (0, globals_1.it)('should use learned patterns when available', async () => {
            const current = new types_1.State({ code: 'ready' });
            const goal = new types_1.State({ deployed: true });
            neuralEngine.retrievePattern.mockResolvedValue({
                id: 'pattern-1',
                actions: ['build', 'test', 'deploy'],
                confidence: 0.95
            });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.fromPattern).toBe(true);
            (0, globals_1.expect)(plan.actions).toEqual(['build', 'test', 'deploy']);
            (0, globals_1.expect)(neuralEngine.retrievePattern).toHaveBeenCalled();
        });
        (0, globals_1.it)('should fall back to A* when no pattern matches', async () => {
            const current = new types_1.State({ code: 'ready' });
            const goal = new types_1.State({ deployed: true });
            neuralEngine.retrievePattern.mockResolvedValue(null);
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.fromPattern).toBe(false);
            (0, globals_1.expect)(plan.fromAStar).toBe(true);
            (0, globals_1.expect)(plan.actions.length).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should reject low-confidence patterns', async () => {
            const current = new types_1.State({ code: 'ready' });
            const goal = new types_1.State({ deployed: true });
            neuralEngine.retrievePattern.mockResolvedValue({
                id: 'pattern-2',
                actions: ['risky', 'approach'],
                confidence: 0.4
            });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.fromPattern).toBe(false);
            (0, globals_1.expect)(plan.fromAStar).toBe(true);
        });
        (0, globals_1.it)('should adapt patterns to current context', async () => {
            const current = new types_1.State({ code: 'ready', env: 'staging' });
            const goal = new types_1.State({ deployed: true });
            neuralEngine.retrievePattern.mockResolvedValue({
                id: 'pattern-3',
                actions: ['build', 'test', 'deploy'],
                conditions: { env: 'production' },
                confidence: 0.9
            });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.adapted).toBe(true);
            (0, globals_1.expect)(plan.actions).toContain('configure_staging');
        });
    });
    (0, globals_1.describe)('A* Search with Learned Heuristics', () => {
        (0, globals_1.it)('should use learned heuristics for faster planning', async () => {
            const current = new types_1.State({ task: 'start' });
            const goal = new types_1.State({ task: 'complete' });
            neuralEngine.retrievePattern.mockResolvedValue({
                heuristics: {
                    'start→intermediate': 5,
                    'intermediate→complete': 3
                }
            });
            const startTime = Date.now();
            const plan = await planner.plan(current, goal);
            const duration = Date.now() - startTime;
            (0, globals_1.expect)(plan).toBeDefined();
            (0, globals_1.expect)(duration).toBeLessThan(100);
        });
        (0, globals_1.it)('should expand fewer nodes with good heuristics', async () => {
            const current = new types_1.State({ pos: 0 });
            const goal = new types_1.State({ pos: 10 });
            neuralEngine.retrievePattern.mockResolvedValue({
                heuristics: { optimal_path: [1, 3, 5, 7, 9, 10] }
            });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.nodesExpanded).toBeLessThan(20);
        });
        (0, globals_1.it)('should handle admissible heuristics correctly', async () => {
            const current = new types_1.State({ x: 0, y: 0 });
            const goal = new types_1.State({ x: 5, y: 5 });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.cost).toBeGreaterThanOrEqual(plan.estimatedCost || 0);
        });
    });
    (0, globals_1.describe)('Pattern Learning from Successful Plans', () => {
        (0, globals_1.it)('should store successful A* plans as patterns', async () => {
            const current = new types_1.State({ state: 'A' });
            const goal = new types_1.State({ state: 'Z' });
            neuralEngine.retrievePattern.mockResolvedValue(null);
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.fromAStar).toBe(true);
            await planner.learnFromPlan(plan, { success: true, duration: 1000 });
            (0, globals_1.expect)(neuralEngine.storePattern).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                actions: plan.actions,
                confidence: globals_1.expect.any(Number)
            }));
        });
        (0, globals_1.it)('should update pattern confidence on subsequent uses', async () => {
            const current = new types_1.State({ task: 'deploy' });
            const goal = new types_1.State({ deployed: true });
            neuralEngine.retrievePattern.mockResolvedValue({
                id: 'pattern-4',
                actions: ['build', 'test', 'deploy'],
                confidence: 0.7
            });
            const plan = await planner.plan(current, goal);
            await planner.learnFromPlan(plan, { success: true, duration: 800 });
            (0, globals_1.expect)(neuralEngine.updateConfidence).toHaveBeenCalledWith('pattern-4', globals_1.expect.any(Number));
        });
        (0, globals_1.it)('should decrease confidence on failures', async () => {
            const current = new types_1.State({ task: 'migrate' });
            const goal = new types_1.State({ migrated: true });
            neuralEngine.retrievePattern.mockResolvedValue({
                id: 'pattern-5',
                actions: ['backup', 'migrate'],
                confidence: 0.8
            });
            const plan = await planner.plan(current, goal);
            await planner.learnFromPlan(plan, {
                success: false,
                duration: 5000,
                error: 'Migration failed'
            });
            (0, globals_1.expect)(neuralEngine.updateConfidence).toHaveBeenCalledWith('pattern-5', globals_1.expect.lessThan(0.8));
        });
    });
    (0, globals_1.describe)('Dynamic Replanning (OODA Loop)', () => {
        (0, globals_1.it)('should detect when plan execution deviates', async () => {
            const current = new types_1.State({ progress: 0.5, error: true });
            const goal = new types_1.State({ progress: 1.0 });
            const originalPlan = {
                actions: ['step1', 'step2', 'step3'],
                currentStep: 1
            };
            const shouldReplan = planner.shouldReplan(originalPlan, current);
            (0, globals_1.expect)(shouldReplan).toBe(true);
        });
        (0, globals_1.it)('should replan when obstacles encountered', async () => {
            const current = new types_1.State({ path: 'blocked' });
            const goal = new types_1.State({ destination: 'reached' });
            neuralEngine.retrievePattern.mockResolvedValue({
                id: 'pattern-6',
                actions: ['forward', 'forward'],
                confidence: 0.9
            });
            const plan = await planner.plan(current, goal);
            current.set('obstacle', true);
            const replan = await planner.replan(plan, current, goal);
            (0, globals_1.expect)(replan.actions).not.toEqual(plan.actions);
            (0, globals_1.expect)(replan.replanned).toBe(true);
        });
        (0, globals_1.it)('should maintain plan history', async () => {
            const current = new types_1.State({ step: 0 });
            const goal = new types_1.State({ step: 10 });
            const plan1 = await planner.plan(current, goal);
            current.set('step', 5);
            const plan2 = await planner.replan(plan1, current, goal);
            (0, globals_1.expect)(planner.planHistory).toHaveLength(2);
            (0, globals_1.expect)(planner.planHistory[0]).toBe(plan1);
            (0, globals_1.expect)(planner.planHistory[1]).toBe(plan2);
        });
    });
    (0, globals_1.describe)('Cost Calculation', () => {
        (0, globals_1.it)('should calculate action costs', () => {
            const action = new types_1.Action('deploy', { duration: 1000, complexity: 5 });
            const cost = planner.calculateCost(action);
            (0, globals_1.expect)(cost).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should apply learned cost adjustments', async () => {
            neuralEngine.retrievePattern.mockResolvedValue({
                costAdjustments: {
                    'slow_action': 1.5,
                    'fast_action': 0.7
                }
            });
            const slowAction = new types_1.Action('slow_action');
            const fastAction = new types_1.Action('fast_action');
            await planner.loadCostAdjustments();
            const slowCost = planner.calculateCost(slowAction);
            const fastCost = planner.calculateCost(fastAction);
            (0, globals_1.expect)(slowCost).toBeGreaterThan(fastCost);
        });
    });
    (0, globals_1.describe)('State Space Exploration', () => {
        (0, globals_1.it)('should explore state space efficiently', async () => {
            const current = new types_1.State({ value: 0 });
            const goal = new types_1.State({ value: 100 });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.nodesExpanded).toBeLessThan(1000);
        });
        (0, globals_1.it)('should handle large state spaces', async () => {
            const current = new types_1.State({
                x: 0,
                y: 0,
                inventory: [],
                health: 100
            });
            const goal = new types_1.State({ x: 10, y: 10, item_collected: true });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan).toBeDefined();
            (0, globals_1.expect)(plan.actions.length).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should prune impossible branches', async () => {
            const current = new types_1.State({ resources: 10 });
            const goal = new types_1.State({ built: 'castle' });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.feasible).toBe(false);
        });
    });
    (0, globals_1.describe)('Goal Prioritization', () => {
        (0, globals_1.it)('should handle multiple goals', async () => {
            const current = new types_1.State({ tasks: [] });
            const goals = [
                new types_1.State({ task1: 'done', priority: 10 }),
                new types_1.State({ task2: 'done', priority: 5 }),
                new types_1.State({ task3: 'done', priority: 8 })
            ];
            const plans = await planner.planMultipleGoals(current, goals);
            (0, globals_1.expect)(plans[0].goal.get('priority')).toBe(10);
        });
        (0, globals_1.it)('should optimize for goal combinations', async () => {
            const current = new types_1.State({ pos: 'A' });
            const goals = [
                new types_1.State({ visited: 'B' }),
                new types_1.State({ visited: 'C' }),
                new types_1.State({ visited: 'D' })
            ];
            const combinedPlan = await planner.optimizeCombinedGoals(current, goals);
            (0, globals_1.expect)(combinedPlan.cost).toBeLessThan(goals.length * 10);
        });
    });
    (0, globals_1.describe)('Performance', () => {
        (0, globals_1.it)('should plan quickly for simple goals', async () => {
            const current = new types_1.State({ ready: true });
            const goal = new types_1.State({ complete: true });
            const start = Date.now();
            await planner.plan(current, goal);
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(100);
        });
        (0, globals_1.it)('should plan within time budget for complex goals', async () => {
            const current = new types_1.State({ phase: 'start' });
            const goal = new types_1.State({ phase: 'end', steps: 20 });
            const plan = await planner.plan(current, goal, {
                timeout: 5000
            });
            (0, globals_1.expect)(plan).toBeDefined();
            (0, globals_1.expect)(plan.timedOut).toBe(false);
        });
        (0, globals_1.it)('should cache frequent plans', async () => {
            const current = new types_1.State({ task: 'frequent' });
            const goal = new types_1.State({ done: true });
            const start1 = Date.now();
            await planner.plan(current, goal);
            const duration1 = Date.now() - start1;
            const start2 = Date.now();
            await planner.plan(current, goal);
            const duration2 = Date.now() - start2;
            (0, globals_1.expect)(duration2).toBeLessThan(duration1 * 0.5);
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle impossible goals', async () => {
            const current = new types_1.State({ canFly: false });
            const goal = new types_1.State({ altitude: 1000 });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.feasible).toBe(false);
            (0, globals_1.expect)(plan.error).toContain('impossible');
        });
        (0, globals_1.it)('should handle cycles in state space', async () => {
            const current = new types_1.State({ node: 'A' });
            const goal = new types_1.State({ node: 'A' });
            const plan = await planner.plan(current, goal);
            (0, globals_1.expect)(plan.actions).toHaveLength(0);
            (0, globals_1.expect)(plan.alreadyAtGoal).toBe(true);
        });
        (0, globals_1.it)('should timeout on very large searches', async () => {
            const current = new types_1.State({ huge: 'space' });
            const goal = new types_1.State({ needle: 'haystack' });
            const plan = await planner.plan(current, goal, {
                timeout: 100
            });
            (0, globals_1.expect)(plan.timedOut).toBe(true);
        });
    });
});
//# sourceMappingURL=goap-neural.test.js.map