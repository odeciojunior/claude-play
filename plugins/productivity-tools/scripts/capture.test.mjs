import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runCapture } from './capture.mjs';
import { gitBash } from './git-bash.mjs';
import { MAX_COPY_BYTES, SLICE_BYTES, utf8Length, commandDigest, checkCapture, checkSlice, joinSlices, canon, fnv1a } from '../lib/plan-digest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE = path.join(HERE, 'capture.mjs');
const BASH = gitBash();
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

function withRepoAsync(fn) {
  const repo = makeRepo();
  return fn(repo).finally(() => fs.rmSync(repo, { recursive: true, force: true }));
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

// Roda fn com PT_BASH trocada (undefined apaga) e devolve a variável ao estado anterior.
function withPtBash(value, fn) {
  const old = process.env.PT_BASH;
  const set = (v) => { if (v === undefined) delete process.env.PT_BASH; else process.env.PT_BASH = v; };
  set(value);
  try {
    return fn();
  } finally {
    set(old);
  }
}

test('gitBash: PT_BASH definida volta como está, mesmo sem o arquivo existir', () => {
  const missing = path.join(os.tmpdir(), 'nao-existe-pt-bash', 'bash.exe');
  assert.equal(fs.existsSync(missing), false);
  withPtBash(missing, () => assert.equal(gitBash(), missing));
});

test('gitBash: sem PT_BASH devolve o bash do Git no win32 (ou null) e bash fora dele', () => {
  const found = withPtBash(undefined, () => gitBash());
  if (process.platform !== 'win32') {
    assert.equal(found, 'bash');
  } else if (found !== null) {
    assert.ok(fs.existsSync(found), found);
    assert.match(found, /bash\.exe$/i);
    assert.doesNotMatch(found, /system32/i);
  }
});

function shellTest(name, spawnShell, options = {}) {
  test(name, options, (t) => {
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
  if (probe && BASH === null) return null;
  const r = spawnSync(BASH, ['-c', probe ? 'exit 0' : cmd], { encoding: 'utf8', env: cleanEnv() });
  if (probe) return r.error ? null : r;
  return r;
}, { skip: BASH ? false : 'Git Bash não encontrado; instale o Git ou defina PT_BASH' });

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

test('capturas paralelas na mesma pasta de provas: todas gravam e imprimem a linha JSON', async () => {
  await withRepoAsync(async (repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    for (let i = 0; i < 6; i++) fs.mkdirSync(path.join(root, `vazia${i}`), { recursive: true });
    const runOne = (k) => new Promise((resolve) => {
      const c = spawn(process.execPath, [CAPTURE, 'run', '--nonce', `P${k}`, '--task', 'E41-par', '--cwd', fwd(repo), '--', 'node', '-e', '1'], { env: cleanEnv() });
      let out = '';
      c.stdout.on('data', (d) => { out += d; });
      c.on('close', (code) => resolve({ code, out }));
    });
    const rs = await Promise.all(Array.from({ length: 8 }, (_, k) => runOne(k)));
    for (const r of rs) {
      assert.equal(r.code, 0, r.out);
      assert.equal(JSON.parse(r.out).tool, 'capture');
    }
    const files = fs.readdirSync(path.join(root, 'E41-par')).filter((n) => n.endsWith('-stdout.txt'));
    assert.equal(files.length, 8);
  });
});

function runBig(repo, task = 'E41-T1') {
  const script = path.join(repo, 'gen127.js');
  fs.writeFileSync(script, "for (let i = 0; i < 400; i++) console.log('line ' + String(i).padStart(3, '0') + ' ' + 'x'.repeat(22));\n");
  const r = runCli(['run', '--nonce', 'S0', '--task', task, '--cwd', fwd(repo), '--', 'node', script]);
  assert.equal(r.code, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('slice: fatias remontam com o mesmo sha256 do run e cada uma passa em checkSlice', () => {
  withRepo((repo) => {
    const o = runBig(repo);
    assert.ok(o.bytes > 12000);
    const envs = [];
    let slices = 1;
    for (let k = 0; k < slices; k++) {
      const r = runCli(['slice', '--nonce', 'S1', '--path', o.path, '--cwd', fwd(repo), '--sha', o.sha256, '--slice', String(k)]);
      assert.equal(r.code, 0, r.stderr + r.stdout);
      assert.ok(utf8Length(r.stdout.trimEnd()) <= SLICE_BYTES);
      const env = JSON.parse(r.stdout);
      assert.equal(checkSlice(env, { tool: 'capture', command: 'slice', nonce: 'S1', slice: k }).ok, true);
      slices = env.slices;
      envs.push(env);
    }
    assert.ok(envs.length > 3);
    const joined = joinSlices(envs);
    assert.equal(joined.ok, true, joined.why);
    assert.equal(sha256Of(Buffer.from(joined.text)), o.sha256);
    assert.equal(envs[0].total.sha256, o.sha256);
  });
});

test('slice: --sha diferente sai 1, --slice fora do intervalo sai 2, --path fora de pt-evidence sai 2', () => {
  withRepo((repo) => {
    const o = runBig(repo);
    const base = ['slice', '--nonce', 'S1', '--path', o.path, '--cwd', fwd(repo)];
    const bad = runCli([...base, '--sha', 'a'.repeat(64), '--slice', '0']);
    assert.equal(bad.code, 1);
    assert.equal(JSON.parse(bad.stdout).tool, 'capture');
    assert.ok(JSON.parse(bad.stdout).error);
    for (const k of ['999', '-1', 'x']) {
      const r = runCli([...base, '--sha', o.sha256, '--slice', k]);
      assert.equal(r.code, 2, k);
    }
    const outside = path.join(repo, 'fora.txt');
    fs.writeFileSync(outside, 'x');
    const r = runCli(['slice', '--nonce', 'S1', '--path', fwd(outside), '--cwd', fwd(repo), '--sha', sha256Of('x'), '--slice', '0']);
    assert.equal(r.code, 2);
    const trav = runCli(['slice', '--nonce', 'S1', '--path', `${gitDirOf(repo)}/pt-evidence/../config`, '--cwd', fwd(repo), '--sha', sha256Of('x'), '--slice', '0']);
    assert.equal(trav.code, 2);
  });
});

test('slice: --path /tmp/x no win32 injetado da o erro msys e saida 2', () => {
  withRepo((repo) => {
    const res = runCapture(['slice', '--nonce', 'S1', '--path', '/tmp/x', '--cwd', fwd(repo), '--sha', 'a'.repeat(64), '--slice', '0'],
      { platform: 'win32', env: cleanEnv() });
    assert.equal(res.code, 2);
    assert.deepEqual(JSON.parse(res.line), {
      tool: 'capture',
      error: 'caminho no estilo msys (/tmp/...) não é aceito no Windows; use C:/...',
    });
  });
});

test('prune: apaga so as pastas do prefixo e imprime a linha assinada', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    for (const d of ['E41-T1', 'E41-T2', 'E40-T1']) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
      fs.writeFileSync(path.join(root, d, '0001-stdout.txt'), 'x');
    }
    const r = runCli(['prune', '--task-prefix', 'E41-', '--cwd', fwd(repo)]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    const o = JSON.parse(r.stdout);
    assert.deepEqual(o, { tool: 'capture', command: 'prune', removed: ['E41-T1', 'E41-T2'], removedReview: [], swept: [], digest: o.digest });
    assert.equal(fnv1a(JSON.stringify(canon({ tool: o.tool, command: o.command, removed: o.removed, removedReview: o.removedReview, swept: o.swept }))), o.digest);
    assert.equal(fs.existsSync(path.join(root, 'E41-T1')), false);
    assert.equal(fs.existsSync(path.join(root, 'E41-T2')), false);
    assert.equal(fs.existsSync(path.join(root, 'E40-T1')), true);
  });
});

test('prune: o prefixo api- apaga api-T1 e api-gate e mantem api-v2-T1; E4- nao toca E41-T1', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    for (const d of ['api-T1', 'api-gate', 'api-v2-T1', 'api-v2-gate', 'E41-T1']) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
      fs.writeFileSync(path.join(root, d, '0001-stdout.txt'), 'x'); // pasta vazia seria apagada pela varredura
    }
    const r = runCli(['prune', '--task-prefix', 'api-', '--cwd', fwd(repo)]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.deepEqual(JSON.parse(r.stdout).removed, ['api-T1', 'api-gate']);
    assert.equal(fs.existsSync(path.join(root, 'api-v2-T1')), true);
    assert.equal(fs.existsSync(path.join(root, 'api-v2-gate')), true);
    const r2 = runCli(['prune', '--task-prefix', 'E4-', '--cwd', fwd(repo)]);
    assert.equal(r2.code, 0, r2.stderr + r2.stdout);
    assert.deepEqual(JSON.parse(r2.stdout).removed, []);
    assert.equal(fs.existsSync(path.join(root, 'E41-T1')), true);
  });
});

