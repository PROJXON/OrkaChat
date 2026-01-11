import * as React from 'react';
import { usePersistedBool } from '../../hooks/usePersistedBool';
import { usePersistedNumber } from '../../hooks/usePersistedNumber';

export function useChatReadReceipts(opts: {
  enabled: boolean;
  myUserId: string | null | undefined;
  conversationIdForStorage: string;
  activeConversationId: string;
  displayName: string;
  wsRef: React.RefObject<WebSocket | null>;
}): {
  sendReadReceipts: boolean;
  onToggleReadReceipts: (next: boolean) => void;
  sendReadReceipt: (messageCreatedAt: number) => void;
  flushPendingRead: () => void;
} {
  const { enabled, myUserId, conversationIdForStorage, activeConversationId, displayName, wsRef } = opts;

  const pendingReadCreatedAtSetRef = React.useRef<Set<number>>(new Set());
  const sentReadCreatedAtSetRef = React.useRef<Set<number>>(new Set());

  const [sendReadReceipts, setSendReadReceipts] = React.useState<boolean>(true);
  // If read receipts are disabled when we read/decrypt messages, record the highest messageCreatedAt
  // we've read so we don't retroactively send receipts later when the user re-enables them.
  const [readReceiptSuppressUpTo, setReadReceiptSuppressUpTo] = React.useState<number>(0);
  const readReceiptSuppressUpToRef = React.useRef<number>(0);

  usePersistedBool({
    enabled: !!myUserId,
    storageKey: `chat:readReceiptsEnabled:${String(myUserId || '')}`,
    value: sendReadReceipts,
    setValue: setSendReadReceipts,
  });

  // Persist suppression watermark per-conversation (prevents late receipts after toggling back on).
  React.useEffect(() => {
    readReceiptSuppressUpToRef.current = readReceiptSuppressUpTo;
  }, [readReceiptSuppressUpTo]);

  const suppressStorageKey = React.useMemo(() => {
    const cid = conversationIdForStorage && conversationIdForStorage.length > 0 ? conversationIdForStorage : 'global';
    return `chat:readReceiptSuppressUpTo:${cid}`;
  }, [conversationIdForStorage]);
  const normalizeSuppress = React.useCallback(
    (v: number) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0),
    []
  );

  usePersistedNumber({
    enabled: !!myUserId,
    storageKey: suppressStorageKey,
    value: readReceiptSuppressUpTo,
    setValue: setReadReceiptSuppressUpTo,
    normalize: normalizeSuppress,
  });

  // Reset per-conversation read bookkeeping
  React.useEffect(() => {
    pendingReadCreatedAtSetRef.current = new Set();
    sentReadCreatedAtSetRef.current = new Set();
  }, [activeConversationId]);

  const sendReadReceipt = React.useCallback(
    (messageCreatedAt: number) => {
      // Read receipts apply to encrypted chats (DM + Group DM), not channels.
      if (!enabled) return;
      if (!Number.isFinite(messageCreatedAt) || messageCreatedAt <= 0) return;

      // If user disabled read receipts, remember we've read up to this point so we don't send later.
      if (!sendReadReceipts) {
        setReadReceiptSuppressUpTo((prev) => (messageCreatedAt > prev ? messageCreatedAt : prev));
        return;
      }
      // If receipts were disabled when this message was read, never send retroactively.
      if (messageCreatedAt <= readReceiptSuppressUpToRef.current) return;

      // Avoid duplicate sends/queues per conversation.
      if (sentReadCreatedAtSetRef.current.has(messageCreatedAt)) return;
      if (pendingReadCreatedAtSetRef.current.has(messageCreatedAt)) return;
      // If WS isn't ready yet (common right after login), queue and flush on connect.
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        pendingReadCreatedAtSetRef.current.add(messageCreatedAt);
        return;
      }
      sentReadCreatedAtSetRef.current.add(messageCreatedAt);
      wsRef.current.send(
        JSON.stringify({
          action: 'read',
          conversationId: activeConversationId,
          user: displayName,
          // New: per-message read receipt
          messageCreatedAt,
          // Backward compat: older backend treats readUpTo as a single value
          readUpTo: messageCreatedAt,
          readAt: Math.floor(Date.now() / 1000),
          createdAt: Date.now(),
        }),
      );
    },
    [enabled, activeConversationId, displayName, sendReadReceipts, wsRef],
  );

  const flushPendingRead = React.useCallback(() => {
    if (!enabled) return;
    if (!sendReadReceipts) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const pending = Array.from(pendingReadCreatedAtSetRef.current);
    if (!pending.length) return;
    pendingReadCreatedAtSetRef.current = new Set();
    // send oldest-first (nice-to-have)
    pending.sort((a, b) => a - b);
    for (const mc of pending) {
      if (mc <= readReceiptSuppressUpToRef.current) continue;
      if (sentReadCreatedAtSetRef.current.has(mc)) continue;
      sentReadCreatedAtSetRef.current.add(mc);
      try {
        wsRef.current.send(
          JSON.stringify({
            action: 'read',
            conversationId: activeConversationId,
            user: displayName,
            messageCreatedAt: mc,
            readUpTo: mc,
            readAt: Math.floor(Date.now() / 1000),
            createdAt: Date.now(),
          }),
        );
      } catch {
        // If send fails, re-queue and bail; WS reconnect will retry.
        pendingReadCreatedAtSetRef.current.add(mc);
        break;
      }
    }
  }, [enabled, sendReadReceipts, wsRef, activeConversationId, displayName]);

  const onToggleReadReceipts = React.useCallback(
    (next: boolean) => {
      // If turning OFF, also suppress any queued receipts so they won't send later.
      if (!next) {
        const pending = Array.from(pendingReadCreatedAtSetRef.current || []);
        const maxPending = pending.length ? Math.max(...pending) : 0;
        if (Number.isFinite(maxPending) && maxPending > 0) {
          setReadReceiptSuppressUpTo((prev) => (maxPending > prev ? maxPending : prev));
        }
        pendingReadCreatedAtSetRef.current = new Set();
      }
      setSendReadReceipts(!!next);
    },
    [],
  );

  return { sendReadReceipts, onToggleReadReceipts, sendReadReceipt, flushPendingRead };
}

