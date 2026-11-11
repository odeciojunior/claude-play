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

// ---------- CLI (Tarefa 4): transação de escrita, log, set-status, integrate ----------

const lineSplit = (s) => s.split(/\r\n|\r|\n/);

// Linhas de `after` menos as de `before`: devem ser exatamente as linhas inseridas/trocadas.
function lineDiff(before, after) {
  const b = lineSplit(before);
  const a = lineSplit(after);
  let i = 0;
  while (i < b.length && i < a.length && b[i] === a[i]) i++;
  let j = 0;
  while (j < b.length - i && j < a.length - i && b[b.length - 1 - j] === a[a.length - 1 - j]) j++;
  return { removed: b.slice(i, b.length - j), added: a.slice(i, a.length - j) };
}

const refused = (r, code, exit = 1) => {
  assert.equal(r.exitCode, exit, JSON.stringify(r.output.errors));
  assert.equal(r.output.errors[0].code, code);
  assert.deepEqual(r.output.changed, []);
  assert.equal(r.output.summary.exitCode, exit);
};

test('log insere a linha no lugar da data, com crase na evidência', (t) => {
  const f = makeFolder(t);
  const before = f.read('log.md');
  const r = cli(f.dir, 'log', '--deliverable', 'E1', '--what', 'Spec written', '--evidence', 'docs/spec-e1.md', '--date', '2026-01-03');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.changed, ['log.md']);
  const d = lineDiff(before, f.read('log.md'));
  assert.deepEqual(d.removed, []);
  assert.deepEqual(d.added, ['| 2026-01-03 | E1 | Spec written | `docs/spec-e1.md` |']);
  const lines = lineSplit(f.read('log.md'));
  assert.equal(lines.indexOf(d.added[0]), lines.findIndex((l) => l.startsWith('| 2026-01-02')) - 1);
  // data mais antiga: entra antes da linha de 2026-01-01
  const r2 = cli(f.dir, 'log', '--deliverable', '-', '--what', 'Earlier note', '--evidence', '`strategy.md`', '--date', '2026-01-01');
  assert.equal(r2.exitCode, 0, JSON.stringify(r2.output.errors));
  const l2 = lineSplit(f.read('log.md'));
  const iNew = l2.findIndex((l) => l.includes('Earlier note'));
  const iOld = l2.findIndex((l) => l.includes('Roadmap created'));
  assert.equal(iNew, iOld - 1);
  assert.ok(l2[iNew].includes('`strategy.md`') && !l2[iNew].includes('``'));
});

test('log recusa frase banida, célula longa e evidência vazia sem gravar', (t) => {
  const f = makeFolder(t);
  const before = snapshot(f.dir);
  refused(cli(f.dir, 'log', '--deliverable', 'E1', '--evidence', 'x.md', '--what', 'see this commit'), 'banned-phrase');
  refused(cli(f.dir, 'log', '--deliverable', 'E1', '--evidence', 'x.md', '--what', 'a'.repeat(301)), 'cell-too-long');
  refused(cli(f.dir, 'log', '--deliverable', 'E1', '--what', 'ok', '--evidence', ''), 'evidence-missing');
  assert.deepEqual(snapshot(f.dir), before);
});

test('log com tabela vazia insere depois do separador', (t) => {
  const f = makeFolder(t, {
    mutate: { 'log.md': (x) => x.replace(/^\| 2026.*\n/gm, '') },
  });
  const r = cli(f.dir, 'log', '--deliverable', 'E1', '--what', 'First', '--evidence', 'a.md', '--date', '2026-02-01');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  const l = lineSplit(f.read('log.md'));
  assert.equal(l[l.findIndex((x) => x.startsWith('|---')) + 1], '| 2026-02-01 | E1 | First | `a.md` |');
});

// A SHA só existe depois do git init: grava a linha E2 por cima da pasta já commitada.
function withSegmentedE2(t, opts = {}) {
  const f = makeFolder(t, { git: true, ...opts });
  const sha = f.shas.main;
  const eol = opts.eol || '\n';
  const text = f.read('state.md').replace(/\r\n/g, '\n').replace(
    '| E2 | not-started | - | Wait for E1 |',
    `| E2 | piece 1: integrated (\`${sha}\`); piece 2: spec | \`${sha}\` | Plan piece 2 |`,
  );
  f.write('state.md', (opts.bom ? '﻿' : '') + text.replace(/^﻿/, '').replace(/\n/g, eol));
  return f;
}

test('AC3: status anterior e linha segmentada sem --piece são recusados sem alterar bytes', (t) => {
  const f = withSegmentedE2(t);
  const before = snapshot(f.dir);
  refused(cli(f.dir, 'set-status', 'E2', 'spec', '--piece', 'piece 1'), 'status-backward');
  assert.deepEqual(snapshot(f.dir), before);
  refused(cli(f.dir, 'set-status', 'E2', 'plan'), 'segment-required');
  assert.deepEqual(snapshot(f.dir), before);
  assert.equal(spawnCli('set-status', f.dir, 'E2', 'spec', '--piece', 'piece 1', '--json').status, 1);
  assert.equal(spawnCli('set-status', f.dir, 'E2', 'spec', '--piece', 'piece 1').status, 1);
  assert.deepEqual(snapshot(f.dir), before);
});

test('set-status troca só o segmento pedido e junta a evidência; repetir é no-op', (t) => {
  const f = withSegmentedE2(t);
  const before = f.read('state.md');
  const r = cli(f.dir, 'set-status', 'E2', 'plan', '--piece', 'piece 2', '--evidence', 'docs/plan.md');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.changed, ['state.md']);
  const d = lineDiff(before, f.read('state.md'));
  assert.equal(d.removed.length, 1);
  assert.equal(d.added.length, 1);
  assert.equal(d.added[0], `| E2 | piece 1: integrated (\`${f.shas.main}\`); piece 2: plan | \`${f.shas.main}\`, \`docs/plan.md\` | Plan piece 2 |`);
  const after = f.read('state.md');
  const again = cli(f.dir, 'set-status', 'E2', 'plan', '--piece', 'piece 2', '--evidence', 'docs/plan.md');
  assert.equal(again.exitCode, 0);
  assert.deepEqual(again.output.changed, []);
  assert.equal(f.read('state.md'), after);
  // rótulo novo acrescenta segmento; --next troca o próximo passo
  const r3 = cli(f.dir, 'set-status', 'E2', 'spec', '--piece', 'piece 3', '--next', 'Draft piece 3');
  assert.equal(r3.exitCode, 0, JSON.stringify(r3.output.errors));
  assert.match(f.read('state.md'), /piece 2: plan; piece 3: spec \| `[0-9a-f]+`, `docs\/plan.md` \| Draft piece 3 \|/);
});

