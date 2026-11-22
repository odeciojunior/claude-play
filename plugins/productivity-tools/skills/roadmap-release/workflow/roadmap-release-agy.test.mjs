// roadmap-release-agy.py (T4): base, args validation, discovery and dry-run. The Python script runs in a python3
// process with simulated agent(), phase() and log() (a driver compiles it with top-level await, as run_workflow does)
// over a real temporary git repository; preflight discover, the selection and the bridge run for real, so what is
// compared with the JS is the output of the same pure functions. Without Python >= 3.8 the suite skips with a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPure } from './load-pure.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..', '..', '..');
const WORKFLOW = path.join(HERE, 'roadmap-release-agy.py');
const TRACKER_CLI = path.join(PLUGIN, 'skills', 'roadmap-tracker', 'scripts', 'roadmap.mjs');
const PREFLIGHT = path.join(PLUGIN, 'skills', 'roadmap-release', 'scripts', 'preflight.mjs');
const CHECKER = path.join(PLUGIN, 'skills', 'roadmap-tracker', 'scripts', 'check-roadmap.mjs');
const FIXTURE_VALID = path.join(PLUGIN, 'skills', 'roadmap-tracker', 'scripts', 'fixtures', 'valid');
const SKIP_REASON = 'python >= 3.8 not found';

function detectPython() {
  for (const [cmd, pre] of [['python3', []], ['python', []], ['py', ['-3']], ['py', []]]) {
    const r = spawnSync(cmd, [...pre, '-c', 'import sys; print(sys.version_info[:2])'], { encoding: 'utf8', timeout: 20000 });
    if (r.status !== 0 || typeof r.stdout !== 'string') continue;
    const m = /\((\d+),\s*(\d+)\)/.exec(r.stdout);
    if (m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 8))) return { cmd, pre };
  }
  return null;
}
const PY = detectPython();
const pyTest = (name, fn) => (PY ? test(name, fn) : test(name, { skip: SKIP_REASON }, fn));

// The driver: what run_workflow provides. agent() records each call and answers from req.responses[role].
const DRIVER = [
  'import ast, asyncio, json, os, sys',
  "req = json.loads(sys.stdin.buffer.read().decode('utf-8'))",
  "path = os.environ['AGY_WORKFLOW']",
  'calls = []',
  'logs = []',
  'async def agent(prompt, schema, role=None, type_name=None, model=None, **kw):',
  "    calls.append({'role': role, 'type_name': type_name, 'model': model, 'prompt': prompt, 'schema': schema})",
  "    return req['responses'].get(role)",
  'def phase(title):',
  '    pass',
  'def log(msg):',
  '    logs.append(str(msg))',
  'async def parallel(*a, **k):',
  "    raise RuntimeError('parallel is not used by this step')",
  "ns = {'__name__': '__agy_workflow__', 'args': req.get('args'), 'agent': agent, 'phase': phase, 'log': log, 'parallel': parallel}",
  "src = open(path, encoding='utf-8').read()",
  "code = compile(src, path, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)",
  'res = eval(code, ns)',
  'if asyncio.iscoroutine(res):',
  '    asyncio.run(res)',
  "with open(os.environ['AGY_OUT'], 'w', encoding='utf-8') as f:",
  "    json.dump({'calls': calls, 'logs': logs, 'stageModels': ns.get('STAGE_MODELS')}, f)",
].join('\n');

// Runs the workflow once. Returns { result (the JSON printed to stdout), calls, logs, stageModels }.
function runWorkflow(args, responses = {}, workflow = WORKFLOW) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agyrel-'));
  const out = path.join(dir, 'calls.json');
  try {
    const r = spawnSync(PY.cmd, [...PY.pre, '-I', '-X', 'utf8', '-c', DRIVER], {
      input: JSON.stringify({ args, responses }),
      env: { ...process.env, AGY_WORKFLOW: workflow, AGY_OUT: out },
      encoding: 'utf8',
      timeout: 120000,
    });
    if (r.status !== 0) throw new Error(`python exited ${r.status}: ${r.stderr}`);
    const lines = r.stdout.split('\n').filter((l) => l.trim());
    const rec = JSON.parse(fs.readFileSync(out, 'utf8'));
    return { result: JSON.parse(lines[lines.length - 1]), stdoutLines: lines.length, ...rec };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const lf = (s) => s.replace(/\r\n/g, '\n');

// A repository with the valid roadmap fixture (E1 spec, E2 after E1, E3 after E1 and E2) committed on main.
function makeRepo(edit = (name, text) => text) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agyrel-repo-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'T');
  git(root, 'config', 'user.email', 't@example.invalid');
  git(root, 'config', 'commit.gpgsign', 'false');
  const dir = path.join(root, 'docs', 'plans', 'roadmap-x');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(FIXTURE_VALID)) fs.writeFileSync(path.join(dir, f), edit(f, lf(fs.readFileSync(path.join(FIXTURE_VALID, f), 'utf8'))));
  fs.copyFileSync(CHECKER, path.join(dir, 'check-roadmap.mjs'));
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}

