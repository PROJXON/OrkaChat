import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { uploadData } from 'aws-amplify/storage';
import { getRandomBytes } from 'expo-crypto';

import type { MediaItem, MediaKind } from '../../types/media';
import { aesGcmEncryptBytes, deriveChatKeyBytesV1 } from '../../utils/crypto';
import type { DmMediaEnvelopeV1, GroupMediaEnvelopeV1 } from './types';
import { assertWithinAttachmentHardLimit, createWebpThumbnailBytes, readUriBytes } from './uploads';

export type PendingUploadMedia = {
  uri: string;
  kind: MediaKind;
  contentType?: string;
  fileName?: string;
  size?: number;
};

export async function uploadChannelMediaPlain(args: {
  media: PendingUploadMedia;
  activeConversationId: string;
}): Promise<MediaItem> {
  const { media, activeConversationId } = args;

  const declaredSize = typeof media.size === 'number' ? media.size : undefined;
  if (declaredSize) assertWithinAttachmentHardLimit(media.kind, declaredSize);

  const bytes = await readUriBytes(media.uri);
  assertWithinAttachmentHardLimit(media.kind, bytes.byteLength);

  const safeName =
    (media.fileName || `${media.kind}-${Date.now()}`).replace(/[^\w.\-() ]+/g, '_').slice(0, 120) ||
    `file-${Date.now()}`;

  // NOTE: current Amplify Storage auth policies (from amplify_outputs.json) allow `uploads/*`.
  // Keep uploads under that prefix so authenticated users can PUT.
  const baseKey = `${Date.now()}-${safeName}`;

  // IMPORTANT:
  // Never include the conversationId prefix (e.g. "ch#") in S3 keys.
  // A raw '#' in a path will be treated as a URL fragment and break CDN/media URLs.
  const conv = String(activeConversationId || 'global').trim() || 'global';
  const channelId = conv.startsWith('ch#') ? conv.slice('ch#'.length) : conv;
  const safeChannelId = channelId.replace(/[^\w.\-]+/g, '_') || 'global';

  const path = `uploads/channels/${safeChannelId}/${baseKey}`;
  const thumbPath = `uploads/channels/${safeChannelId}/thumbs/${baseKey}.webp`;

  await uploadData({
    path,
    data: bytes,
    options: {
      contentType: media.contentType,
    },
  }).result;

  // Upload a separate thumbnail for fast list rendering (original stays full quality).
  let uploadedThumbPath: string | undefined;
  let uploadedThumbContentType: string | undefined;
  const thumbBytes = await createWebpThumbnailBytes({ kind: media.kind, uri: media.uri });
  if (thumbBytes) {
    try {
      await uploadData({
        path: thumbPath,
        data: thumbBytes,
        options: { contentType: 'image/webp' },
      }).result;
      uploadedThumbPath = thumbPath;
      uploadedThumbContentType = 'image/webp';
    } catch {
      // ignore thumb failures; fall back to original
    }
  }

  return {
    path,
    ...(uploadedThumbPath ? { thumbPath: uploadedThumbPath } : {}),
    kind: media.kind,
    contentType: media.contentType,
    ...(uploadedThumbContentType ? { thumbContentType: uploadedThumbContentType } : {}),
    fileName: media.fileName,
    size: media.size,
  };
}

