import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStatusSegments, parseStatus, decisionScope, blockLines } from '../../../lib/roadmap-format.mjs';
import { checkPureSource } from '../../../scripts/embed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const validDir = path.join(here, 'fixtures', 'valid');
const stateLf = fs.readFileSync(path.join(validDir, 'state.md'), 'utf8').replace(/\r\n?/g, '\n');

test('parseStatusSegments separa segmentos, rótulo, palavra e nota', () => {
  assert.deepEqual(parseStatusSegments('piece 1: integrated (`abc1234`); piece 2: spec'), [
    { raw: 'piece 1: integrated (`abc1234`)', label: 'piece 1', word: 'integrated', note: '`abc1234`' },
    { raw: 'piece 2: spec', label: 'piece 2', word: 'spec', note: '' },
  ]);
  const b = parseStatusSegments('blocked (BLQ-2 (see log))')[0];
  assert.equal(b.word, 'blocked');
  assert.equal(b.note, 'BLQ-2 (see log)');
  assert.equal(b.label, '');
});

test('parseStatus mantém a saída anterior', () => {
  assert.deepEqual(parseStatus('piece 1: integrated (`abc1234`); piece 2: spec'), ['integrated', 'spec']);
  assert.deepEqual(parseStatus('blocked (BLQ-2 (see log))'), ['blocked']);
});

test('decisionScope', () => {
  assert.equal(decisionScope('X. Alcance: local.'), 'local');
  assert.equal(decisionScope('X. Scope: local'), 'local');
  assert.equal(decisionScope('X. Alcance: contrato.'), 'contract');
  assert.equal(decisionScope('local scope'), 'contract');
});

test('blockLines é igual em LF, CRLF com BOM e NFD fora do bloco', () => {
  const lf = stateLf;
  const crlf = '﻿' + stateLf.replace(/\n/g, '\r\n');
  const nfd = stateLf.replace('# State', '# Café');
  assert.notEqual(nfd, stateLf);
  const results = [lf, crlf, nfd].map((t) => ({
    t,
    panel: blockLines(t, 'panel'),
    blockers: blockLines(t, 'blockers'),
    pending: blockLines(t, 'pending'),
  }));
  for (const r of results.slice(1)) {
    assert.deepEqual(r.panel, results[0].panel);
    assert.deepEqual(r.blockers, results[0].blockers);
    assert.deepEqual(r.pending, results[0].pending);
  }
  for (const r of results) {
    assert.equal(r.panel.rows.length, 3);
    const raw = r.t.split(/\r\n|\r|\n/);
    assert.ok(raw[r.panel.rows[0]].startsWith('| E1 |'));
    assert.deepEqual(r.blockers.rows, []);
    assert.ok(raw[r.blockers.header].startsWith('| ID | Blocker |'));
    assert.equal(r.pending.items.length, 1);
    assert.equal(blockLines(r.t, 'nope'), null);
  }
});

test('blockLines: itens de lista com continuação', () => {
  const t = 'a\n<!-- roadmap:now -->\n1. um\n   cont\n2. dois\n<!-- /roadmap:now -->\n';
  const b = blockLines(t, 'now');
  assert.deepEqual(b.items, [{ start: 2, end: 3 }, { start: 4, end: 4 }]);
  assert.equal(b.open, 1);
  assert.equal(b.close, 5);
});

test('lib/roadmap-format.mjs continua puro', () => {
  const src = fs.readFileSync(path.join(here, '..', '..', '..', 'lib', 'roadmap-format.mjs'), 'utf8');
  assert.equal(checkPureSource(src, 'lib/roadmap-format.mjs'), null);
});
