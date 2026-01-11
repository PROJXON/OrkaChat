import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const lastChannelConversationIdRef = React.useRef<string>('global');

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
          // Only auto-switch if we're not already in a DM.
          setConversationId((prev) => (prev && (prev.startsWith('dm#') || prev.startsWith('gdm#')) ? prev : v));
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
    const v = conversationId;
    if (v === 'global' || v.startsWith('ch#')) {
      lastChannelConversationIdRef.current = v;
      (async () => {
        try {
          await AsyncStorage.setItem('ui:lastChannelConversationId', v);
        } catch {
          // ignore
        }
      })();
    }
  }, [conversationId]);

  return { channelRestoreDone, lastChannelConversationIdRef };
}

