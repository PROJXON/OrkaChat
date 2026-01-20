import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { Platform } from 'react-native';

function readCachedLastChannelConversationIdSync(): string {
  // Web-only: localStorage is synchronous; use it to avoid flashing "Global" in the header pill.
  if (Platform.OS !== 'web') return 'global';
  try {
    const raw = globalThis?.localStorage?.getItem?.('ui:lastChannelConversationId');
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (v === 'global' || v.startsWith('ch#')) return v;
  } catch {
    // ignore
  }
  return 'global';
}

export function useLastChannelConversation({
  conversationId,
  setConversationId,
}: {
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
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('ui:lastChannelConversationId');
        const v = typeof raw === 'string' ? raw.trim() : '';
        if (!mounted) return;
        if (v === 'global' || v.startsWith('ch#')) {
          lastChannelConversationIdRef.current = v;
          // Web-only: ensure the raw localStorage key exists for true first-paint sync hydration on next refresh.
          if (Platform.OS === 'web') {
            try {
              globalThis?.localStorage?.setItem?.('ui:lastChannelConversationId', v);
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
  }, [setConversationId]);

  // Persist last visited channel (not DMs).
  React.useEffect(() => {
    // Avoid clobbering the stored value on cold start before the restore effect runs.
    if (!channelRestoreDone) return;
    const v = conversationId;
    if (v === 'global' || v.startsWith('ch#')) {
      lastChannelConversationIdRef.current = v;
      (async () => {
        try {
          await AsyncStorage.setItem('ui:lastChannelConversationId', v);
          if (Platform.OS === 'web') {
            try {
              globalThis?.localStorage?.setItem?.('ui:lastChannelConversationId', v);
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [channelRestoreDone, conversationId]);

  return { channelRestoreDone, lastChannelConversationIdRef };
}
