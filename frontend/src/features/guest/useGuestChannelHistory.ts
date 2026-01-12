import * as React from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { appendUniqueById, dedupeById, prependUniqueById } from '../../utils/listMerge';
import { fetchGuestChannelHistoryPage } from './guestApi';
import type { GuestChannelMeta, GuestMessage } from './types';

export function useGuestChannelHistory(opts: {
  activeConversationId: string;
  pollIntervalMs?: number;
}) {
  const { activeConversationId, pollIntervalMs } = opts;

  const [messages, setMessages] = React.useState<GuestMessage[]>([]);
  const messagesRef = React.useRef<GuestMessage[]>([]);
  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const [historyCursor, setHistoryCursor] = React.useState<number | null>(null);
  const [historyHasMore, setHistoryHasMore] = React.useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = React.useState<boolean>(false);
  const historyLoadingRef = React.useRef<boolean>(false);

  const [activeChannelMeta, setActiveChannelMeta] = React.useState<GuestChannelMeta | null>(null);

  const fetchHistoryPage = React.useCallback(
    async (fetchOpts?: { reset?: boolean; before?: number | null; isManual?: boolean }) => {
      const reset = !!fetchOpts?.reset;
      const before = fetchOpts?.before;
      const isManual = !!fetchOpts?.isManual;

      if (reset) {
        historyLoadingRef.current = false;
      }
      if (historyLoadingRef.current) return;
      historyLoadingRef.current = true;
      setHistoryLoading(true);

      if (isManual) setRefreshing(true);
      else {
        const currentCount = messagesRef.current.length;
        setLoading((prev) => prev || (reset ? true : currentCount === 0));
      }

      try {
        setError(null);
        const page = await fetchGuestChannelHistoryPage({
          conversationId: activeConversationId,
          before,
        });
        if (String(activeConversationId || '').startsWith('ch#')) {
          setActiveChannelMeta(page.channelMeta || null);
        } else {
          setActiveChannelMeta(null);
        }
        if (reset) {
          setMessages(page.items);
          setHistoryHasMore(!!page.hasMore);
          setHistoryCursor(page.nextCursor);
        } else {
          // Merge older page into the list; if the page is all duplicates, stop paging to avoid
          // an infinite spinner loop (usually means cursor was stale or server ignored `before`).
          let appendedCount = 0;

          setMessages((prev) => {
            const r = appendUniqueById(prev, page.items);
            appendedCount = r.appendedCount;
            return r.merged;
          });

          if (page.items.length > 0 && appendedCount === 0) {
            setHistoryHasMore(false);
          } else {
            setHistoryHasMore(!!page.hasMore);
          }
          // Best-effort cursor: if we appended, next cursor is the last message's createdAt.
          if (appendedCount > 0) {
            setHistoryCursor(
              messagesRef.current.length
                ? messagesRef.current[messagesRef.current.length - 1].createdAt
                : null,
            );
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load messages';
        setError(msg);
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
        historyLoadingRef.current = false;
        setHistoryLoading(false);
      }
    },
    [activeConversationId],
  );

  const loadOlderHistory = React.useCallback(() => {
    if (!historyHasMore) return;
    // Fire and forget; guarded by historyLoadingRef.

    fetchHistoryPage({
      // Use the oldest currently-rendered message as the cursor.
      // This avoids stale `historyCursor` edge-cases (e.g., user taps "Load older" quickly).
      before: messagesRef.current.length
        ? messagesRef.current[messagesRef.current.length - 1].createdAt
        : historyCursor,
      reset: false,
    });
  }, [fetchHistoryPage, historyCursor, historyHasMore]);

  const refreshLatest = React.useCallback(async () => {
    if (historyLoadingRef.current) return;
    historyLoadingRef.current = true;
    setHistoryLoading(true);
    try {
      setError(null);
      const page = await fetchGuestChannelHistoryPage({
        conversationId: activeConversationId,
        before: null,
      });
      setMessages((prev) => {
        // Prepend newest, preserving existing order and removing dupes.
        return dedupeById(prependUniqueById(page.items, prev));
      });
      // IMPORTANT: do not reset cursor/hasMore during a "latest refresh" -
      // otherwise we can wipe paging state while the user is scrolling back.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load messages';
      setError(msg);
    } finally {
      historyLoadingRef.current = false;
      setHistoryLoading(false);
    }
  }, [activeConversationId]);

  const fetchNow = React.useCallback(
    async (fetchNowOpts?: { isManual?: boolean }) => {
      const isManual = !!fetchNowOpts?.isManual;
      if (isManual) {
        // Pull-to-refresh: fetch latest and merge (do NOT wipe older pages)
        await refreshLatest();
        return;
      }
      // Initial load: reset pagination.
      await fetchHistoryPage({ reset: true });
    },
    [fetchHistoryPage, refreshLatest],
  );

  // Initial load + reset on conversation change.
  React.useEffect(() => {
    fetchNow().catch(() => {});
  }, [fetchNow]);

  // Poll while the app is in the foreground.
  React.useEffect(() => {
    const intervalMs =
      typeof pollIntervalMs === 'number' && pollIntervalMs > 0 ? pollIntervalMs : 60_000;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const appStateRef = { current: AppState.currentState as AppStateStatus };

    const stop = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const start = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        refreshLatest().catch(() => {});
      }, intervalMs);
    };

    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') start();
      else stop();
    });

    if (appStateRef.current === 'active') start();

    return () => {
      stop();
      sub.remove();
    };
  }, [pollIntervalMs, refreshLatest]);

  return {
    messages,
    activeChannelMeta,
    loading,
    refreshing,
    error,
    setError,
    historyHasMore,
    historyLoading,
    loadOlderHistory,
    fetchNow,
  };
}
