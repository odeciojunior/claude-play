#!/usr/bin/env node
// Gate of a paid measurement batch (parada-retomada runs, one at a time): reads the authorization decision and the run
// folders and says whether the next run may start. Read only: it launches no process, uses no network and changes no file.
// Usage: node tools/measure/lote-gate.mjs --out <batch folder> --commit <candidate sha> --autorizacao <DEC-NNN> --decisions <decisions.md>
// Exit codes: 0 pode-seguir, 2 usage error, 3 fechar, 4 parar.
// The output is one JSON line without session ids or absolute paths.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract, loadPrices } from './session-metrics.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// Constants of DEC-017 (roadmap pos-2.6.0, E53): cap of the batch, cap of one run, reserve the next run must fit in,
// goal of valid runs and the number of invalid runs that closes the batch. A change goes back to the delegate (DEC-004, DEC-021).
export const LIMITS = { capUsd: 18, perRunUsd: 6, reserveUsd: 5.5, validGoal: 3, invalidLimit: 2 };

// Largest --max-budget-usd of one claude -p; an attempt of parada-retomada has two, so half of what is left also bounds it.
const SESSION_BUDGET_USD = 3;
const DELIVERABLE = 'E53';
const ORIGINS = ['dono', 'dono (delegado, opus)'];
const FOLDER_PREFIX = 'parada-retomada-';
const PHASES = ['parada', 'retomada'];
const STRUCTURAL = ['haiku', 'sonnet', 'opus', 'weighted'];
const USAGE = 'usage: node tools/measure/lote-gate.mjs --out <batch folder> --commit <40 hex> --autorizacao <DEC-NNN> --decisions <decisions.md>';

// Money is compared and summed in whole millionths of a dollar.
const micro = (usd) => Math.round(usd * 1e6);
const money = (usd) => `US$ ${usd.toFixed(6)}`;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCost = (v) => Number.isFinite(v) && v >= 0;
// An error message can carry a path: only its code (or class name) reaches the output.
const codeOf = (e) => e?.code ?? e?.name ?? 'erro';

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const subfolders = (dir) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

// ---- Authorization ----

const cellsOf = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.replaceAll('\\|', '|').trim());

// Rows of the decisions table (the one between the roadmap:decisions marks) keyed by header, or null without a table.
function decisionRows(text) {
  const block = /<!-- roadmap:decisions -->([\s\S]*?)<!-- \/roadmap:decisions -->/.exec(String(text))?.[1];
  const lines = (block ?? '').split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return null;
  const header = cellsOf(lines[0]);
  const columns = ['ID', 'Entregável', 'Decisão', 'Origem', 'Status'].map((name) => [name, header.indexOf(name)]);
  if (columns.some(([, i]) => i < 0)) return null;
  return lines
    .slice(1)
    .map(cellsOf)
    .map((cells) => Object.fromEntries(columns.map(([name, i]) => [name, cells[i] ?? ''])));
}

export function checkAuthorization({ decisionsText, id, commit }) {
  const no = (why) => ({ ok: false, why });
  const rows = decisionRows(decisionsText);
  if (!rows) return no('tabela de decisões ausente ou sem as colunas esperadas');
  const found = rows.filter((r) => r.ID === id);
  if (found.length !== 1) return no(`${id}: ${found.length} linhas na tabela, esperada exatamente uma`);
  const [row] = found;
  if (row.Entregável !== DELIVERABLE) return no(`${id}: entregável diferente de ${DELIVERABLE}`);
  if (row.Status !== 'vigente') return no(`${id}: status diferente de vigente`);
  if (!ORIGINS.includes(row.Origem)) return no(`${id}: origem diferente de ${ORIGINS.join(' ou ')}`);
  const sha = String(commit).toLowerCase();
  const tokens = row.Decisão.match(/(?<![\p{L}\p{N}_])[0-9a-fA-F]{7,40}(?![\p{L}\p{N}_])/gu) ?? [];
  if (!tokens.some((t) => sha.startsWith(t.toLowerCase()))) return no(`${id}: a decisão não cita o SHA do candidato`);
  // US$ 18 or US$ 18,00; a final period is fine, a further digit (180, 18,50, 18.5) is another amount
  const cap = new RegExp(`US\\$ ${LIMITS.capUsd}(?:,00)?(?!\\d|[.,]\\d)`);
  if (!cap.test(row.Decisão)) return no(`${id}: a decisão não cita o teto US$ ${LIMITS.capUsd}`);
  return { ok: true, why: 'ok' };
}

// ---- Cost of the copied transcripts ----

