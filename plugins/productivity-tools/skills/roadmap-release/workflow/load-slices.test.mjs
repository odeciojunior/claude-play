import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync, readdirSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canon, sliceEnvelopes, utf8Length, MAX_COPY_BYTES, planDigest } from '../../../lib/plan-digest.mjs';
import { route } from '../../../lib/routing.mjs';
import { gitBash } from '../../../scripts/git-bash.mjs';
import { loadPure } from './load-pure.mjs';

// E41 B2 T4: the spec load and the plan load of roadmap-release.js run each command by capture.mjs run and read an output that does not fit the copy
// limit back by capture.mjs slice. The fake runner below executes the real capture.mjs on real files of a temporary repository (the spec-tool and
// plan-tool of the temporary plugin root only print a prepared emit) and cuts every answer above the copy limit the way a model's copy would be cut.

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, '..', '..', '..');
const SRC = readFileSync(join(HERE, 'roadmap-release.js'), 'utf8').replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runWorkflow = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC);
const fwd = (p) => String(p).replace(/\\/g, '/');
const BASH = gitBash();
const NEEDS_BASH = { skip: BASH ? false : 'Git Bash não encontrado; instale o Git ou defina PT_BASH' };
const git = (cwd, ...a) => { const r = spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };

const META = { repo: '/r', today: '2026-11-09', roadmapDir: 'docs/plans/roadmap-x/', strategy: 'docs/plans/roadmap-x/s.md', checker: 'docs/plans/roadmap-x/check.mjs', integrationBranch: 'main', target: 'integracao/x', checkerExists: true, roadmapSlug: 'x', deliverableStatuses: ['a', 'b', 'c', 'd', 'e'], integratedStatuses: ['integrada', 'publicada', 'medida'], language: '', pendingDecisions: [] };
const CARD = { id: 'E1', deps: [], reqs: ['R1'], status: 'pronta', onTarget: false, mergeFound: false, critical: false, acceptance: [{ id: 'AC1', text: 'works' }] };
const FILLER = 'a coleção é lida por fatias, cada cópia cabe no limite da cópia do agente ';

// A spec/1 emit of 19 KB or more (the edge cases are free text) and a plan/1 emit of the same size (long titles, many files).
const specEmit = () => JSON.stringify({ tool: 'spec-tool', schema: 'spec/1', path: 'x', data: { id: 'E1', title: 't', mode: 'unattended', acceptance: [{ id: 'AC1', text: 'works', verify: null, textWithoutTag: 'works' }], rulings: [], needsPerson: [], externalEffects: [], edgeCases: Array.from({ length: 60 }, (_, i) => `caso ${i}: ${FILLER.repeat(5)}`) } }, null, 2);
function planEmit() {
  const score = { ambiguity: 1, reasoning: 1, blast: 1, verifiability: 0 };
  const plan = { schema: 'plan/1', id: 'E1', roadmap: 'docs/plans/roadmap-x/', tasks: [], evidence: [{ ac: 'AC1', kind: 'test', command: 'npm test -- a', testRef: null, blq: null, external: false, externalDedupe: null }] };
  plan.tasks = Array.from({ length: 30 }, (_, i) => {
    const t = { n: i + 1, title: `tarefa ${i + 1}: ${FILLER.repeat(3)}`, files: { create: [], modify: [`src/${'dir/'.repeat(6)}arquivo-${i + 1}.js`], test: [`src/${'dir/'.repeat(6)}arquivo-${i + 1}.test.js`] }, locks: [], external: false, externalDedupe: null, noCommit: false, deps: [], score };
    return { ...t, route: route(t, { hasDependents: false }) };
  });
  const source = { path: 'plan.md', textDigest: 'abcd1234' };
  return JSON.stringify({ tool: 'plan-tool', schema: 'plan/1', path: 'plan.md', source, plan, digest: planDigest({ plan, source }) }, null, 2);
}

const FAKE_TOOL = (name) => `import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[2] === 'check') process.stdout.write(JSON.stringify({ tool: '${name}', summary: { exitCode: 0 }, errors: [] }) + '\\n');
else process.stdout.write(fs.readFileSync(path.join(dir, '${name}-emit.json')));
`;

