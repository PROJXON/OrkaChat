import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
  Image,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useUiPromptOptional } from '../../providers/UiPromptProvider';
import { APP_COLORS, PALETTE, withAlpha } from '../../theme/colors';
import type { MediaItem } from '../../types/media';
import {
  attachmentLabelForMedia,
  fileBadgeForMedia,
  fileBrandColorForMedia,
  fileIconNameForMedia,
  isImageLike,
  isVideoLike,
} from '../../utils/mediaKinds';
import { getNativeEventNumber } from '../../utils/nativeEvent';
import { saveMediaUrlToDevice } from '../../utils/saveMediaToDevice';
import {
  DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_KEY,
  DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_LABEL,
  SAVE_TO_PHONE_DONT_SHOW_AGAIN_KEY,
  SAVE_TO_PHONE_DONT_SHOW_AGAIN_LABEL,
} from '../../utils/saveToPhonePrompt';
import { AnimatedDots } from '../AnimatedDots';
import { AudioAttachmentTile } from './AudioAttachmentTile';

function aspectFromImageLoadEvent(e: unknown): number | null {
  // react-native-web often provides nativeEvent.width/height.
  const w0 = getNativeEventNumber(e, ['nativeEvent', 'width']);
  const h0 = getNativeEventNumber(e, ['nativeEvent', 'height']);
  if (w0 > 0 && h0 > 0) return w0 / h0;

  const w1 = getNativeEventNumber(e, ['nativeEvent', 'source', 'width']);
  const h1 = getNativeEventNumber(e, ['nativeEvent', 'source', 'height']);
  if (w1 > 0 && h1 > 0) return w1 / h1;

  // RN-web often exposes the underlying <img> element as nativeEvent.target.
  try {
    const t = (e as any)?.nativeEvent?.target;
    const w2 = Number(t?.naturalWidth || 0);
    const h2 = Number(t?.naturalHeight || 0);
    if (Number.isFinite(w2) && Number.isFinite(h2) && w2 > 0 && h2 > 0) return w2 / h2;
  } catch {
    // ignore
  }
  return null;
}

