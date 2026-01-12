import * as React from 'react';
import { Animated, Platform } from 'react-native';

export type ToastKind = 'success' | 'error';
export type ToastState = { message: string; kind: ToastKind };

export function useToast(opts?: { visibleMs?: number; fadeInMs?: number; fadeOutMs?: number }): {
  toast: ToastState | null;
  anim: Animated.Value;
  showToast: (message: string, kind?: ToastKind) => void;
  hideToast: () => void;
} {
  const visibleMs = typeof opts?.visibleMs === 'number' ? opts!.visibleMs : 1800;
  const fadeInMs = typeof opts?.fadeInMs === 'number' ? opts!.fadeInMs : 180;
  const fadeOutMs = typeof opts?.fadeOutMs === 'number' ? opts!.fadeOutMs : 180;

  const [toast, setToast] = React.useState<ToastState | null>(null);
  const anim = React.useRef(new Animated.Value(0)).current;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    anim.stopAnimation();
    Animated.timing(anim, {
      toValue: 0,
      duration: fadeOutMs,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setToast(null);
    });
  }, [anim, fadeOutMs]);

  const showToast = React.useCallback(
    (message: string, kind: ToastKind = 'success') => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setToast({ message, kind });
      anim.stopAnimation();
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: fadeInMs,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      timerRef.current = setTimeout(() => {
        hideToast();
      }, visibleMs);
    },
    [anim, fadeInMs, hideToast, visibleMs],
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, anim, showToast, hideToast };
}
