import type { MediaItem, MediaKind } from '../types/media';

function fileExtensionFromName(fileName?: string): string {
  const name = String(fileName || '').trim();
  if (!name) return '';
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0 || lastDot === name.length - 1) return '';
  const ext = name
    .slice(lastDot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9+_-]/g, '');
  return ext;
}

export function inferKindFromContentType(contentType?: string): MediaKind {
  const ct = String(contentType || '')
    .trim()
    .toLowerCase();
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
  const ct = String(contentType || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
  // Common non-image/video types we want to save with a useful extension so OS "open with" works.
  const mapped: Record<string, string> = {
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/csv': 'csv',
    'application/zip': 'zip',
    'application/json': 'json',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
  };
  if (mapped[ct]) return mapped[ct];
  // Fallback: use the subtype if it looks usable (e.g. application/pdf -> pdf),
  // otherwise a generic extension.
  return subtype || 'bin';
}

export function fileBadgeForMedia(
  input: Pick<MediaItem, 'kind' | 'contentType' | 'fileName'>,
): string {
  const k = getPreviewKind(input);
  if (k === 'image') return 'IMG';
  if (k === 'video') return 'VID';

  const ct = String(input.contentType || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
  const ext = fileExtensionFromName(input.fileName);
  const byCt: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/html': 'HTML',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'application/zip': 'ZIP',
  };
  if (byCt[ct]) return byCt[ct];

  const byExt: Record<string, string> = {
    pdf: 'PDF',
    doc: 'DOC',
    docx: 'DOCX',
    xls: 'XLS',
    xlsx: 'XLSX',
    ppt: 'PPT',
    pptx: 'PPTX',
    html: 'HTML',
    htm: 'HTML',
    txt: 'TXT',
    csv: 'CSV',
    mp3: 'MP3',
    m4a: 'M4A',
    wav: 'WAV',
    ogg: 'OGG',
    opus: 'OPUS',
    zip: 'ZIP',
    '7z': '7Z',
    rar: 'RAR',
  };
  if (ext && byExt[ext]) return byExt[ext];
  if (ct.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
}

/**
 * MaterialCommunityIcons icon name for common file types.
 * (We keep this as a string mapping so we don't have to import icon libs in util code.)
 */
export function fileIconNameForMedia(
  input: Pick<MediaItem, 'kind' | 'contentType' | 'fileName'>,
): string | null {
  const k = getPreviewKind(input);
  if (k === 'image') return 'file-image-outline';
  if (k === 'video') return 'file-video-outline';

  const ct = String(input.contentType || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
  const ext = fileExtensionFromName(input.fileName);

  // Prefer explicit MIME types when present.
  if (ct === 'application/pdf') return 'file-pdf-box';
  if (ct === 'text/html') return 'language-html5';
  if (ct === 'text/plain') return 'file-document-outline';
  if (ct === 'text/csv') return 'file-delimited-outline';
  if (ct === 'application/json') return 'code-json';
  if (ct === 'application/zip') return 'folder-zip-outline';
  if (ct.startsWith('audio/')) return 'file-music-outline';

  // Fallback by extension.
  const byExt: Record<string, string> = {
    pdf: 'file-pdf-box',
    doc: 'file-word-outline',
    docx: 'file-word-outline',
    xls: 'file-excel-outline',
    xlsx: 'file-excel-outline',
    ppt: 'file-powerpoint-outline',
    pptx: 'file-powerpoint-outline',
    html: 'language-html5',
    htm: 'language-html5',
    txt: 'file-document-outline',
    md: 'language-markdown-outline',
    csv: 'file-delimited-outline',
    json: 'code-json',
    mp3: 'file-music-outline',
    m4a: 'file-music-outline',
    wav: 'file-music-outline',
    ogg: 'file-music-outline',
    opus: 'file-music-outline',
    zip: 'folder-zip-outline',
    rar: 'folder-zip-outline',
    '7z': 'folder-zip-outline',
  };
  if (ext && byExt[ext]) return byExt[ext];

  return null;
}

/**
 * Brand-ish color for common file types (incoming only).
 * Outgoing bubbles should generally keep icons white for contrast.
 */
export function fileBrandColorForMedia(
  input: Pick<MediaItem, 'kind' | 'contentType' | 'fileName'>,
): string | null {
  const k = getPreviewKind(input);
  if (k === 'image') return null;
  if (k === 'video') return null;

  const ct = String(input.contentType || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
  const ext = fileExtensionFromName(input.fileName);

  // Prefer MIME when available.
  if (ct === 'application/pdf') return '#E02F2F'; // Adobe-ish red
  if (ct === 'text/html') return '#E34F26'; // HTML5 orange
  if (ct.startsWith('audio/')) return '#7C4DFF'; // purple
  if (ct === 'application/zip') return '#6D4C41'; // brown-ish

  const byExt: Record<string, string> = {
    pdf: '#E02F2F',
    doc: '#2B579A',
    docx: '#2B579A',
    xls: '#217346',
    xlsx: '#217346',
    ppt: '#D24726',
    pptx: '#D24726',
    html: '#E34F26',
    htm: '#E34F26',
    zip: '#6D4C41',
    rar: '#6D4C41',
    '7z': '#6D4C41',
    mp3: '#7C4DFF',
    m4a: '#7C4DFF',
    wav: '#7C4DFF',
    ogg: '#7C4DFF',
    opus: '#7C4DFF',
    txt: '#546E7A', // blue-gray
    csv: '#00695C', // teal
    json: '#1565C0', // blue
    md: '#37474F', // slate
  };
  if (ext && byExt[ext]) return byExt[ext];
  return null;
}

export function attachmentLabelForMedia(
  input: Pick<MediaItem, 'kind' | 'contentType' | 'fileName'>,
): string {
  const k = getPreviewKind(input);
  if (k === 'image') return 'Photo';
  if (k === 'video') return 'Video';
  const badge = fileBadgeForMedia(input);
  // Keep it friendly for UI copy.
  if (badge === 'FILE') return 'Attachment';
  if (badge === 'AUDIO') return 'Audio';
  return badge;
}

export function previewLabelForMedia(
  input: Pick<MediaItem, 'kind' | 'contentType'>,
): 'Photo' | 'Video' | 'Attachment' {
  const k = getPreviewKind(input);
  if (k === 'image') return 'Photo';
  if (k === 'video') return 'Video';
  return 'Attachment';
}