const DONOT_TEXT = 'Do not ship E3 before the DEC-001 ruling holds.';
const withDonot = (name, text) => (name === 'state.md'
  ? text.replace('<!-- /roadmap:inflight -->\n', `<!-- /roadmap:inflight -->\n\n## Do not do now\n\n<!-- roadmap:donot -->\n- ${DONOT_TEXT}\n<!-- /roadmap:donot -->\n`)
  : text);

const CONFIG = { gates: [{ name: 'unit', cmd: 'node --test', kind: 'tests' }], projectContext: 'sample' };
const baseArgs = (repo, extra = {}) => ({
  config: CONFIG, runToken: 'tok-agy-1', trackerCli: TRACKER_CLI.replace(/\\/g, '/'), wtRoot: `${repo}-wt`,
  repo, roadmap: 'docs/plans/roadmap-x', today: '2026-01-05', mode: 'dry-run', ...extra,
});

// ---- args validation: an error result before any agent() call and before any discovery
const BAD_ARGS = [
  ['config absent', (a) => { delete a.config; }, /args\.config is missing/],
  ['config without gates', (a) => { a.config = { gates: [] }; }, /args\.config is missing or has no gates/],
  ['runToken empty', (a) => { a.runToken = ''; }, /runToken is missing/],
  ['runToken blank', (a) => { a.runToken = '   '; }, /runToken is missing/],
  ['runToken absent', (a) => { delete a.runToken; }, /runToken is missing/],
  ['trackerCli absent', (a) => { delete a.trackerCli; }, /args\.trackerCli is missing/],
  ['trackerCli blank', (a) => { a.trackerCli = '  '; }, /args\.trackerCli is missing/],
  ['trackerCli outside the pattern', (a) => { a.trackerCli = '/somewhere/else/roadmap.mjs'; }, /trackerCli does not end with/],
  ['wtRoot absent', (a) => { delete a.wtRoot; }, /args\.wtRoot is missing/],
  ['notes with the template text', (a) => { a.notes = { E1: ' <the owner answer> ' }; }, /notes still hold the template text.*E1/],
  ['invalid mode', (a) => { a.mode = 'full'; }, /invalid mode: full/],
  ['authorizeExternal not a list', (a) => { a.authorizeExternal = 'E1:T1'; }, /authorizeExternal must be a list/],
  ['authorizeExternal item not recognized', (a) => { a.authorizeExternal = ['nonsense']; }, /authorizeExternal item not recognized/],
  ['every gate restricted', (a) => { a.config = { gates: [{ name: 'prod', cmd: 'x', kind: 'tests', restricted: true }] }; }, /every gate is restricted/],
];
for (const [name, mutate, re] of BAD_ARGS) {
  pyTest(`T4 args: ${name} returns an error before any agent() call`, () => {
    const args = baseArgs('/does/not/exist');
    mutate(args);
    const r = runWorkflow(args);
    assert.equal(r.result.status, 'error');
    assert.match(r.result.error, re);
    assert.deepEqual(r.calls, []);
  });
}

pyTest('T4 args: an absent args dict is an error, not a crash', () => {
  const r = runWorkflow(undefined);
  assert.equal(r.result.status, 'error');
  assert.deepEqual(r.calls, []);
});

pyTest('T4 args: the output is exactly one JSON line on stdout', () => {
  const r = runWorkflow(baseArgs('/does/not/exist', { runToken: '' }));
  assert.equal(r.stdoutLines, 1);
});

