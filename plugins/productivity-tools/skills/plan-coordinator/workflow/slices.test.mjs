import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fnv1a } from '../../../lib/plan-digest.mjs';
import { loadPure } from '../../roadmap-release/workflow/load-pure.mjs';

// E41 B1 T1: the signed read of the coordinator goes slice by slice (read --slice k), every answer fits the copy limit,
// and only the slice that came back wrong is repeated. The simulator below is a copy of makeSim/execLine/sandbox of flow.test.mjs
// (that file exports nothing): the script-runner really runs progress.mjs and git.

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, '..', '..', '..');
const PROGRESS = join(PLUGIN, 'skills', 'plan-coordinator', 'scripts', 'progress.mjs').replace(/\\/g, '/');
const FIXTURE_PLAN = join(HERE, 'fixtures', 'two-waves', 'plan.md');
const FILE = join(HERE, 'coordinator.js');
const SRC = readFileSync(FILE, 'utf8').replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runWorkflow = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC);
const P = loadPure(FILE);

const IMPL = 'productivity-tools:implementer';
const REVIEWER = 'productivity-tools:task-reviewer';
const FINAL = 'productivity-tools:final-reviewer';
const RUNNER = 'productivity-tools:script-runner';
const LIMIT = 3500; // the copy limit, in UTF-8 bytes (MAX_COPY_BYTES of the workflow)
const SLICE = 3072;

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
const CHECK = `console.log('ok 1 - fine');\n`;
const GIT = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'];
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const bytes = (s) => Buffer.byteLength(s, 'utf8');

function sh(cwd, cmd, args) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

// A plan of n independent steps in one wave, built from the fixture; titleOf(k) makes the title of step k.
function widePlan(n, titleOf = (k) => `Módulo ${k}`) {
  const text = readFileSync(FIXTURE_PLAN, 'utf8').replace(/\r\n/g, '\n');
  const i = text.indexOf('```json data\n');
  const j = text.indexOf('\n```', i + 13);
  const data = JSON.parse(text.slice(i + 13, j));
  const tpl = data.tasks[0];
  data.tasks = Array.from({ length: n }, (_, k) => ({ ...tpl, n: k + 1, title: titleOf(k + 1), files: { create: [`src/m${k + 1}.mjs`], modify: [], test: [`tests/m${k + 1}.test.mjs`] }, produces: [], covers: k === 0 ? ['AC1'] : [] }));
  data.id = 'FX';
  const prose = ['# Plano FX -- Largo', '', 'SYNTHETIC FIXTURE', '', `Onda 1: T1 a T${n}, sem dependências.`, '', '## Tarefas', '',
    ...data.tasks.flatMap((t) => [`### Tarefa ${t.n}: ${t.title}`, '', `Escrever o teste de \`m${t.n}\`, ver falhar, implementar, ver passar.`, ''])];
  return prose.join('\n') + '\n## Bloco de dados\n\n```json data\n' + JSON.stringify(data, null, 2) + '\n```\n';
}

function sandbox(plan) {
  const dir = mkdtempSync(join(tmpdir(), 'coordsl-'));
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
  return { dir, planFile, stateFile: join(planDir, 'progress.json'), check: join(dir, 'check.mjs').replace(/\\/g, '/'), done: () => rmSync(dir, { recursive: true, force: true }) };
}
const readState = (sb) => JSON.parse(readFileSync(sb.stateFile, 'utf8'));
let tokenSeq = 0;
const launchArgs = (sb) => ({
  plan: sb.planFile.replace(/\\/g, '/'),
  state: sb.stateFile.replace(/\\/g, '/'),
  progress: PROGRESS,
  runToken: `tok-${process.pid}-${++tokenSeq}`,
  test: `node ${shq(sb.check)}`,
});

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

