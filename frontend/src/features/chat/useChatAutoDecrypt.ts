import * as React from 'react';
import type { MediaItem } from '../../types/media';
import type { ChatMessage, DmMediaEnvelope, DmMediaEnvelopeV1, GroupMediaEnvelope } from './types';

type DmMediaItem = { media: DmMediaEnvelopeV1['media'] };
type GroupMediaItem = { media: DmMediaEnvelopeV1['media'] };

export function useChatAutoDecrypt(opts: {
  autoDecrypt: boolean;
  myPrivateKey: string | null | undefined;
  myUserId: string | null | undefined;
  myPublicKey: string | null | undefined;
  peerPublicKey: string | null | undefined;
  isDm: boolean;
  isGroup: boolean;
  messages: ChatMessage[];
  setMessages: (next: ChatMessage[]) => void;
  decryptForDisplay: (m: ChatMessage) => string;
  decryptGroupForDisplay: (m: ChatMessage) => { plaintext: string; messageKeyHex: string } | null;
  parseDmMediaEnvelope: (plaintext: string) => DmMediaEnvelope | null;
  parseGroupMediaEnvelope: (plaintext: string) => GroupMediaEnvelope | null;
  normalizeDmMediaItems: (env: DmMediaEnvelope | null) => DmMediaItem[];
  normalizeGroupMediaItems: (env: GroupMediaEnvelope | null) => GroupMediaItem[];
  markMySeen: (messageCreatedAt: number, readAt: number) => void;
  sendReadReceipt: (messageCreatedAt: number) => void;
}): void {
  const {
    autoDecrypt,
    myPrivateKey,
    myUserId,
    myPublicKey,
    peerPublicKey,
    isDm,
    isGroup,
    messages,
    setMessages,
    decryptForDisplay,
    decryptGroupForDisplay,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    markMySeen,
    sendReadReceipt,
  } = opts;

  // Auto-decrypt pass: whenever enabled and keys are ready, decrypt any encrypted messages once.
  React.useEffect(() => {
    if (!autoDecrypt || !myPrivateKey) return;
    const needsDecrypt = messages.some((m) => (m.encrypted || m.groupEncrypted) && !m.decryptedText && !m.decryptFailed);
    if (!needsDecrypt) return;

    const decryptedIncomingCreatedAts: number[] = [];
    const readAt = Math.floor(Date.now() / 1000);
    let changed = false;

    const nextMessages = messages.map((m) => {
      if ((!m.encrypted && !m.groupEncrypted) || m.decryptedText || m.decryptFailed) return m;
      const isFromMe = !!myUserId && !!m.userSub ? String(m.userSub) === String(myUserId) : false;
      if (m.encrypted) {
        const isFromMeByKey = !!myPublicKey && m.encrypted.senderPublicKey === myPublicKey;
        if (isFromMeByKey && !peerPublicKey) return m; // wait for peer key for sent DMs
      }
      try {
        const groupDec = m.groupEncrypted ? decryptGroupForDisplay(m) : null;
        const plaintext = groupDec ? groupDec.plaintext : decryptForDisplay(m);
        changed = true;
        const dmEnv = isDm ? parseDmMediaEnvelope(plaintext) : null;
        const gEnv = isGroup ? parseGroupMediaEnvelope(plaintext) : null;
        const dmItems = dmEnv ? normalizeDmMediaItems(dmEnv) : [];
        const gItems = gEnv ? normalizeGroupMediaItems(gEnv) : [];
        const items = isDm ? dmItems : gItems;
        const mediaList: MediaItem[] = items.map((it) => ({
          path: it.media.path,
          thumbPath: it.media.thumbPath,
          kind: it.media.kind,
          contentType: it.media.contentType,
          thumbContentType: it.media.thumbContentType,
          fileName: it.media.fileName,
          size: it.media.size,
        }));
        if (!isFromMe) {
          decryptedIncomingCreatedAts.push(m.createdAt);
          const expiresAt = m.ttlSeconds && m.ttlSeconds > 0 ? readAt + m.ttlSeconds : m.expiresAt;
          markMySeen(m.createdAt, readAt);
          return {
            ...m,
            decryptedText: plaintext,
            groupKeyHex: groupDec ? groupDec.messageKeyHex : m.groupKeyHex,
            text: dmEnv ? (dmEnv.caption ?? '') : gEnv ? (gEnv.caption ?? '') : plaintext,
            media: mediaList.length ? mediaList[0] : m.media,
            mediaList: mediaList.length ? mediaList : undefined,
            expiresAt,
          };
        }
        markMySeen(m.createdAt, readAt);
        return {
          ...m,
          decryptedText: plaintext,
          groupKeyHex: groupDec ? groupDec.messageKeyHex : m.groupKeyHex,
          text: dmEnv ? (dmEnv.caption ?? '') : gEnv ? (gEnv.caption ?? '') : plaintext,
          media: mediaList.length ? mediaList[0] : m.media,
          mediaList: mediaList.length ? mediaList : undefined,
        };
      } catch {
        changed = true;
        return { ...m, decryptFailed: true };
      }
    });

    if (changed) {
      setMessages(nextMessages);
      // Send per-message read receipts for messages we actually decrypted.
      decryptedIncomingCreatedAts.sort((a, b) => a - b);
      for (const mc of decryptedIncomingCreatedAts) {
        sendReadReceipt(mc);
      }
    }
  }, [
    autoDecrypt,
    myPrivateKey,
    decryptForDisplay,
    myPublicKey,
    sendReadReceipt,
    markMySeen,
    messages,
    peerPublicKey,
    isDm,
    isGroup,
    decryptGroupForDisplay,
    myUserId,
    normalizeDmMediaItems,
    normalizeGroupMediaItems,
    parseDmMediaEnvelope,
    parseGroupMediaEnvelope,
    setMessages,
  ]);
}