// One temporary plugin root (real capture.mjs, fake spec-tool and plan-tool) and one repository in <wtRoot>/E1.
function world() {
  const root = fwd(mkdtempSync(join(tmpdir(), 'load-slices-')));
  const plugin = `${root}/plugin`;
  mkdirSync(`${plugin}/scripts`, { recursive: true });
  mkdirSync(`${plugin}/lib`, { recursive: true });
  for (const f of ['capture.mjs', 'test-extract.mjs']) cpSync(join(PLUGIN, 'scripts', f), `${plugin}/scripts/${f}`);
  cpSync(join(PLUGIN, 'lib', 'plan-digest.mjs'), `${plugin}/lib/plan-digest.mjs`);
  for (const name of ['spec-tool', 'plan-tool']) writeFileSync(`${plugin}/scripts/${name}.mjs`, FAKE_TOOL(name));
  writeFileSync(`${plugin}/scripts/spec-tool-emit.json`, specEmit());
  writeFileSync(`${plugin}/scripts/plan-tool-emit.json`, planEmit());
  const repo = (name) => {
    const dir = `${root}/${name}`;
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
    return dir;
  };
  mkdirSync(`${root}/wt`);
  const wt = repo('wt/E1');
  return { root, plugin, wt, other: repo('other'), clean: () => rmSync(root, { recursive: true, force: true }) };
}

const HEAD = (nonce) => ({ tool: 'release-discovery', command: 'discover', nonce });
const SPEC_EMIT_BYTES = utf8Length(specEmit());
const PLAN_EMIT_BYTES = utf8Length(planEmit());

