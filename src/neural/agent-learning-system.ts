/**
 * Agent Learning System - Enable Learning for All 78 Agents
 *
 * This module provides the infrastructure for distributed learning across
 * all agents in the swarm, with category-specific pattern libraries,
 * cross-agent sharing, and intelligent specialization.
 *
 * Features:
 * - 78 agent learning capabilities
 * - 20 category-specific pattern libraries
 * - Cross-agent pattern sharing
 * - Agent specialization tracking
 * - Learning metrics and analytics
 * - Hive-mind integration
 */

import { Database } from 'sqlite3';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import * as zlib from 'zlib';
import { Pattern, PatternType, ExecutionContext } from './pattern-extraction';
import LearningPipeline, { Outcome, PatternApplication } from './learning-pipeline';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AgentProfile {
  id: string;
  name: string;
  type: AgentType;
  category: AgentCategory;
  capabilities: string[];
  specializations: string[];
  learningEnabled: boolean;
  learningRate: number;
  confidenceThreshold: number;
  patternLibraryId: string;
}

export type AgentType =
  | 'developer' | 'validator' | 'coordinator' | 'analyst'
  | 'optimizer' | 'specialist' | 'planner' | 'researcher';

export type AgentCategory =
  | 'core' | 'sparc' | 'reasoning' | 'swarm' | 'consensus'
  | 'architecture' | 'testing' | 'analysis' | 'optimization'
  | 'devops' | 'github' | 'documentation' | 'data' | 'development'
  | 'templates' | 'specialized' | 'goal' | 'neural' | 'hive-mind' | 'flow-nexus';

export interface CategoryPatternLibrary {
  categoryId: AgentCategory;
  patterns: Pattern[];
  sharedPatterns: Pattern[];
  categorySpecificPatterns: Pattern[];
  agentContributions: Map<string, number>;
  totalPatterns: number;
  avgConfidence: number;
  createdAt: string;
  lastUpdated: string;
}

export interface AgentLearningMetrics {
  agentId: string;
  patternsLearned: number;
  patternsShared: number;
  patternsUsed: number;
  successRate: number;
  avgConfidence: number;
  specializations: string[];
  contributions: number;
  reliability: number;
  lastActive: string;
}

export interface CrossAgentPattern {
  id: string;
  sourceAgentId: string;
  sourceCategory: AgentCategory;
  pattern: Pattern;
  applicableCategories: AgentCategory[];
  usageCount: Map<string, number>;
  successByAgent: Map<string, number>;
  generalizability: number;
  createdAt: string;
}

export interface LearningConfig {
  agentId: string;
  enabled: boolean;
  learningRate: number;
  confidenceThreshold: number;
  maxPatternsPerCategory: number;
  sharingEnabled: boolean;
  specializationTracking: boolean;
  autoAdaptation: boolean;
}

// ============================================================================
// Agent Registry - All 78 Agents
// ============================================================================

