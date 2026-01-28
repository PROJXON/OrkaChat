import React from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlatList, Platform, View } from 'react-native';

import type { ChatScreenStyles } from '../../../screens/ChatScreen.styles';
import { ChatHistoryLoadMore } from './ChatHistoryLoadMore';
import { ChatReadOnlyBanner } from './ChatReadOnlyBanner';

type Props<T extends { id: string }> = {
  styles: ChatScreenStyles;
  isDark: boolean;
  isWideChatLayout: boolean;

  API_URL: string | undefined;
  isGroup: boolean;
  groupStatus?: string;

  visibleMessagesCount: number;
  messageListData: T[];

  // Web pinned list wiring
  webReady: boolean;
  webOnLayout?: (e: LayoutChangeEvent) => void;
  webOnContentSizeChange?: (w: number, h: number) => void;
  webOnScrollSync?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  listRef: React.RefObject<FlatList<T> | null>;

  // History loading
  historyHasMore: boolean;
  historyLoading: boolean;
  loadOlderHistory: () => void;

  // Render item
  renderItem: (args: { item: T; index: number }) => React.ReactElement | null;
};

export function ChatMessageList<T extends { id: string }>({
  styles,
  isDark,
  isWideChatLayout,
  API_URL,
  isGroup,
  groupStatus,
  visibleMessagesCount,
  messageListData,
  webReady,
  webOnLayout,
  webOnContentSizeChange,
  webOnScrollSync,
  listRef,
  historyHasMore,
  historyLoading,
  loadOlderHistory,
  renderItem,
}: Props<T>) {
  const isWeb = Platform.OS === 'web';
  const isEmpty = visibleMessagesCount === 0;
  const showEmptyCta = !!API_URL && isEmpty;
  return (
    <FlatList
      // Web: don't hide the list when it's empty; otherwise the empty CTA can be hidden forever
      // if the pinned-list "ready" signal is delayed.
      style={[
        styles.messageList,
        isWeb && !webReady && visibleMessagesCount > 0 ? { opacity: 0 } : null,
      ]}
      data={messageListData}
      keyExtractor={(m) => String(m?.id)}
      inverted={!isWeb}
      ref={listRef}
      // Web-only pinned list wiring (avoid native layout feedback loops)
      onLayout={isWeb ? webOnLayout : undefined}
      onContentSizeChange={isWeb ? webOnContentSizeChange : undefined}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        // In the *inverted* (native) list, the header renders at the bottom near the composer.
        // In the non-inverted (web) list, the footer renders at the bottom.
        isWeb ? (
          // Web: load-older affordance belongs at the top.
          !isEmpty && API_URL ? (
            <ChatHistoryLoadMore
              isDark={isDark}
              hasMore={historyHasMore}
              loading={historyLoading}
              isEmpty={false}
              onPress={loadOlderHistory}
            />
          ) : null
        ) : showEmptyCta ? (
          // Native: when empty, keep the CTA near the composer at the bottom.
          <ChatHistoryLoadMore
            isDark={isDark}
            hasMore={false}
            loading={false}
            isEmpty
            onPress={loadOlderHistory}
          />
        ) : isGroup && groupStatus && groupStatus !== 'active' ? (
          <ChatReadOnlyBanner isDark={isDark} status={groupStatus} />
        ) : null
      }
      onEndReached={
        isWeb
          ? undefined
          : () => {
              if (!API_URL) return;
              if (!historyHasMore) return;
              if (historyLoading) return;
              loadOlderHistory();
            }
      }
      onEndReachedThreshold={0.2}
      ListFooterComponent={
        isWeb ? (
          showEmptyCta || (isGroup && groupStatus && groupStatus !== 'active') ? (
            <View>
              {isGroup && groupStatus && groupStatus !== 'active' ? (
                <ChatReadOnlyBanner isDark={isDark} status={groupStatus} />
              ) : null}
              {showEmptyCta ? (
                <ChatHistoryLoadMore
                  isDark={isDark}
                  hasMore={false}
                  loading={false}
                  isEmpty
                  onPress={loadOlderHistory}
                />
              ) : null}
            </View>
          ) : null
        ) : API_URL && !isEmpty ? (
          // Native: footer sits at the top (older messages) for inverted lists.
          // When empty we render the CTA in the header instead.
          <ChatHistoryLoadMore
            isDark={isDark}
            hasMore={historyHasMore}
            loading={historyLoading}
            isEmpty={false}
            onPress={loadOlderHistory}
          />
        ) : null
      }
      onScroll={isWeb ? webOnScrollSync : undefined}
      scrollEventThrottle={isWeb ? 16 : undefined}
      // Perf tuning (especially on Android):
      removeClippedSubviews={Platform.OS === 'android'}
      initialNumToRender={18}
      maxToRenderPerBatch={12}
      updateCellsBatchingPeriod={50}
      windowSize={7}
      renderItem={renderItem}
      contentContainerStyle={[
        styles.listContent,
        isWideChatLayout ? styles.chatContentColumn : null,
        // When the list is empty on web (non-inverted), push the empty-state down
        // so it sits above the composer like on mobile.
        isWeb && isEmpty ? ({ flexGrow: 1, justifyContent: 'flex-end' } as const) : null,
      ]}
    />
  );
}
