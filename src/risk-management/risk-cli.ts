#!/usr/bin/env node
/**
 * Risk Management CLI
 * Command-line interface for risk monitoring and management
 */

import { riskMonitor, RiskMetrics } from './risk-monitor';
import * as fs from 'fs';
import * as path from 'path';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function printHeader(title: string): void {
  console.log('\n' + colorize('═'.repeat(60), 'cyan'));
  console.log(colorize(title, 'bold'));
  console.log(colorize('═'.repeat(60), 'cyan'));
}

function printRisk(risk: RiskMetrics): void {
  const statusColor =
    risk.status === 'Escalated' || risk.status === 'Materialized' ? 'red' :
    risk.status === 'Active' ? 'yellow' :
    risk.status === 'Mitigated' ? 'green' : 'blue';

  const categoryColor =
    risk.category === 'Critical' ? 'red' :
    risk.category === 'High' ? 'yellow' :
    risk.category === 'Medium' ? 'blue' : 'green';

  console.log(`\n${colorize(`[${risk.riskId}]`, 'bold')} ${risk.name}`);
  console.log(`  Category: ${colorize(risk.category, categoryColor)} | Score: ${colorize(risk.score.toFixed(1), categoryColor)}/10`);
  console.log(`  Status: ${colorize(risk.status, statusColor)} | Escalation: Level ${risk.escalationLevel}`);
  console.log(`  Last Checked: ${risk.lastChecked.toLocaleString()} (${risk.checkFrequency})`);

  const triggeredCount = risk.indicators.filter(i => i.triggered).length;
  if (triggeredCount > 0) {
    console.log(`  ${colorize('⚠️  Triggered Indicators:', 'red')} ${triggeredCount}/${risk.indicators.length}`);
    risk.indicators.filter(i => i.triggered).forEach(ind => {
      console.log(`     - ${ind.name}: ${ind.currentValue} ${ind.operator} ${ind.threshold} (${ind.severity})`);
    });
  } else {
    console.log(`  ✓ All indicators normal (${risk.indicators.length} monitored)`);
  }

  const activeMitigations = risk.mitigations.filter(m => m.status === 'in-progress' || m.status === 'completed');
  if (activeMitigations.length > 0) {
    console.log(`  Active Mitigations: ${activeMitigations.length}`);
    activeMitigations.slice(0, 2).forEach(m => {
      const statusSymbol = m.status === 'completed' ? '✓' : '⏳';
      console.log(`     ${statusSymbol} ${m.action.substring(0, 50)}...`);
    });
  }
}

function commandStatus(): void {
  printHeader('📊 Risk Management Status');

  const dashboard = riskMonitor.generateDashboard() as any;

  console.log('\n' + colorize('Summary:', 'bold'));
  console.log(`  Total Risks: ${dashboard.summary.totalRisks}`);
  console.log(`  ${colorize('Critical:', 'red')} ${dashboard.summary.criticalRisks} | ${colorize('High:', 'yellow')} ${dashboard.summary.highRisks}`);
  console.log(`  Active Alerts: ${colorize(String(dashboard.summary.activeAlerts), dashboard.summary.activeAlerts > 0 ? 'yellow' : 'green')}`);
  console.log(`  Critical Alerts: ${colorize(String(dashboard.summary.criticalAlerts), dashboard.summary.criticalAlerts > 0 ? 'red' : 'green')}`);

  console.log('\n' + colorize('Risks by Status:', 'bold'));
  console.log(`  Monitoring: ${dashboard.summary.risksByStatus.monitoring}`);
  console.log(`  Active: ${colorize(String(dashboard.summary.risksByStatus.active), 'yellow')}`);
  console.log(`  Mitigated: ${colorize(String(dashboard.summary.risksByStatus.mitigated), 'green')}`);
  console.log(`  Materialized: ${colorize(String(dashboard.summary.risksByStatus.materialized), 'red')}`);
  console.log(`  Escalated: ${colorize(String(dashboard.summary.risksByStatus.escalated), 'red')}`);

  if (dashboard.summary.criticalAlerts > 0) {
    console.log('\n' + colorize('🚨 CRITICAL ALERTS REQUIRE IMMEDIATE ATTENTION!', 'red'));
    console.log('   Run: risk-cli alerts --critical');
  }
}

