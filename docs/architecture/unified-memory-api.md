# Unified Memory API Documentation
## Access Layer for Unified Memory System

**Version**: 1.0.0
**Date**: 2025-10-15
**Action**: A2 - Unify Memory Systems
**Parent**: memory-unification-architecture.md

---

## 1. API Overview

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  (78 Agents, Neural Learning, Swarm Coordination)       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Unified Memory Manager API                  │
├─────────────────────────────────────────────────────────┤
│  • High-level abstractions                              │
│  • Type-safe interfaces                                  │
│  • Transaction management                                │
│  • Cache coordination                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Memory Access Layer                         │
├─────────────────────────────────────────────────────────┤
│  • Connection pooling                                    │
│  • Query optimization                                    │
│  • Statement caching                                     │
│  • Lock management                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              .swarm/memory.db (SQLite)                   │
│  17 tables, WAL mode, 64MB cache, memory-mapped I/O     │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Single Source of Truth**: One interface for all memory operations
2. **Type Safety**: Full TypeScript type definitions
3. **Performance**: Multi-level caching, query optimization
4. **Reliability**: Transaction support, error handling
5. **Extensibility**: Easy to add new operations
6. **Observability**: Built-in metrics and logging

---

## 2. Core Classes

### 2.1 UnifiedMemoryManager

Main entry point for all memory operations.

```typescript
/**
 * Unified Memory Manager
 * Central coordinator for all memory system operations
 */
class UnifiedMemoryManager {
  private db: Database;
  private connectionPool: ConnectionPool;
  private cache: MultiLevelCache;
  private metrics: MetricsCollector;

  constructor(config: MemoryConfig) {
    this.db = this.initializeDatabase(config);
    this.connectionPool = new ConnectionPool(config.pool);
    this.cache = new MultiLevelCache(config.cache);
    this.metrics = new MetricsCollector();
  }

  // ============================================
  // Neural Learning Operations
  // ============================================

  /**
   * Store a learned pattern
   */
  async storePattern(pattern: Pattern): Promise<void>;

  /**
   * Retrieve patterns matching filter
   */
  async getPatterns(filter: PatternFilter): Promise<Pattern[]>;

  /**
   * Store pattern embedding for vector search
   */
  async storeEmbedding(embedding: PatternEmbedding): Promise<void>;

  /**
   * Semantic search using embeddings
   */
  async semanticSearch(query: string, k?: number): Promise<Pattern[]>;

  /**
   * Store task execution trajectory
   */
  async storeTrajectory(trajectory: TaskTrajectory): Promise<void>;

  /**
   * Query similar trajectories for MATTS
   */
  async findSimilarTrajectories(query: string, k?: number): Promise<TaskTrajectory[]>;

  /**
   * Store memory entry (working memory)
   */
  async setMemory(key: string, value: any, options?: MemoryOptions): Promise<void>;

  /**
   * Retrieve memory entry
   */
  async getMemory(key: string, namespace?: string): Promise<any | null>;

  // ============================================
  // Swarm Coordination Operations
  // ============================================

  /**
   * Register a new agent
   */
  async registerAgent(agent: Agent): Promise<string>;

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void>;

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<Agent | null>;

  /**
   * List all agents (optionally filtered)
   */
  async listAgents(filter?: AgentFilter): Promise<Agent[]>;

  /**
   * Create a new swarm
   */
  async createSwarm(swarm: SwarmConfig): Promise<string>;

  /**
   * Assign task to agent
   */
  async assignTask(task: Task, agentId: string): Promise<string>;

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;

  /**
   * Record inter-agent message
   */
  async recordMessage(message: Message): Promise<string>;

  /**
   * Record consensus vote
   */
  async recordConsensusVote(vote: ConsensusVote): Promise<string>;

  // ============================================
  // Knowledge Operations
  // ============================================

  /**
   * Store knowledge entry
   */
  async storeKnowledge(knowledge: Knowledge): Promise<string>;

  /**
   * Query knowledge base
   */
  async queryKnowledge(query: string, category?: string): Promise<Knowledge[]>;

  /**
   * Link knowledge to pattern
   */
  async linkKnowledgeToPattern(knowledgeId: string, patternId: string): Promise<void>;

  // ============================================
  // Unified Cross-System Operations
  // ============================================

  /**
   * Get complete memory view for an agent
   * Includes patterns, tasks, knowledge, performance
   */
  async getAgentMemoryView(agentId: string): Promise<AgentMemoryView>;

  /**
   * Get swarm intelligence summary
   * Includes agents, patterns, knowledge, consensus
   */
  async getSwarmIntelligence(swarmId: string): Promise<SwarmIntelligence>;

  /**
   * Record performance metric
   */
  async recordMetric(metric: PerformanceMetric): Promise<void>;

  /**
   * Get performance metrics
   */
  async getMetrics(filter: MetricFilter): Promise<PerformanceMetric[]>;

  // ============================================
  // Transaction Support
  // ============================================

  /**
   * Execute operations in transaction
   */
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;

  // ============================================
  // Maintenance Operations
  // ============================================

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<CleanupResult>;

  /**
   * Optimize database
   */
  async optimize(): Promise<void>;

  /**
   * Get health status
   */
  async getHealth(): Promise<HealthStatus>;

  /**
   * Close all connections
   */
  async close(): Promise<void>;
}
```

