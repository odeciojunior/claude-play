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
import { runBatch as realRunBatch, readPlugin as realReadPlugin, readPluginDir as realReadPluginDir, UsageError } from './run-batch.mjs';
import { makeScenario as realMakeScenario, seedSourceOf as realSeedSourceOf } from './make-scenario.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const BASELINE_PLAN = [
  { variant: 'planner', runs: 1 },
  { variant: 'tracker', runs: 1 },
  { variant: 'plan-only', runs: 5 },
  { variant: 'coordinator', runs: 3 },
  { variant: 'completo', runs: 3 },
  { variant: 'parada-retomada', runs: 3 },
  // The plan class runs in the stage harness (the 1.6.0 workflow prompt copy, DEC-279); the code class stays on the full pipeline.
  { variant: 'plano-semeado-A', runs: 5, stage: 'plan-review', arm: 'atual' },
  { variant: 'plano-semeado-B', runs: 5, stage: 'plan-review', arm: 'atual' },
  { variant: 'codigo-semeado-A', runs: 5 },
  { variant: 'codigo-semeado-B', runs: 5 },
];

// E11 plan: native release at M. maxBudgetUsd per entry (DEC-749): pipeline 10, plan-only 5, stage harness and coordinator 3.
// The coordinator appears twice: at M and on the 1.7.0 side (side '1.7.0'), which runs from --plugin-dir-before with its own out.
export const E11_PLAN = [
  { variant: 'planner', runs: 1, maxBudgetUsd: 5 },
  { variant: 'tracker', runs: 1, maxBudgetUsd: 5 },
  { variant: 'plan-only', runs: 5, maxBudgetUsd: 5 },
  { variant: 'coordinator', runs: 5, maxBudgetUsd: 3 },
  { variant: 'coordinator', runs: 5, maxBudgetUsd: 3, side: '1.7.0' },
  { variant: 'completo', runs: 3, maxBudgetUsd: 10 },
  { variant: 'parada-retomada', runs: 3, maxBudgetUsd: 10, ratify: 'off' },
  { variant: 'plano-nativo-A', runs: 5, maxBudgetUsd: 3, stage: 'plan-review', arm: 'atual' },
  { variant: 'plano-nativo-B', runs: 5, maxBudgetUsd: 3, stage: 'plan-review', arm: 'atual' },
  { variant: 'codigo-nativo-A', runs: 5, maxBudgetUsd: 10 },
  { variant: 'codigo-nativo-B', runs: 5, maxBudgetUsd: 10 },
];
const PLANS = { e17: BASELINE_PLAN, e11: E11_PLAN };

// Cap of extra attempts per seeded variant (invalid attempts are replaced, up to this many).
export const MAX_EXTRA = 5;
export const DEFAULT_TAG = 'productivity-tools--v1.6.0';
export const OLD_SIDE_COMMIT = 'e38cb35'; // productivity-tools 1.7.0, the "before" side of the E11 coordinator
// DEC-745: more than this many invalid attempts across codigo-nativo-A and -B stops the batch.
const NATIVE_CODE_MAX_INVALID = 5;
const PLACEHOLDER = '<pasta-da-execucao-aprovada>';

const retries = (variant) => /semeado|nativo/.test(variant); // invalid attempts are replaced up to MAX_EXTRA
const needsFromRun = (variant) => /semeado/.test(variant); // only seeded variants need an approved run to seed from

// Valid attempts already recorded in --out for a variant, summed over the aggregates of the entry's mode: an entry with a stage
// counts only harness aggregates of that stage and arm; an entry without one counts only pipeline aggregates (no harness field).
export function existingValid(outDir, variant, entry = {}) {
  return existingCount(outDir, variant, entry, 'valid');
}

