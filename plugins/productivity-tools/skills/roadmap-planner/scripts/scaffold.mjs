// scaffold: valida o modelo de planejamento (planning-model.json), aplica padrões
// e (nas próximas tarefas) gera a pasta do roadmap. Sem dependências, só Node >= 18.
import { VERIFY_KINDS } from '../../../lib/roadmap-format.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMAT_VERSION, checkRoadmap, validateConfig, createGitAdapter } from '../../roadmap-tracker/scripts/check-roadmap.mjs';

// Bloco `vocab` de docs/plans/roadmap-evolucao-skills/roadmap.config.json, copiado
// (nunca lido em tempo de execução).
export const VOCAB_PT = {
  deliverableStatuses: ['nao-iniciado', 'spec', 'plano', 'executando', 'na-branch', 'integrado', 'publicado', 'medido', 'bloqueado', 'descartado'],
  integratedStatuses: ['integrado', 'publicado', 'medido'],
  releasedStatuses: ['publicado', 'medido'],
  blockedStatus: 'bloqueado',
  discardedStatus: 'descartado',
  decisionInForce: 'vigente',
  decisionPending: 'pendente',
  decisionSupersededBy: 'substituída por',
  coverageCovered: 'coberto',
  coverageOutOfScope: 'fora-de-escopo',
  coverageNeedsClarification: 'a-esclarecer',
  branchLive: 'viva',
  branchDeleted: 'removida',
  markers: ['ASSUMPTION', 'UNSOURCED'],
  bannedPhrases: ['this commit', 'este commit'],
};

// Vocabulário em inglês de formats.md §2.
export const VOCAB_EN = {
  deliverableStatuses: ['not-started', 'spec', 'plan', 'executing', 'on-branch', 'integrated', 'released', 'measured', 'blocked', 'discarded'],
  integratedStatuses: ['integrated', 'released', 'measured'],
  releasedStatuses: ['released', 'measured'],
  blockedStatus: 'blocked',
  discardedStatus: 'discarded',
  decisionInForce: 'in-force',
  decisionPending: 'pending',
  decisionSupersededBy: 'superseded by',
  coverageCovered: 'covered',
  coverageOutOfScope: 'out-of-scope',
  coverageNeedsClarification: 'needs-clarification',
  branchLive: 'live',
  branchDeleted: 'deleted',
  markers: ['ASSUMPTION', 'UNSOURCED'],
  bannedPhrases: ['this commit'],
};

export const DEFAULT_TRACKS = ['engineering', 'decisions', 'external', 'release', 'measurement'];
export const DEFAULT_LIMITS = { nowItems: 5, cellChars: 300, pendingItems: 20 };

// Títulos de seção da estratégia (formats.md §5), por idioma.
export const HEADINGS = {
  en: {
    changelog: 'Changelog', objective: 'Objective', nonGoals: 'Non-goals', assumptions: 'Assumptions',
    whereWeAre: 'Where we are', thesis: 'Thesis', overview: 'Deliverables overview', phases: 'Phases',
    deliverables: 'Deliverables', gates: 'Gates and verification', metrics: 'Metrics and targets', flags: 'Flags',
    crossRisks: 'Cross-cutting risks', decisions: 'Decisions', externalPending: 'External pending items',
    openQuestions: 'Open questions', coverage: 'Coverage summary', history: 'Version history', sources: 'Sources',
  },
  pt: {
    changelog: 'Changelog', objective: 'Objetivo', nonGoals: 'Não objetivos', assumptions: 'Premissas',
    whereWeAre: 'Onde estamos', thesis: 'Tese', overview: 'Visão geral dos entregáveis', phases: 'Fases',
    deliverables: 'Entregáveis', gates: 'Gates e verificação', metrics: 'Métricas e metas', flags: 'Flags',
    crossRisks: 'Riscos transversais', decisions: 'Decisões', externalPending: 'Pendências externas',
    openQuestions: 'Questões em aberto', coverage: 'Resumo de cobertura', history: 'Histórico de versões', sources: 'Fontes',
  },
};

const DEFAULT_FILES = {
  readme: 'README.md', state: 'state.md', decisions: 'decisions.md', log: 'log.md',
  criticalPath: 'critical-path.md', measurements: 'measurements.md', sources: 'sources.md', requirements: 'requirements.md',
};

const isPt = (model) => typeof model?.language === 'string' && /^pt/i.test(model.language);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const err = (path, code, message) => ({ path, code, message });

