import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChannelHeaderCache = {
  v: 1;
  channelId: string;
  name: string;
  isPublic?: boolean;
  hasPassword?: boolean;
  aboutText?: string;
  aboutVersion?: number;
  meIsAdmin: boolean;
  meStatus: string;
  activeCount?: number;
  savedAt: number;
};

export function useChannelHeaderCache(opts: {
  enabled: boolean;
  channelId: string;
}): { cached: ChannelHeaderCache | null; save: (next: Omit<ChannelHeaderCache, 'v' | 'savedAt' | 'channelId'>) => void } {
  const enabled = !!opts.enabled;
  const channelId = String(opts.channelId || '').trim();
  const key = channelId ? `ui:channelCache:${channelId}` : '';
  const [cached, setCached] = React.useState<ChannelHeaderCache | null>(null);

  React.useEffect(() => {
    if (!enabled || !key) {
      setCached(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return;
        if (String(obj.channelId || '') !== channelId) return;
        setCached(obj as ChannelHeaderCache);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, key, channelId]);

  const save = React.useCallback(
    (next: Omit<ChannelHeaderCache, 'v' | 'savedAt' | 'channelId'>) => {
      if (!key) return;
      const payload: ChannelHeaderCache = {
        v: 1,
        channelId,
        savedAt: Date.now(),
        ...next,
      };
      try {
        void AsyncStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // ignore
      }
    },
    [key, channelId],
  );

  return React.useMemo(() => ({ cached, save }), [cached, save]);
}

