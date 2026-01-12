import { bytesToHex } from '@noble/hashes/utils.js';

import type { EncryptedChatPayloadV1 } from '../../types/crypto';
import { aesGcmEncryptBytes, derivePublicKey, encryptChatMessageV1 } from '../../utils/crypto';
import type { PendingMediaItem } from './attachments';
import type {
  DmMediaEnvelope,
  DmMediaEnvelopeV1,
  EncryptedGroupPayloadV1,
  GroupMediaEnvelope,
  GroupMediaEnvelopeV1,
} from './types';

export async function prepareDmOutgoingEncryptedText(opts: {
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
}): Promise<{ outgoingText: string; mediaPathsToSend?: string[] }> {
  const pending = opts.pendingMedia && opts.pendingMedia.length ? opts.pendingMedia : null;
  if (!pending) return { outgoingText: opts.outgoingText, mediaPathsToSend: undefined };

  const envs: DmMediaEnvelopeV1[] = [];
  for (const item of pending) {
    const dmEnv = await opts.uploadPendingMediaDmEncrypted(
      item,
      opts.conversationId,
      opts.myPrivateKey,
      opts.peerPublicKey,
      opts.caption,
    );
    envs.push(dmEnv);
  }

  const dmAny: DmMediaEnvelope =
    envs.length === 1
      ? envs[0]
      : {
          type: 'dm_media_v2',
          v: 2,
          caption: opts.caption || undefined,
          items: envs.map((e) => ({ media: e.media, wrap: e.wrap })),
        };
  const plaintextEnvelope = JSON.stringify(dmAny);
  const enc = encryptChatMessageV1(plaintextEnvelope, opts.myPrivateKey, opts.peerPublicKey);
  const outgoingText = JSON.stringify(enc);
  const mediaPathsToSend = envs
    .flatMap((e) => [e.media.path, e.media.thumbPath].filter(Boolean))
    .map(String);
  return { outgoingText, mediaPathsToSend };
}

export async function prepareGroupMediaPlaintext(opts: {
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
}): Promise<{ plaintextToEncrypt: string; mediaPathsToSend: string[] }> {
  const pending = opts.pendingMedia && opts.pendingMedia.length ? opts.pendingMedia : null;
  if (!pending) return { plaintextToEncrypt: '', mediaPathsToSend: [] };

  const envs: GroupMediaEnvelopeV1[] = [];
  for (const item of pending) {
    const gEnv = await opts.uploadPendingMediaGroupEncrypted(
      item,
      opts.conversationId,
      opts.messageKeyBytes,
      opts.caption,
    );
    envs.push(gEnv);
  }
  const gAny: GroupMediaEnvelope =
    envs.length === 1
      ? envs[0]
      : {
          type: 'gdm_media_v2',
          v: 2,
          caption: opts.caption || undefined,
          items: envs.map((e) => ({ media: e.media, wrap: e.wrap })),
        };
  const plaintextToEncrypt = JSON.stringify(gAny);
  const mediaPathsToSend = envs
    .flatMap((e) => [e.media.path, e.media.thumbPath].filter(Boolean))
    .map(String);
  return { plaintextToEncrypt, mediaPathsToSend };
}

export function encryptGroupOutgoingEncryptedText(opts: {
  plaintextToEncrypt: string;
  messageKeyBytes: Uint8Array;
  myPrivateKey: string;
  myUserId: string;
  activeMemberSubs: string[];
  groupPublicKeyBySub: Record<string, string | undefined>;
}): string {
  const plainBytes = new TextEncoder().encode(opts.plaintextToEncrypt);
  const msgCipher = aesGcmEncryptBytes(opts.messageKeyBytes, plainBytes);

  // Wrap messageKey for each active member (including me).
  const messageKeyHex = bytesToHex(opts.messageKeyBytes);
  const wraps: Record<string, EncryptedChatPayloadV1> = {};
  for (const sub of opts.activeMemberSubs) {
    const pk =
      sub === opts.myUserId ? derivePublicKey(opts.myPrivateKey) : opts.groupPublicKeyBySub[sub];
    // Product rule is: require keys for all active members; but guard anyway.
    if (!pk) continue;
    wraps[sub] = encryptChatMessageV1(messageKeyHex, opts.myPrivateKey, pk);
  }

  const payload: EncryptedGroupPayloadV1 = {
    type: 'gdm_v1',
    v: 1,
    alg: 'aes-256-gcm+wraps-v1',
    iv: msgCipher.ivHex,
    ciphertext: msgCipher.ciphertextHex,
    wraps,
  };
  return JSON.stringify(payload);
}
