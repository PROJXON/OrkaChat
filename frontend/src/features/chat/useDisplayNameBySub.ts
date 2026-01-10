import * as React from 'react';
import { fetchAuthSession } from '@aws-amplify/auth';
import { fetchDisplayNamesBySub, type DisplayNameBySub } from './userLookup';

export function useDisplayNameBySub(apiUrl: string | undefined | null): {
  nameBySub: Record<string, string>;
  ensureNames: (subs: string[]) => Promise<void>;
  reset: () => void;
} {
  const api = String(apiUrl || '').trim();
  const [nameBySub, setNameBySub] = React.useState<Record<string, string>>({});
  const nameBySubRef = React.useRef<Record<string, string>>({});

  React.useEffect(() => {
    nameBySubRef.current = nameBySub;
  }, [nameBySub]);

  const reset = React.useCallback(() => setNameBySub({}), []);

  const ensureNames = React.useCallback(
    async (subs: string[]) => {
      if (!api) return;
      const list = Array.isArray(subs) ? subs.map((s) => String(s || '').trim()).filter(Boolean) : [];
      if (!list.length) return;

      // Only fetch truly missing ones (best-effort cache).
      const missing = list.filter((s) => !nameBySubRef.current[s]);
      if (!missing.length) return;

      try {
        const { tokens } = await fetchAuthSession().catch(() => ({ tokens: undefined }));
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;

        const fetched: DisplayNameBySub = await fetchDisplayNamesBySub({ apiUrl: api, idToken, subs: missing, limit: 25 });
        const entries = Object.entries(fetched);
        if (!entries.length) return;

        setNameBySub((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const [sub, display] of entries) {
            if (!display) continue;
            if (next[sub] === display) continue;
            next[sub] = display;
            changed = true;
          }
          return changed ? next : prev;
        });
      } catch {
        // ignore
      }
    },
    [api],
  );

  return React.useMemo(() => ({ nameBySub, ensureNames, reset }), [ensureNames, nameBySub, reset]);
}

