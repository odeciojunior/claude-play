/**
 * SAFLA Neural Verification Bridge
 *
 * This module provides the integration bridge between the verification system
 * and the neural learning system. It handles:
 * 1. Outcome capture from verification runs
 * 2. Pre-verification predictions
 * 3. Adaptive threshold recommendations
 * 4. Real-time learning feedback
 *
 * Usage:
 * - Import this bridge in verification commands
 * - Call predict() before verification
 * - Call learn() after verification
 * - Query patterns and reliability as needed
 */

import { Database } from 'sqlite3';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import VerificationLearningSystem, {
  VerificationOutcome,
  TruthScorePrediction,
  VerificationLearningConfig
} from './verification-learning';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: VerificationLearningConfig = {
  predictionEnabled: true,
  adaptiveThresholds: true,
  minSampleSize: 10,
  confidenceThreshold: 0.7,
  learningRate: 0.1,
  decayFactor: 0.95
};

// ============================================================================
// Verification Bridge
// ============================================================================

export class VerificationBridge {
  private system: VerificationLearningSystem | null = null;
  private db: Database | null = null;
  private initialized: boolean = false;

  constructor(
    private dbPath: string = '.swarm/memory.db',
    private config: VerificationLearningConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Initialize the verification bridge
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize database
      const sqlite3 = require('sqlite3').verbose();
      this.db = new sqlite3.Database(this.dbPath);

      // Promisify database methods
      this.db.run = promisify(this.db.run.bind(this.db)) as any;
      this.db.get = promisify(this.db.get.bind(this.db)) as any;
      this.db.all = promisify(this.db.all.bind(this.db)) as any;

      // Load schema
      await this.loadSchema();

      // Initialize learning system
      this.system = new VerificationLearningSystem(this.db, this.config);

      this.initialized = true;
      console.log('✓ Verification bridge initialized');
    } catch (error) {
      console.error('Failed to initialize verification bridge:', error);
      throw error;
    }
  }

  /**
   * Load database schema
   */
  private async loadSchema(): Promise<void> {
    const schemaPath = path.join(__dirname, 'verification-schema.sql');

    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const statements = schema.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          await this.db!.run(statement);
        }
      }

      console.log('✓ Verification schema loaded');
    } else {
      console.warn('⚠ Schema file not found, using existing schema');
    }
  }

  /**
   * Predict truth score before verification
   */
  async predict(
    taskId: string,
    agentId: string,
    agentType: string,
    context: {
      fileType?: string;
      complexity?: number;
      linesChanged?: number;
      testsRun?: number;
    } = {}
  ): Promise<TruthScorePrediction> {
    this.ensureInitialized();

    try {
      const prediction = await this.system!.predictTruthScore(
        taskId,
        agentId,
        agentType,
        context as any
      );

      // Store prediction
      await this.storePrediction(prediction);

      return prediction;
    } catch (error) {
      console.error('Prediction failed:', error);
      throw error;
    }
  }

  /**
   * Learn from verification outcome
   */
  async learn(outcome: VerificationOutcome): Promise<void> {
    this.ensureInitialized();

    try {
      // Store outcome
      await this.storeOutcome(outcome);

      // Learn from outcome
      await this.system!.learnFromVerification(outcome);

      // Update prediction if exists
      await this.updatePredictionActual(outcome);

      console.log(
        `✓ Learned from verification: ${outcome.taskId} (score: ${outcome.truthScore.toFixed(3)}, ${outcome.passed ? 'PASS' : 'FAIL'})`
      );
    } catch (error) {
      console.error('Learning failed:', error);
      throw error;
    }
  }

  /**
   * Get adaptive threshold for agent and context
   */
  async getThreshold(
    agentType: string,
    context?: { fileType?: string }
  ): Promise<number> {
    this.ensureInitialized();

    try {
      return await this.system!.getAdaptiveThreshold(agentType, context);
    } catch (error) {
      console.error('Failed to get adaptive threshold:', error);
      return 0.95; // Default
    }
  }

  /**
   * Get agent reliability
   */
  async getReliability(agentId: string): Promise<any> {
    this.ensureInitialized();

    try {
      return await this.system!.getAgentReliability(agentId);
    } catch (error) {
      console.error('Failed to get agent reliability:', error);
      return null;
    }
  }

  /**
   * Get verification patterns
   */
  async getPatterns(type?: 'success' | 'failure' | 'warning'): Promise<any[]> {
    this.ensureInitialized();

    try {
      return await this.system!.getVerificationPatterns(type);
    } catch (error) {
      console.error('Failed to get patterns:', error);
      return [];
    }
  }

  /**
   * Get learning metrics
   */
  async getMetrics(): Promise<any> {
    this.ensureInitialized();

    try {
      const metrics = await this.system!.getMetrics();

      // Add prediction accuracy
      const predictionStats = await this.getPredictionStats();

      return {
        ...metrics,
        predictionAccuracy: predictionStats.accuracy,
        avgPredictionError: predictionStats.avgError,
        totalPredictions: predictionStats.total
      };
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return null;
    }
  }

  /**
   * Generate report
   */
  async generateReport(): Promise<string> {
    this.ensureInitialized();

    const metrics = await this.getMetrics();
    const patterns = await this.getPatterns();
    const reliability = await this.system!.getAllAgentReliability();
    const thresholds = await this.system!.getAllThresholds();

    let report = '═══════════════════════════════════════════════════════════\n';
    report += '          VERIFICATION LEARNING SYSTEM REPORT\n';
    report += '═══════════════════════════════════════════════════════════\n\n';

    // Overall Metrics
    report += '📊 OVERALL METRICS\n';
    report += '───────────────────────────────────────────────────────────\n';
    report += `  Patterns Learned:     ${metrics.patterns?.total || 0}\n`;
    report += `  Agents Tracked:       ${metrics.agents?.totalAgents || 0}\n`;
    report += `  Adaptive Thresholds:  ${metrics.thresholds?.totalThresholds || 0}\n`;
    report += `  Predictions Made:     ${metrics.totalPredictions || 0}\n`;
    report += `  Prediction Accuracy:  ${(metrics.predictionAccuracy * 100).toFixed(1)}%\n`;
    report += `  Avg Prediction Error: ${(metrics.avgPredictionError * 100).toFixed(1)}%\n\n`;

    // Top Patterns
    report += '🎯 TOP VERIFICATION PATTERNS\n';
    report += '───────────────────────────────────────────────────────────\n';
    const topPatterns = patterns.slice(0, 5);
    for (const pattern of topPatterns) {
      report += `  ${pattern.type.toUpperCase().padEnd(8)} ${pattern.name}\n`;
      report += `    Occurrences:  ${pattern.occurrences}\n`;
      report += `    Success Rate: ${(pattern.successRate * 100).toFixed(1)}%\n`;
      report += `    Confidence:   ${(pattern.confidence * 100).toFixed(1)}%\n\n`;
    }

    // Agent Reliability
    report += '👥 AGENT RELIABILITY (TOP 5)\n';
    report += '───────────────────────────────────────────────────────────\n';
    const topAgents = reliability.slice(0, 5);
    for (const agent of topAgents) {
      report += `  ${agent.agentId.padEnd(20)} (${agent.agentType})\n`;
      report += `    Reliability:       ${(agent.reliability * 100).toFixed(1)}%\n`;
      report += `    Avg Truth Score:   ${(agent.avgTruthScore * 100).toFixed(1)}%\n`;
      report += `    Verifications:     ${agent.totalVerifications}\n`;
      report += `    Trend:             ${agent.recentTrend}\n\n`;
    }

    // Adaptive Thresholds
    report += '⚙️  ADAPTIVE THRESHOLDS (TOP 5)\n';
    report += '───────────────────────────────────────────────────────────\n';
    const topThresholds = thresholds.slice(0, 5);
    for (const threshold of topThresholds) {
      const context = threshold.fileType ? ` (${threshold.fileType})` : ' (any)';
      report += `  ${threshold.agentType}${context}\n`;
      report += `    Base:      ${(threshold.baseThreshold * 100).toFixed(1)}%\n`;
      report += `    Adjusted:  ${(threshold.adjustedThreshold * 100).toFixed(1)}%\n`;
      report += `    Samples:   ${threshold.sampleSize}\n\n`;
    }

    report += '═══════════════════════════════════════════════════════════\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += '═══════════════════════════════════════════════════════════\n';

    return report;
  }

  /**
   * Shutdown the bridge
   */
  async shutdown(): Promise<void> {
    if (this.system) {
      await this.system.shutdown();
    }

    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    this.initialized = false;
    console.log('✓ Verification bridge shut down');
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized || !this.system) {
      throw new Error('Verification bridge not initialized. Call initialize() first.');
    }
  }

  private async storeOutcome(outcome: VerificationOutcome): Promise<void> {
    await this.db!.run(
      `INSERT INTO verification_outcomes
       (id, task_id, agent_id, agent_type, timestamp, passed, truth_score, threshold,
        component_scores, file_type, complexity, lines_changed, tests_run, duration,
        error_messages, warnings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.generateId(),
        outcome.taskId,
        outcome.agentId,
        outcome.agentType,
        outcome.timestamp,
        outcome.passed ? 1 : 0,
        outcome.truthScore,
        outcome.threshold,
        JSON.stringify(outcome.componentScores),
        outcome.fileType,
        outcome.complexity,
        outcome.linesChanged,
        outcome.testsRun,
        outcome.duration,
        JSON.stringify(outcome.errorMessages || []),
        JSON.stringify(outcome.warnings || [])
      ]
    );
  }

  private async storePrediction(prediction: TruthScorePrediction): Promise<void> {
    await this.db!.run(
      `INSERT INTO truth_score_predictions
       (id, task_id, agent_id, timestamp, predicted_score, confidence,
        recommended_threshold, risk_level, factors)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.generateId(),
        prediction.taskId,
        '', // Agent ID filled in from context
        new Date().toISOString(),
        prediction.predictedScore,
        prediction.confidence,
        prediction.recommendedThreshold,
        prediction.riskLevel,
        JSON.stringify(prediction.factors)
      ]
    );
  }

  private async updatePredictionActual(outcome: VerificationOutcome): Promise<void> {
    await this.db!.run(
      `UPDATE truth_score_predictions
       SET actual_score = ?, prediction_error = ABS(actual_score - predicted_score)
       WHERE task_id = ?`,
      [outcome.truthScore, outcome.taskId]
    );
  }

  private async getPredictionStats(): Promise<{ accuracy: number; avgError: number; total: number }> {
    const row = await this.db!.get(`
      SELECT
        COUNT(*) as total,
        AVG(CASE WHEN prediction_error < 0.1 THEN 1.0 ELSE 0.0 END) as accuracy,
        AVG(prediction_error) as avg_error
      FROM truth_score_predictions
      WHERE actual_score IS NOT NULL
    `);

    return {
      total: row?.total || 0,
      accuracy: row?.accuracy || 0,
      avgError: row?.avg_error || 0
    };
  }

  private generateId(): string {
    return `vb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let bridgeInstance: VerificationBridge | null = null;

/**
 * Get singleton verification bridge instance
 */
export async function getVerificationBridge(): Promise<VerificationBridge> {
  if (!bridgeInstance) {
    bridgeInstance = new VerificationBridge();
    await bridgeInstance.initialize();
  }
  return bridgeInstance;
}

/**
 * Helper function: Predict before verification
 */
export async function predictVerification(
  taskId: string,
  agentId: string,
  agentType: string,
  context?: any
): Promise<TruthScorePrediction> {
  const bridge = await getVerificationBridge();
  return await bridge.predict(taskId, agentId, agentType, context);
}

/**
 * Helper function: Learn after verification
 */
export async function learnFromVerification(outcome: VerificationOutcome): Promise<void> {
  const bridge = await getVerificationBridge();
  return await bridge.learn(outcome);
}

/**
 * Helper function: Get adaptive threshold
 */
export async function getAdaptiveThreshold(
  agentType: string,
  context?: { fileType?: string }
): Promise<number> {
  const bridge = await getVerificationBridge();
  return await bridge.getThreshold(agentType, context);
}

// ============================================================================
// Exports
// ============================================================================

export default VerificationBridge;
