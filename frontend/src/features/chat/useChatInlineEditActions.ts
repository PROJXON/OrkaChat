import { bytesToHex } from '@noble/hashes/utils.js';
import type { RefObject } from 'react';
import * as React from 'react';

import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import type { MediaItem } from '../../types/media';
import type { PendingMediaItem } from './attachments';
import type {
  ChatEnvelope,
  ChatMessage,
  DmMediaEnvelope,
  DmMediaEnvelopeV1,
  EncryptedGroupPayloadV1,
  GroupMediaEnvelope,
  GroupMediaEnvelopeV1,
} from './types';

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

type DmMediaItem = { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] };
type GroupMediaItem = { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] };

export function useChatInlineEditActions(opts: {
  wsRef: RefObject<WebSocket | null>;
  activeConversationId: string;
  isDm: boolean;
  isGroup: boolean;

  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: (s: string) => void;

  // inline edit state
  inlineEditTargetId: string | null;
  setInlineEditTargetId: (v: string | null) => void;
  inlineEditDraft: string;
  setInlineEditDraft: (v: string) => void;
  inlineEditAttachmentMode: 'keep' | 'replace' | 'remove';
  setInlineEditAttachmentMode: (v: 'keep' | 'replace' | 'remove') => void;
  inlineEditUploading: boolean;
  setInlineEditUploading: (v: boolean) => void;

  // attachments
  pendingMediaRef: React.MutableRefObject<PendingMediaItem[]>;
  clearPendingMedia: () => void;

  // crypto
  myUserId: string | null | undefined;
  groupMembers: Array<{ status: string; memberSub: string }>;
  groupPublicKeyBySub: Record<string, string | undefined>;
  getRandomBytes: (n: number) => Uint8Array;
  myPrivateKey: string | null | undefined;
  peerPublicKey: string | null | undefined;
  encryptChatMessageV1: (
    plaintext: string,
    myPrivateKey: string,
    peerPublicKey: string,
  ) => EncryptedChatPayloadV1;
  parseEncrypted: (s: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (s: string) => EncryptedGroupPayloadV1 | null;
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
    groupPublicKeyBySub: Record<string, string | undefined>;
  }) => string;

  // parsing/normalizing (passed in to avoid deep imports)
  parseChatEnvelope: (raw: string) => ChatEnvelope | null;
  parseDmMediaEnvelope: (raw: string) => DmMediaEnvelope | null;
  parseGroupMediaEnvelope: (raw: string) => GroupMediaEnvelope | null;
  normalizeDmMediaItems: (env: DmMediaEnvelope | null) => DmMediaItem[];
  normalizeGroupMediaItems: (env: GroupMediaEnvelope | null) => GroupMediaItem[];

  // uploads
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

  // ui
  openInfo: (title: string, body: string) => void;
  showAlert: (title: string, body: string) => void;
  closeMessageActions: () => void;
}) {
  const {
    wsRef,
    activeConversationId,
    isDm,
    isGroup,
    messages,
    setMessages,
    setError,
    inlineEditTargetId,
    setInlineEditTargetId,
    inlineEditDraft,
    setInlineEditDraft,
    inlineEditAttachmentMode,
    setInlineEditAttachmentMode,
    inlineEditUploading,
    setInlineEditUploading,
    pendingMediaRef,
    clearPendingMedia,
    myUserId,
    groupMembers,
    groupPublicKeyBySub,
    getRandomBytes,
    myPrivateKey,
    peerPublicKey,
    encryptChatMessageV1,
    parseEncrypted,
    parseGroupEncrypted,
    prepareGroupMediaPlaintext,
    encryptGroupOutgoingEncryptedText,
    parseChatEnvelope,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    uploadPendingMedia,
    uploadPendingMediaDmEncrypted,
    uploadPendingMediaGroupEncrypted,
    openInfo,
    showAlert,
    closeMessageActions,
  } = opts;

  const cancelInlineEdit = React.useCallback(() => {
    if (inlineEditUploading) return;
    setInlineEditTargetId(null);
    setInlineEditDraft('');
    // If we were in "replace attachment" mode, discard the picked media so it doesn't leak into new sends.
    if (inlineEditAttachmentMode === 'replace') {
      clearPendingMedia();
    }
    setInlineEditAttachmentMode('keep');
  }, [
    clearPendingMedia,
    inlineEditAttachmentMode,
    inlineEditUploading,
    setInlineEditAttachmentMode,
    setInlineEditDraft,
    setInlineEditTargetId,
  ]);

  const beginInlineEdit = React.useCallback(
    (target: ChatMessage) => {
      if (!target) return;
      if (target.deletedAt) return;
      if ((target.encrypted || target.groupEncrypted) && !target.decryptedText) {
        openInfo('Decrypt first', 'Decrypt this message before editing it');
        return;
      }
      let seed = '';
      if (target.encrypted || target.groupEncrypted) {
        const plain = String(target.decryptedText || '');
        const dmEnv = parseDmMediaEnvelope(plain);
        const gEnv = parseGroupMediaEnvelope(plain);
        // If this is an encrypted media message, edit the caption (not the raw JSON envelope).
        seed = dmEnv ? String(dmEnv.caption || '') : gEnv ? String(gEnv.caption || '') : plain;
      } else {
        const raw = String(target.rawText ?? target.text ?? '');
        // Global media messages store a ChatEnvelope JSON; edit the caption (env.text).
        const env = !isDm ? parseChatEnvelope(raw) : null;
        seed = env ? String(env.text || '') : raw;
      }
      setInlineEditTargetId(target.id);
      setInlineEditDraft(seed);
      closeMessageActions();
    },
    [
      closeMessageActions,
      isDm,
      openInfo,
      parseChatEnvelope,
      parseDmMediaEnvelope,
      parseGroupMediaEnvelope,
      setInlineEditDraft,
      setInlineEditTargetId,
    ],
  );

  const commitInlineEdit = React.useCallback(async () => {
    if (inlineEditUploading) return;
    const targetId = inlineEditTargetId;
    if (!targetId) return;
    const target = messages.find((m) => m.id === targetId);
    if (!target) {
      cancelInlineEdit();
      return;
    }
    if (target.deletedAt) {
      cancelInlineEdit();
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    const nextCaption = inlineEditDraft.trim();

    // Decide whether we can submit an "empty caption" edit.
    // - If the edit results in a media envelope, it's fine (the JSON string is non-empty).
    // - If the edit results in plain text (e.g. removing an attachment), we require non-empty text.
    if (inlineEditAttachmentMode === 'remove' && !nextCaption) {
      openInfo('Add Text', 'Add some text before removing the attachment (or choose Delete)');
      return;
    }

    let outgoingText = nextCaption;
    let dmPlaintextSent: string | null = null;
    let dmMediaSent: ChatMessage['media'] | undefined = undefined;
    let dmMediaListSent: MediaItem[] | undefined = undefined;
    let dmMediaPathsSent: string[] | undefined = undefined;
    let groupPlaintextSent: string | null = null;
    let groupMediaSent: ChatMessage['media'] | undefined = undefined;
    let groupMediaListSent: MediaItem[] | undefined = undefined;
    let groupMediaPathsSent: string[] | undefined = undefined;
    let groupKeyHexSent: string | undefined = undefined;

    const needsDmEncryption = isDm && !!target.encrypted;
    const needsGroupEncryption = isGroup && !!target.groupEncrypted;

    if (needsDmEncryption) {
      if (!myPrivateKey || !peerPublicKey) {
        showAlert('Encryption not ready', 'Missing keys for editing.');
        return;
      }
      // If this is a DM media message:
      // - keep: update caption only
      // - replace: upload new media + create new dm_media_v1 envelope
      // - remove: send plain text (caption only) DM message
      let plaintextToEncrypt = nextCaption;
      const existingPlain = String(target.decryptedText || '');
      const existingDmEnv = parseDmMediaEnvelope(existingPlain);

      if (
        inlineEditAttachmentMode === 'replace' &&
        pendingMediaRef.current &&
        pendingMediaRef.current.length
      ) {
        // Replace attachment by uploading new encrypted media and updating caption.
        setInlineEditUploading(true);
        try {
          const envs: DmMediaEnvelopeV1[] = [];
          for (const item of pendingMediaRef.current) {
            const dmEnv = await uploadPendingMediaDmEncrypted(
              item,
              activeConversationId,
              myPrivateKey,
              peerPublicKey,
              nextCaption,
            );
            envs.push(dmEnv);
          }
          const dmAny: DmMediaEnvelope =
            envs.length === 1
              ? envs[0]
              : {
                  type: 'dm_media_v2',
                  v: 2,
                  caption: nextCaption || undefined,
                  items: envs.map((e) => ({ media: e.media, wrap: e.wrap })),
                };
          plaintextToEncrypt = JSON.stringify(dmAny);
        } finally {
          setInlineEditUploading(false);
        }
      } else if (inlineEditAttachmentMode === 'keep' && existingDmEnv) {
        plaintextToEncrypt = JSON.stringify({
          ...existingDmEnv,
          caption: nextCaption || undefined,
        });
      }

      dmPlaintextSent = plaintextToEncrypt;
      const parsed = parseDmMediaEnvelope(dmPlaintextSent);
      const dmItems = normalizeDmMediaItems(parsed);
      if (dmItems.length) {
        dmMediaListSent = dmItems.map((it) => ({
          path: it.media.path,
          thumbPath: it.media.thumbPath,
          kind: it.media.kind,
          contentType: it.media.contentType,
          thumbContentType: it.media.thumbContentType,
          fileName: it.media.fileName,
          size: it.media.size,
        }));
        dmMediaSent = dmMediaListSent[0];
        dmMediaPathsSent = dmItems
          .flatMap((it) => [it.media.path, it.media.thumbPath].filter(Boolean))
          .map(String);
      }

      const enc = encryptChatMessageV1(plaintextToEncrypt, myPrivateKey, peerPublicKey);
      outgoingText = JSON.stringify(enc);
    } else if (needsGroupEncryption) {
      if (!myPrivateKey || !myUserId) {
        showAlert('Encryption not ready', 'Missing keys for editing.');
        return;
      }
      const activeMemberSubs = groupMembers
        .filter((m) => m && m.status === 'active' && m.memberSub)
        .map((m) => String(m.memberSub))
        .filter(Boolean);
      if (!activeMemberSubs.length) {
        showAlert('Encryption not ready', 'Missing active group members for editing.');
        return;
      }

      // For group edits we mint a new per-message key (same as sending a new message).
      const messageKeyBytes = getRandomBytes(32);
      groupKeyHexSent = bytesToHex(messageKeyBytes);

      // If this is a Group DM media message:
      // - keep: update caption only (preserve existing gdm_media envelope)
      // - replace: upload new group-encrypted media + create new gdm_media_v1/v2 envelope
      // - remove: send plain text (caption only) group message
      let plaintextToEncrypt = nextCaption;
      const existingPlain = String(target.decryptedText || '');
      const existingGEnv = parseGroupMediaEnvelope(existingPlain);

      if (
        inlineEditAttachmentMode === 'replace' &&
        pendingMediaRef.current &&
        pendingMediaRef.current.length
      ) {
        setInlineEditUploading(true);
        try {
          const prepared = await prepareGroupMediaPlaintext({
            conversationId: activeConversationId,
            pendingMedia: pendingMediaRef.current,
            caption: nextCaption,
            messageKeyBytes,
            uploadPendingMediaGroupEncrypted,
          });
          plaintextToEncrypt = prepared.plaintextToEncrypt;
          groupMediaPathsSent = prepared.mediaPathsToSend;
        } finally {
          setInlineEditUploading(false);
        }
      } else if (inlineEditAttachmentMode === 'keep' && existingGEnv) {
        plaintextToEncrypt = JSON.stringify({
          ...existingGEnv,
          caption: nextCaption || undefined,
        });
      }

      groupPlaintextSent = plaintextToEncrypt;
      const parsed = parseGroupMediaEnvelope(groupPlaintextSent);
      const gItems = normalizeGroupMediaItems(parsed);
      if (gItems.length) {
        groupMediaListSent = gItems.map((it) => ({
          path: it.media.path,
          thumbPath: it.media.thumbPath,
          kind: it.media.kind,
          contentType: it.media.contentType,
          thumbContentType: it.media.thumbContentType,
          fileName: it.media.fileName,
          size: it.media.size,
          durationMs: it.media.durationMs,
        }));
        groupMediaSent = groupMediaListSent[0];
        groupMediaPathsSent = gItems
          .flatMap((it) => [it.media.path, it.media.thumbPath].filter(Boolean))
          .map(String);
      }

      outgoingText = encryptGroupOutgoingEncryptedText({
        plaintextToEncrypt,
        messageKeyBytes,
        myPrivateKey,
        myUserId,
        activeMemberSubs,
        groupPublicKeyBySub,
      });
    } else if (!isDm) {
      // Global messages:
      // - keep: if it's a media envelope, preserve media and update caption
      // - replace: upload new media and create a new envelope
      // - remove: send plain text (caption only)
      const raw = String(target.rawText ?? target.text ?? '');
      const env = parseChatEnvelope(raw);

      if (
        inlineEditAttachmentMode === 'replace' &&
        pendingMediaRef.current &&
        pendingMediaRef.current.length
      ) {
        setInlineEditUploading(true);
        try {
          const uploadedItems: MediaItem[] = [];
          for (const item of pendingMediaRef.current) {
            const uploaded = await uploadPendingMedia(item);
            uploadedItems.push(uploaded);
          }
          outgoingText = JSON.stringify({
            type: 'chat',
            text: nextCaption || undefined,
            media: uploadedItems.length === 1 ? uploadedItems[0] : uploadedItems,
          });
        } finally {
          setInlineEditUploading(false);
        }
      } else if (inlineEditAttachmentMode === 'keep' && env?.media) {
        outgoingText = JSON.stringify({
          type: 'chat',
          text: nextCaption || undefined,
          media: env.media,
        });
      }
    }

    try {
      const mediaPathsPayload =
        needsDmEncryption && inlineEditAttachmentMode === 'remove'
          ? { mediaPaths: [] }
          : needsDmEncryption && inlineEditAttachmentMode === 'replace'
            ? { mediaPaths: dmMediaPathsSent || [] }
            : needsGroupEncryption && inlineEditAttachmentMode === 'remove'
              ? { mediaPaths: [] }
              : needsGroupEncryption && inlineEditAttachmentMode === 'replace'
                ? { mediaPaths: groupMediaPathsSent || [] }
                : {};

      wsRef.current.send(
        JSON.stringify({
          action: 'edit',
          conversationId: activeConversationId,
          messageCreatedAt: target.createdAt,
          text: outgoingText,
          ...mediaPathsPayload,
          createdAt: Date.now(),
        }),
      );
      const now = Date.now();
      // Build optimistic local state:
      // - For global media edits, media is derived from the envelope string, so rawText is enough.
      // - For DM media edits, update decryptedText + media so UI renders immediately.
      let optimisticDecryptedText: string | undefined = undefined;
      let optimisticMedia: ChatMessage['media'] | undefined = undefined;
      let optimisticMediaList: ChatMessage['mediaList'] | undefined = undefined;
      let optimisticGroupKeyHex: string | undefined = undefined;
      if (needsDmEncryption) {
        if (inlineEditAttachmentMode === 'remove') {
          optimisticDecryptedText = nextCaption;
          optimisticMedia = undefined;
          optimisticMediaList = undefined;
        } else if (dmPlaintextSent) {
          optimisticDecryptedText = dmPlaintextSent;
          optimisticMedia = dmMediaSent;
          optimisticMediaList = dmMediaListSent;
        } else {
          optimisticDecryptedText = nextCaption;
        }
      } else if (needsGroupEncryption) {
        optimisticGroupKeyHex = groupKeyHexSent;
        if (inlineEditAttachmentMode === 'remove') {
          optimisticDecryptedText = nextCaption;
          optimisticMedia = undefined;
          optimisticMediaList = undefined;
        } else if (groupPlaintextSent) {
          optimisticDecryptedText = groupPlaintextSent;
          optimisticMedia = groupMediaSent;
          optimisticMediaList = groupMediaListSent;
        } else {
          optimisticDecryptedText = nextCaption;
        }
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === targetId
            ? {
                ...m,
                rawText: outgoingText,
                encrypted: needsDmEncryption
                  ? (parseEncrypted(outgoingText) ?? undefined)
                  : m.encrypted,
                groupEncrypted: needsGroupEncryption
                  ? (parseGroupEncrypted(outgoingText) ?? undefined)
                  : m.groupEncrypted,
                decryptedText:
                  needsDmEncryption || needsGroupEncryption
                    ? optimisticDecryptedText
                    : m.decryptedText,
                groupKeyHex: needsGroupEncryption ? optimisticGroupKeyHex : m.groupKeyHex,
                decryptFailed:
                  needsDmEncryption || needsGroupEncryption ? undefined : m.decryptFailed,
                media: needsDmEncryption || needsGroupEncryption ? optimisticMedia : m.media,
                mediaList:
                  needsDmEncryption || needsGroupEncryption ? optimisticMediaList : m.mediaList,
                // Always show the edited caption in the UI (even for envelopes).
                text: nextCaption,
                editedAt: now,
              }
            : m,
        ),
      );
      cancelInlineEdit();
    } catch (e: unknown) {
      showAlert('Edit failed', getErrorMessage(e) || 'Failed to edit message');
    }
  }, [
    activeConversationId,
    cancelInlineEdit,
    encryptChatMessageV1,
    encryptGroupOutgoingEncryptedText,
    getRandomBytes,
    groupMembers,
    groupPublicKeyBySub,
    inlineEditAttachmentMode,
    inlineEditDraft,
    inlineEditTargetId,
    inlineEditUploading,
    isGroup,
    messages,
    myUserId,
    myPrivateKey,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    parseChatEnvelope,
    parseDmMediaEnvelope,
    parseEncrypted,
    parseGroupEncrypted,
    parseGroupMediaEnvelope,
    prepareGroupMediaPlaintext,
    peerPublicKey,
    pendingMediaRef,
    setError,
    setInlineEditUploading,
    setMessages,
    showAlert,
    uploadPendingMedia,
    uploadPendingMediaDmEncrypted,
    uploadPendingMediaGroupEncrypted,
    wsRef,
    isDm,
    openInfo,
  ]);

  return { beginInlineEdit, cancelInlineEdit, commitInlineEdit };
}
