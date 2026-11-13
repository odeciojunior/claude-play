import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPure } from './load-pure.mjs';

const P = loadPure();
const ctx = {
  base: 'BASE RULES', envFacts: 'bash 5.2; node 22', baseline: 'unit: exit 0', E: 'E7', wt: '/wt/E7',
  planPath: 'docs/plan.md', specPath: 'docs/spec.md', start: 'abc123', locks: ['db'], round: 2, prev: '1. [critical/defeito] a.js bug',
};
const task = { n: 3, title: 'Add parser', files: ['src/p.js', 'src/p.test.js'], tier: 'haiku' };
const impl = { status: 'DONE', summary: 'done', checks: [{ command: 'npm test', output: '12 passing', exit: 0 }, { command: 'npm run lint', output: 'boom', exit: 1 }] };

test('implementation prompt stops after the task and carries the measured environment', () => {
  const p = P.buildImplPrompt(ctx, task);
  assert.match(p, /STOP after this task/);
  assert.match(p, /bash 5\.2; node 22/);
  assert.match(p, /Task 3/);
  assert.match(p, /src\/p\.js, src\/p\.test\.js/);
  assert.match(p, /E7 T3:/);
  assert.match(p, /checks/);
  assert.match(p, /HOLD.*db/);
  assert.match(P.buildImplPrompt({ ...ctx, locks: [] }, task), /hold no lock/i);
});

test('review prompt hands the implementer checks (command, exit, output) to the reviewer', () => {
  for (const kind of ['spec', 'quality']) {
    const p = P.buildTaskReviewPrompt(ctx, task, kind, impl);
    assert.match(p, /npm test/);
    assert.match(p, /12 passing/);
    assert.match(p, /npm run lint/);
    assert.match(p, /exit 1/);
    assert.match(p, /abc123\.\.HEAD/);
    assert.match(p, /1\. \[critical\/defeito\] a\.js bug/);
  }
  assert.match(P.buildTaskReviewPrompt(ctx, task, 'spec', impl), /SPEC/i);
  assert.match(P.buildTaskReviewPrompt(ctx, task, 'quality', impl), /QUALITY/i);
  assert.match(P.buildTaskReviewPrompt(ctx, task, 'spec', { status: 'DONE', summary: 'x', checks: [] }), /no checks/i);
});

test('reviewer model: opus for route.reviewTier opus, an opus route or an external task; implementer model comes from the route', () => {
  const r = (tier, effort, reviewTier) => ({ route: { tier, effort, reviewTier } });
  assert.equal(P.reviewModelFor(r('sonnet', 'medium', 'opus')), 'opus');
  assert.equal(P.reviewModelFor(r('sonnet', 'medium', 'sonnet')), 'sonnet');
  assert.equal(P.reviewModelFor({}), 'sonnet');
  assert.equal(P.reviewModelFor(r('opus', 'medium', 'sonnet')), 'opus');
  assert.equal(P.reviewModelFor({ ...r('sonnet', 'medium', 'sonnet'), external: true }), 'opus');
  assert.equal(P.reviewModelFor({ ...r('sonnet', 'medium', 'sonnet'), external: false }), 'sonnet');
  assert.equal(P.reviewModelFor(null), 'sonnet');
  assert.equal(P.implModel(r('haiku', 'low', 'sonnet')), 'haiku');
  assert.equal(P.implModel(r('opus', 'medium', 'opus')), 'opus');
  assert.equal(P.implModel(r('fable', 'medium', 'sonnet')), 'sonnet');
  assert.equal(P.implModel({}), 'sonnet');
  assert.equal(P.implEffort(r('haiku', 'low', 'sonnet')), 'low');
  assert.equal(P.implEffort(r('sonnet', 'high', 'sonnet')), 'high');
  assert.equal(P.implEffort({}), 'medium');
  // E8 T6: a transcribed tier/reviewTier without route is no longer read
  assert.equal(P.implModel({ tier: 'haiku' }), 'sonnet');
  assert.equal(P.reviewModelFor({ tier: 'sonnet', reviewTier: 'opus' }), 'sonnet');
});

