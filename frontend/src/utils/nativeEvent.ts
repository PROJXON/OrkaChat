export function getNativeEventNumber(e: unknown, path: string[]): number {
  if (!e || typeof e !== 'object') return 0;
  let cur: unknown = e;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return 0;
    cur = (cur as Record<string, unknown>)[key];
  }
  const n = Number(cur);
  return Number.isFinite(n) ? n : 0;
}