test('prune: prefixo vazio ou com / sai 2 e nada e apagado', () => {
  withRepo((repo) => {
    const dir = path.join(repo, '.git', 'pt-evidence', 'E41-T1');
    fs.mkdirSync(dir, { recursive: true });
    for (const p of ['', 'E41/', '../x', 'a\b']) {
      const r = runCli(['prune', '--task-prefix', p, '--cwd', fwd(repo)]);
      assert.equal(r.code, 2, JSON.stringify(p));
      assert.equal(JSON.parse(r.stdout).tool, 'capture');
    }
    const none = runCli(['prune', '--cwd', fwd(repo)]);
    assert.equal(none.code, 2);
    assert.equal(fs.existsSync(dir), true);
  });
});

const DAY = 24 * 3600 * 1000;
const ago = (p, days) => { const w = new Date(Date.now() - days * DAY); fs.utimesSync(p, w, w); };
const put = (root, rel, text = 'x') => {
  const p = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return p;
};

test('prune: remove review/<p>final.txt e mantem review/<p>v2-final.txt e review/outro-final.txt', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    for (const f of ['E41-final.txt', 'E41-worktree.diff', 'E41-v2-final.txt', 'outro-final.txt']) put(root, `review/${f}`);
    fs.mkdirSync(path.join(root, 'review', 'E41-sub'), { recursive: true });
    put(root, 'review/E41-sub/a.txt');
    const r = runCli(['prune', '--task-prefix', 'E41-', '--cwd', fwd(repo)]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    const o = JSON.parse(r.stdout);
    assert.deepEqual(o.removedReview, ['E41-final.txt', 'E41-worktree.diff']);
    assert.deepEqual(o.removed, []);
    const left = fs.readdirSync(path.join(root, 'review')).sort();
    assert.deepEqual(left, ['E41-sub', 'E41-v2-final.txt', 'outro-final.txt']);
    assert.equal(fnv1a(JSON.stringify(canon({ tool: o.tool, command: o.command, removed: o.removed, removedReview: o.removedReview, swept: o.swept }))), o.digest);
  });
});

