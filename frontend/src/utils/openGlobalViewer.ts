import type { MediaItem } from '../types/media';
import { getPreviewKind, isPreviewableMedia } from './mediaKinds';

export type GlobalViewerItem = { url: string; kind: 'image' | 'video' | 'file'; fileName?: string };

export type OpenGlobalViewerResult =
  | { mode: 'external'; url: string }
  | { mode: 'viewer'; index: number; items: GlobalViewerItem[] }
  | null;

export async function openGlobalViewerFromMediaList(opts: {
  mediaList: MediaItem[];
  startIdx: number;
  resolveUrlForPath: (path: string) => Promise<string | null> | string | null;
  /**
   * If true and the tapped item is a non-previewable file, return mode:'external' with that URL.
   * (Callers can then `Linking.openURL(url)`.)
   */
  openExternalIfFile?: boolean;
  /**
   * If true, include file items in the viewer list (in addition to images/videos).
   * If false, only previewable (image/video) items are included.
   */
  includeFilesInViewer?: boolean;
}): Promise<OpenGlobalViewerResult> {
  const list = Array.isArray(opts.mediaList) ? opts.mediaList.filter(Boolean) : [];
  if (!list.length) return null;

  const startIdx = Math.floor(opts.startIdx || 0);
  const tappedIdx = Math.max(0, Math.min(list.length - 1, startIdx));
  const tapped = list[tappedIdx];
  const tappedKind = tapped ? getPreviewKind(tapped) : 'file';

  if (opts.openExternalIfFile && tapped?.path && tappedKind === 'file') {
    const u = await opts.resolveUrlForPath(String(tapped.path));
    const url = u ? String(u) : '';
    return url ? { mode: 'external', url } : null;
  }

  // Chat: include everything (image/video/file) but drop items missing URLs, and use the original startIdx clamped to items.length.
  // Guest: include only previewable (image/video) items, and remap the tapped index to the filtered list index.
  const includeFiles = !!opts.includeFilesInViewer;

  if (includeFiles) {
    const items: GlobalViewerItem[] = [];
    for (const m of list) {
      const p = String(m?.path || '').trim();
      if (!p) continue;
      const u = await opts.resolveUrlForPath(p);
      const url = u ? String(u) : '';
      if (!url) continue;
      items.push({ url, kind: getPreviewKind(m), fileName: m.fileName });
    }
    if (!items.length) return null;
    const idx = Math.max(0, Math.min(items.length - 1, startIdx));
    return { mode: 'viewer', index: idx, items };
  }

  const previewIdxByOriginalIdx: number[] = [];
  const previewList: MediaItem[] = [];
  for (let i = 0; i < list.length; i++) {
    if (isPreviewableMedia({ kind: getPreviewKind(list[i]), contentType: list[i]?.contentType })) {
      previewIdxByOriginalIdx[i] = previewList.length;
      previewList.push(list[i]);
    }
  }
  if (!previewList.length) return null;

  const items: GlobalViewerItem[] = [];
  for (const m of previewList) {
    const p = String(m?.path || '').trim();
    if (!p) continue;
    const u = await opts.resolveUrlForPath(p);
    const url = u ? String(u) : '';
    if (!url) continue;
    items.push({ url, kind: getPreviewKind(m), fileName: m.fileName });
  }
  if (!items.length) return null;

  const start = previewIdxByOriginalIdx[tappedIdx] ?? 0;
  const idx = Math.max(0, Math.min(items.length - 1, start));
  return { mode: 'viewer', index: idx, items };
}

