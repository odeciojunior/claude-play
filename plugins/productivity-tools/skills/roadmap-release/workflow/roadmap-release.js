export const meta = {
  name: 'roadmap-release',
  description: 'Executa entregas E<n> de um roadmap acompanhado: descoberta, spec, plano, tarefas com revisão dupla, revisão final, gates contra baseline, merge serializado com rollback, docs e roadmap',
  whenToUse: 'Automatizar uma ou mais entregas de docs/plans/roadmap-*/. Exemplos de args: {"deliverables":["E18"],"targetBranch":"release/2026-11-24"} | {"deliverables":"next","phase":"r1-1"} | {"mode":"dry-run"} | {"mode":"plan-only","deliverables":["E19"]}',
  phases: [
    { title: 'Descoberta', detail: 'reads config, cards and panel on the target; computes selection and dependencies' },
    { title: 'Preflight', detail: 'target, integration worktree, setup commands, environment and baseline of every gate' },
    { title: 'Setup', detail: 'worktree and install per deliverable' },
    { title: 'Spec', detail: 'autonomous brainstorming, review loop, human-input gate' },
    { title: 'Plano', detail: 'writing-plans, review loop, "running" record' },
    { title: 'Implementação', detail: 'one task per implementer, spec review, quality review, git truth' },
    { title: 'Revisão final', detail: 'sync with the target and review of the whole branch (2 lenses if critical)' },
    { title: 'Gates', detail: 'numeric gates against the baseline; locked resources serialized; reviewed fixes' },
    { title: 'Merge', detail: 're-sync, merge, conflict review, post-merge gates, verified rollback' },
    { title: 'Docs', detail: 'docs stage, roadmap-tracker and independent measurement' },
    { title: 'Relatório', detail: 'git truth, report and operator actions' },
  ],
}

// roadmap-release workflow script. Self-contained: no imports, no filesystem or Node API.
// Runtime API: agent(prompt, {label, phase, model, schema}), phase(), log(), args, budget, parallel().
// All project-specific settings come from args.config (the object validated by scripts/preflight.mjs).
//
// ARGS (all optional except config)
//   config: release config validated by preflight.mjs (gates, install, setup, locks, projectContext, conflictRules...)
//   deliverables: string[] | "next" | "ready" | "all" (default "next")
//   phase, priority, track: filters on card attributes
//   targetBranch: where deliverables merge (default: config.releaseBranch, else the roadmap releaseBranch, else "integracao/<slug>")
//   baseBranch: where the target is created from when missing (default: the roadmap integrationBranch)
//   allowIntegrationBranch (false): allows targetBranch == integrationBranch
//   mode: "run" | "plan-only" | "dry-run"   autoDeps (false)   force (false)
//   maxParallel (3, forced to 1 while config.generated)   maxFixRounds (2)   keepBranches (false)   maxDeliverables (12)
//   minBudgetPerDeliverable (700000; 150000 in plan-only): only with a token goal; checked before the preflight
//   overrideDonot: ["E19"] releases a deliverable vetoed by the roadmap "do not" block
//   acceptRisks: ["E18"] accepts a critical risk on a direct merge into the integrationBranch
//   acceptRedBaseline (false): lets the run go on with a red baseline
//   roadmap, repo, wtRoot, today: detected when absent
//   notes: { E19: "owner instruction or answer for this deliverable" } (also used to resume)
//   trailer, branchPrefix ("feat/")
//
// RETURN: { status: done|partial|needs-operator|error, operatorActions[], resumeArgs, selection,
//           results[], ownerReview { acceptedRisks[], decisionsPending[], criteriaOpen[] }, truth, reportPath }
// The workflow never asks during the run: it stops the run (preflight) or the deliverable (blocking human
// input, decision against a DEC, defect without a fix) and returns operatorActions with resumeArgs.

