import * as React from 'react';

export function useDmUnreadsAndPush({
  user,
  conversationId,
  setConversationId,
  setPeer,
  setSearchOpen,
  setPeerInput,
  setSearchError,
  setChannelNameById,

  unreadDmMap,
  setUnreadDmMap,
  upsertDmThread,
  fetchUnreads,
  registerForDmPushNotifications,
}: {
  user: unknown;
  conversationId: string;
  setConversationId: (v: string) => void;
  setPeer: (v: string | null) => void;
  setSearchOpen: (v: boolean) => void;
  setPeerInput: (v: string) => void;
  setSearchError: (v: string | null) => void;
  setChannelNameById: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  unreadDmMap: Record<string, { user: string; count: number; senderSub?: string }>;
  setUnreadDmMap: React.Dispatch<
    React.SetStateAction<Record<string, { user: string; count: number; senderSub?: string }>>
  >;
  upsertDmThread: (convId: string, peerName: string, lastActivityAt?: number) => void;
  fetchUnreads: () => Promise<void>;
  registerForDmPushNotifications: () => Promise<{ ok: boolean; reason?: string }>;
}): {
  hasUnreadDms: boolean;
  unreadEntries: Array<[string, { user: string; count: number; senderSub?: string }]>;
  handleNewDmNotification: (newConversationId: string, sender: string, senderSub?: string) => void;
} {
  // Best-effort: register DM push token after login (Signal-like: sender name only, no message preview).
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user) return;
        const res = await registerForDmPushNotifications();
        if (!mounted) return;
        if (!res.ok) {
          // Avoid spamming a modal; this should be transparent unless debugging.
          console.log('push registration skipped/failed:', res.reason || 'unknown');
        }
      } catch (err) {
        console.log('push registration error:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [registerForDmPushNotifications, user]);

  const hasUnreadDms = Object.keys(unreadDmMap).length > 0;
  const unreadEntries = React.useMemo(() => Object.entries(unreadDmMap), [unreadDmMap]);

  // Handle taps on OS notifications to jump into the DM.
  React.useEffect(() => {
    type NotificationSubscription = { remove: () => void };
    let sub: NotificationSubscription | null = null;
    try {
      const NotificationsModule = require('expo-notifications') as unknown;
      const addListener =
        typeof NotificationsModule === 'object' &&
        NotificationsModule != null &&
        'addNotificationResponseReceivedListener' in NotificationsModule &&
        typeof (NotificationsModule as Record<string, unknown>).addNotificationResponseReceivedListener === 'function'
          ? ((NotificationsModule as Record<string, unknown>).addNotificationResponseReceivedListener as (cb: (resp: unknown) => void) => NotificationSubscription)
          : null;
      if (!addListener) return;
      sub = addListener((resp: unknown) => {
        const rec = typeof resp === 'object' && resp != null ? (resp as Record<string, unknown>) : {};
        const notification = typeof rec.notification === 'object' && rec.notification != null ? (rec.notification as Record<string, unknown>) : {};
        const request = typeof notification.request === 'object' && notification.request != null ? (notification.request as Record<string, unknown>) : {};
        const content = typeof request.content === 'object' && request.content != null ? (request.content as Record<string, unknown>) : {};
        const data = typeof content.data === 'object' && content.data != null ? (content.data as Record<string, unknown>) : {};
        const kind = typeof data.kind === 'string' ? data.kind : '';
        const convId = typeof data.conversationId === 'string' ? data.conversationId : '';
        const senderName = typeof data.senderDisplayName === 'string' ? data.senderDisplayName : '';
        if ((kind === 'dm' || kind === 'group') && convId) {
          setSearchOpen(false);
          setPeerInput('');
          setSearchError(null);
          setConversationId(convId);
          setPeer(senderName || (kind === 'group' ? 'Group DM' : 'Direct Message'));
          return;
        }
        if ((kind === 'channelMention' || kind === 'channelReply') && convId && convId.startsWith('ch#')) {
          const channelName = typeof data.channelName === 'string' ? data.channelName : '';
          const channelId = convId.slice('ch#'.length).trim();
          if (channelId && channelName.trim()) {
            setChannelNameById((prev) => ({ ...prev, [channelId]: channelName.trim() }));
          }
          setSearchOpen(false);
          setPeerInput('');
          setSearchError(null);
          setPeer(null);
          setConversationId(convId);
        }
      });
    } catch {
      // expo-notifications not installed / dev client not rebuilt
    }
    return () => {
      try {
        sub?.remove();
      } catch {
        // ignore
      }
    };
    // Intentionally []: setState functions are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewDmNotification = React.useCallback(
    (newConversationId: string, sender: string, senderSub?: string) => {
      setUnreadDmMap((prev) => {
        if (!newConversationId || newConversationId === 'global') return prev;
        if (newConversationId === conversationId) return prev;
        const existing = prev[newConversationId];
        const next = { ...prev };
        next[newConversationId] = {
          user: sender || existing?.user || 'someone',
          senderSub: senderSub || existing?.senderSub,
          count: (existing?.count ?? 0) + 1,
        };
        return next;
      });
      if (newConversationId && newConversationId !== 'global') {
        upsertDmThread(newConversationId, sender || 'Direct Message', Date.now());
      }
    },
    [conversationId, setUnreadDmMap, upsertDmThread]
  );

  React.useEffect(() => {
    if (!conversationId) return;
    // Only clear unread badges for DM / group DM conversations.
    if (!(conversationId.startsWith('dm#') || conversationId.startsWith('gdm#'))) return;
    setUnreadDmMap((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, [conversationId, setUnreadDmMap]);

  // Hydrate unread DMs on login so the badge survives logout/login.
  React.useEffect(() => {
    if (!user) return;
    void fetchUnreads();
  }, [fetchUnreads, user]);

  return { hasUnreadDms, unreadEntries, handleNewDmNotification };
}

