import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSqlBlocks, checkQuery } from './check-queries.mjs';

const md = '```text\nSELECT 1\n```\n```sql\nSELECT 1 AS a\n```';

test('extractSqlBlocks: only sql fences', () => {
  assert.deepEqual(extractSqlBlocks(md), [{ line: 5, sql: 'SELECT 1 AS a' }]);
});
test('extractSqlBlocks: crlf equals lf', () => {
  assert.deepEqual(extractSqlBlocks(md.replace(/\n/g, '\r\n')), extractSqlBlocks(md));
});

const valid = [
  'SELECT name FROM sys.objects',
  'SELECT create_date FROM sys.objects',
  'SELECT TOP (10) name FROM sys.objects ORDER BY name',
  'SELECT ROW_NUMBER() OVER (ORDER BY name) AS rn FROM sys.objects',
  'SELECT @@VERSION AS v',
  "SELECT wait_type FROM sys.dm_os_wait_stats WHERE wait_type <> N'BACKUPIO'",
  'SELECT name FROM sys.objects WHERE object_id = OBJECT_ID(?)',
  "SELECT 'a;b' AS s",
];
for (const q of valid) test(`valid: ${q}`, () => assert.deepEqual(checkQuery(q), []));

const invalid = [
  ['WITH x AS (SELECT 1 AS a) SELECT a FROM x', /CTE/],
  ['SELECT 1 AS a -- create later', /CREATE/],
  ["SELECT 1 AS a WHERE 'x' = 'BACKUP'", /BACKUP/],
  ["SELECT 1 AS a WHERE N'SP_SERVER_DIAGNOSTICS_SLEEP' = ''", /sp_/i],
  ['SELECT name FROM sys.objects ORDER BY name', /ORDER BY.*TOP/],
  ['SELECT name FROM sys.objects WHERE id = @id', /variable/],
  ['SELECT 1 AS a;', /;/],
  ['SELECT name FROM sys.objects OPTION (RECOMPILE)', /OPTION/],
];
for (const [q, re] of invalid) {
  test(`invalid: ${q}`, () => {
    const v = checkQuery(q);
    assert.equal(v.length, 1, JSON.stringify(v));
    assert.match(v[0], re);
  });
}
