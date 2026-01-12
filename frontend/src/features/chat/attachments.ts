import type { MediaKind } from '../../types/media';
import { inferKindFromContentType } from '../../utils/mediaKinds';
import type { PendingUploadMedia } from './uploadMedia';
import { guessContentTypeFromName } from './uploads';

export type PendingMediaItem = PendingUploadMedia & {
  // Friendly label for UI (e.g. "From camera") without affecting uploads.
  displayName?: string;
  source?: 'camera' | 'library' | 'file';
};

export type ImagePickerAssetLike = {
  uri: string;
  type?: 'image' | 'video' | string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
};

export type DocumentPickerAssetLike = {
  uri: string;
  name?: string | null;
  size?: number | null;
  mimeType?: string | null;
};

export function pendingMediaFromImagePickerAssets(
  assets: ReadonlyArray<ImagePickerAssetLike>,
): PendingMediaItem[] {
  const arr = Array.isArray(assets) ? assets : [];
  return arr
    .map((a): PendingMediaItem | null => {
      const uri = typeof a?.uri === 'string' ? a.uri : '';
      if (!uri) return null;
      const type = typeof a?.type === 'string' ? a.type : String(a?.type ?? '');
      const kind: MediaKind = type === 'video' ? 'video' : type === 'image' ? 'image' : 'file';
      const fileName = typeof a?.fileName === 'string' ? a.fileName : undefined;
      const size = typeof a?.fileSize === 'number' ? a.fileSize : undefined;
      const mimeType = typeof a?.mimeType === 'string' ? a.mimeType : undefined;
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

export function pendingMediaFromDocumentPickerAssets(
  assets: ReadonlyArray<DocumentPickerAssetLike>,
): PendingMediaItem[] {
  const arr = Array.isArray(assets) ? assets : [];
  return arr
    .map((a): PendingMediaItem | null => {
      const uri = typeof a?.uri === 'string' ? a.uri : '';
      if (!uri) return null;
      const fileName = typeof a?.name === 'string' ? a.name : undefined;
      const mimeType = typeof a?.mimeType === 'string' ? a.mimeType : undefined;
      const contentType = mimeType ?? guessContentTypeFromName(fileName);
      return {
        uri,
        kind: inferKindFromContentType(contentType),
        contentType,
        fileName,
        displayName: fileName,
        source: 'file' as const,
        size: typeof a?.size === 'number' ? a.size : undefined,
      } satisfies PendingMediaItem;
    })
    .filter((it): it is PendingMediaItem => !!it);
}

export function pendingMediaFromInAppCameraCapture(cap: {
  uri: string;
  mode: 'photo' | 'video';
}): PendingMediaItem {
  const kind: MediaKind = cap.mode === 'video' ? 'video' : 'image';
  // Camera URIs can contain extremely long auto-generated filenames.
  // Use a short, stable filename for uploads, and a friendly UI label.
  const fileName = cap.mode === 'video' ? `camera-${Date.now()}.mp4` : `camera-${Date.now()}.jpg`;
  return {
    uri: cap.uri,
    kind,
    contentType:
      guessContentTypeFromName(fileName) ?? (cap.mode === 'video' ? 'video/mp4' : 'image/jpeg'),
    fileName,
    displayName: 'From Camera',
    source: 'camera',
    size: undefined,
  };
}
