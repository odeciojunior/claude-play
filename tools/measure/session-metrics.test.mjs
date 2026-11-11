import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract, readJsonl, loadPrices, family } from './session-metrics.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, 'fixtures', 'transcripts');
const prices = loadPrices(join(here, 'fixtures', 'prices.json'));
const close = (a, b) => Math.abs(a - b) < 1e-9;

function run() {
  const { runs, unpriced } = extract({ root, prices });
  assert.equal(runs.length, 1);
  return { run: runs[0], unpriced };
}

test('counts usage once per message id, keeping the largest output', () => {
  const { run: r } = run();
  // msg_fab1 appears three times (5, 5, 9) and counts as 9; msg_fab2 adds 7; <synthetic> is ignored.
  assert.equal(r.main.tokens.output, 9 + 7);
  assert.equal(r.main.turns, 2);
});

test('splits cache writes into 5m and 1h', () => {
  const { run: r } = run();
  assert.equal(r.total.tokens.cacheWrite5m, 10 + 0 + 0);
  assert.equal(r.total.tokens.cacheWrite1h, 0 + 30 + 0);
  // Main: msg_fab1 has 100/50; msg_fab2 has no cache_creation, so its 40 count as 5m.
  assert.equal(r.main.tokens.cacheWrite5m, 100 + 40);
  assert.equal(r.main.tokens.cacheWrite1h, 50);
});

test('counts agent calls by dominant model family', () => {
  const { run: r } = run();
  assert.deepEqual(r.total.calls, { haiku: 0, sonnet: 1, opus: 0, fable: 0, other: 1 });
  assert.deepEqual(r.main.agentCalls, { haiku: 1 });
  assert.equal(family('claude-sonnet-4-5'), 'sonnet');
  assert.equal(family('claude-mystery-1'), 'other');
});

test('measures prompt bytes as UTF-8 of the first user message', () => {
  const { run: r } = run();
  const text = '[fab] revisão acentuada: ação';
  assert.ok(Buffer.byteLength(text, 'utf8') > text.length);
  assert.equal(r.roles['agent:reviewer'].promptBytes, Buffer.byteLength(text, 'utf8'));
  assert.equal(r.roles['agent:reviewer'].agents, 1);
  assert.equal(r.main.promptBytes, Buffer.byteLength('[fab] início da sessão', 'utf8'));
});

test('estimates cost and keeps unpriced models null', () => {
  const { run: r, unpriced } = run();
  // sonnet agent: input 20+5, cw5m 10, cw1h 30, cacheRead 100, output 6+8.
  const expected = (25 * 2 + 10 * 2 * 1.25 + 30 * 2 * 2 + 100 * 0.1 + 14 * 10) / 1e6;
  assert.ok(close(r.roles['agent:reviewer'].cost, expected));
  assert.equal(r.roles['agent:worker'].cost, null);
  assert.deepEqual(r.roles['agent:worker'].unpriced, ['other']);
  assert.deepEqual(unpriced, ['other']);
  assert.ok(close(r.total.cost, expected));
  assert.deepEqual(r.total.unpriced, ['other']);
  // Main on opus: input 10+3, cw5m 140, cw1h 50, cacheRead 200, output 16.
  const mainExpected = (13 * 4 + 140 * 4 * 1.25 + 50 * 4 * 2 + 200 * 0.2 + 16 * 20) / 1e6;
  assert.ok(close(r.main.cost, mainExpected));
});

test('readJsonl tolerates CRLF and a partial last line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-jsonl-'));
  try {
    const f = join(dir, 'x.jsonl');
    writeFileSync(f, '{"a":1}\r\n{"b":2}\r\n{"c":');
    assert.deepEqual(readJsonl(f), [{ a: 1 }, { b: 2 }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
