import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import type { Pressable } from 'react-native';
import { ActivityIndicator, Platform, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MediaViewerState } from '../components/MediaViewerModal';
import { API_URL, CDN_URL } from '../config/env';
import { useGuestAudioPlaybackForRender } from '../features/chat/audioPlaybackForRender';
import {
  audioTitleFromFileName,
  buildAudioQueueFromMessages,
  isAudioContentType,
  makeAudioKey,
} from '../features/chat/audioPlaybackQueue';
import { useChatAudioPlayback } from '../features/chat/useChatAudioPlayback';
import { useGlobalAboutOncePerVersion } from '../features/globalAbout/useGlobalAboutOncePerVersion';
import { GuestGlobalBottomBar } from '../features/guest/components/GuestGlobalBottomBar';
import { GuestGlobalHeaderRow } from '../features/guest/components/GuestGlobalHeaderRow';
import { GuestGlobalMessageList } from '../features/guest/components/GuestGlobalMessageList';
import { GuestGlobalScreenOverlays } from '../features/guest/components/GuestGlobalScreenOverlays';
import { useGuestChannelAboutModalActions } from '../features/guest/useGuestChannelAboutModalActions';
import { useGuestChannelHistory } from '../features/guest/useGuestChannelHistory';
import { useGuestChannelSearch } from '../features/guest/useGuestChannelSearch';
import { useGuestRequestSignIn } from '../features/guest/useGuestRequestSignIn';
import { useAutoPopupChannelAbout } from '../hooks/useAutoPopupChannelAbout';
import { useCdnUrlCache } from '../hooks/useCdnUrlCache';
import { useConfirmLinkModal } from '../hooks/useConfirmLinkModal';
import { useMediaViewer } from '../hooks/useMediaViewer';
import { useMenuAnchor } from '../hooks/useMenuAnchor';
import { useOpenGlobalViewer } from '../hooks/useOpenGlobalViewer';
import { usePublicAvatarProfiles } from '../hooks/usePublicAvatarProfiles';
import { useReactionInfo } from '../hooks/useReactionInfo';
import { useResolveCdnPathUrl } from '../hooks/useResolveCdnPathUrl';
import { useStoredTheme } from '../hooks/useStoredTheme';
import { useUiPromptHelpers } from '../hooks/useUiPromptHelpers';
import { useViewportWidth } from '../hooks/useViewportWidth';
import { useWebPinnedList } from '../hooks/useWebPinnedList';
import { useWebSafeInvertedListData } from '../hooks/useWebSafeInvertedListData';
import { useWebWheelRefresh } from '../hooks/useWebWheelRefresh';
import { getAppThemeColors } from '../theme/colors';
import { markChannelAboutSeen } from '../utils/channelAboutSeen';
import { GLOBAL_ABOUT_VERSION } from '../utils/globalAbout';
import { openExternalFile } from '../utils/openExternalFile';
import { guestReactionInfoModalStyles, styles } from './GuestGlobalScreen.styles';

const GUEST_LAST_CHANNEL_CONVERSATION_ID_KEY = 'ui:guest:lastChannelConversationId';
const GUEST_LAST_CHANNEL_TITLE_KEY = 'ui:guest:lastChannelTitle';

function isValidGuestChannelConversationId(v: string): boolean {
  const s = String(v || '').trim();
  if (!s) return false;
  if (s === 'global') return true;
  return s.startsWith('ch#');
}

function readCachedGuestLastChannelSync(): { conversationId: string; title: string } {
  // Web-only: localStorage is synchronous; use it to avoid flashing Global on refresh.
  if (Platform.OS !== 'web') return { conversationId: 'global', title: 'Global' };
  try {
    const rawId = globalThis?.localStorage?.getItem?.(GUEST_LAST_CHANNEL_CONVERSATION_ID_KEY);
    const rawTitle = globalThis?.localStorage?.getItem?.(GUEST_LAST_CHANNEL_TITLE_KEY);
    const conversationId = typeof rawId === 'string' ? rawId.trim() : '';
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (isValidGuestChannelConversationId(conversationId)) {
      return {
        conversationId,
        title: title || (conversationId === 'global' ? 'Global' : 'Channel'),
      };
    }
  } catch {
    // ignore
  }
  return { conversationId: 'global', title: 'Global' };
}

