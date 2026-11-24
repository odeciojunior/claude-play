#!/usr/bin/env node
// Sonda AC2b do E41: prepara o sandbox offline e resume as 6 execucoes pagas feitas pelo roteiro
// (sonda-e41-ac2b.md). Repo-only (nao publicado). Nenhum subcomando chama claude -p.
//   prepare   --work <dir> --plugin <plugins/productivity-tools>
//   summarize --work <dir> --config <dir>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canon, fnv1a } from '../../plugins/productivity-tools/lib/plan-digest.mjs';
import { applyEvents } from '../../plugins/productivity-tools/lib/progress-state.mjs';
import { extract, loadPrices } from './session-metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..');
export const BUDGET_PER_RUN = 0.16;
export const BUDGET_TOTAL = 1;
export const STEPS = 40;
const KS = [1, 2, 3];
const MODES = ['on', 'off'];

const slash = (p) => String(p).replace(/\\/g, '/');
const inside = (parent, child) => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

function specText() {
  const data = {
    schema: 'spec/1',
    id: 'SONDA',
    title: 'Sonda AC2b',
    mode: 'unattended',
    acceptance: [{ id: 'AC1', text: 'Given the sandbox, when the coordinator reads the state, then it stops at authorize. {verify: test; evidence: node --test tests/sonda.test.mjs}' }],
    rulings: [],
    needsPerson: [],
    externalEffects: [{ id: 'X1', what: 'Efeito externo de exemplo da sonda.', target: 'nenhum (sandbox)' }],
    edgeCases: [],
  };
  return '# Spec da sonda\n\nSandbox da sonda AC2b; so o bloco de dados vale.\n\n```json data\n' + JSON.stringify(data, null, 2) + '\n```\n';
}

function planText() {
  const task = (n) => ({
    writes: [],
    produces: n === 1 ? ['sondaItem() -> item'] : [],
    consumes: n === 1 ? [] : [{ task: 1, sig: 'sondaItem() -> item' }],
    covers: n === 1 ? ['AC1', 'X1'] : [],
    testFirst: true,
    locks: [],
    external: n === 1,
    externalDedupe: n === 1 ? 'Nunca roda: a sonda para em authorize.' : null,
    noCommit: false,
    n,
    title: 'Passo ' + n + ' da sonda',
    deps: n === 1 ? [] : [1],
    files: { create: ['src/p' + n + '.mjs'], modify: [], test: ['tests/p' + n + '.test.mjs'] },
    score: { ambiguity: 0, reasoning: 0, blast: 0, verifiability: 0 },
    checks: [{ cmd: 'node --test tests/p' + n + '.test.mjs', expect: 'exit 0' }],
  });
  const data = {
    schema: 'plan/1',
    id: 'SONDA',
    title: 'Plano da sonda AC2b',
    spec: 'spec.md',
    roadmap: 'docs/plans/roadmap-sonda/',
    constraints: ['Plano de exemplo: nada e executado.'],
    tasks: Array.from({ length: STEPS }, (_, i) => task(i + 1)),
    evidence: [{ ac: 'AC1', kind: 'test', command: 'node --test tests/sonda.test.mjs', external: false, externalDedupe: null, blq: null }],
    rulings: [],
    needsPerson: [],
  };
  const prose = ['# Plano da sonda', '', '## Tarefas', ''];
  for (let n = 1; n <= STEPS; n++) prose.push('### Tarefa ' + n + ': Passo ' + n + ' da sonda', '', 'Passo de exemplo.', '');
  return prose.join('\n') + '## Bloco de dados\n\n```json data\n' + JSON.stringify(data, null, 2) + '\n```\n';
}

// Texto de exemplo com o que quebrou a copia crua da fatia 6: virgulas, quebras de linha, aspas e acentos.
export const PROSE_NOTE = 'Criei o script, o roteiro e o teste.\nO subcomando "prepare" monta o sandbox, roda init e aplica approve-map, depois confere a ação seguinte.\nVerifiquei: passou, sem retries, sem avisos; custo, tempo e tokens dentro do previsto.';
export const PROSE_HANDOFF = 'Entrego tools/measure/sonda-e41-ac2b.mjs (prepare e summarize), o roteiro e o teste.\nPróximo passo: ler o estado, conferir as fatias, parar em authorize; não executar nada externo, nem "de leve".\n' + 'Detalhe de aceitação, órfão de contexto, útil só para a sonda: vírgulas, pontos e vírgulas; aspas "duplas" e \'simples\'. '.repeat(12);

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error([cmd, ...args].slice(0, 4).join(' ') + ' saiu ' + r.status + ': ' + (r.stderr || r.stdout));
  return r.stdout;
}

