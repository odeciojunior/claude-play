import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canon, sliceEnvelopes, utf8Length, MAX_COPY_BYTES } from '../../../lib/plan-digest.mjs';

// E41 B2 T1: roadmap-release.js reads the discovery slice by slice (preflight.mjs discover --slice k), every answer fits the copy limit,
// only the slice that came back wrong is repeated, and slices of different reads are never mixed. The fake runner below answers each
// script-runner call with the real sliceEnvelopes of the lib; a copy above the limit reaches the workflow cut, without an exit.

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8').replace('export const meta', 'const meta');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runWorkflow = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'budget', SRC);
const TOOL_PATH = '/p/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs';
const HEAD = (nonce) => ({ tool: 'release-discovery', command: 'discover', nonce });

const META = { repo: '/r', today: '2026-11-09', roadmapDir: 'docs/plans/roadmap-x/', strategy: 'docs/plans/roadmap-x/s.md', checker: 'docs/plans/roadmap-x/check.mjs', integrationBranch: 'main', target: 'integracao/x', checkerExists: true, roadmapSlug: 'x', deliverableStatuses: ['a', 'b', 'c', 'd', 'e'], integratedStatuses: ['integrada', 'publicada', 'medida'], language: '', pendingDecisions: [] };
const mkCard = (i, mark = 'a') => ({ id: `E${i}`, deps: [], reqs: ['R1'], status: 'pronta', onTarget: false, mergeFound: false, critical: false, title: `Cartão ${i} ação ${mark}`, acceptance: [{ id: 'AC1', text: `funciona ${'ç'.repeat(150)}` }] });
const N = 30;
const dataOf = (mark = 'a') => ({ ...META, cards: Array.from({ length: N }, (_, i) => mkCard(i + 1, i === 25 ? mark : 'a')) });
const SLICES = sliceEnvelopes(HEAD('pf-test'), JSON.stringify(canon(dataOf()))).length;