test('issue helpers: blocking, fmt, compact, reviewTruth', () => {
  const r = { issues: [{ severity: 'critical', category: 'defeito', description: 'd', file: 'f.js' }, { severity: 'minor', description: 'm' }], clean: true, commitsInRange: 1 };
  assert.equal(P.blocking(r).length, 1);
  assert.equal(P.blocking(null).length, 0);
  assert.equal(P.fmt(P.blocking(r)), '1. [critical/defeito] f.js d');
  assert.deepEqual(P.compact(r.issues).minor, 1);
  assert.equal(P.reviewTruth(r, 1, 'x').length, 1);
  const bad = P.reviewTruth({ issues: [], clean: false, commitsInRange: 0 }, 1, 'range');
  assert.equal(bad.length, 2);
  assert.ok(bad.every(i => i.severity === 'critical' && i.category === 'defeito'));
  assert.equal(P.reviewTruth({ issues: [], clean: true, commitsInRange: 0 }, 0, 'x').length, 0);
});

test('criteriaOpen lists criteria with no executable evidence', () => {
  const cardAc = [
    { id: 'A1', text: 'a', tag: { kind: 'test', evidence: 'npm test' } },
    { id: 'A2', text: 'b', tag: { kind: 'human', evidence: 'Ana' } },
    { id: 'A3', text: 'c', tag: null },
    { id: 'A4', text: 'd', tag: null },
  ];
  const planAc = [
    { ac: 'A1', kind: 'test', command: 'npm test' },
    { ac: 'A2', kind: 'human' },
    { ac: 'A3', kind: 'blocked', blq: 'BLQ-1' },
    { ac: 'A4', kind: 'smoke', command: 'x' },
  ];
  assert.deepEqual(P.criteriaOpen(cardAc, planAc), [{ ac: 'A2', kind: 'human', blq: undefined }, { ac: 'A3', kind: 'blocked', blq: 'BLQ-1' }]);
});

