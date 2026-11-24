// Resumo de integridade do plano: fonte pura (DEC-058), sem imports nem acesso a ambiente.
// O algoritmo é o de planFingerprint (FNV-1a de 32 bits) de roadmap-release.js.

// Cópia com chaves de objeto ordenadas (por `<` de string), recursiva em objetos e listas.
export function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))) out[k] = canon(value[k]);
    return out;
  }
  return value;
}

// FNV-1a de 32 bits: 8 dígitos hexadecimais minúsculos.
export function fnv1a(str) {
  let pdH = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    pdH ^= str.charCodeAt(i);
    pdH = Math.imul(pdH, 0x01000193) >>> 0;
  }
  return pdH.toString(16).padStart(8, '0');
}

export function planDigest({ plan, source }) {
  return fnv1a(JSON.stringify(canon({ plan, source })));
}

// Maior saída que um agente copia literal e maior envelope serializado de uma fatia, em bytes UTF-8.
export const MAX_COPY_BYTES = 3500;
export const SLICE_BYTES = 3072;

// Bytes UTF-8 de um ponto de código (substituto solto vale U+FFFD, 3 bytes).
function cpBytes(cp) {
  if (cp >= 0xd800 && cp <= 0xdfff) return 3;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

// Tamanho em bytes da codificação UTF-8 de str.
export function utf8Length(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp > 0xffff) i++;
    n += cpBytes(cp);
  }
  return n;
}

// Bytes UTF-8 de str, feitos à mão.
function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.codePointAt(i);
    if (cp > 0xffff) i++;
    else if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

// SHA-256 em JS puro sobre uma lista de bytes: devolve os 32 bytes do digest (núcleo único do algoritmo).
export function sha256Bytes(input) {
  const b = Array.from(input);
  const bits = b.length * 8;
  b.push(0x80);
  while (b.length % 64 !== 56) b.push(0);
  const hi = Math.floor(bits / 4294967296);
  const lo = bits >>> 0;
  for (const x of [hi, lo]) b.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array(64);
  const rot = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < b.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = ((b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3]) >>> 0;
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) >>> 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    const v = [a, bb, c, d, e, f, g, k];
    for (let i = 0; i < 8; i++) h[i] = (h[i] + v[i]) >>> 0;
  }
  const out = [];
  for (const x of h) out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
  return out;
}

