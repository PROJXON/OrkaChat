export function randomBase36Suffix(): string {
  return Math.random().toString(36).slice(2);
}

export function timestampId(ts: number, prefix?: string): string {
  const t = Number.isFinite(ts) ? Math.floor(ts) : Date.now();
  const suf = randomBase36Suffix();
  return prefix && String(prefix).length > 0 ? `${prefix}-${t}-${suf}` : `${t}-${suf}`;
}

