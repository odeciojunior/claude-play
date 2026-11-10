// Structural: per sandbox run, the ordered agent labels of one deliverable plus reused/planBlob/progress fields picked by regex from result previews.
import fs from 'node:fs'; import path from 'node:path'
import os from 'node:os'
// Reads only structural fields (agent labels, reused flags, plan blob ids) from workflow journals; never conversation text.
// Usage: node mine-resume.mjs <regex on the project folder name> [deliverable id]. Transcripts root: CLAUDE_PROJECTS_DIR or ~/.claude/projects.
const root = process.env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects')
const filt = new RegExp(process.argv[2] || 'roteiros')
const rows = []
for (const proj of fs.readdirSync(root)) {
  if (!filt.test(proj)) continue
  const pd = path.join(root, proj)
  for (const s of fs.readdirSync(pd)) {
    const wd = path.join(pd, s, 'workflows'); if (!fs.existsSync(wd)) continue
    for (const f of fs.readdirSync(wd)) {
      if (!f.endsWith('.json')) continue
      let j; try { j = JSON.parse(fs.readFileSync(path.join(wd, f), 'utf8')) } catch { continue }
      if (j.workflowName !== 'roadmap-release') continue
      const ag = (j.workflowProgress || []).filter(p => p.type === 'workflow_agent')
      const per = {}
      for (const a of ag) {
        const m = /^(E\d+):(.*)$/.exec(a.label || ''); if (!m) continue
        const e = per[m[1]] ||= { labels: [], plan: null, spec: null, prog: null }
        e.labels.push(m[2].replace(/^t(\d+):/, 't$1.'))
        const rp = a.resultPreview || ''
        const b = re => { const x = re.exec(rp); return x ? x[1] : null }
        if (m[2] === 'plan') e.plan = { reused: b(/"reused"\s*:\s*(true|false)/), blob: (b(/"planBlob"\s*:\s*"([0-9a-f]{7,64})/) || '').slice(0, 10), previewLen: rp.length }
        if (m[2] === 'spec') e.spec = { reused: b(/"reused"\s*:\s*(true|false)/) }
        if (m[2] === 'progress') e.prog = { doneNs: (rp.match(/"n"\s*:\s*(\d+)/g) || []).map(x => x.replace(/\D/g, '')).join(','), awaiting: b(/"awaitingPerson"\s*:\s*\[([^\]]*)\]/), launchOpen: b(/"launchOpen"\s*:\s*\[([^\]]*)\]/), completed: b(/"effectCompleted"\s*:\s*\[([^\]]*)\]/) }
        if (/plan-review\d/.test(m[2])) (e.planRev ||= []).push({ blob: (b(/"measuredPlanBlob"\s*:\s*"([0-9a-f]{7,64})/) || '').slice(0, 10), issues: (rp.match(/"severity"/g) || []).length })
      }
      rows.push({ proj: proj.slice(-10), ts: String(j.timestamp).slice(5, 16), mode: (j.args && j.args.mode) || 'run', argKeys: Object.keys(j.args || {}).filter(k => !['repo', 'roadmap', 'config', 'targetBranch'].includes(k)).join(','), status: j.status, per })
    }
  }
}
rows.sort((a, b) => (a.proj + a.ts).localeCompare(b.proj + b.ts))
const only = process.argv[3]
for (const r of rows) for (const [E, e] of Object.entries(r.per)) { if (only && E !== only) continue; console.log(JSON.stringify({ proj: r.proj, ts: r.ts, mode: r.mode, args: r.argKeys, st: r.status, E, spec: e.spec, plan: e.plan, planRev: e.planRev, prog: e.prog, labels: e.labels.join(' ') })) }