test('prune com prefixo tambem varre arquivos com mais de 14 dias', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    const old = put(root, 'velha/0001-stdout.txt');
    const young = put(root, 'nova/0001-stdout.txt');
    ago(old, 15);
    ago(young, 13);
    const r = runCli(['prune', '--task-prefix', 'E41-', '--cwd', fwd(repo)]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(path.join(root, 'velha')), false);
    assert.equal(fs.existsSync(young), true);
  });
});

test('prune --older-than 1 remove so o que e antigo e lista os caminhos relativos', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    const old = put(root, 'E41-T1/0001-stdout.txt');
    const old2 = put(root, 'review/a-final.txt');
    const fresh = put(root, 'E41-T2/0001-stdout.txt');
    ago(old, 2);
    ago(old2, 3);
    const r = runCli(['prune', '--older-than', '1', '--cwd', fwd(repo)]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    const o = JSON.parse(r.stdout);
    assert.deepEqual(o, { tool: 'capture', command: 'prune', olderThan: 1, removed: ['E41-T1/0001-stdout.txt', 'review/a-final.txt'], digest: o.digest });
    assert.equal(fnv1a(JSON.stringify(canon({ tool: o.tool, command: o.command, olderThan: o.olderThan, removed: o.removed }))), o.digest);
    assert.equal(fs.existsSync(fresh), true);
    assert.equal(fs.existsSync(old), false);
  });
});

test('prune: --older-than com --task-prefix, ou valor invalido, sai 2 e nada e apagado', () => {
  withRepo((repo) => {
    const keep = put(path.join(repo, '.git', 'pt-evidence'), 'E41-T1/0001-stdout.txt');
    ago(keep, 30);
    for (const args of [['--older-than', '1', '--task-prefix', 'E41-'], ['--older-than', '-1'], ['--older-than', '1.5'], ['--older-than', 'x']]) {
      const r = runCli(['prune', ...args, '--cwd', fwd(repo)]);
      assert.equal(r.code, 2, args.join(' '));
      assert.equal(JSON.parse(r.stdout).tool, 'capture');
    }
    assert.equal(fs.existsSync(keep), true);
  });
});

test('prune: no win32 o prefixo ignora a caixa; em linux nao', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    put(root, 'E41-T1/0001-stdout.txt');
    put(root, 'review/E41-final.txt');
    const args = ['prune', '--task-prefix', 'e41-', '--cwd', fwd(repo)];
    const lin = runCapture(args, { platform: 'linux', env: cleanEnv() });
    assert.equal(lin.code, 0);
    assert.deepEqual([JSON.parse(lin.line).removed, JSON.parse(lin.line).removedReview], [[], []]);
    assert.equal(fs.existsSync(path.join(root, 'E41-T1')), true);
    const win = runCapture(args, { platform: 'win32', env: cleanEnv() });
    assert.equal(win.code, 0);
    const o = JSON.parse(win.line);
    assert.deepEqual([o.removed, o.removedReview], [['E41-T1'], ['E41-final.txt']]);
    assert.equal(fs.existsSync(path.join(root, 'E41-T1')), false);
  });
});

