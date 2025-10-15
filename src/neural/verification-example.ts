/**
 * Verification-Neural Learning Integration Example
 *
 * This file demonstrates how to use the verification-neural bridge
 * in a real-world scenario.
 */

import {
  getVerificationBridge,
  predictVerification,
  learnFromVerification,
  getAdaptiveThreshold
} from './verification-bridge';
import { VerificationOutcome } from './verification-learning';

// ============================================================================
// Example 1: Basic Predict-Learn Cycle
// ============================================================================

async function basicExample() {
  console.log('Example 1: Basic Predict-Learn Cycle\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const bridge = await getVerificationBridge();

  // Step 1: Predict before verification
  console.log('Step 1: Making prediction...');
  const prediction = await bridge.predict(
    'task-example-1',
    'coder-agent-001',
    'coder',
    {
      fileType: 'ts',
      complexity: 0.6,
      linesChanged: 150
    }
  );

  console.log('Prediction Results:');
  console.log(`  Score:       ${(prediction.predictedScore * 100).toFixed(1)}%`);
  console.log(`  Confidence:  ${(prediction.confidence * 100).toFixed(1)}%`);
  console.log(`  Risk Level:  ${prediction.riskLevel}`);
  console.log(`  Threshold:   ${(prediction.recommendedThreshold * 100).toFixed(1)}%`);
  console.log('\n  Factors:');
  console.log(`    Agent Reliability:       ${(prediction.factors.agentReliability * 100).toFixed(1)}%`);
  console.log(`    Historical Performance:  ${(prediction.factors.historicalPerformance * 100).toFixed(1)}%`);
  console.log(`    Task Complexity:         ${(prediction.factors.taskComplexity * 100).toFixed(1)}%`);
  console.log(`    Context Similarity:      ${(prediction.factors.contextSimilarity * 100).toFixed(1)}%`);
  console.log(`    Recent Trend:            ${(prediction.factors.recentTrend * 100).toFixed(1)}%`);

  // Step 2: Simulate verification
  console.log('\nStep 2: Running verification...');
  const actualScore = 0.96; // Simulated result
  const passed = actualScore >= 0.95;

  console.log(`  Actual Score: ${(actualScore * 100).toFixed(1)}%`);
  console.log(`  Result:       ${passed ? 'PASS ✓' : 'FAIL ✗'}`);

  // Step 3: Learn from outcome
  console.log('\nStep 3: Learning from outcome...');
  const outcome: VerificationOutcome = {
    taskId: 'task-example-1',
    agentId: 'coder-agent-001',
    agentType: 'coder',
    timestamp: new Date().toISOString(),
    passed,
    truthScore: actualScore,
    threshold: 0.95,
    componentScores: {
      compile: 1.0,
      tests: 0.95,
      lint: 0.98,
      typecheck: 1.0
    },
    fileType: 'ts',
    complexity: 0.6,
    linesChanged: 150,
    testsRun: 25,
    duration: 1200,
    errorMessages: [],
    warnings: []
  };

  await bridge.learn(outcome);
  console.log('  Learning complete ✓');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// Example 2: Adaptive Threshold Usage
// ============================================================================

async function adaptiveThresholdExample() {
  console.log('Example 2: Adaptive Threshold Usage\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const bridge = await getVerificationBridge();

  // Get thresholds for different contexts
  const contexts = [
    { agentType: 'coder', fileType: 'ts' },
    { agentType: 'coder', fileType: 'js' },
    { agentType: 'reviewer', fileType: undefined },
    { agentType: 'tester', fileType: undefined }
  ];

  console.log('Adaptive Thresholds:\n');

  for (const context of contexts) {
    const threshold = await bridge.getThreshold(
      context.agentType,
      context.fileType ? { fileType: context.fileType } : undefined
    );

    const contextStr = context.fileType
      ? `${context.agentType} (${context.fileType})`
      : `${context.agentType} (any)`;

    console.log(`  ${contextStr.padEnd(25)} ${(threshold * 100).toFixed(1)}%`);
  }

  // Get all thresholds
  console.log('\nAll Adaptive Thresholds:\n');
  const allThresholds = await bridge.getAllThresholds();

  for (const threshold of allThresholds.slice(0, 5)) {
    const context = threshold.fileType
      ? `${threshold.agentType} (${threshold.fileType})`
      : `${threshold.agentType} (any)`;

    console.log(`  ${context.padEnd(25)} Base: ${(threshold.baseThreshold * 100).toFixed(1)}%  Adjusted: ${(threshold.adjustedThreshold * 100).toFixed(1)}%  (n=${threshold.sampleSize})`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// Example 3: Agent Reliability Analysis
// ============================================================================

async function agentReliabilityExample() {
  console.log('Example 3: Agent Reliability Analysis\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const bridge = await getVerificationBridge();

  // Get reliability for specific agent
  const agentId = 'coder-agent-001';
  const reliability = await bridge.getReliability(agentId);

  if (reliability) {
    console.log(`Agent: ${reliability.agentId} (${reliability.agentType})\n`);
    console.log('Overall Metrics:');
    console.log(`  Reliability:          ${(reliability.reliability * 100).toFixed(1)}%`);
    console.log(`  Avg Truth Score:      ${(reliability.avgTruthScore * 100).toFixed(1)}%`);
    console.log(`  Total Verifications:  ${reliability.totalVerifications}`);
    console.log(`  Success Count:        ${reliability.successCount}`);
    console.log(`  Failure Count:        ${reliability.failureCount}`);
    console.log(`  Recent Trend:         ${reliability.recentTrend}`);
    console.log(`  Trend Confidence:     ${(reliability.trendConfidence * 100).toFixed(1)}%`);

    if (reliability.performanceByFileType.size > 0) {
      console.log('\nPerformance by File Type:');
      for (const [fileType, score] of reliability.performanceByFileType.entries()) {
        console.log(`  ${fileType.padEnd(10)} ${(score * 100).toFixed(1)}%`);
      }
    }
  } else {
    console.log(`No reliability data for agent: ${agentId}`);
  }

  // Get top performers
  console.log('\nTop Performing Agents:\n');
  const allReliability = await bridge.getAllAgentReliability();

  for (const agent of allReliability.slice(0, 5)) {
    console.log(`  ${agent.agentId.padEnd(20)} ${(agent.reliability * 100).toFixed(1)}%  (${agent.totalVerifications} verifications, ${agent.recentTrend})`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// Example 4: Pattern Analysis
// ============================================================================

async function patternAnalysisExample() {
  console.log('Example 4: Pattern Analysis\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const bridge = await getVerificationBridge();

  // Get success patterns
  console.log('Success Patterns:\n');
  const successPatterns = await bridge.getPatterns('success');

  for (const pattern of successPatterns.slice(0, 3)) {
    console.log(`  ${pattern.name}`);
    console.log(`    Type:         ${pattern.type}`);
    console.log(`    Occurrences:  ${pattern.occurrences}`);
    console.log(`    Success Rate: ${(pattern.successRate * 100).toFixed(1)}%`);
    console.log(`    Avg Score:    ${(pattern.avgTruthScore * 100).toFixed(1)}%`);
    console.log(`    Confidence:   ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log(`    Agent Types:  ${pattern.agentTypes.join(', ')}`);
    console.log(`    File Types:   ${pattern.fileTypes.join(', ')}\n`);
  }

  // Get failure patterns
  console.log('Failure Patterns:\n');
  const failurePatterns = await bridge.getPatterns('failure');

  for (const pattern of failurePatterns.slice(0, 3)) {
    console.log(`  ${pattern.name}`);
    console.log(`    Type:          ${pattern.type}`);
    console.log(`    Occurrences:   ${pattern.occurrences}`);
    console.log(`    Avg Score:     ${(pattern.avgTruthScore * 100).toFixed(1)}%`);
    console.log(`    Confidence:    ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log(`    Common Errors: ${pattern.commonErrors.slice(0, 3).join(', ')}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// Example 5: Comprehensive Report
// ============================================================================

async function comprehensiveReportExample() {
  console.log('Example 5: Comprehensive Report\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const bridge = await getVerificationBridge();
  const report = await bridge.generateReport();

  console.log(report);
}

// ============================================================================
// Example 6: Training with Multiple Outcomes
// ============================================================================

async function trainingExample() {
  console.log('Example 6: Training with Multiple Outcomes\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const bridge = await getVerificationBridge();

  console.log('Training agent with 20 verification outcomes...\n');

  const agentId = 'training-agent-001';
  const agentType = 'coder';

  // Simulate 20 verification outcomes
  for (let i = 0; i < 20; i++) {
    const passed = Math.random() > 0.15; // 85% success rate
    const score = passed ? 0.90 + Math.random() * 0.10 : 0.60 + Math.random() * 0.20;

    const outcome: VerificationOutcome = {
      taskId: `training-task-${i}`,
      agentId,
      agentType,
      timestamp: new Date().toISOString(),
      passed,
      truthScore: score,
      threshold: 0.95,
      componentScores: {
        compile: passed ? 1.0 : 0.5 + Math.random() * 0.4,
        tests: passed ? 0.95 : 0.6 + Math.random() * 0.3,
        lint: passed ? 0.98 : 0.7 + Math.random() * 0.2
      },
      fileType: ['ts', 'js', 'tsx'][i % 3],
      complexity: Math.random(),
      linesChanged: 50 + Math.floor(Math.random() * 200),
      testsRun: 10 + Math.floor(Math.random() * 30),
      duration: 800 + Math.floor(Math.random() * 1200),
      errorMessages: passed ? [] : ['Error in test suite'],
      warnings: []
    };

    await bridge.learn(outcome);
    console.log(`  ${i + 1}/20: ${outcome.taskId} - ${passed ? 'PASS' : 'FAIL'} (${(score * 100).toFixed(1)}%)`);
  }

  console.log('\nTraining complete! Checking learned metrics...\n');

  // Check learned metrics
  const reliability = await bridge.getReliability(agentId);
  if (reliability) {
    console.log('Agent Reliability After Training:');
    console.log(`  Reliability:          ${(reliability.reliability * 100).toFixed(1)}%`);
    console.log(`  Avg Truth Score:      ${(reliability.avgTruthScore * 100).toFixed(1)}%`);
    console.log(`  Total Verifications:  ${reliability.totalVerifications}`);
    console.log(`  Recent Trend:         ${reliability.recentTrend}`);
  }

  // Make a prediction
  console.log('\nMaking prediction with trained model...');
  const prediction = await bridge.predict('new-task', agentId, agentType, {
    fileType: 'ts',
    complexity: 0.5
  });

  console.log(`  Predicted Score:  ${(prediction.predictedScore * 100).toFixed(1)}%`);
  console.log(`  Confidence:       ${(prediction.confidence * 100).toFixed(1)}%`);
  console.log(`  Risk Level:       ${prediction.riskLevel}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// Example 7: Helper Function Usage
// ============================================================================

async function helperFunctionsExample() {
  console.log('Example 7: Helper Function Usage\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Quick prediction
  console.log('Quick prediction using helper function:');
  const prediction = await predictVerification(
    'task-helper',
    'agent-helper',
    'coder',
    { fileType: 'ts' }
  );

  console.log(`  Score: ${(prediction.predictedScore * 100).toFixed(1)}%`);
  console.log(`  Risk:  ${prediction.riskLevel}\n`);

  // Quick threshold
  console.log('Quick threshold using helper function:');
  const threshold = await getAdaptiveThreshold('coder', { fileType: 'ts' });
  console.log(`  Threshold: ${(threshold * 100).toFixed(1)}%\n`);

  // Quick learning
  console.log('Quick learning using helper function:');
  const outcome: VerificationOutcome = {
    taskId: 'task-helper',
    agentId: 'agent-helper',
    agentType: 'coder',
    timestamp: new Date().toISOString(),
    passed: true,
    truthScore: 0.97,
    threshold: 0.95,
    componentScores: { compile: 1.0, tests: 0.95 },
    duration: 1000
  };

  await learnFromVerification(outcome);
  console.log('  Learning complete ✓\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// Main Runner
// ============================================================================

async function runAllExamples() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  VERIFICATION-NEURAL LEARNING INTEGRATION EXAMPLES');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');

  try {
    await basicExample();
    await adaptiveThresholdExample();
    await agentReliabilityExample();
    await patternAnalysisExample();
    await trainingExample();
    await helperFunctionsExample();
    await comprehensiveReportExample();

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  ALL EXAMPLES COMPLETED SUCCESSFULLY ✓');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('\n');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

// Export for use in other modules
export {
  basicExample,
  adaptiveThresholdExample,
  agentReliabilityExample,
  patternAnalysisExample,
  trainingExample,
  helperFunctionsExample,
  comprehensiveReportExample,
  runAllExamples
};