---

## 3. Type Definitions

### 3.1 Neural Learning Types

```typescript
/**
 * Pattern representation
 */
interface Pattern {
  id: string;
  type: PatternType;
  pattern_data: string;  // JSON
  confidence: number;    // 0.0 - 1.0
  usage_count: number;
  created_at: string;
  last_used?: string;
  metadata?: Record<string, any>;
}

type PatternType =
  | 'coordination'
  | 'optimization'
  | 'error-handling'
  | 'domain-specific'
  | 'refactoring'
  | 'testing'
  | 'documentation';

interface PatternFilter {
  type?: PatternType;
  minConfidence?: number;
  maxResults?: number;
  sortBy?: 'confidence' | 'usage_count' | 'created_at';
  order?: 'asc' | 'desc';
}

/**
 * Pattern embedding for vector search
 */
interface PatternEmbedding {
  id: string;           // References pattern.id
  model: string;        // e.g., 'text-embedding-3-small'
  dims: number;         // Vector dimensions
  vector: Float32Array | Int8Array;
  compressed?: boolean;
  min_val?: number;
  max_val?: number;
}

/**
 * Task execution trajectory
 */
interface TaskTrajectory {
  task_id: string;
  agent_id: string;
  query: string;
  trajectory_json: string;  // Compressed JSON
  started_at: string;
  ended_at: string;
  duration_ms?: number;
  judge_label?: 'success' | 'failure' | 'partial';
  judge_conf?: number;
  judge_reasons?: string[];
  token_count?: number;
  tool_calls_count?: number;
  error_count?: number;
}

/**
 * Memory entry (working memory)
 */
interface MemoryEntry {
  key: string;
  value: string;
  namespace: string;
  metadata?: Record<string, any>;
  ttl?: number;          // seconds
  expires_at?: number;   // unix timestamp
}

interface MemoryOptions {
  namespace?: string;
  ttl?: number;
  metadata?: Record<string, any>;
}
```

### 3.2 Swarm Coordination Types

```typescript
/**
 * Agent representation
 */
interface Agent {
  id: string;
  swarm_id?: string;
  name: string;
  type: string;          // 78 agent types
  role?: 'coordinator' | 'worker' | 'specialist';
  capabilities: string[];
  status: AgentStatus;
  performance_score: number;  // 0.0 - 1.0
  task_count: number;
  success_rate: number;       // 0.0 - 1.0
  last_active: string;
  created_at: string;
  metadata?: Record<string, any>;
  learning_enabled: boolean;
  pattern_count: number;
  confidence_avg: number;
}

type AgentStatus = 'active' | 'idle' | 'busy' | 'paused' | 'offline';

interface AgentFilter {
  swarm_id?: string;
  type?: string;
  status?: AgentStatus;
  minPerformance?: number;
  learning_enabled?: boolean;
}

/**
 * Swarm configuration
 */
interface SwarmConfig {
  name: string;
  objective?: string;
  status?: 'active' | 'paused' | 'completed' | 'destroyed';
  queen_type?: 'strategic' | 'tactical' | 'adaptive';
  topology?: 'hierarchical' | 'mesh' | 'ring' | 'star';
  max_agents?: number;
  metadata?: Record<string, any>;
  learning_enabled?: boolean;
  pattern_sharing?: boolean;
}

/**
 * Task representation
 */
interface Task {
  id: string;
  swarm_id?: string;
  agent_id?: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  complexity: number;    // 0.0 - 1.0
  estimated_time?: number;  // seconds
  actual_time?: number;     // seconds
  created_at: string;
  started_at?: string;
  completed_at?: string;
  metadata?: Record<string, any>;
  trajectory_id?: string;
  pattern_ids?: string[];
}

type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Inter-agent message
 */
interface Message {
  id: string;
  swarm_id?: string;
  sender_id?: string;
  recipient_id?: string;
  channel: string;
  type: MessageType;
  content: string;
  priority: 1 | 2 | 3 | 4 | 5;
  consensus_vote?: number;
  timestamp: string;
  processed: boolean;
  metadata?: Record<string, any>;
}

type MessageType = 'info' | 'command' | 'query' | 'response' | 'alert';

/**
 * Consensus vote
 */
interface ConsensusVote {
  id: string;
  swarm_id: string;
  proposal_id: string;
  agent_id: string;
  vote: number;      // 0.0 - 1.0
  weight: number;    // 0.0 - 1.0
  justification?: string;
  timestamp: string;
}
```

