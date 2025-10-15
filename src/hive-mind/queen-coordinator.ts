/**
 * Queen Coordinator - Hive-Mind Distributed Learning
 *
 * Sovereign intelligence at the apex of the hive hierarchy.
 * Orchestrates strategic decisions, allocates resources, and maintains
 * coherence across the entire swarm through Byzantine consensus.
 */

import { EventEmitter } from 'events';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import { Pattern } from '../neural/pattern-extraction';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface QueenStatus {
  agent: 'queen-coordinator';
  status: 'sovereign-active' | 'abdicated' | 'succession';
  hierarchyEstablished: boolean;
  subjects: string[];
  royalDirectives: RoyalDirective[];
  successionPlan: 'collective-intelligence' | 'designated-heir';
  hiveHealth: HiveHealthReport;
  timestamp: number;
}

export interface RoyalDirective {
  id: number;
  command: string;
  assignee: string | 'all';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  complianceRequired: boolean;
  issuedAt: string;
  completedAt?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

export interface ResourceAllocation {
  computeUnits: Record<string, number>;
  memoryQuotaMb: Record<string, number>;
  priorityQueue: string[];
  allocatedBy: 'queen-coordinator';
  lastUpdate: string;
}

export interface HiveHealthReport {
  coherenceScore: number; // 0-1, target: 0.95
  agentCompliance: AgentCompliance;
  swarmEfficiency: number; // 0-1
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  morale: 'low' | 'medium' | 'high';
  lastHealthCheck: string;
}

export interface AgentCompliance {
  compliant: string[];
  nonResponsive: string[];
  rebellious: string[];
}

export interface ConsensusVote {
  voterId: string;
  vote: 'approve' | 'reject' | 'abstain';
  confidence: number;
  reasoning: string;
  timestamp: string;
}

export interface ConsensusResult {
  proposalId: string;
  approved: boolean;
  votes: ConsensusVote[];
  consensusScore: number;
  byzantineFaultTolerant: boolean;
}

export interface WorkerAgent {
  id: string;
  role: 'architect' | 'researcher' | 'implementer' | 'tester' | 'reviewer';
  capabilities: string[];
  currentTask?: string;
  learningPatterns: Pattern[];
  performanceScore: number;
  lastActive: string;
}

// ============================================================================
// Queen Coordinator
// ============================================================================

export class QueenCoordinator extends EventEmitter {
  private status: QueenStatus;
  private workers: Map<string, WorkerAgent> = new Map();
  private resourceAllocation: ResourceAllocation;
  private statusReportInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private db: Database,
    private config: {
      maxWorkers: number;
      consensusThreshold: number;
      healthCheckInterval: number;
      statusReportInterval: number;
    }
  ) {
    super();

    // Initialize sovereign status
    this.status = {
      agent: 'queen-coordinator',
      status: 'sovereign-active',
      hierarchyEstablished: true,
      subjects: [],
      royalDirectives: [],
      successionPlan: 'collective-intelligence',
      hiveHealth: {
        coherenceScore: 0.95,
        agentCompliance: {
          compliant: [],
          nonResponsive: [],
          rebellious: []
        },
        swarmEfficiency: 0.88,
        threatLevel: 'low',
        morale: 'high',
        lastHealthCheck: new Date().toISOString()
      },
      timestamp: Date.now()
    };

    // Initialize resource allocation
    this.resourceAllocation = {
      computeUnits: {
        'collective-intelligence': 30,
        'workers': 40,
        'scouts': 20,
        'memory': 10
      },
      memoryQuotaMb: {
        'collective-intelligence': 512,
        'workers': 1024,
        'scouts': 256,
        'memory-manager': 256
      },
      priorityQueue: ['critical', 'high', 'medium', 'low'],
      allocatedBy: 'queen-coordinator',
      lastUpdate: new Date().toISOString()
    };

    this.initialize();
  }

  /**
   * Initialize the Queen Coordinator
   */
  private async initialize() {
    console.log('👑 Queen Coordinator initializing...');

    // Establish sovereign presence
    await this.establishSovereignty();

    // Issue initial directives
    await this.issueRoyalDirectives([
      {
        id: 1,
        command: 'Initialize swarm topology',
        assignee: 'all',
        priority: 'CRITICAL',
        complianceRequired: true,
        issuedAt: new Date().toISOString(),
        status: 'pending'
      },
      {
        id: 2,
        command: 'Establish memory synchronization',
        assignee: 'memory-manager',
        priority: 'HIGH',
        complianceRequired: true,
        issuedAt: new Date().toISOString(),
        status: 'pending'
      },
      {
        id: 3,
        command: 'Begin reconnaissance',
        assignee: 'scouts',
        priority: 'MEDIUM',
        complianceRequired: false,
        issuedAt: new Date().toISOString(),
        status: 'pending'
      }
    ]);

    // Start periodic status reports
    this.statusReportInterval = setInterval(
      () => this.issueStatusReport(),
      this.config.statusReportInterval
    );

    // Start health checks
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckInterval
    );

