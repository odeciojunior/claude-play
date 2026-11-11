#!/usr/bin/env node
// spec-tool: valida um spec com bloco de dados `json data` no esquema spec/1.
// Uso: node spec-tool.mjs check|emit|summary <spec.md> (ver USAGE)
// Saida: 0 sem erro, 1 com erro, 2 uso invalido ou arquivo ilegivel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDataBlock } from '../lib/data-block.mjs';
import { norm, parseVerifyTag, parseRoadmapTexts } from '../lib/roadmap-format.mjs';

export const SCHEMA = 'spec/1';
const MODES = ['unattended', 'interactive'];
const COSTS = ['low', 'medium', 'high'];
const SCOPES = ['local', 'contract'];
const KINDS = ['data', 'credential', 'acceptance', 'decision'];

const collapse = (s) => norm(s).replace(/\s+/g, ' ').trim();
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

const RECORDS = {
  rulings: { prefix: 'R', fields: ['id', 'question', 'decision', 'basis', 'alternative', 'costIfWrong', 'reversible', 'scope', 'contradicts'] },
  needsPerson: { prefix: 'H', fields: ['id', 'kind', 'what', 'why', 'blocking', 'workaround', 'blq'] },
  externalEffects: { prefix: 'X', fields: ['id', 'what', 'target'] },
  edgeCases: { prefix: 'C', fields: ['id', 'input', 'expected'] },
};
const TOP = ['schema', 'id', 'title', 'mode', 'acceptance', 'rulings', 'needsPerson', 'externalEffects', 'edgeCases'];

// Le a pasta do roadmap: config, estrategia e arquivos de estado existentes.
export function loadRoadmap(dir) {
  const cfgPath = path.join(dir, 'roadmap.config.json');
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    throw new Error(`roadmap ilegível em ${dir}: ${e.message}`);
  }
  const readIf = (rel) => {
    try {
      return fs.readFileSync(path.join(dir, rel), 'utf8');
    } catch {
      return null;
    }
  };
  const files = {};
  for (const [role, rel] of Object.entries(cfg.files || {})) {
    if (typeof rel === 'string') files[role] = readIf(rel);
  }
  const strategy = typeof cfg.strategy === 'string' ? readIf(cfg.strategy) : null;
  if (strategy === null) throw new Error(`estratégia não encontrada em ${dir} (${cfg.strategy})`);
  const parsed = parseRoadmapTexts({ strategy, files });
  const rows = parsed.blocks.state && parsed.blocks.state.blockers ? parsed.blocks.state.blockers.rows : [];
  return { cards: parsed.cards, openBlockers: new Set(rows.map((r) => r[0])) };
}

