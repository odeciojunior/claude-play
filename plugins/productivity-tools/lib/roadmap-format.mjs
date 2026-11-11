// Parser do formato de roadmap (formats.md): fonte única, pura e sem dependências.
// Sem imports nem acesso a ambiente: o texto entra, a estrutura sai.
// Copiado para o checker e o preflight por plugins/productivity-tools/scripts/embed.mjs.

export function norm(text) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').normalize('NFC');
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseAttrs(s) {
  // Linear tokenizer: key=value, key="quoted value", and positional tokens (_0, _1, ...).
  const attrs = {};
  const str = s || '';
  const n = str.length;
  const isWs = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';
  let pos = 0;
  let positional = 0;
  while (pos < n) {
    while (pos < n && isWs(str[pos])) pos++;
    if (pos >= n) break;
    let end = pos;
    while (end < n && !isWs(str[end]) && str[end] !== '=') end++;
    if (end < n && str[end] === '=' && end > pos) {
      const key = str.slice(pos, end);
      let vs = end + 1;
      if (vs < n && str[vs] === '"') {
        const close = str.indexOf('"', vs + 1);
        if (close !== -1) {
          attrs[key] = str.slice(vs + 1, close);
          pos = close + 1;
          continue;
        }
      }
      let ve = vs;
      while (ve < n && !isWs(str[ve])) ve++;
      if (ve > vs) {
        attrs[key] = str.slice(vs, ve);
        pos = ve;
        continue;
      }
      // "key=" with nothing after: fall through as a positional token
    }
    let te = pos;
    while (te < n && !isWs(str[te])) te++;
    if (te === pos) te = pos + 1;
    attrs[`_${positional++}`] = str.slice(pos, te);
    pos = te;
  }
  return attrs;
}

// Blanks fenced code (same length, newlines kept) so offsets stay valid. keepMermaid leaves ```mermaid content intact.
export function scanFences(text, keepMermaid) {
  const lines = text.split('\n');
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open === null) {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
        open = { ch: m[1][0], len: m[1].length, keep: keepMermaid && /^\s*mermaid\b/i.test(m[2]) };
      }
    } else {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (m && m[1][0] === open.ch && m[1].length >= open.len) open = null;
      else if (!open.keep) lines[i] = ' '.repeat(line.length);
    }
  }
  return { text: lines.join('\n'), unclosed: open !== null };
}

// One linear pass over the comments of a text; a comment whose `-->` comes after the next `<!--` is malformed.
export function scanComments(text) {
  const out = [];
  let closeAt = -2;
  let openAt = -2;
  let i = text.indexOf('<!--');
  while (i !== -1) {
    const from = i + 4;
    if (closeAt !== -1 && closeAt < from) closeAt = text.indexOf('-->', from);
    if (openAt !== -1 && openAt < from) openAt = text.indexOf('<!--', from);
    const malformed = closeAt === -1 || (openAt !== -1 && openAt < closeAt);
    const end = malformed ? (openAt === -1 ? text.length : openAt) : closeAt;
    out.push({ start: i, innerStart: from, end, after: malformed ? end : closeAt + 3, malformed });
    if (malformed) i = openAt;
    else {
      if (openAt !== -1 && openAt < closeAt + 3) openAt = text.indexOf('<!--', closeAt + 3);
      i = openAt;
    }
  }
  return out;
}

export const WS_RE = /\s/;

// Position right after leading whitespace of the comment inner text.
export function skipWs(text, from, end) {
  let k = from;
  while (k < end && WS_RE.test(text[k])) k++;
  return k;
}

function scanBlocks(text, name) {
  text = norm(text);
  const scan = scanFences(text, false).text;
  const comments = scanComments(scan);
  const openTag = `roadmap:${name}`;
  const closeTag = `/roadmap:${name}`;
  const out = [];
  for (let idx = 0; idx < comments.length; idx++) {
    const c = comments[idx];
    const k = skipWs(scan, c.innerStart, c.end);
    if (!scan.startsWith(openTag, k)) continue;
    const after = k + openTag.length;
    if (after < c.end && !WS_RE.test(scan[after])) continue;
    if (c.malformed) {
      const block = { attrs: {}, body: '' };
      Object.defineProperty(block, 'closed', { value: false, enumerable: false });
      Object.defineProperty(block, 'malformed', { value: true, enumerable: false });
      out.push({ block, start: c.start, end: c.after });
      continue;
    }
    let closer = null;
    for (let j = idx + 1; j < comments.length; j++) {
      const d = comments[j];
      if (d.malformed) continue;
      const dk = skipWs(scan, d.innerStart, d.end);
      if (!scan.startsWith(closeTag, dk)) continue;
      const tail = dk + closeTag.length;
      if (scan.slice(tail, d.end).trim() === '') {
        closer = d;
        idx = j;
        break;
      }
    }
    const block = { attrs: parseAttrs(scan.slice(after, c.end)), body: closer ? text.slice(c.after, closer.start) : '' };
    Object.defineProperty(block, 'closed', { value: Boolean(closer), enumerable: false });
    Object.defineProperty(block, 'malformed', { value: false, enumerable: false });
    out.push({ block, start: c.start, end: closer ? closer.after : c.after });
  }
  return out;
}