export function prepare({ work, plugin }) {
  if (!work || !plugin) throw new Error('prepare exige --work e --plugin');
  if (inside(REPO, work)) throw new Error('--work fica dentro do repositorio: ' + work);
  const progress = path.join(path.resolve(plugin), 'skills', 'plan-coordinator', 'scripts', 'progress.mjs');
  if (!fs.existsSync(progress)) throw new Error('progress.mjs nao encontrado em ' + progress);
  const sandbox = path.join(path.resolve(work), 'sandbox');
  if (fs.existsSync(path.join(sandbox, 'docs'))) throw new Error('o sandbox ja existe: ' + sandbox);
  const dir = path.join(sandbox, 'docs', 'plans', 'sonda');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(path.resolve(work), 'runs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec.md'), specText());
  fs.writeFileSync(path.join(dir, 'plan.md'), planText());
  const g = (...a) => run('git', ['-c', 'user.name=sonda', '-c', 'user.email=sonda@example.invalid', '-c', 'commit.gpgsign=false', ...a], sandbox);
  g('init', '-b', 'main');
  g('add', '-A');
  g('commit', '-m', 'sonda: spec e plano');
  const stateFile = path.join(dir, 'progress.json');
  run('node', [progress, 'init', path.join(dir, 'plan.md'), '--spec', path.join(dir, 'spec.md'), '--commits', 'none'], sandbox);
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const events = [{ type: 'approve-map' }, { type: 'prelaunch-review', step: 1, value: 'pass' }];
  const dry = applyEvents(state, events, new Date().toISOString());
  if (!dry.ok) throw new Error('evento recusado no lote ' + dry.index + ': ' + dry.code);
  const expect = fnv1a(JSON.stringify(canon({ ...state, history: [] })));
  const rest = { expect, events };
  const load = { ...rest, digest: fnv1a(JSON.stringify(canon(rest))) };
  const nonce = crypto.randomBytes(8).toString('hex');
  run('node', [progress, 'apply', stateFile, '--events', encodeURIComponent(JSON.stringify(load)), '--nonce', nonce], sandbox);
  // Prosa real no estado (virgulas, quebras de linha, aspas, acentos): as fatias em base64 tem de passar por ela (E41 B3).
  const withProse = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  withProse.steps[8].note = PROSE_NOTE;
  withProse.steps[8].handoff = PROSE_HANDOFF;
  fs.writeFileSync(stateFile, JSON.stringify(withProse, null, 2) + '\n');
  const next = JSON.parse(run('node', [progress, 'next', stateFile, '--json'], sandbox));
  return { sandbox, stateFile, action: next.action };
}

// Linha de tabela para measurements.md e o veredito (ok = 6 execucoes na parada authorize e soma ate US$ 1).
export function summarize({ work, config }) {
  if (!work || !config) throw new Error('summarize exige --work e --config');
  const root = path.join(path.resolve(config), 'projects');
  const prices = loadPrices(path.join(here, 'prices.json'));
  const problems = [];
  let reached = 0;
  let cost = 0;
  let retries = 0;
  let runs = 0;
  for (const mode of MODES) {
    for (const k of KS) {
      const file = path.join(path.resolve(work), 'runs', k + '-' + mode + '.json');
      let out;
      try {
        out = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        problems.push(k + '-' + mode + ': saida ilegivel');
        continue;
      }
      runs++;
      if (typeof out.total_cost_usd === 'number') cost += out.total_cost_usd;
      const text = String(out.result ?? '');
      if (out.is_error !== true && /authorize/i.test(text)) reached++;
      else problems.push(k + '-' + mode + ': parada authorize nao alcancada');
      if (out.session_id && fs.existsSync(root)) {
        const r = extract({ root, sessions: [out.session_id], prices }).runs[0];
        for (const [label, a] of Object.entries(r?.agents ?? {})) if (/-slice\d+-retry\d+$/.test(label)) retries += a.calls;
      }
    }
  }
  const total = Math.round(cost * 1e6) / 1e6;
  const ok = reached === MODES.length * KS.length && total <= BUDGET_TOTAL;
  if (total > BUDGET_TOTAL) problems.push('custo somado acima de US$ ' + BUDGET_TOTAL);
  const line = '| E41 AC2b | ' + runs + ' execucoes | parada authorize em ' + reached + '/' + MODES.length * KS.length + ' | retries de fatia ' + retries + ' | custo US$ ' + total.toFixed(4) + ' |';
  return { ok, line, problems };
}

export function main(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  const [cmd, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) opts[String(rest[i]).replace(/^--/, '')] = rest[i + 1];
  try {
    if (cmd === 'prepare') {
      const r = prepare(opts);
      io.stdout.write('sandbox: ' + slash(r.sandbox) + '\nprogress: ' + slash(r.stateFile) + '\nnextAction: ' + r.action.action + '\n');
      return r.action.action === 'authorize' ? 0 : 1;
    }
    if (cmd === 'summarize') {
      const r = summarize(opts);
      io.stdout.write(r.line + '\n');
      for (const p of r.problems) io.stderr.write(p + '\n');
      return r.ok ? 0 : 1;
    }
  } catch (e) {
    io.stderr.write(e.message + '\n');
    return 2;
  }
  io.stderr.write('uso: sonda-e41-ac2b.mjs prepare --work <dir> --plugin <dir> | summarize --work <dir> --config <dir>\n');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