test('set-status para integrado confere a SHA na ancestralidade', (t) => {
  const f = makeFolder(t, { git: true });
  const before = snapshot(f.dir);
  refused(cli(f.dir, 'set-status', 'E1', 'integrated', '--evidence', f.shas.side), 'sha-not-integrated');
  refused(cli(f.dir, 'set-status', 'E1', 'integrated', '--evidence', '1234567'), 'sha-missing');
  refused(cli(f.dir, 'set-status', 'E1', 'blocked'), 'status-not-allowed');
  refused(cli(f.dir, 'set-status', 'E1', 'nonsense'), 'status-not-allowed');
  refused(cli(f.dir, 'set-status', 'E9', 'plan'), 'not-found');
  assert.deepEqual(snapshot(f.dir), before);
  const ok = cli(f.dir, 'set-status', 'E1', 'integrated', '--evidence', f.shas.main);
  assert.equal(ok.exitCode, 0, JSON.stringify(ok.output.errors));
  assert.match(f.read('state.md'), new RegExp(`\\| E1 \\| integrated \\| \`docs/spec-e1.md\`, \`${f.shas.main}\` \\|`));
});

test('set-status para integrado sem git recusa e não grava (Foco 4)', (t) => {
  const f = makeFolder(t);
  const before = snapshot(f.dir);
  const r = cli(f.dir, 'set-status', 'E1', 'integrated', '--evidence', 'abcdef1');
  assert.equal(r.exitCode, 1);
  assert.ok(['git-unavailable', 'sha-not-integrated'].includes(r.output.errors[0].code));
  assert.deepEqual(snapshot(f.dir), before);
});

test('set-status mantém nota aninhada com barra escapada byte a byte (Foco 1)', (t) => {
  const f = makeFolder(t, {
    mutate: { 'state.md': (x) => x.replace('| E1 | spec |', '| E1 | spec (draft (v2) \\| wip) |') },
  });
  const before = f.read('state.md');
  const r = cli(f.dir, 'set-status', 'E1', 'plan');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  const d = lineDiff(before, f.read('state.md'));
  assert.deepEqual(d.added, ['| E1 | plan (draft (v2) \\| wip) | `docs/spec-e1.md` | Write the plan |']);
});

test('set-status não mexe em segmento bloqueado', (t) => {
  const f = makeFolder(t, {
    mutate: { 'state.md': (x) => x.replace('| E3 | not-started |', '| E3 | blocked (BLQ-1) |') },
  });
  refused(cli(f.dir, 'set-status', 'E3', 'spec'), 'segment-locked');
});

test('integrate vira só as linhas na-branch cuja SHA já entrou, e registra um log', (t) => {
  const f = makeFolder(t, { git: true });
  const st = f.read('state.md')
    .replace('| E1 | spec | `docs/spec-e1.md` |', `| E1 | on-branch | \`${f.shas.main}\` |`)
    .replace('| E3 | not-started | - |', `| E3 | on-branch | \`${f.shas.side}\` |`);
  f.write('state.md', st);
  const logBefore = f.read('log.md');
  const r = cli(f.dir, 'integrate', '--sha', f.shas.main, '--date', '2026-01-04');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.changed, ['state.md', 'log.md']);
  assert.deepEqual(r.output.result.integrated, ['E1']);
  const d = lineDiff(st, f.read('state.md'));
  assert.deepEqual(d.added, [`| E1 | integrated | \`${f.shas.main}\` | Write the plan |`]);
  const ld = lineDiff(logBefore, f.read('log.md'));
  assert.equal(ld.added.length, 1);
  assert.match(ld.added[0], /^\| 2026-01-04 \| E1 \| E1 integrated into main via release\/sample \|/);
  const stAfter = f.read('state.md');
  const logAfter = f.read('log.md');
  const again = cli(f.dir, 'integrate', '--sha', f.shas.main, '--date', '2026-01-04');
  assert.equal(again.exitCode, 0);
  assert.deepEqual(again.output.changed, []);
  assert.equal(f.read('state.md'), stAfter);
  assert.equal(f.read('log.md'), logAfter);
  refused(cli(f.dir, 'integrate', '--sha', f.shas.side), 'sha-not-integrated');
});

test('integrate --only filtra e sem git recusa', (t) => {
  const f = makeFolder(t, { git: true });
  f.write('state.md', f.read('state.md')
    .replace('| E1 | spec | `docs/spec-e1.md` |', `| E1 | on-branch | \`${f.shas.main}\` |`)
    .replace('| E2 | not-started | - |', `| E2 | on-branch | \`${f.shas.main}\` |`));
  const r = cli(f.dir, 'integrate', '--sha', f.shas.main, '--only', 'E2');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.result.integrated, ['E2']);
  const g = makeFolder(t);
  refused(cli(g.dir, 'integrate', '--sha', 'abcdef1'), 'git-unavailable');
});

test('garantia: erro de checker novo recusa e nada é gravado', (t) => {
  const f = makeFolder(t);
  const before = snapshot(f.dir);
  const r = cli(f.dir, 'set-status', 'E1', 'plan', '--next', 'x'.repeat(301));
  refused(r, 'checker-errors');
  assert.match(r.output.errors[0].message, /cell-limit/);
  assert.deepEqual(snapshot(f.dir), before);
});

test('garantia: arquivo alterado entre leitura e gravação dá concurrent-change', (t) => {
  const f = makeFolder(t);
  const hook = (file) => fs.appendFileSync(file, 'x');
  const before = f.read('state.md');
  const r = run(['set-status', f.dir, 'E1', 'plan', '--json'], { hooks: { beforeWrite: hook } });
  refused(r, 'concurrent-change');
  assert.equal(f.read('state.md'), `${before}x`);
  assert.deepEqual(fs.readdirSync(f.dir).filter((n) => n.includes('.tmp-')), []);
});

