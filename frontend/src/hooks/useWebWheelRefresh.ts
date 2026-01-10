import * as React from 'react';
import { Platform } from 'react-native';

export function useWebWheelRefresh(opts: {
  enabled: boolean;
  atBottomRef: React.MutableRefObject<boolean>;
  refreshing: boolean;
  cooldownMs?: number;
  onRefresh: () => void;
}): { onWheel?: (e: unknown) => void } {
  const { enabled, atBottomRef, refreshing, onRefresh, cooldownMs = 900 } = opts;
  const lastWheelRefreshMsRef = React.useRef<number>(0);

  const onWheel = React.useCallback(
    (e: unknown) => {
      if (!enabled || Platform.OS !== 'web') return;
      try {
        if (!atBottomRef.current) return;
        const dy = Number((e as any)?.deltaY ?? 0);
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

