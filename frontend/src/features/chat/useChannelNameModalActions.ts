import * as React from 'react';
import type { RefObject } from 'react';

export function useChannelNameModalActions(opts: {
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  channelNameDraft: string;
  setChannelMeta: React.Dispatch<React.SetStateAction<any>>;
  setChannelNameEditOpen: (v: boolean) => void;
  channelUpdate: (op: any, args: any) => Promise<any> | void;
}) {
  const { wsRef, activeConversationId, channelNameDraft, setChannelMeta, setChannelNameEditOpen, channelUpdate } = opts;

  const onSave = React.useCallback(() => {
    const next = String(channelNameDraft || '').trim();
    void channelUpdate('setName', { name: next });
    setChannelMeta((prev: any) => (prev ? { ...prev, name: next || prev.name } : prev));
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
  }, [activeConversationId, channelNameDraft, channelUpdate, setChannelMeta, setChannelNameEditOpen, wsRef]);

  const onCancel = React.useCallback(() => setChannelNameEditOpen(false), [setChannelNameEditOpen]);

  return { onSave, onCancel };
}