test('garantia: format-newer em comando de escrita sai 1 sem gravar', (t) => {
  const f = makeFolder(t);
  const cfgFile = path.join(f.dir, 'roadmap.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  cfg.formatVersion = 99;
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  const before = snapshot(f.dir);
  refused(cli(f.dir, 'set-status', 'E1', 'plan'), 'format-newer');
  refused(cli(f.dir, 'log', '--deliverable', 'E1', '--what', 'x', '--evidence', 'y'), 'format-newer');
  assert.deepEqual(snapshot(f.dir), before);
});

for (const [name, opts] of [['LF', {}], ['CRLF com BOM e NFD', { eol: '\r\n', bom: true, nfdLine: true }]]) {
  test(`bytes fora das linhas tocadas ficam iguais (${name})`, (t) => {
    const f = withSegmentedE2(t, opts);
    const raw = Object.fromEntries(['state.md', 'log.md', 'decisions.md'].map((n) => [n, fs.readFileSync(path.join(f.dir, n))]));
    const cmds = [
      ['log', '--deliverable', 'E1', '--what', 'Note', '--evidence', 'a.md', '--date', '2026-01-05'],
      ['set-status', 'E2', 'plan', '--piece', 'piece 2', '--evidence', 'docs/plan.md'],
    ];
    for (const c of cmds) {
      const r = cli(f.dir, ...c);
      assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
    }
    assert.equal(cli(f.dir, 'brief').output.result.checker.errors, 0);
    const state = fs.readFileSync(path.join(f.dir, 'state.md'));
    const log = fs.readFileSync(path.join(f.dir, 'log.md'));
    const eol = opts.eol || '\n';
    const keep = (buf, drop) => buf.toString('utf8').split(eol).filter((l) => !drop(l)).join(eol);
    assert.equal(keep(state, (l) => l.startsWith('| E2 |')), keep(raw['state.md'], (l) => l.startsWith('| E2 |')));
    assert.equal(keep(log, (l) => l.includes('| Note |')), raw['log.md'].toString('utf8'));
    assert.equal(Buffer.compare(fs.readFileSync(path.join(f.dir, 'decisions.md')), raw['decisions.md']), 0);
    if (opts.bom) assert.equal(state.subarray(0, 3).toString('hex'), 'efbbbf');
    if (opts.eol) {
      assert.equal(state.toString('utf8').replace(/\r\n/g, '').includes('\n'), false);
      assert.equal(log.toString('utf8').replace(/\r\n/g, '').includes('\n'), false);
    }
  });
}

// ---------- CLI (Tarefa 5): bloqueios, prune e refresh-checker ----------

const readChecker = () => fs.readFileSync(path.join(here, 'check-roadmap.mjs'));
const pluginVersion = /^\/\/ check-roadmap (\d+\.\d+\.\d+)/.exec(readChecker().toString('utf8'))[1];
const DONOT = (items) => (x) => x.replace('<!-- /roadmap:inflight -->\n', `<!-- /roadmap:inflight -->\n\n## Do not do now\n\n<!-- roadmap:donot -->\n${items.join('\n')}\n<!-- /roadmap:donot -->\n`);

function allFilesText(dir) {
  return Object.values(snapshot(dir)).map((b) => Buffer.from(b, 'base64').toString('utf8')).join('\n');
}

test('block-open grava bloqueio, status bloqueado, restauração e log', (t) => {
  const f = makeFolder(t);
  const st = f.read('state.md');
  const lg = f.read('log.md');
  const r = cli(f.dir, 'block-open', '--what', 'Vendor API down', '--affects', 'E1', '--unblocks', 'vendor answers', '--since', '2026-01-05', '--date', '2026-01-05');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.equal(r.output.result.id, 'BLQ-1');
  assert.deepEqual(r.output.changed, ['state.md', 'log.md']);
  const bl = lineSplit(st);
  const al = lineSplit(f.read('state.md'));
  const d = { removed: bl.filter((l) => !al.includes(l)), added: al.filter((l) => !bl.includes(l)) };
  assert.deepEqual(d.removed, ['| E1 | spec | `docs/spec-e1.md` | Write the plan |']);
  assert.equal(d.added.length, 2);
  assert.ok(d.added.includes('| E1 | blocked (BLQ-1) | `docs/spec-e1.md` | Write the plan |'));
  const row = d.added.find((l) => l.startsWith('| BLQ-1 |'));
  assert.ok(row.endsWith('restores E1 to spec |'), row);
  assert.ok(row.includes('| 2026-01-05 |'));
  const ld = lineDiff(lg, f.read('log.md'));
  assert.equal(ld.added.length, 1);
  assert.match(ld.added[0], /^\| 2026-01-05 \| E1 \| BLQ-1 opened: Vendor API down \| `state\.md` \|$/);
  assert.equal(cli(f.dir, 'brief').output.result.checker.errors, 0);
});

test('block-open em linha segmentada exige --piece e bloqueia só o segmento', (t) => {
  const f = withSegmentedE2(t);
  const before = snapshot(f.dir);
  refused(cli(f.dir, 'block-open', '--what', 'X', '--affects', 'E2', '--unblocks', 'ok'), 'segment-required');
  assert.deepEqual(snapshot(f.dir), before);
  const r = cli(f.dir, 'block-open', '--what', 'X down', '--affects', 'E2', '--unblocks', 'ok', '--piece', 'piece 2');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  const state = f.read('state.md');
  assert.ok(state.includes(`piece 1: integrated (\`${f.shas.main}\`); piece 2: blocked (BLQ-1)`));
  assert.ok(state.includes('restores E2 (piece 2) to spec |'));
  assert.equal(cli(f.dir, 'brief').output.result.checker.errors, 0);
});

test('AC2: block-open e block-close; next-id não reaproveita o BLQ fechado', (t) => {
  const f = makeFolder(t);
  const state0 = f.read('state.md');
  assert.equal(cli(f.dir, 'block-open', '--what', 'Vendor API down', '--affects', 'E1', '--unblocks', 'vendor answers', '--date', '2026-01-05').exitCode, 0);
  const r = cli(f.dir, 'block-close', 'BLQ-1', '--how', 'vendor answered', '--date', '2026-01-06');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.changed, ['state.md', 'log.md']);
  assert.equal(f.read('state.md'), state0);
  const logLines = lineSplit(f.read('log.md'));
  assert.ok(logLines.some((l) => l.includes('BLQ-1 opened')));
  assert.ok(logLines.some((l) => l.includes('BLQ-1 closed: vendor answered')));
  assert.equal(cli(f.dir, 'next-id', 'BLQ').output.result.id, 'BLQ-2');
  assert.ok(!allFilesText(f.dir).includes('BLQ-2'));
  assert.ok(!fs.readFileSync(path.join(f.dir, 'strategy.md'), 'utf8').includes('BLQ-2'));
  // BLQ-7 só num arquivo avulso
  const g = makeFolder(t);
  fs.mkdirSync(path.join(g.dir, 'notes'));
  fs.writeFileSync(path.join(g.dir, 'notes', 'extra.txt'), 'old BLQ-7\n');
  assert.equal(cli(g.dir, 'next-id', 'BLQ').output.result.id, 'BLQ-8');
  assert.ok(!allFilesText(g.dir).includes('BLQ-8'));
});

