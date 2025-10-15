/**
 * Simple Webhook Server for Alertmanager
 * Receives and logs alerts from Alertmanager for custom processing
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 9095;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE = path.join(__dirname, 'alerts.log');

// Logging function
function log(level, message, data = {}) {
  if (LOG_LEVEL === 'debug' || (LOG_LEVEL === 'info' && level !== 'debug')) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };

    console.log(JSON.stringify(logEntry));

    // Write to file
    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
  }
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

// Process alert
function processAlert(alert) {
  const alertName = alert.labels?.alertname || 'Unknown';
  const severity = alert.labels?.severity || 'Unknown';
  const status = alert.status;

  log('info', `Alert received: ${alertName}`, {
    alertname: alertName,
    severity,
    status,
    startsAt: alert.startsAt,
    endsAt: alert.endsAt,
    labels: alert.labels,
    annotations: alert.annotations
  });

  // Custom alert handling can be added here
  // Examples:
  // - Send to custom notification service
  // - Update external database
  // - Trigger automated remediation
  // - Create incident tickets

  switch (severity) {
    case 'P0':
      log('critical', `CRITICAL ALERT: ${alertName}`, { alert });
      // Trigger emergency response
      break;
    case 'P1':
      log('error', `HIGH PRIORITY: ${alertName}`, { alert });
      // Escalate to team
      break;
    case 'P2':
      log('warn', `MEDIUM PRIORITY: ${alertName}`, { alert });
      // Normal notification
      break;
    case 'P3':
      log('info', `LOW PRIORITY: ${alertName}`, { alert });
      // Log for analysis
      break;
  }
}

// HTTP server
const server = http.createServer(async (req, res) => {
  const url = req.url;
  const method = req.method;

  log('debug', `Request received: ${method} ${url}`);

  // Health check
  if (url === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }

  // Webhook endpoints
  if (url.startsWith('/webhook/') && method === 'POST') {
    try {
      const body = await parseBody(req);
      const route = url.split('/')[2];

      log('info', `Webhook received: ${route}`, {
        route,
        alertCount: body.alerts?.length || 0
      });

      // Process each alert
      if (body.alerts && Array.isArray(body.alerts)) {
        body.alerts.forEach(alert => processAlert(alert));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        message: 'Alerts processed',
        count: body.alerts?.length || 0
      }));
    } catch (error) {
      log('error', 'Error processing webhook', { error: error.message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: error.message }));
    }
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
});

server.listen(PORT, () => {
  log('info', `Webhook server started on port ${PORT}`);
  console.log(`Webhook endpoints:`);
  console.log(`  - Health: http://localhost:${PORT}/health`);
  console.log(`  - Default: http://localhost:${PORT}/webhook/default`);
  console.log(`  - Critical: http://localhost:${PORT}/webhook/critical`);
  console.log(`Logs are written to: ${LOG_FILE}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});
