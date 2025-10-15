# Risk Management System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Build the System (30 seconds)

```bash
cd /home/odecio/projects/claude-play

# Compile TypeScript
npx tsc src/risk-management/risk-cli.ts src/risk-management/risk-monitor.ts \
  --outDir dist/risk-management \
  --module commonjs \
  --target es2020 \
  --esModuleInterop \
  --skipLibCheck
```

### Step 2: View Current Risk Status (10 seconds)

```bash
# Interactive dashboard
./scripts/risk-dashboard.sh

# Or CLI status
node dist/risk-management/risk-cli.js status
```

Expected output:
```
════════════════════════════════════════════════════════════
📊 Risk Management Status
════════════════════════════════════════════════════════════

Summary:
  Total Risks: 12
  Critical: 3 | High: 3
  Active Alerts: 0
  Critical Alerts: 0
```

### Step 3: Update Your First Indicator (20 seconds)

```bash
# Example: Update C1 progress indicator
node dist/risk-management/risk-cli.js update C1 "Implementation Progress %" 65

# View the updated risk
node dist/risk-management/risk-cli.js detail C1
```

### Step 4: Generate Your First Report (30 seconds)

```bash
# Generate weekly report
node dist/risk-management/risk-cli.js report --output my-first-report.md

# View the report
cat my-first-report.md
```

### Step 5: Set Up Daily Monitoring (2 minutes)

Create a monitoring script:

```bash
cat > monitor-risks.sh << 'EOF'
#!/bin/bash
# Daily risk monitoring

echo "📊 Daily Risk Check - $(date)"

# Update critical risk indicators
# TODO: Replace with actual metrics from your system
node dist/risk-management/risk-cli.js update C1 "Days Behind Schedule" 0
node dist/risk-management/risk-cli.js update C2 "Integration Tests Failing" 0
node dist/risk-management/risk-cli.js update C3 "Response Time Increase %" 5

# Check for critical alerts
CRITICAL=$(node dist/risk-management/risk-cli.js alerts --critical 2>/dev/null | grep -c "CRITICAL" || echo "0")

if [ "$CRITICAL" -gt 0 ]; then
    echo "🚨 CRITICAL ALERTS: $CRITICAL"
    node dist/risk-management/risk-cli.js alerts --critical
else
    echo "✅ No critical alerts"
fi

# Show status
node dist/risk-management/risk-cli.js status
EOF

chmod +x monitor-risks.sh
./monitor-risks.sh
```

## 📋 Essential Commands Reference

### View Risks

```bash
# Overall status
node dist/risk-management/risk-cli.js status

# List all risks
node dist/risk-management/risk-cli.js list

# List by category
node dist/risk-management/risk-cli.js list critical
node dist/risk-management/risk-cli.js list high
node dist/risk-management/risk-cli.js list medium

# Detailed view of specific risk
node dist/risk-management/risk-cli.js detail C1
node dist/risk-management/risk-cli.js detail H1
```

### Update Indicators

```bash
# Syntax: update <riskId> "<indicator name>" <value>

# Critical Risk C1 indicators
node dist/risk-management/risk-cli.js update C1 "Days Behind Schedule" 0
node dist/risk-management/risk-cli.js update C1 "Checkpoint Gates Passed" 2
node dist/risk-management/risk-cli.js update C1 "Implementation Progress %" 70

# Critical Risk C2 indicators
node dist/risk-management/risk-cli.js update C2 "Integration Tests Failing" 3
node dist/risk-management/risk-cli.js update C2 "Performance Degradation %" 10
node dist/risk-management/risk-cli.js update C2 "Data Corruption Incidents" 0

# Critical Risk C3 indicators
node dist/risk-management/risk-cli.js update C3 "Response Time Increase %" 15
node dist/risk-management/risk-cli.js update C3 "Memory Usage MB" 400
node dist/risk-management/risk-cli.js update C3 "Throughput Decrease %" 5
```

### Manage Alerts

```bash
# View all active alerts
node dist/risk-management/risk-cli.js alerts

# View only critical alerts
node dist/risk-management/risk-cli.js alerts --critical

# Acknowledge alert (after taking action)
# Note: Alert IDs are shown in alert output
node dist/risk-management/risk-cli.js acknowledge ALERT-C1-1729000000000
```

### Track Mitigations