### 3.3 Knowledge Types

```typescript
/**
 * Knowledge base entry
 */
interface Knowledge {
  id: string;
  swarm_id?: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  confidence: number;  // 0.0 - 1.0
  source_agent_id?: string;
  created_at: string;
  updated_at: string;
  access_count: number;
  pattern_id?: string;
  embedding_id?: string;
}

/**
 * Performance metric
 */
interface PerformanceMetric {
  id: string;
  entity_type: 'agent' | 'swarm' | 'task' | 'pattern' | 'system';
  entity_id: string;
  metric_name: string;
  metric_value: number;
  unit?: string;
  tags?: Record<string, any>;
  timestamp: string;
}

interface MetricFilter {
  entity_type?: string;
  entity_id?: string;
  metric_name?: string;
  startTime?: string;
  endTime?: string;
}
```

### 3.4 Unified View Types

```typescript
/**
 * Complete memory view for an agent
 */
interface AgentMemoryView {
  agent: Agent;
  patterns: Pattern[];
  tasks: Task[];
  knowledge: Knowledge[];
  metrics: PerformanceMetric[];
  recent_trajectories: TaskTrajectory[];
  learning_stats: {
    total_patterns: number;
    avg_confidence: number;
    successful_tasks: number;
    failed_tasks: number;
  };
}

/**
 * Swarm intelligence summary
 */
interface SwarmIntelligence {
  swarm: SwarmConfig;
  agents: Agent[];
  active_tasks: Task[];
  shared_patterns: Pattern[];
  shared_knowledge: Knowledge[];
  consensus_votes: ConsensusVote[];
  coordination_stats: {
    total_agents: number;
    active_agents: number;
    avg_performance: number;
    total_patterns: number;
    coordination_efficiency: number;
  };
}
```

---

## 4. Usage Examples

### 4.1 Neural Learning Examples

