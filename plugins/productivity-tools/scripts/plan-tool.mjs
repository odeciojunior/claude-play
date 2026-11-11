#!/usr/bin/env node
// plan-tool: valida um plano com bloco de dados `json data` no esquema plan/1 contra o spec.
// Uso: node plan-tool.mjs check <plan.md> [--spec <spec.md>] [--json] (ver USAGE)
// Saida: 0 sem erro, 1 com erro, 2 uso invalido ou arquivo ilegivel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDataBlock } from '../lib/data-block.mjs';
import { norm, parseVerifyTag, EXECUTABLE_KINDS } from '../lib/roadmap-format.mjs';
import { checkSpec, checkRecords } from './spec-tool.mjs';
import { route } from '../lib/routing.mjs';
import { fnv1a, planDigest } from '../lib/plan-digest.mjs';

export const SCHEMA = 'plan/1';
const TOP = ['schema', 'id', 'title', 'spec', 'roadmap', 'constraints', 'externalPatterns', 'tasks', 'evidence', 'rulings', 'needsPerson'];
const TASK_FIELDS = ['n', 'title', 'deps', 'files', 'writes', 'score', 'produces', 'consumes', 'covers', 'testFirst', 'checks', 'locks', 'external', 'externalDedupe', 'noCommit'];
const FILE_KINDS = ['create', 'modify', 'test'];
const SCORE_KEYS = ['ambiguity', 'reasoning', 'blast', 'verifiability'];
const EVIDENCE_FIELDS = ['ac', 'kind', 'command', 'external', 'externalDedupe', 'blq'];
const EVIDENCE_KINDS = ['test', 'smoke', 'integration', 'human', 'blocked'];

// Lista padrao de efeito externo (regex, flag i).
export const EXTERNAL_PATTERNS = [
  '\\bgit\\s+push\\b',
  '\\b(npm|pnpm|yarn)\\s+publish\\b',
  '\\bdeploy\\b',
  '\\bcurl\\b.*\\s-X\\s*(POST|PUT|PATCH|DELETE)\\b',
  '\\bkubectl\\s+(apply|delete|create|patch|rollout)\\b',
  '\\bterraform\\s+(apply|destroy)\\b',
  '\\bdocker\\s+push\\b',
  '\\bgh\\s+(pr\\s+(create|merge)|release\\s+create|issue\\s+create)\\b',
  '\\b(sendmail|mail)\\b',
  '\\bclaude\\s+plugin\\s+(update|install|marketplace\\s+(add|update))\\b',
];

const collapse = (s) => norm(s).replace(/\s+/g, ' ').trim();
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isInt = (v) => Number.isInteger(v);
const isStrList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const normPath = (p) => String(p).replace(/\\/g, '/').replace(/^(\.\/)+/, '');

