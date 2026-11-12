#!/usr/bin/env node
// Baseline consolidator: merges the aggregates of --out into baseline.json and linha-de-base.md.
// Usage: node tools/measure/baseline.mjs --out <dir> --dest <dir> [--date YYYY-MM-DD] [--tag <name>]
// Exit codes: 0 complete and coherent, 1 coherence errors, missing pieces or private data, 2 usage error.
// Missing pieces never stop the files from being written (except private data), so the owner sees what is left.
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { median } from './compare.mjs';
import { BASELINE_PLAN, DEFAULT_TAG } from './run-baseline.mjs';

const FAMILIES = ['haiku', 'sonnet', 'opus', 'fable', 'other'];
const CLASSES = [
  { name: 'plano-semeado', cls: 'plan', label: 'plano' },
  { name: 'codigo-semeado', cls: 'code', label: 'código' },
];
const RECORDED_ONLY = ['planner', 'tracker'];
const COST_NOTE = 'custo não é comparado nesta skill (DEC-016)';
const ATTEMPT_TARGET = 40;

// ---- Reading and merging ----

// The plan class is measured by the stage harness on the copy of the workflow prompt (DEC-279); the code class by the full pipeline.
const isPlanVariant = (variant) => /^plano-semeado-[AB]$/.test(variant);
const isPlanHarness = (h) => h?.stage === 'plan-review' && h?.arm === 'atual' && h?.armSource === 'copia-do-prompt';

