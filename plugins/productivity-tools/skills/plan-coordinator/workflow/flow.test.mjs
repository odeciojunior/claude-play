import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { AsyncLocalStorage } from 'node:async_hooks';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canon, fnv1a } from '../../../lib/plan-digest.mjs';
import { registeredWorkflows } from '../../../../marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, '..', '..', '..');
const PROGRESS = join(PLUGIN, 'skills', 'plan-coordinator', 'scripts', 'progress.mjs').replace(/\\/g, '/');
const FIXTURE_PLAN = join(HERE, 'fixtures', 'two-waves', 'plan.md');
const EXTERNAL_PLAN = join(HERE, 'fixtures', 'external-step', 'plan.md');
const SRC = readFileSync(join(HERE, 'coordinator.js'), 'utf8').replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runWorkflow = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC);

const IMPL = 'productivity-tools:implementer';
const REVIEWER = 'productivity-tools:task-reviewer';
const FINAL = 'productivity-tools:final-reviewer';
const RUNNER = 'productivity-tools:script-runner';

// SYNTHETIC FIXTURE: the spec the fixture plan points to (plan-tool check needs a readable spec of the same id).
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

// The test command of the gate: green unless the file check.mjs.fail exists.
const CHECK = `import { existsSync } from 'node:fs';
if (existsSync(process.argv[1] + '.fail')) { console.log('not ok 1 - new failure'); process.exit(1); }
console.log('ok 1 - fine');
`;

const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const GIT = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'];

function sh(cwd, cmd, args) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

// A git repository in os.tmpdir() with the fixture plan, its spec and a test command, and the real `progress.mjs init --commits per-step`.
function sandbox({ plan = readFileSync(FIXTURE_PLAN, 'utf8') } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'coordwf-'));
  const planDir = join(dir, 'docs', 'plans', 'fx');
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, 'plan.md'), plan);
  writeFileSync(join(planDir, 'spec.md'), SPEC);
  writeFileSync(join(dir, 'check.mjs'), CHECK);
  sh(dir, 'git', ['init', '-q', '-b', 'main']);
  sh(dir, 'git', ['config', 'core.autocrlf', 'false']);
  sh(dir, 'git', [...GIT, 'add', '-A']);
  sh(dir, 'git', [...GIT, 'commit', '-q', '-m', 'init']);
  const planFile = join(planDir, 'plan.md');
  const init = spawnSync(process.execPath, [PROGRESS, 'init', planFile, '--commits', 'per-step', '--json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr + init.stdout);
  return {
    dir,
    planDir,
    planFile,
    stateFile: join(planDir, 'progress.json'),
    check: join(dir, 'check.mjs').replace(/\\/g, '/'),
    done: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const readState = (sb) => JSON.parse(readFileSync(sb.stateFile, 'utf8'));
let tokenSeq = 0;
const launchArgs = (sb, over = {}) => ({
  plan: sb.planFile.replace(/\\/g, '/'),
  state: sb.stateFile.replace(/\\/g, '/'),
  progress: PROGRESS,
  runToken: `tok-${process.pid}-${++tokenSeq}`,
  test: `node ${shq(sb.check)}`,
  ...over,
});

// The words of a command line the way the POSIX shell reads them (single quotes, double quotes, backslash).
function tokenize(s) {
  const out = [];
  let cur = null;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "'") {
      const j = s.indexOf("'", i + 1);
      cur = (cur ?? '') + s.slice(i + 1, j);
      i = j + 1;
    } else if (c === '"') {
      let j = i + 1;
      let t = '';
      while (s[j] !== '"') {
        if (s[j] === '\\') j++;
        t += s[j++];
      }
      cur = (cur ?? '') + t;
      i = j + 1;
    } else if (c === '\\') {
      cur = (cur ?? '') + s[i + 1];
      i += 2;
    } else if (/\s/.test(c)) {
      if (cur !== null) out.push(cur);
      cur = null;
      i++;
    } else {
      cur = (cur ?? '') + c;
      i++;
    }
  }
  if (cur !== null) out.push(cur);
  return out;
}

// Runs a command line of the script-runner for real: `cd X && ...` chains, node and git, no shell.
function execLine(sb, cmd) {
  let cwd = sb.dir;
  let res = { exit: 0, stdout: '' };
  for (const part of cmd.split(' && ')) {
    const argv = tokenize(part);
    if (argv[0] === 'cd') {
      cwd = argv[1];
      continue;
    }
    const r = spawnSync(argv[0] === 'node' ? process.execPath : argv[0], argv.slice(1), { cwd, encoding: 'utf8' });
    res = { exit: r.status ?? -1, stdout: r.stdout };
    if (res.exit !== 0) break;
  }
  return res;
}

const resign = (o) => {
  const { digest, ...rest } = o;
  return JSON.stringify({ ...rest, digest: fnv1a(JSON.stringify(canon(rest))) });
};
// The same signed output with one character of the digest changed (the copy by the agent went wrong).
const garble = (stdout) => stdout.replace(/("digest": ")([0-9a-f])(?=[0-9a-f]*"\s*\}\s*$)/, (_, a, c) => a + (c === '0' ? '1' : '0'));

