/**
 * Hive-Mind Coordinator - Complete Integration
 *
 * Orchestrates queen-worker architecture with Byzantine consensus,
 * pattern aggregation, and distributed learning across the swarm.
 */

import { EventEmitter } from 'events';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import { QueenCoordinator } from './queen-coordinator';
import { WorkerAgent, WorkerConfig, Task } from './worker-agent';
import { ByzantineConsensus, ConsensusNode } from './byzantine-consensus';
import { PatternAggregator } from './pattern-aggregation';
import { Pattern } from '../neural/pattern-extraction';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface HiveMindConfig {
  maxWorkers: number;
  consensusThreshold: number;
  healthCheckInterval: number;
  statusReportInterval: number;
  aggregationInterval: number;
  minContributors: number;
  minConsensusScore: number;
  conflictThreshold: number;
}

export interface HiveMindStatus {
  queen: 'active' | 'inactive';
  workers: number;
  activeWorkers: number;
  patternsAggregated: number;
  consensusNodes: number;
  collectiveIntelligence: number; // 0-1
  lastUpdate: string;
}

export interface SwarmTask {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredWorkers: number;
  strategy: 'parallel' | 'sequential' | 'adaptive';
  assignedWorkers: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
}

// ============================================================================
// Hive-Mind Coordinator
// ============================================================================

export class HiveMindCoordinator extends EventEmitter {
  private queen: QueenCoordinator;
  private workers: Map<string, WorkerAgent> = new Map();
  private consensus: ByzantineConsensus;
  private aggregator: PatternAggregator;
  private activeTasks: Map<string, SwarmTask> = new Map();
  private status: HiveMindStatus;

  constructor(
    private db: Database,
    private config: HiveMindConfig
  ) {
    super();

    // Initialize Byzantine consensus
    this.consensus = new ByzantineConsensus({
      minNodes: 3,
      defaultQuorum: 0.6,
      defaultConsensus: config.consensusThreshold,
      roundTimeout: 30000,
      maxRounds: 3,
      reputationDecayRate: 0.1
    });

    // Initialize pattern aggregator
    this.aggregator = new PatternAggregator(db, this.consensus, {
      aggregationInterval: config.aggregationInterval,
      minContributors: config.minContributors,
      minConsensusScore: config.minConsensusScore,
      conflictThreshold: config.conflictThreshold
    });

    // Initialize Queen
    this.queen = new QueenCoordinator(db, {
      maxWorkers: config.maxWorkers,
      consensusThreshold: config.consensusThreshold,
      healthCheckInterval: config.healthCheckInterval,
      statusReportInterval: config.statusReportInterval
    });

    this.status = {
      queen: 'active',
      workers: 0,
      activeWorkers: 0,
      patternsAggregated: 0,
      consensusNodes: 0,
      collectiveIntelligence: 0.75,
      lastUpdate: new Date().toISOString()
    };

    this.initialize();
  }

