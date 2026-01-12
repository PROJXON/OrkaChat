import * as React from 'react';

import type { ServerConversation, UnreadDmMap } from './useChatsInboxData';

export function useConversationNavigation({
  serverConversations,
  unreadDmMap,
  peer,
  upsertDmThread,
  setConversationId,
  setPeer,
  setSearchOpen,
  setPeerInput,
  setSearchError,
  // Channels UI resetters (so switching to channels/global clears DM search + channel modals)
  setChannelsOpen,
  setChannelSearchOpen,
  setChannelsError,
  setChannelJoinError,
  setChannelsQuery,
}: {
  serverConversations: ServerConversation[];
  unreadDmMap: UnreadDmMap;
  peer: string | null;
  upsertDmThread: (conversationId: string, title: string, lastActivityAt: number) => void;
  setConversationId: (v: string) => void;
  setPeer: (v: string | null) => void;
  setSearchOpen: (v: boolean) => void;
  setPeerInput: (v: string) => void;
  setSearchError: (v: string | null) => void;
  setChannelsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setChannelSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setChannelsError: React.Dispatch<React.SetStateAction<string | null>>;
  setChannelJoinError: React.Dispatch<React.SetStateAction<string | null>>;
  setChannelsQuery: React.Dispatch<React.SetStateAction<string>>;
}): {
  goToConversation: (targetConversationId: string) => void;
} {
  const goToConversation = React.useCallback(
    (targetConversationId: string) => {
      if (!targetConversationId) return;
      setConversationId(targetConversationId);

      if (targetConversationId === 'global' || String(targetConversationId).startsWith('ch#')) {
        setPeer(null);
        setSearchOpen(false);
        setPeerInput('');
        setSearchError(null);
        setChannelsOpen(false);
        setChannelSearchOpen(false);
        setChannelsError(null);
        setChannelJoinError(null);
        setChannelsQuery('');
        return;
      }

      // Best-effort title selection:
      // 1) server conversations (authoritative titles for groups + DMs)
      // 2) unread cache (push/unreads can provide a title)
      // 3) fallback by kind
      const server = serverConversations.find((c) => c.conversationId === targetConversationId);
      const cached = unreadDmMap[targetConversationId];
      const kind =
        (typeof server?.conversationKind === 'string' ? server.conversationKind : undefined) ||
        (String(targetConversationId || '').startsWith('gdm#')
          ? 'group'
          : String(targetConversationId || '').startsWith('dm#')
            ? 'dm'
            : undefined);
      const serverTitle = server?.peerDisplayName != null ? String(server.peerDisplayName).trim() : '';
      const cachedTitle = cached?.user != null ? String(cached.user).trim() : '';
      const fallbackTitle = targetConversationId === 'global' ? '' : kind === 'group' ? 'Group DM' : 'Direct Message';
      const title = serverTitle || cachedTitle || fallbackTitle;

      if (targetConversationId === 'global') setPeer(null);
      else setPeer(title || (kind === 'group' ? 'Group DM' : 'Direct Message'));

      if (targetConversationId !== 'global') {
        upsertDmThread(targetConversationId, title || peer || (kind === 'group' ? 'Group DM' : 'Direct Message'), Date.now());
      }

      setSearchOpen(false);
      setPeerInput('');
      setSearchError(null);
    },
    [
      peer,
      serverConversations,
      setChannelJoinError,
      setChannelSearchOpen,
      setChannelsError,
      setChannelsOpen,
      setChannelsQuery,
      setConversationId,
      setPeer,
      setPeerInput,
      setSearchError,
      setSearchOpen,
      unreadDmMap,
      upsertDmThread,
    ]
  );

  return { goToConversation };
}