// A simulated runtime. The script-runner really runs the commands of progress.mjs and git; the implementer writes the files of its step
// (read from the state on disk) without committing; the reviewers approve. over.impl(n, rec), over.review(rec) and over.runner(rec, res)
// change an answer. Every call is recorded with the parallel() call it ran in and the step statuses on disk at that moment.
function makeSim(sb, over = {}) {
  const als = new AsyncLocalStorage();
  const calls = [];
  let parSeq = 0;
  const statuses = () => {
    try {
      return Object.fromEntries(readState(sb).steps.map((s) => [s.n, s.status]));
    } catch {
      return {};
    }
  };
  const agent = async (prompt, o) => {
    const rec = { seq: calls.length + 1, prompt, o, par: als.getStore() ?? null, snap: statuses() };
    calls.push(rec);
    switch (o.agentType) {
      case RUNNER: {
        rec.cmd = prompt.split('\n')[1];
        const res = execLine(sb, rec.cmd);
        return (over.runner && over.runner(rec, res)) || res;
      }
      case IMPL: {
        rec.step = Number(/^T(\d+):/.exec(o.label)[1]);
        const custom = over.impl && over.impl(rec.step, rec);
        if (custom) return custom;
        const st = readState(sb).steps.find((s) => s.n === rec.step);
        const files = st.files ?? [`src/fallback${rec.step}.mjs`];
        for (const f of files) {
          mkdirSync(dirname(join(sb.dir, f)), { recursive: true });
          writeFileSync(join(sb.dir, f), `// step ${rec.step}, ${o.label}\n`);
        }
        return { status: 'DONE', summary: `T${rec.step} done: ${files.join(' ') || 'no files'}`, checks: [{ command: `node --test t${rec.step}`, output: 'ok', exit: 0 }] };
      }
      case REVIEWER:
        return (over.review && over.review(rec)) || { issues: [], headSha: 'abc', clean: true, commitsInRange: 0, spec: 'pass', quality: 'pass' };
      case FINAL:
        return (over.final && over.final(rec)) || { issues: [], headSha: 'abc', clean: true, commitsInRange: 0 };
      default:
        throw new Error(`unexpected agentType ${o.agentType}`);
    }
  };
  const parallel = (fns) => {
    const id = ++parSeq;
    return Promise.all(fns.map((f) => als.run(id, f)));
  };
  const go = (args) => runWorkflow(args, agent, parallel, () => {}, () => {}, {});
  return { calls, agent, parallel, go };
}

const withSandbox = async (fn, opts) => {
  const sb = sandbox(opts);
  try {
    await fn(sb);
  } finally {
    sb.done();
  }
};
const byAgent = (sim, type) => sim.calls.filter((c) => c.o.agentType === type);
const implOf = (sim, n) => byAgent(sim, IMPL).find((c) => c.step === n);
const runnerCmds = (sim) => byAgent(sim, RUNNER).map((c) => c.cmd);

