export const meta = {
  name: 'release-workflow',
  description: 'Runs E<n> deliverables of a tracked roadmap: discovery, spec, plan, tasks with double review, final review, gates against the baseline, serialized merge with rollback, docs and roadmap',
  whenToUse: 'Automate one or more deliverables of docs/plans/roadmap-*/. Example args: {"deliverables":["E18"],"targetBranch":"release/2026-11-24"} | {"deliverables":"next","phase":"r1-1"} | {"mode":"dry-run"} | {"mode":"plan-only","deliverables":["E19"]}',
  phases: [
    { title: 'Discovery', detail: 'reads config, cards and panel on the target; computes selection and dependencies' },
    { title: 'Preflight', detail: 'target, integration worktree, setup commands, environment and baseline of every gate' },
    { title: 'Setup', detail: 'worktree and install per deliverable' },
    { title: 'Spec', detail: 'autonomous brainstorming, review loop, human-input gate' },
    { title: 'Plan', detail: 'writing-plans, review loop, "running" record' },
    { title: 'Implementation', detail: 'one task per implementer, spec review, quality review, git truth' },
    { title: 'Final review', detail: 'sync with the target and review of the whole branch (2 lenses if critical)' },
    { title: 'Gates', detail: 'numeric gates against the baseline; locked resources serialized; reviewed fixes' },
    { title: 'Merge', detail: 're-sync, merge, conflict review, post-merge gates, verified rollback' },
    { title: 'Docs', detail: 'docs stage, roadmap-tracker and independent measurement' },
    { title: 'Report', detail: 'git truth, report and operator actions' },
  ],
}

// roadmap-release workflow script. Self-contained: no imports, no filesystem or Node API.
// Runtime API: agent(prompt, {label, phase, model, schema}), phase(), log(), args, budget, parallel().
// All project-specific settings come from args.config (the object validated by scripts/preflight.mjs).
//
// ARGS (all optional except config)
//   config: release config validated by preflight.mjs (gates, install, setup, locks, projectContext, conflictRules...)
//   runToken: from the preflight of this call, new each time; only in the discovery read (the first agent call), so a resume
//     with resumeFromRunId reruns everything live, at the cost of a resume without it; never returned in resumeArgs/resumeWith.
//     Without it no authorized external task is launched
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
//   acceptIntegrityAlerts: { "E18": "<full merge SHA>" } on resume, accepts the hard test-integrity alerts of exactly that merge
//     of that deliverable (they become a concern); another SHA is ignored. Only read from args, never set by the workflow itself
//   wtRoot (required): where the workflow creates its worktrees; the skill passes <dirname(repo)>/<basename(repo)>-wt
//   roadmap, repo, today: detected when absent
//   authorizeExternal: ["gate:G3", "E18:T4", "E18:T4@<fp>", "E18:AC1", "E18:AC1@<fp>", "checkout:<target>"]: external effects the owner authorizes (only a person sets it; silence is never authorization).
//     A bare E18:T4 or E18:AC1 binds to the plan fingerprint on first use; any redone plan invalidates the binding
//   notes: { E19: "owner instruction or answer for this deliverable" } (also used to resume)
//   approveRulings: { "E8": ["R2:<key>"] }: releases a costly irreversible spec ruling; the key is shown in the approve-ruling operator action and ties
//     the approval to the exact text of the decision. Only a person sets it; it is never returned in resumeArgs or resumeWith
//   trailer, branchPrefix ("feat/")
//
// RETURN: { status: done|partial|needs-operator|error, operatorActions[], resumeArgs, selection,
//           results[], ownerReview { acceptedRisks[], decisionsPending[], criteriaOpen[] }, truth, lastGood, reportPath (null when no report file was written) }
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

// Interrupted merges the selection leaves out: anything merged after them would be measured on an unvalidated target.
function unfinishedOutside(cards, statuses, order) {
  return (cards || []).filter(c => isUnfinished(c, statuses) && !(order || []).includes(c.id)).map(c => c.id)
}