// <pure>
function cleanSlug(s, id) {
  return String(s || 'entrega').toLowerCase().replace(new RegExp('^' + String(id).toLowerCase() + '[-_]*'), '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'entrega'
}

// A merge on the target without a post-merge status means an interrupted run: validation and docs are still missing.
function isUnfinished(card, statuses) {
  const after = [...(statuses.integrated || []), statuses.onBranch, statuses.discarded]
  return !!card && !!card.mergeFound && !after.includes(card.status)
}

function selectDeliverables({ cards, statuses, selector, filters, heldBy, overrideDonot, autoDeps, force, maxDeliverables }) {
  const byId = Object.fromEntries(cards.map(c => [c.id, c]))
  const notes = []
  const skipped = []
  const fail = error => ({ order: [], skipped, notes, error })
  const done = c => !!c && ((c.onTarget && !isUnfinished(c, statuses)) || c.status === statuses.discarded)
  const satisfied = id => done(byId[id])
  const f = filters || {}
  const pool = cards.filter(c => (!f.phase || c.phase === f.phase) && (!f.priority || c.priority === f.priority) && (!f.track || c.track === f.track))
  const held = heldBy instanceof Map ? heldBy : new Map(Object.entries(heldBy || {}))
  const override = overrideDonot || []
  // A dependency cycle among cards still open is an error under every selector.
  const roots = Array.isArray(selector) ? selector.filter(id => byId[id]) : pool.map(c => c.id)
  const state = {}
  const stack = []
  const visit = id => {
    if (state[id] === 2 || !byId[id] || done(byId[id])) return null
    if (state[id] === 1) return stack.slice(stack.indexOf(id))
    state[id] = 1; stack.push(id)
    for (const d of byId[id].deps) { const cyc = visit(d); if (cyc) return cyc }
    stack.pop(); state[id] = 2
    return null
  }
  for (const id of roots) { const cyc = visit(id); if (cyc) return fail('ciclo ou dependência inválida entre: ' + cyc.join(', ')) }
  const sel = selector === undefined || selector === null ? 'next' : selector
  const want = new Set()
  if (Array.isArray(sel)) {
    const unknown = sel.filter(id => !byId[id])
    if (unknown.length) return fail('entregas desconhecidas: ' + unknown.join(', '))
    for (const id of sel) {
      if (done(byId[id]) && !force) notes.push(id + ': já concluída no alvo (' + byId[id].status + '); use force para refazer')
      else want.add(id)
    }
    if (autoDeps) {
      const add = id => { for (const d of byId[id].deps) if (byId[d] && !satisfied(d) && !want.has(d)) { want.add(d); add(d) } }
      for (const id of [...want]) add(id)
    }
  } else if (sel === 'next' || sel === 'ready' || sel === 'all') {
    const cand = pool.filter(c => !done(c))
    for (const c of cand.filter(c => c.status === statuses.blocked)) notes.push(c.id + ': status "' + statuses.blocked + '" no roadmap; não entra em "' + sel + '" (rode com deliverables:["' + c.id + '"] depois de resolver)')
    const open = cand.filter(c => c.status !== statuses.blocked)
    if (sel === 'all') open.forEach(c => want.add(c.id))
    else {
      let changed = true
      while (changed) {
        changed = false
        for (const c of open) {
          if (want.has(c.id)) continue
          if (c.deps.every(d => satisfied(d) || (sel === 'next' && want.has(d)))) { want.add(c.id); changed = true }
        }
      }
      for (const c of open.filter(c => !want.has(c.id))) notes.push(c.id + ': fora da seleção (dependências pendentes: ' + c.deps.filter(d => !satisfied(d) && !want.has(d)).join(', ') + ')')
    }
  } else return fail('deliverables inválido: ' + JSON.stringify(sel))
  for (const id of [...want]) {
    if (held.has(id) && !override.includes(id)) { want.delete(id); skipped.push({ id, reason: 'vetada pelo bloco "não fazer" do roadmap (' + held.get(id) + '); use overrideDonot:["' + id + '"] se o veto já não vale' }) }
  }
  const order = []
  const pending = new Set(want)
  let progress = true
  while (pending.size && progress) {
    progress = false
    for (const id of [...pending]) {
      const deps = byId[id].deps
      const missing = deps.filter(d => !satisfied(d) && !want.has(d))
      if (missing.length) { pending.delete(id); want.delete(id); skipped.push({ id, reason: 'dependências não satisfeitas no alvo e fora da seleção: ' + missing.join(', ') }); progress = true; continue }
      if (deps.every(d => satisfied(d) || order.includes(d))) { order.push(id); pending.delete(id); progress = true }
    }
  }
  if (pending.size) return fail('ciclo ou dependência inválida entre: ' + [...pending].join(', '))
  const max = Number.isInteger(maxDeliverables) && maxDeliverables >= 1 ? maxDeliverables : 12
  const cut = order.length > max ? order.splice(max) : []  // a topological prefix keeps dependencies satisfied
  for (const id of cut) skipped.push({ id, reason: 'acima de maxDeliverables (' + max + '); a ferramenta limita cada run a 1000 agentes' })
  for (const id of order) if (byId[id].criticalMissing) notes.push(id + ': card sem atributo critical (tratado como não crítico)')
  return { order, skipped, notes }
}
// ---- gates: generic measurement and baseline comparison
// def = { name, kind: 'exit'|'tests', invariant?, ignoreFailuresWhenChanged?: { paths, failurePrefix } }
// result = { name, ran, exit, total, skipped, failedNames }; baseline = map name -> result
function gateSubset(xs, base) {
  return (xs || []).every(x => (base || []).includes(x))
}
function gateShaMatch(x, y) {
  return !!x && !!y && (x.startsWith(y) || y.startsWith(x))
}
function gateResult(m, name) {
  return ((m && m.gates) || []).find(g => g && g.name === name)
}
function gateCoherent(def, r) {
  if (!r) return false
  if (def.kind === 'tests') return (r.exit === 0) === !(r.failedNames || []).length
  return true
}
// A measure only counts if taken on a clean tree, at the expected commit, with every gate present and exit/failed names agreeing.
function validMeasure(m, expectedSha, gateDefs) {
  return !!m && m.clean === true && (!expectedSha || gateShaMatch(m.headSha, expectedSha))
    && (gateDefs || []).every(def => gateCoherent(def, gateResult(m, def.name)))
}
function gatePasses(def, result, baselineResult) {
  if (!result || result.ran === false) return false
  const b = baselineResult || null
  if (def.invariant) return result.exit === 0
  if (def.kind === 'exit') return result.exit === 0 || (!!b && b.exit !== 0)
  const names = result.failedNames || []
  if (result.exit !== 0 && !names.length) return false
  if (!(result.exit === 0 || gateSubset(names, b && b.failedNames))) return false
  return (result.total || 0) >= Math.max(1, (b && b.total) || 0) && (result.skipped || 0) <= ((b && b.skipped) || 0)
}
function gateEffective(def, r, changedFiles) {
  const ign = def.ignoreFailuresWhenChanged
  if (!r || !ign) return r
  const touched = (changedFiles || []).some(f => (ign.paths || []).some(p => String(f).startsWith(p)))
  if (!touched) return r
  const names = (r.failedNames || []).filter(n => !String(n).startsWith(ign.failurePrefix))
  const allIgnored = (r.failedNames || []).length > 0 && names.length === 0
  return Object.assign({}, r, { failedNames: names, exit: allIgnored ? 0 : r.exit })
}
function allPass(defs, m, baseline, changedFiles) {
  const failures = (defs || []).filter(def => {
    const r = gateEffective(def, gateResult(m, def.name), changedFiles)
    return !gatePasses(def, r, (baseline || {})[def.name])
  }).map(def => def.name)
  return { ok: failures.length === 0, failures }
}
// Baseline red: an exit gate failing, a tests gate with no tests (or incoherent), or a violated invariant.
function isRedBaseline(defs, baseline) {
  return (defs || []).filter(def => {
    const r = (baseline || {})[def.name]
    if (!r || r.ran === false) return true
    if (def.invariant || def.kind === 'exit') return r.exit !== 0
    return !(r.total > 0) || !gateCoherent(def, r)
  }).map(def => def.name)
}
// Post-merge floor: the target may not have fewer tests than the branch measured (minus baseline failures already unstable).
function mergeFloor(baseline, branchMeasure) {
  const floor = JSON.parse(JSON.stringify(baseline || {}))
  for (const name of Object.keys(floor)) {
    const br = gateResult(branchMeasure, name)
    if (!br || typeof br.total !== 'number') continue
    floor[name].total = Math.max(floor[name].total || 0, br.total - (floor[name].failedNames || []).length)
  }
  return floor
}
// ---- reviews, acceptance evidence and resume
// Issue = { severity, category?, description, file?, blq? }
const hasBlq = (blqIds, id) => (blqIds instanceof Set ? blqIds.has(id) : (blqIds || []).includes(id))
// A critical issue always needs a fix, unless it is an environment limit already registered as a roadmap blocker.
function isHard(issue, blqIds) {
  const i = issue || {}
  return !i.category || i.category === 'defeito' || i.category === 'decisao'
    || (i.severity === 'critical' && !(i.category === 'ambiente' && hasBlq(blqIds, i.blq)))
}
function nextTier(tier, sameFindingAgain) {
  if (!sameFindingAgain) return tier
  if (tier === 'haiku') return 'sonnet'
  if (tier === 'sonnet') return 'opus'
  return null
}
function sameFinding(prevIssues, issues, blqIds) {
  const norm = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')
  return (issues || []).filter(i => isHard(i, blqIds)).some(i =>
    (prevIssues || []).some(p => (p.file || '') === (i.file || '') && norm(p.description) === norm(i.description)))
}
const VERIFY_EXEC = ['test', 'smoke', 'integration']
// Reads the suffix tag from the last "{verify:" up to the item's final "}", so evidence may hold ";", "}" and quotes.
function parseVerifyTag(item) {
  const text = String(item || '').trim()
  const at = text.lastIndexOf('{verify:')
  if (at === -1) return null
  if (!text.endsWith('}')) return { invalid: true }
  const body = text.slice(at + '{verify:'.length, -1)
  const m = /^\s*([a-z]+)(?:\s+(BLQ-\d+))?\s*;\s*evidence:([\s\S]*)$/.exec(body)
  if (!m) return { invalid: true }
  const kind = m[1]
  const out = { kind, evidence: m[3].trim() }
  if (m[2]) out.blq = m[2]
  const known = [...VERIFY_EXEC, 'human', 'blocked'].includes(kind)
  if (!known || (kind === 'blocked') !== !!m[2] || (VERIFY_EXEC.includes(kind) && !out.evidence)) out.invalid = true
  return out
}
// cardAc = [{ id, text, tag }]; planAc = [{ ac, kind, command?, testRef?, blq? }]
function evidenceGaps(cardAc, planAc, blqIds) {
  const gap = description => ({ severity: 'critical', category: 'defeito', description })
  const rows = planAc || []
  const out = []
  for (const a of cardAc || []) {
    const mine = rows.filter(p => p.ac === a.id)
    if (!mine.length) { out.push(gap(`criterion ${a.id} has no evidence row in the plan: ${a.text}`)); continue }
    const t = a.tag
    if (t && t.invalid) { out.push(gap(`criterion ${a.id} has an invalid {verify:} tag`)); continue }
    if (t && VERIFY_EXEC.includes(t.kind) && !mine.some(p => String(p.command || '').trim() === t.evidence))
      out.push(gap(`criterion ${a.id}: the plan changed the command bound by the card tag (${t.evidence})`))
    if (t && (t.kind === 'human' || t.kind === 'blocked') && !mine.some(p => p.kind === t.kind)) out.push(gap(`criterion ${a.id}: the plan replaced the ${t.kind} tag with another kind of evidence`))
    if (t && t.kind === 'blocked' && !hasBlq(blqIds, t.blq)) out.push(gap(`criterion ${a.id} tagged blocked without a registered blocker (blq=${t.blq || 'empty'})`))
  }
  for (const p of rows) {
    if (VERIFY_EXEC.includes(p.kind) && !p.command) out.push(gap(`criterion ${p.ac} has no evidence command`))
    if (p.kind === 'blocked' && !hasBlq(blqIds, p.blq)) out.push(gap(`criterion ${p.ac} marked blocked without a registered blocker (blq=${p.blq || 'empty'})`))
  }
  return out
}
// Highest k such that tasks 1..k are all committed; a gap is where the run resumes.
function lastContiguousDone(tasks, doneMap) {
  let last = 0
  for (const t of tasks || []) { if ((doneMap || {})[t.n]) last = t.n; else break }
  return last
}
function resumeAction(card, statuses, force) {
  return isUnfinished(card, statuses) && !force ? 'finish-merge' : 'run'
}
// ---- issues and per-task prompts
const SEV = s => s === 'critical' || s === 'important'
function blocking(r) {
  return r && Array.isArray(r.issues) ? r.issues.filter(i => SEV(i.severity)) : []
}
function fmt(iss) {
  return (iss || []).map((i, k) => `${k + 1}. [${i.severity}${i.category ? '/' + i.category : ''}] ${i.file || ''} ${i.description}`).join('\n')
}
function compact(iss) {
  return { blocking: (iss || []).filter(i => SEV(i.severity)), minor: (iss || []).filter(i => !SEV(i.severity)).length }
}
// What the script itself verifies about a review: blocking issues plus a commit in the range and a clean tree.
function reviewTruth(r, minCommits, label) {
  const iss = [...blocking(r)]
  if (r && r.commitsInRange < minCommits) iss.push({ severity: 'critical', category: 'defeito', description: `no commit in the range (${label})` })
  if (r && !r.clean) iss.push({ severity: 'critical', category: 'defeito', description: 'dirty working tree (uncommitted files)' })
  return iss
}
// The plan's tier drives the implementer; the reviewer is sonnet unless the plan marks blast radius 2 (reviewTier opus).
function implModel(task) {
  return ['haiku', 'sonnet', 'opus'].includes(task && task.tier) ? task.tier : 'sonnet'
}
function reviewModelFor(task) {
  return task && task.reviewTier === 'opus' ? 'opus' : 'sonnet'
}
// Criteria left open for a human: a human/blocked tag or any human/blocked plan row opens it, even next to a test row.
// Plan rows that match no card criterion are walked too.
function criteriaOpen(cardAc, planAc) {
  const open = k => k === 'human' || k === 'blocked'
  const out = []
  const seen = new Set()
  const add = (ac, kind, blq) => { if (!seen.has(ac)) { seen.add(ac); out.push({ ac, kind, blq }) } }
  for (const a of cardAc || []) {
    const t = a.tag && !a.tag.invalid ? a.tag : null
    const row = (planAc || []).find(p => p.ac === a.id && open(p.kind))
    if (t && open(t.kind)) add(a.id, t.kind, t.blq || (row && row.kind === t.kind ? row.blq : undefined))
    else if (row) add(a.id, row.kind, row.blq)
  }
  for (const p of planAc || []) if (open(p.kind) && !(cardAc || []).some(a => a.id === p.ac)) add(p.ac, p.kind, p.blq)
  return out
}
// One review/fix cycle. env = { maxFix, blqIds, reviews, concerns, acceptRisks(stage, issues) }.
// A finding that reappears after a fix escalates the fixer one tier (nextTier); the first escalation earns one extra
// round so a haiku task can reach opus; a repeat at opus stops the deliverable.
async function runReviewLoop(env, stage, review, fix, truth, opt = {}) {
  let tier = opt.tier || 'opus'
  const rm = opt.reviewModel || 'sonnet'
  const rounds = []
  const note = (round, fixTier) => rounds.push({ round, reviewModel: rm, fixTier: fixTier || null })
  const record = (r, iss) => env.reviews.push({ stage, rounds, ...compact(r && r.issues), unresolved: iss || [] })
  const kindOf = hard => (hard.some(i => i.category === 'decisao') ? 'decisao' : 'conteudo')
  let r = await review(1, null)
  note(1)
  if (!r) { r = await review('1b', null); note('1b') }
  if (!r) { record(r); return { ok: false, kind: 'infra', msg: `${stage}: null review` } }
  let iss = truth(r)
  let bonus = false
  for (let k = 1; iss.length && env.maxFix > 0 && k <= env.maxFix + (bonus ? 1 : 0); k++) {
    const fixable = iss.filter(i => isHard(i, env.blqIds))  // ambiente/fora-do-escopo/pelo-plano do not spend a fix
    if (!fixable.length) break
    const fx = await fix(fixable, k, tier)
    if (!fx) { record(r, iss); return { ok: false, kind: 'infra', msg: `${stage}: null fix` } }
    if (fx.status === 'BLOCKED') { record(r, iss); return { ok: false, kind: 'conteudo', msg: `${stage}: fix BLOCKED: ${fx.summary}` } }
    if (fx.concerns) env.concerns.push(`${stage} fix${k}: ${fx.concerns}`)
    const fixTier = tier
    r = await review(k + 1, fmt(iss))
    note(k + 1, fixTier)
    if (!r) { record(r, iss); return { ok: false, kind: 'infra', msg: `${stage}: null re-review` } }
    iss = truth(r)
    if (sameFinding(fixable, iss, env.blqIds)) {
      const up = nextTier(tier, true)
      if (!up) {
        record(r, iss)
        const hard = iss.filter(i => isHard(i, env.blqIds))
        return { ok: false, kind: kindOf(hard), msg: `${stage}: the same finding reappeared after a fix at opus:\n${fmt(hard)}` }
      }
      tier = up
      bonus = true
    }
  }
  record(r, iss)
  if (!iss.length) return { ok: true, r }
  const hard = iss.filter(i => isHard(i, env.blqIds))
  if (hard.length) return { ok: false, kind: kindOf(hard), msg: `${stage} has open issues after ${env.maxFix} fixes:\n${fmt(hard)}` }
  env.acceptRisks(stage, iss)
  return { ok: true, r }
}
// ctx = { base, envFacts, baseline, E, wt, planPath, specPath, start, locks[], round?, prev? }
function briefing(ctx) {
  return `${ctx.base}\nENVIRONMENT MEASURED IN THE PREFLIGHT: ${ctx.envFacts || '(not reported)'}\nCURRENT BASELINE OF THE TARGET (a failure is pre-existing only if it is listed here): ${ctx.baseline || '(none)'}`
}
function lockNote(locks) {
  return locks && locks.length ? `You HOLD the lock(s): ${locks.join(', ')}.` : 'You hold no lock.'
}
function buildImplPrompt(ctx, task) {
  return `${briefing(ctx)}

Implement ONLY Task ${task.n} ("${task.title}") of the plan ${ctx.planPath}. STOP after this task: do not start the next one. ${lockNote(ctx.locks)}
Follow TDD (superpowers:test-driven-development). Run the task's checks; a failure is pre-existing only if it is in the BASELINE or listed as expected in the plan. Commit "${ctx.E} T${task.n}: ..." with only the task's files (plan list: ${(task.files || []).join(', ') || 'see the plan'}).
Report in "checks" EVERY verification you ran, with the exact command, its real output (the relevant part) and its exit code: the reviewer reads this instead of trusting your summary. Never invent or paraphrase output.
Status: DONE; DONE_WITH_CONCERNS (describe in concerns); BLOCKED (impossible without changing the plan, or it needs a lock you do not hold: set needsLock=<name>); NEEDS_HUMAN (depends on human input: humanInputs + placeholder implemented).`
}
// Failures show at the end of the output, so a long output keeps its tail.
function tailOf(output) {
  const o = String(output || '')
  return o.length > 3000 ? '[...truncated...]\n' + o.slice(-3000) : o
}
function repeatRule() {
  return 'If an item of the previous round is still unresolved, report it again with the exact same file and description as listed (same wording), so the script can detect the repeat; do not reword it.'
}
function fmtChecks(checks) {
  if (!checks || !checks.length) return '(no checks reported: unless the summary says the task was resumed from a previous run, a task that claims to be done without any check output is a defect)'
  return checks.map(c => `$ ${c.command}\nexit ${c.exit}\n${tailOf(c.output)}`).join('\n---\n')
}
function buildTaskReviewPrompt(ctx, task, kind, impl) {
  const spec = kind === 'spec'
  return `${briefing(ctx)}

Review of ${spec ? 'SPEC COMPLIANCE' : 'CODE QUALITY'} (read-only; do not trust the implementer's report, read the code) of Task ${task.n} ("${task.title}") of the plan ${ctx.wt}/${ctx.planPath}, spec ${ctx.wt}/${ctx.specPath}.
Range: git -C "${ctx.wt}" log -p ${ctx.start}..HEAD.
${spec
    ? 'Blocks: a missing task requirement, behavior that diverges from the spec, extra scope (category defeito), a missing test or a test that does not test what it says, a file outside the task list without justification, a canonical gate changed or a registered decision contradicted (category decisao), an edit to the roadmap folder.'
    : 'Blocks: a bug, a security problem, a violated project convention (see the PROJECT block), a fragile test. Also confirm there is no regression against the spec.'}
IMPLEMENTER'S CHECKS (command, exit code and output as reported; re-run the ones you doubt and treat a mismatch as a defect). You hold no lock: do not re-run a check that needs a resource protected by a shared lock; judge it from the reported output. Implementer summary: ${(impl && impl.summary) || '(none)'}
${fmtChecks(impl && impl.checks)}
Evidence that the MEASURED ENVIRONMENT cannot produce is category "ambiente", not defeito, if the plan foresaw the alternative evidence (cite in blq the registered blocker, if any).${ctx.prev ? `\nIssues from the previous round (verify them; ${repeatRule()}):\n${ctx.prev}` : ''}
Measure: headSha, clean, commitsInRange (git -C "${ctx.wt}" rev-list --count ${ctx.start}..HEAD).`
}
// </pure>

// ---------------------------------------------------------------- args and config
const A = args || {}
const intArg = (v, d, min) => (Number.isInteger(v) && v >= min ? v : d)
const asList = v => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v])
const CFG = A.config
const OPS = []  // operator actions (strictly necessary ones)
const op = (kind, deliverable, what, doNow, resumeWith) => OPS.push({ kind, deliverable, what, doNow, resumeWith })
const MODE = A.mode || 'run'
const RESULTS = []
const mkResult = (status, extra) => ({
  status, mode: MODE, operatorActions: OPS, resumeArgs: { ...A }, selection: null, results: RESULTS,
  ownerReview: { acceptedRisks: [], decisionsPending: [], criteriaOpen: [] }, truth: null, reportPath: null, ...(extra || {}),
})
if (!CFG || typeof CFG !== 'object' || !Array.isArray(CFG.gates) || !CFG.gates.length) {
  return { status: 'error', error: 'args.config is missing or has no gates: run scripts/preflight.mjs and pass its config' }
}
if (!['run', 'plan-only', 'dry-run'].includes(MODE)) return { status: 'error', error: `invalid mode: ${MODE}` }
const unfilledNotes = Object.keys(A.notes || {}).filter(k => /^\s*<.*>\s*$/.test(String(A.notes[k])))
if (unfilledNotes.length) return { status: 'error', error: `notes still hold the template text, without the owner's answer: ${unfilledNotes.join(', ')}` }
const MAXFIX = intArg(A.maxFixRounds, 2, 0)
const MAXPAR = CFG.generated ? 1 : intArg(A.maxParallel ?? CFG.maxParallel, 3, 1)  // a generated config may hide a shared resource
const PREFIX = A.branchPrefix || 'feat/'
const TRAILER = A.trailer || 'Co-Authored-By: Claude <noreply@anthropic.com>'
const PROJECT = CFG.projectContext || ''
const GATES = CFG.gates
const INSTALL = CFG.install || ''
const SETUP_CMDS = asList(CFG.setup)
const ACCEPT_RED = !!(A.acceptRedBaseline || CFG.acceptRedBaseline)

