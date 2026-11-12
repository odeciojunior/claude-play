import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import {
  validateModel, applyDefaults, VOCAB_PT, VOCAB_EN, DEFAULT_TRACKS, DEFAULT_LIMITS, HEADINGS,
  compareIds, deriveGraph, deriveCoverage,
  cell, ScaffoldError, buildConfig, renderFiles, renderStrategy, generate, runScaffold, main,
} from './scaffold.mjs';
import { parseRoadmapTexts } from '../../../lib/roadmap-format.mjs';
import { loadRoadmap, checkRoadmap, createGitAdapter } from '../../roadmap-tracker/scripts/check-roadmap.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8').replace(/^﻿/, ''));
const full = () => load('model-full.json');
const mid = () => load('model-mid.json');
const codes = (errs) => errs.map((e) => `${e.code}@${e.path}`);

// Lê um caminho JSON como `deliverables[0].priority`; true se existir no objeto.
function hasPath(obj, p) {
  const parts = p.match(/[^.[\]]+/g) || [];
  let cur = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return false;
    cur = cur[part];
  }
  return true;
}

describe('validateModel', () => {
  it('aceita as duas fixtures', () => {
    assert.deepEqual(validateModel(full()), []);
    assert.deepEqual(validateModel(mid()), []);
  });

  it('modelVersion diferente de 1', () => {
    const m = full(); m.modelVersion = 2;
    assert.ok(codes(validateModel(m)).includes('model-version@modelVersion'));
  });

  it('campo obrigatório ausente ou vazio', () => {
    const m = full(); delete m.topic;
    assert.ok(codes(validateModel(m)).includes('required@topic'));
    const v = full(); v.requirements = [];
    assert.ok(codes(validateModel(v)).includes('required@requirements'));
    const c = full(); delete c.deliverables[2].phase;
    assert.ok(codes(validateModel(c)).includes('required@deliverables[2].phase'));
  });

  it('id duplicado', () => {
    const m = full(); m.deliverables[1].id = 'E1';
    assert.ok(codes(validateModel(m)).includes('duplicate-id@deliverables[1].id'));
    const r = full(); r.requirements[1].id = 'REQ-001';
    assert.ok(codes(validateModel(r)).includes('duplicate-id@requirements[1].id'));
    const s = full(); s.sources[1].id = 'SRC-01';
    assert.ok(codes(validateModel(s)).includes('duplicate-id@sources[1].id'));
    const d = full(); d.decisions.push({ ...d.decisions[0] });
    assert.ok(codes(validateModel(d)).includes('duplicate-id@decisions[1].id'));
    const b = full(); b.blockers.push({ ...b.blockers[0] });
    assert.ok(codes(validateModel(b)).includes('duplicate-id@blockers[1].id'));
  });

  it('dependência desconhecida', () => {
    const m = full(); m.deliverables[1].depends = ['E99'];
    assert.ok(codes(validateModel(m)).includes('unknown-dependency@deliverables[1].depends[0]'));
  });

  it('ciclo, com a cadeia na mensagem', () => {
    const m = full(); m.deliverables[0].depends = ['E2'];
    const errs = validateModel(m).filter((e) => e.code === 'cycle');
    assert.equal(errs.length, 1);
    assert.match(errs[0].message, /E1 -> E2 -> E1|E2 -> E1 -> E2/);
    const self = full(); self.deliverables[2].depends = ['E3'];
    assert.ok(validateModel(self).some((e) => e.code === 'cycle' && /E3 -> E3/.test(e.message)));
  });

  it('requisito, fase e trilha desconhecidos', () => {
    const r = full(); r.deliverables[0].reqs = ['REQ-999'];
    assert.ok(codes(validateModel(r)).includes('unknown-req@deliverables[0].reqs[0]'));
    const p = full(); p.deliverables[0].phase = 'Nope';
    assert.ok(codes(validateModel(p)).includes('unknown-phase@deliverables[0].phase'));
    const t = full(); t.deliverables[0].track = 'nope';
    assert.ok(codes(validateModel(t)).includes('unknown-track@deliverables[0].track'));
    const t2 = full(); t2.tracks = ['alpha']; // trilhas do modelo substituem as padrão
    assert.ok(codes(validateModel(t2)).includes('unknown-track@deliverables[0].track'));
  });

  it('menos de dois critérios', () => {
    const m = full(); m.deliverables[0].acceptance.pop();
    assert.ok(codes(validateModel(m)).includes('acceptance-min@deliverables[0].acceptance'));
  });

  it('critério sem verify ou com kind inválido', () => {
    const a = full(); delete a.deliverables[0].acceptance[0].verify;
    assert.ok(codes(validateModel(a)).includes('verify-missing@deliverables[0].acceptance[0].verify'));
    const b = full(); b.deliverables[0].acceptance[1].verify.kind = 'magic';
    assert.ok(codes(validateModel(b)).includes('verify-missing@deliverables[0].acceptance[1].verify.kind'));
  });

  it('kind blocked sem blq', () => {
    const m = full(); delete m.deliverables[4].acceptance[0].verify.blq;
    assert.ok(codes(validateModel(m)).includes('verify-blocked-no-blq@deliverables[4].acceptance[0].verify.blq'));
  });

  it('modelo que não é objeto', () => {
    assert.deepEqual(codes(validateModel(null)), ['required@']);
    assert.deepEqual(codes(validateModel([])), ['required@']);
  });

  it('mensagens na ordem dos campos do modelo', () => {
    const m = full(); delete m.topic; m.deliverables[0].reqs = ['REQ-999']; m.deliverables[1].depends = ['E99'];
    assert.deepEqual(codes(validateModel(m)), [
      'required@topic', 'unknown-req@deliverables[0].reqs[0]', 'unknown-dependency@deliverables[1].depends[0]',
    ]);
  });
});

