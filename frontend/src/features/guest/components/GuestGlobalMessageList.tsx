import React from 'react';
import { FlatList, Platform, RefreshControl, Text, View } from 'react-native';

import { AnimatedDots } from '../../../components/AnimatedDots';
import { ChatHistoryLoadMore } from '../../chat/components/ChatHistoryLoadMore';
import { renderGuestListItem } from '../renderGuestListItem';

export function GuestGlobalMessageList({
  apiUrl,
  isDark,
  isWideUi,
  viewportWidth,
  styles,
  // Data
  messages,
  messageListData,
  // Error/loading
  error,
  loading,
  refreshing,
  fetchNow,
  // History paging
  historyHasMore,
  historyLoading,
  loadOlderHistory,
  // Web pinned list helpers
  webPinned,
  webWheelRefresh,
  // Render helpers
  avatarProfileBySub,
  cdnGet,
  requestOpenLink,
  resolvePathUrl,
  openReactionInfo,
  openViewer,
}: {
  apiUrl: string;
  isDark: boolean;
  isWideUi: boolean;
  viewportWidth: number;
  styles: any;

  messages: any[];
  messageListData: any[];

  error: string | null;
  loading: boolean;
  refreshing: boolean;
  fetchNow: (args: { isManual: boolean }) => void | Promise<void>;

  historyHasMore: boolean;
  historyLoading: boolean;
  loadOlderHistory: () => void | Promise<void>;

  webPinned: any;
  webWheelRefresh: any;

  avatarProfileBySub: Record<string, any>;
  cdnGet: (path: string) => string;
  requestOpenLink: (url: string) => void;
  resolvePathUrl: (path: string) => Promise<string | null>;
  openReactionInfo: (emoji: string, subs: string[], namesBySub?: Record<string, string>) => void;
  openViewer: (args: any) => void;
}): React.JSX.Element {
  const isWeb = Platform.OS === 'web';
  return (
    <>
      {error ? (
        <Text style={[styles.errorText, isDark && styles.errorTextDark, isWideUi ? styles.contentColumn : null]} numberOfLines={3}>
          {error}
        </Text>
      ) : null}

      {loading && messages.length === 0 ? (
        <View style={[styles.loadingWrap, isWideUi ? styles.contentColumn : null]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: isDark ? '#d7d7e0' : '#555', fontWeight: '700', fontSize: 14 }}>Loading</Text>
            <AnimatedDots color={isDark ? '#d7d7e0' : '#555'} size={16} />
          </View>
        </View>
      ) : null}

      {/* Keep the scroll container full-width so the web scrollbar stays at the window edge.
          Center the *content* via FlatList.contentContainerStyle instead. */}
      <View style={{ flex: 1 }} {...(webWheelRefresh as any)}>
        <FlatList
          style={{ flex: 1, opacity: isWeb && !webPinned.ready ? 0 : 1 }}
          data={messageListData}
          keyExtractor={(m: any) => m.id}
          inverted={!isWeb}
          ref={webPinned.listRef as any}
          // Web-only pinned list wiring (avoid native layout feedback loops)
          onLayout={isWeb ? (webPinned.onLayout as any) : undefined}
          onContentSizeChange={isWeb ? (webPinned.onContentSizeChange as any) : undefined}
          keyboardShouldPersistTaps="handled"
          onEndReached={
            isWeb
              ? undefined
              : () => {
                  if (!apiUrl) return;
                  if (!historyHasMore) return;
                  if (historyLoading) return;
                  loadOlderHistory();
                }
          }
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            isWeb ? null : apiUrl ? (
              <ChatHistoryLoadMore
                isDark={isDark}
                hasMore={historyHasMore}
                loading={historyLoading}
                isEmpty={messages.length === 0}
                emptyText="Sign in to Start the Conversation!"
                noMoreText="No Older Messages"
                enablePressedOpacity
                onPress={loadOlderHistory}
              />
            ) : null
          }
          contentContainerStyle={[styles.listContent, isWideUi ? styles.contentColumn : null]}
          // For web (non-inverted), load older history when the user scrolls to the top.
          onScroll={isWeb ? (webPinned.onScroll as any) : undefined}
          scrollEventThrottle={isWeb ? 16 : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNow({ isManual: true })}
              tintColor={isDark ? '#ffffff' : '#111'}
            />
          }
          renderItem={({ item, index }) =>
            renderGuestListItem({
              item,
              index,
              messageListData,
              isDark,
              viewportWidth,
              avatarProfileBySub,
              cdnGet,
              requestOpenLink,
              resolvePathUrl,
              openReactionInfo,
              openViewer,
            })
          }
        />
      </View>
    </>
  );
}