test('block-close aplica --next e remove item donot que cita só esse bloqueio', (t) => {
  const f = makeFolder(t, { mutate: { 'state.md': DONOT(['- Do not start E2 before DEC-001 is read.']) } });
  assert.equal(cli(f.dir, 'block-open', '--what', 'Vendor', '--affects', 'E1', '--unblocks', 'ok', '--date', '2026-01-05').exitCode, 0);
  f.write('state.md', f.read('state.md').replace('<!-- /roadmap:donot -->', '- Do not ship E1 while BLQ-1 is open.\n<!-- /roadmap:donot -->'));
  const r = cli(f.dir, 'block-close', 'BLQ-1', '--how', 'done', '--next', 'E1=Plan it now', '--date', '2026-01-06');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  const state = f.read('state.md');
  assert.ok(state.includes('| E1 | spec | `docs/spec-e1.md` | Plan it now |'));
  assert.ok(state.includes('Do not start E2 before DEC-001'));
  assert.ok(!state.includes('BLQ-1'));
});

test('block-close recusa BLQ ainda citado e frase de restauração ilegível, sem gravar', (t) => {
  const f = makeFolder(t);
  assert.equal(cli(f.dir, 'block-open', '--what', 'Vendor', '--affects', 'E1', '--unblocks', 'ok', '--date', '2026-01-05').exitCode, 0);
  const cp = fs.readFileSync(path.join(f.dir, 'critical-path.md'), 'utf8');
  f.write('critical-path.md', `${cp}\nBlocked by BLQ-1.\n`);
  const before = snapshot(f.dir);
  const r = cli(f.dir, 'block-close', 'BLQ-1', '--how', 'done');
  refused(r, 'blocker-cited');
  assert.match(r.output.errors[0].message, /critical-path\.md/);
  assert.deepEqual(snapshot(f.dir), before);
  // palavra de restauração ausente
  f.write('critical-path.md', cp);
  f.write('state.md', f.read('state.md').replace('restores E1 to spec', 'when ready'));
  const before2 = snapshot(f.dir);
  refused(cli(f.dir, 'block-close', 'BLQ-1', '--how', 'done'), 'restore-unreadable');
  assert.deepEqual(snapshot(f.dir), before2);
  refused(cli(f.dir, 'block-close', 'BLQ-9', '--how', 'done'), 'not-found');
});

test('block-open com vários afetados escreve uma frase por afetado e block-close lê cada uma', (t) => {
  const f = makeFolder(t, { mutate: { 'state.md': (x) => x.replace('| E2 | not-started |', '| E2 | plan |') } });
  const state0 = f.read('state.md');
  assert.equal(cli(f.dir, 'block-open', '--what', 'Shared', '--affects', 'E1,E2', '--unblocks', 'E1 and E2 are free', '--date', '2026-01-05').exitCode, 0);
  assert.ok(f.read('state.md').includes('restores E1 to spec; restores E2 to plan |'));
  assert.equal(cli(f.dir, 'block-close', 'BLQ-1', '--how', 'free', '--date', '2026-01-06').exitCode, 0);
  assert.equal(f.read('state.md'), state0);
});

test('block-open em pasta pt escreve a frase em português', (t) => {
  const f = makeFolder(t);
  const cfgFile = path.join(f.dir, 'roadmap.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  cfg.language = 'pt-BR';
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  const r = cli(f.dir, 'block-open', '--what', 'Fornecedor fora', '--affects', 'E1', '--unblocks', 'fornecedor responde', '--date', '2026-01-05');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.ok(f.read('state.md').includes('restaura E1 para spec |'));
  assert.equal(cli(f.dir, 'block-close', 'BLQ-1', '--how', 'respondeu', '--date', '2026-01-06').exitCode, 0);
});

test('prune remove ramo removido e item donot de bloqueio inexistente, sem log; repetir é no-op', (t) => {
  const f = makeFolder(t, {
    mutate: {
      'state.md': (x) => DONOT(['- Do not start E2 while BLQ-3 is open.', '- Do not touch main (DEC-001).'])(
        x.replace('|---|---|---|\n<!-- /roadmap:inflight -->', '|---|---|---|\n| feat/x | deleted | - |\n| feat/y | live | - |\n<!-- /roadmap:inflight -->')),
    },
  });
  const log = f.read('log.md');
  const r = cli(f.dir, 'prune');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.changed, ['state.md']);
  const state = f.read('state.md');
  assert.ok(!state.includes('feat/x') && !state.includes('BLQ-3'));
  assert.ok(state.includes('feat/y') && state.includes('DEC-001).'));
  assert.equal(f.read('log.md'), log);
  const again = cli(f.dir, 'prune');
  assert.equal(again.exitCode, 0);
  assert.deepEqual(again.output.changed, []);
});

test('refresh-checker copia o checker do plugin byte a byte e registra o log', (t) => {
  const f = makeFolder(t);
  const copy = path.join(f.dir, 'check-roadmap.mjs');
  const logBefore = f.read('log.md');
  const r = cli(f.dir, 'refresh-checker', '--date', '2026-01-07');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.changed, ['log.md', 'check-roadmap.mjs']);
  assert.ok(fs.readFileSync(copy).equals(readChecker()));
  const ld = lineDiff(logBefore, f.read('log.md'));
  assert.equal(ld.added.length, 1);
  assert.match(ld.added[0], new RegExp(`^\\| 2026-01-07 \\| - \\| checker updated none -> ${pluginVersion.replace(/\./g, '\\.')} \\| \`check-roadmap\\.mjs\` \\|$`));
  const again = cli(f.dir, 'refresh-checker');
  assert.equal(again.exitCode, 0);
  assert.deepEqual(again.output.changed, []);
});

