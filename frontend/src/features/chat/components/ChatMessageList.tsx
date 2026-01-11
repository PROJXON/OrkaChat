import React from 'react';
import { FlatList, Platform } from 'react-native';
import { ChatHistoryLoadMore } from './ChatHistoryLoadMore';
import { ChatReadOnlyBanner } from './ChatReadOnlyBanner';

type Props = {
  styles: any;
  isDark: boolean;
  isWideChatLayout: boolean;

  API_URL: string | undefined;
  isGroup: boolean;
  groupStatus?: string;

  visibleMessagesCount: number;
  messageListData: Array<{ id: string }>;

  // Web pinned list wiring
  webReady: boolean;
  webOnLayout?: (e: unknown) => void;
  webOnContentSizeChange?: (w: number, h: number) => void;
  webOnScrollSync?: (e: unknown) => void;
  listRef: React.RefObject<any>;

  // History loading
  historyHasMore: boolean;
  historyLoading: boolean;
  loadOlderHistory: () => void;

  // Render item
  renderItem: (args: { item: any; index: number }) => React.ReactElement | null;
};

export function ChatMessageList({
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
}: Props) {
  const isWeb = Platform.OS === 'web';
  return (
    <FlatList
      style={[styles.messageList, isWeb && !webReady ? { opacity: 0 } : null]}
      data={messageListData as any}
      keyExtractor={(m: any) => String(m?.id)}
      inverted={!isWeb}
      ref={listRef as any}
      // Web-only pinned list wiring (avoid native layout feedback loops)
      onLayout={isWeb ? (webOnLayout as any) : undefined}
      onContentSizeChange={isWeb ? (webOnContentSizeChange as any) : undefined}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        // In the *inverted* (native) list, the header renders at the bottom near the composer.
        // In the non-inverted (web) list, the footer renders at the bottom.
        isWeb ? (
          API_URL ? (
            <ChatHistoryLoadMore
              isDark={isDark}
              hasMore={historyHasMore}
              loading={historyLoading}
              isEmpty={visibleMessagesCount === 0}
              onPress={loadOlderHistory}
            />
          ) : null
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
          isGroup && groupStatus && groupStatus !== 'active' ? (
            <ChatReadOnlyBanner isDark={isDark} status={groupStatus} />
          ) : null
        ) : API_URL ? (
          <ChatHistoryLoadMore
            isDark={isDark}
            hasMore={historyHasMore}
            loading={historyLoading}
            isEmpty={visibleMessagesCount === 0}
            onPress={loadOlderHistory}
          />
        ) : null
      }
      onScroll={isWeb ? (webOnScrollSync as any) : undefined}
      scrollEventThrottle={isWeb ? 16 : undefined}
      // Perf tuning (especially on Android):
      removeClippedSubviews={Platform.OS === 'android'}
      initialNumToRender={18}
      maxToRenderPerBatch={12}
      updateCellsBatchingPeriod={50}
      windowSize={7}
      renderItem={renderItem as any}
      contentContainerStyle={[styles.listContent, isWideChatLayout ? styles.chatContentColumn : null]}
    />
  );
}