// Valida o modelo. Devolve [{ path, code, message }]; lista vazia = válido.
// A ordem das mensagens segue a ordem dos campos do modelo.
export function validateModel(model) {
  const errors = [];
  if (!isObj(model)) {
    errors.push(err('', 'required', 'the model must be a JSON object'));
    return errors;
  }

  if (model.modelVersion !== 1) {
    errors.push(err('modelVersion', 'model-version', `modelVersion must be 1 (got ${JSON.stringify(model.modelVersion)})`));
  }
  for (const key of ['date', 'topic', 'title', 'language', 'mode', 'integrationBranch']) {
    if (!isText(model[key])) errors.push(err(key, 'required', `${key} is required`));
  }
  for (const key of ['requirements', 'phases', 'deliverables']) {
    if (!Array.isArray(model[key]) || model[key].length === 0) errors.push(err(key, 'required', `${key} needs at least one entry`));
  }

  const list = (key) => (Array.isArray(model[key]) ? model[key] : []);
  const requirements = list('requirements');
  const phases = list('phases');
  const deliverables = list('deliverables');

  // Ids duplicados (REQ, E, SRC, DEC, BLQ): vale a segunda ocorrência em diante.
  for (const key of ['requirements', 'deliverables', 'sources', 'decisions', 'blockers']) {
    const seen = new Set();
    list(key).forEach((item, i) => {
      const id = item?.id;
      if (!isText(id)) return;
      if (seen.has(id)) errors.push(err(`${key}[${i}].id`, 'duplicate-id', `duplicate id ${id}`));
      seen.add(id);
    });
  }

  const reqIds = new Set(requirements.map((r) => r?.id).filter(isText));
  const phaseNames = new Set(phases.map((p) => p?.name).filter(isText));
  const deliverableIds = new Set(deliverables.map((d) => d?.id).filter(isText));
  const tracks = Array.isArray(model.tracks) ? model.tracks : DEFAULT_TRACKS;

  deliverables.forEach((card, i) => {
    const at = `deliverables[${i}]`;
    if (!isObj(card)) {
      errors.push(err(at, 'required', 'a deliverable must be an object'));
      return;
    }
    for (const key of ['id', 'title', 'phase']) {
      if (!isText(card[key])) errors.push(err(`${at}.${key}`, 'required', `${key} is required`));
    }
    for (const key of ['depends', 'reqs']) {
      if (!Array.isArray(card[key])) errors.push(err(`${at}.${key}`, 'required', `${key} is required (use [] for none)`));
    }
    if (isText(card.phase) && !phaseNames.has(card.phase)) {
      errors.push(err(`${at}.phase`, 'unknown-phase', `phase "${card.phase}" is not in phases`));
    }
    if (card.track !== undefined && !tracks.includes(card.track)) {
      errors.push(err(`${at}.track`, 'unknown-track', `track "${card.track}" is not in tracks (${tracks.join(', ')})`));
    }
    (Array.isArray(card.reqs) ? card.reqs : []).forEach((id, j) => {
      if (!reqIds.has(id)) errors.push(err(`${at}.reqs[${j}]`, 'unknown-req', `${id} is not in requirements`));
    });
    (Array.isArray(card.depends) ? card.depends : []).forEach((id, j) => {
      if (!deliverableIds.has(id)) errors.push(err(`${at}.depends[${j}]`, 'unknown-dependency', `${id} is not a deliverable`));
    });

    const acceptance = Array.isArray(card.acceptance) ? card.acceptance : [];
    if (acceptance.length < 2) {
      errors.push(err(`${at}.acceptance`, 'acceptance-min', `${card.id ?? 'deliverable'} needs at least 2 acceptance criteria (has ${acceptance.length})`));
    }
    acceptance.forEach((item, j) => {
      const ap = `${at}.acceptance[${j}]`;
      if (!isText(item?.text)) errors.push(err(`${ap}.text`, 'required', 'criterion text is required'));
      const verify = item?.verify;
      if (!isObj(verify)) {
        errors.push(err(`${ap}.verify`, 'verify-missing', 'criterion needs verify {kind, evidence}'));
        return;
      }
      if (!VERIFY_KINDS.includes(verify.kind)) {
        errors.push(err(`${ap}.verify.kind`, 'verify-missing', `verify.kind must be one of ${VERIFY_KINDS.join(', ')}`));
      } else if (verify.kind === 'blocked' && !isText(verify.blq)) {
        errors.push(err(`${ap}.verify.blq`, 'verify-blocked-no-blq', 'kind blocked needs the blocking BLQ id in verify.blq'));
      }
      if (!isText(verify.evidence)) errors.push(err(`${ap}.verify.evidence`, 'verify-missing', 'verify.evidence is required'));
    });
  });

  // Ciclos: DFS com cores, na ordem do modelo; cada ciclo é reportado uma vez.
  const index = new Map();
  deliverables.forEach((card, i) => { if (isText(card?.id) && !index.has(card.id)) index.set(card.id, i); });
  const color = new Map(); // 1 = no caminho, 2 = concluído
  const stack = [];
  const visit = (id) => {
    color.set(id, 1);
    stack.push(id);
    const deps = deliverables[index.get(id)]?.depends;
    for (const dep of Array.isArray(deps) ? deps : []) {
      if (!index.has(dep)) continue;
      if (color.get(dep) === 1) {
        const chain = [...stack.slice(stack.indexOf(dep)), dep];
        errors.push(err(`deliverables[${index.get(id)}].depends`, 'cycle', `dependency cycle: ${chain.join(' -> ')}`));
      } else if (!color.has(dep)) {
        visit(dep);
      }
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const id of index.keys()) if (!color.has(id)) visit(id);

  return errors;
}

// Aplica os padrões declarados só aos campos ausentes. Não muta a entrada.
// Devolve { model, defaulted: [{ path, value }] }.
export function applyDefaults(input) {
  const model = structuredClone(input);
  const defaulted = [];
  const pt = isPt(model);
  const set = (obj, key, path, value) => {
    if (obj[key] !== undefined) return false;
    obj[key] = structuredClone(value);
    defaulted.push({ path, value: structuredClone(value) });
    return true;
  };

  set(model, 'vocab', 'vocab', pt ? VOCAB_PT : VOCAB_EN);
  set(model, 'tracks', 'tracks', DEFAULT_TRACKS);
  set(model, 'limits', 'limits', DEFAULT_LIMITS);

  const hasMeasurements = Array.isArray(model.measurements) && model.measurements.length > 0;
  const files = { ...DEFAULT_FILES, measurements: hasMeasurements ? 'measurements.md' : null };
  if (model.files === undefined) {
    model.files = files;
    defaulted.push({ path: 'files', value: structuredClone(files) });
  } else if (isObj(model.files)) {
    for (const [key, value] of Object.entries(files)) {
      if (!(key in model.files)) {
        model.files[key] = value;
        defaulted.push({ path: `files.${key}`, value });
      }
    }
  }

  if (isText(model.date) && isText(model.topic)) {
    set(model, 'strategyPath', 'strategyPath', `../${model.date}-roadmap-${model.topic.replace(/-plan$/, '')}.md`);
  }

  const none = pt ? 'Nenhuma.' : 'None.';
  const notEstimated = pt ? 'não estimado' : 'not estimated';
  const firstTrack = (Array.isArray(model.tracks) && model.tracks[0]) || DEFAULT_TRACKS[0];
  if (Array.isArray(model.deliverables)) {
    model.deliverables.forEach((card, i) => {
      if (!isObj(card)) return;
      const at = `deliverables[${i}]`;
      if ('critical' in card) {
        delete card.critical;
        defaulted.push({ path: `${at}.critical`, value: 'ignored (derived)' });
      }
      set(card, 'priority', `${at}.priority`, 'Must');
      set(card, 'size', `${at}.size`, notEstimated);
      set(card, 'track', `${at}.track`, firstTrack);
    });
  }

  set(model, 'nonGoals', 'nonGoals', [none]);
  set(model, 'thesis', 'thesis', none);
  set(model, 'crossRisks', 'crossRisks', [none]);
  set(model, 'externalPending', 'externalPending', [none]);
  set(model, 'openQuestions', 'openQuestions', [none]);
  set(model, 'gates', 'gates', []);

  if (model.now === undefined && Array.isArray(model.deliverables)) {
    const blocked = model.vocab?.blockedStatus ? ['blocked', model.vocab.blockedStatus] : ['blocked'];
    const discarded = model.vocab?.discardedStatus ? ['discarded', model.vocab.discardedStatus] : ['discarded'];
    const start = pt ? 'Iniciar' : 'Start';
    const now = model.deliverables
      .filter((c) => isObj(c) && Array.isArray(c.depends) && c.depends.length === 0
        && !blocked.includes(c.status) && !discarded.includes(c.status))
      .map((c) => `${start} ${c.id}. Runs: -. Approves: -. Depends on: -.`);
    model.now = now;
    defaulted.push({ path: 'now', value: structuredClone(now) });
  }
  set(model, 'pending', 'pending', []);

  return { model, defaulted };
}

// Ordem por prefixo e depois numérica: E2 < E10, REQ-002 < REQ-010.
export function compareIds(a, b) {
  const parse = (s) => {
    const m = /^(.*?)(\d+)$/.exec(String(s));
    return m ? [m[1], Number(m[2])] : [String(s), -1];
  };
  const [pa, na] = parse(a);
  const [pb, nb] = parse(b);
  if (pa !== pb) return pa < pb ? -1 : 1;
  return na - nb;
}

function compareChains(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const c = compareIds(a[i], b[i]);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

// Grafo de dependências, comprimento da maior cadeia, cards críticos e a primeira
// cadeia máxima em ordem de id. Assume modelo sem ciclo (validateModel recusa antes).
export function deriveGraph(deliverables) {
  const byId = new Map(deliverables.map((d) => [d.id, d]));
  const ids = [...byId.keys()].sort(compareIds);
  const deps = (id) => (byId.get(id).depends || []).filter((d) => byId.has(d));
  const edges = [];
  for (const id of ids) for (const d of deps(id)) edges.push([d, id]);
  edges.sort((x, y) => compareIds(x[0], y[0]) || compareIds(x[1], y[1]));

  const succ = new Map(ids.map((id) => [id, []]));
  for (const [d, c] of edges) succ.get(d).push(c);

  // Ordem topológica (Kahn, desempate por id).
  const indeg = new Map(ids.map((id) => [id, deps(id).length]));
  const ready = ids.filter((id) => indeg.get(id) === 0);
  const topo = [];
  while (ready.length) {
    ready.sort(compareIds);
    const id = ready.shift();
    topo.push(id);
    for (const s of succ.get(id)) {
      indeg.set(s, indeg.get(s) - 1);
      if (indeg.get(s) === 0) ready.push(s);
    }
  }

  const fwd = new Map();
  for (const id of topo) fwd.set(id, 1 + Math.max(0, ...deps(id).map((d) => fwd.get(d))));
  const bwd = new Map();
  for (const id of [...topo].reverse()) bwd.set(id, 1 + Math.max(0, ...succ.get(id).map((s) => bwd.get(s))));
  const longest = topo.length ? Math.max(...topo.map((id) => fwd.get(id))) : 0;
  const critical = new Set(topo.filter((id) => fwd.get(id) + bwd.get(id) - 1 === longest));

  // Primeira cadeia máxima: começa no menor id crítico sem predecessor crítico e
  // segue sempre o menor sucessor crítico que continua numa cadeia máxima.
  const chain = [];
  if (longest > 0) {
    let cur = ids.find((id) => critical.has(id) && fwd.get(id) === 1);
    while (cur !== undefined) {
      chain.push(cur);
      cur = succ.get(cur).filter((s) => critical.has(s) && fwd.get(s) === fwd.get(cur) + 1).sort(compareIds)[0];
    }
  }
  return { edges, longest, critical, chain };
}

// Cobertura derivada: inverte os `reqs` dos cards e conta o resumo.
export function deriveCoverage(requirements, deliverables, vocab) {
  const rows = [];
  const summary = { covered: 0, outOfScope: 0, needsClarification: 0 };
  for (const r of requirements) {
    const cards = deliverables.filter((d) => (d.reqs || []).includes(r.id)).map((d) => d.id).sort(compareIds);
    const kind = r.coverage && r.coverage.kind;
    let coverage;
    if (kind === 'out-of-scope') {
      coverage = r.coverage.reason ? `${vocab.coverageOutOfScope}: ${r.coverage.reason}` : vocab.coverageOutOfScope;
      summary.outOfScope++;
    } else if (kind === 'needs-clarification') {
      coverage = vocab.coverageNeedsClarification;
      summary.needsClarification++;
    } else {
      coverage = vocab.coverageCovered;
      summary.covered++;
    }
    rows.push({ id: r.id, deliverables: cards, coverage });
  }
  rows.sort((a, b) => compareIds(a.id, b.id));
  return { rows, summary };
}

// ---------- renderização dos arquivos da pasta (Tarefa 3) ----------

export class ScaffoldError extends Error {
  constructor(problems) {
    super(problems.map((p) => `${p.path}: ${p.message}`).join('; '));
    this.name = 'ScaffoldError';
    this.problems = problems;
    this.path = problems[0]?.path;
    this.code = problems[0]?.code;
  }
}

const MULTILINE = /[\r\n]/;
const multilineProblem = (path) => err(path, 'multiline-cell', `${path} must be a single line (no line break)`);

// Valor de célula de tabela: `|` vira `\|`; quebra de linha é recusa.
export function cell(text, path) {
  const s = String(text ?? '');
  if (MULTILINE.test(s)) throw new ScaffoldError([multilineProblem(path)]);
  return s.replace(/\|/g, '\\|');
}

const TEXT = {
  en: {
    strategy: 'Strategy', created: 'Roadmap created', criticalPath: 'Critical path', nextGate: 'Next gate per track',
    seeState: 'see `state.md`', restores: (id, status) => `restores ${id} to ${status}`,
    readmeTitle: (t) => `${t} roadmap -- tracking folder`,
    readmeIntro: (s) => `Living tracking for the roadmap. Strategy: \`${s}\`.`,
    files: 'Files', file: 'File', nature: 'Nature', check: 'Check', whenToUpdate: 'When to update', event: 'Event', update: 'Update',
    folder: '<roadmap-folder>',
    checkText: (f) => `Run \`node ${f}/check-roadmap.mjs\` (Node 18 or newer). Exit 1 on errors; warnings pass; exit 2 is an unexpected failure (\`ERROR internal\`). In CI add \`--require-git\` so that skipped git checks fail instead of passing silently.`,
    nature_: {
      state: 'Overwritten snapshot: Now, panel, blockers, pending, in flight', decisions: 'Append-only decisions', log: 'Append-only events, newest first',
      criticalPath: 'Dependency graph and next gates', sources: 'Source inventory and conflicts', requirements: 'Requirements and their coverage',
      measurements: 'Runs, costs and measurement milestones', config: 'Paths, vocabulary, limits',
    },
    headers: { decisions: 'Decisions', log: 'Log', sources: 'Sources', requirements: 'Requirements', conflicts: 'Conflicts', criticalPath: 'Critical path', measurements: 'Measurements' },
    rows: {
      decision: ['A decision is made', '`decisions.md` first, then whatever uses it'],
      step: ['A piece or step closes', '`log.md` and the panel in `state.md`'],
      branch: ['A branch is integrated or deleted', '"in flight" in `state.md` and `log.md`'],
      measure: ['A paid run or measurement', '`measurements.md` and `log.md`'],
      blocker: ['A blocker opens or closes', '`state.md` and `critical-path.md`'],
      release: ['A package is published', 'the `releases` block in `state.md` (only if the folder has one), and `log.md`'],
      donot: ['The "do not do now" list changes', 'the `donot` block in `state.md` (only if the folder has one)'],
      revision: ['A piece or phase ends', 'propose a strategy revision'],
    },
  },
  pt: {
    strategy: 'Estratégia', created: 'Roadmap criado', criticalPath: 'Caminho crítico', nextGate: 'Próximo gate por trilha',
    seeState: 'ver `state.md`', restores: (id, status) => `restaura ${id} para ${status}`,
    readmeTitle: (t) => `Roadmap ${t} -- pasta de acompanhamento`,
    readmeIntro: (s) => `Acompanhamento vivo do roadmap. Estratégia: \`${s}\`.`,
    files: 'Arquivos', file: 'Arquivo', nature: 'Natureza', check: 'Verificação', whenToUpdate: 'Quando atualizar', event: 'Evento', update: 'Atualizar',
    folder: '<pasta-do-roadmap>',
    checkText: (f) => `Rode \`node ${f}/check-roadmap.mjs\` (Node 18 ou mais novo). Sai com 1 em erros; avisos passam; saída 2 é falha inesperada (\`ERROR internal\`). Em CI use \`--require-git\` para que as conferências de git puladas falhem em vez de passar em silêncio.`,
    nature_: {
      state: 'Retrato sobrescrito: Agora, painel, bloqueios, pendências, em andamento', decisions: 'Decisões, só acrescenta', log: 'Eventos, só acrescenta, mais novo primeiro',
      criticalPath: 'Grafo de dependências e próximos gates', sources: 'Inventário de fontes e conflitos', requirements: 'Requisitos e sua cobertura',
      measurements: 'Execuções, custos e marcos de medição', config: 'Caminhos, vocabulário, limites',
    },
    headers: { decisions: 'Decisões', log: 'Log', sources: 'Fontes', requirements: 'Requisitos', conflicts: 'Conflitos', criticalPath: 'Caminho crítico', measurements: 'Medições' },
    rows: {
      decision: ['Uma decisão é tomada', '`decisions.md` primeiro, depois o que a usa'],
      step: ['Uma peça ou passo fecha', '`log.md` e o painel em `state.md`'],
      branch: ['Uma branch é integrada ou removida', '"em andamento" em `state.md` e `log.md`'],
      measure: ['Uma execução paga ou medição', '`measurements.md` e `log.md`'],
      blocker: ['Um bloqueio abre ou fecha', '`state.md` e `critical-path.md`'],
      release: ['Um pacote é publicado', 'o bloco `releases` em `state.md` (só se a pasta tiver um) e `log.md`'],
      donot: ['A lista "não fazer agora" muda', 'o bloco `donot` em `state.md` (só se a pasta tiver um)'],
      revision: ['Uma peça ou fase termina', 'propor uma revisão da estratégia'],
    },
  },
};

const textFor = (model) => (isPt(model) ? TEXT.pt : TEXT.en);
const arr = (v) => (Array.isArray(v) ? v : []);
const dash = (v) => (isText(v) ? v : '-');
const blockedWords = (model) => ['blocked', model.vocab.blockedStatus];
const discardedWords = (model) => ['discarded', model.vocab.discardedStatus];

// Recusa quebra de linha em todo texto que vira célula de tabela ou item de lista,
// reunindo todos os problemas (caminho JSON de cada campo) numa só exceção.
function checkSingleLine(model) {
  const problems = [];
  const check = (value, path) => {
    if (typeof value === 'string' && MULTILINE.test(value)) problems.push(multilineProblem(path));
  };
  const fields = (key, names) => arr(model[key]).forEach((item, i) => {
    if (!isObj(item)) return;
    for (const n of names) check(item[n], `${key}[${i}].${n}`);
  });
  check(model.title, 'title');
  fields('sources', ['id', 'source', 'what', 'readOn', 'reliability']);
  arr(model.conflicts).forEach((c, i) => check(c, `conflicts[${i}]`));
  fields('decisions', ['id', 'date', 'title', 'decision', 'deliverable', 'discarded', 'contradicts', 'revisit', 'origin', 'status']);
  fields('requirements', ['id', 'text', 'type']);
  fields('phases', ['name', 'entry', 'exit']);
  fields('deliverables', ['id', 'title', 'phase']);
  fields('blockers', ['id', 'text', 'owner', 'since', 'unblocksWhen']);
  fields('measurements', ['date', 'deliverable', 'kind', 'detail', 'recorded', 'billed', 'status']);
  fields('releases', ['package', 'state', 'sha', 'date', 'environment']);
  arr(model.now).forEach((c, i) => check(c, `now[${i}]`));
  arr(model.donot).forEach((c, i) => check(c, `donot[${i}]`));
  arr(model.pending).forEach((p, i) => check(isObj(p) ? p.text : p, `pending[${i}]${isObj(p) ? '.text' : ''}`));
  if (problems.length) throw new ScaffoldError(problems);
}

// O `roadmap.config.json` de formats.md §2.
export function buildConfig(model) {
  const hasMeasurements = arr(model.measurements).length > 0;
  const files = { ...model.files };
  files.measurements = hasMeasurements ? (files.measurements ?? DEFAULT_FILES.measurements) : null;
  const config = {
    formatVersion: FORMAT_VERSION,
    language: model.language,
    strategy: model.strategyPath,
    integrationBranch: model.integrationBranch,
  };
  if (isText(model.releaseBranch)) config.releaseBranch = model.releaseBranch;
  config.files = files;
  config.vocab = structuredClone(model.vocab);
  config.tracks = structuredClone(model.tracks);
  config.limits = structuredClone(model.limits);
  return config;
}

const table = (header, rows) => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
];
const block = (name, lines) => [`<!-- roadmap:${name} -->`, ...lines, `<!-- /roadmap:${name} -->`];
const sortedCards = (model) => [...model.deliverables].sort((a, b) => compareIds(a.id, b.id));

// BLQ que bloqueia cada card: o `blq` do card e os `blocks` de cada blocker.
function blockersOf(model) {
  const map = new Map();
  const add = (card, blq) => {
    if (!map.has(card)) map.set(card, []);
    if (!map.get(card).includes(blq)) map.get(card).push(blq);
  };
  for (const c of model.deliverables) if (isText(c.blq)) add(c.id, c.blq);
  for (const b of arr(model.blockers)) for (const card of arr(b.blocks)) add(card, b.id);
  return map;
}

function renderState(model, t) {
  const v = model.vocab;
  const first = v.deliverableStatuses[0];
  const blockedBy = blockersOf(model);
  const panel = sortedCards(model).map((c) => {
    const i = model.deliverables.indexOf(c);
    const blq = blockedBy.get(c.id)?.[0];
    let status = first;
    if (blockedWords(model).includes(c.status)) status = blq ? `${v.blockedStatus} (${blq})` : v.blockedStatus;
    else if (discardedWords(model).includes(c.status)) status = v.discardedStatus;
    return [cell(c.id, `deliverables[${i}].id`), cell(status, `deliverables[${i}].status`), '-', blq && status.startsWith(v.blockedStatus) ? blq : '-'];
  });
  const blockers = arr(model.blockers).map((b, i) => {
    const affected = arr(b.blocks);
    const restores = affected.map((id) => t.restores(id, first)).join('; ');
    const unblocks = isText(b.unblocksWhen) ? `${b.unblocksWhen}; ${restores}` : restores;
    return [cell(b.id, `blockers[${i}].id`), cell(b.text, `blockers[${i}].text`), cell(affected.join(', '), `blockers[${i}].blocks`),
      cell(b.since ?? model.date, `blockers[${i}].since`), cell(unblocks, `blockers[${i}].unblocksWhen`)];
  });
  const lines = [`${t.strategy} v1.0 -- ${model.date}`, ''];
  lines.push(...block('now', arr(model.now).map((x, i) => `${i + 1}. ${x}`)));
  lines.push(...block('panel', table(['Deliverable', 'Status', 'Evidence', 'Next step'], panel)));
  lines.push(...block('blockers', table(['ID', 'Blocker', 'Affects', 'Since', 'Unblocks when'], blockers)));
  lines.push(...block('pending', arr(model.pending).map((p) => (isObj(p) ? `- (${p.owner}) ${p.text}` : `- ${p}`))));
  lines.push(...block('inflight', table(['Branch', 'Kind', 'Note'], [])));
  if (arr(model.donot).length) lines.push(...block('donot', model.donot.map((x) => `- ${x}`)));
  if (arr(model.releases).length) {
    const rows = model.releases.map((r, i) => {
      const at = `releases[${i}]`;
      const deliverables = Array.isArray(r.deliverables) ? r.deliverables.join(' ') : r.deliverables;
      return [cell(r.package, `${at}.package`), cell(deliverables, `${at}.deliverables`), cell(r.state, `${at}.state`),
        isText(r.sha) ? `\`${cell(r.sha, `${at}.sha`)}\`` : '-', cell(r.date, `${at}.date`), cell(dash(r.environment), `${at}.environment`)];
    });
    lines.push(...block('releases', table(['Package', 'Deliverables', 'State', 'Stamped SHA', 'Date', 'Environment'], rows)));
  }
  return lines.join('\n') + '\n';
}

function renderDecisions(model) {
  const v = model.vocab;
  const statusWord = (s) => ({ 'in-force': v.decisionInForce, pending: v.decisionPending }[s] ?? s);
  const rows = arr(model.decisions).map((d, i) => {
    const at = `decisions[${i}]`;
    const decision = isText(d.title) ? `${d.title}: ${d.decision}` : d.decision;
    return [cell(d.id, `${at}.id`), cell(d.date, `${at}.date`), cell(dash(d.deliverable), `${at}.deliverable`), cell(decision, `${at}.decision`),
      cell(dash(d.discarded), `${at}.discarded`), cell(dash(d.contradicts), `${at}.contradicts`), cell(dash(d.revisit), `${at}.revisit`),
      cell(dash(d.origin), `${at}.origin`), cell(statusWord(d.status), `${at}.status`)];
  });
  const lines = ['# Decisions', '', ...block('decisions', table(['ID', 'Date', 'Deliverable', 'Decision', 'Discarded alternative', 'Contradicts', 'Revisit when', 'Origin', 'Status'], rows))];
  return lines.join('\n') + '\n';
}

function renderLog(model, t) {
  const rows = [[cell(model.date, 'date'), '-', t.created, `\`${cell(model.strategyPath, 'strategyPath')}\``]];
  return ['# Log', '', ...block('log', table(['Date', 'Deliverable', 'What happened', 'Evidence'], rows))].join('\n') + '\n';
}

function renderSources(model, t) {
  const rows = arr(model.sources).map((s, i) => {
    const at = `sources[${i}]`;
    return [cell(s.id, `${at}.id`), `\`${cell(s.source, `${at}.source`)}\``, cell(s.what, `${at}.what`), cell(s.readOn, `${at}.readOn`), cell(s.reliability, `${at}.reliability`)];
  });
  const lines = [`# ${t.headers.sources}`, '', ...block('sources', table(['ID', 'Source', 'What it is', 'Read on', 'Reliability'], rows)),
    '', `## ${t.headers.conflicts}`, '', ...block('conflicts', arr(model.conflicts).map((c) => `- ${c}`))];
  return lines.join('\n') + '\n';
}

function renderRequirements(model, t) {
  const byId = new Map(model.requirements.map((r, i) => [r.id, [r, i]]));
  const rows = deriveCoverage(model.requirements, model.deliverables, model.vocab).rows.map((c) => {
    const [r, i] = byId.get(c.id);
    const at = `requirements[${i}]`;
    return [cell(r.id, `${at}.id`), cell(r.text, `${at}.text`), cell(dash(r.type), `${at}.type`), cell(arr(r.sources).join(', ') || '-', `${at}.sources`),
      c.deliverables.length ? c.deliverables.join(', ') : '-', cell(c.coverage, `${at}.coverage`)];
  });
  return [`# ${t.headers.requirements}`, '', ...block('requirements', table(['ID', 'Requirement', 'Type', 'Sources', 'Deliverables', 'Coverage'], rows))].join('\n') + '\n';
}

function renderCriticalPath(model, t) {
  const graph = deriveGraph(model.deliverables);
  const blockedBy = blockersOf(model);
  const mermaid = ['graph LR'];
  for (const c of sortedCards(model)) mermaid.push(`  ${c.id}`);
  for (const [a, b] of graph.edges) mermaid.push(`  ${a} --> ${b}`);
  const texts = new Map((model.blockers || []).map((b) => [b.id, b.text]));
  const blqs = [...new Set([...blockedBy.values()].flat())].sort(compareIds);
  for (const blq of blqs) {
    const label = String(texts.get(blq) ?? '').replace(/"/g, "'");
    mermaid.push(`  ${blq.replace(/-/g, '')}["${label ? `${blq}: ${label}` : blq}"]`);
  }
  for (const blq of blqs) {
    for (const card of sortedCards(model)) {
      if (blockedBy.get(card.id)?.includes(blq)) mermaid.push(`  ${blq.replace(/-/g, '')} --> ${card.id}`);
    }
  }
  const chain = graph.chain.length ? graph.chain.join(' -> ') : '-';
  return [`# ${t.headers.criticalPath}`, '', '```mermaid', ...mermaid, '```', '',
    `${t.criticalPath}: ${chain}. ${t.nextGate}: ${t.seeState}.`].join('\n') + '\n';
}

function renderMeasurements(model, t) {
  const rows = arr(model.measurements).map((m, i) => {
    const at = `measurements[${i}]`;
    return ['date', 'deliverable', 'kind', 'detail', 'recorded', 'billed', 'status'].map((k) => cell(dash(m[k]), `${at}.${k}`));
  });
  return [`# ${t.headers.measurements}`, '', ...block('measurements', table(['Date', 'Deliverable', 'Kind', 'Detail', 'Recorded', 'Billed', 'Status'], rows))].join('\n') + '\n';
}

function renderReadme(model, t, config) {
  const list = [['state.md', 'state'], ['decisions.md', 'decisions'], ['log.md', 'log'], ['critical-path.md', 'criticalPath'],
    ['sources.md', 'sources'], ['requirements.md', 'requirements'], ['measurements.md', 'measurements']];
  const roleOf = { state: 'state', decisions: 'decisions', log: 'log', criticalPath: 'criticalPath', sources: 'sources', requirements: 'requirements', measurements: 'measurements' };
  const fileRows = [];
  for (const [, role] of list) {
    const name = config.files[roleOf[role]];
    if (name) fileRows.push([`\`${name}\``, t.nature_[role]]);
  }
  fileRows.push(['`roadmap.config.json`', t.nature_.config]);
  const hasDonot = arr(model.donot).length > 0;
  const hasReleases = arr(model.releases).length > 0;
  const r = t.rows;
  const events = [r.decision, r.step, r.branch];
  if (config.files.measurements) events.push(r.measure);
  events.push(r.blocker);
  if (hasReleases) events.push(r.release);
  if (hasDonot) events.push(r.donot);
  events.push(r.revision);
  const lines = [`# ${t.readmeTitle(model.title)}`, '', t.readmeIntro(model.strategyPath), '',
    `## ${t.files}`, ...table([t.file, t.nature], fileRows), '',
    `## ${t.check}`, t.checkText(t.folder), '',
    `## ${t.whenToUpdate}`, ...table([t.event, t.update], events)];
  return lines.join('\n') + '\n';
}

// Renderiza todos os arquivos da pasta: nome -> texto (LF, terminado em \n).
// Espera o modelo já com padrões aplicados (applyDefaults).
export function renderFiles(model) {
  checkSingleLine(model);
  const t = textFor(model);
  const config = buildConfig(model);
  const out = {};
  out[config.files.readme] = renderReadme(model, t, config);
  out[config.files.state] = renderState(model, t);
  out[config.files.decisions] = renderDecisions(model);
  out[config.files.log] = renderLog(model, t);
  out[config.files.criticalPath] = renderCriticalPath(model, t);
  out[config.files.sources] = renderSources(model, t);
  out[config.files.requirements] = renderRequirements(model, t);
  if (config.files.measurements) out[config.files.measurements] = renderMeasurements(model, t);
  out['roadmap.config.json'] = JSON.stringify(config, null, 2) + '\n';
  return out;
}

// ---------- estratégia v1.0 e checker em memória (Tarefa 4) ----------

const STRATEGY_TEXT = {
  en: {
    strategy: 'Strategy', firstVersion: (mode) => `first version (${mode === 'light' ? 'light' : 'full'} mode)`, absorbs: 'absorbs',
    acceptanceCriterion: 'Acceptance criterion', definitionOfDone: 'Definition of done', why: 'Why', pieces: 'Pieces (vertical slices, each shippable alone):',
    none: 'None.', seeDecisions: (f) => `See ${f}.`, seeSources: (f) => `See ${f}.`, firstVersionRow: 'First version',
    whereWeAre: (n, p, chain) => `${n} deliverables in ${p} phases. Critical path: ${chain}. Current state: see state.md.`,
    coverage: (s) => `${s.covered} covered, ${s.outOfScope} out of scope, ${s.needsClarification} to clarify`,
    assumption: ['Assumption', 'Owner', 'Re-validate when'], overview: ['ID', 'Title', 'Phase', 'Depends on'],
    phases: ['Phase (outcome)', 'Entry criteria', 'Exit criteria', 'Deliverables'], gates: ['ID', 'Command', 'Environment', 'When', 'Baseline'],
    history: ['Version', 'Date', 'Summary'],
  },
  pt: {
    strategy: 'Estratégia', firstVersion: (mode) => `primeira versão (modo ${mode === 'light' ? 'leve' : 'completo'})`, absorbs: 'absorve',
    acceptanceCriterion: 'Critério de aceite', definitionOfDone: 'Definição de pronto', why: 'Por quê', pieces: 'Peças (fatias verticais, cada uma entregável sozinha):',
    none: 'Nenhuma.', seeDecisions: (f) => `Ver ${f}.`, seeSources: (f) => `Ver ${f}.`, firstVersionRow: 'Primeira versão',
    whereWeAre: (n, p, chain) => `${n} entregáveis em ${p} fases. Caminho crítico: ${chain}. Estado atual: ver state.md.`,
    coverage: (s) => `${s.covered} cobertos, ${s.outOfScope} fora de escopo, ${s.needsClarification} a esclarecer`,
    assumption: ['Premissa', 'Dono', 'Revalidar quando'], overview: ['ID', 'Título', 'Fase', 'Depende de'],
    phases: ['Fase (resultado)', 'Critérios de entrada', 'Critérios de saída', 'Entregáveis'], gates: ['ID', 'Comando', 'Ambiente', 'Quando', 'Linha de base'],
    history: ['Versão', 'Data', 'Resumo'],
  },
};

// Texto de lista/parágrafo da estratégia: quebra de linha é recusa (um item por linha).
function checkStrategyLines(model) {
  const problems = [];
  const check = (value, p) => {
    if (typeof value === 'string' && MULTILINE.test(value)) problems.push(multilineProblem(p));
  };
  const objective = model.objective;
  if (isObj(objective)) for (const k of ['text', 'acceptance', 'done']) check(objective[k], `objective.${k}`);
  else check(objective, 'objective');
  check(model.thesis, 'thesis');
  for (const key of ['nonGoals', 'crossRisks', 'externalPending', 'openQuestions']) arr(model[key]).forEach((x, i) => check(x, `${key}[${i}]`));
  for (const key of ['metrics', 'flags']) {
    if (Array.isArray(model[key])) model[key].forEach((x, i) => check(x, `${key}[${i}]`));
    else check(model[key], key);
  }
  arr(model.assumptions).forEach((a, i) => { for (const k of ['text', 'owner', 'revalidate']) check(a?.[k], `assumptions[${i}].${k}`); });
  arr(model.gates).forEach((g, i) => { for (const k of ['id', 'command', 'environment', 'when', 'baseline']) check(g?.[k], `gates[${i}].${k}`); });
  model.deliverables.forEach((c, i) => {
    check(c.why, `deliverables[${i}].why`);
    check(c.dod, `deliverables[${i}].dod`);
    arr(c.pieces).forEach((x, j) => check(x, `deliverables[${i}].pieces[${j}]`));
    arr(c.risks).forEach((x, j) => check(x, `deliverables[${i}].risks[${j}]`));
    arr(c.acceptance).forEach((a, j) => {
      check(a?.text, `deliverables[${i}].acceptance[${j}].text`);
      check(a?.verify?.evidence, `deliverables[${i}].acceptance[${j}].verify.evidence`);
    });
  });
  if (problems.length) throw new ScaffoldError(problems);
}

const stripDot = (s) => String(s).trim().replace(/\.+$/, '');
const attrValue = (v) => (/[\s"]/.test(v) ? `"${String(v).replace(/"/g, "'")}"` : v);
const listOrNone = (items, none) => (arr(items).length ? arr(items).map((x) => `- ${x}`) : [`- ${none}`]);
const textList = (v) => (Array.isArray(v) ? v : isText(v) ? [v] : []);

// Estratégia v1.0 (formats.md §5), com os títulos de HEADINGS[idioma].
export function renderStrategy(model) {
  checkSingleLine(model);
  checkStrategyLines(model);
  const pt = isPt(model);
  const h = HEADINGS[pt ? 'pt' : 'en'];
  const t = STRATEGY_TEXT[pt ? 'pt' : 'en'];
  const config = buildConfig(model);
  const graph = deriveGraph(model.deliverables);
  const cards = sortedCards(model);
  const idx = (c) => model.deliverables.indexOf(c);
  const none = t.none;
  const L = [];
  const section = (title, ...body) => { L.push('', `## ${title}`, ...body); };

  L.push(`<!-- roadmap:version 1.0 ${model.date} -->`, `# ${model.title} -- ${t.strategy} v1.0`);

  const decIds = arr(model.decisions).map((d) => d.id).filter(isText);
  section(h.changelog, `- v1.0 (${model.date}): ${t.firstVersion(model.mode)}${decIds.length ? `; ${t.absorbs} ${decIds.join(', ')}` : ''}.`);

  const o = model.objective;
  let objective = none;
  if (isObj(o)) {
    const parts = [stripDot(o.text ?? '')];
    if (isText(o.acceptance)) parts.push(`${t.acceptanceCriterion}: ${stripDot(o.acceptance)}`);
    if (isText(o.done)) parts.push(`${t.definitionOfDone}: ${stripDot(o.done)}`);
    objective = parts.filter((x) => x !== '').join('. ') + '.';
  } else if (isText(o)) {
    objective = o;
  }
  section(h.objective, objective);

  section(h.nonGoals, ...listOrNone(model.nonGoals, none));

  const assumptions = arr(model.assumptions);
  if (assumptions.length) {
    const rows = assumptions.map((a, i) => [cell(/^ASSUMPTION:/.test(a.text) ? a.text : `ASSUMPTION: ${a.text}`, `assumptions[${i}].text`),
      cell(dash(a.owner), `assumptions[${i}].owner`), cell(dash(a.revalidate), `assumptions[${i}].revalidate`)]);
    section(h.assumptions, ...table(t.assumption, rows));
  } else {
    section(h.assumptions, none);
  }

  section(h.whereWeAre, t.whereWeAre(model.deliverables.length, model.phases.length, graph.chain.length ? graph.chain.join(' -> ') : '-'));
  section(h.thesis, isText(model.thesis) ? model.thesis : none);

  const dependsOf = (c) => (arr(c.depends).length ? [...c.depends].sort(compareIds).join(', ') : '-');
  section(h.overview, ...table(t.overview, cards.map((c) => [cell(c.id, `deliverables[${idx(c)}].id`), cell(c.title, `deliverables[${idx(c)}].title`),
    cell(c.phase, `deliverables[${idx(c)}].phase`), dependsOf(c)])));

  const phaseRows = model.phases.map((p, i) => [cell(p.name, `phases[${i}].name`), cell(dash(p.entry), `phases[${i}].entry`), cell(dash(p.exit), `phases[${i}].exit`),
    cards.filter((c) => c.phase === p.name).map((c) => c.id).join(', ') || '-']);
  section(h.phases, ...block('phases', table(t.phases, phaseRows)));

  section(h.deliverables);
  for (const c of cards) {
    const attrs = [`id=${c.id}`, `phase=${attrValue(c.phase)}`, `track=${attrValue(c.track)}`, `priority=${attrValue(c.priority)}`, `size=${attrValue(c.size)}`,
      `depends=${dependsOf(c).replace(/, /g, ',')}`, `reqs=${arr(c.reqs).length ? c.reqs.join(',') : '-'}`, `critical=${graph.critical.has(c.id)}`];
    L.push('', `<!-- roadmap:card ${attrs.join(' ')} -->`, `### ${c.id} -- ${c.title}`, '');
    L.push(`${t.why}: ${arr(c.reqs).join(', ')}.${isText(c.why) ? ` ${c.why}` : ''}`);
    if (arr(c.pieces).length) L.push('', t.pieces, '', ...c.pieces.map((x) => `- ${x}`));
    const acceptance = arr(c.acceptance).map((a, j) => {
      const v = a.verify;
      const kind = v.kind === 'blocked' ? `blocked ${v.blq}` : v.kind;
      return `${j + 1}. ${a.text} {verify: ${kind}; evidence: ${v.evidence}}`;
    });
    L.push('', ...block('acceptance', acceptance));
    if (isText(c.dod)) L.push('', `${t.definitionOfDone}: ${c.dod}`);
    L.push('', ...block('risks', arr(c.risks).map((x) => `- ${x}`)), '<!-- /roadmap:card -->');
  }

  const gates = arr(model.gates);
  if (gates.length) {
    const rows = gates.map((g, i) => [cell(g.id, `gates[${i}].id`), `\`${cell(g.command, `gates[${i}].command`)}\``, cell(dash(g.environment), `gates[${i}].environment`),
      cell(dash(g.when), `gates[${i}].when`), cell(dash(g.baseline), `gates[${i}].baseline`)]);
    section(h.gates, ...block('gates', table(t.gates, rows)));
  }
  if (textList(model.metrics).length) section(h.metrics, ...textList(model.metrics).map((x) => `- ${x}`));
  if (textList(model.flags).length) section(h.flags, ...textList(model.flags).map((x) => `- ${x}`));
  section(h.crossRisks, ...listOrNone(model.crossRisks, none));
  section(h.decisions, t.seeDecisions(config.files.decisions));
  section(h.externalPending, ...listOrNone(model.externalPending, none));
  section(h.openQuestions, ...listOrNone(model.openQuestions, none));
  section(h.coverage, t.coverage(deriveCoverage(model.requirements, model.deliverables, model.vocab).summary));
  section(h.history, ...table(t.history, [['1.0', model.date, t.firstVersionRow]]));
  section(h.sources, t.seeSources(config.files.sources));
  return L.join('\n') + '\n';
}

function firstExistingAncestor(folder) {
  let dir = path.resolve(folder);
  while (!fs.existsSync(dir)) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

// Gera a pasta em memória e a confere no checker. Não grava nada.
export function generate(model, { folder }) {
  const files = renderFiles(model);
  const config = JSON.parse(files['roadmap.config.json']);
  const strategy = renderStrategy(model);
  const strategyRel = config.strategy;
  const roles = {};
  const paths = {};
  for (const [role, name] of Object.entries(config.files)) {
    paths[role] = name;
    roles[role] = name === null ? null : files[name];
  }
  const r = { folder, config, strategyPath: path.resolve(folder, strategyRel), strategy, files: roles, paths, invalidUtf8: [] };
  const problems = [];
  try {
    validateConfig(config, folder, null);
    const git = createGitAdapter(firstExistingAncestor(folder));
    problems.push(...checkRoadmap(r, git));
  } catch (e) {
    problems.push({ severity: 'error', code: 'config', file: 'roadmap.config.json', message: e.message });
  }
  return { files: { ...files, [strategyRel]: strategy }, config, strategyRel, problems };
}

// ---------- CLI e gravação (Tarefa 5) ----------

export const MODEL_FILE = 'planning-model.json';
const CHECKER_SOURCE = fileURLToPath(new URL('../../roadmap-tracker/scripts/check-roadmap.mjs', import.meta.url));
const USAGE = 'usage: node scaffold.mjs <planning-model.json> [--dry-run] [--json]';

function report(modelPath, folder, extra) {
  const errors = extra.errors || [];
  const warnings = extra.warnings || [];
  const exitCode = extra.exitCode ?? (errors.length ? 1 : 0);
  return {
    tool: 'scaffold',
    model: modelPath,
    folder,
    written: extra.written || [],
    defaulted: extra.defaulted || [],
    errors,
    warnings,
    summary: { errors: errors.length, warnings: warnings.length, exitCode },
  };
}

const toErr = (e) => ({ path: e.path, code: e.code, message: e.message });

// Lê o modelo (sem BOM), valida, gera em memória, confere no checker e só então grava.
export function runScaffold(modelPath, { dryRun = false } = {}) {
  const modelAbs = path.resolve(modelPath);
  const folder = path.dirname(modelAbs);
  const refuse = (errors, extra = {}) => report(modelAbs, folder, { ...extra, errors, exitCode: 1 });
  const fail = (code, message, extra = {}) => report(modelAbs, folder, { ...extra, errors: [{ path: '', code, message }], exitCode: 2 });

  if (!fs.existsSync(modelAbs)) {
    if (fs.existsSync(path.join(folder, 'roadmap.config.json'))) {
      return refuse([{ path: '', code: 'existing-roadmap', message: `${folder} already holds a roadmap (roadmap.config.json) and no ${path.basename(modelAbs)}; refusing to generate over it` }]);
    }
    return fail('model-unreadable', `cannot read ${modelAbs}`);
  }

  let raw;
  try {
    raw = fs.readFileSync(modelAbs, 'utf8');
  } catch (e) {
    return fail('model-unreadable', `cannot read ${modelAbs}: ${e.message}`);
  }
  let input;
  try {
    input = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (e) {
    return refuse([{ path: '', code: 'model-json', message: `invalid JSON: ${e.message}` }]);
  }

  const invalid = validateModel(input);
  if (invalid.length) return refuse(invalid.map(toErr));

  const { model, defaulted } = applyDefaults(input);
  let gen;
  try {
    gen = generate(model, { folder });
  } catch (e) {
    if (e instanceof ScaffoldError) return refuse(e.problems.map(toErr), { defaulted });
    throw e;
  }
  const warnings = gen.problems.filter((p) => p.severity !== 'error');
  const errors = gen.problems.filter((p) => p.severity === 'error');
  if (errors.length) return refuse(errors, { defaulted, warnings });

  let checker;
  try {
    checker = fs.readFileSync(CHECKER_SOURCE);
  } catch (e) {
    return fail('checker-unreadable', `cannot read the checker: ${e.message}`, { defaulted, warnings });
  }
  const header = /^\/\/ check-roadmap \S+ format (\d+)/.exec(checker.toString('utf8').split('\n', 1)[0]);
  if (!header || Number(header[1]) !== gen.config.formatVersion) {
    return fail('checker-format', `checker format ${header ? header[1] : '?'} differs from formatVersion ${gen.config.formatVersion}`, { defaulted, warnings });
  }

  const outputs = { ...gen.files, 'check-roadmap.mjs': checker };
  const written = Object.keys(outputs)
    .map((rel) => ({ rel, abs: path.resolve(folder, rel) }));
  const relNames = written.map((w) => path.relative(folder, w.abs).split(path.sep).join('/')).sort();
  if (dryRun) return report(modelAbs, folder, { defaulted, warnings, exitCode: 0 });

  try {
    for (const w of written) {
      fs.mkdirSync(path.dirname(w.abs), { recursive: true });
      const data = outputs[w.rel];
      fs.writeFileSync(w.abs, typeof data === 'string' ? data.replace(/\r\n?/g, '\n') : data);
    }
  } catch (e) {
    return fail('write-failed', `write failed: ${e.message}`, { defaulted, warnings });
  }
  return report(modelAbs, folder, { written: relNames, defaulted, warnings, exitCode: 0 });
}

export function main(argv) {
  const args = argv.filter((a) => a !== '--dry-run' && a !== '--json');
  const unknown = args.filter((a) => a.startsWith('-'));
  const json = argv.includes('--json');
  if (unknown.length || args.length !== 1) {
    const message = unknown.length ? `unknown option ${unknown[0]}` : 'exactly one model path is required';
    if (json) {
      console.log(JSON.stringify({ tool: 'scaffold', errors: [{ path: '', code: 'usage', message }], usage: USAGE, summary: { errors: 1, warnings: 0, exitCode: 2 } }, null, 2));
    } else {
      console.error(`${message}\n${USAGE}`);
    }
    return 2;
  }
  const out = runScaffold(args[0], { dryRun: argv.includes('--dry-run') });
  if (json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    for (const f of out.written) console.log(`wrote ${f}`);
    for (const d of out.defaulted) console.log(`defaulted ${d.path}`);
    for (const e of out.errors) console.log(`ERROR ${e.code}${e.path ? ` @${e.path}` : e.file ? ` @${e.file}` : ''}: ${e.message}`);
    for (const w of out.warnings) console.log(`WARN ${w.code}: ${w.message}`);
  }
  return out.summary.exitCode;
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync.native(process.argv[1]) === fs.realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) process.exitCode = main(process.argv.slice(2));
