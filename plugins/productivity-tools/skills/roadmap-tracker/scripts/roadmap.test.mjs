import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStatusSegments, parseStatus, decisionScope, blockLines, splitRow } from '../../../lib/roadmap-format.mjs';
import { splitLines, joinLines, serializeRow, applyEdits } from '../../../lib/roadmap-edit.mjs';
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

test('splitLines/joinLines são inversas exatas', () => {
  for (const x of ['a\r\nb\r\n', '\uFEFFa\nb', 'a\rb\r\n', '', 'só uma']) {
    assert.equal(joinLines(splitLines(x)), x);
  }
  assert.equal(splitLines('\uFEFFa\nb').bom, '\uFEFF');
});

test('applyEdits insertAfter mantém BOM e terminador CRLF', () => {
  assert.equal(
    applyEdits('\uFEFFh\r\nx\r\ny\r\n', [{ op: 'insertAfter', line: 1, text: 'n' }]),
    '\uFEFFh\r\nx\r\nn\r\ny\r\n',
  );
});

test('applyEdits não acrescenta terminador ao fim do arquivo', () => {
  assert.equal(applyEdits('h\nx\ny', [{ op: 'insertAfter', line: 2, text: 'n' }]), 'h\nx\ny\nn');
  assert.equal(applyEdits('h\nx\ny', [{ op: 'insertBefore', line: 2, text: 'n' }]), 'h\nx\nn\ny');
});

test('applyEdits replace mantém terminador próprio e linhas intocadas em NFD', () => {
  assert.equal(applyEdits('a\nb\r\nc\n', [{ op: 'replace', line: 1, text: 'B' }]), 'a\nB\r\nc\n');
  const nfd = 'Cafe\u0301';
  const out = applyEdits(`${nfd}\nb\n`, [{ op: 'replace', line: 1, text: 'B' }]);
  assert.equal(out, `${nfd}\nB\n`);
  assert.notEqual(out.slice(0, 5), 'Café');
});

test('applyEdits remove intervalo de item com continuação', () => {
  assert.equal(
    applyEdits('- a\n- b\n  cont\n- c\n', [{ op: 'remove', line: 1, end: 2 }]),
    '- a\n- c\n',
  );
});

test('applyEdits com várias edições equivale a aplicá-las de baixo para cima', () => {
  const raw = 'l0\nl1\nl2\nl3\nl4\nl5\nl6\n';
  const edits = [
    { op: 'remove', line: 5 },
    { op: 'insertBefore', line: 1, text: 'N' },
    { op: 'replace', line: 3, text: 'R' },
  ];
  let seq = raw;
  for (const e of [edits[0], edits[2], edits[1]]) seq = applyEdits(seq, [e]);
  assert.equal(applyEdits(raw, edits), seq);
  assert.equal(seq, 'l0\nN\nl1\nl2\nR\nl4\nl6\n');
});

test('serializeRow escapa, achata e normaliza; ida e volta com splitRow', () => {
  const cells = ['a|b', 'x\r\ny', 'Cafe\u0301'];
  assert.equal(serializeRow(cells), '| a\\|b | x y | Caf\u00e9 |');
  assert.deepEqual(splitRow(serializeRow(cells)), ['a|b', 'x y', 'Caf\u00e9']);
  const nested = ['(BLQ-2 (ver log))', '`c|d`'];
  assert.deepEqual(splitRow(serializeRow(nested)), nested);
});

test('lib/roadmap-edit.mjs é puro', () => {
  const src = fs.readFileSync(path.join(here, '..', '..', '..', 'lib', 'roadmap-edit.mjs'), 'utf8');
  assert.equal(checkPureSource(src, 'roadmap-edit'), null);
});
