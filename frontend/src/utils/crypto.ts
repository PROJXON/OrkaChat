import { gcm } from '@noble/ciphers/aes.js';
import { secp256k1 } from '@noble/curves/secp256k1';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform, TurboModuleRegistry } from 'react-native';

import type { BackupBlob, EncryptedChatPayloadV1, KeyPair } from '../types/crypto';
export type { BackupBlob, EncryptedChatPayloadV1, KeyPair } from '../types/crypto';

// Legacy keys (kept for compatibility / reference).
const _PRIVATE_KEY_STORAGE_KEY = '@private_key';
const _PUBLIC_KEY_STORAGE_KEY = '@public_key';

export const generateKeypair = async (): Promise<KeyPair> => {
  try {
    console.log('Generating new cryptography keypair...');
    const privateKeyBytes = getRandomBytes(32);
    let attempts = 0;
    let validPrivatekey = privateKeyBytes;

    while (attempts < 10) {
      try {
        const publicKeyPoint = secp256k1.getPublicKey(validPrivatekey, false);

        return {
          privateKey: bytesToHex(validPrivatekey),
          publicKey: bytesToHex(publicKeyPoint),
        };
      } catch {
        validPrivatekey = getRandomBytes(32);
        attempts++;
      }
    }
    throw new Error('Failed to generate valid keypair after 10 attempts');
  } catch (error) {
    console.error('Error generating keypair:', error);
    throw new Error('Failed to generate keypair');
  }
};

export const storeKeyPair = async (userId: string, keypair: KeyPair) => {
  try {
    const keyData = JSON.stringify(keypair);
    const storageKey = `crypto_keys_${userId}`;
    // SecureStore is not reliably supported on web. Use AsyncStorage (localStorage-backed) instead.
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(storageKey, keyData);
    } else {
      await SecureStore.setItemAsync(storageKey, keyData);
    }
    console.log(`Keys stored for ${userId}`);
  } catch (error) {
    console.error('Error storing keys:', error);
    throw new Error('Failed to store keys');
  }
};

export const loadKeyPair = async (userId: string): Promise<KeyPair | null> => {
  try {
    const storageKey = `crypto_keys_${userId}`;
    // SecureStore is not reliably supported on web. Use AsyncStorage (localStorage-backed) instead.
    const keyData =
      Platform.OS === 'web'
        ? await AsyncStorage.getItem(storageKey)
        : await SecureStore.getItemAsync(storageKey);
    if (!keyData) return null;
    return JSON.parse(keyData);
  } catch (error) {
    console.error('Error loading keys:', error);
    return null;
  }
};

export const derivePublicKey = (privateKeyHex: string): string => {
  const privateKeyBytes = hexToBytes(privateKeyHex);
  const publicKeyPoint = secp256k1.getPublicKey(privateKeyBytes, false);
  return bytesToHex(publicKeyPoint);
};

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DKLEN_BYTES = 32;

let _loggedPbkdf2Impl = false;
const logPbkdf2ImplOnce = (msg: string) => {
  if (!_loggedPbkdf2Impl && __DEV__) {
    _loggedPbkdf2Impl = true;
    console.log(msg);
  }
};

let _loggedPbkdf2NativeSkip = false;
const logPbkdf2NativeSkipOnce = (msg: string) => {
  if (!_loggedPbkdf2NativeSkip && __DEV__) {
    _loggedPbkdf2NativeSkip = true;
    console.log(msg);
  }
};

const deriveBackupKeyViaWebCrypto = async (
  passphraseBytes: Uint8Array,
  salt: Uint8Array,
): Promise<Uint8Array | null> => {
  try {
    // Avoid TS lib mismatches between RN and DOM crypto types by treating subtle as opaque.
    const subtle = (globalThis as unknown as { crypto?: { subtle?: any } }).crypto?.subtle;
    if (!subtle) return null;
    const baseKey = await subtle.importKey(
      'raw',
      passphraseBytes as unknown as BufferSource,
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    );
    const bits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: PBKDF2_ITERATIONS,
        salt: salt as unknown as BufferSource,
      },
      baseKey,
      PBKDF2_DKLEN_BYTES * 8,
    );
    const out = new Uint8Array(bits);
    if (out.length !== PBKDF2_DKLEN_BYTES) return null;
    return out;
  } catch {
    return null;
  }
};

