// Suíte de gatilho: parser do stream-json, pontuação e tabela. Sem CLI nesta etapa.

function events(text) {
  const out = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line) continue;
    try {
      const ev = JSON.parse(line);
      if (ev && typeof ev === 'object') out.push(ev);
    } catch {
      // linha que não é JSON: pulada
    }
  }
  return out;
}

export function parseTranscript(text) {
  const evs = events(text);
  const init = evs.find((e) => e.type === 'system' && e.subtype === 'init');
  let plugins = [];
  let superpowers = 'unknown';
  if (init) {
    plugins = (Array.isArray(init.plugins) ? init.plugins : [])
      .map((p) => (typeof p === 'string' ? p : p?.name))
      .filter((n) => typeof n === 'string');
    const pref = (list) => Array.isArray(list) && list.some((s) => typeof s === 'string' && s.startsWith('superpowers:'));
    superpowers = plugins.includes('superpowers') || pref(init.skills) || pref(init.slash_commands);
  }
  let skill = null;
  for (const e of evs) {
    if (e.type !== 'assistant') continue;
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    const use = content.find((b) => b?.type === 'tool_use' && b.name === 'Skill');
    if (use) {
      skill = use.input?.skill ?? null;
      break;
    }
  }
  return { skill, superpowers, plugins };
}

export function scoreCase(c, parsed) {
  return {
    id: c.id,
    category: c.category,
    lang: c.lang,
    expect: c.expect,
    got: parsed.skill,
    hit: parsed.skill === c.expect,
    superpowers: parsed.superpowers,
  };
}

export function renderTable(results) {
  const rows = ['| id | lang | category | expect | got | hit | superpowers |', '| --- | --- | --- | --- | --- | --- | --- |'];
  const cats = new Map();
  for (const r of results) {
    rows.push(`| ${r.id} | ${r.lang} | ${r.category} | ${r.expect} | ${r.got ?? '-'} | ${r.hit} | ${r.superpowers} |`);
    const k = cats.get(r.category) ?? { hits: 0, total: 0 };
    k.total += 1;
    if (r.hit) k.hits += 1;
    cats.set(r.category, k);
  }
  rows.push('', '| category | hits | total |', '| --- | --- | --- |');
  for (const [cat, k] of cats) rows.push(`| ${cat} | ${k.hits} | ${k.total} |`);
  return rows.join('\n') + '\n';
}
