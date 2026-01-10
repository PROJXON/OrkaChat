export function toCdnUrl(baseUrl: string | undefined | null, path: string): string {
  const base = String(baseUrl || '').trim();
  const p = String(path || '').replace(/^\/+/, '');
  if (!base || !p) return '';
  try {
    const b = base.endsWith('/') ? base : `${base}/`;
    return new URL(p, b).toString();
  } catch {
    return '';
  }
}