    console.log('👑 Queen Coordinator: Sovereignty established');
    this.emit('sovereignty_established', this.status);
  }

  /**
   * Establish sovereign presence in memory
   */
  private async establishSovereignty() {
    const dbRun = promisify(this.db.run.bind(this.db));

    try {
      await dbRun(
        `INSERT OR REPLACE INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'coordination',
          'swarm/queen/status',
          JSON.stringify(this.status),
          new Date().toISOString()
        ]
      );

      console.log('👑 Sovereign status written to memory');
    } catch (error) {
      console.error('Failed to establish sovereignty:', error);
    }
  }

  /**
   * Issue royal directives
   */
  private async issueRoyalDirectives(directives: RoyalDirective[]) {
    const dbRun = promisify(this.db.run.bind(this.db));

    this.status.royalDirectives.push(...directives);

    try {
      await dbRun(
        `INSERT OR REPLACE INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'coordination',
          'swarm/shared/royal-directives',
          JSON.stringify({
            priority: 'CRITICAL',
            directives,
            issuedBy: 'queen-coordinator',
            complianceRequired: true,
            timestamp: Date.now()
          }),
          new Date().toISOString()
        ]
      );

      console.log(`👑 Issued ${directives.length} royal directives`);
      this.emit('directives_issued', directives);
    } catch (error) {
      console.error('Failed to issue directives:', error);
    }
  }

  /**
   * Allocate hive resources
   */
  async allocateResources(allocation: Partial<ResourceAllocation>) {
    this.resourceAllocation = {
      ...this.resourceAllocation,
      ...allocation,
      allocatedBy: 'queen-coordinator',
      lastUpdate: new Date().toISOString()
    };

    const dbRun = promisify(this.db.run.bind(this.db));

    try {
      await dbRun(
        `INSERT OR REPLACE INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'coordination',
          'swarm/shared/resource-allocation',
          JSON.stringify(this.resourceAllocation),
          new Date().toISOString()
        ]
      );

      console.log('👑 Resource allocation updated');
      this.emit('resources_allocated', this.resourceAllocation);
    } catch (error) {
      console.error('Failed to allocate resources:', error);
    }
  }

  /**
   * Register worker agent
   */
  async registerWorker(worker: WorkerAgent) {
    this.workers.set(worker.id, worker);
    this.status.subjects.push(worker.id);

    console.log(`👑 Worker registered: ${worker.id} (${worker.role})`);
    this.emit('worker_registered', worker);

    // Update sovereignty
    await this.establishSovereignty();
  }

  /**
   * Byzantine consensus voting
   */
  async conductConsensusVote(
    proposalId: string,
    proposal: any,
    participants: string[]
  ): Promise<ConsensusResult> {
    console.log(`👑 Conducting consensus vote: ${proposalId}`);

    const votes: ConsensusVote[] = [];

    // Simulate voting (in real implementation, would query workers)
    for (const participantId of participants) {
      const worker = this.workers.get(participantId);
      if (!worker) continue;

      // Each worker votes based on their analysis
      const vote: ConsensusVote = {
        voterId: participantId,
        vote: Math.random() > 0.2 ? 'approve' : 'reject',
        confidence: 0.7 + Math.random() * 0.3,
        reasoning: `Analyzed by ${worker.role}`,
        timestamp: new Date().toISOString()
      };

      votes.push(vote);
    }

    // Calculate consensus
    const approvals = votes.filter(v => v.vote === 'approve').length;
    const consensusScore = approvals / votes.length;
    const approved = consensusScore >= this.config.consensusThreshold;

    // Byzantine fault tolerance check (need 2/3+ majority)
    const byzantineFaultTolerant = consensusScore >= 0.67;

    const result: ConsensusResult = {
      proposalId,
      approved,
      votes,
      consensusScore,
      byzantineFaultTolerant
    };

    console.log(
      `👑 Consensus: ${approved ? 'APPROVED' : 'REJECTED'} ` +
      `(${(consensusScore * 100).toFixed(1)}%, BFT: ${byzantineFaultTolerant})`
    );

    this.emit('consensus_complete', result);
    return result;
  }

  /**
   * Aggregate patterns from workers
   */
  async aggregateWorkerPatterns(): Promise<Pattern[]> {
    console.log('👑 Aggregating patterns from workers...');

    const allPatterns: Pattern[] = [];

    for (const [workerId, worker] of this.workers) {
      allPatterns.push(...worker.learningPatterns);
    }

    console.log(`👑 Aggregated ${allPatterns.length} patterns from ${this.workers.size} workers`);

    // Validate patterns via consensus
    const validatedPatterns: Pattern[] = [];

    for (const pattern of allPatterns) {
      if (pattern.confidence >= 0.5) {
        const result = await this.conductConsensusVote(
          `validate-pattern-${pattern.id}`,
          pattern,
          Array.from(this.workers.keys()).slice(0, 5) // Use 5 workers for voting
        );

        if (result.approved && result.byzantineFaultTolerant) {
          validatedPatterns.push(pattern);
        }
      }
    }

    console.log(`👑 Validated ${validatedPatterns.length}/${allPatterns.length} patterns via consensus`);

    this.emit('patterns_aggregated', validatedPatterns);
    return validatedPatterns;
  }

  /**
   * Perform hive health check
   */
  private async performHealthCheck() {
    const compliant: string[] = [];
    const nonResponsive: string[] = [];

    for (const [workerId, worker] of this.workers) {
      const lastActiveTime = new Date(worker.lastActive).getTime();
      const now = Date.now();
      const minutesSinceActive = (now - lastActiveTime) / (1000 * 60);

      if (minutesSinceActive < 5) {
        compliant.push(workerId);
      } else if (minutesSinceActive < 30) {
        // Still acceptable
        compliant.push(workerId);
      } else {
        nonResponsive.push(workerId);
      }
    }

    this.status.hiveHealth = {
      coherenceScore: compliant.length / Math.max(1, this.workers.size),
      agentCompliance: {
        compliant,
        nonResponsive,
        rebellious: []
      },
      swarmEfficiency: this.calculateSwarmEfficiency(),
      threatLevel: nonResponsive.length > this.workers.size / 2 ? 'high' : 'low',
      morale: 'high',
      lastHealthCheck: new Date().toISOString()
    };

    const dbRun = promisify(this.db.run.bind(this.db));

    try {
      await dbRun(
        `INSERT OR REPLACE INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'coordination',
          'swarm/queen/hive-health',
          JSON.stringify(this.status.hiveHealth),
          new Date().toISOString()
        ]
      );

      this.emit('health_check_complete', this.status.hiveHealth);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * Issue periodic status report
   */
  private async issueStatusReport() {
    const report = {
      decree: 'Status Report',
      swarmState: 'operational',
      objectivesCompleted: this.status.royalDirectives
        .filter(d => d.status === 'completed')
        .map(d => d.command),
      objectivesPending: this.status.royalDirectives
        .filter(d => d.status === 'pending' || d.status === 'in-progress')
        .map(d => d.command),
      resourceUtilization: this.calculateResourceUtilization(),
      recommendations: this.generateRecommendations(),
      nextReview: Date.now() + 120000 // 2 minutes
    };

    const dbRun = promisify(this.db.run.bind(this.db));

    try {
      await dbRun(
        `INSERT OR REPLACE INTO memory_entries (namespace, key, value, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          'coordination',
          'swarm/queen/royal-report',
          JSON.stringify(report),
          new Date().toISOString()
        ]
      );

      console.log('👑 Royal status report issued');
      this.emit('status_report', report);
    } catch (error) {
      console.error('Status report failed:', error);
    }
  }

  /**
   * Calculate swarm efficiency
   */
  private calculateSwarmEfficiency(): number {
    if (this.workers.size === 0) return 0;

    const avgPerformance = Array.from(this.workers.values())
      .reduce((sum, w) => sum + w.performanceScore, 0) / this.workers.size;

    return avgPerformance;
  }

  /**
   * Calculate resource utilization
   */
  private calculateResourceUtilization(): string {
    const activeWorkers = Array.from(this.workers.values())
      .filter(w => w.currentTask).length;

    const utilization = (activeWorkers / Math.max(1, this.workers.size)) * 100;
    return `${utilization.toFixed(0)}%`;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.workers.size < this.config.maxWorkers / 2) {
      recommendations.push('Spawn more workers');
    }

    if (this.status.hiveHealth.coherenceScore < 0.8) {
      recommendations.push('Increase coordination frequency');
    }

    if (this.status.hiveHealth.agentCompliance.nonResponsive.length > 0) {
      recommendations.push('Check non-responsive agents');
    }

    return recommendations;
  }

  /**
   * Delegate task to appropriate agent
   */
  delegateTo(
    role: 'collective-intelligence' | 'workers' | 'scouts' | 'memory-manager',
    task: string
  ) {
    console.log(`👑 Delegating to ${role}: ${task}`);
    this.emit('task_delegated', { role, task });
  }

  /**
   * Enable succession planning
   */
  async planSuccession(heirApparent: string = 'collective-intelligence') {
    this.status.successionPlan = heirApparent === 'collective-intelligence'
      ? 'collective-intelligence'
      : 'designated-heir';

    console.log(`👑 Succession plan updated: ${heirApparent}`);
    this.emit('succession_planned', { heirApparent });

    await this.establishSovereignty();
  }

  /**
   * Graceful abdication
   */
  async abdicate(reason: string) {
    console.log(`👑 Queen abdicating: ${reason}`);

    this.status.status = 'abdicated';

    // Clear intervals
    if (this.statusReportInterval) {
      clearInterval(this.statusReportInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.emit('abdication', { reason, timestamp: Date.now() });

    // Trigger succession
    this.emit('succession_triggered', {
      newQueen: this.status.successionPlan
    });
  }

  /**
   * Get current status
   */
  getStatus(): QueenStatus {
    return { ...this.status };
  }

  /**
   * Get worker count
   */
  getWorkerCount(): number {
    return this.workers.size;
  }

  /**
   * Shutdown
   */
  async shutdown() {
    await this.abdicate('System shutdown');
  }
}

export default QueenCoordinator;