```typescript
// Initialize memory manager
const memoryManager = new UnifiedMemoryManager({
  dbPath: '.swarm/memory.db',
  pool: {
    maxConnections: 10,
    minConnections: 2
  },
  cache: {
    l1Size: 100,
    l2Size: 1000,
    ttl: 1800000  // 30 minutes
  }
});

// Example 1: Store and retrieve patterns
async function learnFromExecution() {
  // Store a learned pattern
  await memoryManager.storePattern({
    id: generateId(),
    type: 'coordination',
    pattern_data: JSON.stringify({
      name: 'parallel_file_read',
      actions: ['Read', 'Read', 'Read'],
      conditions: { file_count: { min: 2, max: 10 } }
    }),
    confidence: 0.75,
    usage_count: 0,
    created_at: new Date().toISOString(),
    metadata: {
      source: 'auto-learned',
      agent_id: 'coder-001'
    }
  });

  // Retrieve patterns for use
  const patterns = await memoryManager.getPatterns({
    type: 'coordination',
    minConfidence: 0.7,
    maxResults: 10,
    sortBy: 'confidence',
    order: 'desc'
  });

  console.log(`Found ${patterns.length} coordination patterns`);
}

// Example 2: Vector search for similar patterns
async function findSimilarPatterns() {
  const query = "How to read multiple files efficiently?";

  const similarPatterns = await memoryManager.semanticSearch(query, 5);

  for (const pattern of similarPatterns) {
    console.log(`Pattern: ${pattern.type}, Confidence: ${pattern.confidence}`);
  }
}

// Example 3: Store task trajectory for learning
async function recordTaskExecution() {
  const trajectory: TaskTrajectory = {
    task_id: 'task-001',
    agent_id: 'coder-001',
    query: 'Implement authentication',
    trajectory_json: JSON.stringify({
      steps: [
        { tool: 'Read', file: 'auth.ts' },
        { tool: 'Edit', file: 'auth.ts' },
        { tool: 'Bash', command: 'npm test' }
      ],
      outcome: { status: 'success', confidence: 0.95 }
    }),
    started_at: new Date('2025-10-15T10:00:00Z').toISOString(),
    ended_at: new Date('2025-10-15T10:15:00Z').toISOString(),
    duration_ms: 900000,
    judge_label: 'success',
    judge_conf: 0.95,
    token_count: 5000,
    tool_calls_count: 15,
    error_count: 0
  };

  await memoryManager.storeTrajectory(trajectory);
}

// Example 4: Working memory (temporary context)
async function useWorkingMemory() {
  // Store temporary context
  await memoryManager.setMemory('current_task', {
    id: 'task-001',
    status: 'in_progress',
    started_at: Date.now()
  }, {
    namespace: 'context',
    ttl: 3600  // 1 hour
  });

  // Retrieve context
  const context = await memoryManager.getMemory('current_task', 'context');
  console.log('Current task:', context);
}
```

### 4.2 Swarm Coordination Examples

```typescript
// Example 1: Register agents
async function registerAgents() {
  const agentTypes = [
    'goal-planner',
    'safla-neural',
    'coder',
    'reviewer',
    'tester'
  ];

  for (const type of agentTypes) {
    const agentId = await memoryManager.registerAgent({
      id: generateId(),
      name: type,
      type: type,
      capabilities: getCapabilitiesForType(type),
      status: 'active',
      performance_score: 0.5,
      task_count: 0,
      success_rate: 1.0,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
      learning_enabled: true,
      pattern_count: 0,
      confidence_avg: 0.5
    });

    console.log(`Registered agent: ${type} (${agentId})`);
  }
}

// Example 2: Create swarm and assign tasks
async function coordinateSwarm() {
  // Create swarm
  const swarmId = await memoryManager.createSwarm({
    name: 'auth-implementation-swarm',
    objective: 'Implement OAuth2 authentication',
    topology: 'hierarchical',
    max_agents: 5,
    learning_enabled: true,
    pattern_sharing: true
  });

  // Get available agents
  const agents = await memoryManager.listAgents({
    status: 'active',
    learning_enabled: true
  });

  // Assign tasks
  for (const agent of agents.slice(0, 3)) {
    const taskId = await memoryManager.assignTask({
      id: generateId(),
      swarm_id: swarmId,
      name: `${agent.type} task`,
      description: 'Implement auth component',
      status: 'assigned',
      priority: 3,
      complexity: 0.6,
      estimated_time: 3600,
      created_at: new Date().toISOString()
    }, agent.id);

    console.log(`Assigned task ${taskId} to ${agent.name}`);
  }
}

// Example 3: Record consensus vote
async function recordConsensus() {
  const vote: ConsensusVote = {
    id: generateId(),
    swarm_id: 'swarm-001',
    proposal_id: 'proposal-auth-design',
    agent_id: 'agent-001',
    vote: 0.85,
    weight: 1.0,
    justification: 'OAuth2 is industry standard',
    timestamp: new Date().toISOString()
  };

  await memoryManager.recordConsensusVote(vote);
}
```

### 4.3 Knowledge Sharing Examples

```typescript
// Example 1: Store and query knowledge
async function shareKnowledge() {
  // Store knowledge
  const knowledgeId = await memoryManager.storeKnowledge({
    id: generateId(),
    category: 'authentication',
    title: 'OAuth2 Best Practices',
    content: 'Use PKCE for mobile apps, always validate redirect URIs...',
    tags: ['oauth2', 'security', 'best-practices'],
    confidence: 0.9,
    source_agent_id: 'reviewer-001',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    access_count: 0
  });

  // Query knowledge
  const knowledge = await memoryManager.queryKnowledge(
    'OAuth2 security',
    'authentication'
  );

  console.log(`Found ${knowledge.length} knowledge entries`);
}

// Example 2: Link knowledge to pattern
async function linkKnowledgeToPattern() {
  const knowledgeId = 'knowledge-001';
  const patternId = 'pattern-oauth-impl';

  await memoryManager.linkKnowledgeToPattern(knowledgeId, patternId);

  console.log('Knowledge linked to pattern');
}
```

