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
import { PANEL_VARIANTS, panelMatches } from './run-batch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = 'plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js';
const ARMS = { planReview: 'tools/measure/arms/plan-review-atual.md', planFix: 'tools/measure/arms/plan-fix-atual.md' };
const PLAN_CLASS = 'plano-semeado';

const lf = (t) => String(t).replace(/\r\n?/g, '\n');

// The arm template (minus its "Copied from" line) must appear in the workflow, piece by piece in order, byte for byte.
export function armMatches(armText, workflowText) {
  const lines = lf(armText).split('\n');
  // A table-escaped pipe is the same text with or without its escape: the JS source has \\|, the runtime prompt \|, the arm | (DEC-310).
  const pipe = (t) => t.replace(/\\+\|/g, '|');
  const body = pipe((/^Copied from:/.test(lines[0]) ? lines.slice(1) : lines).join('\n').trimEnd());
  const workflow = pipe(lf(workflowText));
  let at = 0;
  for (const piece of body.split(/\{\{[^}]*\}\}/)) {
    if (piece === '') continue;
    const i = workflow.indexOf(piece, at);
    if (i < 0) return false;
    at = i + piece.length;
  }
  return true;
}

const validAttempts = (agg) => (agg?.attempts ?? []).filter((a) => a.status === 'valid');
const costSide = (agg) => {
  const xs = validAttempts(agg).map((a) => a.counters?.cost).filter((c) => typeof c === 'number' && Number.isFinite(c));
  return xs.length ? { median: median(xs), min: Math.min(...xs), max: Math.max(...xs), n: xs.length } : null;
};

function armStatus(readAt) {
  const check = (armFile) => {
    try {
      return armMatches(readAt(armFile), readAt(WORKFLOW));
    } catch {
      return false;
    }
  };
  return { planReview: check(ARMS.planReview), planFix: check(ARMS.planFix) };
}

function safeCompare(before, after, options) {
  const refusal = inputRefusal(before, after);
  if (refusal) return { refusal, bloqueia: true };
  return compare(before, after, options);
}

export function checkpoint(before, after, { readAt, listAt, margin, attempts, bytesTolerance, date } = {}) {
  const empty = { variants: {}, classes: {}, cost: {}, panel: {}, arm: null, goals: [], measurementRows: [], blockReasons: [] };
  for (const [side, agg] of [['before', before], ['after', after]]) {
    if (agg?.permissionMode !== 'bypassPermissions') {
      return { exit: 2, reason: `${side} was measured in permission mode "${agg?.permissionMode}", not bypassPermissions`, ...empty };
    }
  }
  const options = {};
  if (margin !== undefined) options.margin = margin;
  if (attempts !== undefined) options.attempts = attempts;
  if (bytesTolerance !== undefined) options.bytesTolerance = bytesTolerance;
  const blockReasons = [];
  const arm = armStatus(readAt);

  const pair = (b, a) => (b && a ? { status: 'comparada', ...safeCompare(b, a, options) } : { status: 'ausente', side: b ? 'antes' : 'depois' });
  const names = (key) => [...new Set([...Object.keys(before[key] ?? {}), ...Object.keys(after[key] ?? {})])];

  const variants = {};
  const cost = {};
  for (const v of names('variants')) {
    variants[v] = pair(before.variants?.[v], after.variants?.[v]);
    if (variants[v].bloqueia) blockReasons.push(`variante ${v}: ${variants[v].refusal ?? 'o comparador bloqueia'}`);
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
  const measurementRows = rowsFor({ variants, classes, goals, date: day });
  return { exit: blockReasons.length ? 1 : 0, variants, classes, cost, panel, arm, goals, measurementRows, blockReasons };
}

const num = (x) => (x == null ? '-' : Math.round(x * 1e4) / 1e4);
const usd = (x) => (x == null ? '-' : `US$ ${num(x)}`);

function rowsFor({ variants, classes, goals, date }) {
  const rows = [];
  const row = (detail) => `| ${date} | E17 | ponto-de-medicao | ${detail} | - | - | concluído |`;
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

const USAGE = 'usage: node checkpoint.mjs --before <baseline.json> --after <baseline.json> --dest <dir> [--date AAAA-MM-DD] [--margin 6] [--attempts 40] [--bytes-tolerance 0.03]';

function fail(msg) {
  console.error(msg);
  console.error(USAGE);
  return 2;
}

export function main(argv) {
  const known = new Set(['--before', '--after', '--dest', '--date', '--margin', '--attempts', '--bytes-tolerance']);
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
  let before;
  let after;
  try {
    before = JSON.parse(readFileSync(opts['--before'], 'utf8'));
    after = JSON.parse(readFileSync(opts['--after'], 'utf8'));
  } catch (e) {
    return fail(`cannot read aggregate: ${e.message}`);
  }
  const date = opts['--date'] ?? new Date().toISOString().slice(0, 10);
  const result = checkpoint(before, after, { ...gitReaders(after.tagCommit), ...numeric, date });
  if (result.exit === 2) return fail(result.reason);
  mkdirSync(opts['--dest'], { recursive: true });
  const { exit, ...rest } = result;
  writeFileSync(join(opts['--dest'], 'comparacao.json'), `${JSON.stringify({ date, before: { tagCommit: before.tagCommit }, after: { tagCommit: after.tagCommit }, ...rest }, null, 2)}\n`);
  writeFileSync(join(opts['--dest'], 'comparacao.md'), markdown(result, { date, before, after }));
  console.log(`checkpoint exit ${exit}${result.blockReasons.length ? `: ${result.blockReasons.join(' | ')}` : ''}`);
  return exit;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