export function readBlocks(text, name) {
  return scanBlocks(text, name).map((s) => s.block);
}

export function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

export function parseTable(body) {
  const rows = norm(body)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map(splitRow);
  const isSep = (r) => r.length > 0 && r.every((c) => /^:?-+:?$/.test(c));
  return rows.slice(1).filter((r) => !isSep(r));
}

export function parseList(body) {
  const items = [];
  for (const line of norm(body).split('\n')) {
    if (!line.trim() || line.trim().startsWith('<!--') || line.trim().startsWith('|')) continue;
    const m = /^(?:\d+[.)]|[-*+])\s+(.*)$/.exec(line);
    if (m) items.push(m[1].trim());
    else if (items.length && /^\s/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

export function stripNote(seg) {
  const s = seg.trimEnd();
  if (!s.endsWith(')')) return s;
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ')') depth++;
    else if (s[i] === '(') {
      depth--;
      if (depth === 0) return s.slice(0, i).trimEnd();
    }
  }
  return s;
}

export function parseStatusSegments(cell) {
  return (cell || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const noNote = stripNote(raw);
      const note = noNote.length < raw.length ? raw.slice(noNote.length).trim().slice(1, -1) : '';
      const idx = noNote.indexOf(':');
      return {
        raw,
        label: idx >= 0 ? noNote.slice(0, idx).trim() : '',
        word: (idx >= 0 ? noNote.slice(idx + 1) : noNote).trim(),
        note,
      };
    });
}

export function parseStatus(cell) {
  return parseStatusSegments(cell).map((s) => s.word);
}

export function decisionScope(cell) {
  return /\b(?:Alcance|Scope)\s*:\s*local\s*\.?\s*$/i.test((cell || '').trim()) ? 'local' : 'contract';
}

export function blockLines(text, name) {
  const t = norm(text);
  const span = scanBlocks(t, name).find((s) => !s.block.malformed && s.block.closed);
  if (!span) return null;
  const lines = t.split('\n');
  const lineOf = (pos) => t.slice(0, pos).split('\n').length - 1;
  const open = lineOf(span.start);
  const close = lineOf(span.end - 1);
  let header = null;
  const rows = [];
  const items = [];
  const isSep = (l) => {
    const r = splitRow(l);
    return r.length > 0 && r.every((c) => /^:?-+:?$/.test(c));
  };
  for (let i = open + 1; i < close; i++) {
    const line = lines[i];
    const tr = line.trim();
    if (!tr || tr.startsWith('<!--')) continue;
    if (tr.startsWith('|')) {
      if (header === null) header = i;
      else if (!isSep(tr)) rows.push(i);
    } else if (/^(?:\d+[.)]|[-*+])\s+(.*)$/.test(line)) {
      items.push({ start: i, end: i });
    } else if (items.length && /^\s/.test(line)) {
      items[items.length - 1].end = i;
    }
  }
  return { open, close, header, rows, items };
}

export const idsIn = (s, re) => [...new Set((s || '').match(re) || [])];

export function shasIn(cell) {
  const out = [];
  for (const m of (cell || '').matchAll(/`([0-9a-f]{7,40})`/g)) {
    out.push(m[1]);
  }
  return [...new Set(out)];
}

// Acceptance verification tag, at the end of an item: ` {verify: <kind>[ BLQ-n]; evidence: <command or artifact>}`.
export const VERIFY_KINDS = ['test', 'smoke', 'integration', 'human', 'blocked'];
export const EXECUTABLE_KINDS = ['test', 'smoke', 'integration'];

