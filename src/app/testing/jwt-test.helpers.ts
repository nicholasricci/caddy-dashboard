/** Minimal fake JWT (payload segment only) for unit tests — not cryptographically valid. */
export function fakeAccessTokenPayload(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `x.${b64}.y`;
}
