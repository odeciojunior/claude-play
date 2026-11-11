#!/usr/bin/env node
// Builds a disposable sandbox for one measurement variant and prints it as JSON.
// Usage: node tools/measure/make-scenario.mjs <dir> --variant <name> [--from-run <folder>]
// <dir> must be outside this repository. Seeded variants arrive in stages (plan, spec and code).
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { makeSandbox, STOP_RESUME } from '../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCEN = join(here, 'scenario');
const DEFECTS = join(here, 'defects');

export const VARIANTS = [
  'plan-only', 'completo', 'parada-retomada', 'coordinator', 'planner', 'tracker',
  'plano-semeado-A', 'plano-semeado-B', 'codigo-semeado-A', 'codigo-semeado-B',
  'spec-semeado-A', 'spec-semeado-B', 'plano-semeado-codigo',
];

export const E5_PATHS = {
  spec: 'docs/superpowers/specs/2026-11-10-E5-text-utilities-design.md',
  plan: 'docs/superpowers/plans/2026-11-10-E5-text-utilities.md',
};

const RELEASE = '/productivity-tools:roadmap-release';
const FIXED_PLAN = 'docs/plans/2026-11-10-fixed-plan.md';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function writeIn(dir, rel, content) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

// Scenario text must reach the sandbox with LF whatever the checkout did (core.autocrlf
// hands CRLF on Windows): seeded blobs, prompt bytes and line-based checks depend on it.
const TEXT_FILE = /\.(mjs|js|json|md|txt)$/i;

export function readText(file) {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

export function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const n of readdirSync(src)) {
    const s = join(src, n);
    if (statSync(s).isDirectory()) copyTree(s, join(dst, n));
    else if (TEXT_FILE.test(n)) writeFileSync(join(dst, n), readText(s));
    else copyFileSync(s, join(dst, n));
  }
}

function pickFromRun(fromRun, sub, re, what) {
  const d = join(resolve(fromRun), sub);
  const hit = existsSync(d) ? readdirSync(d).filter((n) => re.test(n)).sort()[0] : undefined;
  if (!hit) throw new Error(`--from-run: ${what} not found in ${d}`);
  return readText(join(d, hit));
}

function e5Texts(fromRun) {
  if (fromRun) {
    return {
      spec: pickFromRun(fromRun, 'docs/superpowers/specs', /-E5-.*-design\.md$/, 'E5 spec'),
      plan: pickFromRun(fromRun, 'docs/superpowers/plans', /-E5-.*\.md$/, 'E5 plan'),
    };
  }
  return {
    spec: readText(join(SCEN, 'e5', 'spec.md')),
    plan: readText(join(SCEN, 'e5', 'plan.md')),
  };
}

