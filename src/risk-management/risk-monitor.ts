/**
 * Risk Management and Monitoring System
 * Tracks 12 identified risks with automated alerts and mitigation tracking
 *
 * Features:
 * - Real-time risk status monitoring
 * - Automated alert generation
 * - Mitigation strategy tracking
 * - Escalation protocol enforcement
 * - Risk dashboard data collection
 */

import * as fs from 'fs';
import * as path from 'path';

export interface RiskMetrics {
  riskId: string;
  category: 'Critical' | 'High' | 'Medium' | 'Low';
  name: string;
  probability: number;  // 0.0 - 1.0
  impact: number;       // 0.0 - 10.0
  score: number;        // probability * impact * 10
  status: 'Monitoring' | 'Active' | 'Mitigated' | 'Materialized' | 'Escalated';
  lastChecked: Date;
  checkFrequency: 'daily' | 'weekly' | 'bi-weekly';
  indicators: RiskIndicator[];
  mitigations: MitigationAction[];
  escalationLevel: 0 | 1 | 2 | 3 | 4;
}

export interface RiskIndicator {
  name: string;
  currentValue: number;
  threshold: number;
  operator: '>' | '<' | '==' | '>=' | '<=';
  severity: 'info' | 'warning' | 'critical';
  triggered: boolean;
  lastTriggered?: Date;
}

export interface MitigationAction {
  action: string;
  owner: string;
  status: 'planned' | 'in-progress' | 'completed' | 'failed';
  timeline: string;
  effectiveness?: number;  // 0.0 - 1.0 if completed
  startDate?: Date;
  completionDate?: Date;
}

export interface RiskAlert {
  alertId: string;
  riskId: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  message: string;
  indicators: string[];
  recommendedAction: string;
  acknowledged: boolean;
  escalated: boolean;
}

export class RiskMonitor {
  private risks: Map<string, RiskMetrics> = new Map();
  private alerts: RiskAlert[] = [];
  private riskHistoryPath: string;
  private alertsPath: string;

  constructor(dataDir: string = '.swarm') {
    this.riskHistoryPath = path.join(dataDir, 'risk-history.json');
    this.alertsPath = path.join(dataDir, 'risk-alerts.json');
    this.initializeRisks();
    this.loadHistory();
  }