// Esquema de uma tarefa. Devolve nada; os erros vao para `err`.
function checkTaskSchema(t, pos, err, warn) {
  const ref = `T${pos}`;
  if (!isObj(t)) return err('field-type', `tasks[${pos}]`, 'tarefa deve ser um objeto');
  for (const k of Object.keys(t)) {
    if (!TASK_FIELDS.includes(k)) warn('field-unknown', ref, `campo desconhecido "${k}" na tarefa`);
  }
  const missing = (k) => err('field-missing', ref, `campo "${k}" ausente`);
  const wrong = (k, what) => err('field-type', ref, `"${k}" deve ser ${what}`);
  const need = (k, ok, what) => {
    if (!(k in t)) missing(k);
    else if (!ok(t[k])) wrong(k, what);
  };

  if (!('n' in t)) missing('n');
  else if (!isInt(t.n)) wrong('n', 'um inteiro');
  else if (t.n !== pos) err('task-number', ref, `"n" é ${t.n} na posição ${pos}; as tarefas são numeradas 1..N na ordem`);
  need('title', isStr, 'uma string não vazia');
  need('deps', (v) => Array.isArray(v) && v.every(isInt), 'uma lista de inteiros');
  need('writes', isStrList, 'uma lista de caminhos');
  need('produces', isStrList, 'uma lista de strings');
  need('covers', isStrList, 'uma lista de ids');
  need('locks', isStrList, 'uma lista de strings');
  need('external', (v) => typeof v === 'boolean', 'booleano');
  need('noCommit', (v) => typeof v === 'boolean', 'booleano');
  if ('externalDedupe' in t && t.externalDedupe !== null && typeof t.externalDedupe !== 'string') wrong('externalDedupe', 'string ou null');
  need('testFirst', (v) => v === true || (isObj(v) && isStr(v.exempt)), 'true ou { exempt: "<motivo>" }');
  need('consumes', (v) => Array.isArray(v) && v.every((c) => isObj(c) && isInt(c.task) && isStr(c.sig)), 'uma lista de { task, sig }');
  need('checks', (v) => Array.isArray(v) && v.every((c) => isObj(c) && isStr(c.cmd) && isStr(c.expect)), 'uma lista de { cmd, expect }');

  // files
  let filesOk = false;
  if (!('files' in t)) missing('files');
  else if (!isObj(t.files)) wrong('files', 'um objeto { create, modify, test }');
  else {
    filesOk = true;
    for (const k of FILE_KINDS) {
      if (!(k in t.files)) {
        filesOk = false;
        err('field-missing', ref, `campo "files.${k}" ausente`);
      } else if (!isStrList(t.files[k])) {
        filesOk = false;
        err('field-type', ref, `"files.${k}" deve ser uma lista de caminhos`);
      }
    }
    for (const k of Object.keys(t.files)) {
      if (!FILE_KINDS.includes(k)) warn('field-unknown', ref, `campo desconhecido "files.${k}"`);
    }
  }
  if (filesOk && t.noCommit === false && FILE_KINDS.every((k) => t.files[k].length === 0)) {
    err('field-missing', ref, 'tarefa com noCommit false precisa de ao menos um arquivo em "files"');
  }

  // score: todos obrigatorios, inteiros 0..2
  if (!('score' in t)) missing('score');
  else if (!isObj(t.score)) wrong('score', 'um objeto { ambiguity, reasoning, blast, verifiability }');
  else {
    for (const k of SCORE_KEYS) {
      if (!(k in t.score)) err('field-missing', ref, `campo "score.${k}" ausente`);
      else if (!isInt(t.score[k]) || t.score[k] < 0 || t.score[k] > 2) err('field-type', ref, `"score.${k}" deve ser um inteiro de 0 a 2`);
    }
    for (const k of Object.keys(t.score)) {
      if (!SCORE_KEYS.includes(k)) warn('field-unknown', ref, `campo desconhecido "score.${k}"`);
    }
  }
}

function checkEvidenceSchema(row, pos, err, warn) {
  let ref = `evidence[${pos}]`;
  if (!isObj(row)) return err('field-type', ref, 'linha de evidência deve ser um objeto');
  if (!('ac' in row)) err('field-missing', ref, 'campo "ac" ausente');
  else if (!isStr(row.ac)) err('field-type', ref, '"ac" deve ser uma string não vazia');
  else ref = row.ac;
  for (const k of Object.keys(row)) {
    if (!EVIDENCE_FIELDS.includes(k)) warn('field-unknown', ref, `campo desconhecido "${k}" na linha de evidência`);
  }
  if (!('kind' in row)) err('field-missing', ref, 'campo "kind" ausente');
  else if (!EVIDENCE_KINDS.includes(row.kind)) err('field-type', ref, `"kind" deve ser ${EVIDENCE_KINDS.join(', ')}`);
  if (!('command' in row)) err('field-missing', ref, 'campo "command" ausente');
  else if (row.command !== null && !isStr(row.command)) err('field-type', ref, '"command" deve ser string ou null');
  else if (typeof row.command === 'string') {
    if (!('external' in row)) err('field-missing', ref, 'campo "external" ausente (obrigatório quando há comando)');
    else if (typeof row.external !== 'boolean') err('field-type', ref, '"external" deve ser booleano');
  } else if ('external' in row && typeof row.external !== 'boolean') err('field-type', ref, '"external" deve ser booleano');
  if ('externalDedupe' in row && row.externalDedupe !== null && typeof row.externalDedupe !== 'string') err('field-type', ref, '"externalDedupe" deve ser string ou null');
  if ('blq' in row && row.blq !== null && !(typeof row.blq === 'string' && /^BLQ-\d+$/.test(row.blq))) err('field-type', ref, '"blq" deve ser null ou BLQ-<n>');
}