// Every aggregate.json directly under outDir, in folder-name order. Harness aggregates are left out unless includeHarness is set.
export function loadAggregates(outDir, { includeHarness = false } = {}) {
  const out = [];
  if (!existsSync(outDir)) return out;
  const names = readdirSync(outDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  for (const name of names) {
    const file = join(outDir, name, 'aggregate.json');
    if (!existsSync(file)) continue;
    let agg;
    try {
      agg = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (agg && typeof agg === 'object' && (includeHarness || agg.harness === undefined) && typeof agg.variant === 'string') out.push(agg);
  }
  return out;
}

const emptyRole = () => ({
  calls: Object.fromEntries(FAMILIES.map((f) => [f, 0])),
  promptBytes: 0,
  tokens: { input: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 },
  cost: null,
  agents: 0,
});

function sumRoles(aggs) {
  const out = {};
  for (const agg of aggs) {
    for (const [name, role] of Object.entries(agg.roles ?? {})) {
      const acc = (out[name] ??= emptyRole());
      for (const f of FAMILIES) acc.calls[f] += role.calls?.[f] ?? 0;
      acc.promptBytes += role.promptBytes ?? 0;
      for (const k of Object.keys(acc.tokens)) acc.tokens[k] += role.tokens?.[k] ?? 0;
      if (typeof role.cost === 'number') acc.cost = (acc.cost ?? 0) + role.cost;
      acc.agents += role.agents ?? 0;
    }
  }
  return out;
}

function sumReasons(aggs) {
  const out = {};
  for (const agg of aggs) for (const [k, v] of Object.entries(agg.invalidReasons ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

function totalOutcomes(attempts) {
  const outcomes = {};
  const byCode = {};
  for (const a of attempts) {
    if (a.status !== 'valid') continue;
    for (const o of a.outcomes ?? []) {
      if (o.detectedBy === 'reviewer') {
        outcomes[o.id] ??= { class: o.class, detectedBy: 'reviewer', capturado: 0, perdido: 0, indeterminado: 0 };
        outcomes[o.id][o.outcome] = (outcomes[o.id][o.outcome] ?? 0) + 1;
      } else {
        byCode[o.id] ??= { 'acusado-pelo-codigo': 0, perdido: 0, indeterminado: 0 };
        byCode[o.id][o.outcome] = (byCode[o.id][o.outcome] ?? 0) + 1;
      }
    }
  }
  return { outcomes, deteccaoPorCodigo: byCode };
}

const validCosts = (attempts) => attempts.filter((a) => a.status === 'valid' && typeof a.counters?.cost === 'number').map((a) => a.counters.cost);

// One aggregate from several partial ones: attempts renumbered 1..n, counts and roles summed, outcomes and cost recomputed.
export function mergeVariant(aggs) {
  if (!aggs.length) throw new Error('mergeVariant needs at least one aggregate');
  const first = aggs[0];
  const attempts = aggs.flatMap((a) => structuredClone(a.attempts ?? [])).map((a, i) => ({ ...a, n: i + 1 }));
  const costs = validCosts(attempts);
  const sum = (key) => aggs.reduce((s, a) => s + (a[key] ?? 0), 0);
  const { seedSource } = aggs.find((a) => a.seedSource) ?? {};
  return {
    ...(first.note !== undefined ? { note: first.note } : {}),
    variant: first.variant,
    ...(first.harness ? { harness: first.harness } : {}),
    requested: sum('requested'),
    valid: sum('valid'),
    invalid: sum('invalid'),
    denied: sum('denied'),
    invalidReasons: sumReasons(aggs),
    plugin: first.plugin,
    superpowers: first.superpowers,
    ...(seedSource ? { seedSource } : {}),
    cli: first.cli,
    models: [...new Set(aggs.flatMap((a) => a.models ?? []))],
    pricesDate: first.pricesDate,
    permissionMode: first.permissionMode,
    attempts,
    roles: sumRoles(aggs),
    cost: costs.length ? { median: median(costs), min: Math.min(...costs), max: Math.max(...costs) } : { median: null, min: null, max: null },
    ...totalOutcomes(attempts),
  };
}

// ---- Coherence ----

const seedKey = (s) => JSON.stringify([s.kind, s.spec, s.plan, s.specSha256, s.planSha256]);

// A baseline has to come from one state: same plugin, superpowers, CLI, price table and seed source.
export function coherenceErrors(merged, { tagCommit }) {
  const errors = [];
  const distinct = (fn) => [...new Set(merged.map(fn))];
  const commits = distinct((a) => a.plugin?.commit ?? 'ausente');
  if (commits.length > 1) {
    errors.push(`plugin commit diverges between variants: ${commits.join(', ')}`);
  }
  for (const c of commits) {
    if (c !== tagCommit) errors.push(`plugin commit ${c} is not the start tag commit ${tagCommit}`);
  }
  const versions = distinct((a) => a.plugin?.version ?? 'ausente');
  if (versions.length > 1) errors.push(`plugin version diverges between variants: ${versions.join(', ')}`);
  const clis = distinct((a) => a.cli ?? 'ausente');
  if (clis.length > 1) errors.push(`CLI version diverges between variants: ${clis.join(', ')}`);
  const sp = distinct((a) => `${a.superpowers?.version ?? 'ausente'} (${a.superpowers?.commit ?? 'ausente'})`);
  if (sp.length > 1) errors.push(`superpowers diverges between variants: ${sp.join(', ')}`);
  const prices = distinct((a) => a.pricesDate ?? 'ausente');
  if (prices.length > 1) errors.push(`pricesDate diverges between variants: ${prices.join(', ')}`);
  const seeds = merged.filter((a) => a.variant.includes('semeado') && a.seedSource);
  if (new Set(seeds.map((a) => seedKey(a.seedSource))).size > 1) {
    errors.push(`seedSource diverges between seeded variants: ${seeds.map((a) => `${a.variant}=${a.seedSource.plan}@${String(a.seedSource.planSha256).slice(0, 12)}`).join(', ')}`);
  }
  return errors;
}

// ---- Detection class aggregate ----

// A + B joined in the format the comparator reads (one aggregate per class, attempts renumbered).
export function classAggregate(name, a, b) {
  const merged = mergeVariant([a, b]);
  return { ...merged, variant: name, ...(a.seedSource ?? b.seedSource ? { seedSource: a.seedSource ?? b.seedSource } : {}) };
}

// Plan attempts made in pipeline mode: not part of the class, kept as the DEC-051 rewrite rate.
export function pipelineRewriteStats(aggs) {
  const valid = aggs.reduce((s, a) => s + (a.valid ?? 0), 0);
  const invalid = aggs.reduce((s, a) => s + (a.invalid ?? 0), 0);
  const rewritten = aggs.reduce((s, a) => s + (a.invalidReasons?.['plano-reescrito'] ?? 0), 0);
  const total = valid + invalid;
  return { attempts: total, valid, invalid, rewritten, rewriteRate: total ? rewritten / total : null };
}

// ---- Privacy ----

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const AGENT = /agent-a[0-9a-f]+/g;
const PATHS = [
  [/[A-Za-z]:[\\/]+Users[\\/]+(?!<|\$)[^\\/\s"'`]+/i, 'windows-path'],
  [/\/(Users|home)\/(?!<|\$)[^\/\s"'`]+/, 'posix-path'],
  [/\b[A-Za-z]--Users-[^\s"'`]+/, 'project-dir-name'],
];

// Same rules as the privacy scan of E1 (session-metrics.test.mjs).
export function privacyFindings(text) {
  const found = [];
  for (const m of text.match(UUID) ?? []) {
    if (!m.startsWith('00000000-0000-4000-8000-')) found.push({ kind: 'uuid', match: m });
  }
  for (const m of text.match(AGENT) ?? []) {
    if (!m.startsWith('agent-afab')) found.push({ kind: 'agent-id', match: m });
  }
  for (const [re, kind] of PATHS) {
    const m = re.exec(text);
    if (m) found.push({ kind, match: m[0] });
  }
  return found;
}

// ---- Text ----

const validAttemptsOf = (agg) => (agg.attempts ?? []).filter((a) => a.status === 'valid');
const pickNums = (agg, fn) => validAttemptsOf(agg).map((a) => fn(a.counters ?? {})).filter((x) => typeof x === 'number' && Number.isFinite(x));
const num = (x) => (x === null || x === undefined ? '-' : Number.isInteger(x) ? String(x) : String(Math.round(x * 1e4) / 1e4));
const usd = (x) => (x === null || x === undefined ? '-' : `US$ ${x.toFixed(2).replace('.', ',')}`);
const costRange = (c) => (c?.median == null ? '-' : `${usd(c.median)} (${usd(c.min)} a ${usd(c.max)})`);
const sumCost = (agg) => (agg.attempts ?? []).reduce((s, a) => s + (typeof a.counters?.cost === 'number' ? a.counters.cost : 0), 0);
const reviewerOutcomes = (agg, cls) => Object.values(agg.outcomes ?? {}).filter((o) => o.class === cls);
const classAttempts = (agg, cls) => reviewerOutcomes(agg, cls).reduce((s, o) => s + o.capturado + o.perdido + o.indeterminado, 0);
const roleCalls = (role) => FAMILIES.map((f) => role.calls?.[f] ?? 0);

const COUNTERS = [
  ['haiku', (c) => c.structural?.haiku],
  ['sonnet', (c) => c.structural?.sonnet],
  ['opus', (c) => c.structural?.opus],
  ['fable', (c) => c.structural?.fable],
  ['other', (c) => c.structural?.other],
  ['ponderado', (c) => c.structural?.weighted],
  ['bytes', (c) => c.bytes],
  ['por tarefa', (c) => c.perTask],
  ['rodadas extras', (c) => c.conditional?.extraRounds],
  ['correções', (c) => c.conditional?.fixCalls],
  ['chamadas (principal)', (c) => c.main?.agentCalls],
  ['bytes (principal)', (c) => c.main?.bytes],
  ['turnos (principal)', (c) => c.main?.turns],
  ['estático (bytes)', (c) => c.static?.bytes],
  ['custo', (c) => c.cost],
];

function variantRow(name, plan, agg) {
  if (!agg) return `| ${name} | incompleta (0/${plan.runs}) | - | - | - | - | - | - | - |`;
  const mark = agg.valid < plan.runs ? `incompleta (${agg.valid}/${plan.runs})` : `${agg.valid}/${plan.runs}`;
  const cost = RECORDED_ONLY.includes(name) ? 'ver nota' : costRange(agg.cost);
  return `| ${name} | ${mark} | ${cost} | ${agg.plugin?.version} (${String(agg.plugin?.commit).slice(0, 12)}) | ${agg.superpowers?.version} (${String(agg.superpowers?.commit).slice(0, 12)}) | ${(agg.models ?? []).join(', ')} | ${agg.pricesDate} | ${agg.cli} | ${agg.permissionMode} |`;
}

const VARIANT_HEAD = [
  '| Variante | Válidas/pedidas | Custo mediano (faixa) | Plugin | Superpowers | Modelos | Preços | CLI | Permissão |',
  '|---|---|---|---|---|---|---|---|---|',
];
const ROLE_HEAD = [
  '| Variante | Papel | haiku | sonnet | opus | fable | other | Bytes de prompt |',
  '|---|---|---|---|---|---|---|---|',
];

function roleRows(name, agg) {
  if (!agg) return [];
  return Object.entries(agg.roles ?? {}).map(([role, r]) => `| ${name} | ${role} | ${roleCalls(r).join(' | ')} | ${r.promptBytes} |`);
}

function classSection({ name, label, cls }, c, flag) {
  const lines = [`### Detecção por classe: ${label} (${name})`, ''];
  if (!c) {
    lines.push(`incompleta: faltam os agregados de ${name}-A e ${name}-B.`, '');
    return lines;
  }
  if (flag) lines.push(`Situação: incompleta (semeadura sintética). A linha de base de detecção exige a semeadura de uma execução aprovada.`, '');
  const outs = Object.entries(c.outcomes ?? {}).filter(([, o]) => o.class === cls);
  const tot = (k) => outs.reduce((s, [, o]) => s + (o[k] ?? 0), 0);
  const attempts = classAttempts(c, cls);
  const invalidRate = c.valid + c.invalid ? c.invalid / (c.valid + c.invalid) : 0;
  lines.push('| Defeito | Capturado | Perdido | Indeterminado |', '|---|---|---|---|');
  for (const [id, o] of outs) lines.push(`| ${id} | ${o.capturado} | ${o.perdido} | ${o.indeterminado} |`);
  lines.push(`| total | ${tot('capturado')} | ${tot('perdido')} | ${tot('indeterminado')} |`, '');
  lines.push(`- Tentativas válidas da classe: ${attempts} (alvo ${ATTEMPT_TARGET}).`);
  lines.push(`- Execuções inválidas: ${c.invalid} (taxa ${Math.round(invalidRate * 1000) / 10}%).`);
  const reasons = Object.entries(c.invalidReasons ?? {});
  lines.push(`- Motivos de inválida: ${reasons.length ? reasons.map(([k, v]) => `${k} (${v})`).join('; ') : 'nenhum'}.`);
  if (c.harness) lines.push(`- Medido pelo harness de etapa: ${c.harness.stage}, braço ${c.harness.arm}, commit do workflow ${c.harness.workflowCommit ?? 'ausente'}.`);
  const s = c.seedSource;
  lines.push(
    s
      ? `- Origem da semeadura: ${s.kind}; spec ${s.spec} (sha256 ${s.specSha256}); plano ${s.plan} (sha256 ${s.planSha256}).`
      : '- Origem da semeadura: ausente no agregado.',
    '',
  );
  return lines;
}

export function measurementRows(baseline, { date }) {
  const rows = [];
  const row = (detail, cost, status = 'concluído') => `| ${date} | E15 | linha-de-base | ${detail} | ${usd(cost)} (custo devolvido pela CLI) | - | ${status} |`;
  // `requested` is summed over every pass (extra passes, resumes, stopped batches), so the plan's `runs` is the target.
  for (const { variant, runs } of BASELINE_PLAN) {
    const agg = baseline.variants?.[variant];
    if (agg) rows.push(row(`${variant}: ${agg.valid}/${runs} execuções válidas`, sumCost(agg), agg.valid < runs ? 'em andamento' : 'concluído'));
  }
  for (const { name, cls } of CLASSES) {
    const agg = baseline.classes?.[name];
    if (!agg) continue;
    const attempts = classAttempts(agg, cls);
    const synthetic = (baseline.incomplete ?? []).includes(`${name} (semeadura sintética)`) || !agg.seedSource || agg.seedSource.kind === 'sintetico';
    rows.push(row(`detecção ${name}: ${attempts} tentativas válidas`, sumCost(agg), attempts < ATTEMPT_TARGET || synthetic ? 'em andamento' : 'concluído'));
  }
  return rows;
}

function buildMarkdown({ baseline, date, tagCommit, errors, incomplete, flagged }) {
  const v = baseline.variants;
  const L = [];
  L.push('# Linha de base', '');
  L.push(`Data: ${date}. Commit da tag de partida: ${tagCommit}.`, '');
  if (errors.length || incomplete.length) {
    L.push('## Pendências', '');
    for (const e of errors) L.push(`- erro: ${e}`);
    for (const i of incomplete) L.push(`- incompleta: ${i}`);
    L.push('');
  }
  const plan = Object.fromEntries(BASELINE_PLAN.map((p) => [p.variant, p]));
  const releaseNames = ['plan-only', 'coordinator', 'completo', 'parada-retomada'];
  L.push('## Release e coordinator', '', ...VARIANT_HEAD);
  for (const n of releaseNames) L.push(variantRow(n, plan[n], v[n]));
  L.push('', '### Papéis (chamadas por família e bytes de prompt, somados nas execuções válidas)', '', ...ROLE_HEAD);
  for (const n of releaseNames) L.push(...roleRows(n, v[n]));
  L.push('', '## Planner e tracker', '', `Nota: ${COST_NOTE}.`, '', ...VARIANT_HEAD);
  for (const n of RECORDED_ONLY) L.push(variantRow(n, plan[n], v[n]));
  L.push('', ...ROLE_HEAD);
  for (const n of RECORDED_ONLY) L.push(...roleRows(n, v[n]));
  L.push('', '## Detecção por classe', '');
  for (const c of CLASSES) L.push(...classSection(c, baseline.classes[c.name], flagged.has(c.name)));
  if (baseline.dec051) {
    const d = baseline.dec051;
    L.push(`Plano em modo pipeline (fora da classe; dado de DEC-051): ${d.attempts} tentativas, ${d.rewritten} com plano reescrito, ${d.invalid} inválidas (taxa de reescrita ${d.rewriteRate == null ? '-' : Math.round(d.rewriteRate * 1000) / 10 + '%'}).`, '');
  }
  L.push('## Valores de referência para as metas', '', 'Mediana de cada contador por variante, nas execuções válidas.', '');
  const names = BASELINE_PLAN.map((p) => p.variant).filter((n) => v[n]);
  L.push(`| Contador | ${names.join(' | ')} |`, `|---|${names.map(() => '---').join('|')}|`);
  for (const [label, fn] of COUNTERS) {
    L.push(`| ${label} | ${names.map((n) => (label === 'custo' && RECORDED_ONLY.includes(n) ? '-' : num(median(pickNums(v[n], fn))))).join(' | ')} |`);
  }
  L.push('', '## Linhas para roadmap:measurements', '', '| Data | Entregável | Tipo | Detalhe | Registrado | Faturado | Status |', '|---|---|---|---|---|---|---|');
  L.push(...measurementRows(baseline, { date }), '');
  return L.join('\n');
}

// ---- Build ----

export function buildBaseline({ outDir, tagCommit, date }) {
  const loaded = loadAggregates(outDir, { includeHarness: true });
  // Pipeline-mode plan aggregates leave the class and feed only the DEC-051 rewrite rate; other harness aggregates are ignored.
  const pipelinePlan = loaded.filter((a) => isPlanVariant(a.variant) && a.harness === undefined);
  const raw = loaded.filter((a) => (isPlanVariant(a.variant) ? isPlanHarness(a.harness) : a.harness === undefined));
  const groups = {};
  for (const a of raw) (groups[a.variant] ??= []).push(a);
  const variants = {};
  for (const { variant } of BASELINE_PLAN) if (groups[variant]) variants[variant] = mergeVariant(groups[variant]);

  // Partials are checked too: a mix of states inside one variant is as wrong as a mix between variants.
  const errors = coherenceErrors(raw.filter((a) => BASELINE_PLAN.some((p) => p.variant === a.variant)), { tagCommit });
  const wfCommits = [...new Set(raw.filter((a) => isPlanVariant(a.variant)).map((a) => a.harness?.workflowCommit ?? 'ausente'))];
  if (wfCommits.length > 1) errors.push(`plan harness workflow commit diverges: ${wfCommits.join(', ')}`);
  const incomplete = BASELINE_PLAN.filter((p) => (variants[p.variant]?.valid ?? 0) < p.runs).map((p) => p.variant);

  const classes = {};
  const flagged = new Set();
  for (const { name } of CLASSES) {
    const a = variants[`${name}-A`];
    const b = variants[`${name}-B`];
    if (!a || !b) continue;
    classes[name] = classAggregate(name, a, b);
    // Each side must carry its own seed source: one side cannot borrow the other's.
    const unseeded = (x) => !x.seedSource || x.seedSource.kind === 'sintetico';
    if (unseeded(a) || unseeded(b)) {
      flagged.add(name);
      incomplete.push(`${name} (semeadura sintética)`);
    }
  }

  const first = Object.values(variants)[0];
  const baseline = {
    date,
    tagCommit,
    plugin: first?.plugin ?? null,
    superpowers: first?.superpowers ?? null,
    cli: first?.cli ?? null,
    pricesDate: first?.pricesDate ?? null,
    permissionMode: first?.permissionMode ?? null,
    variants,
    classes,
    ...(pipelinePlan.length ? { dec051: pipelineRewriteStats(pipelinePlan) } : {}),
    errors,
    incomplete,
  };
  const markdown = buildMarkdown({ baseline, date, tagCommit, errors, incomplete, flagged });
  return { baseline, markdown, errors, incomplete, exitCode: errors.length || incomplete.length ? 1 : 0 };
}

// ---- CLI ----

const USAGE = 'usage: node tools/measure/baseline.mjs --out <dir> --dest <dir> [--date YYYY-MM-DD] [--tag <name>]';

function parseArgs(argv) {
  const opts = {};
  const names = { '--out': 'out', '--dest': 'dest', '--date': 'date', '--tag': 'tag' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = names[argv[i]];
    if (!key || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) return null;
    opts[key] = argv[i + 1];
  }
  if (!opts.out || !opts.dest) return null;
  if (opts.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) return null;
  return opts;
}

function gitResolve(tag) {
  return execFileSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Returns the exit code; deps are injectable for the tests.
export function main(argv, deps = {}) {
  const log = deps.log ?? ((m) => console.log(m));
  const err = deps.err ?? ((m) => console.error(m));
  const resolveTag = deps.resolveTag ?? gitResolve;
  const opts = parseArgs(argv);
  if (!opts) {
    err(USAGE);
    return 2;
  }
  const tag = opts.tag ?? DEFAULT_TAG;
  let tagCommit;
  try {
    tagCommit = resolveTag(tag);
  } catch (e) {
    err(`cannot resolve tag ${tag}: ${String(e.stderr ?? e.message).trim()}`);
    return 2;
  }
  const date = opts.date ?? new Date().toLocaleDateString('sv-SE');
  const r = buildBaseline({ outDir: resolve(opts.out), tagCommit, date });
  const json = JSON.stringify(r.baseline, null, 2) + '\n';
  const findings = privacyFindings(json);
  if (findings.length) {
    err(`refusing to write: private data in the baseline (${findings.map((f) => `${f.kind}: ${f.match}`).join('; ')})`);
    return 1;
  }
  mkdirSync(resolve(opts.dest), { recursive: true });
  writeFileSync(join(resolve(opts.dest), 'baseline.json'), json);
  writeFileSync(join(resolve(opts.dest), 'linha-de-base.md'), r.markdown);
  for (const e of r.errors) err(`error: ${e}`);
  for (const i of r.incomplete) err(`incomplete: ${i}`);
  log(JSON.stringify({ dest: resolve(opts.dest), variants: Object.keys(r.baseline.variants).length, errors: r.errors.length, incomplete: r.incomplete.length }));
  return r.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
