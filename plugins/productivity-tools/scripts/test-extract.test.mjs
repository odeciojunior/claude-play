import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractTests, allTestNames, stripAnsi } from './test-extract.mjs';
import { MAX_COPY_BYTES, canon, fnv1a, checkRun } from '../lib/plan-digest.mjs';

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

// E44: resumo do vitest e saida colorida. As linhas SGR reproduzem o que o vitest 4.1.12 imprime.
const VITEST_PASS = [
  ' Test Files  2 passed (2)',
  '      Tests  97 passed (97)',
].join('\n');
const VITEST_PASS_SGR = [
  '\x1b[2m Test Files \x1b[22m \x1b[1m\x1b[32m2 passed\x1b[39m\x1b[22m\x1b[90m (2)\x1b[39m',
  '\x1b[2m      Tests \x1b[22m \x1b[1m\x1b[32m97 passed\x1b[39m\x1b[22m\x1b[90m (97)\x1b[39m',
].join('\n');
const VITEST_MIXED = '      Tests  1 failed | 2 passed | 1 skipped | 1 todo (5)';
const SEP_SGR = '\x1b[2m | \x1b[22m';
const VITEST_MIXED_SGR = '\x1b[2m      Tests \x1b[22m ' + [
  '\x1b[1m\x1b[31m1 failed\x1b[39m\x1b[22m',
  '\x1b[1m\x1b[32m2 passed\x1b[39m\x1b[22m',
  '\x1b[33m1 skipped\x1b[39m',
  '\x1b[90m1 todo\x1b[39m',
].join(SEP_SGR) + '\x1b[90m (5)\x1b[39m';
const VITEST_XFAIL = '      Tests  1 failed | 2 passed | 1 expected fail | 1 skipped | 1 todo (6)';
const VITEST_XFAIL_SGR = '\x1b[2m      Tests \x1b[22m ' + [
  '\x1b[1m\x1b[31m1 failed\x1b[39m\x1b[22m',
  '\x1b[1m\x1b[32m2 passed\x1b[39m\x1b[22m',
  '\x1b[36m1 expected fail\x1b[39m',
  '\x1b[33m1 skipped\x1b[39m',
  '\x1b[90m1 todo\x1b[39m',
].join(SEP_SGR) + '\x1b[90m (6)\x1b[39m';
const SPEC_PLAIN = [
  '▶ grupo',
  '  ✔ passa (0.4ms)',
  '  ✖ falha um (1.2ms)',
  '✖ grupo (2.1ms)',
  '✖ falha dois (0.5ms)',
  'ℹ tests 3',
  'ℹ suites 1',
  'ℹ pass 1',
  'ℹ fail 2',
  'ℹ skipped 0',
  '',
  '✖ failing tests:',
  '',
  '✖ falha um (1.2ms)',
].join('\n');
const SPEC_SGR = [
  '▶ grupo',
  '  \x1b[32m✔ passa \x1b[90m(0.4ms)\x1b[39m\x1b[39m',
  '  \x1b[31m✖ falha um \x1b[90m(1.2ms)\x1b[39m\x1b[39m',
  '\x1b[31m✖ grupo \x1b[90m(2.1ms)\x1b[39m\x1b[39m',
  '\x1b[31m✖ falha dois \x1b[90m(0.5ms)\x1b[39m\x1b[39m',
  '\x1b[34mℹ tests 3\x1b[39m',
  '\x1b[34mℹ suites 1\x1b[39m',
  '\x1b[34mℹ pass 1\x1b[39m',
  '\x1b[34mℹ fail 2\x1b[39m',
  '\x1b[34mℹ skipped 0\x1b[39m',
  '',
  '\x1b[31m✖ failing tests:\x1b[39m',
  '',
  '\x1b[31m✖ falha um \x1b[90m(1.2ms)\x1b[39m\x1b[39m',
].join('\n');

test('E44 stripAnsi: remove SGR e outras sequencias CSI', () => {
  const text = '\x1b[2K\x1b[1G\x1b[1m\x1b[32mverde\x1b[39m\x1b[22m um\r\n\x1b[?25l\x1b[38;5;196mdois\x1b[0m\n\x1b[3Atres [4] x';
  assert.equal(stripAnsi(text), 'verde um\r\ndois\ntres [4] x');
});

