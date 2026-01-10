import * as React from 'react';
import { fetchAuthSession } from '@aws-amplify/auth';

export function useHydrateDmReads(opts: {
  enabled: boolean;
  apiUrl: string | null | undefined;
  activeConversationId: string;
  myUserId: string | null | undefined;
  displayName: string;
  normalizeUser: (v: unknown) => string;
  setPeerSeenAtByCreatedAt: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}): void {
  const { enabled, apiUrl, activeConversationId, myUserId, displayName, normalizeUser, setPeerSeenAtByCreatedAt } = opts;

  React.useEffect(() => {
    (async () => {
      if (!enabled) return;
      if (!apiUrl) return;
      try {
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (!idToken) return;
        const res = await fetch(
          `${apiUrl.replace(/\/$/, '')}/reads?conversationId=${encodeURIComponent(activeConversationId)}`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        // Expected shape (new): { reads: [{ userSub?: string, user?: string, messageCreatedAt: number, readAt: number }] }
        // Backward compat: accept { readUpTo } as a messageCreatedAt.
        const reads = Array.isArray((data as any).reads) ? (data as any).reads : [];
        const map: Record<string, number> = {};
        for (const r of reads) {
          if (!r || typeof r !== 'object') continue;
          const readerSub = typeof (r as any).userSub === 'string' ? String((r as any).userSub) : '';
          const readerName = typeof (r as any).user === 'string' ? String((r as any).user) : '';
          // Ignore reads from myself
          if (myUserId && readerSub && readerSub === myUserId) continue;
          if (!readerSub && readerName && normalizeUser(readerName) === normalizeUser(displayName)) continue;
          const mc = Number((r as any).messageCreatedAt ?? (r as any).readUpTo);
          const ra = Number((r as any).readAt);
          if (!Number.isFinite(mc) || !Number.isFinite(ra)) continue;
          const key = String(mc);
          map[key] = map[key] ? Math.min(map[key], ra) : ra;
        }
        setPeerSeenAtByCreatedAt((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(map)) {
            const existing = next[k];
            next[k] = existing ? Math.min(existing, v) : v;
          }
          return next;
        });
      } catch {
        // ignore
      }
    })();
  }, [enabled, apiUrl, activeConversationId, displayName, myUserId, normalizeUser, setPeerSeenAtByCreatedAt]);
}