### 4.4 Unified View Examples

```typescript
// Example 1: Get complete agent memory view
async function getAgentIntelligence() {
  const agentId = 'coder-001';

  const memoryView = await memoryManager.getAgentMemoryView(agentId);

  console.log('Agent Memory View:');
  console.log(`- Agent: ${memoryView.agent.name}`);
  console.log(`- Patterns: ${memoryView.patterns.length}`);
  console.log(`- Tasks: ${memoryView.tasks.length}`);
  console.log(`- Knowledge: ${memoryView.knowledge.length}`);
  console.log(`- Avg Confidence: ${memoryView.learning_stats.avg_confidence}`);
}

// Example 2: Get swarm intelligence summary
async function getSwarmIntelligence() {
  const swarmId = 'swarm-001';

  const intelligence = await memoryManager.getSwarmIntelligence(swarmId);

  console.log('Swarm Intelligence:');
  console.log(`- Total Agents: ${intelligence.coordination_stats.total_agents}`);
  console.log(`- Active Agents: ${intelligence.coordination_stats.active_agents}`);
  console.log(`- Shared Patterns: ${intelligence.shared_patterns.length}`);
  console.log(`- Coordination Efficiency: ${intelligence.coordination_stats.coordination_efficiency}`);
}

// Example 3: Record performance metrics
async function trackPerformance() {
  await memoryManager.recordMetric({
    id: generateId(),
    entity_type: 'agent',
    entity_id: 'coder-001',
    metric_name: 'task_completion_time',
    metric_value: 1250,
    unit: 'ms',
    tags: { task_type: 'implementation', complexity: 'medium' },
    timestamp: new Date().toISOString()
  });
}
```

### 4.5 Transaction Examples

```typescript
// Example: Atomic operations with transaction
async function atomicTaskAssignment() {
  await memoryManager.transaction(async (tx) => {
    // 1. Create task
    const taskId = await tx.assignTask({
      id: generateId(),
      name: 'Implement feature',
      status: 'assigned',
      priority: 3,
      complexity: 0.7,
      created_at: new Date().toISOString()
    }, 'agent-001');

    // 2. Update agent status
    await tx.updateAgentStatus('agent-001', 'busy');

    // 3. Record metric
    await tx.recordMetric({
      id: generateId(),
      entity_type: 'agent',
      entity_id: 'agent-001',
      metric_name: 'tasks_assigned',
      metric_value: 1,
      unit: 'count',
      timestamp: new Date().toISOString()
    });

    // All succeed or all fail
  });
}
```

---

## 5. Performance Guidelines

### 5.1 Query Optimization

```typescript
// ✅ GOOD: Use filters to limit results
const patterns = await memoryManager.getPatterns({
  type: 'coordination',
  minConfidence: 0.7,
  maxResults: 10
});

// ❌ BAD: Retrieve all patterns and filter in memory
const allPatterns = await memoryManager.getPatterns({});
const filtered = allPatterns
  .filter(p => p.type === 'coordination' && p.confidence >= 0.7)
  .slice(0, 10);

// ✅ GOOD: Use specific queries
const agent = await memoryManager.getAgent(agentId);

// ❌ BAD: List all and find
const allAgents = await memoryManager.listAgents({});
const agent = allAgents.find(a => a.id === agentId);
```

### 5.2 Caching Best Practices

```typescript
// The cache is automatic, but you can optimize access patterns

// ✅ GOOD: Access frequently used data repeatedly
const agentId = 'coder-001';
for (let i = 0; i < 100; i++) {
  const agent = await memoryManager.getAgent(agentId);  // Cached after first call
  // ... use agent
}

// ✅ GOOD: Use namespace for related data
await memoryManager.setMemory('task1', data1, { namespace: 'tasks' });
await memoryManager.setMemory('task2', data2, { namespace: 'tasks' });
await memoryManager.setMemory('task3', data3, { namespace: 'tasks' });
// All tasks cached together

// ⚠️  NOTE: Large objects may not be cached efficiently
// Consider storing references instead of full objects
```

