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

// ---------- CLI (Tarefa 3): núcleo e comandos de leitura ----------

import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { run, nextId } from './roadmap.mjs';

const ROADMAP = path.join(here, 'roadmap.mjs');
const GIT_ID = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'];

function sh(cwd, ...args) {
  const r = spawnSync('git', [...GIT_ID, ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

// Copia fixtures/valid/ para base/roadmap (base é temporário e some no fim).
function makeFolder(t, { eol = '\n', bom = false, nfdLine = false, git = false, mutate = {} } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-cli-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const dir = path.join(base, 'roadmap');
  fs.cpSync(validDir, dir, { recursive: true });
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    let text = fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n?/g, '\n');
    if (nfdLine && name === 'state.md') text = text.replace('# State', '# State Café');
    if (mutate[name]) text = mutate[name](text);
    text = text.replace(/\n/g, eol);
    if (bom && name === 'state.md') text = '﻿' + text;
    fs.writeFileSync(path.join(dir, name), text);
  }
  const shas = {};
  if (git) {
    sh(dir, 'init', '-q', '-b', 'main');
    sh(dir, 'add', '.');
    sh(dir, 'commit', '-q', '-m', 'init');
    shas.main = sh(dir, 'rev-parse', 'HEAD');
    sh(dir, 'checkout', '-q', '-b', 'side');
    sh(dir, 'commit', '-q', '--allow-empty', '-m', 'side');
    shas.side = sh(dir, 'rev-parse', 'HEAD');
    sh(dir, 'checkout', '-q', 'main');
  }
  return {
    base,
    dir,
    shas,
    read: (name) => fs.readFileSync(path.join(dir, name), 'utf8'),
    write: (name, text) => fs.writeFileSync(path.join(dir, name), text),
  };
}

const cli = (dir, ...args) => run([args[0], dir, ...args.slice(1), '--json']);
const spawnCli = (...args) => spawnSync(process.execPath, [ROADMAP, ...args], { encoding: 'utf8' });

function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.name === '.git') continue;
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = fs.readFileSync(p).toString('base64');
    }
  };
  walk(dir);
  return out;
}

test('status lê o painel da fixture sem gravar', (t) => {
  const f = makeFolder(t);
  const before = snapshot(f.dir);
  const { exitCode, output } = cli(f.dir, 'status');
  assert.equal(exitCode, 0);
  assert.equal(output.tool, 'roadmap');
  assert.equal(output.command, 'status');
  assert.deepEqual(output.changed, []);
  assert.equal(output.result.panel.length, 3);
  assert.deepEqual(output.result.panel[0].segments[0], { label: '', word: 'spec', position: 2, note: '' });
  assert.equal(output.result.panel[0].id, 'E1');
  assert.equal(output.result.strategy.version, '1.0');
  assert.equal(output.result.now.length, 3);
  assert.equal(output.result.pending.length, 1);
  assert.deepEqual(output.result.blockers, []);
  assert.deepEqual(snapshot(f.dir), before);
});

function maxIn(dir, strategy, re) {
  let max = 0;
  const files = Object.keys(snapshot(dir)).map((n) => path.join(dir, n));
  for (const file of [...files, strategy]) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(re)) max = Math.max(max, Number(m[1]));
  }
  return max;
}

test('brief resume a pasta e calcula os próximos identificadores', (t) => {
  const f = makeFolder(t);
  const strategy = path.join(f.dir, 'strategy.md');
  const { exitCode, output } = cli(f.dir, 'brief');
  assert.equal(exitCode, 0);
  const pad = (n, w) => String(n).padStart(w, '0');
  assert.deepEqual(output.result.nextIds, {
    DEC: 'DEC-002',
    BLQ: 'BLQ-1',
    REQ: `REQ-${pad(maxIn(f.dir, strategy, /\bREQ-(\d+)\b/g) + 1, 3)}`,
    SRC: `SRC-${pad(maxIn(f.dir, strategy, /\bSRC-(\d+)\b/g) + 1, 2)}`,
    E: `E${maxIn(f.dir, strategy, /\bE(\d+)\b/g) + 1}`,
  });
  assert.equal(output.result.checker.errors, 0);
  assert.equal(output.result.formatVersion, 1);
  assert.deepEqual(output.result.deliverablesByStatus, { spec: ['E1'], 'not-started': ['E2', 'E3'] });
  assert.equal(output.result.pendingCount, 1);
  assert.deepEqual(output.result.openBlockers, []);
});

test('next-id varre qualquer arquivo da pasta, não só os acompanhados', (t) => {
  const f = makeFolder(t);
  fs.mkdirSync(path.join(f.dir, 'notes'));
  fs.writeFileSync(path.join(f.dir, 'notes', 'extra.txt'), 'um bloqueio antigo: BLQ-7\n');
  assert.equal(cli(f.dir, 'next-id', 'BLQ').output.result.id, 'BLQ-8');
  assert.equal(nextId(f.dir, path.join(f.dir, 'strategy.md'), 'DEC'), 'DEC-002');
  assert.equal(cli(f.dir, 'next-id', 'XYZ').exitCode, 2);
  assert.equal(cli(f.dir, 'next-id').exitCode, 2);
});

