#!/usr/bin/env node
// Baseline conductor: runs the fixed measurement plan through run-batch and resumes from what is already in --out.
// Usage: node tools/measure/run-baseline.mjs --work <dir outside the repo> --out <dir> --config-dir <dir> --permission-mode <mode>
//          [--allow <rule>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>] [--from-run <folder>]
//          [--only v1,v2] [--dry-run] [--tag <name>]
// Exit codes: 0 every requested variant complete, 1 something skipped, incomplete, denied or failed, 2 usage error.
// It never launches anything by itself in the tests: runBatch and the other dependencies are injected.
import { readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runBatch as realRunBatch, readPlugin as realReadPlugin, UsageError } from './run-batch.mjs';
import { makeScenario as realMakeScenario, seedSourceOf as realSeedSourceOf } from './make-scenario.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const BASELINE_PLAN = [
  { variant: 'planner', runs: 1 },
  { variant: 'tracker', runs: 1 },
  { variant: 'plan-only', runs: 5 },
  { variant: 'coordinator', runs: 3 },
  { variant: 'completo', runs: 3 },
  { variant: 'parada-retomada', runs: 3 },
  { variant: 'plano-semeado-A', runs: 5 },
  { variant: 'plano-semeado-B', runs: 5 },
  { variant: 'codigo-semeado-A', runs: 5 },
  { variant: 'codigo-semeado-B', runs: 5 },
];

// Cap of extra attempts per seeded variant (invalid attempts are replaced, up to this many).
export const MAX_EXTRA = 5;
export const DEFAULT_TAG = 'productivity-tools--v1.6.0';
const PLACEHOLDER = '<pasta-da-execucao-aprovada>';

const isSeeded = (variant) => variant.includes('semeado');

