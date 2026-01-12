// Shared upload/attachment helpers and limits for chat.

import { toByteArray } from 'base64-js';

import type { MediaKind } from '../../types/media';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_BYTES = 75 * 1024 * 1024; // 75MB
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB (GIFs/documents)

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

// Thumbnails are preview-only; originals stay untouched.
export const THUMB_MAX_DIM = 720; // px
export const THUMB_JPEG_QUALITY = 0.85;

export function guessContentTypeFromName(name?: string): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  return undefined;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function getAttachmentHardLimitBytes(kind: MediaKind): number {
  return kind === 'image' ? MAX_IMAGE_BYTES : kind === 'video' ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
}

export function assertWithinAttachmentHardLimit(kind: MediaKind, sizeBytes: number): void {
  const limit = getAttachmentHardLimitBytes(kind);
  if (Number.isFinite(sizeBytes) && sizeBytes > limit) {
    throw new Error(
      `File too large (${formatBytes(sizeBytes)}). Limit for ${kind} is ${formatBytes(limit)}.`,
    );
  }
}

type BlobLike = { arrayBuffer?: () => Promise<ArrayBuffer> };
type FetchResponseLike = {
  arrayBuffer?: () => Promise<ArrayBuffer>;
  blob?: () => Promise<BlobLike>;
};

type ExpoFileLike = {
  bytes?: () => Promise<Uint8Array | ArrayBuffer | ArrayBufferView | number[]>;
  base64?: () => Promise<string>;
  write?: (b: Uint8Array) => Promise<void>;
  uri?: string;
};
type ExpoFileSystemLike = {
  Paths?: { cache?: string; document?: string };
  File?: new (a: string, b?: string) => ExpoFileLike;
};

type ExpoImageManipulatorLike = {
  manipulateAsync?: (
    uri: string,
    actions: Array<{ resize?: { width?: number; height?: number } }>,
    opts: { compress: number; format: string },
  ) => Promise<{ uri?: string }>;
  SaveFormat?: { WEBP?: string };
};

type ExpoVideoThumbnailsLike = {
  getThumbnailAsync?: (
    uri: string,
    opts: { time: number; quality: number },
  ) => Promise<{ uri?: string }>;
};

export async function readUriBytes(uri: string): Promise<Uint8Array> {
  // Prefer fetch(...).arrayBuffer() (works for http(s) and often for file://),
  // fallback to FileSystem Base64 read for cases where Blob/arrayBuffer is missing.
  try {
    const resp = await fetch(uri);
    const respLike = resp as FetchResponseLike;
    if (respLike && typeof respLike.arrayBuffer === 'function') {
      return new Uint8Array(await respLike.arrayBuffer());
    }
    if (respLike && typeof respLike.blob === 'function') {
      const b = await respLike.blob();
      const blobLike = b as BlobLike;
      if (blobLike && typeof blobLike.arrayBuffer === 'function') {
        return new Uint8Array(await blobLike.arrayBuffer());
      }
    }
  } catch {
    // fall through
  }

  const fs = require('expo-file-system') as ExpoFileSystemLike;
  if (!fs.File) throw new Error('File API not available');
  const f = new fs.File(uri);
  if (typeof f.bytes === 'function') {
    const bytes = await f.bytes();
    if (bytes instanceof Uint8Array) return bytes;
    if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(bytes)) {
      const v = bytes as ArrayBufferView;
      return new Uint8Array(v.buffer);
    }
    if (Array.isArray(bytes)) return new Uint8Array(bytes);
    throw new Error('File bytes returned an unsupported type');
  }
  if (typeof f.base64 === 'function') {
    const b64 = await f.base64();
    return toByteArray(String(b64));
  }
  throw new Error('File read API not available');
}

export async function createWebpThumbnailBytes(args: {
  kind: MediaKind;
  uri: string;
}): Promise<Uint8Array | null> {
  const { kind, uri } = args;
  if (kind !== 'image' && kind !== 'video') return null;

  try {
    // Dynamic require keeps this module lightweight for non-upload call sites,
    // and avoids eager native module init on platforms that don't support it.
    const ImageManipulator = require('expo-image-manipulator') as ExpoImageManipulatorLike;
    const manipulateAsync = ImageManipulator.manipulateAsync;
    const WEBP = ImageManipulator.SaveFormat?.WEBP;
    if (typeof manipulateAsync !== 'function' || !WEBP) return null;

    let thumbUri: string | null = null;

    if (kind === 'image') {
      const thumb = await manipulateAsync(uri, [{ resize: { width: THUMB_MAX_DIM } }], {
        compress: THUMB_JPEG_QUALITY,
        format: WEBP,
      });
      thumbUri = typeof thumb?.uri === 'string' ? String(thumb.uri) : null;
    } else {
      const VideoThumbnails = require('expo-video-thumbnails') as ExpoVideoThumbnailsLike;
      const getThumbnailAsync = VideoThumbnails.getThumbnailAsync;
      if (typeof getThumbnailAsync !== 'function') return null;
      const t = await getThumbnailAsync(uri, {
        time: 500,
        quality: THUMB_JPEG_QUALITY,
      });
      const src = typeof t?.uri === 'string' ? String(t.uri) : null;
      if (!src) return null;

      const converted = await manipulateAsync(src, [{ resize: { width: THUMB_MAX_DIM } }], {
        compress: THUMB_JPEG_QUALITY,
        format: WEBP,
      });
      thumbUri = typeof converted?.uri === 'string' ? String(converted.uri) : null;
    }

    if (!thumbUri) return null;
    return await readUriBytes(thumbUri);
  } catch {
    return null;
  }
}