// `dir` holds the <sid>.jsonl files: private/transcripts/<k>/ in the harness layout, private/transcripts/ in the flat one.
// usd is null (with the reason in why) whenever part of the spending cannot be priced. No session id or path is returned.
export function costOfTranscripts(dir, { prices = loadPrices(join(here, 'prices.json')) } = {}) {
  const base = resolve(dir);
  const entries = existsSync(base) ? readdirSync(base, { withFileTypes: true }) : [];
  const sids = entries.filter((e) => e.isFile() && e.name.endsWith('.jsonl')).map((e) => e.name.slice(0, -'.jsonl'.length));
  const orphan = entries.some((e) => e.isDirectory() && !sids.includes(e.name) && existsSync(join(base, e.name, 'subagents')));
  const { runs, unpriced } = sids.length
    ? extract({ root: dirname(base), prices, runs: sids.map((sid) => ({ run: sid, sessions: [sid] })) })
    : { runs: [], unpriced: [] };
  let usd = 0;
  let why = orphan ? 'pasta de sessão com subagents e sem o .jsonl' : null;
  for (const run of runs) {
    const agents = Object.values(run.total.calls).reduce((n, v) => n + v, 0);
    if (run.main.cost === null) why ??= 'sessão sem custo na conversa principal';
    else if (agents > 0 && run.total.cost === null) why ??= 'sessão com agentes sem custo';
    else usd += run.main.cost + (run.total.cost ?? 0);
  }
  if (unpriced.length) why ??= `modelo sem preço (${unpriced.join(', ')})`;
  return { usd: why === null ? usd : null, sessions: sids.length, unpriced, why };
}

// Incomplete folder: the attempt number is unknown, so every private/transcripts/<k>/ that exists is summed.
function costOfAllSubfolders(transcripts, prices) {
  let total = 0;
  let why = null;
  for (const name of existsSync(transcripts) ? subfolders(transcripts) : []) {
    const c = costOfTranscripts(join(transcripts, name), { prices });
    if (c.usd === null) why ??= c.why;
    else total += micro(c.usd);
  }
  return { usd: why === null ? total / 1e6 : null, why };
}

const describeCost = (c) => (c.usd === null ? `custo das transcrições desconhecido (${c.why})` : `custo das transcrições: ${money(c.usd)}`);

// ---- SHA256SUMS ----

const leavesFolder = (path) => path.includes('\\') || isAbsolute(path) || /^[A-Za-z]:/.test(path) || path.split('/').some((s) => s === '' || s === '.' || s === '..');

function filesUnder(root, rel) {
  return readdirSync(join(root, rel), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(root, `${rel}/${e.name}`) : [`${rel}/${e.name}`]));
}

// why never names a file: the paths under private/ carry session ids.
export function checkSums(runDir) {
  const no = (why) => ({ ok: false, why });
  let text;
  try {
    text = readFileSync(join(runDir, 'SHA256SUMS'), 'utf8');
  } catch (e) {
    return no(`SHA256SUMS ausente ou ilegível (${codeOf(e)})`);
  }
  const listed = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (line === '') continue;
    const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    if (!m) return no('linha fora do formato');
    const [, hash, path] = m;
    if (leavesFolder(path)) return no('caminho que sai da pasta');
    let content;
    try {
      content = readFileSync(join(runDir, path));
    } catch (e) {
      return no(`arquivo listado ausente ou ilegível (${codeOf(e)})`);
    }
    if (createHash('sha256').update(content).digest('hex') !== hash) return no('hash diferente do arquivo');
    listed.add(path);
  }
  let present;
  try {
    present = ['aggregate.json', ...(existsSync(join(runDir, 'private')) ? filesUnder(runDir, 'private') : [])];
  } catch (e) {
    return no(`private/ ilegível (${codeOf(e)})`);
  }
  const uncovered = present.filter((p) => !listed.has(p)).length;
  return uncovered ? no(`${uncovered} arquivo(s) sem linha na lista`) : { ok: true, why: 'ok' };
}

// ---- One run folder ----

function contractFaults(aggregate, commit) {
  const faults = [];
  if (aggregate.variant !== 'parada-retomada') faults.push('variant diferente de parada-retomada');
  if (aggregate.requested !== 1) faults.push('requested diferente de 1');
  if (aggregate.requestedModel !== 'opus') faults.push('requestedModel diferente de opus');
  if (String(aggregate.plugin?.commit).toLowerCase() !== String(commit).toLowerCase()) faults.push('plugin.commit diferente de --commit');
  return faults;
}

// Fields that must be the same in every aggregate of the batch.
const environmentOf = (aggregate) => ({
  cli: aggregate.cli,
  'superpowers.version': aggregate.superpowers?.version,
  'superpowers.commit': aggregate.superpowers?.commit,
  permissionMode: aggregate.permissionMode,
});