  /**
   * Initialize all 12 identified risks from risks.md
   */
  private initializeRisks(): void {
    // Critical Risks (C1-C3)
    this.risks.set('C1', {
      riskId: 'C1',
      category: 'Critical',
      name: 'Neural System Complexity Overrun',
      probability: 0.40,
      impact: 8.0,
      score: 8.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'daily',
      indicators: [
        {
          name: 'Days Behind Schedule',
          currentValue: 0,
          threshold: 1,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Checkpoint Gates Passed',
          currentValue: 0,
          threshold: 4,
          operator: '<',
          severity: 'critical',
          triggered: false
        },
        {
          name: 'Implementation Progress %',
          currentValue: 0,
          threshold: 50,
          operator: '<',
          severity: 'warning',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Create detailed prototype in first week',
          owner: 'Neural Specialist',
          status: 'planned',
          timeline: 'Week 1, Days 1-3'
        },
        {
          action: 'Implement in vertical slices',
          owner: 'Neural Specialist',
          status: 'planned',
          timeline: 'Week 1-2'
        },
        {
          action: 'Set checkpoint gates at days 3, 5, 7, 10',
          owner: 'Project Lead',
          status: 'planned',
          timeline: 'Week 1'
        }
      ],
      escalationLevel: 0
    });

    this.risks.set('C2', {
      riskId: 'C2',
      category: 'Critical',
      name: 'Integration Conflicts',
      probability: 0.35,
      impact: 7.0,
      score: 7.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'daily',
      indicators: [
        {
          name: 'Integration Tests Failing',
          currentValue: 0,
          threshold: 5,
          operator: '>',
          severity: 'critical',
          triggered: false
        },
        {
          name: 'Performance Degradation %',
          currentValue: 0,
          threshold: 20,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Data Corruption Incidents',
          currentValue: 0,
          threshold: 0,
          operator: '>',
          severity: 'critical',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Design integration contracts upfront',
          owner: 'System Architect',
          status: 'planned',
          timeline: 'Before implementation'
        },
        {
          action: 'Create integration test suite first (TDD)',
          owner: 'Tester',
          status: 'planned',
          timeline: 'Week 3, Day 1'
        },
        {
          action: 'Implement adapters/facades for legacy compatibility',
          owner: 'Coder',
          status: 'planned',
          timeline: 'Week 3-4'
        }
      ],
      escalationLevel: 0
    });

    this.risks.set('C3', {
      riskId: 'C3',
      category: 'Critical',
      name: 'Performance Degradation',
      probability: 0.30,
      impact: 6.0,
      score: 6.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'daily',
      indicators: [
        {
          name: 'Response Time Increase %',
          currentValue: 0,
          threshold: 50,
          operator: '>',
          severity: 'critical',
          triggered: false
        },
        {
          name: 'Memory Usage MB',
          currentValue: 0,
          threshold: 500,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Throughput Decrease %',
          currentValue: 0,
          threshold: 20,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Pattern Retrieval Latency ms (p95)',
          currentValue: 0,
          threshold: 100,
          operator: '>',
          severity: 'warning',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Establish performance baselines',
          owner: 'Performance Team',
          status: 'planned',
          timeline: 'Week 0'
        },
        {
          action: 'Set performance budgets (<10% overhead)',
          owner: 'Performance Team',
          status: 'planned',
          timeline: 'Week 0'
        },
        {
          action: 'Implement caching strategies (LRU, query cache)',
          owner: 'Optimizer',
          status: 'planned',
          timeline: 'Week 1-2'
        }
      ],
      escalationLevel: 0
    });

    // High Risks (H1-H3)
    this.risks.set('H1', {
      riskId: 'H1',
      category: 'High',
      name: 'Learning Divergence',
      probability: 0.30,
      impact: 6.0,
      score: 6.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'weekly',
      indicators: [
        {
          name: 'Task Success Rate Decline %',
          currentValue: 0,
          threshold: 5,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Pattern Quality Score',
          currentValue: 0.85,
          threshold: 0.80,
          operator: '<',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Diversity Index',
          currentValue: 0.70,
          threshold: 0.60,
          operator: '<',
          severity: 'warning',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Implement validation layers (confidence >0.80)',
          owner: 'Neural Specialist',
          status: 'planned',
          timeline: 'Phase 1'
        },
        {
          action: 'Add safety constraints (max ±10% confidence change)',
          owner: 'Neural Specialist',
          status: 'planned',
          timeline: 'Phase 1'
        }
      ],
      escalationLevel: 0
    });

    this.risks.set('H2', {
      riskId: 'H2',
      category: 'High',
      name: 'Data Migration Failures',
      probability: 0.20,
      impact: 5.0,
      score: 5.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'weekly',
      indicators: [
        {
          name: 'Data Loss %',
          currentValue: 0,
          threshold: 0.1,
          operator: '>',
          severity: 'critical',
          triggered: false
        },
        {
          name: 'Migration Query Time Increase %',
          currentValue: 0,
          threshold: 100,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Row Count Mismatch',
          currentValue: 0,
          threshold: 0,
          operator: '>',
          severity: 'critical',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Comprehensive backup strategy (pre + checkpoint backups)',
          owner: 'Data Engineer',
          status: 'planned',
          timeline: 'Week 2, Day 1'
        },
        {
          action: 'Staged migration with validation at each stage',
          owner: 'Data Engineer',
          status: 'planned',
          timeline: 'Week 2'
        }
      ],
      escalationLevel: 0
    });

    this.risks.set('H3', {
      riskId: 'H3',
      category: 'High',
      name: 'Agent Learning Overhead',
      probability: 0.35,
      impact: 5.0,
      score: 5.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'weekly',
      indicators: [
        {
          name: 'Total Pattern Count',
          currentValue: 0,
          threshold: 15000,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Total Memory Usage MB',
          currentValue: 0,
          threshold: 750,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Agent Query Latency ms (p95)',
          currentValue: 0,
          threshold: 200,
          operator: '>',
          severity: 'warning',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Phased agent enablement (10→20→48 agents)',
          owner: 'Coordinator',
          status: 'planned',
          timeline: 'Week 4-6'
        },
        {
          action: 'Pattern deduplication and shared patterns',
          owner: 'Neural Specialist',
          status: 'planned',
          timeline: 'Phase 3'
        }
      ],
      escalationLevel: 0
    });

    // Medium Risks (M1-M4)
    this.risks.set('M1', {
      riskId: 'M1',
      category: 'Medium',
      name: 'Team Skill Gaps',
      probability: 0.40,
      impact: 4.0,
      score: 4.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'bi-weekly',
      indicators: [
        {
          name: 'Training Sessions Completed',
          currentValue: 0,
          threshold: 5,
          operator: '<',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'External Consultations Needed',
          currentValue: 0,
          threshold: 3,
          operator: '>',
          severity: 'warning',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Conduct training sessions (Week 0)',
          owner: 'Tech Lead',
          status: 'planned',
          timeline: 'Week 0'
        },
        {
          action: 'Pair programming with experts',
          owner: 'Team',
          status: 'planned',
          timeline: 'Ongoing'
        }
      ],
      escalationLevel: 0
    });

    this.risks.set('M2', {
      riskId: 'M2',
      category: 'Medium',
      name: 'Scope Creep',
      probability: 0.50,
      impact: 5.0,
      score: 5.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'bi-weekly',
      indicators: [
        {
          name: 'Feature Requests Pending',
          currentValue: 0,
          threshold: 5,
          operator: '>',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Timeline Extension Weeks',
          currentValue: 0,
          threshold: 2,
          operator: '>',
          severity: 'critical',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Document and freeze baseline requirements',
          owner: 'Project Manager',
          status: 'planned',
          timeline: 'Week 0'
        },
        {
          action: 'Implement formal change control process',
          owner: 'Project Manager',
          status: 'planned',
          timeline: 'Week 0'
        }
      ],
      escalationLevel: 0
    });

    this.risks.set('M3', {
      riskId: 'M3',
      category: 'Medium',
      name: 'Testing Gaps',
      probability: 0.35,
      impact: 4.0,
      score: 4.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'bi-weekly',
      indicators: [
        {
          name: 'Test Coverage %',
          currentValue: 0,
          threshold: 90,
          operator: '<',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Critical Bugs in Production',
          currentValue: 0,
          threshold: 0,
          operator: '>',
          severity: 'critical',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Achieve >90% test coverage',
          owner: 'QA Team',
          status: 'planned',
          timeline: 'Ongoing'
        },
        {
          action: 'Implement TDD approach',
          owner: 'Developers',
          status: 'planned',
          timeline: 'Ongoing'
        }
      ],
      escalationLevel: 0
    });

    this.risks.set('M4', {
      riskId: 'M4',
      category: 'Medium',
      name: 'Documentation Lag',
      probability: 0.60,
      impact: 3.0,
      score: 3.0,
      status: 'Monitoring',
      lastChecked: new Date(),
      checkFrequency: 'bi-weekly',
      indicators: [
        {
          name: 'Documentation Coverage %',
          currentValue: 0,
          threshold: 80,
          operator: '<',
          severity: 'warning',
          triggered: false
        },
        {
          name: 'Weeks Behind Implementation',
          currentValue: 0,
          threshold: 1,
          operator: '>',
          severity: 'warning',
          triggered: false
        }
      ],
      mitigations: [
        {
          action: 'Documentation as acceptance criteria',
          owner: 'All Developers',
          status: 'planned',
          timeline: 'Ongoing'
        },
        {
          action: 'Weekly documentation reviews',
          owner: 'Tech Writer',
          status: 'planned',
          timeline: 'Ongoing'
        }
      ],
      escalationLevel: 0
    });
  }