// Valida os registros de uma lista (rulings, needsPerson, externalEffects, edgeCases): usada por spec-tool e plan-tool.
export function checkRecords(name, items, { roadmap = null } = {}) {
  const errors = [];
  const warnings = [];
  const err = (code, ref, message) => errors.push({ code, ref, message });
  const warn = (code, ref, message) => warnings.push({ code, ref, message });
  const spec = RECORDS[name];
  const pat = new RegExp(`^${spec.prefix}\\d+$`);
  const seen = new Set();
  items.forEach((item, i) => {
    const pos = i + 1;
    if (!isObj(item)) return err('field-type', `${name}[${pos}]`, 'item deve ser um objeto');
    let ref = `${name}[${pos}]`;
    if (!('id' in item)) err('field-missing', ref, 'campo "id" ausente');
    else if (typeof item.id !== 'string' || !pat.test(item.id)) {
      ref = String(item.id);
      err('id-invalid', ref, `id ${JSON.stringify(item.id)} fora do padrão ${spec.prefix}<n>`);
    } else {
      ref = item.id;
      if (seen.has(ref)) err('id-duplicate', ref, `id "${ref}" repetido`);
      seen.add(ref);
    }
    for (const k of Object.keys(item)) {
      if (!spec.fields.includes(k)) warn('field-unknown', `${name}[${pos}].${k}`, `campo desconhecido "${k}"`);
    }
    const need = (k, ok, what) => {
      if (!(k in item)) err('field-missing', ref, `campo "${k}" ausente`);
      else if (!ok(item[k])) err('field-type', ref, `"${k}" deve ser ${what}`);
    };
    if (name === 'rulings') {
      for (const k of ['question', 'decision']) need(k, isStr, 'uma string não vazia');
      need('alternative', (v) => typeof v === 'string', 'uma string (pode ser vazia)');
      need('contradicts', (v) => v === null || (typeof v === 'string' && /^(DEC-\d+|G\d+)$/.test(v)), 'null ou DEC-<n>/G<n>');
      const bad = [];
      if (!isStr(item.basis)) bad.push('basis');
      if (!COSTS.includes(item.costIfWrong)) bad.push('costIfWrong');
      if (typeof item.reversible !== 'boolean') bad.push('reversible');
      if (!SCOPES.includes(item.scope)) bad.push('scope');
      if (bad.length) err('ruling-incomplete', ref, `campos ausentes ou fora do domínio: ${bad.join(', ')}`);
    } else if (name === 'needsPerson') {
      for (const k of ['what', 'why']) need(k, isStr, 'uma string não vazia');
      if (!KINDS.includes(item.kind)) err('needs-person-kind', ref, `"kind" deve ser ${KINDS.join(', ')}`);
      if (typeof item.blocking !== 'boolean') err('needs-person-blocking', ref, '"blocking" é obrigatório e booleano');
      need('workaround', (v) => typeof v === 'string', 'uma string');
      if (item.blocking === false && !isStr(item.workaround)) err('needs-person-workaround', ref, 'item não bloqueante precisa de "workaround" não vazio');
      if ('blq' in item && !(typeof item.blq === 'string' && /^BLQ-\d+$/.test(item.blq))) err('field-type', ref, '"blq" deve ser BLQ-<n>');
      else if (roadmap && typeof item.blq === 'string' && !roadmap.openBlockers.has(item.blq)) err('needs-person-blq', ref, `${item.blq} não está aberto no roadmap`);
    } else if (name === 'externalEffects') {
      for (const k of ['what', 'target']) need(k, isStr, 'uma string não vazia');
    } else {
      for (const k of ['input', 'expected']) need(k, isStr, 'uma string não vazia');
    }
  });
  if (name === 'edgeCases' && items.length > 5) warn('edge-cases-limit', 'edgeCases', `${items.length} casos de borda; o limite é 5`);
  return { errors, warnings };
}