test('refresh-checker: cópia de versão maior ou igual é no-op; cópia velha é trocada e tira o pendente', (t) => {
  const f = makeFolder(t);
  const copy = path.join(f.dir, 'check-roadmap.mjs');
  fs.writeFileSync(copy, '// check-roadmap 9.9.9 format 1\n// newer\n');
  const before = snapshot(f.dir);
  const r = cli(f.dir, 'refresh-checker');
  assert.equal(r.exitCode, 0);
  assert.deepEqual(r.output.changed, []);
  assert.deepEqual(snapshot(f.dir), before);
  // cópia velha + pendente
  fs.writeFileSync(copy, '// check-roadmap 0.1.0 format 1\n// old\n');
  f.write('state.md', f.read('state.md').replace('<!-- /roadmap:pending -->', '- (maintainer) checker 1.0.0 available: 2 errors to fix\n<!-- /roadmap:pending -->'));
  const r2 = cli(f.dir, 'refresh-checker', '--date', '2026-01-07');
  assert.equal(r2.exitCode, 0, JSON.stringify(r2.output.errors));
  assert.deepEqual(r2.output.changed, ['state.md', 'log.md', 'check-roadmap.mjs']);
  assert.ok(fs.readFileSync(copy).equals(readChecker()));
  assert.ok(!f.read('state.md').includes('checker 1.0.0'));
  assert.ok(f.read('log.md').includes(`checker updated 0.1.0 -> ${pluginVersion}`));
});

test('refresh-checker: pasta com erro mantém a cópia e grava ou atualiza o pendente sem duplicar', (t) => {
  const f = makeFolder(t, { mutate: { 'state.md': (x) => x.replace('Write the plan', 'x'.repeat(301)) } });
  const copy = path.join(f.dir, 'check-roadmap.mjs');
  const logBefore = f.read('log.md');
  const r = cli(f.dir, 'refresh-checker');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.changed, ['state.md']);
  assert.ok(!fs.existsSync(copy));
  assert.equal(f.read('log.md'), logBefore);
  const re = new RegExp(`\\(maintainer\\) checker ${pluginVersion.replace(/\./g, '\\.')} available: (\\d+) errors to fix`, 'g');
  const first = [...f.read('state.md').matchAll(re)];
  assert.equal(first.length, 1);
  assert.ok(Number(first[0][1]) >= 1);
  f.write('state.md', f.read('state.md').replace('Wait for E1', 'y'.repeat(301)));
  const r2 = cli(f.dir, 'refresh-checker');
  assert.equal(r2.exitCode, 0, JSON.stringify(r2.output.errors));
  const second = [...f.read('state.md').matchAll(re)];
  assert.equal(second.length, 1);
  assert.ok(Number(second[0][1]) > Number(first[0][1]));
  assert.ok(!fs.existsSync(copy));
});

// ---------- CLI (Tarefa 6): acréscimo, ratificação e rejeição ----------

const DEC2_ROW = '| DEC-002 | 2026-01-06 | E1 | Use SQLite. Scope: local. | none stated | - | - | executor | pending |';
const withDec2 = (extra = {}) => ({
  'decisions.md': (x) => x.replace('<!-- /roadmap:decisions -->', `${DEC2_ROW}\n<!-- /roadmap:decisions -->`),
  'state.md': (x) => x.replace('<!-- /roadmap:pending -->', '- (owner) Ratify DEC-002\n<!-- /roadmap:pending -->'),
  ...extra,
});
const decLines = (text) => lineSplit(text).filter((l) => l.startsWith('| DEC-'));
const cellsOf = (line) => splitRow(line);

test('AC4: add-decision grava a linha do executor e repetir é no-op com o mesmo id', (t) => {
  const f = makeFolder(t);
  const r = cli(f.dir, 'add-decision', '--deliverable', 'E1', '--decision', 'Use SQLite', '--scope', 'local', '--date', '2026-01-06');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.equal(r.output.result.id, 'DEC-002');
  assert.deepEqual(r.output.changed, ['decisions.md']);
  const row = cellsOf(decLines(f.read('decisions.md'))[1]);
  assert.equal(row.length, 9);
  assert.equal(row[2], 'E1');
  assert.ok(row[3].endsWith('Scope: local.'), row[3]);
  assert.equal(row[4], 'none stated');
  assert.equal(row[7], 'executor');
  assert.equal(row[8], 'pending');
  const bytes = snapshot(f.dir);
  const again = cli(f.dir, 'add-decision', '--deliverable', 'E1', '--decision', 'Use  SQLite', '--scope', 'local');
  assert.equal(again.exitCode, 0, JSON.stringify(again.output.errors));
  assert.deepEqual(again.output.changed, []);
  assert.equal(again.output.result.id, 'DEC-002');
  assert.equal(f.read('decisions.md').split('DEC-002').length - 1, 1);
  assert.deepEqual(snapshot(f.dir), bytes);
  assert.equal(cli(f.dir, 'brief').output.result.checker.errors, 0);
});

test('add-decision: --discarded, --contradicts, --revisit, scope contrato e recusas de uso', (t) => {
  const f = makeFolder(t);
  const r = cli(f.dir, 'add-decision', '--deliverable', '-', '--decision', 'Pick X.', '--scope', 'contrato',
    '--discarded', 'Y', '--contradicts', 'E2', '--revisit', 'later');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  const row = cellsOf(decLines(f.read('decisions.md'))[1]);
  assert.deepEqual([row[2], row[3], row[4], row[5], row[6]], ['-', 'Pick X. Scope: contract.', 'Y', 'E2', 'later']);
  assert.equal(cli(f.dir, 'add-decision', '--deliverable', 'E1', '--decision', 'Z', '--scope', 'wide').exitCode, 2);
  assert.equal(cli(f.dir, 'add-decision', '--deliverable', 'X1', '--decision', 'Z', '--scope', 'local').exitCode, 2);
  assert.equal(cli(f.dir, 'add-decision', '--deliverable', 'E1', '--scope', 'local').exitCode, 2);
  refused(cli(f.dir, 'add-decision', '--deliverable', 'E1', '--decision', 'x'.repeat(301), '--scope', 'local'), 'cell-too-long');
});