describe('applyDefaults', () => {
  it('aplica os padrões do modelo do meio e lista cada um', () => {
    const m = mid();
    const before = structuredClone(m);
    const { model, defaulted } = applyDefaults(m);
    assert.deepEqual(m, before, 'a entrada não muda');
    const by = Object.fromEntries(defaulted.map((d) => [d.path, d.value]));
    assert.equal(by['deliverables[0].priority'], 'Must');
    assert.equal(by['deliverables[0].size'], 'não estimado');
    assert.equal(by['deliverables[0].track'], 'engineering');
    assert.deepEqual(by.vocab, VOCAB_PT);
    assert.ok('gates' in by);
    assert.equal(model.deliverables[1].priority, 'Must');
    assert.deepEqual(model.tracks, DEFAULT_TRACKS);
    assert.deepEqual(model.limits, DEFAULT_LIMITS);
    assert.equal(model.strategyPath, '../2026-01-01-roadmap-exemplo.md');
    assert.equal(model.files.measurements, null);
    assert.equal(model.files.state, 'state.md');
    assert.deepEqual(model.nonGoals, ['Nenhuma.']);
    assert.deepEqual(model.now, ['Iniciar E1. Runs: -. Approves: -. Depends on: -.']);
    assert.deepEqual(model.pending, []);
  });

  it('não lista caminho que já existe no modelo', () => {
    const m = mid();
    const { defaulted } = applyDefaults(m);
    for (const d of defaulted) assert.equal(hasPath(m, d.path), false, `${d.path} já existe no modelo`);
  });

  it('o resultado não precisa de novos padrões (idempotente)', () => {
    const { model } = applyDefaults(mid());
    assert.deepEqual(applyDefaults(model).defaulted, []);
    assert.deepEqual(validateModel(model), []);
  });

  it('modelo completo em en: só o que falta, em inglês', () => {
    const { model, defaulted } = applyDefaults(full());
    const paths = defaulted.map((d) => d.path);
    assert.deepEqual(model.vocab, VOCAB_EN);
    assert.ok(paths.includes('vocab') && paths.includes('tracks') && paths.includes('limits'));
    assert.ok(!paths.some((p) => /priority|size|track$/.test(p)));
    assert.equal(model.files.measurements, 'measurements.md');
    assert.deepEqual(model.now, full().now, 'now do modelo é mantido');
    const noThesis = full(); delete noThesis.thesis; delete noThesis.nonGoals;
    const r = applyDefaults(noThesis);
    assert.equal(r.model.thesis, 'None.');
    assert.deepEqual(r.model.nonGoals, ['None.']);
  });

  it('strategyPath tira o sufixo -plan do tópico', () => {
    const m = mid(); m.topic = 'exemplo-plan';
    assert.equal(applyDefaults(m).model.strategyPath, '../2026-01-01-roadmap-exemplo.md');
  });

  it('now ignora cards bloqueados e descartados', () => {
    const m = full(); delete m.now;
    const { model } = applyDefaults(m);
    assert.deepEqual(model.now, ['Start E1. Runs: -. Approves: -. Depends on: -.']);
  });

  it('critical vindo do modelo é removido e reportado', () => {
    const m = mid(); m.deliverables[0].critical = true;
    const { model, defaulted } = applyDefaults(m);
    assert.equal('critical' in model.deliverables[0], false);
    assert.deepEqual(defaulted.find((d) => d.path === 'deliverables[0].critical'), { path: 'deliverables[0].critical', value: 'ignored (derived)' });
    assert.equal(m.deliverables[0].critical, true, 'a entrada não muda');
  });
});

describe('constantes', () => {
  it('HEADINGS tem as mesmas 19 chaves em en e pt', () => {
    assert.equal(Object.keys(HEADINGS.en).length, 19);
    assert.deepEqual(Object.keys(HEADINGS.pt), Object.keys(HEADINGS.en));
    assert.equal(HEADINGS.en.gates, 'Gates and verification');
    assert.equal(HEADINGS.pt.nonGoals, 'Não objetivos');
  });

  it('VOCAB_PT é o bloco vocab do config do roadmap', () => {
    const cfgPath = path.join(here, '..', '..', '..', '..', '..', 'docs', 'plans', 'roadmap-evolucao-skills', 'roadmap.config.json');
    if (!fs.existsSync(cfgPath)) return; // pacote instalado, sem a pasta de docs
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
    assert.deepEqual(VOCAB_PT, cfg.vocab);
  });
});

const card = (id, depends = []) => ({ id, depends });

describe('compareIds', () => {
  it('ordena numericamente, não lexicograficamente', () => {
    assert.ok(compareIds('E2', 'E10') < 0);
    assert.ok(compareIds('E10', 'E2') > 0);
    assert.ok(compareIds('REQ-002', 'REQ-010') < 0);
    assert.equal(compareIds('E3', 'E3'), 0);
  });
});