export function checkSpec(text, { roadmap = null } = {}) {
  const errors = [];
  const warnings = [];
  const err = (code, ref, message) => errors.push({ code, ref, message });
  const warn = (code, ref, message) => warnings.push({ code, ref, message });

  const read = readDataBlock(text);
  if (read.error) {
    err(read.error.code, '-', read.error.message);
    return { data: null, errors, warnings };
  }
  const data = read.data;
  if (!isObj(data)) {
    err('field-type', '-', 'o bloco de dados deve ser um objeto JSON');
    return { data, errors, warnings };
  }

  // campos de topo
  if (!('schema' in data)) err('field-missing', 'schema', 'campo obrigatório "schema" ausente');
  else if (data.schema !== SCHEMA) err('schema-version', 'schema', `esperado "${SCHEMA}", encontrado ${JSON.stringify(data.schema)}`);
  if (!('id' in data)) err('field-missing', 'id', 'campo obrigatório "id" ausente');
  else if (!isStr(data.id)) err('field-type', 'id', '"id" deve ser uma string não vazia');
  if ('title' in data && typeof data.title !== 'string') err('field-type', 'title', '"title" deve ser string');
  if (!('mode' in data)) err('field-missing', 'mode', 'campo obrigatório "mode" ausente');
  else if (!MODES.includes(data.mode)) err('field-type', 'mode', `"mode" deve ser ${MODES.map((m) => `"${m}"`).join(' ou ')}`);
  for (const k of Object.keys(data)) {
    if (!TOP.includes(k)) warn('field-unknown', k, `campo desconhecido "${k}" (o esquema cresce por versão)`);
  }

  const list = (name) => {
    if (!(name in data)) {
      err('field-missing', name, `campo obrigatório "${name}" ausente`);
      return null;
    }
    if (!Array.isArray(data[name])) {
      err('field-type', name, `"${name}" deve ser uma lista`);
      return null;
    }
    return data[name];
  };

  const acceptance = list('acceptance');
  if (acceptance) {
    if (acceptance.length === 0) err('field-missing', 'acceptance', '"acceptance" precisa de ao menos um item');
    const seen = new Set();
    acceptance.forEach((item, i) => {
      const pos = i + 1;
      if (!isObj(item)) return err('field-type', `acceptance[${pos}]`, 'item deve ser um objeto');
      const want = `AC${pos}`;
      let ref = want;
      if (!('id' in item)) err('field-missing', `acceptance[${pos}]`, 'campo "id" ausente');
      else if (item.id !== want) {
        ref = String(item.id);
        err('id-invalid', ref, `id ${JSON.stringify(item.id)} na posição ${pos}; esperado "${want}"`);
      } else if (seen.has(item.id)) err('id-duplicate', ref, `id "${ref}" repetido`);
      seen.add(item.id);
      if (!('text' in item)) err('field-missing', ref, 'campo "text" ausente');
      else if (!isStr(item.text)) err('field-type', ref, '"text" deve ser uma string não vazia');
      else {
        const p = parseVerifyTag(item.text);
        if (p.problem) err('acceptance-tag-invalid', ref, `marca {verify: ...} inválida: ${p.problem}`);
      }
      for (const k of Object.keys(item)) {
        if (k !== 'id' && k !== 'text') warn('field-unknown', `acceptance[${pos}].${k}`, `campo desconhecido "${k}"`);
      }
    });
  }

  const card = roadmap && isStr(data.id) ? roadmap.cards.find((c) => c.id === data.id) : null;
  if (roadmap && isStr(data.id) && !card) err('card-not-found', 'id', `card "${data.id}" não existe no roadmap`);
  if (!roadmap && typeof data.id === 'string' && /^E\d+$/.test(data.id)) {
    warn('card-not-checked', 'id', 'id de deliverable sem --roadmap: critérios não conferidos contra o card');
  }
  if (card && acceptance) {
    const want = card.acceptance;
    if (want.length !== acceptance.length) {
      err('acceptance-count', 'acceptance', `o card ${card.id} tem ${want.length} critérios; o spec tem ${acceptance.length}`);
    }
    const n = Math.min(want.length, acceptance.length);
    for (let i = 0; i < n; i++) {
      const item = acceptance[i];
      if (!isObj(item) || !isStr(item.text)) continue;
      const ref = `AC${i + 1}`;
      const c = want[i];
      const s = parseVerifyTag(item.text);
      const head = `${ref}: `;
      const tail = ` (card: "${collapse(c.text).slice(0, 60)}...")`;
      if (collapse(s.text) !== collapse(c.text)) {
        err('acceptance-text', ref, `${head}texto diferente do card${tail}`);
        continue;
      }
      if (s.problem) continue; // ja reportado como acceptance-tag-invalid
      if (c.tag && !s.tag) err('acceptance-tag-missing', ref, `${head}falta a marca {verify: ...} do card${tail}`);
      else if (c.tag && s.tag) {
        const f = (t) => [t.kind, t.blq || '', collapse(t.evidence || '')].join('|');
        if (f(c.tag) !== f(s.tag)) err('acceptance-tag-differs', ref, `${head}marca {verify: ...} diferente da do card${tail}`);
      }
    }
  }

  for (const name of Object.keys(RECORDS)) {
    const items = list(name);
    if (!items) continue;
    const r = checkRecords(name, items, { roadmap });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }

  return { data, errors, warnings };
}

export function emitSpec(text, { roadmap = null } = {}) {
  const { data, errors, warnings } = checkSpec(text, { roadmap });
  if (errors.length || !isObj(data)) return { errors, warnings, data };
  const out = JSON.parse(JSON.stringify(data));
  out.acceptance = out.acceptance.map((item) => {
    const p = parseVerifyTag(item.text);
    const verify = p.tag ? { kind: p.tag.kind, blq: p.tag.blq || null, evidence: p.tag.evidence } : null;
    return { ...item, verify, textWithoutTag: p.text };
  });
  return { errors, warnings, data: out };
}

export function summarize(text) {
  const read = readDataBlock(text);
  if (read.error) return { error: read.error, rulings: [], needsPerson: [], externalEffects: [], stops: [] };
  const d = isObj(read.data) ? read.data : {};
  const arr = (k) => (Array.isArray(d[k]) ? d[k].filter(isObj) : []);
  const rulings = arr('rulings');
  const needsPerson = arr('needsPerson');
  const externalEffects = arr('externalEffects');
  const filled = (v) => v !== null && v !== undefined && v !== '';
  const stops = [
    ...rulings.filter((r) => (r.costIfWrong === 'high' && r.reversible === false) || filled(r.contradicts)).map((r) => r.id),
    ...needsPerson.filter((h) => h.blocking === true).map((h) => h.id),
  ];
  return { error: null, rulings, needsPerson, externalEffects, stops };
}