test('list: tarefas e review com contagens, bytes e newest corretos', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    put(root, 'E41-T1/0001-stdout.txt', 'abc');
    put(root, 'E41-T1/0001-stderr.txt', 'de');
    const t2 = put(root, 'E41-T2/0001-stdout.txt', 'f');
    put(root, 'review/E41-final.txt', 'gggg');
    ago(t2, 3);
    const r = runCli(['list', '--cwd', fwd(repo)]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    const o = JSON.parse(r.stdout);
    assert.equal(o.tool, 'capture');
    assert.equal(o.command, 'list');
    assert.equal(o.cut, undefined);
    const by = Object.fromEntries(o.tasks.map((t) => [t.name, t]));
    assert.deepEqual(Object.keys(by).sort(), ['E41-T1', 'E41-T2', 'review']);
    assert.deepEqual([by['E41-T1'].files, by['E41-T1'].bytes], [2, 5]);
    assert.deepEqual([by['E41-T2'].files, by['E41-T2'].bytes], [1, 1]);
    assert.deepEqual([by.review.files, by.review.bytes], [1, 4]);
    assert.equal(by['E41-T2'].newest, new Date(fs.statSync(t2).mtimeMs).toISOString());
    assert.equal(o.tasks[o.tasks.length - 1].name, 'E41-T2');
    assert.equal(fnv1a(JSON.stringify(canon({ tool: o.tool, command: o.command, tasks: o.tasks }))), o.digest);
  });
});

test('list: sem pt-evidence devolve tasks vazio; passando do limite corta e informa cut', () => {
  withRepo((repo) => {
    const empty = JSON.parse(runCli(['list', '--cwd', fwd(repo)]).stdout);
    assert.deepEqual(empty.tasks, []);
    const root = path.join(repo, '.git', 'pt-evidence');
    for (let i = 0; i < 80; i++) {
      const p = put(root, `plano-longo-${String(i).padStart(3, '0')}-T1/0001-stdout.txt`);
      ago(p, i / 10);
    }
    const r = runCli(['list', '--cwd', fwd(repo)]);
    assert.equal(r.code, 0, r.stderr);
    const line = r.stdout.trim();
    assert.ok(utf8Length(line) <= MAX_COPY_BYTES);
    const o = JSON.parse(line);
    assert.ok(o.cut > 0);
    assert.equal(o.tasks.length + o.cut, 80);
    assert.equal(o.tasks[0].name, 'plano-longo-000-T1');
  });
});

test('prune --task-prefix: swept lista os arquivos que a varredura de 14 dias apagou', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    ago(put(root, 'velha/0001-stdout.txt'), 15);
    ago(put(root, 'review/outro-final.txt'), 20);
    put(root, 'nova/0001-stdout.txt');
    put(root, 'E41-T1/0001-stdout.txt');
    const o = JSON.parse(runCli(['prune', '--task-prefix', 'E41-', '--cwd', fwd(repo)]).stdout);
    assert.deepEqual(o.removed, ['E41-T1']);
    assert.deepEqual(o.swept, ['review/outro-final.txt', 'velha/0001-stdout.txt']);
    assert.equal(fnv1a(JSON.stringify(canon({ tool: o.tool, command: o.command, removed: o.removed, removedReview: o.removedReview, swept: o.swept }))), o.digest);
  });
});

test('sweep: pasta vazia recem-criada fica (corrida com mkdir); pasta vazia antiga some', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    fs.mkdirSync(path.join(root, 'fresca'), { recursive: true });
    fs.mkdirSync(path.join(root, 'review'), { recursive: true });
    fs.mkdirSync(path.join(root, 'antiga-vazia'), { recursive: true });
    ago(path.join(root, 'antiga-vazia'), 15);
    const r = runCli(['prune', '--task-prefix', 'E41-', '--cwd', fwd(repo)]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.equal(fs.existsSync(path.join(root, 'fresca')), true);
    assert.equal(fs.existsSync(path.join(root, 'review')), true);
    assert.equal(fs.existsSync(path.join(root, 'antiga-vazia')), false);
    const r2 = runCli(['run', '--nonce', 'N1', '--task', 'E41-T1', '--cwd', fwd(repo), '--', 'node', '-e', '1']);
    assert.equal(r2.code, 0, r2.stderr);
    assert.equal(fs.existsSync(path.join(root, 'fresca')), true);
  });
});

const digestOk = (o) => { const { digest, ...rest } = o; return fnv1a(JSON.stringify(canon(rest))) === digest; };
function manyOld(root, n, days) {
  for (let i = 0; i < n; i++) ago(put(root, `sobra-${String(i).padStart(4, '0')}/arquivo-com-nome-comprido-${i}-stdout.txt`), days);
}

test('prune --task-prefix: swept passa do limite de copia e sai cortado com sweptCut e digest valido', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    manyOld(root, 400, 20);
    const line = runCli(['prune', '--task-prefix', 'E41-', '--cwd', fwd(repo)]).stdout.trim();
    assert.ok(utf8Length(line) <= MAX_COPY_BYTES);
    const o = JSON.parse(line);
    assert.ok(o.sweptCut > 0);
    assert.equal(o.swept.length + o.sweptCut, 400);
    assert.equal(o.swept[0], 'sobra-0000/arquivo-com-nome-comprido-0-stdout.txt');
    assert.ok(digestOk(o));
  });
});