test('AC4: add-pending e inflight-add são idempotentes; inflight-remove tira a linha; nenhum grava log', (t) => {
  const f = makeFolder(t, { mutate: { 'decisions.md': withDec2()['decisions.md'] } });
  const log = f.read('log.md');
  const p = cli(f.dir, 'add-pending', '--owner', 'owner', '--text', 'Ratify DEC-002');
  assert.equal(p.exitCode, 0, JSON.stringify(p.output.errors));
  assert.deepEqual(p.output.changed, ['state.md']);
  const lines = lineSplit(f.read('state.md'));
  const at = lines.indexOf('- (owner) Ratify DEC-002');
  assert.ok(at > 0);
  assert.equal(lines[at - 1], '- (owner) Confirm the storage choice.');
  assert.equal(lines[at + 1], '<!-- /roadmap:pending -->');
  const p2 = cli(f.dir, 'add-pending', '--owner', 'owner', '--text', 'Ratify  DEC-002');
  assert.equal(p2.exitCode, 0);
  assert.deepEqual(p2.output.changed, []);
  refused(cli(f.dir, 'add-pending', '--owner', '', '--text', 'x'), 'owner-missing');
  const a = cli(f.dir, 'inflight-add', 'feat/e1', '--note', 'E1 work');
  assert.equal(a.exitCode, 0, JSON.stringify(a.output.errors));
  assert.ok(f.read('state.md').includes('| feat/e1 | live | E1 work |'));
  assert.deepEqual(cli(f.dir, 'inflight-add', 'feat/e1', '--note', 'E1 work').output.changed, []);
  assert.equal(f.read('state.md').split('feat/e1').length - 1, 1);
  const rm = cli(f.dir, 'inflight-remove', 'feat/e1');
  assert.equal(rm.exitCode, 0);
  assert.ok(!f.read('state.md').includes('feat/e1'));
  assert.deepEqual(cli(f.dir, 'inflight-remove', 'feat/e1').output.changed, []);
  assert.equal(f.read('log.md'), log);
  assert.equal(cli(f.dir, 'brief').output.result.checker.errors, 0);
});

test('inflight-add: linha deleted volta a live', (t) => {
  const f = makeFolder(t, {
    mutate: { 'state.md': (x) => x.replace('|---|---|---|\n<!-- /roadmap:inflight -->', '|---|---|---|\n| feat/e1 | deleted | old |\n<!-- /roadmap:inflight -->') },
  });
  const r = cli(f.dir, 'inflight-add', 'feat/e1');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.ok(f.read('state.md').includes('| feat/e1 | live | old |'));
});

test('AC5: ratify muda só a célula Status, tira o pendente e grava uma linha de log', (t) => {
  const f = makeFolder(t, { mutate: withDec2() });
  const dec0 = f.read('decisions.md');
  const log0 = f.read('log.md');
  const r = cli(f.dir, 'ratify', 'DEC-002', '--date', '2026-01-07');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.deepEqual(r.output.changed, ['decisions.md', 'state.md', 'log.md']);
  const before = cellsOf(DEC2_ROW);
  const after = cellsOf(decLines(f.read('decisions.md'))[1]);
  after.forEach((c, i) => { if (i !== 8) assert.equal(c, before[i]); });
  assert.equal(after[8], 'in-force');
  assert.equal(decLines(f.read('decisions.md')).length, decLines(dec0).length);
  assert.ok(!f.read('state.md').includes('Ratify DEC-002'));
  const ld = lineDiff(log0, f.read('log.md'));
  assert.equal(ld.added.length, 1);
  assert.match(ld.added[0], /^\| 2026-01-07 \| E1 \| DEC-002 ratified by the owner \| `decisions\.md` \|$/);
  assert.equal(cli(f.dir, 'brief').output.result.checker.errors, 0);
});

test('ratify: item pendente que cita outras decisões fica e gera aviso', (t) => {
  const f = makeFolder(t, {
    mutate: withDec2({
      'state.md': (x) => x.replace('<!-- /roadmap:pending -->', '- (owner) Ratify DEC-002\n- (owner) Review DEC-002 and DEC-001\n<!-- /roadmap:pending -->'),
    }),
  });
  const r = cli(f.dir, 'ratify', 'DEC-002');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.ok(f.read('state.md').includes('- (owner) Review DEC-002 and DEC-001'));
  assert.ok(!f.read('state.md').includes('- (owner) Ratify DEC-002'));
  assert.ok(r.output.warnings.some((w) => w.code === 'pending-multi-cite'));
});

test('AC5: ratify e reject recusam inexistente, origem diferente e não pendente, sem tocar bytes', (t) => {
  const f = makeFolder(t, { mutate: withDec2() });
  assert.equal(cli(f.dir, 'ratify', 'DEC-002').exitCode, 0);
  const before = snapshot(f.dir);
  for (const cmd of ['ratify', 'reject']) {
    const extra = cmd === 'reject' ? ['--decision', 'Use Postgres'] : [];
    refused(cli(f.dir, cmd, 'DEC-001', ...extra), 'not-executor');
    refused(cli(f.dir, cmd, 'DEC-002', ...extra), 'not-pending');
    refused(cli(f.dir, cmd, 'DEC-099', ...extra), 'not-found');
  }
  assert.deepEqual(snapshot(f.dir), before);
  assert.equal(cli(f.dir, 'ratify').exitCode, 2);
  assert.equal(cli(f.dir, 'reject', 'DEC-002').exitCode, 2);
});

test('AC6: reject cria a linha do dono, substitui a antiga e tira o pendente', (t) => {
  const f = makeFolder(t, { mutate: withDec2() });
  const dec0 = decLines(f.read('decisions.md'));
  const log0 = f.read('log.md');
  const r = cli(f.dir, 'reject', 'DEC-002', '--decision', 'Use Postgres', '--date', '2026-01-08');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.equal(r.output.result.id, 'DEC-003');
  const rows = decLines(f.read('decisions.md'));
  assert.equal(rows.length, 3);
  assert.equal(rows[0], dec0[0]);
  const fresh = cellsOf(rows[2]);
  assert.deepEqual([fresh[0], fresh[2], fresh[3], fresh[5], fresh[7], fresh[8]], ['DEC-003', 'E1', 'Use Postgres', '-', 'user', 'in-force']);
  assert.equal(fresh[4], "the executor's choice in DEC-002");
  const before = cellsOf(DEC2_ROW);
  const old = cellsOf(rows[1]);
  old.forEach((c, i) => { if (i !== 8) assert.equal(c, before[i]); });
  assert.equal(old[8], 'superseded by DEC-003');
  assert.ok(!f.read('state.md').includes('Ratify DEC-002'));
  const ld = lineDiff(log0, f.read('log.md'));
  assert.equal(ld.added.length, 1);
  assert.match(ld.added[0], /DEC-002 rejected by the owner; DEC-003 supersedes it/);
  assert.equal(cli(f.dir, 'brief').output.result.checker.errors, 0);
});

