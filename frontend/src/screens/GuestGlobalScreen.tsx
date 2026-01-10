import React from 'react';
import {
  FlatList,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../config/env';
import { CDN_URL } from '../config/env';
import { useCdnUrlCache } from '../hooks/useCdnUrlCache';
import { useConfirmLinkModal } from '../hooks/useConfirmLinkModal';
import { useStoredTheme } from '../hooks/useStoredTheme';
import { useViewportWidth } from '../hooks/useViewportWidth';
import { useMenuAnchor } from '../hooks/useMenuAnchor';
import { useWebPinnedList } from '../hooks/useWebPinnedList';
import { usePublicAvatarProfiles } from '../hooks/usePublicAvatarProfiles';
import { useResolveCdnPathUrl } from '../hooks/useResolveCdnPathUrl';
import Feather from '@expo/vector-icons/Feather';
import { HeaderMenuModal } from '../components/HeaderMenuModal';
import { AnimatedDots } from '../components/AnimatedDots';
import { MediaViewerModal } from '../components/MediaViewerModal';
import { RichText } from '../components/RichText';
import { GlobalAboutContent } from '../components/globalAbout/GlobalAboutContent';
import { ThemeToggleRow } from '../components/ThemeToggleRow';
import { AppBrandIcon } from '../components/AppBrandIcon';
import { GLOBAL_ABOUT_VERSION } from '../utils/globalAbout';
import type { MediaItem } from '../types/media';
import { useUiPromptHelpers } from '../hooks/useUiPromptHelpers';
import { useGlobalAboutOncePerVersion } from '../features/globalAbout/useGlobalAboutOncePerVersion';
import { useGuestChannelHistory } from '../features/guest/useGuestChannelHistory';
import { ChatHistoryLoadMore } from '../features/chat/components/ChatHistoryLoadMore';
import { ReactionInfoModal } from '../features/chat/components/ReactionInfoModal';
import { renderGuestListItem } from '../features/guest/renderGuestListItem';
import { markChannelAboutSeen } from '../utils/channelAboutSeen';
import { useAutoPopupChannelAbout } from '../hooks/useAutoPopupChannelAbout';
import { guestReactionInfoModalStyles, styles } from './GuestGlobalScreen.styles';
import { useGuestChannelSearch } from '../features/guest/useGuestChannelSearch';
import { GuestChannelPickerModal } from '../features/guest/components/GuestChannelPickerModal';
import { useWebSafeInvertedListData } from '../hooks/useWebSafeInvertedListData';
import { useReactionInfo } from '../hooks/useReactionInfo';
import { useMediaViewer } from '../hooks/useMediaViewer';
import { useOpenGlobalViewer } from '../hooks/useOpenGlobalViewer';
import { useGuestChannelAboutModalActions } from '../features/guest/useGuestChannelAboutModalActions';
import { useWebWheelRefresh } from '../hooks/useWebWheelRefresh';
import { useGuestRequestSignIn } from '../features/guest/useGuestRequestSignIn';

export default function GuestGlobalScreen({ onSignIn }: { onSignIn: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { isWide: isWideUi, viewportWidth } = useViewportWidth(windowWidth, { wideBreakpointPx: 900, maxContentWidthPx: 1040 });
  const { theme, setTheme, isDark } = useStoredTheme({});

  // --- Guest onboarding (Option A + C) ---
  // Global About is code-defined + versioned. Show once per version; About menu reopens it.
  const { globalAboutOpen, setGlobalAboutOpen, dismissGlobalAbout } = useGlobalAboutOncePerVersion(GLOBAL_ABOUT_VERSION);
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const menu = useMenuAnchor();

  // theme persistence handled by useStoredTheme

  // (Global About auto-popup + persist dismiss handled by shared hook)

  const [activeConversationId, setActiveConversationId] = React.useState<string>('global');
  const [activeChannelTitle, setActiveChannelTitle] = React.useState<string>('Global');
  const [channelPickerOpen, setChannelPickerOpen] = React.useState<boolean>(false);
  const [channelQuery, setChannelQuery] = React.useState<string>('');
  const { loading: channelListLoading, error: channelListError, globalUserCount, results: channelResults } =
    useGuestChannelSearch({ apiUrl: API_URL, enabled: channelPickerOpen, query: channelQuery, debounceMs: 150 });
  const { showAlert } = useUiPromptHelpers();

  // Web-only: since we render a non-inverted list (and reverse data), explicitly start at the bottom.

  const {
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
  } = useGuestChannelHistory({ activeConversationId, pollIntervalMs: 60_000 });
  const cdn = useCdnUrlCache(CDN_URL);
  const { resolvePathUrl } = useResolveCdnPathUrl(cdn);
  // How quickly we’ll re-check guest profile avatars for updates (tradeoff: freshness vs API calls).
  const AVATAR_PROFILE_TTL_MS = 60_000;
  const wantedAvatarSubs = React.useMemo(
    () => messages.map((m) => (m?.userSub ? String(m.userSub) : '')),
    [messages],
  );
  const { avatarProfileBySub } = usePublicAvatarProfiles({
    apiUrl: API_URL,
    subs: wantedAvatarSubs,
    ttlMs: AVATAR_PROFILE_TTL_MS,
    cdn,
  });
  const reactionInfo = useReactionInfo({
    // Guest already passes the exact ordering and names map from the renderer.
  });

  const viewer = useMediaViewer<{
    mode: 'global';
    index: number;
    globalItems: Array<{ url: string; kind: 'image' | 'video' | 'file'; fileName?: string }>;
  }>({
    getSaveItem: (vs) => {
      if (!vs || (vs as any).mode !== 'global') return null;
      const item = (vs as any).globalItems?.[(vs as any).index] ?? null;
      if (!item?.url) return null;
      return { url: String(item.url), kind: item.kind, fileName: item.fileName };
    },
    onError: (msg) => {
      // Keep UX aligned with signed-in viewer: don't interrupt with alerts.
      try {
        console.warn('Guest save failed', msg);
      } catch {}
    },
  });

  const { requestOpenLink, closeConfirmLink, confirmLinkModal } = useConfirmLinkModal(isDark);

  const requestSignIn = useGuestRequestSignIn({
    onSignIn,
    setMenuOpen,
    setChannelPickerOpen,
    setReactionInfoOpen: reactionInfo.setOpen,
    closeViewer: viewer.close,
    closeConfirmLink,
  });

  const isChannel = React.useMemo(() => String(activeConversationId || '').startsWith('ch#'), [activeConversationId]);
  const activeChannelId = React.useMemo(
    () => (isChannel ? String(activeConversationId).slice('ch#'.length).trim() : ''),
    [isChannel, activeConversationId],
  );

  const messageListData = useWebSafeInvertedListData(messages);

  const webPinned = useWebPinnedList({
    enabled: Platform.OS === 'web',
    itemCount: messages.length,
    canLoadMore: () => !!API_URL && !!historyHasMore && !historyLoading,
    onNearTop: () => loadOlderHistory(),
  });

  const webWheelRefresh = useWebWheelRefresh({
    enabled: Platform.OS === 'web',
    atBottomRef: webPinned.atBottomRef,
    refreshing,
    cooldownMs: 900,
    onRefresh: () => fetchNow({ isManual: true }),
  });

  const openReactionInfo = React.useCallback(
    (emoji: string, subs: string[], namesBySub?: Record<string, string>) => {
      void reactionInfo.openReactionInfo({
        emoji,
        subs,
        namesBySub: namesBySub && typeof namesBySub === 'object' ? namesBySub : {},
      });
    },
    [reactionInfo],
  );

  const openViewer = useOpenGlobalViewer({
    // In guest mode we resolve the tapped item's path directly (no fallback path available here).
    resolveUrlForPath: (path) => resolvePathUrl(String(path)),
    includeFilesInViewer: false,
    openExternalIfFile: true,
    openExternalUrl: (url) => Linking.openURL(url),
    viewer,
  });

  const reactionNameBySub = React.useMemo(() => {
    return reactionInfo.subs.reduce((acc: Record<string, string>, sub) => {
      const name = reactionInfo.namesBySub[sub];
      acc[sub] = name ? String(name) : String(sub);
      return acc;
    }, {});
  }, [reactionInfo.subs, reactionInfo.namesBySub]);

  const [channelAboutOpen, setChannelAboutOpen] = React.useState<boolean>(false);
  const [channelAboutText, setChannelAboutText] = React.useState<string>('');
  const guestChannelAboutModal = useGuestChannelAboutModalActions({
    activeChannelId,
    aboutVersion:
      typeof activeChannelMeta?.aboutVersion === 'number' && Number.isFinite(activeChannelMeta.aboutVersion)
        ? activeChannelMeta.aboutVersion
        : 0,
    markChannelAboutSeen,
    setChannelAboutOpen,
  });

  // Auto-popup Channel About for guests on first enter or whenever aboutVersion changes.
  useAutoPopupChannelAbout({
    enabled: isChannel,
    scope: 'guest',
    channelId: String(activeChannelId || '').trim(),
    aboutText: typeof activeChannelMeta?.aboutText === 'string' ? String(activeChannelMeta.aboutText) : '',
    aboutVersion:
      typeof activeChannelMeta?.aboutVersion === 'number' && Number.isFinite(activeChannelMeta.aboutVersion)
        ? activeChannelMeta.aboutVersion
        : 0,
    onOpen: () => {
      const aboutText = typeof activeChannelMeta?.aboutText === 'string' ? String(activeChannelMeta.aboutText) : '';
      setChannelAboutText(aboutText);
      setChannelAboutOpen(true);
    },
  });

  return (
    // App.tsx already applies the top safe area. Avoid double top inset here (dead space).
    <SafeAreaView
      style={[styles.container, isDark && styles.containerDark]}
      // Web: ignore safe-area left/right insets (they can be misreported as ~42px and flip with rotation).
      edges={Platform.OS === 'web' ? [] : ['left', 'right']}
    >
      <View style={[styles.headerRow, isDark && styles.headerRowDark]}>
        <View style={[styles.headerRowContent, isWideUi ? styles.contentColumn : null]}>
          <Pressable
            onPress={() => {
              setChannelQuery('');
              setChannelPickerOpen(true);
            }}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 2 },
              pressed ? { opacity: 0.9 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Browse channels"
          >
            <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]} numberOfLines={1}>
              {activeChannelTitle}
            </Text>
            <Feather name="chevron-down" size={16} color={isDark ? '#fff' : '#111'} />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable
              ref={menu.ref}
              onPress={() => {
                menu.openFromRef({ enabled: isWideUi, onOpen: () => setMenuOpen(true) });
              }}
              style={({ pressed }) => [
                styles.menuIconBtn,
                isDark && styles.menuIconBtnDark,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <AppBrandIcon isDark={isDark} fit="contain" slotWidth={32} slotHeight={32} accessible={false} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Ensure the message list never overlaps the header on Android touch layers. */}
      <View style={{ flex: 1, alignSelf: 'stretch' }}>
        <HeaderMenuModal
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={undefined}
          isDark={isDark}
          cardWidth={160}
          anchor={isWideUi ? menu.anchor : null}
          headerRight={
            <ThemeToggleRow isDark={isDark} onSetTheme={setTheme} styles={styles} />
          }
          items={[
            {
              key: 'about',
              label: 'About',
              onPress: () => {
                setMenuOpen(false);
                if (isChannel) {
                  // In guest mode, About should reflect the current channel (if any).
                  setChannelAboutText(String(activeChannelMeta?.aboutText || ''));
                  setChannelAboutOpen(true);
                  return;
                }
                // Global About
                setGlobalAboutOpen(true);
              },
            },
            {
              key: 'signin',
              label: 'Sign in',
              onPress: () => {
                setMenuOpen(false);
                requestSignIn();
              },
            },
          ]}
        />

        <Modal
          visible={channelAboutOpen}
          transparent
          animationType="fade"
          onRequestClose={guestChannelAboutModal.onRequestClose}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={guestChannelAboutModal.onBackdropPress}
            />
            <View style={[styles.modalCard, isDark ? styles.modalCardDark : null]}>
              <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>
                {activeChannelTitle && activeChannelTitle !== 'Global' ? `${activeChannelTitle}` : 'About'}
              </Text>
              <ScrollView style={styles.modalScroll}>
                <RichText
                  text={String(channelAboutText || '')}
                  isDark={isDark}
                  style={[styles.modalRowText, ...(isDark ? [styles.modalRowTextDark] : [])]}
                  enableMentions={false}
                  variant="neutral"
                  onOpenUrl={requestOpenLink}
                />
              </ScrollView>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, isDark ? styles.modalBtnDark : null]}
                  onPress={guestChannelAboutModal.onGotIt}
                >
                  <Text style={[styles.modalBtnText, isDark ? styles.modalBtnTextDark : null]}>Got it</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <GuestChannelPickerModal
          open={channelPickerOpen}
          isDark={isDark}
          styles={styles}
          query={channelQuery}
          onChangeQuery={setChannelQuery}
          loading={channelListLoading}
          error={channelListError}
          globalUserCount={globalUserCount}
          channels={channelResults}
          onPickGlobal={() => {
            setActiveConversationId('global');
            setActiveChannelTitle('Global');
            setChannelPickerOpen(false);
          }}
          onPickChannel={(channelId, name) => {
            setActiveConversationId(`ch#${channelId}`);
            setActiveChannelTitle(name);
            setChannelPickerOpen(false);
          }}
          onLockedChannel={() =>
            showAlert('Locked Channel', 'This channel is password protected. Please sign in to join.')
          }
          onClose={() => setChannelPickerOpen(false)}
        />
        {/* Global UiPromptProvider renders UiPromptModal */}

        {error ? (
          <Text
            style={[styles.errorText, isDark && styles.errorTextDark, isWideUi ? styles.contentColumn : null]}
            numberOfLines={3}
          >
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

        {/*
        Web note:
        FlatList `inverted` can render upside-down on web in some environments.
        Keep native inverted behavior, but render non-inverted on web and reverse data.
      */}
        {/* Keep the scroll container full-width so the web scrollbar stays at the window edge.
          Center the *content* via FlatList.contentContainerStyle instead. */}
        <View
          style={{ flex: 1 }}
          {...(webWheelRefresh as any)}
        >
          <FlatList
            style={{ flex: 1, opacity: Platform.OS === 'web' && !webPinned.ready ? 0 : 1 }}
            data={messageListData}
            keyExtractor={(m) => m.id}
            inverted={Platform.OS !== 'web'}
            ref={(r) => {
              webPinned.listRef.current = r;
            }}
            onLayout={webPinned.onLayout as any}
            onContentSizeChange={webPinned.onContentSizeChange as any}
            keyboardShouldPersistTaps="handled"
            onEndReached={
              Platform.OS === 'web'
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
              Platform.OS === 'web' ? null : API_URL ? (
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
            onScroll={webPinned.onScroll as any}
            scrollEventThrottle={Platform.OS === 'web' ? 16 : undefined}
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
                cdnGet: (p) => cdn.get(p),
                requestOpenLink,
                resolvePathUrl,
                openReactionInfo,
                openViewer,
              })
            }
          />
        </View>

        {/* Bottom bar CTA (like the chat input row), so messages never render behind it */}
        <View
          style={[
            styles.bottomBar,
            isDark && styles.bottomBarDark,
            // Fill the safe area with the bar background, but keep the inner content vertically centered.
            { paddingBottom: insets.bottom },
          ]}
        >
          <View style={[styles.bottomBarInner, isWideUi ? styles.contentColumn : null]}>
            <Pressable
              onPress={requestSignIn}
              style={({ pressed }) => [
                styles.bottomBarCta,
                isDark && styles.bottomBarCtaDark,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign in to chat"
            >
              <Text style={[styles.bottomBarCtaText, isDark && styles.bottomBarCtaTextDark]}>Sign in to Chat</Text>
            </Pressable>
          </View>
        </View>

        <ReactionInfoModal
          visible={reactionInfo.open}
          isDark={isDark}
          styles={guestReactionInfoModalStyles as any}
          emoji={reactionInfo.emoji}
          subsSorted={reactionInfo.subsSorted}
          myUserId={null}
          nameBySub={reactionNameBySub}
          closeLabel="OK"
          onClose={() => reactionInfo.closeReactionInfo()}
        />

        <Modal visible={globalAboutOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
              <ScrollView style={styles.modalScroll}>
                <GlobalAboutContent
                  isDark={isDark}
                  titleStyle={[styles.modalTitle, isDark && styles.modalTitleDark]}
                  bodyStyle={[styles.modalRowText, ...(isDark ? [styles.modalRowTextDark] : [])]}
                  onOpenUrl={requestOpenLink}
                />
              </ScrollView>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, isDark && styles.modalBtnDark]}
                  onPress={() => void dismissGlobalAbout()}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss about"
                >
                  <Text style={[styles.modalBtnText, isDark && styles.modalBtnTextDark]}>Got it</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, isDark && styles.modalBtnDark]}
                  onPress={() => {
                    void dismissGlobalAbout();
                    requestSignIn();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                >
                  <Text style={[styles.modalBtnText, isDark && styles.modalBtnTextDark]}>Sign in</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <MediaViewerModal
          open={viewer.open}
          viewerState={viewer.state as any}
          setViewerState={viewer.setState as any}
          saving={viewer.saving}
          onSave={() => void viewer.saveToDevice()}
          onClose={viewer.close}
        />

        {confirmLinkModal}
      </View>
    </SafeAreaView>
  );
}