describe('deriveGraph', () => {
  it('model-full: arestas, caminho crítico e cadeia', () => {
    const m = full();
    const g = deriveGraph(m.deliverables);
    const expected = new Set();
    for (const c of m.deliverables) for (const d of c.depends || []) expected.add(`${d}>${c.id}`);
    assert.deepEqual(new Set(g.edges.map(([d, c]) => `${d}>${c}`)), expected);
    assert.equal(g.edges.length, expected.size);
    for (const e of ['E1', 'E2', 'E3', 'E4']) assert.ok(g.critical.has(e), e);
    assert.equal(g.chain[0], 'E1');
    assert.equal(g.chain[1], 'E2');
    assert.equal(g.chain.at(-1), 'E4');
    assert.equal(g.longest, g.chain.length);
    const isolated = m.deliverables.filter((c) => !(c.depends || []).length
      && !m.deliverables.some((o) => (o.depends || []).includes(c.id)));
    for (const c of isolated) assert.ok(!g.critical.has(c.id), c.id);
  });

  it('empate de comprimento resolvido por ordem numérica de id', () => {
    const g = deriveGraph([card('E10'), card('E11', ['E10']), card('E2'), card('E3', ['E2'])]);
    assert.deepEqual(g.chain, ['E2', 'E3']);
    assert.equal(g.longest, 2);
    assert.deepEqual([...g.critical].sort(compareIds), ['E2', 'E3', 'E10', 'E11']);
  });

  it('card isolado é cadeia de comprimento 1; vazio não quebra', () => {
    const g = deriveGraph([card('E1')]);
    assert.equal(g.longest, 1);
    assert.deepEqual(g.chain, ['E1']);
    assert.equal(deriveGraph([]).longest, 0);
  });
});

describe('deriveCoverage', () => {
  it('inverte os reqs dos cards e conta o resumo', () => {
    const m = applyDefaults(full()).model;
    const cov = deriveCoverage(m.requirements, m.deliverables, m.vocab);
    for (const row of cov.rows) {
      const exp = m.deliverables.filter((c) => (c.reqs || []).includes(row.id)).map((c) => c.id).sort(compareIds);
      assert.deepEqual(row.deliverables, exp, row.id);
    }
    const r5 = cov.rows.find((r) => r.id === 'REQ-005');
    assert.equal(r5.coverage, `${m.vocab.coverageOutOfScope}: Deferred to a later roadmap.`);
    assert.equal(cov.rows.find((r) => r.id === 'REQ-001').coverage, m.vocab.coverageCovered);
    assert.equal(cov.summary.outOfScope, 1);
    assert.equal(cov.summary.covered + cov.summary.outOfScope + cov.summary.needsClarification, m.requirements.length);
  });

  it('needs-clarification usa a palavra do vocab', () => {
    const v = VOCAB_PT;
    const cov = deriveCoverage([{ id: 'REQ-001', coverage: { kind: 'needs-clarification' } }], [], v);
    assert.equal(cov.rows[0].coverage, v.coverageNeedsClarification);
    assert.equal(cov.summary.needsClarification, 1);
  });
});