test('prune --older-than: removed passa do limite de copia e sai cortado com removedCut e digest valido', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    manyOld(root, 400, 20);
    const line = runCli(['prune', '--older-than', '1', '--cwd', fwd(repo)]).stdout.trim();
    assert.ok(utf8Length(line) <= MAX_COPY_BYTES);
    const o = JSON.parse(line);
    assert.ok(o.removedCut > 0);
    assert.equal(o.removed.length + o.removedCut, 400);
    assert.ok(digestOk(o));
  });
});

test('prune: sem corte, sweptCut e removedCut nao aparecem', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    manyOld(root, 3, 20);
    const a = JSON.parse(runCli(['prune', '--task-prefix', 'E41-', '--cwd', fwd(repo)]).stdout);
    assert.equal(a.swept.length, 3);
    assert.ok(!('sweptCut' in a) && !('removedCut' in a) && !('removedReviewCut' in a));
    manyOld(root, 3, 20);
    const b = JSON.parse(runCli(['prune', '--older-than', '1', '--cwd', fwd(repo)]).stdout);
    assert.equal(b.removed.length, 3);
    assert.ok(!('removedCut' in b));
  });
});

test('prune e list: --nonce opcional entra no objeto assinado e e validado', () => {
  withRepo((repo) => {
    const root = path.join(repo, '.git', 'pt-evidence');
    put(root, 'E41-T1/0001-stdout.txt');
    const l = JSON.parse(runCli(['list', '--nonce', 'L:1', '--cwd', fwd(repo)]).stdout);
    assert.equal(l.nonce, 'L:1');
    assert.equal(fnv1a(JSON.stringify(canon({ tool: l.tool, command: l.command, nonce: l.nonce, tasks: l.tasks }))), l.digest);
    const noNonce = JSON.parse(runCli(['list', '--cwd', fwd(repo)]).stdout);
    assert.equal('nonce' in noNonce, false);
    assert.notEqual(noNonce.digest, l.digest);
    const p = JSON.parse(runCli(['prune', '--older-than', '1', '--nonce', 'P-1', '--cwd', fwd(repo)]).stdout);
    assert.equal(p.nonce, 'P-1');
    assert.equal(fnv1a(JSON.stringify(canon({ tool: p.tool, command: p.command, nonce: p.nonce, olderThan: p.olderThan, removed: p.removed }))), p.digest);
    const q = JSON.parse(runCli(['prune', '--task-prefix', 'E41-', '--nonce', 'P2', '--cwd', fwd(repo)]).stdout);
    assert.equal(q.nonce, 'P2');
    assert.equal(fnv1a(JSON.stringify(canon({ tool: q.tool, command: q.command, nonce: q.nonce, removed: q.removed, removedReview: q.removedReview, swept: q.swept }))), q.digest);
    for (const args of [['list'], ['prune', '--older-than', '1']]) {
      const bad = runCli([...args, '--nonce', 'a b', '--cwd', fwd(repo)]);
      assert.equal(bad.code, 2);
      assert.match(JSON.parse(bad.stdout).error, /--nonce/);
    }
  });
});

test('slice: prefixo de 12 caracteres confere, 64 continua valendo, saida traz total.sha256 completo', () => {
  withRepo((repo) => {
    const o = runBig(repo);
    const base = ['slice', '--nonce', 'S1', '--path', o.path, '--cwd', fwd(repo), '--slice', '0'];
    for (const sha of [o.sha256.slice(0, 12), o.sha256.slice(0, 40), o.sha256]) {
      const r = runCli([...base, '--sha', sha]);
      assert.equal(r.code, 0, r.stderr + r.stdout);
      assert.equal(JSON.parse(r.stdout).total.sha256, o.sha256);
    }
  });
});

test('slice: prefixo errado sai 1; menos de 12, maiusculas, nao-hex ou acima de 64 saem 2', () => {
  withRepo((repo) => {
    const o = runBig(repo);
    const base = ['slice', '--nonce', 'S1', '--path', o.path, '--cwd', fwd(repo), '--slice', '0'];
    const wrong = runCli([...base, '--sha', '0'.repeat(12)]);
    assert.equal(wrong.code, 1, wrong.stdout);
    assert.match(JSON.parse(wrong.stdout).error, /não confere/);
    for (const sha of [o.sha256.slice(0, 11), o.sha256.slice(0, 12).toUpperCase(), 'g'.repeat(12), `${o.sha256}0`]) {
      const r = runCli([...base, '--sha', sha]);
      assert.equal(r.code, 2, sha);
      assert.match(JSON.parse(r.stdout).error, /prefixo sha256 hexadecimal minúsculo de 12 a 64/);
    }
  });
});