// private/attempts.json (not written for a denied run) must not list a session whose transcript was not copied.
// `k` is the transcripts folder that is read; null (incomplete folder) takes the folder of each listed attempt.
function listedSessionsFault(runDir, k) {
  const file = join(runDir, 'private', 'attempts.json');
  if (!existsSync(file)) return null;
  const list = readJson(file)?.attempts;
  if (!Array.isArray(list) || list.some((a) => !Array.isArray(a?.sessions))) return 'private/attempts.json ilegível';
  const copied = (a, sid) => typeof sid === 'string' && basename(sid) === sid && existsSync(join(runDir, 'private', 'transcripts', String(k ?? a.n), `${sid}.jsonl`));
  return list.every((a) => a.sessions.every((sid) => copied(a, sid))) ? null : 'private/attempts.json lista sessão sem transcrição copiada';
}

// Labels that show a step done again: -retry<n>, a 2nd to 5th load, or a reread.
const isRepeat = (label) => /-retry\d+$|load[2-5]$|reread/.test(label);

function describeValid(runDir, k, entry, item, stop) {
  const s = entry.counters?.structural;
  if (STRUCTURAL.every((f) => Number.isFinite(s?.[f]))) {
    item.counters = { haiku: s.haiku, sonnet: s.sonnet, opus: s.opus, weighted: s.weighted, weightedNoHaiku: s.weighted - s.haiku };
  } else stop('válida sem contadores');
  const models = entry.sessionModels;
  if (!isObject(models)) stop('válida sem sessionModels');
  const outside = PHASES.filter((p) => (models?.[p] ?? null) !== null && models[p] !== 'opus');
  item.sessionModels = models ?? null;
  item.modelDivergence = entry.modelDivergence ?? null;
  item.caveat = outside.length > 0;
  if (outside.length === PHASES.length) stop('as duas fases rodaram fora de opus');
  const agents = readJson(join(runDir, 'private', 'metrics', String(k), 'metrics.json'))?.runs?.[0]?.agents;
  if (isObject(agents)) item.repeatLabels = Object.keys(agents).filter(isRepeat).sort();
  else stop('private/metrics/<n>/metrics.json ilegível ou sem agentes');
}

// Fills `item` (class, status, costUsd and the data of a valid run) and reports every reason to stop.
// Returns { sumsOk, environment } (environment null without a readable aggregate).
function evaluateRun(runDir, item, { commit, prices, stop }) {
  const transcripts = join(runDir, 'private', 'transcripts');
  const raw = readJson(join(runDir, 'aggregate.json'));
  const aggregate = isObject(raw) ? raw : null;
  const attempts = Array.isArray(aggregate?.attempts) ? aggregate.attempts : [];
  const entry = attempts.length === 1 && Number.isInteger(attempts[0]?.n) && attempts[0].n >= 1 ? attempts[0] : null;
  const sums = aggregate ? checkSums(runDir) : { ok: false };
  if (aggregate) for (const fault of contractFaults(aggregate, commit)) stop(fault);

  if (!entry) {
    const all = costOfAllSubfolders(transcripts, prices);
    item.costUsd = all.usd;
    stop(`${aggregate ? 'aggregate.json sem exatamente uma tentativa numerada' : 'sem aggregate.json legível'}; ${describeCost(all)}`);
    if (aggregate && !sums.ok) stop(`SHA256SUMS não confere: ${sums.why}`);
    const fault = listedSessionsFault(runDir, null);
    if (fault) stop(fault);
    return { sumsOk: sums.ok, environment: aggregate && environmentOf(aggregate) };
  }

  const k = entry.n;
  item.status = typeof entry.status === 'string' ? entry.status : null;
  const cost = costOfTranscripts(join(transcripts, String(k)), { prices });
  if (!sums.ok) stop(`SHA256SUMS não confere: ${sums.why}; ${describeCost(cost)}`);
  const fault = listedSessionsFault(runDir, k);
  if (fault) stop(fault);
  if (cost.usd === null) stop(describeCost(cost));

  if (item.status === 'valid') {
    item.class = entry.integrated === true ? 'valida' : 'valida-sem-integracao';
    if (entry.integrated !== true) stop('válida no arnês sem E5 integrado');
    if (isCost(entry.costUsd)) item.costUsd = entry.costUsd;
    else stop(`costUsd ausente ou não numérico; ${describeCost(cost)}`);
    if (cost.sessions === 0) stop('válida sem sessão nas transcrições');
    if (cost.usd !== null && micro(cost.usd) > micro(LIMITS.perRunUsd)) stop(`custo das transcrições ${money(cost.usd)} acima de US$ ${LIMITS.perRunUsd.toFixed(2)}`);
    describeValid(runDir, k, entry, item, stop);
  } else {
    item.costUsd = cost.usd;
    if (item.status === 'invalid' || item.status === 'denied') {
      item.class = cost.sessions > 0 ? 'invalida' : 'invalida-sem-sessao';
      if (cost.sessions === 0) stop('inválida ou negada sem sessão');
    } else {
      item.class = 'status-desconhecido';
      stop('status da tentativa fora de valid, invalid e denied');
    }
  }
  return { sumsOk: sums.ok, environment: environmentOf(aggregate) };
}

