// Escritor por linhas do roadmap: puro e sem dependências.
// Preserva BOM, finais de linha e o texto das linhas não tocadas, byte a byte.

const EOL_RE = /\r\n|\r|\n/g;

export function splitLines(raw) {
  let bom = '';
  let rest = raw;
  if (rest.startsWith('\uFEFF')) {
    bom = '\uFEFF';
    rest = rest.slice(1);
  }
  const lines = [];
  let pos = 0;
  EOL_RE.lastIndex = 0;
  let m;
  while ((m = EOL_RE.exec(rest))) {
    lines.push({ text: rest.slice(pos, m.index), eol: m[0] });
    pos = m.index + m[0].length;
  }
  if (pos < rest.length) lines.push({ text: rest.slice(pos), eol: '' });
  return { bom, lines };
}

export function joinLines(doc) {
  return doc.bom + doc.lines.map((l) => l.text + l.eol).join('');
}

export function serializeRow(cells) {
  const clean = cells.map((c) =>
    String(c).replace(/[\r\n]+/g, ' ').normalize('NFC').replace(/\|/g, '\\|'),
  );
  return `| ${clean.join(' | ')} |`;
}

// Ordem entre edições na mesma linha (índices originais, aplicadas de baixo para cima):
// insertAfter, depois replace/remove, depois insertBefore.
const RANK = { insertAfter: 0, replace: 1, remove: 1, insertBefore: 2 };

function neighborEol(lines, idx) {
  for (let i = idx - 1; i >= 0; i--) if (lines[i].eol) return lines[i].eol;
  for (let i = idx + 1; i < lines.length; i++) if (lines[i].eol) return lines[i].eol;
  return '\n';
}

export function applyEdits(raw, edits) {
  const doc = splitLines(raw);
  const lines = doc.lines;
  const sorted = edits
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.line - a.e.line || RANK[a.e.op] - RANK[b.e.op] || b.i - a.i)
    .map((x) => x.e);
  for (const e of sorted) {
    const at = e.line;
    if (!(RANK[e.op] !== undefined) || at < 0 || at >= lines.length) {
      throw new Error(`edição inválida: ${e.op} na linha ${at}`);
    }
    if (e.op === 'replace') {
      lines[at] = { text: e.text.normalize('NFC'), eol: lines[at].eol };
    } else if (e.op === 'remove') {
      const end = e.end === undefined ? at : e.end;
      if (end < at || end >= lines.length) throw new Error(`intervalo inválido: ${at}-${end}`);
      const tail = end === lines.length - 1 && lines[end].eol === '';
      lines.splice(at, end - at + 1);
      if (tail && lines.length) lines[lines.length - 1].eol = '';
    } else {
      const text = e.text.normalize('NFC');
      const target = lines[at];
      const last = at === lines.length - 1 && target.eol === '';
      if (e.op === 'insertAfter') {
        if (last) {
          const eol = neighborEol(lines, at);
          target.eol = eol;
          lines.splice(at + 1, 0, { text, eol: '' });
        } else {
          lines.splice(at + 1, 0, { text, eol: target.eol });
        }
      } else {
        const eol = last ? neighborEol(lines, at) : target.eol;
        lines.splice(at, 0, { text, eol });
      }
    }
  }
  return joinLines(doc);
}
