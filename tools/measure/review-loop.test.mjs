// E26 A1: the review-only script of --rounds loop embeds the measured workflow's pure block and runs its runReviewLoop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPure, checkLoopWorkflow, buildLoopScript, buildTaskLoopScript, buildFinalLoopScript, STAGE_LOOP, LOOP_RM, readArm, UsageError } from './run-batch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = join(here, '..', '..', 'plugins', 'productivity-tools', 'skills', 'roadmap-release', 'workflow', 'roadmap-release.js');
const WF = readFileSync(WORKFLOW, 'utf8');
// fixture congelada: roadmap-release.js em ccac3c5, antes de E29; só o braço unica a lê
const WF_SINGLE = readFileSync(join(here, 'fixtures', 'workflow-com-single', 'roadmap-release.js'), 'utf8');
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
  assert.doesNotThrow(() => checkLoopWorkflow(WF, 'final-review')); // the final stage has its loop since B3, as task-review since B2
  assert.throws(() => checkLoopWorkflow(WF, 'not-a-stage'), UsageError);
});

test('A1 review: a reviewer or fixer model/effort change inside the stage slice is drift too', () => {
  const inSlice = (stage, from, to) => {
    const call = stage === 'spec-review' ? "reviewLoop('spec'," : "reviewLoop('plan',";
    const at = WF.indexOf(call);
    const next = WF.indexOf('reviewLoop(', at + 1);
    const slice = WF.slice(at, next);
    assert.ok(slice.includes(from), `${stage}: ${from}`);
    return WF.slice(0, at) + slice.replace(from, to) + WF.slice(next);
  };
  const REVIEW = "model: 'opus', effort: 'medium' }";
  const FIX = 'model: tier, effort: effortFor(tier) }';
  for (const stage of ['spec-review', 'plan-review']) {
    assert.throws(() => checkLoopWorkflow(inSlice(stage, REVIEW, "model: 'opus', effort: 'high' }"), stage), (e) => e instanceof UsageError && /reviewer/.test(e.message), stage);
    assert.throws(() => checkLoopWorkflow(inSlice(stage, REVIEW, "model: 'sonnet', effort: 'medium' }"), stage), UsageError, stage);
    assert.throws(() => checkLoopWorkflow(inSlice(stage, FIX, "model: 'opus', effort: 'high' }"), stage), (e) => e instanceof UsageError && /fixer/.test(e.message), stage);
  }
});

test('A1: a generated script over 200,000 characters is refused', () => {
  const pure = checkLoopWorkflow(WF, 'spec-review') + '\n// ' + 'x'.repeat(200000);
  assert.throws(() => buildLoopScript({ stage: 'spec-review', pure, reviewBody: 'R', measure: MEASURE, fixPrompt: 'F {{issues}}' }), (e) => e instanceof UsageError && /200,?000/.test(e.message));
});

// ---- E26 B2: the task review loop script (correcao-semeada, restrita against atual) ----
const SEEDED = 'a'.repeat(40);
const FIXSHA = 'b'.repeat(40);
const SB = 'D:/work/correcao-semeada-A-1';
const WORK = 'D:/work';
const PLUGIN = 'D:/cfg/plugins/productivity-tools/9.9.9';
const scenario = { dir: SB, seededCommit: SEEDED, fixSha: FIXSHA };
const taskScript = (extra = {}, over = {}) =>
  buildTaskLoopScript({
    pure: checkLoopWorkflow(WF, 'task-review'),
    scenario,
    opts: { restricted: false, reviewModel: 'sonnet', pluginRoot: PLUGIN, work: WORK, title: 'Word count', fixPrompt: 'Fix it.\n{{issues}}\nCommit.', ...extra },
    ...over,
  });
const found = (id, d = '[fab] ' + id) => ({ severity: 'critical', category: 'defeito', description: d, file: 'src/a.mjs', id });
const rev = (issues, verdicts = []) => ({ issues, verdicts, headSha: SEEDED, clean: true, commitsInRange: 3 });
const APPLIED = { status: 'DONE', summary: 'applied', checks: [{ command: 'node --test', exit: 0, output: 'pass 7' }] };

