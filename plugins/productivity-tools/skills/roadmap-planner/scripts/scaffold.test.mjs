import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateModel, applyDefaults, VOCAB_PT, VOCAB_EN, DEFAULT_TRACKS, DEFAULT_LIMITS, HEADINGS,
  compareIds, deriveGraph, deriveCoverage,
} from './scaffold.mjs';

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
