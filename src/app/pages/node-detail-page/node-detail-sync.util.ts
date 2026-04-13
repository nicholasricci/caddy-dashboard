/** Try to parse a string into a plain JSON object (not array). */
function tryParseObjectString(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s) as unknown;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Extract Caddy config object from a POST /sync response body.
 */
export function extractCaddyConfigFromSyncResponse(res: unknown): Record<string, unknown> | null {
  if (res == null) {
    return null;
  }
  if (typeof res === 'string') {
    return tryParseObjectString(res);
  }
  if (typeof res !== 'object' || Array.isArray(res)) {
    return null;
  }
  const o = res as Record<string, unknown>;

  const fromConfig = o['config'];
  if (fromConfig != null) {
    if (typeof fromConfig === 'object' && !Array.isArray(fromConfig)) {
      return fromConfig as Record<string, unknown>;
    }
    if (typeof fromConfig === 'string') {
      const p = tryParseObjectString(fromConfig);
      if (p) {
        return p;
      }
    }
  }

  const cj = o['config_json'];
  if (typeof cj === 'string') {
    const p = tryParseObjectString(cj);
    if (p) {
      return p;
    }
  }
  if (cj != null && typeof cj === 'object' && !Array.isArray(cj)) {
    return cj as Record<string, unknown>;
  }

  const data = o['data'];
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  if (typeof data === 'string') {
    const p = tryParseObjectString(data);
    if (p) {
      return p;
    }
  }

  for (const v of Object.values(o)) {
    if (typeof v === 'string') {
      const p = tryParseObjectString(v);
      if (p) {
        return p;
      }
    }
  }

  return null;
}

/** True when the object looks like a top-level Caddy JSON document. */
export function isLikelyCaddyConfigRoot(o: Record<string, unknown>): boolean {
  return (
    o['apps'] != null ||
    o['admin'] != null ||
    o['logging'] != null ||
    o['storage'] != null ||
    o['servers'] != null
  );
}

/**
 * Extract Caddy config from a snapshot list row (for load / diff).
 */
export function extractConfigFromSnapshotRecord(s: Record<string, unknown>): Record<string, unknown> | null {
  const nested = extractCaddyConfigFromSyncResponse(s);
  if (nested) {
    return nested;
  }
  if (s['apps'] != null || s['admin'] != null || s['logging'] != null || s['storage'] != null) {
    return s;
  }
  return null;
}