```bash
# Syntax: mitigation <riskId> "<action name>" <status>
# Status: planned | in-progress | completed | failed

# Start a mitigation
node dist/risk-management/risk-cli.js mitigation C1 \
  "Create detailed prototype in first week" in-progress

# Complete a mitigation
node dist/risk-management/risk-cli.js mitigation C1 \
  "Implement in vertical slices" completed

# Mark as failed (triggers re-planning)
node dist/risk-management/risk-cli.js mitigation C2 \
  "Some mitigation action" failed
```

### Generate Reports

```bash
# Display report in terminal
node dist/risk-management/risk-cli.js report

# Save to file
node dist/risk-management/risk-cli.js report --output weekly-report.md

# Generate with timestamp
node dist/risk-management/risk-cli.js report \
  --output "reports/risk-$(date +%Y-%m-%d).md"
```

## 🎯 Daily Workflow

### Morning Check (5 minutes)

```bash
# 1. View dashboard
./scripts/risk-dashboard.sh

# 2. Check critical alerts
node dist/risk-management/risk-cli.js alerts --critical

# 3. Update critical risk indicators (C1-C3)
# Update with actual data from your systems
node dist/risk-management/risk-cli.js update C1 "Days Behind Schedule" <value>
node dist/risk-management/risk-cli.js update C2 "Integration Tests Failing" <value>
node dist/risk-management/risk-cli.js update C3 "Response Time Increase %" <value>
```

### End of Day (3 minutes)

```bash
# 1. Update mitigation progress
node dist/risk-management/risk-cli.js mitigation C1 \
  "Your mitigation action" in-progress

# 2. Check for new alerts
node dist/risk-management/risk-cli.js alerts

# 3. Quick status check
node dist/risk-management/risk-cli.js status
```

## 📅 Weekly Workflow

### Monday Morning (10 minutes)

```bash
# 1. Generate weekly report
node dist/risk-management/risk-cli.js report \
  --output "reports/week-$(date +%U)-$(date +%Y).md"

# 2. Update high-risk indicators (H1-H3)
node dist/risk-management/risk-cli.js update H1 "Task Success Rate Decline %" <value>
node dist/risk-management/risk-cli.js update H2 "Data Loss %" <value>
node dist/risk-management/risk-cli.js update H3 "Total Pattern Count" <value>

# 3. Review all risks
node dist/risk-management/risk-cli.js list
```

### Bi-weekly (Every 2 weeks - 15 minutes)

```bash
# 1. Update medium-risk indicators (M1-M4)
node dist/risk-management/risk-cli.js update M1 "Training Sessions Completed" <value>
node dist/risk-management/risk-cli.js update M2 "Feature Requests Pending" <value>
node dist/risk-management/risk-cli.js update M3 "Test Coverage %" <value>
node dist/risk-management/risk-cli.js update M4 "Documentation Coverage %" <value>

# 2. Review mitigation effectiveness
node dist/risk-management/risk-cli.js list medium

# 3. Generate comprehensive report for stakeholders
node dist/risk-management/risk-cli.js report --output stakeholder-report.md
```

## 🚨 Alert Response Workflow

### When Critical Alert Fires

```bash
# 1. Check alert details
node dist/risk-management/risk-cli.js alerts --critical

# 2. View affected risk
node dist/risk-management/risk-cli.js detail <riskId>

# 3. Execute recommended action (shown in alert)

# 4. Update mitigation status
node dist/risk-management/risk-cli.js mitigation <riskId> \
  "<mitigation action>" in-progress

# 5. Monitor indicator until resolved
node dist/risk-management/risk-cli.js detail <riskId>

# 6. Acknowledge alert once handled
# (Alert ID shown in alert output)
```

## 🔧 Integration Examples

### Example 1: Integrate with Performance Monitoring

```typescript
// performance-monitor.ts
import { riskMonitor } from './risk-management/risk-monitor';

async function checkPerformance() {
  // Get current performance metrics
  const responseTime = await getAverageResponseTime();
  const memoryUsage = await getCurrentMemoryUsage();

  // Calculate increase from baseline
  const baselineResponseTime = 100; // ms
  const increase = ((responseTime - baselineResponseTime) / baselineResponseTime) * 100;

  // Update risk indicator
  riskMonitor.updateIndicator('C3', 'Response Time Increase %', increase);
  riskMonitor.updateIndicator('C3', 'Memory Usage MB', memoryUsage);

  // Check for alerts
  const alerts = riskMonitor.getActiveAlerts();
  if (alerts.length > 0) {
    console.log('⚠️  Performance alerts triggered');
  }
}

// Run every hour
setInterval(checkPerformance, 60 * 60 * 1000);
```

