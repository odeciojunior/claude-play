#!/usr/bin/env node
// Builds a disposable sandbox for one measurement variant and prints it as JSON.
// Usage: node tools/measure/make-scenario.mjs <dir> --variant <name> [--from-run <folder>]
// <dir> must be outside this repository. Seeded variants arrive in stages (plan, spec and code).
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { makeSandbox, STOP_RESUME } from '../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs';
import { loadPure } from '../../plugins/productivity-tools/skills/roadmap-release/workflow/load-pure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCEN = join(here, 'scenario');
const DEFECTS = join(here, 'defects');
const NATIVE_CODE = join(SCEN, 'e5-native', 'code');

export const VARIANTS = [
  'plan-only', 'completo', 'parada-retomada', 'coordinator', 'planner', 'tracker',
  'plano-semeado-A', 'plano-semeado-B', 'codigo-semeado-A', 'codigo-semeado-B',
  'spec-semeado-A', 'spec-semeado-B', 'plano-semeado-codigo', 'spec-author', 'plan-author',
  'spec-nativo-A', 'spec-nativo-B', 'plano-nativo-A', 'plano-nativo-B',
  'lentes-semeadas-A', 'lentes-semeadas-B',
  'correcao-semeada-A', 'correcao-semeada-B', 'codigo-nativo-A', 'codigo-nativo-B',
];

// KNOWN GAP (E8, for E11 criterion 1): the roadmap-release workflow now reads and writes the native spec and plan at
// docs/plans/roadmap-sandbox-E5/{spec,plan}.md and ignores these superpowers paths. The seeded release variants
// (plano-semeado-*, codigo-semeado-*) therefore do not reach the planted defects through the workflow until native
// spec/plan seeds exist; the direct spec-author, plan-author and reviewer variants are unaffected.
export const E5_PATHS = {
  spec: 'docs/superpowers/specs/2026-11-10-E5-text-utilities-design.md',
  plan: 'docs/superpowers/plans/2026-11-10-E5-text-utilities.md',
};

// E26 A3: the native spec and plan live where the measured workflow reads them (DEC-026).
export const NATIVE_PATHS = loadPure().artifactPaths('sandbox', 'E5');

// Exact LF copies of the 2nd probe blobs (D:/claude-e8q-work/completo/completo-1, release/sandbox,
// docs/plans/sandbox-E5/, plugin c5658cf); a copy whose sha256 diverges is refused.
export const NATIVE_SEEDS = {
  spec: { file: 'scenario/e5-native/spec.md', sha256: 'fa68eb1f1c1c017003beffb380887cb6143f3012b4136a5b1dc5a4dcbe1d7cec' },
  plan: { file: 'scenario/e5-native/plan.md', sha256: '6d486e526820c082cfe008a63765acbc1377236ff69334285979f7c145c0da30' },
};
const NATIVE_PROBE_COMMIT = 'c5658cf';
// Worktree of the run the native seeds were copied from; rewritten to the sandbox root, where feat/E5 is checked out, when seeding.
const NATIVE_PROBE_WORKTREE = 'D:/claude-e8q-work/completo/completo-1-wt/E5';
// Native variants are stage-only: the harness checks feat/E5 out in the sandbox root itself (run-batch: checkout -q feat/E5 in
// scenario.dir), so that directory is the feat/E5 worktree (forward slashes). The release worktree <sandbox>-wt/E5 is never created.
export const sandboxFeatWorktree = (dir) => resolve(dir).split(String.fromCharCode(92)).join('/');

const RELEASE = '/productivity-tools:roadmap-release';

