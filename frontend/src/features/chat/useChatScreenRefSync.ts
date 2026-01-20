import * as React from 'react';

type OnNewDmNotification = (conversationId: string, user: string, userSub?: string) => void;
type OnKickedFromConversation = (conversationId: string) => void;
type RefreshUnreads = () => void | Promise<void>;

export function useChatScreenRefSync(opts: {
  activeConversationId: string;
  activeConversationIdRef: { current: string };
  cdnAvatarReset: () => void;
  displayName: string;
  displayNameRef: { current: string };
  input: string;
  inputRef: { current: string };
  myPublicKey: string | null;
  myPublicKeyRef: { current: string | null };
  onNewDmNotification?: OnNewDmNotification | undefined;
  onNewDmNotificationRef: React.MutableRefObject<OnNewDmNotification | undefined>;
  refreshUnreads?: RefreshUnreads | undefined;
  refreshUnreadsRef: React.MutableRefObject<RefreshUnreads | undefined>;
  onKickedFromConversation?: OnKickedFromConversation | undefined;
  onKickedFromConversationRef: React.MutableRefObject<OnKickedFromConversation | undefined>;
}): void {
  const {
    activeConversationId,
    activeConversationIdRef,
    cdnAvatarReset,
    displayName,
    displayNameRef,
    input,
    inputRef,
    myPublicKey,
    myPublicKeyRef,
    onNewDmNotification,
    onNewDmNotificationRef,
    refreshUnreads,
    refreshUnreadsRef,
    onKickedFromConversation,
    onKickedFromConversationRef,
  } = opts;

  React.useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId, activeConversationIdRef]);

  React.useEffect(() => {
    // Only reset when switching conversations.
    // IMPORTANT: don't depend on the whole `cdnAvatar` object identity here, because it can change
    // when the cache map changes (and then we'd create a reset loop).
    cdnAvatarReset();
  }, [activeConversationId, cdnAvatarReset]);

  React.useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName, displayNameRef]);

  React.useEffect(() => {
    inputRef.current = input;
  }, [input, inputRef]);

  React.useEffect(() => {
    myPublicKeyRef.current = myPublicKey;
  }, [myPublicKey, myPublicKeyRef]);

  React.useEffect(() => {
    onNewDmNotificationRef.current = onNewDmNotification;
  }, [onNewDmNotification, onNewDmNotificationRef]);

  React.useEffect(() => {
    refreshUnreadsRef.current = refreshUnreads;
  }, [refreshUnreads, refreshUnreadsRef]);

  React.useEffect(() => {
    onKickedFromConversationRef.current = onKickedFromConversation;
  }, [onKickedFromConversation, onKickedFromConversationRef]);
}
