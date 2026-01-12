import * as React from 'react';
import { Platform } from 'react-native';

type WheelEventLike =
  | { deltaY?: number | string | null }
  | { nativeEvent?: { deltaY?: number | string | null } | null }
  | null
  | undefined;

function getDeltaY(e: WheelEventLike): number {
  if (!e || typeof e !== 'object') return 0;
  const v = 'deltaY' in e ? e.deltaY : 'nativeEvent' in e ? e.nativeEvent?.deltaY : 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function useWebWheelRefresh(opts: {
  enabled: boolean;
  atBottomRef: React.MutableRefObject<boolean>;
  refreshing: boolean;
  cooldownMs?: number;
  onRefresh: () => void;
}): { onWheel?: (e: WheelEventLike) => void } {
  const { enabled, atBottomRef, refreshing, onRefresh, cooldownMs = 900 } = opts;
  const lastWheelRefreshMsRef = React.useRef<number>(0);

  const onWheel = React.useCallback(
    (e: WheelEventLike) => {
      if (!enabled || Platform.OS !== 'web') return;
      try {
        if (!atBottomRef.current) return;
        const dy = getDeltaY(e);
        if (!Number.isFinite(dy) || dy <= 0) return;
        if (refreshing) return;
        const now = Date.now();
        if (now - lastWheelRefreshMsRef.current < cooldownMs) return;
        lastWheelRefreshMsRef.current = now;
        onRefresh();
      } catch {
        // ignore
      }
    },
    [enabled, atBottomRef, refreshing, cooldownMs, onRefresh],
  );

  return enabled && Platform.OS === 'web' ? { onWheel } : {};
}