function commandList(category?: string): void {
  printHeader('📋 Risk List');

  let risks = riskMonitor.getAllRisks();

  if (category) {
    risks = risks.filter(r => r.category.toLowerCase() === category.toLowerCase());
  }

  // Sort by score descending
  risks.sort((a, b) => b.score - a.score);

  for (const risk of risks) {
    printRisk(risk);
  }

  console.log(`\n${colorize('─'.repeat(60), 'cyan')}`);
  console.log(`Total: ${risks.length} risks`);
}

function commandDetail(riskId: string): void {
  const risk = riskMonitor.getRisk(riskId.toUpperCase());

  if (!risk) {
    console.error(colorize(`Risk ${riskId} not found`, 'red'));
    process.exit(1);
  }

  printHeader(`Risk Detail: ${risk.riskId} - ${risk.name}`);
  printRisk(risk);

  console.log('\n' + colorize('Indicators:', 'bold'));
  for (const ind of risk.indicators) {
    const status = ind.triggered ? colorize('⚠️  TRIGGERED', 'red') : colorize('✓ OK', 'green');
    console.log(`  ${status} ${ind.name}`);
    console.log(`    Current: ${ind.currentValue} | Threshold: ${ind.operator} ${ind.threshold}`);
    console.log(`    Severity: ${ind.severity}`);
    if (ind.lastTriggered) {
      console.log(`    Last Triggered: ${ind.lastTriggered.toLocaleString()}`);
    }
  }

  console.log('\n' + colorize('Mitigation Actions:', 'bold'));
  for (const mit of risk.mitigations) {
    const statusSymbol =
      mit.status === 'completed' ? '✓' :
      mit.status === 'in-progress' ? '⏳' :
      mit.status === 'failed' ? '✗' : '○';

    const statusColor =
      mit.status === 'completed' ? 'green' :
      mit.status === 'in-progress' ? 'yellow' :
      mit.status === 'failed' ? 'red' : 'blue';

    console.log(`  ${statusSymbol} ${colorize(mit.status.toUpperCase(), statusColor)}: ${mit.action}`);
    console.log(`    Owner: ${mit.owner} | Timeline: ${mit.timeline}`);
    if (mit.effectiveness !== undefined) {
      console.log(`    Effectiveness: ${(mit.effectiveness * 100).toFixed(0)}%`);
    }
  }
}

function commandAlerts(criticalOnly: boolean = false): void {
  printHeader(criticalOnly ? '🚨 Critical Alerts' : '📢 Active Alerts');

  const alerts = criticalOnly ? riskMonitor.getCriticalAlerts() : riskMonitor.getActiveAlerts();

  if (alerts.length === 0) {
    console.log(colorize('\n✓ No active alerts', 'green'));
    return;
  }

  for (const alert of alerts) {
    const severityColor =
      alert.severity === 'critical' ? 'red' :
      alert.severity === 'warning' ? 'yellow' : 'blue';

    console.log(`\n${colorize(`[${alert.alertId}]`, 'bold')}`);
    console.log(`  Severity: ${colorize(alert.severity.toUpperCase(), severityColor)}`);
    console.log(`  Risk: ${alert.riskId}`);
    console.log(`  Time: ${alert.timestamp.toLocaleString()}`);
    console.log(`  Message: ${alert.message}`);
    console.log(`  Recommended Action: ${colorize(alert.recommendedAction, 'yellow')}`);

    if (alert.indicators.length > 0) {
      console.log(`  Triggered Indicators:`);
      alert.indicators.forEach(ind => console.log(`    - ${ind}`));
    }
  }

  console.log(`\n${colorize('─'.repeat(60), 'cyan')}`);
  console.log(`Total: ${alerts.length} active alerts`);
}

