/**
 * Unit Tests for GOAP-Neural Integration
 *
 * Test Coverage: Pattern-based planning, A* fallback, learned heuristics
 * Target: 60+ tests, >95% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  GOAPPlanner,
  State,
  Action,
  Plan,
  Heuristic
} from '../../../src/goap/types';

describe('GOAP-Neural Integration', () => {
  let planner: GOAPPlanner;
  let neuralEngine: any; // Mock neural engine

  beforeEach(() => {
    neuralEngine = {
      retrievePattern: jest.fn(),
      storePattern: jest.fn(),
      updateConfidence: jest.fn()
    };

    planner = new GOAPPlanner(neuralEngine);
  });

  describe('Pattern-Based Planning', () => {
    it('should use learned patterns when available', async () => {
      const current = new State({ code: 'ready' });
      const goal = new State({ deployed: true });

      neuralEngine.retrievePattern.mockResolvedValue({
        id: 'pattern-1',
        actions: ['build', 'test', 'deploy'],
        confidence: 0.95
      });

      const plan = await planner.plan(current, goal);

      expect(plan.fromPattern).toBe(true);
      expect(plan.actions).toEqual(['build', 'test', 'deploy']);
      expect(neuralEngine.retrievePattern).toHaveBeenCalled();
    });

    it('should fall back to A* when no pattern matches', async () => {
      const current = new State({ code: 'ready' });
      const goal = new State({ deployed: true });

      neuralEngine.retrievePattern.mockResolvedValue(null);

      const plan = await planner.plan(current, goal);

      expect(plan.fromPattern).toBe(false);
      expect(plan.fromAStar).toBe(true);
      expect(plan.actions.length).toBeGreaterThan(0);
    });

    it('should reject low-confidence patterns', async () => {
      const current = new State({ code: 'ready' });
      const goal = new State({ deployed: true });

      neuralEngine.retrievePattern.mockResolvedValue({
        id: 'pattern-2',
        actions: ['risky', 'approach'],
        confidence: 0.4
      });

      const plan = await planner.plan(current, goal);

      expect(plan.fromPattern).toBe(false);
      expect(plan.fromAStar).toBe(true);
    });

    it('should adapt patterns to current context', async () => {
      const current = new State({ code: 'ready', env: 'staging' });
      const goal = new State({ deployed: true });

      neuralEngine.retrievePattern.mockResolvedValue({
        id: 'pattern-3',
        actions: ['build', 'test', 'deploy'],
        conditions: { env: 'production' },
        confidence: 0.9
      });

      const plan = await planner.plan(current, goal);

      expect(plan.adapted).toBe(true);
      expect(plan.actions).toContain('configure_staging');
    });
  });

  describe('A* Search with Learned Heuristics', () => {
    it('should use learned heuristics for faster planning', async () => {
      const current = new State({ task: 'start' });
      const goal = new State({ task: 'complete' });

      // Mock learned heuristic data
      neuralEngine.retrievePattern.mockResolvedValue({
        heuristics: {
          'start→intermediate': 5,
          'intermediate→complete': 3
        }
      });

      const startTime = Date.now();
      const plan = await planner.plan(current, goal);
      const duration = Date.now() - startTime;

      expect(plan).toBeDefined();
      expect(duration).toBeLessThan(100); // Fast with heuristics
    });

    it('should expand fewer nodes with good heuristics', async () => {
      const current = new State({ pos: 0 });
      const goal = new State({ pos: 10 });

      neuralEngine.retrievePattern.mockResolvedValue({
        heuristics: { optimal_path: [1, 3, 5, 7, 9, 10] }
      });

      const plan = await planner.plan(current, goal);

      expect(plan.nodesExpanded).toBeLessThan(20);
    });

    it('should handle admissible heuristics correctly', async () => {
      const current = new State({ x: 0, y: 0 });
      const goal = new State({ x: 5, y: 5 });

      const plan = await planner.plan(current, goal);

      expect(plan.cost).toBeGreaterThanOrEqual(plan.estimatedCost || 0);
    });
  });

  describe('Pattern Learning from Successful Plans', () => {
    it('should store successful A* plans as patterns', async () => {
      const current = new State({ state: 'A' });
      const goal = new State({ state: 'Z' });

      neuralEngine.retrievePattern.mockResolvedValue(null);

      const plan = await planner.plan(current, goal);

      expect(plan.fromAStar).toBe(true);

      await planner.learnFromPlan(plan, { success: true, duration: 1000 });

      expect(neuralEngine.storePattern).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: plan.actions,
          confidence: expect.any(Number)
        })
      );
    });

    it('should update pattern confidence on subsequent uses', async () => {
      const current = new State({ task: 'deploy' });
      const goal = new State({ deployed: true });

      neuralEngine.retrievePattern.mockResolvedValue({
        id: 'pattern-4',
        actions: ['build', 'test', 'deploy'],
        confidence: 0.7
      });

      const plan = await planner.plan(current, goal);

      await planner.learnFromPlan(plan, { success: true, duration: 800 });

      expect(neuralEngine.updateConfidence).toHaveBeenCalledWith(
        'pattern-4',
        expect.any(Number)
      );
    });

    it('should decrease confidence on failures', async () => {
      const current = new State({ task: 'migrate' });
      const goal = new State({ migrated: true });

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

      expect(neuralEngine.updateConfidence).toHaveBeenCalledWith(
        'pattern-5',
        expect.lessThan(0.8)
      );
    });
  });

  describe('Dynamic Replanning (OODA Loop)', () => {
    it('should detect when plan execution deviates', async () => {
      const current = new State({ progress: 0.5, error: true });
      const goal = new State({ progress: 1.0 });

      const originalPlan = {
        actions: ['step1', 'step2', 'step3'],
        currentStep: 1
      };

      const shouldReplan = planner.shouldReplan(originalPlan, current);

      expect(shouldReplan).toBe(true);
    });

    it('should replan when obstacles encountered', async () => {
      const current = new State({ path: 'blocked' });
      const goal = new State({ destination: 'reached' });

      neuralEngine.retrievePattern.mockResolvedValue({
        id: 'pattern-6',
        actions: ['forward', 'forward'],
        confidence: 0.9
      });

      const plan = await planner.plan(current, goal);

      // Simulate obstacle
      current.set('obstacle', true);

      const replan = await planner.replan(plan, current, goal);

      expect(replan.actions).not.toEqual(plan.actions);
      expect(replan.replanned).toBe(true);
    });

    it('should maintain plan history', async () => {
      const current = new State({ step: 0 });
      const goal = new State({ step: 10 });

      const plan1 = await planner.plan(current, goal);

      current.set('step', 5);
      const plan2 = await planner.replan(plan1, current, goal);

      expect(planner.planHistory).toHaveLength(2);
      expect(planner.planHistory[0]).toBe(plan1);
      expect(planner.planHistory[1]).toBe(plan2);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate action costs', () => {
      const action = new Action('deploy', { duration: 1000, complexity: 5 });

      const cost = planner.calculateCost(action);

      expect(cost).toBeGreaterThan(0);
    });

    it('should apply learned cost adjustments', async () => {
      neuralEngine.retrievePattern.mockResolvedValue({
        costAdjustments: {
          'slow_action': 1.5,
          'fast_action': 0.7
        }
      });

      const slowAction = new Action('slow_action');
      const fastAction = new Action('fast_action');

      await planner.loadCostAdjustments();

      const slowCost = planner.calculateCost(slowAction);
      const fastCost = planner.calculateCost(fastAction);

      expect(slowCost).toBeGreaterThan(fastCost);
    });
  });

  describe('State Space Exploration', () => {
    it('should explore state space efficiently', async () => {
      const current = new State({ value: 0 });
      const goal = new State({ value: 100 });

      const plan = await planner.plan(current, goal);

      expect(plan.nodesExpanded).toBeLessThan(1000);
    });

    it('should handle large state spaces', async () => {
      const current = new State({
        x: 0,
        y: 0,
        inventory: [],
        health: 100
      });
      const goal = new State({ x: 10, y: 10, item_collected: true });

      const plan = await planner.plan(current, goal);

      expect(plan).toBeDefined();
      expect(plan.actions.length).toBeGreaterThan(0);
    });

    it('should prune impossible branches', async () => {
      const current = new State({ resources: 10 });
      const goal = new State({ built: 'castle' }); // Requires 1000 resources

      const plan = await planner.plan(current, goal);

      expect(plan.feasible).toBe(false);
    });
  });

  describe('Goal Prioritization', () => {
    it('should handle multiple goals', async () => {
      const current = new State({ tasks: [] });
      const goals = [
        new State({ task1: 'done', priority: 10 }),
        new State({ task2: 'done', priority: 5 }),
        new State({ task3: 'done', priority: 8 })
      ];

      const plans = await planner.planMultipleGoals(current, goals);

      expect(plans[0].goal.get('priority')).toBe(10);
    });

    it('should optimize for goal combinations', async () => {
      const current = new State({ pos: 'A' });
      const goals = [
        new State({ visited: 'B' }),
        new State({ visited: 'C' }),
        new State({ visited: 'D' })
      ];

      const combinedPlan = await planner.optimizeCombinedGoals(current, goals);

      expect(combinedPlan.cost).toBeLessThan(
        goals.length * 10 // Individual costs
      );
    });
  });

  describe('Performance', () => {
    it('should plan quickly for simple goals', async () => {
      const current = new State({ ready: true });
      const goal = new State({ complete: true });

      const start = Date.now();
      await planner.plan(current, goal);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should plan within time budget for complex goals', async () => {
      const current = new State({ phase: 'start' });
      const goal = new State({ phase: 'end', steps: 20 });

      const plan = await planner.plan(current, goal, {
        timeout: 5000
      });

      expect(plan).toBeDefined();
      expect(plan.timedOut).toBe(false);
    });

    it('should cache frequent plans', async () => {
      const current = new State({ task: 'frequent' });
      const goal = new State({ done: true });

      // First call
      const start1 = Date.now();
      await planner.plan(current, goal);
      const duration1 = Date.now() - start1;

      // Second call (should use cache)
      const start2 = Date.now();
      await planner.plan(current, goal);
      const duration2 = Date.now() - start2;

      expect(duration2).toBeLessThan(duration1 * 0.5);
    });
  });

  describe('Error Handling', () => {
    it('should handle impossible goals', async () => {
      const current = new State({ canFly: false });
      const goal = new State({ altitude: 1000 }); // Impossible

      const plan = await planner.plan(current, goal);

      expect(plan.feasible).toBe(false);
      expect(plan.error).toContain('impossible');
    });

    it('should handle cycles in state space', async () => {
      const current = new State({ node: 'A' });
      const goal = new State({ node: 'A' }); // Same state

      const plan = await planner.plan(current, goal);

      expect(plan.actions).toHaveLength(0);
      expect(plan.alreadyAtGoal).toBe(true);
    });

    it('should timeout on very large searches', async () => {
      const current = new State({ huge: 'space' });
      const goal = new State({ needle: 'haystack' });

      const plan = await planner.plan(current, goal, {
        timeout: 100
      });

      expect(plan.timedOut).toBe(true);
    });
  });
});
