import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnimatedDots } from './AnimatedDots';

export type MediaStackCarouselItem = {
  path: string;
  thumbPath?: string;
  kind: 'image' | 'video' | 'file';
  contentType?: string;
  fileName?: string;
};

export function MediaStackCarousel({
  messageId,
  mediaList,
  width,
  height,
  isDark,
  uriByPath,
  onOpen,
}: {
  messageId: string;
  mediaList: MediaStackCarouselItem[];
  width: number;
  height: number;
  isDark: boolean;
  uriByPath: Record<string, string>;
  onOpen: (idx: number, media: MediaStackCarouselItem) => void;
}): React.JSX.Element | null {
  const n = Array.isArray(mediaList) ? mediaList.length : 0;
  const scrollRef = React.useRef<ScrollView | null>(null);
  const scrollXRef = React.useRef<number>(0);
  const [pageIdx, setPageIdx] = React.useState<number>(0);
  const pageIdxRef = React.useRef<number>(0);
  const [webHover, setWebHover] = React.useState<boolean>(false);

  React.useEffect(() => {
    pageIdxRef.current = pageIdx;
  }, [pageIdx]);

  const goTo = React.useCallback(
    (idx: number) => {
      const safe = Math.max(0, Math.min(n - 1, idx));
      setPageIdx(safe);
      try {
        scrollRef.current?.scrollTo({ x: width * safe, y: 0, animated: true });
      } catch {
        // ignore
      }
    },
    [n, width]
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
        onScroll={(e: any) => {
          const x = Number(e?.nativeEvent?.contentOffset?.x ?? 0);
          scrollXRef.current = x;
        }}
        onMomentumScrollEnd={(e: any) => {
          const x = Number(e?.nativeEvent?.contentOffset?.x ?? 0);
          const next = Math.max(0, Math.min(n - 1, Math.round(x / Math.max(1, width))));
          setPageIdx(next);
        }}
        {...(Platform.OS === 'web'
          ? {
              // Web: map vertical wheel to horizontal paging so trackpad/mouse wheel "swipes" work naturally.
              onWheel: (e: any) => {
                const dx = Number(e?.nativeEvent?.deltaX ?? 0);
                const dy = Number(e?.nativeEvent?.deltaY ?? 0);
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
        {mediaList.map((m, idx) => {
          const ct = String(m?.contentType || '');
          const looksImage = m.kind === 'image' || (m.kind === 'file' && ct.startsWith('image/'));
          const looksVideo = m.kind === 'video' || (m.kind === 'file' && ct.startsWith('video/'));
          const thumbKey = String(m.thumbPath || m.path || '');
          const thumbUri = thumbKey ? uriByPath[thumbKey] : '';
          const onPress = () => onOpen(idx, m);

          return (
            <Pressable
              key={`page:${messageId}:${thumbKey}:${idx}`}
              onPress={onPress}
              style={{ width, height }}
              accessibilityRole="button"
              accessibilityLabel="Open attachment"
            >
              {thumbUri && (looksImage || looksVideo) ? (
                looksImage ? (
                  <Image source={{ uri: thumbUri }} style={[styles.mediaCappedImage, { width, height }]} resizeMode="contain" />
                ) : (
                  <View style={[styles.videoThumbWrap, { width, height }]}>
                    <Image source={{ uri: thumbUri }} style={styles.mediaFill} resizeMode="cover" />
                    <View style={styles.videoPlayOverlay}>
                      <Text style={styles.videoPlayText}>▶</Text>
                    </View>
                  </View>
                )
              ) : looksImage || looksVideo ? (
                <View style={[styles.imageThumbWrap, { width, height, justifyContent: 'center', alignItems: 'center' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '800', fontSize: 14 }}>Loading</Text>
                    <AnimatedDots color={isDark ? '#fff' : '#111'} size={16} />
                  </View>
                </View>
              ) : (
                <View style={[styles.imageThumbWrap, { width, height, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '800' }}>
                    {m.fileName ? m.fileName : 'Attachment'}
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
  videoThumbWrap: { position: 'relative', overflow: 'hidden', borderRadius: 16 },
  mediaCappedImage: { borderRadius: 16, backgroundColor: 'transparent' },
  imageThumbWrap: { borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.06)' },
  videoPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
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