function commandUpdate(riskId: string, indicator: string, value: number): void {
  try {
    riskMonitor.updateIndicator(riskId.toUpperCase(), indicator, value);
    console.log(colorize(`✓ Updated ${riskId} - ${indicator} = ${value}`, 'green'));

    const risk = riskMonitor.getRisk(riskId.toUpperCase());
    if (risk) {
      const ind = risk.indicators.find(i => i.name === indicator);
      if (ind?.triggered) {
        console.log(colorize(`⚠️  Indicator triggered! Check alerts.`, 'yellow'));
      }
    }
  } catch (error: any) {
    console.error(colorize(`Error: ${error.message}`, 'red'));
    process.exit(1);
  }
}

function commandMitigation(riskId: string, action: string, status: string): void {
  const validStatuses = ['planned', 'in-progress', 'completed', 'failed'];
  if (!validStatuses.includes(status)) {
    console.error(colorize(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 'red'));
    process.exit(1);
  }

  try {
    riskMonitor.updateMitigation(riskId.toUpperCase(), action, status as any);
    console.log(colorize(`✓ Updated mitigation for ${riskId}`, 'green'));
  } catch (error: any) {
    console.error(colorize(`Error: ${error.message}`, 'red'));
    process.exit(1);
  }
}

function commandReport(outputFile?: string): void {
  const report = riskMonitor.generateWeeklyReport();

  if (outputFile) {
    fs.writeFileSync(outputFile, report);
    console.log(colorize(`✓ Report saved to ${outputFile}`, 'green'));
  } else {
    console.log(report);
  }
}

function commandDashboard(): void {
  const dashboard = riskMonitor.generateDashboard();
  console.log(JSON.stringify(dashboard, null, 2));
}

function showHelp(): void {
  console.log(`
${colorize('Risk Management CLI', 'bold')}

${colorize('Usage:', 'cyan')}
  risk-cli <command> [options]

${colorize('Commands:', 'cyan')}
  status                           Show overall risk status
  list [category]                  List all risks (optional: critical/high/medium/low)
  detail <riskId>                  Show detailed risk information
  alerts [--critical]              Show active alerts (optional: critical only)
  update <riskId> <indicator> <value>  Update risk indicator
  mitigation <riskId> <action> <status>  Update mitigation status
  report [--output <file>]         Generate weekly report
  dashboard                        Output dashboard data (JSON)
  help                            Show this help message

${colorize('Examples:', 'cyan')}
  risk-cli status
  risk-cli list critical
  risk-cli detail C1
  risk-cli alerts --critical
  risk-cli update C1 "Days Behind Schedule" 2
  risk-cli mitigation C1 "Create detailed prototype" in-progress
  risk-cli report --output weekly-report.md

${colorize('Risk Categories:', 'cyan')}
  Critical (C1-C3)  - Daily monitoring required
  High (H1-H3)      - Weekly monitoring required
  Medium (M1-M4)    - Bi-weekly monitoring required
`);
}

// Main CLI handler
function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status':
      commandStatus();
      break;

    case 'list':
      commandList(args[1]);
      break;

    case 'detail':
      if (!args[1]) {
        console.error(colorize('Error: Risk ID required', 'red'));
        process.exit(1);
      }
      commandDetail(args[1]);
      break;

    case 'alerts':
      commandAlerts(args[1] === '--critical');
      break;

    case 'update':
      if (args.length < 4) {
        console.error(colorize('Error: Usage: update <riskId> <indicator> <value>', 'red'));
        process.exit(1);
      }
      commandUpdate(args[1], args[2], parseFloat(args[3]));
      break;

    case 'mitigation':
      if (args.length < 4) {
        console.error(colorize('Error: Usage: mitigation <riskId> <action> <status>', 'red'));
        process.exit(1);
      }
      commandMitigation(args[1], args[2], args[3]);
      break;

    case 'report':
      const outputIndex = args.indexOf('--output');
      const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : undefined;
      commandReport(outputFile);
      break;

    case 'dashboard':
      commandDashboard();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      if (!command) {
        commandStatus();
      } else {
        console.error(colorize(`Unknown command: ${command}`, 'red'));
        console.log('Run "risk-cli help" for usage information');
        process.exit(1);
      }
  }
}

// Run CLI
if (require.main === module) {
  main();
}