test('E44 AC1: resumo do vitest 4 sem cor informa total 97', () => {
  assert.deepEqual(extractTests(VITEST_PASS, 0), {
    format: 'vitest', exit: 0, total: 97, pass: 97, fail: 0, skipped: 0, failedNames: null,
  });
});

test('E44 C1: partes failed, passed, skipped e todo', () => {
  assert.deepEqual(extractTests(VITEST_MIXED, 1), {
    format: 'vitest', exit: 1, total: 5, pass: 2, fail: 1, skipped: 1, failedNames: null,
  });
  assert.deepEqual(extractTests(VITEST_XFAIL, 1), {
    format: 'vitest', exit: 1, total: 6, pass: 2, fail: 1, skipped: 1, failedNames: null,
  });
});

test('E44 C2: saida colorida da o mesmo extrato do texto sem cor', () => {
  for (const [colored, plain, exit] of [[VITEST_PASS_SGR, VITEST_PASS, 0], [VITEST_MIXED_SGR, VITEST_MIXED, 1], [VITEST_XFAIL_SGR, VITEST_XFAIL, 1]]) {
    const got = extractTests(colored, exit);
    assert.equal(got.format, 'vitest');
    assert.deepEqual(got, extractTests(plain, exit));
  }
  const spec = extractTests(SPEC_SGR, 1);
  assert.equal(spec.format, 'node-spec');
  assert.deepEqual(spec.failedNames, ['falha dois', 'falha um']);
  assert.deepEqual(spec, extractTests(SPEC_PLAIN, 1));
});

test('E44 C3: so a linha Test Files nao reconhece o formato', () => {
  const r = extractTests(' Test Files  2 passed (2)\n   Duration  1.20s', 0);
  assert.equal(r.format, 'unknown');
  assert.equal(r.total, null);
});

