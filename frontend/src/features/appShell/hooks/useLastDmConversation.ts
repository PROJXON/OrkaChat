import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

export function useLastDmConversation({ conversationId }: { conversationId: string }): {
  dmRestoreDone: boolean;
  lastDmConversationIdRef: React.MutableRefObject<string>;
} {
  const [dmRestoreDone, setDmRestoreDone] = React.useState<boolean>(false);
  const lastDmConversationIdRef = React.useRef<string>('');

  // Restore last visited DM/group DM on boot (dm#... or gdm#...).
  // Note: unlike channels, we do NOT auto-navigate to the last DM on boot.
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('ui:lastDmConversationId');
        const v = typeof raw === 'string' ? raw.trim() : '';
        if (!mounted) return;
        if (v.startsWith('dm#') || v.startsWith('gdm#')) {
          lastDmConversationIdRef.current = v;
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setDmRestoreDone(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist last visited DM/group DM.
  React.useEffect(() => {
    const v = String(conversationId || '').trim();
    if (!(v.startsWith('dm#') || v.startsWith('gdm#'))) return;
    lastDmConversationIdRef.current = v;
    (async () => {
      try {
        await AsyncStorage.setItem('ui:lastDmConversationId', v);
      } catch {
        // ignore
      }
    })();
  }, [conversationId]);

  return { dmRestoreDone, lastDmConversationIdRef };
}
