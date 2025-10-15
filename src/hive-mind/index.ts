/**
 * Hive-Mind Distributed Learning System
 *
 * Main entry point for distributed learning across swarm with
 * queen-worker architecture, Byzantine consensus, and pattern aggregation.
 */

export { QueenCoordinator, QueenStatus, RoyalDirective, ResourceAllocation, HiveHealthReport } from './queen-coordinator';
export { WorkerAgent, WorkerConfig, WorkerRole, Task, TaskResult, WorkerState } from './worker-agent';
export { ByzantineConsensus, ConsensusNode, ConsensusProposal, Vote, ConsensusRound, ConsensusMetrics } from './byzantine-consensus';
export { PatternAggregator, PatternContribution, AggregatedPattern, AggregationMetrics, ConflictResolution } from './pattern-aggregation';
export { HiveMindCoordinator, HiveMindConfig, HiveMindStatus, SwarmTask } from './hive-mind-coordinator';

import { Database } from 'sqlite3';
import { HiveMindCoordinator, HiveMindConfig } from './hive-mind-coordinator';

/**
 * Create hive-mind coordinator with default configuration
 */
export function createHiveMind(db: Database, config?: Partial<HiveMindConfig>): HiveMindCoordinator {
  const defaultConfig: HiveMindConfig = {
    maxWorkers: 8,
    consensusThreshold: 0.67,
    healthCheckInterval: 60000, // 1 minute
    statusReportInterval: 120000, // 2 minutes
    aggregationInterval: 300000, // 5 minutes
    minContributors: 2,
    minConsensusScore: 0.67,
    conflictThreshold: 0.15
  };

  const mergedConfig = { ...defaultConfig, ...config };

  return new HiveMindCoordinator(db, mergedConfig);
}

/**
 * Quick start: Initialize hive-mind with database
 */
export async function initializeHiveMind(dbPath: string, config?: Partial<HiveMindConfig>): Promise<HiveMindCoordinator> {
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(dbPath);

  // Ensure required tables exist
  await ensureDatabase(db);

  const hiveMind = createHiveMind(db, config);

  console.log('🐝 Hive-Mind initialized successfully');

  return hiveMind;
}

/**
 * Ensure database schema exists
 */
async function ensureDatabase(db: Database): Promise<void> {
  const { promisify } = require('util');
  const dbRun = promisify(db.run.bind(db));

  await dbRun(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ttl INTEGER DEFAULT NULL,
      UNIQUE(namespace, key)
    )
  `);

  await dbRun(`
    CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory_entries(namespace)
  `);

  await dbRun(`
    CREATE INDEX IF NOT EXISTS idx_memory_key ON memory_entries(key)
  `);

  console.log('🐝 Database schema verified');
}

export default {
  createHiveMind,
  initializeHiveMind
};