  /**
   * Update a risk indicator with new value
   */
  updateIndicator(riskId: string, indicatorName: string, value: number): void {
    const risk = this.risks.get(riskId);
    if (!risk) {
      throw new Error(`Risk ${riskId} not found`);
    }

    const indicator = risk.indicators.find(i => i.name === indicatorName);
    if (!indicator) {
      throw new Error(`Indicator ${indicatorName} not found in risk ${riskId}`);
    }

    indicator.currentValue = value;

    // Check if threshold is triggered
    const wasTriggered = indicator.triggered;
    indicator.triggered = this.checkThreshold(value, indicator.threshold, indicator.operator);

    if (indicator.triggered && !wasTriggered) {
      indicator.lastTriggered = new Date();
      this.generateAlert(risk, indicator);
    }

    risk.lastChecked = new Date();
    this.saveHistory();
  }

  /**
   * Check if a threshold is crossed
   */
  private checkThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      default: return false;
    }
  }

  /**
   * Generate an alert when risk indicator is triggered
   */
  private generateAlert(risk: RiskMetrics, indicator: RiskIndicator): void {
    const severity = indicator.severity === 'critical' ? 'critical' :
                     indicator.severity === 'warning' ? 'warning' : 'info';

    const alert: RiskAlert = {
      alertId: `ALERT-${risk.riskId}-${Date.now()}`,
      riskId: risk.riskId,
      timestamp: new Date(),
      severity,
      message: `Risk ${risk.riskId} (${risk.name}): Indicator "${indicator.name}" triggered`,
      indicators: [`${indicator.name}: ${indicator.currentValue} ${indicator.operator} ${indicator.threshold}`],
      recommendedAction: this.getRecommendedAction(risk, indicator),
      acknowledged: false,
      escalated: false
    };

    this.alerts.push(alert);

    // Auto-escalate critical alerts
    if (severity === 'critical') {
      this.escalateRisk(risk.riskId, 'Critical indicator triggered');
    }

    this.saveAlerts();
  }

  /**
   * Get recommended action based on risk and indicator
   */
  private getRecommendedAction(risk: RiskMetrics, indicator: RiskIndicator): string {
    const activeMitigations = risk.mitigations.filter(m => m.status !== 'completed');

    if (activeMitigations.length > 0) {
      return `Execute mitigation: ${activeMitigations[0].action}`;
    }

    // Risk-specific recommendations
    switch (risk.riskId) {
      case 'C1':
        return 'Activate contingency team member and consider architecture simplification';
      case 'C2':
        return 'Isolate failing integration and implement rollback';
      case 'C3':
        return 'Enable profiling and optimize bottlenecks immediately';
      case 'H1':
        return 'Pause learning and analyze root cause';
      case 'H2':
        return 'Stop migration and restore from backup';
      case 'H3':
        return 'Disable learning for low-priority agents';
      default:
        return 'Review mitigation strategies in risks.md';
    }
  }

  /**
   * Escalate a risk to higher level
   */
  escalateRisk(riskId: string, reason: string): void {
    const risk = this.risks.get(riskId);
    if (!risk) return;

    risk.escalationLevel = Math.min(risk.escalationLevel + 1, 4) as 0 | 1 | 2 | 3 | 4;
    risk.status = 'Escalated';

    const escalationLevels = [
      'Team Level',
      'Project Lead',
      'Stakeholder',
      'Executive',
      'Critical - Project Viability Threatened'
    ];

    console.log(`\n🚨 RISK ESCALATION:`);
    console.log(`   Risk: ${risk.riskId} - ${risk.name}`);
    console.log(`   Level: ${escalationLevels[risk.escalationLevel]}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Status: ${risk.status}`);

    this.saveHistory();
  }

  /**
   * Update mitigation action status
   */
  updateMitigation(
    riskId: string,
    actionName: string,
    status: MitigationAction['status'],
    effectiveness?: number
  ): void {
    const risk = this.risks.get(riskId);
    if (!risk) return;

    const mitigation = risk.mitigations.find(m => m.action === actionName);
    if (!mitigation) return;

    const oldStatus = mitigation.status;
    mitigation.status = status;

    if (status === 'in-progress' && oldStatus === 'planned') {
      mitigation.startDate = new Date();
    }

    if (status === 'completed') {
      mitigation.completionDate = new Date();
      mitigation.effectiveness = effectiveness;
    }

    this.saveHistory();
  }

  /**
   * Get risks that need checking based on frequency
   */
  getRisksDueForCheck(): RiskMetrics[] {
    const now = new Date();
    const risks: RiskMetrics[] = [];

    for (const risk of this.risks.values()) {
      const hoursSinceCheck = (now.getTime() - risk.lastChecked.getTime()) / (1000 * 60 * 60);

      let checkIntervalHours = 24; // daily
      if (risk.checkFrequency === 'weekly') checkIntervalHours = 168;
      if (risk.checkFrequency === 'bi-weekly') checkIntervalHours = 336;

      if (hoursSinceCheck >= checkIntervalHours) {
        risks.push(risk);
      }
    }

    return risks;
  }

  /**
   * Get active (unacknowledged) alerts
   */
  getActiveAlerts(): RiskAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Get critical alerts requiring immediate attention
   */
  getCriticalAlerts(): RiskAlert[] {
    return this.alerts.filter(a => !a.acknowledged && a.severity === 'critical');
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.saveAlerts();
    }
  }

  /**
   * Generate risk dashboard data
   */
  generateDashboard(): object {
    const criticalRisks = Array.from(this.risks.values()).filter(r => r.category === 'Critical');
    const highRisks = Array.from(this.risks.values()).filter(r => r.category === 'High');
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = this.getCriticalAlerts();

    const risksByStatus = {
      monitoring: Array.from(this.risks.values()).filter(r => r.status === 'Monitoring').length,
      active: Array.from(this.risks.values()).filter(r => r.status === 'Active').length,
      mitigated: Array.from(this.risks.values()).filter(r => r.status === 'Mitigated').length,
      materialized: Array.from(this.risks.values()).filter(r => r.status === 'Materialized').length,
      escalated: Array.from(this.risks.values()).filter(r => r.status === 'Escalated').length
    };

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalRisks: this.risks.size,
        criticalRisks: criticalRisks.length,
        highRisks: highRisks.length,
        activeAlerts: activeAlerts.length,
        criticalAlerts: criticalAlerts.length,
        risksByStatus
      },
      criticalRisks: criticalRisks.map(r => ({
        id: r.riskId,
        name: r.name,
        score: r.score,
        status: r.status,
        triggeredIndicators: r.indicators.filter(i => i.triggered).length,
        escalationLevel: r.escalationLevel
      })),
      highRisks: highRisks.map(r => ({
        id: r.riskId,
        name: r.name,
        score: r.score,
        status: r.status
      })),
      activeAlerts: activeAlerts.slice(0, 10).map(a => ({
        id: a.alertId,
        riskId: a.riskId,
        severity: a.severity,
        message: a.message,
        timestamp: a.timestamp
      })),
      risksDueForCheck: this.getRisksDueForCheck().map(r => r.riskId)
    };
  }

  /**
   * Generate weekly risk report
   */
  generateWeeklyReport(): string {
    const dashboard = this.generateDashboard() as any;
    const risks = Array.from(this.risks.values());

    let report = `# Weekly Risk Management Report\n`;
    report += `**Date**: ${new Date().toISOString().split('T')[0]}\n\n`;

    report += `## Executive Summary\n\n`;
    report += `- **Total Risks**: ${dashboard.summary.totalRisks}\n`;
    report += `- **Critical Risks**: ${dashboard.summary.criticalRisks}\n`;
    report += `- **High Risks**: ${dashboard.summary.highRisks}\n`;
    report += `- **Active Alerts**: ${dashboard.summary.activeAlerts}\n`;
    report += `- **Critical Alerts**: ${dashboard.summary.criticalAlerts}\n`;
    report += `- **Escalated Risks**: ${dashboard.summary.risksByStatus.escalated}\n\n`;

    // Critical risks detail
    report += `## Critical Risks Status\n\n`;
    for (const risk of risks.filter(r => r.category === 'Critical')) {
      report += `### ${risk.riskId}: ${risk.name}\n`;
      report += `- **Score**: ${risk.score}/10\n`;
      report += `- **Status**: ${risk.status}\n`;
      report += `- **Escalation Level**: ${risk.escalationLevel}\n`;
      report += `- **Triggered Indicators**: ${risk.indicators.filter(i => i.triggered).length}/${risk.indicators.length}\n`;

      const activeMitigations = risk.mitigations.filter(m => m.status === 'in-progress' || m.status === 'completed');
      report += `- **Active Mitigations**: ${activeMitigations.length}\n`;

      if (risk.indicators.some(i => i.triggered)) {
        report += `- **⚠️ ATTENTION REQUIRED**: Indicators triggered\n`;
      }
      report += `\n`;
    }

    // Active alerts
    if (dashboard.activeAlerts.length > 0) {
      report += `## Active Alerts\n\n`;
      for (const alert of dashboard.activeAlerts) {
        report += `- **${alert.severity.toUpperCase()}**: ${alert.message}\n`;
        report += `  - Risk ID: ${alert.riskId}\n`;
        report += `  - Time: ${new Date(alert.timestamp).toLocaleString()}\n\n`;
      }
    }

    // Mitigation progress
    report += `## Mitigation Progress\n\n`;
    for (const risk of risks) {
      const completed = risk.mitigations.filter(m => m.status === 'completed').length;
      const inProgress = risk.mitigations.filter(m => m.status === 'in-progress').length;
      const planned = risk.mitigations.filter(m => m.status === 'planned').length;

      if (inProgress > 0 || completed > 0) {
        report += `**${risk.riskId}**: ${completed} completed, ${inProgress} in progress, ${planned} planned\n`;
      }
    }

    report += `\n## Next Actions\n\n`;
    const dueForCheck = this.getRisksDueForCheck();
    if (dueForCheck.length > 0) {
      report += `Risks due for check: ${dueForCheck.map(r => r.riskId).join(', ')}\n`;
    } else {
      report += `All risks checked within schedule\n`;
    }

    return report;
  }

  /**
   * Save risk history to disk
   */
  private saveHistory(): void {
    const data = {
      lastUpdated: new Date().toISOString(),
      risks: Array.from(this.risks.values())
    };

    fs.writeFileSync(this.riskHistoryPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save alerts to disk
   */
  private saveAlerts(): void {
    const data = {
      lastUpdated: new Date().toISOString(),
      alerts: this.alerts
    };

    fs.writeFileSync(this.alertsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Load history from disk
   */
  private loadHistory(): void {
    try {
      if (fs.existsSync(this.riskHistoryPath)) {
        const data = JSON.parse(fs.readFileSync(this.riskHistoryPath, 'utf-8'));
        // Merge loaded data with initialized risks
        for (const loadedRisk of data.risks) {
          const risk = this.risks.get(loadedRisk.riskId);
          if (risk) {
            // Update with saved values
            Object.assign(risk, loadedRisk);
            // Convert date strings back to Date objects
            risk.lastChecked = new Date(loadedRisk.lastChecked);
            risk.indicators.forEach((ind, idx) => {
              if (loadedRisk.indicators[idx].lastTriggered) {
                ind.lastTriggered = new Date(loadedRisk.indicators[idx].lastTriggered);
              }
            });
          }
        }
      }

      if (fs.existsSync(this.alertsPath)) {
        const data = JSON.parse(fs.readFileSync(this.alertsPath, 'utf-8'));
        this.alerts = data.alerts.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Could not load risk history:', error);
    }
  }

  /**
   * Get all risks
   */
  getAllRisks(): RiskMetrics[] {
    return Array.from(this.risks.values());
  }

  /**
   * Get specific risk
   */
  getRisk(riskId: string): RiskMetrics | undefined {
    return this.risks.get(riskId);
  }
}

// Export singleton instance
export const riskMonitor = new RiskMonitor();
