// Shared upload/attachment helpers and limits for chat.

import { toByteArray } from 'base64-js';
import { Platform } from 'react-native';

import type { MediaKind } from '../../types/media';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_BYTES = 75 * 1024 * 1024; // 75MB
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB (GIFs/documents)
export const MAX_AUDIO_BYTES = 75 * 1024 * 1024; // 75MB (audio attachments)

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

function isAudioContentType(contentType?: string): boolean {
  const ct = String(contentType || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
  return !!ct && ct.startsWith('audio/');
}

export function getAttachmentHardLimitBytesForContentType(
  kind: MediaKind,
  contentType?: string,
): number {
  if (kind !== 'image' && kind !== 'video' && isAudioContentType(contentType))
    return MAX_AUDIO_BYTES;
  return getAttachmentHardLimitBytes(kind);
}

export function assertWithinAttachmentHardLimit(
  kind: MediaKind,
  sizeBytes: number,
  contentType?: string,
): void {
  const limit = getAttachmentHardLimitBytesForContentType(kind, contentType);
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
    // Web: expo-video-thumbnails is not available. For videos, extract a frame via <video> + <canvas>.
    if (Platform.OS === 'web' && kind === 'video') {
      const doc: any = (globalThis as any)?.document;
      if (!doc || typeof doc.createElement !== 'function') return null;

      const video: any = doc.createElement('video');
      const canvas: any = doc.createElement('canvas');
      const ctx: any = canvas?.getContext?.('2d');
      if (!video || !canvas || !ctx) return null;

      // Try to avoid autoplay restrictions; we only need a decoded frame.
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      // Blob/object URLs are same-origin; for completeness allow anonymous.
      video.crossOrigin = 'anonymous';

      const cleanup = () => {
        try {
          video.pause?.();
        } catch {
          // ignore
        }
        try {
          video.src = '';
          video.load?.();
        } catch {
          // ignore
        }
      };

      const bytes = await new Promise<Uint8Array | null>((resolve) => {
        let done = false;
        const finish = (v: Uint8Array | null) => {
          if (done) return;
          done = true;
          cleanup();
          resolve(v);
        };

        const timeout = setTimeout(() => finish(null), 5000);
        const clear = () => {
          try {
            clearTimeout(timeout);
          } catch {
            // ignore
          }
        };

        const capture = async () => {
          try {
            // Ensure we have dimensions.
            const vw = Number(video.videoWidth || 0);
            const vh = Number(video.videoHeight || 0);
            if (!(vw > 0) || !(vh > 0)) return finish(null);

            const scale = THUMB_MAX_DIM / Math.max(vw, vh);
            const tw = Math.max(1, Math.floor(vw * Math.min(1, scale)));
            const th = Math.max(1, Math.floor(vh * Math.min(1, scale)));
            canvas.width = tw;
            canvas.height = th;
            ctx.drawImage(video, 0, 0, tw, th);

            canvas.toBlob(
              async (blob: any) => {
                try {
                  if (!blob || typeof blob.arrayBuffer !== 'function') return finish(null);
                  const ab = await blob.arrayBuffer();
                  return finish(new Uint8Array(ab));
                } catch {
                  return finish(null);
                }
              },
              'image/webp',
              THUMB_JPEG_QUALITY,
            );
          } catch {
            finish(null);
          }
        };

        video.onerror = () => {
          clear();
          finish(null);
        };

        // `loadeddata` means the first frame is available.
        video.onloadeddata = () => {
          clear();
          void capture();
        };

        try {
          video.src = uri;
          // Some browsers require an explicit load() call.
          video.load?.();
        } catch {
          clear();
          finish(null);
        }
      });

      return bytes;
    }

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
