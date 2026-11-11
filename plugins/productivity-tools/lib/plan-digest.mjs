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