// reviews answer from `reviews` in order; fixes return `fixes[label]` or a DONE with checks
async function runTask(text, reviews, fixes = {}) {
  const calls = [];
  let i = 0;
  const agent = async (prompt, o) => {
    calls.push({ prompt, ...o });
    if (/-fix\d+$/.test(o.label)) return o.label in fixes ? fixes[o.label] : APPLIED;
    const r = reviews[Math.min(i, reviews.length - 1)];
    i += 1;
    return r;
  };
  const result = await new AsyncFunction('agent', text.replace('export const meta', 'const meta'))(agent);
  return { calls, result, seq: calls.map((c) => c.label) };
}
const byLabel = (r, l) => r.calls.find((c) => c.label === l);

test('B2: the task loop script carries the pure block byte for byte, compiles and stays under 200,000 characters on the real workflow', () => {
  const text = taskScript();
  assert.ok(text.includes('\n' + PURE + '\n'));
  assert.ok(text.startsWith('export const meta = {'));
  assert.ok(text.length <= 200000, String(text.length));
  assert.doesNotMatch(text, /^import /m);
  new AsyncFunction('agent', text.replace('export const meta', 'const meta'));
  assert.match(text, /runReviewLoop\(H_env, /);
});

test('B2: restrita arm, round 2 prompt has Mode: restricted, spec and review-package.mjs <seededCommit> HEAD', async () => {
  const r = await runTask(taskScript({ restricted: true }), [rev([found('F1')]), rev([found('F2')], [{ id: 'F1', open: false }]), rev([], [{ id: 'F2', open: false }])]);
  assert.deepEqual(r.seq, ['E5:task-review1', 'E5:task-review-fix1', 'E5:task-review2', 'E5:task-review-fix2', 'E5:task-review3']);
  const p2 = byLabel(r, 'E5:task-review2').prompt;
  assert.ok(p2.includes('Mode: restricted, spec'), p2);
  assert.ok(p2.includes(`node "${PLUGIN}/scripts/review-package.mjs" "${SB}" ${SEEDED} HEAD "${WORK}/_tmp/E5-t3-spec2.diff"`), p2);
  assert.ok(!byLabel(r, 'E5:task-review1').prompt.includes('restricted'));
  assert.equal(r.result.ok, true);
});

test('B2: atual arm, round 2 prompt has the full Range log -p', async () => {
  const r = await runTask(taskScript({ restricted: false }), [rev([found('F1')]), rev([])]);
  const p2 = byLabel(r, 'E5:task-review2').prompt;
  assert.ok(p2.includes(`Range: git -C "${SB}" log -p ${SEEDED}~1..HEAD`), p2);
  assert.ok(!p2.includes('review-package.mjs'));
  assert.ok(p2.includes('Mode: spec. Task 3 ("Word count")'), p2);
});

test('B2: fix1 is the haiku applier with merge --ff-only <fixSha>, fix2 is the HEAD fixer in sonnet', async () => {
  const r = await runTask(taskScript(), [rev([found('F1')]), rev([found('F2')]), rev([])]);
  assert.deepEqual(r.seq, ['E5:task-review1', 'E5:task-review-fix1', 'E5:task-review2', 'E5:task-review-fix2', 'E5:task-review3']);
  const f1 = byLabel(r, 'E5:task-review-fix1');
  assert.equal(f1.model, 'haiku');
  assert.equal(f1.effort, 'low');
  assert.ok(f1.prompt.includes(`git -C "${SB}" merge --ff-only ${FIXSHA}`), f1.prompt);
  assert.ok(f1.prompt.includes('node --test'));
  assert.ok(f1.schema.properties.checks && f1.schema.required.includes('checks'));
  const f2 = byLabel(r, 'E5:task-review-fix2');
  assert.equal(f2.model, 'sonnet');
  assert.equal(f2.effort, 'medium');
  assert.ok(f2.prompt.includes('1. [critical/defeito] src/a.mjs [F2] [fab] F2'), f2.prompt);
  assert.ok(!f2.prompt.includes('{{issues}}'));
  // the reviewer after the applier reads the applier's real checks and the fixed finding ids
  const p2 = byLabel(r, 'E5:task-review2').prompt;
  assert.ok(p2.includes('Fixed the findings F1'), p2);
  assert.ok(p2.includes('$ node --test\nexit 0\npass 7'), p2);
  assert.equal(r.result.ok, true);
});

test('B2: a repeated finding escalates the fixer and the reviewer to opus', async () => {
  const r = await runTask(taskScript(), [rev([found('F1')]), rev([found('F1')]), rev([found('F1')])]);
  assert.deepEqual(r.seq, ['E5:task-review1', 'E5:task-review-fix1', 'E5:task-review2', 'E5:task-review-fix2', 'E5:task-review3']);
  assert.equal(byLabel(r, 'E5:task-review2').model, 'sonnet');
  assert.equal(byLabel(r, 'E5:task-review-fix2').model, 'opus');
  assert.equal(byLabel(r, 'E5:task-review3').model, 'opus');
  assert.equal(r.result.ok, false);
  assert.equal(r.result.kind, 'conteudo');
});

test('B2: the script returns restricted per round and ok', async () => {
  const seq = [rev([found('F1')]), rev([found('F2')], [{ id: 'F1', open: false }]), rev([], [{ id: 'F2', open: false }])];
  const restr = await runTask(taskScript({ restricted: true }), seq);
  assert.deepEqual(restr.result.restricted, [false, true, true]);
  const atual = await runTask(taskScript({ restricted: false }), seq);
  assert.deepEqual(atual.result.restricted, [false, false, false]);
  assert.equal(atual.result.ok, true);
  // a finding without id in round 1 keeps round 2 complete even in the restrita arm
  const noId = await runTask(taskScript({ restricted: true }), [rev([{ severity: 'critical', category: 'defeito', description: '[fab] no id', file: 'src/a.mjs' }]), rev([])]);
  assert.deepEqual(noId.result.restricted, [false, false]);
  assert.ok(!byLabel(noId, 'E5:task-review2').prompt.includes('restricted'));
});

test('B2: the diff path is outside the sandbox', async () => {
  const r = await runTask(taskScript({ restricted: true }), [rev([found('F1')]), rev([])]);
  const m = /review-package\.mjs" "[^"]+" \S+ HEAD "([^"]+)"/.exec(byLabel(r, 'E5:task-review2').prompt);
  assert.ok(m, 'restricted round 2 names a diff path');
  assert.ok(m[1].startsWith(WORK + '/_tmp/'), m[1]);
  assert.ok(!m[1].startsWith(SB + '/'), m[1]);
});

