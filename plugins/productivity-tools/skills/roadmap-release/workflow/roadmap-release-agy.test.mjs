// roadmap-release-agy.py (T4 base, discovery and dry-run; T5 plan-only and the review loop; T6 run mode up to the gates of the branch). The Python script runs in a python3
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

// The driver: what run_workflow provides. agent() records each call and answers from req.responses[role]: a plain value,
// or a list (one item per call of that role; the last item answers every later call). An item that is an object with
// `$effects` first performs them (`{ write: <absolute path>, text }`: the simulated agent writes a file; `{ git: [argv] }`: it runs git) and answers `$value`.
// A `snippet` runs after the source is loaded without its entry point: it defines `async def snip()` and sees the module.
const DRIVER = [
  'import ast, asyncio, json, os, subprocess, sys',
  "req = json.loads(sys.stdin.buffer.read().decode('utf-8'))",
  "path = os.environ['AGY_WORKFLOW']",
  'calls = []',
  'logs = []',
  'counts = {}',
  'def answer(role):',
  "    r = req['responses'].get(role)",
  '    if isinstance(r, list):',
  '        i = counts.get(role, 0)',
  '        counts[role] = i + 1',
  '        r = r[min(i, len(r) - 1)] if r else None',
  "    if isinstance(r, dict) and '$effects' in r:",
  "        for e in r['$effects']:",
  "            if 'git' in e:",
  "                subprocess.run(['git'] + e['git'], check=True, capture_output=True)",
  "                continue",
  "            os.makedirs(os.path.dirname(e['write']), exist_ok=True)",
  "            with open(e['write'], 'w', encoding='utf-8', newline='') as f:",
  "                f.write(e['text'])",
  "        r = r.get('$value')",
  '    return r',
  'async def agent(prompt, schema, role=None, type_name=None, model=None, **kw):',
  "    calls.append({'role': role, 'type_name': type_name, 'model': model, 'prompt': prompt, 'schema': schema})",
  '    return answer(role)',
  'def phase(title):',
  '    pass',
  'def log(msg):',
  '    logs.append(str(msg))',
  'async def parallel(*a, **k):',
  "    raise RuntimeError('parallel is not used by this step')",
  "ns = {'__name__': '__agy_workflow__', 'args': req.get('args'), 'agent': agent, 'phase': phase, 'log': log, 'parallel': parallel}",
  "src = open(path, encoding='utf-8').read()",
  "snippet = req.get('snippet')",
  'if snippet:',
  "    src = src.split('RESULT = await main()')[0]",
  "code = compile(src, path, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)",
  'res = eval(code, ns)',
  'if asyncio.iscoroutine(res):',
  '    asyncio.run(res)',
  'snip = None',
  'if snippet:',
  '    exec(snippet, ns)',
  "    snip = asyncio.run(ns['snip']())",
  "with open(os.environ['AGY_OUT'], 'w', encoding='utf-8') as f:",
  "    json.dump({'calls': calls, 'logs': logs, 'stageModels': ns.get('STAGE_MODELS'), 'snip': snip}, f)",
].join('\n');

