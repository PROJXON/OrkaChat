import * as React from 'react';

export function usePruneExpiredMessages<T extends { expiresAt?: number | null | undefined }>(opts: {
  enabled: boolean;
  intervalMs?: number;
  setMessages: React.Dispatch<React.SetStateAction<T[]>>;
}): void {
  const enabled = !!opts.enabled;
  const intervalMs = Math.max(500, Math.floor(opts.intervalMs ?? 10_000));
  const setMessages = opts.setMessages;

  React.useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      setMessages((prev) => prev.filter((m) => !(m?.expiresAt && m.expiresAt <= nowSec)));
    }, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs, setMessages]);
}

