/**
 * Prometheus Metrics Integration for Claude Code
 *
 * Exports custom metrics for neural system, verification, GOAP planning,
 * and system performance monitoring.
 */

import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// =============================================================================
// REGISTRY & DEFAULT METRICS
// =============================================================================

// Create a Registry to register the metrics
export const register = new client.Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'claude_code_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// =============================================================================
// NEURAL SYSTEM METRICS
// =============================================================================

/**
 * Total neural operations counter
 * Labels: operation_type (learning, retrieval, extraction)
 */
export const neuralOperationsTotal = new client.Counter({
  name: 'neural_operations_total',
  help: 'Total number of neural system operations',
  labelNames: ['operation_type'],
  registers: [register],
});

/**
 * Pattern confidence histogram
 * Tracks distribution of pattern confidence scores
 */
export const patternConfidence = new client.Histogram({
  name: 'pattern_confidence',
  help: 'Distribution of pattern confidence scores',
  labelNames: ['pattern_type'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register],
});

/**
 * Pattern memory size in bytes
 */
export const patternMemoryBytes = new client.Gauge({
  name: 'pattern_memory_bytes',
  help: 'Current pattern memory size in bytes',
  registers: [register],
});

/**
 * Memory compression ratio
 */
export const memoryCompressionRatio = new client.Gauge({
  name: 'memory_compression_ratio',
  help: 'Memory compression ratio (compressed/original)',
  registers: [register],
});

/**
 * Feedback loop cycles counter
 */
export const feedbackLoopCycles = new client.Counter({
  name: 'feedback_loop_cycles_total',
  help: 'Total number of feedback loop cycles completed',
  registers: [register],
});

/**
 * Patterns learned counter
 */
export const patternsLearnedTotal = new client.Counter({
  name: 'patterns_learned_total',
  help: 'Total number of patterns learned',
  labelNames: ['pattern_type'],
  registers: [register],
});

/**
 * Pattern reused counter
 */
export const patternReusedTotal = new client.Counter({
  name: 'pattern_reused_total',
  help: 'Total number of times patterns were reused',
  labelNames: ['pattern_type'],
  registers: [register],
});

/**
 * Pattern applied counter
 */
export const patternAppliedTotal = new client.Counter({
  name: 'pattern_applied_total',
  help: 'Total number of times patterns were applied',
  labelNames: ['pattern_type'],
  registers: [register],
});

/**
 * Pattern retrieval duration histogram
 */
