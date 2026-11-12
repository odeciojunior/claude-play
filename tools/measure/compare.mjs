#!/usr/bin/env node
// Compares two measurement aggregates (before/after) and decides whether the change blocks.
// Usage: node tools/measure/compare.mjs --before <a.json> --after <b.json> [--margin 6] [--attempts 40] [--bytes-tolerance 0.03]
// Exit codes: 0 no block, 1 block, 2 usage error.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEIGHTS = { haiku: 1, sonnet: 20, opus: 40 };
const EPS = 1e-9;
const DETECTION_CLASSES = ['plan', 'code', 'spec'];
const RECORDED_ONLY = new Set(['planner', 'tracker']);

// Detection class a seeded variant measures; plano-semeado-codigo is detected by code, not by a reviewer.
function seededClass(variant) {
  const m = /^(plano|codigo|spec)-semeado(?:-[AB])?$/.exec(String(variant ?? ''));
  return m ? { plano: 'plan', codigo: 'code', spec: 'spec' }[m[1]] : null;
}

export function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Worse when the median after exceeds (1 + tol) times the median before. An empty side is inconclusive.
export function medianVerdict(b, a, tol = 0) {
  if (!b.length || !a.length) return 'inconclusivo';
  return median(a) > median(b) * (1 + tol) + EPS ? 'piorou' : 'nao-piorou';
}

// Worse: min after > max before. Not worse: max after <= min before. Otherwise inconclusive.
export function separationVerdict(b, a) {
  if (!b.length || !a.length) return 'inconclusivo';
  if (Math.min(...a) > Math.max(...b)) return 'piorou';
  if (Math.max(...a) <= Math.min(...b)) return 'nao-piorou';
  return 'inconclusivo';
}

// Static size: any growth is worse; a missing side is inconclusive.
export function staticVerdict(b, a) {
  if (b == null || a == null) return 'inconclusivo';
  return a > b ? 'piorou' : 'nao-piorou';
}

const validAttempts = (agg) => (agg.attempts ?? []).filter((x) => x.status === 'valid');
const nums = (xs) => xs.filter((x) => typeof x === 'number' && Number.isFinite(x));
const weightedOf = (s) => (s?.haiku ?? 0) * WEIGHTS.haiku + (s?.sonnet ?? 0) * WEIGHTS.sonnet + (s?.opus ?? 0) * WEIGHTS.opus;
const pick = (agg, fn) => nums(validAttempts(agg).map((x) => fn(x.counters ?? {})));

function unweightedCalls(agg) {
  const out = { fable: 0, other: 0 };
  for (const x of validAttempts(agg)) {
    out.fable += x.counters?.structural?.fable ?? 0;
    out.other += x.counters?.structural?.other ?? 0;
  }
  return out;
}

function detectionFor(cls, before, after, { margin, attempts }) {
  const tally = (agg) => {
    let capturado = 0;
    let perdido = 0;
    let reviewer = 0;
    for (const x of validAttempts(agg)) {
      for (const o of x.outcomes ?? []) {
        if (o.class !== cls || o.detectedBy !== 'reviewer') continue;
        reviewer += 1;
        if (o.outcome === 'capturado') capturado += 1;
        else if (o.outcome === 'perdido') perdido += 1;
      }
    }
    return { capturado, perdido, indeterminado: reviewer - capturado - perdido, reviewer, valid: reviewer };
  };
  const b = tally(before);
  const a = tally(after);
  // Applicability comes from the variant, not from the outcomes: attempts that are all invalid leave no outcomes.
  const seeded = seededClass(before.variant) === cls || seededClass(after.variant) === cls;
  if (!seeded && b.reviewer + a.reviewer === 0) return { verdict: 'nao-aplicavel' };
  // Two modes (stage harness vs full pipeline, or different stages) do not measure the same thing: never compare their rates.
  if (seeded && before.harness?.stage !== after.harness?.stage) {
    const mode = (agg) => (agg.harness?.stage ? `harness ${agg.harness.stage}` : 'pipeline completo');
    return { verdict: 'inconclusivo', missing: 0, modeMismatch: true, reason: `modo de medição diferente: antes ${mode(before)}, depois ${mode(after)}` };
  }
  const missing = Math.max(0, attempts - b.valid, attempts - a.valid);
  const rate = (t) => (t.capturado + t.perdido ? t.capturado / (t.capturado + t.perdido) : null);
  const sides = { before: { capturado: b.capturado, perdido: b.perdido, indeterminado: b.indeterminado }, after: { capturado: a.capturado, perdido: a.perdido, indeterminado: a.indeterminado } };
  const rateBefore = rate(b);
  const rateAfter = rate(a);
  if (missing > 0) return { ...sides, rateBefore, rateAfter, drop: null, verdict: 'inconclusivo', missing };
  if (rateBefore == null || rateAfter == null) return { ...sides, rateBefore, rateAfter, drop: null, verdict: 'inconclusivo', missing: 0 };
  const drop = Math.round((rateBefore - rateAfter) * attempts * 1e6) / 1e6;
  return { ...sides, rateBefore, rateAfter, drop, verdict: drop >= margin ? 'caiu' : 'nao-caiu' };
}

