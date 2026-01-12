import * as React from 'react';

// DM-only ticking clock for TTL countdown labels:
// - update every minute normally
// - switch to every second when any message is within the last minute
export function useTtlNowSec(opts: {
  enabled: boolean;
  messages: Array<{ expiresAt?: number | null | undefined }>;
}): number {
  const enabled = !!opts.enabled;
  const messages = React.useMemo(
    () => (Array.isArray(opts.messages) ? opts.messages : []),
    [opts.messages],
  );
  const [nowSec, setNowSec] = React.useState<number>(() => Math.floor(Date.now() / 1000));

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (cancelled) return;
      const nextNowSec = Math.floor(Date.now() / 1000);
      setNowSec(nextNowSec);

      let minRemaining: number | null = null;
      for (const m of messages) {
        const expiresAt = m.expiresAt;
        if (!expiresAt) continue;
        const remaining = Number(expiresAt) - nextNowSec;
        if (!Number.isFinite(remaining) || remaining <= 0) continue;
        minRemaining = minRemaining == null ? remaining : Math.min(minRemaining, remaining);
      }

      const delayMs = minRemaining != null && minRemaining <= 60 ? 1_000 : 60_000;
      timeoutId = setTimeout(tick, delayMs);
    };

    tick();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, messages]);

  return nowSec;
}
