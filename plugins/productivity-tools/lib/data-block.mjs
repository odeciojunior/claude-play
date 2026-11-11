// Leitor do bloco de dados ```json data de um spec: fonte pura (DEC-058).
// Sem imports nem acesso a ambiente: o texto entra, a estrutura sai.

const norm = (t) => String(t).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC');

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

// Varre o texto no estilo CommonMark e devolve os blocos de dados de nível superior.
export function findDataBlocks(text) {
  const src = norm(text);
  const lines = src.split('\n');
  const blocks = [];
  let offset = 0;
  let i = 0;
  while (i < lines.length) {
    const m = FENCE_RE.exec(lines[i]);
    const openStart = offset;
    const openLine = i;
    offset += lines[i].length + 1;
    i++;
    if (!m) continue;
    const ch = m[1][0];
    const len = m[1].length;
    const info = m[2].trim();
    // Cerca de crase não pode ter crase na informação (não é cerca).
    if (ch === '`' && info.includes('`')) continue;
    const closeRe = new RegExp(`^ {0,3}${ch === '`' ? '`' : '~'}{${len},}[ \t]*$`);
    const bodyStart = offset;
    let closed = false;
    let bodyEnd = offset;
    let end = src.length;
    while (i < lines.length) {
      const isClose = closeRe.test(lines[i]);
      if (isClose) {
        bodyEnd = offset;
        offset += lines[i].length + 1;
        end = Math.min(offset, src.length);
        i++;
        closed = true;
        break;
      }
      offset += lines[i].length + 1;
      i++;
    }
    if (!closed) continue;
    if (info !== 'json data') continue;
    blocks.push({
      line: openLine + 1,
      start: openStart,
      end,
      info,
      body: src.slice(bodyStart, Math.max(bodyStart, bodyEnd - 1)),
    });
  }
  return blocks;
}

export function readDataBlock(text) {
  const src = norm(text);
  const blocks = findDataBlocks(src);
  if (blocks.length === 0) {
    return { data: null, prose: src, line: null, error: { code: 'data-block-missing', message: 'nenhum bloco ```json data encontrado' } };
  }
  if (blocks.length > 1) {
    const where = blocks.map((b) => b.line).join(', ');
    return { data: null, prose: src, line: blocks[0].line, error: { code: 'data-block-multiple', message: `mais de um bloco json data (linhas ${where})` } };
  }
  const b = blocks[0];
  const prose = src.slice(0, b.start) + src.slice(b.end);
  try {
    return { data: JSON.parse(b.body), prose, line: b.line, error: null };
  } catch (e) {
    return { data: null, prose, line: b.line, error: { code: 'data-block-json', message: String(e && e.message ? e.message : e) } };
  }
}

export function replaceDataBlock(text, data) {
  const src = norm(text);
  const blocks = findDataBlocks(src);
  if (blocks.length !== 1) throw new Error(`esperado exatamente um bloco json data, achado ${blocks.length}`);
  const b = blocks[0];
  const hadNewline = src[b.end - 1] === '\n';
  const block = '```json data\n' + JSON.stringify(data, null, 2) + '\n```' + (hadNewline ? '\n' : '');
  return src.slice(0, b.start) + block + src.slice(b.end);
}
