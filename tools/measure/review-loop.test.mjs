// E26 A1: the review-only script of --rounds loop embeds the measured workflow's pure block and runs its runReviewLoop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPure, checkLoopWorkflow, buildLoopScript, STAGE_LOOP, LOOP_RM, readArm, UsageError } from './run-batch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = join(here, '..', '..', 'plugins', 'productivity-tools', 'skills', 'roadmap-release', 'workflow', 'roadmap-release.js');
const WF = readFileSync(WORKFLOW, 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// The pure block by the loadPure rule, computed here independently of run-batch.
function pureOf(text) {
  const lines = text.split(/\r?\n/);
  const a = lines.findIndex((l) => l.trim() === '// <pure>');
  const b = lines.findIndex((l) => l.trim() === '// </pure>');
  return lines.slice(a + 1, b).join('\n');
}
const PURE = pureOf(WF);
const REPEAT = 'If an item of the previous round is still unresolved, report it again with the exact same file and description as listed';

const MEASURE = '\nMeasure: headSha, clean, commitsInRange.';
const script = (stage, extra = {}) =>
  buildLoopScript({ stage, pure: checkLoopWorkflow(WF, stage), reviewBody: 'Review the artifact. Roadmap folder ${RM}.', measure: MEASURE, fixPrompt: 'Fix it.\n{{issues}}\nCommit.', ...extra });

// Runs the generated script with a simulated agent: reviews answer from `reviews` (one per review call), fixes return a summary.
async function run(text, reviews) {
  const calls = [];
  let i = 0;
  const agent = async (prompt, o) => {
    calls.push({ prompt, ...o });
    if (/-fix\d+$/.test(o.label)) return '[fab] fixed';
    const issues = reviews[Math.min(i, reviews.length - 1)];
    i += 1;
    return { issues, headSha: 'f'.repeat(40), clean: true, commitsInRange: 1, measuredPlanBlob: 'b'.repeat(40), measuredSpecBlob: 'c'.repeat(40) };
  };
  const result = await new AsyncFunction('agent', text.replace('export const meta', 'const meta'))(agent);
  return { calls, result, seq: calls.map((c) => (/-fix/.test(c.label) ? `${c.label}(${c.model})` : c.label)) };
}

const hard = (d, category = 'defeito') => ({ severity: 'critical', category, description: d, file: 'docs/x.md' });
const minor = { severity: 'minor', category: 'defeito', description: '[fab] typo' };

test('A1: the loop script carries the pure block byte for byte, compiles and stays under 200,000 characters with the real arms', () => {
  const arm = (f) => readArm(join(here, 'arms', f)).text;
  for (const [stage, rev, fix] of [['spec-review', 'spec-review-atual.md', 'spec-fix-atual.md'], ['plan-review', 'plan-review-atual.md', 'plan-fix-atual.md']]) {
    const text = buildLoopScript({ stage, pure: checkLoopWorkflow(WF, stage), reviewBody: arm(rev), measure: MEASURE, fixPrompt: arm(fix) });
    assert.ok(text.includes('\n' + PURE + '\n'), stage);
    assert.ok(text.startsWith('export const meta = {'), stage);
    assert.ok(text.length <= 200000, `${stage}: ${text.length}`);
    assert.doesNotMatch(text, /^import /m);
    new AsyncFunction('agent', text.replace('export const meta', 'const meta'));
    assert.match(text, /runReviewLoop\(H_env, /);
  }
  assert.deepEqual(STAGE_LOOP['spec-review'], { tier: 'opus', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 });
  assert.deepEqual(STAGE_LOOP['plan-review'], { tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 });
});

test('A1: extractPure follows the loadPure rule (CRLF lines joined with LF) and hashes the block', () => {
  const crlf = WF.replace(/\r?\n/g, '\r\n');
  const p = extractPure(crlf);
  assert.equal(p.pure, PURE);
  assert.match(p.sha256, /^[0-9a-f]{64}$/);
  assert.equal(extractPure(WF).sha256, p.sha256);
});

test('A1: spec without a blocker runs one review', async () => {
  const r = await run(script('spec-review'), [[minor]]);
  assert.deepEqual(r.seq, ['E5:spec-review1']);
  assert.equal(r.result.ok, true);
  assert.equal(r.result.reviews.length, 1);
});

test('A1: spec blocker then clean runs review, fix, review and ends ok', async () => {
  const r = await run(script('spec-review'), [[hard('[fab] AC1 altered')], []]);
  assert.deepEqual(r.seq, ['E5:spec-review1', 'E5:spec-review-fix1(opus)', 'E5:spec-review2']);
  assert.equal(r.result.ok, true);
  const fix = r.calls[1];
  assert.equal(fix.effort, 'medium');
  assert.ok(fix.prompt.includes('1. [critical/defeito] docs/x.md [fab] AC1 altered'), fix.prompt);
  assert.ok(!fix.prompt.includes('{{issues}}'));
});

test('A1: spec repeated finding stops at once (fixer already at opus) with conteudo', async () => {
  const r = await run(script('spec-review'), [[hard('[fab] same')], [hard('[fab] same')]]);
  assert.deepEqual(r.seq, ['E5:spec-review1', 'E5:spec-review-fix1(opus)', 'E5:spec-review2']);
  assert.equal(r.result.ok, false);
  assert.equal(r.result.kind, 'conteudo');
  const d = await run(script('spec-review'), [[hard('[fab] gate', 'decisao')], [hard('[fab] gate', 'decisao')]]);
  assert.equal(d.result.kind, 'decisao');
});

test('A1: plan repeated finding escalates the fixer to opus with a bonus round, then stops', async () => {
  const r = await run(script('plan-review'), [[hard('[fab] same')], [hard('[fab] same')], [hard('[fab] same')]]);
  assert.deepEqual(r.seq, ['E5:plan-review1', 'E5:plan-review-fix1(sonnet)', 'E5:plan-review2', 'E5:plan-review-fix2(opus)', 'E5:plan-review3']);
  assert.equal(r.result.ok, false);
  assert.equal(r.result.kind, 'conteudo');
});

test('A1: plan findings that always differ stop after 2 fixes', async () => {
  let n = 0;
  const reviews = Array.from({ length: 6 }, () => [hard(`[fab] finding ${++n}`)]);
  const r = await run(script('plan-review'), reviews);
  assert.deepEqual(r.seq, ['E5:plan-review1', 'E5:plan-review-fix1(sonnet)', 'E5:plan-review2', 'E5:plan-review-fix2(sonnet)', 'E5:plan-review3']);
  assert.equal(r.result.ok, false);
});

test('A1: the reviewer is always opus/medium, round 2 on carries repeatRule, and the plan loop prompt has no ${RM}', async () => {
  const r = await run(script('plan-review'), [[hard('[fab] same')], [hard('[fab] same')], [hard('[fab] same')]]);
  const reviews = r.calls.filter((c) => !/-fix/.test(c.label));
  for (const c of reviews) {
    assert.equal(c.model, 'opus');
    assert.equal(c.effort, 'medium');
    assert.ok(c.schema && c.schema.required.includes('measuredPlanBlob'));
    assert.ok(!c.prompt.includes('${RM}'), c.prompt);
    assert.ok(c.prompt.includes(`Roadmap folder ${LOOP_RM}.`));
    assert.ok(c.prompt.endsWith(MEASURE));
  }
  assert.ok(!reviews[0].prompt.includes(REPEAT));
  for (const c of reviews.slice(1)) assert.ok(c.prompt.includes(`\nIssues from the previous round (${REPEAT}`), c.prompt);
  assert.equal(LOOP_RM, 'docs/plans/roadmap-sandbox/');
});

test('A1: a null review after the retry ends the loop as infra', async () => {
  const text = script('spec-review');
  const labels = [];
  const res = await new AsyncFunction('agent', text.replace('export const meta', 'const meta'))(async (p, o) => {
    labels.push(o.label);
    return null;
  });
  assert.deepEqual(labels, ['E5:spec-review1', 'E5:spec-review1b']);
  assert.equal(res.ok, false);
  assert.equal(res.kind, 'infra');
});

test('A1: refusals: no runReviewLoop, no intArg(A.maxFixRounds, 2, 0), stage literal only outside the stage slice', () => {
  assert.throws(() => checkLoopWorkflow(WF.replace('async function runReviewLoop(', 'async function runReviewLoopX('), 'spec-review'), (e) => e instanceof UsageError && /runReviewLoop/.test(e.message));
  assert.throws(() => checkLoopWorkflow(WF.replace('// <pure>', '// pure'), 'spec-review'), (e) => e instanceof UsageError && /pure/.test(e.message));
  assert.throws(() => checkLoopWorkflow(WF.replace('intArg(A.maxFixRounds, 2, 0)', 'intArg(A.maxFixRounds, 3, 0)'), 'plan-review'), (e) => e instanceof UsageError && /maxFixRounds/.test(e.message));
  // the plan literal stays in the delta and final stages: only the plan stage slice counts
  const at = WF.indexOf("reviewLoop('plan',");
  const next = WF.indexOf('reviewLoop(', at + 1);
  const slice = WF.slice(at, next);
  const lit = "{ tier: 'sonnet', reviewModel: 'opus' })";
  assert.ok(slice.includes(lit));
  const drifted = WF.slice(0, at) + slice.replace(lit, "{ tier: 'haiku', reviewModel: 'opus' })") + WF.slice(next);
  assert.ok(drifted.includes(lit), 'the literal is still elsewhere in the workflow');
  assert.throws(() => checkLoopWorkflow(drifted, 'plan-review'), (e) => e instanceof UsageError && /plan/.test(e.message));
  assert.doesNotThrow(() => checkLoopWorkflow(drifted, 'spec-review'));
  const sAt = WF.indexOf("reviewLoop('spec',");
  const sNext = WF.indexOf('reviewLoop(', sAt + 1);
  const sDrift = WF.slice(0, sAt) + WF.slice(sAt, sNext).replace("{ tier: 'opus', reviewModel: 'opus' })", "{ tier: 'sonnet', reviewModel: 'opus' })") + WF.slice(sNext);
  assert.throws(() => checkLoopWorkflow(sDrift, 'spec-review'), UsageError);
  assert.throws(() => checkLoopWorkflow(WF, 'task-review'), UsageError);
});

test('A1: a generated script over 200,000 characters is refused', () => {
  const pure = checkLoopWorkflow(WF, 'spec-review') + '\n// ' + 'x'.repeat(200000);
  assert.throws(() => buildLoopScript({ stage: 'spec-review', pure, reviewBody: 'R', measure: MEASURE, fixPrompt: 'F {{issues}}' }), (e) => e instanceof UsageError && /200,?000/.test(e.message));
});