export default function GuestGlobalScreen({
  onSignIn,
}: {
  onSignIn: () => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { isWide: isWideUi, viewportWidth } = useViewportWidth(windowWidth, {
    wideBreakpointPx: 900,
    maxContentWidthPx: 1040,
  });
  const { theme: _theme, setTheme, isDark } = useStoredTheme({});
  const onSetTheme = React.useCallback((next: 'light' | 'dark') => setTheme(next), [setTheme]);
  const appColors = getAppThemeColors(isDark);

  // --- Guest onboarding (Option A + C) ---
  // Global About is code-defined + versioned. Show once per version; About menu reopens it.
  const { globalAboutOpen, setGlobalAboutOpen, dismissGlobalAbout } =
    useGlobalAboutOncePerVersion(GLOBAL_ABOUT_VERSION);
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const menu = useMenuAnchor<React.ElementRef<typeof Pressable>>();

  // theme persistence handled by useStoredTheme

  // (Global About auto-popup + persist dismiss handled by shared hook)

  const cachedGuestNav = React.useMemo(() => readCachedGuestLastChannelSync(), []);
  const [activeConversationId, setActiveConversationId] = React.useState<string>(
    () => cachedGuestNav.conversationId,
  );
  const [activeChannelTitle, setActiveChannelTitle] = React.useState<string>(
    () => cachedGuestNav.title,
  );
  const [guestNavRestoreDone, setGuestNavRestoreDone] = React.useState<boolean>(false);
  const [channelPickerOpen, setChannelPickerOpen] = React.useState<boolean>(false);
  const [channelQuery, setChannelQuery] = React.useState<string>('');
  const {
    loading: channelListLoading,
    error: channelListError,
    globalUserCount,
    results: channelResults,
  } = useGuestChannelSearch({
    apiUrl: API_URL,
    enabled: channelPickerOpen,
    query: channelQuery,
    debounceMs: 150,
  });
  const { showAlert } = useUiPromptHelpers();

  // Restore guest last channel (device-scoped) so guests reopen where they left off.
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rawId, rawTitle] = await Promise.all([
          AsyncStorage.getItem(GUEST_LAST_CHANNEL_CONVERSATION_ID_KEY),
          AsyncStorage.getItem(GUEST_LAST_CHANNEL_TITLE_KEY),
        ]);
        if (!mounted) return;
        const v = typeof rawId === 'string' ? rawId.trim() : '';
        const t = typeof rawTitle === 'string' ? rawTitle.trim() : '';
        if (!isValidGuestChannelConversationId(v)) return;
        setActiveConversationId(v);
        // Best-effort: set title immediately; we'll overwrite from channelMeta when it loads.
        setActiveChannelTitle((prev) => {
          if (v === 'global') return 'Global';
          const next = t || prev;
          return next && next !== 'Global' ? next : 'Channel';
        });
      } catch {
        // ignore
      } finally {
        if (mounted) setGuestNavRestoreDone(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Web-only: since we render a non-inverted list (and reverse data), explicitly start at the bottom.

  const {
    messages,
    activeChannelMeta,
    loading,
    refreshing,
    error,
    setError: _setError,
    historyHasMore,
    historyLoading,
    loadOlderHistory,
    fetchNow,
  } = useGuestChannelHistory({ activeConversationId, pollIntervalMs: 60_000 });

  // If the restored channel is now locked/private, silently fall back to Global.
  const lastGuestLockFallbackRef = React.useRef<string>('');
  React.useEffect(() => {
    const cid = String(activeConversationId || '').trim();
    if (!cid.startsWith('ch#')) return;
    const msg = String(error || '').toLowerCase();
    if (!msg) return;
    const looksLikeForbidden =
      /\(403\)/.test(msg) ||
      /\b403\b/.test(msg) ||
      msg.includes('forbidden') ||
      msg.includes('not authorized');
    const looksLikeUnauthorized =
      /\(401\)/.test(msg) || /\b401\b/.test(msg) || msg.includes('unauthorized');
    if (!(looksLikeForbidden || looksLikeUnauthorized)) return;
    if (lastGuestLockFallbackRef.current === cid) return;
    lastGuestLockFallbackRef.current = cid;
    setActiveConversationId('global');
    setActiveChannelTitle('Global');
  }, [activeConversationId, error]);

  // Keep title in sync with the channel meta (important for restored channels).
  React.useEffect(() => {
    const cid = String(activeConversationId || '').trim();
    if (cid === 'global') {
      setActiveChannelTitle('Global');
      return;
    }
    if (!cid.startsWith('ch#')) return;
    const metaName =
      activeChannelMeta && typeof activeChannelMeta.name === 'string'
        ? String(activeChannelMeta.name).trim()
        : '';
    if (metaName) setActiveChannelTitle(metaName);
  }, [activeChannelMeta, activeConversationId]);

  // Persist guest last channel (best-effort; device-scoped only).
  React.useEffect(() => {
    if (!guestNavRestoreDone) return;
    const cid = String(activeConversationId || '').trim();
    if (!isValidGuestChannelConversationId(cid)) return;
    const title =
      cid === 'global'
        ? 'Global'
        : String(
            (activeChannelMeta && typeof activeChannelMeta.name === 'string'
              ? activeChannelMeta.name
              : activeChannelTitle) || 'Channel',
          ).trim() || 'Channel';

    (async () => {
      try {
        await AsyncStorage.setItem(GUEST_LAST_CHANNEL_CONVERSATION_ID_KEY, cid);
        await AsyncStorage.setItem(GUEST_LAST_CHANNEL_TITLE_KEY, title);
      } catch {
        // ignore
      }
      if (Platform.OS === 'web') {
        try {
          globalThis?.localStorage?.setItem?.(GUEST_LAST_CHANNEL_CONVERSATION_ID_KEY, cid);
          globalThis?.localStorage?.setItem?.(GUEST_LAST_CHANNEL_TITLE_KEY, title);
        } catch {
          // ignore
        }
      }
    })();
  }, [activeChannelMeta, activeChannelTitle, activeConversationId, guestNavRestoreDone]);
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

  const viewer = useMediaViewer<NonNullable<MediaViewerState>>({
    getSaveItem: (vs) => {
      if (!vs) return null;
      if (vs.mode !== 'global') return null;
      const items = Array.isArray(vs.globalItems) ? vs.globalItems : [];
      const idx = typeof vs.index === 'number' && Number.isFinite(vs.index) ? vs.index : -1;
      const item = idx >= 0 ? items[idx] : null;
      if (!item?.url) return null;
      const kind =
        item.kind === 'video' || item.kind === 'image' || item.kind === 'file' ? item.kind : 'file';
      return {
        url: String(item.url),
        kind,
        fileName: typeof item.fileName === 'string' ? item.fileName : undefined,
      };
    },
    onError: (msg) => {
      // Keep UX aligned with signed-in viewer: don't interrupt with alerts.
      try {
        console.warn('Guest save failed', msg);
      } catch {}
    },
  });

  const { requestOpenLink, requestOpenFile, closeConfirmLink, confirmLinkModal } =
    useConfirmLinkModal(isDark);

  const requestSignIn = useGuestRequestSignIn({
    onSignIn,
    setMenuOpen,
    setChannelPickerOpen,
    setReactionInfoOpen: reactionInfo.setOpen,
    closeViewer: viewer.close,
    closeConfirmLink,
  });

  const isChannel = React.useMemo(
    () => String(activeConversationId || '').startsWith('ch#'),
    [activeConversationId],
  );
  const activeChannelId = React.useMemo(
    () => (isChannel ? String(activeConversationId).slice('ch#'.length).trim() : ''),
    [isChannel, activeConversationId],
  );

  const messageListData = useWebSafeInvertedListData(messages);

  const webPinned = useWebPinnedList<(typeof messages)[number]>({
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

  const openViewer = useOpenGlobalViewer<NonNullable<MediaViewerState>>({
    // In guest mode we resolve the tapped item's path directly (no fallback path available here).
    resolveUrlForPath: (path) => resolvePathUrl(String(path)),
    includeFilesInViewer: false,
    openExternalIfFile: true,
    openExternalUrl: ({ url, fileName, contentType }) =>
      openExternalFile({
        url,
        fileName,
        contentType,
        requestOpenFile: Platform.OS === 'web' ? requestOpenFile : undefined,
      }),
    viewer,
    buildGlobalState: ({ index, items }) => ({
      mode: 'global' as const,
      index,
      globalItems: items,
    }),
  });

  // ---- Guest inline audio playback (same UI as signed-in chat) ----
  const guestAudioQueue = React.useMemo(() => {
    return buildAudioQueueFromMessages(messages, {
      getCreatedAt: (msg) => Number((msg as { createdAt?: unknown })?.createdAt) || 0,
      getSenderKey: (msg) => {
        const m = msg as { userSub?: unknown; user?: unknown };
        const sub = m?.userSub ? String(m.userSub) : '';
        if (sub) return `sub:${sub}`;
        const user = m?.user ? String(m.user).toLowerCase().trim() : '';
        if (user) return `user:${user}`;
        return 'anon';
      },
      getAudioItemsForMessage: (msg) => {
        const m = msg as {
          id?: unknown;
          mediaList?: Array<{ contentType?: unknown; path?: unknown; fileName?: unknown }>;
          media?: { contentType?: unknown; path?: unknown; fileName?: unknown };
        };
        const list = m.mediaList ? m.mediaList : m.media ? [m.media] : [];
        if (!list.length) return [];

        const out: Array<{
          key: string;
          idx: number;
          title: string;
          resolveUri: () => Promise<string>;
        }> = [];

        for (let i = 0; i < list.length; i++) {
          const it = list[i];
          if (!isAudioContentType(it?.contentType)) continue;
          const key = makeAudioKey(m.id, it.path, i);
          out.push({
            key,
            idx: i,
            title: audioTitleFromFileName(it.fileName, 'Audio'),
            resolveUri: async () => {
              const url = await resolvePathUrl(String(it?.path || ''));
              if (!url) throw new Error('Missing media URL');
              return url;
            },
          });
        }
        return out;
      },
    });
  }, [messages, resolvePathUrl]);

  const guestAudioPlayback = useChatAudioPlayback({ queue: guestAudioQueue });
  const guestAudioPlaybackForRender = useGuestAudioPlaybackForRender(guestAudioPlayback, showAlert);

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
      typeof activeChannelMeta?.aboutVersion === 'number' &&
      Number.isFinite(activeChannelMeta.aboutVersion)
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
    aboutText:
      typeof activeChannelMeta?.aboutText === 'string' ? String(activeChannelMeta.aboutText) : '',
    aboutVersion:
      typeof activeChannelMeta?.aboutVersion === 'number' &&
      Number.isFinite(activeChannelMeta.aboutVersion)
        ? activeChannelMeta.aboutVersion
        : 0,
    onOpen: () => {
      const aboutText =
        typeof activeChannelMeta?.aboutText === 'string' ? String(activeChannelMeta.aboutText) : '';
      setChannelAboutText(aboutText);
      setChannelAboutOpen(true);
    },
  });

  // Prevent a brief "blank list" flash between loading finishing and the list painting.
  // - On web, also wait for the pinned list to be ready (otherwise list opacity is 0).
  const [initialEmptyGraceOver, setInitialEmptyGraceOver] = React.useState<boolean>(false);
  React.useEffect(() => {
    setInitialEmptyGraceOver(false);
    if (error) return;
    if (loading) return;
    if (messages.length > 0) return;
    const t = setTimeout(() => setInitialEmptyGraceOver(true), 450);
    return () => clearTimeout(t);
  }, [activeConversationId, error, loading, messages.length]);

  // IMPORTANT: avoid an "empty channel" deadlock on web.
  // `webPinned.ready` is driven by FlatList layout/scroll signals. If we gate rendering on it while the
  // list is empty, the list may never mount, and `ready` can never flip to true.
  const webListNotReady = Platform.OS === 'web' && messages.length > 0 && !webPinned.ready;
  const showInitialLoader =
    !error && (loading || webListNotReady || (messages.length === 0 && !initialEmptyGraceOver));

  // Make guest feel like a single continuous boot: show a full-screen centered spinner
  // until the first message batch is actually ready to paint.
  if (showInitialLoader) {
    return (
      <SafeAreaView
        style={[styles.container, isDark && styles.containerDark]}
        // Web: ignore safe-area left/right insets (they can be misreported as ~42px and flip with rotation).
        edges={Platform.OS === 'web' ? [] : ['left', 'right']}
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={appColors.appForeground} />
        </View>
      </SafeAreaView>
    );
  }

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
            showAlert(
              'Locked Channel',
              'This channel is password protected. Please sign in to join.',
            )
          }
          requestSignIn={requestSignIn}
          reactionInfoOpen={reactionInfo.open}
          reactionInfoEmoji={reactionInfo.emoji}
          reactionInfoSubsSorted={reactionInfo.subsSorted}
          reactionNameBySub={reactionNameBySub}
          closeReactionInfo={() => reactionInfo.closeReactionInfo()}
          guestReactionInfoModalStyles={guestReactionInfoModalStyles}
          viewerOpen={viewer.open}
          viewerState={viewer.state}
          setViewerState={viewer.setState}
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
          openViewer={openViewer}
          audioPlayback={guestAudioPlaybackForRender}
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
