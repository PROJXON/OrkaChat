import React from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AnimatedDots } from '../AnimatedDots';
import { FullscreenVideo } from './FullscreenVideo';
import { isWebCoarsePointer } from '../../utils/responsive';
import type { MediaKind } from '../../types/media';

type ViewerItem = { url: string; kind: MediaKind; fileName?: string };

export type MediaViewerState = null | {
  mode: 'global' | 'dm' | 'gdm';
  index: number;
  globalItems?: ViewerItem[];
  dmItems?: Array<{ media: { path?: string; kind?: MediaKind; fileName?: string } }>;
  gdmItems?: Array<{ media: { path?: string; kind?: MediaKind; fileName?: string } }>;
};

export function MediaViewerModal({
  open,
  viewerState,
  setViewerState,
  dmFileUriByPath,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  viewerState: MediaViewerState;
  setViewerState: React.Dispatch<React.SetStateAction<MediaViewerState>>;
  dmFileUriByPath?: Record<string, string>;
  onClose: () => void;
  onSave?: () => void | Promise<void>;
  saving?: boolean;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const viewerScrollRef = React.useRef<ScrollView | null>(null);
  const [chromeVisible, setChromeVisible] = React.useState<boolean>(true);
  const chromeHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeOpacity = React.useRef(new Animated.Value(1)).current;
  const chromeLastPointerAtRef = React.useRef<number>(0);
  const isTouchWeb = Platform.OS === 'web' && isWebCoarsePointer();

  const getItemAt = React.useCallback(
    (vs: MediaViewerState, i: number): ViewerItem | null => {
      if (!vs) return null;
      if (vs.mode === 'global') return vs.globalItems?.[i] ?? null;
      if (vs.mode === 'dm') {
        const it = vs.dmItems?.[i];
        const key = it?.media?.path;
        if (!key) return null;
        const url = (dmFileUriByPath?.[key] || '') as string;
        const k = it?.media?.kind;
        const kind = k === 'video' ? 'video' : k === 'image' ? 'image' : 'file';
        return { url, kind, fileName: it?.media?.fileName };
      }
      if (vs.mode === 'gdm') {
        const it = vs.gdmItems?.[i];
        const key = it?.media?.path;
        if (!key) return null;
        const url = (dmFileUriByPath?.[key] || '') as string;
        const k = it?.media?.kind;
        const kind = k === 'video' ? 'video' : k === 'image' ? 'image' : 'file';
        return { url, kind, fileName: it?.media?.fileName };
      }
      return null;
    },
    [dmFileUriByPath],
  );

  const getCount = React.useCallback((vs: MediaViewerState) => {
    if (!vs) return 0;
    return vs.mode === 'global'
      ? (vs.globalItems?.length ?? 0)
      : vs.mode === 'dm'
        ? (vs.dmItems?.length ?? 0)
        : vs.mode === 'gdm'
          ? (vs.gdmItems?.length ?? 0)
          : 0;
  }, []);

  const showChromeBriefly = React.useCallback(() => {
    // On touch/mobile web, hiding chrome makes it hard to recover controls (especially over <video>).
    // Keep chrome visible; the user can still dismiss the modal or navigate attachments.
    if (isTouchWeb) {
      setChromeVisible(true);
      if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = null;
      return;
    }
    setChromeVisible(true);
    if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
    chromeHideTimerRef.current = setTimeout(() => setChromeVisible(false), 1500);
  }, [isTouchWeb]);

  // Allow rotating the device while the fullscreen media viewer is open,
  // but keep the rest of the app portrait-locked.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        await ScreenOrientation.unlockAsync();
      } catch {
        // ignore (some platforms/devices may not support it)
      }
    })();
    return () => {
      cancelled = true;
      (async () => {
        if (cancelled) {
          // no-op marker; keep structure symmetrical
        }
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        } catch {
          // ignore
        }
      })();
    };
  }, [open]);

  // Fullscreen viewer chrome: show briefly on open, then hide for a clean view.
  React.useEffect(() => {
    if (!open) {
      if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = null;
      setChromeVisible(true);
      return;
    }
    setChromeVisible(true);
    if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
    if (isTouchWeb) {
      chromeHideTimerRef.current = null;
    } else {
      chromeHideTimerRef.current = setTimeout(() => setChromeVisible(false), 1500);
    }
    return () => {
      if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = null;
    };
  }, [open, isTouchWeb]);

  // If the user taps Save, keep chrome visible while saving.
  React.useEffect(() => {
    if (saving) setChromeVisible(true);
  }, [saving]);

  // Animate viewer chrome (fast fade in/out).
  React.useEffect(() => {
    Animated.timing(chromeOpacity, {
      toValue: chromeVisible ? 1 : 0,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [chromeVisible, chromeOpacity]);

  // On open, ensure we start on the requested index.
  React.useEffect(() => {
    // On web, horizontal paging ScrollView can steal pointer events from native <video> controls.
    // We render a translated row View on web (no scroll sync needed).
    if (Platform.OS === 'web') return;
    if (!open) return;
    const vs = viewerState;
    if (!vs) return;
    const count = getCount(vs);
    if (count <= 1) return;
    const w = Dimensions.get('window').width;
    const idx = Math.max(0, Math.min(count - 1, vs.index || 0));
    setTimeout(() => {
      try {
        viewerScrollRef.current?.scrollTo?.({ x: w * idx, y: 0, animated: false });
      } catch {
        // ignore
      }
    }, 0);
  }, [open, viewerState, getCount]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerOverlay}>
        <View
          style={styles.viewerCard}
          {...(Platform.OS === 'web'
            ? {
                onMouseMove: () => {
                  const now = Date.now();
                  if (now - (chromeLastPointerAtRef.current || 0) < 120) return;
                  chromeLastPointerAtRef.current = now;
                  showChromeBriefly();
                },
              }
            : {})}
        >
          {/* Web: when chrome is hidden, capture a tap/click to bring it back.
              Keep pointerEvents disabled when chrome is visible so native <video> controls remain usable. */}
          {Platform.OS === 'web' ? (
            <Pressable
              style={[StyleSheet.absoluteFillObject, { zIndex: 9 }]}
              pointerEvents={chromeVisible ? 'none' : 'auto'}
              onPress={() => showChromeBriefly()}
              accessibilityRole="button"
              accessibilityLabel="Show viewer controls"
            />
          ) : null}

          <Animated.View
            style={[
              styles.viewerTopBar,
              ...(Platform.OS === 'web'
                ? [{ pointerEvents: (chromeVisible ? 'auto' : 'none') as 'auto' | 'none' }]
                : []),
              { height: 52 + insets.top, paddingTop: insets.top, opacity: chromeOpacity },
            ]}
            pointerEvents={Platform.OS === 'web' ? undefined : chromeVisible ? 'auto' : 'none'}
          >
            {(() => {
              const vs = viewerState;
              const count = getCount(vs);
              const idx = vs ? vs.index : 0;
              const name =
                vs?.mode === 'global'
                  ? vs.globalItems?.[idx]?.fileName
                  : vs?.mode === 'dm'
                    ? vs.dmItems?.[idx]?.media?.fileName
                    : vs?.mode === 'gdm'
                      ? vs.gdmItems?.[idx]?.media?.fileName
                      : undefined;
              const title = name || (count > 1 ? `Attachment ${idx + 1}/${count}` : 'Attachment');
              return <Text style={styles.viewerTitle}>{title}</Text>;
            })()}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {onSave ? (
                <Pressable
                  style={[styles.viewerCloseBtn, saving ? { opacity: 0.6 } : null]}
                  disabled={!!saving}
                  onPress={() => void onSave()}
                >
                  <Text style={styles.viewerCloseText}>{saving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.viewerCloseBtn} onPress={onClose}>
                <Text style={styles.viewerCloseText}>Close</Text>
              </Pressable>
            </View>
          </Animated.View>

          <View style={styles.viewerBody}>
            {(() => {
              const vs = viewerState;
              if (!vs) return <Text style={styles.viewerFallback}>No preview available.</Text>;
              const count = getCount(vs);
              if (!count) return <Text style={styles.viewerFallback}>No preview available.</Text>;

              const pageW = Dimensions.get('window').width;
              const pageH = Dimensions.get('window').height - (52 + insets.top);

              if (Platform.OS === 'web') {
                // Render all pages in a translated row so we don't remount media on each index change.
                // This avoids "reload flashes" and keeps native <video> controls clickable.
                const idx = Math.max(0, Math.min(count - 1, vs.index || 0));
                return (
                  <View style={{ width: pageW, height: pageH, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: pageW * count,
                        height: pageH,
                        flexDirection: 'row',
                        transform: [{ translateX: -pageW * idx }],
                      }}
                    >
                      {Array.from({ length: count }).map((_, i) => {
                        const item = getItemAt(vs, i);
                        const url = item?.url || '';
                        const kind = item?.kind;

                        if (!url) {
                          return (
                            <View
                              key={`viewer:web:${i}`}
                              style={[
                                styles.viewerTapArea,
                                { width: pageW, height: pageH, justifyContent: 'center', alignItems: 'center' },
                              ]}
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
                            <Pressable
                              key={`viewer:web:${i}`}
                              style={[styles.viewerTapArea, { width: pageW, height: pageH }]}
                              onPress={() => setChromeVisible((v) => !v)}
                              accessibilityRole="button"
                              accessibilityLabel="Toggle controls"
                            >
                              <Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" />
                            </Pressable>
                          );
                        }

                        if (kind === 'video') {
                          // IMPORTANT: don't attach responder capture handlers on web; they can block native <video> controls.
                          return (
                            <View
                              key={`viewer:web:${i}`}
                              style={[styles.viewerTapArea, { width: pageW, height: pageH }]}
                            >
                              <FullscreenVideo url={url} style={styles.viewerVideo} />
                            </View>
                          );
                        }

                        return (
                          <View
                            key={`viewer:web:${i}`}
                            style={[
                              styles.viewerTapArea,
                              { width: pageW, height: pageH, justifyContent: 'center', alignItems: 'center' },
                            ]}
                          >
                            <Text style={styles.viewerFallback}>No preview available.</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              }

              const onMomentumEnd = (e: unknown) => {
                const x = (() => {
                  if (!e || typeof e !== 'object') return 0;
                  const rec = e as Record<string, unknown>;
                  const ne = rec.nativeEvent;
                  if (!ne || typeof ne !== 'object') return 0;
                  const neRec = ne as Record<string, unknown>;
                  const co = neRec.contentOffset;
                  if (!co || typeof co !== 'object') return 0;
                  const coRec = co as Record<string, unknown>;
                  const n = Number(coRec.x);
                  return Number.isFinite(n) ? n : 0;
                })();
                const w = Number(Dimensions.get('window')?.width ?? 1);
                const next = Math.max(0, Math.min(count - 1, Math.round(x / Math.max(1, w))));
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
                    const item: ViewerItem | null = getItemAt(vs, i);

                    const url = item?.url || '';
                    const kind = item?.kind;
                    if (!url) {
                      return (
                        <View
                          key={`viewer:${i}`}
                          style={[
                            styles.viewerTapArea,
                            { width: pageW, height: pageH, justifyContent: 'center', alignItems: 'center' },
                          ]}
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
                        <Pressable
                          key={`viewer:${i}`}
                          style={[styles.viewerTapArea, { width: pageW, height: pageH }]}
                          onPress={() => setChromeVisible((v) => !v)}
                          accessibilityRole="button"
                          accessibilityLabel="Toggle controls"
                        >
                          <Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" />
                        </Pressable>
                      );
                    }

                    if (kind === 'video') {
                      return (
                        <View
                          key={`viewer:${i}`}
                          style={[styles.viewerTapArea, { width: pageW, height: pageH }]}
                          // IMPORTANT: don't steal taps from native controls
                          onStartShouldSetResponderCapture={() => {
                            if (!chromeVisible) showChromeBriefly();
                            return false;
                          }}
                        >
                          <FullscreenVideo url={url} style={styles.viewerVideo} />
                        </View>
                      );
                    }

                    return (
                      <View
                        key={`viewer:${i}`}
                        style={[
                          styles.viewerTapArea,
                          { width: pageW, height: pageH, justifyContent: 'center', alignItems: 'center' },
                        ]}
                      >
                        <Text style={styles.viewerFallback}>No preview available.</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              );
            })()}

            {/* Web: swipe/drag paging can be flaky; provide explicit nav controls for multi-media. */}
            {Platform.OS === 'web' && viewerState
              ? (() => {
                  const vs = viewerState;
                  const count = getCount(vs);
                  if (count <= 1) return null;
                  const idx = vs.index || 0;
                  const go = (dir: -1 | 1) => {
                    const next = (idx + dir + count) % count;
                    setViewerState((prev) => (prev ? { ...prev, index: next } : prev));
                  };
                  return (
                    <Animated.View
                      style={[StyleSheet.absoluteFillObject, { opacity: chromeOpacity, zIndex: 11 }]}
                      pointerEvents="box-none"
                    >
                      <Pressable
                        style={[styles.viewerNavBtn, styles.viewerNavLeft]}
                        onPress={() => go(-1)}
                        accessibilityRole="button"
                        accessibilityLabel="Previous attachment"
                      >
                        <Text style={styles.viewerNavText}>‹</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.viewerNavBtn, styles.viewerNavRight]}
                        onPress={() => go(1)}
                        accessibilityRole="button"
                        accessibilityLabel="Next attachment"
                      >
                        <Text style={styles.viewerNavText}>›</Text>
                      </Pressable>
                    </Animated.View>
                  );
                })()
              : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  viewerCard: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  viewerTopBar: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  viewerTitle: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1, marginRight: 12 },
  viewerCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  viewerCloseText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  viewerBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerTapArea: { flex: 1, width: '100%', height: '100%' },
  viewerNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 11,
  },
  viewerNavLeft: { left: 12 },
  viewerNavRight: { right: 12 },
  viewerNavText: { color: '#fff', fontWeight: '900', fontSize: 28, lineHeight: 28, marginTop: -2 },
  // RN-web deprecates `style.resizeMode`; use the Image prop instead.
  viewerImage: { width: '100%', height: '100%' },
  viewerVideo: { width: '100%', height: '100%' },
  viewerFallback: { color: '#fff' },
});