### 5.3 Transaction Guidelines

```typescript
// ✅ GOOD: Group related operations
await memoryManager.transaction(async (tx) => {
  await tx.assignTask(task, agentId);
  await tx.updateAgentStatus(agentId, 'busy');
  await tx.recordMetric(metric);
});

// ❌ BAD: Multiple separate operations
await memoryManager.assignTask(task, agentId);
await memoryManager.updateAgentStatus(agentId, 'busy');
await memoryManager.recordMetric(metric);
// Each operation is a separate transaction - slower and not atomic

// ⚠️  WARNING: Keep transactions short
// Long-running transactions can block other operations
```

---

## 6. Error Handling

### 6.1 Common Errors

```typescript
// Example: Comprehensive error handling
async function robustMemoryAccess() {
  try {
    const pattern = await memoryManager.getPatterns({
      type: 'coordination',
      minConfidence: 0.7
    });

    return pattern;

  } catch (error) {
    if (error.code === 'SQLITE_BUSY') {
      // Database is locked, retry after delay
      await sleep(100);
      return robustMemoryAccess();
    }

    if (error.code === 'SQLITE_CORRUPT') {
      // Database corruption - critical error
      console.error('Database corrupted!', error);
      // Trigger rollback procedure
      throw error;
    }

    if (error.code === 'FOREIGN_KEY_VIOLATION') {
      // Referencing non-existent record
      console.error('Invalid reference:', error);
      throw error;
    }

    // Unknown error
    console.error('Memory access error:', error);
    throw error;
  }
}
```

### 6.2 Error Codes

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `SQLITE_BUSY` | Database locked | Retry with backoff |
| `SQLITE_CORRUPT` | Database corrupted | Rollback to backup |
| `FOREIGN_KEY_VIOLATION` | Invalid FK reference | Check referenced record exists |
| `UNIQUE_CONSTRAINT` | Duplicate key | Use different ID or update existing |
| `NOT_FOUND` | Record not found | Check ID is correct |
| `TRANSACTION_FAILED` | Transaction rolled back | Retry or handle partial failure |

---

## 7. Monitoring & Debugging

### 7.1 Health Monitoring

```typescript
// Check system health
const health = await memoryManager.getHealth();

console.log('Memory System Health:');
console.log(`- Status: ${health.status}`);
console.log(`- Total Size: ${health.totalSize / 1024 / 1024} MB`);
console.log(`- Connection Count: ${health.connectionCount}`);
console.log(`- Query Latency P95: ${health.queryLatencyP95}ms`);
console.log(`- Cache Hit Rate: ${health.cacheHitRate * 100}%`);

if (health.status === 'degraded') {
  console.warn('⚠️  Performance degraded:', health.issues);
}

if (health.status === 'critical') {
  console.error('❌ Critical issues:', health.issues);
  // Trigger alerts
}
```

### 7.2 Performance Metrics

```typescript
// Get performance metrics
const metrics = await memoryManager.getMetrics({
  entity_type: 'system',
  metric_name: 'query_latency',
  startTime: new Date(Date.now() - 3600000).toISOString(),  // Last hour
  endTime: new Date().toISOString()
});

// Calculate statistics
const latencies = metrics.map(m => m.metric_value);
const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const p95 = percentile(latencies, 0.95);

console.log(`Average query latency: ${avg}ms`);
console.log(`P95 query latency: ${p95}ms`);
```

---

## 8. Migration from Old APIs

### 8.1 Migration Guide

```typescript
// OLD API (.swarm/memory.db only)
import { MemoryManager } from './old-memory-manager';
const memory = new MemoryManager('.swarm/memory.db');
await memory.set('key', 'value');
const value = await memory.get('key');

// NEW API (unified)
import { UnifiedMemoryManager } from './unified-memory-manager';
const memory = new UnifiedMemoryManager({ dbPath: '.swarm/memory.db' });
await memory.setMemory('key', 'value');
const value = await memory.getMemory('key');

// OLD API (hive.db)
import { HiveMemory } from './hive-memory';
const hive = new HiveMemory('.hive-mind/hive.db');
await hive.registerAgent(agent);

// NEW API (unified)
import { UnifiedMemoryManager } from './unified-memory-manager';
const memory = new UnifiedMemoryManager({ dbPath: '.swarm/memory.db' });
await memory.registerAgent(agent);
```

