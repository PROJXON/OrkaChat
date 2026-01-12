import type { MediaKind } from '../../types/media';
import type { PendingUploadMedia } from './uploadMedia';
import { guessContentTypeFromName } from './uploads';
import { inferKindFromContentType } from '../../utils/mediaKinds';

export type PendingMediaItem = PendingUploadMedia & {
  // Friendly label for UI (e.g. "From camera") without affecting uploads.
  displayName?: string;
  source?: 'camera' | 'library' | 'file';
};

export function pendingMediaFromImagePickerAssets(assets: unknown[]): PendingMediaItem[] {
  const arr = Array.isArray(assets) ? assets : [];
  return arr
    .map((a): PendingMediaItem | null => {
      const rec = typeof a === 'object' && a != null ? (a as Record<string, unknown>) : {};
      const uri = typeof rec.uri === 'string' ? rec.uri : '';
      if (!uri) return null;
      const type = typeof rec.type === 'string' ? rec.type : String(rec.type ?? '');
      const kind: MediaKind = type === 'video' ? 'video' : type === 'image' ? 'image' : 'file';
      const fileName = typeof rec.fileName === 'string' ? rec.fileName : undefined;
      const size = typeof rec.fileSize === 'number' ? rec.fileSize : undefined;
      const mimeType = typeof rec.mimeType === 'string' ? rec.mimeType : undefined;
      const contentType = mimeType ?? guessContentTypeFromName(fileName);
      return {
        uri,
        kind,
        contentType,
        fileName,
        displayName: fileName,
        source: 'library' as const,
        size: typeof size === 'number' ? size : undefined,
      } satisfies PendingMediaItem;
    })
    .filter((it): it is PendingMediaItem => !!it);
}

export function pendingMediaFromDocumentPickerAssets(assets: unknown[]): PendingMediaItem[] {
  const arr = Array.isArray(assets) ? assets : [];
  return arr
    .map((a): PendingMediaItem | null => {
      const rec = typeof a === 'object' && a != null ? (a as Record<string, unknown>) : {};
      const uri = typeof rec.uri === 'string' ? rec.uri : '';
      if (!uri) return null;
      const fileName = typeof rec.name === 'string' ? rec.name : undefined;
      const mimeType = typeof rec.mimeType === 'string' ? rec.mimeType : undefined;
      const contentType = mimeType ?? guessContentTypeFromName(fileName);
      return {
        uri,
        kind: inferKindFromContentType(contentType),
        contentType,
        fileName,
        displayName: fileName,
        source: 'file' as const,
        size: typeof rec.size === 'number' ? rec.size : undefined,
      } satisfies PendingMediaItem;
    })
    .filter((it): it is PendingMediaItem => !!it);
}

export function pendingMediaFromInAppCameraCapture(cap: { uri: string; mode: 'photo' | 'video' }): PendingMediaItem {
  const kind: MediaKind = cap.mode === 'video' ? 'video' : 'image';
  // Camera URIs can contain extremely long auto-generated filenames.
  // Use a short, stable filename for uploads, and a friendly UI label.
  const fileName = cap.mode === 'video' ? `camera-${Date.now()}.mp4` : `camera-${Date.now()}.jpg`;
  return {
    uri: cap.uri,
    kind,
    contentType: guessContentTypeFromName(fileName) ?? (cap.mode === 'video' ? 'video/mp4' : 'image/jpeg'),
    fileName,
    displayName: 'From Camera',
    source: 'camera',
    size: undefined,
  };
}
