import { Linking, Platform } from 'react-native';

import { defaultFileExtensionForContentType } from './mediaKinds';

function safeFileName(name: string): string {
  return String(name || '')
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 140);
}

function ensureExtension(fileName: string, contentType?: string): string {
  const n = String(fileName || '').trim();
  if (!n) return '';
  const hasDot = n.includes('.') && !n.endsWith('.');
  if (hasDot) return n;
  const ext = defaultFileExtensionForContentType(contentType);
  return ext ? `${n}.${ext}` : n;
}

export async function openExternalFile(opts: {
  url: string;
  fileName?: string;
  contentType?: string;
  /**
   * Web-only: show a confirmation modal before opening (prevents surprise downloads).
   */
  requestOpenLink?: (url: string) => void;
}): Promise<void> {
  const url = String(opts.url || '').trim();
  if (!url) return;

  if (Platform.OS === 'web') {
    if (opts.requestOpenLink) {
      opts.requestOpenLink(url);
      return;
    }
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
    return;
  }

  // If we already have a local URI (DM decrypt cache, etc), open it directly.
  if (url.startsWith('file:') || url.startsWith('content:')) {
    await Linking.openURL(url).catch(() => {});
    return;
  }

  // Native: download to cache then open local file so the OS can offer "Open with…" viewers.
  try {
    const fs = require('expo-file-system') as {
      cacheDirectory?: string;
      downloadAsync?: (remote: string, local: string) => Promise<{ uri: string }>;
    };
    const cacheDir = typeof fs?.cacheDirectory === 'string' ? fs.cacheDirectory : '';
    const downloadAsync = fs?.downloadAsync;
    if (cacheDir && typeof downloadAsync === 'function') {
      const base =
        safeFileName(String(opts.fileName || '').trim()) ||
        safeFileName(`attachment-${Date.now()}`) ||
        `attachment-${Date.now()}`;
      const outName = ensureExtension(base, opts.contentType);
      const sep = cacheDir.endsWith('/') ? '' : '/';
      const localUri = `${cacheDir}${sep}${Date.now()}-${outName}`;
      const res = await downloadAsync(url, localUri);
      const local = String(res?.uri || '').trim();
      if (local) {
        await Linking.openURL(local).catch(() => {});
        return;
      }
    }
  } catch {
    // ignore and fall back to opening the remote URL
  }

  await Linking.openURL(url).catch(() => {});
}
