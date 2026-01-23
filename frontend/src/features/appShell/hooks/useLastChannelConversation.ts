import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { Platform } from 'react-native';

function getDeviceStorageKey(): string {
  // Device-scoped fallback so we can restore immediately even before user attrs rehydrate.
  // (Also used by guest mode in a separate screen with separate keys.)
  return 'ui:lastChannelConversationId';
}

function getUserStorageKey(userSub: string | null | undefined): string | null {
  const u = typeof userSub === 'string' ? userSub.trim() : '';
  if (!u) return null;
  return `ui:lastChannelConversationId:${u}`;
}

function readCachedLastChannelConversationIdSync(): string {
  // Web-only: localStorage is synchronous; use it to avoid flashing "Global" in the header pill.
  if (Platform.OS !== 'web') return 'global';
  try {
    const raw = globalThis?.localStorage?.getItem?.(getDeviceStorageKey());
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (v === 'global' || v.startsWith('ch#')) return v;
  } catch {
    // ignore
  }
  return 'global';
}

export function useLastChannelConversation({
  userSub,
  conversationId,
  setConversationId,
}: {
  userSub?: string | null;
  conversationId: string;
  setConversationId: React.Dispatch<React.SetStateAction<string>>;
}): {
  channelRestoreDone: boolean;
  lastChannelConversationIdRef: React.MutableRefObject<string>;
} {
  const [channelRestoreDone, setChannelRestoreDone] = React.useState<boolean>(false);
  const lastChannelConversationIdRef = React.useRef<string>(
    readCachedLastChannelConversationIdSync(),
  );

  // Restore last visited channel on boot (Global or ch#...).
  React.useEffect(() => {
    let mounted = true;
    setChannelRestoreDone(false);
    // IMPORTANT: clear immediately so we don't show a previous user's pinned channel
    // while async storage loads for the new user (especially when currently in DM mode).
    lastChannelConversationIdRef.current = 'global';
    (async () => {
      try {
        const userKey = getUserStorageKey(userSub);
        const raw =
          (userKey ? await AsyncStorage.getItem(userKey) : null) ||
          (await AsyncStorage.getItem(getDeviceStorageKey()));
        const v = typeof raw === 'string' ? raw.trim() : '';
        if (!mounted) return;
        if (v === 'global' || v.startsWith('ch#')) {
          lastChannelConversationIdRef.current = v;
          // Web-only: ensure the raw localStorage key exists for true first-paint sync hydration on next refresh.
          if (Platform.OS === 'web') {
            try {
              globalThis?.localStorage?.setItem?.(getDeviceStorageKey(), v);
            } catch {
              // ignore
            }
          }
          // Only auto-switch if we're not already in a DM.
          setConversationId((prev) =>
            prev && (prev.startsWith('dm#') || prev.startsWith('gdm#')) ? prev : v,
          );
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setChannelRestoreDone(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setConversationId, userSub]);

  // Persist last visited channel (not DMs).
  React.useEffect(() => {
    // Avoid clobbering the stored value on cold start before the restore effect runs.
    if (!channelRestoreDone) return;
    const v = conversationId;
    if (v === 'global' || v.startsWith('ch#')) {
      lastChannelConversationIdRef.current = v;
      (async () => {
        try {
          await AsyncStorage.setItem(getDeviceStorageKey(), v);
        } catch {
          // ignore
        }
        try {
          const userKey = getUserStorageKey(userSub);
          if (userKey) await AsyncStorage.setItem(userKey, v);
          if (Platform.OS === 'web') {
            try {
              globalThis?.localStorage?.setItem?.(getDeviceStorageKey(), v);
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [channelRestoreDone, conversationId, userSub]);

  return { channelRestoreDone, lastChannelConversationIdRef };
}