export const AGENT_REGISTRY: Record<string, AgentProfile> = {
  // Core Development (5)
  'coder': {
    id: 'coder',
    name: 'Coder',
    type: 'developer',
    category: 'core',
    capabilities: ['code_generation', 'refactoring', 'optimization'],
    specializations: ['implementation', 'api_design'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'core_dev_patterns'
  },
  'reviewer': {
    id: 'reviewer',
    name: 'Reviewer',
    type: 'validator',
    category: 'core',
    capabilities: ['code_review', 'security_audit', 'performance_analysis'],
    specializations: ['quality_assurance', 'best_practices'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.75,
    patternLibraryId: 'core_dev_patterns'
  },
  'tester': {
    id: 'tester',
    name: 'Tester',
    type: 'validator',
    category: 'core',
    capabilities: ['unit_testing', 'integration_testing', 'e2e_testing'],
    specializations: ['tdd', 'test_automation'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'core_dev_patterns'
  },
  'planner': {
    id: 'planner',
    name: 'Planner',
    type: 'coordinator',
    category: 'core',
    capabilities: ['task_decomposition', 'dependency_analysis', 'resource_allocation'],
    specializations: ['strategic_planning', 'risk_assessment'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'core_dev_patterns'
  },
  'researcher': {
    id: 'researcher',
    name: 'Researcher',
    type: 'analyst',
    category: 'core',
    capabilities: ['code_analysis', 'pattern_recognition', 'knowledge_synthesis'],
    specializations: ['research', 'documentation'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'core_dev_patterns'
  },

  // SPARC Methodology (6)
  'sparc-coder': {
    id: 'sparc-coder',
    name: 'SPARC Coder',
    type: 'developer',
    category: 'sparc',
    capabilities: ['tdd', 'sparc_methodology', 'iterative_development'],
    specializations: ['specification', 'architecture', 'refinement'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.75,
    patternLibraryId: 'sparc_patterns'
  },
  'specification': {
    id: 'specification',
    name: 'Specification',
    type: 'planner',
    category: 'sparc',
    capabilities: ['requirements', 'acceptance_criteria', 'test_scenarios'],
    specializations: ['sparc_phase_1'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'sparc_patterns'
  },
  'pseudocode': {
    id: 'pseudocode',
    name: 'Pseudocode',
    type: 'planner',
    category: 'sparc',
    capabilities: ['algorithm_design', 'logic_flow'],
    specializations: ['sparc_phase_2'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'sparc_patterns'
  },
  'architecture': {
    id: 'architecture',
    name: 'Architecture',
    type: 'planner',
    category: 'sparc',
    capabilities: ['system_design', 'component_design', 'integration_planning'],
    specializations: ['sparc_phase_3'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'sparc_patterns'
  },
  'refinement': {
    id: 'refinement',
    name: 'Refinement',
    type: 'developer',
    category: 'sparc',
    capabilities: ['iterative_development', 'tdd_cycles', 'optimization'],
    specializations: ['sparc_phase_4'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.7,
    patternLibraryId: 'sparc_patterns'
  },
  'completion': {
    id: 'completion',
    name: 'Completion',
    type: 'validator',
    category: 'sparc',
    capabilities: ['validation', 'deployment', 'documentation'],
    specializations: ['sparc_phase_5'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.8,
    patternLibraryId: 'sparc_patterns'
  },

  // Swarm Coordination (8)
  'queen-coordinator': {
    id: 'queen-coordinator',
    name: 'Queen Coordinator',
    type: 'coordinator',
    category: 'swarm',
    capabilities: ['swarm_coordination', 'strategic_planning', 'resource_allocation'],
    specializations: ['hive_orchestration', 'worker_delegation'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.8,
    patternLibraryId: 'swarm_patterns'
  },
  'hierarchical-coordinator': {
    id: 'hierarchical-coordinator',
    name: 'Hierarchical Coordinator',
    type: 'coordinator',
    category: 'swarm',
    capabilities: ['hierarchical_coordination', 'task_delegation', 'supervision'],
    specializations: ['command_chain', 'worker_management'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'swarm_patterns'
  },
  'mesh-coordinator': {
    id: 'mesh-coordinator',
    name: 'Mesh Coordinator',
    type: 'coordinator',
    category: 'swarm',
    capabilities: ['peer_coordination', 'distributed_consensus', 'mesh_networking'],
    specializations: ['p2p_coordination'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'swarm_patterns'
  },
  'adaptive-coordinator': {
    id: 'adaptive-coordinator',
    name: 'Adaptive Coordinator',
    type: 'coordinator',
    category: 'swarm',
    capabilities: ['adaptive_coordination', 'dynamic_replanning', 'load_balancing'],
    specializations: ['adaptive_strategies'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.7,
    patternLibraryId: 'swarm_patterns'
  },
  'ring-coordinator': {
    id: 'ring-coordinator',
    name: 'Ring Coordinator',
    type: 'coordinator',
    category: 'swarm',
    capabilities: ['ring_topology', 'sequential_processing', 'circular_coordination'],
    specializations: ['ring_management'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'swarm_patterns'
  },
  'star-coordinator': {
    id: 'star-coordinator',
    name: 'Star Coordinator',
    type: 'coordinator',
    category: 'swarm',
    capabilities: ['centralized_coordination', 'hub_management'],
    specializations: ['star_topology'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'swarm_patterns'
  },
  'worker': {
    id: 'worker',
    name: 'Worker',
    type: 'specialist',
    category: 'swarm',
    capabilities: ['task_execution', 'specialized_work'],
    specializations: ['execution'],
    learningEnabled: true,
    learningRate: 0.1,
    confidenceThreshold: 0.65,
    patternLibraryId: 'swarm_patterns'
  },
  'monitor': {
    id: 'monitor',
    name: 'Monitor',
    type: 'analyst',
    category: 'swarm',
    capabilities: ['monitoring', 'metrics_collection', 'health_checks'],
    specializations: ['observation'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'swarm_patterns'
  },

  // Goal Planning (2)
  'goal-planner': {
    id: 'goal-planner',
    name: 'Goal Planner',
    type: 'planner',
    category: 'goal',
    capabilities: ['goap', 'a_star_search', 'action_sequencing'],
    specializations: ['goal_planning', 'optimal_paths'],
    learningEnabled: true,
    learningRate: 0.25,
    confidenceThreshold: 0.8,
    patternLibraryId: 'goal_patterns'
  },
  'code-goal-planner': {
    id: 'code-goal-planner',
    name: 'Code Goal Planner',
    type: 'planner',
    category: 'goal',
    capabilities: ['goap', 'sparc_integration', 'development_planning'],
    specializations: ['code_planning', 'tdd_planning'],
    learningEnabled: true,
    learningRate: 0.25,
    confidenceThreshold: 0.8,
    patternLibraryId: 'goal_patterns'
  },

  // Neural Agents (2)
  'safla-neural': {
    id: 'safla-neural',
    name: 'SAFLA Neural',
    type: 'specialist',
    category: 'neural',
    capabilities: ['neural_learning', 'pattern_extraction', 'self_improvement'],
    specializations: ['safla', 'four_tier_memory', 'feedback_loops'],
    learningEnabled: true,
    learningRate: 0.3,
    confidenceThreshold: 0.75,
    patternLibraryId: 'neural_patterns'
  },
  'neural-specialist': {
    id: 'neural-specialist',
    name: 'Neural Specialist',
    type: 'specialist',
    category: 'neural',
    capabilities: ['neural_networks', 'training', 'optimization'],
    specializations: ['ml_systems'],
    learningEnabled: true,
    learningRate: 0.25,
    confidenceThreshold: 0.75,
    patternLibraryId: 'neural_patterns'
  },

  // Testing (6)
  'tdd-specialist': {
    id: 'tdd-specialist',
    name: 'TDD Specialist',
    type: 'validator',
    category: 'testing',
    capabilities: ['tdd', 'unit_tests', 'test_first'],
    specializations: ['test_driven_development'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.75,
    patternLibraryId: 'testing_patterns'
  },
  'integration-tester': {
    id: 'integration-tester',
    name: 'Integration Tester',
    type: 'validator',
    category: 'testing',
    capabilities: ['integration_testing', 'api_testing'],
    specializations: ['integration'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'testing_patterns'
  },
  'e2e-tester': {
    id: 'e2e-tester',
    name: 'E2E Tester',
    type: 'validator',
    category: 'testing',
    capabilities: ['e2e_testing', 'ui_testing', 'workflow_testing'],
    specializations: ['end_to_end'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'testing_patterns'
  },
  'performance-tester': {
    id: 'performance-tester',
    name: 'Performance Tester',
    type: 'validator',
    category: 'testing',
    capabilities: ['performance_testing', 'load_testing', 'benchmarking'],
    specializations: ['performance'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'testing_patterns'
  },
  'security-tester': {
    id: 'security-tester',
    name: 'Security Tester',
    type: 'validator',
    category: 'testing',
    capabilities: ['security_testing', 'vulnerability_scanning'],
    specializations: ['security'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.8,
    patternLibraryId: 'testing_patterns'
  },
  'production-validator': {
    id: 'production-validator',
    name: 'Production Validator',
    type: 'validator',
    category: 'testing',
    capabilities: ['production_validation', 'deployment_verification'],
    specializations: ['production_readiness'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.85,
    patternLibraryId: 'testing_patterns'
  },

  // GitHub Integration (9)
  'pr-manager': {
    id: 'pr-manager',
    name: 'PR Manager',
    type: 'coordinator',
    category: 'github',
    capabilities: ['pr_management', 'code_review', 'merge_coordination'],
    specializations: ['pull_requests'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'github_patterns'
  },
  'code-reviewer-github': {
    id: 'code-reviewer-github',
    name: 'GitHub Code Reviewer',
    type: 'validator',
    category: 'github',
    capabilities: ['automated_review', 'pr_analysis'],
    specializations: ['github_reviews'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'github_patterns'
  },
  'issue-manager': {
    id: 'issue-manager',
    name: 'Issue Manager',
    type: 'coordinator',
    category: 'github',
    capabilities: ['issue_tracking', 'triage', 'assignment'],
    specializations: ['issue_management'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'github_patterns'
  },
  'release-coordinator': {
    id: 'release-coordinator',
    name: 'Release Coordinator',
    type: 'coordinator',
    category: 'github',
    capabilities: ['release_management', 'versioning', 'changelog'],
    specializations: ['releases'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.8,
    patternLibraryId: 'github_patterns'
  },
  'workflow-automator': {
    id: 'workflow-automator',
    name: 'Workflow Automator',
    type: 'specialist',
    category: 'github',
    capabilities: ['github_actions', 'ci_cd', 'automation'],
    specializations: ['workflows'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'github_patterns'
  },
  'repo-analyzer': {
    id: 'repo-analyzer',
    name: 'Repo Analyzer',
    type: 'analyst',
    category: 'github',
    capabilities: ['code_analysis', 'metrics', 'quality_analysis'],
    specializations: ['repository_analysis'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'github_patterns'
  },
  'sync-coordinator': {
    id: 'sync-coordinator',
    name: 'Sync Coordinator',
    type: 'coordinator',
    category: 'github',
    capabilities: ['multi_repo_sync', 'coordination'],
    specializations: ['synchronization'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'github_patterns'
  },
  'metrics-collector': {
    id: 'metrics-collector',
    name: 'Metrics Collector',
    type: 'analyst',
    category: 'github',
    capabilities: ['metrics_collection', 'analytics'],
    specializations: ['github_metrics'],
    learningEnabled: true,
    learningRate: 0.1,
    confidenceThreshold: 0.7,
    patternLibraryId: 'github_patterns'
  },
  'security-scanner-github': {
    id: 'security-scanner-github',
    name: 'GitHub Security Scanner',
    type: 'validator',
    category: 'github',
    capabilities: ['security_scanning', 'vulnerability_detection'],
    specializations: ['github_security'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.8,
    patternLibraryId: 'github_patterns'
  },

  // Performance Optimization (5)
  'performance-optimizer': {
    id: 'performance-optimizer',
    name: 'Performance Optimizer',
    type: 'optimizer',
    category: 'optimization',
    capabilities: ['performance_optimization', 'profiling', 'bottleneck_analysis'],
    specializations: ['optimization'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'optimization_patterns'
  },
  'benchmarker': {
    id: 'benchmarker',
    name: 'Benchmarker',
    type: 'analyst',
    category: 'optimization',
    capabilities: ['benchmarking', 'performance_testing'],
    specializations: ['benchmarks'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'optimization_patterns'
  },
  'resource-optimizer': {
    id: 'resource-optimizer',
    name: 'Resource Optimizer',
    type: 'optimizer',
    category: 'optimization',
    capabilities: ['resource_management', 'efficiency'],
    specializations: ['resource_optimization'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'optimization_patterns'
  },
  'cache-optimizer': {
    id: 'cache-optimizer',
    name: 'Cache Optimizer',
    type: 'optimizer',
    category: 'optimization',
    capabilities: ['caching', 'cache_strategy'],
    specializations: ['caching'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'optimization_patterns'
  },
  'monitoring-optimizer': {
    id: 'monitoring-optimizer',
    name: 'Monitoring Optimizer',
    type: 'analyst',
    category: 'optimization',
    capabilities: ['monitoring', 'alerting', 'metrics'],
    specializations: ['observability'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'optimization_patterns'
  },

  // Analysis (5)
  'code-analyzer': {
    id: 'code-analyzer',
    name: 'Code Analyzer',
    type: 'analyst',
    category: 'analysis',
    capabilities: ['code_analysis', 'static_analysis', 'complexity_analysis'],
    specializations: ['code_analysis'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'analysis_patterns'
  },
  'data-analyst': {
    id: 'data-analyst',
    name: 'Data Analyst',
    type: 'analyst',
    category: 'analysis',
    capabilities: ['data_analysis', 'statistics', 'insights'],
    specializations: ['data_analysis'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'analysis_patterns'
  },
  'pattern-analyzer': {
    id: 'pattern-analyzer',
    name: 'Pattern Analyzer',
    type: 'analyst',
    category: 'analysis',
    capabilities: ['pattern_recognition', 'trend_analysis'],
    specializations: ['patterns'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'analysis_patterns'
  },
  'dependency-analyzer': {
    id: 'dependency-analyzer',
    name: 'Dependency Analyzer',
    type: 'analyst',
    category: 'analysis',
    capabilities: ['dependency_analysis', 'graph_analysis'],
    specializations: ['dependencies'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'analysis_patterns'
  },
  'quality-analyst': {
    id: 'quality-analyst',
    name: 'Quality Analyst',
    type: 'analyst',
    category: 'analysis',
    capabilities: ['quality_analysis', 'metrics', 'reporting'],
    specializations: ['quality'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'analysis_patterns'
  },

  // Architecture (7)
  'system-architect': {
    id: 'system-architect',
    name: 'System Architect',
    type: 'planner',
    category: 'architecture',
    capabilities: ['system_design', 'architecture_planning', 'scalability'],
    specializations: ['system_architecture'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.8,
    patternLibraryId: 'architecture_patterns'
  },
  'api-architect': {
    id: 'api-architect',
    name: 'API Architect',
    type: 'planner',
    category: 'architecture',
    capabilities: ['api_design', 'rest', 'graphql'],
    specializations: ['api_architecture'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'architecture_patterns'
  },
  'database-architect': {
    id: 'database-architect',
    name: 'Database Architect',
    type: 'planner',
    category: 'architecture',
    capabilities: ['database_design', 'schema_design', 'optimization'],
    specializations: ['database_architecture'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'architecture_patterns'
  },
  'frontend-architect': {
    id: 'frontend-architect',
    name: 'Frontend Architect',
    type: 'planner',
    category: 'architecture',
    capabilities: ['frontend_design', 'ui_architecture'],
    specializations: ['frontend_architecture'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'architecture_patterns'
  },
  'backend-architect': {
    id: 'backend-architect',
    name: 'Backend Architect',
    type: 'planner',
    category: 'architecture',
    capabilities: ['backend_design', 'service_architecture'],
    specializations: ['backend_architecture'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'architecture_patterns'
  },
  'microservices-architect': {
    id: 'microservices-architect',
    name: 'Microservices Architect',
    type: 'planner',
    category: 'architecture',
    capabilities: ['microservices', 'distributed_systems'],
    specializations: ['microservices_architecture'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.8,
    patternLibraryId: 'architecture_patterns'
  },
  'security-architect': {
    id: 'security-architect',
    name: 'Security Architect',
    type: 'planner',
    category: 'architecture',
    capabilities: ['security_design', 'threat_modeling'],
    specializations: ['security_architecture'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.85,
    patternLibraryId: 'architecture_patterns'
  },

  // DevOps (6)
  'devops-engineer': {
    id: 'devops-engineer',
    name: 'DevOps Engineer',
    type: 'specialist',
    category: 'devops',
    capabilities: ['ci_cd', 'deployment', 'infrastructure'],
    specializations: ['devops'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'devops_patterns'
  },
  'deployment-specialist': {
    id: 'deployment-specialist',
    name: 'Deployment Specialist',
    type: 'specialist',
    category: 'devops',
    capabilities: ['deployment', 'release_automation'],
    specializations: ['deployment'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'devops_patterns'
  },
  'infrastructure-manager': {
    id: 'infrastructure-manager',
    name: 'Infrastructure Manager',
    type: 'coordinator',
    category: 'devops',
    capabilities: ['infrastructure', 'cloud', 'provisioning'],
    specializations: ['infrastructure'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'devops_patterns'
  },
  'container-specialist': {
    id: 'container-specialist',
    name: 'Container Specialist',
    type: 'specialist',
    category: 'devops',
    capabilities: ['docker', 'kubernetes', 'containers'],
    specializations: ['containerization'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'devops_patterns'
  },
  'monitoring-specialist': {
    id: 'monitoring-specialist',
    name: 'Monitoring Specialist',
    type: 'analyst',
    category: 'devops',
    capabilities: ['monitoring', 'logging', 'alerting'],
    specializations: ['observability'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'devops_patterns'
  },
  'sre': {
    id: 'sre',
    name: 'Site Reliability Engineer',
    type: 'specialist',
    category: 'devops',
    capabilities: ['reliability', 'incident_response', 'automation'],
    specializations: ['sre'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.8,
    patternLibraryId: 'devops_patterns'
  },

  // Documentation (4)
  'documentation-writer': {
    id: 'documentation-writer',
    name: 'Documentation Writer',
    type: 'specialist',
    category: 'documentation',
    capabilities: ['documentation', 'technical_writing'],
    specializations: ['docs'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'documentation_patterns'
  },
  'api-documenter': {
    id: 'api-documenter',
    name: 'API Documenter',
    type: 'specialist',
    category: 'documentation',
    capabilities: ['api_documentation', 'openapi', 'swagger'],
    specializations: ['api_docs'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'documentation_patterns'
  },
  'tutorial-creator': {
    id: 'tutorial-creator',
    name: 'Tutorial Creator',
    type: 'specialist',
    category: 'documentation',
    capabilities: ['tutorials', 'guides', 'examples'],
    specializations: ['educational_content'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'documentation_patterns'
  },
  'readme-specialist': {
    id: 'readme-specialist',
    name: 'README Specialist',
    type: 'specialist',
    category: 'documentation',
    capabilities: ['readme', 'getting_started'],
    specializations: ['readme'],
    learningEnabled: true,
    learningRate: 0.1,
    confidenceThreshold: 0.7,
    patternLibraryId: 'documentation_patterns'
  },

  // Data Management (3)
  'data-engineer': {
    id: 'data-engineer',
    name: 'Data Engineer',
    type: 'specialist',
    category: 'data',
    capabilities: ['data_pipelines', 'etl', 'data_processing'],
    specializations: ['data_engineering'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'data_patterns'
  },
  'database-specialist': {
    id: 'database-specialist',
    name: 'Database Specialist',
    type: 'specialist',
    category: 'data',
    capabilities: ['database_management', 'query_optimization'],
    specializations: ['databases'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'data_patterns'
  },
  'migration-specialist': {
    id: 'migration-specialist',
    name: 'Migration Specialist',
    type: 'specialist',
    category: 'data',
    capabilities: ['data_migration', 'schema_migration'],
    specializations: ['migrations'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'data_patterns'
  },

  // Development Specialists (5)
  'frontend-dev': {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    type: 'developer',
    category: 'development',
    capabilities: ['frontend', 'react', 'ui'],
    specializations: ['frontend_development'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'development_patterns'
  },
  'backend-dev': {
    id: 'backend-dev',
    name: 'Backend Developer',
    type: 'developer',
    category: 'development',
    capabilities: ['backend', 'api', 'server'],
    specializations: ['backend_development'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'development_patterns'
  },
  'fullstack-dev': {
    id: 'fullstack-dev',
    name: 'Fullstack Developer',
    type: 'developer',
    category: 'development',
    capabilities: ['fullstack', 'frontend', 'backend'],
    specializations: ['fullstack_development'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'development_patterns'
  },
  'mobile-dev': {
    id: 'mobile-dev',
    name: 'Mobile Developer',
    type: 'developer',
    category: 'development',
    capabilities: ['mobile', 'react_native', 'ios', 'android'],
    specializations: ['mobile_development'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'development_patterns'
  },
  'web3-dev': {
    id: 'web3-dev',
    name: 'Web3 Developer',
    type: 'developer',
    category: 'development',
    capabilities: ['web3', 'blockchain', 'smart_contracts'],
    specializations: ['web3_development'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'development_patterns'
  },

  // Specialized Agents (5)
  'cli-specialist': {
    id: 'cli-specialist',
    name: 'CLI Specialist',
    type: 'specialist',
    category: 'specialized',
    capabilities: ['cli', 'command_line', 'terminal'],
    specializations: ['cli_tools'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'specialized_patterns'
  },
  'regex-specialist': {
    id: 'regex-specialist',
    name: 'Regex Specialist',
    type: 'specialist',
    category: 'specialized',
    capabilities: ['regex', 'pattern_matching'],
    specializations: ['regex'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.75,
    patternLibraryId: 'specialized_patterns'
  },
  'git-specialist': {
    id: 'git-specialist',
    name: 'Git Specialist',
    type: 'specialist',
    category: 'specialized',
    capabilities: ['git', 'version_control'],
    specializations: ['git'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'specialized_patterns'
  },
  'shell-specialist': {
    id: 'shell-specialist',
    name: 'Shell Specialist',
    type: 'specialist',
    category: 'specialized',
    capabilities: ['shell', 'bash', 'scripting'],
    specializations: ['shell_scripting'],
    learningEnabled: true,
    learningRate: 0.12,
    confidenceThreshold: 0.7,
    patternLibraryId: 'specialized_patterns'
  },
  'automation-specialist': {
    id: 'automation-specialist',
    name: 'Automation Specialist',
    type: 'specialist',
    category: 'specialized',
    capabilities: ['automation', 'scripting', 'workflows'],
    specializations: ['automation'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'specialized_patterns'
  },

  // Consensus Agents (7)
  'byzantine-consensus': {
    id: 'byzantine-consensus',
    name: 'Byzantine Consensus',
    type: 'coordinator',
    category: 'consensus',
    capabilities: ['byzantine_fault_tolerance', 'consensus'],
    specializations: ['bft'],
    learningEnabled: true,
    learningRate: 0.2,
    confidenceThreshold: 0.85,
    patternLibraryId: 'consensus_patterns'
  },
  'raft-consensus': {
    id: 'raft-consensus',
    name: 'Raft Consensus',
    type: 'coordinator',
    category: 'consensus',
    capabilities: ['raft', 'leader_election'],
    specializations: ['raft_algorithm'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.8,
    patternLibraryId: 'consensus_patterns'
  },
  'paxos-consensus': {
    id: 'paxos-consensus',
    name: 'Paxos Consensus',
    type: 'coordinator',
    category: 'consensus',
    capabilities: ['paxos', 'distributed_consensus'],
    specializations: ['paxos_algorithm'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.8,
    patternLibraryId: 'consensus_patterns'
  },
  'voting-coordinator': {
    id: 'voting-coordinator',
    name: 'Voting Coordinator',
    type: 'coordinator',
    category: 'consensus',
    capabilities: ['voting', 'decision_making'],
    specializations: ['voting_systems'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'consensus_patterns'
  },
  'quorum-manager': {
    id: 'quorum-manager',
    name: 'Quorum Manager',
    type: 'coordinator',
    category: 'consensus',
    capabilities: ['quorum_management', 'majority_voting'],
    specializations: ['quorum'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'consensus_patterns'
  },
  'leader-election': {
    id: 'leader-election',
    name: 'Leader Election',
    type: 'coordinator',
    category: 'consensus',
    capabilities: ['leader_election', 'election_algorithms'],
    specializations: ['leadership'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'consensus_patterns'
  },
  'conflict-resolver': {
    id: 'conflict-resolver',
    name: 'Conflict Resolver',
    type: 'coordinator',
    category: 'consensus',
    capabilities: ['conflict_resolution', 'merge_strategies'],
    specializations: ['conflict_resolution'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'consensus_patterns'
  },

  // Reasoning Agents (6)
  'convergent-thinker': {
    id: 'convergent-thinker',
    name: 'Convergent Thinker',
    type: 'analyst',
    category: 'reasoning',
    capabilities: ['convergent_thinking', 'problem_solving'],
    specializations: ['convergent_reasoning'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'reasoning_patterns'
  },
  'divergent-thinker': {
    id: 'divergent-thinker',
    name: 'Divergent Thinker',
    type: 'analyst',
    category: 'reasoning',
    capabilities: ['divergent_thinking', 'creativity'],
    specializations: ['divergent_reasoning'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'reasoning_patterns'
  },
  'lateral-thinker': {
    id: 'lateral-thinker',
    name: 'Lateral Thinker',
    type: 'analyst',
    category: 'reasoning',
    capabilities: ['lateral_thinking', 'creative_problem_solving'],
    specializations: ['lateral_reasoning'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.7,
    patternLibraryId: 'reasoning_patterns'
  },
  'systems-thinker': {
    id: 'systems-thinker',
    name: 'Systems Thinker',
    type: 'analyst',
    category: 'reasoning',
    capabilities: ['systems_thinking', 'holistic_analysis'],
    specializations: ['systems_reasoning'],
    learningEnabled: true,
    learningRate: 0.18,
    confidenceThreshold: 0.75,
    patternLibraryId: 'reasoning_patterns'
  },
  'critical-thinker': {
    id: 'critical-thinker',
    name: 'Critical Thinker',
    type: 'analyst',
    category: 'reasoning',
    capabilities: ['critical_thinking', 'evaluation'],
    specializations: ['critical_reasoning'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'reasoning_patterns'
  },
  'abstract-thinker': {
    id: 'abstract-thinker',
    name: 'Abstract Thinker',
    type: 'analyst',
    category: 'reasoning',
    capabilities: ['abstract_thinking', 'conceptual_analysis'],
    specializations: ['abstract_reasoning'],
    learningEnabled: true,
    learningRate: 0.15,
    confidenceThreshold: 0.75,
    patternLibraryId: 'reasoning_patterns'
  }
};

// Total: 78 agents across 20 categories

export const AGENT_COUNT = Object.keys(AGENT_REGISTRY).length;

export const CATEGORY_AGENT_COUNTS: Record<AgentCategory, number> = {
  'core': 5,
  'sparc': 6,
  'swarm': 8,
  'goal': 2,
  'neural': 2,
  'testing': 6,
  'github': 9,
  'optimization': 5,
  'analysis': 5,
  'architecture': 7,
  'devops': 6,
  'documentation': 4,
  'data': 3,
  'development': 5,
  'specialized': 5,
  'consensus': 7,
  'reasoning': 6,
  'templates': 0,  // Template agents (not included in this version)
  'hive-mind': 0,  // Hive-mind orchestrator (special)
  'flow-nexus': 0  // Flow Nexus cloud agents
};

// ============================================================================
// Agent Learning System
// ============================================================================

export class AgentLearningSystem {
  private categoryLibraries: Map<AgentCategory, CategoryPatternLibrary>;
  private agentMetrics: Map<string, AgentLearningMetrics>;
  private crossAgentPatterns: Map<string, CrossAgentPattern>;
  private learningPipeline: LearningPipeline;
  private eventEmitter: EventEmitter;

  constructor(
    private db: Database,
    learningPipeline: LearningPipeline
  ) {
    this.categoryLibraries = new Map();
    this.agentMetrics = new Map();
    this.crossAgentPatterns = new Map();
    this.learningPipeline = learningPipeline;
    this.eventEmitter = new EventEmitter();

    this.initialize();
  }

  /**
   * Initialize all category pattern libraries
   */
  private async initialize() {
    console.log('Initializing Agent Learning System for 78 agents...');

    // Initialize category libraries
    const categories = Array.from(new Set(
      Object.values(AGENT_REGISTRY).map(a => a.category)
    ));

    for (const category of categories) {
      this.categoryLibraries.set(category, {
        categoryId: category,
        patterns: [],
        sharedPatterns: [],
        categorySpecificPatterns: [],
        agentContributions: new Map(),
        totalPatterns: 0,
        avgConfidence: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }

    // Initialize agent metrics
    for (const agentId in AGENT_REGISTRY) {
      this.agentMetrics.set(agentId, {
        agentId,
        patternsLearned: 0,
        patternsShared: 0,
        patternsUsed: 0,
        successRate: 0,
        avgConfidence: 0,
        specializations: AGENT_REGISTRY[agentId].specializations,
        contributions: 0,
        reliability: 0.5,
        lastActive: new Date().toISOString()
      });
    }

    // Subscribe to learning pipeline events
    this.learningPipeline.on('pattern_stored', (pattern: Pattern) => {
      this.handleNewPattern(pattern);
    });

    this.learningPipeline.on('pattern_applied', (pattern: Pattern) => {
      this.handlePatternUsage(pattern);
    });

    console.log(`✅ Agent Learning System initialized for ${AGENT_COUNT} agents across ${categories.length} categories`);
  }

  /**
   * Enable learning for a specific agent
   */
  async enableAgentLearning(agentId: string, config?: Partial<LearningConfig>): Promise<void> {
    const agent = AGENT_REGISTRY[agentId];
    if (!agent) {
      throw new Error(`Agent ${agentId} not found in registry`);
    }

    if (!agent.learningEnabled) {
      throw new Error(`Learning not enabled for agent ${agentId}`);
    }

    const learningConfig: LearningConfig = {
      agentId,
      enabled: true,
      learningRate: config?.learningRate || agent.learningRate,
      confidenceThreshold: config?.confidenceThreshold || agent.confidenceThreshold,
      maxPatternsPerCategory: config?.maxPatternsPerCategory || 50,
      sharingEnabled: config?.sharingEnabled !== false,
      specializationTracking: config?.specializationTracking !== false,
      autoAdaptation: config?.autoAdaptation !== false
    };

    // Store config in database
    await this.storeLearningConfig(learningConfig);

    console.log(`✅ Learning enabled for agent: ${agentId} (${agent.category})`);
    this.eventEmitter.emit('agent_learning_enabled', agentId);
  }

  /**
   * Enable learning for all agents in a category
   */
  async enableCategoryLearning(category: AgentCategory): Promise<void> {
    const agents = Object.values(AGENT_REGISTRY).filter(a => a.category === category);

    console.log(`Enabling learning for ${agents.length} agents in category: ${category}`);

    for (const agent of agents) {
      if (agent.learningEnabled) {
        await this.enableAgentLearning(agent.id);
      }
    }

    console.log(`✅ Learning enabled for category: ${category}`);
  }

  /**
   * Enable learning for all 78 agents
   */
  async enableAllAgentsLearning(): Promise<void> {
    console.log(`Enabling learning for all ${AGENT_COUNT} agents...`);

    const categories = Array.from(new Set(
      Object.values(AGENT_REGISTRY).map(a => a.category)
    ));

    for (const category of categories) {
      await this.enableCategoryLearning(category);
    }

    console.log(`✅ Learning enabled for all ${AGENT_COUNT} agents across ${categories.length} categories`);
  }

  /**
   * Store pattern learned by an agent
   */
  async storeAgentPattern(
    agentId: string,
    pattern: Pattern,
    shareAcrossCategory: boolean = true
  ): Promise<void> {
    const agent = AGENT_REGISTRY[agentId];
    if (!agent) return;

    // Store in category library
    const library = this.categoryLibraries.get(agent.category);
    if (library) {
      library.patterns.push(pattern);
      library.totalPatterns++;

      // Update agent contributions
      const contributions = library.agentContributions.get(agentId) || 0;
      library.agentContributions.set(agentId, contributions + 1);

      // Update average confidence
      const totalConfidence = library.patterns.reduce((sum, p) => sum + p.confidence, 0);
      library.avgConfidence = totalConfidence / library.patterns.length;

      library.lastUpdated = new Date().toISOString();

      // Store as shared if enabled
      if (shareAcrossCategory) {
        library.sharedPatterns.push(pattern);
        await this.sharePatternAcrossCategory(agent.category, pattern, agentId);
      } else {
        library.categorySpecificPatterns.push(pattern);
      }
    }

    // Update agent metrics
    const metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      metrics.patternsLearned++;
      if (shareAcrossCategory) {
        metrics.patternsShared++;
      }
      metrics.avgConfidence =
        (metrics.avgConfidence * (metrics.patternsLearned - 1) + pattern.confidence) /
        metrics.patternsLearned;
      metrics.lastActive = new Date().toISOString();
    }

    console.log(`✅ Pattern stored for agent ${agentId}: ${pattern.name}`);
    this.eventEmitter.emit('agent_pattern_stored', { agentId, pattern });
  }

  /**
   * Share pattern across all agents in a category
   */
  private async sharePatternAcrossCategory(
    category: AgentCategory,
    pattern: Pattern,
    sourceAgentId: string
  ): Promise<void> {
    const crossAgentPattern: CrossAgentPattern = {
      id: `cross-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceAgentId,
      sourceCategory: category,
      pattern,
      applicableCategories: [category],
      usageCount: new Map(),
      successByAgent: new Map(),
      generalizability: this.calculateGeneralizability(pattern),
      createdAt: new Date().toISOString()
    };

    this.crossAgentPatterns.set(crossAgentPattern.id, crossAgentPattern);

    // If highly generalizable, share across categories
    if (crossAgentPattern.generalizability > 0.8) {
      await this.sharePatternAcrossCa tegories(crossAgentPattern);
    }

    console.log(`✅ Pattern shared across ${category} category: ${pattern.name}`);
  }

  /**
   * Share pattern across multiple categories
   */
  private async sharePatternAcrossCa tegories(
    crossAgentPattern: CrossAgentPattern
  ): Promise<void> {
    // Determine applicable categories based on pattern type
    const applicableCategories = this.determineApplicableCategories(
      crossAgentPattern.pattern.type
    );

    crossAgentPattern.applicableCategories = applicableCategories;

    for (const category of applicableCategories) {
      if (category !== crossAgentPattern.sourceCategory) {
        const library = this.categoryLibraries.get(category);
        if (library) {
          library.sharedPatterns.push(crossAgentPattern.pattern);
        }
      }
    }

    console.log(
      `✅ Pattern ${crossAgentPattern.pattern.name} shared across ${applicableCategories.length} categories`
    );
  }

  /**
   * Get best matching pattern for an agent
   */
  async getBestPatternForAgent(
    agentId: string,
    taskDescription: string,
    context: ExecutionContext
  ): Promise<PatternApplication> {
    const agent = AGENT_REGISTRY[agentId];
    if (!agent || !agent.learningEnabled) {
      return {
        applied: false,
        reason: 'agent_learning_not_enabled'
      };
    }

    // Search in category library first
    const library = this.categoryLibraries.get(agent.category);
    if (library && library.patterns.length > 0) {
      // Filter patterns by agent capabilities
      const relevantPatterns = library.patterns.filter(p =>
        this.isPatternRelevantForAgent(p, agent)
      );

      if (relevantPatterns.length > 0) {
        // Rank by confidence and specialization match
        const ranked = this.rankPatternsForAgent(relevantPatterns, agent, context);
        const best = ranked[0];

        if (best.confidence >= agent.confidenceThreshold) {
          // Update usage metrics
          await this.recordPatternUsage(agentId, best);

          return {
            applied: true,
            patternId: best.id,
            pattern: best,
            confidence: best.confidence
          };
        }
      }
    }

    // Fall back to shared patterns from other categories
    return await this.searchCrossAgentPatterns(agentId, taskDescription, context);
  }

  /**
   * Search cross-agent patterns
   */
  private async searchCrossAgentPatterns(
    agentId: string,
    taskDescription: string,
    context: ExecutionContext
  ): Promise<PatternApplication> {
    const agent = AGENT_REGISTRY[agentId];
    if (!agent) {
      return { applied: false, reason: 'agent_not_found' };
    }

    const relevantPatterns: Pattern[] = [];

    for (const crossPattern of this.crossAgentPatterns.values()) {
      if (crossPattern.applicableCategories.includes(agent.category)) {
        relevantPatterns.push(crossPattern.pattern);
      }
    }

    if (relevantPatterns.length === 0) {
      return { applied: false, reason: 'no_patterns_available' };
    }

    const ranked = this.rankPatternsForAgent(relevantPatterns, agent, context);
    const best = ranked[0];

    if (best.confidence >= agent.confidenceThreshold) {
      await this.recordPatternUsage(agentId, best);

      return {
        applied: true,
        patternId: best.id,
        pattern: best,
        confidence: best.confidence
      };
    }

    return {
      applied: false,
      reason: 'confidence_below_threshold',
      patternId: best.id,
      confidence: best.confidence
    };
  }

  /**
   * Record pattern usage by agent
   */
  private async recordPatternUsage(agentId: string, pattern: Pattern): Promise<void> {
    const metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      metrics.patternsUsed++;
      metrics.lastActive = new Date().toISOString();
    }

    // Update cross-agent pattern usage
    for (const crossPattern of this.crossAgentPatterns.values()) {
      if (crossPattern.pattern.id === pattern.id) {
        const usage = crossPattern.usageCount.get(agentId) || 0;
        crossPattern.usageCount.set(agentId, usage + 1);
      }
    }

    this.eventEmitter.emit('pattern_used', { agentId, patternId: pattern.id });
  }

  /**
   * Track outcome for agent pattern usage
   */
  async trackAgentOutcome(
    agentId: string,
    patternId: string,
    outcome: Outcome
  ): Promise<void> {
    const metrics = this.agentMetrics.get(agentId);
    if (metrics) {
      // Update success rate
      const totalUsage = metrics.patternsUsed;
      const successValue = outcome.status === 'success' ? 1 : 0;
      metrics.successRate =
        (metrics.successRate * (totalUsage - 1) + successValue) / totalUsage;

      // Update reliability
      metrics.reliability = metrics.successRate;
    }

    // Update cross-agent pattern success tracking
    for (const crossPattern of this.crossAgentPatterns.values()) {
      if (crossPattern.pattern.id === patternId) {
        const success = crossPattern.successByAgent.get(agentId) || 0;
        crossPattern.successByAgent.set(
          agentId,
          outcome.status === 'success' ? success + 1 : success
        );
      }
    }

    // Forward to learning pipeline
    await this.learningPipeline.trackOutcome(outcome);

    this.eventEmitter.emit('agent_outcome_tracked', { agentId, patternId, outcome });
  }

  /**
   * Get learning metrics for an agent
   */
  getAgentMetrics(agentId: string): AgentLearningMetrics | null {
    return this.agentMetrics.get(agentId) || null;
  }

  /**
   * Get category pattern library
   */
  getCategoryLibrary(category: AgentCategory): CategoryPatternLibrary | null {
    return this.categoryLibraries.get(category) || null;
  }

  /**
   * Get all learning metrics
   */
  getAllMetrics(): AgentLearningMetrics[] {
    return Array.from(this.agentMetrics.values());
  }

  /**
   * Get learning statistics
   */
  getSystemStatistics(): {
    totalAgents: number;
    agentsLearning: number;
    totalCategories: number;
    totalPatterns: number;
    avgPatternsPerCategory: number;
    avgAgentReliability: number;
    topPerformers: AgentLearningMetrics[];
  } {
    const agentsLearning = this.getAllMetrics().filter(m => m.patternsLearned > 0).length;
    const totalPatterns = Array.from(this.categoryLibraries.values()).reduce(
      (sum, lib) => sum + lib.totalPatterns,
      0
    );
    const avgPatternsPerCategory = totalPatterns / this.categoryLibraries.size;
    const avgReliability =
      this.getAllMetrics().reduce((sum, m) => sum + m.reliability, 0) / AGENT_COUNT;

    const topPerformers = this.getAllMetrics()
      .sort((a, b) => b.reliability - a.reliability)
      .slice(0, 10);

    return {
      totalAgents: AGENT_COUNT,
      agentsLearning,
      totalCategories: this.categoryLibraries.size,
      totalPatterns,
      avgPatternsPerCategory,
      avgAgentReliability: avgReliability,
      topPerformers
    };
  }

  // Helper methods

  private async storeLearningConfig(config: LearningConfig): Promise<void> {
    // Store in database (implementation depends on schema)
    console.log(`Storing learning config for agent: ${config.agentId}`);
  }

  private calculateGeneralizability(pattern: Pattern): number {
    // Calculate based on pattern characteristics
    const factors = [
      pattern.confidence,
      Math.min(1, pattern.usageCount / 20),
      pattern.metrics.successCount / (pattern.metrics.successCount + pattern.metrics.failureCount)
    ];
    return factors.reduce((sum, f) => sum + f, 0) / factors.length;
  }

  private determineApplicableCategories(patternType: PatternType): AgentCategory[] {
    // Map pattern types to applicable categories
    const mapping: Record<PatternType, AgentCategory[]> = {
      'coordination': ['core', 'swarm', 'consensus', 'devops'],
      'optimization': ['optimization', 'analysis', 'architecture'],
      'error-handling': ['core', 'testing', 'devops'],
      'domain-specific': [], // Stays in source category
      'refactoring': ['core', 'development', 'architecture'],
      'testing': ['testing', 'core', 'development']
    };

    return mapping[patternType] || [];
  }

  private isPatternRelevantForAgent(pattern: Pattern, agent: AgentProfile): boolean {
    // Check if pattern type matches agent capabilities
    return true; // Simplified - can add more sophisticated matching
  }

  private rankPatternsForAgent(
    patterns: Pattern[],
    agent: AgentProfile,
    context: ExecutionContext
  ): Pattern[] {
    return patterns.sort((a, b) => {
      // Score based on confidence, usage, and agent specialization match
      const scoreA = this.scorePatternForAgent(a, agent);
      const scoreB = this.scorePatternForAgent(b, agent);
      return scoreB - scoreA;
    });
  }

  private scorePatternForAgent(pattern: Pattern, agent: AgentProfile): number {
    let score = pattern.confidence * 0.7;

    // Bonus for usage count
    score += Math.min(0.15, pattern.usageCount / 100);

    // Bonus for specialization match
    const specializationMatch = agent.specializations.some(spec =>
      pattern.name.toLowerCase().includes(spec.toLowerCase())
    );
    if (specializationMatch) {
      score += 0.15;
    }

    return Math.min(1, score);
  }

  private handleNewPattern(pattern: Pattern): void {
    // Event handler for new patterns from learning pipeline
    console.log(`New pattern available: ${pattern.name}`);
  }

  private handlePatternUsage(pattern: Pattern): void {
    // Event handler for pattern usage
    console.log(`Pattern used: ${pattern.name}`);
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
}

// ============================================================================
// Exports
// ============================================================================

export default AgentLearningSystem;
