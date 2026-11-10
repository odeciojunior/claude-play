// aggregate.mjs: reads runs.json (from skill-runs.mjs) and prints markdown tables. node aggregate.mjs [runs.json]
import fs from 'node:fs';
if (!process.argv[2]) { console.error('usage: node aggregate.mjs <runs.json>   (EXCLUDE=<session prefixes, comma separated> to leave sessions out)'); process.exit(2); }
const runs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const EXCLUDE_SESSIONS = (process.env.EXCLUDE || '').split(',').filter(Boolean);
const R = runs.filter((r) => !EXCLUDE_SESSIONS.includes(r.session));
const med = (a) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return NaN; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const f = (x, d = 1) => Number.isFinite(x) ? (Math.abs(x) >= 10000 ? Math.round(x / 1000) + 'k' : x.toFixed(d)) : '-';
const mr = (a, d = 1) => `${f(med(a), d)} [${f(Math.min(...a), d)}-${f(Math.max(...a), d)}]`;
const cohort = (r) => r.project.startsWith('TMP:') ? (r.project.includes('regressao') ? 'sandbox plan-only x21' : r.project.includes('roteiros') ? 'sandbox roteiros' : 'sandbox other') : 'real project';
const groups = {};
for (const r of R) { const k = r.skill + (r.skill === 'roadmap-release' || r.skill === 'plan-coordinator' ? ' / ' + cohort(r) : '') + (r.nestedIn ? ' (nested)' : ''); (groups[k] ??= []).push(r); }
console.log('| group | n | projects | cost EXT $ | cost TURN $ | active min | wall min | main turns | peak ctx (k) | subagents | sub haiku/sonnet/opus (median) | main cost share |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, g] of Object.entries(groups).sort()) {
  const e = (fn) => g.map((r) => fn(r.ext));
  console.log(`| ${k} | ${g.length} | ${new Set(g.map((r) => r.project)).size} | ${mr(g.map((r) => r.cost), 2)} | ${mr(g.map((r) => r.cost1), 2)} | ${mr(e((x) => x.activeAllMin), 0)} | ${mr(e((x) => x.wallAllMin), 0)} | ${mr(e((x) => x.mainTurns), 0)} | ${mr(e((x) => x.peakMain / 1000), 0)} | ${mr(e((x) => x.subagents), 0)} | ${f(med(e((x) => x.subCount.haiku || 0)), 0)}/${f(med(e((x) => x.subCount.sonnet || 0)), 0)}/${f(med(e((x) => x.subCount.opus || 0)), 0)} | ${f(med(g.map((r) => r.ext.mainCost / (r.cost || 1))) * 100, 0)}% |`);
}
// role breakdown
function roleTable(filter, title) {
  const g = R.filter(filter); const agg = {};
  for (const r of g) for (const [k, v] of Object.entries(r.ext.roles)) { const a = (agg[k] ??= { n: 0, cost: 0, tokens: 0, models: {} }); a.n += v.n; a.cost += v.cost; a.tokens += v.tokens; for (const [m, c] of Object.entries(v.byModel)) a.models[m] = (a.models[m] || 0) + c; }
  const mainCost = g.reduce((a, r) => a + r.ext.mainCost, 0); const tot = Object.values(agg).reduce((a, v) => a + v.cost, 0) + mainCost;
  console.log(`\n${title}: ${g.length} runs, total est $${tot.toFixed(2)}; main context $${mainCost.toFixed(2)} (${(mainCost / tot * 100).toFixed(0)}%)`);
  console.log('| role | agents/run | cost/run $ | share | models |\n|---|---|---|---|---|');
  for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].cost - a[1].cost)) console.log(`| ${k} | ${(v.n / g.length).toFixed(1)} | ${(v.cost / g.length).toFixed(2)} | ${(v.cost / tot * 100).toFixed(0)}% | ${Object.entries(v.models).map(([m, c]) => m + ':' + c).join(' ')} |`);
}
roleTable((r) => r.skill === 'roadmap-release' && cohort(r) === 'sandbox plan-only x21', 'release plan-only (sandbox regressao)');
roleTable((r) => r.skill === 'roadmap-release' && cohort(r) === 'sandbox roteiros', 'release roteiros (sandbox, full)');
roleTable((r) => r.skill === 'plan-coordinator' && !r.nestedIn && cohort(r) === 'real project', 'plan-coordinator real');
roleTable((r) => r.skill === 'plan-coordinator' && cohort(r) !== 'real project', 'plan-coordinator sandbox');
