export function formatRemaining(seconds: number): string {
  const s0 = Math.floor(Number(seconds || 0));
  if (!Number.isFinite(s0) || s0 <= 0) return '0s';
  const d = Math.floor(s0 / 86400);
  const h = Math.floor((s0 % 86400) / 3600);
  const m = Math.floor((s0 % 3600) / 60);
  const s = s0 % 60;
  if (d > 0) return `${d}d${h > 0 ? ` ${h}h` : ''}`;
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
