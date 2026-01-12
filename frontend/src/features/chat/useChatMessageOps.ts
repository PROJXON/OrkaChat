import type { RefObject } from 'react';
import * as React from 'react';

import type { ChatMessage } from './types';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'Unknown error';
  if (typeof err === 'string') return err || 'Unknown error';
  if (!err) return 'Unknown error';
  try {
    const rec = err as Record<string, unknown>;
    const msg = rec?.message;
    return typeof msg === 'string' && msg ? msg : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

export function useChatMessageOps(opts: {
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  myUserId: string | null | undefined;

  // message action menu target + closing
  messageActionTarget: ChatMessage | null;
  closeMessageActions: () => void;

  // state updates
  setError: (s: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  // local-only hiding
  hideMessageId: (id: string) => void;

  // reaction picker state
  setReactionPickerOpen: (v: boolean) => void;
  setReactionPickerTarget: (v: ChatMessage | null) => void;

  // reaction info
  openReactionInfo: (args: { target: ChatMessage; emoji: string; subs: string[] }) => Promise<void>;

  // ui
  showAlert: (title: string, body: string) => void;
}) {
  const {
    wsRef,
    activeConversationId,
    myUserId,
    messageActionTarget,
    closeMessageActions,
    setError,
    setMessages,
    hideMessageId,
    setReactionPickerOpen,
    setReactionPickerTarget,
    openReactionInfo,
    showAlert,
  } = opts;

  const deleteForMe = React.useCallback(
    async (msg: ChatMessage) => {
      if (!msg?.id) return;
      hideMessageId(msg.id);
    },
    [hideMessageId],
  );

  const sendDeleteForEveryone = React.useCallback(async () => {
    const target = messageActionTarget;
    if (!target) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    try {
      wsRef.current.send(
        JSON.stringify({
          action: 'delete',
          conversationId: activeConversationId,
          messageCreatedAt: target.createdAt,
          createdAt: Date.now(),
        }),
      );
      // Optimistic local update
      const now = Date.now();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === target.id
            ? {
                ...m,
                deletedAt: now,
                rawText: '',
                text: '',
                encrypted: undefined,
                decryptedText: undefined,
              }
            : m,
        ),
      );
      closeMessageActions();
    } catch (e: unknown) {
      showAlert('Delete failed', getErrorMessage(e) || 'Failed to delete message');
    }
  }, [
    activeConversationId,
    closeMessageActions,
    messageActionTarget,
    setError,
    setMessages,
    showAlert,
    wsRef,
  ]);

  const sendReaction = React.useCallback(
    (target: ChatMessage, emoji: string) => {
      if (!target) return;
      if (!emoji) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const all = target.reactions || {};
      let currentEmoji: string | null = null;
      if (myUserId) {
        for (const [e, info] of Object.entries(all)) {
          if (info?.userSubs?.includes(myUserId)) {
            currentEmoji = e;
            break;
          }
        }
      }
      const alreadySame = !!currentEmoji && currentEmoji === emoji;
      const op: 'add' | 'remove' = alreadySame ? 'remove' : 'add';

      // Optimistic UI: toggle locally immediately (best-effort).
      if (myUserId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.createdAt !== target.createdAt) return m;
            const next = { ...(m.reactions || {}) };

            // Remove my reaction from all emojis first (single-reaction model)
            for (const [e, info] of Object.entries(next)) {
              const subs = Array.isArray(info?.userSubs) ? info.userSubs : [];
              const filtered = subs.filter((s) => s !== myUserId);
              if (filtered.length === 0) delete next[e];
              else next[e] = { count: filtered.length, userSubs: filtered };
            }

            if (op === 'add') {
              const subs = next[emoji]?.userSubs ? [...next[emoji].userSubs] : [];
              if (!subs.includes(myUserId)) subs.push(myUserId);
              next[emoji] = { count: subs.length, userSubs: subs };
            }

            return { ...m, reactions: Object.keys(next).length ? next : undefined };
          }),
        );
      }
      try {
        wsRef.current.send(
          JSON.stringify({
            action: 'react',
            conversationId: activeConversationId,
            messageCreatedAt: target.createdAt,
            emoji,
            op,
            createdAt: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
    },
    [activeConversationId, myUserId, setMessages, wsRef],
  );

  const openReactionPicker = React.useCallback(
    (target: ChatMessage) => {
      setReactionPickerTarget(target);
      setReactionPickerOpen(true);
    },
    [setReactionPickerOpen, setReactionPickerTarget],
  );

  const closeReactionPicker = React.useCallback(() => {
    setReactionPickerOpen(false);
    setReactionPickerTarget(null);
  }, [setReactionPickerOpen, setReactionPickerTarget]);

  const openReactionInfoFor = React.useCallback(
    async (target: ChatMessage, emoji: string, subs: string[]) => {
      await openReactionInfo({ target, emoji, subs });
    },
    [openReactionInfo],
  );

  return {
    deleteForMe,
    sendDeleteForEveryone,
    sendReaction,
    openReactionPicker,
    closeReactionPicker,
    openReactionInfoFor,
  };
}