// Cabecalhos de tarefa na prosa: n -> { title, line }.
function taskHeadings(prose) {
  const found = new Map();
  const re = /^### (?:Tarefa|Task) (\d+):\s*(.+)$/;
  for (const line of prose.split('\n')) {
    const m = re.exec(line);
    if (m && !found.has(Number(m[1]))) found.set(Number(m[1]), m[2]);
  }
  return found;
}

// Ciclos por DFS em ordem de n; cada ciclo e nomeado na ordem achada. Dependencias desconhecidas sao ignoradas aqui.
function findCycles(tasks) {
  const known = new Set(tasks.map((_, i) => i + 1));
  const depsOf = (n) => tasks[n - 1].deps.filter((d) => known.has(d));
  const state = new Map(); // 1 = na pilha, 2 = concluida
  const stack = [];
  const cycles = [];
  const seen = new Set();
  const visit = (n) => {
    state.set(n, 1);
    stack.push(n);
    for (const d of depsOf(n)) {
      if (state.get(d) === 1) {
        const cyc = [...stack.slice(stack.indexOf(d)), d];
        const key = [...new Set(cyc)].sort((a, b) => a - b).join(',');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cyc);
        }
      } else if (!state.has(d)) visit(d);
    }
    stack.pop();
    state.set(n, 2);
  };
  for (const n of known) if (!state.has(n)) visit(n);
  return cycles;
}

// Nivel topologico: 0 sem dependencia; senao 1 + o maior nivel das dependencias. Fora do mapa: ciclo ou dep desconhecida.
function topoLevels(tasks) {
  const known = new Set(tasks.map((_, i) => i + 1));
  const levels = new Map();
  const bad = new Set();
  const visiting = new Set();
  const level = (n) => {
    if (levels.has(n)) return levels.get(n);
    if (bad.has(n)) return null;
    if (visiting.has(n)) return null;
    visiting.add(n);
    let max = -1;
    let ok = true;
    for (const d of tasks[n - 1].deps) {
      if (!known.has(d)) {
        ok = false;
        continue;
      }
      const l = level(d);
      if (l === null) ok = false;
      else max = Math.max(max, l);
    }
    visiting.delete(n);
    if (!ok) {
      bad.add(n);
      return null;
    }
    levels.set(n, max + 1);
    return max + 1;
  };
  for (const n of known) level(n);
  return new Map([...levels].sort((a, b) => a[0] - b[0]));
}

const writeSet = (t) => new Set([...t.files.create, ...t.files.modify, ...t.files.test, ...t.writes].map(normPath));