// SHA-256 em JS puro sobre a codificação UTF-8 de str: 64 dígitos hexadecimais minúsculos.
export function sha256Hex(str) {
  return sha256Bytes(utf8Bytes(str)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// XOR dos bytes com o keystream da fatia: concatenação de sha256(`${nonce}:${slice}:${c}`), c = 0, 1, 2...
// (bytes brutos do digest). O índice da fatia entra no keystream para não repetir entre fatias.
// Ofuscação, não sigilo: o nonce vai no próprio envelope; serve só para o texto não ser legível a quem copia.
function xorStream(bytes, nonce, slice) {
  const out = new Array(bytes.length);
  let ks = [];
  for (let i = 0, c = 0; i < bytes.length; i++) {
    if (i % 32 === 0) ks = sha256Bytes(utf8Bytes(`${nonce}:${slice}:${c++}`));
    out[i] = bytes[i] ^ ks[i % 32];
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Base64 padrão (com "=") de uma lista de bytes.
function b64Encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

// Bytes de um base64 padrão estrito; null se inválido (alfabeto, tamanho, padding).
function b64Decode(str) {
  if (typeof str !== 'string' || str.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(str)) return null;
  const out = [];
  for (let i = 0; i < str.length; i += 4) {
    const q = str.slice(i, i + 4);
    const pad = q.endsWith('==') ? 2 : q.endsWith('=') ? 1 : 0;
    if (pad && i + 4 !== str.length) return null;
    const n = (B64.indexOf(q[0]) << 18) | (B64.indexOf(q[1]) << 12) | ((pad === 2 ? 0 : B64.indexOf(q[2])) << 6) | (pad ? 0 : B64.indexOf(q[3]));
    out.push((n >> 16) & 255);
    if (pad < 2) out.push((n >> 8) & 255);
    if (pad < 1) out.push(n & 255);
  }
  return out;
}

// Texto de uma lista de bytes UTF-8; sequência inválida vira U+FFFD.
function utf8Decode(b) {
  let out = '';
  for (let i = 0; i < b.length;) {
    const c = b[i];
    const len = c < 0x80 ? 1 : c >= 0xc2 && c < 0xe0 ? 2 : c >= 0xe0 && c < 0xf0 ? 3 : c >= 0xf0 && c < 0xf5 ? 4 : 0;
    let cp = len === 1 ? c : len === 2 ? c & 31 : len === 3 ? c & 15 : c & 7;
    let ok = len > 0 && i + len <= b.length;
    for (let k = 1; ok && k < len; k++) {
      if ((b[i + k] & 0xc0) !== 0x80) ok = false;
      else cp = (cp << 6) | (b[i + k] & 63);
    }
    if (ok && ((len === 3 && (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff))) || (len === 4 && (cp < 0x10000 || cp > 0x10ffff)))) ok = false;
    if (!ok) { out += String.fromCharCode(0xfffd); i++; continue; }
    out += String.fromCodePoint(cp);
    i += len;
  }
  return out;
}

// Envelope assinado: o cabeçalho, enc, slice, slices, total, text (xor-base64) e o digest FNV do resto.
function signEnv(head, slice, slices, total, text) {
  const rest = { ...head, enc: 'xor-base64', slice, slices, total, text };
  return { ...rest, digest: fnv1a(JSON.stringify(canon(rest))) };
}

// Corta os bytes UTF-8 de text em envelopes de até SLICE_BYTES serializados; text vai em xor-base64
// (bytes XOR keystream de head.nonce e do índice da fatia, depois base64; ofuscação, não sigilo).
// Partes de múltiplos de 3 bytes (sem "=" no meio); uma parte pode cortar um caractere multibyte.
export function sliceEnvelopes(head, text) {
  const total = { sha256: sha256Hex(text), bytes: utf8Length(text) };
  const bytes = utf8Bytes(text);
  for (let d = 1; ; d++) {
    const big = 10 ** d - 1;
    const room = SLICE_BYTES - utf8Length(JSON.stringify(signEnv(head, big, big, total, '')));
    const step = Math.floor(room / 4) * 3;
    if (step < 3) throw new Error('slice header larger than the slice limit');
    const parts = [];
    let from = 0;
    do {
      parts.push(b64Encode(xorStream(bytes.slice(from, from + step), head.nonce, parts.length)));
      from += step;
    } while (from < bytes.length);
    if (String(parts.length).length <= d) return parts.map((p, i) => signEnv(head, i, parts.length, total, p));
  }
}

// Confere um envelope: tool, comando (command ou mode), nonce, índice, codificação e digest.
export function checkSlice(env, { tool, command, nonce, slice } = {}) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return { ok: false, why: 'the slice is not an object' };
  if (env.tool !== tool) return { ok: false, why: 'the slice is from another tool' };
  if ((env.command ?? env.mode) !== command) return { ok: false, why: 'the slice is from another command' };
  if (env.nonce !== nonce) return { ok: false, why: 'the slice has another nonce' };
  if (env.slice !== slice) return { ok: false, why: 'the slice has another index' };
  if (env.enc !== 'xor-base64') return { ok: false, why: 'the slice is not xor-base64' };
  if (typeof env.text !== 'string') return { ok: false, why: 'the slice has no text' };
  const { digest, ...rest } = env;
  if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, why: 'the digest of the slice does not match: the copy is not literal' };
  return { ok: true, why: null };
}

// Remonta o texto de uma leitura completa; recusa mistura, falta, ordem trocada, enc diferente de xor-base64, base64 inválido e SHA divergente.
// Junta os bytes de todas as fatias antes de converter para texto (uma fatia pode cortar um caractere).
export function joinSlices(envs) {
  if (!Array.isArray(envs) || envs.length === 0) return { ok: false, why: 'there are no slices' };
  const first = envs[0];
  if (!first || !first.total) return { ok: false, why: 'the slice has no total' };
  const all = [];
  for (let i = 0; i < envs.length; i++) {
    const env = envs[i];
    if (!env || typeof env !== 'object' || typeof env.text !== 'string' || !env.total) return { ok: false, why: `slice ${i} is malformed` };
    if (env.enc !== 'xor-base64') return { ok: false, why: `slice ${i} is not xor-base64` };
    if (env.slice !== i) return { ok: false, why: `slice ${i} is missing or out of order` };
    if (env.slices !== envs.length) return { ok: false, why: 'the slice count does not match the slices received' };
    if (env.total.sha256 !== first.total.sha256 || env.total.bytes !== first.total.bytes) return { ok: false, why: 'the slices come from different reads' };
    const { digest, ...rest } = env;
    if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, why: `the digest of slice ${i} does not match` };
    const part = b64Decode(env.text);
    if (part === null) return { ok: false, why: `slice ${i} is not valid base64` };
    const plain = xorStream(part, env.nonce, env.slice);
    for (let k = 0; k < plain.length; k++) all.push(plain[k]);
  }
  if (all.length !== first.total.bytes) return { ok: false, why: 'the joined bytes do not match the total byte count' };
  const text = utf8Decode(all);
  if (utf8Length(text) !== first.total.bytes || sha256Hex(text) !== first.total.sha256) return { ok: false, why: 'the joined text does not match the total sha256' };
  return { ok: true, text };
}