test('run --brief: sem tail e tailCut, digest confere pela regra do workflow e cmdDigest nao depende do flag', () => {
  withRepo((repo) => {
    const gen = ['node', '-e', "for (let i = 0; i < 100; i++) console.log('l' + i)"];
    const plain = runCli(['run', '--nonce', 'B1', '--task', 'E39-B', '--cwd', fwd(repo), '--', ...gen]);
    const brief = runCli(['run', '--nonce', 'B1', '--task', 'E39-B', '--cwd', fwd(repo), '--brief', '--', ...gen]);
    const op = JSON.parse(plain.stdout);
    const ob = JSON.parse(brief.stdout);
    assert.ok('tail' in op && 'tailCut' in op);
    assert.ok(!('tail' in ob) && !('tailCut' in ob));
    assert.equal(ob.cmdDigest, op.cmdDigest);
    assert.equal(ob.cmdDigest, commandDigest({ argv: gen }));
    assert.equal(ob.lines, 100);
    assert.equal(ob.exit, 0);
    assert.ok(digestOk(ob));
    assert.equal(checkCapture(brief.stdout, { nonce: 'B1', cmdDigest: commandDigest({ argv: gen }) }).ok, true);
    const { tail, tailCut, digest, path: p1, stderrPath: e1, ...rest } = op;
    const { digest: d2, path: p2, stderrPath: e2, ...restBrief } = ob;
    assert.notEqual(digest, d2);
    assert.deepEqual(restBrief, rest);
  });
});

test('run --brief com --bash e com --tests: sem tail, cmdDigest igual ao sem --brief', () => {
  withRepo((repo) => {
    const a = JSON.parse(runCli(['run', '--nonce', 'B2', '--task', 'E39-B', '--cwd', fwd(repo), '--bash', 'echo oi; exit 4']).stdout);
    const b = JSON.parse(runCli(['run', '--nonce', 'B2', '--task', 'E39-B', '--cwd', fwd(repo), '--brief', '--bash', 'echo oi; exit 4']).stdout);
    assert.equal(b.exit, 4);
    assert.ok(!('tail' in b) && !('tailCut' in b));
    assert.equal(b.cmdDigest, a.cmdDigest);
    assert.equal(b.cmdDigest, commandDigest({ bash: 'echo oi; exit 4' }));
    assert.ok(digestOk(b));
    const file = path.join(repo, 'big.test.js');
    fs.writeFileSync(file, SUITE_63);
    const t = runCli(['run', '--nonce', 'B3', '--task', 'E39-B', '--cwd', fwd(repo), '--tests', '--brief', '--', 'node', '--test', file]);
    const ot = JSON.parse(t.stdout);
    assert.ok(!('tail' in ot) && !('tailCut' in ot));
    assert.deepEqual(ot.extract.failedNames, ['FAIL_A', 'FAIL_B', 'FAIL_C']);
    assert.ok(digestOk(ot));
    assert.equal(checkCapture(t.stdout, { nonce: 'B3' }).ok, true);
  });
});

function taskDirOf(repo, task) {
  return path.join(repo, '.git', 'pt-evidence', task);
}

test('E42 checkCapture: a wrong nonce and a wrong cmdDigest return expected and got', () => {
  withRepo((repo) => {
    const r = runCli(['run', '--nonce', 'E42N', '--task', 'E42-T3', '--cwd', fwd(repo), '--bash', 'echo oi']);
    assert.equal(r.code, 0, r.stderr);
    const o = JSON.parse(r.stdout);
    const cmdDigest = commandDigest({ bash: 'echo oi' });
    assert.equal(o.cmdDigest, cmdDigest);
    assert.deepEqual(checkCapture(r.stdout, { nonce: 'OUTRO', cmdDigest }), {
      ok: false, why: 'the nonce of the output is not the one of this run', expected: 'OUTRO', got: o.nonce,
    });
    const other = commandDigest({ bash: 'echo outro' });
    assert.notEqual(other, o.cmdDigest);
    assert.deepEqual(checkCapture(r.stdout, { nonce: 'E42N', cmdDigest: other }), {
      ok: false, why: 'the output is not from the expected command', expected: other, got: o.cmdDigest,
    });
  });
});

test('run grava <seq>-line.json igual a linha impressa, com e sem --brief', () => {
  withRepo((repo) => {
    const a = runCli(['run', '--nonce', 'L1', '--task', 'E39-L', '--cwd', fwd(repo), '--bash', 'echo oi']);
    const b = runCli(['run', '--nonce', 'L2', '--task', 'E39-L', '--cwd', fwd(repo), '--brief', '--bash', 'echo oi']);
    const dir = taskDirOf(repo, 'E39-L');
    assert.deepEqual(fs.readdirSync(dir).sort(), ['0001-line.json', '0001-stderr.txt', '0001-stdout.txt', '0002-line.json', '0002-stderr.txt', '0002-stdout.txt']);
    assert.equal(fs.readFileSync(path.join(dir, '0001-line.json'), 'utf8').replace(/\n$/, ''), a.stdout.replace(/\n$/, ''));
    assert.equal(fs.readFileSync(path.join(dir, '0002-line.json'), 'utf8').replace(/\n$/, ''), b.stdout.replace(/\n$/, ''));
  });
});