export function existingCount(outDir, variant, entry = {}, field = 'valid') {
  if (!existsSync(outDir)) return 0;
  let total = 0;
  for (const e of readdirSync(outDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = join(outDir, e.name, 'aggregate.json');
    if (!existsSync(file)) continue;
    try {
      const agg = JSON.parse(readFileSync(file, 'utf8'));
      const sameMode = entry.stage ? agg.harness?.stage === entry.stage && agg.harness?.arm === (entry.arm ?? 'atual') : agg.harness === undefined;
      if (agg.variant === variant && sameMode && Number.isInteger(agg[field])) total += agg[field];
    } catch {
      /* an unreadable aggregate counts as nothing */
    }
  }
  return total;
}

const planOf = (opts) => PLANS[opts.plan ?? 'e17'];
const quote = (v) => (/\s/.test(String(v)) ? `"${v}"` : String(v));

// The plan entries picked by --only, each with the out, plugin dir and budget it runs with.
// The 1.7.0 side has its own out (--out-before, default: --out plus "-1.7.0") and runs from --plugin-dir-before.
const selected = (opts) =>
  planOf(opts)
    .filter((p) => !opts.only || opts.only.length === 0 || opts.only.includes(p.variant))
    .map((p) => ({
      ...p,
      out: p.side ? (opts.outBefore ?? `${resolve(opts.out)}-${p.side}`) : opts.out,
      work: p.side ? opts.workBefore : opts.work,
      pluginDir: p.side ? opts.pluginDirBefore : opts.pluginDir,
      maxBudgetUsd: p.maxBudgetUsd ?? opts.maxBudgetUsd,
    }));

export function dryRunCommands(opts) {
  return selected(opts).map(({ variant, runs, stage, arm, out, work, pluginDir, maxBudgetUsd, ratify }) => {
    const parts = [
      'node tools/measure/run-batch.mjs', '--variant', variant, '--runs', runs,
      '--work', quote(`${work}/${variant}`), '--out', quote(out),
      '--config-dir', quote(opts.configDir), '--permission-mode', opts.permissionMode,
    ];
    for (const a of opts.allow ?? []) parts.push('--allow', quote(a));
    for (const d of opts.addDir ?? []) parts.push('--add-dir', quote(d));
    if (opts.model) parts.push('--model', opts.model);
    if (maxBudgetUsd) parts.push('--max-budget-usd', maxBudgetUsd);
    if (pluginDir) parts.push('--plugin-dir', quote(pluginDir));
    if (ratify) parts.push('--ratify', ratify);
    if (opts.coordinatorFixture) parts.push('--coordinator-fixture', opts.coordinatorFixture);
    if (stage) parts.push('--stage', stage, '--arm', arm ?? 'atual');
    if (needsFromRun(variant)) parts.push('--from-run', opts.fromRun ? quote(opts.fromRun) : PLACEHOLDER);
    return parts.join(' ');
  });
}

function resolveTagReal(tag) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return execFileSync('git', ['rev-parse', `${tag}^{commit}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// True when git sees uncommitted changes in the folder; a folder that is not a repo is left to the commit check (it has no commit).
function treeDirtyReal(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'status', '--porcelain', '--', '.'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() !== '';
  } catch {
    return false;
  }
}

export async function runBaseline(opts, deps = {}) {
  const d = {
    runBatch: realRunBatch,
    makeScenario: realMakeScenario,
    seedSourceOf: realSeedSourceOf,
    readPlugin: realReadPlugin,
    readPluginDir: realReadPluginDir,
    treeDirty: treeDirtyReal,
    resolveTag: resolveTagReal,
    log: (m) => console.log(m),
    ...deps,
  };
  const plan = selected(opts);
  const results = [];

  if (plan.some((p) => p.side) && !opts.pluginDirBefore) {
    d.log(`the ${plan.find((p) => p.side).side} side of the coordinator needs --plugin-dir-before <folder of the ${OLD_SIDE_COMMIT} plugin>`);
    return { exitCode: 2, results };
  }
  if (plan.some((p) => p.side)) {
    // The 1.7.0 coordinator would reuse the scenario folders of the M side (<work>/<variant>-<k>) under the same --work.
    if (!opts.workBefore || resolve(opts.workBefore) === resolve(opts.work)) {
      d.log('the 1.7.0 side needs --work-before <dir>, different from --work (its scenarios would reuse the folders of the M side)');
      return { exitCode: 2, results };
    }
    if (opts.dryRun && resolve(opts.workBefore).length !== resolve(opts.work).length) {
      d.log(`warning: --work-before (${resolve(opts.workBefore).length} chars) and --work (${resolve(opts.work).length} chars) differ in length; paths enter the byte counters (DEC-033, tolerance 3%), use paths of equal length`);
    }
  }

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
  if (opts.plan === 'e11' && !opts.pluginDir) {
    d.log('--plan e11 needs --plugin-dir <folder of M> (the installed plugin is not the measured one)');
    return { exitCode: 2, results };
  }
  let found;
  try {
    found = opts.pluginDir ? d.readPluginDir(opts.pluginDir).commit : d.readPlugin(opts.configDir).commit;
  } catch (e) {
    d.log(`--plugin-dir could not be read: ${e.message}`);
    return { exitCode: 2, results };
  }
  if (found !== expected) {
    d.log(opts.pluginDir
      ? `--plugin-dir commit ${found} is not the commit of ${tag} (${expected})`
      : `installed plugin commit ${found} is not the commit of ${tag} (${expected}); install the start version first`);
    return { exitCode: 2, results };
  }
  // DEC-744: the folder must be the committed tree (plugins/ equal to M), with no uncommitted change.
  for (const [flag, dir] of [['--plugin-dir', opts.pluginDir], ['--plugin-dir-before', plan.some((p) => p.side) ? opts.pluginDirBefore : undefined]]) {
    if (dir && d.treeDirty(dir)) {
      d.log(`${flag} has uncommitted changes (git status --porcelain is not empty); the measured plugin must equal its commit (DEC-744)`);
      return { exitCode: 2, results };
    }
  }
  if (plan.some((p) => p.side)) {
    let before;
    try {
      before = d.readPluginDir(opts.pluginDirBefore).commit;
    } catch (e) {
      d.log(`--plugin-dir-before could not be read: ${e.message}`);
      return { exitCode: 2, results };
    }
    if (!before || !before.startsWith(OLD_SIDE_COMMIT)) {
      d.log(`--plugin-dir-before commit ${before} is not ${OLD_SIDE_COMMIT} (productivity-tools 1.7.0)`);
      return { exitCode: 2, results };
    }
  }

  // Pre-check of the seeding: the folder must hold the E5 spec and plan with every sentinel anchor, before any paid run.
  const seededPlan = plan.filter((p) => needsFromRun(p.variant));
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
  // DEC-745: invalid attempts of the native code class, summed over codigo-nativo-A and -B (already in --out plus this invocation).
  const isNativeCode = (v) => /^codigo-nativo-[AB]$/.test(v);
  let nativeInvalid = plan.some((p) => isNativeCode(p.variant)) ? ['codigo-nativo-A', 'codigo-nativo-B'].reduce((s, v) => s + existingCount(opts.out, v, {}, 'invalid'), 0) : 0;
  const nativeStopMessage = (variant) => `${variant}: ${nativeInvalid} invalid attempts in the native code class (more than ${NATIVE_CODE_MAX_INVALID}); stopping the baseline (DEC-745). The pipeline or the scenario needs a look before more runs.`;
  for (const entry of plan) {
    const { variant, runs, stage, side, out } = entry;
    if (denied) break;
    const seeded = retries(variant);
    const have = existingValid(out, variant, entry);
    const tag = side ? { side } : {};
    let missing = Math.max(0, runs - have);
    if (missing === 0) {
      results.push({ variant, ...tag, status: 'pulada', valid: have, missing: 0 });
      continue;
    }
    if (needsFromRun(variant) && !opts.fromRun) {
      d.log(`${variant}: variantes semeadas exigem --from-run <pasta de uma execução aprovada>`);
      results.push({ variant, ...tag, status: 'pulada', valid: have, missing });
      exitCode = 1;
      continue;
    }
    if (isNativeCode(variant) && nativeInvalid > NATIVE_CODE_MAX_INVALID) {
      d.log(nativeStopMessage(variant));
      results.push({ variant, ...tag, status: 'parada', valid: have, missing });
      exitCode = 1;
      denied = true;
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
      const workName = variant;
      const workRoot = entry.work;
      while (existsSync(join(resolve(workRoot), `${workName}-p${seq}`))) seq += 1;
      let r;
      try {
        r = await d.runBatch({
          ...opts,
          variant,
          runs: n,
          stopOnDenial: true,
          work: join(resolve(workRoot), `${workName}-p${seq}`),
          out,
          pluginDir: entry.pluginDir,
          ratify: entry.ratify,
          maxBudgetUsd: entry.maxBudgetUsd,
          fromRun: needsFromRun(variant) ? opts.fromRun : undefined,
          ...(stage ? { stage, arm: entry.arm ?? 'atual' } : {}),
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
      if (isNativeCode(variant)) {
        nativeInvalid += r.aggregate.invalid ?? 0;
        if (nativeInvalid > NATIVE_CODE_MAX_INVALID) {
          d.log(nativeStopMessage(variant));
          status = 'parada';
          denied = true;
          break;
        }
      }
      if (!seeded) break; // variants without replacement are not repeated
    }
    if (status === 'completa' && missing > 0) status = 'incompleta';
    if (status !== 'completa') exitCode = 1;
    results.push({ variant, ...tag, status, valid, missing });
  }
  return { exitCode, results };
}

const USAGE =
  'usage: node tools/measure/run-baseline.mjs --work <dir> --out <dir> --config-dir <dir> --permission-mode <mode> [--allow <rule>]... [--add-dir <dir>]... [--model <m>] [--max-budget-usd <x>] [--from-run <folder>] [--only v1,v2] [--dry-run] [--tag <name>] [--plan e17|e11] [--plugin-dir <folder>] [--plugin-dir-before <folder> --work-before <dir>] [--out-before <dir>] [--coordinator-fixture native|legacy]';

function parseCli(argv) {
  const o = { allow: [], addDir: [] };
  const names = {
    '--work': 'work', '--out': 'out', '--config-dir': 'configDir', '--permission-mode': 'permissionMode',
    '--allow': 'allow', '--add-dir': 'addDir', '--model': 'model', '--max-budget-usd': 'maxBudgetUsd',
    '--from-run': 'fromRun', '--only': 'only', '--tag': 'tag', '--plan': 'plan', '--plugin-dir': 'pluginDir',
    '--plugin-dir-before': 'pluginDirBefore', '--work-before': 'workBefore', '--out-before': 'outBefore', '--coordinator-fixture': 'coordinatorFixture',
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
  if (o.plan !== undefined && !Object.hasOwn(PLANS, o.plan)) return null;
  if (o.coordinatorFixture !== undefined && o.coordinatorFixture !== 'native' && o.coordinatorFixture !== 'legacy') return null;
  const known = planOf(o).map((p) => p.variant);
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
  const badWork = [o.work, o.workBefore].find((w) => w && insideRepo(w));
  if (badWork) {
    console.error(`run-baseline: --work or --work-before is inside the repository: ${resolve(badWork)}`);
    process.exit(2);
  }
  try {
    const r = await runBaseline(o);
    for (const x of r.results) console.log(`${x.variant}${x.side ? ` (${x.side})` : ''}:${x.status} (valid ${x.valid}, missing ${x.missing})`);
    process.exitCode = r.exitCode;
  } catch (e) {
    console.error(e.message);
    process.exitCode = e instanceof UsageError ? 2 : 1;
  }
}
