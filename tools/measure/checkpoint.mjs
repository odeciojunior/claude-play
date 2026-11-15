#!/usr/bin/env node
// Measurement checkpoint of E17: a loop over the E1 comparator for two baseline.json files (before/after).
// Usage: node tools/measure/checkpoint.mjs --before <baseline.json> --after <baseline.json> --dest <dir> [--date AAAA-MM-DD] [--margin 6] [--attempts 40] [--bytes-tolerance 0.03]
// Exit codes: 0 no block, 1 block, 2 permission mode mismatch or usage error. No threshold is defined here: compare() owns them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare, inputRefusal, median } from './compare.mjs';
import { measureGoals } from './prose-goals.mjs';
import { PANEL_VARIANTS, panelMatches, armMatches } from './run-batch.mjs';

export { armMatches };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = 'plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js';
const ARMS_DIR = 'tools/measure/arms';
const ARMS = { planReview: `${ARMS_DIR}/plan-review-atual.md`, planFix: `${ARMS_DIR}/plan-fix-atual.md` };
const PLAN_CLASS = 'plano-semeado';

const validAttempts = (agg) => (agg?.attempts ?? []).filter((a) => a.status === 'valid');
const costSide = (agg) => {
  const xs = validAttempts(agg).map((a) => a.counters?.cost).filter((c) => typeof c === 'number' && Number.isFinite(c));
  return xs.length ? { median: median(xs), min: Math.min(...xs), max: Math.max(...xs), n: xs.length } : null;
};

// Every *-atual.md arm is checked against the workflow; only the two plan arms decide the plan-class block (spec arms are reported).
function armStatus(readAt, listAt) {
  const check = (armFile) => {
    try {
      return armMatches(readAt(armFile), readAt(WORKFLOW));
    } catch {
      return false;
    }
  };
  let names = [];
  let listError = null;
  try {
    names = listAt(ARMS_DIR).map((f) => f.split('/').pop()).filter((f) => f.endsWith('-atual.md')).sort();
  } catch (e) {
    listError = String(e?.message ?? e); // no listing: only the plan arms are known, and the report says so
  }
  const files = {};
  for (const f of names) files[f] = check(`${ARMS_DIR}/${f}`);
  const planReview = check(ARMS.planReview);
  const planFix = check(ARMS.planFix);
  return { planReview, planFix, files, listError };
}

function safeCompare(before, after, options) {
  const refusal = inputRefusal(before, after);
  if (refusal) return { refusal, bloqueia: true };
  return compare(before, after, options);
}

const SWAP_VARIANT = 'coordinator';