const pairsRun = (repo, nonce, bash) => runCli(['run', '--nonce', nonce, '--task', 'E39-P', '--cwd', fwd(repo), '--brief', '--bash', bash]);
const pairsCli = (repo, prefix = 'P', extra = []) => {
  const r = runCli(['pairs', '--nonce', 'PN', '--task', 'E39-P', '--prefix', prefix, '--cwd', fwd(repo), ...extra]);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  return { raw: r.stdout, o: JSON.parse(r.stdout) };
};

test('pairs: comandos diferentes nao fazem par e a linha e curta', () => {
  withRepo((repo) => {
    pairsRun(repo, 'P1', 'exit 1');
    pairsRun(repo, 'P2', 'exit 1');
    pairsRun(repo, 'P3', 'exit 0');
    const { o, raw } = pairsCli(repo);
    assert.equal(o.tool, 'capture');
    assert.equal(o.command, 'pairs');
    assert.equal(o.nonce, 'PN');
    assert.equal(o.task, 'E39-P');
    assert.equal(o.runs, 3);
    assert.equal(o.pair, false);
    assert.ok(utf8Length(raw) < MAX_COPY_BYTES / 4);
  });
});

test('pairs: dupla do mesmo comando e conferida pelo checkCapture e pela regra de digest', () => {
  withRepo((repo) => {
    pairsRun(repo, 'P1', 'exit 3');
    pairsRun(repo, 'P2', 'exit 0');
    const { o, raw } = pairsCli(repo);
    assert.equal(o.pair, false);
    // mesmo comando: usa um arquivo que muda de estado
    const flag = fwd(path.join(repo, 'flag'));
    const cmd = `test -f ${flag}`;
    pairsRun(repo, 'P3', cmd);
    fs.writeFileSync(flag, 'x');
    pairsRun(repo, 'P4', cmd);
    const r = pairsCli(repo);
    assert.equal(r.o.runs, 4);
    assert.equal(r.o.pair, true);
    assert.equal(r.o.red, 'P3');
    assert.equal(r.o.green, 'P4');
    assert.equal(r.o.cmdDigest, commandDigest({ bash: cmd }));
    assert.ok(digestOk(r.o));
    assert.equal(checkCapture(r.raw, { nonce: 'PN' }).ok, true);
    assert.ok(raw.length > 0);
  });
});

test('pairs: so verde, verde antes do vermelho e cmdDigest diferente nao fazem par', () => {
  withRepo((repo) => {
    const flag = fwd(path.join(repo, 'flag'));
    const cmd = `test -f ${flag}`;
    fs.writeFileSync(flag, 'x');
    pairsRun(repo, 'P1', cmd);
    assert.deepEqual([pairsCli(repo).o.runs, pairsCli(repo).o.pair, pairsCli(repo).o.red, pairsCli(repo).o.green, pairsCli(repo).o.cmdDigest], [1, false, null, null, null]);
    fs.rmSync(flag);
    pairsRun(repo, 'P2', cmd);
    assert.equal(pairsCli(repo).o.pair, false);
    pairsRun(repo, 'P3', 'exit 1');
    pairsRun(repo, 'P4', 'exit 0');
    assert.equal(pairsCli(repo).o.pair, false);
  });
});

test('pairs: linha de outro prefixo e line.json adulterado sao ignorados; pasta inexistente da runs 0', () => {
  withRepo((repo) => {
    const flag = fwd(path.join(repo, 'flag'));
    const cmd = `test -f ${flag}`;
    runCli(['run', '--nonce', 'X1', '--task', 'E39-P', '--cwd', fwd(repo), '--brief', '--bash', cmd]);
    fs.writeFileSync(flag, 'x');
    pairsRun(repo, 'P2', cmd);
    let o = pairsCli(repo).o;
    assert.equal(o.runs, 1);
    assert.equal(o.pair, false);
    fs.rmSync(flag);
    pairsRun(repo, 'P3', cmd);
    fs.writeFileSync(flag, 'x');
    pairsRun(repo, 'P4', cmd);
    const dir = taskDirOf(repo, 'E39-P');
    const file = path.join(dir, '0004-line.json');
    const text = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, text.replace('"exit":0', '"exit":1'));
    o = pairsCli(repo).o;
    assert.equal(o.runs, 2);
    assert.equal(o.pair, false);
    fs.writeFileSync(file, 'nao e json');
    assert.equal(pairsCli(repo).o.runs, 2);
    const none = runCli(['pairs', '--nonce', 'PN', '--task', 'sem-pasta', '--prefix', 'P', '--cwd', fwd(repo)]);
    assert.equal(none.code, 0);
    const on = JSON.parse(none.stdout);
    assert.deepEqual([on.runs, on.pair, on.red, on.green, on.cmdDigest], [0, false, null, null, null]);
    assert.ok(digestOk(on));
  });
});

