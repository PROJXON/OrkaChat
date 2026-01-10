import * as React from 'react';

export function useChatTyping(opts: {
  wsRef: React.RefObject<WebSocket | null>;
  activeConversationId: string;
  displayName: string;
  typingByUserExpiresAt: Record<string, number>;
  setTypingByUserExpiresAt: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  const { wsRef, activeConversationId, displayName, typingByUserExpiresAt, setTypingByUserExpiresAt } = opts;

  const isTypingRef = React.useRef<boolean>(false);
  const lastTypingSentAtRef = React.useRef<number>(0);
  const typingCleanupTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Periodically sweep expired typing indicators.
  React.useEffect(() => {
    if (typingCleanupTimerRef.current) return;
    typingCleanupTimerRef.current = setInterval(() => {
      const now = Date.now();
      setTypingByUserExpiresAt((prev) => {
        const entries = Object.entries(prev);
        if (entries.length === 0) return prev;
        let changed = false;
        const next: Record<string, number> = {};
        for (const [u, exp] of entries) {
          if (typeof exp === 'number' && exp > now) next[u] = exp;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => {
      if (typingCleanupTimerRef.current) clearInterval(typingCleanupTimerRef.current);
      typingCleanupTimerRef.current = null;
    };
  }, [setTypingByUserExpiresAt]);

  const sendTyping = React.useCallback(
    (nextIsTyping: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      // Throttle "typing true" events; always allow "typing false" immediately.
      if (nextIsTyping) {
        const last = lastTypingSentAtRef.current;
        if (now - last < 2000 && isTypingRef.current) return;
        lastTypingSentAtRef.current = now;
      }
      try {
        wsRef.current.send(
          JSON.stringify({
            action: 'typing',
            conversationId: activeConversationId,
            user: displayName,
            isTyping: nextIsTyping,
            createdAt: now,
          }),
        );
        isTypingRef.current = nextIsTyping;
      } catch {
        // ignore
      }
    },
    [wsRef, activeConversationId, displayName],
  );

  const typingIndicatorText = React.useMemo(() => {
    const now = Date.now();
    const users = Object.entries(typingByUserExpiresAt)
      .filter(([, exp]) => typeof exp === 'number' && exp > now)
      .map(([u]) => u);
    if (users.length === 0) return '';
    if (users.length >= 5) return 'Someone is typing';
    if (users.length === 1) return `${users[0]} is typing`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing`;
    return `${users.slice(0, -1).join(', ')}, and ${users[users.length - 1]} are typing`;
  }, [typingByUserExpiresAt]);

  return { isTypingRef, sendTyping, typingIndicatorText };
}