test('AC1: a wave is dispatched in one parallel call and a step waits for its dependency', () => withSandbox(async (sb) => {
  const sim = makeSim(sb);
  const r = await sim.go(launchArgs(sb));
  assert.equal(r.status, 'done', JSON.stringify(r));
  const [t1, t2, t3, t4] = [1, 2, 3, 4].map((n) => implOf(sim, n));
  assert.ok(t1.par !== null && t1.par === t2.par, 'T1 and T2 are in the same parallel() call');
  assert.ok(t3.par !== null && t3.par === t4.par, 'T3 and T4 are in the same parallel() call');
  assert.notEqual(t1.par, t3.par);
  assert.equal(t1.snap[1], 'launched', 'the launch is written before the implementer runs');
  assert.equal(t3.snap[1], 'pass', 'T3 starts after the pass report of T1 is written');
  assert.equal(t3.snap[3], 'launched');
  assert.equal(byAgent(sim, IMPL).length, 4, 'each step is dispatched once');
  // the routing of the state: model and effort per step, the gated step to the opus reviewer, the final review at opus/high
  assert.equal(t1.o.model, 'haiku');
  assert.equal(t2.o.model, 'sonnet');
  assert.equal(t2.o.effort, 'high');
  const reviews = byAgent(sim, REVIEWER);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].o.model, 'opus');
  assert.equal(reviews[0].o.effort, 'medium');
  assert.match(reviews[0].prompt, /T2/);
  assert.equal(byAgent(sim, FINAL).length, 1);
  assert.equal(byAgent(sim, FINAL)[0].o.model, 'opus');
  assert.equal(byAgent(sim, FINAL)[0].o.effort, 'high');
  // the short prompt: the absolute brief, the handoff of the dependency, the fixed rules
  assert.ok(t1.prompt.includes('/docs/plans/fx/briefs/T1.md'), t1.prompt);
  assert.match(t3.prompt, /HANDOFF T1: T1 done/);
  assert.ok(t1.prompt.includes('Never commit. The orchestrator commits.'));
  assert.ok(t1.prompt.includes('- Never ask the person anything: if a decision is missing, stop and report BLOCKED with the question.'));
  const st = readState(sb);
  assert.equal(st.run.status, 'completed');
  assert.ok(st.run.baseline && st.run.baseline.exit === 0, 'the baseline is recorded');
  assert.deepEqual(st.steps.map((s) => s.status), ['pass', 'pass', 'pass', 'pass']);
}));

test('AC1: a failed T1 keeps T3 undispatched', () => withSandbox(async (sb) => {
  const sim = makeSim(sb, { impl: (n) => (n === 1 ? { status: 'BLOCKED', summary: 'cannot do it', checks: [] } : undefined) });
  const r = await sim.go(launchArgs(sb));
  assert.equal(r.status, 'stopped', JSON.stringify(r));
  assert.equal(r.stop.kind, 'ask');
  assert.equal(implOf(sim, 3), undefined, 'T3 is never dispatched');
  assert.equal(byAgent(sim, IMPL).filter((c) => c.step === 1).length, 3, 'T1 is tried 3 times, then held');
  const st = readState(sb);
  assert.equal(st.steps[0].status, 'skip-manual');
  assert.equal(st.steps[2].status, 'waiting-manual');
  assert.equal(st.steps[1].status, 'pass');
}));

