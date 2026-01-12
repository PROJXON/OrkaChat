import * as React from 'react';
import { Image } from 'react-native';

import { defaultFileExtensionForContentType } from '../../utils/mediaKinds';
import type { ChatMessage, DmMediaEnvelopeV1 } from './types';

type ExpoFileLike = {
  write?: (b: Uint8Array) => Promise<void>;
  uri?: string;
};
type ExpoFileSystemLike = {
  Paths?: { cache?: string; document?: string };
  File?: new (a: string, b?: string) => ExpoFileLike;
};

export function useChatMediaDecryptCache(opts: {
  aesGcmDecryptBytes: (key: Uint8Array, iv: string, ciphertext: string) => Uint8Array;
  hexToBytes: (hex: string) => Uint8Array;
  gcm: (key: Uint8Array, iv: Uint8Array) => { decrypt: (ciphertext: Uint8Array) => Uint8Array };
  fromByteArray: (bytes: Uint8Array) => string;
  getDmMediaSignedUrl: (path: string, ttlSec: number) => Promise<string>;
  buildDmMediaKey: (msg: ChatMessage) => Uint8Array;
}): {
  imageAspectByPath: Record<string, number>;
  setImageAspectByPath: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  dmThumbUriByPath: Record<string, string>;
  dmFileUriByPath: Record<string, string>;
  decryptDmThumbToDataUri: (
    msg: ChatMessage,
    it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
  ) => Promise<string | null>;
  decryptDmFileToCacheUri: (
    msg: ChatMessage,
    it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
  ) => Promise<string>;
  decryptGroupThumbToDataUri: (
    msg: ChatMessage,
    it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
  ) => Promise<string | null>;
  decryptGroupFileToCacheUri: (
    msg: ChatMessage,
    it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
  ) => Promise<string>;
} {
  const {
    aesGcmDecryptBytes,
    hexToBytes,
    gcm,
    fromByteArray,
    getDmMediaSignedUrl,
    buildDmMediaKey,
  } = opts;

  const [imageAspectByPath, setImageAspectByPath] = React.useState<Record<string, number>>({});
  const [dmThumbUriByPath, setDmThumbUriByPath] = React.useState<Record<string, string>>({});
  const [dmFileUriByPath, setDmFileUriByPath] = React.useState<Record<string, string>>({});

  const decryptDmThumbToDataUri = React.useCallback(
    async (
      msg: ChatMessage,
      it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
    ): Promise<string | null> => {
      if (!it.media.thumbPath || !it.media.thumbIv) return null;
      const cacheKey = it.media.thumbPath;
      if (dmThumbUriByPath[cacheKey]) return dmThumbUriByPath[cacheKey];

      const chatKey = buildDmMediaKey(msg);
      const fileKey = aesGcmDecryptBytes(chatKey, it.wrap.iv, it.wrap.ciphertext); // 32 bytes

      const signedUrl = await getDmMediaSignedUrl(it.media.thumbPath, 300);
      const encResp = await fetch(signedUrl);
      if (!encResp.ok) {
        const txt = await encResp.text().catch(() => '');
        throw new Error(
          `DM download failed (${encResp.status}): ${txt.slice(0, 160) || 'no body'}`,
        );
      }
      const respCt = String(encResp.headers.get('content-type') || '');
      if (
        respCt.includes('text') ||
        respCt.includes('xml') ||
        respCt.includes('json') ||
        respCt.includes('html')
      ) {
        const txt = await encResp.text().catch(() => '');
        throw new Error(
          `DM download returned ${respCt || 'text'}: ${txt.slice(0, 160) || 'no body'}`,
        );
      }
      const encBytes = new Uint8Array(await encResp.arrayBuffer());
      let plainThumbBytes: Uint8Array;
      try {
        plainThumbBytes = gcm(fileKey, new Uint8Array(hexToBytes(it.media.thumbIv))).decrypt(
          encBytes,
        );
      } catch {
        throw new Error('DM decrypt failed (bad key or corrupted download)');
      }

      const b64 = fromByteArray(plainThumbBytes);
      const ct =
        it.media.thumbContentType ||
        (String(it.media.thumbPath || '').includes('.webp') ? 'image/webp' : 'image/jpeg');
      const dataUri = `data:${ct};base64,${b64}`;
      setDmThumbUriByPath((prev) => ({ ...prev, [cacheKey]: dataUri }));

      // Cache aspect ratio for sizing (DM thumbs are decrypted, so Image.getSize must run on the data URI)
      Image.getSize(
        dataUri,
        (w, h) => {
          const aspect = w > 0 && h > 0 ? w / h : 1;
          setImageAspectByPath((prev) => ({ ...prev, [cacheKey]: aspect }));
        },
        () => {},
      );
      return dataUri;
    },
    [
      aesGcmDecryptBytes,
      buildDmMediaKey,
      dmThumbUriByPath,
      fromByteArray,
      gcm,
      getDmMediaSignedUrl,
      hexToBytes,
    ],
  );

  const decryptDmFileToCacheUri = React.useCallback(
    async (
      msg: ChatMessage,
      it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
    ): Promise<string> => {
      const cacheKey = it.media.path;
      if (dmFileUriByPath[cacheKey]) return dmFileUriByPath[cacheKey];

      const chatKey = buildDmMediaKey(msg);
      const fileKey = aesGcmDecryptBytes(chatKey, it.wrap.iv, it.wrap.ciphertext);

      const signedUrl = await getDmMediaSignedUrl(it.media.path, 300);
      const encResp = await fetch(signedUrl);
      if (!encResp.ok) {
        const txt = await encResp.text().catch(() => '');
        throw new Error(
          `DM download failed (${encResp.status}): ${txt.slice(0, 160) || 'no body'}`,
        );
      }
      const respCt = String(encResp.headers.get('content-type') || '');
      if (
        respCt.includes('text') ||
        respCt.includes('xml') ||
        respCt.includes('json') ||
        respCt.includes('html')
      ) {
        const txt = await encResp.text().catch(() => '');
        throw new Error(
          `DM download returned ${respCt || 'text'}: ${txt.slice(0, 160) || 'no body'}`,
        );
      }
      const encBytes = new Uint8Array(await encResp.arrayBuffer());
      const fileIvBytes = hexToBytes(it.media.iv);
      let plainBytes: Uint8Array;
      try {
        plainBytes = gcm(fileKey, fileIvBytes).decrypt(encBytes);
      } catch {
        throw new Error('DM decrypt failed (bad key or corrupted download)');
      }

      const ct = it.media.contentType || 'application/octet-stream';
      const ext = defaultFileExtensionForContentType(ct);
      const fileNameSafe = (it.media.fileName || `dm-${Date.now()}`).replace(/[^\w.\-() ]+/g, '_');
      const fs = require('expo-file-system') as ExpoFileSystemLike;
      const root = fs.Paths?.cache || fs.Paths?.document;
      if (!root) throw new Error('No writable cache directory');
      if (!fs.File) throw new Error('File API not available');
      const outFile = new fs.File(root, `dm-${fileNameSafe}.${ext}`);
      if (typeof outFile.write !== 'function') throw new Error('File write API not available');
      await outFile.write(plainBytes);

      const uri = typeof outFile.uri === 'string' ? outFile.uri : '';
      if (!uri) throw new Error('File write produced no URI');
      setDmFileUriByPath((prev) => ({ ...prev, [cacheKey]: uri }));
      return uri;
    },
    [aesGcmDecryptBytes, buildDmMediaKey, dmFileUriByPath, gcm, getDmMediaSignedUrl, hexToBytes],
  );

  const buildGroupMediaKey = React.useCallback(
    (msg: ChatMessage): Uint8Array => {
      if (!msg.groupKeyHex) throw new Error('Missing group message key');
      return hexToBytes(String(msg.groupKeyHex));
    },
    [hexToBytes],
  );

  const decryptGroupThumbToDataUri = React.useCallback(
    async (
      msg: ChatMessage,
      it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
    ): Promise<string | null> => {
      if (!it.media.thumbPath || !it.media.thumbIv) return null;
      const cacheKey = it.media.thumbPath;
      if (dmThumbUriByPath[cacheKey]) return dmThumbUriByPath[cacheKey];

      const messageKey = buildGroupMediaKey(msg);
      const fileKey = aesGcmDecryptBytes(messageKey, it.wrap.iv, it.wrap.ciphertext); // 32 bytes

      const signedUrl = await getDmMediaSignedUrl(it.media.thumbPath, 300);
      const encResp = await fetch(signedUrl);
      if (!encResp.ok) {
        const txt = await encResp.text().catch(() => '');
        throw new Error(
          `Group download failed (${encResp.status}): ${txt.slice(0, 160) || 'no body'}`,
        );
      }
      const respCt = String(encResp.headers.get('content-type') || '');
      if (
        respCt.includes('text') ||
        respCt.includes('xml') ||
        respCt.includes('json') ||
        respCt.includes('html')
      ) {
        const txt = await encResp.text().catch(() => '');
        throw new Error(
          `Group download returned ${respCt || 'text'}: ${txt.slice(0, 160) || 'no body'}`,
        );
      }
      const encBytes = new Uint8Array(await encResp.arrayBuffer());
      let plainThumbBytes: Uint8Array;
      try {
        plainThumbBytes = gcm(fileKey, new Uint8Array(hexToBytes(it.media.thumbIv))).decrypt(
          encBytes,
        );
      } catch {
        throw new Error('Group decrypt failed (bad key or corrupted download)');
      }

      const b64 = fromByteArray(plainThumbBytes);
      const ct =
        it.media.thumbContentType ||
        (String(it.media.thumbPath || '').includes('.webp') ? 'image/webp' : 'image/jpeg');
      const dataUri = `data:${ct};base64,${b64}`;
      setDmThumbUriByPath((prev) => ({ ...prev, [cacheKey]: dataUri }));

      Image.getSize(
        dataUri,
        (w, h) => {
          const aspect = w > 0 && h > 0 ? w / h : 1;
          setImageAspectByPath((prev) => ({ ...prev, [cacheKey]: aspect }));
        },
        () => {},
      );
      return dataUri;
    },
    [
      aesGcmDecryptBytes,
      buildGroupMediaKey,
      dmThumbUriByPath,
      fromByteArray,
      gcm,
      getDmMediaSignedUrl,
      hexToBytes,
    ],
  );

  const decryptGroupFileToCacheUri = React.useCallback(
    async (
      msg: ChatMessage,
      it: { media: DmMediaEnvelopeV1['media']; wrap: DmMediaEnvelopeV1['wrap'] },
    ): Promise<string> => {
      const cacheKey = it.media.path;
      if (dmFileUriByPath[cacheKey]) return dmFileUriByPath[cacheKey];

      const messageKey = buildGroupMediaKey(msg);
      const fileKey = aesGcmDecryptBytes(messageKey, it.wrap.iv, it.wrap.ciphertext);

      const signedUrl = await getDmMediaSignedUrl(it.media.path, 300);
      const encResp = await fetch(signedUrl);
      if (!encResp.ok) {
        const txt = await encResp.text().catch(() => '');
        throw new Error(
          `Group download failed (${encResp.status}): ${txt.slice(0, 160) || 'no body'}`,
        );
      }
      const respCt = String(encResp.headers.get('content-type') || '');
      if (
        respCt.includes('text') ||
        respCt.includes('xml') ||
        respCt.includes('json') ||
        respCt.includes('html')
      ) {
        const txt = await encResp.text().catch(() => '');
        throw new Error(
          `Group download returned ${respCt || 'text'}: ${txt.slice(0, 160) || 'no body'}`,
        );
      }
      const encBytes = new Uint8Array(await encResp.arrayBuffer());
      const fileIvBytes = hexToBytes(it.media.iv);
      let plainBytes: Uint8Array;
      try {
        plainBytes = gcm(fileKey, fileIvBytes).decrypt(encBytes);
      } catch {
        throw new Error('Group decrypt failed (bad key or corrupted download)');
      }

      const ct = it.media.contentType || 'application/octet-stream';
      const ext = defaultFileExtensionForContentType(ct);
      const fileNameSafe = (it.media.fileName || `gdm-${Date.now()}`).replace(/[^\w.\-() ]+/g, '_');
      const fs = require('expo-file-system') as ExpoFileSystemLike;
      const root = fs.Paths?.cache || fs.Paths?.document;
      if (!root) throw new Error('No writable cache directory');
      if (!fs.File) throw new Error('File API not available');
      const outFile = new fs.File(root, `gdm-${fileNameSafe}.${ext}`);
      if (typeof outFile.write !== 'function') throw new Error('File write API not available');
      await outFile.write(plainBytes);

      const uri = typeof outFile.uri === 'string' ? outFile.uri : '';
      if (!uri) throw new Error('File write produced no URI');
      setDmFileUriByPath((prev) => ({ ...prev, [cacheKey]: uri }));
      return uri;
    },
    [aesGcmDecryptBytes, buildGroupMediaKey, dmFileUriByPath, gcm, getDmMediaSignedUrl, hexToBytes],
  );

  return React.useMemo(
    () => ({
      imageAspectByPath,
      setImageAspectByPath,
      dmThumbUriByPath,
      dmFileUriByPath,
      decryptDmThumbToDataUri,
      decryptDmFileToCacheUri,
      decryptGroupThumbToDataUri,
      decryptGroupFileToCacheUri,
    }),
    [
      decryptDmFileToCacheUri,
      decryptDmThumbToDataUri,
      decryptGroupFileToCacheUri,
      decryptGroupThumbToDataUri,
      dmFileUriByPath,
      dmThumbUriByPath,
      imageAspectByPath,
      setImageAspectByPath,
    ],
  );
}