// Panel Status cell, same rules as parseStatus of the roadmap checker: segments split by ";", each "[label:] status[ (note)]".
function stripStatusNote(seg) {
  const s = seg.trimEnd()
  if (!s.endsWith(')')) return s
  let depth = 0
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ')') depth++
    else if (s[i] === '(' && --depth === 0) return s.slice(0, i).trimEnd()
  }
  return s
}
function statusSegments(cell) {
  return String(cell == null ? '' : cell).split(';').map(s => s.trim()).filter(Boolean).map(seg => {
    const noNote = stripStatusNote(seg)
    const at = noNote.indexOf(':')
    return at >= 0 ? { label: noNote.slice(0, at).trim().toLowerCase(), status: noNote.slice(at + 1).trim() } : { label: '', status: noNote.trim() }
  })
}
// The single status this workflow acts on. Finished when the code segment (or the only, unlabelled status) is integrated or
// on-branch, even with acceptance still blocked; otherwise blocked if any segment is; otherwise the first open segment.
function cardStatus(cell, statuses) {
  const segs = statusSegments(cell)
  if (!segs.length) return ''
  const finished = s => (statuses.integrated || []).includes(s) || s === statuses.onBranch
  const code = segs.find(s => /^(code|c[oó]digo)$/.test(s.label)) || (segs.length === 1 && !segs[0].label ? segs[0] : null)
  if (code && finished(code.status)) return code.status
  if (segs.some(s => s.status === statuses.blocked)) return statuses.blocked
  return (segs.find(s => !finished(s.status) && s.status !== statuses.discarded) || segs[0]).status
}
// The script does not trust the discovery agent's onTarget for partial or unfinished rows: the ancestor rules only hold
// when the single status (see cardStatus) is an integrated or on-branch word; a merge found in the history always holds.
function onTargetEffective(c, statuses) {
  return !!c.mergeFound || (!!c.onTarget && ((statuses.integrated || []).includes(c.status) || c.status === statuses.onBranch))
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
  for (const id of roots) { const cyc = visit(id); if (cyc) return fail('cycle or invalid dependency among: ' + cyc.join(', ')) }
  const sel = selector === undefined || selector === null ? 'next' : selector
  const want = new Set()
  if (Array.isArray(sel)) {
    const unknown = sel.filter(id => !byId[id])
    if (unknown.length) return fail('unknown deliverables: ' + unknown.join(', '))
    for (const id of sel) {
      if (done(byId[id]) && !force) notes.push(id + ': already done on the target (' + byId[id].status + '); use force to redo it')
      else want.add(id)
    }
    if (autoDeps) {
      const add = id => { for (const d of byId[id].deps) if (byId[d] && !satisfied(d) && !want.has(d)) { want.add(d); add(d) } }
      for (const id of [...want]) add(id)
    }
  } else if (sel === 'next' || sel === 'ready' || sel === 'all') {
    const cand = pool.filter(c => !done(c))
    for (const c of cand.filter(c => c.status === statuses.blocked)) notes.push(c.id + ': status "' + statuses.blocked + '" on the roadmap; left out of "' + sel + '" (run with deliverables:["' + c.id + '"] once it is resolved)')
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
      for (const c of open.filter(c => !want.has(c.id))) notes.push(c.id + ': outside the selection (pending dependencies: ' + c.deps.filter(d => !satisfied(d) && !want.has(d)).join(', ') + ')')
    }
  } else return fail('invalid deliverables: ' + JSON.stringify(sel))
  for (const id of [...want]) {
    if (held.has(id) && !override.includes(id)) { want.delete(id); skipped.push({ id, reason: 'vetoed by the roadmap "do not" block (' + held.get(id) + '); use overrideDonot:["' + id + '"] if the veto no longer applies' }) }
  }
  const order = []
  const pending = new Set(want)
  let progress = true
  while (pending.size && progress) {
    progress = false
    for (const id of [...pending]) {
      const deps = byId[id].deps
      const missing = deps.filter(d => !satisfied(d) && !want.has(d))
      if (missing.length) { pending.delete(id); want.delete(id); skipped.push({ id, reason: 'dependencies not met on the target and outside the selection: ' + missing.join(', ') }); progress = true; continue }
      if (deps.every(d => satisfied(d) || order.includes(d))) { order.push(id); pending.delete(id); progress = true }
    }
  }
  if (pending.size) return fail('cycle or invalid dependency among: ' + [...pending].join(', '))
  const max = Number.isInteger(maxDeliverables) && maxDeliverables >= 1 ? maxDeliverables : 12
  const cut = order.length > max ? order.splice(max) : []  // a topological prefix keeps dependencies satisfied
  for (const id of cut) skipped.push({ id, reason: 'above maxDeliverables (' + max + '); each run is limited to 1000 agents' })
  for (const id of order) if (byId[id].criticalMissing) notes.push(id + ': card without the critical attribute (treated as not critical)')
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
// Tests gates that measured no tests: gatePasses fails them at total 0, so accepting a red baseline cannot help.
function zeroTestGates(defs, baseline) {
  return (defs || []).filter(def => {
    const r = (baseline || {})[def.name]
    return def.kind === 'tests' && !def.invariant && !!r && r.ran !== false && !(r.total > 0)
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
  // Same grammar as the roadmap checker: the evidence part is optional for human and blocked.
  const m = /^\s*([^;}]*?)\s*(?:;\s*evidence:([\s\S]*))?$/.exec(body)
  if (!m) return { invalid: true }
  const km = /^([A-Za-z-]+)(?:\s+(BLQ-\d+))?$/.exec(m[1])
  if (!km) return { invalid: true }
  const kind = km[1]
  const out = { kind, evidence: (m[2] || '').trim().replace(/^(`+)([\s\S]*?)\1$/, '$2').trim() }
  if (km[2]) out.blq = km[2]
  const known = [...VERIFY_EXEC, 'human', 'blocked'].includes(kind)
  if (!known || (kind === 'blocked') !== !!km[2] || (VERIFY_EXEC.includes(kind) && !out.evidence)) out.invalid = true
  return out
}
// A plan evidence row belongs to a card criterion when its ac is the id, the id plus a separator ("AC1: ...", "AC1 - ..."),
// or the criterion text (with or without the {verify...} tag). "AC10" never matches "AC1".
function matchesCriterion(rowAc, card) {
  const norm = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ')
  const v = norm(rowAc)
  const id = norm(card && card.id)
  if (!v || !id) return false
  if (v === id) return true
  if (v.startsWith(id) && !/[A-Za-z0-9]/.test(v.charAt(id.length))) return true
  const full = norm(card.text)
  const at = full.lastIndexOf('{verify:')
  const bare = at === -1 ? full : norm(full.slice(0, at))
  return [full, bare].some(t => t && (v === t || v.includes(t)))
}
// Plan rows with their ac resolved to the card id: an id match wins over a match on the criterion text.
function normalizePlanAc(cardAc, planAc) {
  const cards = cardAc || []
  return (planAc || []).map(p => {
    const a = cards.find(c => matchesCriterion(p.ac, { id: c.id, text: '' })) || cards.find(c => matchesCriterion(p.ac, c))
    return a ? { ...p, ac: a.id } : p
  })
}
// The result of an evidence row, by id or position; the trimmed command must always be the one the plan binds.
function matchEvidence(results, row, idx) {
  const cmd = s => String(s == null ? '' : s).trim()
  const rs = results || []
  const same = r => !!r && cmd(r.command) === cmd(row.command)
  return rs.find(r => r.ac === row.ac && same(r)) || (same(rs[idx]) ? rs[idx] : undefined)
}
// cardAc = [{ id, text, tag }]; planAc = [{ ac, kind, command?, testRef?, blq? }]
function evidenceGaps(cardAc, planAc, blqIds) {
  const gap = description => ({ severity: 'critical', category: 'defeito', description })
  const rows = planAc || []
  const out = []
  for (const a of cardAc || []) {
    const mine = rows.filter(p => matchesCriterion(p.ac, a))
    if (!mine.length) { out.push(gap(`criterion ${a.id} has no evidence row in the plan (expected ac "${a.id}", the id alone; the plan returned ac values: ${rows.length ? rows.map(p => JSON.stringify(String(p.ac))).join(', ') : 'none'}): ${a.text}`)); continue }
    const t = a.tag
    if (t && t.invalid) { out.push(gap(`criterion ${a.id} has an invalid {verify:} tag`)); continue }
    if (t && VERIFY_EXEC.includes(t.kind) && !mine.some(p => VERIFY_EXEC.includes(p.kind) && commandKey(p.command) === commandKey(t.evidence)))
      out.push(gap(`criterion ${a.id}: the plan changed the command bound by the card tag (${t.evidence})`))
    if (t && (t.kind === 'human' || t.kind === 'blocked') && !mine.some(p => p.kind === t.kind)) out.push(gap(`criterion ${a.id}: the plan replaced the ${t.kind} tag with another kind of evidence`))
  }
  for (const p of rows) {
    if (VERIFY_EXEC.includes(p.kind) && blankCommand(p.command)) out.push(gap(`criterion ${p.ac} has no evidence command`))
    if (p.kind === 'blocked' && !hasBlq(blqIds, p.blq)) out.push(gap(`criterion ${p.ac} marked blocked without a registered blocker (blq=${p.blq || 'empty'})`))
  }
  return out
}
// BLQ ids cited by a blocked tag of the card that the roadmap no longer registers (closed): no run until the tag changes.
function closedBlockers(cardAc, blqIds) {
  const out = []
  for (const a of cardAc || []) {
    const t = a.tag
    if (t && !t.invalid && t.kind === 'blocked' && t.blq && !hasBlq(blqIds, t.blq) && !out.includes(t.blq)) out.push(t.blq)
  }
  return out
}
// Highest k such that tasks 1..k are all committed; a gap is where the run resumes.
function lastContiguousDone(tasks, doneMap) {
  let last = 0
  for (const t of tasks || []) { if ((doneMap || {})[t.n]) last = t.n; else break }
  return last
}
// An interrupted merge always finishes first, even under force: new deliverables must keep waiting for it.
function resumeAction(card, statuses) {
  return isUnfinished(card, statuses) ? 'finish-merge' : 'run'
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
// marks = how many of minCommits are bookkeeping marks (started, completion), named in the finding so a fix does not invent a commit.
function reviewTruth(r, minCommits, label, marks = 0) {
  const iss = [...blocking(r)]
  if (r && r.commitsInRange < minCommits) iss.push({ severity: 'critical', category: 'defeito', description: `fewer commits than expected in the range (${label}: ${r.commitsInRange} < ${minCommits}${marks > 0 ? '; the started and completion marks count; missing a started or completion mark?' : ''})` })
  if (r && !r.clean) iss.push({ severity: 'critical', category: 'defeito', description: 'dirty working tree (uncommitted files)' })
  return iss
}
// The route of the plan/1 emit (recalculated here from the score, checked against the emitted one) drives the models; the reviewer is opus for the route's reviewTier, an opus implementer and any external task.
function implModel(task) {
  const t = task && task.route && task.route.tier
  return ['haiku', 'sonnet', 'opus'].includes(t) ? t : 'sonnet'
}
function implEffort(task) {
  const e = task && task.route && task.route.effort
  return ['low', 'medium', 'high'].includes(e) ? e : effortFor(implModel(task))
}
function reviewModelFor(task) {
  const r = task && task.route
  return (r && (r.reviewTier === 'opus' || r.tier === 'opus')) || (task && task.external === true) ? 'opus' : 'sonnet'
}
// ---- plan/1 adapter (E8): the plan-tool emit is parsed and checked here; nothing is trusted from an agent's transcription.
function loadPlanEmit(stdout, { E, RM } = {}) {
  let o
  try { o = JSON.parse(String(stdout)) } catch (e) { return { ok: false, why: `plan-tool emit output is not JSON (${e.message})` } }
  if (!o || typeof o !== 'object') return { ok: false, why: 'plan-tool emit output is not an object' }
  if (o.tool !== 'plan-tool') return { ok: false, why: `tool is ${JSON.stringify(o.tool)}, expected "plan-tool"` }
  if (o.schema !== 'plan/1') return { ok: false, why: `schema is ${JSON.stringify(o.schema)}, expected "plan/1"` }
  const plan = o.plan
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.tasks)) return { ok: false, why: 'the emit has no plan with a task list' }
  if (plan.id !== E) return { ok: false, why: `plan id is ${JSON.stringify(plan.id)}, expected ${E}` }
  if (plan.roadmap !== RM) return { ok: false, why: `plan roadmap is ${JSON.stringify(plan.roadmap)}, expected ${RM}` }
  if (typeof o.digest !== 'string' || planDigest({ plan, source: o.source }) !== o.digest) return { ok: false, why: 'the emit digest does not match the plan and source' }
  for (const t of plan.tasks) {
    const hasDependents = plan.tasks.some(x => Array.isArray(x.deps) && x.deps.includes(t.n))
    let want
    try { want = route(t, { hasDependents }) } catch (e) { return { ok: false, why: `task ${t.n}: route could not be recalculated (${e.message})` } }
    if (JSON.stringify(canon(want)) !== JSON.stringify(canon(t.route))) return { ok: false, why: `task ${t.n}: emitted route differs from the recalculated one` }
  }
  return { ok: true, plan, digest: o.digest }
}
function tasksFromPlan(plan) {
  return ((plan && plan.tasks) || []).map(t => {
    const f = t.files || {}
    return {
      n: t.n,
      title: t.title,
      files: [...new Set([...(f.create || []), ...(f.modify || []), ...(f.test || [])])],
      needsLock: t.locks || [],
      external: t.external,
      externalDedupe: t.externalDedupe,
      noCommit: t.noCommit,
      route: t.route,
      deps: t.deps || [],
      testFirst: t.testFirst,
    }
  })
}
function evidenceFromPlan(plan) {
  return ((plan && plan.evidence) || []).map(e => ({ ac: e.ac, kind: e.kind, command: e.command, testRef: e.testRef === undefined ? null : e.testRef, blq: e.blq, external: e.external, externalDedupe: e.externalDedupe }))
}
// Differences on tasks already committed between two plans (canonical JSON of the fields the author writes; wave, fileCount and route are derived by plan-tool from the whole plan, so they are ignored); a committed task missing from the next plan is a difference.
const authoredTask = t => { const { wave, fileCount, route, ...rest } = t || {}; return rest }
function frozenTaskDiffs(prevPlan, nextPlan, committed) {
  const find = (p, n) => ((p && p.tasks) || []).find(t => t.n === n)
  const out = []
  for (const n of committed || []) {
    const a = find(prevPlan, n)
    if (!a) continue
    const b = find(nextPlan, n)
    if (!b) out.push(`task ${n} is committed but missing from the new plan`)
    else if (JSON.stringify(canon(authoredTask(a))) !== JSON.stringify(canon(authoredTask(b)))) out.push(`task ${n} is committed but changed in the new plan`)
  }
  return out
}
// The raw output of one plan load (emit + blob of the committed file): accepted only when the emit passes loadPlanEmit and the blob is a git object id.
function checkPlanLoad(t, { E, RM } = {}) {
  if (!t || typeof t !== 'object') return { ok: false, why: 'the load agent returned nothing' }
  if (!Number.isInteger(t.emitExit)) return { ok: false, why: 'the load agent did not return the exit code of emit' }
  if (t.emitExit !== 0) return { ok: false, why: `plan-tool emit exited ${t.emitExit}: ${collapseWs(t.checkStdout || t.emitStdout).slice(0, 1500)}` }
  const r = loadPlanEmit(t.emitStdout, { E, RM })
  if (!r.ok) return r
  const blob = String(t.blob || '').trim()
  return { ok: true, plan: r.plan, digest: r.digest, blob: /^[0-9a-f]{40,64}$/.test(blob) ? blob : '' }
}
const MODEL_RANK = { haiku: 0, sonnet: 1, opus: 2 }
function maxModel(a, b) {
  return (MODEL_RANK[b] ?? -1) > (MODEL_RANK[a] ?? -1) ? b : a
}
// Single source of the effort for a given tier: haiku low, sonnet and opus medium (the four high calls are literal).
function effortFor(model) {
  return model === 'haiku' ? 'low' : 'medium'
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
    const row = (planAc || []).find(p => matchesCriterion(p.ac, a) && open(p.kind))
    if (t && open(t.kind)) add(a.id, t.kind, t.blq || (row && row.kind === t.kind ? row.blq : undefined))
    else if (row) add(a.id, row.kind, row.blq)
  }
  for (const p of planAc || []) if (open(p.kind) && !(cardAc || []).some(a => matchesCriterion(p.ac, a))) add(p.ac, p.kind, p.blq)
  return out
}
// One review/fix cycle. env = { maxFix, blqIds, reviews, concerns, acceptRisks(stage, issues) }.
// A finding that reappears after a fix escalates the fixer one tier (nextTier); the first escalation earns one extra
// round so a haiku task can reach opus; a repeat at opus stops the deliverable.
async function runReviewLoop(env, stage, review, fix, truth, opt = {}) {
  let tier = opt.tier || 'opus'
  const rm = opt.reviewModel || 'sonnet'
  const rounds = []
  const note = (round, fixTier, model) => rounds.push({ round, reviewModel: model || rm, fixTier: fixTier || null })
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
    if (opt.haltOn && opt.haltOn(fx)) { record(r, iss); return { ok: false, halted: fx } }
    const fixTier = tier
    const reviewer = maxModel(rm, fixTier)  // a fix escalated to opus is re-reviewed at opus at least
    r = await review(k + 1, fmt(iss), reviewer)
    note(k + 1, fixTier, reviewer)
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
// mark = { E, target }: the implementer guard of a launch, right before the effect; it is the first live call when a resume replayed every call before it.
function externalNote(authorizedExternal, task, mark) {
  const first = mark && mark.E && mark.target ? `Immediately before the effect (before its duplicate check, after any code, test or lock need, so a BLOCKED for a lock writes nothing): in ${mark.target}..HEAD, if a commit whose subject starts "${mark.E} T${task.n} started" is newer than the newest one starting "${mark.E} T${task.n} launching", return NEEDS_HUMAN at once, say the effect may have started in an earlier run, and do not run the effect. Otherwise commit --allow-empty "${mark.E} T${task.n} started" (git reset -q first) and only then run the duplicate check and the effect. ` : ''
  return authorizedExternal
    ? `${first}This task is external and the person AUTHORIZED it (authorizeExternal): perform the effect at most once, first applying its duplicate check: ${task.externalDedupe}. That authorization is already given: do not return a humanInput asking for it. If you need a person, return NEEDS_HUMAN and say in the summary whether the effect started; report DONE or DONE_WITH_CONCERNS only when the effect finished. Run it from the deliverable worktree you work in: the integration worktree does not have this branch's code until the merge. Before the effect, only read (the duplicate check is a read); never run the effect command itself, nor a script that runs it against the real target, as a pre-check or a test. Tests on a fixture or a fake target are not the effect.`
    : 'Do NOT perform any external effect in this task.'
}
// A task whose plan says it changes no file and makes no commit (noCommit, checked by the plan review, and an empty files list)
// makes no commit of its own: only marks may be in its review range. An empty list alone may be a reading failure.
function noFiles(task) {
  return !!task && task.noCommit === true && Array.isArray(task.files) && task.files.length === 0
}
function buildImplPrompt(ctx, task) {
  return `${briefing(ctx)}

Implement ONLY Task ${task.n} ("${task.title}") of the plan ${ctx.planPath}, in the deliverable worktree (no task of the plan runs in the integration worktree). STOP after this task: do not start the next one. ${lockNote(ctx.locks)}
${externalNote(ctx.authorizedExternal, task, { E: ctx.E, target: ctx.target })}
Run the task's checks; a failure is pre-existing only if it is in the BASELINE or listed as expected in the plan. ${noFiles(task) ? 'This task changes no file: make no commit of your own (the plan lists no files for it).' : `Commit "${ctx.E} T${task.n}: ..." with only the task's files (plan list: ${(task.files || []).join(', ') || 'see the plan'}).`}${task.testFirst === true ? '\nThis is a test-first task: write the test, run it and report the failure before implementing.' : task.testFirst && task.testFirst.exempt ? `\nThis task is exempt from test-first: ${task.testFirst.exempt}.` : ''}`
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
Range: git -C "${ctx.wt}" log -p ${ctx.start}..HEAD.${ctx.rangeNote || ''}
${spec
    ? 'Blocks: a missing task requirement, behavior that diverges from the spec, extra scope (category defeito), a missing test or a test that does not test what it says, a file outside the task list without justification, a canonical gate changed or a registered decision contradicted (category decisao), an edit to the roadmap folder.'
    : 'Blocks: a bug, a security problem, a violated project convention (see the PROJECT block, or the file it points to), a fragile test. Also confirm there is no regression against the spec.'}
IMPLEMENTER'S CHECKS (command, exit code and output as reported; re-run the ones you doubt and treat a mismatch as a defect). You hold no lock: do not re-run a check that needs a resource protected by a shared lock; judge it from the reported output. Do not re-run a check with an external effect (production, deploy, push, e-mail or message, shared data, someone's checkout); judge it from the reported output too. Implementer summary: ${(impl && impl.summary) || '(none)'}
${fmtChecks(impl && impl.checks)}
Evidence that the MEASURED ENVIRONMENT cannot produce is category "ambiente", not defeito, if the plan foresaw the alternative evidence (cite in blq the registered blocker, if any).${ctx.prev ? `\nIssues from the previous round (verify them; ${repeatRule()}):\n${ctx.prev}` : ''}
Measure: headSha, clean, commitsInRange (git -C "${ctx.wt}" rev-list --count ${ctx.start}..HEAD).`
}
// ---- merge stage helpers
// Delta of the target brought in by a late sync: only docs or roadmap files need no review. An empty delta needs none.
function needsDeltaReview(changedFiles, roadmapDir, docsPrefixes) {
  const prefixes = [roadmapDir, ...(docsPrefixes || [])].filter(Boolean)
  if (!Array.isArray(changedFiles)) return true  // an unknown delta is never skipped
  return changedFiles.some(f => !prefixes.some(p => String(f).startsWith(p)))
}
// Why a measure does not count, naming the offending gate; empty when valid.
function measureProblems(m, expectedSha, gateDefs) {
  if (!m) return ['no measure returned']
  const out = []
  if (m.clean !== true) out.push('dirty tree')
  if (expectedSha && !gateShaMatch(m.headSha, expectedSha)) out.push('measured at commit ' + m.headSha + ', expected ' + expectedSha)
  for (const def of gateDefs || []) {
    const r = gateResult(m, def.name)
    if (!r) out.push('gate ' + def.name + ' missing from the measure')
    else if (!gateCoherent(def, r)) out.push('gate ' + def.name + ': exit ' + r.exit + ' disagrees with its failing names')
  }
  return out
}
const lockList = def => (def.needsLock == null || def.needsLock === '' ? [] : Array.isArray(def.needsLock) ? def.needsLock : [def.needsLock])
// Gates that share the same lock set are measured by one agent that holds those locks; the unlocked group comes first.
function gateGroups(defs) {
  const groups = new Map()
  groups.set('', { locks: [], defs: [] })
  for (const def of defs || []) {
    const locks = [...lockList(def)].sort()
    const key = locks.join('+')
    if (!groups.has(key)) groups.set(key, { locks, defs: [] })
    groups.get(key).defs.push(def)
  }
  return [...groups.values()].filter(g => g.defs.length)
}
// New baseline after an approved merge: measured gates replace the old result (ignored failures stay out), the rest is kept.
function refreshBaseline(base, defs, m, changedFiles) {
  const next = JSON.parse(JSON.stringify(base || {}))
  for (const def of defs || []) {
    const r = gateEffective(def, gateResult(m, def.name), changedFiles)
    if (r) next[def.name] = JSON.parse(JSON.stringify(r))
  }
  return next
}
// integ = { deletedTests, removedAsserts, skipsAdded, prodChanged, assertsAdded }; removedAsserts -1 means unmeasured.
function integrityHardAlerts(integ) {
  if (!integ || integ.removedAsserts < 0) return []
  return [
    ...((integ.deletedTests || []).length ? ['deleted test files: ' + integ.deletedTests.join(', ')] : []),
    ...(integ.removedAsserts > 0 ? [integ.removedAsserts + ' assertions removed without replacement'] : []),
    ...(integ.skipsAdded > 0 ? [integ.skipsAdded + ' tests skipped, focused or commented out'] : []),
  ]
}
function integrityHeuristicAlerts(integ) {
  if (!integ || integ.removedAsserts < 0) return []
  return integ.prodChanged > 0 && integ.assertsAdded === 0 ? [integ.prodChanged + ' code files changed with no new assertion'] : []
}
function integrityAlerts(integ) {
  return [...integrityHardAlerts(integ), ...integrityHeuristicAlerts(integ)]
}
// The operator's acknowledgement covers one deliverable at one exact merge SHA, never a prefix or another merge.
function integrityAckMatches(ack, E, sha) {
  return !!ack && typeof ack === 'object' && typeof ack[E] === 'string' && !!sha && ack[E] === sha
}
const resultTxt = r => (r ? 'exit ' + r.exit + (typeof r.total === 'number' ? ', total ' + r.total + ', skipped ' + (r.skipped || 0) + ', failing [' + (r.failedNames || []).join(', ') + ']' : '') : 'not measured')
function gateSummary(defs, m, base) {
  if (!m) return 'not measured'
  return (defs || []).map(d => d.name + ': ' + resultTxt(gateResult(m, d.name)) + ' (baseline: ' + resultTxt((base || {})[d.name]) + ')').join(' | ')
}
// A merge counts only if its first parent is the pre-merge target and its second parent is the validated branch head.
function mergeParentsOk(mg, preSha, validatedSha) {
  return !!mg && !!mg.mergeCommit && gateShaMatch(mg.firstParent, preSha) && gateShaMatch(mg.secondParent, validatedSha)
}
// What the agents claimed against git itself. slim = [{ id, merged, broken }], claims = [{ id, commit }].
function truthDivergences(truth, slim, claims, target, lastGood, integBroken) {
  if (!truth) return ['the git truth agent returned nothing: verify the target branch by hand']
  const out = []
  if (truth.clean === false && !integBroken) out.push('the target ' + target + ' has uncommitted files')
  if (truth.lastGoodReachable !== true) out.push('the validated tip claimed by the run (' + lastGood + ') is not confirmed as an ancestor of ' + target)
  const onTarget = truth.mergedIds || []
  for (const r of slim) {
    if (r.merged && !r.broken && !onTarget.includes(r.id)) out.push(r.id + ': the result says merged, but there is no "merge: ' + r.id + ' in ' + target + '" in the history')
    if (!r.merged && !r.planOnly && onTarget.includes(r.id)) out.push(r.id + ': the result says not merged, but its merge commit is on ' + target)
  }
  for (const c of claims) {
    const t = (truth.claims || []).find(x => x.id === c.id)
    if (!t || t.reachable !== true) out.push(c.id + ': the claimed merge commit ' + c.commit + ' is not on ' + target)
  }
  return out
}
// Resume args as shown to the report agent: the config is long and already known to the caller.
// approveRulings is typed by the person (it names the exact text of each costly ruling): it never goes back in resume args.
function withoutApprove(args) {
  if (!args || typeof args !== 'object') return args
  const { approveRulings, ...rest } = args
  return rest
}
function withoutConfig(resumeWith) {
  if (!resumeWith) return resumeWith
  const { config, notes, trackerCli, ...rest } = resumeWith
  return rest
}
// Argv of the git log listing non-merge commits on the target's first-parent line after a merge, ignoring docs-only ones.
function postMergeFixArgs(mergeSha, roadmapDir, docsPaths) {
  const skip = [...new Set([roadmapDir, ...(docsPaths || [])].filter(Boolean))].map(p => ':!' + p)
  return ['log', '--first-parent', '--no-merges', '--format=%H%x09%s', mergeSha + '..HEAD', '--', '.', ...skip]
}
// Commits of other deliverables are theirs to review; everything else after the merge counts, whatever its subject.
function postMergeFixes(commits, E) {
  return (commits || []).filter(c => {
    const m = /^(E\d+) /.exec(c.subject || '')
    return !m || m[1] === E
  })
}

// External-effect authorization. Items: "gate:<name>", "<E>:T<n>" and "<E>:AC<k>" (bare, bind on first use), "<E>:T<n>@<fp>", "<E>:AC<k>@<fp>", "checkout:<target>".
function parseAuthorizeExternal(v) {
  if (v == null || v === '') return { items: [], error: null }
  if (!Array.isArray(v)) return { items: [], error: 'authorizeExternal must be a list of items such as "gate:G3", "E18:T4", "E18:AC1" or "checkout:<target>"' }
  const re = /^(gate:\S+|[A-Za-z][A-Za-z0-9-]*:(T|AC)[1-9]\d*(@[0-9a-f]{8})?|checkout:\S+)$/
  const bad = v.findIndex(i => typeof i !== 'string' || !re.test(i))
  if (bad !== -1) return { items: [], error: `authorizeExternal item not recognized: ${JSON.stringify(v[bad])}` }
  return { items: [...new Set(v)], error: null }
}
// True only for <wtRoot>/_integracao: the integration worktree this workflow creates. Any other path is the person's checkout.
function isOwnWorktree(path, wtRoot) {
  const norm = p => String(p == null ? '' : p).replace(/[\\]/g, '/').replace(/\/+$/, '')
  const a = norm(path), b = norm(wtRoot) + '/_integracao'
  return /^[A-Za-z]:/.test(a) ? a.toLowerCase() === b.toLowerCase() : a === b
}
function isAuthorized(items, item) { return (items || []).includes(item) }
// Deterministic 32-bit FNV-1a; 8 hex digits. With a planBlob that looks like a git object id (40-64 hex; the blob of the committed plan file) the hash depends only on it:
// the agent retranscribes the task fields on each run, so they must not move it. Without a valid blob it falls back to the tasks (n, trimmed title,
// sorted files, external, externalDedupe), so a missing blob still fails safe.
function planFingerprint(tasks, planBlob = '') {
  const raw = String(planBlob || '').trim()
  const blob = /^[0-9a-f]{40,64}$/.test(raw) ? raw : ''
  const str = blob
    ? JSON.stringify([blob])
    : JSON.stringify(['', (tasks || []).map(t => [t.n, String(t.title || '').trim(), [...(t.files || [])].sort(), t.external === undefined ? null : t.external, String(t.externalDedupe || '').trim()])])
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}
// The item to ask for when an external task is not authorized yet (null when it may run). A missing flag counts as external.
function externalHold(task, E, items, fp) {
  if (task.external === false) return null
  const bare = `${E}:T${task.n}`
  const bound = `${bare}@${fp}`
  return isAuthorized(items, bare) || isAuthorized(items, bound) ? null : bound
}
function bindAuthorizations(items, E, fp) {
  const re = /^[^:]+:(T|AC)[1-9]\d*$/
  return (items || []).map(i => (i.startsWith(E + ':') && re.test(i) && i.indexOf('@') < 0 ? `${i}@${fp}` : i))
}
function externalGaps(tasks) {
  const gap = description => ({ severity: 'critical', category: 'defeito', description })
  return (tasks || []).flatMap(t => [
    ...(typeof t.external !== 'boolean' ? [gap(`task ${t.n} must declare external as a boolean (true when it touches anything outside the branch; when in doubt, true)`)] : []),
    ...(t.external === true && !(typeof t.externalDedupe === 'string' && t.externalDedupe.trim()) ? [gap(`external task ${t.n} must declare externalDedupe: how running it twice avoids a duplicate effect`)] : []),
  ])
}
// Acceptance-evidence rows that run a command are held like external tasks: a missing flag counts as external.
// One item per criterion ("<E>:<ac>", bound to the plan): it covers every external row of that criterion in the plan file.
function evidenceHolds(rows, E, items, fp) {
  const out = new Map()
  for (const p of rows || []) {
    if (!VERIFY_EXEC.includes(p.kind) || p.external === false) continue
    const bare = `${E}:${p.ac}`
    if (isAuthorized(items, bare) || isAuthorized(items, `${bare}@${fp}`)) continue
    const h = out.get(bare) || { item: `${bare}@${fp}`, ac: p.ac, commands: [], dedupe: [] }
    h.commands.push(commandKey(p.command))
    if (p.externalDedupe) h.dedupe.push(String(p.externalDedupe))
    out.set(bare, h)
  }
  return [...out.values()]
}
function evidenceExternalGaps(cardAc, planAc) {
  const gap = description => ({ severity: 'critical', category: 'defeito', description })
  const ids = (cardAc || []).map(a => a.id)
  return normalizePlanAc(cardAc, planAc).filter(p => VERIFY_EXEC.includes(p.kind)).flatMap(p => [
    ...(typeof p.external !== 'boolean' ? [gap(`evidence row ${p.ac} must declare external as a boolean (true when its command touches anything outside the branch; when in doubt, true)`)] : []),
    ...(p.external === true && !(typeof p.externalDedupe === 'string' && p.externalDedupe.trim()) ? [gap(`external evidence row ${p.ac} must declare externalDedupe: the command runs again after every gates fix, so say how that avoids a duplicate effect`)] : []),
    ...(p.external === true && !(ids.includes(p.ac) && /^AC[1-9]\d*$/.test(p.ac)) ? [gap(`external evidence row ${p.ac} must use a criterion id of the card (AC<n>), which is what the authorization names`)] : []),
  ])
}
// The command as compared and as dispatched. Exact inside: on one line only ASCII spaces around the value go away (never an escaped one),
// and a multi-line value is never trimmed, since the spaces can belong to a heredoc. One pair of backticks around the whole value also goes:
// a retranscription adds it and a shell would otherwise execute it. Quotes always stay, because "./my tool" means something else without them.
function commandKey(s) {
  const t = String(s == null ? '' : s)
  const oddSlashes = (x, end) => { let n = 0; while (end - n - 1 >= 0 && x[end - n - 1] === '\\') n++; return n % 2 === 1 }
  let start = 0, end = t.length
  if (!/[\r\n]/.test(t)) {
    while (start < end && t[start] === ' ') start++
    while (end > start && t[end - 1] === ' ' && !oddSlashes(t, end - 1)) end--
  }
  const v = t.slice(start, end)
  if (v.length < 2 || v[0] !== '`' || v[v.length - 1] !== '`') return v
  const inner = v.slice(1, -1)
  return inner.includes('`') || oddSlashes(v, v.length - 1) ? v : inner
}
// A test-first task must report a failing check, then the same check passing.
function testFirstGap(task, impl, resumed) {
  if (resumed || !task || task.testFirst !== true || noFiles(task) || !impl || !/^DONE/.test(impl.status)) return ''
  const c = impl.checks || []
  if (c.some((a, i) => a.exit !== 0 && c.slice(i + 1).some(b => b.exit === 0 && commandKey(a.command) === commandKey(b.command)))) return ''
  return `task ${task.n}: test-first without a failing check then the same check passing (${c.length} checks)`
}
// Nothing a shell could run: empty, only blanks, or quotes around only blanks.
function blankCommand(s) {
  const k = commandKey(s).trim()
  return !k || /^(["'])\s*\1$/.test(k)
}
const RAN_MARK = 'already authorized and run in this run'
// A human item is never removed: one that asks for approval of something this run was authorized for and ran may also carry a real need, so it stays
// with a mark that the command it names already ran. Naming the command alone does not mark it, since a real input (a key the command needs) is still open.
function annotateAuthorizedHuman(human, ran) {
  const norm = v => String(v || '').trim().replace(/\s+/g, ' ')
  const asks = /authori[sz]|autoriz|approv|aprov|permiss/i
  const names = (what, r) => (!!r.command && what.includes(norm(r.command))) || (!!r.item && new RegExp('(^|[^A-Za-z0-9-])' + r.item + '(?![A-Za-z0-9])').test(what))
  return (human || []).map(h => {
    const what = norm(h.what)
    if (what.includes(RAN_MARK) || !asks.test(what)) return h
    const r = (ran || []).find(x => names(what, x))
    return r ? { ...h, what: `${h.what} [${RAN_MARK}: ${r.command || r.item}]` } : h
  })
}
// The mark added by annotateAuthorizedHuman is not part of an item's identity.
function humanKey(h) {
  const what = String(h.what || '')
  const at = what.indexOf(` [${RAN_MARK}`)
  return (at < 0 ? what : what.slice(0, at)).trim().replace(/\s+/g, ' ')
}
// A bound item of a deliverable whose plan this run approved under another fingerprint can never match again.
function dropStaleBound(items, bound) {
  return (items || []).filter(i => {
    const m = /^([^:]+):(?:T|AC)[1-9]\d*@([0-9a-f]{8})$/.exec(i)
    return !m || bound[m[1]] === undefined || bound[m[1]] === m[2]
  })
}
// Items not yet in the list, by key, also dropping repeats among the new items.
function missingFrom(list, items, key) {
  const seen = new Set((list || []).map(key))
  return (items || []).filter(x => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true })
}
// Notes a plan agent already read leave the resume args, so a resume does not adjust the plan again; a template waiting for an answer stays.
function dropConsumedNotes(args, consumed) {
  if (!args || !args.notes) return args
  const kept = Object.fromEntries(Object.entries(args.notes).filter(([id, v]) => !(consumed || []).includes(id) || /^\s*<.*>\s*$/.test(String(v))))
  const { notes, ...rest } = args
  return Object.keys(kept).length ? { ...rest, notes: kept } : rest
}
// ---- Roadmap record through the tracker CLI (E18): pure assembly of the exact commands and verdict over the CLI JSON.
// POSIX single quotes; line breaks become spaces first (the CLI collapses them anyway). Only valid in the Bash tool shell.
function shq(s) {
  return "'" + String(s == null ? '' : s).replace(/\s*[\r\n]+\s*/g, ' ').replace(/'/g, "'\\''") + "'"
}
const isPt = lang => /^pt/i.test(String(lang || ''))
const collapseWs = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
// Collapses spaces (like the CLI) and returns the whole text when it fits in `room`; else cuts at the last word that fits and
// appends the suffix naming the committed file with the full text. `cut` is the original text when something was cut.
function fitCell(text, room, source, lang) {
  const t = collapseWs(text)
  if (t.length <= room) return { text: t, cut: '' }
  const suffix = ` [...] ${isPt(lang) ? 'texto completo em' : 'full text in'} ${source}`
  const keep = room - suffix.length
  if (keep <= 0) return { text: suffix.trim().slice(0, Math.max(room, 0)), cut: t }
  let body = t.slice(0, keep)
  if (t[keep] !== ' ') {
    const at = body.lastIndexOf(' ')
    if (at > 0) body = body.slice(0, at)
  }
  return { text: body.trimEnd() + suffix, cut: t }
}
const tickRef = r => (r.includes('`') ? r : '`' + r + '`')
// References kept in the order given while the CLI join (backticks and ", ") fits in `max`.
function fitEvidence(refs, max) {
  const kept = []
  let len = 0
  for (const r of (refs || []).map(x => String(x).trim()).filter(Boolean)) {
    const add = tickRef(r).length + (kept.length ? 2 : 0)
    if (len + add > max) break
    kept.push(r)
    len += add
  }
  return kept
}
// `folder` goes through shq; `args` are already shell-quoted.
function cliCmd(cli, command, folder, args) {
  return ['node "' + cli + '"', command, shq(folder), ...(args || []), '--json'].join(' ')
}
// Short texts of the record, two languages (same rule as the CLI: language starting with "pt" is Portuguese).
function phrases(lang) {
  if (isPt(lang)) {
    return {
      owner: 'dono',
      log: (E, word) => `${E} passou para ${word}`,
      next: (E, word) => `${E}: seguir o fluxo do release após ${word}`,
      inflightNote: E => `${E} em execução pelo release`,
      blockWhat: (E, reason) => `${E} bloqueado: ${reason}`,
      blockUnblocks: E => `quando o bloqueio de ${E} for resolvido`,
      blockHow: E => `desbloqueio de ${E} pelo release`,
      commit: (E, word) => `docs(roadmap): ${E} em ${word}`,
      critNoEvidence: (E, ac, kind, blq) => `${E}: critério ${ac} sem evidência automática (${kind}${blq ? ', ' + blq : ''})`,
    }
  }
  return {
    owner: 'owner',
    log: (E, word) => `${E} moved to ${word}`,
    next: (E, word) => `${E}: continue the release flow after ${word}`,
    inflightNote: E => `${E} running in the release`,
    blockWhat: (E, reason) => `${E} blocked: ${reason}`,
    blockUnblocks: E => `when the block on ${E} is resolved`,
    blockHow: E => `unblock of ${E} by the release`,
    commit: (E, word) => `docs(roadmap): ${E} at ${word}`,
    critNoEvidence: (E, ac, kind, blq) => `${E}: criterion ${ac} has no automatic evidence (${kind}${blq ? ', ' + blq : ''})`,
  }
}
// statusEvidence (optional) replaces the evidence of set-status only: the CLI appends it to the panel Evidence cell, which already holds
// the spec and plan references and refuses a cell over the limit, so a long list belongs to the log row, not to the panel.
// Ordered command list of one record: block-close, set-status + log (or block-open), add-decision, add-pending, inflight-*.
// Every variable text goes through fitCell with the room the CLI leaves in the cell; `cuts` lists the texts that were cut.
function recordCommands({ cli, folder, E, word, piece, blockedBy, evidence, statusEvidence, next, logWhat, decisions, pending, inflight, skipStatus, lang, cellChars, source, blockedStatus }) {
  const P = phrases(lang)
  const max = cellChars || 300
  const cuts = []
  const cmds = []
  const fit = (where, text, room) => {
    const f = fitCell(text, room, source, lang)
    if (f.cut) cuts.push({ where, source, full: f.cut })
    return f.text
  }
  const ev = (refs, room) => fitEvidence(refs, room).map(r => '--evidence ' + shq(r))
  const pieceArg = piece ? ['--piece ' + shq(piece)] : []
  if (blockedBy) {
    const others = (blockedBy.affects || []).filter(x => x !== E)
    if (others.length) return { commands: [], cuts: [], error: `${blockedBy.id} also blocks ${others.join(', ')}; close it by hand (manual close with block-close) once every deliverable it affects can go on` }
    const evs = fitEvidence(evidence, max)
    cmds.push(cliCmd(cli, 'block-close', folder, [shq(blockedBy.id), '--how ' + shq(fit('block-close --how', P.blockHow(E), max)), ...evs.map(r => '--evidence ' + shq(r))]))
  }
  if (!skipStatus) {
    if (word === blockedStatus) {
      // The CLI log line is "<BLQ-n> opened: <what>" and "Unblocks when" gets "; restores <E> to <word>" appended.
      const what = fit('block-open --what', P.blockWhat(E, collapseWs(logWhat) || P.log(E, word)), max - 24)
      const unblocks = fit('block-open --unblocks', P.blockUnblocks(E), max - 64)
      const evs = fitEvidence(evidence, max)
      cmds.push(cliCmd(cli, 'block-open', folder, ['--what ' + shq(what), '--affects ' + shq(E), '--unblocks ' + shq(unblocks), ...pieceArg, ...evs.map(r => '--evidence ' + shq(r))]))
    } else {
      const nextText = fit('set-status --next', collapseWs(next) || P.next(E, word), max)
      cmds.push(cliCmd(cli, 'set-status', folder, [shq(E), shq(word), ...pieceArg, ...(statusEvidence !== undefined ? fitEvidence(statusEvidence, max) : (evidence || []).filter(Boolean)).map(r => '--evidence ' + shq(r)), '--next ' + shq(nextText)]))
      const logEv = fitEvidence(evidence, max)
      cmds.push(cliCmd(cli, 'log', folder, ['--deliverable ' + shq(E), '--what ' + shq(fit('log --what', collapseWs(logWhat) || P.log(E, word), max)), ...(logEv.length ? logEv : ['state.md']).map(r => '--evidence ' + shq(r))]))
    }
  }
  for (const d of decisions || []) {
    const local = d.scope === 'local'
    const phrase = `${isPt(lang) ? 'Alcance' : 'Scope'}: ${local ? 'local' : isPt(lang) ? 'contrato' : 'contract'}.`
    // One more character: the CLI adds a final period when the text has none.
    const text = fit('add-decision --decision', d.text, max - phrase.length - 2)
    const discarded = collapseWs(d.discarded)
    cmds.push(cliCmd(cli, 'add-decision', folder, ['--deliverable ' + shq(E), '--decision ' + shq(text), '--scope ' + shq(local ? 'local' : 'contrato'), ...(discarded ? ['--discarded ' + shq(fit('add-decision --discarded', discarded, max))] : [])]))
  }
  for (const p of pending || []) {
    const text = fit('add-pending --text', p, max - `(${P.owner}) `.length)
    cmds.push(cliCmd(cli, 'add-pending', folder, ['--owner ' + shq(P.owner), '--text ' + shq(text)]))
  }
  if (inflight && inflight.add) {
    const note = fit('inflight-add --note', collapseWs(inflight.note) || P.inflightNote(E), max)
    cmds.push(cliCmd(cli, 'inflight-add', folder, [shq(inflight.add), '--note ' + shq(note)]))
  }
  if (inflight && inflight.remove) cmds.push(cliCmd(cli, 'inflight-remove', folder, [shq(inflight.remove)]))
  return { commands: cmds, cuts }
}
// JSON of the CLI (tool "roadmap") or null.
function parseCli(s) {
  try {
    const o = JSON.parse(String(s == null ? '' : s))
    return o && typeof o === 'object' && o.tool === 'roadmap' ? o : null
  } catch { return null }
}
// CLI verb of a command `node "<cli>" <verb> ...`; the cli path may contain spaces.
function cliVerb(c) { const m = /^node "[^"]*" (\S+)/.exec(String(c == null ? "" : c)); return m ? m[1] : "" }
// Verdict of a record from the raw outputs only: never reads statusWritten, details or any sentence of the agent.
function recordVerdict({ expected, results, read, E, word, piece, blockedStatus }) {
  const failures = []
  const decisionIds = []
  const res = results || {}
  const exp = expected || []
  const inN = r => r.n >= 1 && r.n <= exp.length
  // The git add/commit asked after the list are not runs of it; a run names its command by n (a model abbreviates long echoes), by its text only without n.
  const runs = (Array.isArray(res.runs) ? res.runs : []).filter(r => !(r && /^git /.test(r.command) && !inN(r) && !exp.includes(r.command)))
  const is = (r, i) => !!r && (Number.isInteger(r.n) ? r.n === i + 1 : r.command === exp[i])
  const rd = read || {}
  if (res.error) failures.push(`record agent returned error "${res.error}"`)
  if (!runs.length) failures.push('the record agent ran no command')
  exp.forEach((c, i) => {
    const r = runs[i]
    if (is(r, i)) return
    if (runs.some(x => is(x, i))) failures.push(`command ${i + 1} (${cliVerb(c)}) ran out of order`)
    else if (!r) failures.push(`command ${i + 1} (${cliVerb(c)}) is missing from the runs`)
    else failures.push(`command ${i + 1} ran with a different text than the one assembled`)
  })
  if (runs.length > exp.length) failures.push(`${runs.length - exp.length} command(s) ran beyond the assembled list`)
  let blq = ''
  runs.forEach((r, i) => {
    if (!r) return
    const verb = cliVerb(inN(r) ? exp[r.n - 1] : r.command)
    if (r.exit !== 0) failures.push(`command ${i + 1} (${verb}) exit ${r.exit}`)
    const o = parseCli(r.stdout)
    if (!o) { failures.push(`command ${i + 1} (${verb}) stdout is not JSON of the CLI (tool "roadmap")`); return }
    if (!o.summary || o.summary.exitCode !== 0) failures.push(`command ${i + 1} (${verb}) JSON summary.exitCode ${o.summary && o.summary.exitCode}`)
    if (Array.isArray(o.errors) && o.errors.length) failures.push(`command ${i + 1} (${verb}) JSON has ${o.errors.length} error(s)`)
    if (verb === 'block-open' && o.result && typeof o.result.id === 'string') blq = o.result.id
    if (verb === 'add-decision' && o.result && typeof o.result.id === 'string') decisionIds.push({ id: o.result.id, changed: Array.isArray(o.changed) && o.changed.length > 0 })
  })
  if (String(rd.porcelain == null ? '' : rd.porcelain).trim()) failures.push('the integration worktree is not clean after the record (git status --porcelain is not empty): the record agent did not commit')
  const status = parseCli(rd.status)
  const panel = status && status.result && Array.isArray(status.result.panel) ? status.result.panel : null
  if (!panel) failures.push('reread status --json is missing or has no panel')
  else {
    const row = panel.find(p => p && p.id === E)
    const segs = row && Array.isArray(row.segments) ? row.segments : []
    const seg = piece ? segs.find(s => s.label === piece) : segs[0]
    if (!seg) failures.push(`reread panel has no ${piece ? `segment "${piece}" of ` : 'segment of '}${E}`)
    else if (seg.word !== word) failures.push(`reread panel shows "${seg.word}" for ${E}, expected "${word}"`)
    else if (word === blockedStatus && !(blq ? new RegExp('\\b' + blq + '\\b').test(String(seg.note || '')) : /\bBLQ-\d+\b/.test(String(seg.note || '')))) failures.push(`reread blocked segment of ${E} does not cite ${blq || 'a BLQ'} in its note`)
  }
  const brief = parseCli(rd.brief)
  const checker = brief && brief.result && brief.result.checker
  if (!brief) failures.push('reread brief --json is missing or is not JSON of the CLI')
  else if (!checker || typeof checker.errors !== 'number') failures.push('reread brief --json has no numeric result.checker.errors')
  else if (checker.errors > 0) failures.push(`checker reports ${checker.errors} error(s)`)
  const changedIds = decisionIds.filter(d => d.changed).map(d => d.id)
  const pend = parseCli(rd.pendingDecisions)
  const list = pend && pend.result && Array.isArray(pend.result.decisions) ? pend.result.decisions.map(d => d && d.id) : null
  if (changedIds.length) {
    if (!list) failures.push('reread pending-decisions --json is missing or is not JSON of the CLI')
    else for (const id of changedIds) if (!list.includes(id)) failures.push(`${id} written by add-decision is not in pending-decisions`)
  }
  // holdIds: decisions that can hold dependents. An existing: true answer (the CLI dedupes regardless of status) holds only while the reread still lists it as pending; without a readable list it holds (fail safe).
  const holdIds = decisionIds.filter(d => d.changed || !list || list.includes(d.id)).map(d => d.id)
  return { ok: failures.length === 0, failures, decisionIds: decisionIds.map(d => d.id), holdIds }
}
// Decision text of the spec: a final "Alcance: local." / "Scope: local." sentence, or a trailing "(local)" / "(contract)" / "(scope: local)" parenthetical, sets the scope and leaves the text; anything else is contrato.
function parseDecision(text) {
  const t = collapseWs(text)
  const m = /\s*\b(?:Alcance|Scope):\s*(local|contrato|contract)\.?$/i.exec(t) || /\s*\(\s*(?:(?:alcance|scope)\s*:\s*)?(local|contrato|contract)\s*\)\.?$/i.exec(t)
  if (!m) return { text: t, scope: 'contrato' }
  return { text: t.slice(0, m.index).trim(), scope: m[1].toLowerCase() === 'local' ? 'local' : 'contrato' }
}
// Instruction for the agents whose decisions go through parseDecision: how each decision line must end.
function scopeEndingRule(lang) {
  const w = isPt(lang) ? 'Alcance' : 'Scope'
  const c = isPt(lang) ? 'contrato' : 'contract'
  return `Each decision line ends with the sentence "${w}: local." or "${w}: ${c}." (exactly that, as the last words of the line, no parenthetical): ${c} when the decision binds other deliverables or a public interface, local when it only affects this deliverable.`
}
// A run of the record agent that counts as done: exit 0 and the JSON of the CLI without errors.
function runDone(r) {
  if (!r || r.exit !== 0) return false
  const o = parseCli(r.stdout)
  return !!o && !!o.summary && o.summary.exitCode === 0 && !(Array.isArray(o.errors) && o.errors.length)
}
// Commands of `all` (in order) that have no done run in `runs`: the only ones a second docs round repeats.
function commandsLeft(all, runs) {
  const rs = Array.isArray(runs) ? runs : []
  return (all || []).filter(c => !runDone(rs.find(r => r && r.command === c)))
}
// Paths of the artifacts of one deliverable (DEC-026): docs/plans/<roadmap slug>-<E>/.
function artifactPaths(roadmapSlug, E) {
  const dir = `docs/plans/${roadmapSlug}-${E}/`
  return { dir, spec: `${dir}spec.md`, plan: `${dir}plan.md`, reviews: `${dir}reviews.md` }
}
function reportPathFor(today, ids) {
  return `docs/reports/${today}-${ids}-run.md`
}
// Plugin root from the tracker CLI path (accepts \ and /); null when the path lacks the tracker suffix.
function pluginRootOf(trackerCli) {
  const p = String(trackerCli).replace(/[\\]/g, '/')
  const suffix = '/skills/roadmap-tracker/scripts/roadmap.mjs'
  return p.endsWith(suffix) ? p.slice(0, -suffix.length) : null
}
// Key the person types to approve a costly, irreversible ruling: tied to the ruling id and the text of its decision.
function approveKey(ruling) {
  return `${ruling.id}:${fnv1a(collapseWs(ruling.decision))}`
}
// Stop rules over the spec data (same stop set as spec-tool stopsOf, plus the approval release): blocking human input, a ruling that contradicts a decision or gate, a costly irreversible ruling not yet approved. The rest is carried on.
function stopOrCarry({ rulings, needsPerson, approved }) {
  const ok = Array.isArray(approved) ? approved : []
  const filled = v => v !== null && v !== undefined && v !== ''
  const stops = []
  const carry = []
  for (const h of needsPerson || []) if (h.blocking === true) stops.push({ id: h.id, kind: 'humano', action: 'human-input' })
  for (const r of rulings || []) {
    if (filled(r.contradicts)) stops.push({ id: r.id, kind: 'decisao', action: 'decision' })
    else if (r.costIfWrong === 'high' && r.reversible === false && !ok.includes(approveKey(r))) stops.push({ id: r.id, kind: 'approve-ruling', action: 'approve-ruling', key: approveKey(r) })
    else carry.push(r)
  }
  return { stops, carry }
}
// Decisions to record, from the spec rulings only: the shape recordCommands takes from parseDecision, plus the discarded alternative.
function rulingDecisions(rulings) {
  return (rulings || []).map(r => ({ text: r.decision, scope: r.scope === 'contract' ? 'contrato' : 'local', discarded: r.alternative }))
}
// Differences between the emitted spec and the card of the deliverable (empty = matches): id, criteria ids, text without tag, normalized verify (compared only when the card criterion carries a valid tag, as spec-tool check --roadmap does).
function specCardMismatch(data, E, card) {
  const out = []
  if (!data || data.id !== E) out.push(`spec id ${data && data.id} is not ${E}`)
  const want = (card && card.acceptance) || []
  const got = (data && Array.isArray(data.acceptance)) ? data.acceptance : []
  if (want.length !== got.length) out.push(`spec has ${got.length} criteria, the card has ${want.length}`)
  const vkey = t => t ? [t.kind || '', t.blq || '', collapseWs(t.evidence)].join('|') : ''
  for (let i = 0; i < Math.min(want.length, got.length); i++) {
    const c = want[i]
    const g = got[i] || {}
    const full = collapseWs(c.text)
    const at = full.lastIndexOf('{verify:')
    const bare = at === -1 ? full : collapseWs(full.slice(0, at))
    if (g.id !== c.id) out.push(`criterion ${i + 1}: id ${g.id} is not ${c.id}`)
    if (collapseWs(g.textWithoutTag) !== bare) out.push(`${c.id}: text differs from the card`)
    const tag = parseVerifyTag(c.text)
    const cardTag = tag && !tag.invalid ? tag : null
    if (cardTag && vkey(cardTag) !== vkey(g.verify)) out.push(`${c.id}: verify differs from the card`)
  }
  return out
}
// Verdict over the raw output of the spec load agent (spec-tool check --json, then emit): a failed check is not a failed load (it becomes a critical issue of the review),
// an emit that is not the spec/1 envelope of this deliverable, or that differs from the card, is a failed load.
function checkSpecLoad(t, E, card) {
  if (!t || typeof t !== 'object') return { ok: false, why: 'the load agent returned nothing' }
  if (!Number.isInteger(t.checkExit) || !Number.isInteger(t.emitExit)) return { ok: false, why: 'the load agent did not return the exit codes of check and emit' }
  if (t.checkExit !== 0) return { ok: true, checkFailed: true, why: `spec-tool check exited ${t.checkExit}: ${collapseWs(t.checkStdout).slice(0, 1500)}` }
  if (t.emitExit !== 0) return { ok: false, why: `spec-tool emit exited ${t.emitExit} although check exited 0` }
  let o
  try { o = JSON.parse(String(t.emitStdout)) } catch (e) { return { ok: false, why: `spec-tool emit output is not JSON (${e.message})` } }
  if (!o || typeof o !== 'object') return { ok: false, why: 'spec-tool emit output is not an object' }
  if (o.tool !== 'spec-tool') return { ok: false, why: `tool is ${JSON.stringify(o.tool)}, expected "spec-tool"` }
  if (o.schema !== 'spec/1') return { ok: false, why: `schema is ${JSON.stringify(o.schema)}, expected "spec/1"` }
  if (!o.data || typeof o.data !== 'object') return { ok: false, why: 'the emit has no data' }
  const diff = specCardMismatch(o.data, E, card)
  if (diff.length) return { ok: false, why: `the emitted spec differs from the card: ${diff.join('; ')}` }
  return { ok: true, data: o.data }
}
// Selected, not started dependents (direct or transitive, by card deps) of each pending contract decision; the owner is never held.
function heldBy({ cards, selected, contractDecisions, started }) {
  const byId = Object.fromEntries((cards || []).map(c => [c.id, c]))
  const sel = new Set(selected || [])
  const begun = new Set(started || [])
  const out = new Map()
  const dependsOn = (id, target, seen = new Set()) => {
    if (seen.has(id)) return false
    seen.add(id)
    return ((byId[id] && byId[id].deps) || []).some(d => d === target || dependsOn(d, target, seen))
  }
  for (const d of contractDecisions || []) {
    for (const id of sel) {
      if (id === d.deliverable || begun.has(id) || out.has(id)) continue
      if (dependsOn(id, d.deliverable)) out.set(id, { decision: d.id, owner: d.deliverable })
    }
  }
  return out
}
function holdReason({ decision, owner }) {
  return `held by ${decision} (${owner}, contract, pending ratification)`
}
// <embed src="../../../lib/routing.mjs" exports="strip">
// Gerado de ../../../lib/routing.mjs por plugins/productivity-tools/scripts/embed.mjs; não editar aqui.
// Definição única de roteamento (E6, peça 2): fonte pura (DEC-058), sem imports nem acesso a ambiente.
// Regras 0 a 8 transcritas de routing.md §1 a §4 e de roadmap-release.js (effortFor, reviewModelFor).

const rtTiers = ['haiku', 'sonnet', 'opus'];

function rtScope(files) {
  const f = files || {};
  const seen = new Set([...(f.create || []), ...(f.modify || []), ...(f.test || [])]);
  return seen.size <= 1 ? 0 : seen.size <= 5 ? 1 : 2;
}

function rtUp(tier) {
  return rtTiers[Math.min(rtTiers.indexOf(tier) + 1, 2)];
}

function route(task, ctx) {
  const s = task.score;
  const hasDependents = !!(ctx && ctx.hasDependents);
  // Regra 0: efeito externo conta como blast 2, sem alterar a tarefa recebida.
  const blast = task.external ? 2 : s.blast;
  // Regra 1: escopo e total.
  const scope = rtScope(task.files);
  const total = scope + s.ambiguity + s.reasoning + blast + s.verifiability;
  // Regra 2: tabela.
  let tier = total <= 2 ? 'haiku' : total <= 5 ? 'sonnet' : blast === 2 && s.ambiguity === 2 ? 'opus' : 'sonnet';
  let gate = false;
  // Regra 3: teto mecânico.
  if (scope === 2 && s.ambiguity === 0 && s.reasoning === 0 && blast <= 1) tier = 'haiku';
  // Regra 4: verificação pesada.
  if (s.verifiability === 2 && s.reasoning >= 1) {
    if (total <= 5) tier = rtUp(tier);
    else if (tier === 'sonnet') gate = true;
  }
  // Regra 5: piso de risco.
  const floor = blast === 2;
  if (floor) {
    if (tier === 'haiku') tier = 'sonnet';
    gate = true;
  }
  // Regra 6: effort.
  const effort = tier === 'haiku' ? 'low' : tier === 'sonnet' && total >= 6 ? 'high' : 'medium';
  // Regra 7: revisor.
  const reviewTier = blast === 2 || tier === 'opus' ? 'opus' : 'sonnet';
  // Regra 8: portão.
  if (total >= 7 || (tier === 'haiku' && hasDependents && s.verifiability >= 1)) gate = true;
  return {
    tier,
    effort,
    reviewTier,
    gate,
    score: { scope, ambiguity: s.ambiguity, reasoning: s.reasoning, blast, verifiability: s.verifiability, total },
  };
}
// </embed>
// <embed src="../../../lib/plan-digest.mjs" exports="strip">
// Gerado de ../../../lib/plan-digest.mjs por plugins/productivity-tools/scripts/embed.mjs; não editar aqui.
// Resumo de integridade do plano: fonte pura (DEC-058), sem imports nem acesso a ambiente.
// O algoritmo é o de planFingerprint (FNV-1a de 32 bits) de roadmap-release.js.

// Cópia com chaves de objeto ordenadas (por `<` de string), recursiva em objetos e listas.
function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))) out[k] = canon(value[k]);
    return out;
  }
  return value;
}