test('workflow script has no project-specific terms and no nondeterministic calls', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8');
  assert.doesNotMatch(src, /supabase|\bdeno\b|\bRLS\b|docker|\budv\b|estado-atual/i);
  assert.doesNotMatch(src, /Date\.now\(|Math\.random\(|new Date\(\)|^import /m);
});

test('criteriaOpen: a human/blocked tag or row always opens the criterion', () => {
  const t = (kind, evidence = 'x', blq) => ({ kind, evidence, ...(blq ? { blq } : {}) });
  assert.deepEqual(P.criteriaOpen([{ id: 'A1', tag: t('human') }], [{ ac: 'A1', kind: 'test', command: 'x' }]), [{ ac: 'A1', kind: 'human', blq: undefined }]);
  assert.deepEqual(P.criteriaOpen([{ id: 'A1', tag: t('blocked', 'k', 'BLQ-2') }], [{ ac: 'A1', kind: 'test', command: 'x' }]), [{ ac: 'A1', kind: 'blocked', blq: 'BLQ-2' }]);
  assert.deepEqual(P.criteriaOpen([{ id: 'A1', tag: null }], [{ ac: 'A1', kind: 'test', command: 'x' }, { ac: 'A1', kind: 'human' }]), [{ ac: 'A1', kind: 'human', blq: undefined }]);
  assert.deepEqual(P.criteriaOpen([], [{ ac: 'A9', kind: 'human' }, { ac: 'A8', kind: 'blocked', blq: 'BLQ-1' }, { ac: 'A7', kind: 'test', command: 'x' }]),
    [{ ac: 'A9', kind: 'human', blq: undefined }, { ac: 'A8', kind: 'blocked', blq: 'BLQ-1' }]);
  assert.equal(P.criteriaOpen([{ id: 'A1', tag: null }], [{ ac: 'A1', kind: 'human' }, { ac: 'A1', kind: 'human' }]).length, 1);
});

test('evidenceGaps: a plan row cannot replace a human/blocked tag with another kind', () => {
  const tg = (kind, evidence, blq) => ({ kind, evidence, ...(blq ? { blq } : {}) });
  const g = P.evidenceGaps([{ id: 'A1', text: 't', tag: tg('human', 'Ana') }], [{ ac: 'A1', kind: 'test', command: 'x' }], new Set());
  assert.equal(g.length, 1);
  assert.deepEqual(P.evidenceGaps([{ id: 'A1', text: 't', tag: tg('human', 'Ana') }], [{ ac: 'A1', kind: 'human' }], new Set()), []);
  assert.equal(P.evidenceGaps([{ id: 'A1', text: 't', tag: tg('blocked', 'k', 'BLQ-1') }], [{ ac: 'A1', kind: 'test', command: 'x' }], new Set(['BLQ-1'])).length, 1);
});

test('fmtChecks keeps the tail of long output; review prompt tells reviewers about locks and exact repeats', () => {
  const out = 'HEAD'.padEnd(5000, '.') + 'FAILURE-AT-THE-END';
  const p = P.buildTaskReviewPrompt(ctx, task, 'quality', { status: 'DONE', summary: 's', checks: [{ command: 'c', output: out, exit: 1 }] });
  assert.match(p, /FAILURE-AT-THE-END/);
  assert.doesNotMatch(p, /HEAD\.\.\./);
  assert.match(p, /shared lock/i);
  assert.match(p, /exact same `?file`? and `?description`?/i);
  assert.match(P.repeatRule(), /exact same/);
});

const mkEnv = (over = {}) => ({ maxFix: 2, blqIds: new Set(), reviews: [], concerns: [], acceptRisks() {}, ...over });
const bug = { severity: 'critical', category: 'defeito', description: 'same bug', file: 'a.js' };
const rev = (issues = [bug]) => ({ issues, headSha: 'h', clean: true, commitsInRange: 1 });

test('reviewLoop escalates haiku -> sonnet -> opus on a repeated finding and gets one extra round', async () => {
  const tiers = [];
  const res = await P.runReviewLoop(mkEnv(), 'T1:spec', async () => rev(), async (iss, k, tier) => { tiers.push(tier); return { status: 'DONE' }; }, r => r.issues, { tier: 'haiku', reviewModel: 'sonnet' });
  assert.deepEqual(tiers, ['haiku', 'sonnet', 'opus']);
  assert.equal(res.ok, false);
  assert.match(res.msg, /reappeared after a fix at opus/);
  assert.equal(res.kind, 'conteudo');
});

test('reviewLoop with a fixer already at opus stops on the first repeat; decisao kind is kept', async () => {
  const env = mkEnv();
  const d = { severity: 'critical', category: 'decisao', description: 'breaks DEC-1', file: 'p.md' };
  const res = await P.runReviewLoop(env, 'spec', async () => rev([d]), async () => ({ status: 'DONE' }), r => r.issues, { tier: 'opus', reviewModel: 'opus' });
  assert.equal(res.ok, false);
  assert.equal(res.kind, 'decisao');
  assert.equal(env.reviews.length, 1);
  assert.deepEqual(env.reviews[0].rounds.map(x => x.fixTier), [null, 'opus']);
});

test('reviewLoop passes when the fix resolves it, logs rounds with models, and logs early exits', async () => {
  const env = mkEnv();
  let n = 0;
  const ok = await P.runReviewLoop(env, 's', async () => rev(n++ ? [] : [bug]), async () => ({ status: 'DONE' }), r => r.issues, { tier: 'sonnet', reviewModel: 'opus' });
  assert.equal(ok.ok, true);
  assert.deepEqual(env.reviews[0].rounds, [{ round: 1, reviewModel: 'opus', fixTier: null }, { round: 2, reviewModel: 'opus', fixTier: 'sonnet' }]);
  for (const [fix, kind] of [[async () => null, 'infra'], [async () => ({ status: 'BLOCKED', summary: 'x' }), 'conteudo']]) {
    const e = mkEnv();
    const r = await P.runReviewLoop(e, 's', async () => rev(), fix, r => r.issues, { tier: 'sonnet' });
    assert.equal(r.kind, kind);
    assert.equal(e.reviews.length, 1, 'early exit is logged');
  }
  const e2 = mkEnv();
  const nr = await P.runReviewLoop(e2, 's', async () => null, async () => ({}), r => r.issues, {});
  assert.equal(nr.kind, 'infra');
  assert.equal(e2.reviews.length, 1);
});

test('reviewLoop with maxFix 0 never fixes', async () => {
  let fixed = 0;
  const res = await P.runReviewLoop(mkEnv({ maxFix: 0 }), 's', async () => rev(), async () => { fixed++; return {}; }, r => r.issues, { tier: 'haiku' });
  assert.equal(fixed, 0);
  assert.equal(res.ok, false);
});

test('buildImplPrompt forbids external effects outside an authorized task and, for an authorized one, carries the dedupe note', () => {
  assert.match(P.buildImplPrompt(ctx, task), /Do NOT perform any external effect/);
  const p = P.buildImplPrompt({ ...ctx, authorizedExternal: true }, { ...task, external: true, externalDedupe: 'checks outbox.log first' });
  assert.match(p, /AUTHORIZED/);
  assert.match(p, /checks outbox\.log first/);
  assert.doesNotMatch(p, /Do NOT perform/);
});

test('minor 1: externalNote says the person authorized it and that no humanInput should ask for it', () => {
  const n = P.externalNote(true, { externalDedupe: 'x' });
  assert.match(n, /the person AUTHORIZED/);
  assert.match(n, /already given/);
});

test('minor 3: the reviewer does not re-run a check with an external effect', () => {
  const p = P.buildTaskReviewPrompt(ctx, task, 'spec', { summary: 's', checks: [] });
  assert.match(p, /do not re-run a check with an external effect/i);
});

test('effortFor: haiku low, sonnet and opus medium', () => {
  assert.equal(P.effortFor('haiku'), 'low');
  assert.equal(P.effortFor('sonnet'), 'medium');
  assert.equal(P.effortFor('opus'), 'medium');
});

test('reviewLoop re-reviews an escalated fix at the larger of reviewer model and fix tier', async () => {
  const env = mkEnv();
  const seen = [];
  const res = await P.runReviewLoop(env, 'T1:spec', async (round, prev, m) => { seen.push(m); return rev(); }, async () => ({ status: 'DONE' }), r => r.issues, { tier: 'sonnet', reviewModel: 'sonnet' });
  assert.equal(res.ok, false);
  // round 1 has no override; re-review after the sonnet fix stays sonnet; after the opus fix it is opus
  assert.deepEqual(seen, [undefined, 'sonnet', 'opus']);
  assert.deepEqual(env.reviews[0].rounds.map(x => x.reviewModel), ['sonnet', 'sonnet', 'opus']);
  const hi = []; // an opus reviewer is never lowered by a sonnet fix
  await P.runReviewLoop(mkEnv(), 's', async (r, p, m) => { hi.push(m); return rev(hi.length > 1 ? [] : [bug]); }, async () => ({ status: 'DONE' }), r => r.issues, { tier: 'sonnet', reviewModel: 'opus' });
  assert.deepEqual(hi, [undefined, 'opus']);
});

test('every agent call that passes a model also passes an explicit effort', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8').split(/\r?\n/);
  const withModel = src.map((l, i) => [i + 1, l]).filter(([, l]) => /\bmodel: /.test(l));
  assert.ok(withModel.length >= 40, 'found the agent option objects');
  for (const [n, l] of withModel) assert.match(l, /model: [^}]*effort: /, 'line ' + n + ' has model without effort');
  assert.equal(src.join('\n').match(/effort: 'high'/g).length, 4);
});