// ---------------------------------------------------------------- utilities
function makeLock() {
  let tail = Promise.resolve()
  return fn => { const run = tail.then(() => fn()); tail = run.then(() => {}, () => {}); return run }
}
function makeSem(n) {
  let active = 0
  const q = []
  const pump = () => {
    if (active >= n || !q.length) return
    active++
    const { fn, res, rej } = q.shift()
    Promise.resolve().then(fn).then(res, rej).finally(() => { active--; pump() })
  }
  return fn => new Promise((res, rej) => { q.push({ fn, res, rej }); pump() })
}
// One lock per configured name, "merge" always first. Locks are always taken in this fixed order, never the inverse.
const LOCK_ORDER = ['merge', ...asList(CFG.locks).filter(n => n !== 'merge')]
const LOCKS = Object.fromEntries(LOCK_ORDER.map(n => [n, makeLock()]))
const mergeLock = LOCKS.merge  // integration worktree: merges, records and docs
const setupLock = makeLock()   // git worktree add and install are not concurrency-safe
const withLocks = (names, fn) => {
  const need = LOCK_ORDER.filter(n => asList(names).includes(n))
  return need.reduceRight((inner, n) => () => LOCKS[n](inner), fn)()
}
const gateLocks = def => asList(def.needsLock)
let blqIds = new Set()  // blockers registered on the roadmap (filled after discovery)

