/** Parse newline- or comma-separated user input into trimmed tokens. */
export function parseLineList(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Parse newline- or comma-separated integers; invalid tokens are dropped. */
export function parseIntegerList(text: string): number[] {
  return parseLineList(text)
    .map(s => Number.parseInt(s, 10))
    .filter(n => Number.isFinite(n));
}
