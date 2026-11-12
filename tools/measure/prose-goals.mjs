// Prose goals of E4 and E22 measured outside their budget tests, so the checkpoint can read them at any commit.
// read(relPath) -> string and list(relDir) -> string[] (recursive file names) are injected; text is measured in LF.

const PLANNER = 'plugins/productivity-tools/skills/roadmap-planner';
const TRACKER = 'plugins/productivity-tools/skills/roadmap-tracker';
const FORMATS = `${PLANNER}/references/formats.md`;

export const GOALS = [
  { deliverable: 'E4', goal: 'prosa carregável do planner', unit: 'bytes LF', target: 43335 },
  { deliverable: 'E22', goal: 'prosa do tracker por evento', unit: 'bytes LF', target: 29096 },
];
export const NOT_APPLICABLE = ['E23', 'E12', 'E10'];

const norm = (t) => t.replace(/\r\n?/g, '\n');
const bytes = (t) => Buffer.byteLength(norm(t));

function readText(read, rel) {
  const t = read(rel);
  if (typeof t !== 'string') throw new Error(`missing file: ${rel}`);
  return t;
}

export function plannerLoad(read) {
  const files = ['SKILL.md', 'references/clarify.md', 'references/decompose.md', 'references/model.md'].map((f) => `${PLANNER}/${f}`);
  let total = 0;
  for (const f of files) total += bytes(readText(read, f));
  return { bytes: total, files };
}

function parseIndex(eventsMd) {
  const rows = [];
  for (const line of norm(eventsMd).split('\n')) {
    const m = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*`?([^`|\s]+)`?\s*\|\s*$/.exec(line);
    if (m) rows.push({ n: Number(m[1]), event: m[2], file: m[3] });
  }
  return rows;
}

function formatsSections(formatsMd) {
  const out = new Map();
  let n = null;
  let buf = [];
  const flush = () => { if (n !== null) out.set(n, buf.join('\n')); };
  for (const line of norm(formatsMd).split('\n')) {
    const m = /^## (\d+)\./.exec(line);
    if (m) { flush(); n = Number(m[1]); buf = [line]; } else if (n !== null) buf.push(line);
  }
  flush();
  return out;
}

function sectionsCited(text) {
  const out = new Set();
  for (const m of norm(text).matchAll(/formats\.md`?\s*§\s*(\d+(?:\s*(?:,|and|e)\s*§?\s*\d+)*)/g)) {
    for (const n of m[1].matchAll(/\d+/g)) out.add(Number(n[0]));
  }
  return out;
}

// Largest per-event load by DEC-234 with the DEC-252 amendment.
export function trackerMaxEventLoad(read, list) {
  const refsDir = `${TRACKER}/references`;
  const rows = parseIndex(readText(read, `${refsDir}/events.md`));
  if (rows.length === 0) throw new Error('empty event index');
  const listed = list(refsDir).map((f) => norm(f).replace(`${refsDir}/`, ''));
  const topLevel = listed.filter((f) => !f.includes('/') && f !== 'events.md');
  const onDisk = new Set(listed);
  const secs = formatsSections(readText(read, FORMATS));
  let max = { bytes: -1, event: '' };
  for (const r of rows) {
    if (!onDisk.has(r.file)) throw new Error(`missing recipe: ${r.file}`);
    const recipe = readText(read, `${refsDir}/${r.file}`);
    const files = new Set(['SKILL.md', 'references/events.md', `references/${r.file}`]);
    for (const f of topLevel) if (recipe.includes(f)) files.add(`references/${f}`);
    const texts = [...files].map((f) => readText(read, `${TRACKER}/${f}`));
    const cited = new Set();
    for (const t of texts) for (const n of sectionsCited(t)) cited.add(n);
    let total = texts.reduce((s, t) => s + bytes(t), 0);
    for (const n of cited) if (secs.has(n)) total += bytes(secs.get(n));
    if (total > max.bytes) max = { bytes: total, event: `${r.n} ${r.event}` };
  }
  return max;
}

export function measureGoals(read, list) {
  const measures = {
    E4: () => plannerLoad(read).bytes,
    E22: () => trackerMaxEventLoad(read, list).bytes,
  };
  const rows = GOALS.map((g) => {
    let measured = null;
    try { measured = measures[g.deliverable](); } catch { measured = null; }
    const verdict = measured === null ? 'não medida' : measured <= g.target ? 'atingida' : 'não atingida';
    return { ...g, measured, verdict };
  });
  for (const d of NOT_APPLICABLE) {
    rows.push({ deliverable: d, goal: 'meta de prosa', unit: 'bytes LF', target: null, measured: null, verdict: 'não aplicável neste ponto' });
  }
  return rows;
}