const deriveBackupKeyViaNativeCrypto = (
  passphraseBytes: Uint8Array,
  salt: Uint8Array,
): Uint8Array | null => {
  // Native fast-path. We keep this `require` inside the function so web bundlers
  // don't try to include the native module.
  try {
    // Expo Go does not include custom native modules (like NitroModules/QuickCrypto).
    // If we're running inside Expo Go, skip the native fast-path to avoid runtime errors.
    try {
      const Constants = require('expo-constants') as unknown;
      const c =
        Constants &&
        typeof Constants === 'object' &&
        'default' in (Constants as Record<string, unknown>)
          ? (Constants as { default: unknown }).default
          : Constants;
      const appOwnership =
        c && typeof c === 'object' && 'appOwnership' in (c as Record<string, unknown>)
          ? (c as { appOwnership: unknown }).appOwnership
          : undefined;
      if (appOwnership === 'expo') {
        logPbkdf2NativeSkipOnce('recovery PBKDF2: native QuickCrypto skipped (running in Expo Go)');
        return null;
      }
    } catch {
      // ignore and attempt native crypto
    }

    // If the NitroModules TurboModule isn't present in this binary (e.g. old dev build),
    // do NOT attempt to import quick-crypto; importing it will throw loudly.
    try {
      const nitro =
        typeof (TurboModuleRegistry as unknown as { get?: (name: string) => unknown })?.get ===
        'function'
          ? (TurboModuleRegistry as unknown as { get: (name: string) => unknown }).get(
              'NitroModules',
            )
          : null;
      if (!nitro) {
        logPbkdf2NativeSkipOnce(
          'recovery PBKDF2: native QuickCrypto skipped (NitroModules missing; rebuild dev client)',
        );
        return null;
      }
    } catch {
      logPbkdf2NativeSkipOnce(
        'recovery PBKDF2: native QuickCrypto skipped (NitroModules check failed; rebuild dev client)',
      );
      return null;
    }

    const rnqc = require('react-native-quick-crypto') as unknown;
    const crypto =
      rnqc && typeof rnqc === 'object' && 'default' in (rnqc as Record<string, unknown>)
        ? (rnqc as { default: unknown }).default
        : rnqc;
    const pbkdf2Sync =
      crypto && typeof crypto === 'object' && 'pbkdf2Sync' in (crypto as Record<string, unknown>)
        ? (crypto as { pbkdf2Sync: unknown }).pbkdf2Sync
        : null;
    if (typeof pbkdf2Sync !== 'function') {
      logPbkdf2NativeSkipOnce(
        'recovery PBKDF2: native QuickCrypto skipped (pbkdf2Sync not available; rebuild dev client)',
      );
      return null;
    }

    // pbkdf2Sync(password, salt, iterations, keylen, digest) -> Buffer
    const buf = (pbkdf2Sync as Function)(
      passphraseBytes,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_DKLEN_BYTES,
      'sha256',
    );
    if (!buf) return null;
    // Buffer is a Uint8Array subclass; normalize to Uint8Array.
    const out = new Uint8Array(buf);
    if (out.length !== PBKDF2_DKLEN_BYTES) return null;
    return out;
  } catch {
    logPbkdf2NativeSkipOnce(
      'recovery PBKDF2: native QuickCrypto skipped (import/call failed; rebuild dev client)',
    );
    return null;
  }
};

const deriveBackupKey = async (passphrase: string, salt: Uint8Array): Promise<Uint8Array> => {
  const passphraseBytes = new TextEncoder().encode(passphrase);

  // Web: use WebCrypto PBKDF2 (fast, non-JS).
  if (Platform.OS === 'web') {
    const t0 = __DEV__ ? Date.now() : 0;
    const k = await deriveBackupKeyViaWebCrypto(passphraseBytes, salt);
    if (k) {
      logPbkdf2ImplOnce(
        `recovery PBKDF2: WebCrypto (SHA-256, c=${PBKDF2_ITERATIONS}, dkLen=${PBKDF2_DKLEN_BYTES})` +
          (__DEV__ ? ` in ${Date.now() - t0}ms` : ''),
      );
      return k;
    }
  }

  // Native: use optimized PBKDF2 (fast, non-JS).
  if (Platform.OS !== 'web') {
    const t0 = __DEV__ ? Date.now() : 0;
    const k = deriveBackupKeyViaNativeCrypto(passphraseBytes, salt);
    if (k) {
      logPbkdf2ImplOnce(
        `recovery PBKDF2: native QuickCrypto (SHA-256, c=${PBKDF2_ITERATIONS}, dkLen=${PBKDF2_DKLEN_BYTES})` +
          (__DEV__ ? ` in ${Date.now() - t0}ms` : ''),
      );
      return k;
    }
  }

  // Guaranteed fallback: pure JS implementation (slower, but always available).
  const t0 = __DEV__ ? Date.now() : 0;
  const out = pbkdf2(sha256, passphraseBytes, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: PBKDF2_DKLEN_BYTES,
  });
  logPbkdf2ImplOnce(
    `recovery PBKDF2: JS noble fallback (SHA-256, c=${PBKDF2_ITERATIONS}, dkLen=${PBKDF2_DKLEN_BYTES})` +
      (__DEV__ ? ` in ${Date.now() - t0}ms` : ''),
  );
  return out;
};

