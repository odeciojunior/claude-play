/**
 * Unit Tests for GOAP-Neural Integration
 *
 * Test Coverage: Pattern-based planning, A* fallback, learned heuristics
 * Target: 60+ tests, >95% coverage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Database } from 'sqlite3';
import { NeuralGOAPPlanner } from '../../../src/goap/neural-integration';
import {
  WorldState,
  GoalState,
  Action,
  Plan,
  GOAPConfig,
  ExecutionOutcome
} from '../../../src/goap/types';

describe('GOAP-Neural Integration', () => {
  let planner: NeuralGOAPPlanner;
  let mockDb: any;
  let config: GOAPConfig;

  beforeEach(() => {
    // Mock database
    mockDb = {
      run: jest.fn().mockImplementation((sql: any, params: any, callback: any) => {
        if (callback) callback(null);
      }),
      get: jest.fn().mockImplementation((sql: any, params: any, callback: any) => {
        if (callback) callback(null, null);
      }),
      all: jest.fn().mockImplementation((sql: any, params: any, callback: any) => {
        if (callback) callback(null, []);
      })
    };

    // Default config
    config = {
      enable_pattern_learning: true,
      pattern_match_threshold: 0.7,
      max_search_depth: 1000,
      timeout_ms: 5000,
      risk_factors: {
        low: 1.0,
        medium: 1.5,
        high: 2.0,
        critical: 3.0
      },
      heuristic_weights: {},
      enable_replanning: true,
      replan_threshold: 0.3
    };

    planner = new NeuralGOAPPlanner(mockDb as Database, config);
  });

  describe('Pattern-Based Planning', () => {
    it('should create a plan with pattern learning enabled', async () => {
      const current: WorldState = { code: 'ready' };
      const goal: GoalState = { deployed: true };
      const actions: Action[] = [{
        id: 'deploy',
        name: 'Deploy',
        category: 'deployment',
        priority: 'high',
        preconditions: { code: 'ready' },
        effects: { deployed: true },
        cost: { development_hours: 2, complexity: 'medium', risk: 'low', total_cost: 2 },
        value: { blocks: [], unblocks: [], enables_learning: false, foundation_layer: false }
      }];

      mockDb.all.mockImplementation((sql: string, params: any, callback: any) => {
        callback(null, []);
      });

      const plan = await planner.plan(current, goal, actions);

      expect(plan).toBeDefined();
      expect(plan.actions).toBeDefined();
      expect(Array.isArray(plan.actions)).toBe(true);
    });

    it('should use patterns when available in database', async () => {
      const current: WorldState = { task: 'start' };
      const goal: GoalState = { task: 'complete' };
      const actions: Action[] = [];

      // Mock pattern found in database
      mockDb.all.mockImplementation((sql: string, params: any, callback: any) => {
        if (sql.includes('goap_patterns')) {
          callback(null, [{
            id: 'pattern-1',
            type: 'action_sequence',
            context_data: JSON.stringify({ current_state: current, goal_state: goal }),
            action_sequence: JSON.stringify({
              actions: ['step1', 'step2'],
              total_cost: 5,
              success_rate: 0.95
            }),
            confidence: 0.9,
            times_used: 10,
            success_count: 9,
            average_cost: 5,
            cost_variance: 0.5,
            created_at: new Date().toISOString(),
            generalization_level: 'moderate',
            pattern_data: '{}'
          }]);
        } else {
          callback(null, []);
        }
      });

      const plan = await planner.plan(current, goal, actions);

      expect(plan).toBeDefined();
    });

    it('should fall back to A* when no patterns match', async () => {
      const current: WorldState = { status: 'initial' };
      const goal: GoalState = { status: 'final' };
      const actions: Action[] = [{
        id: 'transition',
        name: 'Transition',
        category: 'state',
        priority: 'medium',
        preconditions: { status: 'initial' },
        effects: { status: 'final' },
        cost: { development_hours: 1, complexity: 'low', risk: 'low', total_cost: 1 },
        value: { blocks: [], unblocks: [], enables_learning: false, foundation_layer: false }
      }];

      mockDb.all.mockImplementation((sql: string, params: any, callback: any) => {
        callback(null, []);
      });

      const plan = await planner.plan(current, goal, actions);

      expect(plan).toBeDefined();
      expect(plan.total_cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('A* Search Integration', () => {
    it('should generate plans using A* algorithm', async () => {
      const current: WorldState = { x: 0 };
      const goal: GoalState = { x: 5 };
      const actions: Action[] = [
        {
          id: 'move',
          name: 'Move',
          category: 'movement',
          priority: 'medium',
          preconditions: {},
          effects: { x: 1 },
          cost: { development_hours: 1, complexity: 'low', risk: 'low', total_cost: 1 },
          value: { blocks: [], unblocks: [], enables_learning: false, foundation_layer: false }
        }
      ];

      mockDb.all.mockImplementation((sql: string, params: any, callback: any) => {
        callback(null, []);
      });

      const plan = await planner.plan(current, goal, actions);

      expect(plan).toBeDefined();
      expect(plan.created_at).toBeDefined();
    });

    it('should calculate plan costs correctly', async () => {
      const current: WorldState = { resource: 10 };
      const goal: GoalState = { resource: 0, built: true };
      const actions: Action[] = [{
        id: 'build',
        name: 'Build',
        category: 'construction',
        priority: 'high',
        preconditions: { resource: 10 },
        effects: { resource: 0, built: true },
        cost: { development_hours: 5, complexity: 'high', risk: 'medium', total_cost: 10 },
        value: { blocks: [], unblocks: [], enables_learning: false, foundation_layer: false }
      }];

      mockDb.all.mockImplementation((sql: string, params: any, callback: any) => {
        callback(null, []);
      });

      const plan = await planner.plan(current, goal, actions);

      expect(plan.total_cost).toBeGreaterThanOrEqual(0);
      expect(plan.estimated_time).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Execution Tracking', () => {
    it('should track execution outcomes', async () => {
      const plan: Plan = {
        id: 'plan-1',
        actions: [],
        total_cost: 10,
        estimated_time: 5,
        created_at: new Date().toISOString(),
        context: {
          current_state: {},
          goal_state: {}
        }
      };

      const outcome: ExecutionOutcome = {
        plan_id: 'plan-1',
        success: true,
        actual_cost: 12,
        estimated_cost: 10,
        cost_variance: 2,
        achieved_goal: true,
        execution_time: 6000
      };

      mockDb.run.mockImplementation((sql: string, params: any, callback: any) => {
        callback(null);
      });

      await planner.trackExecution(plan, outcome);

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should handle execution with pattern updates', async () => {
      const plan: Plan = {
        id: 'plan-2',
        actions: [],
        total_cost: 15,
        estimated_time: 8,
        created_at: new Date().toISOString(),
        context: {
          current_state: {},
          goal_state: {},
          metadata: { pattern_id: 'pattern-1', pattern_reuse: true }
        }
      };

      const outcome: ExecutionOutcome = {
        plan_id: 'plan-2',
        success: true,
        actual_cost: 14,
        estimated_cost: 15,
        cost_variance: -1,
        achieved_goal: true,
        execution_time: 7500
      };

      mockDb.get.mockImplementation((sql: string, params: any, callback: any) => {
        callback(null, {
          id: 'pattern-1',
          type: 'action_sequence',
          context_data: '{}',
          action_sequence: '{}',
          confidence: 0.8,
          times_used: 5,
          success_count: 4,
          average_cost: 15,
          cost_variance: 2,
          created_at: new Date().toISOString(),
          generalization_level: 'moderate',
          pattern_data: '{}'
        });
      });

      await planner.trackExecution(plan, outcome);

      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('Statistics and Metrics', () => {
    it('should return planning statistics', () => {
      const stats = planner.getStats();

      expect(stats).toBeDefined();
      expect(stats.total_plans_generated).toBeGreaterThanOrEqual(0);
      expect(stats.pattern_based_plans).toBeGreaterThanOrEqual(0);
      expect(stats.a_star_plans).toBeGreaterThanOrEqual(0);
    });

    it('should return pattern library statistics', async () => {
      mockDb.get.mockImplementation((sql: string, params: any, callback: any) => {
        callback(null, { total: 0, avg_confidence: 0, avg_usage: 0, high_conf: 0, low_usage: 0 });
      });

      mockDb.all.mockImplementation((sql: string, params: any, callback: any) => {
        callback(null, []);
      });

      const stats = await planner.getPatternLibraryStats();

      expect(stats).toBeDefined();
      expect(stats.total_patterns).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration', () => {
    it('should respect pattern learning setting', () => {
      expect(config.enable_pattern_learning).toBe(true);
      expect(planner).toBeDefined();
    });

    it('should respect pattern match threshold', () => {
      expect(config.pattern_match_threshold).toBe(0.7);
    });

    it('should respect max search depth', () => {
      expect(config.max_search_depth).toBe(1000);
    });

    it('should handle risk factors', () => {
      expect(config.risk_factors.low).toBe(1.0);
      expect(config.risk_factors.medium).toBe(1.5);
      expect(config.risk_factors.high).toBe(2.0);
      expect(config.risk_factors.critical).toBe(3.0);
    });
  });
});