test('B2: the task loop script refuses a scenario without fixSha and a missing review model', () => {
  assert.throws(() => taskScript({}, { scenario: { dir: SB, seededCommit: SEEDED, fixSha: null } }), UsageError);
  assert.throws(() => taskScript({ reviewModel: undefined }), UsageError);
});

// ---- E26 B3: the final review loop script (correcao-semeada, atual against adversarial) ----
const finalScript = (extra = {}) =>
  buildFinalLoopScript({
    pure: checkLoopWorkflow(WF, 'final-review'),
    scenario,
    opts: { adversarial: false, review: readArm(join(here, 'arms', 'final-review-atual.md')).text, fix: readArm(join(here, 'arms', 'final-fix-atual.md')).text, ...extra },
  });
const fnd = (d, severity = 'critical') => ({ severity, category: 'defeito', description: d, file: 'src/a.mjs' });
const frev = (issues) => ({ issues, headSha: SEEDED, clean: true, commitsInRange: 3 });
const refute = (...ns) => ({ verdicts: ns.map((n) => ({ n, refuted: true, reason: '[fab] it is fine' })) });

// reviews answer from `reviews` in order, verifies from `verifies` in order; fixes return `fixes[label]` or a DONE
async function runFinal(text, reviews, { verifies = [], fixes = {} } = {}) {
  const calls = [];
  let i = 0;
  let v = 0;
  const agent = async (prompt, o) => {
    calls.push({ prompt, ...o });
    if (/-fix\d+$/.test(o.label)) return o.label in fixes ? fixes[o.label] : APPLIED;
    if (/^E5:final-verify/.test(o.label)) return verifies[Math.min(v++, verifies.length - 1)];
    return reviews[Math.min(i++, reviews.length - 1)];
  };
  const result = await new AsyncFunction('agent', text.replace('export const meta', 'const meta'))(agent);
  return { calls, result, seq: calls.map((c) => c.label) };
}