export function checkPlan(text, { planPath, specText = null, specPath = null } = {}) {
  const errors = [];
  const warnings = [];
  const err = (code, ref, message) => errors.push({ code, ref, message });
  const warn = (code, ref, message) => warnings.push({ code, ref, message });
  const levels = new Map();

  const read = readDataBlock(text);
  if (read.error) {
    err(read.error.code, '-', read.error.message);
    return { data: null, spec: null, errors, warnings, levels };
  }
  const data = read.data;
  if (!isObj(data)) {
    err('field-type', '-', 'o bloco de dados deve ser um objeto JSON');
    return { data, spec: null, errors, warnings, levels };
  }

  // campos de topo
  if (!('schema' in data)) err('field-missing', 'schema', 'campo obrigatório "schema" ausente');
  else if (data.schema !== SCHEMA) err('schema-version', 'schema', `esperado "${SCHEMA}", encontrado ${JSON.stringify(data.schema)}`);
  if (!('id' in data)) err('field-missing', 'id', 'campo obrigatório "id" ausente');
  else if (!isStr(data.id)) err('field-type', 'id', '"id" deve ser uma string não vazia');
  if ('title' in data && typeof data.title !== 'string') err('field-type', 'title', '"title" deve ser string');
  if (!('spec' in data)) err('field-missing', 'spec', 'campo obrigatório "spec" ausente');
  else if (!isStr(data.spec)) err('field-type', 'spec', '"spec" deve ser uma string não vazia');
  if (!('roadmap' in data)) err('field-missing', 'roadmap', 'campo obrigatório "roadmap" ausente');
  else if (data.roadmap !== null && !isStr(data.roadmap)) err('field-type', 'roadmap', '"roadmap" deve ser string ou null');
  if (!('constraints' in data)) err('field-missing', 'constraints', 'campo obrigatório "constraints" ausente');
  else if (!isStrList(data.constraints)) err('field-type', 'constraints', '"constraints" deve ser uma lista de strings');
  const extra = [];
  if ('externalPatterns' in data) {
    if (!isStrList(data.externalPatterns)) err('field-type', 'externalPatterns', '"externalPatterns" deve ser uma lista de strings');
    else {
      for (const src of data.externalPatterns) {
        try {
          extra.push(new RegExp(src, 'i'));
        } catch (e) {
          err('field-type', 'externalPatterns', `expressão regular inválida ${JSON.stringify(src)}: ${e.message}`);
        }
      }
    }
  }
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

  // tarefas
  const tasks = list('tasks');
  let tasksOk = false;
  if (tasks) {
    if (tasks.length === 0) err('field-missing', 'tasks', '"tasks" precisa de ao menos uma tarefa');
    const before = errors.length;
    tasks.forEach((t, i) => checkTaskSchema(t, i + 1, err, warn));
    tasksOk = tasks.length > 0 && errors.length === before;
  }

  // evidencia
  const evidence = list('evidence');
  let evidenceOk = false;
  if (evidence) {
    const beforeEv = errors.length;
    evidence.forEach((row, i) => checkEvidenceSchema(row, i + 1, err, warn));
    evidenceOk = errors.length === beforeEv;
  }

  // registros do esquema de spec
  for (const name of ['rulings', 'needsPerson']) {
    const items = list(name);
    if (!items) continue;
    const r = checkRecords(name, items);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }

  // spec
  let spec = null;
  let resolvedSpec = null;
  if (specText === null) {
    if (specPath !== null) resolvedSpec = specPath;
    else if (isStr(data.spec)) resolvedSpec = path.resolve(planPath ? path.dirname(planPath) : '.', data.spec);
  }
  let specSource = specText;
  if (specSource === null && resolvedSpec !== null) {
    try {
      specSource = fs.readFileSync(resolvedSpec, 'utf8');
    } catch (e) {
      err('spec-invalid', 'spec', `spec ilegível em ${resolvedSpec}: ${e.message}`);
    }
  }
  if (specSource !== null) {
    const s = checkSpec(specSource);
    if (s.errors.length) {
      const first = s.errors[0];
      err('spec-invalid', 'spec', `spec com erro (${s.errors.length}): ${first.code} ${first.ref}: ${first.message}`);
    } else {
      spec = s.data;
      if (isStr(data.id) && spec.id !== data.id) err('spec-id-mismatch', 'id', `o plano é de "${data.id}" e o spec é de "${spec.id}"`);
    }
  }

  // prosa
  if (tasks) {
    const headings = taskHeadings(read.prose);
    tasks.forEach((t, i) => {
      const pos = i + 1;
      if (!headings.has(pos)) return err('task-heading-missing', `T${pos}`, `a prosa não tem a seção "### Tarefa ${pos}: <título>"`);
      if (isObj(t) && isStr(t.title) && collapse(t.title) !== collapse(headings.get(pos))) {
        err('task-title-differs', `T${pos}`, `título do bloco "${collapse(t.title)}" difere do da seção "${collapse(headings.get(pos))}"`);
      }
    });
    for (const n of headings.keys()) {
      if (n < 1 || n > tasks.length) err('task-heading-orphan', `T${n}`, `a seção "### Tarefa ${n}:" não tem tarefa no bloco de dados`);
    }
  }

  // grafo e conflito de escrita: só com o esquema das tarefas íntegro
  if (tasksOk) {
    tasks.forEach((t, i) => {
      for (const d of t.deps) {
        if (d < 1 || d > tasks.length) err('dep-unknown', `T${i + 1}`, `depende de T${d}, que não existe`);
      }
    });
    for (const cyc of findCycles(tasks)) {
      err('dependency-cycle', `T${cyc[0]}`, `ciclo de dependências: ${cyc.map((n) => `T${n}`).join(' -> ')}`);
    }
    for (const [n, l] of topoLevels(tasks)) levels.set(n, l);
    const byLevel = new Map();
    for (const [n, l] of levels) {
      if (!byLevel.has(l)) byLevel.set(l, []);
      byLevel.get(l).push(n);
    }
    for (const group of byLevel.values()) {
      for (let a = 0; a < group.length; a++) {
        const wa = writeSet(tasks[group[a] - 1]);
        for (let b = a + 1; b < group.length; b++) {
          const shared = [...writeSet(tasks[group[b] - 1])].filter((p) => wa.has(p));
          if (shared.length) {
            err('write-conflict', `T${group[a]}/T${group[b]}`, `T${group[a]} e T${group[b]} rodam na mesma onda e escrevem ${shared.join(', ')}; ordene com uma dependência`);
          }
        }
      }
    }
  }

  // cobertura, interfaces, efeito externo, pasta do roadmap e largura: só com o esquema das tarefas íntegro
  if (tasksOk) {
    const patterns = [...EXTERNAL_PATTERNS.map((src) => new RegExp(src, 'i')), ...extra];
    const hit = (cmd) => patterns.find((re) => re.test(cmd));
    const known = new Set(tasks.map((_, i) => i + 1));

    // ancestrais pelo fecho transitivo de deps (dependências desconhecidas ignoradas)
    const ancestors = (n) => {
      const seen = new Set();
      const walk = (m) => {
        for (const d of tasks[m - 1].deps) {
          if (known.has(d) && !seen.has(d)) {
            seen.add(d);
            walk(d);
          }
        }
      };
      walk(n);
      return seen;
    };

    tasks.forEach((t, i) => {
      const ref = `T${i + 1}`;
      for (const c of t.consumes) {
        const sig = collapse(c.sig);
        const producer = known.has(c.task) ? tasks[c.task - 1] : null;
        if (!producer || !producer.produces.some((p) => collapse(p) === sig)) {
          err('interface-unproduced', ref, `consome "${sig}" de T${c.task}, que não produz essa assinatura`);
        } else if (!ancestors(i + 1).has(c.task)) {
          err('interface-not-upstream', ref, `consome "${sig}" de T${c.task}, que não é ancestral de ${ref} pelas dependências`);
        }
      }
      if (t.external === false) {
        for (const ch of t.checks) {
          const re = hit(ch.cmd);
          if (re) err('external-undeclared', ref, `o comando "${ch.cmd}" casa com o padrão de efeito externo ${re.source} e a tarefa é interna`);
        }
      } else if (!isStr(t.externalDedupe)) {
        err('external-dedupe-missing', ref, 'tarefa externa sem "externalDedupe" (como evitar repetir o efeito)');
      }
      if (isStr(data.roadmap)) {
        const root = normPath(data.roadmap).replace(/\/+$/, '') + '/';
        const inside = [...writeSet(t)].filter((p) => (p + '/').startsWith(root));
        if (inside.length) err('roadmap-edit', ref, `a tarefa escreve na pasta do roadmap (${inside.join(', ')}); isso é feito só nas etapas de registro`);
      }
      const distinct = new Set([...t.files.create, ...t.files.modify, ...t.files.test].map(normPath));
      if (distinct.size > 4) warn('task-too-wide', ref, `${distinct.size} arquivos em "files" (mais de 4); divida a tarefa`);
    });

    if (evidenceOk) {
      for (const row of evidence) {
        if (typeof row.command === 'string' && row.external === false) {
          const re = hit(row.command);
          if (re) err('external-undeclared', row.ac, `o comando "${row.command}" casa com o padrão de efeito externo ${re.source} e a linha é interna`);
        }
        if (typeof row.command === 'string' && row.external === true && !isStr(row.externalDedupe)) {
          err('external-dedupe-missing', row.ac, 'linha de evidência externa sem "externalDedupe"');
        }
      }
    }

    if (spec && evidenceOk) {
      const accs = Array.isArray(spec.acceptance) ? spec.acceptance : [];
      const edges = Array.isArray(spec.edgeCases) ? spec.edgeCases : [];
      const effects = Array.isArray(spec.externalEffects) ? spec.externalEffects : [];
      const specIds = new Set([...accs, ...edges, ...effects].map((x) => x.id));
      const coveredBy = (id) => tasks.filter((t) => t.covers.includes(id));
      for (const a of accs) {
        const row = evidence.find((r) => r.ac === a.id);
        const { tag } = parseVerifyTag(String(a.text));
        if (!row) err('acceptance-uncovered', a.id, `o critério ${a.id} do spec não tem linha de evidência`);
        const executable = !tag || EXECUTABLE_KINDS.includes(tag.kind);
        if (executable && coveredBy(a.id).length === 0) err('acceptance-uncovered', a.id, `nenhuma tarefa cobre o critério ${a.id}`);
        if (row && tag) {
          if (row.kind !== tag.kind) err('evidence-kind-differs', a.id, `a linha de evidência é "${row.kind}" e a marca do spec é "${tag.kind}"`);
          if (EXECUTABLE_KINDS.includes(tag.kind) && collapse(row.command ?? '') !== collapse(tag.evidence)) {
            err('evidence-command-differs', a.id, `o comando da linha difere do da marca do spec ("${collapse(tag.evidence)}"); o da marca é mantido`);
          }
        }
      }
      for (const row of evidence) {
        if (!specIds.has(row.ac)) err('cover-unknown', row.ac, `a linha de evidência cita ${row.ac}, que não existe no spec`);
      }
      tasks.forEach((t, i) => {
        for (const id of t.covers) {
          if (!specIds.has(id)) err('cover-unknown', `T${i + 1}`, `"covers" cita ${id}, que não existe no spec`);
        }
      });
      for (const c of edges) {
        if (coveredBy(c.id).length === 0) err('edge-case-uncovered', c.id, `nenhuma tarefa cobre o caso de borda ${c.id}`);
      }
      for (const x of effects) {
        if (!coveredBy(x.id).some((t) => t.external === true)) err('external-effect-unperformed', x.id, `nenhuma tarefa externa cobre o efeito ${x.id}`);
      }
    }
  }

  return { data, spec, errors, warnings, levels };
}

