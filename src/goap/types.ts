/**
 * GOAP Type Definitions
 * Type system for Goal-Oriented Action Planning with Neural Integration
 */

/**
 * World state representation
 * Maps state variables to their current values
 */
export interface WorldState {
  [key: string]: string | number | boolean;
}

/**
 * Goal state representation
 * Defines the desired state to achieve
 */
export interface GoalState {
  [key: string]: string | number | boolean;
}

/**
 * Action preconditions and effects
 */
export interface Action {
  id: string;
  name: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';

  // Preconditions required for action execution
  preconditions: WorldState;

  // Effects on world state after execution
  effects: WorldState;

  // Cost parameters
  cost: {
    development_hours: number;
    complexity: 'low' | 'medium' | 'high' | 'critical';
    risk: 'low' | 'medium' | 'high' | 'critical';
    total_cost?: number;
  };

  // Value assessment
  value: {
    blocks?: string[];  // Actions blocked by this action
    unblocks?: string[]; // Actions unblocked by this action
    enables_learning?: boolean;
    foundation_layer?: boolean;
  };

  // Implementation details
  implementation?: string[];
  testing?: string[];

  // Execution metadata
  metadata?: {
    executed?: boolean;
    success_rate?: number;
    actual_cost?: number;
    execution_time?: number;
  };
}

/**
 * Plan representation - sequence of actions
 */
export interface Plan {
  id: string;
  actions: Action[];
  total_cost: number;
  estimated_time: number;
  success_rate?: number;
  confidence?: number;
  created_at: string;
  context: PlanContext;
}

/**
 * Context for plan creation
 */
export interface PlanContext {
  current_state: WorldState;
  goal_state: GoalState;
  constraints?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Stored pattern for learned planning
 */
export interface GOAPPattern {
  id: string;
  type: 'action_sequence' | 'goal_achievement' | 'heuristic' | 'cost_estimate';

  // Context matching
  context: {
    goal_state: GoalState;
    current_state: WorldState;
    constraints?: Record<string, any>;
  };

  // Action sequence data
  action_sequence?: {
    actions: string[];  // Action IDs
    total_cost: number;
    success_rate: number;
    conditions?: string;  // When to apply this pattern
  };

  // Learning metrics
  learning_metrics: {
    times_used: number;
    success_count: number;
    average_cost: number;
    cost_variance: number;
    confidence: number;  // 0.0 - 1.0
  };

  // Pattern metadata
  created_at: string;
  last_used?: string;
  generalization_level: 'specific' | 'moderate' | 'general';

  // Neural storage
  pattern_data: string;  // JSON serialized data
}

/**
 * A* search node
 */
export interface SearchNode {
  state: WorldState;
  action?: Action;
  parent?: SearchNode;
  g_cost: number;  // Cost from start
  h_cost: number;  // Heuristic cost to goal
  f_cost: number;  // Total cost (g + h)
}

/**
 * Heuristic function type
 */
export type HeuristicFunction = (state: WorldState, goal: GoalState) => number;

/**
 * Pattern match result
 */
export interface PatternMatch {
  pattern: GOAPPattern;
  similarity: number;
  applicable: boolean;
  adaptation_required: boolean;
  confidence: number;
}

/**
 * Plan execution outcome
 */
export interface ExecutionOutcome {
  plan_id: string;
  success: boolean;
  actual_cost: number;
  estimated_cost: number;
  cost_variance: number;
  achieved_goal: boolean;
  execution_time: number;
  errors?: string[];
  lessons_learned?: string[];
}

/**
 * Learning update
 */
export interface LearningUpdate {
  pattern_id: string;
  outcome: ExecutionOutcome;
  confidence_adjustment: number;
  cost_adjustment: number;
  success_rate_update: number;
  timestamp: string;
}

/**
 * Configuration for GOAP planner
 */
export interface GOAPConfig {
  enable_pattern_learning: boolean;
  pattern_match_threshold: number;  // 0.0 - 1.0
  max_search_depth: number;
  timeout_ms: number;
  risk_factors: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  heuristic_weights: Record<string, number>;
  enable_replanning: boolean;
  replan_threshold: number;  // Cost variance threshold for replanning
}

/**
 * Replanning trigger
 */
export interface ReplanTrigger {
  type: 'failure' | 'excessive_cost' | 'new_requirements' | 'better_path';
  reason: string;
  current_state: WorldState;
  original_plan: Plan;
  cost_overrun?: number;
  timestamp: string;
}

/**
 * GOAP statistics
 */
export interface GOAPStats {
  total_plans_generated: number;
  pattern_based_plans: number;
  a_star_plans: number;
  average_planning_time_ms: number;
  pattern_reuse_rate: number;
  average_plan_quality: number;
  replanning_rate: number;
}

/**
 * Pattern library statistics
 */
export interface PatternLibraryStats {
  total_patterns: number;
  patterns_by_type: Record<string, number>;
  average_confidence: number;
  average_usage: number;
  high_confidence_patterns: number;  // confidence > 0.8
  low_usage_patterns: number;  // used < 3 times
}

// ============================================================================
// Type Aliases for Backward Compatibility
// ============================================================================

export type State = WorldState;
export type Heuristic = HeuristicFunction;
// Note: GOAPPlanner implementation is in neural-integration.ts as NeuralGOAPPlanner
export type GOAPPlanner = any;