// hook(info) may return an answer instead of the real one: info = { label, cmd, kind: 'run' | 'slice', n (calls of that label family so far), answer }.
async function drive({ hook, config = {} } = {}) {
  const w = world();
  const calls = [];
  let planBlob = '';
  const answers = [];
  const bash = (cmd) => { const r = spawnSync(BASH, ['-c', cmd], { encoding: 'utf8' }); return { exit: r.status ?? 1, stdout: r.stdout }; };
  const seen = {};
  const agent = async (prompt, o) => {
    const l = o.label;
    calls.push({ label: l, prompt, opts: o });
    const E = 'E1';
    if (/^discovery/.test(l)) {
      const nm = /--nonce (?:'((?:[^']|'\\'')*)'|([^\s']+))/.exec(prompt); // E46: shq writes the value quoted or bare
      const nonce = nm[1] ?? nm[2];
      const k = Number(/--slice (\d+)/.exec(prompt)[1]);
      const envs = sliceEnvelopes(HEAD(nonce), JSON.stringify(canon({ ...META, cards: [CARD] })));
      return { exit: 0, stdout: JSON.stringify(envs[k]) };
    }
    const cm = /^(node ".*capture\.mjs" (run|slice) .*)$/m.exec(prompt);
    if (cm && /^E1:(spec|plan)-load/.test(l)) {
      const cmd = cm[1];
      const fam = `${cm[2]}:${l.replace(/-retry\d$/, '')}`;
      const n = (seen[fam] = (seen[fam] || 0) + 1);
      const real = bash(cmd);
      let ans = { exit: real.exit, stdout: real.stdout };
      const info = { label: l, cmd, kind: cm[2], n, answer: ans, world: w };
      const v = hook ? hook(info) : undefined;
      if (v !== undefined) ans = v;
      answers.push({ label: l, bytes: utf8Length(String(ans.stdout || '')), cmd });
      if (utf8Length(String(ans.stdout || '')) > MAX_COPY_BYTES) ans = { stdout: String(ans.stdout).slice(0, MAX_COPY_BYTES) };
      return ans;
    }
    if (l === 'preflight') return { ok: true, integrationWorktree: `${w.root}/wt/_integracao`, targetHead: 'abc1234'.padEnd(40, '0'), clean: true, envFacts: 'x' };
    if (l === 'discovery-donot') return { donotHolds: [] };
    if (l === `${E}:setup`) return { ok: true, worktree: w.wt, baseCommit: 'b1', head: git(w.wt, 'rev-parse', 'HEAD'), clean: true, taskCommits: 0, committedTasks: [], nativeSpec: false, nativePlan: false };
    if (l === `${E}:spec`) return 'spec written';
    if (l === `${E}:plan`) {
      const abs = /^output: (.*)$/m.exec(prompt)[1];
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, '# plan\n');
      git(w.wt, 'add', '-A');
      git(w.wt, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'plan');
      planBlob = git(w.wt, 'rev-parse', `HEAD:${/(docs\/[^ ]*plan\.md)$/.exec(abs)[1]}`);
      return 'plan written';
    }
    const head = () => git(w.wt, 'rev-parse', 'HEAD');
    if (/:spec-commit$/.test(l)) return { ok: true, head: head(), commit: head() };
    if (/:plan-commit$/.test(l)) return { ok: true, head: head(), commit: head(), blob: planBlob };
    if (/plan-review/.test(l)) return { issues: [], headSha: head(), clean: true, commitsInRange: 2, measuredPlanBlob: planBlob };
    if (/spec-review/.test(l)) return { issues: [], headSha: head(), clean: true, commitsInRange: 2 };
    return null;
  };
  const parallel = (ts) => Promise.all(ts.map((t) => t().catch(() => null)));
  try {
    const r = await runWorkflow({ config: { gates: [{ name: 'lint', cmd: 'npm run lint', kind: 'exit' }], locks: [], projectContext: '', install: '', generated: true, ...config }, deliverables: ['E1'], mode: 'plan-only', targetBranch: 'integracao/x', today: '2026-11-09', runToken: 'pf-test', wtRoot: `${w.root}/wt`, trackerCli: `${w.plugin}/skills/roadmap-tracker/scripts/roadmap.mjs` },
      agent, parallel, () => {}, () => {}, { total: null });
    return { r, calls, labels: calls.map((c) => c.label), answers, world: w, planBlob };
  } finally {
    w.clean();
  }
}

const loadLabels = (labels) => labels.filter((l) => /^E1:(spec|plan)-load/.test(l));
const sliceCount = (labels, load) => labels.filter((l) => new RegExp(`^E1:${load}1-emit-slice\\d+$`).test(l)).length;

test('a spec emit and a plan emit of 19 KB or more are put back by slices and the stages go on (checkSpecLoad and checkPlanLoad accept them)', NEEDS_BASH, async () => {
  assert.ok(SPEC_EMIT_BYTES >= 19 * 1024, `spec emit ${SPEC_EMIT_BYTES}`);
  assert.ok(PLAN_EMIT_BYTES >= 19 * 1024, `plan emit ${PLAN_EMIT_BYTES}`);
  const x = await drive();
  assert.ok(x.labels.includes('E1:spec-commit'), `the spec load was accepted: ${x.labels.join(' ')} ${JSON.stringify(x.r)}`);
  assert.ok(x.labels.includes('E1:plan-commit'), `the plan load was accepted: ${x.labels.join(' ')}`);
  assert.ok(!x.labels.includes('E1:spec-load2') && !x.labels.includes('E1:plan-load2'), 'no load was repeated');
  assert.ok(sliceCount(x.labels, 'spec-load') >= 6, `spec slices: ${sliceCount(x.labels, 'spec-load')}`);
  assert.ok(sliceCount(x.labels, 'plan-load') >= 6, `plan slices: ${sliceCount(x.labels, 'plan-load')}`);
  assert.ok(x.answers.length > 0 && x.answers.every((a) => a.bytes <= MAX_COPY_BYTES), `largest answer ${Math.max(...x.answers.map((a) => a.bytes))}`);
  const first = x.calls.find((c) => c.label === 'E1:spec-load1');
  assert.equal(first.opts.agentType, 'productivity-tools:script-runner');
  assert.match(first.prompt, /capture\.mjs" run --nonce \S+ --task E1-load --cwd \S+ -- /);
});

test('the labels follow the commands: spec-load<k>, -emit, -blob (E37 R3), -head, -porcelain, plan-load<k>, -emit, -blob, -head, -porcelain and -emit-slice<j>', NEEDS_BASH, async () => {
  const x = await drive();
  const L = loadLabels(x.labels);
  assert.deepEqual(L.filter((l) => !/-slice\d+$/.test(l)), ['E1:spec-load1', 'E1:spec-load1-emit', 'E1:spec-load1-blob', 'E1:spec-load1-head', 'E1:spec-load1-porcelain', 'E1:plan-load1', 'E1:plan-load1-emit', 'E1:plan-load1-blob', 'E1:plan-load1-head', 'E1:plan-load1-porcelain']);
  assert.ok(L.includes('E1:spec-load1-emit-slice0') && L.includes('E1:spec-load1-emit-slice1'));
  assert.ok(L.indexOf('E1:spec-load1-emit') < L.indexOf('E1:spec-load1-emit-slice0') && L.indexOf('E1:spec-load1-emit-slice0') < L.indexOf('E1:spec-load1-head'));
});

test('head, blob and porcelain come from the checked tail (tailCut 0): they have no slices', NEEDS_BASH, async () => {
  const x = await drive();
  assert.ok(!loadLabels(x.labels).some((l) => /-(head|blob|porcelain)(-|$)/.test(l) && /-slice\d+$/.test(l)));
  assert.ok(!x.calls.some((c) => /capture\.mjs" slice/.test(c.prompt) && /-(head|blob|porcelain)/.test(c.label)));
});

test('the slice command passes only the first 12 hex of the sha256 (short argv), not the 64', NEEDS_BASH, async () => {
  const x = await drive();
  const shas = x.calls.filter((c) => /capture\.mjs" slice/.test(c.prompt)).map((c) => /--sha (\S+)/.exec(c.prompt)[1]);
  assert.ok(shas.length > 0);
  for (const s of shas) assert.match(s, /^[0-9a-f]{12}$/, s);
});

test('capture.mjs run and capture.mjs slice get the same --cwd, the worktree of the deliverable', NEEDS_BASH, async () => {
  const x = await drive();
  const cwds = x.calls.filter((c) => /^E1:(spec|plan)-load/.test(c.label)).map((c) => /capture\.mjs" (run|slice) .* --cwd (\S+)/.exec(c.prompt)).map((m) => `${m[1]}:${m[2]}`);
  assert.ok(cwds.some((c) => c.startsWith('slice:')) && cwds.some((c) => c.startsWith('run:')));
  assert.equal(new Set(cwds.map((c) => c.split(':').slice(1).join(':'))).size, 1, [...new Set(cwds)].join(' '));
  assert.match(cwds[0], /\/wt\/E1'?$/);
});

test('a slice of another repository is not found: the slice is refused and the load fails after its five attempts', NEEDS_BASH, async () => {
  const { shq } = loadPure();
  const swaps = []; // checked after the run: an assertion inside the hook can be swallowed by the workflow
  const x = await drive({ hook: ({ cmd, kind, world }) => {
    if (kind !== 'slice') return undefined;
    const other = cmd.replace(/--cwd (?:'(?:[^']|'\\'')*'|[^\s']+)/, () => `--cwd ${shq(world.other)}`);
    swaps.push([cmd, other]);
    const r = spawnSync(BASH, ['-c', other], { encoding: 'utf8' });
    return { exit: r.status ?? 1, stdout: r.stdout };
  } });
  assert.ok(swaps.length >= 1, 'the --cwd of a slice command was swapped');
  for (const [before, after] of swaps) assert.notEqual(after, before);
  assert.match(x.r.results[0].error, /spec load/);
  assert.ok(!x.labels.includes('E1:spec-commit'));
  assert.deepEqual(loadLabels(x.labels).filter((l) => /^E1:spec-load\d$/.test(l)), [1, 2, 3, 4, 5].map((k) => `E1:spec-load${k}`));
  assert.ok(x.calls.filter((c) => /capture\.mjs" slice/.test(c.prompt)).length >= 5);
});

test('a state that changes between two calls of a read (the sha of the file moves) is refused: the load starts again from load3, never mixing slices', NEEDS_BASH, async () => {
  const x = await drive({ hook: ({ label, kind, n, world, cmd }) => {
    if (kind === 'slice' && label === 'E1:spec-load1-emit-slice2' && n === 1) {
      const dir = `${git(world.wt, 'rev-parse', '--absolute-git-dir')}/pt-evidence/E1-load`;
      const f = readdirSync(dir).filter((x) => /-stdout\.txt$/.test(x)).sort()[1];
      appendFileSync(`${dir}/${f}`, ' ');
    }
    return undefined;
  } });
  assert.ok(x.labels.includes('E1:spec-load2'), x.labels.join(' '));
  assert.ok(!x.labels.includes('E1:spec-load3'));
  assert.ok(x.labels.includes('E1:plan-commit'), 'the second attempt was accepted and the plan stage ran');
});

test('a slice that came back summarized in the first copy is repeated alone, the other slices are not read again', NEEDS_BASH, async () => {
  const x = await drive({ hook: ({ label, kind, n, answer }) => (kind === 'slice' && label === 'E1:spec-load1-emit-slice2' && n === 1 ? { exit: 0, stdout: answer.stdout.replace(/"text": ?"[^]{20}[^]*?"/, '"text":"[...]"') } : undefined) });
  assert.deepEqual(x.labels.filter((l) => /^E1:spec-load1-emit-slice\d+-retry\d$/.test(l)), ['E1:spec-load1-emit-slice2-retry2']);
  assert.ok(!x.labels.includes('E1:spec-load2'));
  assert.equal(x.labels.filter((l) => l === 'E1:spec-load1-emit-slice1').length, 1);
  assert.ok(x.labels.includes('E1:plan-commit'));
});
