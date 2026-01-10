export function normalizeUser(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