### Example 2: Integrate with CI/CD

```yaml
# .github/workflows/risk-check.yml
name: Daily Risk Check

on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM daily
  workflow_dispatch:

jobs:
  check-risks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Dependencies
        run: npm install

      - name: Build Risk System
        run: |
          npx tsc src/risk-management/*.ts \
            --outDir dist/risk-management \
            --module commonjs --target es2020 \
            --esModuleInterop --skipLibCheck

      - name: Check Critical Risks
        run: |
          node dist/risk-management/risk-cli.js status
          CRITICAL=$(node dist/risk-management/risk-cli.js alerts --critical | grep -c "CRITICAL" || echo "0")
          if [ "$CRITICAL" -gt 0 ]; then
            echo "🚨 Critical alerts detected!"
            node dist/risk-management/risk-cli.js alerts --critical
            exit 1
          fi

      - name: Generate Report
        if: github.event.schedule == '0 9 * * 1'  # Monday only
        run: |
          node dist/risk-management/risk-cli.js report \
            --output weekly-report-$(date +%Y-%m-%d).md

      - name: Upload Report
        if: github.event.schedule == '0 9 * * 1'
        uses: actions/upload-artifact@v3
        with:
          name: risk-reports
          path: weekly-report-*.md
```

### Example 3: Slack Notifications

```typescript
// slack-notifier.ts
import { riskMonitor } from './risk-management/risk-monitor';
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_TOKEN);

async function sendCriticalAlerts() {
  const alerts = riskMonitor.getCriticalAlerts();

  for (const alert of alerts) {
    await slack.chat.postMessage({
      channel: '#risk-alerts',
      text: `🚨 Critical Risk Alert`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 ${alert.severity.toUpperCase()} Alert`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Risk:*\n${alert.riskId}` },
            { type: 'mrkdwn', text: `*Time:*\n${alert.timestamp}` }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n${alert.message}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Recommended Action:*\n${alert.recommendedAction}`
          }
        }
      ]
    });
  }
}

// Check every 5 minutes
setInterval(sendCriticalAlerts, 5 * 60 * 1000);
```

## 📊 Monitoring Frequency

| Risk Category | Check Frequency | Stakeholder Report |
|--------------|----------------|-------------------|
| Critical (C1-C3) | Daily | Daily standup |
| High (H1-H3) | Weekly | Weekly review |
| Medium (M1-M4) | Bi-weekly | Bi-weekly summary |

## ✅ Success Checklist

- [ ] System built and CLI working
- [ ] Daily monitoring script set up
- [ ] Critical risk indicators identified
- [ ] Alert notifications configured
- [ ] Weekly report generation automated
- [ ] Team trained on CLI usage
- [ ] Escalation protocol communicated
- [ ] Integration with metrics system planned

## 🆘 Getting Help

### Common Issues

**"Cannot find module"**
```bash
# Solution: Rebuild TypeScript
npx tsc src/risk-management/*.ts --outDir dist/risk-management
```

**"Risk not found"**
```bash
# Solution: Check risk ID (must be uppercase)
node dist/risk-management/risk-cli.js list  # View all risk IDs
```

**"Indicator not found"**
```bash
# Solution: Check exact indicator name
node dist/risk-management/risk-cli.js detail C1  # View all indicators
```

### Documentation

- **Full Guide**: `/home/odecio/projects/claude-play/docs/risk-management/README.md`
- **Implementation**: `/home/odecio/projects/claude-play/docs/risk-management/IMPLEMENTATION.md`
- **Source Code**: `/home/odecio/projects/claude-play/src/risk-management/`
- **Tests**: `/home/odecio/projects/claude-play/tests/risk-management/`

### Help Command

```bash
node dist/risk-management/risk-cli.js help
```

## 🎯 Next Steps

1. **Today**: Set up daily monitoring
2. **This week**: Integrate with metrics collection
3. **This month**: Automate weekly reports
4. **Ongoing**: Track all mitigations to completion

---

**Remember**: Risk management is about proactive prevention, not reactive firefighting. Check daily, act early, escalate quickly.

🚀 **You're ready to start!** Run `./scripts/risk-dashboard.sh` now.
