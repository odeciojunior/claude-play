/**
 * Worker Agent - Hive-Mind Distributed Learning
 *
 * Specialized agents that execute tasks, learn from experience,
 * and share knowledge with the collective through the Queen.
 */

import { EventEmitter } from 'events';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import { LearningPipeline, Outcome } from '../neural/learning-pipeline';
import { Pattern, ExecutionContext } from '../neural/pattern-extraction';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type WorkerRole = 'architect' | 'researcher' | 'implementer' | 'tester' | 'reviewer';

export interface WorkerConfig {
  id: string;
  role: WorkerRole;
  capabilities: string[];
  learningRate: number;
  autonomy: number;
  specialization: string[];
}

export interface Task {
  id: string;
  description: string;
  context: ExecutionContext;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAt: string;
  deadline?: string;
}

export interface TaskResult {
  taskId: string;
  workerId: string;
  success: boolean;
  patterns: Pattern[];
  performanceMetrics: PerformanceMetrics;
  timestamp: string;
}

export interface PerformanceMetrics {
  durationMs: number;
  qualityScore: number;
  efficiencyScore: number;
  innovationScore: number;
}

export interface WorkerState {
  id: string;
  role: WorkerRole;
  status: 'idle' | 'working' | 'learning' | 'offline';
  currentTask?: Task;
  patternsLearned: number;
  tasksCompleted: number;
  performanceScore: number;
  lastActive: string;
}

// ============================================================================
// Worker Agent
// ============================================================================

export class WorkerAgent extends EventEmitter {
  private state: WorkerState;
  private learningPipeline: LearningPipeline;
  private learnedPatterns: Pattern[] = [];
  private taskHistory: TaskResult[] = [];

  constructor(
    private db: Database,
    private config: WorkerConfig
  ) {
    super();

    this.state = {
      id: config.id,
      role: config.role,
      status: 'idle',
      patternsLearned: 0,
      tasksCompleted: 0,
      performanceScore: 0.7,
      lastActive: new Date().toISOString()
    };

    // Initialize learning pipeline
    this.learningPipeline = new LearningPipeline(db, {
      observationBufferSize: 50,
      observationFlushInterval: 30000,
      extractionBatchSize: 10,
      minPatternQuality: 0.6,
      minConfidenceThreshold: 0.5,
      consolidationSchedule: 'hourly',
      autoLearning: true,
      maxPatternsPerType: 100
    });

    this.initialize();
  }

  /**
   * Initialize worker agent
   */
  private async initialize() {
    console.log(`🐝 Worker ${this.config.id} (${this.config.role}) initializing...`);

    // Listen to learning events
    this.learningPipeline.on('pattern_stored', (pattern: Pattern) => {
      this.handlePatternLearned(pattern);
    });

    this.learningPipeline.on('confidence_updated', (update: any) => {
      console.log(`🐝 ${this.config.id}: Pattern confidence updated`);
    });

    // Register with memory
    await this.registerWithHive();

    console.log(`🐝 Worker ${this.config.id} ready`);
    this.emit('worker_ready', this.state);
  }