// ---- The batch ----

export function gate({ out, commit, autorizacao, decisions }) {
  const stops = [];
  try {
    const auth = checkAuthorization({ decisionsText: readFileSync(decisions, 'utf8'), id: autorizacao, commit });
    if (!auth.ok) stops.push(`autorização: ${auth.why}`);
  } catch (e) {
    stops.push(`autorização: arquivo de decisões ilegível (${codeOf(e)})`);
  }
  let folders = [];
  let prices;
  try {
    prices = loadPrices(join(here, 'prices.json'));
    folders = subfolders(out).filter((n) => n.startsWith(FOLDER_PREFIX)).sort();
  } catch (e) {
    stops.push(`pasta do lote ou tabela de preços ilegível (${codeOf(e)})`);
  }

  const executions = [];
  let valid = 0;
  let invalid = 0;
  let spent = 0; // millionths of a dollar
  let reference = null;
  for (const folder of folders) {
    const stop = (why) => stops.push(`${folder}: ${why}`);
    const item = { folder, class: 'incompleta', status: null, costUsd: null };
    let sumsOk = false;
    try {
      const run = evaluateRun(join(out, folder), item, { commit, prices, stop });
      sumsOk = run.sumsOk;
      if (run.environment) {
        reference ??= run.environment;
        for (const [field, value] of Object.entries(run.environment)) {
          if (typeof value !== 'string') stop(`${field} ausente no aggregate.json`);
          else if (value !== reference[field]) stop(`${field} difere das demais execuções do lote`);
        }
      }
    } catch (e) {
      stop(`erro de leitura (${codeOf(e)})`);
    }
    executions.push(item);
    if (item.costUsd !== null) {
      spent += micro(item.costUsd);
      if (micro(item.costUsd) > micro(LIMITS.perRunUsd)) stop(`custo ${money(item.costUsd)} acima de US$ ${LIMITS.perRunUsd.toFixed(2)}`);
    }
    // a run whose SHA256SUMS does not match never counts as valid (the delegate settles it first)
    if (item.class === 'valida' && sumsOk) valid += 1;
    if (item.class === 'invalida') invalid += 1;
  }

  const accumulatedUsd = spent / 1e6;
  const cap = micro(LIMITS.capUsd);
  if (spent > cap) stops.push(`acumulado ${money(accumulatedUsd)} acima de US$ ${LIMITS.capUsd.toFixed(2)}`);
  const closes = [];
  if (valid >= LIMITS.validGoal) closes.push(`meta de válidas atingida (${valid} de ${LIMITS.validGoal})`);
  if (invalid >= LIMITS.invalidLimit) closes.push(`inválidas (${invalid}) no limite de ${LIMITS.invalidLimit}`);
  if (spent + micro(LIMITS.reserveUsd) > cap) closes.push(`acumulado ${money(accumulatedUsd)} mais a reserva de US$ ${LIMITS.reserveUsd.toFixed(2)} passa de US$ ${LIMITS.capUsd.toFixed(2)}`);

  const verdict = stops.length ? 'parar' : closes.length ? 'fechar' : 'pode-seguir';
  const reasons = stops.length ? stops : closes;
  // whole cents, rounded down
  const cents = Math.min(SESSION_BUDGET_USD * 100, Math.floor((cap - spent) / 2 / 10000));
  return {
    executions,
    valid,
    invalid,
    accumulatedUsd,
    verdict,
    reason: reasons.join('; ') || 'ok',
    nextMaxBudgetUsd: verdict === 'pode-seguir' ? (cents / 100).toFixed(2) : null,
  };
}

// ---- Command line ----

const OPTIONS = { '--out': 'out', '--commit': 'commit', '--autorizacao': 'autorizacao', '--decisions': 'decisions' };
const EXIT = { 'pode-seguir': 0, fechar: 3, parar: 4 };

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = Object.hasOwn(OPTIONS, argv[i]) ? OPTIONS[argv[i]] : null;
    if (!key || key in o || argv[i + 1] === undefined) return null;
    o[key] = argv[i + 1];
  }
  if (Object.keys(o).length !== Object.keys(OPTIONS).length) return null;
  if (!/^[0-9a-fA-F]{40}$/.test(o.commit) || !/^DEC-\d{3,}$/.test(o.autorizacao)) return null;
  try {
    return statSync(o.out).isDirectory() ? o : null;
  } catch {
    return null;
  }
}

export function main(argv) {
  const o = parseArgs(argv);
  if (!o) {
    console.error(USAGE);
    return 2;
  }
  const result = gate(o);
  console.log(JSON.stringify(result));
  return EXIT[result.verdict];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