### 8.2 Compatibility Layer

For backward compatibility, a compatibility layer is provided:

```typescript
// Compatibility wrapper for old code
class LegacyMemoryManager {
  private unified: UnifiedMemoryManager;

  constructor(dbPath: string) {
    this.unified = new UnifiedMemoryManager({ dbPath });
  }

  // Old interface
  async set(key: string, value: any): Promise<void> {
    return this.unified.setMemory(key, value);
  }

  async get(key: string): Promise<any> {
    return this.unified.getMemory(key);
  }

  // ... other old methods mapped to new API
}

// Usage: Drop-in replacement
// import { MemoryManager } from './old-memory-manager';
import { LegacyMemoryManager as MemoryManager } from './legacy-wrapper';
// Rest of code unchanged
```

---

## 9. Configuration

### 9.1 Configuration Options

```typescript
interface MemoryConfig {
  // Database settings
  dbPath: string;
  readOnly?: boolean;
  verbose?: boolean;

  // Connection pool settings
  pool?: {
    maxConnections: number;    // Default: 10
    minConnections: number;    // Default: 2
    acquireTimeout: number;    // Default: 5000ms
    idleTimeout: number;       // Default: 60000ms
  };

  // Cache settings
  cache?: {
    l1Size: number;            // Default: 100
    l2Size: number;            // Default: 1000
    ttl: number;               // Default: 1800000ms (30min)
  };

  // Performance tuning
  performance?: {
    busyTimeout: number;       // Default: 5000ms
    cacheSize: number;         // Default: 64000 pages (64MB)
    mmapSize: number;          // Default: 268435456 (256MB)
    walAutoCheckpoint: number; // Default: 1000
  };

  // Logging
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    slowQueryThreshold: number;  // Default: 100ms
  };
}
```

### 9.2 Example Configurations

```typescript
// Development configuration
const devConfig: MemoryConfig = {
  dbPath: '.swarm/memory.db',
  verbose: true,
  pool: {
    maxConnections: 5,
    minConnections: 1
  },
  cache: {
    l1Size: 50,
    l2Size: 500,
    ttl: 600000  // 10 minutes
  },
  logging: {
    level: 'debug',
    slowQueryThreshold: 50
  }
};

// Production configuration
const prodConfig: MemoryConfig = {
  dbPath: '.swarm/memory.db',
  verbose: false,
  pool: {
    maxConnections: 20,
    minConnections: 5
  },
  cache: {
    l1Size: 200,
    l2Size: 2000,
    ttl: 3600000  // 1 hour
  },
  performance: {
    busyTimeout: 10000,
    cacheSize: 128000,  // 128MB
    mmapSize: 536870912  // 512MB
  },
  logging: {
    level: 'warn',
    slowQueryThreshold: 100
  }
};
```

---

## 10. Best Practices

### 10.1 General Guidelines

1. **Always close connections**: Call `close()` when done
2. **Use transactions for multi-step operations**: Ensures atomicity
3. **Leverage caching**: Repeated reads are fast
4. **Monitor performance**: Track query latencies and cache hit rates
5. **Handle errors gracefully**: Implement retry logic for transient errors

### 10.2 Agent Integration

```typescript
// ✅ GOOD: Initialize once, reuse everywhere
class AgentMemoryInterface {
  private memory: UnifiedMemoryManager;
  private agentId: string;

  constructor(agentId: string, memory: UnifiedMemoryManager) {
    this.agentId = agentId;
    this.memory = memory;
  }

  async storePattern(pattern: Pattern): Promise<void> {
    return this.memory.storePattern({
      ...pattern,
      metadata: {
        ...pattern.metadata,
        agent_id: this.agentId
      }
    });
  }

  async getMyPatterns(): Promise<Pattern[]> {
    const view = await this.memory.getAgentMemoryView(this.agentId);
    return view.patterns;
  }

  // ... other agent-specific methods
}

// Usage
const memory = new UnifiedMemoryManager(config);
const agentMemory = new AgentMemoryInterface('coder-001', memory);
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-15
**Status**: Ready for Implementation
**Next Steps**: Implement UnifiedMemoryManager class
