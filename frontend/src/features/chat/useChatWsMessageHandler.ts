import * as React from 'react';

import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { ReactionMap } from '../../types/reactions';
import { buildFallbackChatMessageFromWsEventData, handleChatWsMessage } from './handleWsMessage';
import type {
  ChatMessage,
  DmMediaEnvelope,
  EncryptedGroupPayloadV1,
  GroupMediaEnvelope,
} from './types';

export function useChatWsMessageHandler(opts: {
  activeConversationIdRef: React.MutableRefObject<string>;
  displayNameRef: React.MutableRefObject<string>;
  myUserId: string | null | undefined;
  myPublicKeyRef: React.MutableRefObject<string | null>;

  blockedSubsSet: Set<string>;
  // handleChatWsMessage uses a record lookup. Keep this flexible to avoid type drift.
  hiddenMessageIds: Record<string, true>;
  encryptedPlaceholder: string;

  avatarRefetchCooldownMs: number;
  lastAvatarRefetchAtBySubRef: React.MutableRefObject<Record<string, number>>;
  invalidateAvatarProfile: (sub: string) => void;

  onNewDmNotification:
    | ((conversationId: string, senderLabel: string, senderSub?: string) => void)
    | undefined;
  refreshUnreads: (() => void | Promise<void>) | undefined;
  onKickedFromConversation: ((conversationId: string) => void) | undefined;

  openInfo: (title: string, body: string) => void;
  showAlert: (title: string, body: string) => void;
  showToast: (msg: string, kind?: 'success' | 'error') => void;

  refreshChannelRoster: (() => Promise<void>) | undefined;
  lastGroupRosterRefreshAtRef: React.MutableRefObject<number>;
  lastChannelRosterRefreshAtRef: React.MutableRefObject<number>;
  bumpGroupRefreshNonce: () => void;
  setGroupMeStatus: (meStatus: string) => void;

  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setPeerSeenAtByCreatedAt: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setTypingByUserExpiresAt: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  sendTimeoutRef: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout> | undefined>>;

  parseEncrypted: (s: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (s: string) => EncryptedGroupPayloadV1 | null;
  // Optional: if provided, encrypted edit events can update visible text immediately.
  decryptForDisplay?: (m: ChatMessage) => string;
  decryptGroupForDisplay?: (m: ChatMessage) => { plaintext: string; messageKeyHex: string } | null;
  parseDmMediaEnvelope?: (plaintext: string) => DmMediaEnvelope | null;
  parseGroupMediaEnvelope?: (plaintext: string) => GroupMediaEnvelope | null;
  normalizeUser: (v: unknown) => string;
  normalizeReactions: (v: unknown) => ReactionMap | undefined;
}) {
  const {
    activeConversationIdRef,
    displayNameRef,
    myUserId,
    myPublicKeyRef,
    blockedSubsSet,
    hiddenMessageIds,
    encryptedPlaceholder,
    avatarRefetchCooldownMs,
    lastAvatarRefetchAtBySubRef,
    invalidateAvatarProfile,
    onNewDmNotification,
    refreshUnreads,
    onKickedFromConversation,
    openInfo,
    showAlert,
    showToast,
    refreshChannelRoster,
    lastGroupRosterRefreshAtRef,
    lastChannelRosterRefreshAtRef,
    bumpGroupRefreshNonce,
    setGroupMeStatus,
    setMessages,
    setPeerSeenAtByCreatedAt,
    setTypingByUserExpiresAt,
    sendTimeoutRef,
    parseEncrypted,
    parseGroupEncrypted,
    decryptForDisplay,
    decryptGroupForDisplay,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeUser,
    normalizeReactions,
  } = opts;

  return React.useCallback(
    (event: { data: unknown }) => {
      try {
        const payload = JSON.parse(
          typeof event.data === 'string' ? event.data : String(event.data ?? ''),
        );
        const activeConv = activeConversationIdRef.current;
        const dn = displayNameRef.current;
        const myUserLower = normalizeUser(dn);
        const payloadUserLower =
          typeof payload?.userLower === 'string'
            ? normalizeUser(payload.userLower)
            : typeof payload?.user === 'string'
              ? normalizeUser(payload.user)
              : '';

        handleChatWsMessage({
          payload,
          activeConversationId: activeConv,
          displayName: dn,
          myUserId,
          myPublicKey: myPublicKeyRef.current,
          myUserLower,
          payloadUserLower,
          blockedSubsSet,
          hiddenMessageIds,
          encryptedPlaceholder,
          avatarRefetchCooldownMs,
          lastAvatarRefetchAtBySubRef,
          invalidateAvatarProfile,
          onNewDmNotification,
          refreshUnreads,
          onKickedFromConversation,
          openInfo,
          showAlert,
          refreshChannelRoster,
          lastGroupRosterRefreshAtRef,
          lastChannelRosterRefreshAtRef,
          bumpGroupRefreshNonce,
          setGroupMeStatus,
          showToast,
          setMessages,
          setPeerSeenAtByCreatedAt,
          setTypingByUserExpiresAt,
          sendTimeoutRef,
          parseEncrypted,
          parseGroupEncrypted,
          decryptForDisplay,
          decryptGroupForDisplay,
          parseDmMediaEnvelope,
          parseGroupMediaEnvelope,
          normalizeUser,
          normalizeReactions,
        });
      } catch {
        const msg: ChatMessage = buildFallbackChatMessageFromWsEventData(event.data);
        if (msg.userSub && blockedSubsSet.has(String(msg.userSub))) return;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
      }
    },
    [
      activeConversationIdRef,
      avatarRefetchCooldownMs,
      blockedSubsSet,
      displayNameRef,
      encryptedPlaceholder,
      hiddenMessageIds,
      invalidateAvatarProfile,
      lastAvatarRefetchAtBySubRef,
      lastChannelRosterRefreshAtRef,
      lastGroupRosterRefreshAtRef,
      myPublicKeyRef,
      myUserId,
      normalizeReactions,
      normalizeUser,
      onKickedFromConversation,
      onNewDmNotification,
      refreshUnreads,
      openInfo,
      parseEncrypted,
      parseGroupEncrypted,
      decryptForDisplay,
      decryptGroupForDisplay,
      parseDmMediaEnvelope,
      parseGroupMediaEnvelope,
      refreshChannelRoster,
      sendTimeoutRef,
      setGroupMeStatus,
      setMessages,
      setPeerSeenAtByCreatedAt,
      setTypingByUserExpiresAt,
      showAlert,
      showToast,
      bumpGroupRefreshNonce,
    ],
  );
}