// over.runner(rec, res) may change an answer. Every call is recorded; a read of a slice also keeps the stdout the command printed.
function makeSim(sb, over = {}) {
  const calls = [];
  const agent = async (prompt, o) => {
    const rec = { seq: calls.length + 1, prompt, o };
    calls.push(rec);
    switch (o.agentType) {
      case RUNNER: {
        rec.cmd = prompt.split('\n')[1];
        const res = execLine(sb, rec.cmd);
        rec.printed = res.stdout;
        return (over.runner && over.runner(rec, res)) || res;
      }
      case IMPL: {
        rec.step = Number(/^T(\d+):/.exec(o.label)[1]);
        return { status: 'BLOCKED', summary: 'stop here: this test only reads', checks: [] };
      }
      case REVIEWER:
        return { issues: [], headSha: 'abc', clean: true, commitsInRange: 0, spec: 'pass', quality: 'pass' };
      case FINAL:
        return { issues: [], headSha: 'abc', clean: true, commitsInRange: 0 };
      default:
        throw new Error(`unexpected agentType ${o.agentType}`);
    }
  };
  const parallel = (fns) => Promise.all(fns.map((f) => f()));
  return { calls, go: (args) => runWorkflow(args, agent, parallel, () => {}, () => {}, {}) };
}

const withSandbox = async (plan, fn) => {
  const sb = sandbox(plan);
  try {
    await fn(sb);
  } finally {
    sb.done();
  }
};
const byAgent = (sim, type) => sim.calls.filter((c) => c.o.agentType === type);
const isRead = (c) => c.cmd !== undefined && / read /.test(c.cmd);
const sliceOf = (cmd) => { const m = / --slice (\d+) /.exec(cmd); return m ? Number(m[1]) : -1; };
// What a runtime that cuts every answer above the limit returns; for a read it also omits the exit code.
const cutter = (rec, res) => {
  const stdout = Buffer.byteLength(res.stdout, 'utf8') > LIMIT ? Buffer.from(res.stdout, 'utf8').subarray(0, LIMIT).toString('utf8') : res.stdout;
  return isRead(rec) ? { stdout } : { exit: res.exit, stdout };
};
// The reads of the first launch: from the first slice 0 up to the first command that is not a read.
const firstReads = (sim) => {
  const out = [];
  for (const c of byAgent(sim, RUNNER)) {
    if (!isRead(c)) break;
    out.push(c);
  }
  return out;
};

test('AC2a: a runner that cuts every answer above the copy limit and omits the exit still reads a 40-step plan, slice by slice', () => withSandbox(widePlan(40), async (sb) => {
  assert.ok(bytes(readFileSync(sb.stateFile, 'utf8')) > 15000, 'the state is big (about 19 KB)');
  let biggest = 0;
  const sim = makeSim(sb, { runner: (rec, res) => { if (isRead(rec)) biggest = Math.max(biggest, bytes(res.stdout.trim())); return cutter(rec, res); } });
  const args = launchArgs(sb);
  const r = await sim.go(args);
  assert.ok(byAgent(sim, IMPL).length > 0, 'the workflow went past the read to the first action: ' + JSON.stringify(r));
  const reads = firstReads(sim);
  const total = JSON.parse(reads[0].printed).slices;
  assert.ok(total >= 6, 'the state needs several slices: ' + total);
  assert.equal(reads.length, total, 'one read per slice, no repeat');
  assert.deepEqual(reads.map((c) => sliceOf(c.cmd)), Array.from({ length: total }, (_, k) => k));
  assert.ok(reads.every((c) => !/ --page /.test(c.cmd) && / --json$/.test(c.cmd)), 'no read by pages');
  assert.ok(biggest <= SLICE, `every envelope is up to ${SLICE} bytes: ${biggest}`);
  assert.deepEqual(reads.map((c) => c.o.label), reads.map((c, k) => `read-slice${k}`));
  // the nonce: the run token on slice 0, the hash of it plus a sequence on the others
  const nonceOf = (cmd) => tokenize(cmd)[tokenize(cmd).indexOf('--nonce') + 1];
  assert.equal(nonceOf(reads[0].cmd), args.runToken);
  const tag = fnv1a(args.runToken);
  for (const c of reads.slice(1)) assert.match(nonceOf(c.cmd), new RegExp(`^${tag}-\\d+$`));
  assert.ok(reads.every((c) => c.o.model === 'haiku'));
  assert.ok(reads.every((c) => nonceOf(c.cmd).length === args.runToken.length), 'every slice nonce has the length of the run token: the slice size depends on it');
}));