const cell = (v) => (v === null || v === undefined ? '' : String(v)).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function formatSummary(s) {
  const stop = (id) => (s.stops.includes(id) ? 'para' : '');
  const table = (head, rows) => [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n');
  return [
    '## Decisões',
    '',
    table(['ID', 'Decisão', 'Custo se errada', 'Reversível', 'Alcance', 'Contradiz', 'Para'],
      s.rulings.map((r) => [r.id, r.decision, r.costIfWrong, r.reversible, r.scope, r.contradicts, stop(r.id)])),
    '',
    '## Pessoas',
    '',
    table(['ID', 'Tipo', 'O quê', 'Bloqueia', 'Contorno', 'BLQ', 'Para'],
      s.needsPerson.map((h) => [h.id, h.kind, h.what, h.blocking, h.workaround, h.blq, stop(h.id)])),
    '',
    '## Efeitos externos',
    '',
    table(['ID', 'O quê', 'Alvo'], s.externalEffects.map((x) => [x.id, x.what, x.target])),
    '',
  ].join('\n');
}

const USAGE = [
  'uso: node spec-tool.mjs check <spec.md> [--roadmap <pasta>] [--json]',
  '     node spec-tool.mjs emit <spec.md> [--roadmap <pasta>]',
  '     node spec-tool.mjs summary <spec.md> [--json]',
].join('\n');

export function main(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  const out = (s) => io.stdout.write(s + '\n');
  const bad = (s) => {
    io.stderr.write(s + '\n');
    return 2;
  };
  const [cmd, ...rest] = argv;
  if (!cmd) return bad(USAGE);
  if (!['check', 'emit', 'summary'].includes(cmd)) return bad(`comando desconhecido: ${cmd}\n${USAGE}`);
  const takesRoadmap = cmd !== 'summary';
  const takesJson = cmd !== 'emit';
  let file = null;
  let json = false;
  let roadmapDir = null;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json' && takesJson) json = true;
    else if (a === '--roadmap' && takesRoadmap) {
      if (i + 1 >= rest.length) return bad(`--roadmap exige uma pasta\n${USAGE}`);
      roadmapDir = rest[++i];
    }
    else if (a.startsWith('--')) return bad(`opção desconhecida: ${a}\n${USAGE}`);
    else if (file === null) file = a;
    else return bad(`argumento extra: ${a}\n${USAGE}`);
  }
  if (!file) return bad(USAGE);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return bad(`não foi possível ler ${file}: ${e.message}`);
  }
  if (cmd === 'summary') {
    const s = summarize(text);
    if (s.error) {
      io.stderr.write(`ERROR ${s.error.code} -: ${s.error.message}\n`);
      return 1;
    }
    if (json) out(JSON.stringify({ rulings: s.rulings, needsPerson: s.needsPerson, externalEffects: s.externalEffects, stops: s.stops }, null, 2));
    else out(formatSummary(s));
    return 0;
  }
  let roadmap = null;
  if (roadmapDir !== null) {
    try {
      roadmap = loadRoadmap(roadmapDir);
    } catch (e) {
      return bad(e.message);
    }
  }
  if (cmd === 'emit') {
    const r = emitSpec(text, { roadmap });
    if (r.errors.length) {
      for (const e of r.errors) io.stderr.write(`ERROR ${e.code} ${e.ref}: ${e.message}\n`);
      io.stderr.write(`Result: ${r.errors.length} errors, ${r.warnings.length} warnings\n`);
      return 1;
    }
    out(JSON.stringify({ tool: 'spec-tool', schema: SCHEMA, path: file, data: r.data }, null, 2));
    return 0;
  }
  const r = checkSpec(text, { roadmap });
  const code = r.errors.length ? 1 : 0;
  if (json) {
    out(JSON.stringify({
      tool: 'spec-tool', schema: SCHEMA, path: file, errors: r.errors, warnings: r.warnings,
      summary: { errors: r.errors.length, warnings: r.warnings.length, exitCode: code },
    }, null, 2));
  } else {
    for (const e of r.errors) out(`ERROR ${e.code} ${e.ref}: ${e.message}`);
    for (const w of r.warnings) out(`WARN ${w.code} ${w.ref}: ${w.message}`);
    out(`Result: ${r.errors.length} errors, ${r.warnings.length} warnings`);
  }
  return code;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exit(main(process.argv.slice(2)));
}