test('next-id lê a estratégia fora da pasta', (t) => {
  const f = makeFolder(t);
  const outside = path.join(f.base, 'strategy.md');
  fs.writeFileSync(outside, `${fs.readFileSync(path.join(f.dir, 'strategy.md'), 'utf8')}\nBLQ-9 fechado.\n`);
  fs.rmSync(path.join(f.dir, 'strategy.md'));
  const cfgFile = path.join(f.dir, 'roadmap.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  cfg.strategy = '../strategy.md';
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  const { exitCode, output } = cli(f.dir, 'next-id', 'BLQ');
  assert.equal(exitCode, 0, JSON.stringify(output.errors));
  assert.equal(output.result.id, 'BLQ-10');
});

test('pending-decisions lista decisão do executor pendente com alcance', (t) => {
  const row = '| DEC-002 | 2026-01-03 | E2 | Use SQLite. Scope: contract. | - | - | - | executor | pending |';
  const f = makeFolder(t, {
    mutate: { 'decisions.md': (x) => x.replace('<!-- /roadmap:decisions -->', `${row}\n<!-- /roadmap:decisions -->`) },
  });
  const { exitCode, output } = cli(f.dir, 'pending-decisions');
  assert.equal(exitCode, 0);
  assert.equal(output.result.decisions.length, 1);
  const d = output.result.decisions[0];
  assert.equal(d.id, 'DEC-002');
  assert.equal(d.deliverable, 'E2');
  assert.equal(d.scope, 'contract');
  assert.equal(d.released, false);
  assert.equal(cli(f.dir, 'brief').output.result.pendingDecisions[0].id, 'DEC-002');
});

test('verify-commit separa existência e integração', (t) => {
  const f = makeFolder(t, { git: true });
  const main = cli(f.dir, 'verify-commit', f.shas.main);
  assert.equal(main.exitCode, 0);
  assert.equal(main.output.result.exists, true);
  assert.equal(main.output.result.integrated, true);
  const side = cli(f.dir, 'verify-commit', f.shas.side);
  assert.equal(side.output.result.exists, true);
  assert.equal(side.output.result.integrated, false);
  const none = cli(f.dir, 'verify-commit', '0000000');
  assert.equal(none.exitCode, 0);
  assert.equal(none.output.result.exists, false);
  assert.equal(none.output.result.integrated, false);
});

test('sem git: leitura funciona com aviso no-git e verify-commit não é erro', (t) => {
  const f = makeFolder(t);
  const st = cli(f.dir, 'status');
  assert.equal(st.exitCode, 0);
  assert.ok(st.output.warnings.some((w) => w.code === 'no-git'));
  const v = cli(f.dir, 'verify-commit', 'abcdef1');
  assert.equal(v.exitCode, 0);
  assert.equal(v.output.result.exists, null);
  assert.equal(v.output.result.integrated, null);
  assert.ok(v.output.result.reason);
  assert.ok(v.output.warnings.some((w) => w.code === 'no-git'));
});

test('uso inválido sai 2 sem alterar a pasta', (t) => {
  const f = makeFolder(t);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-cli-'));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const before = snapshot(f.dir);
  const cases = [
    [cli(f.dir, 'nope'), 'usage'],
    [cli(f.dir, 'status', '--bogus', 'x'), 'usage'],
    [run(['status', empty, '--json']), 'not-found'],
    [run(['log', f.dir, '--what']), 'usage'],
    [cli(f.dir, 'status', '--date', '2026-13-40'), 'usage'],
  ];
  for (const [r, code] of cases) {
    assert.equal(r.exitCode, 2);
    assert.equal(r.output.errors[0].code, code);
    assert.equal(r.output.summary.exitCode, 2);
    assert.deepEqual(r.output.changed, []);
  }
  assert.deepEqual(snapshot(f.dir), before);
  assert.deepEqual(snapshot(empty), {});
});

test('formatVersion maior que o do plugin: format-newer, exit 1', (t) => {
  const f = makeFolder(t);
  const cfgFile = path.join(f.dir, 'roadmap.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  cfg.formatVersion = 99;
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  const r = cli(f.dir, 'status');
  assert.equal(r.exitCode, 1);
  assert.equal(r.output.errors[0].code, 'format-newer');
});

test('processo: status em texto e em JSON, mesmo código de saída', (t) => {
  const f = makeFolder(t);
  const txt = spawnCli('status', f.dir);
  assert.equal(txt.status, 0, txt.stderr);
  const last = txt.stdout.trim().split('\n').pop();
  assert.match(last, /^roadmap status: changed 0 file\(s\), 0 error\(s\), \d+ warning\(s\)$/);
  const js = spawnCli('status', f.dir, '--json');
  assert.equal(js.status, 0, js.stderr);
  assert.equal(JSON.parse(js.stdout).tool, 'roadmap');
  assert.equal(spawnCli('status', f.dir, '--bogus').status, 2);
  assert.equal(spawnCli('status', f.dir, '--bogus', '--json').status, 2);
});

test('processo: --help lista os 18 comandos', () => {
  const r = spawnCli('--help');
  assert.equal(r.status, 0, r.stderr);
  const names = ['status', 'brief', 'next-id', 'pending-decisions', 'verify-commit', 'log', 'set-status', 'integrate',
    'block-open', 'block-close', 'prune', 'refresh-checker', 'add-decision', 'add-pending', 'inflight-add',
    'inflight-remove', 'ratify', 'reject'];
  assert.equal(names.length, 18);
  for (const n of names) assert.ok(r.stdout.includes(n), n);
});
