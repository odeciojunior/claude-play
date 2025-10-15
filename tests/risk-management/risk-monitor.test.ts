/**
 * Risk Management System Tests
 * Comprehensive test suite for risk monitoring and alerting
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RiskMonitor, RiskMetrics } from '../../src/risk-management/risk-monitor';
import * as fs from 'fs';
import * as path from 'path';

describe('Risk Management System', () => {
  let monitor: RiskMonitor;
  const testDataDir = '.test-swarm';

  beforeEach(() => {
    // Clean up test data
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    monitor = new RiskMonitor(testDataDir);
  });

  describe('Initialization', () => {
    it('should initialize all 12 risks', () => {
      const risks = monitor.getAllRisks();
      expect(risks.length).toBe(12);
    });

    it('should have correct risk categories', () => {
      const risks = monitor.getAllRisks();
      const categories = risks.map(r => r.category);

      const criticalCount = categories.filter(c => c === 'Critical').length;
      const highCount = categories.filter(c => c === 'High').length;
      const mediumCount = categories.filter(c => c === 'Medium').length;

      expect(criticalCount).toBe(3); // C1, C2, C3
      expect(highCount).toBe(3);     // H1, H2, H3
      expect(mediumCount).toBe(6);   // M1-M4 (M4 might have lower actual count)
    });

    it('should initialize all risks with monitoring status', () => {
      const risks = monitor.getAllRisks();
      risks.forEach(risk => {
        expect(risk.status).toBe('Monitoring');
      });
    });

    it('should set correct check frequencies', () => {
      const c1 = monitor.getRisk('C1');
      const h1 = monitor.getRisk('H1');
      const m1 = monitor.getRisk('M1');

      expect(c1?.checkFrequency).toBe('daily');
      expect(h1?.checkFrequency).toBe('weekly');
      expect(m1?.checkFrequency).toBe('bi-weekly');
    });
  });

  describe('Risk Scoring', () => {
    it('should calculate correct risk scores', () => {
      const c1 = monitor.getRisk('C1');
      expect(c1?.score).toBe(8.0);

      const c2 = monitor.getRisk('C2');
      expect(c2?.score).toBe(7.0);

      const c3 = monitor.getRisk('C3');
      expect(c3?.score).toBe(6.0);
    });

    it('should have higher scores for critical risks', () => {
      const risks = monitor.getAllRisks();
      const criticalRisks = risks.filter(r => r.category === 'Critical');
      const mediumRisks = risks.filter(r => r.category === 'Medium');

      const avgCriticalScore = criticalRisks.reduce((sum, r) => sum + r.score, 0) / criticalRisks.length;
      const avgMediumScore = mediumRisks.reduce((sum, r) => sum + r.score, 0) / mediumRisks.length;

      expect(avgCriticalScore).toBeGreaterThan(avgMediumScore);
    });
  });

  describe('Indicator Updates', () => {
    it('should update indicator values', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);

      const risk = monitor.getRisk('C1');
      const indicator = risk?.indicators.find(i => i.name === 'Days Behind Schedule');

      expect(indicator?.currentValue).toBe(2);
    });

    it('should trigger indicator when threshold crossed', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);

      const risk = monitor.getRisk('C1');
      const indicator = risk?.indicators.find(i => i.name === 'Days Behind Schedule');

      expect(indicator?.triggered).toBe(true);
    });

    it('should not trigger when below threshold', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 0.5);

      const risk = monitor.getRisk('C1');
      const indicator = risk?.indicators.find(i => i.name === 'Days Behind Schedule');

      expect(indicator?.triggered).toBe(false);
    });

    it('should generate alert on indicator trigger', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);

      const alerts = monitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].riskId).toBe('C1');
    });
  });

  describe('Alert Management', () => {
    beforeEach(() => {
      // Trigger some alerts
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
      monitor.updateIndicator('C3', 'Response Time Increase %', 60);
    });

    it('should track multiple alerts', () => {
      const alerts = monitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter critical alerts', () => {
      monitor.updateIndicator('C2', 'Data Corruption Incidents', 1);

      const criticalAlerts = monitor.getCriticalAlerts();
      expect(criticalAlerts.length).toBeGreaterThan(0);
      expect(criticalAlerts[0].severity).toBe('critical');
    });

    it('should acknowledge alerts', () => {
      const alerts = monitor.getActiveAlerts();
      const alertId = alerts[0].alertId;

      monitor.acknowledgeAlert(alertId);

      const activeAlerts = monitor.getActiveAlerts();
      expect(activeAlerts.find(a => a.alertId === alertId)).toBeUndefined();
    });

    it('should include recommended actions', () => {
      const alerts = monitor.getActiveAlerts();
      expect(alerts[0].recommendedAction).toBeTruthy();
      expect(alerts[0].recommendedAction.length).toBeGreaterThan(0);
    });
  });

  describe('Mitigation Tracking', () => {
    it('should update mitigation status', () => {
      monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'in-progress');

      const risk = monitor.getRisk('C1');
      const mitigation = risk?.mitigations.find(m => m.action === 'Create detailed prototype in first week');

      expect(mitigation?.status).toBe('in-progress');
    });

    it('should set start date on in-progress', () => {
      monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'in-progress');

      const risk = monitor.getRisk('C1');
      const mitigation = risk?.mitigations.find(m => m.action === 'Create detailed prototype in first week');

      expect(mitigation?.startDate).toBeDefined();
    });

    it('should set completion date and effectiveness', () => {
      monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'in-progress');
      monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'completed', 0.85);

      const risk = monitor.getRisk('C1');
      const mitigation = risk?.mitigations.find(m => m.action === 'Create detailed prototype in first week');

      expect(mitigation?.completionDate).toBeDefined();
      expect(mitigation?.effectiveness).toBe(0.85);
    });
  });

  describe('Risk Escalation', () => {
    it('should escalate risk', () => {
      monitor.escalateRisk('C1', 'Critical indicator triggered');

      const risk = monitor.getRisk('C1');
      expect(risk?.escalationLevel).toBeGreaterThan(0);
      expect(risk?.status).toBe('Escalated');
    });

    it('should not exceed max escalation level', () => {
      for (let i = 0; i < 10; i++) {
        monitor.escalateRisk('C1', 'Test escalation');
      }

      const risk = monitor.getRisk('C1');
      expect(risk?.escalationLevel).toBeLessThanOrEqual(4);
    });

    it('should auto-escalate on critical alert', () => {
      monitor.updateIndicator('C2', 'Data Corruption Incidents', 1);

      const risk = monitor.getRisk('C2');
      expect(risk?.escalationLevel).toBeGreaterThan(0);
    });
  });

  describe('Check Frequency', () => {
    it('should identify risks due for check', () => {
      const risks = monitor.getRisksDueForCheck();
      // All risks just initialized, none due yet
      expect(risks.length).toBe(0);
    });

    it('should mark daily risks as due after 24 hours', () => {
      const risk = monitor.getRisk('C1');
      if (risk) {
        // Simulate 25 hours ago
        risk.lastChecked = new Date(Date.now() - 25 * 60 * 60 * 1000);
      }

      const dueRisks = monitor.getRisksDueForCheck();
      expect(dueRisks.some(r => r.riskId === 'C1')).toBe(true);
    });
  });

  describe('Dashboard Generation', () => {
    it('should generate dashboard data', () => {
      const dashboard = monitor.generateDashboard() as any;

      expect(dashboard.summary).toBeDefined();
      expect(dashboard.summary.totalRisks).toBe(12);
      expect(dashboard.criticalRisks).toBeDefined();
      expect(dashboard.highRisks).toBeDefined();
    });

    it('should include active alerts in dashboard', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);

      const dashboard = monitor.generateDashboard() as any;
      expect(dashboard.summary.activeAlerts).toBeGreaterThan(0);
    });

    it('should track risks by status', () => {
      const dashboard = monitor.generateDashboard() as any;

      expect(dashboard.summary.risksByStatus).toBeDefined();
      expect(dashboard.summary.risksByStatus.monitoring).toBeGreaterThan(0);
    });
  });

  describe('Weekly Report', () => {
    it('should generate weekly report', () => {
      const report = monitor.generateWeeklyReport();

      expect(report).toContain('Weekly Risk Management Report');
      expect(report).toContain('Executive Summary');
      expect(report).toContain('Critical Risks Status');
    });

    it('should include triggered indicators in report', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);

      const report = monitor.generateWeeklyReport();
      expect(report).toContain('ATTENTION REQUIRED');
    });

    it('should show mitigation progress', () => {
      monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'completed');

      const report = monitor.generateWeeklyReport();
      expect(report).toContain('Mitigation Progress');
    });
  });

  describe('Persistence', () => {
    it('should save risk history to disk', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);

      const historyPath = path.join(testDataDir, 'risk-history.json');
      expect(fs.existsSync(historyPath)).toBe(true);
    });

    it('should save alerts to disk', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);

      const alertsPath = path.join(testDataDir, 'risk-alerts.json');
      expect(fs.existsSync(alertsPath)).toBe(true);
    });

    it('should load history on initialization', () => {
      monitor.updateIndicator('C1', 'Days Behind Schedule', 2);

      // Create new monitor instance
      const monitor2 = new RiskMonitor(testDataDir);
      const risk = monitor2.getRisk('C1');
      const indicator = risk?.indicators.find(i => i.name === 'Days Behind Schedule');

      expect(indicator?.currentValue).toBe(2);
      expect(indicator?.triggered).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex multi-risk scenario', () => {
      // C1: Behind schedule
      monitor.updateIndicator('C1', 'Days Behind Schedule', 3);

      // C2: Integration issues
      monitor.updateIndicator('C2', 'Integration Tests Failing', 7);
      monitor.updateIndicator('C2', 'Performance Degradation %', 25);

      // C3: Performance problems
      monitor.updateIndicator('C3', 'Response Time Increase %', 60);

      // Multiple mitigations in progress
      monitor.updateMitigation('C1', 'Implement in vertical slices', 'in-progress');
      monitor.updateMitigation('C2', 'Create integration test suite first (TDD)', 'in-progress');

      const dashboard = monitor.generateDashboard() as any;
      expect(dashboard.summary.activeAlerts).toBeGreaterThanOrEqual(4);
      expect(dashboard.summary.criticalAlerts).toBeGreaterThan(0);

      const report = monitor.generateWeeklyReport();
      expect(report).toContain('C1');
      expect(report).toContain('C2');
      expect(report).toContain('C3');
    });

    it('should handle full risk lifecycle', () => {
      // 1. Risk is monitoring
      let risk = monitor.getRisk('H1');
      expect(risk?.status).toBe('Monitoring');

      // 2. Indicator triggers
      monitor.updateIndicator('H1', 'Task Success Rate Decline %', 6);
      risk = monitor.getRisk('H1');
      expect(monitor.getActiveAlerts().length).toBeGreaterThan(0);

      // 3. Mitigation starts
      monitor.updateMitigation('H1', 'Implement validation layers (confidence >0.80)', 'in-progress');

      // 4. Issue resolved, indicator returns to normal
      monitor.updateIndicator('H1', 'Task Success Rate Decline %', 2);
      risk = monitor.getRisk('H1');
      const indicator = risk?.indicators.find(i => i.name === 'Task Success Rate Decline %');
      expect(indicator?.triggered).toBe(false);

      // 5. Mitigation completed
      monitor.updateMitigation('H1', 'Implement validation layers (confidence >0.80)', 'completed', 0.90);
      risk = monitor.getRisk('H1');
      const mitigation = risk?.mitigations.find(m => m.action.includes('validation layers'));
      expect(mitigation?.status).toBe('completed');
      expect(mitigation?.effectiveness).toBe(0.90);
    });
  });
});
