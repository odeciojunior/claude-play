# GOAP Pattern Storage Format Specification

**Version**: 1.0.0
**Date**: 2025-10-15

---

## Overview

This document specifies the format for storing and retrieving GOAP patterns in the neural learning system. Patterns are stored in the SQLite database and accessed via the `GOAPPatternLibrary` class.

---

## Pattern Types

### 1. Action Sequence Pattern

**Purpose**: Stores successful sequences of actions for achieving goals

**Structure**:
```typescript
{
  id: "goap-pattern-1729000000-abc123",
  type: "action_sequence",
  context: {
    goal_state: {
      neural_system: "active",
      verification_learning: true
    },
    current_state: {
      neural_system: "not_implemented",
      verification_system: "active"
    },
    constraints: {
      max_cost: 100,
      max_time: 168  // hours
    }
  },
  action_sequence: {
    actions: ["A1", "A3"],
    total_cost: 104,
    success_rate: 0.95,
    conditions: "neural_system: not_implemented, verification_system: active, GOAL: neural_system: active, verification_learning: true"
  },
  learning_metrics: {
    times_used: 12,
    success_count: 11,
    average_cost: 98.5,
    cost_variance: 45.3,
    confidence: 0.89
  },
  created_at: "2025-10-15T10:30:00.000Z",
  last_used: "2025-10-15T14:22:15.000Z",
  generalization_level: "moderate",
  pattern_data: "{...}"  // Full serialization
}
```

**Use Cases**:
- Reuse entire action sequences for identical goals
- Quick planning for frequently-encountered scenarios
- Template-based planning

### 2. Goal Achievement Pattern

**Purpose**: Stores strategies for achieving specific types of goals

**Structure**:
```typescript
{
  id: "goap-pattern-1729000001-def456",
  type: "goal_achievement",
  context: {
    goal_state: {
      goal_type: "integration",
      components: ["neural", "verification"]
    },
    current_state: {
      foundation_complete: true
    }
  },
  strategy: {
    approach: "bridge_pattern",
    steps: [
      "identify_interfaces",
      "create_adapters",
      "implement_feedback_loop"
    ],
    estimated_cost: 24
  },
  learning_metrics: {
    times_used: 8,
    success_count: 7,
    average_cost: 26.5,
    cost_variance: 12.8,
    confidence: 0.82
  },
  // ...
}
```

**Use Cases**:
- High-level planning strategies
- Goal decomposition templates
- Architecture patterns

### 3. Heuristic Pattern

**Purpose**: Stores learned heuristic values for state-goal pairs

**Structure**:
```typescript
{
  id: "goap-pattern-1729000002-ghi789",
  type: "heuristic",
  context: {
    state_hash: "sha256_of_state",
    goal_hash: "sha256_of_goal"
  },
  heuristic_data: {
    estimated_cost: 45.2,
    actual_cost: 42.8,
    cost_error: -2.4,
    confidence: 0.91
  },
  learning_metrics: {
    times_encountered: 15,
    average_error: 3.5,
    error_variance: 8.2
  },
  // ...
}
```

**Use Cases**:
- Enhance A* heuristic function
- Cost estimation
- Planning time optimization

### 4. Cost Estimate Pattern

**Purpose**: Stores learned cost estimates for specific actions in context

**Structure**:
```typescript
{
  id: "goap-pattern-1729000003-jkl012",
  type: "cost_estimate",
  context: {
    action_id: "A4",
    preconditions: {
      neural_system: "active",
      goap_planner: "initialized"
    }
  },
  cost_data: {
    estimated_hours: 24,
    actual_hours: 28.5,
    success_rate: 0.88
  },
  learning_metrics: {
    times_executed: 20,
    average_actual_cost: 27.2,
    cost_variance: 15.6,
    confidence: 0.85
  },
  // ...
}
```

**Use Cases**:
- Accurate cost estimation
- Risk assessment
- Resource planning

---

## Storage Schema

### Database Table

```sql
CREATE TABLE goap_patterns (
  -- Identification
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,

  -- Context (for matching)
  context_data TEXT NOT NULL,  -- JSON

  -- Pattern-specific data
  action_sequence TEXT,  -- JSON (for action_sequence type)

  -- Learning metrics
  confidence REAL NOT NULL DEFAULT 0.5,
  times_used INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  average_cost REAL NOT NULL DEFAULT 0,
  cost_variance REAL NOT NULL DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL,
  last_used TEXT,
  generalization_level TEXT NOT NULL,  -- 'specific', 'moderate', 'general'

  -- Full serialization (compressed)
  pattern_data TEXT NOT NULL
);
```

