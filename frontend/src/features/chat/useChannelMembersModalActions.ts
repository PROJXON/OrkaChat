import * as React from 'react';
import type { RefObject } from 'react';

export function useChannelMembersModalActions(opts: {
  uiConfirm: (
    title: string,
    body: string,
    opts?: { confirmText?: string; cancelText?: string; destructive?: boolean },
  ) => Promise<boolean>;
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  channelUpdate: (op: any, args: any) => Promise<any>;
  setChannelMembers: React.Dispatch<React.SetStateAction<any[]>>;
  setChannelMembersOpen: (v: boolean) => void;
}) {
  const { uiConfirm, wsRef, activeConversationId, channelUpdate, setChannelMembers, setChannelMembersOpen } = opts;

  const onBan = React.useCallback(
    async (args: { memberSub: string; label: string }) => {
      const memberSub = args?.memberSub ? String(args.memberSub) : '';
      const label = String(args?.label || '');
      if (!memberSub) return;
      const ok = await uiConfirm(
        'Ban member?',
        `Ban ${label || 'member'} from this channel?\n\nThey will be removed immediately and cannot join again until you unban them.\n\nUnban removes the ban, but does not automatically re-add them. If the channel is public, they can re-join from the channel list.`,
        { confirmText: 'Ban', cancelText: 'Cancel', destructive: true },
      );
      if (!ok) return;
      await channelUpdate('ban', { memberSub });
      // Persist + broadcast the system event, then eject target UI (best-effort).
      try {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              action: 'system',
              conversationId: activeConversationId,
              systemKind: 'ban',
              targetSub: memberSub,
              createdAt: Date.now(),
            }),
          );
          ws.send(
            JSON.stringify({
              action: 'kick',
              conversationId: activeConversationId,
              targetSub: memberSub,
              suppressSystem: true,
              createdAt: Date.now(),
            }),
          );
        }
      } catch {
        // ignore
      }
    },
    [activeConversationId, channelUpdate, uiConfirm, wsRef],
  );

  const onToggleAdmin = React.useCallback(
    (args: { memberSub: string; isAdmin: boolean }) => {
      const memberSub = args?.memberSub ? String(args.memberSub) : '';
      const isAdmin = !!args?.isAdmin;
      if (!memberSub) return;
      // Optimistic UI so "last admin" guard reflects immediately.
      setChannelMembers((prev) =>
        (Array.isArray(prev) ? prev : []).map((m) =>
          m && String((m as any).memberSub) === String(memberSub) ? { ...(m as any), isAdmin: !isAdmin } : m,
        ),
      );
      void channelUpdate(isAdmin ? 'demoteAdmin' : 'promoteAdmin', { memberSub });
    },
    [channelUpdate, setChannelMembers],
  );

  const onClose = React.useCallback(() => setChannelMembersOpen(false), [setChannelMembersOpen]);

  return { onBan, onToggleAdmin, onClose };
}

