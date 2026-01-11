import * as React from 'react';

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
  onNewDmNotification?: ((conversationId: string, user: string, userSub?: string) => void) | undefined;
  onNewDmNotificationRef: { current: any };
  onKickedFromConversation?: ((conversationId: string) => void) | undefined;
  onKickedFromConversationRef: { current: any };
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
    onKickedFromConversationRef.current = onKickedFromConversation;
  }, [onKickedFromConversation, onKickedFromConversationRef]);
}