test('pasta pt: add-decision escreve Alcance e ratify/reject escrevem em português', (t) => {
  const setPt = (f) => {
    const cfgFile = path.join(f.dir, 'roadmap.config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
    cfg.language = 'pt-BR';
    fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  };
  const f = makeFolder(t);
  setPt(f);
  assert.equal(cli(f.dir, 'add-decision', '--deliverable', 'E1', '--decision', 'Usar SQLite', '--scope', 'contrato').exitCode, 0);
  assert.ok(f.read('decisions.md').includes('Usar SQLite. Alcance: contrato. |'));
  const g = makeFolder(t, { mutate: withDec2() });
  setPt(g);
  assert.equal(cli(g.dir, 'ratify', 'DEC-002').exitCode, 0);
  assert.ok(g.read('log.md').includes('DEC-002 ratificada pelo dono'));
  const h = makeFolder(t, { mutate: withDec2() });
  setPt(h);
  const r = cli(h.dir, 'reject', 'DEC-002', '--decision', 'Usar Postgres');
  assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
  assert.ok(h.read('log.md').includes('DEC-002 rejeitada pelo dono; DEC-003 a substitui'));
  assert.ok(h.read('decisions.md').includes('a escolha do executor em DEC-002'));
});

for (const [name, opts] of [['LF', {}], ['CRLF com BOM e NFD', { eol: '\r\n', bom: true, nfdLine: true }]]) {
  test(`T6: bytes fora das linhas tocadas ficam iguais em ratify e reject (${name})`, (t) => {
    for (const cmd of [['ratify', 'DEC-002'], ['reject', 'DEC-002', '--decision', 'Use Postgres']]) {
      const f = makeFolder(t, { ...opts, mutate: withDec2() });
      const raw = Object.fromEntries(['state.md', 'log.md', 'decisions.md'].map((n) => [n, fs.readFileSync(path.join(f.dir, n))]));
      const r = cli(f.dir, ...cmd);
      assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
      const eol = opts.eol || '\n';
      const now = (n) => fs.readFileSync(path.join(f.dir, n));
      const keep = (buf, drop) => buf.toString('utf8').split(eol).filter((l) => !drop(l)).join(eol);
      const dropDec = (l) => l.startsWith('| DEC-002 |') || l.startsWith('| DEC-003 |');
      assert.equal(keep(now('decisions.md'), dropDec), keep(raw['decisions.md'], dropDec));
      const dropPend = (l) => l.includes('Ratify DEC-002');
      assert.equal(keep(now('state.md'), dropPend), keep(raw['state.md'], dropPend));
      const dropLog = (l) => l.includes('DEC-002');
      assert.equal(keep(now('log.md'), dropLog), keep(raw['log.md'], dropLog));
      if (opts.bom) assert.equal(now('state.md').subarray(0, 3).toString('hex'), 'efbbbf');
      if (opts.eol) for (const n of ['state.md', 'log.md', 'decisions.md']) assert.equal(now(n).toString('utf8').replace(/\r\n/g, '').includes('\n'), false);
    }
  });
}

// ---------- CLI (Tarefa 7): AC1, varredura de bytes por comando de escrita ----------

const CHECKER = path.join(here, 'check-roadmap.mjs');

// Reescreve um arquivo da pasta preservando o final de linha e o BOM da variante.
function editFile(f, opts, name, fn) {
  const eol = opts.eol || '\n';
  const had = f.read(name).startsWith('﻿');
  const text = fn(f.read(name).replace(/^﻿/, '').replace(/\r\n/g, '\n'));
  f.write(name, (had ? '﻿' : '') + text.replace(/\n/g, eol));
}

function snapshotBuf(dir) {
  const out = {};
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile()) out[e.name] = fs.readFileSync(path.join(dir, e.name));
  }
  return out;
}