function taskTitles(plan) {
  const titles = {};
  for (const m of plan.matchAll(/^### Task (\d+): (.+?)\s*$/gm)) titles[Number(m[1])] = m[2];
  return titles;
}

// Creates feat/E5 from main with the E5 spec, optionally the plan, and the first `tasks` tasks of code.
export function prepareE5Branch(dir, { withPlan, tasks, fromRun } = {}) {
  const { spec, plan } = e5Texts(fromRun);
  git(dir, 'checkout', '-q', '-b', 'feat/E5', 'main');
  writeIn(dir, E5_PATHS.spec, spec);
  git(dir, 'add', E5_PATHS.spec);
  git(dir, 'commit', '-q', '-m', 'docs(spec): E5 text utilities design');
  if (withPlan) {
    writeIn(dir, E5_PATHS.plan, plan);
    git(dir, 'add', E5_PATHS.plan);
    git(dir, 'commit', '-q', '-m', 'docs(plan): E5 text utilities plan');
  }
  const titles = taskTitles(plan);
  for (let k = 1; k <= (tasks ?? 0); k++) {
    copyTree(join(SCEN, 'e5', 'code', `t${k}`), dir);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', `E5 T${k}: ${titles[k] ?? 'task ' + k}`);
  }
}

const SEEDED = {
  'plano-semeado-A': { class: 'plan', artifact: 'A' },
  'plano-semeado-B': { class: 'plan', artifact: 'B' },
  'plano-semeado-codigo': { class: 'plan', artifact: 'C' },
  'codigo-semeado-A': { class: 'code', artifact: 'A' },
  'codigo-semeado-B': { class: 'code', artifact: 'B' },
  'spec-semeado-A': { class: 'spec', artifact: 'A' },
  'spec-semeado-B': { class: 'spec', artifact: 'B' },
};

export function artifactOf(variant) {
  return SEEDED[variant] ?? null;
}

function loadManifest() {
  return JSON.parse(readFileSync(join(DEFECTS, 'manifest.json'), 'utf8'));
}

// Applies every defect of the variant's artifact in one neutral commit on feat/E5.
async function seedVariant(dir, variant, fromRun) {
  const a = artifactOf(variant);
  const entries = loadManifest().filter((e) => e.class === a.class && e.artifact === a.artifact);
  const isCode = a.class === 'code';
  prepareE5Branch(dir, { withPlan: a.class !== 'spec', tasks: isCode ? 2 : 0, fromRun });
  // Code: task 3 is committed with its own files and the defects applied, in a single commit.
  if (isCode) copyTree(join(SCEN, 'e5', 'code', 't3'), dir);
  for (const e of entries) {
    const mod = await import(pathToFileURL(join(DEFECTS, e.sentinel)).href);
    mod.seed(dir);
  }
  const files = [...new Set(entries.map((e) => e.file))];
  if (isCode) {
    git(dir, 'add', '-A');
    const { plan } = e5Texts(fromRun);
    git(dir, 'commit', '-q', '-m', `E5 T3: ${taskTitles(plan)[3] ?? 'task 3'}`);
  } else {
    git(dir, 'add', ...files);
    git(dir, 'commit', '-q', '-m', a.class === 'spec' ? 'docs(spec): E5 clarify design' : 'docs(plan): E5 refine plan');
  }
  const seededCommit = git(dir, 'rev-parse', 'HEAD');
  const seededBlobs = {};
  for (const f of files) seededBlobs[f] = git(dir, 'rev-parse', seededCommit + ':' + f);
  // The release SETUP runs `git worktree add <wt> feat/E5`, which fails while the root has the branch checked out.
  git(dir, 'checkout', '-q', 'main');
  return { seeded: entries.map((e) => e.id), seededCommit, seededBlobs };
}

// Runs the whole sandbox suite (it binds a shared local port); retries up to 3 times while the output says EADDRINUSE.
export function runSandboxSuite(dir, { spawn = spawnSync } = {}) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  let r;
  for (let attempt = 1; attempt <= 3; attempt++) {
    r = spawn(process.execPath, ['--test'], { cwd: dir, env, encoding: 'utf8' });
    const output = String(r.stdout ?? '') + String(r.stderr ?? '');
    if (r.status === 0) return { ok: true, status: 0, attempts: attempt, output };
    if (!output.includes('EADDRINUSE') || attempt === 3) return { ok: false, status: r.status, attempts: attempt, output };
  }
}

export async function makeScenario(dir, variant, { fromRun } = {}) {
  if (!VARIANTS.includes(variant)) throw new Error(`unknown variant: ${variant}`);
  if (/semeado/.test(variant) && !artifactOf(variant)) throw new Error(`variant not implemented yet: ${variant}`);
  const sandbox = makeSandbox(dir);
  const scenario = { dir: sandbox, variant, prompts: [], stopResume: null, seeded: [], seededCommit: null, seededBlobs: {} };
  switch (variant) {
    case 'plano-semeado-A':
    case 'plano-semeado-B':
    case 'plano-semeado-codigo':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun));
      scenario.prompts = [`${RELEASE} plan-only E5`];
      break;
    case 'spec-semeado-A':
    case 'spec-semeado-B':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun));
      break;
    case 'codigo-semeado-A':
    case 'codigo-semeado-B':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun));
      scenario.prompts = [`${RELEASE} run E5`];
      break;
    case 'plan-only':
      scenario.prompts = [`${RELEASE} plan-only E1`];
      break;
    case 'completo':
      scenario.prompts = [`${RELEASE} run E5`];
      break;
    case 'parada-retomada':
      scenario.prompts = [`${RELEASE} run E5`, `${RELEASE} resume E5`];
      scenario.stopResume = STOP_RESUME;
      break;
    case 'coordinator':
      writeIn(sandbox, FIXED_PLAN, readText(join(SCEN, 'coordinator-plan.md')));
      git(sandbox, 'add', FIXED_PLAN);
      git(sandbox, 'commit', '-q', '-m', 'docs(plan): fixed plan');
      scenario.prompts = [`/productivity-tools:plan-coordinator ${FIXED_PLAN}`];
      break;
    case 'planner':
      scenario.prompts = ['/productivity-tools:roadmap-planner ' + readText(join(SCEN, 'planner-theme.md'))];
      break;
    case 'tracker':
      scenario.prompts = ['/productivity-tools:roadmap-tracker ' + readText(join(SCEN, 'tracker-event.md'))];
      break;
  }
  return scenario;
}

function insideRepo(target) {
  const root = resolve(git(here, 'rev-parse', '--show-toplevel'));
  let rel = relative(root, resolve(target));
  if (process.platform === 'win32') rel = relative(root.toLowerCase(), resolve(target).toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const target = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
  const variant = opt('--variant');
  if (!target || !variant || !VARIANTS.includes(variant)) {
    console.error(`usage: node make-scenario.mjs <dir> --variant <${VARIANTS.join('|')}> [--from-run <folder>]`);
    process.exit(2);
  }
  if (insideRepo(target)) {
    console.error(`target is inside the repository: ${resolve(target)}`);
    process.exit(1);
  }
  try {
    const s = await makeScenario(target, variant, { fromRun: opt('--from-run') });
    console.log(JSON.stringify(s, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
