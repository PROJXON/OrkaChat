import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedDots } from '../AnimatedDots';
import type { MediaItem } from '../../types/media';
import { getNativeEventNumber } from '../../utils/nativeEvent';
import { isImageLike, isVideoLike } from '../../utils/mediaKinds';

export function MediaStackCarousel({
  messageId,
  mediaList,
  width,
  height,
  isDark,
  uriByPath,
  thumbUriByPath,
  cornerRadius = 16,
  loop = false,
  loadingTextColor,
  loadingDotsColor,
  onOpen,
}: {
  messageId: string;
  mediaList: MediaItem[];
  width: number;
  height: number;
  isDark: boolean;
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
  onOpen: (idx: number, media: MediaItem) => void;
}): React.JSX.Element | null {
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
  const [pageIdx, setPageIdx] = React.useState<number>(0);
  const pageIdxRef = React.useRef<number>(0);
  const [webHover, setWebHover] = React.useState<boolean>(false);

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
        scrollRef.current?.scrollTo({ x: width, y: 0, animated: false });
      } catch {
        // ignore
      }
    }, 0);
  }, [messageId, loopEnabled, width]);

  const goTo = React.useCallback(
    (idx: number) => {
      const safe = Math.max(0, Math.min(n - 1, idx));
      setPageIdx(safe);
      try {
        const offset = loopEnabled ? 1 : 0;
        scrollRef.current?.scrollTo({ x: width * (safe + offset), y: 0, animated: true });
      } catch {
        // ignore
      }
    },
    [loopEnabled, n, width],
  );

  if (!n) return null;

  return (
    <View
      style={{ width, position: 'relative' }}
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
        snapToInterval={width}
        decelerationRate="fast"
        directionalLockEnabled
        style={{ width, height }}
        scrollEventThrottle={16}
        onScroll={(e: unknown) => {
          const x = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'x']);
          scrollXRef.current = x;
          if (!loopEnabled) return;
          const raw = Math.round(x / Math.max(1, width)); // 0..n+1
          const nextIdx = raw === 0 ? n - 1 : raw === n + 1 ? 0 : Math.max(0, Math.min(n - 1, raw - 1));
          if (nextIdx !== pageIdxRef.current) setPageIdx(nextIdx);
        }}
        onMomentumScrollEnd={(e: unknown) => {
          const x = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'x']);
          if (!loopEnabled) {
            const next = Math.max(0, Math.min(n - 1, Math.round(x / Math.max(1, width))));
            setPageIdx(next);
            return;
          }
          const raw = Math.round(x / Math.max(1, width)); // 0..n+1
          if (raw === 0) {
            // Jump to last real page
            try {
              scrollRef.current?.scrollTo({ x: width * n, y: 0, animated: false });
            } catch {
              // ignore
            }
            setPageIdx(n - 1);
          } else if (raw === n + 1) {
            // Jump to first real page
            try {
              scrollRef.current?.scrollTo({ x: width, y: 0, animated: false });
            } catch {
              // ignore
            }
            setPageIdx(0);
          } else {
            setPageIdx(Math.max(0, Math.min(n - 1, raw - 1)));
          }
        }}
        {...(Platform.OS === 'web'
          ? {
              // Web: map vertical wheel to horizontal paging so trackpad/mouse wheel "swipes" work naturally.
              onWheel: (e: unknown) => {
                const dx = getNativeEventNumber(e, ['nativeEvent', 'deltaX']);
                const dy = getNativeEventNumber(e, ['nativeEvent', 'deltaY']);
                if (Math.abs(dy) <= Math.abs(dx)) return;
                try {
                  scrollRef.current?.scrollTo({ x: Math.max(0, scrollXRef.current + dy), y: 0, animated: false });
                } catch {
                  // ignore
                }
              },
            }
          : {})}
      >
        {pages.map((m2, idx2) => {
          const looksImage = isImageLike(m2);
          const looksVideo = isVideoLike(m2);
          const thumbKey = String(m2.thumbPath || m2.path || '');
          const thumbUriFromThumbMap =
            m2.thumbPath && thumbUriByPath ? String(thumbUriByPath[String(m2.thumbPath)] || '') : '';
          const thumbUri = thumbUriFromThumbMap || (thumbKey ? String(uriByPath[thumbKey] || '') : '');

          // Map extended pages → real index.
          const realIndex = !loopEnabled ? idx2 : idx2 === 0 ? n - 1 : idx2 === n + 1 ? 0 : idx2 - 1;

          const loadingText = loadingTextColor ?? (isDark ? '#fff' : '#111');
          const loadingDots = loadingDotsColor ?? loadingText;
          const onPress = () => onOpen(realIndex, mediaList[realIndex]);

          return (
            <Pressable
              key={`page:${messageId}:${thumbKey}:${idx2}`}
              onPress={onPress}
              style={{ width, height }}
              accessibilityRole="button"
              accessibilityLabel="Open attachment"
            >
              {thumbUri && (looksImage || looksVideo) ? (
                looksImage ? (
                  <Image
                    source={{ uri: thumbUri }}
                    style={[styles.mediaCappedImage, { width, height, borderRadius: cornerRadius }]}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.videoThumbWrap, { width, height, borderRadius: cornerRadius }]}>
                    <Image source={{ uri: thumbUri }} style={styles.mediaFill} resizeMode="cover" />
                    <View style={styles.videoPlayOverlay}>
                      <Text style={styles.videoPlayText}>▶</Text>
                    </View>
                  </View>
                )
              ) : looksImage || looksVideo ? (
                <View
                  style={[
                    styles.imageThumbWrap,
                    { width, height, justifyContent: 'center', alignItems: 'center', borderRadius: cornerRadius },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: loadingText, fontWeight: '800', fontSize: 14 }}>Loading</Text>
                    <AnimatedDots color={loadingDots} size={16} />
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.imageThumbWrap,
                    { width, height, justifyContent: 'center', alignItems: 'center', borderRadius: cornerRadius },
                  ]}
                >
                  <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '800' }}>
                    {m2.fileName ? m2.fileName : 'Attachment'}
                  </Text>
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
          style={[styles.mediaDotsOverlay, ...(Platform.OS === 'web' ? [{ pointerEvents: 'box-none' as const }] : [])]}
          pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
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
  imageThumbWrap: { overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.06)' },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  mediaCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 5,
  },
  mediaCountBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  mediaCarouselNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 7,
  },
  mediaCarouselNavLeft: { left: 10 },
  mediaCarouselNavRight: { right: 10 },
  mediaCarouselNavText: { color: '#fff', fontWeight: '900', fontSize: 22, lineHeight: 22, marginTop: -1 },
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
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  mediaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  mediaDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