test('B3: the final loop script carries the pure block byte for byte, compiles and stays under 200,000 characters', () => {
  for (const adversarial of [false, true]) {
    const text = finalScript({ adversarial });
    assert.ok(text.includes('\n' + PURE + '\n'));
    assert.ok(text.startsWith('export const meta = {'));
    assert.ok(text.length <= 200000, String(text.length));
    assert.doesNotMatch(text, /^import /m);
    new AsyncFunction('agent', text.replace('export const meta', 'const meta'));
    assert.match(text, /runReviewLoop\(H_env, /);
    assert.ok(text.includes(`const H_ADVERSARIAL = ${adversarial}`));
  }
  assert.throws(() => buildFinalLoopScript({ pure: 'x', scenario: { dir: SB, seededCommit: SEEDED, fixSha: null }, opts: {} }), UsageError);
});

test('B3: the atual arm never calls verify', async () => {
  const r = await runFinal(finalScript({ adversarial: false }), [frev([fnd('[fab] first')]), frev([fnd('[fab] second')]), frev([])], { verifies: [refute(1)] });
  assert.deepEqual(r.seq, ['E5:final-review1', 'E5:final-review-fix1', 'E5:final-review2', 'E5:final-review-fix2', 'E5:final-review3']);
  assert.ok(!r.calls.some((c) => /final-verify/.test(c.label)));
  assert.equal(r.result.ok, true);
  assert.equal(r.result.verify, null);
});

test('B3: the adversarial arm calls E5:final-verify<r> only with a blocking issue and drops the refuted ones through splitRefuted', async () => {
  const text = finalScript({ adversarial: true });
  // no blocking issue: no verify
  const clean = await runFinal(text, [frev([fnd('[fab] nit', 'minor')])], { verifies: [refute(1)] });
  assert.deepEqual(clean.seq, ['E5:final-review1']);
  // two blocking issues, the first refuted: the fixer round and the next review's "Previous issues" carry only the second
  const r = await runFinal(text, [frev([fnd('[fab] first'), fnd('[fab] second')]), frev([])], { verifies: [refute(1)] });
  assert.deepEqual(r.seq, ['E5:final-review1', 'E5:final-verify1', 'E5:final-review-fix1', 'E5:final-review2']);
  const v = byLabel(r, 'E5:final-verify1');
  assert.ok(v.prompt.includes('Mode: verify.\n1. [critical/defeito] src/a.mjs [fab] first\n2. [critical/defeito] src/a.mjs [fab] second'), v.prompt);
  assert.ok(v.schema.properties.verdicts && v.schema.required.includes('verdicts'));
  assert.deepEqual([v.model, v.effort, v.agentType], ['opus', 'high', 'productivity-tools:final-reviewer']);
  const p2 = byLabel(r, 'E5:final-review2').prompt;
  assert.ok(p2.includes('[fab] second') && !p2.includes('[fab] first'), p2);
  assert.deepEqual(r.result.verify, { calls: 1, refutedByRound: { 1: 1 } });
  assert.equal(r.result.ok, true);
  // a verdict without a reason refutes nothing
  const noReason = await runFinal(text, [frev([fnd('[fab] first')]), frev([])], { verifies: [{ verdicts: [{ n: 1, refuted: true }] }] });
  assert.deepEqual(noReason.seq, ['E5:final-review1', 'E5:final-verify1', 'E5:final-review-fix1', 'E5:final-review2']);
});

test('B3: fix1 is the haiku applier and fix2 is the final-fix-atual arm in sonnet', async () => {
  const r = await runFinal(finalScript(), [frev([fnd('[fab] first')]), frev([fnd('[fab] second')]), frev([])]);
  const f1 = byLabel(r, 'E5:final-review-fix1');
  assert.deepEqual([f1.model, f1.effort], ['haiku', 'low']);
  assert.ok(f1.prompt.includes(`git -C "${SB}" merge --ff-only ${FIXSHA}`), f1.prompt);
  const f2 = byLabel(r, 'E5:final-review-fix2');
  assert.deepEqual([f2.model, f2.effort], ['sonnet', 'medium']);
  assert.ok(f2.prompt.startsWith('Fix the final review problems below and commit "E5 final-fix: ...".'), f2.prompt);
  assert.ok(f2.prompt.includes('You hold no lock.') && f2.prompt.includes('Never edit the spec'), f2.prompt);
  assert.ok(f2.prompt.includes('1. [critical/defeito] src/a.mjs [fab] second'), f2.prompt);
  assert.ok(!/\{\{\w+\}\}/.test(f2.prompt), f2.prompt);
  assert.equal(r.result.ok, true);
});

test('B3: one review per round with lens all and the prefix is briefing(ctx)', async () => {
  const r = await runFinal(finalScript(), [frev([fnd('[fab] first')]), frev([])]);
  assert.equal(r.calls.filter((c) => /^E5:final-review\d/.test(c.label)).length, 2);
  const p1 = byLabel(r, 'E5:final-review1');
  assert.ok(p1.prompt.includes(`Mode: review, lens: all. Diff: git -C "${SB}" diff main...HEAD`), p1.prompt);
  assert.ok(!p1.prompt.includes('Previous issues'));
  assert.ok(p1.prompt.startsWith(`You work in the worktree ${SB}, on the branch feat/E5, with the target main.`), p1.prompt);
  assert.ok(p1.prompt.includes('ENVIRONMENT MEASURED IN THE PREFLIGHT:') && p1.prompt.includes('CURRENT BASELINE OF THE TARGET'));
  assert.deepEqual([p1.model, p1.effort, p1.agentType, p1.phase], ['opus', 'high', 'productivity-tools:final-reviewer', 'Final review']);
  const p2 = byLabel(r, 'E5:final-review2').prompt;
  assert.ok(p2.includes(`Previous issues (${REPEAT}`), p2);
  assert.ok(p2.includes('1. [critical/defeito] src/a.mjs [fab] first'), p2);
});

test('B3: refutou-tudo', async () => {
  const r = await runFinal(finalScript({ adversarial: true }), [frev([fnd('[fab] first')])], { verifies: [refute(1)] });
  assert.deepEqual(r.seq, ['E5:final-review1', 'E5:final-verify1']);
  assert.ok(!r.seq.some((l) => /fix1/.test(l)));
  assert.equal(r.result.ok, true);
  assert.deepEqual(r.result.verify, { calls: 1, refutedByRound: { 1: 1 } });
});

// ---- E27 C2 (T1): frozen task loop script of correcao-semeada-A, both arms (LF), before the lenses branch exists ----
const sha256Lf = (t) => createHash('sha256').update(t.replace(/\r\n/g, '\n')).digest('hex');
const GOLDEN_TASK_LOOP_ATUAL = 'ad16e5750dcc10842ed067a61ac510aca4dde29e48ddf673a615ab059079b653';
const GOLDEN_TASK_LOOP_RESTRITA = 'dc937b34850b7ba464e1fe6f222566c9a8a4e7c497a51f6a3eee131cd175d8cc';
function frozenTaskLoopScript(restricted) {
  const sb = 'D:/work/correcao-semeada-A-1';
  const scenario = { dir: sb, seededCommit: 'a'.repeat(40), fixSha: 'b'.repeat(40) };
  const fixPrompt = `In Task 3 of the plan ${sb}/docs/plans/plan.md, fix the spec problems below, run the task's checks and commit "E5 T3: fix ...". Do NOT perform any external effect. STOP after this fix. Never edit the spec or the plan to satisfy a finding. Report in "checks" every verification you ran, with the exact command, real output and exit code.\n{{issues}}`;
  const pure = 'const PURE_FIXTURE = 1\nfunction runReviewLoop() {}\nfunction taskIssues(r) { return r.issues }';
  return buildTaskLoopScript({ pure, scenario, opts: { restricted, reviewModel: 'sonnet', pluginRoot: 'D:/cfg/plugins/productivity-tools', work: 'D:/work', title: 'wordCount and the index', fixPrompt } });
}

test('C2: the task loop script of correcao-semeada-A, arm atual, is frozen (golden)', () => {
  const text = frozenTaskLoopScript(false);
  assert.equal(sha256Lf(text), GOLDEN_TASK_LOOP_ATUAL, text);
});

test('C2: the task loop script of correcao-semeada-A, arm restrita, is frozen (golden)', () => {
  const text = frozenTaskLoopScript(true);
  assert.equal(sha256Lf(text), GOLDEN_TASK_LOOP_RESTRITA, text);
});

// ---- E27 C2 (T4): the lenses task loop script (lentes-semeadas: atual runs spec then quality, unica runs one review) ----
const LENS_FIX = `In Task 3 of the plan ${SB}/docs/plans/plan.md, fix the {{kind}} problems below, run the task's checks and commit "E5 T3: fix ...". Do NOT perform any external effect. STOP after this fix. Never edit the spec or the plan to satisfy a finding. Report in "checks" every verification you ran, with the exact command, real output and exit code.\n{{issues}}`;
const lensScenario = { dir: SB, seededCommit: SEEDED };
const lensScript = (arm = 'atual', over = {}) =>
  buildTaskLoopScript({
    pure: checkLoopWorkflow(arm === 'unica' ? WF_SINGLE : WF, 'task-review', { lenses: true, arm }),
    scenario: lensScenario,
    opts: { restricted: false, kinds: arm === 'unica' ? ['review'] : ['spec', 'quality'], single: arm === 'unica', reviewModel: 'sonnet', pluginRoot: PLUGIN, work: WORK, title: 'Word count', fixPrompt: LENS_FIX, ...over },
  });
const vrev = (issues, spec = 'pass', quality = 'pass', verdicts = []) => ({ ...rev(issues, verdicts), spec, quality });

test('C2: the lenses loop script carries the pure block byte for byte, compiles and stays under 200,000 characters on the real workflow', () => {
  for (const arm of ['atual', 'unica']) {
    const text = lensScript(arm);
    assert.ok(text.includes('\n' + (arm === 'unica' ? extractPure(WF_SINGLE).pure : PURE) + '\n'), arm);
    assert.ok(text.startsWith('export const meta = {'), arm);
    assert.ok(text.length <= 200000, `${arm}: ${text.length}`);
    assert.doesNotMatch(text, /^import /m);
    new AsyncFunction('agent', text.replace('export const meta', 'const meta'));
    assert.match(text, /runReviewLoop\(H_env, /);
    assert.ok(text.includes('const H_KINDS = ' + JSON.stringify(arm === 'unica' ? ['review'] : ['spec', 'quality'])), arm);
    assert.ok(text.includes(`const H_TR = {"restricted":false,"single":${arm === 'unica'}}`), arm);
  }
  // the lenses branch needs no fixSha, and still refuses a missing review model
  assert.throws(() => lensScript('atual', { reviewModel: undefined }), UsageError);
});

test('C2: atual runs the spec loop, then the quality loop, with Mode: spec. and Mode: quality.', async () => {
  const r = await runTask(lensScript('atual'), [rev([found('F1')]), rev([]), rev([])]);
  assert.deepEqual(r.seq, ['E5:t3:spec1', 'E5:t3:spec-fix1', 'E5:t3:spec2', 'E5:t3:quality1']);
  for (const l of ['E5:t3:spec1', 'E5:t3:spec2', 'E5:t3:quality1']) {
    const c = byLabel(r, l);
    assert.equal(c.agentType, 'productivity-tools:task-reviewer', l);
    assert.equal(c.model, 'sonnet', l);
    assert.equal(c.effort, 'medium', l);
  }
  assert.ok(byLabel(r, 'E5:t3:spec1').prompt.includes('Mode: spec. Task 3 ("Word count")'));
  assert.ok(byLabel(r, 'E5:t3:quality1').prompt.includes('Mode: quality. Task 3 ("Word count")'));
  assert.equal(r.result.ok, true);
  assert.equal(r.result.loops.length, 2);
  assert.deepEqual(r.result.loops.map((l) => [l.kind, l.ok]), [['spec', true], ['quality', true]]);
});

test('C2: when the spec loop stops, no quality label is called', async () => {
  const r = await runTask(lensScript('atual'), [rev([found('F1')]), rev([found('F1')]), rev([found('F1')])]);
  assert.deepEqual(r.seq, ['E5:t3:spec1', 'E5:t3:spec-fix1', 'E5:t3:spec2', 'E5:t3:spec-fix2', 'E5:t3:spec3']);
  assert.ok(!r.seq.some((l) => /quality/.test(l)));
  assert.equal(r.result.ok, false);
  assert.equal(r.result.loops.length, 1);
  assert.deepEqual([r.result.loops[0].kind, r.result.loops[0].ok, r.result.loops[0].stop], ['spec', false, 'conteudo']);
});

test('C2: unica runs one loop with Mode: review. and labels E5:t3:review<r>', async () => {
  const r = await runTask(lensScript('unica'), [vrev([found('F1')], 'fail', 'pass'), vrev([])]);
  assert.deepEqual(r.seq, ['E5:t3:review1', 'E5:t3:review-fix1', 'E5:t3:review2']);
  assert.ok(byLabel(r, 'E5:t3:review1').prompt.includes('Mode: review. Task 3 ("Word count")'));
  assert.ok(!r.seq.some((l) => /spec|quality/.test(l)));
  assert.equal(r.result.ok, true);
  assert.deepEqual(r.result.loops.map((l) => [l.kind, l.ok]), [['review', true]]);
});

test('C2: a unica review with quality fail and only a minor finding gets the synthetic finding and a fix', async () => {
  const r = await runTask(lensScript('unica'), [vrev([minor], 'pass', 'fail'), vrev([])]);
  assert.deepEqual(r.seq, ['E5:t3:review1', 'E5:t3:review-fix1', 'E5:t3:review2']);
  const fx = byLabel(r, 'E5:t3:review-fix1');
  assert.ok(fx.prompt.includes('single review'), fx.prompt);
  assert.ok(fx.prompt.includes('fix the review problems below'), fx.prompt);
  // the atual arm never adds the synthetic finding: the same review ends the loop at once
  const a = await runTask(lensScript('atual'), [rev([minor])]);
  assert.deepEqual(a.seq, ['E5:t3:spec1', 'E5:t3:quality1']);
});

test('C2: fix1 is the HEAD fixer in sonnet with the kind in its text, and a BLOCKED fix stops the loop', async () => {
  const r = await runTask(lensScript('atual'), [rev([found('F1')]), rev([])]);
  const f1 = byLabel(r, 'E5:t3:spec-fix1');
  assert.deepEqual([f1.model, f1.effort], ['sonnet', 'medium']);
  assert.ok(f1.prompt.includes('fix the spec problems below'), f1.prompt);
  assert.ok(f1.prompt.includes('1. [critical/defeito] src/a.mjs [F1] [fab] F1'), f1.prompt);
  assert.ok(!/\{\{\w+\}\}/.test(f1.prompt), f1.prompt);
  assert.ok(f1.schema.properties.status && f1.schema.properties.summary && f1.schema.properties.checks);
  assert.ok(!r.calls.some((c) => c.model === 'haiku'), 'no haiku applier');
  // the next review reads the fixer's own summary and checks (H_cur)
  const p2 = byLabel(r, 'E5:t3:spec2').prompt;
  assert.ok(p2.includes('Summary: applied') && p2.includes('$ node --test\nexit 0\npass 7'), p2);
  // the quality fixer names its kind
  const q = await runTask(lensScript('atual'), [rev([]), rev([found('F2')]), rev([])]);
  assert.ok(byLabel(q, 'E5:t3:quality-fix1').prompt.includes('fix the quality problems below'));
  // BLOCKED stops the loop, and the quality loop never starts
  const b = await runTask(lensScript('atual'), [rev([found('F1')])], { 'E5:t3:spec-fix1': { status: 'BLOCKED', summary: 'nothing to do', checks: [] } });
  assert.deepEqual(b.seq, ['E5:t3:spec1', 'E5:t3:spec-fix1']);
  assert.equal(b.result.ok, false);
  assert.deepEqual(b.result.loops.map((l) => [l.kind, l.ok, l.stop]), [['spec', false, 'conteudo']]);
});

test('C2: a repeated finding escalates the fixer and the reviewer to opus (quality loop and review loop)', async () => {
  const q = await runTask(lensScript('atual'), [rev([]), rev([found('F1')]), rev([found('F1')]), rev([found('F1')])]);
  assert.deepEqual(q.seq, ['E5:t3:spec1', 'E5:t3:quality1', 'E5:t3:quality-fix1', 'E5:t3:quality2', 'E5:t3:quality-fix2', 'E5:t3:quality3']);
  assert.equal(byLabel(q, 'E5:t3:quality2').model, 'sonnet');
  assert.equal(byLabel(q, 'E5:t3:quality-fix2').model, 'opus');
  assert.equal(byLabel(q, 'E5:t3:quality3').model, 'opus');
  assert.equal(q.result.ok, false);
  assert.deepEqual(q.result.loops.map((l) => [l.kind, l.ok]), [['spec', true], ['quality', false]]);
  const u = await runTask(lensScript('unica'), [vrev([found('F1')], 'pass', 'fail'), vrev([found('F1')], 'pass', 'fail'), vrev([found('F1')], 'pass', 'fail')]);
  assert.deepEqual(u.seq, ['E5:t3:review1', 'E5:t3:review-fix1', 'E5:t3:review2', 'E5:t3:review-fix2', 'E5:t3:review3']);
  assert.equal(byLabel(u, 'E5:t3:review-fix2').model, 'opus');
  assert.equal(byLabel(u, 'E5:t3:review3').model, 'opus');
  assert.equal(u.result.kind, 'conteudo');
});

test('C2: the lenses script returns ok, kind, msg, loops with the accepted risks of each loop, reviews and accepted', async () => {
  // a non hard finding (fora-do-escopo, important) is accepted as a risk and the loop approves
  const risk = { severity: 'important', category: 'fora-do-escopo', description: '[fab] out of scope', file: 'src/x.mjs' };
  const r = await runTask(lensScript('atual'), [rev([risk]), rev([])]);
  assert.equal(r.result.ok, true);
  assert.equal(r.result.loops[0].accepted.length, 1);
  assert.equal(r.result.loops[1].accepted.length, 0);
  assert.equal(r.result.accepted.length, 1);
  assert.equal(r.result.reviews.length, 2);
  assert.ok('kind' in r.result && 'msg' in r.result);
});
