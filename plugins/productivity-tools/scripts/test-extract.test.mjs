import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractTests } from './test-extract.mjs';

const SUITE = [
  "const { describe, it } = require('node:test');",
  "const assert = require('node:assert');",
  "describe('grupo', () => {",
  "  for (let i = 0; i < 30; i++) it('ok grupo ' + i, () => {});",
  "  it('FAIL_C', () => { assert.fail('c'); });",
  "  describe('interno', () => {",
  "    for (let i = 0; i < 30; i++) it('ok interno ' + i, () => {});",
  "    it('FAIL_A', () => { assert.fail('a'); });",
  "  });",
  "});",
  "it('FAIL_B', () => { assert.fail('b'); });",
  "",
].join('\n');

function run(reporter) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-extract-'));
  try {
    fs.mkdirSync(path.join(dir, 'suite'));
    const file = path.join(dir, 'suite', 'big.test.js');
    fs.writeFileSync(file, SUITE);
    const r = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`, file], { encoding: 'utf8', env });
    return { text: r.stdout, exit: r.status };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

for (const [reporter, format] of [['tap', 'node-tap'], ['spec', 'node-spec']]) {
  test(`suite real de 63 testes em ${reporter}`, () => {
    const { text, exit } = run(reporter);
    assert.equal(exit, 1);
    assert.deepEqual(extractTests(text, exit), {
      format, exit: 1, total: 63, pass: 60, fail: 3, skipped: 0,
      failedNames: ['FAIL_A', 'FAIL_B', 'FAIL_C'],
    });
  });
}

test('tap: suite nao conta, SKIP/TODO nao sao falha, sem repeticao e ordenado', () => {
  const text = [
    'TAP version 13',
    '# Subtest: s',
    '    not ok 1 - zeta # SKIP motivo',
    '    not ok 2 - alfa # TODO x',
    '    not ok 3 - alfa',
    'not ok 1 - s',
    '  ---',
    "  type: 'suite'",
    '  ...',
    '1..1',
    '# tests 3',
    '# pass 0',
    '# fail 3',
    '# skipped 0',
  ].join('\n');
  const r = extractTests(text, 1);
  assert.equal(r.format, 'node-tap');
  assert.deepEqual(r.failedNames, ['alfa']);
  assert.equal(r.total, 3);
});

test('tap: todo que falha sai 0 com fail 0 e failedNames vazio', () => {
  const text = [
    'TAP version 13',
    'not ok 1 - quebrado # TODO',
    '  ---',
    '  duration_ms: 1',
    '  ...',
    'ok 2 - bom',
    '1..2',
    '# tests 2',
    '# pass 1',
    '# fail 0',
    '# skipped 0',
    '# todo 1',
  ].join('\n');
  const r = extractTests(text, 0);
  assert.equal(r.exit, 0);
  assert.equal(r.fail, 0);
  assert.deepEqual(r.failedNames, []);
});

test('spec: secao failing tests nao duplica e a duracao sai do nome', () => {
  const text = [
    '✖ falha um (1.2ms)',
    '✖ falha dois (0.5ms)',
    'ℹ tests 2',
    'ℹ suites 0',
    'ℹ pass 0',
    'ℹ fail 2',
    'ℹ skipped 0',
    '',
    '✖ failing tests:',
    '',
    '✖ falha um (1.2ms)',
    '  Error: x',
    '✖ falha dois (0.5ms)',
  ].join('\n');
  const r = extractTests(text, 1);
  assert.equal(r.format, 'node-spec');
  assert.deepEqual(r.failedNames, ['falha dois', 'falha um']);
  assert.equal(r.fail, 2);
});

test('C3: texto que nao e node:test', () => {
  assert.deepEqual(extractTests('hello world', 1), {
    format: 'unknown', exit: 1, total: null, pass: null, fail: null, skipped: null, failedNames: [],
  });
});

test('CLI imprime o JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-extract-cli-'));
  try {
    const f = path.join(dir, 'out.txt');
    fs.writeFileSync(f, 'nada');
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-extract.mjs');
    const r = spawnSync(process.execPath, [script, f, '--exit', '1'], { encoding: 'utf8' });
    assert.equal(JSON.parse(r.stdout).exit, 1);
    assert.equal(JSON.parse(r.stdout).format, 'unknown');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
