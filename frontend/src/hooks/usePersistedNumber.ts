import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function usePersistedNumber(opts: {
  storageKey: string;
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
  enabled?: boolean;
  normalize?: (n: number) => number;
}): void {
  const key = String(opts.storageKey || '').trim();
  const enabled = opts.enabled !== false;
  // `normalize` is commonly passed as an inline function; keep it in a ref so
  // this hook doesn't accidentally create an effect loop.
  const normalizeRef = React.useRef<typeof opts.normalize>(opts.normalize);
  React.useEffect(() => {
    normalizeRef.current = opts.normalize;
  }, [opts.normalize]);

  const normalize = React.useCallback((n: number) => {
    const fn = normalizeRef.current;
    if (typeof fn === 'function') return fn(n);
    return Number.isFinite(n) ? n : 0;
  }, []);
  const value = normalize(Number(opts.value));
  const setValue = opts.setValue;

  React.useEffect(() => {
    if (!enabled) return;
    if (!key) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;
        const v = raw ? Number(raw) : 0;
        const next = normalize(v);
        setValue((prev) => (prev === next ? prev : next));
      } catch {
        if (cancelled) return;
        const next = normalize(0);
        setValue((prev) => (prev === next ? prev : next));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, key, normalize, setValue]);

  React.useEffect(() => {
    if (!enabled) return;
    if (!key) return;
    (async () => {
      try {
        await AsyncStorage.setItem(key, String(value));
      } catch {
        // ignore
      }
    })();
  }, [enabled, key, value]);
}