export function parseVerifyTag(item) {
  const at = item.indexOf('{verify:');
  if (at === -1) return { text: item, tag: null, problem: null };
  const text = item.slice(0, at).trimEnd();
  const m = /^\{verify:\s*([^;}]*?)\s*(?:;\s*evidence:\s*([\s\S]*?))?\s*\}$/.exec(item.slice(at).trim());
  if (!m) return { text, tag: {}, problem: 'tag is not of the form {verify: <kind>; evidence: <...>}' };
  const km = /^([A-Za-z-]+)(?:\s+(BLQ-\d+))?$/.exec(m[1]);
  const kind = km ? km[1] : m[1];
  const evidence = (m[2] || '').trim();
  const tag = { kind, blq: km ? km[2] : undefined, evidence };
  if (!km || !VERIFY_KINDS.includes(kind)) return { text, tag, problem: `unknown kind "${m[1]}" (use ${VERIFY_KINDS.join(', ')})` };
  if (kind === 'blocked' && !tag.blq) return { text, tag, problem: 'kind "blocked" must cite a BLQ-n' };
  if (kind !== 'blocked' && tag.blq) return { text, tag, problem: `kind "${kind}" does not take a BLQ-n` };
  if (EXECUTABLE_KINDS.includes(kind) && !evidence) return { text, tag, problem: `kind "${kind}" needs a command or artifact as evidence` };
  return { text, tag, problem: null };
}
const cols = (n) => n;
const T = (role, name, c) => ({ role, name, kind: 'table', cols: c });
const L = (role, name) => ({ role, name, kind: 'list' });

// Blocos do formato (formats.md, secao 3). 'phases' e opcional.
export const ROADMAP_BLOCKS = [
  T('strategy', 'gates', cols(5)),
  T('strategy', 'phases', cols(4)),
  L('state', 'now'),
  T('state', 'panel', cols(4)),
  T('state', 'blockers', cols(5)),
  L('state', 'pending'),
  T('state', 'inflight', cols(3)),
  L('state', 'donot'),
  T('state', 'releases', cols(6)),
  T('decisions', 'decisions', cols(9)),
  T('log', 'log', cols(4)),
  T('sources', 'sources', cols(5)),
  L('sources', 'conflicts'),
  T('requirements', 'requirements', cols(6)),
  T('measurements', 'measurements', cols(7)),
];

const FILE_ROLES = ['state', 'decisions', 'log', 'sources', 'requirements', 'measurements'];

function readOne(text, name, kind) {
  const empty = kind === 'table' ? { present: false, closed: false, malformed: 0, rows: [] } : { present: false, closed: false, malformed: 0, items: [] };
  if (text === null || text === undefined) return empty;
  const all = readBlocks(text, name);
  const good = all.filter((x) => !x.malformed);
  const out = { present: good.length > 0, closed: good.length > 0 && good[0].closed, malformed: all.length - good.length };
  if (kind === 'table') out.rows = good.length ? parseTable(good[0].body) : [];
  else out.items = good.length ? parseList(good[0].body) : [];
  return out;
}

function cutBlocks(body, names) {
  const text = norm(body);
  const spans = [];
  for (const n of names) for (const s of scanBlocks(text, n)) if (!s.block.malformed) spans.push([s.start, s.end]);
  spans.sort((a, b) => a[0] - b[0]);
  let out = '';
  let at = 0;
  for (const [s, e] of spans) {
    if (s < at) continue;
    out += text.slice(at, s);
    at = e;
  }
  return out + text.slice(at);
}

const splitIds = (s) => (s || '').split(/[,\s]+/).filter((x) => x && x !== '-' && x !== '—');

export function parseRoadmapTexts({ strategy, files }) {
  const f = files || {};
  const blocks = {};
  for (const role of ['strategy', ...FILE_ROLES]) blocks[role] = {};
  for (const d of ROADMAP_BLOCKS) {
    const text = d.role === 'strategy' ? strategy : f[d.role];
    blocks[d.role][d.name] = readOne(text, d.name, d.kind);
  }

  const versions = readBlocks(strategy || '', 'version');
  const goodVersions = versions.filter((x) => !x.malformed);
  const version = goodVersions.length ? goodVersions[0].attrs : null;
  blocks.strategy.version = { present: goodVersions.length > 0, malformed: versions.length - goodVersions.length };

  const cardBlocks = readBlocks(strategy || '', 'card');
  blocks.strategy.card = { malformed: cardBlocks.filter((x) => x.malformed).length };

  const cards = [];
  for (const b of cardBlocks) {
    if (b.malformed) continue;
    const acc = readBlocks(b.body, 'acceptance');
    const risks = readBlocks(b.body, 'risks');
    const accGood = acc.filter((x) => !x.malformed)[0];
    const riskGood = risks.filter((x) => !x.malformed)[0];
    cards.push({
      id: b.attrs.id || '',
      attrs: b.attrs,
      closed: b.closed,
      depends: splitIds(b.attrs.depends),
      reqs: splitIds(b.attrs.reqs),
      critical: String(b.attrs.critical).toLowerCase() === 'true',
      acceptance: (accGood ? parseList(accGood.body) : []).map(parseVerifyTag),
      risks: riskGood ? parseList(riskGood.body) : [],
      body: cutBlocks(b.body, ['acceptance', 'risks']),
      malformed: {
        acceptance: acc.filter((x) => x.malformed).length,
        risks: risks.filter((x) => x.malformed).length,
      },
    });
  }
  return { version, cards, blocks };
}