describe('renderFiles', () => {
  const defaulted = (m) => applyDefaults(m).model;
  const render = (m = full()) => renderFiles(defaulted(m));
  const parsed = (files) => parseRoadmapTexts({
    strategy: '',
    files: { state: files['state.md'], decisions: files['decisions.md'], log: files['log.md'], sources: files['sources.md'], requirements: files['requirements.md'], measurements: files['measurements.md'] },
  });

  it('cell escapa | e recusa quebra de linha', () => {
    assert.equal(cell('a|b', 'x'), 'a\\|b');
    for (const bad of ['a\nb', 'a\rb']) {
      assert.throws(() => cell(bad, 'x.y'), (e) => e instanceof ScaffoldError && e.problems[0].code === 'multiline-cell' && e.problems[0].path === 'x.y');
    }
  });

  it('buildConfig segue formats.md §2', () => {
    const cfg = buildConfig(defaulted(full()));
    assert.equal(cfg.formatVersion, 1);
    assert.equal(cfg.strategy, '../2026-01-01-roadmap-sample.md');
    assert.equal(cfg.releaseBranch, 'release/2026-01');
    assert.equal(cfg.files.measurements, 'measurements.md');
    const c2 = buildConfig(defaulted(mid()));
    assert.equal(c2.files.measurements, null);
    assert.ok(!('releaseBranch' in c2));
    assert.equal(c2.vocab.blockedStatus, 'bloqueado');
  });

  it('chaves são os arquivos do config mais roadmap.config.json; LF e \\n final', () => {
    const files = render();
    assert.deepEqual(Object.keys(files).sort(), ['README.md', 'critical-path.md', 'decisions.md', 'log.md', 'measurements.md', 'requirements.md', 'roadmap.config.json', 'sources.md', 'state.md']);
    assert.ok(!('measurements.md' in render(mid())));
    for (const [name, text] of Object.entries(files)) {
      assert.ok(!text.includes('\r'), `${name} tem \\r`);
      assert.ok(text.endsWith('\n'), `${name} sem \\n final`);
    }
    assert.equal(JSON.parse(files['roadmap.config.json']).files.measurements, 'measurements.md');
  });

  it('arestas do Mermaid = edges; nó de bloqueio ligado ao card bloqueado', () => {
    const m = defaulted(full());
    const text = renderFiles(m)['critical-path.md'];
    const edges = [...text.matchAll(/^\s*(E\d+)\s*-->\s*(E\d+)/gm)].map((x) => `${x[1]}>${x[2]}`).sort();
    const expected = deriveGraph(m.deliverables).edges.map(([a, b]) => `${a}>${b}`).sort();
    assert.deepEqual(edges, expected);
    assert.match(text, /BLQ1\["BLQ-1: Billing account not opened"\]/);
    assert.match(text, /BLQ1\s*-->\s*E5/);
    for (const d of m.deliverables) assert.match(text, new RegExp(`^\\s*${d.id}\\s*$`, 'm'));
    const g = deriveGraph(m.deliverables);
    assert.ok(text.includes(`Critical path: ${g.chain.join(' -> ')}.`));
    assert.match(text, /state\.md/);
  });

  it('requirements.md: Entregáveis e Cobertura vêm de deriveCoverage', () => {
    const m = defaulted(full());
    const rows = parsed(renderFiles(m)).blocks.requirements.requirements.rows;
    const cov = deriveCoverage(m.requirements, m.deliverables, m.vocab).rows;
    assert.equal(rows.length, cov.length);
    cov.forEach((c, i) => {
      assert.equal(rows[i][0], c.id);
      assert.equal(rows[i][4], c.deliverables.length ? c.deliverables.join(', ') : '-');
      assert.equal(rows[i][5], c.coverage);
    });
  });

  it('state.md: uma linha por card, bloqueado cita BLQ-1 e a linha do bloqueio restaura', () => {
    const m = defaulted(full());
    const state = parsed(renderFiles(m)).blocks.state;
    const panel = state.panel.rows;
    assert.equal(panel.length, m.deliverables.length);
    const e5 = panel.find((r) => r[0] === 'E5').join(' ');
    assert.ok(e5.includes('blocked'));
    assert.ok(e5.includes('BLQ-1'));
    assert.equal(panel.find((r) => r[0] === 'E1')[1], 'not-started');
    const blockers = state.blockers.rows;
    assert.equal(blockers.length, 1);
    assert.match(blockers[0][4], /restores E5 to not-started/);
    assert.equal(blockers[0][2], 'E5');
    assert.equal(state.pending.items[0], '(owner) Open the billing account');
    assert.equal(state.inflight.rows.length, 0);
    assert.ok(!state.donot.present && !state.releases.present);
  });

  it('pt: restaura E<n> para <primeiro status>; donot e releases só quando presentes', () => {
    const m = full(); m.language = 'pt-BR';
    m.donot = ['Não fazer E5 até BLQ-1 liberar.'];
    m.releases = [{ package: 'pkg-1', deliverables: ['E1'], state: 'publicado', sha: 'abcdef1', date: '2026-01-02', environment: 'local' }];
    const files = render(m);
    const state = parsed(files).blocks.state;
    assert.match(state.blockers.rows[0][4], /restaura E5 para nao-iniciado/);
    assert.deepEqual(state.donot.items, ['Não fazer E5 até BLQ-1 liberar.']);
    assert.equal(state.releases.rows.length, 1);
    assert.match(files['state.md'], /^Estratégia v1\.0 -- 2026-01-01/);
    assert.match(files['critical-path.md'], /Caminho crítico:/);
    assert.match(files['README.md'], /donot/);
  });

  it('log.md tem uma linha com a data do modelo e a estratégia como evidência', () => {
    const rows = parsed(render()).blocks.log.log.rows;
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0][0], rows[0][1]], ['2026-01-01', '-']);
    assert.equal(rows[0][3], '`../2026-01-01-roadmap-sample.md`');
  });

  it('sources, decisions, measurements e README chegam inteiros', () => {
    const files = render();
    const b = parsed(files).blocks;
    assert.equal(b.sources.sources.rows.length, 2);
    assert.equal(b.sources.conflicts.items.length, 1);
    assert.equal(b.decisions.decisions.rows[0][0], 'DEC-001');
    assert.equal(b.decisions.decisions.rows[0][8], 'in-force');
    assert.equal(b.measurements.measurements.rows.length, 1);
    assert.match(files['README.md'], /node <roadmap-folder>\/check-roadmap\.mjs/);
    assert.match(files['README.md'], /paid run or measurement/);
    assert.doesNotMatch(render(mid())['README.md'], /paid run or measurement|medição/);
  });

  it('| no texto sai escapado e é relido igual; ordem numérica E2 < E10', () => {
    const m = full();
    m.requirements[0].text = 'Health | status endpoint.';
    m.deliverables.push({ ...structuredClone(m.deliverables[0]), id: 'E10', title: 'Late', depends: [], reqs: [] });
    const files = render(m);
    assert.match(files['requirements.md'], /Health \\\| status endpoint\./);
    assert.equal(parsed(files).blocks.requirements.requirements.rows[0][1], 'Health | status endpoint.');
    assert.deepEqual(parsed(files).blocks.state.panel.rows.map((r) => r[0]), ['E1', 'E2', 'E3', 'E4', 'E5', 'E10']);
  });

  it('quebra de linha em célula recusa com o caminho JSON', () => {
    const m = full(); m.deliverables[2].title = 'Status\npage';
    m.requirements[1].text = 'a\rb';
    assert.throws(() => renderFiles(defaulted(m)), (e) => e instanceof ScaffoldError
      && e.problems.some((p) => p.code === 'multiline-cell' && p.path === 'deliverables[2].title')
      && e.problems.some((p) => p.code === 'multiline-cell' && p.path === 'requirements[1].text'));
  });

  it('é determinística', () => {
    assert.deepEqual(render(), render());
  });
});

