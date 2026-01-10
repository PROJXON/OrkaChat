import * as React from 'react';
import type { ChatMessage, EncryptedGroupPayloadV1 } from './types';
import type { EncryptedChatPayloadV1 } from '../../types/crypto';

export function useChatDecryptors(opts: {
  myPrivateKey: string | null | undefined;
  myPublicKey: string | null | undefined;
  peerPublicKey: string | null | undefined;
  myUserId: string | null | undefined;
  decryptChatMessageV1: (payload: any, myPriv: string, theirPub?: string) => string;
  aesGcmDecryptBytes: (key: Uint8Array, iv: string, ciphertext: string) => Uint8Array;
  deriveChatKeyBytesV1: (myPriv: string, theirPub: string) => Uint8Array;
  hexToBytes: (hex: string) => Uint8Array;
}): {
  parseEncrypted: (text: string) => EncryptedChatPayloadV1 | null;
  parseGroupEncrypted: (text: string) => EncryptedGroupPayloadV1 | null;
  decryptGroupForDisplay: (msg: ChatMessage) => { plaintext: string; messageKeyHex: string };
  decryptForDisplay: (msg: ChatMessage) => string;
  buildDmMediaKey: (msg: ChatMessage) => Uint8Array;
} {
  const { myPrivateKey, myPublicKey, peerPublicKey, myUserId, decryptChatMessageV1, aesGcmDecryptBytes, deriveChatKeyBytesV1, hexToBytes } =
    opts;

  const parseEncrypted = React.useCallback((text: string): EncryptedChatPayloadV1 | null => {
    try {
      let obj: any = JSON.parse(text);
      // Some backends/clients may double-encode payload.text as a JSON-string containing JSON.
      if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj);
        } catch {
          // leave as-is
        }
      }
      if (
        obj &&
        obj.v === 1 &&
        obj.alg === 'secp256k1-ecdh+aes-256-gcm' &&
        typeof obj.iv === 'string' &&
        typeof obj.ciphertext === 'string' &&
        typeof obj.senderPublicKey === 'string' &&
        (typeof obj.recipientPublicKey === 'undefined' || typeof obj.recipientPublicKey === 'string')
      ) {
        return obj as EncryptedChatPayloadV1;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const parseGroupEncrypted = React.useCallback((text: string): EncryptedGroupPayloadV1 | null => {
    try {
      let obj: any = JSON.parse(text);
      // Some backends/clients may double-encode payload.text as a JSON-string containing JSON.
      if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj);
        } catch {
          // leave as-is
        }
      }
      if (
        obj &&
        obj.type === 'gdm_v1' &&
        obj.v === 1 &&
        obj.alg === 'aes-256-gcm+wraps-v1' &&
        typeof obj.iv === 'string' &&
        typeof obj.ciphertext === 'string' &&
        obj.wraps &&
        typeof obj.wraps === 'object'
      ) {
        return obj as EncryptedGroupPayloadV1;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const decryptGroupForDisplay = React.useCallback(
    (msg: ChatMessage): { plaintext: string; messageKeyHex: string } => {
      if (!msg.groupEncrypted) throw new Error('Not group-encrypted');
      if (!myPrivateKey) throw new Error('Missing your private key on this device.');
      if (!myUserId) throw new Error('Missing your user id.');
      const wraps = msg.groupEncrypted.wraps || {};
      const wrap = wraps[myUserId];
      if (!wrap) throw new Error("Can't decrypt (message not encrypted for you).");
      const messageKeyHex = decryptChatMessageV1(wrap, myPrivateKey);
      const keyBytes = hexToBytes(messageKeyHex);
      const plainBytes = aesGcmDecryptBytes(keyBytes, msg.groupEncrypted.iv, msg.groupEncrypted.ciphertext);
      return { plaintext: new TextDecoder().decode(plainBytes), messageKeyHex };
    },
    [aesGcmDecryptBytes, decryptChatMessageV1, hexToBytes, myPrivateKey, myUserId],
  );

  const decryptForDisplay = React.useCallback(
    (msg: ChatMessage): string => {
      if (!msg.encrypted) throw new Error('Not encrypted');
      if (!myPrivateKey) throw new Error('Missing your private key on this device.');

      const isFromMe = !!myPublicKey && msg.encrypted.senderPublicKey === myPublicKey;
      const primaryTheirPub = isFromMe ? (msg.encrypted.recipientPublicKey ?? peerPublicKey) : msg.encrypted.senderPublicKey;

      try {
        if (!primaryTheirPub) throw new Error("Can't decrypt (missing peer key).");
        return decryptChatMessageV1(msg.encrypted, myPrivateKey, primaryTheirPub);
      } catch (e) {
        if (peerPublicKey && peerPublicKey !== primaryTheirPub) {
          return decryptChatMessageV1(msg.encrypted, myPrivateKey, peerPublicKey);
        }
        throw e;
      }
    },
    [decryptChatMessageV1, myPrivateKey, myPublicKey, peerPublicKey],
  );

  const buildDmMediaKey = React.useCallback(
    (msg: ChatMessage): Uint8Array => {
      if (!msg.encrypted) throw new Error('Not encrypted');
      if (!myPrivateKey) throw new Error('Missing your private key on this device.');
      const isFromMe = !!myPublicKey && msg.encrypted.senderPublicKey === myPublicKey;
      const theirPub = isFromMe ? (msg.encrypted.recipientPublicKey ?? peerPublicKey) : msg.encrypted.senderPublicKey;
      if (!theirPub) throw new Error("Can't derive DM media key (missing peer key).");
      return deriveChatKeyBytesV1(myPrivateKey, theirPub);
    },
    [deriveChatKeyBytesV1, myPrivateKey, myPublicKey, peerPublicKey],
  );

  return React.useMemo(
    () => ({ parseEncrypted, parseGroupEncrypted, decryptGroupForDisplay, decryptForDisplay, buildDmMediaKey }),
    [buildDmMediaKey, decryptForDisplay, decryptGroupForDisplay, parseEncrypted, parseGroupEncrypted],
  );
}