  /**
   * Register with hive collective memory
   */
  private async registerWithHive() {
    const dbRun = promisify(this.db.run.bind(this.db));

    try {
      await dbRun(
        `INSERT OR REPLACE INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'hive-workers',
          `worker/${this.config.id}/status`,
          JSON.stringify(this.state),
          new Date().toISOString()
        ]
      );
    } catch (error) {
      console.error(`Worker ${this.config.id} registration failed:`, error);
    }
  }

  /**
   * Execute assigned task
   */
  async executeTask(task: Task): Promise<TaskResult> {
    console.log(`🐝 ${this.config.id}: Starting task ${task.id}`);

    this.state.status = 'working';
    this.state.currentTask = task;
    this.updateStatus();

    const startTime = Date.now();

    try {
      // Check for applicable patterns
      const patternApplication = await this.learningPipeline.applyBestPattern(
        task.description,
        task.context
      );

      // Execute task with observation
      const result = await this.learningPipeline.observe(
        'execute_task',
        { taskId: task.id, role: this.config.role },
        async () => {
          // Simulate task execution
          return await this.performTask(task, patternApplication.pattern);
        }
      );

      const durationMs = Date.now() - startTime;

      // Calculate performance metrics
      const metrics = this.calculatePerformanceMetrics(durationMs, result);

      // Track outcome for learning
      if (patternApplication.applied && patternApplication.patternId) {
        await this.learningPipeline.trackOutcome({
          taskId: task.id,
          patternId: patternApplication.patternId,
          status: result.success ? 'success' : 'failure',
          confidence: metrics.qualityScore,
          metrics: {
            durationMs,
            errorCount: result.success ? 0 : 1,
            improvementVsBaseline: metrics.efficiencyScore
          },
          judgeReasons: [`Executed by ${this.config.role}`],
          timestamp: new Date().toISOString()
        });
      }

      // Update worker state
      this.state.tasksCompleted++;
      this.updatePerformanceScore(metrics);
      this.state.status = 'idle';
      this.state.currentTask = undefined;
      this.updateStatus();

      const taskResult: TaskResult = {
        taskId: task.id,
        workerId: this.config.id,
        success: result.success,
        patterns: this.learnedPatterns.slice(-5), // Last 5 patterns
        performanceMetrics: metrics,
        timestamp: new Date().toISOString()
      };

      this.taskHistory.push(taskResult);

      console.log(
        `🐝 ${this.config.id}: Task ${task.id} completed ` +
        `(quality: ${(metrics.qualityScore * 100).toFixed(0)}%)`
      );

      this.emit('task_completed', taskResult);
      return taskResult;

    } catch (error) {
      console.error(`🐝 ${this.config.id}: Task ${task.id} failed:`, error);

      this.state.status = 'idle';
      this.state.currentTask = undefined;
      this.updateStatus();

      const failedResult: TaskResult = {
        taskId: task.id,
        workerId: this.config.id,
        success: false,
        patterns: [],
        performanceMetrics: {
          durationMs: Date.now() - startTime,
          qualityScore: 0,
          efficiencyScore: 0,
          innovationScore: 0
        },
        timestamp: new Date().toISOString()
      };

      this.emit('task_failed', failedResult);
      return failedResult;
    }
  }

  /**
   * Perform task based on role
   */
  private async performTask(task: Task, pattern?: Pattern): Promise<any> {
    // Simulate role-specific work
    const baseTime = 1000;
    const roleMultiplier = {
      architect: 1.5,
      researcher: 1.8,
      implementer: 1.2,
      tester: 1.0,
      reviewer: 1.3
    };

    const workTime = baseTime * roleMultiplier[this.config.role];

    // If pattern exists, work is faster
    const actualTime = pattern ? workTime * 0.6 : workTime;

    await new Promise(resolve => setTimeout(resolve, actualTime));

    // Success rate based on role and pattern
    const baseSuccess = 0.8;
    const patternBonus = pattern ? 0.15 : 0;
    const success = Math.random() < (baseSuccess + patternBonus);

    return {
      success,
      usedPattern: !!pattern,
      workTime: actualTime
    };
  }

  /**
   * Handle newly learned pattern
   */
  private handlePatternLearned(pattern: Pattern) {
    this.learnedPatterns.push(pattern);
    this.state.patternsLearned++;

    console.log(
      `🐝 ${this.config.id}: Learned pattern ${pattern.id} ` +
      `(confidence: ${(pattern.confidence * 100).toFixed(0)}%)`
    );

    // Share high-quality patterns with collective
    if (pattern.confidence >= 0.8) {
      this.sharePatternWithCollective(pattern);
    }

    this.emit('pattern_learned', pattern);
  }

  /**
   * Share pattern with collective memory
   */
  private async sharePatternWithCollective(pattern: Pattern) {
    const dbRun = promisify(this.db.run.bind(this.db));

    try {
      await dbRun(
        `INSERT INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'hive-collective',
          `pattern/${pattern.id}`,
          JSON.stringify({
            pattern,
            contributedBy: this.config.id,
            role: this.config.role,
            timestamp: new Date().toISOString()
          }),
          new Date().toISOString()
        ]
      );

      console.log(`🐝 ${this.config.id}: Shared pattern ${pattern.id} with collective`);
      this.emit('pattern_shared', pattern);
    } catch (error) {
      console.error('Failed to share pattern:', error);
    }
  }

  /**
   * Learn from collective patterns
   */
  async learnFromCollective(): Promise<number> {
    console.log(`🐝 ${this.config.id}: Learning from collective...`);

    const dbAll = promisify(this.db.all.bind(this.db));

    try {
      const rows = await dbAll(
        `SELECT value FROM memory_entries
         WHERE namespace = 'hive-collective'
         AND key LIKE 'pattern/%'
         ORDER BY created_at DESC
         LIMIT 20`
      );

      let learnedCount = 0;

      for (const row of rows) {
        const { pattern } = JSON.parse(row.value);

        // Check if pattern is relevant to role
        if (this.isPatternRelevant(pattern)) {
          await this.learningPipeline.train(pattern);
          learnedCount++;
        }
      }

      console.log(`🐝 ${this.config.id}: Learned ${learnedCount} patterns from collective`);
      return learnedCount;
    } catch (error) {
      console.error('Failed to learn from collective:', error);
      return 0;
    }
  }

  /**
   * Check if pattern is relevant to worker's role
   */
  private isPatternRelevant(pattern: Pattern): boolean {
    const roleKeywords = {
      architect: ['design', 'architecture', 'system', 'component'],
      researcher: ['research', 'analysis', 'investigation', 'study'],
      implementer: ['implement', 'code', 'build', 'develop'],
      tester: ['test', 'validate', 'verify', 'quality'],
      reviewer: ['review', 'assess', 'evaluate', 'critique']
    };

    const keywords = roleKeywords[this.config.role];
    const patternText = `${pattern.name} ${pattern.description || ''}`.toLowerCase();

    return keywords.some(kw => patternText.includes(kw));
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    durationMs: number,
    result: any
  ): PerformanceMetrics {
    // Quality score based on success and role
    const qualityScore = result.success ? (0.7 + Math.random() * 0.3) : 0.3;

    // Efficiency score based on duration and pattern usage
    const expectedDuration = 2000;
    const efficiencyScore = result.usedPattern
      ? Math.min(1, expectedDuration / durationMs)
      : Math.min(0.8, expectedDuration / durationMs);

    // Innovation score (higher if no pattern was used but succeeded)
    const innovationScore = !result.usedPattern && result.success
      ? 0.8 + Math.random() * 0.2
      : 0.5;

    return {
      durationMs,
      qualityScore,
      efficiencyScore,
      innovationScore
    };
  }

  /**
   * Update worker performance score
   */
  private updatePerformanceScore(metrics: PerformanceMetrics) {
    // Weighted average of quality, efficiency, and innovation
    const taskScore =
      metrics.qualityScore * 0.5 +
      metrics.efficiencyScore * 0.3 +
      metrics.innovationScore * 0.2;

    // Exponential moving average
    const alpha = 0.2;
    this.state.performanceScore =
      alpha * taskScore + (1 - alpha) * this.state.performanceScore;
  }

  /**
   * Update worker status in memory
   */
  private async updateStatus() {
    this.state.lastActive = new Date().toISOString();

    const dbRun = promisify(this.db.run.bind(this.db));

    try {
      await dbRun(
        `INSERT OR REPLACE INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'hive-workers',
          `worker/${this.config.id}/status`,
          JSON.stringify(this.state),
          new Date().toISOString()
        ]
      );
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  /**
   * Get worker state
   */
  getState(): WorkerState {
    return { ...this.state };
  }

  /**
   * Get learned patterns
   */
  getLearnedPatterns(): Pattern[] {
    return [...this.learnedPatterns];
  }

  /**
   * Get task history
   */
  getTaskHistory(): TaskResult[] {
    return [...this.taskHistory];
  }

  /**
   * Shutdown worker
   */
  async shutdown() {
    console.log(`🐝 ${this.config.id}: Shutting down...`);

    this.state.status = 'offline';
    await this.updateStatus();
    await this.learningPipeline.shutdown();

    this.emit('worker_shutdown', this.config.id);
  }
}

export default WorkerAgent;