// beforeCoordinator: { baseline, path } swaps the "before" side of the coordinator variant for the one in another baseline.json
// (E11: the 1.7.0 side, measured in its own --out); every other variant keeps the before side.
export function checkpoint(before, after, { readAt, listAt, margin, attempts, bytesTolerance, date, deliverable = 'E17', beforeCoordinator } = {}) {
  const empty = { variants: {}, classes: {}, cost: {}, panel: {}, arm: null, goals: [], measurementRows: [], blockReasons: [] };
  for (const [side, agg] of [['before', before], ['after', after], ...(beforeCoordinator ? [['before-coordinator', beforeCoordinator.baseline]] : [])]) {
    if (agg?.permissionMode !== 'bypassPermissions') {
      return { exit: 2, reason: `${side} was measured in permission mode "${agg?.permissionMode}", not bypassPermissions`, ...empty };
    }
  }
  let sideSwap;
  if (beforeCoordinator) {
    const swapped = beforeCoordinator.baseline.variants?.[SWAP_VARIANT];
    if (!swapped) return { exit: 2, reason: `--before-coordinator has no ${SWAP_VARIANT} variant`, ...empty };
    before = { ...before, variants: { ...before.variants, [SWAP_VARIANT]: swapped } };
    sideSwap = { variant: SWAP_VARIANT, path: beforeCoordinator.path };
  }
  const options = {};
  if (margin !== undefined) options.margin = margin;
  if (attempts !== undefined) options.attempts = attempts;
  if (bytesTolerance !== undefined) options.bytesTolerance = bytesTolerance;
  const blockReasons = [];
  const arm = armStatus(readAt, listAt);

  const pair = (b, a) => (b && a ? { status: 'comparada', ...safeCompare(b, a, options) } : { status: 'ausente', side: b ? 'antes' : 'depois' });
  const names = (key) => [...new Set([...Object.keys(before[key] ?? {}), ...Object.keys(after[key] ?? {})])];

  const variants = {};
  const cost = {};
  for (const v of names('variants')) {
    variants[v] = pair(before.variants?.[v], after.variants?.[v]);
    // A variant blocks on its counters only: the detection unit is the consolidated class (DEC-033, DEC-089), and one seeded variant alone holds half of its attempts.
    const worse = Object.entries(variants[v].counters ?? {}).filter(([name, c]) => name !== 'cost' && c.verdict === 'piorou').map(([name]) => name);
    variants[v].bloqueia = Boolean(variants[v].refusal) || worse.length > 0;
    if (variants[v].bloqueia) blockReasons.push(`variante ${v}: ${variants[v].refusal ?? `contadores pioraram (${worse.join(', ')})`}`);
    cost[v] = { before: costSide(before.variants?.[v]), after: costSide(after.variants?.[v]) };
  }

  const classes = {};
  for (const c of names('classes')) {
    classes[c] = pair(before.classes?.[c], after.classes?.[c]);
    if (classes[c].status === 'comparada' && c === PLAN_CLASS && !(arm.planReview && arm.planFix)) {
      classes[c].classVerdict = 'inconclusivo (braço defasado)';
      classes[c].bloqueia = true;
      blockReasons.push(`classe ${c}: inconclusivo (braço defasado)`);
    } else if (classes[c].bloqueia) {
      blockReasons.push(`classe ${c}: ${classes[c].refusal ?? 'o comparador bloqueia'}`);
    }
    cost[c] = { before: costSide(before.classes?.[c]), after: costSide(after.classes?.[c]) };
  }

  // Only the after side of the release variants is checked; an old aggregate has no panel and is not read.
  const panel = {};
  for (const v of PANEL_VARIANTS) {
    if (!after.variants?.[v]) continue;
    panel[v] = validAttempts(after.variants[v]).map((a) => ({ n: a.n, panel: a.panel ?? null, ...panelMatches(v, a.panel) }));
    for (const p of panel[v]) if (!p.ok) blockReasons.push(`panel ${v} tentativa ${p.n}: ${p.reasons.join('; ')}`);
  }

  const goals = measureGoals(readAt, listAt);
  const day = date ?? new Date().toISOString().slice(0, 10);
  const measurementRows = rowsFor({ variants, classes, goals, date: day, deliverable });
  return { exit: blockReasons.length ? 1 : 0, variants, classes, cost, panel, arm, goals, measurementRows, blockReasons, ...(sideSwap ? { sideSwap } : {}) };
}

const num = (x) => (x == null ? '-' : Math.round(x * 1e4) / 1e4);
const usd = (x) => (x == null ? '-' : `US$ ${num(x)}`);

function rowsFor({ variants, classes, goals, date, deliverable }) {
  const rows = [];
  const row = (detail) => `| ${date} | ${deliverable} | ponto-de-medicao | ${detail} | - | - | concluído |`;
  for (const [name, r] of Object.entries(variants)) {
    if (!r.counters) continue;
    for (const [counter, c] of Object.entries(r.counters)) {
      rows.push(row(`${name} ${counter}: antes ${num(c.before)}, depois ${num(c.after)}, ${c.verdict}`));
    }
  }
  for (const [name, r] of Object.entries(classes)) {
    if (!r.detection) continue;
    for (const [cls, d] of Object.entries(r.detection)) {
      if (d.verdict === 'nao-aplicavel') continue;
      rows.push(row(`detecção ${name} (${cls}): antes ${num(d.rateBefore)}, depois ${num(d.rateAfter)}, ${r.classVerdict ?? d.verdict}`));
    }
  }
  for (const g of goals) rows.push(row(`meta ${g.deliverable} ${g.goal}: alvo ${g.target ?? '-'} ${g.unit}, medido ${g.measured ?? '-'}, ${g.verdict}`));
  return rows;
}