### Indexes

```sql
-- Fast lookup by type
CREATE INDEX idx_goap_patterns_type ON goap_patterns(type);

-- High-confidence patterns
CREATE INDEX idx_goap_patterns_confidence ON goap_patterns(confidence DESC);

-- Most-used patterns
CREATE INDEX idx_goap_patterns_usage ON goap_patterns(times_used DESC);

-- Recent patterns
CREATE INDEX idx_goap_patterns_created ON goap_patterns(created_at DESC);
```

---

## Pattern Matching

### Similarity Calculation

**State Similarity**:
```typescript
function stateSimilarity(state1: WorldState, state2: WorldState): number {
  const allKeys = new Set([...Object.keys(state1), ...Object.keys(state2)]);
  let matches = 0;

  for (const key of allKeys) {
    if (state1[key] === state2[key]) {
      matches++;
    }
  }

  return matches / allKeys.size;
}
```

**Context Similarity**:
```typescript
function contextSimilarity(
  context1: PatternContext,
  context2: PatternContext
): number {
  const goalSim = stateSimilarity(context1.goal_state, context2.goal_state);
  const stateSim = stateSimilarity(context1.current_state, context2.current_state);

  // Goal similarity is more important
  return 0.7 * goalSim + 0.3 * stateSim;
}
```

### Matching Thresholds

| Threshold | Interpretation | Use Case |
|-----------|----------------|----------|
| 1.0 | Exact match | Direct reuse |
| 0.9-0.99 | Very similar | Minor adaptation |
| 0.8-0.89 | Similar | Moderate adaptation |
| 0.7-0.79 | Somewhat similar | Significant adaptation |
| < 0.7 | Different | Not applicable |

### Applicability Check

```typescript
function isApplicable(
  pattern: GOAPPattern,
  currentState: WorldState
): boolean {
  // Check if pattern's starting conditions are met
  for (const [key, value] of Object.entries(pattern.context.current_state)) {
    if (currentState[key] !== value && value !== undefined) {
      return false;
    }
  }

  return true;
}
```

---

## Pattern Lifecycle

### 1. Creation

```typescript
// After successful A* planning
const pattern: GOAPPattern = {
  id: generatePatternId(),
  type: 'action_sequence',
  context: {
    goal_state: goalState,
    current_state: currentState
  },
  action_sequence: {
    actions: plan.actions.map(a => a.id),
    total_cost: plan.total_cost,
    success_rate: 1.0,  // Initial assumption
    conditions: extractConditions(currentState, goalState)
  },
  learning_metrics: {
    times_used: 0,
    success_count: 0,
    average_cost: plan.total_cost,
    cost_variance: 0,
    confidence: 0.5  // Initial conservative confidence
  },
  created_at: new Date().toISOString(),
  generalization_level: 'specific',
  pattern_data: JSON.stringify({ plan, context })
};

await patternLibrary.storePattern(pattern);
```

### 2. Usage

```typescript
// Find matching patterns
const matches = await patternLibrary.findMatchingPatterns(
  currentState,
  goalState,
  0.7  // Threshold
);

if (matches.length > 0) {
  const best = matches[0];

  // Reconstruct plan from pattern
  const plan = await reconstructPlanFromPattern(best.pattern, ...);

  if (plan) {
    // Increment usage count
    pattern.learning_metrics.times_used++;
    pattern.last_used = new Date().toISOString();

    await patternLibrary.updatePattern(pattern);

    return plan;
  }
}
```

### 3. Learning

