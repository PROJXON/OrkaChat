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
  const normalize =
    typeof opts.normalize === 'function'
      ? opts.normalize
      : (n: number) => (Number.isFinite(n) ? n : 0);
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
        setValue(normalize(v));
      } catch {
        if (!cancelled) setValue(normalize(0));
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