// ---------------------------------------------------------------- schemas
const STR = { type: 'string' }, INT = { type: 'integer' }, BOOL = { type: 'boolean' }
const STRS = { type: 'array', items: STR }
const S_DISC = { type: 'object', properties: {
  error: STR, repo: STR, today: STR, wtRoot: STR, roadmapDir: STR, roadmapSlug: STR, strategy: STR, checker: STR,
  integrationBranch: STR, releaseBranch: STR, target: STR, integratedStatuses: STRS, discardedStatus: STR, blockedStatus: STR, deliverableStatuses: STRS,
  targetExists: BOOL, readFrom: STR, trackerAvailable: BOOL, checkerExists: BOOL,
  cards: { type: 'array', items: { type: 'object', properties: {
    id: STR, title: STR, phase: STR, track: STR, priority: STR, deps: STRS, reqs: STRS, critical: BOOL, criticalMissing: BOOL,
    status: STR, mergeCommit: STR, onTarget: BOOL, mergeFound: BOOL, mergeSha: STR, onTargetEvidence: STR, acceptance: { type: 'array', items: { type: 'object', properties: { id: STR, text: STR }, required: ['id', 'text'] } } }, required: ['id', 'deps', 'reqs', 'status', 'onTarget'] } },
  blockers: { type: 'array', items: { type: 'object', properties: { id: STR, text: STR, affects: STRS }, required: ['id', 'text'] } },
  donot: STRS,
  donotHolds: { type: 'array', items: { type: 'object', properties: { text: STR, affects: STRS }, required: ['text', 'affects'] } },
}, required: ['cards'] }
const S_GATE = { type: 'object', properties: { name: STR, ran: BOOL, exit: INT, total: INT, skipped: INT, failedNames: STRS }, required: ['name', 'ran', 'exit'] }
const S_MEASURE = { type: 'object', properties: { headSha: STR, clean: BOOL, gates: { type: 'array', items: S_GATE }, log: STR }, required: ['headSha', 'clean', 'gates'] }
const S_PRE = { type: 'object', properties: {
  ok: BOOL, errorKind: { type: 'string', enum: ['dirty', 'setup', 'target', 'other'] }, error: STR,
  integrationWorktree: STR, targetHead: STR, clean: BOOL, envFacts: STR, baseline: S_MEASURE,
}, required: ['ok'] }
const S_SETUP = { type: 'object', properties: { ok: BOOL, error: STR, worktree: STR, branch: STR, baseCommit: STR, head: STR, reused: BOOL, clean: BOOL }, required: ['ok'] }
const HUMAN = { type: 'array', items: { type: 'object', properties: { blq: STR, what: STR, workaround: STR, blocking: BOOL }, required: ['what'] } }
const ISSUES = { type: 'array', items: { type: 'object', properties: {
  severity: { type: 'string', enum: ['critical', 'important', 'minor'] },
  category: { type: 'string', enum: ['defeito', 'decisao', 'ambiente', 'fora-do-escopo', 'pelo-plano'] },
  description: STR, file: STR, blq: STR }, required: ['severity', 'description'] } }
const TIER = { type: 'string', enum: ['haiku', 'sonnet', 'opus'] }
const S_SPEC = { type: 'object', properties: { specPath: STR, slug: STR, decisions: STRS, humanInputs: HUMAN, reused: BOOL }, required: ['specPath', 'decisions', 'humanInputs'] }
const S_PLAN = { type: 'object', properties: { planPath: STR, roadmapHeader: BOOL, reused: BOOL,
  ac: { type: 'array', items: { type: 'object', properties: { ac: STR, kind: { type: 'string', enum: ['test', 'smoke', 'integration', 'human', 'blocked'] }, command: STR, testRef: STR, blq: STR }, required: ['ac', 'kind'] } },
  tasks: { type: 'array', items: { type: 'object', properties: { n: INT, title: STR, files: STRS, tier: TIER, reviewTier: { type: 'string', enum: ['sonnet', 'opus'] }, needsLock: STRS }, required: ['n', 'title', 'tier'] } } }, required: ['planPath', 'tasks'] }
