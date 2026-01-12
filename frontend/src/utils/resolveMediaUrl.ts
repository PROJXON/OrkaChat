export type PathUrlResolver = (path: string) => Promise<string | null>;

export async function resolveMediaUrlWithFallback(
  resolvePathUrl: PathUrlResolver,
  preferredPath: string | null | undefined,
  fallbackPath?: string | null | undefined,
): Promise<string | null> {
  const preferred = String(preferredPath || '').trim();
  if (preferred) {
    const u = await resolvePathUrl(preferred);
    if (u) return u;
  }
  const fallback = String(fallbackPath || '').trim();
  if (fallback && fallback !== preferred) {
    const u = await resolvePathUrl(fallback);
    if (u) return u;
  }
  return null;
}

export async function resolveMediaPathUrls(
  resolvePathUrl: PathUrlResolver,
  items: Array<{ path?: string | null | undefined }>,
): Promise<Array<string | null>> {
  return await Promise.all(
    items.map((m) => {
      const p = String(m?.path || '').trim();
      return p ? resolvePathUrl(p) : Promise.resolve(null);
    }),
  );
}