// Texto normalizado antes do resumo: BOM removido, fim de linha LF, NFC.
const normalizeText = (t) => String(t).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC');

export function emitPlan(text, { planPath, cwd = process.cwd(), specText = null, specPath = null, maxWidth = 4 } = {}) {
  void maxWidth; // usado pelo mapa (Task 6)
  const r = checkPlan(text, { planPath, specText, specPath });
  if (r.errors.length) return { errors: r.errors, warnings: r.warnings, out: null };
  const data = r.data;
  const hasDependents = (n) => data.tasks.some((t) => t.deps.includes(n));
  const tasks = data.tasks.map((t) => ({
    ...t,
    route: route(t, { hasDependents: hasDependents(t.n) }),
    wave: r.levels.get(t.n) + 1,
    fileCount: new Set([...t.files.create, ...t.files.modify, ...t.files.test].map(normPath)).size,
  }));
  const plan = { ...data, tasks };
  const source = {
    path: normPath(path.relative(cwd, path.resolve(planPath))),
    textDigest: fnv1a(normalizeText(text)),
  };
  return {
    errors: r.errors,
    warnings: r.warnings,
    out: { tool: 'plan-tool', schema: SCHEMA, path: planPath, source, plan, digest: planDigest({ plan, source }) },
  };
}