test('an external effect the card requires is a plan task: common rule, plan prompt and plan review say so', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8');
  assert.match(src, /the workflow asks the person for it when it reaches a plan task or an acceptance-evidence row declared external\. Open roadmap blockers/);
  assert.equal((src.match(/- Delivery: there is no other delivery stage, so an external effect the card or the spec requires is performed by an external task of the plan \(an external evidence row may check that effect, never replaces the task\)\./g) || []).length, 2, 'spec and plan prompts');
  assert.match(src, /Blocks:[^\n]*a design or autonomous decision that leaves an external effect the card requires to the workflow, the operator or a later stage instead of a task of the plan, except merging the target into the integration branch and pushing it, which are the owner's \(a criterion that needs them is a human act\) \(defeito\); a design or autonomous decision that has a task/);
  assert.match(src, /Every external effect the card or the spec requires is a task of the plan with \\`external: true\\`, except merging the target[^;]*; "not a task of this plan" does not apply to it/);
  assert.match(src, /Blocks \(defeito\):[^\n]*an external effect that the card or the spec requires \(a delivery, a send, a deploy\) and that no task declared external performs/);
  assert.doesNotMatch(src, /the workflow asks the person for it\. Open roadmap blockers/);
});

test('reviews block a task or effect run after the merge; the briefing says the integration worktree runs only the workflow stages', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'roadmap-release.js'), 'utf8');
  assert.match(src, /Blocks \(defeito\):[^\n]*a task of the plan, or an external effect, marked to run after the merge, in the integration worktree or in the target \(defeito, critical\)/);
  assert.match(src, /Blocks:[^\n]*a design or autonomous decision that has a task of the plan, or an external effect of the design, run after the merge, in the integration worktree or in the target \(defeito\)/);
  assert.match(src, /no task of the plan runs in the integration worktree \(the workflow's own merge, post-merge gates and docs stages run there\)/);
});

test('externalNote: an authorized external task runs in the deliverable worktree, only reads before the effect, and fixtures are allowed', () => {
  const p = P.buildImplPrompt({ ...ctx, authorizedExternal: true }, { ...task, external: true, externalDedupe: 'checks outbox.log first' });
  assert.match(p, /deliverable worktree/);
  assert.match(p, /only read \(the duplicate check is a read\); never run the effect command itself, nor a script that runs it against the real target/);
  assert.match(p, /Tests on a fixture or a fake target are not the effect/);
  assert.doesNotMatch(p, /any part of it/);
});