function markdown(result, { date, before, after }) {
  const L = ['# Ponto de medição', '', `Data: ${date}. Antes: ${before.tagCommit}. Depois: ${after.tagCommit}.`, ''];
  if (result.sideSwap) L.push(`Troca de lado: ${result.sideSwap.variant} = ${result.sideSwap.path}`, '');
  L.push('## Contadores por variante', '', '| Variante | Contador | Antes | Depois | Veredito |', '|---|---|---|---|---|');
  for (const [name, r] of Object.entries(result.variants)) {
    if (r.status === 'ausente') L.push(`| ${name} | - | - | - | ausente (só no lado ${r.side}) |`);
    else if (r.refusal) L.push(`| ${name} | - | - | - | recusada: ${r.refusal} |`);
    else for (const [c, v] of Object.entries(r.counters)) L.push(`| ${name} | ${c} | ${num(v.before)} | ${num(v.after)} | ${v.verdict} |`);
  }
  L.push('', '## Detecção por classe', '', '| Classe | Detecção | Antes | Depois | Queda | Veredito |', '|---|---|---|---|---|---|');
  for (const [name, r] of Object.entries(result.classes)) {
    if (r.status === 'ausente') L.push(`| ${name} | - | - | - | - | ausente (só no lado ${r.side}) |`);
    else if (r.refusal) L.push(`| ${name} | - | - | - | - | recusada: ${r.refusal} |`);
    else {
      for (const [cls, d] of Object.entries(r.detection)) {
        if (d.verdict === 'nao-aplicavel') continue;
        L.push(`| ${name} | ${cls} | ${num(d.rateBefore)} | ${num(d.rateAfter)} | ${num(d.drop)} | ${r.classVerdict ?? d.verdict}${d.reason ? ` (${d.reason})` : ''} |`);
      }
    }
  }
  L.push('', '## Custo', '', 'Não bloqueia (DEC-017). Mediana e faixa nas tentativas válidas.', '', '| Variante ou classe | Antes (mediana, faixa) | Depois (mediana, faixa) |', '|---|---|---|');
  const side = (s) => (s ? `${usd(s.median)} (${usd(s.min)} a ${usd(s.max)})` : '-');
  for (const [name, c] of Object.entries(result.cost)) L.push(`| ${name} | ${side(c.before)} | ${side(c.after)} |`);
  L.push('', '## Painel', '', 'Só o lado depois das variantes do release.', '', '| Variante | Tentativa | Situação | Motivos |', '|---|---|---|---|');
  for (const [name, ps] of Object.entries(result.panel)) for (const p of ps) L.push(`| ${name} | ${p.n} | ${p.ok ? 'ok' : 'diferente'} | ${p.reasons.join('; ') || '-'} |`);
  L.push('', '## Braço da classe plano', '', `- plan-review-atual.md casa com o workflow: ${result.arm.planReview ? 'sim' : 'não'}`, `- plan-fix-atual.md casa com o workflow: ${result.arm.planFix ? 'sim' : 'não'}`);
  for (const [f, ok] of Object.entries(result.arm.files ?? {})) L.push(`- ${f} casa com o workflow: ${ok ? 'sim' : 'não'}`);
  if (result.arm.listError) L.push(`- a listagem de ${ARMS_DIR} falhou (${result.arm.listError}): só os dois braços de plano foram conferidos`);
  L.push('', '## Metas', '', 'Não bloqueiam (DEC-034).', '', '| Meta | Entregável | Alvo | Medido | Veredito |', '|---|---|---|---|---|');
  for (const g of result.goals) L.push(`| ${g.goal} | ${g.deliverable} | ${g.target == null ? '-' : `${g.target} ${g.unit}`} | ${g.measured ?? '-'} | ${g.verdict} |`);
  L.push('', '## Linhas para roadmap:measurements', '', '| Data | Entregável | Tipo | Detalhe | Registrado | Faturado | Status |', '|---|---|---|---|---|---|---|', ...result.measurementRows, '');
  if (result.blockReasons.length) L.push('## Motivos de bloqueio', '', ...result.blockReasons.map((r) => `- ${r}`), '');
  return L.join('\n');
}

