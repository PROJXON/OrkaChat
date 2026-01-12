import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { applyTitleOverridesToUnreadMap, setTitleOverride } from '../../../utils/conversationTitles';
import type { ServerConversation, UnreadDmMap } from './useChatsInboxData';

type TitleOverrideRef = React.MutableRefObject<Record<string, string>>;

export function useConversationTitleChanged({
  conversationId,
  setPeer,
  setChannelNameById,
  titleOverrideByConvIdRef,
  setServerConversations,
  setUnreadDmMap,
  upsertDmThread,
}: {
  conversationId: string;
  setPeer: (v: string | null) => void;
  setChannelNameById: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  titleOverrideByConvIdRef: TitleOverrideRef;
  setServerConversations: React.Dispatch<React.SetStateAction<ServerConversation[]>>;
  setUnreadDmMap: React.Dispatch<React.SetStateAction<UnreadDmMap>>;
  upsertDmThread: (conversationId: string, title: string, lastActivityAt: number) => void;
}): { handleConversationTitleChanged: (convIdRaw: string, titleRaw: string) => void } {
  const handleConversationTitleChanged = React.useCallback(
    (convIdRaw: string, titleRaw: string) => {
      const convId = String(convIdRaw || '').trim();
      if (!convId || convId === 'global') return;
      const title = String(titleRaw || '').trim();
      if (!title) return;

      // Channels: update channelNameById so the header "Channel" label updates immediately.
      if (convId.startsWith('ch#')) {
        const channelId = convId.slice('ch#'.length).trim();
        if (channelId) {
          setChannelNameById((prev) => ({ ...prev, [channelId]: title }));
        }
      }

      // Persist local override so fetches won't overwrite the UI with stale server titles.
      titleOverrideByConvIdRef.current = setTitleOverride(titleOverrideByConvIdRef.current, convId, title);

      // Update current chat title if we're in it.
      if (conversationId === convId) {
        setPeer(title);
      }

      // Update server-backed conversations cache + DM threads list (best-effort).
      setServerConversations((prev) => {
        const next = prev.map((c) => (c.conversationId === convId ? { ...c, peerDisplayName: title } : c));
        try {
          AsyncStorage.setItem('conversations:cache:v1', JSON.stringify({ at: Date.now(), conversations: next })).catch(() => {});
        } catch {
          // ignore
        }
        return next;
      });

      // If there's a pending "Added to group: ..." unread label for this conversation, keep it in sync.
      setUnreadDmMap((prev) => {
        return applyTitleOverridesToUnreadMap(prev, { [convId]: title });
      });
      upsertDmThread(convId, title, Date.now());
    },
    [conversationId, setChannelNameById, setPeer, setServerConversations, setUnreadDmMap, titleOverrideByConvIdRef, upsertDmThread]
  );

  return { handleConversationTitleChanged };
}

