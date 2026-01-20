import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { ReactionMap } from '../../types/reactions';
import { timestampId } from '../../utils/ids';
import { throttleByRef } from '../../utils/throttled';
import { applyGroupMembershipSystemEventToMe } from './applyMembershipToMe';
import { buildIncomingChatMessageFromWsPayload } from './buildIncomingMessage';
import { buildSystemChatMessageFromPayload } from './buildSystemMessage';
import { isMembershipSystemKind } from './membershipKinds';
import type { ChatMessage, EncryptedGroupPayloadV1 } from './types';

type Ref<T> = { current: T };
type SetState<T> = (updater: (prev: T) => T) => void;

export function handleChatWsMessage(opts: {
  payload: unknown;
  activeConversationId: string;
  displayName: string;
  myUserId: string | null | undefined;
  myPublicKey: string | null | undefined;
  myUserLower: string;
  payloadUserLower: string;
  blockedSubsSet: Set<string>;
  hiddenMessageIds: Record<string, true>;
  encryptedPlaceholder: string;
  avatarRefetchCooldownMs: number;
  lastAvatarRefetchAtBySubRef: Ref<Record<string, number>>;
  invalidateAvatarProfile: (sub: string) => void;
  onNewDmNotification:
    | ((conversationId: string, senderLabel: string, senderSub?: string) => void)
    | undefined;
  refreshUnreads: (() => void | Promise<void>) | undefined;
  onKickedFromConversation: ((conversationId: string) => void) | undefined;
  openInfo: ((title: string, body: string) => void) | undefined;
  showAlert: (title: string, body: string) => void;
  refreshChannelRoster: (() => void) | undefined;
  lastGroupRosterRefreshAtRef: Ref<number>;
  lastChannelRosterRefreshAtRef: Ref<number>;
  bumpGroupRefreshNonce: () => void;
  setGroupMeStatus: (meStatus: string) => void;
  showToast: (message: string, kind?: 'success' | 'error') => void;
  setMessages: SetState<ChatMessage[]>;
  setPeerSeenAtByCreatedAt: SetState<Record<string, number>>;
  setTypingByUserExpiresAt: SetState<Record<string, number>>;
  sendTimeoutRef: Ref<Record<string, ReturnType<typeof setTimeout> | undefined>>;
  parseEncrypted: (rawText: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (rawText: string) => EncryptedGroupPayloadV1 | null;
  normalizeUser: (v: unknown) => string;
  normalizeReactions: (v: unknown) => ReactionMap | undefined;
}): void {
  const payload =
    typeof opts.payload === 'object' && opts.payload != null
      ? (opts.payload as Record<string, unknown>)
      : null;
  if (!payload) return;
  const activeConv = opts.activeConversationId;

  const isPayloadChat =
    typeof payload?.conversationId === 'string' && payload?.conversationId !== 'global';
  const isDifferentConversation = payload?.conversationId !== activeConv;
  const payloadSub = typeof payload?.userSub === 'string' ? payload.userSub : '';
  const fromOtherUser =
    payloadSub && opts.myUserId
      ? payloadSub !== opts.myUserId
      : opts.payloadUserLower !== opts.myUserLower;
  const hasText = typeof payload?.text === 'string';
  if (
    isPayloadChat &&
    isDifferentConversation &&
    fromOtherUser &&
    hasText &&
    typeof payload.conversationId === 'string'
  ) {
    // System events shouldn't create "unread message" notifications.
    if (payload?.type === 'system' || payload?.kind === 'system') {
      // But "added to group" (and group updates) should refresh the unread inbox immediately,
      // otherwise users won't see the "Added to group: <title>" hint until the next poll/login.
      try {
        const convId = String(payload.conversationId || '');
        const systemKind = typeof payload.systemKind === 'string' ? payload.systemKind : '';
        const targetSub = typeof payload.targetSub === 'string' ? payload.targetSub : '';
        if (
          convId.startsWith('gdm#') &&
          (systemKind === 'added' || systemKind === 'update') &&
          // Only refresh on "added" when it targets me.
          (systemKind !== 'added' || (!!opts.myUserId && targetSub === opts.myUserId))
        ) {
          void Promise.resolve(opts.refreshUnreads?.());
        }
      } catch {
        // ignore
      }
    } else {
      // For group DMs, prefer server-provided groupTitle.
      const senderLabel =
        (typeof payload.groupTitle === 'string' && payload.groupTitle) ||
        (typeof payload.user === 'string' && payload.user) ||
        (typeof payload.userLower === 'string' && payload.userLower) ||
        'someone';
      const senderSub = typeof payload.userSub === 'string' ? payload.userSub : undefined;
      opts.onNewDmNotification?.(payload.conversationId, senderLabel, senderSub);
    }
  }

  // Group admin "kick": eject from active conversation (client-side navigation)
  if (payload && payload.type === 'kicked' && payload.conversationId === activeConv) {
    try {
      opts.showToast('You were kicked from the chat', 'error');
    } catch {
      // ignore
    }
    try {
      opts.onKickedFromConversation?.(String(payload.conversationId));
    } catch {
      // ignore
    }
  }

  // Server-side quota / error events (theme-appropriate modal).
  // IMPORTANT: This is preferred over relying on WS Lambda status codes, which don't consistently reach UI.
  if (payload && payload.type === 'error') {
    const code = typeof payload.code === 'string' ? String(payload.code) : '';
    if (code === 'media_quota') {
      const title =
        typeof payload.title === 'string' ? String(payload.title) : 'Upload limit reached';
      const msg =
        typeof payload.message === 'string'
          ? String(payload.message)
          : 'You’ve reached your daily upload limit. Please try again tomorrow.';
      try {
        opts.openInfo?.(title, msg);
      } catch {
        // fallback
        opts.showAlert(title, msg);
      }
      return;
    }
  }

  // Presence hints (server-authored, not persisted): e.g. someone joined the room.
  // Use these to refresh rosters/counts promptly without adding extra system messages.
  if (payload && payload.type === 'presence' && payload.conversationId === activeConv) {
    try {
      const kind = typeof payload.kind === 'string' ? payload.kind : '';
      if (kind === 'join' || kind === 'leave') {
        const now = Date.now();
        const conv = String(activeConv || '');
        if (conv.startsWith('gdm#')) {
          throttleByRef({
            lastAtRef: opts.lastGroupRosterRefreshAtRef,
            minIntervalMs: 750,
            now,
            run: () => opts.bumpGroupRefreshNonce(),
          });
        } else if (conv.startsWith('ch#')) {
          throttleByRef({
            lastAtRef: opts.lastChannelRosterRefreshAtRef,
            minIntervalMs: 750,
            now,
            run: () => void opts.refreshChannelRoster?.(),
          });
        }
      }
    } catch {
      // ignore
    }
    return;
  }

  // System events (server-authored), e.g. "User was kicked"
  if (
    payload &&
    payload.type === 'system' &&
    payload.conversationId === activeConv &&
    typeof payload.text === 'string'
  ) {
    // Membership-related system events should refresh the roster for everyone currently viewing this chat
    // (updates Members modal + any member counts).
    try {
      const kind = typeof payload.systemKind === 'string' ? payload.systemKind : '';
      if (isMembershipSystemKind(kind)) {
        const now = Date.now();
        const conv = String(activeConv || '');
        if (conv.startsWith('gdm#')) {
          throttleByRef({
            lastAtRef: opts.lastGroupRosterRefreshAtRef,
            minIntervalMs: 750,
            now,
            run: () => opts.bumpGroupRefreshNonce(),
          });
        } else if (conv.startsWith('ch#')) {
          throttleByRef({
            lastAtRef: opts.lastChannelRosterRefreshAtRef,
            minIntervalMs: 750,
            now,
            run: () => void opts.refreshChannelRoster?.(),
          });
        }
      }
    } catch {
      // ignore
    }

    // If a membership-related system event targets me, immediately refresh/flip the chat out of read-only.
    // (We also have a periodic refresh fallback, but this makes it instant when the event arrives.)
    try {
      const mySub = opts.myUserId;
      const targetSub = typeof payload.targetSub === 'string' ? payload.targetSub : '';
      const systemKind = typeof payload.systemKind === 'string' ? payload.systemKind : '';
      applyGroupMembershipSystemEventToMe({
        mySub,
        targetSub,
        systemKind,
        setMeStatus: (meStatus) => opts.setGroupMeStatus(meStatus),
        bumpRefresh: () => opts.bumpGroupRefreshNonce(),
      });
    } catch {
      // ignore
    }

    const msg: ChatMessage = buildSystemChatMessageFromPayload(payload);
    opts.setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
    return;
  }

  // Read receipt events (broadcast by backend)
  if (payload && payload.type === 'read' && payload.conversationId === activeConv) {
    const readerSub = typeof payload.userSub === 'string' ? payload.userSub : '';
    const fromMe =
      opts.myUserId && readerSub
        ? readerSub === opts.myUserId
        : opts.payloadUserLower === opts.myUserLower;
    if (payload.user && !fromMe) {
      const readAt =
        typeof payload.readAt === 'number' ? payload.readAt : Math.floor(Date.now() / 1000);
      // New: per-message receipt (messageCreatedAt). Backward compat: treat readUpTo as a messageCreatedAt.
      const messageCreatedAt =
        typeof payload.messageCreatedAt === 'number'
          ? payload.messageCreatedAt
          : typeof payload.readUpTo === 'number'
            ? payload.readUpTo
            : undefined;

      if (typeof messageCreatedAt === 'number') {
        opts.setPeerSeenAtByCreatedAt((prev) => ({
          ...prev,
          [String(messageCreatedAt)]: prev[String(messageCreatedAt)]
            ? Math.min(prev[String(messageCreatedAt)], readAt)
            : readAt,
        }));

        // TTL-from-read for outgoing messages: start countdown for that specific message (if it has ttlSeconds).
        opts.setMessages((prev) =>
          prev.map((m) => {
            const isOutgoingByUserSub =
              !!opts.myUserId && !!m.userSub && String(m.userSub) === String(opts.myUserId);
            const isEncryptedOutgoing =
              !!m.encrypted &&
              !!opts.myPublicKey &&
              m.encrypted.senderPublicKey === opts.myPublicKey;
            const isPlainOutgoing =
              !m.encrypted &&
              (isOutgoingByUserSub
                ? true
                : opts.normalizeUser(m.userLower ?? m.user ?? 'anon') === opts.myUserLower);
            const isOutgoing = isOutgoingByUserSub || isEncryptedOutgoing || isPlainOutgoing;
            if (!isOutgoing) return m;
            if (m.createdAt !== messageCreatedAt) return m;
            if (m.expiresAt) return m;
            if (!m.ttlSeconds || m.ttlSeconds <= 0) return m;
            return { ...m, expiresAt: readAt + m.ttlSeconds };
          }),
        );
      }
    }
    return;
  }

  // Typing indicator events (broadcast by backend)
  // Expected shape:
  // { type: 'typing', conversationId, user, isTyping: boolean, createdAt?: number }
  if (payload && payload.type === 'typing') {
    const incomingConv =
      typeof payload.conversationId === 'string' && payload.conversationId.length > 0
        ? payload.conversationId
        : 'global';
    if (incomingConv !== activeConv) return;
    const u = typeof payload.user === 'string' ? payload.user : 'someone';
    const payloadUserSub = typeof payload.userSub === 'string' ? payload.userSub : '';
    if (payloadUserSub && opts.blockedSubsSet.has(payloadUserSub)) return;
    if (opts.myUserId && payloadUserSub && payloadUserSub === opts.myUserId) return;
    if (!payloadUserSub && opts.payloadUserLower && opts.payloadUserLower === opts.myUserLower)
      return;
    const isTyping = payload.isTyping === true;
    if (!isTyping) {
      opts.setTypingByUserExpiresAt((prev) => {
        if (!prev[u]) return prev;
        const next = { ...prev };
        delete next[u];
        return next;
      });
    } else {
      const expiresAtMs = Date.now() + 4000; // client-side TTL for "typing..." line
      opts.setTypingByUserExpiresAt((prev) => ({ ...prev, [u]: expiresAtMs }));
    }
    return;
  }

  // Edit/delete events (broadcast by backend)
  if (payload && payload.type === 'edit') {
    const messageCreatedAt = Number(payload.createdAt);
    const editedAt = typeof payload.editedAt === 'number' ? payload.editedAt : Date.now();
    const newRaw =
      typeof payload.text === 'string'
        ? payload.text
        : payload.text && typeof payload.text === 'object'
          ? JSON.stringify(payload.text)
          : '';
    if (Number.isFinite(messageCreatedAt) && newRaw) {
      const extractChatTextFromText = (rawText: string): string => {
        const t = String(rawText || '').trim();
        if (!t) return '';
        // Fast path: typical plain text messages
        if (!(t.startsWith('{') && t.endsWith('}'))) return t;
        try {
          const obj = JSON.parse(t) as unknown;
          if (!obj || typeof obj !== 'object') return t;
          const rec = obj as Record<string, unknown>;
          if (rec.type !== 'chat') return t;
          return typeof rec.text === 'string' ? String(rec.text) : '';
        } catch {
          return t;
        }
      };

      opts.setMessages((prev) =>
        prev.map((m) => {
          if (m.createdAt !== messageCreatedAt) return m;
          if (m.deletedAt) return m;
          const encrypted = opts.parseEncrypted(newRaw);
          const groupEncrypted = opts.parseGroupEncrypted(newRaw);
          const isEncrypted = !!encrypted || !!groupEncrypted;
          // Important: for encrypted messages, don't wipe decrypted UI state if we already have it
          // (e.g. the sender optimistically updates decryptedText on edit).
          const nextText = isEncrypted
            ? m.decryptedText
              ? m.text
              : opts.encryptedPlaceholder
            : extractChatTextFromText(newRaw);
          return {
            ...m,
            rawText: newRaw,
            encrypted: encrypted ?? undefined,
            groupEncrypted: groupEncrypted ?? undefined,
            // Only reset groupKey/decryptedText when we *don't* have plaintext to preserve.
            groupKeyHex: isEncrypted && !m.decryptedText ? undefined : m.groupKeyHex,
            text: nextText,
            decryptedText: isEncrypted ? m.decryptedText : undefined,
            decryptFailed: isEncrypted ? m.decryptFailed : false,
            editedAt,
          };
        }),
      );
    }
    return;
  }

  if (payload && payload.type === 'delete') {
    const messageCreatedAt = Number(payload.createdAt);
    const deletedAt = typeof payload.deletedAt === 'number' ? payload.deletedAt : Date.now();
    const deletedBySub =
      typeof payload.deletedBySub === 'string' ? payload.deletedBySub : undefined;
    if (Number.isFinite(messageCreatedAt)) {
      opts.setMessages((prev) =>
        prev.map((m) =>
          m.createdAt === messageCreatedAt
            ? {
                ...m,
                deletedAt,
                deletedBySub,
                rawText: '',
                text: '',
                encrypted: undefined,
                decryptedText: undefined,
                decryptFailed: false,
              }
            : m,
        ),
      );
    }
    return;
  }

  // Reaction events (broadcast by backend)
  if (payload && payload.type === 'reaction') {
    const messageCreatedAt = Number(payload.createdAt);
    if (!Number.isFinite(messageCreatedAt)) return;

    // New shape: payload.reactions is the full map { emoji: {count, userSubs} }
    if (payload.reactions) {
      const normalized = opts.normalizeReactions(payload.reactions);
      opts.setMessages((prev) =>
        prev.map((m) => (m.createdAt === messageCreatedAt ? { ...m, reactions: normalized } : m)),
      );
      return;
    }

    // Backward compat: payload has { emoji, users }
    const emoji = typeof payload.emoji === 'string' ? payload.emoji : '';
    const users = Array.isArray(payload.users) ? payload.users.map(String).filter(Boolean) : [];
    if (emoji) {
      opts.setMessages((prev) =>
        prev.map((m) => {
          if (m.createdAt !== messageCreatedAt) return m;
          const nextReactions = { ...(m.reactions || {}) };
          if (users.length === 0) delete nextReactions[emoji];
          else nextReactions[emoji] = { count: users.length, userSubs: users };
          return { ...m, reactions: Object.keys(nextReactions).length ? nextReactions : undefined };
        }),
      );
    }
    return;
  }

  if (payload && payload.text) {
    // Only render messages for the currently open conversation.
    // (We still emit DM notifications above for other conversations.)
    const incomingConv =
      typeof payload.conversationId === 'string' && payload.conversationId.length > 0
        ? payload.conversationId
        : 'global';
    if (incomingConv !== activeConv) return;

    // If this sender has changed their avatar recently, invalidate our cached profile
    // so we refetch promptly and old messages update without waiting for TTL.
    const senderSubForAvatar =
      typeof payload.userSub === 'string' ? String(payload.userSub).trim() : '';
    // IMPORTANT:
    // Do NOT invalidate my own profile on my outgoing messages. That causes the header avatar
    // (Welcome row) to briefly fall back to the seeded default color until the public profile refetches.
    if (senderSubForAvatar && (!opts.myUserId || senderSubForAvatar !== opts.myUserId)) {
      const now = Date.now();
      const last = opts.lastAvatarRefetchAtBySubRef.current[senderSubForAvatar] || 0;
      if (now - last >= opts.avatarRefetchCooldownMs) {
        opts.lastAvatarRefetchAtBySubRef.current[senderSubForAvatar] = now;
        opts.invalidateAvatarProfile(senderSubForAvatar);
      }
    }

    const msg: ChatMessage = buildIncomingChatMessageFromWsPayload({
      payload,
      encryptedPlaceholder: opts.encryptedPlaceholder,
      parseEncrypted: opts.parseEncrypted,
      parseGroupEncrypted: opts.parseGroupEncrypted,
      normalizeUser: opts.normalizeUser,
      normalizeReactions: opts.normalizeReactions,
    });
    if (msg.userSub && opts.blockedSubsSet.has(String(msg.userSub))) return;
    if (opts.hiddenMessageIds[msg.id]) return;
    opts.setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx === -1) return [msg, ...prev];
      const existing = prev[idx];
      const shouldPreservePlaintext =
        !!existing.decryptedText ||
        (!!existing.text && existing.text !== opts.encryptedPlaceholder);
      const merged: ChatMessage = {
        ...msg,
        decryptedText: existing.decryptedText ?? msg.decryptedText,
        groupKeyHex: existing.groupKeyHex ?? msg.groupKeyHex,
        text: shouldPreservePlaintext ? existing.text : msg.text,
        localStatus: 'sent',
      };
      if (opts.sendTimeoutRef.current[msg.id]) {
        clearTimeout(opts.sendTimeoutRef.current[msg.id]);
        delete opts.sendTimeoutRef.current[msg.id];
      }
      const next = prev.slice();
      next[idx] = merged;
      return next;
    });
  }
}

export function buildFallbackChatMessageFromWsEventData(eventData: unknown): ChatMessage {
  return {
    id: timestampId(Date.now()),
    text: typeof eventData === 'string' ? eventData : String(eventData ?? ''),
    createdAt: Date.now(),
  };
}