test('SKILL.md: the authorization message names the git show; the resume takes the items from the operator actions; reportPath null is handled', () => {
  const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'SKILL.md'), 'utf8');
  assert.match(skill, /End the authorization message with one sentence, in the person's language, that names the exact command with the real values/);
  assert.match(skill, /are the union of the `resumeWith` of the authorized `authorize-external` actions, never taken from a summary/);
  assert.doesNotMatch(skill, /Resume args/);
  assert.match(skill, /While the Workflow result is still in this conversation it is the source and the report .{0,80}only a check: if they diverge, resume with the result and report the divergence\. After a compaction the report is the source\./);
  assert.match(skill, /With no source \(the report unavailable although `reportPath` was not null, or `reportPath` null and the result out of context\), resume with the short items the person approved by name \(`E<n>:T<m>`, `E<n>:AC<k>`, `gate:<id>`, `checkout:<target>`\), which bind to the current plan on first use/);
  assert.match(skill, /When `reportPath` is null, leave that sentence out/);
  assert.doesNotMatch(skill, /ask again\. When|compaction\), ask again/);
});

test('AC3: implementer and fixer prompts cite no superpowers and forbid asking', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const agent = readFileSync(join(here, '..', '..', '..', 'agents', 'implementer.md'), 'utf8').replace(/\r\n/g, '\n');
  const src = readFileSync(join(here, 'roadmap-release.js'), 'utf8');
  const noAsk = src.match(/const NO_ASK = '([^']*)'/)[1];
  const fm = agent.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(fm, 'frontmatter present');
  const body = agent.slice(fm[0].length);
  assert.match(fm[1], /^name: implementer$/m);
  assert.match(fm[1], /^description: .*never asks the person/mi);
  assert.match(fm[1], /^tools: Read, Grep, Glob, Bash, Write, Edit$/m);
  assert.doesNotMatch(fm[1], /^(model|effort):/m);
  assert.doesNotMatch(body, /superpowers/i);
  assert.ok(body.includes(noAsk), 'body carries NO_ASK literally');

  // Second part: the six implementation and fix calls go through implAgent.
  assert.doesNotMatch(src, /superpowers/i);
  assert.equal(src.split('schema: S_IMPL').length - 1, 1, 'schema: S_IMPL appears once');
  const defLine = src.split('\n').find((l) => l.includes('schema: S_IMPL'));
  assert.match(defLine, /^const implAgent = /);
  assert.ok(defLine.includes("agentType: 'productivity-tools:implementer'"));
  const chunks = src.split('implAgent(').slice(1);
  assert.equal(chunks.length, 6, 'six calls');
  const labels = [/:impl/, /-fix/, /final-fix/, /gates-fix/, /merge-fix/, /delta-fix/];
  const calls = chunks.map((c) => c.slice(0, 2000));
  for (const re of labels) {
    assert.ok(calls.some((c) => re.test(c)), `a call carries ${re}`);
  }
  assert.ok(calls.some((c) => c.startsWith('buildImplPrompt(')));
  assert.equal(calls.filter((c) => c.startsWith('`${C()}')).length, 4);
  assert.equal(calls.filter((c) => c.startsWith('`${Cn()}')).length, 1);
  assert.ok(!P.buildImplPrompt(ctx, task).includes(noAsk), 'the implementer prompt leaves NO_ASK to the agent file');
  const ti = P.buildImplPrompt(ctx, { ...task, testFirst: true });
  assert.match(ti, /test-first task/);
  const ex = P.buildImplPrompt(ctx, { ...task, testFirst: { exempt: 'only docs' } });
  assert.match(ex, /exempt from test-first: only docs/);
  assert.doesNotMatch(ex, /test-first task/);
  const plain = P.buildImplPrompt(ctx, task);
  assert.doesNotMatch(plain, /test-first|exempt/i);
});

test('implementer.md carries the checks contract: identical command, verbatim output, humanInputs limit', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const agent = readFileSync(join(here, '..', '..', '..', 'agents', 'implementer.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(agent, /`command` is the exact literal string that was run/);
  assert.match(agent, /identical string, character for character/);
  assert.match(agent, /No annotation, no "before\/after", no cwd note/);
  assert.match(agent, /never in `command`/);
  assert.match(agent, /`output` quotes the real output verbatim/);
  assert.match(agent, /marked with `\[\.\.\.\]`/);
  assert.match(agent, /Never reword/);
  assert.match(agent, /`humanInputs` is only for what truly needs a person: credentials, an external effect, or a product decision the spec cannot answer/);
  assert.match(agent, /technical disagreement/);
  assert.match(agent, /Never `git add -A`/);
});
