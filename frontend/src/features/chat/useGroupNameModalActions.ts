import type { RefObject } from 'react';
import * as React from 'react';

import type { GroupMeta } from './useHydrateGroupRoster';

type GroupUpdateFn = (op: string, args: Record<string, unknown>) => Promise<unknown> | void;

export function useGroupNameModalActions(opts: {
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  groupNameDraft: string;
  setGroupNameDraft: (v: string) => void;
  setGroupNameEditOpen: (v: boolean) => void;
  groupUpdate: GroupUpdateFn;
  setGroupMeta: React.Dispatch<React.SetStateAction<GroupMeta | null>>;
  computeDefaultGroupTitleForMe: () => string;
  onConversationTitleChanged?: (conversationId: string, title: string) => void;
}) {
  const {
    wsRef,
    activeConversationId,
    groupNameDraft,
    setGroupNameDraft,
    setGroupNameEditOpen,
    groupUpdate,
    setGroupMeta,
    computeDefaultGroupTitleForMe,
    onConversationTitleChanged,
  } = opts;

  const broadcastGroupNameUpdate = React.useCallback(
    (groupName: string) => {
      try {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              action: 'system',
              conversationId: activeConversationId,
              systemKind: 'update',
              updateField: 'groupName',
              groupName,
              createdAt: Date.now(),
            }),
          );
        }
      } catch {
        // ignore
      }
    },
    [activeConversationId, wsRef],
  );

  const onDefault = React.useCallback(async () => {
    setGroupNameDraft('');
    await Promise.resolve(groupUpdate('setName', { name: '' }));
    // Update local header + Chats list immediately (without waiting for a refetch).
    setGroupMeta((prev) => (prev ? { ...prev, groupName: undefined } : prev));
    try {
      if (activeConversationId && onConversationTitleChanged) {
        onConversationTitleChanged(activeConversationId, computeDefaultGroupTitleForMe());
      }
    } catch {
      // ignore
    }
    // Broadcast a generic "group updated" system event so other members refresh titles promptly.
    broadcastGroupNameUpdate('');
    setGroupNameEditOpen(false);
  }, [
    activeConversationId,
    broadcastGroupNameUpdate,
    computeDefaultGroupTitleForMe,
    groupUpdate,
    onConversationTitleChanged,
    setGroupMeta,
    setGroupNameDraft,
    setGroupNameEditOpen,
  ]);

  const onSave = React.useCallback(async () => {
    const name = groupNameDraft.trim();
    await Promise.resolve(groupUpdate('setName', { name }));
    // Update local header + Chats list immediately (without waiting for a refetch).
    setGroupMeta((prev) => (prev ? { ...prev, groupName: name ? name : undefined } : prev));
    try {
      if (activeConversationId && onConversationTitleChanged) {
        onConversationTitleChanged(
          activeConversationId,
          name ? name : computeDefaultGroupTitleForMe(),
        );
      }
    } catch {
      // ignore
    }
    // Broadcast a generic "group updated" system event so other members refresh titles promptly.
    broadcastGroupNameUpdate(name);
    setGroupNameEditOpen(false);
  }, [
    activeConversationId,
    broadcastGroupNameUpdate,
    computeDefaultGroupTitleForMe,
    groupNameDraft,
    groupUpdate,
    onConversationTitleChanged,
    setGroupMeta,
    setGroupNameEditOpen,
  ]);

  const onCancel = React.useCallback(() => setGroupNameEditOpen(false), [setGroupNameEditOpen]);

  return { onDefault, onSave, onCancel };
}
