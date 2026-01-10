import * as React from 'react';

export function useStorageSessionReady(opts: {
  user: unknown;
  fetchAuthSession: (opts?: { forceRefresh?: boolean }) => Promise<any>;
  attempts?: number;
  baseDelayMs?: number;
}): boolean {
  const attempts = typeof opts.attempts === 'number' && Number.isFinite(opts.attempts) ? Math.max(1, Math.floor(opts.attempts)) : 6;
  const baseDelayMs =
    typeof opts.baseDelayMs === 'number' && Number.isFinite(opts.baseDelayMs) ? Math.max(0, Math.floor(opts.baseDelayMs)) : 250;

  const [ready, setReady] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    setReady(false);

    (async () => {
      // If we don't have a signed-in user, don't block the UI.
      if (!opts.user) {
        setReady(true);
        return;
      }

      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const sess = await opts.fetchAuthSession({ forceRefresh: attempt === 0 });
          if (sess?.credentials?.accessKeyId) {
            if (!cancelled) setReady(true);
            return;
          }
        } catch {
          // ignore; retry
        }
        // Small backoff (keeps the UI snappy but avoids tight loops)
        await new Promise((r) => setTimeout(r, baseDelayMs + attempt * baseDelayMs));
      }

      // Don't block forever; we'll still retry getUrl, but the user can at least interact.
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [opts.user, opts.fetchAuthSession, attempts, baseDelayMs]);

  return ready;
}

