import * as React from 'react';

export function useChatConversationJoin(opts: {
  activeConversationId: string;
  wsRef: { current: WebSocket | null };
  pendingJoinConversationIdRef: { current: string | null };
}): void {
  const { activeConversationId, wsRef, pendingJoinConversationIdRef } = opts;

  const sendJoin = React.useCallback(
    (conversationIdToJoin: string) => {
      if (!conversationIdToJoin) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        pendingJoinConversationIdRef.current = conversationIdToJoin;
        return;
      }
      try {
        wsRef.current.send(
          JSON.stringify({
            action: 'join',
            conversationId: conversationIdToJoin,
            createdAt: Date.now(),
          }),
        );
        pendingJoinConversationIdRef.current = null;
      } catch {
        pendingJoinConversationIdRef.current = conversationIdToJoin;
      }
    },
    [pendingJoinConversationIdRef, wsRef],
  );

  // Notify backend whenever user switches conversations (enables Query-by-conversation routing).
  React.useEffect(() => {
    sendJoin(activeConversationId);
  }, [activeConversationId, sendJoin]);
}
