import React from 'react';
import { toCdnUrl } from '../utils/cdn';

export type CdnUrlCacheApi = {
  urlByPath: Record<string, string>;
  // Returns '' if missing/unresolvable.
  get: (path: string) => string;
  // Returns a resolved URL immediately (or ''), and also caches it.
  resolve: (path: string | null | undefined) => string;
  // Idempotently ensures URLs exist for these paths.
  ensure: (paths: Array<string | null | undefined>) => void;
  // Clear cache (e.g. when switching CDN base).
  reset: () => void;
};

export function useCdnUrlCache(baseUrl: string | undefined | null): CdnUrlCacheApi {
  const base = String(baseUrl || '').trim();
  const [urlByPath, setUrlByPath] = React.useState<Record<string, string>>({});

  // If the base changes, URLs could change; reset for correctness.
  React.useEffect(() => {
    setUrlByPath({});
  }, [base]);

  const get = React.useCallback(
    (path: string): string => {
      const key = String(path || '');
      return urlByPath[key] || '';
    },
    [urlByPath],
  );

  const resolve = React.useCallback(
    (path: string | null | undefined): string => {
      const key = String(path || '').trim();
      if (!key) return '';
      const u = toCdnUrl(base, key);
      if (!u) return '';
      setUrlByPath((prev) => (prev[key] ? prev : { ...prev, [key]: u }));
      return u;
    },
    [base],
  );

  const ensure = React.useCallback(
    (paths: Array<string | null | undefined>) => {
      const wanted: string[] = [];
      for (const p of paths) {
        const key = String(p || '').trim();
        if (!key) continue;
        wanted.push(key);
      }
      if (!wanted.length) return;

      setUrlByPath((prev) => {
        let changed = false;
        const next: Record<string, string> = { ...prev };
        for (const key of wanted) {
          if (next[key]) continue;
          const u = toCdnUrl(base, key);
          if (!u) continue;
          next[key] = u;
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [base],
  );

  const reset = React.useCallback(() => setUrlByPath({}), []);

  return React.useMemo(() => ({ urlByPath, get, resolve, ensure, reset }), [ensure, get, reset, resolve, urlByPath]);
}
