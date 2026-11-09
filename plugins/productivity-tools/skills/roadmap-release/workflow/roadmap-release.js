export const meta = {
  name: 'roadmap-release',
  description: 'Runs tracked roadmap deliverables end to end',
  phases: [{ title: 'probe' }],
};

// roadmap-release workflow script. Self-contained: no imports.
// Runtime API: agent(prompt, {label, phase, model, schema}), phase(), log(), args, budget, parallel().

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
// </pure>

phase('probe');
const probe = await agent('Reply with exactly the text: ok', { label: 'probe', phase: 'probe', model: 'haiku' });
log(`probe: ${probe}`);

return { status: 'done', args };