const USAGE = 'uso: node plan-tool.mjs check|emit <plan.md> [--spec <spec.md>] [--json]';

export function main(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  const out = (s) => io.stdout.write(s + '\n');
  const bad = (s) => {
    io.stderr.write(s + '\n');
    return 2;
  };
  const [cmd, ...rest] = argv;
  if (!cmd) return bad(USAGE);
  if (cmd !== 'check' && cmd !== 'emit') return bad(`comando desconhecido: ${cmd}\n${USAGE}`);
  let file = null;
  let json = false;
  let specPath = null;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json') json = true;
    else if (a === '--spec') {
      if (i + 1 >= rest.length) return bad(`--spec exige um caminho\n${USAGE}`);
      specPath = rest[++i];
    } else if (a.startsWith('--')) return bad(`opção desconhecida: ${a}\n${USAGE}`);
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
  if (cmd === 'emit') {
    const e = emitPlan(text, { planPath: file, specPath });
    if (e.errors.length) {
      for (const x of e.errors) io.stderr.write(`ERROR ${x.code} ${x.ref}: ${x.message}
`);
      return 1;
    }
    out(JSON.stringify(e.out, null, 2));
    return 0;
  }
  const r = checkPlan(text, { planPath: file, specPath });
  const code = r.errors.length ? 1 : 0;
  if (json) {
    out(JSON.stringify({
      tool: 'plan-tool', schema: SCHEMA, path: file, errors: r.errors, warnings: r.warnings,
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
