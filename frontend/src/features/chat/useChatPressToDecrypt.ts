import * as React from 'react';

import type { MediaItem } from '../../types/media';
import type { ChatMessage } from './types';

export function useChatPressToDecrypt(opts: {
  isDm: boolean;
  isGroup: boolean;
  encryptedPlaceholder: string;
  myUserId: string | null | undefined;
  myPublicKey: string | null | undefined;

  decryptForDisplay: (msg: ChatMessage) => string;
  decryptGroupForDisplay: (msg: ChatMessage) => any;

  parseDmMediaEnvelope: (raw: string) => any;
  parseGroupMediaEnvelope: (raw: string) => any;
  normalizeDmMediaItems: (env: any) => Array<{ media: any; wrap: any }>;
  normalizeGroupMediaItems: (env: any) => Array<{ media: any; wrap: any }>;

  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendReadReceipt: (messageCreatedAtMs: number) => void;
  markMySeen: (messageCreatedAtMs: number, readAtSec: number) => void;
  openInfo: (title: string, body: string) => void;
}) {
  const {
    isDm,
    isGroup,
    encryptedPlaceholder,
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

        const dmEnv = isDm && !groupDec ? parseDmMediaEnvelope(plaintext) : null;
        const dmItems = dmEnv ? normalizeDmMediaItems(dmEnv) : [];
        const gEnv = isGroup && groupDec ? parseGroupMediaEnvelope(plaintext) : null;
        const gItems = gEnv ? normalizeGroupMediaItems(gEnv) : [];

        const mediaList: MediaItem[] = (dmEnv ? dmItems : gEnv ? gItems : []).map((it) => ({
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
                  text: dmEnv ? (dmEnv.caption ?? '') : gEnv ? (gEnv.caption ?? '') : plaintext,
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
      } catch (e: any) {
        const rawMsg = typeof e?.message === 'string' ? e.message : '';
        const lower = rawMsg.toLowerCase();
        const hint =
          lower.includes('ghash') || lower.includes('tag') || lower.includes('aes')
            ? "This message can't be decrypted on this device. It may have been encrypted with a different key, or the message is corrupted."
            : "This message can't be decrypted right now. Please try again later.";
        openInfo("Couldn't decrypt message", hint);
      }
    },
    [
      decryptForDisplay,
      decryptGroupForDisplay,
      encryptedPlaceholder, // keep dependency parity even though only used via closure paths
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

