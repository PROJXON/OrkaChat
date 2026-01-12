import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

export function useHiddenMessageIds(storageKey: string): {
  hiddenMessageIds: Record<string, true>;
  hideMessageId: (id: string) => void;
  reset: () => void;
} {
  const key = String(storageKey || '').trim();
  const [hiddenMessageIds, setHiddenMessageIds] = React.useState<Record<string, true>>({});

  const reset = React.useCallback(() => setHiddenMessageIds({}), []);

  React.useEffect(() => {
    if (!key) {
      reset();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (!raw) {
          setHiddenMessageIds({});
          return;
        }
        const arr = JSON.parse(raw);
        const map: Record<string, true> = {};
        if (Array.isArray(arr)) {
          for (const id of arr) {
            if (typeof id === 'string') map[id] = true;
          }
        }
        setHiddenMessageIds(map);
      } catch {
        if (!cancelled) setHiddenMessageIds({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, reset]);

  const hideMessageId = React.useCallback(
    (id: string) => {
      const msgId = String(id || '').trim();
      if (!msgId || !key) return;
      setHiddenMessageIds((prev) => {
        if (prev[msgId]) return prev;
        const next: Record<string, true> = { ...prev, [msgId]: true as true };
        try {
          const nextIds = Object.keys(next).slice(0, 500);
          // Fire-and-forget.
          void AsyncStorage.setItem(key, JSON.stringify(nextIds));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [key],
  );

  return React.useMemo(
    () => ({ hiddenMessageIds, hideMessageId, reset }),
    [hiddenMessageIds, hideMessageId, reset],
  );
}
