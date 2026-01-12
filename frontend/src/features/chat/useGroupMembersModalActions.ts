import * as React from 'react';
import type { RefObject } from 'react';

type GroupUpdateFn = (op: string, args: Record<string, unknown>) => Promise<unknown> | void;

export function useGroupMembersModalActions(opts: {
  groupAddMembersDraft: string;
  setGroupAddMembersDraft: (v: string) => void;
  groupUpdate: GroupUpdateFn;
  uiConfirm: (
    title: string,
    body: string,
    opts?: { confirmText?: string; cancelText?: string; destructive?: boolean },
  ) => Promise<boolean>;
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  setGroupMembersOpen: (v: boolean) => void;
}) {
  const { groupAddMembersDraft, setGroupAddMembersDraft, groupUpdate, uiConfirm, wsRef, activeConversationId, setGroupMembersOpen } =
    opts;

  const onAddMembers = React.useCallback(async () => {
    const raw = groupAddMembersDraft.trim();
    if (!raw) return;
    const usernames = Array.from(
      new Set(
        raw
          .split(/[,\s]+/g)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (!usernames.length) return;
    await Promise.resolve(groupUpdate('addMembers', { usernames }));
    setGroupAddMembersDraft('');
  }, [groupAddMembersDraft, groupUpdate, setGroupAddMembersDraft]);

  const onBan = React.useCallback(
    async (args: { memberSub: string; label: string }) => {
      const memberSub = args?.memberSub ? String(args.memberSub) : '';
      const label = String(args?.label || '');
      if (!memberSub) return;
      const ok = await uiConfirm(
        'Ban user?',
        `Ban ${label}?\n\nThey will be removed from the chat and stop receiving new messages.\n\nUnban removes the ban, but does not automatically re-add them. To add them back, use “Add” above.`,
        { confirmText: 'Ban', cancelText: 'Cancel', destructive: true },
      );
      if (!ok) return;
      await Promise.resolve(groupUpdate('ban', { memberSub }));

      // Add a system note like kick, but for ban.
      // (Server validates admin + persists/broadcasts.)
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
          // Eject target from UI without also logging a "kicked" system message.
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
    [activeConversationId, groupUpdate, uiConfirm, wsRef],
  );

  const onClose = React.useCallback(() => setGroupMembersOpen(false), [setGroupMembersOpen]);

  return { onAddMembers, onBan, onClose };
}

