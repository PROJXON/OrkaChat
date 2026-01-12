import type { RefObject } from 'react';
import * as React from 'react';

export function useChatKickActions(opts: {
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  isGroup: boolean;
  isChannel: boolean;
  showAlert: (title: string, body: string) => void;
}) {
  const { wsRef, activeConversationId, isGroup, isChannel, showAlert } = opts;

  // UI-only: prevent accidental/spammy repeated kicks (per-user cooldown).
  const [kickCooldownUntilBySub, setKickCooldownUntilBySub] = React.useState<
    Record<string, number>
  >({});
  const kickCooldownTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const applyKickCooldown = React.useCallback((targetSub: string) => {
    const sub = String(targetSub || '').trim();
    if (!sub) return null;
    const until = Date.now() + 5000;
    setKickCooldownUntilBySub((prev) => ({ ...prev, [sub]: until }));
    // Ensure the button re-enables even if the modal stays open.
    if (kickCooldownTimersRef.current[sub]) {
      clearTimeout(kickCooldownTimersRef.current[sub]);
    }
    kickCooldownTimersRef.current[sub] = setTimeout(() => {
      setKickCooldownUntilBySub((prev) => {
        if (!prev[sub]) return prev;
        const next = { ...prev };
        delete next[sub];
        return next;
      });
      delete kickCooldownTimersRef.current[sub];
    }, 5200);
    return sub;
  }, []);

  const sendKick = React.useCallback(
    (targetSub: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        showAlert('Not connected', 'WebSocket is not connected.');
        return;
      }
      const sub = applyKickCooldown(targetSub);
      if (!sub) return;
      ws.send(
        JSON.stringify({
          action: 'kick',
          conversationId: activeConversationId,
          targetSub: sub,
          createdAt: Date.now(),
        }),
      );
    },
    [activeConversationId, applyKickCooldown, showAlert, wsRef],
  );

  const groupKick = React.useCallback(
    (targetSub: string) => {
      if (!isGroup) return;
      sendKick(targetSub);
    },
    [isGroup, sendKick],
  );

  const channelKick = React.useCallback(
    (targetSub: string) => {
      if (!isChannel) return;
      // Kick is UI eject + system message only (no membership change).
      sendKick(targetSub);
    },
    [isChannel, sendKick],
  );

  // Cleanup kick cooldown timers on unmount
  React.useEffect(() => {
    return () => {
      try {
        for (const t of Object.values(kickCooldownTimersRef.current || {})) {
          clearTimeout(t);
        }
      } catch {
        // ignore
      }
      kickCooldownTimersRef.current = {};
    };
  }, []);

  return { kickCooldownUntilBySub, groupKick, channelKick };
}