function formatBytes(bytes: number | undefined): string {
  const n = typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : 0;
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let v = Math.max(0, n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function MediaStackCarousel({
  messageId,
  mediaList,
  width,
  height,
  isDark,
  onToast,
  audioSlide,
  containOnAspectMismatch = false,
  aspectByPath,
  uriByPath,
  thumbUriByPath,
  cornerRadius = 16,
  loop = false,
  loadingTextColor,
  loadingDotsColor,
  onImageAspect,
  onOpen,
  onLongPress,
  imageResizeMode = 'contain',
}: {
  messageId: string;
  mediaList: MediaItem[];
  width: number;
  height: number;
  isDark: boolean;
  onToast?: (message: string, kind?: 'success' | 'error') => void;
  audioSlide?: {
    isOutgoing: boolean;
    currentKey: string | null;
    loadingKey: string | null;
    isPlaying: boolean;
    positionMs: number;
    durationMs: number | null;
    getKey: (idx: number, media: MediaItem) => string;
    getTitle: (media: MediaItem) => string;
    onToggle: (key: string, idx: number, media: MediaItem) => void | Promise<void>;
    onSeek: (key: string, ms: number) => void | Promise<void>;
    /**
     * Optional download resolver (used for encrypted chats where there is no direct CDN URL).
     * Should return a usable URL/URI (blob:/file:/content:/https).
     */
    getDownloadUrl?: (idx: number, media: MediaItem) => Promise<string | null> | string | null;
  };
  /**
   * If true, pages whose media aspect differs significantly from the carousel's container aspect
   * will use `contain` even when `imageResizeMode` is `cover`, to avoid zoom/cropping when the
   * message bubble is sized based on the first previewable item.
   */
  containOnAspectMismatch?: boolean;
  /**
   * Optional externally-provided aspect cache (e.g. signed-in chat's `imageAspectByPath`).
   * Useful on web where onLoad doesn't always expose intrinsic image dimensions.
   */
  aspectByPath?: Record<string, number>;
  uriByPath: Record<string, string>;
  // Optional alternate mapping for thumbnail paths (e.g., DM thumbnails).
  // If provided and an item has `thumbPath`, this map is preferred.
  thumbUriByPath?: Record<string, string>;
  // Controls rounding for the media container itself.
  // In chat/guest message bubbles we want square media (0).
  cornerRadius?: number;
  // If true, enables "infinite" paging by duplicating first/last items.
  loop?: boolean;
  // Optional overrides for the "Loading" placeholder tint.
  loadingTextColor?: string;
  loadingDotsColor?: string;
  // Optional callback to report measured image aspect ratio (w/h) from onLoad.
  // Useful for correcting EXIF-rotated phone photos where Image.getSize can report swapped dims.
  onImageAspect?: (keyPath: string, aspect: number) => void;
  onOpen: (idx: number, media: MediaItem) => void;
  /**
   * Optional long-press handler for the active page (used by chat to open message actions).
   * Should not interfere with horizontal swiping.
   */
  onLongPress?: (e: GestureResponderEvent) => void;
  /**
   * Resize mode for image thumbnails. Chat usually wants `cover` to avoid letterboxing bars.
   */
  imageResizeMode?: 'contain' | 'cover';
}): React.JSX.Element | null {
  // Even when widths are integer "dp", the rendered *physical* pixels can still be fractional
  // on high-DPR screens. If snapping lands off by <1dp, you can see a 1px sliver of the next page.
  // Align page sizes and scroll offsets to *physical pixels* (DPR-aware) to eliminate that.
  const dpr = Math.max(1, Number(PixelRatio.get?.() ?? 1) || 1);
  const widthDp = Number.isFinite(width) ? width : 1;
  const heightDp = Number.isFinite(height) ? height : 1;
  const pageWPx = Math.max(1, Math.round(widthDp * dpr));
  const pageHPx = Math.max(1, Math.round(heightDp * dpr));
  const pageW = pageWPx / dpr;
  const pageH = pageHPx / dpr;

  const n = Array.isArray(mediaList) ? mediaList.length : 0;
  const loopEnabled = !!loop && n > 1;
  const pages = React.useMemo(() => {
    if (!loopEnabled) return mediaList;
    const first = mediaList[0];
    const last = mediaList[n - 1];
    return [last, ...mediaList, first];
  }, [loopEnabled, mediaList, n]);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const scrollXRef = React.useRef<number>(0);
  const webSnapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWebScrollAtRef = React.useRef<number>(0);
  const [pageIdx, setPageIdx] = React.useState<number>(0);
  const pageIdxRef = React.useRef<number>(0);
  const [webHover, setWebHover] = React.useState<boolean>(false);
  const [localAspectByKey, setLocalAspectByKey] = React.useState<Record<string, number>>({});
  const containerAspect = pageW > 0 && pageH > 0 ? pageW / pageH : 1;
  const ui = useUiPromptOptional();
  const swallowNextOpenRef = React.useRef<boolean>(false);

  const snapToNearest = React.useCallback(
    (x: number) => {
      if (!scrollRef.current) return;
      const wPx = Math.max(1, pageWPx);
      const x0 = Number.isFinite(x) ? x : 0;
      const xPx = Math.round(x0 * dpr);

      if (!loopEnabled) {
        const next = Math.max(0, Math.min(n - 1, Math.round(xPx / wPx)));
        const targetX = (wPx * next) / dpr;
        setPageIdx(next);
        try {
          scrollRef.current.scrollTo({ x: targetX, y: 0, animated: false });
        } catch {
          // ignore
        }
        return;
      }

      const raw = Math.round(xPx / wPx); // 0..n+1
      if (raw === 0) {
        // Jump to last real page
        try {
          scrollRef.current.scrollTo({ x: (wPx * n) / dpr, y: 0, animated: false });
        } catch {
          // ignore
        }
        setPageIdx(n - 1);
        return;
      }
      if (raw === n + 1) {
        // Jump to first real page
        try {
          scrollRef.current.scrollTo({ x: wPx / dpr, y: 0, animated: false });
        } catch {
          // ignore
        }
        setPageIdx(0);
        return;
      }

      const nextIdx = Math.max(0, Math.min(n - 1, raw - 1));
      setPageIdx(nextIdx);
      try {
        scrollRef.current.scrollTo({ x: (wPx * raw) / dpr, y: 0, animated: false });
      } catch {
        // ignore
      }
    },
    [dpr, loopEnabled, n, pageWPx],
  );

  const shouldContainForAspect = React.useCallback(
    (mediaAspect: number | undefined) => {
      if (!containOnAspectMismatch) return false;
      if (!(containerAspect > 0) || !Number.isFinite(containerAspect)) return false;
      if (!(typeof mediaAspect === 'number') || !Number.isFinite(mediaAspect) || !(mediaAspect > 0))
        return false;
      const ratio = mediaAspect / containerAspect;
      // Allow small variance; switch to contain when aspect differs materially.
      return ratio < 0.88 || ratio > 1.12;
    },
    [containOnAspectMismatch, containerAspect],
  );

  React.useEffect(() => {
    pageIdxRef.current = pageIdx;
  }, [pageIdx]);

  // When media changes, reset to the first "real" page.
  React.useEffect(() => {
    setPageIdx(0);
    if (!loopEnabled) return;
    // Defer to next tick so layout is ready.
    setTimeout(() => {
      try {
        scrollRef.current?.scrollTo({ x: pageW, y: 0, animated: false });
      } catch {
        // ignore
      }
    }, 0);
  }, [messageId, loopEnabled, pageW]);

  // Web: map vertical wheel to horizontal paging so trackpad/mouse wheel "swipes" work naturally.
  // Use a *passive* DOM listener to avoid Chrome's non-passive wheel warnings.
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    type WheelLikeEvent = { deltaX?: unknown; deltaY?: unknown };
    type WheelNode = {
      addEventListener?: (
        type: string,
        listener: (e: WheelLikeEvent) => void,
        options?: { passive?: boolean },
      ) => void;
      removeEventListener?: (type: string, listener: (e: WheelLikeEvent) => void) => void;
    };

    let node: WheelNode | null = null;
    const handler = (e: WheelLikeEvent) => {
      try {
        const dxRaw = e?.deltaX ?? 0;
        const dyRaw = e?.deltaY ?? 0;
        const dx = typeof dxRaw === 'number' ? dxRaw : Number(dxRaw);
        const dy = typeof dyRaw === 'number' ? dyRaw : Number(dyRaw);
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        if (Math.abs(dy) <= Math.abs(dx)) return;
        scrollRef.current?.scrollTo({
          x: Math.max(0, scrollXRef.current + dy),
          y: 0,
          animated: false,
        });
      } catch {
        // ignore
      }
    };

    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      try {
        const scrollObj = scrollRef.current as unknown as {
          getScrollableNode?: () => unknown;
          getInnerViewNode?: () => unknown;
          getNode?: () => unknown;
        } | null;
        node =
          (scrollObj?.getScrollableNode?.() as WheelNode | null) ??
          (scrollObj?.getInnerViewNode?.() as WheelNode | null) ??
          (scrollObj?.getNode?.() as WheelNode | null) ??
          null;
        if (!node || typeof node.addEventListener !== 'function') {
          setTimeout(attach, 0);
          return;
        }
        node.addEventListener('wheel', handler, { passive: true });
      } catch {
        // ignore
      }
    };
    attach();

    return () => {
      cancelled = true;
      try {
        if (node && typeof node.removeEventListener === 'function') {
          node.removeEventListener('wheel', handler);
        }
      } catch {
        // ignore
      }
    };
  }, []);

  const goTo = React.useCallback(
    (idx: number) => {
      const safe = Math.max(0, Math.min(n - 1, idx));
      setPageIdx(safe);
      try {
        const offset = loopEnabled ? 1 : 0;
        const targetX = (pageWPx * (safe + offset)) / dpr;
        scrollRef.current?.scrollTo({ x: targetX, y: 0, animated: true });
        // Web: animated scroll can settle slightly off; snap once it settles.
        // Use the intended target (not the last observed scroll offset) to avoid occasional 1px slivers.
        if (Platform.OS === 'web') setTimeout(() => snapToNearest(targetX), 280);
      } catch {
        // ignore
      }
    },
    [dpr, loopEnabled, n, pageWPx, snapToNearest],
  );

  if (!n) return null;

  return (
    <View
      style={{ width: pageW, position: 'relative' }}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: () => setWebHover(true),
            onMouseLeave: () => setWebHover(false),
          }
        : {})}
    >
      <ScrollView
        ref={(r) => {
          scrollRef.current = r;
        }}
        horizontal
        nestedScrollEnabled
        pagingEnabled
        scrollEnabled={n > 1}
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageW}
        decelerationRate="fast"
        directionalLockEnabled
        style={{ width: pageW, height: pageH }}
        scrollEventThrottle={16}
        onScroll={(e: unknown) => {
          const x = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'x']);
          scrollXRef.current = x;
          if (Platform.OS === 'web') {
            lastWebScrollAtRef.current = Date.now();
            if (webSnapTimerRef.current) clearTimeout(webSnapTimerRef.current);
            webSnapTimerRef.current = setTimeout(() => {
              // Keep "fast" debounce (20ms), but don't snap mid-scroll on systems where scroll events
              // are spaced out. Only snap after a short quiet window.
              const QUIET_MS = 60;
              const since = Date.now() - lastWebScrollAtRef.current;
              if (since < QUIET_MS) {
                if (webSnapTimerRef.current) clearTimeout(webSnapTimerRef.current);
                webSnapTimerRef.current = setTimeout(() => {
                  snapToNearest(scrollXRef.current);
                }, QUIET_MS - since);
                return;
              }
              snapToNearest(scrollXRef.current);
            }, 20);
          }
          if (!loopEnabled) return;
          const xPx = Math.round((Number.isFinite(x) ? x : 0) * dpr);
          const raw = Math.round(xPx / Math.max(1, pageWPx)); // 0..n+1
          const nextIdx =
            raw === 0 ? n - 1 : raw === n + 1 ? 0 : Math.max(0, Math.min(n - 1, raw - 1));
          if (nextIdx !== pageIdxRef.current) setPageIdx(nextIdx);
        }}
        onMomentumScrollEnd={(e: unknown) => {
          const x = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'x']);
          // Snap to the nearest page boundary across platforms (mobile can occasionally settle a hair off).
          snapToNearest(x);
        }}
        onScrollEndDrag={(e: unknown) => {
          const x = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'x']);
          if (Platform.OS === 'web') {
            // Some web drags don't trigger onMomentumScrollEnd; snap here too.
            snapToNearest(x);
            return;
          }
          // Native: only snap here when velocity is essentially zero (avoids fighting momentum).
          const vx = getNativeEventNumber(e, ['nativeEvent', 'velocity', 'x']);
          if (Math.abs(vx) < 0.05) snapToNearest(x);
        }}
      >
        {pages.map((m2, idx2) => {
          const looksImage = isImageLike(m2);
          const looksVideo = isVideoLike(m2);
          const ct = String(m2?.contentType || '')
            .trim()
            .toLowerCase()
            .split(';')[0]
            .trim();
          const thumbKey = String(m2.thumbPath || m2.path || '');
          const thumbUriFromThumbMap =
            m2.thumbPath && thumbUriByPath
              ? String(thumbUriByPath[String(m2.thumbPath)] || '')
              : '';
          const thumbUri =
            thumbUriFromThumbMap || (thumbKey ? String(uriByPath[thumbKey] || '') : '');
          const measuredAspect = thumbKey
            ? (localAspectByKey[thumbKey] ?? aspectByPath?.[thumbKey])
            : undefined;
          const pageResizeMode: 'contain' | 'cover' =
            (looksImage || looksVideo) && shouldContainForAspect(measuredAspect)
              ? 'contain'
              : imageResizeMode;
          const letterboxBg =
            pageResizeMode === 'contain'
              ? isDark
                ? PALETTE.slate800 // #1c1c22 (match app dark surfaces)
                : PALETTE.paper210 // match light incoming bubble surface
              : 'transparent';

          // Map extended pages → real index.
          const realIndex = !loopEnabled
            ? idx2
            : idx2 === 0
              ? n - 1
              : idx2 === n + 1
                ? 0
                : idx2 - 1;

          const loadingText =
            loadingTextColor ??
            (isDark ? APP_COLORS.dark.text.primary : APP_COLORS.light.text.primary);
          const loadingDots = loadingDotsColor ?? loadingText;
          const onPress = () => {
            if (swallowNextOpenRef.current) {
              swallowNextOpenRef.current = false;
              return;
            }
            onOpen(realIndex, mediaList[realIndex]);
          };
          const isNarrow = pageW <= 320;

          const isAudio = ct.startsWith('audio/');
          if (isAudio && audioSlide) {
            const original = mediaList[realIndex];
            const key = audioSlide.getKey(realIndex, original);
            const durationMs =
              audioSlide.currentKey === key
                ? (audioSlide.durationMs ?? original.durationMs ?? null)
                : (original.durationMs ?? null);
            const positionMs = audioSlide.currentKey === key ? audioSlide.positionMs : 0;
            const isPlaying = audioSlide.currentKey === key && audioSlide.isPlaying;
            const isLoading = audioSlide.loadingKey === key;
            // Ensure there's always a meaningful swipe zone outside the audio tile.
            // (If the tile consumes most of the slide, users accidentally start swipes on the slider and paging "sticks".)
            const sideGutter = pageW <= 360 ? 18 : 26;
            const maxContentW = Math.min(420, Math.max(0, pageW - sideGutter * 2 - 24));
            const tileIsOutgoing = false; // Carousel slides are neutral surfaces; keep controls high-contrast.
            const downloadUrl = String(uriByPath[String(original.path)] || '').trim();
            const isNarrow = pageW <= 320;
            return (
              <Pressable
                key={`page:${messageId}:${thumbKey}:${idx2}`}
                onLongPress={(e) => {
                  if (!onLongPress) return;
                  onLongPress(e);
                }}
                style={{ width: pageW, height: pageH }}
                accessibilityRole="summary"
                {...(Platform.OS === 'web'
                  ? ({
                      onContextMenu: (e: unknown) => {
                        if (!onLongPress) return;
                        const ev = e as {
                          preventDefault?: () => void;
                          stopPropagation?: () => void;
                        };
                        ev.preventDefault?.();
                        ev.stopPropagation?.();
                      },
                    } as const)
                  : {})}
              >
                {/* Dedicated swipe gutters on left/right; swipes starting here should page reliably. */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: sideGutter, height: '100%' }} />
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: '100%', maxWidth: maxContentW, paddingHorizontal: 12 }}>
                      <AudioAttachmentTile
                        isDark={isDark}
                        isOutgoing={tileIsOutgoing}
                        minWidth={0}
                        layout={isNarrow ? 'narrow' : 'default'}
                        onDownload={
                          downloadUrl || audioSlide.getDownloadUrl
                            ? async () => {
                                const url =
                                  downloadUrl ||
                                  String(
                                    (await Promise.resolve(
                                      audioSlide.getDownloadUrl?.(realIndex, original),
                                    )) || '',
                                  ).trim();
                                if (!url) return;
                                await saveMediaUrlToDevice({
                                  url,
                                  kind: 'file',
                                  fileName: original.fileName,
                                  onSuccess:
                                    Platform.OS === 'web'
                                      ? undefined
                                      : () => onToast?.('Media saved', 'success'),
                                  onError:
                                    Platform.OS === 'web'
                                      ? undefined
                                      : (m) => onToast?.(String(m || 'Download failed'), 'error'),
                                });
                              }
                            : undefined
                        }
                        state={{
                          key,
                          title: audioSlide.getTitle(original),
                          subtitle: undefined,
                          isPlaying,
                          isLoading,
                          positionMs,
                          durationMs,
                          onToggle: () => audioSlide.onToggle(key, realIndex, original),
                          onSeek: (nextMs) => audioSlide.onSeek(key, nextMs),
                        }}
                      />
                    </View>
                  </View>
                  <View style={{ width: sideGutter, height: '100%' }} />
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={`page:${messageId}:${thumbKey}:${idx2}`}
              onPress={onPress}
              onLongPress={(e) => {
                if (!onLongPress) return;
                swallowNextOpenRef.current = true;
                onLongPress(e);
              }}
              style={{ width: pageW, height: pageH }}
              accessibilityRole="button"
              accessibilityLabel="Open Attachment"
              {...(Platform.OS === 'web'
                ? ({
                    onContextMenu: (e: unknown) => {
                      if (!onLongPress) return;
                      const ev = e as { preventDefault?: () => void; stopPropagation?: () => void };
                      ev.preventDefault?.();
                      ev.stopPropagation?.();
                    },
                  } as const)
                : {})}
            >
              {thumbUri && (looksImage || looksVideo) ? (
                looksImage ? (
                  <Image
                    source={{ uri: thumbUri }}
                    style={[
                      styles.mediaCappedImage,
                      {
                        width: pageW,
                        height: pageH,
                        borderRadius: cornerRadius,
                        backgroundColor: letterboxBg,
                      },
                    ]}
                    resizeMode={pageResizeMode}
                    onLoad={(e) => {
                      if (!thumbKey) return;
                      const aspect = aspectFromImageLoadEvent(e);
                      if (
                        !(typeof aspect === 'number') ||
                        !Number.isFinite(aspect) ||
                        !(aspect > 0)
                      )
                        return;
                      setLocalAspectByKey((prev) =>
                        prev[thumbKey] ? prev : { ...prev, [thumbKey]: aspect },
                      );
                      onImageAspect?.(thumbKey, aspect);
                    }}
                  />
                ) : (
                  <View
                    style={[
                      styles.videoThumbWrap,
                      {
                        width: pageW,
                        height: pageH,
                        borderRadius: cornerRadius,
                        backgroundColor: letterboxBg,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: thumbUri }}
                      style={styles.mediaFill}
                      resizeMode={pageResizeMode}
                      onLoad={(e) => {
                        if (!thumbKey) return;
                        const aspect = aspectFromImageLoadEvent(e);
                        if (
                          !(typeof aspect === 'number') ||
                          !Number.isFinite(aspect) ||
                          !(aspect > 0)
                        )
                          return;
                        setLocalAspectByKey((prev) =>
                          prev[thumbKey] ? prev : { ...prev, [thumbKey]: aspect },
                        );
                        onImageAspect?.(thumbKey, aspect);
                      }}
                    />
                    <View style={styles.videoPlayOverlay}>
                      <Text style={styles.videoPlayText}>▶</Text>
                    </View>
                  </View>
                )
              ) : looksImage || looksVideo ? (
                <View
                  style={[
                    styles.imageThumbWrap,
                    {
                      width: pageW,
                      height: pageH,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: cornerRadius,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: loadingText, fontWeight: '800', fontSize: 14 }}>
                      Loading
                    </Text>
                    <AnimatedDots color={loadingDots} size={16} />
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.fileSlideOuter,
                    isDark ? styles.fileSlideOuterDark : styles.fileSlideOuterLight,
                    {
                      width: pageW,
                      height: pageH,
                      borderRadius: cornerRadius,
                    },
                  ]}
                >
                  {(() => {
                    const iconName = fileIconNameForMedia(m2);
                    const badge = fileBadgeForMedia(m2);
                    const label = attachmentLabelForMedia(m2);
                    const name = String(m2.fileName || '').trim() || label;
                    const downloadUrl = String(uriByPath[String(m2.path)] || '').trim();
                    const size =
                      typeof m2.size === 'number' && Number.isFinite(m2.size) ? m2.size : undefined;
                    const brandColor = fileBrandColorForMedia(m2);
                    const iconColor = brandColor
                      ? brandColor
                      : isDark
                        ? APP_COLORS.dark.text.primary
                        : APP_COLORS.light.text.primary;
                    const maxContentW = Math.min(420, Math.max(0, pageW - 24));

                    const runDownload = (e?: unknown) =>
                      void (async () => {
                        // Web: avoid triggering the page's onPress (open) when tapping download.
                        if (Platform.OS === 'web')
                          (e as { stopPropagation?: () => void })?.stopPropagation?.();
                        try {
                          const title =
                            Platform.OS === 'web' ? 'Download Attachment?' : 'Save to Phone?';
                          const msg =
                            Platform.OS === 'web'
                              ? `Download "${name}" to your device?`
                              : `Save "${name}" to your device?`;
                          const ok = ui?.confirm
                            ? await ui.confirm(title, msg, {
                                confirmText: Platform.OS === 'web' ? 'Download' : 'Save',
                                cancelText: 'Cancel',
                                dontShowAgain:
                                  Platform.OS === 'web'
                                    ? {
                                        storageKey: DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_KEY,
                                        label: DOWNLOAD_ATTACHMENT_DONT_SHOW_AGAIN_LABEL,
                                      }
                                    : {
                                        storageKey: SAVE_TO_PHONE_DONT_SHOW_AGAIN_KEY,
                                        label: SAVE_TO_PHONE_DONT_SHOW_AGAIN_LABEL,
                                      },
                              })
                            : true;
                          if (!ok) return;
                        } catch {
                          // ignore prompt failures; proceed
                        }
                        await saveMediaUrlToDevice({
                          url: downloadUrl,
                          kind: 'file',
                          fileName: m2.fileName,
                          onSuccess:
                            Platform.OS === 'web'
                              ? undefined
                              : () => onToast?.('Media Saved', 'success'),
                          onError:
                            Platform.OS === 'web'
                              ? undefined
                              : (m) => onToast?.(String(m || 'Download Failed'), 'error'),
                        });
                      })();

                    if (isNarrow) {
                      return (
                        <View
                          style={[
                            styles.fileSlideNarrowColumn,
                            { maxWidth: Math.max(0, maxContentW) },
                          ]}
                        >
                          {iconName ? (
                            <View style={styles.fileSlideNarrowIconWrap}>
                              <MaterialCommunityIcons
                                name={iconName as never}
                                size={48}
                                color={iconColor}
                              />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.fileSlideBadge,
                                isDark ? styles.fileSlideBadgeDark : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.fileSlideBadgeText,
                                  isDark ? styles.fileSlideBadgeTextDark : null,
                                ]}
                                numberOfLines={1}
                              >
                                {badge}
                              </Text>
                            </View>
                          )}

                          <Text
                            style={[
                              styles.fileSlideName,
                              styles.fileSlideNameNarrow,
                              styles.fileSlideNarrowText,
                              isDark ? styles.fileSlideNameDark : null,
                            ]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {name}
                          </Text>

                          <Text
                            style={[
                              styles.fileSlideMeta,
                              styles.fileSlideNarrowText,
                              isDark ? styles.fileSlideMetaDark : null,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {size ? `${label} · ${formatBytes(size)}` : label}
                          </Text>

                          {downloadUrl ? (
                            <Pressable
                              onPress={runDownload}
                              accessibilityRole="button"
                              accessibilityLabel={`Download ${name}`}
                              hitSlop={10}
                              style={({ pressed }) => [
                                styles.fileSlideDownloadBtn,
                                pressed ? { opacity: 0.85 } : null,
                              ]}
                            >
                              <MaterialCommunityIcons
                                name={'download' as never}
                                size={22}
                                color={
                                  isDark
                                    ? APP_COLORS.dark.text.primary
                                    : APP_COLORS.light.text.primary
                                }
                              />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    }

                    return (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          maxWidth: maxContentW,
                          alignSelf: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 12,
                        }}
                      >
                        {iconName ? (
                          <View style={styles.fileSlideIconWrap}>
                            <MaterialCommunityIcons
                              name={iconName as never}
                              size={44}
                              color={iconColor}
                            />
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.fileSlideBadge,
                              isDark ? styles.fileSlideBadgeDark : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.fileSlideBadgeText,
                                isDark ? styles.fileSlideBadgeTextDark : null,
                              ]}
                              numberOfLines={1}
                            >
                              {badge}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                          <View style={styles.fileSlideTitleRow}>
                            <Text
                              style={[
                                styles.fileSlideName,
                                isDark ? styles.fileSlideNameDark : null,
                              ]}
                              numberOfLines={2}
                              ellipsizeMode="tail"
                            >
                              {name}
                            </Text>
                            {downloadUrl && !isNarrow ? (
                              <Pressable
                                onPress={runDownload}
                                accessibilityRole="button"
                                accessibilityLabel={`Download ${name}`}
                                hitSlop={10}
                                style={({ pressed }) => [
                                  styles.fileSlideDownloadBtn,
                                  pressed ? { opacity: 0.85 } : null,
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name={'download' as never}
                                  size={20}
                                  color={
                                    isDark
                                      ? APP_COLORS.dark.text.primary
                                      : APP_COLORS.light.text.primary
                                  }
                                />
                              </Pressable>
                            ) : null}
                          </View>
                          <Text
                            style={[styles.fileSlideMeta, isDark ? styles.fileSlideMetaDark : null]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {size ? `${label} · ${formatBytes(size)}` : label}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Web: explicit left/right controls for multi-attachment messages */}
      {Platform.OS === 'web' && n > 1 && webHover ? (
        <>
          <Pressable
            style={[styles.mediaCarouselNavBtn, styles.mediaCarouselNavLeft]}
            onPress={() => goTo((pageIdxRef.current - 1 + n) % n)}
            accessibilityRole="button"
            accessibilityLabel="Previous attachment"
          >
            <Text style={styles.mediaCarouselNavText}>‹</Text>
          </Pressable>
          <Pressable
            style={[styles.mediaCarouselNavBtn, styles.mediaCarouselNavRight]}
            onPress={() => goTo((pageIdxRef.current + 1) % n)}
            accessibilityRole="button"
            accessibilityLabel="Next attachment"
          >
            <Text style={styles.mediaCarouselNavText}>›</Text>
          </Pressable>
        </>
      ) : null}

      {/* Count badge overlay */}
      {n > 1 ? (
        <View style={styles.mediaCountBadge}>
          <Text style={styles.mediaCountBadgeText}>{`${pageIdx + 1}/${n}`}</Text>
        </View>
      ) : null}

      {/* Dots overlay (tap-able) */}
      {n > 1 ? (
        <View
          style={[
            styles.mediaDotsOverlay,
            ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : []),
          ]}
          {...(Platform.OS === 'web' ? {} : { pointerEvents: 'box-none' as const })}
        >
          <View style={styles.mediaDotsRow}>
            {mediaList.map((_, i) => {
              const active = i === pageIdx;
              return (
                <Pressable
                  key={`dot:${messageId}:${i}`}
                  onPress={() => goTo(i)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Attachment ${i + 1} of ${n}`}
                  style={({ pressed }) => [pressed ? { opacity: 0.85 } : null]}
                >
                  <View style={[styles.mediaDot, active ? styles.mediaDotActive : null]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mediaFill: { width: '100%', height: '100%' },
  videoThumbWrap: { position: 'relative', overflow: 'hidden' },
  mediaCappedImage: { backgroundColor: 'transparent' },
  imageThumbWrap: { overflow: 'hidden', backgroundColor: withAlpha(PALETTE.black, 0.06) },
  fileSlideOuter: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  fileSlideOuterLight: { backgroundColor: withAlpha(PALETTE.black, 0.06) },
  fileSlideOuterDark: { backgroundColor: withAlpha(PALETTE.white, 0.06) },
  fileSlideIconWrap: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  fileSlideBadge: {
    minWidth: 50,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(APP_COLORS.light.brand.primary, 0.12),
    marginRight: 6,
  },
  fileSlideBadgeDark: { backgroundColor: withAlpha(APP_COLORS.light.brand.primary, 0.22) },
  fileSlideBadgeText: { color: APP_COLORS.light.brand.primary, fontWeight: '900', fontSize: 12 },
  fileSlideBadgeTextDark: { color: APP_COLORS.dark.text.primary },
  fileSlideName: {
    color: APP_COLORS.light.text.primary,
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
  },
  // In the narrow stacked layout, the filename should NOT expand to fill vertical space.
  fileSlideNameNarrow: { flexGrow: 0 },
  fileSlideNameDark: { color: APP_COLORS.dark.text.primary },
  fileSlideTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  fileSlideMeta: {
    color: APP_COLORS.light.text.secondary,
    fontWeight: '700',
    fontSize: 12,
    flexShrink: 1,
  },
  fileSlideMetaDark: { color: APP_COLORS.dark.text.secondary },
  fileSlideDownloadBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  fileSlideNarrowColumn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  fileSlideNarrowIconWrap: { marginBottom: 6 },
  fileSlideNarrowText: { textAlign: 'center' },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayText: { color: APP_COLORS.dark.text.primary, fontSize: 28, fontWeight: '900' },
  mediaCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(PALETTE.black, 0.55),
    zIndex: 5,
  },
  mediaCountBadgeText: { color: APP_COLORS.dark.text.primary, fontWeight: '900', fontSize: 12 },
  mediaCarouselNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(PALETTE.black, 0.35),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(PALETTE.white, 0.18),
    zIndex: 7,
  },
  mediaCarouselNavLeft: { left: 10 },
  mediaCarouselNavRight: { right: 10 },
  mediaCarouselNavText: {
    color: APP_COLORS.dark.text.primary,
    fontWeight: '900',
    fontSize: 22,
    lineHeight: 22,
    marginTop: -1,
  },
  mediaDotsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  mediaDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(PALETTE.black, 0.28),
  },
  mediaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: withAlpha(PALETTE.white, 0.45),
  },
  mediaDotActive: {
    backgroundColor: APP_COLORS.dark.text.primary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
