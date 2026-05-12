import type { CaddyNodeV1, DiscoveryConfigV1, SnapshotRecordV1 } from '../models/api-v1.model';

/** Normalize list endpoints that may return a bare array or `{ items | nodes | data }`. */
export function normalizeNodeRows(rows: unknown): CaddyNodeV1[] {
  if (Array.isArray(rows)) {
    return rows as CaddyNodeV1[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }
  const obj = rows as Record<string, unknown>;
  const candidates = [obj['items'], obj['nodes'], obj['data']];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value as CaddyNodeV1[];
    }
  }
  return [];
}

/** Normalize discovery list responses. */
export function normalizeDiscoveryRows(rows: unknown): DiscoveryConfigV1[] {
  if (Array.isArray(rows)) {
    return rows as DiscoveryConfigV1[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }
  const obj = rows as Record<string, unknown>;
  const candidates = [obj['items'], obj['discovery'], obj['data']];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value as DiscoveryConfigV1[];
    }
  }
  return [];
}

/** Normalize snapshot list responses (node or discovery). */
export function normalizeSnapshotRows(rows: unknown): SnapshotRecordV1[] {
  if (Array.isArray(rows)) {
    return rows as SnapshotRecordV1[];
  }
  if (!rows || typeof rows !== 'object') {
    return [];
  }
  const obj = rows as Record<string, unknown>;
  const candidates = [obj['items'], obj['snapshots'], obj['data']];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value as SnapshotRecordV1[];
    }
  }
  return [];
}
