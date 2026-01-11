import * as React from 'react';

import type { CdnUrlCacheApi } from './useCdnUrlCache';

type CdnLike = Pick<CdnUrlCacheApi, 'get' | 'resolve'>;

export function useResolveCdnPathUrl(cdn: CdnLike): {
  resolvePathUrl: (path: string) => Promise<string | null>;
} {
  // `cdn` object identity can change as its internal cache updates.
  // Keep it in a ref so callers don't get a new `resolvePathUrl` every render.
  const cdnRef = React.useRef<CdnLike>(cdn);
  React.useEffect(() => {
    cdnRef.current = cdn;
  }, [cdn]);

  const resolvePathUrl = React.useCallback(async (path: string): Promise<string | null> => {
    const key = String(path || '').trim();
    if (!key) return null;
    const cdnNow = cdnRef.current;
    const cached = cdnNow.get(key);
    if (cached) return cached;
    const s = cdnNow.resolve(key);
    return s ? s : null;
  }, []);

  return React.useMemo(() => ({ resolvePathUrl }), [resolvePathUrl]);
}