export const patternRetrievalDuration = new client.Histogram({
  name: 'pattern_retrieval_duration_seconds',
  help: 'Duration of pattern retrieval operations',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

/**
 * Pattern extraction errors counter
 */
export const patternExtractionErrors = new client.Counter({
  name: 'pattern_extraction_errors_total',
  help: 'Total number of pattern extraction errors',
  labelNames: ['error_type'],
  registers: [register],
});

/**
 * Pattern last used timestamp gauge
 */
export const patternLastUsedTimestamp = new client.Gauge({
  name: 'pattern_last_used_timestamp',
  help: 'Unix timestamp of when pattern was last used',
  labelNames: ['pattern_id'],
  registers: [register],
});

// =============================================================================
// VERIFICATION & TRUTH SYSTEM METRICS
// =============================================================================

/**
 * Truth score histogram
 * Tracks distribution of truth scores across verifications
 */
export const truthScore = new client.Histogram({
  name: 'truth_score',
  help: 'Distribution of verification truth scores',
  labelNames: ['agent_id'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0],
  registers: [register],
});

/**
 * Verification success counter
 */
export const verificationSuccessTotal = new client.Counter({
  name: 'verification_success_total',
  help: 'Total number of successful verifications',
  labelNames: ['agent_id'],
  registers: [register],
});

/**
 * Verification failures counter
 */
export const verificationFailuresTotal = new client.Counter({
  name: 'verification_failures_total',
  help: 'Total number of failed verifications',
  labelNames: ['agent_id', 'reason'],
  registers: [register],
});

/**
 * Auto rollback counter
 */
export const autoRollbackTotal = new client.Counter({
  name: 'auto_rollback_total',
  help: 'Total number of automatic rollbacks triggered',
  labelNames: ['reason'],
  registers: [register],
});

/**
 * Agent truth score gauge
 */
export const agentTruthScore = new client.Gauge({
  name: 'agent_truth_score',
  help: 'Current truth score for each agent',
  labelNames: ['agent_id'],
  registers: [register],
});

/**
 * Agent task duration histogram
 */
export const agentTaskDuration = new client.Histogram({
  name: 'agent_task_duration_seconds',
  help: 'Duration of agent task execution',
  labelNames: ['agent_id', 'task_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

// =============================================================================
// DATABASE & CACHING METRICS
// =============================================================================

/**
 * Database query duration histogram
 */
export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

/**
 * Database connection errors counter
 */
export const dbConnectionErrors = new client.Counter({
  name: 'database_connection_errors_total',
  help: 'Total number of database connection errors',
  labelNames: ['error_type'],
  registers: [register],
});

/**
 * Cache hits counter
 */
export const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

/**
 * Cache misses counter
 */
export const cacheMissesTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

/**
 * Cache hit rate gauge (calculated)
 */
export const cacheHitRate = new client.Gauge({
  name: 'cache_hit_rate',
  help: 'Current cache hit rate',
  labelNames: ['cache_type'],
  registers: [register],
});

// =============================================================================
// GOAP PLANNING & COORDINATION METRICS
// =============================================================================

/**
 * GOAP planning duration histogram
 */
export const goapPlanningDuration = new client.Histogram({
  name: 'goap_planning_duration_seconds',
  help: 'Duration of GOAP planning operations',
  labelNames: ['plan_type'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

/**
 * Coordination efficiency gauge
 */
export const coordinationEfficiency = new client.Gauge({
  name: 'coordination_efficiency',
  help: 'Current coordination efficiency (0-1)',
  registers: [register],
});

/**
 * Task completed counter
 */
export const taskCompletedTotal = new client.Counter({
  name: 'task_completed_total',
  help: 'Total number of completed tasks',
  labelNames: ['task_type', 'status'],
  registers: [register],
});

/**
 * Background task queue length gauge
 */
export const backgroundTaskQueueLength = new client.Gauge({
  name: 'background_task_queue_length',
  help: 'Current number of tasks in background queue',
  registers: [register],
});

// =============================================================================
// ERROR TRACKING METRICS
// =============================================================================

/**
 * General errors counter
 */
export const errorsTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'severity'],
  registers: [register],
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Record neural operation
 */
export function recordNeuralOperation(operationType: string): void {
  neuralOperationsTotal.inc({ operation_type: operationType });
}

/**
 * Record pattern confidence
 */
export function recordPatternConfidence(patternType: string, confidence: number): void {
  patternConfidence.observe({ pattern_type: patternType }, confidence);
}

/**
 * Record pattern learning
 */
export function recordPatternLearned(patternType: string): void {
  patternsLearnedTotal.inc({ pattern_type: patternType });
}

/**
 * Record pattern retrieval
 */
export async function recordPatternRetrieval<T>(
  operation: () => Promise<T>
): Promise<T> {
  const end = patternRetrievalDuration.startTimer();
  try {
    return await operation();
  } finally {
    end();
  }
}

/**
 * Record verification result
 */
export function recordVerification(agentId: string, score: number, success: boolean): void {
  truthScore.observe({ agent_id: agentId }, score);
  agentTruthScore.set({ agent_id: agentId }, score);

  if (success) {
    verificationSuccessTotal.inc({ agent_id: agentId });
  } else {
    verificationFailuresTotal.inc({ agent_id: agentId, reason: 'threshold_not_met' });
  }
}

/**
 * Record database query
 */
export async function recordDbQuery<T>(
  queryType: string,
  table: string,
  operation: () => Promise<T>
): Promise<T> {
  const end = dbQueryDuration.startTimer({ query_type: queryType, table });
  try {
    return await operation();
  } catch (error) {
    dbConnectionErrors.inc({ error_type: 'query_failed' });
    throw error;
  } finally {
    end();
  }
}

/**
 * Record cache access
 */
export function recordCacheAccess(cacheType: string, hit: boolean): void {
  if (hit) {
    cacheHitsTotal.inc({ cache_type: cacheType });
  } else {
    cacheMissesTotal.inc({ cache_type: cacheType });
  }
}

/**
 * Update cache hit rate
 */
export function updateCacheHitRate(cacheType: string): void {
  const hits = cacheHitsTotal['hashMap']?.[`cache_type:${cacheType}`]?.value || 0;
  const misses = cacheMissesTotal['hashMap']?.[`cache_type:${cacheType}`]?.value || 0;
  const total = hits + misses;

  if (total > 0) {
    const hitRate = hits / total;
    cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }
}

/**
 * Record GOAP planning
 */
export async function recordGoapPlanning<T>(
  planType: string,
  operation: () => Promise<T>
): Promise<T> {
  const end = goapPlanningDuration.startTimer({ plan_type: planType });
  try {
    return await operation();
  } finally {
    end();
  }
}

/**
 * Record task completion
 */
export function recordTaskCompletion(taskType: string, status: 'success' | 'failure'): void {
  taskCompletedTotal.inc({ task_type: taskType, status });
}

/**
 * Record error
 */
export function recordError(errorType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
  errorsTotal.inc({ error_type: errorType, severity });
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Metrics endpoint middleware
 * Exposes /metrics endpoint for Prometheus scraping
 */
export async function metricsEndpoint(req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
}

/**
 * Request duration tracking middleware
 */
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export function requestDurationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });
  });

  next();
}

// =============================================================================
// PERIODIC METRIC UPDATES
// =============================================================================

/**
 * Start periodic metric collection
 * Call this on application startup
 */
export function startMetricCollection(): void {
  // Update cache hit rates every 10 seconds
  setInterval(() => {
    updateCacheHitRate('pattern');
    updateCacheHitRate('vector');
  }, 10000);

  console.log('[Metrics] Periodic metric collection started');
}

/**
 * Initialize metrics system
 * Call this during application bootstrap
 */
export function initializeMetrics(): void {
  console.log('[Metrics] Prometheus metrics initialized');
  console.log('[Metrics] Metrics available at /metrics endpoint');

  // Start periodic collection
  startMetricCollection();
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  register,
  metricsEndpoint,
  requestDurationMiddleware,
  initializeMetrics,

  // Metric recorders
  recordNeuralOperation,
  recordPatternConfidence,
  recordPatternLearned,
  recordPatternRetrieval,
  recordVerification,
  recordDbQuery,
  recordCacheAccess,
  recordGoapPlanning,
  recordTaskCompletion,
  recordError,

  // Direct metric access
  neuralOperationsTotal,
  patternConfidence,
  truthScore,
  dbQueryDuration,
  cacheHitRate,
  goapPlanningDuration,
  coordinationEfficiency,
};
