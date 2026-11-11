// Cuts text to at most `max` characters, ending with an ellipsis when it was cut.
export function truncate(text, max) {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError('max must be an integer of at least 1');
  }
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}
