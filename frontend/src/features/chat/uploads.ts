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
    throw new Error(`File too large (${formatBytes(sizeBytes)}). Limit for ${kind} is ${formatBytes(limit)}.`);
  }
}

export async function readUriBytes(uri: string): Promise<Uint8Array> {
  // Prefer fetch(...).arrayBuffer() (works for http(s) and often for file://),
  // fallback to FileSystem Base64 read for cases where Blob/arrayBuffer is missing.
  try {
    const resp: any = await fetch(uri);
    if (resp && typeof resp.arrayBuffer === 'function') {
      return new Uint8Array(await resp.arrayBuffer());
    }
    if (resp && typeof resp.blob === 'function') {
      const b: any = await resp.blob();
      if (b && typeof b.arrayBuffer === 'function') {
        return new Uint8Array(await b.arrayBuffer());
      }
    }
  } catch {
    // fall through
  }

  const fsAny: any = require('expo-file-system');
  const File = fsAny?.File;
  if (!File) throw new Error('File API not available');
  const f: any = new File(uri);
  if (typeof f?.bytes === 'function') {
    const bytes = await f.bytes();
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  }
  if (typeof f?.base64 === 'function') {
    const b64 = await f.base64();
    return toByteArray(String(b64 || ''));
  }
  throw new Error('File read API not available');
}

export async function createWebpThumbnailBytes(args: { kind: MediaKind; uri: string }): Promise<Uint8Array | null> {
  const { kind, uri } = args;
  if (kind !== 'image' && kind !== 'video') return null;

  try {
    // Dynamic require keeps this module lightweight for non-upload call sites,
    // and avoids eager native module init on platforms that don't support it.
    const ImageManipulator: any = require('expo-image-manipulator');

    let thumbUri: string | null = null;

    if (kind === 'image') {
      const thumb = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: THUMB_MAX_DIM } }], {
        compress: THUMB_JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.WEBP,
      });
      thumbUri = thumb?.uri ? String(thumb.uri) : null;
    } else {
      const VideoThumbnails: any = require('expo-video-thumbnails');
      const t = await VideoThumbnails.getThumbnailAsync(uri, {
        time: 500,
        quality: THUMB_JPEG_QUALITY,
      });
      const src = t?.uri ? String(t.uri) : null;
      if (!src) return null;

      const converted = await ImageManipulator.manipulateAsync(src, [{ resize: { width: THUMB_MAX_DIM } }], {
        compress: THUMB_JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.WEBP,
      });
      thumbUri = converted?.uri ? String(converted.uri) : null;
    }

    if (!thumbUri) return null;
    return await readUriBytes(thumbUri);
  } catch {
    return null;
  }
}
