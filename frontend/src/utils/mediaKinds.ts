import type { MediaItem, MediaKind } from '../types/media';

export function inferKindFromContentType(contentType?: string): MediaKind {
  const ct = String(contentType || '').trim().toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  return 'file';
}

// Some attachments are stored as kind:'file' but have image/* or video/* content types.
// For UI preview purposes we treat them as images/videos.
export function getPreviewKind(input: Pick<MediaItem, 'kind' | 'contentType'>): MediaKind {
  const kind = input.kind;
  if (kind !== 'file') return kind;
  const inferred = inferKindFromContentType(input.contentType);
  return inferred === 'image' || inferred === 'video' ? inferred : 'file';
}

export function isImageLike(input: Pick<MediaItem, 'kind' | 'contentType'>): boolean {
  return getPreviewKind(input) === 'image';
}

export function isVideoLike(input: Pick<MediaItem, 'kind' | 'contentType'>): boolean {
  return getPreviewKind(input) === 'video';
}

export function isPreviewableMedia(input: Pick<MediaItem, 'kind' | 'contentType'>): boolean {
  const k = getPreviewKind(input);
  return k === 'image' || k === 'video';
}

function getCleanContentTypeSubtype(contentType?: string): string {
  const ct = String(contentType || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
  const parts = ct.split('/');
  const subtype = (parts[1] || '').trim();
  // Keep only simple safe chars for extensions.
  const safe = subtype.replace(/[^a-z0-9.+-]/g, '');
  return safe;
}

export function defaultFileExtensionForContentType(contentType?: string): string {
  const kind = inferKindFromContentType(contentType);
  const subtype = getCleanContentTypeSubtype(contentType);
  if (kind === 'image') return subtype || 'jpg';
  if (kind === 'video') return subtype || 'mp4';
  return 'bin';
}

export function previewLabelForMedia(input: Pick<MediaItem, 'kind' | 'contentType'>): 'Photo' | 'Video' | 'Attachment' {
  const k = getPreviewKind(input);
  if (k === 'image') return 'Photo';
  if (k === 'video') return 'Video';
  return 'Attachment';
}