// Valid attempts already recorded in --out for a variant, summed over every aggregate. Harness aggregates are left out.
export function existingValid(outDir, variant) {
  if (!existsSync(outDir)) return 0;
  let total = 0;
  for (const e of readdirSync(outDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = join(outDir, e.name, 'aggregate.json');
    if (!existsSync(file)) continue;
    try {
      const agg = JSON.parse(readFileSync(file, 'utf8'));
      if (agg.variant === variant && agg.harness === undefined && Number.isInteger(agg.valid)) total += agg.valid;
    } catch {
      /* an unreadable aggregate counts as nothing */
    }
  }
  return total;
}

const selected = (opts) => BASELINE_PLAN.filter((p) => !opts.only || opts.only.length === 0 || opts.only.includes(p.variant));
const quote = (v) => (/\s/.test(String(v)) ? `"${v}"` : String(v));

export function dryRunCommands(opts) {
  return selected(opts).map(({ variant, runs }) => {
    const parts = [
      'node tools/measure/run-batch.mjs', '--variant', variant, '--runs', runs,
      '--work', quote(`${opts.work}/${variant}`), '--out', quote(opts.out),
      '--config-dir', quote(opts.configDir), '--permission-mode', opts.permissionMode,
    ];
    for (const a of opts.allow ?? []) parts.push('--allow', quote(a));
    for (const d of opts.addDir ?? []) parts.push('--add-dir', quote(d));
    if (opts.model) parts.push('--model', opts.model);
    if (opts.maxBudgetUsd) parts.push('--max-budget-usd', opts.maxBudgetUsd);
    if (isSeeded(variant)) parts.push('--from-run', opts.fromRun ? quote(opts.fromRun) : PLACEHOLDER);
    return parts.join(' ');
  });
}

function resolveTagReal(tag) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return execFileSync('git', ['rev-parse', `${tag}^{commit}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export async function runBaseline(opts, deps = {}) {
  const d = {
    runBatch: realRunBatch,
    makeScenario: realMakeScenario,
    seedSourceOf: realSeedSourceOf,
    readPlugin: realReadPlugin,
    resolveTag: resolveTagReal,
    log: (m) => console.log(m),
    ...deps,
  };
  const plan = selected(opts);
  const results = [];

  if (opts.dryRun) {
    for (const c of dryRunCommands(opts)) d.log(c);
    return { exitCode: 0, results };
  }

  const tag = opts.tag ?? DEFAULT_TAG;
  let expected;
  try {
    expected = d.resolveTag(tag);
  } catch (e) {
    d.log(`tag ${tag} could not be resolved: ${e.message}`);
    return { exitCode: 2, results };
  }
  const found = d.readPlugin(opts.configDir).commit;
  if (found !== expected) {
    d.log(`installed plugin commit ${found} is not the commit of ${tag} (${expected}); install the start version first`);
    return { exitCode: 2, results };
  }

  // Pre-check of the seeding: the folder must hold the E5 spec and plan with every sentinel anchor, before any paid run.
  const seededPlan = plan.filter((p) => isSeeded(p.variant));
  if (opts.fromRun && seededPlan.length > 0) {
    const check = join(resolve(opts.work), '_conferencia-semeadura');
    try {
      d.seedSourceOf(opts.fromRun);
      for (const { variant } of seededPlan) {
        const dir = join(check, variant);
        try {
          await d.makeScenario(dir, variant, { fromRun: opts.fromRun });
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    } catch (e) {
      d.log(`--from-run pre-check failed: ${e.message}`);
      return { exitCode: 2, results };
    } finally {
      rmSync(check, { recursive: true, force: true });
    }
  }

  let exitCode = 0;
  let denied = false;
  for (const { variant, runs } of plan) {
    if (denied) break;
    const seeded = isSeeded(variant);
    const have = existingValid(opts.out, variant);
    let missing = Math.max(0, runs - have);
    if (missing === 0) {
      results.push({ variant, status: 'pulada', valid: have, missing: 0 });
      continue;
    }
    if (seeded && !opts.fromRun) {
      d.log(`${variant}: variantes semeadas exigem --from-run <pasta de uma execução aprovada>`);
      results.push({ variant, status: 'pulada', valid: have, missing });
      exitCode = 1;
      continue;
    }
    let valid = have;
    let pass = 0;
    let extra = 0;
    let status = 'completa';
    while (missing > 0) {
      let n = missing;
      if (pass > 0) {
        if (!seeded || extra >= MAX_EXTRA) break;
        n = Math.min(missing, MAX_EXTRA - extra);
        extra += n;
      }
      pass += 1;
      // Unique across invocations: skip numbers whose folder an earlier invocation already used.
      let seq = pass;
      while (existsSync(join(resolve(opts.work), `${variant}-p${seq}`))) seq += 1;
      let r;
      try {
        r = await d.runBatch({
          ...opts,
          variant,
          runs: n,
          stopOnDenial: true,
          work: join(resolve(opts.work), `${variant}-p${seq}`),
          fromRun: seeded ? opts.fromRun : undefined,
        });
      } catch (e) {
        d.log(`${variant}: runBatch failed: ${e.message}`);
        status = 'falhou';
        break;
      }
      valid += r.aggregate.valid;
      missing = Math.max(0, runs - valid);
      if (r.aggregate.denied > 0) {
        d.log(`${variant}: ${r.aggregate.denied} permission denial(s); stopping the baseline. Adjust the permission rules and run again to resume.`);
        status = 'negada';
        denied = true;
        break;
      }
      if (!seeded) break; // unseeded variants are not repeated
    }
    if (status === 'completa' && missing > 0) status = 'incompleta';
    if (status !== 'completa') exitCode = 1;
    results.push({ variant, status, valid, missing });
  }
  return { exitCode, results };
}

const USAGE =
  'usage: node tools/measure/run-baseline.mjs --work <dir> --out <dir> --config-dir <dir> --permission-mode <mode> [--allow <rule>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>] [--from-run <folder>] [--only v1,v2] [--dry-run] [--tag <name>]';

function parseCli(argv) {
  const o = { allow: [], addDir: [] };
  const names = {
    '--work': 'work', '--out': 'out', '--config-dir': 'configDir', '--permission-mode': 'permissionMode',
    '--allow': 'allow', '--add-dir': 'addDir', '--model': 'model', '--max-budget-usd': 'maxBudgetUsd',
    '--from-run': 'fromRun', '--only': 'only', '--tag': 'tag',
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') {
      o.dryRun = true;
      continue;
    }
    const key = names[argv[i]];
    if (!key || argv[i + 1] === undefined) return null;
    const v = argv[++i];
    if (key === 'allow' || key === 'addDir') o[key].push(v);
    else if (key === 'only') o.only = v.split(',').map((x) => x.trim()).filter(Boolean);
    else o[key] = v;
  }
  if (!o.work || !o.out || !o.configDir || !o.permissionMode) return null;
  const known = BASELINE_PLAN.map((p) => p.variant);
  if (o.only && (o.only.length === 0 || o.only.some((v) => !known.includes(v)))) return null;
  return o;
}

function insideRepo(target) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const rel = relative(fold(resolve(root)), fold(resolve(target)));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = parseCli(process.argv.slice(2));
  if (!o) {
    console.error(USAGE);
    process.exit(2);
  }
  if (insideRepo(o.work)) {
    console.error(`run-baseline: --work is inside the repository: ${resolve(o.work)}`);
    process.exit(2);
  }
  try {
    const r = await runBaseline(o);
    for (const x of r.results) console.log(`${x.variant}: ${x.status} (valid ${x.valid}, missing ${x.missing})`);
    process.exitCode = r.exitCode;
  } catch (e) {
    console.error(e.message);
    process.exitCode = e instanceof UsageError ? 2 : 1;
  }
}