test('E44 allTestNames: saida colorida lista os nomes; vitest devolve lista vazia', () => {
  assert.deepEqual([...allTestNames(SPEC_SGR)].sort(), ['falha dois', 'falha um', 'passa']);
  assert.deepEqual(allTestNames(VITEST_MIXED), []);
  assert.deepEqual(allTestNames(VITEST_MIXED_SGR), []);
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

const ALL_SUITE = [
  "const { describe, it } = require('node:test');",
  "describe('grupo', () => {",
  "  it('p1', () => {});",
  "  it('s1', { skip: true }, () => {});",
  "  it('t1', { todo: true }, () => {});",
  "  it('f1', () => { throw new Error('x'); });",
  "});",
  "",
].join('\n');

for (const reporter of ['tap', 'spec']) {
  test(`allTestNames em ${reporter}: todos os nomes, sem suite, duracao ou repeticao`, () => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-extract-all-'));
    try {
      const file = path.join(dir, 'a.test.js');
      fs.writeFileSync(file, ALL_SUITE);
      const r = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`, file], { encoding: 'utf8', env });
      assert.deepEqual([...allTestNames(r.stdout)].sort(), ['f1', 'p1', 's1', 't1']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('allTestNames: texto desconhecido devolve lista vazia', () => {
  assert.deepEqual(allTestNames('hello world'), []);
  assert.deepEqual(allTestNames(undefined), []);
});

// E36 T3: subcomando removed (repositorio git temporario com base e HEAD, saida TAP gravada).
const SELF = fileURLToPath(new URL('./test-extract.mjs', import.meta.url));
const GITARGS = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false'];
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sh = (cwd, ...args) => {
  const r = spawnSync('git', [...GITARGS, ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, args.join(' ') + ': ' + r.stderr);
  return r.stdout.trim();
};
const T = (name) => `test('${name}', () => {});`;
const BASE_A = [
  "import { test, describe, it } from 'node:test';",
  T('single removed'),
  'for (const i of [1, 2]) test(`loop ${i}`, () => {});',
  T('dup'),
  T('dup'),
  "describe('grupo', () => {",
  "  it('g1', () => {});",
  "  it.skip('g2', () => {});",
  "  it('g3', () => {});",
  '});',
  T('stays'),
  String.raw`test('com "aspas" e \\ barra', () => {});`,
  T('moved'),
  '',
].join('\n');
const HEAD_A = [
  "import { test } from 'node:test';",
  T('stays'),
  '',
].join('\n');
const BASE_B = ["import { test } from 'node:test';", T('crlf one'), ''].join('\r\n');
const HEAD_C = ["import { test } from 'node:test';", T('moved'), ''].join('\n');
const TAP = ['TAP version 13', 'ok 1 - stays', 'ok 2 - moved', '1..2', '# tests 2', '# pass 2', '# fail 0', '# skipped 0', ''].join('\n');
const dataFile = (obj) => 'texto\n\n```json data\n' + JSON.stringify(obj, null, 2) + '\n```\n';
const ENTRY = (file, name, extra = {}) => ({ file, name, why: 'obsoleto', ...extra });

function removedRepo(specObj, planObj, { output = TAP } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'te-removed-'));
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(path.join(repo, 'tests'), { recursive: true });
  sh(repo, 'init', '-q');
  fs.writeFileSync(path.join(repo, 'tests', 'a.test.mjs'), BASE_A);
  fs.writeFileSync(path.join(repo, 'tests', 'b.test.mjs'), BASE_B);
  sh(repo, 'add', '.');
  sh(repo, 'commit', '-q', '-m', 'base');
  const base = sh(repo, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(repo, 'tests', 'a.test.mjs'), HEAD_A);
  fs.writeFileSync(path.join(repo, 'tests', 'c.test.mjs'), HEAD_C);
  fs.rmSync(path.join(repo, 'tests', 'b.test.mjs'));
  sh(repo, 'add', '-A');
  sh(repo, 'commit', '-q', '-m', 'head');
  const spec = path.join(dir, 'spec.md');
  const plan = path.join(dir, 'plan.md');
  const out = path.join(dir, 'out.tap');
  fs.writeFileSync(spec, typeof specObj === 'string' ? specObj : dataFile(specObj));
  fs.writeFileSync(plan, typeof planObj === 'string' ? planObj : dataFile(planObj));
  fs.writeFileSync(out, output);
  const args = (extra = []) => [SELF, 'removed', '--nonce', 'n-1', '--spec', spec, '--plan', plan, '--base', base, '--cwd', repo, '--output', out, '--sha', sha256(fs.readFileSync(out)), '--gate', 'tests', ...extra];
  const call = (extra = []) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, args(extra), { encoding: 'utf8', env });
    return { code: r.status, stdout: r.stdout, json: JSON.parse(r.stdout) };
  };
  return { dir, base, args, call };
}

const SPEC_ENTRIES = {
  removedTests: [
    ENTRY('tests/a.test.mjs', 'single removed'),
    ENTRY('tests/a.test.mjs', 'loop ${i}'),
    ENTRY('tests/a.test.mjs', 'dup'),
    ENTRY('tests/a.test.mjs', 'grupo'),
    ENTRY('tests/a.test.mjs', 'g1', { gate: 'tests' }),
    ENTRY('tests/a.test.mjs', 'g2', { gate: 'tests' }),
    ENTRY('tests/a.test.mjs', 'g3', { gate: 'tests' }),
    ENTRY('tests/a.test.mjs', 'stays'),
    ENTRY('tests/a.test.mjs', 'com "aspas" e \\ barra'),
    ENTRY('tests/b.test.mjs', 'crlf one'),
    ENTRY('tests/a.test.mjs', 'moved'),
    ENTRY('tests/a.test.mjs', 'outro gate', { gate: 'integration' }),
  ],
};
const PLAN_ENTRIES = { removedTests: [ENTRY('tests/a.test.mjs', 'single removed', { gate: 'tests' })] };

test('removed: C1-C5, CRLF, escape, arquivo apagado e par repetido com --single-tests-gate', () => {
  const r = removedRepo(SPEC_ENTRIES, PLAN_ENTRIES);
  try {
    const { code, json, stdout } = r.call(['--single-tests-gate']);
    assert.equal(code, 0, stdout);
    assert.equal(json.verified, 6);
    assert.equal(json.gate, 'tests');
    assert.equal(json.base, r.base);
    assert.equal(json.unverifiedCut, 0);
    const why = Object.fromEntries(json.unverified.map((u) => [u.name, u.reason]));
    assert.deepEqual(Object.keys(why).sort(), ['dup', 'grupo', 'loop ${i}', 'moved', 'stays']);
    assert.match(why['loop ${i}'], /nenhum literal/);
    assert.match(why.dup, /2 vezes/);
    assert.match(why.grupo, /test\( ou it\(/);
    assert.match(why.stays, /continua no arquivo em HEAD/);
    assert.match(why.moved, /ainda roda/);
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('removed: entradas sem gate sem --single-tests-gate saem com "gate obrigatório"', () => {
  const r = removedRepo(SPEC_ENTRIES, PLAN_ENTRIES);
  try {
    const { code, json } = r.call();
    assert.equal(code, 0);
    assert.equal(json.verified, 4);
    const why = Object.fromEntries(json.unverified.map((u) => [u.name, u.reason]));
    assert.equal(why['com "aspas" e \\ barra'], 'gate obrigatório');
    assert.equal(why['crlf one'], 'gate obrigatório');
    assert.equal(why['outro gate'], undefined);
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('removed: a linha passa por checkRun e o describe com 3 testes dá verified 3, não 4', () => {
  const only = { removedTests: ['grupo', 'g1', 'g2', 'g3'].map((n) => ENTRY('tests/a.test.mjs', n)) };
  const r = removedRepo(only, { removedTests: [] });
  try {
    const { stdout, json } = r.call(['--single-tests-gate']);
    assert.equal(json.verified, 3);
    assert.deepEqual(json.unverified.map((u) => u.name), ['grupo']);
    const c = checkRun(stdout, 'test-extract', 'n-1');
    assert.equal(c.ok, true, c.why);
    const { digest, ...rest } = json;
    assert.equal(digest, fnv1a(JSON.stringify(canon(rest))));
    assert.equal(checkRun(stdout, 'test-extract', 'outro').ok, false);
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('removed: unverified é cortado para caber em MAX_COPY_BYTES, com unverifiedCut', () => {
  const many = { removedTests: Array.from({ length: 80 }, (_, i) => ENTRY('tests/a.test.mjs', 'inexistente '.repeat(8) + i)) };
  const r = removedRepo(many, { removedTests: [] });
  try {
    const { stdout, json } = r.call(['--single-tests-gate']);
    assert.equal(json.verified, 0);
    assert.ok(Buffer.byteLength(stdout.trim()) <= MAX_COPY_BYTES, String(Buffer.byteLength(stdout)));
    assert.ok(json.unverifiedCut > 0);
    assert.equal(json.unverified.length + json.unverifiedCut, 80);
    assert.equal(checkRun(stdout, 'test-extract', 'n-1').ok, true);
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('removed: recusas assinadas com nonce e exit 2 (sha divergente, lista inválida, bloco ausente, base inválida)', () => {
  const r = removedRepo(SPEC_ENTRIES, PLAN_ENTRIES);
  try {
    const args = r.args(['--single-tests-gate']);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = (a) => {
      const p = spawnSync(process.execPath, a, { encoding: 'utf8', env });
      return { code: p.status, json: JSON.parse(p.stdout) };
    };
    const setArg = (name, value) => {
      const a = args.slice();
      a[a.indexOf(name) + 1] = value;
      return a;
    };
    const bad = run(setArg('--sha', 'f'.repeat(64)));
    assert.equal(bad.code, 2);
    assert.deepEqual(Object.keys(bad.json), ['tool', 'command', 'nonce', 'error']);
    assert.equal(bad.json.tool, 'test-extract');
    assert.equal(bad.json.command, 'removed');
    assert.equal(bad.json.nonce, 'n-1');
    assert.match(bad.json.error, /sha256/);
    assert.equal(checkRun(JSON.stringify(bad.json), 'test-extract', 'n-1').ok, false);

    const specPath = args[args.indexOf('--spec') + 1];
    fs.writeFileSync(specPath, dataFile({ removedTests: 'x' }));
    const inv = run(args);
    assert.equal(inv.code, 2);
    assert.match(inv.json.error, /field-type/);
    fs.writeFileSync(specPath, 'sem bloco');
    assert.equal(run(args).code, 2);
    assert.equal(run(setArg('--base', 'nao-existe')).code, 2);
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('allTestNames: TAP real desfaz o escape de # e barra invertida nos nomes', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-extract-esc-'));
  try {
    const file = path.join(dir, 'a.test.js');
    fs.writeFileSync(file, [
      "const { test } = require('node:test');",
      "test('issue #12 fix', () => {});",
      "test('path a\\\\b', () => {});",
      "test('falha #7 x', () => { throw new Error('x'); });",
      '',
    ].join('\n'));
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { encoding: 'utf8', env });
    assert.match(r.stdout, /issue \\#12 fix/, 'a saida TAP escapa o #');
    assert.deepEqual([...allTestNames(r.stdout)].sort(), ['falha #7 x', 'issue #12 fix', 'path a\\b']);
    assert.deepEqual(extractTests(r.stdout, 1).failedNames, ['falha #7 x']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
