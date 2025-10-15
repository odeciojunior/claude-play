/**
 * Byzantine Consensus Protocol - Hive-Mind Distributed Learning
 *
 * Implements Byzantine fault-tolerant consensus for pattern validation
 * and collective decision making in the presence of potentially faulty nodes.
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ConsensusNode {
  id: string;
  reputation: number; // 0-1, affects vote weight
  responseTime: number; // average response time in ms
  reliability: number; // 0-1, historical reliability
  lastSeen: string;
}

export interface ConsensusProposal {
  id: string;
  proposerId: string;
  type: 'pattern_validation' | 'resource_allocation' | 'strategy_change' | 'emergency_action';
  data: any;
  requiredQuorum: number; // minimum percentage of nodes
  requiredConsensus: number; // minimum consensus percentage (e.g., 0.67 for 2/3)
  timeout: number; // timeout in ms
  timestamp: string;
}

export interface Vote {
  nodeId: string;
  vote: 'approve' | 'reject' | 'abstain';
  confidence: number; // 0-1, how confident is the vote
  reasoning: string;
  signature?: string; // cryptographic signature
  timestamp: string;
}

export interface ConsensusRound {
  proposalId: string;
  round: number;
  votes: Vote[];
  quorumReached: boolean;
  consensusReached: boolean;
  result: 'approved' | 'rejected' | 'timeout' | 'pending';
  byzantineFaultDetected: boolean;
  suspiciousNodes: string[];
}

export interface ByzantineCheck {
  nodeId: string;
  suspicious: boolean;
  reasons: string[];
  confidence: number;
}

export interface ConsensusMetrics {
  totalProposals: number;
  approvedProposals: number;
  rejectedProposals: number;
  timeoutProposals: number;
  avgConsensusTime: number;
  byzantineFaultsDetected: number;
  avgQuorumParticipation: number;
}

// ============================================================================
// Byzantine Consensus Protocol
// ============================================================================

export class ByzantineConsensus extends EventEmitter {
  private nodes: Map<string, ConsensusNode> = new Map();
  private activeProposals: Map<string, ConsensusProposal> = new Map();
  private rounds: Map<string, ConsensusRound> = new Map();
  private metrics: ConsensusMetrics;
  private suspiciousActivityLog: Map<string, ByzantineCheck[]> = new Map();

  constructor(
    private config: {
      minNodes: number;
      defaultQuorum: number;
      defaultConsensus: number;
      roundTimeout: number;
      maxRounds: number;
      reputationDecayRate: number;
    }
  ) {
    super();

    this.metrics = {
      totalProposals: 0,
      approvedProposals: 0,
      rejectedProposals: 0,
      timeoutProposals: 0,
      avgConsensusTime: 0,
      byzantineFaultsDetected: 0,
      avgQuorumParticipation: 0
    };
  }

  /**
   * Register consensus node
   */
  registerNode(node: ConsensusNode) {
    this.nodes.set(node.id, node);
    console.log(`🛡️ Node registered: ${node.id} (reputation: ${node.reputation.toFixed(2)})`);
    this.emit('node_registered', node);
  }

  /**
   * Unregister consensus node
   */
  unregisterNode(nodeId: string) {
    this.nodes.delete(nodeId);
    console.log(`🛡️ Node unregistered: ${nodeId}`);
    this.emit('node_unregistered', nodeId);
  }

  /**
   * Submit proposal for consensus
   */
  async submitProposal(proposal: ConsensusProposal): Promise<string> {
    if (this.nodes.size < this.config.minNodes) {
      throw new Error(
        `Insufficient nodes for consensus: ${this.nodes.size}/${this.config.minNodes}`
      );
    }

    this.activeProposals.set(proposal.id, proposal);
    this.metrics.totalProposals++;

    console.log(
      `🛡️ Proposal submitted: ${proposal.id} (type: ${proposal.type}, ` +
      `quorum: ${(proposal.requiredQuorum * 100).toFixed(0)}%, ` +
      `consensus: ${(proposal.requiredConsensus * 100).toFixed(0)}%)`
    );

    this.emit('proposal_submitted', proposal);

    // Start consensus round
    const result = await this.conductConsensusRound(proposal);

    return result.result;
  }

  /**
   * Conduct consensus round
   */
  private async conductConsensusRound(
    proposal: ConsensusProposal,
    roundNumber: number = 1
  ): Promise<ConsensusRound> {
    const round: ConsensusRound = {
      proposalId: proposal.id,
      round: roundNumber,
      votes: [],
      quorumReached: false,
      consensusReached: false,
      result: 'pending',
      byzantineFaultDetected: false,
      suspiciousNodes: []
    };

    const startTime = Date.now();

    console.log(`🛡️ Starting consensus round ${roundNumber} for ${proposal.id}`);

    // Collect votes from all nodes
    const votingPromises = Array.from(this.nodes.keys()).map(nodeId =>
      this.collectVote(nodeId, proposal)
    );

    // Wait for votes or timeout
    const voteResults = await Promise.race([
      Promise.all(votingPromises),
      new Promise<Vote[]>(resolve =>
        setTimeout(() => resolve([]), proposal.timeout)
      )
    ]);

    round.votes = voteResults.filter(v => v !== null);

    // Check quorum
    const participationRate = round.votes.length / this.nodes.size;
    round.quorumReached = participationRate >= proposal.requiredQuorum;

    if (!round.quorumReached) {
      console.log(
        `🛡️ Quorum not reached: ${(participationRate * 100).toFixed(0)}% ` +
        `(required: ${(proposal.requiredQuorum * 100).toFixed(0)}%)`
      );

      round.result = roundNumber < this.config.maxRounds ? 'pending' : 'timeout';

      if (round.result === 'timeout') {
        this.metrics.timeoutProposals++;
      }

      this.rounds.set(`${proposal.id}-${roundNumber}`, round);
      this.emit('round_complete', round);

      // Retry if possible
      if (roundNumber < this.config.maxRounds) {
        return this.conductConsensusRound(proposal, roundNumber + 1);
      }

      return round;
    }

    // Byzantine fault detection
    const byzantineChecks = this.detectByzantineFaults(round.votes, proposal);
    round.byzantineFaultDetected = byzantineChecks.some(c => c.suspicious);
    round.suspiciousNodes = byzantineChecks
      .filter(c => c.suspicious)
      .map(c => c.nodeId);

    if (round.byzantineFaultDetected) {
      console.log(
        `🛡️ Byzantine fault detected! Suspicious nodes: ${round.suspiciousNodes.join(', ')}`
      );
      this.metrics.byzantineFaultsDetected++;
      this.handleByzantineFaults(round.suspiciousNodes);
    }

    // Calculate weighted consensus
    const consensus = this.calculateWeightedConsensus(round.votes);

    round.consensusReached = consensus.score >= proposal.requiredConsensus;
    round.result = round.consensusReached ? consensus.decision : 'rejected';

    const duration = Date.now() - startTime;

    // Update metrics
    this.updateMetrics(round, duration, participationRate);

    console.log(
      `🛡️ Consensus round ${roundNumber} complete: ${round.result} ` +
      `(consensus: ${(consensus.score * 100).toFixed(1)}%, ` +
      `duration: ${duration}ms, ` +
      `byzantine: ${round.byzantineFaultDetected})`
    );

    this.rounds.set(`${proposal.id}-${roundNumber}`, round);
    this.emit('round_complete', round);

    // Remove from active proposals
    this.activeProposals.delete(proposal.id);

    return round;
  }

  /**
   * Collect vote from node
   */
  private async collectVote(
    nodeId: string,
    proposal: ConsensusProposal
  ): Promise<Vote | null> {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    try {
      // Simulate node voting (in real implementation, would call node's vote method)
      const vote = await this.simulateNodeVote(node, proposal);
      return vote;
    } catch (error) {
      console.error(`Failed to collect vote from ${nodeId}:`, error);
      return null;
    }
  }

  /**
   * Simulate node voting (placeholder for actual voting logic)
   */
  private async simulateNodeVote(
    node: ConsensusNode,
    proposal: ConsensusProposal
  ): Promise<Vote> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, node.responseTime));

    // Base decision on node reliability and reputation
    const random = Math.random();
    const threshold = 0.3 + node.reputation * 0.5;

    let voteChoice: 'approve' | 'reject' | 'abstain';
    let confidence: number;

    if (random < threshold) {
      voteChoice = 'approve';
      confidence = 0.7 + node.reputation * 0.3;
    } else if (random < threshold + 0.3) {
      voteChoice = 'reject';
      confidence = 0.6 + node.reputation * 0.2;
    } else {
      voteChoice = 'abstain';
      confidence = 0.5;
    }

    // Simulate Byzantine behavior (5% chance for low reputation nodes)
    if (node.reputation < 0.5 && Math.random() < 0.05) {
      voteChoice = Math.random() < 0.5 ? 'approve' : 'reject';
      confidence = Math.random();
    }

    return {
      nodeId: node.id,
      vote: voteChoice,
      confidence,
      reasoning: `Voted by ${node.id} based on analysis`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Detect Byzantine faults
   */
  private detectByzantineFaults(
    votes: Vote[],
    proposal: ConsensusProposal
  ): ByzantineCheck[] {
    const checks: ByzantineCheck[] = [];

    for (const vote of votes) {
      const node = this.nodes.get(vote.nodeId);
      if (!node) continue;

      const reasons: string[] = [];
      let suspicious = false;

      // Check 1: Inconsistent confidence (very low confidence but definitive vote)
      if (vote.vote !== 'abstain' && vote.confidence < 0.3) {
        reasons.push('Low confidence with definitive vote');
        suspicious = true;
      }

      // Check 2: Outlier detection (vote significantly differs from majority)
      const majorityVote = this.getMajorityVote(votes);
      const outlierThreshold = 0.2;

      if (vote.vote !== majorityVote && vote.vote !== 'abstain') {
        const majorityCount = votes.filter(v => v.vote === majorityVote).length;
        const outlierRate = majorityCount / votes.length;

        if (outlierRate > (1 - outlierThreshold)) {
          reasons.push('Significant deviation from majority');
          suspicious = true;
        }
      }

      // Check 3: Historical pattern (consistent outlier)
      const history = this.suspiciousActivityLog.get(vote.nodeId) || [];
      const recentSuspicious = history.slice(-5).filter(h => h.suspicious).length;

      if (recentSuspicious >= 3) {
        reasons.push('Pattern of suspicious behavior');
        suspicious = true;
      }

      // Check 4: Reputation-confidence mismatch
      if (node.reputation > 0.8 && vote.confidence < 0.5) {
        reasons.push('High reputation with low confidence');
        suspicious = true;
      }

      const check: ByzantineCheck = {
        nodeId: vote.nodeId,
        suspicious,
        reasons,
        confidence: suspicious ? 1 - vote.confidence : vote.confidence
      };

      checks.push(check);

      // Log suspicious activity
      if (suspicious) {
        const log = this.suspiciousActivityLog.get(vote.nodeId) || [];
        log.push(check);
        this.suspiciousActivityLog.set(vote.nodeId, log);
      }
    }

    return checks;
  }

  /**
   * Get majority vote
   */
  private getMajorityVote(votes: Vote[]): 'approve' | 'reject' | 'abstain' {
    const counts = {
      approve: votes.filter(v => v.vote === 'approve').length,
      reject: votes.filter(v => v.vote === 'reject').length,
      abstain: votes.filter(v => v.vote === 'abstain').length
    };

    if (counts.approve > counts.reject && counts.approve > counts.abstain) {
      return 'approve';
    } else if (counts.reject > counts.approve && counts.reject > counts.abstain) {
      return 'reject';
    } else {
      return 'abstain';
    }
  }

  /**
   * Calculate weighted consensus
   */
  private calculateWeightedConsensus(votes: Vote[]): {
    decision: 'approved' | 'rejected';
    score: number;
  } {
    let approveWeight = 0;
    let rejectWeight = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      const node = this.nodes.get(vote.nodeId);
      if (!node) continue;

      // Weight = reputation × confidence
      const weight = node.reputation * vote.confidence;

      if (vote.vote === 'approve') {
        approveWeight += weight;
      } else if (vote.vote === 'reject') {
        rejectWeight += weight;
      }

      totalWeight += weight;
    }

    const approveScore = totalWeight > 0 ? approveWeight / totalWeight : 0;
    const rejectScore = totalWeight > 0 ? rejectWeight / totalWeight : 0;

    return {
      decision: approveScore > rejectScore ? 'approved' : 'rejected',
      score: Math.max(approveScore, rejectScore)
    };
  }

  /**
   * Handle Byzantine faults
   */
  private handleByzantineFaults(suspiciousNodes: string[]) {
    for (const nodeId of suspiciousNodes) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      // Decrease reputation
      node.reputation = Math.max(0, node.reputation - this.config.reputationDecayRate);

      console.log(
        `🛡️ Reputation decreased for ${nodeId}: ${node.reputation.toFixed(2)}`
      );

      this.emit('reputation_updated', { nodeId, reputation: node.reputation });

      // Quarantine if reputation too low
      if (node.reputation < 0.2) {
        console.log(`🛡️ Node quarantined: ${nodeId}`);
        this.unregisterNode(nodeId);
        this.emit('node_quarantined', nodeId);
      }
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(
    round: ConsensusRound,
    duration: number,
    participation: number
  ) {
    if (round.result === 'approved') {
      this.metrics.approvedProposals++;
    } else if (round.result === 'rejected') {
      this.metrics.rejectedProposals++;
    }

    // Update average consensus time
    const alpha = 0.1;
    this.metrics.avgConsensusTime =
      alpha * duration + (1 - alpha) * this.metrics.avgConsensusTime;

    // Update average quorum participation
    this.metrics.avgQuorumParticipation =
      alpha * participation + (1 - alpha) * this.metrics.avgQuorumParticipation;
  }

  /**
   * Get consensus metrics
   */
  getMetrics(): ConsensusMetrics {
    return { ...this.metrics };
  }

  /**
   * Get node reputation
   */
  getNodeReputation(nodeId: string): number {
    return this.nodes.get(nodeId)?.reputation || 0;
  }

  /**
   * Get all nodes
   */
  getNodes(): ConsensusNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get suspicious activity log
   */
  getSuspiciousActivity(nodeId: string): ByzantineCheck[] {
    return this.suspiciousActivityLog.get(nodeId) || [];
  }

  /**
   * Reset node reputation
   */
  resetNodeReputation(nodeId: string, newReputation: number = 0.7) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.reputation = newReputation;
      this.suspiciousActivityLog.delete(nodeId);
      console.log(`🛡️ Reputation reset for ${nodeId}: ${newReputation}`);
      this.emit('reputation_reset', { nodeId, reputation: newReputation });
    }
  }
}

export default ByzantineConsensus;