test('AC2a: a runner that summarizes one slice makes only that slice repeat, as read-slice<k>-retry2', () => withSandbox(widePlan(40), async (sb) => {
  const K = 3;
  let hit = false;
  const sim = makeSim(sb, {
    runner: (rec, res) => {
      if (isRead(rec) && sliceOf(rec.cmd) === K && !hit) {
        hit = true;
        return { stdout: res.stdout.slice(0, 300) + ' [...] (summarized by the agent)' };
      }
      return cutter(rec, res);
    },
  });
  await sim.go(launchArgs(sb));
  assert.ok(byAgent(sim, IMPL).length > 0);
  const reads = firstReads(sim);
  const total = JSON.parse(reads[0].printed).slices;
  assert.equal(reads.length, total + 1, 'one extra read');
  const labels = reads.map((c) => c.o.label);
  assert.equal(labels.filter((l) => /retry/.test(l)).length, 1);
  assert.equal(labels.filter((l) => l === `read-slice${K}-retry2`).length, 1);
  assert.equal(labels.filter((l) => l === `read-slice${K}`).length, 1);
  assert.deepEqual(reads.map((c) => sliceOf(c.cmd)), Array.from({ length: total + 1 }, (_, k) => (k <= K ? k : k - 1)));
  assert.equal(reads.find((c) => c.o.label === `read-slice${K}-retry2`).o.model, 'haiku');
}));

test('retries of a slice: haiku, haiku, then sonnet; three bad copies of one slice fail the read', () => withSandbox(widePlan(40), async (sb) => {
  const sim = makeSim(sb, { runner: (rec, res) => (isRead(rec) && sliceOf(rec.cmd) === 1 ? { stdout: 'no json here' } : cutter(rec, res)) });
  const r = await sim.go(launchArgs(sb));
  assert.equal(r.status, 'error', JSON.stringify(r));
  const s1 = byAgent(sim, RUNNER).filter((c) => isRead(c) && sliceOf(c.cmd) === 1);
  assert.deepEqual(s1.map((c) => [c.o.label, c.o.model]), [['read-slice1', 'haiku'], ['read-slice1-retry2', 'haiku'], ['read-slice1-retry3', 'sonnet']]);
  assert.equal(byAgent(sim, IMPL).length, 0);
}));

test('AC6 (C1): a title with multibyte characters and an emoji is read back as the same state, and the slices are xor-base64 of UTF-8 bytes', () => {
  const title = (k) => `${k} ` + '😀é漢ç'.repeat(150);
  return withSandbox(widePlan(8, title), async (sb) => {
    const onDisk = readState(sb);
    const sim = makeSim(sb, { runner: cutter });
    await sim.go(launchArgs(sb));
    assert.ok(byAgent(sim, IMPL).length > 0);
    const reads = firstReads(sim);
    assert.ok(reads.length >= 3, 'several slices: ' + reads.length);
    for (const c of reads) assert.ok(bytes(c.printed.trim()) <= SLICE, 'envelope above the limit: ' + bytes(c.printed.trim()));
    const joined = P.joinSlices(reads.map((c) => JSON.parse(c.printed)));
    assert.equal(joined.ok, true, joined.why);
    const got = JSON.parse(joined.text);
    assert.deepEqual(got.state, { ...onDisk, history: [] }, 'the state read back is the state on disk without history');
    assert.equal(got.stateDigest, P.stateDigest(got.state));
    assert.ok(got.state.steps.every((s) => s.title.includes('😀é漢ç')));
  });
});

test('AC6 (C1): characters cut on the boundary of a slice, whatever the byte offset', () => {
  const head = { tool: 'progress', command: 'read', nonce: 'n', now: '2026-01-01T00:00:00.000Z' };
  for (let pad = 0; pad < 8; pad++) {
    const text = 'x'.repeat(pad) + '😀é漢ç"\\\n'.repeat(1200);
    const envs = P.sliceEnvelopes(head, text);
    for (const e of envs) {
      assert.ok(bytes(JSON.stringify(e)) <= SLICE, `pad ${pad}: ${bytes(JSON.stringify(e))}`);
      assert.equal(e.enc, "xor-base64");
      assert.match(e.text, /^[A-Za-z0-9+/]*={0,2}$/, `pad ${pad}: the text is base64`);
    }
    const joined = P.joinSlices(envs);
    assert.equal(joined.ok, true, joined.why);
    assert.equal(joined.text, text);
  }
});