```typescript
// After execution
const outcome: ExecutionOutcome = {
  plan_id: plan.id,
  success: true,
  actual_cost: 95,
  estimated_cost: 100,
  cost_variance: -0.05,
  achieved_goal: true,
  execution_time: 3600000
};

// Update pattern metrics
if (outcome.success) {
  pattern.learning_metrics.success_count++;
}

// Bayesian update of average cost
const alpha = 1 / pattern.learning_metrics.times_used;
pattern.learning_metrics.average_cost =
  alpha * outcome.actual_cost +
  (1 - alpha) * pattern.learning_metrics.average_cost;

// Update cost variance
const costDiff = outcome.actual_cost - pattern.learning_metrics.average_cost;
pattern.learning_metrics.cost_variance =
  alpha * (costDiff * costDiff) +
  (1 - alpha) * pattern.learning_metrics.cost_variance;

// Update confidence
const successRate =
  pattern.learning_metrics.success_count /
  pattern.learning_metrics.times_used;

const costReliability = Math.max(
  0,
  1 - Math.sqrt(pattern.learning_metrics.cost_variance) /
      pattern.learning_metrics.average_cost
);

pattern.learning_metrics.confidence =
  0.7 * successRate + 0.3 * costReliability;

await patternLibrary.updatePattern(pattern);
```

### 4. Pruning

```typescript
// Identify low-value patterns
const lowValuePatterns = await db.all(`
  SELECT id, confidence, times_used,
         julianday('now') - julianday(created_at) AS age_days
  FROM goap_patterns
  WHERE confidence < 0.3
    AND times_used < 5
    AND julianday('now') - julianday(created_at) > 30
`);

// Delete patterns
for (const pattern of lowValuePatterns) {
  await patternLibrary.delete(pattern.id);
  console.log(`Pruned pattern ${pattern.id} (confidence=${pattern.confidence}, usage=${pattern.times_used})`);
}
```

---

## Pattern Generalization

### Levels

1. **Specific**: Exact state match required
2. **Moderate**: Similar states accepted (similarity > 0.8)
3. **General**: Broad applicability (similarity > 0.6)

### Generalization Process

```typescript
async function generalizePattern(specificPattern: GOAPPattern): Promise<GOAPPattern> {
  // Identify variable components
  const variables = identifyVariables(specificPattern.context);

  // Create generalized pattern
  const generalPattern: GOAPPattern = {
    id: generatePatternId(),
    type: specificPattern.type,
    context: {
      goal_state: generalizeState(specificPattern.context.goal_state, variables),
      current_state: generalizeState(specificPattern.context.current_state, variables)
    },
    action_sequence: specificPattern.action_sequence,
    learning_metrics: {
      ...specificPattern.learning_metrics,
      confidence: specificPattern.learning_metrics.confidence * 0.8  // Lower confidence for generalized
    },
    created_at: new Date().toISOString(),
    generalization_level: 'moderate',
    pattern_data: JSON.stringify({
      based_on: specificPattern.id,
      variables
    })
  };

  // Store generalization relationship
  await db.run(`
    INSERT INTO goap_pattern_generalizations
    (specific_pattern_id, general_pattern_id, generalization_score, created_at)
    VALUES (?, ?, ?, ?)
  `, [
    specificPattern.id,
    generalPattern.id,
    0.8,
    new Date().toISOString()
  ]);

  return generalPattern;
}
```

---

## Compression

### Storage Optimization

**Compression Algorithm**: zlib (gzip)

```typescript
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

async function compressPattern(pattern: GOAPPattern): Promise<string> {
  const json = JSON.stringify(pattern);
  const compressed = await gzip(json);
  return compressed.toString('base64');
}

async function decompressPattern(compressed: string): Promise<GOAPPattern> {
  const buffer = Buffer.from(compressed, 'base64');
  const decompressed = await gunzip(buffer);
  return JSON.parse(decompressed.toString());
}
```

**Compression Ratios**:
- Small patterns (< 1KB): 30-40% compression
- Medium patterns (1-10KB): 50-60% compression
- Large patterns (> 10KB): 60-75% compression

---

## Best Practices

### Pattern Design

1. **Keep patterns focused**: One pattern = one goal or strategy
2. **Use appropriate types**: Choose correct pattern type for use case
3. **Include sufficient context**: Enable accurate matching
4. **Document assumptions**: Store preconditions and constraints
5. **Version patterns**: Track changes over time

### Pattern Management

1. **Regular pruning**: Remove low-confidence, low-usage patterns
2. **Monitor metrics**: Track confidence, usage, success rate
3. **Consolidate duplicates**: Merge similar patterns
4. **Generalize when appropriate**: Create reusable patterns
5. **Backup regularly**: Export patterns for disaster recovery

