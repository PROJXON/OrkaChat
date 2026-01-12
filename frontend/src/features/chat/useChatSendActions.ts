import * as React from 'react';
import type { RefObject } from 'react';

import type { MediaItem } from '../../types/media';
import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { ChatEnvelope, ChatMessage, DmMediaEnvelopeV1, EncryptedGroupPayloadV1, GroupMediaEnvelopeV1 } from './types';
import type { PendingMediaItem } from './attachments';

export type ReplyTarget = {
  createdAt: number;
  id: string;
  user?: string;
  userSub?: string;
  preview: string;
  mediaKind?: 'image' | 'video' | 'file';
  mediaCount?: number;
  mediaThumbUri?: string | null;
};

type TextInputLike = { clear?: () => void };

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

export function useChatSendActions(opts: {
  // connection + identity
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  displayName: string;
  myUserId: string | null | undefined;
  isDm: boolean;
  isGroup: boolean;
  isChannel: boolean;

  // ui state refs
  inputRef: React.MutableRefObject<string>;
  pendingMediaRef: React.MutableRefObject<PendingMediaItem[]>;
  textInputRef: React.MutableRefObject<TextInputLike | null>;

  // ui state setters
  setError: (s: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setInput: (s: string) => void;
  setInputEpoch: React.Dispatch<React.SetStateAction<number>>;
  setPendingMediaItems: (items: PendingMediaItem[] | null | undefined) => void;
  clearPendingMedia: () => void;
  replyTarget: ReplyTarget | null;
  setReplyTarget: (v: ReplyTarget | null) => void;
  inlineEditTargetId: string | null;
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;
  onBlockedByInlineEdit: () => void;

  // typing
  isTypingRef: React.MutableRefObject<boolean>;

  // group guard
  groupMeta: { meStatus?: string } | null | undefined;
  groupMembers: Array<{ status: string; memberSub: string }>;
  groupPublicKeyBySub: Record<string, string>;

  // limits
  maxAttachmentsPerMessage: number;

  // crypto + uploads
  myPrivateKey: string | null | undefined;
  peerPublicKey: string | null | undefined;
  getRandomBytes: (n: number) => Uint8Array;
  encryptChatMessageV1: (plaintext: string, myPrivateKey: string, peerPublicKey: string) => EncryptedChatPayloadV1;
  prepareDmOutgoingEncryptedText: (args: {
    conversationId: string;
    outgoingText: string;
    pendingMedia: PendingMediaItem[] | null | undefined;
    caption: string;
    myPrivateKey: string;
    peerPublicKey: string;
    uploadPendingMediaDmEncrypted: (
      item: PendingMediaItem,
      conversationId: string,
      myPrivateKey: string,
      peerPublicKey: string,
      caption?: string,
    ) => Promise<DmMediaEnvelopeV1>;
  }) => Promise<{ outgoingText: string; mediaPathsToSend?: string[] }>;
  prepareGroupMediaPlaintext: (args: {
    conversationId: string;
    pendingMedia: PendingMediaItem[] | null | undefined;
    caption: string;
    messageKeyBytes: Uint8Array;
    uploadPendingMediaGroupEncrypted: (
      item: PendingMediaItem,
      conversationId: string,
      messageKeyBytes: Uint8Array,
      caption?: string,
    ) => Promise<GroupMediaEnvelopeV1>;
  }) => Promise<{ plaintextToEncrypt: string; mediaPathsToSend: string[] }>;
  encryptGroupOutgoingEncryptedText: (args: {
    plaintextToEncrypt: string;
    messageKeyBytes: Uint8Array;
    myPrivateKey: string;
    myUserId: string;
    activeMemberSubs: string[];
    groupPublicKeyBySub: Record<string, string>;
  }) => string;
  uploadPendingMedia: (media: PendingMediaItem) => Promise<MediaItem>;
  uploadPendingMediaDmEncrypted: (
    media: PendingMediaItem,
    conversationKey: string,
    senderPrivateKeyHex: string,
    recipientPublicKeyHex: string,
    captionOverride?: string,
  ) => Promise<DmMediaEnvelopeV1>;
  uploadPendingMediaGroupEncrypted: (
    media: PendingMediaItem,
    conversationKey: string,
    messageKeyBytes: Uint8Array,
    captionOverride?: string,
  ) => Promise<GroupMediaEnvelopeV1>;

  // ids + optimistic
  timestampId: (t: number, prefix: string) => string;
  applyOptimisticSendForTextOnly: (args: {
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
    parseEncrypted: (s: string) => EncryptedChatPayloadV1 | null;
    parseGroupEncrypted: (s: string) => EncryptedGroupPayloadV1 | null;
    normalizeUser: (v: unknown) => string;
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    sendTimeoutRef: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout>>>;
  }) => void;
  sendTimeoutRef: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout>>>;

  // ttl
  autoDecrypt: boolean;
  encryptedPlaceholder: string;
  ttlSeconds: number | undefined;
  parseEncrypted: (s: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (s: string) => EncryptedGroupPayloadV1 | null;
  normalizeUser: (v: unknown) => string;

  // errors
  showAlert: (title: string, body: string) => void;
}) {
  const {
    wsRef,
    activeConversationId,
    displayName,
    myUserId,
    isDm,
    isGroup,
    isChannel: _isChannel,
    inputRef,
    pendingMediaRef,
    textInputRef,
    setError,
    setMessages,
    setInput,
    setInputEpoch,
    setPendingMediaItems,
    clearPendingMedia,
    replyTarget,
    setReplyTarget,
    inlineEditTargetId,
    isUploading,
    setIsUploading,
    onBlockedByInlineEdit,
    isTypingRef,
    groupMeta,
    groupMembers,
    groupPublicKeyBySub,
    maxAttachmentsPerMessage,
    myPrivateKey,
    peerPublicKey,
    getRandomBytes,
    encryptChatMessageV1,
    prepareDmOutgoingEncryptedText,
    prepareGroupMediaPlaintext,
    encryptGroupOutgoingEncryptedText,
    uploadPendingMedia,
    uploadPendingMediaDmEncrypted,
    uploadPendingMediaGroupEncrypted,
    timestampId,
    applyOptimisticSendForTextOnly,
    sendTimeoutRef,
    autoDecrypt,
    encryptedPlaceholder,
    ttlSeconds,
    parseEncrypted,
    parseGroupEncrypted,
    normalizeUser,
    showAlert,
  } = opts;

  const sendMessage = React.useCallback(async () => {
    if (inlineEditTargetId) {
      onBlockedByInlineEdit();
      return;
    }
    if (isUploading) return;
    const currentInput = inputRef.current;
    const currentPendingMedia = pendingMediaRef.current;
    if (!currentInput.trim() && (!currentPendingMedia || currentPendingMedia.length === 0)) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    if (isGroup && groupMeta && groupMeta.meStatus !== 'active') {
      showAlert('Read-only', 'You have left this group and can no longer send messages.');
      return;
    }

    // Stop typing indicator on send (best-effort)
    if (isTypingRef.current) {
      try {
        wsRef.current.send(
          JSON.stringify({
            action: 'typing',
            conversationId: activeConversationId,
            user: displayName,
            isTyping: false,
            createdAt: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
      isTypingRef.current = false;
    }

    // Snapshot current input/media.
    const originalInput = currentInput;
    const originalReplyTarget = replyTarget;
    const originalPendingMedia =
      currentPendingMedia && currentPendingMedia.length > maxAttachmentsPerMessage
        ? currentPendingMedia.slice(0, maxAttachmentsPerMessage)
        : currentPendingMedia;
    if (currentPendingMedia && currentPendingMedia.length > maxAttachmentsPerMessage) {
      showAlert('Attachment limit', `Only ${maxAttachmentsPerMessage} items allowed per message.`);
    }

    let outgoingText = originalInput.trim();
    let dmMediaPathsToSend: string[] | undefined = undefined;

    const clearDraftImmediately = () => {
      // Force-remount the TextInput to fully reset native state.
      // This is the most reliable way to guarantee "instant clear" on Android
      // even if the user keeps typing and spams Send.
      setInputEpoch((v) => v + 1);
      try {
        textInputRef.current?.clear?.();
      } catch {
        // ignore
      }
      setInput('');
      inputRef.current = '';
      clearPendingMedia();
      setReplyTarget(null);
    };

    const restoreDraftIfUnchanged = () => {
      // Only restore if the user hasn't started typing a new message / attaching new media.
      if ((inputRef.current || '').length === 0 && (!pendingMediaRef.current || pendingMediaRef.current.length === 0)) {
        setInput(originalInput);
        inputRef.current = originalInput;
        setPendingMediaItems(originalPendingMedia);
      }
    };

    // Clear immediately (and yield a tick) so the input visually resets before CPU-heavy work (encryption/upload).
    // (We also clear even when editing, like Signal does.)
    clearDraftImmediately();
    await new Promise((r) => setTimeout(r, 0));

    if (isDm) {
      if (!myPrivateKey) {
        showAlert('Encryption not ready', 'Missing your private key on this device.');
        restoreDraftIfUnchanged();
        return;
      }
      if (!peerPublicKey) {
        showAlert('Encryption not ready', "Can't find the recipient's public key.");
        restoreDraftIfUnchanged();
        return;
      }

      // DM media: encrypt + upload ciphertext, then encrypt the envelope as a normal DM message.
      // We also include opaque S3 keys as `mediaPaths` so the backend can delete attachments later
      // without decrypting message text.
      if (originalPendingMedia && originalPendingMedia.length) {
        try {
          setIsUploading(true);
          const prepared = await prepareDmOutgoingEncryptedText({
            conversationId: activeConversationId,
            outgoingText,
            pendingMedia: originalPendingMedia,
            caption: originalInput.trim(),
            myPrivateKey,
            peerPublicKey,
            uploadPendingMediaDmEncrypted,
          });
          outgoingText = prepared.outgoingText;
          dmMediaPathsToSend = prepared.mediaPathsToSend;
        } catch (e: unknown) {
          showAlert('Upload Failed', getErrorMessage(e) || 'Failed to upload media');
          restoreDraftIfUnchanged();
          return;
        } finally {
          setIsUploading(false);
        }
      } else {
        const enc = encryptChatMessageV1(outgoingText, myPrivateKey, peerPublicKey);
        outgoingText = JSON.stringify(enc);
      }
    } else if (isGroup) {
      if (!myPrivateKey) {
        showAlert('Encryption not ready', 'Missing your private key on this device.');
        restoreDraftIfUnchanged();
        return;
      }
      if (!myUserId) {
        showAlert('Encryption not ready', 'Missing your user identity.');
        restoreDraftIfUnchanged();
        return;
      }
      const activeMembers = groupMembers.filter((m) => m.status === 'active').map((m) => m.memberSub);
      if (activeMembers.length < 2) {
        showAlert('Group not ready', 'No active members found.');
        restoreDraftIfUnchanged();
        return;
      }
      // Require keys for all active members (product rule).
      for (const sub of activeMembers) {
        if (sub === myUserId) continue;
        if (!groupPublicKeyBySub[sub]) {
          showAlert('Encryption not ready', "Can't find a group member's public key.");
          restoreDraftIfUnchanged();
          return;
        }
      }

      // Generate per-message key first (used for message + attachment wraps).
      const messageKeyBytes = new Uint8Array(getRandomBytes(32));

      // Build plaintext to encrypt.
      let plaintextToEncrypt = outgoingText;
      let groupMediaPathsToSend: string[] | undefined = undefined;
      if (originalPendingMedia && originalPendingMedia.length) {
        try {
          setIsUploading(true);
          const uploaded = await prepareGroupMediaPlaintext({
            conversationId: activeConversationId,
            pendingMedia: originalPendingMedia,
            caption: originalInput.trim(),
            messageKeyBytes,
            uploadPendingMediaGroupEncrypted,
          });
          plaintextToEncrypt = uploaded.plaintextToEncrypt;
          groupMediaPathsToSend = uploaded.mediaPathsToSend;
        } catch (e: unknown) {
          showAlert('Upload Failed', getErrorMessage(e) || 'Failed to upload media');
          restoreDraftIfUnchanged();
          return;
        } finally {
          setIsUploading(false);
        }
      }

      outgoingText = encryptGroupOutgoingEncryptedText({
        plaintextToEncrypt,
        messageKeyBytes,
        myPrivateKey,
        myUserId,
        activeMemberSubs: activeMembers,
        groupPublicKeyBySub,
      });
      // For backend deletion support (like DM), send opaque keys.
      if (typeof groupMediaPathsToSend !== 'undefined') dmMediaPathsToSend = groupMediaPathsToSend;
    } else if (originalPendingMedia && originalPendingMedia.length) {
      try {
        setIsUploading(true);
        const uploadedItems: MediaItem[] = [];
        for (const item of originalPendingMedia) {
           
          const uploaded = await uploadPendingMedia(item);
          uploadedItems.push(uploaded);
        }
        const envelope: ChatEnvelope = {
          type: 'chat',
          text: outgoingText,
          media: uploadedItems.length === 1 ? uploadedItems[0] : uploadedItems,
        };
        outgoingText = JSON.stringify(envelope);
      } catch (e: unknown) {
        showAlert('Upload Failed', getErrorMessage(e) || 'Failed to upload media');
        restoreDraftIfUnchanged();
        return;
      } finally {
        setIsUploading(false);
      }
    } else {
      // Plain text global message already cleared above.
    }

    const clientMessageId = timestampId(Date.now(), 'c');

    // Optimistic UI: show the outgoing message immediately, then let the WS echo dedupe by id.
    // (Backend uses clientMessageId as messageId when provided.)
    applyOptimisticSendForTextOnly({
      enabled: !originalPendingMedia || originalPendingMedia.length === 0,
      clientMessageId,
      outgoingText,
      originalInput,
      displayName,
      myUserId,
      isDm,
      isGroup,
      autoDecrypt,
      encryptedPlaceholder,
      ttlSeconds: isDm && ttlSeconds ? ttlSeconds : undefined,
      parseEncrypted,
      parseGroupEncrypted,
      normalizeUser,
      setMessages,
      sendTimeoutRef,
    });

    const outgoing = {
      action: 'message',
      text: outgoingText,
      conversationId: activeConversationId,
      user: displayName,
      clientMessageId,
      createdAt: Date.now(),
      // TTL-from-read: we send a duration, and the countdown starts when the recipient decrypts.
      ttlSeconds: isDm && ttlSeconds ? ttlSeconds : undefined,
      ...(isDm && typeof dmMediaPathsToSend !== 'undefined' ? { mediaPaths: dmMediaPathsToSend } : {}),
      ...(!isDm && !isGroup && originalReplyTarget
        ? {
            replyToCreatedAt: originalReplyTarget.createdAt,
            replyToMessageId: originalReplyTarget.id,
            replyToUserSub: originalReplyTarget.userSub,
            replyToPreview: originalReplyTarget.preview,
          }
        : {}),
    };
    try {
      wsRef.current.send(JSON.stringify(outgoing));
    } catch {
      // Mark optimistic message as failed if send throws (rare, but possible during reconnect).
      setMessages((prev) => prev.map((m) => (m.id === clientMessageId ? { ...m, localStatus: 'failed' } : m)));
      setError('Not connected');
      return;
    }
  }, [
    activeConversationId,
    applyOptimisticSendForTextOnly,
    autoDecrypt,
    clearPendingMedia,
    displayName,
    encryptedPlaceholder,
    encryptChatMessageV1,
    encryptGroupOutgoingEncryptedText,
    getRandomBytes,
    groupMembers,
    groupMeta,
    groupPublicKeyBySub,
    inlineEditTargetId,
    inputRef,
    isDm,
    isGroup,
    isTypingRef,
    isUploading,
    maxAttachmentsPerMessage,
    myPrivateKey,
    myUserId,
    normalizeUser,
    onBlockedByInlineEdit,
    parseEncrypted,
    parseGroupEncrypted,
    peerPublicKey,
    pendingMediaRef,
    prepareDmOutgoingEncryptedText,
    prepareGroupMediaPlaintext,
    replyTarget,
    sendTimeoutRef,
    setError,
    setInput,
    setInputEpoch,
    setIsUploading,
    setMessages,
    setPendingMediaItems,
    setReplyTarget,
    showAlert,
    textInputRef,
    timestampId,
    ttlSeconds,
    uploadPendingMedia,
    uploadPendingMediaDmEncrypted,
    uploadPendingMediaGroupEncrypted,
    wsRef,
  ]);

  const retryFailedMessage = React.useCallback(
    (msg: ChatMessage) => {
      if (!msg || msg.localStatus !== 'failed') return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected');
        return;
      }
      if (!msg.rawText || !msg.rawText.trim()) return;

      // Flip back to sending immediately.
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, localStatus: 'sending' } : m)));

      // Re-arm timeout.
      if (sendTimeoutRef.current[msg.id]) clearTimeout(sendTimeoutRef.current[msg.id]);
      sendTimeoutRef.current[msg.id] = setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id && m.localStatus === 'sending' ? { ...m, localStatus: 'failed' } : m)),
        );
        delete sendTimeoutRef.current[msg.id];
      }, 5000);

      try {
        wsRef.current.send(
          JSON.stringify({
            action: 'message',
            text: msg.rawText,
            conversationId: activeConversationId,
            user: displayName,
            clientMessageId: msg.id, // keep same bubble id
            createdAt: Date.now(),
            ttlSeconds: isDm && msg.ttlSeconds ? msg.ttlSeconds : undefined,
          }),
        );
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, localStatus: 'failed' } : m)));
      }
    },
    [activeConversationId, displayName, isDm, sendTimeoutRef, setError, setMessages, wsRef],
  );

  return { sendMessage, retryFailedMessage };
}

