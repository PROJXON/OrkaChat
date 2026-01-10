import * as React from 'react';

import type { ChatMessage } from './types';
import { buildFallbackChatMessageFromWsEventData, handleChatWsMessage } from './handleWsMessage';

export function useChatWsMessageHandler(opts: {
  activeConversationIdRef: React.MutableRefObject<string>;
  displayNameRef: React.MutableRefObject<string>;
  myUserId: string | null | undefined;
  myPublicKeyRef: React.MutableRefObject<string | null>;

  blockedSubsSet: Set<string>;
  // handleChatWsMessage uses a record lookup. Keep this flexible to avoid type drift.
  hiddenMessageIds: any;
  encryptedPlaceholder: string;

  avatarRefetchCooldownMs: number;
  lastAvatarRefetchAtBySubRef: React.MutableRefObject<Record<string, number>>;
  invalidateAvatarProfile: (sub: string) => void;

  onNewDmNotification: ((...args: any[]) => void) | undefined;
  onKickedFromConversation: ((...args: any[]) => void) | undefined;

  openInfo: (title: string, body: string) => void;
  showAlert: (title: string, body: string) => void;
  showToast: (msg: string, kind?: any) => void;

  refreshChannelRoster: (() => Promise<void>) | undefined;
  lastGroupRosterRefreshAtRef: React.MutableRefObject<number>;
  lastChannelRosterRefreshAtRef: React.MutableRefObject<number>;
  bumpGroupRefreshNonce: () => void;
  setGroupMeStatus: (meStatus: any) => void;

  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setPeerSeenAtByCreatedAt: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setTypingByUserExpiresAt: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  sendTimeoutRef: React.MutableRefObject<Record<string, any>>;

  parseEncrypted: (s: string) => any;
  parseGroupEncrypted: (s: string) => any;
  normalizeUser: (v: unknown) => string;
  normalizeReactions: (v: unknown) => any;
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
    normalizeUser,
    normalizeReactions,
  } = opts;

  return React.useCallback(
    (event: { data: any }) => {
      try {
        const payload = JSON.parse(event.data);
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
      openInfo,
      parseEncrypted,
      parseGroupEncrypted,
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