  /**
   * Initialize hive-mind
   */
  private async initialize() {
    console.log('🐝 Hive-Mind Coordinator initializing...');

    // Set up event listeners
    this.setupEventListeners();

    // Initialize default workers
    await this.spawnDefaultWorkers();

    console.log('🐝 Hive-Mind Coordinator ready');
    this.emit('hive_mind_ready', this.status);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners() {
    // Queen events
    this.queen.on('sovereignty_established', () => {
      console.log('🐝 Queen sovereignty established');
    });

    this.queen.on('patterns_aggregated', (patterns: Pattern[]) => {
      console.log(`🐝 Queen aggregated ${patterns.length} patterns`);
    });

    this.queen.on('consensus_complete', (result: any) => {
      console.log(`🐝 Consensus complete: ${result.approved ? 'APPROVED' : 'REJECTED'}`);
    });

    // Worker events
    this.on('worker_pattern_learned', (data: { workerId: string; pattern: Pattern }) => {
      this.handleWorkerPatternLearned(data.workerId, data.pattern);
    });

    // Aggregator events
    this.aggregator.on('pattern_validated', (aggregated: any) => {
      console.log(`🐝 Pattern validated by collective: ${aggregated.basePattern.id}`);
      this.status.patternsAggregated++;
      this.updateCollectiveIntelligence();
    });

    this.aggregator.on('conflict_resolved', (resolution: any) => {
      console.log(`🐝 Conflict resolved: ${resolution.resolutionStrategy}`);
    });

    // Consensus events
    this.consensus.on('node_quarantined', (nodeId: string) => {
      console.log(`🐝 Node quarantined: ${nodeId}`);
    });
  }

  /**
   * Spawn default workers
   */
  private async spawnDefaultWorkers() {
    const defaultWorkerConfigs: WorkerConfig[] = [
      {
        id: 'worker-architect-1',
        role: 'architect',
        capabilities: ['system-design', 'architecture-patterns'],
        learningRate: 0.1,
        autonomy: 0.8,
        specialization: ['architecture', 'design']
      },
      {
        id: 'worker-researcher-1',
        role: 'researcher',
        capabilities: ['information-gathering', 'analysis'],
        learningRate: 0.15,
        autonomy: 0.9,
        specialization: ['research', 'analysis']
      },
      {
        id: 'worker-implementer-1',
        role: 'implementer',
        capabilities: ['coding', 'debugging', 'integration'],
        learningRate: 0.12,
        autonomy: 0.7,
        specialization: ['implementation', 'coding']
      },
      {
        id: 'worker-tester-1',
        role: 'tester',
        capabilities: ['testing', 'validation', 'quality-assurance'],
        learningRate: 0.1,
        autonomy: 0.8,
        specialization: ['testing', 'quality']
      },
      {
        id: 'worker-reviewer-1',
        role: 'reviewer',
        capabilities: ['code-review', 'quality-assessment'],
        learningRate: 0.1,
        autonomy: 0.8,
        specialization: ['review', 'quality']
      }
    ];

    for (const config of defaultWorkerConfigs) {
      await this.spawnWorker(config);
    }

    console.log(`🐝 Spawned ${defaultWorkerConfigs.length} default workers`);
  }

  /**
   * Spawn new worker
   */
  async spawnWorker(config: WorkerConfig): Promise<WorkerAgent> {
    const worker = new WorkerAgent(this.db, config);

    // Register worker
    this.workers.set(config.id, worker);

    // Register with queen
    await this.queen.registerWorker({
      id: config.id,
      role: config.role,
      capabilities: config.capabilities,
      learningPatterns: [],
      performanceScore: 0.7,
      lastActive: new Date().toISOString()
    });

    // Register as consensus node
    this.consensus.registerNode({
      id: config.id,
      reputation: 0.7,
      responseTime: 100,
      reliability: 0.8,
      lastSeen: new Date().toISOString()
    });

    // Set up worker event listeners
    worker.on('pattern_learned', (pattern: Pattern) => {
      this.emit('worker_pattern_learned', { workerId: config.id, pattern });
    });

    worker.on('task_completed', (result: any) => {
      console.log(`🐝 Worker ${config.id} completed task: ${result.taskId}`);
    });

    this.status.workers++;
    this.status.consensusNodes++;
    this.updateStatus();

    console.log(`🐝 Worker spawned: ${config.id} (${config.role})`);
    this.emit('worker_spawned', worker);

    return worker;
  }

  /**
   * Handle worker pattern learned
   */
  private async handleWorkerPatternLearned(workerId: string, pattern: Pattern) {
    console.log(`🐝 Worker ${workerId} learned pattern: ${pattern.id}`);

    // Submit to aggregator
    await this.aggregator.submitPattern({
      pattern,
      contributorId: workerId,
      contributorRole: this.workers.get(workerId)?.getState().role || 'unknown',
      contribution_score: pattern.confidence,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Orchestrate swarm task
   */
  async orchestrateTask(description: string, options: {
    priority?: 'low' | 'medium' | 'high' | 'critical';
    requiredWorkers?: number;
    strategy?: 'parallel' | 'sequential' | 'adaptive';
  } = {}): Promise<SwarmTask> {
    const task: SwarmTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description,
      priority: options.priority || 'medium',
      requiredWorkers: options.requiredWorkers || 3,
      strategy: options.strategy || 'adaptive',
      assignedWorkers: [],
      status: 'pending',
      startedAt: new Date().toISOString()
    };

    this.activeTasks.set(task.id, task);

    console.log(
      `🐝 Orchestrating task: ${task.id} (${task.strategy}, priority: ${task.priority})`
    );

    // Select workers based on task requirements
    const selectedWorkers = await this.selectWorkersForTask(task);
    task.assignedWorkers = selectedWorkers.map(w => w.getState().id);

    // Delegate task execution
    task.status = 'in-progress';

    if (task.strategy === 'parallel') {
      await this.executeParallel(task, selectedWorkers);
    } else if (task.strategy === 'sequential') {
      await this.executeSequential(task, selectedWorkers);
    } else {
      await this.executeAdaptive(task, selectedWorkers);
    }

    task.status = 'completed';
    task.completedAt = new Date().toISOString();

    console.log(`🐝 Task completed: ${task.id}`);
    this.emit('task_completed', task);

    return task;
  }

  /**
   * Select workers for task
   */
  private async selectWorkersForTask(task: SwarmTask): Promise<WorkerAgent[]> {
    const availableWorkers = Array.from(this.workers.values())
      .filter(w => w.getState().status === 'idle')
      .sort((a, b) => b.getState().performanceScore - a.getState().performanceScore);

    return availableWorkers.slice(0, task.requiredWorkers);
  }

  /**
   * Execute task in parallel
   */
  private async executeParallel(task: SwarmTask, workers: WorkerAgent[]) {
    console.log(`🐝 Executing task ${task.id} in parallel with ${workers.length} workers`);

    const subtaskPromises = workers.map((worker, index) => {
      const subtask: Task = {
        id: `${task.id}-subtask-${index}`,
        description: `${task.description} (part ${index + 1}/${workers.length})`,
        context: {
          taskId: task.id,
          agentId: worker.getState().id,
          workingDirectory: process.cwd(),
          activePatterns: [],
          priorSteps: 0,
          environmentVars: {}
        },
        priority: task.priority,
        assignedAt: new Date().toISOString()
      };

      return worker.executeTask(subtask);
    });

    await Promise.all(subtaskPromises);
  }

  /**
   * Execute task sequentially
   */
  private async executeSequential(task: SwarmTask, workers: WorkerAgent[]) {
    console.log(`🐝 Executing task ${task.id} sequentially with ${workers.length} workers`);

    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i];
      const subtask: Task = {
        id: `${task.id}-subtask-${i}`,
        description: `${task.description} (step ${i + 1}/${workers.length})`,
        context: {
          taskId: task.id,
          agentId: worker.getState().id,
          workingDirectory: process.cwd(),
          activePatterns: [],
          priorSteps: i,
          environmentVars: {}
        },
        priority: task.priority,
        assignedAt: new Date().toISOString()
      };

      await worker.executeTask(subtask);
    }
  }

  /**
   * Execute task adaptively
   */
  private async executeAdaptive(task: SwarmTask, workers: WorkerAgent[]) {
    console.log(`🐝 Executing task ${task.id} adaptively`);

    // Start with parallel execution, switch to sequential if needed
    try {
      await this.executeParallel(task, workers);
    } catch (error) {
      console.log('🐝 Switching to sequential execution');
      await this.executeSequential(task, workers);
    }
  }

  /**
   * Trigger collective learning session
   */
  async triggerCollectiveLearning() {
    console.log('🐝 Triggering collective learning session...');

    // Each worker learns from collective patterns
    let totalLearned = 0;

    for (const [workerId, worker] of this.workers) {
      const learned = await worker.learnFromCollective();
      totalLearned += learned;
    }

    // Queen aggregates patterns
    const aggregated = await this.queen.aggregateWorkerPatterns();

    console.log(
      `🐝 Collective learning complete: ` +
      `${totalLearned} patterns learned, ${aggregated.length} patterns aggregated`
    );

    this.updateCollectiveIntelligence();

    this.emit('collective_learning_complete', {
      patternsLearned: totalLearned,
      patternsAggregated: aggregated.length
    });
  }

  /**
   * Update collective intelligence score
   */
  private updateCollectiveIntelligence() {
    // Calculate based on patterns aggregated and worker performance
    const avgWorkerPerformance = Array.from(this.workers.values())
      .reduce((sum, w) => sum + w.getState().performanceScore, 0) /
      Math.max(1, this.workers.size);

    const patternDensity = Math.min(1, this.status.patternsAggregated / 100);

    this.status.collectiveIntelligence =
      avgWorkerPerformance * 0.6 + patternDensity * 0.4;
  }

  /**
   * Update status
   */
  private updateStatus() {
    this.status.activeWorkers = Array.from(this.workers.values())
      .filter(w => w.getState().status === 'working').length;

    this.status.lastUpdate = new Date().toISOString();

    this.emit('status_updated', this.status);
  }

  /**
   * Get hive-mind status
   */
  getStatus(): HiveMindStatus {
    this.updateStatus();
    return { ...this.status };
  }

  /**
   * Get queen coordinator
   */
  getQueen(): QueenCoordinator {
    return this.queen;
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): WorkerAgent | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): WorkerAgent[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get consensus system
   */
  getConsensus(): ByzantineConsensus {
    return this.consensus;
  }

  /**
   * Get aggregator
   */
  getAggregator(): PatternAggregator {
    return this.aggregator;
  }

  /**
   * Shutdown hive-mind
   */
  async shutdown() {
    console.log('🐝 Shutting down Hive-Mind Coordinator...');

    // Shutdown all workers
    for (const [workerId, worker] of this.workers) {
      await worker.shutdown();
    }

    // Shutdown aggregator
    await this.aggregator.shutdown();

    // Shutdown queen
    await this.queen.shutdown();

    this.status.queen = 'inactive';

    console.log('🐝 Hive-Mind Coordinator shut down');
    this.emit('hive_mind_shutdown');
  }
}

export default HiveMindCoordinator;
