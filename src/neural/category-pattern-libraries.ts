/**
 * Category Pattern Libraries - Specialized Learning for 20 Categories
 *
 * This module defines category-specific pattern structures, learning strategies,
 * and best practices for each of the 20 agent categories.
 */

import { Pattern, PatternType } from './pattern-extraction';
import { AgentCategory } from './agent-learning-system';

// ============================================================================
// Category Learning Profiles
// ============================================================================

export interface CategoryLearningProfile {
  categoryId: AgentCategory;
  name: string;
  description: string;
  patternTypes: PatternType[];
  learningFocus: string[];
  targetPatternCount: { min: number; max: number };
  avgConfidenceThreshold: number;
  specializationAreas: string[];
  crossCategorySharing: boolean;
  learningPriority: 'high' | 'medium' | 'low';
}

export const CATEGORY_LEARNING_PROFILES: Record<AgentCategory, CategoryLearningProfile> = {
  'core': {
    categoryId: 'core',
    name: 'Core Development',
    description: 'Essential development patterns for coding, reviewing, testing, planning',
    patternTypes: ['domain-specific', 'refactoring', 'testing', 'coordination'],
    learningFocus: [
      'code_generation_patterns',
      'refactoring_strategies',
      'test_patterns',
      'review_checklists',
      'planning_heuristics'
    ],
    targetPatternCount: { min: 40, max: 60 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['implementation', 'quality_assurance', 'task_decomposition'],
    crossCategorySharing: true,
    learningPriority: 'high'
  },

  'sparc': {
    categoryId: 'sparc',
    name: 'SPARC Methodology',
    description: 'Test-driven development and systematic methodology patterns',
    patternTypes: ['domain-specific', 'testing', 'refactoring'],
    learningFocus: [
      'specification_patterns',
      'pseudocode_templates',
      'architecture_designs',
      'tdd_cycles',
      'validation_strategies'
    ],
    targetPatternCount: { min: 30, max: 50 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['sparc_phases', 'tdd', 'iterative_development'],
    crossCategorySharing: true,
    learningPriority: 'high'
  },

  'swarm': {
    categoryId: 'swarm',
    name: 'Swarm Coordination',
    description: 'Multi-agent coordination and swarm intelligence patterns',
    patternTypes: ['coordination', 'optimization'],
    learningFocus: [
      'hierarchical_delegation',
      'mesh_coordination',
      'load_balancing',
      'adaptive_strategies',
      'worker_management'
    ],
    targetPatternCount: { min: 35, max: 55 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['topologies', 'coordination_protocols', 'task_distribution'],
    crossCategorySharing: true,
    learningPriority: 'high'
  },

  'goal': {
    categoryId: 'goal',
    name: 'Goal Planning (GOAP)',
    description: 'Goal-oriented action planning and A* search patterns',
    patternTypes: ['coordination', 'optimization'],
    learningFocus: [
      'goap_heuristics',
      'a_star_optimization',
      'action_sequencing',
      'state_space_search',
      'replanning_strategies'
    ],
    targetPatternCount: { min: 25, max: 40 },
    avgConfidenceThreshold: 0.8,
    specializationAreas: ['optimal_planning', 'dynamic_replanning'],
    crossCategorySharing: true,
    learningPriority: 'high'
  },

  'neural': {
    categoryId: 'neural',
    name: 'Neural Learning',
    description: 'Self-learning, pattern extraction, and neural network patterns',
    patternTypes: ['optimization', 'domain-specific'],
    learningFocus: [
      'pattern_extraction_algorithms',
      'feedback_loop_optimization',
      'memory_management',
      'confidence_scoring',
      'meta_learning'
    ],
    targetPatternCount: { min: 30, max: 45 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['safla', 'four_tier_memory', 'self_improvement'],
    crossCategorySharing: false, // Highly specialized
    learningPriority: 'high'
  },

  'testing': {
    categoryId: 'testing',
    name: 'Testing & QA',
    description: 'Testing strategies, QA processes, and validation patterns',
    patternTypes: ['testing', 'domain-specific'],
    learningFocus: [
      'tdd_patterns',
      'integration_test_strategies',
      'e2e_workflows',
      'performance_benchmarks',
      'security_scanning'
    ],
    targetPatternCount: { min: 35, max: 50 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['unit_testing', 'integration', 'e2e', 'performance', 'security'],
    crossCategorySharing: true,
    learningPriority: 'high'
  },

  'github': {
    categoryId: 'github',
    name: 'GitHub Integration',
    description: 'GitHub workflows, PR management, and repository automation',
    patternTypes: ['coordination', 'domain-specific'],
    learningFocus: [
      'pr_review_strategies',
      'issue_triage_patterns',
      'release_workflows',
      'github_actions',
      'multi_repo_coordination'
    ],
    targetPatternCount: { min: 30, max: 45 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['pull_requests', 'issues', 'releases', 'workflows'],
    crossCategorySharing: false, // GitHub-specific
    learningPriority: 'medium'
  },

  'optimization': {
    categoryId: 'optimization',
    name: 'Performance Optimization',
    description: 'Performance tuning, profiling, and resource optimization',
    patternTypes: ['optimization', 'domain-specific'],
    learningFocus: [
      'performance_profiling',
      'bottleneck_identification',
      'caching_strategies',
      'resource_management',
      'benchmarking_methods'
    ],
    targetPatternCount: { min: 25, max: 40 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['performance', 'caching', 'monitoring'],
    crossCategorySharing: true,
    learningPriority: 'medium'
  },

  'analysis': {
    categoryId: 'analysis',
    name: 'Code & Data Analysis',
    description: 'Analysis patterns, metrics collection, and insight generation',
    patternTypes: ['domain-specific', 'optimization'],
    learningFocus: [
      'code_analysis_techniques',
      'pattern_recognition',
      'dependency_analysis',
      'quality_metrics',
      'data_insights'
    ],
    targetPatternCount: { min: 25, max: 40 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['static_analysis', 'pattern_matching', 'metrics'],
    crossCategorySharing: true,
    learningPriority: 'medium'
  },

  'architecture': {
    categoryId: 'architecture',
    name: 'System Architecture',
    description: 'Architectural patterns, design principles, and system design',
    patternTypes: ['domain-specific', 'refactoring'],
    learningFocus: [
      'design_patterns',
      'architectural_styles',
      'scalability_strategies',
      'api_design',
      'microservices_patterns'
    ],
    targetPatternCount: { min: 30, max: 50 },
    avgConfidenceThreshold: 0.8,
    specializationAreas: ['system_design', 'api_architecture', 'database_design'],
    crossCategorySharing: true,
    learningPriority: 'high'
  },

  'devops': {
    categoryId: 'devops',
    name: 'DevOps & Infrastructure',
    description: 'CI/CD, deployment, infrastructure, and automation patterns',
    patternTypes: ['coordination', 'domain-specific'],
    learningFocus: [
      'ci_cd_pipelines',
      'deployment_strategies',
      'infrastructure_as_code',
      'container_orchestration',
      'monitoring_setup'
    ],
    targetPatternCount: { min: 30, max: 45 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['deployment', 'infrastructure', 'containers'],
    crossCategorySharing: true,
    learningPriority: 'medium'
  },

  'documentation': {
    categoryId: 'documentation',
    name: 'Documentation',
    description: 'Documentation patterns, technical writing, and content strategies',
    patternTypes: ['domain-specific'],
    learningFocus: [
      'documentation_templates',
      'api_documentation',
      'tutorial_structures',
      'readme_formats',
      'content_organization'
    ],
    targetPatternCount: { min: 20, max: 35 },
    avgConfidenceThreshold: 0.7,
    specializationAreas: ['technical_writing', 'api_docs', 'tutorials'],
    crossCategorySharing: false,
    learningPriority: 'low'
  },

  'data': {
    categoryId: 'data',
    name: 'Data Management',
    description: 'Data engineering, database management, and migration patterns',
    patternTypes: ['domain-specific', 'optimization'],
    learningFocus: [
      'data_pipeline_patterns',
      'etl_strategies',
      'database_optimization',
      'migration_approaches',
      'query_optimization'
    ],
    targetPatternCount: { min: 20, max: 35 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['data_pipelines', 'databases', 'migrations'],
    crossCategorySharing: true,
    learningPriority: 'medium'
  },

  'development': {
    categoryId: 'development',
    name: 'Development Specialists',
    description: 'Frontend, backend, fullstack, and specialized development patterns',
    patternTypes: ['domain-specific', 'refactoring'],
    learningFocus: [
      'frontend_patterns',
      'backend_patterns',
      'api_integration',
      'mobile_development',
      'web3_patterns'
    ],
    targetPatternCount: { min: 30, max: 50 },
    avgConfidenceThreshold: 0.7,
    specializationAreas: ['frontend', 'backend', 'fullstack', 'mobile'],
    crossCategorySharing: true,
    learningPriority: 'medium'
  },

  'specialized': {
    categoryId: 'specialized',
    name: 'Specialized Tools',
    description: 'CLI, regex, git, shell, and automation specialist patterns',
    patternTypes: ['domain-specific'],
    learningFocus: [
      'cli_command_patterns',
      'regex_patterns',
      'git_workflows',
      'shell_scripting',
      'automation_scripts'
    ],
    targetPatternCount: { min: 20, max: 35 },
    avgConfidenceThreshold: 0.7,
    specializationAreas: ['cli', 'regex', 'git', 'shell'],
    crossCategorySharing: false,
    learningPriority: 'low'
  },

  'consensus': {
    categoryId: 'consensus',
    name: 'Consensus Mechanisms',
    description: 'Distributed consensus, voting, and conflict resolution patterns',
    patternTypes: ['coordination', 'domain-specific'],
    learningFocus: [
      'byzantine_fault_tolerance',
      'raft_algorithms',
      'voting_protocols',
      'quorum_management',
      'conflict_resolution'
    ],
    targetPatternCount: { min: 25, max: 40 },
    avgConfidenceThreshold: 0.8,
    specializationAreas: ['bft', 'raft', 'voting', 'quorum'],
    crossCategorySharing: true,
    learningPriority: 'medium'
  },

  'reasoning': {
    categoryId: 'reasoning',
    name: 'Reasoning & Cognition',
    description: 'Thinking patterns, problem-solving approaches, and cognitive strategies',
    patternTypes: ['domain-specific'],
    learningFocus: [
      'convergent_thinking',
      'divergent_thinking',
      'lateral_thinking',
      'systems_thinking',
      'critical_analysis'
    ],
    targetPatternCount: { min: 25, max: 40 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['cognitive_patterns', 'problem_solving'],
    crossCategorySharing: true,
    learningPriority: 'medium'
  },

  'templates': {
    categoryId: 'templates',
    name: 'Template Management',
    description: 'Template patterns and deployment strategies',
    patternTypes: ['domain-specific'],
    learningFocus: [
      'template_structures',
      'deployment_patterns',
      'configuration_management'
    ],
    targetPatternCount: { min: 15, max: 25 },
    avgConfidenceThreshold: 0.7,
    specializationAreas: ['templates', 'deployment'],
    crossCategorySharing: false,
    learningPriority: 'low'
  },

  'hive-mind': {
    categoryId: 'hive-mind',
    name: 'Hive-Mind Orchestration',
    description: 'Distributed learning and collective intelligence patterns',
    patternTypes: ['coordination', 'optimization'],
    learningFocus: [
      'distributed_learning',
      'consensus_mechanisms',
      'collective_intelligence',
      'byzantine_tolerance',
      'pattern_validation'
    ],
    targetPatternCount: { min: 20, max: 35 },
    avgConfidenceThreshold: 0.8,
    specializationAreas: ['distributed_systems', 'collective_learning'],
    crossCategorySharing: true,
    learningPriority: 'high'
  },

  'flow-nexus': {
    categoryId: 'flow-nexus',
    name: 'Flow Nexus Cloud',
    description: 'Cloud deployment, sandbox management, and distributed neural networks',
    patternTypes: ['coordination', 'domain-specific'],
    learningFocus: [
      'cloud_deployment',
      'sandbox_management',
      'distributed_training',
      'workflow_automation',
      'challenge_systems'
    ],
    targetPatternCount: { min: 25, max: 40 },
    avgConfidenceThreshold: 0.75,
    specializationAreas: ['cloud', 'sandboxes', 'workflows'],
    crossCategorySharing: false,
    learningPriority: 'medium'
  }
};

// ============================================================================
// Pattern Library Statistics
// ============================================================================

export function getCategoryStatistics() {
  const categories = Object.values(CATEGORY_LEARNING_PROFILES);

  const totalTargetPatterns = categories.reduce(
    (sum, cat) => sum + cat.targetPatternCount.max,
    0
  );

  const avgPatternsPerCategory = totalTargetPatterns / categories.length;

  const highPriorityCategories = categories.filter(c => c.learningPriority === 'high');
  const mediumPriorityCategories = categories.filter(c => c.learningPriority === 'medium');
  const lowPriorityCategories = categories.filter(c => c.learningPriority === 'low');

  const sharingEnabledCategories = categories.filter(c => c.crossCategorySharing);

  return {
    totalCategories: categories.length,
    totalTargetPatterns,
    avgPatternsPerCategory: Math.round(avgPatternsPerCategory),
    minPatternsPerCategory: 15,
    maxPatternsPerCategory: 60,
    highPriorityCount: highPriorityCategories.length,
    mediumPriorityCount: mediumPriorityCategories.length,
    lowPriorityCount: lowPriorityCategories.length,
    sharingEnabledCount: sharingEnabledCategories.length,
    avgConfidenceThreshold: 0.75
  };
}

// ============================================================================
// Category Pattern Templates
// ============================================================================

export interface CategoryPatternTemplate {
  categoryId: AgentCategory;
  templateName: string;
  description: string;
  patternStructure: Partial<Pattern>;
  examplePatterns: Array<{
    name: string;
    description: string;
    useCase: string;
  }>;
}

export const CATEGORY_PATTERN_TEMPLATES: Record<AgentCategory, CategoryPatternTemplate[]> = {
  'core': [
    {
      categoryId: 'core',
      templateName: 'Code Generation Pattern',
      description: 'Template for efficient code generation strategies',
      patternStructure: {
        type: 'domain-specific',
        conditions: { requiresImplementation: true },
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 }
      },
      examplePatterns: [
        {
          name: 'api_endpoint_generation',
          description: 'REST API endpoint scaffolding',
          useCase: 'Generate CRUD endpoints with validation'
        },
        {
          name: 'test_generation',
          description: 'Automated test creation',
          useCase: 'Generate unit tests from function signatures'
        }
      ]
    }
  ],

  'sparc': [
    {
      categoryId: 'sparc',
      templateName: 'TDD Cycle Pattern',
      description: 'Test-driven development iteration patterns',
      patternStructure: {
        type: 'testing',
        conditions: { phase: 'refinement' },
        successCriteria: { minCompletionRate: 0.95, maxErrorRate: 0.05 }
      },
      examplePatterns: [
        {
          name: 'red_green_refactor',
          description: 'Classic TDD cycle',
          useCase: 'Iterative feature development with tests'
        }
      ]
    }
  ],

  'swarm': [
    {
      categoryId: 'swarm',
      templateName: 'Task Distribution Pattern',
      description: 'Optimal task delegation strategies',
      patternStructure: {
        type: 'coordination',
        conditions: { topology: ['hierarchical', 'mesh', 'star'] },
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 }
      },
      examplePatterns: [
        {
          name: 'hierarchical_delegation',
          description: 'Top-down task assignment',
          useCase: 'Coordinate complex multi-agent workflows'
        }
      ]
    }
  ],

  'goal': [
    {
      categoryId: 'goal',
      templateName: 'A* Heuristic Pattern',
      description: 'Learned heuristics for faster planning',
      patternStructure: {
        type: 'optimization',
        conditions: { planningRequired: true },
        successCriteria: { minCompletionRate: 0.9, maxErrorRate: 0.1 }
      },
      examplePatterns: [
        {
          name: 'cost_estimation_heuristic',
          description: 'Improved action cost prediction',
          useCase: 'Faster A* search with learned costs'
        }
      ]
    }
  ],

  // Other categories follow similar structure...
  // (abbreviated for brevity)

  'neural': [],
  'testing': [],
  'github': [],
  'optimization': [],
  'analysis': [],
  'architecture': [],
  'devops': [],
  'documentation': [],
  'data': [],
  'development': [],
  'specialized': [],
  'consensus': [],
  'reasoning': [],
  'templates': [],
  'hive-mind': [],
  'flow-nexus': []
};

// ============================================================================
// Learning Strategy Recommendations
// ============================================================================

export interface LearningStrategyRecommendation {
  categoryId: AgentCategory;
  phase: 'initial' | 'intermediate' | 'advanced';
  focusAreas: string[];
  targetMetrics: {
    patternsToLearn: number;
    confidenceThreshold: number;
    expectedSuccessRate: number;
  };
  trainingApproach: string;
}

export function getRecommendedLearningStrategy(
  categoryId: AgentCategory,
  currentPatternCount: number
): LearningStrategyRecommendation {
  const profile = CATEGORY_LEARNING_PROFILES[categoryId];

  let phase: 'initial' | 'intermediate' | 'advanced';
  if (currentPatternCount < profile.targetPatternCount.min / 2) {
    phase = 'initial';
  } else if (currentPatternCount < profile.targetPatternCount.min) {
    phase = 'intermediate';
  } else {
    phase = 'advanced';
  }

  const strategies: Record<typeof phase, LearningStrategyRecommendation> = {
    initial: {
      categoryId,
      phase: 'initial',
      focusAreas: profile.learningFocus.slice(0, 2),
      targetMetrics: {
        patternsToLearn: Math.floor(profile.targetPatternCount.min / 2),
        confidenceThreshold: profile.avgConfidenceThreshold - 0.05,
        expectedSuccessRate: 0.75
      },
      trainingApproach: 'Focus on foundational patterns with high success rates'
    },
    intermediate: {
      categoryId,
      phase: 'intermediate',
      focusAreas: profile.learningFocus.slice(2, 4),
      targetMetrics: {
        patternsToLearn: profile.targetPatternCount.min,
        confidenceThreshold: profile.avgConfidenceThreshold,
        expectedSuccessRate: 0.85
      },
      trainingApproach: 'Expand pattern library and refine existing patterns'
    },
    advanced: {
      categoryId,
      phase: 'advanced',
      focusAreas: profile.learningFocus,
      targetMetrics: {
        patternsToLearn: profile.targetPatternCount.max,
        confidenceThreshold: profile.avgConfidenceThreshold + 0.05,
        expectedSuccessRate: 0.95
      },
      trainingApproach: 'Optimize patterns and focus on edge cases'
    }
  };

  return strategies[phase];
}

// ============================================================================
// Exports
// ============================================================================

export function getTotalTargetPatterns(): number {
  return Object.values(CATEGORY_LEARNING_PROFILES).reduce(
    (sum, profile) => sum + profile.targetPatternCount.max,
    0
  );
}

export function getHighPriorityCategories(): AgentCategory[] {
  return Object.values(CATEGORY_LEARNING_PROFILES)
    .filter(p => p.learningPriority === 'high')
    .map(p => p.categoryId);
}