const S_REVIEW = { type: 'object', properties: { issues: ISSUES, summary: STR, headSha: STR, clean: BOOL, commitsInRange: INT }, required: ['issues', 'headSha', 'clean', 'commitsInRange'] }
const S_CHECKS = { type: 'array', items: { type: 'object', properties: { command: STR, output: STR, exit: INT }, required: ['command', 'output', 'exit'] } }
const S_IMPL = { type: 'object', properties: { status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_HUMAN'] }, summary: STR, concerns: STR, humanInputs: HUMAN, needsLock: STR, checks: S_CHECKS }, required: ['status', 'summary', 'checks'] }
const S_PROGRESS = { type: 'object', properties: { head: STR, clean: BOOL, done: { type: 'array', items: { type: 'object', properties: { n: INT, firstParent: STR, last: STR }, required: ['n', 'firstParent', 'last'] } } }, required: ['head', 'clean', 'done'] }
const S_STATUS = { type: 'object', properties: { checkerErrors: INT, statusWritten: STR, commit: STR, head: STR, details: STR }, required: ['checkerErrors', 'statusWritten'] }
const S_ROLLBACK = { type: 'object', properties: { ok: BOOL, head: STR, clean: BOOL, leftovers: STRS }, required: ['ok', 'head', 'clean'] }

// ---------------------------------------------------------------- discovery
phase('Descoberta')
const PRE_TARGET = A.targetBranch || CFG.releaseBranch || ''
const disc = await agent(`DISCOVERY task (read-only; change nothing). Answer with measured data.
1. Repository: ${A.repo || 'the git repository of the current directory'} (git rev-parse --show-toplevel). Today (YYYY-MM-DD): ${A.today || 'take it from the system'}.
2. Roadmap folder: ${A.roadmap || 'the only folder under docs/plans/ with a roadmap.config.json (if there are several, return error listing them)'}. From roadmap.config.json read: strategy (relative to the folder), integrationBranch, releaseBranch (empty when absent) and vocab (deliverableStatuses in order, integratedStatuses, discardedStatus, blockedStatus). roadmapDir and strategy are RELATIVE to the repo root, with "/", roadmapDir ending in "/". roadmapSlug = folder name without the "roadmap-" prefix. checker = <roadmapDir>check-roadmap.mjs; checkerExists.
3. Target branch: ${PRE_TARGET ? `"${PRE_TARGET}"` : 'the roadmap releaseBranch if not empty, else "integracao/<roadmapSlug>"'}. Return it in target; targetExists = git rev-parse --verify. READ state.md and the strategy FROM THE TARGET (git show <target>:<path>) if it exists; otherwise from the branch "${A.baseBranch || '<integrationBranch>'}". readFrom = the branch read.
4. Cards: in the strategy, each "<!-- roadmap:card id=... phase=... track=... priority=... depends=... reqs=... critical=... -->" and the title "### E<n> -- <title>" below it. depends "-" means []. When critical is missing, critical=false and criticalMissing=true. acceptance: each numbered item of the card's <!-- roadmap:acceptance --> block, verbatim, with id "AC1", "AC2"... in order.
5. Status: the <!-- roadmap:panel --> block of the state.md read; mergeCommit = first hash in backticks in the Evidence column, if any.
6. Per card (git truth; if the target does not exist use the branch read): mergeFound = git log --first-parent <target> --grep "^merge: <id> " finds a commit and there is no later commit whose subject is 'Revert "merge: <id> ' (a reverted merge means mergeFound=false and onTarget=false, ignore the other rules). mergeSha = that commit. onTarget = true if mergeFound, or if mergeCommit is an ancestor of the target, or if the status is in integratedStatuses and the integrationBranch is an ancestor of the target. The branch ${PREFIX}<id> being an ancestor of the target does NOT count: it is born from the target. Explain in onTargetEvidence.
7. blockers: rows of the <!-- roadmap:blockers --> table (id, text, affects = deliverables in the Affects column). donot: items of the <!-- roadmap:donot --> block, verbatim. donotHolds: for each donot item, { text: the item, affects: ids of the cards whose main object is exactly what the item forbids (read card title and criteria; "do not migrate X" only affects the card that migrates X; when in doubt, do not list) }.
8. trackerAvailable: the skill productivity-tools:roadmap-tracker appears in your skill list.
9. wtRoot: ${A.wtRoot || 'if git worktree list shows worktrees outside the repo, their common parent directory; otherwise <repo parent>/<repo name>-wt'} (with "/").`,
  { label: 'discovery', phase: 'Descoberta', schema: S_DISC, model: 'sonnet' })
if (!disc || disc.error || !disc.cards || !disc.cards.length) return { status: 'error', error: `discovery failed: ${disc ? disc.error || 'no cards' : 'null agent'}` }
disc.cards.forEach(c => { c.deps = c.deps || []; c.reqs = c.reqs || [] })

const TODAY = A.today || disc.today
const REPO = disc.repo
const WT = String(A.wtRoot || disc.wtRoot).replace(/\/+$/, '')
const RM = disc.roadmapDir
const STRAT = disc.strategy
const INTEG = disc.integrationBranch || 'main'
const BASEBR = A.baseBranch || INTEG
const TARGET = A.targetBranch || CFG.releaseBranch || disc.releaseBranch || `integracao/${disc.roadmapSlug}`
const STATUSES = {
  integrated: disc.integratedStatuses && disc.integratedStatuses.length ? disc.integratedStatuses : ['integrada', 'publicada', 'medida'],
  plan: (disc.deliverableStatuses || [])[2] || 'plano',
  executing: (disc.deliverableStatuses || [])[3] || 'executando',
  onBranch: (disc.deliverableStatuses || [])[4] || 'na-branch',
  discarded: disc.discardedStatus || 'descartada',
  blocked: disc.blockedStatus || 'bloqueada',
}
const STATUS_AFTER_MERGE = TARGET === INTEG ? STATUSES.integrated[0] : STATUSES.onBranch
if (TARGET === INTEG && !A.allowIntegrationBranch) return { status: 'error', error: `targetBranch (${TARGET}) is the integrationBranch; pass allowIntegrationBranch: true to merge into it.` }
if (disc.trackerAvailable === false) return { status: 'error', error: 'the skill productivity-tools:roadmap-tracker is not available to the subagents' }
if (disc.checkerExists === false) return { status: 'error', error: `checker ${disc.checker} does not exist` }

// ---------------------------------------------------------------- selection
const byId = Object.fromEntries(disc.cards.map(c => [c.id, c]))
const heldMap = new Map((disc.donotHolds || []).flatMap(h => (h.affects || []).filter(id => byId[id]).map(id => [id, h.text])))
const picked = selectDeliverables({
  cards: disc.cards, statuses: STATUSES, selector: A.deliverables,
  filters: { phase: A.phase, priority: A.priority, track: A.track },
  heldBy: MODE === 'plan-only' ? new Map() : heldMap,
  overrideDonot: A.overrideDonot, autoDeps: !!A.autoDeps, force: !!A.force, maxDeliverables: A.maxDeliverables,
})
if (picked.error) return { status: 'error', error: picked.error }
const order = picked.order
const notes = [...picked.notes, ...(disc.donot || []).map(d => `roadmap "do not" restriction (check before running): ${d}`)]
const isDone = c => !!c && ((c.onTarget && !isUnfinished(c, STATUSES)) || c.status === STATUSES.discarded)
const selection = { target: TARGET, base: BASEBR, integrationBranch: INTEG, readFrom: disc.readFrom, statusAfterMerge: STATUS_AFTER_MERGE, order, skippedUpfront: picked.skipped, notes,
  deps: Object.fromEntries(order.map(id => [id, byId[id].deps.map(d => `${d}:${isDone(byId[d]) ? 'on target' : 'in this run'}`)])) }
log(`selection: ${order.join(' -> ') || '(empty)'}${picked.skipped.length ? ` | skipped: ${picked.skipped.map(s => s.id).join(', ')}` : ''}`)
if (MODE === 'dry-run' || !order.length) return mkResult(order.length ? 'done' : 'partial', { selection })
const MIN_BUDGET = intArg(A.minBudgetPerDeliverable, MODE === 'plan-only' ? 150000 : 700000, 0)
if (typeof budget !== 'undefined' && budget.total && budget.remaining() < MIN_BUDGET) {
  return mkResult('partial', { error: `remaining budget (${budget.remaining()}) is below the minimum per deliverable (${MIN_BUDGET})`, selection })
}

// ---------------------------------------------------------------- shared briefing
blqIds = new Set((disc.blockers || []).map(b => b.id))
const donotTxt = (disc.donot || []).map(d => `  * ${d}`).join('\n') || '  (none)'
const blockersTxt = (disc.blockers || []).map(b => `${b.id}: ${b.text}`).join('\n') || '(none)'
const gateDesc = def => `${def.name} (${def.kind}${def.invariant ? ', invariant' : ''}${gateLocks(def).length ? `, needs lock ${gateLocks(def).join('+')}` : ''}): ${def.cmd}`
const gatesTxt = GATES.map(gateDesc).join('; ')
const COMMON_BASE = `
FIXED RULES:
- Tracked roadmap in ${RM} (strategy: ${STRAT}). Registered decisions (${RM}decisions.md and those cited in the PROJECT block) are NEVER reopened or contradicted.
- The owner PRE-APPROVED: when a skill asks for confirmation or a choice, take the recommended option, record it and go on. Asking the user is FORBIDDEN (do not use AskUserQuestion).
- Inputs only humans can provide: do not invent the data; use a configurable placeholder or a marked synthetic fixture and report it in humanInputs. Open roadmap blockers:
${blockersTxt}
  Human acts also include: sessions with users, acceptances, owner approvals, go/no-go, credentials and external accounts. Produce the artifacts; never record a fictional acceptance.
- Roadmap "do not" restrictions (violating any is category decisao, severity critical):
${donotTxt}
- Git: commits only on your deliverable branch (or on the target ${TARGET}, only in the record, merge and docs stages). NEVER push. NEVER touch the branch ${INTEG}${TARGET === INTEG ? ' outside the merge/docs stages' : ''} or the worktree ${REPO}. NEVER use git stash or git add -A: add only your task's files. Commit messages end with the line "${TRAILER}".
- Delivery branches do NOT edit the roadmap folder ${RM} (that is done only in the record and docs stages, on the target).
- When done, the working tree must be clean (git status --porcelain empty). Line-ending-only differences: git checkout -- <file>.
- Temporary files only in ${WT}/_tmp/<your label>/ (create and delete when done). Nothing loose in ${WT}/. Scripts: write them to a file and run it; never an unquoted shell heredoc containing backticks.
- Processes: start servers only if the task needs them, in your deliverable's port range; stop everything you started before returning.
- Shared resources: only agents told they HOLD a lock may use the resource that lock protects (${LOCK_ORDER.join(', ')}). Without the lock and needing it: return BLOCKED with needsLock=<name>.
- Canonical gates: ${gatesTxt}.
- Reviewers classify each problem with category: defeito (bug or unmet criterion), decisao (contradicts a registered decision), ambiente (limit of the local environment, not of the code; when a roadmap blocker is registered, cite its id in blq), fora-do-escopo (only a PRE-EXISTING problem outside the deliverable), pelo-plano (the plan foresaw it). A defect introduced by this diff is never fora-do-escopo nor pelo-plano. Excess scope is a defect.
- Autonomous decisions follow the recommended option and are recorded for the owner (Origin executor, status pending). Contradicting a registered decision, or changing a canonical gate (its command, kind or threshold), is category decisao, severity critical.
- Write code and generated artifacts in the language of the roadmap, consistent with the project.
${CFG.conflictRules ? `- Conflicts in generated files: ${CFG.conflictRules}\n` : ''}PROJECT:
${PROJECT}`

// ---------------------------------------------------------------- preflight
phase('Preflight')
const measureTxt = defs => `For each gate run its command and report { name, ran, exit, total, skipped, failedNames }:\n${defs.map(d => `- ${gateDesc(d)}${d.kind === 'tests' ? '' : ' (only name, ran and exit matter)'}`).join('\n')}\nFor "tests" gates read the output: total = tests executed, skipped = tests skipped, failedNames = each failing test as path/of/file::test name (a file that does not even load counts as path/of/file::(collect)). A non-zero exit requires failedNames and failedNames require a non-zero exit. ran=false only when the command cannot run at all. Real numbers, never estimates.`
const pre = await agent(`${COMMON_BASE}

PREFLIGHT (once per run). ${MODE === 'plan-only' ? 'plan-only mode: do only steps 1, 2 and 5.' : 'You HOLD every lock.'}
1. If the branch ${TARGET} does not exist, create it from ${BASEBR}: git -C "${REPO}" branch ${TARGET} ${BASEBR}. git -C "${REPO}" config rerere.enabled true.
2. Integration worktree: if git worktree list already shows ${TARGET}, use that path; otherwise git -C "${REPO}" worktree add "${WT}/_integracao" ${TARGET}. If a merge is in progress whose message (file of git rev-parse --git-path MERGE_MSG) starts with "merge: E", it is an interrupted previous run: run git merge --abort. A merge from another origin counts as dirty. It must be clean; if not, do NOT clean it: ok=false, errorKind="dirty", list the files in error.
3. ${MODE === 'plan-only' ? '(skip)' : SETUP_CMDS.length ? `Environment setup, in the integration worktree, in order: ${SETUP_CMDS.map(c => `"${c}"`).join('; ')}. If one fails, ok=false, errorKind="setup", with the output in error.` : 'No setup commands.'}
4. ${MODE === 'plan-only' ? '(skip)' : `BASELINE in the integration worktree. First, BEFORE any command: clean (git status --porcelain empty) and headSha (git rev-parse HEAD). Install first${INSTALL ? ` (${INSTALL})` : ' (nothing to install)'}. Then measure every gate. ${measureTxt(GATES)}`}
5. envFacts (short, factual text used by every agent): available shells, presence and version of the tools the gates need, measured peculiarities (for example CRLF, scripts that require bash).
Return ok, errorKind, error, integrationWorktree, targetHead (git rev-parse HEAD of the integration worktree), clean, envFacts${MODE === 'plan-only' ? '' : ', baseline { headSha, clean, gates }'}.`,
  { label: 'preflight', phase: 'Preflight', schema: S_PRE, model: 'sonnet' })
if (!pre || !pre.ok || !pre.integrationWorktree || (MODE !== 'plan-only' && !pre.baseline)) {
  const kind = pre ? pre.errorKind || 'other' : 'other'
  op(`preflight:${kind}`, null, pre ? pre.error || 'incomplete preflight' : 'null preflight agent',
    kind === 'dirty' ? `Clean or commit the listed files in the integration worktree of ${TARGET}` : kind === 'setup' ? 'Fix the environment setup command and run again' : 'Read the error and fix the environment',
    { ...A })
  return mkResult('needs-operator', { selection })
}
const INTWT = pre.integrationWorktree
const BASE = {}  // baseline: gate name -> GateResult
for (const g of (pre.baseline && pre.baseline.gates) || []) if (g && g.name) BASE[g.name] = g
let lastGood = pre.targetHead || TARGET  // target tip already validated; only changes inside the merge lock
if (MODE === 'run') {
  if (!validMeasure(pre.baseline, pre.targetHead, GATES)) {
    op('preflight:baseline-invalid', null, 'the baseline measure is invalid (dirty tree, wrong commit or a gate with inconsistent exit and failing names)',
      'Check the integration worktree and the gate commands, then run again', { ...A })
    return mkResult('needs-operator', { selection })
  }
  const red = isRedBaseline(GATES, BASE)
  if (red.length && !ACCEPT_RED) {
    op('preflight:red-baseline', null, `baseline of ${TARGET} is red in: ${red.join(', ')}`,
      'Fix the target (or the environment) before running; with a red baseline the matching gates stop blocking regressions. To accept it anyway, pass acceptRedBaseline:true', { ...A })
    return mkResult('needs-operator', { selection })
  }
}
const resultTxt = r => (r ? `exit ${r.exit}${typeof r.total === 'number' ? `, total ${r.total}, skipped ${r.skipped || 0}, failing [${(r.failedNames || []).join(', ')}]` : ''}` : 'not measured')
const baseTxt = () => GATES.map(d => `${d.name}: ${resultTxt(BASE[d.name])}`).join(' | ')
const COMMON = () => `${COMMON_BASE}
ENVIRONMENT MEASURED IN THE PREFLIGHT: ${pre.envFacts || '(not reported)'}
CURRENT BASELINE OF THE TARGET (a failure is pre-existing only if it is listed here): ${baseTxt()}`

// ---------------------------------------------------------------- roadmap record (serialized on the target)
let integBroken = null
const recordStatus = (E, status, evidence, extraTxt) => mergeLock(async () => {
  if (integBroken) return null
  const r = await agent(`${COMMON()}

RECORD STAGE in the integration worktree ${INTWT} (branch ${TARGET}). Use the skill productivity-tools:roadmap-tracker to record deliverable ${E} with status "${status}" (vocabulary: ${(disc.deliverableStatuses || []).join(', ')}), evidence: ${evidence}.${extraTxt ? '\n' + extraTxt : ''}
Run node ${disc.checker} and leave it with 0 errors. Commit only files of ${RM}. Return checkerErrors, statusWritten, commit, head (git rev-parse HEAD after the commit), details.`,
    { label: `${E}:status-${status}`, phase: 'Plano', schema: S_STATUS, model: 'sonnet' })
  if (r && r.head) lastGood = r.head  // a record-only commit does not invalidate what was already validated
  return r
})

// ============================================================================ one deliverable
async function runDeliverable(E, idx) {
  const card = byId[E]
  const wt = `${WT}/${E}`
  const br = `${PREFIX}${E}`
  const port = 5200 + idx * 10
  const human = []
  const out = { id: E, merged: false, ok: false, human, concerns: [], acceptedRisks: [], reviews: [] }
  const baseOf = () => `${COMMON_BASE}
DELIVERABLE ${E}: worktree ${wt}, branch ${br}, port range ${port}-${port + 9}.${(A.notes && A.notes[E]) ? `\nOWNER INSTRUCTION OR ANSWER FOR ${E}: ${A.notes[E]}` : ''}`
  const ctxFor = extra => ({ base: baseOf(), envFacts: pre.envFacts, baseline: baseTxt(), E, wt, planPath: plan && plan.planPath, specPath: spec && spec.specPath, locks: [], ...extra })
  const C = () => briefing(ctxFor())
  const cardRef = `card ${E} in ${STRAT} (section ${E}; REQs ${card.reqs.join(', ')}; depends on ${card.deps.join(', ') || '-'}${card.critical ? '; CRITICAL' : ''})`
  const noteE = A.notes && A.notes[E]
  const cardAc = (card.acceptance || []).map(a => ({ id: a.id, text: a.text, tag: parseVerifyTag(a.text) }))
  const TASK_LOCKS = LOCK_ORDER.filter(n => n !== 'merge')
  let slug = 'entrega'
  let spec = null, plan = null
  let specRef = null, planRef = null  // null while recovering an interrupted merge
  const fmtRisk = x => `${x.stage}: [${x.severity}/${x.category}] ${x.description}`
  const acceptRisks = (stage, issues) => out.acceptedRisks.push(...issues.map(i => ({ stage, severity: i.severity, category: i.category, description: i.description, file: i.file })))
  const persistReviews = async tag => {
    if (!out.reviews.length) return
    await agent(`${C()}

Write docs/superpowers/reviews/${TODAY}-${E}-${slug}-reviews.md on the branch ${br}, in the language of the roadmap, with the review log: per stage or task, the rounds (round number, reviewer model, tier of the fix that preceded it), the critical/important issues with category and description, the count of minor ones, unresolved items and accepted risks, plus concerns and gates. Transcribe faithfully; do not summarize blocking issues. Data: ${JSON.stringify({ reviews: out.reviews, acceptedRisks: out.acceptedRisks, concerns: out.concerns, gates: out.gates, tasks: out.tasks, failure: out.error || null })}
Commit only that file ("${E}: review log${tag ? ' (' + tag + ')' : ''}").`,
      { label: `${E}:review-log${tag ? '-' + tag : ''}`, phase: 'Plano', model: 'sonnet' })
  }
  const fail = async (kind, msg) => {
    out.error = msg; out.failKind = kind; out.branch = br; out.worktree = wt
    await persistReviews('failed')
    return out
  }

  const reviewLoop = (...a) => runReviewLoop({ maxFix: MAXFIX, blqIds, reviews: out.reviews, concerns: out.concerns, acceptRisks }, ...a)

  // Clears uncommitted files left by an interrupted run; the patch is kept in _tmp.
  const sanitize = async stage => {
    const dir = `${WT}/_tmp/${E}-dirty`
    const r = await agent(`RESUME CLEANUP in worktree ${wt} (branch ${br}), left with uncommitted files from an interrupted run. Only in this worktree:
1. mkdir -p "${dir}"; git -C "${wt}" diff --binary HEAD > "${dir}/${stage}.patch"; git -C "${wt}" ls-files --others --exclude-standard > "${dir}/${stage}-untracked.txt" and copy those files into "${dir}/${stage}-untracked/".
2. git -C "${wt}" reset --hard HEAD; git -C "${wt}" clean -fd.
3. Return ok, head (git rev-parse HEAD), clean (status --porcelain empty), leftovers.`,
      { label: `${E}:clean-${stage}`, phase: 'Setup', schema: S_ROLLBACK, model: 'haiku' })
    if (!r || !r.ok || r.clean === false) return false
    out.concerns.push(`resume: uncommitted files from a previous run were discarded; patch in ${dir}`)
    return true
  }

  // A merge already on the target without a post-merge status: Task 8 finishes validation and docs.
  if (resumeAction(card, STATUSES, A.force) === 'finish-merge' && MODE === 'run') {
    out.status = 'partial'
    return fail('infra', 'not implemented (finish-merge)')
  }

  // ---------- Setup
  const setup = await setupLock(() => agent(`${C()}

SETUP of deliverable ${E} (mechanical; do not change tracked files).
1. If ${wt} is already a registered worktree, reuse it (reused=true). Otherwise, if the branch ${br} exists: git -C "${REPO}" worktree add "${wt}" ${br}; else: git -C "${REPO}" worktree add "${wt}" -b ${br} ${lastGood}.
2. Install${INSTALL ? `: ${INSTALL}` : ': nothing to install'}.
3. baseCommit = git -C "${wt}" merge-base ${br} ${TARGET}; head = git -C "${wt}" rev-parse HEAD; clean = git -C "${wt}" status --porcelain empty (do not clean anything here).
Return ok (true only if baseCommit and head are not empty), worktree, branch, baseCommit, head, reused, clean.`,
    { label: `${E}:setup`, phase: 'Setup', schema: S_SETUP, model: 'haiku' }))
  if (!setup || !setup.ok || !setup.baseCommit) return fail('infra', `setup failed: ${setup ? setup.error : 'null agent'}`)
  if (setup.clean === false && !(await sanitize('setup'))) return fail('infra', `worktree ${wt} is still dirty after the automatic cleanup`)
  out.setup = { worktree: setup.worktree || wt, branch: setup.branch || br, baseCommit: setup.baseCommit, head: setup.head, reused: !!setup.reused }

  // ---------- Spec
  spec = await agent(`${C()}

If this branch already has docs/superpowers/specs/*-${E}-*-design.md, ${noteE ? 'merge the OWNER INSTRUCTION OR ANSWER above into it, reassess humanInputs (an answered input stops being blocking), commit and return reused=false.' : 'reuse it (reused=true) without rewriting.'}
Otherwise use the skill superpowers:brainstorming in AUTONOMOUS MODE: "Brainstorm deliverable ${E} of the roadmap at ${RM}; its ${cardRef}. Do not re-ask what the card settles; the spec must keep the card's acceptance criteria and cite ${E}."
- You play the owner: for each question, read the card, the REQs in ${RM}requirements.md, ${RM}decisions.md and the decisions in the PROJECT block, the relevant module docs and the real code; pick the recommended option and go on. Scope = the card's.
- Parts that are human acts: produce the artifacts and leave the acceptance to the human.
- For each human input set blocking=true ONLY if no useful part of the card can be delivered without it (a placeholder does not count); otherwise blocking=false with the workaround.
- Save to docs/superpowers/specs/${TODAY}-${E}-<slug>-design.md (short kebab-case slug, WITHOUT the ID), written in the language of the roadmap, with: the card's acceptance criteria (verbatim, including any {verify: ...} tag), the design, "Autonomous decisions (reviewable by the owner)" and "Depends on human input".
- Commit only the spec. Do not write the plan. Stop after the commit.
Return specPath, slug (without the ID), decisions (one line per autonomous decision), humanInputs, reused.`,
    { label: `${E}:spec`, phase: 'Spec', schema: S_SPEC, model: 'opus' })
  if (!spec) return fail('infra', 'spec: null agent')
  const specLoop = await reviewLoop('spec',
    (round, prev) => agent(`${C()}

Review (read-only) the spec ${wt}/${spec.specPath} of deliverable ${E} against the ${cardRef}, ${wt}/${RM}requirements.md, ${wt}/${RM}decisions.md and the decisions cited in the PROJECT block.
Blocks: an acceptance criterion of the card missing or altered (defeito); a REQ not met (defeito); an autonomous decision that contradicts a registered decision, or a canonical gate changed (decisao, critical); scope outside the card (defeito); a violation of the "do not" block (decisao, critical); invented human data (defeito); a human input marked blocking without need, or a blocking one handled as a placeholder (defeito); a design that is not viable in the current code (defeito; check the code).${prev ? `\nIssues from the previous round (${repeatRule()}):\n${prev}` : ''}
Measure: headSha, clean (status --porcelain empty), commitsInRange (git -C "${wt}" rev-list --count ${TARGET}..HEAD).`,
      { label: `${E}:spec-review${round}`, phase: 'Spec', schema: S_REVIEW, model: 'opus' }),
    async (iss, k, tier) => {
      const fx = await agent(`${C()}

Fix the spec ${spec.specPath} according to the review below, in autonomous mode, and commit. Stop after the commit.
${fmt(iss)}
Return specPath, slug (without the ID), decisions (full list), humanInputs (full list).`,
        { label: `${E}:spec-fix${k}`, phase: 'Spec', schema: S_SPEC, model: tier })
      if (fx) spec = { ...spec, ...fx }
      return fx ? { status: 'DONE' } : null
    },
    r => reviewTruth(r, spec.reused ? 0 : 1, `${TARGET}..HEAD`),
    { tier: 'opus', reviewModel: 'opus' })
  if (!specLoop.ok) return fail(specLoop.kind, specLoop.msg)
  human.push(...(spec.humanInputs || []))
  out.spec = spec.specPath
  specRef = spec.specPath
  out.decisions = spec.decisions
  slug = cleanSlug(spec.slug || spec.specPath.split('/').pop().replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-design\.md$/, ''), E)
  const blockingHuman = (spec.humanInputs || []).filter(h => h.blocking)
  if (blockingHuman.length) {
    op('human-input', E, blockingHuman.map(h => `${h.blq ? h.blq + ': ' : ''}${h.what}`).join('; '),
      'Provide the data (or the decision) and run again passing the answer in notes', { ...A, deliverables: [E], notes: { ...(A.notes || {}), [E]: '<owner answer>' } })
    return fail('humano', `blocking human input: ${blockingHuman.map(h => h.what).join('; ')}`)
  }

  // ---------- Plan
  const planName = `docs/superpowers/plans/${TODAY}-${E}-${slug}.md`
  const acTxt = (card.acceptance || []).map(a => `${a.id}: ${a.text}`).join('\n')
  plan = await agent(`${C()}

If this branch already has a plan docs/superpowers/plans/*-${E}-*.md, ${noteE ? 'adjust the not yet committed tasks to the OWNER INSTRUCTION OR ANSWER and the current spec, commit and return reused=false.' : 'reuse it (reused=true).'}
Otherwise use the skill superpowers:writing-plans on the spec ${spec.specPath}:
- Header with the exact line: **Roadmap:** ${RM}
- Save to ${planName}, in the language of the roadmap.
- Small tasks, with TDD and the exact verification commands, using the canonical gates and respecting the MEASURED ENVIRONMENT. Each task lists the files it touches and the locks it needs (needsLock: names from ${TASK_LOCKS.join(', ') || '(none configured)'}, only the ones the task really uses). For each verification, the expected result; a baseline failure is named as expected.
- Per task, declare "tier" (the implementer's model) by the routing scoring rules of the plan-coordinator skill (references/routing.md) when available: haiku for mechanical work, sonnet by default, opus only when ambiguity AND blast radius are both high. Declare "reviewTier": opus ONLY for blast radius 2 (authentication, secrets, writes to a production backend, data migration, push); otherwise sonnet.
- Section "## Acceptance criteria evidence": for EACH criterion below, a line with kind test, smoke or integration and the exact command that exits 0 only if that criterion holds (plus testRef), or kind human (a human act listed in the rules), or kind blocked (with blq, a registered blocker id). A criterion with a {verify: ...} tag MANDATORILY keeps the tag's command: you may add evidence, never replace it, and you create the test that the command references. A criterion with no evidence line rejects the plan. Criteria:
${acTxt || '(card without extracted criteria: use the ones in the spec)'}
- Say whether a task needs a browser and what counts as acceptable evidence when a step cannot be exercised in this environment.
- Task commits start with "${E} T<n>:".
- Ignore the skill's execution-mode question. Commit the plan and stop.
Return planPath, roadmapHeader (the file contains the line **Roadmap:**), reused, ac (the evidence section: ac, kind, command, testRef, blq) and tasks (n, title, files, tier, reviewTier, needsLock).`,
    { label: `${E}:plan`, phase: 'Plano', schema: S_PLAN, model: 'opus' })
  if (!plan || !plan.tasks || !plan.tasks.length) return fail('infra', 'plan: null agent or no tasks')
  const planGaps = () => {
    const gap = description => ({ severity: 'critical', category: 'defeito', description })
    const tasks = plan.tasks || []
    return [
      ...evidenceGaps(cardAc, plan.ac, blqIds),
      ...tasks.filter((t, i) => t.n !== i + 1).map(t => gap(`task numbers must run 1..N in order (found ${t.n} at position ${tasks.indexOf(t) + 1})`)),
      ...tasks.flatMap(t => asList(t.needsLock).filter(n => !TASK_LOCKS.includes(n)).map(n => gap(`task ${t.n} needs the unknown lock "${n}" (configured: ${TASK_LOCKS.join(', ') || 'none'})`))),
    ]
  }
  const planLoop = await reviewLoop('plan',
    (round, prev) => agent(`${C()}

Review (read-only) the plan ${wt}/${plan.planPath} against the spec ${wt}/${spec.specPath} and the ${cardRef}.
Blocks (defeito): an acceptance criterion with no task or no test; a task with no verification command; a command that does not exist or does not run in the MEASURED ENVIRONMENT (check scripts, paths and flags in the repository); wrong needsLock; wrong task order; a missing "**Roadmap:** ${RM}" line in the header; a task that edits the roadmap folder ${RM}; an evidence command that does not prove its criterion; a testable criterion labelled human or blocked; a {verify: ...} command of the card replaced instead of kept; a task tier or reviewTier that contradicts the blast radius (opus reviewTier is only for blast radius 2); a canonical gate changed (decisao, critical).${prev ? `\nIssues from the previous round (${repeatRule()}):\n${prev}` : ''}
Measure: headSha, clean, commitsInRange (git -C "${wt}" rev-list --count ${TARGET}..HEAD).`,
      { label: `${E}:plan-review${round}`, phase: 'Plano', schema: S_REVIEW, model: 'opus' }),
    async (iss, k, tier) => {
      const fx = await agent(`${C()}

Fix the plan ${plan.planPath} according to the review below and commit. Stop after the commit.
${fmt(iss)}
Return planPath, roadmapHeader, ac (full list) and tasks (full list, with tier, reviewTier and needsLock).`,
        { label: `${E}:plan-fix${k}`, phase: 'Plano', schema: S_PLAN, model: tier })
      if (fx && fx.tasks && fx.tasks.length) plan = { ...plan, ...fx }
      return fx && fx.tasks && fx.tasks.length ? { status: 'DONE' } : null
    },
    r => [...reviewTruth(r, plan.reused ? 0 : spec.reused ? 1 : 2, `${TARGET}..HEAD (spec + plan)`), ...planGaps()],
    { tier: 'opus', reviewModel: 'opus' })
  if (!planLoop.ok) return fail(planLoop.kind, planLoop.msg)
  if (plan.roadmapHeader === false) return fail('conteudo', 'plan without the **Roadmap:** line in the header')
  out.plan = plan.planPath
  planRef = plan.planPath
  out.acOpen = criteriaOpen(cardAc, plan.ac)
  log(`${E}: plan with ${plan.tasks.length} tasks`)

  const decisionsTxt = `Record in ${RM}decisions.md the autonomous decisions of the spec ${spec.specPath} (branch ${br}) with Origin "executor" and status "pending" (use the roadmap's own word for pending; the owner reviews them), unless already there: ${JSON.stringify(out.decisions || [])}. Non-blocking human inputs go to the pending block: ${JSON.stringify(human.map(h => h.what))}.${noteE ? ` Also record, as a standing decision with Origin "user (notes)", unless already there, the owner's instruction: ${JSON.stringify(noteE)}.` : ''}`
  if (MODE === 'plan-only') {
    const rec = await recordStatus(E, STATUSES.plan, `spec ${spec.specPath} and plan ${plan.planPath} on branch ${br} (worktree ${wt})`, decisionsTxt)
    if (!rec || rec.checkerErrors > 0) return fail('infra', `plan-only: the roadmap record failed (${rec ? 'checkerErrors=' + rec.checkerErrors : 'null agent or integration worktree broken'})`)
    out.planOnly = true
    out.ok = true
    return out
  }
  const recRun = await recordStatus(E, STATUSES.executing, `spec ${spec.specPath} and plan ${plan.planPath} approved by the reviews; branch ${br} at ${wt}`,
    `${decisionsTxt}\nAdd ${br} to the inflight block (type: deliverable, note: automatic execution).`)

  if (!recRun || recRun.checkerErrors > 0) out.concerns.push(`the "executing" roadmap record failed (${recRun ? 'checkerErrors=' + recRun.checkerErrors : 'null agent or integration worktree broken'}); decisions and the in-flight entry are not recorded yet`)

  // ---------- Tasks (resumable)
  const prog = await agent(`Read-only. In the worktree ${wt}: head = git rev-parse HEAD; clean = git status --porcelain empty; done = for each n in [${plan.tasks.map(t => t.n).join(', ')}], if git log --reverse --format=%H --grep "^${E} T<n>:" ${TARGET}..HEAD finds commits: { n, firstParent: parent of the first of those commits, last: the last one }.`,
    { label: `${E}:progress`, phase: 'Implementação', schema: S_PROGRESS, model: 'haiku' })
  if (!prog) return fail('infra', 'progress read: null agent')
  if (!prog.clean && !(await sanitize('tasks'))) return fail('infra', `worktree ${wt} is still dirty after the automatic cleanup`)
  const doneMap = Object.fromEntries((prog.done || []).map(d => [d.n, d]))
  const lastDone = lastContiguousDone(plan.tasks, doneMap)  // a gap is where the run resumes; the last committed task is reviewed again
  let head = prog.head
  const taskLog = []
  for (const t of plan.tasks) {
    const resumed = doneMap[t.n]
    if (resumed && t.n < lastDone) { taskLog.push({ n: t.n, title: t.title, status: 'RESUMED (already reviewed)' }); continue }
    const start = resumed ? resumed.firstParent : head
    let locks = asList(t.needsLock).filter(n => TASK_LOCKS.includes(n))
    const runImpl = label => withLocks(locks, () => agent(buildImplPrompt(ctxFor({ locks }), t), { label, phase: 'Implementação', schema: S_IMPL, model: implModel(t) }))
    let impl = { status: 'DONE', summary: 'resumed: task already committed by a previous run; no checks reported, run the task verifications yourself', checks: [] }
    if (!resumed) {
      impl = await runImpl(`${E}:t${t.n}:impl`)
      if (impl && impl.status === 'BLOCKED' && impl.needsLock && TASK_LOCKS.includes(impl.needsLock) && !locks.includes(impl.needsLock)) {
        locks = [...locks, impl.needsLock]
        impl = await runImpl(`${E}:t${t.n}:impl-lock`)
      }
      if (!impl) return fail('infra', `task ${t.n}: null implementer`)
      human.push(...(impl.humanInputs || []))
      if (impl.concerns) out.concerns.push(`T${t.n}: ${impl.concerns}`)
      if (impl.status === 'BLOCKED') return fail('conteudo', `task ${t.n} BLOCKED: ${impl.summary}`)
    }
    const cur = { summary: impl.summary, checks: impl.checks || [] }  // refreshed by each fix so the reviewer sees real output
    let lastR = null
    for (const kind of ['spec', 'quality']) {
      const loop = await reviewLoop(`T${t.n}:${kind}`,
        (round, prev) => agent(buildTaskReviewPrompt(ctxFor({ locks, start, round, prev }), t, kind, cur),
          { label: `${E}:t${t.n}:${kind}${round}`, phase: 'Implementação', schema: S_REVIEW, model: reviewModelFor(t) }),
        (iss, k, tier) => withLocks(locks, async () => {
          const fx = await agent(`${C()}

In Task ${t.n} of the plan ${plan.planPath}, fix the ${kind} problems below, run the task's checks and commit "${E} T${t.n}: fix ...". STOP after this fix. ${lockNote(locks)} If you disagree technically with an item, do not apply it and explain in concerns. Report in "checks" every verification you ran, with the exact command, real output and exit code.
${fmt(iss)}`, { label: `${E}:t${t.n}:${kind}-fix${k}`, phase: 'Implementação', schema: S_IMPL, model: tier })
          if (fx) { if (fx.checks) cur.checks = fx.checks; if (fx.summary) cur.summary = fx.summary }
          return fx
        }),
        r => reviewTruth(r, impl.status === 'NEEDS_HUMAN' ? 0 : 1, `${start}..HEAD`),
        { tier: implModel(t), reviewModel: reviewModelFor(t) })
      if (!loop.ok) return fail(loop.kind, `task ${t.n}: ${loop.msg}`)
      lastR = loop.r
    }
    head = lastR.headSha
    taskLog.push({ n: t.n, title: t.title, status: impl.status, commits: lastR.commitsInRange })
  }
  out.tasks = taskLog

  // Sync, final review, gates, merge and docs are implemented in Task 8.
  out.status = 'partial'
  return fail('infra', 'not implemented (sync, gates and merge)')
}

// ============================================================================ scheduling
const sem = makeSem(MAXPAR)
const runs = {}
order.forEach((id, idx) => {
  runs[id] = (async () => {
    for (const d of byId[id].deps) {
      if (!runs[d]) continue  // dependency already on the target
      const r = await runs[d]
      if (!r.ok) return { id, merged: false, ok: false, skipped: true, error: `dependency ${d} did not finish in this run` }
    }
    try { return await sem(() => runDeliverable(id, idx)) }
    catch (e) { return { id, merged: false, ok: false, error: `unexpected error: ${e && e.message ? e.message : e}` } }
  })()
})
for (const id of order) RESULTS.push(await runs[id])
const merged = RESULTS.filter(r => r.merged || r.planOnly).length
return mkResult(merged === order.length ? 'done' : OPS.length && !merged ? 'needs-operator' : 'partial',
  { selection, error: RESULTS.some(r => r.error) ? 'not implemented' : undefined })