test('pairs: flags faltando saem 2 com {tool, error}', () => {
  withRepo((repo) => {
    for (const args of [['--task', 'T', '--prefix', 'P'], ['--nonce', 'N', '--prefix', 'P'], ['--nonce', 'N', '--task', 'T']]) {
      const r = runCli(['pairs', ...args, '--cwd', fwd(repo)]);
      assert.equal(r.code, 2);
      const o = JSON.parse(r.stdout);
      assert.equal(o.tool, 'capture');
      assert.ok(typeof o.error === 'string');
    }
  });
});

test('E44 AC2: tail sem ANSI e stdout.txt intacto', () => {
  withRepo((repo) => {
    const script = path.join(repo, 'color.js');
    fs.writeFileSync(script, "for (let i = 0; i < 3; i++) console.log('\x1b[32m✔ ok ' + i + '\x1b[39m');\n");
    const direct = spawnSync(process.execPath, [script], { cwd: repo });
    assert.equal(direct.status, 0);
    const r = runCli(['run', '--nonce', 'E44A', '--task', 'E44-T2', '--cwd', fwd(repo), '--', 'node', script]);
    assert.equal(r.code, 0, r.stderr);
    const o = JSON.parse(r.stdout);
    assert.ok(!o.tail.includes('\x1b'), JSON.stringify(o.tail));
    assert.equal(o.tail, '✔ ok 0\n✔ ok 1\n✔ ok 2');
    const saved = fs.readFileSync(o.path);
    assert.ok(saved.includes(0x1b));
    assert.equal(sha256Of(saved), o.sha256);
    assert.equal(o.sha256, sha256Of(direct.stdout));
    assert.equal(o.bytes, direct.stdout.length);
    assert.equal(o.lines, countLines(direct.stdout));
    const chk = checkCapture(r.stdout, { nonce: 'E44A' });
    assert.equal(chk.ok, true, chk.why);
  });
});

test('E44 C5: o filho recebe NO_COLOR=1 e FORCE_COLOR=0', () => {
  withRepo((repo) => {
    const script = path.join(repo, 'env.js');
    fs.writeFileSync(script, "console.log(process.env.NO_COLOR + ' ' + process.env.FORCE_COLOR);\n");
    const env = { ...cleanEnv(), FORCE_COLOR: '1' };
    const r = runCapture(['run', '--nonce', 'E44B', '--task', 'E44-T2', '--cwd', fwd(repo), '--', 'node', script], { env });
    assert.equal(r.code, 0, r.line);
    assert.equal(JSON.parse(r.line).tail, '1 0');
  });
});

test('E44 C4: portao vitest vermelho com --tests, com e sem --brief', () => {
  withRepo((repo) => {
    const script = path.join(repo, 'vitest-red.js');
    const summary = '      \x1b[2mTests \x1b[22m \x1b[1m\x1b[31m1 failed\x1b[39m\x1b[22m\x1b[2m | \x1b[22m\x1b[1m\x1b[32m2 passed\x1b[39m\x1b[22m'
      + '\x1b[2m | \x1b[22m\x1b[33m1 skipped\x1b[39m\x1b[2m | \x1b[22m\x1b[90m1 todo\x1b[39m\x1b[90m (5)\x1b[39m';
    fs.writeFileSync(script, `console.log(${JSON.stringify(summary)}); process.exitCode = 1;\n`);
    const direct = spawnSync(process.execPath, [script], { cwd: repo });
    assert.equal(direct.status, 1);
    for (const [nonce, extra] of [['E44C', []], ['E44D', ['--brief']]]) {
      const r = runCli(['run', '--nonce', nonce, '--task', 'E44-T2', '--cwd', fwd(repo), '--tests', ...extra, '--', 'node', script]);
      assert.equal(r.code, 1, r.stderr);
      const o = JSON.parse(r.stdout);
      assert.equal(o.exit, 1);
      assert.deepEqual(o.extract, { format: 'vitest', exit: 1, total: 5, pass: 2, fail: 1, skipped: 1, failedNames: null, failedNamesCut: 0 });
      assert.equal(o.bytes, direct.stdout.length);
      assert.equal(o.sha256, sha256Of(direct.stdout));
      assert.equal(o.lines, countLines(direct.stdout));
      const chk = checkCapture(r.stdout, { nonce });
      assert.equal(chk.ok, true, chk.why);
      if (extra.length) assert.ok(!('tail' in o));
      else {
        assert.ok(!o.tail.includes('\x1b'), JSON.stringify(o.tail));
        assert.match(o.tail, /Tests {2}1 failed \| 2 passed \| 1 skipped \| 1 todo \(5\)/);
      }
    }
  });
});