test('C2: the state changes between slice 0 and slice 3: the mixture is refused, the read restarts once, nothing is built from mixed slices', () => withSandbox(widePlan(40), async (sb) => {
  let changed = false;
  const sim = makeSim(sb, {
    runner: (rec, res) => {
      if (isRead(rec) && sliceOf(rec.cmd) === 0 && !changed) {
        changed = true;
        const st = readState(sb);
        st.steps[0].note = 'changed by someone else, with a longer note than before';
        writeFileSync(sb.stateFile, JSON.stringify(st, null, 2));
      }
      return cutter(rec, res);
    },
  });
  await sim.go(launchArgs(sb));
  assert.ok(byAgent(sim, IMPL).length > 0, 'the read restarted and finished');
  const reads = firstReads(sim);
  const starts = reads.map((c, i) => [sliceOf(c.cmd), i]).filter(([k]) => k === 0).map(([, i]) => i);
  assert.equal(starts.length, 2, 'the read restarts once: ' + reads.map((c) => sliceOf(c.cmd)).join(','));
  const firstRound = reads.slice(0, starts[1]);
  const secondRound = reads.slice(starts[1]);
  assert.equal(P.joinSlices(firstRound.map((c) => JSON.parse(c.printed))).ok, false, 'the first round is a mixture');
  const joined = P.joinSlices(secondRound.map((c) => JSON.parse(c.printed)));
  assert.equal(joined.ok, true, joined.why);
  assert.equal(JSON.parse(joined.text).state.steps[0].note, 'changed by someone else, with a longer note than before');
  assert.ok(reads.every((c) => !/retry/.test(c.o.label)), 'no slice was repeated: the restart is not a retry');
}));

test('C2: a state that keeps changing is not read: the restart happens once and the read fails', () => withSandbox(widePlan(40), async (sb) => {
  let n = 0;
  const sim = makeSim(sb, {
    runner: (rec, res) => {
      if (isRead(rec) && sliceOf(rec.cmd) === 0) {
        const st = readState(sb);
        st.steps[0].note = 'change ' + ++n;
        writeFileSync(sb.stateFile, JSON.stringify(st, null, 2));
      }
      return cutter(rec, res);
    },
  });
  const r = await sim.go(launchArgs(sb));
  assert.equal(r.status, 'error', JSON.stringify(r));
  assert.equal(byAgent(sim, IMPL).length, 0);
  assert.equal(firstReads(sim).filter((c) => sliceOf(c.cmd) === 0).length, 2, 'one restart and no more');
}));

test('E41 AC1: a test command of 400 lines (about 12.7 KB) runs through capture.mjs; the baseline event has the exit and the tail of the checked JSON', () => withSandbox(widePlan(2), async (sb) => {
  const big = join(sb.dir, 'big.mjs');
  const rows = Array.from({ length: 400 }, (_, i) => `# line ${String(i).padStart(3, '0')} ${'x'.repeat(20)}`);
  writeFileSync(big, `console.log(${JSON.stringify(rows.join('\n'))}); console.log('# tests 3'); console.log('# pass 3'); process.exit(0);\n`);
  const direct = spawnSync(process.execPath, [big], { encoding: 'utf8' });
  assert.ok(bytes(direct.stdout) > 12000, 'about 12.7 KB: ' + bytes(direct.stdout));
  let seen = null;
  const sim = makeSim(sb, {
    runner: (rec, res) => {
      if (/capture\.mjs' run /.test(rec.cmd)) { seen = JSON.parse(res.stdout); return cutter(rec, res); }
      return cutter(rec, res);
    },
  });
  const args = { ...launchArgs(sb), test: `node ${shq(big.replace(/\\/g, '/'))}` };
  await sim.go(args);
  assert.ok(seen, 'the test ran through capture.mjs');
  assert.equal(seen.exit, 0);
  assert.equal(seen.bytes, bytes(direct.stdout));
  assert.equal(seen.lines, 402);
  const base = readState(sb).run.baseline;
  assert.equal(base.exit, seen.exit);
  assert.equal(base.tail, seen.tail);
  assert.ok(base.tail.includes('# pass 3'));
  const gateCall = byAgent(sim, RUNNER).find((c) => c.o.label === 'baseline');
  assert.match(gateCall.cmd, /--tests --cwd /);
}));