// alt(k, redo) picks the data of the slice (default: the same read); over(label, k, answer, prompt) may replace the answer.
async function drive({ alt = () => dataOf(), over } = {}) {
  const calls = [];
  let maxBytes = 0;
  const agent = async (prompt, o) => {
    calls.push({ label: o.label, prompt, opts: o });
    if (!/^discovery/.test(o.label)) throw new Error(`unexpected call ${o.label}`);
    const nonce = /--nonce '([^']*)'/.exec(prompt)[1];
    const k = Number(/--slice (\d+)/.exec(prompt)[1]);
    const envs = sliceEnvelopes(HEAD(nonce), JSON.stringify(canon(alt(k, /^discovery-redo/.test(o.label)))));
    let res = k < envs.length ? { exit: 0, stdout: `${JSON.stringify(envs[k])}\n` } : { exit: 1, stdout: JSON.stringify({ tool: 'release-discovery', error: 'no such slice' }) };
    if (utf8Length(res.stdout) > MAX_COPY_BYTES) res = { stdout: res.stdout.slice(0, MAX_COPY_BYTES) };
    maxBytes = Math.max(maxBytes, utf8Length(res.stdout));
    if (over) { const v = over(o.label, k, res, prompt); if (v !== undefined) return v; }
    return res;
  };
  const parallel = (ts) => Promise.all(ts.map((t) => t().catch(() => null)));
  const r = await runWorkflow({ config: { gates: [{ name: 'lint', cmd: 'npm run lint', kind: 'exit' }], locks: [], projectContext: '', install: '', generated: true }, deliverables: [`E${N}`], mode: 'dry-run', targetBranch: 'integracao/x', today: '2026-11-09', runToken: 'pf-test', wtRoot: '/wt', trackerCli: TOOL_PATH },
    agent, parallel, () => {}, () => {}, { total: null });
  return { r, calls, labels: calls.map((c) => c.label), maxBytes };
}
const sliceLabels = (n) => ['discovery', ...Array.from({ length: n - 1 }, (_, i) => `discovery-slice${i + 1}`)];
// The text of a slice is xor-base64: a copy that changes one character of it (the digest must catch it).
const tamper = (res) => ({ exit: 0, stdout: res.stdout.replace(/("text":")(.)/, (m, a, c) => a + (c === 'A' ? 'B' : 'A')) });

test('a big discovery is read slice by slice, each answer within the copy limit, and the cards are joined', async () => {
  assert.ok(SLICES >= 4, `the synthetic roadmap has ${SLICES} slices`);
  const x = await drive();
  assert.equal(x.r.status, 'done', JSON.stringify(x.r));
  assert.deepEqual(x.labels, sliceLabels(SLICES));
  assert.deepEqual(x.r.selection.order, [`E${N}`], 'the card of the last slice reached the selection');
  assert.ok(x.maxBytes <= MAX_COPY_BYTES, `largest answer ${x.maxBytes}`);
  const nonces = x.calls.map((c) => /--nonce '([^']*)'/.exec(c.prompt)[1]);
  assert.equal(nonces[0], 'pf-test', 'slice 0 carries the run token and is the first agent() call');
  assert.equal(new Set(nonces).size, nonces.length, 'every slice has its own nonce');
  assert.ok(nonces.slice(1).every((n) => !n.includes('pf-test')), 'the run token stays in the first read');
  assert.equal(new Set(nonces.map((n) => n.length)).size, 1, 'the cut points of sliceEnvelopes depend on the nonce length: one length per read, or the slices would not line up');
  x.calls.forEach((c, k) => {
    assert.match(c.prompt, new RegExp(`preflight\\.mjs" discover .* --slice ${k}\\n`));
    assert.doesNotMatch(c.prompt, /--page/);
    assert.equal(c.opts.agentType, 'productivity-tools:script-runner');
    assert.deepEqual(c.opts.schema.required, ['exit', 'stdout']);
  });
});

test('a tampered envelope repeats only its own slice', async () => {
  const x = await drive({ over: (l, k, res) => (l === 'discovery-slice2' ? tamper(res) : undefined) });
  assert.equal(x.r.status, 'done');
  const want = sliceLabels(SLICES);
  want.splice(3, 0, 'discovery-slice2-retry2');
  assert.deepEqual(x.labels, want);
  assert.equal(x.calls.find((c) => c.label === 'discovery-slice2-retry2').opts.model, 'haiku');
});

test('a slice that never matches its digest is tried 5 times (haiku twice, then sonnet) and stops the run', async () => {
  const x = await drive({ over: (l, k, res) => (/^discovery-slice1/.test(l) ? tamper(res) : undefined) });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /^discovery failed: slice 1: .*digest/);
  const s1 = x.calls.filter((c) => /^discovery-slice1/.test(c.label));
  assert.deepEqual(s1.map((c) => c.label), ['discovery-slice1', 'discovery-slice1-retry2', 'discovery-slice1-retry3', 'discovery-slice1-retry4', 'discovery-slice1-retry5']);
  assert.deepEqual(s1.map((c) => c.opts.model), ['haiku', 'haiku', 'sonnet', 'sonnet', 'sonnet']);
  assert.deepEqual(x.labels.slice(0, 2), ['discovery', 'discovery-slice1']);
});

test('C2: slices of different reads are refused, the read is dropped and restarted once', async () => {
  const mixed = (k, redo) => (!redo && k >= 2 ? dataOf('b') : dataOf());
  const x = await drive({ alt: mixed });
  assert.equal(x.r.status, 'done', JSON.stringify(x.r));
  const redo = ['discovery-redo', ...Array.from({ length: SLICES - 1 }, (_, i) => `discovery-redo-slice${i + 1}`)];
  assert.deepEqual(x.labels, [...sliceLabels(SLICES), ...redo]);
  assert.equal(/--nonce '([^']*)'/.exec(x.calls[SLICES].prompt)[1], 'pf-test');
  const never = await drive({ alt: (k) => (k >= 2 ? dataOf('b') : dataOf()) });
  assert.equal(never.r.status, 'error');
  assert.match(never.r.error, /^discovery failed: the slices come from different reads/);
  assert.equal(never.calls.length, 2 * SLICES, 'one restart, no more');
});

test('a copy above the copy limit is refused before JSON.parse, naming the limit', async () => {
  const x = await drive({ over: (l) => (l === 'discovery' || l.startsWith('discovery-retry') ? { exit: 0, stdout: 'x'.repeat(MAX_COPY_BYTES + 500) } : undefined) });
  assert.equal(x.r.status, 'error');
  assert.match(x.r.error, /^discovery failed: slice 0: the output is larger than the copy limit/);
  assert.doesNotMatch(x.r.error, /JSON/);
  assert.equal(x.calls.length, 5);
  const ok = await drive({ over: (l) => (l === 'discovery' ? { exit: 0, stdout: ' '.repeat(MAX_COPY_BYTES + 500) } : undefined) });
  assert.equal(ok.r.status, 'done', 'a copy that is only trailing whitespace past the limit is measured trimmed, as capture does');
});

test('a refusal of the script and an envelope of another command are named', async () => {
  const refused = await drive({ over: () => ({ exit: 1, stdout: JSON.stringify({ tool: 'release-discovery', error: 'no roadmap folder' }) }) });
  assert.match(refused.r.error, /^discovery failed: slice 0: release-discovery refused: no roadmap folder/);
  const other = await drive({ over: (l, k, res) => ({ exit: 0, stdout: res.stdout.replace('"command":"discover"', '"command":"read"') }) });
  assert.match(other.r.error, /^discovery failed: slice 0: the slice is from another command/);
});
