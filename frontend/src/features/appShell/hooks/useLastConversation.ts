import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import type { ServerConversation, UnreadDmMap } from './useChatsInboxData';

function isValidConversationId(v: string): boolean {
  if (!v) return false;
  if (v === 'global') return true;
  return v.startsWith('ch#') || v.startsWith('dm#') || v.startsWith('gdm#');
}

function getDeviceStorageKey(): string {
  // Device-scoped fallback so we can restore immediately even before user attrs rehydrate.
  return 'ui:lastConversationId:device';
}

function getUserStorageKey(userSub: string | null | undefined): string | null {
  const u = typeof userSub === 'string' ? userSub.trim() : '';
  if (!u) return null;
  return `ui:lastConversationId:${u}`;
}

function bestEffortPeerTitle(opts: {
  conversationId: string;
  serverConversations: ServerConversation[];
  unreadDmMap: UnreadDmMap;
}): string {
  const { conversationId, serverConversations, unreadDmMap } = opts;
  const server = serverConversations.find((c) => c.conversationId === conversationId);
  const cached = unreadDmMap[conversationId];
  const kind =
    (typeof server?.conversationKind === 'string' ? server.conversationKind : undefined) ||
    (conversationId.startsWith('gdm#')
      ? 'group'
      : conversationId.startsWith('dm#')
        ? 'dm'
        : undefined);
  const serverTitle = server?.peerDisplayName != null ? String(server.peerDisplayName).trim() : '';
  const cachedTitle = cached?.user != null ? String(cached.user).trim() : '';
  const fallbackTitle = kind === 'group' ? 'Group DM' : 'Direct Message';
  return serverTitle || cachedTitle || fallbackTitle;
}

async function readCachedConversationTitle(conversationId: string): Promise<string> {
  const convId = String(conversationId || '').trim();
  if (!convId) return '';

  // 1) conversations cache (best for groups; also includes dm peer names)
  try {
    const raw = await AsyncStorage.getItem('conversations:cache:v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      const convos = Array.isArray(parsed?.conversations) ? parsed.conversations : [];
      const hit = convos.find((c: unknown) => {
        const rec = typeof c === 'object' && c != null ? (c as Record<string, unknown>) : {};
        return String(rec.conversationId || '').trim() === convId;
      });
      const rec = typeof hit === 'object' && hit != null ? (hit as Record<string, unknown>) : {};
      const t = typeof rec.peerDisplayName === 'string' ? String(rec.peerDisplayName).trim() : '';
      if (t) return t;
    }
  } catch {
    // ignore
  }

  // 2) dm threads cache (local-only inbox)
  try {
    const raw = await AsyncStorage.getItem('dm:threads:v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      const info =
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, { peer?: unknown }>)[convId]
          : undefined;
      const t = typeof info?.peer === 'string' ? String(info.peer).trim() : '';
      if (t) return t;
    }
  } catch {
    // ignore
  }

  return '';
}

export function useLastConversation({
  userSub,
  conversationId,
  setConversationId,
  setPeer,
  serverConversations,
  unreadDmMap,
}: {
  userSub: string | null;
  conversationId: string;
  setConversationId: React.Dispatch<React.SetStateAction<string>>;
  setPeer: React.Dispatch<React.SetStateAction<string | null>>;
  serverConversations: ServerConversation[];
  unreadDmMap: UnreadDmMap;
}): { conversationRestoreDone: boolean } {
  const [conversationRestoreDone, setConversationRestoreDone] = React.useState<boolean>(false);
  const latestConversationIdRef = React.useRef<string>(conversationId);

  React.useEffect(() => {
    latestConversationIdRef.current = conversationId;
  }, [conversationId]);

  // Restore last visited conversation on boot (channels + DMs).
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const userKey = getUserStorageKey(userSub);
        const raw =
          (userKey ? await AsyncStorage.getItem(userKey) : null) ||
          (await AsyncStorage.getItem(getDeviceStorageKey()));
        const v = typeof raw === 'string' ? raw.trim() : '';
        if (!mounted) return;
        if (!isValidConversationId(v)) return;

        const current = String(latestConversationIdRef.current || '').trim() || 'global';
        // If something already put us into a DM (e.g. opened-from-notification), don't override it.
        if (current.startsWith('dm#') || current.startsWith('gdm#')) return;

        // Otherwise, prefer restoring the last conversation (including DMs) over default channel.
        setConversationId(() => v);

        if (v.startsWith('dm#') || v.startsWith('gdm#')) {
          const immediate = bestEffortPeerTitle({
            conversationId: v,
            serverConversations,
            unreadDmMap,
          });
          if (immediate && immediate !== 'Direct Message' && immediate !== 'Group DM') {
            setPeer(() => immediate);
          } else {
            const cachedTitle = await readCachedConversationTitle(v);
            const fallback = v.startsWith('gdm#') ? 'Group DM' : 'Direct Message';
            setPeer(() => cachedTitle || immediate || fallback);
          }
        } else {
          setPeer(() => null);
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setConversationRestoreDone(true);
      }
    })();
    // Important: only re-run when identity changes (so switching accounts restores that account's last view).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSub]);

  // Persist last visited conversation (best-effort).
  React.useEffect(() => {
    const v = String(conversationId || '').trim();
    if (!isValidConversationId(v)) return;
    (async () => {
      try {
        await AsyncStorage.setItem(getDeviceStorageKey(), v);
      } catch {
        // ignore
      }
      try {
        const userKey = getUserStorageKey(userSub);
        if (userKey) await AsyncStorage.setItem(userKey, v);
      } catch {
        // ignore
      }
    })();
  }, [conversationId, userSub]);

  return { conversationRestoreDone };
}
