export function extractApiError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const candidate = error as {
    error?: { error?: string; detail?: string; message?: string };
    message?: string;
  };

  return (
    candidate.error?.error ??
    candidate.error?.detail ??
    candidate.error?.message ??
    candidate.message ??
    fallback
  );
}