// FNV-1a de 32 bits: 8 dígitos hexadecimais minúsculos.
function fnv1a(str) {
  let pdH = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    pdH ^= str.charCodeAt(i);
    pdH = Math.imul(pdH, 0x01000193) >>> 0;
  }
  return pdH.toString(16).padStart(8, '0');
}

function planDigest({ plan, source }) {
  return fnv1a(JSON.stringify(canon({ plan, source })));
}
// </embed>
// </pure>

// ---------------------------------------------------------------- args and config
// runToken comes fresh from each preflight. On a resume (resumeFromRunId) the runtime returns cached results for the
// unchanged prefix of agent() calls, so a git read would repeat what the dead run saw: the token, in its discovery read
// (the first agent call), makes every call differ on every invocation. It never goes back into resume args, so a resume cannot reuse an old one.
const { runToken: RUN_TOKEN_ARG, ...A } = args || {}
const RUN_TOKEN = typeof RUN_TOKEN_ARG === 'string' ? RUN_TOKEN_ARG.trim() : ''
const intArg = (v, d, min) => (Number.isInteger(v) && v >= min ? v : d)
const asList = v => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v])
const CFG = A.config
const OPS = []  // operator actions (strictly necessary ones)
const op = (kind, deliverable, what, doNow, resumeWith, extra) => OPS.push({ kind, deliverable, what, doNow, resumeWith: withoutApprove(resumeWith), ...(extra || {}) })
const MODE = A.mode || 'run'
const AUTH = parseAuthorizeExternal(A.authorizeExternal)
if (AUTH.error) return { status: 'error', error: AUTH.error }
const authorized = item => isAuthorized(AUTH.items, item)
const RESULTS = []
const mkResult = (status, extra) => ({
  status, mode: MODE, operatorActions: OPS, resumeArgs: withoutApprove(A), selection: null, results: RESULTS,
  ownerReview: { acceptedRisks: [], decisionsPending: [], criteriaOpen: [] }, truth: null, lastGood: null, reportPath: null, ...(extra || {}),
})
if (!CFG || typeof CFG !== 'object' || !Array.isArray(CFG.gates) || !CFG.gates.length) {
  return { status: 'error', error: 'args.config is missing or has no gates: run scripts/preflight.mjs and pass its config' }
}
// Every launch carries the run token from preflight (a whitespace-only token counts as missing): refuse before any agent call.
if (!RUN_TOKEN) return { status: 'error', error: 'runToken is missing: launch the workflow through the roadmap-release skill, which runs scripts/preflight.mjs and passes its config, runToken and trackerCli' }
if (typeof A.trackerCli !== 'string' || !A.trackerCli.trim()) return { status: 'error', error: 'args.trackerCli is missing: run scripts/preflight.mjs and pass its trackerCli' }
if (!['run', 'plan-only', 'dry-run'].includes(MODE)) return { status: 'error', error: `invalid mode: ${MODE}` }
const unfilledNotes = Object.keys(A.notes || {}).filter(k => /^\s*<.*>\s*$/.test(String(A.notes[k])))
if (unfilledNotes.length) return { status: 'error', error: `notes still hold the template text, without the owner's answer: ${unfilledNotes.join(', ')}` }
// The worktree root decides where worktrees go and which checkout is the workflow's own: the skill passes it, nothing guesses it.
if (!A.wtRoot) return { status: 'error', error: 'args.wtRoot is missing: the skill passes <dirname(repo)>/<basename(repo)>-wt (or the folder the user named)' }
// An authorized task is never launched without a run token: fail before paying for discovery, preflight and the plan.
if (MODE === 'run' && !RUN_TOKEN && AUTH.items.some(i => /^(?!gate:|checkout:)[^:]+:T[1-9]\d*/.test(i))) return { status: 'error', error: 'runToken is missing: run preflight again and pass its runToken (an authorized external task is never launched without it)' }
const MAXFIX = intArg(A.maxFixRounds, 2, 0)
const MAXPAR = CFG.generated ? 1 : intArg(A.maxParallel ?? CFG.maxParallel, 3, 1)  // a generated config may hide a shared resource
const PREFIX = A.branchPrefix || 'feat/'
const TRAILER = A.trailer || 'Co-Authored-By: Claude <noreply@anthropic.com>'
const PROJECT = CFG.projectContext || ''
const GATES = CFG.gates.filter(g => !g.restricted || authorized('gate:' + g.name))
const BOUND = {}  // deliverable id -> plan fingerprint, set when its plan is approved
const NOTES_READ = []  // deliverables whose notes a plan agent already read
const boundItems = E => (BOUND[E] === undefined ? AUTH.items : bindAuthorizations(AUTH.items, E, BOUND[E]))
for (const g of CFG.gates.filter(g => g.restricted && !authorized('gate:' + g.name))) {
  if (MODE !== 'run') continue
  const item = 'gate:' + g.name
  op('authorize-external', null, `the gate "${g.name}" is restricted (it touches something outside the branch) and was not measured: ${g.cmd}`,
    `Authorize it by running again with authorizeExternal including "${item}". The authorization applies only to deliverables merged after it: it measures nothing for deliverables already merged. Once authorized, the gate runs several times per deliverable: baseline, branch, post-merge and retries`,
    { ...A, authorizeExternal: [...AUTH.items, item] }, { item })
}
if (!GATES.length) return { status: 'error', error: 'every gate is restricted and none is authorized: pass authorizeExternal with "gate:<name>" items', operatorActions: OPS }
const INSTALL = CFG.install || ''
const SETUP_CMDS = asList(CFG.setup)
const ACCEPT_RED = !!(A.acceptRedBaseline || CFG.acceptRedBaseline)
const BEFORE_EVIDENCE = asList(CFG.beforeEvidence)
// docsStage: a string (instructions) or { instructions, measure (Node script printing {"ok":bool,"details":str}), paths (doc prefixes) }.
const DOCS = typeof CFG.docsStage === 'string' ? { instructions: CFG.docsStage } : (CFG.docsStage || {})
const DOCS_PATHS = Array.isArray(DOCS.paths) && DOCS.paths.length ? DOCS.paths : ['docs/']
// Test integrity: a Node script (argv[2] = target branch) printing JSON; config.testIntegrity replaces it, false turns it off.
const TEST_INTEGRITY_DEFAULT = String.raw`const { execFileSync } = require('node:child_process')
const rng = process.argv[2] + '...HEAD'
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 })
const isTest = f => /(\.test\.|\.spec\.|_test\.|(^|\/)test_[^/]*\.py$|(^|\/)(tests?|__tests__)\/)/.test(f)
const files = git('diff', '--name-status', rng).split('\n').filter(Boolean).map(l => l.split('\t'))
const last = f => f[f.length - 1]
const deletedTests = files.filter(f => f[0] === 'D' && isTest(last(f))).map(last)
const prodChanged = files.filter(f => f[0] !== 'D' && !isTest(last(f)) && /\.(js|jsx|mjs|cjs|ts|tsx|sh|py|go|rs|rb|java)$/.test(last(f))).length
const asrt = /\bexpect\(|\bassert\w*[(.]|\bASSERT\b/
const skip = /\.(skip|only|todo)\b|skipIf|^\s*--\s*ASSERT|^\s*\/\/\s*(expect|it|test)\(/
let removedAsserts = 0, assertsAdded = 0, skipsAdded = 0
for (const f of files) {
  const p = last(f)
  if (f[0] === 'D' || !isTest(p)) continue
  let rem = 0, add = 0
  for (const l of git('diff', '-U0', rng, '--', p).split('\n')) {
    if (l.startsWith('+++') || l.startsWith('---')) continue
    if (l.startsWith('-') && asrt.test(l.slice(1))) rem++
    if (l.startsWith('+')) {
      if (asrt.test(l.slice(1)) && !skip.test(l.slice(1))) add++
      if (skip.test(l.slice(1))) skipsAdded++
    }
  }
  removedAsserts += Math.max(0, rem - add)
  assertsAdded += add
}
console.log(JSON.stringify({ deletedTests, removedAsserts, skipsAdded, prodChanged, assertsAdded }))`
const TEST_INTEGRITY = CFG.testIntegrity === false ? null : (typeof CFG.testIntegrity === 'string' && CFG.testIntegrity.trim() ? CFG.testIntegrity : TEST_INTEGRITY_DEFAULT)

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
let blqIds = new Set()  // blockers registered on the roadmap (filled after discovery)

// ---------------------------------------------------------------- schemas
const STR = { type: 'string' }, INT = { type: 'integer' }, BOOL = { type: 'boolean' }
const STRS = { type: 'array', items: STR }
const S_DISC = { type: 'object', properties: {
  error: STR, repo: STR, today: STR, wtRoot: STR, roadmapDir: STR, roadmapSlug: STR, strategy: STR, checker: STR,
  integrationBranch: STR, releaseBranch: STR, target: STR, integratedStatuses: STRS, discardedStatus: STR, blockedStatus: STR, deliverableStatuses: STRS,
  targetExists: BOOL, readFrom: STR, language: STR, cellChars: INT, checkerExists: BOOL,
  cards: { type: 'array', items: { type: 'object', properties: {
    id: STR, title: STR, phase: STR, track: STR, priority: STR, deps: STRS, reqs: STRS, critical: BOOL, criticalMissing: BOOL,
    status: { ...STR, description: 'the Status cell of the panel row, verbatim, with every segment and note' }, mergeCommit: STR, onTarget: BOOL, mergeFound: BOOL, mergeSha: { ...STR, description: 'full 40-character output of git rev-parse for the merge commit' }, onTargetEvidence: STR, acceptance: { type: 'array', items: { type: 'object', properties: { id: STR, text: STR }, required: ['id', 'text'] } } }, required: ['id', 'deps', 'reqs', 'status', 'onTarget', 'mergeFound', 'acceptance'] } },
  blockers: { type: 'array', items: { type: 'object', properties: { id: STR, text: STR, affects: STRS }, required: ['id', 'text'] } },
  donot: STRS,
  donotHolds: { type: 'array', items: { type: 'object', properties: { text: STR, affects: STRS }, required: ['text', 'affects'] } },
  pendingDecisionsStdout: { ...STR, description: 'raw stdout of the tracker CLI pending-decisions --json, not summarized and not reformatted' },
}, required: ['cards', 'repo', 'integrationBranch', 'integratedStatuses', 'deliverableStatuses', 'today', 'roadmapDir', 'strategy', 'checker', 'pendingDecisionsStdout'] }
const S_GATE = { type: 'object', properties: { name: STR, ran: BOOL, exit: INT, total: INT, skipped: INT, failedNames: STRS }, required: ['name', 'ran', 'exit'] }
const S_MEASURE = { type: 'object', properties: { headSha: STR, clean: BOOL, gates: { type: 'array', items: S_GATE }, log: STR, changedFiles: STRS }, required: ['headSha', 'clean', 'gates'] }
const S_PRE = { type: 'object', properties: {
  ok: BOOL, errorKind: { type: 'string', enum: ['dirty', 'setup', 'target', 'other'] }, error: STR,
  integrationWorktree: STR, targetHead: STR, clean: BOOL, envFacts: STR, baseline: S_MEASURE,
}, required: ['ok'] }
const S_SETUP = { type: 'object', properties: { ok: BOOL, error: STR, worktree: STR, branch: STR, baseCommit: STR, head: STR, reused: BOOL, clean: BOOL, taskCommits: INT, committedTasks: { type: 'array', items: INT }, nativeSpec: BOOL, nativePlan: BOOL }, required: ['ok', 'taskCommits', 'committedTasks', 'nativeSpec', 'nativePlan'] }
const HUMAN = { type: 'array', items: { type: 'object', properties: { blq: STR, what: STR, workaround: STR, blocking: BOOL }, required: ['what'] } }
const ISSUES = { type: 'array', items: { type: 'object', properties: {
  severity: { type: 'string', enum: ['critical', 'important', 'minor'] },
  category: { type: 'string', enum: ['defeito', 'decisao', 'ambiente', 'fora-do-escopo', 'pelo-plano'] },
  description: STR, file: STR, blq: STR }, required: ['severity', 'description'] } }
