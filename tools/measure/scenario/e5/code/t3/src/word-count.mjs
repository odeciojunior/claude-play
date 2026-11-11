// Counts whitespace-separated words; empty or blank text has none.
export function wordCount(text) {
  const t = String(text).trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}