// Digest FNV do comando ({argv} ou {bash}) que o capture executa.
export function commandDigest(cmd) {
  return fnv1a(JSON.stringify(canon(cmd)));
}

// Confere a linha única do capture copiada por um agente; devolve data.
export function checkCapture(stdout, { nonce, noncePrefix, cmdDigest } = {}) {
  const raw = String(stdout == null ? '' : stdout).replace(/\s+$/, '');
  if (utf8Length(raw) > MAX_COPY_BYTES) return { ok: false, why: 'the output is larger than the copy limit' };
  let o;
  try { o = JSON.parse(raw); } catch { return { ok: false, why: 'the output is not JSON' }; }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.tool !== 'capture') return { ok: false, why: 'the output is not from capture' };
  if (o.error !== undefined) return { ok: false, why: `capture refused: ${o.error}` };
  if (nonce !== undefined && o.nonce !== nonce) return { ok: false, why: 'the nonce of the output is not the one of this run' };
  if (noncePrefix !== undefined && !(typeof o.nonce === 'string' && o.nonce.startsWith(noncePrefix))) return { ok: false, why: 'the nonce of the output is outside the expected prefix' };
  if (cmdDigest !== undefined && o.cmdDigest !== cmdDigest) return { ok: false, why: 'the output is not from the expected command' };
  const { digest, ...rest } = o;
  if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, why: 'the digest of the output does not match: the copy is not literal' };
  return { ok: true, data: o.data };
}

// Checks the output of a signed progress.mjs call: tool, command, nonce and digest of the rest.
export function checkSigned(out, nonce, command) {
  if (!out || typeof out !== 'object' || Array.isArray(out)) return { ok: false, error: 'signed output is not an object' }
  if (out.tool !== 'progress') return { ok: false, error: 'signed output has the wrong tool' }
  if (out.command !== command) return { ok: false, error: `signed output is not from the ${command} command` }
  if (out.nonce !== nonce) return { ok: false, error: 'signed output has the wrong nonce' }
  const { digest, ...rest } = out
  if (digest !== fnv1a(JSON.stringify(canon(rest)))) return { ok: false, error: 'signed output digest does not match' }
  return { ok: true, error: null }
}

// Output of a plugin script copied by an agent: tool, nonce and digest must match. release-discovery signs { nonce, data }; verify-run signs the whole output without its digest.
export function checkRun(stdout, tool, nonce) {
  let o
  try { o = JSON.parse(String(stdout == null ? '' : stdout)) } catch { return { ok: false, why: 'the output is not JSON' } }
  if (!o || typeof o !== 'object' || o.tool !== tool) return { ok: false, why: `the output is not from ${tool}` }
  if (o.error !== undefined) return { ok: false, why: `${tool} refused: ${o.error}` }
  if (o.nonce !== nonce) return { ok: false, why: 'the nonce of the output is not the one of this run' }
  const { digest, ...rest } = o
  const disco = tool === 'release-discovery'
  if (digest !== fnv1a(JSON.stringify(canon(disco ? { nonce: o.nonce, data: o.data } : rest)))) return { ok: false, why: 'the digest of the output does not match: the copy is not literal' }
  return { ok: true, data: disco ? o.data : o }
}
