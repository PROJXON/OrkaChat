// frontend/src/utils/__tests__/crypto.test.ts

// Mock native-ish dependencies so importing ../crypto is safe in Jest.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

// Make randomness deterministic (AES-GCM IVs, salts, etc.).
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) =>
    new Uint8Array(Array.from({ length: n }, (_v, i) => (i + 1) & 0xff)),
}));

import { bytesToHex } from '@noble/hashes/utils.js';

import {
  aesGcmDecryptBytes,
  aesGcmEncryptBytes,
  decryptChatMessageV1,
  deriveChatKeyBytesV1,
  derivePublicKey,
  encryptChatMessageV1,
} from '../crypto';

describe('crypto (utils)', () => {
  beforeAll(() => {
    // Ensure TextEncoder/TextDecoder exist in the Jest runtime.
    const g = globalThis as any;
    if (!g.TextEncoder || !g.TextDecoder) {
      const u = require('util');
      g.TextEncoder = u.TextEncoder;
      g.TextDecoder = u.TextDecoder;
    }
  });

  it('derivePublicKey returns a valid uncompressed secp256k1 public key hex (65 bytes => 130 hex chars)', () => {
    const priv = '1'.padStart(64, '0'); // 0x01
    const pub = derivePublicKey(priv);

    expect(typeof pub).toBe('string');
    expect(pub.length).toBe(130); // 65 bytes, hex-encoded
    expect(pub.startsWith('04')).toBe(true); // uncompressed key prefix
  });

  it('deriveChatKeyBytesV1 is symmetric (ECDH): A(priv)+B(pub) == B(priv)+A(pub)', () => {
    const privA = '1'.padStart(64, '0');
    const privB = '2'.padStart(64, '0');
    const pubA = derivePublicKey(privA);
    const pubB = derivePublicKey(privB);

    const keyAB = deriveChatKeyBytesV1(privA, pubB);
    const keyBA = deriveChatKeyBytesV1(privB, pubA);

    expect(keyAB).toBeInstanceOf(Uint8Array);
    expect(keyAB.length).toBe(32); // AES-256 key bytes
    expect(bytesToHex(keyAB)).toBe(bytesToHex(keyBA));
  });

  it('aesGcmEncryptBytes + aesGcmDecryptBytes round-trip plaintext with deterministic IV', () => {
    const key = new Uint8Array(32).fill(7);
    const plaintext = new TextEncoder().encode('hello world');

    const enc = aesGcmEncryptBytes(key, plaintext);
    const out = aesGcmDecryptBytes(key, enc.ivHex, enc.ciphertextHex);

    expect(new TextDecoder().decode(out)).toBe('hello world');
    expect(enc.ivHex.length).toBe(24); // 12 bytes IV => 24 hex chars
    expect(enc.ciphertextHex.length).toBeGreaterThan(0); // ciphertext + authTag
  });

  it('encryptChatMessageV1 + decryptChatMessageV1 round-trip and embed correct metadata', () => {
    const senderPriv = '1'.padStart(64, '0');
    const recipientPriv = '2'.padStart(64, '0');
    const recipientPub = derivePublicKey(recipientPriv);

    const payload = encryptChatMessageV1('secret message', senderPriv, recipientPub);

    expect(payload.v).toBe(1);
    expect(payload.alg).toBe('secp256k1-ecdh+aes-256-gcm');
    expect(payload.iv.length).toBe(24); // 12-byte iv hex
    expect(payload.ciphertext.length).toBeGreaterThan(0);
    expect(payload.senderPublicKey).toBe(derivePublicKey(senderPriv));

    const decrypted = decryptChatMessageV1(payload, recipientPriv);
    expect(decrypted).toBe('secret message');
  });

  it('decryptChatMessageV1 fails with the wrong recipient key (auth/tag mismatch)', () => {
    const senderPriv = '1'.padStart(64, '0');
    const recipientPriv = '2'.padStart(64, '0');
    const wrongRecipientPriv = '3'.padStart(64, '0');
    const recipientPub = derivePublicKey(recipientPriv);

    const payload = encryptChatMessageV1('secret message', senderPriv, recipientPub);

    expect(() => decryptChatMessageV1(payload, wrongRecipientPriv)).toThrow();
  });
});