describe('generate', () => {
  const defaulted = (m) => applyDefaults(m).model;
  const gen = (m = full()) => generate(defaulted(m), { folder: path.join(os.tmpdir(), 'scaffold-gen-inexistente', 'roadmap') });
  const errors = (res) => res.problems.filter((p) => p.severity === 'error');
  const lf = (s) => s.replace(/\r\n?/g, '\n');
  const strategyOf = (res) => lf(res.files[res.strategyRel]);
  const parsedOf = (res) => parseRoadmapTexts({
    strategy: strategyOf(res),
    files: { state: res.files['state.md'], decisions: res.files['decisions.md'], log: res.files['log.md'], sources: res.files['sources.md'], requirements: res.files['requirements.md'], measurements: res.files['measurements.md'] },
  });
  const tieModel = () => {
    const m = mid();
    const mk = (id, depends, req) => ({
      id, title: `Card ${id}`, phase: 'Base pronta', depends, reqs: [req], why: 'Porque sim.',
      acceptance: [
        { text: `${id} faz a primeira coisa.`, verify: { kind: 'test', evidence: 'node --test a.test.mjs' } },
        { text: `${id} faz a segunda coisa.`, verify: { kind: 'test', evidence: 'node --test b.test.mjs' } },
      ],
    });
    m.requirements = [{ id: 'REQ-001', text: 'Um requisito.', type: 'functional', sources: ['SRC-01'] }];
    m.phases = [{ name: 'Base pronta', entry: 'Resumo aprovado', exit: 'Tudo integrado' }];
    m.deliverables = [mk('E10', [], 'REQ-001'), mk('E11', ['E10'], 'REQ-001'), mk('E2', [], 'REQ-001'), mk('E3', ['E2'], 'REQ-001')];
    return m;
  };

  it('critério 1: modelo completo gera 0 erros e a estratégia bate com o grafo derivado', () => {
    const m = defaulted(full());
    const res = generate(m, { folder: path.join(os.tmpdir(), 'scaffold-gen-inexistente', 'roadmap') });
    assert.deepEqual(errors(res), []);
    const graph = deriveGraph(m.deliverables);
    const parsed = parsedOf(res);
    const critical = parsed.cards.filter((c) => c.critical).map((c) => c.id).sort(compareIds);
    assert.deepEqual(critical, [...graph.critical].sort(compareIds));
    assert.ok(lf(res.files['critical-path.md']).includes(`: ${graph.chain.join(' -> ')}.`));
    // overview e coluna Entregáveis dos requisitos batem com os cards
    const strategy = strategyOf(res);
    for (const c of m.deliverables) {
      assert.ok(strategy.includes(`| ${c.id} | ${c.title} | ${c.phase} | ${c.depends.length ? c.depends.join(', ') : '-'} |`), c.id);
    }
    const cov = deriveCoverage(m.requirements, m.deliverables, m.vocab).rows;
    for (const row of parsed.blocks.requirements.requirements.rows) {
      assert.equal(row[4], cov.find((r) => r.id === row[0]).deliverables.join(', ') || '-');
    }
    assert.equal(parsed.blocks.strategy.phases.rows.length, m.phases.length);
    assert.equal(parsed.cards.length, m.deliverables.length);
  });

  it('modelo de empate (E10/E11 vs E2/E3) gera 0 erros e a cadeia é E2 -> E3', () => {
    const res = gen(tieModel());
    assert.deepEqual(errors(res), []);
    assert.ok(lf(res.files['critical-path.md']).includes('Caminho crítico: E2 -> E3.'));
  });

  it('critério 2: modelo médio (pt) preserva cada texto da pessoa', () => {
    const m = mid();
    m.decisions = [{ id: 'DEC-001', date: '2026-01-01', title: 'Duas fases', decision: 'Planejar duas fases | com barra.', why: 'Resumo.', status: 'in-force' }];
    const res = gen(m);
    assert.deepEqual(errors(res), []);
    const strategy = strategyOf(res);
    const requirements = lf(res.files['requirements.md']);
    for (const r of m.requirements) assert.ok(requirements.includes(cell(r.text, 'x')), r.id);
    for (const d of m.deliverables) {
      assert.ok(strategy.includes(d.title), d.id);
      for (const a of d.acceptance) assert.ok(strategy.includes(a.text), a.text);
    }
    const sources = lf(res.files['sources.md']);
    for (const s of m.sources) assert.ok(sources.includes(s.source) && sources.includes(s.what), s.id);
    const decisions = lf(res.files['decisions.md']);
    assert.ok(decisions.includes(cell('Planejar duas fases | com barra.', 'x')));
    assert.ok(decisions.includes('fases \\| com'));
    assert.ok(strategy.includes('absorve DEC-001'));
    assert.ok(strategy.includes(m.objective) && strategy.includes(m.thesis));
  });

  it('títulos de seção seguem HEADINGS do idioma', () => {
    const en = strategyOf(gen(full()));
    for (const key of ['changelog', 'objective', 'overview', 'phases', 'deliverables', 'gates', 'crossRisks', 'coverage', 'history', 'sources']) {
      assert.ok(en.includes(`\n## ${HEADINGS.en[key]}\n`), `en ${key}`);
    }
    const pt = strategyOf(gen(mid()));
    for (const key of ['changelog', 'objective', 'nonGoals', 'phases', 'deliverables', 'coverage']) {
      assert.ok(pt.includes(`\n## ${HEADINGS.pt[key]}\n`), `pt ${key}`);
    }
    // sem gates, métricas e flags: seções omitidas
    assert.ok(!pt.includes(`## ${HEADINGS.pt.gates}`) && !pt.includes(`## ${HEADINGS.pt.metrics}`) && !pt.includes(`## ${HEADINGS.pt.flags}`));
    assert.ok(en.startsWith('<!-- roadmap:version 1.0 2026-01-01 -->\n'));
  });

  it('um único critério de aceite faz o checker em memória acusar card-acceptance', () => {
    const m = full();
    m.deliverables[0].acceptance = [m.deliverables[0].acceptance[0]];
    const model = defaulted(m);
    const res = generate(model, { folder: path.join(os.tmpdir(), 'scaffold-gen-inexistente', 'roadmap') });
    assert.ok(res.problems.some((p) => p.severity === 'error' && p.code === 'card-acceptance'), JSON.stringify(res.problems));
  });

  it('quebra de linha em texto da estratégia é recusa multiline-cell com o caminho', () => {
    const m = full();
    m.deliverables[1].acceptance[0].text = 'linha um\nlinha dois';
    assert.throws(() => renderStrategy(defaulted(m)), (e) => e instanceof ScaffoldError
      && e.problems[0].code === 'multiline-cell' && e.problems[0].path === 'deliverables[1].acceptance[0].text');
  });

  it('é determinística e não grava nada', () => {
    const folder = path.join(os.tmpdir(), 'scaffold-gen-inexistente', 'roadmap');
    assert.deepEqual(gen(), gen());
    assert.ok(!fs.existsSync(folder));
  });
});

