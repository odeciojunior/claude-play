# Database Migration Checklist

Use this checklist to verify a successful migration.

## ✅ Pre-Migration Checklist

- [ ] Dependencies installed: `npm install`
- [ ] TypeScript compiled: `npm run build`
- [ ] Backup existing database (if any): `cp .swarm/memory.db .swarm/memory.db.backup`
- [ ] Review migration files in `src/database/schema/`

## 🚀 Migration Execution

- [ ] Run migration: `npm run db:migrate`
- [ ] Check for errors in output
- [ ] Verify "Migration complete!" message appears

## ✅ Post-Migration Verification

### 1. Schema Version Check
- [ ] Run: `npm run db:migrate:verify`
- [ ] Confirm 3 schema versions applied:
  - `1.0.0-core`
  - `1.0.0-goap`
  - `1.0.0-verification`

### 2. Critical Tables Check
- [ ] Core tables exist:
  - `patterns`
  - `pattern_embeddings`
  - `pattern_links`
  - `task_trajectories`
  - `memory_entries`
  - `metrics_log`

- [ ] GOAP tables exist:
  - `goap_patterns` ⭐ (Previously missing)
  - `goap_plans`
  - `goap_execution_outcomes`
  - `goap_statistics`
  - `goap_heuristic_learning`
  - `goap_action_performance`

- [ ] Verification tables exist:
  - `verification_outcomes`
  - `agent_reliability`
  - `truth_score_predictions`
  - `adaptive_thresholds`

### 3. Indexes Check
- [ ] Run: `sqlite3 .swarm/memory.db ".indexes"`
- [ ] Verify indexes created for all major tables

### 4. Views Check
- [ ] Core views:
  - `v_pattern_effectiveness`
  - `v_memory_stats`
  - `v_recent_metrics`

- [ ] GOAP views:
  - `v_goap_pattern_effectiveness`
  - `v_goap_planning_performance`
  - `v_goap_outcome_trends`

- [ ] Verification views:
  - `v_agent_performance`
  - `v_verification_trends`
  - `v_prediction_accuracy`

### 5. Foreign Keys Check
- [ ] Run: `sqlite3 .swarm/memory.db "PRAGMA foreign_key_check;"`
- [ ] Verify no foreign key violations (empty output expected)

### 6. Integrity Check
- [ ] Run: `sqlite3 .swarm/memory.db "PRAGMA integrity_check;"`
- [ ] Verify output: `ok`

### 7. Statistics Check
- [ ] Run: `npm run db:migrate:stats`
- [ ] Verify table counts displayed
- [ ] Verify database size shown

## 🧪 Test Execution

- [ ] Run migration tests: `npm test tests/database/migration.test.ts`
- [ ] All tests pass (30+ tests)
- [ ] No test failures or errors

## 📊 Data Insertion Test

- [ ] Test pattern insertion:
```sql
sqlite3 .swarm/memory.db "
  INSERT INTO patterns (id, type, pattern_data, confidence)
  VALUES ('test-pat-1', 'test', '{\"test\": true}', 0.85);
  SELECT * FROM patterns WHERE id = 'test-pat-1';
"
```

- [ ] Test GOAP pattern insertion:
```sql
sqlite3 .swarm/memory.db "
  INSERT INTO goap_patterns (
    id, type, goal, initial_state, final_state,
    action_sequence, cost, context_data, pattern_data
  ) VALUES (
    'test-goap-1', 'test', 'test_goal', '{}', '{}',
    '[]', 10.0, '{}', '{}'
  );
  SELECT * FROM goap_patterns WHERE id = 'test-goap-1';
"
```

- [ ] Test verification outcome insertion:
```sql
sqlite3 .swarm/memory.db "
  INSERT INTO verification_outcomes (
    id, task_id, agent_id, agent_type, timestamp,
    passed, truth_score, threshold, duration
  ) VALUES (
    'test-vo-1', 'task-1', 'agent-1', 'coder',
    datetime('now'), 1, 0.97, 0.95, 1000
  );
  SELECT * FROM verification_outcomes WHERE id = 'test-vo-1';
"
```

- [ ] Verify trigger updated `agent_reliability`:
```sql
sqlite3 .swarm/memory.db "
  SELECT * FROM agent_reliability WHERE agent_id = 'agent-1';
"
```

## 🔍 Query Performance Test

- [ ] Test indexed query performance:
```sql
sqlite3 .swarm/memory.db "
  EXPLAIN QUERY PLAN
  SELECT * FROM patterns WHERE type = 'coordination' AND confidence > 0.8;
"
```
- [ ] Verify "USING INDEX" appears in output

## 🧹 Cleanup Test Data

- [ ] Remove test data:
```sql
sqlite3 .swarm/memory.db "
  DELETE FROM patterns WHERE id LIKE 'test-%';
  DELETE FROM goap_patterns WHERE id LIKE 'test-%';
  DELETE FROM verification_outcomes WHERE id LIKE 'test-%';
  DELETE FROM agent_reliability WHERE agent_id LIKE 'agent-%';
"
```

## 📝 Documentation Verification

- [ ] README.md exists and is complete
- [ ] SCHEMA_REFERENCE.md exists
- [ ] IMPLEMENTATION_SUMMARY.md exists
- [ ] All documentation accurate

## 🎯 NPM Scripts Verification

- [ ] `npm run db:migrate` works
- [ ] `npm run db:migrate:reset` works
- [ ] `npm run db:migrate:verify` works
- [ ] `npm run db:migrate:stats` works
- [ ] `npm run db:migrate:force` works

## 🔄 Idempotency Test

- [ ] Run migration again: `npm run db:migrate`
- [ ] Verify "already applied" messages
- [ ] Verify no errors
- [ ] Verify no duplicate schema versions

## 🚨 Reset and Rebuild Test

- [ ] Run reset: `npm run db:migrate:reset`
- [ ] Verify tables dropped
- [ ] Verify tables recreated
- [ ] Verify data cleared
- [ ] Run verification: `npm run db:migrate:verify`

## ✅ Final Verification

- [ ] All checklist items completed
- [ ] No errors in any step
- [ ] Database file exists: `.swarm/memory.db`
- [ ] Database size reasonable (< 10 MB for empty)
- [ ] Ready for production use

## 🎉 Migration Complete!

Date: _______________
Verified by: _______________
Notes: _______________________________________________

---

## 🐛 Common Issues and Solutions

### Issue: "better-sqlite3" not found

**Solution:**
```bash
npm install better-sqlite3 @types/better-sqlite3
```

### Issue: Permission denied on .swarm directory

**Solution:**
```bash
mkdir -p .swarm
chmod 755 .swarm
```

### Issue: Foreign key constraint failed

**Solution:**
```bash
# Reset and rebuild
npm run db:migrate:reset
```

### Issue: Integrity check fails

**Solution:**
```bash
# Backup and recreate
cp .swarm/memory.db .swarm/memory.db.broken
rm .swarm/memory.db
npm run db:migrate
```

---

## 📞 Support

For issues or questions:
1. Check [README.md](./README.md) for detailed documentation
2. Review [SCHEMA_REFERENCE.md](./SCHEMA_REFERENCE.md) for table specs
3. Run tests: `npm test tests/database/migration.test.ts`
4. Check SQLite logs: `sqlite3 .swarm/memory.db ".log stderr"`
