// frontend/src/features/chat/__tests__/useChatDecryptors.test.ts

import { render } from '@testing-library/react-native';
import * as React from 'react';

import { useChatDecryptors } from '../useChatDecryptors';

function setup(): ReturnType<typeof useChatDecryptors> {
  let api!: ReturnType<typeof useChatDecryptors>;

  function Test() {
    api = useChatDecryptors({
      myPrivateKey: 'myPriv',
      myPublicKey: 'myPub',
      peerPublicKey: 'peerPub',
      myUserId: 'me',
      decryptChatMessageV1: () => 'ignored',
      aesGcmDecryptBytes: () => new Uint8Array(),
      deriveChatKeyBytesV1: () => new Uint8Array(32),
      hexToBytes: () => new Uint8Array(),
    });
    return null;
  }

  render(<Test />);
  if (!api) throw new Error('Hook did not initialize');
  return api;
}

describe('useChatDecryptors (parsing)', () => {
  it('parseEncrypted returns object for valid v1 payload JSON', () => {
    const { parseEncrypted } = setup();
    const input = JSON.stringify({
      v: 1,
      alg: 'secp256k1-ecdh+aes-256-gcm',
      iv: 'iv',
      ciphertext: 'ct',
      senderPublicKey: 'pk',
    });

    expect(parseEncrypted(input)).toEqual({
      v: 1,
      alg: 'secp256k1-ecdh+aes-256-gcm',
      iv: 'iv',
      ciphertext: 'ct',
      senderPublicKey: 'pk',
      recipientPublicKey: undefined,
    });
  });

  it('parseEncrypted handles double-encoded JSON (JSON string containing JSON)', () => {
    const { parseEncrypted } = setup();
    const inner = JSON.stringify({
      v: 1,
      alg: 'secp256k1-ecdh+aes-256-gcm',
      iv: 'iv',
      ciphertext: 'ct',
      senderPublicKey: 'pk',
    });

    const double = JSON.stringify(inner); // <- now it's a JSON string containing JSON

    expect(parseEncrypted(double)?.v).toBe(1);
    expect(parseEncrypted(double)?.alg).toBe('secp256k1-ecdh+aes-256-gcm');
  });

  it('parseEncrypted returns null for invalid shapes', () => {
    const { parseEncrypted } = setup();
    expect(parseEncrypted('not json')).toBeNull();
    expect(parseEncrypted(JSON.stringify({}))).toBeNull();
    expect(parseEncrypted(JSON.stringify({ v: 2 }))).toBeNull();
  });

  it('parseGroupEncrypted returns object for valid group payload', () => {
    const { parseGroupEncrypted } = setup();
    const input = JSON.stringify({
      type: 'gdm_v1',
      v: 1,
      alg: 'aes-256-gcm+wraps-v1',
      iv: 'iv',
      ciphertext: 'ct',
      wraps: {
        me: {
          v: 1,
          alg: 'secp256k1-ecdh+aes-256-gcm',
          iv: 'i',
          ciphertext: 'c',
          senderPublicKey: 'p',
        },
      },
    });

    const out = parseGroupEncrypted(input);
    expect(out?.type).toBe('gdm_v1');
    expect(out?.v).toBe(1);
    expect(out?.wraps).toBeTruthy();
  });
});
