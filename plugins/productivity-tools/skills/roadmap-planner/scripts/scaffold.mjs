// scaffold: valida o modelo de planejamento (planning-model.json), aplica padrões
// e (nas próximas tarefas) gera a pasta do roadmap. Sem dependências, só Node >= 18.
import { VERIFY_KINDS } from '../../../lib/roadmap-format.mjs';

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
