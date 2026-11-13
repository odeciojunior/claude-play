import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { workflowChars } from '../../roadmap-release/workflow/size.test.mjs';
import { loadPure } from '../../roadmap-release/workflow/load-pure.mjs';
import { embedFile } from '../../../scripts/embed.mjs';
import * as ps from '../../../lib/progress-state.mjs';
import * as pd from '../../../lib/plan-digest.mjs';
import * as ea from '../../../lib/external-auth.mjs';

// Teto próprio do coordinator, bem abaixo dos 524.288 bytes do lançamento pelo nome
// (docs/reports/2026-11-13-E8-limite-lancamento-workflow.md).
export const MAX_COORDINATOR_CHARS = 120000;

const FILE = fileURLToPath(new URL('./coordinator.js', import.meta.url));
const P = loadPure(FILE);

test('the coordinator workflow stays within its own size cap', () => {
  const size = workflowChars(readFileSync(FILE, 'utf8'));
  assert.ok(size <= MAX_COORDINATOR_CHARS, `coordinator.js has ${size} chars, cap is ${MAX_COORDINATOR_CHARS}`);
});

test('embedded blocks are not stale', () => {
  assert.equal(embedFile(FILE, { check: true }).stale, false);
});

test('embedded functions behave like the ones in lib/', () => {
  const state = {
    schema: 'progress/1',
    run: { status: 'map-ready' },
    steps: [],
    history: [],
  };
  const ev = [{ type: 'no-such-event' }];
  assert.deepEqual(P.applyEvents(state, ev, '2026-11-13T00:00:00.000Z'), ps.applyEvents(state, ev, '2026-11-13T00:00:00.000Z'));
  assert.deepEqual(P.applyEvents(state, [{ type: 'approve-map' }], 'n'), ps.applyEvents(state, [{ type: 'approve-map' }], 'n'));
  assert.deepEqual(P.nextAction(state), ps.nextAction(state));
  const v = { b: [3, { y: 1, x: 2 }], a: 'z' };
  assert.deepEqual(P.canon(v), pd.canon(v));
  assert.equal(P.fnv1a('abc'), pd.fnv1a('abc'));
  const items = ['gate:G1', 'plan:T3@0123abcd', 'bad item'];
  assert.deepEqual(P.parseAuthorizeExternal(items), ea.parseAuthorizeExternal(items));
  assert.deepEqual(P.parseAuthorizeExternal(['plan:T3@0123abcd']), ea.parseAuthorizeExternal(['plan:T3@0123abcd']));
  const task = { n: 3, external: true };
  assert.equal(P.externalHold(task, 'plan', ['plan:T3@0123abcd'], '0123abcd'), ea.externalHold(task, 'plan', ['plan:T3@0123abcd'], '0123abcd'));
  assert.equal(P.externalHold(task, 'plan', [], '0123abcd'), ea.externalHold(task, 'plan', [], '0123abcd'));
});

test('the coordinator source has no forbidden APIs', () => {
  const src = readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /\b(?:crypto|process|Buffer|subagent_type)\b|^\s*import\b|\brequire\s*\(|\breadFile/m);
});
