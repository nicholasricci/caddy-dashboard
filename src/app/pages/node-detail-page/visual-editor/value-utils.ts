export function toLines(value: string[] | undefined): string {
  return Array.isArray(value) ? value.join('\n') : '';
}

export function fromLines(value: string): string[] {
  return value
    .split('\n')
    .map(v => v.trim())
    .filter(v => v.length > 0);
}

export function safeObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function parseJsonObject(value: string, fallback: Record<string, unknown>): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
