import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runCapture } from './capture.mjs';
import { MAX_COPY_BYTES, SLICE_BYTES, utf8Length, commandDigest, checkCapture } from '../lib/plan-digest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE = path.join(HERE, 'capture.mjs');
const fwd = (p) => p.replace(/\\/g, '/');

function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-test-'));
  const r = spawnSync('git', ['init', '-q', dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return dir;
}

function gitDirOf(repo) {
  return fwd(path.join(repo, '.git'));
}

function runCli(args, opts = {}) {
  const r = spawnSync(process.execPath, [CAPTURE, ...args], { encoding: 'utf8', env: cleanEnv(), ...opts });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function withRepo(fn) {
  const repo = makeRepo();
  try {
    return fn(repo);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

function sha256Of(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function countLines(buf) {
  const s = buf.toString('utf8');
  if (s === '') return 0;
  return s.split('\n').length - 1 + (s.endsWith('\n') ? 0 : 1);
}

test('AC1: 400 linhas, bytes e sha256 iguais aos da execucao direta', () => {
  withRepo((repo) => {
    const script = path.join(repo, 'gen400.js');
    fs.writeFileSync(script, "for (let i = 0; i < 400; i++) console.log('line ' + String(i).padStart(3, '0') + ' ' + 'x'.repeat(22));\n");
    const direct = spawnSync(process.execPath, [script], { cwd: repo });
    assert.equal(direct.status, 0);
    const argv = ['node', script];
    const r = runCli(['run', '--nonce', 'N1', '--task', 'E41-T1', '--cwd', fwd(repo), '--', ...argv]);
    assert.equal(r.code, 0, r.stderr);
    const line = r.stdout.trimEnd();
    assert.ok(utf8Length(line) <= MAX_COPY_BYTES);
    const o = JSON.parse(line);
    assert.equal(o.tool, 'capture');
    assert.equal(o.exit, 0);
    assert.equal(o.bytes, direct.stdout.length);
    assert.ok(o.bytes > 12000);
    assert.equal(o.sha256, sha256Of(direct.stdout));
    assert.equal(o.lines, 400);
    assert.ok(!o.path.includes('\\'));
    assert.ok(o.path.startsWith(`${gitDirOf(repo)}/pt-evidence/E41-T1/`), o.path);
    const saved = fs.readFileSync(o.path);
    assert.equal(countLines(saved), 400);
    assert.equal(sha256Of(saved), o.sha256);
    assert.equal(o.stderrBytes, 0);
    assert.ok(fs.existsSync(o.stderrPath));
    const chk = checkCapture(r.stdout, { nonce: 'N1', cmdDigest: commandDigest({ argv }) });
    assert.equal(chk.ok, true, chk.why);
  });
});

test('AC5: par exit 1 / exit 0 do mesmo comando com saida de 7 KB ou mais', () => {
  withRepo((repo) => {
    const script = path.join(repo, 'flip.js');
    const control = path.join(repo, 'control.txt');
    fs.writeFileSync(script, [
      "const fs = require('fs');",
      "for (let i = 0; i < 200; i++) console.log('row ' + String(i).padStart(3, '0') + ' ' + 'y'.repeat(30));",
      `process.exit(fs.existsSync(${JSON.stringify(control)}) ? 0 : 1);`,
      '',
    ].join('\n'));
    const argv = ['node', script];
    const a = runCli(['run', '--nonce', 'TAG:E41:T1:a', '--task', 'E41-T1', '--cwd', fwd(repo), '--', ...argv]);
    fs.writeFileSync(control, 'ok');
    const b = runCli(['run', '--nonce', 'TAG:E41:T1:b', '--task', 'E41-T1', '--cwd', fwd(repo), '--', ...argv]);
    assert.equal(a.code, 1);
    assert.equal(b.code, 0);
    const oa = JSON.parse(a.stdout);
    const ob = JSON.parse(b.stdout);
    assert.ok(oa.bytes >= 7000);
    assert.equal(oa.exit, 1);
    assert.equal(ob.exit, 0);
    assert.equal(oa.cmdDigest, ob.cmdDigest);
    assert.notEqual(oa.path, ob.path);
    assert.match(path.basename(oa.path), /^0001-stdout\.txt$/);
    assert.match(path.basename(ob.path), /^0002-stdout\.txt$/);
    const opts = { noncePrefix: 'TAG:E41:T1:', cmdDigest: commandDigest({ argv }) };
    assert.equal(checkCapture(a.stdout, opts).ok, true);
    assert.equal(checkCapture(b.stdout, opts).ok, true);
    assert.equal(checkCapture(a.stdout, { ...opts, cmdDigest: commandDigest({ argv: ['node', 'outro.js'] }) }).ok, false);
    assert.equal(checkCapture(a.stdout, { ...opts, noncePrefix: 'TAG:E41:T2:' }).ok, false);
    const forged = JSON.stringify({ ...oa, exit: 0 });
    assert.equal(checkCapture(forged, opts).ok, false);
  });
});

const SUITE_63 = [
  "const { describe, it } = require('node:test');",
  "const assert = require('node:assert');",
  "describe('grupo', () => {",
  "  for (let i = 0; i < 30; i++) it('ok grupo ' + i, () => {});",
  "  it('FAIL_C', () => { assert.fail('c'); });",
  "  describe('interno', () => {",
  "    for (let i = 0; i < 30; i++) it('ok interno ' + i, () => {});",
  "    it('FAIL_A', () => { assert.fail('a'); });",
  '  });',
  '});',
  "it('FAIL_B', () => { assert.fail('b'); });",
  '',
].join('\n');

test('--tests: suite de 63 testes com 3 falhas vem do extrator', () => {
  withRepo((repo) => {
    const file = path.join(repo, 'big.test.js');
    fs.writeFileSync(file, SUITE_63);
    const r = runCli(['run', '--nonce', 'N2', '--task', 'E41-T2', '--cwd', fwd(repo), '--tests', '--', 'node', '--test', file]);
    assert.equal(r.code, 1, r.stderr);
    const o = JSON.parse(r.stdout);
    assert.equal(o.exit, 1);
    assert.deepEqual(o.extract.failedNames, ['FAIL_A', 'FAIL_B', 'FAIL_C']);
    assert.equal(o.extract.total, 63);
    assert.equal(o.extract.exit, 1);
    assert.equal(o.extract.failedNamesCut, 0);
    assert.ok(utf8Length(r.stdout.trimEnd()) <= SLICE_BYTES);
    assert.equal(checkCapture(r.stdout, { nonce: 'N2' }).ok, true);
  });
});

test('C4: nomes de falha demais sao cortados e o JSON continua dentro de SLICE_BYTES', () => {
  withRepo((repo) => {
    const file = path.join(repo, 'many.test.js');
    fs.writeFileSync(file, [
      "const { it } = require('node:test');",
      "const assert = require('node:assert');",
      "for (let i = 0; i < 200; i++) it('FAIL_' + String(i).padStart(3, '0') + '_' + 'nome-longo-'.repeat(8), () => { assert.fail('x'); });",
      '',
    ].join('\n'));
    const r = runCli(['run', '--nonce', 'N3', '--task', 'E41-T3', '--cwd', fwd(repo), '--tests', '--', 'node', '--test', file]);
    assert.equal(r.code, 1, r.stderr);
    const o = JSON.parse(r.stdout);
    assert.ok(o.extract.failedNamesCut > 0);
    assert.equal(o.extract.failedNames.length + o.extract.failedNamesCut, 200);
    assert.equal(o.extract.fail, 200);
    assert.ok(utf8Length(r.stdout.trimEnd()) <= SLICE_BYTES);
    assert.equal(checkCapture(r.stdout, { nonce: 'N3' }).ok, true);
  });
});

test('C3: comando que nao e node:test e sai 1 tem extract.format unknown', () => {
  withRepo((repo) => {
    const r = runCli(['run', '--nonce', 'N4', '--task', 'E41-T4', '--cwd', fwd(repo), '--tests', '--', 'node', '-e', "console.log('ola'); process.exit(1)"]);
    assert.equal(r.code, 1, r.stderr);
    const o = JSON.parse(r.stdout);
    assert.equal(o.exit, 1);
    assert.equal(o.extract.format, 'unknown');
    assert.equal(o.extract.total, null);
    assert.deepEqual(o.extract.failedNames, []);
  });
});

test('tail: ultimas linhas inteiras e tailCut conta as demais', () => {
  withRepo((repo) => {
    const r = runCli(['run', '--nonce', 'N5', '--task', 'E41-T5', '--cwd', fwd(repo), '--', 'node', '-e',
      "for (let i = 0; i < 100; i++) console.log('l' + i)"]);
    const o = JSON.parse(r.stdout);
    const lines = o.tail.split('\n');
    assert.equal(lines.length, 40);
    assert.equal(lines.at(-1), 'l99');
    assert.equal(o.tailCut, 60);
    assert.equal(o.lines, 100);
  });
});

test('tail: linha unica gigante e cortada pelo comeco e cabe na linha JSON', () => {
  withRepo((repo) => {
    const r = runCli(['run', '--nonce', 'N6', '--task', 'E41-T6', '--cwd', fwd(repo), '--', 'node', '-e',
      "console.log('a'.repeat(9000) + 'FIM')"]);
    const o = JSON.parse(r.stdout);
    assert.ok(utf8Length(r.stdout.trimEnd()) <= SLICE_BYTES);
    assert.ok(o.tail.endsWith('FIM'));
    assert.equal(o.tailCut, 1);
  });
});

function shellTest(name, spawnShell) {
  test(name, (t) => {
    withRepo((repo) => {
      const probe = spawnShell(repo, ['node', '-e', 'process.exit(0)'], true);
      if (probe === null) {
        t.skip('shell indisponivel neste sistema');
        return;
      }
      const r = spawnShell(repo, ['node', '-e', 'process.exit(3)'], false);
      assert.equal(r.status, 3, `${r.stdout}${r.stderr}`);
      const o = JSON.parse(r.stdout);
      assert.equal(o.exit, 3);
      assert.equal(o.tool, 'capture');
    });
  });
}

function captureArgsText(repo, prog) {
  return `run --nonce S1 --task E41-T8 --cwd ${fwd(repo)} -- ${prog.join(' ')}`;
}

shellTest('AC8: Git Bash com --cwd C:/... preserva o exit 3', (repo, prog, probe) => {
  const cmd = `node '${fwd(CAPTURE)}' ${captureArgsText(repo, prog.slice(0, 2))} '${prog[2]}'`;
  const r = spawnSync('bash', ['-c', probe ? 'exit 0' : cmd], { encoding: 'utf8', env: cleanEnv() });
  if (probe) return r.error ? null : r;
  return r;
});

shellTest('AC8: PowerShell com --cwd C:/... preserva o exit 3', (repo, prog, probe) => {
  const cmd = `node '${fwd(CAPTURE)}' ${captureArgsText(repo, prog.slice(0, 2))} '${prog[2]}'; exit $LASTEXITCODE`;
  const r = spawnSync('powershell', ['-NoProfile', '-Command', probe ? 'exit 0' : cmd], { encoding: 'utf8', env: cleanEnv() });
  if (probe) return r.error ? null : r;
  return r;
});

test('--bash com a string exit 4 sai 4', () => {
  withRepo((repo) => {
    const r = runCli(['run', '--nonce', 'N7', '--task', 'E41-T9', '--cwd', fwd(repo), '--bash', 'echo oi; exit 4']);
    assert.equal(r.code, 4, r.stderr + r.stdout);
    const o = JSON.parse(r.stdout);
    assert.equal(o.exit, 4);
    assert.equal(o.cmdDigest, commandDigest({ bash: 'echo oi; exit 4' }));
    assert.equal(o.tail, 'oi');
    assert.equal(checkCapture(r.stdout, { nonce: 'N7', cmdDigest: commandDigest({ bash: 'echo oi; exit 4' }) }).ok, true);
  });
});

test('AC8/C5: --cwd /tmp/x no Windows sai 2 e nada e executado nem gravado', () => {
  withRepo((repo) => {
    const marker = path.join(repo, 'ran.txt');
    const res = runCapture(['run', '--nonce', 'N8', '--task', 'E41-T10', '--cwd', '/tmp/x', '--', 'node', '-e',
      `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x')`], { platform: 'win32', env: cleanEnv() });
    assert.equal(res.code, 2);
    assert.deepEqual(JSON.parse(res.line), {
      tool: 'capture',
      error: 'caminho no estilo msys (/tmp/...) não é aceito no Windows; use C:/...',
    });
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.existsSync(path.join(repo, '.git', 'pt-evidence')), false);
  });
});

test('C5: --task com / sai 2 e nada e executado nem gravado', () => {
  withRepo((repo) => {
    const marker = path.join(repo, 'ran2.txt');
    const res = runCapture(['run', '--nonce', 'N9', '--task', 'a/b', '--cwd', fwd(repo), '--', 'node', '-e',
      `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x')`], { platform: 'win32', env: cleanEnv() });
    assert.equal(res.code, 2);
    const o = JSON.parse(res.line);
    assert.equal(o.tool, 'capture');
    assert.match(o.error, /--task/);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.existsSync(path.join(repo, '.git', 'pt-evidence')), false);
    const cli = runCli(['run', '--nonce', 'N9', '--task', 'a/b', '--cwd', fwd(repo), '--', 'node', '-e', '1']);
    assert.equal(cli.code, 2);
  });
});

test('erros de uso e de ambiente saem 2 com JSON claro', () => {
  withRepo((repo) => {
    const noRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-norepo-'));
    try {
      const cases = [
        [['run', '--task', 't', '--', 'node'], /--nonce/],
        [['run', '--nonce', 'n', '--task', 't'], /comando/],
        [['run', '--nonce', 'bad nonce', '--task', 't', '--', 'node'], /--nonce/],
        [['run', '--nonce', 'n', '--task', 't', '--cwd', fwd(noRepo), '--', 'node', '-e', '1'], /git/],
        [['run', '--nonce', 'n', '--task', 't', '--cwd', fwd(repo), '--', 'programa-que-nao-existe-xyz'], /programa-que-nao-existe-xyz/],
        [['outro'], /uso/],
      ];
      for (const [args, re] of cases) {
        const res = runCapture(args, { env: cleanEnv() });
        assert.equal(res.code, 2, args.join(' '));
        const o = JSON.parse(res.line);
        assert.equal(o.tool, 'capture');
        assert.match(o.error, re);
      }
      assert.equal(fs.existsSync(path.join(repo, '.git', 'pt-evidence')), false);
    } finally {
      fs.rmSync(noRepo, { recursive: true, force: true });
    }
  });
});

test('limpeza de 14 dias: 15 dias some, 13 dias fica, pasta vazia some', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    fs.mkdirSync(path.join(root, 'velha'), { recursive: true });
    fs.mkdirSync(path.join(root, 'nova'), { recursive: true });
    const day = 24 * 3600 * 1000;
    const old = path.join(root, 'velha', '0001-stdout.txt');
    const young = path.join(root, 'nova', '0001-stdout.txt');
    const loose = path.join(root, 'solto.txt');
    for (const [p, days] of [[old, 15], [young, 13], [loose, 15]]) {
      fs.writeFileSync(p, 'x');
      const when = new Date(Date.now() - days * day);
      fs.utimesSync(p, when, when);
    }
    const r = runCli(['run', '--nonce', 'N10', '--task', 'E41-T11', '--cwd', fwd(repo), '--', 'node', '-e', '1']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(loose), false);
    assert.equal(fs.existsSync(path.join(root, 'velha')), false);
    assert.equal(fs.existsSync(young), true);
  });
});