// Alinha antes e depois pelas linhas exatas (texto + terminador); o resto é o que o comando tocou.
function changedLines(beforeBuf, afterBuf) {
  const b = splitLines(beforeBuf.toString('utf8')).lines.map((l) => l.text + l.eol);
  const a = splitLines(afterBuf.toString('utf8')).lines.map((l) => l.text + l.eol);
  const dp = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0));
  for (let i = b.length - 1; i >= 0; i--) {
    for (let j = a.length - 1; j >= 0; j--) {
      dp[i][j] = b[i] === a[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const removed = [];
  const added = [];
  let i = 0;
  let j = 0;
  while (i < b.length && j < a.length) {
    if (b[i] === a[j]) { i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) removed.push(b[i++]); else added.push(a[j++]);
  }
  while (i < b.length) removed.push(b[i++]);
  while (j < a.length) added.push(a[j++]);
  return { removed, added, after: a };
}

const MD_FILES = ['state.md', 'log.md', 'decisions.md', 'strategy.md'];
const addInflight = (x) => x.replace('|---|---|---|\n<!-- /roadmap:inflight -->', '|---|---|---|\n| side | live | E1 work |\n<!-- /roadmap:inflight -->');
const addDeleted = (x) => x.replace('|---|---|---|\n<!-- /roadmap:inflight -->', '|---|---|---|\n| feat/x | deleted | - |\n<!-- /roadmap:inflight -->');
const prepDec2 = (f, o) => {
  editFile(f, o, 'decisions.md', withDec2()['decisions.md']);
  editFile(f, o, 'state.md', withDec2()['state.md']);
};

// prep(f, opts) deixa a pasta pronta para o comando gravar algo; args(f) é o argv do comando;
// expect: por arquivo, [máximo de linhas removidas, máximo de acrescentadas, regex que cada linha tocada cumpre].
const AC1_CASES = [
  { name: 'log', args: () => ['log', '--deliverable', 'E1', '--what', 'Note', '--evidence', 'a.md', '--date', '2026-01-05'], expect: { 'log.md': [0, 1, /\| Note \|/] } },
  { name: 'set-status', args: () => ['set-status', 'E2', 'plan', '--piece', 'piece 2', '--evidence', 'docs/plan.md'], expect: { 'state.md': [1, 1, /^\| E2 \|/] } },
  {
    name: 'integrate',
    prep: (f, o) => editFile(f, o, 'state.md', (x) => x.replace('| E1 | spec | `docs/spec-e1.md` |', `| E1 | on-branch | \`${f.shas.main}\` |`)),
    args: (f) => ['integrate', '--sha', f.shas.main, '--date', '2026-01-05'],
    expect: { 'state.md': [1, 1, /^\| E1 \|/], 'log.md': [0, 1, /E1 integrated/] },
  },
  {
    name: 'block-open',
    args: () => ['block-open', '--what', 'Vendor down', '--affects', 'E1', '--unblocks', 'vendor answers', '--date', '2026-01-05'],
    expect: { 'state.md': [1, 2, /^\| (E1|BLQ-1) \|/], 'log.md': [0, 1, /BLQ-1 opened/] },
  },
  {
    name: 'block-close',
    prep: (f) => assert.equal(cli(f.dir, 'block-open', '--what', 'Vendor down', '--affects', 'E1', '--unblocks', 'vendor answers', '--date', '2026-01-05').exitCode, 0),
    args: () => ['block-close', 'BLQ-1', '--how', 'vendor answered', '--date', '2026-01-06'],
    expect: { 'state.md': [2, 1, /^\| (E1|BLQ-1) \|/], 'log.md': [0, 1, /BLQ-1 closed/] },
  },
  { name: 'prune', prep: (f, o) => editFile(f, o, 'state.md', addDeleted), args: () => ['prune'], expect: { 'state.md': [1, 0, /feat\/x/] } },
  { name: 'refresh-checker', args: () => ['refresh-checker', '--date', '2026-01-07'], expect: { 'log.md': [0, 1, /checker updated/] } },
  {
    name: 'add-decision',
    args: () => ['add-decision', '--deliverable', 'E1', '--decision', 'Use SQLite', '--scope', 'local', '--date', '2026-01-06'],
    expect: { 'decisions.md': [0, 1, /^\| DEC-002 \|/] },
  },
  { name: 'add-pending', args: () => ['add-pending', '--owner', 'owner', '--text', 'Check the plan'], expect: { 'state.md': [0, 1, /Check the plan/] } },
  { name: 'inflight-add', args: () => ['inflight-add', 'side', '--note', 'E1 work'], expect: { 'state.md': [0, 1, /side/] } },
  { name: 'inflight-remove', prep: (f, o) => editFile(f, o, 'state.md', addInflight), args: () => ['inflight-remove', 'side'], expect: { 'state.md': [1, 0, /side/] } },
  {
    name: 'ratify',
    prep: prepDec2,
    args: () => ['ratify', 'DEC-002', '--date', '2026-01-07'],
    expect: { 'decisions.md': [1, 1, /^\| DEC-002 \|/], 'state.md': [1, 0, /Ratify DEC-002/], 'log.md': [0, 1, /DEC-002 ratified/] },
  },
  {
    name: 'reject',
    prep: prepDec2,
    args: () => ['reject', 'DEC-002', '--decision', 'Use Postgres', '--date', '2026-01-08'],
    expect: { 'decisions.md': [1, 2, /^\| DEC-00[23] \|/], 'state.md': [1, 0, /Ratify DEC-002/], 'log.md': [0, 1, /DEC-002 rejected/] },
  },
];

for (const [variant, opts] of [['LF', { eol: '\n' }], ['CRLF com BOM e NFD', { eol: '\r\n', bom: true, nfdLine: true }]]) {
  for (const c of AC1_CASES) {
    test(`AC1: ${c.name} grava só as linhas tocadas, checker sem erro (${variant})`, (t) => {
      const f = withSegmentedE2(t, opts);
      if (c.prep) c.prep(f, opts);
      const eol = opts.eol;
      const before = snapshotBuf(f.dir);
      const r = cli(f.dir, ...c.args(f));
      assert.equal(r.exitCode, 0, JSON.stringify(r.output.errors));
      assert.ok(r.output.changed.length > 0, 'changed vazio');
      const chk = spawnSync(process.execPath, [CHECKER, f.dir, '--json'], { encoding: 'utf8' });
      assert.equal(JSON.parse(chk.stdout).summary.errors, 0, chk.stdout);
      const after = snapshotBuf(f.dir);
      for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!r.output.changed.includes(name)) {
          assert.ok(before[name] && after[name] && before[name].equals(after[name]), `${name} fora de changed mudou`);
          continue;
        }
        if (!before[name]) {
          assert.equal(name, 'check-roadmap.mjs');
          assert.ok(after[name].equals(fs.readFileSync(CHECKER)));
          continue;
        }
        assert.ok(MD_FILES.includes(name), `arquivo inesperado em changed: ${name}`);
        const [maxRemoved, maxAdded, touch] = c.expect[name] || [0, 0, /^$/];
        const d = changedLines(before[name], after[name]);
        assert.ok(d.removed.length <= maxRemoved, `${name}: ${d.removed.length} removidas`);
        assert.ok(d.added.length <= maxAdded, `${name}: ${d.added.length} acrescentadas`);
        for (const l of [...d.removed, ...d.added]) assert.match(l.replace(/[\r\n]+$/, ''), touch);
        // toda linha do arquivo gravado, as novas também, usa o terminador da variante
        d.after.forEach((l, i) => {
          const end = /\r\n$|\n$/.exec(l);
          if (end) assert.equal(end[0], eol, `${name} linha ${i}`);
          else assert.equal(i, d.after.length - 1);
        });
        assert.equal(after[name].subarray(0, 3).toString('hex') === 'efbbbf', before[name].subarray(0, 3).toString('hex') === 'efbbbf', `${name}: BOM`);
      }
      if (opts.bom) assert.equal(after['state.md'].subarray(0, 3).toString('hex'), 'efbbbf');
      if (opts.nfdLine) assert.ok(after['state.md'].toString('utf8').includes('# State Café' + eol));
      for (const name of Object.keys(c.expect)) assert.ok(r.output.changed.includes(name), `${name} não está em changed`);
    });
  }
}