function gitReaders(commit) {
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  return {
    readAt: (path) => git('show', `${commit}:${path}`),
    listAt: (dir) => git('ls-tree', '-r', '--name-only', commit, `${dir.replace(/\/$/, '')}/`).split('\n').filter(Boolean),
  };
}

const USAGE = 'usage: node checkpoint.mjs --before <baseline.json> --after <baseline.json> --dest <dir> [--date AAAA-MM-DD] [--margin 6] [--attempts 40] [--bytes-tolerance 0.03] [--deliverable E17] [--before-coordinator <baseline.json>]';

function fail(msg) {
  console.error(msg);
  console.error(USAGE);
  return 2;
}

export function main(argv) {
  const known = new Set(['--before', '--after', '--dest', '--date', '--margin', '--attempts', '--bytes-tolerance', '--deliverable', '--before-coordinator']);
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!known.has(argv[i]) || argv[i + 1] === undefined) return fail(`unknown or incomplete flag: ${argv[i]}`);
    opts[argv[i]] = argv[i + 1];
  }
  if (!opts['--before'] || !opts['--after'] || !opts['--dest']) return fail('--before, --after and --dest are required');
  const numeric = {};
  for (const [flag, key] of [['--margin', 'margin'], ['--attempts', 'attempts'], ['--bytes-tolerance', 'bytesTolerance']]) {
    if (opts[flag] === undefined) continue;
    numeric[key] = Number(opts[flag]);
    if (!Number.isFinite(numeric[key])) return fail(`${flag} must be a number`);
  }
  if (opts['--date'] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(opts['--date'])) return fail('--date must be AAAA-MM-DD');
  if (opts['--deliverable'] !== undefined && !/^E\d+$/.test(opts['--deliverable'])) return fail('--deliverable must look like E11');
  let before;
  let after;
  let beforeCoordinator;
  try {
    before = JSON.parse(readFileSync(opts['--before'], 'utf8'));
    after = JSON.parse(readFileSync(opts['--after'], 'utf8'));
    if (opts['--before-coordinator'] !== undefined) beforeCoordinator = { baseline: JSON.parse(readFileSync(opts['--before-coordinator'], 'utf8')), path: opts['--before-coordinator'] };
  } catch (e) {
    return fail(`cannot read aggregate: ${e.message}`);
  }
  const date = opts['--date'] ?? new Date().toISOString().slice(0, 10);
  const result = checkpoint(before, after, { ...gitReaders(after.tagCommit), ...numeric, date, deliverable: opts['--deliverable'], beforeCoordinator });
  if (result.exit === 2) return fail(result.reason);
  mkdirSync(opts['--dest'], { recursive: true });
  const { exit, ...rest } = result;
  writeFileSync(join(opts['--dest'], 'comparacao.json'), `${JSON.stringify({ date, before: { tagCommit: before.tagCommit }, after: { tagCommit: after.tagCommit }, ...rest }, null, 2)}\n`);
  writeFileSync(join(opts['--dest'], 'comparacao.md'), markdown(result, { date, before, after }));
  console.log(`checkpoint exit ${exit}${result.blockReasons.length ? `: ${result.blockReasons.join(' | ')}` : ''}`);
  return exit;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
