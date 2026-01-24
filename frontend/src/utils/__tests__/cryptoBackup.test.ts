// frontend/src/utils/__tests__/cryptoBackup.test.ts

// These mocks make importing ../crypto safe in Jest (no native storage deps).
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

// Deterministic salt/iv so encryption output is stable for tests.
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) =>
    new Uint8Array(Array.from({ length: n }, (_v, i) => (i + 1) & 0xff)),
}));

import { decryptPrivateKey, encryptPrivateKey } from '../crypto';

function flipLastHexChar(hex: string): string {
  const last = hex[hex.length - 1];
  const flipped = last === '0' ? '1' : '0';
  return hex.slice(0, -1) + flipped;
}

describe('crypto backup (encryptPrivateKey/decryptPrivateKey)', () => {
  it('round-trips a private key hex with the correct passphrase', async () => {
    const privHex = 'ab'.repeat(32); // 32 bytes => 64 hex chars
    const blob = await encryptPrivateKey(privHex, 'pw');
    const out = await decryptPrivateKey(blob, 'pw');

    expect(out).toBe(privHex);

    // Format/length invariants (these are really useful in interviews):
    expect(blob.salt.length).toBe(32); // 16 bytes salt => 32 hex chars
    expect(blob.iv.length).toBe(24); // 12 bytes iv => 24 hex chars
    expect(blob.ciphertext.length).toBeGreaterThan(0);
  });

  it('fails with wrong passphrase', async () => {
    const privHex = 'ab'.repeat(32);
    const blob = await encryptPrivateKey(privHex, 'pw');

    await expect(decryptPrivateKey(blob, 'wrong')).rejects.toThrow();
  });

  it('fails if ciphertext is tampered (auth tag mismatch)', async () => {
    const privHex = 'ab'.repeat(32);
    const blob = await encryptPrivateKey(privHex, 'pw');

    await expect(
      decryptPrivateKey({ ...blob, ciphertext: flipLastHexChar(blob.ciphertext) }, 'pw'),
    ).rejects.toThrow();
  });
});