test("AC1: per-step commits run in series after the wave with each step's files", () => withSandbox(async (sb) => {
  const sim = makeSim(sb);
  const r = await sim.go(launchArgs(sb));
  assert.equal(r.status, 'done', JSON.stringify(r));
  const commitCalls = byAgent(sim, RUNNER).filter((c) => /\bgit\b/.test(c.cmd) && /\b(add|commit)\b/.test(c.cmd));
  assert.ok(commitCalls.length >= 6, 'git add and git commit for T1, T2 and T3');
  for (const c of commitCalls) assert.equal(c.par, null, `${c.cmd} ran outside parallel()`);
  const lastImplOfWave1 = Math.max(implOf(sim, 1).seq, implOf(sim, 2).seq, byAgent(sim, REVIEWER)[0].seq);
  const firstCommit = commitCalls[0].seq;
  assert.ok(firstCommit > lastImplOfWave1, 'the commits of wave 1 come after every return and the review');
  const commitsOnly = byAgent(sim, RUNNER).filter((c) => /\bcommit\b/.test(c.cmd));
  assert.deepEqual(commitsOnly.map((c) => /T(\d):/.exec(c.cmd)[1]), ['1', '2', '3'], 'one commit at a time, in the order of n');
  const st = readState(sb);
  const [s1, s2, s3, s4] = st.steps;
  assert.ok(s1.sha && s2.sha && s3.sha);
  assert.notEqual(s1.sha, s2.sha);
  for (const s of [s1, s2, s3]) {
    assert.equal(sh(sb.dir, 'git', ['log', '-1', '--format=%s', s.sha]), `FX T${s.n}: ${s.title}`);
    const files = sh(sb.dir, 'git', ['show', '--name-only', '--pretty=format:', s.sha]).split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(files, [...s.files].sort(), `commit of T${s.n} holds exactly its files`);
  }
  // T4: noCommit, no files: passes with no git add, no git commit, no commit event and a null sha
  assert.equal(s4.status, 'pass');
  assert.equal(s4.sha, null);
  assert.ok(runnerCmds(sim).every((c) => !c.includes('Conferência')), 'no git command for T4');
  assert.ok(st.history.every((h) => !(h.event === 'commit' && h.step === 4)));
}));

test('AC1: a passed step without files stops with an error that names it and asks for init --restart', () => withSandbox(async (sb) => {
  const st = readState(sb);
  delete st.steps[0].files;
  writeFileSync(sb.stateFile, JSON.stringify(st, null, 2) + '\n');
  const sim = makeSim(sb);
  const r = await sim.go(launchArgs(sb));
  assert.equal(r.status, 'error', JSON.stringify(r));
  assert.match(r.error, /T1/);
  assert.match(r.error, /init --restart/);
  assert.ok(runnerCmds(sim).every((c) => !/\b(add|commit)\b/.test(c)), 'nothing is committed blindly');
  assert.equal(readState(sb).steps[0].status, 'pass', 'the report is written before the error returns');
}));

test('AC5: a launch without plan, state or runToken stops before any agent', async () => {
  const sb = { planFile: '/p/plan.md', stateFile: '/p/progress.json', check: '/p/check.mjs' };
  for (const k of ['plan', 'state', 'runToken', 'progress']) {
    const sim = makeSim(sb);
    const r = await sim.go({ ...launchArgs(sb), [k]: undefined });
    assert.equal(r.status, 'error', k);
    assert.ok(r.error.includes(k), r.error);
    assert.equal(sim.calls.length, 0, `${k}: no agent is called`);
  }
  const sim = makeSim(sb);
  const r = await sim.go({ ...launchArgs(sb), authorizeExternal: ['plan:T3'] });
  assert.equal(r.status, 'error');
  assert.ok(r.error.includes('plan:T3@<8 hex>'), r.error);
  assert.equal(sim.calls.length, 0);
});

test('AC5: plugin.json registers coordinator-workflow', () => {
  const pj = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
  const rel = './skills/plan-coordinator/workflow/coordinator.js';
  assert.ok(pj.workflows.includes(rel));
  assert.ok(existsSync(join(PLUGIN, ...rel.split('/'))));
  const names = registeredWorkflows(PLUGIN, pj).map((w) => w.name);
  assert.ok(names.includes('coordinator-workflow'), names.join(','));
});