### Performance Optimization

1. **Index strategically**: Add indexes for common queries
2. **Cache hot patterns**: Keep frequently-used patterns in memory
3. **Lazy load data**: Load full pattern data only when needed
4. **Batch operations**: Update multiple patterns in transactions
5. **Parallelize matching**: Search patterns concurrently

---

## Examples

### Example 1: Store and Retrieve Pattern

```typescript
// Store
const pattern: GOAPPattern = {
  id: "goap-pattern-oauth2-impl",
  type: "action_sequence",
  context: {
    goal_state: { oauth2_enabled: true },
    current_state: { auth_system: "none" }
  },
  action_sequence: {
    actions: ["setup_oauth_provider", "implement_flow", "test_integration"],
    total_cost: 48,
    success_rate: 0.92
  },
  learning_metrics: {
    times_used: 5,
    success_count: 4,
    average_cost: 46.5,
    cost_variance: 8.2,
    confidence: 0.85
  },
  created_at: new Date().toISOString(),
  generalization_level: "moderate",
  pattern_data: JSON.stringify({ /* full data */ })
};

await patternLibrary.storePattern(pattern);

// Retrieve
const retrieved = await patternLibrary.getPattern("goap-pattern-oauth2-impl");
console.log(`Pattern confidence: ${retrieved.learning_metrics.confidence}`);
```

### Example 2: Pattern Matching

```typescript
const currentState = { auth_system: "none", users_exist: true };
const goalState = { oauth2_enabled: true };

const matches = await patternLibrary.findMatchingPatterns(
  currentState,
  goalState,
  0.7
);

for (const match of matches) {
  console.log(`Pattern: ${match.pattern.id}`);
  console.log(`  Similarity: ${match.similarity.toFixed(2)}`);
  console.log(`  Confidence: ${match.confidence.toFixed(2)}`);
  console.log(`  Applicable: ${match.applicable}`);
  console.log(`  Adaptation needed: ${match.adaptation_required}`);
}
```

### Example 3: Export/Import Patterns

```typescript
// Export patterns to JSON
async function exportPatterns(): Promise<string> {
  const patterns = await patternLibrary.getPatterns({});

  return JSON.stringify({
    version: "1.0.0",
    exported_at: new Date().toISOString(),
    patterns
  }, null, 2);
}

// Import patterns from JSON
async function importPatterns(json: string): Promise<void> {
  const data = JSON.parse(json);

  for (const pattern of data.patterns) {
    await patternLibrary.storePattern(pattern);
  }

  console.log(`Imported ${data.patterns.length} patterns`);
}

// Usage
const exported = await exportPatterns();
fs.writeFileSync('goap-patterns-backup.json', exported);

const imported = fs.readFileSync('goap-patterns-backup.json', 'utf8');
await importPatterns(imported);
```

---

## Troubleshooting

### Pattern Not Matching

**Symptom**: Patterns exist but are not being reused

**Diagnosis**:
```typescript
// Check pattern similarity manually
const pattern = await patternLibrary.getPattern(patternId);
const similarity = contextSimilarity(
  { currentState, goalState },
  pattern.context
);

console.log(`Similarity: ${similarity.toFixed(2)} (threshold: ${threshold})`);
```

**Solutions**:
1. Lower match threshold
2. Generalize pattern
3. Update pattern context

### Low Confidence Scores

**Symptom**: Patterns have low confidence despite successful executions

**Diagnosis**:
```typescript
const stats = await patternLibrary.getStats();
console.log(`Avg confidence: ${stats.average_confidence.toFixed(2)}`);

// Check specific pattern
const pattern = await patternLibrary.getPattern(patternId);
console.log(`Success rate: ${pattern.learning_metrics.success_count / pattern.learning_metrics.times_used}`);
console.log(`Cost variance: ${pattern.learning_metrics.cost_variance.toFixed(2)}`);
```

**Solutions**:
1. Reduce cost variance (more consistent execution)
2. Increase success count (more executions)
3. Adjust confidence calculation weights

---

## References

- [GOAP Types](/src/goap/types.ts)
- [Neural Integration](/docs/goap/neural-integration.md)
- [Database Schema](/src/goap/schema.sql)

---

**Version**: 1.0.0
**Last Updated**: 2025-10-15
**Status**: ✅ Complete