// ---- dry-run over a real roadmap and git repository
pyTest('T4 dry-run: discovery by subprocess, no agent call, selection of the 3 cards, repository untouched', () => {
  const repo = makeRepo();
  try {
    const head = git(repo, 'rev-parse', 'HEAD');
    const r = runWorkflow(baseArgs(repo));
    assert.equal(r.result.error, undefined);
    assert.equal(r.result.status, 'done');
    assert.equal(r.result.mode, 'dry-run');
    assert.deepEqual(r.calls, [], 'no donot block: no agent call at all (zero script-runner)');
    const sel = r.result.selection;
    assert.deepEqual(sel.order, ['E1', 'E2', 'E3']);
    assert.equal(sel.target, 'release/sample');
    assert.equal(sel.base, 'main');
    assert.equal(sel.integrationBranch, 'main');
    assert.equal(sel.statusAfterMerge, 'on-branch');
    assert.deepEqual(sel.skippedUpfront, []);
    assert.deepEqual(sel.held, []);
    assert.deepEqual(sel.deps, { E1: [], E2: ['E1:in this run'], E3: ['E1:in this run', 'E2:in this run'] });
    assert.deepEqual(r.result.results, []);
    assert.deepEqual(r.result.ownerReview, { acceptedRisks: [], decisionsPending: [], criteriaOpen: [] });
    assert.equal(r.result.truth, null);
    assert.equal(r.result.lastGood, null);
    assert.equal(r.result.reportPath, null);
    assert.equal(r.result.report, null);
    assert.deepEqual(r.result.operatorActions, []);
    assert.equal(git(repo, 'rev-parse', 'HEAD'), head);
    assert.equal(git(repo, 'status', '--porcelain'), '');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 dry-run: the selection equals the one the JS computes from the same discovery', () => {
  const repo = makeRepo();
  try {
    const out = execFileSync(process.execPath, [PREFLIGHT, 'discover', '--repo', repo, '--roadmap', 'docs/plans/roadmap-x', '--today', '2026-01-05', '--prefix', 'feat/', '--nonce', 'n'], { encoding: 'utf8' });
    const disc = JSON.parse(out).data;
    const P = loadPure();
    const statuses = {
      integrated: disc.integratedStatuses, plan: disc.deliverableStatuses[2], executing: disc.deliverableStatuses[3], onBranch: disc.deliverableStatuses[4],
      discarded: disc.discardedStatus || 'discarded', blocked: disc.blockedStatus || 'blocked',
    };
    disc.cards.forEach((c) => { c.deps = c.deps || []; c.status = P.cardStatus(c.status, statuses); c.onTarget = P.onTargetEffective(c, statuses); });
    for (const extra of [{}, { deliverables: ['E2'], autoDeps: true }, { deliverables: ['E3'] }, { deliverables: 'all', maxDeliverables: 2 }, { phase: 'main-flow' }]) {
      const expected = P.selectDeliverables({ cards: disc.cards, statuses, selector: extra.deliverables, filters: { phase: extra.phase }, heldBy: new Map(), autoDeps: !!extra.autoDeps, maxDeliverables: extra.maxDeliverables });
      const r = runWorkflow(baseArgs(repo, extra));
      if (expected.error) {
        assert.equal(r.result.error, expected.error, JSON.stringify(extra));
        continue;
      }
      assert.deepEqual(r.result.selection.order, expected.order, JSON.stringify(extra));
      assert.deepEqual(r.result.selection.skippedUpfront, expected.skipped, JSON.stringify(extra));
      assert.deepEqual(r.result.selection.notes, expected.notes, JSON.stringify(extra));
      assert.equal(r.result.status, expected.order.length ? 'done' : 'partial');
    }
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 dry-run: a donot block is judged by one flash call and vetoes the card it names', () => {
  const repo = makeRepo(withDonot);
  try {
    const r = runWorkflow(baseArgs(repo), { 'discovery-donot': { donotHolds: [{ text: DONOT_TEXT, affects: ['E3', 'NOPE'] }] } });
    assert.equal(r.result.status, 'done');
    assert.equal(r.calls.length, 1);
    const c = r.calls[0];
    assert.equal(c.role, 'discovery-donot');
    assert.equal(c.model, 'flash');
    assert.equal(c.type_name, 'self');
    assert.deepEqual(c.schema.required, ['donotHolds']);
    assert.match(c.prompt, /^DO-NOT CHECK \(read-only; change nothing\)/);
    assert.ok(c.prompt.includes(`  * ${DONOT_TEXT}`));
    assert.match(c.prompt, /\* E3: .*\| criteria: /);
    const sel = r.result.selection;
    assert.deepEqual(sel.order, ['E1', 'E2']);
    assert.equal(sel.skippedUpfront.length, 1);
    assert.equal(sel.skippedUpfront[0].id, 'E3');
    assert.match(sel.skippedUpfront[0].reason, /vetoed by the roadmap "do not" block/);
    assert.ok(sel.notes.includes(`roadmap "do not" restriction (check before running): ${DONOT_TEXT}`));
    const over = runWorkflow(baseArgs(repo, { overrideDonot: ['E3'] }), { 'discovery-donot': { donotHolds: [{ text: DONOT_TEXT, affects: ['E3'] }] } });
    assert.deepEqual(over.result.selection.order, ['E1', 'E2', 'E3']);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 dry-run: a donot check that returns nothing is an error', () => {
  const repo = makeRepo(withDonot);
  try {
    const r = runWorkflow(baseArgs(repo), { 'discovery-donot': null });
    assert.equal(r.result.status, 'error');
    assert.match(r.result.error, /the do-not check returned nothing/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 discovery: a missing roadmap folder is a discovery error before any agent() call', () => {
  const repo = makeRepo();
  try {
    const r = runWorkflow(baseArgs(repo, { roadmap: 'docs/plans/roadmap-missing' }));
    assert.equal(r.result.status, 'error');
    assert.match(r.result.error, /^discovery failed: /);
    assert.deepEqual(r.calls, []);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 selection: a target equal to the integrationBranch needs allowIntegrationBranch', () => {
  const repo = makeRepo();
  try {
    const r = runWorkflow(baseArgs(repo, { targetBranch: 'main' }));
    assert.equal(r.result.status, 'error');
    assert.match(r.result.error, /targetBranch \(main\) is the integrationBranch; pass allowIntegrationBranch: true/);
    const ok = runWorkflow(baseArgs(repo, { targetBranch: 'main', allowIntegrationBranch: true }));
    assert.equal(ok.result.status, 'done');
    assert.equal(ok.result.selection.statusAfterMerge, 'integrated');
    assert.deepEqual(ok.calls, []);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 selection: an unknown deliverable is the same error as in the JS', () => {
  const repo = makeRepo();
  try {
    const r = runWorkflow(baseArgs(repo, { deliverables: ['E99'] }));
    assert.equal(r.result.status, 'error');
    assert.equal(r.result.error, 'unknown deliverables: E99');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---- the output contract
pyTest('T4 contract: resumeArgs has neither runToken nor approveRulings and keeps the rest', () => {
  const repo = makeRepo();
  try {
    const args = baseArgs(repo, { approveRulings: { E1: ['R1:abc'] }, notes: { E1: 'go ahead' }, branchPrefix: 'feat/' });
    const r = runWorkflow(args);
    assert.equal(r.result.status, 'done');
    const ra = r.result.resumeArgs;
    assert.equal('runToken' in ra, false);
    assert.equal('approveRulings' in ra, false);
    assert.equal(ra.mode, 'dry-run');
    assert.equal(ra.repo, repo);
    assert.deepEqual(ra.notes, { E1: 'go ahead' });
    assert.deepEqual(ra.config, CONFIG);
    for (const k of ['status', 'mode', 'operatorActions', 'resumeArgs', 'selection', 'results', 'ownerReview', 'truth', 'lastGood', 'reportPath', 'report']) {
      assert.ok(k in r.result, `contract key ${k}`);
    }
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 contract: minBudgetPerDeliverable is ignored and said so in operatorActions', () => {
  const repo = makeRepo();
  try {
    const r = runWorkflow(baseArgs(repo, { minBudgetPerDeliverable: 999999999 }));
    assert.equal(r.result.status, 'done');
    assert.equal(r.result.operatorActions.length, 1);
    const a = r.result.operatorActions[0];
    assert.equal(a.kind, 'note');
    assert.match(a.what, /minBudgetPerDeliverable is ignored in agy/);
    assert.equal('runToken' in a.resumeWith, false);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 contract: a restricted gate in run mode asks for authorization; the other modes stay silent', () => {
  const repo = makeRepo();
  try {
    const config = { gates: [{ name: 'unit', cmd: 'node --test', kind: 'tests' }, { name: 'prod', cmd: 'deploy --check', kind: 'tests', restricted: true }] };
    const run = runWorkflow(baseArgs(repo, { config, mode: 'run' }));
    assert.equal(run.result.operatorActions.length, 1);
    const a = run.result.operatorActions[0];
    assert.equal(a.kind, 'authorize-external');
    assert.equal(a.item, 'gate:prod');
    assert.deepEqual(a.resumeWith.authorizeExternal, ['gate:prod']);
    assert.equal('runToken' in a.resumeWith, false);
    const dry = runWorkflow(baseArgs(repo, { config }));
    assert.deepEqual(dry.result.operatorActions, []);
    const authorized = runWorkflow(baseArgs(repo, { config, mode: 'run', authorizeExternal: ['gate:prod'] }));
    assert.deepEqual(authorized.result.operatorActions, []);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

pyTest('T4 modes: plan-only and run stop with "mode not implemented yet" until the later tasks, with the selection', () => {
  const repo = makeRepo();
  try {
    for (const mode of ['plan-only', 'run']) {
      const r = runWorkflow(baseArgs(repo, { mode }));
      assert.equal(r.result.status, 'error', mode);
      assert.match(r.result.error, /mode not implemented yet/, mode);
      assert.deepEqual(r.result.selection.order, ['E1', 'E2', 'E3'], mode);
      assert.deepEqual(r.calls, [], mode);
    }
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---- the stage table (spec 7.4)
const PRO_STAGES = ['spec-author', 'plan-author', 'spec-review', 'spec-fix', 'plan-review', 'task-reviewer', 'final-reviewer', 'conflict-review',
  'delta-review', 'gates-fix-review', 'merge-fix-review', 'resume-fix-review'];
const FLASH_STAGES = ['discovery-donot', 'gates', 'evidence', 'plan-fix', 'final-fix', 'delta-fix', 'gates-fix', 'merge-fix', 'sync', 'resync', 'merge',
  'review-log', 'docs', 'report'];
const MECHANICAL = ['setup', 'sanitize', 'rollback', 'cleanup', 'test-integrity', 'script-runner'];

pyTest('T4 STAGE_MODELS: pro for authors and reviewers, flash for the sonnet/medium stages, nothing for mechanical ones', () => {
  const repo = makeRepo();
  try {
    const { stageModels } = runWorkflow(baseArgs(repo));
    for (const s of PRO_STAGES) assert.equal(stageModels[s], 'pro', s);
    for (const s of FLASH_STAGES) assert.equal(stageModels[s], 'flash', s);
    for (const s of MECHANICAL) assert.equal(s in stageModels, false, `${s} is a subprocess`);
    assert.equal('implementer' in stageModels, false, 'the implementer model comes from agyModelFor / nextAgyTier');
    assert.deepEqual(Object.keys(stageModels).sort(), [...PRO_STAGES, ...FLASH_STAGES].sort());
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---- static rules of the file
test('T4 static: no shell=True, no tiers of Claude in the dispatch, unique basename, plugin independence', () => {
  const src = lf(fs.readFileSync(WORKFLOW, 'utf8'));
  assert.ok(!/shell\s*=\s*True/.test(src));
  assert.ok(!/subagent_type/.test(src));
  assert.ok(!/cmd\.exe/i.test(src));
  assert.ok(!/System32/i.test(src));
  assert.ok(!src.includes('superpowers'));
  // agent() calls name the role and the Gemini model; the stage models never carry a Claude tier name.
  for (const m of src.matchAll(/'(?:haiku|sonnet|opus)'/g)) assert.fail(`Claude tier in the workflow: ${m[0]}`);
  const dups = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'roadmap-release-agy.py' && p !== WORKFLOW) dups.push(p);
    }
  };
  walk(PLUGIN);
  assert.deepEqual(dups, []);
});