export const encryptPrivateKey = async (
  privateKeyHex: string,
  passphrase: string,
): Promise<BackupBlob> => {
  const salt = getRandomBytes(16);
  const key = await deriveBackupKey(passphrase, salt);
  const iv = getRandomBytes(12);
  const cipher = gcm(key, iv);
  const encrypted = cipher.encrypt(hexToBytes(privateKeyHex));
  const ciphertext = encrypted.slice(0, -16);
  const authTag = encrypted.slice(-16);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);
  return {
    ciphertext: bytesToHex(combined),
    iv: bytesToHex(iv),
    salt: bytesToHex(salt),
  };
};

export const decryptPrivateKey = async (blob: BackupBlob, passphrase: string): Promise<string> => {
  const salt = hexToBytes(blob.salt);
  const iv = hexToBytes(blob.iv);
  const combined = hexToBytes(blob.ciphertext);
  const key = await deriveBackupKey(passphrase, salt);
  const cipher = gcm(key, iv);
  const decrypted = cipher.decrypt(combined);
  return bytesToHex(decrypted);
};

const deriveChatKey = (myPrivateKeyHex: string, theirPublicKeyHex: string): Uint8Array => {
  const priv = hexToBytes(myPrivateKeyHex);
  const pub = hexToBytes(theirPublicKeyHex);
  // 65 bytes uncompressed when isCompressed=false
  const shared = secp256k1.getSharedSecret(priv, pub, false);
  // Use X coordinate (32 bytes) then hash to get 32-byte AES key
  const x = shared.slice(1, 33);
  return sha256(x);
};

export const deriveChatKeyBytesV1 = (
  myPrivateKeyHex: string,
  theirPublicKeyHex: string,
): Uint8Array => {
  return deriveChatKey(myPrivateKeyHex, theirPublicKeyHex);
};

export const aesGcmEncryptBytes = (key: Uint8Array, plaintext: Uint8Array) => {
  const iv = getRandomBytes(12);
  const cipher = gcm(key, iv);
  const encrypted = cipher.encrypt(plaintext); // ciphertext + authTag
  return { ivHex: bytesToHex(iv), ciphertextHex: bytesToHex(encrypted) };
};

export const aesGcmDecryptBytes = (key: Uint8Array, ivHex: string, ciphertextHex: string) => {
  const iv = hexToBytes(ivHex);
  const combined = hexToBytes(ciphertextHex);
  const cipher = gcm(key, iv);
  return cipher.decrypt(combined);
};

export const encryptChatMessageV1 = (
  plaintext: string,
  senderPrivateKeyHex: string,
  recipientPublicKeyHex: string,
): EncryptedChatPayloadV1 => {
  const key = deriveChatKey(senderPrivateKeyHex, recipientPublicKeyHex);
  const iv = getRandomBytes(12);
  const cipher = gcm(key, iv);
  const messageBytes = new TextEncoder().encode(plaintext);
  const encrypted = cipher.encrypt(messageBytes); // includes authTag at end
  const senderPublicKey = bytesToHex(
    secp256k1.getPublicKey(hexToBytes(senderPrivateKeyHex), false),
  );
  return {
    v: 1,
    alg: 'secp256k1-ecdh+aes-256-gcm',
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(encrypted),
    senderPublicKey,
    recipientPublicKey: recipientPublicKeyHex,
  };
};

export const decryptChatMessageV1 = (
  payload: EncryptedChatPayloadV1,
  recipientPrivateKeyHex: string,
  senderPublicKeyHexOverride?: string,
): string => {
  const theirPub = senderPublicKeyHexOverride ?? payload.senderPublicKey;
  const key = deriveChatKey(recipientPrivateKeyHex, theirPub);
  const iv = hexToBytes(payload.iv);
  const combined = hexToBytes(payload.ciphertext);
  const cipher = gcm(key, iv);
  const decrypted = cipher.decrypt(combined);
  return new TextDecoder().decode(decrypted);
};
