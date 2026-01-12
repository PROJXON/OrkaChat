import * as React from 'react';
import { Platform } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { FlatList } from 'react-native';
import { getNativeEventNumber } from '../utils/nativeEvent';

export type UseWebPinnedListArgs = {
  // Enabled only on web.
  enabled: boolean;
  // Current number of list items (used to trigger first-time scroll).
  itemCount: number;
  // Called when the user is near the top (web non-inverted list).
  onNearTop?: () => void;
  // Guards for onNearTop.
  canLoadMore?: () => boolean;
  topThresholdPx?: number;
  bottomThresholdPx?: number;
};

export type WebPinnedListState<TItem> = {
  listRef: React.MutableRefObject<FlatList<TItem> | null>;
  ready: boolean;
  didInitialScrollRef: React.MutableRefObject<boolean>;
  atBottomRef: React.MutableRefObject<boolean>;
  scrollToBottom: (animated: boolean) => void;
  kickInitialScrollToEnd: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  onContentSizeChange?: (w: number, h: number) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export function useWebPinnedList<TItem = unknown>({
  enabled,
  itemCount,
  onNearTop,
  canLoadMore,
  topThresholdPx = 40,
  bottomThresholdPx = 80,
}: UseWebPinnedListArgs): WebPinnedListState<TItem> {
  const listRef = React.useRef<FlatList<TItem> | null>(null);

  const didInitialScrollRef = React.useRef<boolean>(false);
  const atBottomRef = React.useRef<boolean>(true);
  const [ready, setReady] = React.useState<boolean>(!enabled || Platform.OS !== 'web');

  const initScrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const initScrollAttemptsRef = React.useRef<number>(0);
  const viewportHRef = React.useRef<number>(0);
  const contentHRef = React.useRef<number>(0);

  const scrollToBottom = React.useCallback(
    (animated: boolean) => {
      if (!enabled || Platform.OS !== 'web') return;
      const list = listRef.current;
      const viewportH = Math.max(0, Math.floor(viewportHRef.current || 0));
      const contentH = Math.max(0, Math.floor(contentHRef.current || 0));
      const endY = viewportH > 0 ? Math.max(0, contentH - viewportH) : null;

      // Prefer explicit offset (more reliable than scrollToEnd on RN-web when content height changes).
      if (typeof endY === 'number' && Number.isFinite(endY) && list?.scrollToOffset) {
        list.scrollToOffset({ offset: endY + 9999, animated: !!animated });
        return;
      }
      if (list?.scrollToEnd) list.scrollToEnd({ animated: !!animated });
    },
    [enabled],
  );

  const kickInitialScrollToEnd = React.useCallback(() => {
    if (!enabled || Platform.OS !== 'web') return;
    if (initScrollTimerRef.current) clearTimeout(initScrollTimerRef.current);
    initScrollAttemptsRef.current = 0;
    const step = () => {
      scrollToBottom(false);
      initScrollAttemptsRef.current += 1;
      // Give RN-web a few layout/virtualization ticks to settle before we reveal.
      if (initScrollAttemptsRef.current < 10) {
        initScrollTimerRef.current = setTimeout(step, 50);
      } else {
        setReady(true);
      }
    };
    step();
  }, [enabled, scrollToBottom]);

  React.useEffect(() => {
    return () => {
      if (initScrollTimerRef.current) clearTimeout(initScrollTimerRef.current);
    };
  }, []);

  // Web: when items first appear, start at the bottom (newest).
  React.useLayoutEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    if (didInitialScrollRef.current) return;
    if (!itemCount) return;
    didInitialScrollRef.current = true;
    kickInitialScrollToEnd();
  }, [enabled, itemCount, kickInitialScrollToEnd]);

  const onLayout = React.useMemo<((e: LayoutChangeEvent) => void) | undefined>(() => {
    if (!enabled || Platform.OS !== 'web') return undefined;
    return (e: LayoutChangeEvent) => {
      const h = getNativeEventNumber(e, ['nativeEvent', 'layout', 'height']);
      if (Number.isFinite(h) && h > 0) viewportHRef.current = h;
      if (!ready) kickInitialScrollToEnd();
    };
  }, [enabled, kickInitialScrollToEnd, ready]);

  const onContentSizeChange = React.useMemo<((w: number, h: number) => void) | undefined>(() => {
    if (!enabled || Platform.OS !== 'web') return undefined;
    return (_w: number, h: number) => {
      const hh = Number(h ?? 0);
      if (Number.isFinite(hh) && hh > 0) contentHRef.current = hh;
      // If the user is already at bottom (or this is the first render), keep pinned to the bottom.
      if (!didInitialScrollRef.current || atBottomRef.current) {
        scrollToBottom(false);
        didInitialScrollRef.current = true;
      }
      // While we haven't revealed yet, keep trying to pin to the bottom.
      if (!ready) kickInitialScrollToEnd();
    };
  }, [enabled, kickInitialScrollToEnd, ready, scrollToBottom]);

  const onScroll = React.useMemo<((e: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined>(() => {
    if (!enabled || Platform.OS !== 'web') return undefined;
    return (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Track whether the user is near the bottom so we don't hijack scroll while reading older messages.
      try {
        const y = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'y']);
        const viewportH = getNativeEventNumber(e, ['nativeEvent', 'layoutMeasurement', 'height']);
        const contentH = getNativeEventNumber(e, ['nativeEvent', 'contentSize', 'height']);
        const distFromBottom = contentH - (y + viewportH);
        atBottomRef.current = Number.isFinite(distFromBottom) ? distFromBottom <= bottomThresholdPx : true;
      } catch {
        // ignore
      }

      if (onNearTop) {
        try {
          if (canLoadMore && !canLoadMore()) return;
        } catch {
          // ignore
        }
        const y = getNativeEventNumber(e, ['nativeEvent', 'contentOffset', 'y']);
        if (y <= topThresholdPx) onNearTop();
      }
    };
  }, [enabled, onNearTop, canLoadMore, topThresholdPx, bottomThresholdPx]);

  return {
    listRef,
    ready,
    didInitialScrollRef,
    atBottomRef,
    scrollToBottom,
    kickInitialScrollToEnd,
    onLayout,
    onContentSizeChange,
    onScroll,
  };
}
