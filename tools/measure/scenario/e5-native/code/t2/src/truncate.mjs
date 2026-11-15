// Cuts text to at most `max` code points, ending with an ellipsis when it was cut.
export function truncate(text, max) {
  if (!(max >= 1)) throw new RangeError('max must be at least 1');
  const cps = Array.from(String(text));
  if (cps.length <= max) return text;
  return cps.slice(0, max - 1).join('') + '…';
}
