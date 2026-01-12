import type { RefObject } from 'react';
import * as React from 'react';

import type { ChannelMeta } from './useChannelRoster';

type ChannelUpdateFn = (op: string, args: Record<string, unknown>) => Promise<unknown> | void;

export function useChannelNameModalActions(opts: {
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  channelNameDraft: string;
  setChannelMeta: React.Dispatch<React.SetStateAction<ChannelMeta | null>>;
  setChannelNameEditOpen: (v: boolean) => void;
  channelUpdate: ChannelUpdateFn;
}) {
  const {
    wsRef,
    activeConversationId,
    channelNameDraft,
    setChannelMeta,
    setChannelNameEditOpen,
    channelUpdate,
  } = opts;

  const onSave = React.useCallback(() => {
    const next = String(channelNameDraft || '').trim();
    void channelUpdate('setName', { name: next });
    setChannelMeta((prev) => (prev ? { ...prev, name: next || prev.name } : prev));
    // Broadcast a generic "channel updated" system event so other members refresh titles promptly.
    try {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            action: 'system',
            conversationId: activeConversationId,
            systemKind: 'update',
            updateField: 'channelName',
            channelName: next,
            createdAt: Date.now(),
          }),
        );
      }
    } catch {
      // ignore
    }
    setChannelNameEditOpen(false);
  }, [
    activeConversationId,
    channelNameDraft,
    channelUpdate,
    setChannelMeta,
    setChannelNameEditOpen,
    wsRef,
  ]);

  const onCancel = React.useCallback(() => setChannelNameEditOpen(false), [setChannelNameEditOpen]);

  return { onSave, onCancel };
}
