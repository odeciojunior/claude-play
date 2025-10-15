# Quick Start Guide - Claude Code Monitoring

## ⚡ 5-Minute Setup

### 1. Configure Environment (1 min)
```bash
cd monitoring
cp .env.example .env
# Edit .env with your notification credentials
```

### 2. Start Monitoring Stack (2 min)
```bash
docker-compose up -d
docker-compose ps  # Verify all services are running
```

### 3. Integrate Metrics in Your App (2 min)
```typescript
// src/index.ts
import { metricsEndpoint, initializeMetrics } from './monitoring/metrics';

initializeMetrics();
app.get('/metrics', metricsEndpoint);
```

### 4. Access Dashboards
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## 📊 Key Metrics Dashboard URLs

After Grafana starts, your main dashboard will be at:
```
http://localhost:3001/d/claude-code-main/claude-code-system-performance-health
```

## 🚨 Test Alerts

Trigger a test alert to verify notifications work:

```typescript
import { neuralOperationsTotal } from './monitoring/metrics';

// Simulate low operations (trigger NeuralOperationsDegraded alert)
for (let i = 0; i < 100000; i++) {
  neuralOperationsTotal.inc({ operation_type: 'test' });
}
```

Or directly in Prometheus:
```
http://localhost:9090/alerts
```

## 🔍 Common Queries

### Neural System Health
```promql
# Current operations/sec
rate(neural_operations_total[5m])

# Pattern confidence average
avg(pattern_confidence)

# Active patterns
count(pattern_confidence > 0.5)
```

### Verification Status
```promql
# Truth score P95
histogram_quantile(0.95, rate(truth_score_bucket[5m]))

# Verification success rate
rate(verification_success_total[5m]) / (rate(verification_success_total[5m]) + rate(verification_failures_total[5m]))
```

### Database Performance
```promql
# Query duration P95
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))

# Cache hit rate
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

## 🛠️ Quick Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f prometheus
docker-compose logs -f grafana
docker-compose logs -f alertmanager

# Restart specific service
docker-compose restart prometheus

# Check service health
curl http://localhost:9090/-/healthy    # Prometheus
curl http://localhost:3001/api/health   # Grafana
curl http://localhost:9093/-/healthy    # Alertmanager

# Reload Prometheus config (without restart)
curl -X POST http://localhost:9090/-/reload
```

## 📱 Notification Setup

### Slack
1. Create webhook: https://api.slack.com/messaging/webhooks
2. Add to `.env`: `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...`
3. Restart: `docker-compose restart alertmanager`

### PagerDuty
1. Get integration key from PagerDuty service
2. Add to `.env`: `PAGERDUTY_SERVICE_KEY=your-key`
3. Restart: `docker-compose restart alertmanager`

### Email (Gmail)
1. Generate App Password: https://myaccount.google.com/apppasswords
2. Add to `.env`:
   ```
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```
3. Restart: `docker-compose restart alertmanager`

## ✅ Health Check

After setup, verify everything works:

```bash
# 1. Check all containers are running
docker-compose ps
# Should show: prometheus, grafana, alertmanager (all "Up")

# 2. Verify Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# 3. Check if metrics are being collected
curl http://localhost:3000/metrics | grep neural_operations_total

# 4. Verify Grafana datasource
curl -s http://admin:admin@localhost:3001/api/datasources | jq '.[].name'

# 5. Test alert firing
curl http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {name: .labels.alertname, state: .state}'
```

All checks passing? ✅ You're ready to monitor!

## 🎯 What to Monitor First

### Day 1: Core Health
- Service status (UP/DOWN)
- Neural operations/sec (target: 150K+)
- Truth score (target: 95%+)
- Memory usage (target: <100MB)

### Week 1: Performance
- Database query times (target: <10ms)
- Cache hit rate (target: 80%+)
- Pattern confidence (target: 0.7-0.9)
- GOAP planning duration (target: <5s)

### Month 1: Optimization
- Pattern reuse rate (target: 80%+)
- Coordination efficiency (target: 95%+)
- Error patterns and trends
- Resource utilization optimization

## 🐛 Troubleshooting

### Metrics not showing?
```bash
# Check if app is exposing metrics
curl http://localhost:3000/metrics

# Check Prometheus is scraping
docker-compose logs prometheus | grep "error"

# Verify target is configured
http://localhost:9090/targets
```

### Alerts not firing?
```bash
# Check alert rules are loaded
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {alert: .name, state: .state}'

# Check Alertmanager connectivity
docker-compose logs alertmanager | grep "error"
```

### Dashboard empty?
```bash
# Verify datasource
curl http://admin:admin@localhost:3001/api/datasources

# Check if data exists in Prometheus
http://localhost:9090/graph?g0.expr=neural_operations_total

# Re-import dashboard
# Grafana → Dashboards → Import → Upload grafana-dashboard.json
```

## 📚 Next Steps

1. **Customize alerts** - Edit `alerts.yml` for your thresholds
2. **Add custom metrics** - Extend `src/monitoring/metrics.ts`
3. **Create team dashboards** - Clone and customize the main dashboard
4. **Set up alerting channels** - Configure Slack, PagerDuty, Email
5. **Enable long-term storage** - Configure remote_write for Prometheus

## 🎉 Success Criteria

Your monitoring is working when:

- ✅ Dashboard shows real-time data (updates every 30s)
- ✅ Test alert fires and notification received
- ✅ All Prometheus targets are UP
- ✅ Query response time <1s
- ✅ No missing metrics or gaps in graphs

---

**Need help?** Check the full README.md or docs/operations/monitoring.md
