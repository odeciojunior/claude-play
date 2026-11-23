// coordinator-agy.py: o gemeo Python do coordinator.js para o host Antigravity. Os testes compilam o script como o runtime
// run_workflow faz (PyCF_ALLOW_TOP_LEVEL_AWAIT + asyncio.run) com agent/parallel/phase/log simulados, sobre git real e
// progress.mjs real. O script le o global `args` e imprime o JSON final em stdout. Sem Python >= 3.8 as suites pulam com motivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..', '..', '..');
const SCRIPT = path.join(HERE, 'coordinator-agy.py');
const PROGRESS = path.join(PLUGIN, 'skills', 'plan-coordinator', 'scripts', 'progress.mjs').replace(/\\/g, '/');
const FIXTURE_PLAN = path.join(HERE, 'fixtures', 'two-waves', 'plan.md');
const EXTERNAL_PLAN = path.join(HERE, 'fixtures', 'external-step', 'plan.md');
const SKIP_REASON = 'python >= 3.8 not found';

const lf = (s) => s.replace(/\r\n/g, '\n');
const read = (p) => lf(fs.readFileSync(p, 'utf8'));

// ---- deteccao de Python: python3, python, py -3; o atalho da Microsoft Store nao imprime versao.
function detectPython() {
  const options = [['python3', []], ['python', []], ['py', ['-3']], ['py', []]];
  for (const [cmd, pre] of options) {
    const r = spawnSync(cmd, [...pre, '-c', 'import sys; print(sys.version_info[:2])'], { encoding: 'utf8', timeout: 20000 });
    if (r.status !== 0 || typeof r.stdout !== 'string') continue;
    const m = /\((\d+),\s*(\d+)\)/.exec(r.stdout);
    if (m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 8))) return { cmd, pre };
  }
  return null;
}
const PY = detectPython();
const pyTest = (name, fn) => (PY ? test(name, { timeout: 280000 }, fn) : test(name, { skip: SKIP_REASON }, fn));