test('state divergence and plan changes stop the run', async () => {
  // a stateDigest that differs from the local one, correctly signed
  await withSandbox(async (sb) => {
    const sim = makeSim(sb, {
      runner: (rec, res) => {
        if (!/ apply /.test(rec.cmd)) return undefined;
        const o = JSON.parse(res.stdout);
        return { exit: res.exit, stdout: resign({ ...o, stateDigest: 'deadbeef' }) };
      },
    });
    const r = await sim.go(launchArgs(sb));
    assert.equal(r.status, 'stopped', JSON.stringify(r));
    assert.equal(r.stop.kind, 'state-divergence');
    assert.equal(byAgent(sim, IMPL).length, 0, 'no implementer after the divergence');
  });
  // the plan edited after init
  await withSandbox(async (sb) => {
    writeFileSync(sb.planFile, readFileSync(sb.planFile, 'utf8').replace('"title": "Módulo c"', '"title": "Módulo c2"'));
    const sim = makeSim(sb);
    const r = await sim.go(launchArgs(sb));
    assert.equal(r.status, 'stopped', JSON.stringify(r));
    assert.equal(r.stop.kind, 'plan-changed');
    assert.equal(byAgent(sim, IMPL).length, 0);
    assert.ok(runnerCmds(sim).every((c) => / read /.test(c)), 'nothing is written');
  });
  // an output copied with one character changed: the read repeats
  await withSandbox(async (sb) => {
    let first = true;
    const sim = makeSim(sb, { runner: (rec, res) => { if (first && / read /.test(rec.cmd)) { first = false; return { exit: res.exit, stdout: garble(res.stdout) }; } return undefined; } });
    const r = await sim.go(launchArgs(sb));
    assert.equal(r.status, 'done', JSON.stringify(r));
    assert.equal(runnerCmds(sim).filter((c) => / read /.test(c)).length, 2, 'the read is repeated once');
  });
  // a write whose output was copied wrong: a new read, and the batch that already landed is not written twice
  await withSandbox(async (sb) => {
    let first = true;
    const sim = makeSim(sb, { runner: (rec, res) => { if (first && / apply /.test(rec.cmd)) { first = false; return { exit: res.exit, stdout: garble(res.stdout) }; } return undefined; } });
    const r = await sim.go(launchArgs(sb));
    assert.equal(r.status, 'done', JSON.stringify(r));
    const st = readState(sb);
    assert.equal(st.history.filter((h) => h.event === 'launch' && h.steps && h.steps[0] === 1).length, 1, 'the launch batch is written once');
    assert.ok(runnerCmds(sim).some((c) => / read /.test(c) && c !== runnerCmds(sim)[0]), 'a new read confirms the write');
  });
});

// ---- T6: authorization bound to the plan digest, resume after a kill without repeating an effect

const withExternal = (fn) => withSandbox(fn, { plan: readFileSync(EXTERNAL_PLAN, 'utf8') });
const preLaunch = (sim) => byAgent(sim, REVIEWER).filter((c) => /T3:prelaunch/.test(c.o.label));
// An implementer that did its work (the files of its step are on disk) and then died before returning.
const dieAfterWriting = (sb, n) => {
  const st = readState(sb).steps.find((s) => s.n === n);
  for (const f of st.files) {
    mkdirSync(dirname(join(sb.dir, f)), { recursive: true });
    writeFileSync(join(sb.dir, f), `// step ${n}, written before the kill\n`);
  }
  throw new Error('killed');
};

test('AC2: an external step stops before its implementer and returns the item to authorize', () => withExternal(async (sb) => {
  const digest = readState(sb).plan.digest;
  const sim = makeSim(sb);
  const r = await sim.go(launchArgs(sb, { authorizeExternal: undefined }));
  assert.equal(r.status, 'stopped', JSON.stringify(r));
  assert.equal(r.stop.kind, 'authorize');
  assert.deepEqual(r.stop.items, [{ item: `plan:T3@${digest}`, step: 3, title: 'Módulo c' }]);
  assert.equal(preLaunch(sim).length, 1, 'the pre-launch review of T3 ran');
  assert.equal(preLaunch(sim)[0].o.model, 'opus');
  assert.equal(preLaunch(sim)[0].o.effort, 'medium');
  assert.equal(implOf(sim, 3), undefined, 'the implementer of T3 is never called');
  assert.equal(implOf(sim, 4), undefined, 'nothing of the stopped wave is dispatched');
  for (const k of ['authorizeExternal', 'answers', 'runToken']) assert.ok(!(k in r.resumeArgs), `resumeArgs has no ${k}`);
  assert.equal(r.resumeArgs.plan, launchArgs(sb).plan);
  assert.equal(r.resumeArgs.state, launchArgs(sb).state);
  // the stop is written before the return: the review is on disk, the authorization is not
  const st = readState(sb);
  assert.equal(st.steps[2].preLaunchReview, 'pass');
  assert.equal(st.steps[2].authorized, null);
  assert.equal(st.steps[2].status, 'pending');
  // the resume with the item runs T3 once
  const sim2 = makeSim(sb);
  const r2 = await sim2.go(launchArgs(sb, { authorizeExternal: [r.stop.items[0].item] }));
  assert.equal(r2.status, 'done', JSON.stringify(r2));
  assert.equal(byAgent(sim2, IMPL).filter((c) => c.step === 3).length, 1, 'T3 is launched once');
  assert.equal(preLaunch(sim2).length, 0, 'the review that passed is not repeated');
  assert.match(implOf(sim2, 3).prompt, /external and the owner authorized it/);
  assert.equal(implOf(sim2, 3).snap[3], 'launched');
  const st2 = readState(sb);
  assert.ok(st2.steps[2].authorized, 'the authorization is recorded');
  assert.deepEqual(st2.steps.map((s) => s.status), ['pass', 'pass', 'pass', 'pass']);
}));