export async function uploadDmMediaEncrypted(args: {
  media: PendingUploadMedia;
  conversationKey: string;
  senderPrivateKeyHex: string;
  recipientPublicKeyHex: string;
  inputText: string;
  captionOverride?: string;
}): Promise<DmMediaEnvelopeV1> {
  const {
    media,
    conversationKey,
    senderPrivateKeyHex,
    recipientPublicKeyHex,
    inputText,
    captionOverride,
  } = args;

  const declaredSize = typeof media.size === 'number' ? media.size : undefined;
  if (declaredSize) assertWithinAttachmentHardLimit(media.kind, declaredSize);

  // 1) Read original bytes (avoid Blob.arrayBuffer on Android)
  const plainBytes = await readUriBytes(media.uri);
  assertWithinAttachmentHardLimit(media.kind, plainBytes.byteLength);

  // 2) Generate per-attachment key and encrypt bytes
  const fileKey = new Uint8Array(getRandomBytes(32));
  const fileIv = new Uint8Array(getRandomBytes(12));
  const fileCipher = gcm(fileKey, fileIv).encrypt(plainBytes);

  // 3) Upload encrypted blob
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Keep DM object keys opaque (do not embed filenames).
  const path = `uploads/dm/${conversationKey}/${uploadId}.enc`;
  // NOTE: avoid Blob construction on RN (can throw). uploadData supports Uint8Array directly.
  await uploadData({ path, data: fileCipher, options: { contentType: 'application/octet-stream' } })
    .result;

  // 4) Create + encrypt thumbnail (also E2EE)
  let thumbPath: string | undefined;
  let thumbIvHex: string | undefined;
  let thumbContentType: string | undefined;
  const tBytes = await createWebpThumbnailBytes({ kind: media.kind, uri: media.uri });
  if (tBytes) {
    try {
      const tIv = new Uint8Array(getRandomBytes(12));
      const tCipher = gcm(fileKey, tIv).encrypt(tBytes);
      thumbPath = `uploads/dm/${conversationKey}/thumbs/${uploadId}.webp.enc`;
      await uploadData({
        path: thumbPath,
        data: tCipher,
        options: { contentType: 'application/octet-stream' },
      }).result;
      thumbIvHex = bytesToHex(tIv);
      thumbContentType = 'image/webp';
    } catch {
      // ignore thumb failures
    }
  }

  // 5) Wrap fileKey with conversation ECDH key
  const chatKey = deriveChatKeyBytesV1(senderPrivateKeyHex, recipientPublicKeyHex);
  const wrap = aesGcmEncryptBytes(chatKey, fileKey);

  return {
    type: 'dm_media_v1',
    v: 1,
    caption:
      (typeof captionOverride === 'string' ? captionOverride.trim() : inputText.trim()) ||
      undefined,
    media: {
      kind: media.kind,
      contentType: media.contentType,
      fileName: media.fileName,
      size: media.size,
      path,
      iv: bytesToHex(fileIv),
      ...(thumbPath ? { thumbPath } : {}),
      ...(thumbIvHex ? { thumbIv: thumbIvHex } : {}),
      ...(thumbContentType ? { thumbContentType } : {}),
    },
    wrap: {
      iv: wrap.ivHex,
      ciphertext: wrap.ciphertextHex,
    },
  };
}

export async function uploadGroupMediaEncrypted(args: {
  media: PendingUploadMedia;
  conversationKey: string;
  messageKeyBytes: Uint8Array;
  inputText: string;
  captionOverride?: string;
}): Promise<GroupMediaEnvelopeV1> {
  const { media, conversationKey, messageKeyBytes, inputText, captionOverride } = args;

  const declaredSize = typeof media.size === 'number' ? media.size : undefined;
  if (declaredSize) assertWithinAttachmentHardLimit(media.kind, declaredSize);

  const plainBytes = await readUriBytes(media.uri);
  assertWithinAttachmentHardLimit(media.kind, plainBytes.byteLength);

  const fileKey = new Uint8Array(getRandomBytes(32));
  const fileIv = new Uint8Array(getRandomBytes(12));
  const fileCipher = gcm(fileKey, fileIv).encrypt(plainBytes);

  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // NOTE: this intentionally reuses the `uploads/dm/...` prefix (existing behavior).
  const path = `uploads/dm/${conversationKey}/${uploadId}.enc`;
  await uploadData({ path, data: fileCipher, options: { contentType: 'application/octet-stream' } })
    .result;

  // Encrypted thumbnail with same fileKey (Signal-style)
  let thumbPath: string | undefined;
  let thumbIvHex: string | undefined;
  let thumbContentType: string | undefined;
  const tBytes = await createWebpThumbnailBytes({ kind: media.kind, uri: media.uri });
  if (tBytes) {
    try {
      const tIv = new Uint8Array(getRandomBytes(12));
      const tCipher = gcm(fileKey, tIv).encrypt(tBytes);
      thumbPath = `uploads/dm/${conversationKey}/thumbs/${uploadId}.webp.enc`;
      await uploadData({
        path: thumbPath,
        data: tCipher,
        options: { contentType: 'application/octet-stream' },
      }).result;
      thumbIvHex = bytesToHex(tIv);
      thumbContentType = 'image/webp';
    } catch {
      // ignore thumb failures
    }
  }

  // Wrap fileKey with messageKey (NOT ECDH)
  const wrap = aesGcmEncryptBytes(messageKeyBytes, fileKey);

  return {
    type: 'gdm_media_v1',
    v: 1,
    caption:
      (typeof captionOverride === 'string' ? captionOverride.trim() : inputText.trim()) ||
      undefined,
    media: {
      kind: media.kind,
      contentType: media.contentType,
      fileName: media.fileName,
      size: media.size,
      path,
      iv: bytesToHex(fileIv),
      ...(thumbPath ? { thumbPath } : {}),
      ...(thumbIvHex ? { thumbIv: thumbIvHex } : {}),
      ...(thumbContentType ? { thumbContentType } : {}),
    },
    wrap: { iv: wrap.ivHex, ciphertext: wrap.ciphertextHex },
  };
}