// ---- o runtime simulado (Python). stdin: { script, args, scenario, out }.
// agent(prompt, schema, role=, type_name=, model=) grava a chamada; subprocess.run grava cada processo (argv, shell) na mesma
// sequencia. scenario: impl {n: resposta | {tamper}}, review {mutate: 'file'|'commit', defects: {n: [issues]}}, noBash.
const HARNESS = String.raw`
import ast, asyncio, json, os, re, subprocess, sys
cfg = json.loads(sys.stdin.buffer.read().decode('utf-8'))
args = cfg['args']
sc = cfg['scenario']
log_events = []
_orig_run = subprocess.run

def _run(argv, *a, **k):
    log_events.append({'kind': 'proc', 'argv': [str(x) for x in argv] if isinstance(argv, (list, tuple)) else str(argv), 'shell': bool(k.get('shell')), 'cwd': k.get('cwd')})
    return _orig_run(argv, *a, **k)
subprocess.run = _run

if sc.get('noBash'):
    _isfile = os.path.isfile
    os.path.isfile = lambda p: False if str(p).lower().endswith('bash.exe') or str(p) == '/bin/bash' else _isfile(p)

def step_statuses():
    try:
        with open(args['state'], encoding='utf-8') as f:
            return {str(s['n']): s['status'] for s in json.load(f)['steps']}
    except Exception:
        return {}

def root_of_state():
    with open(args['state'], encoding='utf-8') as f:
        st = json.load(f)
    r = _orig_run(['git', 'rev-parse', '--show-toplevel'], cwd=os.path.dirname(args['state']), stdout=subprocess.PIPE)
    return st, r.stdout.decode().strip()

def step_no(prompt):
    m = re.findall(r'[Ss]tep T(\d+) of plan', prompt)
    return int(m[-1]) if m else None

async def agent(prompt, schema, role=None, type_name=None, model=None, **extra):
    rec = {'kind': 'agent', 'role': role, 'model': model, 'type_name': type_name, 'prompt': prompt, 'extra': sorted(extra.keys()), 'schema': sorted((schema or {}).get('properties', {}).keys()), 'snap': step_statuses(), 'step': step_no(prompt)}
    log_events.append(rec)
    st, root = root_of_state()
    if role == 'implementer':
        n = rec['step']
        over = (sc.get('impl') or {}).get(str(n))
        if over and over.get('tamper'):
            st['manual'] = [{'kind': 'open-question', 'step': n, 'text': 'tampered', 'open': False}]
            with open(args['state'], 'w', encoding='utf-8') as f:
                json.dump(st, f, indent=2)
        if over and over.get('reply'):
            return over['reply']
        step = [s for s in st['steps'] if s['n'] == n][0]
        for rel in step.get('files') or []:
            p = os.path.join(root, rel)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'w', encoding='utf-8') as f:
                f.write('// step %d, written by the simulated implementer\n' % n)
        return {'status': 'DONE', 'summary': 'T%d done: %s' % (n, ' '.join(step.get('files') or [])), 'checks': [{'command': 'node --test t%d' % n, 'output': 'ok', 'exit': 0}]}
    if role == 'task-reviewer':
        mut = (sc.get('review') or {}).get('mutate')
        if mut == 'file':
            with open(os.path.join(root, 'rogue.txt'), 'w') as f:
                f.write('reviewer wrote this\n')
        elif mut == 'dirty':  # rewrites a file of the step that is already modified/untracked: git status --porcelain does not change
            n = step_no(prompt)
            step = [s for s in st['steps'] if s['n'] == n][0]
            with open(os.path.join(root, step['files'][0]), 'a', encoding='utf-8') as f:
                f.write('// rewritten by the reviewer\n')
        elif mut == 'commit':
            _orig_run(['git', '-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', 'rogue'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return {'issues': [], 'headSha': 'abc', 'clean': True, 'commitsInRange': 0, 'spec': 'pass', 'quality': 'pass'}
    if role == 'final-reviewer':
        return {'issues': [], 'headSha': 'abc', 'clean': True, 'commitsInRange': 0}
    raise RuntimeError('unexpected role %r' % role)

async def parallel(fns):
    return await asyncio.gather(*[f() for f in fns])
def phase(*a, **k):
    pass
def log(*a, **k):
    pass

src = open(cfg['script'], encoding='utf-8').read()
code = compile(src, cfg['script'], 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
g = {'__name__': '__main__', 'args': args, 'agent': agent, 'parallel': parallel, 'phase': phase, 'log': log}
try:
    r = eval(code, g)
    if asyncio.iscoroutine(r):
        asyncio.run(r)
finally:
    sys.stdout.flush()
    with open(cfg['out'], 'w', encoding='utf-8') as f:
        json.dump(log_events, f)
`;

// ---- sandbox: um repositorio git temporario com o plano, a spec e um comando de teste, e o progress.mjs init real.
const SPEC = `# Spec FX

SYNTHETIC FIXTURE

\`\`\`json data
{
  "schema": "spec/1",
  "id": "FX",
  "title": "Duas ondas",
  "mode": "unattended",
  "acceptance": [
    { "id": "AC1", "text": "a funciona. {verify: test; evidence: node --test tests/a.test.mjs}" }
  ],
  "rulings": [],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": []
}
\`\`\`
`;
// Verde, salvo quando existe check.mjs.fail (o teste vermelho tem sempre o mesmo nome).
const CHECK = `import { existsSync } from 'node:fs';
if (existsSync(process.argv[1] + '.fail')) { console.log('not ok 1 - new failure'); process.exit(1); }
console.log('ok 1 - fine');
`;

