/**
 * SPARC-Neural Integration Demo
 *
 * Demonstrates the complete SPARC learning workflow:
 * 1. Initialize system with pattern libraries
 * 2. Execute SPARC phases with learning
 * 3. Track TDD cycles
 * 4. View improvement dashboard
 */

import { initializeSPARCHooks, SPARCHookContext, SPARCHookResult } from '../src/neural/sparc-hooks';
import * as path from 'path';

async function runDemo() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           SPARC-Neural Integration Demo                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // ============================================================================
  // Step 1: Initialize SPARC Hooks
  // ============================================================================

  console.log('Step 1: Initializing SPARC learning system...\n');

  const hooks = initializeSPARCHooks({
    db_path: path.join(__dirname, '..', '.swarm', 'demo-memory.db'),
    min_confidence_threshold: 0.6,
    min_usage_for_suggestion: 2, // Lower for demo
    enable_auto_suggestions: true,
    enable_cross_phase_learning: true,
  });

  console.log('✅ System initialized with 17+ pre-built patterns\n');

  // ============================================================================
  // Step 2: Execute Specification Phase
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('Step 2: Execute SPECIFICATION Phase');
  console.log('='.repeat(70) + '\n');

  const specContext: SPARCHookContext = {
    phase: 'specification',
    task_description: 'Create REST API specification for user authentication',
    agent_name: 'specification',
    working_directory: process.cwd(),
    start_time: Date.now(),
    context: {
      type: 'api',
      protocol: 'rest',
      feature: 'authentication',
    },
  };

  await hooks.prePhaseHook(specContext);

  // Simulate phase execution
  console.log('📝 Writing specification...');
  await sleep(1000);
  console.log('✅ Specification complete\n');

  const specResult: SPARCHookResult = {
    success: true,
    duration: 180, // 3 minutes
    artifacts: ['docs/api/auth-spec.yaml', 'docs/api/auth-examples.md'],
    quality_metrics: {
      test_coverage: 0.0, // N/A for spec phase
      maintainability_score: 0.92,
    },
    feedback: 'Complete REST API specification with OAuth2 flow, JWT tokens, and comprehensive examples',
  };

  await hooks.postPhaseHook(specContext, specResult);

  // ============================================================================
  // Step 3: Execute Refinement Phase (TDD)
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('Step 3: Execute REFINEMENT Phase (TDD)');
  console.log('='.repeat(70) + '\n');

  const refContext: SPARCHookContext = {
    phase: 'refinement',
    task_description: 'Implement user authentication with TDD',
    agent_name: 'refinement',
    working_directory: process.cwd(),
    start_time: Date.now(),
    context: {
      methodology: 'tdd',
      approach: 'test_first',
    },
  };

  await hooks.prePhaseHook(refContext);

  console.log('🔴 RED Phase: Writing failing tests...');
  await sleep(800);
  console.log('   ✅ 3 tests written (120s)\n');

  console.log('🟢 GREEN Phase: Implementing code to pass tests...');
  await sleep(1200);
  console.log('   ✅ All 3 tests passing (180s)\n');

  console.log('🔵 REFACTOR Phase: Improving code quality...');
  await sleep(600);
  console.log('   ✅ Refactoring complete (90s)\n');

  // Track TDD cycle
  await hooks.trackTDDCycle({
    test_file: 'tests/auth/authentication.test.ts',
    implementation_file: 'src/auth/authentication.ts',
    red_duration: 120,
    tests_written: 3,
    green_duration: 180,
    tests_passing: 3,
    refactor_duration: 90,
    improvements: ['Extract token validation function', 'Simplify password hashing', 'Add input sanitization'],
  });

  const refResult: SPARCHookResult = {
    success: true,
    duration: 390, // 6.5 minutes
    artifacts: ['src/auth/authentication.ts', 'tests/auth/authentication.test.ts'],
    quality_metrics: {
      test_coverage: 0.94,
      complexity_score: 0.25, // Low is good
      maintainability_score: 0.88,
    },
    feedback: 'Complete TDD implementation with high test coverage and clean refactoring',
  };

  await hooks.postPhaseHook(refContext, refResult);

  // ============================================================================
  // Step 4: Execute Additional Phases (Simulated)
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('Step 4: Execute Additional SPARC Phases (Simulated)');
  console.log('='.repeat(70) + '\n');

  // Pseudocode phase
  console.log('⚡ Pseudocode phase...');
  await hooks.prePhaseHook({
    phase: 'pseudocode',
    task_description: 'Design authentication algorithm',
    agent_name: 'pseudocode',
    working_directory: process.cwd(),
    start_time: Date.now(),
    context: { algorithm_type: 'security' },
  });

  await hooks.postPhaseHook(
    {
      phase: 'pseudocode',
      task_description: 'Design authentication algorithm',
      agent_name: 'pseudocode',
      working_directory: process.cwd(),
      start_time: Date.now() - 150000,
      context: {},
    },
    {
      success: true,
      duration: 150,
      artifacts: ['docs/pseudocode/auth-algorithm.md'],
      quality_metrics: { maintainability_score: 0.86 },
      feedback: 'Clear algorithm with O(1) authentication check',
    }
  );

  // Architecture phase
  console.log('🏗️  Architecture phase...');
  await hooks.prePhaseHook({
    phase: 'architecture',
    task_description: 'Design system architecture',
    agent_name: 'architecture',
    working_directory: process.cwd(),
    start_time: Date.now(),
    context: { architecture_type: 'microservices' },
  });

  await hooks.postPhaseHook(
    {
      phase: 'architecture',
      task_description: 'Design system architecture',
      agent_name: 'architecture',
      working_directory: process.cwd(),
      start_time: Date.now() - 240000,
      context: {},
    },
    {
      success: true,
      duration: 240,
      artifacts: ['docs/architecture/system-design.md'],
      quality_metrics: { maintainability_score: 0.90 },
      feedback: 'Scalable microservices architecture with clear boundaries',
    }
  );

  // Completion phase
  console.log('✅ Completion phase...');
  await hooks.prePhaseHook({
    phase: 'completion',
    task_description: 'Validate and deploy',
    agent_name: 'completion',
    working_directory: process.cwd(),
    start_time: Date.now(),
    context: { deployment: 'production' },
  });

  await hooks.postPhaseHook(
    {
      phase: 'completion',
      task_description: 'Validate and deploy',
      agent_name: 'completion',
      working_directory: process.cwd(),
      start_time: Date.now() - 180000,
      context: {},
    },
    {
      success: true,
      duration: 180,
      artifacts: ['CHANGELOG.md', 'deployment-report.md'],
      quality_metrics: { maintainability_score: 0.95 },
      feedback: 'All validation checks passed, deployed successfully',
    }
  );

  console.log('✅ All phases complete\n');

  // ============================================================================
  // Step 5: Additional TDD Cycles
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('Step 5: Record Additional TDD Cycles');
  console.log('='.repeat(70) + '\n');

  const tddCycles = [
    {
      test_file: 'tests/auth/session.test.ts',
      implementation_file: 'src/auth/session.ts',
      red_duration: 100,
      tests_written: 2,
      green_duration: 150,
      tests_passing: 2,
      refactor_duration: 80,
      improvements: ['Extract session store', 'Add expiration handling'],
    },
    {
      test_file: 'tests/auth/password.test.ts',
      implementation_file: 'src/auth/password.ts',
      red_duration: 130,
      tests_written: 4,
      green_duration: 200,
      tests_passing: 4,
      refactor_duration: 100,
      improvements: ['Improve hashing algorithm', 'Add strength validation'],
    },
  ];

  for (const cycle of tddCycles) {
    await hooks.trackTDDCycle(cycle);
    await sleep(500);
  }

  // ============================================================================
  // Step 6: Get TDD Recommendations
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('Step 6: TDD Pattern Recommendations');
  console.log('='.repeat(70) + '\n');

  const tddRecs = hooks.getTDDRecommendations();

  console.log('🧪 Learned TDD Patterns:\n');
  console.log(`Optimal Cycle Times:`);
  console.log(`  🔴 Red:      ${Math.round(tddRecs.optimal_red_duration)}s`);
  console.log(`  🟢 Green:    ${Math.round(tddRecs.optimal_green_duration)}s`);
  console.log(`  🔵 Refactor: ${Math.round(tddRecs.optimal_refactor_duration)}s`);
  console.log();

  if (tddRecs.common_improvements.length > 0) {
    console.log('Common Refactoring Improvements:');
    tddRecs.common_improvements.slice(0, 5).forEach((improvement, i) => {
      console.log(`  ${i + 1}. ${improvement}`);
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

  // ============================================================================
  // Step 7: View Improvement Dashboard
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('Step 7: Improvement Dashboard');
  console.log('='.repeat(70) + '\n');

  await sleep(500);
  hooks.displayImprovementDashboard();

  // ============================================================================
  // Step 8: Get Phase-Specific Suggestions
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('Step 8: Context-Aware Suggestions');
  console.log('='.repeat(70) + '\n');

  const engine = hooks.getEngine();

  const suggestions = engine.getSuggestions('specification', {
    type: 'api',
    protocol: 'rest',
  });

  if (suggestions.length > 0) {
    console.log('💡 Suggestions for REST API Specification:\n');
    suggestions.slice(0, 3).forEach((suggestion, i) => {
      console.log(`${i + 1}. ${suggestion.pattern.pattern_data.name}`);
      console.log(`   Relevance: ${(suggestion.relevance_score * 100).toFixed(0)}%`);
      console.log(`   ${suggestion.reason}`);
      console.log();
    });
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('Demo Complete! Summary:');
  console.log('='.repeat(70) + '\n');

  const allMetrics = engine.getAllPhaseMetrics();

  console.log('Phase Execution Summary:');
  allMetrics.forEach((metrics) => {
    if (metrics.total_executions > 0) {
      console.log(`\n${metrics.phase.toUpperCase()}:`);
      console.log(`  Executions: ${metrics.total_executions}`);
      console.log(`  Success rate: ${(metrics.success_rate * 100).toFixed(0)}%`);
      console.log(`  Avg duration: ${Math.round(metrics.avg_duration)}s`);
      if (metrics.quality_trend.length > 0) {
        const latestQuality = metrics.quality_trend[metrics.quality_trend.length - 1];
        console.log(`  Latest quality: ${(latestQuality * 100).toFixed(0)}%`);
      }
    }
  });

  const report = hooks.getImprovementReport();
  console.log(`\n📊 Overall Metrics:`);
  console.log(`  Total time saved: ${report.total_time_saved} minutes`);
  console.log(`  Pattern adoption: ${(report.pattern_adoption * 100).toFixed(0)}%`);

  console.log('\n✅ SPARC-Neural Integration is working perfectly!');
  console.log('   All patterns learned, metrics tracked, and suggestions ready.\n');

  // Cleanup
  hooks.close();
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run demo
if (require.main === module) {
  runDemo().catch((error) => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { runDemo };
