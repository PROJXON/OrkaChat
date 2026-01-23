import * as React from 'react';

import type { MediaItem } from '../../types/media';
import { parseEncryptedTextEnvelope } from './parsers';
import type { ChatMessage, DmMediaEnvelope, DmMediaEnvelopeV1, GroupMediaEnvelope } from './types';

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

type GroupDecryptResult = {
  plaintext?: string;
  messageKeyHex?: string;
};

type DmMediaItem = { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] };
type GroupMediaItem = { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] };

export function useChatPressToDecrypt(opts: {
  isDm: boolean;
  isGroup: boolean;
  encryptedPlaceholder: string;
  myUserId: string | null | undefined;
  myPublicKey: string | null | undefined;

  decryptForDisplay: (msg: ChatMessage) => string;
  decryptGroupForDisplay: (msg: ChatMessage) => GroupDecryptResult | null;

  parseDmMediaEnvelope: (raw: string) => DmMediaEnvelope | null;
  parseGroupMediaEnvelope: (raw: string) => GroupMediaEnvelope | null;
  normalizeDmMediaItems: (env: DmMediaEnvelope | null) => DmMediaItem[];
  normalizeGroupMediaItems: (env: GroupMediaEnvelope | null) => GroupMediaItem[];

  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendReadReceipt: (messageCreatedAtMs: number) => void;
  markMySeen: (messageCreatedAtMs: number, readAtSec: number) => void;
  openInfo: (title: string, body: string) => void;
}) {
  const {
    isDm,
    isGroup,
    encryptedPlaceholder: _encryptedPlaceholder,
    myUserId,
    myPublicKey,
    decryptForDisplay,
    decryptGroupForDisplay,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    setMessages,
    sendReadReceipt,
    markMySeen,
    openInfo,
  } = opts;

  return React.useCallback(
    (msg: ChatMessage) => {
      if (msg.deletedAt) return;
      if (!msg.encrypted && !msg.groupEncrypted) return;
      try {
        const readAt = Math.floor(Date.now() / 1000);
        const groupDec = msg.groupEncrypted ? decryptGroupForDisplay(msg) : null;
        const plaintext = groupDec ? String(groupDec.plaintext || '') : decryptForDisplay(msg);
        const encEnv = parseEncryptedTextEnvelope(String(plaintext || ''));

        const dmEnv = isDm && !groupDec ? parseDmMediaEnvelope(plaintext) : null;
        const dmItems = dmEnv ? normalizeDmMediaItems(dmEnv) : [];
        const gEnv = isGroup && groupDec ? parseGroupMediaEnvelope(plaintext) : null;
        const gItems = gEnv ? normalizeGroupMediaItems(gEnv) : [];

        const mediaItems = dmEnv ? dmItems : gEnv ? gItems : [];
        const mediaList: MediaItem[] = mediaItems.map((it) => ({
          path: it.media.path,
          thumbPath: it.media.thumbPath,
          kind: it.media.kind,
          contentType: it.media.contentType,
          thumbContentType: it.media.thumbContentType,
          fileName: it.media.fileName,
          size: it.media.size,
        }));

        const isFromMe = groupDec
          ? !!myUserId && !!msg.userSub && String(msg.userSub) === String(myUserId)
          : !!myPublicKey && msg.encrypted?.senderPublicKey === myPublicKey;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  decryptedText: plaintext,
                  groupKeyHex: groupDec ? String(groupDec.messageKeyHex || '') : m.groupKeyHex,
                  text: encEnv
                    ? String(encEnv.text || '')
                    : dmEnv
                      ? (dmEnv.caption ?? '')
                      : gEnv
                        ? (gEnv.caption ?? '')
                        : plaintext,
                  replyToCreatedAt:
                    encEnv?.replyToCreatedAt ?? dmEnv?.replyToCreatedAt ?? gEnv?.replyToCreatedAt,
                  replyToMessageId:
                    encEnv?.replyToMessageId ?? dmEnv?.replyToMessageId ?? gEnv?.replyToMessageId,
                  replyToUserSub:
                    encEnv?.replyToUserSub ?? dmEnv?.replyToUserSub ?? gEnv?.replyToUserSub,
                  replyToPreview:
                    encEnv?.replyToPreview ?? dmEnv?.replyToPreview ?? gEnv?.replyToPreview,
                  replyToMediaKind:
                    encEnv?.replyToMediaKind ?? dmEnv?.replyToMediaKind ?? gEnv?.replyToMediaKind,
                  replyToMediaCount:
                    encEnv?.replyToMediaCount ??
                    dmEnv?.replyToMediaCount ??
                    gEnv?.replyToMediaCount,
                  replyToMediaContentType:
                    encEnv?.replyToMediaContentType ??
                    dmEnv?.replyToMediaContentType ??
                    gEnv?.replyToMediaContentType,
                  replyToMediaFileName:
                    encEnv?.replyToMediaFileName ??
                    dmEnv?.replyToMediaFileName ??
                    gEnv?.replyToMediaFileName,
                  media: mediaList.length ? mediaList[0] : m.media,
                  mediaList: mediaList.length ? mediaList : undefined,
                  expiresAt:
                    // TTL-from-read:
                    // - Incoming messages: start countdown at decrypt time.
                    // - Outgoing messages: do NOT start countdown when you decrypt your own message;
                    //   only start when the peer decrypts (via read receipt).
                    !isFromMe && isDm && m.ttlSeconds && m.ttlSeconds > 0
                      ? (m.expiresAt ?? readAt + m.ttlSeconds)
                      : m.expiresAt,
                }
              : m,
          ),
        );
        if (!isFromMe && isDm) sendReadReceipt(msg.createdAt);
        if (!isFromMe) markMySeen(msg.createdAt, readAt);
      } catch (e: unknown) {
        const rawMsg = getErrorMessage(e);
        const lower = rawMsg.toLowerCase();
        const hint =
          lower.includes('ghash') || lower.includes('tag') || lower.includes('aes')
            ? "This message can't be decrypted on this device. It may have been encrypted with a different key, or the message is corrupted."
            : "This message can't be decrypted right now. Please try again later.";
        openInfo("Couldn't Decrypt Message", hint);
      }
    },
    [
      decryptForDisplay,
      decryptGroupForDisplay,
      isDm,
      isGroup,
      markMySeen,
      myPublicKey,
      myUserId,
      normalizeDmMediaItems,
      normalizeGroupMediaItems,
      openInfo,
      parseDmMediaEnvelope,
      parseGroupMediaEnvelope,
      sendReadReceipt,
      setMessages,
    ],
  );
}