test('AC2: an authorization bound to another plan digest does not count', () => withExternal(async (sb) => {
  const digest = readState(sb).plan.digest;
  const other = digest === '00000000' ? '11111111' : '00000000';
  const sim = makeSim(sb);
  const r = await sim.go(launchArgs(sb, { authorizeExternal: [`plan:T3@${other}`] }));
  assert.equal(r.status, 'stopped', JSON.stringify(r));
  assert.equal(r.stop.kind, 'authorize');
  assert.equal(r.stop.items[0].item, `plan:T3@${digest}`);
  assert.equal(implOf(sim, 3), undefined, 'T3 is not dispatched');
  assert.equal(readState(sb).steps[2].authorized, null);
}));

test('AC3: a relaunch after a kill skips passed steps and asks about a launched external step', () => withExternal(async (sb) => {
  const item = `plan:T3@${readState(sb).plan.digest}`;
  // the run dies inside the implementer of the authorized external step
  const sim = makeSim(sb, { impl: (n) => (n === 3 ? dieAfterWriting(sb, 3) : undefined) });
  await assert.rejects(sim.go(launchArgs(sb, { authorizeExternal: [item] })), /killed/);
  const dead = readState(sb);
  assert.equal(dead.steps[2].status, 'launched');
  assert.ok(dead.steps[2].authorized);
  assert.equal(dead.steps[0].status, 'pass');
  // relaunch with the same state and another token: the effect is not repeated
  const sim2 = makeSim(sb);
  const r2 = await sim2.go(launchArgs(sb));
  assert.equal(r2.status, 'stopped', JSON.stringify(r2));
  assert.equal(r2.stop.kind, 'ask');
  assert.ok(r2.stop.manual.some((m) => m.step === 3), 'the question is about T3');
  assert.deepEqual(byAgent(sim2, IMPL).map((c) => c.step), [4], 'T1, T2 and T3 are not dispatched again; only the common T4 comes back');
  assert.equal(preLaunch(sim2).length, 0);
  const mid = readState(sb);
  assert.equal(mid.steps[2].status, 'stopped');
  assert.equal(mid.manual.filter((m) => m.open && m.step === 3).length, 1);
  // the person says it is done: T3 closes, is committed and the run ends
  const sim3 = makeSim(sb);
  const r3 = await sim3.go(launchArgs(sb, { answers: [{ type: 'answer', step: 3, value: 'done' }] }));
  assert.equal(r3.status, 'done', JSON.stringify(r3));
  assert.equal(byAgent(sim3, IMPL).length, 0, 'no implementer on the third call');
  const end = readState(sb);
  assert.deepEqual(end.steps.map((s) => s.status), ['pass', 'pass', 'pass', 'pass']);
  assert.ok(end.steps[2].sha, 'T3 is committed');
  assert.equal(sh(sb.dir, 'git', ['log', '-1', '--format=%s', end.steps[2].sha]), 'FX T3: Módulo c');
}));

