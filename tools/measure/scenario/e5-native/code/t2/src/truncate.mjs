// Cuts text to at most `max` code points, ending with an ellipsis when it was cut.
export function truncate(text, max) {
  if (!(max >= 1)) throw new RangeError('max must be at least 1');
  const s = String(text);
  const cps = Array.from(s);
  if (cps.length <= max) return s;
  return cps.slice(0, max - 1).join('') + '…';
}
