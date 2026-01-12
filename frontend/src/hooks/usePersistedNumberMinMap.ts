import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

function mergeMin(prev: Record<string, number>, parsed: unknown): Record<string, number> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return prev;
  const rec = parsed as Record<string, unknown>;
  let changed = false;
  const next = { ...prev };
  for (const [k, v] of Object.entries(rec)) {
    const key = String(k || '').trim();
    if (!key) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    const existing = next[key];
    next[key] = existing ? Math.min(existing, n) : n;
    changed = true;
  }
  return changed ? next : prev;
}

export function usePersistedNumberMinMap(storageKey: string): {
  map: Record<string, number>;
  setMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  reset: () => void;
} {
  const key = String(storageKey || '').trim();
  const [map, setMap] = React.useState<Record<string, number>>({});

  const reset = React.useCallback(() => setMap({}), []);

  // Reset when the storage key changes (e.g. switching conversations).
  React.useEffect(() => {
    reset();
  }, [key, reset]);

  // Load (merge-min) from storage for this key.
  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (cancelled) return;
        setMap((prev) => mergeMin(prev, parsed));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Save on changes.
  React.useEffect(() => {
    if (!key) return;
    (async () => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(map));
      } catch {
        // ignore
      }
    })();
  }, [key, map]);

  return React.useMemo(() => ({ map, setMap, reset }), [map, reset]);
}