const TIER = { type: 'string', enum: ['haiku', 'sonnet', 'opus'] }
const S_TOOLOUT = { type: 'object', properties: { checkExit: INT, checkStdout: STR, emitExit: INT, emitStdout: STR, blob: STR, head: STR, clean: BOOL }, required: ['checkExit', 'emitExit', 'emitStdout'] }
const S_COMMITTED = { type: 'object', properties: { ok: BOOL, head: STR, commit: STR, blob: STR, error: STR }, required: ['ok'] }
const S_SPEC = { type: 'object', properties: { specPath: STR, slug: STR, decisions: STRS, humanInputs: HUMAN, reused: BOOL }, required: ['specPath', 'decisions', 'humanInputs'] }
const S_REVIEW = { type: 'object', properties: { issues: ISSUES, summary: STR, headSha: STR, clean: BOOL, commitsInRange: INT }, required: ['issues', 'headSha', 'clean', 'commitsInRange'] }
const S_PLANREVIEW = { type: 'object', properties: { ...S_REVIEW.properties, measuredPlanBlob: STR }, required: [...S_REVIEW.required, 'measuredPlanBlob'] }
const S_LOGGED = { type: 'object', properties: { head: STR, commit: STR }, required: ['head'] }
const S_CHECKS = { type: 'array', items: { type: 'object', properties: { command: STR, output: STR, exit: INT }, required: ['command', 'output', 'exit'] } }
const S_IMPL = { type: 'object', properties: { status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_HUMAN'] }, summary: STR, concerns: STR, humanInputs: HUMAN, needsLock: STR, checks: S_CHECKS }, required: ['status', 'summary', 'checks'] }
const S_PROGRESS = { type: 'object', properties: { head: STR, clean: BOOL, done: { type: 'array', items: { type: 'object', properties: { n: INT, firstParent: STR, last: STR }, required: ['n', 'firstParent', 'last'] } }, awaitingPerson: { type: 'array', items: INT } }, required: ['head', 'clean', 'done', 'awaitingPerson'] }
const S_PROGRESS_EXT = { ...S_PROGRESS, properties: { ...S_PROGRESS.properties, launchOpen: { type: 'array', items: INT }, effectMayHaveRun: { type: 'array', items: INT }, effectCompleted: { type: 'array', items: INT } }, required: [...S_PROGRESS.required, 'launchOpen', 'effectMayHaveRun', 'effectCompleted'] }
const S_MARK = { type: 'object', properties: { ok: BOOL }, required: ['ok'] }
const S_LAUNCH = { type: 'object', properties: { ok: BOOL, head: STR }, required: ['ok', 'head'] }
const S_RECORD = { type: 'object', properties: { error: STR, commit: STR, runs: { type: 'array', items: { type: 'object', properties: { n: INT, exit: INT, stdout: STR }, required: ['n', 'exit', 'stdout'] } } }, required: ['runs'] }
const S_RECORD_READ = { type: 'object', properties: { status: STR, brief: STR, pendingDecisions: STR, head: STR, porcelain: STR }, required: ['status', 'brief', 'head', 'porcelain'] }
const S_SYNC = { type: 'object', properties: { ok: BOOL, head: STR, conflictsResolved: INT, details: STR, targetTip: STR, deltaFiles: STRS }, required: ['ok', 'head', 'conflictsResolved', 'targetTip', 'deltaFiles'] }
const S_PROBE = { type: 'object', properties: { head: STR, clean: BOOL, branchHasTarget: BOOL, branchMerged: BOOL }, required: ['head', 'clean', 'branchHasTarget', 'branchMerged'] }
const S_MERGE = { type: 'object', properties: { mergeCommit: STR, firstParent: STR, secondParent: STR, conflicts: INT, clean: BOOL, details: STR }, required: ['clean', 'conflicts', 'mergeCommit', 'firstParent', 'secondParent'] }
const S_DOCS = { type: 'object', properties: { error: STR, commit: STR, runs: { type: 'array', items: { type: 'object', properties: { command: STR, exit: INT, stdout: STR }, required: ['command', 'exit', 'stdout'] } } }, required: ['runs'] }
const S_DOCMEAS = { type: 'object', properties: { statusStdout: STR, briefStdout: STR, clean: BOOL, head: STR, measureOk: BOOL, measureDetails: STR }, required: ['statusStdout', 'briefStdout', 'clean'] }
const S_FIXES = { type: 'object', properties: { commits: { type: 'array', items: { type: 'object', properties: { sha: STR, subject: STR }, required: ['sha', 'subject'] } }, rangeOk: BOOL }, required: ['commits', 'rangeOk'] }
const S_LOCATE = { type: 'object', properties: { mergeSha: STR, rangeOk: BOOL, secondParent: STR, branchTip: STR }, required: ['mergeSha', 'rangeOk', 'secondParent', 'branchTip'] }
const S_CLEAN = { type: 'object', properties: { ok: BOOL, leftovers: STRS, details: STR }, required: ['ok'] }
const S_INTEG = { type: 'object', properties: { deletedTests: STRS, removedAsserts: INT, skipsAdded: INT, prodChanged: INT, assertsAdded: INT }, required: ['deletedTests', 'removedAsserts', 'skipsAdded', 'prodChanged', 'assertsAdded'] }
const S_EVID = { type: 'object', properties: { headSha: STR, clean: BOOL, beforeOk: BOOL, results: { type: 'array', items: { type: 'object', properties: { ac: STR, command: STR, exit: INT, log: STR }, required: ['ac', 'command', 'exit'] } } }, required: ['headSha', 'clean', 'results'] }
const S_TRUTH = { type: 'object', properties: { targetHead: STR, clean: BOOL, lastGoodReachable: BOOL, mergedIds: STRS, notMergedIds: STRS, claims: { type: 'array', items: { type: 'object', properties: { id: STR, commit: STR, reachable: BOOL }, required: ['id', 'commit', 'reachable'] } }, worktrees: STRS, strays: STRS }, required: ['targetHead', 'clean', 'lastGoodReachable', 'mergedIds', 'claims'] }
const S_RESUMELOG = { type: 'object', properties: { found: BOOL, externalRun: { type: 'array', items: { type: 'object', properties: { item: STR, title: STR, command: STR, status: STR, exit: INT, reviewed: BOOL }, required: ['item'] } }, acceptedRisks: { type: 'array', items: { type: 'object', properties: { stage: STR, severity: STR, category: STR, description: STR, file: STR }, required: ['description'] } }, humanInputs: HUMAN, ac: { type: 'array', items: { type: 'object', properties: { ac: STR, kind: { type: 'string', enum: ['test', 'smoke', 'integration', 'human', 'blocked'] }, blq: STR }, required: ['ac', 'kind'] } } }, required: ['found', 'acceptedRisks', 'humanInputs', 'ac'] }
const S_ROLLBACK = { type: 'object', properties: { ok: BOOL, head: STR, clean: BOOL, leftovers: STRS }, required: ['ok', 'head', 'clean'] }

// ---------------------------------------------------------------- discovery
phase('Discovery')
const PRE_TARGET = A.targetBranch || CFG.releaseBranch || ''
// The run token is in the FIRST agent() call: on a resume with resumeFromRunId nothing comes from the cache, so every git read is fresh.
const disc = await agent(`DISCOVERY task (read-only; change nothing). Run token: ${RUN_TOKEN || 'none'} (only makes this read run again on every invocation; ignore it). Answer with measured data.
1. Repository: ${A.repo || 'the git repository of the current directory'} (git rev-parse --show-toplevel). Today (YYYY-MM-DD): ${A.today || 'take it from the system'}.
2. ALL of these fields are REQUIRED: repo, today, roadmapDir, strategy, checker, integrationBranch, integratedStatuses and deliverableStatuses (at least 5 items); never invent a default, return error if one is missing. integratedStatuses and deliverableStatuses come from the vocab of roadmap.config.json.
3. Roadmap folder: ${A.roadmap || 'the only folder under docs/plans/ with a roadmap.config.json (if there are several, return error listing them)'}. From roadmap.config.json read: strategy (relative to the folder), integrationBranch, releaseBranch (empty when absent) and vocab (deliverableStatuses in order, integratedStatuses, discardedStatus, blockedStatus). roadmapDir and strategy are RELATIVE to the repo root, with "/", roadmapDir ending in "/". roadmapSlug = folder name without the "roadmap-" prefix. checker = <roadmapDir>check-roadmap.mjs; checkerExists.
4. Target branch: ${PRE_TARGET ? `"${PRE_TARGET}"` : 'the roadmap releaseBranch if not empty, else "integracao/<roadmapSlug>"'}. Return it in target; targetExists = git rev-parse --verify. READ state.md and the strategy FROM THE TARGET (git show <target>:<path>) if it exists; otherwise from the branch "${A.baseBranch || '<integrationBranch>'}". readFrom = the branch read.
5. Cards: in the strategy, each "<!-- roadmap:card id=... phase=... track=... priority=... depends=... reqs=... critical=... -->" and the title "### E<n> -- <title>" below it. depends "-" means []. When critical is missing, critical=false and criticalMissing=true. acceptance: each numbered item of the card's <!-- roadmap:acceptance --> block, verbatim, with id "AC1", "AC2"... in order.
6. Status: the <!-- roadmap:panel --> block of the state.md read. status = the deliverable's Status cell verbatim, with every segment and note (for example "code: on-branch; acceptance: blocked (BLQ-2)"), never reduced to one word; empty when the card has no row. mergeCommit = first hash in backticks in the Evidence column, if any.
7. Per card, always returning mergeFound as true or false (git truth; if the target does not exist use the branch read): mergeFound = git log --first-parent <target> --grep "^merge: <id> " finds a commit and there is no later commit whose subject is 'Revert "merge: <id> ' (a reverted merge means mergeFound=false and onTarget=false, ignore the other rules). mergeSha = the full 40-character output of git rev-parse for that commit. onTarget = true if mergeFound, or if mergeCommit is an ancestor of the target, or if the code segment of the Status cell (label "code", or the only status of a cell without labels) is in integratedStatuses and the integrationBranch is an ancestor of the target. The ancestor rules (mergeCommit or integrationBranch an ancestor of the target) count ONLY when the code segment is finished. A card with several pieces (labels other than "code", like "piece 1: integrated; piece 2: spec") or whose Status is not an integrated or on-branch word is NOT onTarget by those rules, whatever commit its Evidence cites. The branch ${PREFIX}<id> being an ancestor of the target does NOT count: it is born from the target. Explain in onTargetEvidence.
8. blockers: rows of the <!-- roadmap:blockers --> table (id, text, affects = deliverables in the Affects column). donot: items of the <!-- roadmap:donot --> block, verbatim. donotHolds: for each donot item, { text: the item, affects: ids of the cards whose main object is exactly what the item forbids (read card title and criteria; "do not migrate X" only affects the card that migrates X; when in doubt, do not list) }.
9. language = the "language" field of roadmap.config.json (empty when absent); cellChars = limits.cellChars of the same file (omit when absent).
10. pendingDecisionsStdout = the raw stdout, not summarized and not reformatted, of: node "${A.trackerCli}" pending-decisions "<absolute path of the roadmap folder>" --json. Use the roadmap folder of the worktree that has ${PRE_TARGET || 'the target branch'} checked out (git worktree list), else "${String(A.wtRoot || '').replace(/\/+$/, '')}/_integracao/<roadmapDir>" if it exists, else the roadmap folder of the repository. Run it even when it prints an empty list.
`,
  { label: 'discovery', phase: 'Discovery', schema: S_DISC, model: 'sonnet', effort: 'medium' })
if (!disc || disc.error || !disc.cards || !disc.cards.length) return { status: 'error', error: `discovery failed: ${disc ? disc.error || 'no cards' : 'null agent'}` }
const noMergeFlag = disc.cards.filter(c => typeof c.mergeFound !== 'boolean').map(c => c.id)
if (noMergeFlag.length) return { status: 'error', error: `discovery failed: mergeFound not reported for ${noMergeFlag.join(', ')}` }
if (!(A.repo || disc.repo)) return { status: 'error', error: 'discovery failed: repo not reported' }
for (const f of ['integrationBranch', 'integratedStatuses', 'deliverableStatuses', 'roadmapDir', 'strategy', 'checker']) {
  const v = disc[f]
  if (!v || (Array.isArray(v) && !v.length)) return { status: 'error', error: `discovery failed: ${f} not reported` }
}
const pendingParsed = parseCli(disc.pendingDecisionsStdout)
if (!pendingParsed || !pendingParsed.result || !Array.isArray(pendingParsed.result.decisions)) return { status: 'error', error: 'discovery failed: pendingDecisionsStdout is not the JSON of the CLI pending-decisions (result.decisions missing)' }
if ((disc.deliverableStatuses || []).length < 5) return { status: 'error', error: 'discovery failed: deliverableStatuses not reported (needs at least 5 items)' }
if (!(A.today || disc.today)) return { status: 'error', error: 'discovery failed: today not reported' }
disc.cards.forEach(c => { c.deps = c.deps || []; c.reqs = c.reqs || [] })

const TODAY = A.today || disc.today
const REPO = A.repo || disc.repo
const WT = String(A.wtRoot).replace(/\/+$/, '')
const RM = disc.roadmapDir
const STRAT = disc.strategy
const INTEG = disc.integrationBranch
const BASEBR = A.baseBranch || INTEG
const TARGET = A.targetBranch || CFG.releaseBranch || disc.releaseBranch || `integracao/${disc.roadmapSlug}`
const STATUSES = {
  integrated: disc.integratedStatuses,
  plan: disc.deliverableStatuses[2],
  executing: disc.deliverableStatuses[3],
  onBranch: disc.deliverableStatuses[4],
  discarded: disc.discardedStatus || 'discarded',
  blocked: disc.blockedStatus || 'blocked',
}
disc.cards.forEach(c => { c.cell = c.status; c.status = cardStatus(c.status, STATUSES); c.onTarget = onTargetEffective(c, STATUSES) })
const STATUS_AFTER_MERGE = TARGET === INTEG ? STATUSES.integrated[0] : STATUSES.onBranch
if (TARGET === INTEG && !A.allowIntegrationBranch) return { status: 'error', error: `targetBranch (${TARGET}) is the integrationBranch; pass allowIntegrationBranch: true to merge into it.` }
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
const noCriteria = order.filter(id => !(byId[id].acceptance || []).length)
if (noCriteria.length) return { status: 'error', error: `discovery failed: no acceptance criteria extracted for ${noCriteria.join(', ')}` }
const notes = [...picked.notes, ...(disc.donot || []).map(d => `roadmap "do not" restriction (check before running): ${d}`)]
const interrupted = unfinishedOutside(disc.cards, STATUSES, order)
for (const id of interrupted) notes.push(`${id}: interrupted merge on the target, outside this selection`)
if (A.force) for (const id of order) if (isUnfinished(byId[id], STATUSES)) notes.push(`${id}: force does not apply to an interrupted merge: it is validated and documented first`)
// Contract decisions still pending ratification: dependents of their owner that did not start are held (the owner never is).
const isContract = d => d && (d.scope === 'contract' || d.scope === 'contrato')
const pendContract = pendingParsed.result.decisions.filter(d => isContract(d) && d.id && d.deliverable).map(d => ({ id: d.id, deliverable: d.deliverable }))
const startedByPending = pendingParsed.result.decisions.flatMap(d => (isContract(d) && Array.isArray(d.startedDependents) ? d.startedDependents : []))
const dynContract = []  // contract decisions recorded by this run
const begun = new Set()  // deliverables whose run started in this invocation
// A failed or unconfirmed record of a contract ruling still holds the dependents.
function holdUnconfirmed(E, x, ids) {
  rulingDecisions(x.rulings).forEach((r, i) => {
    if (r.scope !== 'contrato') return
    const id = ids[i] || `unconfirmed contract ruling of ${E}${i ? ' #' + i : ''}`
    if (!dynContract.some(d => d.id === id)) dynContract.push({ id, deliverable: E })
  })
}
const holdOf = id => {
  const h = heldBy({ cards: disc.cards, selected: order, contractDecisions: [...pendContract, ...dynContract], started: [...startedByPending, ...begun] }).get(id)
  return h ? holdReason(h) : ''
}
const heldAtStart = order.map(id => ({ id, reason: holdOf(id) })).filter(h => h.reason)
const isDone = c => !!c && ((c.onTarget && !isUnfinished(c, STATUSES)) || c.status === STATUSES.discarded)
const selection = { target: TARGET, base: BASEBR, integrationBranch: INTEG, readFrom: disc.readFrom, statusAfterMerge: STATUS_AFTER_MERGE, order, skippedUpfront: picked.skipped, held: heldAtStart, notes,
  deps: Object.fromEntries(order.map(id => [id, byId[id].deps.map(d => `${d}:${isDone(byId[d]) ? 'on target' : 'in this run'}`)])) }
log(`selection: ${order.join(' -> ') || '(empty)'}${picked.skipped.length ? ` | skipped: ${picked.skipped.map(s => s.id).join(', ')}` : ''}`)
if (MODE === 'run' && order.length && interrupted.length) {
  const resumeWith = { ...withoutApprove(A), deliverables: [...interrupted, ...order] }
  for (const id of interrupted) op('unfinished-merge', id, `the merge of ${id} is on ${TARGET} without a post-merge status and is outside this selection, so later merges would be measured on an unvalidated target`, `Run again with ${id} in deliverables so it is validated first (if a "do not" veto holds it, decide on overrideDonot), or revert the merge. That validation replaces the panel row with the post-merge status, so an open blocker note or per-piece status on that row is lost. If the merge was already validated, keep the row instead: write its Status cell as "code: ${STATUS_AFTER_MERGE}; <the existing segments>", which the workflow reads as finished, then run again`, resumeWith)
  return mkResult('needs-operator', { selection, resumeArgs: resumeWith })
}
if (MODE === 'dry-run' || !order.length) return mkResult(order.length ? 'done' : 'partial', { selection })
const MIN_BUDGET = intArg(A.minBudgetPerDeliverable, MODE === 'plan-only' ? 150000 : 700000, 0)
if (typeof budget !== 'undefined' && budget.total && budget.remaining() < MIN_BUDGET) {
  return mkResult('partial', { error: `remaining budget (${budget.remaining()}) is below the minimum per deliverable (${MIN_BUDGET})`, selection })
}

// ---------------------------------------------------------------- shared briefing
blqIds = new Set((disc.blockers || []).map(b => b.id))
const donotTxt = (disc.donot || []).map(d => `  * ${d}`).join('\n') || '  (none)'
const blockersTxt = (disc.blockers || []).map(b => `${b.id}: ${b.text}`).join('\n') || '(none)'
const gateDesc = def => `${def.name} (${def.kind}${def.invariant ? ', invariant' : ''}${lockList(def).length ? `, needs lock ${lockList(def).join('+')}` : ''}): ${def.cmd}`
const gatesTxt = GATES.map(gateDesc).join('; ')
// Rule lines shared by the full briefing (COMMON_BASE) and the slim one (COMMON_SLIM_BASE).
const RULE_GIT = `- Git: commits only on your deliverable branch (or on the target ${TARGET}, only in the record, merge and docs stages). NEVER push, except the effect of a task you were told is external and AUTHORIZED. NEVER touch the branch ${INTEG}${TARGET === INTEG ? ' outside the merge/docs stages' : ''} or the worktree ${REPO}, except the integration worktree of the target when the operator authorized checkout:${TARGET}. NEVER use git stash or git add -A: add only your task's files. Commit messages end with the line "${TRAILER}".`
const RULE_RM = `- Delivery branches do NOT edit the roadmap folder ${RM} (that is done only in the record and docs stages, on the target).`
const RULE_CLEAN = `- When done, the working tree must be clean (git status --porcelain empty). Line-ending-only differences: git checkout -- <file>.`
const RULE_TMP = `- Temporary files only in ${WT}/_tmp/<your label>/ (create and delete when done). Nothing loose in ${WT}/. Scripts: write them to a file and run it; one simple command per call: no heredoc, no loop, no chaining with '&&' or ';'. Write files with the Write tool and commit with git commit -F <file>.`
const RULE_PROC = `- Processes: start servers only if the task needs them, in your deliverable's port range; stop everything you started before returning.`
const RULE_LOCKS = `- Shared resources: only agents told they HOLD a lock may use the resource that lock protects (${LOCK_ORDER.join(', ')}). Without the lock and needing it: return BLOCKED with needsLock=<name>.`
const RULE_EXT = `- NEVER perform an external effect (production, deploy, push, sending e-mail or messages, writing shared data, resetting or rolling back someone's checkout) unless your task is marked external and authorized; when in doubt it is external.`
const RULE_CONFLICT = CFG.conflictRules ? `- Conflicts in generated files: ${CFG.conflictRules}\n` : ''
const COMMON_BASE = `
FIXED RULES:
- Tracked roadmap in ${RM} (strategy: ${STRAT}). Registered decisions (${RM}decisions.md and those cited in the PROJECT block, or the file it points to) are NEVER reopened or contradicted.
- The owner PRE-APPROVED: when a skill asks for confirmation or a choice, take the recommended option, record it and go on, except a strategy revision or migration and any external effect. Asking the user is FORBIDDEN (do not use AskUserQuestion).
- Inputs only humans can provide: do not invent the data; use a configurable placeholder or a marked synthetic fixture and report it in humanInputs. Authorization of an external effect is never a humanInput: the workflow asks the person for it when it reaches a plan task or an acceptance-evidence row declared external. Open roadmap blockers:
${blockersTxt}
  Human acts also include: sessions with users, acceptances, owner approvals, go/no-go, credentials and external accounts. Produce the artifacts; never record a fictional acceptance.
- Roadmap "do not" restrictions (violating any is category decisao, severity critical):
${donotTxt}
${RULE_GIT}
${RULE_RM}
${RULE_CLEAN}
${RULE_TMP}
${RULE_PROC}
${RULE_LOCKS}
- Canonical gates: ${gatesTxt}.
- Reviewers classify each problem with category: defeito (bug or unmet criterion), decisao (contradicts a registered decision), ambiente (limit of the local environment, not of the code; when a roadmap blocker is registered, cite its id in blq), fora-do-escopo (only a PRE-EXISTING problem outside the deliverable), pelo-plano (the plan foresaw it). A defect introduced by this diff is never fora-do-escopo nor pelo-plano. Excess scope is a defect.
${RULE_EXT}
- Autonomous decisions follow the recommended option and are recorded for the owner (Origin executor, status pending). Contradicting a registered decision, or changing a canonical gate (its command, kind or threshold), is category decisao, severity critical.
- Write code and generated artifacts in the language of the roadmap, consistent with the project.
${RULE_CONFLICT}PROJECT:
${PROJECT}`

// Mechanical stages (gates, evidence, sync, merge, review log, merge records, report) decide nothing about the roadmap,
// decisions, scope or review categories: they get only the rules they act on.
const COMMON_SLIM_BASE = `
FIXED RULES (mechanical stage):
${RULE_GIT}
${RULE_RM}
- Never write or quote a credential, token or key in any file, commit message, log or report; write 'provided through environment variable <NAME>' instead.
${RULE_CLEAN}
${RULE_TMP}
${RULE_PROC}
${RULE_LOCKS}
${RULE_EXT}
- Asking the user is FORBIDDEN (do not use AskUserQuestion).
${RULE_CONFLICT}PROJECT:
${PROJECT}`

// ---------------------------------------------------------------- preflight
phase('Preflight')
const measureTxt = defs => `${BEFORE_EVIDENCE.length && defs.some(d => lockList(d).length) ? `Before measuring the gates that need a lock, bring the state they depend on up, running in order: ${BEFORE_EVIDENCE.map(c => `"${c}"`).join('; ')}. If one fails, report ran=false for those gates.
` : ''}For each gate run its command and report { name, ran, exit, total, skipped, failedNames }:\n${defs.map(d => `- ${gateDesc(d)}${d.kind === 'tests' ? '' : ' (only name, ran and exit matter)'}`).join('\n')}\nFor "tests" gates read the output: total = tests executed, skipped = tests skipped, failedNames = each failing test as path/of/file::test name (a file that does not even load counts as path/of/file::(collect)). A non-zero exit requires failedNames and failedNames require a non-zero exit. ran=false only when the command cannot run at all. Real numbers, never estimates.`
const FOREIGN_ITEM = 'checkout:' + TARGET
const foreignOk = authorized(FOREIGN_ITEM)
const foreignRule = foreignOk
  ? `If that path is not ${WT}/_integracao it is the person's own checkout, and the operator AUTHORIZED ${FOREIGN_ITEM}: use it for the steps below.`
  : `If that path is not ${WT}/_integracao it is the person's own checkout and ${FOREIGN_ITEM} is NOT authorized: STOP here and touch nothing in it (no setup, no install, no beforeEvidence and no gates; do not abort a merge or clean anything). Skip steps 3 and 4, do only step 5, and return ok=true with integrationWorktree = that path, targetHead and envFacts, without a baseline.`
const pre = await agent(`${COMMON_BASE}

PREFLIGHT (once per run). ${MODE === 'plan-only' ? 'plan-only mode: do only steps 1, 2 and 5.' : 'You HOLD every lock.'}
1. If the branch ${TARGET} does not exist, create it from ${BASEBR}: git -C "${REPO}" branch ${TARGET} ${BASEBR}. git -C "${REPO}" config rerere.enabled true.
2. Integration worktree: if git worktree list already shows ${TARGET}, use that path; otherwise git -C "${REPO}" worktree add "${WT}/_integracao" ${TARGET}. ${foreignRule} If a merge is in progress whose message (file of git rev-parse --git-path MERGE_MSG) starts with "merge: E", it is an interrupted previous run: run git merge --abort only when that worktree is ${WT}/_integracao; in any other path do NOT abort. A merge from another origin counts as dirty. It must be clean; if not, do NOT clean it: ok=false, errorKind="dirty", list the files in error.
3. ${MODE === 'plan-only' ? '(skip)' : SETUP_CMDS.length ? `Only if step 2 did not stop. Environment setup, in the integration worktree, in order: ${SETUP_CMDS.map(c => `"${c}"`).join('; ')}. If one fails, ok=false, errorKind="setup", with the output in error.` : 'No setup commands.'}
4. ${MODE === 'plan-only' ? '(skip)' : `Only if step 2 did not stop. BASELINE in the integration worktree. First, BEFORE any command: clean (git status --porcelain empty) and headSha (git rev-parse HEAD). Install first${INSTALL ? ` (${INSTALL})` : ' (nothing to install)'}. Then measure every gate. ${measureTxt(GATES)}`}
5. envFacts (short, factual text used by every agent): available shells, presence and version of the tools the gates need, measured peculiarities (for example CRLF, scripts that require bash).
Return ok, errorKind, error, integrationWorktree, targetHead (git rev-parse HEAD of the integration worktree), clean, envFacts${MODE === 'plan-only' ? '' : ', baseline { headSha, clean, gates } (none when step 2 stopped)'}.`,
  { label: 'preflight', phase: 'Preflight', schema: S_PRE, model: 'sonnet', effort: 'medium' })
const FOREIGN = !!pre && !!pre.integrationWorktree && !isOwnWorktree(pre.integrationWorktree, WT)
// An unauthorized foreign checkout is left as found: the preflight stops after locating it, so there is no baseline to judge.
const foreignHold = FOREIGN && !foreignOk
if (!pre || !pre.ok || !pre.integrationWorktree || (MODE !== 'plan-only' && !pre.baseline && !foreignHold)) {
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
if (MODE === 'run' && !foreignHold) {
  if (!validMeasure(pre.baseline, pre.targetHead, GATES)) {
    op('preflight:baseline-invalid', null, `the baseline measure is invalid: ${measureProblems(pre.baseline, pre.targetHead, GATES).join('; ')}`,
      'Check the integration worktree and the gate commands, then run again', { ...A })
    return mkResult('needs-operator', { selection })
  }
  const red = isRedBaseline(GATES, BASE)
  if (red.length && !ACCEPT_RED) {
    op('preflight:red-baseline', null, `baseline of ${TARGET} is red in: ${red.join(', ')}`,
      zeroTestGates(GATES, BASE).length
        ? `Fix the command of ${zeroTestGates(GATES, BASE).join(', ')} so it runs tests, or set kind: exit on it in release.config.json if it is not a test suite. An explicitly accepted red baseline is honoured, but a tests gate with total 0 fails any deliverable that adds no tests`
        : 'Fix the target (or the environment) before running; with a red baseline the matching gates stop blocking regressions. To accept it anyway, pass acceptRedBaseline:true', { ...A })
    return mkResult('needs-operator', { selection })
  }
}
const baseTxt = () => GATES.map(d => `${d.name}: ${resultTxt(BASE[d.name])}`).join(' | ')
const COMMON = () => `${COMMON_BASE}
ENVIRONMENT MEASURED IN THE PREFLIGHT: ${pre.envFacts || '(not reported)'}
INTEGRATION WORKTREE ${INTWT}: ${FOREIGN ? `the person's own checkout (${FOREIGN_ITEM} ${authorized(FOREIGN_ITEM) ? 'authorized by the operator' : 'NOT authorized: do not touch it'})` : 'created by this workflow'}.
CURRENT BASELINE OF THE TARGET (a failure is pre-existing only if it is listed here): ${baseTxt()}`
const COMMON_SLIM = () => `${COMMON_SLIM_BASE}
ENVIRONMENT MEASURED IN THE PREFLIGHT: ${pre.envFacts || '(not reported)'}
INTEGRATION WORKTREE ${INTWT}: ${FOREIGN ? `the person's own checkout (${FOREIGN_ITEM} ${authorized(FOREIGN_ITEM) ? 'authorized by the operator' : 'NOT authorized: do not touch it'})` : 'created by this workflow'}.`

// ---------------------------------------------------------------- gates (numeric, judged by the script)
// B = baseline to measure against: the branch uses the snapshot taken at its last sync; post-merge uses the live BASE.
const snapshotBase = () => JSON.parse(JSON.stringify(BASE))
const gateOnce = (g, dir, label, ph, range) => withLocks(g.locks, () => agent(`${COMMON_SLIM()}

MEASURE the gates below in ${dir} (fix nothing). ${lockNote(g.locks)} First, BEFORE any command: clean (git status --porcelain empty; line-ending-only differences: git checkout -- <file>) and headSha (git rev-parse HEAD). Install first if a dependency manifest changed${INSTALL ? ` (${INSTALL})` : ''}.
${measureTxt(g.defs)}
Also return changedFiles = git diff --name-only ${range}, and in log the relevant part of each failing output.`,
  { label, phase: ph, schema: S_MEASURE, model: 'sonnet', effort: 'medium' }))
// An invalid measure (null agent, dirty tree, wrong commit, exit and names disagreeing) is retried once and then counts as an infra failure, never as green.
const measuredGroup = async (g, dir, label, ph, exp, range) => {
  for (const suffix of ['', '-retry']) {
    const r = await gateOnce(g, dir, label + suffix, ph, range)
    if (validMeasure(r, exp, g.defs)) return r
  }
  return null
}
const gates = async (dir, label, ph, B = null, exp = null, range = `${TARGET}...HEAD`) => {
  const groups = gateGroups(GATES)
  const parts = await parallel(groups.map((g, i) => () => measuredGroup(g, dir, `${label}${groups.length > 1 ? '-' + (i + 1) : ''}`, ph, exp, range)))
  if (parts.some(p => !p) || parts.some(p => !gateShaMatch(p.headSha, parts[0].headSha))) {
    return { m: null, ok: false, nullAgent: true, failures: [], summary: 'measurement null or invalid (dirty tree, wrong commit, a missing gate or exit and failing names in disagreement)' }
  }
  const changedFiles = [...new Set(parts.flatMap(p => p.changedFiles || []))]
  const m = { headSha: parts[0].headSha, clean: true, gates: parts.flatMap(p => p.gates), changedFiles, log: parts.map(p => p.log || '').join('\n---\n') }
  const r = allPass(GATES, m, B || BASE, changedFiles)
  return { m, ok: r.ok, nullAgent: false, failures: r.failures, summary: gateSummary(GATES, m, B || BASE) }
}

// ---------------------------------------------------------------- roadmap record (serialized on the target)
let integBroken = null
const NO_REVISION = `Do NOT propose, write or approve a strategy revision or a format migration, whatever the event triggers: the owner's pre-approval never covers them. Do not edit any file of ${RM} by hand: the commands above are the whole roadmap job.`
// Fixed clause of the prompts of the native spec and plan stages (E8): no stage ever asks.
const NO_ASK = 'Never ask the person anything: no question, no AskUserQuestion, no choice handed back in your answer. Take the recommended option, record it and go on.'
const implAgent = (p, o) => agent(p, { agentType: 'productivity-tools:implementer', schema: S_IMPL, ...o })
// Fixed clause of every prompt that hands over assembled shell commands (the shq escape is POSIX; the permission rule is for the Bash tool).
const BASH_ONLY = 'SHELL: run each command exactly as written, one per call, in the Bash tool (Git Bash on Windows), never in the PowerShell tool or in cmd, without rewriting quotes or escapes. Without the Bash tool, run nothing and return an empty list with error "no-bash".'
const LANG = disc.language || ''
const CELL_CHARS = Number.isInteger(disc.cellChars) && disc.cellChars > 0 ? disc.cellChars : 300
const absFolder = INTWT.replace(/\/+$/, '') + '/' + RM.replace(/\/+$/, '')
// Last status word written per deliverable (segment "code" when the cell has labels), starting from the discovery.
const pieceOf = c => (statusSegments(c.cell).some(sg => sg.label) ? 'code' : '')
const lastWord = new Map(disc.cards.map(c => {
  const segs = statusSegments(c.cell)
  const sg = pieceOf(c) ? segs.find(x => /^(code|c[oó]digo)$/.test(x.label)) : segs[0]
  return [c.id, sg ? sg.status : '']
}))
const CHECKERS = {}  // E -> result.checker of the last brief --json read by the docs stage
const numbered = list => list.map((c, i) => (i + 1) + '. ' + c).join('\n')
// Records one status of deliverable E through the tracker CLI; the verdict is computed over raw outputs only.
// extra = { rulings?: spec rulings (the only source of recorded decisions), pending?: string[], inflight?: { add|remove, note }, reason?: string, source?: string }.
const recordStatus = (E, status, refs, extra) => mergeLock(async () => {
  if (integBroken) return null
  const x = extra || {}
  const c = byId[E]
  const piece = pieceOf(c)
  const cur = lastWord.get(E)
  let blockedBy = null
  if (cur === STATUSES.blocked && status !== STATUSES.blocked) {
    const id = (/\bBLQ-\d+\b/.exec(c.cell || '') || [])[0]
    if (id) blockedBy = { id, affects: ((disc.blockers || []).find(bl => bl.id === id) || {}).affects || [E] }
  }
  const rc = recordCommands({ cli: A.trackerCli, folder: absFolder, E, word: status, piece, blockedBy, evidence: refs, logWhat: x.reason, decisions: rulingDecisions(x.rulings), pending: x.pending,
    inflight: x.inflight, skipStatus: cur === status, lang: LANG, cellChars: CELL_CHARS, source: x.source || RM + 'state.md', blockedStatus: STATUSES.blocked })
  if (rc.error) { holdUnconfirmed(E, x, []); return { ok: false, failures: [rc.error], head: null, cuts: [] } }
  const msg = phrases(LANG).commit(E, status)
  const results = rc.commands.length ? await agent(`${COMMON_SLIM()}

RECORD STAGE in the integration worktree ${INTWT} (branch ${TARGET}). Run exactly these commands, in this order, and stop at the first one whose exit is not 0:
${numbered(rc.commands)}
${BASH_ONLY}
Return in runs, for each listed command you ran: n (its number above, not its text), exit and stdout (the whole output); the git commands below go not in runs. Then, in the same worktree: git -C "${INTWT}" add -- "${RM}"; only if git -C "${INTWT}" diff --cached --quiet exits 1, commit with: git -C "${INTWT}" commit -m ${shq(msg)} -m ${shq(TRAILER)} and return the commit hash in commit. The commands are the whole job: do not edit any file by hand. Do NOT propose, write or approve a strategy revision or a format migration: the owner's pre-approval never covers them.`,
    { label: `${E}:status-${status}`, phase: 'Plan', schema: S_RECORD, model: 'haiku', effort: 'low' }) : { runs: [] }
  const read = await agent(`${COMMON_SLIM()}

READ-ONLY re-read in the integration worktree ${INTWT} after the record of ${E}. Run these commands exactly, one per call, change nothing, and return the raw stdout of each (not summarized, not reformatted): status = 1, brief = 2, pendingDecisions = 3, head = 4, porcelain = 5 (empty string when the output is empty).
${numbered([cliCmd(A.trackerCli, 'status', absFolder), cliCmd(A.trackerCli, 'brief', absFolder), cliCmd(A.trackerCli, 'pending-decisions', absFolder), `git -C "${INTWT}" rev-parse HEAD`, `git -C "${INTWT}" status --porcelain`])}
${BASH_ONLY}`,
    { label: `${E}:status-${status}-read`, phase: 'Plan', schema: S_RECORD_READ, model: 'haiku', effort: 'low' })
  if (!results || !read) { holdUnconfirmed(E, x, []); return { ok: false, failures: [!results ? 'null record agent' : 'null re-read agent'], head: null, cuts: rc.cuts } }
  const v = recordVerdict({ expected: rc.commands, results, read, E, word: status, piece, blockedStatus: STATUSES.blocked })
  const failures = rc.commands.length ? v.failures : v.failures.filter(f => f !== 'the record agent ran no command')
  const ok = failures.length === 0
  if (ok) {
    const rds = rulingDecisions(x.rulings)
    v.decisionIds.forEach((id, i) => { if (rds[i] && rds[i].scope === 'contrato' && v.holdIds.includes(id) && !dynContract.some(d => d.id === id)) dynContract.push({ id, deliverable: E }) })
    lastWord.set(E, status)
    if (read.head) lastGood = read.head  // a record-only commit does not invalidate what was already validated
  } else holdUnconfirmed(E, x, v.decisionIds)  // fail safe (AC8)
  return { ok, failures, head: ok ? read.head : null, cuts: rc.cuts }
})

// ============================================================================ one deliverable
async function runDeliverable(E, idx) {
  const card = byId[E]
  const wt = `${WT}/${E}`
  const br = `${PREFIX}${E}`
  const port = 5200 + idx * 10
  const human = []
  const out = { id: E, merged: false, ok: false, human, concerns: [], acceptedRisks: [], reviews: [], externalRun: [], recordCuts: [] }
  const annotateHuman = () => { const kept = annotateAuthorizedHuman(human, out.externalRun); human.length = 0; human.push(...kept) }
  const baseOf = (withNotes = true) => `${COMMON_BASE}
DELIVERABLE ${E}: worktree ${wt}, branch ${br}, port range ${port}-${port + 9}.${(withNotes && A.notes && A.notes[E]) ? `\nOWNER INSTRUCTION OR ANSWER FOR ${E}: ${A.notes[E]}
Never write or quote a credential, token or key from the owner instruction in any file, commit message, review finding or report; write 'provided through environment variable <NAME>' instead.` : ''}`
  const ctxFor = extra => ({ base: baseOf(), envFacts: pre.envFacts, baseline: baseTxt(), E, target: TARGET, wt, planPath: plan && plan.planPath, specPath: spec && spec.specPath, locks: [], ...extra })
  const C = () => briefing(ctxFor())
  // Briefing without the owner notes, for every stage that writes to a committed record (docs, review log, merge-fix).
  const Cn = () => briefing({ ...ctxFor(), base: baseOf(false) })
  // Slim briefing of this deliverable, for its mechanical stages (no owner notes: several of them write committed records).
  const Cs = () => `${COMMON_SLIM()}\nDELIVERABLE ${E}: worktree ${wt}, branch ${br}, port range ${port}-${port + 9}.`
  const cardRef = `card ${E} in ${STRAT} (section ${E}; REQs ${card.reqs.join(', ')}; depends on ${card.deps.join(', ') || '-'}${card.critical ? '; CRITICAL' : ''})`
  const noteE = A.notes && A.notes[E]
  const cardAc = (card.acceptance || []).map(a => ({ id: a.id, text: a.text, tag: parseVerifyTag(a.text) }))
  const TASK_LOCKS = LOCK_ORDER.filter(n => n !== 'merge')
  const AP = artifactPaths(disc.roadmapSlug, E)
  let spec = null, plan = null
  let specRef = null, planRef = null  // null while recovering an interrupted merge
  let setupOk = false  // the worktree exists: only then can the review log be written there
  // Fixers outside the spec and plan stages: an approved spec or plan is never edited to make a finding go away.
  const noSpecEdit = () => `Never edit the spec${specRef ? ' ' + specRef : ''} or the plan${planRef ? ' ' + planRef : ''} to satisfy a finding: they are approved, so if an item can only be met by changing them, do not apply it and explain in concerns.`
  const fmtRisk = x => `${x.stage}: [${x.severity}/${x.category}] ${x.description}`
  const acceptRisks = (stage, issues) => out.acceptedRisks.push(...issues.map(i => ({ stage, severity: i.severity, category: i.category, description: i.description, file: i.file })))
  const persistReviews = async tag => {
    if (!setupOk || (!out.reviews.length && !out.externalRun.length && !out.recordCuts.length)) return
    const cutsTxt = out.recordCuts.length ? ', plus a section "Textos cortados no registro" with one entry per item of recordCuts (origin = source, where it went in, the full text), keeping the entries an earlier run wrote there' : ''
    const ranTxt = out.externalRun.length ? ', plus a section "External effects run" with one line per entry of externalRun (item, title or command, status or exit, reviewed), keeping the lines an earlier run wrote there' : ''
    const w = await agent(`${Cs()}

Write ${AP.reviews} on the branch ${br}, in the language of the roadmap, with the review log (if that file already exists, keep everything it holds and add this run to it; never remove or rewrite what an earlier run recorded): per stage or task, the rounds (round number, reviewer model, tier of the fix that preceded it), the critical/important issues with category and description, the count of minor ones, unresolved items and accepted risks, plus concerns, gates and the human inputs (what, blq, workaround, blocking)${ranTxt}${cutsTxt}. Transcribe faithfully; do not summarize blocking issues. Data: ${JSON.stringify({ reviews: out.reviews, acceptedRisks: out.acceptedRisks, concerns: out.concerns, gates: out.gates, tasks: out.tasks, humanInputs: human, failure: out.error || null, ...(out.externalRun.length ? { externalRun: out.externalRun } : {}), ...(out.recordCuts.length ? { recordCuts: out.recordCuts } : {}) })}
Commit only that file ("${E}: review log${tag ? ' (' + tag + ')' : ''}").`,
      { label: `${E}:review-log${tag ? '-' + tag : ''}`, phase: 'Plan', model: 'sonnet', effort: 'medium' })
    if (w == null) out.concerns.push(`review log${tag ? ' (' + tag + ')' : ''} not written: null agent`)
  }
  // Not enumerable: the blocked record, written after this function returns, uses them to land its cut texts in the review log.
  Object.defineProperty(out, 'logPath', { value: () => AP.reviews })
  Object.defineProperty(out, 'persistLog', { value: persistReviews })
  const fail = async (kind, msg) => {
    out.error = msg; out.failKind = kind; out.branch = br; out.worktree = wt
    await persistReviews('failed')
    return out
  }
  // The human acts and accepted risks of an earlier run live only in the persisted files: both resume paths read them with this agent.
  const readPersistedLog = (dir, ph) => agent(`Read-only. In "${dir}" read ${AP.reviews} (the review log), ${AP.spec} (the spec) and ${AP.plan} (the plan). found = true only if at least one of those files was read. acceptedRisks = every accepted risk listed in the review log (stage, severity, category, description, file when given); an accepted risk is an item the log lists as accepted, never a finding that was fixed or that only appears as an issue of a round; empty list when none. humanInputs = every item of the "Depends on human input" section of the spec plus every human input listed in the review log (what, blq when named, workaround, blocking), one entry per distinct item; empty list when there are none. ac = every row of the "Acceptance criteria evidence" section of the plan (ac = the criterion id alone; kind = test, smoke, integration, human or blocked; blq when named); empty list when the plan or the section is absent. externalRun = every line of the "External effects run" section of the review log (item, title, command, status, exit, reviewed, each only when written), one entry per distinct item and command; empty list when the section is absent. Transcribe faithfully, do not invent.`,
    { label: `${E}:resume-review-log`, phase: ph, schema: S_RESUMELOG, model: 'sonnet', effort: 'medium' })
  const restoreFromLog = (rl, unsettled = []) => {
    const strip = h => unsettled.reduce((x, item) => ({ ...x, what: String(x.what || '').replace(` [${RAN_MARK}: ${item}]`, '') }), h)
    human.push(...missingFrom(human, (rl.humanInputs || []).map(strip), humanKey))
    out.acceptedRisks.push(...missingFrom(out.acceptedRisks, rl.acceptedRisks, x => `${x.stage}|${x.description}`))
    out.externalRun.push(...missingFrom(out.externalRun, (rl.externalRun || []).filter(e => !unsettled.includes(e.item)), x => `${x.item}|${x.command || ''}`))
    annotateHuman()  // what an earlier run already did must not come back as a request
  }
  // The target is checked out in the person's checkout: every stage commits, merges or resets there, so nothing runs without authorization.
  if (FOREIGN && !authorized(FOREIGN_ITEM)) {
    return fail('externo', `the target ${TARGET} is checked out in ${INTWT} and ${FOREIGN_ITEM} is not authorized`)
  }

  const reviewLoop = (...a) => runReviewLoop({ maxFix: MAXFIX, blqIds, reviews: out.reviews, concerns: out.concerns, acceptRisks }, ...a)

  // Clears uncommitted files left by an interrupted run; the patch is kept in _tmp.
  const sanitize = async stage => {
    const dir = `${WT}/_tmp/${E}-dirty`
    const r = await agent(`RESUME CLEANUP in worktree ${wt} (branch ${br}), left with uncommitted files from an interrupted run. Only in this worktree:
1. mkdir -p "${dir}"; git -C "${wt}" diff --binary HEAD > "${dir}/${stage}.patch"; git -C "${wt}" ls-files --others --exclude-standard > "${dir}/${stage}-untracked.txt" and copy those files into "${dir}/${stage}-untracked/".
2. git -C "${wt}" reset --hard HEAD; git -C "${wt}" clean -fd.
3. Return ok, head (git rev-parse HEAD), clean (status --porcelain empty), leftovers.`,
      { label: `${E}:clean-${stage}`, phase: 'Setup', schema: S_ROLLBACK, model: 'haiku', effort: 'low' })
    if (!r || !r.ok || r.clean === false) return false
    out.concerns.push(`resume: uncommitted files from a previous run were discarded; patch in ${dir}`)
    return true
  }

  const specTxt = () => specRef || AP.spec
  const planTxt = () => planRef || AP.plan
  const reviewsTxt = () => (specRef ? AP.reviews : `(review log of the branch ${br}, if any)`)
  const conflictTxt = CFG.conflictRules ? ` Rules for generated files: ${CFG.conflictRules}.` : ''

  const reviewConflicts = async (sha, dir, label) => {
    const cr = await agent(`${C()}

Review (read-only) the conflict resolutions of the merge ${sha} in ${dir}: git -C "${dir}" show --cc ${sha}. Blocks (defeito): a part of one of the branches lost, duplicated code, a generated file resolved by hand, inconsistent counts in docs. Measure headSha, clean, commitsInRange=1.`,
      { label, phase: 'Merge', schema: S_REVIEW, model: 'opus', effort: 'high' })
    if (!cr) return { ok: false, kind: 'infra', why: 'conflict resolution review: null agent' }
    out.reviews.push({ stage: label, rounds: [{ round: 1, reviewModel: 'opus', fixTier: null }], ...compact(cr.issues), unresolved: blocking(cr) })
    if (blocking(cr).filter(i => isHard(i, blqIds)).length) return { ok: false, kind: 'conteudo', why: `conflict resolution rejected: ${fmt(blocking(cr))}` }
    acceptRisks(label, blocking(cr))
    return { ok: true }
  }

  // A merge already on the target that failed validation: it cannot be undone without a human decision (work may sit on top).
  const markBroken = async (why, kind = 'conteudo', doNow = null) => {
    // The merge is already on the target: whatever the failure kind, it stays unvalidated and later merges must stop.
    integBroken = `the merge of ${E} is already on ${TARGET} and ${kind === 'infra' ? 'could not be validated' : 'failed validation'}: ${why}`
    op('merge-rejected', E, integBroken, doNow || (kind === 'infra' ? `Fix the environment and run again with deliverables:["${E}"] (the run resumes as validate-and-document); if you decide to drop the merge: git -C "${INTWT}" revert -m 1 <merge>` : `Fix it on ${TARGET} and run again with deliverables:["${E}"]. To undo: git -C "${INTWT}" revert -m 1 <merge>, delete the branch ${br} and the worktree ${wt}, and run again (the deliverable restarts from scratch)`), { ...A, deliverables: [E] })
    return { ok: false, broken: true, kind, why }
  }

  // A risk accepted after the merge commit lives only in memory until the docs stage: commit it to the log on the target, where a finish-merge reads it.
  // Returns the head the next measure must expect.
  const persistMergeRisks = async (from, exp) => {
    const fresh = out.acceptedRisks.slice(from)
    if (!fresh.length) return exp
    const w = await agent(`${Cs()}

Integration worktree ${INTWT} (branch ${TARGET}). Risks were accepted during the merge of ${E}. Add them to the accepted risks of its review log on ${TARGET}, ${AP.reviews} (create it if there is none), keeping everything the file holds: ${JSON.stringify(fresh)}
Commit only that file ("${E}: accepted merge-stage risks"). Return head (git rev-parse HEAD after the commit) and commit.`,
      { label: `${E}:merge-risks`, phase: 'Merge', schema: S_LOGGED, model: 'sonnet', effort: 'medium' })
    if (!w || !w.head) { out.concerns.push(`merge-stage accepted risks not committed to the review log: ${fresh.map(fmtRisk).join('; ')}`); return exp }
    return w.head
  }

  // Evidence effects run after the last branch log: commit them on the target, where a finish-merge reads them. Returns the head the next measure must expect.
  const persistMergeEffects = async exp => {
    const ran = out.externalRun.filter(e => e.command)
    if (!ran.length) return exp
    const w = await agent(`${Cs()}

Integration worktree ${INTWT} (branch ${TARGET}). In the section "External effects run" of the review log of ${E} on ${TARGET}, ${AP.reviews} (create the section, or the file if there is none), add one line per entry (item, command, exit) that is not there yet, keeping everything the file holds: ${JSON.stringify(ran)}
Commit only that file ("${E}: external effects of the acceptance evidence"). Return head (git rev-parse HEAD after the commit) and commit.`,
      { label: `${E}:merge-effects`, phase: 'Merge', schema: S_LOGGED, model: 'sonnet', effort: 'medium' })
    if (!w || !w.head) { out.concerns.push(`external effects not committed to the review log, so a resume of this merge would not know they ran: ${ran.map(e => e.item).join(', ')}`); return exp }
    return w.head
  }

  // Post-merge gates (one reviewed fix), baseline refresh and docs. Runs inside the merge lock.
  const postMerge = async (mergeCommit, conflicts, onBad, firstExp = mergeCommit) => {
    let g
    let exp = firstExp
    for (let k = 0; ; k++) {
      g = await gates(INTWT, `${E}:merge-gates${k + 1}`, 'Merge', mergeFloor(BASE, out.brM), exp, `${mergeCommit}^1..HEAD`)
      if (g.ok) break
      if (k >= 1 || g.nullAgent) return onBad(`post-merge gates failed: ${g.summary}`, g.nullAgent ? 'infra' : 'conteudo')
      const preFix = g.m.headSha
      const fx = await withLocks(TASK_LOCKS, () => implAgent(`${Cn()}

Integration worktree ${INTWT} (branch ${TARGET}). ${lockNote(TASK_LOCKS)} The post-merge gates of ${E} failed:
${g.summary}
Failing output: ${String(g.m.log || '').slice(0, 3000)}
Fix on ${TARGET} with a test and commit "${E} merge-fix: ...". Do not mask failures. ${noSpecEdit()}`,
        { label: `${E}:merge-fix`, phase: 'Merge', model: 'sonnet', effort: 'medium' }))
      if (!fx || fx.status === 'BLOCKED') return onBad(`post-merge fix ${fx ? 'BLOCKED: ' + fx.summary : 'null'}`, fx ? 'conteudo' : 'infra')
      const rr = await agent(`${Cn()}

Review (read-only) the post-merge fix: git -C "${INTWT}" diff ${preFix}..HEAD. Blocks (defeito): masking a test, relaxing an assertion, skipping a suite, introducing a defect, an edit to the spec or the plan. Measure headSha, clean, commitsInRange.`,
        { label: `${E}:merge-fix-review`, phase: 'Merge', schema: S_REVIEW, model: 'opus', effort: 'medium' })
      if (!rr || blocking(rr).filter(i => isHard(i, blqIds)).length) return onBad(`post-merge fix rejected: ${rr ? fmt(blocking(rr)) : 'null agent'}`, rr ? 'conteudo' : 'infra')
      const riskFrom = out.acceptedRisks.length
      acceptRisks('merge-fix', blocking(rr))
      exp = await persistMergeRisks(riskFrom, rr.headSha)
    }
    Object.assign(BASE, refreshBaseline(BASE, GATES, g.m, g.m.changedFiles))
    lastGood = g.m.headSha

    // Roadmap part of the docs stage: the exact CLI commands, assembled here; the verdict is computed over raw outputs.
    const docPiece = pieceOf(byId[E])
    const ranHuman = h => String(h.what || '').includes('[' + RAN_MARK + ':')
    const pendRoom = CELL_CHARS - `(${phrases(LANG).owner}) `.length
    const critPending = (out.acOpen || []).map(x => fitCell(phrases(LANG).critNoEvidence(E, x.ac, x.kind, x.blq), pendRoom, planTxt(), LANG).text)
    const docsRc = skipStatus => recordCommands({ cli: A.trackerCli, folder: absFolder, E, word: STATUS_AFTER_MERGE, piece: docPiece, blockedBy: null,
      evidence: [mergeCommit, `gates ${GATES.map(d => d.name).join(', ')}`, specTxt(), planTxt(), reviewsTxt()], statusEvidence: [mergeCommit], decisions: [], skipStatus,
      pending: [...out.acceptedRisks.map(fmtRisk), ...human.filter(h => !ranHuman(h)).map(h => h.what), ...critPending], inflight: { remove: br },
      lang: LANG, cellChars: CELL_CHARS, source: reviewsTxt(), blockedStatus: STATUSES.blocked })
    const docsAll = docsRc(false).commands
    const docsFirst = docsRc(lastWord.get(E) === STATUS_AFTER_MERGE).commands
    // Human items marked as already run stay with the agent's judgment: it runs the assembled add-pending only for the ones that keep an open need.
    const docsMaybe = recordCommands({ cli: A.trackerCli, folder: absFolder, E, word: STATUS_AFTER_MERGE, piece: docPiece, blockedBy: null, evidence: [], decisions: [], skipStatus: true,
      pending: human.filter(ranHuman).map(h => h.what), lang: LANG, cellChars: CELL_CHARS, source: reviewsTxt(), blockedStatus: STATUSES.blocked }).commands
    let docs = null, meas = null, verdict = null, docsMeasure = null
    let cmds = docsFirst
    for (let k = 0; k < 2; k++) {
      docs = await agent(`${Cn()}

DOCS STAGE of deliverable ${E} in the integration worktree ${INTWT} (branch ${TARGET}); merge ${mergeCommit}. Only this stage edits the project docs and ${RM}.
1. Project docs: ${DOCS.instructions || '(no project docs instructions configured: skip this item)'}
2. Roadmap: ${E} goes to "${STATUS_AFTER_MERGE}"${STATUS_AFTER_MERGE !== STATUSES.integrated[0] ? ` (merged into ${TARGET}, not yet into the integrationBranch ${INTEG})` : ''}, ${br} leaves the inflight block, and the accepted risks, pending human inputs and criteria without automatic evidence go to pending. Run exactly these commands, in this order, and stop at the first one whose exit is not 0:
${cmds.length ? numbered(cmds) : '(none: everything of this item is already recorded)'}
${BASH_ONLY}
${docsMaybe.length ? `A human item marked "[${RAN_MARK}: ...]" names an external effect this run was authorized for and already ran: when the item asks only for that authorization it is fulfilled, so leave it out of pending; any other need the item states stays open in pending. For each such item that keeps an open need, run its assembled command below after the list above, without changing its text:
${docsMaybe.map(c => '- ' + c).join('\n')}
` : ''}Never record a human act (acceptance, go/no-go, credentials) as done.
3. ${NO_REVISION}
4. Return in runs, for each command you ran: command (the exact text), exit and stdout (the whole output). Then commit the files of item 1 and of ${RM}, adding only them (never git add -A), with "docs: ${E} on ${TARGET}" and the trailer "${TRAILER}", and return the commit hash in commit.${k ? `\nFIX ROUND. The independent measurement found: ${JSON.stringify(docsMeasure)}. Fix what it lists${DOCS.measure ? ' (measureOk must be true)' : ''}; the commands above are only those that still lack a good result.` : ''}`,
        { label: `${E}:docs${k + 1}`, phase: 'Docs', schema: S_DOCS, model: 'sonnet', effort: 'medium' })
      meas = await agent(`MEASUREMENT (read-only) in the worktree "${INTWT}": ${DOCS.measure ? `write this Node program to "${WT}/_tmp/${E}-docs-measure.cjs", run exactly: cd "${INTWT}" && node "${WT}/_tmp/${E}-docs-measure.cjs", delete the file and return its JSON as measureOk (ok) and measureDetails (details):\n${DOCS.measure}\n` : ''}Also run exactly, one per call, and return the raw stdout of each (not summarized, not reformatted): statusStdout = ${cliCmd(A.trackerCli, 'status', absFolder)}; briefStdout = ${cliCmd(A.trackerCli, 'brief', absFolder)}. clean = git status --porcelain empty; head = git rev-parse HEAD.
${BASH_ONLY}`,
        { label: `${E}:docs-measure${k + 1}`, phase: 'Docs', schema: S_DOCMEAS, model: 'haiku', effort: 'low' })
      if (docs && meas) {
        const maybeSet = new Set(docsMaybe)
        verdict = recordVerdict({ expected: cmds, results: { error: docs.error, runs: (docs.runs || []).filter(r => !(r && maybeSet.has(r.command) && !cmds.includes(r.command))) }, read: { status: meas.statusStdout, brief: meas.briefStdout, pendingDecisions: '', head: meas.head, porcelain: '' }, E, word: STATUS_AFTER_MERGE, piece: docPiece, blockedStatus: STATUSES.blocked })
        if (!cmds.length) verdict.failures = verdict.failures.filter(f => f !== 'the record agent ran no command')
        verdict.ok = verdict.failures.length === 0
        const bc = parseCli(meas.briefStdout)
        if (bc && bc.result && bc.result.checker) CHECKERS[E] = bc.result.checker
        docsMeasure = { failures: verdict.failures, clean: meas.clean, head: meas.head, ...(DOCS.measure ? { measureOk: meas.measureOk, measureDetails: meas.measureDetails } : {}) }
        if (verdict.ok && meas.clean !== false && (!DOCS.measure || meas.measureOk === true)) break
        // Second round: only the commands without a good result, plus set-status when the panel does not show the word.
        const panelFailed = verdict.failures.some(f => /^reread (panel|status)/.test(f))
        const left = new Set(commandsLeft(docsFirst, docs.runs))
        cmds = docsAll.filter(c => left.has(c) || (panelFailed && cliVerb(c) === 'set-status'))
      } else { docsMeasure = { failures: [!docs ? 'null docs agent' : 'null measurement agent'] }; cmds = docsFirst }
    }
    const docsOk = !!verdict && verdict.ok && !!meas && meas.clean !== false && (!DOCS.measure || meas.measureOk === true)
    if (docsOk && meas.head) lastGood = meas.head
    return { ok: true, mergeCommit, conflicts, gates: g.summary, docsOk, docsMeasure }
  }

  // Closes the deliverable from the result of the merge block.
  const closeOut = async result => {
    if (result.broken) { out.merged = true; out.broken = true; out.concerns.push(`merge on the target without validation: ${result.why}`); return out }
    if (!result.ok) return fail(result.kind, `not merged: ${result.why}`)
    out.merged = true
    out.ok = true
    out.merge = result
    if (!result.docsOk) {
      out.concerns.push(`docs with pending items after 2 rounds: ${JSON.stringify(result.docsMeasure)}`)
      op('docs', E, `docs or roadmap inconsistent after the merge of ${E}: ${JSON.stringify(result.docsMeasure)}`, 'Fix the record and run the roadmap checker on the target', null)
    }
    const cl = await agent(`CLEANUP of deliverable ${E}: end processes whose command contains "${wt}" or that listen on the ports ${port}-${port + 9}; stop any service you find that was started for ${E}; FIRST: if ${wt} still exists and git -C "${wt}" status --porcelain is not empty, a patch is needed: mkdir -p "${WT}/_tmp/${E}-dirty", save it (git -C "${wt}" diff --binary HEAD > "${WT}/_tmp/${E}-dirty/cleanup.patch", plus the untracked files list and copies) and confirm the file was written; if it cannot be written, do not remove the worktree and list it in leftovers. Then, when no patch was needed, or only after the patch was written: git -C "${REPO}" worktree remove --force "${wt}"; delete "${WT}/_tmp/${E}-"* (the dash is part of the pattern: it must not touch other deliverables such as ${E}0), except every folder whose name ends with -dirty; ${A.keepBranches ? 'keep the branch' : `git -C "${INTWT}" branch -d ${br} (only if merged)`}. List in leftovers what you could not remove.`,
      { label: `${E}:cleanup`, phase: 'Merge', schema: S_CLEAN, model: 'haiku', effort: 'low' })
    if (!cl || !cl.ok) out.concerns.push(`incomplete cleanup: ${cl ? (cl.leftovers || []).join(', ') : 'null agent'}`)
    log(`${E}: merged into ${TARGET} (${result.mergeCommit})`)
    return out
  }

  // Work committed on the target after the merge was never reviewed: review it on every re-run. Returns null when clear, or the broken result.
  const reviewFixesAfterMerge = async mergeSha => {
    const cmd = postMergeFixArgs(mergeSha, RM, DOCS_PATHS).map(a => (/[%:!]/.test(a) ? `'${a}'` : a)).join(' ')
    const pr = await agent(`Read-only. Run exactly: git -C "${INTWT}" ${cmd}
rangeOk = true only if that command exited 0. commits = one { sha, subject } per output line (tab-separated), in order, none filtered out; empty list when there is no output.`,
      { label: `${E}:merge-fix-probe`, phase: 'Merge', schema: S_FIXES, model: 'haiku', effort: 'low' })
    if (!pr || pr.rangeOk !== true) return markBroken(`the probe for commits after the merge ${mergeSha} did not confirm a valid range`, 'infra')
    const commits = postMergeFixes(pr.commits, E)
    if (!commits.length) return null
    const names = commits.map(c => c.sha + ' (' + c.subject + ')').join(', ')
    const rv = await agent(`${C()}

Review (read-only) the commits that sit on ${TARGET} after the merge ${mergeSha} of ${E}, never reviewed: ${names}. Read each one with git -C "${INTWT}" show <sha>, then the files they touch as they are at HEAD. Judge the NET STATE AT HEAD of those commits: a defect reverted or corrected by a later commit of this list does not block; report only what remains at HEAD. Changes of other deliverables in those files are not under review. Blocks (defeito): masking a test, relaxing an assertion, skipping a suite, editing the baseline, introducing a defect. Measure headSha, clean, commitsInRange (how many of the listed commits you actually read).`,
      { label: `${E}:resume-fix-review`, phase: 'Merge', schema: S_REVIEW, model: 'opus', effort: 'high' })
    if (!rv) return markBroken(`the review of the commits after the merge returned nothing: ${names}`, 'infra', `Run again with deliverables:["${E}"] to repeat the review. Commits: ${names}`)
    const hard = reviewTruth(rv, commits.length, `the ${commits.length} commits listed after ${mergeSha}`).filter(i => isHard(i, blqIds))
    if (hard.length) return markBroken(`the commits after the merge were rejected: ${fmt(hard)}; commits: ${names}`, 'conteudo', `Correct the problem on ${TARGET} with a later commit, or revert the commits (git -C "${INTWT}" revert <sha>), then run again with deliverables:["${E}"]. The review judges the net state at HEAD, so a defect reverted or corrected later no longer blocks. Commits: ${names}`)
    acceptRisks('resume-merge-fix', blocking(rv))
    return null
  }

  // A merge already on the target without a post-merge status: validate and document, do not redo the deliverable.
  if (resumeAction(card, STATUSES) === 'finish-merge' && MODE === 'run') {
    log(`${E}: merge ${card.mergeSha || '?'} already on the target without a record; validating and documenting`)
    if (!card.mergeSha) return closeOut(await markBroken('a merge of this deliverable is on the target but the discovery did not identify its commit, so it cannot be validated', 'conteudo', `Identify the merge commit (git -C "${INTWT}" log --first-parent --grep "^merge: ${E} "), then revert it (git revert -m 1) or fix the roadmap record, and run again with deliverables:["${E}"]`))
    // The run that was interrupted held the human acts and accepted risks in memory: recompute them from the card tags and the persisted files.
    const rl = await readPersistedLog(INTWT, 'Merge')
    out.acOpen = criteriaOpen(cardAc, rl && rl.found === true ? rl.ac || [] : [])
    if (!rl || rl.found !== true) out.concerns.push('resume: review log not read, so accepted risks and human inputs may be missing')
    else restoreFromLog(rl)
    return closeOut(await mergeLock(async () => {
      if (integBroken) return { ok: false, kind: 'infra', why: `integration worktree compromised: ${integBroken}` }
      const named = Object.values(BASE).flatMap(r => r.failedNames || [])
      if (named.length && !ACCEPT_RED) return markBroken(`the baseline was measured with this merge already on the target and has named failures that may come from it: ${named.join(', ')}`, 'conteudo', `Compare those failures with the commit before the merge (${card.mergeSha}^1). If they already existed, run again with acceptRedBaseline:true; otherwise fix them on ${TARGET}`)
      const badFix = await reviewFixesAfterMerge(card.mergeSha)
      if (badFix) return badFix
      // out.brM is null on resume, so the count floor uses a baseline that already holds the merge: measure what the merge did to the tests.
      const integWt = `${WT}/_tmp/${E}-integrity-wt`
      const integ = TEST_INTEGRITY ? await agent(`Measurement; changes no branch. First, ignoring errors: git -C "${REPO}" worktree remove --force "${integWt}". Then git -C "${REPO}" worktree add --detach "${integWt}" ${card.mergeSha}. Write this Node program to ${WT}/_tmp/${E}-integrity.cjs, run exactly: cd "${integWt}" && node "${WT}/_tmp/${E}-integrity.cjs" "${card.mergeSha}^1" (with HEAD at the merge it measures ${card.mergeSha}^1..${card.mergeSha}). Always, even if the program fails: delete the file and run git -C "${REPO}" worktree remove --force "${integWt}". Return the fields of the printed JSON. If the program fails, do not invent numbers: return removedAsserts=-1 and zero for the others:\n${TEST_INTEGRITY}\n`,
        { label: `${E}:resume-test-integrity`, phase: 'Merge', schema: S_INTEG, model: 'haiku', effort: 'low' }) : null
      if (!integ || integ.removedAsserts < 0) out.concerns.push(`resume: the test-count floor was not verified for the merge ${card.mergeSha} (test integrity ${TEST_INTEGRITY ? 'not measured' : 'disabled'})`)
      for (const a of integrityHeuristicAlerts(integ)) out.concerns.push(`resume: test integrity of the merge ${card.mergeSha}: ${a}`)
      const hardAlerts = integrityHardAlerts(integ)
      if (hardAlerts.length) {
        if (integrityAckMatches(A.acceptIntegrityAlerts, E, card.mergeSha)) out.concerns.push(`the operator accepted (acceptIntegrityAlerts) the test integrity alerts of the merge ${card.mergeSha}: ${hardAlerts.join('; ')}`)
        else {
          const ack = { ...(A.acceptIntegrityAlerts || {}), [E]: card.mergeSha }
          return markBroken(`the merge ${card.mergeSha} weakened the tests: ${hardAlerts.join('; ')}`, 'conteudo', `These alerts come from the merge itself, so a later fix does not clear them on a re-run. Check each one, then either undo it: git -C "${INTWT}" revert -m 1 ${card.mergeSha}, delete the branch ${br} and the worktree ${wt}, and run again (the deliverable restarts from scratch); or, only if you decide to accept the merge as it is, add acceptIntegrityAlerts:${JSON.stringify(ack)} yourself to the args and run again with deliverables:["${E}"] (the resume args below leave it out on purpose, so they re-measure and stay broken)`)
        }
      }
      return postMerge(card.mergeSha, 0, markBroken, null)  // commits may exist after the merge
    }))
  }

  // A BLQ closed on the roadmap while the card still tags a criterion blocked on it: only a revision (or reopening it) fixes that.
  const closed = closedBlockers(cardAc, blqIds)
  if (closed.length) {
    out.doNow = `${closed.join(', ')} ${closed.length > 1 ? 'are' : 'is'} closed on the roadmap but the card still tags ${closed.map(b => `{verify: blocked ${b}}`).join(' and ')}: change the tag through a strategy revision, or reopen ${closed.join(', ')}, then run again`
    return fail('decisao', `the card ${E} tags a criterion as blocked by ${closed.join(', ')}, which is not registered as open on the roadmap`)
  }

  // ---------- Setup
  const setup = await setupLock(() => agent(`${C()}

SETUP of deliverable ${E} (mechanical; do not change tracked files).
1. If ${wt} is already a registered worktree, reuse it (reused=true). Otherwise, if the branch ${br} exists: git -C "${REPO}" worktree add "${wt}" ${br}; else: git -C "${REPO}" worktree add "${wt}" -b ${br} ${lastGood}.
2. Install${INSTALL ? `: ${INSTALL}` : ': nothing to install'}.
3. baseCommit = git -C "${wt}" merge-base ${br} ${TARGET}; head = git -C "${wt}" rev-parse HEAD; clean = git -C "${wt}" status --porcelain empty (do not clean anything here).
4. Measure the previous version's work on the branch, read-only: git -C "${wt}" log --format=%s ${TARGET}..HEAD; taskCommits = the number of those subjects that match ^${E} T(\\d+): ; committedTasks = the distinct task numbers (the digits) of those subjects, ascending; nativeSpec = the file ${artifactPaths(disc.roadmapSlug, E).spec} exists in ${wt} on this branch; nativePlan = the file ${artifactPaths(disc.roadmapSlug, E).plan} exists in ${wt} on this branch.
Return ok (true only if baseCommit and head are not empty), worktree, branch, baseCommit, head, reused, clean, taskCommits, committedTasks, nativeSpec, nativePlan.`,
    { label: `${E}:setup`, phase: 'Setup', schema: S_SETUP, model: 'haiku', effort: 'low' }))
  if (!setup || !setup.ok || !setup.baseCommit) return fail('infra', `setup failed: ${setup ? setup.error : 'null agent'}`)
  setupOk = true
  if (setup.clean === false && !(await sanitize('setup'))) return fail('infra', `worktree ${wt} is still dirty after the automatic cleanup`)
  out.setup = { worktree: setup.worktree || wt, branch: setup.branch || br, baseCommit: setup.baseCommit, head: setup.head, reused: !!setup.reused }

  // Task commits of the previous version (spec and plan of the previous skills) without a native spec: the new spec or plan would rewrite committed work, so the person finishes on the previous version or discards the branch.
  if (setup.taskCommits > 0 && setup.nativeSpec !== true) {
    const done = Array.isArray(setup.committedTasks) && setup.committedTasks.length ? ` (tasks ${setup.committedTasks.join(', ')})` : ''
    op('previous-version', E, `the branch ${br} already holds ${setup.taskCommits} task commit(s)${done} made by the previous version of the release and has no native spec at ${artifactPaths(disc.roadmapSlug, E).spec}`,
      `Either finish ${E} on the previous version of the release, or discard the branch and the worktree (git -C "${REPO}" worktree remove --force "${wt}", then git -C "${REPO}" branch -D ${br}) and run again with deliverables:["${E}"] (the deliverable restarts from scratch with the native spec)`, { ...A, deliverables: [E] })
    return fail('conteudo', `the branch ${br} has ${setup.taskCommits} task commit(s) of the previous version and no native spec; the workflow writes no spec over committed work`)
  }

  // ---------- Spec (native author; the tool output is read by code)
  const pluginRoot = pluginRootOf(A.trackerCli)
  if (!pluginRoot) return fail('infra', `args.trackerCli (${A.trackerCli}) does not end with skills/roadmap-tracker/scripts/roadmap.mjs, so the plugin root and the path of spec-tool cannot be derived`)
  const specTool = `${pluginRoot}/scripts/spec-tool.mjs`
  const specAbs = `${wt}/${AP.spec}`
  const rmAbs = `${wt}/${RM.replace(/\/+$/, '')}`
  const specRules = `Fixed rules of this run:
- ${NO_ASK}
- Parts that are human acts: produce the artifacts and leave the acceptance to the human; invent no human data.
- Delivery: there is no other delivery stage, so an external effect the card or the spec requires is performed by an external task of the plan (an external evidence row may check that effect, never replaces the task).
- Record every external effect in externalEffects; never perform it.
- Every task of the plan, the external ones included, runs in the deliverable worktree ${wt} on ${br} before the merge; no task of the plan runs in the integration worktree (the workflow's own merge, post-merge gates and docs stages run there). The design never makes a task depend on the merge, the target or the integration worktree.
- Do not commit: the caller commits. One simple command per call: no heredoc, no loop, no && and no ;.`
  const specLoadOnce = k => agent(`${Cs()}

SPEC LOAD of deliverable ${E} (mechanical, read-only; change no file). Run these commands exactly, one per call, and return the raw stdout and the exit code of each one, not summarized and not reformatted: checkStdout and checkExit = 1, emitStdout and emitExit = 2, head = 3, clean = true when 4 prints nothing.
${numbered([`node "${specTool}" check "${specAbs}" --roadmap "${rmAbs}" --json`, `node "${specTool}" emit "${specAbs}" --roadmap "${rmAbs}"`, `git -C "${wt}" rev-parse HEAD`, `git -C "${wt}" status --porcelain`])}
${BASH_ONLY}
${NO_ASK}`,
    { label: `${E}:spec-load${k}`, phase: 'Spec', schema: S_TOOLOUT, model: k < 3 ? 'haiku' : 'sonnet', effort: k < 3 ? 'low' : 'medium' })
  // Attempts 1 and 2 in haiku/low, the 3rd in sonnet/medium; a failed check is not a failed load.
  const loadSpec = async () => {
    let why = ''
    for (let k = 1; k <= 3; k++) {
      const v = checkSpecLoad(await specLoadOnce(k), E, card)
      if (v.ok) return v
      why = v.why
    }
    return { ok: false, why }
  }
  const reusedAsIs = setup.nativeSpec === true && !noteE
  if (!reusedAsIs) {
    const authored = await agent(`mode: unattended
output: ${specAbs}
specTool: ${specTool}
language: ${LANG || 'the language of the roadmap'}
roadmap: ${rmAbs}
card: ${E}
ownerNote:
${noteE ? `Owner instruction or answer for ${E}: ${noteE}\nNever write or quote a credential, token or key from it in any file; write 'provided through environment variable <NAME>' instead.\n` : ''}${setup.nativeSpec === true ? `The file ${AP.spec} already exists on this branch: edit it to take the instruction into account. A ruling the instruction does not change keeps its id and its text.\n` : ''}${specRules}
${Cn()}`,
      { agentType: 'productivity-tools:spec-author', label: `${E}:spec`, phase: 'Spec' })
    if (authored == null) return fail('infra', 'spec: null agent')
  }
  let specLoad = await loadSpec()
  if (!specLoad.ok) return fail('infra', `spec load: ${specLoad.why}`)
  let specReused = reusedAsIs
  if (!reusedAsIs) {
    const msgFile = `${WT}/_tmp/${E}-spec-commit.txt`
    const cm = await agent(`${Cs()}

COMMIT of the spec of deliverable ${E} (mechanical). Only the file ${AP.spec} may enter the commit. One command per call, in this order:
1. Write the commit message with the Write tool (not with a shell command) to "${msgFile}": the subject line "${E}: spec", an empty line, then the line ${TRAILER}
2. git -C "${wt}" add -- ${AP.spec}
3. git -C "${wt}" diff --cached --quiet -- ${AP.spec}   (exit 0 means nothing changed: do not commit, delete the message file and return ok true with an empty commit)
4. Otherwise git -C "${wt}" commit -F "${msgFile}"
5. Delete "${msgFile}". Return head = the output of git -C "${wt}" rev-parse HEAD, and commit = the same hash when a commit was made (empty when none). ok is false, with error, when a command failed.
${NO_ASK}`,
      { label: `${E}:spec-commit`, phase: 'Spec', schema: S_COMMITTED, model: 'haiku', effort: 'low' })
    if (!cm || !cm.ok) return fail('infra', `spec commit: ${cm ? cm.error || 'not ok' : 'null agent'}`)
    specReused = !cm.commit
  }
  spec = { specPath: AP.spec, reused: specReused }
  let loadErr = ''
  const specLoadIssues = () => (specLoad.checkFailed ? [{ severity: 'critical', category: 'defeito', description: specLoad.why }] : [])
  const specLoop = await reviewLoop('spec',
    (round, prev) => agent(`${C()}

Review (read-only) the spec ${wt}/${AP.spec} of deliverable ${E} against the ${cardRef}, ${wt}/${RM}requirements.md, ${wt}/${RM}decisions.md and the decisions cited in the PROJECT block (or the file it points to).
Blocks: an acceptance criterion of the card missing or altered (defeito); a REQ not met (defeito); an autonomous decision that contradicts a registered decision, or a canonical gate changed (decisao, critical); scope outside the card (defeito); a violation of the "do not" block (decisao, critical); invented human data (defeito); a human input marked blocking without need, or a blocking one handled as a placeholder (defeito); a design or autonomous decision that leaves an external effect the card requires to the workflow, the operator or a later stage instead of a task of the plan, except merging the target into the integration branch and pushing it, which are the owner's (a criterion that needs them is a human act) (defeito); a design or autonomous decision that has a task of the plan, or an external effect of the design, run after the merge, in the integration worktree or in the target (defeito); a design that is not viable in the current code (defeito; check the code).${prev ? `\nIssues from the previous round (${repeatRule()}):\n${prev}` : ''}
Measure: headSha, clean (status --porcelain empty), commitsInRange (git -C "${wt}" rev-list --count ${TARGET}..HEAD).
${NO_ASK}`,
      { label: `${E}:spec-review${round}`, phase: 'Spec', schema: S_REVIEW, model: 'opus', effort: 'medium' }),
    async (iss, k, tier) => {
      const fx = await agent(`${C()}

Fix the spec ${AP.spec} according to the review below, in autonomous mode, and commit. Stop after the commit.
${fmt(iss)}
Return specPath, slug (without the ID), decisions (full list), humanInputs (full list).
The spec ends with a json data block in the spec/1 schema, which must stay valid: run node "${specTool}" check "${specAbs}" --roadmap "${rmAbs}" before the commit, one simple command per call. Rulings are read from that block, never from your answer.
${NO_ASK}`,
        { label: `${E}:spec-fix${k}`, phase: 'Spec', schema: S_SPEC, model: tier, effort: effortFor(tier) })
      if (!fx) return null
      const again = await loadSpec()
      if (!again.ok) { loadErr = again.why; return null }
      specLoad = again
      return { status: 'DONE' }
    },
    r => [...reviewTruth(r, specReused ? 0 : 1, `${TARGET}..HEAD`), ...specLoadIssues()],
    { tier: 'opus', reviewModel: 'opus' })
  if (loadErr) return fail('infra', `spec load: ${loadErr}`)
  if (!specLoop.ok) return fail(specLoop.kind, specLoop.msg)
  const specData = specLoad.data
  const rulings = Array.isArray(specData.rulings) ? specData.rulings : []
  const needs = Array.isArray(specData.needsPerson) ? specData.needsPerson : []
  const specHuman = needs.map(h => ({ blq: h.blq || undefined, what: String(h.what || ''), workaround: h.workaround || undefined, blocking: h.blocking === true }))
  human.push(...specHuman)
  out.spec = AP.spec
  specRef = AP.spec
  const approved = A.approveRulings && Array.isArray(A.approveRulings[E]) ? A.approveRulings[E] : []
  const stopped = stopOrCarry({ rulings, needsPerson: needs, approved })
  const stopsOfKind = kind => stopped.stops.filter(x => x.kind === kind)
  const rulingList = ids => rulings.filter(r => ids.includes(r.id)).map(r => `${r.id}: ${collapseWs(r.decision)}${r.contradicts ? ` (contradicts ${r.contradicts})` : ''}`).join('; ')
  if (stopsOfKind('humano').length) {
    const blockingHuman = specHuman.filter(h => h.blocking)
    op('human-input', E, blockingHuman.map(h => `${h.blq ? h.blq + ': ' : ''}${h.what}`).join('; '),
      'Provide the data (or the decision) and run again passing the answer in notes. Never put a secret in notes: set an environment variable and name it', { ...A, deliverables: [E], notes: { ...(A.notes || {}), [E]: '<owner answer>' } })
    return fail('humano', `blocking human input: ${blockingHuman.map(h => h.what).join('; ')}`)
  }
  if (stopsOfKind('decisao').length) {
    const list = rulingList(stopsOfKind('decisao').map(x => x.id))
    out.doNow = `The spec ${AP.spec} of ${E} holds ruling(s) that go against a registered decision or a canonical gate (${list}). Decide (a new DEC or a revision of the existing one) and run again with the decision in notes`
    return fail('decisao', `spec ruling(s) contradict a registered decision or gate: ${list}`)
  }
  if (stopsOfKind('approve-ruling').length) {
    const list = rulingList(stopsOfKind('approve-ruling').map(x => x.id))
    const keys = rulings.filter(r => r.costIfWrong === 'high' && r.reversible === false).map(approveKey)
    op('approve-ruling', E, `the spec of ${E} (committed at ${AP.spec}) holds ruling(s) that are costly if wrong and cannot be undone, so the plan was not written: ${list}`,
      `Read the ruling(s) in ${AP.spec} on the branch ${br}. To accept them, run again adding approveRulings:${JSON.stringify({ [E]: keys })} to the args, typed by you: each key ties the approval to the exact text of its decision, so a decision that changes asks again. To refuse, pass the decision in notes. The resume args leave approveRulings out on purpose`,
      { ...A, deliverables: [E] })
    return fail('externo', `waiting for the approval of costly irreversible ruling(s): ${list}`)
  }
  out.rulings = stopped.carry
  out.decisions = stopped.carry.map(r => r.decision)
  spec.humanInputs = specHuman
  spec.decisions = out.decisions

  // ---------- Plan (native author; the tool output is read by code)
  const planTool = `${pluginRoot}/scripts/plan-tool.mjs`
  const planAbs = `${wt}/${AP.plan}`
  const committedTasks = (Array.isArray(setup.committedTasks) ? setup.committedTasks : []).filter(Number.isInteger)
  const hasPlanFile = setup.nativePlan === true
  const reusedPlanAsIs = hasPlanFile && !noteE
  const frozen = hasPlanFile && !!noteE && committedTasks.length > 0
  const planLoadFail = why => fail('infra', `plan load: integrity digest not confirmed (${why})`)
  const planRules = `Plan rules of this run:
- ${NO_ASK}
- The header of the prose of the plan carries this exact line:
**Roadmap:** ${RM}
- Each task lists the locks it needs (locks: names from ${TASK_LOCKS.join(', ') || '(none configured)'}, only the ones the task really uses).
- Evidence: for EACH criterion of the card, a row with kind test, smoke or integration and the exact command that exits 0 only if that criterion holds (plus testRef), or kind human (a human act listed in the rules), or kind blocked (with blq, a registered blocker id). A criterion with a {verify: ...} tag MANDATORILY keeps the tag's command: you may add evidence, never replace it, and you create the test that the command references. The ac of each evidence row is ONLY the criterion id (e.g. AC1).
- Delivery: there is no other delivery stage, so an external effect the card or the spec requires is performed by an external task of the plan (an external evidence row may check that effect, never replaces the task).
- Per task declare external (true when the task changes or sends anything outside the branch, or reads production: production, deploy, push, e-mail or message, writing shared data, someone's checkout; a command that only reads a local file outside the branch, such as counting the lines of ../outbox.log, is not external; when in doubt, true). An external task also declares externalDedupe: how running it twice avoids a duplicate effect (idempotency key or an existence check before acting). Every external effect the card or the spec requires is a task of the plan with \`external: true\`, except merging the target into the integration branch and pushing it, which are the owner's (a criterion that needs them is a human act); "not a task of this plan" does not apply to it. Order an external task after every task whose code it ships. Every task of the plan, the external ones included, runs in the deliverable worktree ${wt} on ${br} before the merge; no task of the plan runs in the integration worktree (the workflow's own merge, post-merge gates and docs stages run there), and no task needs the merge, the target or the integration worktree.
- For each evidence row with a command (kind test, smoke or integration) declare external the same way (the same rule: a command that only reads a local file outside the branch is not external; when in doubt, true). An external row also declares externalDedupe, because the command runs again after every gates fix and every late sync.
- Say whether a task needs a browser and what counts as acceptable evidence when a step cannot be exercised in this environment.
- Task commits start with "${E} T<n>:".
- Do not commit: the caller commits. One simple command per call: no heredoc, no loop, no && and no ;.`
  const planLoadOnce = (k, useSpec = true) => agent(`${Cs()}

PLAN LOAD of deliverable ${E} (mechanical, read-only; change no file). Run these commands exactly, one per call, and return the raw stdout and the exit code of each one, not summarized and not reformatted: checkStdout and checkExit = 1, emitStdout and emitExit = 2, blob = 3 (empty when it fails), head = 4, clean = true when 5 prints nothing.
${numbered([`node "${planTool}" check "${planAbs}"${useSpec ? ` --spec "${specAbs}"` : ""} --json`, `node "${planTool}" emit "${planAbs}"${useSpec ? ` --spec "${specAbs}"` : ""}`, `git -C "${wt}" rev-parse "HEAD:${AP.plan}"`, `git -C "${wt}" rev-parse HEAD`, `git -C "${wt}" status --porcelain`])}
${BASH_ONLY}
${NO_ASK}`,
    { label: `${E}:plan-load${k}`, phase: 'Plan', schema: S_TOOLOUT, model: k < 3 ? 'haiku' : 'sonnet', effort: k < 3 ? 'low' : 'medium' })
  // Attempts 1 and 2 in haiku/low, the 3rd in sonnet/medium; the digest is recalculated here from the emit.
  // useSpec false: the previous plan on the frozen path is read against no spec (the spec already holds the owner note, which the old plan cannot cover yet).
  const loadPlan = async (useSpec = true) => {
    let why = ''
    for (let k = 1; k <= 3; k++) {
      const v = checkPlanLoad(await planLoadOnce(k, useSpec), { E, RM })
      if (v.ok) return v
      why = v.why
    }
    return { ok: false, why }
  }
  const planAuthorOnce = diffs => agent(`mode: unattended
output: ${planAbs}
planTool: ${planTool}
spec: ${specAbs}
language: ${LANG || 'the language of the roadmap'}
roadmap: ${RM}
card: ${E}
ownerNote:
${noteE ? `Owner instruction or answer for ${E}: ${noteE}\nNever write or quote a credential, token or key from it in any file; write 'provided through environment variable <NAME>' instead.\n` : ''}${hasPlanFile ? `The file ${AP.plan} already exists on this branch: edit it to take the instruction into account; if the instruction changes nothing, leave the file untouched.\n` : ''}${frozen ? `Tasks already committed on this branch (${committedTasks.join(', ')}) are frozen: each keeps its number, its text and every field of its block. Only tasks not yet committed may change, and a new task gets a number greater than the largest existing one.\n` : ''}${diffs.length ? `The previous attempt changed frozen tasks: ${diffs.join('; ')}. Undo those changes.\n` : ''}${planRules}
${Cn()}`,
    { agentType: 'productivity-tools:plan-author', label: `${E}:plan`, phase: 'Plan' })
  let planLoad = null
  let planCommitted = false
  let planBlobNow = ''
  if (reusedPlanAsIs) {
    planLoad = await loadPlan()
    if (!planLoad.ok) return planLoadFail(planLoad.why)
    planBlobNow = planLoad.blob
  } else {
    let prevPlan = null
    if (frozen) {
      const first = await loadPlan(false)
      if (!first.ok) return planLoadFail(first.why)
      prevPlan = first.plan
    }
    let diffs = []
    for (let attempt = 1; attempt <= 2; attempt++) {
      const authored = await planAuthorOnce(diffs)
      if (authored == null) return fail('infra', 'plan: null agent')
      planLoad = await loadPlan()
      if (!planLoad.ok) return planLoadFail(planLoad.why)
      diffs = frozen ? frozenTaskDiffs(prevPlan, planLoad.plan, committedTasks) : []
      if (!diffs.length) break
    }
    if (diffs.length) {
      const restored = await agent(`${Cs()}

RESTORE of the plan of deliverable ${E} (mechanical). The plan edit was refused and nothing is committed: restore the file to the committed version with this one command: git -C "${wt}" checkout -- ${AP.plan}
Return ok = true only if it succeeded; head = the output of git -C "${wt}" rev-parse HEAD.
${NO_ASK}`,
        { label: `${E}:plan-commit`, phase: 'Plan', schema: S_COMMITTED, model: 'haiku', effort: 'low' })
      const frozenList = diffs.join('; ')
      op('plan-frozen-tasks', E, `the owner instruction for ${E} rewrote task(s) already committed on ${br}, in two author attempts: ${frozenList}`,
        `Reword the instruction in notes so that it only touches tasks not yet committed (committed: ${committedTasks.join(', ')}), or revert those task commits on ${br} first. The plan file ${AP.plan} was restored to its committed version${restored && restored.ok ? '' : ' (WARNING: the restore could not be confirmed; check git status in the worktree)'}; no task ran`,
        { ...A, deliverables: [E] })
      return fail('conteudo', `the owner instruction rewrote committed task(s) of the plan: ${frozenList}`)
    }
    const msgFile = `${WT}/_tmp/${E}-plan-commit.txt`
    const cm = await agent(`${Cs()}

COMMIT of the plan of deliverable ${E} (mechanical). Only the file ${AP.plan} may enter the commit. One command per call, in this order:
1. Write the commit message with the Write tool (not with a shell command) to "${msgFile}": the subject line "${E}: plan", an empty line, then the line ${TRAILER}
2. git -C "${wt}" add -- ${AP.plan}
3. git -C "${wt}" diff --cached --quiet -- ${AP.plan}   (exit 0 means nothing changed: do not commit, delete the message file and return ok true with an empty commit)
4. Otherwise git -C "${wt}" commit -F "${msgFile}"
5. Delete "${msgFile}". Return head = the output of git -C "${wt}" rev-parse HEAD, commit = the same hash when a commit was made (empty when none), and blob = the output of git -C "${wt}" rev-parse "HEAD:${AP.plan}". ok is false, with error, when a command failed.
${NO_ASK}`,
      { label: `${E}:plan-commit`, phase: 'Plan', schema: S_COMMITTED, model: 'haiku', effort: 'low' })
    if (!cm || !cm.ok) return fail('infra', `plan commit: ${cm ? cm.error || 'not ok' : 'null agent'}`)
    planCommitted = !!cm.commit
    planBlobNow = planCommitted ? String(cm.blob || '').trim() || planLoad.blob : planLoad.blob
  }
  if (!/^[0-9a-f]{40,64}$/.test(planBlobNow)) return fail('infra', `plan load: the blob of ${AP.plan} on the branch was not measured`)
  const planFrom = (ld, blob, reused) => ({ planPath: AP.plan, planBlob: blob, reused, tasks: tasksFromPlan(ld.plan), ac: evidenceFromPlan(ld.plan) })
  plan = planFrom(planLoad, planBlobNow, !planCommitted)
  if (!plan.tasks.length) return fail('infra', 'plan: no tasks')
  let planLoadErr = ''
  const planGaps = () => {
    const gap = description => ({ severity: 'critical', category: 'defeito', description })
    const tasks = plan.tasks || []
    return [
      ...evidenceGaps(cardAc, plan.ac, blqIds),
      ...externalGaps(tasks),
      ...evidenceExternalGaps(cardAc, plan.ac),
      ...tasks.filter((t, i) => t.n !== i + 1).map(t => gap(`task numbers must run 1..N in order (found ${t.n} at position ${tasks.indexOf(t) + 1})`)),
      ...tasks.flatMap(t => asList(t.needsLock).filter(n => !TASK_LOCKS.includes(n)).map(n => gap(`task ${t.n} needs the unknown lock "${n}" (configured: ${TASK_LOCKS.join(', ') || 'none'})`))),
    ]
  }
  const planBlobGaps = r => {
    const m = r && typeof r.measuredPlanBlob === 'string' ? r.measuredPlanBlob.trim() : ''
    const reported = String(plan.planBlob || '').trim()
    if (!m) return [{ severity: 'critical', category: 'defeito', description: `the plan reviewer did not measure the plan blob (git rev-parse "HEAD:${plan.planPath}"); the plan load reported ${JSON.stringify(reported)}` }]
    return m === reported ? [] : [{ severity: 'critical', category: 'defeito', description: `planBlob reported by the plan load (${JSON.stringify(reported)}) differs from the blob measured by the reviewer (${JSON.stringify(m)}); the plan file changed after the load` }]
  }
  const planLoop = await reviewLoop('plan',
    (round, prev) => agent(`${C()}

Review (read-only) the plan ${wt}/${plan.planPath} against the spec ${wt}/${spec.specPath} and the ${cardRef}.
Blocks (defeito): an acceptance criterion with no task or no test; a task with no verification command; a command that does not exist or does not run in the MEASURED ENVIRONMENT (check scripts, paths and flags in the repository); wrong needsLock; wrong task order; a missing "**Roadmap:** ${RM}" line in the header; a task that edits the roadmap folder ${RM}; an evidence command that does not prove its criterion; a testable criterion labelled human or blocked; a {verify: ...} command of the card replaced instead of kept; a task tier or reviewTier that contradicts the blast radius (opus reviewTier is only for blast radius 2); a task with no boolean external declaration, or an external task with no externalDedupe (how running it twice avoids a duplicate effect); a task whose steps touch anything outside the branch but which declares external false; a task with noCommit true whose steps change or commit a file; an evidence row whose command touches anything outside the branch but which declares external false; an evidence row with a command and no boolean external, or an external one with no externalDedupe; an external effect that the card or the spec requires (a delivery, a send, a deploy) and that no task declared external performs, except merging the target into the integration branch and pushing it, which are the owner's (a criterion that needs them is a human act) (defeito, critical); a task of the plan, or an external effect, marked to run after the merge, in the integration worktree or in the target (defeito, critical); a canonical gate changed (decisao, critical).
THE TASKS THE CODE ACTS ON (read by the script from the plan-tool emit, whose integrity digest it checked; these external and noCommit flags and the files lists decide what is held and how many commits a task must leave, so compare each one with the plan file, and a flag or list that differs from the file is a defect): ${JSON.stringify({ tasks: plan.tasks })}${prev ? `\nIssues from the previous round (${repeatRule()}):\n${prev}` : ''}
Measure: headSha, clean, commitsInRange (git -C "${wt}" rev-list --count ${TARGET}..HEAD), measuredPlanBlob = the output of git -C "${wt}" rev-parse "HEAD:${plan.planPath}", run by you; do not copy it from the plan load.
${NO_ASK}`,
      { label: `${E}:plan-review${round}`, phase: 'Plan', schema: S_PLANREVIEW, model: 'opus', effort: 'medium' }),
    async (iss, k, tier) => {
      const fx = await agent(`${C()}

Fix the plan ${plan.planPath} according to the review below and commit. Stop after the commit.
${fmt(iss)}
Every ac of the evidence list is ONLY the criterion id (e.g. AC1), nothing else; if the review reports an ac mismatch, use exactly the expected id.
Return planPath, planBlob (output of git rev-parse HEAD:<planPath>, measured after the commit), roadmapHeader, ac (full list, each command copied verbatim from the file with a table-escaped \\| written as |, with external and externalDedupe) and tasks (full list, with files copied from the plan, noCommit (same rule as the plan stage), tier, reviewTier, needsLock, external and externalDedupe).
The plan ends with a json data block in the plan/1 schema, which must stay valid: run node "${planTool}" check "${planAbs}" --spec "${specAbs}" before the commit, one simple command per call. Tasks and evidence rows are read from that block, never from your answer.
${NO_ASK}`,
        { label: `${E}:plan-fix${k}`, phase: 'Plan', model: tier, effort: effortFor(tier) })
      if (!fx) return null
      const again = await loadPlan()
      if (!again.ok) { planLoadErr = again.why; return null }
      plan = planFrom(again, again.blob, false)
      return { status: 'DONE' }
    },
    r => [...reviewTruth(r, plan.reused ? 0 : spec.reused ? 1 : 2, `${TARGET}..HEAD (spec + plan)`), ...planBlobGaps(r), ...planGaps()],
    { tier: 'sonnet', reviewModel: 'opus' })
  if (planLoadErr) return planLoadFail(planLoadErr)
  if (!planLoop.ok) return fail(planLoop.kind, planLoop.msg)
  // A note is consumed only when it was written into the spec or the plan; one that changed no file stays in resumeWith.
  if (noteE && !(spec.reused === true && plan.reused === true)) NOTES_READ.push(E)
  out.plan = plan.planPath
  planRef = plan.planPath
  out.acOpen = criteriaOpen(cardAc, plan.ac)
  log(`${E}: plan with ${plan.tasks.length} tasks`)
  const fp = planFingerprint(plan.tasks, plan.planBlob)
  BOUND[E] = fp
  const heldEvidence = () => evidenceHolds(normalizePlanAc(cardAc, plan.ac), E, AUTH.items, fp)
  const opEvidence = held => {
    for (const h of held) op('authorize-external', E, `the acceptance evidence of criterion ${h.ac} of ${E} runs a command with an external effect and is not authorized, so it was not run: ${h.commands.join(' ; ')}`,
      `Authorize it by running again with authorizeExternal including "${h.item}" (externalDedupe: ${h.dedupe.join(' ; ') || 'none declared'}); the command runs on the branch, again after each gates fix, after a late sync and on the retry of an invalid measure`,
      { ...A, authorizeExternal: [...boundItems(E), h.item], deliverables: [E] }, { item: h.item })
  }

  const logSource = () => AP.reviews
  const recordExtra = () => ({ rulings: out.rulings || [], pending: human.filter(h => h.blocking !== true).map(h => h.what), source: logSource() })
  const failedRecord = rec => `${rec ? rec.failures.join('; ') : 'null agent or integration worktree broken'}`
  if (MODE === 'plan-only') {
    const rec = await recordStatus(E, STATUSES.plan, [spec.specPath, plan.planPath], recordExtra())
    if (rec) out.recordCuts.push(...rec.cuts)
    if (!rec || !rec.ok) return fail('infra', `plan-only: the roadmap record failed (${failedRecord(rec)})`)
    if (out.recordCuts.length) await persistReviews('record')
    out.planOnly = true
    out.ok = true
    return out
  }
  const recRun = await recordStatus(E, STATUSES.executing, [spec.specPath, plan.planPath], { ...recordExtra(), inflight: { add: br, note: '' } })
  if (recRun) out.recordCuts.push(...recRun.cuts)

  if (!recRun || !recRun.ok) out.concerns.push(`the "executing" roadmap record failed (${failedRecord(recRun)}); decisions and the in-flight entry are not recorded yet`)

  // ---------- Tasks (resumable)
  // Only this subject ends the wait: a re-run that commits and then fails is still waiting for the person.
  const effectDone = n => `${E} T${n}: external effect completed`
  const launchSubject = n => `${E} T${n} launching`
  const startedSubject = n => `${E} T${n} started`  // written by the implementer right before the effect
  const confirmedNotRun = n => `${E} T${n} awaiting person: confirmed not run`
  const mayHaveRunMark = n => `${E} T${n} awaiting person (effect may have run)`
  const externalNs = plan.tasks.filter(t => t.external !== false).map(t => t.n)
  const marksTxt = externalNs.length ? ` Marks of the external tasks: for each n of [${externalNs.join(', ')}], take the newest commit in ${TARGET}..HEAD whose subject starts with "${E} T<n> launching", "${E} T<n> started", "${E} T<n> awaiting person:", "${E} T<n> awaiting person (effect may have run):", "${E} T<n> awaiting person (effect unknown):" or "${E} T<n>: external effect completed". launchOpen = the n whose newest such commit starts "${E} T<n> launching", "${E} T<n> started", "${E} T<n> awaiting person (effect unknown):" or "${E} T<n> awaiting person: external effect did not complete"; effectCompleted = the n whose newest such commit starts "${E} T<n>: external effect completed"; effectMayHaveRun = the n whose newest such commit starts "${E} T<n> awaiting person (effect may have run):" or "${E} T<n> awaiting person: a fix round needs a person" (empty lists when none).` : ''
  const prog = await agent(`Read-only. In the worktree ${wt}: head = git rev-parse HEAD; clean = git status --porcelain empty; done = for each n in [${plan.tasks.map(t => t.n).join(', ')}], if git log --reverse --format=%H --grep "^${E} T<n>:" ${TARGET}..HEAD finds commits: { n, firstParent: parent of the first of those commits, last: the last one }; awaitingPerson = every n of [${plan.tasks.map(t => t.n).join(', ')}] with a commit in ${TARGET}..HEAD whose subject starts "${E} T<n> awaiting person:" and whose newest such commit is newer than every commit there with a subject starting "${E} T<n>: external effect completed" or "${E} T<n>: resumed after awaiting person"; any other "${E} T<n>:" commit does not count (empty list when none).${marksTxt}`,
    { label: `${E}:progress`, phase: 'Implementation', schema: externalNs.length ? S_PROGRESS_EXT : S_PROGRESS, model: externalNs.length ? 'sonnet' : 'haiku', effort: externalNs.length ? 'medium' : 'low' })
  if (!prog) return fail('infra', 'progress read: null agent')
  if (!prog.clean && !(await sanitize('tasks'))) return fail('infra', `worktree ${wt} is still dirty after the automatic cleanup`)
  // A task stopped for a person has commits but not its effect: it is a gap, so it runs again under the normal authorization rules.
  // The newest mark decides. An open launch or a may-have-run mark is never a gap to run again.
  const launchOpen = prog.launchOpen || []
  const mayHaveRun = prog.effectMayHaveRun || []
  const awaitingPerson = (prog.awaitingPerson || []).filter(n => !launchOpen.includes(n) && !mayHaveRun.includes(n))
  const effectCompleted = prog.effectCompleted || []
  const doneMap = Object.fromEntries((prog.done || []).filter(d => !awaitingPerson.includes(d.n)).map(d => [d.n, d]))
  const lastDone = lastContiguousDone(plan.tasks, doneMap)  // a gap is where the run resumes; the last committed task is reviewed again
  if (Object.keys(doneMap).length || setup.reused || plan.reused) {  // any sign of an earlier run: its log holds what this run must not lose
    const rl = await readPersistedLog(wt, 'Implementation')
    if (!rl || rl.found !== true) out.concerns.push('resume: review log not read, so accepted risks and human inputs of the earlier run may be missing')
    else restoreFromLog(rl, [...awaitingPerson, ...launchOpen].map(n => `${E}:T${n}`))  // an old line must not state an effect that a person denied or that is now in doubt
  }
  // A completed mark is the record of the effect when the log has none (a person's commit, or a crash before the first log).
  out.externalRun.push(...missingFrom(out.externalRun, plan.tasks.filter(t => effectCompleted.includes(t.n)).map(t => ({ item: `${E}:T${t.n}`, title: t.title, status: 'confirmed by mark', reviewed: false })), x => x.item))
  annotateHuman()
  // In doubt whether an external effect happened: stop and ask, never repeat it. Only the person's commit reopens or closes the task.
  const doubtful = plan.tasks.filter(t => launchOpen.includes(t.n) || (mayHaveRun.includes(t.n) && !doneMap[t.n]))
  if (doubtful.length) {
    for (const t of doubtful) op('human-input', E, `external task ${t.n} ("${t.title}") of ${E} was launched and no conclusion was recorded: its external effect may or may not have happened, and nothing was run again`,
      `Check whether the effect happened (externalDedupe: ${t.externalDedupe || 'none declared'}). If it did, add an empty commit on ${br} with the subject "${effectDone(t.n)}"; the task then counts as done and goes to review. If you confirmed it did not, add an empty commit with the subject "${confirmedNotRun(t.n)}"; the task then runs again. Then run with this resumeWith. Without one of those commits the run stops here again.`,
      { ...A, authorizeExternal: boundItems(E), deliverables: [E] })
    // Nothing is written on the branch while the effect is in doubt (not even the review log): the open mark stays the newest commit for the person to judge.
    out.error = `external task ${doubtful[0].n} was launched with no recorded conclusion: its external effect may have happened`
    out.failKind = 'humano'; out.branch = br; out.worktree = wt
    return out
  }
  const opTasks = held => {
    for (const h of held) op('authorize-external', E, `task ${h.x.n} ("${h.x.title}") of ${E} is external and not authorized: it was not run`,
      `Authorize it by running again with authorizeExternal including "${h.item}" (externalDedupe: ${h.x.externalDedupe || 'none declared'}); the tasks before it are already committed on ${br}`,
      { ...A, authorizeExternal: [...boundItems(E), h.item], deliverables: [E] }, { item: h.item })
  }
  const holdOf = xs => xs.map(x => ({ x, item: externalHold(x, E, AUTH.items, fp) })).filter(h => h.item)
  // A replan can declare external a task already committed: it will not run, but its commits must not go on without the person seeing them.
  const lateExternal = holdOf(plan.tasks.filter(x => doneMap[x.n]))
  if (lateExternal.length) {
    for (const h of lateExternal) op('authorize-external', E, `task ${h.x.n} ("${h.x.title}") of ${E} is already committed on ${br}, but the current plan declares it external and it is not authorized`,
      `Check its commits on ${br}. It is already committed and will not run again: authorizing "${h.item}" accepts that work as it is and lets the deliverable go on. If the effect must not stand or never happened, revert those commits first (externalDedupe: ${h.x.externalDedupe || 'none declared'})`,
      { ...A, authorizeExternal: [...boundItems(E), h.item], deliverables: [E] }, { item: h.item })
    opTasks(holdOf(plan.tasks.filter(x => !doneMap[x.n])))
    opEvidence(heldEvidence())
    out.held = lateExternal[0].item
    return fail('externo', `committed task ${lateExternal[0].x.n} is now declared external and awaits authorization (${lateExternal[0].item})`)
  }
  // An authorized external task that stopped for a person: nothing merges, and only a person can say the effect did not happen.
  // fromFix: the implementer reported the task done, so its effect may have run.
  const stopForPerson = async (t, res, fromFix = false) => {
    human.push(...missingFrom(human, res.humanInputs, humanKey))
    const needed = (res.humanInputs || []).map(h => `${h.blq ? h.blq + ': ' : ''}${h.what}`).join('; ') || res.summary
    const subject = fromFix ? `${mayHaveRunMark(t.n)}: a fix round needs a person` : `${E} T${t.n} awaiting person (effect unknown): the implementer needs a person`
    // Without this mark a resume finds the task's commits and takes it for done.
    const mark = await safe(() => agent(`Only in the worktree ${wt} (branch ${br}): git -C "${wt}" reset -q; git -C "${wt}" commit --allow-empty -m "${subject}". Change nothing else. Return ok = true only if that commit is now HEAD.`,
      { label: `${E}:t${t.n}:awaiting-person`, phase: 'Implementation', schema: S_MARK, model: 'haiku', effort: 'low' }))
    const markWarn = mark && mark.ok ? '' : ` WARNING: the mark commit could not be written, ${fromFix ? 'so a resume would count this task as done' : 'so a resume will stop and ask, because the launch stays open'}: before running again, add an empty commit on ${br} with the subject "${subject}"`
    const state = fromFix ? 'a fix round needs a person first; the implementer reported the external effect done' : 'its implementer stopped for a person and it is not known whether the external effect started'
    const check = `Check whether the effect already happened before repeating it (externalDedupe: ${t.externalDedupe || 'none declared'}). `
    op('human-input', E, `external task ${t.n} ("${t.title}") of ${E} is authorized, but ${state}: ${needed}`,
      `${check}Provide the data (or the decision) and run again passing the answer in notes; ${fromFix ? `the implementer is not launched again: the task's commits stay on ${br}, its reviews run again and any fix runs without authorization for the effect (if the fix needs the effect run again, run it yourself after its duplicate check, or add "${confirmedNotRun(t.n)}" only if you undid the first effect)` : `any commits it made stay on ${br}, and the resume stops and asks until you add an empty commit: "${confirmedNotRun(t.n)}" if the effect did not start (the task then runs again), or "${effectDone(t.n)}" if it did`}; the authorization of this task stays valid only if the spec and plan files come out unchanged; an answer that changes them is a replan and the authorization is asked again (pass the bare \`${E}:T${t.n}\` in your own message to re-authorize together with the answer). Never put a secret in notes: set an environment variable and name it.${markWarn}`,
      { ...A, authorizeExternal: boundItems(E), deliverables: [E], notes: { ...(A.notes || {}), [E]: '<owner answer>' } })
    return fail('humano', fromFix ? `authorized external task ${t.n}: a fix round needs a person; the implementer reported the external effect done: ${needed}` : `authorized external task ${t.n} needs a person; whether its external effect started is unknown: ${needed}`)
  }
  // Written as soon as the implementer reports completion: a later review failure must not make a resume launch the effect again.
  // A local task has no effect to close: its wait ends with a neutral mark, never with a completion that would read as an effect.
  const closeSubject = (t, wasAwaiting) => (t.external === false ? `${E} T${t.n}: resumed after awaiting person` : `${effectDone(t.n)}${wasAwaiting ? ', clears the awaiting-person mark' : ''}`)
  const closeEffect = async (t, wasAwaiting) => {
    const r = await safe(() => agent(`Only in the worktree ${wt} (branch ${br}): git -C "${wt}" reset -q; git -C "${wt}" commit --allow-empty -m "${closeSubject(t, wasAwaiting)}". Change nothing else. Return ok = true only if that commit is now HEAD.`,
      { label: `${E}:t${t.n}:${wasAwaiting ? 'clear-awaiting' : 'effect-completed'}`, phase: 'Implementation', schema: S_MARK, model: 'haiku', effort: 'low' }))
    const ok = !!(r && r.ok)
    if (!ok) out.concerns.push(wasAwaiting
      ? `T${t.n}: the awaiting-person mark was not cleared, so a later resume would launch this task again: before running again, add an empty commit on ${br} with the subject "${closeSubject(t, false)}"`
      : `T${t.n}: the launch was not closed, so a later resume will stop and ask about this task: before running again, add an empty commit on ${br} with the subject "${effectDone(t.n)}"`)
    return ok
  }
  const recordRun = (t, status) => {
    const item = `${E}:T${t.n}`
    out.externalRun = out.externalRun.filter(e => e.item !== item)
    out.externalRun.push({ item, title: t.title, status, reviewed: false })
  }
  let head = prog.head
  const taskLog = []
  out.tasks = taskLog  // a stop inside the loop still reports the tasks already done
  for (const t of plan.tasks) {
    const resumed = doneMap[t.n]
    // A later task stopped for a person ran after this one passed its reviews, and its commits are not this task's scope.
    if (resumed && (t.n < lastDone || awaitingPerson.some(n => n > t.n))) { taskLog.push({ n: t.n, title: t.title, status: 'RESUMED (already reviewed)' }); const seen = out.externalRun.find(e => e.item === `${E}:T${t.n}`); if (seen) seen.reviewed = true; continue }
    const earlier = awaitingPerson.includes(t.n) ? (prog.done || []).find(d => d.n === t.n) : null
    let start = resumed ? resumed.firstParent : earlier ? earlier.firstParent : head  // a re-run may add nothing to the commits of the run that stopped
    const bookkeepingNote = ` The range may hold this task's commits from a run that stopped for a person: commits with the subject "${E} T${t.n} awaiting person:", "${mayHaveRunMark(t.n)}:", "${E} T${t.n} awaiting person (effect unknown):", "${launchSubject(t.n)}", "${startedSubject(t.n)}", "${effectDone(t.n)}", "${E} T${t.n}: resumed after awaiting person" or "${E}: review log" are bookkeeping and not extra scope. The spec ${spec.specPath} and the plan ${plan.planPath}, committed by this resume, may be in the range too and are not extra scope.`
    let rangeNote = earlier || (resumed && t.external !== false) ? bookkeepingNote : ''
    let completionInRange = 0  // the completion mark of this run sits inside the range and is not the implementer's commit
    let startedInRange = 0  // so does the started mark the implementer writes first
    let locks = asList(t.needsLock).filter(n => TASK_LOCKS.includes(n))
    // A task committed by an earlier run is never launched again, so its fixes do not get the effect either.
    const authorizedExt = t.external !== false && externalHold(t, E, AUTH.items, fp) === null
    if (!resumed) {
      const held = plan.tasks.filter(x => !doneMap[x.n] && x.n >= t.n).map(x => ({ x, item: externalHold(x, E, AUTH.items, fp) })).filter(h => h.item)
      if (held.length && held[0].x.n === t.n) {
        opTasks(held)
        opEvidence(heldEvidence())  // one question lists every external item of the plan
        out.held = held[0].item
        return fail('externo', `external task ${t.n} awaits authorization (${held[0].item})`)
      }
    }
    const runImpl = label => withLocks(locks, () => implAgent(buildImplPrompt(ctxFor({ locks, authorizedExternal: authorizedExt }), t), { label, phase: 'Implementation', model: implModel(t), effort: implEffort(t) }))
    let impl = { status: 'DONE', summary: 'resumed: task already committed by a previous run; no checks reported, run the task verifications yourself', checks: [] }
    if (!resumed) {
      if (authorizedExt) {
        // Without a run token the reads above may be the cached answers of a dead run, blind to its launch mark.
        if (!RUN_TOKEN) return fail('infra', `task ${t.n}: no runToken, so every read of this invocation may be a cached result of an earlier one (the run token is in the discovery read) that cannot see an open launch mark; the external task was not started. Run preflight again and pass its runToken`)
        // Durable proof that the effect may have started, written before it can start: without it the implementer does not run.
        const m = await safe(() => agent(`Only in the worktree ${wt} (branch ${br}): git -C "${wt}" reset -q; git -C "${wt}" commit --allow-empty -m "${launchSubject(t.n)}". Change nothing else. Return ok = true only if that commit is now HEAD, and head = git -C "${wt}" rev-parse HEAD.`,
          { label: `${E}:t${t.n}:launching`, phase: 'Implementation', schema: S_LAUNCH, model: 'haiku', effort: 'low' }))
        if (!m || !m.ok || !m.head) return fail('infra', `task ${t.n}: the launch mark could not be written, so the external task was not started`)
        if (!earlier) { start = m.head; startedInRange = 1 }  // the marks are not this task's commits
        rangeNote = bookkeepingNote
      }
      impl = await runImpl(`${E}:t${t.n}:impl`)
      if (impl && impl.status === 'BLOCKED' && impl.needsLock && TASK_LOCKS.includes(impl.needsLock) && !locks.includes(impl.needsLock)) {
        locks = [...locks, impl.needsLock]
        impl = await runImpl(`${E}:t${t.n}:impl-lock`)
      }
      if (!impl) return fail('infra', `task ${t.n}: null implementer`)
      human.push(...missingFrom(human, impl.humanInputs, humanKey))
      if (impl.concerns) out.concerns.push(`T${t.n}: ${impl.concerns}`)
      if (impl.status === 'BLOCKED') return fail('conteudo', `task ${t.n} BLOCKED: ${impl.summary}${authorizedExt ? `; its launch mark stays open: before running again add \`${confirmedNotRun(t.n)}\` if the effect did not start` : ''}`)
      if (authorizedExt && impl.status === 'NEEDS_HUMAN') return stopForPerson(t, impl)
      if (impl.status === 'DONE' || impl.status === 'DONE_WITH_CONCERNS') {
        if (authorizedExt) recordRun(t, impl.status)  // the implementer reports the effect done: true even if a review rejects the task later
        if (authorizedExt || awaitingPerson.includes(t.n)) {
          const closed = await closeEffect(t, awaitingPerson.includes(t.n))
          if (closed && !earlier && authorizedExt) completionInRange = 1
        }
      }
    }
    const gap = testFirstGap(t, impl, resumed)
    if (gap) return fail('conteudo', `${gap}. The task commit stays on ${br}: before running again, drop only the task commits, not the review log or effect marks: git -C "${wt}" rebase --onto ${start} <last task commit> HEAD (a reset --hard loses them), or the next run takes the task as done and skips this check`)
    const cur = { summary: impl.summary, checks: impl.checks || [] }  // refreshed by each fix so the reviewer sees real output
    let lastR = null
    for (const kind of ['spec', 'quality']) {
      const loop = await reviewLoop(`T${t.n}:${kind}`,
        (round, prev, rvModel) => agent(buildTaskReviewPrompt(ctxFor({ locks, start, round, prev, rangeNote }), t, kind, cur),
          { label: `${E}:t${t.n}:${kind}${round}`, phase: 'Implementation', schema: S_REVIEW, model: rvModel || reviewModelFor(t), effort: effortFor(rvModel || reviewModelFor(t)) }),
        (iss, k, tier) => withLocks(locks, async () => {
          const fx = await implAgent(`${C()}

In Task ${t.n} of the plan ${plan.planPath}, fix the ${kind} problems below, run the task's checks and commit "${E} T${t.n}: fix ...". ${authorizedExt && !resumed ? `The external effect of this task already ran (the implementer reported it done): do not run it again, not even through its duplicate check; checks only read. If this fix needs the effect run again, return NEEDS_HUMAN and say why.` : externalNote(false, t)} STOP after this fix. ${lockNote(locks)} ${noSpecEdit()}
${fmt(iss)}`, { label: `${E}:t${t.n}:${kind}-fix${k}`, phase: 'Implementation', model: tier, effort: effortFor(tier) })
          if (fx) { if (fx.checks) cur.checks = fx.checks; if (fx.summary) cur.summary = fx.summary }
          return fx
        }),
        r => reviewTruth(r, impl.status === 'NEEDS_HUMAN' ? 0 : (noFiles(t) ? 0 : 1) + completionInRange + startedInRange, `${start}..HEAD`, impl.status === 'NEEDS_HUMAN' ? 0 : completionInRange + startedInRange),
        { tier: implModel(t), reviewModel: reviewModelFor(t), haltOn: fx => authorizedExt && !resumed && fx.status === 'NEEDS_HUMAN' })
      if (loop.halted) return stopForPerson(t, loop.halted, true)
      if (!loop.ok) return fail(loop.kind, `task ${t.n}: ${loop.msg}`)
      lastR = loop.r
    }
    head = lastR.headSha
    taskLog.push({ n: t.n, title: t.title, status: impl.status, commits: lastR.commitsInRange })
    const ranEntry = out.externalRun.find(e => e.item === `${E}:T${t.n}`)
    if (ranEntry) ranEntry.reviewed = true
  }
  out.tasks = taskLog
  annotateHuman()
  // Held here, before the final review and the gates: nothing past this point is worth spending without the authorization.
  const evHeld = heldEvidence()
  if (evHeld.length) {
    opEvidence(evHeld)
    out.held = evHeld[0].item
    return fail('externo', `external evidence of criterion ${evHeld[0].ac} awaits authorization (${evHeld[0].item})`)
  }

  // ---------- Sync + final review
  const planLocks = [...new Set(plan.tasks.flatMap(t => asList(t.needsLock)))].filter(n => TASK_LOCKS.includes(n))
  const syncBranch = (label, ref, from) => agent(`${Cs()}

Bring the target state into the branch: headBefore = git -C "${wt}" rev-parse HEAD; git -C "${wt}" merge --no-ff ${ref} -m "${E}: sync with ${TARGET}". Conflicts: keep both parts.${conflictTxt} Do not use any shared resource. Nothing to merge: ok=true without a commit.
Return ok (false if a conflict stayed unresolved; then git merge --abort), head, conflictsResolved, details, targetTip = git -C "${wt}" rev-parse ${ref}, deltaFiles = git -C "${wt}" diff --name-only ${from}..${ref} (empty when nothing came in).`,
    { label, phase: 'Final review', schema: S_SYNC, model: 'sonnet', effort: 'medium' })
  // Sync with the last VALIDATED tip: a merge of another deliverable still under validation does not come in here.
  let syncAt = lastGood
  let myBase = snapshotBase()  // baseline matching syncAt (captured together, no await between them)
  const sync = await syncBranch(`${E}:sync`, syncAt, syncAt)
  if (!sync || !sync.ok) return fail(sync ? 'conteudo' : 'infra', `sync with ${TARGET} failed: ${sync ? sync.details : 'null agent'}`)
  if (sync.conflictsResolved !== 0) {  // as on the late sync: a resolution is reviewed with the full briefing
    const rc = await reviewConflicts(sync.head, wt, `${E}:sync-review`)
    if (!rc.ok) return fail(rc.kind, rc.why)
  }

  const integ = TEST_INTEGRITY ? await agent(`Read-only. Write this Node program to "${WT}/_tmp/${E}-integrity.cjs", run exactly: cd "${wt}" && node "${WT}/_tmp/${E}-integrity.cjs" "${TARGET}" (the program calls git in the current directory), delete the file and return the fields of the printed JSON. If the program fails, do not invent numbers: return removedAsserts=-1 and zero for the others:\n${TEST_INTEGRITY}\n`,
    { label: `${E}:test-integrity`, phase: 'Final review', schema: S_INTEG, model: 'haiku', effort: 'low' }) : null
  if (TEST_INTEGRITY && (!integ || integ.removedAsserts < 0)) out.concerns.push('test integrity not measured')
  const alerts = integrityAlerts(integ)
  const integTxt = alerts.length ? `\nALERTS MEASURED IN THE TESTS (check each one; weakening a test without justification is a critical defect): ${alerts.join('; ')}.` : ''

  const lenses = card.critical
    ? ['correctness across layers and the card acceptance criteria', 'security: authorization, secrets, sensitive data, injection and any security rule of the PROJECT block (or the file it points to)']
    : ['correctness across layers, the card acceptance criteria and security']
  const finalLoop = await reviewLoop('final',
    async (round, prev) => {
      const rs = await parallel(lenses.map((lens, li) => () => agent(`${C()}

FINAL REVIEW OF THE WHOLE BRANCH (mandatory; read-only), lens: ${lens}. Diff: git -C "${wt}" diff ${TARGET}...HEAD (branch already synced with the target).
Check against the spec ${spec.specPath}, the plan ${plan.planPath} and the acceptance criteria of the ${cardRef}. Look for what per-task reviews miss: contracts broken between layers, regressions in screens, flows, scripts and tests of earlier deliverables, generated files inconsistent with their sources, an acceptance criterion with no test.${integTxt}${prev ? `\nPrevious issues (verify them; ${repeatRule()}):\n${prev}\nBlocks (defeito): an edit to the spec or the plan made by a fix round.` : ''}
Measure: headSha, clean, commitsInRange (git -C "${wt}" rev-list --count ${TARGET}..HEAD).`,
        { label: `${E}:final-${li + 1}-r${round}`, phase: 'Final review', schema: S_REVIEW, model: 'opus', effort: 'high' })))
      if (rs.some(x => !x)) return null
      return { issues: rs.flatMap(x => x.issues), headSha: rs[0].headSha, clean: rs.every(x => x.clean), commitsInRange: rs[0].commitsInRange }
    },
    (iss, k, tier) => withLocks(planLocks, () => implAgent(`${C()}

Fix the final review problems below, with a test for each defect, run the affected tests and commit "${E} final-fix: ...". ${lockNote(planLocks)} ${noSpecEdit()}
${fmt(iss)}`, { label: `${E}:final-fix${k}`, phase: 'Final review', model: tier, effort: effortFor(tier) })),
    r => reviewTruth(r, 1, `${TARGET}..HEAD`),
    { tier: 'sonnet', reviewModel: 'opus' })
  if (!finalLoop.ok) return fail(finalLoop.kind, finalLoop.msg)

  // ---------- Gates on the branch (+ reviewed fix). Every acceptance criterion is proved by a command that ran.
  // The value compared with the plan file is the value dispatched.
  const acExec = () => normalizePlanAc(cardAc, plan.ac).filter(p => VERIFY_EXEC.includes(p.kind) && p.command).map(p => ({ ...p, command: commandKey(p.command) }))
  const externalEvidenceNote = () => {
    const rows = acExec().filter(p => p.external !== false)
    return rows.length ? `\nThe person AUTHORIZED the external effect of these evidence commands: ${rows.map(p => p.command).join(' ; ')}. Run one again only if that command is what failed, and only after its duplicate check: ${rows.map(p => `${p.ac}: ${p.externalDedupe || 'none declared'}`).join('; ')}.` : ''
  }
  let evRound = 0
  const runEvidence = async exp => {
    const rows = acExec()
    if (!rows.length && !BEFORE_EVIDENCE.length) return { ok: true, summary: '' }
    const validEv = x => !!x && x.clean === true && (!exp || gateShaMatch(x.headSha, exp)) && (!BEFORE_EVIDENCE.length || x.beforeOk === true)
    const once = label => withLocks(TASK_LOCKS, () => agent(`${Cs()}

${lockNote(TASK_LOCKS)} Fix nothing. In the worktree ${wt}:
1. BEFORE any command: clean (git status --porcelain empty) and headSha.
2. ${BEFORE_EVIDENCE.length ? `Bring the state up, in order: ${BEFORE_EVIDENCE.map(c => `"${c}"`).join('; ')}. beforeOk=true only if every command exited 0.` : 'No state to prepare (beforeOk=true).'}
3. Run each command below in the resulting state and return results [{ac, command, exit, log (excerpt)}], in order, copying ac and command verbatim from its line ("<ac>: <command>"):
${rows.map(p => `${p.ac}: ${p.command}`).join('\n') || '(none)'}${rows.some(p => p.external !== false) ? `\nThe person AUTHORIZED the external effect of these criteria; for each one, first apply its duplicate check: ${rows.filter(p => p.external !== false).map(p => `${p.ac}: ${p.externalDedupe || 'none declared'}`).join('; ')}` : ''}`,
      { label, phase: 'Gates', schema: S_EVID, model: 'sonnet', effort: 'medium' }))
    let ev = await once(`${E}:evidence${++evRound}`)
    if (!validEv(ev)) ev = await once(`${E}:evidence${evRound}-retry`)
    if (!validEv(ev)) return { ok: false, infra: true, summary: 'evidence measurement null, with a dirty tree, at the wrong commit or with the state preparation failing' }
    for (const [i, p] of rows.entries()) {
      const x = p.external !== false && matchEvidence(ev.results, p, i)
      if (!x || x.exit !== 0) continue  // only an effect that happened; a failed re-run does not erase an earlier success
      out.externalRun = out.externalRun.filter(e => !(e.item === `${E}:${p.ac}` && e.command === p.command))
      out.externalRun.push({ item: `${E}:${p.ac}`, command: p.command, exit: x.exit })
    }
    annotateHuman()
    const problems = rows.flatMap((p, i) => {
      const x = matchEvidence(ev.results, p, i)
      if (!x) return [`criterion ${p.ac}: command not run`]
      return x.exit === 0 ? [] : [`criterion ${p.ac}: "${p.command}" exited ${x.exit}: ${String(x.log || '').slice(0, 600)}`]
    })
    return { ok: !problems.length, summary: problems.join('\n') }
  }

  const branchGates = async (tag, firstExp) => {
    let exp = firstExp
    for (let k = 0; ; k++) {
      const g = await gates(wt, `${E}:${tag}gates${k + 1}`, 'Gates', myBase, exp)
      out.gates = g.summary
      if (g.nullAgent) return { ok: false, kind: 'infra', msg: `gates: ${g.summary}` }
      let failText = `gates not green (${g.failures.join(', ')}): ${g.summary}`
      if (g.ok) {
        out.brM = g.m
        const ev = await runEvidence(g.m.headSha)
        if (ev.ok) return { ok: true, head: g.m.headSha }
        if (ev.infra) return { ok: false, kind: 'infra', msg: ev.summary }
        failText = `gates green, but the evidence failed:\n${ev.summary}`
      }
      if (k >= MAXFIX) return { ok: false, kind: 'conteudo', msg: `branch gates did not pass: ${failText}` }
      const preFix = g.m.headSha
      const fx = await withLocks(planLocks, () => implAgent(`${C()}

${lockNote(planLocks)} ${noSpecEdit()} The gates failed against the baseline:
${failText}
Failing output: ${String(g.m.log || '').slice(0, 3000)}
Root cause, a fix with a test when it is a defect, run the failed gate again and commit "${E} gates-fix: ...". A failure outside the baseline cannot be masked; if it comes from the environment, explain in concerns.${externalEvidenceNote()}`,
        { label: `${E}:${tag}gates-fix${k + 1}`, phase: 'Gates', model: 'sonnet', effort: 'medium' }))
      if (!fx) return { ok: false, kind: 'infra', msg: 'gates fix: null agent' }
      if (fx.status === 'BLOCKED') return { ok: false, kind: 'conteudo', msg: `gates fix BLOCKED: ${fx.summary}` }
      if (fx.concerns) out.concerns.push(`${tag}gates-fix${k + 1}: ${fx.concerns}`)
      const rr = await agent(`${C()}

Review (read-only) the gates fix: git -C "${wt}" diff ${preFix}..HEAD. Blocks (defeito): a fix that masks a test, relaxes an assertion, skips a suite, edits the baseline or introduces a defect, an edit to the spec or the plan. Measure headSha, clean, commitsInRange (git rev-list --count ${preFix}..HEAD).`,
        { label: `${E}:${tag}gates-fix${k + 1}-review`, phase: 'Gates', schema: S_REVIEW, model: 'opus', effort: 'medium' })
      if (!rr) return { ok: false, kind: 'infra', msg: 'gates fix review: null agent' }
      if (blocking(rr).filter(i => isHard(i, blqIds)).length) return { ok: false, kind: 'conteudo', msg: `gates fix rejected: ${fmt(blocking(rr))}` }
      acceptRisks(`${tag}gates-fix${k + 1}`, blocking(rr))
      out.reviews.push({ stage: `${tag}gates-fix${k + 1}`, rounds: [{ round: 1, reviewModel: 'opus', fixTier: 'sonnet' }], ...compact(rr.issues), unresolved: blocking(rr) })
      await persistReviews('gates')  // log committed before re-measuring; the next measurement takes whatever head results
      exp = null
    }
  }
  await persistReviews('')  // the review log is committed BEFORE the final measurement, so the measured head includes it
  const bg = await branchGates('', null)
  if (!bg.ok) return fail(bg.kind, bg.msg)
  let validatedHead = bg.head  // the branch head the gates and evidence measured

  // ---------- Merge + post-merge gates + docs (serialized)
  if (TARGET === INTEG) {
    const crit = out.acceptedRisks.filter(x => x.severity === 'critical')
    if (crit.length && !(A.acceptRisks || []).includes(E)) return fail('decisao', `direct merge into ${TARGET} with an accepted critical risk; review it and pass acceptRisks:["${E}"]:\n${crit.map(fmtRisk).join('\n')}`)
  }
  const result = await mergeLock(async () => {
    if (integBroken) return { ok: false, kind: 'infra', why: `integration worktree compromised: ${integBroken}` }
    if (typeof budget !== 'undefined' && budget.total && budget.remaining() < 80000) return { ok: false, kind: 'infra', why: 'remaining budget too low to validate and document the merge' }
    const probe = await agent(`Read-only. head = git -C "${INTWT}" rev-parse HEAD; clean = git -C "${INTWT}" status --porcelain empty; branchHasTarget = git -C "${REPO}" merge-base --is-ancestor ${TARGET} ${br} (exit 0); branchMerged = git -C "${REPO}" merge-base --is-ancestor ${br} ${TARGET}.`,
      { label: `${E}:pre-merge`, phase: 'Merge', schema: S_PROBE, model: 'haiku', effort: 'low' })
    if (!probe) return { ok: false, kind: 'infra', why: 'pre-merge probe: null agent' }
    if (!probe.clean) {
      integBroken = `integration worktree ${INTWT} dirty before the merge of ${E}`
      op('integration', E, integBroken, `Clean or commit the integration worktree (git -C "${INTWT}" status) and run again`, { ...A })
      return { ok: false, kind: 'infra', why: integBroken }
    }
    const preSha = probe.head
    if (!probe.branchHasTarget && !probe.branchMerged) {
      // Late sync: another deliverable landed after this branch's last sync.
      const rs = await syncBranch(`${E}:resync`, TARGET, syncAt)
      if (!rs || !rs.ok) return { ok: false, kind: rs ? 'conteudo' : 'infra', why: `re-sync failed: ${rs ? rs.details : 'null agent'}` }
      if (rs.conflictsResolved !== 0) {
        const rc = await reviewConflicts(rs.head, wt, `${E}:resync-review`)
        if (!rc.ok) return rc
      }
      if (needsDeltaReview(rs.deltaFiles, RM, DOCS_PATHS)) {
        const prevSync = syncAt
        const dl = await reviewLoop('delta',
          (round, prev) => agent(`${C()}

LATE-SYNC REVIEW (read-only). Other deliverables landed on ${TARGET} after the last sync of this branch. Review ONLY what they brought: git -C "${wt}" diff ${prevSync}..${rs.targetTip || TARGET}, against this branch (spec ${spec.specPath}, ${cardRef}).
Blocks (defeito): a contract of the incoming change that this branch breaks or that breaks this branch (callers, schemas, permissions, generated files), a criterion of the card no longer proved, a duplicated or conflicting definition${prev ? ', an edit to the spec or the plan made by a fix round' : ''}.${prev ? `\nPrevious issues (verify them; ${repeatRule()}):\n${prev}` : ''}
Measure: headSha, clean, commitsInRange=0 is fine here.`,
            { label: `${E}:delta-review${round}`, phase: 'Merge', schema: S_REVIEW, model: 'opus', effort: 'high' }),
          (iss, k, tier) => withLocks(planLocks, () => implAgent(`${C()}

Fix the late-sync review problems below on the branch ${br} (worktree ${wt}), with tests, and commit "${E} resync-fix: ...". ${lockNote(planLocks)} ${noSpecEdit()}
${fmt(iss)}`, { label: `${E}:delta-fix${k}`, phase: 'Merge', model: tier, effort: effortFor(tier) })),
          r => reviewTruth(r, 0, ''),
          { tier: 'sonnet', reviewModel: 'opus' })
        if (!dl.ok) return { ok: false, kind: dl.kind, why: `late-sync review: ${dl.msg}` }
      }
      syncAt = rs.targetTip || syncAt
      myBase = snapshotBase()
      await persistReviews('resync')  // conflict and delta reviews go into the log before the final measurement
      const rg = await branchGates('re', null)
      if (!rg.ok) return { ok: false, kind: rg.kind, why: `gates after the re-sync: ${rg.msg}` }
      validatedHead = rg.head
    }
    if (probe.branchMerged) {
      const loc = await agent(`Read-only. Run: git -C "${INTWT}" rev-list --first-parent --reverse --ancestry-path ${br}..HEAD. mergeSha = the first line of its output (empty when none); rangeOk = true only if the command exited 0; secondParent = git -C "${INTWT}" rev-parse <mergeSha>^2 (empty when it has none); branchTip = git -C "${INTWT}" rev-parse ${br}.`,
        { label: `${E}:merge-locate`, phase: 'Merge', schema: S_LOCATE, model: 'haiku', effort: 'low' })
      if (!loc || loc.rangeOk !== true || !loc.mergeSha || !loc.secondParent || !gateShaMatch(loc.secondParent, loc.branchTip)) return markBroken(`the branch ${br} is on ${TARGET} but its merge commit could not be located`, 'infra')
      const badFix = await reviewFixesAfterMerge(loc.mergeSha)
      if (badFix) return badFix
      return postMerge(loc.mergeSha, 0, markBroken, preSha)
    }
    const rollback = async (why, kind = 'conteudo') => {
      const rbPrompt = `ROLLBACK in the integration worktree ${INTWT} (branch ${TARGET}): git merge --abort (if a merge is in progress); git reset --hard ${preSha}; then head = git rev-parse HEAD; clean = git status --porcelain empty; leftovers = files still dirty.`
      let rb = await agent(rbPrompt, { label: `${E}:rollback`, phase: 'Merge', schema: S_ROLLBACK, model: 'haiku', effort: 'low' })
      if (!rb) rb = await agent(rbPrompt, { label: `${E}:rollback-retry`, phase: 'Merge', schema: S_ROLLBACK, model: 'haiku', effort: 'low' })
      if (!rb || !rb.ok || !gateShaMatch(rb.head, preSha) || rb.clean === false) {
        integBroken = `the rollback of ${E} did not confirm ${TARGET} at ${preSha} and clean (${rb ? JSON.stringify({ head: rb.head, leftovers: rb.leftovers }) : 'null agent'})`
        op('integration', E, integBroken, `Restore it by hand: git -C "${INTWT}" reset --hard ${preSha} and confirm a clean git status`, { ...A, deliverables: order.filter(x => x !== E) })
      }
      return { ok: false, kind, why }
    }
    const mg = await agent(`${Cs()}

MERGE STAGE of deliverable ${E} in the integration worktree ${INTWT} (branch ${TARGET}).${FOREIGN ? ` The operator authorized ${FOREIGN_ITEM}: this merge may be done in that checkout.` : ''} Run: git merge --no-ff ${br} -m "merge: ${E} in ${TARGET}". Conflicts: keep both parts.${conflictTxt} Do not use any shared resource.
Return mergeCommit (git rev-parse HEAD after the commit), firstParent (git rev-parse HEAD^1), secondParent (git rev-parse HEAD^2), conflicts (how many files), clean (status --porcelain empty at the end), details. If you cannot finish, git merge --abort.`,
      { label: `${E}:merge`, phase: 'Merge', schema: S_MERGE, model: 'sonnet', effort: 'medium' })
    if (!mg || !mg.clean || !mg.mergeCommit || gateShaMatch(mg.mergeCommit, preSha)) return rollback(`the merge did not complete: ${mg ? mg.details : 'null agent'}`, mg ? 'conteudo' : 'infra')
    if (!mergeParentsOk(mg, preSha, validatedHead)) return rollback(`the merge commit ${mg.mergeCommit} has first parent ${mg.firstParent} and second parent ${mg.secondParent}, expected ${preSha} and the validated head ${validatedHead}: the second parent does not match`, 'conteudo')
    let firstExp = mg.mergeCommit
    if (mg.conflicts !== 0) {
      const riskFrom = out.acceptedRisks.length
      const rc = await reviewConflicts(mg.mergeCommit, INTWT, `${E}:merge-review`)
      if (!rc.ok) return rollback(rc.why, rc.kind)
      firstExp = await persistMergeRisks(riskFrom, firstExp)
    }
    firstExp = await persistMergeEffects(firstExp)
    return postMerge(mg.mergeCommit, mg.conflicts, rollback, firstExp)
  })
  return closeOut(result)
}

// ============================================================================ scheduling by dependencies
const safe = fn => Promise.resolve().then(fn).catch(e => { log(`unhandled failure: ${String(e)}`); return null })
const sem = makeSem(MAXPAR)
const runs = {}
// Interrupted merges finish (validate and document) before any new deliverable asks for the semaphore.
// An interrupted deliverable waits only for dependencies that are also interrupted: waiting for a new one
// would deadlock, because the new one waits for every interrupted one.
const FINISH = order.filter(id => MODE === 'run' && resumeAction(byId[id], STATUSES) === 'finish-merge')
order.forEach((id, idx) => {
  runs[id] = (async () => {
    await Promise.resolve()  // every runs[] entry exists after this point
    const finishing = FINISH.includes(id)
    if (!finishing) await Promise.all(FINISH.map(f => runs[f]))
    for (const d of byId[id].deps) {
      if (!runs[d]) continue  // dependency already on the target
      if (finishing && !FINISH.includes(d)) continue
      const r = await runs[d]
      if (!r.ok) { const why = holdOf(id); return { id, merged: false, ok: false, skipped: true, error: why || `dependency ${d} did not finish in this run` } }
    }
    return sem(async () => {
      const why = holdOf(id)
      if (why) return { id, merged: false, ok: false, skipped: true, error: why }
      if (integBroken) return { id, merged: false, ok: false, skipped: true, error: `integration worktree compromised: ${integBroken}` }
      if (typeof budget !== 'undefined' && budget.total && budget.remaining() < MIN_BUDGET) return { id, merged: false, ok: false, skipped: true, error: 'token budget too low' }
      let r
      begun.add(id)
      try { r = await runDeliverable(id, idx) } catch (e) { r = { id, merged: false, ok: false, error: `unexpected error: ${e && e.message ? e.message : e}`, failKind: 'infra' } }
      // An interrupted merge that did not finish validated (including a thrown error) stops every later merge.
      if (FINISH.includes(id) && !r.ok && !integBroken) integBroken = `the interrupted merge of ${id} did not finish validation: ${r.error || 'not ok'}`
      if (r.error && !r.skipped) {
        if (r.failKind === 'externo') { /* waiting for the person: no defect, no blocked status */ }
        else if (r.failKind === 'infra') op('infra', id, r.error, 'Run again (the stages reuse spec, plan and commits)', { ...A, deliverables: [id] })
        else {
          if (r.failKind === 'conteudo') op('defect', id, r.error, `Read the review log on the branch ${r.branch}; adjust the spec or plan, or pass an instruction in notes, and run again`, { ...A, deliverables: [id], notes: { ...(A.notes || {}), [id]: A.notes && A.notes[id] && !NOTES_READ.includes(id) ? A.notes[id] : '<owner instruction>' } })
          if (r.failKind === 'decisao') op('decision', id, r.error, r.doNow || 'Decide (a new DEC or a revision of the existing one) and run again with the decision in notes', { ...A, deliverables: [id], notes: { ...(A.notes || {}), [id]: '<owner decision>' } })
          if (MODE !== 'plan-only') {
            // The full text of a cut goes to the review log of the branch (the file persistLog writes), so the source names that real file.
            const canLog = typeof r.logPath === 'function' && typeof r.persistLog === 'function'
            const rec = await safe(() => recordStatus(id, STATUSES.blocked, [r.branch ? 'branch ' + r.branch : RM + 'state.md'], { reason: `automatic execution stopped (${r.failKind}): ${String(r.error).slice(0, 400)}; branch ${r.branch} kept at ${r.worktree}`, source: canLog ? r.logPath() : artifactPaths(disc.roadmapSlug, id).reviews }))
            if (rec && rec.cuts && rec.cuts.length) {
              r.recordCuts = [...(r.recordCuts || []), ...rec.cuts]
              if (canLog) await safe(() => r.persistLog('blocked-record'))
            }
          }
        }
      }
      return r
    })
  })().catch(e => ({ id, merged: false, ok: false, error: `unexpected error: ${String(e)}`, failKind: 'infra' }))
})
for (const id of order) RESULTS.push(await runs[id])

// ============================================================================ report
phase('Report')
const slim = RESULTS.map(r => ({ id: r.id, merged: !!r.merged, broken: !!r.broken, planOnly: !!r.planOnly, skipped: r.skipped, error: r.error, failKind: r.failKind, held: r.held,
  branch: r.branch, spec: r.spec, plan: r.plan, merge: r.merge ? { commit: r.merge.mergeCommit, conflicts: r.merge.conflicts, gates: r.merge.gates, docsOk: r.merge.docsOk } : undefined,
  tasks: (r.tasks || []).length, concerns: r.concerns || [], acceptedRisks: r.acceptedRisks || [], decisions: (r.decisions || []).length,
  human: (r.human || []).map(h => `${h.blq ? h.blq + ': ' : ''}${h.what}`).slice(0, 12) }))
const ownerReview = {
  acceptedRisks: RESULTS.flatMap(r => (r.acceptedRisks || []).map(x => ({ id: r.id, ...x }))),
  decisionsPending: RESULTS.flatMap(r => (r.decisions || []).map(decision => ({ id: r.id, decision }))),
  criteriaOpen: RESULTS.flatMap(r => (r.acOpen || []).map(x => ({ id: r.id, ...x }))),
}
// Human acts are never recorded by the workflow: they go to the operator.
for (const r of RESULTS) {
  const acts = (r.acOpen || []).filter(x => x.kind === 'human')
  if (acts.length && (r.merged || r.planOnly)) op('human-act', r.id, `criteria that need a human act: ${acts.map(x => x.ac).join(', ')}`, 'Perform the act (acceptance, go/no-go, credentials, session with users) and record it yourself; the workflow never records it', null)
}
// Final deterministic check: what the agents claimed is compared with git itself.
const claims = RESULTS.filter(r => r.merged && r.merge && r.merge.mergeCommit).map(r => ({ id: r.id, commit: r.merge.mergeCommit }))
const truth = MODE === 'plan-only' ? null : await safe(() => agent(`GIT TRUTH (read-only). Target ${TARGET} in ${INTWT}.
targetHead = git rev-parse HEAD; clean = git status --porcelain empty on the target; lastGoodReachable = git merge-base --is-ancestor ${lastGood} ${TARGET} (exit 0); mergedIds = deliverables among [${order.join(', ')}] with a commit "merge: <E> in ${TARGET}" in git log --first-parent ${TARGET}; notMergedIds = the others; claims = for each of ${JSON.stringify(claims)}: { id, commit, reachable = the commit is an ancestor of ${TARGET} }; worktrees = git -C "${REPO}" worktree list; strays = files and folders loose in ${WT}/ that are neither registered worktrees nor an empty _tmp.`,
  { label: 'git-truth', phase: 'Report', schema: S_TRUTH, model: 'haiku', effort: 'low' }))
const divergences = MODE === 'plan-only' ? [] : truthDivergences(truth, slim, claims, TARGET, lastGood, !!(integBroken || foreignHold))
for (const d of divergences) op('divergence', null, d, 'Check git log and git status of the target', null)
const ids = order.join('-').slice(0, 60)
const reportPath = reportPathFor(TODAY, ids)
const resumeIds = [...slim.filter(r => (!r.merged || r.broken) && !r.planOnly).map(r => r.id), ...picked.skipped.filter(s => /maxDeliverables/.test(s.reason)).map(s => s.id)]
const resumeArgs = resumeIds.length ? { ...A, deliverables: resumeIds, targetBranch: TARGET } : null
if (foreignHold) {
  op('authorize-external', null, `the target ${TARGET} is checked out in ${INTWT}, which is not the integration worktree of this workflow: nothing was written there, and no execution report file was committed`,
    `Authorize it by running again with authorizeExternal including "${FOREIGN_ITEM}" (or free the branch ${TARGET} in ${INTWT} so the workflow uses its own worktree)`,
    { ...A, authorizeExternal: [...AUTH.items, FOREIGN_ITEM] }, { item: FOREIGN_ITEM })
}
// Authorizations come back bound to the plan they were given for, and end with the delivery they covered.
const settleAuth = items => {
  const done = RESULTS.filter(r => r.merged && !r.broken).map(r => r.id)
  const bound = dropStaleBound(Object.keys(BOUND).reduce((acc, id) => bindAuthorizations(acc, id, BOUND[id]), items), BOUND)
  return bound.filter(i => !done.some(id => i.startsWith(id + ':T') || i.startsWith(id + ':AC')))
}
const finalResume = () => {
  const base = withoutApprove(dropConsumedNotes(resumeArgs || { ...A }, NOTES_READ))
  if (!A.authorizeExternal) return base
  const settled = settleAuth(AUTH.items)
  return { ...base, authorizeExternal: resumeIds.length ? settled : settled.filter(i => !/^(gate|checkout):/.test(i)) }  // with nothing left to run they authorize nothing
}
// Every operator action resumes with the same settled authorizations: bound to the approved plan, none for a delivery already merged.
for (const o of OPS) if (o.resumeWith && Array.isArray(o.resumeWith.authorizeExternal)) o.resumeWith = { ...o.resumeWith, authorizeExternal: settleAuth([...new Set(o.resumeWith.authorizeExternal)]) }
for (const o of OPS) if (o.resumeWith) o.resumeWith = withoutApprove(dropConsumedNotes(o.resumeWith, NOTES_READ))
const resumeFinal = finalResume()
const report = await safe(() => mergeLock(() => agent(`${COMMON_SLIM()}

${integBroken || foreignHold ? `The integration worktree is ${integBroken ? 'compromised' : "the person's checkout and was not authorized"}: do NOT write a file or commit, only build the execution report and return the text.` : `Write the EXECUTION REPORT to ${INTWT}/${reportPath} and commit only it on ${TARGET}.`} Write it in the language of the roadmap.
Selection: ${JSON.stringify(selection)}
Results (summary per deliverable; details in the reviews.md log of each branch, under docs/plans/<roadmap slug>-<E>/): ${JSON.stringify(slim)}
Operator actions: ${JSON.stringify(OPS.map(o => ({ ...o, resumeWith: withoutConfig(o.resumeWith) })))}
Git truth: ${JSON.stringify(truth)} | divergences: ${JSON.stringify(divergences)}
Resume args: ${JSON.stringify(withoutConfig(resumeFinal))}
Owner review: ${JSON.stringify(ownerReview)}
Authorizations given for this run: ${JSON.stringify(AUTH.items)}
External effects authorized and run: ${JSON.stringify(RESULTS.flatMap(r => r.externalRun || []))}${RESULTS.some(r => (r.externalRun || []).some(e => e.reviewed === false)) ? '\nAn entry with reviewed=false ran, or its implementer reported it done, but its task has not passed review in this run (it may not have been reviewed yet): say so, and still never ask for that effect again.' : ''}
Content: (1) a table per deliverable (merged/failed/skipped/plan, merge, gates, spec, plan, review log), with divergences from the git truth highlighted; (2) "Operator actions (strictly necessary)", deduplicated and ordered by deadline, with what to do and the resume args; (3) accepted risks, autonomous decisions to ratify in ${RM}decisions.md, and criteria left open (criteriaOpen) with the human act each needs; the merge of ${TARGET} into ${INTEG} and the push are only for the owner to decide; (4) the roadmap checker result per deliverable, as measured by the docs stage from brief --json (result.checker: errors, warnings, folder, stale): ${JSON.stringify(CHECKERS)}; do not run the checker file yourself; (5) leftovers (strays, worktrees).${CFG.generated ? `\n(6) This run used a GENERATED release.config.json (generated: true), so maxParallel was forced to 1 because an undetected shared resource would corrupt parallel runs. Explain how to release parallelism: review "locks" and each gate "needsLock" in release.config.json, commit the file, then remove "generated": true (maxParallel then applies, default 3).` : ''}
Be factual. List an action to take only from Operator actions and the open human items of the results (human, criteria left open): never invent an action or resume args. An effect listed as authorized and run already happened: never ask for it again. A human item marked "[${RAN_MARK}: ...]" names such an effect: report it as already done and never offer that authorization as an action; any other need the item states stays open. Never state where an external effect came from (this run, an earlier run, a given task) unless the data above or a file you read proves it; otherwise say the origin of an external effect is unknown. Return the report text.`,
  { label: 'report', phase: 'Report', model: 'sonnet', effort: 'medium' })))
if (!report && MODE !== 'plan-only') op('report', null, 'the report agent returned nothing, so there is no execution report file', 'Rebuild the report from this result (results, truth, operatorActions)', null)

const allOk = slim.every(r => r.merged || r.planOnly)
return mkResult(OPS.length ? 'needs-operator' : allOk ? 'done' : 'partial', { selection, results: slim, ownerReview, truth, lastGood, resumeArgs: resumeFinal, reportPath: report && !integBroken && !foreignHold ? reportPath : null, report })
