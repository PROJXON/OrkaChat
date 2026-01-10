import * as React from 'react';

import type { CdnUrlCacheApi } from './useCdnUrlCache';

type CdnLike = Pick<CdnUrlCacheApi, 'get' | 'resolve'>;

export function useResolveCdnPathUrl(cdn: CdnLike): {
  resolvePathUrl: (path: string) => Promise<string | null>;
} {
  const resolvePathUrl = React.useCallback(
    async (path: string): Promise<string | null> => {
      const key = String(path || '').trim();
      if (!key) return null;
      const cached = cdn.get(key);
      if (cached) return cached;
      const s = cdn.resolve(key);
      return s ? s : null;
    },
    [cdn],
  );

  return React.useMemo(() => ({ resolvePathUrl }), [resolvePathUrl]);
}