// Runs the workflow once. Returns { result (the JSON printed to stdout), calls, logs, stageModels }.
function runWorkflow(args, responses = {}, workflow = WORKFLOW, snippet = undefined) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agyrel-'));
  const out = path.join(dir, 'calls.json');
  try {
    const r = spawnSync(PY.cmd, [...PY.pre, '-I', '-X', 'utf8', '-c', DRIVER], {
      input: JSON.stringify({ args, responses, snippet }),
      env: { ...process.env, AGY_WORKFLOW: workflow, AGY_OUT: out },
      encoding: 'utf8',
      timeout: 120000,
    });
    if (r.status !== 0) throw new Error(`python exited ${r.status}: ${r.stderr}`);
    const lines = r.stdout.split('\n').filter((l) => l.trim());
    const rec = JSON.parse(fs.readFileSync(out, 'utf8'));
    return { result: snippet ? null : JSON.parse(lines[lines.length - 1]), stdoutLines: lines.length, ...rec };
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

const rmAll = (repo) => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(`${repo}-wt`, { recursive: true, force: true });
};

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
    const config = { gates: [{ name: 'unit', cmd: 'node --version', kind: 'exit' }, { name: 'prod', cmd: 'deploy --check', kind: 'exit', restricted: true }] };
    const kinds = (r) => r.result.operatorActions.filter((x) => x.kind === 'authorize-external');
    const run = runWorkflow(baseArgs(repo, { config, mode: 'run', deliverables: ['E1'] }));
    assert.equal(kinds(run).length, 1);
    const a = kinds(run)[0];
    assert.equal(a.item, 'gate:prod');
    assert.deepEqual(a.resumeWith.authorizeExternal, ['gate:prod']);
    assert.equal('runToken' in a.resumeWith, false);
    const dry = runWorkflow(baseArgs(repo, { config }));
    assert.deepEqual(dry.result.operatorActions, []);
    const authorized = runWorkflow(baseArgs(repo, { config, mode: 'run', deliverables: ['E1'], authorizeExternal: ['gate:prod'] }));
    assert.deepEqual(kinds(authorized), []);
  } finally {
    rmAll(repo);
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

// ======================================================================== T5: plan-only and the review loop
const artDir = (repo, E) => path.join(`${repo}-wt`, E, 'docs', 'plans', `x-${E}`);
const gitBlob = (text) => execFileSync('git', ['hash-object', '--stdin'], { input: text, encoding: 'utf8' }).trim();
const dataDoc = (title, obj) => `# ${title}\n\nProse the tool does not read.\n\n\`\`\`json data\n${JSON.stringify(obj, null, 2)}\n\`\`\`\n`;
const SPEC_OBJ = {
  schema: 'spec/1', id: 'E1', title: 'Walking skeleton', mode: 'unattended',
  acceptance: [
    { id: 'AC1', text: 'Given an empty system, when a user submits one item, then the item is stored and shown back. {verify: test; evidence: node --test tests/e1.test.mjs}' },
    { id: 'AC2', text: 'Given a stored item, when the user reloads, then the same item is shown. {verify: smoke; evidence: node scripts/smoke.mjs reload}' },
  ],
  rulings: [], needsPerson: [], externalEffects: [], edgeCases: [],
};
const PLAN_OBJ = {
  schema: 'plan/1', id: 'E1', title: 'Walking skeleton', spec: 'spec.md', roadmap: 'docs/plans/roadmap-x/', constraints: [], rulings: [], needsPerson: [],
  tasks: [{
    writes: [], produces: [], consumes: [], covers: ['AC1', 'AC2'], testFirst: true, locks: [], external: false, externalDedupe: null, noCommit: false,
    n: 1, title: 'Store', deps: [], files: { create: ['src/store.mjs'], modify: [], test: ['tests/e1.test.mjs'] },
    score: { ambiguity: 0, reasoning: 0, blast: 0, verifiability: 0 }, checks: [{ cmd: 'node --test tests/e1.test.mjs', expect: 'exit 0' }],
  }],
  evidence: [
    { ac: 'AC1', kind: 'test', command: 'node --test tests/e1.test.mjs', external: false, externalDedupe: null },
    { ac: 'AC2', kind: 'smoke', command: 'node scripts/smoke.mjs reload', external: false, externalDedupe: null },
  ],
};
const specText = (title = 'Spec E1') => dataDoc(title, SPEC_OBJ);
const planText = (title = 'Plan E1') => dataDoc(title, PLAN_OBJ).replace('```json data', '## Tarefas\n\n### Tarefa 1: Store\n\nWrite it.\n\n```json data');
const REVIEW_OK = (extra = {}) => ({ issues: [], summary: 'ok', headSha: 'abc', clean: true, commitsInRange: 5, ...extra });
const ISSUE = (description, extra = {}) => ({ severity: 'critical', category: 'defeito', description, file: 'x.md', ...extra });
const authorWrites = (file, text) => ({ $effects: [{ write: file, text }], $value: { ok: true } });
const logWriter = (repo) => ({ $effects: [{ write: path.join(artDir(repo, 'E1'), 'reviews.md'), text: '# Review log\n' }], $value: { ok: true } });
const planOnlyArgs = (repo, extra = {}) => baseArgs(repo, { mode: 'plan-only', deliverables: ['E1'], ...extra });
const roles = (calls) => calls.map((c) => c.role);
const modelsOf = (calls, role) => calls.filter((c) => c.role === role).map((c) => c.model);
const subjects = (repo, ref) => git(repo, 'log', '--format=%s', ref).split('\n').filter(Boolean);

function okResponses(repo, over = {}) {
  const pT = planText();
  return {
    'spec-author': authorWrites(path.join(artDir(repo, 'E1'), 'spec.md'), specText()),
    'spec-review': REVIEW_OK(),
    'plan-author': authorWrites(path.join(artDir(repo, 'E1'), 'plan.md'), pT),
    'plan-review': REVIEW_OK({ measuredPlanBlob: gitBlob(pT) }),
    'review-log': logWriter(repo),
    ...over,
  };
}

pyTest('T5 plan-only: roles and models in order, spec and plan committed by git, tools and the record by subprocess', () => {
  const repo = makeRepo();
  try {
    const r = runWorkflow(planOnlyArgs(repo), okResponses(repo));
    assert.equal(r.result.error, undefined, JSON.stringify(r.result.operatorActions));
    assert.equal(r.result.status, 'done', JSON.stringify(r.result));
    assert.equal(r.result.mode, 'plan-only');
    assert.deepEqual(roles(r.calls), ['spec-author', 'spec-review', 'plan-author', 'plan-review', 'review-log']);
    assert.deepEqual(r.calls.map((c) => c.model), ['pro', 'pro', 'pro', 'pro', 'flash']);
    assert.ok(r.calls.every((c) => c.type_name === 'self'));
    for (const forbidden of ['script-runner', 'setup', 'sanitize', 'rollback', 'cleanup', 'test-integrity', 'spec-load', 'plan-load', 'preflight', 'spec-commit', 'plan-commit']) {
      assert.ok(!roles(r.calls).includes(forbidden), `${forbidden} is a subprocess, not an agent`);
    }
    assert.match(r.calls[0].prompt, /mode: unattended/);
    assert.match(r.calls[0].prompt, /card: E1/);
    assert.match(r.calls[2].prompt, /planTool: .*plan-tool\.mjs/);
    // the reviewers get the schemas of the .js
    assert.ok(r.calls[1].schema.required.includes('commitsInRange'));
    assert.ok(r.calls[3].schema.required.includes('measuredPlanBlob'));
    // spec.md and plan.md are commits of git (author of the repo config), never of an agent
    const onBranch = subjects(repo, 'feat/E1');
    assert.ok(onBranch.includes('E1: spec'), onBranch.join('|'));
    assert.ok(onBranch.includes('E1: plan'), onBranch.join('|'));
    assert.ok(onBranch.some((s) => /^E1: review log/.test(s)), onBranch.join('|'));
    assert.equal(git(repo, 'log', '-1', '--format=%an', '--grep', '^E1: spec$', 'feat/E1'), 'T');
    assert.match(git(repo, 'log', '-1', '--format=%B', '--grep', '^E1: plan$', 'feat/E1'), /Co-Authored-By: /);
    assert.equal(git(repo, 'status', '--porcelain'), '');
    assert.equal(git(path.join(`${repo}-wt`, 'E1'), 'status', '--porcelain'), '');
    // the roadmap record went to the target through roadmap.mjs
    const onTarget = git(repo, 'log', '--format=%s', 'main..release/sample');
    assert.match(onTarget, /docs\(roadmap\): E1 at plan/);
    const row1 = git(repo, 'show', 'release/sample:docs/plans/roadmap-x/state.md').split('\n').find((l) => /^\| E1 \|/.test(l));
    assert.match(row1, /^\| E1 \| plan \| .*docs\/plans\/x-E1\/spec\.md.*docs\/plans\/x-E1\/plan\.md/);
    const row = r.result.results[0];
    assert.equal(row.id, 'E1');
    assert.equal(row.planOnly, true);
    assert.equal(row.merged, false);
    assert.equal(row.spec, 'docs/plans/x-E1/spec.md');
    assert.equal(row.plan, 'docs/plans/x-E1/plan.md');
    assert.equal(row.tasks, 0, 'task results exist only in run mode');
    assert.equal(r.result.report, null);
    assert.match(r.result.lastGood, /^[0-9a-f]{40}$/);
    assert.equal(r.result.reportPath, null);
  } finally {
    rmAll(repo);
  }
});

pyTest('T5 plan-only: an integration worktree and a branch per deliverable are made by git -C, without a baseline', () => {
  const repo = makeRepo();
  try {
    runWorkflow(planOnlyArgs(repo), okResponses(repo));
    const wts = git(repo, 'worktree', 'list', '--porcelain').replace(/\\/g, '/');
    assert.match(wts, /\/_integracao\n/);
    assert.match(wts, /branch refs\/heads\/release\/sample/);
    assert.match(wts, /branch refs\/heads\/feat\/E1/);
    assert.equal(git(repo, 'config', 'rerere.enabled'), 'true');
    assert.equal(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main', 'the checkout of the person is untouched');
  } finally {
    rmAll(repo);
  }
});

pyTest('T5 plan-only: a spec review finding is fixed by spec-fix on pro and the re-review runs on pro', () => {
  const repo = makeRepo();
  try {
    const fixedSpec = specText('Spec E1 (fixed)');
    const r = runWorkflow(planOnlyArgs(repo), okResponses(repo, {
      'spec-review': [REVIEW_OK({ issues: [ISSUE('the title is wrong')] }), REVIEW_OK()],
      'spec-fix': { $effects: [{ write: path.join(artDir(repo, 'E1'), 'spec.md'), text: fixedSpec }], $value: { specPath: 'x', decisions: [], humanInputs: [] } },
    }));
    assert.equal(r.result.status, 'done', r.result.error);
    assert.deepEqual(roles(r.calls).slice(0, 4), ['spec-author', 'spec-review', 'spec-fix', 'spec-review']);
    assert.deepEqual(modelsOf(r.calls, 'spec-fix'), ['pro']);
    assert.deepEqual(modelsOf(r.calls, 'spec-review'), ['pro', 'pro']);
    assert.ok(subjects(repo, 'feat/E1').includes('E1: spec fix 1'), 'the fix is committed by git');
    assert.match(r.calls[2].prompt, /\[critical\/defeito\] x\.md the title is wrong/);
  } finally {
    rmAll(repo);
  }
});

pyTest('T5 plan-only: the plan fixer starts on flash and a repeated finding escalates it to pro with one bonus round, then ends with a controlled failure (C4)', () => {
  const repo = makeRepo();
  try {
    const pT = planText();
    const issue = ISSUE('the same plan defect');
    const r = runWorkflow(planOnlyArgs(repo), okResponses(repo, { 'plan-review': REVIEW_OK({ issues: [issue], measuredPlanBlob: gitBlob(pT) }), 'plan-fix': { ok: true } }));
    assert.deepEqual(modelsOf(r.calls, 'plan-fix'), ['flash', 'pro']);
    assert.deepEqual(modelsOf(r.calls, 'plan-review'), ['pro', 'pro', 'pro']);
    assert.equal(r.result.status, 'needs-operator');
    const row = r.result.results[0];
    assert.equal(row.failKind, 'conteudo');
    assert.match(row.error, /^plan: the same finding reappeared after a fix at pro and there is no higher tier/);
    assert.equal(row.branch, 'feat/E1');
    const defect = r.result.operatorActions.find((a) => a.kind === 'defect');
    assert.ok(defect && defect.deliverable === 'E1');
    assert.deepEqual(defect.resumeWith.notes, { E1: '<owner instruction>' });
    assert.ok(roles(r.calls).includes('review-log'), 'the failure is logged');
  } finally {
    rmAll(repo);
  }
});

pyTest('T5 plan-only: a review that returns nothing twice is an infra failure and every reviewer is guarded read-only', () => {
  const repo = makeRepo();
  try {
    const nul = runWorkflow(planOnlyArgs(repo), okResponses(repo, { 'spec-review': null }));
    assert.equal(nul.result.results[0].failKind, 'infra');
    assert.match(nul.result.results[0].error, /^spec: null review/);
    assert.deepEqual(modelsOf(nul.calls, 'spec-review'), ['pro', 'pro'], 'the round 1b retry');
  } finally {
    rmAll(repo);
  }
  for (const role of ['spec-review', 'plan-review']) {
    const repo2 = makeRepo();
    try {
      const pT = planText();
      const r = runWorkflow(planOnlyArgs(repo2), okResponses(repo2, {
        [role]: { $effects: [{ write: path.join(`${repo2}-wt`, 'E1', 'stray.txt'), text: 'x' }], $value: REVIEW_OK({ measuredPlanBlob: gitBlob(pT) }) },
      }));
      const row = r.result.results[0];
      assert.equal(row.failKind, 'infra', role);
      assert.match(row.error, new RegExp(`the ${role} changed the repository .*reviewers are read-only`), role);
    } finally {
      rmAll(repo2);
    }
  }
});

pyTest('T5 plan-only: a preflight with a dirty integration worktree asks the operator and runs no agent', () => {
  const repo = makeRepo();
  try {
    git(repo, 'branch', 'release/sample', 'main');
    git(repo, 'worktree', 'add', `${repo}-wt/_integracao`, 'release/sample');
    fs.writeFileSync(path.join(`${repo}-wt`, '_integracao', 'stray.txt'), 'x');
    const r = runWorkflow(planOnlyArgs(repo), okResponses(repo));
    assert.equal(r.result.status, 'needs-operator');
    assert.deepEqual(r.calls, []);
    assert.equal(r.result.operatorActions[0].kind, 'preflight:dirty');
    assert.match(r.result.operatorActions[0].what, /stray\.txt/);
  } finally {
    rmAll(repo);
  }
});

pyTest('T5 plan-only: a second run reuses spec and plan as they are and skips their reviews (run record)', () => {
  const repo = makeRepo();
  try {
    const first = runWorkflow(planOnlyArgs(repo), okResponses(repo));
    assert.equal(first.result.status, 'done', first.result.error);
    const again = runWorkflow(planOnlyArgs(repo), okResponses(repo));
    assert.equal(again.result.error, undefined);
    assert.ok(!roles(again.calls).includes('spec-author'), roles(again.calls).join(','));
    assert.ok(!roles(again.calls).includes('plan-author'));
    assert.ok(!roles(again.calls).includes('spec-review'));
    assert.ok(!roles(again.calls).includes('plan-review'));
    assert.equal(again.result.results[0].planOnly, true);
  } finally {
    rmAll(repo);
  }
});

// ---- run_review_loop on its own (a snippet over the module: the ladder nextAgyTier, the bonus round, C4)
const LOOP_SNIPPET = (body) => `
ROOT = ${JSON.stringify(PLUGIN.replace(/\\/g, '/'))}
_load_bridge(ROOT)
ISS = {'severity': 'critical', 'category': 'defeito', 'description': 'same finding', 'file': 'a.md'}
def make_env():
    return {'maxFix': 2, 'blqIds': [], 'reviews': [], 'concerns': [], 'acceptRisks': lambda stage, iss: None}
async def snip():
${body.trim().split('\n').map((l) => '    ' + l).join('\n')}
`;
const loopRun = (body) => runWorkflow(undefined, {}, WORKFLOW, LOOP_SNIPPET(body)).snip;

pyTest('T5 loop: a repeated finding walks flash_lite -> flash -> pro with one bonus round and ends with ok False at pro (C4)', () => {
  const s = loopRun(`
fixes, reviews = [], []
async def review(rnd, prev, reviewer, extra):
    reviews.append([rnd, reviewer, extra and extra['head']])
    return {'issues': [dict(ISS)], 'headSha': 'h', 'clean': True, 'commitsInRange': 1}
async def fix(iss, k, tier):
    fixes.append([k, tier])
    return {'status': 'DONE'}
env = make_env()
res = await run_review_loop(env, 'plan', review, fix, lambda r: r['issues'], {'tier': 'flash_lite'})
return {'res': res, 'fixes': fixes, 'reviews': reviews, 'envReviews': env['reviews']}
`);
  assert.deepEqual(s.fixes, [[1, 'flash_lite'], [2, 'flash'], [3, 'pro']]);
  assert.deepEqual(s.reviews.map((x) => x[0]), [1, 2, 3, 4]);
  assert.ok(s.reviews.every((x) => x[1] === 'pro'), 'every review on pro');
  assert.equal(s.res.ok, false);
  assert.equal(s.res.kind, 'conteudo');
  assert.match(s.res.msg, /the same finding reappeared after a fix at pro and there is no higher tier/);
  assert.equal(s.envReviews.length, 1);
  assert.deepEqual(s.envReviews[0].rounds.map((x) => x.fixTier), [null, 'flash_lite', 'flash', 'pro']);
});

pyTest('T5 loop: a repeat after a fix at pro stops at once, with no loop and no further fix (C4)', () => {
  const s = loopRun(`
fixes, reviews = [], []
async def review(rnd, prev, reviewer, extra):
    reviews.append(rnd)
    return {'issues': [dict(ISS)], 'headSha': 'h', 'clean': True, 'commitsInRange': 1}
async def fix(iss, k, tier):
    fixes.append(tier)
    return {'status': 'DONE'}
env = make_env()
env['maxFix'] = 9
res = await run_review_loop(env, 'spec', review, fix, lambda r: r['issues'], {'tier': 'pro'})
return {'res': res, 'fixes': fixes, 'reviews': reviews}
`);
  assert.deepEqual(s.fixes, ['pro']);
  assert.deepEqual(s.reviews, [1, 2]);
  assert.equal(s.res.ok, false);
  assert.match(s.res.msg, /^spec: the same finding reappeared/);
});

pyTest('T5 loop: a finding that goes away after the escalation ends ok, and a decisao repeat is a decisao failure', () => {
  const s = loopRun(`
state = {'n': 0}
async def review(rnd, prev, reviewer, extra):
    state['n'] += 1
    iss = [dict(ISS)] if state['n'] <= 2 else []
    return {'issues': iss, 'headSha': 'h', 'clean': True, 'commitsInRange': 1}
fixes = []
async def fix(iss, k, tier):
    fixes.append(tier)
    return {'status': 'DONE', 'concerns': 'c%d' % k}
env = make_env()
ok = await run_review_loop(env, 'plan', review, fix, lambda r: r['issues'], {'tier': 'flash'})
async def review2(rnd, prev, reviewer, extra):
    return {'issues': [dict(ISS, category='decisao')], 'headSha': 'h', 'clean': True, 'commitsInRange': 1}
bad = await run_review_loop(make_env(), 'plan', review2, fix, lambda r: r['issues'], {'tier': 'pro'})
return {'ok': ok['ok'], 'fixes': fixes, 'concerns': env['concerns'], 'bad': bad}
`);
  assert.equal(s.ok, true);
  assert.deepEqual(s.fixes.slice(0, 2), ['flash', 'pro']);
  assert.deepEqual(s.concerns, ['plan fix1: c1', 'plan fix2: c2']);
  assert.equal(s.bad.kind, 'decisao');
});

pyTest('T5 loop: maxFix 0 spends no fix, a null review twice is infra, a BLOCKED fix and a null fix end the stage', () => {
  const s = loopRun(`
calls = {'fix': 0}
async def rev(rnd, prev, reviewer, extra):
    return {'issues': [dict(ISS)], 'headSha': 'h', 'clean': True, 'commitsInRange': 1}
async def fixer(iss, k, tier):
    calls['fix'] += 1
    return {'status': 'DONE'}
env0 = make_env()
env0['maxFix'] = 0
zero = await run_review_loop(env0, 'plan', rev, fixer, lambda r: r['issues'], {})
async def nul(rnd, prev, reviewer, extra):
    return None
infra = await run_review_loop(make_env(), 'plan', nul, fixer, lambda r: [], {})
async def blocked(iss, k, tier):
    return {'status': 'BLOCKED', 'summary': 'cannot'}
blk = await run_review_loop(make_env(), 'plan', rev, blocked, lambda r: r['issues'], {})
async def nofix(iss, k, tier):
    return None
nf = await run_review_loop(make_env(), 'plan', rev, nofix, lambda r: r['issues'], {})
return {'zero': zero, 'fixCalls': calls['fix'], 'infra': infra, 'blk': blk, 'nf': nf}
`);
  assert.equal(s.zero.ok, false);
  assert.match(s.zero.msg, /^plan has open issues after 0 fixes/);
  assert.equal(s.fixCalls, 0);
  assert.deepEqual([s.infra.ok, s.infra.kind, s.infra.msg], [false, 'infra', 'plan: null review']);
  assert.deepEqual([s.blk.kind, s.blk.msg], ['conteudo', 'plan: fix BLOCKED: cannot']);
  assert.deepEqual([s.nf.kind, s.nf.msg], ['infra', 'plan: null fix']);
});

pyTest('T5 loop: findings that need no fix (ambiente with a registered blocker, fora-do-escopo) are accepted as risks without a fix', () => {
  const s = loopRun(`
risks = []
fixes = []
async def review(rnd, prev, reviewer, extra):
    return {'issues': [{'severity': 'critical', 'category': 'ambiente', 'description': 'env limit', 'blq': 'BLQ-1'}, {'severity': 'minor', 'category': 'fora-do-escopo', 'description': 'old'}], 'headSha': 'h', 'clean': True, 'commitsInRange': 1}
async def fix(iss, k, tier):
    fixes.append(tier)
    return {'status': 'DONE'}
env = make_env()
env['blqIds'] = ['BLQ-1']
env['acceptRisks'] = lambda stage, iss: risks.append([stage, len(iss)])
res = await run_review_loop(env, 'plan', review, fix, lambda r: r['issues'], {})
return {'res': res['ok'], 'risks': risks, 'fixes': fixes}
`);
  assert.equal(s.res, true);
  assert.deepEqual(s.risks, [['plan', 2]]);
  assert.deepEqual(s.fixes, []);
});

// ---- static rules of the file
pyTest('T5 plan-only: the target checked out in the checkout of the person is not touched without checkout: authorization', () => {
  const repo = makeRepo();
  try {
    git(repo, 'checkout', '-q', '-b', 'release/sample');
    const head = git(repo, 'rev-parse', 'HEAD');
    const r = runWorkflow(planOnlyArgs(repo), okResponses(repo));
    assert.deepEqual(r.calls, []);
    assert.equal(r.result.results[0].failKind, 'externo');
    assert.equal(r.result.status, 'needs-operator');
    const a = r.result.operatorActions.find((x) => x.kind === 'authorize-external');
    assert.equal(a.item, 'checkout:release/sample');
    assert.deepEqual(a.resumeWith.authorizeExternal, ['checkout:release/sample']);
    assert.equal(git(repo, 'rev-parse', 'HEAD'), head);
    assert.equal(git(repo, 'status', '--porcelain'), '');
  } finally {
    rmAll(repo);
  }
});

test('T5 static: subprocesses only through the bridge, the ladder through call_lib, nothing of the shell', () => {
  const src = lf(fs.readFileSync(WORKFLOW, 'utf8'));
  assert.ok(!/os\.system|os\.popen|subprocess\.(call|Popen|check_output)/.test(src), 'every command goes through run_cli (shell=False)');
  assert.match(src, /nextAgyTier\(p\.m, p\.s\)/);
  assert.match(src, /async def run_review_loop\(/);
  // the pure functions are the ones of roadmap-release.js, never copied
  for (const fn of ['reviewTruth', 'sameFinding', 'checkSpecLoad', 'checkPlanLoad', 'recordCommands', 'recordVerdict']) {
    assert.ok(!new RegExp(`def ${fn}\\b`, 'i').test(src), `${fn} is evaluated from the .js, not reimplemented`);
  }
});

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

// ======================================================================== T6: run mode up to the gates of the branch
const taskOf = (n, title, score, extra = {}) => ({
  writes: [], produces: [], consumes: [], covers: n === 1 ? ['AC1'] : ['AC2'], testFirst: true, locks: [], external: false, externalDedupe: null, noCommit: false,
  n, title, deps: n > 1 ? [n - 1] : [], files: { create: [`src/s${n}.mjs`], modify: [], test: [`tests/e${n}.test.mjs`] }, score,
  checks: [{ cmd: 'node --test tests/e1.test.mjs', expect: 'exit 0' }], ...extra,
});
// T1 routes to haiku (flash_lite); T2 to sonnet/high (pro).
const PLAN2_OBJ = (t2 = {}) => ({
  ...PLAN_OBJ,
  tasks: [taskOf(1, 'Store', { ambiguity: 0, reasoning: 0, blast: 0, verifiability: 0 }), taskOf(2, 'Reload', { ambiguity: 2, reasoning: 2, blast: 1, verifiability: 1 }, t2)],
});
const plan2Text = (t2) => dataDoc('Plan E1', PLAN2_OBJ(t2)).replace('```json data', '## Tarefas\n\n### Tarefa 1: Store\n\nx\n\n### Tarefa 2: Reload\n\nx\n\n```json data');
const OLD_TEST = "import assert from 'node:assert/strict';\nassert.equal(1, 1);\nassert.equal(2, 2);\nassert.equal(3, 3);\n";
const commitEffects = (dir, files, subject, extra = []) => [
  ...Object.entries(files).map(([rel, text]) => ({ write: path.join(dir, rel), text })),
  ...extra,
  { git: ['-C', dir, 'add', '-A', '--', '.'] },
  { git: ['-C', dir, 'commit', '-q', '-m', subject] },
];
const CHECKS_FIRST = [{ command: 'node --test tests/e1.test.mjs', output: 'not ok', exit: 1 }, { command: 'node --test tests/e1.test.mjs', output: 'ok', exit: 0 }];
const IMPL_DONE = (extra = {}) => ({ status: 'DONE', summary: 'done', checks: CHECKS_FIRST, ...extra });
const RUN_CONFIG = {
  gates: [{ name: 'broken', cmd: 'test ! -f BROKEN.txt', kind: 'exit' }, { name: 'tests', cmd: 'echo "tests 3 pass 3"', kind: 'tests' }],
  projectContext: 'sample',
};
const runArgs = (repo, extra = {}) => baseArgs(repo, { mode: 'run', deliverables: ['E1'], config: RUN_CONFIG, ...extra });
const GATE_READ = { name: 'tests', ran: true, exit: 0, total: 3, skipped: 0, failedNames: [] };

// A repository whose main already holds a test with 3 assertions (T1 of the scripted implementer removes one).
function makeRunRepo() {
  const repo = makeRepo();
  fs.mkdirSync(path.join(repo, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'tests', 'old.test.mjs'), OLD_TEST);
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'old test');
  return repo;
}

function runResponses(repo, over = {}) {
  const wt = path.join(`${repo}-wt`, 'E1');
  const p2 = plan2Text();
  return {
    gates: GATE_READ,
    'spec-author': authorWrites(path.join(artDir(repo, 'E1'), 'spec.md'), specText()),
    'spec-review': REVIEW_OK(),
    'plan-author': authorWrites(path.join(artDir(repo, 'E1'), 'plan.md'), p2),
    'plan-review': REVIEW_OK({ measuredPlanBlob: gitBlob(p2) }),
    implementer: [
      { $effects: commitEffects(wt, { 'tests/e1.test.mjs': "import test from 'node:test';\ntest('x', () => {});\n", 'src/s1.mjs': 'export default 1;\n', 'tests/old.test.mjs': "import assert from 'node:assert/strict';\nassert.equal(1, 1);\nassert.equal(2, 2);\n" }, 'E1 T1: store'), $value: IMPL_DONE() },
      { $effects: commitEffects(wt, { 'scripts/smoke.mjs': 'process.exit(0);\n', 'src/s2.mjs': 'export default 2;\n', 'BROKEN.txt': 'x\n' }, 'E1 T2: reload'), $value: IMPL_DONE() },
    ],
    'task-reviewer': REVIEW_OK({ commitsInRange: 1 }),
    'final-reviewer': REVIEW_OK({ commitsInRange: 3 }),
    'review-log': logWriter(repo),
    'gates-fix': { $effects: commitEffects(wt, {}, 'E1 gates-fix: remove BROKEN.txt', [{ git: ['-C', wt, 'rm', '-q', 'BROKEN.txt'] }]), $value: { status: 'DONE', summary: 'fixed', checks: [] } },
    'gates-fix-review': REVIEW_OK({ commitsInRange: 1 }),
    ...over,
  };
}

pyTest('T6 run: tasks on the routed Gemini model, task-reviewer always pro, a red gate goes to gates-fix on flash and is re-reviewed on pro', () => {
  const repo = makeRunRepo();
  try {
    const r = runWorkflow(runArgs(repo), runResponses(repo));
    assert.equal(r.result.error, undefined, JSON.stringify(r.result));
    assert.deepEqual(roles(r.calls), ['gates', 'spec-author', 'spec-review', 'plan-author', 'plan-review', 'implementer', 'task-reviewer', 'task-reviewer', 'implementer', 'task-reviewer',
      'task-reviewer', 'final-reviewer', 'final-reviewer', 'review-log', 'gates', 'gates-fix', 'gates-fix-review', 'review-log', 'gates']);
    assert.deepEqual(modelsOf(r.calls, 'implementer'), ['flash_lite', 'pro'], 'agyModelFor(route.tier, route.effort) per task');
    assert.ok(modelsOf(r.calls, 'task-reviewer').length === 4 && modelsOf(r.calls, 'task-reviewer').every((m) => m === 'pro'));
    assert.deepEqual(modelsOf(r.calls, 'gates-fix'), ['flash']);
    assert.deepEqual(modelsOf(r.calls, 'gates-fix-review'), ['pro']);
    assert.deepEqual(modelsOf(r.calls, 'final-reviewer'), ['pro', 'pro'], 'E1 is CRITICAL: the correctness and the security lens');
    assert.ok(modelsOf(r.calls, 'gates').every((m) => m === 'flash'), 'only a tests gate needs a model: it reads the numbers of the output');
    assert.ok(r.calls.every((c) => c.type_name === 'self'));
    for (const forbidden of ['script-runner', 'test-integrity', 'setup', 'preflight', 'progress', 'sync']) assert.ok(!roles(r.calls).includes(forbidden), forbidden);
    // the Gemini tiers go to the dispatch only, never to the plan
    const planFile = fs.readFileSync(path.join(`${repo}-wt`, 'E1', 'docs', 'plans', 'x-E1', 'plan.md'), 'utf8');
    assert.ok(!/flash|"pro"/.test(planFile), 'plan.md carries no Gemini tier');
    assert.match(r.calls[5].prompt, /Implement ONLY Task 1/);
    assert.match(r.calls[5].prompt, /test-first task/);
    assert.match(r.calls[5].prompt, /CURRENT BASELINE OF THE TARGET .*broken: exit 0 \| tests: exit 0, total 3/);
    assert.match(r.calls[6].prompt, /Mode: spec\. Task 1 \("Store"\)/);
    assert.match(r.calls[7].prompt, /Mode: quality\. Task 1/);
    // the output of the tests gate goes to the reader; the exit and the commands are the script's
    const gateCall = r.calls[0];
    assert.match(gateCall.prompt, /tests 3 pass 3/);
    assert.ok(gateCall.schema.required.includes('name'));
    const onBranch = subjects(repo, 'feat/E1');
    for (const s of ['E1 T1: store', 'E1 T2: reload', 'E1 gates-fix: remove BROKEN.txt']) assert.ok(onBranch.includes(s), onBranch.join('|'));
    assert.ok(onBranch.some((s) => /^E1: review log/.test(s)));
    assert.equal(git(path.join(`${repo}-wt`, 'E1'), 'status', '--porcelain'), '');
    // the executing record on the target through roadmap.mjs, with the in-flight entry
    assert.match(git(repo, 'log', '--format=%s', 'main..release/sample'), /docs\(roadmap\): E1 at /);
    assert.match(git(repo, 'show', 'release/sample:docs/plans/roadmap-x/state.md'), /feat\/E1/);
    const row = r.result.results[0];
    assert.equal(row.id, 'E1');
    assert.equal(row.tasks, 2);
    assert.equal(row.merged, false);
    assert.equal(row.readyToMerge, true, 'the merge is the next task: the branch is validated and waits');
    assert.equal(r.result.status, 'partial');
    assert.deepEqual(r.result.resumeArgs.deliverables, ['E1']);
    // the run record kept the baseline (prep) for a resume
    assert.ok(fs.existsSync(path.join(`${repo}-wt`, 'E1', 'docs', 'plans', 'x-E1', 'run.json')));
  } finally {
    rmAll(repo);
  }
});

pyTest('T6 run: test-integrity runs by subprocess on a detached temporary worktree and its alerts reach the final reviewer', () => {
  const repo = makeRunRepo();
  try {
    const r = runWorkflow(runArgs(repo), runResponses(repo));
    const fin = r.calls.find((c) => c.role === 'final-reviewer');
    assert.match(fin.prompt, /Alerts: .*1 assertions removed without replacement/);
    assert.match(fin.prompt, /Mode: review, lens: correctness\. Diff: git -C ".*E1" diff release\/sample\.\.\.HEAD/);
    assert.ok(!roles(r.calls).includes('test-integrity'));
    assert.equal(fs.existsSync(path.join(`${repo}-wt`, '_tmp', 'E1-integrity-wt')), false, 'the temporary worktree is gone');
    assert.doesNotMatch(git(repo, 'worktree', 'list', '--porcelain'), /integrity/);
  } finally {
    rmAll(repo);
  }
});

const INTEG_SNIPPET = (repo, body) => `
ROOT = ${JSON.stringify(PLUGIN.replace(/\\/g, '/'))}
_load_bridge(ROOT)
REPO = ${JSON.stringify(repo.replace(/\\/g, '/'))}
TMP = REPO + '-wt/_tmp/E1-integrity-wt'
async def snip():
${body.trim().split('\n').map((l) => '    ' + l).join('\n')}
`;

pyTest('T6 integrity: the temporary worktree is removed after the program, after a failing program and after an exception', () => {
  const repo = makeRunRepo();
  try {
    git(repo, 'checkout', '-q', '-b', 'b');
    fs.writeFileSync(path.join(repo, 'tests', 'old.test.mjs'), "import assert from 'node:assert/strict';\nassert.equal(1, 1);\n");
    git(repo, 'commit', '-q', '-am', 'weaken');
    git(repo, 'checkout', '-q', 'main');
    const out = runWorkflow(undefined, {}, WORKFLOW, INTEG_SNIPPET(repo, `
program = load_test_integrity(ROOT + '/' + RELEASE_JS_REL, {})
good = measure_integrity(program, REPO, TMP, 'b', 'main')
gone1 = not os.path.exists(TMP)
bad = measure_integrity('process.exit(3)', REPO, TMP, 'b', 'main')
gone2 = not os.path.exists(TMP)
def boom(*a, **k):
    raise RuntimeError('boom')
globals()['run_test_integrity'] = boom
raised = False
try:
    measure_integrity(program, REPO, TMP, 'b', 'main')
except RuntimeError:
    raised = True
listing = git_in(REPO, 'worktree', 'list', '--porcelain')['stdout']
return {'good': good, 'gone1': gone1, 'bad': bad, 'gone2': gone2, 'raised': raised, 'listing': listing, 'gone3': not os.path.exists(TMP)}
`)).snip;
    assert.equal(out.good.removedAsserts, 2);
    assert.deepEqual(out.good.deletedTests, []);
    assert.equal(out.gone1, true);
    assert.equal(out.bad.removedAsserts, -1);
    assert.equal(out.gone2, true);
    assert.equal(out.raised, true);
    assert.equal(out.gone3, true);
    assert.doesNotMatch(out.listing, /integrity/);
  } finally {
    rmAll(repo);
  }
});

pyTest('T6 preflight: a failing setup command, a red baseline and an invalid baseline ask the operator, and no agent runs after them', () => {
  const repo = makeRunRepo();
  try {
    const setup = runWorkflow(runArgs(repo, { config: { ...RUN_CONFIG, setup: ['exit 3'] } }), runResponses(repo));
    assert.equal(setup.result.status, 'needs-operator');
    assert.equal(setup.result.operatorActions[0].kind, 'preflight:setup');
    assert.match(setup.result.operatorActions[0].what, /exit 3/);
    assert.deepEqual(setup.calls, []);
  } finally {
    rmAll(repo);
  }
  const repo2 = makeRunRepo();
  try {
    const config = { gates: [{ name: 'unit', cmd: 'exit 1', kind: 'exit' }] };
    const red = runWorkflow(runArgs(repo2, { config }), runResponses(repo2));
    assert.equal(red.result.status, 'needs-operator');
    assert.equal(red.result.operatorActions[0].kind, 'preflight:red-baseline');
    assert.match(red.result.operatorActions[0].what, /baseline of release\/sample is red in: unit/);
    assert.deepEqual(red.calls, []);
    const accepted = runWorkflow(runArgs(repo2, { config, acceptRedBaseline: true }), runResponses(repo2, { 'spec-author': null }));
    assert.equal(accepted.result.operatorActions.some((a) => a.kind === 'preflight:red-baseline'), false);
    assert.equal(roles(accepted.calls)[0], 'spec-author', 'an accepted red baseline goes on to the spec');
  } finally {
    rmAll(repo2);
  }
  const repo3 = makeRunRepo();
  try {
    const bad = runWorkflow(runArgs(repo3), runResponses(repo3, { gates: null }));
    assert.equal(bad.result.status, 'needs-operator');
    assert.equal(bad.result.operatorActions[0].kind, 'preflight:other');
    assert.deepEqual(roles(bad.calls), ['gates', 'gates'], 'an unreadable tests gate is read twice, then the baseline does not count');
  } finally {
    rmAll(repo3);
  }
});

pyTest('T6 run: an external task that is not authorized holds the deliverable before its implementer runs', () => {
  const repo = makeRunRepo();
  try {
    const t2 = { external: true, externalDedupe: 'check the outbox' };
    const p2 = plan2Text(t2);
    const over = { 'plan-author': authorWrites(path.join(artDir(repo, 'E1'), 'plan.md'), p2), 'plan-review': REVIEW_OK({ measuredPlanBlob: gitBlob(p2) }) };
    const held = runWorkflow(runArgs(repo), runResponses(repo, over));
    assert.equal(held.result.status, 'needs-operator');
    const row = held.result.results[0];
    assert.equal(row.failKind, 'externo');
    assert.match(row.error, /^external task 2 awaits authorization \(E1:T2@[0-9a-f]{8}\)/);
    assert.deepEqual(modelsOf(held.calls, 'implementer'), ['flash_lite'], 'T1 (local) ran, T2 (external) did not');
    const a = held.result.operatorActions.find((x) => x.kind === 'authorize-external' && x.deliverable === 'E1');
    assert.match(a.item, /^E1:T2@[0-9a-f]{8}$/);
    assert.deepEqual(a.resumeWith.authorizeExternal, [a.item]);
    assert.match(a.what, /task 2 \("Reload"\) of E1 is external and not authorized: it was not run/);
    assert.ok(!held.result.operatorActions.some((x) => x.kind === 'defect'));
    // no blocked record for an externo stop
    const rowState = git(repo, 'show', 'release/sample:docs/plans/roadmap-x/state.md').split('\n').find((l) => /^\| E1 \|/.test(l));
    assert.ok(!/blocked/.test(rowState), rowState);
  } finally {
    rmAll(repo);
  }
});

pyTest('T6 run: a task review that repeats walks the implementer ladder flash_lite -> flash -> pro and ends with a conteudo failure recorded as blocked', () => {
  const repo = makeRunRepo();
  try {
    const issue = ISSUE('the same task defect');
    const r = runWorkflow(runArgs(repo), runResponses(repo, {
      'task-reviewer': REVIEW_OK({ issues: [issue], commitsInRange: 1 }),
      'task-fix': { status: 'DONE', summary: 'tried', checks: [] },
    }));
    assert.deepEqual(modelsOf(r.calls, 'task-fix'), ['flash_lite', 'flash', 'pro']);
    assert.ok(modelsOf(r.calls, 'task-reviewer').every((m) => m === 'pro'));
    const row = r.result.results[0];
    assert.equal(row.failKind, 'conteudo');
    assert.match(row.error, /^task 1: T1:spec: the same finding reappeared after a fix at pro and there is no higher tier/);
    assert.ok(r.result.operatorActions.find((x) => x.kind === 'defect'));
    const rowState = git(repo, 'show', 'release/sample:docs/plans/roadmap-x/state.md').split('\n').find((l) => /^\| E1 \|/.test(l));
    assert.match(rowState, /blocked/);
  } finally {
    rmAll(repo);
  }
});

test('T6 static: the run mode reuses the pure functions and the bridge, with no tier of Claude and no parallel()', () => {
  const src = lf(fs.readFileSync(WORKFLOW, 'utf8'));
  assert.match(src, /agyModelFor\(p\.t, p\.e\)/);
  assert.match(src, /load_test_integrity\(/);
  assert.match(src, /run_test_integrity\(/);
  assert.match(src, /run_shell\(/);
  assert.ok(!/\bparallel\(/.test(src.replace(/#[^\n]*/g, '')), 'the gates run one after the other: no parallel() call');
  for (const fn of ['externalHold', 'bindAuthorizations', 'testFirstGap', 'gateGroups', 'allPass', 'validMeasure', 'integrityAlerts', 'buildImplPrompt', 'buildTaskReviewPrompt']) {
    assert.ok(!new RegExp(`def ${fn}\\b`, 'i').test(src), `${fn} is evaluated from the .js or the lib, not reimplemented`);
  }
});
