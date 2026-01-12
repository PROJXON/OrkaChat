import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { ChatMessage, EncryptedGroupPayloadV1 } from './types';

type SetMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;

export function applyOptimisticSendForTextOnly(opts: {
  enabled: boolean;
  clientMessageId: string;
  outgoingText: string;
  originalInput: string;
  displayName: string;
  myUserId: string | null | undefined;
  isDm: boolean;
  isGroup: boolean;
  autoDecrypt: boolean;
  encryptedPlaceholder: string;
  ttlSeconds: number | undefined;
  parseEncrypted: (rawText: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (rawText: string) => EncryptedGroupPayloadV1 | null;
  normalizeUser: (v: unknown) => string;
  setMessages: SetMessages;
  sendTimeoutRef: { current: Record<string, ReturnType<typeof setTimeout> | undefined> };
  timeoutMs?: number;
  nowMs?: number;
}): void {
  if (!opts.enabled) return;

  const nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 5000;

  const optimisticRaw = opts.outgoingText;
  const optimisticEncrypted = opts.parseEncrypted(optimisticRaw);
  const optimisticGroupEncrypted = opts.parseGroupEncrypted(optimisticRaw);
  const optimisticPlaintext = opts.originalInput.trim();

  const optimisticMsg: ChatMessage = {
    id: opts.clientMessageId,
    user: opts.displayName,
    userLower: opts.normalizeUser(opts.displayName),
    userSub: opts.myUserId ?? undefined,
    rawText: optimisticRaw,
    encrypted: optimisticEncrypted ?? undefined,
    groupEncrypted: optimisticGroupEncrypted ?? undefined,
    // If it's an encrypted DM, only show plaintext optimistically when autoDecrypt is enabled.
    decryptedText:
      opts.isDm && optimisticEncrypted && opts.autoDecrypt
        ? optimisticPlaintext
        : opts.isGroup && optimisticGroupEncrypted && opts.autoDecrypt
          ? optimisticPlaintext
          : undefined,
    text:
      (opts.isDm && optimisticEncrypted) || (opts.isGroup && optimisticGroupEncrypted)
        ? opts.autoDecrypt
          ? optimisticPlaintext
          : opts.encryptedPlaceholder
        : optimisticEncrypted
          ? opts.encryptedPlaceholder
          : optimisticRaw,
    createdAt: nowMs,
    ttlSeconds: opts.ttlSeconds,
    localStatus: 'sending',
  };

  opts.setMessages((prev) =>
    prev.some((m) => m.id === optimisticMsg.id) ? prev : [optimisticMsg, ...prev],
  );

  // If we don't see our own echo within a short window, mark as failed.
  // (We don't show "sending…" for text; we only show a failure state.)
  const existing = opts.sendTimeoutRef.current[opts.clientMessageId];
  if (existing) clearTimeout(existing);
  opts.sendTimeoutRef.current[opts.clientMessageId] = setTimeout(() => {
    opts.setMessages((prev) =>
      prev.map((m) =>
        m.id === opts.clientMessageId && m.localStatus === 'sending'
          ? { ...m, localStatus: 'failed' }
          : m,
      ),
    );
    delete opts.sendTimeoutRef.current[opts.clientMessageId];
  }, timeoutMs);
}