// The release skill's preflight reads permission rules only from settings files (never from CLI
// --allowedTools), so the "run" variants carry them in an excluded settings.local.json.
export const SANDBOX_RELEASE_RULES = ['Bash(node:*)', 'Bash(git:*)', 'Workflow', 'Workflow(productivity-tools:release-workflow)', 'Bash(node *roadmap.mjs" *)'];
export const RELEASE_RUN_VARIANTS = ['completo', 'parada-retomada', 'codigo-semeado-A', 'codigo-semeado-B', 'lentes-semeadas-A', 'lentes-semeadas-B', 'correcao-semeada-A', 'correcao-semeada-B', 'codigo-nativo-A', 'codigo-nativo-B'];
const LOCAL_SETTINGS = '.claude/settings.local.json';

export function excludeFromGit(dir, name) {
  const p = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: dir, encoding: 'utf8' }).trim();
  const file = resolve(dir, p);
  mkdirSync(dirname(file), { recursive: true });
  const old = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!old.split(/\r?\n/).includes(name)) writeFileSync(file, old + (old === '' || old.endsWith('\n') ? '' : '\n') + name + '\n');
}
const FIXED_PLAN = 'docs/plans/fixed-plan/plan.md';
const COORDINATOR_SPEC = 'docs/plans/fixed-plan/coordinator-spec-native.md';

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

function pickFileName(fromRun, sub, re, what) {
  const d = join(resolve(fromRun), sub);
  const hit = existsSync(d) ? readdirSync(d).filter((n) => re.test(n)).sort()[0] : undefined;
  if (!hit) throw new Error(`--from-run: ${what} not found in ${d}`);
  return { dir: d, name: hit };
}

function pickFromRun(fromRun, sub, re, what) {
  const { dir, name } = pickFileName(fromRun, sub, re, what);
  return readText(join(dir, name));
}

const E5_SPEC_RE = /-E5-.*-design\.md$/;
const E5_PLAN_RE = /-E5-.*\.md$/;