// O plano do roteamento: T1 = vetor 17 (haiku com dependentes e verificabilidade 1: executor flash_lite, portao), T2 sonnet/medium
// (flash), T3 = vetor 5 (total 6, ambiguidade 2: sonnet/high sem portao, pro), T4 haiku/low sem portao e sem dependentes.
function routingPlan() {
  const text = read(FIXTURE_PLAN);
  const m = /```json data\n([\s\S]*?)\n```/.exec(text);
  const data = JSON.parse(m[1]);
  data.tasks[0].score = { ambiguity: 0, reasoning: 0, blast: 0, verifiability: 1 };
  data.tasks[1].score = { ambiguity: 1, reasoning: 1, blast: 0, verifiability: 0 };
  data.tasks[2].score = { ambiguity: 2, reasoning: 1, blast: 1, verifiability: 1 };
  return text.replace(m[1], JSON.stringify(data, null, 2));
}

const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
function sh(cwd, cmd, a) {
  const r = spawnSync(cmd, a, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `${cmd} ${a.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}
const GIT = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'];

function sandbox({ plan = routingPlan() } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coordagy-'));
  const planDir = path.join(dir, 'docs', 'plans', 'fx');
  fs.mkdirSync(planDir, { recursive: true });
  fs.writeFileSync(path.join(planDir, 'plan.md'), plan);
  fs.writeFileSync(path.join(planDir, 'spec.md'), SPEC);
  fs.writeFileSync(path.join(dir, 'check.mjs'), CHECK);
  sh(dir, 'git', ['init', '-q', '-b', 'main']);
  for (const [k, v] of [['core.autocrlf', 'false'], ['user.name', 't'], ['user.email', 't@t'], ['commit.gpgsign', 'false']]) sh(dir, 'git', ['config', k, v]);
  sh(dir, 'git', [...GIT, 'add', '-A']);
  sh(dir, 'git', [...GIT, 'commit', '-q', '-m', 'init']);
  const planFile = path.join(planDir, 'plan.md');
  const init = spawnSync(process.execPath, [PROGRESS, 'init', planFile, '--commits', 'per-step', '--json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr + init.stdout);
  return {
    dir,
    planFile,
    stateFile: path.join(planDir, 'progress.json'),
    check: path.join(dir, 'check.mjs').replace(/\\/g, '/'),
    done: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
const withSandbox = async (fn, opts) => {
  const sb = sandbox(opts);
  try {
    await fn(sb);
  } finally {
    sb.done();
  }
};
const readState = (sb) => JSON.parse(fs.readFileSync(sb.stateFile, 'utf8'));
let tokenSeq = 0;
const launchArgs = (sb, over = {}) => ({
  plan: sb.planFile.replace(/\\/g, '/'),
  state: sb.stateFile.replace(/\\/g, '/'),
  progress: PROGRESS,
  runToken: `tok-${process.pid}-${++tokenSeq}`,
  agyRequestedBy: 'owner',
  test: `node ${shq(sb.check)}`,
  ...over,
});

// Roda o coordinator-agy.py com o runtime simulado. Devolve { result, events, status, stderr }.
function runScript(args, scenario = {}) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'coordagy-out-')), 'events.json');
  const r = spawnSync(PY.cmd, [...PY.pre, '-I', '-X', 'utf8', '-c', HARNESS], {
    input: JSON.stringify({ script: SCRIPT, args, scenario, out }),
    encoding: 'utf8',
    timeout: 270000,
  });
  const lines = (r.stdout || '').split(/\r?\n/).filter((l) => l.trim());
  let result = null;
  try {
    result = JSON.parse(lines[lines.length - 1]);
  } catch {
    assert.fail(`the script printed no JSON result (exit ${r.status}): stdout=${r.stdout} stderr=${r.stderr}`);
  }
  const events = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
  fs.rmSync(path.dirname(out), { recursive: true, force: true });
  return { result, events, status: r.status, stderr: r.stderr };
}
const agents = (run, role) => run.events.filter((e) => e.kind === 'agent' && (!role || e.role === role));
const procs = (run) => run.events.filter((e) => e.kind === 'proc');
const implOf = (run, n) => agents(run, 'implementer').find((e) => e.step === n);

// ---- estaticos (sem Python)
test('AC4: coordinator-agy.py exists, never uses a shell string, cmd.exe or a script-runner and keeps only Claude tiers', () => {
  assert.ok(fs.existsSync(SCRIPT), 'coordinator-agy.py must exist');
  const src = read(SCRIPT);
  assert.ok(!/shell\s*=\s*True/.test(src), 'no shell=True');
  assert.ok(!/cmd\.exe/i.test(src), 'no cmd.exe');
  assert.ok(!/role\s*=\s*['"]script-runner['"]/.test(src), 'no script-runner dispatch');
  assert.ok(!/--tier/.test(src), 'the script never sends --tier to progress.mjs');
  assert.ok(!/subagent_type/.test(src), 'no subagent_type');
  assert.ok(/agyModelFor/.test(src) && /call_lib/.test(src), 'routing goes through the lib bridge');
  assert.ok(!/\bS_IMPL\s*=|\bS_TASKREVIEW\s*=|\bS_REVIEW\s*=/.test(src), 'the schemas are extracted from coordinator.js, not copied');
  assert.ok(!/hashlib|zlib|0x811c9dc5|0x01000193/.test(src), 'hashes are never reimplemented in Python');
});

// ---- o fluxo completo
pyTest('AC4/C1/C2: four routed steps run with agyModelFor on the implementer, pro on the reviewers and per-step commits on real git', () => withSandbox(async (sb) => {
  const run = runScript(launchArgs(sb));
  assert.equal(run.result.status, 'done', JSON.stringify(run.result) + run.stderr);
  const roles = new Set(run.events.filter((e) => e.kind === 'agent').map((e) => e.role));
  assert.deepEqual([...roles].sort(), ['final-reviewer', 'implementer', 'task-reviewer'], 'no script-runner and no other role');
  assert.ok(agents(run).every((e) => e.type_name === 'self'), 'type_name self');
  // C1 (vector 5: sonnet/high, gate false) -> pro; C2 (vector 17: haiku, gate true) -> executor flash_lite; sonnet/medium -> flash; haiku/low -> flash_lite
  assert.equal(implOf(run, 1).model, 'flash_lite', 'T1: haiku, flash_lite executor even with the gate');
  assert.equal(implOf(run, 2).model, 'flash', 'T2: sonnet/medium');
  assert.equal(implOf(run, 3).model, 'pro', 'T3: sonnet/high');
  assert.equal(implOf(run, 4).model, 'flash_lite', 'T4: haiku/low');
  const st = readState(sb);
  assert.deepEqual(st.steps.map((s) => [s.tier, s.effort, s.gate]), [['haiku', 'low', true], ['sonnet', 'medium', false], ['sonnet', 'high', false], ['haiku', 'low', false]]);
  // the reviewer exists only for the gated step, and runs on pro; the final review runs on pro
  const reviews = agents(run, 'task-reviewer');
  assert.equal(reviews.length, 1, 'only T1 has a gate (T3 has none)');
  assert.equal(reviews[0].step, 1);
  assert.equal(reviews[0].model, 'pro');
  assert.deepEqual(agents(run, 'final-reviewer').map((e) => e.model), ['pro']);
  // the prompt starts with the body of the agent (the frontmatter is gone) and the structured schemas come from coordinator.js
  const body = read(path.join(PLUGIN, 'agents', 'implementer.md')).replace(/^---\n[\s\S]*?\n---[ \t]*\n/, '');
  assert.ok(implOf(run, 1).prompt.startsWith(body.slice(0, 200)), 'the prompt of the implementer starts with its agent body');
  assert.ok(implOf(run, 1).schema.includes('status') && implOf(run, 1).schema.includes('checks'));
  assert.ok(reviews[0].schema.includes('verdicts') && reviews[0].schema.includes('spec'));
  assert.ok(implOf(run, 1).prompt.includes('/docs/plans/fx/briefs/T1.md'));
  assert.match(implOf(run, 3).prompt, /HANDOFF T1: T1 done/);
  assert.equal(implOf(run, 1).snap['1'], 'launched', 'the launch is written before the implementer runs');
  assert.equal(implOf(run, 3).snap['1'], 'pass', 'T3 starts after the pass report of T1 is written');
  // every process is a list (shell=False): node and git for the state and the repository, Git Bash only for the test command
  const ps = procs(run);
  assert.ok(ps.every((p) => Array.isArray(p.argv) && p.shell === false), 'shell=False, argv lists');
  const programs = new Set(ps.map((p) => path.basename(p.argv[0]).replace(/\.exe$/i, '').toLowerCase()));
  for (const p of programs) assert.ok(['node', 'git', 'bash'].includes(p), `unexpected program ${p}`);
  assert.ok(ps.some((p) => p.argv.includes('read') && p.argv.includes(PROGRESS)), 'signed reads of progress.mjs');
  assert.ok(ps.some((p) => p.argv.includes('apply') && p.argv.includes('--events')), 'signed applies of progress.mjs');
  assert.ok(ps.every((p) => !p.argv.includes('--tier')), 'no --tier is ever sent');
  const bashRuns = ps.filter((p) => path.basename(p.argv[0]).toLowerCase().startsWith('bash'));
  assert.ok(bashRuns.length >= 2 && bashRuns.every((p) => p.argv[1] === '-lc'), 'the baseline and the wave gates run through bash -lc');
  assert.ok(!/system32/i.test(bashRuns[0].argv[0]), 'never the System32 launcher');
  // per-step commits, in series, after the wave: one commit per step in the order of n, each with exactly its files
  const commitProcs = ps.filter((p) => p.argv[0] === 'git' && p.argv.includes('commit'));
  assert.deepEqual(commitProcs.map((p) => /T(\d):/.exec(p.argv.join(' '))[1]), ['1', '2', '3'], 'T4 is noCommit');
  const lastImpl = Math.max(...run.events.map((e, i) => (e.kind === 'agent' && [1, 2].includes(e.step) ? i : -1)));
  assert.ok(run.events.indexOf(commitProcs[0]) > lastImpl, 'the commits of wave 1 come after every return and the review');
  for (const s of st.steps.slice(0, 3)) {
    assert.ok(s.sha, `T${s.n} has a sha`);
    assert.equal(sh(sb.dir, 'git', ['log', '-1', '--format=%s', s.sha]), `FX T${s.n}: ${s.title}`);
    const files = sh(sb.dir, 'git', ['show', '--name-only', '--pretty=format:', s.sha]).split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(files, [...s.files].sort(), `commit of T${s.n} holds exactly its files`);
  }
  assert.equal(st.steps[3].sha, null);
  assert.equal(st.run.status, 'completed');
  assert.ok(st.run.baseline && st.run.baseline.exit === 0, 'the baseline is recorded');
}));

pyTest('C3: progress.json keeps only Claude tiers and progress.mjs refuses a Gemini tier with tier-down', () => withSandbox(async (sb) => {
  const run = runScript(launchArgs(sb));
  assert.equal(run.result.status, 'done', JSON.stringify(run.result));
  const st = readState(sb);
  for (const s of st.steps) assert.ok(['haiku', 'sonnet', 'opus'].includes(s.tier), `T${s.n} tier ${s.tier}`);
  assert.ok(!/flash|pro"|"pro/.test(JSON.stringify(st.steps.map((s) => s.tier))), 'no Gemini word in the tiers');
  // the state a Claude Code run resumes: progress.mjs reads it as completed
  const next = spawnSync(process.execPath, [PROGRESS, 'next', sb.stateFile, '--json'], { encoding: 'utf8' });
  assert.equal(next.status, 0, next.stdout + next.stderr);
  assert.equal(JSON.parse(next.stdout).action.action, 'done');
  // a fresh state: a Gemini tier on launch is refused as an unknown level
  await withSandbox(async (sb2) => {
    const ap = (...a) => spawnSync(process.execPath, [PROGRESS, 'apply', sb2.stateFile, ...a, '--json'], { encoding: 'utf8' });
    assert.equal(ap('approve-map').status, 0);
    const bad = ap('launch', '--steps', '1', '--tier', 'flash');
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.equal(JSON.parse(bad.stdout).code, 'tier-down');
    assert.equal(readState(sb2).steps[0].status, 'pending', 'nothing was written');
  });
}));

// ---- guarda read-only
for (const mutate of ['file', 'commit', 'dirty']) {
  pyTest(`AC4: a reviewer that changes the repository (${mutate}) makes the run return error`, () => withSandbox(async (sb) => {
    const run = runScript(launchArgs(sb), { review: { mutate } });
    assert.equal(run.result.status, 'error', JSON.stringify(run.result));
    assert.match(run.result.error, /read-only/);
    assert.equal(agents(run, 'final-reviewer').length, 0, 'the run stops at the reviewer');
  }));
}

// ---- base vermelha, retomada e estado concorrente
pyTest('a red baseline stops with ask before any implementer and unblock resumes the run', () => withSandbox(async (sb) => {
  fs.writeFileSync(sb.check + '.fail', 'red\n');
  const run = runScript(launchArgs(sb));
  assert.equal(run.result.status, 'stopped', JSON.stringify(run.result));
  assert.equal(run.result.stop.kind, 'ask');
  assert.match(run.result.stop.question, /baseline/);
  assert.equal(agents(run, 'implementer').length, 0, 'no implementer ran');
  assert.equal(readState(sb).run.status, 'blocked');
  for (const k of ['runToken', 'authorizeExternal', 'answers', 'agyRequestedBy']) assert.ok(!(k in run.result.resumeArgs), `resumeArgs has no ${k}`);
  assert.ok(run.result.resumeArgs.plan && run.result.resumeArgs.state && run.result.resumeArgs.progress && run.result.resumeArgs.test);
  // the person accepts the red baseline: the same failing test name passes the gates
  const run2 = runScript({ ...run.result.resumeArgs, runToken: `tok-${process.pid}-resume`, agyRequestedBy: 'owner', answers: [{ event: 'unblock' }] });
  assert.equal(run2.result.status, 'done', JSON.stringify(run2.result));
  assert.equal(readState(sb).run.status, 'completed');
}));

pyTest('a missing Git Bash stops with ask and the explicit question, never cmd.exe', () => withSandbox(async (sb) => {
  const run = runScript(launchArgs(sb), { noBash: true });
  assert.equal(run.result.status, 'stopped', JSON.stringify(run.result));
  assert.equal(run.result.stop.kind, 'ask');
  assert.match(run.result.stop.question, /git-bash-not-found/);
  assert.match(run.result.stop.question, /Git Bash/);
  assert.equal(agents(run, 'implementer').length, 0);
  assert.ok(procs(run).every((p) => !/cmd(\.exe)?$/i.test(String(p.argv[0])) && p.shell === false));
}));

pyTest('a state that changes under the run stops with state-divergence', () => withSandbox(async (sb) => {
  const run = runScript(launchArgs(sb), { impl: { 2: { tamper: true } } });
  assert.equal(run.result.status, 'stopped', JSON.stringify(run.result));
  assert.equal(run.result.stop.kind, 'state-divergence');
}));

// ---- passo externo
pyTest('AC4: an external step gets a prelaunch-review on pro and stops with authorize bound to plan:T<n>@<digest>', () => withSandbox(async (sb) => {
  const digest = readState(sb).plan.digest;
  const run = runScript(launchArgs(sb));
  assert.equal(run.result.status, 'stopped', JSON.stringify(run.result));
  assert.equal(run.result.stop.kind, 'authorize');
  assert.deepEqual(run.result.stop.items, [{ item: `plan:T3@${digest}`, step: 3, title: 'Módulo c' }]);
  const pre = agents(run, 'task-reviewer').filter((e) => /Pre-launch review of external step T3/.test(e.prompt));
  assert.equal(pre.length, 1);
  assert.equal(pre[0].model, 'pro');
  assert.equal(implOf(run, 3), undefined, 'the external implementer never ran');
  for (const k of ['authorizeExternal', 'answers', 'runToken']) assert.ok(!(k in run.result.resumeArgs), `resumeArgs has no ${k}`);
  assert.equal(readState(sb).steps[2].authorized, null);
  // another digest never authorizes
  const other = runScript(launchArgs(sb, { authorizeExternal: ['plan:T3@00000000'] }));
  assert.equal(other.result.stop.kind, 'authorize');
  assert.equal(implOf(other, 3), undefined);
  // the item bound to the digest does
  const ok = runScript(launchArgs(sb, { authorizeExternal: [run.result.stop.items[0].item] }));
  assert.equal(ok.result.status, 'done', JSON.stringify(ok.result));
  assert.match(implOf(ok, 3).prompt, /external and the owner authorized it/);
  assert.ok(readState(sb).steps[2].authorized, 'the authorization is recorded');
}, { plan: read(EXTERNAL_PLAN) }));

// ---- argumentos
pyTest('agyRequestedBy: absent or invalid returns error before any agent, process or state change', () => withSandbox(async (sb) => {
  const before = fs.readFileSync(sb.stateFile, 'utf8');
  for (const bad of [undefined, 'yes', 'delegate:', '', 'owner ', 'owner\n', 'owner\r', 'delegate:x\r', 'delegate:a b', 'delegate:a\tb', 'delegate:x\x00', 'delegate:x\x80', 'delegate:x\x9f', 42, null]) {
    const run = runScript({ ...launchArgs(sb), agyRequestedBy: bad });
    assert.equal(run.result.status, 'error', String(bad));
    assert.ok(run.result.error.includes('agy path needs a direct request'), run.result.error);
    assert.equal(run.events.length, 0, `${String(bad)}: nothing runs`);
    assert.equal(fs.readFileSync(sb.stateFile, 'utf8'), before, 'the state did not change');
  }
}));

pyTest('agyRequestedBy: delegate:fable passes the validation and never comes back in resumeArgs', () => withSandbox(async (sb) => {
  fs.writeFileSync(sb.check + '.fail', 'red\n');
  const run = runScript({ ...launchArgs(sb), agyRequestedBy: 'delegate:fable' });
  assert.equal(run.result.status, 'stopped', JSON.stringify(run.result));
  assert.ok(!('agyRequestedBy' in run.result.resumeArgs));
}));

pyTest('args outside the contract return error before any agent', async () => {
  const sb = { planFile: '/p/plan.md', stateFile: '/p/progress.json', check: '/p/check.mjs' };
  for (const k of ['plan', 'state', 'runToken', 'progress']) {
    const run = runScript({ ...launchArgs(sb), [k]: undefined });
    assert.equal(run.result.status, 'error', k);
    assert.ok(run.result.error.includes(k), run.result.error);
    assert.equal(run.events.length, 0, `${k}: nothing runs`);
  }
  // a progress path outside the pattern has no plugin root to derive
  for (const progress of ['/x/y/progress.mjs', 'D:/somewhere/skills/plan-coordinator/scripts/other.mjs']) {
    const run = runScript({ ...launchArgs(sb), progress });
    assert.equal(run.result.status, 'error', progress);
    assert.equal(run.events.filter((e) => e.kind === 'agent').length, 0);
  }
  const bad = runScript({ ...launchArgs(sb), authorizeExternal: ['plan:T3'] });
  assert.equal(bad.result.status, 'error');
  assert.match(bad.result.error, /plan digest/);
  assert.equal(agents(bad).length, 0);
  const answers = runScript({ ...launchArgs(sb), answers: [{ event: 'launch' }] });
  assert.equal(answers.result.status, 'error');
  assert.equal(agents(answers).length, 0);
});

pyTest('main() resets all module globals before early_args_error runs', () => {
  const py = [
    'import ast, asyncio, json',
    `src = open(${JSON.stringify(SCRIPT)}, encoding='utf-8').read().split('try:\\n    result = await main()')[0]`,
    "ns = {'__name__': '__agy_workflow__', 'args': {}, 'phase': lambda *a, **k: None, 'log': lambda *a, **k: None}",
    'async def _agent(*a, **k): return None',
    'async def _parallel(*a, **k): return []',
    "ns['agent'] = _agent; ns['parallel'] = _parallel",
    `code = compile(src, ${JSON.stringify(SCRIPT)}, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)`,
    'eval(code, ns)',
    "ns.update({'PLUGIN': '/stale', 'A': {'stale': True}, 'PROGRESS': '/stale', 'STATE_FILE': '/stale', 'RUN_TAG': 'stale', 'SEQ': 9, 'S': {'x': 1}, 'DISK': {'y': 2}, 'NOW': 'now', 'ROOT': '/stale', 'SWEPT': True, 'MAP': [1], 'SCHEMAS': {'k': 1}, 'BODIES': {'k': 'v'}, 'AUTH_ITEMS': ['x']})",
    "ns['QUEUED'].append({'e': 1}); ns['AGAIN'].add(1); ns['CARRY'][1] = 'x'; ns['REPORTS'][1] = {}; ns['LOST'][1] = 2",
    "res = asyncio.run(ns['main']())",
    "out = {'res': res, 'PLUGIN': ns['PLUGIN'], 'A': ns['A'], 'PROGRESS': ns['PROGRESS'], 'STATE_FILE': ns['STATE_FILE'], 'RUN_TAG': ns['RUN_TAG'], 'SEQ': ns['SEQ'], 'S': ns['S'], 'DISK': ns['DISK'], 'NOW': ns['NOW'], 'ROOT': ns['ROOT'], 'QUEUED': ns['QUEUED'], 'SWEPT': ns['SWEPT'], 'AGAIN': sorted(ns['AGAIN']), 'CARRY': ns['CARRY'], 'REPORTS': ns['REPORTS'], 'LOST': ns['LOST'], 'MAP': ns['MAP'], 'SCHEMAS': ns['SCHEMAS'], 'BODIES': ns['BODIES'], 'AUTH_ITEMS': ns['AUTH_ITEMS']}",
    'print(json.dumps(out))',
  ].join('\n');
  const r = spawnSync(PY.cmd, [...PY.pre, '-I', '-X', 'utf8', '-c', py], { encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim());
  assert.equal(out.res.status, 'error');
  assert.ok(out.res.error.includes('agy path needs a direct request'), out.res.error);
  for (const k of ['PLUGIN', 'PROGRESS', 'STATE_FILE', 'RUN_TAG', 'S', 'DISK', 'NOW', 'ROOT', 'MAP']) assert.equal(out[k], null, k);
  assert.equal(out.SEQ, 0);
  assert.equal(out.SWEPT, false);
  assert.deepEqual(out.A, {});
  for (const k of ['QUEUED', 'AGAIN', 'AUTH_ITEMS']) assert.deepEqual(out[k], [], k);
  for (const k of ['CARRY', 'REPORTS', 'LOST', 'SCHEMAS', 'BODIES']) assert.deepEqual(out[k], {}, k);
});