function codeDetection(before, after) {
  const ids = new Set([...Object.keys(before.deteccaoPorCodigo ?? {}), ...Object.keys(after.deteccaoPorCodigo ?? {})]);
  const nBefore = validAttempts(before).length;
  const out = {};
  for (const id of [...ids].sort()) {
    const b = before.deteccaoPorCodigo?.[id] ?? {};
    const a = after.deteccaoPorCodigo?.[id] ?? {};
    const always = nBefore > 0 && (b['acusado-pelo-codigo'] ?? 0) === nBefore;
    out[id] = { before: b, after: a, regrediu: always && (a.perdido ?? 0) > 0 };
  }
  return out;
}

// DEC-196: an aggregate needs variant and attempts, and both sides must measure the same variant.
export function inputRefusal(before, after) {
  for (const [side, agg] of [['--before', before], ['--after', after]]) {
    if (typeof agg?.variant !== 'string' || !agg.variant) return `${side}: input has no variant (not a variant aggregate)`;
    if (!Array.isArray(agg.attempts)) return `${side}: input has no attempts (not a variant aggregate)`;
  }
  if (before.variant !== after.variant) return `different variants: ${before.variant} vs ${after.variant}`;
  return null;
}

export function compare(before, after, { margin = 6, attempts = 40, bytesTolerance = 0.03 } = {}) {
  const recordedOnly = RECORDED_ONLY.has(before.variant) || RECORDED_ONLY.has(after.variant);
  const counters = {};
  const blocking = new Set();
  const add = (name, cls, b, a, verdict, { blocks = true, extra = {} } = {}) => {
    const v = recordedOnly ? 'registrado' : verdict;
    counters[name] = { class: cls, verdict: v, before: median(b), after: median(a), ...extra };
    if (blocks && v === 'piorou') blocking.add(name);
  };
  const med = (name, cls, fn, tol = 0) => {
    const b = pick(before, fn);
    const a = pick(after, fn);
    add(name, cls, b, a, medianVerdict(b, a, tol));
  };
  const sep = (name, cls, fn, opts) => {
    const b = pick(before, fn);
    const a = pick(after, fn);
    add(name, cls, b, a, separationVerdict(b, a), opts);
  };

  for (const f of ['haiku', 'sonnet', 'opus', 'fable', 'other']) med(f, 'structural', (c) => c.structural?.[f]);
  // Weights exist only for haiku, sonnet and opus: unweighted families make the total inconclusive (DEC-081).
  const ub = unweightedCalls(before);
  const ua = unweightedCalls(after);
  const wb = pick(before, (c) => (c.structural ? weightedOf(c.structural) : undefined));
  const wa = pick(after, (c) => (c.structural ? weightedOf(c.structural) : undefined));
  const hasUnweighted = ub.fable + ub.other + ua.fable + ua.other > 0;
  add('weighted', 'structural', wb, wa, hasUnweighted ? 'inconclusivo' : medianVerdict(wb, wa), {
    extra: hasUnweighted ? { unweighted: { before: ub, after: ua } } : {},
  });
  med('bytes', 'bytes', (c) => c.bytes, bytesTolerance);
  sep('perTask', 'perTask', (c) => c.perTask);
  sep('extraRounds', 'conditional', (c) => c.conditional?.extraRounds);
  sep('fixCalls', 'conditional', (c) => c.conditional?.fixCalls);
  sep('mainAgentCalls', 'main', (c) => c.main?.agentCalls);
  sep('mainBytes', 'main', (c) => c.main?.bytes);
  sep('mainTurns', 'main', (c) => c.main?.turns);
  sep('cost', 'cost', (c) => c.cost, { blocks: false });
  // Only the static counter keeps a verdict for planner and tracker variants.
  const sb = pick(before, (c) => c.static?.bytes);
  const sa = pick(after, (c) => c.static?.bytes);
  counters.static = { class: 'static', verdict: staticVerdict(median(sb), median(sa)), before: median(sb), after: median(sa) };
  if (counters.static.verdict === 'piorou') blocking.add('static');

  const detection = {};
  let detectionBlocks = false;
  for (const cls of DETECTION_CLASSES) {
    const d = detectionFor(cls, before, after, { margin, attempts });
    detection[cls] = d;
    if (d.verdict === 'caiu' || (d.verdict === 'inconclusivo' && (d.missing > 0 || d.modeMismatch))) detectionBlocks = true;
  }

  return {
    counters,
    detection,
    deteccaoPorCodigo: codeDetection(before, after),
    bloqueia: blocking.size > 0 || detectionBlocks,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const num = (name, dflt) => (opt(name) === undefined ? dflt : Number(opt(name)));
  const usage = () => {
    console.error('usage: node compare.mjs --before <a.json> --after <b.json> [--margin 6] [--attempts 40] [--bytes-tolerance 0.03]');
    process.exit(2);
  };
  if (!opt('--before') || !opt('--after')) usage();
  const options = { margin: num('--margin', 6), attempts: num('--attempts', 40), bytesTolerance: num('--bytes-tolerance', 0.03) };
  if (Object.values(options).some((v) => !Number.isFinite(v))) usage();
  let before;
  let after;
  try {
    before = JSON.parse(readFileSync(opt('--before'), 'utf8'));
    after = JSON.parse(readFileSync(opt('--after'), 'utf8'));
  } catch (e) {
    console.error(`cannot read aggregate: ${e.message}`);
    process.exit(2);
  }
  const refusal = inputRefusal(before, after);
  if (refusal) {
    console.error(refusal);
    process.exit(2);
  }
  const result = compare(before, after, options);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.bloqueia ? 1 : 0);
}
