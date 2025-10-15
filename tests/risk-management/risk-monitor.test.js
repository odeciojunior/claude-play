"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const risk_monitor_1 = require("../../src/risk-management/risk-monitor");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
(0, globals_1.describe)('Risk Management System', () => {
    let monitor;
    const testDataDir = '.test-swarm';
    (0, globals_1.beforeEach)(() => {
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true });
        }
        fs.mkdirSync(testDataDir, { recursive: true });
        monitor = new risk_monitor_1.RiskMonitor(testDataDir);
    });
    (0, globals_1.describe)('Initialization', () => {
        (0, globals_1.it)('should initialize all 12 risks', () => {
            const risks = monitor.getAllRisks();
            (0, globals_1.expect)(risks.length).toBe(12);
        });
        (0, globals_1.it)('should have correct risk categories', () => {
            const risks = monitor.getAllRisks();
            const categories = risks.map(r => r.category);
            const criticalCount = categories.filter(c => c === 'Critical').length;
            const highCount = categories.filter(c => c === 'High').length;
            const mediumCount = categories.filter(c => c === 'Medium').length;
            (0, globals_1.expect)(criticalCount).toBe(3);
            (0, globals_1.expect)(highCount).toBe(3);
            (0, globals_1.expect)(mediumCount).toBe(6);
        });
        (0, globals_1.it)('should initialize all risks with monitoring status', () => {
            const risks = monitor.getAllRisks();
            risks.forEach(risk => {
                (0, globals_1.expect)(risk.status).toBe('Monitoring');
            });
        });
        (0, globals_1.it)('should set correct check frequencies', () => {
            const c1 = monitor.getRisk('C1');
            const h1 = monitor.getRisk('H1');
            const m1 = monitor.getRisk('M1');
            (0, globals_1.expect)(c1?.checkFrequency).toBe('daily');
            (0, globals_1.expect)(h1?.checkFrequency).toBe('weekly');
            (0, globals_1.expect)(m1?.checkFrequency).toBe('bi-weekly');
        });
    });
    (0, globals_1.describe)('Risk Scoring', () => {
        (0, globals_1.it)('should calculate correct risk scores', () => {
            const c1 = monitor.getRisk('C1');
            (0, globals_1.expect)(c1?.score).toBe(8.0);
            const c2 = monitor.getRisk('C2');
            (0, globals_1.expect)(c2?.score).toBe(7.0);
            const c3 = monitor.getRisk('C3');
            (0, globals_1.expect)(c3?.score).toBe(6.0);
        });
        (0, globals_1.it)('should have higher scores for critical risks', () => {
            const risks = monitor.getAllRisks();
            const criticalRisks = risks.filter(r => r.category === 'Critical');
            const mediumRisks = risks.filter(r => r.category === 'Medium');
            const avgCriticalScore = criticalRisks.reduce((sum, r) => sum + r.score, 0) / criticalRisks.length;
            const avgMediumScore = mediumRisks.reduce((sum, r) => sum + r.score, 0) / mediumRisks.length;
            (0, globals_1.expect)(avgCriticalScore).toBeGreaterThan(avgMediumScore);
        });
    });
    (0, globals_1.describe)('Indicator Updates', () => {
        (0, globals_1.it)('should update indicator values', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            const risk = monitor.getRisk('C1');
            const indicator = risk?.indicators.find(i => i.name === 'Days Behind Schedule');
            (0, globals_1.expect)(indicator?.currentValue).toBe(2);
        });
        (0, globals_1.it)('should trigger indicator when threshold crossed', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            const risk = monitor.getRisk('C1');
            const indicator = risk?.indicators.find(i => i.name === 'Days Behind Schedule');
            (0, globals_1.expect)(indicator?.triggered).toBe(true);
        });
        (0, globals_1.it)('should not trigger when below threshold', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 0.5);
            const risk = monitor.getRisk('C1');
            const indicator = risk?.indicators.find(i => i.name === 'Days Behind Schedule');
            (0, globals_1.expect)(indicator?.triggered).toBe(false);
        });
        (0, globals_1.it)('should generate alert on indicator trigger', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            const alerts = monitor.getActiveAlerts();
            (0, globals_1.expect)(alerts.length).toBeGreaterThan(0);
            (0, globals_1.expect)(alerts[0].riskId).toBe('C1');
        });
    });
    (0, globals_1.describe)('Alert Management', () => {
        (0, globals_1.beforeEach)(() => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            monitor.updateIndicator('C3', 'Response Time Increase %', 60);
        });
        (0, globals_1.it)('should track multiple alerts', () => {
            const alerts = monitor.getActiveAlerts();
            (0, globals_1.expect)(alerts.length).toBeGreaterThanOrEqual(2);
        });
        (0, globals_1.it)('should filter critical alerts', () => {
            monitor.updateIndicator('C2', 'Data Corruption Incidents', 1);
            const criticalAlerts = monitor.getCriticalAlerts();
            (0, globals_1.expect)(criticalAlerts.length).toBeGreaterThan(0);
            (0, globals_1.expect)(criticalAlerts[0].severity).toBe('critical');
        });
        (0, globals_1.it)('should acknowledge alerts', () => {
            const alerts = monitor.getActiveAlerts();
            const alertId = alerts[0].alertId;
            monitor.acknowledgeAlert(alertId);
            const activeAlerts = monitor.getActiveAlerts();
            (0, globals_1.expect)(activeAlerts.find(a => a.alertId === alertId)).toBeUndefined();
        });
        (0, globals_1.it)('should include recommended actions', () => {
            const alerts = monitor.getActiveAlerts();
            (0, globals_1.expect)(alerts[0].recommendedAction).toBeTruthy();
            (0, globals_1.expect)(alerts[0].recommendedAction.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Mitigation Tracking', () => {
        (0, globals_1.it)('should update mitigation status', () => {
            monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'in-progress');
            const risk = monitor.getRisk('C1');
            const mitigation = risk?.mitigations.find(m => m.action === 'Create detailed prototype in first week');
            (0, globals_1.expect)(mitigation?.status).toBe('in-progress');
        });
        (0, globals_1.it)('should set start date on in-progress', () => {
            monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'in-progress');
            const risk = monitor.getRisk('C1');
            const mitigation = risk?.mitigations.find(m => m.action === 'Create detailed prototype in first week');
            (0, globals_1.expect)(mitigation?.startDate).toBeDefined();
        });
        (0, globals_1.it)('should set completion date and effectiveness', () => {
            monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'in-progress');
            monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'completed', 0.85);
            const risk = monitor.getRisk('C1');
            const mitigation = risk?.mitigations.find(m => m.action === 'Create detailed prototype in first week');
            (0, globals_1.expect)(mitigation?.completionDate).toBeDefined();
            (0, globals_1.expect)(mitigation?.effectiveness).toBe(0.85);
        });
    });
    (0, globals_1.describe)('Risk Escalation', () => {
        (0, globals_1.it)('should escalate risk', () => {
            monitor.escalateRisk('C1', 'Critical indicator triggered');
            const risk = monitor.getRisk('C1');
            (0, globals_1.expect)(risk?.escalationLevel).toBeGreaterThan(0);
            (0, globals_1.expect)(risk?.status).toBe('Escalated');
        });
        (0, globals_1.it)('should not exceed max escalation level', () => {
            for (let i = 0; i < 10; i++) {
                monitor.escalateRisk('C1', 'Test escalation');
            }
            const risk = monitor.getRisk('C1');
            (0, globals_1.expect)(risk?.escalationLevel).toBeLessThanOrEqual(4);
        });
        (0, globals_1.it)('should auto-escalate on critical alert', () => {
            monitor.updateIndicator('C2', 'Data Corruption Incidents', 1);
            const risk = monitor.getRisk('C2');
            (0, globals_1.expect)(risk?.escalationLevel).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Check Frequency', () => {
        (0, globals_1.it)('should identify risks due for check', () => {
            const risks = monitor.getRisksDueForCheck();
            (0, globals_1.expect)(risks.length).toBe(0);
        });
        (0, globals_1.it)('should mark daily risks as due after 24 hours', () => {
            const risk = monitor.getRisk('C1');
            if (risk) {
                risk.lastChecked = new Date(Date.now() - 25 * 60 * 60 * 1000);
            }
            const dueRisks = monitor.getRisksDueForCheck();
            (0, globals_1.expect)(dueRisks.some(r => r.riskId === 'C1')).toBe(true);
        });
    });
    (0, globals_1.describe)('Dashboard Generation', () => {
        (0, globals_1.it)('should generate dashboard data', () => {
            const dashboard = monitor.generateDashboard();
            (0, globals_1.expect)(dashboard.summary).toBeDefined();
            (0, globals_1.expect)(dashboard.summary.totalRisks).toBe(12);
            (0, globals_1.expect)(dashboard.criticalRisks).toBeDefined();
            (0, globals_1.expect)(dashboard.highRisks).toBeDefined();
        });
        (0, globals_1.it)('should include active alerts in dashboard', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            const dashboard = monitor.generateDashboard();
            (0, globals_1.expect)(dashboard.summary.activeAlerts).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should track risks by status', () => {
            const dashboard = monitor.generateDashboard();
            (0, globals_1.expect)(dashboard.summary.risksByStatus).toBeDefined();
            (0, globals_1.expect)(dashboard.summary.risksByStatus.monitoring).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Weekly Report', () => {
        (0, globals_1.it)('should generate weekly report', () => {
            const report = monitor.generateWeeklyReport();
            (0, globals_1.expect)(report).toContain('Weekly Risk Management Report');
            (0, globals_1.expect)(report).toContain('Executive Summary');
            (0, globals_1.expect)(report).toContain('Critical Risks Status');
        });
        (0, globals_1.it)('should include triggered indicators in report', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            const report = monitor.generateWeeklyReport();
            (0, globals_1.expect)(report).toContain('ATTENTION REQUIRED');
        });
        (0, globals_1.it)('should show mitigation progress', () => {
            monitor.updateMitigation('C1', 'Create detailed prototype in first week', 'completed');
            const report = monitor.generateWeeklyReport();
            (0, globals_1.expect)(report).toContain('Mitigation Progress');
        });
    });
    (0, globals_1.describe)('Persistence', () => {
        (0, globals_1.it)('should save risk history to disk', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            const historyPath = path.join(testDataDir, 'risk-history.json');
            (0, globals_1.expect)(fs.existsSync(historyPath)).toBe(true);
        });
        (0, globals_1.it)('should save alerts to disk', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            const alertsPath = path.join(testDataDir, 'risk-alerts.json');
            (0, globals_1.expect)(fs.existsSync(alertsPath)).toBe(true);
        });
        (0, globals_1.it)('should load history on initialization', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 2);
            const monitor2 = new risk_monitor_1.RiskMonitor(testDataDir);
            const risk = monitor2.getRisk('C1');
            const indicator = risk?.indicators.find(i => i.name === 'Days Behind Schedule');
            (0, globals_1.expect)(indicator?.currentValue).toBe(2);
            (0, globals_1.expect)(indicator?.triggered).toBe(true);
        });
    });
    (0, globals_1.describe)('Integration Scenarios', () => {
        (0, globals_1.it)('should handle complex multi-risk scenario', () => {
            monitor.updateIndicator('C1', 'Days Behind Schedule', 3);
            monitor.updateIndicator('C2', 'Integration Tests Failing', 7);
            monitor.updateIndicator('C2', 'Performance Degradation %', 25);
            monitor.updateIndicator('C3', 'Response Time Increase %', 60);
            monitor.updateMitigation('C1', 'Implement in vertical slices', 'in-progress');
            monitor.updateMitigation('C2', 'Create integration test suite first (TDD)', 'in-progress');
            const dashboard = monitor.generateDashboard();
            (0, globals_1.expect)(dashboard.summary.activeAlerts).toBeGreaterThanOrEqual(4);
            (0, globals_1.expect)(dashboard.summary.criticalAlerts).toBeGreaterThan(0);
            const report = monitor.generateWeeklyReport();
            (0, globals_1.expect)(report).toContain('C1');
            (0, globals_1.expect)(report).toContain('C2');
            (0, globals_1.expect)(report).toContain('C3');
        });
        (0, globals_1.it)('should handle full risk lifecycle', () => {
            let risk = monitor.getRisk('H1');
            (0, globals_1.expect)(risk?.status).toBe('Monitoring');
            monitor.updateIndicator('H1', 'Task Success Rate Decline %', 6);
            risk = monitor.getRisk('H1');
            (0, globals_1.expect)(monitor.getActiveAlerts().length).toBeGreaterThan(0);
            monitor.updateMitigation('H1', 'Implement validation layers (confidence >0.80)', 'in-progress');
            monitor.updateIndicator('H1', 'Task Success Rate Decline %', 2);
            risk = monitor.getRisk('H1');
            const indicator = risk?.indicators.find(i => i.name === 'Task Success Rate Decline %');
            (0, globals_1.expect)(indicator?.triggered).toBe(false);
            monitor.updateMitigation('H1', 'Implement validation layers (confidence >0.80)', 'completed', 0.90);
            risk = monitor.getRisk('H1');
            const mitigation = risk?.mitigations.find(m => m.action.includes('validation layers'));
            (0, globals_1.expect)(mitigation?.status).toBe('completed');
            (0, globals_1.expect)(mitigation?.effectiveness).toBe(0.90);
        });
    });
});
//# sourceMappingURL=risk-monitor.test.js.map