test('AC3: a relaunch after a kill in a common step relaunches only that step', () => withSandbox(async (sb) => {
  // T2 is reviewed, the review finds a defect and the fix round dies inside the implementer of T2
  let reviews = 0;
  let impls2 = 0;
  const defect = { issues: [{ severity: 'important', category: 'defeito', description: 'b is wrong', file: 'src/b.mjs' }], headSha: 'abc', clean: false, commitsInRange: 0, spec: 'fail', quality: 'pass' };
  const sim = makeSim(sb, {
    review: () => (++reviews === 1 ? defect : undefined),
    impl: (n) => (n === 2 && ++impls2 === 2 ? dieAfterWriting(sb, 2) : undefined),
  });
  await assert.rejects(sim.go(launchArgs(sb)), /killed/);
  const dead = readState(sb);
  assert.equal(dead.steps[1].status, 'launched');
  assert.equal(dead.steps[0].status, 'pass');
  // the relaunch: only T2 of wave 1 comes back
  const sim2 = makeSim(sb);
  const r2 = await sim2.go(launchArgs(sb));
  assert.equal(r2.status, 'done', JSON.stringify(r2));
  const impls = byAgent(sim2, IMPL);
  assert.deepEqual(impls.filter((c) => c.step <= 2).map((c) => c.step), [2], 'only T2 is dispatched again');
  assert.equal(impls.find((c) => c.step === 2).snap[2], 'launched');
  assert.deepEqual(readState(sb).steps.map((s) => s.status), ['pass', 'pass', 'pass', 'pass']);
}));

test('AC5: the skill launches coordinator-workflow by name', () => {
  const skill = readFileSync(join(PLUGIN, 'skills', 'plan-coordinator', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(skill.includes('productivity-tools:coordinator-workflow'));
  const fm = skill.match(/^---\n([\s\S]*?)\n---\n/)[1];
  assert.ok(!/^allowed-tools:/m.test(fm), 'no allowed-tools');
  assert.ok(!/^disable-model-invocation:/m.test(fm), 'no disable-model-invocation');
  const DESCRIPTION = 'description: "Use when executing a multi-step implementation plan from docs/plans/<topic>/plan.md with subagents and you want per-step model-tier routing (haiku/sonnet/opus by complexity), conflict-free parallel waves, and a persistent state file that survives compaction, or when resuming such a plan from that state. The orchestrator approves its own Execution Map, without human map approval. Not for ad-hoc plans without a data block (adopt them with plan-writer first)."';
  assert.ok(fm.split('\n').includes(DESCRIPTION), 'description is unchanged');
  const lines = skill.split('\n').filter((l) => l.includes('scriptPath'));
  assert.ok(lines.length > 0, 'the fallback by scriptPath is described');
  for (const l of lines) {
    assert.ok(/unknown|not found/.test(l), `scriptPath line names the unknown/not found condition: ${l}`);
    assert.ok(l.includes('--add-dir'), `scriptPath line cites --add-dir: ${l}`);
  }
});

test('AC3: a kill after git commit and before its commit event resumes by finding the existing commit', () => withSandbox(async (sb) => {
  const sim = makeSim(sb, { runner: (rec) => { if (/T1:/.test(rec.cmd) && / commit -m /.test(rec.cmd)) throw new Error('killed after the commit'); return undefined } });
  await assert.rejects(sim.go(launchArgs(sb)), /killed/);
  const dead = readState(sb);
  assert.equal(dead.steps[0].status, 'pass');
  assert.ok(!dead.steps[0].sha, 'the event was never flushed');
  const sim2 = makeSim(sb);
  const r2 = await sim2.go(launchArgs(sb));
  assert.equal(r2.status, 'done', JSON.stringify(r2));
  const end = readState(sb);
  assert.equal(sh(sb.dir, 'git', ['log', '-1', '--format=%s', end.steps[0].sha]), 'FX T1: ' + end.steps[0].title);
  assert.equal(sh(sb.dir, 'git', ['log', '--format=%s', '--grep', '^FX T1:']).split('\n').length, 1, 'T1 is committed once');
}));