describe('cli', () => {
  const script = path.join(here, 'scaffold.mjs');
  const checkerSrc = path.join(here, '..', '..', 'roadmap-tracker', 'scripts', 'check-roadmap.mjs');
  const roots = [];
  const sandbox = (name = 'roadmap-x') => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-cli-'));
    roots.push(root);
    spawnSync('git', ['init', '-q', '-b', 'main', root]);
    const folder = path.join(root, name);
    fs.mkdirSync(folder);
    return { root, folder, model: path.join(folder, 'planning-model.json') };
  };
  const put = (box, model, bytes) => fs.writeFileSync(box.model, bytes ?? JSON.stringify(model, null, 2));
  const run = (args, opts = {}) => spawnSync(process.execPath, [script, ...args], { input: '', timeout: 30000, encoding: 'utf8', ...opts });
  const listing = (dir) => fs.readdirSync(dir, { recursive: true }).map((f) => String(f).split(path.sep).join('/')).filter((f) => !f.startsWith('.git/') && f !== '.git').sort();
  const hashes = (root) => Object.fromEntries(listing(root).filter((f) => fs.statSync(path.join(root, f)).isFile())
    .map((f) => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')]));
  const errorsOf = (folder) => checkRoadmap(loadRoadmap(folder), createGitAdapter(folder)).filter((p) => p.severity === 'error');

  process.on('exit', () => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); });

  it('model-full: gera a pasta completa e o checker dá 0 erros', () => {
    const box = sandbox();
    put(box, full());
    const r = run([box.model]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const cfg = JSON.parse(fs.readFileSync(path.join(box.folder, 'roadmap.config.json'), 'utf8'));
    for (const name of Object.values(cfg.files)) if (name) assert.ok(fs.existsSync(path.join(box.folder, name)), name);
    assert.ok(fs.existsSync(path.join(box.folder, cfg.strategy)));
    assert.ok(fs.readFileSync(path.join(box.folder, 'check-roadmap.mjs')).equals(fs.readFileSync(checkerSrc)));
    assert.ok(fs.existsSync(box.model));
    assert.deepEqual(errorsOf(box.folder), []);
  });

  it('critério 2: model-mid com stdin fechado gera tudo, sem perguntar', () => {
    const box = sandbox();
    put(box, mid());
    const r = run([box.model, '--json']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const out = JSON.parse(r.stdout);
    const m = mid();
    assert.ok(out.defaulted.length > 0);
    for (const d of out.defaulted) assert.ok(!hasPath(m, d.path), `${d.path} já está no modelo`);
    assert.deepEqual(errorsOf(box.folder), []);
  });

  it('uso errado com --json: saída na forma de DEC-159 e exit 2', () => {
    const r = run(['--json']);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.tool, 'scaffold');
    assert.equal(out.model, null);
    assert.equal(out.folder, null);
    assert.deepEqual(out.written, []);
    assert.deepEqual(out.defaulted, []);
    assert.deepEqual(out.warnings, []);
    assert.equal(out.errors[0].code, 'usage');
    assert.deepEqual(out.summary, { errors: 1, warnings: 0, exitCode: 2 });
  });

  it('exceção inesperada: exit 2 com erro internal (texto e --json), nada gravado', () => {
    const box = sandbox();
    put(box, full());
    const before = listing(box.root);
    const boom = () => { throw new Error('forced internal failure'); };
    const r = runScaffold(box.model, { _generate: boom });
    assert.equal(r.summary.exitCode, 2);
    assert.equal(r.errors[0].code, 'internal');
    assert.match(r.errors[0].message, /forced internal failure/);
    assert.equal(r.tool, 'scaffold');
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      assert.equal(main([box.model], { _generate: boom }), 2);
      assert.equal(main([box.model, '--json'], { _generate: boom }), 2);
    } finally { console.log = orig; }
    assert.match(logs.join('\n'), /^ERROR internal: .*forced internal failure/m);
    assert.equal(JSON.parse(logs[logs.length - 1]).errors[0].code, 'internal');
    assert.deepEqual(listing(box.root), before);
  });

  it('existing-roadmap: log com linha extra recusa com a saída na mensagem; DEC estranho não recusa', () => {
    const box = sandbox();
    put(box, full());
    assert.equal(run([box.model]).status, 0);
    const before = hashes(box.root);
    const logFile = path.join(box.folder, 'log.md');
    const decFile = path.join(box.folder, 'decisions.md');
    const origLog = fs.readFileSync(logFile, 'utf8');
    const origDec = fs.readFileSync(decFile, 'utf8');
    fs.writeFileSync(logFile, origLog.trimEnd() + '\n| 2026-02-02 | - | evento novo | `x` |\n');
    const afterLog = hashes(box.root);
    const r = run([box.model, '--json']);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(JSON.parse(r.stdout).errors[0].code, 'existing-roadmap');
    assert.deepEqual(hashes(box.root), afterLog);
    assert.match(JSON.parse(r.stdout).errors[0].message, /Stop: update it with roadmap-tracker and delete planning-model\.json/);
    fs.writeFileSync(logFile, origLog);
    // DEC fora do modelo não recusa mais (o tracker sempre acrescenta ao log também)
    fs.writeFileSync(decFile, origDec.trimEnd() + '\n| DEC-099 | 2026-02-02 | - | Extra | - | - | - | - | in-force |\n');
    assert.equal(run([box.model, '--json']).status, 0);
    fs.writeFileSync(decFile, origDec);
    assert.equal(run([box.model]).status, 0);
  });

  it('pt: cabeçalhos de state, sources, requirements e measurements saem em português e o checker aceita (0 erros)', () => {
    const m = full(); m.language = 'pt-BR';
    delete m.vocab;
    m.releases = [{ package: 'pkg-1', deliverables: ['E1'], state: 'publicado', date: '2026-01-02', environment: 'local' }];
    const files = renderFiles(applyDefaults(m).model);
    assert.match(files['state.md'], /\| Entregável \| Status \| Evidência \| Próximo passo \|/);
    assert.match(files['state.md'], /\| ID \| Bloqueio \| Afeta \| Desde \| Desbloqueia quando \|/);
    assert.match(files['state.md'], /\| Branch \| Tipo \| Nota \|/);
    assert.match(files['state.md'], /\| Pacote \| Entregáveis \|/);
    assert.match(files['sources.md'], /\| ID \| Fonte \| O que é \| Lida em \| Confiabilidade \|/);
    assert.match(files['requirements.md'], /\| ID \| Requisito \| Tipo \| Fontes \| Entregáveis \| Cobertura \|/);
    assert.match(files['measurements.md'], /\| Data \| Entregável \| Tipo \| Detalhe \| Registrado \| Faturado \| Status \|/);
    const box = sandbox();
    put(box, m);
    const r = run([box.model]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(errorsOf(box.folder), []);
  });

  it('existing-roadmap lê files do config existente, não do novo', () => {
    const box = sandbox();
    put(box, full());
    assert.equal(run([box.model]).status, 0);
    const logFile = path.join(box.folder, 'log.md');
    fs.writeFileSync(logFile, fs.readFileSync(logFile, 'utf8').trimEnd() + '\n| 2026-02-02 | - | evento novo | `x` |\n');
    const m = full(); m.files = { log: 'registro.md' };
    put(box, m);
    const r = run([box.model, '--json']);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(JSON.parse(r.stdout).errors[0].code, 'existing-roadmap');
  });

  const refusals = {
    'ciclo': (m) => { m.deliverables[0].depends = [m.deliverables[1].id]; m.deliverables[1].depends = [m.deliverables[0].id]; },
    'dependência inexistente': (m) => { m.deliverables[0].depends = ['E99']; },
    'critério sem verify': (m) => { delete m.deliverables[0].acceptance[0].verify; },
  };
  for (const [name, mutate] of Object.entries(refusals)) {
    it(`recusa (${name}): exit 1 e nada gravado`, () => {
      const box = sandbox();
      const m = full();
      mutate(m);
      put(box, m);
      const before = listing(box.root);
      const r = run([box.model]);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.deepEqual(listing(box.root), before);
    });
  }

  it('recusa pasta com roadmap.config.json e sem modelo: existing-roadmap', () => {
    const box = sandbox();
    fs.writeFileSync(path.join(box.folder, 'roadmap.config.json'), '{}');
    const before = listing(box.root);
    const r = run([box.model, '--json']);
    assert.equal(r.status, 1);
    assert.ok(JSON.parse(r.stdout).errors.some((e) => e.code === 'existing-roadmap'));
    assert.deepEqual(listing(box.root), before);
  });

  it('modo completo: objective em texto e cartão sem pieces, dod ou risks geram aviso; modo leve e entrada completa não', () => {
    const warnOf = (m) => { const b = sandbox(); put(b, m); const r = run([b.model, '--dry-run', '--json']); assert.equal(r.status, 0, r.stdout + r.stderr); return JSON.parse(r.stdout); };
    const complete = warnOf(full());
    assert.ok(!complete.warnings.some((w) => w.code === 'objective-plain-text' || w.code === 'card-fields-missing'));
    const f = full();
    f.objective = 'Ship it';
    delete f.deliverables[0].pieces;
    delete f.deliverables[0].dod;
    const out = warnOf(f);
    assert.ok(out.warnings.some((w) => w.code === 'objective-plain-text'));
    const w = out.warnings.find((x) => x.code === 'card-fields-missing');
    assert.ok(w.message.includes(f.deliverables[0].id) && w.message.includes('pieces, dod') && !w.message.includes('risks'));
    assert.equal(out.defaulted.filter((d) => /pieces|dod|risks|objective/.test(d.path)).length, 0);
    const l = full();
    l.mode = 'light';
    l.objective = 'Ship it';
    delete l.deliverables[0].risks;
    const lo = warnOf(l);
    assert.ok(!lo.warnings.some((x) => x.code === 'objective-plain-text' || x.code === 'card-fields-missing'));
  });
  it('--dry-run não grava; --json traz as chaves e o exitCode do processo', () => {
    const box = sandbox();
    put(box, full());
    const before = listing(box.root);
    const r = run([box.model, '--dry-run', '--json']);
    assert.equal(r.status, 0);
    assert.deepEqual(listing(box.root), before);
    const out = JSON.parse(r.stdout);
    for (const k of ['tool', 'model', 'folder', 'written', 'defaulted', 'errors', 'warnings', 'summary']) assert.ok(k in out, k);
    assert.equal(out.summary.exitCode, r.status);
    const bad = sandbox();
    const m = full();
    m.deliverables[0].depends = ['E99'];
    put(bad, m);
    const r2 = run([bad.model, '--json']);
    assert.equal(r2.status, 1);
    assert.equal(JSON.parse(r2.stdout).summary.exitCode, 1);
  });

  it('uso: sem argumento ou opção desconhecida dá exit 2', () => {
    assert.equal(run([]).status, 2);
    assert.equal(run(['--nope']).status, 2);
    const box = sandbox();
    put(box, full());
    assert.equal(run([box.model, '--nope']).status, 2);
  });

  it('determinismo: segunda rodada mantém os bytes, aceita config+modelo e preserva extras', () => {
    const box = sandbox();
    put(box, full());
    assert.equal(run([box.model]).status, 0);
    const first = hashes(box.root);
    fs.writeFileSync(path.join(box.folder, 'extra.txt'), 'meu');
    assert.equal(run([box.model]).status, 0);
    const second = hashes(box.root);
    assert.ok(second['roadmap-x/extra.txt']);
    delete second['roadmap-x/extra.txt'];
    assert.deepEqual(second, first);
    for (const f of Object.keys(first)) {
      if (f.endsWith('check-roadmap.mjs') || f.endsWith('planning-model.json')) continue;
      assert.ok(!fs.readFileSync(path.join(box.root, f), 'utf8').includes('\r'), `${f} tem CR`);
    }
  });

  it('foco 1: modelo com BOM e CRLF gera os mesmos bytes', () => {
    const a = sandbox();
    put(a, full());
    const b = sandbox();
    put(b, null, Buffer.from('﻿' + JSON.stringify(full(), null, 2).replace(/\n/g, '\r\n'), 'utf8'));
    assert.equal(run([a.model]).status, 0);
    assert.equal(run([b.model]).status, 0);
    const skip = (h) => Object.entries(h).filter(([k]) => !k.endsWith('planning-model.json')).map(([k, v]) => [k.replace(/^[^/]+\//, ''), v]);
    assert.deepEqual(skip(hashes(a.root)), skip(hashes(b.root)));
  });

  it('foco 4: pasta com espaço, cwd diferente, caminho relativo', () => {
    const box = sandbox('road map x');
    put(box, full());
    const r = run([path.relative(os.tmpdir(), box.model)], { cwd: os.tmpdir() });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(path.join(box.folder, 'roadmap.config.json')));
  });

  it('runScaffold e main são funções exportadas', () => {
    assert.equal(typeof runScaffold, 'function');
    assert.equal(typeof main, 'function');
  });
});

describe('review-planted fixture', () => {
  const dir = path.join(here, 'fixtures', 'review-planted');
  const repoRoot = path.resolve(here, '..', '..', '..', '..', '..');
  const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');

  it('passa no checker sem erros', () => {
    const r = loadRoadmap(dir);
    const errs = checkRoadmap(r, null).filter((x) => x.severity === 'error');
    assert.deepEqual(errs, []);
  });

  it('expected-findings.json: três defeitos distintos, evidência literal no arquivo', () => {
    const expected = JSON.parse(read(path.join(dir, 'expected-findings.json')));
    assert.equal(expected.length, 3);
    assert.deepEqual(
      expected.map((e) => e.rule).sort(),
      ['compound-requirement', 'unsourced-number', 'unverifiable-criterion'],
    );
    for (const e of expected) {
      assert.equal(e.severity, 'error');
      const abs = path.join(repoRoot, e.file);
      assert.ok(fs.existsSync(abs), `${e.file} não existe`);
      assert.ok(read(abs).includes(e.evidence), `evidência ausente em ${e.file}: ${e.evidence}`);
    }
  });

  it('a pasta não traz checker nem modelo', () => {
    assert.ok(!fs.existsSync(path.join(dir, 'check-roadmap.mjs')));
    assert.ok(!fs.existsSync(path.join(dir, 'planning-model.json')));
  });
});

describe('M1/M2 robustez', () => {
  it('pt: títulos e cabeçalhos de colunas de decisions.md e log.md saem em português', () => {
    const m = full(); m.language = 'pt-BR';
    delete m.vocab;
    const { model } = applyDefaults(m);
    const files = renderFiles(model);
    assert.match(files['decisions.md'], /^# Decisões/m);
    assert.match(files['decisions.md'], /\| ID \| Data \| Entregável \| Decisão \| Alternativa descartada \|/);
    assert.match(files['log.md'], /^# Log/m);
    assert.match(files['log.md'], /\| Data \| Entregável \| O que aconteceu \| Evidência \|/);
    const en = renderFiles(applyDefaults(full()).model);
    assert.match(en['decisions.md'], /^# Decisions/m);
    assert.match(en['log.md'], /\| Date \| Deliverable \| What happened \| Evidence \|/);
  });

  it('item que não é objeto em requirements, decisions e gates: required com caminho', () => {
    for (const key of ['requirements', 'decisions', 'gates', 'sources', 'blockers', 'measurements', 'releases']) {
      const m = full();
      m[key] = [...(m[key] || []), 'texto solto'];
      const at = `${key}[${m[key].length - 1}]`;
      assert.ok(codes(validateModel(m)).includes(`required@${at}`), key);
    }
  });

  it('vocab parcial: required por chave ausente', () => {
    const m = full(); m.vocab = { blockedStatus: 'x' };
    const c = codes(validateModel(m));
    assert.ok(c.includes('required@vocab.deliverableStatuses'), c.join());
    const n = full(); n.vocab = 'nope';
    assert.ok(codes(validateModel(n)).includes('required@vocab'));
  });

  it('runScaffold nunca estoura com requirements/decisions/gates malformados', () => {
    const box = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-m2-'));
    try {
      const m = full(); m.requirements = ['x']; m.decisions = [1]; m.gates = [null]; m.vocab = {};
      const file = path.join(box, 'planning-model.json');
      fs.writeFileSync(file, JSON.stringify(m));
      const r = runScaffold(file);
      assert.equal(r.summary.exitCode, 1);
      assert.ok(r.errors.some((e) => e.code === 'required'));
      assert.ok(r.errors.every((e) => e.code !== 'internal'));
    } finally { fs.rmSync(box, { recursive: true, force: true }); }
  });
});