function e5Texts(fromRun) {
  if (fromRun) {
    return {
      spec: pickFromRun(fromRun, 'docs/superpowers/specs', E5_SPEC_RE, 'E5 spec'),
      plan: pickFromRun(fromRun, 'docs/superpowers/plans', E5_PLAN_RE, 'E5 plan'),
    };
  }
  return {
    spec: readText(join(SCEN, 'e5', 'spec.md')),
    plan: readText(join(SCEN, 'e5', 'plan.md')),
  };
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// Reads the native seeds of `scenDir` (LF) and refuses any whose sha256 diverges from NATIVE_SEEDS.
// `expect` ({ spec?, plan? }) adds the seedSha256 of the manifest entries: a copy that diverges from it is refused too.
export function readNativeSeeds(scenDir = join(SCEN, 'e5-native'), expect = {}) {
  const out = {};
  for (const k of ['spec', 'plan']) {
    const text = readText(join(scenDir, k + '.md'));
    const got = sha256(text);
    for (const want of [NATIVE_SEEDS[k].sha256, expect[k]]) {
      if (want !== undefined && got !== want) throw new Error(`native ${k} seed: sha256 ${got} differs from the recorded ${want}`);
    }
    out[k] = text;
  }
  return out;
}

// Creates feat/E5 from main with the native spec and, optionally, the native plan at NATIVE_PATHS and,
// with `code`, the native clean code of T1..T3 in three commits `E5 T<n>: <title>` (the plan titles).
export function prepareNativeBranch(dir, { withPlan, code, expect } = {}) {
  const seeds = readNativeSeeds(undefined, expect); // sha256 is checked on the copy, before the rewrite
  const wt = sandboxFeatWorktree(dir);
  const spec = seeds.spec.replaceAll(NATIVE_PROBE_WORKTREE, wt);
  const plan = seeds.plan.replaceAll(NATIVE_PROBE_WORKTREE, wt);
  git(dir, 'checkout', '-q', '-b', 'feat/E5', 'main');
  writeIn(dir, NATIVE_PATHS.spec, spec);
  git(dir, 'add', NATIVE_PATHS.spec);
  git(dir, 'commit', '-q', '-m', 'docs(spec): E5 text utilities design');
  if (withPlan) {
    writeIn(dir, NATIVE_PATHS.plan, plan);
    git(dir, 'add', NATIVE_PATHS.plan);
    git(dir, 'commit', '-q', '-m', 'docs(plan): E5 text utilities plan');
  }
  if (code) {
    const titles = taskTitles(plan);
    for (const k of [1, 2, 3]) {
      copyTree(join(NATIVE_CODE, `t${k}`), dir);
      git(dir, 'add', '-A');
      git(dir, 'commit', '-q', '-m', `E5 T${k}: ${titles[k] ?? 'task ' + k}`);
    }
  }
}

// Describes where the seeded spec and plan came from: file names and hashes only, never the folder path.
export function seedSourceOf(fromRun, { set } = {}) {
  if (set === 'e5-native') {
    if (fromRun) throw new Error('--from-run does not apply to the native seeds');
    const n = readNativeSeeds();
    return { kind: 'nativo-sonda-2', spec: NATIVE_SEEDS.spec.file, plan: NATIVE_SEEDS.plan.file, specSha256: sha256(n.spec), planSha256: sha256(n.plan), probePluginCommit: NATIVE_PROBE_COMMIT };
  }
  const { spec, plan } = e5Texts(fromRun);
  const base = { specSha256: sha256(spec), planSha256: sha256(plan) };
  if (!fromRun) {
    return { kind: 'sintetico', spec: 'scenario/e5/spec.md', plan: 'scenario/e5/plan.md', ...base };
  }
  return {
    kind: 'execucao-aprovada',
    spec: pickFileName(fromRun, 'docs/superpowers/specs', E5_SPEC_RE, 'E5 spec').name,
    plan: pickFileName(fromRun, 'docs/superpowers/plans', E5_PLAN_RE, 'E5 plan').name,
    ...base,
  };
}

export function taskTitles(plan) {
  const titles = {};
  for (const m of plan.matchAll(/^### (?:Task|Tarefa) (\d+): (.+?)\s*$/gm)) titles[Number(m[1])] = m[2];
  // A task without a heading takes the title of the json data block.
  const block = /```json data\n([\s\S]*?)\n```/.exec(plan);
  if (block) {
    try {
      for (const t of JSON.parse(block[1]).tasks ?? []) {
        if (titles[t.n] === undefined && typeof t.title === 'string') titles[t.n] = t.title;
      }
    } catch { /* an unparsable block leaves the heading titles as they are */ }
  }
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

// set: 'e5' is the legacy synthetic scenario (entries without a set); 'e5-native' the native seeds of E26.
const SEEDED = {
  'plano-semeado-A': { class: 'plan', artifact: 'A', set: 'e5' },
  'plano-semeado-B': { class: 'plan', artifact: 'B', set: 'e5' },
  'plano-semeado-codigo': { class: 'plan', artifact: 'C', set: 'e5' },
  'codigo-semeado-A': { class: 'code', artifact: 'A', set: 'e5' },
  'codigo-semeado-B': { class: 'code', artifact: 'B', set: 'e5' },
  // E27 C1: two spec seeds and two quality seeds in the three files of Task 3 (set e5-lentes, sentinels/lentes.mjs).
  'lentes-semeadas-A': { class: 'code', artifact: 'A', set: 'e5-lentes' },
  'lentes-semeadas-B': { class: 'code', artifact: 'B', set: 'e5-lentes' },
  'spec-semeado-A': { class: 'spec', artifact: 'A', set: 'e5' },
  'spec-semeado-B': { class: 'spec', artifact: 'B', set: 'e5' },
  'spec-nativo-A': { class: 'spec', artifact: 'A', set: 'e5-native' },
  'spec-nativo-B': { class: 'spec', artifact: 'B', set: 'e5-native' },
  'plano-nativo-A': { class: 'plan', artifact: 'A', set: 'e5-native' },
  'plano-nativo-B': { class: 'plan', artifact: 'B', set: 'e5-native' },
  // B1: the C defects of codigo-semeado-* (baseSet) are seeded on feat/E5; set names the fix entries (CR, CG) of the fix commit.
  'correcao-semeada-A': { class: 'code', artifact: 'A', set: 'e5-fix', baseSet: 'e5' },
  'correcao-semeada-B': { class: 'code', artifact: 'B', set: 'e5-fix', baseSet: 'e5' },
  // E11 P5: native clean code (scenario/e5-native/code) with the C entries of set e5-native seeded on feat/E5.
  'codigo-nativo-A': { class: 'code', artifact: 'A', set: 'e5-native' },
  'codigo-nativo-B': { class: 'code', artifact: 'B', set: 'e5-native' },
};

export function artifactOf(variant) {
  return SEEDED[variant] ?? null;
}

function loadManifest() {
  return JSON.parse(readFileSync(join(DEFECTS, 'manifest.json'), 'utf8'));
}

// Manifest entries of a seeded variant: same class, artifact and set (an entry without a set belongs to 'e5').
export function manifestEntries(variant) {
  const a = artifactOf(variant);
  if (!a) return [];
  return loadManifest().filter((e) => e.class === a.class && e.artifact === a.artifact && (e.set ?? 'e5') === a.set);
}

// Entries seeded on feat/E5 itself: those of baseSet when the variant has one (correcao-semeada-*), else manifestEntries.
export function baseEntries(variant) {
  const a = artifactOf(variant);
  if (!a) return [];
  const set = a.baseSet ?? a.set;
  return loadManifest().filter((e) => e.class === a.class && e.artifact === a.artifact && (e.set ?? 'e5') === set);
}

// B1: builds the fix commit (clean T1..T3 plus the CR and CG seeds) as a child of seededCommit that no ref points to.
// feat/E5 and the work tree stay at seededCommit; gc.auto 0 keeps the unreferenced object alive.
async function makeFixCommit(dir, variant, seededCommit, { suite = runSandboxSuite, presentFn } = {}) {
  const fixEntries = manifestEntries(variant);
  const ids = fixEntries.map((e) => e.id);
  const mods = {};
  for (const e of fixEntries) mods[e.id] = await import(pathToFileURL(join(DEFECTS, e.sentinel)).href);
  const isPresent = presentFn ?? ((mod, d, ref, id) => mod.present(d, ref, id));
  const author = ['-c', 'user.name=measure', '-c', 'user.email=measure@example.invalid'];
  // (a) clean T1..T3; files that only exist because of a C (src/helpers.mjs of C4) leave the index.
  for (const k of [1, 2, 3]) copyTree(join(SCEN, 'e5', 'code', `t${k}`), dir);
  git(dir, 'rm', '-q', '-f', '--ignore-unmatch', 'src/helpers.mjs');
  git(dir, 'add', '-A');
  const cleanTree = git(dir, 'write-tree');
  // (b) the residue and the regression of the fix
  for (const e of fixEntries) mods[e.id].seed(dir, e.id);
  git(dir, 'add', '-A');
  const fixTree = git(dir, 'write-tree');
  // (c) commit objects without refs; the clean one is a throwaway used only to read the sentinels on the clean code
  const fixSha = git(dir, ...author, 'commit-tree', fixTree, '-p', seededCommit, '-m', 'E5 T3: fix review findings');
  const cleanSha = git(dir, ...author, 'commit-tree', cleanTree, '-p', seededCommit, '-m', 'E5 T3: clean tasks');
  // (d) back to the seeded commit, (e) keep the unreferenced objects
  git(dir, 'reset', '-q', '--hard', seededCommit);
  git(dir, 'config', 'gc.auto', '0');
  // (f) the whole sandbox suite must be green at fixSha
  git(dir, 'checkout', '-q', '--detach', fixSha);
  const r = suite(dir);
  git(dir, 'checkout', '-q', 'feat/E5');
  if (!r.ok) throw new Error(`correcao-semeada: a suite acusa a correcao semeada (fixSha ${fixSha}; ${ids.join(', ')}): ${String(r.output ?? '').slice(-600)}`);
  // (g) every CR and CG is present at fixSha and absent on the clean code
  for (const e of fixEntries) {
    if (isPresent(mods[e.id], dir, fixSha, e.id) !== true) throw new Error(`correcao-semeada: ${e.id} ausente em fixSha ${fixSha}`);
    if (isPresent(mods[e.id], dir, cleanSha, e.id) !== false) throw new Error(`correcao-semeada: ${e.id} indistinguivel entre fixSha ${fixSha} e o codigo limpo`);
  }
  // (i) checkouts and sentinel reads leave fixSha in the HEAD reflog
  git(dir, 'reflog', 'expire', '--expire-unreachable=now', '--all');
  return { fixSha, fixEntries: ids };
}

// Applies every defect of the variant's artifact in one neutral commit on feat/E5.
async function seedVariant(dir, variant, fromRun, fixOpts) {
  const a = artifactOf(variant);
  const entries = baseEntries(variant);
  const isCode = a.class === 'code';
  if (a.set === 'e5-native') {
    if (fromRun) throw new Error('--from-run does not apply to the native seeds');
    const expect = {};
    for (const e of entries) expect[e.class] = e.seedSha256;
    prepareNativeBranch(dir, { withPlan: a.class !== 'spec', code: isCode, expect });
  } else {
    prepareE5Branch(dir, { withPlan: a.class !== 'spec', tasks: isCode ? 2 : 0, fromRun });
  }
  // Code: task 3 is committed with its own files and the defects applied, in a single commit.
  // (native: T1..T3 are already committed by prepareNativeBranch and the defects amend the T3 commit)
  if (isCode && a.set !== 'e5-native') copyTree(join(SCEN, 'e5', 'code', 't3'), dir);
  for (const e of entries) {
    const mod = await import(pathToFileURL(join(DEFECTS, e.sentinel)).href);
    mod.seed(dir, e.id);
  }
  const files = [...new Set(entries.map((e) => e.file))];
  if (isCode) {
    git(dir, 'add', '-A');
    if (a.set === 'e5-native') {
      // The release counts E5 T<n> commits: the defects join the commit of T3, not a fourth one.
      git(dir, 'commit', '-q', '--amend', '--no-edit');
    } else {
      const { plan } = e5Texts(fromRun);
      git(dir, 'commit', '-q', '-m', `E5 T3: ${taskTitles(plan)[3] ?? 'task 3'}`);
    }
  } else {
    git(dir, 'add', ...files);
    git(dir, 'commit', '-q', '-m', a.class === 'spec' ? 'docs(spec): E5 clarify design' : 'docs(plan): E5 refine plan');
  }
  const seededCommit = git(dir, 'rev-parse', 'HEAD');
  const seededBlobs = {};
  for (const f of files) seededBlobs[f] = git(dir, 'rev-parse', seededCommit + ':' + f);
  const fix = a.baseSet ? await makeFixCommit(dir, variant, seededCommit, fixOpts) : {};
  // The release SETUP runs `git worktree add <wt> feat/E5`, which fails while the root has the branch checked out.
  git(dir, 'checkout', '-q', 'main');
  return { seeded: entries.map((e) => e.id), seededCommit, seededBlobs, ...fix };
}

// E27 C1: the checks of lentes-semeadas-*, run after seeding (feat/E5 is at seededCommit): the sandbox suite passes there, every seed
// is present at seededCommit and absent from the clean T3 (a commit object no ref points to, like the clean one of makeFixCommit).
// Leaves the tree on main. suite and presentFn are test seams (default: runSandboxSuite and the sentinel's present).
async function checkLentesSeeds(dir, variant, seededCommit, { suite = runSandboxSuite, presentFn } = {}) {
  const entries = manifestEntries(variant);
  const ids = entries.map((e) => e.id);
  const mods = {};
  for (const e of entries) mods[e.id] = await import(pathToFileURL(join(DEFECTS, e.sentinel)).href);
  const isPresent = presentFn ?? ((mod, d, ref, id) => mod.present(d, ref, id));
  const author = ['-c', 'user.name=measure', '-c', 'user.email=measure@example.invalid'];
  git(dir, 'checkout', '-q', 'feat/E5');
  try {
    const r = suite(dir);
    if (!r.ok) throw new Error(`lentes-semeadas: a suite acusa as sementes (seededCommit ${seededCommit}; ${ids.join(', ')}): ${String(r.output ?? '').slice(-600)}`);
    for (const e of entries) {
      if (isPresent(mods[e.id], dir, seededCommit, e.id) !== true) throw new Error(`lentes-semeadas: ${e.id} ausente em seededCommit ${seededCommit}`);
    }
    // the clean T3: the files of Task 3 as the plan writes them, without a ref
    for (const k of [1, 2, 3]) copyTree(join(SCEN, 'e5', 'code', `t${k}`), dir);
    git(dir, 'add', '-A');
    const cleanTree = git(dir, 'write-tree');
    const cleanSha = git(dir, ...author, 'commit-tree', cleanTree, '-p', seededCommit, '-m', 'E5 T3: clean tasks');
    git(dir, 'reset', '-q', '--hard', seededCommit);
    for (const e of entries) {
      if (isPresent(mods[e.id], dir, cleanSha, e.id) !== false) throw new Error(`lentes-semeadas: ${e.id} indistinguivel entre seededCommit ${seededCommit} e o codigo limpo`);
    }
  } finally {
    git(dir, 'checkout', '-q', '-f', 'feat/E5');
    git(dir, 'reset', '-q', '--hard', seededCommit);
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'reflog', 'expire', '--expire=now', '--all');
    git(dir, 'prune', '--expire=now');
  }
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

// suite and presentFn are test seams of the correcao-semeada checks (default: runSandboxSuite and the sentinel's present).
// coordinatorFixture ('native' by default, or 'legacy') picks the plan the coordinator variant runs (DEC-747).
export async function makeScenario(dir, variant, { fromRun, suite, presentFn, coordinatorFixture = 'native' } = {}) {
  if (!VARIANTS.includes(variant)) throw new Error(`unknown variant: ${variant}`);
  if (!['native', 'legacy'].includes(coordinatorFixture)) throw new Error(`coordinatorFixture must be native or legacy: ${coordinatorFixture}`);
  if (/semeado|nativo/.test(variant) && !artifactOf(variant)) throw new Error(`variant not implemented yet: ${variant}`);
  const sandbox = makeSandbox(dir);
  const scenario = { dir: sandbox, variant, prompts: [], stopResume: null, seeded: [], seededCommit: null, seededBlobs: {}, fixSha: null, fixEntries: [], paths: { ...E5_PATHS } };
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
    case 'plano-nativo-A':
    case 'plano-nativo-B':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun), { paths: { ...NATIVE_PATHS } });
      scenario.prompts = [`${RELEASE} plan-only E5`];
      break;
    case 'spec-nativo-A':
    case 'spec-nativo-B':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun), { paths: { ...NATIVE_PATHS } });
      break;
    case 'codigo-semeado-A':
    case 'codigo-semeado-B':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun));
      scenario.prompts = [`${RELEASE} run E5`];
      break;
    case 'lentes-semeadas-A':
    case 'lentes-semeadas-B':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun));
      await checkLentesSeeds(sandbox, variant, scenario.seededCommit, { suite, presentFn });
      scenario.prompts = [`${RELEASE} run E5`];
      break;
    case 'codigo-nativo-A':
    case 'codigo-nativo-B':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun), { paths: { ...NATIVE_PATHS } });
      scenario.prompts = [`${RELEASE} run E5`];
      break;
    case 'correcao-semeada-A':
    case 'correcao-semeada-B':
      Object.assign(scenario, await seedVariant(sandbox, variant, fromRun, { suite, presentFn }));
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
      scenario.fixture = coordinatorFixture;
      if (coordinatorFixture === 'native') {
        // The plan/1 block points to a spec that sits beside the plan (plan-tool and progress.mjs resolve it from there).
        writeIn(sandbox, FIXED_PLAN, readText(join(SCEN, 'coordinator-plan-native.md')));
        writeIn(sandbox, COORDINATOR_SPEC, readText(join(SCEN, 'coordinator-spec-native.md')));
        git(sandbox, 'add', FIXED_PLAN, COORDINATOR_SPEC);
      } else {
        writeIn(sandbox, FIXED_PLAN, readText(join(SCEN, 'coordinator-plan.md')));
        git(sandbox, 'add', FIXED_PLAN);
      }
      git(sandbox, 'commit', '-q', '-m', 'docs(plan): fixed plan');
      scenario.prompts = [`/productivity-tools:plan-coordinator ${FIXED_PLAN}`];
      break;
    case 'planner':
      scenario.prompts = ['/productivity-tools:roadmap-planner ' + readText(join(SCEN, 'planner-theme.md'))];
      break;
    case 'spec-author': {
      const road = 'docs/plans/roadmap-sandbox';
      const strategyPath = road + '/strategy.md';
      const text = (rel) => readText(join(sandbox, rel));
      const strategy = text(strategyPath);
      writeIn(sandbox, strategyPath, strategy + (strategy.endsWith('\n') ? '' : '\n') + '\n' + readText(join(SCEN, 'spec-author-card.md')));
      const addRow = (rel, closing, row) => {
        const t = text(rel);
        if (!t.includes(closing)) throw new Error(`${rel}: block end not found: ${closing}`);
        writeIn(sandbox, rel, t.replace(closing, row + '\n' + closing));
      };
      addRow(road + '/requirements.md', '<!-- /roadmap:requirements -->', '| REQ-006 | A report can be published to remote storage with an access token | functional | SRC-01 | E6 | covered |');
      addRow(road + '/state.md', '<!-- /roadmap:panel -->', '| E6 | not-started | - | Run the release skill |');
      git(sandbox, 'add', strategyPath, road + '/requirements.md', road + '/state.md');
      git(sandbox, 'commit', '-q', '-m', 'docs(roadmap): add E6 card');
      break;
    }
    case 'plan-author': {
      const files = {
        'docs/plans/roadmap-sandbox-E5/spec.md': 'plan-author-spec.md',
        'docs/plans/word-count/spec.md': 'plan-writer-spec.md',
        'docs/superpowers/plans/2026-01-01-e5-text-utilities.md': join('e5', 'plan.md'),
      };
      for (const [rel, src] of Object.entries(files)) writeIn(sandbox, rel, readText(join(SCEN, src)));
      git(sandbox, 'add', ...Object.keys(files));
      git(sandbox, 'commit', '-q', '-m', 'docs: E5 spec, word-count spec and legacy E5 plan');
      break;
    }
    case 'tracker':
      scenario.prompts = ['/productivity-tools:roadmap-tracker ' + readText(join(SCEN, 'tracker-event.md'))];
      break;
  }
  if (RELEASE_RUN_VARIANTS.includes(variant)) {
    writeIn(sandbox, LOCAL_SETTINGS, JSON.stringify({ permissions: { allow: SANDBOX_RELEASE_RULES, additionalDirectories: [sandbox + '-wt'] } }, null, 2) + '\n');
    excludeFromGit(sandbox, LOCAL_SETTINGS);
    // Claude Code grants an additional directory only if it exists when the session starts.
    mkdirSync(sandbox + '-wt', { recursive: true });
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
