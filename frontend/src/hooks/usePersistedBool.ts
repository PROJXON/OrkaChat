import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

// Persists a boolean as "1" / "0".
// Important: if the stored value is missing/unknown, we DO NOT overwrite current state
// (matches the previous ChatScreen autoDecrypt behavior).
export function usePersistedBool(opts: {
  storageKey: string;
  value: boolean;
  setValue: React.Dispatch<React.SetStateAction<boolean>>;
  enabled?: boolean;
}): void {
  const key = String(opts.storageKey || '').trim();
  const enabled = opts.enabled !== false;
  const value = !!opts.value;
  const setValue = opts.setValue;

  // Load
  React.useEffect(() => {
    if (!enabled) return;
    if (!key) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (v === '1') setValue(true);
        if (v === '0') setValue(false);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, key, setValue]);

  // Save
  React.useEffect(() => {
    if (!enabled) return;
    if (!key) return;
    (async () => {
      try {
        await AsyncStorage.setItem(key, value ? '1' : '0');
      } catch {
        // ignore
      }
    })();
  }, [enabled, key, value]);
}
