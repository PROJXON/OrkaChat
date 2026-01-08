import React from 'react';
import {
  AppState,
  AppStateStatus,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../config/env';
import { CDN_URL } from '../config/env';
import { VideoView, useVideoPlayer } from 'expo-video';
import Feather from '@expo/vector-icons/Feather';
import { HeaderMenuModal } from '../components/HeaderMenuModal';
import { AvatarBubble } from '../components/AvatarBubble';
import { AnimatedDots } from '../components/AnimatedDots';
import { RichText } from '../components/RichText';
import { ConfirmLinkModal } from '../components/ConfirmLinkModal';
import { AppBrandIcon } from '../components/AppBrandIcon';
import { GLOBAL_ABOUT_TEXT, GLOBAL_ABOUT_TITLE, GLOBAL_ABOUT_VERSION } from '../utils/globalAbout';

type GuestMessage = {
  id: string;
  user: string;
  userSub?: string;
  avatarBgColor?: string;
  avatarTextColor?: string;
  avatarImagePath?: string;
  text: string;
  createdAt: number;
  editedAt?: number;
  reactions?: Record<string, { count: number; userSubs: string[] }>;
  reactionUsers?: Record<string, string>;
  // Backward-compat: historically we supported only a single attachment per message.
  // New messages can include multiple attachments; use `mediaList` when present.
  media?: GuestMediaItem;
  mediaList?: GuestMediaItem[];
};

type GuestMediaItem = {
  path: string;
  thumbPath?: string;
  kind: 'image' | 'video' | 'file';
  contentType?: string;
  thumbContentType?: string;
  fileName?: string;
  size?: number;
};

type ChatEnvelope = {
  type: 'chat';
  text?: string;
  // Backward-compat: `media` may be a single object (v1) or an array (v2+).
  media?: GuestMediaItem | GuestMediaItem[];
};

const GUEST_HISTORY_PAGE_SIZE = 50;

function formatGuestTimestamp(ms: number): string {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return '';
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return time;
  return `${d.toLocaleDateString()} ${time}`;
}

function normalizeGuestReactions(raw: any): Record<string, { count: number; userSubs: string[] }> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, { count: number; userSubs: string[] }> = {};
  for (const [emoji, info] of Object.entries(raw)) {
    const count = Number((info as any)?.count);
    const subs = Array.isArray((info as any)?.userSubs) ? (info as any).userSubs.map(String).filter(Boolean) : [];
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : subs.length;
    if (safeCount <= 0 && subs.length === 0) continue;
    out[String(emoji)] = { count: safeCount, userSubs: subs };
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeGuestMediaList(raw: ChatEnvelope['media']): GuestMediaItem[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: GuestMediaItem[] = [];
  for (const m of arr as any[]) {
    if (!m || typeof m !== 'object') continue;
    if (typeof m.path !== 'string') continue;
    const kind = m.kind === 'video' ? 'video' : m.kind === 'image' ? 'image' : 'file';
    out.push({
      path: String(m.path),
      thumbPath: typeof m.thumbPath === 'string' ? String(m.thumbPath) : undefined,
      kind,
      contentType: typeof m.contentType === 'string' ? String(m.contentType) : undefined,
      thumbContentType: typeof m.thumbContentType === 'string' ? String(m.thumbContentType) : undefined,
      fileName: typeof m.fileName === 'string' ? String(m.fileName) : undefined,
      size: typeof m.size === 'number' && Number.isFinite(m.size) ? m.size : undefined,
    });
  }
  return out;
}

function tryParseChatEnvelope(rawText: string): { text: string; mediaList: GuestMediaItem[] } | null {
  const t = (rawText || '').trim();
  if (!t || !t.startsWith('{') || !t.endsWith('}')) return null;
  try {
    const obj = JSON.parse(t) as any;
    if (!obj || typeof obj !== 'object') return null;
    if (obj.type !== 'chat') return null;
    const env = obj as ChatEnvelope;
    const text = typeof env.text === 'string' ? env.text : '';
    const mediaList = normalizeGuestMediaList(env.media);
    if (!text && mediaList.length === 0) return null;
    return { text, mediaList };
  } catch {
    return null;
  }
}

function normalizeGuestMessages(items: any[]): GuestMessage[] {
  const out: GuestMessage[] = [];
  for (const it of items) {
    const createdAt = Number(it?.createdAt ?? Date.now());
    const messageId =
      typeof it?.messageId === 'string' || typeof it?.messageId === 'number'
        ? String(it.messageId)
        : String(createdAt);
    const user = typeof it?.user === 'string' ? it.user : 'anon';
    const userSub = typeof it?.userSub === 'string' ? String(it.userSub) : undefined;
    const deletedAt = typeof it?.deletedAt === 'number' ? it.deletedAt : undefined;
    if (deletedAt) continue;
    const rawText = typeof it?.text === 'string' ? it.text : '';
    const parsed = tryParseChatEnvelope(rawText);
    const text = parsed ? parsed.text : rawText;
    const mediaList = parsed?.mediaList ?? [];
    const media = mediaList.length ? mediaList[0] : undefined;
    if (!text.trim() && mediaList.length === 0) continue;
    out.push({
      id: messageId,
      user,
      userSub,
      avatarBgColor: typeof (it as any)?.avatarBgColor === 'string' ? String((it as any).avatarBgColor) : undefined,
      avatarTextColor: typeof (it as any)?.avatarTextColor === 'string' ? String((it as any).avatarTextColor) : undefined,
      avatarImagePath: typeof (it as any)?.avatarImagePath === 'string' ? String((it as any).avatarImagePath) : undefined,
      text,
      createdAt,
      editedAt: typeof (it as any)?.editedAt === 'number' ? (it as any).editedAt : undefined,
      reactions: normalizeGuestReactions((it as any)?.reactions),
      reactionUsers:
        (it as any)?.reactionUsers && typeof (it as any).reactionUsers === 'object'
          ? Object.fromEntries(Object.entries((it as any).reactionUsers).map(([k, v]) => [String(k), String(v)]))
          : undefined,
      media,
      mediaList: mediaList.length ? mediaList : undefined,
    });
  }

  // Ensure newest-first for inverted list behavior.
  out.sort((a, b) => b.createdAt - a.createdAt);

  // Deduplicate by id (in case of overlapping history windows)
  const seen = new Set<string>();
  return out.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

function FullscreenVideo({ url }: { url: string }): React.JSX.Element {
  const player = useVideoPlayer(url, (p: any) => {
    try {
      p.play();
    } catch {}
  });

  return <VideoView player={player} style={styles.viewerVideo} contentFit="contain" nativeControls />;
}

async function fetchGuestChannelHistoryPage(opts: {
  conversationId: string;
  before?: number | null;
}): Promise<{
  items: GuestMessage[];
  hasMore: boolean;
  nextCursor: number | null;
  channelMeta?: { channelId: string; conversationId: string; name?: string; aboutText?: string; aboutVersion?: number };
}> {
  if (!API_URL) throw new Error('API_URL is not configured');
  const base = API_URL.replace(/\/$/, '');
  const conversationId = String(opts?.conversationId || 'global').trim() || 'global';
  const before = opts?.before;
  const qs =
    `conversationId=${encodeURIComponent(conversationId)}` +
    `&limit=${GUEST_HISTORY_PAGE_SIZE}` +
    `&cursor=1` +
    (typeof before === 'number' && Number.isFinite(before) && before > 0 ? `&before=${encodeURIComponent(String(before))}` : '');
  const candidates =
    conversationId === 'global'
      ? [`${base}/public/messages?${qs}`, `${base}/messages?${qs}`]
      : [
          // New Channels public history endpoint (preferred).
          `${base}/public/channel/messages?${qs}`,
          // Fallbacks (may be forbidden for non-global; kept for flexibility across deployments).
          `${base}/public/messages?${qs}`,
          `${base}/messages?${qs}`,
        ];

  const errors: string[] = [];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        errors.push(`GET ${url} failed (${res.status}) ${text || ''}`.trim());
        continue;
      }
      const json = await res.json();
      const rawItems = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
      const items = normalizeGuestMessages(rawItems);
      const channelMetaRaw = !Array.isArray(json) && json && typeof json === 'object' ? (json as any)?.channel : null;
      const channelMeta =
        channelMetaRaw && typeof channelMetaRaw === 'object'
          ? {
              channelId: typeof channelMetaRaw.channelId === 'string' ? String(channelMetaRaw.channelId) : '',
              conversationId: typeof channelMetaRaw.conversationId === 'string' ? String(channelMetaRaw.conversationId) : conversationId,
              name: typeof channelMetaRaw.name === 'string' ? String(channelMetaRaw.name) : undefined,
              aboutText: typeof channelMetaRaw.aboutText === 'string' ? String(channelMetaRaw.aboutText) : undefined,
              aboutVersion:
                typeof channelMetaRaw.aboutVersion === 'number' && Number.isFinite(channelMetaRaw.aboutVersion)
                  ? channelMetaRaw.aboutVersion
                  : undefined,
            }
          : undefined;

      const hasMoreFromServer = typeof json?.hasMore === 'boolean' ? json.hasMore : null;
      const nextCursorFromServer =
        typeof json?.nextCursor === 'number' && Number.isFinite(json.nextCursor) ? json.nextCursor : null;

      const nextCursor =
        typeof nextCursorFromServer === 'number' && Number.isFinite(nextCursorFromServer)
          ? nextCursorFromServer
          : items.length
            ? items[items.length - 1].createdAt
            : null;

      const hasMore =
        typeof hasMoreFromServer === 'boolean'
          ? hasMoreFromServer
          : rawItems.length >= GUEST_HISTORY_PAGE_SIZE && typeof nextCursor === 'number' && Number.isFinite(nextCursor);

      return {
        items,
        hasMore: !!hasMore,
        nextCursor: typeof nextCursor === 'number' && Number.isFinite(nextCursor) ? nextCursor : null,
        channelMeta: channelMeta && channelMeta.channelId ? channelMeta : undefined,
      };
    } catch (err) {
      errors.push(`GET ${url} threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.length ? errors.join('\n') : 'Guest history fetch failed');
}

export default function GuestGlobalScreen({
  onSignIn,
}: {
  onSignIn: () => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const WIDE_BREAKPOINT_PX = 900;
  const MAX_CONTENT_WIDTH_PX = 1040;
  const isWideUi = windowWidth >= WIDE_BREAKPOINT_PX;
  const viewportWidth = isWideUi ? Math.min(windowWidth, MAX_CONTENT_WIDTH_PX) : windowWidth;
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const isDark = theme === 'dark';

  // --- Guest onboarding (Option A + C) ---
  // Global About is code-defined + versioned. Show once per version; About menu reopens it.
  const GLOBAL_ABOUT_KEY = `ui:globalAboutSeen:${GLOBAL_ABOUT_VERSION}`;
  const [globalAboutOpen, setGlobalAboutOpen] = React.useState<boolean>(false);
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const menuBtnRef = React.useRef<any>(null);
  const [menuAnchor, setMenuAnchor] = React.useState<null | { x: number; y: number; width: number; height: number }>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('ui:theme');
        if (stored === 'dark' || stored === 'light') setTheme(stored);
      } catch {
        // ignore
      }
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('ui:theme', theme);
      } catch {
        // ignore
      }
    })();
  }, [theme]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(GLOBAL_ABOUT_KEY);
        if (!mounted) return;
        if (!seen) setGlobalAboutOpen(true);
      } catch {
        if (mounted) setGlobalAboutOpen(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const dismissGlobalAbout = React.useCallback(async () => {
    setGlobalAboutOpen(false);
    try {
      await AsyncStorage.setItem(GLOBAL_ABOUT_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const [activeConversationId, setActiveConversationId] = React.useState<string>('global');
  const [activeChannelTitle, setActiveChannelTitle] = React.useState<string>('Global');
  const [activeChannelMeta, setActiveChannelMeta] = React.useState<
    null | { channelId: string; conversationId: string; name?: string; aboutText?: string; aboutVersion?: number }
  >(null);
  const [channelPickerOpen, setChannelPickerOpen] = React.useState<boolean>(false);
  const [channelQuery, setChannelQuery] = React.useState<string>('');
  const [channelListLoading, setChannelListLoading] = React.useState<boolean>(false);
  const [channelListError, setChannelListError] = React.useState<string | null>(null);
  const [globalUserCount, setGlobalUserCount] = React.useState<number | null>(null);
  const [channelResults, setChannelResults] = React.useState<
    Array<{ channelId: string; name: string; activeMemberCount?: number; hasPassword?: boolean }>
  >([]);
  const [alertOpen, setAlertOpen] = React.useState<boolean>(false);
  const [alertTitle, setAlertTitle] = React.useState<string>('');
  const [alertMessage, setAlertMessage] = React.useState<string>('');

  const showAlert = React.useCallback((title: string, message: string) => {
    setAlertTitle(String(title || ''));
    setAlertMessage(String(message || ''));
    setAlertOpen(true);
  }, []);

  const [messages, setMessages] = React.useState<GuestMessage[]>([]);
  const messagesRef = React.useRef<GuestMessage[]>([]);
  // Web-only: since we render a non-inverted list (and reverse data), explicitly start at the bottom.
  const messageListRef = React.useRef<any>(null);
  const webDidInitialScrollRef = React.useRef<boolean>(false);
  const webAtBottomRef = React.useRef<boolean>(true);
  const webWheelRefreshLastMsRef = React.useRef<number>(0);
  const [webListReady, setWebListReady] = React.useState<boolean>(Platform.OS !== 'web');
  const webInitScrollTimerRef = React.useRef<any>(null);
  const webInitScrollAttemptsRef = React.useRef<number>(0);
  const webListViewportHRef = React.useRef<number>(0);
  const webListContentHRef = React.useRef<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = React.useState<number | null>(null);
  const [historyHasMore, setHistoryHasMore] = React.useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = React.useState<boolean>(false);
  const historyLoadingRef = React.useRef<boolean>(false);
  const [urlByPath, setUrlByPath] = React.useState<Record<string, string>>({});
  // How quickly we’ll re-check guest profile avatars for updates (tradeoff: freshness vs API calls).
  const AVATAR_PROFILE_TTL_MS = 60_000;
  const [avatarProfileBySub, setAvatarProfileBySub] = React.useState<
    Record<
      string,
      {
        displayName?: string;
        avatarBgColor?: string;
        avatarTextColor?: string;
        avatarImagePath?: string;
        fetchedAt?: number;
      }
    >
  >({});
  const inFlightAvatarProfileRef = React.useRef<Set<string>>(new Set());
  const [reactionInfoOpen, setReactionInfoOpen] = React.useState<boolean>(false);
  const [reactionInfoEmoji, setReactionInfoEmoji] = React.useState<string>('');
  const [reactionInfoSubs, setReactionInfoSubs] = React.useState<string[]>([]);
  const [reactionInfoNamesBySub, setReactionInfoNamesBySub] = React.useState<Record<string, string>>({});

  const [viewerOpen, setViewerOpen] = React.useState<boolean>(false);
  const viewerScrollRef = React.useRef<any>(null);
  const [viewerState, setViewerState] = React.useState<
    null | {
      index: number;
      items: Array<{ url: string; kind: 'image' | 'video' | 'file'; fileName?: string }>;
    }
  >(null);

  const [linkConfirmOpen, setLinkConfirmOpen] = React.useState<boolean>(false);
  const [linkConfirmUrl, setLinkConfirmUrl] = React.useState<string>('');
  const [linkConfirmDomain, setLinkConfirmDomain] = React.useState<string>('');
  const requestOpenLink = React.useCallback((url: string) => {
    const s = String(url || '').trim();
    if (!s) return;
    let domain = '';
    try {
      domain = new URL(s).host;
    } catch {
      // ignore
    }
    setLinkConfirmUrl(s);
    setLinkConfirmDomain(domain);
    setLinkConfirmOpen(true);
  }, []);

  const requestSignIn = React.useCallback(() => {
    // Avoid stacked modals on Android (can get into a state where a transparent modal blocks touches).
    setMenuOpen(false);
    setChannelPickerOpen(false);
    setReactionInfoOpen(false);
    setViewerOpen(false);
    setViewerState(null);
    setLinkConfirmOpen(false);
    // Defer so modal close animations/state flush first.
    setTimeout(() => {
      try {
        onSignIn();
      } catch {
        // ignore
      }
    }, 0);
  }, [onSignIn]);

  const isChannel = React.useMemo(() => String(activeConversationId || '').startsWith('ch#'), [activeConversationId]);
  const activeChannelId = React.useMemo(
    () => (isChannel ? String(activeConversationId).slice('ch#'.length).trim() : ''),
    [isChannel, activeConversationId]
  );

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const messageListData = React.useMemo(
    () => (Platform.OS === 'web' ? [...messages].reverse() : messages),
    [messages]
  );

  const scrollWebListToBottom = React.useCallback((animated: boolean) => {
    if (Platform.OS !== 'web') return;
    const list: any = messageListRef.current;
    const viewportH = Math.max(0, Math.floor(webListViewportHRef.current || 0));
    const contentH = Math.max(0, Math.floor(webListContentHRef.current || 0));
    const endY = viewportH > 0 ? Math.max(0, contentH - viewportH) : null;

    // Prefer explicit offset (more reliable than scrollToEnd on RN-web when content height changes).
    if (typeof endY === 'number' && Number.isFinite(endY) && list?.scrollToOffset) {
      list.scrollToOffset({ offset: endY + 9999, animated: !!animated });
      return;
    }
    if (list?.scrollToEnd) list.scrollToEnd({ animated: !!animated });
  }, []);

  const kickWebInitialScrollToEnd = React.useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (webInitScrollTimerRef.current) clearTimeout(webInitScrollTimerRef.current);
    webInitScrollAttemptsRef.current = 0;
    const step = () => {
      scrollWebListToBottom(false);
      webInitScrollAttemptsRef.current += 1;
      // Give RN-web a few layout/virtualization ticks to settle before we reveal.
      if (webInitScrollAttemptsRef.current < 10) {
        webInitScrollTimerRef.current = setTimeout(step, 50);
      } else {
        setWebListReady(true);
      }
    };
    step();
  }, [scrollWebListToBottom]);

  React.useEffect(() => {
    return () => {
      if (webInitScrollTimerRef.current) clearTimeout(webInitScrollTimerRef.current);
    };
  }, []);

  // Web: when messages first appear, start at the bottom (newest).
  React.useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    if (webDidInitialScrollRef.current) return;
    if (!messages.length) return;
    webDidInitialScrollRef.current = true;
    kickWebInitialScrollToEnd();
  }, [messages.length, kickWebInitialScrollToEnd]);

  const resolvePathUrl = React.useCallback(
    async (path: string): Promise<string | null> => {
      if (!path) return null;
      const cached = urlByPath[path];
      if (cached) return cached;
      const base = (CDN_URL || '').trim();
      const p = String(path || '').replace(/^\/+/, '');
      if (!base || !p) return null;
      try {
        const b = base.endsWith('/') ? base : `${base}/`;
        const s = new URL(p, b).toString();
        setUrlByPath((prev) => (prev[path] ? prev : { ...prev, [path]: s }));
        return s;
      } catch {
        return null;
      }
    },
    [urlByPath]
  );

  // Guest profile-lite fetch (public endpoint) so avatars update for old messages.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!API_URL) return;
      const base = API_URL.replace(/\/$/, '');
      const missing: string[] = [];
      const now = Date.now();
      for (const m of messages) {
        const sub = m.userSub ? String(m.userSub) : '';
        if (!sub) continue;
        const existing = avatarProfileBySub[sub];
        const stale =
          !existing ||
          typeof existing.fetchedAt !== 'number' ||
          !Number.isFinite(existing.fetchedAt) ||
          now - existing.fetchedAt > AVATAR_PROFILE_TTL_MS;
        if (!stale) continue;
        if (inFlightAvatarProfileRef.current.has(sub)) continue;
        missing.push(sub);
      }
      if (!missing.length) return;
      const unique = Array.from(new Set(missing)).slice(0, 25);
      unique.forEach((s) => inFlightAvatarProfileRef.current.add(s));
      try {
        if (cancelled) return;
        const resp = await fetch(`${base}/public/users/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subs: unique }),
        });
        if (!resp.ok) return;
        const json = await resp.json();
        const users = Array.isArray(json?.users) ? json.users : [];
        if (!users.length) return;
        setAvatarProfileBySub((prev) => {
          const next = { ...prev };
          for (const u of users) {
            const sub = typeof u?.sub === 'string' ? String(u.sub).trim() : '';
            if (!sub) continue;
            next[sub] = {
              displayName: typeof u.displayName === 'string' ? String(u.displayName) : undefined,
              avatarBgColor: typeof u.avatarBgColor === 'string' ? String(u.avatarBgColor) : undefined,
              avatarTextColor: typeof u.avatarTextColor === 'string' ? String(u.avatarTextColor) : undefined,
              avatarImagePath: typeof u.avatarImagePath === 'string' ? String(u.avatarImagePath) : undefined,
              fetchedAt: now,
            };
          }
          return next;
        });
      } finally {
        unique.forEach((s) => inFlightAvatarProfileRef.current.delete(s));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, avatarProfileBySub]);

  // Prefetch avatar image URLs (best-effort).
  React.useEffect(() => {
    let cancelled = false;
    const needed: string[] = [];
    for (const prof of Object.values(avatarProfileBySub)) {
      const p = prof?.avatarImagePath;
      if (!p) continue;
      if (urlByPath[p]) continue;
      needed.push(p);
    }
    if (!needed.length) return;
    const unique = Array.from(new Set(needed));
    (async () => {
      for (const p of unique) {
        if (cancelled) return;
        await resolvePathUrl(p);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarProfileBySub, urlByPath, resolvePathUrl]);

  const openReactionInfo = React.useCallback(
    (emoji: string, subs: string[], namesBySub?: Record<string, string>) => {
    setReactionInfoEmoji(String(emoji || ''));
    setReactionInfoSubs(Array.isArray(subs) ? subs.map(String).filter(Boolean) : []);
    setReactionInfoNamesBySub(namesBySub && typeof namesBySub === 'object' ? namesBySub : {});
    setReactionInfoOpen(true);
  }, []);

  const openViewer = React.useCallback(
    async (mediaList: GuestMediaItem[], startIndex: number) => {
      const list = Array.isArray(mediaList) ? mediaList.filter((m) => !!m?.path) : [];
      if (!list.length) return;
      const idx = Math.max(0, Math.min(list.length - 1, Math.floor(Number(startIndex) || 0)));

      // If it's a single file attachment, keep existing guest behavior (open externally).
      if (list.length === 1 && list[0]?.kind === 'file') {
        const url = await resolvePathUrl(list[0].path);
        if (url) await Linking.openURL(url.toString());
        return;
      }

      const urls = await Promise.all(list.map((m) => resolvePathUrl(m.path)));
      const items = list.map((m, i) => ({
        url: String(urls[i] || ''),
        kind: m.kind,
        fileName: m.fileName,
      }));

      setViewerState({ index: idx, items });
      setViewerOpen(true);

      // Ensure the ScrollView lands on the requested page on open.
      setTimeout(() => {
        try {
          viewerScrollRef.current?.scrollTo?.({ x: windowWidth * idx, y: 0, animated: false });
        } catch {
          // ignore
        }
      }, 0);
    },
    [resolvePathUrl, windowWidth]
  );

  const fetchHistoryPage = React.useCallback(
    async (opts?: { reset?: boolean; before?: number | null; isManual?: boolean }) => {
      const reset = !!opts?.reset;
      const before = opts?.before;
      const isManual = !!opts?.isManual;

      if (reset) {
        historyLoadingRef.current = false;
      }
      if (historyLoadingRef.current) return;
      historyLoadingRef.current = true;
      setHistoryLoading(true);

      if (isManual) setRefreshing(true);
      else {
        const currentCount = messagesRef.current.length;
        setLoading((prev) => prev || (reset ? true : currentCount === 0));
      }

      try {
        setError(null);
        const page = await fetchGuestChannelHistoryPage({ conversationId: activeConversationId, before });
        if (String(activeConversationId || '').startsWith('ch#')) {
          setActiveChannelMeta(page.channelMeta || null);
        } else {
          setActiveChannelMeta(null);
        }
        if (reset) {
          setMessages(page.items);
          setHistoryHasMore(!!page.hasMore);
          setHistoryCursor(page.nextCursor);
        } else {
          // Merge older page into the list; if the page is all duplicates, stop paging to avoid
          // an infinite spinner loop (usually means cursor was stale or server ignored `before`).
          let appendedCount = 0;
          let mergedNextCursor: number | null = null;

          setMessages((prev) => {
            const prevSeen = new Set(prev.map((m) => m.id));
            const filtered = page.items.filter((m) => !prevSeen.has(m.id));
            appendedCount = filtered.length;
            const merged = filtered.length ? [...prev, ...filtered] : prev;
            mergedNextCursor = merged.length ? merged[merged.length - 1].createdAt : null;
            return merged;
          });

          if (page.items.length > 0 && appendedCount === 0) {
            setHistoryHasMore(false);
          } else {
            setHistoryHasMore(!!page.hasMore);
          }
          setHistoryCursor(mergedNextCursor);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load messages';
        setError(msg);
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
        historyLoadingRef.current = false;
        setHistoryLoading(false);
      }
    },
    [activeConversationId]
  );

  const [channelAboutOpen, setChannelAboutOpen] = React.useState<boolean>(false);
  const [channelAboutText, setChannelAboutText] = React.useState<string>('');

  // Auto-popup Channel About for guests on first enter or whenever aboutVersion changes.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isChannel) return;
      const cid = String(activeChannelId || '').trim();
      if (!cid) return;
      const aboutText = typeof activeChannelMeta?.aboutText === 'string' ? String(activeChannelMeta.aboutText) : '';
      const aboutVersion =
        typeof activeChannelMeta?.aboutVersion === 'number' && Number.isFinite(activeChannelMeta.aboutVersion)
          ? activeChannelMeta.aboutVersion
          : 0;
      if (!aboutText.trim()) return;
      if (!aboutVersion || aboutVersion <= 0) return;

      try {
        const key = `ui:guestChannelAboutSeen:${cid}`;
        const seenRaw = await AsyncStorage.getItem(key);
        if (cancelled) return;
        const seen = typeof seenRaw === 'string' && seenRaw.trim() ? Number(seenRaw) : 0;
        if (!Number.isFinite(seen) || seen < aboutVersion) {
          setChannelAboutText(aboutText);
          setChannelAboutOpen(true);
        }
      } catch {
        if (!cancelled) {
          setChannelAboutText(aboutText);
          setChannelAboutOpen(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isChannel, activeChannelId, activeChannelMeta?.aboutText, activeChannelMeta?.aboutVersion]);

  const loadOlderHistory = React.useCallback(() => {
    if (!API_URL) return;
    if (!historyHasMore) return;
    // Fire and forget; guarded by historyLoadingRef.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fetchHistoryPage({
      // Use the oldest currently-rendered message as the cursor.
      // This avoids stale `historyCursor` edge-cases (e.g., user taps "Load older" quickly).
      before: messagesRef.current.length
        ? messagesRef.current[messagesRef.current.length - 1].createdAt
        : historyCursor,
      reset: false,
    });
  }, [fetchHistoryPage, historyCursor, historyHasMore]);

  const refreshLatest = React.useCallback(async () => {
    if (!API_URL) return;
    if (historyLoadingRef.current) return;
    historyLoadingRef.current = true;
    setHistoryLoading(true);
    try {
      setError(null);
      const page = await fetchGuestChannelHistoryPage({ conversationId: activeConversationId, before: null });
      setMessages((prev) => {
        const seen = new Set<string>();
        const combined = [...page.items, ...prev];
        return combined.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
      });
      // IMPORTANT: do not reset cursor/hasMore during a "latest refresh" -
      // otherwise we can wipe paging state while the user is scrolling back.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load messages';
      setError(msg);
    } finally {
      historyLoadingRef.current = false;
      setHistoryLoading(false);
    }
  }, [activeConversationId]);

  const fetchNow = React.useCallback(
    async (opts?: { isManual?: boolean }) => {
      const isManual = !!opts?.isManual;
      if (isManual) {
        // Pull-to-refresh: fetch latest and merge (do NOT wipe older pages)
        await refreshLatest();
        return;
      }
      // Initial load: reset pagination.
      await fetchHistoryPage({ reset: true });
    },
    [fetchHistoryPage, refreshLatest]
  );

  // Initial fetch
  React.useEffect(() => {
    fetchNow().catch(() => {});
  }, [fetchNow]);

  // Poll every 60s while the app is in the foreground.
  React.useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const appStateRef = { current: AppState.currentState as AppStateStatus };

    const stop = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const start = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        refreshLatest().catch(() => {});
      }, 60_000);
    };

    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') start();
      else stop();
    });

    if (appStateRef.current === 'active') start();

    return () => {
      stop();
      sub.remove();
    };
  }, [refreshLatest]);

  // Public channel list (guests can browse + read public channels).
  React.useEffect(() => {
    if (!channelPickerOpen) return;
    if (!API_URL) return;
    let cancelled = false;
    const id = setTimeout(() => {
      (async () => {
        try {
          setChannelListLoading(true);
          setChannelListError(null);
          const base = API_URL.replace(/\/$/, '');
          const q = String(channelQuery || '').trim();
          const qs = `limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`;
          const candidates = [`${base}/public/channels/search?${qs}`, `${base}/channels/search?${qs}`];

          let data: any = null;
          const errors: string[] = [];
          for (const url of candidates) {
            const resp = await fetch(url);
            if (!resp.ok) {
              const text = await resp.text().catch(() => '');
              errors.push(`GET ${url} failed (${resp.status}) ${text || ''}`.trim());
              continue;
            }
            data = await resp.json().catch(() => ({}));
            break;
          }
          if (!data) {
            // Avoid showing raw URLs/errors to guests (dev convenience).
            console.warn('Guest channel search failed', errors.join('\n'));
            if (!cancelled) setChannelListError('Channel search failed');
            return;
          }
          if (typeof data?.globalUserCount === 'number' && Number.isFinite(data.globalUserCount) && data.globalUserCount >= 0) {
            if (!cancelled) setGlobalUserCount(Math.floor(data.globalUserCount));
          } else if (!q) {
            if (!cancelled) setGlobalUserCount(null);
          }
          const list = Array.isArray(data?.channels) ? data.channels : [];
          const normalized = list
            .map((c: any) => ({
              channelId: String(c.channelId || '').trim(),
              name: String(c.name || '').trim(),
              activeMemberCount: typeof c.activeMemberCount === 'number' ? c.activeMemberCount : undefined,
              hasPassword: typeof c.hasPassword === 'boolean' ? c.hasPassword : undefined,
            }))
            .filter((c: any) => c.channelId && c.name);
          if (!cancelled) setChannelResults(normalized);
        } catch (e: any) {
          if (!cancelled) setChannelListError(String(e?.message || 'Failed to load channels'));
        } finally {
          if (!cancelled) setChannelListLoading(false);
        }
      })();
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [channelPickerOpen, channelQuery]);

  return (
    // App.tsx already applies the top safe area. Avoid double top inset here (dead space).
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['left', 'right']}>
      <View style={[styles.headerRow, isDark && styles.headerRowDark]}>
        <View style={[styles.headerRowContent, isWideUi ? styles.contentColumn : null]}>
          <Pressable
            onPress={() => {
              setChannelListError(null);
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
              ref={menuBtnRef}
              onPress={() => {
                const node: any = menuBtnRef.current;
                if (isWideUi && node && typeof node.measureInWindow === 'function') {
                  node.measureInWindow((x: number, y: number, w: number, h: number) => {
                    setMenuAnchor({ x, y, width: w, height: h });
                    setMenuOpen(true);
                  });
                  return;
                }
                setMenuAnchor(null);
                setMenuOpen(true);
              }}
              style={({ pressed }) => [
                styles.menuIconBtn,
                isDark && styles.menuIconBtnDark,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <AppBrandIcon
                isDark={isDark}
                fit="contain"
                slotWidth={32}
                slotHeight={32}
                accessible={false}
              />
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
        anchor={isWideUi ? menuAnchor : null}
        headerRight={
          <View style={[styles.themeToggle, isDark && styles.themeToggleDark]}>
            <Feather name={isDark ? 'moon' : 'sun'} size={16} color={isDark ? '#fff' : '#111'} />
            {Platform.OS === 'web' ? (
              <Pressable
                onPress={() => setTheme(isDark ? 'light' : 'dark')}
                accessibilityRole="button"
                accessibilityLabel="Toggle theme"
                style={({ pressed }) => [
                  styles.webToggleTrack,
                  isDark ? styles.webToggleTrackOn : null,
                  pressed ? { opacity: 0.9 } : null,
                ]}
              >
                <View style={[styles.webToggleThumb, isDark ? styles.webToggleThumbOn : null]} />
              </Pressable>
            ) : (
              <Switch
                value={isDark}
                onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
                trackColor={{ false: '#d1d1d6', true: '#d1d1d6' }}
                thumbColor={isDark ? '#2a2a33' : '#ffffff'}
              />
            )}
          </View>
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
        onRequestClose={() => {
          // Treat back/escape as "Got it" (mark seen).
          (async () => {
            try {
              const cid = String(activeChannelId || '').trim();
              const v =
                typeof activeChannelMeta?.aboutVersion === 'number' && Number.isFinite(activeChannelMeta.aboutVersion)
                  ? activeChannelMeta.aboutVersion
                  : 0;
              if (cid && v) await AsyncStorage.setItem(`ui:guestChannelAboutSeen:${cid}`, String(v));
            } catch {
              // ignore
            }
            setChannelAboutOpen(false);
          })();
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              // Treat tapping outside as "Got it" (mark seen).
              (async () => {
                try {
                  const cid = String(activeChannelId || '').trim();
                  const v =
                    typeof activeChannelMeta?.aboutVersion === 'number' && Number.isFinite(activeChannelMeta.aboutVersion)
                      ? activeChannelMeta.aboutVersion
                      : 0;
                  if (cid && v) await AsyncStorage.setItem(`ui:guestChannelAboutSeen:${cid}`, String(v));
                } catch {
                  // ignore
                }
                setChannelAboutOpen(false);
              })();
            }}
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
                onPress={async () => {
                  try {
                    const cid = String(activeChannelId || '').trim();
                    const v =
                      typeof activeChannelMeta?.aboutVersion === 'number' && Number.isFinite(activeChannelMeta.aboutVersion)
                        ? activeChannelMeta.aboutVersion
                        : 0;
                    if (cid && v) await AsyncStorage.setItem(`ui:guestChannelAboutSeen:${cid}`, String(v));
                  } catch {
                    // ignore
                  }
                  setChannelAboutOpen(false);
                }}
              >
                <Text style={[styles.modalBtnText, isDark ? styles.modalBtnTextDark : null]}>Got it</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={channelPickerOpen} transparent animationType="fade" onRequestClose={() => setChannelPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelPickerOpen(false)} />
          <View style={[styles.modalCard, isDark ? styles.modalCardDark : null]}>
            <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>Channels</Text>

            <TextInput
              value={channelQuery}
              onChangeText={(v: string) => {
                setChannelQuery(v);
                setChannelListError(null);
              }}
              placeholder="Search Channels"
              placeholderTextColor={isDark ? '#8f8fa3' : '#999'}
              selectionColor={isDark ? '#ffffff' : '#111'}
              cursorColor={isDark ? '#ffffff' : '#111'}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDark ? '#2a2a33' : '#e3e3e3',
                backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
                color: isDark ? '#fff' : '#111',
                marginBottom: 10,
              }}
            />

            {channelListError ? (
              <Text style={[styles.errorText, isDark && styles.errorTextDark]} numberOfLines={2}>
                {channelListError}
              </Text>
            ) : null}

            <ScrollView style={styles.modalScroll}>
              <Pressable
                style={({ pressed }) => [
                  {
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    minHeight: 44,
                    borderRadius: 12,
                    alignSelf: 'stretch',
                    backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: isDark ? '#2a2a33' : '#e3e3e3',
                    marginBottom: 8,
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  },
                ]}
                onPress={() => {
                  setActiveConversationId('global');
                  setActiveChannelTitle('Global');
                  setChannelPickerOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Enter Global"
              >
                <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '800' }}>Global</Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: isDark ? '#2a2a33' : '#fff',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: isDark ? 'transparent' : '#e3e3e3',
                    minWidth: 38,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '900', color: isDark ? '#fff' : '#111' }}>
                    {typeof globalUserCount === 'number' ? String(globalUserCount) : '—'}
                  </Text>
                </View>
              </Pressable>

              {channelListLoading ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: isDark ? '#d7d7e0' : '#555', fontWeight: '700', fontSize: 14 }}>
                      Loading
                    </Text>
                    <AnimatedDots color={isDark ? '#d7d7e0' : '#555'} size={16} />
                  </View>
                </View>
              ) : channelResults.length ? (
                channelResults.map((c) => (
                  <Pressable
                    key={`guest-channel:${c.channelId}`}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        minHeight: 44,
                        borderRadius: 12,
                        alignSelf: 'stretch',
                        backgroundColor: isDark ? '#1c1c22' : '#f2f2f7',
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: isDark ? '#2a2a33' : '#e3e3e3',
                        marginBottom: 8,
                        opacity: pressed ? 0.85 : 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      },
                    ]}
                    onPress={() => {
                      if (c.hasPassword) {
                        showAlert('Locked Channel', 'This channel is password protected. Please sign in to join.');
                        return;
                      }
                      setActiveConversationId(`ch#${c.channelId}`);
                      setActiveChannelTitle(c.name);
                      setChannelPickerOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Enter ${c.name}`}
                  >
                    <Text
                      style={{ color: isDark ? '#fff' : '#111', fontWeight: '800', flexShrink: 1, minWidth: 0 }}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>

                    {/* Keep lock placement consistent with signed-in channel rows: on the RIGHT, near the count pill. */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                      {c.hasPassword ? (
                        <View style={{ marginRight: 8 }}>
                          <Feather name="lock" size={14} color={isDark ? '#a7a7b4' : '#666'} />
                        </View>
                      ) : null}
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 999,
                          backgroundColor: isDark ? '#2a2a33' : '#fff',
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: isDark ? 'transparent' : '#e3e3e3',
                          minWidth: 38,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontWeight: '900', color: isDark ? '#fff' : '#111' }}>
                          {String(typeof c.activeMemberCount === 'number' ? c.activeMemberCount : 0)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.modalRowText, isDark ? styles.modalRowTextDark : null]}>
                  {String(channelQuery || '').trim()
                    ? 'No channels found'
                    : 'No public channels yet'}
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setChannelPickerOpen(false)}
                style={({ pressed }) => [styles.modalBtn, isDark ? styles.modalBtnDark : null, pressed ? { opacity: 0.92 } : null]}
              >
                <Text style={[styles.modalBtnText, isDark ? styles.modalBtnTextDark : null]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Standard app-style alert modal (preferred over native Alert.alert). */}
      <Modal visible={alertOpen} transparent animationType="fade" onRequestClose={() => setAlertOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAlertOpen(false)} />
          <View style={[styles.modalCard, isDark ? styles.modalCardDark : null]}>
            <Text style={[styles.modalTitle, isDark ? styles.modalTitleDark : null]}>{alertTitle}</Text>
            <Text style={[styles.modalRowText, isDark ? styles.modalRowTextDark : null]}>{alertMessage}</Text>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setAlertOpen(false)}
                style={({ pressed }) => [styles.modalBtn, isDark ? styles.modalBtnDark : null, pressed ? { opacity: 0.92 } : null]}
              >
                <Text style={[styles.modalBtnText, isDark ? styles.modalBtnTextDark : null]}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {error ? (
        <Text style={[styles.errorText, isDark && styles.errorTextDark, isWideUi ? styles.contentColumn : null]} numberOfLines={3}>
          {error}
        </Text>
      ) : null}

      {loading && messages.length === 0 ? (
        <View style={[styles.loadingWrap, isWideUi ? styles.contentColumn : null]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: isDark ? '#d7d7e0' : '#555', fontWeight: '700', fontSize: 14 }}>
              Loading
            </Text>
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
        {...(Platform.OS === 'web'
          ? ({
              onWheel: (e: any) => {
                try {
                  if (!webAtBottomRef.current) return;
                  const dy = Number(e?.deltaY ?? 0);
                  if (!Number.isFinite(dy) || dy <= 0) return;
                  if (refreshing) return;
                  const now = Date.now();
                  if (now - webWheelRefreshLastMsRef.current < 900) return;
                  webWheelRefreshLastMsRef.current = now;
                  fetchNow({ isManual: true });
                } catch {
                  // ignore
                }
              },
            } as any)
          : ({} as any))}
      >
        <FlatList
          style={{ flex: 1, opacity: Platform.OS === 'web' && !webListReady ? 0 : 1 }}
          data={messageListData}
          keyExtractor={(m) => m.id}
          inverted={Platform.OS !== 'web'}
          ref={(r) => {
            messageListRef.current = r;
          }}
          onLayout={
            Platform.OS === 'web'
              ? (e: any) => {
                  const h = Number(e?.nativeEvent?.layout?.height ?? 0);
                  if (Number.isFinite(h) && h > 0) webListViewportHRef.current = h;
                  if (!webListReady) kickWebInitialScrollToEnd();
                }
              : undefined
          }
          onContentSizeChange={
            Platform.OS === 'web'
              ? (_w: number, h: number) => {
                  const hh = Number(h ?? 0);
                  if (Number.isFinite(hh) && hh > 0) webListContentHRef.current = hh;
                  // If the user is already at bottom (or this is the first render), keep pinned to the bottom.
                  if (!webDidInitialScrollRef.current || webAtBottomRef.current) {
                    scrollWebListToBottom(false);
                    webDidInitialScrollRef.current = true;
                  }
                  // While we haven't revealed yet, keep trying to pin to the bottom.
                  if (!webListReady) {
                    kickWebInitialScrollToEnd();
                  }
                }
              : undefined
          }
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
            Platform.OS === 'web'
              ? null
              : (API_URL ? (
                  <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                    {historyHasMore ? (
                      <Pressable
                        onPress={loadOlderHistory}
                        disabled={historyLoading}
                        style={({ pressed }) => ({
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 999,
                          backgroundColor: isDark ? '#2a2a33' : '#e9e9ee',
                          opacity: historyLoading ? 0.6 : pressed ? 0.85 : 1,
                        })}
                      >
                        <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '700' }}>
                          {historyLoading ? 'Loading older…' : 'Load older messages'}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={{ color: isDark ? '#aaa' : '#666' }}>
                        {messages.length === 0 ? 'Sign in to Start the Conversation!' : 'No Older Messages'}
                      </Text>
                    )}
                  </View>
                ) : null)
          }
          contentContainerStyle={[styles.listContent, isWideUi ? styles.contentColumn : null]}
          // For web (non-inverted), load older history when the user scrolls to the top.
          onScroll={
            Platform.OS === 'web'
              ? (e: any) => {
                  // Track whether the user is near the bottom so we don't hijack scroll while reading older messages.
                  try {
                    const ne = e?.nativeEvent;
                    const y = Number(ne?.contentOffset?.y ?? 0);
                    const viewportH = Number(ne?.layoutMeasurement?.height ?? 0);
                    const contentH = Number(ne?.contentSize?.height ?? 0);
                    const distFromBottom = contentH - (y + viewportH);
                    webAtBottomRef.current = Number.isFinite(distFromBottom) ? distFromBottom <= 80 : true;
                  } catch {
                    // ignore
                  }
                  if (!API_URL) return;
                  if (!historyHasMore) return;
                  if (historyLoading) return;
                  const y = Number(e?.nativeEvent?.contentOffset?.y ?? 0);
                  if (y <= 40) loadOlderHistory();
                }
              : undefined
          }
          scrollEventThrottle={Platform.OS === 'web' ? 16 : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNow({ isManual: true })}
              tintColor={isDark ? '#ffffff' : '#111'}
            />
          }
          renderItem={({ item, index }) => {
          const AVATAR_SIZE = 44;
          const AVATAR_GAP = 8;
          const normSender = (m?: GuestMessage | null) => {
            if (!m) return '';
            const sub = m.userSub ? String(m.userSub) : '';
            if (sub) return `sub:${sub}`;
            return `user:${String(m.user || '').trim().toLowerCase()}`;
          };
          const senderKey = normSender(item);
          // IMPORTANT: `index` is relative to the FlatList `data` prop.
          // On web we reverse the data (oldest-first), so the "older neighbor" is `index - 1`.
          // On native we keep newest-first (inverted list), so the "older neighbor" is `index + 1`.
          const olderNeighbor = Platform.OS === 'web' ? messageListData[index - 1] : messageListData[index + 1];
          const olderSenderKey = normSender(olderNeighbor);
          const showAvatar = !olderNeighbor || olderSenderKey !== senderKey;
          const AVATAR_GUTTER = showAvatar ? AVATAR_SIZE + AVATAR_GAP : 0;
          const prof = item.userSub ? avatarProfileBySub[String(item.userSub)] : undefined;
          const avatarImageUri = prof?.avatarImagePath ? urlByPath[String(prof.avatarImagePath)] : undefined;
          return (
            <GuestMessageRow
              item={item}
              isDark={isDark}
              onOpenUrl={requestOpenLink}
              resolvePathUrl={resolvePathUrl}
              onOpenReactionInfo={openReactionInfo}
              onOpenViewer={openViewer}
              avatarSize={AVATAR_SIZE}
              avatarGutter={AVATAR_GUTTER}
              avatarSeed={senderKey}
              avatarImageUri={avatarImageUri}
              avatarBgColor={prof?.avatarBgColor ?? item.avatarBgColor}
              avatarTextColor={prof?.avatarTextColor ?? item.avatarTextColor}
              showAvatar={showAvatar}
              viewportWidth={viewportWidth}
            />
          );
          }}
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
            <Text style={[styles.bottomBarCtaText, isDark && styles.bottomBarCtaTextDark]}>
              Sign in to Chat
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={reactionInfoOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              Reactions{reactionInfoEmoji ? ` · ${reactionInfoEmoji}` : ''}
            </Text>
            <ScrollView style={styles.modalScroll}>
              {reactionInfoSubs.length ? (
                reactionInfoSubs.map((sub) => {
                  const name = reactionInfoNamesBySub[sub];
                  const label = name ? String(name) : sub;
                  return (
                  <Text key={`rx:${reactionInfoEmoji}:${sub}`} style={[styles.modalRowText, isDark && styles.modalRowTextDark]}>
                    {label}
                  </Text>
                  );
                })
              ) : (
                <Text style={[styles.modalRowText, isDark && styles.modalRowTextDark]}>No reactors</Text>
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, isDark && styles.modalBtnDark]}
                onPress={() => setReactionInfoOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close reactions"
              >
                <Text style={[styles.modalBtnText, isDark && styles.modalBtnTextDark]}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={globalAboutOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>{GLOBAL_ABOUT_TITLE}</Text>
            <ScrollView style={styles.modalScroll}>
              <RichText
                text={GLOBAL_ABOUT_TEXT}
                isDark={isDark}
                style={[styles.modalRowText, ...(isDark ? [styles.modalRowTextDark] : [])]}
                enableMentions={false}
                variant="neutral"
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

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setViewerOpen(false);
          setViewerState(null);
        }}
      >
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerCard}>
            <View style={[styles.viewerTopBar, { paddingTop: insets.top, height: 52 + insets.top }]}>
              {(() => {
                const vs = viewerState;
                const count = vs?.items?.length ?? 0;
                const idx = vs?.index ?? 0;
                const title =
                  count > 1 ? `Attachment ${idx + 1}/${count}` : (vs?.items?.[idx]?.fileName || 'Attachment');
                return <Text style={styles.viewerTitle}>{title}</Text>;
              })()}
              <Pressable
                style={styles.viewerCloseBtn}
                onPress={() => {
                  setViewerOpen(false);
                  setViewerState(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Close viewer"
              >
                <Text style={styles.viewerCloseText}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.viewerBody}>
              {(() => {
                const vs = viewerState;
                const count = vs?.items?.length ?? 0;
                if (!vs || !count) return <Text style={styles.viewerFallback}>No preview available.</Text>;

                const pageW = windowWidth;
                const pageH = Math.max(1, windowHeight - (52 + insets.top));
                const onMomentumEnd = (e: any) => {
                  const x = Number(e?.nativeEvent?.contentOffset?.x ?? 0);
                  const next = Math.max(0, Math.min(count - 1, Math.round(x / Math.max(1, pageW))));
                  setViewerState((prev) => (prev ? { ...prev, index: next } : prev));
                };

                return (
                  <ScrollView
                    ref={viewerScrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={onMomentumEnd}
                    contentOffset={{ x: pageW * (vs.index || 0), y: 0 }}
                    style={{ width: pageW, height: pageH }}
                  >
                    {Array.from({ length: count }).map((_, i) => {
                      const item = vs.items[i];
                      const url = String(item?.url || '');
                      const kind = item?.kind;

                      if (!url) {
                        return (
                          <View
                            key={`guest-viewer:${i}`}
                            style={[styles.viewerTapArea, { width: pageW, height: pageH, justifyContent: 'center', alignItems: 'center' }]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Loading</Text>
                              <AnimatedDots color="#fff" size={18} />
                            </View>
                          </View>
                        );
                      }

                      if (kind === 'image') {
                        return (
                          <View key={`guest-viewer:${i}`} style={[styles.viewerTapArea, { width: pageW, height: pageH }]}>
                            <Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" />
                          </View>
                        );
                      }

                      if (kind === 'video') {
                        return (
                          <View key={`guest-viewer:${i}`} style={[styles.viewerTapArea, { width: pageW, height: pageH }]}>
                            <FullscreenVideo url={url} />
                          </View>
                        );
                      }

                      return (
                        <View
                          key={`guest-viewer:${i}`}
                          style={[styles.viewerTapArea, { width: pageW, height: pageH, justifyContent: 'center', alignItems: 'center' }]}
                        >
                          <Text style={styles.viewerFallback}>No preview available.</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {linkConfirmOpen ? (
        <ConfirmLinkModal
          open={linkConfirmOpen}
          isDark={isDark}
          url={linkConfirmUrl}
          domain={linkConfirmDomain}
          onCancel={() => setLinkConfirmOpen(false)}
          onOpen={() => {
            const u = String(linkConfirmUrl || '').trim();
            setLinkConfirmOpen(false);
            if (!u) return;
            void Linking.openURL(u).catch(() => {});
          }}
        />
      ) : null}
      </View>
    </SafeAreaView>
  );
}

function GuestMessageRow({
  item,
  isDark,
  onOpenUrl,
  resolvePathUrl,
  onOpenReactionInfo,
  onOpenViewer,
  avatarSize,
  avatarGutter,
  avatarSeed,
  avatarImageUri,
  avatarBgColor,
  avatarTextColor,
  showAvatar,
  viewportWidth,
}: {
  item: GuestMessage;
  isDark: boolean;
  onOpenUrl: (url: string) => void;
  resolvePathUrl: (path: string) => Promise<string | null>;
  onOpenReactionInfo: (emoji: string, subs: string[], namesBySub?: Record<string, string>) => void;
  onOpenViewer: (mediaList: GuestMediaItem[], startIndex: number) => void;
  avatarSize: number;
  avatarGutter: number;
  avatarSeed: string;
  avatarImageUri?: string;
  avatarBgColor?: string;
  avatarTextColor?: string;
  showAvatar: boolean;
  viewportWidth: number;
}) {
  const isSystem =
    String(item?.user || '').trim().toLowerCase() === 'system';
  if (isSystem) {
    return (
      <View style={{ paddingVertical: 10, alignItems: 'center' }}>
        <Text
          style={{
            color: isDark ? '#a7a7b4' : '#666',
            fontStyle: 'italic',
            fontWeight: '700',
            textAlign: 'center',
            paddingHorizontal: 18,
          }}
        >
          {String(item?.text || '').trim() || '-'}
        </Text>
      </View>
    );
  }

  const AVATAR_TOP_OFFSET = 4;
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
  const [usedFullUrl, setUsedFullUrl] = React.useState<boolean>(false);
  const [thumbAspect, setThumbAspect] = React.useState<number | null>(null);
  const [thumbUrlByKey, setThumbUrlByKey] = React.useState<Record<string, string | null>>({});
  const [carouselIdx, setCarouselIdx] = React.useState<number>(0);
  const carouselRef = React.useRef<any>(null);

  const mediaList = item.mediaList ?? (item.media ? [item.media] : []);
  const primaryMedia = mediaList.length ? mediaList[0] : null;
  const extraCount = Math.max(0, mediaList.length - 1);
  const mediaKey = React.useMemo(
    () => mediaList.map((m) => `${String(m?.thumbPath || '')}|${String(m?.path || '')}|${String(m?.kind || '')}`).join(','),
    [mediaList]
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const preferredPath = primaryMedia?.thumbPath || primaryMedia?.path;
      if (!preferredPath) return;
      const u = await resolvePathUrl(preferredPath);
      if (!cancelled) setThumbUrl(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryMedia?.path, primaryMedia?.thumbPath, resolvePathUrl]);

  // Resolve thumb URLs for *all* attachments so multi-attachment messages can swipe like signed-in.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mediaList.length) return;
      const next: Record<string, string | null> = {};
      for (const m of mediaList) {
        const key = String(m?.thumbPath || m?.path || '');
        if (!key) continue;
        if (thumbUrlByKey[key]) continue;
        const preferred = m?.thumbPath || m?.path;
        if (!preferred) continue;
        const u = await resolvePathUrl(preferred);
        next[key] = u;
      }
      if (cancelled) return;
      if (Object.keys(next).length) {
        setThumbUrlByKey((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKey, resolvePathUrl]);

  React.useEffect(() => {
    if (!thumbUrl) return;
    let cancelled = false;
    Image.getSize(
      thumbUrl,
      (w, h) => {
        if (cancelled) return;
        const aspect = w > 0 && h > 0 ? w / h : 1;
        setThumbAspect(Number.isFinite(aspect) ? aspect : 1);
      },
      () => {
        if (!cancelled) setThumbAspect(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [thumbUrl]);

  const hasMedia = !!primaryMedia?.path;
  const ts = formatGuestTimestamp(item.createdAt);
  const metaLine = `${item.user}${ts ? ` · ${ts}` : ''}`;
  const isEdited = typeof item.editedAt === 'number' && Number.isFinite(item.editedAt);
  const captionHasText = !!item.text && item.text.trim().length > 0;

  const reactionEntriesVisible = React.useMemo(() => {
    const entries = item.reactions ? Object.entries(item.reactions) : [];
    return entries
      .sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0))
      .slice(0, 3);
  }, [item.reactions]);

  const onThumbError = React.useCallback(async () => {
    // Common cases:
    // - thumb object doesn't exist
    // - S3 returns 403 because guest read policy isn't deployed yet
    // Try the full object as a fallback (especially useful if only the thumb is missing).
    if (usedFullUrl) return;
    const fullPath = primaryMedia?.path;
    if (!fullPath) return;
    const u = await resolvePathUrl(fullPath);
    if (u) {
      setUsedFullUrl(true);
      setThumbUrl(u);
      return;
    }
    // If we couldn't resolve anything, drop the preview so we fall back to a file chip.
    setThumbUrl(null);
  }, [primaryMedia?.path, resolvePathUrl, usedFullUrl]);

  // Match ChatScreen-ish thumbnail sizing: capped max size, preserve aspect ratio, no crop.
  const CHAT_MEDIA_MAX_HEIGHT = 240;
  const CHAT_MEDIA_MAX_WIDTH_FRACTION = 0.86;
  const maxW = Math.max(220, Math.floor((viewportWidth - Math.max(0, avatarGutter)) * CHAT_MEDIA_MAX_WIDTH_FRACTION));
  const maxH = CHAT_MEDIA_MAX_HEIGHT;
  const aspect = typeof thumbAspect === 'number' ? thumbAspect : 1;
  const capped = (() => {
    const w = maxW;
    const h = Math.max(80, Math.round(w / Math.max(0.1, aspect)));
    if (h <= maxH) return { w, h };
    const w2 = Math.max(160, Math.round(maxH * Math.max(0.1, aspect)));
    return { w: Math.min(maxW, w2), h: maxH };
  })();

  // Use a pixel max width for text bubbles too (more reliable than % on web, and accounts for avatar gutter).
  const TEXT_BUBBLE_MAX_WIDTH_FRACTION = 0.96;
  const textMaxW = Math.max(
    220,
    Math.floor((viewportWidth - Math.max(0, avatarGutter)) * TEXT_BUBBLE_MAX_WIDTH_FRACTION)
  );

  return (
    <View style={[styles.msgRow]}>
      {showAvatar ? (
        <View style={[styles.avatarGutter, { width: avatarSize, marginTop: AVATAR_TOP_OFFSET }]}>
          <AvatarBubble
            size={avatarSize}
            seed={avatarSeed}
            label={item.user}
            backgroundColor={avatarBgColor}
            textColor={avatarTextColor}
            imageUri={avatarImageUri}
            imageBgColor={isDark ? '#1c1c22' : '#f2f2f7'}
          />
        </View>
      ) : null}
      {hasMedia ? (
        <View style={[styles.guestMediaCardOuter, { width: capped.w }]}>
          <View style={[styles.guestMediaCard, isDark ? styles.guestMediaCardDark : null]}>
            <View style={[styles.guestMediaHeader, isDark ? styles.guestMediaHeaderDark : null]}>
              <View style={styles.guestMediaHeaderTopRow}>
                <View style={styles.guestMediaHeaderTopLeft}>
                  <Text
                    style={[styles.guestMetaLine, isDark ? styles.guestMetaLineDark : null]}
                  >
                    {metaLine}
                  </Text>
                </View>
                <View style={styles.guestMediaHeaderTopRight}>
                  {isEdited && !captionHasText ? (
                    <Text style={[styles.guestEditedLabel, isDark ? styles.guestEditedLabelDark : null]}>Edited</Text>
                  ) : null}
                </View>
              </View>
              {captionHasText ? (
                <View style={styles.guestMediaCaptionRow}>
                  <RichText
                    text={String(item.text || '')}
                    isDark={isDark}
                    enableMentions={true}
                    variant="neutral"
                    onOpenUrl={onOpenUrl}
                    style={[
                      styles.guestMediaCaption,
                      ...(isDark ? [styles.guestMediaCaptionDark] : []),
                      styles.guestMediaCaptionFlex,
                    ]}
                  />
                  {isEdited ? (
                    <View style={styles.guestMediaCaptionIndicators}>
                      <Text style={[styles.guestEditedLabel, isDark ? styles.guestEditedLabelDark : null]}>
                        Edited
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {mediaList.length > 1 ? (
              <View style={{ width: capped.w, height: capped.h }}>
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e: any) => {
                    const x = Number(e?.nativeEvent?.contentOffset?.x ?? 0);
                    const next = Math.max(0, Math.min(mediaList.length - 1, Math.round(x / Math.max(1, capped.w))));
                    setCarouselIdx(next);
                  }}
                  style={{ width: capped.w, height: capped.h }}
                >
                  {mediaList.map((m, i) => {
                    const key = String(m?.thumbPath || m?.path || '');
                    const u = key ? thumbUrlByKey[key] : null;
                    const looksImage =
                      m.kind === 'image' || (m.kind === 'file' && String(m.contentType || '').startsWith('image/'));
                    const looksVideo =
                      m.kind === 'video' || (m.kind === 'file' && String(m.contentType || '').startsWith('video/'));
                    return (
                      <Pressable
                        key={`guest-media:${item.id}:${m.path}:${i}`}
                        onPress={() => onOpenViewer(mediaList, i)}
                        style={({ pressed }) => [{ width: capped.w, height: capped.h, opacity: pressed ? 0.92 : 1 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Open attachment"
                      >
                        {u && (looksImage || looksVideo) ? (
                          looksImage ? (
                            <Image source={{ uri: u }} style={{ width: capped.w, height: capped.h }} resizeMode="contain" />
                          ) : (
                            <View style={{ width: capped.w, height: capped.h }}>
                              <Image source={{ uri: u }} style={styles.mediaFill} resizeMode="cover" />
                              <View style={styles.guestMediaPlayOverlay}>
                                <Text style={styles.guestMediaPlayOverlayText}>▶</Text>
                              </View>
                            </View>
                          )
                        ) : (
                          <View style={[styles.guestMediaFileChip, isDark && styles.guestMediaFileChipDark]}>
                            <Text style={[styles.guestMediaFileText, isDark && styles.guestMediaFileTextDark]} numberOfLines={1}>
                              {m?.fileName ? m.fileName : looksVideo ? 'Video' : looksImage ? 'Image' : 'File'}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.guestMediaCountBadge}>
                  <Text style={styles.guestMediaCountBadgeText}>{`${carouselIdx + 1}/${mediaList.length}`}</Text>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  if (primaryMedia) onOpenViewer([primaryMedia], 0);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Open media"
              >
                {primaryMedia?.kind === 'image' && thumbUrl ? (
                  <Image
                    source={{ uri: thumbUrl }}
                    style={{ width: capped.w, height: capped.h }}
                    resizeMode="contain"
                    onError={() => void onThumbError()}
                  />
                ) : primaryMedia?.kind === 'video' && thumbUrl ? (
                  <View style={{ width: capped.w, height: capped.h }}>
                    <Image
                      source={{ uri: thumbUrl }}
                      style={styles.mediaFill}
                      resizeMode="cover"
                      onError={() => void onThumbError()}
                    />
                    <View style={styles.guestMediaPlayOverlay}>
                      <Text style={styles.guestMediaPlayOverlayText}>▶</Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.guestMediaFileChip, isDark && styles.guestMediaFileChipDark]}>
                    <Text style={[styles.guestMediaFileText, isDark && styles.guestMediaFileTextDark]} numberOfLines={1}>
                      {primaryMedia?.fileName ? primaryMedia.fileName : primaryMedia?.kind === 'video' ? 'Video' : 'File'}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}

            {extraCount ? (
              <View style={styles.guestExtraMediaRow}>
                <Text style={[styles.guestExtraMediaText, isDark ? styles.guestExtraMediaTextDark : null]}>
                  +{extraCount} more
                </Text>
              </View>
            ) : null}
          </View>

          {reactionEntriesVisible.length ? (
            <View
              style={[
                styles.guestReactionOverlay,
                // RN-web deprecates the pointerEvents prop; use style.pointerEvents on web.
                ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
              ]}
              pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
            >
              {reactionEntriesVisible.map(([emoji, info]) => (
                <Pressable
                  key={`${item.id}:${emoji}`}
                  onPress={() =>
                    onOpenReactionInfo(String(emoji), (info?.userSubs || []).map(String), item.reactionUsers)
                  }
                  style={[styles.guestReactionChip, isDark && styles.guestReactionChipDark]}
                  accessibilityRole="button"
                  accessibilityLabel={`Reactions ${emoji}`}
                >
                  <Text style={[styles.guestReactionText, isDark && styles.guestReactionTextDark]}>
                    {emoji}
                    {(info?.count ?? 0) > 1 ? ` ${(info?.count ?? 0)}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.guestBubbleOuter, { maxWidth: textMaxW }]}>
          <View style={[styles.bubble, isDark && styles.bubbleDark, { maxWidth: textMaxW }]}>
            <Text style={[styles.guestMetaLine, isDark ? styles.guestMetaLineDark : null]}>{metaLine}</Text>
            {item.text?.trim() ? (
              <View style={styles.guestTextRow}>
                <RichText
                  text={String(item.text || '')}
                  isDark={isDark}
                  style={[styles.msgText, ...(isDark ? [styles.msgTextDark] : []), styles.guestTextFlex]}
                  enableMentions={true}
                  variant="neutral"
                  onOpenUrl={onOpenUrl}
                />
                {isEdited ? (
                  <Text style={[styles.guestEditedInline, isDark ? styles.guestEditedLabelDark : null]}>Edited</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {reactionEntriesVisible.length ? (
            <View
              style={[
                styles.guestReactionOverlay,
                ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
              ]}
              pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
            >
              {reactionEntriesVisible.map(([emoji, info]) => (
                <Pressable
                  key={`${item.id}:${emoji}`}
                  onPress={() =>
                    onOpenReactionInfo(String(emoji), (info?.userSubs || []).map(String), item.reactionUsers)
                  }
                  style={[styles.guestReactionChip, isDark && styles.guestReactionChipDark]}
                  accessibilityRole="button"
                  accessibilityLabel={`Reactions ${emoji}`}
                >
                  <Text style={[styles.guestReactionText, isDark && styles.guestReactionTextDark]}>
                    {emoji}
                    {(info?.count ?? 0) > 1 ? ` ${(info?.count ?? 0)}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#0b0b0f',
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    zIndex: 10,
    elevation: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e3e3',
    backgroundColor: '#fafafa',
  },
  headerRowDark: {
    backgroundColor: '#1c1c22',
    borderBottomColor: '#2a2a33',
  },
  headerRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  contentColumn: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  headerTitleDark: {
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3e3e3',
  },
  themeToggleDark: {
    backgroundColor: '#14141a',
    borderColor: '#2a2a33',
  },
  // Web-only: avoid browser default teal/blue accent that can bleed into the native Switch implementation.
  webToggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 999,
    padding: 2,
    backgroundColor: '#d1d1d6',
    justifyContent: 'center',
  },
  webToggleTrackOn: {
    // Match mobile: keep the track light; the "on" state is indicated by thumb position.
    backgroundColor: '#d1d1d6',
  },
  webToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    transform: [{ translateX: 0 }],
  },
  webToggleThumbOn: {
    backgroundColor: '#2a2a33',
    transform: [{ translateX: 18 }],
  },
  menuIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f2f2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBtnDark: {
    backgroundColor: '#2a2a33',
    borderColor: '#2a2a33',
    borderWidth: 0,
  },
  signInPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3e3e3',
  },
  signInPillDark: {
    backgroundColor: '#14141a',
    borderColor: '#2a2a33',
  },
  signInPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
  },
  signInPillTextDark: {
    color: '#fff',
  },
  errorText: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    color: '#b00020',
    fontSize: 12,
  },
  errorTextDark: {
    color: '#ff6b6b',
  },
  loadingWrap: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 6,
    // Inverted list: include symmetric padding so the newest message doesn't hug the bottom bar.
    paddingTop: 12,
    paddingBottom: 12,
  },
  msgRow: {
    paddingVertical: 4,
    alignItems: 'flex-start',
    flexDirection: 'row',
    // Ensure rows take full width on web so bubble maxWidth percentages are measured correctly.
    width: '100%',
  },
  avatarGutter: { marginRight: 8 },
  avatarSpacer: { opacity: 0 },
  // Wrapper used for positioning the reaction overlay.
  // Max width is set per-row (pixel) for reliability on web; keep this style flexible.
  guestBubbleOuter: { alignSelf: 'flex-start', position: 'relative', overflow: 'visible', flexShrink: 1, minWidth: 0 },
  bubble: {
    // Slightly wider bubbles; also keep responsive on web.
    maxWidth: '96%',
    flexShrink: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f2f2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
  },
  bubbleDark: {
    backgroundColor: '#1c1c22',
    borderColor: '#2a2a33',
  },
  guestReactionOverlay: {
    position: 'absolute',
    bottom: -12,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestReactionChip: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
  },
  guestReactionChipDark: {
    backgroundColor: '#14141a',
    borderColor: '#2a2a33',
  },
  guestReactionText: { color: '#111', fontWeight: '800', fontSize: 12 },
  guestReactionTextDark: { color: '#fff' },
  // Match ChatScreen: keep the main text container on a single row so the RichText can flex-grow
  // and wrap based on the bubble width (especially important on web).
  guestTextRow: { flexDirection: 'row', alignItems: 'flex-end' },
  // minWidth:0 is important on web flexbox so long unbroken text (e.g. links) can shrink/wrap inside the bubble.
  guestTextFlex: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  guestEditedInline: {
    marginLeft: 6,
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '400',
    color: '#555',
  },
  userText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#444',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  guestMetaLine: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  guestMetaLineDark: {
    color: '#fff',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#777',
  },
  timeTextDark: {
    color: '#fff',
  },
  userTextDark: {
    color: '#fff',
  },
  msgText: {
    fontSize: 15,
    color: '#111',
    lineHeight: 20,
  },
  msgTextDark: {
    color: '#fff',
  },
  guestMediaCardOuter: { alignSelf: 'flex-start', position: 'relative', overflow: 'visible' },
  guestMediaCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f1f1f1',
  },
  guestMediaCardDark: {
    backgroundColor: '#1c1c22',
  },
  guestMediaHeader: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: '#f1f1f1',
  },
  guestMediaHeaderDark: {
    backgroundColor: '#1c1c22',
  },
  guestMediaMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
  },
  guestMediaMetaDark: {
    color: '#b7b7c2',
  },
  guestMediaCaption: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '400',
    color: '#111',
    lineHeight: 20,
  },
  guestMediaHeaderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guestMediaHeaderTopLeft: { flex: 1, paddingRight: 10 },
  guestMediaHeaderTopRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  guestMediaCaptionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  guestMediaCaptionFlex: { flex: 1, marginTop: 0 },
  guestMediaCaptionIndicators: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginLeft: 10 },
  guestEditedLabel: { fontSize: 12, fontStyle: 'italic', fontWeight: '400', color: '#555' },
  guestEditedLabelDark: { color: '#a7a7b4' },
  guestMediaCaptionDark: {
    color: '#fff',
  },
  guestMediaPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestMediaPlayOverlayText: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    ...(Platform.OS === 'web'
      ? { textShadow: '0px 2px 6px rgba(0,0,0,0.6)' }
      : { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }),
  },
  mediaFill: { width: '100%', height: '100%' },
  guestMediaFileChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
    maxWidth: 260,
  },
  guestMediaFileChipDark: {
    backgroundColor: '#14141a',
    borderColor: '#2a2a33',
  },
  guestMediaFileText: {
    color: '#111',
    fontWeight: '800',
    fontSize: 13,
  },
  guestMediaFileTextDark: {
    color: '#fff',
  },
  guestExtraMediaRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  guestExtraMediaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555',
  },
  guestExtraMediaTextDark: {
    color: '#b7b7c2',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e3e3',
    backgroundColor: '#f2f2f7',
  },
  bottomBarInner: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  bottomBarDark: {
    backgroundColor: '#1c1c22',
    borderTopColor: '#2a2a33',
  },
  bottomBarCta: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBarCtaDark: {
    backgroundColor: '#2a2a33',
  },
  bottomBarCtaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  bottomBarCtaTextDark: {
    color: '#fff',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '92%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalCardDark: {
    backgroundColor: '#14141a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },
  modalTitleDark: { color: '#fff' },
  modalScroll: { maxHeight: 420 },
  modalRowText: { color: '#222', lineHeight: 20, marginBottom: 8 },
  modalRowTextDark: { color: '#d7d7e0' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f2f2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e3e3',
  },
  modalBtnDark: {
    backgroundColor: '#1c1c22',
    borderColor: '#2a2a33',
  },
  modalBtnText: { color: '#111', fontWeight: '800' },
  modalBtnTextDark: { color: '#fff' },

  viewerOverlay: { flex: 1, backgroundColor: '#000' },
  viewerCard: { flex: 1, backgroundColor: '#000' },
  viewerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  viewerTitle: { color: '#fff', fontWeight: '700', flex: 1, marginRight: 12 },
  viewerCloseBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },
  viewerCloseText: { color: '#fff', fontWeight: '800' },
  viewerBody: { flex: 1 },
  viewerTapArea: { backgroundColor: '#000' },
  // RN-web deprecates `style.resizeMode`; use the Image prop instead.
  viewerImage: { width: '100%', height: '100%' },
  viewerVideo: { width: '100%', height: '100%' },
  viewerFallback: { color: '#fff', padding: 14 },

  guestMediaCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  guestMediaCountBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});


