#!/usr/bin/env node
// spec-tool: valida um spec com bloco de dados `json data` no esquema spec/1.
// Uso: node spec-tool.mjs check <spec.md> [--json]
// Saida: 0 sem erro, 1 com erro, 2 uso invalido ou arquivo ilegivel.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readDataBlock } from '../lib/data-block.mjs';
import { parseVerifyTag } from '../lib/roadmap-format.mjs';

export const SCHEMA = 'spec/1';
const MODES = ['unattended', 'interactive'];
const COSTS = ['low', 'medium', 'high'];
const SCOPES = ['local', 'contract'];
const KINDS = ['data', 'credential', 'acceptance', 'decision'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

const RECORDS = {
  rulings: { prefix: 'R', fields: ['id', 'question', 'decision', 'basis', 'alternative', 'costIfWrong', 'reversible', 'scope', 'contradicts'] },
  needsPerson: { prefix: 'H', fields: ['id', 'kind', 'what', 'why', 'blocking', 'workaround', 'blq'] },
  externalEffects: { prefix: 'X', fields: ['id', 'what', 'target'] },
  edgeCases: { prefix: 'C', fields: ['id', 'input', 'expected'] },
};
const TOP = ['schema', 'id', 'title', 'mode', 'acceptance', 'rulings', 'needsPerson', 'externalEffects', 'edgeCases'];

export function checkSpec(text, { roadmap = null } = {}) {
  void roadmap; // a comparacao com o card entra na Task 4
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

  for (const [name, spec] of Object.entries(RECORDS)) {
    const items = list(name);
    if (!items) continue;
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
      } else if (name === 'externalEffects') {
        for (const k of ['what', 'target']) need(k, isStr, 'uma string não vazia');
      } else {
        for (const k of ['input', 'expected']) need(k, isStr, 'uma string não vazia');
      }
    });
    if (name === 'edgeCases' && items.length > 5) warn('edge-cases-limit', 'edgeCases', `${items.length} casos de borda; o limite é 5`);
  }

  return { data, errors, warnings };
}

const USAGE = 'uso: node spec-tool.mjs check <spec.md> [--json]';

export function main(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  const out = (s) => io.stdout.write(s + '\n');
  const bad = (s) => {
    io.stderr.write(s + '\n');
    return 2;
  };
  const [cmd, ...rest] = argv;
  if (!cmd) return bad(USAGE);
  if (cmd !== 'check') return bad(`comando desconhecido: ${cmd}\n${USAGE}`);
  let file = null;
  let json = false;
  for (const a of rest) {
    if (a === '--json') json = true;
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
  const r = checkSpec(text);
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
