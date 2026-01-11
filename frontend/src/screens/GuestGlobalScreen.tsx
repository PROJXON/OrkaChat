import React from 'react';
import {
  Linking,
  Platform,
  Pressable,
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
import { GLOBAL_ABOUT_VERSION } from '../utils/globalAbout';
import type { MediaItem } from '../types/media';
import { useUiPromptHelpers } from '../hooks/useUiPromptHelpers';
import { useGlobalAboutOncePerVersion } from '../features/globalAbout/useGlobalAboutOncePerVersion';
import { useGuestChannelHistory } from '../features/guest/useGuestChannelHistory';
import { markChannelAboutSeen } from '../utils/channelAboutSeen';
import { useAutoPopupChannelAbout } from '../hooks/useAutoPopupChannelAbout';
import { guestReactionInfoModalStyles, styles } from './GuestGlobalScreen.styles';
import { useGuestChannelSearch } from '../features/guest/useGuestChannelSearch';
import { useWebSafeInvertedListData } from '../hooks/useWebSafeInvertedListData';
import { useReactionInfo } from '../hooks/useReactionInfo';
import { useMediaViewer } from '../hooks/useMediaViewer';
import { useOpenGlobalViewer } from '../hooks/useOpenGlobalViewer';
import { useGuestChannelAboutModalActions } from '../features/guest/useGuestChannelAboutModalActions';
import { useWebWheelRefresh } from '../hooks/useWebWheelRefresh';
import { useGuestRequestSignIn } from '../features/guest/useGuestRequestSignIn';
import { GuestGlobalScreenOverlays } from '../features/guest/components/GuestGlobalScreenOverlays';
import { GuestGlobalHeaderRow } from '../features/guest/components/GuestGlobalHeaderRow';
import { GuestGlobalBottomBar } from '../features/guest/components/GuestGlobalBottomBar';
import { GuestGlobalMessageList } from '../features/guest/components/GuestGlobalMessageList';

export default function GuestGlobalScreen({ onSignIn }: { onSignIn: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { isWide: isWideUi, viewportWidth } = useViewportWidth(windowWidth, { wideBreakpointPx: 900, maxContentWidthPx: 1040 });
  const { theme, setTheme, isDark } = useStoredTheme({});
  const onSetTheme = React.useCallback((next: 'light' | 'dark') => setTheme(next), [setTheme]);

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
      <GuestGlobalHeaderRow
        isDark={isDark}
        isWideUi={isWideUi}
        activeChannelTitle={activeChannelTitle}
        onOpenChannelPicker={() => {
          setChannelQuery('');
          setChannelPickerOpen(true);
        }}
        menu={menu}
        setMenuOpen={setMenuOpen}
        styles={styles}
      />

      {/* Ensure the message list never overlaps the header on Android touch layers. */}
      <View style={{ flex: 1, alignSelf: 'stretch' }}>
        <GuestGlobalScreenOverlays
          isDark={isDark}
          isWideUi={isWideUi}
          requestOpenLink={requestOpenLink}
          onSetTheme={onSetTheme}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          menuAnchor={menu.anchor}
          globalAboutOpen={globalAboutOpen}
          setGlobalAboutOpen={setGlobalAboutOpen}
          dismissGlobalAbout={dismissGlobalAbout}
          isChannel={isChannel}
          activeChannelTitle={activeChannelTitle}
          activeChannelMetaAboutText={String(activeChannelMeta?.aboutText || '')}
          channelAboutOpen={channelAboutOpen}
          setChannelAboutOpen={setChannelAboutOpen}
          channelAboutText={channelAboutText}
          setChannelAboutText={setChannelAboutText}
          guestChannelAboutModal={guestChannelAboutModal}
          channelPickerOpen={channelPickerOpen}
          setChannelPickerOpen={setChannelPickerOpen}
          channelQuery={channelQuery}
          setChannelQuery={setChannelQuery}
          channelListLoading={channelListLoading}
          channelListError={channelListError}
          globalUserCount={globalUserCount}
          channelResults={channelResults}
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
          showLockedChannelAlert={() =>
            showAlert('Locked Channel', 'This channel is password protected. Please sign in to join.')
          }
          requestSignIn={requestSignIn}
          reactionInfoOpen={reactionInfo.open}
          reactionInfoEmoji={reactionInfo.emoji}
          reactionInfoSubsSorted={reactionInfo.subsSorted}
          reactionNameBySub={reactionNameBySub}
          closeReactionInfo={() => reactionInfo.closeReactionInfo()}
          guestReactionInfoModalStyles={guestReactionInfoModalStyles as any}
          viewerOpen={viewer.open}
          viewerState={viewer.state as any}
          setViewerState={viewer.setState as any}
          viewerSaving={viewer.saving}
          onSaveViewer={() => void viewer.saveToDevice()}
          closeViewer={viewer.close}
          confirmLinkModal={confirmLinkModal}
          styles={styles}
        />
        {/* Global UiPromptProvider renders UiPromptModal */}

        <GuestGlobalMessageList
          apiUrl={API_URL}
          isDark={isDark}
          isWideUi={isWideUi}
          viewportWidth={viewportWidth}
          styles={styles}
          messages={messages}
          messageListData={messageListData}
          error={error}
          loading={loading}
          refreshing={refreshing}
          fetchNow={fetchNow}
          historyHasMore={historyHasMore}
          historyLoading={historyLoading}
          loadOlderHistory={loadOlderHistory}
          webPinned={webPinned}
          webWheelRefresh={webWheelRefresh}
          avatarProfileBySub={avatarProfileBySub}
          cdnGet={(p) => cdn.get(p)}
          requestOpenLink={requestOpenLink}
          resolvePathUrl={resolvePathUrl}
          openReactionInfo={openReactionInfo}
          openViewer={openViewer as any}
        />

        {/* Bottom bar CTA (like the chat input row), so messages never render behind it */}
        <GuestGlobalBottomBar
          isDark={isDark}
          isWideUi={isWideUi}
          bottomInset={insets.bottom}
          requestSignIn={requestSignIn}
          styles={styles}
        />

      </View>
    </SafeAreaView>
  );
}
