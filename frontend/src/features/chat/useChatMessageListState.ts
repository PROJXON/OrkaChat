import * as React from 'react';
import { Platform } from 'react-native';

import { useWebPinnedList, type WebPinnedListState } from '../../hooks/useWebPinnedList';
import { useWebSafeInvertedListData } from '../../hooks/useWebSafeInvertedListData';
import type { ChatMessage } from './types';

export function useChatMessageListState(opts: {
  messages: ChatMessage[];
  blockedSubsSet: Set<string>;
}): {
  visibleMessages: ChatMessage[];
  messageListData: ChatMessage[];
  webPinned: WebPinnedListState<ChatMessage>;
} {
  const { messages, blockedSubsSet } = opts;

  const visibleMessages = React.useMemo(
    () => messages.filter((m) => !(m.userSub && blockedSubsSet.has(String(m.userSub)))),
    [messages, blockedSubsSet],
  );

  const messageListData = useWebSafeInvertedListData(visibleMessages);

  // Web-only: since we render a non-inverted list (and reverse data), explicitly start at the bottom.
  const webPinned = useWebPinnedList<ChatMessage>({
    enabled: Platform.OS === 'web',
    itemCount: visibleMessages.length,
    // ChatScreen does its own "near top" handler below (it needs API_URL/history guards).
  });

  return { visibleMessages, messageListData, webPinned };
}
